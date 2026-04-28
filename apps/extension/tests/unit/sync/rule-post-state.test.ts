/**
 * Phase A Fw7 — projector reads post-commit state for Rule envelopes
 * and returns null for non-Rule envelopes / deletes / unknown ids.
 */

import {
  type MutationEnvelope,
  type RuleMutatorContext,
  RULE_ENTITY_TYPE,
  mintBatch,
  toggleEnabled,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, RuleOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { projectRulePostState } from '@/background/sync/rule-post-state';
import { seedRule } from '@/background/sync/rule-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number, hlc: [number, number] = [ms, 0]): RuleMutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: hlc[0], logical: hlc[1], nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeRule = (uid: string): V5.Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name: 'r',
    enabled: true,
    conditions: [{ kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as V5.Rule;

async function newOracle(): Promise<RuleOracle> {
  return new RuleOracle({
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
