/**
 * Browser code-signing allowlist for the NM identity bootstrap
 * (OBSERVABILITY_PLAN.md §8 Phase 7). A token is only released to an
 * NM host whose spawning parent process carries one of these signer
 * identities — the OS-verified answer to "which browser is asking",
 * never a claim from the wire.
 *
 * macOS entries are Apple Developer team identifiers as printed by
 * `codesign -dv` (`TeamIdentifier=`). One vendor id covers the whole
 * signed family (stable/beta/canary channels and helper processes all
 * sign with the vendor's team), so the table stays per-vendor, not
 * per-channel. An unsigned or ad-hoc-signed browser (a local Chromium
 * build) is refused here by design — the degraded path is the
 * device-flow pairing gesture, not a weaker check.
 */

export interface BrowserSignerEntry {
  /** Apple Developer team identifier (macOS `TeamIdentifier=`). */
  readonly teamId: string;
  /** Vendor-family display name for token labels + refusal logs. */
  readonly name: string;
}

export const MACOS_BROWSER_SIGNERS: readonly BrowserSignerEntry[] = [
  { teamId: 'EQHXZ8M8AV', name: 'Google Chrome' },
  { teamId: 'UBF8T346G9', name: 'Microsoft Edge' },
  { teamId: 'KL8N8XSYF4', name: 'Brave' },
  { teamId: '43AQ936H96', name: 'Firefox' },
];

export function findMacosBrowserSigner(teamId: string): BrowserSignerEntry | undefined {
  return MACOS_BROWSER_SIGNERS.find((entry) => entry.teamId === teamId);
}
