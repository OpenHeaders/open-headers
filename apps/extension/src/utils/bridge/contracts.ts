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

import type { AppNavigationIntent } from '@openheaders/core';
import type { FileRef } from '@openheaders/core/files';
import type { ImportReport } from '@openheaders/core/import';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type {
  AwarenessPublishRequest,
  AwarenessPublishResponse,
  AwarenessState,
  SyncApplyRequest,
  SyncApplyResponse,
  SyncCollectionPostState,
  SyncEnvironmentPostState,
  SyncExtensionWorkspacePostState,
  SyncFilesPostState,
  SyncFolderPostState,
  SyncLayoutStatePostState,
  SyncLiveVariablePostState,
  SyncLiveWorkflowPostState,
  SyncOAuthBundlePostState,
  SyncPauseMarkersPostState,
  SyncRequestCollectionPostState,
  SyncRequestFolderPostState,
  SyncRequestPostState,
  SyncRulePostState,
  SyncTemplateCollectionPostState,
  SyncTemplateFolderPostState,
  SyncTemplatePostState,
  SyncVaultPostState,
  SyncWorkspaceVariablesPostState,
} from '@openheaders/core/protocol';
import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import type { IntentCallerContext, WorkspaceIntent } from '@openheaders/core/workspace-intent';
import type { WorkflowRunCache } from '@/background/modules/live-cache-store';
import type { ExecutedRequestSnapshot } from '@/background/modules/request-executor';
import type { TabTelemetrySnapshot } from '@/background/modules/tab-telemetry';
import type { LoadedTestRun, TestRunOwnerType } from '@/background/modules/test-run-store';
import type { LogEntry as ObservabilityLogEntry } from '@/shared/observability/types';
import type { StatusSnapshot } from '@/shared/status/types';
import type { ActiveRule } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';

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
  duplicateWorkspace: {
    req: { id: string; name?: string };
    res: { success: boolean; workspace?: V5.ExtensionWorkspace; error?: string };
  };
  exportWorkspace: {
    req: {
      /** Falls back to the active workspace when omitted. */
      workspaceId?: string;
      scope:
        | { kind: 'workspace' }
        | {
            kind: 'selection';
            selection: import('@/background/modules/workspace-export-gatherer').ExportSelection;
            /**
             * Strict-literal export (design §5.5 Advanced override).
             * When `true`, the gatherer ships exactly the picked uids
             * with no descendant/parent expansion.
             */
            strictLiteral?: boolean;
          };
      /**
       * Vault include mode (design §3.1 / §3.2 / §3.3).
       *
       * Encrypted exports are computed entirely SW-side: the renderer
       * passes the user's passphrase, the SW derives the key, encrypts,
       * zeroes the in-memory passphrase reference, and returns the
       * fingerprints alongside the YAML. The passphrase never lands in
       * persisted state.
       */
      vaultMode?: 'omitted' | 'encrypted' | 'plaintext';
      passphrase?: string;
      passphraseHint?: string;
      /** Drives the deep-link plaintext refusal in `buildWorkspaceExport`. */
      destination?: 'file' | 'clipboard' | 'deep-link';
    };
    res: {
      success: boolean;
      yaml?: string;
      exportId?: string;
      scope?: 'workspace' | 'collection' | 'selection';
      /** Present when `vaultMode === 'encrypted'`. Sender shows these to
       *  the recipient out-of-band ("does yours say `7f:a3:c1`?"). */
      ciphertextFingerprint?: string;
      keyFingerprint?: string;
      error?: string;
    };
  };
  /**
   * Apply a parsed `WorkspaceExport` to a target workspace. SW reads
   * the target's current state under a workspace-import lock, runs the
   * collision diff fresh (handles concurrent edits during preview),
   * resolves the user's per-entity strategies into an ImportPlan, and
   * drives `chrome.storage` writes. Returns the persisted
   * `WorkspaceExportImportReport`.
   */
  importWorkspace: {
    req: {
      /** The validated export envelope (already parsed via `parseWorkspaceExport`). */
      incoming: import('@openheaders/core/workspace-export').WorkspaceExport;
      /** User's per-entity strategy choices from the preview modal. */
      strategies: import('@openheaders/core/workspace-export').StrategyMap;
      /** Backup-restore toggle ("this is mine — prefer update-by-uid"). */
      backupRestore?: boolean;
      /** Advanced override — when true, preserves source enabled flags. */
      trustExport?: boolean;
      /** Advanced override — when true, strips request scripts on import. */
      stripScripts?: boolean;
      /** Advanced override — when true, replaces oauth2 Request.auth with
       *  `{ type: 'none' }` on every imported request. */
      omitOAuthConfigs?: boolean;
      /** Advanced override — when true, `update` collisions on
       *  collections preserve the target's `order` field. */
      keepTargetCollectionOrder?: boolean;
      /** Advanced override — when true and target=new, refuse to
       *  create when an existing workspace carries the export's
       *  `workspace.uid`. */
      refuseUidCollision?: boolean;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      /** SHA-256 of the original raw bytes (`sha256:<hex>`). */
      sourceHash: string;
    };
    res: {
      success: boolean;
      report?: import('@openheaders/core/import').WorkspaceExportImportReport;
      targetWorkspaceId?: string;
      error?: string;
    };
  };
  /**
   * Preview-time analog of `importWorkspace`. Reads (no writes) the
   * chosen target workspace and runs the collision diff +
   * missing-deps walk. The renderer drives the preview modal off
   * this; on submit it calls `importWorkspace`, which re-runs the
   * diff under the workspace-import lock for authoritative state.
   * `snapshotHash` lets the renderer detect concurrent edits between
   * preview-open and submit.
   */
  previewWorkspaceImport: {
    req: {
      incoming: import('@openheaders/core/workspace-export').WorkspaceExport;
      target: { mode: 'current' } | { mode: 'new'; name?: string } | { mode: 'picked'; workspaceId: string };
      backupRestore?: boolean;
    };
    res: {
      success: boolean;
      diff?: import('@openheaders/core/workspace-export').DiffResult;
      missingDeps?: import('@openheaders/core/workspace-export').MissingDep[];
      snapshotHash?: string;
      targetWorkspaceId?: string | null;
      error?: string;
    };
  };
  /**
   * Read the per-entity YAML snapshots written by the most recent
   * `importWorkspace` call for `workspaceId`. Keys are entity uids
   * (plus `__singleton.workspaceVars__` / `__singleton.vault__` for
   * the two singletons); values are the canonical YAML form of each
   * entity AS IT WAS IMPORTED.
   *
   * Drives the merge editor's 3-pane ancestor on re-imports
   * (`MERGE_CONFLICT_EDITOR_PLAN.md` §7): collisions on a uid present
   * here merge against the snapshot as the common base; collisions on
   * a uid not present here fall back to 2-pane.
   *
   * Empty record when the workspace has never been imported into.
   */
  getLastImportedSnapshots: {
    req: { workspaceId: string };
    res: { snapshots: Record<string, string> };
  };
  /**
   * Walk every workspace's `importReports` ring for prior imports
   * matching the incoming export's `exportId` or source-workspace
   * uid. Drives the soft-dedup banner in the preview modal
   * (design §5.2 precedence — exportId beats workspace.uid; same-
   * target beats different-target).
   */
  findWorkspaceExportImportMatches: {
    req: { exportId: string; workspaceUid: string; currentTargetWorkspaceId: string | null };
    res: import('@/background/modules/workspace-import-dedup').DedupMatchesResult;
  };
  /**
   * Stage a YAML payload in the SW's handoff registry (5min TTL).
   * Caller embeds the returned `handoffId` in a workspace-intent
   * `{kind: 'open-import', handoffId, source: {via: …}}` and dispatches
   * via `openWorkspaceIntent`. Used when the YAML is too large for an
   * inline deep link or the caller (popup, playground) doesn't have
   * a URL bar to drop the link into.
   */
  registerImportHandoff: {
    req: { yaml: string };
    res: { success: boolean; handoffId?: string; error?: string };
  };
  /**
   * Drain a previously-staged handoff. Single-use — re-consuming an
   * id returns `null`. Returns `null` for unknown/expired ids; the
   * renderer surfaces this as "the link expired, ask the sender to
   * resend" rather than as a hard failure.
   */
  consumeImportHandoff: {
    req: { handoffId: string };
    res: { yaml: string | null };
  };
  /**
   * Fetch a workspace-export YAML/JSON from an https:// URL. SW
   * enforces the host allowlist + 1 MB streaming cap + manual redirect
   * validation; the renderer's role is purely to pass the URL and
   * surface the discriminated outcome in the preview-modal error
   * gutter (design §5.1).
   */
  fetchWorkspaceExportYaml: {
    req: { url: string };
    res:
      | { ok: true; yaml: string; finalUrl: string }
      | {
          ok: false;
          reason:
            | 'invalid-url'
            | 'not-https'
            | 'host-not-allowlisted'
            | 'too-many-redirects'
            | 'redirect-host-not-allowlisted'
            | 'body-too-large'
            | 'http-error'
            | 'network-error';
          message: string;
        };
  };
  /**
   * Read the active workspace's set of imported request uids that
   * carry `preRequestScript` / `postResponseScript` and haven't been
   * opened in the inspector since import. The sidebar surfaces these
   * as a "scripts" badge per design §5.5; opening the inspector calls
   * `clearRequestScriptsReviewPending` to drop the uid.
   */
  getRequestScriptsReviewPending: {
    req: Record<string, never>;
    res: { uids: string[] };
  };
  /**
   * Drop a uid from the pending-scripts-review set (active workspace).
   * Called when the user opens the request in the inspector — the
   * badge clears as soon as the script is visible to the eye.
   */
  clearRequestScriptsReviewPending: {
    req: { uid: string };
    res: { success: boolean };
  };
  /** Read the resolved allowlist (parsed from `oh.settings.user`,
   *  falling back to defaults when unset). The Settings UI stores the
   *  raw comma-separated string; this RPC returns the parsed list for
   *  diagnostics surfaces. */
  getAllowedFetchHosts: {
    req: Record<string, never>;
    res: { hosts: string[] };
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

  // ── Rule CRUD (local + desktop-routed) ─────────────────────────
  deleteRule: {
    req: { ruleId: string };
    res: { success: boolean; error?: string };
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
      updates: Partial<Omit<V5.Template, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { ok: true; template: V5.Template }
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
      manualEnvId: string | null;
    };
  };
  createEnvironment: {
    req: { name: string; variables?: V5.Variable[] };
    res: { success: boolean; environment?: V5.Environment };
  };
  renameEnvironment: {
    req: { uid: string; name: string };
    res:
      | { ok: true; environment: V5.Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  updateEnvironmentVariables: {
    req: { uid: string; variables: V5.Variable[] };
    res:
      | { ok: true; environment: V5.Environment }
      | { ok: false; reason: 'not-found' }
      | { ok: false; reason: 'other'; message: string };
  };
  deleteEnvironment: {
    req: { uid: string };
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
  getVault: {
    req: Record<string, never>;
    res: { vault: V5.Vault };
  };
  updateCollectionVariables: {
    req: {
      collectionUid: string;
      variables: V5.Variable[];
    };
    res:
      | { ok: true; collection: V5.Collection }
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
    };
    res:
      | { ok: true; request: V5.Request }
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
    req: { workspaceId?: string };
    res: { files: FileRef[] };
  };
  /**
   * Upload a blob. `chrome.runtime.sendMessage` JSON-serializes its
   * payload (ArrayBuffer becomes `{}` on the wire), so we ship the
   * bytes as a base64 string and decode them on the SW side. The SW
   * reconstitutes a Blob and writes to IDB. Every upload produces a
   * fresh `fileId` — two uploads of the same bytes are two entries.
   *
   * Optional `workspaceId` overrides the SW's runtime-Active workspace
   * (workbench tabs in per-window-or-tab mode pass their editing-scope
   * workspaceId so bytes + catalog mutation land on the correct
   * workspace). Omitted = falls back to the SW's runtime-Active.
   */
  putFile: {
    req: { filename: string; mimeType?: string; bytesBase64: string; workspaceId?: string };
    res: { success: boolean; fileRef?: FileRef; error?: string };
  };
  /**
   * Return the raw bytes for a file by `fileId`. Matches `putFile`'s
   * base64 transport — the SW encodes the blob bytes before responding,
   * the caller decodes to ArrayBuffer / Blob as needed. Returns
   * `found: false` when the fileId isn't stored in this workspace.
   */
  getFile: {
    req: { fileId: string; workspaceId?: string };
    res: { found: boolean; bytesBase64?: string; mimeType?: string };
  };
  /**
   * Delete a file by `fileId`. Callers should check upstream
   * references (request multipart parts) before firing; the SW does
   * not cascade.
   */
  deleteFile: {
    req: { fileId: string; workspaceId?: string };
    res: { success: boolean; removed: boolean; error?: string };
  };
  /**
   * Rename a file's metadata in place. Two-step write at the SW:
   * `BlobStore.renameBlob` updates the durable byte record, then a
   * `renameFileRef` envelope flows through the oracle so other surfaces
   * converge under per-(setPath, itemId) LWW. Bytes + hash are
   * preserved — only the `filename` (and optional `mimeType`) change.
   * Returns the updated `FileRef` shell on success, or `found: false`
   * when the fileId isn't present in this workspace.
   */
  renameFile: {
    req: { fileId: string; filename: string; mimeType?: string; workspaceId?: string };
    res: { success: boolean; found: boolean; fileRef?: FileRef; error?: string };
  };

  // ── OAuth 2.0 / OIDC (Phase 13 — ARCHITECTURE §18) ───────────────
  // Reads: renderer subscribes `wsKeys(workspaceId).oauth` directly (singleton-with-storage-key,
  // matches Vault / PauseMarkers). The legacy `listOAuthTokens` RPC + `oauthTokensChanged`
  // broadcast were deleted in Session 17 (MWPT-FULL § 8.3.10) — chrome.storage.local.onChanged
  // is per-workspace correct by construction.
  //
  // Writes: catalog-only revoke goes renderer-direct via `applyOAuthRevoke` (Phase B).
  // Browser-mediated flows (authorize / clientCredentials / refresh) stay on bridge RPCs
  // because they need SW-resident chrome.identity / fetch. Each carries `workspaceId?: string`
  // so the editing-scope workspace surfaces through to `putTokenBundle` (MWPT-FULL § 4.3).
  /**
   * Run the full Authorization Code + PKCE flow for the given OAuth
   * config. On success the token bundle is persisted and the returned
   * bundle reflects the fresh state; on failure a descriptive message
   * surfaces so the UI can toast the user (expired provider cert,
   * misconfigured redirect, user cancelled, etc.).
   */
  oauthAuthorize: {
    req: { config: V5.OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; redirectUri?: string; error?: string };
  };
  /**
   * Trigger a client-credentials token fetch for the given config.
   * Used by machine-to-machine auth configurations where no user
   * interaction is required.
   */
  oauthClientCredentials: {
    req: { config: V5.OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /**
   * Force a refresh of the stored token for the given config. Useful
   * when the user wants to proactively rotate the access token or
   * diagnose refresh failures from the editor.
   */
  oauthRefresh: {
    req: { config: V5.OAuth2Auth; workspaceId?: string };
    res: { success: boolean; bundle?: OAuth2TokenBundle; error?: string };
  };
  /** Delete the stored token bundle for `credentialRef`. "Disconnect" flow. */
  oauthRevoke: {
    req: { credentialRef: string; workspaceId?: string };
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
  updateLiveWorkflow: {
    req: {
      uid: string;
      updates: Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { success: true; workflow: V5.LiveWorkflow }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
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
      updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>>;
    };
    res:
      | { success: true; variable: V5.LiveVariable }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
  };
  deleteLiveVariable: {
    req: { uid: string };
    res: { success: boolean };
  };
  /**
   * Pin an LV to a fixed value (debug override) or clear an existing
   * override. Pass `null` to clear.
   */
  setLiveVariableOverride: {
    req: { uid: string; override: V5.LiveVariableOverride | null };
    res:
      | { success: true; variable: V5.LiveVariable }
      | { success: false; reason: 'not-found' }
      | { success: false; reason: 'other'; error: string };
  };
  /**
   * Every cached run for a workflow — one entry per active environment
   * that has ever produced a cache. Callers use this to render the
   * countdown + last-error state in the LV editor.
   */
  getLiveCacheForWorkflow: {
    req: { workflowUid: string; workspaceId?: string };
    res: { runs: LiveWorkflowRunSnapshot[] };
  };
  /**
   * Manual "refresh now" from the UI. Phase B ships a stub that
   * returns a `scheduler-not-ready` error — Phase C wires it to the
   * chain runner. Signature is stable across both phases so UI can
   * plumb it today.
   *
   * `workspaceId?` — workbench gestures from a diverged tab pass the
   * editing-scope id so the SW resolves the workflow + cache against
   * that workspace's projection (MWPT-FULL session #11). Omit ⇒
   * runtime-Active fallback (system surfaces, legacy callers).
   */
  refreshLiveWorkflowNow: {
    req: { workflowUid: string; environmentId?: string | null; workspaceId?: string };
    res: { success: true; run: LiveWorkflowRunSnapshot } | { success: false; error: string };
  };

  /**
   * "Reset circuit" — clears consecutiveFailures / consecutiveOpenings
   * / nextAttemptAt on the target cache row so the next scheduled or
   * manual refresh starts from a CLOSED circuit. Does not run a probe;
   * the user can click Refresh next. Surfaced on the Workflow Status
   * sidebar per-row action menu.
   *
   * `workspaceId?` — same threading contract as
   * {@link refreshLiveWorkflowNow}.
   */
  resetLiveWorkflowCircuit: {
    req: { workflowUid: string; environmentId?: string | null; workspaceId?: string };
    res: { success: true } | { success: false; error: string };
  };

  // ── Status snapshot ──────────────────────────────────────────────
  getStatusSnapshot: {
    req: Record<string, never>;
    res: { snapshot: StatusSnapshot };
  };

  // ── Sync engine (Phase A) ────────────────────────────────────────
  /**
   * Apply a `MutationBatch` against the local oracle all-or-nothing
   * under the per-entity Web Lock. Mirrors `SyncApplyRequest` from
   * `@openheaders/core/protocol` — the `type` field is added by the
   * bridge layer, so the `req` shape is the request minus `type`. The
   * response is the oracle's structured ack (success → per-envelope
   * outcomes; failure → the offending mutationId + reason).
   */
  'oh.sync.apply': {
    req: Omit<SyncApplyRequest, 'type'>;
    res: SyncApplyResponse;
  };
  /**
   * Snapshot the active workspace's full Rule oracle state for a
   * freshly-mounted renderer surface — `(rule, setItemIds)` per uid,
   * matching the broadcast `rulePostState` payload. The renderer-side
   * mirror calls this on construction so subsequent writes can
   * synchronously enumerate live itemIds without round-tripping per
   * envelope (§19.4). Subsequent broadcasts overwrite per-uid; the
   * snapshot is only authoritative for ids the SW hasn't broadcast
   * since the surface mounted.
   */
  'oh.sync.snapshotRules': {
    req: { workspaceId?: string };
    res: { entries: SyncRulePostState[] };
  };
  /**
   * Snapshot the active workspace's full Environment oracle state.
   * Same semantics as `oh.sync.snapshotRules` for the Environment
   * entity — `(environment, varUids)` per envId, matching the
   * broadcast `environmentPostState` payload. Renderer-side env
   * mirrors call this on construction.
   */
  'oh.sync.snapshotEnvironments': {
    req: { workspaceId?: string };
    res: { entries: SyncEnvironmentPostState[] };
  };
  /**
   * Snapshot the active workspace's full Collection oracle state.
   * Same semantics as `oh.sync.snapshotEnvironments` —
   * `(collection, varUids)` per uid, matching the broadcast
   * `collectionPostState` payload.
   */
  'oh.sync.snapshotCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton workspace-variables
   * oracle state. Same semantics as the other snapshot RPCs;
   * `entries` carries 0 or 1 element (singleton — present once seeded,
   * absent on a cold oracle prior to the first seed).
   */
  'oh.sync.snapshotWorkspaceVariables': {
    req: { workspaceId?: string };
    res: { entries: SyncWorkspaceVariablesPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton vault oracle state.
   * Same semantics as `oh.sync.snapshotWorkspaceVariables` — singleton
   * `entries` carries 0 or 1 element. Local-only by §12.3; the
   * payload never crosses any sync transport.
   */
  'oh.sync.snapshotVault': {
    req: { workspaceId?: string };
    res: { entries: SyncVaultPostState[] };
  };
  /**
   * Snapshot the active workspace's full Folder oracle state. Same
   * semantics as `oh.sync.snapshotCollections` — `(folder)` per uid,
   * matching the broadcast `folderPostState` payload. Folders whose
   * parent linkage isn't currently resolvable are skipped; they
   * republish on the next folder/parent broadcast that resolves the
   * chain.
   */
  'oh.sync.snapshotFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Request oracle state. Same
   * semantics as `oh.sync.snapshotRules` — `(request, setItemIds)` per
   * uid, matching the broadcast `requestPostState` payload.
   */
  'oh.sync.snapshotRequests': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestPostState[] };
  };
  /**
   * Snapshot the active workspace's full request-collection oracle
   * state. Mirror of `oh.sync.snapshotCollections` for the
   * request-collection entity type. Each entry carries the materialized
   * `{ collection, varUids, setOrderKeys }` triple.
   */
  'oh.sync.snapshotRequestCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's full request-folder oracle state.
   * Mirror of `oh.sync.snapshotFolders` for the request-folder entity
   * type. Folders whose parent linkage isn't currently resolvable are
   * skipped; they republish on the next folder/parent broadcast that
   * resolves the chain.
   */
  'oh.sync.snapshotRequestFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncRequestFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Template oracle state. Same
   * semantics as `oh.sync.snapshotRequests` — `(template, setItemIds)`
   * per uid, matching the broadcast `templatePostState` payload.
   */
  'oh.sync.snapshotTemplates': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplatePostState[] };
  };
  /**
   * Snapshot the active workspace's full template-collection oracle
   * state. Mirror of `oh.sync.snapshotRequestCollections` for the
   * template-collection entity type. Each entry carries the materialized
   * `{ collection, varUids, setOrderKeys }` triple.
   */
  'oh.sync.snapshotTemplateCollections': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplateCollectionPostState[] };
  };
  /**
   * Snapshot the active workspace's full template-folder oracle state.
   * Mirror of `oh.sync.snapshotRequestFolders` for the template-folder
   * entity type. Folders whose parent linkage isn't currently
   * resolvable are skipped.
   */
  'oh.sync.snapshotTemplateFolders': {
    req: { workspaceId?: string };
    res: { entries: SyncTemplateFolderPostState[] };
  };
  /**
   * Snapshot the active workspace's full Live-Variable oracle state.
   * Each entry carries `{ liveVariable }` — LV is fully flat-scalar so
   * no itemId map rides along.
   */
  'oh.sync.snapshotLiveVariables': {
    req: { workspaceId?: string };
    res: { entries: SyncLiveVariablePostState[] };
  };
  /**
   * Snapshot the active workspace's full Live-Workflow oracle state.
   * Each entry carries `{ workflow }` — `steps` is a whole-array scalar
   * so no itemId map rides along.
   */
  'oh.sync.snapshotLiveWorkflows': {
    req: { workspaceId?: string };
    res: { entries: SyncLiveWorkflowPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton oauth-bundle oracle
   * state. Same semantics as `oh.sync.snapshotVault` — singleton
   * `entries` carries 0 or 1 element. Local-only by §12.3; the
   * payload (token + secret material) never crosses any sync transport.
   */
  'oh.sync.snapshotOAuthBundle': {
    req: { workspaceId?: string };
    res: { entries: SyncOAuthBundlePostState[] };
  };
  /**
   * Snapshot the active workspace's singleton pause-markers oracle
   * state. Same semantics as `oh.sync.snapshotVault` — singleton
   * `entries` carries 0 or 1 element. User-visible UX state, not
   * secrets.
   */
  'oh.sync.snapshotPauseMarkers': {
    req: { workspaceId?: string };
    res: { entries: SyncPauseMarkersPostState[] };
  };
  /**
   * Snapshot the active workspace's singleton layout-state oracle
   * state. Same semantics as `oh.sync.snapshotPauseMarkers` — singleton
   * `entries` carries 0 or 1 element. Pure UX state, not secrets.
   */
  'oh.sync.snapshotLayoutState': {
    req: { workspaceId?: string };
    res: { entries: SyncLayoutStatePostState[] };
  };
  /**
   * Snapshot the active workspace's singleton files oracle state. Same
   * semantics as `oh.sync.snapshotPauseMarkers` — singleton `entries`
   * carries 0 or 1 element. The catalog only governs `(fileId, hash,
   * filename, mimeType, size)` shells; the actual blob bytes live in
   * the platform `BlobStore` IDB and are read lazily on demand.
   */
  'oh.sync.snapshotFiles': {
    req: { workspaceId?: string };
    res: { entries: SyncFilesPostState[] };
  };
  /**
   * Snapshot the global-scope extensionWorkspace oracle's singleton
   * record. Same semantics as `oh.sync.snapshotFiles` — singleton
   * `entries` carries 0 or 1 element. Published by the global oracle
   * (lives above the per-workspace oracle so workspace switches don't
   * tear it down). Renderer mirrors call this on mount before the
   * first broadcast lands.
   */
  'oh.sync.snapshotExtensionWorkspaces': {
    req: Record<string, never>;
    res: { entries: SyncExtensionWorkspacePostState[] };
  };

  // ── Awareness (Phase A A1) ──────────────────────────────────────
  /**
   * Publish or refresh this surface's presence with the SW awareness
   * store. The SW returns the post-GC canonical presence list — the
   * caller folds it into its local mirror immediately, and every other
   * surface receives the same list via the `awarenessBroadcast` event.
   * Awareness is ephemeral; nothing persists.
   */
  'oh.awareness.publish': {
    req: Omit<AwarenessPublishRequest, 'type'>;
    res: AwarenessPublishResponse;
  };
  /**
   * Snapshot the canonical presence for a freshly-mounted surface so
   * its mirror has a starting view before the next publish/broadcast.
   */
  'oh.awareness.snapshot': {
    req: Record<string, never>;
    res: { workspaceId: string | null; presence: AwarenessState[] };
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
export type BridgeTabContract = Record<string, never>;

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

  /**
   * Sync-engine broadcast — every committed mutation envelope and its
   * mutator outcome, re-published from the local oracle's broadcast
   * bus (Phase A). Surfaces dedup by `envelope.mutationId` and replay
   * on top of their optimistic state. The wire shape mirrors
   * `SyncBroadcastEvent` from `@openheaders/core/protocol` but stays a
   * `bridge` broadcast type so it travels alongside the other UI
   * change channels with no extra plumbing.
   */
  syncBroadcast: {
    envelope: MutationEnvelope;
    outcome: MutatorOutcome;
    batchId?: string;
    /**
     * Post-commit projection for Rule envelopes (Fw7). Renderer-side
     * rule mirrors fold this into their local view to track itemIds
     * for set-modeled paths without an oracle round-trip.
     */
    rulePostState?: SyncRulePostState;
    /**
     * Post-commit projection for Environment envelopes (Phase B).
     * Renderer-side environment mirrors fold this in lockstep with the
     * SW oracle.
     */
    environmentPostState?: SyncEnvironmentPostState;
    /**
     * Post-commit projection for Collection envelopes (Phase B).
     * Renderer-side collection mirrors fold this in lockstep with the
     * SW oracle.
     */
    collectionPostState?: SyncCollectionPostState;
    /**
     * Post-commit projection for workspace-variables envelopes (Phase B).
     * Renderer-side workspace-variables mirror folds this in lockstep
     * with the SW oracle.
     */
    workspaceVariablesPostState?: SyncWorkspaceVariablesPostState;
    /**
     * Post-commit projection for vault envelopes (Phase B). Singleton
     * entity. Local-only by §12.3 — never crosses any sync transport.
     */
    vaultPostState?: SyncVaultPostState;
    /**
     * Post-commit projection for Folder envelopes (Phase B). Renderer
     * mirrors fold this so sidebar tree consumers see post-commit
     * shape (full reconstructed path) without round-tripping the SW.
     */
    folderPostState?: SyncFolderPostState;
    /**
     * Post-commit projection for Request envelopes (Phase B). Renderer
     * mirrors fold this so request editor surfaces see post-commit
     * shape + live itemIds for set-modeled paths without round-tripping.
     */
    requestPostState?: SyncRequestPostState;
    /**
     * Post-commit projection for request-collection envelopes (Phase B).
     * Mirrors fold this so the request sidebar sees post-commit shape
     * without a round-trip.
     */
    requestCollectionPostState?: SyncRequestCollectionPostState;
    /**
     * Post-commit projection for request-folder envelopes (Phase B).
     * Same shape semantics as `folderPostState` — full reconstructed
     * path included.
     */
    requestFolderPostState?: SyncRequestFolderPostState;
    /**
     * Post-commit projection for Template envelopes (Phase B). Renderer
     * mirrors fold this so template editor surfaces see post-commit
     * shape + live itemIds for the set-modeled `conditions` path
     * without round-tripping.
     */
    templatePostState?: SyncTemplatePostState;
    /**
     * Post-commit projection for template-collection envelopes (Phase B).
     */
    templateCollectionPostState?: SyncTemplateCollectionPostState;
    /**
     * Post-commit projection for template-folder envelopes (Phase B).
     * Same shape semantics as `requestFolderPostState` — full
     * reconstructed path included.
     */
    templateFolderPostState?: SyncTemplateFolderPostState;
    /**
     * Post-commit projection for Live-Variable envelopes (Phase B).
     * Flat-scalar entity — no itemId map.
     */
    liveVariablePostState?: SyncLiveVariablePostState;
    /**
     * Post-commit projection for Live-Workflow envelopes (Phase B).
     * `steps` rides as a whole-array scalar — no itemId map.
     */
    liveWorkflowPostState?: SyncLiveWorkflowPostState;
    /**
     * Post-commit projection for oauth-bundle envelopes (Phase B).
     * Singleton entity. Local-only by §12.3 — never crosses any sync
     * transport.
     */
    oauthBundlePostState?: SyncOAuthBundlePostState;
    /**
     * Post-commit projection for pause-markers envelopes (Phase B).
     * Singleton entity. User-visible UX state, not secrets — broadcast
     * + sync transports carry it freely.
     */
    pauseMarkersPostState?: SyncPauseMarkersPostState;
    /**
     * Post-commit projection for layout-state envelopes (Phase B).
     * Singleton entity. Pure UX state, not secrets — broadcast + sync
     * transports carry it freely.
     */
    layoutStatePostState?: SyncLayoutStatePostState;
    /**
     * Post-commit projection for files envelopes (Phase B). Singleton
     * entity. Catalog only — bytes live in the platform `BlobStore` IDB
     * and are read lazily on demand.
     */
    filesPostState?: SyncFilesPostState;
    /**
     * Post-commit projection for extensionWorkspace envelopes (Phase B).
     * Singleton entity at the GLOBAL scope (lives above the per-workspace
     * oracle). Published by the global-scope oracle, not the
     * per-workspace one; renderer-side mirrors filter by `body.type` so
     * source-of-broadcast is transparent.
     */
    extensionWorkspacePostState?: SyncExtensionWorkspacePostState;
  };

  /**
   * Awareness broadcast — canonical per-workspace presence list,
   * re-emitted by the SW on every publish/GC change. Ephemeral; never
   * persisted. Lives on a separate channel from `syncBroadcast` because
   * awareness is high-frequency and entangling presence flicker with
   * mutation projection would couple two unrelated lifecycles
   * (`docs/SYNC_ENGINE_DESIGN.md` §14).
   */
  awarenessBroadcast: {
    workspaceId: string;
    presence: AwarenessState[];
  };
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
  /** Last env the user manually picked — consumed by the `apply-defaults` auto-switch mode. */
  manualEnvId: string | null;
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
