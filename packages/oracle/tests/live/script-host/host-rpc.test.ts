/**
 * The host-neutral `oh.*` servicing over a host's seam: an ad-hoc
 * `sendRequest` rides the seam's Send pipeline as a scriptless draft
 * and answers the projected response snapshot; a Send refusal folds
 * into the never-throw error envelope; `variables.get` and `vault.get`
 * read the EXECUTION's variable scope the broker hands in (a vault
 * entry answers as `{{vault.ref}}` would, anything else reads as an
 * OAuth credentialRef), and a run without one reads the active
 * workspace's mirrors — a string secret then answers without touching
 * the token store. The OAuth refresh leg over the seam's transport and
 * the write path are pinned by the node host's composition.
 */

import type { ScriptHostRequest, ScriptVariableScope } from '@openheaders/core/scripts';
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
  getWorkspaceVariables: () => ({
    schemaVersion: 5,
    variables: [{ uid: 'var00001', name: 'region', value: 'eu', type: 'default' }],
  }),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => h.tokenBundle(...args),
  getRefreshConfig: async () => null,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({ getRequestCollections: () => [] }));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({ getCollections: () => [] }));
vi.mock('@openheaders/oracle/entity/template-store', () => ({ getTemplateCollections: () => [] }));
vi.mock('@openheaders/oracle/entity/files-store', () => ({ listFiles: async () => [] }));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({ getLiveRegistrySnapshot: () => new Map() }));

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

  it("variables.get and vault.get read the execution's scope — the send's own resolution", async () => {
    const reads: string[] = [];
    const scope: ScriptVariableScope = {
      readVariable: async (reference) => {
        reads.push(reference);
        return reference === 'collection.BASE'
          ? 'https://api.openheaders.io'
          : reference === 'vault.otp'
            ? '492817'
            : null;
      },
    };
    const handle = createScriptHostRequestHandler(seam);
    expect(await handle({ ...envelope, op: 'variables.get', name: 'collection.BASE' }, scope)).toMatchObject({
      value: 'https://api.openheaders.io',
    });
    expect(await handle({ ...envelope, op: 'vault.get', ref: 'otp' }, scope)).toMatchObject({ value: '492817' });
    expect(h.tokenBundle).not.toHaveBeenCalled();
    // A ref no vault entry answers reads as an OAuth credentialRef.
    h.tokenBundle.mockResolvedValueOnce({ accessToken: 'at-1', tokenType: 'Bearer', obtainedAt: 1 });
    expect(await handle({ ...envelope, op: 'vault.get', ref: 'github-oauth' }, scope)).toMatchObject({ value: 'at-1' });
    expect(reads).toEqual(['collection.BASE', 'vault.otp', 'vault.github-oauth']);
  });

  it("a run without a scope reads the active workspace's mirrors — the full walk, a miss answers null", async () => {
    const handle = createScriptHostRequestHandler(seam);
    expect(await handle({ ...envelope, op: 'variables.get', name: 'region' })).toMatchObject({ value: 'eu' });
    expect(await handle({ ...envelope, op: 'variables.get', name: 'workspace.region' })).toMatchObject({ value: 'eu' });
    expect(await handle({ ...envelope, op: 'variables.get', name: 'nope' })).toMatchObject({ value: null });
    expect(await handle({ ...envelope, op: 'variables.get', name: 'step.s1.id' })).toMatchObject({ value: null });
  });
});
