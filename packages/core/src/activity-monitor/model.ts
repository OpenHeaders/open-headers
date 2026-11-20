/**
 * The activity monitor's model (the activity monitor plan §9): what a
 * process row is, the vocabulary its name is drawn from, and the answer
 * a viewer's ask carries over the host bridge. The host that owns the
 * read fills it; a document only formats it.
 */

/**
 * What a process is, in the words the interface already uses (the plan
 * §6, law 1), in the order the table lists them. `other` is every
 * process the host has no name for — kept under one collapsed group by
 * the runtime's own name, never dropped.
 */
export const ACTIVITY_MONITOR_PROCESS_KINDS = [
  'window',
  'engine',
  'graphics',
  'network',
  'script-sandbox',
  'script-runtime',
  'other',
] as const;

export type ActivityMonitorProcessKind = (typeof ACTIVITY_MONITOR_PROCESS_KINDS)[number];

/** The operating systems the host runs on — "CPU %" follows each one's own monitor (the plan §7, fork 8). */
export type ActivityMonitorPlatform = 'darwin' | 'win32' | 'linux';

export interface ActivityMonitorProcessRow {
  /** The process's identity — its pid AND its creation time, since a pid is reused. */
  id: string;
  kind: ActivityMonitorProcessKind;
  /** The runtime's own name for the process — on `other` rows only, shown as given. */
  runtimeName?: string;
  pid: number;
  /** ms since epoch. */
  startedAt: number;
  /** CPU seconds per second of wall time (1 is one full core); null until two reads of this process exist. */
  cpuRate: number | null;
  /** Bytes; null where the host could not read it. */
  memoryBytes: number | null;
}

/**
 * How far into the host's history the caller has read. It rides the
 * contract from the first slice (the plan §7, fork 4) and carries
 * nothing until the history lands.
 */
export type ActivityMonitorCursor = number;

export interface ActivityMonitorSnapshot {
  /** ms since epoch of the read the rows come from. */
  sampledAt: number;
  platform: ActivityMonitorPlatform;
  /** Logical cores of the machine — what a share of the whole machine is a share of. */
  logicalCores: number;
  processes: ActivityMonitorProcessRow[];
  cursor: ActivityMonitorCursor;
}

export interface ArrangedProcessRows {
  /** The rows the interface has a name for, in the vocabulary's order. */
  named: ActivityMonitorProcessRow[];
  /** The rest — the collapsed group's members. */
  other: ActivityMonitorProcessRow[];
}

/**
 * The table's fixed order: by kind as the vocabulary lists it, then the
 * older process first, then the pid. A row keeps its place from one
 * answer to the next — only its figures change.
 */
export function arrangeProcessRows(rows: readonly ActivityMonitorProcessRow[]): ArrangedProcessRows {
  const ordered = [...rows].sort(
    (a, b) =>
      ACTIVITY_MONITOR_PROCESS_KINDS.indexOf(a.kind) - ACTIVITY_MONITOR_PROCESS_KINDS.indexOf(b.kind) ||
      a.startedAt - b.startedAt ||
      a.pid - b.pid,
  );
  return {
    named: ordered.filter((row) => row.kind !== 'other'),
    other: ordered.filter((row) => row.kind === 'other'),
  };
}

/** A group's figure: the sum of what could be read, null when nothing could. */
export function sumReadable(values: readonly (number | null)[]): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (value !== null) total = (total ?? 0) + value;
  }
  return total;
}
