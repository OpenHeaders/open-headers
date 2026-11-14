/**
 * useFeedOccurrences — the selection's other occurrences in a feed,
 * marked: select a word or a run of a line and every other place the
 * feed holds the same text wears a quiet fill, so a flag or a path is
 * found by eye across the commands. The marks are the page's own
 * highlight registry (`CSS.highlights`) over ranges of the feed's text
 * — no row is redrawn and no node is added. A page without the
 * registry marks nothing.
 *
 * A selection is looked up only when it sits on ONE line of the feed
 * and holds more than a character; the text is matched as written.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';
import { FEED_LINE_ATTRIBUTE } from './feed-copy-text';

/** The highlight's name — the stylesheet paints `::highlight(oh-feed-occurrence)`. */
export const FEED_OCCURRENCE_HIGHLIGHT = 'oh-feed-occurrence';

/** A selection settles before the feed is searched — a drag changes it on every pointer move. */
const SETTLE_MS = 60;
const MIN_LENGTH = 2;
/** Marks past this say nothing more about where the text is. */
const MAX_MARKS = 2000;

/** Every place `needle` stands in a line's text, as ranges over its text nodes; matches never overlap. */
function lineOccurrences(line: Element, needle: string): Range[] {
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = '';
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text) || node.data.length === 0) continue;
    nodes.push(node);
    starts.push(text.length);
    text += node.data;
  }
  const ranges: Range[] = [];
  /** The text node holding the character at `index`, and the index within it. */
  const locate = (index: number, endOfMatch: boolean): [Text, number] => {
    let at = nodes.length - 1;
    while (at > 0 && (endOfMatch ? starts[at] >= index : starts[at] > index)) at -= 1;
    return [nodes[at], index - starts[at]];
  };
  for (let found = text.indexOf(needle); found !== -1; found = text.indexOf(needle, found + needle.length)) {
    const range = document.createRange();
    range.setStart(...locate(found, false));
    range.setEnd(...locate(found + needle.length, true));
    ranges.push(range);
  }
  return ranges;
}

/** Every occurrence of `needle` in the feed's lines, in order, up to the cap. */
export function feedOccurrences(content: Element, needle: string): Range[] {
  const ranges: Range[] = [];
  if (needle.length === 0) return ranges;
  for (const line of content.querySelectorAll(`[${FEED_LINE_ATTRIBUTE}]`)) {
    for (const range of lineOccurrences(line, needle)) {
      ranges.push(range);
      if (ranges.length >= MAX_MARKS) return ranges;
    }
  }
  return ranges;
}

/** What a selection looks its occurrences up by: its text when it sits on one line and holds more than a character. */
export function occurrenceNeedle(selection: Selection, content: Element): string | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;
  if (!content.contains(selection.anchorNode) || !content.contains(selection.focusNode)) return null;
  const text = selection.toString();
  if (text.includes('\n') || text.trim().length < MIN_LENGTH) return null;
  return text;
}

const sameRange = (a: Range, b: Range): boolean =>
  a.compareBoundaryPoints(Range.START_TO_START, b) === 0 && a.compareBoundaryPoints(Range.END_TO_END, b) === 0;

export function useFeedOccurrences(contentRef: React.RefObject<HTMLElement | null>): void {
  const schedule = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS) || typeof Highlight === 'undefined') return;
    let timer: number | null = null;
    const clear = (): void => {
      CSS.highlights.delete(FEED_OCCURRENCE_HIGHLIGHT);
    };
    const mark = (): void => {
      timer = null;
      const content = contentRef.current;
      const selection = document.getSelection();
      const needle = content === null || selection === null ? null : occurrenceNeedle(selection, content);
      if (content === null || selection === null || needle === null) {
        clear();
        return;
      }
      const own = selection.getRangeAt(0);
      const others = feedOccurrences(content, needle).filter((range) => !sameRange(range, own));
      if (others.length === 0) clear();
      else CSS.highlights.set(FEED_OCCURRENCE_HIGHLIGHT, new Highlight(...others));
    };
    const settle = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(mark, SETTLE_MS);
    };
    schedule.current = settle;
    document.addEventListener('selectionchange', settle);
    return () => {
      schedule.current = null;
      document.removeEventListener('selectionchange', settle);
      if (timer !== null) window.clearTimeout(timer);
      clear();
    };
  }, [contentRef]);

  // The feed's lines may be other lines after any render of it: what is marked is looked up again.
  useEffect(() => {
    schedule.current?.();
  });
}
