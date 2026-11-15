/**
 * The lane a history search's text is matched in — chosen by what the
 * text is, because the two are not the same risk:
 *
 *   - a PLAIN text is read where it stands. No pattern engine runs, the
 *     cost is linear in what is read, and it is safe on the host's own
 *     thread.
 *   - a PATTERN is the caller's program run over text the caller did
 *     not write either (anyone who can push names a commit). The
 *     engine backtracks, has no deadline of its own, and one bad pair
 *     holds whatever thread runs it for as long as it likes. So it
 *     never runs on the host's thread: it runs in a worker of its own,
 *     and the search's signal — its deadline, a newer search, a full
 *     page — ENDS that worker, which is the only thing that stops a
 *     pattern mid-run.
 *
 * The worker is one small self-contained script, started from its text:
 * every host this ships in is a single bundle (the single-executable
 * one resolves no file beside itself), so there is no worker file to
 * point at. It tests the same three fields core's matcher does; a pin
 * holds the two to the same answers.
 */

import { Worker } from 'node:worker_threads';
import type { LogTextFields } from '@openheaders/core/workspace-tree';
import { isValidLogSearchText, type LogSearchMatch, plainTextMatch } from './log-search';

export interface LogSearchLane {
  match: LogSearchMatch;
  /** The search is over: whatever the lane started ends. */
  close(): void;
}

/** A worker's heap — a pattern's matching needs next to none; the bound is against a pattern that wants more. */
const PATTERN_WORKER_HEAP_MB = 64;

const PATTERN_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const pattern = new RegExp(workerData.source, workerData.flags);
parentPort.on('message', (rows) => {
  const matched = new Array(rows.length);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    matched[index] = pattern.test(row.subject) || pattern.test(row.authorName) || pattern.test(row.sha);
  }
  parentPort.postMessage(matched);
});
`;

/** No row matched — the answer of a lane that was ended. */
const none = (rows: readonly LogTextFields[]): boolean[] => rows.map(() => false);

function patternLane(source: string, flags: string): LogSearchLane {
  // Started by the first batch: a search refused before its walk starts no thread.
  let worker: Worker | null = null;
  let over = false;

  const end = (): void => {
    over = true;
    void worker?.terminate();
    worker = null;
  };

  return {
    close: end,
    match: (rows, signal) =>
      new Promise<boolean[]>((resolve, reject) => {
        if (over || signal.aborted) {
          end();
          resolve(none(rows));
          return;
        }
        worker ??= new Worker(PATTERN_WORKER, {
          eval: true,
          workerData: { source, flags },
          resourceLimits: { maxOldGenerationSizeMb: PATTERN_WORKER_HEAP_MB },
        });
        const running = worker;
        // A search that ends leaves no thread to hold the host's exit.
        running.unref();
        const settle = (answer: boolean[] | { fault: Error }): void => {
          running.off('message', onAnswer);
          running.off('error', onFault);
          running.off('exit', onExit);
          signal.removeEventListener('abort', onAbort);
          if (Array.isArray(answer)) resolve(answer);
          else reject(answer.fault);
        };
        const onAnswer = (matched: boolean[]): void => settle(matched);
        // The pattern may be mid-run: ending its thread is what stops it.
        const onAbort = (): void => {
          end();
          settle(none(rows));
        };
        const onFault = (fault: Error): void => {
          end();
          settle({ fault });
        };
        const onExit = (): void => {
          end();
          settle(signal.aborted ? none(rows) : { fault: new Error('the pattern worker ended before it answered') });
        };
        running.once('message', onAnswer);
        running.once('error', onFault);
        running.once('exit', onExit);
        signal.addEventListener('abort', onAbort, { once: true });
        running.postMessage(rows);
      }),
  };
}

/**
 * The lane for a search's text — null for a text that is no valid
 * shape, or a pattern that does not compile. Compiling a pattern is
 * safe here; running it is the worker's.
 */
export function openLogSearchLane(text: string, regex: boolean, matchCase: boolean): LogSearchLane | null {
  if (!regex) {
    const match = plainTextMatch(text, matchCase);
    return match === null ? null : { match, close: () => undefined };
  }
  if (!isValidLogSearchText(text)) return null;
  const source = text.trim();
  const flags = matchCase ? '' : 'i';
  return compiles(source, flags) ? patternLane(source, flags) : null;
}

function compiles(source: string, flags: string): boolean {
  try {
    return new RegExp(source, flags) instanceof RegExp;
  } catch {
    return false;
  }
}
