/**
 * Purity laws for the request draft projections.
 *
 * `draftFromRequest` runs inside `canonicalRequestProjection`, whose
 * output feeds the reprime fingerprint/signature comparisons — so it
 * must be DETERMINISTIC. A random uid minted for URL-derived param
 * rows made every projection of the same request compare unequal, and
 * the reprime gate then re-populated the draft on every render: an
 * infinite setState loop that wedged the editor for any saved request
 * whose URL carries a query string. The Path Parameters rows derive
 * under the same law (`derivePathParamRows`): name-keyed deterministic
 * uids for the rows no stored row answers, stored identity kept by key.
 */

import type { Request } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import {
  buildRequestUpdates,
  canonicalRequestProjection,
  derivePathParamRows,
  draftFromRequest,
} from '@openheaders/ui/workbench/components/request-editor/draft';
import { describe, expect, it } from 'vitest';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'reqstrm1',
    path: 'api-requests/stream-reqstrm1',
    name: 'GET sse stream',
    method: 'GET',
    url: 'https://api.openheaders.io/net/sse/9999?ms=300&mode=live',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    ...overrides,
  };
}

describe('draftFromRequest — URL-derived param rows', () => {
  it('mints deterministic uids: two calls over the same request agree', () => {
    const req = makeRequest();
    const a = draftFromRequest(req);
    const b = draftFromRequest(req);
    expect(a.params.map((p) => p.uid)).toEqual(b.params.map((p) => p.uid));
    expect(a.params).toHaveLength(2);
  });

  it('derived uids fit the persisted uid shape and stay unique per row', () => {
    const draft = draftFromRequest(makeRequest());
    for (const row of draft.params) expect(row.uid).toMatch(/^[a-z0-9]{8}$/);
    expect(new Set(draft.params.map((p) => p.uid)).size).toBe(draft.params.length);
  });

  it('stored params keep their persisted uids and follow the URL-derived rows', () => {
    const req = makeRequest({
      params: [{ uid: 'abcd1234', key: 'stored', value: 'yes', enabled: true }],
    });
    const draft = draftFromRequest(req);
    expect(draft.params.map((p) => p.key)).toEqual(['ms', 'mode', 'stored']);
    expect(draft.params[2]?.uid).toBe('abcd1234');
  });
});

describe('canonicalRequestProjection — purity', () => {
  it('is referentially stable under stableStringify for a query-bearing URL', () => {
    const req = makeRequest();
    expect(stableStringify(canonicalRequestProjection(req))).toBe(stableStringify(canonicalRequestProjection(req)));
  });

  it('agrees with the fingerprint of a draft populated from the same request', () => {
    const req = makeRequest();
    const formFingerprint = stableStringify(buildRequestUpdates(draftFromRequest(req)));
    expect(formFingerprint).toBe(stableStringify(canonicalRequestProjection(req)));
  });
});

describe('derivePathParamRows — the Path Parameters table', () => {
  const url = 'https://api.openheaders.io/users/:userId/files/:fileId.json';

  it('derives one row per :name in path order, empty values, name-keyed deterministic 8-char uids', () => {
    const a = derivePathParamRows(url, []);
    const b = derivePathParamRows(url, []);
    expect(a.map((r) => [r.key, r.value, r.enabled])).toEqual([
      ['userId', '', true],
      ['fileId', '', true],
    ]);
    expect(a.map((r) => r.uid)).toEqual(b.map((r) => r.uid));
    for (const row of a) expect(row.uid).toMatch(/^p[a-z0-9]{7}$/);
    expect(new Set(a.map((r) => r.uid)).size).toBe(2);
    // The uid is the name's, not the position's — a segment typed in
    // front keeps the rows behind it under their uids.
    const shifted = derivePathParamRows('https://api.openheaders.io/:tenant/users/:userId/files/:fileId.json', []);
    expect(shifted.slice(1).map((r) => r.uid)).toEqual(a.map((r) => r.uid));
  });

  it('keeps a stored row (uid, value, description) by key and drops a row the URL no longer names', () => {
    const rows = derivePathParamRows(url, [
      { uid: 'abcd1234', key: 'fileId', value: '{{env.FILE}}', description: 'The file' },
      { uid: 'dead0000', key: 'orphan', value: 'x', description: '' },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['userId', 'fileId']);
    expect(rows[1]).toMatchObject({ uid: 'abcd1234', value: '{{env.FILE}}', description: 'The file' });
    expect(rows.some((r) => r.key === 'orphan')).toBe(false);
  });

  it('a duplicate name is one row; names are case-sensitive', () => {
    expect(derivePathParamRows('https://api.openheaders.io/:id/x/:id', []).map((r) => r.key)).toEqual(['id']);
    expect(derivePathParamRows('https://api.openheaders.io/:Id/:id', []).map((r) => r.key)).toEqual(['Id', 'id']);
  });

  it('never reads the authority or the query: a port, an IPv6 literal and a `:` in the query are not parameters', () => {
    expect(derivePathParamRows('http://localhost:8080/:id?time=12:30', [])).toHaveLength(1);
    expect(derivePathParamRows('https://[::1]/v1/files:batchGet', [])).toHaveLength(0);
  });
});

describe('draftFromRequest — path param rows', () => {
  it('derives the rows from the URL, keeping stored identity, and projects deterministically', () => {
    const req = makeRequest({
      url: 'https://api.openheaders.io/users/:userId?page=2',
      pathParams: [{ uid: 'abcd1234', key: 'userId', value: '7', description: 'who' }],
    });
    const draft = draftFromRequest(req);
    expect(draft.pathParams).toHaveLength(1);
    expect(draft.pathParams[0]).toMatchObject({ uid: 'abcd1234', key: 'userId', value: '7', description: 'who' });
    expect(stableStringify(canonicalRequestProjection(req))).toBe(stableStringify(canonicalRequestProjection(req)));
    expect(stableStringify(buildRequestUpdates(draft))).toBe(stableStringify(canonicalRequestProjection(req)));
  });

  it('a request without the field and a URL naming a parameter projects the derived row; the stored-side updates carry it as a plain row', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/users/:userId' });
    const updates = canonicalRequestProjection(req);
    expect(updates.pathParams).toEqual([
      { uid: expect.stringMatching(/^p[a-z0-9]{7}$/), key: 'userId', value: '', description: undefined },
    ]);
  });
});
