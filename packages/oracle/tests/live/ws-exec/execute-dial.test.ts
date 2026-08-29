/**
 * WS executor — the dial policy: every knob the request sets reaches
 * the transport on the connect request, the credential ref bare under
 * a host-injected resolution (no vault to resolve it against), and the
 * transport-reported route recorded verbatim on the snapshot — the
 * request plane included.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-dial-1',
    path: 'requests/suite-col1/probe-dial1',
    name: 'Probe Dial',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
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

describe('executeWsSession — dial policy', () => {
  it('hands every dial knob to the transport; the credential ref passes bare without a vault', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        resolveToAddress: '10.0.0.12',
        proxyMode: 'url',
        proxyUrl: 'http://proxy.openheaders.io:8080',
        proxyCredentialRef: 'corp-proxy',
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-ws-dial',
        resolution: (template) => template,
      },
    );
    await settleTick();
    const wire = rig.wire();
    expect(wire.resolveToAddress).toBe('10.0.0.12');
    expect(wire.proxyMode).toBe('url');
    expect(wire.proxyUrl).toBe('http://proxy.openheaders.io:8080');
    expect(wire.proxyCredentialRef).toBe('corp-proxy');
    expect(wire.proxyCredential).toBeUndefined();
    rig.callbacks().onOpen('', '', { plane: 'request', proxyUrl: 'http://proxy.openheaders.io:8080' });
    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.proxyRoute).toEqual({ plane: 'request', proxyUrl: 'http://proxy.openheaders.io:8080' });
  });

  it('a default request hands no dial knob at all — the transport inherits the host planes', async () => {
    const rig = scriptedTransport();
    void executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-dial-2',
      resolution: (template) => template,
    });
    await settleTick();
    const wire = rig.wire();
    expect('resolveToAddress' in wire).toBe(false);
    expect('proxyMode' in wire).toBe(false);
    expect('proxyUrl' in wire).toBe(false);
    rig.callbacks().onEnd();
  });
});
