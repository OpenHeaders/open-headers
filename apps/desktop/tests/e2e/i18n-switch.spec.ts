/**
 * i18n locale-switch e2e (Phase H) — the desktop workbench window:
 *
 *   1. the app boots in English (resolved from `auto`);
 *   2. switching to pseudo through the real settings picker re-renders
 *      the open workbench in place — a window stamp proves no reload;
 *   3. the technical plane stays raw under pseudo: locale registry
 *      names ('English') and `<html lang>` (pseudo is accented English
 *      and announces itself as `en`);
 *   4. the choice persists across an app restart on the same isolated
 *      user-data dir — the relaunched window paints pseudoized from
 *      boot (asserted on the delimiters; the chrome's accessible names
 *      are pseudoized too, which is itself the persistence proof).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337).
const DAEMON_PORT = 19437;

const PSEUDO_NATIVE_NAME = '⟦Þšéûðö⟧';

let userData: string;
let electronApp: ElectronApplication;
let workbench: Page;

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

/** Launch the built app on the shared user-data dir and gate on the
 *  engine spine answering through the bridge. */
async function launch(): Promise<void> {
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
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

/** Quit through the app (a window close would only hide to tray). */
async function quit(): Promise<void> {
  await electronApp.evaluate(({ app }) => {
    app.quit();
  });
  await electronApp.close();
}

/** The language picker row inside the settings surface. */
function languageRow(): ReturnType<Page['locator']> {
  return workbench.locator('[data-setting-key="general.language"]');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'oh-i18n-switch-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  // Pin the embedded backend off every other suite's port; language is
  // deliberately NOT seeded — the first leg proves the `auto` boot.
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'backend.bindPort': DAEMON_PORT },
      },
      secrets: {},
    }),
  );
  await launch();
});

test.afterAll(async () => {
  await quit();
});

test('the workbench boots in English', async () => {
  await expect(workbench.getByRole('button', { name: 'Settings menu' })).toBeVisible({ timeout: 30_000 });
  await expect(workbench.locator('#root')).not.toContainText('⟦');
});

test('the pseudo switch re-renders the workbench in place', async () => {
  // A navigation or reload would wipe the stamp — its survival proves
  // the re-render happened in place.
  await workbench.evaluate(() => {
    (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe = true;
  });

  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench.locator('.settings-category-nav').getByText('General', { exact: true }).click();
  const row = languageRow();
  await expect(row).toBeVisible();
  await row.getByText(PSEUDO_NATIVE_NAME).click();

  await expect(row).toContainText('⟦');
  const stamp = await workbench.evaluate(
    () => (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe === true,
  );
  expect(stamp).toBe(true);
});

test('technical plane vocabulary stays raw under pseudo', async () => {
  const row = languageRow();
  await expect(row.getByText('English', { exact: true })).toBeVisible();
  await expect(row.getByText(PSEUDO_NATIVE_NAME)).toBeVisible();
  expect(await workbench.evaluate(() => document.documentElement.lang)).toBe('en');
});

test('the choice persists across an app restart', async () => {
  // The settings store debounces persistence — wait for the choice to
  // land in the on-disk storage before quitting.
  await expect
    .poll(async () => {
      try {
        const raw = await readFile(path.join(userData, 'data', 'settings.json'), 'utf8');
        const parsed = JSON.parse(raw) as { values?: Record<string, Record<string, unknown>> };
        return parsed.values?.['oh.settings.user']?.['general.language'] ?? null;
      } catch {
        return null;
      }
    })
    .toBe('pseudo');

  await quit();
  await launch();

  // The relaunched window paints pseudoized from boot; asserting on
  // the delimiters (not English accessible names, which no longer
  // exist) is itself the persistence proof.
  await expect(workbench.locator('#root')).toContainText('⟦', { timeout: 30_000 });
});
