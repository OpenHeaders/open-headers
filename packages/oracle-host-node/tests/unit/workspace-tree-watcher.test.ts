/**
 * Watcher — debounced quiescence signaling over a real (tmp)
 * filesystem, with `.oh/` traffic ignored (sidecar writes must never
 * wake the sweep).
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceTreeWatcher } from '../../src/workspace-tree/watcher';

let tmpDir: string;
let watcher: WorkspaceTreeWatcher | null = null;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-watch-'));
});

afterEach(async () => {
  watcher?.dispose();
  watcher = null;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('WorkspaceTreeWatcher', () => {
  it('collapses an edit burst into one quiescence callback', async () => {
    let calls = 0;
    watcher = new WorkspaceTreeWatcher({ rootDir: tmpDir, debounceMs: 50, onQuiescence: () => (calls += 1) });
    expect(watcher.start()).toBe(true);

    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'a\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'b\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'README.md'), 'c\n', 'utf-8');

    await waitFor(() => calls > 0);
    expect(calls).toBe(1);
  });

  it('ignores sidecar traffic under .oh/', async () => {
    await fs.mkdir(path.join(tmpDir, '.oh'), { recursive: true });
    let calls = 0;
    watcher = new WorkspaceTreeWatcher({ rootDir: tmpDir, debounceMs: 50, onQuiescence: () => (calls += 1) });
    watcher.start();
    // macOS FSEvents replays just-before-watch history (the tmp dir's
    // own creation), which conservatively bumps once — a harmless
    // no-op sweep in production. Let the replay settle, then assert
    // that NAMED sidecar traffic never wakes the sweep.
    await new Promise((resolve) => setTimeout(resolve, 300));
    calls = 0;

    await fs.writeFile(path.join(tmpDir, '.oh', 'materialized-index.json'), '{}', 'utf-8');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(calls).toBe(0);
  });
});
