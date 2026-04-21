/**
 * editor-tab-collision — collision-detection factory for the shared
 * dockable shell.
 *
 * Editor-tab drags live inside a host-owned renderer (workspace's
 * `EditorGroupRenderer`, devpanel's `InspectorEditorGroupRenderer`) that
 * computes drop zones via its own pointermove listener. Without scoping
 * collision detection, dnd-kit's default `closestCenter` still matches
 * the shell's dock-strip droppables during an editor-tab drag — which
 * (a) highlights activity bars / tool-window sidebars with a misleading
 * blue drop-hover, and (b) fills `event.over` with a dock strip, masking
 * the renderer's zone-based drop intent.
 *
 * The factory returns a detector that:
 *   - For non-editor-tab drags: defers to `closestCenter` (tool-window
 *     drags keep the default six-quadrant behavior).
 *   - For editor-tab drags: returns no collisions unless the pointer is
 *     inside the host's tab-bar selector, in which case collision is
 *     scoped to editor-tab droppables only — enabling same-leaf reorder
 *     and cross-leaf insert without touching dock drops.
 */

import type { CollisionDetection } from '@dnd-kit/core';
import { closestCenter } from '@dnd-kit/core';

export function makeEditorTabCollisionDetection(tabBarSelector: string): CollisionDetection {
  return (args) => {
    const activeKind = (args.active.data.current as { kind?: unknown } | undefined)?.kind;
    if (activeKind !== 'editor-tab') return closestCenter(args);
    const ptr = args.pointerCoordinates;
    if (!ptr) return [];

    let hoveredTabBar: HTMLElement | null = null;
    for (const container of args.droppableContainers) {
      const data = container.data.current as { kind?: unknown } | undefined;
      if (data?.kind !== 'editor-tab') continue;
      const node = container.node.current;
      if (!node) continue;
      const tabBar = node.closest(tabBarSelector);
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
      if (data?.kind !== 'editor-tab') return false;
      const node = container.node.current;
      return node != null && hoveredTabBar.contains(node);
    });
    return closestCenter({ ...args, droppableContainers: scoped });
  };
}
