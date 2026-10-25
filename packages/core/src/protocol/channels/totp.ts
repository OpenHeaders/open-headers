/**
 * TOTP cooldown bridge RPCs — the page realm's seam onto the browser
 * host's ONE cooldown store. A live session executes in the workbench
 * page on the browser host (the extension's page-session capability),
 * so its resolution has no store of its own: Connect and every rider
 * gate and record through the service worker, where the HTTP sends'
 * store already lives — one truth per browser profile, the same
 * window-end deadlines, the same wording. The node hosts never serve
 * these: their sessions resolve oracle-side over the store directly.
 */

import type { TotpUsage } from '../../totp/usage';

export interface TotpRpc {
  /**
   * The gate for one batch's usages — the first code already used
   * inside its window answers the refusal sentence; `null` lets the
   * batch go. `workspaceId: null` = the worker's runtime-Active one.
   */
  'oh.totp.checkCooldown': {
    req: { workspaceId: string | null; usages: TotpUsage[] };
    res: { refusal: string | null };
  };
  /** Record one batch's usages — after the wire carried them. */
  'oh.totp.recordUsage': {
    req: { workspaceId: string | null; usages: TotpUsage[] };
    res: { ok: true };
  };
}
