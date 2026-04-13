/**
 * Parser + validator for user-typed test-target URLs.
 *
 * Single source of truth shared by the popup launcher (TestSessionModal)
 * and the background test-runner (`startSession`). Both call this so
 * URL handling is identical regardless of where the request enters the
 * system — popup, programmatic `runtime.sendMessage`, future CLI, E2E
 * test, anything. Without a centralized parser, each caller would
 * re-implement the auto-prepend / parse / protocol-check trio and
 * drift apart over time.
 *
 * Behavior:
 *
 *   - Whitespace is trimmed at the input boundary (leading/trailing only).
 *   - If the input has no hierarchical scheme (`scheme://`), `http://`
 *     is auto-prepended. Matches browser address-bar UX and removes the
 *     friction of "type the scheme yourself" for the local-development
 *     case (`127.0.0.1:3000/echo`, `localhost:8080`, `myapp.local`,
 *     custom hosts-file aliases). Default is `http://` because the
 *     no-scheme case is overwhelmingly local development; users hitting
 *     an https endpoint type `https://` themselves.
 *   - The candidate is parsed via the WHATWG `URL` constructor.
 *     Unparseable strings fail.
 *   - Only `http:` and `https:` survive — extension DNR doesn't operate
 *     on `ftp:`, `file:`, `chrome:`, `data:`, etc.
 *
 * The success result carries the **canonicalized** URL: we return
 * `parsed.toString()`, NOT the raw input, so downstream consumers
 * (`tabs.update`, session records, workspace report headers) only ever
 * see RFC-3986-compliant URLs. The most visible effect of this is
 * spaces in the path: WHATWG accepts a literal space in input and
 * normalizes it to `%20` at canonicalization, so paste-from-clipboard
 * with `https://api.openheaders.io/some path` produces
 * `https://api.openheaders.io/some%20path` here. Spaces in the host
 * are still rejected by the URL constructor because host normalization
 * requires unambiguous component delimiters.
 *
 * **One deliberate divergence from WHATWG canonicalization:** WHATWG
 * forces an empty path to `/` (so `http://api.openheaders.io` becomes
 * `http://api.openheaders.io/`). At the HTTP wire layer the two are
 * equivalent — every client sends `GET / HTTP/1.1` for both — but at
 * the URL-string layer they're distinct, and some intermediaries
 * (proxies, end-anchored rule patterns, string-comparing ACLs / logs)
 * can see the difference. We strip that auto-added trailing slash
 * back off when the user's input had no path, no query, and no
 * fragment, so the URL we hand downstream matches what the user
 * actually typed. We do NOT touch trailing slashes the user typed
 * themselves, and we do NOT touch slashes WHATWG inserts before a
 * query string or fragment (those are required by the URL grammar).
 *
 * On the spec landscape: RFC 3986 strictly forbids literal spaces
 * anywhere in a URI; WHATWG URL is more lenient on input and
 * canonicalizes during parsing. Browsers, `curl`, `fetch`, etc. all
 * follow WHATWG on user input. Our test launcher is a paste-friendly
 * input field, so we follow WHATWG too — and then emit the canonical
 * (RFC-compliant, percent-encoded) form so the rest of the system can
 * trust what it receives.
 */

export type TestTargetUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Matches an RFC-3986 hierarchical-scheme prefix: `[a-z][a-z0-9+\-.]*://`.
 * We use this to decide whether the input ALREADY has a scheme — if it
 * does, we leave it alone (and the protocol check below rejects
 * anything that isn't http(s)). If it doesn't, we auto-prepend `http://`.
 *
 * Critically, this needs the `://` (not just `:`), because otherwise
 * `localhost:8080` would be misread as scheme `localhost:` with opaque
 * path `8080` and fail the http(s) gate. The `://` requirement disqualifies
 * non-hierarchical inputs like `localhost:8080` and `127.0.0.1:3000` so
 * they're treated as bare hosts and get the http:// auto-prepend.
 *
 * Side effect: opaque schemes like `data:`, `mailto:`, `javascript:`
 * also lack `://`, so they get http:// prepended and then fail the
 * URL constructor (port `text/html...` is invalid, etc.) with our
 * generic "doesn't look valid" error. That's acceptable — those inputs
 * are nonsense for a test session and the user shouldn't be typing them.
 */
const HAS_HIERARCHICAL_SCHEME = /^[a-z][a-z0-9+\-.]*:\/\//i;

export function parseTestTargetUrl(input: string): TestTargetUrlResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a URL' };
  }

  const candidate = HAS_HIERARCHICAL_SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That URL doesn't look valid" };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// URLs can be tested' };
  }

  // Return the WHATWG-canonical form (parsed.toString()), not the raw
  // candidate. This is where literal spaces in the path become %20,
  // mixed-case hostnames become lowercase, default ports get stripped,
  // etc. — every downstream consumer can rely on receiving an
  // RFC-3986-compliant URL.
  const canonical = parsed.toString();

  // Undo WHATWG's empty-path-to-slash normalization when (and only
  // when) the user's input had no path / query / fragment of its own.
  // See the file header for the rationale: at the wire level both
  // forms are equivalent, but URL-string-comparing intermediaries can
  // see them as different, so preserving the user's slash intent is
  // safer for downstream code that we don't control. We're careful to
  // only strip the slash WHATWG added — never one the user typed
  // (`candidate.endsWith('/')` guards that), and never a slash that's
  // structurally required because there's a query or fragment after
  // the host (`parsed.search === '' && parsed.hash === ''` guards
  // that). Result: the only case that changes is `http://host/` →
  // `http://host` for inputs that had no path component at all.
  if (
    parsed.pathname === '/' &&
    parsed.search === '' &&
    parsed.hash === '' &&
    !candidate.endsWith('/')
  ) {
    return { ok: true, url: canonical.replace(/\/$/, '') };
  }

  return { ok: true, url: canonical };
}
