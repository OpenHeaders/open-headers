/**
 * Pure-function tests for `buildWorkflowGraphLayout`. Covers:
 *
 *   - Linear chain (implicit prior-step deps) stacks one node per
 *     layer with a full edge chain.
 *   - Explicit roots share layer 0 and take slots in declared order.
 *   - Fan-in child lands at 1 + max(parent layers), unclamped past the
 *     indented tree's MAX_INDENT.
 *   - Edges to unknown stepIds are dropped; the node still lays out.
 *   - Cycles degrade to layer 0 without throwing (validator's job).
 *   - Determinism: same workflow → identical layout.
 */

import type { LiveWorkflow, WorkflowStep } from '@openheaders/core/types';
import { buildWorkflowGraphLayout } from '@openheaders/ui/workbench/components/live/graph-layout';
import { describe, expect, it } from 'vitest';

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

describe('buildWorkflowGraphLayout', () => {
  it('linear chain: one node per layer, full edge chain', () => {
    const layout = buildWorkflowGraphLayout(mkWorkflow([mkStep('a'), mkStep('b'), mkStep('c')]));
    expect(layout.nodes.map((n) => n.layer)).toEqual([0, 1, 2]);
    expect(layout.nodes.map((n) => n.slot)).toEqual([0, 0, 0]);
    expect(layout.edges).toEqual([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);
    expect(layout.layerCount).toBe(3);
    expect(layout.maxSlots).toBe(1);
  });

  it('explicit roots share layer 0 with slots in declared order', () => {
    const layout = buildWorkflowGraphLayout(
      mkWorkflow([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['a', 'b'] })]),
    );
    const byId = new Map(layout.nodes.map((n) => [n.step.id, n]));
    expect(byId.get('a')).toMatchObject({ layer: 0, slot: 0 });
    expect(byId.get('b')).toMatchObject({ layer: 0, slot: 1 });
    expect(byId.get('c')).toMatchObject({ layer: 1, slot: 0 });
    expect(layout.maxSlots).toBe(2);
  });

  it('fan-in child lands at 1 + max(parent layers)', () => {
    const layout = buildWorkflowGraphLayout(
      mkWorkflow([
        mkStep('root'),
        mkStep('deep', { dependsOn: ['root'] }),
        mkStep('shallow', { dependsOn: [] }),
        mkStep('sink', { dependsOn: ['deep', 'shallow'] }),
      ]),
    );
    const sink = layout.nodes.find((n) => n.step.id === 'sink');
    expect(sink?.layer).toBe(2);
    expect(layout.edges).toContainEqual({ from: 'deep', to: 'sink' });
    expect(layout.edges).toContainEqual({ from: 'shallow', to: 'sink' });
  });

  it('does not clamp deep chains', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `s${i}`);
    const layout = buildWorkflowGraphLayout(mkWorkflow(ids.map((id) => mkStep(id))));
    expect(layout.nodes[13].layer).toBe(13);
    expect(layout.layerCount).toBe(14);
  });

  it('drops edges to unknown stepIds but keeps the node', () => {
    const layout = buildWorkflowGraphLayout(mkWorkflow([mkStep('a'), mkStep('b', { dependsOn: ['ghost'] })]));
    expect(layout.edges).toEqual([]);
    const b = layout.nodes.find((n) => n.step.id === 'b');
    expect(b?.layer).toBe(1);
    expect(b?.parents).toEqual(['ghost']);
  });

  it('cycles degrade to layer 0 without throwing', () => {
    const layout = buildWorkflowGraphLayout(
      mkWorkflow([mkStep('a', { dependsOn: ['b'] }), mkStep('b', { dependsOn: ['a'] })]),
    );
    expect(layout.nodes[0].layer).toBe(1); // b unseen at a's turn → depth 0 → a = 1
    expect(layout.edges).toContainEqual({ from: 'b', to: 'a' });
    expect(layout.edges).toContainEqual({ from: 'a', to: 'b' });
  });

  it('is deterministic for a given workflow', () => {
    const wf = mkWorkflow([
      mkStep('a'),
      mkStep('b', { dependsOn: ['a'] }),
      mkStep('c', { dependsOn: [] }),
      mkStep('d', { dependsOn: ['b', 'c'] }),
    ]);
    const one = buildWorkflowGraphLayout(wf);
    const two = buildWorkflowGraphLayout(wf);
    expect(two.nodes.map((n) => ({ id: n.step.id, layer: n.layer, slot: n.slot }))).toEqual(
      one.nodes.map((n) => ({ id: n.step.id, layer: n.layer, slot: n.slot })),
    );
    expect(two.edges).toEqual(one.edges);
  });
});
