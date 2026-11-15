/**
 * One repo's history, held while a log is open on it: read once, then
 * read again only when a ref or the checked-out commit has moved — and
 * then whole, in the background, the reading it replaces answering
 * meanwhile.
 *
 * Something moving in the repo only marks the history (`stale`); the
 * next caller pays for the look at the tips, and a look that finds them
 * where they were costs nothing more. When a new reading lands the
 * owner is told (`onMoved`), so what was made from the old one is let
 * go and whoever shows it asks again.
 */

import { logger } from '@openheaders/core/utils';
import { type GitRunner, type GitStreamRunner, readLogSkeleton } from '../../git';
import { type HistoryGeneration, makeGeneration } from './generation';
import { readHistoryTips, sameTips } from './tips';

const SCOPE = 'workspace-tree-history';

export interface RepoHistoryOptions {
  run: GitRunner;
  stream: GitStreamRunner;
  rootDir: string;
  /** The longest one read of the whole history may take. */
  readTimeoutMs: number;
  /** A new reading took the place of the one that answered so far. */
  onMoved(): void;
}

export type OpenHistoryResult =
  | { ok: true; generation: HistoryGeneration }
  | { ok: false; reason: 'timeout' | 'closed' | 'failed' };

export interface RepoHistory {
  /** The history as it stands: read on the first call, the held reading from then on. */
  open(): Promise<OpenHistoryResult>;
  /** The reading in flight, for a caller the held one cannot answer; null when none is. */
  landing(): Promise<OpenHistoryResult> | null;
  /** Something moved in the repo — the tips are looked at before the next answer. */
  stale(): void;
  /** Nobody reads this history any more: a read in flight ends. */
  close(): void;
}

export function createRepoHistory(options: RepoHistoryOptions): RepoHistory {
  const { run, stream, rootDir } = options;
  const closing = new AbortController();
  let current: HistoryGeneration | null = null;
  let marked = false;
  // The one read in flight, shared by everyone who waits for it.
  let reading: Promise<OpenHistoryResult> | null = null;
  // The one look at the tips in flight.
  let looking: Promise<void> | null = null;

  const read = async (): Promise<OpenHistoryResult> => {
    // The tips first: the skeleton read after them holds every commit they name.
    const tips = await readHistoryTips(run, rootDir);
    if (tips === null) return { ok: false, reason: 'failed' };
    const result = await readLogSkeleton(stream, run, rootDir, {
      timeoutMs: options.readTimeoutMs,
      signal: closing.signal,
    });
    if (!result.ok) return { ok: false, reason: result.reason === 'aborted' ? 'closed' : result.reason };
    return { ok: true, generation: makeGeneration(result.history, tips) };
  };

  const startRead = (): Promise<OpenHistoryResult> => {
    reading ??= read().then(
      (result) => {
        reading = null;
        if (result.ok && !closing.signal.aborted) {
          const replaced = current !== null;
          current = result.generation;
          if (replaced) options.onMoved();
        }
        return result;
      },
      (fault: unknown) => {
        reading = null;
        logger.warn(SCOPE, `history read failed for ${rootDir}`, fault);
        return { ok: false, reason: 'failed' };
      },
    );
    return reading;
  };

  /** Look at the tips; a moved one starts the next reading, which nobody here waits for. */
  const look = (held: HistoryGeneration): Promise<void> => {
    looking ??= (async () => {
      try {
        const tips = await readHistoryTips(run, rootDir);
        if (tips !== null && !sameTips(tips, held.tips) && !closing.signal.aborted) void startRead();
      } finally {
        looking = null;
      }
    })();
    return looking;
  };

  return {
    async open() {
      if (closing.signal.aborted) return { ok: false, reason: 'closed' };
      if (current === null) return startRead();
      if (marked) {
        // Cleared before the look: a mark that lands during it asks for another.
        marked = false;
        await look(current);
      }
      return { ok: true, generation: current };
    },
    landing: () => reading,
    stale() {
      marked = true;
    },
    close() {
      closing.abort();
    },
  };
}
