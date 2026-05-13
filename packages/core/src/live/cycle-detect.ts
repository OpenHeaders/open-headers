/**
 * Pure cycle detector for the Live Variables dependency graph.
 *
 * Edges flow LV → LV via intermediate workflow steps:
 *
 *   LV_A depends on its workflow's steps.
 *   Each step depends on its request's templates.
 *   Those templates may contain `{{live.B}}` — an edge LV_A → LV_B.
 *
 * A cycle at this level means a workflow refresh would recursively
 * wait on its own output, producing either a deadlock at compile
 * time or, worse, a "last-known-good" serve-from-cache drift if we
 * let it run. Save-time detection blocks the write; reconcile-on-wake
 * logs and falls back to definition-order refresh with jitter.
 *
 * The algorithm is DFS with white/grey/black coloring — O(V + E)
 * across LVs. Tarjan-SCC is the textbook choice for reporting every
 * cycle in a dense graph, but our expected workspace size (low tens
 * of LVs, each with < 10 step-live-refs) makes simple DFS faster in
 * practice and easier to reason about. We do return EVERY cycle (not
 * just the first) by continuing DFS after each detection.
 */

import type { LiveVariable, LiveWorkflow } from '../types/live';
import { scanTemplateReferencesMany } from './template-scan';

// ── Result shape ──────────────────────────────────────────────────

export interface CycleEdge {
  /** Source LV's uid. */
  fromLvUid: string;
  /** Source LV's name (for UX messaging). */
  fromLvName: string;
  /** Target LV's uid. */
  toLvUid: string;
  /** Target LV's name. */
  toLvName: string;
  /** Workflow carrying the edge (the source LV's backing workflow). */
  throughWorkflowUid: string;
  /** Step within that workflow whose request template referenced the target LV. */
  throughStepId: string;
}

export interface CycleReport {
  /**
   * Sequence of LV names that form the cycle, in traversal order.
   * The first and last entries are the SAME node — the loop
   * closes on itself so UI can render "A → B → A" unambiguously.
   */
  cycle: string[];
  /** One edge per hop in the cycle, parallel to adjacent entries in `cycle`. */
  edges: CycleEdge[];
}

/**
 * Hook the caller provides to expand a request uid into its template
 * strings. Same shape as `step-validation.RequestTemplateProvider`;
 * re-declared here so the module is self-contained.
 */
export type RequestTemplateProvider = (requestUid: string) => readonly string[] | null;

// ── detectCycles ──────────────────────────────────────────────────

export function detectCycles(
  liveVariables: readonly LiveVariable[],
  liveWorkflows: readonly LiveWorkflow[],
  requestTemplates: RequestTemplateProvider,
): CycleReport[] {
  const lvByUid = new Map(liveVariables.map((lv) => [lv.uid, lv] as const));
  const lvByName = new Map(liveVariables.map((lv) => [lv.name, lv] as const));
  const wfByUid = new Map(liveWorkflows.map((wf) => [wf.uid, wf] as const));

  // Build adjacency: LV uid → outgoing edges.
  const adj = new Map<string, CycleEdge[]>();
  for (const lv of liveVariables) {
    const outs: CycleEdge[] = [];
    const wf = wfByUid.get(lv.workflowUid);
    if (wf) {
      for (const step of wf.steps) {
        const templates = requestTemplates(step.requestUid);
        if (templates == null || templates.length === 0) continue;
        const { live: liveRefs } = scanTemplateReferencesMany(templates);
        for (const name of liveRefs) {
          const target = lvByName.get(name);
          if (!target) continue; // unresolved live ref — a separate concern (resolver emits error)
          outs.push({
            fromLvUid: lv.uid,
            fromLvName: lv.name,
            toLvUid: target.uid,
            toLvName: target.name,
            throughWorkflowUid: wf.uid,
            throughStepId: step.id,
          });
        }
      }
    }
    adj.set(lv.uid, outs);
  }

  type Color = 'white' | 'grey' | 'black';
  const color = new Map<string, Color>();
  for (const lv of liveVariables) color.set(lv.uid, 'white');

  // Stack holds the current DFS path so we can slice out the cycle
  // when we hit a grey node. Each frame carries the edge TAKEN to
  // enter that node (undefined for the root).
  interface Frame {
    lvUid: string;
    /** Edge used to reach this frame from its predecessor, or null at the root. */
    incomingEdge: CycleEdge | null;
  }

  const cycles: CycleReport[] = [];

  const dfs = (rootUid: string): void => {
    const stack: Frame[] = [{ lvUid: rootUid, incomingEdge: null }];
    // Iterator state per frame — which of the outgoing edges we're about to walk.
    const cursor: number[] = [0];
    color.set(rootUid, 'grey');

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const edges = adj.get(top.lvUid) ?? [];
      const idx = cursor[cursor.length - 1];
      if (idx >= edges.length) {
        // Done with this node.
        color.set(top.lvUid, 'black');
        stack.pop();
        cursor.pop();
        continue;
      }
      // Advance the cursor BEFORE recursing so the loop picks up the
      // next edge on return.
      cursor[cursor.length - 1] = idx + 1;
      const edge = edges[idx];
      const neighborColor = color.get(edge.toLvUid);

      if (neighborColor === 'grey') {
        // Cycle — slice the stack from the target node to the top,
        // append the closing edge, and record the report.
        const startIdx = stack.findIndex((f) => f.lvUid === edge.toLvUid);
        if (startIdx === -1) continue; // defensive
        const cyclePath: string[] = [];
        const cycleEdges: CycleEdge[] = [];
        for (let i = startIdx; i < stack.length; i++) {
          const lv = lvByUid.get(stack[i].lvUid);
          if (lv) cyclePath.push(lv.name);
          if (i > startIdx && stack[i].incomingEdge) {
            cycleEdges.push(stack[i].incomingEdge as CycleEdge);
          }
        }
        // Append the closing hop.
        cycleEdges.push(edge);
        const closingLv = lvByUid.get(edge.toLvUid);
        if (closingLv) cyclePath.push(closingLv.name);
        cycles.push({ cycle: cyclePath, edges: cycleEdges });
      } else if (neighborColor === 'white') {
        color.set(edge.toLvUid, 'grey');
        stack.push({ lvUid: edge.toLvUid, incomingEdge: edge });
        cursor.push(0);
      }
      // 'black' → fully explored; skip.
    }
  };

  for (const lv of liveVariables) {
    if (color.get(lv.uid) === 'white') {
      dfs(lv.uid);
    }
  }

  return cycles;
}
