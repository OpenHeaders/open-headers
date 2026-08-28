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
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setPauseMarker', () => {
  it('emits one addToSet on the singleton with itemId = container uid', () => {
    const intent = setPauseMarker(ctx(), {
      type: 'collection',
      uid: 'col-auth',
      marker: 'paused',
      path: 'rules/auth-col-auth',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(PAUSE_MARKERS_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'col-auth',
      item: { type: 'collection', uid: 'col-auth', marker: 'paused', path: 'rules/auth-col-auth' },
    });
    expect(intent.sideEffects).toEqual([{ kind: RECOMPILE_DNR, key: PAUSE_MARKERS_ID, hlc: ctx().hlc }]);
  });

  it('carries an unpaused folder override through and omits an absent path hint', () => {
    const intent = setPauseMarker(ctx(), { type: 'folder', uid: 'f1', marker: 'unpaused' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'f1',
      item: { type: 'folder', uid: 'f1', marker: 'unpaused' },
    });
    expect('path' in (intent.batch.mutations[0].body as { item: object }).item).toBe(false);
  });
});

describe('clearPauseMarker', () => {
  it('emits a single removeFromSet keyed by container uid', () => {
    const intent = clearPauseMarker(ctx(), { uid: 'col-auth' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: 'col-auth',
    });
    expect(intent.sideEffects).toEqual([pauseMarkersRecompileDnrIntent(ctx().hlc)]);
  });
});

describe('replacePauseMarkers', () => {
  it('emits removes for uids missing in next + addToSet for every entry in next', () => {
    const intent = replacePauseMarkers(ctx({ batchId: 'B1' }), {
      existing: ['a', 'b'],
      next: [
        { type: 'folder', uid: 'b', marker: 'unpaused' },
        { type: 'collection', uid: 'c', marker: 'paused' },
      ],
    });
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
        item: { type: 'folder', uid: 'b', marker: 'unpaused' },
      },
      {
        kind: 'addToSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: 'c',
        item: { type: 'collection', uid: 'c', marker: 'paused' },
      },
    ]);
  });

  it('re-asserts stable entries without removals when existing matches next exactly', () => {
    const intent = replacePauseMarkers(ctx(), {
      existing: ['x'],
      next: [{ type: 'folder', uid: 'x', marker: 'paused' }],
    });
    // Equal-shape replacement still re-asserts (addToSet) — safe under
    // per-(setPath, itemId) LWW since a later HLC re-stamps the same
    // value. The contract is "no removals when nothing dropped".
    expect(intent.batch.mutations.map((m) => m.body.kind)).toEqual(['addToSet']);
  });

  it('returns an empty batch when both sides are empty', () => {
    const intent = replacePauseMarkers(ctx(), { existing: [], next: [] });
    expect(intent.batch.mutations).toHaveLength(0);
    expect(intent.sideEffects).toEqual([]);
  });

  it('accepts any iterable of existing uids', () => {
    const intent = replacePauseMarkers(ctx(), {
      existing: new Set(['a']),
      next: [{ type: 'folder', uid: 'b', marker: 'unpaused' }],
    });
    const bodies = intent.batch.mutations.map((m) => m.body);
    expect(bodies[0]).toMatchObject({ kind: 'removeFromSet', itemId: 'a' });
    expect(bodies[1]).toMatchObject({ kind: 'addToSet', itemId: 'b' });
  });

  it('shares a batchId across every mutation', () => {
    const intent = replacePauseMarkers(ctx({ batchId: 'shared-batch' }), {
      existing: ['a'],
      next: [{ type: 'folder', uid: 'b', marker: 'paused' }],
    });
    expect(intent.batch.batchId).toBe('shared-batch');
    expect(intent.batch.mutations.length).toBeGreaterThan(0);
  });
});
