/**
 * Pure message-dispatch core for the search Worker.
 *
 * Extracted out of `search.worker.ts` so the handler can be unit-tested
 * in Node/jsdom without actually spawning a `Worker` — the worker entry
 * point itself is a 10-line adapter that wires `self.postMessage` and
 * `self.onmessage` to this handler.
 *
 * ## Doc cache
 *
 * The handler owns the persistent searchable-doc cache `sync` messages
 * maintain (upserts + removals). A `search` message scans the cached
 * docs of the requested sources — it carries no payload itself, so a
 * repeat search over a settled capture costs no clone at all.
 *
 * ## Session semantics
 *
 * At most one search runs at a time. A new `search` message aborts any
 * in-flight run before launching. `abort` is a no-op unless its
 * `sessionId` matches the currently running session — this prevents
 * a late abort (e.g. from a session the client already abandoned) from
 * tearing down a newer run.
 */

import type { SearchDoc, SearchSourceKind } from './search-doc';
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

const SOURCE_RANK: Record<SearchSourceKind, number> = { network: 0, storage: 1, console: 2 };

export function createSearchHandler(ctx: SearchHandlerContext): SearchHandler {
  const docs = new Map<string, SearchDoc>();
  let currentSessionId = -1;
  let currentAbort: AbortController | null = null;

  const startSearch = (msg: Extract<MainToWorker, { type: 'search' }>) => {
    currentAbort?.abort();
    currentSessionId = msg.sessionId;
    const ctrl = new AbortController();
    currentAbort = ctrl;

    // Scan order: network rows first (by capture time), then storage,
    // then console — result groups stream in the order the panel lists
    // its tools.
    const wanted = new Set(msg.sources);
    const scanDocs = [...docs.values()]
      .filter((d) => wanted.has(d.source))
      .sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.timestamp - b.timestamp);

    const sessionId = msg.sessionId;
    runSearch(scanDocs, msg.query, msg.config, ctrl.signal, {
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
      if (msg.type === 'sync') {
        for (const doc of msg.upserts) docs.set(doc.docId, doc);
        for (const id of msg.removedIds) docs.delete(id);
        return;
      }
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
      docs.clear();
    },
  };
}
