/**
 * Live-fallback-priority mutator catalog — routing constants.
 *
 * Singleton entity (per workspace). One record holds a single
 * set-modeled map `members`, keyed by `Principal.id`. Each member is a
 * {@link LiveFallbackPriorityMember} — a `(principalId, order)` pair.
 *
 * This is the WS-C C14 data-plane seam: a same-device host that holds an
 * exclusive workflow's consumed seed appends itself here (auto-seed) so
 * that, once the configured backend goes offline, every partitioned
 * browser can decide *locally* which single host self-refreshes the
 * exclusive credential — from this frozen, last-synced ranking — instead
 * of racing (`offline-fallback-election.ts`).
 *
 * Not sensitive: a member carries only a `Principal.id`, never a secret,
 * so the entity is NOT schema-marked sensitive and is NOT loopback-gated
 * (WS-B B1) — it rides the normal trust-zone-wide forwarder exactly like
 * the OAuth bundle. A cross-device paired host therefore receives the
 * list, reads itself as `not-listed`, and banners — the correct outcome.
 *
 * Side-effects: none routed through the §4 side-effect dispatcher. The
 * sole consumer is the live-refresh scheduler's offline election, which
 * reads the derived ranking through an oracle reader.
 */

/** Routing key carried on every live-fallback-priority mutation envelope. */
export const LIVE_FALLBACK_PRIORITY_ENTITY_TYPE = 'live-fallback-priority';

/** Fixed singleton id — every workspace has exactly one of these. */
export const LIVE_FALLBACK_PRIORITY_ID = 'live-fallback-priority';

/** Set path holding {@link LiveFallbackPriorityMember} members keyed by `principalId`. */
export const LIVE_FALLBACK_PRIORITY_MEMBERS_PATH = 'members';
