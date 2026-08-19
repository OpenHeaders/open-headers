/**
 * Client half of the static changelog feed
 * (`updates.openheaders.com/changelog/*`, the changelog plan §4.1): the
 * URL contract plus tolerant validators for the two shapes in-app
 * history surfaces read — per-stream index rows and full-entry bodies.
 *
 * Consumers fetch these as an ENHANCEMENT only (the offline law):
 * every app bundles its own current entry, so an unreachable feed, a
 * non-200, or a body the generator could not have produced all read as
 * "no history" (null), never as an error surface. Indexes complement
 * `versions.json`; the updater never reads them.
 */

export const CHANGELOG_FEED_BASE = 'https://updates.openheaders.com/changelog';

/** The streams the canonical tree records (products, not cadences). */
export type ChangelogStream = 'desktop' | 'extension' | 'cli' | 'daemon' | 'web';

export type ChangelogChannel = 'stable' | 'beta';
export type ChangelogSeverity = 'normal' | 'security';

/**
 * One release in a per-stream index view (`changelog/<stream>.json`) —
 * the feed generator's row minus the projection URLs, which collapse
 * into {@link ChangelogIndexRow.hasNotes}: the entry-existence law means
 * a release may be machine-complete but prose-free, and only prose rows
 * have an entry object to fetch.
 */
export interface ChangelogIndexRow {
  readonly version: string;
  /** ISO date (`YYYY-MM-DD`). */
  readonly date: string;
  readonly channel: ChangelogChannel;
  readonly severity: ChangelogSeverity;
  readonly highlights?: readonly string[];
  /** The release has prose notes on the feed (`<stream>/<version>.json`). */
  readonly hasNotes: boolean;
}

/**
 * Numeric segment-wise CalVer compare, prerelease-aware: on an equal
 * base a `-beta.N` sorts below the plain release and betas order by N.
 * Mirrors the feed generator's ordering so client and pipeline can
 * never disagree on what "older" means.
 */
export function compareChangelogVersions(a: string, b: string): number {
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

/** Version-string gate for URL construction and row validation. */
export function isChangelogVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)*(-beta\.\d+)?$/.test(value);
}

/** The per-stream index view URL (`changelog/<stream>.json`). */
export function changelogStreamUrl(stream: ChangelogStream): string {
  return `${CHANGELOG_FEED_BASE}/${stream}.json`;
}

/** A release's full-entry object URL (`changelog/<stream>/<version>.json`). */
export function changelogEntryUrl(stream: ChangelogStream, version: string): string {
  return `${CHANGELOG_FEED_BASE}/${stream}/${version}.json`;
}

/**
 * Validate a fetched stream view. Null when the body is not an array;
 * rows the generator could not have produced are dropped, not fatal —
 * a future field addition must never blank the whole history.
 */
export function parseChangelogIndexRows(raw: unknown): ChangelogIndexRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: ChangelogIndexRow[] = [];
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const { version, date, channel, severity, highlights, json } = candidate as Record<string, unknown>;
    if (!isChangelogVersion(version)) continue;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const highlightRows = Array.isArray(highlights) ? highlights.filter((h): h is string => typeof h === 'string') : [];
    rows.push({
      version,
      date,
      channel: channel === 'beta' ? 'beta' : 'stable',
      severity: severity === 'security' ? 'security' : 'normal',
      ...(highlightRows.length > 0 ? { highlights: highlightRows } : {}),
      hasNotes: typeof json === 'string',
    });
  }
  return rows;
}

/**
 * Extract the prose body from a fetched entry object
 * (`{ …frontmatter, body_markdown }`, asset refs already absolute).
 * Null on any other shape — treated as "entry absent".
 */
export function parseChangelogEntryBody(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const body = (raw as Record<string, unknown>).body_markdown;
  return typeof body === 'string' && body.trim() !== '' ? body : null;
}
