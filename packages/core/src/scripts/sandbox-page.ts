/**
 * The served web app's script sandbox page — the ONE place its path
 * and its delivery policy are named, so the web build (which emits
 * the page and serves it in dev), the daemon's static handler (which
 * serves the built one) and the web host (which mounts it as the
 * sandbox iframe) agree.
 *
 * The page is self-contained (the realm's script inline) because a
 * module script inside an opaque-origin iframe is fetched with CORS
 * and fails against a server that sends no CORS header; and its
 * sandbox comes from a RESPONSE HEADER because the `sandbox` CSP
 * directive cannot be set from a meta tag — a page that runs
 * `new Function` on whatever it is posted must never run under the
 * app's origin, whoever embeds it. The policy: a unique opaque origin
 * with scripts allowed and nothing else (no same-origin, no forms, no
 * popups, no top navigation), nothing loaded from anywhere
 * (`default-src 'none'`), the inline realm script and `'unsafe-eval'`
 * for the user scripts it compiles.
 */

export const WEB_SANDBOX_PAGE = 'sandbox.html';

export const WEB_SANDBOX_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; base-uri 'none'; form-action 'none'";
