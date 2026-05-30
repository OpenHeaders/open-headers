/**
 * Reach-scope classification (WS-B B1).
 *
 * Some entities carry a *root* secret whose plaintext must never leave
 * the device it was entered on. The vault is the canonical case: its
 * `addToSet` envelope carries the full `VaultSecret` record (TOTP seed
 * included) as the item payload, so a vault mutation crossing to an
 * off-device peer is a seed leak.
 *
 * This module is the single source of truth for "which entity types are
 * same-device-only," consumed by every backend egress path that fans a
 * committed mutation toward peers (the live broadcast forwarder + the
 * state-vector catch-up responder). The *enforcement* — which sockets
 * count as same-device — lives at the transport (it owns per-peer
 * reach); this module only answers the domain question.
 *
 * Distinct from "sensitive" (vault + OAuth bundles + live values): OAuth
 * bundles and live values are *derived* artifacts whose boundary is the
 * user's trust zone (their paired devices, which may span LAN), enforced
 * by pairing — not by reach. Only the vault is same-*device*-only, which
 * maps to loopback. The broader trust-zone strip for the sensitive set
 * is `redactSensitiveSnapshotKeys` (a separate, multi-user / cross-zone
 * concern).
 */

import type { MutationEnvelope } from './envelope';
import { VAULT_ENTITY_TYPE } from './mutators';

/**
 * Entity types whose mutations carry a same-device-only secret. A
 * mutation of one of these must never be delivered to a non-loopback
 * (off-device) peer, on any egress path.
 */
const SAME_DEVICE_ONLY_ENTITY_TYPES: ReadonlySet<string> = new Set([VAULT_ENTITY_TYPE]);

/** True when mutations of `entityType` are same-device-only (loopback-scoped). */
export function isSameDeviceOnlyEntityType(entityType: string): boolean {
  return SAME_DEVICE_ONLY_ENTITY_TYPES.has(entityType);
}

/** True when this committed mutation must not cross to an off-device peer. */
export function isSameDeviceOnlyMutation(envelope: MutationEnvelope): boolean {
  return isSameDeviceOnlyEntityType(envelope.body.type);
}
