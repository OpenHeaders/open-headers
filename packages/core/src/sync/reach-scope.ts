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
import { LAYOUT_STATE_ENTITY_TYPE, VAULT_ENTITY_TYPE } from './mutators';

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

/**
 * Entity types that are host-local: per-surface UI state (the dock
 * layout singleton) whose LWW record only makes sense to the host that
 * wrote it. Unlike the same-device set — a secrecy boundary keyed on
 * peer reach — this is an ownership boundary: two live surfaces on
 * different hosts would fight over one singleton via LWW, each mount
 * clobbering the other's layout. Mutations of these types never cross
 * any wire, in either direction, regardless of reach or trust; every
 * host keeps its own copy and same-host surfaces still converge over
 * the local broadcast.
 */
const HOST_LOCAL_ENTITY_TYPES: ReadonlySet<string> = new Set([LAYOUT_STATE_ENTITY_TYPE]);

/** True when mutations of `entityType` are host-local (never on any wire). */
export function isHostLocalEntityType(entityType: string): boolean {
  return HOST_LOCAL_ENTITY_TYPES.has(entityType);
}

/** True when this committed mutation must not cross any wire, either direction. */
export function isHostLocalMutation(envelope: MutationEnvelope): boolean {
  return isHostLocalEntityType(envelope.body.type);
}
