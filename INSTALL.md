# Installing & Using SENTINEL

This is a complete, beginner-friendly guide. **Every step is the same on macOS, Windows,
and Linux** — SENTINEL is a browser extension, so your operating system doesn't matter.
Where one tiny thing differs between Mac and Windows, it's called out with a 🍎 / 🪟 note.

**Two ways to use SENTINEL:**

- **[Just try it (no install)](#just-try-it--no-install)** — see it work in 10 seconds.
- **[Install the extension](#install-the-extension)** — use it for real on ChatGPT, Claude & Gemini.

---

## Just try it — no install

Open the live demo in any browser and paste a fake secret:

1. Go to **<https://alirizzzv.github.io/SENTINEL/demo/>**
2. Paste this fake key into the box: `AKIAIOSFODNN7EXAMPLE`
3. Press **Enter** → SENTINEL catches it and shows the redaction modal.

Nothing is installed and nothing leaves your browser. This is the fastest way to see what it does.

---

## Install the extension

### Step 0 — Install the prerequisites (one time)

You need three free tools. They're identical on every OS:

| Tool | What it's for | Download |
|------|---------------|----------|
| **Node.js 18 or newer** | builds the extension (includes `npm`) | <https://nodejs.org/en/download> |
| **Git** | downloads the code | <https://git-scm.com/downloads> |
| **A Chromium browser** | runs the extension | [Chrome](https://www.google.com/chrome/) — or the **Edge** already on your Windows PC |

> 🍎 **macOS shortcut:** if you have [Homebrew](https://brew.sh), just run `brew install node git`.
>
> 🪟 **Windows note:** run the Node.js `.msi` installer (it includes npm). After installing,
> open a **fresh** PowerShell window so it picks up the new commands.

**Check it worked.** Open **Terminal** (Mac) or **PowerShell** (Windows) and run:

```bash
node -v
git --version
```

You should see version numbers. If you see "command not found", reinstall the tool above and
reopen your terminal.

### Step 1 — Download and build SENTINEL

Copy-paste these commands one block at a time. They are **identical on Mac and Windows:**

```bash
git clone https://github.com/alirizzzv/SENTINEL.git
cd SENTINEL
npm install
npm run build
```

- `git clone` downloads the project into a new `SENTINEL` folder.
- `npm install` fetches the build tools (takes ~1 minute).
- `npm run build` produces the ready-to-load extension inside the **`extension`** folder.

> 💡 You do **not** need to zip or package anything to use it — the `extension` folder is ready.

### Step 2 — Load it into your browser

1. Open your browser's extensions page by typing this in the address bar:
   - **Chrome / Brave:** `chrome://extensions`
   - **Edge (default on Windows):** `edge://extensions`
2. Turn on **Developer mode**:
   - **Chrome:** toggle in the **top-right** corner.
   - **Edge:** toggle in the **left sidebar**.
3. Click **Load unpacked**.
4. Navigate into the `SENTINEL` folder you downloaded and select the **`extension`** folder, then confirm.
5. SENTINEL now appears in your toolbar. Click the **puzzle-piece icon → pin 📌** so its icon stays visible.

### Step 3 — Try it on a real AI site

1. Open **[ChatGPT](https://chatgpt.com)**, **[Claude](https://claude.ai)**, or **[Gemini](https://gemini.google.com)**.
2. Type a prompt with something sensitive in it — for a safe test, paste this fake key:
   `AKIAIOSFODNN7EXAMPLE`
3. Press **Enter**. *Before* the message is sent, SENTINEL's modal slides in and gives you three choices:
   | Button | What it does |
   |--------|--------------|
   | **Redact & Send** | replaces the secret with `[PLACEHOLDER]` and sends the cleaned prompt |
   | **Send Anyway** | sends your original text as-is (the decision is logged locally) |
   | **Cancel** | stops the send and leaves your text in the box to edit |
4. Click the SENTINEL toolbar icon for today's stats, or **Open Full Dashboard** for trends and history.

✅ **That's it — you're protected.**

---

## (Optional) Make a shareable .zip

You only need this if you want to **hand the built extension to someone else**. To *use* it
yourself, Step 1–2 above is enough.

- 🍎 **macOS / Linux:**
  ```bash
  npm run package:ext
  ```
  Creates `sentinel-extension.zip`.

- 🪟 **Windows (PowerShell):** the command above uses a Mac/Linux tool, so run this instead from
  inside the `SENTINEL` folder:
  ```powershell
  Compress-Archive -Path extension\* -DestinationPath sentinel-extension.zip
  ```

Whoever receives the zip unzips it and follows **Step 2 — Load it into your browser** (pointing
at the unzipped folder instead of `extension`).

---

## Privacy

- SENTINEL only asks for permission to use `storage` and the three LLM sites (ChatGPT, Claude, Gemini).
- It makes **zero network requests while scanning** — you can verify this yourself in
  **DevTools → Network** on any AI page.
- It never stores your prompt text or the detected secrets — only anonymized counts, locally.

---

## Troubleshooting

- **Nothing happened when I sent a prompt?** The AI site may have changed its layout. Interception
  relies on CSS selectors in `extension/content/adapter-registry.js`; they have fallbacks, but a
  big redesign can need a one-line update there.
- **"Load unpacked" is greyed out?** You forgot to turn on **Developer mode** (Step 2.2).
- **I edited the code — how do I refresh it?** Go back to `chrome://extensions` /
  `edge://extensions` and click the **reload ↻** icon on the SENTINEL card.
- **The dashboard is empty?** That's normal at first — it fills up as you use AI tools. Sample
  data only shows when you open the dashboard *outside* the extension.
- **`npm run build` failed?** Make sure `node -v` shows **18 or higher**, then run `npm install`
  again before retrying.
