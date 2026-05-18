/**
 * Heuristic classifier — turns an opaque cookie name into a one-word
 * answer to "what is this for?".
 *
 * Four roles, in priority order:
 *
 *   - `auth`        login / session / CSRF — the cookies that explain
 *                   401s. Detected by name pattern OR structural shape
 *                   (HttpOnly + non-Session + long random value).
 *   - `tracking`    analytics, ads, fingerprinting. Detected by
 *                   well-known tracker name patterns, or by being
 *                   third-party with a non-functional shape.
 *   - `pref`        UI preferences — theme, locale, layout. Recognised
 *                   from common preference name patterns.
 *   - `functional`  everything else. The default bucket.
 *
 * The classifier is intentionally conservative — when in doubt the
 * answer is `functional`, not a confidently-wrong guess. The UI uses
 * `auth?` / `tracking?` (with the trailing `?`) as a chip so the user
 * reads it as "we suspect this is auth" rather than "this is auth".
 */

export type CookieRole = 'auth' | 'tracking' | 'pref' | 'functional';

// Cookie names commonly use `_` / `-` as separators, and `_` is a word
// character in regex — so `\b` doesn't fire between `_` and a letter
// (`\bcsrf\b` does NOT match `csrf_token`). Use a custom alphanumeric
// boundary instead.
const B = '(?<![A-Za-z0-9])';
const E = '(?![A-Za-z0-9])';

const AUTH_NAME_PATTERNS: readonly RegExp[] = [
  new RegExp('sess(?:ion)?', 'i'),
  new RegExp(`${B}auth${E}`, 'i'),
  new RegExp(`${B}sid${E}`, 'i'),
  new RegExp(`${B}jwt${E}`, 'i'),
  new RegExp(`${B}token${E}`, 'i'),
  new RegExp(`${B}csrf${E}`, 'i'),
  new RegExp(`${B}xsrf${E}`, 'i'),
  new RegExp(`${B}oauth${E}`, 'i'),
  new RegExp(`${B}sso${E}`, 'i'),
  new RegExp(`${B}bearer${E}`, 'i'),
  /__Host-/,
  /__Secure-/,
  /\.sig$/,
  /^connect\.sid$/i,
  /^ASP\.NET_SessionId$/i,
  /^PHPSESSID$/i,
  /^JSESSIONID$/i,
  /^laravel_session$/i,
  /^_session_id$/i,
  /^remember/i,
];

const TRACKING_NAME_PATTERNS: readonly RegExp[] = [
  // Google
  /^_ga\b/,
  /^_gid$/,
  /^_gac/,
  /^_gat/,
  /^__utm/,
  /^IDE$/,
  /^ANID$/,
  /^NID$/,
  /^DSID$/,
  /^FLC$/,
  /^AID$/,
  /^TAID$/,
  // Facebook / Meta
  /^_fbp$/,
  /^fr$/,
  /^datr$/,
  // Pinterest
  /^_pin_unauth/,
  /^_pinterest/,
  // Microsoft / Bing
  /^_uetsid$/,
  /^_uetvid$/,
  /^MUID$/,
  // Twitter / X
  /^personalization_id$/,
  /^guest_id/,
  // LinkedIn
  /^bcookie$/,
  /^bscookie$/,
  /^lidc$/,
  // Adobe / Hotjar / Mixpanel / Segment / Amplitude
  /^_hjSession/,
  /^_hjid$/,
  /^s_cc$/,
  /^s_sq$/,
  /^mp_/,
  /^ajs_/,
  /^amplitude_/,
  // TikTok
  /^_ttp$/,
  // Generic
  /^_cl[a-z]+$/, // Clarity
  /\b_utm\b/i,
];

const PREF_NAME_PATTERNS: readonly RegExp[] = [
  /^tz$/i,
  /^lang$/i,
  /^locale$/i,
  new RegExp(`${B}country${E}`, 'i'),
  new RegExp(`${B}theme${E}`, 'i'),
  new RegExp(`${B}color[_-]?mode${E}`, 'i'),
  new RegExp(`${B}display${E}`, 'i'),
  new RegExp(`${B}layout${E}`, 'i'),
  new RegExp(`${B}currency${E}`, 'i'),
  new RegExp(`${B}timezone${E}`, 'i'),
  new RegExp(`${B}cpu[_-]?bucket${E}`, 'i'),
  new RegExp(`${B}ui[_-]?density${E}`, 'i'),
  new RegExp(`${B}font[_-]?size${E}`, 'i'),
  /^cf_clearance$/, // Cloudflare bot-management cookie — operational, not auth
];

/**
 * Structural-only detector: a cookie that looks like a server-issued
 * session token even without a recognisable name. Used as a fallback
 * `auth?` signal when the name doesn't match a known pattern.
 */
function structurallyAuthLike(input: { name: string; value: string; httpOnly?: boolean; session?: boolean }): boolean {
  if (!input.httpOnly) return false;
  if (input.session) return false; // a session cookie *might* be auth, but we shouldn't auto-promote prefs
  if (input.value.length < 20) return false;
  // High-entropy value (mostly alphanumerics, no obvious URL-encode patterns)
  if (!/^[A-Za-z0-9._%~+/=-]+$/.test(input.value)) return false;
  return true;
}

interface ClassifyInput {
  name: string;
  value: string;
  httpOnly?: boolean;
  session?: boolean;
  thirdParty?: boolean;
}

export function classifyCookieRole(input: ClassifyInput): CookieRole {
  const name = input.name;

  for (const re of AUTH_NAME_PATTERNS) if (re.test(name)) return 'auth';
  for (const re of TRACKING_NAME_PATTERNS) if (re.test(name)) return 'tracking';
  for (const re of PREF_NAME_PATTERNS) if (re.test(name)) return 'pref';

  if (structurallyAuthLike(input)) return 'auth';

  // Third-party without a known pattern is almost always tracking — a
  // first-party site setting cookies on a different domain has very
  // few non-tracking reasons to do so. Keep this hint behind the
  // `tracking?` chip (with the trailing question mark) so the user
  // reads it as a guess.
  if (input.thirdParty) return 'tracking';

  return 'functional';
}

export function roleChipLabel(role: CookieRole): string {
  switch (role) {
    case 'auth': return 'auth?';
    case 'tracking': return 'tracking?';
    case 'pref': return 'pref';
    case 'functional': return '';
  }
}

export function roleSortOrder(role: CookieRole): number {
  switch (role) {
    case 'auth': return 0;
    case 'functional': return 1;
    case 'pref': return 2;
    case 'tracking': return 3;
  }
}

export function roleSectionLabel(role: CookieRole): string {
  switch (role) {
    case 'auth': return 'Auth & session';
    case 'functional': return 'Functional';
    case 'pref': return 'Preferences';
    case 'tracking': return 'Analytics & tracking';
  }
}
