/**
 * Receive-vs-mint parity for the `sync-builders/*-mutations.ts` layer.
 *
 * Slice 1 (Session 28) single-sourced the `mutators/` catalog through
 * `deriveSideEffectsForEnvelope`. The `sync-builders` write-client
 * builders are a SECOND mint-time emission layer; Slice 1b routes them
 * through the same derivation so mint-side equals receive-side by
 * construction.
 *
 * This file pins:
 *   1. Parity — every builder's `payload.sideEffects` equals
 *      `payload.batch.mutations.flatMap(deriveSideEffectsForEnvelope)`.
 *      A builder that regresses to inline emission fails here.
 *   2. Content — the right intents per builder, including the
 *      collection-delete builders that previously emitted nothing
 *      (Bug A class: a delete left the deleting host's resolver stale).
 */

import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  deriveSideEffectsForEnvelope,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  type MutatorIntent,
  RECOMPILE_DNR,
} from '../../src/sync';
import { buildDeleteCollectionBatch } from '../../src/sync-builders/mutations/collection-mutations';
import { buildAddEnvironmentBatch, buildDeleteEnvironmentBatch } from '../../src/sync-builders/mutations/env-mutations';
import {
  buildAddLiveVariableBatch,
  buildDeleteLiveVariableBatch,
  buildUpdateLiveVariableBatch,
} from '../../src/sync-builders/mutations/live-variable-mutations';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '../../src/sync-builders/mutations/live-workflow-mutations';
import { buildDeleteRequestCollectionBatch } from '../../src/sync-builders/mutations/request-collection-mutations';
import { buildAddBatch, buildDeleteBatch, buildUpdateBatch } from '../../src/sync-builders/mutations/rule-mutations';
import { buildDeleteTemplateCollectionBatch } from '../../src/sync-builders/mutations/template-collection-mutations';
import { buildVariablesReplacement } from '../../src/sync-builders/variables-replacement';
import type { Environment, LiveVariable, LiveWorkflow, Rule } from '../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const headerRule = (): Rule => ({
  schemaVersion: 5,
  uid: 'rule-1',
  path: 'rules/My/Header',
  name: 'My Header',
  enabled: true,
  type: 'header',
  conditions: [],
  action: { requestHeaders: [], responseHeaders: [] },
});

const environment = (variables: Environment['variables']): Environment => ({
  schemaVersion: 5,
  uid: 'env-1',
  name: 'Prod',
  variables,
});

const liveVariable = (): LiveVariable => ({
  schemaVersion: 5,
  uid: 'lv-1',
  path: 'live/Lv',
  name: 'token',
  workflowUid: 'wf-1',
  stepId: 'step1',
  captureName: 'token',
  enabled: true,
});

const liveWorkflow = (): LiveWorkflow => ({
  schemaVersion: 5,
  uid: 'wf-1',
  path: 'live/Wf',
  name: 'Auth',
  steps: [{ uid: 'step-1', id: 'step1', requestUid: 'req-1', captures: [] }],
  refresh: { kind: 'manual' },
  enabled: true,
});

/** Every builder, one row per write path that emits a payload. */
const cases: Array<{ label: string; payload: MutatorIntent }> = [
  { label: 'rule.buildAddBatch', payload: buildAddBatch(headerRule(), ctx()) },
  { label: 'rule.buildDeleteBatch', payload: buildDeleteBatch('rule-1', ctx()) },
  {
    label: 'rule.buildUpdateBatch',
    payload: buildUpdateBatch(
      'rule-1',
      'header',
      { name: 'Renamed' },
      ctx(),
      () => [],
      () => undefined,
    ),
  },
  {
    label: 'rule.buildUpdateBatch (empty patch)',
    payload: buildUpdateBatch(
      'rule-1',
      'header',
      {},
      ctx(),
      () => [],
      () => undefined,
    ),
  },
  {
    label: 'env.buildAddEnvironmentBatch (no vars)',
    payload: buildAddEnvironmentBatch({ environment: environment([]) }, ctx()),
  },
  {
    label: 'env.buildAddEnvironmentBatch (1 var)',
    payload: buildAddEnvironmentBatch(
      { environment: environment([{ uid: 'v1', name: 'API', value: 'x', type: 'default' }]) },
      ctx(),
    ),
  },
  { label: 'env.buildDeleteEnvironmentBatch', payload: buildDeleteEnvironmentBatch({ envId: 'env-1' }, ctx()) },
  { label: 'liveVariable.buildAddLiveVariableBatch', payload: buildAddLiveVariableBatch(liveVariable(), ctx()) },
  { label: 'liveVariable.buildDeleteLiveVariableBatch', payload: buildDeleteLiveVariableBatch('lv-1', ctx()) },
  {
    label: 'liveVariable.buildUpdateLiveVariableBatch',
    payload: buildUpdateLiveVariableBatch('lv-1', { enabled: false }, ctx()),
  },
  {
    label: 'liveVariable.buildUpdateLiveVariableBatch (empty patch)',
    payload: buildUpdateLiveVariableBatch('lv-1', {}, ctx()),
  },
  { label: 'liveWorkflow.buildAddLiveWorkflowBatch', payload: buildAddLiveWorkflowBatch(liveWorkflow(), ctx()) },
  { label: 'liveWorkflow.buildDeleteLiveWorkflowBatch', payload: buildDeleteLiveWorkflowBatch('wf-1', ctx()) },
  {
    label: 'liveWorkflow.buildUpdateLiveWorkflowBatch',
    payload: buildUpdateLiveWorkflowBatch('wf-1', { enabled: false }, ctx()),
  },
  { label: 'collection.buildDeleteCollectionBatch', payload: buildDeleteCollectionBatch('coll-1', ctx()) },
  {
    label: 'requestCollection.buildDeleteRequestCollectionBatch',
    payload: buildDeleteRequestCollectionBatch('rc-1', ctx()),
  },
  {
    label: 'templateCollection.buildDeleteTemplateCollectionBatch',
    payload: buildDeleteTemplateCollectionBatch('tc-1', ctx()),
  },
];

describe('sync-builders side effects — receive-vs-mint parity', () => {
  for (const { label, payload } of cases) {
    it(`${label}: builder side effects = derive(envelope) on every envelope`, () => {
      expect(payload.sideEffects).toEqual(payload.batch.mutations.flatMap(deriveSideEffectsForEnvelope));
    });
  }
});

describe('sync-builders side effects — content', () => {
  const hlc = ctx().hlc;

  it('a rule add / delete / update recompiles DNR keyed by the rule uid', () => {
    for (const payload of [
      buildAddBatch(headerRule(), ctx()),
      buildDeleteBatch('rule-1', ctx()),
      buildUpdateBatch(
        'rule-1',
        'header',
        { name: 'Renamed' },
        ctx(),
        () => [],
        () => undefined,
      ),
    ]) {
      expect(payload.sideEffects.length).toBeGreaterThan(0);
      for (const intent of payload.sideEffects) {
        expect(intent).toEqual({ kind: RECOMPILE_DNR, key: 'rule-1', hlc });
      }
    }
  });

  it('an empty rule update derives no side effect', () => {
    const payload = buildUpdateBatch(
      'rule-1',
      'header',
      {},
      ctx(),
      () => [],
      () => undefined,
    );
    expect(payload.batch.mutations).toEqual([]);
    expect(payload.sideEffects).toEqual([]);
  });

  it('an environment delete invalidates the resolver keyed by the environment id', () => {
    expect(buildDeleteEnvironmentBatch({ envId: 'env-1' }, ctx()).sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'env-1', hlc },
    ]);
  });

  it('an environment add invalidates per variable; a no-variable add derives nothing', () => {
    expect(buildAddEnvironmentBatch({ environment: environment([]) }, ctx()).sideEffects).toEqual([]);
    expect(
      buildAddEnvironmentBatch(
        { environment: environment([{ uid: 'v1', name: 'API', value: 'x', type: 'default' }]) },
        ctx(),
      ).sideEffects,
      // The intent derives from the addToSet envelope — the second in
      // the batch, so its HLC is ticked past the context's base.
    ).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'env-1', hlc: { ...hlc, logical: hlc.logical + 1 } }]);
  });

  it('every live-variable builder invalidates keyed by the LV uid', () => {
    for (const payload of [
      buildAddLiveVariableBatch(liveVariable(), ctx()),
      buildDeleteLiveVariableBatch('lv-1', ctx()),
      buildUpdateLiveVariableBatch('lv-1', { enabled: false }, ctx()),
    ]) {
      expect(payload.sideEffects.length).toBeGreaterThan(0);
      for (const intent of payload.sideEffects) {
        expect(intent).toEqual({ kind: INVALIDATE_RESOLVER, key: 'lv-1', hlc });
      }
    }
  });

  it('an empty live-variable update derives no side effect', () => {
    expect(buildUpdateLiveVariableBatch('lv-1', {}, ctx()).sideEffects).toEqual([]);
  });

  it('every live-workflow builder invalidates keyed by the workflow uid', () => {
    for (const payload of [
      buildAddLiveWorkflowBatch(liveWorkflow(), ctx()),
      buildDeleteLiveWorkflowBatch('wf-1', ctx()),
      buildUpdateLiveWorkflowBatch('wf-1', { enabled: false }, ctx()),
    ]) {
      expect(payload.sideEffects.length).toBeGreaterThan(0);
      for (const intent of payload.sideEffects) {
        // Multi-envelope batches tick the logical component per
        // envelope; the key + kind are the load-bearing content here.
        expect(intent).toEqual({
          kind: INVALIDATE_RESOLVER,
          key: 'wf-1',
          hlc: { ...hlc, logical: expect.any(Number) as number },
        });
      }
    }
  });

  // Bug A class: the delete builders previously returned a bare batch
  // and every caller hardcoded `sideEffects: []`, so deleting a
  // collection never flushed the deleting host's own resolver cache.
  it('a collection / request-collection / template-collection delete invalidates the resolver', () => {
    expect(buildDeleteCollectionBatch('coll-1', ctx()).sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'coll-1', hlc },
    ]);
    expect(buildDeleteRequestCollectionBatch('rc-1', ctx()).sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'rc-1', hlc },
    ]);
    expect(buildDeleteTemplateCollectionBatch('tc-1', ctx()).sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'tc-1', hlc },
    ]);
  });
});

describe('buildVariablesReplacement side effects', () => {
  const hlc = ctx().hlc;

  it('invalidates the resolver for the entity, single-sourced through the dispatcher', () => {
    const payload = buildVariablesReplacement(
      { entityType: COLLECTION_ENTITY_TYPE, varsPath: COLLECTION_VARS_PATH },
      ctx(),
      {
        entityUid: 'coll-1',
        oldVars: [],
        newVars: [{ uid: 'v1', name: 'API', value: 'x' }],
      },
    );
    expect(payload).not.toBeNull();
    if (!payload) return;
    expect(payload.sideEffects).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'coll-1', hlc }]);
    expect(payload.sideEffects).toEqual(payload.batch.mutations.flatMap(deriveSideEffectsForEnvelope));
  });

  it('returns null (no batch, no side effects) when the diff is empty', () => {
    expect(
      buildVariablesReplacement({ entityType: COLLECTION_ENTITY_TYPE, varsPath: COLLECTION_VARS_PATH }, ctx(), {
        entityUid: 'coll-1',
        oldVars: [],
        newVars: [],
      }),
    ).toBeNull();
  });
});
