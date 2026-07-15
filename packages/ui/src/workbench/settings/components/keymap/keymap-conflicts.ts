/**
 * keymap-conflicts — pure duplicate-assignment engine for the Keymap
 * pane.
 *
 * Workbench and popup are separate conflict scopes: they never coexist
 * on screen, so `keyboard.save` and `keyboard.popup.editRow` may share
 * a chord without colliding. Cross-surface bindings (subcategory
 * `global`, e.g. the Debug mode toggle) dispatch on every surface and
 * therefore count in BOTH scopes. An empty chord is unbound and never
 * conflicts.
 *
 * Kept free of React and the settings store — callers supply the live
 * values — so the index is unit-testable as data in, data out.
 */

import type { SettingDef, SettingKey } from '../../types';

export type KeymapScope = 'workbench' | 'popup';

const SCOPES: readonly KeymapScope[] = ['workbench', 'popup'];

/** The conflict scope(s) a binding dispatches in. */
export function scopesOf(def: SettingDef): readonly KeymapScope[] {
  if (def.subcategory === 'global') return SCOPES;
  return def.key.startsWith('keyboard.popup.') ? ['popup'] : ['workbench'];
}

export type ChordValueReader = (key: SettingKey) => unknown;

function chordOf(def: SettingDef, getValue: ChordValueReader): string {
  const value = getValue(def.key);
  return typeof value === 'string' ? value : '';
}

/**
 * Index every duplicate assignment: setting key → the OTHER defs bound
 * to the same chord in a shared scope. Keys with no conflict are absent,
 * so `result.size` is the number of involved rows.
 */
export function buildKeymapConflicts(
  defs: readonly SettingDef[],
  getValue: ChordValueReader,
): ReadonlyMap<string, readonly SettingDef[]> {
  const byScope: Record<KeymapScope, Map<string, SettingDef[]>> = { workbench: new Map(), popup: new Map() };
  for (const def of defs) {
    const chord = chordOf(def, getValue);
    if (chord.length === 0) continue;
    for (const scope of scopesOf(def)) {
      const group = byScope[scope].get(chord);
      if (group) group.push(def);
      else byScope[scope].set(chord, [def]);
    }
  }

  const conflicts = new Map<string, SettingDef[]>();
  for (const scope of SCOPES) {
    for (const group of byScope[scope].values()) {
      if (group.length < 2) continue;
      for (const def of group) {
        let others = conflicts.get(def.key);
        if (!others) {
          others = [];
          conflicts.set(def.key, others);
        }
        for (const other of group) {
          if (other.key !== def.key && !others.some((d) => d.key === other.key)) others.push(other);
        }
      }
    }
  }
  return conflicts;
}

/**
 * The defs (excluding `self`) currently bound to `chord` in a scope
 * shared with `self` — the record-time interception check. Empty for an
 * empty chord.
 */
export function findChordOwners(
  defs: readonly SettingDef[],
  self: SettingDef,
  chord: string,
  getValue: ChordValueReader,
): readonly SettingDef[] {
  if (chord.length === 0) return [];
  const selfScopes = scopesOf(self);
  const owners: SettingDef[] = [];
  for (const def of defs) {
    if (def.key === self.key) continue;
    if (!scopesOf(def).some((scope) => selfScopes.includes(scope))) continue;
    if (chordOf(def, getValue) === chord) owners.push(def);
  }
  return owners;
}
