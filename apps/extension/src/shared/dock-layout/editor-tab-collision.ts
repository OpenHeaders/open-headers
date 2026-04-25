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
 *   - For tool-window drags: prefers the droppable directly under the
 *     pointer (specific tab > strip > drop overlay), falling back to
 *     `closestCenter` only when the pointer isn't over any droppable.
 *     `closestCenter` alone misfires when an empty adjacent slot's chip
 *     cluster ends up center-closer than the active's own neighbors —
 *     the cursor would still be over the active's strip, but the active
 *     would jump cross-slot.
 *   - For editor-tab drags: returns no collisions unless the pointer is
 *     inside the host's tab-bar selector, in which case collision is
 *     scoped to editor-tab droppables only — enabling same-leaf reorder
 *     and cross-leaf insert without touching dock drops.
 */

import type { CollisionDetection } from '@dnd-kit/core';
import { closestCenter, pointerWithin } from '@dnd-kit/core';

function toolWindowCollision(args: Parameters<CollisionDetection>[0]): ReturnType<CollisionDetection> {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length === 0) return closestCenter(args);

  // Pointer directly over a specific tab — use it.
  const tw = pointerHits.find((c) => String(c.id).startsWith('tw:'));
  if (tw) return [tw];

  // Pointer over a strip but not on any tab — i.e. in the 2px gap between
  // tabs, or at the strip's empty padding. If the strip has tabs, snap to
  // the closest one so the sortable strategy still gets a `tw:` target and
  // can render reorder feedback. Without this, dragging through a gap
  // would resolve `over` to the strip itself and (a) flash the whole tab
  // group with the cross-slot drop highlight, (b) suppress the
  // verticalListSortingStrategy transforms (overIndex = -1). Only when
  // the strip is genuinely empty do we keep `dock:` as the target — that
  // IS a real cross-slot drop intent.
  const dock = pointerHits.find((c) => String(c.id).startsWith('dock:'));
  if (dock) {
    const slot = String(dock.id).slice('dock:'.length);
    const sameSlotTabs = args.droppableContainers.filter((c) => {
      if (!String(c.id).startsWith('tw:')) return false;
      const data = c.data.current as { fromSlot?: unknown } | undefined;
      return data?.fromSlot === slot;
    });
    if (sameSlotTabs.length > 0) {
      const closest = closestCenter({ ...args, droppableContainers: sameSlotTabs });
      if (closest.length > 0) return closest;
    }
    return [dock];
  }

  return pointerHits;
}

export function makeEditorTabCollisionDetection(tabBarSelector: string): CollisionDetection {
  return (args) => {
    const activeKind = (args.active.data.current as { kind?: unknown } | undefined)?.kind;
    if (activeKind !== 'editor-tab') return toolWindowCollision(args);
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
