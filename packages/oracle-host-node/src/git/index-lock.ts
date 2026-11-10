/**
 * The real index's lock, held by the engine while a pass moves HEAD.
 *
 * An engine commit rides a throwaway index, so the user's REAL index has
 * to be brought to the new HEAD afterwards. Done as a second step on an
 * index anyone may be writing, that resync could lose to another git
 * process and leave the index behind a commit that already stood. So
 * the pass takes the index's own lock FIRST — `<index>.lock`, created
 * exclusively, the file every git process creates before it writes the
 * index — and a lock that is busy refuses the pass with nothing
 * written.
 *
 * The lock file is itself the index the pass builds: it starts as a
 * copy of the real index, a git call pointed at it ({@link
 * HeldIndexLock.env}) reads and writes that copy, and
 * {@link HeldIndexLock.publish} puts what it holds in the real index's
 * place by rename — the lock stays held, so a pass with several commits
 * publishes after each one. No other git process can write the index in
 * between; one that tries is told by git that another git process is
 * running, and a read still answers.
 *
 * A lock found held is never removed here, however old it looks: only
 * its owner knows whether it is stale.
 */

import { promises as fs, rmSync } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveGitDirs } from './git-dir';
import type { GitRunner } from './git-exec';
import { repoArgs } from './repo-args';

export interface HeldIndexLock {
  /** Points a git invocation at the index the lock holds instead of the real one. */
  readonly env: Readonly<Record<string, string>>;
  /** Put what the lock holds in the real index's place; the lock stays held. False when the index could not be replaced. */
  publish(): Promise<boolean>;
  /** Give the lock up — idempotent. */
  release(): Promise<void>;
}

/** `index-locked`: another git process holds the lock. `lock-failed`: it could not be created, or the index not read into it. */
export interface IndexLockRefusal {
  ok: false;
  reason: 'index-locked' | 'lock-failed';
  detail: string;
}

export type AcquireIndexLockResult = { ok: true; lock: HeldIndexLock } | IndexLockRefusal;

/** How a pass names a lock it could not take: the busy index as such, anything else as a commit that could not be made. */
export const lockRefusalReason = (refusal: IndexLockRefusal): 'index-locked' | 'commit-failed' =>
  refusal.reason === 'index-locked' ? 'index-locked' : 'commit-failed';

/** The waits between tries at a lock another process holds — under a second in all. */
const BUSY_WAITS_MS: readonly number[] = [25, 50, 100, 200, 400];

/** The waits between tries at a rename the platform refused while a reader had the index open (Windows). */
const RENAME_WAITS_MS: readonly number[] = [10, 25, 50, 100, 200];

const errorCode = (err: unknown): string | undefined =>
  err instanceof Error && 'code' in err && typeof err.code === 'string' ? err.code : undefined;

/** The files of every lock this process holds — removed if the process exits with one still held. */
const heldFiles = new Set<readonly string[]>();
let exitHookInstalled = false;

function removeOnExit(files: readonly string[]): void {
  heldFiles.add(files);
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once('exit', () => {
    for (const group of heldFiles) for (const file of group) rmSync(file, { force: true });
  });
}

/** Git locks the file a symlinked index points at, not the link. */
async function realIndexPath(gitDir: string): Promise<string> {
  const indexPath = path.join(gitDir, 'index');
  try {
    return await fs.realpath(indexPath);
  } catch {
    return indexPath;
  }
}

async function createExclusively(lockPath: string): Promise<FileHandle | { busy: boolean; detail: string }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fs.open(lockPath, 'wx');
    } catch (err) {
      const busy = errorCode(err) === 'EEXIST';
      if (busy && attempt < BUSY_WAITS_MS.length) {
        await delay(BUSY_WAITS_MS[attempt]);
        continue;
      }
      return { busy, detail: busy ? `${lockPath} is held by another git process` : String(err) };
    }
  }
}

async function renameOver(from: string, to: string): Promise<boolean> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return true;
    } catch (err) {
      const code = errorCode(err);
      const shared = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!shared || attempt >= RENAME_WAITS_MS.length) return false;
      await delay(RENAME_WAITS_MS[attempt]);
    }
  }
}

/**
 * Take the real index's lock for `rootDir`, waiting a moment on a lock
 * another process holds. The lock comes back holding the index as it
 * stands — an index that does not exist yet reads as an empty one.
 */
export async function acquireIndexLock(run: GitRunner, rootDir: string): Promise<AcquireIndexLockResult> {
  const indexPath = await realIndexPath((await resolveGitDirs(rootDir)).gitDir);
  const lockPath = `${indexPath}.lock`;
  // Git's own naming: it reads this file to say which process holds a lock, and whether it is still running.
  const pidPath = `${indexPath}~pid.lock`;
  const nextPath = `${indexPath}.oh-next`;

  const created = await createExclusively(lockPath);
  if ('busy' in created) {
    return { ok: false, reason: created.busy ? 'index-locked' : 'lock-failed', detail: created.detail };
  }
  const files = [lockPath, pidPath, nextPath];
  removeOnExit(files);
  const env = { GIT_INDEX_FILE: lockPath };
  let released = false;
  const release = async (): Promise<void> => {
    if (released) return;
    released = true;
    for (const file of files) await fs.rm(file, { force: true }).catch(() => undefined);
    heldFiles.delete(files);
  };

  try {
    // Read AFTER the lock is ours: nothing can replace the index from here on.
    const current = await fs.readFile(indexPath).catch((err: unknown) => {
      if (errorCode(err) === 'ENOENT') return null;
      throw err;
    });
    if (current !== null) await created.writeFile(current);
    await created.close();
    if (current === null) {
      const seeded = await run([...repoArgs(rootDir), 'read-tree', '--empty'], { cwd: rootDir, env });
      if (seeded.code !== 0) throw new Error(seeded.stderr.trim() || 'the index could not be read');
    }
    await fs.writeFile(pidPath, `pid ${process.pid}\n`).catch(() => undefined);
  } catch (err) {
    await created.close().catch(() => undefined);
    await release();
    return { ok: false, reason: 'lock-failed', detail: String(err) };
  }

  return {
    ok: true,
    lock: {
      env,
      publish: async () => {
        if (released) return false;
        try {
          await fs.copyFile(lockPath, nextPath);
        } catch {
          return false;
        }
        const published = await renameOver(nextPath, indexPath);
        if (!published) await fs.rm(nextPath, { force: true }).catch(() => undefined);
        return published;
      },
      release,
    },
  };
}

/**
 * Run `body` holding the real index's lock — taken here and given up
 * when `body` settles, or `handed` when the caller's pass already holds
 * it (its holder gives it up). A lock that cannot be taken answers
 * `refused` and `body` never runs.
 */
export async function withIndexLock<T>(
  run: GitRunner,
  rootDir: string,
  refused: (refusal: IndexLockRefusal) => T,
  body: (lock: HeldIndexLock) => Promise<T>,
  handed?: HeldIndexLock,
): Promise<T> {
  if (handed !== undefined) return body(handed);
  const acquired = await acquireIndexLock(run, rootDir);
  if (!acquired.ok) return refused(acquired);
  try {
    return await body(acquired.lock);
  } finally {
    await acquired.lock.release();
  }
}
