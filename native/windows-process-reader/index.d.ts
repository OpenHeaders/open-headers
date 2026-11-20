/** One live process, as the system reads it by its pid. */
export interface ProcessRead {
  /** When it started, in the system's file time: 100 ns units since 1601-01-01 UTC. */
  createdFileTime: bigint;
  /** The CPU time it has used itself, user and kernel, in 100 ns units. */
  cpuTime: number;
  workingSetBytes: number;
  /** The figure the system's own monitor shows; null on a Windows that does not count it. */
  privateWorkingSetBytes: number | null;
  /** The base name of the executable; null where the system would not say. Never a path. */
  executableName: string | null;
}

export interface WindowsProcessReaderBinding {
  /** null when no live process holds the pid, or the system refuses even the limited query. */
  read(pid: number): ProcessRead | null;
}

/** The native binding; null on another platform or where the build is not there. */
export function load(): WindowsProcessReaderBinding | null;
