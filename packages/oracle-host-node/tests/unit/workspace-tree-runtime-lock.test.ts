/**
 * The binding keeps its lock (`runtime/lock.ts`), on a real (tmp)
 * filesystem: the ask at the end of a pass takes a lock that is gone,
 * leaves another engine's where it is and says who holds it once a
 * holder, says an ask that failed once, and asks nothing once the
 * binding is closed. The wiring — after every pass, a pass that throws
 * among them — is pinned on the real runtime
 * (`workspace-tree-runtime-returns.test.ts`).
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type HostLogger, setHostLogger } from '@openheaders/core/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepTreeLock } from '../../src/workspace-tree/runtime/lock';
import { acquireTreeLock, releaseTreeLock } from '../../src/workspace-tree/sidecar';

const OURS = 'desktop-1';
const WORKSPACE_ID = 'ws000001';

let rootDir: string;
let logged: string[];

const lockFile = (): string => path.join(rootDir, '.oh', 'lock');
const lockNames = async (): Promise<unknown> => JSON.parse(await fs.readFile(lockFile(), 'utf-8'));
const saidOfTheLock = (): string[] => logged.filter((line) => line.includes('the lock of'));
const openBinding = () => ({ record: { workspaceId: WORKSPACE_ID, rootDir }, closed: false, lockSaid: null });

beforeEach(async () => {
  rootDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-lock-')));
  logged = [];
  const capture =
    (level: string) =>
    (scope: string, ...args: unknown[]): void => {
      logged.push(`${level} ${scope} ${args.map(String).join(' ')}`);
    };
  const logger: HostLogger = {
    error: capture('error'),
    warn: capture('warn'),
    info: capture('info'),
    debug: capture('debug'),
  };
  setHostLogger(logger);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('keepTreeLock', () => {
  it('takes the lock where the sidecar holds none, and says nothing', async () => {
    const binding = openBinding();
    await keepTreeLock(binding, OURS);
    expect(await lockNames()).toMatchObject({ hostId: OURS, pid: process.pid });

    await fs.rm(path.join(rootDir, '.oh'), { recursive: true });
    await keepTreeLock(binding, OURS);
    expect(await lockNames()).toMatchObject({ hostId: OURS });
    expect(logged).toEqual([]);
  });

  it('asks nothing once the binding is closed: no lock is taken, no sidecar made', async () => {
    await keepTreeLock({ ...openBinding(), closed: true }, OURS);
    expect(await fs.readdir(rootDir)).toEqual([]);
  });

  it('leaves another engine’s lock where it is and says who holds it once, however many passes ask', async () => {
    expect(await acquireTreeLock(rootDir, 'another-host')).toEqual({ ok: true });
    const binding = openBinding();
    await keepTreeLock(binding, OURS);
    await keepTreeLock(binding, OURS);
    await keepTreeLock(binding, OURS);

    expect(await lockNames()).toMatchObject({ hostId: 'another-host' });
    expect(saidOfTheLock()).toEqual([
      `warn workspace-tree-runtime the lock of ${rootDir} is held by another-host (pid ${process.pid}) — this engine goes on, and asks again after every pass`,
    ]);
  });

  it('has the lock at the first ask after the other lets go, says so once, and says a holder after that anew', async () => {
    await acquireTreeLock(rootDir, 'another-host');
    const binding = openBinding();
    await keepTreeLock(binding, OURS);
    await releaseTreeLock(rootDir, 'another-host');
    await keepTreeLock(binding, OURS);
    await keepTreeLock(binding, OURS);

    expect(await lockNames()).toMatchObject({ hostId: OURS });
    expect(saidOfTheLock().map((line) => line.split(' ')[0])).toEqual(['warn', 'info']);
    expect(saidOfTheLock()[1]).toBe(`info workspace-tree-runtime the lock of ${rootDir} is this engine's again`);

    await releaseTreeLock(rootDir, OURS);
    await acquireTreeLock(rootDir, 'a-third-host');
    await keepTreeLock(binding, OURS);
    expect(saidOfTheLock()).toHaveLength(3);
    expect(saidOfTheLock()[2]).toContain('is held by a-third-host');
  });

  it.each(['EACCES', 'EPERM'])('an ask that fails with %s does not fail the pass, and is said once', async (code) => {
    const lstat = fs.lstat.bind(fs);
    vi.spyOn(fs, 'lstat').mockImplementation((...args: Parameters<typeof fs.lstat>) =>
      String(args[0]).endsWith('.oh') ? Promise.reject(Object.assign(new Error(code), { code })) : lstat(...args),
    );
    const binding = openBinding();
    await expect(keepTreeLock(binding, OURS)).resolves.toBeUndefined();
    await keepTreeLock(binding, OURS);

    expect(saidOfTheLock()).toEqual([
      `warn workspace-tree-runtime the lock of ${rootDir} could not be asked for: ${code} — this engine goes on, and asks again after every pass`,
    ]);
  });
});
