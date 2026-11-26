/**
 * Pure layout helper for the Live Workflow editor's graph view.
 *
 * Layered layout over the step DAG (the workflow-graph plan §3; the
 * workflows redesign, Graph):
 *
 *   - `layer` — longest-path depth from the roots, the same computation
 *     `buildDependencyRows` uses for the indented tree but WITHOUT the
 *     `MAX_INDENT` clamp: the graph pane pans, so deep chains keep
 *     their true depth instead of flattening.
 *   - `x`     — the node's left edge. A node sits under the middle of
 *     its parents; the roots stand side by side in declared order (the
 *     canonical serialization order and the runtime priority tiebreak).
 *     Nodes that would overlap are pushed apart, least moved, the lower
 *     wish to the left and declared order between equals.
 *   - `edges` — one entry per resolved `dependsOn` parent
 *     (`effectiveDependsOn`, implicit prior-step dep filled in) whose
 *     target step actually exists. Edges to unknown stepIds are
 *     dropped — the validator flags those; the layout just stays sane.
 *     An edge that passes a layer has a lane of its own there, laid out
 *     as a node is, so its line never runs under a node.
 *
 * Cycles (representable pre-save) degrade exactly like the indented
 * tree: an unseen parent contributes depth 0, nothing throws. The
 * validation badge is the user's signal.
 *
 * Pure — no React, no DOM. The renderer says how wide a node, a lane
 * and the space between two of them are, and owns the vertical axis.
 */

import { computeTransitiveAncestors, effectiveDependsOn } from '@openheaders/core/live';
import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';

export interface GraphLayoutMetrics {
  nodeWidth: number;
  /** The space between two neighbours of a layer. */
  gap: number;
  /** The width a passing edge keeps to itself in a layer. */
  laneWidth: number;
}

export interface GraphNode {
  step: WorkflowStep;
  declaredIndex: number;
  /** 0-based longest-path depth from the roots; unclamped. */
  layer: number;
  /** Left edge; the leftmost thing of the graph is at 0. */
  x: number;
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
  /** The centre of its lane in each layer it passes, top down — empty between neighbouring layers. */
  lanes: number[];
}

export interface WorkflowGraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Total layer count (0 for an empty workflow). */
  layerCount: number;
  /** The right edge of the rightmost thing (0 for an empty workflow). */
  width: number;
}

/** A node holds its place; a lane gives way to it. */
const NODE_WEIGHT = 1;
const LANE_WEIGHT = 1e-6;

export interface RowItem {
  /** Where its centre would sit with the row to itself. */
  wish: number;
  width: number;
  /** How firmly it holds its wish against its neighbours'. */
  weight: number;
}

interface LayerItem extends RowItem {
  place: (centre: number) => void;
}

/**
 * The centres of a row's items, in the order given: each as near its
 * wish as its weight earns, no two closer than their widths and the gap
 * allow.
 */
export function spreadApart(items: readonly RowItem[], gap: number): number[] {
  const offsets: number[] = [];
  let offset = 0;
  items.forEach((item, i) => {
    if (i > 0) offset += (items[i - 1].width + item.width) / 2 + gap;
    offsets.push(offset);
  });
  // Weighted isotonic regression over the wishes less their offsets:
  // neighbours that would cross pool into one block at their mean.
  const blocks: { weight: number; weighted: number; count: number }[] = [];
  items.forEach((item, i) => {
    blocks.push({ weight: item.weight, weighted: item.weight * (item.wish - offsets[i]), count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const before = blocks[blocks.length - 2];
      if (before.weighted / before.weight <= last.weighted / last.weight) break;
      blocks.splice(blocks.length - 2, 2, {
        weight: before.weight + last.weight,
        weighted: before.weighted + last.weighted,
        count: before.count + last.count,
      });
    }
  });
  const centres: number[] = [];
  for (const block of blocks) {
    for (let k = 0; k < block.count; k++) centres.push(block.weighted / block.weight + offsets[centres.length]);
  }
  return centres;
}

/**
 * Build the layered layout for every step in declared order.
 */
export function buildWorkflowGraphLayout(workflow: LiveWorkflow, metrics: GraphLayoutMetrics): WorkflowGraphLayout {
  const { nodeWidth, gap, laneWidth } = metrics;
  const ancestors = computeTransitiveAncestors(workflow);
  const knownIds = new Set(workflow.steps.map((s) => s.id));
  const depth = new Map<string, number>();
  const edges: GraphEdge[] = [];

  const nodes: GraphNode[] = workflow.steps.map((step, i) => {
    const parents = effectiveDependsOn(step, i, workflow);
    const layer = parents.length === 0 ? 0 : 1 + parents.reduce((m, p) => Math.max(m, depth.get(p) ?? 0), 0);
    depth.set(step.id, layer);
    for (const parent of parents) {
      if (knownIds.has(parent)) edges.push({ from: parent, to: step.id, lanes: [] });
    }
    return {
      step,
      declaredIndex: i,
      layer,
      x: 0,
      parents,
      reachable: ancestors.get(step.id) ?? new Set<string>(),
    };
  });

  const layerCount = nodes.reduce((count, node) => Math.max(count, node.layer + 1), 0);
  const centres = new Map<string, number>();
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;

  for (let layer = 0; layer < layerCount; layer++) {
    const items: LayerItem[] = [];
    let unparented = 0;
    for (const node of nodes) {
      if (node.layer !== layer) continue;
      const placed = node.parents.flatMap((parent) => {
        const centre = centres.get(parent);
        return centre === undefined ? [] : [centre];
      });
      const wish =
        placed.length > 0
          ? placed.reduce((sum, centre) => sum + centre, 0) / placed.length
          : unparented++ * (nodeWidth + gap) + nodeWidth / 2;
      items.push({
        wish,
        width: nodeWidth,
        weight: NODE_WEIGHT,
        place: (centre) => {
          node.x = centre - nodeWidth / 2;
          centres.set(node.step.id, centre);
        },
      });
    }
    for (const edge of edges) {
      const from = depth.get(edge.from) ?? 0;
      const to = depth.get(edge.to) ?? 0;
      if (layer <= from || layer >= to) continue;
      const above = edge.lanes.length > 0 ? edge.lanes[edge.lanes.length - 1] : centres.get(edge.from);
      if (above === undefined) continue;
      items.push({ wish: above, width: laneWidth, weight: LANE_WEIGHT, place: (centre) => edge.lanes.push(centre) });
    }
    // Stable: equal wishes keep the order above — nodes in declared order, then lanes.
    const ordered = items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.wish - b.item.wish || a.index - b.index);
    const placedAt = spreadApart(
      ordered.map(({ item }) => item),
      gap,
    );
    ordered.forEach(({ item }, i) => {
      item.place(placedAt[i]);
      left = Math.min(left, placedAt[i] - item.width / 2);
      right = Math.max(right, placedAt[i] + item.width / 2);
    });
  }

  if (nodes.length === 0) return { nodes, edges, layerCount: 0, width: 0 };
  // To a hundredth: what a lane's give leaves of a node's place is no offset to draw.
  const settle = (value: number): number => Math.round((value - left) * 100) / 100 + 0;
  for (const node of nodes) node.x = settle(node.x);
  for (const edge of edges) edge.lanes = edge.lanes.map(settle);
  return { nodes, edges, layerCount, width: settle(right) };
}
