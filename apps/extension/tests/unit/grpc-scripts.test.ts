/**
 * The gRPC result panes' scripts digest — one tally per hook over the
 * call's marks or the settled snapshot's record, in hook order, hooks
 * that never ran absent; a mark's display index is its own capture
 * position with the positional host stamp joined; the record's folds
 * read one run each and the mark cap flag rides through.
 */

import type { ExecutedGrpcScriptMark, ExecutedGrpcScripts } from '@openheaders/core/types';
import {
  digestFromMarks,
  digestFromRecord,
  scriptMarkItems,
} from '@openheaders/ui/workbench/components/grpc-request-editor/grpc-scripts';
import { describe, expect, it } from 'vitest';

const mark = (over: Partial<ExecutedGrpcScriptMark>): ExecutedGrpcScriptMark => ({
  kind: 'script',
  hook: 'grpc-on-message',
  succeeded: true,
  durationMs: 2,
  chain: [{ level: 'request', uid: 'req1', name: 'GetBook', durationMs: 2, succeeded: true }],
  atIndex: 0,
  ...over,
});

describe('scriptMarkItems', () => {
  it('keeps each mark at its capture position and joins the positional stamp when one exists', () => {
    const items = scriptMarkItems([mark({ hook: 'grpc-before-invoke' }), mark({ atIndex: 2 })], [10, 20]);
    expect(items.map((m) => [m.hook, m.atIndex, m.atMs])).toEqual([
      ['grpc-before-invoke', 0, 10],
      ['grpc-on-message', 2, 20],
    ]);
    expect(scriptMarkItems([mark({})]).map((m) => m.atMs)).toEqual([undefined]);
  });
});

describe('digestFromMarks', () => {
  it('tallies runs, failures and levels per hook in hook order', () => {
    const digest = digestFromMarks(
      scriptMarkItems([
        mark({ atIndex: 1 }),
        mark({ hook: 'grpc-before-invoke' }),
        mark({
          atIndex: 2,
          succeeded: false,
          error: { name: 'Error', message: 'boom' },
          chain: [
            { level: 'collection', uid: 'col1', name: 'Library', durationMs: 1, succeeded: false },
            { level: 'request', uid: 'req1', name: 'GetBook', durationMs: 1, succeeded: true },
          ],
        }),
        mark({ hook: 'grpc-after-response', atIndex: 2 }),
      ]),
    );
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed, h.dropped])).toEqual([
      ['grpc-before-invoke', 1, 0, 0],
      ['grpc-on-message', 2, 1, 0],
      ['grpc-after-response', 1, 0, 0],
    ]);
    expect(digest.runs).toBe(4);
    expect(digest.failed).toBe(1);
    expect(digest.hooks[1]?.lastError).toBe('boom');
    expect(digest.hooks[1]?.levels.map((l) => [l.name, l.runs, l.failed])).toEqual([
      ['GetBook', 2, 0],
      ['Library', 1, 1],
    ]);
    expect(digestFromMarks([])).toEqual({ hooks: [], runs: 0, failed: 0, marksCapped: false });
  });
});

describe('digestFromRecord', () => {
  it('reads the folds as one run each and the On message tally, the cap flag through', () => {
    const record: ExecutedGrpcScripts = {
      mode: 'safe',
      beforeInvoke: {
        succeeded: false,
        error: { name: 'Error', message: 'invoke boom' },
        consoleLog: [],
        assertions: [],
        durationMs: 9,
        chain: [{ level: 'collection', uid: 'col1', name: 'Library', durationMs: 9, succeeded: false }],
      },
      onMessage: {
        runs: 1200,
        failed: 2,
        durationMs: 500,
        levels: [{ level: 'request', uid: 'req1', name: 'GetBook', runs: 1200, failed: 2, durationMs: 500 }],
      },
      afterResponse: {
        succeeded: true,
        consoleLog: [],
        assertions: [{ name: 'ok', passed: true }],
        durationMs: 1,
        chain: [{ level: 'request', uid: 'req1', name: 'GetBook', durationMs: 1, succeeded: true }],
      },
      marksCapped: true,
    };
    const digest = digestFromRecord(record);
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed, h.dropped])).toEqual([
      ['grpc-before-invoke', 1, 1, 0],
      ['grpc-on-message', 1200, 2, 0],
      ['grpc-after-response', 1, 0, 0],
    ]);
    expect(digest.hooks[0]?.lastError).toBe('invoke boom');
    expect(digest.runs).toBe(1202);
    expect(digest.marksCapped).toBe(true);
  });
});
