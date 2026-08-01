/**
 * System-plane proxy TypeScript types — derived from
 * `schemas/system-proxy.ts` (single source of truth), plus the
 * wire projections the settings surface reads. The resolver's own seam
 * types live with the node-tier implementation
 * (`@openheaders/oracle-host-node/live/system-proxy`); these are
 * the renderer-safe twins — a resolved entry crosses the bridge with a
 * `hasCredential` flag, never the credential value.
 */

import type * as v from 'valibot';
import type {
  DESKTOP_SYSTEM_PROXY_MODES,
  NODE_SYSTEM_PROXY_MODES,
  SystemProxyModeSchema,
  SystemProxySettingsSchema,
} from '../schemas/system-proxy';

export type SystemProxyMode = v.InferOutput<typeof SystemProxyModeSchema>;

/** The desktop tier's mode subset — what its settings surface offers. */
export type DesktopSystemProxyMode = (typeof DESKTOP_SYSTEM_PROXY_MODES)[number];

/** The node tier's mode subset (daemon / CLI / TUI). */
export type NodeSystemProxyMode = (typeof NODE_SYSTEM_PROXY_MODES)[number];

export type SystemProxySettings = v.InferOutput<typeof SystemProxySettingsSchema>;

/** Where a resolved answer came from — `'system'` covers everything
 *  Chromium sourced (OS settings, GPO, WPAD, system PAC); `'pac'` the
 *  explicit PAC mode; `'manual'` the manual mode; `'env'` the node
 *  tier's HTTP_PROXY-family variables. */
export type SystemProxyResolvedSource = 'env' | 'system' | 'manual' | 'pac';

/** One entry of a resolved fallback chain, renderer-safe: credentials
 *  never cross the bridge — only whether one is attached. */
export type SystemProxyResolvedEntry =
  | { kind: 'direct' }
  | { kind: 'proxy'; url: string; hasCredential?: boolean }
  | { kind: 'socks'; raw: string };

/** The system plane's answer for one target URL. `null` on the
 *  RPC means the plane is off or has no answer — the send goes
 *  direct. */
export interface SystemProxyResolution {
  entries: SystemProxyResolvedEntry[];
  source: SystemProxyResolvedSource;
}

/**
 * Read-only snapshot of the OS-level proxy CONFIGURATION — what the
 * machine's own settings say, shown in the System mode's slot of the
 * settings surface. Informational only: `resolve` stays the honesty
 * primitive, and resolution always answers per URL (a PAC script can
 * answer differently for every target). Absent fields read as "not
 * configured".
 */
export interface SystemProxyOsSnapshot {
  /** Where the values were read from — the macOS system configuration,
   *  the Windows per-user registry, or the process's HTTP_PROXY-family
   *  variables (`process-env`, distinct from the product's Environment
   *  concept). */
  source: 'macos-system' | 'windows-registry' | 'process-env';
  httpProxy?: string;
  httpsProxy?: string;
  pacUrl?: string;
  bypassList?: string;
  /** WPAD auto-discovery enabled (surfaced only where the OS records it). */
  autoDetect?: boolean;
}
