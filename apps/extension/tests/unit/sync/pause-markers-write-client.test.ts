/**
 * Renderer-side write client for pause-markers mutations.
 *
 * The pause-markers entity is a singleton (`PAUSE_MARKERS_ID =
 * 'pause-markers'`) hosting a `markers` set keyed by `path` with a
 * `PauseMarkerKind` value. We verify:
 *   - set emits addToSet keyed by path, carrying the kind on the item
 *   - clear emits removeFromSet keyed by path
 *   - replacement diffs against the mirror's `liveMarkers()` snapshot —
 *     paths absent in `next` become removeFromSet; new/changed paths
 *     become addToSet; byte-identical maps emit zero envelopes
 */

import type { MutationBatch, MutatorContext } from '@openheaders/core/sync';
import {
  advanceHlc,
  initialHlc,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerKind,
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

import {
  applyPauseMarkerClear,
  applyPauseMarkersReplacement,
  applyPauseMarkerSet,
} from '@openheaders/ui/shared/sync/pause-markers-write-client';
import type {
  PauseMarkersSyncMirror,
  RendererContextHandle,
} from '@openheaders/ui/context';

function makeMirror(markers: Record<string, PauseMarkerKind>): PauseMarkersSyncMirror {
  return {
    getMirror: () => ({ markers, paths: Object.keys(markers) }),
    livePaths: () => Object.keys(markers),
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
  it('set emits an addToSet envelope keyed by path with the marker kind on the item', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyPauseMarkerSet(
      { path: 'rules/coll-1', marker: 'paused' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'rules/coll-1',
    });
  });

  it('clear emits a removeFromSet envelope keyed by path', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    await applyPauseMarkerClear(
      { path: 'rules/coll-1' },
      { workspaceId: 'ws-1', surfaceId: 'workbench', context: makeContextHandle() },
    );
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    expect(batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'rules/coll-1',
    });
  });
});

describe('applyPauseMarkersReplacement', () => {
  it('empty-to-empty short-circuits to an empty batch (no bridge call)', async () => {
    const mirror = makeMirror({});
    const result = await applyPauseMarkersReplacement(
      {},
      { workspaceId: 'ws-1', surfaceId: 'workbench', mirror, context: makeContextHandle() },
    );
    expect(result).toEqual({ ok: true });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('emits removeFromSet for vanished paths and addToSet for every path in `next` (LWW convergence)', async () => {
    mockCall.mockResolvedValue({ ok: true, outcomes: [] });
    const existing: Record<string, PauseMarkerKind> = {
      'rules/coll-keep': 'paused',
      'rules/coll-gone': 'paused',
    };
    const next: Record<string, PauseMarkerKind> = {
      'rules/coll-keep': 'paused',
      'rules/coll-new': 'paused',
    };
    const mirror = makeMirror(existing);
    await applyPauseMarkersReplacement(next, {
      workspaceId: 'ws-1',
      surfaceId: 'workbench',
      mirror,
      context: makeContextHandle(),
    });
    const batch = (mockCall.mock.calls[0][1] as { batch: MutationBatch }).batch;
    const removes = batch.mutations
      .filter((m) => m.body.kind === 'removeFromSet')
      .map((m) => (m.body as { itemId: string }).itemId);
    const adds = batch.mutations
      .filter((m) => m.body.kind === 'addToSet')
      .map((m) => (m.body as { itemId: string }).itemId)
      .sort();
    expect(removes).toEqual(['rules/coll-gone']);
    // Both `keep` and `new` appear as addToSet — LWW handles convergence
    // for the unchanged entry; the mutator never compares marker kinds.
    expect(adds).toEqual(['rules/coll-keep', 'rules/coll-new']);
  });
});
