/**
 * CLI provisioning E2E — the S15 one-click flow live against the real
 * desktop stack, driving the real UI (MCP-pane card + Open-TUI gate)
 * and the real `oh` binary:
 *
 *   1. Fresh machine: an isolated XDG_CONFIG_HOME means no `cli.json`;
 *      the card reads unconfigured, Open TUI raises the consent gate,
 *      and Cancel mints nothing.
 *   2. Connect and open: one click writes `cli.json` (daemonUrl points
 *      at this daemon, secret never crosses the RPC), the ledger gains
 *      exactly one `CLI — <hostname>` row, a TUI tab opens, and
 *      `oh status` works zero-flag from the file alone.
 *   3. Rotate: the card swaps the on-disk secret, revokes the old row
 *      without accumulating, and the old secret is rejected live.
 *   4. Stale: a ledger revoke flips the card and re-arms the gate.
 *   5. Malformed: refuse-and-report in the card, the gate, and the
 *      provision RPC; Open Settings lands on the MCP pane.
 *   6. External: a foreign daemonUrl + unknown token warns without
 *      blocking Open TUI; "Connect to this app" repoints the file while
 *      the merge law carries non-connection keys over untouched.
 *
 * Requires `pnpm --filter @openheaders/desktop build` and
 * `pnpm --filter @openheaders/cli build`.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { hostname as osHostname, tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const CLI_BIN = path.resolve(APP_ROOT, '../cli/dist/cli.js');
// Port etiquette: off every prior suite's ports (8137 default, 18137,
// 18238, 18337–18339, 18437, 18443, 18537, 18637, 18737, 18747, 18937,
// 19037, 19039, 19137, 19237, 19337, 19437).
const DAEMON_PORT = 19537;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const CLI_LABEL = `CLI — ${osHostname()}`;

let electronApp: ElectronApplication;
let workbench: Page;
let configHome: string;
let cliConfigPath: string;

interface CliStatus {
  configPath: string;
  state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
  tokenId?: string;
  label?: string;
  daemonUrl?: string;
  error?: string;
}

interface TokenRow {
  id: string;
  label?: string;
  revokedAt: number | null;
}

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

const cliStatus = (): Promise<CliStatus> => invoke<CliStatus>({ type: 'oh.daemon.cli.status' });

async function cliLedgerRows(): Promise<TokenRow[]> {
  const { tokens } = await invoke<{ tokens: TokenRow[] }>({ type: 'oh.daemon.tokens.list' });
  return tokens.filter((row) => row.label === CLI_LABEL);
}

/** One `oh` invocation resolving the daemon purely from the provisioned
 *  config file — no OH_DAEMON_URL / OH_TOKEN unless a test injects them. */
function oh(args: string[], envOverrides: Record<string, string> = {}): CliRun {
  const env: NodeJS.ProcessEnv = { ...process.env, XDG_CONFIG_HOME: configHome };
  delete env.OH_DAEMON_URL;
  delete env.OH_TOKEN;
  for (const [key, value] of Object.entries(envOverrides)) env[key] = value;
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: 'utf-8', env });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

async function readCliConfig(): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(cliConfigPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function openSettingsMcp(): Promise<void> {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench.getByRole('button', { name: 'AI · MCP Server', exact: true }).click();
  await expect(workbench.getByText('Command-line access')).toBeVisible();
}

async function closeSettings(): Promise<void> {
  await workbench.keyboard.press('Escape');
}

/** The gate / malformed dialog share one accessible name (the title).
 *  Role queries only match a11y-exposed nodes, so antd's hidden
 *  leftover modal containers never collide. */
function gateDialog(): ReturnType<Page['getByRole']> {
  return workbench.getByRole('dialog', { name: 'Connect the OpenHeaders CLI' });
}

async function openTerminalPanel(): Promise<void> {
  const openTui = workbench.getByTestId('terminal-open-tui');
  if (await openTui.isVisible().catch(() => false)) return;
  await workbench.locator('[aria-label="Terminal"]').first().click();
  await expect(openTui).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-cli-provision-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  configHome = await mkdtemp(path.join(tmpdir(), 'oh-cli-provision-config-'));
  cliConfigPath = path.join(configHome, 'openheaders', 'cli.json');
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'backend.bindPort': DAEMON_PORT },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
      // The provision service resolves cli.json through the same env the
      // CLI does — the isolated config home keeps the real file out of it.
      XDG_CONFIG_HOME: configHome,
    },
  });
  workbench = await electronApp.firstWindow();

  await expect
    .poll(
      async () => {
        try {
          const status = await cliStatus();
          return status.state;
        } catch {
          return null;
        }
      },
      { timeout: 45_000 },
    )
    .toBe('unconfigured');
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── Fresh machine ───────────────────────────────────────────────────

test('the fresh machine reads unconfigured in the RPC and the card', async () => {
  const status = await cliStatus();
  expect(status.state).toBe('unconfigured');
  expect(status.configPath).toBe(cliConfigPath);

  await openSettingsMcp();
  await expect(workbench.getByText('The CLI on this machine is not connected yet.')).toBeVisible();
  await expect(workbench.getByRole('button', { name: 'Set up CLI access' })).toBeVisible();
  await closeSettings();
});

test('the Open TUI gate appears and Cancel mints nothing', async () => {
  await openTerminalPanel();
  await workbench.getByTestId('terminal-open-tui').click();

  const gate = gateDialog();
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('TUI mode is powered by the oh command-line tool');
  await gate.getByRole('button', { name: 'Cancel' }).click();
  await expect(gate).toBeHidden();

  expect(await readCliConfig()).toBeNull();
  expect(await cliLedgerRows()).toEqual([]);
});

test('Connect and open provisions the file, the ledger row, and the TUI tab', async () => {
  await workbench.getByTestId('terminal-open-tui').click();
  await gateDialog().getByRole('button', { name: 'Connect and open' }).click();

  await expect
    .poll(async () => {
      const config = await readCliConfig();
      return config?.daemonUrl ?? null;
    })
    .toBe(DAEMON_URL);
  const config = await readCliConfig();
  expect(typeof config?.token).toBe('string');
  expect(config?.token).not.toBe('');

  const status = await cliStatus();
  expect(status.state).toBe('configured');
  expect(status.label).toBe(CLI_LABEL);

  const rows = await cliLedgerRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.revokedAt).toBeNull();

  await expect(workbench.getByText('oh tui', { exact: true }).first()).toBeVisible();
});

test('oh works zero-flag from the provisioned file alone', () => {
  const run = oh(['status']);
  expect(run.code).toBe(0);
  expect(run.stdout).toContain(DAEMON_URL);
});

// ── Rotate ──────────────────────────────────────────────────────────

test('Rotate swaps the secret, revokes the old row, and never accumulates', async () => {
  const before = await readCliConfig();
  const oldToken = before?.token as string;
  const oldTokenId = (await cliStatus()).tokenId;

  await openSettingsMcp();
  await expect(workbench.getByText(`CLI connected as ${CLI_LABEL}.`)).toBeVisible();
  await expect(workbench.getByText(`Saved in ${cliConfigPath}`)).toBeVisible();
  await workbench.getByRole('button', { name: 'Rotate CLI access' }).click();

  await expect
    .poll(async () => {
      const config = await readCliConfig();
      return config?.token;
    })
    .not.toBe(oldToken);

  // The file gains the new secret BEFORE the old row is revoked
  // (mint-first: rotation must never leave the machine credential-less),
  // so the ledger converges only after the poll gate above fires.
  await expect
    .poll(async () => (await cliLedgerRows()).filter((row) => row.revokedAt === null).length)
    .toBe(1);
  const rows = await cliLedgerRows();
  expect(rows.find((row) => row.id === oldTokenId)?.revokedAt).not.toBeNull();

  const fresh = oh(['status']);
  expect(fresh.code).toBe(0);
  const rejected = oh(['status'], { OH_DAEMON_URL: DAEMON_URL, OH_TOKEN: oldToken });
  expect(rejected.code).toBe(4);
  await closeSettings();
});

// ── Stale ───────────────────────────────────────────────────────────

test('a ledger revoke flips the card to stale and re-arms the gate', async () => {
  const status = await cliStatus();
  await invoke({ type: 'oh.daemon.tokens.revoke', tokenId: status.tokenId });

  await expect.poll(async () => (await cliStatus()).state).toBe('stale');
  await openSettingsMcp();
  await expect(
    workbench.getByText('The saved CLI token is no longer valid — set up access again to reconnect.'),
  ).toBeVisible({ timeout: 10_000 });
  await closeSettings();

  await openTerminalPanel();
  await workbench.getByTestId('terminal-open-tui').click();
  const gate = gateDialog();
  await expect(gate).toBeVisible();
  await gate.getByRole('button', { name: 'Cancel' }).click();
  await expect(gate).toBeHidden();
});

// ── Malformed ───────────────────────────────────────────────────────

test('a malformed file is refused and reported in the card, the gate, and the RPC', async () => {
  await writeFile(cliConfigPath, 'not json\n');

  await expect.poll(async () => (await cliStatus()).state).toBe('malformed');
  // Refusal mints nothing — the (forensic, revoked-rows-included) ledger
  // is unchanged by the rejected call.
  const rowsBefore = (await cliLedgerRows()).length;
  const refused = await invoke<{ ok: boolean }>({ type: 'oh.daemon.cli.provision' });
  expect(refused.ok).toBe(false);
  expect(await cliLedgerRows()).toHaveLength(rowsBefore);

  await openSettingsMcp();
  await expect(workbench.getByTestId('cli-access-malformed')).toBeVisible({ timeout: 10_000 });
  await expect(workbench.getByTestId('cli-access-provision')).toHaveCount(0);
  await closeSettings();

  await workbench.getByTestId('terminal-open-tui').click();
  const gate = gateDialog();
  await expect(gate).toContainText('The CLI config file can’t be read');
  await gate.getByRole('button', { name: 'Open Settings' }).click();
  await expect(gate).toBeHidden();
  await expect(workbench.getByText('Command-line access')).toBeVisible();
  await closeSettings();
});

// ── External ────────────────────────────────────────────────────────

test('a foreign config reads external, never prompts, and Connect repoints it', async () => {
  const foreignUrl = 'http://daemon.openheaders.io:8137';
  await writeFile(
    cliConfigPath,
    `${JSON.stringify({ daemonUrl: foreignUrl, token: 'oh_external_unknown', channel: 'beta' }, null, 2)}\n`,
  );
  await expect.poll(async () => (await cliStatus()).state).toBe('external');

  await openTerminalPanel();
  const tabsBefore = await workbench.getByText('oh tui', { exact: true }).count();
  await workbench.getByTestId('terminal-open-tui').click();
  await expect(gateDialog()).toBeHidden();
  await expect(async () => {
    expect(await workbench.getByText('oh tui', { exact: true }).count()).toBeGreaterThan(tabsBefore);
  }).toPass();

  await openSettingsMcp();
  await expect(
    workbench.getByText(`The CLI is currently connected to a different back-end (${foreignUrl}).`, { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
  await workbench.getByRole('button', { name: 'Connect to this app' }).click();

  await expect
    .poll(async () => {
      const config = await readCliConfig();
      return config?.daemonUrl ?? null;
    })
    .toBe(DAEMON_URL);
  // The merge law: a connection write owns only {daemonUrl, token}.
  const config = await readCliConfig();
  expect(config?.channel).toBe('beta');
  expect(config?.token).not.toBe('oh_external_unknown');
  expect((await cliStatus()).state).toBe('configured');

  const run = oh(['status']);
  expect(run.code).toBe(0);
  await closeSettings();
});
