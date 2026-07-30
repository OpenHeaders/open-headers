/**
 * Environment-plane proxy settings — the per-DEVICE half of the
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

export const ENVIRONMENT_PROXY_MODES = ['off', 'system', 'manual', 'pac', 'env'] as const;

export const EnvironmentProxyModeSchema = v.picklist(ENVIRONMENT_PROXY_MODES);

/** The desktop tier's modes — Chromium-backed resolution available. */
export const DESKTOP_ENVIRONMENT_PROXY_MODES = ['off', 'system', 'manual', 'pac'] as const;

/** The node tier's modes (daemon / CLI / TUI) — no Chromium, so no
 *  `system`/`pac`; `env` is the tier default (FORK A). */
export const NODE_ENVIRONMENT_PROXY_MODES = ['off', 'env', 'manual'] as const;

/** Manual proxy value, env-var idiom: `host:port` (implied http://),
 *  or an explicit `http://` / `https://` URL. Parsed by the manual
 *  resolver; the schema only bounds it. */
export const MAX_ENVIRONMENT_PROXY_VALUE_LENGTH = 512;

/** NO_PROXY-syntax bypass list (comma-separated suffixes, host:port,
 *  IPv4 CIDR, `*`). */
export const MAX_ENVIRONMENT_PROXY_BYPASS_LENGTH = 2048;

/** PAC source: an `http(s)://` / `file://` URL or an absolute local
 *  file path (the service normalizes a path to a file:// URL). */
export const MAX_ENVIRONMENT_PROXY_PAC_LENGTH = 1024;

export const EnvironmentProxySettingsSchema = v.object({
  version: v.literal(1),
  mode: EnvironmentProxyModeSchema,
  /** Manual mode: the proxy the machine's egress traverses. */
  manualProxyUrl: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_ENVIRONMENT_PROXY_VALUE_LENGTH))),
  /** Manual mode: vault STRING entry name holding `user:password` —
   *  never the credential value (the vault posture). */
  manualCredentialRef: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  /** Manual mode: NO_PROXY-syntax bypass list. */
  manualBypassList: v.optional(v.pipe(v.string(), v.maxLength(MAX_ENVIRONMENT_PROXY_BYPASS_LENGTH))),
  /** PAC mode: the PAC file's URL or local path. */
  pacSource: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_ENVIRONMENT_PROXY_PAC_LENGTH))),
});
