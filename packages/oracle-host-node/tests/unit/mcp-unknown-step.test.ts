/**
 * A workflow with steps this build does not know, on a node host (the
 * workflow runs plan, Laws — "A run that cannot run every step runs
 * none", "A workflow with a step this build does not know is read-only
 * here").
 *
 * The workflow reaches the host by sync. The real runner refuses the
 * run before its first step: no request leaves, nothing is committed or
 * published, the cache row records the step and the sentence, and the
 * report names each such step as an `error` row. The agent save tool
 * renames it and switches it off, and refuses to author or change one.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import type { LiveWorkflow } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { getWorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotLiveWorkflowPostStates,
} from '@openheaders/oracle/sync/service';
import * as v from 'valibot';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ put: vi.fn(), error: vi.fn(), publish: vi.fn() }));

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
import { createNodeRequestTransport } from '../../src/live/node-request-transport';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createExecuteToolDefinitions } from '../../src/mcp/tools/execute-tools';
import { createRunToolDefinitions } from '../../src/mcp/tools/run-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-unknown-step';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

const LISTEN = { uid: 'stplistn', id: 'probe', action: 'watch', session: 'mqttreq1' };
const EXPECT = { uid: 'stpexpct', id: 'status', action: 'verify', on: 'probe', after: 'reboot', captures: [] };

const LISTEN_SENTENCE = 'Step "probe" needs a newer version of OpenHeaders (action "watch").';
const EXPECT_SENTENCE = 'Step "status" needs a newer version of OpenHeaders (action "verify").';
const WORKFLOW_SENTENCE = 'This workflow has steps that need a newer version of OpenHeaders. Update to edit or run it.';

let server: Server;
let port = 0;
let hits: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"id":"cmd-1"}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const tools = new Map<string, McpToolDefinition>(
  [
    ...createWriteToolDefinitions(),
    ...createExecuteToolDefinitions({ transport: createNodeRequestTransport(), runWorkflow: runWorkflowRefresh }),
    ...createRunToolDefinitions({ runSuite: runRequestSuite, runWorkflow: runWorkflowRefresh }),
  ].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

/** The workflow as a newer build wrote it, arriving the way a peer's does — never through this host's save tool. */
async function receiveWorkflow(): Promise<LiveWorkflow> {
  const saved = (await call('requests_save', {
    request: { name: 'Reboot dev-1', method: 'POST', url: `http://127.0.0.1:${port}/reboot` },
  })) as { request: { uid: string } };
  const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
    schemaVersion: 5,
    uid: 'wfdevice',
    path: 'live-workflows/reboot-wfdevice',
    name: 'Reboot',
    steps: [LISTEN, { uid: 'stpcall0', id: 'reboot', requestUid: saved.request.uid, captures: [] }, EXPECT],
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  });
  await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));
  return workflow;
}

const stored = (): LiveWorkflow | undefined =>
  snapshotLiveWorkflowPostStates(wsId).find((ps) => ps.workflow.uid === 'wfdevice')?.workflow;

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

describe('running a workflow with steps this build does not know', () => {
  it('runs none of it: error rows for the unknown steps, the call step skipped, no request sent', async () => {
    await receiveWorkflow();

    const report = await call('runs_execute', { kind: 'workflow', ref: 'Reboot' });

    expect(report.ok).toBe(false);
    expect(report.items).toEqual([
      { kind: 'step', uid: 'stplistn', name: 'probe', status: 'error', error: LISTEN_SENTENCE },
      { kind: 'step', uid: 'stpcall0', name: 'reboot', status: 'skipped' },
      { kind: 'step', uid: 'stpexpct', name: 'status', status: 'error', error: EXPECT_SENTENCE },
    ]);
    expect(report.totals).toEqual({ items: 3, passed: 0, failed: 0, skipped: 1, errors: 2 });
    expect(hits).toEqual([]);
  });

  it('commits and publishes nothing, and records the first such step with the sentence', async () => {
    await receiveWorkflow();

    await call('runs_execute', { kind: 'workflow', ref: 'Reboot' });

    expect(h.put).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.error.mock.calls).toEqual([
      [
        [
          {
            workflowUid: 'wfdevice',
            environmentId: null,
            message: LISTEN_SENTENCE,
            failedStepId: 'probe',
            extractorOk: true,
          },
          wsId,
        ],
      ],
    ]);
    const row = await getWorkflowRunCache('wfdevice', null, wsId);
    expect(row).toMatchObject({ stepCaptures: {}, lastErrorStepId: 'probe', lastErrorMessage: LISTEN_SENTENCE });
    expect(row?.refreshHealth).toBeUndefined();
  });

  it('answers workflows_run with the step and the reason', async () => {
    await receiveWorkflow();

    const result = await call('workflows_run', { uid: 'wfdevice' });

    expect(result).toEqual({
      workspaceId: wsId,
      workflowUid: 'wfdevice',
      environmentId: null,
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'unsupported',
      message: LISTEN_SENTENCE,
    });
    expect(hits).toEqual([]);
  });
});

describe('the agent save tool and a workflow with steps this build does not know', () => {
  it('refuses to author one, naming the step', async () => {
    const saved = (await call('requests_save', {
      request: { name: 'Reboot dev-1', method: 'POST', url: `http://127.0.0.1:${port}/reboot` },
    })) as { request: { uid: string } };

    const authoring = call('workflows_save', {
      workflow: { name: 'Reboot', steps: [LISTEN, { id: 'reboot', requestUid: saved.request.uid, captures: [] }] },
    });

    await expect(authoring).rejects.toThrow(McpToolInputError);
    await expect(authoring).rejects.toThrow(`invalid workflow: ${LISTEN_SENTENCE}`);
    expect(snapshotLiveWorkflowPostStates(wsId)).toEqual([]);
  });

  it('renames one and switches it off, its steps as they came', async () => {
    const workflow = await receiveWorkflow();

    await call('workflows_save', { uid: 'wfdevice', workflow: { name: 'Reboot dev-1' } });
    await call('workflows_save', { uid: 'wfdevice', workflow: { enabled: false } });

    expect(stored()).toMatchObject({ name: 'Reboot dev-1', enabled: false, published: true });
    expect(stored()?.steps).toEqual(workflow.steps);
  });

  it('refuses to change its steps or its refresh policy', async () => {
    const workflow = await receiveWorkflow();
    const callOnly = workflow.steps.filter((step) => !('action' in step));

    await expect(call('workflows_save', { uid: 'wfdevice', workflow: { steps: callOnly } })).rejects.toThrow(
      `${WORKFLOW_SENTENCE} This host can rename it or switch it on or off; it cannot change steps.`,
    );
    await expect(
      call('workflows_save', { uid: 'wfdevice', workflow: { refresh: { kind: 'interval', seconds: 60 } } }),
    ).rejects.toThrow(/it cannot change refresh\./);
    expect(stored()?.steps).toEqual(workflow.steps);
    expect(stored()?.refresh).toEqual({ kind: 'manual' });
  });

  it('refuses to bind a live variable to a step it does not know', async () => {
    await receiveWorkflow();

    await expect(
      call('workflows_save', {
        uid: 'wfdevice',
        workflow: { name: 'Reboot' },
        exposes: [{ name: 'deviceState', stepId: 'status', captureName: 'state' }],
      }),
    ).rejects.toThrow(`'exposes[0]' cannot bind — ${EXPECT_SENTENCE}`);
  });

  it('refuses to author a session step too, in a build that authors calls alone', async () => {
    const listen = { id: 'probe', action: 'listen', sessionRequestUid: 'mqttreq1', timeoutMs: 5_000, captures: [] };

    const authoring = call('workflows_save', { workflow: { name: 'Probe', steps: [listen] } });

    await expect(authoring).rejects.toThrow(McpToolInputError);
    await expect(authoring).rejects.toThrow(
      'invalid workflow: Step "probe" needs a newer version of OpenHeaders (action "listen").',
    );
    expect(snapshotLiveWorkflowPostStates(wsId)).toEqual([]);
  });
});
