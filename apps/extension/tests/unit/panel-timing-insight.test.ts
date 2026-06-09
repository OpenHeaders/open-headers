import type { ElapsedRung, TimingInsight } from '@openheaders/ui/panel/data/timing-insight';
import { computeTransferRate, findBottleneck, findWarnings } from '@openheaders/ui/panel/data/timing-insight';
import { describe, expect, it } from 'vitest';

function phase(key: ElapsedRung['key'], ms: number): ElapsedRung {
  return { key, label: key, ms };
}

describe('findBottleneck', () => {
  it('returns null on empty phase list', () => {
    expect(findBottleneck([], 0)).toBeNull();
  });

  it('flags the dominant phase when it is ≥30% of total', () => {
    const phases = [phase('wait', 400), phase('connect', 100), phase('receive', 100)];
    const out = findBottleneck(phases, 600);
    expect(out?.phase).toBe('wait');
    expect(out?.percent).toBeCloseTo(66.66, 1);
  });

  it('flags a phase that is ≥2× the runner-up even when under 30%', () => {
    // 250 / 1200 = 20.8% (under 30%), but runner-up is 120 → 250 ≥ 2×120
    const phases = [
      phase('wait', 250),
      phase('receive', 120),
      phase('connect', 100),
      phase('ssl', 100),
      phase('dns', 100),
      phase('send', 100),
      phase('stalled', 90),
      phase('queueing', 90),
    ];
    const out = findBottleneck(phases, 1200);
    expect(out?.phase).toBe('wait');
  });

  it('returns null when no single phase clearly dominates', () => {
    // 100/395 = 25.3% (under 30), runner-up 99 → 100 < 2×99
    const phases = [phase('wait', 100), phase('connect', 99), phase('receive', 98), phase('dns', 98)];
    expect(findBottleneck(phases, 395)).toBeNull();
  });
});

describe('findWarnings', () => {
  it('flags every phase over its individual threshold', () => {
    const phases = [phase('dns', 200), phase('wait', 700), phase('receive', 100)];
    const out = findWarnings(phases, null);
    expect(out.map((w: TimingInsight) => w.phase)).toEqual(['dns', 'wait']);
  });

  it('excludes the phase already covered by the bottleneck callout', () => {
    const phases = [phase('dns', 200), phase('wait', 700)];
    const out = findWarnings(phases, 'wait');
    expect(out.map((w: TimingInsight) => w.phase)).toEqual(['dns']);
  });
});

describe('computeTransferRate', () => {
  it('returns null when receive ms is zero', () => {
    expect(computeTransferRate(0, 1024)).toBeNull();
  });

  it('returns null when bytes are missing or non-positive', () => {
    expect(computeTransferRate(100, 0)).toBeNull();
    expect(computeTransferRate(100, null)).toBeNull();
    expect(computeTransferRate(100, undefined)).toBeNull();
  });

  it('computes KB/s and formats with appropriate unit', () => {
    const out = computeTransferRate(1000, 1024 * 600);
    expect(out?.bytesPerSecond).toBeCloseTo(1024 * 600, 0);
    expect(out?.formatted).toBe('600.0 KB/s');
  });

  it('switches to MB/s for high rates', () => {
    const out = computeTransferRate(100, 1024 * 1024 * 5);
    expect(out?.formatted).toBe('50.0 MB/s');
  });
});
