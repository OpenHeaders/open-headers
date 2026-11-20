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
 * listing the machine: nothing is walked here, so an owner's row is its
 * root alone.
 */

import type { ProcessMemoryKind, ProcessReader, ProcessRecord } from './seam';

/** What the addon answers. It reads no command line and hands over no path. */
export interface Win32ProcessBinding {
  /** null when no live process holds the pid, or the system refuses even the limited query. */
  read(pid: number): Win32ProcessRead | null;
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

/** The system's file time at the epoch ms are counted from. */
const EPOCH_FILE_TIME = 116_444_736_000_000_000n;
const UNITS_PER_MS = 10_000n;
const UNITS_PER_SECOND = 1e7;

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

  return {
    memoryKind,

    read(pid): ProcessRecord | null {
      const read = binding.read(pid);
      if (read === null) return null;
      const memoryBytes = memoryKind === 'private-working-set' ? read.privateWorkingSetBytes : read.workingSetBytes;
      return {
        pid,
        parentPid: null,
        startedAt: startedAtMs(read.createdFileTime),
        name: read.executableName,
        cost:
          memoryBytes === null
            ? null
            : {
                cpuSeconds: read.cpuTime / UNITS_PER_SECOND,
                exitedChildrenCpuSeconds: 0,
                memoryBytes,
              },
      };
    },

    childPids: () => [],

    terminalPids: () => [],
  };
}
