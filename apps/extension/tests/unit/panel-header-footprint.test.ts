import type { AnnotatedHeader } from '@openheaders/ui/panel/data/headers/header-attribution';
import { computeHeaderFootprint, formatHeaderFootprint } from '@openheaders/ui/panel/data/headers/header-footprint';
import { describe, expect, it } from 'vitest';

function ctxFor(uid: string, name: string) {
  return {
    ruleUid: uid,
    ruleName: name,
    ruleType: 'header' as const,
    snapshotMod: { direction: 'response' as const, operation: 'override' as const, headerName: 'X' },
    snapshotMods: [],
    siblingMods: [],
  };
}

function row(over: Partial<AnnotatedHeader> & { attribution: AnnotatedHeader['attribution'] }): AnnotatedHeader {
  return {
    name: over.name ?? 'X',
    value: over.value ?? 'v',
    attribution: over.attribution,
  };
}

describe('computeHeaderFootprint', () => {
  it('returns zero footprint when no rules touched the request', () => {
    const f = computeHeaderFootprint({
      requestRows: [row({ attribution: { kind: 'server' } })],
      responseRows: [row({ attribution: { kind: 'server' } })],
      driftedRows: new Set(),
    });
    expect(f.ruleCount).toBe(0);
    expect(f.affectedRowCount).toBe(0);
    expect(formatHeaderFootprint(f)).toBe('');
  });

  it('counts rules and rows across both directions, dedup by ruleUid', () => {
    const a = ctxFor('R1', 'Rule One');
    const b = ctxFor('R2', 'Rule Two');
    const r1 = row({ attribution: { kind: 'added', operation: 'override', ctx: a } });
    const r2 = row({ attribution: { kind: 'modified', operation: 'override', originalValue: 'x', ctx: a } });
    const r3 = row({ attribution: { kind: 'removed', source: 'server', originalValue: 'y', ctx: b } });
    const f = computeHeaderFootprint({
      requestRows: [r1],
      responseRows: [r2, r3],
      driftedRows: new Set([r2]),
    });
    expect(f.ruleCount).toBe(2);
    expect(f.affectedRowCount).toBe(3);
    expect(f.addedCount).toBe(1);
    expect(f.modifiedCount).toBe(1);
    expect(f.removedCount).toBe(1);
    expect(f.driftedRowCount).toBe(1);
    expect(f.ruleNames).toEqual(['Rule One', 'Rule Two']);
    expect(formatHeaderFootprint(f)).toBe('2 rules · 3 headers · 1 added · 1 modified · 1 removed · 1 drifted');
  });

  it('ignores system-attributed rows', () => {
    const f = computeHeaderFootprint({
      requestRows: [row({ attribution: { kind: 'system', source: 'cache-bypass', label: 'Bypass HTTP Cache' } })],
      responseRows: [],
      driftedRows: new Set(),
    });
    expect(f.ruleCount).toBe(0);
    expect(f.affectedRowCount).toBe(0);
  });
});
