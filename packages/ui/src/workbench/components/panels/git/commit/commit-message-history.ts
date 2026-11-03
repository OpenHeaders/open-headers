/**
 * commit-message-history — the pure model behind the Commit window's
 * Commit Message History popup (the clock, ⌃M). The list is the bound
 * repo's own recent commit subjects, newest first and deduplicated —
 * never an app-side ring, so a rebound or reseeded repo shows its own
 * history and nothing stale from before. The popup walks the list
 * with the arrow keys; the index wraps at both ends.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';

/** How many log entries the popup reads — the reference's ring depth. */
export const COMMIT_MESSAGE_HISTORY_LIMIT = 25;

/** The popup's chord, in the keymap's stored form. */
export const COMMIT_MESSAGE_HISTORY_CHORD = 'ctrl+m';

/** Unique non-empty subjects in log order (newest first). */
export function commitMessageHistory(entries: readonly WorkspaceTreeLogEntryWire[]): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const entry of entries) {
    const subject = entry.subject.trim();
    if (subject.length === 0 || seen.has(subject)) continue;
    seen.add(subject);
    messages.push(subject);
  }
  return messages;
}

/** The next active row after an arrow step; wraps at both ends, -1 stays -1 on an empty list. */
export function stepHistoryIndex(index: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return -1;
  if (index < 0) return delta === 1 ? 0 : count - 1;
  return (index + delta + count) % count;
}

/** The popup's chord on a keydown — Control alone (⌃M on a Mac, Ctrl+M elsewhere), never ⌘. */
export function isCommitMessageHistoryChord(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  return event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'm';
}
