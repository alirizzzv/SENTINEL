/**
 * Background service worker (MV3, module).
 *
 * Stateless message router over the local IndexedDB store. It never sees prompt
 * content — content scripts send only the metadata they already computed.
 *
 * Messages:
 *   SENTINEL_EVENT  {payload}  -> persist a scan event
 *   SENTINEL_STATS             -> aggregate stats for popup/dashboard
 *   SENTINEL_EVENTS            -> all stored events (dashboard history)
 *   SENTINEL_CLEAR             -> wipe local history
 */

import { addEvent, getStats, getAllEvents, clearEvents } from './db-manager.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  switch (msg.type) {
    case 'SENTINEL_EVENT':
      addEvent(msg.payload)
        .then((event) => sendResponse({ ok: true, event }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // async response

    case 'SENTINEL_STATS':
      getStats()
        .then((stats) => sendResponse({ ok: true, stats }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;

    case 'SENTINEL_EVENTS':
      getAllEvents()
        .then((events) => sendResponse({ ok: true, events }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;

    case 'SENTINEL_CLEAR':
      clearEvents()
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;

    default:
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.info('[SENTINEL] installed — local-first, private by default.');
});
