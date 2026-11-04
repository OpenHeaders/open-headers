/**
 * useMultiSelection — the `MultiSelection` state over an ordered list
 * of visible row ids, with the gestures as handlers: `click` with the
 * pointer event's modifiers, `step` for the keyboard (Shift extends),
 * `contextMenu` for the right-click rule, `clear`. The selection is
 * pruned whenever the order changes — a collapse, a filter or a
 * refresh hides members, and a hidden row is never kept selected.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  clickModifiers,
  EMPTY_SELECTION,
  type MultiSelection,
  pruneSelection,
  selectOnClick,
  selectOnContextMenu,
  selectOnStep,
} from './multi-selection';

export interface MultiSelectionHandlers {
  selection: MultiSelection;
  isSelected: (id: string) => boolean;
  /** A pointer click on `id` — the event's modifiers decide plain / toggle / range. */
  click: (id: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => void;
  /** The keyboard landing on `id` — `extend` is Shift held. */
  step: (id: string, extend: boolean) => void;
  /** A right-click on `id` — kept when the row is already selected. */
  contextMenu: (id: string) => void;
  clear: () => void;
}

export function useMultiSelection(order: readonly string[]): MultiSelectionHandlers {
  const [selection, setSelection] = useState<MultiSelection>(EMPTY_SELECTION);

  useEffect(() => {
    setSelection((prev) => pruneSelection(prev, order));
  }, [order]);

  const isSelected = useCallback((id: string) => selection.ids.has(id), [selection]);

  const click = useCallback(
    (id: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
      const modifiers = clickModifiers(event);
      setSelection((prev) => selectOnClick(prev, order, id, modifiers));
    },
    [order],
  );

  const step = useCallback(
    (id: string, extend: boolean) => setSelection((prev) => selectOnStep(prev, order, id, extend)),
    [order],
  );

  const contextMenu = useCallback((id: string) => setSelection((prev) => selectOnContextMenu(prev, id)), []);

  const clear = useCallback(() => setSelection(EMPTY_SELECTION), []);

  return { selection, isSelected, click, step, contextMenu, clear };
}
