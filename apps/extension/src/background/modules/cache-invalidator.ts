/**
 * Cache invalidator — platform adapter over `chrome.browsingData.remove`
 * and `chrome.webRequest.handlerBehaviorChanged`.
 *
 * One responsibility: evict HTTP cache entries when the rule-state
 * observer says something transitioned. Knows nothing about rules,
 * origins extraction, or when to fire — the observer decides that and
 * calls in with an already-resolved origin set.
 *
 * Design notes:
 *
 *   - **No local debouncing.** Rule edits flow through `scheduleUpdate`
 *     in rule-engine.ts which debounces at `rulesEngine.updateDebounceMs`
 *     (default 150ms). By the time our observer sees a transition, the
 *     upstream coalescing is already done. A second layer of debouncing
 *     here would only widen the window during which a user refresh
 *     could see a stale cache entry — without any benefit.
 *
 *   - **Serialized via a promise chain.** The docs warn that
 *     `browsingData.remove` "can take tens of seconds to complete."
 *     If a new transition lands while a prior flush is still in-flight,
 *     its flush gets chained on instead of racing against it.
 *
 *   - **Broad fallback** kicks in when the caller flags the scope as
 *     broad OR when the number of distinct origins exceeds
 *     `BROAD_ORIGIN_THRESHOLD`. At that point the surgical eviction
 *     would be more API calls than the global wipe, so we just call
 *     `browsingData.remove({}, { cache: true })` and be done.
 *
 *   - **Graceful failure**: if `browsingData` permission isn't granted
 *     (enterprise policy, user revoked it after install) or the API
 *     is unavailable (non-Chromium build), we log and no-op. Worst
 *     case the user sees stale cache until natural expiry.
 *
 *   - **handlerBehaviorChanged** is called alongside so the extension's
 *     own webRequest routing cache (which drives inspector attribution)
 *     doesn't fall out of sync with the new rule state.
 */

import { logger } from '@utils/logger';

/**
 * Above this origin count, do a global wipe instead of a scoped list.
 * `browsingData.remove` accepts a list of origins but each invocation
 * is still per-origin work internally; past ~10 the global call is
 * cheaper and still invisible to the user.
 */
const BROAD_ORIGIN_THRESHOLD = 10;

interface PendingInvalidation {
  origins: Set<string>;
  broad: boolean;
}

/**
 * Promise chain that serializes `flush()` invocations. The docs note
 * `browsingData.remove` "can take tens of seconds to complete"; if a
 * rule edit lands during a long-running eviction, the new batch's
 * flush is chained onto the in-flight one instead of racing against
 * it. Always resolves — `flush()` swallows API errors internally.
 */
let flushChain: Promise<void> = Promise.resolve();

/**
 * Enqueue a cache-eviction request. Schedules a `browsingData.remove`
 * call to run as soon as any in-flight eviction completes — no local
 * debouncing; rule-engine handles that upstream.
 *
 *   - `origins`: concrete origin strings (`https://api.example.com`).
 *     Empty array + `broad: false` is a no-op.
 *   - `broad`: when true, do a global HTTP cache wipe instead of the
 *     per-origin call.
 */
export function enqueueInvalidation(origins: readonly string[], broad = false): void {
  if (!broad && origins.length === 0) return;
  const batch: PendingInvalidation = { origins: new Set(origins), broad };
  flushChain = flushChain.then(() => flush(batch));
}

/**
 * Wait for the current flush chain to drain. Useful in tests or when
 * a caller needs to be sure eviction has actually completed.
 */
export async function flushPending(): Promise<void> {
  await flushChain;
}

/** Test-only: reset the flush chain. */
export function __resetPendingForTests(): void {
  flushChain = Promise.resolve();
}

// ── Internal flush ───────────────────────────────────────────────

async function flush(batch: PendingInvalidation): Promise<void> {
  const api = getBrowsingDataApi();
  if (!api) {
    logger.info('CacheInvalidator', 'browsingData API unavailable — skipping eviction');
    notifyWebRequestCacheChanged();
    return;
  }

  const origins = [...batch.origins];
  const broad = batch.broad || origins.length > BROAD_ORIGIN_THRESHOLD;

  try {
    if (broad) {
      await api.remove({}, { cache: true });
      logger.debug(
        'CacheInvalidator',
        `Global HTTP cache evicted (rule state transition, ${origins.length} origin(s))`,
      );
    } else {
      await api.remove({ origins }, { cache: true });
      logger.debug('CacheInvalidator', `HTTP cache evicted for ${origins.length} origin(s)`);
    }
  } catch (err) {
    // Permission denied / enterprise policy / API bug — graceful no-op.
    logger.info('CacheInvalidator', `Eviction failed: ${(err as Error).message}`);
  }

  notifyWebRequestCacheChanged();
}

interface BrowsingDataRemovalOptions {
  origins?: string[];
}

interface BrowsingDataDataToRemove {
  cache?: boolean;
}

interface BrowsingDataApi {
  remove(options: BrowsingDataRemovalOptions, dataToRemove: BrowsingDataDataToRemove): Promise<void>;
}

function getBrowsingDataApi(): BrowsingDataApi | null {
  const c = globalThis as unknown as {
    chrome?: { browsingData?: BrowsingDataApi };
    browser?: { browsingData?: BrowsingDataApi };
  };
  return c.chrome?.browsingData ?? c.browser?.browsingData ?? null;
}

/**
 * The extension's own webRequest listeners (see `request-monitor`) feed
 * the DevTools inspector's rule-attribution panel. Chrome caches
 * webRequest handler decisions; after a rule state transition we want
 * the panel to pick up the new shape on the very next request, not the
 * one after cache turnover. `handlerBehaviorChanged` flushes that
 * internal cache — cheap when used sparingly.
 */
function notifyWebRequestCacheChanged(): void {
  const c = globalThis as unknown as {
    chrome?: { webRequest?: { handlerBehaviorChanged?: () => void } };
    browser?: { webRequest?: { handlerBehaviorChanged?: () => void } };
  };
  const fn = c.chrome?.webRequest?.handlerBehaviorChanged ?? c.browser?.webRequest?.handlerBehaviorChanged;
  if (typeof fn === 'function') {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}
