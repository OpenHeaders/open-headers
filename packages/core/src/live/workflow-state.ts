/**
 * Workflow completeness + effectiveness checks — shared vocabulary
 * across extension + (future) desktop. Parallels
 * `@openheaders/core/utils → isRuleComplete / isRuleEffective`.
 *
 * Workflows are flat (no collection/folder hierarchy), so unlike rules
 * there's no path-scoped pause cascade here. `enabled` is the single
 * on/off axis; `isWorkflowEffective` just gates on enabled + complete.
 *
 * These are pure functions with no bridge or storage calls. UI + SW
 * call them to derive badge state and scheduler-eligibility without
 * duplicating the predicates.
 */

import type { LiveWorkflow } from '../types/live';
import { validateStepRequestsExist, validateWorkflowShape } from './step-validation';

/**
 * Is this workflow complete enough to actually run? An incomplete
 * workflow is kept in storage (so it stays in the editor + sidebar),
 * but the refresh scheduler won't schedule it and the sidebar marks
 * it with a "draft" badge the same way rules mark incomplete rules.
 *
 * Completeness rules:
 *   - At least one step (empty workflows have nothing to fetch).
 *   - Every step has a `requestUid` (empty-string is the in-progress
 *     placeholder the editor emits before the user picks a request).
 *   - `validateWorkflowShape` returns no structural errors. This covers
 *     duplicate step ids, cycles, gate refs to unreachable steps,
 *     priority refs to missing captures, no-root-step, and the full
 *     Phase I-A validator surface.
 */
export function isWorkflowComplete(wf: LiveWorkflow): boolean {
  // Trust boundary: same contract as `isRequestResolvable` — persisted
  // rows the renderer reads raw can be malformed (non-array `steps`
  // would throw here); answer "incomplete" (draft badge, scheduler
  // skips) instead of throwing into the render path.
  try {
    if (!Array.isArray(wf.steps) || wf.steps.length === 0) return false;
    if (wf.steps.some((s) => !s.requestUid || s.requestUid.length === 0)) return false;
    if (validateWorkflowShape(wf).length > 0) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Does every step still point at a request that exists? Unlike
 * {@link isWorkflowComplete}, this is deliberately NOT a pure function
 * of the workflow alone — runnability genuinely depends on the request
 * registry, and `isWorkflowComplete`'s `requestUid !== ''` check only
 * catches the never-picked case, not a request deleted out from under
 * a populated `requestUid`. Consumers that hold a request registry
 * (the SW scheduler, the rule-feed resolver) compose
 * `isWorkflowEffective(wf) && workflowStepsResolvable(wf, registry)`;
 * the registry dependency stays explicit at exactly those call sites.
 *
 * Callers MUST only invoke this once the request registry has
 * hydrated — see {@link validateStepRequestsExist}.
 */
export function workflowStepsResolvable(wf: LiveWorkflow, knownRequestUids: ReadonlySet<string>): boolean {
  return validateStepRequestsExist(wf, knownRequestUids).length === 0;
}

/**
 * Single source of truth for "is this workflow a still-drafting,
 * not-yet-published entity?". Drives every UI affordance that
 * distinguishes drafts from live workflows: gray pill on the tab strip,
 * `row-draft` styling in the sidebar, italic tab label, tab-close
 * discard prompt. Mirrors `isRuleDraft` in
 * `packages/core/src/utils/rule-validation.ts`.
 *
 * Reads `published === true` so both `false` and `undefined` collapse
 * to "draft" — matches `isWorkflowEffective`'s contract.
 */
export function isWorkflowDraft(wf: LiveWorkflow): boolean {
  return wf.published !== true;
}

/**
 * Single source of truth for "will this workflow's refresh scheduler
 * actually fire?". Combines:
 *
 *   - `wf.published === true` — user committed this draft to live state
 *                               (Save = publish). New workflows from
 *                               `+ New Live Workflow` start
 *                               `published: false` so per-keystroke
 *                               edits don't fire scheduled requests
 *                               against the user's network.
 *   - `wf.enabled === true`   — user's explicit toggle
 *   - `isWorkflowComplete`    — incomplete workflows don't schedule
 *
 * Every call site that needs "effective workflow set" — scheduler
 * enumeration, sidebar badge filter, DNR compile-time sync-warm
 * targeting — should use this instead of re-deriving the predicate.
 */
export function isWorkflowEffective(wf: LiveWorkflow): boolean {
  if (isWorkflowDraft(wf)) return false;
  if (wf.enabled !== true) return false;
  return isWorkflowComplete(wf);
}
