/**
 * The process reader on Windows, as it reads its addon (the activity
 * monitor plan §4 and §7, forks 3 and 10): the system's file time
 * turned into ms since epoch, its 100 ns units into seconds, the
 * private working set for memory where this Windows counts it. The
 * addon is a dependency here — a made-up one answering figures SEEN on
 * Windows (the plan §4, the probe's third run) — so these run on every
 * OS.
 */

import { describe, expect, it } from 'vitest';
import {
  createWin32ProcessReader,
  readProcessDescendants,
  type Win32ProcessBinding,
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
  return { read };
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
