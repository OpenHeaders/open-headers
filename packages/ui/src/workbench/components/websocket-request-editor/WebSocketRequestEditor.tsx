/**
 * WebSocketRequestEditor — tab body for one WebSocketRequest entity.
 *
 * Phase B editor shell: scheme lock + ws/wss URL in the header title
 * slot with Connect present but DISABLED (the session plane is the
 * next phase — the tooltip says so honestly), Docs / Message /
 * Headers / Params / AsyncAPI / Settings tabs below. The Message tab
 * is the compose stub for the raw flavor (text/JSON display toggle;
 * the payload travels verbatim either way). Headers carry the
 * node-only honesty line — browsers cannot set custom handshake
 * headers, so the extension surfaces the limit instead of silently
 * dropping rows. The AsyncAPI tab binds the ids-only specLink (the
 * gRPC service-definition tab precedent) and summarizes the census
 * live from the spec's current files — nothing cached.
 *
 * Dirty derives from form-vs-canonical equality via `useReprime`
 * (never setDirty); saves flow through the RequestsContext's
 * `updateWebSocketRequest` (the WebSocket write client under the
 * hood).
 */

import { LinkOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { type AsyncApiCensus, AsyncApiParseError, parseAsyncApi } from '@openheaders/core/asyncapi';
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from '@openheaders/core/schemas';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WebSocketRequest as WebSocketRequestEntity } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { App, Button, Input, InputNumber, Segmented, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import DocsTab from '../request-editor/DocsTab';
import KeyValueTable from '../request-editor/KeyValueTable';
import EditorHeader from '../shell/EditorHeader';
import {
  buildWebSocketRequestUpdates,
  canonicalWebSocketRequestProjection,
  draftFromWebSocketRequest,
  type WebSocketDraft,
} from './draft';

const { Text } = Typography;

interface WebSocketRequestEditorProps {
  websocketRequestUid: string;
  workspaceId: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const emptyWebSocketDraft = (): WebSocketDraft => ({
  description: '',
  url: '',
  subprotocols: [],
  headers: [],
  params: [],
  message: '',
  messageFormat: 'text',
  specLink: undefined,
  timeoutMs: undefined,
});

/** One Settings-tab row — the gRPC editor's SettingRow vocabulary. */
const SettingRow: React.FC<{ label: string; description: string; control: React.ReactNode }> = ({
  label,
  description,
  control,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '10px 0' }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text strong style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {description}
      </Text>
    </div>
    <div style={{ flexShrink: 0 }}>{control}</div>
  </div>
);

/** Flip the URL between ws:// and wss:// without touching the rest —
 *  the editor's scheme lock is string surgery on the draft URL only
 *  (templates and schemeless authorities stay as typed until locked). */
const toggleScheme = (url: string): string => {
  if (url.startsWith('wss://')) return `ws://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `wss://${url.slice('ws://'.length)}`;
  // No recognized scheme yet — locking prepends the secure one.
  return `wss://${url}`;
};

const WebSocketRequestEditor: React.FC<WebSocketRequestEditorProps> = ({
  websocketRequestUid,
  workspaceId,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message: toast } = App.useApp();
  const t = useT();
  const { websocketRequests, updateWebSocketRequest } = useRequests();
  const specs = useSpecs(workspaceId);

  const entity = useMemo(
    () => websocketRequests.find((r) => r.uid === websocketRequestUid) ?? null,
    [websocketRequests, websocketRequestUid],
  );

  const [draft, setDraft] = useState<WebSocketDraft>(() =>
    entity ? draftFromWebSocketRequest(entity) : emptyWebSocketDraft(),
  );
  const [activeTab, setActiveTab] = useState('message');

  const formFingerprint = useMemo(() => stableStringify(buildWebSocketRequestUpdates(draft)), [draft]);

  const reprime = useReprime({
    liveEntity: entity,
    scope: { entityType: WEBSOCKET_REQUEST_ENTITY_TYPE, entityId: entity?.uid ?? null },
    enabled: entity !== null,
    formFingerprint,
    signature: (e: WebSocketRequestEntity) => stableStringify(canonicalWebSocketRequestProjection(e)),
    populate: (e: WebSocketRequestEntity) => setDraft(draftFromWebSocketRequest(e)),
  });
  const isDirty = reprime.isDirty;

  // ── AsyncAPI spec binding ────────────────────────────────────────
  const asyncapiSpecs = useMemo(() => specs.filter((s) => s.format === 'asyncapi'), [specs]);
  const linkedSpec = useMemo(
    () => (draft.specLink ? (asyncapiSpecs.find((s) => s.uid === draft.specLink?.specUid) ?? null) : null),
    [asyncapiSpecs, draft.specLink],
  );

  // Census derived live from the linked spec's root file — issues
  // reported, parse failure surfaced, nothing cached (ids-only link).
  const census = useMemo((): { census: AsyncApiCensus | null; parseError: string | null } => {
    if (!linkedSpec) return { census: null, parseError: null };
    const root = linkedSpec.files.find((f) => f.uid === linkedSpec.rootFileUid);
    if (!root) return { census: null, parseError: null };
    try {
      return { census: parseAsyncApi(root.content), parseError: null };
    } catch (err) {
      return { census: null, parseError: err instanceof AsyncApiParseError ? err.message : String(err) };
    }
  }, [linkedSpec]);

  const messageActionsRef = useRef<CodeEditorActionsTarget | null>(null);

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!entity || !isDirty) return;
    const result = await updateWebSocketRequest(entity.uid, buildWebSocketRequestUpdates(draft));
    if (result.ok) return;
    if (result.reason === 'not-found') {
      toast.error(t('workbench.editors.websocket.toast.deletedOtherTab'));
    } else {
      toast.error(
        result.message
          ? t('workbench.editors.websocket.toast.updateFailedDetail', { message: result.message })
          : t('workbench.editors.websocket.toast.updateFailed'),
      );
    }
  }, [entity, isDirty, draft, updateWebSocketRequest, toast, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
    entityId: entity?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!entity) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.editors.websocket.notFound')}</Text>
      </div>
    );
  }

  const secure = !draft.url.startsWith('ws://');

  // Header consolidates the full target row (the gRPC editor's
  // discipline): scheme lock + URL in the title slot, Connect in the
  // actions slot next to the standardized Save. Connect is a visible,
  // DISABLED affordance until the session plane lands — the
  // CTA-scaffold posture with honest copy, never a hidden button.
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tag style={{ marginInlineEnd: 0, flexShrink: 0, fontSize: 10 }}>
        {entity.flavor === 'socketio'
          ? t('workbench.editors.websocket.flavor.socketio')
          : t('workbench.editors.websocket.flavor.raw')}
      </Tag>
      <Tooltip
        title={secure ? t('workbench.editors.websocket.scheme.wss') : t('workbench.editors.websocket.scheme.ws')}
      >
        <Button
          icon={
            secure ? (
              <LockOutlined style={{ color: token.colorSuccess }} />
            ) : (
              <UnlockOutlined style={{ color: token.colorWarning }} />
            )
          }
          onClick={() => setDraft((d) => ({ ...d, url: toggleScheme(d.url) }))}
          aria-label={secure ? t('workbench.editors.websocket.scheme.wss') : t('workbench.editors.websocket.scheme.ws')}
          data-testid="websocket-scheme-lock"
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.websocket.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="websocket-url-input"
      />
    </div>
  );

  const headerActions = (
    <Tooltip placement="bottom" title={t('workbench.editors.websocket.connect.disabledPhase')}>
      <span style={{ display: 'inline-flex' }}>
        <Button
          size="small"
          type="primary"
          icon={<LinkOutlined />}
          disabled
          style={{ fontSize: 11 }}
          data-testid="websocket-connect-button"
        >
          {t('workbench.editors.websocket.connect.label')}
        </Button>
      </span>
    </Tooltip>
  );

  const specFooter = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 11,
        color: token.colorTextTertiary,
      }}
    >
      <Text type="secondary" style={{ fontSize: 11 }}>
        {linkedSpec
          ? t('workbench.editors.websocket.specFooter.using', { name: linkedSpec.name })
          : t('workbench.editors.websocket.specFooter.none')}
      </Text>
      {census.census !== null && census.census.issues.length > 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.websocket.spec.issues', { count: census.census.issues.length })}
        </Text>
      )}
    </div>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
          outline: 'none',
        }}
      >
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />

        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, flex: 1 }}>
          <div style={{ padding: '0 12px' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              tabBarStyle={{ marginBottom: 0 }}
              items={[
                { key: 'docs', label: t('workbench.editors.websocket.tab.docs') },
                { key: 'message', label: t('workbench.editors.websocket.tab.message') },
                { key: 'headers', label: t('workbench.editors.websocket.tab.headers') },
                { key: 'params', label: t('workbench.editors.websocket.tab.params') },
                { key: 'spec', label: t('workbench.editors.websocket.tab.spec') },
                { key: 'settings', label: t('workbench.editors.websocket.tab.settings') },
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
              {activeTab === 'message' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                  {/* Toolbar row ABOVE the editor (the ScriptsTab
                    discipline): compose display mode on the left, the
                    labelled Find / Replace / Beautify cluster on the
                    right (Beautify is a JSON affordance). */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Segmented
                      size="small"
                      value={draft.messageFormat}
                      onChange={(messageFormat) =>
                        setDraft((d) => ({ ...d, messageFormat: messageFormat as 'text' | 'json' }))
                      }
                      options={[
                        { value: 'text', label: t('workbench.editors.websocket.message.formatText') },
                        { value: 'json', label: t('workbench.editors.websocket.message.formatJson') },
                      ]}
                      data-testid="websocket-message-format"
                    />
                    {draft.messageFormat === 'json' && (
                      <CodeEditorActions
                        target={messageActionsRef}
                        language="json"
                        labels
                        findText={t('workbench.editors.scriptEditor.find')}
                        replaceText={t('workbench.editors.scriptEditor.replace')}
                        formatText={t('workbench.editors.scriptEditor.beautify')}
                      />
                    )}
                  </div>
                  {/* Absolute inset host — a fill editor must not size
                    its own flex parent (the BodyTab discipline). */}
                  <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                      <CodeEditor
                        value={draft.message}
                        onChange={(message) => setDraft((d) => ({ ...d, message }))}
                        language={draft.messageFormat === 'json' ? 'json' : 'text'}
                        fill
                        actions="external"
                        actionsRef={messageActionsRef}
                        placeholder={t('workbench.editors.websocket.messagePlaceholder')}
                      />
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'headers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Node-only honesty STUB (full posture lands with the
                    extension execution phase): the limit is stated up
                    front instead of silently dropping rows at run time. */}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('workbench.editors.websocket.headers.nodeOnly')}
                  </Text>
                  <KeyValueTable
                    rows={draft.headers}
                    onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
                    keyPlaceholder={t('workbench.editors.websocket.headers.keyPlaceholder')}
                    valuePlaceholder={t('workbench.editors.websocket.headers.valuePlaceholder')}
                  />
                </div>
              )}
              {activeTab === 'params' && (
                <KeyValueTable
                  rows={draft.params}
                  onChange={(params) => setDraft((d) => ({ ...d, params }))}
                  keyPlaceholder={t('workbench.editors.websocket.params.keyPlaceholder')}
                  valuePlaceholder={t('workbench.editors.websocket.params.valuePlaceholder')}
                />
              )}
              {activeTab === 'spec' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                      {t('workbench.editors.websocket.spec.selectLabel')}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder={t('workbench.editors.websocket.spec.selectPlaceholder')}
                      value={linkedSpec?.uid}
                      options={asyncapiSpecs.map((s) => ({ value: s.uid, label: s.name }))}
                      onChange={(specUid: string) => setDraft((d) => ({ ...d, specLink: { specUid } }))}
                      data-testid="websocket-spec-select"
                    />
                  </div>
                  {census.census && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('workbench.editors.websocket.spec.summary', {
                        servers: census.census.servers.length,
                        channels: census.census.channels.length,
                        operations: census.census.operations.length,
                      })}
                    </Text>
                  )}
                  {census.parseError !== null && (
                    <Text type="warning" style={{ fontSize: 11 }}>
                      {t('workbench.editors.websocket.spec.parseFailure', { message: census.parseError })}
                    </Text>
                  )}
                  {census.census?.issues.map((issue) => (
                    <Text key={`${issue.kind}:${issue.reference}`} type="warning" style={{ fontSize: 11 }}>
                      {`${issue.kind}: ${issue.reference}`}
                    </Text>
                  ))}
                </div>
              )}
              {activeTab === 'settings' && (
                <div style={{ maxWidth: 720 }}>
                  <SettingRow
                    label={t('workbench.editors.websocket.settings.subprotocolsLabel')}
                    description={t('workbench.editors.websocket.settings.subprotocolsHelp')}
                    control={
                      <Select
                        mode="tags"
                        style={{ minWidth: 260 }}
                        value={draft.subprotocols}
                        onChange={(subprotocols: string[]) => setDraft((d) => ({ ...d, subprotocols }))}
                        placeholder={t('workbench.editors.websocket.settings.subprotocolsPlaceholder')}
                        open={false}
                        suffixIcon={null}
                        tokenSeparators={[',', ' ']}
                        data-testid="websocket-subprotocols"
                      />
                    }
                  />
                  <SettingRow
                    label={t('workbench.editors.websocket.settings.timeoutLabel')}
                    description={t('workbench.editors.websocket.settings.timeoutHelp')}
                    control={
                      <InputNumber
                        min={MIN_REQUEST_TIMEOUT_MS}
                        max={MAX_REQUEST_TIMEOUT_MS}
                        step={1000}
                        value={draft.timeoutMs}
                        onChange={(value) => setDraft((d) => ({ ...d, timeoutMs: value ?? undefined }))}
                        placeholder={t('workbench.editors.websocket.settings.timeoutPlaceholder')}
                        style={{ width: 160 }}
                        data-testid="websocket-timeout"
                      />
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {specFooter}
      </div>
    </EntityScopeProvider>
  );
};

export default WebSocketRequestEditor;
