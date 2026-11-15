/**
 * Search over a whole history — the log's text field asked of every
 * commit a scope reaches, not of the window the view holds. One light
 * walk (hash, author, subject — no file lists) is read as it arrives
 * and matched with the log's own matcher, so what is listed is what a
 * row paints; the walk stops the moment a page is full, and the page's
 * commits are then read in full.
 *
 * Every bound is here, in the plumbing:
 *   - the text is a validated shape and never reaches git's arguments;
 *   - nothing of the walk is held — a history of any length costs one
 *     chunk of memory;
 *   - a page is `limit` commits; one more match only says there are
 *     more;
 *   - one deadline covers the whole search, and the caller's signal
 *     ends it sooner.
 *
 * The walk is in git's default order, not the timeline's date order:
 * it prints from its first commit on a repo with no commit-graph file,
 * where the date order walks everything first — and a searched page is
 * listed without graph edges, which that order exists for.
 */

import { type LogTextFields, makeLogTextMatcher } from '@openheaders/core/workspace-tree';
import type { GitRunner } from './git-exec';
import type { GitStreamRunner } from './git-stream';
import {
  type CommitLogEntry,
  type CommitLogFilters,
  isCommitSha,
  LOG_FORMAT,
  parseCommitLog,
  resolveCommitWalk,
} from './repo';
import { repoArgs } from './repo-args';

/** The longest text a search takes. */
export const LOG_SEARCH_MAX_TEXT = 200;

/** A commit as the scan prints it: what the matcher reads, and nothing else. */
const SCAN_FORMAT = '%x1e%H%x1f%an%x1f%s';

/**
 * Which commits of a batch a search lists — an answer per row, in
 * order. One that answers later holds the walk until it does; once
 * `signal` is aborted its answer is no longer read and it settles at
 * once.
 */
export type LogSearchMatch = (rows: readonly LogTextFields[], signal: AbortSignal) => boolean[] | Promise<boolean[]>;

/** A search's text as a shape: something to match, bounded, with no control character. */
export function isValidLogSearchText(text: string): boolean {
  const needle = text.trim();
  if (needle.length === 0 || needle.length > LOG_SEARCH_MAX_TEXT) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  return !/[\x00-\x1f\x7f]/.test(needle);
}

/**
 * A plain text's match — the text as itself, read where it stands: no
 * pattern engine runs, so it is safe on the host's own thread. Null for
 * a text that is no valid shape.
 */
export function plainTextMatch(text: string, matchCase: boolean): LogSearchMatch | null {
  if (!isValidLogSearchText(text)) return null;
  const matcher = makeLogTextMatcher(text, false, matchCase);
  if (matcher.kind !== 'match') return null;
  return (rows) => rows.map(matcher.test);
}

export interface CommitLogSearch {
  scope?: readonly string[];
  /** The timeline's row filters; its sort order does not apply to a search. */
  filters?: CommitLogFilters;
  /** The page: at most this many commits are listed. */
  limit: number;
  match: LogSearchMatch;
  /** The whole search's deadline. */
  deadlineMs: number;
  /** Ends the search sooner — a newer one took its place. */
  signal?: AbortSignal;
}

export type CommitLogSearchResult =
  | {
      ok: true;
      /** The newest matching commits, in the walk's order. */
      entries: CommitLogEntry[];
      /** The history holds matches past this page. */
      more: boolean;
    }
  | { ok: false; reason: 'invalid-scope' | 'timeout' | 'aborted' | 'failed' };

function scanRow(record: string): LogTextFields | null {
  const [sha, authorName, subject] = record.split('\x1f');
  if (sha === undefined || authorName === undefined || subject === undefined) return null;
  return { sha, authorName, subject: subject.replace(/\n$/, '') };
}

/**
 * The page's commits in full, in the order given — full hashes only,
 * named one by one and not walked from.
 */
export async function listCommitsBySha(
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
): Promise<CommitLogEntry[] | null> {
  if (shas.length === 0) return [];
  if (!shas.every(isCommitSha)) return null;
  const result = await run(
    [
      ...repoArgs(rootDir),
      'log',
      '--no-walk=unsorted',
      '-z',
      '--name-status',
      '-M',
      `--format=${LOG_FORMAT}`,
      ...shas,
      '--',
    ],
    { cwd: rootDir },
  );
  return result.code !== 0 ? null : parseCommitLog(result.stdout);
}

export async function searchCommitLog(
  stream: GitStreamRunner,
  run: GitRunner,
  rootDir: string,
  search: CommitLogSearch,
): Promise<CommitLogSearchResult> {
  const walk = await resolveCommitWalk(run, rootDir, search.scope, search.filters);
  if (walk === null) return { ok: false, reason: 'invalid-scope' };
  if (walk === 'empty') return { ok: true, entries: [], more: false };

  const page = new AbortController();
  const deadline = AbortSignal.timeout(search.deadlineMs);
  const signal = AbortSignal.any([page.signal, deadline, ...(search.signal !== undefined ? [search.signal] : [])]);
  const shas: string[] = [];
  let more = false;

  const take = (rows: readonly LogTextFields[], matched: readonly boolean[]): void => {
    for (let index = 0; index < rows.length && !more; index += 1) {
      if (matched[index] !== true) continue;
      if (shas.length < search.limit) {
        shas.push(rows[index].sha);
      } else {
        more = true;
        page.abort();
      }
    }
  };
  const read = (records: readonly string[]): void | Promise<void> => {
    const rows = records.flatMap((record) => scanRow(record) ?? []);
    if (rows.length === 0 || signal.aborted) return;
    const matched = search.match(rows, signal);
    if (matched instanceof Promise) return matched.then((answered) => take(rows, answered));
    take(rows, matched);
  };

  // The record a chunk ends in the middle of waits for the next chunk.
  let rest = '';
  const result = await stream(
    [...repoArgs(rootDir), 'log', `--format=${SCAN_FORMAT}`, ...walk.args],
    { cwd: rootDir, signal },
    (chunk) => {
      const records = (rest + chunk).split('\x1e');
      rest = records.pop() ?? '';
      return read(records);
    },
  );

  if (!more) {
    if (deadline.aborted || result.timedOut) return { ok: false, reason: 'timeout' };
    if (result.aborted) return { ok: false, reason: 'aborted' };
    if (result.code !== 0) {
      // Every ref over a repo with none: an empty history, not a failure.
      return walk.mayBeEmpty ? { ok: true, entries: [], more: false } : { ok: false, reason: 'failed' };
    }
    await read([rest]);
    if (deadline.aborted) return { ok: false, reason: 'timeout' };
    if (search.signal?.aborted === true) return { ok: false, reason: 'aborted' };
  }

  const entries = await listCommitsBySha(run, rootDir, shas);
  return entries === null ? { ok: false, reason: 'failed' } : { ok: true, entries, more };
}
