/**
 * Pure layout helper for the Live Workflow editor's indented-tree view.
 *
 * Given a workflow, produces one `DependencyRow` per declared step with:
 *
 *   - `indent`  — integer depth (0 = root; each tier of dependsOn adds 1,
 *                 capped at `MAX_INDENT` so deeply-chained workflows don't
 *                 push the editor off-screen).
 *   - `parents` — effective dependsOn list (implicit prior-step dep
 *                 resolved) for drawing left-border connector lines.
 *   - `reachable` — set of transitive ancestors (inclusive of direct
 *                 parents), so the editor can filter step dropdowns to
 *                 "steps that can be referenced from here."
 *
 * The helper is pure — no React, no DOM. Connector rendering is the
 * editor's concern; this module only provides the layout data.
 *
 * Declared-list order is preserved verbatim. That's the canonical order
 * the workflow serializes + the tiebreak for runtime priority; rendering
 * in a different order would drift from the YAML's stable diff shape
 * and confuse users who reorder via the existing up/down buttons.
 */

import { computeTransitiveAncestors, effectiveDependsOn } from '@openheaders/core/live';
import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
/** Hard cap on indentation tiers. Past this, everything renders flush. */
export const MAX_INDENT = 8;

export interface DependencyRow {
  step: WorkflowStep;
  declaredIndex: number;
  /** 0-based depth; clamped to `MAX_INDENT`. */
  indent: number;
  /** Resolved dependsOn stepIds (implicit prior-step dep filled in). */
  parents: string[];
  /** All stepIds that could legally be referenced from this step's runIf / priorityFrom / template refs. */
  reachable: Set<string>;
}

/**
 * Build the dependency-annotated rows for every step in declared order.
 *
 * Complexity: O(V + E) — single pass over steps, constant-time ancestor
 * lookup via the precomputed map from core.
 */
export function buildDependencyRows(workflow: LiveWorkflow): DependencyRow[] {
  const ancestors = computeTransitiveAncestors(workflow);
  const depth = new Map<string, number>();

  // Depth = 0 for roots; for everyone else, 1 + max(depth of parent).
  // We walk in declared order; since depth.get for an unseen parent
  // returns undefined, we treat missing as 0 — cycles (which the
  // validator blocks at save) would manifest as "0" but that's fine;
  // the editor renders them without special-casing, the cycle chip is
  // the user's signal.
  return workflow.steps.map((step, i) => {
    const parents = effectiveDependsOn(step, i, workflow);
    const indent =
      parents.length === 0 ? 0 : clampDepth(1 + parents.reduce((m, p) => Math.max(m, depth.get(p) ?? 0), 0));
    depth.set(step.id, indent);
    return {
      step,
      declaredIndex: i,
      indent,
      parents,
      reachable: ancestors.get(step.id) ?? new Set<string>(),
    };
  });
}

function clampDepth(depth: number): number {
  if (depth < 0) return 0;
  if (depth > MAX_INDENT) return MAX_INDENT;
  return depth;
}
