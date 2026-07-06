/**
 * Platform detection shared across all UI surfaces (workbench, popup,
 * panel). Single source for "is this an Apple platform" so keyboard
 * hints and shortcut chords render consistently everywhere.
 */

export const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
