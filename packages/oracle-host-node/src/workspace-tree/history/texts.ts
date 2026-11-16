/**
 * The texts of one repo's history — every commit's subject and its
 * author's name — held while a log is open on it, so a text is looked
 * for in memory and never by walking the repo again.
 *
 * The texts are kept in one store that only grows (`git/log-text-store`)
 * and laid over a reading of the history as a text per row. The first
 * reading has them all read; a later one finds each row's text again by
 * its commit's hash in the reading before, and reads only the commits
 * that one did not hold. Where those are many — more than an eighth of
 * the history, where naming them one by one costs more than walking the
 * lot — every ref is walked instead.
 *
 * One reading is laid over at a time: whoever asks while a lay is in
 * flight waits for it, and finds a reading already laid as it stands.
 */

import { logger } from '@openheaders/core/utils';
import {
  breathe,
  createLogTextStore,
  type GitRunner,
  type GitStreamRunner,
  type HistorySkeleton,
  historyRowOf,
  historyRowOfPacked,
  historyShaOf,
  type LogTextSink,
  type LogTextStore,
  type ReadLogTextsResult,
  readLogTexts,
  readLogTextsOf,
} from '../../git';
import type { HistoryGeneration } from './generation';

const SCOPE = 'workspace-tree-history';

/** Rows a pass reads before it hands the thread back. */
const STRETCH_ROWS = 20_000;

/** Commits named by hash cost about this many times what they cost walked. */
const WALKED_FOR_ONE_NAMED = 8;

export interface LogTexts {
  store: LogTextStore;
  /** Per row of the reading: the number of its text in the store; -1 for a commit git printed none for. */
  textOf: Int32Array;
}

export type LogTextsResult = { ok: true; texts: LogTexts } | { ok: false; reason: 'timeout' | 'closed' | 'failed' };

export interface HistoryTextsOptions {
  run: GitRunner;
  stream: GitStreamRunner;
  rootDir: string;
  /** The longest one read of the texts may take. */
  readTimeoutMs: number;
}

export interface HistoryTexts {
  /** The texts of `generation`'s rows — laid once, the same for everyone who asks for that reading. */
  of(generation: HistoryGeneration): Promise<LogTextsResult>;
  /** Nobody reads these texts any more: a read in flight ends. */
  close(): void;
}

interface Laid {
  generation: HistoryGeneration;
  textOf: Int32Array;
}

/** The hashes of the rows that have no text. */
function lackingShas(history: HistorySkeleton, textOf: Int32Array): string[] {
  const shas: string[] = [];
  for (let row = 0; row < textOf.length; row += 1) {
    if (textOf[row] === -1) shas.push(historyShaOf(history, row));
  }
  return shas;
}

export function createHistoryTexts(options: HistoryTextsOptions): HistoryTexts {
  const { run, stream, rootDir } = options;
  const closing = new AbortController();
  let store = createLogTextStore();
  // The reading the texts were last laid over.
  let laid: Laid | null = null;
  // The lay in flight, or the last one done: the next waits for it.
  let turn: Promise<unknown> = Promise.resolve();

  const lay = async (generation: HistoryGeneration): Promise<LogTextsResult> => {
    // Let go: no read is started for texts nobody holds.
    if (closing.signal.aborted) return { ok: false, reason: 'closed' };
    if (laid?.generation === generation) return { ok: true, texts: { store, textOf: laid.textOf } };
    const { history } = generation;
    const { count } = history.skeleton;
    const textOf = new Int32Array(count).fill(-1);
    let lacking = count;
    if (laid !== null) {
      const before = laid;
      for (let row = 0; row < count; row += 1) {
        if (row % STRETCH_ROWS === STRETCH_ROWS - 1) await breathe();
        const was = historyRowOfPacked(before.generation.history, history.hashes, row * history.width);
        if (was !== -1) textOf[row] = before.textOf[was];
        if (textOf[row] !== -1) lacking -= 1;
      }
    }

    const place: LogTextSink = (sha, authorName, subject) => {
      const row = historyRowOf(history, sha);
      // A commit newer than the reading has no row yet; a row keeps the first text it is given.
      if (row !== -1 && textOf[row] === -1) textOf[row] = store.add(authorName, subject);
    };
    const reading = { timeoutMs: options.readTimeoutMs, signal: closing.signal };
    let read: ReadLogTextsResult = { ok: true };
    if (lacking * WALKED_FOR_ONE_NAMED > count) {
      read = await readLogTexts(stream, run, rootDir, reading, place);
    } else if (lacking > 0) {
      read = await readLogTextsOf(stream, rootDir, lackingShas(history, textOf), reading, place);
    }
    if (!read.ok) return { ok: false, reason: read.reason === 'aborted' ? 'closed' : read.reason };
    laid = { generation, textOf };
    return { ok: true, texts: { store, textOf } };
  };

  const layOrFail = async (generation: HistoryGeneration): Promise<LogTextsResult> => {
    let answer: LogTextsResult;
    try {
      answer = await lay(generation);
    } catch (fault) {
      logger.warn(SCOPE, `texts read failed for ${rootDir}`, fault);
      answer = { ok: false, reason: 'failed' };
    }
    // A first read that did not land leaves texts of no reading behind: the next starts from nothing.
    if (!answer.ok && laid === null) store = createLogTextStore();
    return answer;
  };

  return {
    of(generation) {
      const done = turn.then(() => layOrFail(generation));
      turn = done;
      return done;
    },
    close() {
      closing.abort();
    },
  };
}
