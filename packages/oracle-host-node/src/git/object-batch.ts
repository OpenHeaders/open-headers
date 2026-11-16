/**
 * object-batch — one `git cat-file --batch` kept open on a repo: objects
 * are asked for by hash and answered whole, with no process per ask. For
 * a read made over and over while a surface is looked at — a log's rows
 * under a scrollbar — where starting git costs more than the read.
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
 * Reads only: nothing run through here is audited.
 */

import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
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

export interface CreateGitObjectBatchesOptions {
  /** Binary to invoke; tests point this at fixtures. Default `git`. */
  gitBinary?: string;
  /** The longest one read may take. */
  readTimeoutMs?: number;
}

const DEFAULT_READ_TIMEOUT_MS = 10_000;

const NEWLINE = 10;

type BatchChild = ChildProcessByStdio<Writable, Readable, null>;

/** The read that is out: what git prints goes to it, and git's going away ends it. */
interface Flying {
  take(chunk: Buffer): void;
  fail(): void;
}

export function createGitObjectBatches(options: CreateGitObjectBatchesOptions = {}): GitObjectBatchOpener {
  const gitBinary = options.gitBinary ?? 'git';
  const readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;

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
      // A git let go of earlier may still speak: only the one held is listened to.
      const gone = (): void => {
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

    const read = (shas: readonly string[]): Promise<(Buffer | null)[] | null> =>
      new Promise((resolve) => {
        if (closed) {
          resolve(null);
          return;
        }
        const git = child ?? start();
        const objects: (Buffer | null)[] = [];
        let unread: Buffer = Buffer.alloc(0);

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
            unread = unread.length === 0 ? chunk : Buffer.concat([unread, chunk]);
            let at = 0;
            while (objects.length < shas.length) {
              // `<hash> <type> <size>\n<bytes>\n`, or `<name> missing\n`.
              const lineEnd = unread.indexOf(NEWLINE, at);
              if (lineEnd === -1) break;
              const [, type, size] = unread.toString('latin1', at, lineEnd).split(' ');
              if (type === 'missing') {
                objects.push(null);
                at = lineEnd + 1;
                continue;
              }
              const bytes = Number(size);
              if (!Number.isInteger(bytes) || bytes < 0) {
                giveUp();
                return;
              }
              const end = lineEnd + 1 + bytes;
              if (unread.length < end + 1) break;
              objects.push(type === 'commit' ? unread.subarray(lineEnd + 1, end) : null);
              at = end + 1;
            }
            unread = unread.subarray(at);
            if (objects.length === shas.length) finish(objects);
          },
          fail: () => finish(null),
        };
        flying = mine;
        const timer = setTimeout(giveUp, readTimeoutMs);
        git.stdin.write(`${shas.join('\n')}\n`);
      });

    return {
      readCommits(shas) {
        if (shas.length === 0) return Promise.resolve([]);
        const answer = turn.then(() => read(shas));
        turn = answer;
        return answer;
      },
      close() {
        closed = true;
        stop();
        flying?.fail();
      },
    };
  };
}
