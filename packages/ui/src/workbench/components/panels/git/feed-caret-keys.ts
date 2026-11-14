/**
 * feed-caret-keys — which way a key moves the caret of a read-only
 * feed: the keys a text view answers to (arrows by character and line,
 * the platform's word and line-end chords, Home / End, the feed's two
 * ends, Select All), each with Shift to extend the selection instead
 * of moving it. Pure over the key event's facts; a key the feed has
 * no move for answers null and is left to the page.
 */

export type FeedCaretMove =
  /** One step of the platform's own selection walk. */
  | {
      kind: 'step';
      direction: 'forward' | 'backward';
      granularity: 'character' | 'word' | 'line' | 'lineboundary';
      extend: boolean;
    }
  /** To the feed's first or last position. */
  | { kind: 'edge'; edge: 'start' | 'end'; extend: boolean }
  /** Everything the feed holds. */
  | { kind: 'all' };

/** The facts of a key press a move is read from. */
export interface FeedCaretKey {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function feedCaretMove(event: FeedCaretKey, mac: boolean): FeedCaretMove | null {
  const { key, shiftKey: extend, altKey, ctrlKey, metaKey } = event;
  // The platform's command key, and its word key: ⌘ and ⌥ on a Mac, Ctrl for both elsewhere.
  const command = mac ? metaKey && !ctrlKey : ctrlKey && !metaKey;
  const word = mac ? altKey && !ctrlKey && !metaKey : ctrlKey && !altKey && !metaKey;
  const plain = !altKey && !ctrlKey && !metaKey;

  if (key === 'a' || key === 'A') return command && !altKey && !extend ? { kind: 'all' } : null;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const direction = key === 'ArrowLeft' ? 'backward' : 'forward';
    if (plain) return { kind: 'step', direction, granularity: 'character', extend };
    if (word) return { kind: 'step', direction, granularity: 'word', extend };
    if (mac && command && !altKey) return { kind: 'step', direction, granularity: 'lineboundary', extend };
    return null;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    if (plain)
      return { kind: 'step', direction: key === 'ArrowUp' ? 'backward' : 'forward', granularity: 'line', extend };
    if (mac && command && !altKey) return { kind: 'edge', edge: key === 'ArrowUp' ? 'start' : 'end', extend };
    return null;
  }
  if (key === 'Home' || key === 'End') {
    if (plain) {
      return { kind: 'step', direction: key === 'Home' ? 'backward' : 'forward', granularity: 'lineboundary', extend };
    }
    if (command && !altKey) return { kind: 'edge', edge: key === 'Home' ? 'start' : 'end', extend };
    return null;
  }
  return null;
}
