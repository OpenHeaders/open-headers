/**
 * Client half of the severity manifest (`docs/UPDATES_PLAN.md` §4).
 *
 * `versions/<channel>.json` is a static pointer file on the update feed
 * (`update-feed.ts`), written by the release workflow
 * (`scripts/generate-versions-manifest.mjs` shape, uploaded per channel
 * by `scripts/generate-update-feed.mjs`) — a stable tag only ever moves
 * `versions/stable.json`, so beta tags never move what this reads. The
 * fetch shares the update check's posture exactly: an anonymous `GET`
 * of a static file, no payload, no identifier — and it only ever runs
 * from the update service's check, so the same off switches
 * (`updates.check: off`, `OH_DISABLE_UPDATE_CHECKS=1`, unsupported
 * builds) gate it.
 *
 * Severity always reads the STABLE manifest, regardless of channel —
 * the security floor is a property of the stable line, and a beta
 * install below it must still escalate (`docs/DISTRIBUTION_PLAN.md` §4).
 *
 * Severity is authored by a human before tagging, never inferred; a
 * `security` entry always names its `minimumSafeVersion` floor (the
 * generator fails the pipeline otherwise).
 */

import type { AppUpdateSeverity } from '@openheaders/core/bridge';
import { versionsManifestUrl } from './update-feed';

export const VERSIONS_MANIFEST_URL = versionsManifestUrl('stable');

/** The desktop entry of the published manifest, validated. */
export interface SeverityInfo {
  latest: string;
  severity: AppUpdateSeverity;
  minimumSafeVersion?: string;
}

/**
 * Numeric segment-wise CalVer compare, prerelease-aware: on an equal
 * base a `-beta.N` sorts below the plain release and betas order by N —
 * the updater's semver ordering, so a floor of `2026.8.0` escalates a
 * `2026.8.0-beta.N` install. Mirrors the generator's ordering so client
 * and pipeline can never disagree on what "below the floor" means.
 */
export function compareCalVer(a: string, b: string): number {
  const parse = (v: string): { base: number[]; beta: number | null } => {
    const match = /-beta\.(\d+)$/.exec(v);
    return {
      base: v
        .replace(/-beta\.\d+$/, '')
        .split('.')
        .map(Number),
      beta: match ? Number(match[1]) : null,
    };
  };
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(pa.base.length, pb.base.length); i++) {
    const diff = (pa.base[i] ?? 0) - (pb.base[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.beta === null && pb.beta === null) return 0;
  if (pa.beta === null) return 1;
  if (pb.beta === null) return -1;
  return pa.beta - pb.beta;
}

function isVersionString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)*(-beta\.\d+)?$/.test(value);
}

/**
 * Extract the desktop entry from a fetched manifest body. Null on any
 * shape the generator could not have produced — a manifest served
 * wrong is treated as absent, never as an update-check failure.
 */
export function parseDesktopSeverity(raw: unknown): SeverityInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = (raw as Record<string, unknown>).desktop;
  if (typeof entry !== 'object' || entry === null) return null;
  const { latest, severity, minimumSafeVersion } = entry as Record<string, unknown>;
  if (!isVersionString(latest)) return null;
  if (severity !== 'normal' && severity !== 'security') return null;
  if (minimumSafeVersion !== undefined && !isVersionString(minimumSafeVersion)) return null;
  return { latest, severity, ...(minimumSafeVersion !== undefined ? { minimumSafeVersion } : {}) };
}

/**
 * The escalation predicate: a security release whose named safe floor
 * is above the running version.
 */
export function isBelowSafeFloor(info: SeverityInfo, currentVersion: string): boolean {
  return (
    info.severity === 'security' &&
    info.minimumSafeVersion !== undefined &&
    compareCalVer(currentVersion, info.minimumSafeVersion) < 0
  );
}

/**
 * Fetch + validate the manifest's desktop entry. Null on network
 * failure, non-200, or an unparseable body — callers treat "no
 * manifest" and "manifest unreachable" identically.
 */
export async function fetchDesktopSeverity(fetchFn: typeof fetch = fetch): Promise<SeverityInfo | null> {
  try {
    const response = await fetchFn(VERSIONS_MANIFEST_URL, { cache: 'no-store', redirect: 'follow' });
    if (!response.ok) return null;
    return parseDesktopSeverity(await response.json());
  } catch {
    return null;
  }
}
