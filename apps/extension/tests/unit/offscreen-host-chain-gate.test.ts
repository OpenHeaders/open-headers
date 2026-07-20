/**
 * Chain-context host-RPC gate — a script running for a workflow step
 * (`hostContext: 'chain'`) gets a READ-ONLY `oh.*` surface: the host
 * refuses `sendRequest` + `variables.set` while that execution is in
 * flight, and the gate is scoped to the execution id (interactive runs
 * are untouched; the id is unregistered after the run settles).
 */

import type { ScriptExecutionResult, ScriptHostRequest, ScriptHostResponse } from '@openheaders/core/scripts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getEnvironments: () => [],
  getVault: () => ({ schemaVersion: 5, secrets: [] }),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: async () => null,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestCollections: () => [],
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: () => [],
}));
vi.mock('@openheaders/oracle/sync/service', () => ({
  getActiveCacheForRegistration: () => null,
  getOracleForCurrentWorkspace: () => null,
  nextSwMutatorContext: () => null,
}));
vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

import { handleScriptHostRequest, runScript } from '@/background/modules/offscreen-host';

/** Replies collected by the fake sandbox while its script is running. */
let midRunReplies: ScriptHostResponse[];

/** Execution id the last script.execute ran under. */
let lastExecutionId: string;

/** Host ops the fake sandbox fires mid-run, echoing the execution id. */
let midRunOps: Array<ScriptHostRequest['op']>;

function hostRequest(executionId: string, op: ScriptHostRequest['op']): ScriptHostRequest {
  switch (op) {
    case 'sendRequest':
      return {
        executionId,
        rpcId: 'rpc-1',
        op,
        request: {
          method: 'GET',
          url: 'https://api.openheaders.io/x',
          headers: [],
          params: [],
          body: { type: 'none' },
        },
      };
    case 'variables.set':
      return { executionId, rpcId: 'rpc-2', op, name: 'X', value: '1' };
    case 'variables.get':
      return { executionId, rpcId: 'rpc-3', op, name: 'X' };
    case 'vault.get':
      return { executionId, rpcId: 'rpc-4', op, ref: 'X' };
  }
}

beforeEach(() => {
  midRunReplies = [];
  midRunOps = [];
  vi.stubGlobal('chrome', {
    offscreen: {
      createDocument: vi.fn(async () => {}),
      closeDocument: vi.fn(async () => {}),
      hasDocument: vi.fn(async () => true),
    },
    runtime: {
      // Fake sandbox: on script.execute, fire the configured host RPCs
      // with the request's own execution id (exactly what the real
      // sandbox does mid-script), then reply with a success result.
      sendMessage: vi.fn(async (msg: { type: string; request: { executionId: string } }) => {
        if (msg.type !== 'script.execute') throw new Error(`unexpected message ${msg.type}`);
        lastExecutionId = msg.request.executionId;
        for (const op of midRunOps) {
          midRunReplies.push(await handleScriptHostRequest(hostRequest(msg.request.executionId, op)));
        }
        const result: ScriptExecutionResult = {
          executionId: msg.request.executionId,
          succeeded: true,
          assertions: [],
          consoleLog: [],
          durationMs: 1,
        };
        return result;
      }),
    },
  });
});

const scriptInput = {
  kind: 'pre-request' as const,
  source: 'oh.sendRequest(...)',
  request: {
    method: 'GET' as const,
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    body: { type: 'none' as const },
  },
};

describe('chain-context host-RPC gate', () => {
  it('refuses sendRequest + variables.set for a chain execution', async () => {
    midRunOps = ['sendRequest', 'variables.set'];
    await runScript({ ...scriptInput, hostContext: 'chain' });
    expect(midRunReplies).toHaveLength(2);
    for (const reply of midRunReplies) {
      expect(reply.ok).toBe(false);
      if (!reply.ok) expect(reply.error).toMatch(/not available in workflow runs/);
    }
  });

  it('still serves read ops (variables.get / vault.get) to a chain execution', async () => {
    midRunOps = ['variables.get', 'vault.get'];
    await runScript({ ...scriptInput, hostContext: 'chain' });
    expect(midRunReplies).toHaveLength(2);
    // Unknown names resolve to null — the point is the gate lets the
    // read op through to the resolver instead of refusing it.
    for (const reply of midRunReplies) {
      expect(reply.ok).toBe(true);
      if (reply.ok) expect(reply.value).toBeNull();
    }
  });

  it('does not gate interactive executions', async () => {
    midRunOps = ['sendRequest'];
    await runScript(scriptInput);
    expect(midRunReplies).toHaveLength(1);
    const reply = midRunReplies[0];
    expect(reply.ok).toBe(false);
    // The interactive path fails differently here (no executor wired in
    // this harness) — asserting the message proves the chain gate did
    // NOT fire for an interactive run.
    if (!reply.ok) expect(reply.error).toMatch(/request executor not wired/);
  });

  it('unregisters the execution id after the chain run settles', async () => {
    midRunOps = [];
    await runScript({ ...scriptInput, hostContext: 'chain' });
    // The SAME id that was gated mid-run is no longer gated post-run —
    // the refusal message gives way to the ungated failure mode.
    const reply = await handleScriptHostRequest(hostRequest(lastExecutionId, 'sendRequest'));
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.error).toMatch(/request executor not wired/);
  });
});
