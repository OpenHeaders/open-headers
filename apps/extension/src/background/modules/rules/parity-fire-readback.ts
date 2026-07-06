/**
 * Fire-count readback for the playground e2e runner.
 *
 * Exposes `globalThis.__OH_PARITY_GET_FIRES__` in the service-worker
 * scope so the rule-page runner (playground/scripts/e2e-rules.mjs) can
 * read the popup-claimed truth for a tab after a page's tests ran: the
 * tab-telemetry snapshot — per-rule fire counters plus the chronological
 * fire records with their evidence tiers — which is exactly what the
 * popup's This Page tab derives its counts from. Same dev-seam posture
 * as `parity-rule-import.ts`: inert unless the probe has set
 * `chrome.storage.local.__oh_parity_hook__`, and the SW global scope is
 * unreachable from web content.
 *
 * Telemetry only accumulates for tracked tabs; the runner's page is the
 * active tab of its window, which the background tracks by itself
 * (`tab-listeners.ts`'s active-tab reason), so no extra arming step is
 * needed. Counts reset on navigation commit — the snapshot covers the
 * current document, matching the runner's reload-then-run flow.
 */

import type { RequestRecord } from '@openheaders/core/types';
import { logger } from '@utils/logger';

import { getTabSnapshot } from '../tab-telemetry';
import { isParityHookEnabled } from './parity-hook';

const SCOPE = 'ParityFireReadback';

export type ParityFiresResult =
  | { ok: true; tabId: number; counters: Record<string, number>; fires: RequestRecord[] }
  | { ok: false; error: string };

declare global {
  var __OH_PARITY_GET_FIRES__: ((url: unknown) => Promise<ParityFiresResult>) | undefined;
}

async function getParityFires(url: unknown): Promise<ParityFiresResult> {
  if (!(await isParityHookEnabled())) {
    return { ok: false, error: 'parity hook flag not set — refusing readback' };
  }
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, error: 'url must be a non-empty string (exact tab URL)' };
  }
  // Exact string match over all tabs — chrome.tabs.query's `url` filter is
  // match-pattern based (no ports, wildcard semantics), which the runner's
  // literal page URL is not.
  const tabs = await chrome.tabs.query({});
  const tabId = tabs.find((t) => t.url === url)?.id;
  if (tabId === undefined) {
    return { ok: false, error: `no tab matches ${url}` };
  }
  const snapshot = getTabSnapshot(tabId);
  logger.debug(SCOPE, `tab ${tabId}: ${snapshot.fires.length} fire(s) across ${Object.keys(snapshot.counters).length} rule(s)`);
  return { ok: true, tabId, counters: snapshot.counters, fires: snapshot.fires };
}

/** Install the SW-global fire-readback hook. Call once during background boot. */
export function installParityFireReadback(): void {
  globalThis.__OH_PARITY_GET_FIRES__ = getParityFires;
}
