/**
 * Golden pins for an HTTP-only workflow on a node host (the workflow
 * runs plan, Laws — "Stored workflows do not change — and it is
 * pinned").
 *
 * The real `runs_execute` tool over the real chain runner and the real
 * Node transport against a loopback server. Each scenario pins the
 * whole report, key order included, and what the live cache and the
 * live-variable publication were handed. The goldens are one file the
 * extension's adapter and the CLI's reporters are pinned to as well.
 */

import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  put: vi.fn(),
  error: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/live-cache-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/oracle/live/live-cache-store')>();
  return {
    ...actual,
    putWorkflowRunCache: (...args: Parameters<typeof actual.putWorkflowRunCache>) => {
      h.put(structuredClone(args));
      return actual.putWorkflowRunCache(...args);
    },
    recordRefreshError: (...args: Parameters<typeof actual.recordRefreshError>) => {
      h.error(structuredClone(args));
      return actual.recordRefreshError(...args);
    },
  };
});

vi.mock('@openheaders/oracle/live/live-variable-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/oracle/live/live-variable-store')>();
  return {
    ...actual,
    publishLiveVariablesProducedByRun: (...args: Parameters<typeof actual.publishLiveVariablesProducedByRun>) => {
      h.publish(structuredClone(args));
      return actual.publishLiveVariablesProducedByRun(...args);
    },
  };
});

import { runWorkflowRefresh } from '../../src/daemon/live/chain-runner';
import { runRequestSuite } from '../../src/daemon/live/suite-runner';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createRunToolDefinitions } from '../../src/mcp/tools/run-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

// ── The goldens ─────────────────────────────────────────────────────

type ScenarioName = 'passing' | 'failedAtFetch' | 'failedAtCapture' | 'gateSkipped';

interface GoldenReport {
  startedAt: number;
  durationMs: number;
  extractedAt?: number;
}

interface GoldenCommit {
  put?: { extractedAt: number; expiresAt: number | null };
  error?: { message: string };
  published?: Record<string, Record<string, string>>;
}

interface Goldens {
  workspaceId: string;
  workflowUid: string;
  responses: { token: string; profile: string; introspect: string };
  scenarios: Record<ScenarioName, { report: GoldenReport; commit: GoldenCommit }>;
}

const goldens: Goldens = JSON.parse(
  readFileSync(new URL('../../../core/tests/fixtures/workflow-runs/http-only.json', import.meta.url), 'utf8'),
);

const wsId = goldens.workspaceId;
const CTX = { tokenId: 'token-1', userId: 'user-1' };

// ── Loopback server ─────────────────────────────────────────────────

let server: Server;
let port = 0;
let refusedPort = 0;
let hits: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const bearer = req.headers.authorization;
    hits.push(`${req.method} ${req.url}${bearer === undefined ? '' : ` ${bearer}`}`);
    const body =
      req.url === '/token'
        ? goldens.responses.token
        : req.url === '/profile'
          ? goldens.responses.profile
          : goldens.responses.introspect;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;

  const closed = createServer();
  await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
  refusedPort = (closed.address() as AddressInfo).port;
  await new Promise<void>((resolve) => closed.close(() => resolve()));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ── Harness — the real suite loop and the real chain runner ─────────

const tools = new Map<string, McpToolDefinition>(
  [
    ...createWriteToolDefinitions(),
    ...createRunToolDefinitions({ runSuite: runRequestSuite, runWorkflow: runWorkflowRefresh }),
  ].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

async function saveRequest(request: Record<string, unknown>): Promise<string> {
  const result = (await call('requests_save', { request })) as { request: { uid: string } };
  return result.request.uid;
}

async function seedWorkflow(steps: WorkflowStep[], refresh: LiveWorkflow['refresh'] = { kind: 'manual' }) {
  const workflow: LiveWorkflow = {
    schemaVersion: 5,
    uid: goldens.workflowUid,
    path: `live-workflows/token-chain-${goldens.workflowUid}`,
    name: 'Token chain',
    steps,
    refresh,
    enabled: true,
    published: true,
  };
  await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));
}

function loginStep(requestUid: string, tokenPath: string): WorkflowStep {
  return {
    uid: 'stplogin',
    id: 'login',
    requestUid,
    captures: [
      { uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: tokenPath } },
      { uid: 'capttl00', name: 'ttl', extractor: { kind: 'json-path', path: '$.expires_in' } },
    ],
  };
}

function profileStep(requestUid: string): WorkflowStep {
  return {
    uid: 'stpprofl',
    id: 'profile',
    requestUid,
    captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
  };
}

const saveTokenRequest = (): Promise<string> =>
  saveRequest({ name: 'Token', method: 'POST', url: `http://127.0.0.1:${port}/token` });

const saveProfileRequest = (targetPort: number): Promise<string> =>
  saveRequest({
    name: 'Profile',
    url: `http://127.0.0.1:${targetPort}/profile`,
    headers: [{ key: 'Authorization', value: 'Bearer {{step.login.token}}' }],
  });

/** A commit's own clock, moved onto the golden's — the expiry keeps its distance. */
function onGoldenClock<T extends { extractedAt: number; expiresAt: number | null }>(input: T, golden: number): T {
  const shift = golden - input.extractedAt;
  return {
    ...input,
    extractedAt: golden,
    expiresAt: input.expiresAt === null ? null : input.expiresAt + shift,
  };
}

async function runPinned(scenario: ScenarioName): Promise<{ report: unknown; commit: GoldenCommit }> {
  const golden = goldens.scenarios[scenario];
  const raw = await call('runs_execute', { kind: 'workflow', ref: 'Token chain' });
  expect(typeof raw.startedAt).toBe('number');
  expect(typeof raw.durationMs).toBe('number');
  const report = {
    ...raw,
    startedAt: golden.report.startedAt,
    durationMs: golden.report.durationMs,
    ...('extractedAt' in raw ? { extractedAt: golden.report.extractedAt } : {}),
  };

  const commit: GoldenCommit = {};
  expect(h.put.mock.calls.length + h.error.mock.calls.length).toBe(1);
  for (const [[input, workspaceId]] of h.put.mock.calls) {
    expect(workspaceId).toBe(wsId);
    expect(input.extractedAt).toBe(raw.extractedAt);
    commit.put = onGoldenClock(input, golden.commit.put?.extractedAt ?? input.extractedAt);
  }
  for (const [[input, workspaceId]] of h.error.mock.calls) {
    expect(workspaceId).toBe(wsId);
    commit.error = input;
  }
  for (const [[workspaceId, workflowUid, stepCaptures]] of h.publish.mock.calls) {
    expect(workspaceId).toBe(wsId);
    expect(workflowUid).toBe(goldens.workflowUid);
    commit.published = stepCaptures;
  }
  return { report, commit };
}

function expectGolden(actual: unknown, golden: unknown): void {
  expect(actual).toEqual(golden);
  expect(JSON.stringify(actual)).toBe(JSON.stringify(golden));
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  h.put.mockReset();
  h.error.mockReset();
  h.publish.mockReset();
  hits = [];
});

afterEach(() => {
  __resetRateLimiterForTests();
  disposeSyncService();
});

// ── The four runs ───────────────────────────────────────────────────

describe('an HTTP-only workflow on a node host', () => {
  it('passing — every step a row, the captures committed at once and published', async () => {
    await seedWorkflow(
      [loginStep(await saveTokenRequest(), '$.access_token'), profileStep(await saveProfileRequest(port))],
      { kind: 'expires-in', stepId: 'login', captureName: 'ttl', leadSeconds: 60 },
    );

    const { report, commit } = await runPinned('passing');

    expectGolden(report, goldens.scenarios.passing.report);
    expectGolden(commit, goldens.scenarios.passing.commit);
    expect(hits).toEqual(['POST /token', 'GET /profile Bearer tok-abc']);
  });

  it('failing at a fetch — the failing step alone has a verdict, nothing is committed or published', async () => {
    await seedWorkflow([
      loginStep(await saveTokenRequest(), '$.access_token'),
      profileStep(await saveProfileRequest(refusedPort)),
    ]);

    const { report, commit } = await runPinned('failedAtFetch');

    expectGolden(report, goldens.scenarios.failedAtFetch.report);
    expectGolden(commit, goldens.scenarios.failedAtFetch.commit);
    expect(hits).toEqual(['POST /token']);
  });

  it('failing at a capture — the step after it is never sent', async () => {
    await seedWorkflow([
      loginStep(await saveTokenRequest(), '$.session_token'),
      profileStep(await saveProfileRequest(port)),
    ]);

    const { report, commit } = await runPinned('failedAtCapture');

    expectGolden(report, goldens.scenarios.failedAtCapture.report);
    expectGolden(commit, goldens.scenarios.failedAtCapture.commit);
    expect(hits).toEqual(['POST /token']);
  });

  it('one step skipped by its gate — the run passes and the skip rides the commit', async () => {
    const introspect = await saveRequest({ name: 'Introspect', url: `http://127.0.0.1:${port}/introspect` });
    const refresh = await saveTokenRequest();
    await seedWorkflow([
      {
        uid: 'stpintro',
        id: 'introspect',
        requestUid: introspect,
        captures: [{ uid: 'capactiv', name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
      },
      {
        ...loginStep(refresh, '$.access_token'),
        uid: 'stprefsh',
        id: 'refresh',
        dependsOn: ['introspect'],
        runIf: {
          all: [
            { uid: 'gateactv', kind: 'capture-equals', stepId: 'introspect', captureName: 'active', value: 'false' },
          ],
        },
      },
    ]);

    const { report, commit } = await runPinned('gateSkipped');

    expectGolden(report, goldens.scenarios.gateSkipped.report);
    expectGolden(commit, goldens.scenarios.gateSkipped.commit);
    expect(hits).toEqual(['GET /introspect']);
  });
});
