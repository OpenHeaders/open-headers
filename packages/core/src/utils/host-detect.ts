/**
 * host-detect — classify the running host's browser and operating
 * system from a plain probe struct (user-agent string + optional
 * client-hint fields). Pure over its input: callers snapshot their
 * realm's `navigator` via {@link readHostProbe}, so detection stays
 * platform-free and testable.
 *
 * Browser detection prefers client-hint brands (every Chromium
 * derivative ships an honest brand entry there) and falls back to
 * user-agent tokens. Brave is the exception on both channels — it
 * masquerades as Chrome — so its presence is probed via the
 * `navigator.brave` global instead.
 *
 * OS detection reads the platform string first, then user-agent
 * tokens. Linux distros are only distinguishable when the UA carries
 * a distro token (some builds embed "Ubuntu"/"Debian"/"Fedora");
 * otherwise they classify as plain `linux`.
 */

export type BrowserKind =
  | 'chrome'
  | 'chromium'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'opera'
  | 'brave'
  | 'vivaldi'
  | 'unknown';

export const PLATFORM_KINDS = ['macos', 'windows', 'ubuntu', 'debian', 'fedora', 'linux', 'unknown'] as const;

export type PlatformKind = (typeof PLATFORM_KINDS)[number];

/** Everything detection needs, snapshotted from a `navigator`. */
export interface HostProbe {
  userAgent: string;
  /** `navigator.userAgentData.brands[].brand` when the host exposes client hints. */
  brands?: string[];
  /** `navigator.userAgentData.platform`, falling back to `navigator.platform`. */
  platform?: string;
  /** Whether the `navigator.brave` global exists. */
  hasBrave?: boolean;
}

interface NavigatorLike {
  userAgent?: unknown;
  platform?: unknown;
  brave?: unknown;
  userAgentData?: {
    brands?: Array<{ brand?: unknown }>;
    platform?: unknown;
  };
}

/**
 * Snapshot a realm's `navigator` into a {@link HostProbe}. Accepts
 * `unknown` so callers in any realm (window, worker, service worker)
 * can pass their global without type friction; a missing/foreign value
 * yields an empty probe that detects as `unknown`.
 */
export function readHostProbe(nav: unknown): HostProbe {
  if (typeof nav !== 'object' || nav === null) return { userAgent: '' };
  const n = nav as NavigatorLike;
  const brands = Array.isArray(n.userAgentData?.brands)
    ? n.userAgentData.brands.map((b) => (typeof b.brand === 'string' ? b.brand : '')).filter((b) => b.length > 0)
    : undefined;
  const hintPlatform = typeof n.userAgentData?.platform === 'string' ? n.userAgentData.platform : undefined;
  const platform = hintPlatform ?? (typeof n.platform === 'string' ? n.platform : undefined);
  return {
    userAgent: typeof n.userAgent === 'string' ? n.userAgent : '',
    ...(brands && brands.length > 0 ? { brands } : {}),
    ...(platform ? { platform } : {}),
    ...(n.brave !== undefined ? { hasBrave: true } : {}),
  };
}

export function detectBrowser(probe: HostProbe): BrowserKind {
  const ua = probe.userAgent;
  const brands = probe.brands ?? [];
  const hasBrand = (needle: string): boolean => brands.some((b) => b.toLowerCase().includes(needle));

  if (/firefox\//i.test(ua)) return 'firefox';
  if (probe.hasBrave || hasBrand('brave')) return 'brave';
  if (hasBrand('microsoft edge') || /\bEdg[eA]?\//.test(ua)) return 'edge';
  if (hasBrand('opera') || /\bOPR\//.test(ua)) return 'opera';
  if (hasBrand('vivaldi') || /vivaldi/i.test(ua)) return 'vivaldi';
  if (hasBrand('google chrome')) return 'chrome';
  // A brands list without the Chrome brand = a Chromium derivative we
  // don't recognize; the UA "Chrome/" token below would misread it.
  if (brands.length > 0 && hasBrand('chromium')) return 'chromium';
  if (/\bChrome\//.test(ua)) return 'chrome';
  if (/\bChromium\//.test(ua)) return 'chromium';
  if (/\bVersion\/[\d.]+/.test(ua) && /\bSafari\//.test(ua)) return 'safari';
  return 'unknown';
}

export function detectPlatform(probe: HostProbe): PlatformKind {
  const source = `${probe.platform ?? ''} ${probe.userAgent}`;
  if (/windows|\bWin(32|64)\b/i.test(source)) return 'windows';
  if (/mac|iphone|ipad|ipod/i.test(source)) return 'macos';
  if (/ubuntu/i.test(source)) return 'ubuntu';
  if (/debian/i.test(source)) return 'debian';
  if (/fedora/i.test(source)) return 'fedora';
  if (/linux|x11|android/i.test(source)) return 'linux';
  return 'unknown';
}

export const BROWSER_DISPLAY_NAME: Record<BrowserKind, string> = {
  chrome: 'Chrome',
  chromium: 'Chromium',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  opera: 'Opera',
  brave: 'Brave',
  vivaldi: 'Vivaldi',
  unknown: 'Browser',
};

export const PLATFORM_DISPLAY_NAME: Record<PlatformKind, string> = {
  macos: 'macOS',
  windows: 'Windows',
  ubuntu: 'Ubuntu',
  debian: 'Debian',
  fedora: 'Fedora',
  linux: 'Linux',
  unknown: 'Device',
};
