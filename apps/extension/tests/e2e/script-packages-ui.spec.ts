/**
 * Script-packages e2e — the Package Library, the Scripts tab's Packages
 * popover, `oh.require` on the wire, and the selection context menus
 * (Monaco script editor + TemplateInput).
 *
 * Order-dependent within the file: the `utils` package created in the
 * first test is required by the popover / wire / append tests below it.
 *
 * Monaco context-menu coverage doubles as the regression net for the
 * selection-anchored popovers: the menu items live in Monaco's own
 * context menu (rendered in the normal DOM — `useShadowDOM: false`),
 * and the popovers they open must appear beside the selection instead
 * of below the editor pane.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
const uids = new Map<string, string>();

const SEEDS: Array<{ name: string }> = [
  { name: 'pkg-insert' },
  { name: 'pkg-wire' },
  { name: 'pkg-ctx-new' },
  { name: 'pkg-ctx-append' },
  { name: 'pkg-ctx-var' },
  { name: 'pkg-ctx-input' },
];

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  for (const seed of SEEDS) {
    uids.set(
      seed.name,
      await workbench.seedRequest({
        name: seed.name,
        method: 'POST',
        url: API_ECHO_URL,
        auth: { type: 'none' },
        body: { type: 'none' },
      }),
    );
  }
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

async function openScripts(seed: string): Promise<void> {
  await workbench.openRequest(uids.get(seed)!);
  await workbench.openEditorTab(/Scripts/);
  await workbench.selectScriptRail('Pre-request');
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

test.describe('Package Library', () => {
  test('creates a package through the Library tab', async () => {
    await workbench.openPackageLibrary();
    await workbench.createPackage('utils', 'module.exports = { add: (a, b) => a + b };');
    await expect(workbench.packageRow('utils')).toBeVisible();
  });

  test('the Packages popover lists the package and inserts a require binding', async () => {
    await openScripts('pkg-insert');
    await workbench.toggleScriptPackages();
    const popover = workbench.scriptPackagesPopover();
    await expect(popover.getByRole('button', { name: 'utils', exact: true })).toBeVisible();

    await workbench.insertPackageRequire('utils');
    // Same contract as snippets: insert at cursor, popover stays open.
    await expect(popover).toBeVisible();
    const text = squash(await workbench.monacoText(0));
    expect(text).toContain(`const utils = oh.require('utils');`);
    await workbench.toggleScriptPackages();
  });

  test('oh.require exports run in a pre-request script on the wire', async () => {
    await openScripts('pkg-wire');
    await workbench.fillMonaco(
      0,
      `const utils = oh.require('utils'); oh.setHeader('X-Sum', String(utils.add(2, 3)));`,
    );
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-sum']).toBe('5');
  });
});

test.describe('Script editor selection context menu', () => {
  test('saves the selection to a NEW package', async () => {
    await openScripts('pkg-ctx-new');
    await workbench.fillMonaco(0, `function greet() { return 'hello'; }`);
    await workbench.selectAllInMonaco(0);
    await workbench.openMonacoContextMenu(0);
    await workbench.clickMonacoMenuItem('Save to Package Library');

    const popover = workbench.saveToPackagePopover();
    await expect(popover).toBeVisible();
    await popover.getByRole('button', { name: 'New Package' }).click();
    await popover.getByLabel('New package name').fill('greeting');
    await popover.getByRole('button', { name: 'Create' }).click();
    await expect(popover).toHaveCount(0);

    await workbench.openPackageLibrary();
    await workbench.packageRow('greeting').click();
    const source = squash(await workbench.monacoText(0));
    expect(source).toContain(`function greet() { return 'hello'; }`);
  });

  test('appends the selection to an EXISTING package', async () => {
    await openScripts('pkg-ctx-append');
    await workbench.fillMonaco(0, `function more() { return 1; }`);
    await workbench.selectAllInMonaco(0);
    await workbench.openMonacoContextMenu(0);
    await workbench.clickMonacoMenuItem('Save to Package Library');

    const popover = workbench.saveToPackagePopover();
    await expect(popover).toBeVisible();
    await popover.getByRole('button', { name: 'utils', exact: true }).click();
    await expect(popover).toHaveCount(0);

    await workbench.openPackageLibrary();
    await workbench.packageRow('utils').click();
    const source = squash(await workbench.monacoText(0));
    expect(source).toContain('module.exports = { add: (a, b) => a + b };');
    expect(source).toContain('function more() { return 1; }');
  });

  test('sets the selection as a new variable', async () => {
    await openScripts('pkg-ctx-var');
    await workbench.fillMonaco(0, `token-abc-123`);
    await workbench.selectAllInMonaco(0);
    await workbench.openMonacoContextMenu(0);
    await workbench.clickMonacoMenuItem('Set as variable');

    const popover = workbench.setAsVariablePopover();
    await expect(popover).toBeVisible();
    await popover.getByLabel('Variable name').fill('pkg_ctx_var');
    await popover.getByRole('button', { name: /Save/ }).click();
    await expect(popover).toHaveCount(0);

    // The value landed in the workspace scope (the default "Add to").
    const resolved = await workbench.rpc<{
      workspaceVariables?: { variables?: Array<{ name: string; value: string }> };
    }>('getWorkspaceVariables');
    expect(resolved.workspaceVariables?.variables?.find((v) => v.name === 'pkg_ctx_var')?.value).toBe(
      'token-abc-123',
    );
  });

  test('EncodeURIComponent rewrites the selection in place', async () => {
    await openScripts('pkg-ctx-new');
    await workbench.fillMonaco(0, `a b&c`);
    await workbench.selectAllInMonaco(0);
    await workbench.openMonacoContextMenu(0);
    await workbench.clickMonacoMenuItem('EncodeURIComponent');
    await expect.poll(async () => squash(await workbench.monacoText(0))).toBe('a%20b%26c');
  });
});

test.describe('TemplateInput selection context menu', () => {
  test('right-click on a selection shows the compact menu and encodes in place', async () => {
    await workbench.openRequest(uids.get('pkg-ctx-input')!);
    const url = workbench.urlInput();
    await workbench.openInputContextMenu(url);

    for (const label of ['Set as variable', 'Cut', 'Copy', 'Paste', 'EncodeURIComponent', 'DecodeURIComponent']) {
      await expect(workbench.inputContextMenuItem(label)).toBeVisible();
    }
    await workbench.inputContextMenuItem('EncodeURIComponent').click();
    await expect
      .poll(async () => (await url.textContent()) ?? '')
      .toBe(encodeURIComponent(`${API_ECHO_URL}`));
  });

  test('Set as variable from an input opens the create popover', async () => {
    await workbench.openRequest(uids.get('pkg-ctx-input')!);
    const url = workbench.urlInput();
    await workbench.openInputContextMenu(url);
    await workbench.inputContextMenuItem('Set as variable').click();
    await expect(workbench.setAsVariablePopover()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(workbench.setAsVariablePopover()).toHaveCount(0);
  });
});
