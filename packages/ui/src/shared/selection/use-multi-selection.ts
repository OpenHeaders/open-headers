/**
 * useMultiSelection — the `MultiSelection` state over an ordered list
 * of visible row ids, with the gestures as handlers: `click` with the
 * pointer event's modifiers, `step` for the keyboard (Shift extends),
 * `contextMenu` for the right-click rule, `clear`. The selection the
 * consumer reads is the stored one narrowed to the current order —
 * a collapse, a filter or a refresh hides members and a hidden row is
 * never selected, in the same render; the narrowing is then stored,
 * so a member hidden once does not come back when its row reappears —
 * and every transition starts from the narrowed selection.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clickModifiers,
  EMPTY_SELECTION,
  type MultiSelection,
  pruneSelection,
  selectOnClick,
  selectOnContextMenu,
  selectOnStep,
} from './multi-selection';

export interface PointerModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface MultiSelectionHandlers {
  /** The live selection — the stored one narrowed to the current order. */
  selection: MultiSelection;
  isSelected: (id: string) => boolean;
  /** A pointer click on `id` — the event's modifiers decide plain / toggle / range. */
  click: (id: string, event: PointerModifiers) => void;
  /** The keyboard landing on `id` — `extend` is Shift held. */
  step: (id: string, extend: boolean) => void;
  /** A right-click on `id` — kept when the row is already selected. */
  contextMenu: (id: string) => void;
  clear: () => void;
}

export function useMultiSelection(order: readonly string[]): MultiSelectionHandlers {
  const [stored, setStored] = useState<MultiSelection>(EMPTY_SELECTION);
  const selection = useMemo(() => pruneSelection(stored, order), [stored, order]);
  useEffect(() => {
    setStored((prev) => pruneSelection(prev, order));
  }, [order]);

  const isSelected = useCallback((id: string) => selection.ids.has(id), [selection]);

  const click = useCallback(
    (id: string, event: PointerModifiers) => {
      const modifiers = clickModifiers(event);
      setStored((prev) => selectOnClick(pruneSelection(prev, order), order, id, modifiers));
    },
    [order],
  );

  const step = useCallback(
    (id: string, extend: boolean) => setStored((prev) => selectOnStep(pruneSelection(prev, order), order, id, extend)),
    [order],
  );

  const contextMenu = useCallback(
    (id: string) => setStored((prev) => selectOnContextMenu(pruneSelection(prev, order), id)),
    [order],
  );

  const clear = useCallback(() => setStored(EMPTY_SELECTION), []);

  return { selection, isSelected, click, step, contextMenu, clear };
}
