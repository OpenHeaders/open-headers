/**
 * URL Utilities — extension-side URL helpers.
 *
 * Pattern compilation and rule-matching semantics live in
 * `@openheaders/core/utils` (rule-matcher) so the desktop app and the
 * extension share one implementation. This module owns only the bits
 * that are platform-specific or performance-sensitive:
 *
 *   - A compiled-regex cache keyed by raw pattern string, cleared by
 *     the extension's rule store on change. Hot-path avoidance of
 *     repeated `compilePatternToRegexSource` calls.
 *   - URL normalization for consistent tracking keys
 *     (`normalizeUrlForTracking`).
 *   - Trackable-scheme filtering for the request monitor
 *     (`isTrackableUrl`).
 */

import { compilePatternToRegexSource } from '@openheaders/core/utils';

// ── Pre-compiled pattern cache ─────────────────────────────────────
// Key: raw pattern string → Value: compiled RegExp (or null for '*')
const compiledPatternCache = new Map<string, RegExp | null>();

/**
 * Clear pattern caches — call when rules change
 */
export function clearPatternCache(): void {
  compiledPatternCache.clear();
}

/**
 * Pre-compile a pattern and store it in the cache.
 * Call this when rules are loaded to avoid regex compilation in hot paths.
 */
export function precompilePattern(pattern: string): void {
  if (compiledPatternCache.has(pattern)) return;
  compileAndCachePattern(pattern);
}

/**
 * Pre-compile all domain patterns from all entries at once
 */
export function precompileAllPatterns(domains: string[]): void {
  for (const domain of domains) {
    if (!compiledPatternCache.has(domain)) {
      compileAndCachePattern(domain);
    }
  }
}

/**
 * Compile a pattern via core and cache the resulting RegExp against its
 * raw input key. Core returns `null` for the match-all '*' sentinel,
 * which we preserve in the cache to allow fast-path in `doesUrlMatchPattern`.
 */
function compileAndCachePattern(pattern: string): void {
  const source = compilePatternToRegexSource(pattern);
  if (source === null) {
    compiledPatternCache.set(pattern, null);
    return;
  }
  compiledPatternCache.set(pattern, new RegExp(source, 'i'));
}

/**
 * Normalize a URL for consistent tracking
 * Removes fragments, normalizes case, handles IDN domains
 */
export function normalizeUrlForTracking(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove fragment
    urlObj.hash = '';

    // Normalize hostname to lowercase
    urlObj.hostname = urlObj.hostname.toLowerCase();

    // Remove default ports
    if (
      (urlObj.protocol === 'http:' && urlObj.port === '80') ||
      (urlObj.protocol === 'https:' && urlObj.port === '443')
    ) {
      urlObj.port = '';
    }

    // Remove trailing slash from pathname if it's just /
    if (urlObj.pathname === '/') {
      urlObj.pathname = '';
    }

    return urlObj.toString();
  } catch (_e) {
    // If URL parsing fails, return original
    return url.toLowerCase();
  }
}

// Non-trackable schemes as a Set for O(1) prefix checks
const NON_TRACKABLE_SCHEMES: readonly string[] = [
  'about:',
  'chrome:',
  'chrome-extension:',
  'edge:',
  'extension:',
  'moz-extension:',
  'opera:',
  'vivaldi:',
  'brave:',
  'data:',
  'blob:',
  'javascript:',
  'view-source:',
  'ws:',
  'wss:',
  'ftp:',
  'sftp:',
  'chrome-devtools:',
  'devtools:',
];

/**
 * Check if a URL should be tracked at all
 */
export function isTrackableUrl(url: string): boolean {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();
  for (const scheme of NON_TRACKABLE_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return false;
    }
  }

  return true;
}

/**
 * URL pattern matching using pre-compiled regex cache.
 * Replicates MV3 declarativeNetRequest urlFilter semantics.
 */
export function doesUrlMatchPattern(url: string, pattern: string): boolean {
  try {
    const normalizedUrl = normalizeUrlForTracking(url);

    let cached = compiledPatternCache.get(pattern);

    if (cached === undefined) {
      // Pattern not pre-compiled — compile now and cache
      compileAndCachePattern(pattern);
      cached = compiledPatternCache.get(pattern);
      // If compilation still didn't produce a result, bail out
      if (cached === undefined) return false;
    }

    // null sentinel means match-all ('*')
    if (cached === null) return true;

    // Fast path: if the pattern is a simple exact domain (no wildcards, no path,
    // no protocol), try direct hostname:port comparison.
    const trimmedPattern = pattern.trim().toLowerCase();
    if (!trimmedPattern.includes('*') && !trimmedPattern.includes('/') && !trimmedPattern.includes('://')) {
      try {
        const urlObj = new URL(normalizedUrl);
        const portSuffix = urlObj.port ? `:${urlObj.port}` : '';
        const hostWithPort = urlObj.hostname + portSuffix;
        // Strict match: "localhost:3000" must match "localhost:3000",
        // bare "localhost" must match "localhost" (no port in URL).
        // This prevents bare "localhost" from matching "localhost:3000".
        if (hostWithPort === trimmedPattern) {
          return true;
        }
        // Fall through to regex — don't short-circuit with hostname-only
        // comparison, because pattern "localhost" compiled to
        // *://localhost/* which does NOT match http://localhost:3000/...
      } catch (_e) {
        // fall through to regex
      }
    }

    return cached.test(normalizedUrl);
  } catch (_e) {
    return false;
  }
}
