/**
 * P6 parity — every shortcut-hint surface outside the keymap pane
 * tracks rebinds and preset switches live.
 *
 * Covers: the command palette's Keyboard Shortcuts row (previously a
 * hardcoded `?`), the docs cheatsheet intro chord and regions diagram
 * (previously a non-reactive snapshot), preset switches repainting the
 * cheatsheet's panel rows, and the popup shortcuts overlay header hint
 * (previously a hardcoded `?`; drops when the toggle is unbound).
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/keyboard-popup';
import KeyboardShortcutsOverlay from '@openheaders/ui/popup/components/KeyboardShortcutsOverlay';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { KeyboardRegionsDiagram } from '@openheaders/ui/workbench/components/docs/diagrams/keyboard-shortcuts';
import { KeyboardShortcutsSection } from '@openheaders/ui/workbench/components/docs/sections/reference';
import { useCommandPaletteData } from '@openheaders/ui/workbench/hooks/useCommandPaletteData';
import { applyPresetSwitch } from '@openheaders/ui/workbench/settings/components/keymap/keymap-preset-actions';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
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

async function initStore(): Promise<void> {
  configureSettingsStorage(new MemoryDictStorage());
  await initSettingsStore();
}

function keyboardDefs() {
  return allDefs().filter((d) => d.category === 'keyboard');
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

// ── Command palette ────────────────────────────────────────────────

const noop = (): void => {};

const PaletteProbe: React.FC = () => {
  const { sections } = useCommandPaletteData({
    rules: [],
    templates: [],
    localCollectionTrees: [],
    templateCollectionTrees: [],
    requestCollectionTrees: [],
    pausedUids: new Set<string>(),
    environments: [],
    openEditTab: noop,
    openCreateTab: noop,
    openTemplateEditTab: noop,
    openRequestEditTab: noop,
    openEnvironmentEdit: noop,
    openWorkspaceVariables: noop,
    openVault: noop,
    openScriptPackages: noop,
    openLiveVariables: noop,
    onOpenCreateMenu: noop,
    onTogglePanel: noop,
    onToggleActivityFeed: noop,
    onShowShortcuts: noop,
    onOpenSettings: noop,
  });
  const commands = sections.find((s) => s.id === 'commands');
  const shortcuts = commands?.items.find((i) => i.id === 'cmd-shortcuts');
  const toggleLeft = commands?.items.find((i) => i.id === 'cmd-toggle-left-sidebar');
  return (
    <>
      <div data-testid="palette-shortcuts-hint">{shortcuts?.shortcut}</div>
      <div data-testid="palette-toggle-left-hint">{toggleLeft?.shortcut}</div>
    </>
  );
};

describe('command palette shortcut hints', () => {
  it('renders the live show-shortcuts chord and repaints on rebind', async () => {
    await initStore();
    render(<PaletteProbe />);

    expect(screen.getByTestId('palette-shortcuts-hint').textContent).toBe('Shift+?');

    act(() => storeSet('keyboard.showShortcutHelp', 'mod+k'));
    expect(screen.getByTestId('palette-shortcuts-hint').textContent).toBe('Ctrl+K');
  });

  it('repaints on a preset switch', async () => {
    await initStore();
    render(<PaletteProbe />);
    expect(screen.getByTestId('palette-toggle-left-hint').textContent).toBe('Ctrl+[');

    act(() => applyPresetSwitch(keyboardDefs(), 'vscode'));
    expect(screen.getByTestId('palette-toggle-left-hint').textContent).toBe('Ctrl+B');
  });
});

// ── Docs cheatsheet (regions diagram + section) ───────────────────

describe('docs regions diagram', () => {
  it('repaints chord chips when a focus shortcut is rebound', async () => {
    await initStore();
    render(<KeyboardRegionsDiagram />);
    expect(screen.queryByText('Alt+9')).toBeNull();

    act(() => storeSet('keyboard.focusLeftSidebar', 'alt+9'));
    expect(screen.getByText('Alt+9')).toBeTruthy();
  });
});

describe('docs cheatsheet section', () => {
  it('intro shows the live show-shortcuts chord, falling back when unbound', async () => {
    await initStore();
    render(<KeyboardShortcutsSection />);
    expect(screen.getAllByText('Shift+?').length).toBeGreaterThan(0);

    act(() => storeSet('keyboard.showShortcutHelp', 'mod+k'));
    expect(screen.getAllByText('Ctrl+K').length).toBeGreaterThan(0);

    act(() => storeSet('keyboard.showShortcutHelp', ''));
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('panel rows repaint on a preset switch', async () => {
    await initStore();
    render(<KeyboardShortcutsSection />);
    expect(screen.queryByText('Ctrl+B')).toBeNull();

    act(() => applyPresetSwitch(keyboardDefs(), 'vscode'));
    expect(screen.getAllByText('Ctrl+B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ctrl+J').length).toBeGreaterThan(0);
  });
});

// ── Popup shortcuts overlay ───────────────────────────────────────

function headerKeys(container: HTMLElement): string[] {
  const close = container.querySelector('.keyboard-shortcuts-close');
  return Array.from(close?.querySelectorAll('.kbd-key') ?? []).map((el) => el.textContent ?? '');
}

describe('popup shortcuts overlay header hint', () => {
  it('shows the live toggle chord and repaints on rebind', async () => {
    await initStore();
    const { container } = render(<KeyboardShortcutsOverlay visible onClose={noop} />);
    expect(headerKeys(container)).toEqual(['Esc', 'Shift', '?']);

    act(() => storeSet('keyboard.popup.toggleShortcutsHelp', 'mod+h'));
    expect(headerKeys(container)).toEqual(['Esc', 'Ctrl', 'h']);
  });

  it('drops the "or …" fragment when the toggle is unbound', async () => {
    await initStore();
    const { container } = render(<KeyboardShortcutsOverlay visible onClose={noop} />);

    act(() => storeSet('keyboard.popup.toggleShortcutsHelp', ''));
    expect(headerKeys(container)).toEqual(['Esc']);
  });
});
