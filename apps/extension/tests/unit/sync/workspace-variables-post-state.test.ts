/**
 * Phase B — projector reads post-commit state for workspace-variables
 * envelopes and returns null for non-matching envelopes / cold-oracle
 * cases. Mirrors collection-post-state.test.ts.
 */

import {
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setWorkspaceVar,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import {
  projectWorkspaceVariablesPostState,
  projectWorkspaceVariablesSingleton,
} from '@/background/sync/workspace-variables-post-state';
import { seedWorkspaceVariables } from '@/shared/sync/workspace-variables-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeWorkspaceVars = (vars: V5.Variable[]): V5.WorkspaceVariables => ({
  schemaVersion: 5,
  variables: vars,
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

describe('projectWorkspaceVariablesPostState', () => {
  it('returns post-state after seed + setWorkspaceVar', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedWorkspaceVariables(
        makeWorkspaceVars([{ uid: '8f3cff23', name: 'API_BASE', value: 'v', type: 'default' }]),
        ctx(1),
      ),
      [],
    );
    const setIntent = setWorkspaceVar(ctx(2), {
      variable: { uid: 'vrwsvarnw', name: 'NEW', value: 'v', type: 'default' },
    });
    const setResult = await oracle.apply(setIntent.batch, []);
    expect(setResult.ok).toBe(true);

    const envelope = setIntent.batch.mutations[0];
    const post = projectWorkspaceVariablesPostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.workspaceVariables.variables.map((v) => v.name).sort()).toEqual([
      'API_BASE',
      'NEW',
    ]);
    // Set-member identity is the variable uid (post-session-66); `varUids`
    // is the protocol field name but carries itemIds = uids.
    expect(post?.varUids.sort()).toEqual(['8f3cff23', 'vrwsvarnw']);
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
    expect(projectWorkspaceVariablesPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectWorkspaceVariablesSingleton(oracle)).toBeNull();
  });

  it('reports varUids matching WORKSPACE_VARIABLES_PATH itemIds', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedWorkspaceVariables(
        makeWorkspaceVars([
          { uid: '468ea243', name: 'API_BASE', value: '1', type: 'default' },
          { uid: '20f69dd4', name: 'TOKEN', value: '2', type: 'secret' },
        ]),
        ctx(1),
      ),
      [],
    );
    const live = oracle.liveSetItems(
      WORKSPACE_VARIABLES_ENTITY_TYPE,
      WORKSPACE_VARIABLES_ID,
      WORKSPACE_VARIABLES_PATH,
    );
    const projected = projectWorkspaceVariablesSingleton(oracle);
    expect(projected?.varUids.sort()).toEqual(live.map((e) => e.itemId).sort());
  });
});
