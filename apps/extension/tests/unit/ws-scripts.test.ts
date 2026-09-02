/**
 * The session pane's scripts digest — one tally per hook over the live
 * feed's marks or the settled snapshot's record, in hook order, hooks
 * that never ran absent; the record's Before connect fold reads its
 * dial count as the runs and the mark cap flag rides through.
 */

import type { ExecutedWsScripts } from '@openheaders/core/types';
import {
  digestFromMarks,
  digestFromRecord,
  scriptMarksOf,
  type WsScriptMarkItem,
} from '@openheaders/ui/workbench/components/websocket-request-editor/ws-scripts';
import { describe, expect, it } from 'vitest';

const mark = (over: Partial<WsScriptMarkItem>): WsScriptMarkItem => ({
  kind: 'script',
  hook: 'ws-on-message',
  succeeded: true,
  durationMs: 2,
  chain: [{ level: 'request', uid: 'req1', name: 'Charge', durationMs: 2, succeeded: true }],
  atIndex: 0,
  ...over,
});

describe('digestFromMarks', () => {
  it('tallies runs, failures, drops and levels per hook in hook order', () => {
    const digest = digestFromMarks([
      mark({ hook: 'ws-on-message', atIndex: 1 }),
      mark({ hook: 'ws-before-connect', attempt: 0, atIndex: 0 }),
      mark({
        hook: 'ws-on-message',
        atIndex: 2,
        succeeded: false,
        error: { name: 'Error', message: 'boom' },
        chain: [
          { level: 'collection', uid: 'col1', name: 'Payments', durationMs: 1, succeeded: false },
          { level: 'request', uid: 'req1', name: 'Charge', durationMs: 1, succeeded: true },
        ],
      }),
      mark({ hook: 'ws-before-send', atIndex: 3, droppedBy: 'Request' }),
    ]);
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed, h.dropped])).toEqual([
      ['ws-before-connect', 1, 0, 0],
      ['ws-before-send', 1, 0, 1],
      ['ws-on-message', 2, 1, 0],
    ]);
    expect(digest.runs).toBe(4);
    expect(digest.failed).toBe(1);
    const onMessage = digest.hooks[2];
    expect(onMessage?.lastError).toBe('boom');
    expect(onMessage?.levels.map((l) => [l.name, l.runs, l.failed])).toEqual([
      ['Charge', 2, 0],
      ['Payments', 1, 1],
    ]);
    expect(digest.marksCapped).toBe(false);
  });

  it('is empty without marks', () => {
    expect(digestFromMarks([])).toEqual({ hooks: [], runs: 0, failed: 0, marksCapped: false });
  });
});

describe('digestFromRecord', () => {
  it('reads the folds and the tallies, the dial count as Before connect runs, the cap flag through', () => {
    const record: ExecutedWsScripts = {
      mode: 'safe',
      beforeConnect: {
        succeeded: false,
        error: { name: 'Error', message: 'dial boom' },
        consoleLog: [],
        assertions: [],
        durationMs: 9,
        chain: [{ level: 'collection', uid: 'col1', name: 'Payments', durationMs: 9, succeeded: false }],
        dials: 3,
      },
      onMessage: {
        runs: 1200,
        failed: 2,
        durationMs: 500,
        levels: [{ level: 'request', uid: 'req1', name: 'Charge', runs: 1200, failed: 2, durationMs: 500 }],
      },
      afterClose: {
        succeeded: true,
        consoleLog: [],
        assertions: [{ name: 'clean', passed: true }],
        durationMs: 1,
        chain: [{ level: 'request', uid: 'req1', name: 'Charge', durationMs: 1, succeeded: true }],
      },
      marksCapped: true,
    };
    const digest = digestFromRecord(record);
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed])).toEqual([
      ['ws-before-connect', 3, 1],
      ['ws-on-message', 1200, 2],
      ['ws-after-close', 1, 0],
    ]);
    expect(digest.hooks[0]?.lastError).toBe('dial boom');
    expect(digest.hooks[0]?.levels).toEqual([
      { level: 'collection', uid: 'col1', name: 'Payments', runs: 3, failed: 1, durationMs: 9 },
    ]);
    expect(digest.runs).toBe(1204);
    expect(digest.marksCapped).toBe(true);
  });
});

describe('scriptMarksOf', () => {
  it('keeps the script marks alone, in order', () => {
    const items = [
      { kind: 'lost' as const, close: null, atIndex: 0 },
      mark({ atIndex: 1 }),
      { kind: 'reconnected' as const, attempt: 1, protocol: '', extensions: '', atIndex: 1 },
      mark({ atIndex: 2 }),
    ];
    expect(scriptMarksOf(items).map((m) => m.atIndex)).toEqual([1, 2]);
  });
});
