/**
 * URL scheme normalizer — used at both the wire boundary (request
 * executor) and the editor (so the user sees what will actually
 * hit the network before they hit Send).
 *
 * The executor runs inside the MV3 service worker whose origin is
 * `chrome-extension://<id>/`. `fetch(url)` with a scheme-less URL
 * resolves relative to that origin and hits the extension's asset
 * filesystem, producing `net::ERR_FILE_NOT_FOUND` — an error that
 * tells the user nothing actionable. We assume a scheme at the wire
 * boundary (symmetric with `credentials: 'omit'` and `withHostAccess`
 * — same layer, same discipline).
 *
 * **Scheme inference** — rather than forcing `https://` on every
 * scheme-less URL (which is wrong for intranet + local-dev hosts
 * that serve plaintext HTTP), we mirror the Chrome address bar's
 * heuristic:
 *
 *   - Loopback (`localhost`, `*.localhost`, `127.0.0.0/8`, `::1`)
 *     → `http://`
 *   - mDNS / Bonjour (`*.local`) → `http://`
 *   - RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`,
 *     `192.168.0.0/16`) → `http://`
 *   - Link-local (`169.254.0.0/16`) → `http://`
 *   - Single-label hostnames (no dot — things like `nas`, `devbox`,
 *     `router` that can only come from a hosts file or intranet
 *     DNS; public TLDs always have at least one dot) → `http://`
 *   - Everything else (public DNS names, IPv4 not in the ranges
 *     above, IPv6 globals) → `https://`
 *
 * Exported from a shared module so the request editor can render
 * the same normalization live, making the rewrite visible to the
 * user rather than a silent mutation at send time. The editor's
 * "→ {scheme}://..." hint calls `ensureScheme` directly so the
 * preview always matches what actually fires.
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
 * Extract just the `host[:port]` portion from a scheme-less URL, e.g.
 * `localhost:3000/api?q=1` → `localhost:3000`. Returns `null` if the
 * URL starts with a slash or the input can't produce a host token
 * (empty / whitespace / template).
 *
 * Protocol-relative (`//host/path`) is handled by stripping the
 * leading `//` before parsing; a bare path (`/api/x`) isn't a host
 * and returns `null` — `ensureScheme` falls through to https in that
 * case (same as before), which is the right answer for a request
 * editor where a bare path input is already broken user input.
 */
function extractHost(url: string): string | null {
  if (url.length === 0) return null;
  let s = url;
  if (s.startsWith('//')) s = s.slice(2);
  if (s.length === 0) return null;
  if (s.startsWith('/')) return null;
  // Host ends at the first `/`, `?`, `#`, or end-of-string. Template
  // markers inside the host (`{{x}}.example.com`) count as part of
  // the host — we don't have enough info to infer local-vs-public
  // without resolving the template, so the default `https://` wins.
  const end = s.search(/[/?#]/);
  return end === -1 ? s : s.slice(0, end);
}

/**
 * Strip an optional port from a host token. IPv6 literals come
 * bracketed as `[::1]:8080` — we unwrap the brackets and drop the
 * port before hostname checks run.
 */
function hostnameOf(hostPort: string): string {
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']');
    return close === -1 ? hostPort.slice(1) : hostPort.slice(1, close);
  }
  const colon = hostPort.indexOf(':');
  return colon === -1 ? hostPort : hostPort.slice(0, colon);
}

/**
 * RFC 1918 private IPv4 range check. The scheme inference path
 * calls this on any host that looks like `a.b.c.d` — hosts that
 * don't match the IPv4 shape fall through to the generic
 * single-label / `.local` / `.localhost` rules.
 */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => {
    if (!/^\d+$/.test(p)) return Number.NaN;
    const n = Number(p);
    return n >= 0 && n <= 255 ? n : Number.NaN;
  });
  if (octets.some((n) => Number.isNaN(n))) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 127) return true; // loopback
  return false;
}

/** True for hostnames the browser/OS resolves locally rather than via public DNS. */
function isLocalHostname(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === 'localhost') return true;
  if (lower.endsWith('.localhost')) return true;
  if (lower === '::1') return true;
  if (lower.endsWith('.local')) return true; // mDNS / Bonjour / zero-config
  if (isPrivateIPv4(lower)) return true;
  // Single-label hostname: no `.` → can only come from a hosts file
  // or intranet DNS (public TLDs always have at least one dot). A
  // well-formed IPv6 global address would have `:` not `.`, so this
  // check doesn't false-positive on those.
  if (!lower.includes('.') && !lower.includes(':')) return true;
  return false;
}

/**
 * Decide whether a scheme-less URL should get `http://` (intranet /
 * local) or `https://` (public). Exposed for tests + advanced UI
 * that wants to render a "will send over plaintext" badge.
 */
export function inferSchemeForBareHost(url: string): 'http' | 'https' {
  const hostPort = extractHost(url);
  if (hostPort === null) return 'https';
  const host = hostnameOf(hostPort);
  if (host.length === 0) return 'https';
  return isLocalHostname(host) ? 'http' : 'https';
}

/**
 * Normalize a URL by prepending an appropriate scheme when none is
 * present. See file-level doc for the inference rules.
 *
 *   - `example.com`              → `https://example.com`
 *   - `localhost:3000`           → `http://localhost:3000`
 *   - `127.0.0.1:3000`           → `http://127.0.0.1:3000`
 *   - `10.0.0.1/api`             → `http://10.0.0.1/api`
 *   - `192.168.1.1/admin`        → `http://192.168.1.1/admin`
 *   - `mynas.local`              → `http://mynas.local`
 *   - `devbox:8080/health`       → `http://devbox:8080/health` (hosts-file name)
 *   - `//example.com/path`       → `https://example.com/path`
 *   - `//localhost:3000/`        → `http://localhost:3000/`
 *   - `http://example.com`       → unchanged (explicit scheme)
 *   - `{{BASE_URL}}/x`           → unchanged (template bypass)
 *
 * Pure function — safe to call on every keystroke.
 */
export function ensureScheme(url: string): string {
  if (isBareTemplate(url)) return url;
  if (hasExplicitScheme(url)) return url;
  const scheme = inferSchemeForBareHost(url);
  if (url.startsWith('//')) return `${scheme}:${url}`;
  return `${scheme}://${url}`;
}

/**
 * `true` when `ensureScheme(url)` would rewrite the URL (i.e. the
 * input was scheme-less). Used by the editor to decide whether to
 * show the "→ {scheme}://..." hint.
 */
export function needsSchemeNormalization(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (isBareTemplate(trimmed)) return false;
  if (hasExplicitScheme(trimmed)) return false;
  return true;
}
