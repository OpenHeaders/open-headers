/**
 * DevTools panel — shell chrome — French. Mirrors `catalogs/en/panel.ts`
 * key for key; resource-type pills, throttle tier names, CDP method
 * names, header names, event names (Finish / DOMContentLoaded / Load),
 * keyboard chords, units (kB / kbit/s / ms) and the Aa / ab / .* / ▾ / ✓
 * glyphs stay raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Enregistrer le journal réseau',
  'panel.toolbar.stopRecording': "Arrêter l'enregistrement",
  'panel.toolbar.clear': 'Effacer le journal réseau',
  'panel.toolbar.filter': 'Filtrer',
  'panel.toolbar.search': 'Rechercher',
  'panel.toolbar.preserveLog': 'Conserver le journal',
  'panel.toolbar.preserveLogTitle':
    'Conserve les requêtes à travers les navigations de page. Désactivé, la liste se vide à chaque navigation ' +
    'ou rechargement, comme le panneau Network du navigateur.',
  'panel.toolbar.aboutPreserveLog': 'À propos de Conserver le journal',
  'panel.toolbar.aboutMoreFilters': 'À propos des filtres supplémentaires',
  'panel.toolbar.aboutFooterView': 'À propos de la vue du pied de page',
  'panel.toolbar.moreTools': 'Plus d’outils',
  'panel.toolbar.activeWorkspaceAria': 'Espace de travail actif : {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Barre latérale gauche',
  'panel.toolbar.bottomPanel': 'Panneau inférieur',
  'panel.toolbar.rightSidebar': 'Barre latérale droite',
  'panel.toolbar.chooseBottomAlignment': "Choisir l'alignement du panneau inférieur",
  'panel.toolbar.layoutOptions': 'Options de disposition',
  'panel.toolbar.bottomAlignTooltip.center': 'Panneau inférieur : centré (imbriqué)',
  'panel.toolbar.bottomAlignTooltip.left': 'Panneau inférieur : aligné à gauche',
  'panel.toolbar.bottomAlignTooltip.right': 'Panneau inférieur : aligné à droite',
  'panel.toolbar.bottomAlignTooltip.justify': 'Panneau inférieur : pleine largeur',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomLayout': 'Disposition du panneau inférieur',
  'panel.layout.alignCenter': 'Centré (imbriqué)',
  'panel.layout.alignLeft': 'Gauche',
  'panel.layout.alignRight': 'Droite',
  'panel.layout.alignJustify': 'Justifié (pleine largeur)',
  'panel.layout.splitColumns': 'Côte à côte',
  'panel.layout.splitRows': 'Empilés',
  'panel.layout.showToolWindowNames': "Afficher les noms des fenêtres d'outils",
  'panel.layout.activityBarLayout': "Disposition de la barre d'activité",
  'panel.layout.sidebarProportional': 'Proportionnelle (moitiés égales)',
  'panel.layout.sidebarCompact': 'Compacte (bas épinglé)',
  'panel.layout.sidebarStacked': 'Empilée (tout en haut)',
  'panel.layout.sidebarDynamic': 'Dynamique (suit les hauteurs des panneaux)',
  'panel.layout.defaultLayoutDonor': '{unit} de disposition par défaut',
  'panel.layout.inheritsDefault': 'Hérite de la disposition par défaut',
  'panel.layout.donorTooltip': 'Ce {unit} est le défaut — les nouveaux {units} héritent de cette disposition.',
  'panel.layout.nonDonorTooltip': 'Un autre {unit} est le défaut — les nouveaux {units} héritent de sa disposition.',
  'panel.layout.resetToDefaults': 'Rétablir la disposition par défaut',
  'panel.layout.restoreHidden': "Restaurer les outils masqués de la barre d'activité",

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Filtrer',
  'panel.filter.clear': 'Effacer',
  'panel.filter.clearAria': 'Effacer le filtre',
  'panel.filter.matchCase': 'Respecter la casse (Alt+C)',
  'panel.filter.wholeWord': 'Mot entier (Alt+W)',
  'panel.filter.regex': 'Utiliser une expression régulière (Alt+R)',
  'panel.filter.more': 'Plus',
  'panel.filter.hiddenClearFilter': 'Effacer le filtre',
  'panel.filter.hiddenDismiss': 'Ignorer',

  'panel.menu.resetToDefault': 'Rétablir les valeurs par défaut',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'Filtres supplémentaires',
  'panel.moreFilters.hideDataUrls': 'Masquer les URL data',
  'panel.moreFilters.hideExtensionUrls': "Masquer les URL d'extension",
  'panel.moreFilters.blockedRequests': 'Requêtes bloquées',
  'panel.moreFilters.thirdParty': 'Requêtes tierces',
  'panel.moreFilters.swRequests': 'Requêtes de service worker',
  'panel.moreFilters.ruleApplied': 'Requêtes modifiées par une règle',
  'panel.moreFilters.pageOriginPending': 'Origine de la page pas encore disponible',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Vue du pied de page',
  'panel.view.title': 'Choisir les statistiques affichées dans le pied de page',
  'panel.view.focusedTool': 'Outil sélectionné',
  'panel.view.focusedToolTitle':
    "Le pied de page suit la fenêtre d'outil sélectionnée — Storage, Console et la recherche affichent leurs " +
    'propres résumés ; les autres outils retombent sur la ligne Network.',
  'panel.view.networkOnly': 'Outil Network uniquement',
  'panel.view.networkOnlyTitle':
    "Le pied de page affiche toujours les chiffres Network, quelle que soit la fenêtre d'outil sélectionnée.",
  'panel.view.modifiedCount': 'Compte des modifiées',
  'panel.view.failedCount': 'Compte des échouées',
  'panel.view.cachedCount': 'Compte des en cache',
  'panel.view.pageLabel': 'Libellé de la page actuelle',
  'panel.view.pageLabelTitle':
    'Quand le journal couvre plusieurs navigations, nomme la page que décrivent les jalons de timing.',
  'panel.view.timingAllNavs': 'Timing sur toutes les navigations',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load couvrent toute la chronologie du journal conservé depuis la première ' +
    'navigation (le défaut du navigateur). Décochez pour ne rapporter que la dernière navigation.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Exporter le trafic',
  'panel.export.exportAll': 'Tout exporter en HAR',
  'panel.export.exportAllSanitized': 'Tout exporter en HAR (assaini)',
  'panel.export.copyAll': 'Tout copier en HAR',
  'panel.export.copyAllSanitized': 'Tout copier en HAR (assaini)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Désactiver le cache',
  'panel.cache.tooltipDebug':
    'Cache désactivé au niveau de la pile réseau (mode débogage) — équivaut au Disable cache natif du navigateur.',
  'panel.cache.tooltipStandard':
    'Contourne le cache HTTP en forçant la revalidation. Activez le mode débogage pour une désactivation ' +
    'complète de la pile réseau (cache en mémoire compris).',
  'panel.cache.aboutAria': 'À propos de Désactiver le cache',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'Pas de limitation',
  'panel.throttle.custom': 'Personnalisé',
  'panel.throttle.customEllipsis': 'Personnalisé…',
  'panel.throttle.customHint': 'Définissez téléchargement, envoi et latence.',
  'panel.throttle.customTitle': 'Limitation personnalisée',
  'panel.throttle.download': 'Téléchargement',
  'panel.throttle.upload': 'Envoi',
  'panel.throttle.latency': 'Latence',
  'panel.throttle.appliesToTab': "S'applique à cet onglet",
  'panel.throttle.morePresets': 'Plus de préréglages',
  'panel.throttle.morePresetsSubtitle': 'Fibre, câble, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Filaire',
  'panel.throttle.mobile': 'Mobile',
  'panel.throttle.disabledTooltip':
    "La limitation réseau n'est disponible qu'en mode débogage. Activez le mode débogage pour limiter cet onglet.",
  'panel.throttle.aboutAria': 'À propos de la limitation réseau',
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 2 ms de latence',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 8 ms de latence',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 25 ms de latence',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 8 ms de latence',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 18 ms de latence',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 165 ms de latence',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 562.5 ms de latence',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 2000 ms de latence',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 2000 ms de latence',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 3000 ms de latence',
  'panel.throttle.subtitle.offline': "Bloque tout le trafic réseau de l'onglet.",

  'panel.debug.apply': 'Appliquer',
  'panel.debug.enableDebugMode': 'Activer le mode débogage',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Substitutions',
  'panel.overrides.disabledTooltip':
    "Les substitutions système ne sont disponibles qu'en mode débogage. Activez le mode débogage pour " +
    'substituer cet onglet.',
  'panel.overrides.aboutAria': 'À propos des substitutions système',
  'panel.overrides.wireHint':
    'Envoyées sur les requêtes et rapportées aux scripts de page tant que cet onglet reste en mode débogage.',
  'panel.overrides.pageOnlyHint':
    'Page uniquement — modifie ce que les scripts et le CSS de la page observent, pas les requêtes.',
  'panel.overrides.platform': 'Plateforme',
  'panel.overrides.locale': 'Locale',
  'panel.overrides.timezone': 'Fuseau horaire',
  'panel.overrides.colorScheme': 'Thème de couleurs',
  'panel.overrides.reducedMotion': 'Animations réduites',
  'panel.overrides.printMedia': "Média d'impression",
  'panel.overrides.uaPlaceholder': 'Chaîne User-Agent personnalisée',
  'panel.overrides.alPlaceholder': 'p. ex. fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, p. ex. Linux',
  'panel.overrides.localePlaceholder': 'Locale réelle',
  'panel.overrides.timezonePlaceholder': 'Fuseau horaire réel',
  'panel.overrides.auto': 'Auto',
  'panel.overrides.light': 'Clair',
  'panel.overrides.dark': 'Sombre',
  'panel.overrides.reduce': 'Réduire',
  'panel.overrides.noPref': 'Sans préf',
  'panel.overrides.screen': 'Écran',
  'panel.overrides.print': 'Impression',
  'panel.overrides.resetAll': 'Tout réinitialiser',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Conserve les requêtes enregistrées à travers les navigations et rechargements au lieu de vider la liste à ' +
    'chaque changement de page.',
  'panel.info.preserveLog.description':
    'Activé — le journal survit à chaque navigation : les requêtes parties juste avant une redirection, un ' +
    'envoi de formulaire ou un rechargement restent visibles. Désactivé — la liste se vide à chaque navigation ' +
    'ou rechargement, comme le panneau Network du navigateur, et ne montre que le trafic de la page actuelle.',
  'panel.info.preserveLog.whenHeading': 'À utiliser pour',
  'panel.info.preserveLog.redirects': 'Redirections',
  'panel.info.preserveLog.redirectsDesc':
    "Inspecter la requête qui a déclenché une navigation avant que la nouvelle page ne l'efface.",
  'panel.info.preserveLog.forms': 'Envois de formulaires / connexions',
  'panel.info.preserveLog.formsDesc': 'Garder un POST et sa réponse visibles après le rechargement de la page.',
  'panel.info.preserveLog.reloadLoops': 'Boucles de rechargement',
  'panel.info.preserveLog.reloadLoopsDesc': 'Voir ce qui est parti juste avant que la page ne se recharge.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Filtres de requêtes secondaires rangés derrière un menu — chacun restreint la liste sans occuper la barre ' +
    "d'outils.",
  'panel.info.moreFilters.hideHeading': 'Masquer',
  'panel.info.moreFilters.dataUrls': 'URL data',
  'panel.info.moreFilters.dataUrlsDesc':
    'Exclure les ressources data: en ligne — images base64, polices et similaires.',
  'panel.info.moreFilters.extensionUrls': "URL d'extension",
  'panel.info.moreFilters.extensionUrlsDesc': "Exclure les requêtes vers des origines d'extension de navigateur.",
  'panel.info.moreFilters.onlyHeading': 'Afficher uniquement',
  'panel.info.moreFilters.blocked': 'Requêtes bloquées',
  'panel.info.moreFilters.blockedDesc': "Restreindre la liste aux requêtes qu'une règle a bloquées.",
  'panel.info.moreFilters.thirdParty': 'Requêtes tierces',
  'panel.info.moreFilters.thirdPartyDesc': "Restreindre aux requêtes dont l'origine diffère de celle de la page.",
  'panel.info.moreFilters.swRequests': 'Requêtes de service worker',
  'panel.info.moreFilters.swRequestsDesc':
    'Restreindre aux échanges de service worker — les requêtes émises par le worker lui-même (lignes ⚙) et les ' +
    'requêtes de page auxquelles son gestionnaire fetch a répondu.',
  'panel.info.moreFilters.ruleApplied': 'Requêtes modifiées par une règle',
  'panel.info.moreFilters.ruleAppliedDesc':
    "Restreindre aux requêtes qu'une règle Open Headers a modifiées de façon vérifiable.",

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Choisit les statistiques optionnelles du pied de page, à côté des comptes de requêtes et de transfert ' +
    'toujours affichés.',
  'panel.info.view.scopeHeading': 'Portée du résumé',
  'panel.info.view.focusedTool': 'Outil sélectionné',
  'panel.info.view.focusedToolDesc':
    "Le pied de page suit la fenêtre d'outil sélectionnée — Storage, Console et la recherche affichent leurs " +
    'propres lignes de résumé ; les autres outils retombent sur la ligne Network.',
  'panel.info.view.networkOnly': 'Outil Network uniquement',
  'panel.info.view.networkOnlyDesc':
    "Le pied de page affiche toujours les chiffres Network, quelle que soit la fenêtre d'outil sélectionnée.",
  'panel.info.view.countsHeading': 'Comptes du pied de page',
  'panel.info.view.modified': 'Modifiées',
  'panel.info.view.modifiedDesc': 'Combien de requêtes une règle a modifiées.',
  'panel.info.view.failed': 'Échouées',
  'panel.info.view.failedDesc': 'Combien de requêtes ont échoué ou été bloquées.',
  'panel.info.view.cached': 'En cache',
  'panel.info.view.cachedDesc': 'Combien de réponses ont été servies depuis le cache.',
  'panel.info.view.timingHeading': 'Timing',
  'panel.info.view.pageLabel': 'Libellé de la page actuelle',
  'panel.info.view.pageLabelDesc':
    'Nomme la page que décrivent les jalons de timing quand le journal couvre plusieurs navigations.',
  'panel.info.view.allNavs': 'Sur toutes les navigations',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load couvrent toute la chronologie du journal conservé, pas seulement la ' +
    'dernière navigation.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Empêche cet onglet de servir des réponses depuis le cache.',
  'panel.info.cache.debugDesc':
    'Cet onglet est en mode débogage : le cache est désactivé au niveau de la pile réseau — cache en mémoire ' +
    'compris — comme le Disable cache natif du navigateur.',
  'panel.info.cache.standardDesc':
    'Cet onglet est en mode standard : seul le cache HTTP est contourné, en demandant au serveur de revalider. ' +
    'Activez le mode débogage pour une désactivation complète de la pile réseau qui vide aussi le cache en ' +
    'mémoire.',
  'panel.info.cache.standardHeading': 'Mode standard',
  'panel.info.cache.revalidateDesc':
    'Ajouté à chaque requête pour que le serveur revérifie la fraîcheur. Ne contourne que le cache HTTP.',
  'panel.info.cache.debugHeading': 'Mode débogage',
  'panel.info.cache.cdpDesc':
    "Désactive le cache pour tout l'onglet au niveau de la pile réseau, cache en mémoire compris.",

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'Substitutions système',
  'panel.info.overrides.summary':
    "Fige l'identité système de cet onglet — User-Agent, locale, fuseau horaire et média émulé — pour voir " +
    'comment un site répond à un autre client.',
  'panel.info.overrides.debugDesc':
    "Actives sur cet onglet via le mode débogage. Les facettes User-Agent s'appliquent aux requêtes et aux " +
    'scripts de page ; locale, fuseau horaire et média ne changent que ce que les scripts et le CSS de la page ' +
    'observent. Tout réinitialiser restaure les valeurs réelles.',
  'panel.info.overrides.standardDesc':
    "Les substitutions système exigent le mode débogage — il n'y a pas de repli en mode standard. Activez le " +
    'mode débogage et gardez cet onglet dans le périmètre pour le substituer.',
  'panel.info.overrides.wireHeading': 'Sur le réseau + scripts de page',
  'panel.info.overrides.uaDesc':
    'Définit les en-têtes User-Agent / Accept-Language, la plateforme et les valeurs navigator.* ' + 'correspondantes.',
  'panel.info.overrides.pageHeading': 'Page uniquement',
  'panel.info.overrides.localeDesc': 'Change la locale que lisent les scripts de page.',
  'panel.info.overrides.timezoneDesc': 'Change le fuseau horaire vers lequel Date et Intl se résolvent.',
  'panel.info.overrides.mediaDesc': 'Force les media queries color-scheme / reduced-motion / print.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Limitation réseau',
  'panel.info.throttle.summary':
    'Simule des connexions plus lentes en plafonnant la bande passante de cet onglet et en ajoutant de la ' +
    'latence.',
  'panel.info.throttle.debugDesc':
    'Active sur cet onglet via le mode débogage. Choisissez un préréglage — les défauts plus fibre / câble / ' +
    'DSL et 5G / 2G sous Plus de préréglages — passez hors ligne, ou définissez téléchargement / envoi / ' +
    'latence personnalisés.',
  'panel.info.throttle.standardDesc':
    "La limitation exige le mode débogage — il n'y a pas de repli en mode standard. Activez le mode débogage " +
    'et gardez cet onglet dans le périmètre pour le limiter.',
  'panel.info.throttle.presetsHeading': 'Préréglages',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s en descente, 165 ms de latence.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s en descente, 562.5 ms de latence.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, 2000 ms de latence.',
  'panel.info.throttle.offlineDesc': "Bloque tout le trafic réseau de l'onglet.",
  'panel.info.throttle.wiredHeading': 'Plus de préréglages · Filaire',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, 2 ms de latence.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s en descente, 8 ms de latence.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s en descente, 25 ms de latence.',
  'panel.info.throttle.mobileHeading': 'Plus de préréglages · Mobile',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s en descente, 8 ms de latence.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s en descente, 18 ms de latence.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, 2000 ms de latence.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, 3000 ms de latence.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' }),
  'panel.status.requestsSubset': '{subset} / {total} requêtes',
  'panel.status.modified': '{count} modifiées',
  'panel.status.modifiedTitle': 'Requêtes modifiées par vos règles',
  'panel.status.failed': '{count} échouées',
  'panel.status.failedTitle': "Requêtes échouées ou en statut d'erreur",
  'panel.status.cached': '{count} en cache',
  'panel.status.cachedTitle': 'Requêtes servies depuis le cache',
  'panel.status.transferredOnly': '{size} transférés',
  'panel.status.transferredAndResources': '{transferred} transférés / {resources} ressources',
  'panel.status.transferredSubset': '{subset} / {total} transférés',
  'panel.status.resourcesSubset': '{subset} / {total} ressources',
  'panel.status.finish': 'Finish : {time}',
  'panel.status.loadEventTitle': 'Événement Load',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} onglet', many: '{count} onglets', other: '{count} onglets' }),
  'panel.status.messagesOf': '{visible} sur {total} messages',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} message', many: '{count} messages', other: '{count} messages' }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} erreur', many: '{count} erreurs', other: '{count} erreurs' }),
  'panel.status.errorsTitle': 'Messages console au niveau erreur',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} avertissement',
      many: '{count} avertissements',
      other: '{count} avertissements',
    }),
  'panel.status.warningsTitle': 'Messages console au niveau avertissement',
  'panel.status.systemStatus': 'Système',
  'panel.status.theme.light': 'Clair',
  'panel.status.theme.dark': 'Sombre',
  'panel.status.theme.auto': 'Auto',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.capture.collapsePlane': 'Replier cette section',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Recherche',
  'panel.toolWindows.notifications': 'Notifications',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Activité des règles',
  'panel.toolWindows.matchedRules': 'Règles correspondantes',

  // ── Search tool window (station: search family) ─────────────────────
  'panel.search.placeholder': 'Rechercher (appuyez sur Entrée)',
  'panel.search.inputAria': 'Rechercher dans les données capturées',
  'panel.search.syntaxHelp': 'Aide sur la syntaxe de recherche',
  'panel.search.run': 'Rechercher',
  'panel.search.runTitle': 'Lancer la recherche (Entrée)',
  'panel.search.cancel': 'Annuler',
  'panel.search.cancelTitle': 'Annuler la recherche',
  'panel.search.idleHintMin': 'Saisissez une requête (2 caractères min) et appuyez sur Entrée pour rechercher.',
  'panel.search.idleHintShort': 'Appuyez sur Entrée pour rechercher.',
  'panel.search.noMatches': 'Aucune correspondance trouvée.',

  'panel.search.status.searching': 'Recherche… {done} / {total}',
  'panel.search.status.noResults': 'Aucun résultat · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), {
      one: '{count} correspondance trouvée',
      many: '{count} correspondances trouvées',
      other: '{count} correspondances trouvées',
    });
    const where = plural(locale, Number(files), {
      one: '{count} fichier',
      many: '{count} fichiers',
      other: '{count} fichiers',
    });
    return `${found} dans ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'affichage des {shown} premières — affinez la requête pour voir le reste',

  'panel.search.group.countTitle': '{count} correspondances dans ce fichier',
  'panel.search.group.countTitleCapped': '{count} correspondances dans ce fichier — affichage des {shown} premières',
  'panel.search.row.lineCol': 'Ligne {line}, col {col}',
  'panel.search.row.line': 'Ligne {line}',
  'panel.search.row.matchesOnLine': '{count} correspondances sur cette ligne',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  'panel.matchedRules.selectPrompt.lead': 'Sélectionnez une requête pour voir les',
  'panel.matchedRules.selectPrompt.tail': "règles qui s'y appliquent",
  'panel.matchedRules.matchedCount': 'Correspondantes · {count}',
  'panel.matchedRules.futureCount': 'Correspondances futures · {count}',
  'panel.matchedRules.noMatched': 'Aucune règle ne correspond à cette requête.',
  'panel.matchedRules.noFuture': 'Aucune autre règle ne correspondrait à cette requête.',
  'panel.matchedRules.pattern': 'Motif : {pattern}',
  'panel.matchedRules.wouldMatch': 'correspondrait',

  'panel.matchedRules.evidence.contradicted': 'contredite',
  'panel.matchedRules.evidence.authoritative': 'faisant foi',
  'panel.matchedRules.evidence.confirmed': 'confirmée',
  'panel.matchedRules.evidence.fallback': 'repli',
  'panel.matchedRules.evidence.silent': 'silencieuse',
  'panel.matchedRules.evidence.corroborated': 'corroborée',
  'panel.matchedRules.evidence.inferred': 'inférée',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Contredite — les en-têtes capturés réfutent une modification que cette règle revendiquait.',
  'panel.matchedRules.evidenceTitle.authoritative':
    "Faisant foi — le moteur de règles a confirmé l'exécution de cette règle DNR sur la requête.",
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Confirmée — la règle a modifié le corps dans le contexte de la page et les deux versions (servie et ' +
    "d'origine) ont été capturées pour cette requête.",
  'panel.matchedRules.evidenceTitle.confirmed':
    "Confirmée par le rapporteur en page — l'action scriptable s'est exécutée dans la page.",
  'panel.matchedRules.evidenceTitle.fallback':
    "Inférée de la correspondance d'URL — une confirmation scriptable était attendue mais n'est pas arrivée.",
  'panel.matchedRules.evidenceTitle.silent':
    'Le motif correspondait mais la requête a été servie depuis le cache / un service worker — aucune action ' +
    "DNR ou scriptable ne s'est exécutée.",
  'panel.matchedRules.evidenceTitle.corroborated':
    'Corroborée — la modification revendiquée est visible dans les en-têtes capturés.',
  'panel.matchedRules.evidenceTitle.inferred':
    "Inférée de la correspondance d'URL — la règle correspondrait à cette requête selon ses conditions.",
  'panel.matchedRules.contradiction.stillPresent': '{header} est toujours présent ({observed}).',
  'panel.matchedRules.contradiction.missing': '{header} est absent des en-têtes capturés.',
  'panel.matchedRules.contradiction.otherValue': '{header} porte « {observed} » au lieu de la valeur revendiquée.',

  'panel.matchedRules.ruleState.deleted': 'règle supprimée',
  'panel.matchedRules.ruleState.disabled': 'règle désactivée',
  'panel.matchedRules.ruleState.modified': 'règle modifiée',
  'panel.matchedRules.ruleStateTitle.deleted':
    "Cette règle a été supprimée depuis son déclenchement. La ligne montre ce qu'elle a fait à ce moment-là.",
  'panel.matchedRules.ruleStateTitle.disabled':
    "Cette règle a été désactivée depuis son déclenchement — elle ne s'appliquera pas à la prochaine requête.",
  'panel.matchedRules.ruleStateTitle.modified':
    "Cette règle a été modifiée depuis son déclenchement. La ligne montre ce qu'elle a fait à ce moment-là ; " +
    'survolez pour voir la règle actuelle.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': "Aucune activité de règle sur cet onglet pour l'instant.",
  'panel.ruleActivity.toolbarHint': 'Activité des règles groupée par règle.',
  'panel.ruleActivity.hint.applied': 'Appliqués',
  'panel.ruleActivity.hint.appliedDesc':
    "— déclenchements confirmés : le moteur de règles a rapporté l'exécution de la règle, le rapporteur en " +
    "page a confirmé l'action, ou la modification est visible dans les en-têtes capturés.",
  'panel.ruleActivity.hint.contradicted': 'Contredits',
  'panel.ruleActivity.hint.contradictedDesc':
    "— déclenchements revendiquant un changement d'en-tête que les en-têtes capturés réfutent.",
  'panel.ruleActivity.hint.inferred': 'Inférés',
  'panel.ruleActivity.hint.inferredDesc':
    '— déclenchements où vos motifs de règle correspondent aux requêtes observées sans confirmation possible.',
  'panel.ruleActivity.hint.offHar': 'Hors HAR',
  'panel.ruleActivity.hint.offHarDesc': "— déclenchements sur des requêtes que le panneau n'a pas capturées.",
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} déclenchement',
      many: '{count} déclenchements',
      other: '{count} déclenchements',
    }),
  'panel.ruleActivity.applied': '{count} appliqués',
  'panel.ruleActivity.contradicted': '{count} contredits',
  'panel.ruleActivity.offHar': '{count} hors HAR',
  'panel.ruleActivity.offHarTitle': "Hors HAR — le panneau n'a pas capturé d'enveloppe HAR pour ce déclenchement",

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  'panel.valueDoc.crumbFallback': 'Règles',
  'panel.valueDoc.saveHint': "Ré-encoder la valeur modifiée et l'écrire dans la règle",
  'panel.valueDoc.blockedHintInvalid': "Le texte modifié ne peut pas s'encoder pour ce type de valeur",
  'panel.valueDoc.blockedHintDetached': 'Le champ de règle auquel cette valeur appartenait a disparu',
  'panel.valueDoc.rereadTitle': 'Relire la valeur depuis la règle',
  'panel.valueDoc.rereadConfirm': 'Abandonne vos modifications — cliquez de nouveau pour relire',
  'panel.valueDoc.rereadAria': 'Abandonner les modifications et relire la valeur',
  'panel.valueDoc.openRuleTitle': "Ouvrir cette règle dans l'éditeur d'espace de travail",
  'panel.valueDoc.openRule': "Ouvrir la règle dans l'espace de travail",
  'panel.valueDoc.driftNote':
    'La valeur a changé dans la règle pendant que vous éditiez — vos modifications non enregistrées sont ' +
    'conservées. Enregistrer les écrira par-dessus.',
  'panel.valueDoc.undetectedNote':
    'Le champ ne contient plus une valeur que cet éditeur peut encoder — vos modifications non enregistrées ' +
    'sont conservées pour être copiées.',
  'panel.valueDoc.detachedNote':
    'Le champ de règle auquel cette valeur appartenait a disparu — vos modifications non enregistrées sont ' +
    'conservées pour être copiées.',
  'panel.valueDoc.discardEdits': 'Abandonner mes modifications',
  'panel.valueDoc.saveFailed.detached':
    "La modification à laquelle cette valeur appartenait a disparu de la règle — il n'y a rien où écrire.",
  'panel.valueDoc.saveFailed.notFound': 'Règle introuvable — elle a peut-être été supprimée.',
  'panel.valueDoc.saveFailed.write': "Échec de l'enregistrement — la règle a rejeté l'écriture.",
  'panel.valueDoc.encodedPreview': 'Aperçu encodé',
  'panel.valueDoc.cannotEncode': "Encodage impossible — la valeur modifiée n'est pas valide pour ce type",
  'panel.valueDoc.undetectedTitle': 'Plus une valeur encodée',
  'panel.valueDoc.undetectedSub':
    "La valeur actuelle du champ ne correspond à aucun décodeur — modifiez-la plutôt dans l'éditeur de règles.",
  'panel.valueDoc.detachedTitle': 'Valeur absente de la règle',
  'panel.valueDoc.detachedSub':
    "La règle ou la modification portant cette valeur a été supprimée, ou l'opération ne porte plus de valeur.",

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  'panel.valueView.snapshotNote': 'Instantané',
  'panel.valueView.snapshotTitle':
    "Capturé à l'ouverture de ce document — il ne suit pas les modifications ultérieures.",
  'panel.valueView.encodedValue': 'Valeur encodée',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  'panel.ruleDoc.crumbKind': 'Substitution de réponse',
  'panel.ruleDoc.nameLabel': 'Nom de la règle',
  'panel.ruleDoc.saveHint': 'Enregistrer la règle de substitution — elle reste publiée dans la même étape',
  'panel.ruleDoc.saveHintCreate': 'Créer la règle et la publier',
  'panel.ruleDoc.blockedHintDetached': 'La règle à laquelle ce document appartenait a disparu',
  'panel.ruleDoc.rereadTitle': 'Relire la règle',
  'panel.ruleDoc.rereadConfirm': 'Abandonne vos modifications — cliquez de nouveau pour relire',
  'panel.ruleDoc.rereadAria': 'Abandonner les modifications et relire la règle',
  'panel.ruleDoc.openRuleTitle': "Ouvrir cette règle dans l'éditeur d'espace de travail",
  'panel.ruleDoc.openRule': "Ouvrir dans l'espace de travail",
  'panel.ruleDoc.saveFailed.notFound': 'Règle introuvable — elle a peut-être été supprimée.',
  'panel.ruleDoc.saveFailed.write': "Échec de l'enregistrement — la règle a rejeté l'écriture.",
  'panel.ruleDoc.detachedTitle': "La règle n'existe plus",
  'panel.ruleDoc.detachedSub': 'La règle de substitution que ce document éditait a été supprimée.',
  'panel.ruleDoc.dynamicTitle': 'Règle à corps dynamique',
  'panel.ruleDoc.dynamicSub': "Les corps de réponse JavaScript se modifient dans l'éditeur d'espace de travail.",

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'Étape {current} sur {total}',
  'panel.tour.previous': 'Précédent',
  'panel.tour.next': 'Suivant',
  'panel.tour.finish': 'Terminer',
  'panel.tour.welcomeTitle': 'Une expérience DevTools unifiée',
  'panel.tour.welcomeSubtitle': 'Un débogueur réseau avec vos règles intégrées.',
  'panel.tour.welcomeCapture': 'Capturer',
  'panel.tour.welcomeCaptureHint': '— les requêtes en direct avec délais, en-têtes et tailles',
  'panel.tour.welcomeRules': 'Attribuer',
  'panel.tour.welcomeRulesHint': '— voyez quelles règles se sont déclenchées sur chaque requête, et pourquoi',
  'panel.tour.welcomeState': 'Inspecter',
  'panel.tour.welcomeStateHint': '— cookies, stockage et console à côté du trafic',
  'panel.tour.networkTitle': 'La fenêtre Network',
  'panel.tour.networkSubtitle': "Chaque requête émise par l'onglet inspecté, en direct.",
  'panel.tour.networkFilters': 'Filtrer',
  'panel.tour.networkFiltersHint': '— par texte, type de ressource ou les préréglages « Plus de filtres »',
  'panel.tour.networkToolbar': 'Contrôler',
  'panel.tour.networkToolbarHint': '— conservation du journal, limitation et désactivation du cache en haut',
  'panel.tour.networkExport': 'Exporter',
  'panel.tour.networkExportHint': '— enregistrez ou copiez tout le journal au format HAR',
  'panel.tour.storageTitle': 'La fenêtre Storage',
  'panel.tour.storageSubtitle': "L'état côté client de l'onglet inspecté, au même endroit.",
  'panel.tour.storageAreas': 'Parcourir',
  'panel.tour.storageAreasHint': '— stockage local et de session, cookies, IndexedDB, caches',
  'panel.tour.storageEdit': 'Modifier',
  'panel.tour.storageEditHint': '— ouvrez toute entrée comme onglet de document et modifiez-la sur place',
  'panel.tour.inspectorTitle': 'Détail de la requête',
  'panel.tour.inspectorSubtitle': "Sélectionnez une requête pour l'ouvrir ici comme onglet.",
  'panel.tour.inspectorTabs': 'Sections',
  'panel.tour.inspectorTabsHint': '— en-têtes, charge utile, réponse, délais et cookies',
  'panel.tour.inspectorEdit': 'Substituer',
  'panel.tour.inspectorEditHint': '— créez une règle depuis la requête sans quitter le panneau',
  'panel.tour.matchedTitle': 'Règles de requête',
  'panel.tour.matchedSubtitle':
    'Quelles règles ont correspondu à la requête sélectionnée — et lesquelles se déclencheraient sur la prochaine.',
  'panel.tour.layoutTitle': 'Faites-le vôtre',
  'panel.tour.layoutSubtitle': "Les rails latéraux accueillent d'autres fenêtres d'outils.",
  'panel.tour.layoutTools': "Plus d'outils",
  'panel.tour.layoutToolsHint': '— Console, recherche, Docs et notifications vivent sur les rails',
  'panel.tour.layoutDrag': 'Réorganiser',
  'panel.tour.layoutDragHint':
    "— faites glisser les fenêtres d'outils entre les zones d'ancrage ; le menu de disposition réinitialise",
  'panel.tour.debugTitle': 'Mode débogage',
  'panel.tour.debugSubtitle': 'Désactivé par défaut — activez-le ici pour une capture plus poussée.',
  'panel.tour.debugUnlocks': 'Débloque',
  'panel.tour.debugUnlocksHint': '— corps de réponse, console, délais exacts et règles de niveau script',
  'panel.tour.debugBanner': 'Attention',
  'panel.tour.debugBannerHint':
    "— le navigateur affiche un bandeau de débogage sur les onglets attachés tant que c'est actif",

  // ── Value expander (headers / cookies detail readout) ──────────────
  'panel.valueExpander.decoded': 'Décodé',
  'panel.valueExpander.raw': 'Brut',
} as const satisfies Catalog;
