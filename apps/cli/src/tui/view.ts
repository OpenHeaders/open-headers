/**
 * Screen composition — TuiAppState → frame rows, per the §4 wireframes:
 * dashboard (three panes in an outer frame, header strip on the top
 * border, footer legend below), rule/environment drill-in, and the
 * daemon-unreachable park screen. Pure: no I/O, clock injected. Data
 * (names, uids, kinds, daemon copy) renders verbatim; every fixed
 * string is a `tui.*` catalog key.
 */

import type { TuiApp } from './app';
import { centerLine, makeBox, padToWidth } from './box';
import type { TerminalCapabilities } from './capability';
import {
  type ChromeContext,
  composeBottomBorder,
  composeFooterLegend,
  composeHeaderLine,
  composeTabRow,
  type LegendEntry,
  type TabEntry,
} from './chrome';
import type { TuiTranslator } from './i18n';
import {
  computeDashboardLayout,
  computeDetailLayout,
  computeHelpLayout,
  computePaletteLayout,
  HELP_BODY_LINES,
  PANE_ORDER,
  type PaneId,
  paneBodyHeight,
  type Rect,
} from './layout';
import type { EnvironmentRow, PaneRow, RuleRow, WorkspaceRow } from './rows';
import { sliceCells, stripSgr, visibleWidth } from './screen';
import { paint, reverse } from './style';
import type { TerminalSize } from './tty';

export interface ViewContext {
  readonly caps: TerminalCapabilities;
  readonly t: TuiTranslator;
  readonly now: number;
}

// ── Small helpers ────────────────────────────────────────────────────

function chromeContext(width: number, ctx: ViewContext): ChromeContext {
  return { width, glyphs: ctx.caps.glyphs, tier: ctx.caps.colorTier };
}

/** `left … right` spread across `width` cells, right-aligned tail. */
function spreadRow(left: string, right: string, width: number, ellipsis: string): string {
  if (right === '') return padToWidth(left, width, ellipsis);
  const gap = width - visibleWidth(left) - visibleWidth(right);
  if (gap >= 1) return left + ' '.repeat(gap) + right;
  return padToWidth(`${left} ${right}`, width, ellipsis);
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (visibleWidth(candidate) > width && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function formatAgo(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function moveCap(ctx: ViewContext): string {
  return ctx.caps.unicode ? '↑↓' : 'up/dn';
}

// ── Header segments ──────────────────────────────────────────────────

function headerSegments(app: TuiApp, ctx: ViewContext): string[] {
  const { t, caps } = ctx;
  const { state } = app;
  const tier = caps.colorTier;
  const glyphs = caps.glyphs;
  const segments: string[] = [t('tui.header.product')];

  const snapshot = state.snapshot;
  if (snapshot !== null) {
    const active = snapshot.workspaces.workspaces.find((ws) => ws.active);
    if (active !== undefined) segments.push(active.name);
    const activeEnvId = snapshot.environments.activeEnvironmentId;
    const activeEnv = snapshot.environments.environments.find((env) => env.uid === activeEnvId);
    segments.push(activeEnv === undefined ? t('tui.header.envNone') : t('tui.header.env', { name: activeEnv.name }));
  }

  if (state.phase === 'connecting') {
    segments.push(t('tui.header.syncing'));
  } else if (state.phase === 'degraded' || state.phase === 'parked') {
    segments.push(`${paint(glyphs.dotError, 'error', tier)} ${t('tui.header.unreachable')}`);
  } else {
    segments.push(`${paint(glyphs.dotOn, 'ok', tier)} ${t('tui.header.connected')}`);
  }

  if (state.lastSyncedAt !== null && state.phase !== 'parked') {
    segments.push(t('tui.header.synced', { ago: formatAgo(ctx.now - state.lastSyncedAt) }));
  }
  return segments;
}

// ── Pane rows ────────────────────────────────────────────────────────

interface PaneRenderInput {
  readonly pane: PaneId;
  readonly rect: Rect;
  readonly focused: boolean;
  readonly dimmed: boolean;
}

function workspaceLine(row: WorkspaceRow, ctx: ViewContext, width: number, plain: boolean): string {
  const { t, caps } = ctx;
  const sep = caps.glyphs.separator;
  const left = `${row.name} (${row.kind})${row.active ? ' *' : ''}`;
  const suffix = row.loaded ? '' : `${sep} ${t('tui.row.notLoaded')}`;
  const right = plain || suffix === '' ? suffix : paint(suffix, 'dim', caps.colorTier);
  return spreadRow(left, right, width, caps.glyphs.ellipsis);
}

function environmentLine(row: EnvironmentRow, ctx: ViewContext, width: number, plain: boolean): string {
  const { t, caps } = ctx;
  if (row.none) return padToWidth(`${row.name}${row.active ? ' *' : ''}`, width, caps.glyphs.ellipsis);
  const count = `(${t('tui.row.vars', { count: row.varCount })})`;
  const right = plain ? count : paint(count, 'dim', caps.colorTier);
  return spreadRow(`${row.name}${row.active ? ' *' : ''}`, right, width, caps.glyphs.ellipsis);
}

function ruleLine(row: RuleRow, ctx: ViewContext, width: number, plain: boolean): string {
  const { t, caps } = ctx;
  const tier = caps.colorTier;
  const glyphs = caps.glyphs;
  const dotGlyph = row.published ? (row.enabled ? glyphs.dotOn : glyphs.dotOff) : glyphs.dotDraft;
  const dotSemantic = row.published ? (row.enabled ? 'ok' : 'dim') : 'warn';
  const dot = plain ? dotGlyph : paint(dotGlyph, dotSemantic, tier);
  const word = (row.enabled ? t('tui.row.on') : t('tui.row.off')).padEnd(3);
  const draftText = row.published ? '' : ` ${t('tui.row.draft')}`;
  const draft = plain || draftText === '' ? draftText : paint(draftText, 'warn', tier);
  return spreadRow(`${dot} ${word} ${row.name}${draft}`, `[${row.type}]`, width, glyphs.ellipsis);
}

function paneRowLine(row: PaneRow, ctx: ViewContext, width: number, plain: boolean): string {
  if (row.pane === 'workspaces') return workspaceLine(row, ctx, width, plain);
  if (row.pane === 'environments') return environmentLine(row, ctx, width, plain);
  return ruleLine(row, ctx, width, plain);
}

function emptyPaneLines(pane: PaneId, ctx: ViewContext, width: number, height: number): string[] {
  const { t } = ctx;
  if (pane !== 'rules' && pane !== 'environments') return [];
  const title = t(pane === 'rules' ? 'tui.empty.rules.title' : 'tui.empty.environments.title');
  const body = t(pane === 'rules' ? 'tui.empty.rules.body' : 'tui.empty.environments.body');
  const bodyWidth = Math.max(10, width - 8);
  const lines: string[] = ['', centerLine(title, width, ctx.caps.glyphs.ellipsis), ''];
  for (const line of wrapText(body, bodyWidth)) {
    lines.push(centerLine(line, width, ctx.caps.glyphs.ellipsis));
  }
  return lines.slice(0, height);
}

function paneBoxRows(app: TuiApp, input: PaneRenderInput, ctx: ViewContext): string[] {
  const { t, caps } = ctx;
  const { pane, rect } = input;
  const glyphs = caps.glyphs;
  const innerWidth = Math.max(0, rect.width - 2);
  const bodyHeight = paneBodyHeight(rect);
  const rows = app.visibleRows(pane);
  const selected = app.selectedIndex(pane);
  const scroll = Math.max(0, Math.min(app.state.cursors[pane].scroll, Math.max(0, rows.length - 1)));

  const digit = PANE_ORDER.indexOf(pane) + 1;
  const paneName = t(
    pane === 'workspaces'
      ? 'tui.pane.workspaces'
      : pane === 'environments'
        ? 'tui.pane.environments'
        : 'tui.pane.rules',
  );
  let title = `${digit} ${paneName}`;
  if (pane === 'rules' && app.state.snapshot !== null) {
    const all = app.state.rows.rules;
    const on = all.filter((rule) => rule.enabled).length;
    const draft = all.filter((rule) => !rule.published).length;
    const summary = t('tui.pane.rules.summary', {
      on,
      off: all.length - on,
      draft,
      sep: glyphs.separator,
    });
    title = `${title} ${glyphs.borders.horizontal}${glyphs.borders.horizontal} ${summary}`;
  }

  let bodyLines: string[];
  if (rows.length === 0 && app.state.snapshot !== null && app.state.filter?.pane !== pane) {
    bodyLines = emptyPaneLines(pane, ctx, innerWidth, bodyHeight);
  } else {
    bodyLines = [];
    const markerWidth = visibleWidth(glyphs.selected);
    for (let i = scroll; i < Math.min(rows.length, scroll + bodyHeight); i += 1) {
      const isSelected = i === selected && input.focused;
      const marker = i === selected ? glyphs.selected : ' '.repeat(markerWidth);
      const plain = isSelected || input.dimmed;
      const content = paneRowLine(rows[i], ctx, Math.max(0, innerWidth - markerWidth - 1), plain);
      let line = `${marker} ${content}`;
      if (isSelected) line = reverse(padToWidth(line, innerWidth, glyphs.ellipsis));
      else if (input.dimmed) line = paint(padToWidth(line, innerWidth, glyphs.ellipsis), 'dim', caps.colorTier);
      bodyLines.push(line);
    }
    if (rows.length > scroll + bodyHeight) {
      const last = bodyLines.length - 1;
      if (last >= 0 && bodyHeight > 0) bodyLines[last] = padToWidth(glyphs.ellipsis, innerWidth, glyphs.ellipsis);
    }
  }

  return makeBox(bodyLines, {
    width: rect.width,
    height: rect.height,
    glyphs,
    tier: caps.colorTier,
    title,
    focused: input.focused,
  });
}

// ── Status line (filter / notice / degradation) ──────────────────────

function statusLineText(app: TuiApp, ctx: ViewContext): string {
  const { t, caps } = ctx;
  const { state } = app;
  if (state.notice !== null) return paint(state.notice.text, 'warn', caps.colorTier);
  if (state.filter !== null) {
    const matches = app.visibleRows(state.filter.pane).length;
    return t('tui.filter.line', { query: state.filter.query, count: matches, sep: caps.glyphs.borders.horizontal });
  }
  if (state.phase === 'degraded') return paint(t('tui.notice.staleData'), 'warn', caps.colorTier);
  if (state.phase === 'denied' && state.lastError !== null) return paint(state.lastError, 'error', caps.colorTier);
  return '';
}

// ── Footer legends ───────────────────────────────────────────────────

function dashboardLegend(app: TuiApp, ctx: ViewContext): LegendEntry[] {
  const { t, caps } = ctx;
  const pane = app.focus.focusedPane;
  const entries: LegendEntry[] = [{ cap: moveCap(ctx), label: t('tui.footer.move') }];
  if (pane !== 'workspaces') entries.push({ cap: caps.glyphs.keyEnter, label: t('tui.footer.open') });
  entries.push({ cap: '/', label: t('tui.footer.filter') });
  entries.push({ cap: '^K', label: t('tui.footer.palette') });
  entries.push({ cap: 'r', label: t('tui.footer.refresh') });
  entries.push({ cap: '?', label: t('tui.footer.help') });
  entries.push({ cap: 'q', label: t('tui.footer.quit') });
  // Lowest priority — the first entry a narrow terminal drops (? help teaches it).
  if (pane === 'rules') entries.push({ cap: 'y', label: t('tui.footer.yank') });
  return entries;
}

function detailLegend(ruleDetail: boolean, ctx: ViewContext): LegendEntry[] {
  const { t } = ctx;
  const entries: LegendEntry[] = [{ cap: moveCap(ctx), label: t('tui.footer.scroll') }];
  if (ruleDetail) entries.push({ cap: 'y', label: t('tui.footer.yank') });
  entries.push({ cap: 'esc', label: t('tui.footer.back') });
  entries.push({ cap: 'r', label: t('tui.footer.refresh') });
  entries.push({ cap: '?', label: t('tui.footer.help') });
  return entries;
}

// ── Screens ──────────────────────────────────────────────────────────

function composeDashboard(app: TuiApp, size: TerminalSize, ctx: ViewContext): string[] {
  const layout = computeDashboardLayout(size, {
    statusLine: app.statusLineActive(),
    focused: app.focus.focusedPane,
    workspaceCount: app.state.rows.workspaces.length,
  });
  const chrome = chromeContext(size.columns, ctx);
  const glyphs = ctx.caps.glyphs;
  const dimmed = app.state.phase === 'degraded';

  const paneRows = new Map<PaneId, string[]>();
  for (const pane of PANE_ORDER) {
    const rect = layout.panes[pane];
    if (rect === undefined) continue;
    paneRows.set(pane, paneBoxRows(app, { pane, rect, focused: app.focus.focusedPane === pane, dimmed }, ctx));
  }

  const frame: string[] = [];
  frame.push(composeHeaderLine(headerSegments(app, ctx), chrome));
  for (let row = 1; row < layout.frameBottomRow; row += 1) {
    let content: string;
    if (row === layout.statusRow) {
      content = padToWidth(` ${statusLineText(app, ctx)}`, layout.contentWidth, glyphs.ellipsis);
    } else if (row === layout.tabsRow) {
      const tabs: TabEntry[] = PANE_ORDER.map((pane, index) => ({
        digit: index + 1,
        title: ctx.t(
          pane === 'workspaces'
            ? 'tui.pane.workspaces'
            : pane === 'environments'
              ? 'tui.pane.environments'
              : 'tui.pane.rules',
        ),
        focused: app.focus.focusedPane === pane,
      }));
      content = composeTabRow(tabs, { ...chrome, width: layout.contentWidth });
    } else {
      const parts: string[] = [];
      let x = layout.contentX;
      for (const pane of PANE_ORDER) {
        const rect = layout.panes[pane];
        if (rect === undefined || row < rect.y || row >= rect.y + rect.height) continue;
        if (rect.x > x) parts.push(' '.repeat(rect.x - x));
        parts.push(paneRows.get(pane)?.[row - rect.y] ?? '');
        x = rect.x + rect.width;
      }
      content = padToWidth(parts.join(''), layout.contentWidth, glyphs.ellipsis);
    }
    frame.push(glyphs.borders.vertical + content + glyphs.borders.vertical);
  }
  frame.push(composeBottomBorder(chrome));
  frame.push(composeFooterLegend(dashboardLegend(app, ctx), chrome));
  return frame;
}

function composeDetail(app: TuiApp, size: TerminalSize, ctx: ViewContext): string[] {
  const { t, caps } = ctx;
  const detail = app.state.detail;
  if (detail === null) return composeDashboard(app, size, ctx);
  const layout = computeDetailLayout(size);
  const chrome = chromeContext(size.columns, ctx);
  const glyphs = caps.glyphs;

  let title = '';
  let bodyLines: string[] = [];
  if (detail.kind === 'rule') {
    title = t('tui.detail.rule.title', { name: detail.name });
    if (detail.data === null) {
      bodyLines = [` ${t('tui.detail.loading')}`];
    } else {
      const rule = detail.data.rule;
      const enabled = rule.enabled === true;
      const published = rule.published === true;
      const dotGlyph = published ? (enabled ? glyphs.dotOn : glyphs.dotOff) : glyphs.dotDraft;
      const dotSemantic = published ? (enabled ? 'ok' : 'dim') : 'warn';
      const stateCopy = published ? t('tui.detail.state.published') : t('tui.detail.state.draft');
      const word = enabled ? t('tui.row.on') : t('tui.row.off');
      bodyLines = [
        ` ${t('tui.detail.state')}   ${paint(dotGlyph, dotSemantic, caps.colorTier)} ${word} ${glyphs.separator} ${stateCopy}`,
        ` ${t('tui.detail.type')}    ${typeof rule.type === 'string' ? rule.type : ''}`,
        ` ${t('tui.detail.uid')}     ${detail.uid}`,
        '',
        ...detail.data.definitionLines.map((line) => ` ${line}`),
        '',
        ` ${paint(t('tui.detail.editingNote'), 'dim', caps.colorTier)}`,
      ];
    }
  } else {
    const env = app.state.snapshot?.environments.environments.find((entry) => entry.uid === detail.uid);
    title = t('tui.detail.env.title', { name: env?.name ?? detail.uid });
    bodyLines = (env?.variables ?? []).map((variable) =>
      variable.masked
        ? ` ${variable.name} ${paint(t('tui.row.masked'), 'dim', caps.colorTier)}`
        : ` ${variable.name} = ${variable.value ?? ''}`,
    );
  }

  const frame: string[] = [];
  frame.push(composeHeaderLine(headerSegments(app, ctx), chrome));
  if (layout.box === null) {
    for (let row = 1; row < layout.frameBottomRow; row += 1) {
      frame.push(glyphs.borders.vertical + ' '.repeat(Math.max(0, layout.contentWidth)) + glyphs.borders.vertical);
    }
  } else {
    const scrolled = bodyLines.slice(detail.scroll, detail.scroll + Math.max(0, layout.box.height - 2));
    const box = makeBox(scrolled, {
      width: layout.box.width,
      height: layout.box.height,
      glyphs,
      tier: caps.colorTier,
      title,
      focused: true,
    });
    for (let row = 1; row < layout.frameBottomRow; row += 1) {
      const content = box[row - 1] ?? ' '.repeat(Math.max(0, layout.contentWidth));
      frame.push(
        glyphs.borders.vertical + padToWidth(content, layout.contentWidth, glyphs.ellipsis) + glyphs.borders.vertical,
      );
    }
  }
  frame.push(composeBottomBorder(chrome));
  frame.push(composeFooterLegend(detailLegend(detail.kind === 'rule', ctx), chrome));
  return frame;
}

function composePark(app: TuiApp, size: TerminalSize, ctx: ViewContext): string[] {
  const { t, caps } = ctx;
  const glyphs = caps.glyphs;
  const chrome = chromeContext(size.columns, ctx);
  const width = Math.max(0, size.columns - 2);

  const block: string[] = [
    `${paint(glyphs.dotError, 'error', caps.colorTier)}  ${t('tui.park.title')}`,
    '',
    t('tui.park.body1'),
    t('tui.park.body2', { url: app.daemonUrl }),
    '',
    t('tui.park.hint1'),
    t('tui.park.hint2'),
    t('tui.park.hint3'),
    '',
  ];
  if (app.state.refreshing) {
    block.push(paint(t('tui.park.retrying'), 'warn', caps.colorTier));
  } else if (app.state.nextRetryAt !== null) {
    const seconds = Math.max(0, Math.ceil((app.state.nextRetryAt - ctx.now) / 1000));
    block.push(t('tui.park.retryIn', { seconds, sep: glyphs.separator }));
  }

  const interiorHeight = Math.max(0, size.rows - 3);
  const topPad = Math.max(0, Math.floor((interiorHeight - block.length) / 2));
  const frame: string[] = [];
  const segments = [
    t('tui.header.product'),
    `${paint(glyphs.dotError, 'error', caps.colorTier)} ${t('tui.header.unreachable')}`,
  ];
  frame.push(composeHeaderLine(segments, chrome));
  for (let row = 0; row < interiorHeight; row += 1) {
    const line =
      row >= topPad && row - topPad < block.length
        ? centerLine(block[row - topPad], width, glyphs.ellipsis)
        : ' '.repeat(width);
    frame.push(glyphs.borders.vertical + line + glyphs.borders.vertical);
  }
  frame.push(composeBottomBorder(chrome));
  frame.push(
    composeFooterLegend(
      [
        { cap: 'r', label: t('tui.footer.retryNow') },
        { cap: 'q', label: t('tui.footer.quit') },
      ],
      chrome,
    ),
  );
  return frame;
}

// ── Overlays (help cheatsheet, command palette) ──────────────────────

interface HelpEntry {
  readonly cap: string;
  readonly label: string;
}

interface HelpGroup {
  readonly title: string;
  readonly entries: readonly HelpEntry[];
}

/** One column stack: group titles with cap-aligned entries, blank line between groups. */
function helpColumnLines(groups: readonly HelpGroup[]): string[] {
  const capWidth = Math.max(...groups.flatMap((group) => group.entries.map((entry) => visibleWidth(entry.cap))));
  const lines: string[] = [];
  for (const group of groups) {
    if (lines.length > 0) lines.push('');
    lines.push(group.title);
    for (const entry of group.entries) {
      lines.push(` ${entry.cap}${' '.repeat(Math.max(0, capWidth - visibleWidth(entry.cap)))}  ${entry.label}`);
    }
  }
  return lines;
}

/**
 * The §4.3 cheatsheet body — only the verbs that exist today (no ␣/p
 * until Phase 4; footer honesty carries into the overlay). Exactly
 * HELP_BODY_LINES rows; layout.ts sizes the box from that count.
 */
function helpBodyLines(ctx: ViewContext, innerWidth: number): string[] {
  const { t, caps } = ctx;
  const glyphs = caps.glyphs;
  const left = helpColumnLines([
    {
      title: t('tui.help.group.navigate'),
      entries: [
        { cap: `${moveCap(ctx)} / jk`, label: t('tui.footer.move') },
        { cap: 'g / G', label: t('tui.help.topBottom') },
        { cap: `${glyphs.keyPageUp} / ${glyphs.keyPageDown}`, label: t('tui.help.page') },
        { cap: `${glyphs.keyTab} / 1 2 3`, label: t('tui.help.focusPane') },
        { cap: 'esc', label: t('tui.help.backClear') },
      ],
    },
    {
      title: t('tui.help.group.find'),
      entries: [
        { cap: '/', label: t('tui.help.filterPane') },
        { cap: '?', label: t('tui.help.thisHelp') },
      ],
    },
  ]);
  const right = helpColumnLines([
    {
      title: t('tui.help.group.act'),
      entries: [
        { cap: glyphs.keyEnter, label: t('tui.footer.open') },
        { cap: 'y', label: t('tui.footer.yank') },
        { cap: 'r', label: t('tui.footer.refresh') },
      ],
    },
    {
      title: t('tui.help.group.session'),
      entries: [
        { cap: '^K', label: t('tui.help.palette') },
        { cap: 'q', label: t('tui.footer.quit') },
      ],
    },
  ]);
  const leftWidth = Math.floor(innerWidth / 2);
  const merged: string[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    merged.push(` ${padToWidth(left[i] ?? '', Math.max(0, leftWidth - 1), glyphs.ellipsis)}${right[i] ?? ''}`);
  }
  merged.push('');
  merged.push(` ${paint(t('tui.help.note'), 'dim', caps.colorTier)}`);
  return merged;
}

function paletteBodyLines(app: TuiApp, ctx: ViewContext, innerWidth: number): string[] {
  const { t, caps } = ctx;
  const glyphs = caps.glyphs;
  const overlay = app.state.overlay;
  const query = overlay !== null && overlay.kind === 'palette' ? overlay.query : '';
  const lines: string[] = [` > ${query}${reverse(' ')}`];
  const matches = app.paletteMatches();
  if (matches.length === 0) {
    lines.push(` ${paint(t('tui.palette.empty'), 'dim', caps.colorTier)}`);
    return lines;
  }
  const selected = app.paletteSelected();
  const markerWidth = visibleWidth(glyphs.selected);
  for (let i = 0; i < matches.length; i += 1) {
    const marker = i === selected ? glyphs.selected : ' '.repeat(markerWidth);
    const line = ` ${marker} ${t(matches[i].labelKey)}`;
    lines.push(i === selected ? reverse(padToWidth(line, innerWidth, glyphs.ellipsis)) : line);
  }
  return lines;
}

/** Dim-wash a base row (stale-data treatment) — SGR stripped first so the wash is uniform. */
function washRow(row: string, ctx: ViewContext): string {
  const plain = stripSgr(row);
  return plain === '' ? '' : paint(plain, 'dim', ctx.caps.colorTier);
}

/** Overwrite the modal's rectangle over the dim-washed base frame (§4.3). */
function spliceOverlay(base: string[], box: string[], rect: Rect, ctx: ViewContext): string[] {
  const tier = ctx.caps.colorTier;
  return base.map((row, index) => {
    if (index < rect.y || index >= rect.y + rect.height) return washRow(row, ctx);
    const plain = stripSgr(row);
    const left = sliceCells(plain, 0, rect.x);
    const right = sliceCells(plain, rect.x + rect.width, Number.MAX_SAFE_INTEGER);
    const washedLeft = left === '' ? '' : paint(left, 'dim', tier);
    const washedRight = right === '' ? '' : paint(right, 'dim', tier);
    return washedLeft + (box[index - rect.y] ?? '') + washedRight;
  });
}

function composeOverlay(app: TuiApp, base: string[], size: TerminalSize, ctx: ViewContext): string[] {
  const { t, caps } = ctx;
  const overlay = app.state.overlay;
  if (overlay === null) return base;
  const glyphs = caps.glyphs;
  const closeLabel = `esc ${t('tui.help.close')}`;
  if (overlay.kind === 'help') {
    const rect = computeHelpLayout(size);
    if (rect === null) return base;
    const body = helpBodyLines(ctx, Math.max(0, rect.width - 2)).slice(0, HELP_BODY_LINES);
    const box = makeBox(body, {
      width: rect.width,
      height: rect.height,
      glyphs,
      tier: caps.colorTier,
      title: t('tui.help.title'),
      bottomLabel: closeLabel,
      focused: true,
    });
    return spliceOverlay(base, box, rect, ctx);
  }
  const layout = computePaletteLayout(size, app.paletteMatches().length);
  if (layout === null) return base;
  const box = makeBox(paletteBodyLines(app, ctx, Math.max(0, layout.rect.width - 2)), {
    width: layout.rect.width,
    height: layout.rect.height,
    glyphs,
    tier: caps.colorTier,
    title: '^K',
    bottomLabel: `${glyphs.keyEnter} ${t('tui.palette.run')} ${glyphs.separator} ${closeLabel}`,
    focused: true,
  });
  return spliceOverlay(base, box, layout.rect, ctx);
}

export function viewTui(app: TuiApp, size: TerminalSize, ctx: ViewContext): string[] {
  if (size.rows < 3 || size.columns < 8) {
    return [padToWidth(ctx.t('tui.header.product'), Math.max(0, size.columns), ctx.caps.glyphs.ellipsis)];
  }
  let base: string[];
  if (app.state.phase === 'parked') base = composePark(app, size, ctx);
  else if (app.state.detail !== null) base = composeDetail(app, size, ctx);
  else base = composeDashboard(app, size, ctx);
  return composeOverlay(app, base, size, ctx);
}
