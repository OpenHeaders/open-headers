/**
 * Boot-time wiring: the workbench page's MQTT session host — the
 * `install-ws-session-host` sibling for the MqttRequest plane. An MQTT
 * session is interactive and tab-scoped, and an MV3 service worker
 * idles out under an open socket, so ws(s):// sessions execute IN this
 * page realm: the host-neutral `executeMqttSession` spine (pre-wire
 * gates, CONNACK-gated driver, rolling retention, rider registry, Stop
 * hook) over the browser MQTT-over-WebSocket transport, with template
 * resolution injected from the renderer scopes the editor publishes
 * (`mqtt-page-session.ts` — the oracle module mirrors are empty in a
 * page realm). mqtt(s):// tcp schemes stay node-only — the editor's
 * Connect gate names that limit, and the transport refuses honestly if
 * a template resolves to one.
 *
 * Wiring shape: a {@link HostBridge} DECORATOR over the CURRENT bridge
 * — the ws session host installed just before this module, so the
 * chain keeps its channels (and its `abortRequestSend` leg, whose
 * shared active-send registry already covers MQTT Stops). The four
 * MQTT channels (`executeMqttRequest` draft path, `publishMqttMessage`,
 * `setMqttSubscription`, `closeMqttSession`, `reconnectMqttSessionNow`)
 * answer locally, and
 * `mqttStreamEvent` subscribers are fed synchronously from the in-page
 * emitter — no broadcast hop, so the editor and `useLiveMqttSession`
 * ride the exact code paths the node hosts answer. Every other channel
 * delegates untouched.
 *
 * Import AFTER `install-ws-session-host` — this module re-installs the
 * bridge with the decorated instance. It also registers the
 * `mqttPageSession` capability (the editor's Connect gate + honesty
 * notice), the install-ws-session-host co-location precedent.
 */

import {
  type BridgeBroadcastPayload,
  type BridgeBroadcastType,
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  getHostBridge,
  type HostBridge,
  type MqttStreamEventWire,
  setHostBridge,
} from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { errorMqttSnapshot, executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import {
  closeActiveMqttSession,
  publishActiveMqttMessage,
  reconnectActiveMqttSessionNow,
  setActiveMqttSubscription,
} from '@openheaders/oracle/live/mqtt-exec/session-plane';
import { createBrowserMqttTransport } from '@openheaders/oracle-host-browser/live/browser-mqtt-transport';
import { getMqttPageResolutionFactory } from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-page-session';

// The ws session host's decorated bridge — installed by the import
// order above; everything this module does not answer delegates to it.
const baseBridge = getHostBridge();
if (baseBridge === null) {
  throw new Error('install-mqtt-session-host: no host bridge installed — import after install-ws-session-host.');
}
const base: HostBridge = baseBridge;

// Stateless — one stream per session (the node handler's symmetry).
const browserMqttTransport = createBrowserMqttTransport();

/** In-page `mqttStreamEvent` fan-out — the emitter feeds these
 *  synchronously; batching already happened in the session plane. */
const mqttStreamSubscribers = new Set<(event: MqttStreamEventWire) => void>();

function deliverMqttStreamEventLocally(event: MqttStreamEventWire): void {
  for (const handler of mqttStreamSubscribers) handler(event);
}

async function handleExecuteMqttRequest(
  payload: BridgeRpcRequest<'executeMqttRequest'>,
): Promise<BridgeRpcResponse<'executeMqttRequest'>> {
  const draft = payload.draft;
  if (draft === undefined) {
    // The page host executes DRAFTS only — the editor always connects
    // its current compose state, so a uid-only call never originates
    // here (and this realm has no storage-slot entity read).
    return { success: false, error: 'The page-realm session host executes drafts only' };
  }
  const factory = getMqttPageResolutionFactory();
  if (factory === null) {
    // Unreachable through the UI — Connect lives in the editor whose
    // mount publishes the factory — but a missing scope must fail
    // structurally, never resolve templates as empty.
    return {
      success: true,
      snapshot: errorMqttSnapshot('The editor scope is not ready — reopen the MQTT request and try again.'),
    };
  }
  try {
    const resolution = await factory(draft);
    const snapshot = await executeMqttSession(draft, {
      workspaceId: null,
      environmentId: undefined,
      transport: browserMqttTransport,
      sendId: payload.sendId,
      emitStreamEvent: deliverMqttStreamEventLocally,
      resolution,
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

const mqttSessionHostBridge: HostBridge = {
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    if (type === 'executeMqttRequest') {
      const payload = args[0] as BridgeRpcRequest<'executeMqttRequest'>;
      return handleExecuteMqttRequest(payload) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'publishMqttMessage') {
      const payload = args[0] as BridgeRpcRequest<'publishMqttMessage'>;
      const result = publishActiveMqttMessage(payload.sendId, payload.message);
      return Promise.resolve(result) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'setMqttSubscription') {
      const payload = args[0] as BridgeRpcRequest<'setMqttSubscription'>;
      return setActiveMqttSubscription(payload.sendId, payload.subscription) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'closeMqttSession') {
      const payload = args[0] as BridgeRpcRequest<'closeMqttSession'>;
      return Promise.resolve({ success: closeActiveMqttSession(payload.sendId) }) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'reconnectMqttSessionNow') {
      const payload = args[0] as BridgeRpcRequest<'reconnectMqttSessionNow'>;
      return Promise.resolve({ success: reconnectActiveMqttSessionNow(payload.sendId) }) as Promise<
        BridgeRpcResponse<K>
      >;
    }
    return base.call(type, ...args);
  },
  broadcast: base.broadcast,
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    if (subscribedType === 'mqttStreamEvent') {
      const local = handler as (event: MqttStreamEventWire) => void;
      mqttStreamSubscribers.add(local);
      // Base passthrough kept — nothing broadcasts this channel from
      // the SW today, and a future forwarding leg lands without a
      // subscriber-side change.
      const unsubscribe = base.subscribe(subscribedType, handler);
      return () => {
        mqttStreamSubscribers.delete(local);
        unsubscribe();
      };
    }
    return base.subscribe(subscribedType, handler);
  },
  presence: base.presence,
};

setHostBridge(mqttSessionHostBridge);

registerCapability('mqttPageSession', () => true);
