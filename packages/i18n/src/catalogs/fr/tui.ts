/**
 * TUI namespace — the `oh tui` terminal dashboard — French. Mirrors
 * `catalogs/en/tui.ts` key for key. Data stays data: workspace /
 * environment / rule names, uids, URLs, kinds, and daemon-provided
 * copy render verbatim; `daemon`, `uid`, `vars`, `env` and the
 * `oh status` command ride raw.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env : {name}',
  'tui.header.envNone': 'env : aucun',
  'tui.header.connected': 'connecté',
  'tui.header.unreachable': 'daemon injoignable',
  'tui.header.synced': 'synchronisé il y a {ago}',
  'tui.header.syncing': 'synchronisation…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Espaces de travail',
  'tui.pane.environments': 'Environnements',
  'tui.pane.rules': 'Règles',
  'tui.pane.rules.summary': '{on} actives {sep} {off} inactives {sep} {draft} brouillons',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'active',
  'tui.row.off': 'inactive',
  'tui.row.draft': '(brouillon)',
  'tui.row.notLoaded': 'non chargé',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'Aucun environnement',
  'tui.row.masked': '(masqué)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'déplacer',
  'tui.footer.open': 'ouvrir',
  'tui.footer.filter': 'filtrer',
  'tui.footer.refresh': 'actualiser',
  'tui.footer.yank': "copier l'uid",
  'tui.footer.quit': 'quitter',
  'tui.footer.back': 'retour',
  'tui.footer.scroll': 'défiler',
  'tui.footer.retryNow': 'réessayer',
  'tui.footer.palette': 'palette',
  'tui.footer.help': 'aide',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Clavier',
  'tui.help.group.navigate': 'Naviguer',
  'tui.help.group.act': 'Agir',
  'tui.help.group.find': 'Trouver',
  'tui.help.group.session': 'Session',
  'tui.help.topBottom': 'début / fin',
  'tui.help.page': 'page',
  'tui.help.focusPane': 'cibler un volet',
  'tui.help.backClear': 'retour / effacer',
  'tui.help.filterPane': 'filtrer le volet',
  'tui.help.thisHelp': 'cette aide',
  'tui.help.palette': 'palette de commandes',
  'tui.help.note': "Les mêmes touches que l'application quand le terminal le permet.",
  'tui.help.close': 'fermer',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Actualiser maintenant',
  'tui.palette.action.help': "Ouvrir l'aide",
  'tui.palette.empty': 'aucune commande correspondante',
  'tui.palette.run': 'exécuter',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'filtre : /{query} {sep} {count} correspondances',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid copié dans le presse-papiers',
  'tui.notice.staleData': 'affichage des dernières données connues — reconnexion…',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'Aucune règle dans cet espace de travail pour le moment.',
  'tui.empty.rules.body':
    "Les règles se créent dans l'application OpenHeaders — le tableau de bord les reprend dès qu'elles " +
    'existent. Appuyez sur r pour actualiser.',
  'tui.empty.environments.title': 'Aucun environnement dans cet espace de travail pour le moment.',
  'tui.empty.environments.body':
    "Les environnements se créent dans l'application OpenHeaders. « Aucun environnement » reste sélectionnable " +
    'en attendant.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Règle : {name}',
  'tui.detail.state': 'état',
  'tui.detail.type': 'type',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'publiée — active sur les extensions de navigateur connectées',
  'tui.detail.state.draft': 'brouillon — sans effet sur le trafic réel',
  'tui.detail.editingNote': "La modification se fait dans l'application OpenHeaders — le TUI lit.",
  'tui.detail.loading': 'chargement…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Environnement : {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Daemon injoignable ou MCP désactivé',
  'tui.park.body1': "Le daemon OpenHeaders n'est pas joignable à",
  'tui.park.body2': '{url}, ou sa surface MCP est désactivée.',
  'tui.park.hint1': "Démarrez l'application OpenHeaders (ou votre hôte daemon),",
  'tui.park.hint2': 'ou sondez la surface avec :  oh status',
  'tui.park.hint3': 'Appuyez ensuite sur r pour réessayer.',
  'tui.park.retryIn': 'nouvelle tentative automatique {sep} prochain essai dans {seconds}s',
  'tui.park.retrying': 'nouvelle tentative…',
} as const satisfies Catalog;
