/**
 * KeyMod / KeyCode stubs for chord→Monaco keybinding tests, carrying
 * Monaco's real numeric encoding so composed keybinding numbers match
 * what a mounted instance would produce. The converter takes these
 * injected (it never imports the Monaco runtime), which is what lets
 * tests run without the editor bundle.
 */

import type {
  MonacoKeyCodeValues,
  MonacoKeyModValues,
} from '@openheaders/ui/workbench/components/monaco/chord-keybinding';

export const KeyMod: MonacoKeyModValues = {
  CtrlCmd: 2048,
  Shift: 1024,
  Alt: 512,
  WinCtrl: 256,
};

export const KeyCode: MonacoKeyCodeValues = {
  KeyA: 31,
  KeyB: 32,
  KeyC: 33,
  KeyD: 34,
  KeyE: 35,
  KeyF: 36,
  KeyG: 37,
  KeyH: 38,
  KeyI: 39,
  KeyJ: 40,
  KeyK: 41,
  KeyL: 42,
  KeyM: 43,
  KeyN: 44,
  KeyO: 45,
  KeyP: 46,
  KeyQ: 47,
  KeyR: 48,
  KeyS: 49,
  KeyT: 50,
  KeyU: 51,
  KeyV: 52,
  KeyW: 53,
  KeyX: 54,
  KeyY: 55,
  KeyZ: 56,
  Digit0: 21,
  Digit1: 22,
  Digit2: 23,
  Digit3: 24,
  Digit4: 25,
  Digit5: 26,
  Digit6: 27,
  Digit7: 28,
  Digit8: 29,
  Digit9: 30,
  Minus: 88,
  Equal: 86,
  BracketLeft: 92,
  BracketRight: 94,
  Backslash: 93,
  Semicolon: 85,
  Quote: 95,
  Comma: 87,
  Period: 89,
  Slash: 90,
  Backquote: 91,
  Space: 10,
  Enter: 3,
  Escape: 9,
  Tab: 2,
  LeftArrow: 15,
  RightArrow: 17,
  UpArrow: 16,
  DownArrow: 18,
};
