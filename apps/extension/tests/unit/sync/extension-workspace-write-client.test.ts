/**
 * Renderer-side write client for ExtensionWorkspace mutations.
 *
 * The global oracle scope means every helper threads
 * `ensureGlobalRendererContext` and resolves the active extension-
 * workspace mirror for orderKey + active-pointer lookups. We verify:
 *   - create emits one addToSet envelope at the workspaces set path,
 *     with a generated id and a tail order key, and trims the name
 *   - update / rename short-circuit to `not-found` when the id is
 *     absent in the mirror
 *   - delete refuses last-workspace deletion (the list cannot shrink
 *     below one), short-circuits on missing ids, and bundles a
 *     setActive(neighbour) in the same batchId when the active id is
 *     the deletion target
 *   - setActive short-circuits to ok when the id is already active
 *   - reorder is a no-op when no ids match the live list
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACES_SET_PATH,
  initialHlc,
} from '@openheaders/core/sync';
import type { ExtensionWorkspace } from '@openheaders/core/types';
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

import type { ExtensionWorkspaceSyncMirror, RendererContextHandle } from '@openheaders/ui/context';
import {
  applyCreateWorkspace,
  applyDeleteWorkspace,
  applyRenameWorkspace,
  applyReorderWorkspaces,
  applySetActiveWorkspace,
  applyUpdateWorkspace,
} from '@openheaders/ui/shared/sync/extension-workspace-write-client';

function makeWorkspace(id: string, sortIndex: number, overrides: Partial<ExtensionWorkspace> = {}): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'personal',
    name: `Workspace ${id}`,
    orgId: 'org-test',
    sortIndex,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMirror(
  workspaces: ExtensionWorkspace[],
  activeWorkspaceId: string | null,
  orderKeys: Record<string, string> = {},
): ExtensionWorkspaceSyncMirror {
  const keys: Record<string, string> =
    Object.keys(orderKeys).length > 0
      ? orderKeys
      : Object.fromEntries(workspaces.map((w, i) => [w.id, `m${i.toString().padStart(2, '0')}`]));
  return {
    getMirror: () => ({ workspaces, activeWorkspaceId, orderKeys: keys }),
    liveWorkspaces: () => workspaces,
    liveActiveWorkspaceId: () => activeWorkspaceId,
    liveOrderKey: (id) => keys[id],
    subscribeMirror: () => () => undefined,
    hydrated: Promise.resolve(),
    dispose: () => undefined,
  };
}

function makeContextHandle(surfaceId = 'workspace-meta'): RendererContextHandle {
  let hlc = initialHlc(`${surfaceId}-test`, 0);
  return {
    nodeId: `${surfaceId}-test`,
    surfaceId,
    // Global-scope writes still carry a workspaceId on the handle; the
    // sequencer key uses it but the emitted envelopes target the
    // EXTENSION_WORKSPACE_GLOBAL_SCOPE via the mutator's hard-coded id.
    workspaceId: '__global__',
    peekHlc: () => hlc,
    next: (opts = {}) => {
      hlc = advanceHlc(hlc, hlc.physicalMs + 1, opts.observed);
      const ctx: MutatorContext = {
        workspaceId: '__global__',
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

describe('applyCreateWorkspace', () => {
  it('emits an addToSet envelope at the workspaces set path with the seeded slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeWorkspace('ws-existing', 0)], 'ws-existing');
    const result = await applyCreateWorkspace(
      { name: '  New Workspace  ', color: 'blue' },
      { surfaceId: 'popup', mirror, context: makeContextHandle('popup') },
    );
    expect(result.ok).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(1);
    const [type, payload] = mockCall.mock.calls[0];
    expect(type).toBe('oh.sync.apply');
    const batch = (payload as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({
      kind: 'addToSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      path: EXTENSION_WORKSPACES_SET_PATH,
    });
    const slot = (body as { item: { id: string; name: string; color?: string } }).item;
    // Trims whitespace; preserves the rest verbatim.
    expect(slot.name).toBe('New Workspace');
    expect(slot.color).toBe('blue');
    // The result surfaces the newly minted workspace, with the same id
    // the envelope carries (so the caller can navigate without waiting
    // for the broadcast round-trip).
    expect(result.ok && result.workspace.id).toBe(slot.id);
    expect(result.ok && result.workspace.kind).toBe('personal');
  });

  it('falls back to "Untitled Workspace" when the trimmed name is empty', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([], null);
    const result = await applyCreateWorkspace(
      { name: '   ' },
      { surfaceId: 'popup', mirror, context: makeContextHandle('popup') },
    );
    expect(result.ok).toBe(true);
    const body = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch.mutations[0].body;
    const slot = (body as { item: { name: string } }).item;
    expect(slot.name).toBe('Untitled Workspace');
  });
});

describe('applyUpdateWorkspace / applyRenameWorkspace', () => {
  it('returns not-found and does not fire the bridge when the id is absent', async () => {
    const mirror = makeMirror([makeWorkspace('ws-a', 0)], 'ws-a');
    const result = await applyUpdateWorkspace(
      { id: 'missing', updates: { name: 'X' } },
      { surfaceId: 'popup', mirror, context: makeContextHandle('popup') },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('rename preserves createdAt + advances updatedAt and re-emits the slot at its current order key', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const existing = makeWorkspace('ws-a', 0, {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const mirror = makeMirror([existing], 'ws-a', { 'ws-a': 'm00' });
    const result = await applyRenameWorkspace(
      { id: 'ws-a', name: 'Renamed' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result.ok).toBe(true);
    const body = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'addToSet', orderKey: 'm00' });
    const slot = (body as { item: { name: string; createdAt: string; updatedAt: string } }).item;
    expect(slot.name).toBe('Renamed');
    expect(slot.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(slot.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('icon=null clears the icon on the emitted slot', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const existing = makeWorkspace('ws-a', 0, { icon: 'star' });
    const mirror = makeMirror([existing], 'ws-a');
    await applyUpdateWorkspace(
      { id: 'ws-a', updates: { icon: null } },
      { surfaceId: 'popup', mirror, context: makeContextHandle('popup') },
    );
    const body = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch.mutations[0].body;
    const slot = (body as { item: { icon?: string } }).item;
    expect(slot.icon).toBeUndefined();
  });

  it('preserves the org binding across every update — workspaces are immutable in their Org', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const existing = makeWorkspace('ws-a', 0, { orgId: 'org-old' });
    const mirror = makeMirror([existing], 'ws-a');
    await applyUpdateWorkspace(
      { id: 'ws-a', updates: { name: 'Renamed' } },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    const body = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch.mutations[0].body;
    const slot = (body as { item: { orgId: string } }).item;
    expect(slot.orgId).toBe('org-old');
  });
});

describe('applyDeleteWorkspace', () => {
  it('rejects last-workspace deletion without firing the bridge', async () => {
    const mirror = makeMirror([makeWorkspace('ws-only', 0)], 'ws-only');
    const result = await applyDeleteWorkspace(
      { id: 'ws-only' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: false, reason: 'last-workspace' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('returns not-found when the id is absent from the live list', async () => {
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1)], 'ws-a');
    const result = await applyDeleteWorkspace(
      { id: 'missing' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('bundles removeFromSet + setActive(neighbour) under the same batchId when deleting the active workspace', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1), makeWorkspace('ws-c', 2)], 'ws-b');
    const result = await applyDeleteWorkspace(
      { id: 'ws-b' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.activeWorkspaceId).toBe('ws-a');
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(2);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'removeFromSet', itemId: 'ws-b' });
    expect(batch.mutations[1].body).toMatchObject({ kind: 'setField', path: 'activeId', value: 'ws-a' });
    // Per-batch all-or-nothing: both envelopes land under one batchId
    // (structurally guaranteed by living inside a single MutationBatch),
    // so observers never see the active pointer aimed at the deleted id.
    expect(typeof batch.batchId).toBe('string');
  });

  it('emits a single removeFromSet when deleting a non-active workspace', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1)], 'ws-a');
    const result = await applyDeleteWorkspace(
      { id: 'ws-b' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.activeWorkspaceId).toBe('ws-a');
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({ kind: 'removeFromSet', itemId: 'ws-b' });
  });
});

describe('applySetActiveWorkspace', () => {
  it('returns not-found and does not fire the bridge when the id is absent', async () => {
    const mirror = makeMirror([makeWorkspace('ws-a', 0)], 'ws-a');
    const result = await applySetActiveWorkspace(
      { id: 'missing' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('short-circuits to ok without firing the bridge when the id is already active', async () => {
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1)], 'ws-a');
    const result = await applySetActiveWorkspace(
      { id: 'ws-a' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits one setField(activeWorkspaceId) envelope when flipping to a different workspace', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1)], 'ws-a');
    const result = await applySetActiveWorkspace(
      { id: 'ws-b' },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'activeId',
      value: 'ws-b',
    });
  });
});

describe('applyReorderWorkspaces', () => {
  it('is a no-op when the input list contains no live ids', async () => {
    const mirror = makeMirror([], null);
    const result = await applyReorderWorkspaces(
      { idOrder: ['missing-1', 'missing-2'] },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits a moveBefore per workspace in the resolved final order (desired first, then missing appended)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([makeWorkspace('ws-a', 0), makeWorkspace('ws-b', 1), makeWorkspace('ws-c', 2)], 'ws-a');
    const result = await applyReorderWorkspaces(
      // Caller asked for c,a — b should land at the tail.
      { idOrder: ['ws-c', 'ws-a'] },
      { surfaceId: 'workbench', mirror, context: makeContextHandle('workbench') },
    );
    expect(result).toEqual({ ok: true });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations).toHaveLength(3);
    const itemIds = batch.mutations.map((m) => (m.body as { itemId: string }).itemId);
    expect(itemIds).toEqual(['ws-c', 'ws-a', 'ws-b']);
    for (const env of batch.mutations) {
      expect(env.body.kind).toBe('moveBefore');
    }
  });
});
