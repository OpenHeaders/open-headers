export interface ProcessInfo {
  parentPid: number;
  /** ms since epoch the process started. */
  startedAtMs: number;
  /** The base name of the executable; null where the system would not say. Never a path. */
  executableName: string | null;
  /** The controlling terminal's device number; negative when the process has none. */
  terminal: number;
}

/** Times in the kernel's own units — see `timebase()`. */
export interface ProcessUsage {
  userTime: number;
  systemTime: number;
  exitedChildrenUserTime: number;
  exitedChildrenSystemTime: number;
  footprintBytes: number;
  residentBytes: number;
}

export interface ProcessReaderBinding {
  /** The kernel's time unit: a count of them × `numer` / `denom` is nanoseconds. */
  timebase(): { numer: number; denom: number };
  /** null when no process holds the pid. */
  info(pid: number): ProcessInfo | null;
  /** null when the kernel refuses the read — a process of another user. */
  usage(pid: number): ProcessUsage | null;
  /** The pids whose parent is `pid`. */
  childPids(pid: number): number[];
  /** The pids on the controlling terminal with that device number. */
  terminalPids(terminal: number): number[];
}

/** The native binding; null on another platform or where the build is not there. */
export function load(): ProcessReaderBinding | null;
