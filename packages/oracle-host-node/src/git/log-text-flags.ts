/**
 * The rows of a reading a text matches — a flag per row, read off the
 * texts the host holds (`log-text-store`) and never by walking the repo.
 *
 * What matches is core's matcher's to say: a commit's subject, its
 * author's name, its hash. Two lanes, by what the text is:
 *
 *   - a PLAIN text is read on the host's own thread — no pattern engine
 *     runs and the cost is linear — a stretch of rows at a time, the
 *     thread handed back between two, ended between two by the signal;
 *   - a PATTERN never runs here (`log-text-pattern`): its worker reads
 *     the same texts in shared memory and is ended by the signal, by
 *     the pattern's deadline or by its turn being taken away, whichever
 *     comes first. A pattern is a thread for as long as it runs: it
 *     takes a turn as its worker starts, and whoever hands the turns
 *     out bounds how many run at once.
 *
 * An author's name is tested once, whatever the commits under it, and a
 * hash is spelled out only for a text that can match one. A row with no
 * text is tested by its hash alone.
 */

import { type LogTextMatcher, makeLogTextMatcher } from '@openheaders/core/workspace-tree';
import { breathe } from './breathe';
import { flagRowsByPattern } from './log-text-pattern';
import type { LogTextStore } from './log-text-store';

/** Rows a pass reads before it hands the thread back. */
const STRETCH_ROWS = 20_000;

/** A pattern's turn among the patterns run at once. */
export interface LogPatternTurn {
  /** Aborted when the turn is taken away: the pattern is ended as out of time. */
  signal: AbortSignal;
  /** The pattern is over: its turn is free. */
  done(): void;
}

/** What the log's text field asks for. */
export interface LogTextAsk {
  text: string;
  /** The text is a pattern. */
  regex: boolean;
  matchCase: boolean;
}

/** The rows of one reading: the store its texts are in, a text and a hash per row. */
export interface LogTextRows {
  store: LogTextStore;
  /** Per row: the number of its text in the store; -1 for none. */
  textOf: Int32Array;
  /** The rows' hashes, packed: `width` bytes each. */
  hashes: Buffer;
  width: number;
}

export interface FlagLogTextsOptions {
  /** Ends the matching — nobody waits for these flags any more. */
  signal: AbortSignal;
  /** The longest a pattern may run. A plain text has no deadline: nothing in it can run on. */
  patternDeadlineMs: number;
  /** Asked as a pattern's worker is to start — never for a plain text, nor for a text that is refused. */
  patternTurn(): LogPatternTurn;
}

export type LogTextFlagsResult =
  | {
      ok: true;
      /** Per row: 1 where the text matches its commit. */
      flags: Uint8Array;
    }
  | { ok: false; reason: 'invalid-text' | 'timeout' | 'aborted' };

type Match = Extract<LogTextMatcher, { kind: 'match' }>;

/** The matcher of a text core takes; null for one that is no shape, or a pattern that does not compile. */
function matcherOf(ask: LogTextAsk): Match | null {
  // Compiling a pattern is safe here; running it is the worker's.
  const matcher = makeLogTextMatcher(ask.text, ask.regex, ask.matchCase);
  return matcher.kind === 'match' ? matcher : null;
}

/** Whether `ask` is something a history can be searched for: a text of a valid shape, a pattern that compiles. */
export function isLogTextAsk(ask: LogTextAsk): boolean {
  return matcherOf(ask) !== null;
}

async function plainFlags(rows: LogTextRows, matcher: Match, signal: AbortSignal): Promise<Uint8Array | null> {
  if (signal.aborted) return null;
  const { store, textOf, hashes, width } = rows;
  const flags = new Uint8Array(textOf.length);
  const byAuthor = store.authors.map((name) => matcher.testText(name));
  for (let row = 0; row < textOf.length; row += 1) {
    if (row % STRETCH_ROWS === STRETCH_ROWS - 1) {
      await breathe();
      if (signal.aborted) return null;
    }
    const text = textOf[row];
    if (text !== -1 && (byAuthor[store.authorIdOf(text)] || matcher.testText(store.subjectOf(text)))) {
      flags[row] = 1;
    } else if (matcher.testSha?.(hashes.toString('hex', row * width, (row + 1) * width)) === true) {
      flags[row] = 1;
    }
  }
  return flags;
}

/**
 * The flags of the rows `ask` matches. A worker that fails rejects —
 * the caller's failure to report, like any other fault of a read.
 */
export async function flagLogTexts(
  rows: LogTextRows,
  ask: LogTextAsk,
  options: FlagLogTextsOptions,
): Promise<LogTextFlagsResult> {
  const matcher = matcherOf(ask);
  if (matcher === null) return { ok: false, reason: 'invalid-text' };
  const { signal } = options;
  if (matcher.pattern === null) {
    const flags = await plainFlags(rows, matcher, signal);
    return flags === null ? { ok: false, reason: 'aborted' } : { ok: true, flags };
  }
  const turn = options.patternTurn();
  try {
    // A turn taken away is the time the pattern was given, run out.
    const time = AbortSignal.any([AbortSignal.timeout(options.patternDeadlineMs), turn.signal]);
    const flags = await flagRowsByPattern(
      matcher.pattern,
      { view: rows.store.view(), textOf: rows.textOf, hashes: rows.hashes, width: rows.width },
      AbortSignal.any([signal, time]),
    );
    if (flags !== null) return { ok: true, flags };
    return { ok: false, reason: signal.aborted ? 'aborted' : 'timeout' };
  } finally {
    turn.done();
  }
}
