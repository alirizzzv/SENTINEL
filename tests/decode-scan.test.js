import { describe, it, expect } from 'vitest';
import { decodeAndScan } from '../src/engine/decode-scan.js';

describe('decodeAndScan', () => {
  it('flags a secret hidden inside a base64 blob', () => {
    // base64("AKIAIOSFODNN7EXAMPLE")
    const blob = Buffer.from('AKIAIOSFODNN7EXAMPLE').toString('base64');
    const hits = decodeAndScan(`token: ${blob}`);
    expect(hits.length).toBe(1);
    expect(hits[0].value).toBe(blob);
  });

  it('ignores base64 that does not decode to a high-value secret', () => {
    const blob = Buffer.from('the quick brown fox jumps over').toString('base64');
    expect(decodeAndScan(`note: ${blob}`)).toEqual([]);
  });

  it('ignores non-base64 / binary-looking blobs', () => {
    expect(decodeAndScan('just some normal sentence with words')).toEqual([]);
  });

  it('is linear on long repetitive input (depth-limited, ReDoS-safe)', () => {
    const t0 = performance.now();
    decodeAndScan('QUJD'.repeat(50_000));
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
