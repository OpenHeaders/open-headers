/**
 * Boot-time wiring: register the web tab's host-assets resolver.
 *
 * Host-packaged asset paths (`images/logo-pixel.svg`) are anchored to
 * the serving origin's root rather than left relative — the Workbench
 * is a SPA, so a relative path would resolve against whatever
 * client-side route the tab is on (`/workbench/rules/images/…`) and
 * 404. The assets themselves ship in `public/` and land at the bundle
 * root.
 */

import { type HostAssets, setHostAssets } from '@openheaders/core/assets';

const webHostAssets: HostAssets = {
  resolveUrl(path) {
    return path.startsWith('/') ? path : `/${path}`;
  },
};

setHostAssets(webHostAssets);
