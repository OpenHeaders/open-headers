import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import { PSEUDO_LOCALE } from '@openheaders/i18n';
import { BrowserWindow, Menu, type MenuItem, type MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, type MockInstance, vi } from 'vitest';
import { installApplicationMenu } from '@/main/bootstrap/application-menu';
import { installLocaleSubscription } from '@/main/bootstrap/locale';
import { sendToRendererWindow } from '@/main/bootstrap/renderer-broadcast';
import { showMainWindow } from '@/main/bootstrap/window-manager';

vi.mock('@/main/bootstrap/window-manager', () => ({
  createChildWindow: vi.fn(),
  getMainWindow: () => null,
  showMainWindow: vi.fn(),
}));
vi.mock('@/main/bootstrap/renderer-broadcast', () => ({
  broadcastToAllRenderers: vi.fn(),
  sendToFocusedRenderer: vi.fn(),
  sendToRendererWindow: vi.fn(),
}));

const isMac = process.platform === 'darwin';

type BuildTemplateSpy = MockInstance<typeof Menu.buildFromTemplate>;
type TemplateEntry = MenuItemConstructorOptions | MenuItem;

function capturedTemplate(spy: BuildTemplateSpy): TemplateEntry[] {
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error('Menu.buildFromTemplate was never called');
  return call[0];
}

function submenuOf(template: TemplateEntry[], label: string): TemplateEntry[] {
  const item = template.find((entry) => entry.label === label);
  if (!item || !Array.isArray(item.submenu)) throw new Error(`no submenu under "${label}"`);
  return item.submenu;
}

function submenuLabels(template: TemplateEntry[], label: string): Array<string | undefined> {
  return submenuOf(template, label)
    .filter((entry) => entry.type !== 'separator')
    .map((entry) => entry.label);
}

/** A menu's labels as its dividers group them. */
function submenuGroups(template: TemplateEntry[], label: string): Array<Array<string | undefined>> {
  return submenuOf(template, label)
    .reduce<Array<Array<string | undefined>>>(
      (groups, entry) => {
        if (entry.type === 'separator') groups.push([]);
        else groups[groups.length - 1].push(entry.label);
        return groups;
      },
      [[]],
    )
    .filter((group) => group.length > 0);
}

describe('application menu labels', () => {
  it('byte-matches the shipped custom labels and leaves role items to Electron', () => {
    const spy = vi.spyOn(Menu, 'buildFromTemplate');
    installApplicationMenu();
    const template = capturedTemplate(spy);

    const topLabels = template.map((entry) => entry.label);
    const expectedTop = ['File', 'Edit', 'View', 'Window', 'Diagnostics', 'Help'];
    expect(topLabels).toEqual(isMac ? ['OpenHeaders', ...expectedTop] : expectedTop);

    const fileLabels = submenuLabels(template, 'File');
    expect(fileLabels).toContain('New…');
    expect(fileLabels).toContain('New Tab');
    expect(fileLabels).toContain('New Window');
    expect(fileLabels).toContain('Import…');
    expect(fileLabels).toContain('Close Tab');

    // Role-bound Edit entries take Electron's own labels — none of ours.
    const editEntries = submenuOf(template, 'Edit').filter((entry) => entry.type !== 'separator');
    expect(editEntries.every((entry) => entry.role !== undefined && entry.label === undefined)).toBe(true);

    const viewEntries = submenuOf(template, 'View');
    const resetZoom = viewEntries.find((entry) => entry.role === 'resetZoom');
    expect(resetZoom?.label).toBe('Actual Size');

    const windowLabels = submenuLabels(template, 'Window');
    expect(windowLabels).toContain('Next Tab');
    expect(windowLabels).toContain('Previous Tab');

    // The live view, then what is saved or opened from disk.
    expect(submenuGroups(template, 'Diagnostics')).toEqual([
      ['Activity Monitor'],
      ['Download Anonymized Diagnostic Bundle…', 'Open Logs Folder'],
    ]);

    // Three groups, one divider between each: learn, ask or tell us,
    // legal — in this order, nothing between them.
    expect(submenuGroups(template, 'Help').slice(0, 3)).toEqual([
      ['Documentation', 'Keyboard Shortcuts', 'Release Notes'],
      ['Report Issue', 'Feature Request', 'Chat with Us on Discord'],
      ['License Agreement', 'Privacy Policy'],
    ]);
    if (isMac) expect(template.find((entry) => entry.label === 'Help')?.role).toBe('help');

    if (isMac) {
      const appMenuLabels = submenuLabels(template, 'OpenHeaders');
      expect(appMenuLabels).toContain('About OpenHeaders');
      expect(appMenuLabels).toContain('Settings…');
      expect(appMenuLabels).toContain('Disable Hardware Acceleration');
    }
  });

  describe('Diagnostics › Activity Monitor', () => {
    function clickActivityMonitor(): void {
      const spy = vi.spyOn(Menu, 'buildFromTemplate');
      installApplicationMenu();
      const item = submenuOf(capturedTemplate(spy), 'Diagnostics').find((entry) => entry.label === 'Activity Monitor');
      if (!item || typeof item.click !== 'function') throw new Error('no Activity Monitor item to click');
      // The item reads nothing of the press — no menu item, window or event exists outside the runtime to hand it.
      Reflect.apply(item.click, undefined, []);
    }

    it('asks the focused window to open the tool window — and reveals no other', () => {
      const focused = new BrowserWindow();
      const getFocused = vi.spyOn(BrowserWindow, 'getFocusedWindow').mockReturnValue(focused);
      vi.mocked(sendToRendererWindow).mockClear();
      vi.mocked(showMainWindow).mockClear();
      try {
        clickActivityMonitor();
        expect(sendToRendererWindow).toHaveBeenCalledExactlyOnceWith(focused, 'menuCommand', {
          command: 'openActivityMonitor',
        });
        expect(showMainWindow).not.toHaveBeenCalled();
      } finally {
        getFocused.mockRestore();
      }
    });

    it('reveals the primary window first where none is focused', () => {
      vi.mocked(showMainWindow).mockClear();
      clickActivityMonitor();
      expect(showMainWindow).toHaveBeenCalledOnce();
    });
  });

  it('rebuilds with new labels when the locale changes', async () => {
    const spy = vi.spyOn(Menu, 'buildFromTemplate');
    installApplicationMenu();
    const before = capturedTemplate(spy);
    expect(before.some((entry) => entry.label === 'File')).toBe(true);

    let notify: ((next: Record<string, unknown> | undefined) => void) | undefined;
    const storage: Pick<HostStorage, 'get' | 'subscribe'> = {
      get: async <T>(_spec: StorageKey<T>) => undefined,
      subscribe: <T>(_spec: StorageKey<T>, fn: (next: T | undefined) => void) => {
        notify = fn as (next: Record<string, unknown> | undefined) => void;
        return () => undefined;
      },
    };
    installLocaleSubscription(storage);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const callsBefore = spy.mock.calls.length;
    notify?.({ 'general.language': PSEUDO_LOCALE });
    expect(spy.mock.calls.length).toBeGreaterThan(callsBefore);
    const after = capturedTemplate(spy);
    // Pseudo relabels our custom entries — the English bytes are gone.
    expect(after.some((entry) => entry.label === 'File')).toBe(false);

    notify?.({ 'general.language': 'en' });
    const restored = capturedTemplate(spy);
    expect(restored.some((entry) => entry.label === 'File')).toBe(true);
  });
});
