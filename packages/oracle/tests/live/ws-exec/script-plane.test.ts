/**
 * WS script plane — the four hooks over a scripted session host: the
 * dial's connect mutations apply level by level (a params list rewrites
 * the URL's query), a failed level applies nothing and the dial
 * proceeds (lenient), Before send rewrites or drops (the drop ends the
 * chain and names the level), On message queues behind the earlier
 * hooks (serial, never interleaved) and never blocks, After close waits
 * for the queue, every event records a mark up to the cap while the
 * tallies keep counting, and `end` releases the session.
 */

import type { ScriptExecutionResult, SessionHookInput } from '@openheaders/core/scripts';
import type { ExecutedWsScriptMark } from '@openheaders/core/types';
import type { ChainScript } from '@openheaders/oracle/live/request-exec/script-chain';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import {
  createWsScriptPlane,
  hasWsScriptChains,
  MAX_WS_SCRIPT_MARKS,
  type WsScriptChains,
} from '@openheaders/oracle/live/ws-exec/script-plane';
import { describe, expect, it, vi } from 'vitest';

const level = (label: string, source: string, kind: ChainScript['level'] = 'collection'): ChainScript => ({
  level: kind,
  uid: `${kind}-${label}`,
  name: label,
  label: kind === 'request' ? 'Request' : `${kind === 'collection' ? 'Collection' : 'Folder'} '${label}'`,
  source,
});

const EMPTY: WsScriptChains = {
  'ws-before-connect': [],
  'ws-before-send': [],
  'ws-on-message': [],
  'ws-after-close': [],
};

const ok = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
  executionId: 'e',
  succeeded: true,
  assertions: [],
  consoleLog: [],
  durationMs: 2,
  ...over,
});

/** A host answering per SOURCE — the answer may read the hook input. */
function scriptedHost(
  answers: Record<string, (input: SessionScriptInput) => ScriptExecutionResult | Promise<ScriptExecutionResult>>,
): { host: SessionScriptHost; ran: SessionScriptInput[]; ended: string[] } {
  const ran: SessionScriptInput[] = [];
  const ended: string[] = [];
  return {
    ran,
    ended,
    host: {
      mode: 'safe',
      run: async (input) => {
        ran.push(input);
        return answers[input.source]?.(input) ?? ok();
      },
      endSession: (id) => {
        ended.push(id);
      },
    },
  };
}

const CONNECT = {
  url: 'wss://events.openheaders.io/live?tenant=acme',
  headers: [{ key: 'X-Client', value: 'oh' }],
  params: [{ key: 'tenant', value: 'acme' }],
  subprotocols: [],
  attempt: 0,
};

const inbound = (index: number): Extract<SessionHookInput, { kind: 'ws-on-message' }>['message'] => ({
  direction: 'down' as const,
  text: `m${index}`,
  dataBase64: 'bQ==',
  binary: false,
  index,
});

describe('hasWsScriptChains', () => {
  it('is false for four empty chains and true once any hook carries a level', () => {
    expect(hasWsScriptChains(EMPTY)).toBe(false);
    expect(hasWsScriptChains({ ...EMPTY, 'ws-after-close': [level('A', 'close();')] })).toBe(true);
  });
});

describe('beforeConnect', () => {
  it('applies each level onto the next and returns the dial as the chain left it', async () => {
    const rig = scriptedHost({
      'col();': () => ok({ sessionMutation: { kind: 'ws-connect', params: [{ key: 'token', value: 't1' }] } }),
      'req();': (input) =>
        ok({
          sessionMutation: {
            kind: 'ws-connect',
            headers: [
              ...(input.hook.kind === 'ws-before-connect' ? input.hook.connect.headers : []),
              {
                key: 'X-Attempt',
                value: String(input.hook.kind === 'ws-before-connect' ? input.hook.connect.attempt : -1),
              },
            ],
            subprotocols: ['chat.v2'],
          },
        }),
    });
    const marks: ExecutedWsScriptMark[] = [];
    const plane = createWsScriptPlane({
      sessionId: 'send-1',
      host: rig.host,
      chains: { ...EMPTY, 'ws-before-connect': [level('Payments', 'col();'), level('Charge', 'req();', 'request')] },
      recordMark: (mark) => marks.push(mark),
    });
    const dial = await plane.beforeConnect(CONNECT);
    expect(dial.url).toBe('wss://events.openheaders.io/live?token=t1');
    expect(dial.params).toEqual([{ key: 'token', value: 't1' }]);
    expect(dial.headers).toEqual([
      { key: 'X-Client', value: 'oh' },
      { key: 'X-Attempt', value: '0' },
    ]);
    expect(dial.subprotocols).toEqual(['chat.v2']);
    // The second level saw the first level's URL.
    const second = rig.ran[1];
    expect(second?.hook.kind === 'ws-before-connect' ? second.hook.connect.url : null).toBe(
      'wss://events.openheaders.io/live?token=t1',
    );
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ kind: 'script', hook: 'ws-before-connect', succeeded: true, attempt: 0 });
    expect(marks[0]?.chain.map((s) => s.name)).toEqual(['Payments', 'Charge']);
    expect(plane.summary()).toMatchObject({ mode: 'safe', beforeConnect: { succeeded: true, dials: 1 } });
  });

  it('a failed level applies nothing; the dial proceeds on the rest (lenient)', async () => {
    const rig = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
      'ok();': () => ok({ sessionMutation: { kind: 'ws-connect', url: 'wss://alt.openheaders.io/live' } }),
    });
    const marks: ExecutedWsScriptMark[] = [];
    const plane = createWsScriptPlane({
      sessionId: 'send-2',
      host: rig.host,
      chains: { ...EMPTY, 'ws-before-connect': [level('A', 'boom();'), level('B', 'ok();', 'folder')] },
      recordMark: (mark) => marks.push(mark),
    });
    const dial = await plane.beforeConnect(CONNECT);
    expect(dial.url).toBe('wss://alt.openheaders.io/live');
    expect(marks[0]).toMatchObject({ succeeded: false, error: { message: "Collection 'A': boom" } });
    expect(marks[0]?.chain.map((s) => s.succeeded)).toEqual([false, true]);
    const summary = plane.summary();
    expect(summary?.beforeConnect?.succeeded).toBe(false);
  });

  it('records the LAST dial with the dials counted', async () => {
    const rig = scriptedHost({});
    const plane = createWsScriptPlane({
      sessionId: 'send-3',
      host: rig.host,
      chains: { ...EMPTY, 'ws-before-connect': [level('A', 'x();')] },
      recordMark: () => {},
    });
    await plane.beforeConnect(CONNECT);
    await plane.beforeConnect({ ...CONNECT, attempt: 1 });
    await plane.beforeConnect({ ...CONNECT, attempt: 2 });
    expect(plane.summary()?.beforeConnect?.dials).toBe(3);
    const attempts = rig.ran.map((r) => (r.hook.kind === 'ws-before-connect' ? r.hook.connect.attempt : -1));
    expect(attempts).toEqual([0, 1, 2]);
  });

  it('an empty chain answers the input verbatim without touching the host', async () => {
    const rig = scriptedHost({});
    const plane = createWsScriptPlane({ sessionId: 'send-4', host: rig.host, chains: EMPTY, recordMark: () => {} });
    expect(await plane.beforeConnect(CONNECT)).toBe(CONNECT);
    expect(rig.ran).toHaveLength(0);
    expect(plane.summary()).toBeUndefined();
  });
});

describe('beforeSend', () => {
  const message = { direction: 'up' as const, text: 'hello', binary: false, index: 0 };

  it('rewrites the text level by level and tallies the runs', async () => {
    const rig = scriptedHost({
      'a();': (input) =>
        ok({
          sessionMutation: {
            kind: 'ws-send',
            text: `${input.hook.kind === 'ws-before-send' ? input.hook.message.text : ''}+a`,
          },
        }),
      'b();': (input) =>
        ok({
          sessionMutation: {
            kind: 'ws-send',
            text: `${input.hook.kind === 'ws-before-send' ? input.hook.message.text : ''}+b`,
          },
        }),
    });
    const plane = createWsScriptPlane({
      sessionId: 'send-5',
      host: rig.host,
      chains: { ...EMPTY, 'ws-before-send': [level('A', 'a();'), level('R', 'b();', 'request')] },
      recordMark: () => {},
    });
    const first = await plane.beforeSend(message);
    const second = await plane.beforeSend({ ...message, text: 'again', index: 1 });
    expect(first).toEqual({ kind: 'send', message: { ...message, text: 'hello+a+b' } });
    expect(second).toEqual({ kind: 'send', message: { ...message, text: 'again+a+b', index: 1 } });
    expect(plane.summary()?.beforeSend).toMatchObject({ runs: 2, failed: 0, dropped: 0 });
    expect(plane.summary()?.beforeSend?.levels.map((l) => [l.name, l.runs])).toEqual([
      ['A', 2],
      ['R', 2],
    ]);
  });

  it('a drop ends the chain there, names the level and counts', async () => {
    const rig = scriptedHost({
      'drop();': () => ok({ sessionMutation: { kind: 'ws-send', drop: true } }),
      'later();': () => ok({ sessionMutation: { kind: 'ws-send', text: 'never' } }),
    });
    const marks: ExecutedWsScriptMark[] = [];
    const plane = createWsScriptPlane({
      sessionId: 'send-6',
      host: rig.host,
      chains: { ...EMPTY, 'ws-before-send': [level('Guard', 'drop();', 'folder'), level('R', 'later();', 'request')] },
      recordMark: (mark) => marks.push(mark),
    });
    expect(await plane.beforeSend(message)).toEqual({ kind: 'dropped', by: "Folder 'Guard'" });
    expect(rig.ran.map((r) => r.source)).toEqual(['drop();']);
    expect(marks[0]).toMatchObject({ hook: 'ws-before-send', droppedBy: "Folder 'Guard'" });
    expect(marks[0]?.chain).toHaveLength(1);
    expect(plane.summary()?.beforeSend).toMatchObject({ runs: 1, dropped: 1 });
  });
});

describe('the serial queue', () => {
  it('runs the hooks of one session in order — a slow On message never interleaves with the next', async () => {
    const order: string[] = [];
    let release: (() => void) | null = null;
    const rig = scriptedHost({
      'slow();': async (input) => {
        const index = input.hook.kind === 'ws-on-message' ? input.hook.message.index : -1;
        order.push(`start ${index}`);
        if (index === 0)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        order.push(`end ${index}`);
        return ok();
      },
      'close();': () => {
        order.push('close');
        return ok();
      },
    });
    const plane = createWsScriptPlane({
      sessionId: 'send-7',
      host: rig.host,
      chains: { ...EMPTY, 'ws-on-message': [level('A', 'slow();')], 'ws-after-close': [level('A', 'close();')] },
      recordMark: () => {},
    });
    plane.onMessage(inbound(0));
    plane.onMessage(inbound(1));
    const closed = plane.afterClose({
      code: 1000,
      reason: '',
      wasClean: true,
      stopped: false,
      messages: 2,
      droppedMessages: 0,
      durationMs: 1,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start 0']);
    (release as unknown as () => void)();
    await closed;
    expect(order).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'close']);
    expect(plane.summary()?.onMessage).toMatchObject({ runs: 2 });
    expect(plane.summary()?.afterClose?.succeeded).toBe(true);
  });

  it('onMessage returns synchronously — the capture never waits', () => {
    const rig = scriptedHost({});
    const plane = createWsScriptPlane({
      sessionId: 'send-8',
      host: rig.host,
      chains: { ...EMPTY, 'ws-on-message': [level('A', 'x();')] },
      recordMark: () => {},
    });
    expect(plane.onMessage(inbound(0))).toBeUndefined();
  });
});

describe('marks and the record', () => {
  it('stops the marks at the cap while the tallies keep counting', async () => {
    const rig = scriptedHost({});
    const recordMark = vi.fn();
    const plane = createWsScriptPlane({
      sessionId: 'send-9',
      host: rig.host,
      chains: { ...EMPTY, 'ws-on-message': [level('A', 'x();')] },
      recordMark,
    });
    for (let i = 0; i < MAX_WS_SCRIPT_MARKS + 5; i += 1) plane.onMessage(inbound(i));
    await plane.afterClose({
      code: null,
      reason: '',
      wasClean: false,
      stopped: true,
      messages: 0,
      droppedMessages: 0,
      durationMs: 1,
    });
    expect(recordMark).toHaveBeenCalledTimes(MAX_WS_SCRIPT_MARKS);
    expect(plane.summary()).toMatchObject({ onMessage: { runs: MAX_WS_SCRIPT_MARKS + 5 }, marksCapped: true });
  });

  it('carries the console and the assertions on the mark, the last error on the tally', async () => {
    const rig = scriptedHost({
      'log();': () =>
        ok({
          consoleLog: [{ level: 'log', args: ['hi'], timeMs: 1 }],
          assertions: [{ name: 'is ping', passed: false, message: 'nope' }],
        }),
      'fail();': () => ok({ succeeded: false, error: { name: 'Error', message: 'bad frame' } }),
    });
    const marks: ExecutedWsScriptMark[] = [];
    const plane = createWsScriptPlane({
      sessionId: 'send-10',
      host: rig.host,
      chains: { ...EMPTY, 'ws-on-message': [level('A', 'log();'), level('R', 'fail();', 'request')] },
      recordMark: (mark) => marks.push(mark),
    });
    plane.onMessage(inbound(0));
    await plane.afterClose({
      code: 1000,
      reason: '',
      wasClean: true,
      stopped: false,
      messages: 1,
      droppedMessages: 0,
      durationMs: 1,
    });
    expect(marks[0]).toMatchObject({
      succeeded: false,
      consoleLog: [{ level: 'log', args: ["[Collection 'A']", 'hi'], timeMs: 1 }],
      assertions: [{ name: 'is ping', passed: false, message: 'nope' }],
      error: { message: 'Request: bad frame' },
    });
    expect(plane.summary()?.onMessage).toMatchObject({
      runs: 1,
      failed: 1,
      lastError: { message: 'Request: bad frame' },
    });
  });

  it('end releases the session on the host', () => {
    const rig = scriptedHost({});
    const plane = createWsScriptPlane({ sessionId: 'send-11', host: rig.host, chains: EMPTY, recordMark: () => {} });
    plane.end();
    expect(rig.ended).toEqual(['send-11']);
  });
});
