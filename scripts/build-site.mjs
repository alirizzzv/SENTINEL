/**
 * Assembles the public GitHub Pages site into ./public:
 *   /            landing page
 *   /demo/       the offline interactive demo (real engine in-page)
 *   /dashboard/  the React analytics dashboard (mock data outside the extension)
 *
 * Run `npm run build` first so the engine bundle and dashboard are built.
 *   node scripts/build-site.mjs
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Demo (references ../extension/content/* — copy that too so paths resolve).
cpSync(resolve(root, 'demo'), resolve(out, 'demo'), { recursive: true });
mkdirSync(resolve(out, 'extension/content'), { recursive: true });
cpSync(resolve(root, 'extension/content'), resolve(out, 'extension/content'), { recursive: true });

// Built dashboard (Vite base './' => relative assets, works under /dashboard/).
cpSync(resolve(root, 'extension/dashboard'), resolve(out, 'dashboard'), { recursive: true });

writeFileSync(resolve(out, '.nojekyll'), '');

const landing = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SENTINEL — AI Prompt Security Gateway</title>
<style>
  :root{--bg:#f3f0e9;--text:#1b2038;--muted:#6b7286;--primary:#6d5efc;--border:rgba(28,26,52,.1)}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Inter',system-ui,sans-serif;color:var(--text);
    background:radial-gradient(1100px 600px at 82% -12%,#ffe3cf,transparent 55%),
      radial-gradient(900px 520px at 8% -6%,#e3dcff,transparent 55%),var(--bg);min-height:100vh}
  .wrap{max-width:960px;margin:0 auto;padding:72px 24px 80px}
  .badge{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--primary);
    background:rgba(124,108,255,.12);border:1px solid rgba(124,108,255,.3);border-radius:999px;padding:5px 12px;margin-bottom:20px}
  h1{font-size:clamp(34px,6vw,56px);line-height:1.05;margin:0 0 14px;letter-spacing:-.03em;font-weight:800;
    background:linear-gradient(120deg,#1b2038,#6d5efc 65%,#b15cff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .sub{font-size:18px;color:var(--muted);max-width:620px;line-height:1.55;margin:0 0 36px}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:680px){.cards{grid-template-columns:1fr}}
  .card{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid var(--border);
    border-radius:20px;padding:26px;box-shadow:0 22px 44px -24px rgba(70,60,130,.4);transition:transform .2s,box-shadow .2s}
  .card:hover{transform:translateY(-4px);box-shadow:0 30px 60px -28px rgba(124,108,255,.55);border-color:rgba(124,108,255,.4)}
  .card .ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;font-size:22px;color:#fff;margin-bottom:16px;
    background:linear-gradient(135deg,#7c6cff,#b07cff);box-shadow:0 12px 24px -10px rgba(80,60,160,.55)}
  .card h3{margin:0 0 6px;font-size:19px}
  .card p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
  .feat{display:flex;gap:18px;flex-wrap:wrap;margin:38px 0 0;color:var(--muted);font-size:14px}
  .feat span{display:flex;align-items:center;gap:7px}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--primary)}
  .gh{margin-top:34px}
  .gh a{color:var(--primary);font-weight:600;text-decoration:none}
</style>
</head>
<body>
  <div class="wrap">
    <span class="badge">🛡 Your AI. Your Data. Your Rules.</span>
    <h1>SENTINEL — AI Prompt Security Gateway</h1>
    <p class="sub">A browser-native security layer that detects and redacts sensitive data and
      prompt-injection attacks <strong>before</strong> they reach ChatGPT, Claude, or Gemini —
      in under 5&nbsp;ms, with nothing stored but anonymized metadata.</p>
    <div class="cards">
      <a class="card" href="./demo/">
        <div class="ic">▶</div>
        <h3>Try the live demo</h3>
        <p>A simulated chat box running the real detection engine in your browser. Paste a secret, watch it get intercepted.</p>
      </a>
      <a class="card" href="./dashboard/">
        <div class="ic">📊</div>
        <h3>Open the dashboard</h3>
        <p>The analytics dashboard — risk trends, threat breakdown, and scan history (sample data outside the extension).</p>
      </a>
    </div>
    <div class="feat">
      <span><i class="dot"></i> Trie + Aho-Corasick detection</span>
      <span><i class="dot"></i> Local-first · private by default</span>
      <span><i class="dot"></i> ChatGPT · Claude · Gemini</span>
    </div>
    <p class="gh">→ <a href="https://github.com/alirizzzv/SENTINEL">View the source on GitHub</a></p>
  </div>
</body>
</html>`;

writeFileSync(resolve(out, 'index.html'), landing);
console.log('assembled public/ (landing + demo + dashboard)');
