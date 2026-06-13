/**
 * Text normalization — defeats common obfuscation BEFORE matching.
 *
 * Attackers hide trigger words from a naive scanner with tricks a human still
 * reads fine: zero-width characters, homoglyphs, leetspeak ("1gn0re"), and
 * separators ("i g n o r e"). We build a *canonical* copy of the text and run
 * the injection heuristics against it, so the detector sees through the disguise.
 *
 * IMPORTANT: normalization changes character offsets, so it is used ONLY by the
 * injection detector (which flags the whole prompt, not precise spans). Secret
 * redaction still runs on the original text so placeholder offsets stay exact.
 */

/** Leetspeak → letter. Conservative: only unambiguous, common substitutions. */
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/**
 * Produce a lowercased, de-obfuscated copy of `text` for pattern/heuristic matching.
 * @param {string} text
 * @returns {string}
 */
export function normalizeForMatching(text) {
  if (typeof text !== 'string' || text.length === 0) return '';

  let s = text;

  // 1. Unicode canonical form — folds homoglyphs / full-width chars to ASCII-ish.
  try { s = s.normalize('NFKC'); } catch { /* older runtimes: skip */ }

  // 2. Strip zero-width and bidi control characters used to break up words.
  s = s.replace(/[​-‏‪-‮⁠﻿]/g, '');

  s = s.toLowerCase();

  // 3. De-leetspeak.
  s = s.replace(/[013457@$]/g, (c) => LEET[c] ?? c);

  // 4. Collapse separators inserted *between single characters* ("i.g.n.o.r.e",
  //    "i g n o r e", "a-k-i-a"). We only join runs of single-char-then-separator
  //    so we don't mangle normal spacing between words.
  s = s.replace(/\b(?:[a-z0-9][\s._-]){2,}[a-z0-9]\b/g, (m) => m.replace(/[\s._-]/g, ''));

  return s;
}
