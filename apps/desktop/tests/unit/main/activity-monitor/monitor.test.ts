/**
 * The monitor on this host (the activity monitor plan §7, forks 2 and
 * 4; §6, laws 2 and 3): the history beats every fifteen seconds with
 * nobody looking and never after teardown; a beat and an ask inside a
 * second share one read; a ring point is the rate over the whole beat,
 * whatever a viewer read in between; an hour is 240 points; and an ask
 * gets only the beats past its cursor. The clock and the timer are
 * arguments, so every one of these runs on every OS.
 */

import { ACTIVITY_MONITOR_HISTORY_BEAT_MS } from '@openheaders/core/activity-monitor';
import { describe, expect, it } from 'vitest';
import { createActivityMonitor } from '@/main/activity-monitor/monitor';
import type { ProcessRead } from '@/main/activity-monitor/process-naming';
import { BASELINE_MAX_AGE_MS, createActivityMonitorSampler } from '@/main/activity-monitor/sampler';

const T0 = 1_763_647_200_000;
const STARTED = T0 - 3_600_000;
const BEAT = ACTIVITY_MONITOR_HISTORY_BEAT_MS;
const ENGINE_ID = `4312:${STARTED}`;

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

interface BeatTimer {
  run: () => void;
  everyMs: number;
  nextAt: number;
  stopped: boolean;
}

function makeRig(options: { logicalCores?: number } = {}) {
  const clock = { at: T0 };
  const state: { reads: ProcessRead[]; readCount: number } = { reads: [makeRead()], readCount: 0 };
  const timers: BeatTimer[] = [];
  const monitor = createActivityMonitor({
    sampler: createActivityMonitorSampler({
      readProcesses: () => {
        state.readCount += 1;
        return state.reads;
      },
      readOwners: () => ({ windowPids: new Set(), scriptSandboxPid: null }),
      now: () => clock.at,
      platform: 'darwin',
      logicalCores: options.logicalCores ?? 10,
      memoryKind: 'footprint',
    }),
    startBeat: (run, everyMs) => {
      const timer: BeatTimer = { run, everyMs, nextAt: clock.at + everyMs, stopped: false };
      timers.push(timer);
      return () => {
        timer.stopped = true;
      };
    },
  });
  /** Move the clock, firing every beat that falls due on the way. */
  const advance = (ms: number): void => {
    const until = clock.at + ms;
    for (const timer of timers) {
      while (!timer.stopped && timer.nextAt <= until) {
        clock.at = timer.nextAt;
        timer.nextAt += timer.everyMs;
        timer.run();
      }
    }
    clock.at = until;
  };
  return { monitor, clock, state, timers, advance };
}

const seqs = (beats: readonly { seq: number }[]): number[] => beats.map((beat) => beat.seq);

describe('createActivityMonitor — the history’s beat', () => {
  it('holds one timer, at the ring’s interval, and reads nothing before its first beat', () => {
    const { timers, state } = makeRig();
    expect(timers.map((timer) => timer.everyMs)).toEqual([15_000]);
    expect(state.readCount).toBe(0);
  });

  it('beats every fifteen seconds with nobody looking', () => {
    const { monitor, state, advance } = makeRig();
    advance(BEAT - 1);
    expect(state.readCount).toBe(0);
    advance(1);
    expect(state.readCount).toBe(1);
    advance(3 * BEAT);
    expect(state.readCount).toBe(4);

    const answer = monitor.answer(null);
    expect(answer.history.map((beat) => beat.at)).toEqual([T0 + BEAT, T0 + 2 * BEAT, T0 + 3 * BEAT, T0 + 4 * BEAT]);
    expect(answer.cursor).toBe(4);
  });

  it('reads nothing more after teardown', () => {
    const { monitor, state, timers, advance } = makeRig();
    advance(2 * BEAT);
    monitor.dispose();
    expect(timers[0].stopped).toBe(true);
    advance(10 * BEAT);
    expect(state.readCount).toBe(2);
  });

  it('shares one read between a beat and an ask inside the same second, whichever comes first', () => {
    const { monitor, state, advance } = makeRig();
    advance(BEAT);
    advance(500);
    monitor.answer(null);
    expect(state.readCount).toBe(1);

    advance(BEAT - 1_000);
    const asked = monitor.answer(1);
    expect(state.readCount).toBe(2);
    advance(500);
    // The beat landed half a second after the ask and took the ask's read — and its instant.
    expect(state.readCount).toBe(2);
    expect(monitor.answer(1).history.map((beat) => beat.at)).toEqual([asked.sampledAt]);
  });

  it('yields 240 points for an hour, and still 240 after the next beat', () => {
    const { monitor, advance } = makeRig();
    advance(3_600_000);
    const hour = monitor.answer(null).history;
    expect(hour).toHaveLength(240);
    expect(hour[0].seq).toBe(1);

    advance(BEAT);
    const next = monitor.answer(null).history;
    expect(next).toHaveLength(240);
    expect(next[0].seq).toBe(2);
  });

  it('takes a ring point over the whole beat, whatever a viewer read in between', () => {
    const { monitor, state, advance } = makeRig();
    advance(BEAT);

    // A two-second burst of a full core, then quiet — seen by a viewer asking every two seconds.
    advance(2_000);
    state.reads = [makeRead({ cumulativeCpuSeconds: 12 })];
    expect(monitor.answer(null).processes[0].cpuRate).toBeCloseTo(1, 10);
    advance(2_000);
    expect(monitor.answer(1).processes[0].cpuRate).toBe(0);
    advance(BEAT - 4_000);

    // Two CPU seconds in fifteen: neither the burst nor the quiet.
    const [point] = monitor.answer(1).history;
    expect(point.points[ENGINE_ID].cpuRate).toBeCloseTo(2 / 15, 10);
  });

  it('takes the same point from the rebuilt counter where the runtime reports none', () => {
    const { monitor, state, advance } = makeRig({ logicalCores: 8 });
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined })];
    advance(BEAT);

    advance(2_000);
    // 12.5 % of eight cores for two seconds: two CPU seconds.
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 12.5 })];
    monitor.answer(null);
    state.reads = [makeRead({ cumulativeCpuSeconds: undefined, percentCpu: 0 })];
    advance(BEAT - 2_000);

    const [point] = monitor.answer(1).history;
    expect(point.points[ENGINE_ID].cpuRate).toBeCloseTo(2 / 15, 10);
  });

  it('keeps the sampler’s baseline fresh — a first ask after a long quiet reads a figure, not a dash', () => {
    const { monitor, state, advance } = makeRig();
    advance(4 * BEAT);
    expect(4 * BEAT).toBeGreaterThan(BASELINE_MAX_AGE_MS);

    advance(BEAT - 1_000);
    state.reads = [makeRead({ cumulativeCpuSeconds: 11.4 })];
    // The beat fourteen seconds ago is the baseline: 1.4 CPU seconds in fourteen.
    expect(monitor.answer(null).processes[0].cpuRate).toBeCloseTo(0.1, 10);
  });
});

describe('createActivityMonitor — a viewer’s ask', () => {
  it('hands over the whole ring on a first ask, then only the beats past the cursor', () => {
    const { monitor, advance } = makeRig();
    advance(2 * BEAT);
    const first = monitor.answer(null);
    expect(seqs(first.history)).toEqual([1, 2]);

    expect(monitor.answer(first.cursor).history).toEqual([]);
    advance(BEAT);
    const next = monitor.answer(first.cursor);
    expect(seqs(next.history)).toEqual([3]);
    expect(next.cursor).toBe(3);
  });

  it('answers the processes and their history, and never the counters', () => {
    const { monitor, clock, advance } = makeRig();
    advance(BEAT);
    advance(5_000);
    expect(monitor.answer(null)).toEqual({
      sampledAt: clock.at,
      platform: 'darwin',
      logicalCores: 10,
      memoryKind: 'footprint',
      processes: [
        { id: ENGINE_ID, kind: 'engine', pid: 4312, startedAt: STARTED, cpuRate: 0, memoryBytes: 212 * 1024 * 1024 },
      ],
      history: [{ seq: 1, at: T0 + BEAT, points: { [ENGINE_ID]: { cpuRate: null, memoryBytes: 212 * 1024 * 1024 } } }],
      ended: [],
      cursor: 1,
    });
  });

  it('turns a process that is gone into an ended row at the very next ask, not at the next beat', () => {
    const { monitor, clock, state, advance } = makeRig();
    const runtime = makeRead({
      pid: 61_377,
      creationTime: T0 - 60_000,
      type: 'Utility',
      name: 'openheaders-script-worker',
      cumulativeCpuSeconds: 1,
    });
    state.reads = [makeRead(), runtime];
    advance(BEAT);

    state.reads = [makeRead()];
    advance(2_000);
    const answer = monitor.answer(1);
    expect(answer.processes.map((row) => row.kind)).toEqual(['engine']);
    expect(answer.ended).toEqual([
      { id: `61377:${T0 - 60_000}`, kind: 'script-runtime', pid: 61_377, startedAt: T0 - 60_000, endedAt: clock.at },
    ]);
  });

  it('lists no ended row for a process that never met a beat', () => {
    const { monitor, state, advance } = makeRig();
    advance(BEAT);
    state.reads = [makeRead(), makeRead({ pid: 4377, type: 'Utility', name: 'Audio Service' })];
    advance(2_000);
    monitor.answer(1);
    state.reads = [makeRead()];
    advance(2_000);
    expect(monitor.answer(1).ended).toEqual([]);
  });
});
