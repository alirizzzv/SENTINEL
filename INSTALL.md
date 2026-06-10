# Installing SENTINEL in Chrome

SENTINEL runs as an unpacked Chrome extension. It works in Chrome, Edge, Brave,
and any Chromium browser. Two ways to install:

---

## Option A — from the repo (recommended for developers)

```bash
git clone https://github.com/alirizzzv/SENTINEL.git
cd SENTINEL
npm install
npm run build      # builds the engine bundle + dashboard into extension/
```

Then load it (see **Load unpacked** below), pointing at the `extension/` folder.

## Option B — packaged zip

1. Build the zip once: `npm run package:ext` (creates `sentinel-extension.zip`).
   If a build is attached to the repo's
   [Releases](https://github.com/alirizzzv/SENTINEL/releases), you can download it
   there instead.
2. Unzip it somewhere permanent (don't delete the folder afterwards — Chrome
   loads it from disk).

---

## Load unpacked

1. Open **`chrome://extensions`** in your browser.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select the **`extension/`** folder (Option A) or the unzipped folder (Option B).
5. SENTINEL appears in your toolbar. Pin it (puzzle-piece icon → pin) for the popup.

## Use it

1. Open **ChatGPT** (chatgpt.com), **Claude** (claude.ai), or **Gemini**
   (gemini.google.com).
2. Type a prompt containing something sensitive — e.g. paste this fake key:
   `AKIAIOSFODNN7EXAMPLE`
3. Press **Enter**. Before the prompt is sent, SENTINEL's modal slides in:
   - **Redact & Send** — replaces secrets with `[PLACEHOLDERS]` and sends.
   - **Send Anyway** — sends as-is (logged locally).
   - **Cancel** — keeps the prompt in the box to edit.
4. Click the toolbar icon for today's stats, or **Open Full Dashboard** for
   trends, history, and settings.

## Privacy

- SENTINEL requests only `storage` and access to the three LLM domains.
- It makes **no network requests** while scanning — open DevTools → Network on
  any LLM page to verify. Only anonymized metadata is stored locally (IndexedDB),
  never your prompt text.

## Troubleshooting

- **Modal didn't appear?** The LLM site may have changed its layout. Interception
  uses CSS selectors defined in `extension/content/adapter-registry.js` — they use
  fallbacks, but a major redesign can require a one-line update there.
- **Changed the code?** Return to `chrome://extensions` and click the **reload**
  (↻) icon on the SENTINEL card.
- **Dashboard empty?** It populates as you use AI tools; the bundled sample data
  only shows when the dashboard is opened *outside* the extension.
