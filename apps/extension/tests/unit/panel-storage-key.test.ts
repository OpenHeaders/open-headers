/**
 * Serialized storage-key parsing — the scope bar's partition chip reads
 * this. The parser only splits what `Storage.getStorageKey` reported;
 * it never recomputes or validates a key.
 */

import { parseStorageKey } from '@openheaders/ui/panel/data/storage/storage-key';
import { describe, expect, it } from 'vitest';

describe('parseStorageKey', () => {
  it('reads a first-party key as unpartitioned', () => {
    expect(parseStorageKey('https://openheaders.io/')).toEqual({
      origin: 'https://openheaders.io',
      partitioned: false,
      topLevelSite: null,
      raw: 'https://openheaders.io/',
    });
  });

  it('extracts the top-level site from a ^0 component', () => {
    const parsed = parseStorageKey('https://cdn.openheaders.io/^0https://openheaders.io');
    expect(parsed.origin).toBe('https://cdn.openheaders.io');
    expect(parsed.partitioned).toBe(true);
    expect(parsed.topLevelSite).toBe('https://openheaders.io');
  });

  it('marks a key with only opaque components as partitioned without a site', () => {
    const parsed = parseStorageKey('https://cdn.openheaders.io/^31');
    expect(parsed.partitioned).toBe(true);
    expect(parsed.topLevelSite).toBeNull();
  });

  it('finds the ^0 component among several', () => {
    const parsed = parseStorageKey('https://cdn.openheaders.io/^0https://openheaders.io^31');
    expect(parsed.topLevelSite).toBe('https://openheaders.io');
  });

  it('keeps the raw key verbatim for display', () => {
    const raw = 'https://cdn.openheaders.io/^0https://openheaders.io^31';
    expect(parseStorageKey(raw).raw).toBe(raw);
  });
});
