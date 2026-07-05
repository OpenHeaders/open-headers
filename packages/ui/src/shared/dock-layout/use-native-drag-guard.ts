/**
 * useNativeDragGuard — suppresses accidental native HTML5 drags inside
 * the shell.
 *
 * Double-clicking an Allotment sash (the snap-to-preferred gesture)
 * leaves a browser text selection behind: the sash is non-selectable,
 * so the double-click's word-selection walks into the adjacent pane and
 * selects whatever content sits next to the divider. The next
 * press-and-hold on the sash then lands inside that live selection and
 * the browser starts a native selection drag — a ghost image of the
 * selected content flies from its document position to the cursor
 * instead of resizing the pane. The same trap exists around any other
 * double-click-to-reset affordance (grid column resize handles).
 *
 * All intentional drag-and-drop in the shell is dnd-kit, which drives
 * pointer events and never native dragstart, so cancelling unwanted
 * dragstarts at the shell root is safe. Elements that legitimately use
 * the native drag pipeline stay exempt: anything opting in with
 * draggable="true", and editable surfaces where dragging selected text
 * is a platform affordance.
 */

import { type RefObject, useEffect } from 'react';

const NATIVE_DRAG_EXEMPT = '[draggable="true"], input, textarea, [contenteditable="true"], .monaco-editor';

export function useNativeDragGuard(shellRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const onDragStart = (e: DragEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(NATIVE_DRAG_EXEMPT)) return;
      e.preventDefault();
    };

    // A sash double-click (and the triple-click a quick drag-after-
    // double-click registers as) must not run the browser's multi-click
    // selection at all — that's what seeds the ghost-drag selection.
    const onMouseDown = (e: MouseEvent) => {
      if (e.detail < 2) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('.sash')) e.preventDefault();
    };

    shell.addEventListener('dragstart', onDragStart, true);
    shell.addEventListener('mousedown', onMouseDown, true);
    return () => {
      shell.removeEventListener('dragstart', onDragStart, true);
      shell.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [shellRef]);
}
