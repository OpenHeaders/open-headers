/**
 * Raw host readings → vocabulary (the v2 plan §2): every function here
 * takes what a platform API or a product record says and answers in a
 * closed list, or null for "unstamped" — never the nearest member, never
 * a passthrough. Hosts call these at the seam where a reading leaves the
 * process; nothing below them ever sees a raw string.
 */

import type { DetectedImportSource } from '../../import/detect';
import type { LicenseSnapshot } from '../../licensing/types';
import type {
  TelemetryAppVersion,
  TelemetryArch,
  TelemetryBrowserKind,
  TelemetryLocale,
  TelemetryMcpClient,
  TelemetryPlanBucket,
  TelemetryPlatform,
  TelemetrySyncKind,
} from './grammar';
import { TelemetryLocaleSchema } from './grammar';
import type { TelemetryMigratedFrom } from './state';

/**
 * Map a host's raw architecture reading onto the vocabulary. Takes
 * Node's `process.arch` spelling (`x64`/`arm64`) and the browser
 * platform-info spelling (`x86-64`/`arm64`); `translated` is the
 * host's "x64 build under arm64 translation" reading (Electron's
 * `app.runningUnderARM64Translation`), which only ever applies to an
 * x64 process. Unlisted architectures read as null — unstamped, never
 * misreported under the nearest member.
 */
export function toTelemetryArch(arch: string, translated = false): TelemetryArch | null {
  if (arch === 'arm64') return 'arm64';
  if (arch === 'x64' || arch === 'x86-64') return translated ? 'x64-on-arm64' : 'x64';
  return null;
}

/** Map a resolved app locale onto the vocabulary; unlisted codes (pseudo, future waves) read as `other`. */
export function toTelemetryLocale(code: string): TelemetryLocale {
  const options: readonly string[] = TelemetryLocaleSchema.options;
  return options.includes(code) ? (code as TelemetryLocale) : 'other';
}

const leadingInteger = (text: string): number | null => {
  const match = /^\s*(\d+)/.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
};

/**
 * The OS major version as people know it (S35) — coarse MAJOR only,
 * never a build. Where a platform's reading cannot be trusted the
 * answer is null and the envelope stays unstamped: a wrong major is
 * worse than none.
 *
 * Windows 10 and 11 share kernel major 10; 11 begins at build 22000,
 * so a `10.0.<build>` string (Electron's `process.getSystemVersion()`,
 * Node's `os.release()`) resolves by its build. Anything below 10 is
 * unstamped (nothing shipped runs there).
 */
export function windowsMajorFromVersion(version: string): number | null {
  const [major, , build] = version.split('.').map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(major) || major < 10) return null;
  if (major > 10) return major;
  return Number.isInteger(build) && build >= 22000 ? 11 : 10;
}

/**
 * Windows major from the User-Agent Client Hints `platformVersion`
 * (the only version read a Chromium extension has, since the UA string
 * freezes `Windows NT 10.0`): 13 and above is Windows 11, 1 through 12
 * is Windows 10, 0 is older than either and stays unstamped.
 */
export function windowsMajorFromClientHintPlatformVersion(platformVersion: string): number | null {
  const major = leadingInteger(platformVersion);
  if (major === null || major < 1) return null;
  return major >= 13 ? 11 : 10;
}

/**
 * macOS major from the Darwin kernel release (`os.release()` on a
 * Node CLI — the only version read without a native call): Darwin 20
 * through 24 are macOS 11 through 15, and from Darwin 25 the marketing
 * number jumped to the year (macOS 26), so the offset flips. Older
 * kernels stay unstamped.
 */
export function macOsMajorFromDarwinRelease(release: string): number | null {
  const darwin = leadingInteger(release);
  if (darwin === null || darwin < 20) return null;
  return darwin >= 25 ? darwin + 1 : darwin - 9;
}

/**
 * OS major from a marketing-version string the platform reports as
 * such — Electron's `process.getSystemVersion()` on the desktop, the
 * Client Hints `platformVersion` on a Chromium extension (`15.1.0`
 * on a Mac). Linux has no product-meaningful major (a kernel number)
 * and stays unstamped.
 */
export function osMajorFromSystemVersion(platform: TelemetryPlatform, version: string): number | null {
  if (platform === 'mac') return leadingInteger(version);
  if (platform === 'win') return windowsMajorFromVersion(version);
  return null;
}

/**
 * Browser major from the UA string, by engine (S35). UA reduction
 * froze the platform and the minor segments, never the major, so one
 * regex per engine is exact: Chromium's `Chrome/NNN` (Edge announces
 * the same engine major beside its own `Edg/` token), `Firefox/NNN`,
 * Safari's `Version/NN`. `other` has no vocabulary and stays unstamped.
 */
export function browserMajorFromUserAgent(kind: TelemetryBrowserKind, userAgent: string): number | null {
  const pattern =
    kind === 'chrome' || kind === 'edge'
      ? /Chrome\/(\d+)/
      : kind === 'firefox'
        ? /Firefox\/(\d+)/
        : kind === 'safari'
          ? /Version\/(\d+)/
          : null;
  const match = pattern ? pattern.exec(userAgent) : null;
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * The plan a user-initiated license install activated, from the
 * entitlement snapshot the install returned — the ONLY seam
 * `license_activated` may derive from (S20 law: never the license file,
 * never id/key/licensee/seats). Null means nothing activated
 * (`unlicensed`/`invalid`) and no event fires; `free` is never an
 * activation. A `personal-seat` artifact is the Individual plan, any
 * other verified license is an org license (Team; Enterprise is
 * deliberately indistinguishable).
 */
export function activatedPlanFromLicenseSnapshot(snapshot: LicenseSnapshot): TelemetryPlanBucket | null {
  if (snapshot.status === 'unlicensed' || snapshot.status === 'invalid') return null;
  return snapshot.kind === 'personal-seat' ? 'individual' : 'team';
}

/**
 * The install's plan for the state block (the v2 plan §3): the plan a
 * licensed or in-grace snapshot names, `free` for everything else —
 * an expired license is the free tier again, and the extension, which
 * carries no license plumbing, always reads `free`.
 */
export function planBucketFromLicenseSnapshot(snapshot: LicenseSnapshot): TelemetryPlanBucket {
  if (snapshot.status !== 'licensed' && snapshot.status !== 'grace') return 'free';
  return snapshot.kind === 'personal-seat' ? 'individual' : 'team';
}

/**
 * Map a free-form MCP `clientInfo.name` onto the vocabulary — keyword
 * containment over the lowercased name, most specific first: VS Code
 * forks announce themselves with `vscode` in the name, so the fork
 * checks run before the `vscode` member catches the rest, and Claude
 * Desktop announces without a `code` token (`claude-ai`).
 */
export function toTelemetryMcpClient(clientName: string): TelemetryMcpClient {
  const name = clientName.toLowerCase();
  if (name.includes('claude')) return name.includes('code') ? 'claude-code' : 'claude-desktop';
  if (name.includes('cursor')) return 'cursor';
  if (name.includes('windsurf')) return 'windsurf';
  if (name.includes('vscode') || name.includes('visual studio code')) return 'vscode';
  return 'other';
}

const PRERELEASE_BETA = /^beta(?:\.(\d+))?$/;

/**
 * Decompose a CalVer version string into the numbers the wire carries.
 * Malformed segments become 0 rather than failing — the version is
 * context, never worth blocking an event over. Only the `-beta.N` tag
 * of the release grammar maps to `beta` (a bare `-beta` reads as
 * iteration 1); any other suffix is ignored.
 */
export function parseTelemetryAppVersion(version: string): TelemetryAppVersion {
  const hyphen = version.indexOf('-');
  const release = hyphen === -1 ? version : version.slice(0, hyphen);
  const prerelease = hyphen === -1 ? '' : version.slice(hyphen + 1);
  const [year = 0, month = 0, patch = 0] = release.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isInteger(n) ? n : 0;
  });
  const betaTag = PRERELEASE_BETA.exec(prerelease);
  if (!betaTag) return { year, month, patch };
  return { year, month, patch, beta: betaTag[1] === undefined ? 1 : Number.parseInt(betaTag[1], 10) };
}

/** Fold the two host-gathered facts into the install-wide maximum; the precedence is the grammar's law. */
export function resolveTelemetrySyncKind(facts: { server: boolean; git: boolean }): TelemetrySyncKind {
  if (facts.server) return 'server';
  if (facts.git) return 'git';
  return 'local';
}

/**
 * The tool an import came from, for `migratedFrom` (the v2 plan §3):
 * the detector's kinds folded onto the origin list — both Postman
 * shapes are Postman; a HAR, an OpenAPI document and the rest of the
 * generic formats name no tool and read `other`. Only the first
 * successful import ever sets the fact.
 */
export function migratedFromImportSource(source: DetectedImportSource['kind']): TelemetryMigratedFrom {
  switch (source) {
    case 'postman':
    case 'postman-backup':
      return 'postman';
    case 'insomnia':
      return 'insomnia';
    case 'bruno':
      return 'bruno';
    case 'har':
      return 'har';
    case 'openapi':
      return 'openapi';
    default:
      return 'other';
  }
}
