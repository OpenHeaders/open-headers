/**
 * A call's success criteria on a node host (the workflow runs plan, The
 * model — "One criteria vocabulary, no language").
 *
 * The real chain runner over the real Node transport against a loopback
 * server, beside the golden pins: a criterion whose value is a template
 * is resolved by this host — an earlier step's capture among its scopes
 * — and a reference nothing answers fails the step before it is sent.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import type { Criterion, LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { getWorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runWorkflowRefresh } from '../../src/daemon/live/chain-runner';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-criteria';
const WORKFLOW_UID = 'wfowner0';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

let server: Server;
let port = 0;
let hits: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(req.url === '/session' ? '{"owner":"John Doe"}' : '{"name":"John Doe"}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const tools = new Map<string, McpToolDefinition>(createWriteToolDefinitions().map((tool) => [tool.name, tool]));

async function saveRequest(request: Record<string, unknown>): Promise<string> {
  const tool = tools.get('requests_save');
  if (!tool) throw new Error('missing tool requests_save');
  const result = (await tool.handler({ workspaceId: wsId, request }, CTX)) as { request: { uid: string } };
  return result.request.uid;
}

/** A session call that captures the owner, then a profile call held to a criterion. */
async function seedWorkflow(criterion: Criterion): Promise<LiveWorkflow> {
  const steps: WorkflowStep[] = [
    {
      uid: 'stpsessn',
      id: 'session',
      requestUid: await saveRequest({ name: 'Session', method: 'POST', url: `http://127.0.0.1:${port}/session` }),
      captures: [{ uid: 'capowner', name: 'owner', extractor: { kind: 'json-path', path: '$.owner' } }],
    },
    {
      uid: 'stpprofl',
      id: 'profile',
      requestUid: await saveRequest({ name: 'Profile', url: `http://127.0.0.1:${port}/profile` }),
      captures: [],
      successCriteria: [criterion],
    },
  ];
  const workflow: LiveWorkflow = {
    schemaVersion: 5,
    uid: WORKFLOW_UID,
    path: `live-workflows/owner-check-${WORKFLOW_UID}`,
    name: 'Owner check',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  };
  await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));
  return workflow;
}

function nameEquals(value: string): Criterion {
  return { kind: 'equals', uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' }, value };
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  hits = [];
});

afterEach(() => {
  __resetRateLimiterForTests();
  disposeSyncService();
});

describe('a call’s success criteria on a node host', () => {
  it('holds the response to a value from an earlier step’s capture', async () => {
    const workflow = await seedWorkflow(nameEquals('{{step.session.owner}}'));

    const result = await runWorkflowRefresh({ workspaceId: wsId, workflow, environmentId: null });

    expect(result).toEqual({ ok: true, skippedStepIds: [] });
    expect(hits).toEqual(['POST /session', 'GET /profile']);
    const run = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    expect(run?.stepCaptures).toEqual({ session: { owner: 'John Doe' }, profile: {} });
  });

  it('fails the step with the criterion when the resolved value does not hold', async () => {
    const workflow = await seedWorkflow(nameEquals('{{step.session.owner}} Jr.'));

    const result = await runWorkflowRefresh({ workspaceId: wsId, workflow, environmentId: null });

    expect(result).toEqual({
      ok: false,
      failedStepId: 'profile',
      failedPhase: 'criteria',
      message: 'Expected $.name to equal "John Doe Jr."; got "John Doe".',
    });
    expect(hits).toEqual(['POST /session', 'GET /profile']);
  });

  it('fails the step before it is sent when nothing answers a reference', async () => {
    const workflow = await seedWorkflow(nameEquals('{{step.session.tenant}}'));

    const result = await runWorkflowRefresh({ workspaceId: wsId, workflow, environmentId: null });

    expect(result).toEqual({
      ok: false,
      failedStepId: 'profile',
      failedPhase: 'criteria',
      message:
        '{{step.session.tenant}}: Step id or capture name not found in this workflow run. Check the workflow step configuration.',
    });
    expect(hits).toEqual(['POST /session']);
    const run = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    expect(run?.stepCaptures ?? {}).toEqual({});
    expect(run?.lastErrorStepId).toBe('profile');
  });
});
