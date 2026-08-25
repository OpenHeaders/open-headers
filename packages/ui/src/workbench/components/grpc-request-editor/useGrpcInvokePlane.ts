/**
 * useGrpcInvokePlane — the editor's whole invoke plane in one hook:
 * Invoke fires the CURRENT compose state (saved or not) through the
 * `executeGrpcRequest` channel — answered in-process on node hosts and
 * forwarded to a connected companion on extension surfaces (the
 * `grpcCompanionInvoke` capability + live connection state gate the
 * button) — every call shape; in flight it morphs to Stop
 * (`abortRequestSend` on the shared active-send registry). Streaming
 * invokes ride `useLiveGrpcStream` while open and settle into the
 * session the stream pane joins positionally. Client/bidi upstream
 * controls (`sendGrpcStreamMessage` / `endGrpcClientStream`) key off
 * the in-flight sendId. Save Response freezes the settled exchange as
 * a GrpcResponseExample (authored compose state + snapshot facts; auth
 * deliberately excluded — the schema's law).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import type { ExecutedGrpcSnapshot, GrpcRequest as GrpcRequestEntity } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getGrpcResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/grpc-response-example-sync-mirror';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import {
  applyGrpcResponseExampleCreate,
  nextGrpcExampleName,
} from '@openheaders/ui/shared/sync/grpc-response-example-write-client';
import { App } from 'antd';
import { useCallback, useRef, useState } from 'react';
import {
  capturedGrpcRequestFromDraft,
  capturedGrpcResponseFromSnapshot,
} from '../grpc-response-example/grpc-example-draft';
import { buildGrpcRequestUpdates, type GrpcDraft } from './draft';
import type { GrpcMethodOption } from './method-selector';
import { type GrpcStreamSession, type LiveGrpcStream, useLiveGrpcStream } from './useLiveGrpcStream';

interface UseGrpcInvokePlaneInput {
  entity: GrpcRequestEntity | null;
  draft: GrpcDraft;
  workspaceId: string | null;
  /** The method the compose targets — stamps the result pane's shape
   *  at invoke time. */
  selectedOption: GrpcMethodOption | null;
  /** Opt-in reference-client posture: a message that isn't valid JSON
   *  invokes anyway as an EMPTY message and the server answers. */
  sendInvalidMessage: boolean;
  /** Open a saved example's viewer tab (after "Save Response"). */
  onOpenGrpcResponseExample?: ((uid: string, name: string, grpcRequestUid: string) => void) | undefined;
}

export interface GrpcInvokePlane {
  invoking: boolean;
  response: ExecutedGrpcSnapshot | null;
  /** Which pane renders the result — stamped at invoke time from the
   *  method's shape, so a method re-pick mid-flight can't flip it. */
  responseShape: 'unary' | 'stream';
  streamSession: GrpcStreamSession | null;
  /** The open stream's live feed; null outside a streaming invoke. */
  live: LiveGrpcStream | null;
  /** Honest gate copy for a disabled Invoke; null = enabled. */
  invokeDisabledReason: string | null;
  handleInvoke: () => Promise<void>;
  handleCancelInvoke: () => void;
  handleClearResponse: () => void;
  handleSaveResponse: () => Promise<void>;
  canSaveResponse: boolean;
  /** The method is client/bidi — the upstream controls SHOW (the
   *  CTA-scaffold posture) … */
  clientStreamShape: boolean;
  /** … and ENABLE only while its stream is open. */
  clientStreamActive: boolean;
  handleSendStreamMessage: () => Promise<void>;
  handleEndStreaming: () => void;
}

export function useGrpcInvokePlane({
  entity,
  draft,
  workspaceId,
  selectedOption,
  sendInvalidMessage,
  onOpenGrpcResponseExample,
}: UseGrpcInvokePlaneInput): GrpcInvokePlane {
  const { message: toast } = App.useApp();
  const t = useT();
  const { executeGrpc } = useRequests();
  const { isConnected } = useRules();

  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  // Extension surfaces forward invokes to a connected companion (the
  // desktop app) — the seam is static; whether a companion is actually
  // connected is live state, so the gate reads both.
  const companionSeam = requestRuntimeKind !== 'node' && (getCapability('grpcCompanionInvoke')?.() ?? false);

  const [invoking, setInvoking] = useState(false);
  const [response, setResponse] = useState<ExecutedGrpcSnapshot | null>(null);
  const [responseShape, setResponseShape] = useState<'unary' | 'stream'>('unary');
  const [streamSession, setStreamSession] = useState<GrpcStreamSession | null>(null);
  // The in-flight call's target — the timeline's lifecycle rows keep
  // naming what was actually invoked.
  const activeSendIdRef = useRef<string | null>(null);
  const liveStream = useLiveGrpcStream();

  const handleInvoke = useCallback(async () => {
    if (!entity || invoking) return;
    // The CURRENT compose state invokes — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const updates = buildGrpcRequestUpdates(draft);
    if (sendInvalidMessage && updates.message.trim() !== '') {
      try {
        JSON.parse(updates.message);
      } catch {
        updates.message = '';
      }
    }
    const draftEntity: GrpcRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      ...updates,
    };
    const streaming = selectedOption !== null && selectedOption.streaming !== 'unary';
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInvoking(true);
    setResponse(null);
    setStreamSession(null);
    setResponseShape(streaming ? 'stream' : 'unary');
    if (streaming && draft.method) {
      liveStream.beginStream(sendId);
    }
    const snapshot = await executeGrpc({ draft: draftEntity, sendId });
    if (streaming) {
      const session = liveStream.takeSession();
      setStreamSession(session === null ? null : { ...session, endedAt: Date.now() });
      liveStream.endStream();
    }
    activeSendIdRef.current = null;
    setInvoking(false);
    if (snapshot === null) {
      toast.error(t('workbench.editors.grpc.invoke.failed'));
      return;
    }
    setResponse(snapshot);
  }, [entity, invoking, draft, sendInvalidMessage, selectedOption, executeGrpc, liveStream, toast, t]);

  // Cancel morphs from Invoke while in flight — the host aborts the
  // exchange and the pending RPC above resolves with what arrived.
  const handleCancelInvoke = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('abortRequestSend', { sendId }).catch(() => {});
  }, []);

  // "Clear response" (the result pane's ⋯ menu) — back to the
  // empty-state pane; the compose side is untouched.
  const handleClearResponse = useCallback(() => {
    setResponse(null);
    setStreamSession(null);
  }, []);

  // Save Response — gRPC requests are context-create-only (always
  // persisted), so there is no needs-save gate: the button shows
  // whenever a non-error result is on screen.
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !response || response.error !== null) return;
    const mirror = getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextGrpcExampleName(mirror, entity.uid, entity.name);
    const result = await applyGrpcResponseExampleCreate(
      {
        grpcRequestPath: entity.path,
        example: {
          grpcRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedGrpcRequestFromDraft(draft),
          response: capturedGrpcResponseFromSnapshot(response),
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.grpc.toast.savedExample', { name }));
      onOpenGrpcResponseExample?.(result.grpcResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.grpc.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.grpc.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, response, draft, toast, onOpenGrpcResponseExample, t]);

  const canSaveResponse = workspaceId !== null && response !== null && response.error === null;

  const invokeDisabledReason =
    requestRuntimeKind !== 'node' && !companionSeam
      ? t('workbench.editors.grpc.invoke.browserHost')
      : companionSeam && !isConnected
        ? t('workbench.editors.grpc.invoke.connectCompanion')
        : !selectedOption
          ? t('workbench.editors.grpc.invoke.needsMethod')
          : draft.url.trim() === ''
            ? t('workbench.editors.grpc.invoke.needsUrl')
            : null;

  const clientStreamShape =
    selectedOption !== null &&
    (selectedOption.streaming === 'client-streaming' || selectedOption.streaming === 'bidi-streaming');
  const clientStreamActive = invoking && responseShape === 'stream' && clientStreamShape;

  // Send the CURRENT compose text as one upstream message — the
  // executor encodes it against the rpc's request type, and an encode
  // mismatch reports here without touching the open stream.
  const handleSendStreamMessage = useCallback(async () => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    const result = await hostBridge
      .call('sendGrpcStreamMessage', { sendId, messageText: draft.message })
      .catch(() => null);
    if (result === null || !result.success) {
      toast.error(result?.error ?? t('workbench.editors.grpc.stream.sendFailed'));
    }
  }, [draft.message, toast, t]);

  const handleEndStreaming = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('endGrpcClientStream', { sendId }).catch(() => {});
  }, []);

  return {
    invoking,
    response,
    responseShape,
    streamSession,
    live: liveStream.live,
    invokeDisabledReason,
    handleInvoke,
    handleCancelInvoke,
    handleClearResponse,
    handleSaveResponse,
    canSaveResponse,
    clientStreamShape,
    clientStreamActive,
    handleSendStreamMessage,
    handleEndStreaming,
  };
}
