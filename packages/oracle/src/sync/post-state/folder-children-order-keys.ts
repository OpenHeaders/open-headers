/**
 * Tiny helper used by the three collection + three folder post-state
 * adapters to fold the parent's `folders` set into the
 * `setOrderKeys: Record<string, Array<{ itemId, orderKey }>>` shape.
 *
 * Sibling folder order lives on the parent (§23.5). The renderer's
 * sidebar tree consumes this to render folders in fractional-indexing
 * order; the dnd surface uses the same values to compute
 * `keyBetween(prev, next)` at drop time.
 */

import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'liveOrderedSetItems'>;

export function buildFolderChildrenOrderKeys(
  oracle: Reads,
  parentType: string,
  parentUid: string,
  childrenPath: string,
): Record<string, Array<{ itemId: string; orderKey: string }>> {
  const items = oracle.liveOrderedSetItems(parentType, parentUid, childrenPath);
  if (items.length === 0) return {};
  return {
    [childrenPath]: items.map((entry) => ({ itemId: entry.itemId, orderKey: entry.key })),
  };
}
