# SENTINEL — Architecture & Engineering Deep Dive

This document explains *how* SENTINEL works and *why* each decision was made. It
doubles as interview prep: every component maps to a data-structures/algorithms
concept and a real-world systems trade-off.

---

## 1. System overview

SENTINEL is a **local-first** AI security layer. Everything that matters —
interception and detection — runs inside the user's browser. There is no server
in the data path by default; the optional enterprise backend only ever receives
anonymized metadata, and only if a user opts in.

```
┌──────────────────────────────── USER'S BROWSER ──────────────────────────────┐
│                                                                               │
│  LLM page (ChatGPT/Claude/Gemini)            SENTINEL extension               │
│  ┌───────────────┐   1. send attempt   ┌────────────────────────────────┐    │
│  │ input box     │────────────────────▶│ content-script.js              │    │
│  │               │                     │  • O(1) adapter lookup          │    │
│  │ interceptor   │◀────4. decision─────│  • SENTINEL.scan() (synchronous)│    │
│  │ modal         │                     └───────────────┬────────────────┘    │
│  └───────────────┘                  5. metadata only   │ chrome.runtime msg   │
│                                     ┌──────────────────▼────────────────┐    │
│  popup.js  ◀──── stats ────────────│ service-worker.js + db-manager.js  │    │
│  dashboard (React) ◀── analytics ──│ IndexedDB · 500-event ring buffer  │    │
│                                     └────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘
                                   opt-in, metadata only │
                                                         ▼
                                         FastAPI + Postgres (per-org analytics)
```

**Single source of truth.** The detection engine in `src/engine/` is plain ES
modules. The exact same code is (a) unit-tested by Vitest, (b) bundled by esbuild
into a global the content script runs **synchronously in-page**, and (c) bundled
for the offline demo. No drift between what's tested and what ships.

---

## 2. The detection pipeline

`scan(text)` (`src/engine/index.js`):

```
raw text
  │ 1. normalize (lowercase copy for matching)
  ▼
Aho-Corasick candidate scan  ── which anchored patterns are worth validating?
  │ 2. + always-on regexes for anchorless PII (email/phone/card/IDs)
  ▼
regex validation  ── precise spans (+ optional checks, e.g. Luhn)
  │ 3. + sub-match suppression (merge-intervals-style containment filter)
  ▼
injection detection (3 layers)
  │ 4.
  ▼
risk scoring (max-heap, composite)  ── {level, score, threats[] sorted desc}
  │ 5.
  ▼
redaction (merge-intervals)  ── redactedText
  ▼
result object
```

### 2.1 Trie (`trie.js`)

The foundational prefix tree. `insert` is `O(m)`, lookup `O(n)`. Aho-Corasick is
built on top of this idea. Kept standalone so the base structure is independently
testable.

### 2.2 Aho-Corasick (`aho-corasick.js`) — the centerpiece

A multi-pattern matcher that finds **every** occurrence of **any** pattern in a
single linear pass.

- **Construction:** insert all patterns into a goto-trie, then compute **failure
  links via BFS**. A node's failure link points to the longest proper suffix of
  its path that is also a prefix in the trie. BFS (level order) guarantees a
  parent's failure link is finalized before its children need it. **Output links**
  are merged so each node reports its own terminal patterns *plus* everything
  reachable through failure links.
- **Search:** walk the text; on mismatch, follow failure links instead of
  restarting. Total **`O(n + m + z)`** (text + patterns + matches).
- **Why not 25 regexes?** Sequential regex is `O(k·n)`. Worse, regex backtracking
  can blow up on adversarial input and hang the tab. Aho-Corasick is a DFA — no
  backtracking, linear guaranteed. This is the same algorithm used in antivirus
  engines and network IDS.

### 2.3 Two-stage detection (`pattern-dictionary.js`)

Aho-Corasick finds **candidates** (cheap literal anchors like `akia`, `ghp_`,
`-----begin`); a strict **regex validates** the full structure and yields exact
spans. This "fast candidate → precise validation" pattern is how grep and
Elasticsearch work.

> **Honest nuance:** anchorless PII (email, phone, card numbers) has no literal
> prefix, so those run as a small set of always-on regexes. Keyword/prefix
> secrets and injection phrases go through the automaton. This is exactly how
> real DLP engines split the problem.

An optional `validate(match)` callback adds checks a regex can't express cleanly —
e.g. the **Luhn checksum** on candidate credit-card numbers, so random 16-digit
order IDs don't get flagged.

### 2.4 Sub-match suppression (`index.js`)

A credit card's first 12 digits also match the Aadhaar pattern. We drop any match
fully contained in a longer, at-least-as-severe match of a different pattern —
a containment filter in the spirit of *merge intervals* — so the threat list is
honest. (Caught during testing; guarded by a regression test.)

### 2.5 Risk scoring (`risk-scorer.js`)

Threats are pushed into a hand-built **binary max-heap** and popped in descending
severity, so the modal shows the scariest thing first. `push`/`pop` are
`O(log k)`. Composite score:

```
base  = highest single threat score
bonus = 5 × (additional distinct threats)
final = min(100, base + bonus)        bands: 0–30 SAFE · 31–60 CAUTION · 61–100 HIGH
```

### 2.6 Injection detection (`injection-detector.js`) — 3 layers

1. **Pattern match:** known attack phrases via a dedicated Aho-Corasick automaton.
2. **Heuristics:** structural signals — meta-references to the model's own
   instructions, an override verb adjacent to an instruction noun, malicious
   role assignment, obfuscation (leetspeak), a late role-change in a long prompt.
3. **Confidence threshold:** signals accumulate a confidence in `[0,1]`; we only
   flag above a sensitivity-controlled threshold (LOW .8 / MEDIUM .6 / HIGH .4).

**False positives are the real enemy.** "Act as a tour guide" must not fire — a
tool that cries wolf gets disabled, which is worse than a missed detection. The
corpus test enforces this with 8 known-negative prompts. We never hard-block; the
user always decides.

### 2.7 Redaction (`redactor.js`)

Detected spans can overlap (a Bearer token whose value is a JWT). We **merge
intervals** (sort by start `O(n log n)`, sweep once `O(n)`, keep the
higher-severity placeholder on collision), then do a single left-to-right slice
pass. `"my key is AKIA… " → "my key is [AWS_ACCESS_KEY]"`.

---

## 3. Extension architecture

### 3.1 Adapter pattern (`content/adapter-registry.js`)

A hash map keyed by hostname. On page load the content script does an **O(1)**
lookup; unsupported sites get zero overhead. Each adapter only knows *how* to find
the input box and send action — it knows nothing about detection. Adding a new LLM
is a config entry, not a code change (open/closed principle). Selectors are arrays
tried in order, so one upstream class-name change doesn't break interception.

### 3.2 Synchronous interception (`content/content-script.js`)

`preventDefault()` must be called synchronously to stop a send, so detection must
be synchronous too. That's why the engine is **bundled into the content script**
(esbuild → `vendor/engine.global.js`) rather than living only in the background
worker. Detection is <5 ms, so there's no perceptible delay. Only *storage* is
async (a fire-and-forget message to the worker). We intercept both **Enter**
(without Shift) and **send-button clicks**, with a `bypassNext` flag so our own
programmatic resend (after redaction) passes through cleanly.

### 3.3 Storage: circular buffer (`background/db-manager.js`)

IndexedDB, bounded at **500 events**, FIFO eviction (oldest deleted on overflow) —
a circular buffer, `O(1)` amortized insert. Same structure as OS I/O buffers and
network packet queues. **Metadata only**: timestamp, LLM, risk level/score, threat
*categories* (never values), user decision, timing. Never prompt content.

**Why IndexedDB over localStorage?** localStorage is synchronous (blocks the UI),
5 MB, strings only, not queryable. IndexedDB is async, 50 MB+, transactional, and
indexable — we range-query by timestamp/risk without loading everything into memory.

---

## 4. Privacy model

- No network in the data path by default; the extension requests **no host
  permissions beyond the three LLM domains** and only `storage`.
- The source is open and auditable; you can watch the DevTools Network tab show
  **zero outbound requests** during scanning.
- Enterprise sync is **opt-in**, runs against the org's *own* server, and uploads
  metadata only. API keys are stored server-side as **SHA-256 hashes**, never plaintext.

---

## 5. Backend (optional, `backend/`)

FastAPI + SQLAlchemy 2.0 + Pydantic. SQLite by default (zero setup); Postgres via
`DATABASE_URL`. Every query is **org-scoped**, backed by composite indexes
`(org_id, timestamp)`, `(org_id, risk_level)`, `(org_id, llm)` so one org never
scans another's rows. `threat_categories` uses a portable column type that works
on both SQLite and Postgres unchanged.

---

## 6. Scaling notes (interview answers)

- **1M users:** detection scales for free — it's a million parallel in-browser
  engines, zero server load. Only the enterprise backend scales: horizontal
  FastAPI behind a load balancer, **shard `sync_events` by `org_id`**, a read
  replica for analytics, and **TimescaleDB** for the time-series trend data.
- **Instant pattern updates:** today patterns ship with the extension (Web Store
  review = days). Move to a CDN-hosted JSON registry fetched on startup and cached
  in IndexedDB, keeping the bundled dictionary as offline fallback.
- **UI drift:** LLM sites change selectors. Mitigations: fallback selector arrays,
  a MutationObserver retry, and Playwright tests run daily against the live sites.

---

## 7. DSA map

| Feature | Concept | Complexity |
|---|---|---|
| Pattern storage | Trie | insert `O(m)`, lookup `O(n)` |
| Multi-pattern scan | Aho-Corasick (BFS + DFA) | `O(n + m + z)` |
| Threat ordering | Max-heap priority queue | `O(k log k)` |
| Adapter registry | Hash map | `O(1)` |
| Local storage | Circular buffer | `O(1)` amortized |
| Redaction / sub-match suppression | Merge intervals | `O(n log n)` |
| Candidate → validation | Two-stage filtering | — |
| Backend range queries | B-tree indexes | `O(log n)` |

---

## 8. Testing

- **Engine:** Vitest unit tests per structure + a **corpus test** (12 known
  positives, 8 known negatives) as a false-positive guard. `npm test`.
- **Extension:** offline demo harness (`demo/index.html`) exercises the full
  intercept → scan → modal → redact flow without a live site.
- **Backend:** pytest e2e against throwaway SQLite (`backend/tests`).
