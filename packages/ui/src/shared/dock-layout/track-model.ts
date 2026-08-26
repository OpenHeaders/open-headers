/**
 * track-model — the shell's CSS-track sizing model.
 *
 * The shell is ONE CSS grid whose tracks are custom properties. A window
 * resize is resolved entirely by the layout engine in a single pass —
 * no JavaScript runs on that path. JavaScript participates only during
 * a sash drag, where it writes one custom property per pointer move
 * (`use-sash.ts`), and at drag end, where it reports the resulting
 * pixel sizes to the host for persistence.
 *
 * Pane tracks are `minmax(<min>, <size>)` and the editor is `1fr`, which
 * reproduces the split-view priority model: the editor absorbs every
 * delta first; a side pane holds its size until the editor reaches its
 * minimum, then compresses toward its own minimum; once every minimum is
 * hit the grid overflows rather than crushing a pane.
 *
 * Two sizing models share the grid:
 *   - pixel-stable (desktop window): `<size>` is a px value, so panes keep
 *     their width across incremental window resizes.
 *   - proportional (a container that flips geometry, e.g. the DevTools
 *     panel re-docking): `<size>` is a percentage of the grid, so a 50/50
 *     split is 50/50 in every dock.
 */

/** Custom properties the shell grid reads. `*-size` ones are written by
    React (host sizes) and by a sash drag; the closed-region modifiers
    in CSS override the derived `--oh-<pane>` track to 0 without
    touching the size, so a region reopens at the width it had. */
export const SHELL_TRACK_VARS = {
  barLeft: '--oh-bar-l',
  barRight: '--oh-bar-r',
  sidebar: '--oh-sidebar-size',
  sidebarMin: '--oh-sidebar-min-size',
  inspector: '--oh-inspector-size',
  inspectorMin: '--oh-inspector-min-size',
  editorMin: '--oh-editor-min',
  bottom: '--oh-bottom-size',
  bottomMin: '--oh-bottom-min-size',
} as const;

/** Flex-grow weights of the two panes in a dock pair (side region top /
    bottom, bottom region first / second). Weights, not sizes: the pair
    is proportional by construction, so it keeps its split across any
    container resize. */
export const PANE_WEIGHT_VARS = {
  first: '--oh-pane-a',
  second: '--oh-pane-b',
  min: '--oh-pane-min',
} as const;

export function clampTrack(px: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(px)));
}

/**
 * The CSS value a pane's size var carries for a given pixel width:
 * the px itself in the pixel-stable model, its share of the container
 * in the proportional model.
 */
export function trackValue(px: number, proportional: boolean, containerPx: number): string {
  if (!proportional || containerPx <= 0) return `${Math.round(px)}px`;
  return `${((px / containerPx) * 100).toFixed(3)}%`;
}
