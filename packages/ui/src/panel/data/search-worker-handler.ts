/**
 * Pure message-dispatch core for the search Worker.
 *
 * Extracted out of `search.worker.ts` so the handler can be unit-tested
 * in Node/jsdom without actually spawning a `Worker` — the worker entry
 * point itself is a 10-line adapter that wires `self.postMessage` and
 * `self.onmessage` to this handler.
 *
 * ## Session semantics
 *
 * At most one search runs at a time. A new `search` message aborts any
 * in-flight run before launching. `abort` is a no-op unless its
 * `sessionId` matches the currently running session — this prevents
 * a late abort (e.g. from a session the client already abandoned) from
 * tearing down a newer run.
 */

import { runSearch } from './search-engine';
import type { MainToWorker, WorkerToMain } from './search-worker-protocol';

export interface SearchHandlerContext {
  /** Post a message back to the main thread. */
  post(msg: WorkerToMain): void;
}

export interface SearchHandler {
  handle(msg: MainToWorker): void;
  /** Abort the in-flight run, if any. Used when the worker is about to terminate. */
  dispose(): void;
}

export function createSearchHandler(ctx: SearchHandlerContext): SearchHandler {
  let currentSessionId = -1;
  let currentAbort: AbortController | null = null;

  const startSearch = (msg: Extract<MainToWorker, { type: 'search' }>) => {
    currentAbort?.abort();
    currentSessionId = msg.sessionId;
    const ctrl = new AbortController();
    currentAbort = ctrl;

    const sessionId = msg.sessionId;
    runSearch(msg.entries, msg.query, msg.config, ctrl.signal, {
      onGroup: (group) => {
        if (!ctrl.signal.aborted) ctx.post({ type: 'group', sessionId, group });
      },
      onProgress: (progress) => {
        if (!ctrl.signal.aborted) ctx.post({ type: 'progress', sessionId, progress });
      },
      onDone: (progress) => {
        if (!ctrl.signal.aborted) ctx.post({ type: 'done', sessionId, progress });
        if (currentSessionId === sessionId) {
          currentAbort = null;
        }
      },
    }).catch(() => {
      // runSearch resolves on abort; a rejection would only come from a
      // programming error. Swallow so the worker stays alive.
    });
  };

  return {
    handle(msg) {
      if (msg.type === 'abort') {
        if (msg.sessionId === currentSessionId) {
          currentAbort?.abort();
          currentAbort = null;
        }
        return;
      }
      if (msg.type === 'search') {
        startSearch(msg);
      }
    },
    dispose() {
      currentAbort?.abort();
      currentAbort = null;
    },
  };
}
