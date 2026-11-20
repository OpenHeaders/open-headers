/**
 * The sampler's own deltas (the activity monitor plan §6, law 3): a
 * rate is the change of a cumulative counter between two reads; where
 * the runtime reports none the counter is rebuilt from its percent; a
 * counter that goes backwards clamps to zero; and a process is its pid
 * AND its creation time.
 */

import { describe, expect, it } from 'vitest';
import { type CpuCounterRead, foldCpuCounters, processIdentity } from '../../src/activity-monitor/cpu-rate';

const ENGINE = processIdentity(4312, 1_763_625_600_000);

describe('foldCpuCounters', () => {
  it('answers no rate on a first read — there is nothing to take a delta from', () => {
    const first = foldCpuCounters(null, [{ id: ENGINE, cumulativeSeconds: 12.5, percentOfMachine: 0 }], 10_000, 10);
    expect(first.rates.get(ENGINE)).toBeNull();
    expect(first.state.seconds.get(ENGINE)).toBe(12.5);
  });

  it('takes the rate from the cumulative counter where the runtime reports it', () => {
    const first = foldCpuCounters(null, [{ id: ENGINE, cumulativeSeconds: 12.5, percentOfMachine: 0 }], 10_000, 10);
    const second = foldCpuCounters(
      first.state,
      [{ id: ENGINE, cumulativeSeconds: 13.3, percentOfMachine: 99 }],
      12_000,
      10,
    );
    // 0.8 CPU seconds over 2 s of wall time; the runtime's percent is not consulted.
    expect(second.rates.get(ENGINE)).toBeCloseTo(0.4, 10);
  });

  it('rebuilds the counter from percent × interval where the cumulative field is absent', () => {
    const first = foldCpuCounters(null, [{ id: ENGINE, percentOfMachine: 0 }], 10_000, 8);
    expect(first.rates.get(ENGINE)).toBeNull();
    expect(first.state.seconds.get(ENGINE)).toBe(0);

    // 5 % of an 8-core machine for 2 s is 0.8 CPU seconds — 0.4 of one core.
    const second = foldCpuCounters(first.state, [{ id: ENGINE, percentOfMachine: 5 }], 12_000, 8);
    expect(second.state.seconds.get(ENGINE)).toBeCloseTo(0.8, 10);
    expect(second.rates.get(ENGINE)).toBeCloseTo(0.4, 10);

    const third = foldCpuCounters(second.state, [{ id: ENGINE, percentOfMachine: 12.5 }], 16_000, 8);
    expect(third.state.seconds.get(ENGINE)).toBeCloseTo(4.8, 10);
    expect(third.rates.get(ENGINE)).toBeCloseTo(1, 10);
  });

  it('clamps a counter that went backwards to zero', () => {
    const first = foldCpuCounters(null, [{ id: ENGINE, cumulativeSeconds: 40, percentOfMachine: 0 }], 10_000, 10);
    const second = foldCpuCounters(
      first.state,
      [{ id: ENGINE, cumulativeSeconds: 39.2, percentOfMachine: 0 }],
      12_000,
      10,
    );
    expect(second.rates.get(ENGINE)).toBe(0);
  });

  it('reads a reused pid with a new creation time as a new process', () => {
    const reborn = processIdentity(4312, 1_763_629_200_000);
    expect(reborn).not.toBe(ENGINE);

    const first = foldCpuCounters(null, [{ id: ENGINE, cumulativeSeconds: 900, percentOfMachine: 0 }], 10_000, 10);
    const second = foldCpuCounters(
      first.state,
      [{ id: reborn, cumulativeSeconds: 0.1, percentOfMachine: 0 }],
      12_000,
      10,
    );
    // Not a 900-second drop clamped to zero: no earlier read of THIS process exists.
    expect(second.rates.get(reborn)).toBeNull();
    expect(second.state.seconds.has(ENGINE)).toBe(false);
  });

  it('answers no rate when no time passed between two reads', () => {
    const reads: CpuCounterRead[] = [{ id: ENGINE, cumulativeSeconds: 12.5, percentOfMachine: 0 }];
    const first = foldCpuCounters(null, reads, 10_000, 10);
    expect(foldCpuCounters(first.state, reads, 10_000, 10).rates.get(ENGINE)).toBeNull();
    expect(foldCpuCounters(first.state, reads, 9_000, 10).rates.get(ENGINE)).toBeNull();
  });
});
