/**
 * The default chrome palette — the three colours a surface wears before
 * or outside the React tree: the frame under the document (what the
 * window paints before the renderer's first frame and the boot shell
 * paints while the bundle loads), the top bar's ground (the default
 * variants' `colorBgLayout`, which the Windows / Linux title-bar overlay
 * sits in) and the text on them. One source for the desktop main
 * process, the boot shell, the theme variants and the extension's
 * pre-React notices, so a flash between any two of them cannot come
 * from drift.
 */

export type ChromeMode = 'light' | 'dark';

export interface ChromePalette {
  /** The document's ground before the renderer paints. */
  readonly frame: string;
  /** The top bar's ground — the default variant's `colorBgLayout`. */
  readonly topBar: string;
  /** Text on either ground. */
  readonly text: string;
}

export const DEFAULT_CHROME: Readonly<Record<ChromeMode, ChromePalette>> = {
  light: { frame: '#ffffff', topBar: '#e8e8e8', text: '#1d1d1f' },
  dark: { frame: '#1f1f1f', topBar: '#262626', text: '#e6e6e6' },
};
