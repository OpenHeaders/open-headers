/**
 * useGraphqlSubscriptionPlane — the GraphQL editor's subscription
 * session in one hook, the `useWsSessionPlane` sibling for the one
 * operation kind that leaves the POST. Query on a picked subscription
 * opens the session through the `executeGraphqlSubscription` channel
 * — answered in-process on node hosts and IN the page realm on
 * surfaces carrying the `wsPageSession` capability (the extension
 * workbench, over the platform socket); a browser surface with
 * neither keeps the honest disabled copy. On the page-session path
 * the hook publishes the renderer-scope resolution factory the page
 * host injects into the executor (the WebSocket editor's publisher,
 * keyed by the request's uid — the derived session keeps it), and
 * names the configured node-only knobs in the pane's honesty notice
 * (custom handshake headers, SSL verification off; the credential is
 * NOT one — it rides `connection_init.payload` on every host). In
 * flight Query MORPHS to Stop: the `closeWsSession` rider, which the
 * executor answers with the client's own `complete` then the clean
 * close 1000. The settled snapshot is the WebSocket session's.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import type { ExecutedWsSnapshot, GraphqlRequest as GraphqlRequestEntity } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useScriptPackages } from '@openheaders/ui/shared/hooks/readers/useScriptPackages';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LiveWsSession,
  useLiveWsSession,
  type WsSessionTiming,
} from '../websocket-request-editor/useLiveWsSession';
import {
  makeWsPageResolutionFactory,
  publishWsPageResolutionFactory,
} from '../websocket-request-editor/ws-page-session';
import { draftEntity, type GraphqlDraft } from './draft';

interface UseGraphqlSubscriptionPlaneInput {
  entity: GraphqlRequestEntity | null;
  draft: GraphqlDraft;
  /** The operation select's live pick — rides the RPC as the override. */
  operationName: string | undefined;
  /** The effective verification switch (own, else the chain's, else
   *  on) — gates the page-session honesty notice. */
  sslVerification: boolean;
  workspaceId: string | null;
}

export interface GraphqlSubscriptionPlane {
  inFlight: boolean;
  snapshot: ExecutedWsSnapshot | null;
  timing: WsSessionTiming | null;
  /** The open session's live feed; null outside one. */
  live: LiveWsSession | null;
  /** Per-knob honesty notice for a page-realm session; null = none. */
  hostNotice: string | null;
  /** Honest gate copy for a disabled Query; null = enabled. */
  disabledReason: string | null;
  handleSubscribe: () => Promise<void>;
  handleStop: () => void;
  handleClear: () => void;
}

export function useGraphqlSubscriptionPlane({
  entity,
  draft,
  operationName,
  sslVerification,
  workspaceId,
}: UseGraphqlSubscriptionPlaneInput): GraphqlSubscriptionPlane {
  const { message: toast } = App.useApp();
  const t = useT();
  const { collections, collectionTrees, executeGraphqlSubscription, folders } = useRequests();

  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const pageSession = requestRuntimeKind !== 'node' && (getCapability('wsPageSession')?.() ?? false);
  const [inFlight, setInFlight] = useState(false);
  const [snapshot, setSnapshot] = useState<ExecutedWsSnapshot | null>(null);
  const [timing, setTiming] = useState<WsSessionTiming | null>(null);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const activeSendIdRef = useRef<string | null>(null);
  const closeRequestedAtRef = useRef<number | null>(null);
  const liveSession = useLiveWsSession();

  // Page-session resolution publisher — the WebSocket editor's, so the
  // page host injects the CURRENT renderer scope at Query; republish on
  // every scope change while this editor is mounted.
  const resolverInputs = useVariableResolverInputs();
  const scriptPackages = useScriptPackages(pageSession ? workspaceId : null);
  useEffect(() => {
    if (!pageSession) return;
    publishWsPageResolutionFactory(
      makeWsPageResolutionFactory(
        resolverInputs,
        { collectionTrees, collections, folders },
        workspaceId,
        scriptPackages.map((p) => ({ name: p.name, source: p.source })),
      ),
    );
  }, [pageSession, resolverInputs, collectionTrees, collections, folders, workspaceId, scriptPackages]);

  const handleSubscribe = useCallback(async () => {
    if (!entity || inFlight) return;
    // Per-knob honesty on the page-session path: the platform socket
    // cannot carry custom handshake headers or skip TLS verification —
    // a CONFIGURED knob is named for the session's whole life.
    const inapplicableKnobs: string[] = [];
    if (pageSession) {
      if (draft.headers.some((h) => h.enabled !== false && h.key.trim() !== '')) {
        inapplicableKnobs.push(t('workbench.editors.websocket.session.knobHeaders'));
      }
      if (!sslVerification) inapplicableKnobs.push(t('workbench.editors.websocket.session.knobSslVerify'));
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
    const settled = await executeGraphqlSubscription({
      draft: draftEntity(entity, draft),
      ...(operationName !== undefined ? { operationName } : {}),
      sendId,
    });
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
      toast.error(t('workbench.editors.graphql.subscription.openFailed'));
      return;
    }
    setSnapshot(settled);
  }, [
    entity,
    inFlight,
    draft,
    operationName,
    sslVerification,
    pageSession,
    executeGraphqlSubscription,
    liveSession,
    toast,
    t,
  ]);

  // Stop morphs from Query while the session is in flight — the
  // client's complete then the clean close; the pending RPC above
  // resolves with the whole-session snapshot once the close settles.
  const handleStop = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    if (closeRequestedAtRef.current === null) closeRequestedAtRef.current = Date.now();
    hostBridge.call('closeWsSession', { sendId }).catch(() => {});
  }, []);

  const handleClear = useCallback(() => {
    setSnapshot(null);
    setTiming(null);
    setHostNotice(null);
  }, []);

  const disabledReason =
    requestRuntimeKind !== 'node' && !pageSession ? t('workbench.editors.graphql.subscription.browserHost') : null;

  return {
    inFlight,
    snapshot,
    timing,
    live: liveSession.live,
    hostNotice,
    disabledReason,
    handleSubscribe,
    handleStop,
    handleClear,
  };
}
