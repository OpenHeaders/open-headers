import type { CascadeInsight } from '@openheaders/ui/panel/data/cascade/cascade-insights';
import { computeCascadeInsights } from '@openheaders/ui/panel/data/cascade/cascade-insights';
import type { CascadeSummary, SubtreeStats } from '@openheaders/ui/panel/data/cascade/cascade-summary';
import { getTranslator } from '@openheaders/i18n';
import { describe, expect, it } from 'vitest';

const t = getTranslator('en');

function summary(over: Partial<CascadeSummary>): CascadeSummary {
  return {
    requestCount: 10,
    transferredBytes: 100_000,
    cumulativeMs: 1000,
    failedCount: 0,
    thirdPartyBytes: 0,
    byHost: new Map<string, SubtreeStats>(),
    subtreeStats: new Map<string, SubtreeStats>(),
    ...over,
  };
}

describe('computeCascadeInsights', () => {
  it('returns no insights for a clean cascade', () => {
    expect(computeCascadeInsights(t, summary({}))).toEqual([]);
  });

  it('flags failures', () => {
    const out = computeCascadeInsights(t, summary({ failedCount: 3 }));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('failure');
    expect(out[0].headline).toMatch(/3 failed/);
  });

  it('flags a dominant host (>30% of cascade bytes)', () => {
    const byHost = new Map<string, SubtreeStats>([
      ['cdn.example.com', { count: 7, bytes: 60_000, ms: 0, failures: 0 }],
      ['other.example.com', { count: 3, bytes: 40_000, ms: 0, failures: 0 }],
    ]);
    const out = computeCascadeInsights(t, summary({ transferredBytes: 100_000, byHost }));
    expect(out.some((i: CascadeInsight) => i.kind === 'host')).toBe(true);
  });

  it('does NOT flag a host that is under 30%', () => {
    const byHost = new Map<string, SubtreeStats>([
      ['cdn.example.com', { count: 1, bytes: 20_000, ms: 0, failures: 0 }],
      ['other.example.com', { count: 9, bytes: 80_000, ms: 0, failures: 0 }],
    ]);
    // top is "other.example.com" with 80% — that DOES qualify, so use balanced shares
    const balanced = new Map<string, SubtreeStats>([
      ['a.example.com', { count: 1, bytes: 25_000, ms: 0, failures: 0 }],
      ['b.example.com', { count: 1, bytes: 25_000, ms: 0, failures: 0 }],
      ['c.example.com', { count: 1, bytes: 25_000, ms: 0, failures: 0 }],
      ['d.example.com', { count: 1, bytes: 25_000, ms: 0, failures: 0 }],
    ]);
    void byHost;
    expect(
      computeCascadeInsights(t, summary({ transferredBytes: 100_000, byHost: balanced })).some(
        (i: CascadeInsight) => i.kind === 'host',
      ),
    ).toBe(false);
  });

  it('flags third-party share above 50%', () => {
    const out = computeCascadeInsights(t, summary({ transferredBytes: 100_000, thirdPartyBytes: 60_000 }));
    expect(out.some((i: CascadeInsight) => i.kind === 'third-party')).toBe(true);
  });

  it('does NOT flag third-party share below 50%', () => {
    const out = computeCascadeInsights(t, summary({ transferredBytes: 100_000, thirdPartyBytes: 40_000 }));
    expect(out.some((i: CascadeInsight) => i.kind === 'third-party')).toBe(false);
  });
});
