/**
 * `host-install-id` minting — a fresh stable identifier per host install,
 * minted once at first boot, persisted to the host's storage, never
 * regenerated except on reinstall (the unified-oracle model §5.1 / §11 OQ1).
 *
 * The identifier is opaque — anything stable and unique-per-host suffices.
 * `crypto.randomUUID()` gives us 122 bits of entropy on every supported
 * host (extension SW, Node 22+, Electron). The synthetic identity-row
 * UUIDs derive deterministically from this value via
 * `./derive-uuid.ts`, so its stability is load-bearing.
 */

/**
 * Mint a fresh host-install-id. Pure of any storage concern — the caller
 * decides whether and where to persist it (see `./ensure-daemon-config.ts`
 * for the host-storage-backed wrapper).
 */
export function mintHostInstallId(): string {
  return crypto.randomUUID();
}
