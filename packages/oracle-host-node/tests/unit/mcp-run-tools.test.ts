/**
 * Coverage for the runner MCP tool (`runs_execute`) — target
 * resolution + tree-order planning (run-plan), the REAL suite loop
 * (daemon suite-runner over the real Node transport against a
 * loopback server), the pass/fail law (assertions outrank HTTP
 * status; bare >= 400 fails), bail semantics, script-capability
 * honesty, and the workflow-kind reshaping over an injected chain
 * runner (the execute-tools idiom). Handlers are called directly —
 * the tier gate has its own suite in `mcp-registry-policy.test.ts`.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { REQUEST_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import { buildCreateRequestFolderBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { buildAddBatch as buildAddRequestBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import type { Folder, Request } from '@openheaders/core/types';
import { logger as consoleLogger, generateUid, toFolderName } from '@openheaders/core/utils';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotRequestCollectionPostStates,
} from '@openheaders/oracle/sync/service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runRequestSuite } from '../../src/daemon/live/suite-runner';
import { setHostScriptCapabilities } from '../../src/daemon/script-capability';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import type { McpWorkflowRunOutcome } from '../../src/mcp/tools/execute-tools';
import { createReadToolDefinitions } from '../../src/mcp/tools/read-tools';
import { createRunToolDefinitions } from '../../src/mcp/tools/run-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-mcp-run';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

// ── Loopback server: /ok 200, /boom 500 ─────────────────────────────

let server: Server;
let port = 0;
let hits: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    if (req.url === '/boom') {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('kaput');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ── Harness — REAL suite runner, injected workflow runner ───────────

let workflowOutcome: McpWorkflowRunOutcome = { ok: true, skippedStepIds: [] };

const tools = new Map<string, McpToolDefinition>(
  [
    ...createReadToolDefinitions(),
    ...createWriteToolDefinitions(),
    ...createRunToolDefinitions({
      runSuite: runRequestSuite,
      runWorkflow: async () => workflowOutcome,
    }),
  ].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

interface ReportShape {
  ok: boolean;
  target: { kind: string; uid: string; name: string };
  scripts?: { available: boolean; mode?: string };
  items: Array<{
    name: string;
    status: string;
    httpStatus?: number;
    httpVersion?: string;
    error?: string;
    assertions?: Array<{ name: string; passed: boolean }>;
  }>;
  totals: { items: number; passed: number; failed: number; skipped: number };
}

async function runTarget(args: Record<string, unknown>): Promise<ReportShape> {
  return (await call('runs_execute', args)) as unknown as ReportShape;
}

async function saveRequest(request: Record<string, unknown>): Promise<{ uid: string; path: string }> {
  const result = (await call('requests_save', { request })) as { request: { uid: string; path: string } };
  return result.request;
}

/** Seed a folder + a request inside it through the canonical write
 *  path — requests_save only creates at collection root. */
async function seedFolderWithRequest(name: string, requestName: string, url: string): Promise<Folder> {
  const [collection] = snapshotRequestCollectionPostStates(wsId);
  if (!collection) throw new Error('no request collection seeded yet');
  const folderUid = generateUid();
  const folder: Folder = {
    schemaVersion: 5,
    uid: folderUid,
    path: `${collection.collection.path}/${toFolderName(name, folderUid)}`,
    name,
  };
  await applyMcpMutation(
    buildCreateRequestFolderBatch(
      {
        folderUid,
        parent: { type: REQUEST_COLLECTION_ENTITY_TYPE, uid: collection.collection.uid },
        name,
        pathSegment: toFolderName(name, folderUid),
      },
      mintMcpContext(wsId),
    ),
  );
  const requestUid = generateUid();
  const request: Request = {
    schemaVersion: 5,
    uid: requestUid,
    path: `${folder.path}/${toFolderName(requestName, requestUid)}`,
    name: requestName,
    method: 'GET',
    url,
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
  await applyMcpMutation(buildAddRequestBatch(request, mintMcpContext(wsId)));
  return folder;
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  workflowOutcome = { ok: true, skippedStepIds: [] };
  hits = [];
});

afterEach(() => {
  setHostScriptCapabilities(null);
  __resetRateLimiterForTests();
  disposeSyncService();
});

/** Fake Safe runtime: any script mentioning `oh.test` reports one
 *  assertion whose verdict is the absence of an EXPECT-FAIL marker. */
function installFakeScriptRuntime(): void {
  setHostScriptCapabilities({
    safe: {
      mode: 'safe',
      runScript: async ({ source }) => ({
        executionId: 'fake-run',
        succeeded: true,
        assertions: source.includes('oh.test')
          ? [{ name: 'body ok', passed: !source.includes('EXPECT-FAIL'), message: 'expected ok body' }]
          : [],
        consoleLog: [],
        durationMs: 1,
      }),
    },
  });
}

// ── Collection / folder suites ──────────────────────────────────────

describe('runs_execute collection', () => {
  it('runs the tree in sidebar order — folder requests before collection-root requests', async () => {
    await saveRequest({ name: 'Root A', url: `http://127.0.0.1:${port}/ok?root-a` });
    await seedFolderWithRequest('Auth', 'Login', `http://127.0.0.1:${port}/ok?login`);
    await saveRequest({ name: 'Root B', url: `http://127.0.0.1:${port}/ok?root-b` });

    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.ok).toBe(true);
    // Folder requests run before collection-root requests (the sidebar
    // order); root SIBLINGS keep cache order, which this harness does
    // not pin — assert the folder-first law and full membership.
    expect(report.items[0].name).toBe('Login');
    expect(report.items.map((item) => item.name).sort()).toEqual(['Login', 'Root A', 'Root B']);
    expect(report.totals).toEqual({ items: 3, passed: 3, failed: 0, skipped: 0 });
    // The always-on negotiated-protocol report rides every item.
    expect(report.items.map((item) => item.httpVersion)).toEqual(['http/1.1', 'http/1.1', 'http/1.1']);
    expect(hits[0]).toBe('/ok?login');
    expect(report.target.kind).toBe('collection');
  });

  it('fails a no-assertion item on HTTP >= 400 and reports the status as the error', async () => {
    await saveRequest({ name: 'Health', url: `http://127.0.0.1:${port}/boom` });

    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.ok).toBe(false);
    expect(report.items[0]).toMatchObject({
      status: 'failed',
      httpStatus: 500,
      error: 'HTTP 500 Internal Server Error',
    });
  });

  it('lets passing assertions outrank a failing status code', async () => {
    installFakeScriptRuntime();
    await saveRequest({
      name: 'Asserted boom',
      url: `http://127.0.0.1:${port}/boom`,
      postResponseScript: 'oh.test("body ok", () => true)',
    });

    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.ok).toBe(true);
    expect(report.scripts).toEqual({ available: true, mode: 'safe' });
    expect(report.items[0].status).toBe('passed');
    expect(report.items[0].assertions).toEqual([{ name: 'body ok', passed: true, message: 'expected ok body' }]);
  });

  it('fails an item on a failed assertion with the assertion carried', async () => {
    installFakeScriptRuntime();
    await saveRequest({
      name: 'Bad shape',
      url: `http://127.0.0.1:${port}/ok`,
      postResponseScript: 'oh.test("body ok", () => false) // EXPECT-FAIL',
    });

    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.ok).toBe(false);
    expect(report.items[0].status).toBe('failed');
    expect(report.items[0].error).toMatch(/Assertion failed: body ok/);
    expect(report.items[0].assertions?.[0].passed).toBe(false);
  });

  it('reports the scriptless posture honestly when the host has no runtime', async () => {
    await saveRequest({
      name: 'Scriptless',
      url: `http://127.0.0.1:${port}/ok`,
      postResponseScript: 'oh.test("never runs", () => false) // EXPECT-FAIL',
    });

    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.scripts).toEqual({ available: false });
    expect(report.items[0].status).toBe('passed');
  });

  it('bail stops at the first failure and reports the rest skipped without sending them', async () => {
    // The failing request rides a folder so it runs FIRST (folder
    // before roots — root-sibling order is unpinned cache order).
    await saveRequest({ name: 'Alpha', url: `http://127.0.0.1:${port}/ok?alpha` });
    await saveRequest({ name: 'Bravo', url: `http://127.0.0.1:${port}/ok?bravo` });
    await seedFolderWithRequest('First', 'Boom', `http://127.0.0.1:${port}/boom`);

    const report = await runTarget({ kind: 'collection', ref: 'My Requests', bail: true });

    expect(report.items.map((item) => item.status)).toEqual(['failed', 'skipped', 'skipped']);
    expect(report.totals).toEqual({ items: 3, passed: 0, failed: 1, skipped: 2 });
    expect(hits).toEqual(['/boom']);
  });

  it('runs a >5-item one-origin suite without riding the refresh rate limiter', async () => {
    // Default limiter budget (5 starts/min/origin). Suite sends bypass
    // the bucket — the limiter guards background OAuth refresh and
    // workflow steps, not a deliberate CI run — so seven same-origin
    // items complete immediately instead of stalling ~60s for starts
    // six and seven.
    __configureRateLimiterForTests({ maxConcurrent: 1, maxPerMinute: 5 });
    for (let i = 1; i <= 7; i += 1) {
      await saveRequest({ name: `Item ${i}`, url: `http://127.0.0.1:${port}/ok?item=${i}` });
    }

    const started = Date.now();
    const report = await runTarget({ kind: 'collection', ref: 'My Requests' });

    expect(report.totals).toEqual({ items: 7, passed: 7, failed: 0, skipped: 0 });
    expect(hits).toHaveLength(7);
    expect(Date.now() - started).toBeLessThan(5_000);
  }, 10_000);

  it('refuses an empty target instead of minting a vacuous green run', async () => {
    await saveRequest({ name: 'Seed', url: `http://127.0.0.1:${port}/ok` });
    await seedFolderWithRequest('Full', 'Inside', `http://127.0.0.1:${port}/ok`);
    const emptyUid = generateUid();
    await applyMcpMutation({
      batch: seedRequestCollection(
        {
          schemaVersion: 5,
          uid: emptyUid,
          path: `requests/${toFolderName('Empty', emptyUid)}`,
          name: 'Empty',
          variables: [],
          pinnedEnvironmentIds: [],
          defaultEnvironmentId: null,
        },
        mintMcpContext(wsId),
      ),
      sideEffects: [],
    });

    await expect(runTarget({ kind: 'collection', ref: 'Empty' })).rejects.toThrow(/contains no requests/);
  });

  it('rejects an ambiguous collection name naming the candidate uids', async () => {
    await saveRequest({ name: 'Seed', url: `http://127.0.0.1:${port}/ok` });
    const twinUid = generateUid();
    await applyMcpMutation({
      batch: seedRequestCollection(
        {
          schemaVersion: 5,
          uid: twinUid,
          path: `requests/${toFolderName('My Requests', twinUid)}`,
          name: 'My Requests',
          variables: [],
          pinnedEnvironmentIds: [],
          defaultEnvironmentId: null,
        },
        mintMcpContext(wsId),
      ),
      sideEffects: [],
    });

    await expect(runTarget({ kind: 'collection', ref: 'My Requests' })).rejects.toThrow(/ambiguous — use a uid/);
    await expect(runTarget({ kind: 'collection', ref: 'ghost' })).rejects.toThrow(McpToolInputError);
  });
});

describe('runs_execute folder', () => {
  it('targets a folder by bare name and by Collection/Folder path walk', async () => {
    await saveRequest({ name: 'Root', url: `http://127.0.0.1:${port}/ok?root` });
    await seedFolderWithRequest('Auth', 'Login', `http://127.0.0.1:${port}/ok?login`);

    const byName = await runTarget({ kind: 'folder', ref: 'Auth' });
    expect(byName.items.map((item) => item.name)).toEqual(['Login']);
    expect(byName.target.name).toBe('Auth');

    const byPath = await runTarget({ kind: 'folder', ref: 'My Requests/Auth' });
    expect(byPath.items.map((item) => item.name)).toEqual(['Login']);

    await expect(runTarget({ kind: 'folder', ref: 'My Requests/Nope' })).rejects.toThrow(/folder under 'My Requests'/);
  });
});

// ── Workflow kind ───────────────────────────────────────────────────

async function saveWorkflow(): Promise<string> {
  const { uid: requestUid } = await saveRequest({ name: 'Source', url: `http://127.0.0.1:${port}/ok` });
  const result = (await call('workflows_save', {
    workflow: {
      name: 'Token chain',
      published: true,
      steps: [
        { id: 's1', requestUid, captures: [] },
        { id: 's2', requestUid, captures: [], dependsOn: ['s1'] },
      ],
    },
  })) as { workflow: { uid: string } };
  return result.workflow.uid;
}

describe('runs_execute workflow', () => {
  it('reshapes a successful run as per-step passed/skipped items', async () => {
    const uid = await saveWorkflow();
    workflowOutcome = { ok: true, skippedStepIds: ['s2'] };

    const report = await runTarget({ kind: 'workflow', ref: 'Token chain' });

    expect(report.ok).toBe(true);
    expect(report.target).toMatchObject({ kind: 'workflow', uid });
    expect(report.items.map((item) => [item.name, item.status])).toEqual([
      ['s1', 'passed'],
      ['s2', 'skipped'],
    ]);
  });

  it('marks the failing step failed and the rest skipped — the atomic discard made visible', async () => {
    await saveWorkflow();
    workflowOutcome = { ok: false, failedStepId: 's1', failedPhase: 'fetch', message: 'boom' };

    const report = await runTarget({ kind: 'workflow', ref: 'Token chain' });

    expect(report.ok).toBe(false);
    expect(report.items.map((item) => [item.name, item.status])).toEqual([
      ['s1', 'failed'],
      ['s2', 'skipped'],
    ]);
    expect(report.items[0].error).toBe('fetch: boom');
    expect(report.totals.failed).toBe(1);
  });

  it('errors on an unknown workflow ref', async () => {
    await expect(runTarget({ kind: 'workflow', ref: 'ghost' })).rejects.toThrow(/see workflows_list/);
  });
});
