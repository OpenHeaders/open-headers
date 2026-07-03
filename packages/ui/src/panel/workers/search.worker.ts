/// <reference lib="webworker" />
/**
 * Search Worker entry — a thin adapter that wires the browser's Worker
 * globals (`self.postMessage`, `self.addEventListener('message')`) to
 * the pure `SearchHandler` core. All search logic lives in
 * `search-worker-handler.ts` so it can be unit-tested off-thread.
 */

import { createSearchHandler } from '../data/search/search-worker-handler';
import type { MainToWorker } from '../data/search/search-worker-protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const handler = createSearchHandler({
  post: (msg) => ctx.postMessage(msg),
});

ctx.addEventListener('message', (e: MessageEvent<MainToWorker>) => {
  handler.handle(e.data);
});
