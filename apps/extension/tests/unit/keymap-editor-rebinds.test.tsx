/**
 * Real editor rebinds — the `keyboard.find` / `keyboard.replace` /
 * `keyboard.formatCode` settings drive actual Monaco keybinding rules,
 * not just displayed hints.
 *
 * Covers: the SHORTCUTS registry lists the editor-scoped entries
 * (kind `editor`, so the window loop never dispatches them), the sync
 * module's rule lifecycle (built-in removals + configured bind,
 * disposal on rebind / unbind / reset), conflict-engine pickup of the
 * new workbench-scope keys, and action-button hints following rebinds.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import {
  __resetEditorKeybindingSyncForTests,
  type EditorKeybindingDisposable,
  type EditorKeybindingRule,
  ensureEditorKeybindingSync,
} from '@openheaders/ui/workbench/components/monaco/editor-keybindings';
import CodeEditorActions from '@openheaders/ui/workbench/components/shared/CodeEditorActions';
import { SHORTCUTS, useShortcutLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { buildKeymapConflicts } from '@openheaders/ui/workbench/settings/components/keymap/keymap-conflicts';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  get as storeGet,
  reset as storeReset,
  set as storeSet,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KeyCode, KeyMod } from '../helpers/monaco-key-enums';

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

interface AppliedRuleSet {
  rules: EditorKeybindingRule[];
  disposed: boolean;
}

class FakeMonacoHost {
  applied: AppliedRuleSet[] = [];
  KeyMod = KeyMod;
  KeyCode = KeyCode;
  editor = {
    addKeybindingRules: (rules: EditorKeybindingRule[]): EditorKeybindingDisposable => {
      const entry: AppliedRuleSet = { rules, disposed: false };
      this.applied.push(entry);
      return {
        dispose: () => {
          entry.disposed = true;
        },
      };
    },
  };

  /** The live (undisposed) rule sets, in application order. */
  live(): AppliedRuleSet[] {
    return this.applied.filter((entry) => !entry.disposed);
  }

  liveRuleFor(command: string): EditorKeybindingRule | undefined {
    return this.live()
      .flatMap((entry) => entry.rules)
      .find((rule) => rule.command === command);
  }
}

async function setupStore(): Promise<void> {
  setCurrentHost('extension');
  configureSettingsStorage(new MemoryDictStorage());
  await initSettingsStore();
}

beforeEach(() => {
  __resetStoreForTests();
  __resetEditorKeybindingSyncForTests();
});

afterEach(() => {
  cleanup();
  __resetEditorKeybindingSyncForTests();
  setCurrentHost('extension');
  __resetStoreForTests();
});

describe('editor-scoped SHORTCUTS entries', () => {
  it('registers find and replace as editor-kind, so the window loop skips them', () => {
    for (const id of ['find', 'replace', 'format-code']) {
      const def = SHORTCUTS.find((s) => s.id === id);
      expect(def, id).toBeDefined();
      expect(def?.handler.kind, id).toBe('editor');
    }
    expect(SHORTCUTS.find((s) => s.id === 'find')?.settingKey).toBe('keyboard.find');
    expect(SHORTCUTS.find((s) => s.id === 'replace')?.settingKey).toBe('keyboard.replace');
  });

  it('ships Monaco-standard defaults (non-mac test platform: Ctrl+H replace)', async () => {
    await setupStore();
    expect(storeGet('keyboard.find')).toBe('mod+f');
    expect(storeGet('keyboard.replace')).toBe('mod+h');
    expect(storeGet('keyboard.formatCode')).toBe('shift+alt+f');
  });
});

describe('ensureEditorKeybindingSync', () => {
  it('applies built-in removals plus the configured bind on install', async () => {
    await setupStore();
    const host = new FakeMonacoHost();
    ensureEditorKeybindingSync(host);

    expect(host.applied).toHaveLength(3);

    const findRules = host.applied[0]?.rules ?? [];
    expect(findRules).toContainEqual({ keybinding: KeyMod.CtrlCmd | KeyCode.KeyF, command: '-actions.find' });
    expect(findRules).toContainEqual({
      keybinding: KeyMod.CtrlCmd | KeyCode.KeyF,
      command: 'actions.find',
      when: null,
    });

    // Every platform variant of a built-in is removed — Monaco no-ops
    // removals that match nothing on the running platform.
    const replaceRules = host.applied[1]?.rules ?? [];
    expect(replaceRules).toContainEqual({
      keybinding: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF,
      command: '-editor.action.startFindReplaceAction',
    });
    expect(replaceRules).toContainEqual({
      keybinding: KeyMod.CtrlCmd | KeyCode.KeyH,
      command: '-editor.action.startFindReplaceAction',
    });

    // Format keeps its editor-focus gate.
    const formatBind = host.liveRuleFor('editor.action.formatDocument');
    expect(formatBind).toEqual({
      keybinding: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF,
      command: 'editor.action.formatDocument',
      when: 'editorTextFocus',
    });
  });

  it('is idempotent — a second mount installs nothing new', async () => {
    await setupStore();
    const host = new FakeMonacoHost();
    ensureEditorKeybindingSync(host);
    ensureEditorKeybindingSync(host);
    expect(host.applied).toHaveLength(3);
  });

  it('disposes the stale rules and applies the new chord on rebind', async () => {
    await setupStore();
    const host = new FakeMonacoHost();
    ensureEditorKeybindingSync(host);

    act(() => storeSet('keyboard.find', 'mod+g'));

    expect(host.applied[0]?.disposed).toBe(true);
    const bind = host.liveRuleFor('actions.find');
    expect(bind?.keybinding).toBe(KeyMod.CtrlCmd | KeyCode.KeyG);
    // The built-in chord stays removed so stock Cmd/Ctrl+F stops firing.
    expect(host.liveRuleFor('-actions.find')?.keybinding).toBe(KeyMod.CtrlCmd | KeyCode.KeyF);
  });

  it('leaves only the removals when the action is unbound', async () => {
    await setupStore();
    const host = new FakeMonacoHost();
    ensureEditorKeybindingSync(host);

    act(() => storeSet('keyboard.find', ''));

    expect(host.liveRuleFor('actions.find')).toBeUndefined();
    expect(host.liveRuleFor('-actions.find')).toBeDefined();
  });

  it('re-binds the default chord on reset', async () => {
    await setupStore();
    const host = new FakeMonacoHost();
    ensureEditorKeybindingSync(host);

    act(() => storeSet('keyboard.find', 'mod+g'));
    act(() => storeReset('keyboard.find'));

    expect(host.liveRuleFor('actions.find')?.keybinding).toBe(KeyMod.CtrlCmd | KeyCode.KeyF);
  });
});

describe('conflict-engine pickup', () => {
  it('flags an editor binding that collides with a workbench binding', async () => {
    await setupStore();
    act(() => storeSet('keyboard.find', 'mod+shift+a'));

    const defs = allDefs().filter((d) => d.category === 'keyboard');
    const conflicts = buildKeymapConflicts(defs, (key) => storeGet(key));

    expect(conflicts.get('keyboard.find')?.map((d) => d.key)).toEqual(['keyboard.tabSearch']);
    expect(conflicts.get('keyboard.tabSearch')?.map((d) => d.key)).toEqual(['keyboard.find']);
  });
});

describe('action-button hints', () => {
  function HintProbe(): React.ReactElement {
    const find = useShortcutLabel('find');
    const replace = useShortcutLabel('replace');
    return (
      <div>
        <span data-testid="find-hint">{find}</span>
        <span data-testid="replace-hint">{replace}</span>
      </div>
    );
  }

  it('follows rebinds through useShortcutLabel (the CodeEditorActions seam)', async () => {
    await setupStore();
    render(<HintProbe />);

    expect(screen.getByTestId('find-hint').textContent).toBe('Ctrl+F');
    expect(screen.getByTestId('replace-hint').textContent).toBe('Ctrl+H');

    act(() => storeSet('keyboard.find', 'mod+shift+f'));
    expect(screen.getByTestId('find-hint').textContent).toBe('Ctrl+Shift+F');
  });

  it('renders the find / replace / format cluster from the registry', async () => {
    await setupStore();
    const target = createRef<{ find: () => void; replace: () => void; format: () => void }>();
    render(<CodeEditorActions target={target} language="json" />);

    expect(screen.getByRole('button', { name: 'Find' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Format' })).toBeDefined();
  });
});
