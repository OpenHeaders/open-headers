/**
 * The node host's live-workflow doors (the workflow runs plan, Decisions
 * log, S5) — a person's press through the manual-refresh rule over the
 * real chain runner and the real Node transport against a loopback
 * server: the answer, the run's facts on the host's sink, each step's
 * product asked for by run and step, the cache read, and the circuit.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import { setHostLogger } from '@openheaders/core/logger';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import type { LiveWorkflow, WorkflowRunCache } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { onLiveCacheStoreChange } from '@openheaders/oracle/live/live-cache-store';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import { __resetWorkflowRunFeedForTests, setWorkflowRunEventSink } from '@openheaders/oracle/live/workflow-run-feed';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import * as v from 'valibot';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runWorkflowRefresh } from '../../src/daemon/live/chain-runner';
import { handleLiveWorkflowRpc, isLiveWorkflowRpc } from '../../src/daemon/live-workflow-rpc';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-press';
const WORKFLOW_UID = 'wfpress1';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

// ── Loopback server ─────────────────────────────────────────────────

let server: Server;
let port = 0;
let refusedPort = 0;

beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(req.url === '/token' ? '{"access_token":"tok-abc","expires_in":3600}' : '{"name":"John Doe"}');
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

// ── Harness ─────────────────────────────────────────────────────────

const tools = new Map<string, McpToolDefinition>(createWriteToolDefinitions().map((t) => [t.name, t]));

async function saveRequest(request: Record<string, unknown>): Promise<string> {
  const tool = tools.get('requests_save');
  if (!tool) throw new Error('missing tool requests_save');
  const result = (await tool.handler({ workspaceId: wsId, request }, CTX)) as { request: { uid: string } };
  return result.request.uid;
}

/** The token chain: a login whose token the profile call carries. A later step arrives as a peer's does. */
async function seedWorkflow(profilePort: number, laterSteps: unknown[] = []): Promise<LiveWorkflow> {
  const login = await saveRequest({ name: 'Token', method: 'POST', url: `http://127.0.0.1:${port}/token` });
  const profile = await saveRequest({
    name: 'Profile',
    url: `http://127.0.0.1:${profilePort}/profile`,
    headers: [{ key: 'Authorization', value: 'Bearer {{step.login.token}}' }],
  });
  const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
    schemaVersion: 5,
    uid: WORKFLOW_UID,
    path: `live-workflows/token-chain-${WORKFLOW_UID}`,
    name: 'Token chain',
    steps: [
      {
        uid: 'stplogin',
        id: 'login',
        requestUid: login,
        captures: [{ uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
      {
        uid: 'stpprofl',
        id: 'profile',
        requestUid: profile,
        captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
      },
      ...laterSteps,
    ],
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  });
  await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));
  return workflow;
}

let frames: LiveWorkflowRunEventWire[] = [];

function press(runId?: string): Promise<unknown> {
  return handleLiveWorkflowRpc('refreshLiveWorkflowNow', {
    workflowUid: WORKFLOW_UID,
    environmentId: null,
    workspaceId: wsId,
    ...(runId !== undefined ? { runId } : {}),
  });
}

async function readRow(): Promise<WorkflowRunCache | undefined> {
  const answer = (await handleLiveWorkflowRpc('getLiveCacheForWorkflow', {
    workflowUid: WORKFLOW_UID,
    workspaceId: wsId,
  })) as { runs: WorkflowRunCache[] };
  return answer.runs.find((run) => run.environmentId === null);
}

function productOf(runId: string, stepId: string): Promise<unknown> {
  return handleLiveWorkflowRpc('getLiveWorkflowRunProduct', { runId, stepId });
}

/** Each frame as its type and, for a settle, the step and how it ended. */
function outline(): string[] {
  return frames.map(({ fact }) =>
    fact.type === 'step-settle'
      ? `settle ${fact.stepId} ${fact.settlement.state}${fact.hasProduct ? ' +product' : ''}`
      : fact.type === 'step-start'
        ? `start ${fact.stepId}`
        : fact.type,
  );
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  frames = [];
  setWorkflowRunEventSink((frame) => frames.push(frame));
});

afterEach(() => {
  __resetWorkflowRunFeedForTests();
  __resetRateLimiterForTests();
  disposeSyncService();
});

// ── The doors ───────────────────────────────────────────────────────

describe('the node host’s live-workflow doors', () => {
  it('owns the four calls and no other', () => {
    expect(isLiveWorkflowRpc('refreshLiveWorkflowNow')).toBe(true);
    expect(isLiveWorkflowRpc('getLiveCacheForWorkflow')).toBe(true);
    expect(isLiveWorkflowRpc('resetLiveWorkflowCircuit')).toBe(true);
    expect(isLiveWorkflowRpc('getLiveWorkflowRunProduct')).toBe(true);
    expect(isLiveWorkflowRpc('listLiveWorkflows')).toBe(false);
  });

  it('a passing press answers the row it wrote and feeds the run under the caller’s id', async () => {
    await seedWorkflow(port);
    const changed: Array<string | null> = [];
    const stop = onLiveCacheStoreChange((_workspaceId, workflowUid) => changed.push(workflowUid));

    const answer = await press('run-pass');
    stop();

    expect(answer).toMatchObject({
      success: true,
      run: { workflowUid: WORKFLOW_UID, stepCaptures: { login: { token: 'tok-abc' }, profile: { name: 'John Doe' } } },
    });
    expect(outline()).toEqual([
      'begin',
      'start login',
      'settle login passed +product',
      'start profile',
      'settle profile passed +product',
      'end',
    ]);
    expect(frames.map((frame) => frame.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(frames.map((frame) => `${frame.workspaceId} ${frame.workflowUid} ${frame.runId}`))).toEqual(
      new Set([`${wsId} ${WORKFLOW_UID} run-pass`]),
    );
    expect(changed).toContain(WORKFLOW_UID);
  });

  it('a press failing at a fetch answers the step’s sentence, and each step’s exchange is there to ask for', async () => {
    await seedWorkflow(refusedPort);

    const answer = await press('run-fail');

    expect(answer).toEqual({ success: false, error: 'Connection refused by 127.0.0.1.' });
    expect(outline()).toEqual([
      'begin',
      'start login',
      'settle login passed +product',
      'start profile',
      'settle profile failed +product',
      'end',
    ]);
    const failed = frames.find((frame) => frame.fact.type === 'step-settle' && frame.fact.stepId === 'profile');
    expect(failed?.fact).toMatchObject({
      settlement: { state: 'failed', phase: 'fetch', reason: 'Connection refused by 127.0.0.1.' },
    });
    const passed = frames.find((frame) => frame.fact.type === 'step-settle' && frame.fact.stepId === 'login');
    expect(passed?.fact).toMatchObject({
      settlement: { state: 'passed', status: 200, durationMs: expect.any(Number), captureNames: ['token'] },
    });

    expect(await productOf('run-fail', 'login')).toMatchObject({
      product: { kind: 'response', snapshot: { status: 200, error: null } },
    });
    expect(await productOf('run-fail', 'profile')).toMatchObject({
      product: { kind: 'response', snapshot: { error: 'Connection refused by 127.0.0.1.' } },
    });
    expect(await productOf('run-other', 'profile')).toEqual({ product: null });

    expect(await readRow()).toMatchObject({
      lastErrorMessage: 'Connection refused by 127.0.0.1.',
      lastErrorStepId: 'profile',
      consecutiveFailures: 1,
    });
  });

  it('a press on an open circuit runs anyway and leaves the circuit where it was; a reset closes it', async () => {
    const workflow = await seedWorkflow(refusedPort);
    for (let i = 0; i < 3; i++) await runWorkflowRefresh({ workspaceId: wsId, workflow, environmentId: null });
    const before = await readRow();
    expect(before?.circuit).toMatchObject({ state: 'open', consecutiveOpenings: 1 });
    frames = [];

    const answer = await press();

    expect(answer).toEqual({ success: false, error: 'Connection refused by 127.0.0.1.' });
    expect(outline()).toContain('settle profile failed +product');
    const after = await readRow();
    expect(after?.circuit).toEqual(before?.circuit);
    expect(after?.consecutiveFailures).toBe(before?.consecutiveFailures);

    expect(
      await handleLiveWorkflowRpc('resetLiveWorkflowCircuit', {
        workflowUid: WORKFLOW_UID,
        environmentId: null,
        workspaceId: wsId,
      }),
    ).toEqual({ success: true });
    const reset = await readRow();
    expect(reset?.circuit).toMatchObject({ state: 'closed', consecutiveFailures: 0, consecutiveOpenings: 0 });
    expect(reset?.lastErrorMessage).toBeUndefined();
  });

  it('a workflow with a step this build does not know is refused: no step starts, its rows say which cannot run', async () => {
    const listen = { uid: 'stplistn', id: 'listen', action: 'watch', session: 'reqmqtt01', captures: [] };
    await seedWorkflow(port, [listen]);

    const answer = (await press('run-refused')) as { success: boolean; error: string };

    expect(answer.success).toBe(false);
    expect(answer.error).toContain('listen');
    expect(outline()).toEqual([
      'begin',
      'settle login not-run',
      'settle profile not-run',
      'settle listen cannot-run',
      'end',
    ]);
  });

  it('a press on a workflow the workspace does not hold answers which and where', async () => {
    expect(await press()).toEqual({
      success: false,
      error: `Workflow ${WORKFLOW_UID} not found in workspace ${wsId}`,
    });
    expect(frames).toEqual([]);
  });
});
