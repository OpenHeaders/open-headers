/**
 * URL scheme normalizer — used at both the wire boundary (request
 * executor) and the editor (so the user sees what will actually
 * hit the network before they hit Send).
 *
 * The executor runs inside the MV3 service worker whose origin is
 * `chrome-extension://<id>/`. `fetch(url)` with a scheme-less URL
 * resolves relative to that origin and hits the extension's asset
 * filesystem, producing `net::ERR_FILE_NOT_FOUND` — an error that
 * tells the user nothing actionable. Postman/Insomnia both handle
 * this by assuming `https://` when no scheme is present; we do the
 * same, at the wire boundary (symmetric with `credentials: 'omit'`
 * and `withHostAccess` — same layer, same discipline).
 *
 * Exported from a shared module so the request editor can render
 * the same normalization live, making the rewrite visible to the
 * user rather than a silent mutation at send time.
 */

/** True when the URL is a bare template like `{{BASE_URL}}/x` — the
 *  template may expand to include its own scheme, so we leave it. */
function isBareTemplate(url: string): boolean {
  return url.startsWith('{{');
}

/** True when the URL has an explicit `scheme://...` prefix. Schemes
 *  that don't use `//` (`mailto:`, `data:`) are uncommon in a request
 *  editor and a user who wants them can type the full URL. */
function hasExplicitScheme(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url);
}

/**
 * Normalize a URL by prepending `https://` when no scheme is present.
 *
 *   - `example.com`           → `https://example.com`
 *   - `localhost:3000`        → `https://localhost:3000`
 *   - `//example.com/path`    → `https://example.com/path` (protocol-relative)
 *   - `http://example.com`    → unchanged (explicit scheme)
 *   - `ws://example.com/ws`   → unchanged (explicit scheme)
 *   - `{{BASE_URL}}/x`        → unchanged (template bypass)
 *
 * Pure function — safe to call on every keystroke.
 */
export function ensureScheme(url: string): string {
  if (isBareTemplate(url)) return url;
  if (hasExplicitScheme(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://${url}`;
}

/**
 * `true` when `ensureScheme(url)` would rewrite the URL (i.e. the
 * input was scheme-less). Used by the editor to decide whether to
 * show the "→ https://..." hint.
 */
export function needsSchemeNormalization(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (isBareTemplate(trimmed)) return false;
  if (hasExplicitScheme(trimmed)) return false;
  return true;
}
