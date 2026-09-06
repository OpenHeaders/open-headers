/**
 * GraphQL workbench legs — the Phase B entity/editor gate and the
 * Phase C execution gate on the standalone extension workbench: real
 * Chromium with the built extension, no daemon. The SW runs the
 * compiled HTTP send natively (the twin of the node hosts' route), so
 * the execution legs ride the playground's GraphQL probe on port 3000.
 *
 *   E1  context-create: the collection `+` menu's "Add GraphQL Request"
 *       mints a persisted entity, the primed breadcrumb rename commits
 *       a name (the create-gesture rename law — the graphql-edit mode
 *       rides the same StatusBar rename gate as its siblings), the
 *       sidebar leaf carries the GQL tag, the Query tab is the default
 *       surface with the explorer's CTA scaffold, and the Query button
 *       is live with the ⌘/Ctrl+Enter hint.
 *   E2  edit → Save → reload → reopen: the endpoint URL, the document
 *       and the variables persist through a full page reload — the
 *       disk fan-out round trip (`graphql.yaml` + `query.graphql` +
 *       `variables.json`) read back through the editor.
 *   E3  the document plane: Prettify rewrites the buffer through the
 *       core printer, and Generate variables fills the drawer from the
 *       operation's variable definitions.
 *   E4  the flavor readings: the container's Settings section names
 *       the HTTP sub-tab "HTTP · GraphQL".
 *   E5  execution through the SW twin: Query posts the live draft's
 *       envelope to the probe — the response pane lands the 200 and the
 *       echoed variable in the body.
 *   E6  the 200-with-errors trap: the probe's `partial` field answers
 *       data beside errors[] — the meta strip carries the error-toned
 *       GraphQL errors tag.
 *   E7  Save Response: the exchange freezes into an HTTP ResponseExample
 *       marked `requestKind: 'graphql'`, nested under the GraphQL leaf
 *       in the sidebar and opened in its viewer tab.
 *   E8  sidebar rename + delete: the leaf's inline rename lands on the
 *       entity, and the delete gesture removes it from the tree (the
 *       example cascades with it).
 *
 * Requires the extension `dist/chrome` build.
 *
 * Seeding: onboarding rides a popup PAGE evaluate (never
 * serviceWorker.evaluate); the collection rides the real CRUD RPC from
 * the workbench page realm. The entity itself is created through the
 * UI — the creation gesture IS the leg.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const GRAPHQL_NAME = 'Probe GraphQL';
const RENAMED_NAME = 'Viewer GraphQL';
const GRAPHQL_URL = 'https://api.openheaders.io/graphql';
// Single line — Monaco auto-indents multi-line inserts (the page
// object's contract); Prettify is what lays it out.
const GRAPHQL_QUERY = 'query Viewer($first: Int) { viewer { id notes(first: $first) { id } } }';
const GRAPHQL_VARIABLES = '{"first": 10}';
// The playground's GraphQL probe — the Playwright webServer boots it.
const PROBE_URL = 'http://127.0.0.1:3000/api/graphql';
const ECHO_QUERY = 'query Echo($t: String!) { echo(text: $t) }';
const ECHO_VARIABLES = '{"t": "hi-from-the-workbench"}';
const PARTIAL_QUERY = '{ partial { ok broken } }';

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let collectionUid: string;

function urlInput() {
  return page.getByTestId('graphql-url-input').filter({ visible: true }).first();
}

function queryButton() {
  return page.getByTestId('graphql-query-button').filter({ visible: true }).first();
}

/** The collection row's hover-revealed `+` (create-only) menu icon. */
async function openCollectionAddMenu(): Promise<void> {
  const row = page.locator(`[data-item-id="req-col-${collectionUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.hover();
  await row.locator('.rules-sidebar-collection-actions .anticon-plus').first().click();
}

async function clickAddMenuItem(kind: string): Promise<void> {
  await page
    .locator('.ant-dropdown')
    .filter({ visible: true })
    .getByRole('menuitem', { name: 'Add Request' })
    .first()
    .hover();
  await page
    .locator('.ant-dropdown-menu-submenu-popup')
    .filter({ visible: true })
    // The item's accessible name leads with the kind code ("GQL GraphQL") —
    // match the label at its end.
    .getByRole('menuitem', { name: new RegExp(`${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
    .first()
    .click();
}

/** Commit a primed rename (the create gesture's breadcrumb input, the
 *  sidebar row's inline input): wait until the auto-focused input holds
 *  the default label (its text arrives selected), replace it with REAL
 *  keystrokes — the Space in the name is the sidebar tree's keyboard
 *  regression — then Enter. */
async function commitAutoRename(defaultLabel: RegExp, name: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.activeElement;
          return el instanceof HTMLInputElement ? el.value : '';
        }),
      { timeout: 5_000 },
    )
    .toMatch(defaultLabel);
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
}

/** The sidebar leaf for a GraphQL request by its display name — expands
 *  the suite collection first when a reload collapsed it. */
async function graphqlRow(name: string) {
  const row = page
    .locator('[data-item-id^="graphql-request-"]')
    .filter({ hasText: name })
    .filter({ visible: true })
    .first();
  const visibleNow = await row.waitFor({ state: 'visible', timeout: 3000 }).then(
    () => true,
    () => false,
  );
  if (!visibleNow) {
    const anyLeaf = await page.locator('[data-item-id^="graphql-request-"]').filter({ visible: true }).count();
    if (anyLeaf === 0) {
      await page.locator(`[data-item-id="req-col-${collectionUid}"]`).click();
    }
    await row.waitFor({ state: 'visible', timeout: 5_000 });
  }
  return row;
}

async function openGraphqlRequest(name: string): Promise<void> {
  await (await graphqlRow(name)).click();
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
}

async function saveAndAwaitClean(): Promise<void> {
  await page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
  await page
    .getByRole('button', { name: /Saved$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  // Onboarding gate — popup PAGE evaluate (the seeding law).
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );
  await popup.close();

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // The suite collection through the real CRUD RPC (page realm).
  collectionUid = await workbench.seedRequestCollection('GraphQL Suite');

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

// ── E1: context-create + the honest Query scaffold ──────────────────

test('E1 — the collection + menu creates a GraphQL request with the Query scaffold disabled-honest', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('GraphQL');
  await commitAutoRename(/^New GraphQL Request/, GRAPHQL_NAME);

  // The renamed entity lands as a sidebar leaf carrying the GQL tag.
  const row = await graphqlRow(GRAPHQL_NAME);
  await expect(row.getByText('GQL', { exact: true }).first()).toBeVisible();

  // The editor is open on the fresh entity — the Query tab is the
  // default surface with the explorer's CTA scaffold, and Query is
  // live: the hover hint carries the verb and the chord.
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByTestId('graphql-explorer-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await expect(page.getByTestId('graphql-explorer-introspect').filter({ visible: true }).first()).toBeDisabled();
  const button = queryButton();
  await expect(button).toBeEnabled();
  await page.mouse.move(0, 0);
  await button.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .filter({ hasText: 'Query' })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.mouse.move(0, 0);
});

// ── E2: edit → Save → reload → persisted ────────────────────────────

test('E2 — the endpoint, the document and the variables survive Save + reload + reopen', async () => {
  await urlInput().fill(GRAPHQL_URL);
  await workbench.fillMonaco(0, GRAPHQL_QUERY);
  // The Variables drawer starts collapsed on a request without
  // variables — the header row expands it.
  await page.getByTestId('graphql-variables-toggle').filter({ visible: true }).first().click();
  await workbench.fillMonaco(1, GRAPHQL_VARIABLES);
  await saveAndAwaitClean();

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await openGraphqlRequest(GRAPHQL_NAME);

  await expect(urlInput()).toHaveValue(GRAPHQL_URL);
  // Polled: a just-reopened Monaco lays out at collapsed width first
  // (the MQTT spec's sliver-regression note).
  await expect.poll(async () => workbench.monacoText(0), { timeout: 5_000 }).toContain('query Viewer');
  // The drawer reopens on its own when the request carries variables.
  await expect.poll(async () => workbench.monacoText(1), { timeout: 5_000 }).toContain('"first": 10');
});

// ── E3: the document plane — prettify + generate variables ──────────

test('E3 — Prettify lays the document out through the core printer and Generate variables fills the drawer', async () => {
  await page.getByTestId('graphql-prettify').filter({ visible: true }).first().click();
  // The pretty printer breaks the selection set onto its own lines —
  // the reopened single-line document now spans several view lines.
  await expect.poll(async () => workbench.monacoText(0), { timeout: 5_000 }).toMatch(/viewer \{\s*\n\s*id/);

  await page.getByTestId('graphql-generate-variables').filter({ visible: true }).first().click();
  // `$first: Int` synthesizes an integer sample — the drawer replaces
  // the stored `{"first": 10}` with the generated object.
  await expect.poll(async () => workbench.monacoText(1), { timeout: 5_000 }).toMatch(/"first":\s*\d+/);
  await saveAndAwaitClean();
});

// ── E4: the flavor readings on the container editor ─────────────────

test('E4 — the collection’s Settings section names the HTTP sub-tab “HTTP · GraphQL”', async () => {
  await page.locator(`[data-item-id="req-col-${collectionUid}"]`).click();
  await page
    .getByRole('tab', { name: /Settings/ })
    .filter({ visible: true })
    .first()
    .click();
  const kinds = page.getByTestId('oh-container-settings-kinds').filter({ visible: true }).first();
  await kinds.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(kinds.getByTestId('oh-container-settings-kind-http')).toHaveText('HTTP · GraphQL');
});

// ── E5: execution through the SW twin ──────────────────────────────

test('E5 — Query posts the live draft to the probe: the 200 lands in the pane with the echoed variable', async () => {
  // E4 left the container editor in front — back to the request.
  await openGraphqlRequest(GRAPHQL_NAME);
  await urlInput().fill(PROBE_URL);
  await workbench.fillMonaco(0, ECHO_QUERY);
  await workbench.fillMonaco(1, ECHO_VARIABLES);
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  const body = await workbench.responseRawBody();
  expect(body).toContain('"echo":"hi-from-the-workbench"');
  // A clean answer carries no errors tag; the probe's extensions ride
  // beside data and get their own neutral tag.
  expect(await page.getByTestId('oh-response-graphql-errors').filter({ visible: true }).count()).toBe(0);
  await page
    .getByTestId('oh-response-graphql-extensions')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
});

// ── E6: the 200-with-errors trap ────────────────────────────────────

test('E6 — a partial answer (data beside errors[]) carries the error-toned GraphQL errors tag', async () => {
  await workbench.fillMonaco(0, PARTIAL_QUERY);
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  const errorsTag = page.getByTestId('oh-response-graphql-errors').filter({ visible: true }).first();
  await errorsTag.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(errorsTag).toHaveText('1 error');
  await expect(errorsTag).toHaveClass(/ant-tag-error/);
  // The popover names the failed path — the trap read honestly.
  await errorsTag.hover();
  await page
    .getByTestId('oh-response-graphql-error')
    .filter({ visible: true })
    .filter({ hasText: 'partial.broken' })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.mouse.move(0, 0);
});

// ── E7: Save Response ───────────────────────────────────────────────

test('E7 — Save Response freezes the exchange as an example nested under the GraphQL leaf', async () => {
  await page.getByRole('button', { name: 'More response actions' }).filter({ visible: true }).last().click();
  await page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden)')
    .getByRole('menuitem', { name: /Save Response/ })
    .first()
    .click();
  // The minted example opens in its viewer tab (the "Open as Request" action is the viewer's).
  await page
    .getByRole('button', { name: /Open as Request/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  // The sidebar nests the example leaf under the GraphQL request row —
  // the row toggles its children on open.
  const leaf = page.locator('[data-item-id^="resp-example-"]').filter({ visible: true }).first();
  if (!(await leaf.isVisible().catch(() => false))) {
    await (await graphqlRow(GRAPHQL_NAME)).click();
  }
  await leaf.waitFor({ state: 'visible', timeout: 5_000 });
  await openGraphqlRequest(GRAPHQL_NAME);
});

// ── E8: sidebar rename + delete ─────────────────────────────────────

test('E8 — the sidebar leaf renames inline and the delete gesture removes the entity', async () => {
  const row = await graphqlRow(GRAPHQL_NAME);
  await row.hover();
  await row.locator('.rules-sidebar-item-menu').click();
  await page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Rename' })
    .first()
    .click();
  await commitAutoRename(new RegExp(`^${GRAPHQL_NAME}`), RENAMED_NAME);
  const renamed = await graphqlRow(RENAMED_NAME);
  await expect(renamed).toBeVisible();

  // The reopened editor carries the committed name on its tab.
  await openGraphqlRequest(RENAMED_NAME);
  await expect(
    page
      .getByRole('tab', { name: new RegExp(RENAMED_NAME) })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();

  await renamed.hover();
  await renamed.locator('.rules-sidebar-item-menu').click();
  await page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Delete' })
    .first()
    .click();
  const confirm = page.locator('.ant-modal-confirm .ant-btn-dangerous');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await expect(page.locator('[data-item-id^="graphql-request-"]').filter({ visible: true })).toHaveCount(0, {
    timeout: 5_000,
  });
  // The example cascaded with its parent.
  await expect(page.locator('[data-item-id^="resp-example-"]').filter({ visible: true })).toHaveCount(0, {
    timeout: 5_000,
  });
});
