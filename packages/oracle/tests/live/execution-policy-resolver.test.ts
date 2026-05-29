/**
 * WS-C C9 — fire-time execution-policy assembler.
 *
 * `deriveExecutionPolicyForWorkflow` is thin glue: it pulls the vault,
 * requests, and env/workspace/collection variable scope from the oracle
 * entity stores for a `(workspace, env)` and hands them to the *real* pure
 * classifier `deriveExecutionPolicy` (unmocked here). These tests pin the
 * wiring — the right store reads, the env-by-id lookup, the scope shape —
 * by checking the end-to-end verdict on TOTP / indirection / OAuth inputs.
 * The classifier's own taint/dedup internals are covered in core.
 */

import type { Collection, Environment, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stores = {
  vault: { schemaVersion: 5, secrets: [] } as Vault,
  environments: [] as Environment[],
  workspaceVars: { schemaVersion: 5, variables: [] } as WorkspaceVariables,
  collections: [] as Collection[],
  requests: new Map<string, Request>(),
};

vi.mock('../../src/entity/environment-store', () => ({
  getVaultForWorkspace: () => stores.vault,
  getEnvironmentsForWorkspace: () => stores.environments,
  getWorkspaceVariablesForWorkspace: () => stores.workspaceVars,
}));

vi.mock('../../src/entity/request-store', () => ({
  getRequestInWorkspace: (uid: string) => stores.requests.get(uid) ?? null,
  getRequestCollectionsForWorkspace: () => stores.collections,
}));

import { deriveExecutionPolicyForWorkflow } from '../../src/live/execution-policy-resolver';

const WS = 'ws-1';

function makeRequest(over: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req-1',
    path: 'requests/req-1',
    name: 'Call API',
    method: 'GET',
    url: 'https://api.openheaders.io/resource',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...over,
  };
}

function workflowWith(...requestUids: string[]) {
  return {
    schemaVersion: 5 as const,
    uid: 'wf-1',
    path: 'live-workflows/wf-1',
    name: 'WF',
    enabled: true,
    published: true,
    refresh: { kind: 'manual' as const },
    steps: requestUids.map((requestUid, i) => ({
      uid: `step-${i}`,
      id: `s${i}`,
      requestUid,
      captures: [],
    })),
  };
}

const TOTP_SECRET = {
  uid: 'sec-otp',
  kind: 'totp' as const,
  name: 'otp',
  seed: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1' as const,
  digits: 6,
  period: 30,
};

beforeEach(() => {
  stores.vault = { schemaVersion: 5, secrets: [] };
  stores.environments = [];
  stores.workspaceVars = { schemaVersion: 5, variables: [] };
  stores.collections = [];
  stores.requests = new Map();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('deriveExecutionPolicyForWorkflow', () => {
  it('idempotent when no exclusive signal is present', () => {
    stores.requests.set('req-1', makeRequest());
    const result = deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), null);
    expect(result.policy).toBe('idempotent');
    expect(result.reasons).toEqual([]);
  });

  it('exclusive when a step references a TOTP vault entry directly', () => {
    stores.vault = { schemaVersion: 5, secrets: [TOTP_SECRET] };
    stores.requests.set(
      'req-1',
      makeRequest({ headers: [{ uid: 'h1', key: 'X-OTP', value: '{{vault.otp}}', enabled: true }] }),
    );
    const result = deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), null);
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toContainEqual({ kind: 'totp', vaultName: 'otp' });
  });

  it('exclusive via env-var indirection — and only for the firing environment', () => {
    stores.vault = { schemaVersion: 5, secrets: [TOTP_SECRET] };
    // env-A taints `code` from the TOTP entry; env-B leaves it clean.
    stores.environments = [
      {
        schemaVersion: 5,
        uid: 'env-A',
        name: 'A',
        variables: [{ uid: 'v-a', name: 'code', value: '{{vault.otp}}', type: 'default' }],
      },
      {
        schemaVersion: 5,
        uid: 'env-B',
        name: 'B',
        variables: [{ uid: 'v-b', name: 'code', value: 'static', type: 'default' }],
      },
    ];
    stores.requests.set(
      'req-1',
      makeRequest({ headers: [{ uid: 'h2', key: 'X-Code', value: '{{env.code}}', enabled: true }] }),
    );

    const inA = deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), 'env-A');
    expect(inA.policy).toBe('exclusive');
    expect(inA.reasons).toContainEqual({ kind: 'totp', vaultName: 'otp', indirectVia: 'code' });

    // Firing env-B (or "No environment") sees no taint → idempotent.
    expect(deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), 'env-B').policy).toBe('idempotent');
    expect(deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), null).policy).toBe('idempotent');
  });

  it('exclusive for a rotating-OAuth (refresh-token) flow', () => {
    stores.requests.set(
      'req-1',
      makeRequest({
        auth: {
          type: 'oauth2',
          flow: 'authorization-code-pkce',
          credentialRef: 'cred-1',
          tokenEndpoint: 'https://auth.openheaders.io/token',
          clientId: 'client-1',
          scopes: ['read'],
        },
      }),
    );
    const result = deriveExecutionPolicyForWorkflow(WS, workflowWith('req-1'), null);
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toContainEqual({
      kind: 'rotating-oauth',
      credentialRef: 'cred-1',
      flow: 'authorization-code-pkce',
    });
  });

  it('skips a step whose request is not resident (no signal contributed)', () => {
    stores.vault = { schemaVersion: 5, secrets: [TOTP_SECRET] };
    // req-missing isn't in the store; req-1 is plain.
    stores.requests.set('req-1', makeRequest());
    const result = deriveExecutionPolicyForWorkflow(WS, workflowWith('req-missing', 'req-1'), null);
    expect(result.policy).toBe('idempotent');
  });
});
