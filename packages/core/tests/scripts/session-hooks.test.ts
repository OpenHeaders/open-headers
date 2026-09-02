/**
 * Runner core — the WebSocket hook families' `oh` surface: Before
 * connect's dial view and mutators fold into ONE connect mutation (the
 * HTTP mutation's law — a reverted edit reports none), Before send
 * rewrites or drops, On message replies through the `session.send`
 * host op, After close reads the end record; `oh.session` is shared
 * across the families of one session, and package bodies see the
 * hook's own surface.
 */

import type {
  ScriptExecutionRequest,
  ScriptHostRequest,
  ScriptHostResponse,
  SessionHookInput,
  WsConnectSnapshot,
} from '@openheaders/core/scripts';
import { endScriptSession, executeScript } from '@openheaders/core/scripts/runner';
import { describe, expect, it } from 'vitest';

const CONNECT: WsConnectSnapshot = {
  url: 'wss://events.openheaders.io/live?tenant=acme',
  headers: [{ key: 'X-Client', value: 'oh' }],
  params: [{ key: 'tenant', value: 'acme' }],
  subprotocols: ['chat.v1'],
  attempt: 0,
};

const OUTBOUND: SessionHookInput = {
  kind: 'ws-before-send',
  message: { direction: 'up', text: '{"op":"ping"}', binary: false, index: 3 },
};

const INBOUND: SessionHookInput = {
  kind: 'ws-on-message',
  message: { direction: 'down', text: 'ping', dataBase64: 'cGluZw==', binary: false, index: 4 },
};

const CLOSE: SessionHookInput = {
  kind: 'ws-after-close',
  close: {
    code: 1000,
    reason: 'done',
    wasClean: true,
    stopped: false,
    messages: 5,
    droppedMessages: 0,
    durationMs: 42,
  },
};

let executions = 0;

async function runHook(
  source: string,
  hook: SessionHookInput,
  options: {
    sessionId?: string;
    packages?: Array<{ name: string; source: string }>;
    hostRequests?: ScriptHostRequest[];
  } = {},
) {
  executions += 1;
  const req: ScriptExecutionRequest = {
    executionId: `exec-${executions}`,
    kind: hook.kind,
    source,
    sessionId: options.sessionId ?? `session-${executions}`,
    hook,
    ...(options.packages !== undefined ? { packages: options.packages } : {}),
  };
  const result = await executeScript(req, {
    sendHostRequest: async (request: ScriptHostRequest): Promise<ScriptHostResponse> => {
      options.hostRequests?.push(request);
      return {
        executionId: request.executionId,
        rpcId: request.rpcId,
        ok: true,
        value: request.op === 'session.send' ? { success: true } : null,
      };
    },
  });
  if (options.sessionId === undefined) endScriptSession(req.sessionId);
  return result;
}

const logged = (result: Awaited<ReturnType<typeof runHook>>): string[] =>
  result.consoleLog.map((e) => e.args.join(' '));

describe('ws-before-connect', () => {
  it('exposes the dial view and folds the mutators into one connect mutation', async () => {
    const result = await runHook(
      `console.log(oh.connect.url, oh.connect.attempt, oh.connect.subprotocols.join(','));
       oh.setQueryParam('token', 't1');
       oh.setHeader('x-client', 'scripted');
       oh.setSubprotocols(['chat.v2']);
       console.log(oh.connect.headers.map((h) => h.key + '=' + h.value).join(';'));`,
      { kind: 'ws-before-connect', connect: CONNECT },
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['wss://events.openheaders.io/live?tenant=acme 0 chat.v1', 'x-client=scripted']);
    expect(result.sessionMutation).toEqual({
      kind: 'ws-connect',
      url: undefined,
      headers: [{ key: 'x-client', value: 'scripted' }],
      params: [
        { key: 'tenant', value: 'acme' },
        { key: 'token', value: 't1' },
      ],
      subprotocols: ['chat.v2'],
    });
    expect(result.mutation).toBeUndefined();
  });

  it('a reverted edit reports no mutation', async () => {
    const result = await runHook(
      `oh.setHeader('X-Extra', '1'); oh.removeHeader('x-extra'); oh.setUrl(oh.connect.url);`,
      { kind: 'ws-before-connect', connect: CONNECT },
    );
    expect(result.succeeded).toBe(true);
    expect(result.sessionMutation).toBeUndefined();
  });

  it('has no HTTP surface — oh.request is undefined, oh.setBody is not a function', async () => {
    const result = await runHook(`console.log(typeof oh.request, typeof oh.setBody, typeof oh.setUrl);`, {
      kind: 'ws-before-connect',
      connect: CONNECT,
    });
    expect(logged(result)).toEqual(['undefined undefined function']);
  });
});

describe('ws-before-send', () => {
  it('rewrites the outgoing text and the event name', async () => {
    const result = await runHook(
      `const payload = JSON.parse(oh.message.text); payload.ts = 1; oh.setMessage(JSON.stringify(payload)); oh.setEvent('ping:v2');
       console.log(oh.message.text, oh.message.eventName, oh.message.index);`,
      OUTBOUND,
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['{"op":"ping","ts":1} ping:v2 3']);
    expect(result.sessionMutation).toEqual({ kind: 'ws-send', text: '{"op":"ping","ts":1}', eventName: 'ping:v2' });
  });

  it('drop is a mutation of its own — a message set back to itself still drops', async () => {
    const result = await runHook(
      `oh.setMessage('x'); oh.setMessage(oh.message.text === 'x' ? '{"op":"ping"}' : 'y'); oh.drop();`,
      OUTBOUND,
    );
    expect(result.succeeded).toBe(true);
    expect(result.sessionMutation).toEqual({ kind: 'ws-send', text: undefined, eventName: undefined, drop: true });
  });

  it('an untouched message reports no mutation', async () => {
    const result = await runHook(`console.log(oh.message.direction);`, OUTBOUND);
    expect(result.sessionMutation).toBeUndefined();
  });
});

describe('ws-on-message', () => {
  it('replies through the session.send host op — text, binary and a Socket.IO event', async () => {
    const hostRequests: ScriptHostRequest[] = [];
    const result = await runHook(
      `await oh.send('pong'); await oh.sendBinary('AQID'); await oh.emit('ack', [{ index: oh.message.index }], { expectAck: true });`,
      INBOUND,
      { sessionId: 'session-reply', hostRequests },
    );
    endScriptSession('session-reply');
    expect(result.succeeded).toBe(true);
    expect(
      hostRequests.map((r) => (r.op === 'session.send' ? [r.sessionId, r.messageText, r.socketio, r.binary] : r.op)),
    ).toEqual([
      ['session-reply', 'pong', undefined, undefined],
      ['session-reply', 'AQID', undefined, { encoding: 'base64' }],
      ['session-reply', '[{"index":4}]', { eventName: 'ack', expectAck: true }, undefined],
    ]);
  });

  it('a refused send throws into the script with the rider reason', async () => {
    executions += 1;
    const result = await executeScript(
      {
        executionId: `exec-${executions}`,
        kind: 'ws-on-message',
        source: `try { await oh.send('x'); } catch (err) { console.log(err.message); }`,
        sessionId: 'session-refused',
        hook: INBOUND,
      },
      {
        sendHostRequest: async (request) => ({
          executionId: request.executionId,
          rpcId: request.rpcId,
          ok: true,
          value: { success: false, error: 'The session is not open.' },
        }),
      },
    );
    endScriptSession('session-refused');
    expect(logged(result)).toEqual(['oh.send failed: The session is not open.']);
  });

  it('registers assertions against the frame', async () => {
    const result = await runHook(
      `await oh.test('is ping', () => oh.expect(oh.message.text).toBe('ping'));
       await oh.test('is binary', () => oh.expect(oh.message.binary).toBeTruthy());`,
      INBOUND,
    );
    expect(result.assertions.map((a) => [a.name, a.passed])).toEqual([
      ['is ping', true],
      ['is binary', false],
    ]);
  });
});

describe('ws-after-close', () => {
  it('reads the end record and asserts on it', async () => {
    const result = await runHook(
      `console.log(oh.close.code, oh.close.reason, oh.close.messages, oh.close.stopped);
       await oh.test('clean', () => oh.expect(oh.close.code).toBe(1000));`,
      CLOSE,
    );
    expect(logged(result)).toEqual(['1000 done 5 false']);
    expect(result.assertions).toEqual([{ name: 'clean', passed: true, durationMs: expect.any(Number) }]);
  });
});

describe('the session across families', () => {
  it('shares oh.session from Before connect to On message to After close', async () => {
    await runHook(`oh.session.nonce = 'n1';`, { kind: 'ws-before-connect', connect: CONNECT }, { sessionId: 's-x' });
    await runHook(`oh.session.count = (oh.session.count ?? 0) + 1;`, INBOUND, { sessionId: 's-x' });
    const result = await runHook(`console.log(oh.session.nonce, oh.session.count);`, CLOSE, { sessionId: 's-x' });
    endScriptSession('s-x');
    expect(logged(result)).toEqual(['n1 1']);
  });

  it('a package body sees the hook surface and the session', async () => {
    const result = await runHook(
      `const util = oh.require('util'); console.log(util.where());`,
      { kind: 'ws-before-connect', connect: CONNECT },
      {
        packages: [
          { name: 'util', source: `module.exports = { where: () => oh.connect.url + ' ' + typeof oh.session };` },
        ],
      },
    );
    expect(logged(result)).toEqual(['wss://events.openheaders.io/live?tenant=acme object']);
  });
});
