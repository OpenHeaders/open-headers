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

/** Which figure `memoryBytes` is — the one each system's own monitor shows. */
export type ProcessMemoryKind = 'footprint' | 'resident';

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
  parentPid: number;
  /** ms since epoch the process started — with the pid, its identity: a pid is reused. */
  startedAt: number;
  /** The base name of its executable; null where the system would not say. */
  name: string | null;
  /** null where the system refuses the read — a process of another user. */
  cost: ProcessCost | null;
}

export interface ProcessReader {
  readonly memoryKind: ProcessMemoryKind;
  /** One process; null when there is none under that pid. */
  read(pid: number): ProcessRecord | null;
  /** The pids whose parent is `pid`, as the system lists them now. */
  childPids(pid: number): number[];
  /** The pids on the controlling terminal of `pid`, itself among them; empty when it has none. */
  terminalPids(pid: number): number[];
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
