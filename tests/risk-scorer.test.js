import { describe, it, expect } from 'vitest';
import { MaxHeap, scoreThreats, riskLevel, RISK } from '../src/engine/risk-scorer.js';

describe('MaxHeap', () => {
  it('pops items in descending score order', () => {
    const h = new MaxHeap();
    [5, 1, 9, 3, 7, 2].forEach((s) => h.push({ score: s }));
    expect(h.drain().map((x) => x.score)).toEqual([9, 7, 5, 3, 2, 1]);
  });

  it('peek returns the max without removing it', () => {
    const h = new MaxHeap();
    h.push({ score: 10 }).push({ score: 20 });
    expect(h.peek().score).toBe(20);
    expect(h.size).toBe(2);
  });

  it('handles empty pop', () => {
    expect(new MaxHeap().pop()).toBeUndefined();
  });
});

describe('riskLevel bands', () => {
  it('maps scores to bands', () => {
    expect(riskLevel(0)).toBe(RISK.SAFE);
    expect(riskLevel(30)).toBe(RISK.SAFE);
    expect(riskLevel(31)).toBe(RISK.CAUTION);
    expect(riskLevel(60)).toBe(RISK.CAUTION);
    expect(riskLevel(61)).toBe(RISK.HIGH);
    expect(riskLevel(100)).toBe(RISK.HIGH);
  });
});

describe('scoreThreats', () => {
  it('returns SAFE for no threats', () => {
    const r = scoreThreats([]);
    expect(r).toMatchObject({ score: 0, level: RISK.SAFE, threatCount: 0 });
  });

  it('uses the highest single score as the base', () => {
    const r = scoreThreats([{ score: 25, label: 'email' }]);
    expect(r.score).toBe(25);
    expect(r.level).toBe(RISK.SAFE);
  });

  it('adds +5 per additional threat and surfaces highest first', () => {
    const r = scoreThreats([
      { score: 25, label: 'email' },
      { score: 90, label: 'aws' },
      { score: 20, label: 'phone' },
    ]);
    // base 90 + 5*2 = 100
    expect(r.score).toBe(100);
    expect(r.threats[0].label).toBe('aws');
    expect(r.level).toBe(RISK.HIGH);
  });

  it('caps composite score at 100', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ score: 90, label: `t${i}` }));
    expect(scoreThreats(many).score).toBe(100);
  });
});
