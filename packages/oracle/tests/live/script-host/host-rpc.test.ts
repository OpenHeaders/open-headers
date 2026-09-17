/**
 * The host-neutral `oh.*` servicing over a host's seam: an ad-hoc
 * `sendRequest` rides the seam's Send pipeline as a scriptless draft
 * and answers the projected response snapshot; a Send refusal folds
 * into the never-throw error envelope; a named string secret answers
 * off the mirrored vault without touching the token store. The OAuth
 * refresh leg over the seam's transport and the write path are pinned
 * by the node host's composition.
 */

import type { ScriptHostRequest } from '@openheaders/core/scripts';
import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  tokenBundle: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
}));

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getEnvironments: () => [],
  getVault: () => ({
    schemaVersion: 5,
    secrets: [{ uid: 'sec00001', kind: 'string', name: 'api_key', value: 'k-1' }],
  }),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => h.tokenBundle(...args),
  getRefreshConfig: async () => null,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({ getRequestCollections: () => [] }));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({ getCollections: () => [] }));

import { errorSnapshot } from '../../../src/live/request-exec/execute';
import { createScriptHostRequestHandler, type ScriptHostSeam } from '../../../src/live/script-host/host-rpc';

const envelope = { executionId: 'e1', rpcId: 'r1' };

const snapshot = {
  method: 'POST' as const,
  url: 'https://api.openheaders.io/v1/items?x=1',
  headers: [{ key: 'X-Probe', value: '1' }],
  params: [{ key: 'x', value: '1' }],
  body: { type: 'none' as const },
};

let sent: Request[];
let seam: ScriptHostSeam;

beforeEach(() => {
  sent = [];
  seam = {
    refreshTransport: {
      send: async () => ({
        status: 0,
        statusText: '',
        url: '',
        headers: [],
        body: '',
        bodyTruncated: false,
        bodyBytes: 0,
      }),
    },
    sendRequest: async (draft) => {
      sent.push(draft);
      return {
        success: true,
        snapshot: {
          ...errorSnapshot('unused'),
          error: null,
          status: 201,
          statusText: 'Created',
          url: draft.url,
          headers: [{ key: 'content-type', value: 'application/json' }],
          body: '{"id":1}',
          durationMs: 7,
        },
      };
    },
  };
});

describe('createScriptHostRequestHandler', () => {
  it('sendRequest rides the seam Send as a scriptless draft and projects the snapshot', async () => {
    const handle = createScriptHostRequestHandler(seam);
    const reply = await handle({ ...envelope, op: 'sendRequest', request: snapshot } satisfies ScriptHostRequest);
    expect(reply).toMatchObject({
      ...envelope,
      ok: true,
      value: { status: 201, statusText: 'Created', body: '{"id":1}', durationMs: 7 },
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: snapshot.url,
      auth: { type: 'none' },
      headers: [{ key: 'X-Probe', value: '1', enabled: true }],
      params: [{ key: 'x', value: '1', enabled: true }],
    });
    expect(sent[0].preRequestScript).toBeUndefined();
    expect(sent[0].postResponseScript).toBeUndefined();
  });

  it('a seam Send refusal folds into the error envelope, never a throw', async () => {
    seam.sendRequest = async () => ({ success: false, error: 'No active workspace' });
    const handle = createScriptHostRequestHandler(seam);
    const reply = await handle({ ...envelope, op: 'sendRequest', request: snapshot });
    expect(reply).toEqual({ ...envelope, ok: false, error: 'No active workspace' });
  });

  it('vault.get answers a mirrored string secret without the token store', async () => {
    const handle = createScriptHostRequestHandler(seam);
    expect(await handle({ ...envelope, op: 'vault.get', ref: 'api_key' })).toEqual({
      ...envelope,
      ok: true,
      value: 'k-1',
    });
    expect(h.tokenBundle).not.toHaveBeenCalled();
  });
});
