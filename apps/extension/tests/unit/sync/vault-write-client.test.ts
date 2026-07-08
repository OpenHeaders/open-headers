/**
 * Renderer-side write client for Vault mutations.
 *
 * The vault is a singleton entity (`VAULT_ID` = 'vault') hosting the
 * `secrets` set. Identity is `secret.uid`; secrets come in two kinds
 * ('string' value records, 'totp' seed records). We verify:
 *   - secretSet emits an addToSet envelope at the secrets set path
 *     keyed by secret.uid, carrying the whole record (kind included)
 *   - secretRemove emits a removeFromSet envelope keyed by uid
 *   - replacement folds add / edit / remove / reorder into one batch
 *     keyed by uid; structurally-identical entries are skipped;
 *     empty-name entries are dropped
 *   - the apply pipe never sends a snapshot to the bridge for an
 *     empty diff (no INVALIDATE_RESOLVER spam on no-op saves)
 */

import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import { advanceHlc, initialHlc, VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH } from '@openheaders/core/sync';
import type { VaultSecret } from '@openheaders/core/types';
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

import type { RendererContextHandle } from '@openheaders/ui/context';
import type { VaultSyncMirror } from '@openheaders/ui/shared/sync/vault-write-client';
import {
  applyVaultReplacement,
  applyVaultSecretRemove,
  applyVaultSecretSet,
} from '@openheaders/ui/shared/sync/vault-write-client';

/** Minimal VaultSyncMirror stub — supplies the current per-uid order keys
 *  the replacement helper reads to preserve row position. Keys are a
 *  monotonic single-char sequence in the given uid order. */
function mockMirror(orderedUids: readonly string[]): VaultSyncMirror {
  const entries = orderedUids.map((uid, i) => ({ itemId: uid, orderKey: String.fromCharCode(0x6d + i) }));
  return {
    hydrated: Promise.resolve(),
    liveSecretOrderKeys: () => entries,
    getMirror: () => null,
    liveSecretNames: () => [],
    subscribeMirror: () => () => undefined,
    dispose: () => undefined,
  };
}

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

function stringSecret(uid: string, name: string, value: string): VaultSecret {
  return { uid, kind: 'string', name, value };
}

function totpSecret(uid: string, name: string, seed: string): VaultSecret {
  return {
    uid,
    kind: 'totp',
    name,
    seed,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyVaultSecretSet', () => {
  it('emits an addToSet envelope at the vault secrets set path keyed by secret.uid (string kind)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const secret = stringSecret('s1', 'API_KEY', 'abc');
    const result = await applyVaultSecretSet(
      { secret },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 's1',
    });
    const item = (batch.mutations[0].body as { item: VaultSecret }).item;
    expect(item.kind).toBe('string');
  });

  it('preserves totp-specific fields on the addToSet item for totp-kind secrets', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const secret = totpSecret('s2', 'GITHUB_TOTP', 'JBSWY3DPEHPK3PXP');
    await applyVaultSecretSet(
      { secret },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const item = (batch.mutations[0].body as { item: VaultSecret }).item;
    expect(item).toMatchObject({ kind: 'totp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 });
  });
});

describe('applyVaultSecretRemove', () => {
  it('emits a removeFromSet envelope keyed by uid (not name)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyVaultSecretRemove(
      { uid: 's1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 's1',
    });
  });
});

describe('applyVaultReplacement', () => {
  it('byte-identical lists short-circuit to ok without firing the bridge', async () => {
    const secrets = [stringSecret('s1', 'API_KEY', 'abc')];
    const result = await applyVaultReplacement(secrets, secrets, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['s1']),
    });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one INVALIDATE_RESOLVER side-effect on a non-empty diff', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyVaultReplacement([stringSecret('s1', 'API_KEY', 'abc')], [], {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror([]),
    });
    const payload = mockCall.mock.calls[0][1] as { batch: MutationBatch; sideEffects: SideEffectIntent[] };
    expect(payload.sideEffects).toHaveLength(1);
  });

  it('emits removeFromSet per vanished uid + addToSet per added/edited uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldSecrets = [
      stringSecret('s1', 'KEEP', 'keep'),
      stringSecret('s2', 'GONE', 'gone'),
      stringSecret('s3', 'RENAMED', 'val'),
    ];
    const newSecrets = [
      stringSecret('s1', 'KEEP', 'keep'),
      stringSecret('s3', 'NEW_NAME', 'val'),
      stringSecret('s4', 'NEW', 'fresh'),
    ];
    const result = await applyVaultReplacement(newSecrets, oldSecrets, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['s1', 's2', 's3']),
    });
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const removes = batch.mutations.filter((m) => m.body.kind === 'removeFromSet');
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(removes.map((m) => (m.body as { itemId: string }).itemId)).toEqual(['s2']);
    expect(adds.map((m) => (m.body as { itemId: string }).itemId).sort()).toEqual(['s3', 's4']);
  });

  it('treats a kind transition (string → totp at same uid) as an edit, not remove+add', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldSecrets = [stringSecret('s1', 'TWOFA', 'placeholder')];
    const newSecrets = [totpSecret('s1', 'TWOFA', 'JBSWY3DPEHPK3PXP')];
    await applyVaultReplacement(newSecrets, oldSecrets, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['s1']),
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'addToSet', itemId: 's1' });
    const item = (batch.mutations[0].body as { item: VaultSecret }).item;
    expect(item.kind).toBe('totp');
  });

  it('a content edit re-emits the row with its EXISTING orderKey (position preserved)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const oldSecrets = [stringSecret('s1', 'A', 'a'), stringSecret('s2', 'B', 'b')];
    const newSecrets = [stringSecret('s1', 'A', 'a2'), stringSecret('s2', 'B', 'b')]; // edit s1's value only
    await applyVaultReplacement(newSecrets, oldSecrets, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['s1', 's2']), // s1='m', s2='n'
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const adds = batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds).toHaveLength(1);
    expect(adds[0].body).toMatchObject({ itemId: 's1', orderKey: 'm' });
  });

  it('a pure reorder emits a single moveBefore (LIS-optimal) — materialized key order follows the editor', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const rows = (order: string[]) => order.map((u) => stringSecret(u, u.toUpperCase(), u));
    const oldSecrets = rows(['s1', 's2', 's3']);
    const newSecrets = rows(['s3', 's1', 's2']); // drag s3 to the top
    await applyVaultReplacement(newSecrets, oldSecrets, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror(['s1', 's2', 's3']), // s1='m' < s2='n' < s3='o'
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    // s1+s2 form the LIS and stay put — only the dragged row moves.
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'moveBefore', itemId: 's3' });
    const finalKeys = new Map<string, string>([
      ['s1', 'm'],
      ['s2', 'n'],
      ['s3', (batch.mutations[0].body as { orderKey: string }).orderKey],
    ]);
    const materialized = [...finalKeys.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([uid]) => uid);
    expect(materialized).toEqual(['s3', 's1', 's2']);
  });

  it('drops new entries whose trimmed name is empty', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyVaultReplacement([stringSecret('s-blank', '   ', 'value'), stringSecret('s-keep', 'OK', 'value')], [], {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      context: makeContextHandle(),
      mirror: mockMirror([]),
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const ids = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => (m.body as { itemId: string }).itemId);
    expect(ids).toEqual(['s-keep']);
  });
});
