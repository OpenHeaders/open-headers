/**
 * useWholeCycles — a looping animation that says "at work" runs in
 * WHOLE cycles: it runs from the moment the work begins, and when the
 * work ends it finishes the cycle it is in before it rests. Work that
 * is over in a tenth of a second then reads as one full cycle — a
 * whole turn, a whole pass — instead of a twitch that snaps back.
 *
 * The element that carries the animation hands its
 * `animationiteration` to `onAnimationIteration` (React's prop of the
 * same name), and renders the animation while `running` holds.
 */

import { useState } from 'react';

export interface WholeCycles {
  /** The animation runs: the work is out, or the cycle it ended in is not over yet. */
  running: boolean;
  /** One cycle is over — the animation rests here when the work has ended. */
  onAnimationIteration: () => void;
}

export function useWholeCycles(active: boolean): WholeCycles {
  const [running, setRunning] = useState(active);
  if (active && !running) setRunning(true);
  return {
    running,
    onAnimationIteration: () => {
      if (!active) setRunning(false);
    },
  };
}
