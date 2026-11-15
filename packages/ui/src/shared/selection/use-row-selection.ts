/**
 * useRowSelection — the `RowSelection` state over a list addressed by
 * row number, with the gestures as handlers: `click` with the pointer
 * event's modifiers, `step` for the keyboard (Shift extends),
 * `contextMenu` for the right-click rule, `clear`.
 *
 * A row number means something in ONE list. `list` names it — whatever
 * the consumer holds still while the rows keep their numbers — and the
 * selection made in another list is no selection here, in the same
 * render.
 */

import { useCallback, useMemo, useState } from 'react';
import { clickModifiers } from './multi-selection';
import {
  EMPTY_ROW_SELECTION,
  type RowSelection,
  rowSelected,
  selectRowOnClick,
  selectRowOnContextMenu,
  selectRowOnStep,
} from './row-selection';
import type { PointerModifiers } from './use-multi-selection';

export interface RowSelectionHandlers {
  /** The live selection — none while the stored one is another list's. */
  selection: RowSelection;
  isSelected: (row: number) => boolean;
  /** A pointer click on `row` — the event's modifiers decide plain / toggle / range. */
  click: (row: number, event: PointerModifiers) => void;
  /** The keyboard landing on `row` — `extend` is Shift held. */
  step: (row: number, extend: boolean) => void;
  /** A right-click on `row` — kept when the row is already selected. */
  contextMenu: (row: number) => void;
  clear: () => void;
}

export function useRowSelection(list: unknown): RowSelectionHandlers {
  const [stored, setStored] = useState<{ list: unknown; selection: RowSelection }>({
    list,
    selection: EMPTY_ROW_SELECTION,
  });
  const selection = stored.list === list ? stored.selection : EMPTY_ROW_SELECTION;

  // Every transition starts from this list's selection, and stores its own under this list's name.
  const change = useCallback(
    (next: (selection: RowSelection) => RowSelection) =>
      setStored((prev) => ({ list, selection: next(prev.list === list ? prev.selection : EMPTY_ROW_SELECTION) })),
    [list],
  );

  const isSelected = useCallback((row: number) => rowSelected(selection.ranges, row), [selection]);

  const click = useCallback(
    (row: number, event: PointerModifiers) => {
      const modifiers = clickModifiers(event);
      change((prev) => selectRowOnClick(prev, row, modifiers));
    },
    [change],
  );

  const step = useCallback(
    (row: number, extend: boolean) => change((prev) => selectRowOnStep(prev, row, extend)),
    [change],
  );

  const contextMenu = useCallback((row: number) => change((prev) => selectRowOnContextMenu(prev, row)), [change]);

  const clear = useCallback(() => change(() => EMPTY_ROW_SELECTION), [change]);

  return useMemo(
    () => ({ selection, isSelected, click, step, contextMenu, clear }),
    [selection, isSelected, click, step, contextMenu, clear],
  );
}
