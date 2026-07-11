/**
 * CLI E2E — the real `oh` binary against the real desktop stack,
 * mirroring mcp.spec.ts's rig:
 *
 *   1. Launch the built desktop app with an isolated userData dir on a
 *      non-default daemon port, `mcp.enabled` + `mcp.allowWrite`
 *      pre-seeded, and mint a daemon token from the Workbench renderer.
 *   2. Spawn the built CLI bundle (`apps/cli/dist/cli.js` — the same
 *      file `pack` stages into the npm tarball) under plain `node`
 *      per command, resolving the daemon through the env path
 *      (OH_DAEMON_URL / OH_TOKEN, the CI shape).
 *   3. Observe the full exit-code contract live: 0 ok, 2 usage,
 *      3 unreachable, 4 bad token / disabled tier — plus reads, a
 *      write landing on the read tier, `oh connect` persisting a
 *      config that later runs resolve, and the execute tier flipping
 *      on without a restart (request send against the playground).
 *
 * Requires `pnpm --filter @openheaders/desktop build` and
 * `pnpm --filter @openheaders/cli build`. The packaged-desktop pass is
 * the same spec pointed at an electron-builder artifact — the daemon
 * surface is identical; only the launch differs.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const CLI_BIN = path.resolve(APP_ROOT, '../cli/dist/cli.js');
// Port etiquette: default 8137, mcp.spec 18137, T3 18238, daemon pack
// 18437, cli pack verify 18537.
const DAEMON_PORT = 18337;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${DAEMON_URL}/mcp`;
const DEAD_PORT = 18999;

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let configHome: string;

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/** One `oh` invocation — env-resolved connection (the CI path), isolated config home. */
function oh(args: string[], envOverrides: Record<string, string | undefined> = {}): CliRun {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    OH_DAEMON_URL: DAEMON_URL,
    OH_TOKEN: token,
    XDG_CONFIG_HOME: configHome,
  };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: 'utf-8', env });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-cli-e2e-'));
  configHome = await mkdtemp(path.join(tmpdir(), 'oh-cli-e2e-config-'));
  await writeFile(
    path.join(userData, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
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
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'cli-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── Posture + exit-code contract ────────────────────────────────────

test('oh status reports identity and the enabled tiers', () => {
  const run = oh(['status']);
  expect(run.code).toBe(0);
  const [identity, tiers] = run.stdout.trim().split('\n');
  expect(identity).toContain('running — ');
  expect(identity).toContain(DAEMON_URL);
  expect(tiers).toContain('tiers: read + write');
  expect(tiers).not.toContain('execute');
});

test('an unreachable daemon exits 3 with the honest copy', () => {
  const run = oh(['status'], { OH_DAEMON_URL: `http://127.0.0.1:${DEAD_PORT}` });
  expect(run.code).toBe(3);
  expect(run.stderr).toContain('no Open Headers daemon reachable');
});

test('a rejected token exits 4', () => {
  const run = oh(['rules', 'list'], { OH_TOKEN: 'oh_not-a-real-token' });
  expect(run.code).toBe(4);
  expect(run.stderr).toContain('token rejected');
});

test('a usage mistake exits 2', () => {
  const run = oh(['rules', 'toggle', 'some-uid', 'maybe']);
  expect(run.code).toBe(2);
});

test('an unknown command prints usage and exits 2', () => {
  const run = oh(['frobnicate']);
  expect(run.code).toBe(2);
  expect(run.stdout).toContain('Usage: oh');
});

test('oh completion emits shell scripts and rejects unknown shells', () => {
  const bash = oh(['completion', 'bash']);
  expect(bash.code).toBe(0);
  expect(bash.stdout).toContain('complete -F _oh oh');

  const zsh = oh(['completion', 'zsh']);
  expect(zsh.code).toBe(0);
  expect(zsh.stdout).toContain('#compdef oh');

  const fish = oh(['completion', 'fish']);
  expect(fish.code).toBe(2);
});

// ── Connect: persisted config carries later runs ────────────────────

test('oh connect validates and persists; later runs need no env or flags', async () => {
  const connect = oh(['connect']);
  expect(connect.code).toBe(0);
  expect(connect.stdout).toContain('connected — ');

  const configPath = path.join(configHome, 'openheaders', 'cli.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8')) as { daemonUrl: string; token: string };
  expect(config.daemonUrl).toBe(DAEMON_URL);
  expect(config.token).toBe(token);

  const bare = oh(['workspace', 'list'], { OH_DAEMON_URL: undefined, OH_TOKEN: undefined });
  expect(bare.code).toBe(0);
  expect(bare.stdout).toContain('workspace(s) · active:');
});

// ── Read + write through the real binary ────────────────────────────

test('oh rules list answers on the fresh workspace, human and --json', () => {
  const human = oh(['rules', 'list']);
  expect(human.code).toBe(0);
  expect(human.stdout).toContain('0 enabled · 0 disabled · workspace');

  const json = oh(['rules', 'list', '--json']);
  expect(json.code).toBe(0);
  const payload = JSON.parse(json.stdout) as { rules: unknown[] };
  expect(payload.rules).toEqual([]);
});

test('oh vars set lands on the read tier', () => {
  const set = oh(['vars', 'set', 'region', 'eu-west']);
  expect(set.code).toBe(0);
  expect(set.stdout).toContain('added region in workspace scope');

  const list = oh(['vars', 'list', '--json']);
  const payload = JSON.parse(list.stdout) as { workspace: Array<{ name: string; value?: string }> };
  expect(payload.workspace.find((row) => row.name === 'region')?.value).toBe('eu-west');
});

// ── Execute tier: denied, flipped live, then a real send ────────────

test('request send is denied with exit 4 while the execute tier is off', async () => {
  await callTool('requests_save', {
    request: { name: 'echo', method: 'POST', url: 'http://127.0.0.1:3000/api/echo' },
  });

  const denied = oh(['request', 'send', 'echo']);
  expect(denied.code).toBe(4);
  expect(denied.stderr).toContain('Execute tools are disabled');
});

test('flipping mcp.allowExecute exposes the tier to the CLI without a restart', async () => {
  await workbench.evaluate(async () => {
    const bridge = (
      window as unknown as {
        oh: {
          storage: {
            get(req: { key: string }): Promise<{ value: unknown }>;
            set(req: { key: string; value: unknown }): Promise<unknown>;
          };
        };
      }
    ).oh;
    const current = await bridge.storage.get({ key: 'oh.settings.user' });
    await bridge.storage.set({
      key: 'oh.settings.user',
      value: { ...((current.value as Record<string, unknown>) ?? {}), 'mcp.allowExecute': true },
    });
  });

  await expect
    .poll(() => {
      const run = oh(['status']);
      return run.stdout;
    })
    .toContain('tiers: read + write + execute');
});

test('oh request send executes the saved request against the playground', () => {
  const run = oh(['request', 'send', 'echo']);
  expect(run.code).toBe(0);
  expect(run.stdout).toContain('POST http://127.0.0.1:3000/api/echo → 200 OK');

  const json = oh(['request', 'send', 'echo', '--json']);
  expect(json.code).toBe(0);
  const payload = JSON.parse(json.stdout) as { sent: boolean; response: { status: number } };
  expect(payload.sent).toBe(true);
  expect(payload.response.status).toBe(200);
});

test('an unknown request name is a plain exit-1 miss', () => {
  const run = oh(['request', 'send', 'ghost']);
  expect(run.code).toBe(1);
  expect(run.stderr).toContain('ghost');
});

test('a failed send exits 1 and still emits the --json payload first', async () => {
  await callTool('requests_save', {
    request: { name: 'dead', method: 'GET', url: `http://127.0.0.1:${DEAD_PORT}/` },
  });

  const run = oh(['request', 'send', 'dead', '--json']);
  expect(run.code).toBe(1);
  const payload = JSON.parse(run.stdout) as { sent: boolean };
  expect(payload.sent).toBe(false);
});

// ── Onboarding: the Settings → MCP page carries the CLI snippet ─────

test('the Settings → MCP page shows the oh connect one-liner with the live port', async () => {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByText('Settings…', { exact: true }).click();
  await workbench.getByRole('button', { name: 'MCP', exact: true }).click();

  await workbench.getByRole('tab', { name: 'CLI', exact: true }).click();
  await expect(workbench.getByText('npm install -g @openheaders/cli')).toBeVisible();
  await expect(
    workbench.getByText(`oh connect --daemon http://127.0.0.1:${DAEMON_PORT} --token YOUR_ACCESS_TOKEN`),
  ).toBeVisible();

  await workbench.keyboard.press('Escape');
});
