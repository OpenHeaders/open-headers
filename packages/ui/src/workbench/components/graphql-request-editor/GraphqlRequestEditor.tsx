/**
 * GraphqlRequestEditor — tab body for one GraphqlRequest entity, in the
 * family's own chrome: EditorHeader ONE row = the endpoint URL + the
 * operation select (shown only when the document holds more than one
 * operation — it writes `operationName`) + the Query button (the HTTP
 * Send ⇄ Stop morph and the ⌘/Ctrl+Enter chord verbatim; no method
 * select, the transport is fixed), then the seven tabs — Docs · Query
 * (the docs explorer over the resolved schema + the Monaco `graphql`
 * editor fed the same schema + the Variables drawer) · Authorization
 * (the HTTP mask + the ancestor pool: a GraphQL request presents as
 * `http` to the auth mask) · Headers (own rows + the auto trio) ·
 * Schema (the source select: introspection through the compile, a
 * linked `graphql` Spec, an imported file) · Scripts (the frozen HTTP
 * pair, labelled Before query / After response) · Settings (the HTTP
 * tab as kind `http` — the container's `http` slice on the ancestor
 * plane) — and the HTTP response pane BELOW (the HTTP editor's split,
 * never a drawer) with the GraphQL `errors[]` / `extensions` strip
 * tags.
 *
 * Query test-fires the LIVE draft: the executing host compiles the
 * entity ONCE into its HTTP send (`executeGraphqlRequest`), so the
 * answer IS an HTTP snapshot with the auth / inherited-settings /
 * script attribution the pane already renders. A picked SUBSCRIPTION
 * is the one operation that leaves the POST: Query opens it over the
 * WebSocket plane (`executeGraphqlSubscription` — the URL derived, the
 * `graphql-transport-ws` client mounted), the WebSocket session pane
 * replaces the HTTP response pane with the subscription's phase and
 * events leading its strip, and Query morphs to Stop (the client's
 * `complete`, then the clean close). Save Response freezes
 * the exchange as an HTTP `ResponseExample` marked `requestKind:
 * 'graphql'`, nested under this request. Dirty derives from
 * form-vs-canonical equality via `useReprime` (never setDirty); saves
 * flow through the RequestsContext's `updateGraphqlRequest`.
 */

import { CaretRightOutlined, CopyOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import {
  censusDocument,
  compileGraphqlRequest,
  parseDocument,
  selectedOperation,
  toHttpRequest,
  wireOperationName,
} from '@openheaders/core/graphql';
import { GRAPHQL_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ExecutedRequestSnapshot, GraphqlRequest as GraphqlRequestEntity } from '@openheaders/core/types';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { getResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { isMac } from '@openheaders/ui/shared/platform';
import {
  applyResponseExampleCreate,
  nextExampleName,
} from '@openheaders/ui/shared/sync/response-example-write-client';
import { applySpecCreate } from '@openheaders/ui/shared/sync/spec-write-client';
import { Allotment } from 'allotment';
import { App, Button, ConfigProvider, Input, type MenuProps, Select, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useCopyRequestSnippet } from '../../hooks/useCopyRequestSnippet';
import {
  ancestorScriptLevels,
  findRequestAncestry,
  resolveInheritedAuthFor,
  settingsChainOf,
} from '../request-container/ancestry';
import AuthorizationTab from '../request-editor/AuthorizationTab';
import DocsTab from '../request-editor/DocsTab';
import { TabDot } from '../request-editor/request-tab-items';
import { graphqlResponseFacts } from '../request-editor/response/graphql-response';
import ResponsePanel from '../request-editor/response/ResponsePanel';
import ScriptsTab from '../request-editor/ScriptsTab';
import SettingsTab, { type RequestSettingsDraft } from '../request-editor/SettingsTab';
import { type SseStreamSession, useLiveSendStream } from '../request-editor/useLiveSendStream';
import { useRequestEditorLayout } from '../request-editor/useRequestEditorLayout';
import { capturedResponseFromSnapshot } from '../response-example/example-draft';
import type { OpenContainerScripts } from '../script-editor/AncestorScriptsLine';
import { scriptSlotValuesOf, withScriptSlot } from '../script-editor/script-slots';
import EditorHeader from '../shell/EditorHeader';
import {
  type InheritedSettingsView,
  inheritedSettingsViewFor,
  NO_INHERITED_SETTINGS,
} from '../shared/inherited-settings/inherited-settings';
import { createImportedGraphqlSpecSeed } from '../specs/spec-scaffold';
import WsSessionPane from '../websocket-request-editor/WsSessionPane';
import {
  buildGraphqlRequestUpdates,
  canonicalGraphqlRequestProjection,
  draftEntity,
  draftFromGraphqlRequest,
  emptyGraphqlDraft,
  type GraphqlDraft,
  graphqlSettingsSlice,
} from './draft';
import GraphqlHeadersTab from './GraphqlHeadersTab';
import GraphqlQueryTab from './GraphqlQueryTab';
import GraphqlSchemaTab from './GraphqlSchemaTab';
import GraphqlSubscriptionTags from './GraphqlSubscriptionTags';
import { useGraphqlSubscriptionState } from './graphql-subscription';
import { useGraphqlSchema } from './use-graphql-schema';
import { useGraphqlSubscriptionPlane } from './useGraphqlSubscriptionPlane';

const { Text } = Typography;

const QUERY_SHORTCUT = isMac ? '⌘↵' : 'Ctrl+Enter';

interface GraphqlRequestEditorProps {
  graphqlRequestUid: string;
  workspaceId: string | null;
  /** Open a saved response example in its viewer tab — called right
   *  after "Save Response" mints one so the frozen exchange is
   *  immediately inspectable. */
  onOpenResponseExample?: (uid: string, name: string, requestUid: string) => void;
  /** Opens a container's Authorization section — the Auth tab's
   *  "Edit in …" opener under Inherit. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  /** Opens a container's Scripts section — the Scripts tab's "Runs
   *  after …" level links. */
  onOpenContainerScripts?: OpenContainerScripts;
  /** Opens a container's Settings section — the Settings rows'
   *  "Inherited from … · Edit in parent" line. */
  onOpenContainerSettings?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  /** Open the Package Library tab (the Scripts tab's Packages popover footer). */
  onOpenPackageLibrary?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

/** The Settings tab hands back the whole slice — every knob lands on
 *  the draft explicitly, so a cleared knob reads `undefined` (the
 *  tri-state) instead of keeping a stale value. */
function withSettings(draft: GraphqlDraft, next: RequestSettingsDraft): GraphqlDraft {
  return {
    ...draft,
    credentialsMode: next.credentialsMode,
    followRedirects: next.followRedirects,
    sslVerification: next.sslVerification,
    tlsMinVersion: next.tlsMinVersion,
    tlsMaxVersion: next.tlsMaxVersion,
    tlsCipherSuites: next.tlsCipherSuites,
    sniServerName: next.sniServerName,
    httpVersion: next.httpVersion,
    resolveToAddress: next.resolveToAddress,
    clientCertificateRef: next.clientCertificateRef,
    proxyMode: next.proxyMode,
    proxyUrl: next.proxyUrl,
    proxyCredentialRef: next.proxyCredentialRef,
    unixSocketPath: next.unixSocketPath,
    cookieJar: next.cookieJar,
    timeoutMs: next.timeoutMs,
    maxResponseBytes: next.maxResponseBytes,
    maxRedirects: next.maxRedirects,
    followOriginalHttpMethod: next.followOriginalHttpMethod,
    followAuthorizationHeader: next.followAuthorizationHeader,
  };
}

const GraphqlRequestEditor: React.FC<GraphqlRequestEditorProps> = ({
  graphqlRequestUid,
  workspaceId,
  onOpenResponseExample,
  onOpenContainerAuth,
  onOpenContainerScripts,
  onOpenContainerSettings,
  onOpenPackageLibrary,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const { collections, collectionTrees, folders, graphqlRequests, updateGraphqlRequest, executeGraphql } =
    useRequests();
  const editingScopeWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  const copySnippet = useCopyRequestSnippet();

  const entity = useMemo(
    () => graphqlRequests.find((r) => r.uid === graphqlRequestUid) ?? null,
    [graphqlRequests, graphqlRequestUid],
  );

  const [draft, setDraft] = useState<GraphqlDraft>(() =>
    entity ? draftFromGraphqlRequest(entity) : emptyGraphqlDraft(),
  );

  // What Inherit resolves to, and from which level — read off the
  // trees (the containment projection), never a stored path. The
  // ancestry itself feeds the Auth tab's Inherited group.
  const ancestry = useMemo(
    () => (entity ? findRequestAncestry(collectionTrees, collections, folders, entity.uid) : undefined),
    [entity, collectionTrees, collections, folders],
  );
  const inheritedAuth = useMemo(
    () =>
      ancestry === undefined
        ? undefined
        : resolveInheritedAuthFor(ancestry, draft.auth.type === 'inherit' ? draft.auth : {}, draft.url),
    [ancestry, draft.auth, draft.url],
  );
  const ancestorScripts = useMemo(() => ancestorScriptLevels(ancestry ?? null), [ancestry]);
  // The HTTP slice of the chain — a GraphQL request is an HTTP send
  // for the settings rule (the wire-family law).
  const inheritedSettings = useMemo<InheritedSettingsView>(
    () =>
      ancestry
        ? inheritedSettingsViewFor('http', settingsChainOf(ancestry), 'request', onOpenContainerSettings)
        : { ...NO_INHERITED_SETTINGS, onOpenSource: onOpenContainerSettings },
    [ancestry, onOpenContainerSettings],
  );
  const [activeTab, setActiveTab] = useState('query');
  // The Query tab's explorer pane, folded or not — here so a tab switch keeps it (the WS rail's owner).
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);

  // ── Schema plane ─────────────────────────────────────────────────
  // The resolved schema feeds the explorer, the editor services and
  // the variables validation; introspection rides the compile.
  const schemaState = useGraphqlSchema({ entity, draft, workspaceId, executeGraphql });
  // The last introspection's failure — the explorer's card and the
  // Schema tab's dot read the same line.
  const introspectionError = schemaState.introspection.kind === 'error' ? schemaState.introspection.message : null;
  const schemaFileInputRef = useRef<HTMLInputElement>(null);
  const handleImportSchema = useCallback(() => schemaFileInputRef.current?.click(), []);
  // An SDL / introspection file lands as a `graphql` Spec (the synced
  // form) and links here — the gRPC editor's .proto import recipe.
  const handleSchemaFilePicked = useCallback(
    async (file: File) => {
      if (!workspaceId) return;
      const text = await file.text().catch((err: Error) => err);
      if (text instanceof Error) {
        toast.error(t('workbench.editors.graphql.schema.importReadFailed', { message: text.message }));
        return;
      }
      const name = file.name.replace(/\.(graphql|gql|graphqls|json)$/i, '') || file.name;
      const result = await applySpecCreate(
        { spec: createImportedGraphqlSpecSeed(name, file.name, text) },
        { workspaceId, surfaceId: 'workbench' },
      );
      if (!result.ok) {
        toast.error(t('workbench.editors.graphql.schema.importFailed'));
        return;
      }
      setDraft((d) => ({ ...d, specLink: { specUid: result.spec.uid } }));
      toast.success(t('workbench.editors.graphql.schema.imported', { name }));
    },
    [workspaceId, toast, t],
  );

  // ONE parse of the document per keystroke — the Query tab's prettify
  // / generate gestures, the operation select and the send all read it.
  const parsed = useMemo(() => parseDocument(draft.query), [draft.query]);
  const census = useMemo(() => (parsed.document === null ? null : censusDocument(parsed.document)), [parsed]);
  // The select's choices: the document's named operations. It shows
  // only when there is more than one operation — with one, the wire
  // carries no name (the census's rule).
  const operationNames = useMemo(
    () => (census === null ? [] : census.operations.flatMap((entry) => (entry.name === null ? [] : [entry.name]))),
    [census],
  );
  const showOperationSelect = census !== null && census.operations.length > 1;
  const wireOperation =
    census === null ? undefined : wireOperationName(census, draft.operationName === '' ? undefined : draft.operationName);
  // The operation Query runs — a subscription leaves the POST for the
  // WebSocket plane (the census's pick rule, so the wire and the
  // button agree).
  const pickedOperation = census === null ? null : selectedOperation(census, wireOperation);
  const isSubscription = pickedOperation?.operation === 'subscription';

  const formFingerprint = useMemo(() => stableStringify(buildGraphqlRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: GRAPHQL_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: GraphqlRequestEntity) => stableStringify(canonicalGraphqlRequestProjection(e)),
    populate: (e: GraphqlRequestEntity) => setDraft(draftFromGraphqlRequest(e)),
  });
  const isDirty = reprime.isDirty;

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!entity || !isDirty) return;
    const result = await updateGraphqlRequest(entity.uid, buildGraphqlRequestUpdates(draft));
    if (result.ok) return;
    if (result.reason === 'not-found') {
      toast.error(t('workbench.editors.graphql.toast.deletedOtherTab'));
    } else {
      toast.error(
        result.message
          ? t('workbench.editors.graphql.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.graphql.toast.updateFailed'),
      );
    }
  }, [entity, isDirty, draft, updateGraphqlRequest, toast, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: GRAPHQL_REQUEST_ENTITY_TYPE,
    entityId: entity?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  // ── Query (the HTTP Send recipe) ─────────────────────────────────
  const [sending, setSending] = useState(false);
  // Pressing Stop suppresses the Query/Stop tooltip until the pointer
  // leaves the button — the hint must not linger over the morph.
  const [queryTooltipSuppressed, setQueryTooltipSuppressed] = useState(false);
  // In-flight send id — mints per Query, backs the Stop button and tags
  // the live stream frames the response panel tails.
  const activeSendIdRef = useRef<string | null>(null);
  const { live, beginStream, endStream, takeSseSession } = useLiveSendStream();
  const [sseSession, setSseSession] = useState<SseStreamSession | null>(null);
  const [response, setResponse] = useState<ExecutedRequestSnapshot | null>(null);
  const [layout, setLayout] = useRequestEditorLayout();
  // The `errors[]` / `extensions` facts of the answer — derived once per
  // snapshot; an error snapshot carries no body to read.
  const graphqlFacts = useMemo(
    () => (response === null || response.error !== null ? null : graphqlResponseFacts(response)),
    [response],
  );

  // ── The subscription plane (a picked `subscription` operation) ──
  const subscription = useGraphqlSubscriptionPlane({
    entity,
    draft,
    operationName: wireOperation,
    sslVerification: draft.sslVerification ?? inheritedSettings.settings.sslVerification ?? true,
    workspaceId,
  });
  const subscriptionState = useGraphqlSubscriptionState(subscription.live, subscription.snapshot);
  const subscriptionPaneOpen = subscription.live !== null || subscription.snapshot !== null;
  const inFlight = sending || subscription.inFlight;

  const handleQuery = useCallback(async () => {
    if (!entity || inFlight) return;
    if (isSubscription) {
      if (subscription.disabledReason !== null) return;
      // The session pane takes the response slot — a settled HTTP
      // answer clears with it.
      setResponse(null);
      await subscription.handleSubscribe();
      return;
    }
    subscription.handleClear();
    setSending(true);
    setResponse(null);
    // Mint the send id and open the live-stream feed BEFORE the RPC
    // goes out — the head frame can arrive while the call is pending.
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setSseSession(null);
    beginStream(sendId);
    const snapshot = await executeGraphql({ draft: draftEntity(entity, draft), sendId });
    activeSendIdRef.current = null;
    const session = takeSseSession();
    endStream();
    setSending(false);
    setResponse(snapshot);
    setSseSession(session === null ? null : { ...session, endedAt: Date.now() });
  }, [entity, inFlight, isSubscription, subscription, draft, executeGraphql, beginStream, endStream, takeSseSession]);

  // Stop the in-flight query — the host aborts the exchange and the
  // pending `executeGraphql` resolves with a snapshot materialized from
  // whatever arrived. An open subscription stops through its own
  // plane (the client's complete, then the clean close).
  const handleStop = useCallback(() => {
    if (subscription.inFlight) {
      subscription.handleStop();
      return;
    }
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('abortRequestSend', { sendId }).catch(() => {});
  }, [subscription]);

  // ⌘/Ctrl+Enter queries from anywhere in the editor — the same MORPH as
  // the button: while a query is in flight the chord stops it. Capture
  // phase so Query owns the chord even when focus sits inside a Monaco
  // surface (the document, the variables, the scripts).
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();
      if (inFlight) {
        handleStop();
        return;
      }
      void handleQuery();
    },
    [inFlight, handleQuery, handleStop],
  );

  // Save Response — freeze the current exchange as an example under
  // this request: the AUTHORED request shape as the compile sends it
  // (POST, the envelope body, variable refs unresolved) plus the
  // executed response, marked `requestKind: 'graphql'` so the readers
  // know the parent kind. Auth and scripts stay excluded (the
  // ResponseExample schema's law).
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !editingScopeWorkspaceId || !response || response.error !== null) return;
    const mirror = getResponseExampleSyncMirrorForWorkspace(editingScopeWorkspaceId);
    await mirror.hydrated;
    const name = nextExampleName(mirror, entity.uid, entity.name);
    const compiled = toHttpRequest(draftEntity(entity, draft));
    const result = await applyResponseExampleCreate(
      {
        requestPath: entity.path,
        example: {
          requestUid: entity.uid,
          requestKind: 'graphql',
          name,
          capturedAt: new Date().toISOString(),
          request: {
            method: compiled.method,
            url: compiled.url,
            headers: compiled.headers,
            params: compiled.params,
            body: compiled.body,
          },
          response: capturedResponseFromSnapshot(response),
        },
      },
      { workspaceId: editingScopeWorkspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.request.toast.savedExample', { name }));
      onOpenResponseExample?.(result.responseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.request.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.request.toast.saveExampleFailed'),
      );
    }
  }, [entity, editingScopeWorkspaceId, response, draft, toast, onOpenResponseExample, t]);

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.graphql.notFound')}</Text>
      </div>
    );
  }

  // Header: the endpoint in the title slot beside the operation select
  // (no method select — every GraphQL operation is one POST), Query in
  // the actions slot next to the standardized Save.
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.graphql.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="graphql-url-input"
      />
      {showOperationSelect && (
        <Tooltip title={t('workbench.editors.graphql.operation.tooltip')} placement="bottom">
          <Select
            size="small"
            style={{ width: 160, flexShrink: 0 }}
            value={wireOperation}
            placeholder={t('workbench.editors.graphql.operation.placeholder')}
            options={operationNames.map((name) => ({ value: name, label: name }))}
            onChange={(name: string) => setDraft((d) => ({ ...d, operationName: name }))}
            data-testid="graphql-operation-select"
          />
        </Tooltip>
      )}
    </div>
  );

  // Surfaces whose sends execute on a remote host (the web tab's
  // serving daemon) set the expectation at the button.
  const remoteDispatchHost = getCapability('remoteRequestDispatch')?.();

  // ⋯ menu — snippet copies of the CURRENT draft through the compile
  // (one POST of the envelope, the operation pick applied), resolved
  // host-side exactly as a Query would resolve it.
  const overflowItems: MenuProps['items'] = [
    {
      key: 'copy-as-curl',
      icon: <CopyOutlined />,
      label: t('workbench.editors.request.menu.copyAsCurl'),
      onClick: () => void copySnippet({ draft: compileGraphqlRequest(draftEntity(entity, draft)) }, 'curl'),
    },
    {
      key: 'copy-as-fetch',
      icon: <CopyOutlined />,
      label: t('workbench.editors.request.menu.copyAsFetch'),
      onClick: () => void copySnippet({ draft: compileGraphqlRequest(draftEntity(entity, draft)) }, 'fetch'),
    },
  ];

  // A subscription that cannot open on this host names why on the
  // button — the honest disabled posture, never a silent no-op.
  const queryDisabledReason = isSubscription ? subscription.disabledReason : null;
  const headerActions = (
    <Tooltip
      placement="bottom"
      open={queryTooltipSuppressed ? false : undefined}
      title={
        queryDisabledReason !== null ? (
          queryDisabledReason
        ) : inFlight ? (
          <ShortcutHintTitle label={QUERY_SHORTCUT}>
            {t(
              isSubscription
                ? 'workbench.editors.graphql.subscription.stopTooltip'
                : 'workbench.editors.graphql.query.stopTooltip',
            )}
          </ShortcutHintTitle>
        ) : (
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <ShortcutHintTitle label={QUERY_SHORTCUT}>
              {t(isSubscription ? 'workbench.editors.graphql.subscription.tooltip' : 'workbench.editors.graphql.query.label')}
            </ShortcutHintTitle>
            {remoteDispatchHost !== undefined && (
              <span style={{ fontSize: 11, opacity: 0.75 }}>
                {t('workbench.editors.request.send.remoteDispatchHint', { host: remoteDispatchHost })}
              </span>
            )}
          </span>
        )
      }
    >
      <span style={{ display: 'inline-flex' }} onMouseLeave={() => setQueryTooltipSuppressed(false)}>
        {inFlight ? (
          // Query morphs into Stop for every in-flight send — the HTTP
          // editor's recipe, error token darkened one notch.
          <ConfigProvider theme={{ token: { colorError: token.colorErrorActive } }}>
            <Button
              type="primary"
              danger
              icon={
                <span
                  aria-hidden="true"
                  style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'currentcolor' }}
                />
              }
              size="small"
              data-testid="graphql-stop-button"
              onClick={() => {
                setQueryTooltipSuppressed(true);
                handleStop();
              }}
              style={{ fontSize: 11 }}
            >
              {t('workbench.editors.graphql.query.stop')}
            </Button>
          </ConfigProvider>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<CaretRightOutlined />}
            onClick={() => {
              setQueryTooltipSuppressed(true);
              void handleQuery();
            }}
            style={{ fontSize: 11 }}
            disabled={queryDisabledReason !== null}
            data-testid="graphql-query-button"
          >
            {t('workbench.editors.graphql.query.label')}
          </Button>
        )}
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      {/* tabIndex -1: clicks on non-focusable space land focus on this
          root instead of <body>, so the ⌘/Ctrl+Enter chord keeps
          working anywhere within the editor — and only within it. */}
      <div
        tabIndex={-1}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
          overflow: 'hidden',
          outline: 'none',
        }}
        onKeyDownCapture={handleEditorKeyDown}
      >
        <EditorHeader
          title={headerTitle}
          actions={headerActions}
          overflowItems={overflowItems}
          shell={shell.headerProps}
        />
        <input
          ref={schemaFileInputRef}
          type="file"
          accept=".graphql,.gql,.graphqls,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleSchemaFilePicked(file);
          }}
          data-testid="graphql-schema-file-input"
        />
        {/* Editor / response split — the HTTP editor's layout: the
            response pane is always attached below (or beside), the
            orientation is the shared persisted preference, and
            Allotment remounts on `layout` (it captures its orientation
            at mount). */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment key={layout} vertical={layout === 'vertical'} proportionalLayout separator>
            <Allotment.Pane minSize={layout === 'vertical' ? 220 : 320} preferredSize="55%">
              <div
                className="rules-thin-scrollbar"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
              >
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'docs', label: t('workbench.editors.graphql.tab.docs') },
                      { key: 'query', label: t('workbench.editors.graphql.tab.query') },
                      { key: 'authorization', label: t('workbench.editors.graphql.tab.authorization') },
                      { key: 'headers', label: t('workbench.editors.graphql.tab.headers') },
                      {
                        key: 'schema',
                        label: (
                          <>
                            {t('workbench.editors.graphql.tab.schema')}
                            {introspectionError !== null && <TabDot tone="error" />}
                          </>
                        ),
                      },
                      { key: 'scripts', label: t('workbench.editors.graphql.tab.scripts') },
                      { key: 'settings', label: t('workbench.editors.graphql.tab.settings') },
                    ]}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    overscrollBehavior: 'none',
                    padding: '0 12px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '10px 0', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'docs' && (
                      <DocsTab
                        value={draft.description}
                        onChange={(description) => setDraft((d) => ({ ...d, description }))}
                      />
                    )}
                    {activeTab === 'query' && (
                      <GraphqlQueryTab
                        draft={draft}
                        setDraft={setDraft}
                        parsed={parsed}
                        schema={schemaState.schema}
                        explorerCollapsed={explorerCollapsed}
                        onExplorerCollapsedChange={setExplorerCollapsed}
                        sources={{
                          canIntrospect: draft.url.trim() !== '',
                          introspecting: schemaState.introspection.kind === 'loading',
                          onIntrospect: () => void schemaState.introspect(),
                          refreshable: schemaState.choice === 'introspection',
                          error: introspectionError,
                          onUseSpec: () => setActiveTab('schema'),
                          onImportSchema: handleImportSchema,
                        }}
                      />
                    )}
                    {activeTab === 'authorization' && (
                      <AuthorizationTab
                        auth={draft.auth}
                        onChange={(auth) => setDraft((d) => ({ ...d, auth }))}
                        inheritedFrom={inheritedAuth}
                        ancestry={ancestry}
                        url={draft.url}
                        onOpenContainerAuth={onOpenContainerAuth}
                      />
                    )}
                    {activeTab === 'headers' && (
                      <GraphqlHeadersTab
                        rows={draft.headers}
                        onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
                        auth={draft.auth}
                        inheritedFrom={inheritedAuth}
                      />
                    )}
                    {activeTab === 'schema' && (
                      <GraphqlSchemaTab
                        state={schemaState}
                        specLink={draft.specLink}
                        hasUrl={draft.url.trim() !== ''}
                        onSpecLinkChange={(specUid) =>
                          setDraft((d) => ({ ...d, specLink: specUid === undefined ? undefined : { specUid } }))
                        }
                        onImportSchema={handleImportSchema}
                      />
                    )}
                    {activeTab === 'scripts' && (
                      <ScriptsTab
                        scope="request"
                        requestKind="graphql"
                        scripts={scriptSlotValuesOf(draft)}
                        onScriptChange={(kind, value) => setDraft((d) => withScriptSlot(d, kind, value))}
                        slotLabels={{
                          'pre-request': 'workbench.editors.graphql.scripts.beforeQuery',
                          'post-response': 'workbench.editors.graphql.scripts.afterResponse',
                        }}
                        workspaceId={workspaceId}
                        onOpenPackageLibrary={onOpenPackageLibrary}
                        ancestorScripts={ancestorScripts}
                        onOpenContainerScripts={onOpenContainerScripts}
                      />
                    )}
                    {activeTab === 'settings' && (
                      <SettingsTab
                        scope="request"
                        workspaceId={workspaceId}
                        inherited={inheritedSettings}
                        value={graphqlSettingsSlice(draft)}
                        onChange={(next) => setDraft((d) => withSettings(d, next))}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={layout === 'vertical' ? 120 : 280}>
              {subscriptionPaneOpen ? (
                // The subscription's session pane — the WebSocket
                // editor's, the protocol's facts leading its strip. No
                // Save Response: an HTTP example carries a status the
                // session never had.
                <WsSessionPane
                  live={subscription.live}
                  snapshot={subscription.snapshot}
                  timing={subscription.timing}
                  hostNotice={subscription.hostNotice}
                  flavor="raw"
                  title={t('workbench.editors.graphql.subscription.paneTitle')}
                  leadingTags={<GraphqlSubscriptionTags state={subscriptionState} live={subscription.live !== null} />}
                  onClear={subscription.handleClear}
                  onReconnect={() => void handleQuery()}
                />
              ) : (
                <ResponsePanel
                  response={response}
                  sending={sending}
                  live={live}
                  sseSession={sseSession}
                  layout={layout}
                  onLayoutChange={setLayout}
                  onClear={() => setResponse(null)}
                  onSaveResponse={() => void handleSaveResponse()}
                  onResend={() => void handleQuery()}
                  graphql={graphqlFacts}
                />
              )}
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default GraphqlRequestEditor;
