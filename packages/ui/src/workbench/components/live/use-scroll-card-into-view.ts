/**
 * A step card's answer to a consume-once scroll request — the graph's
 * "Edit step" jump (the workflow-graph plan §6.2). Scrolls ONLY the
 * form's own scroll container: `scrollIntoView` walks every scrollable
 * ancestor and drags the workbench shell (tab strip included) along
 * with it. Reports done so the owner clears the request.
 */

import { type RefObject, useEffect, useRef } from 'react';

export function useScrollCardIntoView(
  scrollRequested: boolean,
  onScrollDone: (() => void) | undefined,
): RefObject<HTMLDivElement | null> {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRequested) return;
    const card = cardRef.current;
    if (card) {
      let scroller = card.parentElement;
      while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      if (scroller) {
        const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({
          top: Math.max(0, top - (scroller.clientHeight - card.clientHeight) / 2),
          behavior: 'smooth',
        });
      }
    }
    onScrollDone?.();
  }, [scrollRequested, onScrollDone]);
  return cardRef;
}
