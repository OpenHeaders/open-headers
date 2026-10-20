import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWindowChromePalette,
  frameBackgroundColor,
  installWindowChromeHandler,
  installWindowChromeSubscription,
  titleBarOverlayOptions,
} from '@/main/bootstrap/window-chrome';

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

function setOsDark(dark: boolean): void {
  Object.defineProperty(nativeTheme, 'shouldUseDarkColors', { value: dark, configurable: true, writable: true });
}

function liveWindow() {
  const setTitleBarOverlay = vi.fn();
  const setBackgroundColor = vi.fn();
  const window = { isDestroyed: () => false, setTitleBarOverlay, setBackgroundColor } as unknown as BrowserWindow;
  return { window, setTitleBarOverlay, setBackgroundColor };
}

function makeStorage(settings: Record<string, unknown> | undefined) {
  const listeners: Array<(next: Record<string, unknown> | undefined) => void> = [];
  const storage: Pick<HostStorage, 'get' | 'subscribe'> = {
    get: async <T>(spec: StorageKey<T>) => (spec.key === OH.settingsUser.key ? settings : undefined) as T | undefined,
    subscribe: <T>(_spec: StorageKey<T>, fn: (next: T | undefined) => void) => {
      listeners.push(fn as (next: Record<string, unknown> | undefined) => void);
      return () => undefined;
    },
  };
  const write = (next: Record<string, unknown> | undefined): void => {
    for (const fn of listeners) fn(next);
  };
  return { storage, write };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const DARK_OVERLAY = { color: '#262626', symbolColor: '#e6e6e6', height: 40 };
const LIGHT_OVERLAY = { color: '#e8e8e8', symbolColor: '#1d1d1f', height: 40 };

describe('window-chrome', () => {
  beforeEach(() => {
    setPlatform('win32');
    setOsDark(false);
    nativeTheme.themeSource = 'system';
  });

  afterEach(() => {
    setPlatform(realPlatform);
    vi.restoreAllMocks();
  });

  it('wears the default palette of the effective mode before the renderer reports', () => {
    setOsDark(true);
    expect(frameBackgroundColor()).toBe('#1f1f1f');
    expect(titleBarOverlayOptions()).toEqual(DARK_OVERLAY);
    setOsDark(false);
    expect(frameBackgroundColor()).toBe('#ffffff');
    expect(titleBarOverlayOptions()).toEqual(LIGHT_OVERLAY);
  });

  it('binds the persisted mode to the native theme source and re-dresses every live window', async () => {
    const live = liveWindow();
    const gone = { isDestroyed: () => true, setTitleBarOverlay: vi.fn(), setBackgroundColor: vi.fn() };
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([live.window, gone as unknown as BrowserWindow]);
    const { storage, write } = makeStorage({ 'appearance.theme': 'dark' });

    installWindowChromeSubscription(storage);
    await settle();
    expect(nativeTheme.themeSource).toBe('dark');
    expect(live.setBackgroundColor).toHaveBeenCalled();
    expect(live.setTitleBarOverlay).toHaveBeenCalled();
    expect(gone.setTitleBarOverlay).not.toHaveBeenCalled();

    write({ 'appearance.theme': 'light' });
    expect(nativeTheme.themeSource).toBe('light');

    // An absent dict means auto — the choice goes back to the OS.
    write(undefined);
    expect(nativeTheme.themeSource).toBe('system');
  });

  it('applies the reported palette to every live window and keeps it for later ones', () => {
    const first = liveWindow();
    const second = liveWindow();
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([first.window, second.window]);

    applyWindowChromePalette({ background: '#101418', symbolColor: 'rgba(255,255,255,0.85)' });

    const overlay = { color: '#101418', symbolColor: 'rgba(255,255,255,0.85)', height: 40 };
    expect(first.setTitleBarOverlay).toHaveBeenCalledWith(overlay);
    expect(second.setTitleBarOverlay).toHaveBeenCalledWith(overlay);
    expect(titleBarOverlayOptions()).toEqual(overlay);
  });

  it('touches no overlay on macOS, where only the native theme source applies', () => {
    setPlatform('darwin');
    const live = liveWindow();
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([live.window]);

    applyWindowChromePalette({ background: '#e8e8e8', symbolColor: '#1d1d1f' });

    expect(live.setBackgroundColor).toHaveBeenCalled();
    expect(live.setTitleBarOverlay).not.toHaveBeenCalled();
  });

  it('answers the renderer channel and ignores a malformed report', () => {
    type Handler = (event: unknown, raw: unknown) => void;
    const handlers = new Map<string, Handler>();
    vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: Handler) => {
      handlers.set(channel, fn);
    }) as typeof ipcMain.handle);
    const live = liveWindow();
    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([live.window]);

    installWindowChromeHandler();
    const handler = handlers.get('oh:window-chrome:apply');
    expect(handler).toBeDefined();

    handler?.({}, { background: 1 });
    expect(live.setTitleBarOverlay).not.toHaveBeenCalled();

    handler?.({}, { background: '#262626', symbolColor: '#e6e6e6' });
    expect(live.setTitleBarOverlay).toHaveBeenCalledWith(DARK_OVERLAY);
  });
});
