/**
 * The process reader on Windows, as it reads its addon (the activity
 * monitor plan §4 and §7, forks 3 and 10): the system's file time
 * turned into ms since epoch, its 100 ns units into seconds, the
 * private working set for memory where this Windows counts it. The
 * addon is a dependency here — a made-up one answering figures SEEN on
 * Windows (the plan §4, the probe's third run) — so these run on every
 * OS. Then a root it HOLDS: a job closed around it at its registration,
 * what it had already started put in by pid, a terminal's console host
 * paired with its shell.
 */

import { describe, expect, it } from 'vitest';
import {
  createWin32ProcessReader,
  type HeldProcessRoot,
  type ProcessReader,
  readProcessDescendants,
  type Win32Job,
  type Win32ProcessBinding,
  type Win32ProcessEntry,
  type Win32ProcessRead,
} from '../../../src/process-reader';

const KB = 1024;
const SELF_PID = 2776;

/** The app's main process as the system read it: started 1795198115125.5725 ms after the epoch. */
const CREATED_FILE_TIME = 134_396_717_151_255_725n;
const STARTED = 1_795_198_115_125.5725;

function makeRead(overrides: Partial<Win32ProcessRead> = {}): Win32ProcessRead {
  return {
    createdFileTime: CREATED_FILE_TIME,
    cpuTime: 3_750_000,
    workingSetBytes: 116_892 * KB,
    privateWorkingSetBytes: 39_804 * KB,
    executableName: 'Open Headers.exe',
    ...overrides,
  };
}

function makeBinding(read: Win32ProcessBinding['read'] = () => makeRead()): Win32ProcessBinding {
  return {
    read,
    snapshot: () => [],
    createJob: () => null,
    assignToJob: () => false,
    jobPids: () => null,
    jobCpuTime: () => null,
    closeJob: () => undefined,
  };
}

describe('createWin32ProcessReader', () => {
  it('turns the system’s file time into ms since epoch, keeping the part below a millisecond', () => {
    const reader = createWin32ProcessReader(makeBinding(), SELF_PID);
    expect(reader.read(SELF_PID)?.startedAt).toBe(STARTED);

    const epoch = createWin32ProcessReader(
      makeBinding(() => makeRead({ createdFileTime: 116_444_736_000_000_000n })),
      SELF_PID,
    );
    expect(epoch.read(SELF_PID)?.startedAt).toBe(0);
  });

  it('tells two starts a microsecond apart from each other', () => {
    const reader = createWin32ProcessReader(
      makeBinding((pid) => makeRead({ createdFileTime: CREATED_FILE_TIME + (pid === 8568 ? 10n : 0n) })),
      SELF_PID,
    );
    expect(reader.read(8568)?.startedAt).not.toBe(reader.read(5036)?.startedAt);
  });

  it('turns the system’s 100 ns units into CPU seconds, with no count of exited children', () => {
    const cost = createWin32ProcessReader(makeBinding(), SELF_PID).read(SELF_PID)?.cost;
    expect(cost?.cpuSeconds).toBe(0.375);
    expect(cost?.exitedChildrenCpuSeconds).toBe(0);
  });

  it('takes the private working set for memory — the figure the system’s own monitor shows — not the working set', () => {
    const reader = createWin32ProcessReader(makeBinding(), SELF_PID);
    expect(reader.memoryKind).toBe('private-working-set');
    expect(reader.read(SELF_PID)?.cost?.memoryBytes).toBe(39_804 * KB);
  });

  it('takes the working set, and says so, on a Windows that does not count the private one', () => {
    const reader = createWin32ProcessReader(
      makeBinding(() => makeRead({ privateWorkingSetBytes: null })),
      SELF_PID,
    );
    expect(reader.memoryKind).toBe('working-set');
    expect(reader.read(SELF_PID)?.cost?.memoryBytes).toBe(116_892 * KB);
  });

  it('settles which memory figure it reads once, from this process’s own read', () => {
    const asked: number[] = [];
    const reader = createWin32ProcessReader(
      makeBinding((pid) => {
        asked.push(pid);
        return makeRead();
      }),
      SELF_PID,
    );
    expect(asked).toEqual([SELF_PID]);
    reader.read(9776);
    reader.read(10_948);
    expect(asked).toEqual([SELF_PID, 9776, 10_948]);
  });

  it('gives a process no cost, never the other figure, where its read lacks the private working set', () => {
    const reader = createWin32ProcessReader(
      makeBinding((pid) => makeRead(pid === SELF_PID ? {} : { privateWorkingSetBytes: null })),
      SELF_PID,
    );
    expect(reader.read(9776)?.cost).toBeNull();
  });

  it('reads a process whole: its start, its executable’s base name, and no parent — the system has none to give', () => {
    expect(createWin32ProcessReader(makeBinding(), SELF_PID).read(SELF_PID)).toEqual({
      pid: SELF_PID,
      parentPid: null,
      startedAt: STARTED,
      name: 'Open Headers.exe',
      cost: { cpuSeconds: 0.375, exitedChildrenCpuSeconds: 0, memoryBytes: 39_804 * KB },
    });
  });

  it('keeps a process whose executable the system would not name', () => {
    const reader = createWin32ProcessReader(
      makeBinding(() => makeRead({ executableName: null })),
      SELF_PID,
    );
    expect(reader.read(SELF_PID)?.name).toBeNull();
  });

  it('answers null for a pid no live process holds', () => {
    const reader = createWin32ProcessReader(
      makeBinding((pid) => (pid === SELF_PID ? makeRead() : null)),
      SELF_PID,
    );
    expect(reader.read(999_999)).toBeNull();
  });

  it('walks nothing: it lists no children and no sharers, so a root has nothing beneath it', () => {
    const reader = createWin32ProcessReader(makeBinding(), SELF_PID);
    expect(reader.childPids(SELF_PID)).toEqual([]);
    expect(reader.terminalPids(5036)).toEqual([]);
    expect(readProcessDescendants(reader, { pid: 5036, startedAt: STARTED }, { terminal: true })).toEqual([]);
  });
});

/** One process of the made-up system: who started it, its executable, and how long after this process it started. */
interface FakeProcess {
  parentPid: number;
  name: string;
  startedAfterMs: number;
}

interface FakeJob {
  pids: Set<number>;
  cpuTime: number | null;
  closed: boolean;
}

interface FakeSystem {
  binding: Win32ProcessBinding;
  processes: Map<number, FakeProcess>;
  jobs: FakeJob[];
  /** Every pid put in a job by its own pid, in order. */
  assigned: number[];
  snapshots: number;
  /** The system makes no job. */
  noJobs: boolean;
  /** Pids the system will not put in a job. */
  unassignable: Set<number>;
}

/** The probe's host on Windows: the app's main process, and what a test adds beneath it. */
function makeSystem(processes: Record<number, FakeProcess> = {}): FakeSystem {
  const jobs = new Map<Win32Job, FakeJob>();
  const system: FakeSystem = {
    processes: new Map([
      [SELF_PID, { parentPid: 852, name: 'Open Headers.exe', startedAfterMs: 0 }],
      ...Object.entries(processes).map(([pid, process]): [number, FakeProcess] => [Number(pid), process]),
    ]),
    jobs: [],
    assigned: [],
    snapshots: 0,
    noJobs: false,
    unassignable: new Set(),
    binding: {
      read(pid) {
        const found = system.processes.get(pid);
        if (found === undefined) return null;
        return makeRead({
          createdFileTime: CREATED_FILE_TIME + BigInt(found.startedAfterMs) * 10_000n,
          executableName: found.name,
        });
      },
      snapshot(): Win32ProcessEntry[] {
        system.snapshots += 1;
        return [...system.processes].map(([pid, { parentPid, name }]) => ({ pid, parentPid, name }));
      },
      createJob() {
        if (system.noJobs) return null;
        const job: FakeJob = { pids: new Set(), cpuTime: 0, closed: false };
        const handle = {};
        jobs.set(handle, job);
        system.jobs.push(job);
        return handle;
      },
      assignToJob(handle, pid) {
        const job = jobs.get(handle);
        if (job === undefined || job.closed || system.unassignable.has(pid) || !system.processes.has(pid)) return false;
        system.assigned.push(pid);
        job.pids.add(pid);
        return true;
      },
      jobPids(handle) {
        const job = jobs.get(handle);
        return job === undefined || job.closed ? null : [...job.pids];
      },
      jobCpuTime(handle) {
        const job = jobs.get(handle);
        return job === undefined || job.closed ? null : job.cpuTime;
      },
      closeJob(handle) {
        const job = jobs.get(handle);
        if (job !== undefined) job.closed = true;
      },
    },
  };
  return system;
}

describe('createWin32ProcessReader — a root it holds', () => {
  // The probe's two terminals: each console host a child of the app's main process, started just before its shell.
  const CONSOLE_HOST_A = 11_924;
  const SHELL_A = 5036;
  const CONSOLE_HOST_B = 11_720;
  const SHELL_B = 8568;
  const terminalA: Record<number, FakeProcess> = {
    [CONSOLE_HOST_A]: { parentPid: SELF_PID, name: 'conhost.exe', startedAfterMs: 1_000 },
    [SHELL_A]: { parentPid: SELF_PID, name: 'cmd.exe', startedAfterMs: 1_040 },
  };
  const terminalB: Record<number, FakeProcess> = {
    [CONSOLE_HOST_B]: { parentPid: SELF_PID, name: 'conhost.exe', startedAfterMs: 5_000 },
    [SHELL_B]: { parentPid: SELF_PID, name: 'cmd.exe', startedAfterMs: 5_040 },
  };

  function hold(reader: ProcessReader, pid: number, terminal: boolean): HeldProcessRoot | null {
    const record = reader.read(pid);
    if (record === null || reader.holdRoot === undefined) throw new Error(`no root to hold under pid ${pid}`);
    return reader.holdRoot({ pid, startedAt: record.startedAt }, { terminal });
  }

  it('closes a job around the root: what the system lists in it runs beneath the root, what it has used is the job’s', () => {
    const system = makeSystem({ 70001: { parentPid: SELF_PID, name: 'git.exe', startedAfterMs: 9_000 } });
    const held = hold(createWin32ProcessReader(system.binding, SELF_PID), 70_001, false);

    expect(system.assigned).toEqual([70_001]);
    expect(held?.ownPids).toEqual([70_001]);
    expect(held?.memberPids()).toEqual([70_001]);

    // What the root starts from then on is the system's to add; the time of what came and went stays.
    system.jobs[0].pids.add(70_002);
    system.jobs[0].cpuTime = 9_750_000;
    expect(held?.memberPids()).toEqual([70_001, 70_002]);
    expect(held?.cpuSeconds()).toBe(0.975);
  });

  it('puts in, each by its own pid, what the root had started before the job closed around it — from ONE snapshot', () => {
    const system = makeSystem({
      ...terminalA,
      10152: { parentPid: SHELL_A, name: 'PING.EXE', startedAfterMs: 1_500 },
      6840: { parentPid: 10_152, name: 'node.exe', startedAfterMs: 1_600 },
      // Another shell's child is none of this root's.
      5488: { parentPid: SHELL_B, name: 'PING.EXE', startedAfterMs: 1_500 },
    });
    const held = hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, false);

    expect(system.snapshots).toBe(1);
    expect(system.assigned).toEqual([SHELL_A, 10_152, 6840]);
    expect(held?.memberPids()).toEqual([SHELL_A, 10_152, 6840]);
    held?.memberPids();
    held?.cpuSeconds();
    expect(system.snapshots).toBe(1);
  });

  it('does not believe a child older than its parent — a reused pid — nor put in what runs beneath it', () => {
    const system = makeSystem({
      ...terminalA,
      812: { parentPid: SHELL_A, name: 'svchost.exe', startedAfterMs: 20 },
      813: { parentPid: 812, name: 'node.exe', startedAfterMs: 2_000 },
    });
    hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, false);
    expect(system.assigned).toEqual([SHELL_A]);
  });

  it('pairs a terminal’s shell with its console host: in the shell’s job, and the row’s own beside the shell', () => {
    const system = makeSystem(terminalA);
    const held = hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, true);
    expect(held?.ownPids).toEqual([SHELL_A, CONSOLE_HOST_A]);
    expect(held?.memberPids()).toEqual([SHELL_A, CONSOLE_HOST_A]);
    expect(system.jobs).toHaveLength(1);
  });

  it('pairs no console host with a root that is no terminal’s shell', () => {
    const system = makeSystem(terminalA);
    expect(hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, false)?.ownPids).toEqual([SHELL_A]);
  });

  it('pairs each terminal with its own console host: one already paired, and one started after the shell, are another’s', () => {
    const system = makeSystem(terminalA);
    const reader = createWin32ProcessReader(system.binding, SELF_PID);
    const first = hold(reader, SHELL_A, true);
    for (const [pid, process] of Object.entries(terminalB)) system.processes.set(Number(pid), process);
    const second = hold(reader, SHELL_B, true);
    expect(first?.ownPids).toEqual([SHELL_A, CONSOLE_HOST_A]);
    expect(second?.ownPids).toEqual([SHELL_B, CONSOLE_HOST_B]);

    // Both terminals up before either is held: the first shell's console host is the one started before IT.
    const together = makeSystem({ ...terminalA, ...terminalB });
    expect(hold(createWin32ProcessReader(together.binding, SELF_PID), SHELL_A, true)?.ownPids).toEqual([
      SHELL_A,
      CONSOLE_HOST_A,
    ]);
  });

  it('takes the LATEST unpaired console host started before the shell — an older one left unpaired is not it', () => {
    const system = makeSystem({ ...terminalA, ...terminalB });
    expect(hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_B, true)?.ownPids).toEqual([
      SHELL_B,
      CONSOLE_HOST_B,
    ]);
  });

  it('knows a console host by this process being its parent and by its name, whatever the letter case', () => {
    const system = makeSystem({
      [SHELL_A]: terminalA[SHELL_A],
      // A console host another program started, and a child of ours that is no console host.
      9001: { parentPid: 4444, name: 'conhost.exe', startedAfterMs: 1_010 },
      9002: { parentPid: SELF_PID, name: 'git.exe', startedAfterMs: 1_020 },
      [CONSOLE_HOST_A]: { parentPid: SELF_PID, name: 'Conhost.EXE', startedAfterMs: 1_000 },
    });
    expect(hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, true)?.ownPids).toEqual([
      SHELL_A,
      CONSOLE_HOST_A,
    ]);
  });

  it('leaves a console host the system will not put in the job out of the row', () => {
    const system = makeSystem(terminalA);
    system.unassignable.add(CONSOLE_HOST_A);
    const held = hold(createWin32ProcessReader(system.binding, SELF_PID), SHELL_A, true);
    expect(held?.ownPids).toEqual([SHELL_A]);
    expect(held?.memberPids()).toEqual([SHELL_A]);
  });

  it('lets go of the job at the release, once, and of the pairing — the job answers nothing after', () => {
    const system = makeSystem(terminalA);
    const reader = createWin32ProcessReader(system.binding, SELF_PID);
    const held = hold(reader, SHELL_A, true);
    held?.release();
    expect(system.jobs[0].closed).toBe(true);
    expect(held?.memberPids()).toEqual([]);
    expect(held?.cpuSeconds()).toBeNull();

    system.jobs[0].closed = false;
    held?.release();
    expect(system.jobs[0].closed).toBe(false);

    // A pid the system hands a later console host is free to be paired again.
    expect(hold(reader, SHELL_A, true)?.ownPids).toEqual([SHELL_A, CONSOLE_HOST_A]);
  });

  it('holds nothing where the system makes no job, nor where it will not put the root in one — and keeps no job open', () => {
    const none = makeSystem(terminalA);
    none.noJobs = true;
    expect(hold(createWin32ProcessReader(none.binding, SELF_PID), SHELL_A, true)).toBeNull();

    const refused = makeSystem(terminalA);
    refused.unassignable.add(SHELL_A);
    expect(hold(createWin32ProcessReader(refused.binding, SELF_PID), SHELL_A, true)).toBeNull();
    expect(refused.jobs[0].closed).toBe(true);
    expect(refused.snapshots).toBe(0);
  });
});
