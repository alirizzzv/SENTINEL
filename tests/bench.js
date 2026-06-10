/**
 * Performance benchmark for the detection engine.
 *   node tests/bench.js
 * Reports p50/p95/p99 latency and throughput across realistic prompt sizes.
 */
import { scan } from '../src/engine/index.js';

const SAMPLES = {
  'short safe (40 ch)': 'What is the capital of France today?',
  'short threat (60 ch)': 'deploy with AKIAIOSFODNN7EXAMPLE and email a@b.com',
  'medium mixed (~1 KB)':
    'Refactor this service. '.repeat(30) +
    ' config postgres://admin:hunter2@db:5432/prod key sk-abcdefghijklmnopqrstuvwxyz0123456789 mail dev@corp.com',
  'large doc (~10 KB)':
    'This is a normal paragraph about distributed systems and caching. '.repeat(150) +
    ' AKIAIOSFODNN7EXAMPLE',
  'adversarial near-miss (~80 KB)': 'AKIA'.repeat(20_000),
};

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function bench(label, text, iters = 2000) {
  // warm up
  for (let i = 0; i < 200; i++) scan(text);
  const times = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    scan(text);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((s, t) => s + t, 0) / times.length;
  return {
    label,
    bytes: text.length,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    mean,
    opsPerSec: Math.round(1000 / mean),
  };
}

console.log('\nSENTINEL detection-engine benchmark');
console.log('node', process.version, '\n');
console.log(
  'sample'.padEnd(30),
  'bytes'.padStart(7),
  'p50(ms)'.padStart(9),
  'p95(ms)'.padStart(9),
  'p99(ms)'.padStart(9),
  'ops/sec'.padStart(9),
);
console.log('-'.repeat(76));
for (const [label, text] of Object.entries(SAMPLES)) {
  const r = bench(label, text);
  console.log(
    r.label.padEnd(30),
    String(r.bytes).padStart(7),
    r.p50.toFixed(3).padStart(9),
    r.p95.toFixed(3).padStart(9),
    r.p99.toFixed(3).padStart(9),
    String(r.opsPerSec).padStart(9),
  );
}
console.log('');
