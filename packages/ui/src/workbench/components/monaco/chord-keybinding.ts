/**
 * chord-keybinding — pure conversion from a stored chord string
 * (`mod+shift+f`, the Settings → Keyboard vocabulary) to a Monaco
 * keybinding number (`KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF`).
 *
 * The KeyMod / KeyCode enum values are injected rather than imported:
 * Monaco's numeric encoding has changed between releases, so the only
 * safe source is the mounted instance's own enums (`monacoApi.KeyMod`
 * / `monacoApi.KeyCode`). Injection also keeps this module free of the
 * Monaco runtime, so it stays unit-testable as data in, data out.
 */

/** The four modifier constants — structurally satisfied by `monaco.KeyMod`. */
export interface MonacoKeyModValues {
  readonly CtrlCmd: number;
  readonly Shift: number;
  readonly Alt: number;
  readonly WinCtrl: number;
}

/** The KeyCode enum members a chord's final key can resolve to —
 *  structurally satisfied by `monaco.KeyCode`. */
export type MonacoKeyCodeName =
  | `Key${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'}`
  | `Digit${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | 'Minus'
  | 'Equal'
  | 'BracketLeft'
  | 'BracketRight'
  | 'Backslash'
  | 'Semicolon'
  | 'Quote'
  | 'Comma'
  | 'Period'
  | 'Slash'
  | 'Backquote'
  | 'Space'
  | 'Enter'
  | 'Escape'
  | 'Tab'
  | 'LeftArrow'
  | 'RightArrow'
  | 'UpArrow'
  | 'DownArrow';

export type MonacoKeyCodeValues = Readonly<Record<MonacoKeyCodeName, number>>;

// Chord key token → KeyCode member name. Tokens mirror what
// `buildChordsFromEvent` produces: single characters for letters /
// digits / punctuation, word mnemonics for named keys.
const KEY_TOKEN_TO_KEYCODE = new Map<string, MonacoKeyCodeName>([
  ['a', 'KeyA'],
  ['b', 'KeyB'],
  ['c', 'KeyC'],
  ['d', 'KeyD'],
  ['e', 'KeyE'],
  ['f', 'KeyF'],
  ['g', 'KeyG'],
  ['h', 'KeyH'],
  ['i', 'KeyI'],
  ['j', 'KeyJ'],
  ['k', 'KeyK'],
  ['l', 'KeyL'],
  ['m', 'KeyM'],
  ['n', 'KeyN'],
  ['o', 'KeyO'],
  ['p', 'KeyP'],
  ['q', 'KeyQ'],
  ['r', 'KeyR'],
  ['s', 'KeyS'],
  ['t', 'KeyT'],
  ['u', 'KeyU'],
  ['v', 'KeyV'],
  ['w', 'KeyW'],
  ['x', 'KeyX'],
  ['y', 'KeyY'],
  ['z', 'KeyZ'],
  ['0', 'Digit0'],
  ['1', 'Digit1'],
  ['2', 'Digit2'],
  ['3', 'Digit3'],
  ['4', 'Digit4'],
  ['5', 'Digit5'],
  ['6', 'Digit6'],
  ['7', 'Digit7'],
  ['8', 'Digit8'],
  ['9', 'Digit9'],
  ['-', 'Minus'],
  ['=', 'Equal'],
  ['[', 'BracketLeft'],
  [']', 'BracketRight'],
  ['\\', 'Backslash'],
  [';', 'Semicolon'],
  ["'", 'Quote'],
  [',', 'Comma'],
  ['.', 'Period'],
  ['/', 'Slash'],
  ['`', 'Backquote'],
  ['space', 'Space'],
  ['enter', 'Enter'],
  ['escape', 'Escape'],
  ['tab', 'Tab'],
  ['left', 'LeftArrow'],
  ['right', 'RightArrow'],
  ['up', 'UpArrow'],
  ['down', 'DownArrow'],
]);

const MODIFIER_TOKENS = new Set(['mod', 'shift', 'alt', 'ctrl']);

/**
 * Monaco keybinding number for a normalized chord string, or `null`
 * when the chord is empty or contains a token Monaco can't encode
 * (unknown key, modifier-only chord). `mod` maps to `KeyMod.CtrlCmd`
 * (⌘ on macOS / Ctrl elsewhere), explicit `ctrl` to `KeyMod.WinCtrl` —
 * the same platform split the stored chord vocabulary encodes.
 */
export function chordToMonacoKeybinding(
  chord: string,
  keyMod: MonacoKeyModValues,
  keyCode: MonacoKeyCodeValues,
): number | null {
  if (chord.length === 0) return null;
  const parts = chord.toLowerCase().split('+');
  const keyToken = parts[parts.length - 1];
  if (!keyToken || MODIFIER_TOKENS.has(keyToken)) return null;
  const keyCodeName = KEY_TOKEN_TO_KEYCODE.get(keyToken);
  if (!keyCodeName) return null;

  let binding = keyCode[keyCodeName];
  for (const modifier of parts.slice(0, -1)) {
    if (modifier === 'mod') binding |= keyMod.CtrlCmd;
    else if (modifier === 'shift') binding |= keyMod.Shift;
    else if (modifier === 'alt') binding |= keyMod.Alt;
    else if (modifier === 'ctrl') binding |= keyMod.WinCtrl;
    else return null;
  }
  return binding;
}
