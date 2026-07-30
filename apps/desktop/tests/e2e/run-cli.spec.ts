/**
 * Runner E2E — the real `oh run` verbs against the real desktop stack
 * (the Phase F/G live proof): the built desktop app hosts the embedded
 * daemon with the execute tier on, requests are seeded through the
 * write-tier `requests_save` tool into the default request collection,
 * and every leg drives the built CLI bundle (`apps/cli/dist/cli.js`)
 * the way CI would — env-resolved connection, reporters, exit codes.
 *
 * Proven here: the pass/fail law (assertions outrank status; an
 * assertion-less 4xx fails; a failed run exits 1 AFTER the report),
 * `--bail` skip semantics, the junit `--output` + stderr-summary
 * contract, `scripts.available` honesty on a scripted host, and the
 * empty/unknown-target refusals.
 *
 * Requires `pnpm --filter @openheaders/desktop build` (turbo builds
 * the CLI's dist through the same graph) and the cli package built.
 */

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import { type Rig, startHttpRig } from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
const CLI_BIN = path.resolve(APP_ROOT, '../cli/dist/cli.js');
// Port etiquette: default 8137, mcp.spec 18137, T3 18238, cli.spec
// 18337, daemon pack 18437, settings-live + cli pack verify 18537,
// run-cli 18637.
const DAEMON_PORT = 18637;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${DAEMON_URL}/mcp`;

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let configHome: string;
let httpRig: Rig;
let outputDir: string;

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * One `oh` invocation — env-resolved connection (the CI path). Async
 * spawn, never spawnSync: exec-tier runs send to the rig hosted in THIS
 * process, so a blocked worker event loop deadlocks the daemon's send
 * against the CLI it is waiting on.
 */
function oh(args: string[]): Promise<CliRun> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    OH_DAEMON_URL: DAEMON_URL,
    OH_TOKEN: token,
    XDG_CONFIG_HOME: configHome,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_BIN, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Direct tools/call — rig seeding only; assertions go through the CLI. */
async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  expect(response.status).toBe(200);
  const json = (await response.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
  expect(json.result.isError).toBeFalsy();
  return JSON.parse(json.result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

interface RunReport {
  target: { kind: string; name: string };
  ok: boolean;
  scripts?: { available: boolean; mode?: string };
  items: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    httpStatus?: number;
    assertions?: Array<{ name: string; passed: boolean }>;
    error?: string;
  }>;
  totals: { items: number; passed: number; failed: number; skipped: number };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  httpRig = await startHttpRig();
  outputDir = await mkdtemp(path.join(tmpdir(), 'oh-run-e2e-out-'));
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-run-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  configHome = await mkdtemp(path.join(tmpdir(), 'oh-run-e2e-config-'));
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'mcp.allowExecute': true,
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(MCP_URL, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .toBe(401);

  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'run-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
});

test.afterAll(async () => {
  await electronApp?.close();
  await httpRig?.close();
});

// ── Green suite first: passing items, assertions on a real wire ─────

test('seed two passing requests; the run passes and exits 0', async () => {
  await callTool('requests_save', {
    request: { name: 'Alpha', url: `http://127.0.0.1:${httpRig.port}/echo` },
  });
  await callTool('requests_save', {
    request: {
      name: 'Asserted',
      url: `http://127.0.0.1:${httpRig.port}/echo`,
      postResponseScript: "await oh.test('status is 200', () => { oh.expect(oh.response).toHaveStatus(200); });",
    },
  });

  const run = await oh(['run', 'collection', 'My Requests', '--reporter', 'json']);
  expect(run.code).toBe(0);
  const report = JSON.parse(run.stdout) as RunReport;
  expect(report.ok).toBe(true);
  expect(report.target).toMatchObject({ kind: 'collection', name: 'My Requests' });
  expect(report.totals).toMatchObject({ items: 2, passed: 2, failed: 0, skipped: 0 });
  // The scripted desktop host reports its runtime honestly and the
  // assertion really ran against the wire response.
  expect(report.scripts?.available).toBe(true);
  const asserted = report.items.find((item) => item.name === 'Asserted');
  expect(asserted?.assertions).toEqual([expect.objectContaining({ name: 'status is 200', passed: true })]);
});

// ── The pass/fail law on real sends ─────────────────────────────────

test('an assertion-less 404 fails the run; explicit assertions outrank the status', async () => {
  // `/missing` answers 404 from the rig; no assertions ⇒ the status is
  // the verdict. The asserted item passes on the same 404 because its
  // assertion checks the 404 explicitly — assertions outrank status.
  await callTool('requests_save', {
    request: { name: 'Bare 404', url: `http://127.0.0.1:${httpRig.port}/missing` },
  });
  await callTool('requests_save', {
    request: {
      name: 'Asserted 404',
      url: `http://127.0.0.1:${httpRig.port}/missing`,
      postResponseScript: "await oh.test('404 expected', () => { oh.expect(oh.response).toHaveStatus(404); });",
    },
  });

  const run = await oh(['run', 'collection', 'My Requests', '--reporter', 'json']);
  expect(run.code).toBe(1);
  const report = JSON.parse(run.stdout) as RunReport;
  expect(report.ok).toBe(false);
  expect(report.totals).toMatchObject({ items: 4, passed: 3, failed: 1 });
  expect(report.items.find((item) => item.name === 'Bare 404')?.status).toBe('failed');
  expect(report.items.find((item) => item.name === 'Asserted 404')?.status).toBe('passed');
});

test('the human reporter prints one line per item and exits 1 after the report', async () => {
  const run = await oh(['run', 'collection', 'My Requests']);
  expect(run.code).toBe(1);
  expect(run.stdout).toContain('pass  GET Alpha');
  expect(run.stdout).toContain('FAIL  GET Bare 404');
  expect(run.stdout).toMatch(/1 failed/);
});

test('the junit reporter writes the file; the one-line summary goes to stderr', async () => {
  const outFile = path.join(outputDir, 'results.xml');
  const run = await oh(['run', 'collection', 'My Requests', '--reporter', 'junit', '--output', outFile]);
  expect(run.code).toBe(1);
  const xml = await readFile(outFile, 'utf-8');
  expect(xml).toContain('<testsuite');
  expect(xml).toContain('name="Bare 404"');
  expect(xml).toContain('<failure');
  // The report went to the file; stdout stays empty and the one-line
  // summary keeps CI logs readable on stderr.
  expect(run.stdout.trim()).toBe('');
  expect(run.stderr).toMatch(/1 failed/);
});

test('--bail stops at the first failure and reports the rest skipped', async () => {
  const run = await oh(['run', 'collection', 'My Requests', '--reporter', 'json', '--bail']);
  expect(run.code).toBe(1);
  const report = JSON.parse(run.stdout) as RunReport;
  const bare = report.items.findIndex((item) => item.name === 'Bare 404');
  expect(report.items[bare]?.status).toBe('failed');
  for (const item of report.items.slice(bare + 1)) {
    expect(item.status).toBe('skipped');
  }
  expect(report.totals.skipped).toBeGreaterThan(0);
});

// ── Refusals ────────────────────────────────────────────────────────

test('an unknown target refuses with exit 1, never a vacuous green', async () => {
  const run = await oh(['run', 'collection', 'No Such Collection']);
  expect(run.code).toBe(1);
  expect(run.stderr).toContain('No Such Collection');
});

test('a bad reporter name is a usage error', async () => {
  const run = await oh(['run', 'collection', 'My Requests', '--reporter', 'tap']);
  expect(run.code).toBe(2);
});
