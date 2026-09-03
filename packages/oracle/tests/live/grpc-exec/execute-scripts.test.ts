/**
 * gRPC executor — the script hooks on the real spine over a scripted
 * transport and a scripted session host: Before invoke rewrites the
 * metadata rows and the message text once before the wire, ancestors
 * first, with the session credential minting onto the rows it leaves;
 * On message runs after every captured frame either direction — the
 * buffered unary reply, a stream's upstream writes (the rider has no
 * hook) and downstream frames — with the message decoded through the
 * registry; After response runs once at settle with the status, the
 * trailers and the counts; the marks land at their capture positions
 * on the snapshot and ride the live feed as `script` frames; a failed
 * dial still carries the Before invoke record; a host with no script
 * capability, or a request whose chain is empty, leaves the call
 * scriptless.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import { buildRegistry, encodeMessage, parseProto, writeGrpcFrame } from '@openheaders/core/proto';
import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import type { GrpcRequest, Spec } from '@openheaders/core/types';
import { executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import { sendActiveGrpcStreamMessage } from '@openheaders/oracle/live/grpc-exec/stream-plane';
import type {
  GrpcStreamCallbacks,
  GrpcTransport,
  GrpcTransportError,
  GrpcTransportRequest,
  GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import { describe, expect, it } from 'vitest';

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc GetNote(Note) returns (Note);
  rpc Chat(stream Note) returns (stream Note);
}

message Note { string text = 1; }
`;

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/library-spec0001',
  name: 'Library',
  format: 'protobuf',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.proto', content: PROTO }],
};

const REGISTRY = buildRegistry([{ path: 'index.proto', census: parseProto(PROTO) }]);
const NOTE = 'library.v1.Note';
const encodedNote = (text: string): Uint8Array => encodeMessage(REGISTRY, NOTE, { text });

function makeGrpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpcscr1',
    path: 'requests/suite-col1/note-scripts',
    name: 'Note Scripts',
    url: 'grpc.openheaders.io:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetNote' },
    message: '{"text":"hi"}',
    metadata: [{ uid: 'm1', key: 'x-tenant', value: 'acme' }],
    specLink: { specUid: SPEC.uid },
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

/** The unary leg's transport — answers one framed reply. */
function unaryTransport(
  reply: (request: GrpcTransportRequest) => GrpcTransportResponse | Promise<GrpcTransportResponse>,
): { transport: GrpcTransport; wire: () => GrpcTransportRequest } {
  let seen: GrpcTransportRequest | null = null;
  return {
    transport: {
      invoke: (request) => {
        seen = request;
        return Promise.resolve(reply(request));
      },
    },
    wire: () => {
      if (seen === null) throw new Error('invoke never reached the transport');
      return seen;
    },
  };
}

const framedReply = (texts: string[], trailers = [{ key: 'grpc-status', value: '0' }]): GrpcTransportResponse => {
  const frames = texts.map((text) => writeGrpcFrame(encodedNote(text)));
  const body = new Uint8Array(frames.reduce((n, f) => n + f.byteLength, 0));
  let offset = 0;
  for (const frame of frames) {
    body.set(frame, offset);
    offset += frame.byteLength;
  }
  return { httpStatus: 200, headers: [{ key: 'x-probe', value: '1' }], trailers, body, bodyTruncated: false };
};

/** The streaming leg's transport — the server side of the rig. */
function streamTransport() {
  let callbacks: GrpcStreamCallbacks | null = null;
  const sentUp: Uint8Array[] = [];
  const transport: GrpcTransport = {
    invoke: () => Promise.reject(new Error('unary invoke not expected')),
    openStream(_request, cb) {
      callbacks = cb;
      return { sendMessage: (message) => sentUp.push(message), halfClose: () => {} };
    },
  };
  return {
    transport,
    sentUp,
    cb: (): GrpcStreamCallbacks => {
      if (!callbacks) throw new Error('openStream not called');
      return callbacks;
    },
  };
}

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const COLLECTION_LEVEL = (scripts: GrpcRequest['scripts']) => ({
  level: 'collection' as const,
  label: "Collection 'Library'",
  entity: { uid: 'col1', name: 'Library', scripts },
});

describe('executeGrpcInvoke — Before invoke', () => {
  it('rewrites the metadata and the message before the wire, ancestors first; the credential mints onto the rows it leaves', async () => {
    const host = scriptedHost({
      'col();': (input) =>
        ok({
          sessionMutation: {
            kind: 'grpc-invoke',
            metadata: [
              ...(input.hook.kind === 'grpc-before-invoke' ? input.hook.invoke.metadata : []),
              { key: 'x-trace', value: 't-1' },
            ],
          },
        }),
      'req();': (input) =>
        ok({
          sessionMutation: {
            kind: 'grpc-invoke',
            messageText: JSON.stringify({
              text: input.hook.kind === 'grpc-before-invoke' ? `${input.hook.invoke.metadata.length} rows` : '?',
            }),
          },
        }),
    });
    const rig = unaryTransport(() => framedReply(['reply']));
    const snapshot = await executeGrpcInvoke(
      makeGrpcRequest({ auth: { type: 'bearer', token: 'mine' }, scripts: { 'grpc-before-invoke': 'req();' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        spec: SPEC,
        sendId: 'send-gscr-1',
        scriptChain: [COLLECTION_LEVEL({ 'grpc-before-invoke': 'col();' })],
        scriptHost: host.host,
      },
    );
    // The chain's rows, then the credential minted onto them.
    expect(rig.wire().metadata).toEqual([
      { key: 'x-tenant', value: 'acme' },
      { key: 'x-trace', value: 't-1' },
      { key: 'authorization', value: 'Bearer mine' },
    ]);
    // The request level saw the collection level's row — the message
    // it composed encodes as the rpc's input type.
    expect([...rig.wire().message]).toEqual([...encodedNote('2 rows')]);
    // The hook saw the call as composed: no credential yet.
    const first = host.ran[0]?.hook;
    expect(first?.kind === 'grpc-before-invoke' ? first.invoke : null).toEqual({
      target: 'grpc.openheaders.io:443',
      service: 'library.v1.Library',
      method: 'GetNote',
      shape: 'unary',
      metadata: [{ key: 'x-tenant', value: 'acme' }],
      messageText: '{"text":"hi"}',
    });
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.scripts).toMatchObject({ mode: 'safe', beforeInvoke: { succeeded: true } });
    expect(snapshot.scripts?.beforeInvoke?.chain.map((s) => [s.level, s.name])).toEqual([
      ['collection', 'Library'],
      ['request', 'Note Scripts'],
    ]);
    expect(snapshot.scriptMarks?.map((m) => [m.hook, m.atIndex])).toEqual([['grpc-before-invoke', 0]]);
    expect(host.ended).toEqual(['send-gscr-1']);
  });

  it('a Before invoke failure is recorded and the call proceeds unmutated; a reserved key a level wrote stays the transport’s', async () => {
    const host = scriptedHost({
      'boom();': () => ok({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
      'te();': () => ok({ sessionMutation: { kind: 'grpc-invoke', metadata: [{ key: 'te', value: 'trailers' }] } }),
    });
    const rig = unaryTransport(() => framedReply(['reply']));
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ scripts: { 'grpc-before-invoke': 'boom();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      scriptChain: [],
      scriptHost: host.host,
    });
    expect(rig.wire().metadata).toEqual([{ key: 'x-tenant', value: 'acme' }]);
    expect(snapshot.scripts?.beforeInvoke).toMatchObject({ succeeded: false, error: { message: 'boom' } });

    const reserved = unaryTransport(() => framedReply(['reply']));
    await executeGrpcInvoke(makeGrpcRequest({ scripts: { 'grpc-before-invoke': 'te();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: reserved.transport,
      spec: SPEC,
      scriptChain: [],
      scriptHost: host.host,
    });
    expect(reserved.wire().metadata).toEqual([]);
  });

  it('a message a level rewrote to invalid JSON fails before the wire and still carries the record', async () => {
    const host = scriptedHost({
      'bad();': () => ok({ sessionMutation: { kind: 'grpc-invoke', messageText: '{not json' } }),
    });
    let dialed = false;
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ scripts: { 'grpc-before-invoke': 'bad();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: {
        invoke: () => {
          dialed = true;
          return Promise.reject(new Error('never'));
        },
      },
      spec: SPEC,
      scriptChain: [],
      scriptHost: host.host,
    });
    expect(dialed).toBe(false);
    expect(snapshot.error).toContain('not valid JSON');
    expect(snapshot.scripts?.beforeInvoke?.succeeded).toBe(true);
    expect(snapshot.scriptMarks).toHaveLength(1);
    expect(host.ended).toHaveLength(1);
  });
});

describe('executeGrpcInvoke — On message and After response (unary)', () => {
  it('runs On message per reply frame with the decoded message, then After response with the status and counts', async () => {
    const host = scriptedHost({
      'msg();': (input) => {
        const message = input.hook.kind === 'grpc-on-message' ? input.hook.message : null;
        return ok({
          consoleLog: [{ level: 'log', args: [JSON.stringify(message?.value), message?.type ?? ''], timeMs: 0 }],
        });
      },
      'done();': (input) =>
        ok({
          assertions: [
            { name: 'ok', passed: input.hook.kind === 'grpc-after-response' && input.hook.response.status === 0 },
          ],
        }),
    });
    const rig = unaryTransport(() =>
      framedReply(
        ['one', 'two'],
        [
          { key: 'grpc-status', value: '0' },
          { key: 'x-id', value: '9' },
        ],
      ),
    );
    const snapshot = await executeGrpcInvoke(
      makeGrpcRequest({ scripts: { 'grpc-on-message': 'msg();', 'grpc-after-response': 'done();' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        spec: SPEC,
        sendId: 'send-gscr-2',
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    expect(host.ran.map((r) => r.kind)).toEqual(['grpc-on-message', 'grpc-on-message', 'grpc-after-response']);
    const frames = host.ran.filter((r) => r.kind === 'grpc-on-message').map((r) => r.hook);
    expect(
      frames.map((f) =>
        f.kind === 'grpc-on-message' ? [f.message.direction, f.message.index, f.message.value] : null,
      ),
    ).toEqual([
      ['down', 0, { text: 'one' }],
      ['down', 1, { text: 'two' }],
    ]);
    const response = host.ran[2]?.hook;
    expect(response?.kind === 'grpc-after-response' ? response.response : null).toMatchObject({
      httpStatus: 200,
      status: 0,
      statusSource: 'trailers',
      headers: [{ key: 'x-probe', value: '1' }],
      trailers: [
        { key: 'grpc-status', value: '0' },
        { key: 'x-id', value: '9' },
      ],
      sent: 1,
      received: 2,
      stopped: false,
    });
    expect(snapshot.scripts?.onMessage).toMatchObject({ runs: 2, failed: 0 });
    expect(snapshot.scripts?.afterResponse).toMatchObject({
      succeeded: true,
      assertions: [{ name: 'ok', passed: true }],
    });
    // The buffered reply captured both frames at once — every mark
    // lands past them.
    expect(snapshot.scriptMarks?.map((m) => [m.hook, m.atIndex])).toEqual([
      ['grpc-on-message', 2],
      ['grpc-on-message', 2],
      ['grpc-after-response', 2],
    ]);
    expect(snapshot.scriptMarks?.[0]?.consoleLog).toEqual([
      { level: 'log', args: ['{"text":"one"}', NOTE], timeMs: 0 },
    ]);
    expect(host.ended).toEqual(['send-gscr-2']);
  });

  it('a dial that never produced a head runs no After response and still carries the Before invoke record', async () => {
    const host = scriptedHost({});
    const snapshot = await executeGrpcInvoke(
      makeGrpcRequest({ scripts: { 'grpc-before-invoke': 'x();', 'grpc-after-response': 'y();' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: { invoke: () => Promise.reject(new Error('Connection refused by grpc.openheaders.io:443.')) },
        spec: SPEC,
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    expect(snapshot.error).toContain('Connection refused');
    expect(host.ran.map((r) => r.kind)).toEqual(['grpc-before-invoke']);
    expect(snapshot.scripts?.afterResponse).toBeUndefined();
    expect(snapshot.scriptMarks).toHaveLength(1);
    expect(host.ended).toHaveLength(1);
  });
});

describe('executeGrpcInvoke — the streaming leg', () => {
  it('runs On message on the upstream writes and the downstream frames, After response at settle, and emits the marks live', async () => {
    const fake = streamTransport();
    const host = scriptedHost({
      'msg();': (input) => {
        const message = input.hook.kind === 'grpc-on-message' ? input.hook.message : null;
        return ok({
          consoleLog: [{ level: 'log', args: [message?.direction ?? '', JSON.stringify(message?.value)], timeMs: 0 }],
        });
      },
    });
    const events: GrpcStreamEventWire[] = [];
    const settled = executeGrpcInvoke(
      makeGrpcRequest({
        method: { service: 'library.v1.Library', rpc: 'Chat' },
        scripts: { 'grpc-before-invoke': 'x();', 'grpc-on-message': 'msg();', 'grpc-after-response': 'y();' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: fake.transport,
        spec: SPEC,
        sendId: 'send-gscr-3',
        emitStreamEvent: (event) => events.push(event),
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    await settleTick();
    // The rider writes upstream — no hook on the send itself, On
    // message after its capture.
    expect(sendActiveGrpcStreamMessage('send-gscr-3', '{"text":"ping"}')).toEqual({ success: true });
    // The hook finishes before the next frame arrives — its mark lands
    // at position 1 (a frame captured meanwhile would move it).
    await settleTick();
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onData(writeGrpcFrame(encodedNote('pong')));
    await settleTick();
    cb.onTrailers([{ key: 'grpc-status', value: '0' }]);
    cb.onEnd();
    const snapshot = await settled;
    expect(host.ran.map((r) => r.kind)).toEqual([
      'grpc-before-invoke',
      'grpc-on-message',
      'grpc-on-message',
      'grpc-after-response',
    ]);
    const frames = host.ran.filter((r) => r.kind === 'grpc-on-message').map((r) => r.hook);
    expect(
      frames.map((f) =>
        f.kind === 'grpc-on-message' ? [f.message.direction, f.message.index, f.message.value] : null,
      ),
    ).toEqual([
      ['up', 0, { text: 'ping' }],
      ['down', 1, { text: 'pong' }],
    ]);
    const response = host.ran[3]?.hook;
    expect(response?.kind === 'grpc-after-response' ? response.response : null).toMatchObject({
      status: 0,
      sent: 1,
      received: 1,
      stopped: false,
    });
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up', 'down']);
    expect(snapshot.scripts).toMatchObject({
      beforeInvoke: { succeeded: true },
      onMessage: { runs: 2 },
      afterResponse: { succeeded: true },
    });
    expect(snapshot.scriptMarks?.map((m) => [m.hook, m.atIndex])).toEqual([
      ['grpc-before-invoke', 0],
      ['grpc-on-message', 1],
      ['grpc-on-message', 2],
      ['grpc-after-response', 2],
    ]);
    // The marks rode the live feed: the Before invoke mark replayed
    // once the emitter existed, the rest as they landed, the After
    // response mark before the end frame.
    expect(events.map((e) => (e.kind === 'script' ? `script:${e.mark.hook}` : e.kind))).toEqual([
      'sent',
      'script:grpc-before-invoke',
      'messages',
      'script:grpc-on-message',
      'head',
      'messages',
      'script:grpc-on-message',
      'script:grpc-after-response',
      'end',
    ]);
    expect(host.ended).toEqual(['send-gscr-3']);
  });

  it('a stream that never produced a head settles without After response', async () => {
    const fake = streamTransport();
    const host = scriptedHost({});
    const settled = executeGrpcInvoke(
      makeGrpcRequest({
        method: { service: 'library.v1.Library', rpc: 'Chat' },
        scripts: { 'grpc-after-response': 'y();' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: fake.transport,
        spec: SPEC,
        sendId: 'send-gscr-4',
        scriptChain: [],
        scriptHost: host.host,
      },
    );
    await settleTick();
    fake.cb().onEnd({ name: 'GrpcTransportError', message: 'Connection refused.' } as GrpcTransportError);
    const snapshot = await settled;
    expect(snapshot.error).toBe('Connection refused.');
    expect(host.ran).toHaveLength(0);
    expect(snapshot.scripts).toBeUndefined();
    expect(host.ended).toEqual(['send-gscr-4']);
  });
});

describe('executeGrpcInvoke — scriptless', () => {
  it('a scriptless request, or a host without scripts, records nothing', async () => {
    const host = scriptedHost({});
    const rig = unaryTransport(() => framedReply(['reply']));
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      scriptChain: [],
      scriptHost: host.host,
    });
    expect(snapshot.scripts).toBeUndefined();
    expect(snapshot.scriptMarks).toBeUndefined();
    expect(host.ran).toHaveLength(0);
    expect(host.ended).toEqual([]);

    const noHost = unaryTransport(() => framedReply(['reply']));
    const bare = await executeGrpcInvoke(makeGrpcRequest({ scripts: { 'grpc-after-response': 'x();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: noHost.transport,
      spec: SPEC,
      scriptChain: [],
    });
    expect(bare.scripts).toBeUndefined();
  });
});
