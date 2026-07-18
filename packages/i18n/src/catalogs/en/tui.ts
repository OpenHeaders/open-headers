/**
 * TUI namespace — the `oh tui` terminal dashboard (TUI_DESIGN.md §6.3).
 * Data stays data: workspace/environment/rule names, uids, URLs, kinds,
 * and daemon-provided copy render verbatim in the composers. Key-cap
 * glyphs (⏎, ␣, arrows) come from the capability glyph tables, not the
 * catalog — only the verb words next to them live here.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: none',
  'tui.header.connected': 'connected',
  'tui.header.unreachable': 'daemon unreachable',
  'tui.header.synced': 'synced {ago} ago',
  'tui.header.syncing': 'syncing…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Workspaces',
  'tui.pane.environments': 'Environments',
  'tui.pane.rules': 'Rules',
  'tui.pane.rules.summary': '{on} on {sep} {off} off {sep} {draft} draft',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'on',
  'tui.row.off': 'off',
  'tui.row.draft': '(draft)',
  'tui.row.notLoaded': 'not loaded',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'No environment',
  'tui.row.masked': '(masked)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'move',
  'tui.footer.open': 'open',
  'tui.footer.filter': 'filter',
  'tui.footer.refresh': 'refresh',
  'tui.footer.yank': 'yank uid',
  'tui.footer.quit': 'quit',
  'tui.footer.back': 'back',
  'tui.footer.scroll': 'scroll',
  'tui.footer.retryNow': 'retry now',
  'tui.footer.palette': 'palette',
  'tui.footer.help': 'help',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Keyboard',
  'tui.help.group.navigate': 'Navigate',
  'tui.help.group.act': 'Act',
  'tui.help.group.find': 'Find',
  'tui.help.group.session': 'Session',
  'tui.help.topBottom': 'top / bottom',
  'tui.help.page': 'page',
  'tui.help.focusPane': 'focus pane',
  'tui.help.backClear': 'back / clear',
  'tui.help.filterPane': 'filter pane',
  'tui.help.thisHelp': 'this help',
  'tui.help.palette': 'command palette',
  'tui.help.note': 'Same keys as the app where the terminal allows it.',
  'tui.help.close': 'close',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Refresh now',
  'tui.palette.action.help': 'Open help',
  'tui.palette.empty': 'no matching commands',
  'tui.palette.run': 'run',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'filter: /{query} {sep} {count} matches',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid copied to clipboard',
  'tui.notice.staleData': 'showing last known data — reconnecting…',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'No rules in this workspace yet.',
  'tui.empty.rules.body':
    'Rules are created in the OpenHeaders app — the dashboard picks them up as soon as they exist. Press r to refresh.',
  'tui.empty.environments.title': 'No environments in this workspace yet.',
  'tui.empty.environments.body':
    'Environments are created in the OpenHeaders app. "No environment" stays selectable meanwhile.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Rule: {name}',
  'tui.detail.state': 'state',
  'tui.detail.type': 'type',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'published — live on connected browser extensions',
  'tui.detail.state.draft': 'draft — no effect on live traffic',
  'tui.detail.editingNote': 'Editing lives in the OpenHeaders app — the TUI reads.',
  'tui.detail.loading': 'loading…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Environment: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Daemon unreachable or MCP disabled',
  'tui.park.body1': 'The OpenHeaders daemon is not reachable at',
  'tui.park.body2': '{url}, or its MCP surface is turned off.',
  'tui.park.hint1': 'Start the OpenHeaders app (or your daemon host),',
  'tui.park.hint2': 'or probe the surface with:  oh status',
  'tui.park.hint3': 'Then press r to retry.',
  'tui.park.retryIn': 'retrying automatically {sep} next attempt in {seconds}s',
  'tui.park.retrying': 'retrying…',
} as const satisfies Catalog;
