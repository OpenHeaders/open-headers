/**
 * gRPC script plane — the three hooks over a scripted session host:
 * the invoke mutations apply level by level (the metadata list
 * replaces, the message text replaces), a failed level applies nothing
 * and the call proceeds (lenient), On message queues behind the
 * earlier hooks (serial, never interleaved) and never blocks, After
 * response waits for the queue, every event records a mark stamped
 * with the capture position the wire leg reported up to the shared
 * cap while the tallies keep counting, the live sink replays the marks
 * recorded before it, the frame snapshot decodes through the registry
 * (null when it cannot), and `end` releases the call.
 */

import { buildRegistry, encodeMessage, parseProto } from '@openheaders/core/proto';
import type { GrpcInvokeSnapshot, ScriptExecutionResult, SessionHookInput } from '@openheaders/core/scripts';
import type { ExecutedGrpcScriptMark } from '@openheaders/core/types';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import {
  createGrpcScriptPlane,
  type GrpcScriptChains,
  grpcFrameSnapshot,
} from '@openheaders/oracle/live/grpc-exec/script-plane';
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

const EMPTY: GrpcScriptChains = {
  'grpc-before-invoke': [],
  'grpc-on-message': [],
  'grpc-after-response': [],
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

const INVOKE: GrpcInvokeSnapshot = {
  target: 'grpc.openheaders.io:443',
  service: 'library.v1.Library',
  method: 'GetBook',
  shape: 'unary',
  metadata: [{ key: 'x-tenant', value: 'acme' }],
  messageText: '{"name":"books/1"}',
};

const frame = (index: number): Extract<SessionHookInput, { kind: 'grpc-on-message' }>['message'] => ({
  direction: 'down',
  type: 'library.v1.Book',
  value: { name: `books/${index}` },
  dataBase64: 'AA==',
  compressed: false,
  index,
});

const RESPONSE = {
  httpStatus: 200,
  status: 0,
  statusSource: 'trailers' as const,
  headers: [],
  trailers: [],
  sent: 1,
  received: 2,
  stopped: false,
  durationMs: 5,
};

describe('hasSessionScriptChains (gRPC)', () => {
  it('is false for three empty chains and true once any hook carries a level', () => {
    expect(hasSessionScriptChains(EMPTY)).toBe(false);
    expect(hasSessionScriptChains({ ...EMPTY, 'grpc-after-response': [level('A', 'x();')] })).toBe(true);
  });
});

describe('beforeInvoke', () => {
  it('applies each level onto the next and returns the call as the chain left it', async () => {
    const rig = scriptedHost({
      'col();': () =>
        ok({
          sessionMutation: {
            kind: 'grpc-invoke',
            metadata: [
              { key: 'x-tenant', value: 'acme' },
              { key: 'x-trace', value: 't-1' },
            ],
          },
        }),
      'req();': (input) =>
        ok({
          sessionMutation: {
            kind: 'grpc-invoke',
            messageText: JSON.stringify({
              name: 'books/2',
              // The second level saw the first level's metadata.
              trace: input.hook.kind === 'grpc-before-invoke' ? input.hook.invoke.metadata[1]?.value : '?',
            }),
          },
        }),
    });
    const plane = createGrpcScriptPlane({
      sessionId: 'send-1',
      host: rig.host,
      chains: { ...EMPTY, 'grpc-before-invoke': [level('Library', 'col();'), level('Probe', 'req();', 'request')] },
    });
    const invoke = await plane.beforeInvoke(INVOKE);
    expect(invoke).toEqual({
      ...INVOKE,
      metadata: [
        { key: 'x-tenant', value: 'acme' },
        { key: 'x-trace', value: 't-1' },
      ],
      messageText: '{"name":"books/2","trace":"t-1"}',
    });
    expect(plane.marks).toHaveLength(1);
    expect(plane.marks[0]).toMatchObject({ kind: 'script', hook: 'grpc-before-invoke', succeeded: true, atIndex: 0 });
    expect(plane.marks[0]?.chain.map((s) => s.name)).toEqual(['Library', 'Probe']);
    expect(plane.summary()).toMatchObject({ mode: 'safe', beforeInvoke: { succeeded: true } });
  });

  it('a failed level applies nothing; the call proceeds on the rest (lenient)', async () => {
    const rig = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
      'ok();': () => ok({ sessionMutation: { kind: 'grpc-invoke', messageText: '{}' } }),
    });
    const plane = createGrpcScriptPlane({
      sessionId: 'send-2',
      host: rig.host,
      chains: { ...EMPTY, 'grpc-before-invoke': [level('A', 'boom();'), level('B', 'ok();', 'folder')] },
    });
    const invoke = await plane.beforeInvoke(INVOKE);
    expect(invoke.messageText).toBe('{}');
    expect(invoke.metadata).toEqual(INVOKE.metadata);
    expect(plane.marks[0]).toMatchObject({ succeeded: false, error: { message: "Collection 'A': boom" } });
    expect(plane.summary()?.beforeInvoke?.succeeded).toBe(false);
  });

  it('an empty chain answers the input verbatim and records nothing', async () => {
    const rig = scriptedHost({});
    const silent = createGrpcScriptPlane({ sessionId: 'send-3', host: rig.host, chains: EMPTY });
    expect(await silent.beforeInvoke(INVOKE)).toBe(INVOKE);
    expect(silent.summary()).toBeUndefined();
    expect(silent.marks).toEqual([]);
  });
});

describe('the serial queue and the marks', () => {
  it('runs the hooks of one call in order — a slow On message never interleaves with the next', async () => {
    const order: string[] = [];
    let release: (() => void) | null = null;
    const rig = scriptedHost({
      'slow();': async (input) => {
        const index = input.hook.kind === 'grpc-on-message' ? input.hook.message.index : -1;
        order.push(`start ${index}`);
        if (index === 0)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        order.push(`end ${index}`);
        return ok();
      },
      'done();': () => {
        order.push('response');
        return ok();
      },
    });
    const plane = createGrpcScriptPlane({
      sessionId: 'send-4',
      host: rig.host,
      chains: {
        ...EMPTY,
        'grpc-on-message': [level('A', 'slow();')],
        'grpc-after-response': [level('A', 'done();')],
      },
    });
    plane.captured(1);
    expect(plane.onMessage(frame(0))).toBeUndefined();
    plane.captured(2);
    plane.onMessage(frame(1));
    const settled = plane.afterResponse(RESPONSE);
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start 0']);
    (release as unknown as () => void)();
    await settled;
    expect(order).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'response']);
    // A mark lands at the capture position current when its hook
    // FINISHED — the first message's mark landed after the second
    // frame was already captured.
    expect(plane.marks.map((m) => [m.hook, m.atIndex])).toEqual([
      ['grpc-on-message', 2],
      ['grpc-on-message', 2],
      ['grpc-after-response', 2],
    ]);
    expect(plane.summary()?.onMessage).toMatchObject({ runs: 2 });
    expect(plane.summary()?.afterResponse?.succeeded).toBe(true);
  });

  it('stops the marks at the shared cap while the tallies keep counting', async () => {
    const rig = scriptedHost({});
    const plane = createGrpcScriptPlane({
      sessionId: 'send-5',
      host: rig.host,
      chains: { ...EMPTY, 'grpc-on-message': [level('A', 'x();')] },
    });
    for (let i = 0; i < MAX_SESSION_SCRIPT_MARKS + 5; i += 1) plane.onMessage(frame(i));
    await plane.afterResponse({ ...RESPONSE, stopped: true });
    expect(plane.marks).toHaveLength(MAX_SESSION_SCRIPT_MARKS);
    expect(plane.summary()).toMatchObject({ onMessage: { runs: MAX_SESSION_SCRIPT_MARKS + 5 }, marksCapped: true });
  });

  it('the live sink replays the marks recorded before it and receives every later one', async () => {
    const rig = scriptedHost({});
    const plane = createGrpcScriptPlane({
      sessionId: 'send-6',
      host: rig.host,
      chains: { ...EMPTY, 'grpc-before-invoke': [level('A', 'x();')], 'grpc-on-message': [level('A', 'm();')] },
    });
    await plane.beforeInvoke(INVOKE);
    const emit = vi.fn();
    plane.attach(emit);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[0]).toMatchObject({ hook: 'grpc-before-invoke', atIndex: 0 });
    plane.captured(1);
    plane.onMessage(frame(0));
    await plane.afterResponse(RESPONSE);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1]?.[0]).toMatchObject({ hook: 'grpc-on-message', atIndex: 1 });
  });

  it('carries the console and the assertions on the mark, the response fold on the record, and end releases the call', async () => {
    const rig = scriptedHost({
      'log();': () =>
        ok({
          consoleLog: [{ level: 'log', args: ['hi'], timeMs: 1 }],
          assertions: [{ name: 'is book', passed: false, message: 'nope' }],
        }),
      'done();': (input) =>
        ok({
          assertions: [
            { name: 'ok', passed: input.hook.kind === 'grpc-after-response' && input.hook.response.status === 0 },
          ],
        }),
    });
    const plane = createGrpcScriptPlane({
      sessionId: 'send-7',
      host: rig.host,
      chains: {
        ...EMPTY,
        'grpc-on-message': [level('A', 'log();')],
        'grpc-after-response': [level('R', 'done();', 'request')],
      },
    });
    plane.onMessage(frame(0));
    await plane.afterResponse(RESPONSE);
    const marks: readonly ExecutedGrpcScriptMark[] = plane.marks;
    expect(marks[0]).toMatchObject({
      hook: 'grpc-on-message',
      consoleLog: [{ level: 'log', args: ['hi'], timeMs: 1 }],
      assertions: [{ name: 'is book', passed: false, message: 'nope' }],
    });
    expect(marks[1]).toMatchObject({ hook: 'grpc-after-response', assertions: [{ name: 'ok', passed: true }] });
    expect(plane.summary()?.afterResponse?.chain.map((s) => [s.level, s.name])).toEqual([['request', 'R']]);
    plane.end();
    expect(rig.ended).toEqual(['send-7']);
  });
});

describe('grpcFrameSnapshot', () => {
  const REGISTRY = buildRegistry([
    {
      path: 'index.proto',
      census: parseProto(`syntax = "proto3";
package library.v1;
message Book { string name = 1; }
`),
    },
  ]);

  it('decodes the bytes as the declared type; a foreign type, unknown type or compressed frame reads null', () => {
    const bytes = encodeMessage(REGISTRY, 'library.v1.Book', { name: 'books/1' });
    const dataBase64 = encodeBase64Bytes(bytes);
    expect(
      grpcFrameSnapshot(REGISTRY, {
        direction: 'down',
        type: 'library.v1.Book',
        dataBase64,
        compressed: false,
        index: 0,
      }),
    ).toEqual({
      direction: 'down',
      type: 'library.v1.Book',
      value: { name: 'books/1' },
      dataBase64,
      compressed: false,
      index: 0,
    });
    expect(
      grpcFrameSnapshot(REGISTRY, {
        direction: 'up',
        type: 'library.v1.Missing',
        dataBase64,
        compressed: false,
        index: 1,
      }).value,
    ).toBeNull();
    expect(
      grpcFrameSnapshot(REGISTRY, { direction: 'down', type: null, dataBase64, compressed: false, index: 2 }).value,
    ).toBeNull();
    expect(
      grpcFrameSnapshot(REGISTRY, {
        direction: 'down',
        type: 'library.v1.Book',
        dataBase64,
        compressed: true,
        index: 3,
      }).value,
    ).toBeNull();
  });
});
