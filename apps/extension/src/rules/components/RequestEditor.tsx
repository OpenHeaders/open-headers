/**
 * RequestEditor — V5 HTTP request editor tab.
 *
 * Full-fidelity editor that matches what the SW's `executeRequest`
 * runner can actually send:
 *   - Method + URL + Send
 *   - Headers tab   (key/value/enabled rows)
 *   - Params tab    (querystring rows — appended to URL on send)
 *   - Body tab      (none / json / xml / text / form-urlencoded)
 *   - Auth tab      (none / inherit / basic / bearer / api-key)
 *   - Response pane (status + headers + body)
 *
 * Unsaved changes are tracked via a structural fingerprint — clicking
 * Save commits the whole request shape to the store. Send operates on
 * the LOCAL draft, so users can test-fire without persisting first
 * (matches Postman's tab UX).
 */

import { CaretRightOutlined, DeleteOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { useRequests } from '@hooks/useRequests';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Input, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';
import { ensureScheme, needsSchemeNormalization } from '@/shared/fetch/ensure-scheme';
import MultipartEditor from './MultipartEditor';
import StaleDraftBanner from './StaleDraftBanner';

const { Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────

/**
 * Two modes share the same editor:
 *   - `edit` (mode 'request-edit')   — a persisted request. `requestUid`
 *     identifies it; Save calls `updateRequest`.
 *   - `create` (mode 'request-create') — an unsaved draft. No uid;
 *     Save hands the draft shape to `onSaveDraft` which either
 *     persists to a preferred destination or opens a picker modal.
 */
interface RequestEditorProps {
  mode: 'request-edit' | 'request-create';
  requestUid?: string;
  draftName?: string;
  /**
   * Create-mode only: the request collection the draft will land in
   * when saved. The editor threads this into Send so variable
   * resolution sees the correct collection-scoped variables BEFORE
   * persistence — otherwise a draft's Send would silently miss the
   * collection scope even though its Save target would use it.
   */
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Create-mode only: called with the draft shape on Save. */
  onSaveDraft?: (draftData: import('../hooks/useSaveRequestFlow').DraftData) => void;
}

const METHOD_OPTIONS: { value: V5.HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const METHOD_COLORS: Record<V5.HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

const BODY_TYPE_OPTIONS: { value: V5.BodyType; label: string; disabled?: boolean }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'Text' },
  { value: 'form', label: 'Form urlencoded' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'multipart', label: 'Multipart form-data' },
];

type AuthKind = V5.AuthConfig['type'];
const AUTH_OPTIONS: { value: AuthKind; label: string }[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
];

interface Row {
  uid: string;
  key: string;
  value: string;
  enabled: boolean;
}

let rowIdCounter = 0;
const makeRow = (overrides: Partial<Row> = {}): Row => ({
  uid: `row-${++rowIdCounter}`,
  key: '',
  value: '',
  enabled: true,
  ...overrides,
});

// ── Draft shape (the whole persisted request except uid/path) ──────

interface Draft {
  method: V5.HttpMethod;
  url: string;
  headers: Row[];
  params: Row[];
  auth: V5.AuthConfig;
  body: V5.RequestBody;
  /** Wire-level cookie policy. Omitted → executor's 'omit' default. */
  credentialsMode?: V5.CredentialsMode;
}

function headersFromV5(list: V5.RequestHeader[]): Row[] {
  if (list.length === 0) return [makeRow()];
  return list.map((h) => makeRow({ key: h.key, value: h.value, enabled: h.enabled !== false }));
}
function paramsFromV5(list: V5.QueryParam[]): Row[] {
  if (list.length === 0) return [makeRow()];
  return list.map((p) => makeRow({ key: p.key, value: p.value, enabled: p.enabled !== false }));
}
function rowsToV5<T extends { key: string; value: string; enabled?: boolean }>(rows: Row[]): T[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({ key: r.key, value: r.value, enabled: r.enabled }) as unknown as T);
}

function draftFromRequest(req: V5.Request): Draft {
  return {
    method: req.method,
    url: req.url,
    headers: headersFromV5(req.headers),
    params: paramsFromV5(req.params),
    auth: req.auth,
    body: req.body,
    credentialsMode: req.credentialsMode,
  };
}

function emptyDraft(): Draft {
  return {
    method: 'GET',
    url: '',
    headers: [makeRow()],
    params: [makeRow()],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
}

function fingerprint(d: Draft): string {
  return JSON.stringify({
    method: d.method,
    url: d.url,
    headers: d.headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value, h.enabled]),
    params: d.params.filter((p) => p.key.trim()).map((p) => [p.key, p.value, p.enabled]),
    auth: d.auth,
    body: d.body,
    credentialsMode: d.credentialsMode ?? 'omit',
  });
}

// ── Component ──────────────────────────────────────────────────────

const RequestEditor: React.FC<RequestEditorProps> = ({
  mode,
  requestUid,
  draftName,
  preferredCollectionId,
  preferredFolderPath,
  onDirtyChange,
  registerSaveRef,
  onSaveDraft,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { requests, collections: requestCollections, getRequest, updateRequest, execute } = useRequests();

  const isCreateMode = mode === 'request-create';

  const summary = useMemo(
    () => (requestUid ? (requests.find((r) => r.uid === requestUid) ?? null) : null),
    [requests, requestUid],
  );

  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  // Create-mode has nothing to load — skip the loading state entirely
  // so the draft editor is interactive on first paint.
  const [loading, setLoading] = useState(!isCreateMode);
  // Create-mode is dirty from the start (matches the rule-create
  // contract); edit-mode starts clean and flips to dirty on edit.
  const persistedFpRef = useRef<string>(isCreateMode ? '' : fingerprint(emptyDraft()));

  // ── Phase 10 stale-draft tracking ─────────────────────────────────
  //
  // Snapshot `version` when the full request loads; send it as
  // `expectedVersion` on save so a concurrent-edit race surfaces
  // `reason: 'stale-draft'` and we render the banner.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  // Sending + response state — independent from persistence lifecycle.
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ExecutedRequestSnapshot | null>(null);

  // Edit mode: load full request from SW. Create mode: nothing to load.
  const initializedUidRef = useRef<string | null>(null);
  useEffect(() => {
    if (isCreateMode) return;
    if (!summary || !requestUid || initializedUidRef.current === requestUid) return;
    initializedUidRef.current = requestUid;
    setLoading(true);
    void getRequest(requestUid).then((full) => {
      if (full) {
        const d = draftFromRequest(full);
        setDraft(d);
        persistedFpRef.current = fingerprint(d);
        // Snapshot the version the user is editing against. Only set
        // once per uid; subsequent broadcast refreshes don't bump it
        // (that would defeat stale-draft detection).
        setLoadedVersion(full.version);
      }
      setLoading(false);
    });
  }, [isCreateMode, requestUid, summary, getRequest]);

  // Dirty tracking. Create-mode is always dirty until save replaces
  // the tab with an edit-mode tab.
  const isDirty = useMemo(() => {
    if (isCreateMode) return true;
    return fingerprint(draft) !== persistedFpRef.current;
  }, [isCreateMode, draft]);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Save handler. Create-mode hands the draft to the save flow (which
  // either persists directly or opens a picker); edit-mode writes
  // straight through to `updateRequest`, consuming the full Phase 10
  // result and rendering the stale-draft banner on race rejection.
  const handleSave = useCallback(async () => {
    if (isCreateMode) {
      onSaveDraft?.({
        name: draftName ?? 'New Request',
        method: draft.method,
        url: draft.url,
        headers: rowsToV5<V5.RequestHeader>(draft.headers),
        params: rowsToV5<V5.QueryParam>(draft.params),
        auth: draft.auth,
        body: draft.body,
        credentialsMode: draft.credentialsMode,
      });
      return;
    }
    if (!requestUid || !isDirty) return;
    const updates = {
      method: draft.method,
      url: draft.url,
      headers: rowsToV5<V5.RequestHeader>(draft.headers),
      params: rowsToV5<V5.QueryParam>(draft.params),
      auth: draft.auth,
      body: draft.body,
      credentialsMode: draft.credentialsMode,
    };
    const result = await updateRequest(requestUid, updates, loadedVersion ?? undefined);
    if (result.ok) {
      persistedFpRef.current = fingerprint(draft);
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
    } else if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
    } else if (result.reason === 'not-found') {
      message.error('Request was deleted from another tab');
    } else {
      message.error(`Failed to update request${'message' in result ? `: ${result.message}` : ''}`);
    }
  }, [
    isCreateMode,
    requestUid,
    draft,
    draftName,
    isDirty,
    updateRequest,
    onSaveDraft,
    onDirtyChange,
    loadedVersion,
    message,
  ]);

  const handleStaleDraftReload = useCallback(async () => {
    if (!requestUid) return;
    const full = await getRequest(requestUid);
    if (full) {
      const d = draftFromRequest(full);
      setDraft(d);
      persistedFpRef.current = fingerprint(d);
      setLoadedVersion(full.version);
    }
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [requestUid, getRequest, onDirtyChange]);

  const handleStaleDraftKeepEditing = useCallback(async () => {
    // Snap loadedVersion forward to the server's current value so the
    // next save's expectedVersion matches and isn't rejected.
    if (!requestUid) return;
    const full = await getRequest(requestUid);
    if (full) setLoadedVersion(full.version);
    setStaleDraft(null);
  }, [requestUid, getRequest]);

  // registerSaveRef takes a sync callback; wrap the async handler so
  // the breadcrumb Save button kicks off the save without awaiting.
  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  // Send handler. Works in both modes — create-mode synthesizes a
  // path under the preferred collection (preferred > folder > root) so
  // the executor's `collectionIdForRequest` lookup resolves to the
  // same collection the draft would land in on Save. Without this,
  // Send-before-Save would silently miss collection-scoped variables.
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

    const draftRequest: V5.Request = {
      schemaVersion: 5,
      // In-memory ad-hoc draft executed via Send — never persisted
      // under this uid so the version is a placeholder.
      version: loadedVersion ?? 1,
      uid: summary?.uid ?? 'draft',
      path,
      name: summary?.name ?? draftName ?? 'Draft',
      method: draft.method,
      url: draft.url,
      headers: rowsToV5<V5.RequestHeader>(draft.headers),
      params: rowsToV5<V5.QueryParam>(draft.params),
      auth: draft.auth,
      body: draft.body,
      credentialsMode: draft.credentialsMode,
    };
    const snapshot = await execute({ draft: draftRequest });
    setSending(false);
    setResponse(snapshot);
  }, [
    sending,
    summary,
    draftName,
    draft,
    execute,
    preferredCollectionId,
    preferredFolderPath,
    requestCollections,
    loadedVersion,
  ]);

  // Edit mode with missing summary — request was deleted elsewhere.
  if (!isCreateMode && !summary) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">Request not found.</Text>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          Loading request…
        </Text>
      </div>
    );
  }

  const methodColor = METHOD_COLORS[draft.method] ?? '#999';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {staleDraft && (
        <div style={{ padding: '8px 16px 0' }}>
          <StaleDraftBanner
            entityLabel="request"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={() => void handleStaleDraftReload()}
            onKeepEditing={() => void handleStaleDraftKeepEditing()}
          />
        </div>
      )}
      {/* URL bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            value={draft.method}
            onChange={(method) => setDraft((d) => ({ ...d, method }))}
            options={METHOD_OPTIONS}
            size="middle"
            style={{ width: 110 }}
            popupMatchSelectWidth={false}
            labelRender={({ label }) => (
              <span style={{ fontWeight: 700, color: methodColor, fontSize: 12 }}>{label}</span>
            )}
          />
          <Input
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            placeholder="https://api.openheaders.io/v1/..."
            size="middle"
            style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 13 }}
            onPressEnter={() => void handleSend()}
            onBlur={() => {
              // Normalize on blur so the stored value matches what will
              // actually be fetched. Prevents a silent mismatch between
              // what the user sees in the URL bar and what hits the
              // network. In-flight typing keeps the user's verbatim
              // input (so they can edit the host without being fought
              // by auto-prefix on every keystroke).
              const trimmed = draft.url.trim();
              if (trimmed.length > 0 && needsSchemeNormalization(trimmed)) {
                const normalized = ensureScheme(trimmed);
                if (normalized !== draft.url) {
                  setDraft((d) => ({ ...d, url: normalized }));
                }
              }
            }}
          />
          <Button
            type="primary"
            icon={sending ? <LoadingOutlined /> : <CaretRightOutlined />}
            size="middle"
            onClick={() => void handleSend()}
            disabled={sending}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        {/*
         * Ghost preview — when the user's URL has no scheme, show the
         * normalized form so the wire-level rewrite (ensureScheme) isn't
         * invisible. Rendering only when we'd actually rewrite keeps
         * the UI quiet for the common case of a fully-qualified URL.
         */}
        {needsSchemeNormalization(draft.url) && (
          <Tooltip
            title="Your URL has no scheme. It will be sent as https:// — click the URL bar and press Tab or Enter to lock it in."
            placement="bottomLeft"
          >
            <span
              style={{
                marginLeft: 118,
                fontSize: 11,
                color: token.colorTextTertiary,
                fontFamily: "'SF Mono', monospace",
                cursor: 'help',
              }}
            >
              → {ensureScheme(draft.url.trim())}
            </span>
          </Tooltip>
        )}
      </div>

      {/* Editor / response split */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: response ? '0 0 45%' : 1, overflow: 'auto', padding: '8px 16px' }}>
          <Tabs
            size="small"
            defaultActiveKey="headers"
            items={[
              {
                key: 'params',
                label: `Params${countLabel(draft.params)}`,
                children: (
                  <KeyValueRows
                    rows={draft.params}
                    setRows={(rows) => setDraft((d) => ({ ...d, params: rows }))}
                    keyPlaceholder="Param name"
                    valuePlaceholder="Value"
                  />
                ),
              },
              {
                key: 'headers',
                label: `Headers${countLabel(draft.headers)}`,
                children: (
                  <KeyValueRows
                    rows={draft.headers}
                    setRows={(rows) => setDraft((d) => ({ ...d, headers: rows }))}
                    keyPlaceholder="Header"
                    valuePlaceholder="Value"
                  />
                ),
              },
              {
                key: 'body',
                label: `Body${draft.body.type !== 'none' ? ` · ${draft.body.type}` : ''}`,
                children: <BodyEditor body={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />,
              },
              {
                key: 'auth',
                label: `Auth · ${draft.auth.type}${draft.credentialsMode === 'include' ? ' · cookies' : ''}`,
                children: (
                  <AuthEditor
                    auth={draft.auth}
                    onChange={(auth) => setDraft((d) => ({ ...d, auth }))}
                    credentialsMode={draft.credentialsMode}
                    onCredentialsModeChange={(credentialsMode) => setDraft((d) => ({ ...d, credentialsMode }))}
                  />
                ),
              },
            ]}
          />
        </div>
        {response && <ResponsePanel response={response} onClear={() => setResponse(null)} />}
      </div>
    </div>
  );
};

// ── Key/value row editor (shared by Headers + Params) ─────────────

interface KeyValueRowsProps {
  rows: Row[];
  setRows: (rows: Row[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}

const KeyValueRows: React.FC<KeyValueRowsProps> = ({ rows, setRows, keyPlaceholder, valuePlaceholder }) => {
  const { token } = theme.useToken();

  const updateRow = (uid: string, patch: Partial<Row>) => {
    const next = rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
    // Materialize the placeholder row into a real one + append a
    // fresh blank so there's always an empty slot at the bottom.
    const last = next[next.length - 1];
    if (last && (last.key || last.value)) {
      next.push(makeRow());
    }
    setRows(next);
  };

  const removeRow = (uid: string) => {
    const next = rows.filter((r) => r.uid !== uid);
    // Keep at least one placeholder row so users can always add.
    if (next.length === 0 || next[next.length - 1].key || next[next.length - 1].value) {
      next.push(makeRow());
    }
    setRows(next);
  };

  const addRow = () => {
    setRows([...rows, makeRow()]);
  };

  return (
    <div>
      {rows.map((r, i) => {
        const isLast = i === rows.length - 1;
        const isPlaceholder = isLast && !r.key && !r.value;
        return (
          <div key={r.uid} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => updateRow(r.uid, { enabled: e.target.checked })}
              disabled={isPlaceholder}
              style={{ width: 14, height: 14 }}
            />
            <Input
              value={r.key}
              onChange={(e) => updateRow(r.uid, { key: e.target.value })}
              placeholder={keyPlaceholder}
              size="small"
              style={{
                flex: 1,
                fontFamily: "'SF Mono', monospace",
                fontSize: 11,
                color: r.enabled ? token.colorText : token.colorTextQuaternary,
              }}
            />
            <Input
              value={r.value}
              onChange={(e) => updateRow(r.uid, { value: e.target.value })}
              placeholder={valuePlaceholder}
              size="small"
              style={{
                flex: 2,
                fontFamily: "'SF Mono', monospace",
                fontSize: 11,
                color: r.enabled ? token.colorText : token.colorTextQuaternary,
              }}
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeRow(r.uid)}
              disabled={isPlaceholder}
            />
          </div>
        );
      })}
      <Button type="text" size="small" icon={<PlusOutlined />} onClick={addRow}>
        Add row
      </Button>
    </div>
  );
};

// ── Body editor ────────────────────────────────────────────────────

interface BodyEditorProps {
  body: V5.RequestBody;
  onChange: (body: V5.RequestBody) => void;
}

const BodyEditor: React.FC<BodyEditorProps> = ({ body, onChange }) => {
  const { token } = theme.useToken();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 11 }}>
          Type
        </Text>
        <Select
          value={body.type}
          onChange={(type) => {
            // When crossing body.type boundaries, reset fields that don't
            // apply to the new type so stale content doesn't linger on a
            // hidden field and re-surface if the user flips back. The
            // codec already guards against persistence of irrelevant
            // fields, but this keeps the draft shape honest in-memory.
            if (type === 'multipart') {
              onChange({ type, multipartParts: body.multipartParts ?? [] });
            } else if (type === 'none') {
              onChange({ type });
            } else {
              onChange({ type, content: body.content ?? '' });
            }
          }}
          options={BODY_TYPE_OPTIONS}
          size="small"
          style={{ width: 180 }}
        />
      </div>
      {body.type === 'multipart' ? (
        <MultipartEditor
          parts={body.multipartParts ?? []}
          onChange={(parts) => onChange({ type: 'multipart', multipartParts: parts })}
        />
      ) : (
        body.type !== 'none' && (
          <Input.TextArea
            value={body.content ?? ''}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder={bodyPlaceholder(body.type)}
            autoSize={{ minRows: 8, maxRows: 24 }}
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12,
              background: token.colorBgContainer,
            }}
          />
        )
      )}
    </div>
  );
};

function bodyPlaceholder(type: V5.BodyType): string {
  switch (type) {
    case 'json':
      return '{\n  "key": "value"\n}';
    case 'xml':
      return '<?xml version="1.0"?>\n<root />';
    case 'form':
      return 'key1=value1&key2=value2';
    case 'text':
      return 'Plain text body';
    case 'graphql':
      return 'query { field }';
    default:
      return '';
  }
}

// ── Auth editor ────────────────────────────────────────────────────

interface AuthEditorProps {
  auth: V5.AuthConfig;
  onChange: (auth: V5.AuthConfig) => void;
  /** Wire-level cookie policy. `undefined` treated as `'omit'`. */
  credentialsMode: V5.CredentialsMode | undefined;
  onCredentialsModeChange: (next: V5.CredentialsMode | undefined) => void;
}

const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange, credentialsMode, onCredentialsModeChange }) => {
  const handleTypeChange = (type: AuthKind) => {
    // Switch to defaults for each auth type rather than carrying
    // fields across — avoids a type-mismatch mess if the user
    // toggles repeatedly.
    if (type === 'none' || type === 'inherit') {
      onChange({ type });
    } else if (type === 'basic') {
      onChange({ type: 'basic', username: '', password: '' });
    } else if (type === 'bearer') {
      onChange({ type: 'bearer', token: '' });
    } else if (type === 'api-key') {
      onChange({ type: 'api-key', key: '', value: '', in: 'header' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Text strong style={{ fontSize: 11 }}>
          Type
        </Text>
        <Select
          value={auth.type}
          onChange={handleTypeChange}
          options={AUTH_OPTIONS}
          size="small"
          style={{ width: 180 }}
        />
      </div>
      {auth.type === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
          <LabeledInput
            label="Username"
            value={auth.username}
            onChange={(username) => onChange({ ...auth, username })}
          />
          <LabeledInput
            label="Password"
            value={auth.password}
            onChange={(password) => onChange({ ...auth, password })}
            password
          />
        </div>
      )}
      {auth.type === 'bearer' && (
        <div style={{ maxWidth: 520 }}>
          <LabeledInput label="Token" value={auth.token} onChange={(token) => onChange({ ...auth, token })} />
        </div>
      )}
      {auth.type === 'api-key' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 520 }}>
          <LabeledInput label="Key" value={auth.key} onChange={(key) => onChange({ ...auth, key })} />
          <LabeledInput label="Value" value={auth.value} onChange={(value) => onChange({ ...auth, value })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 11, width: 90 }}>Send in</Text>
            <Select
              value={auth.in}
              onChange={(location: 'header' | 'query') => onChange({ ...auth, in: location })}
              options={[
                { value: 'header', label: 'Header' },
                { value: 'query', label: 'Query param' },
              ]}
              size="small"
              style={{ width: 160 }}
            />
          </div>
        </div>
      )}
      {(auth.type === 'none' || auth.type === 'inherit') && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {auth.type === 'none'
            ? 'Requests will send without an Authorization header.'
            : 'Auth inherits from the parent collection (reserved — inheritance lands with request scripts).'}
        </Text>
      )}

      <CookiePolicySection value={credentialsMode} onChange={onCredentialsModeChange} />
    </div>
  );
};

// ── Cookie-jar policy ─────────────────────────────────────────────

interface CookiePolicySectionProps {
  value: V5.CredentialsMode | undefined;
  onChange: (next: V5.CredentialsMode | undefined) => void;
}

const CookiePolicySection: React.FC<CookiePolicySectionProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const include = value === 'include';
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
        COOKIES
      </Text>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={include}
          // Normalize "unchecked" back to `undefined` so the persisted
          // shape stays minimal (explicit 'omit' is stored only when a
          // user ever toggled it).
          onChange={(e) => onChange(e.target.checked ? 'include' : undefined)}
          style={{ marginTop: 2 }}
        />
        <div>
          <Text style={{ fontSize: 12 }}>Include browser cookies</Text>
          {include ? (
            <Tag color="warning" style={{ marginLeft: 8, fontSize: 10 }}>
              Can leak session cookies
            </Tag>
          ) : null}
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            {include
              ? "Rides the browser's cookie jar (like a logged-in tab). Use sparingly — any cookie that matches this URL's domain will be attached, including your active session."
              : "Default. Requests send with no cookies attached. Matches Postman's desktop / API-testing behaviour."}
          </Text>
        </div>
      </label>
    </div>
  );
};

const LabeledInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  password?: boolean;
}> = ({ label, value, onChange, password }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Text style={{ fontSize: 11, width: 90 }}>{label}</Text>
    {password ? (
      <Input.Password
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 11 }}
      />
    ) : (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 11 }}
      />
    )}
  </div>
);

// ── Response panel ────────────────────────────────────────────────

const ResponsePanel: React.FC<{
  response: ExecutedRequestSnapshot;
  onClear: () => void;
}> = ({ response, onClear }) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');

  const statusColor =
    response.error !== null
      ? token.colorError
      : response.status >= 500
        ? token.colorError
        : response.status >= 400
          ? token.colorWarning
          : response.status >= 200 && response.status < 300
            ? token.colorSuccess
            : token.colorTextSecondary;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgLayout,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text strong style={{ fontSize: 12 }}>
          Response
        </Text>
        {response.error ? (
          <Tag color="error">{response.error}</Tag>
        ) : (
          <>
            <Tag color="default" style={{ color: statusColor, borderColor: statusColor }}>
              {response.status} {response.statusText}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {response.durationMs} ms · {formatBytes(response.bodyBytes)}
            </Text>
          </>
        )}
        <div style={{ flex: 1 }} />
        <Button size="small" type="text" onClick={onClear}>
          Clear
        </Button>
      </div>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'body' | 'headers')}
        className="rules-response-tabs"
        style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        items={[
          {
            key: 'body',
            label: 'Body',
            children: (
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {response.bodyTruncated && (
                  <Text type="warning" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                    Response truncated at {formatBytes(2 * 1024 * 1024)} (original {formatBytes(response.bodyBytes)}).
                  </Text>
                )}
                <pre
                  style={{
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 12,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: token.colorText,
                  }}
                >
                  {formatBody(response)}
                </pre>
              </div>
            ),
          },
          {
            key: 'headers',
            label: `Headers (${response.headers.length})`,
            children: (
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {response.headers.map((h) => (
                  <div key={`${h.key}:${h.value}`} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '2px 0' }}>
                    <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, minWidth: 180 }}>
                      {h.key}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "'SF Mono', monospace",
                        fontSize: 11,
                        wordBreak: 'break-all',
                        color: token.colorTextSecondary,
                      }}
                    >
                      {h.value}
                    </Text>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

function formatBody(resp: ExecutedRequestSnapshot): string {
  if (!resp.body) return '(empty body)';
  const ct = resp.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
  if (ct.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(resp.body), null, 2);
    } catch {
      return resp.body;
    }
  }
  return resp.body;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function countLabel(rows: Row[]): string {
  const active = rows.filter((r) => r.enabled && r.key.trim()).length;
  return active > 0 ? ` (${active})` : '';
}

export default RequestEditor;
