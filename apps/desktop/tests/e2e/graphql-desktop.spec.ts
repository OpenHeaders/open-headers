/**
 * GraphQL desktop in-process legs — the Phase C execution gate on the
 * REAL stack: the built desktop app (isolated userData, off-default
 * daemon port), the shared workbench UI driving a Query through the
 * node host's `executeGraphqlRequest` route — the entity compiled ONCE
 * into its HTTP send and run by the HTTP pipeline — against the
 * playground's GraphQL probe on `/api/graphql` (the Playwright
 * webServer boots the playground).
 *
 *   G1  echo round trip: Query posts the envelope, the pane lands the
 *       200 and the echoed variable in the body; the probe's
 *       `extensions` object gets its neutral strip tag.
 *   G2  the 200-with-errors trap: `partial` answers data beside
 *       errors[] — the error-toned GraphQL errors tag names the path.
 *   G3  auth inheritance through the compile: an `inherit` request
 *       resolves the collection pool's bearer and the probe's `gated`
 *       field unlocks; its `none` sibling is refused (errors tag, data
 *       null) — the same pool the HTTP requests read.
 *   G4  the operation select: a two-operation document shows the select
 *       on the stored pick; switching it changes the operation on the
 *       wire.
 *   G5  Save Response: the exchange freezes into an HTTP ResponseExample
 *       marked for the GraphQL parent — viewer tab, sidebar leaf under
 *       the GraphQL row.
 *
 * Deliberately NOT here (covered elsewhere): the entity/editor
 * lifecycle (extension `graphql-workbench.spec.ts`), the ⌘/Ctrl+Enter
 * chord (platform-modifier dispatch is not portable under Playwright),
 * the compile's pick rule (oracle unit suite).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the probe collection + the G-leg requests
 * (built and schema-validated by `fixtures/graphql-desktop-seed.ts`
 * under the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports (18137…18668, 19137…
// 19942, 20037…21837 — the `DAEMON_PORT =` census across this dir).
const DAEMON_PORT = 21937;
const PROBE_URL = 'http://127.0.0.1:3000/api/graphql';

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
    },
  });
  workbench = await electronApp.firstWindow();
  await expect
    .poll(
      async () => {
        try {
          const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
          return typeof res.activeWorkspaceId === 'string';
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

// ── Workbench DOM helpers (the shared UI's selectors; visible-scoped —
//    background tabs stay mounted) ───────────────────────────────────

async function showRequestsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

async function collapseDocsPanel(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected')) === 'true') {
    await docsTab.click();
  }
}

function queryButton(): Locator {
  return workbench.getByTestId('graphql-query-button').filter({ visible: true }).first();
}

function errorsTag(): Locator {
  return workbench.getByTestId('oh-response-graphql-errors').filter({ visible: true }).first();
}

async function openGraphqlRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="graphql-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = workbench.locator('[data-item-id="req-col-e2egqcol"]');
    await collection.waitFor({ state: 'visible', timeout: 10_000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await queryButton().waitFor({ state: 'visible', timeout: 10_000 });
}

/** Query and wait for the settled status chip; return its text. */
async function queryAndAwaitStatus(): Promise<string> {
  await queryButton().click();
  const chip = workbench.getByTestId('oh-response-status').filter({ visible: true }).first();
  await chip.waitFor({ state: 'visible', timeout: 15_000 });
  return (await chip.textContent())?.trim() ?? '';
}

/** The response body as the Pretty view renders it — the response
 *  region's Monaco (short bodies, nothing virtualized away); NBSPs
 *  normalized, so assertions match on `"key": "value"` shapes. */
async function responseBodyText(): Promise<string> {
  const lines = workbench
    .locator('.rules-response-tabs')
    .filter({ visible: true })
    .locator('.monaco-editor .view-lines')
    .first();
  await lines.waitFor({ state: 'visible', timeout: 10_000 });
  return (await lines.innerText()).replace(/\u00a0/g, ' ');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-graphql-desktop-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await electronApp.close();

  // Seed the workspace slots with schema-validated entities (tsx via
  // the extension package — the one that carries the tsx devDep).
  const seeded = spawnSync(
    'pnpm',
    ['--filter', '@openheaders/extension', 'exec', 'tsx', path.join(__dirname, 'fixtures/graphql-desktop-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, OH_E2E_GRAPHQL_PROBE_URL: PROBE_URL, OH_E2E_WORKSPACE_ID: workspaceId },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots and open the requests view.
  await launchApp();
  await showRequestsView();
  await collapseDocsPanel();
  await workbench.locator('[data-item-id="req-col-e2egqcol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── G1: the echo round trip ─────────────────────────────────────────

test('G1 — Query posts the envelope: the 200 lands with the echoed variable and the extensions tag', async () => {
  await openGraphqlRequest('e2egqd01');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  expect(await responseBodyText()).toMatch(/"echo":\s*"hi-from-the-desktop"/);
  expect(await workbench.getByTestId('oh-response-graphql-errors').filter({ visible: true }).count()).toBe(0);
  await workbench
    .getByTestId('oh-response-graphql-extensions')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
});

// ── G2: the 200-with-errors trap ────────────────────────────────────

test('G2 — a partial answer carries the error-toned errors tag naming the failed path', async () => {
  await openGraphqlRequest('e2egqd02');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  await errorsTag().waitFor({ state: 'visible', timeout: 5_000 });
  await expect(errorsTag()).toHaveText('1 error');
  await expect(errorsTag()).toHaveClass(/ant-tag-error/);
  await errorsTag().hover();
  await workbench
    .getByTestId('oh-response-graphql-error')
    .filter({ visible: true })
    .filter({ hasText: 'partial.broken' })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await workbench.mouse.move(0, 0);
  // The body is the wire's envelope verbatim, errors first (the Pretty
  // view virtualizes past the viewport, so the head of the body is
  // what a short pane renders).
  expect(await responseBodyText()).toMatch(/"message":\s*"The `broken` field always errors\."/);
});

// ── G3: auth inheritance through the compile ────────────────────────

test('G3 — an inherit request unlocks the gated field through the collection’s bearer; a none sibling is refused', async () => {
  await openGraphqlRequest('e2egqd03');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  expect(await workbench.getByTestId('oh-response-graphql-errors').filter({ visible: true }).count()).toBe(0);
  const unlocked = await responseBodyText();
  expect(unlocked).toMatch(/"gated":\s*"unlocked"/);
  expect(unlocked).toMatch(/"name":\s*"John Doe"/);

  await openGraphqlRequest('e2egqd04');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  await errorsTag().waitFor({ state: 'visible', timeout: 5_000 });
  await errorsTag().hover();
  await workbench
    .getByTestId('oh-response-graphql-error')
    .filter({ visible: true })
    .filter({ hasText: 'UNAUTHENTICATED' })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await workbench.mouse.move(0, 0);
});

// ── G4: the operation select ────────────────────────────────────────

test('G4 — a two-operation document shows the select on the stored pick; switching it changes the wire', async () => {
  await openGraphqlRequest('e2egqd05');
  const select = workbench.getByTestId('graphql-operation-select').filter({ visible: true }).first();
  await select.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(select).toContainText('B');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  expect(await responseBodyText()).toMatch(/"echo":\s*"answer-b"/);

  await select.click();
  await workbench.locator('.ant-select-dropdown').filter({ visible: true }).getByTitle('A').first().click();
  await expect(select).toContainText('A');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  expect(await responseBodyText()).toMatch(/"echo":\s*"answer-a"/);
});

// ── G5: Save Response ───────────────────────────────────────────────

test('G5 — Save Response mints the example under the GraphQL leaf and opens its viewer', async () => {
  await openGraphqlRequest('e2egqd01');
  expect(await queryAndAwaitStatus()).toBe('200 OK');
  await workbench.getByRole('button', { name: 'More response actions' }).filter({ visible: true }).last().click();
  await workbench
    .locator('.ant-dropdown:not(.ant-dropdown-hidden)')
    .getByRole('menuitem', { name: /Save Response/ })
    .first()
    .click();
  await workbench
    .getByRole('button', { name: /Open as Request/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  const leaf = workbench.locator('[data-item-id^="resp-example-"]').filter({ visible: true }).first();
  if (!(await leaf.isVisible().catch(() => false))) {
    await workbench.locator('[data-item-id="graphql-request-e2egqd01"]').click();
  }
  await leaf.waitFor({ state: 'visible', timeout: 5_000 });
});
