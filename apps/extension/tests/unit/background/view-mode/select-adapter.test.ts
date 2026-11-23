/**
 * View-mode adapter selection — a browser whose manifest holds no side
 * panel gets the popup-only adapter, which keeps the toolbar button bound
 * to the popup whatever mode is stored.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromiumViewModeAdapter, POPUP_PATH } from '@/background/view-mode/adapter-chromium';
import { popupOnlyViewModeAdapter } from '@/background/view-mode/adapter-popup-only';
import { hasSidePanelSurface, selectViewModeAdapter } from '@/background/view-mode/select-adapter';

function manifestWith(permissions: string[]): void {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({
    manifest_version: 3,
    name: 'Open Headers',
    version: '2026.11.1',
    permissions,
  } as chrome.runtime.Manifest);
}

const setPopup = vi.fn(() => Promise.resolve());
const action = chrome.action as unknown as { setPopup?: typeof setPopup };

afterEach(() => {
  vi.mocked(chrome.runtime.getManifest).mockReset();
  setPopup.mockClear();
  delete action.setPopup;
});

describe('selectViewModeAdapter', () => {
  it('a manifest holding the side panel permission keeps the side-panel adapter', () => {
    manifestWith(['storage', 'sidePanel']);
    expect(hasSidePanelSurface()).toBe(true);
    expect(selectViewModeAdapter()).toBe(chromiumViewModeAdapter);
  });

  it('a manifest without it gets the popup-only adapter', () => {
    manifestWith(['storage']);
    expect(hasSidePanelSurface()).toBe(false);
    expect(selectViewModeAdapter()).toBe(popupOnlyViewModeAdapter);
  });
});

describe('popupOnlyViewModeAdapter', () => {
  it.each(['popup', 'sidepanel'] as const)(
    'binds the toolbar to the popup when the stored mode is %s',
    async (mode) => {
      action.setPopup = setPopup;
      await popupOnlyViewModeAdapter.bindToolbarForMode(mode);
      expect(setPopup).toHaveBeenCalledExactlyOnceWith({ popup: POPUP_PATH });
    },
  );

  it('has no surface to open, close or query', async () => {
    await expect(popupOnlyViewModeAdapter.openFromRenderer('sidepanel')).resolves.toEqual({ opened: false });
    await expect(popupOnlyViewModeAdapter.openFromSW('popup', {})).resolves.toEqual({ opened: false });
    await expect(popupOnlyViewModeAdapter.surfaceIsOpen('sidepanel', {})).resolves.toBeNull();
  });
});
