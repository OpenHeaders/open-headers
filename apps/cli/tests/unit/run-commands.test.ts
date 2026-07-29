/**
 * `oh run` — verb table shape, argv parsing (kind/ref/reporter
 * validation), the one `runs_execute` call with flag → tool-arg
 * mapping, reporter emission (human stdout, json verbatim, junit to
 * `--output` with the summary on stderr), and the failed-run exit-1
 * classification AFTER the report is emitted.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationFailedError, UsageError } from '../../src/exit-codes';
import { RUN_COMMANDS, runRunCommand } from '../../src/run-commands';

const REPORT = {
  workspaceId: 'ws-1',
  target: { kind: 'collection', uid: 'c1', name: 'Smoke', path: 'requests/smoke-c1' },
  environmentId: null,
  ok: true,
  startedAt: 1_753_000_000_000,
  durationMs: 1_200,
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
      durationMs: 40,
      assertions: [],
    },
  ],
  totals: { items: 1, passed: 1, failed: 0, skipped: 0 },
};

// Flags override env + config, so the resolved connection is fully pinned.
const CONN = ['--daemon', 'http://127.0.0.1:8137', '--token', 'oh_secret'];

interface Captured {
  name: string;
  arguments: Record<string, unknown>;
}

let calls: Captured[];
let logged: string[];
let stderr: string[];

function stubDaemon(report: unknown = REPORT): void {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { method: string; params: Captured };
      if (body.params.name === 'environments_list') {
        const payload = { environments: [{ uid: 'e-1', name: 'staging' }] };
        return Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
        });
      }
      calls.push(body.params);
      return Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: { content: [{ type: 'text', text: JSON.stringify(report) }] },
      });
    }),
  );
}

beforeEach(() => {
  logged = [];
  stderr = [];
  vi.spyOn(console, 'log').mockImplementation((line: string) => {
    logged.push(line);
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((line) => {
    stderr.push(String(line));
    return true;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RUN_COMMANDS table', () => {
  it('exposes the three kinds on the one runs_execute tool', () => {
    expect(RUN_COMMANDS.map((spec) => spec.verb)).toEqual(['collection', 'folder', 'workflow']);
    for (const spec of RUN_COMMANDS) {
      expect(spec.group).toBe('run');
      expect(spec.tool).toBe('runs_execute');
      expect(Object.keys(spec.extraOptions)).toEqual(['env', 'reporter', 'output', 'bail']);
    }
  });
});

describe('argv parsing', () => {
  it('rejects a missing kind, an unknown kind, a missing ref, and extra positionals', async () => {
    for (const argv of [['run'], ['run', 'suite', 'x'], ['run', 'collection'], ['run', 'collection', 'a', 'b']]) {
      await expect(runRunCommand(argv)).rejects.toThrow(UsageError);
    }
  });

  it('rejects an unknown reporter', async () => {
    await expect(runRunCommand(['run', 'collection', 'Smoke', '--reporter', 'tap'])).rejects.toThrow(
      /--reporter must be/,
    );
  });
});

describe('runRunCommand', () => {
  it('maps kind/ref/flags onto one runs_execute call and prints the human report', async () => {
    stubDaemon();
    await runRunCommand(['run', 'collection', 'Smoke', ...CONN, '--bail', '--workspace', 'ws-1']);

    expect(calls).toEqual([
      { name: 'runs_execute', arguments: { kind: 'collection', ref: 'Smoke', bail: true, workspaceId: 'ws-1' } },
    ]);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('pass  GET Health · 200 · 40 ms');
    expect(logged[0]).toContain('collection "Smoke" — 1 passed · 0 failed · 1.2 s · workspace ws-1');
  });

  it('resolves --env by name through environments_list before the run', async () => {
    stubDaemon();
    await runRunCommand(['run', 'workflow', 'nightly', ...CONN, '--env', 'staging']);
    expect(calls[0].arguments).toEqual({ kind: 'workflow', ref: 'nightly', environmentId: 'e-1' });
  });

  it('--json and --reporter json emit the payload verbatim', async () => {
    stubDaemon();
    await runRunCommand(['run', 'collection', 'Smoke', ...CONN, '--json']);
    expect(logged).toEqual([JSON.stringify(REPORT)]);
  });

  it('writes the junit report to --output and keeps the summary on stderr', async () => {
    stubDaemon();
    const dir = mkdtempSync(join(tmpdir(), 'oh-run-'));
    const out = join(dir, 'results.xml');
    try {
      await runRunCommand(['run', 'collection', 'Smoke', ...CONN, '--reporter', 'junit', '--output', out]);
      const xml = readFileSync(out, 'utf8');
      expect(xml).toContain('<testsuite name="Smoke" tests="1" failures="0"');
      expect(logged).toEqual([]);
      expect(stderr.join('')).toContain('collection "Smoke" — 1 passed · 0 failed · 1.2 s · workspace ws-1');
      expect(stderr.join('')).toContain(`junit report written to ${out}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies a failed run as exit 1 AFTER emitting the report', async () => {
    stubDaemon({
      ...REPORT,
      ok: false,
      items: [{ ...REPORT.items[0], status: 'failed', error: 'HTTP 500' }],
      totals: { items: 1, passed: 0, failed: 1, skipped: 0 },
    });
    await expect(runRunCommand(['run', 'collection', 'Smoke', ...CONN])).rejects.toThrow(OperationFailedError);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('FAIL  GET Health');
  });
});
