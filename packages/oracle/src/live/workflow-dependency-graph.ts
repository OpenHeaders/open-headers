/**
 * Cross-workflow live-value dependency graph — host-neutral.
 *
 * Workflow A depends on Workflow B when A's step requests reference a
 * `{{live.X}}` whose LV binds to B. Two consumers build on this:
 *
 *   - the refresh schedulers depth-sort alarms/timers so downstream
 *     refreshes fire AFTER upstream on the same wake wave
 *     ({@link computeWorkflowDependencies}); and
 *   - the LF4 definitional-freshness cascade walks the inverse edge map
 *     ({@link computeWorkflowDownstreamMap}) to find the consumers a
 *     workflow's just-refreshed live value made stale.
 *
 * Everything reads the active-workspace stores (`getLiveWorkflows` /
 * `getLiveVariables` / `getRequest`); a missing request lookup degrades
 * to "no deps for this entry," equivalent to scheduling in definition
 * order (the documented fallback when a graph can't be resolved).
 */

import {
  collectRequestTemplateStrings,
  isLiveVariableEffective,
  scanTemplateReferencesMany,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { getRequest } from '../entity/request-store';
import { getLiveVariables } from './live-variable-store';
import { getLiveWorkflows } from './live-workflow-store';

/**
 * Index every effective live variable by name → its producer workflow
 * uid. Only effective LVs (published + enabled) produce values that
 * would trigger a rebuild of the consuming rule set, so a draft /
 * disabled binding doesn't warrant a dependency edge.
 */
export function buildEffectiveLvNameToWorkflowIndex(): Map<string, string> {
  const out = new Map<string, string>();
  for (const lv of getLiveVariables()) {
    if (isLiveVariableEffective(lv)) out.set(lv.name, lv.workflowUid);
  }
  return out;
}

/**
 * The producer workflow uids whose `{{live.X}}` values a workflow's
 * step requests consume. A self-reference never forms an edge — a
 * workflow can't be its own upstream.
 */
export function collectWorkflowLiveParentUids(
  workflow: LiveWorkflow,
  lvNameToWorkflow: ReadonlyMap<string, string>,
): Set<string> {
  const parents = new Set<string>();
  for (const step of workflow.steps) {
    const request = getRequest(step.requestUid);
    if (!request) continue;
    const templates = collectRequestTemplateStrings(request);
    if (templates.length === 0) continue;
    const { live } = scanTemplateReferencesMany(templates);
    for (const name of live) {
      const producerUid = lvNameToWorkflow.get(name);
      if (producerUid && producerUid !== workflow.uid) parents.add(producerUid);
    }
  }
  return parents;
}

/**
 * One schedulable identity → the alarm/timer keys of the upstream
 * workflows it depends on. `encodeKey` lets each host stamp the edges
 * in its own key space (the extension's base64url alarm name, the
 * desktop's JSON triple) while sharing the graph walk. Same workflow
 * in different envs gets distinct keys but shares the dependency edges
 * (the step requests are identical; the cache is what varies).
 */
export function computeWorkflowDependencies<
  Entry extends { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null },
>(
  entries: Entry[],
  encodeKey: (workspaceId: string, workflowUid: string, environmentId: string | null) => string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (entries.length === 0) return out;

  const lvNameToWorkflow = buildEffectiveLvNameToWorkflowIndex();
  if (lvNameToWorkflow.size === 0) return out;

  const entryKeyByWorkflow = new Map<string, string>();
  for (const entry of entries) {
    entryKeyByWorkflow.set(
      `${entry.workspaceId}:${entry.workflow.uid}`,
      encodeKey(entry.workspaceId, entry.workflow.uid, entry.environmentId),
    );
  }

  for (const entry of entries) {
    const parentUids = collectWorkflowLiveParentUids(entry.workflow, lvNameToWorkflow);
    if (parentUids.size === 0) continue;
    const parents: string[] = [];
    for (const producerUid of parentUids) {
      const parentKey = entryKeyByWorkflow.get(`${entry.workspaceId}:${producerUid}`);
      if (parentKey) parents.push(parentKey);
    }
    if (parents.length === 0) continue;
    out.set(encodeKey(entry.workspaceId, entry.workflow.uid, entry.environmentId), parents);
  }

  return out;
}

/**
 * Map each workflow uid to the set of workflow uids DOWNSTREAM of it —
 * the workflows whose step requests consume a `{{live.X}}` bound to it.
 * The inverse of the upstream edges {@link computeWorkflowDependencies}
 * derives; the LF4 cascade walks it to find the consumers a workflow's
 * just-refreshed live value made stale. Active-workspace view only.
 */
export function computeWorkflowDownstreamMap(): Map<string, Set<string>> {
  const downstream = new Map<string, Set<string>>();
  const lvNameToWorkflow = buildEffectiveLvNameToWorkflowIndex();
  if (lvNameToWorkflow.size === 0) return downstream;
  for (const workflow of getLiveWorkflows()) {
    for (const parentUid of collectWorkflowLiveParentUids(workflow, lvNameToWorkflow)) {
      let children = downstream.get(parentUid);
      if (!children) {
        children = new Set();
        downstream.set(parentUid, children);
      }
      children.add(workflow.uid);
    }
  }
  return downstream;
}

/**
 * True when `target` is reachable downstream from `from` by walking
 * the downstream edge map. Used as the LF4 cycle guard — an edge
 * `upstream → child` is a cycle back-edge when the child can itself
 * reach the upstream, and the cascade refuses to traverse it.
 */
export function canReachDownstream(
  from: string,
  target: string,
  downstream: ReadonlyMap<string, Set<string>>,
): boolean {
  const stack: string[] = [from];
  const seen = new Set<string>([from]);
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    const children = downstream.get(node);
    if (!children) continue;
    for (const child of children) {
      if (child === target) return true;
      if (!seen.has(child)) {
        seen.add(child);
        stack.push(child);
      }
    }
  }
  return false;
}
