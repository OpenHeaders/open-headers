/**
 * Renderer-side write client for OAuth-bundle revoke.
 *
 * The OAuth bundle is a singleton entity (`OAUTH_BUNDLE_ID = 'oauth'`)
 * hosting three parallel sets keyed by credentialRef: `tokens`,
 * `configs`, `refreshErrors`. Revoke is the only renderer-direct
 * helper (authorize / clientCredentials / refresh stay on bridge RPCs
 * because they need SW-resident browser-mediated auth APIs). We
 * verify that revoke fans out a `removeFromSet` envelope at each of
 * the three set paths under one batch — the atomic-across-three-maps
 * invariant the §9.2 tombstone TTL relies on.
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_TOKENS_PATH,
} from '@openheaders/core/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(() => () => undefined),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyOAuthRevoke } from '@openheaders/ui/shared/sync/oauth-bundle-write-client';
import type { RendererContextHandle } from '@openheaders/ui/context';

function makeContextHandle(workspaceId = 'ws-1', surfaceId = 'workbench'): RendererContextHandle {
  let hlc = initialHlc(`${surfaceId}-test`, 0);
  return {
    nodeId: `${surfaceId}-test`,
    surfaceId,
    workspaceId,
    peekHlc: () => hlc,
    next: (opts = {}) => {
      hlc = advanceHlc(hlc, hlc.physicalMs + 1, opts.observed);
      const ctx: MutatorContext = {
        workspaceId,
        hlc,
        surfaceId: opts.surfaceId ?? surfaceId,
        deviceId: `${surfaceId}-test`,
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
      };
      return ctx;
    },
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyOAuthRevoke', () => {
  it('emits three removeFromSet envelopes (tokens / configs / refreshErrors) keyed by credentialRef under one batch', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyOAuthRevoke(
      { credentialRef: 'auth-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(3);
    const removes = batch.mutations.filter((m) => m.body.kind === 'removeFromSet');
    expect(removes).toHaveLength(3);
    for (const env of removes) {
      expect(env.body).toMatchObject({
        type: OAUTH_BUNDLE_ENTITY_TYPE,
        id: OAUTH_BUNDLE_ID,
        itemId: 'auth-1',
      });
    }
    const paths = removes.map((m) => (m.body as { path: string }).path).sort();
    expect(paths).toContain(OAUTH_TOKENS_PATH);
    expect(paths.length).toBe(3);
  });
});
