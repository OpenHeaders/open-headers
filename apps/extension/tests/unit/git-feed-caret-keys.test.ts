/**
 * The feed caret's key map: arrows walk by character and line, the
 * platform's word and line-end chords by word and to the line's ends,
 * Home / End to the line's ends and with the command key to the feed's,
 * Select All takes the feed, Shift extends instead of moving, and a
 * key the feed has no move for is left to the page.
 */

import { type FeedCaretKey, feedCaretMove } from '@openheaders/ui/workbench/components/panels/git/feed-caret-keys';
import { describe, expect, it } from 'vitest';

const press = (key: string, mods: Partial<Omit<FeedCaretKey, 'key'>> = {}): FeedCaretKey => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('feedCaretMove', () => {
  it('walks by character and by line on plain arrows, extending with Shift', () => {
    for (const mac of [true, false]) {
      expect(feedCaretMove(press('ArrowRight'), mac)).toEqual({
        kind: 'step',
        direction: 'forward',
        granularity: 'character',
        extend: false,
      });
      expect(feedCaretMove(press('ArrowLeft', { shiftKey: true }), mac)).toEqual({
        kind: 'step',
        direction: 'backward',
        granularity: 'character',
        extend: true,
      });
      expect(feedCaretMove(press('ArrowUp'), mac)).toEqual({
        kind: 'step',
        direction: 'backward',
        granularity: 'line',
        extend: false,
      });
      expect(feedCaretMove(press('ArrowDown', { shiftKey: true }), mac)).toEqual({
        kind: 'step',
        direction: 'forward',
        granularity: 'line',
        extend: true,
      });
    }
  });

  it('on a Mac: Option walks by word, Command to the line’s ends and the feed’s', () => {
    expect(feedCaretMove(press('ArrowRight', { altKey: true }), true)).toMatchObject({ granularity: 'word' });
    expect(feedCaretMove(press('ArrowLeft', { metaKey: true, shiftKey: true }), true)).toEqual({
      kind: 'step',
      direction: 'backward',
      granularity: 'lineboundary',
      extend: true,
    });
    expect(feedCaretMove(press('ArrowUp', { metaKey: true }), true)).toEqual({
      kind: 'edge',
      edge: 'start',
      extend: false,
    });
    expect(feedCaretMove(press('ArrowDown', { metaKey: true, shiftKey: true }), true)).toEqual({
      kind: 'edge',
      edge: 'end',
      extend: true,
    });
    expect(feedCaretMove(press('a', { metaKey: true }), true)).toEqual({ kind: 'all' });
    // Control is not the Mac's command key.
    expect(feedCaretMove(press('a', { ctrlKey: true }), true)).toBeNull();
    expect(feedCaretMove(press('ArrowRight', { ctrlKey: true }), true)).toBeNull();
  });

  it('elsewhere: Control walks by word, takes the feed’s ends with Home / End, and selects all', () => {
    expect(feedCaretMove(press('ArrowLeft', { ctrlKey: true }), false)).toMatchObject({
      granularity: 'word',
      direction: 'backward',
    });
    expect(feedCaretMove(press('Home', { ctrlKey: true }), false)).toEqual({
      kind: 'edge',
      edge: 'start',
      extend: false,
    });
    expect(feedCaretMove(press('End', { ctrlKey: true, shiftKey: true }), false)).toEqual({
      kind: 'edge',
      edge: 'end',
      extend: true,
    });
    expect(feedCaretMove(press('a', { ctrlKey: true }), false)).toEqual({ kind: 'all' });
    expect(feedCaretMove(press('ArrowRight', { metaKey: true }), false)).toBeNull();
    expect(feedCaretMove(press('ArrowUp', { ctrlKey: true }), false)).toBeNull();
  });

  it('Home and End go to the line’s ends on every platform', () => {
    for (const mac of [true, false]) {
      expect(feedCaretMove(press('Home'), mac)).toMatchObject({ direction: 'backward', granularity: 'lineboundary' });
      expect(feedCaretMove(press('End', { shiftKey: true }), mac)).toMatchObject({
        direction: 'forward',
        granularity: 'lineboundary',
        extend: true,
      });
    }
  });

  it('leaves every other key to the page — a letter, Enter, a copy chord, a plain a', () => {
    for (const mac of [true, false]) {
      expect(feedCaretMove(press('a'), mac)).toBeNull();
      expect(feedCaretMove(press('x'), mac)).toBeNull();
      expect(feedCaretMove(press('Enter'), mac)).toBeNull();
      expect(feedCaretMove(press('c', { metaKey: true }), mac)).toBeNull();
      expect(feedCaretMove(press('c', { ctrlKey: true }), mac)).toBeNull();
      expect(feedCaretMove(press('PageDown'), mac)).toBeNull();
    }
  });
});
