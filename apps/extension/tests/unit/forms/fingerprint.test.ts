import { describe, expect, it } from 'vitest';
import { stableStringify } from '@/shared/forms/fingerprint';

describe('stableStringify', () => {
  it('produces equal strings for objects with different insertion order but same content', () => {
    const a = { name: 'X', enabled: true, action: { value: 'V' } };
    const b = { action: { value: 'V' }, enabled: true, name: 'X' };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves array order (drag-and-drop reorder = different fingerprint)', () => {
    const original = [{ uid: 'A', value: '1' }, { uid: 'B', value: '2' }];
    const reordered = [{ uid: 'B', value: '2' }, { uid: 'A', value: '1' }];
    // Same set, different order → different strings → reorder is dirty.
    expect(stableStringify(original)).not.toBe(stableStringify(reordered));
  });

  it('handles primitive scalars', () => {
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(true)).toBe('true');
  });

  it('handles nested heterogeneous structures', () => {
    const a = {
      conditions: [{ uid: '1', type: 'request-domains', values: ['x.test', 'y.test'] }],
      action: { requestHeaders: [{ uid: 'h1', operation: 'override', value: 'v' }] },
    };
    const b = {
      action: { requestHeaders: [{ value: 'v', uid: 'h1', operation: 'override' }] },
      conditions: [{ values: ['x.test', 'y.test'], type: 'request-domains', uid: '1' }],
    };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('detects content edits inside an array element', () => {
    const before = [{ uid: 'A', value: '1' }];
    const after = [{ uid: 'A', value: '2' }];
    expect(stableStringify(before)).not.toBe(stableStringify(after));
  });

  it('detects manual revert: typed and reverted produces same fingerprint as original', () => {
    const canonical = { name: 'X', value: '01' };
    const userTyped = { name: 'X', value: '02' };
    const userReverted = { name: 'X', value: '01' };
    expect(stableStringify(userTyped)).not.toBe(stableStringify(canonical));
    expect(stableStringify(userReverted)).toBe(stableStringify(canonical));
  });

  // Mirrors JSON.stringify's undefined semantics: a key whose value is
  // `undefined` is dropped, not emitted as `"key":undefined`. The
  // canonical side round-trips through chrome.storage (JSON) and never
  // sees those keys — without this, a form whose ConditionEditor /
  // type-change handler / Reset button left a phantom `undefined`-valued
  // key on a row would diverge from canonical FOREVER, with no
  // user-visible way to clear it (regression caught in extension
  // manual-testing pre Phase E.3).
  it('drops keys whose value is undefined (matches JSON semantics)', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('drops undefined keys at any depth — including inside arrays of rows', () => {
    const formCondition = { uid: 'X', type: 'url-filter', values: ['v'], headerName: undefined };
    const canonicalCondition = { uid: 'X', type: 'url-filter', values: ['v'] };
    expect(stableStringify(formCondition)).toBe(stableStringify(canonicalCondition));
    expect(stableStringify([formCondition])).toBe(stableStringify([canonicalCondition]));
  });
});
