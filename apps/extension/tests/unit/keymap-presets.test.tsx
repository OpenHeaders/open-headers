/**
 * Keyboard presets — named base keymaps beneath per-key overrides.
 *
 * Covers: the preset-aware default seam (modified/reset compare against
 * the ACTIVE preset's value), switch materialization (non-overridden
 * keys move to the new base, overrides — including explicit unbinds —
 * survive, switching back restores), restore-preset clearing the
 * override delta, popup bindings staying outside the preset domain,
 * registration order putting `keyboard.preset` before every binding
 * (the store's load loops apply values in that order), persisted-state
 * loads computing modified flags against the persisted preset, base-map
 * collision-freedom, and the pane's preset chrome.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/keyboard-popup';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import KeymapPane from '@openheaders/ui/workbench/settings/components/keymap/KeymapPane';
import {
  applyPresetSwitch,
  presetDomainDefs,
  restorePreset,
} from '@openheaders/ui/workbench/settings/components/keymap/keymap-preset-actions';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import { presetChord } from '@openheaders/ui/workbench/settings/schema/keyboard-presets';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
  isModified as storeIsModified,
  reset as storeReset,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import type { CategoryDef, SettingDef } from '@openheaders/ui/workbench/settings/types';
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

function keyboardDefs(): SettingDef[] {
  return allDefs().filter((d) => d.category === 'keyboard');
}

async function initStore(seed?: Record<string, unknown>): Promise<void> {
  const storage = new MemoryDictStorage();
  if (seed) storage.state.set('user', seed);
  configureSettingsStorage(storage);
  await initSettingsStore();
}

beforeEach(() => {
  setCurrentHost('extension');
  __resetStoreForTests();
});

afterEach(() => {
  cleanup();
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('preset registration and base maps', () => {
  it('registers keyboard.preset before every keyboard binding def', () => {
    const keys = keyboardDefs().map((d) => d.key);
    expect(keys.indexOf('keyboard.preset')).toBe(0);
  });

  it('keeps the vscode base map collision-free on the workbench surface', () => {
    const surface = keyboardDefs().filter(
      (d) => d.type === 'keybinding' && (d.subcategory?.startsWith('workbench') === true || d.subcategory === 'global'),
    );
    const chords = surface
      .map((d) => presetChord('vscode', d.key) ?? String(d.default ?? ''))
      .filter((chord) => chord.length > 0);
    expect(new Set(chords).size).toBe(chords.length);
  });

  it('scopes the preset domain to workbench bindings only', () => {
    const domain = presetDomainDefs(keyboardDefs());
    expect(domain.some((d) => d.key === 'keyboard.commandPalette')).toBe(true);
    expect(domain.some((d) => d.key === 'keyboard.preset')).toBe(false);
    expect(domain.some((d) => d.key.startsWith('keyboard.popup.'))).toBe(false);
  });
});

describe('preset switch materialization', () => {
  it('moves non-overridden keys to the new base and falls through where the preset is silent', async () => {
    await initStore();
    applyPresetSwitch(keyboardDefs(), 'vscode');

    expect(storeGet('keyboard.commandPalette')).toBe('mod+shift+p');
    expect(storeGet('keyboard.toggleLeftSidebar')).toBe('mod+b');
    expect(storeGet('keyboard.toggleRightSidebar')).toBe('mod+alt+b');
    expect(storeGet('keyboard.toggleBottomPanel')).toBe('mod+j');
    // Fall-through: the preset is silent, so the registered default holds.
    expect(storeGet('keyboard.save')).toBe('mod+s');
    // Nothing reads as an override under the new base.
    expect(storeIsModified('keyboard.commandPalette')).toBe(false);
    expect(storeIsModified('keyboard.save')).toBe(false);
  });

  it('preserves overrides — including explicit unbinds — across the switch', async () => {
    await initStore();
    storeSet('keyboard.save', 'alt+p');
    storeSet('keyboard.toggleLeftSidebar', '');

    applyPresetSwitch(keyboardDefs(), 'vscode');

    expect(storeGet('keyboard.save')).toBe('alt+p');
    expect(storeIsModified('keyboard.save')).toBe(true);
    expect(storeGet('keyboard.toggleLeftSidebar')).toBe('');
    expect(storeIsModified('keyboard.toggleLeftSidebar')).toBe(true);
  });

  it('drops the modified flag when an override coincides with the new base', async () => {
    await initStore();
    storeSet('keyboard.commandPalette', 'mod+shift+p');
    expect(storeIsModified('keyboard.commandPalette')).toBe(true);

    applyPresetSwitch(keyboardDefs(), 'vscode');

    expect(storeGet('keyboard.commandPalette')).toBe('mod+shift+p');
    expect(storeIsModified('keyboard.commandPalette')).toBe(false);
  });

  it('switching back restores the previous base for everything the user never touched', async () => {
    await initStore();
    storeSet('keyboard.commandPalette', 'mod+e');
    applyPresetSwitch(keyboardDefs(), 'vscode');
    applyPresetSwitch(keyboardDefs(), 'openheaders');

    expect(storeGet('keyboard.toggleBottomPanel')).toBe("mod+'");
    expect(storeGet('keyboard.toggleLeftSidebar')).toBe('mod+[');
    expect(storeGet('keyboard.commandPalette')).toBe('mod+e');
    expect(storeIsModified('keyboard.commandPalette')).toBe(true);
  });

  it('never touches popup bindings', async () => {
    await initStore();
    storeSet('keyboard.popup.toggleOptionsMenu', 'm');

    applyPresetSwitch(keyboardDefs(), 'vscode');

    expect(storeGet('keyboard.popup.toggleOptionsMenu')).toBe('m');
    expect(storeIsModified('keyboard.popup.toggleOptionsMenu')).toBe(true);
    expect(storeGet('keyboard.popup.focusSearch')).toBe('/');
  });
});

describe('reset and restore against the active preset', () => {
  it('per-row reset targets the active preset value, not the registry default', async () => {
    await initStore();
    applyPresetSwitch(keyboardDefs(), 'vscode');
    storeSet('keyboard.toggleLeftSidebar', 'alt+9');
    expect(storeIsModified('keyboard.toggleLeftSidebar')).toBe(true);

    storeReset('keyboard.toggleLeftSidebar');

    expect(storeGet('keyboard.toggleLeftSidebar')).toBe('mod+b');
    expect(storeIsModified('keyboard.toggleLeftSidebar')).toBe(false);
  });

  it('restorePreset clears every domain override and leaves popup overrides alone', async () => {
    await initStore();
    applyPresetSwitch(keyboardDefs(), 'vscode');
    storeSet('keyboard.save', 'alt+p');
    storeSet('keyboard.toggleLeftSidebar', '');
    storeSet('keyboard.popup.toggleOptionsMenu', 'm');

    const cleared = restorePreset(keyboardDefs());

    expect(cleared).toBe(2);
    expect(storeGet('keyboard.save')).toBe('mod+s');
    expect(storeGet('keyboard.toggleLeftSidebar')).toBe('mod+b');
    expect(storeGet('keyboard.popup.toggleOptionsMenu')).toBe('m');
    expect(storeIsModified('keyboard.popup.toggleOptionsMenu')).toBe(true);
  });
});

describe('persisted preset state', () => {
  it('computes modified flags against the persisted preset on load', async () => {
    await initStore({
      'keyboard.preset': 'vscode',
      'keyboard.commandPalette': 'mod+shift+p',
      'keyboard.save': 'alt+p',
    });

    // Base-equal persisted value under the persisted preset — clean.
    expect(storeIsModified('keyboard.commandPalette')).toBe(false);
    // Genuine override — flagged.
    expect(storeIsModified('keyboard.save')).toBe(true);
  });
});

describe('KeymapPane preset chrome', () => {
  async function setupPane(): Promise<ReturnType<typeof render>> {
    await initStore();
    return render(<KeymapPane category={keyboardCategory} defs={keyboardDefs()} />);
  }

  it('shows the restore button only while overrides exist and clears them on click', async () => {
    await setupPane();
    expect(screen.queryByText(/Restore preset/)).toBeNull();

    act(() => storeSet('keyboard.save', 'alt+p'));
    fireEvent.click(screen.getByText('Restore preset (1 customization)'));

    expect(storeGet('keyboard.save')).toBe('mod+s');
    expect(screen.queryByText(/Restore preset/)).toBeNull();
  });

  it('repaints rows against the new base after a switch', async () => {
    const { container } = await setupPane();
    act(() => applyPresetSwitch(keyboardDefs(), 'vscode'));

    const row = container.querySelector('[data-setting-key="keyboard.commandPalette"]');
    expect(row?.querySelector('[aria-label="modified"]')).toBeNull();
    expect(storeGet('keyboard.commandPalette')).toBe('mod+shift+p');
  });
});
