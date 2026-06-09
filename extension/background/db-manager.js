/**
 * IndexedDB manager — local, metadata-only event store.
 *
 * The `scans` store is a CIRCULAR BUFFER bounded at MAX_EVENTS: when full, the
 * oldest event is evicted before inserting the newest (FIFO, O(1) amortized).
 * This bounds memory no matter how long the extension runs.
 *
 * We store ONLY anonymized metadata — never prompt content, never detected
 * values. See README's privacy section.
 */

const DB_NAME = 'sentinel';
const DB_VERSION = 1;
export const MAX_EVENTS = 500;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('scans')) {
        const store = db.createObjectStore('scans', { keyPath: 'id' });
        store.createIndex('by_time', 'timestamp');
        store.createIndex('by_risk', 'riskLevel');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}
const done = (request) =>
  new Promise((res, rej) => {
    request.onsuccess = () => res(request.result);
    request.onerror = () => rej(request.error);
  });

const uuid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Insert a metadata-only event, evicting the oldest if at capacity. */
export async function addEvent(payload) {
  const db = await openDB();
  const store = tx(db, 'scans', 'readwrite');

  const count = await done(store.count());
  if (count >= MAX_EVENTS) {
    // Evict oldest by walking the time index ascending.
    const cursorReq = store.index('by_time').openCursor();
    await new Promise((res, rej) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          res();
        } else res();
      };
      cursorReq.onerror = () => rej(cursorReq.error);
    });
  }

  const event = {
    id: uuid(),
    timestamp: Date.now(),
    llm: payload.llm,
    riskLevel: payload.riskLevel,
    riskScore: payload.riskScore,
    threatCategories: payload.threatCategories || [],
    threatCount: payload.threatCount || 0,
    userDecision: payload.userDecision,
    processingTimeMs: payload.processingTimeMs,
    patternMatchCount: payload.patternMatchCount || 0,
  };
  await done(store.add(event));
  await bumpTotal();
  return event;
}

export async function getAllEvents() {
  const db = await openDB();
  return done(tx(db, 'scans', 'readonly').getAll());
}

export async function clearEvents() {
  const db = await openDB();
  await done(tx(db, 'scans', 'readwrite').clear());
}

async function bumpTotal() {
  const db = await openDB();
  const store = tx(db, 'settings', 'readwrite');
  const cur = (await done(store.get('counters'))) || { id: 'counters', totalScans: 0 };
  cur.totalScans += 1;
  await done(store.put(cur));
}

/** Quick aggregate stats for the popup / dashboard. */
export async function getStats() {
  const events = await getAllEvents();
  const db = await openDB();
  const counters = (await done(tx(db, 'settings', 'readonly').get('counters'))) || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.getTime();

  const todays = events.filter((e) => e.timestamp >= since);
  const threatsCaught = events.filter((e) => e.threatCount > 0).length;

  // Clean streak = trailing run of zero-threat events (most recent first).
  const byRecent = [...events].sort((a, b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const e of byRecent) {
    if (e.threatCount === 0) streak += 1;
    else break;
  }

  const lastThreat = byRecent.find((e) => e.threatCount > 0) || null;

  return {
    totalScans: counters.totalScans || events.length,
    storedEvents: events.length,
    todayScans: todays.length,
    todayThreats: todays.filter((e) => e.threatCount > 0).length,
    threatsCaught,
    cleanStreak: streak,
    lastThreat: lastThreat
      ? { when: lastThreat.timestamp, categories: lastThreat.threatCategories }
      : null,
  };
}
