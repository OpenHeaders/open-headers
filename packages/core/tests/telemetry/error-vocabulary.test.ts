import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  ERROR_REPORT_BUNDLE_PATTERN,
  ERROR_REPORT_DOM_EXCEPTION_NAMES,
  ERROR_REPORT_ENGINE_TEMPLATES,
  ERROR_REPORT_FINGERPRINT_PATTERN,
  ERROR_REPORT_IDENTIFIER_PATTERN,
  ERROR_REPORT_MAX_PER_ENVELOPE,
  type ErrorReport,
  type ErrorReportEnvelope,
  ErrorReportEnvelopeSchema,
  ErrorReportSchema,
  ErrorReportSurfaceSchema,
  ErrorReportTemplateSchema,
} from '../../src/telemetry';

const SESSION_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';

function makeReport(overrides: Partial<ErrorReport> = {}): ErrorReport {
  return {
    kind: 'render-error',
    process: 'renderer',
    surface: 'request-edit',
    errorName: 'TypeError',
    template: 'cannot-read-property',
    frames: [{ file: 'workbench-Bx7Qk2.js', line: 12, col: 3401, fn: 'renderBody' }, { external: true }],
    componentStack: ['RequestEditor', 'TabBody', 'App'],
    fingerprint: '0123456789abcdef',
    count: 1,
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<ErrorReportEnvelope> = {}): ErrorReportEnvelope {
  return {
    schemaVersion: 1,
    host: 'desktop',
    channel: 'github-release',
    appVersion: { year: 2026, month: 10, patch: 2 },
    platform: 'mac',
    arch: 'arm64',
    locale: 'en',
    osVersion: 26,
    sessionId: SESSION_ID,
    sessionAge: '0-9m',
    sentAt: 1_760_000_000_000,
    reports: [makeReport()],
    ...overrides,
  };
}

describe('error report grammars (law 2)', () => {
  it('identifier: a name, never a path, a URL, whitespace, or a quote', () => {
    for (const ok of ['renderBody', '_private', '$', 'Foo123', 'a'.repeat(64)]) {
      expect(ERROR_REPORT_IDENTIFIER_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ['', 'a'.repeat(65), 'Object.method', 'a/b', 'x-y', 'has space', "it's", '1abc', 'über']) {
      expect(ERROR_REPORT_IDENTIFIER_PATTERN.test(bad)).toBe(false);
    }
  });

  it('bundle: a basename of the release grammar, never a directory, a query, or a source file', () => {
    for (const ok of ['workbench-Bx7Qk2.js', 'main.mjs', 'chunk.001.js', `${'a'.repeat(80)}.js`]) {
      expect(ERROR_REPORT_BUNDLE_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of [
      'assets/workbench.js',
      'App.tsx',
      'workbench.js?v=3',
      'x.js.map',
      `${'a'.repeat(81)}.js`,
      'https://openheaders.io/a.js',
      '.js',
    ]) {
      expect(ERROR_REPORT_BUNDLE_PATTERN.test(bad)).toBe(false);
    }
  });

  it('fingerprint: exactly 16 lowercase hex chars', () => {
    expect(ERROR_REPORT_FINGERPRINT_PATTERN.test('0123456789abcdef')).toBe(true);
    for (const bad of ['0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0', 'g123456789abcdef']) {
      expect(ERROR_REPORT_FINGERPRINT_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('ErrorReportSchema', () => {
  it('accepts a full render-error report and a bare gone-process report', () => {
    expect(v.safeParse(ErrorReportSchema, makeReport()).success).toBe(true);
    const gone: ErrorReport = {
      kind: 'renderer-gone',
      process: 'renderer',
      reason: 'oom',
      exitCode: -1,
      reopenCount: 1,
      frames: [],
      fingerprint: 'fedcba9876543210',
      count: 1,
    };
    expect(v.safeParse(ErrorReportSchema, gone).success).toBe(true);
  });

  it('rejects a frame that names a path, a source file, or an off-grammar function', () => {
    const path = makeReport({ frames: [{ file: 'assets/workbench.js', line: 1, col: 1 }] });
    const source = makeReport({ frames: [{ file: 'App.tsx', line: 1, col: 1 }] });
    const dotted = makeReport({ frames: [{ file: 'a.js', line: 1, col: 1, fn: 'Object.method' }] });
    for (const report of [path, source, dotted]) expect(v.safeParse(ErrorReportSchema, report).success).toBe(false);
  });

  it('rejects an unknown property, a free-text message, and a zero count', () => {
    expect(v.safeParse(ErrorReportSchema, { ...makeReport(), message: 'boom' }).success).toBe(false);
    expect(v.safeParse(ErrorReportSchema, makeReport({ count: 0 })).success).toBe(false);
    expect(v.safeParse(ErrorReportSchema, makeReport({ fingerprint: 'not-hex-at-all!!' })).success).toBe(false);
  });

  it('caps the frames at twenty and the component stack at sixteen', () => {
    const frame = { file: 'a.js', line: 1, col: 1 };
    expect(v.safeParse(ErrorReportSchema, makeReport({ frames: Array(20).fill(frame) })).success).toBe(true);
    expect(v.safeParse(ErrorReportSchema, makeReport({ frames: Array(21).fill(frame) })).success).toBe(false);
    expect(v.safeParse(ErrorReportSchema, makeReport({ componentStack: Array(16).fill('A') })).success).toBe(true);
    expect(v.safeParse(ErrorReportSchema, makeReport({ componentStack: Array(17).fill('A') })).success).toBe(false);
  });
});

describe('ErrorReportEnvelopeSchema', () => {
  it('accepts the product envelope minus events and identity, plus reports', () => {
    expect(v.safeParse(ErrorReportEnvelopeSchema, makeEnvelope()).success).toBe(true);
  });

  it('rejects an install identity, an events array, and an empty or over-full reports array (laws 1 and 7)', () => {
    const withInstall = { ...makeEnvelope(), installId: 'feedface00feedface00feedface0000' };
    const withSince = { ...makeEnvelope(), sinceInstall: '0' };
    const withEvents = { ...makeEnvelope(), events: [] };
    for (const envelope of [withInstall, withSince, withEvents]) {
      expect(v.safeParse(ErrorReportEnvelopeSchema, envelope).success).toBe(false);
    }
    expect(v.safeParse(ErrorReportEnvelopeSchema, makeEnvelope({ reports: [] })).success).toBe(false);
    const full = Array.from({ length: ERROR_REPORT_MAX_PER_ENVELOPE }, () => makeReport());
    expect(v.safeParse(ErrorReportEnvelopeSchema, makeEnvelope({ reports: full })).success).toBe(true);
    expect(v.safeParse(ErrorReportEnvelopeSchema, makeEnvelope({ reports: [...full, makeReport()] })).success).toBe(
      false,
    );
  });

  it('pins the session id to the shared 32-hex alphabet', () => {
    expect(v.safeParse(ErrorReportEnvelopeSchema, makeEnvelope({ sessionId: 'short' })).success).toBe(false);
  });
});

describe('picklists', () => {
  it('surface has no duplicate member — server-admin is one member for both the tab and the tool window', () => {
    const options = [...ErrorReportSurfaceSchema.options];
    expect(new Set(options).size).toBe(options.length);
    expect(options.filter((o) => o === 'server-admin')).toHaveLength(1);
  });

  it('template = the engine templates + react-minified + the DOMException names + other, with no overlap', () => {
    const options = [...ErrorReportTemplateSchema.options];
    expect(options).toEqual([
      ...ERROR_REPORT_ENGINE_TEMPLATES,
      'react-minified',
      ...ERROR_REPORT_DOM_EXCEPTION_NAMES,
      'other',
    ]);
    expect(new Set(options).size).toBe(options.length);
    expect(ERROR_REPORT_DOM_EXCEPTION_NAMES).not.toContain('SyntaxError');
  });
});
