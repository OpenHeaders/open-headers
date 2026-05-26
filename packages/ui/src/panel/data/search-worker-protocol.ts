/**
 * Wire protocol between the panel (main thread) and the search Worker.
 *
 * Every search gets a monotonic `sessionId`. The worker tags every
 * response with the session id it came from; the client ignores any
 * message whose session id doesn't match the currently-subscribed
 * session. This lets a new search arrive before the previous one has
 * finished producing its trailing messages without mixing results.
 *
 * Structured-clone handles the transport: `InspectorRow` is plain data
 * (strings, numbers, nested plain objects, `ReadonlyMap`) so it
 * round-trips cleanly. No `transfer` list is used — string data can't
 * be transferred zero-copy, and rows are read-only to the worker.
 */

import type { FilterConfig } from './filter-engine';
import type { InspectorRow } from './inspector-facet';
import type { SearchGroup, SearchProgress } from './search-engine';

export type MainToWorker =
  | {
      type: 'search';
      sessionId: number;
      query: string;
      config: FilterConfig;
      rows: InspectorRow[];
    }
  | { type: 'abort'; sessionId: number };

export type WorkerToMain =
  | { type: 'group'; sessionId: number; group: SearchGroup }
  | { type: 'progress'; sessionId: number; progress: SearchProgress }
  | { type: 'done'; sessionId: number; progress: SearchProgress };
