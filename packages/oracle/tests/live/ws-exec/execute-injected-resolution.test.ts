/**
 * WS executor — the host-injected resolution seam
 * (`ExecuteWsSessionOptions.resolution`): the page-realm surfaces'
 * path, where the oracle module mirrors are empty and the caller's
 * closure carries the whole scope. Pins that the injected function
 * resolves the Connect-time templates (url / headers / params), that
 * an unresolved reference gates the session as a structured error
 * snapshot naming it, and that per-send riders resolve through the
 * SAME closure — an unresolved rider ref failing the rider alone.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-1',
    path: 'requests/suite-col1/probe-ws1',
    name: 'Probe WS',
    flavor: 'raw',
    url: 'wss://{{host}}/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

/** Scope the injected closure carries — a two-name vocabulary. */
const SCOPE: Record<string, string> = {
  host: 'echo.openheaders.io',
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

/** Scripted transport capturing the wire request and exposing the
 *  callbacks so the test drives the session. */
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

describe('executeWsSession — injected resolution', () => {
  it('resolves url, headers and params through the injected closure — no oracle resolver', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        headers: [{ uid: 'h1', key: 'authorization', value: 'Bearer {{token}}' }],
        params: [{ uid: 'p1', key: 'room', value: '{{token}}' }],
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-inject-1',
        resolution: scopedResolution,
      },
    );
    // Let the executor reach the transport, then walk a clean session.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rig.wire().url).toBe('wss://echo.openheaders.io/live?room=tok-123');
    expect(rig.wire().headers).toEqual([{ key: 'authorization', value: 'Bearer tok-123' }]);
    rig.callbacks().onOpen('', '');
    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.error).toBeNull();
    expect(snapshot.connected).toBe(true);
  });

  it('gates an unresolved Connect-time reference as a structured error snapshot', async () => {
    const rig = scriptedTransport();
    const snapshot = await executeWsSession(makeWsRequest({ url: 'wss://{{missing_host}}/live' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-inject-2',
      resolution: scopedResolution,
    });
    expect(snapshot.connected).toBe(false);
    expect(snapshot.error).toContain('missing_host');
  });

  it('resolves per-send riders through the same closure and fails an unresolved rider alone', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-inject-3',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rig.callbacks().onOpen('', '');

    const ok = sendActiveWsSessionMessage('send-inject-3', 'auth {{token}}');
    expect(ok).toEqual({ success: true });
    expect(rig.sent).toEqual(['auth tok-123']);

    const bad = sendActiveWsSessionMessage('send-inject-3', 'auth {{nope}}');
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('nope');
    // The failed rider never reached the wire and the session is intact.
    expect(rig.sent).toEqual(['auth tok-123']);

    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.error).toBeNull();
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up']);
  });
});
