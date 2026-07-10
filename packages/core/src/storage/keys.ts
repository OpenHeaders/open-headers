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

import type { BackendReach } from '../protocol';
import type {
  BackendConnection,
  Collection,
  DaemonAuthToken,
  DaemonConfig,
  DaemonUserRecord,
  Environment,
  ExtensionWorkspace,
  LiveFallbackPrioritySnapshot,
  LiveVariable,
  LiveWorkflow,
  LogEntry,
  Org,
  Request,
  ResponseExample,
  Rule,
  ScriptPackage,
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
 * `defaultNewWorkspaceOrgId` is the Org newly-created workspaces bind to;
 * when unset or stale the resolver falls back to the widest-reach Org.
 * Plain JSON — not security-sensitive.
 */
export interface OrgBindingPrefs {
  /** Org id new workspaces bind to; null = use the widest-reach Org. */
  defaultNewWorkspaceOrgId: string | null;
}

/**
 * One persisted row of `OH.joinedOrgs` — an Org consumed from another
 * backend, stamped with the {@link OH.backends} record it was consumed
 * from (MULTI_BACKEND_PLAN.md §2 — Org provenance). The Org is the
 * routing key of the multi-backend model: every joined Org is
 * authoritative on exactly one backend.
 */
export interface JoinedOrgRecord {
  org: Org;
  /** `OH.backends` record id this Org was consumed from. */
  backendId: string;
}

/**
 * Reach tiers keyed per connection: `OH.backends` record ids for client
 * wires, {@link SELF_BACKEND_REACH_KEY} for the host's own server bind.
 */
export type BackendReachMap = Record<string, BackendReach>;

/**
 * `OH.backendReach` key for the host's OWN server-bind tier — tier zero
 * publishing how far it is reachable (the node ws-server writes it at
 * listen time). Not an `OH.backends` record id: the local engine is
 * never a registry entry.
 */
export const SELF_BACKEND_REACH_KEY = 'self';

/**
 * One persisted row of `OH.backendOrgConflicts` — a WELCOME refused
 * under the Org-uniqueness invariant (one Org, one backend). Keyed by
 * `(backendId, orgId)`; the writers live in
 * `@openheaders/core/backends` (`org-conflicts.ts`). `orgName` is
 * persisted because a refused Org never enters the identity snapshot;
 * `boundBackendId` stays an id — consumers resolve the provider's label
 * against the live registry at render time.
 */
export interface BackendOrgConflict {
  backendId: string;
  orgId: string;
  orgName: string;
  boundBackendId: string;
  /** ISO timestamp of the most recent refusal. */
  at: string;
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
   * Consulted on every HELLO and every `/mcp` request, loopback and LAN
   * alike. Stores only SHA-256 hashes of high-entropy random secrets —
   * the raw secret is returned to the admin exactly once at mint time
   * and is never recoverable from this ledger. Deliberately NOT a
   * sensitive slot: the ledger is integrity data, not secret material,
   * and it must stay read/writable on hosts without a secret cipher
   * (the headless daemon) or pairing and token validation break.
   */
  daemonAuthTokens: storageKey<DaemonAuthToken[]>('oh.daemonAuthTokens'),
  /**
   * The daemon's directory of daemon-local users (Phase 5 team tier).
   * Each record reuses the §5 identity rows (User + UserIdentity +
   * OrgMembership + Principal) anchored in the daemon's own Org; auth
   * tokens bind to a directory user via `DaemonAuthToken.userId`. The
   * operator's own identity stays in {@link OH.syntheticIdentity} and is
   * never duplicated here. Daemon-local by design (§5.6 — memberships
   * live on the daemons); never syncs. Not sensitive: names + membership
   * rows, no secret material, and it must stay writable on cipher-less
   * hosts (the headless daemon).
   */
  daemonUsers: storageKey<DaemonUserRecord[]>('oh.daemonUsers'),
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
   * it here as a {@link JoinedOrgRecord} stamped with the delivering
   * backend's {@link OH.backends} id, and
   * `refreshIdentitySnapshotFromHostStorage` folds the set into
   * `IdentitySnapshot.orgs` so `authorizedOrgIds` lets the joined
   * backend's workspaces sync down. The private home Org is NOT
   * stored here — it already rides {@link OH.syntheticIdentity}.
   */
  joinedOrgs: storageKey<JoinedOrgRecord[]>('oh.joinedOrgs'),
  /**
   * Registry of back-ends this app instance has joined
   * (MULTI_BACKEND_PLAN.md §2). Ordered records; the Phase-1 cap-1
   * adapter reads entry #0 as "the" backend until the N-socket
   * connection plane lands. The local host engine is tier zero and is
   * never stored here. Sensitive: each record carries its per-backend
   * paired token.
   */
  backends: storageKey<BackendConnection[]>('oh.backends', { sensitive: true }),
  /**
   * The web tab's paired daemon access token. The tab has exactly one
   * backend — the daemon that served it (`wss://<location.host>`) — so
   * a single origin-scoped slot replaces the {@link OH.backends}
   * registry there. Deliberately NOT a sensitive slot: the web host has
   * no at-rest cipher (sensitive slots refuse writes), and the token
   * lives in the same origin-scoped IDB the daemon's own data already
   * occupies — the tab's trust boundary IS the origin.
   */
  webBackendToken: storageKey<string>('oh.webBackendToken'),
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
  /**
   * Reach tiers, keyed per connection ({@link BackendReachMap}): one
   * entry per connected backend record (from its handshake WELCOME) plus
   * the host's own server-bind tier under {@link SELF_BACKEND_REACH_KEY}.
   * Live connection state, not a preference — each wire's entry clears
   * on its disconnect and the whole slot resets at SW init. Renderer
   * surfaces read it (via `useBackendReach`) to render accurate "extend
   * your reach" guidance and home-Org host hints; the writers live in
   * `@openheaders/core/backends` (`reach.ts`).
   */
  backendReach: storageKey<BackendReachMap>('oh.backendReach'),
  /**
   * Durable Org-conflict rows ({@link BackendOrgConflict}) — WELCOMEs
   * refused because the claimed Org is bound to another backend. One row
   * per `(backendId, orgId)`; written on refusal, cleared on that
   * backend's later successful claim, pruned on record removal. Rendered
   * by the connections list under the refused backend's row.
   */
  backendOrgConflicts: storageKey<BackendOrgConflict[]>('oh.backendOrgConflicts'),
} as const;

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
   * Script packages — named, reusable script modules loaded from
   * pre-request / post-response scripts via `oh.require('<name>')`.
   */
  scriptPackages: StorageKey<ScriptPackage[]>;
  /**
   * Response examples — frozen request/response exchange snapshots
   * saved under a request via "Save Response".
   */
  responseExamples: StorageKey<ResponseExample[]>;
  /**
   * Live workflow-run cache. Blob keyed by `(workflowUid, environmentId)`
   * holds the most recent extraction per workflow per active env.
   * Opaque at storage layer — shape in `live-cache-store.ts`.
   * Ephemeral: never committed to git, purged on workspace delete.
   */
  liveCache: StorageKey<unknown>;
  /**
   * Offline-fallback host ranking (WS-C C14). The synced set of
   * `Principal.id`s eligible to become the single offline fallback runner
   * for an exclusive Live Workflow, ordered by user-assigned rank. The
   * scheduler's offline election reads the *frozen, last-synced* copy from
   * here. Not sensitive — members carry only identity hashes. Ephemeral:
   * never committed to git, purged on workspace delete.
   */
  liveFallbackPriority: StorageKey<LiveFallbackPrioritySnapshot>;
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
  const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const PLACEHOLDER = '__oh_sensitive_probe__';
  const collectFlat = (specs: Record<string, unknown>): void => {
    for (const spec of Object.values(specs)) {
      if (spec && typeof spec === 'object' && (spec as StorageKey<unknown>).sensitive === true) {
        const key = (spec as StorageKey<unknown>).key;
        patterns.push(new RegExp(`^${escapeRegExp(key)}$`));
      }
    }
  };
  const collectWs = (specs: Record<string, unknown>): void => {
    for (const spec of Object.values(specs)) {
      if (spec && typeof spec === 'object' && (spec as StorageKey<unknown>).sensitive === true) {
        const key = (spec as StorageKey<unknown>).key;
        const pattern = key.split(PLACEHOLDER).map(escapeRegExp).join('[^.]+');
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
    tabSession: storageKey<PersistedTabSession>(`${p}.tabSession`),
    panelLayout: storageKey<PersistedPanelLayout>(`${p}.panelLayout`),
    settingsWorkspaceTaste: storageKey<Record<string, unknown>>(`${p}.settings.workspaceTaste`),
    settingsWorkspaceBehavioral: storageKey<Record<string, unknown>>(`${p}.settings.workspaceBehavioral`),
    importReports: storageKey<unknown[]>(`${p}.importReports`),
    oauth: storageKey<unknown>(`${p}.oauth`, { sensitive: true }),
    liveWorkflows: storageKey<LiveWorkflow[]>(`${p}.liveWorkflows`),
    liveVariables: storageKey<LiveVariable[]>(`${p}.liveVariables`),
    scriptPackages: storageKey<ScriptPackage[]>(`${p}.scriptPackages`),
    responseExamples: storageKey<ResponseExample[]>(`${p}.responseExamples`),
    liveCache: storageKey<unknown>(`${p}.liveCache`),
    liveFallbackPriority: storageKey<LiveFallbackPrioritySnapshot>(`${p}.liveFallbackPriority`),
    variableRecents: storageKey<unknown>(`${p}.variableRecents`),
    requestScriptsReviewPending: storageKey<string[]>(`${p}.requestScriptsReviewPending`),
    lastImportedSnapshots: storageKey<Record<string, string>>(`${p}.lastImportedSnapshots`),
    collectionEnvOverrides: storageKey<Record<string, string | null>>(`${p}.collectionEnvOverrides`),
    manualEnvId: storageKey<string | null>(`${p}.manualEnvId`),
  };
}
