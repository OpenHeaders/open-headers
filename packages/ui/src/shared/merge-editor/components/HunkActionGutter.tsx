/**
 * Result-pane action gutter — the JetBrains-shape affordance row.
 *
 * Two of these flank the result editor (one per side: left = theirs
 * decision, right = mine decision). Each row aligns to a hunk's start
 * line via `markers.top` (pixel-y in the result editor's viewport).
 *
 * Layout per row, OUTWARD → INWARD (the directional arrow sits next
 * to the pane it pulls from):
 *   left:  [✕] [▶ / ↘]
 *   right: [◀ / ↙] [✕]
 *
 * The arrow flips visual when the OTHER side is already accepted:
 *   left  + mine accepted   → ↘ (also append theirs after mine)
 *   right + theirs accepted → ↙ (also append mine after theirs)
 *
 * No revert button — once a side is decided, its slot disappears.
 * Reverting goes through the pick-state undo stack (Cmd/Ctrl+K U / Z
 * once we wire the chord, or via a toolbar button).
 */

import type React from 'react';
import type { HunkActionMarker } from '../monaco/use-hunk-action-markers';
import { type ClickAction, type ClickSlot, PENDING_HUNK, type PickStateController } from '../use-hunk-pick-state';
import './hunk-action-gutter.css';

export interface HunkActionGutterProps {
  side: ClickSlot;
  markers: readonly HunkActionMarker[];
  controller: PickStateController;
  /** Bumped whenever the controller's state changes so the gutter
   *  re-renders icon variants without reaching into the controller's
   *  internal store. */
  stateRev: number;
}

function leftArrow(theirsAccepted: boolean, mineAccepted: boolean): string {
  if (theirsAccepted) return '';
  return mineAccepted ? '↘' : '▶';
}

function rightArrow(theirsAccepted: boolean, mineAccepted: boolean): string {
  if (mineAccepted) return '';
  return theirsAccepted ? '↙' : '◀';
}

const HunkActionGutter: React.FC<HunkActionGutterProps> = ({ side, markers, controller, stateRev }) => {
  // Reading stateRev forces the closure to recompute on each tick;
  // explicitly dereference to avoid the unused-prop lint without
  // changing the underlying React contract.
  void stateRev;
  return (
    <div className="oh-merge__action-gutter" data-side={side}>
      {markers.map((m) => {
        const state = controller.get(m.hunkId) ?? PENDING_HUNK;
        const showLeft = side === 'left' && state.theirs === 'pending';
        const showRight = side === 'right' && state.mine === 'pending';
        if (!showLeft && !showRight) return null;
        const arrowChar =
          side === 'left'
            ? leftArrow(state.theirs === 'accepted', state.mine === 'accepted')
            : rightArrow(state.theirs === 'accepted', state.mine === 'accepted');
        const arrowTitle =
          side === 'left'
            ? state.mine === 'accepted'
              ? 'Also append incoming after current'
              : 'Accept incoming'
            : state.theirs === 'accepted'
              ? 'Also append current after incoming'
              : 'Accept current';
        const dispatchClick = (action: ClickAction): void => {
          controller.dispatch({ hunkId: m.hunkId, slot: side, action });
        };
        return (
          <div key={`${side}-${m.hunkId}`} className="oh-merge__action-row" style={{ top: m.top }}>
            {side === 'left' ? (
              <>
                <button
                  type="button"
                  className="oh-merge__action-btn oh-merge__action-btn-x"
                  title="Skip incoming for this hunk"
                  onClick={() => dispatchClick('x')}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="oh-merge__action-btn oh-merge__action-btn-arrow"
                  title={arrowTitle}
                  onClick={() => dispatchClick('arrow')}
                >
                  {arrowChar}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="oh-merge__action-btn oh-merge__action-btn-arrow"
                  title={arrowTitle}
                  onClick={() => dispatchClick('arrow')}
                >
                  {arrowChar}
                </button>
                <button
                  type="button"
                  className="oh-merge__action-btn oh-merge__action-btn-x"
                  title="Skip current for this hunk"
                  onClick={() => dispatchClick('x')}
                >
                  ×
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HunkActionGutter;
