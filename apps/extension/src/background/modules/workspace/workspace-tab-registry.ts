/**
 * Workspace Tab Registry — SW-owned `Map<tabId, ordinal>` tracking every
 * open `workbench.html` tab in the current browser profile. Powers the
 * `#<n> Open Headers` multi-tab title convention (Phase 9 §5).
 *
 * Two-part contract:
 *   • {@link nextAvailableOrdinal} — pure allocator. Empty in-use set
 *     returns `1`; otherwise `max(inUse) + 1`. "Freed ordinals are
 *     reused only when the live set shrinks to zero" — a closed #1
 *     with #2/#3 still alive stays free until everyone closes, so
 *     surviving tabs keep their numbers within their lifetime.
 *   • {@link setupWorkspaceTabRegistry} — wires `chrome.tabs.on{Created,
 *     Updated, Replaced, Removed}` so the registry captures every
 *     transition. `onUpdated` covers the URL-paste case (address-bar
 *     navigation INTO `workbench.html`); `onReplaced` preserves the
 *     ordinal across Chrome's tab-discard + restore cycle
 *     (`onRemoved` does NOT fire for discard). A one-shot bootstrap
 *     queries existing workspace tabs on SW wake so the registry
 *     survives cold starts without a flash of missing ordinals.
 *
 * Every assignment change broadcasts `workspaceTabsChanged { ordinals,
 * count }` so every open workspace surface recomposes its title via
 * `useWorkspaceTabTitle`. {@link ordinalForTab} lets the matching RPC
 * answer a newly-mounted renderer's "what's my ordinal?" question
 * without snapshotting.
 */

import { broadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { recordLog } from '../observability-log';

const WORKBENCH_HTML = 'workbench.html';

const ordinalByTab: Map<number, number> = new Map();

let cachedWorkspaceUrl: string | null = null;

function getWorkspaceUrlPrefix(): string {
  if (cachedWorkspaceUrl === null) {
    cachedWorkspaceUrl = getBrowserAPI().runtime.getURL(WORKBENCH_HTML);
  }
  return cachedWorkspaceUrl;
}

function isWorkspaceUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith(getWorkspaceUrlPrefix());
}

/**
 * Pure allocator — exported for unit testing.
 *
 * - Empty in-use set → `1` (clean slate when the last workspace tab closed).
 * - Non-empty → `max(inUse) + 1`. Freed ordinals are NOT reused: the
 *   "#1 closed while #2/#3 survive" case gives the next tab #4, not
 *   #1. Keeps every surviving tab's title stable within its lifetime.
 */
export function nextAvailableOrdinal(inUse: ReadonlySet<number>): number {
  if (inUse.size === 0) return 1;
  let max = 0;
  for (const n of inUse) {
    if (n > max) max = n;
  }
  return max + 1;
}

/** Current ordinal for a tracked workspace tab, or `null` if untracked. */
export function ordinalForTab(tabId: number): number | null {
  return ordinalByTab.get(tabId) ?? null;
}

/**
 * Idempotent on-demand registration for the ordinal RPC. A renderer can
 * mount — and ask for its ordinal — before the fresh-profile SW init
 * reaches `setupWorkspaceTabRegistry` (the settings/workspace hydration
 * chain runs first and takes seconds), and the renderer caches that
 * first answer for its lifetime. Assigning here makes the answer
 * authoritative regardless of listener timing; the later listener /
 * bootstrap passes are no-ops for an already-tracked tab.
 *
 * Reconciles first: a tab tracked on demand and closed inside that same
 * pre-listener window never got its `onRemoved` — without the prune its
 * ghost inflates the count forever and keeps the allocator off `1`.
 */
export async function ensureWorkspaceTabTracked(tabId: number, url: string | undefined | null): Promise<number | null> {
  if (!isWorkspaceUrl(url)) return ordinalForTab(tabId);
  await reconcileGhostTabs();
  return assignOrdinal(tabId);
}

/** Drop tracked tabs that no longer exist. Steady state is covered by
 *  `onRemoved`; this closes the pre-listener window (and any missed
 *  close while the SW was asleep). Query failure keeps current state. */
async function reconcileGhostTabs(): Promise<void> {
  if (ordinalByTab.size === 0) return;
  try {
    const api = getBrowserAPI();
    const tabs = await queryTabs(api, { url: `${getWorkspaceUrlPrefix()}*` });
    const live = new Set<number>();
    for (const tab of tabs) {
      if (typeof tab.id === 'number') live.add(tab.id);
    }
    for (const tabId of [...ordinalByTab.keys()]) {
      if (!live.has(tabId)) releaseOrdinal(tabId);
    }
  } catch (err) {
    logger.info('WorkspaceTabRegistry', 'ghost reconcile failed:', (err as Error).message);
  }
}

/** Count of live workspace tabs. */
export function workspaceTabCount(): number {
  return ordinalByTab.size;
}

/** Plain-object snapshot of the ordinal map. */
export function snapshotWorkspaceTabs(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [tabId, ordinal] of ordinalByTab) {
    out[tabId] = ordinal;
  }
  return out;
}

/**
 * Testing hook — drop all state so a fresh test run starts from a
 * predictable baseline. Never called in production code paths.
 */
export function resetWorkspaceTabRegistry(): void {
  ordinalByTab.clear();
  wired = false;
}

function assignOrdinal(tabId: number): number {
  const existing = ordinalByTab.get(tabId);
  if (typeof existing === 'number') return existing;
  const ordinal = nextAvailableOrdinal(new Set(ordinalByTab.values()));
  ordinalByTab.set(tabId, ordinal);
  emitChange('assigned', tabId, ordinal);
  return ordinal;
}

function releaseOrdinal(tabId: number): void {
  const had = ordinalByTab.delete(tabId);
  if (had) emitChange('released', tabId, undefined);
}

function transferOrdinal(fromTabId: number, toTabId: number): void {
  const ordinal = ordinalByTab.get(fromTabId);
  if (typeof ordinal !== 'number') return;
  ordinalByTab.delete(fromTabId);
  // If the replacement id is already registered (should not happen —
  // onReplaced is a swap, not a duplicate — but stay defensive), keep
  // the existing assignment rather than clobbering it.
  if (!ordinalByTab.has(toTabId)) {
    ordinalByTab.set(toTabId, ordinal);
  }
  emitChange('replaced', toTabId, ordinalByTab.get(toTabId));
}

function emitChange(op: 'assigned' | 'released' | 'replaced', tabId: number, ordinal: number | undefined): void {
  broadcast('workspaceTabsChanged', {
    ordinals: snapshotWorkspaceTabs(),
    count: ordinalByTab.size,
  });
  recordLog({
    subsystem: 'workspace',
    op: `tab-registry/${op}`,
    level: 'info',
    message: ordinal !== undefined ? `#${ordinal} · tab ${tabId}` : `tab ${tabId} closed`,
    context: { tabId, count: ordinalByTab.size },
  });
}

let wired = false;

/**
 * Install chrome.tabs listeners so every workbench.html tab is tracked
 * from the moment it enters the namespace. Idempotent per SW lifetime
 * — re-wiring would double-count onCreated fires.
 */
export function setupWorkspaceTabRegistry(): void {
  if (wired) return;
  wired = true;

  const api = getBrowserAPI();

  api.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
    if (typeof tab.id !== 'number') return;
    // onCreated may carry the target URL in `url` OR — for tabs that
    // haven't finished loading — in the undocumented-but-real
    // `pendingUrl`. Accept either; if neither matches, onUpdated will
    // catch the transition when the URL lands.
    const pending = (tab as chrome.tabs.Tab & { pendingUrl?: string }).pendingUrl;
    if (!isWorkspaceUrl(tab.url) && !isWorkspaceUrl(pending)) return;
    assignOrdinal(tab.id);
  });

  // onUpdated with `changeInfo.url` covers two transitions that
  // onCreated cannot:
  //   (1) A tab created for a different URL navigates INTO
  //       `workbench.html` (address-bar paste, `location.href =`).
  //   (2) A tracked workspace tab navigates AWAY from workbench.html,
  //       effectively leaving the namespace — release the ordinal so
  //       `count` stays accurate.
  api.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.url === undefined) return;
    const url = changeInfo.url ?? tab.url;
    const tracking = ordinalByTab.has(tabId);
    const nowWorkspace = isWorkspaceUrl(url);
    if (!tracking && nowWorkspace) {
      assignOrdinal(tabId);
    } else if (tracking && !nowWorkspace) {
      releaseOrdinal(tabId);
    }
  });

  // Chrome tab-discard (memory pressure) swaps tab ids without firing
  // onRemoved. onReplaced carries { addedTabId, removedTabId } — we
  // transfer the ordinal so the surviving renderer keeps the same
  // title across the discard/restore.
  if (api.tabs.onReplaced) {
    api.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
      transferOrdinal(removedTabId, addedTabId);
    });
  }

  api.tabs.onRemoved.addListener((tabId: number) => {
    releaseOrdinal(tabId);
  });

  // SW-wake bootstrap: the registry is in-memory, so on a cold SW
  // start we re-populate from any pre-existing workspace tabs. Order
  // by tab id for a deterministic tie-break (same profile, same SW
  // lifetime — the ids are monotonic within a browser session).
  void bootstrapFromExistingTabs();
}

async function bootstrapFromExistingTabs(): Promise<void> {
  try {
    const api = getBrowserAPI();
    const workspaceUrl = getWorkspaceUrlPrefix();
    const tabs = await queryTabs(api, { url: `${workspaceUrl}*` });
    // Full reconcile, not add-only: prune on-demand entries whose tabs
    // closed before the listeners wired, then register the live set.
    const live = new Set<number>();
    for (const tab of tabs) {
      if (typeof tab.id === 'number') live.add(tab.id);
    }
    for (const tabId of [...ordinalByTab.keys()]) {
      if (!live.has(tabId)) releaseOrdinal(tabId);
    }
    const sorted = [...tabs].sort((a, b) => tabIdOrMax(a) - tabIdOrMax(b));
    for (const tab of sorted) {
      if (typeof tab.id === 'number') assignOrdinal(tab.id);
    }
  } catch (err) {
    logger.info('WorkspaceTabRegistry', 'bootstrap failed:', (err as Error).message);
  }
}

function tabIdOrMax(t: chrome.tabs.Tab): number {
  return typeof t.id === 'number' ? t.id : Number.MAX_SAFE_INTEGER;
}

function queryTabs(api: ReturnType<typeof getBrowserAPI>, q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    try {
      const maybe = (api.tabs.query as unknown as (q: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>)(q);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        maybe.then(resolve, reject);
        return;
      }
    } catch {
      // Fall through to callback-style.
    }
    api.tabs.query(q, (tabs: chrome.tabs.Tab[]) => {
      const lastError = api.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'tabs.query failed'));
      else resolve(tabs);
    });
  });
}
