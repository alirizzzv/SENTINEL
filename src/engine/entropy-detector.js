/**
 * Entropy-based secret detection — catches secrets WITHOUT a known prefix.
 *
 * Prefix patterns (AKIA…, sk-…, ghp_…) are precise but blind to the long tail:
 * a renamed variable, an internal token, a custom credential. Those all share one
 * property a regex can't capture — they look RANDOM. Shannon entropy measures
 * exactly that (bits of information per character).
 *
 *   "hello123"            -> ~2.9 bits/char  (predictable)
 *   "wJz8KmN2pQ5vR9xT3jL" -> ~3.9 bits/char  (machine-generated → likely a secret)
 *
 * Entropy alone over-fires (UUIDs, hashes, base64 images score high too), so we
 * gate it with CONTEXT — a token is only flagged when it is the value of an
 * assignment (`db_pass = <random>`) or sits next to a credential keyword
 * (`token: <random>`). Context is what turns a noisy signal into a usable one.
 */

const TRIGGER = '(?:secret|token|key|pass(?:word|wd)?|pwd|cred(?:ential)?s?|auth|api[_-]?key|access)';

// Value characters that appear in real secrets (base64/base62/url-safe alphabets).
const VALUE = "[A-Za-z0-9+/=_-]";

/** Shannon entropy in bits per character. */
export function shannonEntropy(str) {
  if (!str) return 0;
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  const n = str.length;
  for (const c of freq.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

const MIN_LEN = 20;            // shorter than this is rarely a real secret
const MAX_LEN = 200;           // longer real secrets are already caught by patterns;
                               // bounding the quantifier also prevents ReDoS backtracking
const ASSIGN_ENTROPY = 4.0;    // value of an assignment must be at least this random
const NEARBY_ENTROPY = 4.2;    // a bare token near a keyword needs a touch more

/**
 * Find high-entropy secret-like spans the prefix patterns would miss.
 * @param {string} text
 * @returns {{start:number, end:number, value:string, entropy:number}[]}
 */
export function detectHighEntropy(text) {
  if (typeof text !== 'string' || text.length < MIN_LEN) return [];
  const out = [];
  const seen = new Set(); // dedupe by start offset

  const add = (value, start, entropy) => {
    if (seen.has(start)) return;
    seen.add(start);
    out.push({ start, end: start + value.length, value, entropy });
  };

  // (a) Assignment context: name = value / name: value  → the value is the secret.
  // The identifier is length-bounded so a long separator-free run can't trigger
  // O(n²) backtracking (ReDoS-safe).
  const assign = new RegExp(`[A-Za-z_][A-Za-z0-9_-]{0,64}\\s*[:=]\\s*['"]?(${VALUE}{${MIN_LEN},${MAX_LEN}})`, 'g');
  for (let m; (m = assign.exec(text)); ) {
    const value = m[1];
    const start = m.index + m[0].indexOf(value);
    const h = shannonEntropy(value);
    if (h >= ASSIGN_ENTROPY) add(value, start, h);
  }

  // (b) Proximity context: a credential keyword followed (within ~24 chars) by a
  //     bare high-entropy token, e.g. "the access token is <random>".
  const nearby = new RegExp(`\\b${TRIGGER}\\b[\\s\\S]{0,24}?\\b(${VALUE}{${MIN_LEN},${MAX_LEN}})`, 'gi');
  for (let m; (m = nearby.exec(text)); ) {
    const value = m[1];
    const start = m.index + m[0].lastIndexOf(value);
    const h = shannonEntropy(value);
    if (h >= NEARBY_ENTROPY) add(value, start, h);
  }

  return out;
}
