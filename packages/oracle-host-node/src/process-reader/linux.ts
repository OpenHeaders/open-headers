/**
 * The process reader on Linux (the activity monitor plan §7, fork 3):
 * a process's own files under /proc, read in plain JS — no addon, no
 * `ps` (the plan §6, law 9). The files are a dependency, so the reader
 * is pinned on kept text on every OS.
 *
 * What is read, and nothing else: `stat` (the parent, the terminal, the
 * CPU ticks, the start), `status` (resident size), the `exe` link (the
 * executable's base name) and each thread's `children`. Never `cmdline`
 * or `environ`, and never `comm` for a name — a process sets its own.
 */

import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import type { ProcessReader, ProcessRecord } from './seam';

export interface LinuxProcSource {
  /** A file's text; null when it is not there or may not be read. */
  readFile(path: string): string | null;
  /** A directory's entry names; null when it is not there. */
  readDir(path: string): string[] | null;
  /** A link's target; null when it is not there or may not be read. */
  readLink(path: string): string | null;
}

export interface LinuxProcessReaderOptions {
  /**
   * The unit of `stat`'s CPU and start fields. The kernel reports them
   * in USER_HZ, which is 100 on every architecture Node runs on.
   */
  clockTicksPerSecond?: number;
}

const USER_HZ = 100;

interface StatLine {
  parentPid: number;
  /** The controlling terminal's device number; 0 when the process has none. */
  terminal: number;
  cpuTicks: number;
  exitedChildrenCpuTicks: number;
  /** Ticks after the system booted. */
  startTicks: number;
}

/**
 * `pid (comm) state ppid pgrp session tty_nr … utime stime cutime
 * cstime … starttime …`. The name in parentheses is the process's own
 * to set and may hold spaces and parentheses, so the fields are counted
 * from the LAST closing one.
 */
function parseStat(text: string): StatLine | null {
  const close = text.lastIndexOf(')');
  if (close === -1) return null;
  const fields = text
    .slice(close + 1)
    .trim()
    .split(' ');
  const at = (index: number): number => Number(fields[index]);
  const stat: StatLine = {
    parentPid: at(1),
    terminal: at(4),
    cpuTicks: at(11) + at(12),
    exitedChildrenCpuTicks: at(13) + at(14),
    startTicks: at(19),
  };
  return Object.values(stat).every(Number.isFinite) ? stat : null;
}

const PID_ENTRY = /^\d+$/;

const BOOT_TIME = /^btime (\d+)$/m;
const RESIDENT_SIZE = /^VmRSS:\s+(\d+) kB$/m;

/** A link to an executable that was replaced on disk while it runs ends in this. */
const DELETED_SUFFIX = ' (deleted)';

function baseName(path: string): string {
  const whole = path.endsWith(DELETED_SUFFIX) ? path.slice(0, -DELETED_SUFFIX.length) : path;
  return whole.slice(whole.lastIndexOf('/') + 1);
}

export function createLinuxProcessReader(
  source: LinuxProcSource,
  options: LinuxProcessReaderOptions = {},
): ProcessReader {
  const ticksPerSecond = options.clockTicksPerSecond ?? USER_HZ;
  /** Seconds since the epoch the system booted; it does not change, so it is read once. */
  let bootSeconds: number | null = null;

  const readBootSeconds = (): number | null => {
    if (bootSeconds !== null) return bootSeconds;
    const found = source.readFile('/proc/stat')?.match(BOOT_TIME);
    bootSeconds = found ? Number(found[1]) : null;
    return bootSeconds;
  };

  const readStat = (pid: number): StatLine | null => {
    const text = source.readFile(`/proc/${pid}/stat`);
    return text === null ? null : parseStat(text);
  };

  const everyPid = (): number[] => (source.readDir('/proc') ?? []).filter((name) => PID_ENTRY.test(name)).map(Number);

  return {
    memoryKind: 'resident',

    read(pid): ProcessRecord | null {
      const stat = readStat(pid);
      const boot = readBootSeconds();
      if (stat === null || boot === null) return null;
      const link = source.readLink(`/proc/${pid}/exe`);
      // A process with no memory of its own — one that has exited and waits to be reaped — has no such line.
      const resident = source.readFile(`/proc/${pid}/status`)?.match(RESIDENT_SIZE);
      return {
        pid,
        parentPid: stat.parentPid,
        startedAt: Math.round((boot + stat.startTicks / ticksPerSecond) * 1000),
        name: link === null ? null : baseName(link),
        cost: {
          cpuSeconds: stat.cpuTicks / ticksPerSecond,
          exitedChildrenCpuSeconds: stat.exitedChildrenCpuTicks / ticksPerSecond,
          memoryBytes: resident ? Number(resident[1]) * 1024 : 0,
        },
      };
    },

    childPids(pid): number[] {
      const children = new Set<number>();
      // A child belongs to the thread that started it, so every thread's list is read.
      for (const thread of source.readDir(`/proc/${pid}/task`) ?? []) {
        const list = source.readFile(`/proc/${pid}/task/${thread}/children`);
        if (list === null) {
          // A kernel built without the list: the parent of every process is read instead.
          return everyPid().filter((candidate) => readStat(candidate)?.parentPid === pid);
        }
        for (const child of list.split(' ')) {
          if (PID_ENTRY.test(child)) children.add(Number(child));
        }
      }
      return [...children];
    },

    // Linux has no call for "the processes on this terminal": every process's terminal is read.
    terminalPids(pid): number[] {
      const terminal = readStat(pid)?.terminal ?? 0;
      if (terminal === 0) return [];
      return everyPid().filter((candidate) => readStat(candidate)?.terminal === terminal);
    },
  };
}

function orNull<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** The real /proc. */
export function createNodeProcSource(): LinuxProcSource {
  return {
    readFile: (path) => orNull(() => readFileSync(path, 'utf8')),
    readDir: (path) => orNull(() => readdirSync(path)),
    readLink: (path) => orNull(() => readlinkSync(path)),
  };
}
