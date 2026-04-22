/**
 * RequestEditor — V5 HTTP request editor tab.
 *
 * Full-fidelity editor that matches what the SW's `executeRequest`
 * runner can actually send. The tab layout:
 *   - Docs (reserved — free-form description)
 *   - Params (query params with description column)
 *   - Authorization (auth-type picker + OAuth 2.0 configure-new-token)
 *   - Headers (key/value/description, with auto-generated browser-
 *     controlled headers surfaced behind a Show/Hide toggle)
 *   - Body (none / form-data / x-www-form-urlencoded / raw / GraphQL)
 *   - Scripts (Pre-request + Post-response — left-rail selector)
 *   - Settings (per-request HTTP knobs)
 *
 * Unsaved changes are tracked via a structural fingerprint — clicking
 * Save commits the whole request shape to the store. Send operates on
 * the LOCAL draft, so users can test-fire without persisting first
 * (matches the industry-standard API-client tab UX).
 */

import { CaretRightOutlined, DownOutlined, LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { useVariableResolver } from '@hooks/useVariableResolver';
import type { V5 } from '@openheaders/core/types';
import { buildUrlDisplay, parseUrlQuery } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { App, Button, Dropdown, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';
import { ensureScheme, needsSchemeNormalization } from '@/shared/fetch/ensure-scheme';
import { useRequestWorkflowStepContext } from './live/useRequestWorkflowStepContext';
import AuthorizationTab from './request-editor/AuthorizationTab';
import BodyTab from './request-editor/BodyTab';
import DocsTab from './request-editor/DocsTab';
import HeadersTab from './request-editor/HeadersTab';
import { type KeyValueRow, makeKvRow } from './request-editor/KeyValueTable';
import ParamsTab from './request-editor/ParamsTab';
import ScriptsTab from './request-editor/ScriptsTab';
import SettingsTab, { type RequestSettingsDraft } from './request-editor/SettingsTab';
import StaleDraftBanner from './StaleDraftBanner';
import type { AutoSuggestionContextValue } from './template-input';
import { SuggestionContextProvider, TemplateInput } from './template-input';

const { Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────

interface RequestEditorProps {
  mode: 'request-edit' | 'request-create';
  requestUid?: string;
  draftName?: string;
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  onSaveDraft?: (draftData: import('../hooks/useSaveRequestFlow').DraftData) => void;
  /**
   * "Use response in workflow" action — available only in request-edit
   * mode where the request has a stable uid. `target` picks where the
   * seeded step lands: a fresh draft workflow (`'new'`) or an existing
   * workflow identified by uid. Either way the host opens the workflow
   * editor with the request pre-seeded as a step so the user can wire
   * the response's values into `{{live.*}}` captures.
   */
  onExtractToWorkflow?: (target: 'new' | { workflowUid: string }, seedStep: ExtractSeedStep) => void;
}

/** Payload the request editor hands the extract action. */
export interface ExtractSeedStep {
  requestUid: string;
  requestName: string;
  method: string;
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

// ── Draft shape ───────────────────────────────────────────────────

interface Draft {
  method: V5.HttpMethod;
  url: string;
  description: string;
  headers: KeyValueRow[];
  params: KeyValueRow[];
  auth: V5.AuthConfig;
  body: V5.RequestBody;
  credentialsMode?: V5.CredentialsMode;
  followRedirects?: boolean;
  preRequestScript?: string;
  postResponseScript?: string;
}

function headersFromV5(list: V5.RequestHeader[]): KeyValueRow[] {
  return list.map((h) =>
    makeKvRow({ key: h.key, value: h.value, description: h.description, enabled: h.enabled !== false }),
  );
}
function paramsFromV5(list: V5.QueryParam[]): KeyValueRow[] {
  return list.map((p) =>
    makeKvRow({
      key: p.key,
      value: p.value,
      description: p.description,
      enabled: p.enabled !== false,
      hasEquals: p.hasEquals,
    }),
  );
}
function rowsToHeaders(rows: KeyValueRow[]): V5.RequestHeader[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
    }));
}
function rowsToParams(rows: KeyValueRow[]): V5.QueryParam[] {
  return rows
    .filter((r) => r.key.trim())
    .map((r) => ({
      key: r.key,
      value: r.value,
      description: r.description?.trim() ? r.description : undefined,
      enabled: r.enabled,
      hasEquals: r.hasEquals,
    }));
}

/** Shed KeyValueTable's transient fields (uid, description) so the
 *  pure `buildUrlDisplay` utility sees only the fields it cares
 *  about — key, value, enabled, hasEquals. */
function draftParamsToQueryParams(
  rows: KeyValueRow[],
): Array<{ key: string; value: string; enabled?: boolean; hasEquals?: boolean }> {
  return rows.map((r) => ({ key: r.key, value: r.value, enabled: r.enabled, hasEquals: r.hasEquals }));
}

/** Merge parsed-from-URL params with the existing draft rows so
 *  metadata (description + enabled + uid) rides along for any row
 *  whose key still matches. Duplicate keys are handled via a
 *  consume-from-pool pattern: each parsed row claims the first
 *  existing row with a matching key and removes it from the pool,
 *  so `?a=1&a=2` against `[{a,1,descX},{a,2,descY}]` preserves both
 *  descriptions on the correct rows. Unmatched parsed rows come in
 *  fresh (enabled, no description); unmatched existing rows drop. */
function mergeParamsFromUrl(
  parsed: ReadonlyArray<{ key: string; value: string; hasEquals?: boolean }>,
  existing: KeyValueRow[],
): KeyValueRow[] {
  const pool = existing.slice();
  return parsed.map((p) => {
    const idx = pool.findIndex((r) => r.key === p.key);
    const match = idx >= 0 ? pool[idx] : undefined;
    if (idx >= 0) pool.splice(idx, 1);
    return makeKvRow({
      key: p.key,
      value: p.value,
      description: match?.description ?? '',
      enabled: match?.enabled ?? true,
      hasEquals: p.hasEquals,
    });
  });
}

function draftFromRequest(req: V5.Request): Draft {
  // Split any legacy `?…` suffix off of `req.url` into structured
  // params so the editor's bidirectional URL↔Params sync has a clean
  // base URL to work with. Existing `req.params` entries keep their
  // metadata and are appended AFTER the URL-derived ones, preserving
  // the visual order a user would expect (URL first, table after).
  const parsed = parseUrlQuery(req.url);
  const urlParams: KeyValueRow[] = parsed.params.map((p) =>
    makeKvRow({ key: p.key, value: p.value, description: '', enabled: true, hasEquals: p.hasEquals }),
  );
  return {
    method: req.method,
    url: parsed.base,
    description: req.description ?? '',
    headers: headersFromV5(req.headers),
    params: [...urlParams, ...paramsFromV5(req.params)],
    auth: req.auth,
    body: req.body,
    credentialsMode: req.credentialsMode,
    followRedirects: req.followRedirects,
    preRequestScript: req.preRequestScript,
    postResponseScript: req.postResponseScript,
  };
}

function emptyDraft(): Draft {
  return {
    method: 'GET',
    url: '',
    description: '',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
}

function fingerprint(d: Draft): string {
  return JSON.stringify({
    method: d.method,
    url: d.url,
    description: d.description ?? '',
    // Every row contributes, including key-less drafts: typing a
    // value without a key (or a bare `?`, which produces an empty
    // placeholder pair) is still a change the user made and Save
    // must register it. Save's downstream strip of empty-key rows
    // is fine — it snapshots the pre-strip draft into `persistedFp`,
    // so typing ⇒ dirty, save ⇒ clean even though the placeholder
    // may disappear from the stored shape.
    headers: d.headers.map((h) => [h.key, h.value, h.description ?? '', h.enabled]),
    // `hasEquals` as a 5th tuple slot preserves the `?ok` vs `?ok=`
    // distinction through the fingerprint so adding `=` after an
    // existing key is detected as dirty on its own.
    params: d.params.map((p) => [p.key, p.value, p.description ?? '', p.enabled, !!p.hasEquals]),
    auth: d.auth,
    body: d.body,
    credentialsMode: d.credentialsMode ?? 'omit',
    followRedirects: d.followRedirects ?? true,
    preRequestScript: d.preRequestScript ?? '',
    postResponseScript: d.postResponseScript ?? '',
  });
}

type TabKey = 'docs' | 'params' | 'authorization' | 'headers' | 'body' | 'scripts' | 'settings';

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
  onExtractToWorkflow,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { requests, collections: requestCollections, getRequest, updateRequest, execute } = useRequests();

  const isCreateMode = mode === 'request-create';
  const [activeTab, setActiveTab] = useState<TabKey>('params');

  const summary = useMemo(
    () => (requestUid ? (requests.find((r) => r.uid === requestUid) ?? null) : null),
    [requests, requestUid],
  );

  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [loading, setLoading] = useState(!isCreateMode);
  // State, not a ref — the `isDirty` memo reads this as a dep, so the
  // memo recomputes when a save snapshots a new baseline. A `useRef`
  // here would leave the memo returning its stale cached `true` on the
  // next render and the tab dot would snap back. See the parallel fix
  // in `useDirtyDraft` (its file-header comment documents the trap).
  const [persistedFp, setPersistedFp] = useState<string>(() => (isCreateMode ? '' : fingerprint(emptyDraft())));

  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ExecutedRequestSnapshot | null>(null);

  // Resolvability gate for the Send button — mirrors the DNR compile
  // gate for rules. The executor ALSO enforces this (returns an error
  // snapshot when a resolve fails), but disabling the Send button up
  // front is better UX: the user sees exactly which refs are broken
  // (inline red-dashed mirror + Variables panel) and fixes them
  // before clicking. Reserved namespaces (`{{file.X}}` / `{{dynamic.X}}`)
  // are excluded from blocking per `isRequestResolvable`'s contract.
  const requestResolver = useVariableResolver();
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
  // Per-section resolvability — one resolver walk per tab so the
  // inline tab dots can flag exactly which section needs attention.
  // Each entry returns `true` when at least one `{{ref}}` in that
  // tab's strings fails to resolve (excluding reserved-namespace
  // refs, which are always intentionally unresolved until those
  // features ship).
  const sectionUnresolved = useMemo(() => {
    const context = draftCollectionId ? { collectionId: draftCollectionId } : undefined;
    const flat = (name: string) => requestResolver.resolve(name, context);
    const scoped = (name: string, ns: Parameters<typeof requestResolver.resolveScopedWithDiagnostics>[1]) =>
      requestResolver.resolveScopedWithDiagnostics(name, ns, context);
    const anyUnresolved = (strings: readonly string[]): boolean => {
      for (const s of strings) {
        if (!s) continue;
        const { errors } = resolveTemplate(s, flat, scoped);
        if (errors.some((e) => e.reason !== 'reserved-namespace')) return true;
      }
      return false;
    };
    const urlStrings = [draft.url];
    const paramStrings: string[] = [];
    for (const r of draft.params) {
      if (r.enabled === false) continue;
      if (r.key) paramStrings.push(r.key);
      if (r.value) paramStrings.push(r.value);
    }
    const headerStrings: string[] = [];
    for (const r of draft.headers) {
      if (r.enabled === false) continue;
      if (r.key) headerStrings.push(r.key);
      if (r.value) headerStrings.push(r.value);
    }
    const authStrings: string[] = [];
    const auth = draft.auth;
    switch (auth.type) {
      case 'basic':
        if (auth.username) authStrings.push(auth.username);
        if (auth.password) authStrings.push(auth.password);
        break;
      case 'bearer':
        if (auth.token) authStrings.push(auth.token);
        break;
      case 'api-key':
        if (auth.key) authStrings.push(auth.key);
        if (auth.value) authStrings.push(auth.value);
        break;
    }
    const bodyStrings: string[] = [];
    const body = draft.body;
    if (body.type === 'multipart') {
      for (const part of body.multipartParts ?? []) {
        if (part.enabled === false) continue;
        if (part.name) bodyStrings.push(part.name);
        if (part.kind === 'text' && part.value) bodyStrings.push(part.value);
      }
    } else if (body.type !== 'none' && body.content) {
      bodyStrings.push(body.content);
    }
    return {
      url: anyUnresolved(urlStrings),
      params: anyUnresolved(paramStrings),
      headers: anyUnresolved(headerStrings),
      auth: anyUnresolved(authStrings),
      body: anyUnresolved(bodyStrings),
    };
  }, [draft, draftCollectionId, requestResolver]);

  // Aggregate flag — drives the Send button + tab-bar method greying.
  // Equivalent to walking every string via `isRequestResolvable`;
  // since `sectionUnresolved` already pays that cost, we just OR.
  const hasUnresolvedRefs =
    sectionUnresolved.url ||
    sectionUnresolved.params ||
    sectionUnresolved.headers ||
    sectionUnresolved.auth ||
    sectionUnresolved.body;

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
        setPersistedFp(fingerprint(d));
        setLoadedVersion(full.version);
      }
      setLoading(false);
    });
  }, [isCreateMode, requestUid, summary, getRequest]);

  const isDirty = useMemo(() => {
    if (isCreateMode) return true;
    return fingerprint(draft) !== persistedFp;
  }, [isCreateMode, draft, persistedFp]);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
        preRequestScript: draft.preRequestScript,
        postResponseScript: draft.postResponseScript,
      });
      return;
    }
    if (!requestUid || !isDirty) return;
    const updates = {
      description: draft.description.trim() ? draft.description : undefined,
      method: draft.method,
      url: draft.url,
      headers: rowsToHeaders(draft.headers),
      params: rowsToParams(draft.params),
      auth: draft.auth,
      body: draft.body,
      credentialsMode: draft.credentialsMode,
      followRedirects: draft.followRedirects,
      preRequestScript: draft.preRequestScript,
      postResponseScript: draft.postResponseScript,
    };
    const result = await updateRequest(requestUid, updates, loadedVersion ?? undefined);
    if (result.ok) {
      setPersistedFp(fingerprint(draft));
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
      setPersistedFp(fingerprint(d));
      setLoadedVersion(full.version);
    }
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [requestUid, getRequest, onDirtyChange]);

  const handleStaleDraftKeepEditing = useCallback(async () => {
    if (!requestUid) return;
    const full = await getRequest(requestUid);
    if (full) setLoadedVersion(full.version);
    setStaleDraft(null);
  }, [requestUid, getRequest]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

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
      version: loadedVersion ?? 1,
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

  // Counters. Auto-gen header count is body-aware (Content-Type +
  // Content-Length fall off when the body is `none`), so we derive it
  // from the same predicate `HeadersTab` uses rather than hard-coding.
  const paramCount = draft.params.filter((p) => p.enabled && p.key.trim()).length;
  const autoHeaderCount = draft.body.type === 'none' ? 6 : 8;
  const headerCount = autoHeaderCount + draft.headers.filter((h) => h.enabled && h.key.trim()).length;
  const scriptsMark = (draft.preRequestScript?.trim() ? 1 : 0) + (draft.postResponseScript?.trim() ? 1 : 0);

  // Settings is "dirty" if any wired knob differs from default
  const settingsDirty =
    draft.credentialsMode === 'include' || (draft.followRedirects !== undefined && draft.followRedirects !== true);

  const tabItems = [
    {
      key: 'docs' as const,
      label: 'Docs',
    },
    {
      key: 'params' as const,
      label: (
        <span>
          Params {paramCount > 0 && <TabCount n={paramCount} />}
          {sectionUnresolved.params && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'authorization' as const,
      label: (
        <span>
          Authorization
          {sectionUnresolved.auth && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'headers' as const,
      label: (
        <span>
          Headers <TabCount n={headerCount} />
          {sectionUnresolved.headers && <TabDot tone="error" />}
        </span>
      ),
    },
    {
      key: 'body' as const,
      label: (
        <span>
          Body {sectionUnresolved.body ? <TabDot tone="error" /> : draft.body.type !== 'none' ? <TabDot /> : null}
        </span>
      ),
    },
    {
      key: 'scripts' as const,
      label: <span>Scripts {scriptsMark > 0 && <TabDot />}</span>,
    },
    {
      key: 'settings' as const,
      label: <span>Settings {settingsDirty && <TabDot />}</span>,
    },
  ];

  const settingsValue: RequestSettingsDraft = {
    credentialsMode: draft.credentialsMode,
    followRedirects: draft.followRedirects,
  };

  return (
    <SuggestionContextProvider value={suggestionContext}>
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
            <TemplateInput
              // The URL field is a projection of `draft.url` (base) +
              // `draft.params` (structured query). Edits parse back
              // into both fields so the Params tab stays in sync with
              // whatever the user types here. See `mergeParamsFromUrl`
              // for the metadata-preserving merge (enabled state and
              // descriptions ride along for rows whose key stayed).
              value={buildUrlDisplay(draft.url, draftParamsToQueryParams(draft.params))}
              onChange={(next) => {
                const parsed = parseUrlQuery(next);
                setDraft((d) => ({
                  ...d,
                  url: parsed.base,
                  params: mergeParamsFromUrl(parsed.params, d.params),
                }));
              }}
              placeholder="Enter URL or paste text"
              size="middle"
              // Red `status` outlines the URL input when its `{{refs}}`
              // don't resolve. Same visual language as the inline mirror
              // + tab dot + sidebar badge; replaces the need for a
              // banner at the top of the editor.
              status={sectionUnresolved.url ? 'error' : undefined}
              style={{ flex: 1, fontFamily: "'SF Mono', monospace", fontSize: 13 }}
              onPressEnter={() => void handleSend()}
              onBlur={() => {
                const trimmed = draft.url.trim();
                if (trimmed.length > 0 && needsSchemeNormalization(trimmed)) {
                  const normalized = ensureScheme(trimmed);
                  if (normalized !== draft.url) {
                    setDraft((d) => ({ ...d, url: normalized }));
                  }
                }
              }}
            />
            <Tooltip
              title={
                hasUnresolvedRefs
                  ? 'Request has unresolved variables. Define them in vault, environment, collection, workspace, or a live workflow before sending.'
                  : undefined
              }
            >
              <Button
                type="primary"
                icon={sending ? <LoadingOutlined /> : <CaretRightOutlined />}
                size="middle"
                onClick={() => void handleSend()}
                // Disable on unresolved refs — the executor would return
                // an error snapshot anyway; blocking up front gives the
                // user a clearer "fix these first" signal.
                disabled={sending || hasUnresolvedRefs}
              >
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </Tooltip>
          </div>
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

        {/* Editor / response split. The sub-tab bar (Docs · Params · …)
          renders OUTSIDE the scroll container so it never participates
          in scrolling — simpler + more robust than `position: sticky`,
          and leaves child panes free to mount their own sticky rails
          (e.g. the Authorization tab's auth-type picker) without
          colliding with an outer sticky header. We pass empty `items`
          to AntD Tabs so only the bar renders; the active pane is
          rendered manually below inside its own scroller. */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: response ? '0 0 55%' : 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '8px 16px 0' }}>
              <Tabs
                size="small"
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as TabKey)}
                items={tabItems.map((item) => ({ key: item.key, label: item.label }))}
                className="rules-request-tabs"
                tabBarStyle={{ marginBottom: 0 }}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px' }}>
              <TabContent tab={activeTab} draft={draft} setDraft={setDraft} settingsValue={settingsValue} />
            </div>
          </div>
          {response && (
            <ResponsePanel
              response={response}
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
            />
          )}
        </div>
      </div>
    </SuggestionContextProvider>
  );
};

// ── Tab content renderer ──────────────────────────────────────────

const TabContent: React.FC<{
  tab: TabKey;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  settingsValue: RequestSettingsDraft;
}> = ({ tab, draft, setDraft, settingsValue }) => {
  switch (tab) {
    case 'docs':
      return <DocsTab value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} />;
    case 'params':
      return <ParamsTab rows={draft.params} onChange={(params) => setDraft((d) => ({ ...d, params }))} />;
    case 'authorization':
      return <AuthorizationTab auth={draft.auth} onChange={(auth) => setDraft((d) => ({ ...d, auth }))} />;
    case 'headers':
      return (
        <HeadersTab
          rows={draft.headers}
          onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
          body={draft.body}
        />
      );
    case 'body':
      return <BodyTab body={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />;
    case 'scripts':
      return (
        <ScriptsTab
          preRequestScript={draft.preRequestScript ?? ''}
          postResponseScript={draft.postResponseScript ?? ''}
          onPreRequestChange={(preRequestScript) => setDraft((d) => ({ ...d, preRequestScript }))}
          onPostResponseChange={(postResponseScript) => setDraft((d) => ({ ...d, postResponseScript }))}
        />
      );
    case 'settings':
      return (
        <SettingsTab
          value={settingsValue}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              credentialsMode: next.credentialsMode,
              followRedirects: next.followRedirects,
            }))
          }
        />
      );
  }
};

// ── Mini count badges on tab labels ───────────────────────────────

const TabCount: React.FC<{ n: number }> = ({ n }) => {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: 4,
        padding: '0 6px',
        fontSize: 10,
        fontWeight: 500,
        color: token.colorTextSecondary,
        background: token.colorFillSecondary,
        borderRadius: 8,
        lineHeight: '16px',
      }}
    >
      {n}
    </span>
  );
};

/** Small colored dot shown on a tab label to flag that the section
 *  has content OR an unresolved `{{ref}}`. `tone='error'` renders in
 *  red to match the inline mirror + sidebar badge — orange is
 *  reserved for the unsaved/dirty state on the Save button. */
const TabDot: React.FC<{ tone?: 'default' | 'error' }> = ({ tone = 'default' }) => {
  const { token } = theme.useToken();
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: tone === 'error' ? token.colorError : token.colorPrimary,
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    />
  );
};

// ── Response panel ────────────────────────────────────────────────

type ResponseTabKey = 'body' | 'headers' | 'assertions' | 'script-log';

const ResponsePanel: React.FC<{
  response: ExecutedRequestSnapshot;
  onClear: () => void;
  /**
   * "Use response in workflow" action — when provided, renders a
   * dropdown letting the user either create a new workflow draft with
   * this request seeded as step 1, or attach this request as a new step
   * to an existing workflow. Undefined when the request isn't yet
   * saved (no stable uid to reference).
   */
  onExtractToWorkflow?: (target: 'new' | { workflowUid: string }) => void;
}> = ({ response, onClear, onExtractToWorkflow }) => {
  const { token } = theme.useToken();
  // Pull the list of existing workflows so the Extract dropdown can
  // offer "Attach to …" with a submenu of current workflows. Lightweight
  // — the hook already reads the same listener the sidebar uses.
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const scripts = response.scripts ?? null;
  const assertions = scripts?.postResponse?.assertions ?? [];
  const assertionsPassed = assertions.filter((a) => a.passed).length;
  const assertionsFailed = assertions.length - assertionsPassed;
  const preLog = scripts?.preRequest?.consoleLog ?? [];
  const postLog = scripts?.postResponse?.consoleLog ?? [];
  const hasScriptLog = preLog.length > 0 || postLog.length > 0;
  const [activeTab, setActiveTab] = useState<ResponseTabKey>('body');

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
        {onExtractToWorkflow && !response.error && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'new',
                  icon: <ThunderboltOutlined />,
                  label: 'Create new workflow',
                  onClick: () => onExtractToWorkflow('new'),
                },
                {
                  key: 'attach',
                  icon: <ThunderboltOutlined />,
                  label: 'Attach to existing workflow',
                  disabled: liveWorkflows.length === 0,
                  children:
                    liveWorkflows.length === 0
                      ? undefined
                      : liveWorkflows.map((w) => ({
                          key: `attach-${w.uid}`,
                          label: w.name,
                          onClick: () => onExtractToWorkflow({ workflowUid: w.uid }),
                        })),
                },
              ],
            }}
          >
            <Button size="small">
              Use response in workflow <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
        )}
        <Button size="small" type="text" onClick={onClear}>
          Clear
        </Button>
      </div>
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as ResponseTabKey)}
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
          ...(assertions.length > 0
            ? [
                {
                  key: 'assertions' as ResponseTabKey,
                  label: `Assertions${assertionsFailed > 0 ? ` (${assertionsFailed} failed)` : assertionsPassed > 0 ? ` (${assertionsPassed} passed)` : ''}`,
                  children: (
                    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingTop: 4 }}>
                      {assertions.map((a, idx) => (
                        <div
                          key={`${a.name}:${idx}`}
                          style={{
                            display: 'flex',
                            gap: 8,
                            fontSize: 12,
                            padding: '4px 0',
                            alignItems: 'flex-start',
                          }}
                        >
                          <Tag color={a.passed ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
                            {a.passed ? 'PASS' : 'FAIL'}
                          </Tag>
                          <div style={{ flex: 1 }}>
                            <Text>{a.name}</Text>
                            {!a.passed && a.message && (
                              <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {a.message}
                                </Text>
                              </div>
                            )}
                          </div>
                          {typeof a.durationMs === 'number' && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {a.durationMs} ms
                            </Text>
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]
            : []),
          ...(hasScriptLog
            ? [
                {
                  key: 'script-log' as ResponseTabKey,
                  label: `Console (${preLog.length + postLog.length})`,
                  children: (
                    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingTop: 4 }}>
                      {preLog.length > 0 && (
                        <>
                          <Text strong style={{ fontSize: 11 }}>
                            Pre-request
                          </Text>
                          <ScriptLogList entries={preLog} />
                        </>
                      )}
                      {postLog.length > 0 && (
                        <>
                          <Text strong style={{ fontSize: 11 }}>
                            Post-response
                          </Text>
                          <ScriptLogList entries={postLog} />
                        </>
                      )}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
};

const ScriptLogList: React.FC<{ entries: import('@openheaders/core/scripts').ScriptConsoleEntry[] }> = ({
  entries,
}) => {
  const { token } = theme.useToken();
  const color = (level: string): string =>
    level === 'error'
      ? token.colorError
      : level === 'warn'
        ? token.colorWarning
        : level === 'debug'
          ? token.colorTextTertiary
          : token.colorTextSecondary;
  return (
    <div style={{ marginBottom: 8 }}>
      {entries.map((e, idx) => (
        <div
          key={`${e.timeMs}:${idx}`}
          style={{
            display: 'flex',
            gap: 8,
            fontFamily: "'SF Mono', monospace",
            fontSize: 11,
            padding: '2px 0',
            alignItems: 'flex-start',
          }}
        >
          <Text style={{ color: token.colorTextTertiary, minWidth: 48 }}>{e.timeMs}ms</Text>
          <Text style={{ color: color(e.level), minWidth: 44, textTransform: 'uppercase' }}>{e.level}</Text>
          <Text style={{ color: token.colorText, wordBreak: 'break-all' }}>{e.args.join(' ')}</Text>
        </div>
      ))}
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

export default RequestEditor;
