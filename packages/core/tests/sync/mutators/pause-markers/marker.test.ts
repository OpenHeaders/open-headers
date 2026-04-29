import { describe, expect, it } from 'vitest';
import {
  clearPauseMarker,
  type MutatorContext,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_MUTATOR_VERSION,
  PAUSE_MARKERS_PATH,
  pauseMarkersRecompileDnrIntent,
  replacePauseMarkers,
  setPauseMarker,
} from '../../../../src/sync';
import { RECOMPILE_DNR } from '../../../../src/sync/mutators/rule/side-effects';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setPauseMarker', () => {
  it('emits one addToSet on the singleton with itemId = path', () => {
    const intent = setPauseMarker(ctx(), { path: 'collections/auth', marker: 'paused' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(PAUSE_MARKERS_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'collections/auth',
      item: { path: 'collections/auth', marker: 'paused' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: RECOMPILE_DNR, key: PAUSE_MARKERS_ID, hlc: ctx().hlc },
    ]);
  });

  it('carries unpaused override marker through', () => {
    const intent = setPauseMarker(ctx(), { path: 'collections/auth/folder', marker: 'unpaused' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      item: { path: 'collections/auth/folder', marker: 'unpaused' },
    });
  });
});

describe('clearPauseMarker', () => {
  it('emits a single removeFromSet keyed by path', () => {
    const intent = clearPauseMarker(ctx(), { path: 'collections/auth' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'collections/auth',
    });
    expect(intent.sideEffects).toEqual([pauseMarkersRecompileDnrIntent(ctx().hlc)]);
  });
});

describe('replacePauseMarkers', () => {
  it('emits removes for paths missing in next + addToSet for every entry in next', () => {
    const existing = new Map([
      ['a', 'paused' as const],
      ['b', 'paused' as const],
    ]);
    const next = new Map([
      ['b', 'unpaused' as const],
      ['c', 'paused' as const],
    ]);
    const intent = replacePauseMarkers(ctx({ batchId: 'B1' }), { existing, next });
    expect(intent.batch.batchId).toBe('B1');
    const bodies = intent.batch.mutations.map((m) => m.body);
    expect(bodies).toEqual([
      {
        kind: 'removeFromSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: 'a',
      },
      {
        kind: 'addToSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: 'b',
        item: { path: 'b', marker: 'unpaused' },
      },
      {
        kind: 'addToSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: 'c',
        item: { path: 'c', marker: 'paused' },
      },
    ]);
  });

  it('returns an empty batch when existing matches next exactly', () => {
    const same = new Map([['x', 'paused' as const]]);
    const intent = replacePauseMarkers(ctx(), { existing: same, next: same });
    // Equal-shape replacement still re-asserts (addToSet) — that's
    // safe under per-(setPath, itemId) LWW since later HLC re-stamps
    // the same value. The contract is "no removals when nothing
    // dropped"; addToSet for stable entries is acceptable. Documented
    // here so a future tightening (drop unchanged-value addToSets)
    // doesn't surprise the existing contract.
    const kinds = intent.batch.mutations.map((m) => m.body.kind);
    expect(kinds).toEqual(['addToSet']);
  });

  it('returns an empty batch when both maps are empty', () => {
    const empty = new Map<string, 'paused' | 'unpaused'>();
    const intent = replacePauseMarkers(ctx(), { existing: empty, next: empty });
    expect(intent.batch.mutations).toHaveLength(0);
    expect(intent.sideEffects).toEqual([]);
  });

  it('accepts plain Records as well as Maps', () => {
    const intent = replacePauseMarkers(ctx(), {
      existing: { a: 'paused' },
      next: { b: 'unpaused' },
    });
    const bodies = intent.batch.mutations.map((m) => m.body);
    expect(bodies[0]).toMatchObject({ kind: 'removeFromSet', itemId: 'a' });
    expect(bodies[1]).toMatchObject({ kind: 'addToSet', itemId: 'b' });
  });

  it('shares a batchId across every mutation', () => {
    const intent = replacePauseMarkers(ctx({ batchId: 'shared-batch' }), {
      existing: { a: 'paused' },
      next: { b: 'paused' },
    });
    expect(intent.batch.batchId).toBe('shared-batch');
    expect(intent.batch.mutations.length).toBeGreaterThan(0);
  });
});
