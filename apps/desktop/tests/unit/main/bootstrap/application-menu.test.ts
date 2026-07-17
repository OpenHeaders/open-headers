import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import { PSEUDO_LOCALE } from '@openheaders/i18n';
import { Menu, type MenuItem, type MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, type MockInstance, vi } from 'vitest';
import { installApplicationMenu } from '@/main/bootstrap/application-menu';
import { installLocaleSubscription } from '@/main/bootstrap/locale';

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

describe('application menu labels', () => {
  it('byte-matches the shipped custom labels and leaves role items to Electron', () => {
    const spy = vi.spyOn(Menu, 'buildFromTemplate');
    installApplicationMenu();
    const template = capturedTemplate(spy);

    const topLabels = template.map((entry) => entry.label);
    const expectedTop = ['File', 'Edit', 'View', 'Window', 'Help'];
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

    expect(submenuLabels(template, 'Help')).toEqual(
      expect.arrayContaining(['Documentation', 'Report an Issue', 'License Agreement']),
    );

    if (isMac) {
      const appMenuLabels = submenuLabels(template, 'OpenHeaders');
      expect(appMenuLabels).toContain('About OpenHeaders');
      expect(appMenuLabels).toContain('Settings…');
      expect(appMenuLabels).toContain('Disable Hardware Acceleration');
    }
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
