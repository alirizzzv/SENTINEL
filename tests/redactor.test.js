import { describe, it, expect } from 'vitest';
import { mergeSpans, redact } from '../src/engine/redactor.js';

describe('mergeSpans', () => {
  it('leaves non-overlapping spans intact', () => {
    const spans = [
      { start: 0, end: 3, placeholder: '[A]', score: 10 },
      { start: 5, end: 8, placeholder: '[B]', score: 10 },
    ];
    expect(mergeSpans(spans)).toHaveLength(2);
  });

  it('merges overlapping spans and keeps the higher-severity placeholder', () => {
    const spans = [
      { start: 0, end: 10, placeholder: '[BEARER_TOKEN]', score: 70 },
      { start: 7, end: 40, placeholder: '[JWT]', score: 80 },
    ];
    const merged = mergeSpans(spans);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 0, end: 40, placeholder: '[JWT]' });
  });
});

describe('redact', () => {
  it('replaces spans with placeholders in a single pass', () => {
    const text = 'key AKIA1234567890ABCDEF and mail a@b.com';
    const spans = [
      { start: 4, end: 24, placeholder: '[AWS_ACCESS_KEY]', score: 90 },
      { start: 34, end: 41, placeholder: '[EMAIL]', score: 25 },
    ];
    expect(redact(text, spans)).toBe('key [AWS_ACCESS_KEY] and mail [EMAIL]');
  });

  it('returns the original text when there is nothing to redact', () => {
    expect(redact('hello world', [])).toBe('hello world');
  });

  it('handles a span at the very start and end', () => {
    const text = 'SECRET middle SECRET';
    const spans = [
      { start: 0, end: 6, placeholder: '[X]', score: 1 },
      { start: 14, end: 20, placeholder: '[X]', score: 1 },
    ];
    expect(redact(text, spans)).toBe('[X] middle [X]');
  });
});
