/**
 * Console → SearchDoc projection.
 *
 * The console buffer becomes ONE searchable doc — one message per
 * line (`[level] text @ file:line`), so a match's line number is the
 * message's position in the log and the group's target focuses the
 * Console tool window. Locations ride along in the line text so a
 * file/URL query finds console rows too.
 *
 * The version token is the doc's own text: the buffer only appends, so
 * an unchanged log `Object.is`-compares equal and skips the re-ship.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { SearchDoc, SearchDocInput } from './search-doc';

const CONSOLE_DOC_ID = 'console';

function entryLine(entry: ConsoleEntry): string {
  const text = entry.args.map((a) => a.text).join(' ');
  const location =
    entry.url != null && entry.url !== ''
      ? ` @ ${entry.url}${entry.lineNumber != null ? `:${entry.lineNumber + 1}` : ''}`
      : '';
  return `[${entry.level}] ${text}${location}`;
}

export function consoleDocInputs(entries: readonly ConsoleEntry[]): SearchDocInput[] {
  if (entries.length === 0) return [];
  const text = entries.map(entryLine).join('\n');
  const doc: SearchDoc = {
    docId: CONSOLE_DOC_ID,
    source: 'console',
    target: { kind: 'console' },
    displayId: null,
    filename: 'Console',
    origin: '',
    timestamp: entries[entries.length - 1].timestamp,
    sections: [{ name: 'Messages', text }],
  };
  return [{ docId: CONSOLE_DOC_ID, source: 'console', version: text, build: () => doc }];
}
