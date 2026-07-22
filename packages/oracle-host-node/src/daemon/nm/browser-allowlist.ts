/**
 * Browser code-signing allowlist for the NM identity bootstrap
 * (OBSERVABILITY_PLAN.md §8 Phase 7). A token is only released to an
 * NM host whose spawning parent process carries one of these signer
 * identities — the OS-verified answer to "which browser is asking",
 * never a claim from the wire.
 *
 * macOS entries are Apple Developer team identifiers as printed by
 * `codesign -dv` (`TeamIdentifier=`). Windows entries are Authenticode
 * signer-certificate subject common names as carried by a
 * `Get-AuthenticodeSignature` Valid verdict — a CA-vetted organization
 * name an attacker cannot obtain from a trusted root. On both
 * platforms one vendor identity covers the whole signed family
 * (stable/beta/canary channels and helper processes all sign with the
 * vendor's identity), so the tables stay per-vendor, not per-channel.
 * An unsigned or ad-hoc-signed browser (a local Chromium build) is
 * refused here by design — the degraded path is the device-flow
 * pairing gesture, not a weaker check.
 */

/** Platform-neutral verified-browser identity the chain hands back. */
export interface VerifiedBrowser {
  /** Vendor-family display name for token labels + refusal logs. */
  readonly name: string;
}

export interface BrowserSignerEntry extends VerifiedBrowser {
  /** Apple Developer team identifier (macOS `TeamIdentifier=`). */
  readonly teamId: string;
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

export interface WindowsBrowserSignerEntry extends VerifiedBrowser {
  /** Authenticode signer-certificate subject CN (`CN=` of a Valid signature). */
  readonly subjectCommonName: string;
}

export const WINDOWS_BROWSER_SIGNERS: readonly WindowsBrowserSignerEntry[] = [
  { subjectCommonName: 'Google LLC', name: 'Google Chrome' },
  { subjectCommonName: 'Microsoft Corporation', name: 'Microsoft Edge' },
  { subjectCommonName: 'Brave Software, Inc.', name: 'Brave' },
  { subjectCommonName: 'Mozilla Corporation', name: 'Firefox' },
];

export function findWindowsBrowserSigner(subjectCommonName: string): WindowsBrowserSignerEntry | undefined {
  return WINDOWS_BROWSER_SIGNERS.find((entry) => entry.subjectCommonName === subjectCommonName);
}
