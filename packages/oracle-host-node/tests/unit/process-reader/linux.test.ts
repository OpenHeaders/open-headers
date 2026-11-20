/**
 * The process reader on Linux (the activity monitor plan §7, fork 3;
 * §6, laws 9 and 12): a process's own /proc files, read in plain JS.
 * Pinned on REAL text kept from a Linux container — a terminal's shell,
 * what runs in it, and two processes of another user — so it runs on
 * every OS.
 */

import { describe, expect, it } from 'vitest';
import { createLinuxProcessReader } from '../../../src/process-reader';
import { SCENE_BOOT_SECONDS, SCENE_PIDS, sceneSource, sceneSourceWithoutChildrenLists } from './_linux-scene';

const KB = 1024;
const sorted = (pids: number[]): number[] => [...pids].sort((a, b) => a - b);

describe('createLinuxProcessReader', () => {
  const reader = createLinuxProcessReader(sceneSource());

  it('reads a process: its parent, when it started, its executable’s base name, what it costs', () => {
    expect(reader.read(SCENE_PIDS.shell)).toEqual({
      pid: SCENE_PIDS.shell,
      parentPid: SCENE_PIDS.ptyKeeper,
      // 9640 ticks after the boot, at a hundred ticks a second.
      startedAt: SCENE_BOOT_SECONDS * 1000 + 96_400,
      name: 'bash',
      cost: { cpuSeconds: 0, exitedChildrenCpuSeconds: 0, memoryBytes: 2792 * KB },
    });
  });

  it('says memory is the resident size', () => {
    expect(reader.memoryKind).toBe('resident');
  });

  it('converts CPU ticks to seconds, and keeps the CPU of children that exited on their parent', () => {
    // Its child burned one second and exited: 100 ticks in the waited-for counter, none of its own.
    expect(reader.read(SCENE_PIDS.waited)?.cost).toEqual({
      cpuSeconds: 0,
      exitedChildrenCpuSeconds: 1,
      memoryBytes: 1112 * KB,
    });
  });

  it('takes the tick from its option where the system counts another', () => {
    const coarse = createLinuxProcessReader(sceneSource(), { clockTicksPerSecond: 250 });
    expect(coarse.read(SCENE_PIDS.waited)?.cost?.exitedChildrenCpuSeconds).toBe(0.4);
  });

  it('reads another user’s process with no name: its executable link is refused, its figures are not', () => {
    const init = reader.read(SCENE_PIDS.init);
    expect(init?.name).toBeNull();
    expect(init?.parentPid).toBe(0);
    expect(init?.cost?.memoryBytes).toBe(508 * KB);
  });

  it('answers null for a pid no process holds', () => {
    expect(reader.read(999)).toBeNull();
  });

  it('names a process by its executable, never by the name it gave itself — one with spaces and parentheses', () => {
    const stat = sceneSource().readFile('/proc/9/stat') ?? '';
    const renamed = stat.replace('(sleep)', '(token=abc) S 1 (x)');
    const source = sceneSource({ files: { '/proc/9/stat': renamed } });
    const record = createLinuxProcessReader(source).read(SCENE_PIDS.stays);
    expect(record?.name).toBe('sleep');
    expect(record?.parentPid).toBe(SCENE_PIDS.shell);
    expect(record?.startedAt).toBe(SCENE_BOOT_SECONDS * 1000 + 96_410);
  });

  it('names an executable replaced on disk while it runs by its base name alone', () => {
    const source = sceneSource({ links: { '/proc/9/exe': '/home/john/.local/bin/node (deleted)' } });
    expect(createLinuxProcessReader(source).read(SCENE_PIDS.stays)?.name).toBe('node');
  });

  it('reads no memory for a process that has none of its own', () => {
    const status = sceneSource().readFile('/proc/9/status') ?? '';
    const source = sceneSource({ files: { '/proc/9/status': status.replace(/^VmRSS:.*\n/m, '') } });
    expect(createLinuxProcessReader(source).read(SCENE_PIDS.stays)?.cost?.memoryBytes).toBe(0);
  });

  it('answers null where the boot time cannot be read — a start with no epoch is no identity', () => {
    const source = sceneSource({ files: { '/proc/stat': null } });
    expect(createLinuxProcessReader(source).read(SCENE_PIDS.shell)).toBeNull();
  });

  it('lists a process’s children from its threads’ own lists', () => {
    expect(sorted(reader.childPids(SCENE_PIDS.shell))).toEqual([SCENE_PIDS.stays, SCENE_PIDS.waited]);
    // The process that outlived its parent is init's child now, not the shell's.
    expect(sorted(reader.childPids(SCENE_PIDS.init))).toEqual([SCENE_PIDS.ptyKeeper, SCENE_PIDS.outlived]);
    expect(reader.childPids(SCENE_PIDS.stays)).toEqual([]);
    expect(reader.childPids(999)).toEqual([]);
  });

  it('finds the same children by every process’s parent on a kernel without those lists', () => {
    const scanning = createLinuxProcessReader(sceneSourceWithoutChildrenLists());
    expect(sorted(scanning.childPids(SCENE_PIDS.shell))).toEqual([SCENE_PIDS.stays, SCENE_PIDS.waited]);
    expect(sorted(scanning.childPids(SCENE_PIDS.init))).toEqual([SCENE_PIDS.ptyKeeper, SCENE_PIDS.outlived]);
    expect(scanning.childPids(SCENE_PIDS.stays)).toEqual([]);
  });

  it('lists what shares a process’s terminal — the one that outlived its parent among them', () => {
    expect(sorted(reader.terminalPids(SCENE_PIDS.shell))).toEqual([
      SCENE_PIDS.shell,
      SCENE_PIDS.stays,
      SCENE_PIDS.waited,
      SCENE_PIDS.outlived,
    ]);
  });

  it('lists nothing for a process with no terminal, or for none at all', () => {
    expect(reader.terminalPids(SCENE_PIDS.init)).toEqual([]);
    expect(reader.terminalPids(999)).toEqual([]);
  });
});
