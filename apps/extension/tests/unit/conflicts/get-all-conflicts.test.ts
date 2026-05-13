/**
 * `useRuleConflicts.getAllConflicts` aggregator coverage.
 *
 * The banner / dialog read the union view through this method; the
 * tests pin that it walks both baseline + form keys, only surfaces
 * paths the per-field `getConflict` would surface, and respects
 * dismissed / accepted state.
 */

import type { Rule } from '@openheaders/core/types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRuleConflicts } from '@/workbench/components/rule-fields/use-rule-conflicts';

function makeHeaderRule(req: Array<{ uid: string; headerName: string; value: string }>): Rule {
  return {
    uid: 'rule-x',
    path: 'rules/rule-x.yaml',
    name: 'Test',
    enabled: true,
    type: 'header',
    schemaVersion: 5,
    conditions: [],
    action: {
      requestHeaders: req.map((h) => ({ uid: h.uid, operation: 'override', headerName: h.headerName, value: h.value })),
      responseHeaders: [],
    },
  } as unknown as Rule;
}

const A_VALUE = 'action.requestHeaders.aaaaaaaa.value';
const B_VALUE = 'action.requestHeaders.bbbbbbbb.value';

describe('useRuleConflicts.getAllConflicts', () => {
  it('returns empty when nothing diverged', () => {
    const live = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'theirs-a' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'theirs-b' },
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(live));
    // form == baseline → no conflicts.
    const formProj = result.current.projectRule(live);
    expect(result.current.getAllConflicts(formProj).size).toBe(0);
  });

  it('aggregates multiple per-row conflicts', () => {
    const baseline = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'base-a' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'base-b' },
    ]);
    const live = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'theirs-a' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'theirs-b' },
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));

    // Local form is mid-edit on both rows; baseline + live diverge from
    // local + each other → both conflicts surface.
    const form: Record<string, string> = {
      ...result.current.projectRule(baseline),
      [A_VALUE]: 'mine-a',
      [B_VALUE]: 'mine-b',
    };
    const all = result.current.getAllConflicts(form);
    expect(all.size).toBe(2);
    expect(all.get(A_VALUE)).toMatchObject({ base: 'base-a', theirs: 'theirs-a' });
    expect(all.get(B_VALUE)).toMatchObject({ base: 'base-b', theirs: 'theirs-b' });
  });

  it('detects set-add (saved version added a row mine doesn’t have)', () => {
    const baseline = makeHeaderRule([{ uid: 'aaaaaaaa', headerName: 'X-A', value: 'v0' }]);
    const live = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'v0' },
      { uid: 'newrow12', headerName: 'X-NEW', value: '7' },
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    const form = result.current.projectRule(baseline);
    const all = result.current.getAllConflicts(form);
    const conflict = all.get('set:action.requestHeaders.newrow12');
    expect(conflict?.kind).toBe('set-add');
    expect(conflict?.theirs).toBe('X-NEW: 7');
    expect(conflict?.rowPayload).toMatchObject({ uid: 'newrow12', headerName: 'X-NEW' });
  });

  it('detects set-reorder when membership matches but order differs', () => {
    const baseline = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: '1' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: '2' },
      { uid: 'cccccccc', headerName: 'X-C', value: '3' },
    ]);
    const live = makeHeaderRule([
      { uid: 'cccccccc', headerName: 'X-C', value: '3' },
      { uid: 'aaaaaaaa', headerName: 'X-A', value: '1' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: '2' },
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    const formProj = result.current.projectRule(baseline);
    // Form has the original (baseline) order; live has a different order.
    const formOrders = new Map<string, string[]>([
      ['action.requestHeaders', ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']],
    ]);
    const all = result.current.getAllConflicts(formProj, formOrders);
    const conflict = all.get('reorder:action.requestHeaders');
    expect(conflict?.kind).toBe('set-reorder');
    expect((conflict?.rowPayload as { savedOrder: string[] }).savedOrder).toEqual([
      'cccccccc',
      'aaaaaaaa',
      'bbbbbbbb',
    ]);
  });

  it('does NOT emit reorder when membership differs (covered by add/remove)', () => {
    const baseline = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: '1' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: '2' },
    ]);
    const live = makeHeaderRule([
      { uid: 'bbbbbbbb', headerName: 'X-B', value: '2' },
      // aaaaaaaa missing → set-remove, not reorder
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    const formProj = result.current.projectRule(baseline);
    const formOrders = new Map<string, string[]>([['action.requestHeaders', ['aaaaaaaa', 'bbbbbbbb']]]);
    const all = result.current.getAllConflicts(formProj, formOrders);
    expect(all.has('reorder:action.requestHeaders')).toBe(false);
    expect(all.has('set:action.requestHeaders.aaaaaaaa')).toBe(true);
  });

  it('detects set-remove (saved version removed a row mine still has)', () => {
    const baseline = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'v0' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'v1' },
    ]);
    const live = makeHeaderRule([{ uid: 'aaaaaaaa', headerName: 'X-A', value: 'v0' }]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    const form = result.current.projectRule(baseline);
    const all = result.current.getAllConflicts(form);
    const conflict = all.get('set:action.requestHeaders.bbbbbbbb');
    expect(conflict?.kind).toBe('set-remove');
    expect(conflict?.base).toBe('X-B: v1');
  });

  it('rule type-change collapses to one union:action conflict + suppresses leaves', () => {
    const baseline = makeHeaderRule([{ uid: 'aaaaaaaa', headerName: 'X-A', value: 'va' }]);
    // Live rule changed type from 'header' to 'redirect' — completely
    // different action shape. Without union-divergence suppression, the
    // baseline's header leaves would surface as conflicts against the
    // missing redirect leaves.
    const live = {
      uid: 'rule-x',
      path: 'rules/rule-x.yaml',
      name: 'Test',
      enabled: true,
      type: 'redirect',
      schemaVersion: 5,
      conditions: [],
      action: { redirectTo: 'https://openheaders.io/x' },
    } as unknown as Rule;
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    const form = result.current.projectRule(baseline);
    const all = result.current.getAllConflicts(form);
    // The structural conflict surfaces.
    expect(all.has('union:action')).toBe(true);
    // No per-leaf header conflicts under the divergent prefix.
    expect(all.has('action.requestHeaders.aaaaaaaa.value')).toBe(false);
    expect(all.has('action.requestHeaders.aaaaaaaa.headerName')).toBe(false);
  });

  it('drops paths the user dismissed', () => {
    const baseline = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'base-a' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'base-b' },
    ]);
    const live = makeHeaderRule([
      { uid: 'aaaaaaaa', headerName: 'X-A', value: 'theirs-a' },
      { uid: 'bbbbbbbb', headerName: 'X-B', value: 'theirs-b' },
    ]);
    const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
    act(() => result.current.setBaseline(baseline));
    act(() => result.current.dismiss(A_VALUE));

    const form: Record<string, string> = {
      ...result.current.projectRule(baseline),
      [A_VALUE]: 'mine-a',
      [B_VALUE]: 'mine-b',
    };
    const all = result.current.getAllConflicts(form);
    expect(all.size).toBe(1);
    expect(all.has(A_VALUE)).toBe(false);
    expect(all.has(B_VALUE)).toBe(true);
  });
});
