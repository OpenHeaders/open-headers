/**
 * Right-aligned controls for a two-sided override view's bottom bar:
 * the Diff / full-view mode buttons (when the pair is diffable) and a
 * swap-sides icon button in the corner. One component so Response,
 * Preview, and Payload keep the same right-edge anatomy.
 */

type DualMode = 'diff' | 'split';

interface DualViewControlsProps {
  /** Current mode; omit (with `onModeChange`) to hide the mode buttons
   *  when the pair can't diff (e.g. a binary side, or the Preview tab). */
  mode?: DualMode;
  onModeChange?: (mode: DualMode) => void;
  /** Label of the split-mode button — "Full response" / "Full request". */
  splitModeLabel?: string;
  /** Flip the panes (diff sides / split columns). */
  onSwapSides: () => void;
}

export type { DualMode };

export default function DualViewControls({
  mode,
  onModeChange,
  splitModeLabel = 'Full response',
  onSwapSides,
}: DualViewControlsProps) {
  return (
    <div className="dt-response-toolbar-right">
      {mode && onModeChange && (
        <div className="dt-response-toolbar-modes">
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'diff' ? 'active' : ''}`}
            onClick={() => onModeChange('diff')}
          >
            Diff
          </button>
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'split' ? 'active' : ''}`}
            onClick={() => onModeChange('split')}
          >
            {splitModeLabel}
          </button>
        </div>
      )}
      <button
        type="button"
        className="dt-response-toolbar-btn dt-swap-sides-btn"
        title="Swap sides"
        onClick={onSwapSides}
      >
        <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
          <path
            d="M11 2.5L13.5 5m0 0L11 7.5M13.5 5h-11M5 8.5L2.5 11m0 0L5 13.5M2.5 11h11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
