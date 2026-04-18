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
} as const;

// ── UI-global keys (not workspace-scoped by design) ─────────────────

export const UI = {
  /** Popup filter/sort UI state. Kept global because it's a per-user view pref. */
  popupState: storageKey<PersistedPopupState>('popupState'),
  /** Active tab key in the popup ("all-rules", "this-page", etc.). */
  activeRulesTab: storageKey<string>('activeRulesTab'),
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
  };
}
