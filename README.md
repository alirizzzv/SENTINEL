<div align="center">

# 🛡 SENTINEL

### AI Prompt Security Gateway — *Your AI. Your Data. Your Rules.*

**A browser-native security layer that detects & redacts sensitive data and prompt-injection
attacks _before_ they ever reach ChatGPT, Claude, or Gemini — in under 5 ms, with nothing
stored but anonymized metadata.**

[![CI](https://img.shields.io/badge/CI-91%20tests%20passing-0fb27f?style=flat-square)](https://github.com/alirizzzv/SENTINEL/actions)
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
  A["Raw prompt"] --> B["Normalize"]
  B --> C["Aho-Corasick candidate scan<br/><i>one linear pass, all patterns</i>"]
  C --> D["Regex validation<br/>+ Luhn check + sub-match suppression"]
  D --> E["Injection detection<br/>3 layers: patterns · heuristics · confidence"]
  E --> F["Risk scoring<br/>max-heap composite → SAFE / CAUTION / HIGH"]
  F --> G["Redaction<br/>merge-intervals → placeholders"]
  G --> H["Result<br/>level · score · threats · redactedText"]
```

## Why the data structures matter

| Stage | Technique | Complexity |
|-------|-----------|-----------|
| Multi-pattern scan | **Aho-Corasick** (Trie + BFS failure links → DFA) | `O(n + m + z)` |
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
- 🧠 **20+ patterns / 8 categories** — cloud keys, tokens, private keys, DB creds, cards, gov IDs, PII
- 🪄 **Prompt-injection detection** — 3-layer (phrases + heuristics + confidence) with sensitivity control
- ✂️ **Smart redaction** — replaces secrets with `[PLACEHOLDERS]`; the prompt still makes sense
- 📊 **Local analytics dashboard** — trends, breakdowns, history, CSV export
- 🔒 **Local-first & private** — no network in the scan path; metadata only; never your prompt text
- 🏢 **Optional enterprise backend** — opt-in, org-scoped, runs on *your* server

## 🔒 Privacy

SENTINEL requests only `storage` + the three LLM domains. It makes **zero network requests while
scanning** (verify in DevTools → Network). It never stores prompt content or detected values —
only anonymized metadata in a local 500-event ring buffer.

## Install & use

Full guide: **[INSTALL.md](INSTALL.md)**.

```bash
git clone https://github.com/alirizzzv/SENTINEL.git
cd SENTINEL && npm install && npm run build
```

Then: Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → pick `extension/`.
Open an LLM, type a prompt with `AKIAIOSFODNN7EXAMPLE`, press Enter — the modal appears.

> Try it instantly with no install at the **[live demo](https://alirizzzv.github.io/SENTINEL/demo/)**.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Detection engine | Vanilla JS (ES modules) | framework-free, loads instantly, runs in-page |
| Extension | Manifest V3 | minimal permissions, service-worker model |
| Dashboard | React + Vite + Chart.js | rich SPA, built to static files |
| Backend (optional) | FastAPI + SQLAlchemy | async, Pydantic validation, SQLite→Postgres |
| Tests | Vitest + pytest + fake-indexeddb | 91 tests incl. adversarial & persistence |

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
npm test            # 84 engine/UI tests (Vitest)
npm run bench       # performance benchmark
npm run build       # engine bundle (esbuild) + dashboard (Vite)
npm run package:ext # -> sentinel-extension.zip
cd backend && pip install -r requirements.txt && pytest -q   # 7 backend tests
```

## License

MIT © [Ali Husain Rizvi (@alirizzzv)](https://github.com/alirizzzv) & [Nikita Chaurasia (@nikitayk)](https://github.com/nikitayk)
