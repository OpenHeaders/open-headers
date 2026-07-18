/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — French. Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, header names, and every wire token. Option labels reuse
 * the shipped fr panel menus verbatim (`Échecs en premier`,
 * `Outil sélectionné`, `Groupée`/`À plat`, `Croissant`/`Décroissant`,
 * timing view rows). `pied de page` = footer, `barre supérieure` =
 * top bar, following fr/panel.ts.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Afficher la version dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    "Affiche le numéro de version de l'extension dans la barre d'état du panneau DevTools.",
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label':
    'Afficher le sélecteur de thème dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    "Affiche le menu de thème clair/sombre/auto dans la barre d'état du panneau DevTools.",
  'workbench.settings.def.devpanelLayout.footerShowModified.label':
    'Afficher le compte des modifiées dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    "Affiche combien de requêtes vos règles ont réellement modifiées dans la barre d'état du panneau DevTools.",
  'workbench.settings.def.devpanelLayout.footerShowFailed.label':
    'Afficher le compte des échouées dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    "Affiche combien de requêtes ont échoué ou renvoyé un statut d'erreur dans la barre d'état du panneau " +
    'DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label':
    'Afficher le compte des en cache dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    "Affiche combien de requêtes ont été servies depuis le cache dans la barre d'état du panneau DevTools.",
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Afficher la page actuelle dans le pied de page',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    "Étiquette les jalons de timing avec la page qu'ils décrivent dans la barre d'état du panneau DevTools — " +
    'utile quand le journal est conservé sur plusieurs navigations.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Portée du timing du pied de page',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    "Quelle navigation les jalons Finish / DOMContentLoaded / Load de la barre d'état du panneau DevTools " +
    'décrivent. Agrégé couvre toute la chronologie du journal conservé depuis la première navigation ' +
    '(comme le navigateur) ; Page actuelle ne rapporte que la dernière navigation.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Agrégé (toutes les navigations)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load couvrent toute la chronologie depuis la première navigation — le défaut du navigateur.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Page actuelle uniquement',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load ne rapportent que la dernière navigation, ancrée à son démarrage.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Portée du résumé du pied de page',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    "Ce que la barre d'état du panneau DevTools résume. Outil sélectionné suit la fenêtre d'outil dans " +
    'laquelle vous travaillez (Storage, Console et la recherche ont leurs propres lignes de résumé) ; Outil ' +
    'Network uniquement affiche toujours les chiffres Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Outil sélectionné',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    "Le pied de page suit la fenêtre d'outil sélectionnée — Storage, Console et la recherche affichent leurs " +
    'propres résumés ; les autres outils retombent sur la ligne Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Outil Network uniquement',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    "Le pied de page affiche toujours les chiffres Network, quelle que soit la fenêtre d'outil sélectionnée.",
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label':
    'Afficher les boutons de panneaux dans la barre supérieure',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Affiche les icônes de bascule des panneaux gauche / inférieur / droit dans la barre supérieure du panneau ' +
    'DevTools.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label':
    'Afficher le menu de disposition dans la barre supérieure',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    "Affiche le menu de disposition (panneau inférieur pleine largeur, noms des fenêtres d'outils, " +
    "disposition de la barre d'activité) dans la barre supérieure du panneau DevTools.",
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Alignement du panneau inférieur',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    "Où se place le panneau inférieur dans le panneau DevTools. Gauche/droite l'aligne sous une barre " +
    "latérale + l'éditeur ; centré l'imbrique dans la colonne du milieu ; justifié couvre toute la largeur.",
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Centré',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Panneau inférieur imbriqué dans la colonne du milieu',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Gauche',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    "Le panneau inférieur couvre la barre latérale gauche + l'éditeur",
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Droite',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    "Le panneau inférieur couvre l'éditeur + la barre latérale droite",
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Justifié',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Le panneau inférieur couvre toute la largeur du panneau DevTools',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': "Afficher les noms des fenêtres d'outils",
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    "Affiche des libellés texte à côté des icônes de la barre d'activité et des onglets de dock dans le " +
    "panneau DevTools. Désactivé par défaut car le panneau est plus étroit que l'espace de travail.",
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': "Largeur de la barre d'activité gauche",
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    "Largeur de la barre d'activité gauche dans le panneau DevTools quand les noms des fenêtres d'outils sont " +
    'visibles. Verrouillée à 36px en mode icônes seules.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': "Largeur de la barre d'activité droite",
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    "Largeur de la barre d'activité droite dans le panneau DevTools quand les noms des fenêtres d'outils sont " +
    'visibles. Verrouillée à 36px en mode icônes seules.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': "Disposition de la barre d'activité",
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    "Comment la barre d'activité répartit les groupes de fenêtres d'outils du haut et du bas dans le panneau " +
    'DevTools.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proportionnelle',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    "Les groupes du haut et du bas se partagent la barre d'activité 50/50",
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Compacte',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Le groupe du haut se dimensionne au contenu ; celui du bas est épinglé en bas',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Empilée',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'Tous les groupes regroupés en haut avec des séparateurs entre eux',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dynamique',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Les groupes de puces suivent les hauteurs des panneaux adjacents. Les docks fermés se replient au ' +
    "contenu et les voisins actifs absorbent l'espace.",

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Disposition Network',
  'workbench.settings.def.devpanelNetwork.layout.description':
    "Comment le tableau Network absorbe l'espace horizontal. Compacte laisse les colonnes extensibles (Name, " +
    'Waterfall) fléchir pour tenir dans la largeur du panneau, si bien que le tableau ne défile jamais ' +
    'horizontalement ; Large plafonne ces colonnes et défile horizontalement pour le reste.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Compacte',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description':
    'Les colonnes extensibles absorbent la largeur du panneau.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Large',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Largeurs plafonnées, défilement horizontal au besoin.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Disposition Messages',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    "Comment la grille de frames Messages absorbe l'espace horizontal. Compacte laisse la colonne Data " +
    'fléchir pour tenir dans la largeur du volet, si bien que la grille ne défile jamais horizontalement ; ' +
    'Large la plafonne et défile horizontalement au besoin.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Compacte',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'La colonne Data absorbe la largeur du volet.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Large',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Largeurs plafonnées, défilement horizontal au besoin.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': "Afficher l'aperçu de la charge utile",
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    "Affiche le volet d'aperçu de la charge utile sous les grilles Messages / EventStream — la division " +
    "redimensionnable où le frame ou l'événement sélectionné se rend en arbre JSON, texte brut ou visionneuse " +
    'binaire. Désactivez pour donner tout le volet à la grille.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Source du tri Network',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    "Quel côté de l'état de tri est actif. `mode` exécute un des modes de tri composés nommés (Échecs en " +
    "premier / Plus lentes en premier / …). `column` exécute le tri mono-colonne que l'utilisateur a choisi " +
    'en cliquant un en-tête de colonne. Le panneau bascule automatiquement — cliquer un en-tête de colonne ' +
    'règle ceci sur `column` ; choisir un mode dans le menu Vue le règle sur `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Mode',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': 'Utiliser un mode de tri composé nommé.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Colonne',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    "Utiliser le tri mono-colonne cliqué par l'utilisateur.",
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Personnalisé (imbriqué)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    "Utiliser la chaîne de tri multi-clés construite par l'utilisateur.",
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Mode de tri Network',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Ordre de tri composé nommé — axe principal puis arrivée en départage. Actif quand la source du tri = ' + '`mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Échecs en premier',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Échouées → en attente → redirigées → réussies.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Plus lentes en premier',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Durée la plus longue en premier.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Plus volumineuses en premier',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description':
    'Octets transférés les plus gros en premier.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Priorité du navigateur',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Priorité rapportée Highest → Lowest.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'Par type de ressource',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Regroupées par type de ressource, arrivée au sein de chaque type.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'Par domaine',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    "Regroupées par nom d'hôte, arrivée au sein de chaque domaine.",
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Modifiées par une règle en premier',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Règles appliquées en premier, arrivée au sein de chaque groupe.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Colonne de tri Network',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Quelle colonne pilote le tri par clic de colonne. Actif quand la source du tri = `column`. Cliquer un ' +
    'en-tête de colonne met cette valeur à jour.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Chronologie selon la métrique Waterfall active (heure de début par défaut).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    "Numéro de requête — l'ordre de découverte des requêtes.",
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'Méthode HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': "Dernier segment de l'URL.",
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Chemin + requête.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'URL complète.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Code de statut de la réponse.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'Version HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': "Partie hôte de l'URL.",
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'IP du serveur.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Type de ressource.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'Ce qui a déclenché la requête.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Nombre de cookies de requête.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'Nombre de Set-Cookie de la réponse.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Octets transférés.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Durée totale de la requête.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Priorité attribuée par le navigateur.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Sens du tri Network',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Ordre croissant ou décroissant pour la colonne de tri Network actuelle.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Croissant',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Plus petit en premier.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Décroissant',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Plus grand en premier.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Métrique Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Quel temps la colonne Waterfall trie et dessine. Start / Response / End time placent les barres sur une ' +
    'chronologie absolue ; Total duration et Latency alignent les barres sur zéro pour comparer directement ' +
    'les longueurs.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'Quand la requête a démarré.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'Quand le premier octet de réponse est arrivé.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description':
    "Quand la requête s'est terminée.",
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'Combien de temps la requête a pris de bout en bout.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    "Temps jusqu'au premier octet de réponse.",
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Afficher les points de déclenchement de règles',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Affiche la colonne de tête de 14px portant le point coloré qui marque les correspondances de règles ' +
    "(plein = une règle s'est réellement appliquée, creux = inféré). Désactivez pour récupérer les pixels " +
    'horizontaux sur les volets denses.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Valeurs Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'Quand imprimer la ou les valeurs de la métrique Waterfall active sur la barre — la puce Start / Response ' +
    '/ End time pour les métriques de chronologie, ou les libellés attente / téléchargement pour Total ' +
    'duration et Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Toujours',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description':
    'Garder la puce de valeur visible.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'Au survol',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Révéler la puce de valeur au survol de la ligne.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Désactivé',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Masquer la puce de valeur.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Format des valeurs Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    "Comment la valeur d'une métrique de chronologie se lit : Relatif est le décalage depuis la première " +
    "requête en vue ; Horodatage est l'instant absolu à l'horloge. Total duration et Latency restent des " +
    'durées dans tous les cas.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relatif',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Décalage depuis la première requête en vue.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Horodatage',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    "Instant absolu à l'horloge.",
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Fuseau horaire des horodatages Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Fuseau horaire du format de valeur Horodatage — heure locale ou UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Local',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Votre fuseau horaire local.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Temps universel coordonné.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Expliquer la valeur Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'Dans le popover de survol de la Waterfall, badge et met en évidence les lignes de phase qui composent le ' +
    'total et affiche leur somme en formule. Aide purement visuelle — ne change aucune valeur.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Disposition du popover Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Orientation du détail de timing au survol de la Waterfall. Compact empile les étapes le long du popover ' +
    '; Large pose la même échelle sur un axe de temps ; Auto choisit selon la largeur du panneau — large sur ' +
    'un panneau ancré en bas, compact sur un panneau étroit (ancré sur le côté).',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Étapes empilées le long du popover.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Large',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Étapes posées sur un axe de temps horizontal.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Large quand le panneau est large, sinon compact.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Disposition Headers',
  'workbench.settings.def.devpanelHeaders.layout.description':
    "Comment les lignes d'en-têtes sont organisées dans les sections Requête/Réponse. Groupée range les " +
    "lignes par catégorie (Auth, CORS, Caching, …) ; À plat rend une seule liste dans l'ordre de tri choisi.",
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Groupée',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Lignes rangées par catégorie.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'À plat',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Liste unique, sans titres de catégorie (style Chrome).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Tri Headers',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Ordre des lignes dans chaque liste (et dans chaque groupe, en disposition groupée). Original préserve ' +
    "l'ordre dans lequel le serveur a envoyé les en-têtes (ordre HAR) ; A → Z trie par nom ; Modifiés par une " +
    'règle en premier fait remonter les lignes modifiées par une règle.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'Ordre HAR.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alphabétique.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Modifiés par une règle en premier',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description':
    'Lignes modifiées par une règle en haut.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': "Casse des noms d'en-têtes",
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    "Comment les noms d'en-têtes sont affichés. Train-Case canonise chaque nom (`Content-Type`, " +
    '`Set-Cookie`, `ETag`) pour coller aux DevTools de Chrome/Firefox — plus facile à parcourir. Originale ' +
    'garde la casse brute envoyée par le serveur (HTTP/2+ met tout en minuscules sur le fil).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Originale',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Exactement ce que le serveur a envoyé (souvent en minuscules sur HTTP/2+).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Afficher les étiquettes de valeur',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    "Affiche les étiquettes par valeur sur les lignes d'en-têtes (Cache-Control / Set-Cookie / HSTS / décodage " +
    'JWT, …). Désactivez pour une vue resserrée, valeurs seules.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Afficher les suggestions',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    "Affiche les cartes d'avertissement actionnables en haut de l'onglet Headers (CORS mal configuré, " +
    'CSP/HSTS manquant, cookies non sécurisés, JWT expiré, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Masquer les en-têtes de bruit',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Replie les en-têtes à faible signal (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). ' +
    "L'indice sous chaque section liste les noms masqués au survol.",
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Modifiés par une règle uniquement',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Affiche uniquement les en-têtes ajoutés, modifiés ou supprimés par une règle Open Headers.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'En-têtes de sécurité uniquement',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Affiche uniquement les en-têtes liés à la sécurité (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'En-têtes substituables uniquement',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Masque les en-têtes protégés que le navigateur ne laisse pas les règles substituer (host, ' +
    'content-length, sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Tri des enfants Initiator',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    "Comment les requêtes enfants sont ordonnées dans la chaîne d'initiateurs. Ordre d'initiateur préserve le " +
    "parcours original du graphe d'initiateurs ; Chronologique ordonne par heure de requête ; Plus grand " +
    'sous-arbre place le sous-arbre le plus lourd en premier.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': "Ordre d'initiateur",
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'Tel que découvert.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Chronologique',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'Par heure de requête.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Plus grand sous-arbre',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description':
    'Sous-arbres les plus lourds en premier.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Afficher les suggestions',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    "Affiche les encarts actionnables en haut de l'onglet Initiator (sous-requêtes échouées, hôte dominant, " +
    'part de tiers, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Échecs uniquement',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    "Affiche uniquement les lignes échouées ou bloquées dans la chaîne d'initiateurs.",
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'Tiers uniquement',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    "Affiche uniquement les lignes d'origines différentes de l'origine de la page.",

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Tri Cookies',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    "Ordre des lignes dans chaque section de cookies. Original préserve l'ordre utilisé par le serveur / la " +
    'requête ; A → Z trie par nom ; Size trie par taille de cookie sérialisé ; Expires place les expirations ' +
    'les plus proches en premier (Session en dernier).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': "Tel qu'envoyé / défini.",
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alphabétique par nom.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Cookie le plus gros en premier.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Expiration la plus proche en premier.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Format Expires',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    "Comment l'expiration des cookies est rendue. Relatif affiche « dans 2 j », « il y a 30 s », " +
    '« Session » ; Absolu affiche la date UTC analysée.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relatif',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absolu',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'Date UTC.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Afficher les étiquettes',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Affiche les étiquettes de rôle / cycle de vie / contexte à côté de chaque nom de cookie (auth ? / ' +
    "suivi ? / préf / vient d'être défini / abandonné / tiers / partitionné / …). Désactivez pour une vue " +
    'resserrée, colonnes seules.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Afficher les suggestions',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    "Affiche les cartes d'avertissement actionnables en haut de l'onglet Cookies (SameSite=None sans Secure, " +
    'violations de préfixe __Host- / __Secure-, cookies trop gros, expirés mais envoyés, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Décoder les valeurs URL-encodées',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Affiche les valeurs de cookies avec le pourcent-encodage décodé (« Europe%2FMadrid » → ' +
    '« Europe/Madrid »). Survolez la valeur pour voir la forme brute.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Grouper par rôle',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Groupe les cookies par rôle inféré dans chaque section — Auth et session en premier, puis Fonctionnels, ' +
    'Préférences, Analytique et suivi. Piloté par heuristique ; les puces de rôle (auth ? / suivi ? / préf) ' +
    "portent le point d'interrogation en rappel.",
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Afficher les cookies de requête filtrés',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Reflète la bascule « show filtered out request cookies » de Chrome — liste aussi les cookies de la ' +
    "réserve qui n'ont pas été envoyés sur cette requête pour cause de non-correspondance de chemin / Secure " +
    '/ SameSite / expiration.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Problèmes uniquement',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Affiche uniquement les cookies ayant déclenché un avertissement — Secure manquant, violation de préfixe, ' +
    'expiré mais envoyé, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'Tiers uniquement',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    "Affiche uniquement les cookies dont le domaine est cross-site par rapport à l'origine du cadre supérieur.",
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Modifiés par une règle uniquement',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Affiche uniquement les cookies dont la ligne Cookie / Set-Cookie a été ajoutée, modifiée ou supprimée ' +
    'par une règle.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Afficher les suggestions',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    "Affiche les cartes goulot d'étranglement + avertissements par phase en haut de l'onglet Timing. " +
    'Désactivez pour une vue chiffres seuls.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Afficher la bande de contexte',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Affiche la rangée de puces protocole / connexion / cache / priorité / démarrage / IP serveur au-dessus ' +
    'du détail des phases.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Afficher le détail des phases',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Affiche les sections Resource Scheduling / Connection Start / Request-Response avec les lignes de ' +
    'millisecondes par phase.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Afficher la barre de timing',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Affiche la barre segmentée proportionnelle avec la légende par phase (et la ligne Total en dessous).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Afficher Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    "Affiche les métriques analysées de l'en-tête de réponse `Server-Timing` quand le serveur en a envoyé.",
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Afficher les répétitions de la session',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    "Affiche la comparaison avec l'occurrence la plus rapide / médiane / la plus lente de cette même URL dans " +
    'la session de panneau actuelle.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Afficher le débit de transfert',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Affiche le débit effectif de Content-Download (octets du corps ÷ temps de téléchargement) quand la ' +
    'taille et la phase de réception sont toutes deux connues.',
} as const satisfies Catalog;
