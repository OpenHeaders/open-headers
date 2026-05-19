/**
 * Phase B — projector reads post-commit state for layout-state
 * envelopes and returns null for non-matching envelopes / cold-oracle
 * cases.
 */

import {
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setLayoutState,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import {
  projectLayoutStatePostState,
  projectLayoutStateSingleton,
} from '@openheaders/oracle/sync/layout-state-post-state';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { seedLayoutState } from '@openheaders/core/sync-builders/layout-state-projection';

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

describe('projectLayoutStatePostState', () => {
  it('returns the layout blob after seed + setLayoutState', async () => {
    const oracle = newOracle();
    await oracle.apply(seedLayoutState({ sidebarRatio: 0.2 }, ctx(1)), []);
    const intent = setLayoutState(ctx(2), {
      layout: { sidebarRatio: 0.3, inspectorRatio: 0.25, bottomRatio: 0.2 },
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const post = projectLayoutStatePostState(oracle, intent.batch.mutations[0]);
    expect(post).not.toBeNull();
    expect(post?.layout).toEqual({
      sidebarRatio: 0.3,
      inspectorRatio: 0.25,
      bottomRatio: 0.2,
    });
  });

  it('preserves opaque toolLayout shape through round-trip', async () => {
    const oracle = newOracle();
    const layout = {
      sidebarRatio: 0.2,
      inspectorRatio: 0.2,
      bottomRatio: 0.2,
      toolLayout: { docks: { left: ['rules'] }, hidden: ['inspector'] },
    };
    await oracle.apply(seedLayoutState(layout, ctx(1)), []);
    const post = projectLayoutStateSingleton(oracle);
    expect(post?.layout).toEqual(layout);
  });

  it('reads later HLC value on concurrent setLayoutState (LWW)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedLayoutState({ sidebarRatio: 0.1 }, ctx(1)), []);
    await oracle.apply(setLayoutState(ctx(2), { layout: { sidebarRatio: 0.2 } }).batch, []);
    await oracle.apply(setLayoutState(ctx(3), { layout: { sidebarRatio: 0.4 } }).batch, []);
    const post = projectLayoutStateSingleton(oracle);
    expect(post?.layout).toEqual({ sidebarRatio: 0.4 });
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
    expect(projectLayoutStatePostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectLayoutStateSingleton(oracle)).toBeNull();
  });
});
