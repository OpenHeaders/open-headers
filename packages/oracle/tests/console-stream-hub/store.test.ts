import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { describe, expect, it } from 'vitest';

import { ConsoleStore, MAX_CONSOLE_ENTRIES_PER_TAB } from '../../src/console-stream-hub/store';

function entry(text: string, overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text }],
    timestamp: 1700,
    ...overrides,
  };
}

describe('ConsoleStore', () => {
  it('appends per tab and snapshots in arrival order (oldest first)', () => {
    const store = new ConsoleStore();
    store.append(1, entry('a'));
    store.append(1, entry('b'));
    store.append(2, entry('other'));

    expect(store.snapshotTab(1).map((e) => e.args[0].text)).toEqual(['a', 'b']);
    expect(store.snapshotTab(2).map((e) => e.args[0].text)).toEqual(['other']);
  });

  it('returns an empty snapshot for an unknown tab', () => {
    expect(new ConsoleStore().snapshotTab(99)).toEqual([]);
  });

  it('evicts the oldest entry once past the per-tab cap', () => {
    const store = new ConsoleStore();
    for (let i = 0; i < MAX_CONSOLE_ENTRIES_PER_TAB + 5; i++) store.append(1, entry(`m${i}`));

    const snap = store.snapshotTab(1);
    expect(snap).toHaveLength(MAX_CONSOLE_ENTRIES_PER_TAB);
    // First five evicted; the window holds the most recent cap entries.
    expect(snap[0].args[0].text).toBe('m5');
    expect(snap[snap.length - 1].args[0].text).toBe(`m${MAX_CONSOLE_ENTRIES_PER_TAB + 4}`);
  });

  it('forgetTab drops a tab and reports whether state existed', () => {
    const store = new ConsoleStore();
    store.append(1, entry('a'));
    expect(store.forgetTab(1)).toBe(true);
    expect(store.snapshotTab(1)).toEqual([]);
    expect(store.forgetTab(1)).toBe(false);
  });
});
