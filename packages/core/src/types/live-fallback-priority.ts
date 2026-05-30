/**
 * Offline-fallback priority list (WS-C C14 data plane).
 *
 * The synced, user-orderable ranking of the host identities eligible to
 * become the single offline fallback runner for an exclusive Live
 * Workflow when a configured backend goes offline. A workspace-scoped
 * singleton; each member is one ranked host.
 *
 * Set-modeled with **order-as-data**: every member carries its own
 * `order` so concurrent appends by two same-device browsers each commit
 * an independent LWW member (no lost-append hazard a whole-array scalar
 * would have). The election consumes the *derived* `Principal.id[]` —
 * members sorted by `(order, principalId)`, the `principalId` secondary
 * making concurrent same-`order` appends converge identically on every
 * host (see `offline-fallback-election.ts`).
 *
 * Not sensitive — a member carries only a `Principal.id` (an opaque
 * synthetic-identity hash, no secret), so the list rides the normal
 * trust-zone-wide forwarder, unlike the loopback-gated vault (WS-B B1).
 */

/** One ranked host in the offline-fallback priority list. */
export interface LiveFallbackPriorityMember {
  /** Stable synthetic identity of the host (derived from `hostInstallId`). */
  principalId: string;
  /** Rank ordinal — lower runs first. Appends take `max(existing) + 1`. */
  order: number;
}

/** In-memory + at-rest shape of the singleton: members keyed by `principalId`. */
export interface LiveFallbackPrioritySnapshot {
  schemaVersion: number;
  members: Record<string, LiveFallbackPriorityMember>;
}
