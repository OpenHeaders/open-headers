/**
 * The activity monitor's history (the activity monitor plan §7, forks 2
 * and 4): a ring in memory — a beat every fifteen seconds, sixty minutes
 * deep, gone when the host quits. Pure folds: the host owns the timer
 * and the read; a viewer keeps its own copy and appends what each
 * answer carries past its cursor.
 *
 * A point's rate is the ring's OWN delta of the sampler's cumulative
 * counters between two beats (the plan §6, law 3), so it is the whole
 * of those fifteen seconds whether or not a viewer was asking in
 * between.
 */

import { type CpuCounterState, cpuRateBetween } from './cpu-rate';
import {
  type ActivityMonitorCursor,
  type ActivityMonitorEndedProcess,
  type ActivityMonitorHistoryBeat,
  type ActivityMonitorHistoryPoint,
  type ActivityMonitorProcessRow,
  sumReadable,
} from './model';

export const ACTIVITY_MONITOR_HISTORY_BEAT_MS = 15_000;
export const ACTIVITY_MONITOR_HISTORY_SPAN_MS = 60 * 60_000;
export const ACTIVITY_MONITOR_HISTORY_DEPTH = ACTIVITY_MONITOR_HISTORY_SPAN_MS / ACTIVITY_MONITOR_HISTORY_BEAT_MS;

/**
 * A beat this long after the one before it has no baseline — the
 * machine slept, or the clock moved. Its rate is a gap, never the
 * average over the quiet.
 */
export const ACTIVITY_MONITOR_HISTORY_BASELINE_MAX_AGE_MS = 2 * ACTIVITY_MONITOR_HISTORY_BEAT_MS;

interface TrackedProcess {
  row: ActivityMonitorProcessRow;
  /** The last beat that holds a point of it. */
  lastSeq: number;
  /** When a read first found it gone; null while it runs. */
  endedAt: number | null;
}

export interface ActivityMonitorHistory {
  /** Oldest first, consecutive by `seq`. */
  readonly beats: readonly ActivityMonitorHistoryBeat[];
  /** The last beat's counters — the next beat's baseline. */
  readonly counters: CpuCounterState | null;
  /** Every process with a point in the ring, running or ended. */
  readonly tracked: ReadonlyMap<string, TrackedProcess>;
  /** The newest beat's `seq`; 0 before the first. */
  readonly lastSeq: number;
}

export const EMPTY_ACTIVITY_MONITOR_HISTORY: ActivityMonitorHistory = {
  beats: [],
  counters: null,
  tracked: new Map(),
  lastSeq: 0,
};

/** What a beat is taken from: one read of the sampler. */
export interface ActivityMonitorHistoryRead {
  /** ms since epoch of the read. */
  at: number;
  processes: readonly ActivityMonitorProcessRow[];
  /** CPU seconds each process has used so far, by identity. */
  cpuSeconds: ReadonlyMap<string, number>;
}

function withinSpan(beats: readonly ActivityMonitorHistoryBeat[]): ActivityMonitorHistoryBeat[] {
  const newest = beats[beats.length - 1].at;
  return beats
    .filter((beat) => newest - beat.at < ACTIVITY_MONITOR_HISTORY_SPAN_MS)
    .slice(-ACTIVITY_MONITOR_HISTORY_DEPTH);
}

/**
 * Mark what a read no longer finds as ended at that read, and clear the
 * mark of anything it finds again. Every read passes through here, a
 * viewer's as well as a beat's, so a row turns into its ended row the
 * moment the process is gone and not at the next beat.
 */
export function observeHistoryProcesses(
  history: ActivityMonitorHistory,
  at: number,
  processes: readonly ActivityMonitorProcessRow[],
): ActivityMonitorHistory {
  const running = new Set(processes.map((row) => row.id));
  let tracked: Map<string, TrackedProcess> | null = null;
  for (const [id, entry] of history.tracked) {
    const endedAt = running.has(id) ? null : (entry.endedAt ?? at);
    if (endedAt === entry.endedAt) continue;
    tracked ??= new Map(history.tracked);
    tracked.set(id, { ...entry, endedAt });
  }
  return tracked === null ? history : { ...history, tracked };
}

/**
 * One beat: a point for every process in the read, the beats past the
 * span dropped, and with them every process whose last point they held.
 */
export function appendHistoryBeat(
  history: ActivityMonitorHistory,
  read: ActivityMonitorHistoryRead,
): ActivityMonitorHistory {
  const observed = observeHistoryProcesses(history, read.at, read.processes);
  const baseline =
    history.counters !== null && read.at - history.counters.at <= ACTIVITY_MONITOR_HISTORY_BASELINE_MAX_AGE_MS
      ? history.counters
      : null;
  const elapsedSeconds = baseline === null ? 0 : (read.at - baseline.at) / 1000;
  const seq = history.lastSeq + 1;
  const points: Record<string, ActivityMonitorHistoryPoint> = {};
  const tracked = new Map(observed.tracked);
  for (const row of read.processes) {
    const seconds = read.cpuSeconds.get(row.id);
    points[row.id] = {
      cpuRate: seconds === undefined ? null : cpuRateBetween(baseline?.seconds.get(row.id), seconds, elapsedSeconds),
      memoryBytes: row.memoryBytes,
    };
    tracked.set(row.id, { row, lastSeq: seq, endedAt: null });
  }
  const beats = withinSpan([...history.beats, { seq, at: read.at, points }]);
  const oldestSeq = beats[0].seq;
  for (const [id, entry] of tracked) {
    if (entry.lastSeq < oldestSeq) tracked.delete(id);
  }
  return { beats, counters: { at: read.at, seconds: read.cpuSeconds }, tracked, lastSeq: seq };
}

export function historyCursor(history: ActivityMonitorHistory): ActivityMonitorCursor {
  return history.lastSeq;
}

/**
 * The beats a caller does not hold yet. A first ask gets the whole
 * ring; so does a cursor ahead of the ring — it was handed out by an
 * earlier run of the host, and nothing of that run is left to continue.
 */
export function historyBeatsSince(
  history: ActivityMonitorHistory,
  cursor: ActivityMonitorCursor | null,
): ActivityMonitorHistoryBeat[] {
  const from = cursor === null || cursor > history.lastSeq ? 0 : history.beats.findIndex((beat) => beat.seq > cursor);
  return from === -1 ? [] : history.beats.slice(from);
}

export function endedProcesses(history: ActivityMonitorHistory): ActivityMonitorEndedProcess[] {
  const ended: ActivityMonitorEndedProcess[] = [];
  for (const { row, endedAt } of history.tracked.values()) {
    if (endedAt === null) continue;
    ended.push({
      id: row.id,
      kind: row.kind,
      ...(row.runtimeName === undefined ? {} : { runtimeName: row.runtimeName }),
      ...(row.terminalSessionId === undefined ? {} : { terminalSessionId: row.terminalSessionId }),
      pid: row.pid,
      startedAt: row.startedAt,
      endedAt,
    });
  }
  return ended;
}

/**
 * A viewer's copy after an answer: the carried beats appended and the
 * span re-applied. Beats that do not continue the copy replace it — the
 * host started over. Nothing carried returns the copy itself, so a
 * viewer can tell "no new beat" by identity.
 */
export function mergeHistoryBeats(
  held: readonly ActivityMonitorHistoryBeat[],
  carried: readonly ActivityMonitorHistoryBeat[],
): readonly ActivityMonitorHistoryBeat[] {
  if (carried.length === 0) return held;
  const continues = held.length > 0 && carried[0].seq > held[held.length - 1].seq;
  return withinSpan(continues ? [...held, ...carried] : carried);
}

/**
 * How much time the beats cover, each standing for the fifteen seconds
 * before it — what a graph of them spans, and what its label says. It
 * grows with the history until it is the whole span; 0 with no beat.
 */
export function historySpanMs(beats: readonly ActivityMonitorHistoryBeat[]): number {
  if (beats.length === 0) return 0;
  return Math.min(
    ACTIVITY_MONITOR_HISTORY_SPAN_MS,
    beats[beats.length - 1].at - beats[0].at + ACTIVITY_MONITOR_HISTORY_BEAT_MS,
  );
}

/** One figure across the history: where each beat sits between the oldest held and the newest, and its value. */
export interface ActivityMonitorSeriesSample {
  /** 0 at the oldest beat, 1 at the newest — the axis is the history there is, so a graph is full from its first beats. */
  x: number;
  /** null where there is nothing to draw — the process did not exist, or the figure could not be read. */
  value: number | null;
}

function seriesOf(
  beats: readonly ActivityMonitorHistoryBeat[],
  pick: (beat: ActivityMonitorHistoryBeat) => number | null,
): ActivityMonitorSeriesSample[] {
  if (beats.length === 0) return [];
  const oldest = beats[0].at;
  const length = beats[beats.length - 1].at - oldest;
  return beats.map((beat) => ({
    x: length > 0 ? (beat.at - oldest) / length : 1,
    value: pick(beat),
  }));
}

/** One process's CPU rate across the span (the plan §6, law 13: history is per owner). */
export function processCpuSeries(
  beats: readonly ActivityMonitorHistoryBeat[],
  id: string,
): ActivityMonitorSeriesSample[] {
  return seriesOf(beats, (beat) => beat.points[id]?.cpuRate ?? null);
}

/** Every process of a beat added up, for the header's line. */
export function totalSeries(
  beats: readonly ActivityMonitorHistoryBeat[],
  figure: keyof ActivityMonitorHistoryPoint,
): ActivityMonitorSeriesSample[] {
  return seriesOf(beats, (beat) => sumReadable(Object.values(beat.points).map((point) => point[figure])));
}

/** A series' highest value; null when it holds none. */
export function seriesPeak(samples: readonly ActivityMonitorSeriesSample[]): number | null {
  let peak: number | null = null;
  for (const { value } of samples) {
    if (value !== null && (peak === null || value > peak)) peak = value;
  }
  return peak;
}
