/**
 * Navigation + launcher bridge RPCs — opening tabs, focusing the app,
 * the single cross-surface workspace-intent call, tab-ordinal bootstrap,
 * the delay-page bypass, and the view-mode transition RPC.
 */

import type { ViewMode } from '../../types/view-mode';
import type { IntentCallerContext, WorkspaceIntent } from '../../workspace-intent';
import type { AppNavigationIntent } from '../messages';

export interface NavigationRpc {
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

  // ── Delay page ─────────────────────────────────────────────────
  'oh-delay-bypass': {
    req: { target: string };
    res: { ok: boolean };
  };

  // ── View-mode ────────────────────────────────────────────────
  // Single generic transition RPC. The SW owns persistence, toolbar
  // re-binding, and the SW-callable surface ops (Chromium sidePanel +
  // action.openPopup). The renderer drives the gesture-bound
  // surface ops in its click handler (Firefox sidebar open/close) and
  // sends this RPC fire-and-forget when the source surface is about
  // to die mid-transition.
  //
  // `source` lets the SW close the leaving surface without having to
  // diff old vs. new persisted state (the renderer knows authoritatively
  // which surface it's leaving). `null` covers external callers.
  switchViewMode: {
    req: { next: ViewMode; source: ViewMode | null; windowId?: number; tabId?: number };
    res: { opened: boolean };
  };
}
