/**
 * useGrpcInvokePlane — the editor's whole invoke plane in one hook:
 * Invoke fires the CURRENT compose state (saved or not) through the
 * `executeGrpcRequest` channel — answered in-process on node hosts and
 * on a browser surface executed IN the page realm over a delegating
 * transport to the place the shared reader resolves (the connected
 * desktop app, else the workspace's server; the settings layers and
 * the per-send pick fold into `preference`), the call resolved and
 * encoded here against the renderer scopes this hook publishes
 * (`grpc-page-invoke.ts`) — every call shape; in flight it morphs to Stop
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
import type { ExecutedGrpcSnapshot, GrpcRequest as GrpcRequestEntity, Spec } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getGrpcResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/grpc-response-example-sync-mirror';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useScriptPackages } from '@openheaders/ui/shared/hooks/readers/useScriptPackages';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useSecretManagerReferenceCount } from '@openheaders/ui/shared/secret-manager';
import {
  applyGrpcResponseExampleCreate,
  nextGrpcExampleName,
} from '@openheaders/ui/shared/sync/grpc-response-example-write-client';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { executionPlaceCopy } from '../../execution-place/execution-place-copy';
import type { ExecutionPlacePreference } from '../../execution-place/resolve-execution-place';
import { type UseExecutionPlaceResult, useExecutionPlace } from '../../execution-place/useExecutionPlace';
import {
  capturedGrpcRequestFromDraft,
  capturedGrpcResponseFromSnapshot,
} from '../grpc-response-example/grpc-example-draft';
import type { InheritedSettingsView } from '../shared/inherited-settings/inherited-settings';
import { buildGrpcRequestUpdates, type GrpcDraft } from './draft';
import { makeGrpcPageInvokeFactory, publishGrpcPageInvokeFactory } from './grpc-page-invoke';
import type { GrpcMethodOption } from './method-selector';
import { type GrpcStreamSession, type LiveGrpcStream, useLiveGrpcStream } from './useLiveGrpcStream';

interface UseGrpcInvokePlaneInput {
  entity: GrpcRequestEntity | null;
  draft: GrpcDraft;
  /** The request's ancestor plane — the effective verification switch
   *  (own, else the chain's, else on) stamps the captured example. */
  inherited: InheritedSettingsView;
  workspaceId: string | null;
  /** The workspace's Protobuf specs off the page's mirror — the
   *  page-invoke factory hands the executor the draft's linked one. */
  protobufSpecs: readonly Spec[];
  /** The method the compose targets — stamps the result pane's shape
   *  at invoke time. */
  selectedOption: GrpcMethodOption | null;
  /** Opt-in reference-client posture: a message that isn't valid JSON
   *  invokes anyway as an EMPTY message and the server answers. */
  sendInvalidMessage: boolean;
  /** Open a saved example's viewer tab (after "Save Response"). */
  onOpenGrpcResponseExample?: ((uid: string, name: string, grpcRequestUid: string) => void) | undefined;
  /** The resolved role from the settings layers or the per-send pick; absent = Auto. */
  preference?: ExecutionPlacePreference;
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
  /** Where Invoke would run this call, by the shared reader. */
  executionPlace: UseExecutionPlaceResult;
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
  inherited,
  workspaceId,
  protobufSpecs,
  selectedOption,
  sendInvalidMessage,
  onOpenGrpcResponseExample,
  preference,
}: UseGrpcInvokePlaneInput): GrpcInvokePlane {
  const { message: toast } = App.useApp();
  const t = useT();
  // The verification switch the call runs under — the request's own,
  // else the chain's, else on (the rule the executor applies).
  const sslVerification = draft.sslVerification ?? inherited.settings.sslVerification ?? true;
  const { collections, collectionTrees, executeGrpc, folders } = useRequests();
  // Where the invoke runs — the shared reader over the delegated gRPC
  // leg (`delegatedGrpcDispatch`), the desktop app's live connection
  // state and the workspace's server.
  const executionPlace = useExecutionPlace({
    kind: 'grpc',
    ...(preference !== undefined ? { preference } : {}),
    secretManagerReferences: useSecretManagerReferenceCount(draft),
  });

  // Page-invoke resolution publisher — a host executing gRPC calls IN
  // this page realm injects the CURRENT factory into the executor at
  // Invoke, so republish on every renderer-scope change while a gRPC
  // editor is mounted (nothing can Invoke without one); the linked
  // spec rides along off the page's mirror, the Package Library for
  // the hooks' `oh.require` (the WebSocket plane's discipline).
  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const pageInvoke = requestRuntimeKind !== 'node' && (getCapability('delegatedGrpcDispatch')?.() ?? false);
  const resolverInputs = useVariableResolverInputs();
  const scriptPackages = useScriptPackages(pageInvoke ? workspaceId : null);
  useEffect(() => {
    if (!pageInvoke) return;
    publishGrpcPageInvokeFactory(
      makeGrpcPageInvokeFactory(
        resolverInputs,
        { collectionTrees, collections, folders },
        workspaceId,
        scriptPackages.map((p) => ({ name: p.name, source: p.source })),
        protobufSpecs,
      ),
    );
  }, [pageInvoke, resolverInputs, collectionTrees, collections, folders, workspaceId, scriptPackages, protobufSpecs]);

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
    // The companion by EXPLICIT backend id — never the default wire.
    const snapshot = await executeGrpc({
      draft: draftEntity,
      sendId,
      ...(executionPlace.target !== null ? { executionPlace: executionPlace.target } : {}),
    });
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
  }, [
    entity,
    invoking,
    draft,
    sendInvalidMessage,
    selectedOption,
    executeGrpc,
    executionPlace.target,
    liveStream,
    toast,
    t,
  ]);

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
          // The capture records the CONCRETE flag the call used.
          request: capturedGrpcRequestFromDraft({ ...draft, sslVerification }),
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
  }, [entity, workspaceId, response, draft, sslVerification, toast, onOpenGrpcResponseExample, t]);

  const canSaveResponse = workspaceId !== null && response !== null && response.error === null;

  const invokeDisabledReason =
    executionPlace.state !== 'ready'
      ? executionPlaceCopy(executionPlace, t).reason
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
    executionPlace,
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
