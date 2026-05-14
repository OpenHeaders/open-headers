/**
 * Boot-time wiring: register the browser-extension's chrome adapter as
 * the global host-assets implementation.
 *
 * Every UI entry point (popup, workbench, devtools panel, side panel)
 * imports this module once at startup so UI code that reaches for
 * `@openheaders/core/assets`'s `hostAssets` proxy resolves
 * host-packaged asset paths through `chrome.runtime.getURL` — minting a
 * `chrome-extension://` / `moz-extension://` URL scoped to the installed
 * copy.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module — the contract on the UI side is identical, and the
 * seam degrades to an identity resolver when no host wires it.
 */

import { type HostAssets, setHostAssets } from '@openheaders/core/assets';
import { getBrowserAPI } from '@/types/browser';

const chromeHostAssets: HostAssets = {
  resolveUrl(path) {
    return getBrowserAPI().runtime.getURL(path);
  },
};

setHostAssets(chromeHostAssets);
