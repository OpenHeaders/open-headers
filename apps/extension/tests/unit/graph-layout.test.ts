/**
 * Pure-function tests for `buildWorkflowGraphLayout`. Covers:
 *
 *   - Linear chain (implicit prior-step deps) stacks one node per
 *     layer, each under the last, with a full edge chain.
 *   - Explicit roots share layer 0 side by side in declared order; a
 *     step sits under the middle of its parents.
 *   - A step's children spread around its middle in declared order.
 *   - Fan-in child lands at 1 + max(parent layers), unclamped past the
 *     indented tree's MAX_INDENT; an edge that passes a layer has a lane
 *     there, and the lane gives way to a node.
 *   - Edges to unknown stepIds are dropped; the node still lays out.
 *   - Cycles degrade to layer 0 without throwing (validator's job).
 *   - Determinism: same workflow → identical layout.
 */

import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { buildWorkflowGraphLayout, type GraphNode } from '@openheaders/ui/workbench/components/live/graph-layout';
import { describe, expect, it } from 'vitest';

const METRICS = { nodeWidth: 100, gap: 20, laneWidth: 10 };

function mkWorkflow(steps: WorkflowStep[]): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfabcdef',
    path: 'live-workflows/test-wfabcdef',
    name: 'test',
    steps: steps as LiveWorkflow['steps'],
    refresh: { kind: 'manual' },
    enabled: true,
  };
}

function mkStep(id: string, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return { uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`, id, requestUid: 'req00000', captures: [], ...overrides };
}

const layoutOf = (steps: WorkflowStep[]) => buildWorkflowGraphLayout(mkWorkflow(steps), METRICS);

function nodeOf(nodes: GraphNode[], id: string): GraphNode {
  const node = nodes.find((each) => each.step.id === id);
  if (node === undefined) throw new Error(`no node ${id}`);
  return node;
}

describe('buildWorkflowGraphLayout', () => {
  it('linear chain: one node per layer, each under the last, full edge chain', () => {
    const layout = layoutOf([mkStep('a'), mkStep('b'), mkStep('c')]);
    expect(layout.nodes.map((n) => n.layer)).toEqual([0, 1, 2]);
    expect(layout.nodes.map((n) => n.x)).toEqual([0, 0, 0]);
    expect(layout.edges).toEqual([
      { from: 'a', to: 'b', lanes: [] },
      { from: 'b', to: 'c', lanes: [] },
    ]);
    expect(layout.layerCount).toBe(3);
    expect(layout.width).toBe(100);
  });

  it('explicit roots stand side by side in declared order, and their child under the middle of them', () => {
    const layout = layoutOf([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['a', 'b'] })]);
    expect(nodeOf(layout.nodes, 'a')).toMatchObject({ layer: 0, x: 0 });
    expect(nodeOf(layout.nodes, 'b')).toMatchObject({ layer: 0, x: 120 });
    expect(nodeOf(layout.nodes, 'c')).toMatchObject({ layer: 1, x: 60 });
    expect(layout.width).toBe(220);
  });

  it("a step's children spread around its middle, in declared order", () => {
    const layout = layoutOf([
      mkStep('a'),
      mkStep('b', { dependsOn: ['a'] }),
      mkStep('c', { dependsOn: ['a'] }),
      mkStep('d', { dependsOn: ['a'] }),
    ]);
    expect(nodeOf(layout.nodes, 'b').x).toBeCloseTo(0, 5);
    expect(nodeOf(layout.nodes, 'c').x).toBeCloseTo(120, 5);
    expect(nodeOf(layout.nodes, 'd').x).toBeCloseTo(240, 5);
    expect(nodeOf(layout.nodes, 'a').x).toBeCloseTo(120, 5);
    expect(layout.width).toBeCloseTo(340, 5);
  });

  it('fan-in child lands at 1 + max(parent layers); the edge that passes a layer has a lane there', () => {
    const layout = layoutOf([
      mkStep('root'),
      mkStep('deep', { dependsOn: ['root'] }),
      mkStep('shallow', { dependsOn: [] }),
      mkStep('sink', { dependsOn: ['deep', 'shallow'] }),
    ]);
    expect(nodeOf(layout.nodes, 'sink')).toMatchObject({ layer: 2, x: 60 });
    expect(layout.edges).toContainEqual({ from: 'deep', to: 'sink', lanes: [] });
    // Under `shallow`, clear of `deep`.
    expect(layout.edges).toContainEqual({ from: 'shallow', to: 'sink', lanes: [170] });
  });

  it('a lane gives way to a node: the node stays under its parent', () => {
    const layout = layoutOf([mkStep('a'), mkStep('b', { dependsOn: ['a'] }), mkStep('c', { dependsOn: ['a', 'b'] })]);
    expect(nodeOf(layout.nodes, 'a').x).toBeCloseTo(0, 3);
    expect(nodeOf(layout.nodes, 'b').x).toBeCloseTo(0, 3);
    expect(nodeOf(layout.nodes, 'c').x).toBeCloseTo(0, 3);
    const passing = layout.edges.find((edge) => edge.from === 'a' && edge.to === 'c');
    // Half the node, the gap, half the lane: beside `b`, not under it.
    expect(passing?.lanes).toHaveLength(1);
    expect(passing?.lanes[0]).toBeCloseTo(125, 3);
  });

  it('does not clamp deep chains', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `s${i}`);
    const layout = layoutOf(ids.map((id) => mkStep(id)));
    expect(layout.nodes[13].layer).toBe(13);
    expect(layout.layerCount).toBe(14);
  });

  it('drops edges to unknown stepIds but keeps the node', () => {
    const layout = layoutOf([mkStep('a'), mkStep('b', { dependsOn: ['ghost'] })]);
    expect(layout.edges).toEqual([]);
    const b = nodeOf(layout.nodes, 'b');
    expect(b.layer).toBe(1);
    expect(b.parents).toEqual(['ghost']);
  });

  it('cycles degrade to layer 0 without throwing', () => {
    const layout = layoutOf([mkStep('a', { dependsOn: ['b'] }), mkStep('b', { dependsOn: ['a'] })]);
    expect(layout.nodes[0].layer).toBe(1); // b unseen at a's turn → depth 0 → a = 1
    expect(layout.edges).toContainEqual({ from: 'b', to: 'a', lanes: [] });
    expect(layout.edges).toContainEqual({ from: 'a', to: 'b', lanes: [] });
  });

  it('an empty workflow has nothing to place', () => {
    expect(layoutOf([])).toEqual({ nodes: [], edges: [], layerCount: 0, width: 0 });
  });

  it('is deterministic for a given workflow', () => {
    const steps = [
      mkStep('a'),
      mkStep('b', { dependsOn: ['a'] }),
      mkStep('c', { dependsOn: [] }),
      mkStep('d', { dependsOn: ['b', 'c'] }),
    ];
    const one = layoutOf(steps);
    const two = layoutOf(steps);
    expect(two.nodes.map((n) => ({ id: n.step.id, layer: n.layer, x: n.x }))).toEqual(
      one.nodes.map((n) => ({ id: n.step.id, layer: n.layer, x: n.x })),
    );
    expect(two.edges).toEqual(one.edges);
  });
});
