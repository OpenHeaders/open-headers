/**
 * Coverage for `order:` stamping (`workspace-tree/order.ts`) and its
 * trip through the planner + reader: the live sets become directory
 * names on every container and the manifest, and what the planner
 * writes the reader hands back.
 */

import { describe, expect, it } from 'vitest';
import {
  FOLDER_CHILDREN_PATH,
  FOLDER_ITEMS_PATH,
  type ParentRefShape,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ITEMS_PATH,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '../../src/sync';
import type { Collection, Folder, Request, Rule } from '../../src/types';
import {
  applyTreeOrder,
  indexSegments,
  planWorkspaceTree,
  readWorkspaceTree,
  recordChildOrder,
  type WorkspaceTreeState,
} from '../../src/workspace-tree';

const workspace = { schemaVersion: 5 as const, uid: 'wsaaaaaa', name: 'Order' };

const ruleCollection: Collection = {
  schemaVersion: 5,
  uid: 'col0000a',
  path: 'rules/a-col0000a',
  name: 'A',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};
const ruleCollectionB: Collection = {
  schemaVersion: 5,
  uid: 'col0000b',
  path: 'rules/b-col0000b',
  name: 'B',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};
const folder: Folder = { schemaVersion: 5, uid: 'fol00001', path: 'rules/a-col0000a/sub-fol00001', name: 'Sub' };
const rule = (uid: string, slug: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/a-col0000a/${slug}-${uid}`,
    name: slug,
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  }) as Rule;
const requestCollection: Collection = {
  schemaVersion: 5,
  uid: 'rco0000a',
  path: 'requests/api-rco0000a',
  name: 'API',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};
const request: Request = {
  schemaVersion: 5,
  uid: 'req00001',
  path: 'requests/api-rco0000a/ping-req00001',
  name: 'Ping',
  method: 'GET',
  url: 'https://api.openheaders.io/ping',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none' },
} as unknown as Request;

function state(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace,
    rules: [rule('rul0000a', 'a'), rule('rul0000b', 'b')],
    collections: [ruleCollection, ruleCollectionB],
    folders: [folder],
    requests: [request],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [requestCollection],
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

/** Slots per `<type>:<uid>:<setPath>` as `uid:key` strings, in key order. */
type Slots = Record<string, string[]>;

const slotKey = (parent: ParentRefShape, setPath: string): string => `${parent.type}:${parent.uid}:${setPath}`;

const reader = (slots: Slots) => (parent: ParentRefShape, setPath: string) =>
  (slots[slotKey(parent, setPath)] ?? []).map((entry) => {
    const [uid, orderKey] = entry.split(':');
    return { uid, orderKey };
  });

// The folder is keyed BETWEEN the two rules: the stamp merges the sets by key.
const SLOTS: Slots = {
  [`workspace-roots:${WORKSPACE_ROOTS_ID}:${WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH}`]: ['col0000b:m', 'col0000a:s'],
  [`workspace-roots:${WORKSPACE_ROOTS_ID}:${WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH}`]: ['rco0000a:m'],
  [`collection:col0000a:${FOLDER_CHILDREN_PATH}`]: ['fol00001:p'],
  [`collection:col0000a:${FOLDER_ITEMS_PATH}`]: ['rul0000b:m', 'rul0000a:s'],
  [`request-collection:rco0000a:${REQUEST_FOLDER_ITEMS_PATH}`]: ['req00001:m'],
  [`request-collection:rco0000a:${REQUEST_FOLDER_CHILDREN_PATH}`]: [],
};

describe('applyTreeOrder', () => {
  it('stamps the merged child order on every container and the roots per tree on the manifest', () => {
    const stamped = applyTreeOrder(state(), reader(SLOTS));
    expect(stamped.workspace.order).toEqual({ rules: ['b-col0000b', 'a-col0000a'], requests: ['api-rco0000a'] });
    expect(stamped.collections[0].order).toEqual(['b-rul0000b', 'sub-fol00001', 'a-rul0000a']);
    expect(stamped.requestCollections[0].order).toEqual(['ping-req00001']);
  });

  it('an equal key across the two sets breaks by uid, as inside one set', () => {
    const slots: Slots = { ...SLOTS, [`collection:col0000a:${FOLDER_CHILDREN_PATH}`]: ['fol00001:m'] };
    const stamped = applyTreeOrder(state(), reader(slots));
    expect(stamped.collections[0].order).toEqual(['sub-fol00001', 'b-rul0000b', 'a-rul0000a']);
  });

  it('a container without children carries no key; a stale key on the input is dropped', () => {
    const stale = { ...ruleCollectionB, order: ['gone-xxxxxxxx'] };
    const stamped = applyTreeOrder(state({ collections: [ruleCollection, stale] }), reader(SLOTS));
    expect('order' in stamped.collections[1]).toBe(false);
    expect('order' in stamped.folders[0]).toBe(false);
  });

  it('a slot whose child is not in the snapshot names no directory', () => {
    const slots: Slots = { ...SLOTS, [`collection:col0000a:${FOLDER_ITEMS_PATH}`]: ['dead0000:m', 'rul0000a:s'] };
    const stamped = applyTreeOrder(state(), reader(slots));
    expect(stamped.collections[0].order).toEqual(['sub-fol00001', 'a-rul0000a']);
  });

  it('an empty roots set leaves the manifest without an order key', () => {
    const stamped = applyTreeOrder(state(), reader({}));
    expect('order' in stamped.workspace).toBe(false);
  });

  it('the stamp never mutates the input', () => {
    const input = state();
    applyTreeOrder(input, reader(SLOTS));
    expect('order' in input.collections[0]).toBe(false);
    expect('order' in input.workspace).toBe(false);
  });
});

describe('recordChildOrder', () => {
  const segmentOf = indexSegments([ruleCollection], [folder], [rule('rul0000a', 'a'), rule('rul0000b', 'b')]);

  it("hands back the record's merged children as directory segments, skipping children the index does not know", () => {
    const record = {
      schemaVersion: 5 as const,
      containers: { 'collection:col0000a': { children: ['rul0000b', 'fol00001', 'dead0000', 'rul0000a'] } },
    };
    expect(recordChildOrder(record, { type: 'collection', uid: 'col0000a' }, segmentOf)).toEqual([
      'b-rul0000b',
      'sub-fol00001',
      'a-rul0000a',
    ]);
  });

  it('a legacy entry reads folders then items; an unlisted container gets nothing', () => {
    const record = {
      schemaVersion: 5 as const,
      containers: { 'collection:col0000a': { folders: ['fol00001'], items: ['rul0000b', 'rul0000a'] } },
    };
    expect(recordChildOrder(record, { type: 'collection', uid: 'col0000a' }, segmentOf)).toEqual([
      'sub-fol00001',
      'b-rul0000b',
      'a-rul0000a',
    ]);
    expect(recordChildOrder(record, { type: 'collection', uid: 'col0000b' }, segmentOf)).toEqual([]);
  });
});

describe('order: through plan → read', () => {
  it('what the planner writes the reader hands back, and a replan is a byte fixpoint', () => {
    const stamped = applyTreeOrder(state(), reader(SLOTS));
    const plan = planWorkspaceTree(stamped);
    const manifest = plan.find((file) => file.path === 'workspace.yaml');
    expect(manifest?.content).toContain(
      'order:\n  rules:\n    - b-col0000b\n    - a-col0000a\n  requests:\n    - api-rco0000a\n',
    );
    const collectionYaml = plan.find((file) => file.path === 'rules/a-col0000a/_collection.yaml');
    expect(collectionYaml?.content).toContain('order:\n  - b-rul0000b\n  - sub-fol00001\n  - a-rul0000a\n');

    const read = readWorkspaceTree(plan);
    expect(read.issues).toEqual([]);
    if (read.state.workspace === null) throw new Error('workspace not recovered');
    expect(read.state.workspace.order).toEqual(stamped.workspace.order);
    expect(read.state.collections.find((c) => c.uid === 'col0000a')?.order).toEqual(stamped.collections[0].order);
    expect('order' in (read.state.collections.find((c) => c.uid === 'col0000b') ?? {})).toBe(false);

    const replan = planWorkspaceTree({ ...read.state, workspace: read.state.workspace }, read.unknowns);
    expect(replan).toEqual(plan);
  });

  it('a manifest without order: reads as no opinion', () => {
    const plan = planWorkspaceTree(state());
    const read = readWorkspaceTree(plan);
    expect(read.state.workspace?.order).toBeUndefined();
    expect(read.state.collections.every((c) => c.order === undefined)).toBe(true);
  });
});
