/**
 * Risk scoring + threat prioritization.
 *
 * Detected threats are pushed into a binary MAX-HEAP keyed by severity, then
 * popped in descending order so the interceptor modal can show the scariest
 * thing first. A heap (rather than Array.sort) is the right structure here:
 *   push -> O(log k),  pop -> O(log k),  drain k threats -> O(k log k).
 * In practice k is tiny (rarely >5), but the data-structure choice is deliberate.
 *
 * Composite score:
 *   base   = highest single threat score
 *   bonus  = 5 × (number of additional distinct threats)
 *   final  = min(100, base + bonus)
 *
 * Bands:  0–30 SAFE · 31–60 CAUTION · 61–100 HIGH
 */

/** Generic binary max-heap. Compares by the `score` field of pushed items. */
export class MaxHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].score >= a[i].score) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
    return this;
  }

  pop() {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _siftDown(i) {
    const a = this.items;
    const n = a.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let largest = i;
      if (l < n && a[l].score > a[largest].score) largest = l;
      if (r < n && a[r].score > a[largest].score) largest = r;
      if (largest === i) break;
      [a[largest], a[i]] = [a[i], a[largest]];
      i = largest;
    }
  }

  /** Pop every item, returning them in descending-score order. Drains the heap. */
  drain() {
    const out = [];
    while (this.size) out.push(this.pop());
    return out;
  }
}

export const RISK = {
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  HIGH: 'HIGH',
};

/** Map a 0–100 score to a risk band. */
export function riskLevel(score) {
  if (score <= 30) return RISK.SAFE;
  if (score <= 60) return RISK.CAUTION;
  return RISK.HIGH;
}

/**
 * Score a list of detected threats.
 * @param {{id:string, category:string, label:string, score:number, count?:number}[]} threats
 * @returns {{score:number, level:string, threats:object[], threatCount:number}}
 */
export function scoreThreats(threats) {
  if (!threats || threats.length === 0) {
    return { score: 0, level: RISK.SAFE, threats: [], threatCount: 0 };
  }

  const heap = new MaxHeap();
  for (const t of threats) heap.push(t);
  const ordered = heap.drain(); // highest severity first

  const base = ordered[0].score;
  const bonus = 5 * (ordered.length - 1);
  const score = Math.min(100, base + bonus);

  return {
    score,
    level: riskLevel(score),
    threats: ordered,
    threatCount: ordered.length,
  };
}
