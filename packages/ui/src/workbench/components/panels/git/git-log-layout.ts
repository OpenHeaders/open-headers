/**
 * git-log-layout — the pure sizing model of the Git tool window's
 * three sashes (the log-window splitters): branches rail | commit list,
 * commit list | details, and inside details, changed files | commit
 * info. Same posture as the shell's track model: the panes are CSS
 * grid tracks driven by custom properties, a window resize is resolved
 * by the layout engine alone, and a drag writes one property per
 * pointer move. The rail keeps a pixel width (a list, like the
 * sidebar); the details column and the info row keep a SHARE of the
 * space they split, so the window's own resize keeps their proportion.
 *
 * Bounds are the reference in spirit: every pane has a floor, the rail and
 * the details pane also have a ceiling as a share of the space, and a
 * drag can never push a neighbour under its floor.
 */

export const GIT_LOG_LAYOUT_VARS = {
  rail: '--oh-git-log-rail',
  details: '--oh-git-log-details',
  info: '--oh-git-log-info',
} as const;

/** Width of the hidden-branches strip that replaces the rail. */
export const GIT_RAIL_STRIP_WIDTH = 26;

export interface GitLogLayoutPrefs {
  /** Branches rail width, px. */
  railWidth: number;
  /** Details column as a share of the width left of the rail (0–1). */
  detailsShare: number;
  /** Commit-info row as a share of the details body height (0–1). */
  infoShare: number;
}

export const GIT_LOG_LAYOUT_DEFAULTS: GitLogLayoutPrefs = {
  railWidth: 248,
  detailsShare: 0.45,
  infoShare: 0.45,
};

/** Floors, px. */
export const GIT_LOG_LAYOUT_MIN = {
  rail: 160,
  log: 260,
  details: 220,
  files: 80,
  info: 72,
} as const;

/** Ceilings as a share of the space the pane is carved from. */
export const GIT_LOG_LAYOUT_MAX_SHARE = {
  rail: 0.5,
  details: 0.65,
} as const;

export interface TrackBounds {
  min: number;
  max: number;
}

/** The rail may grow until half the view, and never past the log's and details' floors. */
export function railBounds(viewWidth: number): TrackBounds {
  const min = GIT_LOG_LAYOUT_MIN.rail;
  const byShare = Math.floor(viewWidth * GIT_LOG_LAYOUT_MAX_SHARE.rail);
  const byFloors = viewWidth - GIT_LOG_LAYOUT_MIN.log - GIT_LOG_LAYOUT_MIN.details;
  return { min, max: Math.max(min, Math.min(byShare, byFloors)) };
}

/** `availableWidth` is the view minus the rail (or the strip): what log + details split. */
export function detailsBounds(availableWidth: number): TrackBounds {
  const min = GIT_LOG_LAYOUT_MIN.details;
  const byShare = Math.floor(availableWidth * GIT_LOG_LAYOUT_MAX_SHARE.details);
  const byFloor = availableWidth - GIT_LOG_LAYOUT_MIN.log;
  return { min, max: Math.max(min, Math.min(byShare, byFloor)) };
}

/** The info row may grow until the file tree is at its floor. */
export function infoBounds(bodyHeight: number): TrackBounds {
  const min = GIT_LOG_LAYOUT_MIN.info;
  return { min, max: Math.max(min, bodyHeight - GIT_LOG_LAYOUT_MIN.files) };
}

/** A pixel size as the share of its container, 4 decimals, within (0, 1). */
export function shareOf(px: number, containerPx: number): number {
  if (containerPx <= 0) return 0;
  const share = Math.round((px / containerPx) * 10_000) / 10_000;
  return Math.max(0, Math.min(1, share));
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Persisted partial → full prefs: non-numbers fall back, the rail honours its floor, shares stay within (0, 1). */
export function normalizeGitLogLayoutPrefs(raw: Partial<GitLogLayoutPrefs>): GitLogLayoutPrefs {
  const clampShare = (value: unknown, fallback: number): number => {
    const share = finiteOr(value, fallback);
    return share > 0 && share < 1 ? share : fallback;
  };
  return {
    railWidth: Math.max(
      GIT_LOG_LAYOUT_MIN.rail,
      Math.round(finiteOr(raw.railWidth, GIT_LOG_LAYOUT_DEFAULTS.railWidth)),
    ),
    detailsShare: clampShare(raw.detailsShare, GIT_LOG_LAYOUT_DEFAULTS.detailsShare),
    infoShare: clampShare(raw.infoShare, GIT_LOG_LAYOUT_DEFAULTS.infoShare),
  };
}

export const railTrackValue = (px: number): string => `${Math.round(px)}px`;
export const shareTrackValue = (share: number): string => share.toFixed(4);

/**
 * The view's column template. The rail is a pixel track with its
 * floor; the log is `1fr` above its floor and absorbs every delta
 * first; the details column is its share of what is left of the rail.
 * Once every floor is hit the grid overflows rather than crushing a
 * pane (the shell's rule).
 */
export function gitLogColumnsTemplate(railCollapsed: boolean): string {
  const railWidth = railCollapsed ? `${GIT_RAIL_STRIP_WIDTH}px` : `var(${GIT_LOG_LAYOUT_VARS.rail})`;
  const rail = railCollapsed ? railWidth : `minmax(${GIT_LOG_LAYOUT_MIN.rail}px, ${railWidth})`;
  const log = `minmax(${GIT_LOG_LAYOUT_MIN.log}px, 1fr)`;
  const details = `minmax(${GIT_LOG_LAYOUT_MIN.details}px, calc((100% - ${railWidth}) * var(${GIT_LOG_LAYOUT_VARS.details})))`;
  return `${rail} ${log} ${details}`;
}

/** The details body's row template: the file tree above its floor, the info row as its share (or absent). */
export function gitLogDetailRowsTemplate(showInfo: boolean): string {
  if (!showInfo) return 'minmax(0, 1fr)';
  return `minmax(${GIT_LOG_LAYOUT_MIN.files}px, 1fr) minmax(${GIT_LOG_LAYOUT_MIN.info}px, calc(100% * var(${GIT_LOG_LAYOUT_VARS.info})))`;
}
