/**
 * The registry of the roots we start (the activity monitor plan §6,
 * laws 5 and 13): a root registered where it is spawned, its start time
 * read once through the host's reader; nothing held on a host with no
 * reader; an owner's key that outlives its processes; the subtree
 * beneath a root, and what it has cost — each process's own time plus
 * its exited children's.
 */

import { describe, expect, it } from 'vitest';
import {
  createProcessRootRegistry,
  type ProcessCost,
  type ProcessReader,
  processRootOwnerKey,
  type RegisteredProcessRoot,
  readProcessSubtree,
  totalProcessCost,
} from '../../../src/process-reader';

const T0 = Date.UTC(2026, 10, 20, 14, 0);
const MB = 1024 * 1024;

interface Entry {
  parentPid: number;
  startedAt: number;
  terminal?: number;
  /** null: the system refuses the read. */
  cost?: ProcessCost | null;
}

function tableReader(table: Record<number, Entry>): ProcessReader & { reads: number[] } {
  const reads: number[] = [];
  return {
    reads,
    memoryKind: 'footprint',
    read(pid) {
      reads.push(pid);
      const entry = table[pid];
      if (entry === undefined) return null;
      return { pid, parentPid: entry.parentPid, startedAt: entry.startedAt, name: null, cost: entry.cost ?? null };
    },
    childPids: (pid) =>
      Object.keys(table)
        .map(Number)
        .filter((candidate) => table[candidate].parentPid === pid),
    terminalPids(pid) {
      const terminal = table[pid]?.terminal;
      if (terminal === undefined) return [];
      return Object.keys(table)
        .map(Number)
        .filter((candidate) => table[candidate].terminal === terminal);
    },
  };
}

const cost = (cpuSeconds: number, exitedChildrenCpuSeconds: number, megabytes: number): ProcessCost => ({
  cpuSeconds,
  exitedChildrenCpuSeconds,
  memoryBytes: megabytes * MB,
});

describe('the registry of roots', () => {
  it('holds a root registered at its spawn, with the start time the reader gave at that instant — read once', () => {
    const reader = tableReader({ 61044: { parentPid: 4312, startedAt: T0 } });
    const roots = createProcessRootRegistry(reader);

    const registration = roots.register({ kind: 'terminal', id: 'pty-1' }, 61_044, { terminal: true });

    expect(registration.root).toEqual({ pid: 61_044, startedAt: T0 });
    expect(roots.list()).toEqual([
      { owner: { kind: 'terminal', id: 'pty-1' }, root: { pid: 61_044, startedAt: T0 }, terminal: true },
    ]);
    roots.list();
    expect(reader.reads).toEqual([61_044]);
  });

  it('lists roots in the order they were registered, and a root that is no terminal’s shell as such', () => {
    const roots = createProcessRootRegistry(
      tableReader({ 70: { parentPid: 1, startedAt: T0 }, 71: { parentPid: 1, startedAt: T0 + 5 } }),
    );
    roots.register({ kind: 'h3-helper' }, 71);
    roots.register({ kind: 'git-objects' }, 70);
    expect(roots.list().map((entry) => [entry.owner.kind, entry.root.pid, entry.terminal])).toEqual([
      ['h3-helper', 71, false],
      ['git-objects', 70, false],
    ]);
  });

  it('lets go of a root when it is released, once — a second release is nothing', () => {
    const roots = createProcessRootRegistry(
      tableReader({ 70: { parentPid: 1, startedAt: T0 }, 71: { parentPid: 1, startedAt: T0 } }),
    );
    const first = roots.register({ kind: 'git-objects' }, 70);
    roots.register({ kind: 'git-objects' }, 71);
    first.release();
    first.release();
    expect(roots.list().map((entry) => entry.root.pid)).toEqual([71]);
  });

  it('holds nothing on a host with no reader — it has no figure to give for a root', () => {
    const roots = createProcessRootRegistry();
    const registration = roots.register({ kind: 'terminal', id: 'pty-1' }, 61_044, { terminal: true });
    expect(registration.root).toBeNull();
    registration.release();
    expect(roots.list()).toEqual([]);
  });

  it('holds what is spawned after the host attached its reader', () => {
    const roots = createProcessRootRegistry();
    roots.attachReader(tableReader({ 70: { parentPid: 1, startedAt: T0 } }));
    expect(roots.register({ kind: 'h3-helper' }, 70).root).toEqual({ pid: 70, startedAt: T0 });
  });

  it('holds nothing for a spawn that failed, nor for a process already gone at its registration', () => {
    const roots = createProcessRootRegistry(tableReader({}));
    expect(roots.register({ kind: 'git-objects' }, undefined).root).toBeNull();
    expect(roots.register({ kind: 'git-objects' }, 70).root).toBeNull();
    expect(roots.list()).toEqual([]);
  });

  it('keys an owner by its kind, and by its id where a host runs more than one of the kind', () => {
    expect(processRootOwnerKey({ kind: 'h3-helper' })).toBe('h3-helper');
    expect(processRootOwnerKey({ kind: 'terminal', id: 'pty-3' })).toBe('terminal:pty-3');
  });
});

describe('the subtree beneath a registered root', () => {
  const TERMINAL = 16_777_221;
  const table: Record<number, Entry> = {
    100: { parentPid: 4312, startedAt: T0, terminal: TERMINAL },
    101: { parentPid: 100, startedAt: T0 + 1_000, terminal: TERMINAL },
    102: { parentPid: 101, startedAt: T0 + 2_000, terminal: TERMINAL },
    // Detached from the shell, still on its terminal.
    120: { parentPid: 1, startedAt: T0 + 3_000, terminal: TERMINAL },
  };
  const shell = (terminal: boolean): RegisteredProcessRoot => ({
    owner: { kind: 'terminal', id: 'pty-1' },
    root: { pid: 100, startedAt: T0 },
    terminal,
  });

  it('reads the root first, then everything walked down from it', () => {
    expect(readProcessSubtree(tableReader(table), shell(false)).map((record) => record.pid)).toEqual([100, 101, 102]);
  });

  it('holds what shares the terminal of a root registered as a terminal’s shell', () => {
    expect(readProcessSubtree(tableReader(table), shell(true)).map((record) => record.pid)).toEqual([
      100, 101, 102, 120,
    ]);
  });

  it('reads nothing once the root is gone, nor under a pid that now names another process', () => {
    expect(readProcessSubtree(tableReader({}), shell(true))).toEqual([]);
    const reused = tableReader({ ...table, 100: { parentPid: 1, startedAt: T0 + 60_000, terminal: TERMINAL } });
    expect(readProcessSubtree(reused, shell(true))).toEqual([]);
  });
});

describe('what a subtree has cost', () => {
  const record = (pid: number, entryCost: ProcessCost | null) => ({
    pid,
    parentPid: 1,
    startedAt: T0,
    name: null,
    cost: entryCost,
  });

  it('adds each process’s own CPU time to that of its children that exited, and the memory of each', () => {
    expect(totalProcessCost([record(100, cost(2, 30, 12)), record(101, cost(40.5, 0, 164))])).toEqual({
      cpuSeconds: 72.5,
      memoryBytes: 176 * MB,
    });
  });

  it('adds up what could be read beside a process whose cost was refused', () => {
    expect(totalProcessCost([record(100, cost(2, 1, 12)), record(101, null)])).toEqual({
      cpuSeconds: 3,
      memoryBytes: 12 * MB,
    });
  });

  it('is unreadable where no cost could be read — not zero', () => {
    expect(totalProcessCost([record(100, null)])).toEqual({ cpuSeconds: null, memoryBytes: null });
    expect(totalProcessCost([])).toEqual({ cpuSeconds: null, memoryBytes: null });
  });
});
