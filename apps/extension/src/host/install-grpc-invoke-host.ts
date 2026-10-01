/**
 * Boot-time wiring: the workbench page's gRPC invoke host — the
 * extension's delegated gRPC leg (the Execution Place plan: the last
 * kind brought under "resolve here, the place opens the socket"). A
 * browser has no HTTP/2 stack that surfaces trailers, so the call's
 * WIRE opens on the place the reader resolved — the desktop app on
 * this device or the workspace's server — while the call's EXECUTOR
 * runs IN this page realm: the host-neutral `executeGrpcInvoke` spine
 * (the registry built from the linked spec the page holds, the
 * message encoded here, the pre-wire gates, the script hooks on this
 * page's sandbox, the capture and the snapshot) over the delegating
 * gRPC transport, with template resolution and the ancestor chains
 * injected from the renderer scopes the editor publishes
 * (`grpc-page-invoke.ts` — the oracle module mirrors are empty in a
 * page realm). The place resolves nothing: it receives the encoded
 * call and answers the raw reply, and no place at all answers the
 * honest snapshot (the reader disables Invoke first).
 *
 * Wiring shape: a {@link HostBridge} DECORATOR over the session hosts'
 * bridge (the MQTT host's idiom). `executeGrpcRequest` (draft path)
 * answers locally; the upstream riders `sendGrpcStreamMessage` /
 * `endGrpcClientStream` answer from the host-neutral active-stream
 * registry; `grpcStreamEvent` subscribers are fed synchronously from
 * the in-page emitter — no broadcast hop, so the editor and
 * `useLiveGrpcStream` ride the exact code paths the node hosts
 * answer; `abortRequestSend` tries the page-local active-send registry
 * first (the Stop hook of a call running here) and falls through for
 * the HTTP sends in the SW. Every other channel delegates untouched.
 *
 * Import AFTER `install-mqtt-session-host` — this module re-installs
 * the bridge with the decorated instance. It also registers the
 * `delegatedGrpcDispatch` capability (the reader's gRPC legs).
 */

import {
  type BridgeBroadcastPayload,
  type BridgeBroadcastType,
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  type GrpcStreamEventWire,
  getHostBridge,
  type HostBridge,
  setHostBridge,
} from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest } from '@openheaders/core/types';
import { createDelegatingGrpcTransport } from '@openheaders/oracle/live/grpc-exec/delegating-grpc-transport';
import { errorGrpcSnapshot, executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import {
  endActiveGrpcClientStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { getGrpcPageInvokeFactory } from '@openheaders/ui/workbench/components/grpc-request-editor/grpc-page-invoke';
import { pageDelegatedGrpcWireFor } from '@/host/delegated-grpc-wire';
import { getPageScriptHost, setPageScriptScope } from '@/host/page-script-host';

// The session hosts' decorated bridge — installed by the import order
// above; everything this module does not answer delegates to it.
const baseBridge = getHostBridge();
if (baseBridge === null) {
  throw new Error('install-grpc-invoke-host: no host bridge installed — import after install-mqtt-session-host.');
}
const base: HostBridge = baseBridge;

// The page realm's script runtime — the call's hooks run here, on the
// sandbox iframe this page mounts; null on Firefox (scriptless).
const pageScriptHost = getPageScriptHost();

/** In-page `grpcStreamEvent` fan-out — the emitter feeds these
 *  synchronously; batching already happened in the stream plane. */
const grpcStreamSubscribers = new Set<(event: GrpcStreamEventWire) => void>();

function deliverGrpcStreamEventLocally(event: GrpcStreamEventWire): void {
  for (const handler of grpcStreamSubscribers) handler(event);
}

/** The page realm executes DRAFTS only — the editor always invokes
 *  its current compose state, so a uid-only call never originates
 *  here (and this realm has no storage-slot entity read). */
const DRAFTS_ONLY = 'The page-realm invoke host executes drafts only';

async function runPageGrpcInvoke(
  draft: GrpcRequest,
  sendId: string | undefined,
  place: { backendId: string } | undefined,
): Promise<BridgeRpcResponse<'executeGrpcRequest'>> {
  const factory = getGrpcPageInvokeFactory();
  if (factory === null) {
    // Unreachable through the UI — Invoke lives in the editor whose
    // mount publishes the factory — but a missing scope must fail
    // structurally, never resolve templates as empty.
    return {
      success: true,
      snapshot: errorGrpcSnapshot('The editor scope is not ready — reopen the request and try again.'),
    };
  }
  if (place === undefined) {
    // The reader gates Invoke on a live leg; a frame that names none
    // reads as the honest state, never as a send from here.
    return {
      success: true,
      snapshot: errorGrpcSnapshot(
        'No connected place can open this call. Connect the desktop app or the workspace server.',
      ),
    };
  }
  try {
    const scope = await factory(draft);
    if (scope.workspaceId === null) {
      return {
        success: true,
        snapshot: errorGrpcSnapshot('No workspace is active — the call has nothing to run under.'),
      };
    }
    // The call's hooks answer their `oh.*` calls against this Invoke's
    // renderer scope.
    setPageScriptScope(scope.scripts);
    // The executor stays here — resolution, the registry, the encode,
    // scripts, capture, snapshot — over the delegating transport; the
    // named place opens the HTTP/2 session on this realm's behalf.
    const transport = createDelegatingGrpcTransport({
      wire: pageDelegatedGrpcWireFor(place.backendId),
      workspaceId: scope.workspaceId,
    });
    const snapshot = await executeGrpcInvoke(draft, {
      // The scope pin is moot here (resolution and the chains are
      // injected); the id names the token store an inherited OAuth 2.0
      // entry's bundle reads from.
      workspaceId: scope.workspaceId,
      environmentId: undefined,
      transport,
      spec: scope.spec,
      ...(sendId !== undefined ? { sendId } : {}),
      emitStreamEvent: deliverGrpcStreamEventLocally,
      resolution: scope.resolve,
      prepareResolution: scope.prepare,
      authChain: scope.authChain,
      settingsChain: scope.settingsChain,
      scriptChain: scope.scriptChain,
      ...(pageScriptHost !== null ? { scriptHost: pageScriptHost } : {}),
    });
    // The answering host's stamp — where the session opened.
    const executedOn = transport.executedOn();
    return { success: true, snapshot: executedOn !== null ? { ...snapshot, executedOn } : snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function handleExecuteGrpcRequest(
  payload: BridgeRpcRequest<'executeGrpcRequest'>,
): Promise<BridgeRpcResponse<'executeGrpcRequest'>> {
  if (payload.draft === undefined) return Promise.resolve({ success: false, error: DRAFTS_ONLY });
  return runPageGrpcInvoke(payload.draft, payload.sendId, payload.executionPlace);
}

const grpcInvokeHostBridge: HostBridge = {
  call<K extends BridgeRpcType>(
    type: K,
    ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
  ): Promise<BridgeRpcResponse<K>> {
    if (type === 'executeGrpcRequest') {
      const payload = args[0] as BridgeRpcRequest<'executeGrpcRequest'>;
      return handleExecuteGrpcRequest(payload) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'sendGrpcStreamMessage') {
      // The riders answer from the host-neutral active-stream registry
      // — the call's own handle, keyed by the invoke's sendId.
      const payload = args[0] as BridgeRpcRequest<'sendGrpcStreamMessage'>;
      return Promise.resolve(sendActiveGrpcStreamMessage(payload.sendId, payload.messageText)) as Promise<
        BridgeRpcResponse<K>
      >;
    }
    if (type === 'endGrpcClientStream') {
      const payload = args[0] as BridgeRpcRequest<'endGrpcClientStream'>;
      return Promise.resolve({ success: endActiveGrpcClientStream(payload.sendId) }) as Promise<BridgeRpcResponse<K>>;
    }
    if (type === 'abortRequestSend') {
      const payload = args[0] as BridgeRpcRequest<'abortRequestSend'>;
      if (stopActiveSend(payload.sendId)) {
        return Promise.resolve({ success: true }) as Promise<BridgeRpcResponse<K>>;
      }
      // Not a page-local call — an HTTP exchange executing in the SW.
    }
    return base.call(type, ...args);
  },
  broadcast: base.broadcast,
  subscribe<K extends BridgeBroadcastType>(
    subscribedType: K,
    handler: (payload: BridgeBroadcastPayload<K>) => void,
  ): () => void {
    if (subscribedType === 'grpcStreamEvent') {
      const local = handler as (event: GrpcStreamEventWire) => void;
      grpcStreamSubscribers.add(local);
      // Base passthrough kept — nothing broadcasts this channel from
      // the SW today, and a future forwarding leg lands without a
      // subscriber-side change.
      const unsubscribe = base.subscribe(subscribedType, handler);
      return () => {
        grpcStreamSubscribers.delete(local);
        unsubscribe();
      };
    }
    return base.subscribe(subscribedType, handler);
  },
  presence: base.presence,
};

setHostBridge(grpcInvokeHostBridge);

// The gRPC Invoke honours an explicit place — the HTTP/2 session opens
// on the desktop app or the workspace's server while the executor
// stays in this realm; the reader offers the legs.
registerCapability('delegatedGrpcDispatch', () => true);
