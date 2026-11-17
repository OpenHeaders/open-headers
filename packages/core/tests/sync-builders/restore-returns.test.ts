/**
 * A deleted entity back in the tree
 * (`sync-builders/mutations/restore-returns.ts`): the create the delta
 * mints for a uid the engine holds deleted is a restore, and nothing
 * else is. Driven through the delta against a live store, so the pins
 * hold what the law buys: the entity lives again as its file has it,
 * and a container that returns with its children holds them.
 */

import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  InMemoryDocumentStore,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '../../src/sync';
import { restoreDeletedReturns } from '../../src/sync-builders/mutations/restore-returns';
import type { EmissionBatch } from '../../src/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '../../src/sync-builders/mutations/workspace-tree-delta';
import type { Collection, HeaderRule, Rule } from '../../src/types';
import type { WorkspaceTreeState } from '../../src/workspace-tree';

let hlcMs = 1_000;
const nextCtx = (): MutatorContext => {
  hlcMs += 1_000;
  return {
    workspaceId: 'ws-1',
    orgId: 'org-test',
    hlc: { physicalMs: hlcMs, logical: 0, nodeId: 'node-tree' },
    surfaceId: 'sw',
    deviceId: 'device-a',
  };
};

function emptyState(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace: { schemaVersion: 5, uid: 'wsaaaaaa', name: 'Returns' },
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    trustedRoots: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
    ...overrides,
  };
}

const collection: Collection = {
  schemaVersion: 5,
  uid: 'col0000a',
  path: 'rules/api-col0000a',
  name: 'API',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};
const COLLECTION_MANIFEST = 'rules/api-col0000a/_collection.yaml';

const rule = {
  schemaVersion: 5,
  uid: 'rul00001',
  path: 'rules/api-col0000a/probe-rul00001',
  name: 'Probe',
  enabled: true,
  type: 'header',
  conditions: [{ uid: 'cond0001', type: 'url', operator: 'contains', value: 'openheaders.io' }],
  action: {
    requestHeaders: [{ uid: 'hdr00001', operation: 'set', headerName: 'X-A', value: '1' }],
    responseHeaders: [],
  },
} as unknown as HeaderRule as Rule;
const RULE_MANIFEST = 'rules/api-col0000a/probe-rul00001/rule.yaml';

/** A store with the tree's delta applied to it — the engine side of a sweep. */
function engine() {
  const store = new InMemoryDocumentStore();
  const sweep = (args: {
    prev: WorkspaceTreeState;
    next: WorkspaceTreeState;
    changed?: string[];
    removed?: string[];
    asksTheEngine?: boolean;
  }): EmissionBatch[] => {
    const batches = synthesizeWorkspaceTreeDelta({
      prev: args.prev,
      next: args.next,
      changedPaths: new Set(args.changed ?? []),
      removedPaths: new Set(args.removed ?? []),
      deps: {
        nextCtx,
        liveSetEntries: (entityType, id, setPath) =>
          store
            .liveOrderedSetItems(entityType, id, setPath)
            .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
      },
      ...(args.asksTheEngine === false ? {} : { isDeleted: (type, id) => store.isTombstoned(type, id) }),
    });
    for (const { batch } of batches) {
      for (const envelope of batch.mutations) store.apply(envelope);
    }
    return batches;
  };
  return { store, sweep };
}

const withBoth = emptyState({ collections: [collection], rules: [rule] });
const itemsOf = (store: InMemoryDocumentStore): string[] =>
  store.liveSetItems(COLLECTION_ENTITY_TYPE, collection.uid, FOLDER_ITEMS_PATH).map((entry) => entry.itemId);
const rootsOf = (store: InMemoryDocumentStore): string[] =>
  store
    .liveSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)
    .map((entry) => entry.itemId);

describe('a deleted entity back in the tree', () => {
  it('a rule whose file returns is restored as its file has it, in its parent', () => {
    const { store, sweep } = engine();
    sweep({ prev: emptyState(), next: withBoth, changed: [COLLECTION_MANIFEST, RULE_MANIFEST] });
    sweep({ prev: withBoth, next: emptyState({ collections: [collection] }), removed: [RULE_MANIFEST] });
    expect(store.isTombstoned(RULE_ENTITY_TYPE, rule.uid)).toBe(true);
    expect(itemsOf(store)).toEqual([]);

    const returned = { ...rule, name: 'Probe (as the branch has it)' } as Rule;
    const batches = sweep({
      prev: emptyState({ collections: [collection] }),
      next: emptyState({ collections: [collection], rules: [returned] }),
      changed: [RULE_MANIFEST],
    });

    expect(batches.map((entry) => entry.label)).toEqual(['rule:rul00001 (create)']);
    expect(batches[0].batch.mutations[0].body).toMatchObject({ kind: 'create', id: rule.uid, restore: true });
    expect(store.materializeOne(RULE_ENTITY_TYPE, rule.uid)?.data).toMatchObject({
      name: 'Probe (as the branch has it)',
      conditions: [{ uid: 'cond0001' }],
    });
    expect(itemsOf(store)).toEqual([rule.uid]);
  });

  it('a plain create for it — the engine not asked — brings nothing back', () => {
    const { store, sweep } = engine();
    sweep({ prev: emptyState(), next: withBoth, changed: [COLLECTION_MANIFEST, RULE_MANIFEST] });
    sweep({ prev: withBoth, next: emptyState({ collections: [collection] }), removed: [RULE_MANIFEST] });

    const batches = sweep({
      prev: emptyState({ collections: [collection] }),
      next: withBoth,
      changed: [RULE_MANIFEST],
      asksTheEngine: false,
    });

    expect(batches[0].batch.mutations[0].body).not.toHaveProperty('restore');
    expect(store.materializeOne(RULE_ENTITY_TYPE, rule.uid)).toBeNull();
  });

  it('a collection that returns with its rule is restored first, and holds the rule', () => {
    const { store, sweep } = engine();
    sweep({ prev: emptyState(), next: withBoth, changed: [COLLECTION_MANIFEST, RULE_MANIFEST] });
    sweep({ prev: withBoth, next: emptyState(), removed: [COLLECTION_MANIFEST, RULE_MANIFEST] });
    expect(store.isTombstoned(COLLECTION_ENTITY_TYPE, collection.uid)).toBe(true);
    expect(store.isTombstoned(RULE_ENTITY_TYPE, rule.uid)).toBe(true);

    const batches = sweep({ prev: emptyState(), next: withBoth, changed: [COLLECTION_MANIFEST, RULE_MANIFEST] });

    const restores = batches.flatMap((entry) => entry.batch.mutations).filter((m) => m.body.kind === 'create');
    expect(restores.map((m) => m.body)).toMatchObject([
      { type: COLLECTION_ENTITY_TYPE, id: collection.uid, restore: true },
      { type: RULE_ENTITY_TYPE, id: rule.uid, restore: true },
    ]);
    expect(store.materializeOne(COLLECTION_ENTITY_TYPE, collection.uid)).not.toBeNull();
    expect(store.materializeOne(RULE_ENTITY_TYPE, rule.uid)).not.toBeNull();
    expect(rootsOf(store)).toEqual([collection.uid]);
    expect(itemsOf(store)).toEqual([rule.uid]);
  });

  it('a create for a uid the engine never deleted stays a plain create', () => {
    const { sweep } = engine();
    const batches = sweep({ prev: emptyState(), next: withBoth, changed: [COLLECTION_MANIFEST, RULE_MANIFEST] });

    const creates = batches.flatMap((entry) => entry.batch.mutations).filter((m) => m.body.kind === 'create');
    expect(creates).toHaveLength(2);
    for (const envelope of creates) expect(envelope.body).not.toHaveProperty('restore');
  });

  it('only the create is marked: the batch keeps its label, its other envelopes and its side effects', () => {
    const { sweep } = engine();
    const [seed] = sweep({
      prev: emptyState({ collections: [collection] }),
      next: withBoth,
      changed: [RULE_MANIFEST],
      asksTheEngine: false,
    });

    const [marked] = restoreDeletedReturns([seed], (type, id) => type === RULE_ENTITY_TYPE && id === rule.uid);
    expect(marked.label).toBe(seed.label);
    expect(marked.sideEffects).toBe(seed.sideEffects);
    expect(marked.batch.batchId).toBe(seed.batch.batchId);
    expect(marked.batch.mutations.map((m) => m.mutationId)).toEqual(seed.batch.mutations.map((m) => m.mutationId));
    expect(marked.batch.mutations.slice(1)).toEqual(seed.batch.mutations.slice(1));
    expect(marked.batch.mutations[0].body).toEqual({ ...seed.batch.mutations[0].body, restore: true });

    const [untouched] = restoreDeletedReturns([seed], () => false);
    expect(untouched).toBe(seed);
  });
});
