/**
 * Pure-function tests for `buildDependencyRows`. Covers:
 *
 *   - Linear chain (no explicit dependsOn) produces monotonically
 *     increasing indent under the implicit prior-step dep rule.
 *   - Explicit root (`dependsOn: []`) forces indent back to 0 even
 *     when declared in position 2+.
 *   - Fan-in (two parents) keeps the child at 1 + max(parent depths).
 *   - `reachable` set matches the core validator's transitive-ancestor
 *     output so the editor's dropdowns filter identically.
 *   - MAX_INDENT cap prevents deep chains from pushing steps off-screen.
 */

import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { buildDependencyRows, MAX_INDENT } from '@/workbench/components/live/dependencies-view';

function mkWorkflow(steps: V5.WorkflowStep[]): V5.LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfabcdef',
    path: 'live-workflows/test-wfabcdef',
    name: 'test',
    steps: steps as V5.LiveWorkflow['steps'],
    refresh: { kind: 'manual' },
    enabled: true,
  };
}

function mkStep(id: string, overrides: Partial<V5.WorkflowStep> = {}): V5.WorkflowStep {
  return { uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`, id, requestUid: 'req00000', captures: [], ...overrides };
}

describe('buildDependencyRows', () => {
  it('linear chain with no explicit dependsOn indents monotonically', () => {
    const wf = mkWorkflow([mkStep('a'), mkStep('b'), mkStep('c')]);
    const rows = buildDependencyRows(wf);
    expect(rows.map((r) => r.indent)).toEqual([0, 1, 2]);
    expect(rows[1].parents).toEqual(['a']);
    expect(rows[2].parents).toEqual(['b']);
  });

  it('explicit `dependsOn: []` re-roots a step', () => {
    const wf = mkWorkflow([
      mkStep('a'),
      mkStep('b', { dependsOn: [] }), // explicit root, not a child of a
      mkStep('c', { dependsOn: ['b'] }),
    ]);
    const rows = buildDependencyRows(wf);
    expect(rows[0].indent).toBe(0);
    expect(rows[1].indent).toBe(0);
    expect(rows[2].indent).toBe(1);
    expect(rows[1].parents).toEqual([]);
  });

  it('fan-in: child with two parents indents to 1 + max(parent depths)', () => {
    const wf = mkWorkflow([
      mkStep('root'),
      mkStep('deep', { dependsOn: ['root'] }), // indent 1
      mkStep('shallow', { dependsOn: [] }), // indent 0 (explicit root)
      mkStep('sink', { dependsOn: ['deep', 'shallow'] }), // indent = 1 + max(1, 0) = 2
    ]);
    const rows = buildDependencyRows(wf);
    const sink = rows.find((r) => r.step.id === 'sink')!;
    expect(sink.indent).toBe(2);
    expect(sink.parents.sort()).toEqual(['deep', 'shallow']);
  });

  it('exposes the transitive ancestors on each row', () => {
    const wf = mkWorkflow([mkStep('a'), mkStep('b', { dependsOn: ['a'] }), mkStep('c', { dependsOn: ['b'] })]);
    const rows = buildDependencyRows(wf);
    const c = rows.find((r) => r.step.id === 'c')!;
    expect(Array.from(c.reachable).sort()).toEqual(['a', 'b']);
  });

  it('caps indent at MAX_INDENT', () => {
    const ids = Array.from({ length: MAX_INDENT + 5 }, (_, i) => `s${i}`);
    const wf = mkWorkflow(ids.map((id) => mkStep(id)));
    const rows = buildDependencyRows(wf);
    const last = rows[rows.length - 1];
    expect(last.indent).toBe(MAX_INDENT);
  });
});
