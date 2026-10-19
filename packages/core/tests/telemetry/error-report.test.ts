import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  createPathOwnOriginTest,
  describeThrownError,
  ERROR_REPORT_MAX_COMPONENT_STACK,
  ERROR_REPORT_MAX_FRAMES,
  type ErrorReport,
  type ErrorReportContext,
  ErrorReportSchema,
  fingerprintErrorReport,
  matchErrorTemplate,
  parseComponentStack,
  parseStackFrames,
  serializedErrorReportBytes,
  toErrorReport,
} from '../../src/telemetry';

const OWN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const context: ErrorReportContext = { isOwnOrigin: (url) => url.startsWith(`${OWN}/`) };

describe('matchErrorTemplate (law 3)', () => {
  it('classifies V8 messages onto the engine templates and keeps the identifiers out', () => {
    const cases: Array<[string, string, string]> = [
      ['TypeError', "Cannot read properties of undefined (reading 'x-api-key')", 'cannot-read-property'],
      ['TypeError', "Cannot read property 'foo' of null", 'cannot-read-property'],
      ['TypeError', "Cannot set properties of undefined (setting 'authorization')", 'cannot-set-property'],
      ['TypeError', 'rules.map is not a function', 'not-a-function'],
      ['TypeError', 'foo.bar is not a function or its return value is not iterable', 'not-a-function'],
      ['TypeError', 'Foo is not a constructor', 'not-a-constructor'],
      ['ReferenceError', 'chrome is not defined', 'not-defined'],
      ['TypeError', 'headers is not iterable', 'not-iterable'],
      ['ReferenceError', "Cannot access 'store' before initialization", 'access-before-init'],
      ['TypeError', 'Assignment to constant variable.', 'assign-to-constant'],
      ['RangeError', 'Maximum call stack size exceeded', 'max-call-stack'],
      ['RangeError', 'Invalid array length', 'invalid-array-length'],
      ['SyntaxError', 'Unexpected token u in JSON at position 0', 'json-parse'],
      ['SyntaxError', '"[object Object]" is not valid JSON', 'json-parse'],
      ['SyntaxError', 'Unexpected end of JSON input', 'json-parse'],
      ['RangeError', 'Array buffer allocation failed', 'out-of-memory'],
      ['Error', 'fetch failed: https://openheaders.io/private?token=abc', 'other'],
    ];
    for (const [name, message, template] of cases) {
      expect(matchErrorTemplate(name, message)).toEqual({ errorName: name, template });
    }
  });

  it('classifies SpiderMonkey wordings onto the same templates', () => {
    const cases: Array<[string, string, string]> = [
      ['TypeError', 'can\'t access property "value", header is undefined', 'cannot-read-property'],
      ['TypeError', 'header is undefined', 'cannot-read-property'],
      ['TypeError', 'can\'t assign to property "x" on 1: not an object', 'cannot-set-property'],
      ['TypeError', 'rules.map is not a function', 'not-a-function'],
      ['ReferenceError', 'browser is not defined', 'not-defined'],
      ['TypeError', 'headers is not iterable', 'not-iterable'],
      ['ReferenceError', "can't access lexical declaration 'store' before initialization", 'access-before-init'],
      ['TypeError', 'invalid assignment to const "x"', 'assign-to-constant'],
      ['InternalError', 'too much recursion', 'max-call-stack'],
      ['RangeError', 'invalid array length', 'invalid-array-length'],
      ['SyntaxError', 'JSON.parse: unexpected character at line 1 column 1 of the JSON data', 'json-parse'],
      ['InternalError', 'out of memory', 'out-of-memory'],
    ];
    for (const [name, message, template] of cases) {
      expect(matchErrorTemplate(name, message).template).toBe(template);
    }
    expect(matchErrorTemplate('InternalError', 'too much recursion').errorName).toBe('other');
  });

  it("reads React's production throw as react-minified with its number", () => {
    expect(matchErrorTemplate('Error', 'Minified React error #300; visit https://react.dev/errors/300')).toEqual({
      errorName: 'Error',
      template: 'react-minified',
      reactError: 300,
    });
    expect(matchErrorTemplate('Error', 'Minified React error #0')).toEqual({
      errorName: 'Error',
      template: 'react-minified',
    });
  });

  it("reads a DOMException's spec name as its template, and the built-in SyntaxError as the JS class", () => {
    expect(matchErrorTemplate('AbortError', 'The user aborted a request.')).toEqual({
      errorName: 'DOMException',
      template: 'AbortError',
    });
    expect(matchErrorTemplate('QuotaExceededError', 'exceeded')).toEqual({
      errorName: 'DOMException',
      template: 'QuotaExceededError',
    });
    expect(matchErrorTemplate('SyntaxError', "Failed to execute 'querySelector'")).toEqual({
      errorName: 'SyntaxError',
      template: 'other',
    });
  });

  it('reads an unknown class as other and never passes the name through', () => {
    expect(matchErrorTemplate('MyCustomError', 'anything')).toEqual({ errorName: 'other', template: 'other' });
    expect(matchErrorTemplate('', '')).toEqual({ errorName: 'other', template: 'other' });
  });
});

describe('parseStackFrames (law 4)', () => {
  it('keeps own-origin bundle frames with file, position and function name', () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'x')",
      `    at renderBody (${OWN}/assets/workbench-Bx7Qk2.js:12:3401)`,
      `    at Object.commitRoot (${OWN}/assets/vendor-react.js:9:100)`,
      `    at ${OWN}/assets/main.mjs:1:1`,
      `    at async loadTab (${OWN}/assets/workbench-Bx7Qk2.js:40:7)`,
      `    at new Editor (${OWN}/assets/workbench-Bx7Qk2.js:41:8)`,
      `    at Foo.bar [as baz] (${OWN}/assets/workbench-Bx7Qk2.js:42:9)`,
    ].join('\n');
    expect(parseStackFrames(stack, context)).toEqual([
      { file: 'workbench-Bx7Qk2.js', line: 12, col: 3401, fn: 'renderBody' },
      { file: 'vendor-react.js', line: 9, col: 100, fn: 'commitRoot' },
      { file: 'main.mjs', line: 1, col: 1 },
      { file: 'workbench-Bx7Qk2.js', line: 40, col: 7, fn: 'loadTab' },
      { file: 'workbench-Bx7Qk2.js', line: 41, col: 8, fn: 'Editor' },
      { file: 'workbench-Bx7Qk2.js', line: 42, col: 9, fn: 'bar' },
    ]);
  });

  it('replaces every foreign frame by one external marker and folds runs of them', () => {
    const stack = [
      'Error: boom',
      '    at userHook (https://openheaders.io/userscript.js:1:1)',
      '    at eval (eval at <anonymous> (blob:null/abc:1:1), <anonymous>:1:1)',
      '    at node:internal/process/task_queues:95:5',
      `    at own (${OWN}/assets/workbench.js:5:5)`,
      '    at other (chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/content.js:2:2)',
    ].join('\n');
    expect(parseStackFrames(stack, context)).toEqual([
      { external: true },
      { file: 'workbench.js', line: 5, col: 5, fn: 'own' },
      { external: true },
    ]);
  });

  it('treats a dev-server source frame as external — dev builds group, never name', () => {
    const stack = `    at App (${OWN}/src/App.tsx:10:5)\n    at main (http://localhost:5173/src/main.tsx:1:1)`;
    expect(parseStackFrames(stack, { isOwnOrigin: () => true })).toEqual([{ external: true }]);
  });

  it('strips a query and a hash before reading the basename', () => {
    const stack = `    at fn (${OWN}/assets/workbench.js?v=3#x:1:2)`;
    expect(parseStackFrames(stack, context)).toEqual([{ file: 'workbench.js', line: 1, col: 2, fn: 'fn' }]);
  });

  it('drops the name of a frame whose function is off the identifier grammar', () => {
    const stack = `    at Object.<anonymous> (${OWN}/assets/a.js:1:1)\n    at Array.forEach (<anonymous>)`;
    expect(parseStackFrames(stack, context)).toEqual([{ file: 'a.js', line: 1, col: 1 }]);
  });

  it('parses the SpiderMonkey format with its closure and promise decorations', () => {
    const stack = [
      `renderBody@${OWN}/assets/workbench.js:12:3401`,
      `loadTab/<@${OWN}/assets/workbench.js:40:7`,
      `promise callback*flush@${OWN}/assets/main.mjs:3:3`,
      `async*boot@${OWN}/assets/main.mjs:4:4`,
      `@${OWN}/assets/main.mjs:5:5`,
      'userHook@https://openheaders.io/userscript.js:1:1',
    ].join('\n');
    expect(parseStackFrames(stack, context)).toEqual([
      { file: 'workbench.js', line: 12, col: 3401, fn: 'renderBody' },
      { file: 'workbench.js', line: 40, col: 7, fn: 'loadTab' },
      { file: 'main.mjs', line: 3, col: 3, fn: 'flush' },
      { file: 'main.mjs', line: 4, col: 4, fn: 'boot' },
      { file: 'main.mjs', line: 5, col: 5 },
      { external: true },
    ]);
  });

  it('keeps twenty frames at most and survives an own-origin test that throws', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `    at f${i} (${OWN}/assets/a.js:${i}:1)`);
    expect(parseStackFrames(lines.join('\n'), context)).toHaveLength(ERROR_REPORT_MAX_FRAMES);
    const throwing: ErrorReportContext = {
      isOwnOrigin: () => {
        throw new Error('no');
      },
    };
    expect(parseStackFrames(lines.slice(0, 2).join('\n'), throwing)).toEqual([{ external: true }]);
  });
});

describe('parseComponentStack (law 4)', () => {
  it('reads React 19 and React 18 lines as identifiers, innermost first', () => {
    const react19 = `\n    at RequestEditor (${OWN}/assets/workbench.js:1:1)\n    at div\n    at Suspense\n    at App`;
    expect(parseComponentStack(react19)).toEqual(['RequestEditor', 'div', 'Suspense', 'App']);
    const react18 = '\n    in RequestEditor (created by TabBody)\n    in TabBody\n    in App';
    expect(parseComponentStack(react18)).toEqual(['RequestEditor', 'TabBody', 'App']);
  });

  it('reads a dotted display name as its last segment, skips a line off the grammar, keeps sixteen at most', () => {
    expect(parseComponentStack('\n    at Form.Item\n    at https://openheaders.io/x\n    at 1bad\n    at Ok')).toEqual([
      'Item',
      'Ok',
    ]);
    const many = Array.from({ length: 20 }, (_, i) => `    at C${i}`).join('\n');
    expect(parseComponentStack(many)).toHaveLength(ERROR_REPORT_MAX_COMPONENT_STACK);
  });
});

describe('fingerprintErrorReport', () => {
  const base: Omit<ErrorReport, 'fingerprint' | 'count'> = {
    kind: 'render-error',
    process: 'renderer',
    surface: 'request-edit',
    errorName: 'TypeError',
    template: 'cannot-read-property',
    frames: [
      { file: 'a.js', line: 1, col: 1, fn: 'x' },
      { external: true },
      { file: 'a.js', line: 2, col: 2 },
      { file: 'a.js', line: 3, col: 3 },
      { file: 'a.js', line: 4, col: 4 },
      { file: 'a.js', line: 5, col: 5 },
    ],
    componentStack: ['A'],
  };

  it('is 16 hex chars and stable for the same input', () => {
    const fp = fingerprintErrorReport(base);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprintErrorReport({ ...base })).toBe(fp);
  });

  it('ignores the surface, the component stack and frames past the fourth own one', () => {
    const fp = fingerprintErrorReport(base);
    expect(fingerprintErrorReport({ ...base, surface: 'vault' })).toBe(fp);
    expect(fingerprintErrorReport({ ...base, componentStack: ['B', 'C'] })).toBe(fp);
    expect(fingerprintErrorReport({ ...base, frames: [...base.frames, { file: 'z.js', line: 9, col: 9 }] })).toBe(fp);
    expect(fingerprintErrorReport({ ...base, frames: base.frames.slice(0, 5) })).toBe(fp);
  });

  it('splits by kind, class, template, React number, code, reason and the leading own frames', () => {
    const fp = fingerprintErrorReport(base);
    expect(fingerprintErrorReport({ ...base, kind: 'uncaught-exception' })).not.toBe(fp);
    expect(fingerprintErrorReport({ ...base, errorName: 'RangeError' })).not.toBe(fp);
    expect(fingerprintErrorReport({ ...base, template: 'not-a-function' })).not.toBe(fp);
    expect(fingerprintErrorReport({ ...base, code: 'bridge-call-failed' })).not.toBe(fp);
    expect(fingerprintErrorReport({ ...base, frames: [{ file: 'b.js', line: 1, col: 1, fn: 'x' }] })).not.toBe(fp);
    const react = { ...base, template: 'react-minified' as const };
    expect(fingerprintErrorReport({ ...react, reactError: 300 })).not.toBe(
      fingerprintErrorReport({ ...react, reactError: 301 }),
    );
    const gone = { kind: 'renderer-gone' as const, process: 'renderer' as const, frames: [] };
    expect(fingerprintErrorReport({ ...gone, reason: 'oom' })).not.toBe(
      fingerprintErrorReport({ ...gone, reason: 'killed' }),
    );
  });
});

describe('toErrorReport', () => {
  const message = "Cannot read properties of undefined (reading 'x-secret-header')";
  const stack = `TypeError: ${message}\n    at renderBody (${OWN}/assets/workbench.js:12:3401)\n    at hook (https://openheaders.io/u.js:1:1)`;

  it('builds a report the schema accepts, with count 1 and no character of the message', () => {
    const report = toErrorReport(
      {
        kind: 'render-error',
        process: 'renderer',
        surface: 'request-edit',
        error: { name: 'TypeError', message, stack },
        componentStack: '\n    at RequestEditor\n    at App',
      },
      context,
    );
    expect(v.safeParse(ErrorReportSchema, report).success).toBe(true);
    expect(report).toEqual({
      kind: 'render-error',
      process: 'renderer',
      surface: 'request-edit',
      errorName: 'TypeError',
      template: 'cannot-read-property',
      frames: [{ file: 'workbench.js', line: 12, col: 3401, fn: 'renderBody' }, { external: true }],
      componentStack: ['RequestEditor', 'App'],
      fingerprint: report.fingerprint,
      count: 1,
    });
    expect(JSON.stringify(report)).not.toContain('x-secret-header');
    expect(JSON.stringify(report)).not.toContain('openheaders.io');
  });

  it('builds a gone-process report from the ring-0 facts alone', () => {
    const report = toErrorReport(
      { kind: 'renderer-gone', process: 'renderer', reason: 'crashed', exitCode: 11, reopenCount: 1 },
      context,
    );
    expect(v.safeParse(ErrorReportSchema, report).success).toBe(true);
    expect(report).toMatchObject({
      kind: 'renderer-gone',
      reason: 'crashed',
      exitCode: 11,
      reopenCount: 1,
      frames: [],
    });
    expect(report.errorName).toBeUndefined();
    expect(report.template).toBeUndefined();
  });

  it('carries the React number and our own code, and omits an off-grammar exit code or reopen count', () => {
    const report = toErrorReport(
      {
        kind: 'uncaught-exception',
        process: 'popup',
        error: { name: 'Error', message: 'Minified React error #185', stack: null },
        code: 'bridge-call-failed',
        exitCode: 1.5,
        reopenCount: -1,
      },
      context,
    );
    expect(v.safeParse(ErrorReportSchema, report).success).toBe(true);
    expect(report).toMatchObject({ template: 'react-minified', reactError: 185, code: 'bridge-call-failed' });
    expect(report.exitCode).toBeUndefined();
    expect(report.reopenCount).toBeUndefined();
  });

  it('describes any thrown value the way the UI funnel does — Errors, error-shaped objects, primitives', () => {
    const error = new RangeError('too far');
    expect(describeThrownError(error)).toEqual({ name: 'RangeError', message: 'too far', stack: error.stack ?? null });
    expect(describeThrownError({ name: 'Custom', message: 'm' })).toEqual({
      name: 'Custom',
      message: 'm',
      stack: null,
    });
    expect(describeThrownError('plain')).toEqual({ name: 'Error', message: 'plain', stack: null });
    expect(describeThrownError(undefined)).toEqual({ name: 'Error', message: 'undefined', stack: null });
  });

  it('measures the serialized size in bytes — the law-7 budget unit', () => {
    const report = toErrorReport({ kind: 'unresponsive', process: 'renderer' }, context);
    expect(serializedErrorReportBytes(report)).toBe(JSON.stringify(report).length);
  });
});

describe('createPathOwnOriginTest (law 4 on a Node host)', () => {
  const asar = '/Applications/Open Headers.app/Contents/Resources/app.asar';
  const isOwn = createPathOwnOriginTest({ roots: [asar], origins: ['http://localhost:5173/'] });

  it('owns file URLs and bare paths under a root, and any URL on an origin', () => {
    expect(isOwn(`file://${asar}/out/renderer/assets/index-abc123.js`)).toBe(true);
    expect(isOwn(`${asar}/out/main/index.js`)).toBe(true);
    expect(isOwn('http://localhost:5173/src/renderer/index.tsx')).toBe(true);
  });

  it('reads everything else as foreign — other schemes, other origins, a sibling path', () => {
    expect(isOwn('node:internal/process/task_queues')).toBe(false);
    expect(isOwn('chrome-extension://abcdef/background.js')).toBe(false);
    expect(isOwn('blob:file:///x')).toBe(false);
    expect(isOwn('http://localhost:5174/other.js')).toBe(false);
    expect(isOwn(`${asar}.unpacked/native.js`)).toBe(false);
    expect(isOwn('/Users/someone/scripts/rule.js')).toBe(false);
  });

  it('a Windows root reads its drive-letter frames in either spelling, and a file root owns itself', () => {
    const windows = createPathOwnOriginTest({ roots: ['C:\\Program Files\\Open Headers\\resources\\app.asar'] });
    expect(windows('file:///C:/Program%20Files/Open%20Headers/resources/app.asar/out/renderer/index-1.js')).toBe(true);
    expect(windows('C:\\Program Files\\Open Headers\\resources\\app.asar\\out\\main\\index.js')).toBe(true);
    expect(windows('C:\\Users\\someone\\other.js')).toBe(false);
    const binary = createPathOwnOriginTest({ roots: ['/usr/local/bin/oh.mjs'] });
    expect(binary('file:///usr/local/bin/oh.mjs')).toBe(true);
    expect(binary('/usr/local/bin/other.mjs')).toBe(false);
  });
});
