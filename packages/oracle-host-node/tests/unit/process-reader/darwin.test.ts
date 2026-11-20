/**
 * The process reader on macOS, as it reads its addon (the activity
 * monitor plan §4 and §7, forks 3 and 10): the kernel's time units
 * turned into seconds, the footprint for memory, a refused read kept as
 * "no cost". The addon is a dependency here — a made-up one answering
 * figures SEEN on a Mac (the plan §4) — so these run on every OS.
 */

import { describe, expect, it } from 'vitest';
import {
  createDarwinProcessReader,
  type DarwinProcessBinding,
  type DarwinProcessInfo,
  type DarwinProcessUsage,
} from '../../../src/process-reader';

const KB = 1024;
const STARTED = Date.UTC(2026, 10, 20, 14, 0);

/** The timebase read on an Apple-silicon Mac: 125/3 nanoseconds a unit. */
const APPLE_SILICON = { numer: 125, denom: 3 };
const INTEL = { numer: 1, denom: 1 };

function makeInfo(overrides: Partial<DarwinProcessInfo> = {}): DarwinProcessInfo {
  return { parentPid: 4312, startedAtMs: STARTED, executableName: 'node', terminal: 268_435_459, ...overrides };
}

function makeUsage(overrides: Partial<DarwinProcessUsage> = {}): DarwinProcessUsage {
  return {
    userTime: 0,
    systemTime: 0,
    exitedChildrenUserTime: 0,
    exitedChildrenSystemTime: 0,
    footprintBytes: 46_529 * KB,
    residentBytes: 34_976 * KB,
    ...overrides,
  };
}

function makeBinding(overrides: Partial<DarwinProcessBinding> = {}): DarwinProcessBinding {
  return {
    timebase: () => APPLE_SILICON,
    info: () => makeInfo(),
    usage: () => makeUsage(),
    childPids: () => [],
    terminalPids: () => [],
    ...overrides,
  };
}

describe('createDarwinProcessReader', () => {
  it('turns the kernel’s time units into seconds by the timebase', () => {
    // 24,000,000 units × 125 / 3 = one second; the children's 2,400,000 a tenth.
    const reader = createDarwinProcessReader(
      makeBinding({
        usage: () =>
          makeUsage({
            userTime: 18_000_000,
            systemTime: 6_000_000,
            exitedChildrenUserTime: 1_800_000,
            exitedChildrenSystemTime: 600_000,
          }),
      }),
    );
    const cost = reader.read(61_102)?.cost;
    expect(cost?.cpuSeconds).toBeCloseTo(1, 12);
    expect(cost?.exitedChildrenCpuSeconds).toBeCloseTo(0.1, 12);
  });

  it('reads the units as nanoseconds where the timebase is one to one', () => {
    const reader = createDarwinProcessReader(
      makeBinding({
        timebase: () => INTEL,
        usage: () => makeUsage({ userTime: 750_000_000, systemTime: 250_000_000 }),
      }),
    );
    expect(reader.read(61_102)?.cost?.cpuSeconds).toBe(1);
  });

  it('takes the footprint for memory, not the resident size — whichever way they differ', () => {
    const more = createDarwinProcessReader(makeBinding());
    expect(more.memoryKind).toBe('footprint');
    expect(more.read(61_102)?.cost?.memoryBytes).toBe(46_529 * KB);

    const less = createDarwinProcessReader(
      makeBinding({ usage: () => makeUsage({ footprintBytes: 7_136 * KB, residentBytes: 23_936 * KB }) }),
    );
    expect(less.read(61_102)?.cost?.memoryBytes).toBe(7_136 * KB);
  });

  it('reads a process whole: its parent, its start, its executable’s base name', () => {
    expect(createDarwinProcessReader(makeBinding()).read(61_102)).toEqual({
      pid: 61_102,
      parentPid: 4312,
      startedAt: STARTED,
      name: 'node',
      cost: { cpuSeconds: 0, exitedChildrenCpuSeconds: 0, memoryBytes: 46_529 * KB },
    });
  });

  it('keeps a process the kernel refuses to cost — another user’s — with no cost, never zero', () => {
    const reader = createDarwinProcessReader(
      makeBinding({ info: () => makeInfo({ parentPid: 1, executableName: 'mDNSResponderHelper' }), usage: () => null }),
    );
    expect(reader.read(412)).toEqual({
      pid: 412,
      parentPid: 1,
      startedAt: STARTED,
      name: 'mDNSResponderHelper',
      cost: null,
    });
  });

  it('answers null for a pid no process holds, and asks no cost of it', () => {
    let asked = 0;
    const reader = createDarwinProcessReader(
      makeBinding({
        info: () => null,
        usage: () => {
          asked += 1;
          return makeUsage();
        },
      }),
    );
    expect(reader.read(999)).toBeNull();
    expect(asked).toBe(0);
  });

  it('lists children by the one call the system has for them', () => {
    const reader = createDarwinProcessReader(
      makeBinding({ childPids: (pid) => (pid === 61_044 ? [61_060, 61_102] : []) }),
    );
    expect(reader.childPids(61_044)).toEqual([61_060, 61_102]);
    expect(reader.childPids(61_102)).toEqual([]);
  });

  it('lists what shares a process’s terminal by that terminal’s device', () => {
    const asked: number[] = [];
    const reader = createDarwinProcessReader(
      makeBinding({
        terminalPids: (terminal) => {
          asked.push(terminal);
          return [61_044, 61_060, 61_300];
        },
      }),
    );
    expect(reader.terminalPids(61_044)).toEqual([61_044, 61_060, 61_300]);
    expect(asked).toEqual([268_435_459]);
  });

  it('lists nothing for a process with no terminal, or for none at all — without asking', () => {
    let asked = 0;
    const count = (): number[] => {
      asked += 1;
      return [1];
    };
    const detached = createDarwinProcessReader(
      makeBinding({ info: () => makeInfo({ terminal: -1 }), terminalPids: count }),
    );
    expect(detached.terminalPids(61_044)).toEqual([]);
    const gone = createDarwinProcessReader(makeBinding({ info: () => null, terminalPids: count }));
    expect(gone.terminalPids(999)).toEqual([]);
    expect(asked).toBe(0);
  });
});
