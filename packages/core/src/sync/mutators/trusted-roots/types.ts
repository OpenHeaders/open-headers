/**
 * Trusted-roots mutator catalog — routing constants.
 *
 * Singleton entity. There is exactly one TrustedRoots record per
 * workspace, addressed by the fixed id `TRUSTED_ROOTS_ID`. Set member
 * identity is the root's `uid` (mirrors the vault: a certificate has no
 * natural name key — two roots may legitimately share a display name).
 */

/** Routing key carried on every trusted-roots mutation envelope. */
export const TRUSTED_ROOTS_ENTITY_TYPE = 'trusted-roots';

/** Set path holding the root list on the trusted-roots entity. */
export const TRUSTED_ROOTS_PATH = 'roots';

/** Fixed singleton id — every workspace has exactly one of these. */
export const TRUSTED_ROOTS_ID = 'trusted-roots';
