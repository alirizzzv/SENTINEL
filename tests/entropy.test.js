import { describe, it, expect } from 'vitest';
import { shannonEntropy, detectHighEntropy } from '../src/engine/entropy-detector.js';

describe('shannonEntropy', () => {
  it('scores predictable strings low and random strings high', () => {
    expect(shannonEntropy('aaaaaaaa')).toBeLessThan(1);
    expect(shannonEntropy('password')).toBeLessThan(3.5);
    expect(shannonEntropy('wJz8KmN2pQ5vR9xT3jLb')).toBeGreaterThan(3.7);
  });
});

describe('detectHighEntropy', () => {
  it('catches a renamed/custom secret in an assignment (no known prefix)', () => {
    const hits = detectHighEntropy('db_pass=wJz8KmN2pQ5vR9xT3jLbAc12');
    expect(hits.length).toBe(1);
    expect(hits[0].value).toBe('wJz8KmN2pQ5vR9xT3jLbAc12');
  });

  it('catches a high-entropy token next to a credential keyword', () => {
    const hits = detectHighEntropy('the access token is aB3kX9mZqR2nYpLc7dEfGh');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT fire on UUIDs, git SHAs, or low-entropy values', () => {
    expect(detectHighEntropy('id 550e8400-e29b-41d4-a716-446655440000')).toEqual([]);
    expect(detectHighEntropy('commit 9f8c2a1b3d4e5f60718293a4b5c6d7e8f9012345')).toEqual([]);
    expect(detectHighEntropy('password=hello123hello123hello')).toEqual([]);
  });

  it('is linear on long repetitive input (ReDoS-safe)', () => {
    const t0 = performance.now();
    detectHighEntropy('a'.repeat(200_000));
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
