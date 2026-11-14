/**
 * useFeedCaret — a caret for a feed that is read, never typed into.
 * The feed's text is the page's own selectable text and the selection
 * is the page's own: a click places it, a drag extends it, and the
 * arrow keys walk it through the platform's selection moves — nothing
 * is editable, so no key, paste or input method can change a row.
 * What the page does not do for text that is not editable is DRAW the
 * caret; this hook does: it follows the selection's moving end and
 * answers its box inside the feed's scroll content. With no selection
 * in the feed the caret stands at the feed's end — the tail line —
 * where a log's next row will land.
 *
 * The feed element takes the handlers (it must be focusable); `content`
 * holds the lines and nothing else, `tail` is its empty last line.
 */

import { isMac } from '@openheaders/ui/shared/platform';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type FeedCaretMove, feedCaretMove } from './feed-caret-keys';
import { feedCopyText } from './feed-copy-text';

/** The caret's box in the feed's scroll-content coordinates. */
export interface FeedCaretBox {
  top: number;
  left: number;
  height: number;
}

export interface FeedCaretRefs {
  /** The scroll container — the element that takes focus and the handlers. */
  feed: React.RefObject<HTMLElement | null>;
  /** The lines' own container. */
  content: React.RefObject<HTMLElement | null>;
  /** The empty last line. */
  tail: React.RefObject<HTMLElement | null>;
}

export interface FeedCaret {
  /** Null while the feed has no line to stand on. */
  box: FeedCaretBox | null;
  /** The feed holds the keyboard — the caret blinks. */
  focused: boolean;
  /** Counts the caret's moves — a move starts the blink over. */
  beat: number;
  handlers: {
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onCopy: (event: React.ClipboardEvent<HTMLElement>) => void;
  };
  /** The copy text of what is selected in the feed; empty when nothing is. */
  selectedText: () => string;
  /** The caret stands at the feed's end (or nowhere in it) — a feed that follows its tail may scroll. */
  atEnd: () => boolean;
  /** Put the caret back at the feed's end, whatever is selected in it. */
  toEnd: () => void;
  /**
   * Hold what is selected in the feed; the answer puts it back. A press outside the feed's text — on a
   * menu over it — takes the page's selection with it.
   */
  hold: () => () => void;
}

/** Room kept between the caret and the feed's edge when a key walks it out of view. */
const REVEAL_MARGIN = 8;

/** Where a caret at this position would be drawn, in viewport coordinates; `lineHeight` serves a position with no text of its own. */
function positionBox(
  node: Node,
  offset: number,
  lineHeight: number,
): { top: number; left: number; height: number } | null {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const [rect] = range.getClientRects();
  if (rect !== undefined) return { top: rect.top, left: rect.left, height: rect.height };
  // Between elements, or on an empty line: the edge of what stands after the position, else of what stands before it.
  if (node instanceof Element) {
    const after = node.childNodes[offset];
    if (after instanceof Element) {
      const box = after.getBoundingClientRect();
      return { top: box.top, left: box.left, height: lineHeight };
    }
    const before = node.childNodes[offset - 1];
    if (before instanceof Element) {
      const box = before.getBoundingClientRect();
      return { top: box.bottom - lineHeight, left: box.right, height: lineHeight };
    }
    const box = node.getBoundingClientRect();
    return { top: box.top, left: box.left, height: lineHeight };
  }
  const parent = node.parentElement;
  if (parent === null) return null;
  const box = parent.getBoundingClientRect();
  return { top: box.top, left: box.left, height: lineHeight };
}

export function useFeedCaret(refs: FeedCaretRefs): FeedCaret {
  const [box, setBox] = useState<FeedCaretBox | null>(null);
  const drawn = useRef<FeedCaretBox | null>(null);
  const [focused, setFocused] = useState(false);
  const [beat, setBeat] = useState(0);
  const { feed: feedRef, content: contentRef, tail: tailRef } = refs;

  /** The page's selection when both its ends are in the feed's lines. */
  const selectionInFeed = useCallback((): Selection | null => {
    const content = contentRef.current;
    const selection = document.getSelection();
    if (content === null || selection === null || selection.rangeCount === 0) return null;
    if (!content.contains(selection.anchorNode) || !content.contains(selection.focusNode)) return null;
    return selection;
  }, [contentRef]);

  const measure = useCallback((): FeedCaretBox | null => {
    const feed = feedRef.current;
    const tail = tailRef.current;
    if (feed === null || tail === null) return null;
    const selection = selectionInFeed();
    const lineHeight = Number.parseFloat(getComputedStyle(tail).lineHeight) || tail.getBoundingClientRect().height;
    const at =
      selection !== null && selection.focusNode !== null
        ? positionBox(selection.focusNode, selection.focusOffset, lineHeight)
        : positionBox(tail, 0, lineHeight);
    if (at === null) return null;
    const host = feed.getBoundingClientRect();
    return {
      top: at.top - host.top + feed.scrollTop - feed.clientTop,
      left: at.left - host.left + feed.scrollLeft - feed.clientLeft,
      height: at.height,
    };
  }, [feedRef, tailRef, selectionInFeed]);

  const follow = useCallback((): void => {
    const next = measure();
    const prev = drawn.current;
    if (prev === next) return;
    if (
      prev !== null &&
      next !== null &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.height === next.height
    ) {
      return;
    }
    drawn.current = next;
    setBox(next);
    setBeat((count) => count + 1);
  }, [measure]);

  // The selection is the page's: every change of it may be the caret's.
  useEffect(() => {
    document.addEventListener('selectionchange', follow);
    return () => document.removeEventListener('selectionchange', follow);
  }, [follow]);

  // The lines may have moved under the caret on any render of the feed — new rows, another wrap, another face —
  // and on any change of its width; a measure that finds the caret where it was sets nothing.
  useLayoutEffect(follow);
  useEffect(() => {
    const feed = feedRef.current;
    if (feed === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(follow);
    observer.observe(feed);
    return () => observer.disconnect();
  }, [feedRef, follow]);

  /** Bring the caret into the feed's view after a key walked it. */
  const reveal = useCallback((): void => {
    const feed = feedRef.current;
    const at = measure();
    if (feed === null || at === null) return;
    if (at.top < feed.scrollTop + REVEAL_MARGIN) feed.scrollTop = Math.max(0, at.top - REVEAL_MARGIN);
    else if (at.top + at.height > feed.scrollTop + feed.clientHeight - REVEAL_MARGIN) {
      feed.scrollTop = at.top + at.height - feed.clientHeight + REVEAL_MARGIN;
    }
    if (at.left < feed.scrollLeft + REVEAL_MARGIN) feed.scrollLeft = Math.max(0, at.left - REVEAL_MARGIN);
    else if (at.left > feed.scrollLeft + feed.clientWidth - REVEAL_MARGIN) {
      feed.scrollLeft = at.left - feed.clientWidth + REVEAL_MARGIN;
    }
  }, [feedRef, measure]);

  const walk = useCallback(
    (move: FeedCaretMove): void => {
      const content = contentRef.current;
      const tail = tailRef.current;
      const selection = document.getSelection();
      if (content === null || tail === null || selection === null) return;
      if (move.kind === 'all') {
        // From the first line's start to the tail: the moving end, and the caret with it, is at the feed's end.
        selection.setBaseAndExtent(content, 0, tail, 0);
        return;
      }
      // A walk starts from the caret, and the caret with no selection in the feed is at its end.
      if (selectionInFeed() === null) selection.collapse(tail, 0);
      const to = (node: Node, offset: number): void => {
        if (move.extend) selection.extend(node, offset);
        else selection.collapse(node, offset);
      };
      if (move.kind === 'edge') {
        if (move.edge === 'start') to(content, 0);
        else to(tail, 0);
        return;
      }
      selection.modify(move.extend ? 'extend' : 'move', move.direction, move.granularity);
      // The platform's walk does not know where the feed ends: a step past either end stops at it.
      if (!content.contains(selection.focusNode)) {
        if (move.direction === 'backward') to(content, 0);
        else to(tail, 0);
      }
    },
    [contentRef, tailRef, selectionInFeed],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      const move = feedCaretMove(event, isMac);
      if (move === null) return;
      event.preventDefault();
      walk(move);
      reveal();
    },
    [walk, reveal],
  );

  const onFocus = useCallback((): void => {
    setFocused(true);
    // Focus that arrives without a place in the feed (the keyboard's) starts at the end; a click places its own next.
    const tail = tailRef.current;
    if (tail !== null && selectionInFeed() === null) document.getSelection()?.collapse(tail, 0);
  }, [tailRef, selectionInFeed]);

  const onBlur = useCallback((): void => setFocused(false), []);

  const selectedText = useCallback((): string => {
    const selection = selectionInFeed();
    if (selection === null || selection.isCollapsed) return '';
    return feedCopyText(selection.getRangeAt(0).cloneContents());
  }, [selectionInFeed]);

  const onCopy = useCallback(
    (event: React.ClipboardEvent<HTMLElement>): void => {
      const text = selectedText();
      if (text === '') return;
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
    },
    [selectedText],
  );

  const atEnd = useCallback((): boolean => {
    const selection = selectionInFeed();
    if (selection === null) return true;
    return selection.isCollapsed && (tailRef.current?.contains(selection.focusNode) ?? false);
  }, [selectionInFeed, tailRef]);

  const toEnd = useCallback((): void => {
    const tail = tailRef.current;
    if (tail !== null && selectionInFeed() !== null) document.getSelection()?.collapse(tail, 0);
  }, [tailRef, selectionInFeed]);

  const hold = useCallback((): (() => void) => {
    const selection = selectionInFeed();
    if (selection === null || selection.anchorNode === null || selection.focusNode === null) return () => undefined;
    const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
    return () => {
      const content = contentRef.current;
      if (content === null || !content.contains(anchorNode) || !content.contains(focusNode)) return;
      document.getSelection()?.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
    };
  }, [contentRef, selectionInFeed]);

  return { box, focused, beat, handlers: { onFocus, onBlur, onKeyDown, onCopy }, selectedText, atEnd, toEnd, hold };
}
