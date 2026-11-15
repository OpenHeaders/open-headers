/**
 * The rows of a history that a walk under row filters names — the
 * log's User, Date and Paths asked of git, which alone knows an author,
 * a date and what a commit touched. The walk prints hashes and nothing
 * else; each is found on its row of the history the log already holds,
 * so the filter only says WHICH commits are listed — their order, their
 * joins and their graph stay the history's.
 *
 * The same walk as the timeline's own read (`resolveCommitWalk`), so a
 * filter names here what it listed there. Read as it arrives: nothing
 * is held but the flags.
 */

import type { GitRunner } from './git-exec';
import type { GitStreamRunner } from './git-stream';
import { type HistorySkeleton, historyRowOf } from './log-skeleton';
import { type CommitLogFilters, resolveCommitWalk } from './repo';
import { repoArgs } from './repo-args';

export interface NamedRowsOptions {
  /** The refs walked together; absent with `filters.allRefs` for every ref, or for the checked-out commit alone. */
  scope?: readonly string[];
  filters: CommitLogFilters;
  timeoutMs: number;
  /** Ends the walk — nobody waits for this list any more. */
  signal?: AbortSignal;
}

export type NamedRowsResult =
  | {
      ok: true;
      /** Per row of the history: 1 where the walk names the commit. */
      named: Uint8Array;
    }
  | { ok: false; reason: 'invalid-scope' | 'timeout' | 'aborted' | 'failed' };

export async function readNamedRows(
  stream: GitStreamRunner,
  run: GitRunner,
  rootDir: string,
  history: HistorySkeleton,
  options: NamedRowsOptions,
): Promise<NamedRowsResult> {
  const named = new Uint8Array(history.skeleton.count);
  const walk = await resolveCommitWalk(run, rootDir, options.scope, options.filters);
  if (walk === null) return { ok: false, reason: 'invalid-scope' };
  if (walk === 'empty') return { ok: true, named };

  // The line a chunk ends in the middle of waits for the next chunk.
  let rest = '';
  const result = await stream(
    [...repoArgs(rootDir), 'log', '--format=%H', ...walk.args],
    { cwd: rootDir, timeoutMs: options.timeoutMs, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
    (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) {
        // A commit made since the history was read has no row yet.
        const row = historyRowOf(history, line);
        if (row !== -1) named[row] = 1;
      }
    },
  );
  if (result.timedOut) return { ok: false, reason: 'timeout' };
  if (result.aborted) return { ok: false, reason: 'aborted' };
  if (result.code !== 0) {
    // Every ref over a repo with none: nothing to name, not a failure.
    return walk.mayBeEmpty ? { ok: true, named } : { ok: false, reason: 'failed' };
  }
  return { ok: true, named };
}
