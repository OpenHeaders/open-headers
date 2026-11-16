/**
 * A pattern matched over a reading's texts in a thread of its own.
 *
 * A pattern is the caller's program run over text the caller did not
 * write either (anyone who can push names a commit, and signs it with
 * any name). The engine backtracks, has no deadline of its own, and one
 * bad pair holds whatever thread runs it for as long as it likes. So it
 * never runs on the host's thread — not over a subject, not over a
 * name, not over a hash: a worker reads the texts where they stand in
 * shared memory, and the signal ENDS that worker, which is the only
 * thing that stops a pattern mid-run.
 *
 * The worker is one small self-contained script, started from its text:
 * every host this ships in is a single bundle (the single-executable
 * one resolves no file beside itself), so there is no worker file to
 * point at. It tests what core's matcher tests — a subject, an author's
 * name, the whole hash — and a pin holds the two to the same answers.
 */

import { Worker } from 'node:worker_threads';
import type { LogTextView } from './log-text-store';

/** A worker's heap — a pattern's matching needs next to none; the bound is against a pattern that wants more. */
const PATTERN_WORKER_HEAP_MB = 64;

const PATTERN_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const { view, textOf, width } = workerData;
const pattern = new RegExp(workerData.source, workerData.flags);
const subjects = Buffer.from(view.subjects);
const starts = new Uint32Array(view.starts);
const authorIds = new Uint32Array(view.authorIds);
const byAuthor = view.authors.map((name) => pattern.test(name));
const hashes = Buffer.from(workerData.hashes.buffer, workerData.hashes.byteOffset, workerData.hashes.byteLength);
const flags = new Uint8Array(textOf.length);
for (let row = 0; row < textOf.length; row += 1) {
  const text = textOf[row];
  if (text !== -1 && (byAuthor[authorIds[text]] || pattern.test(subjects.toString('utf8', starts[text], starts[text + 1])))) {
    flags[row] = 1;
  } else if (pattern.test(hashes.toString('hex', row * width, (row + 1) * width))) {
    flags[row] = 1;
  }
}
parentPort.postMessage(flags, [flags.buffer]);
`;

/** The rows of a reading as a worker takes them: the store as it stands, a text and a hash per row. */
export interface LogPatternRows {
  view: LogTextView;
  /** Per row: the number of its text in the view; -1 for none. */
  textOf: Int32Array;
  /** The rows' hashes, packed: `width` bytes each. */
  hashes: Buffer;
  width: number;
}

/**
 * Per row: 1 where `pattern` matches its commit. Null once `signal` is
 * aborted — the worker is ended wherever it was. A worker that fails
 * rejects.
 */
export function flagRowsByPattern(
  pattern: RegExp,
  rows: LogPatternRows,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  // Nobody waits: no thread is started.
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const worker = new Worker(PATTERN_WORKER, {
      eval: true,
      workerData: { source: pattern.source, flags: pattern.flags, ...rows },
      resourceLimits: { maxOldGenerationSizeMb: PATTERN_WORKER_HEAP_MB },
    });
    let settled = false;
    const settle = (answer: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      // The pattern may be mid-run: ending its thread is what stops it.
      void worker.terminate();
      answer();
    };
    const onAbort = (): void => settle(() => resolve(null));
    signal.addEventListener('abort', onAbort, { once: true });
    worker.once('message', (flags: Uint8Array) => settle(() => resolve(flags)));
    worker.once('error', (fault) => settle(() => reject(fault)));
    worker.once('exit', () => settle(() => reject(new Error('the pattern worker ended before it answered'))));
  });
}
