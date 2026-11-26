/**
 * Run reporters — human lines (failure detail, scriptless honesty
 * note, summary verdict) and the JUnit XML shape (counts, skipped,
 * failure message + body, escaping).
 */

import { describe, expect, it } from 'vitest';
import { formatRunHuman, formatRunJUnit, formatRunSummary, type RunReport } from '../../src/run-reporters';

function makeReport(overrides: Partial<RunReport> = {}): RunReport {
  return {
    workspaceId: 'ws-1',
    target: { kind: 'collection', uid: 'c1', name: 'Smoke', path: 'requests/smoke-c1' },
    environmentId: null,
    ok: false,
    startedAt: 1_753_000_000_000,
    durationMs: 4_230,
    scripts: { available: true, mode: 'safe' },
    items: [
      {
        kind: 'request',
        uid: 'q1',
        name: 'Health',
        path: 'requests/smoke-c1/health-q1',
        method: 'GET',
        status: 'passed',
        httpStatus: 200,
        durationMs: 41.4,
        assertions: [],
      },
      {
        kind: 'request',
        uid: 'q2',
        name: 'Create <user>',
        path: 'requests/smoke-c1/create-q2',
        method: 'POST',
        status: 'failed',
        httpStatus: 500,
        durationMs: 80,
        assertions: [{ name: 'status is 201', passed: false, message: 'expected 201, got "500"' }],
        error: 'Assertion failed: status is 201',
      },
      {
        kind: 'request',
        uid: 'q3',
        name: 'Delete user',
        path: 'requests/smoke-c1/delete-q3',
        method: 'DELETE',
        status: 'skipped',
        assertions: [],
      },
    ],
    totals: { items: 3, passed: 1, failed: 1, skipped: 1 },
    ...overrides,
  };
}

describe('formatRunHuman', () => {
  it('prints one line per item with failed-assertion detail indented', () => {
    const lines = formatRunHuman(makeReport());
    expect(lines[0]).toBe('pass  GET Health · 200 · 41 ms');
    expect(lines[1]).toBe('FAIL  POST Create <user> · 500 · 80 ms');
    expect(lines[2]).toBe('      assertion failed: status is 201 — expected 201, got "500"');
    expect(lines[3]).toBe('skip  DELETE Delete user');
    expect(lines.at(-1)).toBe('collection "Smoke" — 1 passed · 1 failed · 1 skipped · 4.2 s · workspace ws-1');
  });

  it('prints a transport error under its item without duplicating assertion text', () => {
    const report = makeReport({
      items: [
        {
          kind: 'request',
          uid: 'q1',
          name: 'Down',
          method: 'GET',
          status: 'failed',
          assertions: [],
          error: 'connect ECONNREFUSED 127.0.0.1:1',
        },
      ],
      totals: { items: 1, passed: 0, failed: 1, skipped: 0 },
    });
    const lines = formatRunHuman(report);
    expect(lines[0]).toBe('FAIL  GET Down');
    expect(lines[1]).toBe('      connect ECONNREFUSED 127.0.0.1:1');
  });

  it('surfaces the scriptless-host honesty note', () => {
    const lines = formatRunHuman(makeReport({ scripts: { available: false } }));
    expect(lines).toContain('note: this host has no script runtime — scripts and their assertions did not run');
  });
});

describe('formatRunSummary', () => {
  it('omits the skipped leg when nothing was skipped', () => {
    const summary = formatRunSummary(makeReport({ totals: { items: 2, passed: 2, failed: 0, skipped: 0 } }));
    expect(summary).toBe('collection "Smoke" — 2 passed · 0 failed · 4.2 s · workspace ws-1');
  });
});

describe('formatRunJUnit', () => {
  it('emits one testsuite with per-item testcases, failure bodies, and skipped markers', () => {
    const xml = formatRunJUnit(makeReport());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuite name="Smoke" tests="3" failures="1" skipped="1" time="4.230"');
    expect(xml).toContain('timestamp="2025-07-20T08:26:40.000Z"');
    expect(xml).toContain('<testcase name="Health" classname="requests/smoke-c1/health-q1" time="0.041"/>');
    expect(xml).toContain('<failure message="Assertion failed: status is 201">');
    expect(xml).toContain('status is 201: expected 201, got &quot;500&quot;');
    expect(xml).toContain('<skipped/>');
    expect(xml).toContain('</testsuite>');
  });

  it('escapes XML metacharacters in names and messages', () => {
    const xml = formatRunJUnit(makeReport());
    expect(xml).toContain('name="Create &lt;user&gt;"');
    expect(xml).not.toContain('<user>');
  });

  it('carries a no-assertion failure as the failure message', () => {
    const report = makeReport({
      items: [
        {
          kind: 'request',
          uid: 'q1',
          name: 'Boom',
          method: 'GET',
          status: 'failed',
          httpStatus: 500,
          durationMs: 12,
          assertions: [],
          error: 'HTTP 500 Internal Server Error',
        },
      ],
      totals: { items: 1, passed: 0, failed: 1, skipped: 0 },
    });
    expect(formatRunJUnit(report)).toContain('<failure message="HTTP 500 Internal Server Error">');
  });
});

// ── An item the host could not run ──────────────────────────────────

describe('an error row — a step the host could not run', () => {
  const report = makeReport({
    target: { kind: 'workflow', uid: 'wfdevice', name: 'Reboot' },
    scripts: undefined,
    items: [
      {
        kind: 'step',
        uid: 'stplistn',
        name: 'probe',
        status: 'error',
        error: 'Step "probe" needs a newer version of OpenHeaders (action "listen").',
      },
      { kind: 'step', uid: 'stpcall0', name: 'reboot', status: 'skipped' },
    ],
    totals: { items: 2, passed: 0, failed: 0, skipped: 1, errors: 1 },
  });

  it('prints its own mark with the reason beneath, and counts it in the summary', () => {
    expect(formatRunHuman(report)).toEqual([
      'ERR   probe',
      '      Step "probe" needs a newer version of OpenHeaders (action "listen").',
      'skip  reboot',
      'workflow "Reboot" — 0 passed · 0 failed · 1 error · 1 skipped · 4.2 s · workspace ws-1',
    ]);
  });

  it('pluralizes the count', () => {
    const two = { ...report, totals: { ...report.totals, errors: 2 } };
    expect(formatRunSummary(two)).toContain('0 failed · 2 errors · 1 skipped');
  });

  it('is a JUnit <error>, never a failure or a skip, and the suite counts it', () => {
    const xml = formatRunJUnit(report);
    expect(xml).toContain('<testsuite name="Reboot" tests="2" failures="0" errors="1" skipped="1"');
    expect(xml).toContain(
      '<testcase name="probe" classname="Reboot" time="0.000"><error message="Step &quot;probe&quot; needs a newer ' +
        'version of OpenHeaders (action &quot;listen&quot;)."></error></testcase>',
    );
    expect(xml).not.toContain('<failure');
  });

  it('leaves a report with no error row without the count, in the summary and in the suite', () => {
    const clean = makeReport();
    expect(formatRunSummary(clean)).not.toContain('error');
    expect(formatRunJUnit(clean)).not.toContain('errors=');
  });
});

// ── A workflow with session steps ───────────────────────────────────

describe('a workflow with session steps', () => {
  const report = makeReport({
    target: { kind: 'workflow', uid: 'wfdevice', name: 'Reboot' },
    scripts: undefined,
    items: [
      { kind: 'step', uid: 'stplistn', name: 'probe', action: 'listen', status: 'skipped' },
      { kind: 'step', uid: 'stpcall0', name: 'reboot', status: 'skipped' },
      {
        kind: 'step',
        uid: 'stpexpct',
        name: 'status',
        action: 'expect',
        status: 'failed',
        error: 'expect: No message on devices/dev-1/health matched within 200 ms of "reboot" starting.',
      },
    ],
    totals: { items: 3, passed: 0, failed: 1, skipped: 2 },
  });

  it('leads a session step’s line with its action, and leaves a call’s line as it was', () => {
    expect(formatRunHuman(report)).toEqual([
      'skip  listen probe',
      'skip  reboot',
      'FAIL  expect status',
      '      expect: No message on devices/dev-1/health matched within 200 ms of "reboot" starting.',
      'workflow "Reboot" — 0 passed · 1 failed · 2 skipped · 4.2 s · workspace ws-1',
    ]);
  });

  it('names a JUnit case by its step id alone', () => {
    const xml = formatRunJUnit(report);
    expect(xml).toContain('<testcase name="probe" classname="Reboot" time="0.000"><skipped/></testcase>');
    expect(xml).toContain(
      '<testcase name="status" classname="Reboot" time="0.000"><failure message="expect: No message',
    );
  });
});
