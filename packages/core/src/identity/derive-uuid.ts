/**
 * Deterministic UUIDv7 derivation from a string seed — the cryptographic
 * primitive behind synthetic identity row ids (UNIFIED_ORACLE_MODEL.md §5.1).
 *
 * Given a stable seed (e.g. `'local-user@<host-install-id>'`), produces a
 * UUIDv7 with the canonical RFC 9562 layout (version nibble = 7,
 * variant bits = 10). Same seed → same UUID; collision probability is
 * that of random UUIDv7 because SHA-256 expands the seed to enough
 * entropy (§5.1 / §11 OQ3).
 *
 * Implementation:
 *   1. SHA-256 the seed → 32 raw bytes.
 *   2. Take the first 16 bytes as the UUID payload.
 *   3. Patch byte 6: clear high nibble, set to `0x70` (version 7).
 *   4. Patch byte 8: clear top 2 bits, set to `0b10xx_xxxx` (variant 10).
 *   5. Format as canonical 8-4-4-4-12 hex with dashes.
 *
 * Async because `crypto.subtle.digest` is async on every host
 * (browser SW, Node 22+, Electron renderer). The bootstrap helper is
 * called once per host boot — the latency is irrelevant.
 */

const HEX_LUT = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * Compute the deterministic UUIDv7 for a seed string.
 *
 * @param seed   Stable identifier (`'local-user@<host-install-id>'` etc).
 *               Treated as UTF-8 bytes before hashing.
 * @returns      Canonical UUIDv7 (lowercase, 8-4-4-4-12 layout).
 */
export async function deriveSyntheticUuidV7(seed: string): Promise<string> {
  const seedBytes = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest('SHA-256', seedBytes);
  const bytes = new Uint8Array(digest, 0, 16);

  // Version 7 in the high nibble of byte 6.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  // Variant 10 in the top two bits of byte 8.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const h = (i: number): string => HEX_LUT[bytes[i] ?? 0] ?? '00';
  return (
    `${h(0)}${h(1)}${h(2)}${h(3)}-` +
    `${h(4)}${h(5)}-` +
    `${h(6)}${h(7)}-` +
    `${h(8)}${h(9)}-` +
    `${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  );
}

/**
 * Seed factories — single source of truth for the two synthetic seed
 * formats. UNIFIED_ORACLE_MODEL.md §5.1 pins these strings; any future
 * synthetic row type adds its own factory here so the seed format stays
 * grep-discoverable in one place.
 */
export const SYNTHETIC_SEEDS = {
  user: (hostInstallId: string): string => `local-user@${hostInstallId}`,
  org: (hostInstallId: string): string => `local-org@${hostInstallId}`,
  userIdentity: (hostInstallId: string): string => `local-user-identity@${hostInstallId}`,
  session: (hostInstallId: string): string => `local-session@${hostInstallId}`,
  membership: (hostInstallId: string): string => `local-membership@${hostInstallId}`,
  principal: (hostInstallId: string): string => `local-principal@${hostInstallId}`,
  daemonAdmin: (hostInstallId: string): string => `local-daemon-admin@${hostInstallId}`,
} as const;
