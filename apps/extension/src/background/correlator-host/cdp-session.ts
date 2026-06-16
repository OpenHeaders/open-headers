/**
 * Shared CDP session identity for the chrome.debugger adapter: the synthetic
 * root session id, the root control target, and the private fire-bridge event
 * shape. Lives apart from the adapter and the normalizers so both can import it
 * without a cycle — the normalizers stamp {@link ROOT_SESSION_ID}, the adapter
 * fans {@link CdpBindingFire}, and `cdpRootTarget` is consumed by the control
 * replay. Re-exported from `chrome-debugger-source` for import compatibility.
 */

import type { CdpSessionTarget } from '@openheaders/oracle/correlator-cdp';

/**
 * Synthetic session id stamped on root (page-target) events. The
 * `chrome.debugger` root session has no id of its own — events arrive
 * with `source.sessionId === undefined` — so we name it explicitly to
 * keep the `(tabId, sessionId, requestId)` identity uniform. `tabId`
 * already namespaces across tabs; a chrome-issued child session id is a
 * long opaque string and never collides with this literal.
 */
export const ROOT_SESSION_ID = 'page';

/** The root (page-target) control target for a tab — the session the
 *  tab-wide standing CDP state (cache / throttle / overrides / bootstrap)
 *  is applied to. Child-session control rides the child's own target. */
export function cdpRootTarget(tabId: number): CdpSessionTarget {
  return { tabId, sessionId: ROOT_SESSION_ID };
}

/**
 * A residual in-page wrapper's fire, delivered over the private
 * `Runtime.addBinding` channel (E4) instead of `window.postMessage` — the page
 * can neither observe nor forge it (a forged DOM message never enters this
 * channel). Routed by `tabId` only: a worker/OOPIF wrapper's fire belongs to
 * its owning tab, so child sessions are not filtered out (unlike page-timing).
 * The payload mirrors the un-armed postMessage one; `kind` is parsed but
 * dropped, since the fire plane keys on `(tabId, ruleUid, url, t)` — exactly
 * what `fire-bridge-content.ts` relays to `tabFire`.
 */
export interface CdpBindingFire {
  readonly tabId: number;
  readonly ruleUid: string;
  readonly url: string;
  readonly t: number;
}
