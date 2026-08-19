/**
 * Write-boundary schema gate for the request store: RPC-shaped seeds
 * (`createLocalRequest` forwards them verbatim) are validated BEFORE
 * any persistence, so a malformed entity — e.g. a `form` body missing
 * `formParts` — is rejected with a path-bearing error instead of
 * persisting silently. Unvalidated, such a row used to survive to
 * storage, where the renderer's raw read rendered it and the template
 * walkers crashed the whole workbench on the missing variant field.
 *
 * Validation runs ahead of the sync-service availability gate, so
 * these pins exercise the rejection contract on a bare store — a
 * payload that PASSES validation falls through to the availability
 * error instead. Mirrors `live-workflow-store-boundary.test.ts`.
 */

import type { Request } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import { addRequest, updateRequest } from '../../src/entity/request-store/requests';
import { setLoadedWorkspaceId, setRequests } from '../../src/entity/request-store/state';

const MALFORMED_FORM_BODY = { type: 'form' } as unknown as Request['body'];

function makeExisting(): Request {
  return {
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/col00001/demo-req00001',
    name: 'Demo',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
  };
}

afterEach(() => {
  setRequests([]);
  setLoadedWorkspaceId(null);
});

describe('addRequest boundary validation', () => {
  it('rejects a form body missing formParts with a path-bearing error', async () => {
    await expect(addRequest('probe', 'requests/col00001', { body: MALFORMED_FORM_BODY })).rejects.toThrow(
      /addRequest: invalid request.*formParts/,
    );
  });

  it('rejects a multipart body missing multipartParts', async () => {
    await expect(
      addRequest('probe', 'requests/col00001', {
        body: { type: 'multipart' } as unknown as Request['body'],
      }),
    ).rejects.toThrow(/addRequest: invalid request.*multipartParts/);
  });

  it('passes a valid seed through to the sync-service availability gate', async () => {
    await expect(addRequest('probe', 'requests/col00001', { url: 'https://api.openheaders.io/ping' })).rejects.toThrow(
      /sync service not initialized/,
    );
  });
});

describe('updateRequest boundary validation', () => {
  it('returns a typed failure for a malformed body instead of persisting it', async () => {
    const existing = makeExisting();
    setRequests([existing]);
    setLoadedWorkspaceId('ws-1');

    const result = await updateRequest(existing.uid, { body: MALFORMED_FORM_BODY });
    expect(result).toMatchObject({ ok: false, reason: 'other' });
    if (!result.ok && result.reason === 'other') {
      expect(result.message).toMatch(/updateRequest: invalid request.*formParts/);
    }
  });

  it('passes a valid update through to the sync-service availability gate', async () => {
    const existing = makeExisting();
    setRequests([existing]);
    setLoadedWorkspaceId('ws-1');

    const result = await updateRequest(existing.uid, { url: 'https://api.openheaders.io/v2/ping' });
    expect(result).toMatchObject({ ok: false, reason: 'other', message: 'sync service not initialized' });
  });
});
