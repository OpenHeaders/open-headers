/**
 * Renderer-side write client for trusted-roots mutations.
 *
 * The trusted-roots entity is a singleton (`TRUSTED_ROOTS_ID`) hosting
 * a `roots` set keyed by the row uid. We verify:
 *   - add mints a uid + `addedAt` and emits addToSet carrying the WHOLE
 *     row (name + certPem) keyed by that uid — a chain stays one item
 *   - remove emits removeFromSet keyed by uid
 *   - the replacement (the editor's Save) diffs draft vs canonical
 *     into ONE batch — addToSet for new and renamed rows, removeFromSet
 *     for dropped ones, nothing for an unchanged row, no fire on an
 *     identical list
 *   - a bridge failure collapses to the `other` arm with its detail
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  TRUSTED_ROOTS_ENTITY_TYPE,
  TRUSTED_ROOTS_ID,
  TRUSTED_ROOTS_PATH,
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

import type { TrustedRoot } from '@openheaders/core/types';
import type { RendererContextHandle } from '@openheaders/ui/context';
import type { TrustedRootsSyncMirror } from '@openheaders/ui/context/mirrors/trusted-roots-sync-mirror';
import {
  applyTrustedRootAdd,
  applyTrustedRootRemove,
  applyTrustedRootsReplacement,
} from '@openheaders/ui/shared/sync/trusted-roots-write-client';

const CHAIN_PEM =
  '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----\n';

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

const OPTS = { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() };

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyTrustedRootAdd', () => {
  it('mints the row and emits one addToSet carrying the whole record keyed by its uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyTrustedRootAdd({ name: 'Internal Root CA', certPem: CHAIN_PEM }, OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.root.uid).toBeTruthy();
    expect(result.root.name).toBe('Internal Root CA');
    expect(result.root.certPem).toBe(CHAIN_PEM);
    expect(Number.isNaN(Date.parse(result.root.addedAt))).toBe(false);

    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: result.root.uid,
      item: result.root,
    });
  });

  it('collapses a bridge failure onto the other arm with its detail', async () => {
    mockCall.mockResolvedValue({ ok: false, failure: { detail: 'store unavailable' } });
    const result = await applyTrustedRootAdd({ name: 'x', certPem: CHAIN_PEM }, OPTS);
    expect(result).toEqual({ ok: false, reason: 'other', message: 'store unavailable' });
  });
});

describe('applyTrustedRootRemove', () => {
  it('emits removeFromSet keyed by uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const result = await applyTrustedRootRemove({ uid: 'root-1' }, OPTS);
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: TRUSTED_ROOTS_ENTITY_TYPE,
      id: TRUSTED_ROOTS_ID,
      path: TRUSTED_ROOTS_PATH,
      itemId: 'root-1',
    });
  });
});

function makeRoot(uid: string, name = `Root ${uid}`): TrustedRoot {
  return { uid, name, certPem: CHAIN_PEM, addedAt: '2026-08-27T00:00:00.000Z' };
}

function makeMirror(orderKeys: Array<{ itemId: string; orderKey: string }>): TrustedRootsSyncMirror {
  return {
    getMirror: () => null,
    liveRoots: () => [],
    liveRootOrderKeys: () => orderKeys,
    subscribeMirror: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

describe('applyTrustedRootsReplacement', () => {
  const mirror = makeMirror([
    { itemId: 'r1', orderKey: 'a0' },
    { itemId: 'r2', orderKey: 'a1' },
  ]);

  it('commits added, renamed and dropped rows as one batch and leaves an unchanged row alone', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const canonical = [makeRoot('r1'), makeRoot('r2')];
    const draft = [makeRoot('r1'), makeRoot('r3'), makeRoot('r2', 'Renamed')];
    const result = await applyTrustedRootsReplacement(draft, canonical, { ...OPTS, mirror });
    expect(result).toEqual({ ok: true });
    expect(mockCall).toHaveBeenCalledTimes(1);
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const bodies = batch.mutations.map((m) => m.body);
    expect(bodies.every((b) => b.type === TRUSTED_ROOTS_ENTITY_TYPE && b.id === TRUSTED_ROOTS_ID)).toBe(true);
    const byItem = new Map(bodies.map((b) => [('itemId' in b ? b.itemId : '') as string, b.kind]));
    expect(byItem.get('r3')).toBe('addToSet');
    expect(byItem.get('r2')).toBe('addToSet');
    expect(byItem.has('r1')).toBe(false);
  });

  it('emits removeFromSet for a dropped row', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyTrustedRootsReplacement([makeRoot('r1')], [makeRoot('r1'), makeRoot('r2')], { ...OPTS, mirror });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'removeFromSet', path: TRUSTED_ROOTS_PATH, itemId: 'r2' });
  });

  it('does not fire on an identical list', async () => {
    const same = [makeRoot('r1'), makeRoot('r2')];
    const result = await applyTrustedRootsReplacement(same, same, { ...OPTS, mirror });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
