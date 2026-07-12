/**
 * Landing-workspace materialization coverage: pulled payloads ride the
 * standard parsers into real entities through the sync service
 * (in-memory persistence) — request collection with variables, folder
 * tree, requests under their folder paths, environments with the
 * secret split — plus the ONE aggregated report in the landing
 * workspace's ring (pull skips + parse failures as drops with
 * reasons, `sourceHash` stamped for the re-import diff).
 */

import type { ImportReport, PostmanPullResult } from '@openheaders/core/import';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { wsKeys } from '@openheaders/oracle/storage';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotEnvironmentPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
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
      request: { method: 'GET', url: 'https://api.openheaders.io/charges' },
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
    collections: [{ item: 'collection', id: 'c-1', name: 'Payments API', json: COLLECTION_JSON }],
    environments: [{ item: 'environment', id: 'e-1', name: 'Staging', json: ENVIRONMENT_JSON }],
    skipped: [],
    budget: {},
    callsMade: 5,
    ...overrides,
  };
}

const ensureLandingWorkspace = async () => ({ id: wsId, name: 'Imported from Postman' });

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
    const summary = await materializePostmanPull(pullResult(), { ensureLandingWorkspace });

    expect(summary).toMatchObject({
      workspaceId: wsId,
      workspaceName: 'Imported from Postman',
      collections: 1,
      environments: 1,
      requests: 2,
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

    const environments = snapshotEnvironmentPostStates(wsId).map((ps) => ps.environment);
    expect(environments).toHaveLength(1);
    expect(environments[0].name).toBe('Staging');
    expect(environments[0].variables).toMatchObject([
      { name: 'host', value: 'staging.openheaders.io', type: 'default' },
      { name: 'token', value: 'shh', type: 'secret' },
    ]);
  });

  it('records ONE aggregated report with a sourceHash in the landing workspace ring', async () => {
    await materializePostmanPull(
      pullResult({
        skipped: [{ item: 'collection', id: 'c-9', name: 'Ops', reason: 'Not pulled — the run stopped early.' }],
      }),
      { ensureLandingWorkspace },
    );

    const reports = await readRecordedReports();
    expect(reports).toHaveLength(1);
    const report = reports[0];
    expect(report.source).toBe('postman-pull');
    expect(report.sourceHash.length).toBeGreaterThan(0);
    expect(report.summary.imported).toBe(3);
    const skipDrop = report.drops.find((d) => d.path.startsWith('pull.skipped[0]'));
    expect(skipDrop?.reason).toContain('stopped early');
  });

  it('hashes the same pulled payloads identically regardless of item order', async () => {
    const forward = pullResult();
    await materializePostmanPull(forward, { ensureLandingWorkspace });
    const first = (await readRecordedReports())[0];

    __initSyncServiceForTests(wsId);
    const reversed = pullResult();
    // One collection + one environment always sort kind-first, so
    // reordering across the two arrays is the observable permutation.
    const rerun = await materializePostmanPull(
      { ...reversed, collections: [...reversed.collections], environments: [...reversed.environments] },
      { ensureLandingWorkspace },
    );
    const second = (await readRecordedReports())[0];
    expect(rerun.workspaceId).toBe(wsId);
    expect(second.sourceHash).toBe(first.sourceHash);
  });

  it('drops an unparseable collection with a reason and keeps going', async () => {
    const summary = await materializePostmanPull(
      pullResult({
        collections: [
          { item: 'collection', id: 'c-bad', name: 'Broken', json: 'not json' },
          { item: 'collection', id: 'c-1', name: 'Payments API', json: COLLECTION_JSON },
        ],
      }),
      { ensureLandingWorkspace },
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
          { item: 'environment', id: 'e-bad', name: 'Broken', json: 'not json' },
          { item: 'environment', id: 'e-1', name: 'Staging', json: ENVIRONMENT_JSON },
        ],
      }),
      { ensureLandingWorkspace },
    );

    expect(summary.environments).toBe(1);
    const [report] = await readRecordedReports();
    expect(report.drops.some((d) => d.path.startsWith('pull.environments[0]'))).toBe(true);
  });
});
