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

import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import type { LogEntry } from '@/shared/observability/types';
import type { ViewMode } from '@/shared/view-mode/types';

// ── Core key type ────────────────────────────────────────────────────

export type StorageArea = 'local' | 'sync' | 'session';

/**
 * Tagged specification for a single storage slot. The phantom `__value`
 * field carries the payload type through the type system — it is never
 * populated at runtime.
 */
export interface StorageKey<T> {
  readonly key: string;
  readonly area: StorageArea;
  readonly __value?: T;
}

export function storageKey<T>(key: string, area: StorageArea = 'local'): StorageKey<T> {
  return { key, area };
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
  /** Dockable tool-window state. Opaque at storage layer. */
  toolLayout?: unknown;
}

export interface PersistedLocalFolder {
  /** Persisted format version for each `_folder.yaml` once the codec lands. */
  schemaVersion: number;
  /** Phase 10 monotonic write counter — mirrors `FolderSchema.version`. */
  version: number;
  uid: string;
  path: string;
  name: string;
}

/** On-disk shape of `oh.hotkeyCommand` — transient signal the SW clears. */
export interface HotkeyCommandSignal {
  type: 'TOGGLE_RECORDING';
  timestamp: number;
}

// ── Global keys ──────────────────────────────────────────────────────

export const OH = {
  /** Full list of extension workspaces. */
  workspaces: storageKey<V5.ExtensionWorkspace[]>('oh.workspaces'),
  /** Id of the currently active workspace — points at a workspace in `OH.workspaces`. */
  activeWorkspaceId: storageKey<string>('oh.activeWorkspaceId'),
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
} as const;

// ── UI-global keys (not workspace-scoped by design) ─────────────────

export const UI = {
  /** Popup filter/sort UI state. Kept global because it's a per-user view pref. */
  popupState: storageKey<PersistedPopupState>('popupState'),
  /** Active tab key in the popup ("all-workbench", "this-page", etc.). */
  activePopupTab: storageKey<string>('activePopupTab'),
  /** Boolean flag set once the onboarding tour has been completed. */
  onboardingCompleted: storageKey<boolean>('onboardingCompleted'),
  /** Dock layout for the devtools panel — kept global; devtools is a single surface. */
  panelDockLayout: storageKey<unknown>('panelDockLayout'),
  /** Transient hotkey signal consumed + cleared by the background SW. */
  hotkeyCommand: storageKey<HotkeyCommandSignal>('hotkeyCommand'),
} as const;

// ── Workspace-scoped keys ────────────────────────────────────────────

export interface WorkspaceKeys {
  rules: StorageKey<V5.Rule[]>;
  collections: StorageKey<V5.Collection[]>;
  folders: StorageKey<PersistedLocalFolder[]>;
  requests: StorageKey<V5.Request[]>;
  requestCollections: StorageKey<V5.Collection[]>;
  requestFolders: StorageKey<PersistedLocalFolder[]>;
  templates: StorageKey<V5.Template[]>;
  templateCollections: StorageKey<V5.Collection[]>;
  templateFolders: StorageKey<PersistedLocalFolder[]>;
  environments: StorageKey<V5.Environment[]>;
  activeEnvironmentId: StorageKey<string | null>;
  defaultEnvironmentId: StorageKey<string | null>;
  workspaceVars: StorageKey<V5.WorkspaceVariables>;
  vault: StorageKey<V5.Vault>;
  pauseMarkers: StorageKey<Record<string, PauseMarker>>;
  /** Persisted `Record<ownerKey, StoredTestRun[]>`. Opaque at storage layer. */
  testRuns: StorageKey<Record<string, unknown>>;
  tabSession: StorageKey<PersistedTabSession>;
  panelLayout: StorageKey<PersistedPanelLayout>;
  settingsWorkspace: StorageKey<Record<string, unknown>>;
  settingsCollection: StorageKey<Record<string, unknown>>;
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
  liveWorkflows: StorageKey<V5.LiveWorkflow[]>;
  /**
   * Live Variable definitions — `{{live.<name>}}` bindings. Thin
   * namespace projections referencing one workflow step capture.
   */
  liveVariables: StorageKey<V5.LiveVariable[]>;
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
  /** Per-collection environment overrides: collectionId → envId (null = "No environment"). */
  collectionEnvOverrides: StorageKey<Record<string, string | null>>;
}

export function wsKeys(workspaceId: string): WorkspaceKeys {
  const p = `oh.ws.${workspaceId}`;
  return {
    rules: storageKey<V5.Rule[]>(`${p}.rules`),
    collections: storageKey<V5.Collection[]>(`${p}.collections`),
    folders: storageKey<PersistedLocalFolder[]>(`${p}.folders`),
    requests: storageKey<V5.Request[]>(`${p}.requests`),
    requestCollections: storageKey<V5.Collection[]>(`${p}.requestCollections`),
    requestFolders: storageKey<PersistedLocalFolder[]>(`${p}.requestFolders`),
    templates: storageKey<V5.Template[]>(`${p}.templates`),
    templateCollections: storageKey<V5.Collection[]>(`${p}.templateCollections`),
    templateFolders: storageKey<PersistedLocalFolder[]>(`${p}.templateFolders`),
    environments: storageKey<V5.Environment[]>(`${p}.environments`),
    activeEnvironmentId: storageKey<string | null>(`${p}.activeEnvironmentId`),
    defaultEnvironmentId: storageKey<string | null>(`${p}.defaultEnvironmentId`),
    workspaceVars: storageKey<V5.WorkspaceVariables>(`${p}.workspaceVars`),
    vault: storageKey<V5.Vault>(`${p}.vault`),
    pauseMarkers: storageKey<Record<string, PauseMarker>>(`${p}.pauseMarkers`),
    testRuns: storageKey<Record<string, unknown>>(`${p}.testRuns`),
    tabSession: storageKey<PersistedTabSession>(`${p}.tabSession`),
    panelLayout: storageKey<PersistedPanelLayout>(`${p}.panelLayout`),
    settingsWorkspace: storageKey<Record<string, unknown>>(`${p}.settings.workspace`),
    settingsCollection: storageKey<Record<string, unknown>>(`${p}.settings.collection`),
    importReports: storageKey<unknown[]>(`${p}.importReports`),
    oauth: storageKey<unknown>(`${p}.oauth`),
    liveWorkflows: storageKey<V5.LiveWorkflow[]>(`${p}.liveWorkflows`),
    liveVariables: storageKey<V5.LiveVariable[]>(`${p}.liveVariables`),
    liveCache: storageKey<unknown>(`${p}.liveCache`),
    variableRecents: storageKey<unknown>(`${p}.variableRecents`),
    collectionEnvOverrides: storageKey<Record<string, string | null>>(`${p}.collectionEnvOverrides`),
  };
}
