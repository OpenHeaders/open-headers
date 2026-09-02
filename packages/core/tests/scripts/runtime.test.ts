/**
 * Runtime loop — the inbound half of the broker ⇄ runtime protocol over
 * an injected `post`: execute → result, the `oh.*` host round trip,
 * `script.session-end` dropping the session's context, readiness
 * announced on demand, and foreign or echoed messages ignored.
 */

import type { RequestSnapshot, ScriptWireMessage } from '@openheaders/core/scripts';
import { createScriptRuntime } from '@openheaders/core/scripts/runtime';
import { describe, expect, it } from 'vitest';

const REQUEST: RequestSnapshot = {
  method: 'GET',
  url: 'https://api.openheaders.io/v1/ping',
  headers: [],
  params: [],
  body: { type: 'none' },
};

type Waiter = { accepts: (message: ScriptWireMessage) => boolean; resolve: (message: ScriptWireMessage) => void };

function makeRig() {
  const posted: ScriptWireMessage[] = [];
  /** Posts nobody has claimed yet — a script's first host request lands
   *  synchronously inside `handleMessage`, before a waiter can exist. */
  const unclaimed: ScriptWireMessage[] = [];
  const waiters: Waiter[] = [];
  const runtime = createScriptRuntime((message) => {
    posted.push(message);
    const index = waiters.findIndex((w) => w.accepts(message));
    if (index >= 0) waiters.splice(index, 1)[0]?.resolve(message);
    else unclaimed.push(message);
  });
  const nextPost = (type: ScriptWireMessage['type']): Promise<ScriptWireMessage> => {
    const ready = unclaimed.findIndex((m) => m.type === type);
    if (ready >= 0) return Promise.resolve(unclaimed.splice(ready, 1)[0] as ScriptWireMessage);
    return new Promise((resolve) => {
      waiters.push({ accepts: (m) => m.type === type, resolve });
    });
  };
  let counter = 0;
  const execute = (source: string, sessionId?: string): Promise<ScriptWireMessage> => {
    counter += 1;
    const next = nextPost('script.result');
    runtime.handleMessage({
      type: 'script.execute',
      request:
        sessionId === undefined
          ? { executionId: `exec-${counter}`, kind: 'pre-request', source, request: REQUEST }
          : {
              executionId: `exec-${counter}`,
              kind: 'ws-on-message',
              source,
              sessionId,
              hook: {
                kind: 'ws-on-message',
                message: { direction: 'down', text: 'hi', dataBase64: 'aGk=', binary: false, index: 0 },
              },
            },
    });
    return next;
  };
  return { runtime, posted, nextPost, execute };
}

function resultOf(message: ScriptWireMessage) {
  if (message.type !== 'script.result') throw new Error(`expected a result, got ${message.type}`);
  return message.result;
}

describe('createScriptRuntime', () => {
  it('announces readiness only when asked', () => {
    const rig = makeRig();
    expect(rig.posted).toEqual([]);
    rig.runtime.announceReady();
    expect(rig.posted).toEqual([{ type: 'sandbox.ready' }]);
  });

  it('runs an execute request and posts its result', async () => {
    const rig = makeRig();
    const result = resultOf(await rig.execute(`console.log('ran');`));
    expect(result.executionId).toBe('exec-1');
    expect(result.succeeded).toBe(true);
    expect(result.consoleLog.map((e) => e.args.join(' '))).toEqual(['ran']);
  });

  it('reflects oh.* calls as host requests and resumes on the reply', async () => {
    const rig = makeRig();
    const pending = rig.execute(`const v = await oh.variables.get('token'); console.log('got', v);`);
    const hostRequest = await rig.nextPost('script.host-request');
    if (hostRequest.type !== 'script.host-request') throw new Error('expected a host request');
    expect(hostRequest.request).toMatchObject({ op: 'variables.get', name: 'token', executionId: 'exec-1' });
    rig.runtime.handleMessage({
      type: 'script.host-response',
      response: { executionId: 'exec-1', rpcId: hostRequest.request.rpcId, ok: true, value: 'secret' },
    });
    const result = resultOf(await pending);
    expect(result.succeeded).toBe(true);
    expect(result.consoleLog.map((e) => e.args.join(' '))).toEqual(['got secret']);
  });

  it('drops a session context on script.session-end', async () => {
    const rig = makeRig();
    await rig.execute(`oh.session.count = 3;`, 'session-1');
    rig.runtime.handleMessage({ type: 'script.session-end', sessionId: 'session-1' });
    const result = resultOf(await rig.execute(`console.log(typeof oh.session.count);`, 'session-1'));
    expect(result.consoleLog.map((e) => e.args.join(' '))).toEqual(['undefined']);
    rig.runtime.handleMessage({ type: 'script.session-end', sessionId: 'session-1' });
  });

  it('ignores echoes of its own up messages and unrelated traffic', () => {
    const rig = makeRig();
    rig.runtime.handleMessage({ type: 'sandbox.ready' });
    rig.runtime.handleMessage({ type: 'script.result', result: { executionId: 'x' } });
    rig.runtime.handleMessage({ type: 'script.host-response', response: { rpcId: 'unknown' } });
    rig.runtime.handleMessage('not an envelope');
    rig.runtime.handleMessage(null);
    expect(rig.posted).toEqual([]);
  });
});
