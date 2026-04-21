import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { matchesPopupShortcut, POPUP_SHORTCUTS, popupShortcutChord } from '@/popup/shortcuts/popup-shortcuts';
import type { DictStorage, SettingScope } from '@/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set as storeSet,
} from '@/workbench/settings/store';

// The registry is side-effect registered via the schema barrel import.
// The tests below do not reset the registry — they only reset the store
// so persisted chords start from their registered defaults.
import '@/workbench/settings/schema';

class MemoryDictStorage implements DictStorage {
  state = new Map<SettingScope, Record<string, unknown>>();
  listeners = new Map<SettingScope, Set<(values: Record<string, unknown>) => void>>();

  async load(scope: SettingScope): Promise<Record<string, unknown>> {
    return { ...(this.state.get(scope) ?? {}) };
  }

  async save(scope: SettingScope, values: Record<string, unknown>): Promise<void> {
    this.state.set(scope, { ...values });
    const set = this.listeners.get(scope);
    if (set) for (const fn of set) fn({ ...values });
  }

  subscribe(scope: SettingScope, fn: (values: Record<string, unknown>) => void): () => void {
    let set = this.listeners.get(scope);
    if (!set) {
      set = new Set();
      this.listeners.set(scope, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  }
}

let memory: MemoryDictStorage;

beforeEach(async () => {
  __resetStoreForTests();
  memory = new MemoryDictStorage();
  configureSettingsStorage(memory);
  await initSettingsStore();
});

afterEach(() => {
  __resetStoreForTests();
});

function pressKey(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    code: `Key${key.toUpperCase()}`,
    ...opts,
  });
}

describe('popup shortcuts registry', () => {
  it('registers every popup key with a non-empty default chord', () => {
    for (const def of POPUP_SHORTCUTS) {
      expect(popupShortcutChord(def.id)).not.toBe('');
    }
  });

  it('matches the default chord for add-rule', () => {
    expect(matchesPopupShortcut(pressKey('a'), 'add-rule')).toBe(true);
  });

  it('does not match an unrelated key for add-rule', () => {
    expect(matchesPopupShortcut(pressKey('b'), 'add-rule')).toBe(false);
  });

  it('honors hardcoded ArrowDown alias for move-down even if user rebinds letter', () => {
    storeSet('keyboard.popup.moveDown', 'n');
    const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
    expect(matchesPopupShortcut(arrowEvent, 'move-down')).toBe(true);
    expect(matchesPopupShortcut(pressKey('n'), 'move-down')).toBe(true);
    // Old 'j' binding is gone — only the rebound letter + ArrowDown match now.
    expect(matchesPopupShortcut(pressKey('j'), 'move-down')).toBe(false);
  });

  it('Enter and ArrowRight always match expand-row regardless of setting', () => {
    storeSet('keyboard.popup.expandRow', 'x');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' });
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
    expect(matchesPopupShortcut(enter, 'expand-row')).toBe(true);
    expect(matchesPopupShortcut(right, 'expand-row')).toBe(true);
    expect(matchesPopupShortcut(pressKey('x'), 'expand-row')).toBe(true);
  });

  it('empty chord unbinds the primary key (aliases still work)', () => {
    storeSet('keyboard.popup.moveUp', '');
    const arrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' });
    expect(matchesPopupShortcut(arrowUp, 'move-up')).toBe(true);
    expect(matchesPopupShortcut(pressKey('k'), 'move-up')).toBe(false);
  });

  it('registry ids are unique', () => {
    const ids = POPUP_SHORTCUTS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toggle-shortcuts-help matches the shift+? chord a real Shift+/ press produces', () => {
    const shiftSlash = new KeyboardEvent('keydown', {
      key: '?',
      code: 'Slash',
      shiftKey: true,
    });
    expect(matchesPopupShortcut(shiftSlash, 'toggle-shortcuts-help')).toBe(true);

    // A bare `?` with no shift modifier should NOT fire (defensive —
    // some layouts produce `?` without shift, in which case we'd want
    // the user to rebind rather than silently firing).
    const plain = new KeyboardEvent('keydown', { key: '?', code: 'Slash' });
    expect(matchesPopupShortcut(plain, 'toggle-shortcuts-help')).toBe(false);
  });

  it('global vs row-scoped pause are separate bindings', () => {
    const shiftP = new KeyboardEvent('keydown', { key: 'P', code: 'KeyP', shiftKey: true });
    const plainP = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP' });

    // Global pause fires only on shift+p.
    expect(matchesPopupShortcut(shiftP, 'toggle-rules-pause')).toBe(true);
    expect(matchesPopupShortcut(plainP, 'toggle-rules-pause')).toBe(false);

    // Row-scoped pause fires only on plain p.
    expect(matchesPopupShortcut(plainP, 'toggle-pause-focused')).toBe(true);
    expect(matchesPopupShortcut(shiftP, 'toggle-pause-focused')).toBe(false);
  });

  it('open-settings default chord matches mod+, across platforms', () => {
    const commaEvent = new KeyboardEvent('keydown', { key: ',', code: 'Comma', metaKey: true });
    const ctrlCommaEvent = new KeyboardEvent('keydown', { key: ',', code: 'Comma', ctrlKey: true });
    expect(matchesPopupShortcut(commaEvent, 'open-settings')).toBe(true);
    expect(matchesPopupShortcut(ctrlCommaEvent, 'open-settings')).toBe(true);
    // Plain `,` without a modifier must not fire.
    const plainComma = new KeyboardEvent('keydown', { key: ',', code: 'Comma' });
    expect(matchesPopupShortcut(plainComma, 'open-settings')).toBe(false);
  });
});
