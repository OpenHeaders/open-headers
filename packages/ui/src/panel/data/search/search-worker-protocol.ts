/**
 * Wire protocol between the panel (main thread) and the search Worker.
 *
 * Two message planes:
 *
 *   - **sync** maintains the worker's persistent doc cache. The client
 *     version-diffs against what the worker already holds and ships
 *     only new/changed docs (plus removals) — a repeat search over a
 *     settled capture syncs nothing, which is what keeps large-capture
 *     search instant on Firefox (a full-capture structured clone per
 *     submit used to dominate the run time there).
 *   - **search / abort** run scans over the cached docs. A search
 *     message carries only the query, the match config, and the source
 *     kinds to include — no payload.
 *
 * Every search gets a monotonic `sessionId`. The worker tags every
 * response with the session id it came from; the client ignores any
 * message whose session id doesn't match the currently-subscribed
 * session. This lets a new search arrive before the previous one has
 * finished producing its trailing messages without mixing results.
 */

import type { TextMatchConfig } from '../text-match';
import type { SearchDoc, SearchSourceKind } from './search-doc';
import type { SearchGroup, SearchProgress } from './search-engine';

export type MainToWorker =
  | { type: 'sync'; upserts: SearchDoc[]; removedIds: string[] }
  | {
      type: 'search';
      sessionId: number;
      query: string;
      config: TextMatchConfig;
      sources: SearchSourceKind[];
    }
  | { type: 'abort'; sessionId: number };

export type WorkerToMain =
  | { type: 'group'; sessionId: number; group: SearchGroup }
  | { type: 'progress'; sessionId: number; progress: SearchProgress }
  | { type: 'done'; sessionId: number; progress: SearchProgress };
