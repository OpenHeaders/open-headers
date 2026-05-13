/**
 * Per-field save merge for rule editors.
 *
 * Save is the only broadcast (rules intercept live HTTP traffic — no
 * per-keystroke streaming). The merge guarantees that two tabs editing
 * different leaves of the same entity both land without false conflicts.
 */

import type { HeaderModification, HeaderRule, RedirectRule, Rule } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import {
  mergeRowsByUid,
  mergeRuleForSave,
  mergeScalarLeaves,
} from '@/workbench/components/rule-fields/merge-rule-for-save';

const headerRule = (
  reqHeaders: HeaderModification[],
  resHeaders: HeaderModification[] = [],
): HeaderRule => ({
  schemaVersion: 5,
  uid: 'rule-uid',
  path: 'collection/rule.headerrule',
  name: 'Test',
  type: 'header',
  enabled: true,
  conditions: [
    {
      uid: 'cond-uid',
      type: 'request-domains',
      values: ['openheaders.io'],
    },
  ],
  action: { requestHeaders: reqHeaders, responseHeaders: resHeaders },
});

const hmod = (uid: string, headerName: string, value: string): HeaderModification => ({
  uid,
  operation: 'override',
  headerName,
  value,
});

describe('mergeRowsByUid', () => {
  it('uses live for rows the user did not touch', () => {
    const baseline = [hmod('a', 'x-debug-1', '1'), hmod('b', 'x-debug-2', '2')];
    const live = [hmod('a', 'x-debug-1', '01'), hmod('b', 'x-debug-2', '2')];
    const form = [hmod('a', 'x-debug-1', '1'), hmod('b', 'x-debug-2', '02')];
    const result = mergeRowsByUid(form, baseline, live);
    expect(result).toEqual([hmod('a', 'x-debug-1', '01'), hmod('b', 'x-debug-2', '02')]);
  });

  it('per-leaf LWW within a row when each tab edited a different leaf', () => {
    const baseline = [hmod('a', 'old-name', 'old-value')];
    const live = [hmod('a', 'new-name', 'old-value')]; // peer edited headerName
    const form = [hmod('a', 'old-name', 'new-value')]; // we edited value
    const result = mergeRowsByUid(form, baseline, live);
    expect(result).toEqual([hmod('a', 'new-name', 'new-value')]);
  });

  it('keeps locally added rows', () => {
    const baseline: HeaderModification[] = [];
    const live: HeaderModification[] = [];
    const form = [hmod('new', 'x-new', '42')];
    expect(mergeRowsByUid(form, baseline, live)).toEqual(form);
  });

  it('preserves peer-added rows we never saw', () => {
    const baseline: HeaderModification[] = [];
    const live = [hmod('peer', 'x-peer', '7')];
    const form: HeaderModification[] = [];
    expect(mergeRowsByUid(form, baseline, live)).toEqual(live);
  });

  it('drops rows the user removed locally', () => {
    const baseline = [hmod('a', 'h', 'v')];
    const live = [hmod('a', 'h', 'v')];
    const form: HeaderModification[] = [];
    expect(mergeRowsByUid(form, baseline, live)).toEqual([]);
  });

  it('peer-deleted untouched row drops (delete-wins)', () => {
    const baseline = [hmod('a', 'h', 'v')];
    const live: HeaderModification[] = [];
    const form = [hmod('a', 'h', 'v')];
    expect(mergeRowsByUid(form, baseline, live)).toEqual([]);
  });

  it('peer-deleted row with local edits resurrects with our edits', () => {
    const baseline = [hmod('a', 'h', 'v')];
    const live: HeaderModification[] = [];
    const form = [hmod('a', 'h', 'edited')];
    expect(mergeRowsByUid(form, baseline, live)).toEqual([hmod('a', 'h', 'edited')]);
  });
});

describe('mergeScalarLeaves', () => {
  it('adopts live for untouched leaves', () => {
    expect(mergeScalarLeaves({ a: 1, b: 2 }, { a: 1, b: 2 }, { a: 99, b: 2 })).toEqual({ a: 99, b: 2 });
  });
  it('keeps form value for touched leaves', () => {
    expect(mergeScalarLeaves({ a: 1, b: 5 }, { a: 1, b: 2 }, { a: 99, b: 2 })).toEqual({ a: 99, b: 5 });
  });
  it('preserves peer-added keys we never saw', () => {
    expect(mergeScalarLeaves({ a: 1 }, { a: 1 }, { a: 1, peer: 'new' })).toEqual({ a: 1, peer: 'new' });
  });
});

describe('mergeRuleForSave — header rule', () => {
  it('the screenshot scenario: each tab edited a different row', () => {
    const baseline = headerRule([hmod('h1', 'x-debug-1', '1'), hmod('h2', 'x-debug-2', '2')]);
    // Tab A's save lands first → live now has x-debug-1=01.
    const live: Rule = headerRule([hmod('h1', 'x-debug-1', '01'), hmod('h2', 'x-debug-2', '2')]);
    // Tab B's form: untouched x-debug-1, edited x-debug-2.
    const form = {
      name: baseline.name,
      enabled: baseline.enabled,
      type: 'header' as const,
      conditions: baseline.conditions,
      action: { requestHeaders: [hmod('h1', 'x-debug-1', '1'), hmod('h2', 'x-debug-2', '02')], responseHeaders: [] },
    };
    const merged = mergeRuleForSave(form, baseline, live) as typeof form;
    expect(merged.action.requestHeaders).toEqual([hmod('h1', 'x-debug-1', '01'), hmod('h2', 'x-debug-2', '02')]);
  });

  it('falls back to form when baseline/live are missing', () => {
    const form = {
      name: 'r',
      enabled: true,
      type: 'header' as const,
      conditions: [],
      action: { requestHeaders: [hmod('h', 'x', '1')], responseHeaders: [] },
    };
    expect(mergeRuleForSave(form, null, null)).toBe(form);
  });

  it('falls back to form when rule type disagrees (defensive)', () => {
    const form = {
      name: 'r',
      enabled: true,
      type: 'header' as const,
      conditions: [],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    const live = headerRule([]);
    const baseline = { ...live, type: 'redirect' as const, action: { redirectTo: '' } } as unknown as Rule;
    expect(mergeRuleForSave(form, baseline, live)).toBe(form);
  });
});

describe('mergeRuleForSave — redirect (scalar action)', () => {
  const redirectRule = (target: string): RedirectRule => ({
    schemaVersion: 5,
    uid: 'r',
    path: 'p/r.redirectrule',
    name: 'r',
    type: 'redirect',
    enabled: true,
    conditions: [],
    action: { redirectTo: target },
  });

  it('untouched leaf adopts live', () => {
    const baseline = redirectRule('https://old.example');
    const live = redirectRule('https://peer-edited.example');
    const form = {
      name: 'r',
      enabled: true,
      type: 'redirect' as const,
      conditions: [],
      action: { redirectTo: 'https://old.example' },
    };
    const merged = mergeRuleForSave(form, baseline, live) as typeof form;
    expect(merged.action.redirectTo).toBe('https://peer-edited.example');
  });
});
