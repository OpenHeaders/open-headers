/**
 * Phase B — projector reads post-commit state for Environment
 * envelopes and returns null for non-Environment envelopes / deletes /
 * unknown ids. Mirrors rule-post-state.test.ts.
 */

import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  mintBatch,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setEnvVar,
} from '@openheaders/core/sync';
import type { Environment } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { projectEnvironmentByUid, projectEnvironmentPostState } from '@openheaders/oracle/sync/env-post-state';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { seedEnvironment } from '@openheaders/core/sync-builders/env-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number, hlc: [number, number] = [ms, 0]): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: hlc[0], logical: hlc[1], nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeEnv = (uid: string): Environment =>
  ({
    schemaVersion: 5,
    uid,
    name: 'staging',
    variables: [
      { uid: 'ccd4ee5b', name: 'API_BASE', value: 'https://staging.openheaders.io', type: 'default' },
      { uid: '04861989', name: 'API_KEY', value: 'k', type: 'secret' },
    ],
    version: 1,
  }) as unknown as Environment;

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectEnvironmentPostState', () => {
  it('returns post-state after seedEnvironment + setEnvVar', async () => {
    const oracle = newOracle();
    const env = makeEnv('env-1');
    const seedBatch = seedEnvironment(env, ctx(1));
    await oracle.apply(seedBatch, []);
    const setIntent = setEnvVar(ctx(2), {
      envId: env.uid,
      variable: { uid: 'vrenvnew1', name: 'NEW_VAR', value: 'v', type: 'default' },
    });
    const setResult = await oracle.apply(setIntent.batch, []);
    expect(setResult.ok).toBe(true);

    const envelope = setIntent.batch.mutations[0];
    const post = projectEnvironmentPostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.environment.uid).toBe('env-1');
    // Set-member identity is the variable uid (post-session-66); `varUids`
    // is the protocol field name but carries itemIds = uids.
    expect(post?.varUids.sort()).toEqual(['04861989', 'ccd4ee5b', 'vrenvnew1']);
  });

  it('returns null for non-Environment envelopes', () => {
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
    expect(projectEnvironmentPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null for unknown env ids', () => {
    const oracle = newOracle();
    expect(projectEnvironmentByUid(oracle, 'no-such-id')).toBeNull();
  });

  it('returns null for tombstoned environments', async () => {
    const oracle = newOracle();
    const env = makeEnv('env-2');
    await oracle.apply(seedEnvironment(env, ctx(1)), []);
    const deleteBatch = mintBatch(ctx(2), [
      { kind: 'delete', type: ENVIRONMENT_ENTITY_TYPE, id: env.uid },
    ]);
    await oracle.apply(deleteBatch, []);
    expect(projectEnvironmentByUid(oracle, env.uid)).toBeNull();
  });

  it('reports varUids matching ENV_VARS_PATH itemIds', async () => {
    const oracle = newOracle();
    const env = makeEnv('env-3');
    await oracle.apply(seedEnvironment(env, ctx(1)), []);
    const live = oracle.liveSetItems(ENVIRONMENT_ENTITY_TYPE, env.uid, ENV_VARS_PATH);
    const projected = projectEnvironmentByUid(oracle, env.uid);
    expect(projected?.varUids.sort()).toEqual(live.map((e) => e.itemId).sort());
  });
});
