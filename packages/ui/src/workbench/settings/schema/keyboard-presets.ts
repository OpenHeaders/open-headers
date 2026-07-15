/**
 * Keyboard presets — named base keymaps beneath per-key overrides.
 *
 * A preset is a partial map of binding key → chord applied as the
 * *effective default* of every keyboard binding: `presetAware` wraps a
 * def's own default so `isModified`, reset, and the modified dot all
 * compare against the active preset's value. Keys a preset doesn't
 * mention fall through to the def's registered default, so a preset
 * only lists chords where it genuinely differs.
 *
 * User overrides stay per-key setting values (the storage model is
 * unchanged): switching presets is an action that rewrites the
 * non-overridden keys to the new base (see
 * `components/keymap/keymap-preset-actions.ts`), while overridden keys
 * keep their values — the override delta survives the switch.
 *
 * This module also owns the chord-default helpers (`hostChord`,
 * `platformChord`) shared with the binding registrations in
 * `keyboard.ts`, keeping every source of a keyboard default in one
 * place.
 */

import { getCurrentHost } from '../../../shared/host-vocabulary';
import { isMac } from '../../../shared/platform';
import { getDef } from '../registry';
import { get } from '../store';
import type { SettingKey } from '../types';

// Per-host chord default. The extension workbench lives in a browser
// tab where the classic chords (Cmd/Ctrl+W, +T, +N, +O) are
// browser-reserved and never reach the page, so its defaults fall back
// to the Alt cluster. The desktop host owns its whole keyboard, so it
// ships the native-app conventions. Resolved lazily — after the entry
// point has installed the host — never at registration.
export function hostChord(desktopChord: string, browserChord: string): () => string {
  return () => (getCurrentHost() === 'desktop' ? desktopChord : browserChord);
}

// Per-platform chord default. Editor-scoped bindings mirror Monaco's
// own defaults, and some of those split by platform rather than by
// host (Replace is ⌥⌘F on macOS, Ctrl+H elsewhere).
export function platformChord(macChord: string, otherChord: string): () => string {
  return () => (isMac ? macChord : otherChord);
}

export const KEYBOARD_PRESET_IDS = ['openheaders', 'vscode'] as const;
export type KeyboardPresetId = (typeof KEYBOARD_PRESET_IDS)[number];

type PresetChord = string | (() => string);

// Only chords that differ from the registered defaults appear here;
// everything else falls through. Entries must stay safe per
// `keymap-reserved.ts` on both hosts — use `hostChord` for any chord
// the browser reserves.
const PRESET_MAPS: Record<KeyboardPresetId, Partial<Record<SettingKey, PresetChord>>> = {
  openheaders: {},
  vscode: {
    'keyboard.commandPalette': 'mod+shift+p',
    'keyboard.toggleLeftSidebar': 'mod+b',
    'keyboard.toggleRightSidebar': 'mod+alt+b',
    'keyboard.toggleBottomPanel': 'mod+j',
  },
};

/**
 * The active preset id. Defensive against a registry where
 * `keyboard.preset` isn't registered (partial schema imports in tests):
 * that reads as the shipped default map.
 */
export function activeKeyboardPreset(): KeyboardPresetId {
  return getDef('keyboard.preset') ? get('keyboard.preset') : 'openheaders';
}

/** The chord `presetId` defines for `key`, or undefined to fall through. */
export function presetChord(presetId: KeyboardPresetId, key: SettingKey): string | undefined {
  const entry = PRESET_MAPS[presetId][key];
  return typeof entry === 'function' ? entry() : entry;
}

/**
 * Wrap a binding's own default so the effective default consults the
 * active preset first. `keyboard.preset` must register before any def
 * using this wrapper — registration order drives the store's load
 * loops, so the preset value is applied before the bindings it bases.
 */
export function presetAware(key: SettingKey, base: PresetChord): () => string {
  return () => presetChord(activeKeyboardPreset(), key) ?? (typeof base === 'function' ? base() : base);
}
