/**
 * Parity materialization coverage: pulled payloads ride the standard
 * parsers into real entities through the sync service (in-memory
 * persistence) — request collection with variables, folder tree,
 * requests under their folder paths, environments with the secret
 * split — with 1 vendor workspace = 1 counterpart workspace (shared
 * items landing in each) and one aggregated report PER WORKSPACE in
 * that workspace's ring (pull skips + parse failures as drops with
 * reasons, `sourceHash` stamped for the re-import diff).
 */

import type { ImportReport, PostmanPullResult } from '@openheaders/core/import';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddResponseExampleBatch } from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import type { Request } from '@openheaders/core/types';
import { logger as consoleLogger, generateUid } from '@openheaders/core/utils';
import { wsKeys } from '@openheaders/oracle/storage';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOrCreateWorkspaceService,
  nextSwMutatorContextForWorkspace,
  releaseWorkspaceService,
  snapshotEnvironmentPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotResponseExamplePostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { materializePostmanPull } from '../../../src/migration/materialize';
import { createHostStorageFake, type HostStorageFake } from '../_host-storage-fake';

const wsId = 'ws-postman-landing';

const COLLECTION_JSON = JSON.stringify({
  info: { name: 'Payments API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  variable: [{ key: 'baseUrl', value: 'https://api.openheaders.io' }],
  item: [
    {
      name: 'List charges',
      request: {
        method: 'GET',
        url: 'https://api.openheaders.io/charges',
        description: 'Lists charges for the account.',
      },
      response: [
        {
          id: 'r-1',
          name: 'Charges page',
          originalRequest: {
            method: 'GET',
            header: [{ key: 'Accept', value: 'application/json' }],
            url: { raw: 'https://api.openheaders.io/charges?limit=2', query: [{ key: 'limit', value: '2' }] },
          },
          status: 'OK',
          code: 200,
          _postman_previewlanguage: 'json',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          cookie: [],
          responseTime: null,
          body: '{"data":[]}',
          createdAt: '2021-08-02T14:23:01.000Z',
        },
        {
          name: 'Empty page',
          status: 'OK',
          code: 200,
          header: [],
          body: '',
        },
      ],
    },
    {
      name: 'Admin',
      item: [
        {
          name: 'Refund charge',
          request: {
            method: 'POST',
            url: 'https://api.openheaders.io/refunds',
            header: [{ key: 'X-Env', value: 'staging' }],
          },
          protocolProfileBehavior: { strictSSL: false, maxRedirects: 3 },
        },
      ],
    },
  ],
});

const ENVIRONMENT_JSON = JSON.stringify({
  name: 'Staging',
  _postman_variable_scope: 'environment',
  values: [
    { key: 'host', value: 'staging.openheaders.io', enabled: true },
    { key: 'token', value: 'shh', enabled: true, type: 'secret' },
  ],
});

function pullResult(overrides: Partial<PostmanPullResult> = {}): PostmanPullResult {
  return {
    outcome: 'complete',
    workspaces: [{ id: 'pm-ws-1', name: 'Team' }],
    collections: [
      { item: 'collection', id: 'c-1', name: 'Payments API', json: COLLECTION_JSON, workspaceIds: ['pm-ws-1'] },
    ],
    environments: [
      { item: 'environment', id: 'e-1', name: 'Staging', json: ENVIRONMENT_JSON, workspaceIds: ['pm-ws-1'] },
    ],
    skipped: [],
    budget: {},
    callsMade: 5,
    ...overrides,
  };
}

/** Counterpart seam — the single-workspace tests land in `wsId`. */
const ensureWorkspaceFor = async () => ({ id: wsId, name: 'Team' });

/** Save a response example under an imported request — a user gesture
 *  between pulls that the refresh must sweep along with its parent. */
async function saveExampleUnder(request: Request): Promise<void> {
  const ctx = nextSwMutatorContextForWorkspace(wsId, { surfaceId: 'test' });
  if (!ctx) throw new Error('landing workspace is not loaded');
  const uid = generateUid();
  const { batch, sideEffects } = buildAddResponseExampleBatch(
    {
      schemaVersion: 5,
      uid,
      path: `${request.path}/examples/saved-${uid}`,
      requestUid: request.uid,
      name: 'Saved 200',
      capturedAt: new Date().toISOString(),
      request: {
        method: 'GET',
        url: 'https://api.openheaders.io/charges',
        headers: [],
        params: [],
        body: { type: 'none' },
      },
      response: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/charges',
        headers: [],
        body: '{}',
        bodyTruncated: false,
        bodyBytes: 2,
        durationMs: 12,
      },
    },
    ctx,
  );
  const response = await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects });
  if (!response.ok) throw new Error('example seed failed');
}

let storage: HostStorageFake;

async function readRecordedReports(): Promise<ImportReport[]> {
  return ((await storage.get(wsKeys(wsId).importReports)) ?? []) as ImportReport[];
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  storage = createHostStorageFake();
  setHostStorage(storage);
  __initSyncServiceForTests(wsId);
});

afterEach(() => {
  disposeSyncService();
});

describe('materializePostmanPull', () => {
  it('lands collections, folders, requests, and environments through the standard path', async () => {
    const summary = await materializePostmanPull(pullResult(), { ensureWorkspaceFor });

    expect(summary).toMatchObject({
      workspaces: [
        { workspaceId: wsId, workspaceName: 'Team', collections: 1, environments: 1, requests: 2, examples: 2 },
      ],
      collections: 1,
      environments: 1,
      requests: 2,
      examples: 2,
    });

    const collections = snapshotRequestCollectionPostStates(wsId).map((ps) => ps.collection);
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe('Payments API');
    expect(collections[0].variables).toMatchObject([{ name: 'baseUrl', value: 'https://api.openheaders.io' }]);

    const folders = snapshotRequestFolderPostStates(wsId).map((ps) => ps.folder);
    expect(folders.map((f) => f.name)).toEqual(['Admin']);

    const requests = snapshotRequestPostStates(wsId).map((ps) => ps.request);
    expect(requests.map((r) => r.name).sort()).toEqual(['List charges', 'Refund charge']);
    const nested = requests.find((r) => r.name === 'Refund charge');
    const flat = requests.find((r) => r.name === 'List charges');
    expect(nested?.path.startsWith(`${collections[0].path}/`)).toBe(true);
    expect(nested?.path).toContain('/admin-');
    expect(flat?.path.startsWith(`${collections[0].path}/`)).toBe(true);
    expect(flat?.path).not.toContain('/admin-');
    expect(nested?.headers).toMatchObject([{ key: 'X-Env', value: 'staging' }]);
    expect(flat?.description).toBe('Lists charges for the account.');
    expect(nested?.sslVerification).toBe(false);
    expect(nested?.maxRedirects).toBe(3);

    const environments = snapshotEnvironmentPostStates(wsId).map((ps) => ps.environment);
    expect(environments).toHaveLength(1);
    expect(environments[0].name).toBe('Staging');
    expect(environments[0].variables).toMatchObject([
      { name: 'host', value: 'staging.openheaders.io', type: 'default' },
      { name: 'token', value: 'shh', type: 'secret' },
    ]);

    const examples = snapshotResponseExamplePostStates(wsId).map((ps) => ps.responseExample);
    expect(examples.map((e) => e.name).sort()).toEqual(['Charges page', 'Empty page']);
    const captured = examples.find((e) => e.name === 'Charges page');
    expect(captured?.requestUid).toBe(flat?.uid);
    expect(captured?.path.startsWith(`${flat?.path}/examples/`)).toBe(true);
    expect(captured?.capturedAt).toBe('2021-08-02T14:23:01.000Z');
    expect(captured?.request.url).toBe('https://api.openheaders.io/charges');
    expect(captured?.request.params).toMatchObject([{ key: 'limit', value: '2' }]);
    expect(captured?.request.headers).toMatchObject([{ key: 'Accept', value: 'application/json' }]);
    expect(captured?.response).toMatchObject({
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/charges?limit=2',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{"data":[]}',
      bodyTruncated: false,
      bodyBytes: 11,
      durationMs: 0,
    });
    // No wire `createdAt` — the run's import moment stands in; the
    // snapshot without `originalRequest` captures the parent shape.
    const fallback = examples.find((e) => e.name === 'Empty page');
    expect(Number.isNaN(new Date(fallback?.capturedAt ?? '').getTime())).toBe(false);
    expect(fallback?.request.method).toBe('GET');
    expect(fallback?.request.url).toBe('https://api.openheaders.io/charges');
  });

  it('lands request scripts on the script slots — translated and verbatim-with-marker', async () => {
    const scriptedJson = JSON.stringify({
      info: { name: 'Scripted', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'Login',
          request: { method: 'POST', url: 'https://api.openheaders.io/login' },
          event: [
            { listen: 'prerequest', script: { exec: ['pm.environment.set("stamp", "1");'] } },
            { listen: 'test', script: { exec: ["const sdk = require('postman-collection');"] } },
          ],
        },
      ],
    });
    const summary = await materializePostmanPull(
      pullResult({
        collections: [
          { item: 'collection', id: 'c-s', name: 'Scripted', json: scriptedJson, workspaceIds: ['pm-ws-1'] },
        ],
        environments: [],
      }),
      { ensureWorkspaceFor },
    );

    expect(summary.requests).toBe(1);
    const [request] = snapshotRequestPostStates(wsId).map((ps) => ps.request);
    expect(request.preRequestScript).toBe('await oh.variables.set("stamp", "1");');
    expect(request.postResponseScript).toContain('// == Imported unchanged ==');
    expect(request.postResponseScript).toContain("const sdk = require('postman-collection');");

    const [report] = await readRecordedReports();
    const scriptTransforms = report.transforms.filter((t) => t.path.includes('.event['));
    expect(scriptTransforms).toHaveLength(2);
    expect(scriptTransforms.some((t) => t.to === 'oh.* script')).toBe(true);
    expect(scriptTransforms.some((t) => t.tracking === '#todo-script-translation')).toBe(true);
  });

  it('lands collection + folder ancestor scripts on their slots', async () => {
    const ancestorJson = JSON.stringify({
      info: { name: 'Ancestors', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      event: [{ listen: 'prerequest', script: { exec: ['pm.environment.set("root", "1");'] } }],
      item: [
        {
          name: 'Admin',
          event: [{ listen: 'test', script: { exec: ['console.log("folder check");'] } }],
          item: [{ name: 'Ping', request: { method: 'GET', url: 'https://api.openheaders.io/ping' } }],
        },
      ],
    });
    await materializePostmanPull(
      pullResult({
        collections: [
          { item: 'collection', id: 'c-a', name: 'Ancestors', json: ancestorJson, workspaceIds: ['pm-ws-1'] },
        ],
        environments: [],
      }),
      { ensureWorkspaceFor },
    );

    const [collection] = snapshotRequestCollectionPostStates(wsId).map((ps) => ps.collection);
    expect(collection.preRequestScript).toBe('await oh.variables.set("root", "1");');
    expect(collection.postResponseScript).toBeUndefined();

    const [folder] = snapshotRequestFolderPostStates(wsId).map((ps) => ps.folder);
    expect(folder.name).toBe('Admin');
    expect(folder.postResponseScript).toBe('console.log("folder check");');
    expect(folder.preRequestScript).toBeUndefined();

    const [report] = await readRecordedReports();
    expect(report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(0);
  });

  it('lands collection + folder default auth on their auth slots — no inheritance transform', async () => {
    const authJson = JSON.stringify({
      info: { name: 'Authed', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{auth_token}}' }] },
      item: [
        {
          name: 'Admin',
          auth: {
            type: 'basic',
            basic: [
              { key: 'username', value: 'svc' },
              { key: 'password', value: 'pw' },
            ],
          },
          item: [{ name: 'Ping', request: { method: 'GET', url: 'https://api.openheaders.io/ping' } }],
        },
      ],
    });
    await materializePostmanPull(
      pullResult({
        collections: [{ item: 'collection', id: 'c-au', name: 'Authed', json: authJson, workspaceIds: ['pm-ws-1'] }],
        environments: [],
      }),
      { ensureWorkspaceFor },
    );

    const [collection] = snapshotRequestCollectionPostStates(wsId).map((ps) => ps.collection);
    expect(collection.auth).toEqual({ type: 'bearer', token: '{{auth_token}}' });

    const [folder] = snapshotRequestFolderPostStates(wsId).map((ps) => ps.folder);
    expect(folder.auth).toEqual({ type: 'basic', username: 'svc', password: 'pw' });

    // The request without its own auth imports as `inherit` — the
    // ancestor carriers resolve it at send time.
    const [request] = snapshotRequestPostStates(wsId).map((ps) => ps.request);
    expect(request.auth).toEqual({ type: 'inherit' });

    const [report] = await readRecordedReports();
    expect(report.transforms.filter((t) => t.tracking === '#todo-auth-inheritance')).toHaveLength(0);
  });

  it('records ONE aggregated report with a sourceHash in the landing workspace ring', async () => {
    await materializePostmanPull(
      pullResult({
        skipped: [{ item: 'collection', id: 'c-9', name: 'Ops', reason: 'Not pulled — the run stopped early.' }],
      }),
      { ensureWorkspaceFor },
    );

    const reports = await readRecordedReports();
    expect(reports).toHaveLength(1);
    const report = reports[0];
    expect(report.source).toBe('postman-pull');
    expect(report.sourceHash.length).toBeGreaterThan(0);
    // 2 requests + 1 environment + 2 saved examples.
    expect(report.summary.imported).toBe(5);
    const skipDrop = report.drops.find((d) => d.path.startsWith('pull.skipped[0]'));
    expect(skipDrop?.reason).toContain('stopped early');
  });

  it('hashes the same pulled payloads identically regardless of item order', async () => {
    const forward = pullResult();
    await materializePostmanPull(forward, { ensureWorkspaceFor });
    const first = (await readRecordedReports())[0];

    __initSyncServiceForTests(wsId);
    const reversed = pullResult();
    // One collection + one environment always sort kind-first, so
    // reordering across the two arrays is the observable permutation.
    const rerun = await materializePostmanPull(
      { ...reversed, collections: [...reversed.collections], environments: [...reversed.environments] },
      { ensureWorkspaceFor },
    );
    const second = (await readRecordedReports())[0];
    expect(rerun.workspaces[0]?.workspaceId).toBe(wsId);
    expect(second.sourceHash).toBe(first.sourceHash);
  });

  it('drops an unparseable collection with a reason and keeps going', async () => {
    const summary = await materializePostmanPull(
      pullResult({
        collections: [
          { item: 'collection', id: 'c-bad', name: 'Broken', json: 'not json', workspaceIds: ['pm-ws-1'] },
          { item: 'collection', id: 'c-1', name: 'Payments API', json: COLLECTION_JSON, workspaceIds: ['pm-ws-1'] },
        ],
      }),
      { ensureWorkspaceFor },
    );

    expect(summary.collections).toBe(1);
    expect(summary.requests).toBe(2);
    const [report] = await readRecordedReports();
    const drop = report.drops.find((d) => d.path.startsWith('pull.collections[0]'));
    expect(drop?.reason).toContain('was not imported');
    expect(summary.drops).toBeGreaterThan(0);
  });

  it('drops an unparseable environment with a reason and keeps going', async () => {
    const summary = await materializePostmanPull(
      pullResult({
        environments: [
          { item: 'environment', id: 'e-bad', name: 'Broken', json: 'not json', workspaceIds: ['pm-ws-1'] },
          { item: 'environment', id: 'e-1', name: 'Staging', json: ENVIRONMENT_JSON, workspaceIds: ['pm-ws-1'] },
        ],
      }),
      { ensureWorkspaceFor },
    );

    expect(summary.environments).toBe(1);
    const [report] = await readRecordedReports();
    expect(report.drops.some((d) => d.path.startsWith('pull.environments[0]'))).toBe(true);
  });

  it('a complete re-pull replaces the previous import, saved examples included', async () => {
    await materializePostmanPull(pullResult(), { ensureWorkspaceFor });
    const [firstReport] = await readRecordedReports();
    expect(firstReport.transforms).toHaveLength(0);
    const firstCollections = snapshotRequestCollectionPostStates(wsId).map((ps) => ps.collection);
    const imported = snapshotRequestPostStates(wsId).map((ps) => ps.request);
    const parent = imported.find((r) => r.name === 'List charges');
    if (!parent) throw new Error('expected imported request');
    await saveExampleUnder(parent);
    // 2 imported examples + the user-saved one.
    expect(snapshotResponseExamplePostStates(wsId)).toHaveLength(3);

    const summary = await materializePostmanPull(pullResult(), { ensureWorkspaceFor });

    expect(summary).toMatchObject({ collections: 1, environments: 1, requests: 2, examples: 2 });
    const collections = snapshotRequestCollectionPostStates(wsId).map((ps) => ps.collection);
    expect(collections).toHaveLength(1);
    expect(collections[0].uid).not.toBe(firstCollections[0].uid);
    expect(snapshotRequestPostStates(wsId)).toHaveLength(2);
    expect(snapshotRequestFolderPostStates(wsId)).toHaveLength(1);
    expect(snapshotEnvironmentPostStates(wsId)).toHaveLength(1);
    // Only this pull's imported examples survive — the user-saved one
    // was swept with its parent.
    const survivingExamples = snapshotResponseExamplePostStates(wsId).map((ps) => ps.responseExample);
    expect(survivingExamples).toHaveLength(2);
    expect(survivingExamples.some((e) => e.name === 'Saved 200')).toBe(false);

    // Same sourceHash — the ring entry is replaced, now carrying the
    // ONE replacement transform.
    const reports = await readRecordedReports();
    expect(reports).toHaveLength(1);
    const transform = reports[0].transforms.find((t) => t.path === 'pull');
    expect(transform?.to).toBe('replaced by this pull');
    expect(transform?.from).toContain('1 collections');
    expect(transform?.from).toContain('2 requests');
    expect(reports[0].drops).toHaveLength(0);
  });

  it('a partial re-pull keeps the previous import and appends alongside it', async () => {
    await materializePostmanPull(pullResult(), { ensureWorkspaceFor });

    await materializePostmanPull(pullResult({ outcome: 'partial', stopReason: 'Service limit exhausted.' }), {
      ensureWorkspaceFor,
    });

    expect(snapshotRequestCollectionPostStates(wsId)).toHaveLength(2);
    expect(snapshotEnvironmentPostStates(wsId)).toHaveLength(2);
    expect(snapshotRequestPostStates(wsId)).toHaveLength(4);
    const reports = await readRecordedReports();
    expect(reports).toHaveLength(1);
    const transform = reports[0].transforms.find((t) => t.path === 'pull');
    expect(transform?.to).toBe('kept alongside this pull');
    expect(transform?.reason).toContain('partial');
  });

  it('the first pull into an empty landing workspace records no replacement transform', async () => {
    await materializePostmanPull(pullResult(), { ensureWorkspaceFor });
    const [report] = await readRecordedReports();
    expect(report.transforms).toHaveLength(0);
    expect(report.summary.transformed).toBe(0);
  });

  it('workspace parity: a shared collection lands in every counterpart, reports stay per-workspace', async () => {
    const wsId2 = 'ws-postman-second';
    // Hold a refcount so the second service survives the materializer's
    // release for the assertions below (test grace window is 0).
    getOrCreateWorkspaceService(wsId2);
    const result = pullResult({
      workspaces: [
        { id: 'pm-ws-1', name: 'Team' },
        { id: 'pm-ws-2', name: 'Billing' },
      ],
      collections: [
        {
          item: 'collection',
          id: 'c-1',
          name: 'Payments API',
          json: COLLECTION_JSON,
          workspaceIds: ['pm-ws-1', 'pm-ws-2'],
        },
      ],
      environments: [
        { item: 'environment', id: 'e-1', name: 'Staging', json: ENVIRONMENT_JSON, workspaceIds: ['pm-ws-1'] },
      ],
      skipped: [
        { item: 'collection', id: 'c-9', name: 'Ops', reason: 'HTTP 500.', workspaceIds: ['pm-ws-2'] },
        { item: 'workspace', id: '(unknown)', reason: '1 workspace entry in the list had no usable id — skipped.' },
      ],
    });
    const targets = new Map([
      ['pm-ws-1', { id: wsId, name: 'Team' }],
      ['pm-ws-2', { id: wsId2, name: 'Billing' }],
    ]);
    const summary = await materializePostmanPull(result, {
      ensureWorkspaceFor: async (workspace) => {
        const target = targets.get(workspace.id);
        if (!target) throw new Error(`unexpected workspace ${workspace.id}`);
        return target;
      },
    });

    expect(summary.workspaces).toHaveLength(2);
    expect(summary.workspaces[0]).toMatchObject({
      workspaceId: wsId,
      workspaceName: 'Team',
      collections: 1,
      environments: 1,
      requests: 2,
    });
    expect(summary.workspaces[1]).toMatchObject({
      workspaceId: wsId2,
      workspaceName: 'Billing',
      collections: 1,
      environments: 0,
      requests: 2,
    });
    expect(summary.requests).toBe(4);

    expect(snapshotRequestPostStates(wsId)).toHaveLength(2);
    expect(snapshotRequestPostStates(wsId2)).toHaveLength(2);
    expect(snapshotEnvironmentPostStates(wsId)).toHaveLength(1);
    expect(snapshotEnvironmentPostStates(wsId2)).toHaveLength(0);

    const firstReports = await readRecordedReports();
    const secondReports = ((await storage.get(wsKeys(wsId2).importReports)) ?? []) as ImportReport[];
    expect(firstReports).toHaveLength(1);
    expect(secondReports).toHaveLength(1);
    // The attributed skip lands only in its workspace's report; the
    // unattributed one concerns the whole run and lands in both.
    expect(firstReports[0].drops.some((d) => d.reason === 'HTTP 500.')).toBe(false);
    expect(secondReports[0].drops.some((d) => d.reason === 'HTTP 500.')).toBe(true);
    expect(firstReports[0].drops.some((d) => d.reason.includes('no usable id'))).toBe(true);
    expect(secondReports[0].drops.some((d) => d.reason.includes('no usable id'))).toBe(true);

    releaseWorkspaceService(wsId2);
  });
});
