/**
 * RequestEditor — HTTP request editor tab.
 *
 * Full-fidelity editor for the request shape the SW's `executeRequest`
 * runner can ship. Tab layout: Docs · Params · Authorization · Headers
 * · Body · Scripts · Settings.
 *
 * This module is the orchestrator: it owns the draft + live-mirror
 * state, the sync/conflict wiring, and save/send, then composes the
 * focused pieces under `./request-editor/` (URL bar, tab catalog, tab
 * content, per-section resolvability, response panel).
 *
 * Sync engine alignment (matches RuleEditor + TemplateEditor):
 *
 *   - `useEditorShell` returns branded `headerProps` + `scopeProps`
 *     mounted into `<EditorHeader>` + `<EntityScopeProvider>`; the
 *     scope drives `<EntityField>` + per-row `data-field-path` markers
 *     so all publishers contribute the same `(entity, path)` triple
 *     to `<SurfaceAwarenessPublisher>`. Also bundles dirty-publishing.
 *   - `useReprime` owns the form-vs-canonical comparison (BC1 by
 *     construction); dirty derives structurally. Create-mode dirty is
 *     `isCreateMode ? true : reprime.isDirty` at the editor surface.
 *   - `useRequestConflicts` + `<EntityConflictBanner>` +
 *     `<EntityConflictDialog>` surface concurrent-edit divergence.
 *
 * Send operates on the LOCAL draft so users can test-fire without
 * persisting first.
 */

import { BorderOutlined, CaretRightOutlined, LoadingOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { isRequestComplete } from '@openheaders/core/utils';
import { App, Button, Tabs, Tooltip, Typography, theme } from 'antd';
import { Allotment } from 'allotment';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRequestSyncMirrorForWorkspace, getResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  applyResponseExampleCreate,
  nextExampleName,
} from '@openheaders/ui/shared/sync/response-example-write-client';
import { EntityScopeProvider, useSetActiveFieldFocus } from '@openheaders/ui/shared/awareness';
import { readFieldPath } from '@openheaders/ui/shared/awareness/field-path';
import { EntityConflictBanner, EntityConflictDialog, hasDialogOnlyConflict } from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { ensureScheme, needsSchemeNormalization } from '@openheaders/ui/shared/fetch';
import { isMac } from '@openheaders/ui/shared/platform';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import type { DraftData } from '../../hooks/useSaveRequestFlow';
import EditorHeader from '../shell/EditorHeader';
import { useRequestWorkflowStepContext } from '../live/useRequestWorkflowStepContext';
import { mergeRequestForSave } from './merge-request-for-save';
import {
  type Draft,
  buildRequestUpdates,
  canonicalRequestProjection,
  draftFromRequest,
  emptyDraft,
  rowsToHeaders,
  rowsToParams,
} from './draft';
import { type TabKey, buildRequestTabItems } from './request-tab-items';
import RequestTabContent from './RequestTabContent';
import ScriptModeTag from './ScriptModeTag';
import RequestUrlBar from './RequestUrlBar';
import { takeHandoffResponse } from './response-handoff';
import { capturedResponseFromSnapshot } from '../response-example/example-draft';
import ResponsePanel from './response/ResponsePanel';
import { useLiveSendStream } from './useLiveSendStream';
import { useRequestEditorLayout } from './useRequestEditorLayout';
import { useSectionUnresolved } from './useSectionUnresolved';
import type { AutoSuggestionContextValue } from '../template-input';
import { SuggestionContextProvider } from '../template-input';
import { useRequestConflicts } from './use-request-conflicts';
import { useRequestConflictSurface } from './use-request-conflict-surface';

const { Text } = Typography;

const SEND_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';

// ── Types ──────────────────────────────────────────────────────────

interface RequestEditorProps {
  mode: 'request-edit' | 'request-create';
  requestUid?: string;
  draftName?: string;
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  /** Full-fidelity create-mode seed from "Duplicate Tab" — the source
   *  request's content (URL, method, headers, params, auth, body,
   *  scripts, …) plus name, minus identity. The draft is initialized
   *  from it on mount. Honored in create mode only. */
  seedRequestContent?: Omit<Request, 'uid' | 'path' | 'schemaVersion'>;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  onSaveDraft?: (draftData: DraftData) => void;
  /** Publishes a snapshot fn that projects the live draft into content-
   *  only request data (plus name, minus identity) — read by "Duplicate
   *  Tab" to seed a fresh scratch. Works in both edit and create modes. */
  registerDuplicateRef?: (fn: () => Omit<Request, 'uid' | 'path' | 'schemaVersion'> | null) => void;
  /**
   * "Use response in workflow" action — available only in request-edit
   * mode where the request has a stable uid. `target` picks where the
   * seeded step lands: a fresh draft workflow (`'new'`) or an existing
   * workflow identified by uid. Either way the host opens the workflow
   * editor with the request pre-seeded as a step so the user can wire
   * the response's values into `{{live.*}}` captures.
   */
  onExtractToWorkflow?: (target: 'new' | { workflowUid: string }, seedStep: ExtractSeedStep) => void;
  /** Editing-scope workspace — threaded to script-editor selection
   *  actions (Save to Package Library). */
  workspaceId?: string | null;
  /** Open the Package Library tab (Scripts tab's Packages popover). */
  onOpenPackageLibrary?: () => void;
  /** Open a saved response example in its viewer tab — called right
   *  after "Save Response" mints one so the frozen exchange is
   *  immediately inspectable. */
  onOpenResponseExample?: (uid: string, name: string, requestUid: string) => void;
}

/** Payload the request editor hands the extract action. */
export interface ExtractSeedStep {
  requestUid: string;
  requestName: string;
  method: string;
}

// ── Component ──────────────────────────────────────────────────────

const RequestEditor: React.FC<RequestEditorProps> = ({
  mode,
  requestUid,
  draftName,
  preferredCollectionId,
  preferredFolderPath,
  seedRequestContent,
  onDirtyChange,
  registerSaveRef,
  onSaveDraft,
  registerDuplicateRef,
  onExtractToWorkflow,
  workspaceId = null,
  onOpenPackageLibrary,
  onOpenResponseExample,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { requests, collections: requestCollections, getRequest, updateRequest, execute } = useRequests();

  const isCreateMode = mode === 'request-create';
  const [activeTab, setActiveTab] = useState<TabKey>('params');

  const summary = useMemo(
    () => (requestUid ? (requests.find((r) => r.uid === requestUid) ?? null) : null),
    [requests, requestUid],
  );

  const [draft, setDraft] = useState<Draft>(() =>
    // "Duplicate Tab" seeds a scratch from the source request's content.
    // `draftFromRequest` rebuilds fresh rows/arrays, so the new editor's
    // draft never shares references with the original.
    isCreateMode && seedRequestContent
      ? draftFromRequest({ schemaVersion: 5, uid: 'seed', path: '', ...seedRequestContent })
      : emptyDraft(),
  );
  const [loading, setLoading] = useState(!isCreateMode);
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveRequest, setLiveRequest] = useState<Request | null>(null);

  const [sending, setSending] = useState(false);
  // In-flight send id — mints per Send, backs the Stop button and tags
  // the live stream frames the response panel tails.
  const activeSendIdRef = useRef<string | null>(null);
  const { live, beginStream, endStream } = useLiveSendStream();
  // Edit-mode mounts check the handoff stash: a draft saved to a
  // collection swaps tabs (remounting this editor) and parks its last
  // response there so the response panel survives the save.
  const [response, setResponse] = useState<ExecutedRequestSnapshot | null>(() =>
    !isCreateMode && requestUid ? takeHandoffResponse(requestUid) : null,
  );

  // Request/response split orientation — global, persisted preference
  // (see useRequestEditorLayout). `horizontal` = side-by-side,
  // `vertical` = stacked.
  const [layout, setLayout] = useRequestEditorLayout();

  // ── Live mirror integration ───────────────────────────────────
  //
  // Subscribe to broadcasts so concurrent commits land in `liveRequest`.
  // The reprime hook below replays into the draft when clean; conflicts
  // surface against the live snapshot when dirty.
  const editingScopeWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  useEffect(() => {
    if (isCreateMode || !requestUid || !editingScopeWorkspaceId) return;
    const mirror = getRequestSyncMirrorForWorkspace(editingScopeWorkspaceId);
    const sync = () => {
      const entry = mirror.getRequestMirror(requestUid);
      setLiveRequest(entry?.request ?? null);
    };
    sync();
    return mirror.subscribeRequestMirror(requestUid, sync);
  }, [isCreateMode, requestUid, editingScopeWorkspaceId]);

  const draftCollectionId = useMemo(() => {
    const path = summary?.path;
    if (!path) return undefined;
    const hit = requestCollections.find((c) => path.startsWith(`${c.path}/`));
    return hit?.uid;
  }, [summary?.path, requestCollections]);

  // When this request is referenced by a single workflow step, surface
  // `{{step.X.Y}}` captures from strictly-earlier steps. Unique-binding
  // only: see `useRequestWorkflowStepContext` for why multi-binding
  // stays silent.
  const workflowStepCtx = useRequestWorkflowStepContext(requestUid);
  const suggestionContext = useMemo<AutoSuggestionContextValue>(
    () => ({ collectionId: draftCollectionId, workflowStep: workflowStepCtx }),
    [draftCollectionId, workflowStepCtx],
  );

  // Resolvability gate for the Send button — mirrors the DNR compile
  // gate for rules. Disabling Send up front is better UX than letting
  // the executor return an error snapshot: the user sees exactly which
  // section's refs are broken (inline red-dashed mirror + tab dots) and
  // fixes them before clicking.
  const { sectionUnresolved, hasUnresolvedRefs } = useSectionUnresolved(draft, draftCollectionId);

  // Edit mode: load full request from SW. Create mode: nothing to load.
  const initializedUidRef = useRef<string | null>(null);

  // Form-fingerprint: structural projection of the draft. Empty string
  // pre-init so useReprime has a stable input; `enabled` gates seeding
  // until the SW load completes.
  const formFingerprint = useMemo(
    () => (isInitialized ? stableStringify(buildRequestUpdates(draft)) : ''),
    [draft, isInitialized],
  );

  // Conflict-baseline ref pattern (canonical recipe — see RuleEditor /
  // EnvironmentEditor / VaultEditor).
  const setBaselineRef = useRef<(e: Request) => void>(() => undefined);
  // Save-time merge baseline: snapshot of the request at the most
  // recent re-prime — feeds `mergeRequestForSave` so the save batch
  // only carries leaves the user actually edited.
  const baselineRequestRef = useRef<Request | null>(null);

  const reprime = useReprime<Request>({
    liveEntity: liveRequest,
    scope: { entityType: REQUEST_ENTITY_TYPE, entityId: requestUid ?? null },
    enabled: isInitialized && !isCreateMode,
    formFingerprint,
    signature: (e) => stableStringify(canonicalRequestProjection(e)),
    populate: (e) => setDraft(draftFromRequest(e)),
    onPrimed: (e) => {
      setBaselineRef.current(e);
      baselineRequestRef.current = e;
    },
  });
  // Create mode: dirty until Save mints the entity. Edit mode: hook owns
  // the `formFp !== primedFp` comparison (BC1 by construction).
  const isDirty = isCreateMode ? true : reprime.isDirty;

  const conflicts = useRequestConflicts({
    liveRequest,
    isDirty,
    enabled: !isCreateMode,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const {
    allConflicts,
    headerConflictBridge,
    paramConflictBridge,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedYaml,
    baseYaml,
    mineText,
  } = useRequestConflictSurface({
    liveRequest,
    draft,
    setDraft,
    conflicts,
    isInitialized,
    isConflictDialogOpen,
    baselineRequestRef,
  });

  // Init: load full request from SW. The seed flow is:
  //   setLiveRequest → useReprime sees liveEntity → onPrimed advances
  //   the conflict baseline + primedFingerprint via auto-rebase
  //   (formFp === liveFp after populate). No manual baseline plumbing.
  useEffect(() => {
    if (isCreateMode) {
      setIsInitialized(true);
      return;
    }
    if (!summary || !requestUid || initializedUidRef.current === requestUid) return;
    initializedUidRef.current = requestUid;
    setLoading(true);
    void getRequest(requestUid).then((full) => {
      if (full) {
        setDraft(draftFromRequest(full));
        setLiveRequest(full);
      }
      setLoading(false);
      setIsInitialized(true);
    });
  }, [isCreateMode, requestUid, summary, getRequest]);

  // ── Field focus publishing ───────────────────────────────────
  //
  // RequestUrlBar's EntityField wraps the URL + method inputs and
  // publishes through `useSetActiveFieldFocus` directly. Per-row cells
  // (Headers / Params) use the existing `data-field-path` ancestor
  // scheme — the EditableGridTable shell tags each cell with the
  // canonical schema path; this editor's onFocusCapture reads the path
  // off the focused element and routes it through the same context.
  // Order of precedence: EntityField (innermost capture wins) > sub-row
  // marker.
  const setActiveFieldFocus = useSetActiveFieldFocus();
  const handleEditorFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (isCreateMode || !requestUid) return;
      const path = readFieldPath(e.target);
      if (!path) return;
      setActiveFieldFocus({ entityType: REQUEST_ENTITY_TYPE, entityId: requestUid, path });
    },
    [isCreateMode, requestUid, setActiveFieldFocus],
  );
  const handleEditorBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && e.currentTarget.contains(next)) return;
      setActiveFieldFocus(null);
    },
    [setActiveFieldFocus],
  );

  const handleSave = useCallback(async () => {
    if (isCreateMode) {
      onSaveDraft?.({
        name: draftName ?? 'New Request',
        description: draft.description.trim() ? draft.description : undefined,
        method: draft.method,
        url: draft.url,
        headers: rowsToHeaders(draft.headers),
        params: rowsToParams(draft.params),
        auth: draft.auth,
        body: draft.body,
        credentialsMode: draft.credentialsMode,
        followRedirects: draft.followRedirects,
        sslVerification: draft.sslVerification,
        tlsMinVersion: draft.tlsMinVersion,
        tlsMaxVersion: draft.tlsMaxVersion,
        tlsCipherSuites: draft.tlsCipherSuites,
        allowHttp2: draft.allowHttp2,
        resolveToAddress: draft.resolveToAddress,
        clientCertificateRef: draft.clientCertificateRef,
        proxyUrl: draft.proxyUrl,
        proxyCredentialRef: draft.proxyCredentialRef,
        unixSocketPath: draft.unixSocketPath,
        cookieJar: draft.cookieJar,
        timeoutMs: draft.timeoutMs,
        maxResponseBytes: draft.maxResponseBytes,
        maxRedirects: draft.maxRedirects,
        followOriginalHttpMethod: draft.followOriginalHttpMethod,
        followAuthorizationHeader: draft.followAuthorizationHeader,
        preRequestScript: draft.preRequestScript,
        postResponseScript: draft.postResponseScript,
        response,
      });
      return;
    }
    if (!requestUid || !isDirty) return;
    // Save-time per-field merge: rebases the form against the latest
    // canonical so the batch only carries leaves the user actually
    // edited. Closes the race window where a peer commit broadcasts
    // between the auto-merge effect's previous tick and this save.
    const updates = mergeRequestForSave(buildRequestUpdates(draft), baselineRequestRef.current, liveRequest);
    const result = await updateRequest(requestUid, updates);
    if (result.ok) {
      conflicts.clearDismissed();
      // Dirty derives from form-vs-canonical equality; the broadcast
      // echo brings live in line with form, auto-rebase clears.
    } else if (result.reason === 'not-found') {
      message.error(t('workbench.editors.request.toast.deletedOtherTab'));
    } else {
      message.error(
        'message' in result
          ? t('workbench.editors.request.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.request.toast.updateFailed'),
      );
    }
  }, [
    isCreateMode,
    requestUid,
    draft,
    draftName,
    isDirty,
    liveRequest,
    response,
    updateRequest,
    onSaveDraft,
    conflicts,
    message,
    t,
  ]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  // ── Duplicate snapshot ─────────────────────────────────────────
  // Publish a fn that projects the LIVE draft (incl. uncommitted edits)
  // into content-only request data so "Duplicate Tab" can seed a fresh
  // scratch. draft + name ride refs so the published closure stays
  // stable while always reading current values.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const requestNameRef = useRef('');
  requestNameRef.current = summary?.name ?? draftName ?? 'New Request';
  useEffect(() => {
    registerDuplicateRef?.(() => ({ name: requestNameRef.current, ...buildRequestUpdates(draftRef.current) }));
  }, [registerDuplicateRef]);

  const shell = useEditorShell({
    entityType: REQUEST_ENTITY_TYPE,
    entityId: requestUid ?? null,
    isDirty,
    isComplete: liveRequest ? isRequestComplete(liveRequest) : undefined,
    isUnresolved: hasUnresolvedRefs,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  // Save Response — freeze the current exchange as an example under
  // this request. Captures the AUTHORED request shape (draft rows as
  // edited, variable refs unresolved) plus the executed response
  // snapshot; auth and scripts are deliberately excluded (see the
  // ResponseExample schema).
  const handleSaveResponse = useCallback(async () => {
    if (!summary || !requestUid || !editingScopeWorkspaceId || !response || response.error !== null) return;
    const mirror = getResponseExampleSyncMirrorForWorkspace(editingScopeWorkspaceId);
    await mirror.hydrated;
    const name = nextExampleName(mirror, requestUid, summary.name);
    const result = await applyResponseExampleCreate(
      {
        requestPath: summary.path,
        example: {
          requestUid,
          name,
          capturedAt: new Date().toISOString(),
          request: {
            method: draft.method,
            url: draft.url,
            headers: rowsToHeaders(draft.headers),
            params: rowsToParams(draft.params),
            body: draft.body,
          },
          response: capturedResponseFromSnapshot(response),
        },
      },
      { workspaceId: editingScopeWorkspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      message.success(t('workbench.editors.request.toast.savedExample', { name }));
      onOpenResponseExample?.(result.responseExample.uid, name, requestUid);
    } else {
      message.error(
        'message' in result && result.message
          ? t('workbench.editors.request.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.request.toast.saveExampleFailed'),
      );
    }
  }, [summary, requestUid, editingScopeWorkspaceId, response, draft, message, onOpenResponseExample, t]);

  const handleSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setResponse(null);

    let path = summary?.path;
    if (!path) {
      const preferredCollection = preferredCollectionId
        ? requestCollections.find((c) => c.uid === preferredCollectionId)
        : null;
      const parentPath = preferredFolderPath ?? preferredCollection?.path ?? 'requests/draft';
      path = `${parentPath}/draft`;
    }

    const draftRequest: Request = {
      schemaVersion: 5,
      uid: summary?.uid ?? 'draft',
      path,
      name: summary?.name ?? draftName ?? 'Draft',
      description: draft.description.trim() ? draft.description : undefined,
      method: draft.method,
      url: draft.url,
      headers: rowsToHeaders(draft.headers),
      params: rowsToParams(draft.params),
      auth: draft.auth,
      body: draft.body,
      credentialsMode: draft.credentialsMode,
      followRedirects: draft.followRedirects,
      sslVerification: draft.sslVerification,
      tlsMinVersion: draft.tlsMinVersion,
      tlsMaxVersion: draft.tlsMaxVersion,
      tlsCipherSuites: draft.tlsCipherSuites,
      allowHttp2: draft.allowHttp2,
      resolveToAddress: draft.resolveToAddress,
      clientCertificateRef: draft.clientCertificateRef,
      proxyUrl: draft.proxyUrl,
      proxyCredentialRef: draft.proxyCredentialRef,
      unixSocketPath: draft.unixSocketPath,
      cookieJar: draft.cookieJar,
      timeoutMs: draft.timeoutMs,
      maxResponseBytes: draft.maxResponseBytes,
      maxRedirects: draft.maxRedirects,
      followOriginalHttpMethod: draft.followOriginalHttpMethod,
      followAuthorizationHeader: draft.followAuthorizationHeader,
      // Test-fire must run the same pre-request / post-response scripts a
      // saved send would — without these the sandbox hooks are skipped and
      // the response panel never shows the script outcome.
      preRequestScript: draft.preRequestScript,
      postResponseScript: draft.postResponseScript,
    };
    // Mint the send id and open the live-stream feed BEFORE the RPC
    // goes out — the head frame can arrive while the call is pending.
    // The resolving snapshot supersedes every frame.
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    beginStream(sendId);
    const snapshot = await execute({ draft: draftRequest, sendId });
    activeSendIdRef.current = null;
    endStream();
    setSending(false);
    setResponse(snapshot);
  }, [
    sending,
    summary,
    draftName,
    draft,
    execute,
    beginStream,
    endStream,
    preferredCollectionId,
    preferredFolderPath,
    requestCollections,
  ]);

  // Stop the in-flight send — the host aborts the exchange and the
  // pending `execute` above resolves with a snapshot materialized from
  // whatever arrived. Fire-and-forget: hosts without the streaming leg
  // reject the RPC and the send simply runs to completion as before.
  const handleStop = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('abortRequestSend', { sendId }).catch(() => {});
  }, []);

  // ⌘/Ctrl+Enter sends from anywhere in the editor — same gate as the
  // Send button. Capture phase so Send owns the chord even when focus
  // sits inside a Monaco surface (script editors, the response body
  // view, the filter input), all of which would otherwise claim
  // ⌘+Enter for insert-line-below and starve the shortcut.
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();
      if (sending || hasUnresolvedRefs) return;
      void handleSend();
    },
    [sending, hasUnresolvedRefs, handleSend],
  );

  if (!isCreateMode && !summary) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.request.notFound')}</Text>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.request.loading')}
        </Text>
      </div>
    );
  }

  const tabItems = buildRequestTabItems(draft, sectionUnresolved, t, <ScriptModeTag workspaceId={workspaceId} />);

  // Header consolidates the full URL row: method select + URL input in
  // the title (title has flex:1 so the URL input grows), Send in the
  // actions slot, Save standardized on the right. No separate URL bar
  // row below — frees ~40px of vertical space and puts the primary
  // interaction + save in a single line (request-name label dropped:
  // the tab pill already carries that identity).
  const headerTitle = (
    <RequestUrlBar
      draft={draft}
      setDraft={setDraft}
      urlUnresolved={sectionUnresolved.url}
      onSend={() => void handleSend()}
    />
  );

  // Surfaces whose Sends execute on a remote host (the web tab's
  // serving daemon) set the expectation at the button: the egress
  // connection — the IP and locale the target sees — is that host's.
  const remoteDispatchHost = getCapability('remoteRequestDispatch')?.();

  const headerActions = (
    <Tooltip
      placement="bottom"
      title={
        sending ? (
          t('workbench.editors.request.send.stopTooltip')
        ) : hasUnresolvedRefs ? (
          t('workbench.editors.request.send.unresolvedTooltip')
        ) : (
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <ShortcutHintTitle label={SEND_SHORTCUT}>{t('workbench.editors.request.send.label')}</ShortcutHintTitle>
            {remoteDispatchHost !== undefined && (
              <span style={{ fontSize: 11, opacity: 0.75 }}>
                {t('workbench.editors.request.send.remoteDispatchHint', { host: remoteDispatchHost })}
              </span>
            )}
          </span>
        )
      }
    >
      {sending ? (
        // Send morphs into Stop for EVERY in-flight send — streaming or
        // not. Stopping materializes a snapshot from whatever arrived.
        <Button
          danger
          icon={<BorderOutlined style={{ fontSize: 9 }} />}
          size="small"
          data-testid="oh-request-stop"
          onClick={handleStop}
          style={{ fontSize: 11 }}
        >
          {t('workbench.editors.request.send.stop')}
        </Button>
      ) : (
        <Button
          type="primary"
          icon={<CaretRightOutlined />}
          size="small"
          onClick={() => void handleSend()}
          disabled={hasUnresolvedRefs}
          style={{ fontSize: 11 }}
        >
          {t('workbench.editors.request.send.label')}
        </Button>
      )}
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <SuggestionContextProvider value={suggestionContext}>
        {/* tabIndex -1: clicks on non-focusable space inside the editor
            (e.g. the response empty state) land focus on this root
            instead of falling out to <body>, so the ⌘/Ctrl+Enter Send
            chord keeps working anywhere within the panel — and only
            within it. */}
        <div
          tabIndex={-1}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', outline: 'none' }}
          onFocusCapture={handleEditorFocusCapture}
          onBlurCapture={handleEditorBlurCapture}
          onKeyDownCapture={handleEditorKeyDown}
        >
          <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />

          <EntityConflictBanner
            count={allConflicts.size}
            forceVisible={hasDialogOnlyConflict(allConflicts)}
            onReview={() => setConflictDialogOpen(true)}
            onKeepAllMine={handleKeepAllMine}
            onUseAllSaved={handleUseAllSaved}
          />

          {needsSchemeNormalization(draft.url) && (
            <div
              style={{
                padding: '4px 16px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Tooltip title={t('workbench.editors.request.schemeHint')} placement="bottomLeft">
                <span
                  style={{
                    fontSize: 11,
                    color: token.colorTextTertiary,
                    fontFamily: "'SF Mono', monospace",
                    cursor: 'help',
                  }}
                >
                  → {ensureScheme(draft.url.trim())}
                </span>
              </Tooltip>
            </div>
          )}

          {/* Editor / response split. The response pane is always
            attached so the user has a stable target before the first
            Send (empty-state hint until then). The divider is a draggable
            Allotment sash with per-pane minimums; orientation
            (`horizontal` side-by-side / `vertical` stacked) is a global
            persisted preference toggled from the Response header.

            Allotment captures its orientation at mount and ignores later
            `vertical` prop changes, so we remount on `layout` change via
            `key` (same discipline as the workbench EditorGroupRenderer).

            The sub-tab bar (Docs · Params · …) renders OUTSIDE the scroll
            container so it never participates in scrolling — simpler +
            more robust than `position: sticky`, and leaves child panes
            free to mount their own sticky rails (e.g. the Authorization
            tab's auth-type picker) without colliding with an outer sticky
            header. */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {/* Inherits the editor region's standard split seam — the same
              6px colorBgLayout band the workbench paints between dock
              panels / editor leaves — so the request/response divider
              reads consistently with the rest of the shell. */}
            <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
              {/* Vertical (stacked) minimum leaves room for the tab bar +
                the fill editors' 100-120px floors, so at the sash's travel
                limit no tab needs a fallback scrollbar. */}
              <Allotment.Pane minSize={layout === 'vertical' ? 220 : 320} preferredSize="55%">
                <div
                  className="rules-thin-scrollbar"
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
                >
                  <div style={{ padding: '8px 16px 0' }}>
                    <Tabs
                      size="small"
                      activeKey={activeTab}
                      onChange={(k) => setActiveTab(k as TabKey)}
                      items={tabItems}
                      className="rules-request-tabs"
                      tabBarStyle={{ marginBottom: 0 }}
                    />
                  </div>
                  {/* Vertical padding rides on the inner wrapper, NOT the
                    scroll container: a `position: sticky; top: 0` header
                    inside (Params / Headers / Body tables) clips at the
                    scroll container's padding box but pins at its content
                    box, so a container `padding-top` leaves a gap above the
                    header where scrolled rows bleed through. With the
                    container's vertical padding at 0 the header pins flush
                    to the scrollport top; the inner padding just scrolls
                    away. */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      overscrollBehavior: 'none',
                      padding: '0 16px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Grow-to-pane flex chain: the wrapper fills the
                      scrollport (`flex: 1 0 auto` — content height still
                      wins, so taller tabs scroll) and is a flex column so
                      pane-filling tabs (Scripts / Body / Docs editors)
                      can `flex: 1` and track the request/response divider
                      instead of sitting at a fixed height behind a
                      scrollbar. */}
                    <div style={{ padding: '10px 0', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
                      <RequestTabContent
                        tab={activeTab}
                        draft={draft}
                        setDraft={setDraft}
                        headerConflictBridge={isCreateMode ? undefined : headerConflictBridge}
                        paramConflictBridge={isCreateMode ? undefined : paramConflictBridge}
                        workspaceId={workspaceId}
                        onOpenPackageLibrary={onOpenPackageLibrary}
                        onNavigateTab={setActiveTab}
                      />
                    </div>
                  </div>
                </div>
              </Allotment.Pane>
              <Allotment.Pane minSize={layout === 'vertical' ? 120 : 280}>
                <ResponsePanel
                  response={response}
                  sending={sending}
                  live={live}
                  layout={layout}
                  onLayoutChange={setLayout}
                  onClear={() => setResponse(null)}
                  onExtractToWorkflow={
                    mode === 'request-edit' && requestUid && onExtractToWorkflow
                      ? (target) =>
                          onExtractToWorkflow(target, {
                            requestUid,
                            requestName: summary?.name ?? 'Request',
                            method: draft.method,
                          })
                      : undefined
                  }
                  onSaveResponse={
                    mode === 'request-edit' && summary ? () => void handleSaveResponse() : undefined
                  }
                  extractRequiresSave={isCreateMode}
                />
              </Allotment.Pane>
            </Allotment>
          </div>

          <EntityConflictDialog
            open={isConflictDialogOpen}
            savedText={savedYaml}
            mineText={mineText}
            baseText={baseYaml}
            language="yaml"
            onResolveText={handleResolveText}
            onClose={() => setConflictDialogOpen(false)}
          />
        </div>
      </SuggestionContextProvider>
    </EntityScopeProvider>
  );
};

export default RequestEditor;
