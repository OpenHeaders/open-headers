/**
 * Receive-vs-mint parity matrix for `deriveSideEffectsForEnvelope`.
 *
 * Bug A (Session 27): an inbound-synced edit updated the store but its
 * host-local side effect (DNR recompile / resolver-cache flush) never
 * fired, because the receive-side dispatcher did not cover the entity.
 *
 * The fix makes each entity's `derive*SideEffects` the SINGLE source
 * both the mutators (mint-side) and `deriveSideEffectsForEnvelope`
 * (receive-side) call. This file pins that:
 *
 *   1. Parity — for every intent-emitting mutator, the side effects the
 *      mutator returns equal `batch.mutations.flatMap(deriveSideEffectsForEnvelope)`.
 *      A mutator that emits inline instead of routing through the
 *      derivation fails here.
 *   2. Content — the derivation emits the RIGHT intents per body kind
 *      (a variable edit invalidates the resolver; a rename does not; a
 *      rule edit recompiles DNR; …).
 */

import { describe, expect, it } from 'vitest';
import type { SideEffectIntent } from '../../../src/sync';
import {
  addCondition,
  addHeaderMod,
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  clearPauseMarker,
  createLiveVariable,
  createLiveWorkflow,
  deleteLiveVariable,
  deleteLiveWorkflow,
  deriveSideEffectsForEnvelope,
  ENVIRONMENT_ENTITY_TYPE,
  INVALIDATE_RESOLVER,
  type MutationEnvelope,
  type MutatorContext,
  type MutatorIntent,
  PAUSE_MARKERS_ID,
  PURGE_WORKSPACE_DATA,
  RECOMPILE_DNR,
  REQUEST_COLLECTION_ENTITY_TYPE,
  removeCollectionVar,
  removeCondition,
  removeEnvVar,
  removeExtensionWorkspace,
  removeHeaderMod,
  removeRequestCollectionVar,
  removeTemplateCollectionVar,
  removeVaultSecret,
  removeWorkspaceVar,
  renameCollection,
  renameEnvironment,
  renameRequestCollection,
  renameTemplateCollection,
  reorderHeaderMod,
  replacePauseMarkers,
  SWAP_PER_WORKSPACE_STORES,
  setActiveExtensionWorkspace,
  setCollectionVar,
  setConditionField,
  setDefaultEnvironmentId,
  setEnvVar,
  setLiveVariableField,
  setLiveWorkflowField,
  setPauseMarker,
  setPinnedAndDefault,
  setPinnedEnvironments,
  setRequestCollectionVar,
  setTemplateCollectionVar,
  setVaultSecret,
  setWorkspaceVar,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  toggleEnabled,
  unsetLiveVariableField,
  unsetLiveWorkflowField,
  VAULT_ID,
  WORKSPACE_VARIABLES_ID,
} from '../../../src/sync';
import type { VaultSecret } from '../../../src/types';
import type { Variable } from '../../../src/types/variable';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const hlc = ctx().hlc;

const variable = (uid: string): Variable => ({
  uid,
  name: 'API_URL',
  value: 'https://openheaders.io',
  type: 'default',
});
const stringSecret = (uid: string): VaultSecret => ({ uid, kind: 'string', name: 'API_KEY', value: 'sek' });

const intent = (label: string, build: () => MutatorIntent): { label: string; intent: MutatorIntent } => ({
  label,
  intent: build(),
});

/** Every intent-emitting mutator, one row per body kind. */
const cases = [
  // rule — every mutation recompiles DNR, keyed by ruleUid
  intent('rule.toggleEnabled', () => toggleEnabled(ctx(), { ruleUid: 'rule-1', enabled: false })),
  intent('rule.addCondition', () =>
    addCondition(ctx(), { ruleUid: 'rule-1', condition: { uid: 'c1', type: 'urlEquals', values: ['x'] } }),
  ),
  intent('rule.removeCondition', () => removeCondition(ctx(), { ruleUid: 'rule-1', itemId: 'c1' })),
  intent('rule.setConditionField', () =>
    setConditionField(ctx(), {
      ruleUid: 'rule-1',
      itemId: 'c1',
      condition: { uid: 'c1', type: 'urlEquals', values: ['y'] },
    }),
  ),
  intent('rule.addHeaderMod', () =>
    addHeaderMod(ctx(), {
      ruleUid: 'rule-1',
      side: 'request',
      mod: { uid: 'h1', operation: 'override', headerName: 'X', value: 'v' },
    }),
  ),
  intent('rule.removeHeaderMod', () => removeHeaderMod(ctx(), { ruleUid: 'rule-1', side: 'request', itemId: 'h1' })),
  intent('rule.reorderHeaderMod', () =>
    reorderHeaderMod(ctx(), { ruleUid: 'rule-1', side: 'request', itemId: 'h1', orderKey: 'm' }),
  ),
  // pause-markers — every mutation recompiles DNR, keyed by the singleton
  intent('pauseMarkers.setPauseMarker', () => setPauseMarker(ctx(), { path: 'collections/auth', marker: 'paused' })),
  intent('pauseMarkers.clearPauseMarker', () => clearPauseMarker(ctx(), { path: 'collections/auth' })),
  intent('pauseMarkers.replacePauseMarkers', () =>
    replacePauseMarkers(ctx(), { existing: { a: 'paused' }, next: { b: 'unpaused' } }),
  ),
  // collection — variable edits invalidate; name / pinned / default do not
  intent('collection.renameCollection', () => renameCollection(ctx(), { collectionUid: 'coll-1', name: 'P' })),
  intent('collection.setPinnedEnvironments', () =>
    setPinnedEnvironments(ctx(), { collectionUid: 'coll-1', pinnedEnvironmentIds: ['e1'] }),
  ),
  intent('collection.setDefaultEnvironmentId', () =>
    setDefaultEnvironmentId(ctx(), { collectionUid: 'coll-1', defaultEnvironmentId: 'e1' }),
  ),
  intent('collection.setPinnedAndDefault', () =>
    setPinnedAndDefault(ctx(), { collectionUid: 'coll-1', pinnedEnvironmentIds: ['e1'], defaultEnvironmentId: 'e1' }),
  ),
  intent('collection.setCollectionVar', () =>
    setCollectionVar(ctx(), { collectionUid: 'coll-1', variable: variable('v1') }),
  ),
  intent('collection.removeCollectionVar', () => removeCollectionVar(ctx(), { collectionUid: 'coll-1', uid: 'v1' })),
  // environment — variable edits invalidate; rename does not
  intent('environment.renameEnvironment', () => renameEnvironment(ctx(), { envId: 'env-1', name: 'Prod' })),
  intent('environment.setEnvVar', () => setEnvVar(ctx(), { envId: 'env-1', variable: variable('v1') })),
  intent('environment.removeEnvVar', () => removeEnvVar(ctx(), { envId: 'env-1', uid: 'v1' })),
  // live-variable — every mutation invalidates, keyed by LV uid
  intent('liveVariable.create', () => createLiveVariable(ctx(), { liveVariableUid: 'lv-1', payload: {} })),
  intent('liveVariable.delete', () => deleteLiveVariable(ctx(), { liveVariableUid: 'lv-1' })),
  intent('liveVariable.setField', () =>
    setLiveVariableField(ctx(), { liveVariableUid: 'lv-1', path: 'enabled', value: true }),
  ),
  intent('liveVariable.unsetField', () =>
    unsetLiveVariableField(ctx(), { liveVariableUid: 'lv-1', path: 'description' }),
  ),
  // live-workflow — every mutation invalidates, keyed by workflow uid
  intent('liveWorkflow.create', () => createLiveWorkflow(ctx(), { workflowUid: 'wf-1', payload: {} })),
  intent('liveWorkflow.delete', () => deleteLiveWorkflow(ctx(), { workflowUid: 'wf-1' })),
  intent('liveWorkflow.setField', () =>
    setLiveWorkflowField(ctx(), { workflowUid: 'wf-1', path: 'enabled', value: true }),
  ),
  intent('liveWorkflow.unsetField', () => unsetLiveWorkflowField(ctx(), { workflowUid: 'wf-1', path: 'description' })),
  // vault — secret edits invalidate, keyed by the singleton
  intent('vault.setVaultSecret', () => setVaultSecret(ctx(), { secret: stringSecret('s1') })),
  intent('vault.removeVaultSecret', () => removeVaultSecret(ctx(), { uid: 's1' })),
  // workspace-variables — variable edits invalidate, keyed by the singleton
  intent('workspaceVariables.setWorkspaceVar', () => setWorkspaceVar(ctx(), { variable: variable('v1') })),
  intent('workspaceVariables.removeWorkspaceVar', () => removeWorkspaceVar(ctx(), { uid: 'v1' })),
  // template-collection — variable edits invalidate; rename does not
  intent('templateCollection.rename', () => renameTemplateCollection(ctx(), { collectionUid: 'tc-1', name: 'T' })),
  intent('templateCollection.setVar', () =>
    setTemplateCollectionVar(ctx(), { templateCollectionUid: 'tc-1', variable: variable('v1') }),
  ),
  intent('templateCollection.removeVar', () =>
    removeTemplateCollectionVar(ctx(), { templateCollectionUid: 'tc-1', uid: 'v1' }),
  ),
  // request-collection — variable edits invalidate; rename does not
  intent('requestCollection.rename', () => renameRequestCollection(ctx(), { collectionUid: 'rc-1', name: 'R' })),
  intent('requestCollection.setVar', () =>
    setRequestCollectionVar(ctx(), { requestCollectionUid: 'rc-1', variable: variable('v1') }),
  ),
  intent('requestCollection.removeVar', () =>
    removeRequestCollectionVar(ctx(), { requestCollectionUid: 'rc-1', uid: 'v1' }),
  ),
  // extension-workspace — already wired pre-Session-27; covered for regression
  intent('extensionWorkspace.setActive', () => setActiveExtensionWorkspace(ctx(), { id: 'ws-abc' })),
  intent('extensionWorkspace.remove', () => removeExtensionWorkspace(ctx(), { id: 'ws-abc' })),
];

describe('deriveSideEffectsForEnvelope — receive-vs-mint parity', () => {
  for (const { label, intent: result } of cases) {
    it(`${label}: mutator side effects = derive(envelope) on every envelope`, () => {
      const derived = result.batch.mutations.flatMap(deriveSideEffectsForEnvelope);
      expect(derived).toEqual(result.sideEffects);
    });
  }
});

/** Helper: run the dispatcher over a mutator's whole batch. */
const derive = (result: MutatorIntent): SideEffectIntent[] =>
  result.batch.mutations.flatMap(deriveSideEffectsForEnvelope);

describe('deriveSideEffectsForEnvelope — per-body-kind content', () => {
  it('rule edits recompile DNR keyed by the rule uid', () => {
    expect(derive(toggleEnabled(ctx(), { ruleUid: 'rule-1', enabled: false }))).toEqual([
      { kind: RECOMPILE_DNR, key: 'rule-1', hlc },
    ]);
  });

  it('pause-marker edits recompile DNR keyed by the singleton', () => {
    expect(derive(setPauseMarker(ctx(), { path: 'p', marker: 'paused' }))).toEqual([
      { kind: RECOMPILE_DNR, key: PAUSE_MARKERS_ID, hlc },
    ]);
  });

  it('a collection variable edit invalidates the resolver keyed by the collection uid', () => {
    expect(derive(setCollectionVar(ctx(), { collectionUid: 'coll-1', variable: variable('v1') }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'coll-1', hlc },
    ]);
  });

  it('a collection rename / pinned / default edit derives NO side effect', () => {
    expect(derive(renameCollection(ctx(), { collectionUid: 'coll-1', name: 'P' }))).toEqual([]);
    expect(derive(setPinnedEnvironments(ctx(), { collectionUid: 'coll-1', pinnedEnvironmentIds: ['e1'] }))).toEqual([]);
    expect(derive(setDefaultEnvironmentId(ctx(), { collectionUid: 'coll-1', defaultEnvironmentId: null }))).toEqual([]);
  });

  it('an environment variable edit invalidates; a rename does not', () => {
    expect(derive(setEnvVar(ctx(), { envId: 'env-1', variable: variable('v1') }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'env-1', hlc },
    ]);
    expect(derive(renameEnvironment(ctx(), { envId: 'env-1', name: 'Prod' }))).toEqual([]);
  });

  it('every live-variable mutation invalidates keyed by the LV uid', () => {
    for (const result of [
      createLiveVariable(ctx(), { liveVariableUid: 'lv-1', payload: {} }),
      deleteLiveVariable(ctx(), { liveVariableUid: 'lv-1' }),
      setLiveVariableField(ctx(), { liveVariableUid: 'lv-1', path: 'enabled', value: true }),
      unsetLiveVariableField(ctx(), { liveVariableUid: 'lv-1', path: 'description' }),
    ]) {
      expect(derive(result)).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'lv-1', hlc }]);
    }
  });

  it('every live-workflow mutation invalidates keyed by the workflow uid', () => {
    for (const result of [
      createLiveWorkflow(ctx(), { workflowUid: 'wf-1', payload: {} }),
      deleteLiveWorkflow(ctx(), { workflowUid: 'wf-1' }),
      setLiveWorkflowField(ctx(), { workflowUid: 'wf-1', path: 'enabled', value: true }),
      unsetLiveWorkflowField(ctx(), { workflowUid: 'wf-1', path: 'description' }),
    ]) {
      expect(derive(result)).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'wf-1', hlc }]);
    }
  });

  it('vault secret edits invalidate keyed by the vault singleton', () => {
    expect(derive(setVaultSecret(ctx(), { secret: stringSecret('s1') }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc },
    ]);
    expect(derive(removeVaultSecret(ctx(), { uid: 's1' }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc },
    ]);
  });

  it('workspace-variable edits invalidate keyed by the workspace-vars singleton', () => {
    expect(derive(setWorkspaceVar(ctx(), { variable: variable('v1') }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: WORKSPACE_VARIABLES_ID, hlc },
    ]);
  });

  it('template- / request-collection variable edits invalidate; renames do not', () => {
    expect(
      derive(setTemplateCollectionVar(ctx(), { templateCollectionUid: 'tc-1', variable: variable('v1') })),
    ).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'tc-1', hlc }]);
    expect(derive(renameTemplateCollection(ctx(), { collectionUid: 'tc-1', name: 'T' }))).toEqual([]);
    expect(derive(setRequestCollectionVar(ctx(), { requestCollectionUid: 'rc-1', variable: variable('v1') }))).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'rc-1', hlc },
    ]);
    expect(derive(renameRequestCollection(ctx(), { collectionUid: 'rc-1', name: 'R' }))).toEqual([]);
  });

  it('extension-workspace setActive swaps stores; remove purges workspace data', () => {
    expect(derive(setActiveExtensionWorkspace(ctx(), { id: 'ws-abc' }))).toEqual([
      { kind: SWAP_PER_WORKSPACE_STORES, key: 'global', hlc },
    ]);
    expect(derive(removeExtensionWorkspace(ctx(), { id: 'ws-abc' }))).toEqual([
      { kind: PURGE_WORKSPACE_DATA, key: 'ws-abc', hlc },
    ]);
  });

  it('an unhandled entity type (request / folder / template) derives no side effect', () => {
    expect(
      deriveSideEffectsForEnvelope({
        mutationId: 'm1',
        hlc,
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        orgId: 'org-test',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'request', id: 'req-1', path: 'name', value: 'X' },
      }),
    ).toEqual([]);
  });
});

/**
 * `create` / `delete` whole-entity bodies are minted by the
 * `sync-builders/*-mutations.ts` layer (`buildAddEnvironmentBatch`,
 * `buildDeleteCollectionBatch`, …), not by the `mutators/` catalog —
 * so they ride no catalog-mutator parity case above. The dispatcher
 * must still cover them: a peer that receives an environment /
 * collection delete has to flush its resolver cache.
 */
describe('deriveSideEffectsForEnvelope — create / delete bodies', () => {
  const mkEnvelope = (body: MutationEnvelope['body']): MutationEnvelope => ({
    mutationId: 'm1',
    hlc,
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'ws-1',
    orgId: 'org-test',
    mutatorVersion: 1,
    body,
  });

  const variableScopes = [
    { label: 'collection', type: COLLECTION_ENTITY_TYPE, varsPath: COLLECTION_VARS_PATH },
    { label: 'environment', type: ENVIRONMENT_ENTITY_TYPE, varsPath: 'variables' },
    { label: 'template-collection', type: TEMPLATE_COLLECTION_ENTITY_TYPE, varsPath: 'variables' },
    { label: 'request-collection', type: REQUEST_COLLECTION_ENTITY_TYPE, varsPath: 'variables' },
  ];

  for (const { label, type } of variableScopes) {
    it(`a ${label} delete invalidates the resolver keyed by the entity id`, () => {
      expect(deriveSideEffectsForEnvelope(mkEnvelope({ kind: 'delete', type, id: 'e1' }))).toEqual([
        { kind: INVALIDATE_RESOLVER, key: 'e1', hlc },
      ]);
    });

    it(`a ${label} create-shell derives nothing (seed splits variables into addToSet envelopes)`, () => {
      expect(deriveSideEffectsForEnvelope(mkEnvelope({ kind: 'create', type, id: 'e1', payload: {} }))).toEqual([]);
    });
  }
});
