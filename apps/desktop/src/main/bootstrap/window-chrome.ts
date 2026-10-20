/**
 * The window chrome that follows the theme — the native surfaces the
 * React tree cannot paint: the Windows / Linux `titleBarOverlay`
 * (minimize / maximize / close over the top bar's right edge), the
 * frame colour a window shows before its renderer paints, and
 * `nativeTheme.themeSource`, which every surface Electron draws itself
 * reads (the application menu popped as a context menu, dialogs, the
 * traffic lights on macOS).
 *
 * Two inputs, two owners:
 *   - the MODE (`appearance.theme`) rides the user settings blob the
 *     renderer writes through host storage, so main binds to it the
 *     moment the storage backend exists — before React mounts — the
 *     way the locale does;
 *   - the PALETTE (the top bar's ground and text under the active
 *     variant) is the renderer's to resolve, so it reports it over
 *     `oh:window-chrome:apply` whenever the theme changes, and main
 *     keeps the last report for windows opened later.
 * Until a report lands, the default variants' palette from
 * `@openheaders/core/chrome` stands in, picked by the effective mode.
 */

import { DEFAULT_CHROME } from '@openheaders/core/chrome';
import type { HostStorage } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import { BrowserWindow, ipcMain, nativeTheme } from 'electron';

const CHANNEL = 'oh:window-chrome:apply';
// The top bar's height — the overlay sits inside that row.
const OVERLAY_HEIGHT = 40;

type ThemeMode = 'light' | 'dark' | 'auto';

/** The renderer's report: the top bar's ground and its text colour. */
export interface WindowChromePalette {
  background: string;
  symbolColor: string;
}

let mode: ThemeMode = 'auto';
let reported: WindowChromePalette | null = null;

function effectiveMode(): 'light' | 'dark' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

/** What the frame paints before the renderer's first frame lands. */
export function frameBackgroundColor(): string {
  return DEFAULT_CHROME[effectiveMode()].frame;
}

/** The `titleBarOverlay` a Windows / Linux window wears right now. */
export function titleBarOverlayOptions(): Electron.TitleBarOverlayOptions {
  const palette = reported ?? {
    background: DEFAULT_CHROME[effectiveMode()].topBar,
    symbolColor: DEFAULT_CHROME[effectiveMode()].text,
  };
  return { color: palette.background, symbolColor: palette.symbolColor, height: OVERLAY_HEIGHT };
}

function syncWindows(): void {
  const frame = frameBackgroundColor();
  // macOS has no overlay: the traffic lights follow the native theme.
  const overlay = process.platform === 'darwin' ? null : titleBarOverlayOptions();
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.setBackgroundColor(frame);
    if (overlay) window.setTitleBarOverlay(overlay);
  }
}

function readThemeMode(values: Record<string, unknown> | undefined): ThemeMode {
  const setting = values?.['appearance.theme'];
  return setting === 'light' || setting === 'dark' ? setting : 'auto';
}

function applyMode(next: ThemeMode): void {
  if (next === mode && nativeTheme.themeSource !== 'system') return;
  mode = next;
  nativeTheme.themeSource = next === 'auto' ? 'system' : next;
  syncWindows();
}

/** The renderer's resolved palette for the active variant. */
export function applyWindowChromePalette(palette: WindowChromePalette): void {
  reported = palette;
  syncWindows();
}

/**
 * Bind the persisted mode once the host storage exists (called from
 * `installRpcHost`): apply the stored value, then follow changes live.
 */
export function installWindowChromeSubscription(storage: Pick<HostStorage, 'get' | 'subscribe'>): void {
  void storage.get(OH.settingsUser).then((values) => {
    applyMode(readThemeMode(values));
  });
  storage.subscribe(OH.settingsUser, (next) => {
    applyMode(readThemeMode(next));
  });
}

function isPalette(value: unknown): value is WindowChromePalette {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.background === 'string' && typeof candidate.symbolColor === 'string';
}

export function installWindowChromeHandler(): void {
  ipcMain.handle(CHANNEL, (_event, raw: unknown) => {
    if (isPalette(raw)) applyWindowChromePalette(raw);
  });
}
