/**
 * MonacoSuggestOverlay — the variable picker over a Monaco editor: the
 * line input's `SuggestionPopover` through the same body portal,
 * anchor class and placement math, hung from the opening brace's
 * viewport rect that `useMonacoVariableSuggest` tracks. The side is
 * picked when the anchor lands or moves (open, scroll, layout), not
 * on every keystroke, so a narrowing list never flips the popover.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
// The picker's chrome travels with whichever host renders it.
import '../template-input.css';
import { computePopoverCoords } from '../popover-coords';
import SuggestionPopover from '../SuggestionPopover';
import type { SuggestAnchor } from './use-monaco-variable-suggest';

export interface MonacoSuggestOverlayProps {
  anchor: SuggestAnchor | null;
  suggestions: ReadonlyArray<VariableSuggestion>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (suggestion: VariableSuggestion) => void;
}

const MonacoSuggestOverlay: React.FC<MonacoSuggestOverlayProps> = ({
  anchor,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}) => {
  // The row count seeds the side choice at anchor time only — read
  // through a ref so a filter change does not recompute the placement.
  const countRef = useRef(suggestions.length);
  countRef.current = suggestions.length;
  const coords = useMemo(
    () =>
      anchor
        ? computePopoverCoords(
            { left: anchor.left, top: anchor.top, bottom: anchor.top + anchor.height },
            countRef.current,
            window.innerHeight,
          )
        : null,
    [anchor],
  );
  if (!coords) return null;
  return createPortal(
    <div className="oh-template-popover-anchor" style={{ top: coords.top, bottom: coords.bottom, left: coords.left }}>
      <SuggestionPopover
        suggestions={suggestions}
        activeIndex={activeIndex}
        maxListHeight={coords.maxListHeight}
        onActiveIndexChange={onActiveIndexChange}
        onSelect={onSelect}
      />
    </div>,
    document.body,
  );
};

export default MonacoSuggestOverlay;
