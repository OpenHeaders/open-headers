/**
 * Typed key registry for the extension's persisted state.
 *
 * Every `chrome.storage.*` key the extension touches is declared here
 * with its payload type. Callers access storage exclusively through
 * `extensionStorage` and pass the key specs from this module — no raw
 * string literals, no untyped `result[KEY] as SomeType` casts.
 *
 * Namespaces:
 *   - `OH`       — global singletons (workspace list, active id,
 *                  view-mode, onboarding flag, etc.). Stable for the
 *                  install lifetime.
 *   - `UI`       — surface-local UI preferences that stay global
 *                  (not workspace-scoped by design).
 *   - `wsKeys()` — workspace-scoped key factory. Every field is
 *                  keyed under `oh.ws.<workspaceId>.*`.
 *
 * Session-only storage (e.g. `ruleStateObserver.snapshot`,
 * `tabTracker.tabsWithActiveRules`) is used exclusively by background
 * modules and declared in the respective module — not registered here.
 */

import type {
  Collection,
  DaemonAuthToken,
  DaemonConfig,
  Environment,
  ExtensionWorkspace,
  LiveVariable,
  LiveWorkflow,
  LogEntry,
  Org,
  Request,
  Rule,
  SyntheticIdentityRecord,
  Template,
  Vault,
  ViewMode,
  WorkspaceRoleAssignment,
  WorkspaceVariables,
} from '../types';
import type { PauseMarker } from '../utils';

// ── Core key type ────────────────────────────────────────────────────

export type StorageArea = 'local' | 'sync' | 'session';

/**
 * Tagged specification for a single storage slot. The phantom `__value`
 * field carries the payload type through the type system — it is never
 * populated at runtime.
 *
 * `sensitive: true` marks slots that hold schema-marked sensitive content
 * (per SYNC_ENGINE_DESIGN §12.1). Host-storage adapters that support
 * encryption-at-rest (Electron `safeStorage`, future keytar / KMS impls)
 * route reads + writes for these slots through their `SecretCipher` seam;
 * adapters without that capability persist them as plain JSON.
 *
 * The flag is a declarative property of the slot — auditing sensitivity
 * is local to the key definition, not a separate allowlist that drifts.
 */
export interface StorageKey<T> {
  readonly key: string;
  readonly area: StorageArea;
  readonly sensitive?: boolean;
  readonly __value?: T;
}

export interface StorageKeyOptions {
  area?: StorageArea;
  sensitive?: boolean;
}

export function storageKey<T>(key: string, area?: StorageArea, sensitive?: boolean): StorageKey<T>;
export function storageKey<T>(key: string, options: StorageKeyOptions): StorageKey<T>;
export function storageKey<T>(
  key: string,
  areaOrOptions: StorageArea | StorageKeyOptions = 'local',
  sensitive?: boolean,
): StorageKey<T> {
  if (typeof areaOrOptions === 'string') {
    return { key, area: areaOrOptions, sensitive: sensitive === true ? true : undefined };
  }
  return {
    key,
    area: areaOrOptions.area ?? 'local',
    sensitive: areaOrOptions.sensitive === true ? true : undefined,
  };
}

// ── UI-specific persisted shapes ─────────────────────────────────────
//
// Kept here (rather than inside the hooks that own them) so the
// storage schema lives in one place. Hooks import the types back
// from this module, not the other way around.

export interface PersistedPopupState {
  uiState?: {
    tableState?: {
      searchText?: string;
      sortMode?: string;
      filteredInfo?: Record<string, unknown>;
      sortedInfo?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PersistedTabSession<Tab = unknown> {
  tabs: Tab[];
  activeTabId: string | null;
}

export interface PersistedPanelLayout {
  /** Sidebar width as ratio of viewport width (0–1). */
  sidebarRatio: number;
  /** Inspector width as ratio of viewport width (0–1). */
  inspectorRatio: number;
  /** Bottom panel height as ratio of viewport height (0–1). */
  bottomRatio: number;
}

/**
 * Per-user org-binding preferences (UNIFIED_ORACLE_MODEL.md §6.2).
 * Drives the two-personal-Orgs onboarding (U3.6): once acknowledged the
 * onboarding modal stops surfacing, and `defaultNewWorkspaceOrgId` is the
 * Org newly-created workspaces bind to (falling back to the home-org when
 * unset or stale). Plain JSON — not security-sensitive.
 */
export interface OrgBindingPrefs {
  /** ISO timestamp the user dismissed the two-personal-Orgs onboarding; null = not yet seen. */
  onboardingAcknowledgedAt: string | null;
  /** Org id new workspaces bind to; null = use the home-org. */
  defaultNewWorkspaceOrgId: string | null;
}

export interface PersistedLocalFolder {
  /** Persisted format version for each `_folder.yaml` once the codec lands. */
  schemaVersion: number;
  uid: string;
  path: string;
  name: string;
}

// ── Global keys ──────────────────────────────────────────────────────

export const OH = {
  /** Full list of extension workspaces. */
  workspaces: storageKey<ExtensionWorkspace[]>('oh.workspaces'),
  /**
   * Runtime-Active workspace pointer — singular, browser-platform-bound.
   * The workspace whose rules are currently applied via DNR; read by
   * `dnr-manager`, `outgoing-ws-handler`, popup, side-panel, devpanel.
   * Distinct from {@link OH.preferencesDefaultWorkspace} (the user
   * preference for new-tab seed) — the two are independent storage
   * keys with independent gestures.
   */
  runtimeActive: storageKey<string>('oh.runtimeActive.active'),
  /**
   * Per-Org default workspace preference — `orgId → workspaceId`. The
   * Org is the top-level container; each Org keeps its own default (the
   * workspace an Org-switch lands on when that Org has no remembered
   * active workspace yet). A missing entry means "fall through to the
   * Org's first workspace." Independent of {@link OH.runtimeActive} and
   * {@link OH.orgActiveWorkspace}.
   */
  preferencesDefaultWorkspace: storageKey<Record<string, string>>('oh.preferences.defaultWorkspace'),
  /** Toolbar-action view mode (popup vs sidepanel). Synced across devices. */
  viewMode: storageKey<ViewMode>('oh.viewMode', 'sync'),
  /** User-scope settings dict (global — never per-workspace). */
  settingsUser: storageKey<Record<string, unknown>>('oh.settings.user'),
  /**
   * Observability ring-buffer snapshot. Capped at {@link DEFAULT_CAPACITY}
   * entries; persisted in full on each flush because a ring trimmed to
   * 500 structured records is still tiny. Global (not per-workspace)
   * so subsystem-level events during workspace switches aren't lost.
   */
  observabilityLog: storageKey<LogEntry[]>('oh.observability.log'),
  /**
   * Per-host daemon configuration record. Carries `hostInstallId` — the
   * seed for deterministic synthetic identity UUIDs
   * (UNIFIED_ORACLE_MODEL.md §5.1). Minted once at first boot, persisted
   * here, never regenerated except on reinstall (§11 OQ1).
   *
   * `ensureDaemonConfig` (in `../identity`) is the host-neutral writer.
   */
  daemonConfig: storageKey<DaemonConfig>('oh.daemonConfig'),
  /**
   * Synthetic identity-row tuple materialized at host boot (User + Org +
   * UserIdentity + Session + OrgMembership + Principal + LocalAdmin per
   * UNIFIED_ORACLE_MODEL.md §5.2). Persisted as one blob so a single
   * storage write satisfies the §5.2 "single transaction" requirement
   * even on backends without multi-row transactionality.
   *
   * `ensureSyntheticIdentity` (in `../identity`) is the host-neutral
   * writer; deterministic in `OH.daemonConfig.hostInstallId`.
   */
  syntheticIdentity: storageKey<SyntheticIdentityRecord>('oh.syntheticIdentity'),
  /**
   * Per-workspace `WorkspaceRoleAssignment` rows minted on every
   * workspace creation (UNIFIED_ORACLE_MODEL.md §5.2 row 'WRA' / U1.8).
   * One owner-role row per (synthetic-principal, workspaceId); the list
   * is reconciled against the live workspace set by
   * `ensureWorkspaceRoleAssignments` (in `../identity`).
   */
  workspaceRoleAssignments: storageKey<WorkspaceRoleAssignment[]>('oh.workspaceRoleAssignments'),
  /**
   * Long-lived peer access tokens recognized by this daemon (U3.2,
   * `UNIFIED_ORACLE_MODEL.md` §4.2 + `DATA_PLANE_TOPOLOGIES.md` §11.4).
   * Stores only hashes — the raw secret is returned to the admin exactly
   * once at mint time. Used exclusively when the daemon binds non-loopback
   * (`backend.bindAddress === '0.0.0.0'`); loopback handshakes stay
   * trust-by-process and never consult this list.
   */
  daemonAuthTokens: storageKey<DaemonAuthToken[]>('oh.daemonAuthTokens', { sensitive: true }),
  /**
   * Per-user org-binding preferences (UNIFIED_ORACLE_MODEL.md §6.2 / U3.6)
   * — the two-personal-Orgs onboarding acknowledgement + the default Org
   * for newly-created workspaces. See {@link OrgBindingPrefs}.
   */
  orgBindingPrefs: storageKey<OrgBindingPrefs>('oh.orgBindingPrefs'),
  /**
   * Orgs this host joined by connecting to other backends (Phase U5.2 —
   * "consume-first join"). The handshake WELCOME carries the target
   * backend's home `Org`; `recordJoinedOrg` (in `../identity`) appends
   * it here, and `refreshIdentitySnapshotFromHostStorage` folds the set
   * into `IdentitySnapshot.orgs` so `authorizedOrgIds` lets the joined
   * backend's workspaces sync down. The synthetic home-org is NOT
   * stored here — it already rides {@link OH.syntheticIdentity}.
   */
  joinedOrgs: storageKey<Org[]>('oh.joinedOrgs'),
  /**
   * Per-Org remembered active workspace — `orgId → workspaceId` (Phase
   * U5.9, the org switcher). Each Org keeps its own last-active
   * workspace; switching the active Org restores its entry here so the
   * user lands back where they left off. Stamped by the workspace store
   * on every active-pointer flip. The *globally* active workspace stays
   * {@link OH.runtimeActive}; the active Org is derived from its
   * workspace's `orgId` — never stored as a separate pointer.
   */
  orgActiveWorkspace: storageKey<Record<string, string>>('oh.orgActiveWorkspace'),
} as const;

/**
 * Conservative default allowlist for the workspace-export URL-fetch
 * source (design §5.1). User-managed via Settings → Workspace Sharing →
 * "Allowed fetch hosts"; the persisted value lives in `OH.settingsUser`
 * under the `workspaceSharing.allowedFetchHosts` key (single source of
 * truth — settings dict is the only place the list lives).
 */
export const DEFAULT_ALLOWED_FETCH_HOSTS = ['github.com', 'raw.githubusercontent.com', 'gist.github.com'] as const;
/** Settings dict key for the user-managed host allowlist. */
export const ALLOWED_FETCH_HOSTS_SETTING_KEY = 'workspaceSharing.allowedFetchHosts';

// ── UI-global keys (not workspace-scoped by design) ─────────────────

export const UI = {
  /** Popup filter/sort UI state. Kept global because it's a per-user view pref. */
  popupState: storageKey<PersistedPopupState>('popupState'),
  /** Active tab key in the popup ("all-workbench", "this-page", etc.). */
  activePopupTab: storageKey<string>('activePopupTab'),
  /** Boolean flag set once the onboarding tour has been completed. */
  onboardingCompleted: storageKey<boolean>('onboardingCompleted'),
} as const;

// ── Workspace-scoped keys ────────────────────────────────────────────

export interface WorkspaceKeys {
  rules: StorageKey<Rule[]>;
  collections: StorageKey<Collection[]>;
  folders: StorageKey<PersistedLocalFolder[]>;
  requests: StorageKey<Request[]>;
  requestCollections: StorageKey<Collection[]>;
  requestFolders: StorageKey<PersistedLocalFolder[]>;
  templates: StorageKey<Template[]>;
  templateCollections: StorageKey<Collection[]>;
  templateFolders: StorageKey<PersistedLocalFolder[]>;
  environments: StorageKey<Environment[]>;
  activeEnvironmentId: StorageKey<string | null>;
  defaultEnvironmentId: StorageKey<string | null>;
  workspaceVars: StorageKey<WorkspaceVariables>;
  vault: StorageKey<Vault>;
  pauseMarkers: StorageKey<Record<string, PauseMarker>>;
  /** Persisted `Record<ownerKey, StoredTestRun[]>`. Opaque at storage layer. */
  testRuns: StorageKey<Record<string, unknown>>;
  tabSession: StorageKey<PersistedTabSession>;
  panelLayout: StorageKey<PersistedPanelLayout>;
  /** R2a — taste-scoped workspace settings. Always reads from the global active workspace. */
  settingsWorkspaceTaste: StorageKey<Record<string, unknown>>;
  /** R2b — behavioral-scoped workspace settings. Reads via the per-tab seam in MWPT per-tab mode. */
  settingsWorkspaceBehavioral: StorageKey<Record<string, unknown>>;
  /**
   * Ring of recent import reports (curl / HAR / Postman / Insomnia /
   * OpenAPI) for this workspace. Per ARCHITECTURE.md §23 every import
   * emits a structured report; we persist the last N (default 50) so
   * the user can audit drops + transforms long after the import and
   * so the re-import-diff flow has a prior snapshot to compare to.
   * Opaque at storage layer — shape is `ImportReport[]` from core.
   */
  importReports: StorageKey<unknown[]>;
  /**
   * OAuth 2.0 token store (ARCHITECTURE §18). Map of credentialRef →
   * `OAuth2TokenBundle`. Opaque at storage layer — shape lives in
   * `@openheaders/core/oauth`. Per-workspace so a workspace delete
   * drops its OAuth material alongside environments + files.
   */
  oauth: StorageKey<unknown>;
  /**
   * Live Workflow definitions (see docs/LIVE_VARIABLES_PLAN.md).
   * Refreshable multi-step data sources — each workflow owns its
   * steps + refresh schedule; the workflow-run cache lives under
   * {@link liveCache}.
   */
  liveWorkflows: StorageKey<LiveWorkflow[]>;
  /**
   * Live Variable definitions — `{{live.<name>}}` bindings. Thin
   * namespace projections referencing one workflow step capture.
   */
  liveVariables: StorageKey<LiveVariable[]>;
  /**
   * Live workflow-run cache. Blob keyed by `(workflowUid, environmentId)`
   * holds the most recent extraction per workflow per active env.
   * Opaque at storage layer — shape in `live-cache-store.ts`.
   * Ephemeral: never committed to git, purged on workspace delete.
   */
  liveCache: StorageKey<unknown>;
  /**
   * Recently-inserted `{{scope.name}}` references from the TemplateInput
   * autocomplete popover. LRU-capped at 8 per workspace; surfaced at the
   * top of the suggestion list when the user opens the popover with an
   * empty query. Opaque at storage layer — shape is `VariableRecents`
   * from `workbench/components/template-input/recents.ts`.
   * Ephemeral: never committed to git, purged on workspace delete.
   */
  variableRecents: StorageKey<unknown>;
  /**
   * Per-workspace set of imported request uids whose `preRequestScript`
   * or `postResponseScript` the user hasn't yet reviewed in the
   * inspector. Surfaces as a "scripts" badge on the request row in the
   * sidebar; cleared on first inspector open. Persisted as a flat
   * string array; an empty / missing value means nothing pending.
   */
  requestScriptsReviewPending: StorageKey<string[]>;
  /**
   * Per-entity YAML snapshots from the most recent workspace import,
   * keyed by entity uid. Singletons live under
   * `__singleton.workspaceVars__` and `__singleton.vault__`.
   *
   * Consumed by the import preview's merge editor: when the next
   * import surfaces a collision on a uid present here, the snapshot
   * acts as the common ancestor (3-pane merge against the version we
   * last brought in vs. the new incoming vs. the local edits the user
   * has made since). Without this, every collision falls back to a
   * 2-pane diff per `MERGE_CONFLICT_EDITOR_PLAN.md` §7.
   *
   * Snapshots are written by `importWorkspace` after a successful
   * `setMany`. Skipped plan entries don't update their snapshot —
   * they keep whatever the prior import left.
   */
  lastImportedSnapshots: StorageKey<Record<string, string>>;
  /** Per-collection environment overrides: collectionId → envId (null = "No environment"). */
  collectionEnvOverrides: StorageKey<Record<string, string | null>>;
  /**
   * Last environment the user manually picked. Used only when the
   * `general.collectionEnvAutoSwitch` setting is `'apply-defaults'` —
   * the active env defers to this "base" whenever the current
   * collection has no default of its own.
   */
  manualEnvId: StorageKey<string | null>;
}

/**
 * Authoritative "is this key sensitive?" predicate, derived once from
 * the {@link wsKeys} factory by walking its output with a placeholder
 * workspace id and converting each `sensitive: true` entry into a regex
 * pattern. Wire-level adapters (the host-storage dispatcher in
 * `@openheaders/oracle/host-storage`) use this so the renderer can't
 * downgrade a sensitive slot by claiming it isn't.
 *
 * If a new sensitive slot is added to {@link WorkspaceKeys} or the
 * {@link OH}/{@link UI} namespaces, no code change is needed here —
 * the regex set re-derives on first call.
 */
let cachedSensitivePatterns: RegExp[] | null = null;
function getSensitiveKeyPatterns(): RegExp[] {
  if (cachedSensitivePatterns) return cachedSensitivePatterns;
  const patterns: RegExp[] = [];
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const PLACEHOLDER = '__oh_sensitive_probe__';
  const collectFlat = (specs: Record<string, unknown>): void => {
    for (const spec of Object.values(specs)) {
      if (spec && typeof spec === 'object' && (spec as StorageKey<unknown>).sensitive === true) {
        const key = (spec as StorageKey<unknown>).key;
        patterns.push(new RegExp(`^${escape(key)}$`));
      }
    }
  };
  const collectWs = (specs: Record<string, unknown>): void => {
    for (const spec of Object.values(specs)) {
      if (spec && typeof spec === 'object' && (spec as StorageKey<unknown>).sensitive === true) {
        const key = (spec as StorageKey<unknown>).key;
        const pattern = key.split(PLACEHOLDER).map(escape).join('[^.]+');
        patterns.push(new RegExp(`^${pattern}$`));
      }
    }
  };
  collectFlat(OH as unknown as Record<string, unknown>);
  collectFlat(UI as unknown as Record<string, unknown>);
  collectWs(wsKeys(PLACEHOLDER) as unknown as Record<string, unknown>);
  cachedSensitivePatterns = patterns;
  return patterns;
}

export function isSensitiveKey(key: string): boolean {
  return getSensitiveKeyPatterns().some((re) => re.test(key));
}

export function wsKeys(workspaceId: string): WorkspaceKeys {
  const p = `oh.ws.${workspaceId}`;
  return {
    rules: storageKey<Rule[]>(`${p}.rules`),
    collections: storageKey<Collection[]>(`${p}.collections`),
    folders: storageKey<PersistedLocalFolder[]>(`${p}.folders`),
    requests: storageKey<Request[]>(`${p}.requests`),
    requestCollections: storageKey<Collection[]>(`${p}.requestCollections`),
    requestFolders: storageKey<PersistedLocalFolder[]>(`${p}.requestFolders`),
    templates: storageKey<Template[]>(`${p}.templates`),
    templateCollections: storageKey<Collection[]>(`${p}.templateCollections`),
    templateFolders: storageKey<PersistedLocalFolder[]>(`${p}.templateFolders`),
    environments: storageKey<Environment[]>(`${p}.environments`),
    activeEnvironmentId: storageKey<string | null>(`${p}.activeEnvironmentId`),
    defaultEnvironmentId: storageKey<string | null>(`${p}.defaultEnvironmentId`),
    workspaceVars: storageKey<WorkspaceVariables>(`${p}.workspaceVars`),
    vault: storageKey<Vault>(`${p}.vault`, { sensitive: true }),
    pauseMarkers: storageKey<Record<string, PauseMarker>>(`${p}.pauseMarkers`),
    testRuns: storageKey<Record<string, unknown>>(`${p}.testRuns`),
    tabSession: storageKey<PersistedTabSession>(`${p}.tabSession`),
    panelLayout: storageKey<PersistedPanelLayout>(`${p}.panelLayout`),
    settingsWorkspaceTaste: storageKey<Record<string, unknown>>(`${p}.settings.workspaceTaste`),
    settingsWorkspaceBehavioral: storageKey<Record<string, unknown>>(`${p}.settings.workspaceBehavioral`),
    importReports: storageKey<unknown[]>(`${p}.importReports`),
    oauth: storageKey<unknown>(`${p}.oauth`, { sensitive: true }),
    liveWorkflows: storageKey<LiveWorkflow[]>(`${p}.liveWorkflows`),
    liveVariables: storageKey<LiveVariable[]>(`${p}.liveVariables`),
    liveCache: storageKey<unknown>(`${p}.liveCache`),
    variableRecents: storageKey<unknown>(`${p}.variableRecents`),
    requestScriptsReviewPending: storageKey<string[]>(`${p}.requestScriptsReviewPending`),
    lastImportedSnapshots: storageKey<Record<string, string>>(`${p}.lastImportedSnapshots`),
    collectionEnvOverrides: storageKey<Record<string, string | null>>(`${p}.collectionEnvOverrides`),
    manualEnvId: storageKey<string | null>(`${p}.manualEnvId`),
  };
}
