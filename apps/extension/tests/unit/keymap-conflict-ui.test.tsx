/**
 * Keymap pane conflict UI — the P2 surface over the pure engine.
 *
 * Covers: per-row warning badges on duplicate assignments, the sticky
 * summary strip and its show-only-conflicts filter, record-time
 * interception (Reassign / Keep both / Cancel), cross-scope captures
 * committing without a prompt, and the reserved-chord badge on a
 * browser-tab host.
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

function conflictBadges(container: HTMLElement, settingKey: string): number {
  const row = container.querySelector(`[data-setting-key="${settingKey}"]`);
  return row ? row.querySelectorAll('[aria-label="Shortcut conflict"]').length : 0;
}

beforeEach(() => {
  __resetStoreForTests();
});

afterEach(() => {
  cleanup();
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('KeymapPane conflicts', () => {
  it('badges every row of an in-scope duplicate and shows the summary strip', async () => {
    const { container } = await setup();
    act(() => storeSet('keyboard.save', 'mod+k'));

    expect(conflictBadges(container, 'keyboard.save')).toBe(1);
    expect(conflictBadges(container, 'keyboard.commandPalette')).toBe(1);
    expect(screen.getByText('2 shortcuts have conflicting assignments')).toBeTruthy();
  });

  it('does not badge identical chords across the workbench/popup scope boundary', async () => {
    const { container } = await setup();
    act(() => storeSet('keyboard.save', 'e')); // popup editRow default

    expect(conflictBadges(container, 'keyboard.save')).toBe(0);
    expect(conflictBadges(container, 'keyboard.popup.editRow')).toBe(0);
    expect(screen.queryByText(/conflicting assignment/)).toBeNull();
  });

  it('filters to conflicted rows from the summary strip and back', async () => {
    const { container } = await setup();
    act(() => storeSet('keyboard.save', 'mod+k'));

    fireEvent.click(screen.getByText('Show conflicts'));
    expect(container.querySelector('[data-setting-key="keyboard.save"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.commandPalette"]')).not.toBeNull();
    expect(container.querySelector('[data-setting-key="keyboard.newRule"]')).toBeNull();

    fireEvent.click(screen.getByText('Show all shortcuts'));
    expect(container.querySelector('[data-setting-key="keyboard.newRule"]')).not.toBeNull();
  });

  it('intercepts recording an in-scope duplicate and reassigns on request', async () => {
    await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'k', code: 'KeyK', metaKey: true })); // command palette default

    // Nothing committed yet — the row is waiting on a resolution.
    expect(storeGet('keyboard.save')).toBe('mod+s');
    expect(screen.getByText(/already assigned to: Open Command Palette/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }));
    expect(storeGet('keyboard.save')).toBe('mod+k');
    expect(storeGet('keyboard.commandPalette')).toBe('');
  });

  it('keeps both bindings (still flagged) when the user accepts the conflict', async () => {
    const { container } = await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'k', code: 'KeyK', metaKey: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep both' }));

    expect(storeGet('keyboard.save')).toBe('mod+k');
    expect(storeGet('keyboard.commandPalette')).toBe('mod+k');
    expect(conflictBadges(container, 'keyboard.save')).toBe(1);
    expect(conflictBadges(container, 'keyboard.commandPalette')).toBe(1);
  });

  it('cancels the pending capture without touching either binding', async () => {
    await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'k', code: 'KeyK', metaKey: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(storeGet('keyboard.save')).toBe('mod+s');
    expect(storeGet('keyboard.commandPalette')).toBe('mod+k');
    expect(screen.queryByText(/already assigned/)).toBeNull();
  });

  it('commits a chord owned only by the other scope without a prompt', async () => {
    await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'e', code: 'KeyE' })); // popup editRow default

    expect(storeGet('keyboard.save')).toBe('e');
    expect(screen.queryByText(/already assigned/)).toBeNull();
  });

  it('warns immediately when a browser-reserved chord is recorded', async () => {
    const { container } = await setup();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'y', code: 'KeyY', metaKey: true }));
    const row = container.querySelector('[data-setting-key="keyboard.save"]');
    expect(row?.querySelector('[aria-label="Reserved shortcut"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Change shortcut for Save' }));
    act(() => press({ key: 'l', code: 'KeyL', metaKey: true })); // browser address bar
    expect(storeGet('keyboard.save')).toBe('mod+l');
    expect(row?.querySelector('[aria-label="Reserved shortcut"]')).not.toBeNull();
  });
});
