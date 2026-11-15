/**
 * git-stream — the reading twin of `git-exec`: one git invocation whose
 * output is handed over as it arrives instead of held until the process
 * ends. For a read whose answer has no bound of its own — a walk over a
 * whole history — where the caller wants to stop at the first page and
 * must never hold the lot.
 *
 * The same discipline as the buffered runner: an arg vector (never a
 * shell string), the pinned environment, a timeout, a structured result
 * instead of a throw. On top of it:
 *
 *   - nothing is accumulated — memory is one chunk, whatever git prints;
 *   - the caller's `signal` ends the read (git is killed), which is how
 *     a page that is full, or a read nobody waits for any more, stops;
 *   - a reader that returns a promise is handed the next chunk only
 *     once it settles — in order, one at a time — and a running git is
 *     held back meanwhile, so what waits is never more than what the
 *     pipe holds.
 *
 * Reads only: nothing run through here is audited.
 */

import { spawn } from 'node:child_process';
import { baseEnv, type GitExecOptions } from './git-exec';

export interface GitStreamOptions extends GitExecOptions {
  /** Ends the read: git is killed and the result says `aborted`. */
  signal?: AbortSignal;
}

export interface GitStreamResult {
  /** Exit code; -1 when the process could not be spawned or was killed. */
  code: number;
  stderr: string;
  /** True when the binary was missing / not executable. */
  spawnFailed: boolean;
  /** True when the read was killed by the timeout. */
  timedOut: boolean;
  /** True when the caller's signal ended the read. */
  aborted: boolean;
}

/** Hands each chunk of stdout to `read`, in order; the next waits for a promise it returns to settle. */
export type GitStreamRunner = (
  args: readonly string[],
  options: GitStreamOptions,
  read: (chunk: string) => void | Promise<void>,
) => Promise<GitStreamResult>;

export interface CreateGitStreamOptions {
  /** Binary to invoke; tests point this at fixtures. Default `git`. */
  gitBinary?: string;
  defaultTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** What of stderr is kept — a failure's reason, never a feed. */
const STDERR_CAP = 4000;

export function createGitStream(options: CreateGitStreamOptions = {}): GitStreamRunner {
  const gitBinary = options.gitBinary ?? 'git';
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  return (args, invocation, read) =>
    new Promise<GitStreamResult>((resolve, reject) => {
      const child = spawn(gitBinary, args as string[], {
        cwd: invocation.cwd,
        env: baseEnv(invocation.env),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const { signal } = invocation;
      let stderr = '';
      let spawnFailed = false;
      let timedOut = false;
      let aborted = false;
      let settled = false;
      // The reader's own failure — a fault of ours, not of git: the read ends and the caller hears it.
      let fault: { error: unknown } | null = null;
      // The process is gone, with this exit code.
      let closed: { code: number | null } | null = null;
      // Chunks the reader has not been handed yet, and whether it still holds one.
      const waiting: string[] = [];
      let busy = false;

      const ended = (): boolean => aborted || timedOut || fault !== null;
      // A git that could not be started has no pid, and a kill sent to it goes to the host's own process group.
      const end = (): void => {
        if (child.pid !== undefined) child.kill();
      };
      const onAbort = (): void => {
        aborted = true;
        end();
      };
      const timer = setTimeout(() => {
        timedOut = true;
        end();
      }, invocation.timeoutMs ?? defaultTimeoutMs);
      if (signal?.aborted === true) onAbort();
      else signal?.addEventListener('abort', onAbort, { once: true });

      const fail = (error: unknown): void => {
        fault ??= { error };
        end();
      };

      // The result waits for the process to go AND for the reader to let go of its chunk.
      const finish = (): void => {
        if (closed === null || busy || settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (fault !== null) reject(fault.error);
        else resolve({ code: closed.code ?? -1, stderr, spawnFailed, timedOut, aborted });
      };

      // One chunk at a time, in the order they came. Pausing the stream
      // alone does not hold it — a child's output is resumed when the
      // process exits — so the order is kept here; the pause only keeps
      // a running git from racing ahead of a reader that answers later.
      const drain = (): void => {
        while (!busy && !ended()) {
          const chunk = waiting.shift();
          if (chunk === undefined) break;
          let reading: Promise<void> | null = null;
          try {
            const answer = read(chunk);
            if (answer instanceof Promise) reading = answer;
          } catch (error) {
            fail(error);
            break;
          }
          if (reading === null) continue;
          busy = true;
          child.stdout.pause();
          const release = (): void => {
            busy = false;
            child.stdout.resume();
            drain();
          };
          reading.then(release, (error: unknown) => {
            fail(error);
            release();
          });
        }
        if (ended()) waiting.length = 0;
        finish();
      };

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < STDERR_CAP) stderr = (stderr + chunk).slice(0, STDERR_CAP);
      });
      child.stdout.on('data', (chunk: string) => {
        if (ended()) return;
        waiting.push(chunk);
        drain();
      });
      child.on('error', (error: NodeJS.ErrnoException) => {
        spawnFailed = error.code === 'ENOENT' || error.code === 'EACCES';
        closed ??= { code: null };
        finish();
      });
      child.on('close', (code) => {
        closed ??= { code };
        finish();
      });
    });
}
