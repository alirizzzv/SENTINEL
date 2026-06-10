/**
 * Dashboard data layer.
 *
 * In the extension, events come from the background worker (IndexedDB) over
 * message passing. When the dashboard is opened standalone (e.g. `vite` dev or a
 * static preview), there is no extension context, so we synthesize a realistic
 * sample dataset — the same shape — so charts and tables are demoable anywhere.
 *
 * Derived stats are computed here from the raw events so the dashboard is
 * self-contained and doesn't depend on the worker for aggregation.
 */

export const CATEGORY_META = {
  PROMPT_INJECTION: { label: 'Prompt Injection', color: '#c84fff' },
  CLOUD_API_KEY: { label: 'Cloud / API Key', color: '#f74f4f' },
  PRIVATE_KEY: { label: 'Private Key', color: '#ff7a7a' },
  DB_CREDENTIALS: { label: 'DB Credentials', color: '#f7884f' },
  SERVICE_TOKEN: { label: 'Service Token', color: '#f5a623' },
  CREDIT_CARD: { label: 'Credit Card', color: '#ffce5c' },
  GOV_ID: { label: 'Government ID', color: '#9ad14f' },
  PERSONAL_CONTACT: { label: 'Personal Contact', color: '#4f8ef7' },
};

export const isExtension =
  typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp) => resolve(resp));
  });
}

// ── mock dataset for standalone preview ────────────────────────────────────
const LLMS = ['ChatGPT', 'Claude', 'Gemini'];
const CATS = Object.keys(CATEGORY_META);
const DECISIONS = ['REDACTED', 'SENT_ANYWAY', 'CANCELLED', 'ALLOWED'];

function seedEvents(n = 140) {
  const events = [];
  const now = Date.now();
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < n; i++) {
    const daysAgo = Math.floor(rnd() * 30);
    const ts = now - daysAgo * 86400000 - Math.floor(rnd() * 86400000);
    const hasThreat = rnd() > 0.42;
    let categories = [];
    let score = Math.floor(rnd() * 25); // safe baseline
    if (hasThreat) {
      const k = 1 + Math.floor(rnd() * 3);
      categories = [...new Set(Array.from({ length: k }, () => CATS[Math.floor(rnd() * CATS.length)]))];
      const base = [90, 85, 80, 75, 70, 60, 25, 95][Math.floor(rnd() * 8)];
      score = Math.min(100, base + 5 * (categories.length - 1));
    }
    const level = score <= 30 ? 'SAFE' : score <= 60 ? 'CAUTION' : 'HIGH';
    events.push({
      id: `mock-${i}`,
      timestamp: ts,
      llm: LLMS[Math.floor(rnd() * LLMS.length)],
      riskLevel: level,
      riskScore: score,
      threatCategories: categories,
      threatCount: categories.length,
      userDecision: hasThreat ? DECISIONS[Math.floor(rnd() * 3)] : 'ALLOWED',
      processingTimeMs: Math.round((0.5 + rnd() * 3) * 10) / 10,
      patternMatchCount: categories.length,
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

let mockCache = null;

export async function getEvents() {
  if (isExtension) {
    const resp = await sendMessage({ type: 'SENTINEL_EVENTS' });
    return (resp && resp.ok && resp.events) || [];
  }
  if (!mockCache) mockCache = seedEvents();
  return mockCache;
}

export async function clearEvents() {
  if (isExtension) {
    await sendMessage({ type: 'SENTINEL_CLEAR' });
  } else {
    mockCache = [];
  }
}

// ── derived analytics ──────────────────────────────────────────────────────
export function computeStats(events) {
  const total = events.length;
  const threats = events.filter((e) => e.threatCount > 0);
  const redacted = events.filter((e) => e.userDecision === 'REDACTED').length;

  const byRecent = [...events].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const e of byRecent) {
    if (e.threatCount === 0) streak += 1;
    else break;
  }

  return {
    total,
    threatsCaught: threats.length,
    redactionRate: threats.length ? Math.round((redacted / threats.length) * 100) : 0,
    cleanStreak: streak,
  };
}

/** Daily average risk score over the last `days` days (oldest -> newest). */
export function riskTrend(events, days = 30) {
  const buckets = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    buckets.set(d.toISOString().slice(5, 10), { sum: 0, n: 0 });
  }
  for (const e of events) {
    const key = new Date(e.timestamp).toISOString().slice(5, 10);
    if (buckets.has(key)) {
      const b = buckets.get(key);
      b.sum += e.riskScore;
      b.n += 1;
    }
  }
  return [...buckets.entries()].map(([label, b]) => ({
    label,
    value: b.n ? Math.round(b.sum / b.n) : 0,
  }));
}

/** Threat counts by category, descending. */
export function threatBreakdown(events) {
  const counts = new Map();
  for (const e of events) {
    for (const c of e.threatCategories || []) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      label: CATEGORY_META[category]?.label || category,
      color: CATEGORY_META[category]?.color || '#8899aa',
    }))
    .sort((a, b) => b.count - a.count);
}
