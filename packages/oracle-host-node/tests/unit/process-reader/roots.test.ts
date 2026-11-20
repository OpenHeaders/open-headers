/**
 * The registry of the roots we start (the activity monitor plan §6,
 * laws 5 and 13): a root registered where it is spawned, its start time
 * read once through the host's reader; nothing held on a host with no
 * reader; an owner's key that outlives its processes; the subtree
 * beneath a root, and what it has cost — each process's own time plus
 * its exited children's. And a root the reader HOLDS (the plan §7, fork
 * 3): held from its registration to its release, what runs beneath it
 * and the time all of it has used read from what is held.
 */

import { describe, expect, it } from 'vitest';
import {
  createProcessRootRegistry,
  type HeldProcessRoot,
  type ProcessCost,
  type ProcessReader,
  type ProcessRoot,
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

    const registered = {
      owner: { kind: 'terminal', id: 'pty-1' },
      root: { pid: 61_044, startedAt: T0 },
      terminal: true,
    };
    expect(registration.registered).toEqual(registered);
    expect(roots.list()).toEqual([registered]);
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
    expect(registration.registered).toBeNull();
    registration.release();
    expect(roots.list()).toEqual([]);
  });

  it('holds what is spawned after the host attached its reader', () => {
    const roots = createProcessRootRegistry();
    roots.attachReader(tableReader({ 70: { parentPid: 1, startedAt: T0 } }));
    expect(roots.register({ kind: 'h3-helper' }, 70).registered?.root).toEqual({ pid: 70, startedAt: T0 });
  });

  it('holds nothing for a spawn that failed, nor for a process already gone at its registration', () => {
    const roots = createProcessRootRegistry(tableReader({}));
    expect(roots.register({ kind: 'git-objects' }, undefined).registered).toBeNull();
    expect(roots.register({ kind: 'git-objects' }, 70).registered).toBeNull();
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

  const pidsOf = (records: { pid: number }[] | undefined): number[] | undefined => records?.map((record) => record.pid);

  it('reads the root as the row’s own, and everything walked down from it beneath', () => {
    const subtree = readProcessSubtree(tableReader(table), shell(false));
    expect(pidsOf(subtree?.own)).toEqual([100]);
    expect(pidsOf(subtree?.beneath)).toEqual([101, 102]);
    expect(subtree?.processCount).toBe(3);
  });

  it('holds what shares the terminal of a root registered as a terminal’s shell', () => {
    const subtree = readProcessSubtree(tableReader(table), shell(true));
    expect(pidsOf(subtree?.beneath)).toEqual([101, 102, 120]);
    expect(subtree?.processCount).toBe(4);
  });

  it('adds up what the root and everything beneath it have cost', () => {
    const costed = tableReader({
      100: { parentPid: 4312, startedAt: T0, cost: cost(0.5, 30, 6) },
      101: { parentPid: 100, startedAt: T0 + 1_000, cost: cost(2, 1.5, 48) },
    });
    expect(readProcessSubtree(costed, shell(false))?.cost).toEqual({ cpuSeconds: 34, memoryBytes: 54 * MB });
  });

  it('reads nothing once the root is gone, nor under a pid that now names another process', () => {
    expect(readProcessSubtree(tableReader({}), shell(true))).toBeNull();
    const reused = tableReader({ ...table, 100: { parentPid: 1, startedAt: T0 + 60_000, terminal: TERMINAL } });
    expect(readProcessSubtree(reused, shell(true))).toBeNull();
  });
});

interface HoldingReader extends ProcessReader {
  holds: [ProcessRoot, boolean | undefined][];
  releases: number;
}

/** A reader that holds roots, as the Windows one does: nothing is walked, the system lists what is held. */
function holdingReader(
  table: Record<number, Entry>,
  held: { ownPids: number[]; members: () => number[]; cpuSeconds?: number | null },
): HoldingReader {
  const reader: HoldingReader = {
    ...tableReader(table),
    childPids: () => [],
    terminalPids: () => [],
    holds: [],
    releases: 0,
    holdRoot(root, options): HeldProcessRoot {
      reader.holds.push([root, options.terminal]);
      return {
        ownPids: held.ownPids,
        memberPids: held.members,
        cpuSeconds: () => held.cpuSeconds ?? null,
        release: () => {
          reader.releases += 1;
        },
      };
    },
  };
  return reader;
}

describe('a root the reader holds', () => {
  // The probe's terminal on Windows: the shell, its console host, and what runs in the tab.
  const SHELL = 5036;
  const CONSOLE_HOST = 11_924;
  const table: Record<number, Entry> = {
    [SHELL]: { parentPid: 2776, startedAt: T0, cost: cost(0.5, 0, 6) },
    [CONSOLE_HOST]: { parentPid: 2776, startedAt: T0 - 40, cost: cost(0.25, 0, 9) },
    61102: { parentPid: SHELL, startedAt: T0 + 1_000, cost: cost(40, 0, 164) },
    // Its starter has exited: only what is held still lists it.
    7780: { parentPid: 9999, startedAt: T0 + 2_000, cost: cost(3, 0, 20) },
  };
  const everyMember = (): number[] => [SHELL, CONSOLE_HOST, 61_102, 7780];

  it('is held from its registration, as the kind of root it is, and let go of at its release — once', () => {
    const reader = holdingReader(table, { ownPids: [SHELL, CONSOLE_HOST], members: everyMember });
    const roots = createProcessRootRegistry(reader);

    const registration = roots.register({ kind: 'terminal', id: 'pty-1' }, SHELL, { terminal: true });
    expect(reader.holds).toEqual([[{ pid: SHELL, startedAt: T0 }, true]]);
    expect(registration.registered?.held?.ownPids).toEqual([SHELL, CONSOLE_HOST]);
    expect(roots.list()[0].held).toBe(registration.registered?.held);

    registration.release();
    registration.release();
    expect(reader.releases).toBe(1);
    expect(roots.list()).toEqual([]);
  });

  it('is walked like any other where the reader would not hold it', () => {
    const reader: ProcessReader = { ...tableReader(table), holdRoot: () => null };
    const registered = createProcessRootRegistry(reader).register({ kind: 'h3-helper' }, SHELL).registered;
    expect(registered).toEqual({ owner: { kind: 'h3-helper' }, root: { pid: SHELL, startedAt: T0 }, terminal: false });
  });

  it('reads what runs beneath it from what is held — a process whose starter is gone among them', () => {
    const reader = holdingReader(table, { ownPids: [SHELL, CONSOLE_HOST], members: everyMember, cpuSeconds: 97.5 });
    const registered = createProcessRootRegistry(reader).register({ kind: 'terminal', id: 'pty-1' }, SHELL, {
      terminal: true,
    }).registered;
    if (registered === null) throw new Error('the shell was not registered');

    const subtree = readProcessSubtree(reader, registered);
    // The console host is the row itself beside its shell, the root first; it is never a line beneath.
    expect(subtree?.own.map((record) => record.pid)).toEqual([SHELL, CONSOLE_HOST]);
    expect(subtree?.beneath.map((record) => record.pid)).toEqual([61_102, 7780]);
    expect(subtree?.processCount).toBe(4);
    // The CPU is the system's own count of everything that ran in it — what came and went included — and
    // the memory each process's own, added up.
    expect(subtree?.cost).toEqual({ cpuSeconds: 97.5, memoryBytes: 199 * MB });
  });

  it('counts a process the system will not let be read, with no record of it', () => {
    const reader = holdingReader(table, {
      ownPids: [SHELL, CONSOLE_HOST],
      members: () => [...everyMember(), 9120],
      cpuSeconds: 97.5,
    });
    const registered = createProcessRootRegistry(reader).register({ kind: 'terminal', id: 'pty-1' }, SHELL).registered;
    if (registered === null) throw new Error('the shell was not registered');

    const subtree = readProcessSubtree(reader, registered);
    expect(subtree?.beneath.map((record) => record.pid)).toEqual([61_102, 7780]);
    expect(subtree?.processCount).toBe(5);
    expect(subtree?.cost).toEqual({ cpuSeconds: 97.5, memoryBytes: 199 * MB });
  });

  it('keeps a row’s own process that is gone out of the row: only what is still held is read', () => {
    const reader = holdingReader(table, { ownPids: [SHELL, CONSOLE_HOST], members: () => [SHELL, 61_102] });
    const registered = createProcessRootRegistry(reader).register({ kind: 'terminal', id: 'pty-1' }, SHELL).registered;
    if (registered === null) throw new Error('the shell was not registered');

    const subtree = readProcessSubtree(reader, registered);
    expect(subtree?.own.map((record) => record.pid)).toEqual([SHELL]);
    expect(subtree?.processCount).toBe(2);
  });

  it('reads no CPU where the system would not say what is held has used — not the sum of what lives', () => {
    const reader = holdingReader(table, { ownPids: [SHELL], members: () => [SHELL, 61_102] });
    const registered = createProcessRootRegistry(reader).register({ kind: 'h3-helper' }, SHELL).registered;
    if (registered === null) throw new Error('the root was not registered');
    expect(readProcessSubtree(reader, registered)?.cost).toEqual({ cpuSeconds: null, memoryBytes: 170 * MB });
  });

  it('reads nothing once the root is gone, whatever is still held', () => {
    const live = { ...table };
    const reader = holdingReader(live, { ownPids: [SHELL], members: everyMember });
    const registered = createProcessRootRegistry(reader).register({ kind: 'terminal', id: 'pty-1' }, SHELL).registered;
    if (registered === null) throw new Error('the shell was not registered');
    delete live[SHELL];
    expect(readProcessSubtree(reader, registered)).toBeNull();
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
