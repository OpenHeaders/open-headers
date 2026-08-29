/**
 * WS executor — the TLS policy: every knob the request sets reaches the
 * transport on the connect request, the SNI override resolved through
 * the session scope, the certificate ref bare under a host-injected
 * resolution (no vault to resolve it against).
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-tls-1',
    path: 'requests/suite-col1/probe-tls1',
    name: 'Probe TLS',
    flavor: 'raw',
    url: 'wss://echo.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const SCOPE: Record<string, string> = { team: 'alpha' };

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

describe('executeWsSession — TLS policy', () => {
  it('hands every TLS knob to the transport; the SNI template resolves, the cert ref passes bare without a vault', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeWsRequest({
        sslVerification: false,
        clientCertificateRef: 'gateway-mtls',
        tlsMinVersion: '1.1',
        tlsMaxVersion: '1.2',
        tlsCipherSuites: 'AES128-SHA',
        sniServerName: 'edge-{{team}}.openheaders.io',
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-ws-tls',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire()).toMatchObject({
      sslVerification: false,
      clientCertificateRef: 'gateway-mtls',
      tlsMinVersion: '1.1',
      tlsMaxVersion: '1.2',
      tlsCipherSuites: 'AES128-SHA',
      sniServerName: 'edge-alpha.openheaders.io',
    });
    expect(rig.wire().clientCertificatePem).toBeUndefined();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onEnd();
    await settled;
  });

  it('a default request hands no TLS knob at all — the dial keeps its runtime defaults', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-ws-tls-default',
      resolution: scopedResolution,
    });
    await settleTick();
    const wire = rig.wire();
    for (const key of [
      'sslVerification',
      'clientCertificateRef',
      'tlsMinVersion',
      'tlsMaxVersion',
      'tlsCipherSuites',
      'sniServerName',
    ] as const) {
      expect(wire[key]).toBeUndefined();
    }
    rig.callbacks().onOpen('', '');
    rig.callbacks().onEnd();
    await settled;
  });
});
