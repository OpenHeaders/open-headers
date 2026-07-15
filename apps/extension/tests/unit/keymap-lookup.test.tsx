/**
 * Keymap pane reverse lookup — find actions by pressing their shortcut
 * (P3): the keyboard toggle beside the search field arms chord capture,
 * the captured chord filters the list to the actions bound to it across
 * BOTH scopes, unbound chords get a dedicated empty state, reserved
 * chords get the why-nothing-happened note, and text query and chord
 * lookup stay mutually exclusive.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/keyboard-popup';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import KeymapPane from '@openheaders/ui/workbench/settings/components/keymap/KeymapPane';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
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
    { id: 'popup-general', label: 'Popup', order: 110 },
    { id: 'popup-navigation', label: 'Popup · Navigation', order: 120 },
    { id: 'popup-rows', label: 'Popup · Rows', order: 130 },
    { id: 'popup-tabs', label: 'Popup · Tabs', order: 140 },
  ],
};

async function setup(): Promise<ReturnType<typeof render>> {
  setCurrentHost('extension');
  configureSettingsStorage(new MemoryDictStorage());
  await initSettingsStore();
  const defs = allDefs().filter((d) => d.category === 'keyboard');
  return render(<KeymapPane category={keyboardCategory} defs={defs} />);
}

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }));
}

function armLookup(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Find action by shortcut' }));
}

beforeEach(() => {
  __resetStoreForTests();
});

afterEach(() => {
  cleanup();
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('KeymapPane reverse lookup', () => {
  it('filters to the actions bound to the pressed chord across both scopes', async () => {
    const { container } = await setup();

    armLookup();
    expect(screen.getByText('Press keys…')).toBeTruthy();
    act(() => press({ key: '/', code: 'Slash' }));

    // `/` is the default for BOTH the workbench sidebar filter and the
    // popup search focus — reverse lookup answers the factual question,
    // so both surface.
    expect(container.querySelector('[data-setting-key="keyboard.focusSidebarFilter"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.popup.focusSearch"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).toBeNull();
  });

  it('shows the dedicated empty state for an unbound chord', async () => {
    const { container } = await setup();

    armLookup();
    act(() => press({ key: 'x', code: 'KeyX', ctrlKey: true, shiftKey: true }));

    expect(container.querySelector('[data-setting-key]')).toBeNull();
    expect(screen.getByText('No action is bound to Ctrl+Shift+X.')).toBeTruthy();
  });

  it('explains a reserved chord — the why-nothing-happened answer', async () => {
    await setup();

    armLookup();
    act(() => press({ key: 'l', code: 'KeyL', metaKey: true }));

    expect(
      screen.getByText('The browser reserves this shortcut — it may act on it before it reaches the app.'),
    ).toBeTruthy();
    expect(screen.getByText('No action is bound to Ctrl+L.')).toBeTruthy();
  });

  it('clears lookup from the chip close and from Escape', async () => {
    const { container } = await setup();

    armLookup();
    act(() => press({ key: '/', code: 'Slash' }));
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).toBeNull();

    const chipClose = container.querySelector('.ant-tag-close-icon');
    if (!chipClose) throw new Error('lookup chip close icon not rendered');
    fireEvent.click(chipClose);
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).not.toBeNull();

    armLookup();
    act(() => press({ key: '/', code: 'Slash' }));
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).toBeNull();
    act(() => press({ key: 'Escape' }));
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).not.toBeNull();
  });

  it('keeps text query and chord lookup mutually exclusive', async () => {
    const { container } = await setup();

    // Arming lookup clears the query…
    const input = (): HTMLInputElement => screen.getByPlaceholderText('Search shortcuts') as HTMLInputElement;
    fireEvent.change(input(), { target: { value: 'Close Tab' } });
    armLookup();
    expect(input().value).toBe('');
    act(() => press({ key: '/', code: 'Slash' }));
    expect(container.querySelector('[data-setting-key="keyboard.focusSidebarFilter"]')).not.toBeNull();

    // …and typing a query drops the captured chord.
    fireEvent.change(input(), { target: { value: 'Close Tab' } });
    expect(container.querySelector('[data-setting-key="keyboard.closeTab"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.focusSidebarFilter"]')).toBeNull();
    expect(screen.queryByText('No action is bound', { exact: false })).toBeNull();
  });
});
