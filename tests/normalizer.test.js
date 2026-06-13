import { describe, it, expect } from 'vitest';
import { normalizeForMatching } from '../src/engine/normalizer.js';

describe('normalizeForMatching', () => {
  it('lowercases and de-leetspeaks trigger words', () => {
    expect(normalizeForMatching('1gn0re')).toBe('ignore');
    expect(normalizeForMatching('Pl3ase')).toBe('please');
    expect(normalizeForMatching('y0ur')).toBe('your');
  });

  it('collapses single-char separators used to break up words', () => {
    expect(normalizeForMatching('i g n o r e')).toContain('ignore');
    expect(normalizeForMatching('i.g.n.o.r.e')).toContain('ignore');
    expect(normalizeForMatching('a-k-i-a')).toContain('akia');
  });

  it('strips zero-width characters', () => {
    expect(normalizeForMatching('ig​no‌re')).toBe('ignore');
  });

  it('leaves ordinary spacing between real words intact', () => {
    expect(normalizeForMatching('ignore the rules')).toBe('ignore the rules');
  });

  it('is safe on empty / non-string input', () => {
    expect(normalizeForMatching('')).toBe('');
    expect(normalizeForMatching(undefined)).toBe('');
  });
});
