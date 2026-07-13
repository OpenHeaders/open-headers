/**
 * detected-host — the running UI realm's own browser + OS, detected
 * once from `navigator` and cached for the session. Both facts are
 * immutable for a page's lifetime, so every surface shares one
 * snapshot instead of re-parsing the user agent per render.
 */

import {
  type BrowserKind,
  detectBrowser,
  detectPlatform,
  type PlatformKind,
  readHostProbe,
} from '@openheaders/core/utils';

interface DetectedHost {
  browser: BrowserKind;
  platform: PlatformKind;
}

let cached: DetectedHost | null = null;

function detectedHost(): DetectedHost {
  if (!cached) {
    const probe = readHostProbe(typeof navigator === 'undefined' ? undefined : navigator);
    cached = { browser: detectBrowser(probe), platform: detectPlatform(probe) };
  }
  return cached;
}

/** The browser this UI realm is running in. */
export function detectedBrowser(): BrowserKind {
  return detectedHost().browser;
}

/** The operating system this UI realm is running on. */
export function detectedPlatform(): PlatformKind {
  return detectedHost().platform;
}
