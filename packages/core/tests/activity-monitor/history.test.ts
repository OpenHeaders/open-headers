/**
 * The history's ring (the activity monitor plan §7, forks 2 and 4; §6,
 * laws 3 and 13): a beat every fifteen seconds, sixty minutes deep; a
 * point's rate is the ring's own delta between two beats; a process
 * that ended keeps its row until its last point ages out; a reused pid
 * is a new series; and a cursor gets only the beats past it.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MONITOR_HISTORY_BASELINE_MAX_AGE_MS,
  ACTIVITY_MONITOR_HISTORY_BEAT_MS,
  ACTIVITY_MONITOR_HISTORY_DEPTH,
  ACTIVITY_MONITOR_HISTORY_SPAN_MS,
  type ActivityMonitorHistory,
  appendHistoryBeat,
  EMPTY_ACTIVITY_MONITOR_HISTORY,
  endedProcesses,
  historyBeatsSince,
  historyCursor,
  mergeHistoryBeats,
  observeHistoryProcesses,
  processCpuSeries,
  seriesPeak,
  totalSeries,
} from '../../src/activity-monitor/history';
import type { ActivityMonitorProcessRow } from '../../src/activity-monitor/model';

const T0 = Date.UTC(2026, 10, 20, 14, 0);
const BEAT = ACTIVITY_MONITOR_HISTORY_BEAT_MS;
const MB = 1024 * 1024;

function makeRow(overrides: Partial<ActivityMonitorProcessRow> = {}): ActivityMonitorProcessRow {
  const pid = overrides.pid ?? 4312;
  const startedAt = overrides.startedAt ?? T0 - 3_600_000;
  return {
    id: `${pid}:${startedAt}`,
    kind: 'engine',
    pid,
    startedAt,
    cpuRate: null,
    memoryBytes: 212 * MB,
    ...overrides,
  };
}

const ENGINE = makeRow();
const RUNTIME = makeRow({ kind: 'script-runtime', pid: 61_377, startedAt: T0 - 60_000, memoryBytes: 89 * MB });

/** One beat: each process with the CPU seconds it has used so far. */
function beat(
  history: ActivityMonitorHistory,
  at: number,
  reads: Array<[ActivityMonitorProcessRow, number]>,
): ActivityMonitorHistory {
  return appendHistoryBeat(history, {
    at,
    processes: reads.map(([row]) => row),
    cpuSeconds: new Map(reads.map(([row, seconds]) => [row.id, seconds])),
  });
}

/** `count` beats of the engine alone, fifteen seconds apart, idle. */
function idleBeats(history: ActivityMonitorHistory, from: number, count: number): ActivityMonitorHistory {
  let next = history;
  for (let index = 0; index < count; index += 1) next = beat(next, from + index * BEAT, [[ENGINE, 10]]);
  return next;
}

const seqs = (beats: readonly { seq: number }[]): number[] => beats.map((entry) => entry.seq);

describe('appendHistoryBeat', () => {
  it('holds sixty minutes at a beat every fifteen seconds', () => {
    expect(ACTIVITY_MONITOR_HISTORY_DEPTH).toBe(240);
    expect(ACTIVITY_MONITOR_HISTORY_DEPTH * BEAT).toBe(ACTIVITY_MONITOR_HISTORY_SPAN_MS);
  });

  it('gives a first beat the memory and no rate, and the next one the rate over the whole beat', () => {
    const first = beat(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, [[ENGINE, 10]]);
    expect(first.beats).toEqual([
      { seq: 1, at: T0, points: { [ENGINE.id]: { cpuRate: null, memoryBytes: 212 * MB } } },
    ]);

    // Six CPU seconds in fifteen: the ring's own delta, whatever a viewer read in between.
    const second = beat(first, T0 + BEAT, [[{ ...ENGINE, cpuRate: 0.9, memoryBytes: 220 * MB }, 16]]);
    expect(second.beats[1]).toEqual({
      seq: 2,
      at: T0 + BEAT,
      points: { [ENGINE.id]: { cpuRate: 0.4, memoryBytes: 220 * MB } },
    });
  });

  it('takes no baseline from a beat too long ago — a gap, not the average over the quiet', () => {
    const first = beat(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, [[ENGINE, 10]]);
    const woke = T0 + ACTIVITY_MONITOR_HISTORY_BASELINE_MAX_AGE_MS + 1;
    const afterQuiet = beat(first, woke, [[ENGINE, 400]]);
    expect(afterQuiet.beats[1].points[ENGINE.id].cpuRate).toBeNull();

    const next = beat(afterQuiet, woke + BEAT, [[ENGINE, 401.5]]);
    expect(next.beats[2].points[ENGINE.id].cpuRate).toBeCloseTo(0.1, 10);
  });

  it('reads no rate for a process the beat before did not hold', () => {
    const first = beat(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, [[ENGINE, 10]]);
    const second = beat(first, T0 + BEAT, [
      [ENGINE, 10.3],
      [RUNTIME, 9],
    ]);
    expect(second.beats[1].points[ENGINE.id].cpuRate).toBeCloseTo(0.02, 10);
    expect(second.beats[1].points[RUNTIME.id].cpuRate).toBeNull();
  });

  it('keeps 240 beats: the oldest leaves as the next one lands', () => {
    const hour = idleBeats(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, 240);
    expect(seqs(hour.beats)).toHaveLength(240);
    expect(hour.beats[0].seq).toBe(1);

    const next = idleBeats(hour, T0 + 240 * BEAT, 1);
    expect(next.beats).toHaveLength(240);
    expect(next.beats[0].seq).toBe(2);
    expect(next.beats[239].seq).toBe(241);
  });

  it('drops every beat older than the span, however few there are', () => {
    const two = idleBeats(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, 2);
    const later = beat(two, T0 + ACTIVITY_MONITOR_HISTORY_SPAN_MS + BEAT, [[ENGINE, 10]]);
    expect(seqs(later.beats)).toEqual([3]);
  });
});

describe('a process that ended', () => {
  const running = beat(
    beat(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, [
      [ENGINE, 10],
      [RUNTIME, 1],
    ]),
    T0 + BEAT,
    [
      [ENGINE, 10],
      [RUNTIME, 16],
    ],
  );

  it('keeps its row as ended from the read that first found it gone — a viewer’s read, not only a beat', () => {
    expect(endedProcesses(running)).toEqual([]);

    const gone = observeHistoryProcesses(running, T0 + BEAT + 2_000, [ENGINE]);
    expect(endedProcesses(gone)).toEqual([
      { id: RUNTIME.id, kind: 'script-runtime', pid: 61_377, startedAt: RUNTIME.startedAt, endedAt: T0 + BEAT + 2_000 },
    ]);

    // Later reads do not move the time it ended.
    const later = idleBeats(gone, T0 + 2 * BEAT, 3);
    expect(endedProcesses(later).map((process) => process.endedAt)).toEqual([T0 + BEAT + 2_000]);
    expect(seriesPeak(processCpuSeries(later.beats, RUNTIME.id))).toBeCloseTo(1, 10);
  });

  it('leaves with its last point: no row, no series, once that beat ages out', () => {
    const gone = observeHistoryProcesses(running, T0 + BEAT + 2_000, [ENGINE]);
    // Its last point is the beat at T0 + BEAT; one beat short of an hour later it is still held.
    const almost = idleBeats(gone, T0 + 2 * BEAT, 239);
    expect(endedProcesses(almost)).toHaveLength(1);

    const aged = idleBeats(almost, T0 + 241 * BEAT, 1);
    expect(endedProcesses(aged)).toEqual([]);
    expect(seriesPeak(processCpuSeries(aged.beats, RUNTIME.id))).toBeNull();
  });

  it('is running again when a read finds it again', () => {
    const gone = observeHistoryProcesses(running, T0 + BEAT + 2_000, [ENGINE]);
    const back = observeHistoryProcesses(gone, T0 + BEAT + 4_000, [ENGINE, RUNTIME]);
    expect(endedProcesses(back)).toEqual([]);
  });

  it('leaves no row when it never met a beat', () => {
    const brief = makeRow({ kind: 'other', runtimeName: 'Audio Service', pid: 4377, startedAt: T0 + BEAT + 1_000 });
    const seen = observeHistoryProcesses(running, T0 + BEAT + 2_000, [ENGINE, RUNTIME, brief]);
    const gone = observeHistoryProcesses(seen, T0 + BEAT + 4_000, [ENGINE, RUNTIME]);
    expect(endedProcesses(gone)).toEqual([]);
  });

  it('returns the same history when a read changes nothing', () => {
    expect(observeHistoryProcesses(running, T0 + BEAT + 2_000, [ENGINE, RUNTIME])).toBe(running);
  });

  it('reads a reused pid with a new creation time as a new series, and ends the old one', () => {
    const reused = makeRow({ kind: 'script-runtime', pid: 61_377, startedAt: T0 + BEAT + 5_000 });
    const next = beat(running, T0 + 2 * BEAT, [
      [ENGINE, 10],
      [reused, 0.2],
    ]);
    expect(reused.id).not.toBe(RUNTIME.id);
    expect(endedProcesses(next).map((process) => process.id)).toEqual([RUNTIME.id]);
    expect(processCpuSeries(next.beats, RUNTIME.id).map((sample) => sample.value)).toEqual([null, 1, null]);
    expect(processCpuSeries(next.beats, reused.id).map((sample) => sample.value)).toEqual([null, null, null]);
    expect(next.beats[2].points[reused.id]).toEqual({ cpuRate: null, memoryBytes: 212 * MB });
  });
});

describe('the cursor', () => {
  const five = idleBeats(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, 5);

  it('counts beats: the newest one’s sequence number, 0 before the first', () => {
    expect(historyCursor(EMPTY_ACTIVITY_MONITOR_HISTORY)).toBe(0);
    expect(historyCursor(five)).toBe(5);
  });

  it('gives a first ask the whole ring, a later one only what is new, a caught-up one nothing', () => {
    expect(seqs(historyBeatsSince(five, null))).toEqual([1, 2, 3, 4, 5]);
    expect(seqs(historyBeatsSince(five, 3))).toEqual([4, 5]);
    expect(historyBeatsSince(five, 5)).toEqual([]);
  });

  it('gives a cursor ahead of the ring — one an earlier run handed out — the whole ring', () => {
    expect(seqs(historyBeatsSince(five, 99))).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives a cursor older than the oldest beat what is left', () => {
    const rolled = idleBeats(five, T0 + 5 * BEAT, 240);
    expect(historyBeatsSince(rolled, 2)).toHaveLength(240);
    expect(historyBeatsSince(rolled, 2)[0].seq).toBe(6);
  });
});

describe('mergeHistoryBeats — a viewer’s copy', () => {
  const five = idleBeats(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, 5);

  it('appends the beats an answer carries', () => {
    const held = historyBeatsSince(five, null);
    const more = idleBeats(five, T0 + 5 * BEAT, 2);
    expect(seqs(mergeHistoryBeats(held, historyBeatsSince(more, 5)))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns the copy itself when an answer carries nothing', () => {
    const held = historyBeatsSince(five, null);
    expect(mergeHistoryBeats(held, [])).toBe(held);
  });

  it('keeps the span as it appends: a copy left for an hour holds only the last sixty minutes', () => {
    const held = historyBeatsSince(five, null);
    const later = idleBeats(five, T0 + ACTIVITY_MONITOR_HISTORY_SPAN_MS, 240);
    const merged = mergeHistoryBeats(held, historyBeatsSince(later, 5));
    expect(merged).toHaveLength(240);
    expect(merged[0].seq).toBe(6);
  });

  it('is replaced by beats that do not continue it — the host started over', () => {
    const held = historyBeatsSince(five, null);
    const restarted = idleBeats(EMPTY_ACTIVITY_MONITOR_HISTORY, T0 + 10 * BEAT, 2);
    expect(seqs(mergeHistoryBeats(held, historyBeatsSince(restarted, 5)))).toEqual([1, 2]);
  });
});

describe('a series across the span', () => {
  const history = beat(
    beat(beat(EMPTY_ACTIVITY_MONITOR_HISTORY, T0, [[ENGINE, 10]]), T0 + ACTIVITY_MONITOR_HISTORY_SPAN_MS / 2 - BEAT, [
      [ENGINE, 10],
    ]),
    T0 + ACTIVITY_MONITOR_HISTORY_SPAN_MS / 2,
    [
      [ENGINE, 13],
      [RUNTIME, 15],
    ],
  );

  it('places each beat in the hour that ends at the newest one', () => {
    const series = processCpuSeries(history.beats, ENGINE.id);
    expect(series.map((sample) => sample.x)).toEqual([0.5, 1 - BEAT / ACTIVITY_MONITOR_HISTORY_SPAN_MS, 1]);
    expect(series.map((sample) => sample.value)).toEqual([null, null, 0.2]);
  });

  it('holds nothing where the process did not exist', () => {
    expect(processCpuSeries(history.beats, RUNTIME.id).map((sample) => sample.value)).toEqual([null, null, null]);
  });

  it('adds every process of a beat up, and reads nothing where nothing could be read', () => {
    expect(totalSeries(history.beats, 'memoryBytes').map((sample) => sample.value)).toEqual([
      212 * MB,
      212 * MB,
      (212 + 89) * MB,
    ]);
    expect(totalSeries(history.beats, 'cpuRate').map((sample) => sample.value)).toEqual([null, null, 0.2]);
  });

  it('reads the peak of what it holds, and none of an empty series', () => {
    expect(seriesPeak(totalSeries(history.beats, 'memoryBytes'))).toBe((212 + 89) * MB);
    expect(seriesPeak([])).toBeNull();
  });
});
