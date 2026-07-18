/**
 * Dashboard application state — screens, selection, filter, connection
 * phase — and the event → state → effect step. Pure of I/O by design:
 * fetching, timers, and clipboard writes are effects the runner
 * executes; the clock is injected. The view (view.ts) renders this
 * state; nothing here writes to the terminal.
 */

import type { DashboardSnapshot, RuleDetail } from './data';
import { createFocusRing, type FocusRing } from './focus';
import type { TuiMessageKey, TuiTranslator } from './i18n';
import type { TuiInputEvent } from './input';
import {
  computeDashboardLayout,
  computeDetailLayout,
  computeHelpLayout,
  computePaletteLayout,
  type DashboardLayout,
  PANE_ORDER,
  type PaneId,
  paneBodyHeight,
  type Rect,
} from './layout';
import {
  buildPaneRows,
  type EnvironmentRow,
  filterRows,
  type PaneRow,
  type PaneRows,
  type RuleRow,
  type WorkspaceRow,
} from './rows';
import type { TerminalSize } from './tty';

export type ConnectionPhase = 'connecting' | 'ready' | 'degraded' | 'parked' | 'denied';

export interface FilterState {
  pane: PaneId;
  query: string;
  /** True while `/` input is capturing printable keys. */
  entering: boolean;
}

export interface PaneCursor {
  /** Stable row identity — selection survives refreshes. */
  identity: string | null;
  scroll: number;
}

export interface RuleDetailScreen {
  readonly kind: 'rule';
  readonly uid: string;
  readonly name: string;
  data: RuleDetail | null;
  scroll: number;
}

export interface EnvDetailScreen {
  readonly kind: 'env';
  readonly uid: string;
  scroll: number;
}

export type DetailScreen = RuleDetailScreen | EnvDetailScreen;

export interface HelpOverlay {
  readonly kind: 'help';
}

export interface PaletteOverlay {
  readonly kind: 'palette';
  query: string;
  /** Index within the current matches; clamped on read. */
  selected: number;
}

export type OverlayState = HelpOverlay | PaletteOverlay;

export type PaletteActionId = 'refresh' | 'open-help';

export interface PaletteAction {
  readonly id: PaletteActionId;
  readonly labelKey: TuiMessageKey;
}

/**
 * The named actions that exist today (§4.4) — the CLI verb vocabulary
 * in palette clothing. Switch workspace/environment joins in Phase 4;
 * omitted until then (footer honesty carries into the palette).
 */
export const PALETTE_ACTIONS: readonly PaletteAction[] = [
  { id: 'refresh', labelKey: 'tui.palette.action.refresh' },
  { id: 'open-help', labelKey: 'tui.palette.action.help' },
];

export interface Notice {
  readonly text: string;
  readonly expiresAt: number;
}

export type Effect =
  | { readonly type: 'quit' }
  | { readonly type: 'refresh' }
  | { readonly type: 'fetch-rule'; readonly uid: string }
  | { readonly type: 'yank'; readonly text: string };

/** How long a status-bar notice stays up. */
export const NOTICE_MS = 4000;

const WHEEL_STEP = 3;

export interface TuiAppState {
  phase: ConnectionPhase;
  snapshot: DashboardSnapshot | null;
  rows: PaneRows;
  cursors: Record<PaneId, PaneCursor>;
  filter: FilterState | null;
  detail: DetailScreen | null;
  overlay: OverlayState | null;
  notice: Notice | null;
  /** Daemon copy, verbatim — park screen / denial notice. */
  lastError: string | null;
  lastSyncedAt: number | null;
  /** Park/degraded auto-retry deadline, for the countdown line. */
  nextRetryAt: number | null;
  refreshing: boolean;
}

export interface TuiAppOptions {
  readonly t: TuiTranslator;
  readonly daemonUrl: string;
  readonly now: () => number;
}

export interface TuiApp {
  readonly state: TuiAppState;
  readonly focus: FocusRing<PaneId>;
  readonly daemonUrl: string;
  handleEvent(event: TuiInputEvent, size: TerminalSize): Effect[];
  applySnapshot(snapshot: DashboardSnapshot): void;
  applyUnreachable(message: string): void;
  applyDenied(message: string): void;
  applyToolError(message: string): void;
  applyRuleDetail(detail: RuleDetail): void;
  setRefreshing(): void;
  setNextRetryAt(at: number | null): void;
  /** Expire the notice; returns true when the frame went dirty. */
  tick(now: number): boolean;
  /** Rows of the pane after its filter — what the pane displays. */
  visibleRows(pane: PaneId): readonly PaneRow[];
  selectedIndex(pane: PaneId): number;
  statusLineActive(): boolean;
  /** Palette actions matching the current query (substring, case-insensitive). */
  paletteMatches(): readonly PaletteAction[];
  /** Clamped selection index within paletteMatches(), or -1 when empty. */
  paletteSelected(): number;
}

export function createTuiApp(options: TuiAppOptions): TuiApp {
  const { t, now } = options;
  const focus = createFocusRing<PaneId>([...PANE_ORDER]);
  const state: TuiAppState = {
    phase: 'connecting',
    snapshot: null,
    rows: { workspaces: [], environments: [], rules: [] },
    cursors: {
      workspaces: { identity: null, scroll: 0 },
      environments: { identity: null, scroll: 0 },
      rules: { identity: null, scroll: 0 },
    },
    filter: null,
    detail: null,
    overlay: null,
    notice: null,
    lastError: null,
    lastSyncedAt: null,
    nextRetryAt: null,
    refreshing: false,
  };

  function paneFilterQuery(pane: PaneId): string {
    return state.filter !== null && state.filter.pane === pane ? state.filter.query : '';
  }

  function visibleWorkspaceRows(): WorkspaceRow[] {
    return filterRows(state.rows.workspaces, paneFilterQuery('workspaces'));
  }

  function visibleEnvironmentRows(): EnvironmentRow[] {
    return filterRows(state.rows.environments, paneFilterQuery('environments'));
  }

  function visibleRuleRows(): RuleRow[] {
    return filterRows(state.rows.rules, paneFilterQuery('rules'));
  }

  function visibleRows(pane: PaneId): readonly PaneRow[] {
    if (pane === 'workspaces') return visibleWorkspaceRows();
    if (pane === 'environments') return visibleEnvironmentRows();
    return visibleRuleRows();
  }

  function selectedIndex(pane: PaneId): number {
    const rows = visibleRows(pane);
    if (rows.length === 0) return -1;
    const identity = state.cursors[pane].identity;
    if (identity !== null) {
      const index = rows.findIndex((row) => row.identity === identity);
      if (index !== -1) return index;
    }
    return 0;
  }

  function statusLineActive(): boolean {
    return state.filter !== null || state.notice !== null || state.phase === 'degraded' || state.phase === 'denied';
  }

  function dashboardLayout(size: TerminalSize): DashboardLayout {
    return computeDashboardLayout(size, {
      statusLine: statusLineActive(),
      focused: focus.focusedPane,
      workspaceCount: state.rows.workspaces.length,
    });
  }

  function ensureVisible(pane: PaneId, bodyHeight: number): void {
    const cursor = state.cursors[pane];
    const index = selectedIndex(pane);
    if (index === -1 || bodyHeight <= 0) return;
    if (index < cursor.scroll) cursor.scroll = index;
    if (index >= cursor.scroll + bodyHeight) cursor.scroll = index - bodyHeight + 1;
  }

  function moveSelection(pane: PaneId, delta: number, bodyHeight: number): void {
    const rows = visibleRows(pane);
    if (rows.length === 0) return;
    const index = Math.max(0, Math.min(rows.length - 1, selectedIndex(pane) + delta));
    state.cursors[pane].identity = rows[index].identity;
    ensureVisible(pane, bodyHeight);
  }

  function selectEdge(pane: PaneId, end: boolean, bodyHeight: number): void {
    const rows = visibleRows(pane);
    if (rows.length === 0) return;
    state.cursors[pane].identity = rows[end ? rows.length - 1 : 0].identity;
    ensureVisible(pane, bodyHeight);
  }

  function showNotice(text: string): void {
    state.notice = { text, expiresAt: now() + NOTICE_MS };
  }

  function openSelected(pane: PaneId): Effect[] {
    const index = selectedIndex(pane);
    if (index === -1) return [];
    if (pane === 'rules') {
      const rule = visibleRuleRows()[index];
      state.detail = { kind: 'rule', uid: rule.uid, name: rule.name, data: null, scroll: 0 };
      return [{ type: 'fetch-rule', uid: rule.uid }];
    }
    if (pane === 'environments') {
      const env = visibleEnvironmentRows()[index];
      if (env.none) return [];
      state.detail = { kind: 'env', uid: env.uid, scroll: 0 };
    }
    // Workspace rows have no drill-in in v1; ⏎ switch is Phase 4.
    return [];
  }

  function yankSelected(pane: PaneId): Effect[] {
    if (pane !== 'rules') return [];
    const index = selectedIndex(pane);
    if (index === -1) return [];
    const rule = visibleRuleRows()[index];
    showNotice(t('tui.notice.yanked'));
    return [{ type: 'yank', text: rule.uid }];
  }

  function detailBodyLength(): number {
    const detail = state.detail;
    if (detail === null) return 0;
    if (detail.kind === 'rule') return detail.data === null ? 1 : detail.data.definitionLines.length + 6;
    const env = state.snapshot?.environments.environments.find((entry) => entry.uid === detail.uid);
    return env === undefined ? 0 : env.variables.length;
  }

  function scrollDetail(delta: number, bodyHeight: number): void {
    const detail = state.detail;
    if (detail === null) return;
    const max = Math.max(0, detailBodyLength() - Math.max(1, bodyHeight));
    detail.scroll = Math.max(0, Math.min(max, detail.scroll + delta));
  }

  function handleDetailKey(key: string, ctrl: boolean, size: TerminalSize): Effect[] {
    const layout = computeDetailLayout(size);
    const bodyHeight = layout.box === null ? 0 : layout.box.height - 2;
    if (ctrl && key === 'c') return [{ type: 'quit' }];
    if (ctrl && key === 'k') {
      openPalette();
      return [];
    }
    if (key === '?') {
      openHelp();
      return [];
    }
    switch (key) {
      case 'escape':
        state.detail = null;
        return [];
      case 'up':
      case 'k':
        scrollDetail(-1, bodyHeight);
        return [];
      case 'down':
      case 'j':
        scrollDetail(1, bodyHeight);
        return [];
      case 'pageup':
        scrollDetail(-Math.max(1, bodyHeight), bodyHeight);
        return [];
      case 'pagedown':
        scrollDetail(Math.max(1, bodyHeight), bodyHeight);
        return [];
      case 'g':
        scrollDetail(-detailBodyLength(), bodyHeight);
        return [];
      case 'G':
        scrollDetail(detailBodyLength(), bodyHeight);
        return [];
      case 'y': {
        const detail = state.detail;
        if (detail !== null && detail.kind === 'rule') {
          showNotice(t('tui.notice.yanked'));
          return [{ type: 'yank', text: detail.uid }];
        }
        return [];
      }
      case 'r': {
        const detail = state.detail;
        const effects: Effect[] = [{ type: 'refresh' }];
        if (detail !== null && detail.kind === 'rule') effects.push({ type: 'fetch-rule', uid: detail.uid });
        return effects;
      }
      default:
        return [];
    }
  }

  function handleFilterEntryKey(key: string, ctrl: boolean, alt: boolean, size: TerminalSize): Effect[] {
    const filter = state.filter;
    if (filter === null) return [];
    const layout = dashboardLayout(size);
    const rect = layout.panes[filter.pane];
    const bodyHeight = rect === undefined ? 0 : paneBodyHeight(rect);
    if (ctrl && key === 'c') return [{ type: 'quit' }];
    if (ctrl && key === 'k') {
      openPalette();
      return [];
    }
    switch (key) {
      case 'escape':
        state.filter = null;
        return [];
      case 'enter':
        filter.entering = false;
        return [];
      case 'backspace':
        filter.query = filter.query.slice(0, -1);
        return [];
      case 'up':
        moveSelection(filter.pane, -1, bodyHeight);
        return [];
      case 'down':
        moveSelection(filter.pane, 1, bodyHeight);
        return [];
      case 'space':
        filter.query += ' ';
        return [];
      default:
        if (key.length === 1 && !ctrl && !alt) {
          filter.query += key;
          ensureVisible(filter.pane, bodyHeight);
        }
        return [];
    }
  }

  // ── Overlays: help cheatsheet + command palette (§4.3/§4.4) ────────

  function openHelp(): void {
    state.overlay = { kind: 'help' };
    focus.pushModal('help');
  }

  function openPalette(): void {
    state.overlay = { kind: 'palette', query: '', selected: 0 };
    focus.pushModal('palette');
  }

  function closeOverlay(): void {
    state.overlay = null;
    focus.popModal();
  }

  function paletteMatches(): readonly PaletteAction[] {
    const overlay = state.overlay;
    const query = overlay !== null && overlay.kind === 'palette' ? overlay.query.trim().toLowerCase() : '';
    if (query === '') return PALETTE_ACTIONS;
    return PALETTE_ACTIONS.filter((action) => t(action.labelKey).toLowerCase().includes(query));
  }

  function paletteSelected(): number {
    const overlay = state.overlay;
    if (overlay === null || overlay.kind !== 'palette') return -1;
    const count = paletteMatches().length;
    return count === 0 ? -1 : Math.max(0, Math.min(overlay.selected, count - 1));
  }

  function runPaletteAction(action: PaletteAction): Effect[] {
    closeOverlay();
    if (action.id === 'refresh') return [{ type: 'refresh' }];
    openHelp();
    return [];
  }

  function movePaletteSelection(delta: number): void {
    const overlay = state.overlay;
    if (overlay === null || overlay.kind !== 'palette') return;
    const count = paletteMatches().length;
    if (count === 0) return;
    overlay.selected = Math.max(0, Math.min(count - 1, paletteSelected() + delta));
  }

  function handleOverlayKey(key: string, ctrl: boolean, alt: boolean): Effect[] {
    if (ctrl && key === 'c') return [{ type: 'quit' }];
    const overlay = state.overlay;
    if (overlay === null) return [];
    if (overlay.kind === 'help') {
      if (key === 'escape' || key === '?') {
        closeOverlay();
      } else if (ctrl && key === 'k') {
        closeOverlay();
        openPalette();
      }
      return [];
    }
    if (ctrl && key === 'k') {
      closeOverlay();
      return [];
    }
    switch (key) {
      case 'escape':
        // Innermost-first: a typed query clears before the palette closes.
        if (overlay.query !== '') {
          overlay.query = '';
          overlay.selected = 0;
        } else {
          closeOverlay();
        }
        return [];
      case 'enter': {
        const index = paletteSelected();
        return index === -1 ? [] : runPaletteAction(paletteMatches()[index]);
      }
      case 'up':
        movePaletteSelection(-1);
        return [];
      case 'down':
        movePaletteSelection(1);
        return [];
      case 'backspace':
        overlay.query = overlay.query.slice(0, -1);
        overlay.selected = 0;
        return [];
      case 'space':
        overlay.query += ' ';
        overlay.selected = 0;
        return [];
      default:
        if (key.length === 1 && !ctrl && !alt) {
          overlay.query += key;
          overlay.selected = 0;
        }
        return [];
    }
  }

  function insideRect(rect: Rect, column: number, row: number): boolean {
    return column >= rect.x && column < rect.x + rect.width && row >= rect.y && row < rect.y + rect.height;
  }

  function handleOverlayMouse(action: string, column: number, row: number, size: TerminalSize): Effect[] {
    const overlay = state.overlay;
    if (overlay === null) return [];
    if (overlay.kind === 'help') {
      const rect = computeHelpLayout(size);
      // Click outside a modal dismisses it (design §2.1).
      if (action === 'press' && (rect === null || !insideRect(rect, column, row))) closeOverlay();
      return [];
    }
    if (action === 'wheel-up' || action === 'wheel-down') {
      movePaletteSelection(action === 'wheel-up' ? -1 : 1);
      return [];
    }
    if (action !== 'press') return [];
    const matches = paletteMatches();
    const layout = computePaletteLayout(size, matches.length);
    if (layout === null || !insideRect(layout.rect, column, row)) {
      closeOverlay();
      return [];
    }
    const index = row - layout.firstActionRow;
    if (index >= 0 && index < Math.min(matches.length, layout.visibleActions)) {
      // Click selects; click on the already-selected action runs it (§2.1).
      if (index === paletteSelected()) return runPaletteAction(matches[index]);
      overlay.selected = index;
    }
    return [];
  }

  function handleDashboardKey(key: string, ctrl: boolean, shift: boolean, size: TerminalSize): Effect[] {
    if (ctrl && key === 'c') return [{ type: 'quit' }];
    if (ctrl && key === 'k') {
      openPalette();
      return [];
    }
    const layout = dashboardLayout(size);
    const pane = focus.focusedPane;
    const rect = layout.panes[pane];
    const bodyHeight = rect === undefined ? 0 : paneBodyHeight(rect);
    switch (key) {
      case 'q':
        return [{ type: 'quit' }];
      case 'r':
        return [{ type: 'refresh' }];
      case '/':
        state.filter = { pane, query: '', entering: true };
        return [];
      case 'escape':
        state.filter = null;
        return [];
      case 'tab':
        if (shift) focus.previous();
        else focus.next();
        return [];
      case '1':
      case '2':
      case '3':
        focus.focusDigit(Number.parseInt(key, 10));
        return [];
      case 'up':
      case 'k':
        moveSelection(pane, -1, bodyHeight);
        return [];
      case 'down':
      case 'j':
        moveSelection(pane, 1, bodyHeight);
        return [];
      case 'pageup':
        moveSelection(pane, -Math.max(1, bodyHeight), bodyHeight);
        return [];
      case 'pagedown':
        moveSelection(pane, Math.max(1, bodyHeight), bodyHeight);
        return [];
      case 'g':
      case 'home':
        selectEdge(pane, false, bodyHeight);
        return [];
      case 'G':
      case 'end':
        selectEdge(pane, true, bodyHeight);
        return [];
      case 'enter':
        return openSelected(pane);
      case 'y':
        return yankSelected(pane);
      case '?':
        openHelp();
        return [];
      default:
        return [];
    }
  }

  function paneAt(layout: DashboardLayout, column: number, row: number): { pane: PaneId; rect: Rect } | null {
    for (const pane of PANE_ORDER) {
      const rect = layout.panes[pane];
      if (rect === undefined) continue;
      if (column >= rect.x && column < rect.x + rect.width && row >= rect.y && row < rect.y + rect.height) {
        return { pane, rect };
      }
    }
    return null;
  }

  function handleDashboardMouse(action: string, column: number, row: number, size: TerminalSize): Effect[] {
    const layout = dashboardLayout(size);
    if (action === 'wheel-up' || action === 'wheel-down') {
      const pane = focus.focusedPane;
      const rect = layout.panes[pane];
      const bodyHeight = rect === undefined ? 0 : paneBodyHeight(rect);
      moveSelection(pane, action === 'wheel-up' ? -WHEEL_STEP : WHEEL_STEP, bodyHeight);
      return [];
    }
    if (action !== 'press') return [];
    const hit = paneAt(layout, column, row);
    if (hit === null) return [];
    const bodyIndex = row - hit.rect.y - 1;
    if (bodyIndex < 0 || bodyIndex >= paneBodyHeight(hit.rect)) {
      focus.focusPane(hit.pane);
      return [];
    }
    const rows = visibleRows(hit.pane);
    const index = state.cursors[hit.pane].scroll + bodyIndex;
    if (index >= rows.length) {
      focus.focusPane(hit.pane);
      return [];
    }
    const wasFocused = focus.focusedPane === hit.pane;
    const wasSelected = selectedIndex(hit.pane) === index;
    focus.focusPane(hit.pane);
    state.cursors[hit.pane].identity = rows[index].identity;
    // Click on the already-selected row drills in (design §2.1).
    if (wasFocused && wasSelected) return openSelected(hit.pane);
    return [];
  }

  function handleDetailMouse(action: string, size: TerminalSize): Effect[] {
    if (action !== 'wheel-up' && action !== 'wheel-down') return [];
    const layout = computeDetailLayout(size);
    const bodyHeight = layout.box === null ? 0 : layout.box.height - 2;
    scrollDetail(action === 'wheel-up' ? -WHEEL_STEP : WHEEL_STEP, bodyHeight);
    return [];
  }

  function handleEvent(event: TuiInputEvent, size: TerminalSize): Effect[] {
    if (event.type === 'mouse') {
      // SGR coordinates are 1-based; the frame is 0-based.
      const column = event.x - 1;
      const row = event.y - 1;
      if (state.overlay !== null) return handleOverlayMouse(event.action, column, row, size);
      if (state.detail !== null) return handleDetailMouse(event.action, size);
      return handleDashboardMouse(event.action, column, row, size);
    }
    if (state.overlay !== null) return handleOverlayKey(event.key, event.ctrl, event.alt);
    if (state.detail !== null) return handleDetailKey(event.key, event.ctrl, size);
    if (state.filter?.entering) {
      return handleFilterEntryKey(event.key, event.ctrl, event.alt, size);
    }
    return handleDashboardKey(event.key, event.ctrl, event.shift, size);
  }

  function applySnapshot(snapshot: DashboardSnapshot): void {
    state.snapshot = snapshot;
    state.rows = buildPaneRows(snapshot, t('tui.row.noEnvironment'));
    state.phase = 'ready';
    state.lastError = null;
    state.lastSyncedAt = now();
    state.nextRetryAt = null;
    state.refreshing = false;
    for (const pane of PANE_ORDER) {
      const rows = visibleRows(pane);
      const cursor = state.cursors[pane];
      if (rows.length === 0) {
        cursor.identity = null;
        cursor.scroll = 0;
        continue;
      }
      if (cursor.identity === null || !rows.some((row) => row.identity === cursor.identity)) {
        cursor.identity = rows[0].identity;
      }
      cursor.scroll = Math.max(0, Math.min(cursor.scroll, rows.length - 1));
    }
    const detail = state.detail;
    if (detail !== null && detail.kind === 'env') {
      const alive = snapshot.environments.environments.some((env) => env.uid === detail.uid);
      if (!alive) state.detail = null;
    }
  }

  function applyUnreachable(message: string): void {
    state.refreshing = false;
    state.lastError = message;
    state.phase = state.snapshot === null ? 'parked' : 'degraded';
  }

  function applyDenied(message: string): void {
    state.refreshing = false;
    state.lastError = message;
    state.phase = 'denied';
    state.nextRetryAt = null;
  }

  function applyToolError(message: string): void {
    state.refreshing = false;
    showNotice(message);
  }

  function applyRuleDetail(detail: RuleDetail): void {
    const screen = state.detail;
    if (screen !== null && screen.kind === 'rule') {
      const uid = typeof detail.rule.uid === 'string' ? detail.rule.uid : null;
      if (uid === screen.uid) screen.data = detail;
    }
  }

  function tick(nowMs: number): boolean {
    if (state.notice !== null && state.notice.expiresAt <= nowMs) {
      state.notice = null;
      return true;
    }
    return false;
  }

  return {
    state,
    focus,
    daemonUrl: options.daemonUrl,
    handleEvent,
    applySnapshot,
    applyUnreachable,
    applyDenied,
    applyToolError,
    applyRuleDetail,
    setRefreshing() {
      state.refreshing = true;
    },
    setNextRetryAt(at: number | null) {
      state.nextRetryAt = at;
    },
    tick,
    visibleRows,
    selectedIndex,
    statusLineActive,
    paletteMatches,
    paletteSelected,
  };
}
