/**
 * Decode-and-rescan — catches secrets hidden inside an encoding layer.
 *
 * A key that would be caught in the clear can slip past by being base64-encoded
 * first: `QUtJQUlPU0ZPRE5ON0VYQU1QTEU=` is just `AKIAIOSFODNN7EXAMPLE`. So when we
 * see a base64-looking blob, we decode it ONE level and re-run the high-value
 * secret patterns on the result. A hit means the *original blob* is flagged
 * (depth-limited to 1, so a crafted nesting can't make us loop).
 */

import { PATTERNS } from './pattern-dictionary.js';

// Only the genuinely dangerous patterns are worth the decode round-trip — we
// don't want to flag a base64 blob just because it decodes to text with an email.
const HIGH_VALUE = PATTERNS.filter((p) => p.score >= 70 && !p.alwaysScan);

/** Cross-runtime base64 → string (browser `atob`, Node `Buffer`). */
function fromBase64(b64) {
  try {
    if (typeof atob === 'function') return atob(b64);
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('binary');
  } catch { /* malformed base64 */ }
  return '';
}

/** Does the decoded text contain a high-value secret? */
function containsSecret(decoded) {
  if (!decoded) return false;
  for (const p of HIGH_VALUE) {
    p.regex.lastIndex = 0;
    const m = p.regex.exec(decoded);
    if (m && (!p.validate || p.validate(m[0]))) return true;
  }
  return false;
}

/**
 * @param {string} text
 * @returns {{start:number, end:number, value:string}[]} spans of encoded secrets
 */
export function decodeAndScan(text) {
  if (typeof text !== 'string' || text.length < 24) return [];
  const out = [];

  // base64 blobs: standard alphabet, length a multiple of 4, long enough to hide a
  // key but bounded (a base64'd secret is short; bounding also keeps this linear).
  const re = /\b[A-Za-z0-9+/]{20,512}={0,2}/g;
  for (let m; (m = re.exec(text)); ) {
    const blob = m[0];
    if (blob.length % 4 !== 0) continue;            // valid base64 is 4-char aligned
    const decoded = fromBase64(blob);
    // decoded should be mostly printable (real secrets are ASCII), else it's binary noise.
    if (!decoded || !/^[\x20-\x7e\s]+$/.test(decoded)) continue;
    if (containsSecret(decoded)) {
      out.push({ start: m.index, end: m.index + blob.length, value: blob });
    }
  }
  return out;
}
