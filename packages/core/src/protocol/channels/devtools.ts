/**
 * DevTools-panel bridge RPCs — SW-routed lookups the panel page can't
 * make itself because its CSP / permission surface is narrower than a
 * background context's.
 */

/**
 * Host-neutral cookie shape carried over the bridge — a superset of the
 * fields the four supported MV3 cookie APIs report. Mirrors the panel's
 * `JarCookie` so non-Chromium hosts can implement the same contract
 * without a type-only dependency on the chrome namespace.
 */
export interface JarCookieWire {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  session: boolean;
  partitionKey?: string;
  storeId?: string;
}

/**
 * Editable cookie fields the panel sends when adding or updating a
 * cookie. `session` is derived (no `expirationDate` ⇒ session) and
 * `hostOnly` is honoured by the writer (omit the Domain attribute), so
 * neither is a separate input.
 */
export interface JarCookieEditWire {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  partitionKey?: string;
  storeId?: string;
}

/** Identity fields the writer needs to delete a single jar cookie. */
export interface JarCookieKeyWire {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  partitionKey?: string;
  storeId?: string;
}

export interface DevToolsRpc {
  // ── DevTools panel: source-map resolution ──────────────────────
  /**
   * Fetch the source map associated with a JS URL — the DevTools panel
   * uses this for its Initiator-tab call-stack to substitute the
   * minified V8 function names with their original (pre-minify) names.
   *
   * Routed through the SW because the DevTools panel page runs under
   * `default-src 'self'` CSP, so direct cross-origin fetches from the
   * renderer are blocked. The SW carries the extension's full host
   * permissions and is unaffected.
   *
   * The SW takes the JS URL, fetches the file, discovers the
   * `sourceMappingURL` (HTTP header first, trailing `//# sourceMappingURL=`
   * comment fallback), resolves the map URL (including `data:` inline
   * maps), fetches the map, and returns the raw map text. The renderer
   * parses it via the pure helpers in `panel/data/source-map.ts`.
   *
   * `mapText` is `null` whenever any step fails — no map, 404, malformed
   * — so the renderer falls back to the raw V8 frame name.
   */
  fetchSourceMapText: {
    req: { jsUrl: string };
    res: { mapText: string | null };
  };

  // ── DevTools panel: cookie-jar lookup ──────────────────────────
  /**
   * Fetch the cookies the browser jar holds for a given URL — the
   * DevTools panel's Cookies tab uses this to join the sparse HAR
   * request-cookie data (name + value only) with the full attribute
   * set (Domain, Path, Expires, HttpOnly, Secure, SameSite, Partition).
   *
   * Routed through the SW because `chrome.cookies` is not exposed to
   * the panel page — only background contexts hold the `cookies`
   * permission's API surface. Caller passes the request URL; SW calls
   * `chrome.cookies.getAll({ url })` and returns a host-neutral
   * shape (`JarCookie[]`) so non-Chromium hosts can implement the
   * same contract.
   *
   * `cookies` is `null` when the lookup fails (permission denied,
   * extension context torn down) so the renderer can fall back to
   * the HAR-only view silently.
   */
  fetchCookieJarForUrl: {
    req: { url: string };
    res: { cookies: ReadonlyArray<JarCookieWire> | null };
  };

  // ── DevTools panel: cookie-jar writes ──────────────────────────
  /**
   * Add or update a cookie in the browser jar — the panel's Cookies tab
   * uses this to edit cookies the page's own JS can't touch (HttpOnly is
   * the developer value here: `document.cookie` can't set it, the
   * extension's `cookies` permission can).
   *
   * Routed through the SW for the same reason as the read path —
   * `chrome.cookies` is a background-only API. The SW reconstructs the
   * request URL from the cookie's own domain/path/secure (a host-only
   * domain drops the leading dot), calls `chrome.cookies.set`, and
   * returns the resulting jar cookie (`null` on failure — bad domain,
   * permission denied).
   */
  setCookieForUrl: {
    req: { cookie: JarCookieEditWire };
    res: { cookie: JarCookieWire | null };
  };

  /**
   * Delete a cookie from the browser jar by identity. The SW
   * reconstructs the URL the same way and calls `chrome.cookies.remove`;
   * `ok` is `false` when no matching cookie was removed.
   */
  removeCookieForUrl: {
    req: JarCookieKeyWire;
    res: { ok: boolean };
  };
}
