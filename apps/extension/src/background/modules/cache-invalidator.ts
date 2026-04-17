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
 *   - **Debounced** (750ms, trailing). Rapid rule edits (typing in a
 *     URL-pattern field with live-save semantics) coalesce into one
 *     eviction call. Scope accumulates across the debounce window so
 *     a burst of toggles on different rules still evicts everything
 *     those rules touched.
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
 *     case the user sees stale cache until natural expiry — which is
 *     exactly today's behavior.
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

/**
 * Trailing-edge debounce window. Rule editors often fire many rapid
 * save events as the user types into a URL-pattern field; 750ms comfortably
 * straddles human typing cadence without delaying the post-edit
 * eviction past "feels immediate."
 */
const DEBOUNCE_MS = 750;

interface PendingInvalidation {
  /** Union of origins collected across the current debounce window. */
  origins: Set<string>;
  /** Sticky flag — any broad enqueue promotes the whole batch to global. */
  broad: boolean;
}

let pending: PendingInvalidation | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Enqueue a cache-eviction request. Returns immediately; the actual
 * Chrome API call fires after `DEBOUNCE_MS` of quiet.
 *
 *   - `origins`: concrete origin strings (`https://api.example.com`).
 *     Empty array + `broad: false` is a no-op.
 *   - `broad`: when true, don't bother with a scoped eviction — do a
 *     global HTTP cache wipe.
 */
export function enqueueInvalidation(origins: readonly string[], broad = false): void {
  if (!broad && origins.length === 0) return;

  if (!pending) pending = { origins: new Set(), broad: false };
  for (const o of origins) pending.origins.add(o);
  if (broad) pending.broad = true;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const batch = pending;
    pending = null;
    timer = null;
    if (batch) void flush(batch);
  }, DEBOUNCE_MS);
}

/**
 * Force the pending batch to fire now instead of waiting out the debounce.
 * Used by the observer when it needs synchronous eviction — e.g. right
 * before a test harness takes a fresh snapshot. No-op if nothing's pending.
 */
export async function flushPending(): Promise<void> {
  if (!timer || !pending) return;
  clearTimeout(timer);
  const batch = pending;
  pending = null;
  timer = null;
  await flush(batch);
}

/** Test-only: drop any pending invalidation without firing it. */
export function __resetPendingForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
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
      logger.info('CacheInvalidator', `Global HTTP cache evicted (rule state transition, ${origins.length} origin(s))`);
    } else {
      await api.remove({ origins }, { cache: true });
      logger.info('CacheInvalidator', `HTTP cache evicted for ${origins.length} origin(s)`);
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
