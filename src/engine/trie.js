/**
 * Trie (prefix tree).
 *
 * This is the foundational data structure SENTINEL's detection engine is built on.
 * Aho-Corasick (see aho-corasick.js) extends a trie with failure links to do
 * multi-pattern matching in a single pass; this file keeps a clean, standalone trie
 * so the base structure is independently testable and easy to reason about.
 *
 * Complexity:
 *   insert(word)  -> O(m)      where m = word length
 *   has(word)     -> O(m)
 *   startsWith(p) -> O(p)
 *
 * Memory: O(total characters across all inserted words).
 */

export class TrieNode {
  constructor() {
    /** @type {Map<string, TrieNode>} child character -> node */
    this.children = new Map();
    /** True when a word ends at this node. */
    this.isEnd = false;
    /** Arbitrary metadata attached to the terminal node (e.g. pattern info). */
    this.meta = null;
  }
}

export class Trie {
  constructor() {
    this.root = new TrieNode();
    this.size = 0;
  }

  /**
   * Insert a word, optionally attaching metadata to its terminal node.
   * Returns the trie for chaining.
   */
  insert(word, meta = null) {
    if (typeof word !== 'string' || word.length === 0) {
      throw new Error('Trie.insert requires a non-empty string');
    }
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.isEnd) this.size += 1;
    node.isEnd = true;
    node.meta = meta;
    return this;
  }

  /** Walk the trie for `prefix`, returning the node it ends at or null. */
  _walk(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  /** Exact word membership. */
  has(word) {
    const node = this._walk(word);
    return !!node && node.isEnd;
  }

  /** True if any inserted word starts with `prefix`. */
  startsWith(prefix) {
    return this._walk(prefix) !== null;
  }

  /** Retrieve the metadata attached to an exact word, or null. */
  getMeta(word) {
    const node = this._walk(word);
    return node && node.isEnd ? node.meta : null;
  }
}
