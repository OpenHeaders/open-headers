/**
 * A CPU rate from the sampler's own deltas (the activity monitor plan
 * §6, law 3). The runtime's percent is "since the previous call" — two
 * callers corrupt each other — so a rate here is the change of a
 * cumulative counter over the interval between two of OUR reads. Where
 * the runtime reports no cumulative counter, the same counter is
 * rebuilt by adding percent × interval, which holds only because one
 * sampler owns every read.
 */

/** A pid is reused; the creation time beside it is not. */
export function processIdentity(pid: number, creationTime: number): string {
  return `${pid}:${creationTime}`;
}

export interface CpuCounterRead {
  id: string;
  /** CPU seconds since the process started; absent where the runtime does not report it. */
  cumulativeSeconds?: number;
  /** The runtime's percent since its previous read, as a share of the whole machine — the rebuild's input. */
  percentOfMachine: number;
}

/** One read's counters, kept to take the next read's deltas from. */
export interface CpuCounterState {
  readonly at: number;
  readonly seconds: ReadonlyMap<string, number>;
}

export interface CpuCounterFold {
  state: CpuCounterState;
  /** CPU seconds per second of wall time by process; null where no earlier read of that process exists. */
  rates: ReadonlyMap<string, number | null>;
}

/**
 * A rate from two reads of one cumulative counter: null where no earlier
 * read exists or no time passed, zero where the counter went backwards.
 */
export function cpuRateBetween(before: number | undefined, now: number, elapsedSeconds: number): number | null {
  return before === undefined || elapsedSeconds <= 0 ? null : Math.max(0, now - before) / elapsedSeconds;
}

export function foldCpuCounters(
  previous: CpuCounterState | null,
  reads: readonly CpuCounterRead[],
  at: number,
  logicalCores: number,
): CpuCounterFold {
  const elapsedSeconds = previous === null ? 0 : Math.max(0, (at - previous.at) / 1000);
  const seconds = new Map<string, number>();
  const rates = new Map<string, number | null>();
  for (const read of reads) {
    const before = previous?.seconds.get(read.id);
    const now =
      read.cumulativeSeconds ??
      (before === undefined ? 0 : before + (read.percentOfMachine / 100) * logicalCores * elapsedSeconds);
    seconds.set(read.id, now);
    rates.set(read.id, cpuRateBetween(before, now, elapsedSeconds));
  }
  return { state: { at, seconds }, rates };
}
