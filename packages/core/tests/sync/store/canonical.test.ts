import { canonicalJson, canonicalJsonPretty } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';

describe('canonicalJson', () => {
  it('serializes key-order-permuted objects byte-identically', () => {
    const inserted = { zeta: 1, alpha: { beta: 2, aleph: 3 } };
    const alphabetized = { alpha: { aleph: 3, beta: 2 }, zeta: 1 };
    expect(canonicalJson(inserted)).toBe(canonicalJson(alphabetized));
  });

  it('preserves array order — array order is semantic', () => {
    expect(canonicalJson(['b', 'a'])).not.toBe(canonicalJson(['a', 'b']));
  });
});

describe('canonicalJsonPretty', () => {
  it('renders a storage-echo and an insertion-ordered twin line-identically', () => {
    // chrome.storage alphabetizes object keys on round-trip; merge-editor
    // panes serialize the saved echo on one side and the literal-ordered
    // draft on the other, so both must sort before printing.
    const echo = { attempts: 3, backoff: 'exponential', delayMs: 500 };
    const draft = { delayMs: 500, attempts: 3, backoff: 'exponential' };
    expect(canonicalJsonPretty(echo)).toBe(canonicalJsonPretty(draft));
  });

  it('pretty-prints with 2-space indentation', () => {
    expect(canonicalJsonPretty({ b: 1, a: [2] })).toBe('{\n  "a": [\n    2\n  ],\n  "b": 1\n}');
  });
});
