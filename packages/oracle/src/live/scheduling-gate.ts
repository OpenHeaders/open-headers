/**
 * Host-neutral "should this workflow hold a refresh timer?" gate.
 *
 * Shared by both refresh schedulers (the extension's alarm-driven one
 * and the desktop's `setTimeout` one) and the definitional-freshness
 * detectors, which consult it before firing an immediate refresh. Pure
 * read over the active-workspace stores + the core effectiveness rules.
 */

import { isLiveVariableEffective, isWorkflowEffective } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { getRequest, isRequestStoreHydrated } from '../entity/request-store';

/**
 * A workflow is schedulable when it's enabled, has at least one
 * effective LV pointing at it (the v1 reference-count heuristic), and
 * every step's backing request still exists. Returns `true` even for
 * `manual` refresh policies — `computeNextFireAt` declines the fire in
 * that case, but the scheduler still wants the entry so a stale timer
 * gets cleared.
 *
 * The request-existence check is skipped until the request store has
 * hydrated (cold-wake window) so a transient empty store never strips
 * a live timer.
 */
export function canScheduleWorkflow(workflow: LiveWorkflow, boundVariables: LiveVariable[]): boolean {
  if (!isWorkflowEffective(workflow)) return false;
  if (!boundVariables.some((v) => isLiveVariableEffective(v))) return false;
  if (isRequestStoreHydrated()) {
    for (const step of workflow.steps) {
      if (step.requestUid.length > 0 && !getRequest(step.requestUid)) return false;
    }
  }
  return true;
}
