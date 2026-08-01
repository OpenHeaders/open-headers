/**
 * System-plane proxy settings — the per-DEVICE half of the
 * two-plane proxy architecture (docs/REQUEST_ENGINE_PROXY_DESIGN.md).
 * Host-local by design (the vault posture): "on this machine, egress
 * works like this" is machine state, never workspace data, and never
 * syncs. Not a sensitive slot — the manual credential is a vault entry
 * NAME; the credential value itself stays in the vault.
 *
 * Mode vocabulary: `system` (the desktop default — resolution
 * delegated to Chromium, "works exactly like Chrome on this machine"),
 * `manual` (one proxy URL + vault-ref credentials + NO_PROXY-syntax
 * bypass list), `pac` (explicit PAC URL or local file, resolved by
 * Chromium's sandboxed network service — PAC JS never executes in our
 * process), `env` (the node tier's default — the HTTP_PROXY-family
 * variables with curl precedence), `off` (always direct). One shared
 * picklist, tier-scoped subsets: `system`/`pac` need Chromium and
 * exist only on the desktop; `env` reads a process environment no
 * desktop mode wants. Each tier's installer refuses the other tier's
 * modes honestly.
 */

import * as v from 'valibot';

export const SYSTEM_PROXY_MODES = ['off', 'system', 'manual', 'pac', 'env'] as const;

export const SystemProxyModeSchema = v.picklist(SYSTEM_PROXY_MODES);

/** The desktop tier's modes — Chromium-backed resolution available. */
export const DESKTOP_SYSTEM_PROXY_MODES = ['off', 'system', 'manual', 'pac'] as const;

/** The node tier's modes (daemon / CLI / TUI) — no Chromium, so no
 *  `system`/`pac`; `env` is the tier default (FORK A). */
export const NODE_SYSTEM_PROXY_MODES = ['off', 'env', 'manual'] as const;

/** Manual proxy value, env-var idiom: `host:port` (implied http://),
 *  or an explicit `http://` / `https://` URL. Parsed by the manual
 *  resolver; the schema only bounds it. */
export const MAX_SYSTEM_PROXY_VALUE_LENGTH = 512;

/** NO_PROXY-syntax bypass list (comma-separated suffixes, host:port,
 *  IPv4 CIDR, `*`). */
export const MAX_SYSTEM_PROXY_BYPASS_LENGTH = 2048;

/** PAC source: an `http(s)://` / `file://` URL or an absolute local
 *  file path (the service normalizes a path to a file:// URL). */
export const MAX_SYSTEM_PROXY_PAC_LENGTH = 1024;

/** A plausible proxy host: a domain name / IPv4 (letters, digits,
 *  dots, hyphens, underscores) or a bracketed IPv6 literal. The WHATWG
 *  URL parser is far looser (`;`, `'`, `=` all parse as hostname
 *  characters), so the form checks the shape itself. */
const PROXY_HOSTNAME = /^([A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])$/;

/** Whether a manual proxy value will actually dial — the settings
 *  form's in-place check, mirroring the manual resolver's accept set:
 *  bare `host:port` (implied http://) or an explicit `http://` /
 *  `https://` / SOCKS5-family (`socks://`, `socks5://`, `socks5h://`)
 *  URL, with a plausible hostname. The SOCKS4 family the engine does
 *  not speak is flagged here instead of erroring at send time. */
export function isValidSystemProxyValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return false;
  }
  const raw = url.protocol.replace(/:$/, '').toLowerCase();
  const scheme = raw === 'socks' || raw === 'socks5h' ? 'socks5' : raw;
  if (scheme !== 'http' && scheme !== 'https' && scheme !== 'socks5') return false;
  return PROXY_HOSTNAME.test(url.hostname);
}

/** One NO_PROXY entry: `*`, a host / suffix (leading dot allowed) with
 *  optional `:port` and IPv4-CIDR `/bits`, or a bracketed IPv6 literal
 *  with optional `:port`. */
const BYPASS_ENTRY = /^(\*|\[[0-9A-Fa-f:.]+\](:\d{1,5})?|\.?[A-Za-z0-9*][A-Za-z0-9._*-]*(:\d{1,5})?(\/\d{1,3})?)$/;

/** NO_PROXY-syntax bypass check for the settings form: every
 *  comma-separated entry must fit the grammar (suffixes, host:port,
 *  CIDR, `*`); empty segments — a trailing comma — are fine. */
export function isValidSystemProxyBypassList(value: string): boolean {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .every((entry) => entry === '' || BYPASS_ENTRY.test(entry));
}

/** URL-kind PAC source check for the settings form: a fetchable
 *  `http(s)://` URL (local paths ride the File kind). */
export function isValidPacUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/** File-kind PAC source check for the settings form: an absolute
 *  path — POSIX, Windows drive, or UNC. */
export function isValidPacFilePath(value: string): boolean {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(value.trim());
}

export const SystemProxySettingsSchema = v.object({
  version: v.literal(1),
  mode: SystemProxyModeSchema,
  /** Manual mode: the proxy the machine's egress traverses. */
  manualProxyUrl: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_SYSTEM_PROXY_VALUE_LENGTH))),
  /** Manual mode: vault STRING entry name holding `user:password` —
   *  never the credential value (the vault posture). */
  manualCredentialRef: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  /** Manual mode: NO_PROXY-syntax bypass list. */
  manualBypassList: v.optional(v.pipe(v.string(), v.maxLength(MAX_SYSTEM_PROXY_BYPASS_LENGTH))),
  /** PAC mode: the PAC file's URL or local path. */
  pacSource: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_SYSTEM_PROXY_PAC_LENGTH))),
});
