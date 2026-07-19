/**
 * Coverage for the working-tree delta emission
 * (`sync-builders/mutations/workspace-tree-delta.ts`).
 *
 * The load-bearing properties:
 *   - three-way discipline — only files that moved against the
 *     last-materialized baseline are tree-authored; a file the engine
 *     is merely ahead of (stale materialization) emits NOTHING, so the
 *     sweep can never revert a just-applied batch;
 *   - deletions are gated on the baseline — an entity whose manifest
 *     the materializer never wrote is not deletable from the tree side;
 *   - tree-authored values converge a live store to the tree's state
 *     through the ordinary mutators (creates, diff-updates, moves).
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import type { EmissionBatch } from '../../src/sync-builders/mutations/workspace-import-emission';
import { synthesizeWorkspaceTreeDelta } from '../../src/sync-builders/mutations/workspace-tree-delta';
import type { GrpcRequest, HeaderRule, Rule, Vault, WebSocketRequest } from '../../src/types';
import type { TreeReadResult, WorkspaceTreeState } from '../../src/workspace-tree';

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

const liveReaderFor = (store: InMemoryDocumentStore) => (entityType: string, id: string, setPath: string) =>
  store
    .liveOrderedSetItems(entityType, id, setPath)
    .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item }));

function applyTo(store: InMemoryDocumentStore, batches: EmissionBatch[]): void {
  for (const { batch } of batches) {
    for (const env of batch.mutations) store.apply(env);
  }
}

const workspace = {
  schemaVersion: 5,
  uid: 'wsaaaaaa',
  name: 'Tree Delta',
  orgId: '01890000-0000-7000-8000-000000000000',
};

function emptyState(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace,
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
    ...overrides,
  };
}

function asNext(state: WorkspaceTreeState): TreeReadResult['state'] {
  return state;
}

const baseRule: HeaderRule = {
  schemaVersion: 5,
  uid: 'rul00001',
  path: 'rules/probe-rul00001',
  name: 'Probe',
  enabled: true,
  type: 'header',
  conditions: [{ uid: 'cond0001', type: 'url', operator: 'contains', value: 'openheaders.io' }],
  action: {
    requestHeaders: [{ uid: 'hdr00001', operation: 'set', headerName: 'X-A', value: '1' }],
    responseHeaders: [],
  },
} as unknown as HeaderRule;

const editedRule: HeaderRule = {
  ...baseRule,
  name: 'Probe (vim)',
  enabled: false,
} as unknown as HeaderRule;

const RULE_MANIFEST = 'rules/probe-rul00001/rule.yaml';

function delta(args: {
  prev: WorkspaceTreeState;
  next: WorkspaceTreeState;
  changed?: string[];
  removed?: string[];
  store?: InMemoryDocumentStore;
}): EmissionBatch[] {
  const store = args.store ?? new InMemoryDocumentStore();
  return synthesizeWorkspaceTreeDelta({
    prev: args.prev,
    next: asNext(args.next),
    changedPaths: new Set(args.changed ?? []),
    removedPaths: new Set(args.removed ?? []),
    deps: { nextCtx, liveSetEntries: liveReaderFor(store) },
  });
}

describe('synthesizeWorkspaceTreeDelta — three-way discipline', () => {
  it('a file the engine is ahead of (unchanged vs baseline) emits nothing', () => {
    // Engine holds the edited rule; the tree still holds the stale
    // pre-edit bytes, but the file matches the baseline (not changed).
    const batches = delta({
      prev: emptyState({ rules: [editedRule as Rule] }),
      next: emptyState({ rules: [baseRule as Rule] }),
      changed: [],
    });
    expect(batches).toHaveLength(0);
  });

  it('a hand-edited manifest converges the store to the tree value', () => {
    const store = new InMemoryDocumentStore();
    const seed = delta({
      prev: emptyState(),
      next: emptyState({ rules: [baseRule as Rule] }),
      changed: [RULE_MANIFEST],
      store,
    });
    applyTo(store, seed);

    const batches = delta({
      prev: emptyState({ rules: [baseRule as Rule] }),
      next: emptyState({ rules: [editedRule as Rule] }),
      changed: [RULE_MANIFEST],
      store,
    });
    expect(batches.length).toBeGreaterThan(0);
    applyTo(store, batches);
    const data = store.materializeOne('rule', 'rul00001')?.data as HeaderRule;
    expect(data.name).toBe('Probe (vim)');
    expect(data.enabled).toBe(false);
  });

  it('a hand-added manifest emits a create-first seed batch', () => {
    const batches = delta({
      prev: emptyState(),
      next: emptyState({ rules: [baseRule as Rule] }),
      changed: [RULE_MANIFEST],
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].batch.mutations[0].body.kind).toBe('create');
  });

  it('an unchanged tree-authored file (formatting-only edit) emits nothing', () => {
    const batches = delta({
      prev: emptyState({ rules: [baseRule as Rule] }),
      next: emptyState({ rules: [baseRule as Rule] }),
      changed: [RULE_MANIFEST],
    });
    expect(batches).toHaveLength(0);
  });
});

describe('synthesizeWorkspaceTreeDelta — deletions', () => {
  it('a manifest missing from disk but present in the baseline tombstones the entity', () => {
    const batches = delta({
      prev: emptyState({ rules: [baseRule as Rule] }),
      next: emptyState(),
      removed: [RULE_MANIFEST],
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].batch.mutations[0].body).toMatchObject({ kind: 'delete', type: 'rule', id: 'rul00001' });
  });

  it('an engine entity the materializer never wrote is NOT deleted by its absence', () => {
    const batches = delta({
      prev: emptyState({ rules: [baseRule as Rule] }),
      next: emptyState(),
      removed: [],
    });
    expect(batches).toHaveLength(0);
  });
});

describe('synthesizeWorkspaceTreeDelta — moves', () => {
  it('a directory rename emits a single path setField', () => {
    const moved = { ...baseRule, path: 'rules/renamed-rul00001' } as Rule;
    const batches = delta({
      prev: emptyState({ rules: [baseRule as Rule] }),
      next: emptyState({ rules: [moved] }),
      changed: ['rules/renamed-rul00001/rule.yaml'],
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: 'rule',
      path: 'path',
      value: 'rules/renamed-rul00001',
    });
  });

  it('a folder moved across parents is guarded (engine placement stands)', () => {
    const colA = { schemaVersion: 5, uid: 'col0000a', path: 'rules/col-a-col0000a', name: 'A' } as never;
    const colB = { schemaVersion: 5, uid: 'col0000b', path: 'rules/col-b-col0000b', name: 'B' } as never;
    const folderAtA = {
      schemaVersion: 5,
      uid: 'fol00001',
      path: 'rules/col-a-col0000a/sub-fol00001',
      name: 'Sub',
    } as never;
    const folderAtB = {
      schemaVersion: 5,
      uid: 'fol00001',
      path: 'rules/col-b-col0000b/sub-fol00001',
      name: 'Sub',
    } as never;
    const batches = delta({
      prev: emptyState({ collections: [colA, colB], folders: [folderAtA] }),
      next: emptyState({ collections: [colA, colB], folders: [folderAtB] }),
      changed: ['rules/col-b-col0000b/sub-fol00001/_folder.yaml'],
    });
    // No path move; the update entry for the folder itself carries no
    // changed scalar keys either, so the delta is empty.
    expect(batches).toHaveLength(0);
  });
});

describe('synthesizeWorkspaceTreeDelta — singletons', () => {
  const vaultValue: Vault = {
    schemaVersion: 5,
    secrets: [{ uid: 'sec00001', kind: 'string', name: 'token', value: 's3cr3t' }],
  };

  it('a changed vault file replaces via set-diff', () => {
    const store = new InMemoryDocumentStore();
    applyTo(
      store,
      delta({
        prev: emptyState(),
        next: emptyState({ vault: vaultValue }),
        changed: ['workspace-vars.secret.yaml'],
        store,
      }),
    );
    const batches = delta({
      prev: emptyState({ vault: vaultValue }),
      next: emptyState({ vault: { schemaVersion: 5, secrets: [] } }),
      changed: ['workspace-vars.secret.yaml'],
      store,
    });
    expect(batches.length).toBeGreaterThan(0);
    expect(batches[0].batch.mutations.some((m) => m.body.kind === 'removeFromSet')).toBe(true);
  });

  it('a changed-but-unparseable singleton file never wipes the engine value', () => {
    // Parse failure surfaces as `next.vault === null` + a read issue.
    const batches = delta({
      prev: emptyState({ vault: vaultValue }),
      next: emptyState({ vault: null }),
      changed: ['workspace-vars.secret.yaml'],
    });
    expect(batches).toHaveLength(0);
  });
});

describe('synthesizeWorkspaceTreeDelta — gRPC / WebSocket families', () => {
  const grpc: GrpcRequest = {
    schemaVersion: 5,
    uid: 'grp00001',
    path: 'requests/echo-grp00001',
    name: 'Echo',
    url: 'grpcs://api.openheaders.io',
    metadata: [],
  } as unknown as GrpcRequest;

  const websocket: WebSocketRequest = {
    schemaVersion: 5,
    uid: 'wsr00001',
    path: 'requests/live-wsr00001',
    name: 'Live',
    url: 'wss://events.openheaders.io/live',
    flavor: 'raw',
    headers: [],
    params: [],
  } as unknown as WebSocketRequest;

  it('hand-added grpc + websocket manifests seed', () => {
    const batches = delta({
      prev: emptyState(),
      next: emptyState({ grpcRequests: [grpc], websocketRequests: [websocket] }),
      changed: ['requests/echo-grp00001/grpc.yaml', 'requests/live-wsr00001/websocket.yaml'],
    });
    expect(batches.map((b) => b.label).sort()).toEqual([
      'grpc-request:grp00001 (create)',
      'websocket-request:wsr00001 (create)',
    ]);
  });

  it('a hand-edit on a websocket manifest emits a scalar update', () => {
    const store = new InMemoryDocumentStore();
    applyTo(
      store,
      delta({
        prev: emptyState(),
        next: emptyState({ websocketRequests: [websocket] }),
        changed: ['requests/live-wsr00001/websocket.yaml'],
        store,
      }),
    );
    const edited = { ...websocket, name: 'Live (vim)' } as WebSocketRequest;
    const batches = delta({
      prev: emptyState({ websocketRequests: [websocket] }),
      next: emptyState({ websocketRequests: [edited] }),
      changed: ['requests/live-wsr00001/websocket.yaml'],
      store,
    });
    expect(batches).toHaveLength(1);
    applyTo(store, batches);
    const data = store.materializeOne('websocketRequest', 'wsr00001')?.data as WebSocketRequest;
    expect(data.name).toBe('Live (vim)');
  });
});
