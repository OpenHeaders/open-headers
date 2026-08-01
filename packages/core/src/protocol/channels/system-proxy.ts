/**
 * System-plane proxy bridge RPCs — the desktop settings surface
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

import type { SystemProxyResolution, SystemProxySettings } from '../../types';

export interface SystemProxyRpc {
  /** Current per-device settings — absent storage reads as the tier
   *  default (System on the desktop). */
  'oh.desktop.systemProxy.get': {
    req: Record<string, never>;
    res: { settings: SystemProxySettings };
  };
  /**
   * Replace the per-device settings — validated, persisted, and applied
   * live (the active resolver re-registers; the next send resolves
   * under the new mode, no restart). The response echoes the persisted
   * settings so the surface renders without a second round trip.
   */
  'oh.desktop.systemProxy.set': {
    req: { settings: SystemProxySettings };
    res: { ok: true; settings: SystemProxySettings } | { ok: false; error: string };
  };
  /**
   * Resolve one target URL through the CURRENT system plane —
   * the sourced display's probe and the per-URL resolution preview.
   * `resolution: null` means the plane is off or has no answer for
   * this target: the send would go direct.
   */
  'oh.desktop.systemProxy.resolve': {
    req: { url: string };
    res: { ok: true; resolution: SystemProxyResolution | null } | { ok: false; error: string };
  };
  /**
   * Native open dialog for the PAC file side of the settings surface —
   * a desktop-shell concern (Electron dialog). `path: null` when the
   * user cancels.
   */
  'oh.desktop.systemProxy.pickPacFile': {
    req: Record<string, never>;
    res: { path: string | null };
  };
}
