/**
 * Environment-plane proxy TypeScript types — derived from
 * `schemas/environment-proxy.ts` (single source of truth), plus the
 * wire projections the settings surface reads. The resolver's own seam
 * types live with the node-tier implementation
 * (`@openheaders/oracle-host-node/live/environment-proxy`); these are
 * the renderer-safe twins — a resolved entry crosses the bridge with a
 * `hasCredential` flag, never the credential value.
 */

import type * as v from 'valibot';
import type { EnvironmentProxyModeSchema, EnvironmentProxySettingsSchema } from '../schemas/environment-proxy';

export type EnvironmentProxyMode = v.InferOutput<typeof EnvironmentProxyModeSchema>;

export type EnvironmentProxySettings = v.InferOutput<typeof EnvironmentProxySettingsSchema>;

/** Where a resolved answer came from — `'system'` covers everything
 *  Chromium sourced (OS settings, GPO, WPAD, system PAC); `'pac'` the
 *  explicit PAC mode; `'manual'` the manual mode; `'env'` the node
 *  tier's HTTP_PROXY-family variables. */
export type EnvironmentProxyResolvedSource = 'env' | 'system' | 'manual' | 'pac';

/** One entry of a resolved fallback chain, renderer-safe: credentials
 *  never cross the bridge — only whether one is attached. */
export type EnvironmentProxyResolvedEntry =
  | { kind: 'direct' }
  | { kind: 'proxy'; url: string; hasCredential?: boolean }
  | { kind: 'socks'; raw: string };

/** The environment plane's answer for one target URL. `null` on the
 *  RPC means the plane is off or has no answer — the send goes
 *  direct. */
export interface EnvironmentProxyResolution {
  entries: EnvironmentProxyResolvedEntry[];
  source: EnvironmentProxyResolvedSource;
}
