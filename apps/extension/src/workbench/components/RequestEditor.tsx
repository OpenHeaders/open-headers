/**
 * RequestEditor — V5 HTTP request editor tab.
 *
 * Full-fidelity editor for the request shape the SW's `executeRequest`
 * runner can ship. Tab layout: Docs · Params · Authorization · Headers
 * · Body · Scripts · Settings.
 *
 * Sync engine alignment (matches RuleEditor + TemplateEditor):
 *
 *   - `<EntityScopeProvider>` declares this surface's `(entityType,
 *     entityId)` so `<EntityField>` consumers + the per-row
 *     `data-field-path` markers all publish the same `(entity, path)`
 *     triple to `<SurfaceAwarenessPublisher>`.
 *   - `useEditorDirty` contributes the dirty marker (no per-editor
 *     `useAwareness`).
 *   - Dirty derives structurally from form-projection vs live-request
 *     equality (no imperative `setPersistedFp(…)` flags).
 *   - `useEntityReprime` reconciles broadcast updates while clean.
 *   - `useRequestConflicts` + `<EntityConflictBanner>` +
 *     `<EntityConflictDialog>` surface concurrent-edit divergence.
 *
 * Send operates on the LOCAL draft so users can test-fire without
 * persisting first.
 */

import { CaretRightOutlined, DownOutlined, LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { useVariableResolver } from '@hooks/useVariableResolver';
import { serializeRequest } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { buildUrlDisplay, parseUrlQuery } from '@openheaders/core/utils';
import { resolveTemplate } from '@openheaders/core/variables';
import { App, Button, Dropdown, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';
import { getActiveRequestSyncMirror } from '@/context/request-sync-mirror';
import { ensureScheme, needsSchemeNormalization } from '@/shared/fetch/ensure-scheme';
import EditorHeader from './EditorHeader';
import {
  EntityField,
  EntityScopeProvider,
  REQUEST_PATHS,
  useSetActiveFieldFocus,
} from '@/shared/awareness';
import { readFieldPath } from '@/shared/awareness/field-path';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import {
  EntityConflictBanner,
  EntityConflictDialog,
  prettyPathMap,
  type ConflictResolution,
  type PathConflict,
} from '@/shared/conflicts';
import { stableStringify, useEntityReprime } from '@/shared/forms';
import { requestResolveAdapter } from './request-conflict-adapter';
import { useRequestConflicts } from './use-request-conflicts';
import { useRequestWorkflowStepContext } from './live/useRequestWorkflowStepContext';
import AuthorizationTab from './request-editor/AuthorizationTab';
import BodyTab from './request-editor/BodyTab';
import DocsTab from './request-editor/DocsTab';
import HeadersTab from './request-editor/HeadersTab';
import { type KeyValueRow, makeKvRow } from './request-editor/KeyValueTable';
import ParamsTab from './request-editor/ParamsTab';
import ScriptsTab from './request-editor/ScriptsTab';
import SettingsTab, { type RequestSettingsDraft } from './request-editor/SettingsTab';
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
    makeKvRow({
      uid: h.uid,
      key: h.key,
      value: h.value,
      description: h.description,
      enabled: h.enabled !== false,
    }),
  );
}
function paramsFromV5(list: V5.QueryParam[]): KeyValueRow[] {
  return list.map((p) =>
    makeKvRow({
      uid: p.uid,
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
      uid: r.uid,
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
      uid: r.uid,
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

/** Pure projection: Draft → updateRequest payload. Used at save time
 *  AND for derived dirty / conflict baseline + form projection. One
 *  source of truth so dirty / save / conflict tracker all agree. */
function buildRequestUpdates(draft: Draft): {
  description: string | undefined;
  method: V5.HttpMethod;
  url: string;
  headers: V5.RequestHeader[];
  params: V5.QueryParam[];
  auth: V5.AuthConfig;
  body: V5.RequestBody;
  credentialsMode: V5.CredentialsMode | undefined;
  followRedirects: boolean | undefined;
  preRequestScript: string | undefined;
  postResponseScript: string | undefined;
} {
  return {
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
}

/** Project a live `V5.Request` into the same shape `buildRequestUpdates`
 *  emits — fingerprint comparison stays apples-to-apples. */
function canonicalRequestProjection(req: V5.Request): ReturnType<typeof buildRequestUpdates> {
  return buildRequestUpdates(draftFromRequest(req));
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveRequest, setLiveRequest] = useState<V5.Request | null>(null);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ExecutedRequestSnapshot | null>(null);

  // ── Live mirror integration ───────────────────────────────────
  //
  // Subscribe to broadcasts so concurrent commits land in `liveRequest`.
  // The reprime hook below replays into the draft when clean; conflicts
  // surface against the live snapshot when dirty.
  useEffect(() => {
    if (isCreateMode || !requestUid) return;
    const mirror = getActiveRequestSyncMirror();
    const sync = () => {
      const entry = mirror.getRequestMirror(requestUid);
      setLiveRequest(entry?.request ?? null);
    };
    sync();
    return mirror.subscribeRequestMirror(requestUid, sync);
  }, [isCreateMode, requestUid]);

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
    // Body walk — exhaustive over the discriminated union so an
    // unresolved `{{ref}}` in a form / graphql variant is reflected
    // in the section badge, not silently dropped. Mirrors the
    // collector in `core/live/request-scan.ts`.
    const bodyStrings: string[] = [];
    const body = draft.body;
    switch (body.type) {
      case 'none':
        break;
      case 'json':
      case 'xml':
      case 'text':
        if (body.content) bodyStrings.push(body.content);
        break;
      case 'graphql':
        if (body.content) bodyStrings.push(body.content);
        if (body.graphqlVariables) bodyStrings.push(body.graphqlVariables);
        break;
      case 'form':
        for (const part of body.formParts) {
          if (part.enabled === false) continue;
          if (part.key) bodyStrings.push(part.key);
          if (part.value) bodyStrings.push(part.value);
        }
        break;
      case 'multipart':
        for (const part of body.multipartParts) {
          if (part.enabled === false) continue;
          if (part.name) bodyStrings.push(part.name);
          if (part.kind === 'text' && part.value) bodyStrings.push(part.value);
        }
        break;
      default: {
        const _exhaustive: never = body;
        void _exhaustive;
      }
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

  // ── Derived dirty (form-projection vs live-request) ──────────
  //
  // Same convention as TemplateEditor: dirty is a structural projection,
  // never an imperative event log. `formFingerprint` (current draft
  // projected to save-shape) vs `lastPrimedFingerprint` (canonical the
  // draft was last seeded from). Auto-rebase snaps the latter as soon
  // as the form converges with canonical so the post-save echo clears
  // dirty without an explicit reset.
  const formFingerprint = useMemo(
    () => (isInitialized ? stableStringify(buildRequestUpdates(draft)) : null),
    [draft, isInitialized],
  );
  const liveFingerprint = useMemo(
    () => (liveRequest ? stableStringify(canonicalRequestProjection(liveRequest)) : null),
    [liveRequest],
  );
  const [lastPrimedFingerprint, setLastPrimedFingerprint] = useState<string | null>(null);
  const isDirty = isCreateMode
    ? true
    : isInitialized &&
      formFingerprint !== null &&
      lastPrimedFingerprint !== null &&
      formFingerprint !== lastPrimedFingerprint;

  // Fire `onDirtyChange` only on transitions, not every render.
  const lastReportedDirtyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastReportedDirtyRef.current === isDirty) return;
    lastReportedDirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEditorDirty(
    { entityType: REQUEST_ENTITY_TYPE, entityId: requestUid ?? null },
    isDirty,
  );

  // ── Conflict tracking ────────────────────────────────────────
  const conflicts = useRequestConflicts({
    liveRequest,
    isDirty,
    enabled: !isCreateMode,
  });
  const setConflictBaseline = conflicts.setBaseline;

  // Auto-rebase: snap both dirty-baseline AND conflict baseline as
  // soon as the form converges with canonical (post-save echo +
  // remote-mirrors-our-edit cases).
  useEffect(() => {
    if (formFingerprint === null || liveFingerprint === null) return;
    if (formFingerprint !== liveFingerprint) return;
    if (lastPrimedFingerprint === liveFingerprint) return;
    setLastPrimedFingerprint(liveFingerprint);
    if (liveRequest) setConflictBaseline(liveRequest);
  }, [formFingerprint, liveFingerprint, lastPrimedFingerprint, liveRequest, setConflictBaseline]);

  const formProjection = useMemo(() => {
    if (!liveRequest || !isInitialized) return null;
    const transient: V5.Request = { ...liveRequest, ...buildRequestUpdates(draft) };
    return conflicts.projectEntity(transient);
  }, [draft, liveRequest, isInitialized, conflicts]);

  const formSetOrders = useMemo(() => {
    const out = new Map<string, string[]>();
    out.set(
      REQUEST_PATHS.headerSet,
      draft.headers.map((h) => h.uid).filter((u): u is string => !!u),
    );
    out.set(
      REQUEST_PATHS.paramSet,
      draft.params.map((p) => p.uid).filter((u): u is string => !!u),
    );
    return out;
  }, [draft.headers, draft.params]);

  const allConflicts = useMemo(
    () =>
      formProjection
        ? conflicts.getAllConflicts(formProjection, formSetOrders)
        : new Map<string, PathConflict>(),
    [formProjection, formSetOrders, conflicts],
  );

  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Shared helper: clone the live request, fold in current draft +
  // optional resolutions, then return both the projected request and
  // the corresponding draft. One source of truth for the "use saved"
  // affordances and for the dialog's right-pane preview text.
  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): { req: V5.Request; draft: Draft } | null => {
      if (!liveRequest) return null;
      const merged = JSON.parse(
        JSON.stringify({ ...liveRequest, ...buildRequestUpdates(draft) }),
      ) as V5.Request;
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        requestResolveAdapter.applyResolutionToEntity(merged, path, conflict);
      }
      return { req: merged, draft: draftFromRequest(merged) };
    },
    [liveRequest, draft, allConflicts],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!liveRequest) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    setDraft(projected.draft);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, liveRequest, projectWithResolutions]);

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      if (!liveRequest) return;
      const projected = projectWithResolutions(resolutions);
      if (projected) setDraft(projected.draft);
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') conflicts.acceptTheirs(path, conflict.theirs);
        else conflicts.dismiss(path);
      }
    },
    [allConflicts, conflicts, liveRequest, projectWithResolutions],
  );

  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveRequest) return '';
    try {
      return serializeRequest(freshDocument(liveRequest)).requestYaml;
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRequest]);

  const buildLocalText = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): string => {
      const projected = projectWithResolutions(resolutions);
      if (!projected) return '';
      try {
        return serializeRequest(freshDocument(projected.req)).requestYaml;
      } catch {
        return '';
      }
    },
    [projectWithResolutions],
  );

  const conflictPathLabels = useMemo(
    () =>
      liveRequest ? prettyPathMap(requestResolveAdapter, liveRequest, allConflicts.keys()) : new Map<string, string>(),
    [liveRequest, allConflicts],
  );

  // Canonical seed: replace draft + snap both fingerprints + conflict baseline.
  const populateAndBaseline = useCallback(
    (req: V5.Request) => {
      const next = draftFromRequest(req);
      setDraft(next);
      setConflictBaseline(req);
      setLastPrimedFingerprint(stableStringify(canonicalRequestProjection(req)));
    },
    [setConflictBaseline],
  );

  // Init: load full request from SW; populate draft + baselines.
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
        populateAndBaseline(full);
        setLiveRequest(full);
      }
      setLoading(false);
      setIsInitialized(true);
    });
  }, [isCreateMode, requestUid, summary, getRequest, populateAndBaseline]);

  const requestSignature = useCallback((r: V5.Request) => JSON.stringify(r), []);
  const reprime = useEntityReprime<V5.Request>({
    liveEntity: liveRequest,
    scope: { entityType: REQUEST_ENTITY_TYPE, entityId: requestUid ?? null },
    isDirty,
    enabled: isInitialized && !isCreateMode,
    signature: requestSignature,
    populate: populateAndBaseline,
  });

  // Seed the reprime signature on the very first init so the post-init
  // broadcast carrying identical content doesn't trigger redundant
  // re-prime.
  useEffect(() => {
    if (!isInitialized || isCreateMode || !liveRequest) return;
    reprime.markPopulated(liveRequest);
    // markPopulated is identity-stable across renders; only seed once
    // per entity init pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isCreateMode, requestUid]);

  // ── Field focus publishing ───────────────────────────────────
  //
  // EntityField wraps the URL + method inputs and publishes through
  // `useSetActiveFieldFocus` directly. Per-row cells (Headers / Params)
  // use the existing `data-field-path` ancestor scheme — the
  // EditableGridTable shell tags each cell with the canonical schema
  // path; this editor's onFocusCapture reads the path off the focused
  // element and routes it through the same context. Order of
  // precedence: EntityField (innermost capture wins) > sub-row marker.
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
        preRequestScript: draft.preRequestScript,
        postResponseScript: draft.postResponseScript,
      });
      return;
    }
    if (!requestUid || !isDirty) return;
    const updates = buildRequestUpdates(draft);
    const result = await updateRequest(requestUid, updates);
    if (result.ok) {
      conflicts.clearDismissed();
      // Dirty derives from form-vs-canonical equality; the broadcast
      // echo brings live in line with form, auto-rebase clears.
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
    conflicts,
    message,
  ]);

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

  // Header consolidates the full URL row: method select + URL input
  // in the title (title has flex:1 so the URL input grows), Send in
  // the actions slot, Save standardized on the right. No separate URL
  // bar row below — frees ~40px of vertical space and puts the primary
  // interaction + save in a single line (request-name label dropped:
  // the tab pill already carries that identity).
  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <EntityField path={REQUEST_PATHS.method}>
        <Select
          value={draft.method}
          onChange={(method) => setDraft((d) => ({ ...d, method }))}
          options={METHOD_OPTIONS}
          size="small"
          style={{ width: 96, flexShrink: 0 }}
          popupMatchSelectWidth={false}
          labelRender={({ label }) => <span style={{ fontWeight: 700, color: methodColor, fontSize: 12 }}>{label}</span>}
        />
      </EntityField>
      <EntityField path={REQUEST_PATHS.url}>
        <TemplateInput
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
          size="small"
          status={sectionUnresolved.url ? 'error' : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "'SF Mono', monospace",
            fontSize: 12,
            // Fill the 24px min-height so the text sits on the vertical
            // center. The component's default `lineHeight: 1.5714` combined
            // with monospace metrics pushes glyphs slightly above center.
            lineHeight: '22px',
          }}
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
      </EntityField>
    </div>
  );

  const headerActions = (
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
        size="small"
        onClick={() => void handleSend()}
        disabled={sending || hasUnresolvedRefs}
      >
        {sending ? 'Sending…' : 'Send'}
      </Button>
    </Tooltip>
  );

  return (
    <EntityScopeProvider entityType={REQUEST_ENTITY_TYPE} entityId={requestUid ?? null}>
      <SuggestionContextProvider value={suggestionContext}>
        <div
          style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
          onFocusCapture={handleEditorFocusCapture}
          onBlurCapture={handleEditorBlurCapture}
        >
          <EditorHeader title={headerTitle} actions={headerActions} isDirty={isDirty} onSave={handleSaveSync} />

          <EntityConflictBanner
            count={allConflicts.size}
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
              <Tooltip
                title="Your URL has no scheme. It will be sent as https:// — click the URL bar and press Tab or Enter to lock it in."
                placement="bottomLeft"
              >
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

          <EntityConflictDialog
            open={isConflictDialogOpen}
            savedText={savedYaml}
            buildLocalText={buildLocalText}
            conflicts={allConflicts}
            localValuesByPath={formProjection ? new Map(Object.entries(formProjection)) : undefined}
            pathLabels={conflictPathLabels}
            onResolve={applyResolutions}
            onClose={() => setConflictDialogOpen(false)}
          />
        </div>
      </SuggestionContextProvider>
    </EntityScopeProvider>
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
