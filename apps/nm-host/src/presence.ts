/**
 * The `presence` verb — the extension's install probe, answered for
 * real instead of riding the `bad-request` fallback. Presence itself
 * is proven by ANY framed answer (the spawned binary exists and runs);
 * what this verb adds is `anchored`: whether the `launch` verb would
 * actually open an app from here, derived from the host binary's OWN
 * location exactly as launch derives it (`resolveAnchoredCommand`). A
 * dev-layout host answers `anchored: false`, so launch affordances can
 * stay honest instead of showing a button that is guaranteed to
 * refuse. Nothing on the wire is trusted — the request carries no
 * fields at all.
 */

import { type AnchoredCommandDeps, resolveAnchoredCommand } from './launch';

export interface PresenceRequest {
  readonly kind: 'presence';
}

/** Validate the inbound NM message shape; null = not a presence request. */
export function parsePresenceRequest(raw: unknown): PresenceRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { kind?: unknown };
  if (record.kind !== 'presence') return null;
  return { kind: 'presence' };
}

export interface PresenceResponse {
  readonly ok: true;
  readonly anchored: boolean;
}

/** Answer the probe: running at all IS presence; anchored = launch would work. */
export function performPresence(deps: AnchoredCommandDeps): PresenceResponse {
  return { ok: true, anchored: resolveAnchoredCommand(deps) !== null };
}
