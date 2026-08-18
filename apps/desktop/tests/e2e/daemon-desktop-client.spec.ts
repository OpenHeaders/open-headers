/**
 * Desktop-as-client acceptance — the desktop app joins a daemon backend
 * as a CLIENT through the shared host-neutral plane (the multi-backend plan
 * §5), while staying a server on its own bind:
 *
 *   1. A headless daemon is spawned on loopback with a pre-seeded pair
 *      token and one seeded rule.
 *   2. The desktop launches isolated; its own MCP surface is the ground
 *      truth for what the desktop holds, the daemon's MCP for what the
 *      daemon holds.
 *   3. Join: an `OH.backends` record written through the renderer's
 *      storage bridge dials the wire; the daemon's Org + workspace +
 *      seeded rule sync DOWN into the desktop.
 *   4. Routing up: an edit in the consumed workspace lands on the
 *      daemon; an edit in the desktop's home workspace never does
 *      (home-Org envelopes go to no backend).
 *   5. Independent flush: with the record's kill switch off, consumed-
 *      workspace edits queue in the SQLite pending-out cursor and flush
 *      on re-enable.
 *   6. Discard-eviction: `evictWorkspace` over the desktop bridge purges
 *      the workspace host-locally (SQLite log stripes, document store,
 *      wire echo set — the S11 three-layer law on the Node host) without
 *      touching the daemon; re-enabling the wire syncs everything back.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` (electron-
 * vite) and `pnpm turbo build --filter=@openheaders/daemon`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(APP_ROOT, '../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: 19737/19738 are fresh (ledger through 19637).
const DAEMON_PORT = 19737;
const DESKTOP_BIND_PORT = 19738;

const RUN = Date.now().toString(36);
const SEEDED_ON_DAEMON = `DaC seeded on daemon ${RUN}`;
const ROUTED_UP = `DaC routed up ${RUN}`;
const HOME_ONLY = `DaC home only ${RUN}`;
const QUEUED_OFFLINE = `DaC queued offline ${RUN}`;

interface McpRig {
  label: string;
  mcpUrl: string;
  token: string;
}

let daemonProc: ChildProcess;
let daemonExited: Promise<number | null>;
const daemonLog: string[] = [];
let electronApp: ElectronApplication;
let workbench: Page;
let daemonRig: McpRig;
let desktopRig: McpRig;
/** The daemon's own (consumed-on-desktop) workspace id. */
let daemonWorkspaceId: string;
/** The desktop's home workspace ids, captured before the join. */
let desktopHomeWorkspaceIds: string[];
/** The joined backend record — one entry, mutated via the storage bridge. */
let backendRecord: Record<string, unknown>;

// ── Daemon rig ──────────────────────────────────────────────────────

async function spawnDaemon(port: number, token: string): Promise<void> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), `oh-daemon-dac-${port}-`));
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: `dac-bootstrap-${port}`,
            tokenHash,
            label: 'dac e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
  daemonProc = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(port)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemonProc.stdout, daemonProc.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  daemonExited = new Promise<number | null>((resolve) => daemonProc.once('exit', (code) => resolve(code)));
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${port}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
}

// ── MCP helpers ─────────────────────────────────────────────────────

async function callTool(rig: McpRig, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(rig.mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${rig.token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  expect(response.status, `${rig.label} ${name}`).toBe(200);
  const json = (await response.json()) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  expect(json.result.isError, `${rig.label} ${name}: ${json.result.content?.[0]?.text}`).toBeFalsy();
  return JSON.parse(json.result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

async function workspaceIds(rig: McpRig): Promise<string[]> {
  const payload = await callTool(rig, 'workspaces_list', {});
  return (payload.workspaces as Array<{ id: string }>).map((ws) => ws.id).sort();
}

/** Every rule name across every workspace of the surface. */
async function ruleNames(rig: McpRig): Promise<string[]> {
  const ids = await workspaceIds(rig);
  const names: string[] = [];
  for (const id of ids) {
    const rules = await callTool(rig, 'rules_list', { workspaceId: id });
    names.push(...(rules.rules as Array<{ name: string }>).map((r) => r.name));
  }
  return names;
}

async function hasRule(rig: McpRig, name: string): Promise<boolean> {
  return (await ruleNames(rig)).includes(name);
}

async function createRule(rig: McpRig, workspaceId: string, name: string): Promise<void> {
  await callTool(rig, 'rules_create', {
    workspaceId,
    rule: {
      name,
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-DaC', value: rig.label }],
        responseHeaders: [],
      },
    },
  });
}

// ── Desktop bridge helpers ──────────────────────────────────────────

async function bridgeInvoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return bridge.invoke(msg);
  }, message)) as Record<string, unknown>;
}

async function writeBackends(records: Array<Record<string, unknown>>): Promise<void> {
  await workbench.evaluate(
    async ({ value }) => {
      const bridge = (
        window as unknown as {
          oh: { storage: { set(req: { key: string; value: unknown }): Promise<unknown> } };
        }
      ).oh;
      await bridge.storage.set({ key: 'oh.backends', value });
    },
    { value: records },
  );
}

async function setBackendEnabled(enabled: boolean): Promise<void> {
  backendRecord = { ...backendRecord, enabled };
  await writeBackends([backendRecord]);
}

// ── Suite ───────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const daemonToken = `oh_dac_${randomBytes(24).toString('hex')}`;
  await spawnDaemon(DAEMON_PORT, daemonToken);
  daemonRig = { label: 'daemon', mcpUrl: `http://127.0.0.1:${DAEMON_PORT}/mcp`, token: daemonToken };

  // The daemon's own workspace + a rule that must sync DOWN on join.
  const daemonWorkspaces = await workspaceIds(daemonRig);
  expect(daemonWorkspaces.length).toBeGreaterThan(0);
  daemonWorkspaceId = daemonWorkspaces[0];
  await createRule(daemonRig, daemonWorkspaceId, SEEDED_ON_DAEMON);

  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-dac-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'backend.bindPort': DESKTOP_BIND_PORT,
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

  // Engine-ready gate: the desktop's own MCP endpoint answers 401 once
  // its bind is up.
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${DESKTOP_BIND_PORT}/mcp`, { method: 'POST', body: '{}' })).status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .toBe(401);

  const minted = (await bridgeInvoke({ type: 'oh.daemon.tokens.mint', label: 'dac-e2e' })) as {
    ok: boolean;
    secret?: string;
  };
  expect(minted.ok).toBe(true);
  desktopRig = { label: 'desktop', mcpUrl: `http://127.0.0.1:${DESKTOP_BIND_PORT}/mcp`, token: minted.secret ?? '' };
});

test.afterAll(async () => {
  await electronApp?.close();
  if (daemonProc && !daemonProc.killed) {
    daemonProc.kill('SIGTERM');
    await daemonExited;
  }
});

test('desktop serves its own surface before any backend exists', async () => {
  desktopHomeWorkspaceIds = await workspaceIds(desktopRig);
  expect(desktopHomeWorkspaceIds.length).toBeGreaterThan(0);
  expect(desktopHomeWorkspaceIds).not.toContain(daemonWorkspaceId);
});

test('joining the daemon syncs its workspace and data down', async () => {
  backendRecord = {
    id: '01980000-0000-7000-8000-00000000dac1',
    label: 'Daemon A',
    url: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: daemonRig.token,
    autoConnect: true,
    enabled: true,
    addedAt: new Date().toISOString(),
    lastConnectedAt: null,
  };
  await writeBackends([backendRecord]);

  // The daemon's workspace appears among the desktop's — consumed, not
  // copied: its Org binds to the backend record.
  await expect.poll(() => workspaceIds(desktopRig), { timeout: 30000 }).toContain(daemonWorkspaceId);
  // The seeded rule synced down with it.
  await expect.poll(async () => hasRule(desktopRig, SEEDED_ON_DAEMON), { timeout: 30000 }).toBe(true);
});

test('an edit in the consumed workspace routes up to the daemon', async () => {
  await createRule(desktopRig, daemonWorkspaceId, ROUTED_UP);
  await expect.poll(async () => hasRule(daemonRig, ROUTED_UP), { timeout: 30000 }).toBe(true);
});

test('a home-workspace edit never reaches the daemon', async () => {
  await createRule(desktopRig, desktopHomeWorkspaceIds[0], HOME_ONLY);
  // Deterministic settle: push another consumed-workspace edit through
  // and wait for IT to land — the pipe is provably live and ordered, so
  // the home rule not being there is a real withhold, not latency.
  const marker = `DaC settle marker ${RUN}`;
  await createRule(desktopRig, daemonWorkspaceId, marker);
  await expect.poll(async () => hasRule(daemonRig, marker), { timeout: 30000 }).toBe(true);
  expect(await hasRule(daemonRig, HOME_ONLY)).toBe(false);
  // And the daemon never gained a foreign workspace.
  expect(await workspaceIds(daemonRig)).toEqual([daemonWorkspaceId]);
});

test('kill switch queues consumed-workspace edits; re-enable flushes them', async () => {
  await setBackendEnabled(false);
  // The wire tears down on the registry write; give the reconcile a beat.
  await workbench.waitForTimeout(500);

  await createRule(desktopRig, daemonWorkspaceId, QUEUED_OFFLINE);
  expect(await hasRule(desktopRig, QUEUED_OFFLINE)).toBe(true);
  await workbench.waitForTimeout(1500);
  expect(await hasRule(daemonRig, QUEUED_OFFLINE)).toBe(false);

  await setBackendEnabled(true);
  await expect.poll(async () => hasRule(daemonRig, QUEUED_OFFLINE), { timeout: 30000 }).toBe(true);
});

test('evictWorkspace discards the consumed workspace host-locally', async () => {
  await setBackendEnabled(false);
  await workbench.waitForTimeout(500);

  const result = (await bridgeInvoke({ type: 'evictWorkspace', workspaceId: daemonWorkspaceId })) as {
    success: boolean;
    error?: string;
  };
  expect(result.success, result.error).toBe(true);

  // Gone locally, untouched on the daemon.
  await expect.poll(() => workspaceIds(desktopRig), { timeout: 15000 }).not.toContain(daemonWorkspaceId);
  expect(await hasRule(desktopRig, SEEDED_ON_DAEMON)).toBe(false);
  expect(await hasRule(daemonRig, SEEDED_ON_DAEMON)).toBe(true);
  expect(await hasRule(daemonRig, ROUTED_UP)).toBe(true);
});

test('re-enabling the wire syncs the evicted workspace back down', async () => {
  // The S11 three-layer law on the Node host: the eviction swept the
  // SQLite log stripes, the document store, and the wire echo set — so
  // the daemon's re-sent catch-up must apply, not die at a dedup layer.
  await setBackendEnabled(true);
  await expect.poll(() => workspaceIds(desktopRig), { timeout: 30000 }).toContain(daemonWorkspaceId);
  await expect.poll(async () => hasRule(desktopRig, SEEDED_ON_DAEMON), { timeout: 30000 }).toBe(true);
  expect(await hasRule(desktopRig, ROUTED_UP)).toBe(true);
});

test('SIGTERM shuts the spawned daemon down clean', async () => {
  daemonProc.kill('SIGTERM');
  const code = await daemonExited;
  expect(code).toBe(0);
});
