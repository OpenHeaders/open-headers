/**
 * keymap-preset-actions — the preset switch and restore actions.
 *
 * A preset switch is materialization, not layered resolution: the
 * store persists every key's current value on flush, so "preset
 * beneath overrides" is realized by rewriting the non-overridden
 * binding keys to the new preset's value at switch time. Overridden
 * keys (the store's modified set — including explicit unbinds) keep
 * their values; they only get a same-value write so their modified
 * flag recomputes against the new base and subscribers repaint.
 *
 * The preset domain is the workbench binding set: popup bindings
 * (`keyboard.popup.*`) are outside every preset map, keep their own
 * defaults, and are never touched by a switch or restore.
 */

import type { KeyboardPresetId } from '../../schema/keyboard-presets';
import { get, isModified, reset, set } from '../../store';
import type { SettingDef } from '../../types';

/** The binding defs a preset governs — workbench keybindings only. */
export function presetDomainDefs(defs: readonly SettingDef[]): SettingDef[] {
  return defs.filter((def) => def.type === 'keybinding' && !def.key.startsWith('keyboard.popup.'));
}

/**
 * Switch the active preset. Non-overridden keys move to the new
 * preset's base chord; overridden keys keep their values (the delta
 * survives the switch, and switching back restores the old base for
 * everything the user never touched).
 */
export function applyPresetSwitch(defs: readonly SettingDef[], next: KeyboardPresetId): void {
  const domain = presetDomainDefs(defs);
  const overridden = new Set(domain.filter((def) => isModified(def.key)).map((def) => def.key));
  set('keyboard.preset', next);
  for (const def of domain) {
    if (overridden.has(def.key)) set(def.key, get(def.key));
    else reset(def.key);
  }
}

/**
 * Clear every override in the preset domain — reset each modified
 * binding to the active preset's value. Returns how many were cleared.
 */
export function restorePreset(defs: readonly SettingDef[]): number {
  let cleared = 0;
  for (const def of presetDomainDefs(defs)) {
    if (isModified(def.key)) {
      reset(def.key);
      cleared++;
    }
  }
  return cleared;
}
