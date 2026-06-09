import { describe, it, expect } from 'vitest';
import { AhoCorasick } from '../src/engine/aho-corasick.js';

describe('AhoCorasick', () => {
  it('finds a single pattern with correct span', () => {
    const ac = new AhoCorasick(['sk-']);
    const m = ac.search('my key is sk-abc');
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ start: 10, end: 13, pattern: 'sk-' });
    expect('my key is sk-abc'.slice(m[0].start, m[0].end)).toBe('sk-');
  });

  it('finds multiple distinct patterns in one pass', () => {
    const ac = new AhoCorasick(['akia', 'ghp_', 'password']);
    const text = 'akia... then ghp_ and a password';
    const found = ac.search(text).map((m) => m.pattern).sort();
    expect(found).toEqual(['akia', 'ghp_', 'password']);
  });

  it('handles overlapping and nested patterns (he/she/his/hers)', () => {
    // The textbook Aho-Corasick example.
    const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);
    const found = ac.search('ahishers');
    const patterns = found.map((m) => m.pattern);
    expect(patterns).toContain('his');
    expect(patterns).toContain('he');
    expect(patterns).toContain('hers');
    expect(patterns).toContain('she');
  });

  it('uses failure links instead of restarting on mismatch', () => {
    // "xsk-" should still match "sk-" thanks to the failure link from x.
    const ac = new AhoCorasick(['sk-']);
    const m = ac.search('xsk-abc');
    expect(m).toHaveLength(1);
    expect(m[0].start).toBe(1);
  });

  it('counts every occurrence including repeats', () => {
    const ac = new AhoCorasick(['ab']);
    expect(ac.search('ababab')).toHaveLength(3);
  });

  it('carries metadata through to matches', () => {
    const ac = new AhoCorasick([{ pattern: 'akia', category: 'CLOUD_API_KEY' }]);
    const m = ac.search('akia');
    expect(m[0].meta).toMatchObject({ category: 'CLOUD_API_KEY' });
  });

  it('test() short-circuits truthfully', () => {
    const ac = new AhoCorasick(['secret']);
    expect(ac.test('there is a secret here')).toBe(true);
    expect(ac.test('nothing here')).toBe(false);
  });

  it('returns nothing for empty / no-match input', () => {
    const ac = new AhoCorasick(['xyz']);
    expect(ac.search('')).toEqual([]);
    expect(ac.search('abc')).toEqual([]);
  });

  it('supports adding patterns after construction (rebuild)', () => {
    const ac = new AhoCorasick(['aaa']);
    ac.add('aab').build();
    expect(ac.test('xaab')).toBe(true);
  });
});
