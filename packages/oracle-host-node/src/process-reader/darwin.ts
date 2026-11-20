/**
 * The process reader on macOS (the activity monitor plan §7, fork 3):
 * the system's process library, reached through a small addon of our
 * own. This module is the addon's reading — the kernel's time units
 * turned into seconds, the footprint taken for memory (the figure the
 * system's own monitor shows, the plan §7, fork 10), a refused read
 * kept as "no cost" and never as zero. The binding is a dependency, so
 * all of it is pinned on every OS.
 */

import type { ProcessReader, ProcessRecord } from './seam';

/** What the addon answers. It reads no command line and hands over no path. */
export interface DarwinProcessBinding {
  /** The kernel's time unit: a count of them × `numer` / `denom` is nanoseconds. */
  timebase(): { numer: number; denom: number };
  /** null when there is no process under the pid. */
  info(pid: number): DarwinProcessInfo | null;
  /** null when the kernel refuses the read — a process of another user. */
  usage(pid: number): DarwinProcessUsage | null;
  /** The pids whose parent is `pid`. */
  childPids(pid: number): number[];
  /** The pids on a controlling terminal, by its device number. */
  terminalPids(terminal: number): number[];
}

export interface DarwinProcessInfo {
  parentPid: number;
  /** ms since epoch. */
  startedAtMs: number;
  /** The base name of the executable; null where the system would not say. */
  executableName: string | null;
  /** The controlling terminal's device number; negative when the process has none. */
  terminal: number;
}

/** Times in the kernel's own units — see {@link DarwinProcessBinding.timebase}. */
export interface DarwinProcessUsage {
  userTime: number;
  systemTime: number;
  exitedChildrenUserTime: number;
  exitedChildrenSystemTime: number;
  footprintBytes: number;
  residentBytes: number;
}

export function createDarwinProcessReader(binding: DarwinProcessBinding): ProcessReader {
  const { numer, denom } = binding.timebase();
  const seconds = (kernelTime: number): number => (kernelTime * numer) / denom / 1e9;

  return {
    memoryKind: 'footprint',

    read(pid): ProcessRecord | null {
      const info = binding.info(pid);
      if (info === null) return null;
      const usage = binding.usage(pid);
      return {
        pid,
        parentPid: info.parentPid,
        startedAt: info.startedAtMs,
        name: info.executableName,
        cost:
          usage === null
            ? null
            : {
                cpuSeconds: seconds(usage.userTime + usage.systemTime),
                exitedChildrenCpuSeconds: seconds(usage.exitedChildrenUserTime + usage.exitedChildrenSystemTime),
                memoryBytes: usage.footprintBytes,
              },
      };
    },

    childPids: (pid) => binding.childPids(pid),

    terminalPids(pid): number[] {
      const terminal = binding.info(pid)?.terminal ?? -1;
      return terminal < 0 ? [] : binding.terminalPids(terminal);
    },
  };
}
