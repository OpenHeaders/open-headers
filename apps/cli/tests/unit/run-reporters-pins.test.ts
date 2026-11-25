/**
 * Golden pins for `oh run workflow` over an HTTP-only workflow (the
 * workflow runs plan, Laws — "Stored workflows do not change — and it
 * is pinned").
 *
 * The four reports are the ones the node host's runner is pinned to,
 * read from the one file. Each is pinned through the three reporters,
 * whole: the human lines, the JUnit document, the JSON payload as the
 * daemon sent it — and the exit classification after it.
 */

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationFailedError } from '../../src/exit-codes';
import { runRunCommand } from '../../src/run-commands';
import { formatRunHuman, formatRunJUnit, type RunReport } from '../../src/run-reporters';

type ScenarioName = 'passing' | 'failedAtFetch' | 'failedAtCapture' | 'gateSkipped';

const goldens: { scenarios: Record<ScenarioName, { report: RunReport }> } = JSON.parse(
  readFileSync(
    new URL('../../../../packages/core/tests/fixtures/workflow-runs/http-only.json', import.meta.url),
    'utf8',
  ),
);

const reportOf = (scenario: ScenarioName): RunReport => goldens.scenarios[scenario].report;

const SUITE_OPEN = (failures: number, skipped: number): string =>
  `<testsuite name="Token chain" tests="2" failures="${failures}" skipped="${skipped}" ` +
  'time="1.200" timestamp="2025-07-20T08:26:40.000Z">';

const junit = (suite: string, cases: string[]): string =>
  ['<?xml version="1.0" encoding="UTF-8"?>', suite, ...cases, '</testsuite>'].join('\n');

describe('the human reporter over an HTTP-only workflow', () => {
  it('passing', () => {
    expect(formatRunHuman(reportOf('passing'))).toEqual([
      'pass  login',
      'pass  profile',
      'workflow "Token chain" — 2 passed · 0 failed · 1.2 s · workspace ws-run-pins',
    ]);
  });

  it('failing at a fetch — the step that completed before it reads skipped', () => {
    expect(formatRunHuman(reportOf('failedAtFetch'))).toEqual([
      'skip  login',
      'FAIL  profile',
      '      fetch: Connection refused by 127.0.0.1.',
      'workflow "Token chain" — 0 passed · 1 failed · 1 skipped · 1.2 s · workspace ws-run-pins',
    ]);
  });

  it('failing at a capture', () => {
    expect(formatRunHuman(reportOf('failedAtCapture'))).toEqual([
      'FAIL  login',
      '      extract: Capture "token" (json-path): Path "$.session_token" resolved to undefined.',
      'skip  profile',
      'workflow "Token chain" — 0 passed · 1 failed · 1 skipped · 1.2 s · workspace ws-run-pins',
    ]);
  });

  it('one step skipped by its gate', () => {
    expect(formatRunHuman(reportOf('gateSkipped'))).toEqual([
      'pass  introspect',
      'skip  refresh',
      'workflow "Token chain" — 1 passed · 0 failed · 1 skipped · 1.2 s · workspace ws-run-pins',
    ]);
  });
});

describe('the JUnit reporter over an HTTP-only workflow', () => {
  it('passing', () => {
    expect(formatRunJUnit(reportOf('passing'))).toBe(
      junit(SUITE_OPEN(0, 0), [
        '    <testcase name="login" classname="Token chain" time="0.000"/>',
        '    <testcase name="profile" classname="Token chain" time="0.000"/>',
      ]),
    );
  });

  it('failing at a fetch', () => {
    expect(formatRunJUnit(reportOf('failedAtFetch'))).toBe(
      junit(SUITE_OPEN(1, 1), [
        '    <testcase name="login" classname="Token chain" time="0.000"><skipped/></testcase>',
        '    <testcase name="profile" classname="Token chain" time="0.000">' +
          '<failure message="fetch: Connection refused by 127.0.0.1."></failure></testcase>',
      ]),
    );
  });

  it('failing at a capture', () => {
    expect(formatRunJUnit(reportOf('failedAtCapture'))).toBe(
      junit(SUITE_OPEN(1, 1), [
        '    <testcase name="login" classname="Token chain" time="0.000">' +
          '<failure message="extract: Capture &quot;token&quot; (json-path): ' +
          'Path &quot;$.session_token&quot; resolved to undefined."></failure></testcase>',
        '    <testcase name="profile" classname="Token chain" time="0.000"><skipped/></testcase>',
      ]),
    );
  });

  it('one step skipped by its gate', () => {
    expect(formatRunJUnit(reportOf('gateSkipped'))).toBe(
      junit(SUITE_OPEN(0, 1), [
        '    <testcase name="introspect" classname="Token chain" time="0.000"/>',
        '    <testcase name="refresh" classname="Token chain" time="0.000"><skipped/></testcase>',
      ]),
    );
  });
});

describe('the JSON reporter and the exit code over an HTTP-only workflow', () => {
  const CONN = ['--daemon', 'http://127.0.0.1:8137', '--token', 'oh_secret'];
  let logged: string[];

  function stubDaemon(report: RunReport): void {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: JSON.stringify(report) }] },
        }),
      ),
    );
  }

  beforeEach(() => {
    logged = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logged.push(line);
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['passing', 'gateSkipped'] as const)('%s — the payload verbatim, exit 0', async (scenario) => {
    stubDaemon(reportOf(scenario));
    await runRunCommand(['run', 'workflow', 'Token chain', ...CONN, '--json']);
    expect(logged).toEqual([JSON.stringify(reportOf(scenario))]);
  });

  it.each(['failedAtFetch', 'failedAtCapture'] as const)('%s — the payload verbatim, then exit 1', async (scenario) => {
    stubDaemon(reportOf(scenario));
    const run = runRunCommand(['run', 'workflow', 'Token chain', ...CONN, '--json']);
    await expect(run).rejects.toThrow(new OperationFailedError('run failed — 1 of 2 item(s) failed'));
    expect(logged).toEqual([JSON.stringify(reportOf(scenario))]);
  });
});
