/**
 * GraphqlRequestEditor — tab body for one GraphqlRequest entity, in the
 * family's own chrome: EditorHeader ONE row = the endpoint URL + the
 * Query button (disabled with honest copy until the execution slice
 * lands — the CTA-scaffold law; no method select, the transport is
 * fixed), then the seven tabs — Docs · Query (the explorer scaffold +
 * the Monaco `graphql` editor + the Variables drawer) · Authorization
 * (the HTTP mask + the ancestor pool: a GraphQL request presents as
 * `http` to the auth mask) · Headers (own rows + the auto trio) ·
 * Schema (the source picker shell) · Scripts (the frozen HTTP pair,
 * labelled Before query / After response) · Settings (the HTTP tab as
 * kind `http` — the container's `http` slice on the ancestor plane).
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateGraphqlRequest`.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import { GRAPHQL_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { GraphqlRequest as GraphqlRequestEntity } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { App, Button, Input, Tabs, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ancestorScriptLevels,
  findRequestAncestry,
  resolveInheritedAuthFor,
  settingsChainOf,
} from '../request-container/ancestry';
import AuthorizationTab from '../request-editor/AuthorizationTab';
import DocsTab from '../request-editor/DocsTab';
import ScriptsTab from '../request-editor/ScriptsTab';
import SettingsTab, { type RequestSettingsDraft } from '../request-editor/SettingsTab';
import type { OpenContainerScripts } from '../script-editor/AncestorScriptsLine';
import { scriptSlotValuesOf, withScriptSlot } from '../script-editor/script-slots';
import EditorHeader from '../shell/EditorHeader';
import {
  type InheritedSettingsView,
  inheritedSettingsViewFor,
  NO_INHERITED_SETTINGS,
} from '../shared/inherited-settings/inherited-settings';
import {
  buildGraphqlRequestUpdates,
  canonicalGraphqlRequestProjection,
  draftFromGraphqlRequest,
  emptyGraphqlDraft,
  type GraphqlDraft,
  graphqlSettingsSlice,
} from './draft';
import GraphqlHeadersTab from './GraphqlHeadersTab';
import GraphqlQueryTab from './GraphqlQueryTab';
import GraphqlSchemaTab from './GraphqlSchemaTab';

const { Text } = Typography;

interface GraphqlRequestEditorProps {
  graphqlRequestUid: string;
  workspaceId: string | null;
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
  const { collections, collectionTrees, folders, graphqlRequests, updateGraphqlRequest } = useRequests();

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

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.graphql.notFound')}</Text>
      </div>
    );
  }

  // Header: the endpoint alone in the title slot (no method select —
  // every GraphQL operation is one POST), Query in the actions slot
  // next to the standardized Save. Until the execution slice lands
  // Query stays a visible DISABLED affordance with the honest copy —
  // never a hidden button.
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.graphql.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="graphql-url-input"
      />
    </div>
  );
  const headerActions = (
    <Tooltip placement="bottom" title={t('workbench.editors.graphql.query.pendingExecution')}>
      <span style={{ display: 'inline-flex' }}>
        <Button
          size="small"
          type="primary"
          icon={<CaretRightOutlined />}
          disabled
          style={{ fontSize: 11 }}
          data-testid="graphql-query-button"
        >
          {t('workbench.editors.graphql.query.label')}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
        }}
      >
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
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
              { key: 'schema', label: t('workbench.editors.graphql.tab.schema') },
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
              <DocsTab value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} />
            )}
            {activeTab === 'query' && <GraphqlQueryTab draft={draft} setDraft={setDraft} />}
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
            {activeTab === 'schema' && <GraphqlSchemaTab />}
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
    </EntityScopeProvider>
  );
};

export default GraphqlRequestEditor;
