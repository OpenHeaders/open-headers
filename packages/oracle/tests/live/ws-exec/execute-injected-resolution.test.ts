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
import {
  type WsSessionCallbacks,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it, vi } from 'vitest';

const TRUSTED_ROOT = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';
vi.mock('../../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: (workspaceId: string) => (workspaceId === 'ws-1' ? [TRUSTED_ROOT] : []),
}));
const DEVICE_PIN = '-----BEGIN CERTIFICATE-----\nPIN\n-----END CERTIFICATE-----\n';
const devicePems = vi.fn<() => string[]>(() => []);
vi.mock('../../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => devicePems(),
}));

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
  it('seats the workspace trusted roots on the dial for the pinned workspace, none without one', async () => {
    const rooted = scriptedTransport();
    const rootedRun = executeWsSession(makeWsRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: rooted.transport,
      sendId: 'send-inject-roots',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rooted.wire().trustedRootsPem).toEqual([TRUSTED_ROOT]);
    rooted.callbacks().onEnd();
    await rootedRun;

    const bare = scriptedTransport();
    const bareRun = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: bare.transport,
      sendId: 'send-inject-bare',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bare.wire().trustedRootsPem).toBeUndefined();
    bare.callbacks().onEnd();
    await bareRun;
  });

  it("this device's pins ride behind the workspace roots on the dial", async () => {
    devicePems.mockReturnValue([DEVICE_PIN]);
    const pinned = scriptedTransport();
    const pinnedRun = executeWsSession(makeWsRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: pinned.transport,
      sendId: 'send-device-pin',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pinned.wire().trustedRootsPem).toEqual([TRUSTED_ROOT, DEVICE_PIN]);
    pinned.callbacks().onEnd();
    await pinnedRun;
    devicePems.mockReturnValue([]);
  });

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
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
  });

  it('stamps the dialed url and the composed request headers on the open frame and the snapshot', async () => {
    const rig = scriptedTransport();
    const events: Array<{ kind: string; url?: string; requestHeaders?: Array<{ key: string; value: string }> }> = [];
    const settled = executeWsSession(
      makeWsRequest({
        subprotocols: ['chat.v2'],
        headers: [{ uid: 'h1', key: 'x-room', value: '{{token}}' }],
        auth: { type: 'bearer', token: '{{token}}' },
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-stamp-1',
        resolution: scopedResolution,
        emitStreamEvent: (event) => {
          if (event.kind === 'open')
            events.push({ kind: 'open', url: event.url, requestHeaders: event.requestHeaders });
        },
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    rig.callbacks().onOpen('chat.v2', '');
    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    const expectedHeaders = [
      { key: 'x-room', value: 'tok-123' },
      { key: 'Authorization', value: 'Bearer tok-123' },
      { key: 'Sec-WebSocket-Protocol', value: 'chat.v2' },
    ];
    expect(events).toEqual([{ kind: 'open', url: 'wss://echo.openheaders.io/live', requestHeaders: expectedHeaders }]);
    expect(snapshot.url).toBe('wss://echo.openheaders.io/live');
    expect(snapshot.requestHeaders).toEqual(expectedHeaders);
  });

  it("carries the transport's trust remedy and the attempted handshake on a pre-open failure", async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest({ subprotocols: ['chat.v2'] }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-trust-1',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const hint = {
      kind: 'trust-certificate' as const,
      host: 'echo.openheaders.io',
      port: 443,
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    };
    rig.callbacks().onEnd(new WsTransportError('TLS certificate error reaching echo.openheaders.io', hint));
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({
      kind: 'failed',
      error: 'TLS certificate error reaching echo.openheaders.io',
      hint,
    });
    expect(snapshot.url).toBe('wss://echo.openheaders.io/live');
    expect(snapshot.requestHeaders).toEqual([{ key: 'Sec-WebSocket-Protocol', value: 'chat.v2' }]);
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
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('missing_host');
  });

  it("stamps a transport-reported route as the system plane's wire truth", async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-inject-route',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rig.callbacks().onOpen('', '', { plane: 'system', proxyUrl: 'http://corp.openheaders.io:8080', source: 'system' });
    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.proxyRoute).toEqual({
      plane: 'system',
      proxyUrl: 'http://corp.openheaders.io:8080',
      source: 'system',
    });
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

    const ok = await sendActiveWsSessionMessage('send-inject-3', 'auth {{token}}');
    expect(ok).toEqual({ success: true });
    expect(rig.sent).toEqual(['auth tok-123']);

    const bad = await sendActiveWsSessionMessage('send-inject-3', 'auth {{nope}}');
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('nope');
    // The failed rider never reached the wire and the session is intact.
    expect(rig.sent).toEqual(['auth tok-123']);

    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up']);
  });
});

describe('executeWsSession — binary rider', () => {
  function binaryTransport(): ReturnType<typeof scriptedTransport> & { bytes: Uint8Array[] } {
    const bytes: Uint8Array[] = [];
    const base = scriptedTransport();
    const inner = base.transport;
    return {
      ...base,
      bytes,
      transport: {
        connect(request, callbacks, signal) {
          const writer = inner.connect(request, callbacks, signal);
          return { ...writer, sendBinary: (data: Uint8Array) => bytes.push(data) };
        },
      },
    };
  }

  it('decodes the spelling, writes one binary frame and records it as binary', async () => {
    const rig = binaryTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-binary-1',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rig.callbacks().onOpen('', '');

    expect(await sendActiveWsSessionMessage('send-binary-1', 'aGVs bG8=', undefined, { encoding: 'base64' })).toEqual({
      success: true,
    });
    expect(await sendActiveWsSessionMessage('send-binary-1', '68656c6c6f', undefined, { encoding: 'hex' })).toEqual({
      success: true,
    });
    expect(rig.bytes.map((b) => [...b])).toEqual([
      [104, 101, 108, 108, 111],
      [104, 101, 108, 108, 111],
    ]);
    expect(rig.sent).toEqual([]);

    const bad = await sendActiveWsSessionMessage('send-binary-1', 'aGVsbG8', undefined, { encoding: 'base64' });
    expect(bad.success).toBe(false);
    expect(bad.error).toContain('Base64');
    expect(rig.bytes).toHaveLength(2);

    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.messages.map((m) => [m.direction, m.binary])).toEqual([
      ['up', true],
      ['up', true],
    ]);
  });

  it('answers honestly on a transport without a binary writer', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-binary-2',
      resolution: scopedResolution,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    rig.callbacks().onOpen('', '');
    const result = await sendActiveWsSessionMessage('send-binary-2', 'aGVsbG8=', undefined, { encoding: 'base64' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('binary');
    expect(rig.sent).toEqual([]);
    rig.callbacks().onEnd();
    await settled;
  });
});
