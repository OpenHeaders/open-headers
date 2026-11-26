/**
 * The one launch of the built extension every spec shares: real Chromium
 * (an extension needs a headed browser) with the extension loaded alone,
 * in a window that opens over the whole usable screen it is on — the page
 * follows the window, no fixed viewport. On CI the window keeps
 * Playwright's own fixed size.
 *
 * `SLOW_MO` (or `OH_E2E_SLOWMO`) slows every action by that many
 * milliseconds, for watching a spec.
 */

import { spawnSync } from 'node:child_process';
import { type BrowserContext, chromium } from '@playwright/test';

const FULL_SCREEN = !process.env.CI;

// AppKit's frame has its origin at the bottom left; a window position counts from the top.
const MAC_USABLE_AREA_SCRIPT =
  'ObjC.import("AppKit"); var s = $.NSScreen.mainScreen; var f = s.frame; var v = s.visibleFrame;' +
  ' JSON.stringify({ x: v.origin.x, y: f.size.height - v.origin.y - v.size.height, width: v.size.width, height: v.size.height })';

interface ScreenArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

let fullScreenArgs: string[] | undefined;

/** The arguments a window is born over the whole usable screen with. */
function readFullScreenArgs(): string[] {
  if (process.platform !== 'darwin') return ['--start-maximized'];
  const read = spawnSync('osascript', ['-l', 'JavaScript', '-e', MAC_USABLE_AREA_SCRIPT], { encoding: 'utf-8' });
  if (read.status !== 0) return [];
  const area: ScreenArea = JSON.parse(read.stdout);
  return [`--window-position=${area.x},${area.y}`, `--window-size=${area.width},${area.height}`];
}

function slowMo(): number | undefined {
  return Number(process.env.SLOW_MO ?? process.env.OH_E2E_SLOWMO ?? '0') || undefined;
}

/**
 * Launch Chromium on `userDataDir` (empty for a throwaway profile) with
 * the extension at `extensionPath`. `extraArgs` are a spec's own
 * switches.
 */
export function launchExtensionContext(
  userDataDir: string,
  extensionPath: string,
  extraArgs: string[] = [],
): Promise<BrowserContext> {
  if (FULL_SCREEN) fullScreenArgs ??= readFullScreenArgs();
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    slowMo: slowMo(),
    ...(FULL_SCREEN ? { viewport: null } : {}),
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      ...(fullScreenArgs ?? []),
      ...extraArgs,
    ],
  });
}
