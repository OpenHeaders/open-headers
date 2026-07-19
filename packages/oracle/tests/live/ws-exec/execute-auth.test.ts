/**
 * WS executor — the session credential (Phase G auth block): the
 * bearer token resolves with the Connect-time templates and injects
 * `Authorization: Bearer <token>` into the handshake headers; an
 * explicit user Authorization row takes precedence (the gRPC auth
 * law); an unresolved token gates the session as a structured error;
 * and the socketio flavor ALSO lands the token as the CONNECT
 * packet's auth payload — in-band framing captured verbatim.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-auth-1',
    path: 'requests/suite-col1/probe-auth1',
    name: 'Probe Auth',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const SCOPE: Record<string, string> = {
  token: 'tok-123',
};

function scopedResolution(template: string, unresolved: Set<string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const value = SCOPE[name.trim()];
    if (value === undefined) {
      unresolved.add(name.trim());
      return whole;
    }
    return value;
  });
}

function scriptedTransport(): {
  transport: WsTransport;
  wire: () => WsTransportRequest;
  callbacks: () => WsSessionCallbacks;
  sent: string[];
} {
  let seenRequest: WsTransportRequest | null = null;
  let seenCallbacks: WsSessionCallbacks | null = null;
  const sent: string[] = [];
  return {
    transport: {
      connect(request, callbacks) {
        seenRequest = request;
        seenCallbacks = callbacks;
        return {
          send: (text) => sent.push(text),
          close: () => callbacks.onEnd(),
        };
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
    sent,
  };
}

const textFrame = (text: string): { data: Uint8Array; binary: boolean } => ({
  data: new TextEncoder().encode(text),
  binary: false,
});

async function settleTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('executeWsSession — session credential', () => {
  it('injects the resolved bearer token as the Authorization handshake header', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '{{token}}' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-1',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onEnd();
    await settled;
  });

  it('lets an explicit user Authorization row take precedence over the credential', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        auth: { type: 'bearer', token: 'ignored' },
        headers: [{ uid: 'h1', key: 'Authorization', value: 'Basic abc' }],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-auth-2',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Basic abc' }]);
    rig.callbacks().onEnd();
    await settled;
  });

  it('reads an empty resolved token as none and gates an unresolved one as a structured error', async () => {
    const emptyRig = scriptedTransport();
    const emptySettled = executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '   ' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: emptyRig.transport,
      sendId: 'send-auth-3a',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(emptyRig.wire().headers).toEqual([]);
    emptyRig.callbacks().onEnd();
    await emptySettled;

    const unresolvedRig = scriptedTransport();
    const snapshot = await executeWsSession(makeWsRequest({ auth: { type: 'bearer', token: '{{missing}}' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: unresolvedRig.transport,
      sendId: 'send-auth-3b',
      resolution: scopedResolution,
    });
    expect(snapshot.connected).toBe(false);
    expect(snapshot.error).toContain('missing');
  });

  it('lands the token as the socketio CONNECT auth payload alongside the header', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        flavor: 'socketio',
        url: 'ws://echo.openheaders.io',
        namespace: 'probe',
        auth: { type: 'bearer', token: '{{token}}' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-auth-4',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(rig.sent).toEqual(['40/probe,{"token":"tok-123"}']);
    rig.callbacks().onEnd();
    await settled;
  });

  it('sends the plain CONNECT when no credential is configured', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ flavor: 'socketio', url: 'ws://echo.openheaders.io' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-auth-5',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(rig.sent).toEqual(['40']);
    rig.callbacks().onEnd();
    await settled;
  });
});
