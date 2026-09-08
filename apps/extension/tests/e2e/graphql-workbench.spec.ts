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
 *   E3  the document plane: Format rewrites the buffer through the
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
 *   E8  the schema plane's introspection source: the explorer CTA runs
 *       INTROSPECTION_QUERY through the SW twin (the compile — the
 *       request's auth and settings apply), the docs explorer lists the
 *       probe's Query fields, a deprecated field names its reason,
 *       "Insert at cursor" lands the field in the document, and the
 *       Schema tab reports the resolved schema with Refresh.
 *   E9  the schema plane's spec source: the SPECS section's `+` menu
 *       mints a GraphQL spec whose editor shows the SDL outline groups
 *       and a clean validation strip; the request's Schema tab points
 *       at the Spec tab, the Spec tab links it, the Schema tab reads
 *       the same link and the explorer resolves from the spec (the
 *       entity's synced `specLink`, saved).
 *   E10 sidebar rename + delete: the leaf's inline rename lands on the
 *       entity, and the delete gesture removes it from the tree (the
 *       example cascades with it).
 *   E11 Generate Collection from the E9 spec (the Phase E bridge): the
 *       modal names the endpoint, one GraphQL request per Query /
 *       Mutation root field lands in a folder per root type, the
 *       subscription field is named and left out, and a generated
 *       mutation runs against the probe through the compile.
 *   E12 Convert to GraphQL request: an HTTP request whose body is the
 *       graphql body mode becomes a GraphQL request in the same place
 *       through the sidebar verb — the HTTP row is gone, the new row
 *       runs against the probe with the carried document + variables.
 *   E13 Copy as cURL from the GraphQL editor's ⋯ menu: the snippet is
 *       one POST of the envelope (the clipboard write is stubbed and
 *       read back — the copy-snippet spec's idiom).
 *   E14 the import hub's schema-file leg: pasted SDL is recognized as a
 *       GraphQL schema, the sectioned modal lands it as a `graphql`
 *       Spec, and the SPECS section shows it.
 *   E15 the builder writes the document (the Phase F two-way half):
 *       the explorer projects the converted request's `echo`; checking
 *       `viewer` lands it with its first leaf and expands the row, a
 *       nested leaf joins the set, unchecking `echo` removes it AND its
 *       orphaned `$t`, an optional argument checks in as a declared
 *       variable, a typed literal replaces it (the variable undeclared),
 *       a required-argument field declares its variable — and the built
 *       document runs against the probe through the compile.
 *   E16 the document writes the explorer: typed text projects onto the
 *       checkboxes (a nested leaf checked, its sibling not, an argument
 *       value read back), a broken document disables the builder with
 *       the notice, and a mended one re-enables it.
 *   E17 the explorer header and the live cell: the descriptions toggle
 *       persists across a remount, the root sections fold, the pane
 *       folds to its strip, Refresh re-introspects, a String argument
 *       writes quoted as the user types and undoes as one step, a
 *       required argument unchecked takes its field, an argument on an
 *       unchecked field selects it.
 *   E18 the member rows: a union-typed field expands to `... on T` rows
 *       (one per member, the type's description beneath, no field rows
 *       of its own); checking one lands the field with the fragment on
 *       the member's first leaf, a member leaf joins the fragment,
 *       unchecking the fragment as the field's last selection leaves
 *       `__typename` with the field still checked; an interface-typed
 *       field lists its own fields first, then its implementers.
 *   E20 the input-object rows: an argument of an input type expands to
 *       its input fields; checking one opens the argument's literal
 *       (promoting the `$input` a required argument landed with, which
 *       loses its declaration) with the key as a declared variable, a
 *       typed literal replaces it, a sibling key appends, a nested
 *       input type expands and lands as a nested literal, unchecking
 *       the last nested key takes its parent, and the last key of the
 *       required argument takes the field.
 *   E21 the multi-operation model: the other types' sections stay live;
 *       the editor dims the operations the pick is not; a check on a
 *       mutation field appends a named mutation
 *       (the anonymous query named after its first root field in the
 *       same edit), the select, the tree and the dim follow it; a click
 *       inside the query moves the pick back; a second
 *       mutation field lands IN the existing mutation and the pick
 *       returns; Query runs the picked operation.
 *   E22 the Spec tab (Phase J) on a generated request: the E11
 *       collection's deleteNote reads its own link to the E9 spec with
 *       the collection line; the picker changes it to the E14 spec and
 *       the Schema tab resolves that one; clearing the picker falls
 *       back to the collection's link (the inherited placeholder, the
 *       introspection source disabled), saved.
 *
 * Requires the extension `dist/chrome` build.
 *
 * Seeding: onboarding rides a popup PAGE evaluate (never
 * serviceWorker.evaluate); the collection rides the real CRUD RPC from
 * the workbench page realm. The entity itself is created through the
 * UI — the creation gesture IS the leg.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const GRAPHQL_NAME = 'Probe GraphQL';
const RENAMED_NAME = 'Viewer GraphQL';
const GRAPHQL_URL = 'https://api.openheaders.io/graphql';
// Single line — Monaco auto-indents multi-line inserts (the page
// object's contract); Format is what lays it out.
const GRAPHQL_QUERY = 'query Viewer($first: Int) { viewer { id notes(first: $first) { id } } }';
const GRAPHQL_VARIABLES = '{"first": 10}';
// The playground's GraphQL probe — the Playwright webServer boots it.
const PROBE_URL = 'http://127.0.0.1:3000/api/graphql';
const ECHO_QUERY = 'query Echo($t: String!) { echo(text: $t) }';
const ECHO_VARIABLES = '{"t": "hi-from-the-workbench"}';
const PARTIAL_QUERY = '{ partial { ok broken } }';
const SPEC_NAME = 'Notes Schema';

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
  // Capture-the-write clipboard stub (E13) — Chromium refuses clipboard
  // permission grants on chrome-extension:// origins, so the text the
  // app hands the platform API is recorded instead.
  await page.addInitScript(() => {
    navigator.clipboard.writeText = (text: string) => {
      (window as unknown as { __ohCopiedText?: string }).__ohCopiedText = text;
      return Promise.resolve();
    };
  });
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
  // No endpoint yet — the scaffold's slot holds the hint, not the
  // introspection action.
  await expect(page.getByTestId('graphql-explorer-hint').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByTestId('graphql-explorer-introspect')).toHaveCount(0);
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

// ── E3: the document plane — format + generate variables ────────────

test('E3 — Format lays the document out through the core printer and Generate variables fills the drawer', async () => {
  // The query editor's cluster is the tab's first; the variables drawer's
  // JSON cluster follows it.
  await page
    .getByTestId('graphql-query-tab')
    .filter({ visible: true })
    .first()
    .getByTestId('code-editor-format')
    .first()
    .click();
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

// ── E8: the introspection source ────────────────────────────────────

test('E8 — the explorer CTA introspects through the SW twin: fields, deprecations, insert at cursor, the Schema tab', async () => {
  await page.getByRole('tab', { name: 'Query', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('graphql-explorer-introspect').filter({ visible: true }).first().click();
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  await explorer.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(explorer.getByTestId('graphql-explorer-field-Query.echo')).toBeVisible();

  // Search narrows to the deprecated `me`; its page names the reason.
  await explorer.getByTestId('graphql-explorer-search').fill('me');
  await explorer.getByTestId('graphql-explorer-field-Query.me').getByRole('button', { name: 'me' }).click();
  await expect(explorer.getByTestId('graphql-explorer-deprecated')).toContainText('Use `viewer`.');

  // Insert at cursor — one-way into the document.
  await explorer.getByTestId('graphql-explorer-insert').click();
  await expect.poll(async () => workbench.monacoText(0), { timeout: 5_000 }).toContain('me { }');

  // The Schema tab reports the resolved schema and offers Refresh.
  await page.getByRole('tab', { name: 'Schema', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('graphql-schema-summary').filter({ visible: true }).first()).toContainText('Query');
  await expect(page.getByTestId('graphql-schema-introspect').filter({ visible: true }).first()).toHaveText('Refresh');
});

// ── E9: the spec source ─────────────────────────────────────────────

test('E9 — a GraphQL spec from the SPECS menu outlines its SDL, and the request links it as its schema source', async () => {
  await page.getByTestId('sidebar-create-spec').filter({ visible: true }).first().click();
  await page
    .locator('.ant-dropdown')
    .filter({ visible: true })
    .getByRole('menuitem', { name: /GraphQL$/ })
    .first()
    .click();
  await commitAutoRename(/^New Specification/, SPEC_NAME);
  const outline = page.getByTestId('spec-outline-pane').filter({ visible: true }).first();
  await outline.waitFor({ state: 'visible', timeout: 5_000 });
  // Root group rows read "▶ Query 3" — the label plus the child count.
  for (const group of ['Query', 'Mutation', 'Subscription', 'Types', 'Directives']) {
    await expect(outline.getByRole('treeitem', { name: new RegExp(`^▶ ${group} \\d`) }).first()).toBeVisible();
  }
  await expect(page.getByText('No problems found').filter({ visible: true }).first()).toBeVisible();

  // Back on the request: the Schema tab's spec source has no link yet
  // and points at the Spec tab — the binding surface — where the link
  // is set; the Schema tab then reads the same link.
  await openGraphqlRequest(GRAPHQL_NAME);
  await page.getByRole('tab', { name: 'Schema', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('graphql-schema-source').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .getByTitle('Linked GraphQL spec')
    .first()
    .click();
  await page.getByTestId('graphql-schema-spec-link').filter({ visible: true }).first().click();
  await page.getByTestId('graphql-spec-select').filter({ visible: true }).first().click();
  await page.locator('.ant-select-dropdown').filter({ visible: true }).getByTitle(SPEC_NAME).first().click();
  await expect(page.getByTestId('graphql-spec-name').filter({ visible: true }).first()).toHaveText(SPEC_NAME);
  await page.getByRole('tab', { name: 'Schema', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('graphql-schema-spec-name').filter({ visible: true }).first()).toHaveText(SPEC_NAME);
  await expect(page.getByTestId('graphql-schema-summary').filter({ visible: true }).first()).toContainText(
    'Subscription',
  );
  await page.getByRole('tab', { name: 'Query', exact: true }).filter({ visible: true }).first().click();
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  await expect(explorer.getByTestId('graphql-explorer-field-Query.viewer')).toBeVisible();
  await expect(explorer.getByTestId('graphql-explorer-field-Query.echo')).toHaveCount(0);
  await saveAndAwaitClean();
});

// ── E10: sidebar rename + delete ────────────────────────────────────

test('E10 — the sidebar leaf renames inline and the delete gesture removes the entity', async () => {
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

// ── E11: Generate Collection from the GraphQL spec ──────────────────

const GENERATED_COLLECTION = 'Notes Generated';

test('E11 — Generate Collection lands one GraphQL request per root field, foldered per root type, and a generated mutation runs', async () => {
  const specRow = page
    .locator('[data-item-id^="spec-"]')
    .filter({ hasText: SPEC_NAME })
    .filter({ visible: true })
    .first();
  await specRow.waitFor({ state: 'visible', timeout: 5_000 });
  await specRow.click();
  await page.getByTestId('spec-generate-collection').filter({ visible: true }).first().click();
  const nameInput = page.getByTestId('spec-generate-name').filter({ visible: true }).first();
  await nameInput.waitFor({ state: 'visible', timeout: 5_000 });
  await nameInput.fill(GENERATED_COLLECTION);
  await page.getByTestId('spec-generate-graphql-url').filter({ visible: true }).first().fill(PROBE_URL);
  // The scaffold's Subscription field is named and left out.
  await expect(page.getByTestId('spec-generate-graphql-subscriptions').filter({ visible: true }).first()).toContainText(
    'noteCreated',
  );
  await page.getByTestId('spec-generate-confirm').filter({ visible: true }).first().click();

  const collection = page
    .locator('[data-item-id^="req-col-"]')
    .filter({ hasText: GENERATED_COLLECTION })
    .filter({ visible: true })
    .first();
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
  const mutationFolder = page
    .locator('[data-item-id^="req-folder-"]')
    .filter({ hasText: 'Mutation' })
    .filter({ visible: true })
    .first();
  await mutationFolder.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(
    page.locator('[data-item-id^="req-folder-"]').filter({ hasText: 'Query' }).filter({ visible: true }).first(),
  ).toBeVisible();
  await mutationFolder.click();
  const deleteNote = page
    .locator('[data-item-id^="graphql-request-"]')
    .filter({ hasText: 'deleteNote' })
    .filter({ visible: true })
    .first();
  await deleteNote.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(
    page.locator('[data-item-id^="graphql-request-"]').filter({ hasText: 'createNote' }).filter({ visible: true }),
  ).toHaveCount(1);
  await deleteNote.click();
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
  await expect(urlInput()).toHaveValue(PROBE_URL);
  // The generated document + example variables run as generated.
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  // Polled: the Pretty view's Monaco lays its lines out a beat after the status lands.
  await expect.poll(() => workbench.responsePrettyText(), { timeout: 5_000 }).toMatch(/"deleteNote":\s*(true|false)/);
});

// ── E12: Convert to GraphQL request ─────────────────────────────────

const CONVERTED_NAME = 'Echo HTTP';

test('E12 — the sidebar verb converts an HTTP request with a GraphQL body into a GraphQL request in its place', async () => {
  const httpUid = await workbench.seedRequest({
    name: CONVERTED_NAME,
    method: 'POST',
    url: PROBE_URL,
    auth: { type: 'none' },
    body: { type: 'graphql', content: ECHO_QUERY, graphqlVariables: ECHO_VARIABLES },
  });
  const httpRow = page.locator(`[data-item-id="request-${httpUid}"]`);
  if (!(await httpRow.isVisible().catch(() => false))) {
    for (const colRow of await page.locator('[data-item-id^="req-col-"]').filter({ visible: true }).all()) {
      if (await httpRow.isVisible().catch(() => false)) break;
      await colRow.click();
      await httpRow.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => {});
    }
  }
  await httpRow.waitFor({ state: 'visible', timeout: 5_000 });
  await httpRow.hover();
  await httpRow.locator('.rules-sidebar-item-menu').click();
  await page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', {
      hasText: 'Convert to GraphQL request',
    })
    .first()
    .click();
  await page.getByTestId('request-convert-graphql-confirm').waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.ant-modal-confirm .ant-btn-primary').first().click();

  const converted = await graphqlRow(CONVERTED_NAME);
  await expect(converted).toBeVisible();
  await expect(page.locator(`[data-item-id="request-${httpUid}"]`)).toHaveCount(0, { timeout: 5_000 });
  // The new editor opened on the converted entity: the carried
  // document + variables run against the probe.
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
  await expect(urlInput()).toHaveValue(PROBE_URL);
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  await expect.poll(() => workbench.responsePrettyText(), { timeout: 5_000 }).toContain('hi-from-the-workbench');
});

// ── E13: Copy as cURL ───────────────────────────────────────────────

test('E13 — Copy as cURL from the GraphQL editor renders one POST of the envelope', async () => {
  await openGraphqlRequest(CONVERTED_NAME);
  await workbench.copyAsFromEditor('cURL');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ohCopiedText?: string }).__ohCopiedText ?? ''), {
      timeout: 5_000,
    })
    .toMatch(/^curl /);
  const copied = await page.evaluate(() => (window as unknown as { __ohCopiedText?: string }).__ohCopiedText ?? '');
  expect(copied).toContain(PROBE_URL);
  expect(copied).toContain("-X 'POST'");
  expect(copied).toContain('"query"');
  expect(copied).toContain('hi-from-the-workbench');
});

// ── E14: the import hub's schema-file leg ───────────────────────────

const PASTED_SDL = 'type Query {\n  ping: String!\n}\n';

test('E14 — a pasted SDL document is recognized as a GraphQL schema and lands as a spec', async () => {
  await page.getByTestId('sidebar-create-request').filter({ visible: true }).first().click();
  await page
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Import' })
    .first()
    .click();
  const paste = page.getByPlaceholder('Paste a curl command or URL').filter({ visible: true }).first();
  await paste.waitFor({ state: 'visible', timeout: 5_000 });
  await paste.fill(PASTED_SDL);
  await paste.press('Enter');
  const modal = page
    .locator('.ant-modal')
    .filter({ hasText: 'IMPORT GRAPHQL SCHEMA' })
    .filter({ visible: true })
    .first();
  await modal.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(modal.getByTestId('import-sectioned-spec')).toContainText('GraphQL');
  // The button's icon prefixes its accessible name — anchor the label at the end (the Save driver's idiom).
  await modal.getByRole('button', { name: /Import$/ }).click();
  const specRow = page
    .locator('[data-item-id^="spec-"]')
    .filter({ hasText: 'GraphQL schema' })
    .filter({ visible: true })
    .first();
  await specRow.waitFor({ state: 'visible', timeout: 10_000 });
});

// ── E15: the builder writes the document ────────────────────────────

const BUILDER_ECHO_DOCUMENT = 'query Echo($t: String!) { echo(text: $t) }';

test('E15 — the builder’s checkboxes write the document: selections, an argument as a variable then a literal, orphaned variables undeclared', async () => {
  await openGraphqlRequest(CONVERTED_NAME);
  await page.getByRole('tab', { name: 'Query', exact: true }).filter({ visible: true }).first().click();
  await workbench.fillMonaco(0, BUILDER_ECHO_DOCUMENT);
  // The converted request has no schema source yet — introspect the
  // probe through the compile (the E8 path).
  await page.getByTestId('graphql-explorer-introspect').filter({ visible: true }).first().click();
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  await explorer.waitFor({ state: 'visible', timeout: 10_000 });
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  const document = () => workbench.monacoText(0);

  // The document projects onto the root: `echo` checked, `viewer` not.
  await expect(check('query.echo')).toBeChecked();
  await expect(check('query.viewer')).not.toBeChecked();

  // A composite lands with its first leaf, space-separated on the one-line set; the row expands.
  await check('query.viewer').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('echo(text: $t) viewer { id }');
  await expect(check('query.viewer')).toBeChecked();
  await check('query.viewer.name').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('viewer { id name }');

  // Unchecking `echo` takes the node and the `$t` only it referenced.
  await check('query.echo').click();
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id name } }');

  // An optional argument checks in as a declared variable, a typed literal replaces it and undeclares the variable.
  await check('query.users').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('users { totalCount }');
  await explorer.getByTestId('graphql-builder-arg-check-query.users.first').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($first: Int) { viewer { id name } users(first: $first) { totalCount } }');
  const firstValue = explorer.getByTestId('graphql-builder-arg-value-query.users.first');
  await expect(firstValue).toHaveValue('$first');
  await firstValue.fill('2');
  await firstValue.press('Enter');
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo { viewer { id name } users(first: 2) { totalCount } }');

  // A required argument rides as a variable declared with its type.
  await check('query.user').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($id: ID!) { viewer { id name } users(first: 2) { totalCount } user(id: $id) { id } }');

  // The built document runs: generated variables, one POST through the compile.
  await page.getByTestId('graphql-generate-variables').filter({ visible: true }).first().click();
  await expect.poll(async () => workbench.monacoText(1), { timeout: 5_000 }).toMatch(/"id":\s*"/);
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  await expect.poll(() => workbench.responsePrettyText(), { timeout: 5_000 }).toContain('"totalCount"');
});

// ── E16: the document writes the explorer ───────────────────────────

test('E16 — typed text projects onto the builder, a broken document disables it, a mended one re-enables it', async () => {
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  await workbench.fillMonaco(0, '{ viewer { email } users(first: 3) { totalCount } }');
  await expect(check('query.viewer')).toBeChecked();
  await expect(check('query.user')).not.toBeChecked();
  // The rows expanded in E15 keep their state — the nested projection reads back.
  await expect(check('query.viewer.email')).toBeChecked();
  await expect(check('query.viewer.name')).not.toBeChecked();
  await expect(explorer.getByTestId('graphql-builder-arg-check-query.users.first')).toBeChecked();
  await expect(explorer.getByTestId('graphql-builder-arg-value-query.users.first')).toHaveValue('3');

  // A document that does not parse has nothing to project — the notice, every checkbox disabled.
  await workbench.fillMonaco(0, '{ viewer {');
  await explorer.getByTestId('graphql-builder-broken').waitFor({ state: 'visible', timeout: 5_000 });
  await expect(check('query.viewer')).toBeDisabled();

  // Mended, the builder is back and the projection follows the text.
  await workbench.fillMonaco(0, '{ partial { ok } }');
  await expect(explorer.getByTestId('graphql-builder-broken')).toHaveCount(0);
  await expect(check('query.partial')).toBeChecked();
  await expect(check('query.viewer')).not.toBeChecked();
  await expect(check('query.viewer')).toBeEnabled();
});

// ── E17: the explorer header — descriptions, folding roots, the strip; the live value cell ──

test('E17 — descriptions toggle and persist, the root sections fold, the pane folds to its strip, Refresh re-introspects, a String argument writes as the user types and undoes as one', async () => {
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  const document = () => workbench.monacoText(0);
  const tab = (name: string) => page.getByRole('tab', { name, exact: true }).filter({ visible: true }).first();
  await workbench.fillMonaco(0, 'query Echo { viewer { id } }');

  // Descriptions show under the root rows by default; the toggle hides
  // them, and the choice outlives the explorer — a tab switch remounts it.
  await expect(explorer.getByTestId('graphql-builder-description-query.echo')).toContainText('Echoes');
  await explorer.getByTestId('graphql-explorer-descriptions').click();
  await expect(explorer.getByTestId('graphql-builder-description-query.echo')).toHaveCount(0);
  await tab('Headers').click();
  await tab('Query').click();
  await expect(check('query.viewer')).toBeChecked();
  await expect(explorer.getByTestId('graphql-builder-description-query.echo')).toHaveCount(0);
  await explorer.getByTestId('graphql-explorer-descriptions').click();
  await expect(explorer.getByTestId('graphql-builder-description-query.echo')).toBeVisible();

  // The Mutation section folds on its caret and unfolds on the row block.
  await expect(check('mutation.createNote')).toBeVisible();
  await explorer.getByTestId('graphql-explorer-root-toggle-mutation').click();
  await expect(check('mutation.createNote')).toHaveCount(0);
  await explorer.getByTestId('graphql-explorer-root-row-mutation').click();
  await expect(check('mutation.createNote')).toBeVisible();

  // The pane folds to its strip and comes back. The hidden pane is read
  // off the split library's own class, on the innermost split pane
  // holding the explorer (the editor group's outer pane holds it too):
  // its zero-width box still holds the explorer's one-pixel border,
  // which Playwright counts as visible.
  const explorerPane = page
    .locator('.split-view-view')
    .filter({ has: page.getByTestId('graphql-explorer') })
    .last();
  await explorer.getByTestId('graphql-explorer-hide').click();
  const strip = page.getByTestId('graphql-explorer-strip').filter({ visible: true }).first();
  await expect(strip).toBeVisible();
  await expect(explorerPane).not.toHaveClass(/split-view-view-visible/);
  await strip.click();
  await expect(explorerPane).toHaveClass(/split-view-view-visible/);
  await expect(strip).toHaveCount(0);
  await expect(check('query.viewer')).toBeChecked();

  // The row block is the target: a click expands a composite row, and
  // checks a leaf — the same either way, with or without a description.
  await explorer.getByTestId('graphql-builder-row-query.viewer').click();
  await expect(check('query.viewer.id')).toBeChecked();
  await explorer.getByTestId('graphql-builder-row-query.failing').click();
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id } failing }');
  await explorer.getByTestId('graphql-builder-row-query.failing').click();
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id } }');

  // Refresh re-runs the introspection from the header; the projection survives it.
  await explorer.getByTestId('graphql-explorer-refresh').click();
  await expect(explorer.getByTestId('graphql-explorer-refresh')).toBeEnabled({ timeout: 10_000 });
  await expect(check('query.viewer')).toBeChecked();

  // A String argument writes as the user types — quoted for them, no
  // Enter — and the typing session undoes as ONE step; a `$variable`
  // typed in the cell passes through and declares itself.
  await check('query.echo').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($text: String!) { viewer { id } echo(text: $text) }');
  await expect(explorer.getByTestId('graphql-builder-arg-tag-query.echo.text')).toHaveText('ARG');
  const textValue = explorer.getByTestId('graphql-builder-arg-value-query.echo.text');
  await textValue.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await textValue.pressSequentially('hi');
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id } echo(text: "hi") }');
  await expect(textValue).toHaveValue('hi');
  await page.locator('.monaco-editor').filter({ visible: true }).nth(0).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($text: String!) { viewer { id } echo(text: $text) }');
  await textValue.fill('$again');
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($again: String!) { viewer { id } echo(text: $again) }');

  // Unchecking a REQUIRED argument takes its field along — the selection
  // would not be valid without it.
  await explorer.getByTestId('graphql-builder-arg-check-query.echo.text').click();
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id } }');
  await expect(check('query.echo')).not.toBeChecked();

  // An unchecked field expands to its argument rows, no cell until the
  // argument is checked; checking one there selects the field too, as
  // ONE undo step.
  await explorer.getByTestId('graphql-builder-expand-query.slow').click();
  const msCheck = explorer.getByTestId('graphql-builder-arg-check-query.slow.ms');
  await expect(msCheck).not.toBeChecked();
  await expect(explorer.getByTestId('graphql-builder-arg-value-query.slow.ms')).toHaveCount(0);
  await msCheck.click();
  await expect.poll(document, { timeout: 5_000 }).toContain('slow(ms: $ms)');
  expect(await document()).toContain('$ms: Int!');
  await expect(check('query.slow')).toBeChecked();
  await expect(explorer.getByTestId('graphql-builder-arg-value-query.slow.ms')).toHaveValue('$ms');
  await page.locator('.monaco-editor').filter({ visible: true }).nth(0).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect.poll(document, { timeout: 5_000 }).toBe('query Echo { viewer { id } }');
  await expect(check('query.slow')).not.toBeChecked();
});

// ── E18: the member rows — a union's `... on T`, an interface's fields then implementers ──

test('E18 — a union field lists its members as `... on T` rows that check in with the member’s first leaf and leave `__typename` behind; an interface lists its fields, then its implementers', async () => {
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  const document = () => workbench.monacoText(0);
  await workbench.fillMonaco(0, 'query Echo { viewer { id } }');

  // `search` (a union) expands to its ARG row and one row per member —
  // the type's description beneath — and no field rows of its own.
  await explorer.getByTestId('graphql-builder-expand-query.search').click();
  await expect(explorer.getByTestId('graphql-explorer-member-SearchResult.User')).toBeVisible();
  await expect(explorer.getByTestId('graphql-explorer-member-SearchResult.Note')).toBeVisible();
  await expect(explorer.getByTestId('graphql-builder-description-query.search.on:User')).toContainText('A person');
  await expect(explorer.locator('[data-testid^="graphql-builder-row-query.search."]')).toHaveCount(2);

  // Checking `... on User` lands `search` (its required `$term`
  // declared) with the fragment on the member's first leaf; the row
  // expands onto the member's fields, the leaf read back checked.
  await check('query.search.on:User').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($term: String!) { viewer { id } search(term: $term) { ... on User { id } } }');
  await expect(check('query.search')).toBeChecked();
  await expect(check('query.search.on:User')).toBeChecked();
  await expect(check('query.search.on:User.id')).toBeChecked();
  await expect(check('query.search.on:Note')).not.toBeChecked();

  // A member leaf joins the fragment's set.
  await check('query.search.on:User.name').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('... on User { id name }');

  // Unchecking the fragment as the field's last selection leaves
  // `__typename` — `search` stays checked on a set that is never empty.
  await check('query.search.on:User').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe('query Echo($term: String!) { viewer { id } search(term: $term) { __typename } }');
  await expect(check('query.search')).toBeChecked();
  await expect(check('query.search.on:User')).not.toBeChecked();

  // `node` (an interface) lists its own fields first, then its implementers.
  await explorer.getByTestId('graphql-builder-expand-query.node').click();
  await expect
    .poll(() =>
      explorer
        .locator('[data-testid^="graphql-builder-row-query.node."]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid'))),
    )
    .toEqual([
      'graphql-builder-row-query.node.id',
      'graphql-builder-row-query.node.on:User',
      'graphql-builder-row-query.node.on:Note',
    ]);
  await check('query.node.on:Note').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe(
      'query Echo($term: String!, $id: ID!) { viewer { id } search(term: $term) { __typename } node(id: $id) { ... on Note { id } } }',
    );
  await check('query.node.on:Note').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toBe(
      'query Echo($term: String!, $id: ID!) { viewer { id } search(term: $term) { __typename } node(id: $id) { __typename } }',
    );
  await expect(check('query.node')).toBeChecked();
});

// ── E19: subscriptions over the WebSocket plane ─────────────────────

const TICKS_DOCUMENT = 'subscription { tick(everyMs: 100, take: 3) }';
const TICKS_OPEN_DOCUMENT = 'subscription { tick(everyMs: 100, take: 100) }';
const NOTE_CREATED_DOCUMENT = 'subscription { noteCreated { id title author { name } } }';
const CREATE_NOTE_DOCUMENT = 'mutation { createNote(input: { title: "Live note", authorId: "2" }) { id } }';

/** A request under the generated collection's Mutation folder — the
 *  sidebar rows toggle, so each level is clicked only while its child
 *  stays hidden (E12's reveal idiom). */
async function revealGeneratedRequest(name: string): Promise<Locator> {
  const row = page
    .locator('[data-item-id^="graphql-request-"]')
    .filter({ hasText: name })
    .filter({ visible: true })
    .first();
  const collection = page
    .locator('[data-item-id^="req-col-"]')
    .filter({ hasText: GENERATED_COLLECTION })
    .filter({ visible: true })
    .first();
  const folder = page
    .locator('[data-item-id^="req-folder-"]')
    .filter({ hasText: 'Mutation' })
    .filter({ visible: true })
    .first();
  for (let attempt = 0; attempt < 2 && !(await row.isVisible().catch(() => false)); attempt++) {
    if (!(await folder.isVisible().catch(() => false))) {
      await collection.click();
      await folder.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => {});
    }
    if ((await folder.isVisible().catch(() => false)) && !(await row.isVisible().catch(() => false))) {
      await folder.click();
      await row.waitFor({ state: 'visible', timeout: 1_500 }).catch(() => {});
    }
  }
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  return row;
}

function subscriptionPhase() {
  return page.getByTestId('graphql-subscription-phase').filter({ visible: true }).first();
}

function subscriptionEvents() {
  return page.getByTestId('graphql-subscription-events').filter({ visible: true }).first();
}

/** The timeline's `next` rows as rendered (newest first — the default sort), each read for its tick. */
async function tickRows(): Promise<number[]> {
  return page
    .getByTestId('ws-timeline-message-row')
    .filter({ visible: true })
    .filter({ hasText: '"type":"next"' })
    .evaluateAll((rows) => rows.map((row) => Number(/"tick":(\d+)/.exec(row.textContent ?? '')?.[1] ?? Number.NaN)));
}

test('E19 — a picked subscription rides the WebSocket plane: three ticks in order then the server’s complete; noteCreated fired by a second request’s mutation; Stop mid-stream sends the client’s complete and freezes the count', async () => {
  await openGraphqlRequest(CONVERTED_NAME);
  await workbench.fillMonaco(1, '{}');

  // (a) tick — Query opens the session pane in the response slot; the
  // phase runs Subscribed → Completed on the server's complete, three
  // events land in order, the socket closes clean and Query is back.
  await workbench.fillMonaco(0, TICKS_DOCUMENT);
  await queryButton().click();
  await page
    .getByTestId('ws-session-pane')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  await expect(subscriptionPhase()).toHaveText('Completed', { timeout: 5_000 });
  await expect(subscriptionEvents()).toHaveText('3 events');
  await expect(page.getByTestId('ws-session-close-tag').filter({ visible: true }).first()).toHaveText('Disconnected');
  await expect.poll(tickRows, { timeout: 5_000 }).toEqual([3, 2, 1]);
  await expect(queryButton()).toBeVisible();
  expect(await page.getByTestId('graphql-subscription-errors').filter({ visible: true }).count()).toBe(0);

  // (b) noteCreated — the session stays open while a SECOND request's
  // createNote runs over the POST in its own tab; back on the listener
  // the event landed, shaped by the subscriber's document.
  await workbench.fillMonaco(0, NOTE_CREATED_DOCUMENT);
  await queryButton().click();
  await expect(subscriptionPhase()).toHaveText('Subscribed', { timeout: 5_000 });
  const createNote = await revealGeneratedRequest('createNote');
  await createNote.click();
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
  await workbench.fillMonaco(0, CREATE_NOTE_DOCUMENT);
  await workbench.fillMonaco(1, '{}');
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  await openGraphqlRequest(CONVERTED_NAME);
  await expect(subscriptionEvents()).toHaveText('1 event', { timeout: 5_000 });
  await expect(
    page
      .getByTestId('ws-timeline-message-row')
      .filter({ visible: true })
      .filter({ hasText: '"title":"Live note"' })
      .first(),
  ).toBeVisible();
  await expect(subscriptionPhase()).toHaveText('Subscribed');

  // (c) Stop mid-stream — the client's complete leaves, the socket
  // closes clean, and no event lands after it.
  await page.getByTestId('graphql-stop-button').filter({ visible: true }).first().click();
  await expect(subscriptionPhase()).toHaveText('Stopped', { timeout: 5_000 });
  await workbench.fillMonaco(0, TICKS_OPEN_DOCUMENT);
  await queryButton().click();
  await expect(subscriptionEvents()).toHaveText(/^[2-9]\d* events$/, { timeout: 5_000 });
  await page.getByTestId('graphql-stop-button').filter({ visible: true }).first().click();
  await expect(subscriptionPhase()).toHaveText('Stopped', { timeout: 5_000 });
  await expect(page.getByTestId('ws-session-close-tag').filter({ visible: true }).first()).toHaveText('Disconnected');
  const frozen = await subscriptionEvents().textContent();
  await page.waitForTimeout(400);
  await expect(subscriptionEvents()).toHaveText(frozen ?? '');
  await expect(
    page
      .getByTestId('ws-timeline-message-row')
      .filter({ visible: true })
      .filter({ hasText: '{"id":"1","type":"complete"}' })
      .first(),
  ).toBeVisible();
  await expect(queryButton()).toBeVisible();
});

// ── E20: the input-object rows — an argument's input fields as rows keyed into its literal ──

test('E20 — an input-object argument expands to its input fields: keys open the literal, promote the variable, append, nest, and the last one takes the required argument’s field', async () => {
  await openGraphqlRequest(CONVERTED_NAME);
  await page.getByRole('tab', { name: 'Query', exact: true }).filter({ visible: true }).first().click();
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  await explorer.waitFor({ state: 'visible', timeout: 10_000 });
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  const inputCheck = (key: string) =>
    explorer.getByTestId(`graphql-builder-input-check-mutation.createNote.input.${key}`);
  const document = () => workbench.monacoText(0);
  await workbench.fillMonaco(0, '');

  // The required `input` lands as a variable; its row expands to NoteInput's fields.
  await check('mutation.createNote').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('createNote(input: $input) { id }');
  await explorer.getByTestId('graphql-builder-arg-expand-mutation.createNote.input').click();
  await expect(inputCheck('title')).toBeVisible();
  await expect(inputCheck('title')).not.toBeChecked();

  // A key opens the literal over the variable — `$input` undeclared, `$title` declared with the field's type.
  await inputCheck('title').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('createNote(input: { title: $title }) { id }');
  expect(await document()).toContain('$title: String!');
  expect(await document()).not.toContain('$input');
  await expect(inputCheck('title')).toBeChecked();

  // A typed literal replaces the variable, quoted for the String field.
  const titleValue = explorer.getByTestId('graphql-builder-input-value-mutation.createNote.input.title');
  await expect(titleValue).toHaveValue('$title');
  await titleValue.fill('Hi');
  await titleValue.press('Enter');
  await expect.poll(document, { timeout: 5_000 }).toContain('input: { title: "Hi" }');
  expect(await document()).not.toContain('$title');

  // A sibling key appends; a nested input type expands and lands as a nested literal.
  await inputCheck('authorId').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('input: { title: "Hi", authorId: $authorId }');
  await explorer.getByTestId('graphql-builder-input-expand-mutation.createNote.input.location').click();
  await inputCheck('location.latitude').click();
  await expect
    .poll(document, { timeout: 5_000 })
    .toContain('input: { title: "Hi", authorId: $authorId, location: { latitude: $latitude } }');
  expect(await document()).toContain('$latitude: Float!');

  // The last nested key takes its parent; the last key of the required argument takes the field.
  await inputCheck('location.latitude').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('input: { title: "Hi", authorId: $authorId }');
  await inputCheck('title').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('input: { authorId: $authorId }');
  await inputCheck('authorId').click();
  await expect.poll(document, { timeout: 5_000 }).toBe('');
  await expect(check('mutation.createNote')).not.toBeChecked();
});

// ── E21: the multi-operation model — the dim, the append, the cursor-follow, the landing ──

test('E21 — a check on a dimmed section appends a named operation and moves the pick; a click inside an operation moves it back; a second field lands in the existing operation', async () => {
  await openGraphqlRequest(CONVERTED_NAME);
  await page.getByRole('tab', { name: 'Query', exact: true }).filter({ visible: true }).first().click();
  const explorer = page.getByTestId('graphql-explorer').filter({ visible: true }).first();
  await explorer.waitFor({ state: 'visible', timeout: 10_000 });
  const check = (key: string) => explorer.getByTestId(`graphql-builder-check-${key}`);
  const select = () => page.getByTestId('graphql-operation-select').filter({ visible: true }).first();
  const document = () => workbench.monacoText(0);
  // The editor's dimmed text — the operations the pick is not.
  const dimmed = () =>
    page
      .locator('.monaco-editor')
      .filter({ visible: true })
      .nth(0)
      .locator('.view-lines .graphql-inactive-operation')
      .allInnerTexts()
      .then((parts) => parts.join('').replace(/[\s\u00a0]+/g, ' '));
  await workbench.fillMonaco(0, '{ viewer { id } }');

  // An anonymous query is picked: nothing dims, the Mutation rows stay live and read unchecked.
  await expect(check('query.viewer')).toBeChecked();
  await expect.poll(dimmed, { timeout: 5_000 }).toBe('');
  await expect(check('mutation.deleteNote')).toBeEnabled();
  await expect(check('mutation.deleteNote')).not.toBeChecked();
  await expect(select()).toHaveCount(0);

  // The check appends `mutation DeleteNote` with its variable and names
  // the query after its first root field; the pick moves to the mutation.
  await check('mutation.deleteNote').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('query Viewer { viewer { id } }');
  expect(await document()).toContain('mutation DeleteNote($id: ID!)');
  expect(await document()).toContain('deleteNote(id: $id)');
  await expect(select()).toContainText('DeleteNote');
  await expect(check('mutation.deleteNote')).toBeChecked();
  await expect(check('query.viewer')).not.toBeChecked();
  // The query dims in the editor, the picked mutation reads at full strength.
  await expect.poll(dimmed, { timeout: 5_000 }).toContain('query Viewer');
  expect(await dimmed()).not.toContain('DeleteNote');
  await expect(
    page.locator('.monaco-editor').filter({ visible: true }).nth(0).locator('.graphql-inactive-operation').first(),
  ).toHaveCSS('opacity', '0.45');

  // A click on the query's line (line 1) makes it the picked operation again.
  await page
    .locator('.monaco-editor')
    .filter({ visible: true })
    .nth(0)
    .locator('.view-lines')
    .click({ position: { x: 24, y: 8 } });
  await expect(select()).toContainText('Viewer');
  await expect(check('query.viewer')).toBeChecked();
  await expect(check('mutation.deleteNote')).not.toBeChecked();
  await expect.poll(dimmed, { timeout: 5_000 }).toContain('mutation DeleteNote');
  expect(await dimmed()).not.toContain('Viewer');

  // A second mutation field lands IN the existing mutation — one
  // mutation in the document — and the pick returns to it.
  await check('mutation.createNote').click();
  await expect.poll(document, { timeout: 5_000 }).toContain('createNote(input: $input) { id }');
  expect((await document()).match(/mutation /g)).toHaveLength(1);
  expect(await document()).toContain('$input: NoteInput!');
  await expect(select()).toContainText('DeleteNote');
  await expect(check('mutation.createNote')).toBeChecked();
  await expect(check('mutation.deleteNote')).toBeChecked();

  // Query runs the picked mutation with generated variables.
  await page.getByTestId('graphql-generate-variables').filter({ visible: true }).first().click();
  await expect.poll(async () => workbench.monacoText(1), { timeout: 5_000 }).toMatch(/"id":\s*"/);
  await queryButton().click();
  expect(await workbench.responseStatusText()).toBe('200 OK');
  await expect.poll(() => workbench.responsePrettyText(), { timeout: 5_000 }).toMatch(/"deleteNote":\s*(true|false)/);
});

// ── E22: the Spec tab ───────────────────────────────────────────────

const PASTED_SPEC_NAME = 'GraphQL schema';

test('E22 — the Spec tab reads the generated request’s link with its collection, changes it, and falls back to the collection’s link when cleared', async () => {
  // The E11 collection's deleteNote — its own link to the E9 spec.
  const deleteNote = page
    .locator('[data-item-id^="graphql-request-"]')
    .filter({ hasText: 'deleteNote' })
    .filter({ visible: true })
    .first();
  if (!(await deleteNote.isVisible().catch(() => false))) {
    await page
      .locator('[data-item-id^="req-col-"]')
      .filter({ hasText: GENERATED_COLLECTION })
      .filter({ visible: true })
      .first()
      .click();
    await page
      .locator('[data-item-id^="req-folder-"]')
      .filter({ hasText: 'Mutation' })
      .filter({ visible: true })
      .first()
      .click();
  }
  await deleteNote.waitFor({ state: 'visible', timeout: 5_000 });
  await deleteNote.click();
  await urlInput().waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByRole('tab', { name: 'Spec', exact: true }).filter({ visible: true }).first().click();
  const specTab = page.getByTestId('graphql-spec-tab').filter({ visible: true }).first();
  await specTab.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(specTab.getByTestId('graphql-spec-name')).toHaveText(SPEC_NAME);
  await expect(specTab.getByTestId('graphql-spec-from-collection')).toContainText(GENERATED_COLLECTION);
  await expect(specTab.getByTestId('graphql-spec-drifted')).toHaveCount(0);

  // The picker changes the request's own link — the collection line
  // goes (a different spec than the generation's); the Schema tab
  // resolves the new one.
  await specTab.getByTestId('graphql-spec-select').click();
  await page.locator('.ant-select-dropdown').filter({ visible: true }).getByTitle(PASTED_SPEC_NAME).first().click();
  await expect(specTab.getByTestId('graphql-spec-name')).toHaveText(PASTED_SPEC_NAME);
  await expect(specTab.getByTestId('graphql-spec-from-collection')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Schema', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('graphql-schema-spec-name').filter({ visible: true }).first()).toHaveText(
    PASTED_SPEC_NAME,
  );
  const summary = page.getByTestId('graphql-schema-summary').filter({ visible: true }).first();
  await expect(summary).toContainText('Query');
  await expect(summary).not.toContainText('Mutation');
  // The Schema tab's link opens the Spec tab.
  await page.getByTestId('graphql-schema-spec-link').filter({ visible: true }).first().click();
  await specTab.waitFor({ state: 'visible', timeout: 5_000 });

  // Clearing the picker leaves the request reading the collection's
  // link — the inherited placeholder, the collection line back.
  const select = specTab.getByTestId('graphql-spec-select');
  await select.hover();
  await select.locator('.ant-select-clear').click();
  await expect(select).toContainText(`Inherited from the collection: ${SPEC_NAME}`);
  await expect(specTab.getByTestId('graphql-spec-name')).toHaveText(SPEC_NAME);
  await expect(specTab.getByTestId('graphql-spec-from-collection')).toContainText(GENERATED_COLLECTION);
  // An inherited link is not the request's to clear — the Schema tab's
  // introspection source is disabled under it.
  await page.getByRole('tab', { name: 'Schema', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('graphql-schema-spec-name').filter({ visible: true }).first()).toHaveText(SPEC_NAME);
  await page.getByTestId('graphql-schema-source').filter({ visible: true }).first().click();
  await expect(
    page
      .locator('.ant-select-dropdown')
      .filter({ visible: true })
      .locator('.ant-select-item-option-disabled[title="GraphQL introspection"]'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await saveAndAwaitClean();
});
