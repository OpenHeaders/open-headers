/**
 * The web tab's own sessions (Phase W) — the tab's seam into the
 * shared session route: the tab owns exactly the three Connects and
 * the seven riders; every session leases the delegating transport
 * toward the serving daemon over the tab's socket wire with the
 * route's read workspace as the gate's subject, whatever place the
 * frame names; the OAuth renewal dials through the tab's delegating
 * HTTP leg with the tab's jar; the live frames fan out on the in-tab
 * broadcast; the session's hooks resolve through the one host-neutral
 * capability gate (the tab's Safe sandbox, registered at boot); a
 * Connect reaches the shared route with the tab's seam; a rider on an
 * unknown id answers honestly.
 */

import type { MqttStreamEventWire, WsStreamEventWire } from '@openheaders/core/bridge';
import { DELEGATE_MQTT_OPEN_CHANNEL, DELEGATE_WS_OPEN_CHANNEL } from '@openheaders/core/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  transports: [] as unknown[],
  routed: [] as { route: string; message: unknown; host: unknown }[],
}));

vi.mock('@openheaders/oracle/live/request-exec/delegating-transport', () => ({
  createDelegatingRequestTransport: (options: unknown) => {
    h.transports.push(options);
    return { send: async () => ({}) };
  },
}));
vi.mock('@openheaders/oracle/live/session-route/ws-route', () => ({
  executeWebSocketRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'ws', message, host });
    return { success: true };
  },
  executeGraphqlSubscriptionRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'graphql', message, host });
    return { success: true };
  },
}));
vi.mock('@openheaders/oracle/live/session-route/mqtt-route', () => ({
  executeMqttRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'mqtt', message, host });
    return { success: true };
  },
}));

import { cookieJarFor } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { resolveSessionScriptHost } from '@openheaders/oracle/live/script-host/capability';
import { webDelegatedWire } from '@/host/delegated-wire';
import { dispatchTabSessionsRpc, isTabSessionsChannel, webSessionRouteHost } from '@/host/tab-sessions-rpc';
import { subscribeLocal } from '@/host/web-broadcast';
import { setWireRpcSender } from '@/host/wire-rpc';

const WS_REQUEST = { url: 'wss://echo.openheaders.io/ws', headers: [], subprotocols: [] };
const MQTT_REQUEST = { url: 'mqtts://broker.openheaders.io:8883' };

const noop = (): void => {};

describe('tab-sessions-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeEach(() => {
    sent = [];
    h.transports = [];
    h.routed = [];
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it('owns exactly the three Connects and the seven riders', () => {
    for (const type of [
      'executeWebSocketRequest',
      'executeGraphqlSubscription',
      'executeMqttRequest',
      'sendWsMessage',
      'closeWsSession',
      'reconnectWsSessionNow',
      'publishMqttMessage',
      'setMqttSubscription',
      'closeMqttSession',
      'reconnectMqttSessionNow',
    ]) {
      expect(isTabSessionsChannel(type)).toBe(true);
    }
    expect(isTabSessionsChannel('executeRequest')).toBe(false);
    expect(isTabSessionsChannel('abortRequestSend')).toBe(false);
    expect(isTabSessionsChannel(undefined)).toBe(false);
  });

  it('leases the delegating transports toward the serving daemon whatever place the frame names, the read workspace as the gate subject', async () => {
    const ws = webSessionRouteHost.wsTransportFor('some-other-backend', 'ws-tab');
    expect(ws.executedOn()).toBeNull();
    ws.transport.connect(WS_REQUEST, { onOpen: noop, onMessage: noop, onClose: noop, onEnd: noop });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: DELEGATE_WS_OPEN_CHANNEL, workspaceId: 'ws-tab', request: WS_REQUEST });

    const mqtt = webSessionRouteHost.mqttTransportFor(undefined, 'ws-tab');
    mqtt.transport.connect(MQTT_REQUEST, { onConnect: noop, onData: noop, onEnd: noop });
    await Promise.resolve();
    expect(sent[1]).toMatchObject({ type: DELEGATE_MQTT_OPEN_CHANNEL, workspaceId: 'ws-tab', request: MQTT_REQUEST });
  });

  it('renews OAuth through the tab delegating HTTP leg with the tab jar, and resolves the hooks through the shared capability gate', () => {
    expect(webSessionRouteHost.refreshTransportFor).toBeDefined();
    webSessionRouteHost.refreshTransportFor?.('ws-tab');
    expect(h.transports[0]).toEqual({ wire: webDelegatedWire, workspaceId: 'ws-tab', jars: cookieJarFor });
    expect(webSessionRouteHost.resolveScriptHost).toBe(resolveSessionScriptHost);
  });

  it('fans the live frames out on the in-tab broadcast', () => {
    const ws: unknown[] = [];
    const mqtt: unknown[] = [];
    const releaseWs = subscribeLocal('wsStreamEvent', (event) => ws.push(event));
    const releaseMqtt = subscribeLocal('mqttStreamEvent', (event) => mqtt.push(event));
    const wsEvent: WsStreamEventWire = { sendId: 's-1', seq: 0, kind: 'open', protocol: '', extensions: '' };
    const mqttEvent: MqttStreamEventWire = {
      sendId: 's-2',
      seq: 0,
      kind: 'open',
      sessionPresent: false,
      reasonCode: 0,
      clientId: 'oh-tab',
    };
    webSessionRouteHost.emitWsStreamEvent(wsEvent);
    webSessionRouteHost.emitMqttStreamEvent(mqttEvent);
    expect(ws).toEqual([wsEvent]);
    expect(mqtt).toEqual([mqttEvent]);
    releaseWs();
    releaseMqtt();
  });

  it('routes each Connect to the shared route with the tab seam', async () => {
    await dispatchTabSessionsRpc('executeWebSocketRequest', { type: 'executeWebSocketRequest', sendId: 's-1' });
    await dispatchTabSessionsRpc('executeGraphqlSubscription', { type: 'executeGraphqlSubscription', sendId: 's-2' });
    await dispatchTabSessionsRpc('executeMqttRequest', { type: 'executeMqttRequest', sendId: 's-3' });
    expect(h.routed.map((r) => r.route)).toEqual(['ws', 'graphql', 'mqtt']);
    for (const r of h.routed) expect(r.host).toBe(webSessionRouteHost);
    expect((h.routed[0].message as { sendId: string }).sendId).toBe('s-1');
  });

  it('answers a rider on an unknown session honestly, never up the wire', async () => {
    const closed = await dispatchTabSessionsRpc('closeWsSession', { type: 'closeWsSession', sendId: 'gone' });
    expect(closed).toEqual({ success: false });
    const published = (await dispatchTabSessionsRpc('publishMqttMessage', {
      type: 'publishMqttMessage',
      sendId: 'gone',
      message: { topic: 't', payload: '' },
    })) as { success: boolean; error?: string };
    expect(published.success).toBe(false);
    expect(published.error).toContain('No open MQTT session');
    expect(sent).toHaveLength(0);
  });
});
