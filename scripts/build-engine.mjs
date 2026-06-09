/**
 * Bundles the framework-free detection engine (src/engine/index.js) into a single
 * classic script that exposes a global `SENTINEL` object. The Chrome content script
 * loads this directly, so prompt scanning runs SYNCHRONOUSLY in-page — no async
 * message round-trip on the interception hot path.
 *
 * Single source of truth: the same src/engine code is unit-tested by Vitest (ESM)
 * and shipped to the extension (IIFE) and the demo harness.
 *
 *   node scripts/build-engine.mjs
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  resolve(root, 'extension/vendor/engine.global.js'),
  resolve(root, 'demo/engine.global.js'),
];

for (const outfile of targets) {
  await build({
    entryPoints: [resolve(root, 'src/engine/index.js')],
    bundle: true,
    format: 'iife',
    globalName: 'SENTINEL',
    target: ['chrome110'],
    outfile,
    banner: { js: '/* SENTINEL detection engine — generated from src/engine. Do not edit. */' },
  });
  console.log('built', outfile.replace(root + '/', ''));
}
