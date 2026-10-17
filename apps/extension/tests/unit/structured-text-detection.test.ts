/**
 * structured-text-detection — the format-time sniff: JSON objects and
 * arrays (with surrounding whitespace) read as json; prose, broken
 * JSON, bare scalars, empty and oversized buffers read as nothing.
 */

import {
  DETECT_CAP_CHARS,
  detectStructuredLanguage,
} from '@openheaders/ui/workbench/components/monaco/structured-text-detection';
import { describe, expect, it } from 'vitest';

describe('detectStructuredLanguage', () => {
  it('reads a JSON object or array as json, whitespace around it included', () => {
    expect(detectStructuredLanguage('{"temp":21}')).toBe('json');
    expect(detectStructuredLanguage('  \n[1, 2, 3]\r\n')).toBe('json');
    expect(detectStructuredLanguage('{\n  "a": {"b": [true, null]}\n}')).toBe('json');
  });

  it('reads prose, broken JSON and bare scalars as nothing', () => {
    expect(detectStructuredLanguage('echo-me-delegated')).toBeNull();
    expect(detectStructuredLanguage('{"temp": 21')).toBeNull();
    expect(detectStructuredLanguage('{"temp": 21,}')).toBeNull();
    expect(detectStructuredLanguage('42')).toBeNull();
    expect(detectStructuredLanguage('"quoted"')).toBeNull();
    expect(detectStructuredLanguage('{ not json }')).toBeNull();
  });

  it('reads an empty or whitespace buffer as nothing', () => {
    expect(detectStructuredLanguage('')).toBeNull();
    expect(detectStructuredLanguage('   \n\t')).toBeNull();
  });

  it('leaves a buffer past the cap alone without parsing it', () => {
    // Valid JSON (one very long number in an array) — only the cap
    // keeps it out.
    const big = `[${'1'.repeat(DETECT_CAP_CHARS)}]`;
    expect(big.length).toBeGreaterThan(DETECT_CAP_CHARS);
    expect(detectStructuredLanguage(big)).toBeNull();
  });
});
