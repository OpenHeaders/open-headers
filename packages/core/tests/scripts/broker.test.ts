/**
 * Script broker — lifecycle, transport timeout, host-API tiering and
 * the session pin over a fake {@link SandboxTransport}. The hosts'
 * transports are exercised by their own suites; these tests pin the
 * broker contract every host shares: no-op source skips the spawn, idle
 * close after the last in-flight run, an open session holds the
 * runtime until `endSession`, transport faults fold into failed results
 * (never throws), and chain-context executions get the read-only
 * `oh.*` tier.
 */

import { setHostLogger } from '@openheaders/core/logger';
import type {
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  SessionHookInput,
} from '@openheaders/core/scripts';
import { createScriptBroker, type SandboxTransport, type ScriptBroker } from '@openheaders/core/scripts/broker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

setHostLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

const snapshot = {
  method: 'GET' as const,
  url: 'https://api.openheaders.io/x',
  headers: [],
  params: [],
  body: { type: 'none' as const },
};

/** A session hook's input — the broker forwards it verbatim. */
const INBOUND: SessionHookInput = {
  kind: 'ws-on-message',
  message: { direction: 'down', text: 'hi', dataBase64: 'aGk=', binary: false, index: 0 },
};

function okResult(executionId: string): ScriptExecutionResult {
  return { executionId, succeeded: true, assertions: [], consoleLog: [], durationMs: 1 };
}

interface RigOptions {
  /** The fake sandbox replies with a success result per execute. */
  autoRespond?: boolean;
  /** Before replying, the fake sandbox issues this `oh.*` host request. */
  hostRequestOp?: ScriptHostRequest['op'];
}

function makeRig(options: RigOptions = {}) {
  let upListener: ((message: unknown) => void) | null = null;
  const posted: Array<{ type: string; request?: unknown; response?: unknown }> = [];
  const transport = {
    ensureReady: vi.fn(async () => {}),
    post: vi.fn((message: unknown) => {
      const msg = message as { type: string; request?: ScriptExecutionRequest };
      posted.push(msg as never);
      if (msg.type !== 'script.execute' || !msg.request || options.autoRespond === false) return;
      const executionId = msg.request.executionId;
      queueMicrotask(() => {
        if (options.hostRequestOp) {
          const base = { executionId, rpcId: `${executionId}:1` };
          const op = options.hostRequestOp;
          const request: ScriptHostRequest =
            op === 'variables.set'
              ? { ...base, op, name: 'n', value: 'v' }
              : op === 'variables.get'
                ? { ...base, op, name: 'n' }
                : op === 'vault.get'
                  ? { ...base, op, ref: 'r' }
                  : { ...base, op: 'sendRequest', request: snapshot };
          upListener?.({ type: 'script.host-request', request });
        }
        queueMicrotask(() => upListener?.({ type: 'script.result', result: okResult(executionId) }));
      });
    }),
    close: vi.fn(),
  };
  const handleHostRequest = vi.fn(async (request: ScriptHostRequest) => ({
    executionId: request.executionId,
    rpcId: request.rpcId,
    ok: true as const,
    value: 'host-value',
  }));
  const broker: ScriptBroker = createScriptBroker({
    createTransport: (onUp) => {
      upListener = onUp;
      return transport as unknown as SandboxTransport;
    },
    handleHostRequest,
    listScriptPackages: () => [{ name: 'util', source: 'module.exports = {};' }],
  });
  return {
    broker,
    transport,
    handleHostRequest,
    /** Answer one execute by hand — for rigs built with `autoRespond: false`. */
    respond: (executionId: string) => upListener?.({ type: 'script.result', result: okResult(executionId) }),
    executes: () => posted.filter((m) => m.type === 'script.execute').map((m) => m.request as ScriptExecutionRequest),
    hostResponses: () =>
      posted
        .filter((m) => m.type === 'script.host-response')
        .map((m) => m.response as { ok: boolean; error?: string; value?: unknown }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runScript — lifecycle', () => {
  it('empty source is a no-op success that never touches the transport', async () => {
    const rig = makeRig();
    const result = await rig.broker.runScript({ kind: 'pre-request', source: '   ', request: snapshot });
    expect(result.succeeded).toBe(true);
    expect(rig.transport.ensureReady).not.toHaveBeenCalled();
    expect(rig.transport.post).not.toHaveBeenCalled();
  });

  it('spawns, executes, and carries the workspace packages on the request', async () => {
    const rig = makeRig();
    const result = await rig.broker.runScript({
      kind: 'pre-request',
      source: 'oh.setHeader("X","1");',
      request: snapshot,
    });
    expect(result.succeeded).toBe(true);
    expect(rig.transport.ensureReady).toHaveBeenCalledTimes(1);
    const requests = rig.executes();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.packages).toEqual([{ name: 'util', source: 'module.exports = {};' }]);
    expect(requests[0]?.kind).toBe('pre-request');
  });

  it('closes the sandbox on the idle timer after the last run settles', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot });
    expect(rig.transport.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(rig.transport.close).toHaveBeenCalledWith('idle');
  });

  it('a new run cancels the pending idle close', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot });
    vi.advanceTimersByTime(20_000);
    await rig.broker.runScript({ kind: 'pre-request', source: 'y;', request: snapshot });
    vi.advanceTimersByTime(20_000);
    expect(rig.transport.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(rig.transport.close).toHaveBeenCalledWith('idle');
  });

  it('folds a transport execute timeout into a failed result instead of throwing', async () => {
    const rig = makeRig({ autoRespond: false });
    const pending = rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot });
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect(result.succeeded).toBe(false);
    expect(result.error?.name).toBe('SandboxTransportError');
    expect(result.error?.message).toMatch(/timed out/);
  });

  it('dispose closes the transport for shutdown', () => {
    const rig = makeRig();
    rig.broker.dispose();
    expect(rig.transport.close).toHaveBeenCalledWith('shutdown');
  });
});

describe('runScript — sessions', () => {
  it('carries the session id on the execute request', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'ws-on-message', source: 'x;', sessionId: 'send-1', hook: INBOUND });
    expect(rig.executes()[0]).toMatchObject({ sessionId: 'send-1', hook: INBOUND });
    rig.broker.endSession('send-1');
  });

  it('an open session holds the runtime past the idle window', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'ws-on-message', source: 'x;', sessionId: 'send-1', hook: INBOUND });
    vi.advanceTimersByTime(120_000);
    expect(rig.transport.close).not.toHaveBeenCalled();
  });

  it('endSession posts the session end and arms the idle close', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'ws-on-message', source: 'x;', sessionId: 'send-1', hook: INBOUND });
    rig.broker.endSession('send-1');
    expect(rig.transport.post).toHaveBeenCalledWith({ type: 'script.session-end', sessionId: 'send-1' });
    expect(rig.transport.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(rig.transport.close).toHaveBeenCalledWith('idle');
  });

  it('a run in flight keeps the runtime open after endSession', async () => {
    const rig = makeRig({ autoRespond: false });
    const pending = rig.broker.runScript({ kind: 'ws-on-message', source: 'x;', sessionId: 'send-1', hook: INBOUND });
    await vi.advanceTimersByTimeAsync(0);
    rig.broker.endSession('send-1');
    vi.advanceTimersByTime(30_000);
    expect(rig.transport.close).not.toHaveBeenCalled();
    const executionId = rig.executes()[0]?.executionId;
    if (executionId === undefined) throw new Error('execute never posted');
    rig.respond(executionId);
    await pending;
    vi.advanceTimersByTime(30_000);
    expect(rig.transport.close).toHaveBeenCalledWith('idle');
  });

  it('endSession for a session that never ran a hook posts nothing', () => {
    const rig = makeRig();
    rig.broker.endSession('never-ran');
    expect(rig.transport.post).not.toHaveBeenCalled();
    expect(rig.transport.close).not.toHaveBeenCalled();
  });
});

describe('host-request tiering', () => {
  async function run(rig: ReturnType<typeof makeRig>, hostContext: 'interactive' | 'chain'): Promise<void> {
    await rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot, hostContext });
    // Drain the microtask that posts the host response down.
    await vi.advanceTimersByTimeAsync(0);
  }

  it('interactive executions get the full oh.* surface', async () => {
    const rig = makeRig({ hostRequestOp: 'variables.set' });
    await run(rig, 'interactive');
    expect(rig.handleHostRequest).toHaveBeenCalledWith(expect.objectContaining({ op: 'variables.set' }));
    expect(rig.hostResponses()[0]?.ok).toBe(true);
  });

  it('chain executions get oh.variables.set rejected without reaching the handler', async () => {
    const rig = makeRig({ hostRequestOp: 'variables.set' });
    await run(rig, 'chain');
    expect(rig.handleHostRequest).not.toHaveBeenCalled();
    const reply = rig.hostResponses()[0];
    expect(reply?.ok).toBe(false);
    expect(reply?.error).toMatch(/read-only/);
  });

  it('chain executions get oh.sendRequest rejected without reaching the handler', async () => {
    const rig = makeRig({ hostRequestOp: 'sendRequest' });
    await run(rig, 'chain');
    expect(rig.handleHostRequest).not.toHaveBeenCalled();
    expect(rig.hostResponses()[0]?.ok).toBe(false);
  });

  it('chain executions keep the read tier — oh.variables.get passes through', async () => {
    const rig = makeRig({ hostRequestOp: 'variables.get' });
    await run(rig, 'chain');
    expect(rig.handleHostRequest).toHaveBeenCalledWith(expect.objectContaining({ op: 'variables.get' }));
    expect(rig.hostResponses()[0]?.ok).toBe(true);
  });

  it('a handler throw folds into an error reply', async () => {
    const rig = makeRig({ hostRequestOp: 'vault.get' });
    rig.handleHostRequest.mockRejectedValue(new Error('store not hydrated'));
    await run(rig, 'interactive');
    const reply = rig.hostResponses()[0];
    expect(reply?.ok).toBe(false);
    expect(reply?.error).toBe('store not hydrated');
  });
});
