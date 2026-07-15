/**
 * Keymap conflict engine — pure index/scope semantics plus the
 * reserved-chord tables.
 *
 * Covers: the workbench/popup scope split (they never coexist on
 * screen, so identical chords across them are NOT conflicts), the
 * `global` subcategory counting in both scopes, empty chords never
 * conflicting, record-time owner lookup, and per-host reserved-chord
 * classification.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/keyboard-popup';
import {
  buildKeymapConflicts,
  findChordOwners,
  scopesOf,
} from '@openheaders/ui/workbench/settings/components/keymap/keymap-conflicts';
import { reservedKindFor } from '@openheaders/ui/workbench/settings/components/keymap/keymap-reserved';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { SettingDef, SettingKey } from '@openheaders/ui/workbench/settings/types';
import { describe, expect, it } from 'vitest';

const KEYBOARD_DEFS = allDefs().filter((d) => d.category === 'keyboard');

function def(key: SettingKey): SettingDef {
  const found = KEYBOARD_DEFS.find((d) => d.key === key);
  if (!found) throw new Error(`no keyboard def registered for ${key}`);
  return found;
}

function reader(values: Record<string, string>): (key: SettingKey) => unknown {
  return (key) => values[key] ?? '';
}

describe('scopesOf', () => {
  it('splits workbench and popup keys into separate scopes', () => {
    expect(scopesOf(def('keyboard.save'))).toEqual(['workbench']);
    expect(scopesOf(def('keyboard.popup.editRow'))).toEqual(['popup']);
  });

  it('counts global-subcategory bindings in both scopes', () => {
    expect(scopesOf(def('keyboard.toggleDebugMode'))).toEqual(['workbench', 'popup']);
  });
});

describe('buildKeymapConflicts', () => {
  it('flags every row of an in-scope duplicate, both ways', () => {
    const conflicts = buildKeymapConflicts(
      KEYBOARD_DEFS,
      reader({ 'keyboard.save': 'mod+k', 'keyboard.commandPalette': 'mod+k' }),
    );
    expect(conflicts.size).toBe(2);
    expect(conflicts.get('keyboard.save')?.map((d) => d.key)).toEqual(['keyboard.commandPalette']);
    expect(conflicts.get('keyboard.commandPalette')?.map((d) => d.key)).toEqual(['keyboard.save']);
  });

  it('does not cross the workbench/popup scope boundary', () => {
    const conflicts = buildKeymapConflicts(
      KEYBOARD_DEFS,
      reader({ 'keyboard.save': 'mod+e', 'keyboard.popup.editRow': 'mod+e' }),
    );
    expect(conflicts.size).toBe(0);
  });

  it('collides a global binding with either scope', () => {
    const conflicts = buildKeymapConflicts(
      KEYBOARD_DEFS,
      reader({ 'keyboard.toggleDebugMode': 'shift+d', 'keyboard.popup.deleteRow': 'shift+d' }),
    );
    expect(conflicts.get('keyboard.toggleDebugMode')?.map((d) => d.key)).toEqual(['keyboard.popup.deleteRow']);
    expect(conflicts.get('keyboard.popup.deleteRow')?.map((d) => d.key)).toEqual(['keyboard.toggleDebugMode']);
  });

  it('never conflicts unbound (empty-chord) actions', () => {
    const conflicts = buildKeymapConflicts(KEYBOARD_DEFS, reader({ 'keyboard.save': '', 'keyboard.newRule': '' }));
    expect(conflicts.size).toBe(0);
  });

  it('lists all involved actions of a three-way duplicate', () => {
    const conflicts = buildKeymapConflicts(
      KEYBOARD_DEFS,
      reader({ 'keyboard.save': 'alt+z', 'keyboard.newRule': 'alt+z', 'keyboard.import': 'alt+z' }),
    );
    expect(conflicts.size).toBe(3);
    expect(conflicts.get('keyboard.save')?.map((d) => d.key)).toEqual(['keyboard.newRule', 'keyboard.import']);
  });
});

describe('findChordOwners', () => {
  it('finds the in-scope owner of a candidate chord', () => {
    const owners = findChordOwners(
      KEYBOARD_DEFS,
      def('keyboard.save'),
      'mod+k',
      reader({ 'keyboard.commandPalette': 'mod+k' }),
    );
    expect(owners.map((d) => d.key)).toEqual(['keyboard.commandPalette']);
  });

  it('ignores owners in the other scope', () => {
    const owners = findChordOwners(KEYBOARD_DEFS, def('keyboard.save'), 'e', reader({ 'keyboard.popup.editRow': 'e' }));
    expect(owners).toEqual([]);
  });

  it('sees popup and global owners from a popup action', () => {
    const owners = findChordOwners(
      KEYBOARD_DEFS,
      def('keyboard.popup.moveUp'),
      'shift+d',
      reader({ 'keyboard.toggleDebugMode': 'shift+d' }),
    );
    expect(owners.map((d) => d.key)).toEqual(['keyboard.toggleDebugMode']);
  });

  it('returns nothing for an empty chord', () => {
    expect(findChordOwners(KEYBOARD_DEFS, def('keyboard.save'), '', reader({ 'keyboard.newRule': '' }))).toEqual([]);
  });
});

describe('reservedKindFor', () => {
  it('classifies browser-reserved chords on browser-tab hosts only', () => {
    expect(reservedKindFor('mod+t', 'extension', false)).toBe('browser');
    expect(reservedKindFor('mod+shift+w', 'web', false)).toBe('browser');
    expect(reservedKindFor('mod+t', 'desktop', false)).toBeNull();
  });

  it('classifies macOS system chords on any host when on a Mac', () => {
    expect(reservedKindFor('mod+q', 'desktop', true)).toBe('system');
    expect(reservedKindFor('mod+space', 'extension', true)).toBe('system');
    expect(reservedKindFor('mod+q', 'desktop', false)).toBeNull();
  });

  it('leaves ordinary and empty chords unreserved', () => {
    expect(reservedKindFor('mod+shift+k', 'extension', true)).toBeNull();
    expect(reservedKindFor('', 'extension', true)).toBeNull();
  });
});
