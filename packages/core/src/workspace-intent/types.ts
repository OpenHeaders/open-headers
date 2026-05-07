/**
 * WorkspaceIntent — the wire contract for cross-surface navigation into
 * the workspace. Every "open X in the workspace" action from the popup,
 * sidepanel, devtools panel, or the workspace itself flows through this
 * tagged union; the navigator dispatches it, the renderer's router
 * applies it. See docs/V5_FOUNDATION_PLAN.md §Phase 9.
 *
 * Types are declared here; the valibot schema in `./schema.ts` is the
 * runtime source of truth. `WorkspaceIntent` is re-derived via
 * `v.InferOutput<typeof WorkspaceIntentSchema>` so the two can never
 * drift — Phase 2 discipline applied to the navigation channel.
 */

import type { RuleFlowScope, WorkspaceIntent, WorkspaceIntentKind } from './schema';

export type { RuleFlowScope, WorkspaceIntent, WorkspaceIntentKind };

/**
 * Identifies the surface that dispatched the intent. The SW navigator
 * uses this to refine target-tab selection (see `selectTargetTab`) —
 * e.g. a devpanel intent prefers the workspace tab attached to the
 * devpanel's host window.
 */
export type IntentCallerSurface = 'popup' | 'sidepanel' | 'devpanel' | 'workspace';

export interface IntentCallerContext {
  /** Surface the intent originated from, if determinable. */
  surface?: IntentCallerSurface;
  /** Window id the caller is anchored to, if determinable. */
  callerWindowId?: number;
  /**
   * Workspace id the caller wants to land in. When set, the navigator
   * filters candidate workbench tabs to those bound to this workspace
   * (parsed from each tab's `/ws/<wsId>/` URL prefix); cold-path tabs
   * are minted with the workspace pinned in the URL. Undefined means
   * "no preference" — every candidate matches, cold path mints a bare
   * hash (legacy bookmark form).
   */
  callerWorkspaceId?: string;
}
