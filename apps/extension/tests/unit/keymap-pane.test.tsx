/**
 * Keymap pane MVP — Settings → Keyboard rendered as an interactive
 * keymap instead of flat record-button rows.
 *
 * Covers: rows anchored by data-setting-key (settings-search deep
 * links), inline record via the chord badge, unbind, the modified dot
 * and reset derived against the host-aware default (`getDefault`), the
 * plain-text filter, and collapsible group headers.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import KeymapPane from '@openheaders/ui/workbench/settings/components/keymap/KeymapPane';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import type { CategoryDef } from '@openheaders/ui/workbench/settings/types';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
  }

  subscribe(): () => void {
    return () => {};
  }
}

const keyboardCategory: CategoryDef = {
  id: 'keyboard',
  label: 'Keyboard',
  icon: null,
  order: 80,
  subcategories: [
    { id: 'global', label: 'All Surfaces', order: 5 },
    { id: 'workbench-general', label: 'Workbench', order: 10 },
    { id: 'workbench-layout', label: 'Workbench · Layout', order: 20 },
    { id: 'workbench-tabs', label: 'Workbench · Tabs', order: 30 },
    { id: 'workbench-focus', label: 'Workbench · Focus', order: 40 },
    { id: 'workbench-editor', label: 'Workbench · Editor', order: 50 },
  ],
};

async function setup(host: 'extension' | 'desktop' = 'extension'): Promise<ReturnType<typeof render>> {
  setCurrentHost(host);
  configureSettingsStorage(new MemoryDictStorage());
  await initSettingsStore();
  const defs = allDefs().filter((d) => d.category === 'keyboard');
  return render(<KeymapPane category={keyboardCategory} defs={defs} />);
}

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }));
}

beforeEach(() => {
  __resetStoreForTests();
});

afterEach(() => {
  cleanup();
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('KeymapPane', () => {
  it('renders every keyboard def as a row anchored by data-setting-key', async () => {
    const { container } = await setup();
    for (const def of allDefs().filter((d) => d.category === 'keyboard')) {
      expect(container.querySelector(`[data-setting-key="${def.key}"]`)).not.toBeNull();
    }
  });

  it('records a chord inline from the badge and flags the row modified', async () => {
    const { container } = await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    expect(screen.getByText('Press keys…')).toBeTruthy();

    act(() => press({ key: 'p', code: 'KeyP', altKey: true }));
    expect(storeGet('keyboard.save')).toBe('alt+p');

    const row = container.querySelector('[data-setting-key="keyboard.save"]');
    expect(row?.querySelector('[aria-label="modified"]')).not.toBeNull();
  });

  it('unbinds via the row × button', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove shortcut for Save' }));
    expect(storeGet('keyboard.save')).toBe('');
  });

  it('derives modified and reset against the host-aware default', async () => {
    const { container } = await setup('desktop');
    const row = (): Element | null => container.querySelector('[data-setting-key="keyboard.closeTab"]');

    // On the desktop host the effective default is mod+w (getDefault),
    // not the registered browser fallback alt+w — so alt+w counts as a
    // user override here.
    expect(row()?.querySelector('[aria-label="modified"]')).toBeNull();
    act(() => storeSet('keyboard.closeTab', 'alt+w'));
    expect(row()?.querySelector('[aria-label="modified"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset shortcut for Close Tab' }));
    expect(storeGet('keyboard.closeTab')).toBe('mod+w');
    expect(row()?.querySelector('[aria-label="modified"]')).toBeNull();
  });

  it('filters rows by the pane search field', async () => {
    const { container } = await setup();
    fireEvent.change(screen.getByPlaceholderText('Search shortcuts'), { target: { value: 'Close Tab' } });
    expect(container.querySelector('[data-setting-key="keyboard.closeTab"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).toBeNull();
  });

  it('groups the editor-scoped bindings under the Editor subcategory', async () => {
    const { container } = await setup();
    const editorGroup = screen.getByRole('button', { name: /Workbench · Editor/ });
    expect(editorGroup).toBeTruthy();
    for (const key of ['keyboard.find', 'keyboard.replace', 'keyboard.formatCode']) {
      expect(container.querySelector(`[data-setting-key="${key}"]`)).not.toBeNull();
    }
  });

  it('collapses and re-expands a group from its header', async () => {
    const { container } = await setup();
    const header = (): HTMLElement => screen.getByRole('button', { name: /Workbench · Tabs/ });

    fireEvent.click(header());
    expect(container.querySelector('[data-setting-key="keyboard.closeTab"]')).toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).not.toBeNull();

    fireEvent.click(header());
    expect(container.querySelector('[data-setting-key="keyboard.closeTab"]')).not.toBeNull();
  });
});
