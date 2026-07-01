/**
 * useDockDrag — the shell's tool-window drag-and-drop subsystem: dnd-kit
 * sensors, the drag-preview state machine, and the onDragStart/Over/End/
 * Cancel handlers that resolve a drop into a `moveWindow()` on the layout
 * state machine. Editor-tab drags pass through untouched (tracked only so
 * the host can render a floating preview). Generic over the tool-window ID
 * type; extracted from ShellLayout.
 */

import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  type SensorDescriptor,
  type SensorOptions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';
import { ALL_DOCK_SLOTS } from './constants';
import { asDragData } from './drag-data';
import type { DockSlot } from './types';
import type { DockLayoutApi } from './use-dock-layout';

type DockWindowsMap<T extends string> = Record<DockSlot, T[]>;

export interface DockDragApi<T extends string> {
  sensors: SensorDescriptor<SensorOptions>[];
  draggingId: T | null;
  draggingTabId: string | null;
  dragging: boolean;
  highlightedSlot: DockSlot | null;
  getWindows: (slot: DockSlot) => T[];
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useDockDrag<T extends string>(tl: DockLayoutApi<T>): DockDragApi<T> {
  const [draggingId, setDraggingId] = useState<T | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DockWindowsMap<T> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const getWindows = useCallback(
    (slot: DockSlot): T[] => preview?.[slot] ?? tl.state.docks[slot].windows,
    [preview, tl.state.docks],
  );

  const resolveTarget = useCallback(
    (nodeId: string, source: DockWindowsMap<T>): { slot: DockSlot; index: number } | null => {
      if (nodeId.startsWith('dock:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('drop:')) {
        const slot = nodeId.slice(5) as DockSlot;
        return { slot, index: source[slot].length };
      }
      if (nodeId.startsWith('tw:')) {
        const twId = nodeId.slice(3) as T;
        for (const slot of ALL_DOCK_SLOTS) {
          const idx = source[slot].indexOf(twId);
          if (idx >= 0) return { slot, index: idx };
        }
      }
      return null;
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = asDragData<T>(event.active.data.current);
      if (!data) return;
      if (data.kind === 'editor-tab') {
        setDraggingTabId(data.tabId);
        return;
      }
      setDraggingId(data.toolWindowId);
      const snapshot = {} as DockWindowsMap<T>;
      for (const slot of ALL_DOCK_SLOTS) snapshot[slot] = [...tl.state.docks[slot].windows];
      setPreview(snapshot);
    },
    [tl.state.docks],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const data = asDragData<T>(event.active.data.current);
      if (!data || data.kind === 'editor-tab') return;
      const { active, over } = event;
      if (!over) return;
      setPreview((prev) => {
        if (!prev) return prev;
        const activeLoc = resolveTarget(String(active.id), prev);
        const overLoc = resolveTarget(String(over.id), prev);
        if (!activeLoc || !overLoc) return prev;
        const activeTw = String(active.id).slice(3) as T;

        // Same-slot reorder: do NOT mutate the preview here. The
        // SortableContext + verticalListSortingStrategy already provides
        // stable visual feedback via CSS transforms during the drag; the
        // actual reorder is applied once in handleDragEnd. Mutating the
        // items array mid-drag shifts other tabs under the cursor, which
        // makes the cursor's "closest" target flip on the next frame and
        // cascades into double-jumps and out-of-strip overflow.
        if (activeLoc.slot === overLoc.slot) return prev;

        // Cross-slot move: update the preview so the tab visually
        // "joins" the new slot during the drag.
        const next = { ...prev } as DockWindowsMap<T>;
        next[activeLoc.slot] = prev[activeLoc.slot].filter((id) => id !== activeTw);
        const destList = [...prev[overLoc.slot]];
        const insertIndex = String(over.id).startsWith('dock:') ? destList.length : overLoc.index;
        const clamped = Math.max(0, Math.min(insertIndex, destList.length));
        destList.splice(clamped, 0, activeTw);
        next[overLoc.slot] = destList;
        return next;
      });
    },
    [resolveTarget],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const data = asDragData<T>(event.active.data.current);

      if (data?.kind === 'editor-tab') {
        setDraggingTabId(null);
        return;
      }

      const activeTw = data?.kind === 'tool-window' ? data.toolWindowId : null;
      const finalPreview = preview;
      const overId = event.over?.id ? String(event.over.id) : null;
      setDraggingId(null);
      setPreview(null);
      if (!activeTw || !finalPreview) return;

      // Locate where activeTw lives in the final preview vs current
      // state. If preview moved it to a different slot during drag-over,
      // commit that cross-slot move. If preview matches state (same-slot
      // case — handleDragOver intentionally skipped it), compute the
      // target index from `over` and apply once.
      for (const slot of ALL_DOCK_SLOTS) {
        const previewIdx = finalPreview[slot].indexOf(activeTw);
        if (previewIdx < 0) continue;
        const sourceIdx = tl.state.docks[slot].windows.indexOf(activeTw);

        if (sourceIdx < 0) {
          // Cross-slot: activeTw arrived in this slot via drag-over.
          tl.moveWindow(activeTw, slot, previewIdx);
          return;
        }

        // Same slot — only reorder when dropped onto a specific tab. A
        // drop on `dock:`/`drop:` (strip empty area or drop overlay for
        // the same slot) is a no-op so dragging above/below the list
        // doesn't fling the tab to the end.
        if (overId?.startsWith('tw:')) {
          const overTw = overId.slice(3) as T;
          const overIdx = tl.state.docks[slot].windows.indexOf(overTw);
          if (overIdx >= 0 && overIdx !== sourceIdx) {
            tl.moveWindow(activeTw, slot, overIdx);
          }
        }
        return;
      }
    },
    [preview, tl],
  );

  const handleDragCancel = useCallback(() => {
    setDraggingId(null);
    setDraggingTabId(null);
    setPreview(null);
  }, []);

  const dragging = draggingId !== null;
  const highlightedSlot = useMemo<DockSlot | null>(() => {
    if (!preview || !draggingId) return null;
    for (const slot of ALL_DOCK_SLOTS) {
      if (preview[slot].includes(draggingId)) return slot;
    }
    return null;
  }, [preview, draggingId]);

  return {
    sensors,
    draggingId,
    draggingTabId,
    dragging,
    highlightedSlot,
    getWindows,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
