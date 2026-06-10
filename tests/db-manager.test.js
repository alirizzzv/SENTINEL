/**
 * Validates the extension's real persistence layer (IndexedDB) headlessly using
 * fake-indexeddb — the exact code path the popup and dashboard read in Chrome.
 * Covers the 500-event circular buffer and the derived stats.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addEvent, getAllEvents, clearEvents, getStats, MAX_EVENTS } from '../extension/background/db-manager.js';

const DAY = 86_400_000;

function ev(overrides = {}) {
  return {
    timestamp: Date.now(),
    llm: 'ChatGPT',
    riskLevel: 'SAFE',
    riskScore: 0,
    threatCategories: [],
    threatCount: 0,
    userDecision: 'ALLOWED',
    processingTimeMs: 1.0,
    patternMatchCount: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  await clearEvents();
});

describe('db-manager persistence', () => {
  it('stores a metadata-only event and reads it back', async () => {
    await addEvent(ev({ llm: 'Claude', riskLevel: 'HIGH', riskScore: 90, threatCategories: ['CLOUD_API_KEY'], threatCount: 1, userDecision: 'REDACTED' }));
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ llm: 'Claude', riskLevel: 'HIGH', threatCount: 1 });
    // never stores content/values
    expect(all[0]).not.toHaveProperty('text');
    expect(all[0]).not.toHaveProperty('redactedText');
  });

  it('enforces the 500-event circular buffer (FIFO eviction)', async () => {
    const base = Date.now() - 600 * 1000;
    for (let i = 0; i < MAX_EVENTS + 5; i++) {
      await addEvent(ev({ timestamp: base + i * 1000, riskScore: i }));
    }
    const all = await getAllEvents();
    expect(all).toHaveLength(MAX_EVENTS);
    // the 5 oldest (lowest timestamps) must have been evicted
    const minTs = Math.min(...all.map((e) => e.timestamp));
    expect(minTs).toBe(base + 5 * 1000);
  });

  it('computes stats: threats caught, today, and clean streak', async () => {
    const now = Date.now();
    // order of insertion = chronological; most-recent last
    await addEvent(ev({ timestamp: now - 2 * DAY, riskLevel: 'HIGH', riskScore: 90, threatCount: 1, threatCategories: ['AWS_KEY'] }));
    await addEvent(ev({ timestamp: now - 1000, riskLevel: 'SAFE' }));        // today, clean
    await addEvent(ev({ timestamp: now - 500, riskLevel: 'SAFE' }));         // today, clean (most recent)

    const stats = await getStats();
    expect(stats.storedEvents).toBe(3);
    expect(stats.threatsCaught).toBe(1);
    expect(stats.todayScans).toBe(2);
    expect(stats.cleanStreak).toBe(2); // trailing run of zero-threat events
    expect(stats.lastThreat).not.toBeNull();
    expect(stats.lastThreat.categories).toContain('AWS_KEY');
  });

  it('clears history', async () => {
    await addEvent(ev());
    await clearEvents();
    expect(await getAllEvents()).toHaveLength(0);
  });
});
