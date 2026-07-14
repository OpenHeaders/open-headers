/**
 * Panel-side client for the search Worker.
 *
 * Wraps a `SearchTransport`, tracks an incrementing `sessionId` per
 * submit, and routes only session-matching messages to the caller's
 * callbacks. `submit()` automatically aborts any previous in-flight
 * search — callers don't have to.
 *
 * ## Version-diffed doc sync
 *
 * The client mirrors the worker's persistent doc cache. Each submit
 * carries `SearchDocInput`s — id + version token + lazy projection.
 * Docs whose version token is `Object.is`-equal to what the worker
 * already holds are neither re-projected nor re-shipped; removals are
 * computed per covered source (a source absent from the submit keeps
 * its cached docs — chip toggles must not churn the cache). This is
 * the fix for the Firefox field report: shipping the whole capture per
 * submit cost 30–60 s there; the diffed sync ships only what changed.
 *
 * One singleton client per panel lifetime (see `getDefaultSearchClient`).
 * The underlying worker is lazily created on first `submit()`.
 */

import type { TextMatchConfig } from '../text-match';
import type { SearchDoc, SearchDocInput, SearchSourceKind } from './search-doc';
import type { SearchGroup, SearchProgress } from './search-engine';
import { createDefaultTransport, type SearchTransport } from './search-transport';
import type { MainToWorker } from './search-worker-protocol';

export interface SearchClientCallbacks {
  onGroup: (group: SearchGroup) => void;
  onProgress: (progress: SearchProgress) => void;
  onDone: (progress: SearchProgress) => void;
}

export interface SearchSubmission {
  /** Every doc of every source this submit enumerated. A synced doc
   *  whose source is covered but which is absent here gets removed. */
  docs: readonly SearchDocInput[];
  /** Source kinds `docs` fully enumerates (removal scope). */
  coveredSources: readonly SearchSourceKind[];
  query: string;
  config: TextMatchConfig;
  /** Source kinds this search scans. */
  sources: readonly SearchSourceKind[];
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

interface SyncedDoc {
  version: unknown;
  source: SearchSourceKind;
}

export class SearchClient {
  private nextSessionId = 1;
  private activeSession: ActiveSession | null = null;
  /** Mirror of the worker's doc cache — docId → last shipped version. */
  private synced = new Map<string, SyncedDoc>();
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

  /** Diff `docs` against the mirror and ship only what changed. */
  private sync(docs: readonly SearchDocInput[], coveredSources: readonly SearchSourceKind[]): void {
    const upserts: SearchDoc[] = [];
    const currentIds = new Set<string>();
    for (const input of docs) {
      currentIds.add(input.docId);
      const known = this.synced.get(input.docId);
      if (known !== undefined && Object.is(known.version, input.version)) continue;
      upserts.push(input.build());
      this.synced.set(input.docId, { version: input.version, source: input.source });
    }
    const covered = new Set(coveredSources);
    const removedIds: string[] = [];
    for (const [docId, doc] of this.synced) {
      if (!covered.has(doc.source) || currentIds.has(docId)) continue;
      removedIds.push(docId);
      this.synced.delete(docId);
    }
    if (upserts.length === 0 && removedIds.length === 0) return;
    const syncMsg: MainToWorker = { type: 'sync', upserts, removedIds };
    this.transport.send(syncMsg);
  }

  submit(submission: SearchSubmission, callbacks: SearchClientCallbacks): SearchHandle {
    if (this.dead) {
      const sessionId = this.nextSessionId++;
      queueMicrotask(() => callbacks.onDone({ done: 0, total: 0, elapsedMs: 0 }));
      return { sessionId, abort: () => {} };
    }

    this.activeSession?.handle.abort();

    this.sync(submission.docs, submission.coveredSources);

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
      query: submission.query,
      config: submission.config,
      sources: Array.from(submission.sources),
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
    this.synced.clear();
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
