/**
 * TUI namespace — Romanian. Mirrors `catalogs/en/tui.ts` key for key.
 * Data stays data: workspace / environment / rule names, uids, URLs,
 * kinds, and daemon-provided copy render verbatim in the composers;
 * `OpenHeaders`, `env: {name}`, `{count} vars`, `uid`, `oh status`, the
 * `r` key ride raw (ja / ko / ru parity) with tasta / comanda as head
 * nouns where prose needs one (apăsați r — the bare key reads as a
 * caption). Quotes the shipped ro mints: daemonul = the daemon (wire
 * noun, workbench-chrome), instrumentul de linie de comandă oh
 * (settings panes), Paleta de comenzi, spațiu de lucru / mediu /
 * regulă, act. / dezact. = on / off (the abbreviated state pair),
 * ciornă = draft, publicare = publish, Comutare = switch (the
 * workspace switch), Reîmprospătare, conectat = connected, panou =
 * pane. MINTS: tablou de bord = dashboard (carried from the chrome's
 * workflowStatus info); mascat = masked; retragere din publicare =
 * unpublish (a rule — Oprire partajare stays the workspace
 * public-share verb); ecran de așteptare = the park screen. Footer
 * legend verbs stay bare nouns (the terminal width budget — shortest
 * correct form; „publ./retrag.” for the help row).
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: niciunul',
  'tui.header.connected': 'conectat',
  'tui.header.unreachable': 'daemon inaccesibil',
  'tui.header.synced': 'sincronizat acum {ago}',
  'tui.header.syncedJustNow': 'sincronizat chiar acum',
  'tui.header.syncing': 'se sincronizează…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Spații de lucru',
  'tui.pane.environments': 'Medii',
  'tui.pane.rules': 'Reguli',
  'tui.pane.rules.summary': '{on} act. {sep} {off} dezact. {sep} {draft} ciorne',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'act.',
  'tui.row.off': 'dezact.',
  'tui.row.draft': '(ciornă)',
  'tui.row.notLoaded': 'neîncărcat',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'Fără mediu',
  'tui.row.masked': '(mascat)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'navigare',
  'tui.footer.open': 'deschidere',
  'tui.footer.filter': 'filtru',
  'tui.footer.refresh': 'reîmprospătare',
  'tui.footer.yank': 'copiere uid',
  'tui.footer.quit': 'ieșire',
  'tui.footer.back': 'înapoi',
  'tui.footer.scroll': 'derulare',
  'tui.footer.retryNow': 'reîncercare acum',
  'tui.footer.palette': 'paletă',
  'tui.footer.help': 'ajutor',
  'tui.footer.toggle': 'act./dezact.',
  'tui.footer.publish': 'publicare',
  'tui.footer.switch': 'comutare',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Tastatură',
  'tui.help.group.navigate': 'Navigare',
  'tui.help.group.act': 'Acțiune',
  'tui.help.group.find': 'Căutare',
  'tui.help.group.session': 'Sesiune',
  'tui.help.topBottom': 'început / sfârșit',
  'tui.help.page': 'pagină',
  'tui.help.focusPane': 'focalizare panou',
  'tui.help.backClear': 'înapoi / golire',
  'tui.help.filterPane': 'filtrare panou',
  'tui.help.thisHelp': 'acest ajutor',
  'tui.help.palette': 'paleta de comenzi',
  'tui.help.openSwitch': 'deschidere / comutare',
  'tui.help.toggleRule': 'act./dezact. regulă',
  'tui.help.publish': 'publ./retrag.',
  'tui.help.note': 'Aceleași taste ca în aplicație, acolo unde terminalul permite.',
  'tui.help.close': 'închidere',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Reîmprospătare acum',
  'tui.palette.action.help': 'Deschidere ajutor',
  'tui.palette.action.switchWorkspace': 'Comutare spațiu de lucru…',
  'tui.palette.action.switchEnvironment': 'Comutare mediu…',
  'tui.palette.action.toggleRule': 'Activare/dezactivare regulă',
  'tui.palette.action.publishRule': 'Publicare / retragere din publicare regulă',
  'tui.palette.picker.workspace': 'Comutare spațiu de lucru',
  'tui.palette.picker.environment': 'Comutare mediu',
  'tui.palette.empty': 'nicio comandă potrivită',
  'tui.palette.run': 'rulare',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'filtru: /{query} {sep} potriviri: {count}',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid copiat în clipboard',
  'tui.notice.staleData': 'se afișează ultimele date cunoscute — se reconectează…',
  'tui.notice.writeLost': 'modificare neaplicată — daemon inaccesibil',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'Nicio regulă în acest spațiu de lucru încă.',
  'tui.empty.rules.body':
    'Regulile se creează în aplicația OpenHeaders — tabloul de bord le preia imediat ce există. Apăsați r pentru reîmprospătare.',
  'tui.empty.environments.title': 'Niciun mediu în acest spațiu de lucru încă.',
  'tui.empty.environments.body':
    'Mediile se creează în aplicația OpenHeaders. „Fără mediu” rămâne selectabil între timp.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Regulă: {name}',
  'tui.detail.state': 'stare',
  'tui.detail.type': 'tip',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'publicată — activă pe extensiile de browser conectate',
  'tui.detail.state.draft': 'ciornă — fără efect asupra traficului live',
  'tui.detail.editingNote': 'Editarea se face în aplicația OpenHeaders — TUI citește și comută.',
  'tui.detail.loading': 'se încarcă…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Mediu: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Daemon inaccesibil sau MCP dezactivat',
  'tui.park.body1': 'Daemonul OpenHeaders nu este accesibil la',
  'tui.park.body2': '{url} sau suprafața sa MCP este oprită.',
  'tui.park.hint1': 'Porniți aplicația OpenHeaders (sau gazda daemonului),',
  'tui.park.hint2': 'sau verificați suprafața cu:  oh status',
  'tui.park.hint3': 'Apoi apăsați r pentru reîncercare.',
  'tui.park.retryIn': 'reîncercare automată {sep} următoarea încercare în {seconds}s',
  'tui.park.retrying': 'se reîncearcă…',
} as const satisfies Catalog;
