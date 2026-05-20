/**
 * DevTools-panel bridge RPCs — SW-routed lookups the panel page can't
 * make itself because its CSP / permission surface is narrower than a
 * background context's.
 */

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
    res: {
      cookies: ReadonlyArray<{
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
      }> | null;
    };
  };
}
