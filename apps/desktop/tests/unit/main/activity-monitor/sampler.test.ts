/**
 * The sampler (the activity monitor plan §6, laws 2, 3 and 6): a first
 * read answers no rate — a dash, never zero; two asks inside a second
 * share one read; a rate is the sampler's own delta whether or not the
 * runtime reports a cumulative counter; and the platform is an
 * argument, so every convention is pinned on every OS.
 */

import type { ActivityMonitorMemoryKind, ActivityMonitorPlatform } from '@openheaders/core/activity-monitor';
import { describe, expect, it } from 'vitest';
import type { ProcessOwners, ProcessRead } from '@/main/activity-monitor/process-naming';
import { BASELINE_MAX_AGE_MS, createActivityMonitorSampler, SAMPLE_MAX_AGE_MS } from '@/main/activity-monitor/sampler';

const STARTED = 1_763_625_600_000;

function makeRead(overrides: Partial<ProcessRead> = {}): ProcessRead {
  return {
    pid: 4312,
    creationTime: STARTED,
    type: 'Browser',
    name: undefined,
    serviceName: undefined,
    cumulativeCpuSeconds: 10,
    percentCpu: 0,
    memoryBytes: 212 * 1024 * 1024,
    ...overrides,
  };
}

function makeRig(
  options: { platform?: ActivityMonitorPlatform; logicalCores?: number; memoryKind?: ActivityMonitorMemoryKind } = {},
) {
  const clock = { at: STARTED + 60_000 };
  const state: { reads: ProcessRead[]; owners: ProcessOwners; readCount: number } = {
    reads: [makeRead()],
    owners: { windowPids: new Set(), scriptSandboxPid: null },
    readCount: 0,
  };
  const sampler = createActivityMonitorSampler({
    readProcesses: () => {
      state.readCount += 1;
      return state.reads;
    },
    readOwners: () => state.owners,
    now: () => clock.at,
    platform: options.platform ?? 'darwin',
    logicalCores: options.logicalCores ?? 10,
    memoryKind: options.memoryKind ?? 'footprint',
  });
  return { sampler, clock, state };
}

describe('createActivityMonitorSampler', () => {
  it('reads nothing until it is asked', () => {
    const { state } = makeRig();
    expect(state.readCount).toBe(0);
  });

  it('answers a first read with no rate — never zero — and every other figure', () => {
    const { sampler, clock } = makeRig();
    const snapshot = sampler.sample();
    expect(snapshot).toEqual({
      sampledAt: clock.at,
      platform: 'darwin',
      logicalCores: 10,
      memoryKind: 'footprint',
      processes: [
        {
          id: `4312:${STARTED}`,
          kind: 'engine',
          pid: 4312,
          startedAt: STARTED,
          cpuRate: null,
          memoryBytes: 212 * 1024 * 1024,
        },
      ],
      cpuSeconds: new Map([[`4312:${STARTED}`, 10]]),
    });
  });

  it('carries the counter it rebuilt where the runtime reports none', () => {
    const { sampler, clock, state } = makeRig({ platform: 'win32', logicalCores: 8 });
    const id = `4312:${STARTED}`;
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 0 })];
    expect(sampler.sample().cpuSeconds.get(id)).toBe(0);

    clock.at += 2_000;
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 5 })];
    // 5 % of eight cores for two seconds is 0.8 CPU seconds.
    expect(sampler.sample().cpuSeconds.get(id)).toBeCloseTo(0.8, 10);
  });

  it('does not read again for a second ask inside a second', () => {
    const { sampler, clock, state } = makeRig();
    const first = sampler.sample();
    clock.at += SAMPLE_MAX_AGE_MS - 1;
    expect(sampler.sample()).toBe(first);
    expect(state.readCount).toBe(1);

    clock.at += 1;
    expect(sampler.sample()).not.toBe(first);
    expect(state.readCount).toBe(2);
  });

  it('takes the rate from its own delta of the cumulative counter', () => {
    const { sampler, clock, state } = makeRig();
    sampler.sample();
    clock.at += 2_000;
    state.reads = [makeRead({ cumulativeCpuSeconds: 10.8, percentCpu: 77 })];
    expect(sampler.sample().processes[0].cpuRate).toBeCloseTo(0.4, 10);
  });

  it('rebuilds the counter from the runtime percent where the cumulative field is absent', () => {
    const { sampler, clock, state } = makeRig({ platform: 'win32', logicalCores: 8 });
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 0 })];
    expect(sampler.sample().processes[0].cpuRate).toBeNull();

    clock.at += 2_000;
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 5 })];
    const snapshot = sampler.sample();
    // 5 % of an 8-core machine is 0.4 of one core.
    expect(snapshot.processes[0].cpuRate).toBeCloseTo(0.4, 10);
    expect(snapshot.platform).toBe('win32');
    expect(snapshot.logicalCores).toBe(8);
  });

  it('answers no rate for a process it has not read before, beside one it has', () => {
    const { sampler, clock, state } = makeRig();
    sampler.sample();
    clock.at += 2_000;
    state.reads = [
      makeRead({ cumulativeCpuSeconds: 10.2 }),
      makeRead({ pid: 61_007, creationTime: clock.at - 500, type: 'Tab', cumulativeCpuSeconds: 0.3 }),
    ];
    state.owners = { windowPids: new Set([61_007]), scriptSandboxPid: null };
    const [engine, window] = sampler.sample().processes;
    expect(engine.cpuRate).toBeCloseTo(0.1, 10);
    expect(window).toMatchObject({ kind: 'window', pid: 61_007, cpuRate: null });
  });

  it('reads a reused pid with a new creation time as a new row', () => {
    const { sampler, clock, state } = makeRig();
    const before = sampler.sample().processes[0];
    clock.at += 2_000;
    state.reads = [makeRead({ creationTime: clock.at - 100, cumulativeCpuSeconds: 0.05 })];
    const after = sampler.sample().processes[0];
    expect(after.pid).toBe(before.pid);
    expect(after.id).not.toBe(before.id);
    expect(after.cpuRate).toBeNull();
  });

  it('takes no baseline from a read older than the bound — a dash, not the average since then', () => {
    const { sampler, clock, state } = makeRig();
    sampler.sample();
    clock.at += BASELINE_MAX_AGE_MS + 1;
    state.reads = [makeRead({ cumulativeCpuSeconds: 190 })];
    expect(sampler.sample().processes[0].cpuRate).toBeNull();

    clock.at += 2_000;
    state.reads = [makeRead({ cumulativeCpuSeconds: 190.2 })];
    expect(sampler.sample().processes[0].cpuRate).toBeCloseTo(0.1, 10);
  });

  it('says which memory its figures are, as the host that composed it said', () => {
    expect(makeRig({ memoryKind: 'resident' }).sampler.sample().memoryKind).toBe('resident');
    expect(makeRig({ platform: 'win32', memoryKind: 'working-set' }).sampler.sample().memoryKind).toBe('working-set');
  });

  it('reads a dash, read after read, for a process whose cost could not be read — never zero', () => {
    const { sampler, clock, state } = makeRig();
    const refused = makeRead({
      pid: 61_044,
      type: 'Utility',
      cumulativeCpuSeconds: undefined,
      percentCpu: null,
      memoryBytes: null,
    });
    state.reads = [makeRead(), refused];
    sampler.sample();
    clock.at += 2_000;
    state.reads = [makeRead({ cumulativeCpuSeconds: 10.2 }), refused];
    const snapshot = sampler.sample();
    expect(snapshot.processes.map((row) => [row.pid, row.cpuRate, row.memoryBytes])).toEqual([
      [4312, expect.closeTo(0.1, 10), 212 * 1024 * 1024],
      [61_044, null, null],
    ]);
    expect([...snapshot.cpuSeconds.keys()]).toEqual([`4312:${STARTED}`]);
  });

  it('carries a process it has no name for as other, with the runtime name', () => {
    const { sampler, state } = makeRig();
    state.reads = [makeRead({ pid: 4377, type: 'Utility', name: 'Audio Service', memoryBytes: null })];
    expect(sampler.sample().processes).toEqual([
      {
        id: `4377:${STARTED}`,
        kind: 'other',
        runtimeName: 'Audio Service',
        pid: 4377,
        startedAt: STARTED,
        cpuRate: null,
        memoryBytes: null,
      },
    ]);
  });
});
