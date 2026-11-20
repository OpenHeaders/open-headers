/**
 * The process reader on Windows against the REAL addon and the real
 * system (the activity monitor plan §4): this process, a child that
 * stays, a child that has exited, a child it holds. Runs only on a
 * Windows where the addon is built; everywhere else the reading is
 * pinned on a made-up binding beside this file.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createWin32ProcessReader,
  type ProcessReader,
  type ProcessRecord,
  type Win32ProcessBinding,
} from '../../../src/process-reader';

const ADDON = fileURLToPath(new URL('../../../../../native/windows-process-reader/index.js', import.meta.url));

function loadBinding(): Win32ProcessBinding | null {
  if (process.platform !== 'win32') return null;
  try {
    const addon: { load(): Win32ProcessBinding | null } = createRequire(import.meta.url)(ADDON);
    return addon.load();
  } catch {
    return null;
  }
}

const binding = loadBinding();

describe.skipIf(binding === null)('the Windows process reader on the real addon', () => {
  // A skipped suite's body still runs, and the reader reads this process as it is made.
  let reader: ProcessReader;
  const started: ChildProcess[] = [];

  beforeAll(() => {
    reader = createWin32ProcessReader(binding as Win32ProcessBinding, process.pid);
  });

  afterEach(() => {
    for (const child of started.splice(0)) child.kill();
  });

  const self = (): ProcessRecord => {
    const record = reader.read(process.pid);
    if (record === null) throw new Error('this process could not be read');
    return record;
  };

  it('reads this process: its start, its executable’s base name, a cost that agrees with the runtime’s', () => {
    const record = self();
    expect(record.name).toBe(path.basename(process.execPath));
    expect(Math.abs(record.startedAt - (Date.now() - process.uptime() * 1000))).toBeLessThan(2_000);

    const runtime = process.cpuUsage();
    expect(Math.abs((record.cost?.cpuSeconds ?? 0) - (runtime.user + runtime.system) / 1e6)).toBeLessThan(0.25);
    expect(record.cost?.memoryBytes).toBeGreaterThan(1024 * 1024);
  });

  it('reads the same start for a process at every read — its identity', () => {
    expect(self().startedAt).toBe(self().startedAt);
  });

  it('reads no more than the runtime’s own working set where it reads the private one', () => {
    const memoryBytes = self().cost?.memoryBytes ?? 0;
    if (reader.memoryKind === 'private-working-set') {
      expect(memoryBytes).toBeLessThan(process.memoryUsage.rss());
    } else {
      expect(reader.memoryKind).toBe('working-set');
    }
  });

  it('reads a child that stays by its pid, started after this process', () => {
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    started.push(child);
    const record = reader.read(child.pid ?? -1);
    expect(record?.name).toBe(path.basename(process.execPath));
    expect(record?.startedAt).toBeGreaterThan(self().startedAt);
    expect(record?.cost?.memoryBytes).toBeGreaterThan(0);
  });

  it('answers null for a child that has exited', () => {
    const exited = spawnSync(process.execPath, ['-e', '']);
    expect(reader.read(exited.pid)).toBeNull();
  });

  it('answers null for a pid no process holds', () => {
    expect(reader.read(0)).toBeNull();
    expect(reader.read(4_294_967_294)).toBeNull();
  });

  it('holds a child: what it starts runs beneath it, and letting go of it ends nothing', async () => {
    const STAYS = 'setTimeout(() => {}, 30000)';
    // The child starts a child of its own, tells its pid, and both stay.
    const child = spawn(
      process.execPath,
      ['-e', `console.log(require('node:child_process').spawn(process.execPath, ['-e', '${STAYS}']).pid); ${STAYS}`],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    started.push(child);
    const pid = child.pid ?? -1;
    const root = reader.read(pid);
    if (root === null) throw new Error('the child could not be read');

    const held = reader.holdRoot?.({ pid, startedAt: root.startedAt }, {}) ?? null;
    if (held === null) throw new Error('the child could not be held');
    expect(held.ownPids).toEqual([pid]);

    const [told] = await once(child.stdout, 'data');
    const grandchild = Number(String(told).trim());
    try {
      expect(held.memberPids()).toContain(pid);
      expect(held.memberPids()).toContain(grandchild);
      expect(held.cpuSeconds()).toBeGreaterThan(0);

      held.release();
      expect(held.memberPids()).toEqual([]);
      expect(reader.read(pid)).not.toBeNull();
      expect(reader.read(grandchild)).not.toBeNull();
    } finally {
      process.kill(grandchild);
    }
  });
});
