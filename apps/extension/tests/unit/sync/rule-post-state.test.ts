/**
 * Phase A Fw7 — projector reads post-commit state for Rule envelopes
 * and returns null for non-Rule envelopes / deletes / unknown ids.
 */

import {
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  mintBatch,
  toggleEnabled,
} from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { projectRuleByUid, projectRulePostState } from '@/background/sync/rule-post-state';
import { seedRule } from '@openheaders/oracle/sync-builders/rule-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number, hlc: [number, number] = [ms, 0]): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: hlc[0], logical: hlc[1], nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeRule = (uid: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name: 'r',
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

async function newOracle(): Promise<EntityOracle> {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectRulePostState', () => {
  it('returns post-state for a Rule envelope after seed + toggle', async () => {
    const oracle = await newOracle();
    const rule = makeRule(generateUid());
    await oracle.apply(seedRule(rule, ctx(1_000)), []);
    const intent = toggleEnabled(ctx(2_000), { ruleUid: rule.uid, enabled: false });
    await oracle.apply(intent.batch, intent.sideEffects);

    const envelope = intent.batch.mutations[0];
    const post = projectRulePostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.rule.uid).toBe(rule.uid);
    expect(post?.rule.enabled).toBe(false);
    expect(post?.setItemIds.conditions?.length).toBe(1);
    expect(post?.setItemIds['action.requestHeaders']?.length).toBe(1);
    expect(post?.setItemIds['action.responseHeaders']).toBeUndefined();
  });

  it('returns null for non-Rule envelopes', async () => {
    const oracle = await newOracle();
    const envelope: MutationEnvelope = {
      mutationId: 'm-foreign',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'create', type: 'environment', id: 'e1', payload: {} },
    };
    expect(projectRulePostState(oracle, envelope)).toBeNull();
  });

  it('returns null for a deleted rule (tombstone)', async () => {
    const oracle = await newOracle();
    const rule = makeRule(generateUid());
    await oracle.apply(seedRule(rule, ctx(1_000)), []);
    const deleteCtx = ctx(2_000);
    const deleteBatch = mintBatch(deleteCtx, [
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: rule.uid },
    ]);
    await oracle.apply(deleteBatch, []);
    const post = projectRulePostState(oracle, deleteBatch.mutations[0]);
    expect(post).toBeNull();
  });

  it('projectRuleByUid returns post-state for known uid + null for unknown', async () => {
    const oracle = await newOracle();
    const rule = makeRule(generateUid());
    await oracle.apply(seedRule(rule, ctx(1_000)), []);
    const post = projectRuleByUid(oracle, rule.uid);
    expect(post?.rule.uid).toBe(rule.uid);
    expect(post?.setItemIds.conditions?.length).toBe(1);
    expect(projectRuleByUid(oracle, 'no-such-rule')).toBeNull();
  });

  it('returns null for an unknown rule id', async () => {
    const oracle = await newOracle();
    const envelope: MutationEnvelope = {
      mutationId: 'm-x',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'unknown', path: 'name', value: 'x' },
    };
    expect(projectRulePostState(oracle, envelope)).toBeNull();
  });
});
