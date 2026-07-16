/**
 * Purity laws for the request draft projections.
 *
 * `draftFromRequest` runs inside `canonicalRequestProjection`, whose
 * output feeds the reprime fingerprint/signature comparisons — so it
 * must be DETERMINISTIC. A random uid minted for URL-derived param
 * rows made every projection of the same request compare unequal, and
 * the reprime gate then re-populated the draft on every render: an
 * infinite setState loop that wedged the editor for any saved request
 * whose URL carries a query string.
 */

import type { Request } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import {
  buildRequestUpdates,
  canonicalRequestProjection,
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
