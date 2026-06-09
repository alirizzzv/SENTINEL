/**
 * Redaction: replace detected sensitive spans with labelled placeholders.
 *
 *   "my key is AKIA...EXAMPLE and email john@x.com"
 *     -> "my key is [AWS_ACCESS_KEY] and email [EMAIL]"
 *
 * Two detections can overlap (e.g. a Bearer token whose value is itself a JWT).
 * Redacting each independently would corrupt the string, so we first MERGE
 * overlapping spans — the classic "merge intervals" problem: sort by start
 * (O(n log n)), then sweep once (O(n)), keeping the higher-severity placeholder
 * when spans collide. Replacement is then a single left-to-right slice pass.
 */

/**
 * Merge overlapping/touching spans. Each span: {start, end, placeholder, score}.
 * Returns non-overlapping spans sorted by start; merged spans keep the
 * placeholder of the highest-scoring contributor.
 */
export function mergeSpans(spans) {
  if (spans.length <= 1) return spans.slice();
  const sorted = spans.slice().sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start < cur.end) {
      // Overlap: extend, and adopt the more severe placeholder/label.
      if ((s.score ?? 0) > (cur.score ?? 0)) {
        cur.placeholder = s.placeholder;
        cur.score = s.score;
      }
      cur.end = Math.max(cur.end, s.end);
    } else {
      merged.push(cur);
      cur = { ...s };
    }
  }
  merged.push(cur);
  return merged;
}

/**
 * Produce the redacted string.
 * @param {string} text
 * @param {{start:number, end:number, placeholder:string, score?:number}[]} spans
 * @returns {string}
 */
export function redact(text, spans) {
  if (!spans || spans.length === 0) return text;
  const merged = mergeSpans(spans);

  let out = '';
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) out += text.slice(cursor, span.start);
    out += span.placeholder;
    cursor = span.end;
  }
  out += text.slice(cursor);
  return out;
}
