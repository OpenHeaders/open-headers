/**
 * TUI namespace — the `oh tui` terminal dashboard — German. Mirrors
 * `catalogs/en/tui.ts` key for key. Data stays data: workspace /
 * environment / rule names, uids, URLs, kinds, and daemon-provided
 * copy render verbatim; `daemon`, `uid`, `vars`, `env` and the
 * `oh status` command ride raw. File mints: die TUI (f.); das
 * Dashboard (n., raw); das Panel (n., raw — the TUI panes; the
 * Seitenpanel mint stays the side panel); row pair an/aus; footer
 * verbs terse lowercase infinitives. The app rides as apposition
 * „die App OpenHeaders“ and the Daemon token stays intact — no
 * genitive, no hyphen compound (S70 scanner law).
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: keine',
  'tui.header.connected': 'verbunden',
  'tui.header.unreachable': 'Daemon nicht erreichbar',
  'tui.header.synced': 'vor {ago} synchronisiert',
  'tui.header.syncedJustNow': 'gerade eben synchronisiert',
  'tui.header.syncing': 'wird synchronisiert…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Arbeitsbereiche',
  'tui.pane.environments': 'Umgebungen',
  'tui.pane.rules': 'Regeln',
  'tui.pane.rules.summary': '{on} an {sep} {off} aus {sep} {draft} als Entwurf',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'an',
  'tui.row.off': 'aus',
  'tui.row.draft': '(Entwurf)',
  'tui.row.notLoaded': 'nicht geladen',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'Keine Umgebung',
  'tui.row.masked': '(maskiert)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'bewegen',
  'tui.footer.open': 'öffnen',
  'tui.footer.filter': 'filtern',
  'tui.footer.refresh': 'aktualisieren',
  'tui.footer.yank': 'uid kopieren',
  'tui.footer.quit': 'beenden',
  'tui.footer.back': 'zurück',
  'tui.footer.scroll': 'scrollen',
  'tui.footer.retryNow': 'erneut versuchen',
  'tui.footer.palette': 'Palette',
  'tui.footer.help': 'Hilfe',
  'tui.footer.toggle': 'umschalten',
  'tui.footer.publish': 'veröffentlichen',
  'tui.footer.switch': 'wechseln',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Tastatur',
  'tui.help.group.navigate': 'Navigieren',
  'tui.help.group.act': 'Aktionen',
  'tui.help.group.find': 'Suchen',
  'tui.help.group.session': 'Sitzung',
  'tui.help.topBottom': 'Anfang / Ende',
  'tui.help.page': 'Seite',
  'tui.help.focusPane': 'Panel fokussieren',
  'tui.help.backClear': 'zurück / leeren',
  'tui.help.filterPane': 'Panel filtern',
  'tui.help.thisHelp': 'diese Hilfe',
  'tui.help.palette': 'Befehlspalette',
  'tui.help.openSwitch': 'öffnen / wechseln',
  'tui.help.toggleRule': 'Regel umschalten',
  'tui.help.publish': 'veröffentlichen/zurückziehen',
  'tui.help.note': 'Dieselben Tasten wie in der App, soweit das Terminal es zulässt.',
  'tui.help.close': 'schließen',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Jetzt aktualisieren',
  'tui.palette.action.help': 'Hilfe öffnen',
  'tui.palette.action.switchWorkspace': 'Arbeitsbereich wechseln…',
  'tui.palette.action.switchEnvironment': 'Umgebung wechseln…',
  'tui.palette.action.toggleRule': 'Regel aktivieren/deaktivieren',
  'tui.palette.action.publishRule': 'Regel veröffentlichen / zurückziehen',
  'tui.palette.picker.workspace': 'Arbeitsbereich wechseln',
  'tui.palette.picker.environment': 'Umgebung wechseln',
  'tui.palette.empty': 'keine passenden Befehle',
  'tui.palette.run': 'ausführen',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'Filter: /{query} {sep} {count} Treffer',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid in die Zwischenablage kopiert',
  'tui.notice.staleData': 'zeigt letzte bekannte Daten — verbinde erneut…',
  'tui.notice.writeLost': 'Änderung nicht übernommen — Daemon nicht erreichbar',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'Noch keine Regeln in diesem Arbeitsbereich.',
  'tui.empty.rules.body':
    'Regeln erstellst du in der App OpenHeaders — das Dashboard übernimmt sie, sobald sie existieren. ' +
    'Drücke r zum Aktualisieren.',
  'tui.empty.environments.title': 'Noch keine Umgebungen in diesem Arbeitsbereich.',
  'tui.empty.environments.body':
    'Umgebungen erstellst du in der App OpenHeaders. „Keine Umgebung“ bleibt bis dahin auswählbar.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Regel: {name}',
  'tui.detail.state': 'Status',
  'tui.detail.type': 'Typ',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'veröffentlicht — live in verbundenen Browser-Erweiterungen',
  'tui.detail.state.draft': 'Entwurf — keine Wirkung auf den echten Datenverkehr',
  'tui.detail.editingNote': 'Bearbeitet wird in der App OpenHeaders — die TUI liest und schaltet um.',
  'tui.detail.loading': 'lädt…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Umgebung: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Daemon nicht erreichbar oder MCP deaktiviert',
  'tui.park.body1': 'Der Daemon von OpenHeaders ist nicht erreichbar unter',
  'tui.park.body2': '{url}, oder MCP ist dort abgeschaltet.',
  'tui.park.hint1': 'Starte die App OpenHeaders (oder den Daemon auf deinem Host),',
  'tui.park.hint2': 'oder prüfe die Schnittstelle mit:  oh status',
  'tui.park.hint3': 'Drücke dann r, um es erneut zu versuchen.',
  'tui.park.retryIn': 'wiederholt automatisch {sep} nächster Versuch in {seconds}s',
  'tui.park.retrying': 'versuche erneut…',
} as const satisfies Catalog;
