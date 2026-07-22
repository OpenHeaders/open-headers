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
 *
 * Linux has no code-signing chain, so its table is the ratified
 * best-effort path heuristic instead: the kernel-reported executable
 * (`/proc/<pid>/exe`, realpath'd) must resolve under a root-owned
 * system install root a vendor package actually uses. A user cannot
 * place a binary under `/opt` or `/usr/lib` without root, which is
 * exactly the strength this heuristic buys. Distro-packaged Chromium
 * is allowlisted here (ratified S31) — on Linux it carries the same
 * root-installed trust as Chrome, since no signature exists to prefer.
 * Snap/flatpak-packaged browsers are deliberately absent: their
 * portal-mediated NM delivery and bwrap parent chains are unverified,
 * so they fall back to the device-flow pairing gesture.
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

export interface LinuxBrowserPathEntry extends VerifiedBrowser {
  /** Root-owned install-root prefixes the vendor's packages resolve under. */
  readonly pathPrefixes: readonly string[];
}

export const LINUX_BROWSER_PATHS: readonly LinuxBrowserPathEntry[] = [
  {
    name: 'Google Chrome',
    pathPrefixes: ['/opt/google/chrome/', '/opt/google/chrome-beta/', '/opt/google/chrome-unstable/'],
  },
  {
    name: 'Chromium',
    pathPrefixes: [
      '/usr/lib/chromium/',
      '/usr/lib64/chromium/',
      '/usr/lib/chromium-browser/',
      '/usr/lib64/chromium-browser/',
    ],
  },
  {
    name: 'Microsoft Edge',
    pathPrefixes: ['/opt/microsoft/msedge/', '/opt/microsoft/msedge-beta/', '/opt/microsoft/msedge-dev/'],
  },
  {
    name: 'Brave',
    pathPrefixes: ['/opt/brave.com/brave/', '/opt/brave.com/brave-beta/', '/opt/brave.com/brave-nightly/'],
  },
  {
    name: 'Firefox',
    pathPrefixes: [
      '/usr/lib/firefox/',
      '/usr/lib64/firefox/',
      '/usr/lib/firefox-esr/',
      '/usr/lib64/firefox-esr/',
      '/opt/firefox/',
    ],
  },
];

/** Match a realpath'd executable against the Linux install-root table. */
export function findLinuxBrowserByPath(executablePath: string): LinuxBrowserPathEntry | undefined {
  return LINUX_BROWSER_PATHS.find((entry) => entry.pathPrefixes.some((prefix) => executablePath.startsWith(prefix)));
}
