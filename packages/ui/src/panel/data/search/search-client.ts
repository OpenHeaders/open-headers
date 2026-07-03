/**
 * Panel-side client for the search Worker.
 *
 * Wraps a `SearchTransport`, tracks an incrementing `sessionId` per
 * submit, and routes only session-matching messages to the caller's
 * callbacks. `submit()` automatically aborts any previous in-flight
 * search — callers don't have to.
 *
 * One singleton client per panel lifetime (see `getDefaultSearchClient`).
 * The underlying worker is lazily created on first `submit()`.
 */

import type { FilterConfig } from '../filter-engine';
import type { InspectorRow } from '../inspector-facet';
import type { SearchGroup, SearchProgress } from './search-engine';
import { createDefaultTransport, type SearchTransport } from './search-transport';
import type { MainToWorker } from './search-worker-protocol';

export interface SearchClientCallbacks {
  onGroup: (group: SearchGroup) => void;
  onProgress: (progress: SearchProgress) => void;
  onDone: (progress: SearchProgress) => void;
}

export interface SearchHandle {
  readonly sessionId: number;
  abort(): void;
}

interface ActiveSession {
  handle: SearchHandle;
  callbacks: SearchClientCallbacks;
  /** Unsubscribe the per-session message listener. */
  unsubscribeMessages: () => void;
}

export class SearchClient {
  private nextSessionId = 1;
  private activeSession: ActiveSession | null = null;
  /** True once the underlying transport has signalled a fatal error. */
  private dead = false;
  private unsubscribeError: (() => void) | null = null;

  constructor(private transport: SearchTransport) {
    this.unsubscribeError =
      transport.onError?.((err) => {
        this.dead = true;
        const active = this.activeSession;
        this.activeSession = null;
        if (active) {
          active.unsubscribeMessages();
          try {
            active.callbacks.onDone({ done: 0, total: 0, elapsedMs: 0 });
          } catch (cbErr) {
            console.error('[search] onDone threw during worker-error recovery', cbErr);
          }
        }
        console.error('[search] Search worker died', err);
      }) ?? null;
  }

  submit(
    rows: readonly InspectorRow[],
    query: string,
    config: FilterConfig,
    callbacks: SearchClientCallbacks,
  ): SearchHandle {
    if (this.dead) {
      const sessionId = this.nextSessionId++;
      queueMicrotask(() => callbacks.onDone({ done: 0, total: 0, elapsedMs: 0 }));
      return { sessionId, abort: () => {} };
    }

    this.activeSession?.handle.abort();

    const sessionId = this.nextSessionId++;

    const unsubscribe = this.transport.onMessage((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.type === 'group') {
        callbacks.onGroup(msg.group);
      } else if (msg.type === 'progress') {
        callbacks.onProgress(msg.progress);
      } else if (msg.type === 'done') {
        callbacks.onDone(msg.progress);
        unsubscribe();
        if (this.activeSession?.handle.sessionId === sessionId) this.activeSession = null;
      }
    });

    const handle: SearchHandle = {
      sessionId,
      abort: () => {
        if (!this.dead) {
          const abortMsg: MainToWorker = { type: 'abort', sessionId };
          this.transport.send(abortMsg);
        }
        unsubscribe();
        if (this.activeSession?.handle.sessionId === sessionId) this.activeSession = null;
      },
    };
    this.activeSession = { handle, callbacks, unsubscribeMessages: unsubscribe };

    const searchMsg: MainToWorker = {
      type: 'search',
      sessionId,
      query,
      config,
      rows: Array.from(rows),
    };
    this.transport.send(searchMsg);

    return handle;
  }

  /** True once the transport has died — callers should stop using this client. */
  isDead(): boolean {
    return this.dead;
  }

  terminate(): void {
    this.activeSession?.handle.abort();
    this.activeSession = null;
    this.unsubscribeError?.();
    this.unsubscribeError = null;
    this.transport.terminate?.();
    this.dead = true;
  }
}

let defaultClient: SearchClient | null = null;

/**
 * Lazily-constructed singleton client for the panel. Creating a Worker
 * has non-trivial cost (tens of ms on first use) and we want to
 * amortise that across the panel's lifetime, not pay it per hook
 * instance or per render.
 */
export function getDefaultSearchClient(): SearchClient {
  if (defaultClient?.isDead()) defaultClient = null;
  if (!defaultClient) {
    defaultClient = new SearchClient(createDefaultTransport());
  }
  return defaultClient;
}
