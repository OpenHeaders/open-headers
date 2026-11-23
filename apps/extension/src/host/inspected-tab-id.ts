/**
 * The tab a DevTools panel inspects.
 *
 * `chrome.devtools.inspectedWindow.tabId` is the host's own answer and
 * wins wherever it names a real tab. Safari answers −1 inside the panel
 * frame — only its devtools page reads the real id — so the devtools page
 * also passes the id on the panel URL, under the same parameter a panel
 * page loaded in a regular tab (e2e harnesses, debugging) uses to scope
 * its feeds.
 */

/** Query parameter carrying the inspected tab id on the panel page URL. */
export const INSPECTED_TAB_PARAM = 'ohInspectTabId';

function inspectedTabIdFromUrl(): number | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const raw = new URLSearchParams(window.location.search).get(INSPECTED_TAB_PARAM);
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

/**
 * The inspected tab's id, or `null` when nothing names one (popup, side
 * panel, tests) — the panel-only hooks that scope to this id then no-op.
 */
export function inspectedTabId(): number | null {
  const devtools = (chrome as unknown as { devtools?: { inspectedWindow?: { tabId?: number } } }).devtools;
  const id = devtools?.inspectedWindow?.tabId;
  if (typeof id === 'number' && id >= 0) return id;
  return inspectedTabIdFromUrl();
}
