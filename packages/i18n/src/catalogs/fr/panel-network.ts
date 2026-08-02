/**
 * DevTools panel — traffic table plane — French. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, and every µs/ms/s figure.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus ─────────────────────
  'panel.network.filterSyntaxHelp': 'Aide sur la syntaxe de filtrage',
  'panel.network.aboutTypeFilters': 'À propos des filtres par type de requête',
  'panel.network.aboutSorting': 'À propos du tri',

  // ── Remote capture — consent refusal ────────────────────────────────
  'panel.capture.watchRefused.title': 'La vue en direct est désactivée dans ce navigateur',
  'panel.capture.watchRefused.body':
    "L'extension Open Headers de ce navigateur n'autorise pas l'application de bureau à voir son trafic, son " +
    'stockage ni sa console. Activez « Laisser l\'application de bureau voir ce navigateur » dans les paramètres de ' +
    "l'extension pour l'observer ici.",

  // Traffic table cells
  'panel.network.cell.workerGearTitle': "Requête émise par le service worker de l'origine",
  'panel.network.cell.jumpToPreflight': 'Aller à la requête preflight',
  'panel.network.cell.selectPreflightInitiator': 'Sélectionner la requête qui a déclenché ce preflight',
  'panel.network.cell.pendingTitle': 'Requête pas encore terminée',
  'panel.network.cell.pending': 'En attente',
  'panel.network.gridAria': 'Requêtes réseau',
  'panel.network.noMatches': 'Aucune requête correspondante.',
  'panel.network.reloadPage': 'Recharger la page',
  'panel.network.startRecording': "Démarrer l'enregistrement",

  // View ▾ menu
  'panel.network.view.label': 'Vue',
  'panel.network.view.layout': 'Disposition',
  'panel.network.view.layoutCompact': 'Compacte',
  'panel.network.view.layoutWide': 'Large',
  'panel.network.view.valueNumber': 'Chiffre de la valeur',
  'panel.network.view.showValue': 'Afficher la valeur',
  'panel.network.view.valuesAlways': 'Toujours',
  'panel.network.view.valuesHover': 'Au survol',
  'panel.network.view.valuesOff': 'Désactivé',
  'panel.network.view.valueFormat': 'Format de la valeur',
  'panel.network.view.formatRelative': 'Relatif',
  'panel.network.view.formatTimestamp': 'Horodatage',
  'panel.network.view.timezone': 'Fuseau horaire',
  'panel.network.view.tzLocal': 'Local',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Expliquer la valeur',
  'panel.network.view.explainValueTitle':
    'Dans le popover de survol, met en évidence les lignes qui composent le total et affiche leur somme.',
  'panel.network.view.popover': 'Popover',
  'panel.network.view.popoverTitle':
    'Orientation du détail de timing au survol. Auto choisit selon la largeur du panneau — horizontale quand il ' +
    'est large, verticale quand il est étroit.',
  'panel.network.view.popoverAuto': 'Auto',
  'panel.network.view.popoverCompact': 'Compact',
  'panel.network.view.popoverWide': 'Large',
  'panel.network.view.showFireDots': 'Afficher les points de déclenchement de règles',

  // Sort ▾ menu
  'panel.network.sort.label': 'Tri',
  'panel.network.sort.heading': 'Ordre de tri',
  'panel.network.sort.byTime': 'Trier par temps.',
  'panel.network.sort.groupPriority': 'Priorité',
  'panel.network.sort.groupPriorityHint': 'Ce qui demande votre attention en premier.',
  'panel.network.sort.groupGrouping': 'Regroupement',
  'panel.network.sort.groupGroupingHint': 'Regrouper les requêtes par catégorie.',
  'panel.network.sort.ascending': 'Croissant',
  'panel.network.sort.descending': 'Décroissant',
  'panel.network.sort.customNested': 'Personnalisé (imbriqué)',
  'panel.network.sort.customNestedIdle': 'Tri multi-clés — colonne par colonne.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} niveau — ouvrir pour modifier.',
      many: '{count} niveaux — ouvrir pour modifier.',
      other: '{count} niveaux — ouvrir pour modifier.',
    }),
  'panel.network.sort.noLevelsYet': "Aucun niveau pour l'instant — ouvrez le constructeur.",
  'panel.network.sort.builderTitle': "Trier par, dans l'ordre",
  'panel.network.sort.builderEmpty': "Aucun niveau pour l'instant. Ajoutez-en un ci-dessous.",
  'panel.network.sort.asc': 'Asc',
  'panel.network.sort.desc': 'Desc',
  'panel.network.sort.removeLevel': 'Supprimer le niveau {n}',
  'panel.network.sort.addLevel': '+ Ajouter un niveau',
  'panel.network.sort.finalTiebreak': 'Départage final : heure de début',
  'panel.network.sort.active': 'Actif',
  'panel.network.sort.apply': 'Appliquer',
  'panel.network.sort.columnClick': 'Personnalisé (clic sur colonne)',
  'panel.network.sort.columnClickIdle': 'Cliquez sur un en-tête de colonne pour trier par celle-ci.',
  'panel.network.sort.columnClickUse': 'cliquez sur un en-tête de colonne pour utiliser ce mode',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Échecs en premier',
  'panel.network.sortMode.failuresSubtitle':
    'Échouées → en attente → redirigées → réussies · heure de début au sein de chaque groupe.',
  'panel.network.sortMode.slowest': 'Plus lentes en premier',
  'panel.network.sortMode.slowestSubtitle':
    "Durée la plus longue en premier · l'heure de début conserve l'ordre de la cascade en cas d'égalité.",
  'panel.network.sortMode.largest': 'Plus volumineuses en premier',
  'panel.network.sortMode.largestSubtitle':
    "Octets transférés les plus gros en premier · heure de début en cas d'égalité.",
  'panel.network.sortMode.browserPriority': 'Priorité du navigateur',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest selon la priorité rapportée par le navigateur · heure de début au sein de chaque niveau.',
  'panel.network.sortMode.byType': 'Par type de ressource',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · heure de début au sein de ' +
    'chaque type.',
  'panel.network.sortMode.byDomain': 'Par domaine',
  'panel.network.sortMode.byDomainSubtitle':
    "Regroupe par nom d'hôte (A → Z) · heure de début au sein de chaque domaine.",
  'panel.network.sortMode.ruleModified': 'Modifiées par une règle en premier',
  'panel.network.sortMode.ruleModifiedSubtitle':
    'Règles appliquées → inférées → aucun déclenchement · heure de début au sein de chaque groupe.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'Quand la requête a démarré.',
  'panel.network.sortMetric.responseTime': 'Quand le premier octet de réponse est arrivé.',
  'panel.network.sortMetric.endTime': "Quand la requête s'est terminée.",
  'panel.network.sortMetric.duration': 'Combien de temps elle a pris — barres alignées sur zéro.',
  'panel.network.sortMetric.latency': "Temps jusqu'au premier octet — barres alignées sur zéro.",

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Déclenchements de règles',
  'panel.network.railAnnotations': 'Annotations',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'Ouvrir dans un nouvel onglet',
  'panel.requestMenu.createApiRequest': 'Créer une requête API',
  'panel.requestMenu.copy': 'Copier',
  'panel.requestMenu.copyUrl': "Copier l'URL",
  'panel.requestMenu.copyAsCurl': 'Copier en cURL',
  'panel.requestMenu.copyAsFetch': 'Copier en fetch',
  'panel.requestMenu.copyRequestHeaders': 'Copier les en-têtes de requête',
  'panel.requestMenu.copyResponseHeaders': 'Copier les en-têtes de réponse',
  'panel.requestMenu.copyResponse': 'Copier la réponse',
  'panel.requestMenu.copyAsHar': 'Copier en HAR',
  'panel.requestMenu.copyAsHarSanitized': 'Copier en HAR (assaini)',
  'panel.requestMenu.copyAllUrls': 'Copier toutes les URL',
  'panel.requestMenu.copyAllAsCurl': 'Tout copier en cURL',
  'panel.requestMenu.copyAllAsHar': 'Tout copier en HAR',
  'panel.requestMenu.copyAllAsHarSanitized': 'Tout copier en HAR (assaini)',
  'panel.requestMenu.blockRequests': 'Bloquer des requêtes',
  'panel.requestMenu.blockUrl': "Bloquer l'URL de la requête",
  'panel.requestMenu.blockDomain': 'Bloquer le domaine de la requête',
  'panel.requestMenu.saveAs': 'Enregistrer sous...',
  'panel.requestMenu.saveThisAsHar': 'Enregistrer celle-ci en HAR',
  'panel.requestMenu.saveThisAsHarSanitized': 'Enregistrer celle-ci en HAR (assaini)',
  'panel.requestMenu.saveAllAsHar': 'Tout enregistrer en HAR',
  'panel.requestMenu.saveAllAsHarSanitized': 'Tout enregistrer en HAR (assaini)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Types de requêtes',
  'panel.network.typeInfo.summary':
    'Restreint la liste à un ou plusieurs types de requêtes. « All » affiche tout ; choisissez des types pour ' +
    'filtrer, ou combinez-en plusieurs.',
  'panel.network.typeInfo.inlineHeading': 'En ligne',
  'panel.network.typeInfo.fetchXhrDesc': 'Appels API — fetch() et XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'Connexions WebSocket.',
  'panel.network.typeInfo.underMoreHeading': 'Sous Plus',
  'panel.network.typeInfo.docCssJsDesc': 'Documents, feuilles de style et scripts.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Polices, images et audio / vidéo.',
  'panel.network.typeInfo.manifestWasmOtherDesc': "Manifestes d'applications web, WebAssembly et tout le reste.",
  'panel.network.sortInfo.summary':
    "Choisit l'ordre de la liste des requêtes. Survolez un groupe pour choisir un mode précis.",
  'panel.network.sortInfo.modesHeading': 'Modes',
  'panel.network.sortInfo.waterfallDesc': 'Par temps — début, réponse, fin, durée ou latence.',
  'panel.network.sortInfo.priorityDesc':
    'Ce qui demande attention en premier — échecs, plus lentes, plus volumineuses.',
  'panel.network.sortInfo.groupingDesc': 'Regrouper par type, domaine ou modification par règle.',
  'panel.network.sortInfo.custom': 'Personnalisé',
  'panel.network.sortInfo.customDesc': 'Cliquez sur un en-tête de colonne, ou construisez un tri imbriqué multi-clés.',

  // Network column `(i)` corpora (titles stay the raw column names)
  'panel.network.colInfo.exampleCaption': 'Exemple de requête',
  'panel.network.colInfo.name.summary':
    'Le nom de fichier de la ressource ou le dernier segment de son chemin — le moyen le plus rapide de ' +
    'reconnaître une ligne.',
  'panel.network.colInfo.name.description':
    "L'icône de tête encode le type de ressource ; l'infobulle de la ligne et la vue de détail portent l'URL " +
    'complète, les en-têtes, la charge utile et le timing.',
  'panel.network.colInfo.path.summary': "Tout ce qui suit l'hôte — le chemin de l'URL plus sa chaîne de requête.",
  'panel.network.colInfo.url.summary':
    "L'URL complète de la requête : schéma, hôte, chemin et paramètres, de bout en bout.",
  'panel.network.colInfo.requestNumber.summary':
    "Un index stable attribué dans l'ordre de découverte des requêtes pendant l'enregistrement, à partir de 1.",
  'panel.network.colInfo.requestNumber.description':
    "Il ne change jamais quand vous retriez, et sert donc aussi de référence vers l'ordre de capture d'origine.",
  'panel.network.colInfo.method.summary': 'Le verbe HTTP utilisé par la requête.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Verbes courants',
  'panel.network.colInfo.method.getDesc': 'Lire une ressource — sans corps, répétable sans risque.',
  'panel.network.colInfo.method.postDesc': 'Créer ou soumettre — porte un corps de requête.',
  'panel.network.colInfo.method.putPatchDesc': 'Remplacer ou mettre à jour partiellement une ressource.',
  'panel.network.colInfo.method.deleteDesc': 'Supprimer une ressource.',
  'panel.network.colInfo.status.summary':
    "Le code de réponse HTTP (p. ex. 200, 404), ou un court libellé d'état quand il n'y a pas de code.",
  'panel.network.colInfo.status.description':
    'Les plages de statut ne sont pas codées par couleur. Un échec véritable — une erreur réseau, tout 4xx/5xx ' +
    'ou un rejet CORS — met toute la ligne en rouge ; une réponse servie depuis le cache ou une ligne sans ' +
    "statut grise la cellule. La phrase de raison (p. ex. « Not Found ») apparaît dans l'infobulle de la cellule.",
  'panel.network.colInfo.status.codeRangesHeading': 'Plages de codes',
  'panel.network.colInfo.status.s2xxDesc': 'Succès — la requête a été reçue et traitée (p. ex. 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': "Redirection — suivez l'en-tête Location vers l'URL suivante.",
  'panel.network.colInfo.status.s4xxDesc': 'Erreur client — la requête était mal formée, non autorisée ou introuvable.',
  'panel.network.colInfo.status.s5xxDesc': "Erreur serveur — le serveur n'a pas pu satisfaire une requête valide.",
  'panel.network.colInfo.status.insteadHeading': "À la place d'un code",
  'panel.network.colInfo.status.pendingDesc':
    "Envoyée, mais aucune réponse n'est encore arrivée — grise tant qu'elle est en vol.",
  'panel.network.colInfo.status.failedDesc':
    'Un échec au niveau réseau (DNS, TLS, délai dépassé, connexion perdue) ; le code de la pile réseau apparaît ' +
    'en ligne.',
  'panel.network.colInfo.status.canceledDesc': "La requête a été interrompue avant d'aboutir.",
  'panel.network.colInfo.status.blockedDesc':
    "Le navigateur l'a refusée pour une raison de politique — p. ex. csp, ou other pour une extension / un " +
    'bloqueur de pub.',
  'panel.network.colInfo.status.corsDesc': 'Un contrôle cross-origin a rejeté la réponse.',
  'panel.network.colInfo.status.dataDesc': "Une URL data: — servie en ligne, n'a jamais touché le réseau.",
  'panel.network.colInfo.status.finishedDesc': 'Une réponse qui ne portait aucun code de statut.',
  'panel.network.colInfo.protocol.summary':
    'La version HTTP négociée par la connexion, choisie au moment du handshake.',
  'panel.network.colInfo.protocol.valuesHeading': 'Valeurs',
  'panel.network.colInfo.protocol.http11Desc': 'Textuel, une requête en vol par connexion.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — binaire et multiplexé sur une seule connexion.',
  'panel.network.colInfo.protocol.h3Desc': "HTTP/3 — repose sur QUIC au-dessus d'UDP pour des handshakes plus rapides.",
  'panel.network.colInfo.scheme.summary': "Le schéma de l'URL — `https`, `http`, `ws` ou `wss`.",
  'panel.network.colInfo.domain.summary': "Le nom d'hôte auquel la requête était adressée.",
  'panel.network.colInfo.remoteAddress.summary': "L'adresse IP et le port réellement atteints par la connexion.",
  'panel.network.colInfo.remoteAddress.description':
    "Diffère du domaine quand le DNS renvoie plusieurs IP, qu'un CDN route par anycast ou qu'un proxy local " +
    'intercepte la connexion.',
  'panel.network.colInfo.type.summary':
    "Le type de ressource attribué par le navigateur — il détermine l'icône de la ligne et les puces de filtre " +
    'au-dessus de la table.',
  'panel.network.colInfo.type.examplesHeading': 'Exemples',
  'panel.network.colInfo.type.documentDesc': 'Une navigation HTML de premier niveau ou dans un cadre.',
  'panel.network.colInfo.type.fetchXhrDesc': 'Une requête de données émise depuis JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Ressources de page chargées par le parseur.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Ressources statiques.',
  'panel.network.colInfo.initiator.summary': "Ce qui a provoqué l'envoi de la requête.",
  'panel.network.colInfo.initiator.kindsHeading': 'Catégories',
  'panel.network.colInfo.initiator.scriptDesc': "Déclenchée depuis JavaScript — la cellule renvoie au site d'appel.",
  'panel.network.colInfo.initiator.parserDesc':
    'Le parseur HTML a trouvé la ressource (un `<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'Une réponse `3xx` a envoyé le navigateur ici.',
  'panel.network.colInfo.initiator.otherDesc': 'Une navigation, un préchargement ou une source non attribuée.',
  'panel.network.colInfo.cookies.summary':
    'Combien de cookies le navigateur a attachés à la requête dans son en-tête `Cookie`. Vide quand il ' +
    "n'y en a aucun.",
  'panel.network.colInfo.setCookies.summary':
    "Combien d'en-têtes `Set-Cookie` la réponse a renvoyés. Vide quand il n'y en a aucun.",
  'panel.network.colInfo.setCookies.description':
    "Ouvrez l'onglet Cookies de la requête pour voir si le navigateur a accepté ou rejeté chacun d'eux.",
  'panel.network.colInfo.size.summary':
    'Les octets qui ont traversé le réseau, en-têtes de réponse et surcoût de compression compris.',
  'panel.network.colInfo.size.insteadHeading': "À la place d'un nombre",
  'panel.network.colInfo.size.diskCacheDesc': "Servie depuis le cache disque — rien n'a touché le réseau.",
  'panel.network.colInfo.size.memoryCacheDesc': 'Servie depuis le cache en mémoire de la page actuelle.',
  'panel.network.colInfo.size.pendingDesc': "La requête n'est pas encore terminée.",
  'panel.network.colInfo.time.summary':
    "Durée active de l'envoi de la requête au dernier octet de réponse — le temps passé en file est exclu.",
  'panel.network.colInfo.time.description':
    'Affiche `0 ms` pour une réponse instantanée ; reste vide tant que la requête est en vol.',
  'panel.network.colInfo.priority.summary':
    'La priorité de récupération attribuée par le navigateur, de `Highest` à `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Les ressources plus prioritaires sont demandées plus tôt et reçoivent une plus grande part de la ' +
    "connexion. Une page peut l'influencer avec l'attribut `fetchpriority`.",
  'panel.network.colInfo.waterfall.summary':
    "Une barre de chronologie par requête. Le menu d'en-tête choisit la métrique, indiquée par une courte " +
    'étiquette comme `Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Étiquettes de métrique',
  'panel.network.colInfo.waterfall.stDesc':
    'Start time — les barres se placent sur une chronologie partagée selon le début de chaque requête.',
  'panel.network.colInfo.waterfall.rtDesc': "Response time — placées selon l'arrivée du premier octet de réponse.",
  'panel.network.colInfo.waterfall.etDesc': 'End time — placées selon la fin de chaque requête.',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration — barres alignées sur zéro, dimensionnées par la durée totale de la requête.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency — barres alignées sur zéro, coupées là où la réponse a commencé.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'Un point marque chaque requête sur laquelle une de vos règles a agi.',
  'panel.network.fireRail.dotColorsHeading': 'Couleurs des points',
  'panel.network.fireRail.appliedDesc':
    "Appliqué — le moteur de règles a confirmé l'exécution de la règle, notre rapporteur en page a confirmé " +
    "l'action, ou la modification est visible dans les en-têtes capturés.",
  'panel.network.fireRail.inferredDesc':
    'Inféré — la règle correspondait, application non vérifiable pour cette requête.',
  'panel.network.fireRail.contradictedDesc':
    "Contredit — la règle revendiquait un changement d'en-tête que les en-têtes capturés réfutent.",
  'panel.network.annotationRail.summary':
    "Signale ce qu'OpenHeaders sait au-delà de ce que montrent les colonnes. Survolez un glyphe pour " +
    "l'explication ; cliquez dessus pour ouvrir les détails.",
  'panel.network.annotationRail.glyphsHeading': 'Glyphes',
  'panel.network.annotationRail.warnDesc':
    "La ligne n'est pas ce qu'elle paraît — p. ex. un transfert interrompu en cours de téléchargement.",
  'panel.network.annotationRail.infoDesc':
    'Contexte de provenance ou de fidélité — jamais terminée, lacune de capture, ligne synthétisée.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  'panel.network.timing.band.beforeWire': 'Planification',
  'panel.network.timing.band.connecting': 'Connexion',
  'panel.network.timing.band.exchange': 'Transfert',
  'panel.network.timing.where.beforeWire': '(Navigateur)',
  'panel.network.timing.where.connecting': '(Navigateur ↔ Réseau)',
  'panel.network.timing.where.exchange': '(Réseau)',
  'panel.network.timing.absent.reused': 'connexion réutilisée',
  'panel.network.timing.absent.notReached': 'non atteinte',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'aucune donnée',
  'panel.network.timing.warmSocketTitle':
    "Pas de handshake TCP sur l'horloge de cette requête — le socket était déjà établi (probablement " +
    "préconnecté). Seul TLS s'est exécuté ici.",
  'panel.network.timing.warmSocketHint': 'socket chaud',
  'panel.network.timing.moment.queued': 'Mise en file',
  'panel.network.timing.moment.started': 'Démarrée',
  'panel.network.timing.moment.response': 'Réponse',
  'panel.network.timing.moment.ended': 'Terminée',
  'panel.network.timing.momentWhy.queued': 'requête créée',
  'panel.network.timing.momentWhy.started': 'sortie de la file',
  'panel.network.timing.momentWhy.response': 'premier octet (TTFB)',
  'panel.network.timing.momentWhy.ended': 'dernier octet, terminé',
  'panel.network.timing.untrackedGaps': 'Intervalles non suivis : {parts}',
  'panel.network.timing.chromeEquivalent':
    "Équivalent Chrome : Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL dessiné à l'intérieur)",
  'panel.network.timing.terminalDetail.noResponse': 'aucune réponse reçue',
  'panel.network.timing.terminalDetail.neverReached': "n'a jamais atteint le réseau",
  'panel.network.timing.keyMoments': 'Moments clés',
  'panel.network.timing.sinceFirstRequest': '(depuis la première requête)',
  'panel.network.timing.timingNotes': 'Notes de timing',
  'panel.network.timing.totalTime': 'Temps total',
  'panel.network.timing.queuedToEnded': '(mise en file → terminée)',
  'panel.network.timing.connectionOpenedBy': '↳ connexion ouverte par {name}',
  'panel.network.timing.notFinishedCaution': "ATTENTION : la requête n'est pas encore terminée !",
  'panel.network.timing.queuedAt': 'Mise en file à {time}',
  'panel.network.timing.startedAt': 'Démarrée à {time}',
  // Separate referent from the rung-state 'non atteinte': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'non atteint',
  'panel.network.timing.onTheWire': '🌐 sur le réseau',
  'panel.network.timing.cdpExplainer':
    'Activez CDP et rechargez avant de naviguer pour obtenir le détail complet de la connexion en temps réel.',

  // Timing `(i)` corpora (rung / terminal titles stay raw)
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Navigateur',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Navigateur ↔ Réseau',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Réseau',
  'panel.network.rungInfo.kickerInstant': 'Timing · Instant',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Issue',
  'panel.network.rungInfo.stripCaption': 'Exemple de requête — {ms} ms de bout en bout',
  'panel.network.rungInfo.stripStop':
    "marqué : là où la requête s'est arrêtée — les phases suivantes n'ont jamais eu lieu",
  'panel.network.rungInfo.stripMarked': 'marqué : {label} à {ms} ms',
  'panel.network.rungInfo.stripGaps': 'en surbrillance : les intervalles non suivis (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'en surbrillance : {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary':
    "Temps que la requête a passé à attendre dans le navigateur avant d'être autorisée à démarrer.",
  'panel.network.rungInfo.queueing.description':
    'Le navigateur diffère les requêtes des ressources moins prioritaires, pendant que les plus prioritaires ' +
    "se chargent d'abord et qu'il vérifie le cache disque. En HTTP/1.x, il attend aussi ici quand tous les " +
    "sockets vers l'hôte sont occupés.",
  'panel.network.rungInfo.stalled.summary':
    "Autorisée à démarrer, mais en attente d'une connexion utilisable avant tout travail réseau.",
  'panel.network.rungInfo.stalled.description':
    "Typiquement en attente qu'un socket se libère ou d'une décision de proxy. Se termine dès que la première " +
    'étape réseau (DNS, TCP ou envoi) démarre.',
  'panel.network.rungInfo.dns.summary': "Résolution du nom d'hôte vers une adresse IP à laquelle se connecter.",
  'panel.network.rungInfo.dns.description':
    'Affiche « connexion réutilisée » quand la requête a emprunté une connexion déjà ouverte — aucune ' +
    "résolution n'était nécessaire sur l'horloge de cette requête.",
  'panel.network.rungInfo.connect.summary':
    "Le handshake TCP seul — l'aller-retour qui ouvre le socket vers le serveur.",
  'panel.network.rungInfo.connect.description':
    "L'onglet Timing de Chrome dessine une seule barre « Initial connection » couvrant cette phase ET le " +
    "handshake TLS (sa barre SSL est dessinée à l'intérieur). Nous les séparons en phases distinctes sans " +
    'chevauchement pour que chaque milliseconde soit comptée exactement une fois — TCP + TLS ici égale la ' +
    'barre Initial connection de Chrome.',
  'panel.network.rungInfo.ssl.summary':
    'Le handshake TLS — négociation des clés et vérification des certificats pour chiffrer la connexion.',
  'panel.network.rungInfo.ssl.description':
    "Uniquement sur les requêtes https:// (n/a en http:// simple). « Connexion réutilisée » signifie qu'une " +
    'requête antérieure a déjà payé ce coût sur le même socket.',
  'panel.network.rungInfo.send.summary':
    'Pousser les octets de la requête — en-têtes et corps éventuel — sur le réseau.',
  'panel.network.rungInfo.send.description':
    'En général bien sous la milliseconde pour les requêtes sans corps ; croît avec les gros envois.',
  'panel.network.rungInfo.wait.summary':
    "Du dernier octet de requête envoyé au premier octet de réponse reçu (temps jusqu'au premier octet).",
  'panel.network.rungInfo.wait.description':
    'Temps de réflexion du serveur plus un aller-retour réseau — la phase où apparaît le travail backend.',
  'panel.network.rungInfo.receive.summary': 'Téléchargement du corps de la réponse, du premier au dernier octet.',
  'panel.network.rungInfo.receive.description':
    "Croît en direct tant qu'une réponse est en cours de diffusion ; la ligne d'avertissement sous le graphique " +
    'signale un téléchargement jamais terminé.',
  'panel.network.rungInfo.notes.summary':
    'Comptabilité des fragments de temps entre les phases — enregistrés de bout en bout, mais ' +
    "n'appartenant à aucune phase.",
  'panel.network.rungInfo.notes.description':
    'Chaque phase est mesurée entre ses propres instants de début et de fin, tandis que le total est mesuré de ' +
    'bout en bout — de minuscules « intervalles non suivis » peuvent donc se glisser entre deux phases ' +
    "(p. ex. entre l'arrivée de la réponse DNS et le début du handshake TCP). C'est pourquoi la somme des " +
    "phases ne donne pas toujours le total. L'onglet Timing de Chrome a les mêmes intervalles et ne les " +
    'dessine simplement pas ; nous les listons pour que chaque milliseconde reste comptabilisée.',
  'panel.network.rungInfo.notes.linesHeading': 'Les lignes',
  'panel.network.rungInfo.notes.gapsLabel': 'Intervalles non suivis',
  'panel.network.rungInfo.notes.gapsDesc': "Chaque intervalle, nommé par les phases qui l'entourent, avec sa durée.",
  'panel.network.rungInfo.notes.chromeLabel': 'Équivalent Chrome',
  'panel.network.rungInfo.notes.chromeDesc':
    'Comment nos phases TCP + TLS séparées correspondent à la barre « Initial connection » unique de Chrome ' +
    "(sa barre SSL est dessinée à l'intérieur de cette barre, pas après).",
  'panel.network.rungInfo.band.beforeWire.summary':
    "Temps passé entièrement dans le navigateur avant tout travail réseau — rien n'a encore quitté la machine.",
  'panel.network.rungInfo.band.beforeWire.description':
    "Queueing (attente de l'autorisation de démarrer) plus Stalled (attente d'une connexion utilisable). Une " +
    'requête lourde ici est retenue localement — par les priorités, les limites de connexions ou des décisions ' +
    'de proxy — pas par le serveur.',
  'panel.network.rungInfo.band.connecting.summary':
    'Mise en place du chemin vers le serveur : résoudre le nom, ouvrir le socket, le chiffrer.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — les allers-retours de handshake. Payé une fois par connexion : une requête qui ' +
    'emprunte un socket déjà ouvert saute toute cette bande (« connexion réutilisée »).',
  'panel.network.rungInfo.band.exchange.summary':
    "L'échange réel sur le réseau : envoyer la requête, attendre le serveur, télécharger la réponse.",
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. La lenteur côté serveur apparaît dans ' +
    'Waiting for server ; les grosses réponses ou les liens lents apparaissent dans Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    "L'instant où le navigateur a créé la requête — le zéro depuis lequel chaque phase de ce détail est mesurée.",
  'panel.network.rungInfo.moment.queued.description':
    'La valeur « à » est le décalage depuis la première requête affichée, pour comparer les lignes sur une ' +
    'même horloge.',
  'panel.network.rungInfo.moment.started.summary':
    "L'instant où la requête a quitté la file et où le travail a réellement commencé.",
  'panel.network.rungInfo.moment.started.description':
    'Mise en file + Queueing. Tout ce qui précède ce repère est de la planification navigateur ; tout ce qui ' +
    'suit est une progression réelle de la requête.',
  'panel.network.rungInfo.moment.response.summary':
    "L'instant où le premier octet de réponse est arrivé (temps jusqu'au premier octet).",
  'panel.network.rungInfo.moment.response.description':
    "Le serveur a répondu ; à partir d'ici le corps se télécharge. Absent quand aucune réponse n'est jamais " +
    'arrivée (bloquée ou échouée avant).',
  'panel.network.rungInfo.moment.ended.summary':
    "L'instant où le dernier octet de réponse est arrivé — la requête est terminée.",
  'panel.network.rungInfo.moment.ended.description':
    'Terminée − Mise en file est le temps total affiché sous le détail ; Terminée − Démarrée est la durée ' +
    'active affichée par la colonne Time.',
  'panel.network.rungInfo.keyMoments.summary':
    'Les instants frontières de la vie de la requête — là où une étape passe la main à la suivante.',
  'panel.network.rungInfo.keyMoments.description':
    "Mise en file et Démarrée existent toujours ; Réponse et Terminée seulement une fois qu'une réponse est " +
    "réellement arrivée (une requête bloquée ou échouée avant montre son marqueur d'issue à la place). Les " +
    'phases ci-dessous sont les intervalles entre ces instants.',
  'panel.network.rungInfo.terminal.whereHeading': "Où elle s'est arrêtée",
  'panel.network.rungInfo.terminal.noResponseDesc':
    "Elle a atteint le réseau, mais aucune réponse n'est jamais revenue.",
  'panel.network.rungInfo.terminal.neverReachedDesc':
    "Elle est morte dans la planification côté navigateur — rien n'a été envoyé.",
  'panel.network.rungInfo.terminal.canceled.summary':
    "La requête a été interrompue avant d'aboutir — le ✗ marque là où elle s'est arrêtée ; les phases " +
    "suivantes n'ont jamais eu lieu.",
  'panel.network.rungInfo.terminal.canceled.description':
    'Causes typiques : la page a navigué ailleurs en cours de chargement, un script a interrompu le fetch, ou ' +
    "l'utilisateur a arrêté le chargement. Le réseau n'avait rien d'anormal — le navigateur a simplement " +
    'renoncé à la réponse.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'Le navigateur a refusé la requête pour une raison de politique — le mot après les deux-points nomme la ' +
    'politique en cause.',
  'panel.network.rungInfo.terminal.stoppedHere':
    "Le ✗ marque là où elle s'est arrêtée ; les phases suivantes n'ont jamais eu lieu.",
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Raisons courantes',
  'panel.network.rungInfo.terminal.blocked.cspDesc':
    'La Content-Security-Policy de la page interdit cette destination.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc':
    'Une ressource http:// non sécurisée sur une page https://.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    "Une extension, un bloqueur de pub ou une règle interne du navigateur l'a refusée.",
  'panel.network.rungInfo.terminal.cors.summary':
    "Un contrôle cross-origin a rejeté la réponse — le serveur a répondu, mais la page n'était pas autorisée à " +
    'la lire.',
  'panel.network.rungInfo.terminal.cors.description':
    "Le serveur doit consentir via Access-Control-Allow-Origin (et consorts) pour qu'une page cross-origin " +
    'lise sa réponse. Le ✗ marque là où le rejet est survenu.',
  'panel.network.rungInfo.terminal.failed.summary':
    'Un échec au niveau du réseau — la connexion elle-même a rompu, et le code net:: nomme la cause exacte.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Codes courants',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': "Le DNS n'a pas trouvé l'hôte.",
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'Le serveur a rejeté ou coupé le socket.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': 'Aucune réponse dans le délai imparti par la pile réseau.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'Le certificat TLS a échoué à la validation.',

  // ── OH row annotations ──────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'Également sur cette ligne',
  'panel.rowAnnotations.openDetails': 'Ouvrir les détails',
  'panel.rowAnnotations.interrupted.label': 'Transfert interrompu',
  'panel.rowAnnotations.interrupted.detail':
    "Le téléchargement a été annulé avant la fin. Le statut reflète les en-têtes arrivés avant l'interruption, " +
    'et les données reçues sont incomplètes — la ligne est par ailleurs impossible à distinguer ' +
    "d'une ligne terminée.",
  'panel.rowAnnotations.neverFinished.label': 'Jamais terminée',
  'panel.rowAnnotations.neverFinished.detail':
    "La page qui a émis cette requête s'est déchargée pendant qu'elle était en vol, si bien qu'aucune issue " +
    "n'a jamais été enregistrée — c'est pourquoi Status et Time affichent « (unknown) ».",
  'panel.rowAnnotations.fidelityGap.label': 'Lacune de fidélité de capture',
  'panel.rowAnnotations.fidelityGap.detail':
    'Les octets transférés et le corps de la réponse ne sont pas visibles par le chemin de capture par défaut ' +
    "pour les requêtes jamais terminées — l'inspection renforcée par CDP les enregistre.",
  'panel.rowAnnotations.syntheticHar.label': 'Ligne synthétisée',
  'panel.rowAnnotations.syntheticHar.detail':
    "Cette ligne a été reconstruite à partir d'un enregistrement de capture qui n'a jamais rejoint une requête " +
    'réelle, si bien que certaines colonnes ne peuvent pas être remplies.',
  'panel.rowAnnotations.syntheticMemory.label': 'Ligne synthétisée',
  'panel.rowAnnotations.syntheticMemory.detail':
    "Cette ligne a été reconstruite à partir du Resource Timing de la page (un hit du cache mémoire n'atteint " +
    'jamais la pile réseau), les en-têtes et cookies ne sont donc pas disponibles.',
  'panel.rowAnnotations.debugPaused.label': 'Pause du mode débogage',
  'panel.rowAnnotations.debugPaused.detail':
    "{ms} ms du temps de cette ligne ont été passées en pause dans l'interception du mode débogage, pas à " +
    "attendre le serveur ou le réseau — le mode débogage a retenu la requête pendant qu'il l'inspectait, le " +
    'temps total de la ligne dépasse donc la durée réelle de la requête.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Réécriture de paramètres de requête',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'Cette redirection est Open Headers appliquant une règle de paramètres de requête, pas le serveur. La ' +
    "réécriture de la chaîne de requête d'une URL s'effectue comme une redirection interne, elle apparaît donc " +
    "comme son propre saut ; la requête continue ensuite vers l'URL réécrite avec sa méthode, son corps, ses " +
    'cookies et ses en-têtes transportés inchangés.',
  'panel.rowAnnotations.redirectRule.label': 'Règle de redirection',
  'panel.rowAnnotations.redirectRule.detail':
    "Cette redirection est Open Headers appliquant une règle de redirection, pas le serveur. Elle s'effectue " +
    "comme une redirection interne, la requête d'origine apparaît donc comme son propre saut avant de " +
    "continuer vers l'URL réécrite.",
  'panel.rowAnnotations.interceptionJoined.label': 'Interception du trafic jointe',
  'panel.rowAnnotations.interceptionJoined.detail':
    'Cet échange a aussi été capturé par l’interception du trafic — le proxy local. Les en-têtes exacts sur le fil, les ' +
    "tailles mesurées et les temps de socket de cette capture complètent ce que la capture navigateur n'a " +
    'pas enregistré elle-même.',
  'panel.rowAnnotations.interceptionSeen.label': 'Vu sur un onglet du navigateur',
  'panel.rowAnnotations.interceptionSeen.detail':
    "Cet échange intercepté a aussi été observé sur l'onglet du navigateur {tab} — les deux lignes sont la " +
    'même requête vue des deux côtés.',
  'panel.rowAnnotations.interceptionSeen.unknownTab': 'un onglet surveillé',
  'panel.rowAnnotations.interceptionSeen.jump': "Afficher dans la source de l'onglet",
} as const satisfies Catalog;
