<div align="center">

# 🛡 SENTINEL

### AI Prompt Security Gateway — *Your AI. Your Data. Your Rules.*

A browser-native AI security layer that **detects and redacts sensitive data and prompt-injection
attacks before they ever reach an LLM** (ChatGPT, Claude, Gemini).

Real-time prompt interception • Trie + Aho-Corasick detection • Risk scoring • Local-first privacy

</div>

---

## The problem

Every day people paste API keys, credentials, customer PII, and internal documents into ChatGPT
to "just debug this" or "clean up this doc." The moment they hit send, that data is on a third
party's servers — potentially used for training, potentially exposed in a breach, permanently
outside their control. Existing DLP tools are expensive, IT-gated, and *reactive* — they audit
after the leak. SENTINEL intercepts **before** the prompt is sent.

## What it does

1. **Intercepts** every prompt before it leaves the browser.
2. **Scans** it in under 5 ms with a hand-built **Trie + Aho-Corasick** multi-pattern matcher.
3. **Scores** the risk (0–100) across 8 threat categories.
4. **Asks** the user: *Redact & Send*, *Send Anyway* (logged), or *Cancel*.
5. **Stores** only anonymized metadata, locally (IndexedDB, 500-event circular buffer). Never the
   prompt. Never a server, by default.

## Architecture

```
┌──────────────────────────── USER'S BROWSER ────────────────────────────┐
│  LLM page (ChatGPT/Claude/Gemini)        SENTINEL extension             │
│  ┌──────────────┐   intercept   ┌──────────────────────────────────┐   │
│  │ input box    │──────────────▶│ content script (adapter + scan)  │   │
│  │ interceptor  │◀──────────────│   ↳ runs engine synchronously    │   │
│  │ modal        │               └───────────────┬──────────────────┘   │
│  └──────────────┘                   metadata only│                      │
│                                  ┌───────────────▼──────────────────┐   │
│  popup  ◀──── stats ────────────│ background worker + IndexedDB     │   │
│  dashboard ◀── analytics ───────│   (500-event circular buffer)     │   │
│                                  └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                         optional, opt-in │
                                          ▼  FastAPI + Postgres (enterprise)
```

## Detection engine (the core)

| Stage | Technique | Complexity |
|-------|-----------|-----------|
| Multi-pattern candidate scan | **Aho-Corasick** (Trie + BFS failure links) | `O(n + m + z)` |
| Validation | strict regex per pattern | — |
| Risk scoring | weighted composite + **max-heap** priority queue | `O(k log k)` |
| Injection detection | 3-layer: patterns + heuristics + confidence | `O(n)` |
| Redaction | **merge-intervals** + single-pass slicing | `O(n)` |
| Local storage | **circular buffer** (FIFO, bounded 500) | `O(1)` amortized |

## Project status

Built in phases — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full deep dive.

- [x] Phase 1 — Detection engine + tests (Trie, Aho-Corasick, scorer, injection, redactor)
- [x] Phase 2 — Chrome extension (MV3) + offline demo harness
- [x] Phase 3 — Popup + React/Vite dashboard
- [x] Phase 4 — Enterprise backend (FastAPI + Postgres/SQLite)
- [x] Phase 5 — Docs & polish

## Quick start

```bash
npm install        # dev deps
npm test           # 61 engine tests (Vitest)
npm run build      # bundle engine (esbuild) + dashboard (Vite) into extension/
```

### Try it in 10 seconds — offline demo

Open `demo/index.html` in any browser (or `python3 -m http.server` and visit
`/demo/`). Type a prompt with a fake secret, hit Enter, watch SENTINEL intercept.
The same engine that ships in the extension runs entirely in the page.

### Load the extension in Chrome

1. `npm run build` (generates `extension/vendor/engine.global.js` + `extension/dashboard/`).
2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select the `extension/` folder.
4. Open ChatGPT / Claude / Gemini and try sending a prompt containing a secret.

### Enterprise backend (optional)

See [`backend/README.md`](backend/README.md). Runs on SQLite with zero setup;
point `DATABASE_URL` at Postgres for production.

## Repository layout

```
src/engine/    framework-free detection engine (the heart) — unit tested
tests/         Vitest suite incl. positive/negative corpus
extension/     Manifest V3 extension (content script, worker, popup, modal, dashboard build)
dashboard/     React + Vite source (builds into extension/dashboard/)
backend/       FastAPI enterprise API (optional)
demo/          self-contained offline harness
docs/          ARCHITECTURE.md deep dive
```

## License

MIT
