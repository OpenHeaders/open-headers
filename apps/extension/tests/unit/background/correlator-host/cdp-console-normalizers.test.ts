/**
 * `normalizeConsoleApiCalled` / `normalizeExceptionThrown` — raw CDP Runtime
 * console params → host-neutral `ConsoleEntry` (Phase G console capture).
 *
 * Coverage: level bucketing, primitive + preview arg rendering (no
 * `Runtime.getProperties` round-trip), exception message + location
 * resolution, and the stack-top-frame location.
 */

import { describe, expect, it } from 'vitest';
import { normalizeConsoleApiCalled, normalizeExceptionThrown } from '@/background/correlator-host/cdp-normalizers';
import type {
  RawConsoleApiCalled,
  RawExceptionThrown,
  RawRemoteObject,
} from '@/background/correlator-host/cdp-raw-payloads';

function consoleCall(
  type: string,
  args: RawRemoteObject[],
  extra: Partial<RawConsoleApiCalled> = {},
): RawConsoleApiCalled {
  return { type, args, timestamp: 1700, executionContextId: 1, ...extra };
}

describe('normalizeConsoleApiCalled — level bucketing', () => {
  it.each([
    ['log', 'log'],
    ['info', 'info'],
    ['debug', 'debug'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['assert', 'error'],
    ['dir', 'log'],
    ['table', 'log'],
    ['trace', 'log'],
  ] as const)('buckets console type %s → level %s', (type, level) => {
    expect(normalizeConsoleApiCalled(consoleCall(type, [])).level).toBe(level);
  });
});

describe('normalizeConsoleApiCalled — arg rendering', () => {
  it('renders primitives from value, preserving the arg boundary + type', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'hello' },
        { type: 'number', value: 42 },
        { type: 'boolean', value: true },
      ]),
    );
    expect(entry.args).toEqual([
      { type: 'string', text: 'hello' },
      { type: 'number', text: '42' },
      { type: 'boolean', text: 'true' },
    ]);
  });

  it('renders undefined / null / unserializable values', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'undefined' },
        { type: 'object', subtype: 'null', value: null },
        { type: 'number', unserializableValue: 'NaN' },
      ]),
    );
    expect(entry.args.map((a) => a.text)).toEqual(['undefined', 'null', 'NaN']);
  });

  it('renders an object from its inline preview as {k: v}', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        {
          type: 'object',
          description: 'Object',
          preview: {
            type: 'object',
            description: 'Object',
            overflow: false,
            properties: [
              { name: 'id', type: 'number', value: '7' },
              { name: 'name', type: 'string', value: 'openheaders' },
            ],
          },
        },
      ]),
    );
    expect(entry.args[0].text).toBe("{id: 7, name: 'openheaders'}");
  });

  it('renders an array preview as [v, v] and marks overflow with an ellipsis', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        {
          type: 'object',
          subtype: 'array',
          description: 'Array(3)',
          preview: {
            type: 'object',
            subtype: 'array',
            description: 'Array(3)',
            overflow: true,
            properties: [
              { name: '0', type: 'number', value: '1' },
              { name: '1', type: 'number', value: '2' },
            ],
          },
        },
      ]),
    );
    expect(entry.args[0]).toEqual({ type: 'object', subtype: 'array', text: '[1, 2, …]' });
  });

  it('falls back to description when no preview is present', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [{ type: 'function', className: 'Function', description: 'function foo() {}' }]),
    );
    expect(entry.args[0].text).toBe('function foo() {}');
  });

  it('renders an error arg as its description stack, not the {stack, message} preview', () => {
    const stack = 'Error: kaboom\n    at f (https://app.openheaders.io/m.js:3:9)';
    const entry = normalizeConsoleApiCalled(
      consoleCall('error', [
        {
          type: 'object',
          subtype: 'error',
          className: 'Error',
          description: stack,
          preview: {
            type: 'object',
            subtype: 'error',
            description: 'Error: kaboom',
            overflow: false,
            properties: [
              { name: 'stack', type: 'string', value: stack },
              { name: 'message', type: 'string', value: 'kaboom' },
            ],
          },
        },
      ]),
    );
    expect(entry.args[0]).toEqual({ type: 'object', subtype: 'error', text: stack });
  });

  it('lifts the top stack frame into the entry location', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [{ type: 'string', value: 'x' }], {
        stackTrace: {
          callFrames: [
            {
              functionName: 'doThing',
              scriptId: '1',
              url: 'https://app.openheaders.io/m.js',
              lineNumber: 11,
              columnNumber: 4,
            },
          ],
        },
      }),
    );
    expect(entry.url).toBe('https://app.openheaders.io/m.js');
    expect(entry.lineNumber).toBe(11);
    expect(entry.columnNumber).toBe(4);
  });
});

describe('normalizeConsoleApiCalled — format substitution', () => {
  it('substitutes %s / %d value specifiers from the trailing args into one string', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'user %s aged %d' },
        { type: 'string', value: 'Alice' },
        { type: 'number', value: 30 },
      ]),
    );
    expect(entry.args).toEqual([{ type: 'string', text: 'user Alice aged 30' }]);
  });

  it('renders %% as a literal percent', () => {
    const entry = normalizeConsoleApiCalled(consoleCall('log', [{ type: 'string', value: '100%% done' }]));
    expect(entry.args).toEqual([{ type: 'string', text: '100% done' }]);
  });

  it('substitutes %o by rendering the object arg inline', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'data %o' },
        {
          type: 'object',
          description: 'Object',
          preview: {
            type: 'object',
            description: 'Object',
            overflow: false,
            properties: [{ name: 'x', type: 'number', value: '1' }],
          },
        },
      ]),
    );
    expect(entry.args).toEqual([{ type: 'string', text: 'data {x: 1}' }]);
  });

  it('appends args left over after substitution as their own rendered args', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'hi %s' },
        { type: 'string', value: 'there' },
        { type: 'number', value: 7 },
      ]),
    );
    expect(entry.args).toEqual([
      { type: 'string', text: 'hi there' },
      { type: 'number', text: '7' },
    ]);
  });

  it('leaves a value specifier literal when no arg is available to consume', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: '%s %s' },
        { type: 'string', value: 'a' },
      ]),
    );
    expect(entry.args).toEqual([{ type: 'string', text: 'a %s' }]);
  });

  it('consumes a %c style arg and drops the styling (panel-side CSS deferred)', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: '%cTitle' },
        { type: 'string', value: 'color: red' },
      ]),
    );
    expect(entry.args).toEqual([{ type: 'string', text: 'Title' }]);
  });

  it('coerces a non-numeric arg to NaN for %d', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'n=%d' },
        { type: 'string', value: 'abc' },
      ]),
    );
    expect(entry.args).toEqual([{ type: 'string', text: 'n=NaN' }]);
  });

  it('leaves a plain string arg untouched when it carries no specifiers', () => {
    const entry = normalizeConsoleApiCalled(
      consoleCall('log', [
        { type: 'string', value: 'just text' },
        { type: 'string', value: 'next' },
      ]),
    );
    expect(entry.args).toEqual([
      { type: 'string', text: 'just text' },
      { type: 'string', text: 'next' },
    ]);
  });
});

describe('normalizeExceptionThrown', () => {
  it('renders the thrown error description as an error entry with location', () => {
    const raw: RawExceptionThrown = {
      timestamp: 1800,
      exceptionDetails: {
        text: 'Uncaught',
        lineNumber: 4,
        columnNumber: 9,
        url: 'https://app.openheaders.io/a.js',
        exception: { type: 'object', subtype: 'error', className: 'TypeError', description: 'TypeError: boom' },
      },
    };
    const entry = normalizeExceptionThrown(raw);
    expect(entry.source).toBe('exception');
    expect(entry.level).toBe('error');
    expect(entry.args).toEqual([{ type: 'error', subtype: 'error', text: 'TypeError: boom' }]);
    expect(entry.url).toBe('https://app.openheaders.io/a.js');
    expect(entry.lineNumber).toBe(4);
  });

  it('falls back to the text label when no exception value is carried', () => {
    const entry = normalizeExceptionThrown({
      timestamp: 1810,
      exceptionDetails: { text: 'Uncaught (in promise)', lineNumber: 0, columnNumber: 0 },
    });
    expect(entry.args[0].text).toBe('Uncaught (in promise)');
    expect(entry.url).toBeUndefined();
  });

  it('prefers the stack top frame location over the details fields', () => {
    const entry = normalizeExceptionThrown({
      timestamp: 1820,
      exceptionDetails: {
        text: 'Uncaught',
        lineNumber: 4,
        columnNumber: 9,
        url: 'https://app.openheaders.io/details.js',
        stackTrace: {
          callFrames: [
            {
              functionName: 'f',
              scriptId: '2',
              url: 'https://app.openheaders.io/frame.js',
              lineNumber: 20,
              columnNumber: 2,
            },
          ],
        },
      },
    });
    expect(entry.url).toBe('https://app.openheaders.io/frame.js');
    expect(entry.lineNumber).toBe(20);
  });
});
