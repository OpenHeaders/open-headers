/**
 * Phase B — projector reads post-commit state for pause-markers
 * envelopes and returns null for non-matching envelopes / cold-oracle
 * cases. Slice 4: entries are keyed by container uid; version-1
 * path-keyed members migrate on read and lose to a newer uid member.
 */

import {
  clearPauseMarker,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setPauseMarker,
} from '@openheaders/core/sync';
import { seedPauseMarkers } from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  projectPauseMarkersPostState,
  projectPauseMarkersSingleton,
} from '@openheaders/oracle/sync/post-state/pause-markers-post-state';
import { describe, expect, it } from 'vitest';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

/** A version-1 member as a 2026.8.4 client mints it: itemId = path, `{ path, marker }` (the seeder keeps that shape). */
function legacySet(ms: number, path: string, marker: 'paused' | 'unpaused') {
  return seedPauseMarkers({ [path]: marker }, ctx(ms));
}

describe('projectPauseMarkersPostState', () => {
  it('returns post-state after seed + setPauseMarker', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    const intent = setPauseMarker(ctx(2), {
      type: 'collection',
      uid: 'col00001',
      marker: 'paused',
      path: 'rules/auth-col00001',
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const post = projectPauseMarkersPostState(oracle, intent.batch.mutations[0]);
    expect(post).toEqual({
      markers: { col00001: 'paused' },
      entries: [{ type: 'collection', uid: 'col00001', marker: 'paused', path: 'rules/auth-col00001' }],
    });
  });

  it('drops a container after clearPauseMarker', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { type: 'folder', uid: 'a', marker: 'paused' }).batch, []);
    await oracle.apply(setPauseMarker(ctx(3), { type: 'folder', uid: 'b', marker: 'unpaused' }).batch, []);
    await oracle.apply(clearPauseMarker(ctx(4), { uid: 'a' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.markers).toEqual({ b: 'unpaused' });
    expect(post?.entries).toEqual([{ type: 'folder', uid: 'b', marker: 'unpaused' }]);
  });

  it('reads the later HLC marker on concurrent same-container sets (LWW)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { type: 'folder', uid: 'a', marker: 'paused' }).batch, []);
    await oracle.apply(setPauseMarker(ctx(3), { type: 'folder', uid: 'a', marker: 'unpaused' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.markers).toEqual({ a: 'unpaused' });
  });

  it('sorts entries by uid deterministically', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { type: 'folder', uid: 'z', marker: 'paused' }).batch, []);
    await oracle.apply(setPauseMarker(ctx(3), { type: 'folder', uid: 'a', marker: 'paused' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.entries.map((e) => e.uid)).toEqual(['a', 'z']);
  });

  it('migrates a version-1 path member on read through its uid tail, keeping the path as the hint', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(legacySet(2, 'rules/auth-col00001/login-fld00001', 'paused'), []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post).toEqual({
      markers: { fld00001: 'paused' },
      entries: [{ type: 'folder', uid: 'fld00001', marker: 'paused', path: 'rules/auth-col00001/login-fld00001' }],
    });
  });

  it('keeps a version-1 member resolvable after its folder moved: the key is the uid the path tail carries', async () => {
    // The stored path names the OLD location; the tail still names the
    // folder, so the marker follows the folder rather than the location.
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(legacySet(2, 'rules/old-col-old/moved-fld00001', 'paused'), []);
    expect(projectPauseMarkersSingleton(oracle)?.markers).toEqual({ fld00001: 'paused' });
  });

  it('drops a version-1 member whose path no container answers to', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(legacySet(2, 'requests/not-a-rules-tree', 'paused'), []);
    expect(projectPauseMarkersSingleton(oracle)).toEqual({ markers: {}, entries: [] });
  });

  it('lets the higher add-HLC win between a version-1 and a uid member for one container', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({ markers: {}, entries: [] }, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { type: 'collection', uid: 'col00001', marker: 'paused' }).batch, []);
    await oracle.apply(legacySet(5, 'rules/auth-col00001', 'unpaused'), []);
    expect(projectPauseMarkersSingleton(oracle)?.markers).toEqual({ col00001: 'unpaused' });

    await oracle.apply(setPauseMarker(ctx(9), { type: 'collection', uid: 'col00001', marker: 'paused' }).batch, []);
    expect(projectPauseMarkersSingleton(oracle)?.markers).toEqual({ col00001: 'paused' });
  });

  it('returns null for non-matching envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectPauseMarkersPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectPauseMarkersSingleton(oracle)).toBeNull();
  });
});
