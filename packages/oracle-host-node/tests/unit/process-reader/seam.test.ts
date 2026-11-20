/**
 * The walk down from a root we started (the activity monitor plan §6,
 * law 5): its descendants found from the root, a terminal's shell
 * holding what shares its terminal, a parent id believed only with the
 * creation times in order. On the kept Linux scene, and on a made-up
 * table for the edges a real capture cannot be made to hold.
 */

import { describe, expect, it } from 'vitest';
import {
  createLinuxProcessReader,
  type ProcessReader,
  type ProcessRecord,
  readProcessDescendants,
} from '../../../src/process-reader';
import { SCENE_BOOT_SECONDS, SCENE_PIDS, sceneSource } from './_linux-scene';

const pidsOf = (records: ProcessRecord[]): number[] => records.map((record) => record.pid).sort((a, b) => a - b);

describe('readProcessDescendants — on the kept terminal scene', () => {
  const reader = createLinuxProcessReader(sceneSource());
  const shell = { pid: SCENE_PIDS.shell, startedAt: SCENE_BOOT_SECONDS * 1000 + 96_400 };

  it('finds what a root’s children are, each with its record', () => {
    const found = readProcessDescendants(reader, shell);
    expect(pidsOf(found)).toEqual([SCENE_PIDS.stays, SCENE_PIDS.waited]);
    expect(found.find((record) => record.pid === SCENE_PIDS.waited)?.cost?.exitedChildrenCpuSeconds).toBe(1);
  });

  it('keeps a process that outlived its parent in a terminal’s row: it still shares the terminal', () => {
    expect(pidsOf(readProcessDescendants(reader, shell, { terminal: true }))).toEqual([
      SCENE_PIDS.stays,
      SCENE_PIDS.waited,
      SCENE_PIDS.outlived,
    ]);
  });

  it('finds nothing under a pid that now names another process', () => {
    expect(readProcessDescendants(reader, { pid: SCENE_PIDS.shell, startedAt: shell.startedAt - 60_000 })).toEqual([]);
  });

  it('finds nothing under a root that is gone', () => {
    expect(readProcessDescendants(reader, { pid: 999, startedAt: shell.startedAt }, { terminal: true })).toEqual([]);
  });
});

interface Entry {
  parentPid: number | null;
  startedAt: number;
  /** What the system lists as its children — which a reused pid makes wrong. */
  listed?: number[];
  terminal?: number;
}

function tableReader(table: Record<number, Entry>): ProcessReader {
  return {
    memoryKind: 'resident',
    read(pid) {
      const entry = table[pid];
      if (entry === undefined) return null;
      return { pid, parentPid: entry.parentPid, startedAt: entry.startedAt, name: null, cost: null };
    },
    childPids: (pid) => table[pid]?.listed ?? [],
    terminalPids(pid) {
      const terminal = table[pid]?.terminal;
      if (terminal === undefined) return [];
      return Object.keys(table)
        .map(Number)
        .filter((candidate) => table[candidate].terminal === terminal);
    },
  };
}

describe('readProcessDescendants — the edges', () => {
  const T0 = Date.UTC(2026, 10, 20, 14, 0);
  const ROOT = { pid: 100, startedAt: T0 };

  it('walks down every generation', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101] },
      101: { parentPid: 100, startedAt: T0 + 1_000, listed: [102, 103] },
      102: { parentPid: 101, startedAt: T0 + 2_000, listed: [104] },
      103: { parentPid: 101, startedAt: T0 + 2_000 },
      104: { parentPid: 102, startedAt: T0 + 3_000 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([101, 102, 103, 104]);
  });

  it('does not believe a child older than its parent — a reused pid — nor walk beneath it', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101, 102] },
      101: { parentPid: 100, startedAt: T0 - 86_400_000, listed: [105] },
      102: { parentPid: 100, startedAt: T0 + 1_000 },
      105: { parentPid: 101, startedAt: T0 + 2_000 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([102]);
  });

  it('does not believe a listed child whose own record names another parent', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101, 102] },
      101: { parentPid: 7, startedAt: T0 + 1_000 },
      102: { parentPid: 100, startedAt: T0 + 1_000 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([102]);
  });

  it('does not believe a listed child whose record carries no parent at all', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101, 102] },
      101: { parentPid: null, startedAt: T0 + 1_000 },
      102: { parentPid: 100, startedAt: T0 + 1_000 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([102]);
  });

  it('skips a child that ended between the listing and its read', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101, 102] },
      102: { parentPid: 100, startedAt: T0 + 1_000 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([102]);
  });

  it('ends on a listing that leads back to the root', () => {
    const reader = tableReader({
      100: { parentPid: 1, startedAt: T0, listed: [101] },
      101: { parentPid: 100, startedAt: T0 + 1_000, listed: [100, 101] },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([101]);
  });

  it('takes a terminal’s sharers only when asked, and never one older than the shell — what opened the terminal', () => {
    const reader = tableReader({
      50: { parentPid: 1, startedAt: T0 - 5_000, terminal: 34_816 },
      100: { parentPid: 50, startedAt: T0, listed: [101], terminal: 34_816 },
      101: { parentPid: 100, startedAt: T0 + 1_000, terminal: 34_816 },
      120: { parentPid: 1, startedAt: T0 + 2_000, terminal: 34_816 },
      130: { parentPid: 1, startedAt: T0 + 2_000, terminal: 34_817 },
    });
    expect(pidsOf(readProcessDescendants(reader, ROOT))).toEqual([101]);
    expect(pidsOf(readProcessDescendants(reader, ROOT, { terminal: true }))).toEqual([101, 120]);
  });
});
