/**
 * Backend-target classification — derived purely from the connection
 * registry + Org bindings, with no connection-module side effects (kept
 * separate from `websocket.ts` so the outbound gate wiring can consult
 * it without dragging the WS layer's import-time wiring into its unit
 * surface).
 */

import { getBackend, isLoopbackBackendUrl } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';

/**
 * Is the backend an Org's envelopes route to off-device (non-loopback)?
 * Drives the outbound reach floor: a same-device-only mutation (vault
 * root secret) may cross a loopback socket to the desktop on this
 * machine but never to a LAN/WAN peer. Per-Org because the connection
 * plane routes each envelope by its Org binding — one backend being
 * off-device says nothing about another.
 *
 * An unbound Org (the home Org, or a binding that raced a registry
 * removal) routes nowhere; treated as same-device (the SW is the
 * backend), and no wire exists for the envelope to cross anyway.
 */
export function isOrgBackendOffDevice(orgId: string): boolean {
  const backendId = getOrgBackendBindings().get(orgId);
  if (!backendId) return false;
  const record = getBackend(backendId);
  return record ? !isLoopbackBackendUrl(record.url) : false;
}
