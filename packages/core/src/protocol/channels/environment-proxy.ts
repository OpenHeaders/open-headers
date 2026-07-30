/**
 * Environment-plane proxy bridge RPCs — the desktop settings surface
 * over this device's egress configuration
 * (docs/REQUEST_ENGINE_PROXY_DESIGN.md). Desktop-shell answered: the
 * modes are Chromium concerns (System delegates to the OS via
 * `resolveProxy`; PAC points a dedicated resolver session's
 * `setProxy({ pacScript })`), so only the Electron main process serves
 * them. Hosts without the service never answer; the pane self-gates on
 * the desktop host.
 *
 * `resolve` is the one honesty primitive both read surfaces ride: the
 * sourced display probes a canonical URL, the resolution preview asks
 * "what would this machine do for THIS URL right now" — each a single
 * `resolveProxy`-backed call. Answers are renderer-safe projections:
 * a chain entry carries `hasCredential`, never the credential value.
 */

import type { EnvironmentProxyResolution, EnvironmentProxySettings } from '../../types';

export interface EnvironmentProxyRpc {
  /** Current per-device settings — absent storage reads as the tier
   *  default (System on the desktop). */
  'oh.desktop.environmentProxy.get': {
    req: Record<string, never>;
    res: { settings: EnvironmentProxySettings };
  };
  /**
   * Replace the per-device settings — validated, persisted, and applied
   * live (the active resolver re-registers; the next send resolves
   * under the new mode, no restart). The response echoes the persisted
   * settings so the surface renders without a second round trip.
   */
  'oh.desktop.environmentProxy.set': {
    req: { settings: EnvironmentProxySettings };
    res: { ok: true; settings: EnvironmentProxySettings } | { ok: false; error: string };
  };
  /**
   * Resolve one target URL through the CURRENT environment plane —
   * the sourced display's probe and the per-URL resolution preview.
   * `resolution: null` means the plane is off or has no answer for
   * this target: the send would go direct.
   */
  'oh.desktop.environmentProxy.resolve': {
    req: { url: string };
    res: { ok: true; resolution: EnvironmentProxyResolution | null } | { ok: false; error: string };
  };
}
