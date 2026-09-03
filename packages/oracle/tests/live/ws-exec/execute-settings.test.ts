/**
 * WS executor — the inherited settings: a knob the request leaves
 * absent reads the injected ancestor chain (the page-realm twin of
 * the tree-index walk) and reaches the transport's connect request;
 * the request's own knob shadows it; the Socket.IO handshake path
 * inherits like any other knob; the snapshot carries the ancestor-
 * supplied knobs in the WebSocket key order on the settled AND the
 * pre-wire failure paths.
 */

import type { SettingsCarrier } from '@openheaders/core/settings-inheritance';
import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-set-1',
    path: 'requests/suite-col1/probe-set1',
    name: 'Probe Settings',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

function plainResolution(template: string): string {
  return template;
}

function scriptedTransport(): {
  transport: WsTransport;
  wire: () => WsTransportRequest;
  callbacks: () => WsSessionCallbacks;
} {
  let seenRequest: WsTransportRequest | null = null;
  let seenCallbacks: WsSessionCallbacks | null = null;
  return {
    transport: {
      connect(request, callbacks) {
        seenRequest = request;
        seenCallbacks = callbacks;
        return { send: () => {}, close: () => callbacks.onEnd() };
      },
    },
    wire: () => {
      if (seenRequest === null) throw new Error('connect never reached the transport');
      return seenRequest;
    },
    callbacks: () => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      return seenCallbacks;
    },
  };
}

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const COLLECTION: SettingsCarrier = {
  level: 'collection',
  uid: 'rcol0001',
  name: 'Realtime',
  settings: {
    sslVerification: false,
    timeoutMs: 4_000,
    followRedirects: true,
    maxRedirects: 3,
    unixSocketPath: '/tmp/oh.sock',
    maxMessageBytes: 2_048,
    // An HTTP-only knob never reaches a WebSocket session.
    httpVersion: '2',
  },
};
const FOLDER: SettingsCarrier = { level: 'folder', uid: 'rfold001', name: 'Edge', settings: { timeoutMs: 9_000 } };

describe('executeWsSession — inherited settings', () => {
  it('the injected chain supplies every absent knob to the connect request; the innermost level wins; the snapshot attributes them', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-set-1',
      resolution: plainResolution,
      settingsChain: [COLLECTION, FOLDER],
    });
    await settleTick();
    const wire = rig.wire();
    expect(wire.sslVerification).toBe(false);
    expect(wire.timeoutMs).toBe(9_000);
    expect(wire.followRedirects).toBe(true);
    expect(wire.maxRedirects).toBe(3);
    expect(wire.unixSocketPath).toBe('/tmp/oh.sock');
    expect('httpVersion' in wire).toBe(false);
    rig.callbacks().onOpen('', '');
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'unixSocketPath', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
      { key: 'sslVerification', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
      { key: 'followRedirects', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
      { key: 'maxRedirects', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
      { key: 'timeoutMs', level: 'folder', uid: 'rfold001', name: 'Edge' },
      { key: 'maxMessageBytes', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
    ]);
  });

  it("the request's own knob shadows the chain's and drops out of the attribution", async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ timeoutMs: 1_000, sslVerification: true }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-set-2',
      resolution: plainResolution,
      settingsChain: [COLLECTION, FOLDER],
    });
    await settleTick();
    expect(rig.wire().timeoutMs).toBe(1_000);
    expect(rig.wire().sslVerification).toBe(true);
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.inheritedSettings?.map((s) => s.key)).toEqual([
      'unixSocketPath',
      'followRedirects',
      'maxRedirects',
      'maxMessageBytes',
    ]);
  });

  it('an inherited message cap ends the session on Message Too Big like the request’s own would', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-set-3',
      resolution: plainResolution,
      settingsChain: [{ ...COLLECTION, settings: { maxMessageBytes: 16 } }],
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage({ data: new Uint8Array(17), binary: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'maxMessageBytes', level: 'collection', uid: 'rcol0001', name: 'Realtime' },
    ]);
  });

  it('the Socket.IO handshake path inherits like any other knob', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ flavor: 'socketio', url: 'wss://events.openheaders.io' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-set-4',
      resolution: plainResolution,
      settingsChain: [{ ...COLLECTION, settings: { handshakePath: '/rt/' } }],
    });
    await settleTick();
    expect(rig.wire().url).toBe('wss://events.openheaders.io/rt/?EIO=4&transport=websocket');
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.inheritedSettings?.map((s) => s.key)).toEqual(['handshakePath']);
  });

  it('a pre-wire failure stamps the attribution too; no chain and no own knobs = no attribution', async () => {
    const rig = scriptedTransport();
    const failed = await executeWsSession(makeWsRequest({ url: '' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-set-5',
      resolution: plainResolution,
      settingsChain: [FOLDER],
    });
    expect(failed.outcome).toEqual({ kind: 'failed', error: 'URL is empty' });
    expect(failed.inheritedSettings).toEqual([{ key: 'timeoutMs', level: 'folder', uid: 'rfold001', name: 'Edge' }]);

    const bare = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: bare.transport,
      sendId: 'send-ws-set-6',
      resolution: plainResolution,
    });
    await settleTick();
    bare.callbacks().onEnd();
    expect((await settled).inheritedSettings).toBeUndefined();
  });
});
