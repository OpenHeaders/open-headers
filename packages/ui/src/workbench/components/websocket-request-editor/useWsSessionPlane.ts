/**
 * useWsSessionPlane — the editor's whole session plane in one hook.
 *
 * Connect opens the live session through the `executeWebSocketRequest`
 * channel — answered in-process on node hosts (`requestRuntime`) and
 * IN the page realm on surfaces carrying the `wsPageSession`
 * capability (the extension workbench, over the platform socket); a
 * browser surface with neither keeps the honest disabled copy. On the
 * page-session path the hook also publishes the renderer-scope
 * resolution factory the page host injects into the executor, and
 * names the configured node-only knobs (headers, SSL-verify-off, the
 * raw flavor's bearer header) in the session pane's honesty notice.
 * In flight Connect MORPHS to Disconnect (the clean close 1000 via the
 * `closeWsSession` rider; Reconnect now cuts the auto-reconnect wait
 * short via `reconnectWsSessionNow`), Send rides `sendWsMessage` —
 * enabled only while the session is open — and Save Response freezes
 * a settled session that opened into a WsResponseExample. Between
 * auto-reconnect attempts the session stays in flight with
 * `sessionOpen` false — Send disables honestly until a handshake takes
 * again (the MQTT plane's law).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import type { ExecutedWsSnapshot, WebSocketRequest as WebSocketRequestEntity } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getWsResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/ws-response-example-sync-mirror';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  applyWsResponseExampleCreate,
  nextWsExampleName,
} from '@openheaders/ui/shared/sync/ws-response-example-write-client';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { findRequestAncestry, resolveInheritedAuthFor } from '../request-container/ancestry';
import { capturedWsRequestFromDraft, capturedWsResponseFromSnapshot } from '../ws-response-example/ws-example-draft';
import { buildWebSocketRequestUpdates, type WebSocketDraft } from './draft';
import { type LiveWsSession, useLiveWsSession, type WsSessionTiming } from './useLiveWsSession';
import { reconnectingAt } from './ws-lifecycle';
import { makeWsPageResolutionFactory, publishWsPageResolutionFactory } from './ws-page-session';

interface UseWsSessionPlaneInput {
  entity: WebSocketRequestEntity | null;
  draft: WebSocketDraft;
  workspaceId: string | null;
  /** "Save Response" landed — open the minted example's viewer tab. */
  onOpenWsResponseExample?: ((uid: string, name: string, websocketRequestUid: string) => void) | undefined;
}

export interface WsSessionPlane {
  inFlight: boolean;
  /** True while the session is open (handshake done, not settled). */
  sessionOpen: boolean;
  /** True while auto-reconnect is between attempts or mid-redial —
   *  in flight, no connection up. */
  reconnecting: boolean;
  snapshot: ExecutedWsSnapshot | null;
  timing: WsSessionTiming | null;
  /** The open session's live feed; null outside one. */
  live: LiveWsSession | null;
  /** Per-knob honesty notice for a page-realm session; null = none. */
  hostNotice: string | null;
  /** Honest gate copy for a disabled Connect; null = enabled. */
  connectDisabledReason: string | null;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  /** Dial the armed reconnect attempt now instead of after its wait. */
  handleReconnectNow: () => void;
  handleSendMessage: () => Promise<void>;
  handleClearSession: () => void;
  handleSaveResponse: () => Promise<void>;
  canSaveResponse: boolean;
}

export function useWsSessionPlane({
  entity,
  draft,
  workspaceId,
  onOpenWsResponseExample,
}: UseWsSessionPlaneInput): WsSessionPlane {
  const { message: toast } = App.useApp();
  const t = useT();
  const { collections, collectionTrees, executeWebSocket, folders } = useRequests();

  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const pageSession = requestRuntimeKind !== 'node' && (getCapability('wsPageSession')?.() ?? false);
  const [inFlight, setInFlight] = useState(false);
  const [snapshot, setSnapshot] = useState<ExecutedWsSnapshot | null>(null);
  const [timing, setTiming] = useState<WsSessionTiming | null>(null);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const activeSendIdRef = useRef<string | null>(null);
  /** The user's Disconnect/Cancel click instant — the aborted row's
   *  honest time (the teardown itself rides the end frame's stamp). */
  const closeRequestedAtRef = useRef<number | null>(null);
  const liveSession = useLiveWsSession();

  // Page-session resolution publisher — the host executing in this
  // page realm injects the CURRENT factory into the executor at
  // Connect, so republish on every renderer-scope change while a
  // WebSocket editor is mounted (nothing can Connect without one).
  const resolverInputs = useVariableResolverInputs();
  useEffect(() => {
    if (!pageSession) return;
    publishWsPageResolutionFactory(
      makeWsPageResolutionFactory(resolverInputs, { collectionTrees, collections, folders }, workspaceId),
    );
  }, [pageSession, resolverInputs, collectionTrees, collections, folders]);

  const handleConnect = useCallback(async () => {
    if (!entity || inFlight) return;
    // The CURRENT compose state connects — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const draftEntity: WebSocketRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      flavor: entity.flavor,
      ...buildWebSocketRequestUpdates(draft),
    };
    // Per-knob honesty on the page-session path: the platform socket
    // cannot carry custom handshake headers or skip TLS verification —
    // a CONFIGURED knob is named for the session's whole life instead
    // of silently dropping (the connect deadline DOES apply here).
    const inapplicableKnobs: string[] = [];
    if (pageSession) {
      if (draft.headers.some((h) => h.enabled !== false && h.key.trim() !== '')) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobHeaders'));
      }
      if (!draft.sslVerification) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobSslVerify'));
      }
      // A credential that rides the dial URL (a query-placed key or
      // token, the AWS signed URL) reaches the server from any host,
      // and the socketio flavor's bearer-shaped tokens (bearer, OAuth
      // 2.0, JWT) ride the CONNECT auth payload too; every other
      // resolved credential is a handshake header the platform socket
      // cannot carry — Inherit resolves over the tree ancestry first
      // (the executor's twin).
      const effectiveAuth =
        draft.auth.type === 'inherit'
          ? resolveInheritedAuthFor(
              findRequestAncestry(collectionTrees, collections, folders, entity.uid),
              draft.auth,
              draft.url,
            ).auth
          : draft.auth;
      const socketio = entity.flavor === 'socketio';
      const headerBorne =
        !('disabled' in effectiveAuth && effectiveAuth.disabled === true) &&
        (effectiveAuth.type === 'basic' ||
          (effectiveAuth.type === 'api-key' && effectiveAuth.in === 'header') ||
          (effectiveAuth.type === 'bearer' && effectiveAuth.token.trim() !== '' && !socketio) ||
          (effectiveAuth.type === 'oauth2' && effectiveAuth.sendAs !== 'query' && !socketio) ||
          (effectiveAuth.type === 'jwt' && effectiveAuth.addTo === 'header' && !socketio));
      if (headerBorne) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobAuth'));
      }
    }
    setHostNotice(
      inapplicableKnobs.length > 0
        ? t('workbench.editors.websocket.session.hostNotice', { knobs: inapplicableKnobs.join(', ') })
        : null,
    );
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    closeRequestedAtRef.current = null;
    setInFlight(true);
    setSnapshot(null);
    setTiming(null);
    liveSession.beginSession(sendId);
    const settled = await executeWebSocket({ draft: draftEntity, sendId });
    const session = liveSession.takeSession();
    const closeRequestedAt = closeRequestedAtRef.current;
    setTiming(
      session === null
        ? null
        : {
            ...session,
            ...(closeRequestedAt !== null ? { closeRequestedAt } : {}),
            endedAt: Date.now(),
          },
    );
    liveSession.endSession();
    activeSendIdRef.current = null;
    setInFlight(false);
    if (settled === null) {
      toast.error(t('workbench.editors.websocket.session.connectFailed'));
      return;
    }
    setSnapshot(settled);
  }, [
    entity,
    inFlight,
    draft,
    pageSession,
    executeWebSocket,
    liveSession,
    toast,
    t,
    collectionTrees,
    collections,
    folders,
  ]);

  // Disconnect morphs from Connect while the session is open — the
  // clean close 1000; the pending RPC above resolves with the
  // whole-session snapshot once the close handshake settles.
  const handleDisconnect = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    if (closeRequestedAtRef.current === null) closeRequestedAtRef.current = Date.now();
    hostBridge.call('closeWsSession', { sendId }).catch(() => {});
  }, []);

  const handleReconnectNow = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('reconnectWsSessionNow', { sendId }).catch(() => {});
  }, []);

  // Send the CURRENT compose state as one message — the executor
  // resolves {{refs}} through the resolver it built at Connect, and a
  // resolve (or, on the socketio flavor, a frame-compose) failure
  // reports here without touching the open session. For socketio the
  // compose text is the JSON arguments array and the rider addendum
  // carries the event name + ack opt-in.
  // A raw-flavor binary compose rides the `binary` addendum: the text
  // is the byte spelling, the executor decodes and writes ONE binary
  // frame (the socketio flavor never composes binary).
  const socketioFlavor = entity?.flavor === 'socketio';
  const binaryCompose = !socketioFlavor && draft.messageFormat === 'binary';
  const handleSendMessage = useCallback(async () => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    const result = await hostBridge
      .call('sendWsMessage', {
        sendId,
        messageText: draft.message,
        ...(socketioFlavor ? { socketio: { eventName: draft.eventName, expectAck: draft.ackEnabled } } : {}),
        ...(binaryCompose ? { binary: { encoding: draft.binaryEncoding } } : {}),
      })
      .catch(() => null);
    if (result === null || !result.success) {
      toast.error(result?.error ?? t('workbench.editors.websocket.session.sendFailed'));
    }
  }, [draft.message, draft.eventName, draft.ackEnabled, draft.binaryEncoding, socketioFlavor, binaryCompose, toast, t]);

  const handleClearSession = useCallback(() => {
    setSnapshot(null);
    setTiming(null);
    setHostNotice(null);
  }, []);

  // Save Response — freeze the settled session as an example under
  // this request. Captures the AUTHORED compose state (draft rows as
  // edited, variable refs unresolved) plus the settled snapshot's
  // facts; only a session that opened can be captured (the gRPC
  // example's law).
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !snapshot || snapshot.outcome.kind !== 'connected') return;
    const mirror = getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextWsExampleName(mirror, entity.uid, entity.name);
    const result = await applyWsResponseExampleCreate(
      {
        websocketRequestPath: entity.path,
        example: {
          websocketRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedWsRequestFromDraft(draft, entity.flavor),
          response: capturedWsResponseFromSnapshot(snapshot),
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.websocket.toast.savedExample', { name }));
      onOpenWsResponseExample?.(result.wsResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.websocket.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.websocket.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, snapshot, draft, toast, onOpenWsResponseExample, t]);

  const canSaveResponse = workspaceId !== null && snapshot !== null && snapshot.outcome.kind === 'connected';

  const reconnecting = inFlight && liveSession.live !== null && reconnectingAt(liveSession.live.lifecycle);
  const sessionOpen = inFlight && liveSession.live !== null && liveSession.live.open !== null && !reconnecting;

  const connectDisabledReason =
    requestRuntimeKind !== 'node' && !pageSession
      ? t('workbench.editors.websocket.connect.browserHost')
      : draft.url.trim() === ''
        ? t('workbench.editors.websocket.connect.needsUrl')
        : null;

  return {
    inFlight,
    sessionOpen,
    reconnecting,
    snapshot,
    timing,
    live: liveSession.live,
    hostNotice,
    connectDisabledReason,
    handleConnect,
    handleDisconnect,
    handleReconnectNow,
    handleSendMessage,
    handleClearSession,
    handleSaveResponse,
    canSaveResponse,
  };
}
