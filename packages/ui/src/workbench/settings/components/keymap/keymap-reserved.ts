/**
 * keymap-reserved — per-host reserved-chord tables for the Keymap pane.
 *
 * Generalizes what the schema's `hostChord` defaults already encode:
 * in a browser tab a set of classic chords belongs to the browser
 * chrome and either never reaches the page or does something the user
 * didn't ask for; on macOS a handful of chords belong to the system.
 * Recording one is allowed — some browsers deliver some of them — but
 * the pane warns immediately rather than letting the binding silently
 * dead-letter.
 *
 * Chord strings use the store's canonical form: lowercase, modifiers
 * in `mod`, `shift`, `alt` order (see `buildChordsFromEvent`).
 */

import type { Host } from '../../../../shared/host-vocabulary';

export type ReservedKind = 'browser' | 'system';

// Browser-tab hosts only. New window/tab/close (the hostChord
// fallback set), reload, address bar, bookmark — plus the shift
// variants of the window/tab family. `mod+o` is absent on purpose:
// browsers deliver it to the page and honor preventDefault, and the
// Import binding claims it on every host.
const BROWSER_RESERVED: ReadonlySet<string> = new Set([
  'mod+n',
  'mod+t',
  'mod+w',
  'mod+r',
  'mod+l',
  'mod+d',
  'mod+shift+n',
  'mod+shift+t',
  'mod+shift+w',
  'mod+shift+r',
]);

// macOS system chords (`mod` renders as ⌘ there): quit, hide,
// minimize, app switcher, Spotlight, logout.
const MACOS_RESERVED: ReadonlySet<string> = new Set(['mod+q', 'mod+h', 'mod+m', 'mod+tab', 'mod+space', 'mod+shift+q']);

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Whether `chord` is reserved on the given host — `'browser'` when the
 * browser chrome owns it, `'system'` when the OS does, `null` when it
 * is safe. `isMac` is injectable for tests; it defaults to the running
 * platform.
 */
export function reservedKindFor(chord: string, host: Host, isMac: boolean = IS_MAC): ReservedKind | null {
  if (chord.length === 0) return null;
  if (host !== 'desktop' && BROWSER_RESERVED.has(chord)) return 'browser';
  if (isMac && MACOS_RESERVED.has(chord)) return 'system';
  return null;
}
