/**
 * Friendly self-label for this browser host (WS-C C14 commit 3).
 *
 * The offline-fallback priority list stamps a display label alongside each
 * ranked host's `Principal.id` so the management UI can name the hosts
 * without a live peer (the list is read offline). This module owns the
 * extension's platform-specific half: "browser · platform" derived from
 * the user-agent, e.g. `"Chrome · macOS"`. Display-only — never an
 * identity key.
 */

import { isChrome, isEdge, isFirefox, isSafari } from '../utils/browser-api';

export function browserName(): string {
  if (isFirefox) return 'Firefox';
  if (isEdge) return 'Edge';
  if (isSafari) return 'Safari';
  if (isChrome) return 'Chrome';
  return 'Browser';
}

export function platformName(): string | null {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (data?.platform && data.platform.trim().length > 0) return data.platform.trim();
  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

/** Build this host's friendly label, e.g. `"Chrome · macOS"`. */
export function selfHostLabel(): string {
  const platform = platformName();
  return platform ? `${browserName()} · ${platform}` : browserName();
}
