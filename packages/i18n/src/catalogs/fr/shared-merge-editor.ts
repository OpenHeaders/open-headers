/**
 * Shared merge-editor family — French. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included), the ✕ ▶ ◀ ↘ ↙ · glyphs and
 * the `+ − ~ =` kind-label prefixes stay raw. « hunk » stays raw as
 * merge vocabulary.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Hunk précédent · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Hunk suivant · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'Tous les hunks résolus',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} hunk restant',
      many: '{count} hunks restants',
      other: '{count} hunks restants',
    }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} conflit',
      many: '{count} conflits',
      other: '{count} conflits',
    }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} sans conflit',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    "Applique chaque hunk touché par un seul côté, en une seule étape d'annulation. Les conflits restent à " +
    'résoudre manuellement. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Appliquer les sans-conflit',
  'shared.mergeEditor.toolbar.acceptAll': 'Tout accepter',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': "Accepter tout l'entrant (ce fichier)",
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Accepter tout le courant (ce fichier)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': "Accepter tout l'entrant (toute la session)",
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Accepter tout le courant (toute la session)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': "Accepter tout l'entrant",
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Accepter tout le courant',
  'shared.mergeEditor.toolbar.baseUnavailable': 'Vue de base indisponible — aucun ancêtre commun dans cette session.',
  'shared.mergeEditor.toolbar.resetLayout': 'Réinitialiser les tailles de volets pour la disposition actuelle',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Colonnes',
  'shared.mergeEditor.layout.baseOnTop': 'Base en haut',
  'shared.mergeEditor.layout.baseInCenter': 'Base au centre',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Afficher les sans-conflit',
  'shared.mergeEditor.toggle.compactView': 'Vue compacte',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Replie les régions inchangées dans tous les volets — seules les zones de hunk (plus quelques lignes de ' +
    'contexte) restent visibles. Utile pour les fichiers dont la plupart des lignes sont inchangées.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Résolution en un clic',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    "Quand activé, accepter un côté d'un hunk écarte automatiquement l'autre : le hunk se résout en un clic. " +
    "Désactivé, l'affordance d'ajout diagonal (↘ / ↙) reste disponible pour empiler les deux côtés.",
  'shared.mergeEditor.toggle.inlineLabels': 'Libellés en ligne',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    "Affiche les libellés '{accept} | {combine} | {ignore}' au-dessus de chaque hunk en attente dans les volets " +
    'latéraux. Indépendant de la disposition.',
  'shared.mergeEditor.toggle.sideGutters': 'Gouttières latérales',
  'shared.mergeEditor.toggle.sideGuttersTooltip':
    "Affiche les glyphes ✕ ▶ / ◀ ✕ de part et d'autre de l'éditeur de résultat.",
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    "Les gouttières latérales ne sont disponibles qu'en disposition Colonnes — base-en-haut et base-au-centre " +
    'placent le résultat sur une rangée distincte des leurs / miennes.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': "Accepter tout l'entrant (session)",
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Accepter tout le courant (session)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Remplace {scope} par la version entrante.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Rétablit {scope} à votre version courante.',
  'shared.mergeEditor.confirm.discardsLocal':
    'Cela abandonne vos modifications locales pour chaque fichier de la session.',
  'shared.mergeEditor.confirm.discardsIncoming':
    'Cela abandonne chaque modification entrante pour chaque fichier de la session.',
  'shared.mergeEditor.confirm.okIncoming': "Accepter tout l'entrant",
  'shared.mergeEditor.confirm.okCurrent': 'Accepter tout le courant',
  'shared.mergeEditor.confirm.cancel': 'Annuler',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fichier',
      many: '{count} fichiers',
      other: '{count} fichiers',
    }),
  'shared.mergeEditor.groupOther': 'Autres',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': "L'application a signalé des erreurs :",
  'shared.mergeEditor.errors.unknown': 'erreur inconnue',
  'shared.mergeEditor.emptySession': 'Aucun fichier dans cette session de fusion.',
  'shared.mergeEditor.footer.cancel': 'Annuler',
  'shared.mergeEditor.footer.completeMerge': 'Terminer la fusion',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Entrant (les leurs)',
  'shared.mergeEditor.pane.result': 'Résultat',
  'shared.mergeEditor.pane.yoursEditHere': 'Les vôtres (les miennes, modifiez ici)',
  'shared.mergeEditor.pane.current': 'Courant (les miennes)',
  'shared.mergeEditor.pane.base': 'Base (ancêtre commun)',
  'shared.mergeEditor.sash.columns12': 'Redimensionner colonne 1 / colonne 2',
  'shared.mergeEditor.sash.columns23': 'Redimensionner colonne 2 / colonne 3',
  'shared.mergeEditor.sash.rows': 'Redimensionner rangée du haut / rangée du bas',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Ajouté',
  'shared.mergeEditor.fileList.kindModified': 'Modifié',
  'shared.mergeEditor.fileList.kindRemoved': 'Retiré',
  'shared.mergeEditor.fileList.statusUnresolved': 'non résolu',
  'shared.mergeEditor.fileList.statusPartial': 'partiel',
  'shared.mergeEditor.fileList.statusResolved': 'résolu',
  'shared.mergeEditor.fileList.statusFailed': 'échoué',
  'shared.mergeEditor.fileList.pairedWith': 'Apparié avec : {label}',
  'shared.mergeEditor.fileList.hunksRemaining': '{count} hunks restants',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': "Accepter l'entrant",
  'shared.mergeEditor.zone.acceptCurrent': 'Accepter le courant',
  'shared.mergeEditor.zone.acceptCombination': 'Accepter la combinaison',
  'shared.mergeEditor.zone.ignore': 'Ignorer',
  'shared.mergeEditor.zone.combineTooltip': "Empiler les deux côtés — l'entrant d'abord, puis le courant",
  'shared.mergeEditor.zone.removeIncoming': "Retirer l'entrant",
  'shared.mergeEditor.zone.removeCurrent': 'Retirer le courant',
  'shared.mergeEditor.zone.revertIncomingTitle': "Remettre l'entrant en attente pour re-décider",
  'shared.mergeEditor.zone.revertCurrentTitle': 'Remettre le courant en attente pour re-décider',
  'shared.mergeEditor.zone.statusNoChanges': 'Aucune modification acceptée',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Entrant + courant',
  'shared.mergeEditor.zone.statusIncoming': 'Entrant',
  'shared.mergeEditor.zone.statusCurrent': 'Courant',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Entrant ignoré',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Courant ignoré',
  'shared.mergeEditor.zone.kindAdds': '+ Ajouts',
  'shared.mergeEditor.zone.kindRemoves': '− Retraits',
  'shared.mergeEditor.zone.kindModifies': '~ Modifications',
  'shared.mergeEditor.zone.kindUnchanged': '= Inchangé',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Fusion : aller au hunk suivant',
  'shared.mergeEditor.action.prevHunk': 'Fusion : aller au hunk précédent',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Fusion : accepter le hunk entrant au curseur',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Fusion : accepter le hunk courant au curseur',
  'shared.mergeEditor.action.applyNonConflicting': 'Fusion : appliquer les modifications sans conflit',
  'shared.mergeEditor.action.acceptAllIncoming': "Fusion : accepter tout l'entrant",
  'shared.mergeEditor.action.acceptAllCurrent': 'Fusion : accepter tout le courant',
  'shared.mergeEditor.action.undo': 'Fusion : annuler (tampon + état des choix)',
  'shared.mergeEditor.action.redo': 'Fusion : rétablir (tampon + état des choix)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': "Accepter l'entrant",
  'shared.mergeEditor.gutter.acceptCurrent': 'Accepter le courant',
  'shared.mergeEditor.gutter.appendIncoming': "Ajouter aussi l'entrant après le courant",
  'shared.mergeEditor.gutter.appendCurrent': "Ajouter aussi le courant après l'entrant",
  'shared.mergeEditor.gutter.skipIncoming': "Ignorer l'entrant pour ce hunk",
  'shared.mergeEditor.gutter.skipCurrent': 'Ignorer le courant pour ce hunk',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'Tous les hunks résolus.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} hunk restant.',
      many: '{count} hunks restants.',
      other: '{count} hunks restants.',
    }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Hunk entrant accepté.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Hunk courant accepté.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} hunk sans conflit appliqué.',
      many: '{count} hunks sans conflit appliqués.',
      other: '{count} hunks sans conflit appliqués.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Le {count} hunk entrant accepté.',
      many: 'Les {count} hunks entrants acceptés.',
      other: 'Les {count} hunks entrants acceptés.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Le {count} hunk courant accepté.',
      many: 'Les {count} hunks courants acceptés.',
      other: 'Les {count} hunks courants acceptés.',
    }),
} as const satisfies Catalog;
