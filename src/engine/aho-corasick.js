/**
 * Aho-Corasick multi-pattern string matcher.
 *
 * Finds every occurrence of any pattern in a text in a SINGLE linear pass,
 * regardless of how many patterns there are. This is the property that lets
 * SENTINEL scan a prompt against 25+ threat patterns in O(n) instead of O(k·n).
 *
 * Construction:
 *   1. Insert all patterns into a goto-trie.            O(sum of pattern lengths)
 *   2. Build failure links with BFS (level order) so a  O(sum of pattern lengths)
 *      node's failure target — the longest proper suffix
 *      of its path that is also a prefix in the trie —
 *      is always computed before its children need it.
 *   3. Merge output links so each node knows every
 *      pattern that ends at it OR at any node reachable
 *      via failure links.
 *
 * Search:
 *   walk the text one char at a time, following goto edges, falling back along
 *   failure links on mismatch (never restarting). At each position emit all
 *   outputs.                                            O(n + z), z = matches
 *
 * Total: O(n + m + z). This is the same algorithm used in antivirus engines,
 * network intrusion detection, and bibliographic search (fgrep).
 */

class ACNode {
  constructor(depth = 0) {
    this.children = new Map(); // char -> ACNode (the "goto" function)
    this.fail = null; // failure link
    this.depth = depth; // length of the path from root (= pattern end index helper)
    this.outputs = []; // indices into the patterns array that end here (after merge)
    this.ownOutputs = []; // pattern indices that literally terminate at this node
  }
}

export class AhoCorasick {
  /**
   * @param {Array<string | {pattern: string, [key: string]: any}>} patterns
   */
  constructor(patterns = []) {
    this.root = new ACNode(0);
    /** @type {{pattern: string, length: number, meta: any}[]} */
    this.patterns = [];
    this._built = false;
    for (const p of patterns) this.add(p);
    this.build();
  }

  /** Register a pattern. Accepts a raw string or an object carrying metadata. */
  add(p) {
    const pattern = typeof p === 'string' ? p : p.pattern;
    if (typeof pattern !== 'string' || pattern.length === 0) {
      throw new Error('AhoCorasick pattern must be a non-empty string');
    }
    const meta = typeof p === 'string' ? null : p;
    const id = this.patterns.length;
    this.patterns.push({ pattern, length: pattern.length, meta });

    let node = this.root;
    for (const ch of pattern) {
      let next = node.children.get(ch);
      if (!next) {
        next = new ACNode(node.depth + 1);
        node.children.set(ch, next);
      }
      node = next;
    }
    node.ownOutputs.push(id);
    this._built = false;
    return this;
  }

  /**
   * Build failure and output links via BFS. Idempotent — safe to call again
   * after adding more patterns.
   */
  build() {
    const queue = [];

    // Depth-1 nodes fail to the root.
    for (const child of this.root.children.values()) {
      child.fail = this.root;
      queue.push(child);
    }

    // BFS over the remaining nodes. Processing in level order guarantees a
    // parent's failure link is finalized before we resolve its children's.
    let head = 0;
    while (head < queue.length) {
      const node = queue[head++];

      for (const [ch, child] of node.children) {
        // Find the failure target for `child`: follow `node`'s failure chain
        // until some ancestor has a child on `ch`, else land on root.
        let f = node.fail;
        while (f !== null && !f.children.has(ch)) {
          f = f.fail;
        }
        child.fail = f === null ? this.root : f.children.get(ch) || this.root;
        if (child.fail === child) child.fail = this.root; // guard (root edge case)

        queue.push(child);
      }

      // Merge outputs: this node reports its own terminal patterns plus every
      // pattern reported by its failure target (which is itself already merged).
      node.outputs = node.fail.outputs.length
        ? node.ownOutputs.concat(node.fail.outputs)
        : node.ownOutputs;
    }

    this.root.outputs = this.root.ownOutputs;
    this._built = true;
    return this;
  }

  /**
   * Scan `text`, returning every match (including overlapping ones).
   * @param {string} text
   * @returns {{start: number, end: number, pattern: string, length: number, meta: any, patternId: number}[]}
   *          `end` is exclusive. Matches are emitted in scan (end-position) order.
   */
  search(text) {
    if (!this._built) this.build();
    const results = [];
    let node = this.root;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      // Follow failure links until we can consume `ch` (or reach root).
      while (node !== this.root && !node.children.has(ch)) {
        node = node.fail;
      }
      node = node.children.get(ch) || this.root;

      // Emit every pattern ending at this position.
      if (node.outputs.length) {
        for (const id of node.outputs) {
          const { pattern, length, meta } = this.patterns[id];
          results.push({
            start: i - length + 1,
            end: i + 1,
            pattern,
            length,
            meta,
            patternId: id,
          });
        }
      }
    }
    return results;
  }

  /** Convenience: does the text contain at least one pattern? Short-circuits. */
  test(text) {
    if (!this._built) this.build();
    let node = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      while (node !== this.root && !node.children.has(ch)) node = node.fail;
      node = node.children.get(ch) || this.root;
      if (node.outputs.length) return true;
    }
    return false;
  }
}
