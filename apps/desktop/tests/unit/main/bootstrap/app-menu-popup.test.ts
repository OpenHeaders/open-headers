import { BrowserWindow, ipcMain, Menu } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installAppMenuPopupHandler, popupApplicationMenu } from '@/main/bootstrap/app-menu-popup';

function senderWithZoom(zoom: number): Electron.WebContents {
  return { getZoomFactor: () => zoom } as unknown as Electron.WebContents;
}

type PopupOptions = { window: BrowserWindow; x: number; y: number; callback: () => void };

describe('app-menu-popup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pops the application menu under the anchor in the sender window, scaled by its zoom', () => {
    const popup = vi.fn();
    const window = {} as BrowserWindow;
    vi.spyOn(Menu, 'getApplicationMenu').mockReturnValue({ popup } as unknown as Menu);
    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue(window);

    void popupApplicationMenu(senderWithZoom(1.5), { x: 10, y: 33 });

    expect(popup).toHaveBeenCalledWith(expect.objectContaining({ window, x: 15, y: 50 }));
  });

  it('resolves when the native menu closes, not when it opens', async () => {
    const popup = vi.fn();
    vi.spyOn(Menu, 'getApplicationMenu').mockReturnValue({ popup } as unknown as Menu);
    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue({} as BrowserWindow);

    let settled = false;
    const closed = popupApplicationMenu(senderWithZoom(1), { x: 0, y: 0 }).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    const options = popup.mock.calls[0]?.[0] as PopupOptions;
    options.callback();
    await closed;
    expect(settled).toBe(true);
  });

  it('resolves at once without an application menu or a window for the sender', async () => {
    const popup = vi.fn();
    vi.spyOn(Menu, 'getApplicationMenu').mockReturnValue(null);
    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue({} as BrowserWindow);
    await popupApplicationMenu(senderWithZoom(1), { x: 0, y: 0 });

    vi.spyOn(Menu, 'getApplicationMenu').mockReturnValue({ popup } as unknown as Menu);
    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue(null);
    await popupApplicationMenu(senderWithZoom(1), { x: 0, y: 0 });

    expect(popup).not.toHaveBeenCalled();
  });

  it('answers the renderer channel with the sender-anchored popup', () => {
    type Handler = (event: { sender: Electron.WebContents }, anchor: { x: number; y: number }) => Promise<void>;
    const handlers = new Map<string, Handler>();
    vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: Handler) => {
      handlers.set(channel, fn);
    }) as typeof ipcMain.handle);
    const popup = vi.fn();
    const window = {} as BrowserWindow;
    vi.spyOn(Menu, 'getApplicationMenu').mockReturnValue({ popup } as unknown as Menu);
    vi.spyOn(BrowserWindow, 'fromWebContents').mockReturnValue(window);

    installAppMenuPopupHandler();
    const handler = handlers.get('oh:app-menu:popup');
    expect(handler).toBeDefined();
    void handler?.({ sender: senderWithZoom(1) }, { x: 8, y: 40 });

    expect(popup).toHaveBeenCalledWith(expect.objectContaining({ window, x: 8, y: 40 }));
  });
});
