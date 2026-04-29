/**
 * Phase B — projector reads post-commit state for pause-markers
 * envelopes and returns null for non-matching envelopes / cold-oracle
 * cases.
 */

import {
  clearPauseMarker,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setPauseMarker,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import {
  projectPauseMarkersPostState,
  projectPauseMarkersSingleton,
} from '@/background/sync/pause-markers-post-state';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedPauseMarkers } from '@/shared/sync/pause-markers-projection';

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

describe('projectPauseMarkersPostState', () => {
  it('returns post-state after seed + setPauseMarker', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({}, ctx(1)), []);
    const intent = setPauseMarker(ctx(2), {
      path: 'collections/auth',
      marker: 'paused',
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const post = projectPauseMarkersPostState(oracle, intent.batch.mutations[0]);
    expect(post).not.toBeNull();
    expect(post?.markers).toEqual({ 'collections/auth': 'paused' });
    expect(post?.paths).toEqual(['collections/auth']);
  });

  it('drops a path after clearPauseMarker', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({}, ctx(1)), []);
    await oracle.apply(
      setPauseMarker(ctx(2), { path: 'a', marker: 'paused' }).batch,
      [],
    );
    await oracle.apply(
      setPauseMarker(ctx(3), { path: 'b', marker: 'unpaused' }).batch,
      [],
    );
    await oracle.apply(clearPauseMarker(ctx(4), { path: 'a' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.markers).toEqual({ b: 'unpaused' });
    expect(post?.paths).toEqual(['b']);
  });

  it('reads later HLC marker on concurrent same-path sets (LWW)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({}, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { path: 'a', marker: 'paused' }).batch, []);
    await oracle.apply(setPauseMarker(ctx(3), { path: 'a', marker: 'unpaused' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.markers).toEqual({ a: 'unpaused' });
  });

  it('sorts paths deterministically', async () => {
    const oracle = newOracle();
    await oracle.apply(seedPauseMarkers({}, ctx(1)), []);
    await oracle.apply(setPauseMarker(ctx(2), { path: 'z', marker: 'paused' }).batch, []);
    await oracle.apply(setPauseMarker(ctx(3), { path: 'a', marker: 'paused' }).batch, []);
    const post = projectPauseMarkersSingleton(oracle);
    expect(post?.paths).toEqual(['a', 'z']);
  });

  it('returns null for non-matching envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
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
