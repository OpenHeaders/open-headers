/**
 * Dashboard geometry — TUI_DESIGN.md §4.1/§5.3. The screen is an outer
 * frame: header segments ride the top border (row 0), the bottom
 * border sits above a frameless footer legend (last row), and panes
 * are nested boxes in the interior. Left column stacks panes 1–2,
 * rules get the width. Below 80 columns — or when the interior can no
 * longer hold the stack — the layout collapses to one pane at a time
 * with a digit tab row; header and footer are the last rows standing.
 */

import type { TerminalSize } from './tty';

export type PaneId = 'workspaces' | 'environments' | 'rules';

export const PANE_ORDER: readonly PaneId[] = ['workspaces', 'environments', 'rules'];

export interface Rect {
  /** 0-based column of the box's left border. */
  readonly x: number;
  /** 0-based row of the box's top border. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type LayoutMode = 'full' | 'single' | 'chrome-only';

export interface DashboardLayout {
  readonly mode: LayoutMode;
  readonly headerRow: number;
  readonly footerRow: number;
  readonly frameBottomRow: number;
  /** Interior columns inside the outer `│ … │` gutter. */
  readonly contentX: number;
  readonly contentWidth: number;
  /** Interior line reserved for the filter/notice strip, or null. */
  readonly statusRow: number | null;
  /** Digit tab row in single-pane mode, or null. */
  readonly tabsRow: number | null;
  readonly panes: Partial<Record<PaneId, Rect>>;
}

export interface LayoutRequest {
  readonly statusLine: boolean;
  readonly focused: PaneId;
  readonly workspaceCount: number;
}

/** List rows a pane box can show (its height minus the two border rows). */
export function paneBodyHeight(rect: Rect): number {
  return Math.max(0, rect.height - 2);
}

const FULL_MIN_COLUMNS = 80;
const FULL_MIN_PANE_AREA = 12;
const MIN_BOX_HEIGHT = 3;

export function computeDashboardLayout(size: TerminalSize, request: LayoutRequest): DashboardLayout {
  const { columns, rows } = size;
  const headerRow = 0;
  const footerRow = rows - 1;
  const frameBottomRow = rows - 2;
  const contentX = 1;
  const contentWidth = Math.max(0, columns - 2);
  // Interior rows run from 1 to frameBottomRow-1.
  const interiorHeight = Math.max(0, frameBottomRow - 1);
  const statusRow = request.statusLine && interiorHeight > 0 ? frameBottomRow - 1 : null;
  const paneAreaTop = 1;
  const paneAreaHeight = interiorHeight - (statusRow === null ? 0 : 1);

  if (paneAreaHeight < MIN_BOX_HEIGHT || contentWidth < 20) {
    return {
      mode: 'chrome-only',
      headerRow,
      footerRow,
      frameBottomRow,
      contentX,
      contentWidth,
      statusRow,
      tabsRow: null,
      panes: {},
    };
  }

  if (columns < FULL_MIN_COLUMNS || paneAreaHeight < FULL_MIN_PANE_AREA) {
    // One pane at a time; the digit row acts as tabs (design §4.1).
    const tabsRow = paneAreaTop;
    const paneTop = tabsRow + 1;
    const paneHeight = paneAreaHeight - 1;
    const panes: Partial<Record<PaneId, Rect>> =
      paneHeight >= MIN_BOX_HEIGHT
        ? { [request.focused]: { x: contentX, y: paneTop, width: contentWidth, height: paneHeight } }
        : {};
    return {
      mode: 'single',
      headerRow,
      footerRow,
      frameBottomRow,
      contentX,
      contentWidth,
      statusRow,
      tabsRow,
      panes,
    };
  }

  const leftWidth = Math.min(34, Math.max(26, Math.floor(contentWidth * 0.4)));
  const rulesWidth = contentWidth - leftWidth;
  // Workspaces hug their row count; environments take the remainder.
  const workspacesHeight = Math.max(
    MIN_BOX_HEIGHT,
    Math.min(request.workspaceCount + 2, Math.floor(paneAreaHeight / 2)),
  );
  const environmentsHeight = paneAreaHeight - workspacesHeight;
  return {
    mode: 'full',
    headerRow,
    footerRow,
    frameBottomRow,
    contentX,
    contentWidth,
    statusRow,
    tabsRow: null,
    panes: {
      workspaces: { x: contentX, y: paneAreaTop, width: leftWidth, height: workspacesHeight },
      environments: { x: contentX, y: paneAreaTop + workspacesHeight, width: leftWidth, height: environmentsHeight },
      rules: { x: contentX + leftWidth, y: paneAreaTop, width: rulesWidth, height: paneAreaHeight },
    },
  };
}

/** Preferred overlay width — the §4.3/§4.4 wireframe boxes, clamped to the interior. */
export const OVERLAY_PREFERRED_WIDTH = 58;

/**
 * Body lines of the help overlay (§4.3): four groups merged into two
 * column stacks (Navigate+Find left, Act+Session right) plus the
 * closing note. view.ts builds exactly this many lines.
 */
export const HELP_BODY_LINES = 12;

/** Centered box over the dimmed base screen; null when the interior can't hold one. */
function centerOverlay(size: TerminalSize, bodyLines: number): Rect | null {
  const contentWidth = Math.max(0, size.columns - 2);
  const interiorHeight = Math.max(0, size.rows - 3);
  const width = Math.min(OVERLAY_PREFERRED_WIDTH, contentWidth);
  const height = Math.min(bodyLines + 2, interiorHeight);
  if (height < MIN_BOX_HEIGHT || width < 20) return null;
  return {
    x: 1 + Math.floor((contentWidth - width) / 2),
    y: 1 + Math.floor((interiorHeight - height) / 2),
    width,
    height,
  };
}

export function computeHelpLayout(size: TerminalSize): Rect | null {
  return centerOverlay(size, HELP_BODY_LINES);
}

export interface PaletteLayout {
  readonly rect: Rect;
  /** Frame row of the `> query` input line. */
  readonly inputRow: number;
  /** Frame row of the first action row. */
  readonly firstActionRow: number;
  /** Action rows the box can show. */
  readonly visibleActions: number;
}

/** Palette box: input line + one row per match (at least the empty line). */
export function computePaletteLayout(size: TerminalSize, matchCount: number): PaletteLayout | null {
  const rect = centerOverlay(size, 1 + Math.max(1, matchCount));
  if (rect === null) return null;
  return {
    rect,
    inputRow: rect.y + 1,
    firstActionRow: rect.y + 2,
    visibleActions: Math.max(0, rect.height - 3),
  };
}

export interface DetailLayout {
  readonly headerRow: number;
  readonly footerRow: number;
  readonly frameBottomRow: number;
  readonly contentX: number;
  readonly contentWidth: number;
  readonly box: Rect | null;
}

/** Drill-in screens: one box over the whole interior. */
export function computeDetailLayout(size: TerminalSize): DetailLayout {
  const { columns, rows } = size;
  const contentWidth = Math.max(0, columns - 2);
  const interiorHeight = Math.max(0, rows - 3);
  return {
    headerRow: 0,
    footerRow: rows - 1,
    frameBottomRow: rows - 2,
    contentX: 1,
    contentWidth,
    box:
      interiorHeight >= MIN_BOX_HEIGHT && contentWidth >= 20
        ? { x: 1, y: 1, width: contentWidth, height: interiorHeight }
        : null,
  };
}
