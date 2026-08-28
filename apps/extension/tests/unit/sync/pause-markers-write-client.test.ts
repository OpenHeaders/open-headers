/**
 * Renderer-side write client for pause-markers mutations.
 *
 * The pause-markers entity is a singleton (`PAUSE_MARKERS_ID =
 * 'pause-markers'`) hosting a `markers` set keyed by the container uid
 * with the container ref + `PauseMarkerKind` on the item. We verify:
 *   - set emits addToSet keyed by uid, carrying the ref, kind and path hint
 *   - clear emits removeFromSet keyed by uid
 *   - replacement diffs against the mirror's `liveUids()` snapshot —
 *     uids absent in `next` become removeFromSet; every entry in `next`
 *     becomes addToSet; empty-to-empty emits zero envelopes
 */

import type { MutationBatch, MutatorContext, PauseMarkerEntry } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
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

import type { PauseMarkersSyncMirror, RendererContextHandle } from '@openheaders/ui/context';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
} from '@openheaders/ui/shared/sync/pause-markers-write-client';

function makeMirror(entries: PauseMarkerEntry[]): PauseMarkersSyncMirror {
  const markers = Object.fromEntries(entries.map((e) => [e.uid, e.marker]));
  return {
    getMirror: () => ({ markers, entries }),
    liveUids: () => entries.map((e) => e.uid),
    liveEntries: () => entries,
    liveMarkers: () => markers,
    subscribeMirror: () => () => undefined,
    hydrated: Promise.resolve(),
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

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyPauseMarkerSet / applyPauseMarkerClear', () => {
  it('set emits an addToSet envelope keyed by container uid with the ref, kind and path hint on the item', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyPauseMarkerSet(
      { type: 'collection', uid: 'coll-1', marker: 'paused', path: 'rules/auth-coll-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toEqual({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'coll-1',
      item: { type: 'collection', uid: 'coll-1', marker: 'paused', path: 'rules/auth-coll-1' },
    });
  });

  it('clear emits a removeFromSet envelope keyed by container uid', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyPauseMarkerClear(
      { uid: 'coll-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'coll-1',
    });
  });
});

describe('applyPauseMarkersReplacement', () => {
  it('empty-to-empty short-circuits to an empty batch (no bridge call)', async () => {
    const mirror = makeMirror([]);
    const result = await applyPauseMarkersReplacement([], {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits removeFromSet for vanished uids and addToSet for every entry in `next` (LWW convergence)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const mirror = makeMirror([
      { type: 'collection', uid: 'coll-keep', marker: 'paused' },
      { type: 'collection', uid: 'coll-gone', marker: 'paused' },
    ]);
    await applyPauseMarkersReplacement(
      [
        { type: 'collection', uid: 'coll-keep', marker: 'paused' },
        { type: 'folder', uid: 'fld-new', marker: 'paused' },
      ],
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const removes = batch.mutations
      .filter((m) => m.body.kind === 'removeFromSet')
      .map((m) => (m.body as { itemId: string }).itemId);
    const adds = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => (m.body as { itemId: string }).itemId)
      .sort();
    expect(removes).toEqual(['coll-gone']);
    // Both `keep` and `new` appear as addToSet — LWW handles convergence
    // for the unchanged entry; the mutator never compares marker kinds.
    expect(adds).toEqual(['coll-keep', 'fld-new']);
  });
});
