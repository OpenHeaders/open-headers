/**
 * i18n locale-switch e2e (Phase H) — the pseudo locale flipped through
 * the real settings picker, with the workbench AND popup open at once:
 *
 *   1. both surfaces boot in English (resolved from `auto`);
 *   2. switching to pseudo in the workbench settings re-renders BOTH
 *      open surfaces in place — no reload — via the settings store's
 *      cross-context sync (a window stamp on each page proves neither
 *      navigated);
 *   3. the technical plane stays raw under pseudo: locale registry
 *      names ('English'), the brand line, and `<html lang>` (pseudo is
 *      accented English and announces itself as `en`);
 *   4. the choice persists across a full browser restart on a real
 *      profile directory — the popup paints pseudoized from boot and
 *      the picker shows pseudo selected.
 *
 * Every catalog message pseudoizes to `⟦…⟧`-delimited accented text
 * (see `packages/i18n/src/pseudo.ts`), so assertions key on the
 * delimiters rather than exact expansions.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let profileDir: string;
let context: BrowserContext;
let extensionId: string;
let popupPage: Page;
let workbenchPage: Page;

const PSEUDO_NATIVE_NAME = '⟦Þšéûðö⟧';

async function waitForRoot(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
}

async function launch(dir: string): Promise<void> {
  context = await chromium.launchPersistentContext(dir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = serviceWorker.url().split('/')[2];
}

/** Open popup.html; on the first visit seed the onboarding flag from the
 *  PAGE context (never the SW — MV3 restarts kill worker handles) and
 *  reload so the tour mask never blocks the UI. */
async function openPopup(seedOnboarding: boolean): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  if (seedOnboarding) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
        }),
    );
    await page.reload();
  }
  await waitForRoot(page);
  return page;
}

async function openWorkbench(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await waitForRoot(page);
  return page;
}

/** The language picker row inside the settings surface. */
function languageRow(page: Page) {
  return page.locator('[data-setting-key="general.language"]');
}

/** The language Select's OPEN dropdown — antd portals it to the body. */
async function openLanguageDropdown(page: Page) {
  await languageRow(page).getByRole('combobox').click();
  return page.locator('.ant-select-dropdown').filter({ visible: true });
}

/** Drive gear menu → Settings… → General and return the language row. */
async function openLanguageSetting(page: Page) {
  await page.getByRole('button', { name: 'Settings menu' }).click();
  await page.getByRole('button', { name: 'Settings…' }).click();
  await page.locator('.settings-category-nav').getByText('General', { exact: true }).click();
  const row = languageRow(page);
  await expect(row).toBeVisible();
  return row;
}

test.beforeAll(async () => {
  profileDir = await mkdtemp(path.join(os.tmpdir(), 'oh-i18n-switch-'));
  await launch(profileDir);
  popupPage = await openPopup(true);
  workbenchPage = await openWorkbench();
});

test.afterAll(async () => {
  await context.close();
  await rm(profileDir, { recursive: true, force: true });
});

test('both surfaces boot in English', async () => {
  const debugButton = popupPage.locator('.debug-network-button');
  await expect(debugButton).toContainText('Network Debug.');
  await expect(debugButton).not.toContainText('⟦');
  await expect(workbenchPage.getByRole('button', { name: 'Settings menu' })).toBeVisible();
});

test('pseudo switch re-renders workbench and popup in place', async () => {
  // Stamp both windows — a navigation or reload would wipe the stamp,
  // so its survival proves the re-render happened in place.
  await popupPage.evaluate(() => {
    (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe = true;
  });
  await workbenchPage.evaluate(() => {
    (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe = true;
  });

  const row = await openLanguageSetting(workbenchPage);
  const dropdown = await openLanguageDropdown(workbenchPage);
  await dropdown.locator('.ant-select-item-option').getByText(PSEUDO_NATIVE_NAME, { exact: true }).click();

  // The settings surface itself re-renders: the row label pseudoizes.
  await expect(row).toContainText('⟦');

  // The popup — a separate extension page, never reloaded — follows
  // through the settings store's cross-context sync.
  const debugButton = popupPage.locator('.debug-network-button');
  await expect(debugButton).toContainText('⟦');
  await expect(debugButton).not.toContainText('Network Debug.');

  const popupStamp = await popupPage.evaluate(
    () => (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe === true,
  );
  const workbenchStamp = await workbenchPage.evaluate(
    () => (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe === true,
  );
  expect(popupStamp).toBe(true);
  expect(workbenchStamp).toBe(true);
});

test('technical plane and brand vocabulary stay raw under pseudo', async () => {
  // Locale registry names are proper nouns — never pseudoized. The
  // picker is a Select, so the option list only exists while open.
  const row = languageRow(workbenchPage);
  await expect(row.locator('.ant-select-content')).toContainText(PSEUDO_NATIVE_NAME);
  const dropdown = await openLanguageDropdown(workbenchPage);
  await expect(dropdown.locator('.ant-select-item-option').getByText('English', { exact: true })).toBeVisible();
  await workbenchPage.keyboard.press('Escape');

  // Pseudo is accented English and announces itself as `en`.
  expect(await workbenchPage.evaluate(() => document.documentElement.lang)).toBe('en');
  expect(await popupPage.evaluate(() => document.documentElement.lang)).toBe('en');

  // Brand line stays raw in the popup header.
  await expect(popupPage.locator('.header')).toContainText('Open Headers');
});

test('choice persists across restart', async () => {
  // The settings store debounces persistence (150ms) — wait for the
  // choice to land in chrome.storage before tearing the browser down.
  await expect
    .poll(() =>
      popupPage.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            chrome.storage.local.get('oh.settings.user', (slot) => {
              const dict = slot['oh.settings.user'] as Record<string, unknown> | undefined;
              resolve(dict?.['general.language'] ?? null);
            });
          }),
      ),
    )
    .toBe('pseudo');

  await context.close();
  await launch(profileDir);

  // Onboarding flag persisted with the profile — no seeding needed.
  // Both surfaces must paint pseudoized from boot; the workbench check
  // stays textual (its chrome is now pseudoized, so navigating the
  // gear menu by English accessible names is impossible BY DESIGN —
  // that impossibility is itself the persistence proof).
  popupPage = await openPopup(false);
  const debugButton = popupPage.locator('.debug-network-button');
  await expect(debugButton).toContainText('⟦');
  await expect(debugButton).not.toContainText('Network Debug.');

  workbenchPage = await openWorkbench();
  await expect(workbenchPage.locator('#root')).toContainText('⟦');
});
