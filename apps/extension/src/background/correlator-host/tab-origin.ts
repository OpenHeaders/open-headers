/**
 * Resolve a tab's current main-frame origin — the browser-target
 * reconciler's attribution input (Phase B): a service worker belongs to the
 * cdp-attached tabs whose origin matches its script URL's origin. Resolved
 * fresh every discovery epoch, never cached (navigation moves a tab between
 * owner-sets). `null` for a gone tab or a non-http(s) URL.
 */

import { getBrowserAPI } from '@/types/browser';

export async function originOfTab(tabId: number): Promise<string | null> {
  try {
    const tab = await getBrowserAPI().tabs.get(tabId);
    const url = tab.url;
    if (url === undefined || !(url.startsWith('https://') || url.startsWith('http://'))) return null;
    return new URL(url).origin;
  } catch {
    return null;
  }
}
