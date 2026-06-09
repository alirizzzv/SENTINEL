import { describe, it, expect } from 'vitest';
import { Trie } from '../src/engine/trie.js';

describe('Trie', () => {
  it('inserts and finds exact words', () => {
    const t = new Trie();
    t.insert('apple').insert('app').insert('application');
    expect(t.has('apple')).toBe(true);
    expect(t.has('app')).toBe(true);
    expect(t.has('appl')).toBe(false); // prefix but not a word
    expect(t.has('banana')).toBe(false);
  });

  it('tracks prefixes independently of word membership', () => {
    const t = new Trie();
    t.insert('secret');
    expect(t.startsWith('sec')).toBe(true);
    expect(t.startsWith('secret')).toBe(true);
    expect(t.startsWith('secrets')).toBe(false);
    expect(t.has('sec')).toBe(false);
  });

  it('counts distinct words and ignores duplicates', () => {
    const t = new Trie();
    t.insert('a').insert('a').insert('ab');
    expect(t.size).toBe(2);
  });

  it('attaches and retrieves metadata on terminal nodes', () => {
    const t = new Trie();
    t.insert('AKIA', { category: 'CLOUD_API_KEY' });
    expect(t.getMeta('AKIA')).toEqual({ category: 'CLOUD_API_KEY' });
    expect(t.getMeta('AKI')).toBeNull();
  });

  it('rejects empty inserts', () => {
    const t = new Trie();
    expect(() => t.insert('')).toThrow();
  });
});
