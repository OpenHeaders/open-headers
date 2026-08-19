/**
 * Daemon half of the update feed contract (the distribution plan
 * §3–§5): URL builders for the static pointer files on
 * `updates.openheaders.com` plus the manifest's `daemon` entry parser
 * and the CalVer ordering `ohd upgrade` and the status line compare
 * with. Mirrors the client CLI's `update-feed.ts` — the two binaries
 * ship separately, so each carries its own copy of the feed law. No
 * GitHub URL ever appears here, and no network code either: fetching
 * belongs to the consumers (`upgrade.ts`, `update-notify.ts`).
 */

export type UpdateChannel = 'stable' | 'beta';

export const UPDATE_FEED_BASE = 'https://updates.openheaders.com';

export function versionsManifestUrl(channel: UpdateChannel): string {
  return `${UPDATE_FEED_BASE}/versions/${channel}.json`;
}

/** Per-tag immutable asset home; `SHA256SUMS.txt` and the binaries live under it. */
export function downloadBaseUrl(tag: string): string {
  return `${UPDATE_FEED_BASE}/dl/${tag}`;
}

/**
 * Numeric segment-wise CalVer compare, prerelease-aware: on an equal
 * base a `-beta.N` sorts below the plain release and betas order by N.
 * Mirrors the client CLI, the desktop client, and the manifest
 * generator exactly, so no side of the contract can disagree on
 * ordering (`.9 < .10`, never lexical).
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

export type UpdateSeverity = 'normal' | 'security';

/** The manifest's `daemon` entry, validated (the updates plan §4 shape). */
export interface DaemonManifestEntry {
  latest: string;
  tag: string;
  severity: UpdateSeverity;
  minimumSafeVersion?: string;
}

function isVersionString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)*(-beta\.\d+)?$/.test(value);
}

/**
 * Extract the `daemon` entry from a fetched manifest body. Null on any
 * shape the generator could not have produced — a manifest served
 * wrong is treated as absent, never as a hard failure.
 */
export function parseDaemonManifestEntry(raw: unknown): DaemonManifestEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = (raw as Record<string, unknown>).daemon;
  if (typeof entry !== 'object' || entry === null) return null;
  const { latest, tag, severity, minimumSafeVersion } = entry as Record<string, unknown>;
  if (!isVersionString(latest)) return null;
  if (typeof tag !== 'string' || !/^v\d/.test(tag)) return null;
  if (severity !== 'normal' && severity !== 'security') return null;
  if (minimumSafeVersion !== undefined && !isVersionString(minimumSafeVersion)) return null;
  return { latest, tag, severity, ...(minimumSafeVersion !== undefined ? { minimumSafeVersion } : {}) };
}
