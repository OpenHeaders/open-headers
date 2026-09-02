/**
 * WS executor — the script hooks on the real spine over a scripted
 * transport and a scripted session host: Before connect mutates the
 * dial (URL params, headers, subprotocols) before the credential mints
 * onto it and runs again on a reconnect attempt; Before send rewrites
 * the rider's text or drops it (the rider answers with the level's
 * name, nothing captured) while a script-origin send never re-enters;
 * On message runs after the capture off the same frame and `oh.send`
 * rides the captured send path; After close runs once at settle, the
 * marks ride the lifecycle with their indexes and the live feed, the
 * snapshot carries the record, and the session's runtime context is
 * released. A host with no script capability, or a request whose
 * chain is empty, leaves the session scriptless.
 */

import type { WsStreamEventWire } from '@openheaders/core/bridge';
import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import type { ExecutedWsScriptMark, WebSocketRequest } from '@openheaders/core/types';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { closeActiveWsSession, sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-scr-1',
    path: 'requests/suite-col1/probe-scripts',
    name: 'Probe Scripts',
    flavor: 'raw',
    url: 'wss://events.openheaders.io/live?tenant=acme',
    subprotocols: ['chat.v1'],
    headers: [{ uid: 'h1', key: 'X-Client', value: 'oh', enabled: true }],
    params: [],
    message: '',
    ...overrides,
  };
}

const ok = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
  executionId: 'e',
  succeeded: true,
  assertions: [],
  consoleLog: [],
  durationMs: 1,
  ...over,
});

const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');
const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Multi-dial scripted transport with a recording writer per dial. */
function rig() {
  const dials: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks; sent: string[]; ended: boolean }> =
    [];
  const transport: WsTransport = {
    connect(request, callbacks, signal) {
      const dial = { request, callbacks, sent: [] as string[], ended: false };
      dials.push(dial);
      const finish = (): void => {
        if (dial.ended) return;
        dial.ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        send: (text) => dial.sent.push(text),
        close: (code, reason) => {
          if (dial.ended) return;
          dial.ended = true;
          callbacks.onClose({ code, reason, wasClean: true });
          queueMicrotask(() => callbacks.onEnd());
        },
      };
    },
  };
  const at = (n: number) => {
    const dial = dials[n];
    if (dial === undefined) throw new Error(`dial ${n} never happened`);
    return dial;
  };
  return {
    transport,
    dials: () => dials.length,
    request: (n: number) => at(n).request,
    sent: (n: number) => at(n).sent,
    open: (n: number) => at(n).callbacks.onOpen('chat.v1', ''),
    inbound: (n: number, text: string) =>
      at(n).callbacks.onMessage({ data: new TextEncoder().encode(text), binary: false }),
    sever: (n: number) => {
      const dial = at(n);
      dial.ended = true;
      dial.callbacks.onClose({ code: 1006, reason: '', wasClean: false });
      queueMicrotask(() => dial.callbacks.onEnd());
    },
    closeClean: (n: number) => {
      const dial = at(n);
      dial.ended = true;
      dial.callbacks.onClose({ code: 1000, reason: 'bye', wasClean: true });
      queueMicrotask(() => dial.callbacks.onEnd());
    },
  };
}

/** A session host answering per SOURCE, recording every call. */
function scriptedHost(
  answers: Record<string, (input: SessionScriptInput) => ScriptExecutionResult | Promise<ScriptExecutionResult>>,
) {
  const ran: SessionScriptInput[] = [];
  const ended: string[] = [];
  const host: SessionScriptHost = {
    mode: 'safe',
    run: async (input) => {
      ran.push(input);
      return answers[input.source]?.(input) ?? ok();
    },
    endSession: (id) => {
      ended.push(id);
    },
  };
  return { host, ran, ended };
}

const marksOf = (lifecycle: readonly { kind: string }[] | undefined): ExecutedWsScriptMark[] =>
  (lifecycle ?? []).filter((item): item is ExecutedWsScriptMark & { atIndex: number } => item.kind === 'script');

describe('executeWsSession — Before connect', () => {
  it('mutates the dial before the transport sees it and re-runs on the reconnect attempt', async () => {
    const t = rig();
    const host = scriptedHost({
      'connect();': (input) =>
        ok({
          sessionMutation: {
            kind: 'ws-connect',
            params: [
              { key: 'token', value: `t${input.hook.kind === 'ws-before-connect' ? input.hook.connect.attempt : 0}` },
            ],
            headers: [{ key: 'X-Client', value: 'scripted' }],
            subprotocols: ['chat.v2'],
          },
        }),
    });
    const events: WsStreamEventWire[] = [];
    const settled = executeWsSession(
      makeWsRequest({
        scripts: { 'ws-before-connect': 'connect();' },
        autoReconnect: true,
        reconnectBackoff: false,
        reconnectPeriodMs: 1,
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: t.transport,
        sendId: 'send-scr-1',
        resolution: (template) => template,
        scriptChain: [],
        scriptHost: host.host,
        emitStreamEvent: (event) => events.push(event),
        reconnectJitter: () => 0,
      },
    );
    await settleTick();
    expect(t.request(0).url).toBe('wss://events.openheaders.io/live?token=t0');
    expect(t.request(0).headers).toEqual([{ key: 'X-Client', value: 'scripted' }]);
    expect(t.request(0).subprotocols).toEqual(['chat.v2']);
    t.open(0);
    t.sever(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(t.dials()).toBe(2);
    expect(t.request(1).url).toBe('wss://events.openheaders.io/live?token=t1');
    t.open(1);
    // A Disconnect ends it — under auto-reconnect a server close would
    // only redial.
    expect(closeActiveWsSession('send-scr-1')).toBe(true);
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.requestHeaders).toEqual([
      { key: 'X-Client', value: 'scripted' },
      { key: 'Sec-WebSocket-Protocol', value: 'chat.v2' },
    ]);
    expect(snapshot.scripts).toMatchObject({ mode: 'safe', beforeConnect: { succeeded: true, dials: 2 } });
    const marks = marksOf(snapshot.lifecycle);
    expect(marks.map((m) => [m.hook, m.attempt])).toEqual([
      ['ws-before-connect', 0],
      ['ws-before-connect', 1],
    ]);
    // The marks rode the live feed as lifecycle frames.
    expect(events.filter((e) => e.kind === 'lifecycle' && e.item.kind === 'script')).toHaveLength(2);
    expect(host.ended).toEqual(['send-scr-1']);
  });

  it('a Before connect failure is recorded and the dial proceeds unmutated', async () => {
    const t = rig();
    const host = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
    });
    const settled = executeWsSession(makeWsRequest({ scripts: { 'ws-before-connect': 'boom();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-scr-2',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    expect(t.request(0).url).toBe('wss://events.openheaders.io/live?tenant=acme');
    t.open(0);
    t.closeClean(0);
    const snapshot = await settled;
    expect(snapshot.scripts?.beforeConnect).toMatchObject({ succeeded: false, error: { message: 'boom' } });
    expect(marksOf(snapshot.lifecycle)[0]).toMatchObject({ hook: 'ws-before-connect', succeeded: false });
  });

  it('a pre-open failure still carries the Before connect record', async () => {
    const t = rig();
    const host = scriptedHost({});
    const settled = executeWsSession(makeWsRequest({ scripts: { 'ws-before-connect': 'x();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-scr-3',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    t.request(0);
    t.sever(0);
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('failed');
    expect(snapshot.scripts?.beforeConnect?.dials).toBe(1);
    expect(marksOf(snapshot.lifecycle)).toHaveLength(1);
    expect(snapshot.scripts?.afterClose).toBeUndefined();
    expect(host.ended).toEqual(['send-scr-3']);
  });
});

describe('executeWsSession — Before send and On message', () => {
  it('rewrites the rider send, drops another, and never re-enters for a script send', async () => {
    const t = rig();
    const host = scriptedHost({
      'send();': (input) => {
        const text = input.hook.kind === 'ws-before-send' ? input.hook.message.text : '';
        if (text === 'secret') return ok({ sessionMutation: { kind: 'ws-send', drop: true } });
        return ok({ sessionMutation: { kind: 'ws-send', text: `${text}!` } });
      },
      'message();': async (input) => {
        if (input.hook.kind === 'ws-on-message' && input.hook.message.text === 'ping') {
          // The reply rides the script-origin path — no Before send.
          await sendActiveWsSessionMessage('send-scr-4', 'pong', undefined, undefined, 'script');
        }
        return ok({ consoleLog: [{ level: 'log', args: ['seen'], timeMs: 0 }] });
      },
    });
    const settled = executeWsSession(
      makeWsRequest({ scripts: { 'ws-before-send': 'send();', 'ws-on-message': 'message();' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: t.transport,
        sendId: 'send-scr-4',
        resolution: (template) => template,
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    await settleTick();
    t.open(0);
    expect(await sendActiveWsSessionMessage('send-scr-4', 'hello')).toEqual({ success: true });
    expect(await sendActiveWsSessionMessage('send-scr-4', 'secret')).toEqual({
      success: false,
      error: 'Dropped by the Before send script at Request.',
    });
    expect(t.sent(0)).toEqual(['hello!']);
    t.inbound(0, 'ping');
    await settleTick();
    expect(t.sent(0)).toEqual(['hello!', 'pong']);
    // Before send ran for the two rider sends alone.
    expect(host.ran.filter((r) => r.kind === 'ws-before-send')).toHaveLength(2);
    t.closeClean(0);
    const snapshot = await settled;
    expect(snapshot.messages.map((m) => [m.direction, decode(m.dataBase64)])).toEqual([
      ['up', 'hello!'],
      ['down', 'ping'],
      ['up', 'pong'],
    ]);
    expect(snapshot.scripts?.beforeSend).toMatchObject({ runs: 2, dropped: 1 });
    expect(snapshot.scripts?.onMessage).toMatchObject({ runs: 1, failed: 0 });
    // A mark lands at the capture's index when its hook FINISHED: the
    // first Before send before its own frame (0), the drop after it
    // (1), On message after the reply it sent was captured (3).
    const marks = marksOf(snapshot.lifecycle);
    expect(marks.map((m) => [m.hook, m.atIndex, m.droppedBy ?? null])).toEqual([
      ['ws-before-send', 0, null],
      ['ws-before-send', 1, 'Request'],
      ['ws-on-message', 3, null],
    ]);
    expect(marks[2]?.consoleLog).toEqual([{ level: 'log', args: ['seen'], timeMs: 0 }]);
    // The On message hook saw the captured frame and its index.
    const seen = host.ran.find((r) => r.kind === 'ws-on-message');
    expect(seen?.hook.kind === 'ws-on-message' ? seen.hook.message : null).toEqual({
      direction: 'down',
      text: 'ping',
      dataBase64: Buffer.from('ping').toString('base64'),
      binary: false,
      index: 1,
    });
  });
});

describe('executeWsSession — After close and the chain', () => {
  it('runs After close once at settle with the end record, ancestors first', async () => {
    const t = rig();
    const host = scriptedHost({
      'col();': (input) => ok({ consoleLog: [{ level: 'log', args: [JSON.stringify(input.hook)], timeMs: 0 }] }),
      'req();': () => ok({ assertions: [{ name: 'clean', passed: true }] }),
    });
    const settled = executeWsSession(makeWsRequest({ scripts: { 'ws-after-close': 'req();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-scr-5',
      resolution: (template) => template,
      scriptChain: [
        {
          level: 'collection',
          label: "Collection 'Payments'",
          entity: { uid: 'col1', name: 'Payments', scripts: { 'ws-after-close': 'col();' } },
        },
      ],
      scriptHost: host.host,
    });
    await settleTick();
    t.open(0);
    t.inbound(0, 'one');
    t.closeClean(0);
    const snapshot = await settled;
    expect(host.ran.map((r) => r.source)).toEqual(['col();', 'req();']);
    const close = host.ran[0]?.hook;
    expect(close?.kind === 'ws-after-close' ? close.close : null).toMatchObject({
      code: 1000,
      reason: 'bye',
      wasClean: true,
      stopped: false,
      messages: 1,
      droppedMessages: 0,
    });
    expect(snapshot.scripts?.afterClose).toMatchObject({
      succeeded: true,
      assertions: [{ name: 'clean', passed: true }],
    });
    expect(snapshot.scripts?.afterClose?.chain.map((s) => [s.level, s.name])).toEqual([
      ['collection', 'Payments'],
      ['request', 'Probe Scripts'],
    ]);
    const marks = marksOf(snapshot.lifecycle);
    expect(marks.map((m) => m.hook)).toEqual(['ws-after-close']);
    expect(host.ended).toEqual(['send-scr-5']);
  });

  it('a scriptless request, or a host without scripts, records nothing', async () => {
    const t = rig();
    const host = scriptedHost({});
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-scr-6',
      resolution: (template) => template,
      scriptChain: [],
      scriptHost: host.host,
    });
    await settleTick();
    t.open(0);
    t.closeClean(0);
    const snapshot = await settled;
    expect(snapshot.scripts).toBeUndefined();
    expect(snapshot.lifecycle).toBeUndefined();
    expect(host.ran).toHaveLength(0);
    expect(host.ended).toEqual([]);

    const t2 = rig();
    const noHost = executeWsSession(makeWsRequest({ scripts: { 'ws-after-close': 'x();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t2.transport,
      sendId: 'send-scr-7',
      resolution: (template) => template,
      scriptChain: [],
    });
    await settleTick();
    t2.open(0);
    t2.closeClean(0);
    expect((await noHost).scripts).toBeUndefined();
  });
});
