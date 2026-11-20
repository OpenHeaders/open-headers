/**
 * object-batch — one `git cat-file --batch` kept open on a repo: objects
 * are asked for by hash and answered whole, with no process per ask. For
 * a read made over and over while a surface is looked at — a log's rows
 * under a scrollbar — and for one made of many objects at once — the
 * files of a commit's tree — where starting git costs more than the read.
 *
 * The same discipline as the runners: an arg vector, the pinned
 * environment, a deadline, a structured answer instead of a throw. On
 * top of it:
 *
 *   - git is started by the first read, not before;
 *   - one read is out at a time — the next waits for it;
 *   - a read that runs out of time, or whose git went away, answers
 *     null, and the next read starts git again;
 *   - `close` ends git and answers whatever still waits.
 *
 * An object is asked for by its full hash and nothing else: git reads
 * one name a line, so a name that is no hash — a path a commit made up,
 * a line break in it — would be answered as some other object, or as
 * two, and every answer after it would be another ask's. Such a name is
 * never sent; it answers as an object the repo does not hold.
 *
 * Reads only: nothing run through here is audited.
 */

import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { hostProcessRoots, type ProcessRootRegistry } from '../process-reader';
import { baseEnv } from './git-exec';
import { repoArgs } from './repo-args';

export interface GitObjectBatch {
  /**
   * The commits named by their full hashes, each object's bytes in the
   * order given — null for one the repo holds no commit under. The
   * whole answer is null when the batch is closed, git could not be
   * started or went away, or the read ran out of time.
   */
  readCommits(shas: readonly string[]): Promise<(Buffer | null)[] | null>;
  /** The same for blobs — a file's bytes as a commit holds them; null for a hash the repo holds no blob under. */
  readBlobs(shas: readonly string[]): Promise<(Buffer | null)[] | null>;
  /** Nobody reads through this batch any more: its git ends. */
  close(): void;
}

export interface GitObjectBatchOptions {
  /** Absolute path of the working tree whose repo is read. */
  cwd: string;
  /** Extra environment entries layered over the pinned base. */
  env?: Record<string, string>;
}

/** Opens a batch on a repo — nothing is started until it is read. */
export type GitObjectBatchOpener = (options: GitObjectBatchOptions) => GitObjectBatch;

/**
 * A batch for one piece of work: opened for it and closed when it ends,
 * however it ends. A batch left open holds the repo's packs open — on
 * Windows a git that repacks meanwhile cannot remove them.
 */
export async function withObjectBatch<T>(
  open: GitObjectBatchOpener,
  cwd: string,
  work: (objects: GitObjectBatch) => Promise<T>,
): Promise<T> {
  const objects = open({ cwd });
  try {
    return await work(objects);
  } finally {
    objects.close();
  }
}

export interface CreateGitObjectBatchesOptions {
  /** Binary to invoke; tests point this at fixtures. Default `git`. */
  gitBinary?: string;
  /** The longest one read may take. */
  readTimeoutMs?: number;
  /** Where each git started here is registered (the activity monitor plan §6, law 5). Default: the host's registry. */
  processRoots?: ProcessRootRegistry;
}

const DEFAULT_READ_TIMEOUT_MS = 10_000;

const NEWLINE = 10;

/** An object's full name: a SHA-1 or a SHA-256 hash, in hex. */
const OBJECT_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

type ObjectType = 'commit' | 'blob';

type BatchChild = ChildProcessByStdio<Writable, Readable, null>;

/** The read that is out: what git prints goes to it, and git's going away ends it. */
interface Flying {
  take(chunk: Buffer): void;
  fail(): void;
}

export function createGitObjectBatches(options: CreateGitObjectBatchesOptions = {}): GitObjectBatchOpener {
  const gitBinary = options.gitBinary ?? 'git';
  const readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  const processRoots = options.processRoots ?? hostProcessRoots;

  return ({ cwd, env }) => {
    let child: BatchChild | null = null;
    let closed = false;
    let flying: Flying | null = null;
    // The read in flight, or the last one done: the next waits for it.
    let turn: Promise<unknown> = Promise.resolve();

    const start = (): BatchChild => {
      const git = spawn(gitBinary, [...repoArgs(cwd), 'cat-file', '--batch'], {
        cwd,
        env: baseEnv(env),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      child = git;
      // Every open batch is one owner: its git comes and goes with the reads.
      const registration = processRoots.register({ kind: 'git-objects' }, git.pid);
      // A git let go of earlier may still speak: only the one held is listened to.
      const gone = (): void => {
        registration.release();
        if (child !== git) return;
        child = null;
        flying?.fail();
      };
      git.stdout.on('data', (chunk: Buffer) => {
        if (child === git) flying?.take(chunk);
      });
      git.on('error', gone);
      git.on('close', gone);
      // A write to a git that is gone fails here; its going away is heard above.
      git.stdin.on('error', () => undefined);
      return git;
    };

    // A git that could not be started has no pid, and a kill sent to it goes to the host's own process group.
    const stop = (): void => {
      const git = child;
      child = null;
      if (git !== null && git.pid !== undefined) git.kill();
    };

    const read = (shas: readonly string[], wanted: ObjectType): Promise<(Buffer | null)[] | null> =>
      new Promise((resolve) => {
        if (closed) {
          resolve(null);
          return;
        }
        const git = child ?? start();
        const objects: (Buffer | null)[] = [];
        // What git printed and no object has taken yet. An object's bytes
        // are put together once, when the last of them is in: a large one
        // comes in many pieces, and is not copied for each.
        let pieces: Buffer[] = [];
        let held = 0;
        // The object whose header is read and whose bytes are still coming.
        let coming: { type: string; bytes: number } | null = null;

        const whole = (): Buffer => {
          if (pieces.length !== 1) pieces = [Buffer.concat(pieces, held)];
          return pieces[0];
        };
        const drop = (bytes: number): void => {
          pieces = [whole().subarray(bytes)];
          held -= bytes;
        };

        const finish = (answer: (Buffer | null)[] | null): void => {
          if (flying !== mine) return;
          flying = null;
          clearTimeout(timer);
          resolve(answer);
        };
        // What git said is no answer to this read: the batch is out of step, and starts over.
        const giveUp = (): void => {
          stop();
          finish(null);
        };
        const mine: Flying = {
          take(chunk) {
            pieces.push(chunk);
            held += chunk.length;
            while (objects.length < shas.length) {
              if (coming === null) {
                // `<hash> <type> <size>\n`, or `<name> missing\n`.
                const unread = whole();
                const lineEnd = unread.indexOf(NEWLINE);
                if (lineEnd === -1) break;
                const [, type, size] = unread.toString('latin1', 0, lineEnd).split(' ');
                drop(lineEnd + 1);
                if (type === 'missing') {
                  objects.push(null);
                  continue;
                }
                const bytes = Number(size);
                if (!Number.isInteger(bytes) || bytes < 0) {
                  giveUp();
                  return;
                }
                coming = { type, bytes };
              } else {
                // `<bytes>\n`.
                if (held < coming.bytes + 1) break;
                objects.push(coming.type === wanted ? whole().subarray(0, coming.bytes) : null);
                drop(coming.bytes + 1);
                coming = null;
              }
            }
            if (objects.length === shas.length) finish(objects);
          },
          fail: () => finish(null),
        };
        flying = mine;
        const timer = setTimeout(giveUp, readTimeoutMs);
        git.stdin.write(`${shas.join('\n')}\n`);
      });

    /** The objects of one type under `shas`, a read at a time; a name that is no hash is not asked. */
    const ask = async (shas: readonly string[], wanted: ObjectType): Promise<(Buffer | null)[] | null> => {
      const hashes = shas.filter((sha) => OBJECT_HASH.test(sha));
      if (hashes.length === 0) return shas.map(() => null);
      const answer = turn.then(() => read(hashes, wanted));
      turn = answer;
      const found = await answer;
      if (found === null) return null;
      const objects = found.values();
      return shas.map((sha) => (OBJECT_HASH.test(sha) ? (objects.next().value ?? null) : null));
    };

    return {
      readCommits: (shas) => ask(shas, 'commit'),
      readBlobs: (shas) => ask(shas, 'blob'),
      close() {
        closed = true;
        stop();
        flying?.fail();
      },
    };
  };
}
