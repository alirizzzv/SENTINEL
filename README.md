<div align="center">

# 🛡 SENTINEL

### AI Prompt Security Gateway — *Your AI. Your Data. Your Rules.*

**A browser-native security layer that detects & redacts sensitive data and prompt-injection
attacks _before_ they ever reach ChatGPT, Claude, or Gemini — in under 5 ms, with nothing
stored but anonymized metadata.**

[![CI](https://img.shields.io/badge/CI-108%20tests%20passing-0fb27f?style=flat-square)](https://github.com/alirizzzv/SENTINEL/actions)
[![Manifest](https://img.shields.io/badge/Chrome-Manifest%20V3-6d5efc?style=flat-square)](extension/manifest.json)
[![Engine](https://img.shields.io/badge/detection-Trie%20%2B%20Aho--Corasick-b15cff?style=flat-square)](src/engine)
[![Privacy](https://img.shields.io/badge/privacy-local--first-0fb27f?style=flat-square)](#-privacy)
[![License](https://img.shields.io/badge/license-MIT-1b2038?style=flat-square)](LICENSE)

🔗 **[Live demo & dashboard →](https://alirizzzv.github.io/SENTINEL/)**

</div>

---

<div align="center">
  <img src="docs/screenshots/hero.png" alt="SENTINEL landing" width="100%" />
</div>

## The problem

Every day, people paste **API keys, credentials, customer PII, and internal docs** into ChatGPT
to "just debug this" or "clean up this paragraph." The instant they hit send, that data is on a
third party's servers — potentially used for training, potentially exposed in a breach,
permanently outside their control. Enterprise DLP tools are expensive, IT-gated, and *reactive* —
they audit **after** the leak.

**SENTINEL intercepts _before_ the prompt is sent**, runs entirely in the browser, and works
across every major LLM with one install.

## How it works

> You type a prompt → SENTINEL scans it synchronously in-page → if something sensitive is found,
> a modal slides in showing exactly what, ranked by severity → you choose **Redact & Send**,
> **Send Anyway**, or **Cancel**. Only anonymized metadata is ever stored, locally.

<div align="center">
  <img src="docs/screenshots/modal.png" alt="Interceptor modal" width="46%" valign="top" />
&nbsp;&nbsp;
  <img src="docs/screenshots/popup.png" alt="Extension popup" width="30%" valign="top" />
</div>

<div align="center"><sub>Left: the interceptor modal on a real send. Right: the toolbar popup.</sub></div>

## Analytics dashboard

A full React dashboard — risk trends, threat breakdown, filterable history, settings — reading
**only local metadata** (sample data shown outside the extension).

<div align="center">
  <img src="docs/screenshots/dashboard-overview.png" alt="Dashboard overview" width="49%" />
  <img src="docs/screenshots/dashboard-history.png" alt="Dashboard history" width="49%" />
</div>

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser["🌐 User's Browser"]
    LLM["LLM page<br/>ChatGPT · Claude · Gemini"]
    subgraph Ext["🛡 SENTINEL extension"]
      CS["Content script<br/>adapter + in-page scan"]
      ENG["Detection engine<br/>Trie · Aho-Corasick"]
      SW["Service worker"]
      DB[("IndexedDB<br/>500-event ring buffer")]
      UI["Popup · Dashboard"]
    end
  end
  LLM -- "① send attempt" --> CS
  CS -- "② scan (sync, &lt;5ms)" --> ENG
  ENG -- "③ verdict" --> CS
  CS -- "④ redact / send / cancel" --> LLM
  CS -- "⑤ metadata only" --> SW --> DB
  DB --> UI
  SW -. "opt-in sync" .-> API["FastAPI + Postgres<br/>(enterprise)"]
```

**Single source of truth:** the framework-free engine in [`src/engine`](src/engine) is unit-tested
by Vitest **and** bundled (esbuild) into the content script so detection runs *synchronously
in-page* — what's tested is exactly what ships.

## Detection pipeline

```mermaid
flowchart TD
  A["Raw prompt"] --> B["Normalize<br/>NFKC · de-leetspeak · de-obfuscate"]
  B --> C["Aho-Corasick candidate scan<br/><i>one linear pass, all patterns</i>"]
  C --> D["Regex validation<br/>+ Luhn check + sub-match suppression"]
  D --> E["Prefix-less detection<br/>Shannon entropy + decode-and-rescan"]
  E --> F["Injection detection<br/>3 layers: patterns · heuristics · confidence"]
  F --> G["Risk scoring<br/>max-heap composite → SAFE / CAUTION / HIGH"]
  G --> H["Redaction<br/>merge-intervals → placeholders"]
  H --> I["Result<br/>level · score · threats · redactedText"]
```

Detection runs in **layers** so each closes a gap the previous one structurally can't:
format anchors catch known keys → **entropy** catches renamed/custom secrets with no known
prefix → **decode-and-rescan** catches secrets hidden inside base64 → **normalization** stops
leetspeak/homoglyph obfuscation from sneaking attacks past the injection detector.

## Why the data structures matter

| Stage | Technique | Complexity |
|-------|-----------|-----------|
| Multi-pattern scan | **Aho-Corasick** (Trie + BFS failure links → DFA) | `O(n + m + z)` |
| Prefix-less secret detection | **Shannon entropy** + context gating | `O(n)` |
| Threat prioritization | hand-built **max-heap** | `O(k log k)` |
| Adapter lookup (per site) | **hash map** | `O(1)` |
| Local storage | **circular buffer** (FIFO, bounded 500) | `O(1)` amortized |
| Redaction / overlap merge | **merge intervals** | `O(n log n)` |
| Two-stage detection | candidate-find → validate (like grep/Elasticsearch) | — |


## Performance

`npm run bench` (Node 25) — Aho-Corasick keeps detection **linear**, so there's no catastrophic
backtracking even on adversarial input:

| Prompt | Size | p50 | p99 |
|--------|------|-----|-----|
| typical prompt | ~50 B | **0.002 ms** | 0.01 ms |
| realistic mixed | ~1 KB | 0.023 ms | 0.045 ms |
| large document | ~10 KB | 0.26 ms | 0.38 ms |
| adversarial near-miss | ~80 KB | **2.4 ms** | 2.6 ms |

## Features

- 🔍 **Real-time interception** on ChatGPT, Claude & Gemini — adapter pattern adds a new LLM in ~5 lines
- 🧠 **25+ patterns / 10 categories** — cloud keys, tokens, private keys, DB creds, cards, gov IDs, PII
- 🎲 **Prefix-less secret detection** — Shannon-entropy + context catches *renamed/custom* secrets a regex can't (`db_pass=…`, `MY_TOKEN=…`)
- 🧬 **Decode-and-rescan** — unwraps base64 blobs and re-scans, catching keys hidden by encoding
- 🪄 **Prompt-injection detection** — 3-layer (phrases + heuristics + confidence), now **obfuscation-resistant** (de-leetspeak / homoglyph normalization)
- ✂️ **Smart redaction** — replaces secrets with `[PLACEHOLDERS]`; the prompt still makes sense
- 📊 **Local analytics dashboard** — trends, breakdowns, history, CSV export
- 🔒 **Local-first & private** — no network in the scan path; metadata only; never your prompt text
- 🧩 **Optional self-hosted backend** — opt-in, org-scoped proof-of-concept (FastAPI), runs on *your* server

## 🔒 Privacy

SENTINEL requests only `storage` + the three LLM domains. It makes **zero network requests while
scanning** (verify in DevTools → Network). It never stores prompt content or detected values —
only anonymized metadata in a local 500-event ring buffer.

## Install & use

> **The same steps work on macOS, Windows, and Linux.** SENTINEL is a Chromium browser
> extension, so your operating system doesn't change anything below.

### ⚡ Option 1 — Just try it (0 minutes, no install)

Open the **[live demo](https://alirizzzv.github.io/SENTINEL/demo/)** in any browser, paste a
fake secret like `AKIAIOSFODNN7EXAMPLE`, and watch SENTINEL catch it. Best way to see it in
action in 10 seconds.

### 🧩 Option 2 — Install the real extension (~3 minutes)

**Before you start, install these** (same on every OS):
[Node.js 18+](https://nodejs.org/en/download) · [Git](https://git-scm.com/downloads) · a
Chromium browser ([Chrome](https://www.google.com/chrome/), or the **Edge** already on Windows).

**Step 1 — Get the code and build it.** Open Terminal (Mac) or PowerShell (Windows) and run:

```bash
git clone https://github.com/alirizzzv/SENTINEL.git
cd SENTINEL
npm install
npm run build
```

**Step 2 — Load it into your browser:**

1. Open your browser's extensions page: `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Turn on **Developer mode** (toggle in the top-right on Chrome, left sidebar on Edge).
3. Click **Load unpacked** and select the **`extension`** folder inside the project you just cloned.

**Step 3 — Use it.** Open [ChatGPT](https://chatgpt.com), [Claude](https://claude.ai), or
[Gemini](https://gemini.google.com), type a prompt containing `AKIAIOSFODNN7EXAMPLE`, and press
Enter — SENTINEL's modal appears before anything is sent.

👉 Stuck on any step? The **[full illustrated guide is in INSTALL.md](INSTALL.md)**.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Detection engine | Vanilla JS (ES modules) | framework-free, loads instantly, runs in-page |
| Extension | Manifest V3 | minimal permissions, service-worker model |
| Dashboard | React + Vite + Chart.js | rich SPA, built to static files |
| Backend (optional) | FastAPI + SQLAlchemy | async, Pydantic validation, SQLite→Postgres |
| Tests | Vitest + pytest + fake-indexeddb | 108 tests (101 engine/UI + 7 backend) incl. adversarial & ReDoS |

## Repository layout

```
src/engine/    framework-free detection engine (the heart) — unit tested
tests/         Vitest suite: unit · corpus · adversarial · persistence · bench
extension/     Manifest V3 extension (content script, worker, popup, modal, dashboard build)
dashboard/     React + Vite source (builds into extension/dashboard/)
backend/       FastAPI enterprise API (optional) + Dockerfile / render.yaml
demo/          self-contained offline harness
docs/          ARCHITECTURE.md deep dive + screenshots
.github/       CI + GitHub Pages deploy workflows
```

## Development

```bash
npm test            # 101 engine/UI tests (Vitest)
npm run bench       # performance benchmark
npm run build       # engine bundle (esbuild) + dashboard (Vite)
npm run package:ext # -> sentinel-extension.zip  (macOS/Linux — needs the `zip` CLI; Windows: see INSTALL.md)
cd backend && pip install -r requirements.txt && pytest -q   # 7 backend tests
```

## Limitations & future work

Detection is **layered and deterministic** — format anchors → entropy → decode-and-rescan →
normalization → context scoring. I know exactly where the walls are, by design:

- **No semantic / intent understanding.** Injection phrased indirectly or "sarcastically"
  (no trigger words, no override grammar) is not caught — that needs an ML classifier, which
  is deliberate **future work**, not a regex problem.
- **Injection detection is heuristic.** Normalization closes the obfuscation bypass (leetspeak,
  homoglyphs), but a sufficiently novel paraphrase can still score below threshold. The
  confidence model trades a little recall for far fewer false positives ("one weak signal isn't
  enough").
- **Entropy detection is context-gated.** A high-entropy secret with *no* assignment and *no*
  nearby keyword (a bare token on its own line) can still slip — the gate is what keeps false
  positives near zero, and it's a conscious recall/precision tradeoff.
- **Adapter selectors can drift.** Interception depends on each LLM site's DOM; a major redesign
  can require a one-line selector update in `adapter-registry.js`.
- **The user is the final layer.** SENTINEL is a guardrail, not an enforced control — "Send
  Anyway" always exists. That's intentional: it warns and informs, it doesn't lock you out.

**Roadmap:** a small local injection classifier (measured precision/recall vs. the heuristic
baseline) · broader catalog (Azure, GCP, GitLab) · an adapter self-test/heartbeat that flags when
a site redesign has broken interception.

## License

MIT © [Ali Husain Rizvi (@alirizzzv)](https://github.com/alirizzzv) & [Nikita Chaurasia (@nikitayk)](https://github.com/nikitayk)
