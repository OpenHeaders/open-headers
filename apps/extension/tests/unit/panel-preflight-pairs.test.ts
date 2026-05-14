import { derivePreflightPairs, getRole } from '@openheaders/ui/panel/components/traffic/preflight-pairs';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

function entry(
  id: string,
  url: string,
  method: string,
  arrival: number,
  resourceType?: string,
  extraHeaders: Array<{ name: string; value: string }> = [],
): InspectorRequest {
  const har: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: {
      method,
      url,
      headers: extraHeaders,
      queryString: [],
    },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  };
  return {
    id,
    harEntry: har,
    method,
    url,
    timestamp: Date.parse(har.startedDateTime),
    resourceType,
    fires: [],
    arrivalIndex: arrival,
    displayId: arrival + 1,
  };
}

describe('derivePreflightPairs', () => {
  it('pairs an OPTIONS/preflight with the next non-OPTIONS on the same URL', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = entry('pre', url, 'OPTIONS', 0, 'preflight');
    const parent = entry('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([pre, parent]);
    expect(getRole(pairs, pre.id)).toEqual({ kind: 'preflight', peerId: 'parent' });
    expect(getRole(pairs, parent.id)).toEqual({ kind: 'parent', peerId: 'pre' });
  });

  it('falls back to Access-Control-Request-Method header when resourceType is missing', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = entry('pre', url, 'OPTIONS', 0, undefined, [{ name: 'Access-Control-Request-Method', value: 'POST' }]);
    const parent = entry('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([pre, parent]);
    expect(getRole(pairs, pre.id).kind).toBe('preflight');
  });

  it('does not pair a bare OPTIONS request (no preflight signal)', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const opts = entry('opts', url, 'OPTIONS', 0, 'xhr');
    const follow = entry('follow', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([opts, follow]);
    expect(getRole(pairs, opts.id).kind).toBe('none');
    expect(getRole(pairs, follow.id).kind).toBe('none');
  });

  it('each preflight pairs with its own child when two fire on the same URL', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre1 = entry('pre1', url, 'OPTIONS', 0, 'preflight');
    const parent1 = entry('parent1', url, 'POST', 1, 'xhr');
    const pre2 = entry('pre2', url, 'OPTIONS', 2, 'preflight');
    const parent2 = entry('parent2', url, 'POST', 3, 'xhr');
    const pairs = derivePreflightPairs([pre1, parent1, pre2, parent2]);
    expect(getRole(pairs, pre1.id)).toEqual({ kind: 'preflight', peerId: 'parent1' });
    expect(getRole(pairs, pre2.id)).toEqual({ kind: 'preflight', peerId: 'parent2' });
  });

  it('preserves pairing order under input shuffle (bucket by URL + arrival)', () => {
    // Simulate entries arriving out of arrival order — the function
    // should bucket by URL, sort by arrivalIndex, and pair correctly.
    const url = 'https://api.openheaders.io/v2/config';
    const pre = entry('pre', url, 'OPTIONS', 0, 'preflight');
    const parent = entry('parent', url, 'POST', 1, 'xhr');
    const pairs = derivePreflightPairs([parent, pre]);
    expect(getRole(pairs, pre.id).kind).toBe('preflight');
    expect(getRole(pairs, parent.id).kind).toBe('parent');
  });

  it('leaves preflight unpaired when no subsequent non-OPTIONS matches', () => {
    const url = 'https://api.openheaders.io/v2/config';
    const pre = entry('pre', url, 'OPTIONS', 0, 'preflight');
    const pairs = derivePreflightPairs([pre]);
    expect(getRole(pairs, pre.id).kind).toBe('none');
  });

  it('pairs across different URLs independently', () => {
    const a = 'https://api.openheaders.io/a';
    const b = 'https://api.openheaders.io/b';
    const preA = entry('preA', a, 'OPTIONS', 0, 'preflight');
    const preB = entry('preB', b, 'OPTIONS', 1, 'preflight');
    const parentB = entry('parentB', b, 'POST', 2, 'xhr');
    const parentA = entry('parentA', a, 'POST', 3, 'xhr');
    const pairs = derivePreflightPairs([preA, preB, parentB, parentA]);
    expect(getRole(pairs, preA.id)).toEqual({ kind: 'preflight', peerId: 'parentA' });
    expect(getRole(pairs, preB.id)).toEqual({ kind: 'preflight', peerId: 'parentB' });
  });
});
