/**
 * Coverage for the commit-change model (`workspace-tree/commit-change.ts`)
 * — one commit's own change laid over the branch's state, the input of
 * Cherry-Pick and Revert.
 *
 * The load-bearing properties:
 *   - only what the commit did travels: the branch's own edits to the
 *     same entity survive, and a commit the branch already holds is a
 *     no-op;
 *   - the result is the tree delta's input as it stands — run through
 *     the real synthesizer it converges a live store, order included;
 *   - a revert is the same change read the other way;
 *   - what cannot be taken is skipped and named, what both sides
 *     changed is named, and nothing is ever dropped silently.
 */

import { describe, expect, it } from 'vitest';
import { FOLDER_ITEMS_PATH, InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import type { EmissionBatch } from '../../src/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '../../src/sync-builders/mutations/workspace-tree-delta';
import type { Collection, Environment, Folder, HeaderRule, Rule, WorkspaceVariables } from '../../src/types';
import { applyCommitChange, type CommitChange, type WorkspaceTreeState } from '../../src/workspace-tree';

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

const workspace = {
  schemaVersion: 5,
  uid: 'wsaaaaaa',
  name: 'Commit Change',
  orgId: '01890000-0000-7000-8000-000000000000',
};

function state(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace,
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

const COL_A = 'rules/col-a-col0000a';
const COL_B = 'rules/col-b-col0000b';

const collection = (uid: string, path: string, order?: string[]): Collection => ({
  schemaVersion: 5,
  uid,
  path,
  name: uid,
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  ...(order ? { order } : {}),
});

const folder = (uid: string, path: string, order?: string[]): Folder =>
  ({ schemaVersion: 5, uid, path, name: uid, ...(order ? { order } : {}) }) as Folder;

const rule = (uid: string, slug: string, parentPath = COL_A, overrides: Partial<HeaderRule> = {}): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `${parentPath}/${slug}-${uid}`,
    name: slug,
    enabled: true,
    type: 'header',
    conditions: [{ uid: 'cond0001', type: 'url', operator: 'contains', value: 'openheaders.io' }],
    action: {
      requestHeaders: [{ uid: 'hdr00001', operation: 'set', headerName: 'X-Probe', value: 'probe-two' }],
      responseHeaders: [],
    },
    ...overrides,
  }) as unknown as Rule;

const manifestOf = (entity: { path: string }, file = 'rule.yaml'): string => `${entity.path}/${file}`;

const a = rule('rul0000a', 'a');
const b = rule('rul0000b', 'b');
const c = rule('rul0000c', 'c');
const d = rule('rul0000d', 'd');
const mine = rule('rul0000m', 'm');
const ORDER_ABC = ['a-rul0000a', 'b-rul0000b', 'c-rul0000c'];

const liveReaderFor = (store: InMemoryDocumentStore) => (entityType: string, id: string, setPath: string) =>
  store
    .liveOrderedSetItems(entityType, id, setPath)
    .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item }));

function applyTo(store: InMemoryDocumentStore, batches: EmissionBatch[]): void {
  for (const { batch } of batches) {
    for (const env of batch.mutations) store.apply(env);
  }
}

/** A store converged to `seed` — every document of it tree-authored. */
function storeHolding(seed: WorkspaceTreeState): InMemoryDocumentStore {
  const store = new InMemoryDocumentStore();
  const changed = [
    ...seed.collections.map((entity) => manifestOf(entity, '_collection.yaml')),
    ...seed.rules.map((entity) => manifestOf(entity)),
  ];
  applyTo(
    store,
    synthesizeWorkspaceTreeDelta({
      prev: state(),
      next: seed,
      changedPaths: new Set(changed),
      removedPaths: new Set(),
      deps: { nextCtx, liveSetEntries: liveReaderFor(store) },
    }),
  );
  return store;
}

/** The change through the real delta, applied to the store that holds `current`. */
function land(store: InMemoryDocumentStore, current: WorkspaceTreeState, change: CommitChange): EmissionBatch[] {
  const batches = synthesizeWorkspaceTreeDelta({
    prev: current,
    next: change.next,
    changedPaths: change.changedPaths,
    removedPaths: change.removedPaths,
    deps: { nextCtx, liveSetEntries: liveReaderFor(store) },
  });
  applyTo(store, batches);
  return batches;
}

const liveOrder = (store: InMemoryDocumentStore, id = 'col0000a') =>
  store.liveOrderedSetItems('collection', id, FOLDER_ITEMS_PATH).map((entry) => entry.itemId);

const withHeaderValue = (base: Rule, value: string): Rule =>
  ({
    ...base,
    action: {
      requestHeaders: [{ uid: 'hdr00001', operation: 'set', headerName: 'X-Probe', value }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

describe('applyCommitChange — only what the commit did travels', () => {
  it('a commit the branch already holds changes nothing', () => {
    const tree = state({ collections: [collection('col0000a', COL_A, ORDER_ABC)], rules: [a, b, c] });
    const parent = state({ collections: [collection('col0000a', COL_A, ['a-rul0000a'])], rules: [a] });
    const change = applyCommitChange({ current: tree, from: parent, to: tree });
    expect(change.changedPaths.size + change.removedPaths.size).toBe(0);
    expect(change.next).toEqual(tree);
    expect(change.conflicts).toEqual([]);
    expect(change.skipped).toEqual([]);
  });

  it("the branch's rename survives a picked edit to another key of the same entity", () => {
    const renamed = { ...a, name: 'Status Probe v2' } as Rule;
    const current = state({ collections: [collection('col0000a', COL_A, ['a-rul0000a'])], rules: [renamed] });
    const from = state({ collections: [collection('col0000a', COL_A, ['a-rul0000a'])], rules: [a] });
    const to = state({ ...from, rules: [withHeaderValue(a, 'probe-auth')] });

    const change = applyCommitChange({ current, from, to });
    expect(change.next.rules).toEqual([withHeaderValue(renamed, 'probe-auth')]);
    expect([...change.changedPaths]).toEqual([manifestOf(a)]);
    expect(change.conflicts).toEqual([]);

    const store = storeHolding(current);
    const batches = land(store, current, change);
    expect(batches.map((batch) => batch.label)).toEqual(['rule:rul0000a (update)']);
    const data = store.materializeOne('rule', 'rul0000a')?.data as HeaderRule;
    expect(data.name).toBe('Status Probe v2');
    expect(data.action.requestHeaders[0].value).toBe('probe-auth');
  });

  it('a value both sides changed takes the commit and names the document', () => {
    const current = state({ rules: [{ ...a, name: 'Local name' } as Rule] });
    const from = state({ rules: [a] });
    const to = state({ rules: [{ ...a, name: 'Picked name' } as Rule] });
    const change = applyCommitChange({ current, from, to });
    expect(change.next.rules[0].name).toBe('Picked name');
    expect(change.conflicts).toEqual([{ uid: 'rul0000a', path: manifestOf(a) }]);
  });
});

describe('applyCommitChange — creations and order', () => {
  const current = state({
    collections: [collection('col0000a', COL_A, [...ORDER_ABC, 'm-rul0000m'])],
    rules: [a, b, c, mine],
  });
  const from = state({ collections: [collection('col0000a', COL_A, ORDER_ABC)], rules: [a, b, c] });
  const to = state({
    collections: [collection('col0000a', COL_A, ['a-rul0000a', 'd-rul0000d', 'b-rul0000b', 'c-rul0000c'])],
    rules: [a, b, c, d],
  });

  it('a created entity lands at its place in the order, beside what the branch added on its own', () => {
    const change = applyCommitChange({ current, from, to });
    expect(change.next.rules.map((entity) => entity.uid)).toEqual([
      'rul0000a',
      'rul0000b',
      'rul0000c',
      'rul0000m',
      'rul0000d',
    ]);
    expect(change.next.collections[0].order).toEqual([
      'a-rul0000a',
      'd-rul0000d',
      'b-rul0000b',
      'c-rul0000c',
      'm-rul0000m',
    ]);
    expect([...change.changedPaths].sort()).toEqual([`${COL_A}/_collection.yaml`, manifestOf(d)].sort());

    const store = storeHolding(current);
    expect(liveOrder(store)).toEqual(['rul0000a', 'rul0000b', 'rul0000c', 'rul0000m']);
    land(store, current, change);
    expect(liveOrder(store)).toEqual(['rul0000a', 'rul0000d', 'rul0000b', 'rul0000c', 'rul0000m']);
  });

  it('a revert is the same change read the other way', () => {
    const picked = applyCommitChange({ current, from, to });
    const store = storeHolding(current);
    land(store, current, picked);

    const afterPick = state({ collections: picked.next.collections, rules: picked.next.rules });
    const reverted = applyCommitChange({ current: afterPick, from: to, to: from });
    expect([...reverted.removedPaths]).toEqual([manifestOf(d)]);
    expect(reverted.next.rules.map((entity) => entity.uid)).toEqual(['rul0000a', 'rul0000b', 'rul0000c', 'rul0000m']);
    expect(reverted.conflicts).toEqual([]);

    land(store, afterPick, reverted);
    expect(liveOrder(store)).toEqual(['rul0000a', 'rul0000b', 'rul0000c', 'rul0000m']);
  });

  it('a created entity lands under the parent as the branch holds it', () => {
    const elsewhere = 'rules/renamed-on-the-branch-col0000a';
    const branch = state({ collections: [collection('col0000a', elsewhere)], rules: [] });
    const change = applyCommitChange({
      current: branch,
      from: state({ collections: [collection('col0000a', COL_A)] }),
      to: state({ collections: [collection('col0000a', COL_A, ['d-rul0000d'])], rules: [d] }),
    });
    expect(change.next.rules.map((entity) => entity.path)).toEqual([`${elsewhere}/d-rul0000d`]);
    expect(change.changedPaths.has(`${elsewhere}/d-rul0000d/rule.yaml`)).toBe(true);
  });

  it('a new collection joins the roots order the branch holds', () => {
    const ordered = (roots: string[]) => ({ ...workspace, order: { rules: roots } });
    const change = applyCommitChange({
      current: state({
        workspace: ordered(['own-colown00', 'col-a-col0000a']),
        collections: [collection('colown00', 'rules/own-colown00'), collection('col0000a', COL_A)],
      }),
      from: state({ workspace: ordered(['col-a-col0000a']), collections: [collection('col0000a', COL_A)] }),
      to: state({
        workspace: ordered(['col-a-col0000a', 'col-b-col0000b']),
        collections: [collection('col0000a', COL_A), collection('col0000b', COL_B)],
      }),
    });
    expect(change.next.workspace?.order).toEqual({ rules: ['own-colown00', 'col-a-col0000a', 'col-b-col0000b'] });
    expect(change.changedPaths.has('workspace.yaml')).toBe(true);
    expect(change.changedPaths.has(`${COL_B}/_collection.yaml`)).toBe(true);
  });
});

describe('applyCommitChange — moves', () => {
  it('a leaf the commit moved follows to the same parent on the branch', () => {
    const both = [collection('col0000a', COL_A), collection('col0000b', COL_B)];
    const moved = rule('rul0000a', 'a', COL_B);
    const change = applyCommitChange({
      current: state({ collections: both, rules: [{ ...a, name: 'Local name' } as Rule] }),
      from: state({ collections: both, rules: [a] }),
      to: state({ collections: both, rules: [moved] }),
    });
    expect(change.next.rules).toEqual([{ ...moved, name: 'Local name' }]);
    expect([...change.changedPaths]).toEqual([manifestOf(moved)]);
    expect(change.conflicts).toEqual([]);
  });

  it('what the branch keeps beneath a moved folder follows it', () => {
    const OLD = `${COL_A}/group-fld0000a`;
    const NEW = `${COL_B}/group-fld0000a`;
    const both = [collection('col0000a', COL_A), collection('col0000b', COL_B)];
    const inside = rule('rul0000a', 'a', OLD);
    const own = rule('rul0000m', 'm', OLD);
    const change = applyCommitChange({
      current: state({ collections: both, folders: [folder('fld0000a', OLD)], rules: [inside, own] }),
      from: state({ collections: both, folders: [folder('fld0000a', OLD)], rules: [inside] }),
      to: state({ collections: both, folders: [folder('fld0000a', NEW)], rules: [rule('rul0000a', 'a', NEW)] }),
    });
    expect(change.next.folders.map((entity) => entity.path)).toEqual([NEW]);
    expect(change.next.rules.map((entity) => entity.path).sort()).toEqual([`${NEW}/a-rul0000a`, `${NEW}/m-rul0000m`]);
    expect(change.changedPaths.has(`${NEW}/m-rul0000m/rule.yaml`)).toBe(true);
  });
});

describe('applyCommitChange — what is not taken is named', () => {
  it('an edit to an entity the branch no longer has is skipped', () => {
    const change = applyCommitChange({
      current: state(),
      from: state({ rules: [a] }),
      to: state({ rules: [{ ...a, name: 'Picked name' } as Rule] }),
    });
    expect(change.next.rules).toEqual([]);
    expect(change.skipped).toEqual([{ uid: 'rul0000a', path: manifestOf(a), reason: 'missing' }]);
    expect(change.changedPaths.size).toBe(0);
  });

  it('a creation under a container the branch does not have is skipped', () => {
    const change = applyCommitChange({
      current: state(),
      from: state({ collections: [collection('col0000a', COL_A)] }),
      to: state({ collections: [collection('col0000a', COL_A, ['d-rul0000d'])], rules: [d] }),
    });
    expect(change.next.rules).toEqual([]);
    expect(change.skipped).toEqual([
      { uid: 'col0000a', path: `${COL_A}/_collection.yaml`, reason: 'missing' },
      { uid: 'rul0000d', path: manifestOf(d), reason: 'parent-missing' },
    ]);
  });

  it('a deleted container the branch still keeps something in stays, emptied of what the commit removed', () => {
    const change = applyCommitChange({
      current: state({ collections: [collection('col0000a', COL_A)], rules: [a, b, mine] }),
      from: state({ collections: [collection('col0000a', COL_A)], rules: [a, b] }),
      to: state(),
    });
    expect(change.next.rules.map((entity) => entity.uid)).toEqual(['rul0000m']);
    expect(change.next.collections.map((entity) => entity.uid)).toEqual(['col0000a']);
    expect([...change.removedPaths].sort()).toEqual([manifestOf(a), manifestOf(b)]);
    expect(change.skipped).toEqual([{ uid: 'col0000a', path: `${COL_A}/_collection.yaml`, reason: 'not-empty' }]);
  });

  it('a deleted container with nothing of the branch left in it leaves with its content', () => {
    const tree = state({ collections: [collection('col0000a', COL_A)], rules: [a, b] });
    const change = applyCommitChange({ current: tree, from: tree, to: state() });
    expect(change.next.rules).toEqual([]);
    expect(change.next.collections).toEqual([]);
    expect([...change.removedPaths].sort()).toEqual([`${COL_A}/_collection.yaml`, manifestOf(a), manifestOf(b)].sort());
    expect(change.skipped).toEqual([]);
  });

  it('deleting an entity the branch edited names the document', () => {
    const change = applyCommitChange({
      current: state({ rules: [{ ...a, name: 'Local name' } as Rule] }),
      from: state({ rules: [a] }),
      to: state(),
    });
    expect(change.next.rules).toEqual([]);
    expect(change.conflicts).toEqual([{ uid: 'rul0000a', path: manifestOf(a) }]);
  });
});

describe('applyCommitChange — environments and singletons', () => {
  const variable = (uid: string, name: string, value: string, type: 'default' | 'secret' = 'default') => ({
    uid,
    name,
    value,
    type,
  });
  const environment = (name: string, variables: ReturnType<typeof variable>[]): Environment =>
    ({ schemaVersion: 5, uid: 'env0000a', name, variables }) as Environment;

  it("an environment edit keeps the branch's secret rows, which no commit carries", () => {
    const secret = variable('var0000s', 'TOKEN', 'local-secret', 'secret');
    const change = applyCommitChange({
      current: state({ environments: [environment('Staging', [variable('var0000a', 'URL', 'old'), secret])] }),
      from: state({ environments: [environment('Staging', [variable('var0000a', 'URL', 'old')])] }),
      to: state({ environments: [environment('Staging', [variable('var0000a', 'URL', 'new')])] }),
    });
    expect(change.next.environments[0].variables).toEqual([variable('var0000a', 'URL', 'new'), secret]);
    expect([...change.changedPaths]).toEqual(['environments/staging-env0000a.yaml']);
  });

  it('a created environment lands, a deleted one leaves under its own file name', () => {
    const staging = environment('Staging', []);
    const created = applyCommitChange({ current: state(), from: state(), to: state({ environments: [staging] }) });
    expect(created.next.environments).toEqual([staging]);
    expect([...created.changedPaths]).toEqual(['environments/staging-env0000a.yaml']);

    const renamed = environment('Staging EU', []);
    const deleted = applyCommitChange({
      current: state({ environments: [renamed] }),
      from: state({ environments: [staging] }),
      to: state(),
    });
    expect(deleted.next.environments).toEqual([]);
    expect([...deleted.removedPaths]).toEqual(['environments/staging-eu-env0000a.yaml']);
    expect(deleted.conflicts).toEqual([{ uid: 'env0000a', path: 'environments/staging-env0000a.yaml' }]);
  });

  it('the workspace variables are patched row by row', () => {
    const vars = (rows: ReturnType<typeof variable>[]): WorkspaceVariables => ({ schemaVersion: 5, variables: rows });
    const change = applyCommitChange({
      current: state({ workspaceVariables: vars([variable('var0000a', 'A', '1'), variable('var0000m', 'M', 'mine')]) }),
      from: state({ workspaceVariables: vars([variable('var0000a', 'A', '1')]) }),
      to: state({ workspaceVariables: vars([variable('var0000a', 'A', '2'), variable('var0000n', 'N', 'new')]) }),
    });
    expect(change.next.workspaceVariables?.variables).toEqual([
      variable('var0000a', 'A', '2'),
      variable('var0000n', 'N', 'new'),
      variable('var0000m', 'M', 'mine'),
    ]);
    expect([...change.changedPaths]).toEqual(['workspace-vars.yaml']);
  });
});

describe('applyCommitChange — a document that did not read is not a deletion', () => {
  const staging = { schemaVersion: 5, uid: 'env0000a', name: 'Staging', variables: [] } as Environment;
  const vars: WorkspaceVariables = { schemaVersion: 5, variables: [] };
  const held = state({ rules: [a, b], environments: [staging], workspaceVariables: vars });

  it('what the end tree lacks stands when the change removed no such file', () => {
    const change = applyCommitChange({ current: held, from: held, to: state({ rules: [b] }), removedPaths: new Set() });
    expect(change.next.rules).toEqual([a, b]);
    expect(change.next.environments).toEqual([staging]);
    expect(change.next.workspaceVariables).toEqual(vars);
    expect([...change.removedPaths]).toEqual([]);
    expect(change.conflicts).toEqual([]);
  });

  it('what the end tree lacks leaves where the change removed its file', () => {
    const change = applyCommitChange({
      current: held,
      from: held,
      to: state({ rules: [b] }),
      removedPaths: new Set([manifestOf(a), 'environments/staging-env0000a.yaml', 'workspace-vars.yaml']),
    });
    expect(change.next.rules).toEqual([b]);
    expect(change.next.environments).toEqual([]);
    expect(change.next.workspaceVariables).toBeNull();
    expect([...change.removedPaths].sort()).toEqual(
      [manifestOf(a), 'environments/staging-env0000a.yaml', 'workspace-vars.yaml'].sort(),
    );
  });
});
