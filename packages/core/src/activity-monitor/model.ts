/**
 * The activity monitor's model (the activity monitor plan §9): what a
 * process row is, the vocabulary its name is drawn from, and the answer
 * a viewer's ask carries over the host bridge. The host that owns the
 * read fills it; a document only formats it.
 */

import type { BrowserKind } from '../utils/host-detect';

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
 * What the engine keeps running with no process of its own (the plan
 * §7, fork 1), in the order the panel lists it. A service row carries
 * facts — a state, a count, a next time — never a cost: one thread has
 * no CPU or memory figure to give per service (the plan §6, law 6).
 */
export const ACTIVITY_MONITOR_SERVICE_KINDS = [
  'sync-server',
  'workflows',
  'git',
  'mcp-server',
  'proxy-capture',
] as const;

export type ActivityMonitorServiceKind = (typeof ACTIVITY_MONITOR_SERVICE_KINDS)[number];

/** `unreadable` is a service whose owner could not be asked — it reads as a dash, never as off. */
export type ActivityMonitorServiceState = 'on' | 'off' | 'unreadable';

/** A connected peer as the peer registry names it: the role it announced and, for a browser's, which browser. */
export interface ActivityMonitorPeer {
  role: string;
  browser: BrowserKind | null;
}

/**
 * One service's facts, read from the registry that owns them when the
 * viewer asks (the plan §6, law 4). Structured fields only — the
 * interface words the line; the host sends no sentence.
 */
export type ActivityMonitorServiceRow =
  | {
      kind: 'sync-server';
      state: ActivityMonitorServiceState;
      /** The address the server is bound to, or was last asked to bind; null before any bind. */
      host: string | null;
      port: number | null;
      peers: ActivityMonitorPeer[];
    }
  | {
      kind: 'workflows';
      state: ActivityMonitorServiceState;
      /** Workflows with a refresh armed. */
      scheduled: number;
      /** ms since epoch of the earliest armed refresh; null when none is armed. */
      nextFireAt: number | null;
    }
  | {
      kind: 'git';
      state: ActivityMonitorServiceState;
      /** Workspaces bound to a folder. */
      bound: number;
      /** Of those, the ones whose folder is open and watched for changes. */
      watching: number;
    }
  | { kind: 'mcp-server'; state: ActivityMonitorServiceState }
  | {
      kind: 'proxy-capture';
      state: ActivityMonitorServiceState;
      /** The port the capture proxy listens on; null while it is off. */
      port: number | null;
    };

/** One process at one beat of the history. */
export interface ActivityMonitorHistoryPoint {
  /** CPU seconds per second over the whole beat; null where the beat before it is no baseline. */
  cpuRate: number | null;
  memoryBytes: number | null;
}

/**
 * One beat of the host's history (the plan §7, fork 2): every process
 * the host read at that instant, by identity. A process absent from a
 * beat did not exist at it.
 */
export interface ActivityMonitorHistoryBeat {
  /** The beat's place in the host's sequence — what a cursor counts. */
  seq: number;
  /** ms since epoch. */
  at: number;
  points: Record<string, ActivityMonitorHistoryPoint>;
}

/**
 * A process that ended while the history still holds a point of it. It
 * keeps its row — a dash for CPU, when it ended — until its last point
 * ages out.
 */
export interface ActivityMonitorEndedProcess {
  id: string;
  kind: ActivityMonitorProcessKind;
  runtimeName?: string;
  pid: number;
  /** ms since epoch. */
  startedAt: number;
  /** ms since epoch of the read that first found it gone. */
  endedAt: number;
}

/**
 * How far into the host's history the caller has read (the plan §7,
 * fork 4): the sequence number of the last beat it holds, 0 for none.
 */
export type ActivityMonitorCursor = number;

export interface ActivityMonitorSnapshot {
  /** ms since epoch of the read the rows come from. */
  sampledAt: number;
  platform: ActivityMonitorPlatform;
  /** Logical cores of the machine — what a share of the whole machine is a share of. */
  logicalCores: number;
  processes: ActivityMonitorProcessRow[];
  /** What the engine keeps running, in the vocabulary's order; a kind the host has no owner for is absent. */
  services: ActivityMonitorServiceRow[];
  /** The history's beats past the caller's cursor, oldest first — everything the host holds on a first ask. */
  history: ActivityMonitorHistoryBeat[];
  ended: ActivityMonitorEndedProcess[];
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
export function compareProcessOrder(
  a: Pick<ActivityMonitorProcessRow, 'kind' | 'startedAt' | 'pid'>,
  b: Pick<ActivityMonitorProcessRow, 'kind' | 'startedAt' | 'pid'>,
): number {
  return (
    ACTIVITY_MONITOR_PROCESS_KINDS.indexOf(a.kind) - ACTIVITY_MONITOR_PROCESS_KINDS.indexOf(b.kind) ||
    a.startedAt - b.startedAt ||
    a.pid - b.pid
  );
}

export function arrangeProcessRows(rows: readonly ActivityMonitorProcessRow[]): ArrangedProcessRows {
  const ordered = [...rows].sort(compareProcessOrder);
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
