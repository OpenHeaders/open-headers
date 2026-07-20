/**
 * Identity for proxy-sourced request lifecycles.
 *
 * The request-lifecycle model is keyed `(tabId, requestId)` and
 * partitioned per tab (invariants 1–2). Proxy-captured traffic has no
 * browser tab, so it lives under one reserved synthetic tab id — its own
 * partition in the shared store, distinct from every real browser tab
 * (which are non-negative `chrome.tabs` ids). The panel later renders
 * this partition as the "Proxy" capture source; using a single reserved
 * id keeps the plane a first-class sibling of the browser tabs rather
 * than forcing a parallel store.
 *
 * The value is a fixed negative sentinel — never a real tab id, stable
 * across restarts so a reconnecting consumer re-subscribes to the same
 * partition.
 */
export const PROXY_LIFECYCLE_TAB_ID = -59210;
