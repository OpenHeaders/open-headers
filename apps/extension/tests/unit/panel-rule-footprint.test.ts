/**
 * Headers-tab footprint chip over ALL matched rules — `computeRuleFootprint`.
 *
 * The chip must agree with the Matched Rules panel's population (the
 * row's fire list), not just header-attributed rows: a redirect or
 * delay leaves no header trace, and before this the chip silently
 * under-reported ("1 rule" while two fired).
 */

import type { RedirectRule, Rule } from '@openheaders/core/types';
import type { HeaderFootprint } from '@openheaders/ui/panel/data/headers/header-footprint';
import { computeRuleFootprint, formatRuleFootprint } from '@openheaders/ui/panel/data/rule-footprint';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

function fire(over: Partial<InspectorFire> & { ruleUid: string }): InspectorFire {
  return {
    t: 1,
    pattern: 'https://example.com/',
    authoritative: true,
    evidence: 'confirmed',
    ...over,
  };
}

function emptyHeaderFootprint(over: Partial<HeaderFootprint> = {}): HeaderFootprint {
  return {
    ruleCount: 0,
    ruleUids: new Set(),
    affectedRowCount: 0,
    driftedRowCount: 0,
    addedCount: 0,
    modifiedCount: 0,
    removedCount: 0,
    ruleNames: [],
    ...over,
  };
}

function redirectRule(uid: string, name: string): RedirectRule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/API/${name}`,
    name,
    enabled: true,
    type: 'redirect',
    conditions: [{ uid: 'c1', type: 'url-filter', values: ['https://example.com/'] }],
    action: { redirectTo: 'https://example.org' },
  };
}

describe('computeRuleFootprint', () => {
  it('counts non-header fired rules the header footprint cannot see', () => {
    const rules = new Map<string, Rule>([['R1', redirectRule('R1', 'Redirect example.com')]]);
    const f = computeRuleFootprint({
      fires: [fire({ ruleUid: 'R1' })],
      rulesByUid: rules,
      header: emptyHeaderFootprint(),
    });
    expect(f.ruleCount).toBe(1);
    expect(f.typeCounts).toEqual([['redirect', 1]]);
    expect(f.ruleNames).toEqual(['Redirect example.com']);
    expect(formatRuleFootprint(f)).toBe('1 rule · 1 redirect');
  });

  it('dedupes fires by ruleUid', () => {
    const rules = new Map<string, Rule>([['R1', redirectRule('R1', 'Redirect example.com')]]);
    const f = computeRuleFootprint({
      fires: [fire({ ruleUid: 'R1' }), fire({ ruleUid: 'R1' })],
      rulesByUid: rules,
      header: emptyHeaderFootprint(),
    });
    expect(f.ruleCount).toBe(1);
    expect(f.typeCounts).toEqual([['redirect', 1]]);
  });

  it('falls back to the fire snapshot when the rule was deleted', () => {
    const f = computeRuleFootprint({
      fires: [
        fire({
          ruleUid: 'Rgone',
          ruleSnapshot: { ruleUid: 'Rgone', name: 'Old redirect', type: 'redirect', enabled: true },
        }),
      ],
      rulesByUid: new Map(),
      header: emptyHeaderFootprint(),
    });
    expect(f.ruleCount).toBe(1);
    expect(f.typeCounts).toEqual([['redirect', 1]]);
    expect(f.ruleNames).toEqual(['Old redirect']);
  });

  it('folds header bits after the type counts and unions attributed rules', () => {
    const rules = new Map<string, Rule>([['R1', redirectRule('R1', 'Redirect example.com')]]);
    const header = emptyHeaderFootprint({
      ruleCount: 1,
      ruleUids: new Set(['H1']),
      affectedRowCount: 1,
      modifiedCount: 1,
      ruleNames: ['Header rule'],
    });
    const f = computeRuleFootprint({
      fires: [fire({ ruleUid: 'R1' })],
      rulesByUid: rules,
      header,
    });
    expect(f.ruleCount).toBe(2);
    expect(f.ruleNames).toEqual(['Redirect example.com', 'Header rule']);
    expect(formatRuleFootprint(f)).toBe('2 rules · 1 redirect · 1 header · 1 modified');
  });

  it('does not double-count a header rule present in both fires and attribution', () => {
    const header = emptyHeaderFootprint({
      ruleCount: 1,
      ruleUids: new Set(['H1']),
      affectedRowCount: 1,
      modifiedCount: 1,
      ruleNames: ['Header rule'],
    });
    const f = computeRuleFootprint({
      fires: [
        fire({ ruleUid: 'H1', ruleSnapshot: { ruleUid: 'H1', name: 'Header rule', type: 'header', enabled: true } }),
      ],
      rulesByUid: new Map(),
      header,
    });
    expect(f.ruleCount).toBe(1);
    expect(f.typeCounts).toEqual([]);
    expect(f.ruleNames).toEqual(['Header rule']);
    expect(formatRuleFootprint(f)).toBe('1 rule · 1 header · 1 modified');
  });

  it('hides the chip when nothing fired and nothing was attributed', () => {
    const f = computeRuleFootprint({ fires: [], rulesByUid: new Map(), header: emptyHeaderFootprint() });
    expect(f.ruleCount).toBe(0);
    expect(formatRuleFootprint(f)).toBe('');
  });
});
