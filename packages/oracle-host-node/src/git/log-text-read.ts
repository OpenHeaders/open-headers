/**
 * The texts of commits as git prints them — a commit's hash, its
 * author's name and its subject, a line each — read as they arrive and
 * handed on one by one: nothing is held here.
 *
 * Two reads. Every commit every ref and the checked-out commit reach,
 * walked in git's default order: it prints from its first commit on any
 * repo, and whoever takes the texts finds each commit's place by its
 * hash, so the order is nobody's concern. And the commits named by
 * their hashes alone, a batch an invocation, for the few a history
 * gained since its texts were read.
 */

import type { GitRunner } from './git-exec';
import type { GitStreamRunner } from './git-stream';
import { resolveCommitWalk } from './repo';
import { repoArgs } from './repo-args';

/** A commit as a line: `<hash> 0x1f <author's name> 0x1f <subject>`. */
const TEXT_FORMAT = '%H%x1f%an%x1f%s';

/** Hashes named in one invocation — its arguments stay within what every platform passes. */
const HASHES_A_READ = 400;

const FULL_HASH = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export type LogTextSink = (sha: string, authorName: string, subject: string) => void;

export interface ReadLogTextsOptions {
  /** The longest the whole read may take. */
  timeoutMs: number;
  /** Ends the read — nobody waits for these texts any more. */
  signal?: AbortSignal;
}

export type ReadLogTextsResult = { ok: true } | { ok: false; reason: 'timeout' | 'aborted' | 'failed' };

type Outcome = 'read' | 'refused' | 'timeout' | 'aborted' | 'failed';

/** One invocation's lines handed to `take`. `refused`: git ended with an error. */
async function readLines(
  stream: GitStreamRunner,
  rootDir: string,
  args: readonly string[],
  options: ReadLogTextsOptions,
  take: LogTextSink,
): Promise<Outcome> {
  let malformed = false;
  // The line a chunk ends in the middle of waits for the next chunk.
  let rest = '';
  const result = await stream(
    [...repoArgs(rootDir), 'log', `--format=${TEXT_FORMAT}`, ...args],
    { cwd: rootDir, timeoutMs: options.timeoutMs, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
    (chunk) => {
      if (malformed) return;
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) {
        const nameAt = line.indexOf('\x1f');
        const subjectAt = line.indexOf('\x1f', nameAt + 1);
        const sha = line.slice(0, Math.max(0, nameAt));
        if (subjectAt === -1 || !FULL_HASH.test(sha)) {
          malformed = true;
          return;
        }
        // A subject may hold the separator itself: everything past the name is the subject.
        take(sha, line.slice(nameAt + 1, subjectAt), line.slice(subjectAt + 1));
      }
    },
  );
  if (result.timedOut) return 'timeout';
  if (result.aborted) return 'aborted';
  if (result.code !== 0) return 'refused';
  return malformed || rest.length > 0 ? 'failed' : 'read';
}

/**
 * The text of every commit every ref and the checked-out commit reach.
 * A repo with no commit yet has none to hand on.
 */
export async function readLogTexts(
  stream: GitStreamRunner,
  run: GitRunner,
  rootDir: string,
  options: ReadLogTextsOptions,
  take: LogTextSink,
): Promise<ReadLogTextsResult> {
  const walk = await resolveCommitWalk(run, rootDir, undefined, { allRefs: true });
  if (walk === null || walk === 'empty') return { ok: false, reason: 'failed' };
  const outcome = await readLines(stream, rootDir, walk.args, options, take);
  if (outcome === 'read') return { ok: true };
  // Every ref over a repo with none: nothing to read, not a failure.
  if (outcome === 'refused') return walk.mayBeEmpty ? { ok: true } : { ok: false, reason: 'failed' };
  return { ok: false, reason: outcome };
}

/** The texts of the commits `shas` name — full hashes, each read by itself and none walked from. */
export async function readLogTextsOf(
  stream: GitStreamRunner,
  rootDir: string,
  shas: readonly string[],
  options: ReadLogTextsOptions,
  take: LogTextSink,
): Promise<ReadLogTextsResult> {
  const deadline = Date.now() + options.timeoutMs;
  for (let from = 0; from < shas.length; from += HASHES_A_READ) {
    const left = deadline - Date.now();
    if (left <= 0) return { ok: false, reason: 'timeout' };
    const outcome = await readLines(
      stream,
      rootDir,
      ['--no-walk=unsorted', ...shas.slice(from, from + HASHES_A_READ), '--'],
      { ...options, timeoutMs: left },
      take,
    );
    if (outcome === 'refused') return { ok: false, reason: 'failed' };
    if (outcome !== 'read') return { ok: false, reason: outcome };
  }
  return { ok: true };
}
