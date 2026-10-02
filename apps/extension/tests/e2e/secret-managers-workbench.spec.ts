/**
 * Secret managers on the browser host (the Secret Providers plan, S4) —
 * the extension's READ-ONLY surfaces until P2 wires the loopback
 * channel to the desktop app's connections:
 *
 *   B1  the Vault row of kind Secret Manager with the desktop app away:
 *       the connection select is disabled and reads "Connect the
 *       desktop app", the chip reads "No connection selected", no
 *       Manage… link is offered (the desktop-only affordance never
 *       renders here) and the row's one affordance leads to the
 *       Settings page (P2e);
 *   B2  Settings › Secret Managers › Connections with the desktop app
 *       away: the list renders read-only — Add disabled, the browser
 *       note naming the desktop app, the standalone teaser offering to
 *       open or get the desktop app — and nothing in it prompts.
 *
 * The desktop-connected readings (the desktop app's connections
 * listed, Test live, a Send resolving over loopback) need the desktop
 * app on its own port beside this extension — the live look, not this
 * rig. Runs against the built `dist/chrome`; the user builds it.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;
let extensionId: string;

const visible = (locator: Locator): Locator => locator.filter({ visible: true }).first();

async function pickOption(select: Locator, text: string): Promise<void> {
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

test('B1 — the Vault row reads the desktop-only connection select and the honest chip', async () => {
  const tab = page.locator('[data-tool-window="variables"]').first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await page.locator('[data-item-id="vault-row"]').first().click();
  const nameInput = visible(page.getByPlaceholder('Add secret…'));
  await nameInput.waitFor({ state: 'visible', timeout: 15_000 });
  // The placeholder row's sortable wrapper carries aria-disabled, which
  // the driver reads as a disabled input — focus and type instead.
  await nameInput.evaluate((el) => (el as HTMLInputElement).focus());
  await page.keyboard.type('opToken');
  const kindSelect = visible(page.locator('.ant-select:not(.ant-select-disabled)').filter({ hasText: 'Text' }));
  await pickOption(kindSelect, 'Secret Manager');
  await expect(visible(page.getByTestId('vault-sm-provider'))).toBeVisible();

  const connection = visible(page.getByTestId('vault-sm-connection'));
  await expect(connection).toHaveClass(/ant-select-disabled/);
  await expect(connection).toContainText('Connect the desktop app');
  await expect(visible(page.getByTestId('vault-sm-status'))).toHaveText('No connection selected');
  expect(await page.getByTestId('vault-sm-manage').count()).toBe(0);
  await expect(visible(page.getByTestId('vault-sm-connect-desktop'))).toHaveText('Connect the desktop app');

  // The path fields still take the reference — the row is editable,
  // only its device-side binding waits for the desktop app.
  await visible(page.getByTestId('vault-sm-field-vault')).fill('Demo');
  await visible(page.getByTestId('vault-sm-field-item')).fill('api.openheaders.io');
  await visible(page.getByTestId('vault-sm-field-field')).fill('token');
  await expect(visible(page.getByTestId('vault-sm-reference'))).toHaveText('op://Demo/api.openheaders.io/token');
});

test('B2 — Settings › Secret Managers is read-only with the browser note', async () => {
  await page.getByRole('button', { name: 'Settings menu' }).click();
  await page.getByRole('button', { name: 'Settings…' }).click();
  await page.locator('.settings-modal').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.settings-category-nav').getByRole('button', { name: 'Secret Managers', exact: true }).click();
  const connections = page.getByRole('button', { name: 'Connections', exact: true }).filter({ visible: true });
  if ((await connections.count()) > 0) await connections.first().click();
  await expect(page.getByTestId('secret-manager-table')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('secret-manager-empty')).toBeVisible();
  await expect(page.getByTestId('secret-manager-add')).toBeDisabled();
  await expect(page.locator('.settings-modal')).toContainText(
    'Secret manager connections live on the desktop app. Open it to add or test one.',
  );
  // The standalone teaser: no desktop app on this rig, so the CTA is
  // the one that gets it (or opens it where one is installed).
  const teaser = page.locator('[data-testid="desktop-teaser"][data-teaser-feature="secretManagers"]');
  await expect(teaser).toBeVisible();
  await expect(teaser).toContainText('Secret managers');
  await expect(
    teaser.locator('[data-testid="desktop-teaser-cta"], [data-testid="desktop-teaser-launch"]'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.settings-modal')).toBeHidden({ timeout: 10_000 });
});
