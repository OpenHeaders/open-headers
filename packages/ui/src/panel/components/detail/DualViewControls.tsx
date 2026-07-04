/**
 * Controls for a two-sided override view: the Diff / full-view mode
 * buttons (bottom bar, right-aligned) and the swap-sides icon button
 * (rides the caption row, next to the pane titles it flips). Shared by
 * the Response, Preview, and Payload tabs so all dual views keep the
 * same anatomy.
 */

type DualMode = 'diff' | 'split';

interface DualModeButtonsProps {
  mode: DualMode;
  onModeChange: (mode: DualMode) => void;
  /** Label of the split-mode button — "Full response" / "Full request". */
  splitModeLabel?: string;
}

export type { DualMode };

export function DualModeButtons({ mode, onModeChange, splitModeLabel = 'Full response' }: DualModeButtonsProps) {
  return (
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
  );
}

export function SwapSidesButton({ onSwap }: { onSwap: () => void }) {
  return (
    <button
      type="button"
      className="dt-response-toolbar-btn dt-swap-sides-btn"
      title="Swap sides"
      onClick={onSwap}
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
  );
}
