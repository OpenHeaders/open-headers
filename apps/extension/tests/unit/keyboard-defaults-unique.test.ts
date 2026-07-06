/**
 * Keyboard default-chord uniqueness guard.
 *
 * Two keybinding settings sharing a default chord on the same surface
 * means the later-registered handler silently wins — the way
 * `mod+shift+a` once triggered the Activity Feed while the tab-search
 * tooltip advertised it. This test loads the REAL keyboard schema
 * modules and asserts every surface's default chords are collision-free,
 * so a new shortcut landing on a taken default fails CI instead of
 * shipping.
 *
 * Surface model: `workbench-*` and `popup-*` subcategories are separate
 * dispatch scopes; `global` participates in both.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import '@openheaders/ui/workbench/settings/schema/keyboard-popup';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import { describe, expect, it } from 'vitest';

interface ChordDef {
  key: string;
  chord: string;
  subcategory: string;
}

function keybindingDefs(): ChordDef[] {
  return allDefs()
    .filter((d) => d.type === 'keybinding' && d.category === 'keyboard')
    .map((d) => ({
      key: d.key,
      chord: String(d.default ?? '').toLowerCase(),
      subcategory: d.subcategory ?? '',
    }))
    .filter((d) => d.chord.length > 0);
}

function collisions(defs: ChordDef[]): string[] {
  const byChord = new Map<string, string[]>();
  for (const d of defs) {
    const list = byChord.get(d.chord);
    if (list) list.push(d.key);
    else byChord.set(d.chord, [d.key]);
  }
  return Array.from(byChord.entries())
    .filter(([, keys]) => keys.length > 1)
    .map(([chord, keys]) => `${chord} → ${keys.join(', ')}`);
}

describe('keyboard default chords', () => {
  const defs = keybindingDefs();

  it('registers at least one binding per surface (guards the filter)', () => {
    expect(defs.some((d) => d.subcategory.startsWith('workbench'))).toBe(true);
    expect(defs.some((d) => d.subcategory.startsWith('popup'))).toBe(true);
  });

  it('has no default-chord collisions on the workbench surface', () => {
    const surface = defs.filter((d) => d.subcategory.startsWith('workbench') || d.subcategory === 'global');
    expect(collisions(surface)).toEqual([]);
  });

  it('has no default-chord collisions on the popup / side panel surface', () => {
    const surface = defs.filter((d) => d.subcategory.startsWith('popup') || d.subcategory === 'global');
    expect(collisions(surface)).toEqual([]);
  });
});
