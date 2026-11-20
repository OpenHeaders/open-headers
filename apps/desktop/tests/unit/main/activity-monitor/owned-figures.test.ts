/**
 * The owners of what the host started itself (the activity monitor plan
 * §6, laws 5 and 13): one read per owner under the owner's own key, its
 * figures the total of everything beneath its roots — each process's
 * own CPU time plus its exited children's — a terminal holding what
 * shares its terminal, and no read for an owner whose roots are gone.
 * What runs beneath its roots rides along — never the roots themselves
 * — each with what it used itself, the older process first.
 */

import type { ProcessCost, ProcessReader, RegisteredProcessRoot } from '@openheaders/oracle-host-node/process-reader';
import { describe, expect, it } from 'vitest';
import { readOwnedFigures } from '@/main/activity-monitor/owned-figures';

const T0 = 1_763_647_200_000;
const MB = 1024 * 1024;
const TERMINAL = 16_777_221;

interface Entry {
  parentPid: number;
  startedAt: number;
  terminal?: number;
  name?: string;
  cost?: ProcessCost | null;
}

function tableReader(table: Record<number, Entry>): ProcessReader {
  const pids = (): number[] => Object.keys(table).map(Number);
  return {
    memoryKind: 'footprint',
    read(pid) {
      const entry = table[pid];
      if (entry === undefined) return null;
      return {
        pid,
        parentPid: entry.parentPid,
        startedAt: entry.startedAt,
        name: entry.name ?? null,
        cost: entry.cost ?? null,
      };
    },
    childPids: (pid) => pids().filter((candidate) => table[candidate].parentPid === pid),
    terminalPids(pid) {
      const terminal = table[pid]?.terminal;
      return terminal === undefined ? [] : pids().filter((candidate) => table[candidate].terminal === terminal);
    },
  };
}

const cost = (cpuSeconds: number, exitedChildrenCpuSeconds: number, megabytes: number): ProcessCost => ({
  cpuSeconds,
  exitedChildrenCpuSeconds,
  memoryBytes: megabytes * MB,
});

const shellRoot = (pid: number, startedAt: number, session: string): RegisteredProcessRoot => ({
  owner: { kind: 'terminal', id: session },
  root: { pid, startedAt },
  terminal: true,
});

const gitRoot = (pid: number, startedAt: number): RegisteredProcessRoot => ({
  owner: { kind: 'git-objects' },
  root: { pid, startedAt },
  terminal: false,
});

describe('readOwnedFigures', () => {
  it('reads a terminal session as one owner: its shell and what runs beneath it, added up', () => {
    const reader = tableReader({
      61044: { parentPid: 4312, startedAt: T0, terminal: TERMINAL, name: 'zsh', cost: cost(0.5, 30, 6) },
      61060: { parentPid: 61_044, startedAt: T0 + 1_000, terminal: TERMINAL, name: 'node', cost: cost(2, 0, 48) },
      61102: { parentPid: 61_060, startedAt: T0 + 2_000, terminal: TERMINAL, name: 'node', cost: cost(40, 1.5, 164) },
    });
    expect(readOwnedFigures([shellRoot(61_044, T0, 'pty-1')], reader)).toEqual([
      {
        id: 'terminal:pty-1',
        kind: 'terminal',
        terminalSessionId: 'pty-1',
        pid: 61_044,
        startedAt: T0,
        processCount: 3,
        // Own time 42.5 s, and 31.5 s of children that came and went.
        cumulativeCpuSeconds: 74,
        memoryBytes: 218 * MB,
        // The shell is the row itself. Beneath it, each process with what it used ITSELF: the 1.5 s of
        // children that came and went are in the total, and in no line.
        children: [
          { pid: 61_060, startedAt: T0 + 1_000, name: 'node', cumulativeCpuSeconds: 2, memoryBytes: 48 * MB },
          { pid: 61_102, startedAt: T0 + 2_000, name: 'node', cumulativeCpuSeconds: 40, memoryBytes: 164 * MB },
        ],
      },
    ]);
  });

  it('lists what runs beneath an owner the older process first, a refused cost and a withheld name kept as they are', () => {
    const reader = tableReader({
      61044: { parentPid: 4312, startedAt: T0, terminal: TERMINAL, name: 'zsh', cost: cost(1, 0, 6) },
      61240: { parentPid: 61_044, startedAt: T0 + 9_000, terminal: TERMINAL, name: 'perl', cost: cost(3, 0, 8) },
      61250: { parentPid: 61_044, startedAt: T0 + 4_000, terminal: TERMINAL, name: 'sudo', cost: null },
      61300: { parentPid: 61_044, startedAt: T0 + 4_000, terminal: TERMINAL, cost: cost(0.25, 0, 2) },
    });
    const [read] = readOwnedFigures([shellRoot(61_044, T0, 'pty-1')], reader);
    expect(read.children).toEqual([
      { pid: 61_250, startedAt: T0 + 4_000, name: 'sudo', cumulativeCpuSeconds: undefined, memoryBytes: null },
      { pid: 61_300, startedAt: T0 + 4_000, name: null, cumulativeCpuSeconds: 0.25, memoryBytes: 2 * MB },
      { pid: 61_240, startedAt: T0 + 9_000, name: 'perl', cumulativeCpuSeconds: 3, memoryBytes: 8 * MB },
    ]);
  });

  it('keeps a process that detached from the shell in the terminal’s total: it still shares the terminal', () => {
    const reader = tableReader({
      61044: { parentPid: 4312, startedAt: T0, terminal: TERMINAL, cost: cost(1, 0, 6) },
      61200: { parentPid: 1, startedAt: T0 + 5_000, terminal: TERMINAL, cost: cost(9, 0, 20) },
    });
    const [read] = readOwnedFigures([shellRoot(61_044, T0, 'pty-1')], reader);
    expect(read).toMatchObject({ processCount: 2, cumulativeCpuSeconds: 10, memoryBytes: 26 * MB });
    expect(read.children.map((process) => process.pid)).toEqual([61_200]);
  });

  it('adds every root of one owner up under the owner’s key, shown by the root it started first', () => {
    const reader = tableReader({
      70002: { parentPid: 4312, startedAt: T0 + 9_000, cost: cost(0.25, 0, 4) },
      70001: { parentPid: 4312, startedAt: T0 + 1_000, cost: cost(0.5, 0, 5) },
    });
    expect(readOwnedFigures([gitRoot(70_002, T0 + 9_000), gitRoot(70_001, T0 + 1_000)], reader)).toEqual([
      {
        id: 'git-objects',
        kind: 'git',
        pid: 70_001,
        startedAt: T0 + 1_000,
        processCount: 2,
        cumulativeCpuSeconds: 0.75,
        memoryBytes: 9 * MB,
        // Both are roots of the one owner: neither runs beneath the other.
        children: [],
      },
    ]);
  });

  it('keeps an owner’s key when the process behind it is another one — a helper started again', () => {
    const helper = (pid: number, startedAt: number): RegisteredProcessRoot => ({
      owner: { kind: 'h3-helper' },
      root: { pid, startedAt },
      terminal: false,
    });
    const first = readOwnedFigures(
      [helper(80_001, T0)],
      tableReader({ 80001: { parentPid: 4312, startedAt: T0, cost: cost(12, 0, 30) } }),
    );
    const second = readOwnedFigures(
      [helper(80_777, T0 + 600_000)],
      tableReader({ 80777: { parentPid: 4312, startedAt: T0 + 600_000, cost: cost(0.1, 0, 22) } }),
    );
    expect(first.map((read) => [read.id, read.kind, read.pid])).toEqual([['h3-helper', 'http3-helper', 80_001]]);
    expect(second.map((read) => [read.id, read.kind, read.pid])).toEqual([['h3-helper', 'http3-helper', 80_777]]);
  });

  it('has no read for an owner whose root is gone, nor for one whose pid now names another process', () => {
    const reader = tableReader({
      61044: { parentPid: 1, startedAt: T0 + 60_000, terminal: TERMINAL, cost: cost(1, 0, 6) },
    });
    expect(readOwnedFigures([shellRoot(61_044, T0, 'pty-1'), gitRoot(70_001, T0)], reader)).toEqual([]);
  });

  it('reads no CPU counter and no memory where every cost was refused — a dash, not zero', () => {
    const reader = tableReader({ 61044: { parentPid: 4312, startedAt: T0, terminal: TERMINAL, cost: null } });
    const [read] = readOwnedFigures([shellRoot(61_044, T0, 'pty-1')], reader);
    expect(read).toMatchObject({ processCount: 1, cumulativeCpuSeconds: undefined, memoryBytes: null });
  });

  it('reads no owner on a host with no process reader', () => {
    expect(readOwnedFigures([shellRoot(61_044, T0, 'pty-1')], null)).toEqual([]);
  });
});
