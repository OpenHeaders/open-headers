/**
 * Leaf `path` projection — the containment law applied at read time.
 *
 * A leaf's `path` is a projection of its parent's slot plus its own
 * frozen `pathSegment`; the scalar the entity stores is the boot-time
 * net for leaves that have no live slot yet (old clients, old storage,
 * mid-replay). The six leaf projectors call this with the parent path
 * the folder-tree index resolved — `null` when the leaf has no live
 * slot — and keep the stored scalar in that case.
 *
 * A leaf that has a slot but no `pathSegment` (an old-client entity
 * the reconciliation rule seeded) borrows the last segment of its
 * stored path: the segment is frozen at create and the stored path's
 * tail is that same segment, so nothing is invented.
 */

import { lastPathSegment } from '../../utils/workspace';

export function projectLeafPath(data: Record<string, unknown>, parentPath: string | null): string {
  const stored = typeof data.path === 'string' ? data.path : '';
  if (parentPath === null) return stored;
  const segment =
    typeof data.pathSegment === 'string' && data.pathSegment.length > 0 ? data.pathSegment : lastPathSegment(stored);
  return segment === null ? stored : `${parentPath}/${segment}`;
}
