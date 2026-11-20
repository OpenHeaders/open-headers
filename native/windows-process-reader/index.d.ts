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

/** One row of the documented snapshot of the process table. */
export interface ProcessEntry {
  pid: number;
  /** As the system recorded it at the start — never updated, and a pid is reused. */
  parentPid: number;
  /** The base name of the executable. Never a path. */
  name: string;
}

/** A job this addon made. It watches and never rules: closing it ends nothing. */
export type Job = object;

export interface WindowsProcessReaderBinding {
  /** null when no live process holds the pid, or the system refuses even the limited query. */
  read(pid: number): ProcessRead | null;
  /** Every process on the machine: pid, parent pid, base name. Empty where the system would not give one. */
  snapshot(): ProcessEntry[];
  /** A job a program may leave when it asks to, never kill-on-close; null where the system would not make one. */
  createJob(): Job | null;
  /** Whether the process is now in the job — what it starts from then on is in it too. */
  assignToJob(job: Job, pid: number): boolean;
  /** The pids alive in the job; null where the system would not say, or the job is closed. */
  jobPids(job: Job): number[] | null;
  /**
   * The CPU time, user and kernel, in 100 ns units, of every process
   * that has run in the job — those that have ended included; null
   * where the system would not say, or the job is closed.
   */
  jobCpuTime(job: Job): number | null;
  /** Lets go of the job. Ends nothing; a second call is nothing. */
  closeJob(job: Job): void;
}

/** The native binding; null on another platform or where the build is not there. */
export function load(): WindowsProcessReaderBinding | null;
