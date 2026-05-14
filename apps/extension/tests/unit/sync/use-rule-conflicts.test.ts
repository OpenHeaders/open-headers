/**
 * Coverage for {@link useRuleConflicts} (Phase A A4) — the per-path
 * conflict tracker behind RuleEditor's inline diff chip. The tests pin
 * the three-way base/local/theirs invariants the chip relies on:
 *   - no conflict when local equals base (user hasn't edited),
 *   - no conflict when local equals theirs (already converged),
 *   - no conflict when theirs equals base (no external change),
 *   - dismiss + acceptTheirs both suppress further conflict surfacing,
 *   - new baselines (e.g. on populateFormFromRule) clear dismissed state.
 */

import type { Rule } from '@openheaders/core/types';
import { useRuleConflicts } from '@openheaders/ui/workbench/components/rule-fields/use-rule-conflicts';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function makeHeaderRule(value: string, name = 'X-Test', uid = 'rule-1'): Rule {
  return {
    uid,
    path: `rules/${uid}.yaml`,
    name: 'Test rule',
    enabled: true,
    type: 'header',
    schemaVersion: 5,
    conditions: [],
    action: {
      requestHeaders: [{ uid: 'thm00097', operation: 'override', headerName: name, value }],
      responseHeaders: [],
    },
  } as unknown as Rule;
}

// Path is itemId-keyed (`action.requestHeaders.<uid>.value`) so reorders
// don't churn the conflict baseline. The fixture uid `thm00097` is the
// canonical identity for the row across base + theirs snapshots.
const PATH = 'action.requestHeaders.thm00097.value';

function mount(rule: Rule | null, isDirty: boolean) {
  return renderHook(
    ({ liveRule, dirty }: { liveRule: Rule | null; dirty: boolean }) =>
      useRuleConflicts({ liveRule, isDirty: dirty, enabled: true }),
    { initialProps: { liveRule: rule, dirty: isDirty } },
  );
}

describe('useRuleConflicts', () => {
  it('returns null when not dirty', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, false);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    expect(result.current.getConflict(PATH, 'mine')).toBeNull();
  });

  it('returns null when local equals base (no local edit)', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    expect(result.current.getConflict(PATH, 'base')).toBeNull();
  });

  it('returns null when local equals theirs', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    expect(result.current.getConflict(PATH, 'theirs')).toBeNull();
  });

  it('returns null when theirs equals base (no external change at path)', () => {
    const live = makeHeaderRule('base');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    expect(result.current.getConflict(PATH, 'mine')).toBeNull();
  });

  it('surfaces a conflict when local + theirs both differ from base', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    const conflict = result.current.getConflict(PATH, 'mine');
    expect(conflict).toEqual({ base: 'base', theirs: 'theirs' });
  });

  it('dismiss suppresses the chip until clearDismissed', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    act(() => result.current.dismiss(PATH));
    expect(result.current.getConflict(PATH, 'mine')).toBeNull();
    act(() => result.current.clearDismissed());
    expect(result.current.getConflict(PATH, 'mine')).not.toBeNull();
  });

  it('acceptTheirs dismisses + raises baseline so further changes vs new baseline still show', () => {
    const live = makeHeaderRule('theirs');
    const { result } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    act(() => result.current.acceptTheirs(PATH, 'theirs'));
    // Local now equals theirs (caller wrote it into the form). No conflict.
    expect(result.current.getConflict(PATH, 'theirs')).toBeNull();
  });

  describe('reorder auto-rebase', () => {
    function ruleWithThreeHeaders(order: readonly string[], values?: Record<string, string>): Rule {
      return {
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
        name: 'r',
        enabled: true,
        type: 'header',
        schemaVersion: 5,
        conditions: [],
        action: {
          requestHeaders: order.map((uid) => ({
            uid,
            operation: 'override',
            headerName: `X-${uid.toUpperCase()}`,
            value: values?.[uid] ?? `v-${uid}`,
          })),
          responseHeaders: [],
        },
      } as unknown as Rule;
    }

    it('emits an auto-rebase savedOrder when form-order matches baseline + live diverged', () => {
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      const auto = result.current.getAutoMergeableSetOrders({}, formOrders);
      expect([...(auto.get('action.requestHeaders') ?? [])]).toEqual(['a0000001', 'c0000003', 'b0000002']);
    });

    it('skips the auto-rebase when my form-order also diverged from baseline (real conflict, dialog territory)', () => {
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const formOrders = new Map([['action.requestHeaders', ['b0000002', 'a0000001', 'c0000003'] as const]]);
      expect(result.current.getAutoMergeableSetOrders({}, formOrders).size).toBe(0);
    });

    it('skips the auto-rebase when membership differs (delete + reorder; falls through to dialog territory)', () => {
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002'] as const]]);
      expect(result.current.getAutoMergeableSetOrders({}, formOrders).size).toBe(0);
    });

    it('skips the rebase on order-sensitive sets when ANY leaf in that set is locally dirty', () => {
      // Header rules are order-sensitive (DNR last-write-wins on same name).
      // Tab 2 has C.value mid-edit; Tab 1 reorders. Even though my form-order
      // matches baseline, the rebase must NOT silently fire — silent
      // reorder-under-an-edit changes by-position semantics. Falls through
      // to the dialog's set-reorder row.
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002'], { c0000003: 'v-c' });
      const { result } = mount(live, true);
      act(() =>
        result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: 'v-c' })),
      );
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      // Local form has C.value=modified — leaf-dirty in the set.
      const form = {
        'action.requestHeaders.a0000001.headerName': 'X-A0000001',
        'action.requestHeaders.a0000001.value': 'v-a0000001',
        'action.requestHeaders.a0000001.operation': 'override',
        'action.requestHeaders.a0000001.mergeSeparator': '',
        'action.requestHeaders.b0000002.headerName': 'X-B0000002',
        'action.requestHeaders.b0000002.value': 'v-b0000002',
        'action.requestHeaders.b0000002.operation': 'override',
        'action.requestHeaders.b0000002.mergeSeparator': '',
        'action.requestHeaders.c0000003.headerName': 'X-C0000003',
        'action.requestHeaders.c0000003.value': 'modified-locally',
        'action.requestHeaders.c0000003.operation': 'override',
        'action.requestHeaders.c0000003.mergeSeparator': '',
      };
      expect(result.current.getAutoMergeableSetOrders(form, formOrders).size).toBe(0);
    });

    it('acceptTheirsSetOrder advances the per-set baseline so the next peer reorder rebases off the new state', () => {
      const live1 = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002']);
      const { result, rerender } = mount(live1, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      // Apply the first auto-rebase to a fresh form order matching live1.
      act(() => result.current.acceptTheirsSetOrder('action.requestHeaders', ['a0000001', 'c0000003', 'b0000002']));
      // Peer reorders again. Form still matches the previously-accepted live1 order.
      const live2 = ruleWithThreeHeaders(['c0000003', 'a0000001', 'b0000002']);
      rerender({ liveRule: live2, dirty: true });
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'c0000003', 'b0000002'] as const]]);
      const auto = result.current.getAutoMergeableSetOrders({}, formOrders);
      expect([...(auto.get('action.requestHeaders') ?? [])]).toEqual(['c0000003', 'a0000001', 'b0000002']);
    });

    it('getAllConflicts does NOT emit set-reorder when peer order matches baseline (only I reordered locally)', () => {
      // Tab 2 dragged a row locally; peer hasn't reordered since baseline.
      // Live order == baseline order → no peer divergence → no conflict.
      // (User has a pending unsaved reorder, but that's not a CONFLICT.)
      const live = ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const form = result.current.projectRule({
        ...ruleWithThreeHeaders(['c0000003', 'a0000001', 'b0000002']),
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
      } as Rule);
      const formOrders = new Map([['action.requestHeaders', ['c0000003', 'a0000001', 'b0000002'] as const]]);
      const all = result.current.getAllConflicts(form, formOrders);
      expect(all.has('reorder:action.requestHeaders')).toBe(false);
    });

    it('getAllConflicts emits set-reorder when both sides diverged from baseline (real conflict)', () => {
      // Peer saved a reorder; I dragged into a different order locally.
      // baseline=[a,b,c], live=[b,c,a], form=[c,a,b] → both diverged → conflict.
      const live = ruleWithThreeHeaders(['b0000002', 'c0000003', 'a0000001']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const form = result.current.projectRule({
        ...ruleWithThreeHeaders(['c0000003', 'a0000001', 'b0000002']),
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
      } as Rule);
      const formOrders = new Map([['action.requestHeaders', ['c0000003', 'a0000001', 'b0000002'] as const]]);
      const all = result.current.getAllConflicts(form, formOrders);
      expect(all.has('reorder:action.requestHeaders')).toBe(true);
    });

    it('surfaces local-only leaf edits in the dialog when a set-reorder fires for the same set', () => {
      // Peer reordered (live=[a,c,b]); I haven't reordered (form=[a,b,c])
      // but I edited C.value locally to "4" (peer kept "3"). The dialog
      // shows the reorder PLUS a row for the value drift so the user
      // sees both changes side-by-side, not just the order change.
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002'], { c0000003: '3' });
      const { result } = mount(live, true);
      act(() =>
        result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '3' })),
      );
      const form = result.current.projectRule({
        ...ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '4' }),
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
      } as Rule);
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      const all = result.current.getAllConflicts(form, formOrders);
      expect(all.has('reorder:action.requestHeaders')).toBe(true);
      const valueConflict = all.get('action.requestHeaders.c0000003.value');
      expect(valueConflict).toBeDefined();
      expect(valueConflict?.base).toBe('3');
      expect(valueConflict?.theirs).toBe('3');
    });

    it('does NOT surface local-only leaf edits when no set-reorder fires (normal editing case)', () => {
      // Same form-vs-baseline divergence on a leaf, but no peer reorder
      // and no peer leaf change → strict per-leaf check returns null
      // and the soft-leaf walk only runs when a set-reorder gates it.
      const live = ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '3' });
      const { result } = mount(live, true);
      act(() =>
        result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '3' })),
      );
      const form = result.current.projectRule({
        ...ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '4' }),
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
      } as Rule);
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      const all = result.current.getAllConflicts(form, formOrders);
      expect(all.has('reorder:action.requestHeaders')).toBe(false);
      expect(all.has('action.requestHeaders.c0000003.value')).toBe(false);
    });

    it('getAllConflicts emits set-reorder when peer reordered + I have an in-set leaf edit (user-reported scenario)', () => {
      // Tab 2: edit C.value to "4", don't save.
      // Tab 1: drag row 3 to row 2, save → live becomes [a,c,b].
      // Tab 2 must surface a set-reorder conflict (silent rebase is suppressed
      // by the order-sensitive guard so the user explicitly resolves).
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002'], { c0000003: '3' });
      const { result } = mount(live, true);
      act(() =>
        result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '3' })),
      );
      // Project Tab 2's form (still in baseline order [a,b,c], with C.value='4').
      const form = result.current.projectRule({
        ...ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'], { c0000003: '4' }),
        uid: 'rule-1',
        path: 'rules/rule-1.yaml',
      } as Rule);
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      const all = result.current.getAllConflicts(form, formOrders);
      expect(all.has('reorder:action.requestHeaders')).toBe(true);
      const reorder = all.get('reorder:action.requestHeaders');
      expect(reorder?.kind).toBe('set-reorder');
    });

    it('rebases silently on order-sensitive sets when no leaf in the set is dirty (untouched user case)', () => {
      const live = ruleWithThreeHeaders(['a0000001', 'c0000003', 'b0000002']);
      const { result } = mount(live, true);
      act(() => result.current.setBaseline(ruleWithThreeHeaders(['a0000001', 'b0000002', 'c0000003'])));
      const formOrders = new Map([['action.requestHeaders', ['a0000001', 'b0000002', 'c0000003'] as const]]);
      // Form matches baseline at every leaf — no in-set edits.
      const form = {
        'action.requestHeaders.a0000001.headerName': 'X-A0000001',
        'action.requestHeaders.a0000001.value': 'v-a0000001',
        'action.requestHeaders.a0000001.operation': 'override',
        'action.requestHeaders.a0000001.mergeSeparator': '',
        'action.requestHeaders.b0000002.headerName': 'X-B0000002',
        'action.requestHeaders.b0000002.value': 'v-b0000002',
        'action.requestHeaders.b0000002.operation': 'override',
        'action.requestHeaders.b0000002.mergeSeparator': '',
        'action.requestHeaders.c0000003.headerName': 'X-C0000003',
        'action.requestHeaders.c0000003.value': 'v-c0000003',
        'action.requestHeaders.c0000003.operation': 'override',
        'action.requestHeaders.c0000003.mergeSeparator': '',
      };
      const auto = result.current.getAutoMergeableSetOrders(form, formOrders);
      expect([...(auto.get('action.requestHeaders') ?? [])]).toEqual(['a0000001', 'c0000003', 'b0000002']);
    });
  });

  describe('scalar widening', () => {
    function makeRedirectRule(target: string, uid = 'r-1'): Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'r',
        enabled: true,
        type: 'redirect',
        schemaVersion: 5,
        conditions: [],
        action: { redirectTo: target },
      } as unknown as Rule;
    }
    function makeDelayRule(ms: number, uid = 'd-1'): Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'd',
        enabled: true,
        type: 'delay',
        schemaVersion: 5,
        conditions: [],
        action: { delayMs: ms },
      } as unknown as Rule;
    }
    function makeInjectRule(code: string, uid = 'i-1'): Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'i',
        enabled: true,
        type: 'inject',
        schemaVersion: 5,
        conditions: [],
        action: { injectType: 'script', code, source: 'code', position: 'body-end' },
      } as unknown as Rule;
    }

    it('detects redirectTo scalar conflict on schema path', () => {
      const live = makeRedirectRule('https://openheaders.io/theirs');
      const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
      act(() => result.current.setBaseline(makeRedirectRule('https://openheaders.io/base')));
      const conflict = result.current.getConflict('action.redirectTo', 'https://openheaders.io/mine');
      expect(conflict).toEqual({
        base: 'https://openheaders.io/base',
        theirs: 'https://openheaders.io/theirs',
      });
    });

    it('detects delayMs numeric scalar conflict (stringified)', () => {
      const live = makeDelayRule(5000);
      const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
      act(() => result.current.setBaseline(makeDelayRule(1000)));
      const conflict = result.current.getConflict('action.delayMs', '2000');
      expect(conflict).toEqual({ base: '1000', theirs: '5000' });
    });

    it('detects inject code conflict + suppresses on local equals theirs', () => {
      const live = makeInjectRule('console.log("theirs")');
      const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
      act(() => result.current.setBaseline(makeInjectRule('console.log("base")')));
      expect(result.current.getConflict('action.code', 'console.log("mine")')).toEqual({
        base: 'console.log("base")',
        theirs: 'console.log("theirs")',
      });
      // Already converged on theirs → no chip.
      expect(result.current.getConflict('action.code', 'console.log("theirs")')).toBeNull();
    });

    it('detects rule.name conflict for any rule type', () => {
      const live: Rule = { ...makeDelayRule(1000), name: 'theirs name' };
      const baseline: Rule = { ...makeDelayRule(1000), name: 'base name' };
      const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
      act(() => result.current.setBaseline(baseline));
      expect(result.current.getConflict('name', 'mine name')).toEqual({
        base: 'base name',
        theirs: 'theirs name',
      });
    });

    it('returns null for path that does not exist on the rule type', () => {
      const live = makeDelayRule(1000);
      const { result } = renderHook(() => useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }));
      act(() => result.current.setBaseline(makeDelayRule(1000)));
      // delay rule has no `redirectTo`.
      expect(result.current.getConflict('action.redirectTo', 'mine')).toBeNull();
    });
  });

  it('setBaseline clears dismissed state', () => {
    const live = makeHeaderRule('theirs');
    const { result, rerender } = mount(live, true);
    act(() => result.current.setBaseline(makeHeaderRule('base')));
    act(() => result.current.dismiss(PATH));
    expect(result.current.getConflict(PATH, 'mine')).toBeNull();
    // Rebaseline simulates a clean populateFormFromRule pass.
    act(() => result.current.setBaseline(makeHeaderRule('base2')));
    rerender({ liveRule: makeHeaderRule('theirs2'), dirty: true });
    expect(result.current.getConflict(PATH, 'mine2')).toEqual({ base: 'base2', theirs: 'theirs2' });
  });
});
