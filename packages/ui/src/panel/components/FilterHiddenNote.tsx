/**
 * Transient "revealed but filtered" note.
 *
 * A search-result jump always opens its target document; when the
 * matching list row is suppressed by the tool's local filter, the tool
 * shows this strip instead of silently skipping the row highlight or
 * destroying the user's filter. Clearing is an explicit user action —
 * the note never mutates filter state itself.
 *
 * The owner triggers it with a fresh `nonce` per jump; the note
 * auto-dismisses after a few seconds or on ×.
 */

import { useEffect } from 'react';

export interface FilterHiddenHint {
  /** Bumped per trigger so a repeat jump restarts the dismiss timer. */
  nonce: number;
}

interface FilterHiddenNoteProps {
  hint: FilterHiddenHint | null;
  /** What was revealed, e.g. "Revealed request is hidden by the active filter". */
  message: string;
  onClearFilter: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 8000;

export function FilterHiddenNote({ hint, message, onClearFilter, onDismiss }: FilterHiddenNoteProps) {
  useEffect(() => {
    if (hint === null) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [hint, onDismiss]);

  if (hint === null) return null;
  return (
    <div className="dt-filter-hidden-note" role="status">
      <span className="dt-filter-hidden-note-text">{message}</span>
      <button type="button" className="dt-filter-hidden-note-clear" onClick={onClearFilter}>
        Clear filter
      </button>
      <button type="button" className="dt-filter-hidden-note-close" onClick={onDismiss} title="Dismiss">
        ×
      </button>
    </div>
  );
}
