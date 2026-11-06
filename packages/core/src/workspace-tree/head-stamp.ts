/**
 * The §6.3 HEAD stamp — the identity a git-bound workspace's log rows
 * and its wire frames carry for the checked-out HEAD: a branch NAME,
 * `@{<sha>}` while HEAD is detached at `sha` (no ref name may contain
 * `@{`, so the key collides with no branch), `''` when HEAD resolves
 * to nothing at all. Minted by the Node host, read by every peer.
 */

/** Opening of a detached-HEAD stamp — a sequence no ref name may contain. */
export const DETACHED_HEAD_STAMP_PREFIX = '@{';

/** The stamp of a HEAD detached at `sha`: `@{<sha>}`. */
export function detachedHeadStamp(sha: string): string {
  return `${DETACHED_HEAD_STAMP_PREFIX}${sha}}`;
}

export type HeadStampReading =
  | { kind: 'branch'; name: string }
  | { kind: 'detached'; sha: string }
  /** `''` — HEAD resolves to nothing. */
  | { kind: 'none' };

/** Read a stamp back into what HEAD was: a branch, a detached commit, or nothing. */
export function readHeadStamp(stamp: string): HeadStampReading {
  if (stamp === '') return { kind: 'none' };
  if (stamp.startsWith(DETACHED_HEAD_STAMP_PREFIX) && stamp.endsWith('}')) {
    return { kind: 'detached', sha: stamp.slice(DETACHED_HEAD_STAMP_PREFIX.length, -1) };
  }
  return { kind: 'branch', name: stamp };
}
