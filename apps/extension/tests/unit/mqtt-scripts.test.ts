/**
 * The MQTT session pane's scripts digest — one tally per hook over the
 * event log's marks or the settled snapshot's record, in hook order,
 * hooks that never ran absent; a mark's display index is its position
 * in the log with the positional host stamp; the record's Before
 * connect fold reads its dial count as the runs and the mark cap flag
 * rides through.
 */

import type { ExecutedMqttScriptMark, ExecutedMqttScripts } from '@openheaders/core/types';
import {
  digestFromMarks,
  digestFromRecord,
  type MqttScriptMarkItem,
  scriptMarksOf,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-scripts';
import type { MqttTimelineItem } from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-timeline-model';
import { describe, expect, it } from 'vitest';

const mark = (over: Partial<ExecutedMqttScriptMark>): ExecutedMqttScriptMark => ({
  kind: 'script',
  hook: 'mqtt-on-message',
  succeeded: true,
  durationMs: 2,
  chain: [{ level: 'request', uid: 'req1', name: 'Probe', durationMs: 2, succeeded: true }],
  ...over,
});

const item = (over: Partial<MqttScriptMarkItem>): MqttScriptMarkItem => ({ ...mark({}), atIndex: 0, ...over });

describe('scriptMarksOf', () => {
  it('keeps the script marks alone with their log position and positional stamp', () => {
    const items: MqttTimelineItem[] = [
      mark({ hook: 'mqtt-before-connect', attempt: 0 }),
      { kind: 'subscribed', grants: [{ topicFilter: 'probe/#', reasonCode: 1 }] },
      {
        kind: 'message',
        direction: 'down',
        topic: 'probe/a',
        payloadBase64: 'eA==',
        qos: 0,
        retain: false,
        dup: false,
      },
      mark({}),
      mark({ hook: 'mqtt-after-close' }),
    ];
    const marks = scriptMarksOf(items, 4, [10, 20, 30, 40]);
    expect(marks.map((m) => [m.hook, m.atIndex, m.atMs])).toEqual([
      ['mqtt-before-connect', 0, 10],
      ['mqtt-on-message', 3, 40],
    ]);
    expect(scriptMarksOf(items, 5).map((m) => [m.atIndex, m.atMs])).toEqual([
      [0, undefined],
      [3, undefined],
      [4, undefined],
    ]);
  });
});

describe('digestFromMarks', () => {
  it('tallies runs, failures, drops and levels per hook in hook order', () => {
    const digest = digestFromMarks([
      item({ hook: 'mqtt-on-message', atIndex: 1 }),
      item({ hook: 'mqtt-before-connect', attempt: 0, atIndex: 0 }),
      item({
        hook: 'mqtt-on-message',
        atIndex: 2,
        succeeded: false,
        error: { name: 'Error', message: 'boom' },
        chain: [
          { level: 'collection', uid: 'col1', name: 'Fleet', durationMs: 1, succeeded: false },
          { level: 'request', uid: 'req1', name: 'Probe', durationMs: 1, succeeded: true },
        ],
      }),
      item({ hook: 'mqtt-before-publish', atIndex: 3, droppedBy: 'Request' }),
    ]);
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed, h.dropped])).toEqual([
      ['mqtt-before-connect', 1, 0, 0],
      ['mqtt-before-publish', 1, 0, 1],
      ['mqtt-on-message', 2, 1, 0],
    ]);
    expect(digest.runs).toBe(4);
    expect(digest.failed).toBe(1);
    expect(digest.hooks[2]?.lastError).toBe('boom');
    expect(digest.hooks[2]?.levels.map((l) => [l.name, l.runs, l.failed])).toEqual([
      ['Probe', 2, 0],
      ['Fleet', 1, 1],
    ]);
    expect(digestFromMarks([])).toEqual({ hooks: [], runs: 0, failed: 0, marksCapped: false });
  });
});

describe('digestFromRecord', () => {
  it('reads the folds and the tallies, the dial count as Before connect runs, the cap flag through', () => {
    const record: ExecutedMqttScripts = {
      mode: 'safe',
      beforeConnect: {
        succeeded: false,
        error: { name: 'Error', message: 'dial boom' },
        consoleLog: [],
        assertions: [],
        durationMs: 9,
        chain: [{ level: 'collection', uid: 'col1', name: 'Fleet', durationMs: 9, succeeded: false }],
        dials: 3,
      },
      beforePublish: {
        runs: 4,
        failed: 0,
        durationMs: 8,
        levels: [{ level: 'request', uid: 'req1', name: 'Probe', runs: 4, failed: 0, durationMs: 8 }],
        dropped: 1,
      },
      onMessage: {
        runs: 1200,
        failed: 2,
        durationMs: 500,
        levels: [{ level: 'request', uid: 'req1', name: 'Probe', runs: 1200, failed: 2, durationMs: 500 }],
      },
      afterClose: {
        succeeded: true,
        consoleLog: [],
        assertions: [{ name: 'clean', passed: true }],
        durationMs: 1,
        chain: [{ level: 'request', uid: 'req1', name: 'Probe', durationMs: 1, succeeded: true }],
      },
      marksCapped: true,
    };
    const digest = digestFromRecord(record);
    expect(digest.hooks.map((h) => [h.hook, h.runs, h.failed, h.dropped])).toEqual([
      ['mqtt-before-connect', 3, 1, 0],
      ['mqtt-before-publish', 4, 0, 1],
      ['mqtt-on-message', 1200, 2, 0],
      ['mqtt-after-close', 1, 0, 0],
    ]);
    expect(digest.hooks[0]?.lastError).toBe('dial boom');
    expect(digest.hooks[0]?.levels).toEqual([
      { level: 'collection', uid: 'col1', name: 'Fleet', runs: 3, failed: 1, durationMs: 9 },
    ]);
    expect(digest.runs).toBe(1208);
    expect(digest.marksCapped).toBe(true);
  });
});
