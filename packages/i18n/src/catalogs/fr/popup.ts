/**
 * Popup namespace — French. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'Impossible de changer de vue',
  'popup.header.switchToSidePanel': 'Passer en panneau latéral (reste ouvert pendant la navigation)',
  'popup.header.switchToPopup': "Passer en mode popup (clic sur la barre d'outils)",
  'popup.header.rulesResumed': 'Exécution des règles reprise',
  'popup.header.rulesPaused': 'Exécution des règles suspendue',
  'popup.header.rulesLabel': 'Règles',
  'popup.header.resumeRules': "Reprendre l'exécution des règles",
  'popup.header.pauseRules': 'Suspendre toutes les règles (préserve les réglages individuels)',
  'popup.header.openSettings': 'Ouvrir les paramètres',
  'popup.header.notifications': 'Notifications',
  'popup.header.openNotifications': 'Ouvrir les notifications',
  'popup.header.activeWorkspace': 'Espace de travail actif : {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Actif',
  'popup.status.paused': 'Suspendu',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'Comment accéder à nos outils de développement navigateur surpuissants.',
  'popup.footer.networkDebug': 'Débogage réseau.',
  'popup.footer.tagline': 'Comme il se doit',
  'popup.footer.keyboardShortcuts': 'Raccourcis clavier',
  'popup.footer.systemStatus': 'Système',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'Bureau en observation',
  'popup.desktopWatch.tooltip':
    "L'application de bureau Open Headers observe actuellement ce navigateur dans son panneau Trafic. Cliquez pour " +
    "ouvrir les paramètres — « Laisser l'application de bureau voir ce navigateur » est l'interrupteur.",
  'popup.desktopWatch.aria': "L'application de bureau observe ce navigateur — ouvrir les paramètres",

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'Cette page',
  'popup.tabs.allRules': 'Toutes les règles',
  'popup.tabs.collections': 'Collections',
  'popup.tabs.openWorkspaceEditor': "Ouvrir l'éditeur d'espace de travail complet",
  'popup.tabs.workspace': 'Espace de travail',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': 'Supprimer « {name} » ?',
  'popup.deleteConfirm.confirm': 'confirmer',
  'popup.deleteConfirm.cancel': 'annuler',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Tout rechercher...',
  'popup.table.sortOrder': 'Ordre de tri',
  'popup.table.sortOrderHeading': 'ORDRE DE TRI',
  'popup.table.sortByStatus': 'Par statut',
  'popup.table.sortByPriority': 'Par priorité',
  'popup.table.sortByColumn': 'Par colonne',
  'popup.table.sortWorkspaceOrder': "Ordre de l'espace de travail",
  'popup.table.sortWorkspaceOrderHint': "Suit l'ordre de l'arborescence de la barre latérale de l'espace de travail",
  'popup.table.sortByColumnHint': 'Trié par {column} — cliquez sur une option ci-dessus pour réinitialiser',
  'popup.table.sortByPriorityHint': 'Bloquer → Rediriger → Paramètre → En-tête → Injecter · A-Z au sein de chaque type',
  'popup.table.sortByStatusHintAll':
    'Actives → Suspendues → Désactivées → Brouillons · priorité au sein de chaque groupe',
  'popup.table.sortByStatusHintThisPage': 'Actives → Suspendues → Désactivées · priorité au sein de chaque groupe',
  'popup.table.sortByStatusHintCollections': 'Actives → Suspendues · A-Z au sein de chaque groupe',
  'popup.table.columnName': 'Nom',
  'popup.table.columnDetails': 'Détails',
  'popup.table.columnConditions': 'Conditions',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': "Échec de l'activation/désactivation de la règle",
  'popup.rule.deleted': 'Règle supprimée',
  'popup.rule.deleteFailed': 'Échec de la suppression de la règle',
  'popup.rule.edit': 'Modifier la règle',
  'popup.rule.delete': 'Supprimer la règle',
  'popup.rule.deleteOk': 'Supprimer',
  'popup.rule.notConnected': 'Application non connectée',
  'popup.rule.desktopTag': 'Desktop',
  'popup.rule.comingSoon': 'bientôt disponible',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Règles',
  'popup.rules.activeSummary': '{active} sur {total} actives',
  'popup.rules.draftSuffix': ', {count} en brouillon',
  'popup.rules.pausedByCollection': '{count} suspendues par leur collection',
  'popup.rules.addRule': 'Ajouter une règle',
  'popup.rules.addRuleTooltip': 'Ajouter une règle — recherche parmi les types et les modèles',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} règle', many: '{count} règles', other: '{count} règles' })} correspondent`,
  'popup.rules.emptyNoMatch': 'Aucune règle correspondante',
  'popup.rules.emptyNone': "Aucune règle pour l'instant",
  'popup.rules.emptyHint': 'Cliquez sur « Ajouter une règle » pour modifier les requêtes du navigateur en direct',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Collections',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { one: '{count} collection', many: '{count} collections', other: '{count} collections' })}, ${plural(
      locale,
      Number(rules),
      { one: '{count} règle', many: '{count} règles', other: '{count} règles' },
    )}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} collection', many: '{count} collections', other: '{count} collections' })} correspondent`,
  'popup.collections.emptyNoMatch': 'Aucune collection correspondante',
  'popup.collections.emptyNone': 'Aucune collection',
  'popup.collections.emptyHint':
    "Créez des règles dans l'éditeur d'espace de travail pour les organiser en collections",
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${enabled} sur ${plural(locale, Number(total), { one: '{count} règle', many: '{count} règles', other: '{count} règles' })} activées`,
  'popup.collections.pausedEnabledSummary': 'Suspendue · {enabled} sur {total} activées',
  'popup.collections.resumeTooltip': 'Reprendre — épingle {count} règles actives (outrepasse le parent si nécessaire)',
  'popup.collections.pauseTooltip': 'Suspendre — suspend {count} règles sans changer les réglages individuels',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'Tous les domaines',
  'popup.conditions.none': 'Aucune condition',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Domaine',
  'popup.conditions.short.excludeRequestDomains': 'Excl domaine',
  'popup.conditions.short.initiatorDomains': 'Origine',
  'popup.conditions.short.excludeInitiatorDomains': 'Excl origine',
  'popup.conditions.short.requestMethods': 'Méthode',
  'popup.conditions.short.excludeRequestMethods': 'Excl méthode',
  'popup.conditions.short.resourceTypes': 'Ressource',
  'popup.conditions.short.excludeResourceTypes': 'Excl ressource',
  'popup.conditions.short.domainType': 'Type de domaine',
  'popup.conditions.short.responseHeader': 'En-tête rép.',
  'popup.conditions.short.excludeResponseHeader': 'Excl en-tête rép.',
  'popup.conditions.full.urlFilter': "Motif d'URL",
  'popup.conditions.full.urlRegex': "Regex d'URL",
  'popup.conditions.full.requestDomains': 'Domaines',
  'popup.conditions.full.excludeRequestDomains': 'Excl domaines',
  'popup.conditions.full.initiatorDomains': 'Initiateur',
  'popup.conditions.full.excludeInitiatorDomains': 'Excl initiateur',
  'popup.conditions.full.requestMethods': 'Méthodes',
  'popup.conditions.full.excludeRequestMethods': 'Excl méthodes',
  'popup.conditions.full.resourceTypes': 'Ressources',
  'popup.conditions.full.excludeResourceTypes': 'Excl ressources',
  'popup.conditions.full.domainType': 'Type de domaine',
  'popup.conditions.full.responseHeader': 'En-tête de réponse',
  'popup.conditions.full.excludeResponseHeader': 'Excl en-tête de réponse',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Nom',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Nombre',
  'popup.actionDetail.type': 'Type',
  'popup.actionDetail.duration': 'Durée',
  'popup.actionDetail.format': 'Format',
  'popup.actionDetail.status': 'Statut',
  'popup.actionDetail.value': 'Valeur',
  'popup.actionDetail.position': 'Position',
  'popup.actionDetail.body': 'Corps',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Libellé',
  'popup.actionDetail.headers': 'En-têtes',
  'popup.actionDetail.params': 'Paramètres',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': "Chargement des informations de l'onglet actuel...",
  'popup.thisPage.noTab': "Impossible d'obtenir les informations de l'onglet actuel",
  'popup.thisPage.columnMatch': 'Correspondance',
  'popup.thisPage.expandHeaderBadgeHint': "Cliquez sur le badge d'une ligne pour voir les requêtes correspondantes",
  'popup.thisPage.expandHeaderDocsHint': "Cliquez sur l'icône ci-dessous pour voir la documentation",
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })} correspondent à « ${query} » — cliquez pour développer`,
  'popup.thisPage.badgeNone': "Aucune requête correspondante pour l'instant — cliquez pour développer",
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} requête correspondante', many: '{count} requêtes correspondantes', other: '{count} requêtes correspondantes' })}, toutes servies depuis le cache (silencieuses) — cliquez pour développer`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { one: '{count} requête correspondante déclenchée', many: '{count} requêtes correspondantes déclenchées', other: '{count} requêtes correspondantes déclenchées' })} + ${silent} silencieuses (en cache) — cliquez pour développer`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} requête correspondante', many: '{count} requêtes correspondantes', other: '{count} requêtes correspondantes' })} — cliquez pour développer`,
  'popup.thisPage.systemPage': 'Page système',
  'popup.thisPage.systemPageHint': "Les règles d'en-têtes ne s'appliquent pas aux pages système du navigateur",
  'popup.thisPage.emptyNoRules': 'Aucune règle ne correspond à cette page',
  'popup.thisPage.emptyNoRulesHint': "Aucune règle n'est configurée pour ce domaine",
  'popup.thisPage.ruleDisabled': 'La règle est désactivée',
  'popup.thisPage.rulePausedByGroup': 'La règle est suspendue par sa collection ou son dossier',
  'popup.thisPage.zeroRelated':
    "La règle cible un domaine associé — aucune requête vers ce domaine n'a encore été observée. Elle se déclenchera si la page en émet une.",
  'popup.thisPage.zeroPage':
    "Le motif correspond à cette page mais aucune requête correspondante n'a encore été observée. Interagissez avec la page ou rechargez-la pour les déclencher.",
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête correspondante',
      many: 'Les {count} requêtes correspondantes',
      other: 'Les {count} requêtes correspondantes',
    }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} sur {total} requêtes correspondantes',
  'popup.thisPage.shadowTooltip':
    "{prefix} : interrompue(s) par « {name} » (règle de blocage plus prioritaire) — cette règle n'a donc aucun effet visible dessus. Expérimental : la détection d'occultation peut sur- ou sous-évaluer. Désactivez-la dans les paramètres pour masquer.",
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `Le script a confirmé ${plural(locale, Number(count), { one: '{count} déclenchement', many: '{count} déclenchements', other: '{count} déclenchements' })} sur cette page (vérité terrain via l'injection dans la page).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `Correspondance de ${plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })} par l'URL, mais le rapporteur de script dans la page n'a rien confirmé. Causes courantes : une Content-Security-Policy stricte bloquant l'injection, ou un type de ressource (feuille de style, image, lien de manifeste) qui contourne l'interception fetch/XHR.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `Le motif a fait correspondre ${plural(locale, Number(count), { one: '{count} sous-ressource en cache', many: '{count} sous-ressources en cache', other: '{count} sous-ressources en cache' })} — l'action n'a pas pu s'exécuter car la réponse a contourné le réseau. Rechargez en ignorant le cache pour forcer une requête fraîche.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `Correspondance de ${plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })} sur cette page. Le declarativeNetRequest de Chrome n'indique pas quelle règle gagne quand plusieurs correspondent — nous observons des correspondances d'URL, pas les arbitrages.`,
  'popup.thisPage.pausedTagTooltip': 'Collection ou dossier suspendu — règle non appliquée',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} règle suspendue', many: '{count} règles suspendues', other: '{count} règles suspendues' })} par leur collection`,
  'popup.thisPage.firing': '{count} déclenchées',
  'popup.thisPage.silentCached': '{count} silencieuses (en cache)',
  'popup.thisPage.related': '{count} associées',
  'popup.thisPage.liveMonitoring': 'En direct — surveillance des requêtes',
  'popup.thisPage.visibleResourceTypes': 'TYPES DE RESSOURCES VISIBLES',
  'popup.thisPage.showAll': 'Tout afficher',
  'popup.thisPage.filterResourceTypes': 'Filtrer les types de ressources',
  'popup.thisPage.filterResourceTypesCount': 'Filtrer les types de ressources ({shown} sur {total} affichés)',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête silencieuse (en cache)',
      many: '{count} requêtes silencieuses (en cache)',
      other: '{count} requêtes silencieuses (en cache)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })} (${silent} silencieuses)`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} règle', many: '{count} règles', other: '{count} règles' })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })}`,
  'popup.thisPage.matchedJoin': '{parts} correspondantes',
  'popup.thisPage.copyTsv': 'Copier les requêtes au format TSV',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Heure',
  'popup.matched.columnUrl': 'URL de la requête',
  'popup.matched.columnType': 'Type',
  'popup.matched.columnDelivery': 'Livraison',
  'popup.matched.columnEvidence': 'Preuve',
  'popup.matched.columnPattern': 'Motif',
  'popup.matched.matchedBy': 'correspond via',
  'popup.matched.deliveryLive': 'direct',
  'popup.matched.deliveryCached': 'cache',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip':
    "La requête est partie sur le réseau durant cette session ; la réponse n'a pas été servie depuis le cache.",
  'popup.matched.deliveryCachedTip':
    "La réponse a été servie depuis le cache HTTP de Chrome. Votre règle s'est appliquée lors du chargement d'origine de cette réponse ou lors de la revalidation.",
  'popup.matched.deliverySwTip':
    "Un service worker a intercepté la requête. L'application de votre règle dépend de ce que le service worker a fait ensuite.",
  'popup.matched.evidenceShadowed': 'occultée',
  'popup.matched.evidenceShadowedTip':
    "Cette requête a été interrompue par « {name} » (règle de blocage plus prioritaire). Cette règle ne s'est jamais exécutée dessus.",
  'popup.matched.evidenceConfirmed': 'confirmée',
  'popup.matched.evidenceConfirmedTip':
    "Le script a confirmé ce déclenchement depuis l'injection dans la page — vérité terrain : la règle s'est exécutée.",
  'popup.matched.evidenceFallback': 'indirecte',
  'popup.matched.evidenceFallbackTip':
    "Correspondance par l'URL, mais le rapporteur de script dans la page n'a rien confirmé. Causes courantes : une Content-Security-Policy stricte bloquant l'injection MAIN-world, ou un type de ressource (feuille de style, image, lien de manifeste) qui contourne l'interception fetch/XHR.",
  'popup.matched.evidenceSilent': 'silencieuse',
  'popup.matched.evidenceSilentTip':
    "Le motif correspond à cette sous-ressource mais la réponse a été servie depuis le cache / un service worker / le bfcache, l'action de la règle n'a donc pas pu s'exécuter. Rechargez en ignorant le cache pour forcer une requête fraîche.",
  'popup.matched.evidenceMatched': 'correspondante',
  'popup.matched.evidenceMatchedTip':
    "L'URL correspond aux conditions de cette règle. Le declarativeNetRequest de Chrome n'indique pas quelle règle gagne l'arbitrage — nous observons des correspondances d'URL, pas l'exécution.",
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} sur ${plural(locale, Number(total), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' })} pour « ${query} »`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} requête correspondante', many: '{count} requêtes correspondantes', other: '{count} requêtes correspondantes' })}`,
  'popup.matched.emptySearch':
    'Aucune requête correspondante ne contient « {query} ». Effacez ou élargissez la recherche pour voir toutes les correspondances.',
  'popup.matched.emptyRelated':
    'La règle cible un domaine associé — les correspondances apparaîtront si la page émet des requêtes vers ce domaine.',
  'popup.matched.emptyPage':
    "Le motif correspond à cette page. Les correspondances apparaîtront quand la page émettra des requêtes qui s'y conforment — interagissez avec la page ou rechargez-la pour les déclencher.",
  'popup.matched.emptyNone': "Aucune requête correspondante pour l'instant — rechargez la page pour capturer.",

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'En-tête',
  'popup.ruleType.block': 'Bloquer',
  'popup.ruleType.redirect': 'Rediriger',
  'popup.ruleType.queryParam': 'Paramètre de requête',
  'popup.ruleType.inject': 'Injecter',
  'popup.ruleType.requestBody': 'Requête API',
  'popup.ruleType.delay': 'Délai',
  'popup.ruleType.response': 'Réponse API',
  'popup.ruleType.headerDesc': 'Modifier les en-têtes HTTP',
  'popup.ruleType.blockDesc': 'Bloquer des requêtes',
  'popup.ruleType.redirectDesc': 'Rediriger des requêtes',
  'popup.ruleType.queryParamDesc': 'Modifier les paramètres de requête',
  'popup.ruleType.injectDesc': 'Injecter des scripts ou du CSS',
  'popup.ruleType.requestBodyDesc': 'Modifier le corps des requêtes API (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Retarder la réponse',
  'popup.ruleType.responseDesc': 'Simuler ou modifier une réponse API (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': "Correspond directement à l'URL de la page",
  'popup.resourceType.subFrameTip': 'Appliqué à un iframe chargé par cette page',
  'popup.resourceType.xhrTip': 'Appliqué aux appels fetch() et XMLHttpRequest',
  'popup.resourceType.scriptTip': 'Appliqué aux ressources de script',
  'popup.resourceType.stylesheetTip': 'Appliqué aux feuilles de style',
  'popup.resourceType.imageTip': 'Appliqué aux images',
  'popup.resourceType.fontTip': 'Appliqué aux fichiers de polices',
  'popup.resourceType.mediaTip': 'Appliqué aux ressources audio/vidéo',
  'popup.resourceType.websocketTip': 'Appliqué aux connexions WebSocket',
  'popup.resourceType.pingTip': 'Appliqué aux requêtes ping/beacon',
  'popup.resourceType.otherTip': 'Appliqué aux autres ressources',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Règle vierge',
  'popup.palette.searchPlaceholder': 'Rechercher types de règles et modèles…',
  'popup.palette.noMatches': 'Aucun résultat pour « {query} »',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Raccourcis clavier',
  'popup.shortcuts.press': 'appuyez sur',
  'popup.shortcuts.or': 'ou',
  'popup.shortcuts.toClose': 'pour fermer',
  'popup.shortcuts.groupNavigation': 'Navigation',
  'popup.shortcuts.groupActions': 'Actions',
  'popup.shortcuts.groupRow': 'Lignes du tableau',
  'popup.shortcuts.groupBrowser': 'Navigateur',
  'popup.shortcuts.groupTour': 'Visite guidée',
  'popup.shortcuts.openExtension': "Ouvrir l'extension",
  'popup.shortcuts.customize': "Personnaliser le raccourci de l'extension ↗",
  'popup.shortcuts.toggleDebugMode': 'Basculer le mode débogage',
  'popup.shortcuts.tabThisPage': 'Onglet Cette page',
  'popup.shortcuts.tabAllRules': 'Onglet Toutes les règles',
  'popup.shortcuts.tabCollections': 'Onglet Collections',
  'popup.shortcuts.focusSearch': 'Activer la recherche',
  'popup.shortcuts.prevPage': 'Page précédente',
  'popup.shortcuts.nextPage': 'Page suivante',
  'popup.shortcuts.addRule': 'Ajouter une règle',
  'popup.shortcuts.openWorkspace': "Ouvrir l'espace de travail",
  'popup.shortcuts.openSettings': 'Ouvrir les paramètres',
  'popup.shortcuts.toggleSurface': 'Basculer popup / panneau latéral',
  'popup.shortcuts.toggleRulesPause': 'Suspendre / reprendre toutes les règles',
  'popup.shortcuts.togglePauseFocused': 'Suspendre / reprendre la collection ou le dossier',
  'popup.shortcuts.toggleOptionsMenu': 'Menu des options',
  'popup.shortcuts.cycleTheme': 'Changer de thème',
  'popup.shortcuts.toggleCompactMode': 'Mode compact',
  'popup.shortcuts.toggleShortcutsHelp': 'Ce panneau',
  'popup.shortcuts.moveDown': 'Descendre',
  'popup.shortcuts.moveUp': 'Monter',
  'popup.shortcuts.expandRow': 'Développer / entrer dans les sous-lignes',
  'popup.shortcuts.collapseRow': 'Replier / sortir des sous-lignes',
  'popup.shortcuts.toggleRow': 'Activer / désactiver',
  'popup.shortcuts.editRow': 'Modifier la règle',
  'popup.shortcuts.copyValue': 'Copier la valeur',
  'popup.shortcuts.deleteRow': 'Supprimer (appuyez deux fois)',
  'popup.shortcuts.openTourGuide': 'Ouvrir la visite guidée',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Étape {current} sur {total}',
  'popup.tour.previous': 'Précédent',
  'popup.tour.next': 'Suivant',
  'popup.tour.finish': 'Terminer',
  'popup.tour.welcomeTitle': 'Bienvenue dans Open Headers',
  'popup.tour.welcomeSubtitle': 'Interceptez et modifiez le trafic HTTP en temps réel.',
  'popup.tour.modify': 'Modifier',
  'popup.tour.modifyDesc': "En-têtes, cookies, jetons d'authentification, CORS, charges utiles",
  'popup.tour.route': 'Router',
  'popup.tour.routeDesc': 'Redirigez des requêtes, bloquez des traqueurs, réécrivez des URL',
  'popup.tour.debug': 'Déboguer',
  'popup.tour.debugDesc': 'Inspectez les requêtes en direct, injectez des scripts, remplacez les réponses',
  'popup.tour.migrateSwitching': 'Vous venez de',
  'popup.tour.migrateOr': 'ou',
  'popup.tour.migrateButton': 'Migrer depuis un autre outil',
  'popup.tour.tabsTitle': "Passer d'un onglet à l'autre",
  'popup.tour.tabsSubtitle': 'Appuyez sur un chiffre pour changer instantanément.',
  'popup.tour.thisPageHint': "— les règles correspondant à l'onglet actuel",
  'popup.tour.allRulesHint': '— toutes les règles que vous avez créées',
  'popup.tour.tagsLabel': 'Étiquettes',
  'popup.tour.tagsHint': '— organisez et suspendez des groupes',
  'popup.tour.workspaceTitle': 'Votre espace de travail',
  'popup.tour.workspaceSubtitle': "L'éditeur complet — s'ouvre dans son propre onglet.",
  'popup.tour.workspaceRequests': 'Client API',
  'popup.tour.workspaceRequestsHint': '— créez, envoyez et enregistrez des requêtes API',
  'popup.tour.workspaceWorkflows': 'Workflows',
  'popup.tour.workspaceWorkflowsHint': '— enchaînez des requêtes en exécutions automatisées',
  'popup.tour.workspaceEnvs': 'Environnements et variables',
  'popup.tour.workspaceEnvsHint': "— plus imports, règles et synchronisation d'équipe",
  'popup.tour.navTitle': 'Parcourir et naviguer dans les règles',
  'popup.tour.navSubtitle': 'Naviguez entre les lignes au clavier',
  'popup.tour.keyMove': 'Déplacer',
  'popup.tour.keyExpand': 'Développer',
  'popup.tour.keyToggle': 'Basculer',
  'popup.tour.keyEdit': 'Modifier',
  'popup.tour.keyCopy': 'Copier',
  'popup.tour.keyDelete': 'Supprimer',
  'popup.tour.devtoolsTitle': 'Déboguer le réseau dans les DevTools',
  'popup.tour.findThePrefix': "Trouvez l'onglet",
  'popup.tour.findTheSuffix': 'dans les DevTools :',
  'popup.tour.devtoolsHint': 'Cliquez sur ce bouton à tout moment pour la configuration.',
  'popup.tour.shortcutsTitle': 'Tous les raccourcis clavier',
  'popup.tour.shortcutsSubtitle': 'Le popup se pilote entièrement au clavier.',
  'popup.tour.pressLabel': 'Appuyez sur',
  'popup.tour.shortcutsHint': 'à tout moment pour voir tous les raccourcis',
  'popup.tour.debugModeTitle': 'Mode débogage',
  'popup.tour.debugModeSubtitle': 'Contrôle total du trafic navigateur en direct.',
  'popup.tour.debugModeReqRes': 'Requêtes et réponses',
  'popup.tour.debugModeReqResHint': '— réécrivez en-têtes, corps et codes de statut en direct',
  'popup.tour.debugModeStreams': 'WebSockets et SSE',
  'popup.tour.debugModeStreamsHint': '— inspectez et modifiez les messages diffusés en continu',
  'popup.tour.debugModeScripts': 'Scripts et stockage',
  'popup.tour.debugModeScriptsHint': '— injectez des scripts, inspectez cookies et stockage',
  'popup.tour.statusTitle': 'État du système',
  'popup.tour.statusSubtitle':
    'Cliquez sur le point pour un bilan de santé : Sync, Règles, Requêtes, Permissions, Secrets et Live.',
  'popup.tour.statusGreen': 'Vert',
  'popup.tour.statusGreenDesc': '— tout est sain',
  'popup.tour.statusYellow': 'Jaune',
  'popup.tour.statusYellowDesc': '— un sous-système signale un avertissement',
  'popup.tour.statusRed': 'Rouge',
  'popup.tour.statusRedDesc': '— un sous-système est en échec',
  'popup.tour.growTitle': 'Aidez-nous à grandir',
  'popup.tour.growSubtitle': 'Aidez-nous à grandir et à toucher plus de développeurs.',
  'popup.tour.starGithub': 'Donnez-nous une étoile sur GitHub',
  'popup.tour.recommend': 'Recommandez-nous à vos amis et collègues',
  'popup.tour.growHint': 'Retrouvez tout cela à tout moment sous la cloche.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Modifiez en-têtes, requêtes et réponses',
  'popup.devtools.featureTabs': 'Panneaux de métadonnées de requête multi-onglets',
  'popup.devtools.featureSearch': 'Recherche et filtres avancés',
  'popup.devtools.featureDock': 'Panneaux latéraux à glisser-déposer',
  'popup.devtools.addOverride': '+ Ajouter/Remplacer',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Débogage réseau',
  'popup.debug.step1': 'Ouvrez les DevTools du navigateur',
  'popup.debug.step1a': 'Sur une page normale, p. ex.',
  'popup.debug.notPrefix': 'Pas',
  'popup.debug.notSuffix': 'ni un nouvel onglet (les extensions y sont bloquées).',
  'popup.debug.onPlatform': 'sur {platform}',
  'popup.debug.menuHintSafari':
    "Activez d'abord Développement — Safari → Réglages → Avancés → « Afficher les fonctionnalités pour les développeurs web ».",
  'popup.debug.clickThePrefix': "Cliquez sur l'onglet",
  'popup.debug.clickTheSuffix': '',
  'popup.debug.overflowPrefix': 'Dernier onglet — il peut se cacher dans le menu',
  'popup.debug.overflowSuffix': 'de dépassement.',
  'popup.debug.step3': 'Boostez votre débogage',
  'popup.debug.menuGlyphAria': 'Ouvrir le menu Affichage → Développeur → Outils de développement',
  'popup.debug.tabGlyphAria':
    "DevTools ancrés avec l'onglet Open Headers sélectionné — barres latérales, liste réseau et panneaux partagés multi-onglets",
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': 'Développeur',
  'popup.debug.menuGlyphDeveloperTools': 'Outils de développement',
} as const satisfies Catalog;
