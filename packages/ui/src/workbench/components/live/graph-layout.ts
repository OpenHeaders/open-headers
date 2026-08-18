/**
 * Pure layout helper for the Live Workflow editor's graph view.
 *
 * Naive layered layout over the step DAG (the workflow-graph plan §3):
 *
 *   - `layer` — longest-path depth from the roots, the same computation
 *     `buildDependencyRows` uses for the indented tree but WITHOUT the
 *     `MAX_INDENT` clamp: the graph pane scrolls, so deep chains keep
 *     their true depth instead of flattening.
 *   - `slot`  — position within the layer, assigned in declared-step
 *     order (the canonical serialization order and the runtime
 *     priority tiebreak), so the graph never reorders siblings across
 *     renders.
 *   - `edges` — one entry per resolved `dependsOn` parent
 *     (`effectiveDependsOn`, implicit prior-step dep filled in) whose
 *     target step actually exists. Edges to unknown stepIds are
 *     dropped — the validator flags those; the layout just stays sane.
 *
 * Cycles (representable pre-save) degrade exactly like the indented
 * tree: an unseen parent contributes depth 0, nothing throws. The
 * validation badge is the user's signal.
 *
 * Pure — no React, no DOM, no pixels. The renderer owns node sizing
 * and maps (layer, slot) onto coordinates.
 */

import { computeTransitiveAncestors, effectiveDependsOn } from '@openheaders/core/live';
import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';

export interface GraphNode {
  step: WorkflowStep;
  declaredIndex: number;
  /** 0-based longest-path depth from the roots; unclamped. */
  layer: number;
  /** 0-based position within the layer, in declared order. */
  slot: number;
  /** Resolved dependsOn stepIds (implicit prior-step dep filled in). */
  parents: string[];
  /** Transitive ancestors (inclusive of direct parents). */
  reachable: Set<string>;
}

export interface GraphEdge {
  /** Parent stepId. */
  from: string;
  /** Child stepId. */
  to: string;
}

export interface WorkflowGraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Total layer count (0 for an empty workflow). */
  layerCount: number;
  /** Widest layer's node count (0 for an empty workflow). */
  maxSlots: number;
}

/**
 * Build the layered layout for every step in declared order.
 *
 * Complexity: O(V + E) — one pass over steps, constant-time ancestor
 * lookup via the precomputed map from core.
 */
export function buildWorkflowGraphLayout(workflow: LiveWorkflow): WorkflowGraphLayout {
  const ancestors = computeTransitiveAncestors(workflow);
  const knownIds = new Set(workflow.steps.map((s) => s.id));
  const depth = new Map<string, number>();
  const slotsPerLayer = new Map<number, number>();
  const edges: GraphEdge[] = [];

  const nodes = workflow.steps.map((step, i) => {
    const parents = effectiveDependsOn(step, i, workflow);
    const layer = parents.length === 0 ? 0 : 1 + parents.reduce((m, p) => Math.max(m, depth.get(p) ?? 0), 0);
    depth.set(step.id, layer);
    const slot = slotsPerLayer.get(layer) ?? 0;
    slotsPerLayer.set(layer, slot + 1);
    for (const parent of parents) {
      if (knownIds.has(parent)) edges.push({ from: parent, to: step.id });
    }
    return {
      step,
      declaredIndex: i,
      layer,
      slot,
      parents,
      reachable: ancestors.get(step.id) ?? new Set<string>(),
    };
  });

  let maxSlots = 0;
  for (const count of slotsPerLayer.values()) maxSlots = Math.max(maxSlots, count);

  return {
    nodes,
    edges,
    layerCount: slotsPerLayer.size === 0 ? 0 : Math.max(...slotsPerLayer.keys()) + 1,
    maxSlots,
  };
}
