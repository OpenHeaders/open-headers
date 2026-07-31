/**
 * Coverage for the execute-tier MCP tools + the workflows_history read
 * companion. `requests_send` runs against a REAL loopback HTTP server
 * through the real Node transport — full scope-chain resolution
 * (workspace + environment variables), body handling, and the explicit
 * truncation contract. `workflows_run` uses an injected runner that
 * mimics the desktop chain runner's contract (atomic cache commit +
 * publish-on-run before returning). Handlers are called directly — the
 * tier gate has its own suite in `mcp-registry-policy.test.ts`.
 */

import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { OAuth2Auth } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { getTokenBundle, putTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { putWorkflowRunCache, recordRefreshError } from '@openheaders/oracle/live/live-cache-store';
import { publishLiveVariablesProducedByRun } from '@openheaders/oracle/live/live-variable-store';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import {
  createExecuteToolDefinitions,
  type McpWorkflowRunArgs,
  type McpWorkflowRunOutcome,
} from '../../src/mcp/tools/execute-tools';
import { createReadToolDefinitions } from '../../src/mcp/tools/read-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-mcp-execute';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

// ── Loopback echo server ─────────────────────────────────────────────

interface CapturedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

let server: Server;
let port = 0;
let captured: CapturedRequest | null = null;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      captured = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body };
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('a'.repeat(150_000));
        return;
      }
      if (req.url === '/token') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer', expires_in: 3600 }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ── Harness ──────────────────────────────────────────────────────────

/** Chain-runner-contract fake: commit captures atomically + publish
 *  exposed live vars BEFORE returning, exactly like the desktop runner. */
const RUN_CAPTURES = { s1: { token: 'tok-123' } };

async function runWorkflowFake(args: McpWorkflowRunArgs): Promise<McpWorkflowRunOutcome> {
  await putWorkflowRunCache(
    {
      workflowUid: args.workflow.uid,
      environmentId: args.environmentId,
      stepCaptures: RUN_CAPTURES,
      stepResponseBytes: { s1: 42 },
      extractedAt: 1_111,
      expiresAt: null,
    },
    args.workspaceId,
  );
  await publishLiveVariablesProducedByRun(args.workspaceId, args.workflow.uid, RUN_CAPTURES);
  return { ok: true, skippedStepIds: [] };
}

const tools = new Map<string, McpToolDefinition>(
  [
    ...createReadToolDefinitions(),
    ...createWriteToolDefinitions(),
    ...createExecuteToolDefinitions({ transport: createNodeRequestTransport(), runWorkflow: runWorkflowFake }),
  ].map((t) => [t.name, t]),
);

// No oracle host hooks in the unit harness — every call passes the
// workspace explicitly.
function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

async function saveRequest(request: Record<string, unknown>): Promise<string> {
  const result = (await call('requests_save', { request })) as { request: { uid: string } };
  return result.request.uid;
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  captured = null;
});

afterEach(() => {
  __resetRateLimiterForTests();
  disposeSyncService();
});

// ── requests_send ────────────────────────────────────────────────────

describe('requests_send', () => {
  it('resolves workspace variables and sends over the real transport', async () => {
    await call('variables_set', { name: 'region', value: 'eu-west' });
    const uid = await saveRequest({
      name: 'Echo',
      method: 'POST',
      url: `http://127.0.0.1:${port}/echo`,
      headers: [{ key: 'X-Region', value: '{{region}}', enabled: true }],
      body: { type: 'json', content: '{"region":"{{region}}"}' },
    });

    const result = await call('requests_send', { uid });

    expect(result.sent).toBe(true);
    const response = result.response as { status: number; body: string; bodyTruncated: boolean; httpVersion?: string };
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(response.bodyTruncated).toBe(false);
    // The always-on negotiated-protocol report rides the tool payload.
    expect(response.httpVersion).toBe('http/1.1');
    expect(captured?.method).toBe('POST');
    expect(captured?.headers['x-region']).toBe('eu-west');
    expect(captured?.headers['content-type']).toBe('application/json');
    expect(captured?.body).toBe('{"region":"eu-west"}');
  });

  it('resolves through an explicit environment ahead of the workspace scope', async () => {
    await call('variables_set', { name: 'region', value: 'eu-west' });
    const created = (await call('environments_create', {
      name: 'Staging',
      variables: [{ name: 'region', value: 'us-east' }],
    })) as { environment: { uid: string } };
    const uid = await saveRequest({
      name: 'Echo',
      url: `http://127.0.0.1:${port}/echo`,
      headers: [{ key: 'X-Region', value: '{{region}}', enabled: true }],
    });

    const result = await call('requests_send', { uid, environmentId: created.environment.uid });

    expect(result.environmentId).toBe(created.environment.uid);
    expect(captured?.headers['x-region']).toBe('us-east');
  });

  it('rejects an unknown environmentId with an agent-readable error', async () => {
    const uid = await saveRequest({ name: 'Echo', url: `http://127.0.0.1:${port}/echo` });
    await expect(call('requests_send', { uid, environmentId: 'ghost' })).rejects.toThrow(/environments_list/);
  });

  it('refuses to send a request with unresolved variables', async () => {
    const uid = await saveRequest({
      name: 'Echo',
      url: `http://127.0.0.1:${port}/echo`,
      headers: [{ key: 'X-Region', value: '{{missing}}', enabled: true }],
    });

    const result = await call('requests_send', { uid });

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/unresolved variables/);
    expect(captured).toBeNull();
  });

  it('truncates oversized bodies explicitly, never silently', async () => {
    const uid = await saveRequest({ name: 'Big', url: `http://127.0.0.1:${port}/big` });

    const result = await call('requests_send', { uid });

    const response = result.response as { body: string; bodyTruncated: boolean; bodyBytes: number };
    expect(response.body).toHaveLength(100_000);
    expect(response.bodyTruncated).toBe(true);
    expect(response.bodyBytes).toBe(150_000);
  });

  it('refreshes an expired OAuth bundle through the host transport before the send', async () => {
    const oauthConfig: OAuth2Auth = {
      type: 'oauth2',
      credentialRef: 'cred-mcp',
      flow: 'authorization-code-pkce',
      tokenEndpoint: `http://127.0.0.1:${port}/token`,
      clientId: 'client-mcp',
      scopes: [],
    };
    await putTokenBundle(
      'cred-mcp',
      {
        accessToken: 'at-stale',
        refreshToken: 'rt-1',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
        issuedAt: Date.now() - 3_600_000,
        scope: '',
      },
      oauthConfig,
      wsId,
    );
    const uid = await saveRequest({
      name: 'Authed echo',
      url: `http://127.0.0.1:${port}/echo`,
      auth: oauthConfig,
    });

    const result = await call('requests_send', { uid });

    expect(result.sent).toBe(true);
    // The refresh POST rode the same transport first; the send carried
    // the fresh token, and the refreshed bundle persisted to the store.
    expect(captured?.url).toBe('/echo');
    expect(captured?.headers.authorization).toBe('Bearer at-fresh');
    expect((await getTokenBundle('cred-mcp', wsId))?.accessToken).toBe('at-fresh');
  });

  it('surfaces a network failure as an error result, not an exception', async () => {
    // Port 1 on loopback is never listening — a classified connect error.
    const uid = await saveRequest({ name: 'Down', url: 'http://127.0.0.1:1/echo' });

    const result = await call('requests_send', { uid });

    expect(result.sent).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('errors on an unknown request uid', async () => {
    await expect(call('requests_send', { uid: 'missing' })).rejects.toThrow(/see requests_list/);
  });
});

// ── workflows_run ────────────────────────────────────────────────────

async function saveWorkflow(): Promise<{ workflowUid: string }> {
  const requestUid = await saveRequest({ name: 'Token source', url: `http://127.0.0.1:${port}/echo` });
  const result = (await call('workflows_save', {
    workflow: {
      name: 'Token chain',
      published: true,
      steps: [
        {
          id: 's1',
          requestUid,
          captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.ok' } }],
        },
      ],
    },
    exposes: [{ name: 'apiToken', stepId: 's1', captureName: 'token' }],
  })) as { workflow: { uid: string } };
  return { workflowUid: result.workflow.uid };
}

describe('workflows_run', () => {
  it('runs the workflow and reports captures + published live variables', async () => {
    const { workflowUid } = await saveWorkflow();

    const result = await call('workflows_run', { uid: workflowUid });

    expect(result.ok).toBe(true);
    expect(result.stepCaptures).toEqual(RUN_CAPTURES);
    expect(result.extractedAt).toBe(1_111);
    expect(result.liveVariables).toEqual([
      { name: 'apiToken', reference: '{{live.apiToken}}', published: true, value: 'tok-123' },
    ]);
  });

  it('passes a run failure through as a value', async () => {
    const { workflowUid } = await saveWorkflow();
    const failing = createExecuteToolDefinitions({
      transport: createNodeRequestTransport(),
      runWorkflow: async () => ({ ok: false, failedStepId: 's1', failedPhase: 'fetch', message: 'boom' }),
    }).find((t) => t.name === 'workflows_run');
    if (!failing) throw new Error('missing workflows_run');

    const result = (await failing.handler({ workspaceId: wsId, uid: workflowUid }, CTX)) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.failedStepId).toBe('s1');
    expect(result.failedPhase).toBe('fetch');
    expect(result.message).toBe('boom');
  });

  it('errors on an unknown workflow uid', async () => {
    await expect(call('workflows_run', { uid: 'missing' })).rejects.toThrow(/see workflows_list/);
  });
});

// ── workflows_save (write tier, exercised alongside run) ────────────

describe('workflows_save', () => {
  it('mints workflow + step + capture uids and creates draft live variables', async () => {
    const requestUid = await saveRequest({ name: 'Src', url: `http://127.0.0.1:${port}/echo` });
    const result = (await call('workflows_save', {
      workflow: {
        name: 'Chain',
        steps: [{ id: 's1', requestUid, captures: [{ name: 'token', extractor: { kind: 'whole-body' } }] }],
      },
      exposes: [{ name: 'chainToken', stepId: 's1', captureName: 'token' }],
    })) as Record<string, unknown>;

    const workflow = result.workflow as { uid: string; published: boolean; stepCount: number };
    expect(workflow.uid).toBeTruthy();
    expect(workflow.published).toBe(false);
    expect(workflow.stepCount).toBe(1);
    expect(result.liveVariables).toEqual([{ name: 'chainToken', reference: '{{live.chainToken}}' }]);

    const list = (await call('workflows_list', {})) as { workflows: Array<Record<string, unknown>> };
    expect(list.workflows).toHaveLength(1);
    expect(list.workflows[0].liveVariables).toEqual(['chainToken']);
  });

  it('rejects a workflow referencing a missing request', async () => {
    await expect(
      call('workflows_save', {
        workflow: { name: 'Broken', steps: [{ id: 's1', requestUid: 'ghost123', captures: [] }] },
      }),
    ).rejects.toThrow(McpToolInputError);
  });

  it('rejects an expose that references an undeclared capture', async () => {
    const requestUid = await saveRequest({ name: 'Src', url: `http://127.0.0.1:${port}/echo` });
    await expect(
      call('workflows_save', {
        workflow: { name: 'Chain', steps: [{ id: 's1', requestUid, captures: [] }] },
        exposes: [{ name: 'x', stepId: 's1', captureName: 'nope' }],
      }),
    ).rejects.toThrow(/unknown capture/);
  });

  it('rejects a live variable name that is already taken', async () => {
    await saveWorkflow();
    const requestUid = await saveRequest({ name: 'Src2', url: `http://127.0.0.1:${port}/echo` });
    await expect(
      call('workflows_save', {
        workflow: {
          name: 'Chain 2',
          steps: [{ id: 's1', requestUid, captures: [{ name: 'token', extractor: { kind: 'whole-body' } }] }],
        },
        exposes: [{ name: 'apiToken', stepId: 's1', captureName: 'token' }],
      }),
    ).rejects.toThrow(/already taken/);
  });

  it('patches scalar fields by uid and keeps a published workflow published', async () => {
    const { workflowUid } = await saveWorkflow();

    const result = (await call('workflows_save', {
      uid: workflowUid,
      workflow: { name: 'Renamed chain', refresh: { kind: 'interval', seconds: 60 } },
    })) as { workflow: Record<string, unknown> };

    expect(result.workflow.uid).toBe(workflowUid);
    expect(result.workflow.name).toBe('Renamed chain');
    expect(result.workflow.published).toBe(true);
    expect(result.workflow.refresh).toEqual({ kind: 'interval', seconds: 60 });

    const list = (await call('workflows_list', {})) as { workflows: Array<Record<string, unknown>> };
    expect(list.workflows[0].name).toBe('Renamed chain');
  });

  it('applies a step patch that keeps bound captures intact', async () => {
    const { workflowUid } = await saveWorkflow();
    const otherRequestUid = await saveRequest({ name: 'Other source', url: `http://127.0.0.1:${port}/echo` });

    const result = (await call('workflows_save', {
      uid: workflowUid,
      workflow: {
        steps: [
          {
            id: 's1',
            requestUid: otherRequestUid,
            captures: [{ name: 'token', extractor: { kind: 'whole-body' } }],
          },
        ],
      },
    })) as { workflow: Record<string, unknown> };

    expect(result.workflow.stepCount).toBe(1);
  });

  it('rejects a patch that would orphan a bound live variable', async () => {
    const { workflowUid } = await saveWorkflow();
    const requestUid = await saveRequest({ name: 'Src3', url: `http://127.0.0.1:${port}/echo` });

    await expect(
      call('workflows_save', {
        uid: workflowUid,
        workflow: { steps: [{ id: 's1', requestUid, captures: [] }] },
      }),
    ).rejects.toThrow(/\{\{live\.apiToken\}\}.*Open Headers/);
  });

  it('mints new draft live variables from exposes on update', async () => {
    const { workflowUid } = await saveWorkflow();

    const result = (await call('workflows_save', {
      uid: workflowUid,
      workflow: {},
      exposes: [{ name: 'apiTokenCopy', stepId: 's1', captureName: 'token' }],
    })) as Record<string, unknown>;

    expect(result.liveVariables).toEqual([{ name: 'apiTokenCopy', reference: '{{live.apiTokenCopy}}' }]);
    const list = (await call('workflows_list', {})) as { workflows: Array<Record<string, unknown>> };
    expect(list.workflows[0].liveVariables).toEqual(expect.arrayContaining(['apiToken', 'apiTokenCopy']));
  });

  it('errors on an unknown workflow uid', async () => {
    await expect(call('workflows_save', { uid: 'ghost', workflow: { name: 'X' } })).rejects.toThrow(
      /see workflows_list/,
    );
  });
});

// ── workflows_history ────────────────────────────────────────────────

describe('workflows_history', () => {
  it('reports capture names and failure context, never captured values', async () => {
    const { workflowUid } = await saveWorkflow();
    await call('workflows_run', { uid: workflowUid });
    await recordRefreshError(
      {
        workflowUid,
        environmentId: 'env-x',
        message: 'upstream 503',
        failedStepId: 's1',
        extractorOk: true,
      },
      wsId,
    );

    const result = (await call('workflows_history', { uid: workflowUid })) as {
      runs: Array<Record<string, unknown>>;
    };

    expect(result.runs).toHaveLength(2);
    const success = result.runs.find((run) => run.environmentId === null);
    expect(success?.captureNames).toEqual({ s1: ['token'] });
    expect(success?.extractedAt).toBe(1_111);
    expect(JSON.stringify(result.runs)).not.toContain('tok-123');

    const failure = result.runs.find((run) => run.environmentId === 'env-x');
    expect(failure?.lastErrorMessage).toBe('upstream 503');
    expect(failure?.lastErrorStepId).toBe('s1');
    expect(failure?.consecutiveFailures).toBe(1);
  });

  it('returns every workflow when no uid is given', async () => {
    const { workflowUid } = await saveWorkflow();
    await call('workflows_run', { uid: workflowUid });
    const result = (await call('workflows_history', {})) as { runs: unknown[] };
    expect(result.runs).toHaveLength(1);
  });
});
