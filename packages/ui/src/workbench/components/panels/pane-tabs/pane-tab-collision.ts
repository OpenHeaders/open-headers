/**
 * pane-tab-collision — the scoped collision law for tab-strip dock
 * panels, extracted from the terminal renderer (itself the editor's
 * `makeEditorTabCollisionDetection` law): report collisions ONLY while
 * the pointer is inside a tab bar (scoped to that bar's tabs, so
 * same-leaf reorder and cross-leaf insert work); everywhere else
 * return none, leaving `event.over` null so the renderer's zone-based
 * drop intent (center move / edge split) is what dispatches. Plain
 * `closestCenter` would always name the nearest tab and mask every
 * zone drop as a reorder.
 */

import { type CollisionDetection, closestCenter } from '@dnd-kit/core';

/** Build the detection for one panel's drag-data `kind` discriminator. */
export function makePaneTabCollisionDetection(kind: string): CollisionDetection {
  return (args) => {
    const ptr = args.pointerCoordinates;
    if (!ptr) return [];

    let hoveredTabBar: HTMLElement | null = null;
    for (const container of args.droppableContainers) {
      const data = container.data.current as { kind?: unknown } | undefined;
      if (data?.kind !== kind) continue;
      const node = container.node.current;
      if (!node) continue;
      const tabBar = node.closest('.rules-tabs-bar');
      if (!(tabBar instanceof HTMLElement)) continue;
      const r = tabBar.getBoundingClientRect();
      if (ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom) {
        hoveredTabBar = tabBar;
        break;
      }
    }
    if (!hoveredTabBar) return [];

    const scoped = args.droppableContainers.filter((container) => {
      const data = container.data.current as { kind?: unknown } | undefined;
      if (data?.kind !== kind) return false;
      const node = container.node.current;
      return node != null && hoveredTabBar.contains(node);
    });
    return closestCenter({ ...args, droppableContainers: scoped });
  };
}
