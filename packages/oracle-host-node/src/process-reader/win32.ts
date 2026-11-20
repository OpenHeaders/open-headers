/**
 * The process reader on Windows (the activity monitor plan §7, fork 3):
 * one process by its pid, on the limited query right, reached through a
 * small addon of our own. This module is the addon's reading — the
 * system's file time turned into ms since epoch, its 100 ns units into
 * seconds, the private working set taken for memory (the figure the
 * system's own monitor shows, the plan §7, fork 10) where this Windows
 * counts it and the working set where it does not. The binding is a
 * dependency, so all of it is pinned on every OS.
 *
 * Windows keeps no count of a process's exited children, and has no
 * call for a process's children or for what shares its console short of
 * listing the machine. So nothing is walked here: a root is HELD — a
 * job object closed around it at its registration, whose member list is
 * what runs beneath the root (a process whose starter has exited
 * among them) and whose accounting is the time all of it has used. The
 * job watches and never rules: it is never kill-on-close, and a program
 * that asks to leave it is let go — and leaves the row.
 */

import type {
  HeldProcessRoot,
  ProcessDescendantsOptions,
  ProcessMemoryKind,
  ProcessReader,
  ProcessRecord,
  ProcessRoot,
} from './seam';

/** What the addon answers. It reads no command line and hands over no path. */
export interface Win32ProcessBinding {
  /** null when no live process holds the pid, or the system refuses even the limited query. */
  read(pid: number): Win32ProcessRead | null;
  /** The documented snapshot of the process table — every process on the machine, so taken once at a registration and never on a beat. */
  snapshot(): Win32ProcessEntry[];
  /** A job a program may leave when it asks to, never kill-on-close; null where the system would not make one. */
  createJob(): Win32Job | null;
  /** Whether the process is now in the job — what it starts from then on is in it too. */
  assignToJob(job: Win32Job, pid: number): boolean;
  /** The pids alive in the job; null where the system would not say, or the job is closed. */
  jobPids(job: Win32Job): number[] | null;
  /** The CPU time, in 100 ns units, of every process that has run in the job, those that have ended included; null where the system would not say. */
  jobCpuTime(job: Win32Job): number | null;
  /** Lets go of the job. Ends nothing. */
  closeJob(job: Win32Job): void;
}

export interface Win32ProcessRead {
  /** When it started, in the system's file time: 100 ns units since 1601-01-01 UTC. */
  createdFileTime: bigint;
  /** The CPU time it has used itself, user and kernel, in 100 ns units. */
  cpuTime: number;
  workingSetBytes: number;
  /** null on a Windows that does not count it. */
  privateWorkingSetBytes: number | null;
  /** The base name of the executable; null where the system would not say. */
  executableName: string | null;
}

export interface Win32ProcessEntry {
  pid: number;
  /** As the system recorded it at the start — never updated, and a pid is reused. */
  parentPid: number;
  /** The base name of the executable. */
  name: string;
}

/** A job the addon made — its own to read. */
export type Win32Job = object;

/** The system's file time at the epoch ms are counted from. */
const EPOCH_FILE_TIME = 116_444_736_000_000_000n;
const UNITS_PER_MS = 10_000n;
const UNITS_PER_SECOND = 1e7;

/** The system's console host, by its executable's base name. */
const CONSOLE_HOST = 'conhost.exe';

/** ms since epoch with the part below a millisecond kept: two starts inside one millisecond stay two. */
function startedAtMs(fileTime: bigint): number {
  const units = fileTime - EPOCH_FILE_TIME;
  return Number(units / UNITS_PER_MS) + Number(units % UNITS_PER_MS) / Number(UNITS_PER_MS);
}

export function createWin32ProcessReader(binding: Win32ProcessBinding, selfPid: number): ProcessReader {
  // Whether this Windows counts the private working set is the same for every process: this one's read settles it.
  const self = binding.read(selfPid);
  const memoryKind: ProcessMemoryKind =
    self !== null && self.privateWorkingSetBytes !== null ? 'private-working-set' : 'working-set';
  const selfStartedAt = self === null ? 0 : startedAtMs(self.createdFileTime);

  /** The console hosts already paired with a terminal's shell. */
  const pairedConsoleHosts = new Set<number>();

  const read = (pid: number): ProcessRecord | null => {
    const found = binding.read(pid);
    if (found === null) return null;
    const memoryBytes = memoryKind === 'private-working-set' ? found.privateWorkingSetBytes : found.workingSetBytes;
    return {
      pid,
      parentPid: null,
      startedAt: startedAtMs(found.createdFileTime),
      name: found.executableName,
      cost:
        memoryBytes === null
          ? null
          : {
              cpuSeconds: found.cpuTime / UNITS_PER_SECOND,
              exitedChildrenCpuSeconds: 0,
              memoryBytes,
            },
    };
  };

  /**
   * What the root had started by the snapshot, walked down by parent
   * ids — each believed only with the creation times in order (the plan
   * §6, law 5).
   */
  const startedBeneath = (table: readonly Win32ProcessEntry[], root: ProcessRoot): number[] => {
    const found = new Set<number>();
    const walk: ProcessRoot[] = [root];
    for (let parent = walk.pop(); parent !== undefined; parent = walk.pop()) {
      for (const entry of table) {
        if (entry.parentPid !== parent.pid || entry.pid === root.pid || found.has(entry.pid)) continue;
        const startedAt = read(entry.pid)?.startedAt;
        if (startedAt === undefined || startedAt < parent.startedAt) continue;
        found.add(entry.pid);
        walk.push({ pid: entry.pid, startedAt });
      }
    }
    return [...found];
  };

  /**
   * The console host of a terminal's shell. The pty starts it and then
   * the shell in one call nothing else of ours runs inside, both as
   * children of this very process — so it is the latest console host
   * this process started before the shell that no other shell is paired
   * with.
   */
  const consoleHostOf = (table: readonly Win32ProcessEntry[], shell: ProcessRoot): number | null => {
    let host: ProcessRoot | null = null;
    for (const entry of table) {
      if (entry.parentPid !== selfPid || pairedConsoleHosts.has(entry.pid)) continue;
      if (entry.name.toLowerCase() !== CONSOLE_HOST) continue;
      const startedAt = read(entry.pid)?.startedAt;
      if (startedAt === undefined || startedAt < selfStartedAt || startedAt > shell.startedAt) continue;
      if (host === null || startedAt > host.startedAt) host = { pid: entry.pid, startedAt };
    }
    return host?.pid ?? null;
  };

  return {
    memoryKind,

    read,

    childPids: () => [],

    terminalPids: () => [],

    holdRoot(root: ProcessRoot, options: ProcessDescendantsOptions): HeldProcessRoot | null {
      const job = binding.createJob();
      if (job === null) return null;
      if (!binding.assignToJob(job, root.pid)) {
        binding.closeJob(job);
        return null;
      }

      // What the root starts from here on is in the job. What it started before is not: one
      // snapshot finds it, and each is put in by its own pid.
      const table = binding.snapshot();
      const members = new Set(binding.jobPids(job) ?? []);
      for (const pid of startedBeneath(table, root)) {
        if (!members.has(pid)) binding.assignToJob(job, pid);
      }

      // A terminal's console host is no child of its shell: it is put in the shell's job, and is the row itself.
      const consoleHost = options.terminal === true ? consoleHostOf(table, root) : null;
      const ownPids = [root.pid];
      if (consoleHost !== null && binding.assignToJob(job, consoleHost)) {
        pairedConsoleHosts.add(consoleHost);
        ownPids.push(consoleHost);
      }

      let released = false;
      return {
        ownPids,
        memberPids: () => binding.jobPids(job) ?? [],
        cpuSeconds: () => {
          const cpuTime = binding.jobCpuTime(job);
          return cpuTime === null ? null : cpuTime / UNITS_PER_SECOND;
        },
        release: () => {
          if (released) return;
          released = true;
          if (consoleHost !== null) pairedConsoleHosts.delete(consoleHost);
          binding.closeJob(job);
        },
      };
    },
  };
}
