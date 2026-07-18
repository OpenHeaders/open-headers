/**
 * DevTools panel — console tool window — French. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level
 * wire names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context
 * labels (top / frame names / script URLs), source locations,
 * "(anonymous)", the browser's synthesized network phrasing quoted
 * verbatim (« finished loading », « Access to fetch at … »), key
 * names (Enter / Tab / arrows), and the example-transcript rows in
 * the (i) corpora.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'Effacer la console',
  'panel.console.collapseAll': 'Tout replier',
  'panel.console.expandAll': 'Tout déployer',
  'panel.console.filterAria': 'Filtrer les messages de la console',
  'panel.console.levelTitle': 'Niveau de journalisation : {label}',
  'panel.console.settings': 'Paramètres de la console',
  'panel.console.settingsPaneAria': 'Paramètres de la console',
  'panel.console.contextTitle': 'Contexte JavaScript — où les commandes de la console sont évaluées',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Détaillé',
  'panel.console.levels.info': 'Info',
  'panel.console.levels.warnings': 'Avertissements',
  'panel.console.levels.errors': 'Erreurs',
  'panel.console.levels.all': 'Tous les niveaux',
  'panel.console.levels.defaultLevels': 'Niveaux par défaut',
  'panel.console.levels.hideAll': 'Tout masquer',
  'panel.console.levels.only': '{level} uniquement',
  'panel.console.levels.custom': 'Niveaux personnalisés',
  'panel.console.levels.default': 'Par défaut',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Masquer le réseau',
  'panel.console.setting.hideNetworkTitle':
    'Masquer les entrées de journal réseau du navigateur (requêtes échouées et bloquées)',
  'panel.console.setting.logXhr': 'Consigner les XMLHttpRequests',
  'panel.console.setting.logXhrTitle':
    'Consigner un message quand une requête XHR, fetch ou EventSource se termine ou échoue',
  'panel.console.setting.preserveLog': 'Conserver le journal',
  'panel.console.setting.preserveLogTitle': 'Ne pas effacer le journal à la navigation',
  'panel.console.setting.eagerEval': 'Évaluation anticipée',
  'panel.console.setting.eagerEvalTitle': "Évaluer à la volée le texte saisi dans l'invite (aperçu sans effet de bord)",
  'panel.console.setting.selectedContextOnly': 'Contexte sélectionné uniquement',
  'panel.console.setting.selectedContextOnlyTitle': 'Ne montrer que les messages du contexte sélectionné',
  'panel.console.setting.autocompleteHistory': "Autocomplétion depuis l'historique",
  'panel.console.setting.autocompleteHistoryTitle':
    "Suggérer les commandes déjà exécutées pendant la saisie dans l'invite",
  'panel.console.setting.groupSimilar': 'Grouper les messages similaires dans la console',
  'panel.console.setting.groupSimilarTitle': 'Replier les messages identiques répétés en une ligne avec un compteur',
  'panel.console.setting.evalUserGesture': "Traiter l'évaluation de code comme une action utilisateur",
  'panel.console.setting.evalUserGestureTitle':
    "Évaluer avec un geste utilisateur, pour que les API conditionnées à l'activation utilisateur " +
    "fonctionnent depuis l'invite",
  'panel.console.setting.showCorsErrors': 'Afficher les erreurs CORS dans la console',
  'panel.console.setting.showCorsErrorsTitle':
    'Afficher les erreurs de politique CORS à côté de la sortie propre de la page',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Exemple de console',
  'panel.console.info.hideNetwork.summary':
    'Masque les entrées de journal réseau propres au navigateur — requêtes échouées et bloquées — tandis que ' +
    'la sortie console de la page reste toujours.',
  'panel.console.info.hideNetwork.description':
    'Masque aussi les lignes « finished loading » synthétisées par Consigner les XMLHttpRequests — ce sont ' +
    'aussi des messages de source réseau.',
  'panel.console.info.logXhr.summary':
    "Consigne une ligne chaque fois qu'une requête XHR, fetch ou EventSource se termine ou échoue.",
  'panel.console.info.logXhr.description':
    "Les lignes sont consignées au niveau Info — les échecs aussi — et l'URL renvoie à la ligne de la requête " +
    'dans le panneau Network. Masquer le réseau masque aussi ces lignes.',
  'panel.console.info.preserveLog.summary':
    "Conserve le journal à travers les navigations de page au lieu de l'effacer.",
  'panel.console.info.preserveLog.description':
    'Désactivé, une navigation — la recréation du contexte top de la page — réduit la vue aux entrées qui ' +
    'arrivent après elle.',
  'panel.console.info.eagerEval.summary':
    "Prévisualise le résultat de l'expression que vous tapez, sur la ligne grise sous l'invite.",
  'panel.console.info.eagerEval.description':
    "L'aperçu s'évalue sans effet de bord : une expression qui changerait l'état de la page n'affiche rien au " +
    "lieu de s'exécuter, et rien n'est écrit dans le journal avant d'appuyer sur Enter.",
  'panel.console.info.selectedContextOnly.summary':
    'Ne montre que les messages du contexte JavaScript choisi dans le sélecteur de contexte de la barre ' + "d'outils.",
  'panel.console.info.selectedContextOnly.description':
    'Les entrées sans contexte — les entrées de journal propres au navigateur — restent toujours visibles.',
  'panel.console.info.autocompleteHistory.summary':
    'Suggère la commande la plus récente qui prolonge votre saisie, comme complétion estompée dans ' + "l'invite.",
  'panel.console.info.autocompleteHistory.description':
    "Tab — ou → en fin de saisie — l'accepte ; ↑/↓ parcourent toujours l'historique. L'historique vit pour la " +
    'session de panneau en cours.',
  'panel.console.info.groupSimilar.title': 'Grouper les messages similaires',
  'panel.console.info.groupSimilar.summary':
    'Replie les messages identiques consécutifs en une ligne avec un badge de compteur.',
  'panel.console.info.groupSimilar.description':
    'Les commandes tapées et leurs résultats ne se groupent jamais — la transcription reste littérale.',
  'panel.console.info.evalUserGesture.summary':
    "Exécute les commandes de l'invite comme si un geste utilisateur les avait déclenchées.",
  'panel.console.info.evalUserGesture.description':
    "Les API conditionnées à l'activation utilisateur — ouvrir une fenêtre, écrire dans le presse-papiers, " +
    "plein écran — réussissent depuis l'invite avec ce réglage activé.",
  'panel.console.info.showCorsErrors.summary':
    'Affiche les explications CORS du navigateur — « Access to fetch at … has been blocked by CORS ' +
    'policy: … » — à côté de la sortie de la page.',
  'panel.console.info.showCorsErrors.description':
    "Désactivé ne masque que ces messages d'explication ; la requête bloquée elle-même apparaît toujours dans " +
    'le panneau Network.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Capture arrêtée — cet onglet a quitté la portée du mode débogage. Affichage de la dernière sortie ' + 'capturée.',
  'panel.console.banner.debugOff':
    'Capture arrêtée — le mode débogage est désactivé. Affichage de la dernière sortie capturée.',
  'panel.console.enableDebug': 'Activer le mode débogage',
  'panel.console.empty.noCdp.title': 'La capture de console nécessite le mode débogage',
  'panel.console.empty.noCdp.sub': "L'inspection en mode débogage n'est pas disponible dans ce navigateur.",
  'panel.console.empty.capturing.title': 'Aucune sortie console pour le moment',
  'panel.console.empty.capturing.sub':
    'Les messages de journal et les exceptions non interceptées de cet onglet apparaîtront ici à mesure ' +
    "qu'ils surviennent.",
  'panel.console.empty.debugOff.title': 'Activez le mode débogage pour voir les journaux de la console',
  'panel.console.empty.debugOff.sub':
    'Open Headers capture la sortie console et les exceptions non interceptées de cet onglet tant que le ' +
    'mode débogage est activé.',
  'panel.console.empty.outOfScope.title': 'Cet onglet est hors de la portée du mode débogage',
  'panel.console.empty.outOfScope.sub':
    'Ramenez-le dans la portée depuis le mode débogage — changez la portée ou épinglez cet onglet — pour ' +
    'capturer sa sortie console.',
  'panel.console.noMatch': 'Aucune entrée de console ne correspond à votre filtre.',
  'panel.console.revealedHidden': 'Le message révélé est masqué par le filtre actif',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} message identique',
      many: '{count} messages identiques',
      other: '{count} messages identiques',
    }),
  'panel.console.expandStack': "Déployer la pile d'appels",
  'panel.console.collapseStack': "Replier la pile d'appels",

  // REPL prompt
  'panel.console.prompt.waiting': "En attente d'un contexte JavaScript…",
  'panel.console.prompt.placeholder': 'Exécuter du JavaScript dans le contexte sélectionné',
  'panel.console.prompt.aria': 'Invite de console',
  'panel.console.prompt.previewAria': "Aperçu de l'évaluation anticipée",
} as const satisfies Catalog;
