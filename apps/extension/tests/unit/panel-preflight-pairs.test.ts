import { derivePreflightPairs, getRole } from '@openheaders/ui/panel/components/traffic/preflight-pairs';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../__factories__/lifecycle';

function row(
  requestId: string,
  url: string,
  method: string,
  arrival: number,
  resourceType?: string,
  extraHeaders: Array<{ name: string; value: string }> = [],
) {
  return makeRow({
    requestId,
    url,
    method,
    resourceType,
    displayId: arrival + 1,
    startedAtMs: 1000 + arrival,
    harOverrides: { method, requestHeaders: extraHeaders },
  });
}

describe('derivePreflightPairs', () => {
  it('pairs an OPTIONS/preflight with the next non-OPTIONS on the same URL', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = row('pre', url, 'OPTIONS', 0, 'preflight');
    const parent = row('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([pre, parent]);
    expect(getRole(pairs, 'pre')).toEqual({ kind: 'preflight', peerId: 'parent' });
    expect(getRole(pairs, 'parent')).toEqual({ kind: 'parent', peerId: 'pre' });
  });

  it('falls back to Access-Control-Request-Method header when resourceType is missing', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = row('pre', url, 'OPTIONS', 0, undefined, [
      { name: 'Access-Control-Request-Method', value: 'POST' },
    ]);
    const parent = row('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([pre, parent]);
    expect(getRole(pairs, 'pre').kind).toBe('preflight');
  });

  it('does not pair a bare OPTIONS request (no preflight signal)', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const opts = row('opts', url, 'OPTIONS', 0, 'xhr');
    const follow = row('follow', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([opts, follow]);
    expect(getRole(pairs, 'opts').kind).toBe('none');
    expect(getRole(pairs, 'follow').kind).toBe('none');
  });

  it('each preflight pairs with its own child when two fire on the same URL', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre1 = row('pre1', url, 'OPTIONS', 0, 'preflight');
    const parent1 = row('parent1', url, 'POST', 1, 'xhr');
    const pre2 = row('pre2', url, 'OPTIONS', 2, 'preflight');
    const parent2 = row('parent2', url, 'POST', 3, 'xhr');
    const pairs = derivePreflightPairs([pre1, parent1, pre2, parent2]);
    expect(getRole(pairs, 'pre1')).toEqual({ kind: 'preflight', peerId: 'parent1' });
    expect(getRole(pairs, 'pre2')).toEqual({ kind: 'preflight', peerId: 'parent2' });
  });

  it('preserves pairing order under input shuffle (bucket by URL + arrival)', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = row('pre', url, 'OPTIONS', 0, 'preflight');
    const parent = row('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([parent, pre]);
    expect(getRole(pairs, 'pre').kind).toBe('preflight');
    expect(getRole(pairs, 'parent').kind).toBe('parent');
  });

  it('leaves preflight unpaired when no subsequent non-OPTIONS matches', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = row('pre', url, 'OPTIONS', 0, 'preflight');
    const pairs = derivePreflightPairs([pre]);
    expect(getRole(pairs, 'pre').kind).toBe('none');
  });

  it('pairs across different URLs independently', () => {
    const a = 'https://api.openheaders.io/a';
    const b = 'https://api.openheaders.io/b';
    const preA = row('preA', a, 'OPTIONS', 0, 'preflight');
    const preB = row('preB', b, 'OPTIONS', 1, 'preflight');
    const parentB = row('parentB', b, 'POST', 2, 'xhr');
    const parentA = row('parentA', a, 'POST', 3, 'xhr');
    const pairs = derivePreflightPairs([preA, preB, parentB, parentA]);
    expect(getRole(pairs, 'preA')).toEqual({ kind: 'preflight', peerId: 'parentA' });
    expect(getRole(pairs, 'preB')).toEqual({ kind: 'preflight', peerId: 'parentB' });
  });
});
