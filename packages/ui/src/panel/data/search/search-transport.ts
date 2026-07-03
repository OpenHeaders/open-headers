/**
 * Transport abstraction between the search client (main thread) and
 * the `SearchHandler` (worker thread in production, same thread in
 * tests / no-Worker environments).
 *
 * The abstraction exists for two reasons:
 *
 *   1. **Testability.** jsdom-based vitest doesn't run real Workers.
 *      Swapping in `createInlineTransport()` routes messages through
 *      an in-process handler so the client + hook code can be exercised
 *      end-to-end without a browser Worker.
 *
 *   2. **Graceful fallback.** If `Worker` is unavailable for any reason
 *      (hostile CSP, unusual extension context), `createDefaultTransport`
 *      falls back to inline execution. Search is slower but still works.
 *
 * In production (panel running under Chrome MV3), `createWorkerTransport`
 * is what runs — search executes entirely off the main thread, matching
 * Chrome DevTools' own architecture for Network-panel search.
 */

import { createSearchHandler } from './search-worker-handler';
import type { MainToWorker, WorkerToMain } from './search-worker-protocol';

export interface SearchTransport {
  send(msg: MainToWorker): void;
  onMessage(listener: (msg: WorkerToMain) => void): () => void;
  /**
   * Subscribe to transport-level fatal errors (worker crash,
   * structured-clone failure). When this fires, the transport is
   * considered dead — callers should abort their active sessions and
   * construct a new transport.
   */
  onError?(listener: (err: Error) => void): () => void;
  terminate?(): void;
}

/** Real Worker transport — spawns a dedicated worker, relays messages.
 *
 * Uses a module worker. Minimum-version floors (Chrome 80+, Firefox 115+,
 * Safari 15+, Edge 80+) all support `type: 'module'`.
 *
 * Listens for `error` (uncaught exception in the worker) and
 * `messageerror` (structured-clone failure on either side) so callers
 * can be notified when the worker dies. Without this, a crash would
 * leave in-flight searches hanging forever. */
export function createWorkerTransport(): SearchTransport {
  const worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), {
    type: 'module',
    name: 'openheaders-search',
  });
  const listeners = new Set<(msg: WorkerToMain) => void>();
  const errorListeners = new Set<(err: Error) => void>();
  let dead = false;

  worker.addEventListener('message', (e: MessageEvent<WorkerToMain>) => {
    for (const fn of listeners) fn(e.data);
  });

  const reportError = (err: Error) => {
    if (dead) return;
    dead = true;
    for (const fn of errorListeners) fn(err);
  };

  worker.addEventListener('error', (e: ErrorEvent) => {
    reportError(new Error(e.message || 'Worker uncaught error'));
  });
  worker.addEventListener('messageerror', () => {
    reportError(new Error('Worker messageerror (structured-clone failure)'));
  });

  return {
    send: (msg) => {
      if (dead) return;
      worker.postMessage(msg);
    },
    onMessage: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    onError: (fn) => {
      errorListeners.add(fn);
      return () => {
        errorListeners.delete(fn);
      };
    },
    terminate: () => {
      dead = true;
      listeners.clear();
      errorListeners.clear();
      worker.terminate();
    },
  };
}

/**
 * In-process transport — runs the handler on the same thread. Used by
 * tests and as a fallback when `Worker` isn't available. Messages are
 * dispatched via `queueMicrotask` so ordering matches a real Worker
 * (post is always async relative to the caller's sync code).
 */
export function createInlineTransport(): SearchTransport {
  const listeners = new Set<(msg: WorkerToMain) => void>();
  // `onError` is a no-op for inline: handler errors throw synchronously
  // in the same realm and surface via the normal JS error path; there
  // is no "worker crashed" state for an in-process function call.
  const handler = createSearchHandler({
    post: (msg) => {
      queueMicrotask(() => {
        for (const fn of listeners) fn(msg);
      });
    },
  });
  return {
    send: (msg) => {
      queueMicrotask(() => handler.handle(msg));
    },
    onMessage: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    onError: () => () => {},
    terminate: () => {
      listeners.clear();
      handler.dispose();
    },
  };
}

/**
 * Pick the best available transport. Prefers a real Worker; falls back
 * to inline execution if Worker isn't defined or construction throws.
 */
export function createDefaultTransport(): SearchTransport {
  if (typeof Worker === 'undefined') return createInlineTransport();
  try {
    return createWorkerTransport();
  } catch {
    return createInlineTransport();
  }
}
