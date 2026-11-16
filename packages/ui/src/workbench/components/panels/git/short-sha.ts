/**
 * A commit's hash as text — the ONE short form of it: what a row, a
 * title, a toast or a file name shows where the whole forty would not
 * fit, eight characters (the reference's reading); and whether a text
 * is a whole hash.
 */

const SHORT_SHA_LENGTH = 8;

export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}

/** Stretches of a whole hash as its short form shows them: cut where it ends, gone where they start past it. */
export function shortShaRanges(ranges: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  return ranges
    .filter(([start]) => start < SHORT_SHA_LENGTH)
    .map(([start, end]) => [start, Math.min(end, SHORT_SHA_LENGTH)]);
}

/** A full 40-hex commit id — what the host verbs take as a start point beside a ref name. */
export function isFullCommitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value);
}
