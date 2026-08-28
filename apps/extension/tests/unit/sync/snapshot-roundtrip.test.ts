/**
 * Phase C C5 — build → apply round-trip.
 *
 * Verifies the producer + consumer halves of the cold-start path:
 * 1. Seed source workspace with rules.
 * 2. Capture snapshot from source.
 * 3. Wipe + re-init the workspace.
 * 4. Apply the snapshot.
 * 5. Re-capture and verify the rule shape matches.
 */

import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type MutationBatch,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  WORKSPACE_ROOTS_REF,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { seedResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Request, ResponseExample, Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { applyWorkspaceSnapshot, buildSnapshotForWorkspace } from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTestIdentitySnapshot, installTestIdentitySnapshot } from '../../helpers/identity-snapshot';

const wsId = 'ws-roundtrip';
let clock = 0;

const ctx = (nodeId = 'receiver'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ++clock + 10_000, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'd0',
});

const makeRule = (uid: string, name: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name,
    enabled: true,
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['https://openheaders.io/*'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'override', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

beforeEach(() => {
  clock = 0;
  __initSyncServiceForTests(wsId);
  installTestIdentitySnapshot();
});

afterEach(() => {
  disposeSyncService();
  clearTestIdentitySnapshot();
});

describe('snapshot build → apply round-trip', () => {
  it('rehydrates a workspace from a snapshot blob', async () => {
    const r1 = makeRule(generateUid(), 'rule-one');
    const r2 = makeRule(generateUid(), 'rule-two');
    await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(r1, ctx('source')), sideEffects: [] });
    await applySyncRequest({ type: 'oh.sync.apply', batch: seedRule(r2, ctx('source')), sideEffects: [] });

    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    expect(snap.rules.length).toBe(2);

    // Tear down + re-init: simulate a fresh receiver workspace.
    disposeSyncService();
    __initSyncServiceForTests(wsId);

    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.entitiesApplied).toBe(2);
    expect(result.byType).toEqual({ rules: 2 });

    const reSnap = await buildSnapshotForWorkspace(wsId);
    if (reSnap === null) throw new Error('expected snapshot for authorized workspace');
    expect(reSnap.rules.map((r) => r.rule.name).sort()).toEqual(['rule-one', 'rule-two']);
    // Rule uids preserved end-to-end (the seed mutators key on the persisted uid).
    expect(reSnap.rules.map((r) => r.rule.uid).sort()).toEqual([r1.uid, r2.uid].sort());
  });

  it('replays containment slots so the receiver keeps the sender tree order', async () => {
    const collection = {
      schemaVersion: 5,
      uid: 'col00001',
      name: 'API',
      path: 'rules/api-col00001',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    } as unknown as Collection;
    const apply = (batch: MutationBatch) => applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [] });
    await apply(seedCollection(collection, ctx('source'), { parent: WORKSPACE_ROOTS_REF, orderKey: 'a' }));
    await apply(
      createFolder(ctx('source'), {
        folderUid: 'fol00001',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: collection.uid },
        name: 'Sub',
        orderKey: 'a',
      }).batch,
    );
    const inFolder = { type: FOLDER_ENTITY_TYPE, uid: 'fol00001' } as const;
    const later = { ...makeRule('rul00001', 'later'), path: `${collection.path}/sub-fol00001/later-rul00001` } as Rule;
    const first = { ...makeRule('rul00002', 'first'), path: `${collection.path}/sub-fol00001/first-rul00002` } as Rule;
    await apply(seedRule(later, ctx('source'), { parent: inFolder, orderKey: 'b' }));
    await apply(seedRule(first, ctx('source'), { parent: inFolder, orderKey: 'a' }));

    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    expect(snap.folders[0].setOrderKeys[FOLDER_ITEMS_PATH].map((s) => s.itemId)).toEqual(['rul00002', 'rul00001']);

    disposeSyncService();
    __initSyncServiceForTests(wsId);
    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.byType).toMatchObject({ collections: 1, folders: 1, rules: 2, workspaceRoots: 1, treeSlots: 2 });

    const reSnap = await buildSnapshotForWorkspace(wsId);
    if (reSnap === null) throw new Error('expected snapshot for authorized workspace');
    expect(reSnap.folders.map((f) => f.folder.path)).toEqual([`${collection.path}/sub-fol00001`]);
    expect(reSnap.folders[0].setOrderKeys[FOLDER_ITEMS_PATH]).toEqual(snap.folders[0].setOrderKeys[FOLDER_ITEMS_PATH]);
    expect(reSnap.workspaceRoots[0].workspaceRoots.ruleCollections).toEqual(['col00001']);
    const paths = new Map(reSnap.rules.map((r) => [r.rule.uid, r.rule.path]));
    expect(paths.get('rul00002')).toBe(`${collection.path}/sub-fol00001/first-rul00002`);
  });

  it('replays a request examples slots so the receiver keeps the sender example order', async () => {
    const collection = {
      schemaVersion: 5,
      uid: 'col00001',
      name: 'API',
      path: 'requests/api-col00001',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    } as unknown as Collection;
    const request = {
      schemaVersion: 5,
      uid: 'req00001',
      path: `${collection.path}/get-req00001`,
      pathSegment: 'get-req00001',
      name: 'get',
      method: 'GET',
      url: 'https://api.openheaders.io/v1',
      headers: [],
      params: [],
      auth: { type: 'inherit' },
      body: { type: 'none' },
    } as unknown as Request;
    const makeExample = (uid: string): ResponseExample => ({
      schemaVersion: 5,
      uid,
      path: `${request.path}/examples/ping-${uid}`,
      requestUid: request.uid,
      name: 'ping',
      capturedAt: '2026-07-09T09:00:00.000Z',
      request: {
        method: 'GET',
        url: 'https://api.openheaders.io/ping',
        headers: [],
        params: [],
        body: { type: 'none' },
      },
      response: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/ping',
        headers: [],
        body: '{"ok":true}',
        bodyTruncated: false,
        bodyBytes: 11,
        durationMs: 42,
      },
    });
    const apply = (batch: MutationBatch) => applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [] });
    await apply(seedRequestCollection(collection, ctx('source'), { parent: WORKSPACE_ROOTS_REF, orderKey: 'a' }));
    await apply(
      seedRequest(request, ctx('source'), {
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.uid },
        orderKey: 'a',
      }),
    );
    const onRequest = { type: REQUEST_ENTITY_TYPE, uid: request.uid } as const;
    await apply(seedResponseExample(makeExample('ex000001'), ctx('source'), { parent: onRequest, orderKey: 'b' }));
    await apply(seedResponseExample(makeExample('ex000002'), ctx('source'), { parent: onRequest, orderKey: 'a' }));

    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    expect(snap.requests[0].setOrderKeys[REQUEST_EXAMPLES_PATH].map((s) => s.itemId)).toEqual(['ex000002', 'ex000001']);

    disposeSyncService();
    __initSyncServiceForTests(wsId);
    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.byType).toMatchObject({ requestCollections: 1, requests: 1, responseExamples: 2, treeSlots: 2 });

    const reSnap = await buildSnapshotForWorkspace(wsId);
    if (reSnap === null) throw new Error('expected snapshot for authorized workspace');
    expect(reSnap.requests[0].setOrderKeys[REQUEST_EXAMPLES_PATH]).toEqual(
      snap.requests[0].setOrderKeys[REQUEST_EXAMPLES_PATH],
    );
    const paths = new Map(reSnap.responseExamples.map((e) => [e.responseExample.uid, e.responseExample.path]));
    expect(paths.get('ex000002')).toBe(`${request.path}/examples/ping-ex000002`);
    expect(paths.get('ex000001')).toBe(`${request.path}/examples/ping-ex000001`);
  });

  it('rejects a snapshot with an unknown schemaVersion', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    await expect(applyWorkspaceSnapshot({ ...snap, schemaVersion: 99 }, { makeContext: () => ctx() })).rejects.toThrow(
      /schemaVersion/,
    );
  });

  it('applies cleanly to an empty workspace with an empty snapshot', async () => {
    const snap = await buildSnapshotForWorkspace(wsId);
    if (snap === null) throw new Error('expected snapshot for authorized workspace');
    const result = await applyWorkspaceSnapshot(snap, { makeContext: () => ctx() });
    expect(result.entitiesApplied).toBe(0);
    expect(result.byType).toEqual({});
  });
});
