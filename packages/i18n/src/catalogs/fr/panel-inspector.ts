/**
 * DevTools panel — request inspector shell + detail tabs — French.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary), and wire
 * tokens (HEAD / CONNECT / 204 No Content / Server-Timing).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  'panel.inspector.detailEmpty.requestGone': "La requête n'est plus disponible (effacée ou page quittée)",
  'panel.inspector.detailEmpty.selectPrefix': 'Sélectionnez une requête dans le',
  'panel.inspector.detailEmpty.selectSuffix': "panneau Network pour l'inspecter",

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  'panel.inspector.tabBar.closeTab': "Fermer l'onglet",
  'panel.inspector.tabBar.unsavedChanges': 'Modifications non enregistrées',
  'panel.inspector.tabBar.searchTabs': 'Rechercher dans les onglets',
  'panel.inspector.tabBar.searchPlaceholder': 'Rechercher des onglets…',
  'panel.inspector.tabBar.noOpenTabs': 'Aucun onglet ouvert',
  'panel.inspector.tabBar.noOpenTabsMatch': 'Aucun onglet ouvert ne correspond à votre recherche',
  'panel.inspector.tabBar.noClosedTabsMatch': 'Aucun onglet fermé ne correspond à votre recherche',
  'panel.inspector.tabBar.recentlyClosed': 'Récemment fermés ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Récemment fermés ({matched} sur {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': 'Enregistrer les modifications ?',
  'panel.inspector.tabBar.closeGuard.unsavedBody':
    'comporte des modifications non enregistrées. Enregistrez-les pour ne pas perdre votre travail.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'Ne pas enregistrer',
  'panel.inspector.tabBar.closeGuard.cancel': 'Annuler',
  'panel.inspector.tabBar.closeGuard.save': 'Enregistrer les modifications',

  // Tab context menu
  'panel.inspector.tabMenu.close': 'Fermer',
  'panel.inspector.tabMenu.closeOther': 'Fermer les autres onglets',
  'panel.inspector.tabMenu.closeAll': 'Fermer tous les onglets',
  'panel.inspector.tabMenu.closeToLeft': 'Fermer les onglets à gauche',
  'panel.inspector.tabMenu.closeToRight': 'Fermer les onglets à droite',
  'panel.inspector.tabMenu.splitAndMove': 'Scinder et déplacer',
  'panel.inspector.tabMenu.right': 'Droite',
  'panel.inspector.tabMenu.left': 'Gauche',
  'panel.inspector.tabMenu.down': 'Bas',
  'panel.inspector.tabMenu.up': 'Haut',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'Déplacer vers le groupe opposé',
  'panel.inspector.tabMenu.changeSplitterOrientation': "Changer l'orientation du séparateur",
  'panel.inspector.tabMenu.unsplit': 'Annuler la scission',
  'panel.inspector.tabMenu.unsplitAll': 'Annuler toutes les scissions',

  // Detail section tabs — host-panel tab nouns stay raw (parity
  // vocabulary, same posture as the tool-window labels).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab.
  'panel.inspector.overrideCta.editOverride': 'Modifier la substitution',
  'panel.inspector.overrideCta.editOverrideTitle':
    "Modifier la règle qui a produit cette réponse — les changements s'appliquent aux requêtes futures",
  'panel.inspector.overrideCta.overrideResponse': 'Substituer la réponse',
  'panel.inspector.overrideCta.overrideResponseTitle':
    'Créer une règle qui sert cette réponse comme un mock modifiable',
  'panel.inspector.overrideCta.editQueryParams': 'Modifier la substitution de paramètres de requête',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    "Modifier la règle qui a réécrit ces paramètres de requête — les changements s'appliquent aux requêtes futures",
  'panel.inspector.overrideCta.overrideQueryParams': 'Substituer les paramètres de requête',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'Créer une règle qui réécrit ces paramètres de requête',
  'panel.inspector.overrideCta.editRequestBody': 'Modifier la substitution du corps de requête',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    "Modifier la règle qui a remplacé ce corps de requête — les changements s'appliquent aux requêtes futures",
  'panel.inspector.overrideCta.overrideRequestBody': 'Substituer le corps de requête',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Créer une règle qui remplace ce corps de requête par un corps statique modifiable',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Réponse complète',
  'panel.inspector.dualView.fullRequest': 'Requête complète',
  'panel.inspector.dualView.swapSides': 'Inverser les côtés',
  'panel.inspector.dualView.hideUnchanged': "Masquer l'inchangé",

  // Delivery-path pane captions for the two-sided views.
  'panel.inspector.paneCaption.responseOriginal': 'Originale · serveur → page',
  'panel.inspector.paneCaption.responseModified': 'Modifiée · serveur → Open Headers → page',
  'panel.inspector.paneCaption.requestOriginal': 'Originale · page → serveur',
  'panel.inspector.paneCaption.requestModified': 'Modifiée · page → Open Headers → serveur',
  'panel.inspector.paneCaption.wsRecvDropped': 'Abandonné · jamais parvenu à la page',
  'panel.inspector.paneCaption.wsSendDropped': 'Abandonné · jamais parvenu au serveur',

  // Body-state notices (Response tab + Preview tab twins).
  'panel.inspector.bodyState.noResponseBodyTitle': 'Aucun corps de réponse',
  'panel.inspector.bodyState.noPreviewTitle': 'Aucun aperçu disponible',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Rien à prévisualiser',
  'panel.inspector.bodyState.noResponseDetail': "Cette requête n'a aucune donnée de réponse disponible",
  'panel.inspector.bodyState.failedTitle': 'Échec du chargement des données de réponse',
  'panel.inspector.bodyState.emptyTitle': '(corps de réponse vide)',
  'panel.inspector.bodyState.emptyDetail': 'Le serveur a renvoyé un corps vide.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Charge utile binaire ({count} octets).',
  'panel.inspector.bodyState.notApplicable.preflight': 'Aucun contenu disponible pour une requête preflight',
  'panel.inspector.bodyState.notApplicable.head': 'Aucun corps de réponse pour une requête HEAD',
  'panel.inspector.bodyState.notApplicable.connect': 'Aucun corps de réponse pour une requête CONNECT',
  'panel.inspector.bodyState.notApplicable.status204': 'Aucun contenu (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'Aucun contenu (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'Non modifié — corps servi depuis le cache du navigateur',
  'panel.inspector.bodyState.notApplicable.informational': 'Aucun contenu (réponse informationnelle)',
  'panel.inspector.bodyState.notApplicable.websocket': "Connexion WebSocket établie — voir l'onglet Messages",
  'panel.inspector.bodyState.unavailable.opaque': 'Corps de réponse indisponible — réponse cross-origin opaque',
  'panel.inspector.bodyState.unavailable.cache':
    "Corps indisponible — la réponse a été servie depuis le cache avant l'ouverture des DevTools",
  'panel.inspector.bodyState.unavailable.redirect': 'Aucun contenu disponible car cette requête a été redirigée',
  'panel.inspector.bodyState.unavailable.unknown':
    "Corps non capturé. L'hôte n'a renvoyé aucun contenu — la réponse a été diffusée sans mise en tampon ou " +
    'servie depuis le cache.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Aperçu indisponible pour ce type de contenu.',
  'panel.inspector.preview.imageAlt': 'aperçu de la réponse',

  // Shared body-viewer toolbars.
  'panel.inspector.viewer.prettyPrintTitle': 'Mise en forme',
  'panel.inspector.viewer.revertTitle': 'Revenir au Content-Type déclaré',
  'panel.inspector.viewer.parsedAsRevert': 'Interprété comme {format} · revenir',
  'panel.inspector.viewer.looksLikeParse': 'Ressemble à du {format} · interpréter',
  'panel.inspector.viewer.looksLikeTitle':
    "Le Content-Type semble incorrect — le corps s'interprète comme du {format}. Cliquez pour réinterpréter.",
  'panel.inspector.viewer.cursorInfo': 'Ligne {line}, colonne {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} ligne', many: '{count} lignes', other: '{count} lignes' }),
  'panel.inspector.viewer.hexViewer': 'Visionneuse hexadécimale',
  'panel.inspector.viewer.find': 'Rechercher',
  'panel.inspector.viewer.findTitle': 'Rechercher ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Paramètres de la chaîne de requête',
  'panel.inspector.payload.requestBody': 'Corps de la requête ({mime})',
  'panel.inspector.payload.viewSource': 'Afficher la source',
  'panel.inspector.payload.viewParsed': "Afficher l'analyse",
  'panel.inspector.payload.viewUrlEncoded': "Afficher l'encodage URL",

  // ── Raw Data tab (inspector detail) ─────────────────────────────────
  'panel.inspector.rawData.exportSnippet': "Extrait d'export",
  'panel.inspector.rawData.formatLabel': 'Format',
  'panel.inspector.rawData.copy': 'Copier',
  'panel.inspector.rawData.copied': 'Copié',
  'panel.inspector.rawData.rawHar': 'HAR brut (JSON)',
  'panel.inspector.rawData.downloadHar': 'Télécharger le .har',
  'panel.inspector.rawData.noRequestData': "(aucune donnée de requête pour l'instant)",
  'panel.inspector.rawData.view.label': 'Vue',
  'panel.inspector.rawData.view.includeHeaders': 'Inclure les en-têtes de requête',
  'panel.inspector.rawData.view.includeBody': 'Inclure le corps de requête',
  'panel.inspector.rawData.view.redactSecrets': 'Caviarder les secrets',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'En-têtes modifiés par une règle',
  'panel.inspector.rawData.view.postRule': 'Après règles (sur le réseau)',
  'panel.inspector.rawData.view.original': 'Originaux (avant règles)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (navigateur)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — message brut',
  'panel.inspector.rawData.format.har': 'HAR — entrée unique',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Format',
  'panel.inspector.rawData.harInfo.summary': "Archive HTTP portable — un instantané JSON d'une requête.",
  'panel.inspector.rawData.harInfo.description':
    "Enregistrez-la pour la joindre à un rapport de bug, la partager avec un collègue ou l'importer dans un " +
    'autre outil qui lit les fichiers HAR.',

  // ── Initiator tab (inspector detail) ────────────────────────────────
  'panel.inspector.initiator.noData': "Aucune donnée d'initiateur disponible.",
  'panel.inspector.initiator.typeLabel': 'Type :',
  'panel.inspector.initiator.stack.heading': "Pile d'appels de la requête",
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} frame', many: '{count} frames', other: '{count} frames' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count} résolus',
  'panel.inspector.initiator.stack.resolvedTitle': 'Noms de fonctions résolus via les source maps',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Afficher {count} masqué',
      many: 'Afficher {count} masqués',
      other: 'Afficher {count} masqués',
    }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Masquer {count} bruyant',
      many: 'Masquer {count} bruyants',
      other: 'Masquer {count} bruyants',
    }),
  'panel.inspector.initiator.stack.noiseTitle': 'Masquer les frames anonymes dans les bundles minifiés',
  'panel.inspector.initiator.stack.copyTitle': 'Copier la pile comme texte',
  'panel.inspector.initiator.stack.copy': 'Copier',
  'panel.inspector.initiator.stack.copied': 'Copié',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Filtrer les frames (nom de fonction ou URL)…',
  'panel.inspector.initiator.stack.filterAria': "Filtrer les frames de la pile d'appels",
  'panel.inspector.initiator.stack.noMatch': 'Aucun frame ne correspond.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} frame',
      many: '{count} frames',
      other: '{count} frames',
    });
    return `Affichage de ${String(shown)} sur ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '({count} masqués)',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Nom source-map : {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (original : {source})',
  'panel.inspector.initiator.moreFilters.label': 'Filtres supplémentaires',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Échecs uniquement',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'Tiers uniquement',
  'panel.inspector.initiator.view.label': 'Vue',
  'panel.inspector.initiator.view.sort': 'Tri',
  'panel.inspector.initiator.view.sortInitiator': "Ordre d'initiateur",
  'panel.inspector.initiator.view.sortChronological': 'Chronologique',
  'panel.inspector.initiator.view.sortLargest': 'Plus grand sous-arbre',
  'panel.inspector.initiator.view.showSuggestions': 'Afficher les suggestions',
  'panel.inspector.initiator.filterPlaceholder':
    'Filtrer — texte, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': "Filtrer la chaîne d'initiateurs",
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} correspondance',
      many: '{count} correspondances',
      other: '{count} correspondances',
    }),
  // Two sections are separate referents: the upstream (ancestor) chain
  // and the downstream tree — same French surface, separate keys.
  'panel.inspector.initiator.upstreamChain': "Chaîne d'initiateurs de la requête",
  'panel.inspector.initiator.chainTree': "Chaîne d'initiateurs de la requête",
  'panel.inspector.initiator.collapse': 'Réduire',
  'panel.inspector.initiator.expand': 'Développer',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'requête', many: 'requêtes', other: 'requêtes' }),
  'panel.inspector.initiator.cascade.transferred': 'transférés',
  'panel.inspector.initiator.cascade.cumulative': 'cumulés',
  'panel.inspector.initiator.cascade.failed': 'échouées',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': "Type d'initiateur",
  'panel.inspector.initiator.chip.httpStatusTitle': 'Statut HTTP',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Requête échouée',
  'panel.inspector.initiator.chip.failed': 'échouée',
  'panel.inspector.initiator.chip.transferredTitle': 'Transféré',
  'panel.inspector.initiator.chip.durationTitle': 'Durée',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Origine tierce',
  'panel.inspector.initiator.chip.thirdParty': 'tiers',
  'panel.inspector.initiator.chip.subtreeTitle': 'Poids du sous-arbre (descendants · octets)',
  'panel.inspector.initiator.chip.subtree': '+{count} req · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`).
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête échouée dans cette cascade.',
      many: '{count} requêtes échouées dans cette cascade.',
      other: '{count} requêtes échouées dans cette cascade.',
    }),
  'panel.inspector.initiator.insights.failedHint':
    'Vérifiez les bloqueurs de pub, les règles CSP et la configuration CORS.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'a chargé {count} requête',
      many: 'a chargé {count} requêtes',
      other: 'a chargé {count} requêtes',
    });
    return `${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)} % du poids de la cascade.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'Hôte le plus lourd de cette cascade. Hébergez-le vous-même ou différez-le si possible.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent} % des octets de la cascade sont tiers.',
  'panel.inspector.initiator.insights.thirdPartyHint': 'Réduisez, différez ou auto-hébergez les tiers non essentiels.',

  // ── Timing tab (inspector detail) — the tab's OWN copy ──────────────
  'panel.inspector.timing.noData': 'Aucune donnée de timing disponible.',
  'panel.inspector.timing.view.label': 'Vue',
  'panel.inspector.timing.view.showSuggestions': 'Afficher les suggestions',
  'panel.inspector.timing.view.showContextStrip': 'Afficher la bande de contexte',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Afficher le détail des phases',
  'panel.inspector.timing.view.showTimingBar': 'Afficher la barre de timing',
  'panel.inspector.timing.view.showServerTiming': 'Afficher Server-Timing',
  'panel.inspector.timing.view.showRepeats': 'Afficher les répétitions de la session',
  'panel.inspector.timing.view.showTransferRate': 'Afficher le débit de transfert',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary.
  'panel.inspector.timing.insight.dominatesTail': 'domine cette requête — {ms} ({percent} % du total).',
  'panel.inspector.timing.insight.unusuallyHighTail': 'est inhabituellement élevé — {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'Le planificateur de requêtes a retenu cette requête',
  'panel.inspector.timing.phase.queueing.hint':
    'Trop de requêtes simultanées en concurrence pour les créneaux, ou priorité basse.',
  'panel.inspector.timing.phase.stalled.what': "En attente d'une connexion disponible",
  'panel.inspector.timing.phase.stalled.hint':
    'Limite du pool de connexions, négociation de proxy, ou blocage head-of-line HTTP/1.1.',
  'panel.inspector.timing.phase.dns.what': 'Résolution DNS',
  'panel.inspector.timing.phase.dns.hint':
    "N'affecte que la première requête vers ce domaine. Envisagez le DNS prefetch.",
  'panel.inspector.timing.phase.connect.what': 'Handshake TCP vers le serveur',
  'panel.inspector.timing.phase.connect.hint':
    'Nouvelle connexion — keep-alive ou le multiplexage HTTP/2/3 en réutilise une entre les requêtes.',
  'panel.inspector.timing.phase.ssl.what': 'Handshake TLS',
  'panel.inspector.timing.phase.ssl.hint': 'Réduit par la reprise de session / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Envoi du corps de la requête',
  'panel.inspector.timing.phase.send.hint':
    'Gros corps de requête ou lien montant lent — visible en général seulement sur POST/PUT.',
  'panel.inspector.timing.phase.wait.what': "Temps serveur jusqu'au premier octet",
  'panel.inspector.timing.phase.wait.hint':
    'Traitement backend. Cherchez le timing backend dans Server-Timing ou les journaux de requêtes BD.',
  'panel.inspector.timing.phase.receive.what': 'Téléchargement de la charge utile de la réponse',
  'panel.inspector.timing.phase.receive.hint':
    'Taille de la charge utile ou débit du CDN — vérifiez le débit de transfert effectif.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Protocole',
  'panel.inspector.timing.chip.connection': 'Connexion',
  'panel.inspector.timing.chip.cache': 'Cache',
  'panel.inspector.timing.chip.priority': 'Priorité',
  'panel.inspector.timing.chip.started': 'Démarrée',
  'panel.inspector.timing.chip.serverIp': 'IP du serveur',
  'panel.inspector.timing.chip.connectionReused': 'réutilisée',
  'panel.inspector.timing.chip.connectionNew': 'nouvelle',
  'panel.inspector.timing.chip.openedBy': 'ouverte par {url}',
  'panel.inspector.timing.totalTime': 'Temps total',
  'panel.inspector.timing.totalWhere': '(mise en file → terminée)',
  'panel.inspector.timing.caution': "ATTENTION : la requête n'est pas encore terminée !",
  'panel.inspector.timing.queuedAt': 'Mise en file à {offset}',
  'panel.inspector.timing.startedAt': 'Démarrée à {offset}',
  'panel.inspector.timing.inProgress': 'en cours…',
  'panel.inspector.timing.noDuration': 'aucune durée',
  'panel.inspector.timing.transferRate.heading': 'Débit de transfert',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Contenu téléchargé :',
  'panel.inspector.timing.transferRate.effectiveRate': 'Débit effectif :',
  'panel.inspector.timing.transferRate.amount': '{size} en {duration}',
  'panel.inspector.timing.repeats.heading': 'Répétitions dans cette session',
  'panel.inspector.timing.repeats.hitCount': "Nombre d'occurrences de l'URL :",
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'La plus rapide / médiane / la plus lente :',
  'panel.inspector.timing.repeats.thisRequest': 'Cette requête :',
  'panel.inspector.timing.repeats.slowestTag': '(la plus lente)',
  'panel.inspector.timing.repeats.fastestTag': '(la plus rapide)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Répartition du cache :',
  'panel.inspector.timing.repeats.url': 'URL :',
} as const satisfies Catalog;
