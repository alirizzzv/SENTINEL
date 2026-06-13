/**
 * SENTINEL detection engine — public entry point.
 *
 * scan(text) runs the full pipeline:
 *
 *   raw text
 *     │  1. normalize (lowercase copy for matching)
 *     ▼
 *   Aho-Corasick candidate scan ──▶ which anchored patterns are worth validating?
 *     │  2. + always-scan anchorless PII patterns (email/phone/card/IDs)
 *     ▼
 *   regex validation ──▶ precise spans (+ optional checks e.g. Luhn)
 *     │  3.
 *     ▼
 *   injection detection (3-layer)
 *     │  4.
 *     ▼
 *   risk scoring (max-heap, composite) ──▶ {riskLevel, score, threats[]}
 *     │  5.
 *     ▼
 *   redaction (merge-intervals) ──▶ redactedText
 *     │  6.
 *     ▼
 *   result object
 *
 * The engine is framework-free so the same code runs in Vitest, the content
 * script (synchronously, in-page), and the background service worker.
 */

import { AhoCorasick } from './aho-corasick.js';
import { PATTERNS, CATEGORIES } from './pattern-dictionary.js';
import { scoreThreats, riskLevel, RISK } from './risk-scorer.js';
import { detectInjection, INJECTION_SCORE } from './injection-detector.js';
import { detectHighEntropy } from './entropy-detector.js';
import { decodeAndScan } from './decode-scan.js';
import { redact } from './redactor.js';

/** Severity of the prefix-less detectors (real credentials, slightly lower certainty). */
const ENTROPY_SCORE = 70;
const ENCODED_SCORE = 85;

const now = () =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

export class DetectionEngine {
  /** @param {import('./pattern-dictionary.js').Pattern[]} patterns */
  constructor(patterns = PATTERNS) {
    this.patterns = patterns;

    // Build the candidate automaton once. Map each lowercase anchor to the set
    // of pattern indices it should trigger validation for.
    /** @type {Map<string, Set<number>>} */
    this.anchorToPatterns = new Map();
    const anchors = [];
    patterns.forEach((p, idx) => {
      for (const c of p.candidates || []) {
        const key = c.toLowerCase();
        if (!this.anchorToPatterns.has(key)) {
          this.anchorToPatterns.set(key, new Set());
          anchors.push({ pattern: key });
        }
        this.anchorToPatterns.get(key).add(idx);
      }
    });
    this.automaton = new AhoCorasick(anchors);

    // Patterns with no literal anchor must always be regex-validated.
    this.alwaysScan = patterns
      .map((p, idx) => (p.alwaysScan ? idx : -1))
      .filter((idx) => idx >= 0);
  }

  /**
   * @param {string} text
   * @param {{sensitivity?: 'LOW'|'MEDIUM'|'HIGH'}} [opts]
   */
  scan(text, opts = {}) {
    const t0 = now();

    if (typeof text !== 'string' || text.length === 0) {
      return {
        score: 0,
        level: RISK.SAFE,
        threats: [],
        threatCategories: [],
        threatCount: 0,
        redactedText: text || '',
        patternMatchCount: 0,
        processingTimeMs: 0,
      };
    }

    const lower = text.toLowerCase();

    // 1–2. Candidate scan: which anchored patterns to validate, + always-scan.
    const toValidate = new Set(this.alwaysScan);
    for (const m of this.automaton.search(lower)) {
      const ids = this.anchorToPatterns.get(m.pattern);
      if (ids) for (const id of ids) toValidate.add(id);
    }

    // 3. Regex validation -> raw matches with precise spans.
    const rawMatches = [];
    for (const id of toValidate) {
      const p = this.patterns[id];
      p.regex.lastIndex = 0;
      let match;
      while ((match = p.regex.exec(text)) !== null) {
        const value = match[0];
        if (value.length === 0) {
          p.regex.lastIndex += 1; // guard against zero-width loops
          continue;
        }
        if (p.validate && !p.validate(value)) continue;
        rawMatches.push({
          id,
          start: match.index,
          end: match.index + value.length,
          length: value.length,
          score: p.score,
        });
      }
    }

    // Suppress sub-matches: a span fully contained in a longer, at-least-as-severe
    // span of a *different* pattern is an artifact (e.g. a credit card's first 12
    // digits also matching the Aadhaar pattern). Drop it so the threat list is honest.
    const kept = rawMatches.filter((m) => {
      return !rawMatches.some(
        (o) =>
          o !== m &&
          o.id !== m.id &&
          o.start <= m.start &&
          o.end >= m.end &&
          o.length > m.length &&
          o.score >= m.score,
      );
    });

    // Aggregate surviving matches into spans + per-pattern threat tallies.
    const spans = [];
    const threatsById = new Map(); // patternId -> threat aggregate
    let patternMatchCount = 0;
    for (const m of kept) {
      const p = this.patterns[m.id];
      patternMatchCount += 1;
      spans.push({ start: m.start, end: m.end, placeholder: p.placeholder, score: p.score });
      if (!threatsById.has(m.id)) {
        threatsById.set(m.id, {
          id: p.id,
          category: p.category,
          label: p.label,
          score: p.score,
          count: 0,
        });
      }
      threatsById.get(m.id).count += 1;
    }

    // 3b. Prefix-less detection (entropy + encoded). These catch what the format
    // patterns structurally cannot: renamed/custom secrets and base64-hidden keys.
    // A span is dropped if a precise pattern already covers it (no double-flagging).
    const overlapsExisting = (s) =>
      spans.some((e) => s.start < e.end && e.start < s.end);

    const addExtra = (matches, id, placeholder, score, category, label) => {
      let count = 0;
      for (const m of matches) {
        if (overlapsExisting(m)) continue;
        spans.push({ start: m.start, end: m.end, placeholder, score });
        count += 1;
      }
      if (count > 0) {
        patternMatchCount += count;
        threatsById.set(id, { id, category, label, score, count });
      }
    };

    addExtra(detectHighEntropy(text), 'HIGH_ENTROPY_SECRET', '[SECRET]', ENTROPY_SCORE,
      'HIGH_ENTROPY_SECRET', CATEGORIES.HIGH_ENTROPY_SECRET.label);
    addExtra(decodeAndScan(text), 'ENCODED_SECRET', '[ENCODED_SECRET]', ENCODED_SCORE,
      'ENCODED_SECRET', CATEGORIES.ENCODED_SECRET.label);

    const threats = [...threatsById.values()];

    // 4. Injection detection (separate, no redaction span — flags the prompt).
    const injection = detectInjection(text, opts);
    if (injection.detected) {
      threats.push({
        id: 'PROMPT_INJECTION',
        category: 'PROMPT_INJECTION',
        label: CATEGORIES.PROMPT_INJECTION.label,
        score: INJECTION_SCORE,
        count: 1,
        confidence: injection.confidence,
        signals: injection.signals,
      });
    }

    // 5. Risk scoring (max-heap, composite).
    const scored = scoreThreats(threats);

    // 6. Redaction.
    const redactedText = redact(text, spans);

    const threatCategories = [...new Set(scored.threats.map((t) => t.category))];

    return {
      score: scored.score,
      level: scored.level,
      threats: scored.threats,
      threatCategories,
      threatCount: scored.threatCount,
      redactedText,
      patternMatchCount,
      injection,
      processingTimeMs: Math.round((now() - t0) * 1000) / 1000,
    };
  }
}

/** Shared singleton built from the default dictionary. */
export const engine = new DetectionEngine();

/** Convenience wrapper around the singleton. */
export function scan(text, opts) {
  return engine.scan(text, opts);
}

export { CATEGORIES, RISK, riskLevel };
