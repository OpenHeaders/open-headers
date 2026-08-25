/**
 * WS executor — the pre-open user abort: a Stop before the handshake
 * completed settles as the neutral `aborted` outcome, never a failure,
 * and carries no `stopped` mark (that field keeps its open-session
 * meaning — the MQTT executor's twin law).
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-1',
    path: 'requests/suite-col1/probe-ws1',
    name: 'Probe WS',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

/** Scripted transport capturing the wire request and exposing the
 *  callbacks so the test drives the session. */
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
        return {
          send: () => {},
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
  };
}

describe('executeWsSession — pre-open abort', () => {
  it('a Stop before the handshake completes settles as the aborted outcome, not a failure', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-abort',
      resolution: (template) => template,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Stop while still connecting — the handshake never completed; the
    // transport tears down on the abort signal.
    stopActiveSend('send-ws-abort');
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'aborted' });
    expect(snapshot.stopped).toBeUndefined();
    expect(snapshot.close).toBeNull();
  });
});
