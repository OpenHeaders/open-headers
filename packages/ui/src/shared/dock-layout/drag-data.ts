/**
 * Drag-data contracts for the shell's shared DndContext: tool-window
 * drags originating in the dock chrome and editor-tab drags published
 * by the tab strips. `asDragData` narrows dnd-kit's untyped
 * `active.data.current` to this contract.
 */

import type { DockSlot } from './types';

export type ToolWindowDragData<T extends string> = { kind: 'tool-window'; toolWindowId: T; fromSlot: DockSlot };
export type EditorTabDragData = { kind: 'editor-tab'; leafId: string; tabId: string };
export type DragData<T extends string> = ToolWindowDragData<T> | EditorTabDragData;

export function asDragData<T extends string>(current: unknown): DragData<T> | null {
  if (!current || typeof current !== 'object') return null;
  const record = current as { kind?: unknown };
  if (record.kind === 'tool-window' || record.kind === 'editor-tab') return current as DragData<T>;
  return null;
}
