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
import type { V5 } from '@openheaders/core/types';
import type { TabTelemetrySnapshot } from '@/background/modules/tab-telemetry';
import type { LoadedTestRun, TestRunOwnerType } from '@/background/modules/test-run-store';
import type { ActiveRule } from '@/types/browser';
import type { PerfResourceEntry } from '@/types/perf';
import type { RecordingData, RecordingStateInfo } from '@/types/recording';

// ── Workspace ────────────────────────────────────────────────────

/** Snapshot returned whenever the UI needs the current workspace list + active id. */
export interface WorkspaceSnapshot {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string;
}

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
    };
    res: { success: boolean; workspace?: V5.ExtensionWorkspace };
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
      rule: Omit<V5.Rule, 'uid' | 'path'>;
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
      updates: Partial<Omit<V5.Rule, 'uid' | 'path'>>;
    };
    res: { success: boolean };
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
      template: Omit<V5.Template, 'uid' | 'path'>;
      collectionUid?: string;
      parentPath?: string;
    };
    res: { success: boolean; template?: V5.Template };
  };
  updateTemplate: {
    req: {
      templateUid: string;
      updates: Partial<Omit<V5.Template, 'uid' | 'path'>>;
    };
    res: { success: boolean };
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
  testRunFinished: { ownerType: TestRunOwnerType; ownerId: string; runId: string };
  testRunDeleted: { runId: string };
  testRunsClearedForOwner: { ownerType: TestRunOwnerType; ownerId: string };
  connectionStatus: { connected: boolean };
  trackedUrlsUpdated: { tabId?: number };
  largeRuleSetWarning: { activeCount: number; threshold: number; dropped: number };
  /**
   * Fires on any workspace list mutation (create/rename/delete/reorder)
   * AND on active-workspace switch. UI surfaces re-read rules, templates,
   * environments, and pause markers on this event — one atomic refetch
   * instead of four separate broadcasts.
   */
  workspaceChanged: WorkspaceSnapshot;
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
