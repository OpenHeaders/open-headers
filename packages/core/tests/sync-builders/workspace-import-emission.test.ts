/**
 * Coverage for the workspace-import local-mutation emission
 * (`sync-builders/mutations/workspace-import-emission.ts`).
 *
 * The load-bearing property: a batch stream the emission produces on
 * the importing client converges a SECOND document store (the backend /
 * a peer that already holds the pre-import target state) to the same
 * materialized result — creates materialize (create op first) and
 * update collisions converge set-modeled paths without duplicating
 * members, because every set diff keys members by their persisted uid.
 */

import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  InMemoryDocumentStore,
  type MutationBody,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '../../src/sync';
import {
  type EmissionBatch,
  type ImportEmissionPlanSlices,
  type ImportEmissionPrev,
  synthesizeImportEmission,
} from '../../src/sync-builders/mutations/workspace-import-emission';
import type { Collection, Environment, HeaderRule, Rule, Spec } from '../../src/types';
import type { ImportPlan, LocalFolder, PlanEntry } from '../../src/workspace-export';

let hlcMs = 1_000;
const nextCtx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: (hlcMs += 1_000), logical: 0, nodeId: 'node-client' },
  surfaceId: 'sw',
  deviceId: 'device-a',
});

/** Live reader over a store — the adapter the orchestrator's emit wires. */
const liveReaderFor = (store: InMemoryDocumentStore) => (entityType: string, id: string, setPath: string) =>
  store
    .liveOrderedSetItems(entityType, id, setPath)
    .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item }));

function applyTo(store: InMemoryDocumentStore, batches: EmissionBatch[]): void {
  for (const { batch } of batches) {
    for (const env of batch.mutations) store.apply(env);
  }
}

function emptyPlan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
    specs: [],
    workspaceVars: { action: 'skip', variables: [] },
    vault: { action: 'skip', secrets: [] },
    trustedRoots: { action: 'skip', roots: [] },
    uidRemap: {},
    ...overrides,
  };
}

function slicesFor(plan: ImportPlan, extra: Partial<ImportEmissionPlanSlices> = {}): ImportEmissionPlanSlices {
  return {
    plan,
    ruleCollections: [],
    requestCollections: [],
    templateCollections: [],
    ruleFolders: [],
    requestFolders: [],
    templateFolders: [],
    ...extra,
  };
}

function emptyPrev(overrides: Partial<ImportEmissionPrev> = {}): ImportEmissionPrev {
  return {
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
    specs: [],
    ruleCollections: [],
    requestCollections: [],
    templateCollections: [],
    ruleFolders: [],
    requestFolders: [],
    templateFolders: [],
    ...overrides,
  };
}

const targetRule: HeaderRule = {
  schemaVersion: 5,
  uid: 'rul00001',
  path: 'rules/probe-rul00001',
  name: 'Probe',
  enabled: true,
  type: 'header',
  conditions: [
    { uid: 'cond0001', type: 'url-filter', values: ['openheaders.io'] },
    { uid: 'cond0002', type: 'url-filter', values: ['app.openheaders.io'] },
  ],
  action: {
    requestHeaders: [
      { uid: 'hdr00001', operation: 'set', headerName: 'X-A', value: '1' },
      { uid: 'hdr00002', operation: 'set', headerName: 'X-B', value: '2' },
    ],
    responseHeaders: [],
  },
} as unknown as HeaderRule;

// Update collision: cond0002 removed, cond0001 edited, cond0003 added;
// hdr00002 edited; name + enabled changed.
const importedRule: HeaderRule = {
  ...targetRule,
  name: 'Probe (imported)',
  enabled: false,
  conditions: [
    { uid: 'cond0001', type: 'url-filter', values: ['api.openheaders.io'] },
    { uid: 'cond0003', type: 'url-regex', values: ['https://openheaders\\.io/x'] },
  ],
  action: {
    requestHeaders: [
      { uid: 'hdr00001', operation: 'set', headerName: 'X-A', value: '1' },
      { uid: 'hdr00002', operation: 'set', headerName: 'X-B', value: 'edited' },
    ],
    responseHeaders: [],
  },
} as unknown as HeaderRule;

describe('synthesizeImportEmission — creates', () => {
  it('emits a create-first seed batch that materializes on a second store', () => {
    const plan = emptyPlan({ rules: [{ action: 'create', entity: targetRule }] as PlanEntry<Rule>[] });
    const client = new InMemoryDocumentStore();
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev(), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });

    expect(batches).toHaveLength(1);
    expect(batches[0].batch.mutations[0].body.kind).toBe('create');

    const peer = new InMemoryDocumentStore();
    applyTo(client, batches);
    applyTo(peer, batches);
    const data = peer.materializeOne('rule', 'rul00001')?.data as HeaderRule;
    expect(data.name).toBe('Probe');
    expect(data.conditions).toHaveLength(2);
    expect(data.action.requestHeaders).toHaveLength(2);
  });

  it('skip entries emit nothing', () => {
    const plan = emptyPlan({ rules: [{ action: 'skip', entity: targetRule }] as PlanEntry<Rule>[] });
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev(), {
      nextCtx,
      liveSetEntries: () => [],
    });
    expect(batches).toHaveLength(0);
  });

  it('a created leaf takes its parent items slot in the same batch, stamped with its path segment', () => {
    const collection = {
      schemaVersion: 5,
      uid: 'colaaaaa',
      path: 'rules/api-colaaaaa',
      name: 'API',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    } as unknown as Collection;
    const first = { ...targetRule, uid: 'rul00001', path: 'rules/api-colaaaaa/probe-rul00001' } as HeaderRule;
    const second = { ...targetRule, uid: 'rul00002', path: 'rules/api-colaaaaa/probe-rul00002' } as HeaderRule;
    const client = new InMemoryDocumentStore();
    const batches = synthesizeImportEmission(
      slicesFor(
        emptyPlan({
          rules: [
            { action: 'create', entity: first },
            { action: 'create', entity: second },
          ] as PlanEntry<Rule>[],
        }),
      ),
      emptyPrev({ ruleCollections: [collection] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    const slots = batches.map((b) => b.batch.mutations[b.batch.mutations.length - 1].body);
    expect(slots).toMatchObject([
      {
        kind: 'addToSet',
        type: COLLECTION_ENTITY_TYPE,
        id: 'colaaaaa',
        path: FOLDER_ITEMS_PATH,
        itemId: 'rul00001',
        item: { uid: 'rul00001', type: RULE_ENTITY_TYPE },
      },
      { kind: 'addToSet', id: 'colaaaaa', path: FOLDER_ITEMS_PATH, itemId: 'rul00002' },
    ]);
    const [k1, k2] = slots.map((b) => (b as { orderKey: string }).orderKey);
    expect(k1 < k2).toBe(true);
    const shell = batches[0].batch.mutations[0].body as { payload: { pathSegment?: string } };
    expect(shell.payload.pathSegment).toBe('probe-rul00001');

    applyTo(client, batches);
    const live = client.liveOrderedSetItems(COLLECTION_ENTITY_TYPE, 'colaaaaa', FOLDER_ITEMS_PATH);
    expect(live.map((s) => s.itemId)).toEqual(['rul00001', 'rul00002']);
  });

  it('a parent the run cannot resolve still creates the leaf — slot-less, never dropped', () => {
    const orphan = { ...targetRule, path: 'rules/hand-named/probe-rul00001' } as HeaderRule;
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ rules: [{ action: 'create', entity: orphan }] as PlanEntry<Rule>[] })),
      emptyPrev(),
      { nextCtx, liveSetEntries: () => [] },
    );
    expect(batches).toHaveLength(1);
    expect(
      batches[0].batch.mutations.some((m) => m.body.kind === 'addToSet' && m.body.path === FOLDER_ITEMS_PATH),
    ).toBe(false);
  });
});

describe('synthesizeImportEmission — update collisions', () => {
  function seededStores(): { client: InMemoryDocumentStore; peer: InMemoryDocumentStore } {
    const client = new InMemoryDocumentStore();
    const peer = new InMemoryDocumentStore();
    const seedPlan = emptyPlan({ rules: [{ action: 'create', entity: targetRule }] as PlanEntry<Rule>[] });
    const seed = synthesizeImportEmission(slicesFor(seedPlan), emptyPrev(), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });
    applyTo(client, seed);
    applyTo(peer, seed);
    return { client, peer };
  }

  it('replayed on a peer, sets converge to the imported members without duplicates', () => {
    const { client, peer } = seededStores();
    const plan = emptyPlan({
      rules: [{ action: 'update', targetUid: 'rul00001', entity: importedRule }] as PlanEntry<Rule>[],
    });
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev({ rules: [targetRule] }), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });

    applyTo(client, batches);
    applyTo(peer, batches);

    const clientData = client.materializeOne('rule', 'rul00001')?.data as HeaderRule;
    const peerData = peer.materializeOne('rule', 'rul00001')?.data as HeaderRule;
    expect(peerData.name).toBe('Probe (imported)');
    expect(peerData.enabled).toBe(false);
    expect(peerData.conditions.map((c) => c.uid).sort()).toEqual(['cond0001', 'cond0003']);
    expect(peerData.conditions.find((c) => c.uid === 'cond0001')?.values).toEqual(['api.openheaders.io']);
    expect(peerData.action.requestHeaders.map((h) => h.uid).sort()).toEqual(['hdr00001', 'hdr00002']);
    expect(peerData.action.requestHeaders.find((h) => h.uid === 'hdr00002')?.value).toBe('edited');
    expect(peerData).toEqual(clientData);
  });

  it('an unchanged update collision emits nothing', () => {
    const { client } = seededStores();
    const plan = emptyPlan({
      rules: [{ action: 'update', targetUid: 'rul00001', entity: targetRule }] as PlanEntry<Rule>[],
    });
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev({ rules: [targetRule] }), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });
    expect(batches).toHaveLength(0);
  });

  it("never tombstones the target's frozen pathSegment when the import source predates it", () => {
    const { client } = seededStores();
    const prevWithSegment = { ...targetRule, pathSegment: 'probe-rul00001' } as unknown as Rule;
    const plan = emptyPlan({
      rules: [{ action: 'update', targetUid: 'rul00001', entity: importedRule }] as PlanEntry<Rule>[],
    });
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev({ rules: [prevWithSegment] }), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });
    const unsetPaths = batches
      .flatMap((b) => b.batch.mutations)
      .map((m) => m.body)
      .filter((b): b is Extract<MutationBody, { kind: 'unsetField' }> => b.kind === 'unsetField')
      .map((b) => b.path);
    expect(unsetPaths).not.toContain('pathSegment');
  });

  it('a scalar key that vanished from the imported entity tombstones via unsetField', () => {
    const { client } = seededStores();
    const prevWithDescription = { ...targetRule, description: 'legacy note' } as unknown as Rule;
    const plan = emptyPlan({
      rules: [{ action: 'update', targetUid: 'rul00001', entity: importedRule }] as PlanEntry<Rule>[],
    });
    const batches = synthesizeImportEmission(slicesFor(plan), emptyPrev({ rules: [prevWithDescription] }), {
      nextCtx,
      liveSetEntries: liveReaderFor(client),
    });
    const unsetBodies = batches
      .flatMap((b) => b.batch.mutations)
      .map((m) => m.body)
      .filter((b): b is Extract<MutationBody, { kind: 'unsetField' }> => b.kind === 'unsetField');
    expect(unsetBodies.map((b) => b.path)).toEqual(['description']);
  });
});

describe('synthesizeImportEmission — collections + folders', () => {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'rules/api-col00001',
    name: 'API',
    variables: [{ uid: 'var00001', name: 'BASE', value: 'https://api.openheaders.io', type: 'default' }],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  } as unknown as Collection;

  const folder: LocalFolder = {
    schemaVersion: 5,
    uid: 'fld00001',
    path: 'rules/api-col00001/auth-fld00001',
    name: 'Auth',
  } as LocalFolder;

  it('created folders resolve their parent (created in the same plan) and append after live children', () => {
    const plan = emptyPlan({
      collections: [{ action: 'create', entity: collection }],
      folders: [{ action: 'create', entity: folder }],
    });
    const client = new InMemoryDocumentStore();
    const batches = synthesizeImportEmission(
      slicesFor(plan, {
        ruleCollections: [{ action: 'create', entity: collection }],
        ruleFolders: [{ action: 'create', entity: folder }],
      }),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );

    applyTo(client, batches);
    // Folder entity materialized + parent slot addToSet on the collection.
    expect(client.materializeOne('folder', 'fld00001')).toBeTruthy();
    const slots = client.liveOrderedSetItems('collection', 'col00001', 'folders');
    expect(slots.map((s) => s.itemId)).toEqual(['fld00001']);
    // The created collection took its workspace-roots slot in its seed batch.
    const roots = client.liveOrderedSetItems(
      WORKSPACE_ROOTS_ENTITY_TYPE,
      WORKSPACE_ROOTS_ID,
      WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
    );
    expect(roots.map((s) => s.itemId)).toEqual(['col00001']);
    // Collection carries its variables as uid-keyed set members.
    const vars = client.liveOrderedSetItems('collection', 'col00001', 'variables');
    expect(vars.map((v) => v.itemId)).toEqual(['var00001']);
  });

  const leaf = (uid: string, slug: string): Rule =>
    ({
      ...targetRule,
      uid,
      name: slug,
      path: `rules/api-col00001/${slug}-${uid}`,
    }) as Rule;

  it('a created collection carrying order: seeds its folder and leaves interleaved as listed', () => {
    const ordered: Collection = { ...collection, order: ['b-rul0000b', 'auth-fld00001', 'a-rul0000a'] };
    const plan = emptyPlan({
      collections: [{ action: 'create', entity: ordered }],
      folders: [{ action: 'create', entity: folder }],
      rules: [
        { action: 'create', entity: leaf('rul0000a', 'a') },
        { action: 'create', entity: leaf('rul0000b', 'b') },
      ],
    });
    const client = new InMemoryDocumentStore();
    const batches = synthesizeImportEmission(
      slicesFor(plan, {
        ruleCollections: [{ action: 'create', entity: ordered }],
        ruleFolders: [{ action: 'create', entity: folder }],
      }),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, batches);

    const merged = [
      ...client.liveOrderedSetItems('collection', 'col00001', 'folders'),
      ...client.liveOrderedSetItems('collection', 'col00001', FOLDER_ITEMS_PATH),
    ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    expect(merged.map((s) => s.itemId)).toEqual(['rul0000b', 'fld00001', 'rul0000a']);
    expect(batches.some(({ batch }) => batch.mutations.some((m) => m.body.kind === 'moveBefore'))).toBe(false);
  });

  it('an update collision carrying order: re-keys the live children into the listed order, none when equal', () => {
    const client = new InMemoryDocumentStore();
    const a = leaf('rul0000a', 'a');
    const b = leaf('rul0000b', 'b');
    const seedPlan = emptyPlan({
      collections: [{ action: 'create', entity: collection }],
      rules: [
        { action: 'create', entity: a },
        { action: 'create', entity: b },
      ],
    });
    applyTo(
      client,
      synthesizeImportEmission(
        slicesFor(seedPlan, { ruleCollections: [{ action: 'create', entity: collection }] }),
        emptyPrev(),
        { nextCtx, liveSetEntries: liveReaderFor(client) },
      ),
    );

    const reordered: Collection = { ...collection, order: ['b-rul0000b', 'a-rul0000a'] };
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ collections: [{ action: 'update', targetUid: 'col00001', entity: reordered }] }), {
        ruleCollections: [{ action: 'update', targetUid: 'col00001', entity: reordered }],
      }),
      emptyPrev({ ruleCollections: [collection], rules: [a, b] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    const bodies = batches.flatMap(({ batch }) => batch.mutations.map((m) => m.body));
    expect(bodies.filter((body) => body.kind === 'moveBefore')).toHaveLength(1);
    expect(bodies.some((body) => body.kind === 'setField' && body.path === 'order')).toBe(false);
    applyTo(client, batches);
    expect(client.liveOrderedSetItems('collection', 'col00001', FOLDER_ITEMS_PATH).map((s) => s.itemId)).toEqual([
      'rul0000b',
      'rul0000a',
    ]);

    const again = synthesizeImportEmission(
      slicesFor(emptyPlan({ collections: [{ action: 'update', targetUid: 'col00001', entity: reordered }] }), {
        ruleCollections: [{ action: 'update', targetUid: 'col00001', entity: reordered }],
      }),
      emptyPrev({ ruleCollections: [collection], rules: [a, b] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(again).toEqual([]);
  });

  it('collection update collisions diff variables by uid and rename via setField', () => {
    const client = new InMemoryDocumentStore();
    const seed = synthesizeImportEmission(
      slicesFor(emptyPlan({ collections: [{ action: 'create', entity: collection }] }), {
        ruleCollections: [{ action: 'create', entity: collection }],
      }),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, seed);

    const updated: Collection = {
      ...collection,
      name: 'API v2',
      variables: [{ uid: 'var00002', name: 'TOKEN_URL', value: 'https://auth.openheaders.io', type: 'default' }],
    } as unknown as Collection;
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ collections: [{ action: 'update', targetUid: 'col00001', entity: updated }] }), {
        ruleCollections: [{ action: 'update', targetUid: 'col00001', entity: updated }],
      }),
      emptyPrev({ ruleCollections: [collection] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, batches);

    const data = client.materializeOne('collection', 'col00001')?.data as Collection;
    expect(data.name).toBe('API v2');
    const vars = client.liveOrderedSetItems('collection', 'col00001', 'variables');
    expect(vars.map((v) => v.itemId)).toEqual(['var00002']);
  });
});

describe('synthesizeImportEmission — environments + singletons', () => {
  const environment: Environment = {
    schemaVersion: 5,
    uid: 'env00001',
    name: 'Staging',
    variables: [{ uid: 'var00010', name: 'HOST', value: 'staging.openheaders.io', type: 'default' }],
  } as unknown as Environment;

  it('environment update emits rename + uid-keyed variable diff', () => {
    const client = new InMemoryDocumentStore();
    const seed = synthesizeImportEmission(
      slicesFor(emptyPlan({ environments: [{ action: 'create', entity: environment }] })),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, seed);

    const updated: Environment = {
      ...environment,
      name: 'Staging EU',
      variables: [
        { uid: 'var00010', name: 'HOST', value: 'eu.staging.openheaders.io', type: 'default' },
        { uid: 'var00011', name: 'REGION', value: 'eu-west', type: 'default' },
      ],
    } as unknown as Environment;
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ environments: [{ action: 'update', targetUid: 'env00001', entity: updated }] })),
      emptyPrev({ environments: [environment] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, batches);

    const data = client.materializeOne('environment', 'env00001')?.data as Environment;
    expect(data.name).toBe('Staging EU');
    expect(data.variables.map((v) => v.uid).sort()).toEqual(['var00010', 'var00011']);
    expect(data.variables.find((v) => v.uid === 'var00010')?.value).toBe('eu.staging.openheaders.io');
  });

  it('workspaceVars seeds the singleton when the target never had one, diffs it otherwise', () => {
    const client = new InMemoryDocumentStore();
    const vars = [{ uid: 'var00020', name: 'API_BASE', value: 'https://api.openheaders.io', type: 'default' as const }];
    const seed = synthesizeImportEmission(
      slicesFor(emptyPlan({ workspaceVars: { action: 'replace', variables: vars } })),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(seed).toHaveLength(1);
    expect(seed[0].batch.mutations[0].body.kind).toBe('create');
    applyTo(client, seed);

    const nextVars = [
      { uid: 'var00021', name: 'API_BASE', value: 'https://api2.openheaders.io', type: 'default' as const },
    ];
    const diff = synthesizeImportEmission(
      slicesFor(emptyPlan({ workspaceVars: { action: 'replace', variables: nextVars } })),
      emptyPrev({ workspaceVars: { schemaVersion: 5, variables: vars } }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].batch.mutations.every((m) => m.body.kind !== 'create')).toBe(true);
    applyTo(client, diff);
    const members = client.liveOrderedSetItems('workspace-variables', 'workspace-vars', 'variables');
    expect(members.map((m) => m.itemId)).toEqual(['var00021']);
  });

  it('trusted roots create seeds the singleton; a later merge converges the peer by uid', () => {
    const rootA = { uid: 'root0001', name: 'Corp Root', certPem: 'PEM-A', addedAt: '2026-08-27T00:00:00.000Z' };
    const rootB = { uid: 'root0002', name: 'Lab Root', certPem: 'PEM-B', addedAt: '2026-08-27T00:00:00.000Z' };
    const client = new InMemoryDocumentStore();
    const peer = new InMemoryDocumentStore();

    const create = synthesizeImportEmission(
      slicesFor(emptyPlan({ trustedRoots: { action: 'replace', roots: [rootA] } })),
      emptyPrev(),
      { nextCtx, liveSetEntries: () => [] },
    );
    expect(create.map((b) => b.label)).toEqual(['trusted-roots (create)']);
    applyTo(client, create);
    applyTo(peer, create);

    const update = synthesizeImportEmission(
      slicesFor(emptyPlan({ trustedRoots: { action: 'merge-by-name', roots: [rootA, rootB] } })),
      emptyPrev({ trustedRoots: { schemaVersion: 5, roots: [rootA] } }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(update.map((b) => b.label)).toEqual(['trusted-roots (update)']);
    expect(update[0].batch.mutations.every((m) => m.body.kind !== 'create')).toBe(true);
    applyTo(client, update);
    applyTo(peer, update);
    for (const store of [client, peer]) {
      const members = store.liveOrderedSetItems('trusted-roots', 'trusted-roots', 'roots');
      expect(members.map((m) => m.itemId)).toEqual(['root0001', 'root0002']);
    }
  });

  it('a skipped vault emits nothing', () => {
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ vault: { action: 'skip', secrets: [] } })),
      emptyPrev(),
      { nextCtx, liveSetEntries: () => [] },
    );
    expect(batches).toHaveLength(0);
  });
});

describe('synthesizeImportEmission — specs', () => {
  const spec: Spec = {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/openheaders-api-spc00001',
    name: 'OpenHeaders API',
    format: 'openapi-3.1',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content: 'openapi: 3.1.0\ninfo:\n  title: OpenHeaders API\n' }],
  } as Spec;

  it('spec create emits a seed batch that materializes files as set members', () => {
    const client = new InMemoryDocumentStore();
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ specs: [{ action: 'create', entity: spec }] })),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(batches).toHaveLength(1);
    expect(batches[0].batch.mutations[0].body.kind).toBe('create');

    const peer = new InMemoryDocumentStore();
    applyTo(client, batches);
    applyTo(peer, batches);
    const data = peer.materializeOne('spec', 'spc00001')?.data as Spec;
    expect(data.name).toBe('OpenHeaders API');
    expect(data.format).toBe('openapi-3.1');
    const files = peer.liveOrderedSetItems('spec', 'spc00001', 'files');
    expect(files.map((f) => f.itemId)).toEqual(['fil00001']);
  });

  it('spec update emits scalar diffs + a uid-keyed file diff that converges without duplicates', () => {
    const client = new InMemoryDocumentStore();
    const seed = synthesizeImportEmission(
      slicesFor(emptyPlan({ specs: [{ action: 'create', entity: spec }] })),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, seed);

    const updated: Spec = {
      ...spec,
      name: 'OpenHeaders API v2',
      files: [
        { uid: 'fil00001', fileName: 'index.yaml', content: 'openapi: 3.1.0\ninfo:\n  title: Renamed\n' },
        { uid: 'fil00002', fileName: 'components.yaml', content: 'components: {}\n' },
      ],
    } as Spec;
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ specs: [{ action: 'update', targetUid: 'spc00001', entity: updated }] })),
      emptyPrev({ specs: [spec] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, batches);

    const data = client.materializeOne('spec', 'spc00001')?.data as Spec;
    expect(data.name).toBe('OpenHeaders API v2');
    const files = client.liveOrderedSetItems('spec', 'spc00001', 'files');
    expect(files.map((f) => f.itemId).sort()).toEqual(['fil00001', 'fil00002']);
    const root = files.find((f) => f.itemId === 'fil00001')?.item as Spec['files'][number];
    expect(root.content).toContain('Renamed');
  });

  it('an unchanged spec update collision emits nothing', () => {
    const client = new InMemoryDocumentStore();
    const seed = synthesizeImportEmission(
      slicesFor(emptyPlan({ specs: [{ action: 'create', entity: spec }] })),
      emptyPrev(),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    applyTo(client, seed);
    const batches = synthesizeImportEmission(
      slicesFor(emptyPlan({ specs: [{ action: 'update', targetUid: 'spc00001', entity: spec }] })),
      emptyPrev({ specs: [spec] }),
      { nextCtx, liveSetEntries: liveReaderFor(client) },
    );
    expect(batches).toHaveLength(0);
  });
});
