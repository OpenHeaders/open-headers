/**
 * SSE event-wise format plane: detection, the block parser feeding the
 * tree preview / JSONPath filter, and the event-wise Pretty. The probe
 * fixture mirrors `/api/sse` (playground/server/api-binary.ts) verbatim
 * — its dispatch semantics are validated against a real EventSource
 * client per probe discipline. Display-only laws throughout: the wire
 * body is never touched, and Pretty's output is itself valid SSE that
 * round-trips to the same events.
 */

import { isJsonNumber, JsonNumber } from '@openheaders/ui/workbench/components/request-editor/response/lossless-json';
import {
  isSseResponse,
  parseSseEvents,
  prettySseBody,
} from '@openheaders/ui/workbench/components/request-editor/response/response-sse';
import { describe, expect, it } from 'vitest';

const ct = (value: string) => [{ key: 'Content-Type', value }];

/** The `/api/sse` probe body, verbatim. */
const PROBE_BODY = [
  ': openheaders playground sse probe',
  'retry: 15000',
  '',
  'id: 1',
  'event: tick',
  'data: {"seq":1,"resourceVersion":9007199254740993}',
  '',
  'id: 2',
  'data: first plain line',
  'data: second plain line',
  'x-trace: 4bf92f3577b34da6',
  '',
  'event: config',
  'data: {',
  'data:   "kind": "sse-probe",',
  'data:   "host": "api.openheaders.io"',
  'data: }',
  '',
  ': heartbeat',
  '',
  'data',
  'data: joined after an empty data line',
  '',
  '',
].join('\n');

describe('isSseResponse', () => {
  it('recognizes text/event-stream, parameters included', () => {
    expect(isSseResponse(ct('text/event-stream'))).toBe(true);
    expect(isSseResponse(ct('text/event-stream; charset=utf-8'))).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(isSseResponse(ct('application/json'))).toBe(false);
    expect(isSseResponse(ct('text/plain'))).toBe(false);
    expect(isSseResponse([])).toBe(false);
  });
});

describe('parseSseEvents — probe fixture', () => {
  it('mints one record per wire block, comment-only heartbeats included', () => {
    const outcome = parseSseEvents(PROBE_BODY);
    expect(outcome).not.toBeNull();
    expect(outcome?.value).toEqual([
      { retry: 15000, comment: 'openheaders playground sse probe' },
      { event: 'tick', data: { seq: 1, resourceVersion: new JsonNumber('9007199254740993') }, id: '1' },
      { data: 'first plain line\nsecond plain line', id: '2', 'x-trace': '4bf92f3577b34da6' },
      { event: 'config', data: { kind: 'sse-probe', host: 'api.openheaders.io' } },
      { comment: 'heartbeat' },
      { data: '\njoined after an empty data line' },
    ]);
    expect(outcome?.duplicateKeys).toEqual([]);
  });

  it('keeps int64 tokens in JSON data as lossless leaves (F3 law)', () => {
    const outcome = parseSseEvents(PROBE_BODY);
    const tick = outcome?.value[1] as { data: { resourceVersion: unknown } };
    expect(isJsonNumber(tick.data.resourceVersion)).toBe(true);
    expect(String(tick.data.resourceVersion)).toBe('9007199254740993');
  });

  it('never touches the wire body', () => {
    const before = PROBE_BODY;
    parseSseEvents(PROBE_BODY);
    prettySseBody(PROBE_BODY);
    expect(PROBE_BODY).toBe(before);
    expect(PROBE_BODY).toContain('data: {"seq":1,"resourceVersion":9007199254740993}');
  });
});

describe('parseSseEvents — wire grammar', () => {
  it('strips exactly one leading space from a field value', () => {
    expect(parseSseEvents('data:  two spaces\n\n')?.value).toEqual([{ data: ' two spaces' }]);
    expect(parseSseEvents('data:no space\n\n')?.value).toEqual([{ data: 'no space' }]);
  });

  it('treats a line without a colon as a field with an empty value', () => {
    expect(parseSseEvents('data\ndata: x\n\n')?.value).toEqual([{ data: '\nx' }]);
  });

  it('accepts \\r\\n and \\r line endings and strips a leading BOM', () => {
    expect(parseSseEvents('\uFEFFevent: a\r\ndata: 1\r\rdata: 2\r\n\r\n')?.value).toEqual([
      { event: 'a', data: 1 },
      { data: 2 },
    ]);
  });

  it('last event/id/retry wins within a block; data joins in order', () => {
    expect(parseSseEvents('event: a\nevent: b\nid: 1\nid: 2\ndata: x\ndata: y\n\n')?.value).toEqual([
      { event: 'b', data: 'x\ny', id: '2' },
    ]);
  });

  it('retry stays a number only for safe digit-only values', () => {
    expect(parseSseEvents('retry: 3000\n\n')?.value).toEqual([{ retry: 3000 }]);
    expect(parseSseEvents('retry: soon\n\n')?.value).toEqual([{ retry: 'soon' }]);
    expect(parseSseEvents('retry: 99999999999999999999\n\n')?.value).toEqual([{ retry: '99999999999999999999' }]);
  });

  it('groups comment lines per block and strips their one leading space', () => {
    expect(parseSseEvents(': first\n:second\ndata: x\n\n')?.value).toEqual([{ data: 'x', comment: 'first\nsecond' }]);
  });

  it('keeps unknown fields visible under their own key, occurrences joined', () => {
    expect(parseSseEvents('x-trace: a\nx-trace: b\ndata: 1\n\n')?.value).toEqual([{ data: 1, 'x-trace': 'a\nb' }]);
  });

  it('a wire field named __proto__ becomes an own property, never the prototype', () => {
    const record = parseSseEvents('__proto__: attack\ndata: 1\n\n')?.value[0] as Record<string, unknown>;
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(record, '__proto__')?.value).toBe('attack');
  });

  it('reports duplicate JSON keys across events, deduplicated', () => {
    const outcome = parseSseEvents('data: {"a":1,"a":2}\n\ndata: {"a":3,"a":4,"b":1,"b":2}\n\n');
    expect(outcome?.duplicateKeys).toEqual(['a', 'b']);
  });

  it('a trailing block the capture cut before its blank line still records', () => {
    expect(parseSseEvents('event: tick\ndata: {"seq":9')?.value).toEqual([{ event: 'tick', data: '{"seq":9' }]);
  });

  it('returns null when the body yields no blocks', () => {
    expect(parseSseEvents('')).toBeNull();
    expect(parseSseEvents('\n\n\n')).toBeNull();
  });
});

describe('prettySseBody', () => {
  it('re-prints a JSON data payload as data:-prefixed re-indented lines', () => {
    expect(prettySseBody('event: tick\ndata: {"seq":1,"ok":true}\n\n')).toBe(
      ['event: tick', 'data: {', 'data:   "seq": 1,', 'data:   "ok": true', 'data: }', ''].join('\n'),
    );
  });

  it('folds a JSON object split across data lines into one payload at the first line', () => {
    expect(prettySseBody('data: {\ndata: "a":1}\n\n')).toBe(['data: {', 'data:   "a": 1', 'data: }', ''].join('\n'));
  });

  it('keeps non-JSON data lines and every other line verbatim', () => {
    const body = ': open\nevent: log\ndata: first\ndata: second\nx-trace: t\n\n';
    expect(prettySseBody(body)).toBe(': open\nevent: log\ndata: first\ndata: second\nx-trace: t\n');
  });

  it('preserves int64 tokens verbatim (F3 law)', () => {
    expect(prettySseBody('data: {"v":9007199254740993}\n\n')).toContain('data:   "v": 9007199254740993');
  });

  it('separates blocks with exactly one blank line', () => {
    expect(prettySseBody('data: 1\n\n\n\ndata: 2\n\n')).toBe('data: 1\n\ndata: 2\n');
  });

  it('round-trips: the pretty text parses to the same events as the wire', () => {
    const wire = parseSseEvents(PROBE_BODY);
    const pretty = parseSseEvents(prettySseBody(PROBE_BODY));
    expect(pretty?.value).toEqual(wire?.value);
    expect(pretty?.duplicateKeys).toEqual(wire?.duplicateKeys);
  });

  it('returns the body unchanged when no blocks parse', () => {
    expect(prettySseBody('')).toBe('');
  });
});
