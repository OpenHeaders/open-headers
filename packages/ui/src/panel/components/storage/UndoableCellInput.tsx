/**
 * UndoableCellInput — a grid cell `<input>` with an owned undo/redo
 * stack (⌘Z / ⌘⇧Z / Ctrl+Z / Ctrl+Y), reusing the template-input's
 * pure history factory: coalesced typing bursts, paste as a boundary
 * entry, caret restored with each step. The history is DOM-first (set
 * the value + caret, then sync state) so the controlled re-render
 * can't clobber the caret. Undo/redo chords are consumed here; every
 * other key falls through to the caller's row-level handler
 * (Enter / Escape / ⌘S).
 */

import { isMac } from '@openheaders/ui/shared/platform';
import {
  createEditableHistory,
  type EditableHistory,
} from '@openheaders/ui/workbench/components/template-input/editable-history';
import { useRef } from 'react';

interface UndoableCellInputProps {
  value: string;
  onValueChange: (next: string) => void;
  /** Row-level keys (Enter / Escape / ⌘S) — runs when the event is not
   *  an undo/redo chord. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  'aria-label': string;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function UndoableCellInput({
  value,
  onValueChange,
  onKeyDown,
  'aria-label': ariaLabel,
  placeholder,
  disabled,
  inputRef,
}: UndoableCellInputProps) {
  // Seeded with the mount-time value — remount (via `key`) to reseed
  // when the base arrives late (e.g. a clipped entry's full-value fetch).
  const historyRef = useRef<EditableHistory | null>(null);
  if (!historyRef.current) historyRef.current = createEditableHistory(value);
  const history = historyRef.current;
  const pasteBoundaryRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.currentTarget.value;
    history.record(next, e.currentTarget.selectionStart ?? next.length, { boundary: pasteBoundaryRef.current });
    pasteBoundaryRef.current = false;
    onValueChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const key = e.key.toLowerCase();
    if ((isMac ? e.metaKey : e.ctrlKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault();
      e.stopPropagation();
      const entry = key === 'y' || e.shiftKey ? history.redo() : history.undo();
      if (entry) {
        const input = e.currentTarget;
        input.value = entry.text;
        input.setSelectionRange(entry.caret, entry.caret);
        onValueChange(entry.text);
      }
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="dt-storage-cell-input"
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={() => {
        pasteBoundaryRef.current = true;
      }}
      // Caret-only movement refreshes the current entry's caret so an
      // undo that lands back here restores where the user last was.
      // DOM value, not the prop: during an undo step the prop is still
      // the pre-undo text and recording it would clobber the step.
      onSelect={(e) =>
        history.record(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)
      }
    />
  );
}
