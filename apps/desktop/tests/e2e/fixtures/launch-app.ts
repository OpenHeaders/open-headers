/**
 * The one launch of the built desktop app every spec shares: an isolated
 * userData, update checks off, and a window that is born maximized — the
 * app restores its window from `state/window-state.json` at creation, so
 * a profile that holds none yet is given one that says maximized. A
 * profile that already has the file keeps it. On CI the app opens at its
 * own default size.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { _electron, type ElectronApplication } from '@playwright/test';

const FULL_SCREEN = !process.env.CI;

// The size the window returns to when it is un-maximized.
const RESTORED_SIZE = { width: 1280, height: 800 };

/** Give a profile with no saved window the maximized one. */
export async function seedMaximizedWindow(userData: string): Promise<void> {
  if (!FULL_SCREEN) return;
  const statePath = path.join(userData, 'state', 'window-state.json');
  if (existsSync(statePath)) return;
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ ...RESTORED_SIZE, maximized: true, fullscreen: false }));
}

/** Launch the app built at `appRoot` on `userData`. `env` is a spec's own environment, over the shared one. */
export async function launchDesktopApp(
  appRoot: string,
  userData: string,
  env: Record<string, string> = {},
): Promise<ElectronApplication> {
  await seedMaximizedWindow(userData);
  return _electron.launch({
    args: [appRoot],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1', ...env },
  });
}
