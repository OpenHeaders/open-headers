/**
 * push-window-layout — the pure sizing model of the Push window's two
 * sashes: commits | files, and inside the files pane, changed files |
 * commit info. The Git window's track posture: grid tracks on custom
 * properties, each pane a SHARE of the space it splits so the
 * window's own resize keeps the proportion, floors everywhere, a
 * ceiling on the files column, and a drag never pushes a neighbour
 * under its floor.
 */

export const PUSH_LAYOUT_VARS = {
  files: '--oh-push-files',
  info: '--oh-push-info',
} as const;

export interface PushWindowLayoutPrefs {
  /** Files column as a share of the body width (0–1). */
  filesShare: number;
  /** Commit-info row as a share of the files pane height below its toolbar (0–1). */
  infoShare: number;
}

export const PUSH_LAYOUT_DEFAULTS: PushWindowLayoutPrefs = {
  filesShare: 0.45,
  infoShare: 0.4,
};

/** Floors, px. */
export const PUSH_LAYOUT_MIN = {
  commits: 280,
  files: 260,
  tree: 80,
  info: 72,
} as const;

/** The files column's ceiling as a share of the body width. */
export const PUSH_LAYOUT_MAX_FILES_SHARE = 0.65;

export interface TrackBounds {
  min: number;
  max: number;
}

/** The files column may grow until its ceiling share, and never past the commits pane's floor. */
export function filesBounds(bodyWidth: number): TrackBounds {
  const min = PUSH_LAYOUT_MIN.files;
  const byShare = Math.floor(bodyWidth * PUSH_LAYOUT_MAX_FILES_SHARE);
  const byFloor = bodyWidth - PUSH_LAYOUT_MIN.commits;
  return { min, max: Math.max(min, Math.min(byShare, byFloor)) };
}

/** The info row may grow until the file tree is at its floor. */
export function pushInfoBounds(paneHeight: number): TrackBounds {
  const min = PUSH_LAYOUT_MIN.info;
  return { min, max: Math.max(min, paneHeight - PUSH_LAYOUT_MIN.tree) };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Persisted partial → full prefs: non-numbers fall back, shares stay within (0, 1). */
export function normalizePushWindowLayoutPrefs(raw: Partial<PushWindowLayoutPrefs>): PushWindowLayoutPrefs {
  const clampShare = (value: unknown, fallback: number): number => {
    const share = finiteOr(value, fallback);
    return share > 0 && share < 1 ? share : fallback;
  };
  return {
    filesShare: clampShare(raw.filesShare, PUSH_LAYOUT_DEFAULTS.filesShare),
    infoShare: clampShare(raw.infoShare, PUSH_LAYOUT_DEFAULTS.infoShare),
  };
}

/** The body's column template: the commits pane absorbs the delta above its floor, the files column is its share. */
export function pushColumnsTemplate(): string {
  return `minmax(${PUSH_LAYOUT_MIN.commits}px, 1fr) minmax(${PUSH_LAYOUT_MIN.files}px, calc(100% * var(${PUSH_LAYOUT_VARS.files})))`;
}

/** The files pane's row template below its toolbar: the tree above its floor, the info row as its share (or absent). */
export function pushFilesRowsTemplate(showInfo: boolean): string {
  if (!showInfo) return 'minmax(0, 1fr)';
  return `minmax(${PUSH_LAYOUT_MIN.tree}px, 1fr) minmax(${PUSH_LAYOUT_MIN.info}px, calc(100% * var(${PUSH_LAYOUT_VARS.info})))`;
}
