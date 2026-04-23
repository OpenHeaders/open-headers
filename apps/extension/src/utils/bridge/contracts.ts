/**
 * Typed contracts for every message that crosses the extension's
 * background/popup/workspace boundary.
 *
 * Two shapes:
 *   - `BridgeRpcContract` — typed request/response RPC. Consumer calls
 *     `bridge.call('type', payload)` and receives a typed response.
 *     Every entry here corresponds to exactly one handler in the
 *     background service worker.
 *   - `BridgeBroadcastContract` — fire-and-forget pushes from the SW
 *     to all open extension pages. Consumers subscribe via
 *     `bridge.subscribe('type', handler)`.
 *
 * Adding a new message:
 *   1. Add an entry here.
 *   2. Handle it in background/modules/message-handler.ts (or broadcast
 *      it from wherever the SW decides to push).
 *   3. Call it with `bridge.call(...)` / `bridge.broadcast(...)`.
 */

import type { AppNavigationIntent, WorkflowRecordingPayload } from '@openheaders/core';
import type { FileRef } from '@openheaders/core/files';
import type { ImportReport } from '@openheaders/core/import';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import type { IntentCallerContext, WorkspaceIntent } from '@openheaders/core/workspace-intent';
import type { WorkflowRunCache } from '@/background/modules/live-cache-store';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';
import type { TabTelemetrySnapshot } from '@/background/modules/tab-telemetry';
import type { LoadedTestRun, TestRunOwnerType } from '@/background/modules/test-run-store';
import type { LogEntry as ObservabilityLogEntry } from '@/shared/observability/types';
import type { StatusSnapshot } from '@/shared/status/types';
import type { PersistedPanelLayout } from '@/shared/storage';
import type { ActiveRule } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';
import type { RecordingData, RecordingStateInfo } from '@/types/recording';

// ── Workspace ────────────────────────────────────────────────────

/** Snapshot returned whenever the UI needs the current workspace list + active id. */
export interface WorkspaceSnapshot {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string;
}

/**
 * Wire shape of one cached workflow run. Named alias over the SW-side
 * `WorkflowRunCache` so the bridge surface doesn't depend on the
 * extension-internal module path during renderer-side type checks.
 */
export type LiveWorkflowRunSnapshot = WorkflowRunCache;

/** Shared shape for a folder descriptor returned by create-folder RPCs. */
export interface FolderDescriptor {
  uid: string;
  path: string;
  name: string;
}

/**
 * Shape the bottom-panel Test Runs list renders. Matches the store's
 * `LoadedTestRun` (StoredTestRun + staleness flag) — the bridge contract
 * re-exports the name so callers don't need to know about the store.
 */
export type ListedTestRun = LoadedTestRun;

/** Final test run payload produced by `startTestRun`. */
export type StartTestRunResult = unknown;

/**
 * RPC contract: map of message-type → { req, res }.
 *
 * `req` is the payload (WITHOUT the `type` field). `res` is the value
 * the caller receives after the SW handler replies. Use `Record<string, never>`
 * for argument-less RPCs.
 */
export interface BridgeRpcContract {
  // ── Connection / presence ──────────────────────────────────────
  popupOpen: {
    req: Record<string, never>;
    res: {
      type?: string;
      rules: V5.Rule[];
      connected: boolean;
      workspaces: V5.ExtensionWorkspace[];
      activeWorkspaceId: string;
    };
  };

  // ── Workspaces ─────────────────────────────────────────────────
  listWorkspaces: {
    req: Record<string, never>;
    res: WorkspaceSnapshot;
  };
  getActiveWorkspace: {
    req: Record<string, never>;
    res: { workspace: V5.ExtensionWorkspace };
  };
  createWorkspace: {
    req: { name: string; description?: string; color?: string; icon?: string };
    res: { success: boolean; workspace?: V5.ExtensionWorkspace; error?: string };
  };
  renameWorkspace: {
    req: { id: string; name: string };
    res: { success: boolean };
  };
  updateWorkspace: {
    req: {
      id: string;
      updates: {
        name?: string;
        description?: string;
        color?: string;
        /** `null` clears the icon (color-only mode); undefined leaves it untouched. */
        icon?: string | null;
      };
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    /**
     * `success`/`workspace` shape is preserved for existing callers
     * (WorkspaceManager.onSubmit pattern). The Phase 10 fields
     * (`version`, `reason`) are additive — callers that want the
     * discriminated union shape read them; callers that don't keep
     * using `success`.
     */
    res:
      | { success: true; workspace: V5.ExtensionWorkspace; version: number }
      | { success: false; reason: 'stale-draft'; serverVersion: number; serverWorkspace: V5.ExtensionWorkspace }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; message: string };
  };
  deleteWorkspace: {
    req: { id: string };
    res: { success: boolean; activeWorkspaceId?: string; error?: string };
  };
  duplicateWorkspace: {
    req: { id: string; name?: string };
    res: { success: boolean; workspace?: V5.ExtensionWorkspace; error?: string };
  };
  setActiveWorkspace: {
    req: { id: string };
    res: { success: boolean; error?: string };
  };
  reorderWorkspaces: {
    req: { idOrder: string[] };
    res: { success: boolean };
  };
  checkConnection: {
    req: Record<string, never>;
    res: { connected: boolean };
  };
  getRules: {
    req: Record<string, never>;
    res: { rules: V5.Rule[]; isConnected: boolean };
  };
  rulesUpdated: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };

  // ── Tab / app launcher ─────────────────────────────────────────
  openTab: {
    req: { url: string };
    res: { success: boolean; tabId?: number; error?: string };
  };
  focusApp: {
    req: { navigation?: AppNavigationIntent };
    res: { success: boolean };
  };

  /**
   * Workspace Intent — the single cross-surface navigation RPC.
   *
   * Every "open X in the workspace" action from popup / sidepanel /
   * devpanel (or the workspace itself, when dispatching to another
   * workspace tab) goes through this one call. The SW picks the right
   * target tab (same-window preference, see `selectTargetTab`) and
   * either delivers the intent to an existing workspace page over
   * runtime messaging (warm path) or opens a fresh tab at the intent's
   * encoded URL (cold path).
   *
   * The intent is schema-validated at the SW boundary; malformed
   * payloads are rejected without side effects. See Phase 9 spec.
   */
  openWorkspaceIntent: {
    req: { intent: WorkspaceIntent; callerContext?: IntentCallerContext };
    res:
      | { ok: true; tabId: number; windowId?: number; path: 'warm' | 'warm-fallback' | 'cold' }
      | { ok: false; reason: string };
  };

  /**
   * Tab-ordinal bootstrap for a freshly-mounted workspace page.
   *
   * Renderers don't know their own tab id, so the SW derives it from
   * `sender.tab.id` and replies with that tab's current ordinal plus
   * the global live-tab count. Called once at mount; subsequent
   * changes arrive via the `workspaceTabsChanged` broadcast.
   *
   * `ordinal` is `null` if the tab is somehow not tracked (rare —
   * happens during a race between mount and the SW's `onCreated`
   * listener). The hook falls back to rendering `Open Headers` until
   * the first broadcast fills it in.
   */
  getWorkspaceTabOrdinal: {
    req: Record<string, never>;
    res: { ordinal: number | null; count: number };
  };

  // ── Recording settings (WebSocket passthrough) ─────────────────
  toggleVideoRecording: {
    req: { enabled: boolean };
    res: { success: boolean; error?: string };
  };
  toggleRecordingHotkey: {
    req: { enabled: boolean };
    res: { success: boolean; error?: string };
  };
  getVideoRecordingState: {
    req: Record<string, never>;
    res: { success: boolean; enabled?: boolean };
  };
  getRecordingHotkey: {
    req: Record<string, never>;
    res: { success: boolean; hotkey?: string };
  };

  // ── Rule CRUD (local + desktop-routed) ─────────────────────────
  toggleRule: {
    req: { ruleId: string; enabled: boolean };
    res: { success: boolean; error?: string };
  };
  deleteRule: {
    req: { ruleId: string };
    res: { success: boolean; error?: string };
  };
  toggleAllRules: {
    req: { ruleIds: string[]; enabled: boolean };
    res: { success: boolean; error?: string };
  };
  createLocalRule: {
    req: {
      rule: Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion' | 'version'>;
      collectionUid?: string;
      parentPath?: string;
    };
    res: { success: boolean; rule?: V5.Rule };
  };
  createRuleDraft: {
    req: { draft: V5.RuleDraft };
    res: { success: boolean; nonce?: string; error?: string };
  };
  takeRuleDraft: {
    req: { nonce: string };
    res: { success: boolean; draft: V5.RuleDraft | null };
  };
  setCacheBypass: {
    req: { tabId: number; enabled: boolean };
    res: { success: boolean; error?: string };
  };
  updateLocalRule: {
    req: {
      ruleId: string;
      updates: Partial<Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
      /**
       * Phase 10 stale-draft contract. Optional — editors that track
       * the `version` they loaded opt in to cross-tab concurrent-edit
       * protection by passing it here. When present, the SW rejects
       * the save with `reason: 'stale-draft'` + the server's current
       * copy if the stored `version` has advanced since load.
       *
       * Omitting the field signals an unversioned write — the
       * inspector's "override header" CTA and any programmatic flow
       * that didn't load the rule into an editor. Those calls are
       * accepted as last-write-wins; the per-entity lock still
       * serializes the storage write so there's no read-modify-write
       * race at the boundary.
       */
      expectedVersion?: number;
    };
    /**
     * Result mirrors `RuleWriteResult` from rule-store:
     *   - `ok: true` — save accepted, `version` is the new counter
     *     the client should track for subsequent saves.
     *   - `reason: 'stale-draft'` — another tab saved first; the
     *     renderer prompts the user to reload (take the server copy)
     *     or keep editing (force-save bumps expectedVersion out of
     *     the way).
     *   - `reason: 'not-found'` — rule was deleted between load and
     *     save.
     *   - `reason: 'other'` — unexpected error (lock timeout, storage
     *     failure). Covers the message-handler catch path.
     */
    res:
      | { ok: true; version: number; rule: V5.Rule }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverRule: V5.Rule }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  getLocalRules: {
    req: Record<string, never>;
    res: { rules: V5.Rule[] };
  };
  getLocalCollections: {
    req: Record<string, never>;
    res: { collections: V5.Collection[] };
  };
  getLocalCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: V5.CollectionTree[] };
  };
  getLocalFolders: {
    req: Record<string, never>;
    res: { folders: unknown[] };
  };
  createLocalFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameLocalFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };
  createLocalCollection: {
    req: { name: string };
    res: { success: boolean; collection?: V5.Collection };
  };
  renameLocalCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };

  // ── Per-tab telemetry + active rules ───────────────────────────
  getActiveRulesForTab: {
    req: { tabId: number | undefined; tabUrl: string | undefined };
    res: { activeRules: ActiveRule[] };
  };
  getTabTelemetry: {
    req: { tabId: number };
    res: TabTelemetrySnapshot;
  };
  tabFire: {
    req: { ruleUid: string; url: string; t: number };
    res: { success: boolean };
  };
  perfResourceEntries: {
    req: { entries: PerfResourceEntry[] };
    res: { success: boolean };
  };

  // ── Test runs ──────────────────────────────────────────────────
  startTestRun: {
    req: {
      ownerType: TestRunOwnerType;
      ownerId: string;
      scopeLabel: string;
      ruleUids: string[];
      url: string;
      waitSeconds: number;
    };
    res: { success: boolean; result?: StartTestRunResult; error?: string };
  };
  listTestRunsForOwner: {
    req: { ownerType: TestRunOwnerType; ownerId: string };
    res: { success: boolean; runs?: ListedTestRun[]; error?: string };
  };
  listAllTestRuns: {
    req: Record<string, never>;
    res: { success: boolean; runs?: ListedTestRun[]; error?: string };
  };
  getTestRun: {
    req: { runId: string };
    res: { success: boolean; run?: LoadedTestRun | null; error?: string };
  };
  deleteTestRun: {
    req: { runId: string };
    res: { success: boolean; error?: string };
  };
  deleteAllTestRunsForOwner: {
    req: { ownerType: TestRunOwnerType; ownerId: string };
    res: { success: boolean; error?: string };
  };

  // ── Template CRUD ──────────────────────────────────────────────
  getTemplates: {
    req: Record<string, never>;
    res: { templates: V5.Template[] };
  };
  getTemplateCollections: {
    req: Record<string, never>;
    res: { collections: V5.Collection[] };
  };
  getTemplateCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: V5.CollectionTree[] };
  };
  getTemplateFolders: {
    req: Record<string, never>;
    res: { folders: unknown[] };
  };
  createTemplate: {
    req: {
      template: Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>;
      collectionUid?: string;
      parentPath?: string;
    };
    res: { success: boolean; template?: V5.Template };
  };
  updateTemplate: {
    req: {
      templateUid: string;
      updates: Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; template: V5.Template }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverTemplate: V5.Template }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteTemplate: {
    req: { templateUid: string };
    res: { success: boolean };
  };
  createTemplateCollection: {
    req: { name: string };
    res: { success: boolean; collection?: V5.Collection };
  };
  renameTemplateCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteTemplateCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };
  createTemplateFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameTemplateFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteTemplateFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };

  // ── Environments / Variables / Vault (active workspace) ───────
  listEnvironments: {
    req: Record<string, never>;
    res: {
      environments: V5.Environment[];
      activeEnvironmentId: string | null;
      defaultEnvironmentId: string | null;
      collectionEnvOverrides: Record<string, string | null>;
    };
  };
  createEnvironment: {
    req: { name: string; variables?: V5.Variable[] };
    res: { success: boolean; environment?: V5.Environment };
  };
  renameEnvironment: {
    req: { uid: string; name: string };
    // Same `EnvironmentWriteResult` shape as `updateEnvironmentVariables`.
    // Rename typically fires from the sidebar (no tracked version)
    // so the SW accepts it as last-write-wins; the store still
    // bumps the counter so subsequent editor saves catch staleness.
    res:
      | { ok: true; version: number; environment: V5.Environment }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverEnvironment: V5.Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  updateEnvironmentVariables: {
    req: {
      uid: string;
      variables: V5.Variable[];
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; environment: V5.Environment }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverEnvironment: V5.Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteEnvironment: {
    req: { uid: string };
    res: { success: boolean };
  };
  setActiveEnvironment: {
    req: { uid: string | null };
    res: { success: boolean };
  };
  setDefaultEnvironment: {
    req: { uid: string | null };
    res: { success: boolean };
  };
  setCollectionEnvOverride: {
    req: { collectionId: string; envId: string | null | undefined };
    res: { success: boolean };
  };
  setCollectionPinnedEnvs: {
    req: { collectionUid: string; pinnedEnvironmentIds: string[]; defaultEnvironmentId: string | null };
    res: { success: boolean };
  };
  getWorkspaceVariables: {
    req: Record<string, never>;
    res: { workspaceVariables: V5.WorkspaceVariables };
  };
  setWorkspaceVariables: {
    req: {
      workspaceVariables: V5.WorkspaceVariables;
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; workspaceVariables: V5.WorkspaceVariables }
      | {
          ok: false;
          reason: 'stale-draft';
          serverVersion: number;
          serverWorkspaceVariables: V5.WorkspaceVariables;
        }
      | { ok: false; reason: 'other'; message: string };
  };
  getVault: {
    req: Record<string, never>;
    res: { vault: V5.Vault };
  };
  setVault: {
    req: {
      vault: V5.Vault;
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; vault: V5.Vault }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverVault: V5.Vault }
      | { ok: false; reason: 'other'; message: string };
  };

  /**
   * Per-secret vault mutators — the channel the `ChromeStorageVault`
   * renderer-side Vault interface uses for `put` / `delete`. Routing
   * every write through the SW keeps the Web Lock wrapping + version
   * counter authoritative; direct `chrome.storage.local.set` on the
   * vault key is architecturally forbidden (two writers = race).
   *
   * Last-write-wins semantics — the per-key callers (OAuth refresh,
   * API-key flows) don't track a loaded version, and the lock alone
   * prevents lost updates. Bulk edits from `VaultEditor` still use
   * `setVault` with an explicit `expectedVersion` for full
   * stale-draft semantics.
   */
  vaultPutSecret: {
    req: { key: string; value: string };
    res: { ok: true; version: number; vault: V5.Vault } | { ok: false; reason: 'other'; message: string };
  };
  vaultDeleteSecret: {
    req: { key: string };
    res: { ok: true; version: number; vault: V5.Vault } | { ok: false; reason: 'other'; message: string };
  };
  /**
   * Per-secret read — returns the SW's in-memory snapshot value.
   * Reads are consistent without a lock (single-threaded SW; no
   * concurrent writer visible to the reader).
   */
  vaultGetSecret: {
    req: { key: string };
    res: { value: string | null };
  };
  /** List every secret name in the active workspace's vault. */
  vaultListSecretNames: {
    req: Record<string, never>;
    res: { names: string[] };
  };

  /**
   * Replace the pause-markers map for the active workspace. Every
   * renderer-side pause toggle goes through this RPC so writes
   * serialize through the SW's `entityLockName(ws, 'pause-markers',
   * 'singleton')` lock. The renderer computes the next full map from
   * its local snapshot + the user action; the SW just writes it.
   * Concurrent writers land atomically one-at-a-time through the
   * lock; the broadcast back to other tabs keeps every renderer's
   * view in sync.
   */
  setPauseMarkers: {
    req: { markers: Record<string, 'paused' | 'unpaused'> };
    res: { success: boolean };
  };
  updateCollectionVariables: {
    req: {
      collectionUid: string;
      variables: V5.Variable[];
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; collection: V5.Collection }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverCollection: V5.Collection }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };

  // ── API Requests (active workspace) ────────────────────────────
  getLocalRequests: {
    req: Record<string, never>;
    res: { requests: V5.Request[] };
  };
  getLocalRequest: {
    req: { requestUid: string };
    res: { success: boolean; request?: V5.Request };
  };
  getLocalRequestCollections: {
    req: Record<string, never>;
    res: { collections: V5.Collection[] };
  };
  getLocalRequestCollectionTrees: {
    req: Record<string, never>;
    res: { collectionTrees: V5.CollectionTree[] };
  };
  getLocalRequestFolders: {
    req: Record<string, never>;
    res: { folders: FolderDescriptor[] };
  };
  createLocalRequest: {
    req: {
      name: string;
      collectionUid?: string;
      parentPath?: string;
      seed?: Partial<V5.Request>;
    };
    res: { success: boolean; request?: V5.Request };
  };
  updateLocalRequest: {
    req: {
      requestUid: string;
      updates: Partial<Omit<V5.Request, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
      /** Phase 10 stale-draft contract — see `updateLocalRule`. */
      expectedVersion?: number;
    };
    res:
      | { ok: true; version: number; request: V5.Request }
      | { ok: false; reason: 'stale-draft'; serverVersion: number; serverRequest: V5.Request }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteLocalRequest: {
    req: { requestUid: string };
    res: { success: boolean };
  };
  createLocalRequestCollection: {
    req: { name: string };
    res: { success: boolean; collection?: V5.Collection };
  };
  renameLocalRequestCollection: {
    req: { collectionUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalRequestCollection: {
    req: { collectionUid: string };
    res: { success: boolean };
  };
  createLocalRequestFolder: {
    req: { name: string; parentPath: string };
    res: { success: boolean; folder?: FolderDescriptor };
  };
  renameLocalRequestFolder: {
    req: { folderUid: string; name: string };
    res: { success: boolean };
  };
  deleteLocalRequestFolder: {
    req: { folderUid: string };
    res: { success: boolean };
  };
  /**
   * Execute a persisted request or a draft. `requestUid` takes
   * precedence when both are provided; `draft` is for unsaved editor
   * state that the user wants to Send without persisting first.
   */
  executeRequest: {
    req: {
      requestUid?: string;
      draft?: V5.Request;
      environmentId?: string;
    };
    res: { success: boolean; snapshot?: ExecutedRequestSnapshot; error?: string };
  };

  // ── Delay page ─────────────────────────────────────────────────
  'oh-delay-bypass': {
    req: { target: string };
    res: { ok: boolean };
  };

  // ── Recording ──────────────────────────────────────────────────
  //
  // Every recording-flow message goes through this bridge. Uses
  // uppercase names to preserve the established handler discriminator
  // (the background's message-handler switches on `message.type`).

  START_RECORDING: {
    req: { tabId: number; useWidget?: boolean };
    res: { success: boolean; recordId?: string; isPreNav?: boolean; error?: string };
  };
  START_PRE_NAV_RECORDING: {
    req: { tabId: number; recordId?: string; targetUrl?: string | null; useWidget?: boolean };
    res: { success: boolean; recordId?: string; error?: string };
  };
  STOP_RECORDING: {
    req: { tabId: number };
    res: { success: boolean; recording?: RecordingData | null; error?: string };
  };
  STOP_RECORDING_FROM_WIDGET: {
    req: Record<string, never>;
    res: { success: boolean; recording?: RecordingData | null; error?: string };
  };
  CANCEL_RECORDING: {
    req: { tabId?: number };
    res: { success: boolean; error?: string };
  };
  GET_RECORDING_STATE: {
    req: { tabId?: number };
    res: RecordingStateInfo & { isRecording: boolean; recordId?: string };
  };
  GET_TAB_RECORDING_STATE: {
    req: { tabId?: number; fromContentScript?: boolean };
    res: (RecordingStateInfo & { isRecording: boolean; recordId?: string }) | { isRecording: false };
  };
  CONTENT_SCRIPT_READY: {
    req: { payload: { url: string } };
    res: { shouldStartRecording?: boolean; state?: RecordingStateInfo; [key: string]: unknown };
  };
  QUERY_RECORDING_STATE: {
    req: { payload: { tabId?: number } };
    res: RecordingStateInfo | { success: false; error: string };
  };
  RECORDING_DATA: {
    req: { payload: { timestamp: number; type: string; url: string; data?: Record<string, unknown> } };
    res: { success: boolean; error?: string };
  };
  DOWNLOAD_WORKFLOW: {
    req: { url: string; filename: string };
    res: { success: boolean };
  };
  SEND_WORKFLOW_TO_APP: {
    req: { recording: WorkflowRecordingPayload };
    res: { success: boolean; error?: string | null };
  };
  GET_ALL_COOKIES: {
    req: { tabId?: number };
    res: { success: boolean; cookies?: chrome.cookies.Cookie[]; error?: string };
  };
  RESTORE_BADGE_STATE: {
    req: { tabId: number };
    res: { success: boolean; needsBadgeUpdate?: boolean };
  };

  // ── View-mode ────────────────────────────────────────────────
  // Sidepanel → popup transition runs in the SW because the popup
  // auto-closes on any focus change. If we open the popup first and
  // close the sidepanel after, Chrome's focus restore at the end of
  // the sidepanel close animation blurs the popup. Sequencing in the
  // SW (close sidepanel, await, then openPopup) avoids the race.
  sidepanelToPopup: {
    req: { windowId?: number; tabId?: number };
    res: { success: boolean; opened: boolean; error?: string };
  };

  // ── Observability log ────────────────────────────────────────────
  getObservabilityLog: {
    req: Record<string, never>;
    res: { entries: ObservabilityLogEntry[] };
  };
  clearObservabilityLog: {
    req: Record<string, never>;
    res: { success: boolean };
  };

  // ── Import reports (per-workspace ring, ARCHITECTURE §23) ────────
  /** Record an import report. Dedupes by `sourceHash` (non-empty
   *  replaces prior entry; empty string appends as a distinct event). */
  recordImportReport: {
    req: { report: ImportReport };
    res: { success: boolean; error?: string };
  };
  /** Read the full ring — oldest first. Callers typically reverse()
   *  for most-recent-first display. */
  listImportReports: {
    req: Record<string, never>;
    res: { reports: ImportReport[] };
  };
  /** Drop every report for the active workspace. */
  clearImportReports: {
    req: Record<string, never>;
    res: { success: boolean; error?: string };
  };
  /**
   * Look up a prior import report by `sourceHash` for the active
   * workspace. Returns `null` when no match exists — the UI uses
   * this to decide whether to render the re-import-diff panel
   * (ARCHITECTURE §23). Empty-hash inputs always return null since
   * those aren't considered identifying.
   */
  findImportReportBySourceHash: {
    req: { sourceHash: string };
    res: { report: ImportReport | null };
  };

  // ── Files (Phase 12 — ARCHITECTURE §6 content-addressed blobs) ────
  /**
   * List every file blob in the active workspace. Metadata only
   * (FileRef = fileId + hash + filename + mimeType + size); bytes are
   * fetched separately via `getFile` when the user previews or when
   * the executor builds a multipart body.
   */
  listFiles: {
    req: Record<string, never>;
    res: { files: FileRef[] };
  };
  /**
   * Upload a blob. `chrome.runtime.sendMessage` JSON-serializes its
   * payload (ArrayBuffer becomes `{}` on the wire), so we ship the
   * bytes as a base64 string and decode them on the SW side. The SW
   * reconstitutes a Blob and writes to IDB. Every upload produces a
   * fresh `fileId` — two uploads of the same bytes are two entries.
   */
  putFile: {
    req: { filename: string; mimeType?: string; bytesBase64: string };
    res: { success: boolean; fileRef?: FileRef; error?: string };
  };
  /**
   * Return the raw bytes for a file by `fileId`. Matches `putFile`'s
   * base64 transport — the SW encodes the blob bytes before responding,
   * the caller decodes to ArrayBuffer / Blob as needed. Returns
   * `found: false` when the fileId isn't stored in this workspace.
   */
  getFile: {
    req: { fileId: string };
    res: { found: boolean; bytesBase64?: string; mimeType?: string };
  };
  /**
   * Delete a file by `fileId`. Callers should check upstream
   * references (request multipart parts) before firing; the SW does
   * not cascade.
   */
  deleteFile: {
    req: { fileId: string };
    res: { success: boolean; removed: boolean; error?: string };
  };

  // ── OAuth 2.0 / OIDC (Phase 13 — ARCHITECTURE §18) ───────────────
  /**
   * List every stored OAuth token bundle for the active workspace.
   * Keyed by `credentialRef`. Used by the AuthEditor to show
   * "Connected" badges and by the upcoming OAuth management pane in
   * Settings → Data.
   *
   * Access tokens are returned verbatim — any surface that displays
   * them to the user should mask them. Consumers that only need
   * expiry metadata should treat `accessToken` as opaque.
   */
  listOAuthTokens: {
    req: Record<string, never>;
    res: { tokens: Record<string, OAuth2TokenBundle> };
  };
  /**
   * Run the full Authorization Code + PKCE flow for the given OAuth
   * config. On success the token bundle is persisted and the returned
   * bundle reflects the fresh state; on failure a descriptive message
   * surfaces so the UI can toast the user (expired provider cert,
   * misconfigured redirect, user cancelled, etc.).
   */
  oauthAuthorize: {
    req: { config: V5.OAuth2Auth };
    res: { success: boolean; bundle?: OAuth2TokenBundle; redirectUri?: string; error?: string };
  };
  /**
   * Trigger a client-credentials token fetch for the given config.
   * Used by machine-to-machine auth configurations where no user
   * interaction is required.
   */
  oauthClientCredentials: {
    req: { config: V5.OAuth2Auth };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /**
   * Force a refresh of the stored token for the given config. Useful
   * when the user wants to proactively rotate the access token or
   * diagnose refresh failures from the editor.
   */
  oauthRefresh: {
    req: { config: V5.OAuth2Auth };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /** Delete the stored token bundle for `credentialRef`. "Disconnect" flow. */
  oauthRevoke: {
    req: { credentialRef: string };
    res: { success: boolean; removed: boolean };
  };
  /**
   * Canonical redirect URI for this extension build. Shown in the
   * AuthEditor so users paste the right value into the provider's
   * allow-list. Stable across builds once the extension `key` is
   * pinned (Phase 1). The SW is the authoritative source — different
   * surfaces (popup / workspace) both read from here rather than
   * recomputing against `chrome.identity.getRedirectURL()` locally.
   */
  oauthGetRedirectUri: {
    req: Record<string, never>;
    res: { redirectUri: string };
  };

  // ── Live Variables + Workflows (Phase B — docs/LIVE_VARIABLES_PLAN.md) ──
  /**
   * List every Live Workflow definition for the active workspace.
   * Workflows own the step list + refresh schedule; `{{live.X}}`
   * namespace bindings live on `listLiveVariables`.
   */
  listLiveWorkflows: {
    req: Record<string, never>;
    res: { workflows: V5.LiveWorkflow[] };
  };
  getLiveWorkflow: {
    req: { uid: string };
    res: { workflow: V5.LiveWorkflow | null };
  };
  createLiveWorkflow: {
    req: {
      name: string;
      description?: string;
      steps?: V5.WorkflowStep[];
      refresh?: V5.RefreshPolicy;
      enabled?: boolean;
    };
    res: { success: boolean; workflow?: V5.LiveWorkflow; error?: string };
  };
  /**
   * Update a workflow. Returns the Phase 10 write result so editors
   * can surface `stale-draft` on concurrent-edit races. Callers that
   * don't track `expectedVersion` opt into last-write-wins.
   */
  updateLiveWorkflow: {
    req: {
      uid: string;
      updates: Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
      expectedVersion?: number;
    };
    res:
      | { success: true; workflow: V5.LiveWorkflow; version: number }
      | { success: false; reason: 'stale-draft'; serverVersion: number; serverWorkflow: V5.LiveWorkflow }
      | { success: false; reason: 'not-found' };
  };
  deleteLiveWorkflow: {
    req: { uid: string };
    res: { success: boolean };
  };

  listLiveVariables: {
    req: Record<string, never>;
    res: { variables: V5.LiveVariable[] };
  };
  getLiveVariable: {
    req: { uid: string };
    res: { variable: V5.LiveVariable | null };
  };
  createLiveVariable: {
    req: {
      name: string;
      workflowUid: string;
      stepId: string;
      captureName: string;
      description?: string;
      requireFreshOnRuleBuild?: boolean;
      enabled?: boolean;
    };
    res: { success: boolean; variable?: V5.LiveVariable; error?: string };
  };
  updateLiveVariable: {
    req: {
      uid: string;
      updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion' | 'version'>>;
      expectedVersion?: number;
    };
    res:
      | { success: true; variable: V5.LiveVariable; version: number }
      | { success: false; reason: 'stale-draft'; serverVersion: number; serverVariable: V5.LiveVariable }
      | { success: false; reason: 'not-found' };
  };
  deleteLiveVariable: {
    req: { uid: string };
    res: { success: boolean };
  };
  /**
   * Pin an LV to a fixed value (debug override) or clear an existing
   * override. Pass `null` to clear. Same stale-draft semantics as
   * `updateLiveVariable`.
   */
  setLiveVariableOverride: {
    req: { uid: string; override: V5.LiveVariableOverride | null; expectedVersion?: number };
    res:
      | { success: true; variable: V5.LiveVariable; version: number }
      | { success: false; reason: 'stale-draft'; serverVersion: number; serverVariable: V5.LiveVariable }
      | { success: false; reason: 'not-found' };
  };
  /**
   * Every cached run for a workflow — one entry per active environment
   * that has ever produced a cache. Callers use this to render the
   * countdown + last-error state in the LV editor.
   */
  getLiveCacheForWorkflow: {
    req: { workflowUid: string };
    res: { runs: LiveWorkflowRunSnapshot[] };
  };
  /**
   * Manual "refresh now" from the UI. Phase B ships a stub that
   * returns a `scheduler-not-ready` error — Phase C wires it to the
   * chain runner. Signature is stable across both phases so UI can
   * plumb it today.
   */
  refreshLiveWorkflowNow: {
    req: { workflowUid: string; environmentId?: string | null };
    res: { success: true; run: LiveWorkflowRunSnapshot } | { success: false; error: string };
  };

  /**
   * "Reset circuit" — clears consecutiveFailures / consecutiveOpenings
   * / nextAttemptAt on the target cache row so the next scheduled or
   * manual refresh starts from a CLOSED circuit. Does not run a probe;
   * the user can click Refresh next. Surfaced on the Workflow Status
   * sidebar per-row action menu.
   */
  resetLiveWorkflowCircuit: {
    req: { workflowUid: string; environmentId?: string | null };
    res: { success: true } | { success: false; error: string };
  };

  // ── Status snapshot ──────────────────────────────────────────────
  getStatusSnapshot: {
    req: Record<string, never>;
    res: { snapshot: StatusSnapshot };
  };

  // ── Layout (panel ratios + tool-window dock state) ───────────────
  /**
   * Persist the active workspace's panel-layout record. Routed
   * through the SW so the write is serialized through the
   * `layoutLockName(ws)` Web Lock — two tabs dragging different
   * panes concurrently can't stomp each other. The layout blob is
   * opaque at the SW boundary; the renderer owns its shape.
   */
  setLayout: {
    req: { layout: PersistedPanelLayout };
    res: { success: boolean; error?: string };
  };
}

/**
 * Tab-directed contract: map of message-type → { req, res } for messages
 * sent from the background or popup DIRECTLY to a content script via
 * `tabs.sendMessage`. Handled by a `receive(type, handler)` subscription
 * inside the content script. Chrome routes these based on destination
 * (tab id), not the background's runtime.onMessage router — so tab types
 * live in a separate namespace to keep the RPC contract narrow.
 */
export interface BridgeTabContract {
  recordingStateChanged: {
    req: {
      state: string;
      isRecording: boolean;
      isPreNav: boolean;
      recordingId?: string;
      startTime?: number;
    };
    res: { success: boolean };
  };
  stopRecording: {
    req: Record<string, never>;
    res: { success: boolean };
  };
}

/**
 * Broadcast contract: map of message-type → payload shape (without `type`).
 *
 * Consumers subscribe via `bridge.subscribe(type, handler)`. The SW broadcasts
 * via `bridge.broadcast(type, payload)` — fire-and-forget; "no listeners"
 * is not an error.
 */
export interface BridgeBroadcastContract {
  rulesUpdated: { rules: V5.Rule[]; timestamp?: number };
  templatesUpdated: { templates: V5.Template[] };
  requestsUpdated: { requests: V5.Request[] };
  testRunFinished: { ownerType: TestRunOwnerType; ownerId: string; runId: string };
  testRunDeleted: { runId: string };
  testRunsClearedForOwner: { ownerType: TestRunOwnerType; ownerId: string };
  connectionStatus: { connected: boolean };
  trackedUrlsUpdated: { tabId?: number };
  /**
   * Fires on any workspace list mutation (create/rename/delete/reorder)
   * AND on active-workspace switch. UI surfaces re-read rules, templates,
   * environments, and pause markers on this event — one atomic refetch
   * instead of four separate broadcasts.
   */
  workspaceChanged: WorkspaceSnapshot;
  /**
   * Fires on any environment / workspace-variables / vault / active-env
   * mutation in the active workspace. Carries the full 4-scope snapshot
   * so `useEnvironments` stays in lockstep without per-field broadcasts.
   */
  environmentsChanged: EnvironmentsSnapshot;
  /**
   * Fires whenever the observability log records or clears entries.
   * Payload carries the current size only — full entry reads happen
   * via the `getObservabilityLog` RPC so we don't push the buffer
   * on every record.
   */
  observabilityLogUpdated: { size: number };
  /**
   * Fires on every Status snapshot change — a subsystem reported a new
   * state, or the snapshot was cleared. Payload is the full snapshot so
   * listeners don't have to re-query after each event.
   */
  statusUpdated: StatusSnapshot;

  /**
   * Workspace Intent — warm-path delivery from the SW navigator to an
   * already-open workspace tab. Declared on the broadcast contract
   * because `bridge.subscribe` is the renderer's shared subscription
   * primitive; the SW dispatcher actually routes via `tabs.sendMessage`
   * to a specific tab, but the listener shape is identical (both land
   * in `chrome.runtime.onMessage`).
   *
   * Intent is schema-validated at the navigator + again at the
   * renderer's router so malformed payloads can never propagate
   * past the boundary. See Phase 9.
   */
  'workspace-intent': { intent: WorkspaceIntent };

  /**
   * Fired by the SW's `workspace-tab-registry` whenever a workspace
   * tab is assigned, freed, or swapped (tab-discard restore). Every
   * open workspace surface uses this to recompose `document.title`
   * via the `useWorkspaceTabTitle` hook.
   *
   * `ordinals` is a plain object keyed by numeric tab id so the wire
   * shape is JSON-safe; renderers look up their own ordinal by the
   * tab-id they learned from `getWorkspaceTabOrdinal` at mount.
   */
  workspaceTabsChanged: { ordinals: Record<number, number>; count: number };

  /**
   * Fires on every active-workspace file-blob mutation (put / delete /
   * bulk purge). Carries the current `FileRef[]` snapshot so
   * consumers never render stale lists after a sibling tab uploads,
   * and so the multipart body editor's file picker stays live.
   *
   * Bytes are NOT included — hooks fetch them on demand via `getFile`.
   */
  filesChanged: { files: FileRef[] };

  /**
   * Fires on every OAuth token-store mutation (authorize / refresh /
   * revoke / purge). Carries the full map keyed by credentialRef so
   * consumers (AuthEditor's "Connected" badge, OAuth management UI)
   * stay in lockstep without per-credential subscriptions.
   */
  oauthTokensChanged: { tokens: Record<string, OAuth2TokenBundle> };

  /**
   * Fires on every Live Workflow definition mutation. Carries the full
   * workflow list so consumers (sidebar, editor, rule-editor picker)
   * stay in sync without per-workflow subscriptions.
   */
  liveWorkflowsChanged: { workflows: V5.LiveWorkflow[] };

  /**
   * Fires on every Live Variable definition mutation. Carries the full
   * LV list so the sidebar + variable picker + resolver update
   * together.
   */
  liveVariablesChanged: { variables: V5.LiveVariable[] };

  /**
   * Fires on every live-cache mutation (successful refresh, recorded
   * error, clear, purge). `workflowUid === null` signals a bulk
   * mutation (workspace purge). Consumers that care about a specific
   * workflow's countdown filter on the uid; broader consumers (Status
   * pill, observability) refetch on every event.
   */
  liveCacheChanged: { workflowUid: string | null };
}

// ── Variables / Environments ─────────────────────────────────────

/**
 * Snapshot of every variable-scoped state the UI cares about. Emitted
 * as one atomic broadcast so consumers never see a half-applied switch
 * (new active env but old var list, etc.).
 *
 * `activeEnvironmentId` is nullable — "No environment" is a valid state
 * (Postman semantics); resolution still works via lower scopes.
 */
export interface EnvironmentsSnapshot {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  /**
   * Workspace default env uid (used as the resolver fallback when the
   * active env misses a variable, or when there's no active env).
   * `null` means no default is configured.
   */
  defaultEnvironmentId: string | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  collectionEnvOverrides: Record<string, string | null>;
}

export type BridgeRpcType = keyof BridgeRpcContract;
export type BridgeRpcRequest<K extends BridgeRpcType> = BridgeRpcContract[K]['req'];
export type BridgeRpcResponse<K extends BridgeRpcType> = BridgeRpcContract[K]['res'];

export type BridgeTabType = keyof BridgeTabContract;
export type BridgeTabRequest<K extends BridgeTabType> = BridgeTabContract[K]['req'];
export type BridgeTabResponse<K extends BridgeTabType> = BridgeTabContract[K]['res'];

export type BridgeBroadcastType = keyof BridgeBroadcastContract;
export type BridgeBroadcastPayload<K extends BridgeBroadcastType> = BridgeBroadcastContract[K];

/** Union of every typed message name the bridge can carry. */
export type BridgeMessageType = BridgeRpcType | BridgeTabType;

/**
 * Error thrown by `bridge.call` / `bridge.tabCall` when the underlying
 * chrome messaging API surfaces a `lastError` (e.g. SW crashed, no
 * handler registered, context invalidated, receiving end does not
 * exist). Carries the original message type so callers can react
 * differently by message without string-matching.
 */
export class BridgeError extends Error {
  readonly type: BridgeMessageType;

  constructor(type: BridgeMessageType, reason: string) {
    super(`bridge(${type}) failed: ${reason}`);
    this.name = 'BridgeError';
    this.type = type;
  }
}
