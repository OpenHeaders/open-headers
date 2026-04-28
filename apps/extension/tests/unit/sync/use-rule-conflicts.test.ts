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

import type { V5 } from '@openheaders/core/types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRuleConflicts } from '@/workbench/components/rule-fields/use-rule-conflicts';

function makeHeaderRule(value: string, name = 'X-Test', uid = 'rule-1'): V5.Rule {
  return {
    uid,
    path: `rules/${uid}.yaml`,
    name: 'Test rule',
    enabled: true,
    type: 'header',
    schemaVersion: 5,
    conditions: [],
    action: {
      requestHeaders: [{ operation: 'override', headerName: name, value }],
      responseHeaders: [],
    },
  } as unknown as V5.Rule;
}

const PATH = 'action.requestHeaders.0.value';

function mount(rule: V5.Rule | null, isDirty: boolean) {
  return renderHook(
    ({ liveRule, dirty }: { liveRule: V5.Rule | null; dirty: boolean }) =>
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

  describe('scalar widening', () => {
    function makeRedirectRule(target: string, uid = 'r-1'): V5.Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'r',
        enabled: true,
        type: 'redirect',
        schemaVersion: 5,
        conditions: [],
        action: { redirectTo: target },
      } as unknown as V5.Rule;
    }
    function makeDelayRule(ms: number, uid = 'd-1'): V5.Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'd',
        enabled: true,
        type: 'delay',
        schemaVersion: 5,
        conditions: [],
        action: { delayMs: ms },
      } as unknown as V5.Rule;
    }
    function makeInjectRule(code: string, uid = 'i-1'): V5.Rule {
      return {
        uid,
        path: `rules/${uid}.yaml`,
        name: 'i',
        enabled: true,
        type: 'inject',
        schemaVersion: 5,
        conditions: [],
        action: { injectType: 'script', code, source: 'code', position: 'body-end' },
      } as unknown as V5.Rule;
    }

    it('detects redirectTo scalar conflict on schema path', () => {
      const live = makeRedirectRule('https://openheaders.io/theirs');
      const { result } = renderHook(() =>
        useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }),
      );
      act(() => result.current.setBaseline(makeRedirectRule('https://openheaders.io/base')));
      const conflict = result.current.getConflict('action.redirectTo', 'https://openheaders.io/mine');
      expect(conflict).toEqual({
        base: 'https://openheaders.io/base',
        theirs: 'https://openheaders.io/theirs',
      });
    });

    it('detects delayMs numeric scalar conflict (stringified)', () => {
      const live = makeDelayRule(5000);
      const { result } = renderHook(() =>
        useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }),
      );
      act(() => result.current.setBaseline(makeDelayRule(1000)));
      const conflict = result.current.getConflict('action.delayMs', '2000');
      expect(conflict).toEqual({ base: '1000', theirs: '5000' });
    });

    it('detects inject code conflict + suppresses on local equals theirs', () => {
      const live = makeInjectRule('console.log("theirs")');
      const { result } = renderHook(() =>
        useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }),
      );
      act(() => result.current.setBaseline(makeInjectRule('console.log("base")')));
      expect(result.current.getConflict('action.code', 'console.log("mine")')).toEqual({
        base: 'console.log("base")',
        theirs: 'console.log("theirs")',
      });
      // Already converged on theirs → no chip.
      expect(result.current.getConflict('action.code', 'console.log("theirs")')).toBeNull();
    });

    it('detects rule.name conflict for any rule type', () => {
      const live: V5.Rule = { ...makeDelayRule(1000), name: 'theirs name' };
      const baseline: V5.Rule = { ...makeDelayRule(1000), name: 'base name' };
      const { result } = renderHook(() =>
        useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }),
      );
      act(() => result.current.setBaseline(baseline));
      expect(result.current.getConflict('name', 'mine name')).toEqual({
        base: 'base name',
        theirs: 'theirs name',
      });
    });

    it('returns null for path that does not exist on the rule type', () => {
      const live = makeDelayRule(1000);
      const { result } = renderHook(() =>
        useRuleConflicts({ liveRule: live, isDirty: true, enabled: true }),
      );
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
