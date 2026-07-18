/**
 * Boot-time wiring: the workbench page's WebSocket session host — the
 * extension's Phase D native posture. A WebSocket session is
 * interactive and tab-scoped, and an MV3 service worker idles out
 * under an open socket, so the session executes IN this page realm:
 * the host-neutral `executeWsSession` spine (pre-wire gates, rolling
 * retention, rider registry, Stop hook) over the browser-native
 * transport, with template resolution injected from the renderer
 * scopes the editor publishes (`ws-page-session.ts` — the oracle
 * module mirrors are empty in a page realm).
 *
 * Wiring shape: a {@link HostBridge} DECORATOR over the chrome
 * transport. The three WebSocket channels (`executeWebSocketRequest`
 * draft path, `sendWsMessage`, `closeWsSession`) answer locally, and
 * `wsStreamEvent` subscribers are fed synchronously from the in-page
 * emitter — no broadcast hop, so the editor, `RequestsContext`, and
 * `useLiveWsSession` ride the exact code paths the node hosts answer.
 * `abortRequestSend` tries the page-local active-send registry first
 * (the WS Stop hook) and falls through to the SW for HTTP sends.
 * Every other channel delegates untouched.
 *
 * Import AFTER `install-host-bridge` — this module re-installs the
 * bridge with the decorated instance. It also registers the
 * `wsPageSession` capability (the editor's Connect gate + honesty
 * notice), the install-cdp-capability co-location precedent.
 */

import {
  type BridgeBroadcastPayload,
  type BridgeBroadcastType,
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  type HostBridge,
  setHostBridge,
  type WsStreamEventWire,
} from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { errorWsSnapshot, executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { closeActiveWsSession, sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import { createBrowserWsTransport } from '@openheaders/oracle-host-browser/live/browser-ws-transport';
import { getWsPageResolutionFactory } from '@openheaders/ui/workbench/components/websocket-request-editor/ws-page-session';
import { chromeBridge } from '@/utils/bridge';

// Stateless — one socket per session (the node handler's symmetry).
const browserWsTransport = createBrowserWsTransport();

/** In-page `wsStreamEvent` fan-out — the emitter feeds these
 *  synchronously; batching already happened in the session plane. */
const wsStreamSubscribers = new Set<(event: WsStreamEventWire) => void>();

function deliverWsStreamEventLocally(event: WsStreamEventWire): void {
  for (const handler of wsStreamSubscribers) handler(event);
}

async function handleExecuteWebSocketRequest(
  payload: BridgeRpcRequest<'executeWebSocketRequest'>,
): Promise<BridgeRpcResponse<'executeWebSocketRequest'>> {
  const draft = payload.draft;
  if (draft === undefined) {
    // The page host executes DRAFTS only — the editor always connects
    // its current compose state, so a uid-only call never originates
    // here (and this realm has no storage-slot entity read).
    return { success: false, error: 'The page-realm session host executes drafts only' };
  }
  const factory = getWsPageResolutionFactory();
  if (factory === null) {
    // Unreachable through the UI — Connect lives in the editor whose
    // mount publishes the factory — but a missing scope must fail
    // structurally, never resolve templates as empty.
    return {
      success: true,
      snapshot: errorWsSnapshot('The editor scope is not ready — reopen the WebSocket request and try again.'),
    };
  }
  try {
    const resolution = await factory(draft);
    const snapshot = await executeWsSession(draft, {
      workspaceId: null,
      environmentId: undefined,
      transport: browserWsTransport,
      sendId: payload.sendId,
      emitStreamEvent: deliverWsStreamEventLocally,
      resolution,
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

const wsSessionHostBridge: HostBridge = {
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    if (type === 'executeWebSocketRequest') {
      const payload = args[0] as BridgeRpcRequest<'executeWebSocketRequest'>;
      return handleExecuteWebSocketRequest(payload) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'sendWsMessage') {
      const payload = args[0] as BridgeRpcRequest<'sendWsMessage'>;
      const result = sendActiveWsSessionMessage(payload.sendId, payload.messageText);
      return Promise.resolve(result) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'closeWsSession') {
      const payload = args[0] as BridgeRpcRequest<'closeWsSession'>;
      return Promise.resolve({ success: closeActiveWsSession(payload.sendId) }) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'abortRequestSend') {
      const payload = args[0] as BridgeRpcRequest<'abortRequestSend'>;
      if (stopActiveSend(payload.sendId)) {
        return Promise.resolve({ success: true }) as Promise<BridgeRpcResponse<K>>;
      }
      // Not a page-local send — an HTTP exchange executing in the SW.
    }
    return chromeBridge.call(type, ...args);
  },
  broadcast: chromeBridge.broadcast,
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    if (subscribedType === 'wsStreamEvent') {
      const local = handler as (event: WsStreamEventWire) => void;
      wsStreamSubscribers.add(local);
      // Chrome passthrough kept — nothing broadcasts this channel from
      // the SW today, and a future forwarding leg lands without a
      // subscriber-side change.
      const unsubscribe = chromeBridge.subscribe(subscribedType, handler);
      return () => {
        wsStreamSubscribers.delete(local);
        unsubscribe();
      };
    }
    return chromeBridge.subscribe(subscribedType, handler);
  },
  presence: chromeBridge.presence,
};

setHostBridge(wsSessionHostBridge);

registerCapability('wsPageSession', () => true);
