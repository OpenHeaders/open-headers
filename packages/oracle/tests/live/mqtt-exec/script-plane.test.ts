/**
 * MQTT script plane — the four hooks over a scripted session host: the
 * CONNECT mutations apply level by level (a `null` will drops it, a
 * subscription list replaces), a failed level applies nothing and the
 * dial proceeds (lenient), Before publish rewrites or drops (the drop
 * ends the chain and names the level), On message queues behind the
 * earlier hooks (serial, never interleaved) and never blocks, After
 * close waits for the queue, every event records a mark up to the
 * shared cap while the tallies keep counting, and `end` releases the
 * session.
 */

import type { MqttConnectSnapshot, ScriptExecutionResult, SessionHookInput } from '@openheaders/core/scripts';
import type { ExecutedMqttScriptMark } from '@openheaders/core/types';
import { createMqttScriptPlane, type MqttScriptChains } from '@openheaders/oracle/live/mqtt-exec/script-plane';
import type { ChainScript } from '@openheaders/oracle/live/request-exec/script-chain';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import {
  hasSessionScriptChains,
  MAX_SESSION_SCRIPT_MARKS,
} from '@openheaders/oracle/live/request-exec/session-script-plane';
import { describe, expect, it, vi } from 'vitest';

const level = (label: string, source: string, kind: ChainScript['level'] = 'collection'): ChainScript => ({
  level: kind,
  uid: `${kind}-${label}`,
  name: label,
  label: kind === 'request' ? 'Request' : `${kind === 'collection' ? 'Collection' : 'Folder'} '${label}'`,
  source,
});

const EMPTY: MqttScriptChains = {
  'mqtt-before-connect': [],
  'mqtt-before-publish': [],
  'mqtt-on-message': [],
  'mqtt-after-close': [],
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

const CONNECT: MqttConnectSnapshot = {
  url: 'mqtt://broker.openheaders.io:1883',
  protocolVersion: '5.0',
  clientId: 'oh-1',
  username: '',
  password: '',
  will: { topic: 'status', payloadBase64: 'b2Zm', qos: 0, retain: true },
  subscriptions: [{ topicFilter: 'probe/#', qos: 1 }],
  userProperties: [],
  attempt: 0,
};

const inbound = (index: number): Extract<SessionHookInput, { kind: 'mqtt-on-message' }>['message'] => ({
  direction: 'down' as const,
  topic: 'probe/echo/reply',
  payloadBase64: 'bQ==',
  text: `m${index}`,
  qos: 0,
  retain: false,
  dup: false,
  index,
});

const CLOSE = {
  end: { by: 'client' as const },
  connack: { sessionPresent: false, reasonCode: 0 },
  stopped: false,
  published: 1,
  received: 2,
  droppedMessages: 0,
  durationMs: 1,
};

describe('hasSessionScriptChains (MQTT)', () => {
  it('is false for four empty chains and true once any hook carries a level', () => {
    expect(hasSessionScriptChains(EMPTY)).toBe(false);
    expect(hasSessionScriptChains({ ...EMPTY, 'mqtt-after-close': [level('A', 'close();')] })).toBe(true);
  });
});

describe('beforeConnect', () => {
  it('applies each level onto the next and returns the CONNECT as the chain left it', async () => {
    const rig = scriptedHost({
      'col();': () =>
        ok({
          sessionMutation: {
            kind: 'mqtt-connect',
            clientId: 'device-1',
            subscriptions: [
              { topicFilter: 'probe/#', qos: 1 },
              { topicFilter: 'devices/+/status', qos: 2 },
            ],
          },
        }),
      'req();': (input) =>
        ok({
          sessionMutation: {
            kind: 'mqtt-connect',
            username: 'device',
            password: 's3cret',
            will: null,
            userProperties: [
              { key: 'client', value: input.hook.kind === 'mqtt-before-connect' ? input.hook.connect.clientId : '?' },
            ],
          },
        }),
    });
    const marks: ExecutedMqttScriptMark[] = [];
    const plane = createMqttScriptPlane({
      sessionId: 'send-1',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-before-connect': [level('Fleet', 'col();'), level('Probe', 'req();', 'request')] },
      recordMark: (mark) => marks.push(mark),
    });
    const connect = await plane.beforeConnect(CONNECT);
    expect(connect).toEqual({
      ...CONNECT,
      clientId: 'device-1',
      username: 'device',
      password: 's3cret',
      will: null,
      subscriptions: [
        { topicFilter: 'probe/#', qos: 1 },
        { topicFilter: 'devices/+/status', qos: 2 },
      ],
      // The second level saw the first level's client id.
      userProperties: [{ key: 'client', value: 'device-1' }],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ kind: 'script', hook: 'mqtt-before-connect', succeeded: true, attempt: 0 });
    expect(marks[0]?.chain.map((s) => s.name)).toEqual(['Fleet', 'Probe']);
    expect(plane.summary()).toMatchObject({ mode: 'safe', beforeConnect: { succeeded: true, dials: 1 } });
  });

  it('a failed level applies nothing; the CONNECT proceeds on the rest (lenient)', async () => {
    const rig = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
      'ok();': () => ok({ sessionMutation: { kind: 'mqtt-connect', clientId: 'alt' } }),
    });
    const marks: ExecutedMqttScriptMark[] = [];
    const plane = createMqttScriptPlane({
      sessionId: 'send-2',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-before-connect': [level('A', 'boom();'), level('B', 'ok();', 'folder')] },
      recordMark: (mark) => marks.push(mark),
    });
    const connect = await plane.beforeConnect(CONNECT);
    expect(connect.clientId).toBe('alt');
    expect(connect.will).toEqual(CONNECT.will);
    expect(marks[0]).toMatchObject({ succeeded: false, error: { message: "Collection 'A': boom" } });
    expect(plane.summary()?.beforeConnect?.succeeded).toBe(false);
  });

  it('records the LAST dial with the dials counted; an empty chain answers the input verbatim', async () => {
    const rig = scriptedHost({});
    const plane = createMqttScriptPlane({
      sessionId: 'send-3',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-before-connect': [level('A', 'x();')] },
      recordMark: () => {},
    });
    await plane.beforeConnect(CONNECT);
    await plane.beforeConnect({ ...CONNECT, attempt: 1 });
    expect(plane.summary()?.beforeConnect?.dials).toBe(2);
    const silent = createMqttScriptPlane({ sessionId: 'send-4', host: rig.host, chains: EMPTY, recordMark: () => {} });
    expect(await silent.beforeConnect(CONNECT)).toBe(CONNECT);
    expect(silent.summary()).toBeUndefined();
  });
});

describe('beforePublish', () => {
  const message = {
    direction: 'up' as const,
    topic: 'probe/echo',
    payload: 'hello',
    format: 'text' as const,
    qos: 0 as const,
    retain: false,
    index: 0,
  };

  it('rewrites the message level by level and tallies the runs', async () => {
    const rig = scriptedHost({
      'a();': (input) =>
        ok({
          sessionMutation: {
            kind: 'mqtt-publish',
            payload: `${input.hook.kind === 'mqtt-before-publish' ? input.hook.message.payload : ''}+a`,
            qos: 1,
          },
        }),
      'b();': (input) =>
        ok({
          sessionMutation: {
            kind: 'mqtt-publish',
            payload: `${input.hook.kind === 'mqtt-before-publish' ? input.hook.message.payload : ''}+b`,
            topic: 'probe/echo/v2',
            retain: true,
          },
        }),
    });
    const plane = createMqttScriptPlane({
      sessionId: 'send-5',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-before-publish': [level('A', 'a();'), level('R', 'b();', 'request')] },
      recordMark: () => {},
    });
    const first = await plane.beforePublish(message);
    expect(first).toEqual({
      kind: 'publish',
      message: { ...message, payload: 'hello+a+b', topic: 'probe/echo/v2', qos: 1, retain: true },
    });
    await plane.beforePublish({ ...message, payload: 'again', index: 1 });
    expect(plane.summary()?.beforePublish).toMatchObject({ runs: 2, failed: 0, dropped: 0 });
    expect(plane.summary()?.beforePublish?.levels.map((l) => [l.name, l.runs])).toEqual([
      ['A', 2],
      ['R', 2],
    ]);
  });

  it('a drop ends the chain there, names the level and counts', async () => {
    const rig = scriptedHost({
      'drop();': () => ok({ sessionMutation: { kind: 'mqtt-publish', drop: true } }),
      'later();': () => ok({ sessionMutation: { kind: 'mqtt-publish', payload: 'never' } }),
    });
    const marks: ExecutedMqttScriptMark[] = [];
    const plane = createMqttScriptPlane({
      sessionId: 'send-6',
      host: rig.host,
      chains: {
        ...EMPTY,
        'mqtt-before-publish': [level('Guard', 'drop();', 'folder'), level('R', 'later();', 'request')],
      },
      recordMark: (mark) => marks.push(mark),
    });
    expect(await plane.beforePublish(message)).toEqual({ kind: 'dropped', by: "Folder 'Guard'" });
    expect(rig.ran.map((r) => r.source)).toEqual(['drop();']);
    expect(marks[0]).toMatchObject({ hook: 'mqtt-before-publish', droppedBy: "Folder 'Guard'" });
    expect(plane.summary()?.beforePublish).toMatchObject({ runs: 1, dropped: 1 });
  });
});

describe('the serial queue', () => {
  it('runs the hooks of one session in order — a slow On message never interleaves with the next', async () => {
    const order: string[] = [];
    let release: (() => void) | null = null;
    const rig = scriptedHost({
      'slow();': async (input) => {
        const index = input.hook.kind === 'mqtt-on-message' ? input.hook.message.index : -1;
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
    const plane = createMqttScriptPlane({
      sessionId: 'send-7',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-on-message': [level('A', 'slow();')], 'mqtt-after-close': [level('A', 'close();')] },
      recordMark: () => {},
    });
    expect(plane.onMessage(inbound(0))).toBeUndefined();
    plane.onMessage(inbound(1));
    const closed = plane.afterClose(CLOSE);
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start 0']);
    (release as unknown as () => void)();
    await closed;
    expect(order).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'close']);
    expect(plane.summary()?.onMessage).toMatchObject({ runs: 2 });
    expect(plane.summary()?.afterClose?.succeeded).toBe(true);
  });
});

describe('marks and the record', () => {
  it('stops the marks at the shared cap while the tallies keep counting', async () => {
    const rig = scriptedHost({});
    const recordMark = vi.fn();
    const plane = createMqttScriptPlane({
      sessionId: 'send-8',
      host: rig.host,
      chains: { ...EMPTY, 'mqtt-on-message': [level('A', 'x();')] },
      recordMark,
    });
    for (let i = 0; i < MAX_SESSION_SCRIPT_MARKS + 5; i += 1) plane.onMessage(inbound(i));
    await plane.afterClose({ ...CLOSE, end: null, stopped: true });
    expect(recordMark).toHaveBeenCalledTimes(MAX_SESSION_SCRIPT_MARKS);
    expect(plane.summary()).toMatchObject({ onMessage: { runs: MAX_SESSION_SCRIPT_MARKS + 5 }, marksCapped: true });
  });

  it('carries the console and the assertions on the mark, the close fold on the record, and end releases the session', async () => {
    const rig = scriptedHost({
      'log();': () =>
        ok({
          consoleLog: [{ level: 'log', args: ['hi'], timeMs: 1 }],
          assertions: [{ name: 'is ping', passed: false, message: 'nope' }],
        }),
      'close();': (input) =>
        ok({
          assertions: [
            { name: 'clean', passed: input.hook.kind === 'mqtt-after-close' && input.hook.close.end?.by === 'client' },
          ],
        }),
    });
    const marks: ExecutedMqttScriptMark[] = [];
    const plane = createMqttScriptPlane({
      sessionId: 'send-9',
      host: rig.host,
      chains: {
        ...EMPTY,
        'mqtt-on-message': [level('A', 'log();')],
        'mqtt-after-close': [level('R', 'close();', 'request')],
      },
      recordMark: (mark) => marks.push(mark),
    });
    plane.onMessage(inbound(0));
    await plane.afterClose(CLOSE);
    expect(marks[0]).toMatchObject({
      hook: 'mqtt-on-message',
      consoleLog: [{ level: 'log', args: ['hi'], timeMs: 1 }],
      assertions: [{ name: 'is ping', passed: false, message: 'nope' }],
    });
    expect(marks[1]).toMatchObject({ hook: 'mqtt-after-close', assertions: [{ name: 'clean', passed: true }] });
    expect(plane.summary()?.afterClose?.chain.map((s) => [s.level, s.name])).toEqual([['request', 'R']]);
    plane.end();
    expect(rig.ended).toEqual(['send-9']);
  });
});
