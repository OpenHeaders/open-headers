/**
 * The process reader's seam (the activity monitor plan §7, forks 3 and
 * 10): what one OS process costs, and what runs beneath one we started,
 * read from the system with no process started for the read. One seam,
 * an implementation per platform, each with its platform's own sources
 * injected so every pin runs on every OS.
 *
 * A process's command line is never read here (the plan §6, law 12): a
 * process is named by the base name of its executable and nothing else.
 */

/**
 * Which figure `memoryBytes` is — the one each system's own monitor
 * shows; the working set on a Windows that does not count the private
 * one.
 */
export type ProcessMemoryKind = 'footprint' | 'resident' | 'private-working-set' | 'working-set';

/** What a process has cost so far. */
export interface ProcessCost {
  /** CPU seconds it has used itself, user and system. */
  cpuSeconds: number;
  /** CPU seconds of its children that have exited and been waited for. */
  exitedChildrenCpuSeconds: number;
  memoryBytes: number;
}

export interface ProcessRecord {
  pid: number;
  /** null where the system has no read of it for one process — Windows. */
  parentPid: number | null;
  /** ms since epoch the process started — with the pid, its identity: a pid is reused. */
  startedAt: number;
  /** The base name of its executable; null where the system would not say. */
  name: string | null;
  /** null where the system refuses the read — a process of another user. */
  cost: ProcessCost | null;
}

/** A process we started: the pid we were handed and when it started. */
export interface ProcessRoot {
  pid: number;
  startedAt: number;
}

export interface ProcessDescendantsOptions {
  /**
   * The root is a terminal's shell: what shares its terminal belongs to
   * it too, so a process that detached from its parent stays in the row
   * (the plan §6, law 5).
   */
  terminal?: boolean;
}

/**
 * A root the reader holds (the plan §7, fork 3) — on Windows, where no
 * walk finds what runs beneath a process: the system itself keeps the
 * list of what the root started and the time all of it has used.
 * Holding watches and never rules: letting go ends nothing.
 */
export interface HeldProcessRoot {
  /**
   * The pids that are the root's own row, the root first — on Windows a
   * terminal's console host beside its shell. Never a line beneath it.
   */
  readonly ownPids: readonly number[];
  /** Every pid alive in what is held, the root's own among them. */
  memberPids(): number[];
  /**
   * CPU seconds of everything that has run in what is held, what has
   * ended included (the plan §6, law 13); null where the system would
   * not say.
   */
  cpuSeconds(): number | null;
  /** Lets go of the root. Safe to call more than once. */
  release(): void;
}

export interface ProcessReader {
  readonly memoryKind: ProcessMemoryKind;
  /** One process; null when there is none under that pid. */
  read(pid: number): ProcessRecord | null;
  /** The pids whose parent is `pid`, as the system lists them now. */
  childPids(pid: number): number[];
  /** The pids on the controlling terminal of `pid`, itself among them; empty when it has none. */
  terminalPids(pid: number): number[];
  /**
   * Holds a root from the instant it is registered. Absent where what
   * runs beneath a root is found by the walk; null where the system
   * would not hold this one — it is then walked like any other.
   */
  holdRoot?(root: ProcessRoot, options: ProcessDescendantsOptions): HeldProcessRoot | null;
}

/**
 * What runs beneath a root, found by walking DOWN from it — never by a
 * name, never by listing the machine where the platform has a call for
 * it. A parent id is believed only with the creation times in order: a
 * pid is reused, so a "child" older than its parent is some other
 * process that came to hold a dead child's number.
 *
 * Empty when the root itself is gone or its pid now names another
 * process.
 */
export function readProcessDescendants(
  reader: ProcessReader,
  root: ProcessRoot,
  options: ProcessDescendantsOptions = {},
): ProcessRecord[] {
  const rootRecord = reader.read(root.pid);
  if (rootRecord === null || rootRecord.startedAt !== root.startedAt) return [];

  const found = new Map<number, ProcessRecord>();
  const walk: ProcessRecord[] = [rootRecord];
  for (let parent = walk.pop(); parent !== undefined; parent = walk.pop()) {
    for (const pid of reader.childPids(parent.pid)) {
      if (pid === root.pid || found.has(pid)) continue;
      const child = reader.read(pid);
      if (child === null || child.parentPid !== parent.pid || child.startedAt < parent.startedAt) continue;
      found.set(pid, child);
      walk.push(child);
    }
  }

  if (options.terminal === true) {
    for (const pid of reader.terminalPids(root.pid)) {
      if (pid === root.pid || found.has(pid)) continue;
      const sharer = reader.read(pid);
      if (sharer === null || sharer.startedAt < root.startedAt) continue;
      found.set(pid, sharer);
    }
  }
  return [...found.values()];
}
