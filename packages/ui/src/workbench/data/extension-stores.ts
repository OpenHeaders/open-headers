/**
 * Extension store listings per installable browser — the Traffic
 * Monitor rail's install CTAs. Opened OUTSIDE the app by design (the
 * download-CTA carve-out): an extension install can only happen in the
 * browser's own store, so the CTA hands the listing to the browser
 * that will perform it via the `openUrlInBrowser` capability.
 */

import type { InstallTargetBrowser } from '@openheaders/core/capabilities';

export const INSTALLABLE_BROWSERS: readonly InstallTargetBrowser[] = ['chrome', 'edge', 'firefox'];

export const EXTENSION_STORE_URLS: Record<InstallTargetBrowser, string> = {
  chrome: 'https://chromewebstore.google.com/detail/ablaikadpbfblkmhpmbbnbbfjoibeejb',
  edge: 'https://microsoftedge.microsoft.com/addons/detail/open-headers/gnbibobkkddlflknjkgcmokdlpddegpo',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/open-headers/',
};

/** Display names — brand nouns, deliberately untranslated. */
export const INSTALL_BROWSER_LABELS: Record<InstallTargetBrowser, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
};
