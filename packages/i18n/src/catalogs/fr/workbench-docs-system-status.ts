/**
 * Workbench Docs panel — the System Status section body — French.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals, state tokens, and the popover status
 * messages the doc quotes (Connected to desktop, N workflows fresh, …)
 * ride RAW — they are untranslated wire output, same class as the
 * quoted browser phrasing law. Subsystem display names copy the
 * shipped `shared-chrome.ts` fr labels (`Synchronisation`, `Règles`,
 * `Requêtes`, `Autorisations`, `Secrets`, `Live`, `État du système`).
 * `Envoyer` (Send button) and the settings path `Application › Données
 * → Exporter le journal de diagnostic` are minted here — the
 * editors-request and settings fr files must reuse them.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': "L'état du système",
  'workbench.docs.body.systemStatus.intro1':
    "est un instantané en direct de la santé de l'extension. Le pied de page du workbench l'affiche comme une rangée de huit pastilles — une pastille par sous-système, chacune avec son propre point coloré. Le popup et le panneau latéral le replient en une seule entrée",
  'workbench.docs.body.systemStatus.intro1Suffix':
    'dans leur pied de page, la couleur du point suivant le sous-système dans le pire état.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    "Dans l'éditeur d'espace de travail, la rangée se trouve dans le pied de page, une pastille par sous-système.",
  'workbench.docs.body.systemStatus.popupCaption':
    "Cliquez l'icône de la barre d'outils : le même état apparaît comme une pastille unique étiquetée dans le " +
    'pied de page du popup.',
  'workbench.docs.body.systemStatus.worstLevel1':
    'Chaque sous-système rapporte un seul état et le pire niveau gagne : rouge > jaune > vert. Un seul rouge ' +
    'quelque part fait passer le point composite au rouge.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Huit états de sous-système se replient en un composite via max — le rouge bat le jaune, qui bat le vert.',
  'workbench.docs.body.systemStatus.popover1':
    "Cliquer sur n'importe quelle pastille ouvre le même popover de détails. Les lignes se rangent sous quatre groupes titrés — Connexion, Intercepteur navigateur, Requêtes API et Application — dans un ordre fixe. Une ligne reste grise jusqu'au premier rapport de son sous-système dans cette vie du service worker, puis devient colorée. L'historique complet vit dans le journal d'observabilité — exportez depuis",
  'workbench.docs.body.systemStatus.settingsExportPath': 'Application › Données › Exporter le journal de diagnostic',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Quatre groupes titrés dans un ordre fixe ; au premier rapport, une ligne devient colorée et garde sa place.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'vert',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'jaune',
  'workbench.docs.body.systemStatus.stateRedLabel': 'rouge',
  'workbench.docs.body.systemStatus.syncName': 'Synchronisation',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Connexions au back-end',
  'workbench.docs.body.systemStatus.sync1Prefix':
    "Regroupe chaque back-end dont cette surface est cliente — l'application de bureau sur cette machine (",
  'workbench.docs.body.systemStatus.sync1Suffix':
    ") et tout OpenHeaders Server — en une seule ligne : la pire connexion décide de l'étiquette, et chaque back-end a sa propre ligne en dessous dans le popover. Sans back-end configuré, la ligne indique « En cours dans ce navigateur » — l'extension est son propre back-end.",
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    "Un WebSocket par back-end — ici l'application de bureau sur localhost ; un serveur est le même lien via le réseau.",
  'workbench.docs.body.systemStatus.sync2':
    "Chaque liaison rapporte deux couches. Le socket : connexion, reconnexion avec attente exponentielle après une coupure, connecté — des pings périodiques détectent les déconnexions silencieuses derrière les proxys d'entreprise stricts. Par-dessus, le handshake : en négociation, rattrapage des changements manqués, synchronisé. Au sein d'un back-end, le dernier rapport gagne ; entre back-ends, le pire état gagne.",
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Désactivé, Connecté et Synchronisé sont verts ; Connexion, Reconnexion, Rattrapage et URL rejetée sont jaunes.',
  'workbench.docs.body.systemStatus.sync3':
    "Une application de bureau ou un serveur est aussi un back-end pour d'autres, et ce rôle rejoint le même cumul : la liaison du tube des extensions — rouge quand une autre instance tient le port, jaune pendant le démarrage — et, une fois liée, combien d'extensions sont connectées et si c'est depuis cet appareil ou le LAN. Un espace de travail lié à git ajoute son nombre de changements non validés.",
  'workbench.docs.body.systemStatus.syncGreenSynced': 'Synchronisé avec le back-end',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connecté au back-end',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Synchronisation back-end désactivée',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': 'En cours dans ce navigateur',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    "— le handshake est terminé, le socket est ouvert avec le handshake encore en attente, la connexion automatique est désactivée, ou aucun back-end n'est configuré. Un hôte qui sert rapporte plutôt ses pairs :",
  'workbench.docs.body.systemStatus.syncGreenIdle': 'Inactif — aucune extension connectée',
  'workbench.docs.body.systemStatus.syncGreenPeers': 'Connecté à N extensions sur cet appareil',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(ou sur le LAN).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connexion au back-end…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnexion (tentative N)',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': 'Handshake avec le back-end…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': 'Rattrapage des changements…',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'URL de bureau rejetée par les réglages',
  'workbench.docs.body.systemStatus.syncYellowOff':
    '<back-end> est éteint — ses espaces de travail ne se synchronisent pas',
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '— un socket en train de monter ou de revenir, un handshake en cours, un enregistrement sans URL utilisable, ou un back-end rejoint qui est éteint. Un hôte qui sert ajoute',
  'workbench.docs.body.systemStatus.syncYellowPipe': 'Démarrage du tube des extensions…',
  'workbench.docs.body.systemStatus.syncYellowGit': 'N changements non validés',
  'workbench.docs.body.systemStatus.syncYellowSuffix': 'pour un espace de travail lié à git.',
  'workbench.docs.body.systemStatus.syncRedRejected': 'Le back-end a rejeté le handshake',
  'workbench.docs.body.systemStatus.syncRedTimedOut': "Le back-end n'a pas répondu au handshake — nouvelle tentative",
  'workbench.docs.body.systemStatus.syncRedCatchUp': 'Échec du rattrapage',
  'workbench.docs.body.systemStatus.syncRedExplain':
    "— le serveur a refusé le handshake (protocole incompatible, espace de travail inconnu, authentification manquante ; la ligne nomme la raison), n'a jamais répondu, ou la relecture de rattrapage a échoué. Un hôte qui sert ajoute",
  'workbench.docs.body.systemStatus.syncRedPipe': 'Tube des extensions hors ligne — le port N est déjà utilisé',
  'workbench.docs.body.systemStatus.syncRedSuffix': 'quand une autre instance tient le port.',
  'workbench.docs.body.systemStatus.activityName': 'Activité',
  'workbench.docs.body.systemStatus.activitySubtitle': "Fil d'activité",
  'workbench.docs.body.systemStatus.activity1':
    "Compte les entrées non lues du fil d'activité de l'espace de travail actif — les changements arrivés par la synchronisation : une entité créée, modifiée, supprimée ou déplacée, une modification locale supplantée, un champ sensible renouvelé, une portée de permission élargie, un agent IA observant le trafic.",
  'workbench.docs.body.systemStatus.activity2':
    "Seul l'espace de travail actif compte. Les entrées d'un autre espace de travail tombent toujours dans son propre fil, et y basculer relit le compte depuis le journal — aucun espace de travail ne porte le badge d'un autre.",
  'workbench.docs.body.systemStatus.activityGreenLabel': 'Activité à jour',
  'workbench.docs.body.systemStatus.activityGreenSuffix': "— rien de non lu dans l'espace de travail actif.",
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N nouvelles · <titre>',
  'workbench.docs.body.systemStatus.activityYellowMiddle':
    "— des entrées non lues, titrées par la plus récente, jusqu'à la lecture du fil.",
  'workbench.docs.body.systemStatus.activityRed': "Réservé ; aucun chemin de code ne l'émet aujourd'hui.",
  'workbench.docs.body.systemStatus.rulesName': 'Règles',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'Moteur declarativeNetRequest',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Rapporte chaque reconstruction DNR. Chaque enregistrement fait passer votre règle par quatre étapes avant ' +
    'sa mise en service : compiler en JSON DNR, résoudre les références',
  'workbench.docs.body.systemStatus.rules1Middle':
    ', faire respecter le plafond de règles actives, puis appliquer dans Chrome via',
  'workbench.docs.body.systemStatus.rules1Suffix':
    "— l'API du navigateur. Chaque étape peut faire basculer la pastille.",
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    "Quatre étapes — chacune peut émettre un niveau d'état si elle dérape.",
  'workbench.docs.body.systemStatus.rules2':
    'Le nombre de règles actives correspond à un état sur une barre de capacité à trois zones. Les règles ' +
    "au-delà du plafond sont écartées dans l'ordre de correspondance (le haut gagne), et le message jaune porte " +
    'le nombre de règles écartées.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    "Vert jusqu'au seuil d'avertissement, jaune jusqu'au plafond, rouge au-delà — mais la troncature vous garde " +
    "hors de la zone rouge à l'exécution.",
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'ou',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Des références',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'non résolues (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), le plafond de règles a été dépassé (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': '), ou vous approchez de la capacité DNR (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Défaillance de transport — Chrome a rejeté la mise à jour des règles dynamiques ou de session (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Requêtes',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'Exécuteur de requêtes API',
  'workbench.docs.body.systemStatus.requests1Prefix': 'Reflète la dernière requête API ad hoc lancée depuis le bouton',
  'workbench.docs.body.systemStatus.requestsSend': 'Envoyer',
  'workbench.docs.body.systemStatus.requests1Middle': "de l'éditeur de requête. La pastille passe au vert pour",
  'workbench.docs.body.systemStatus.requestsAny': "n'importe quelle",
  'workbench.docs.body.systemStatus.requests1Suffix':
    "réponse HTTP — y compris 4xx et 5xx — parce que « la requête s'est terminée » est une question distincte " +
    'de « le serveur a apprécié ». Seules les défaillances de niveau réseau sans réponse la font passer au jaune.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    "N'importe quel code de statut = vert. Le jaune est réservé aux échecs sans réponse en retour.",
  'workbench.docs.body.systemStatus.requests2Prefix':
    'Le trafic en arrière-plan ne met pas cette pastille à jour : les actualisations de workflows Live passent',
  'workbench.docs.body.systemStatus.requests2Suffix':
    ", et les requêtes des pages web passent par le moteur de Règles, pas par l'exécuteur.",
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Seul le trafic ad hoc du bouton Envoyer façonne cette pastille — tout le reste reste silencieux.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': "— n'importe quelle réponse HTTP (p. ex.",
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— échec de niveau réseau avant toute réponse (p. ex.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', hors ligne/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Autorisations',
  'workbench.docs.body.systemStatus.permissionsSubtitle': "Audit des autorisations d'hôte",
  'workbench.docs.body.systemStatus.permissions1Prefix':
    'Les règles DNR et les scripts de contenu ciblant un hôte révoqué depuis',
  'workbench.docs.body.systemStatus.permissions1Middle':
    "ne génèrent pas d'erreur — ils ne font silencieusement rien. Tout le travail de cet audit est de faire " +
    'remonter cet état caché, faute de quoi vous passeriez 30 minutes à déboguer une règle qui',
  'workbench.docs.body.systemStatus.permissionsLooks': 'semble',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'correcte.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    "Accordée : la règle se déclenche. Restreinte : la règle ne fait silencieusement rien et l'en-tête " +
    "n'arrive jamais.",
  'workbench.docs.body.systemStatus.permissions2Prefix': "L'audit interroge",
  'workbench.docs.body.systemStatus.permissions2Suffix':
    "à chaque réveil du service worker. MV3 n'a pas d'observateur de changement d'autorisations dans Chromium, " +
    "donc l'interrogation au réveil est le signal le moins coûteux disponible.",
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    "Un appel, trois branches — vert si accordées, rouge si restreintes, jaune si l'appel d'API lui-même échoue.",
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'est toujours dans le périmètre.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': "— inhabituel ; le navigateur n'a pas exposé",
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    "— certaines règles ne feront silencieusement rien sur les hôtes révoqués jusqu'à ce que l'accès soit " +
    'rétabli depuis',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.debugModeName': 'Mode débogage',
  'workbench.docs.body.systemStatus.debugModeSubtitle': "État d'attachement du débogueur",
  'workbench.docs.body.systemStatus.debugMode1':
    "Reflète le débogueur que le mode débogage attache aux onglets pour corréler exactement les requêtes. Éteint rapporte vert — un défaut n'a pas d'importance tant que l'interrupteur est éteint. Allumé, la ligne compte les onglets attachés ; un onglet dont le navigateur a refusé l'attachement la passe au rouge, un onglet retombé sur le chemin heuristique la passe au jaune.",
  'workbench.docs.body.systemStatus.debugMode2':
    "Les navigateurs sans API de débogueur n'installent jamais ce rapporteur : la ligne y reste grise et le chemin heuristique est le seul.",
  'workbench.docs.body.systemStatus.debugModeGreenOff': 'Éteint',
  'workbench.docs.body.systemStatus.debugModeGreenOr': 'ou',
  'workbench.docs.body.systemStatus.debugModeGreenOn': 'Allumé · N onglets',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix':
    "— l'interrupteur est éteint, ou allumé avec chaque onglet attaché en bonne santé.",
  'workbench.docs.body.systemStatus.debugModeYellowLabel': "L'onglet N est retombé sur l'heuristique",
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    "— le débogueur s'est détaché de cet onglet (une bannière annulée, par exemple) et l'onglet est corrélé par le chemin heuristique jusqu'au rattachement.",
  'workbench.docs.body.systemStatus.debugModeRedLabel': "Échec de l'attachement à l'onglet N",
  'workbench.docs.body.systemStatus.debugModeRedMiddle':
    "— le navigateur a refusé l'attachement, en général parce qu'un autre débogueur tient déjà l'onglet.",
  'workbench.docs.body.systemStatus.secretsName': 'Secrets',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Intégrité du vault',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Suit le blob chiffré du vault par espace de travail dans',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. À chaque réveil du service worker, chaque secret stocké est validé contre le schéma courant ; les ' +
    'entrées qui échouent à la validation sont écartées du vault en mémoire et la pastille passe au jaune ' +
    "jusqu'à leur réenregistrement.",
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    "L'hydratation charge le blob ; le validateur de schéma garde les entrées conformes, écarte les dérives et " +
    'rapporte du jaune.',
  'workbench.docs.body.systemStatus.secrets2':
    "« Dérive » signifie généralement qu'une entrée stockée a été écrite par un build plus ancien (un champ " +
    "désormais requis manque, ou un champ a le mauvais type). Le travail du validateur est d'échouer " +
    'bruyamment — hériter en silence de formes inconnues est ce qui cause le bug six versions plus tard.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Les deux mêmes champs côte à côte : une entrée valide contre une entrée en dérive, avec un cipher ' +
    'manquant et un createdAt mal typé.',
  'workbench.docs.body.systemStatus.secretsGreen':
    'Par défaut — aucun événement de dérive de schéma dans cette vie du service worker.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '— au moins une entrée stockée du vault ne correspondait pas à la forme courante et a été écartée à ' +
    "l'hydratation. La réenregistrer depuis l'éditeur du Vault la restaure.",
  'workbench.docs.body.systemStatus.secretsRed':
    "Réservé aux échecs de déchiffrement ; aucun chemin de code ne l'émet aujourd'hui.",
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Actualisation des workflows de variables Live',
  'workbench.docs.body.systemStatus.live1Prefix':
    "Chaque workflow Live s'actualise à sa propre cadence. L'état par workflow repose sur trois " +
    "vérifications : le dernier extracteur a-t-il réussi, l'exécution est-elle dans les",
  'workbench.docs.body.systemStatus.live1Suffix':
    "de sa cadence, et combien d'échecs consécutifs il a subis. Les trois états se replient dans la pastille " +
    'via « le pire gagne ».',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Fresh = exécution propre · stale = au-delà de 2× la cadence ou 1–4 échecs · failing = ≥ 5 échecs consécutifs.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Seuls les workflows de',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': "l'espace de travail actif",
  'workbench.docs.body.systemStatus.live2Suffix':
    'contribuent. Les espaces de travail inactifs sont exclus — vous ne pouvez ni voir ni agir sur ces règles ' +
    "en ce moment, donc les signaler ferait remonter du bruit hors de votre portée. Changer d'espace de " +
    'travail recalcule la pastille sur le nouvel ensemble actif.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    "Les workflows de l'espace de travail actif se replient en une pastille via max() ; les autres espaces de " +
    'travail sont ignorés.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    "— la dernière exécution de chaque workflow de l'espace actif était OK et dans les 2× de sa cadence. Aussi " +
    'affiché comme',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': "quand il n'y en a aucun.",
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— au moins une exécution dépasse 2× la cadence, le dernier extracteur a échoué, ou il y a 1–4 échecs ' +
    'consécutifs.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— un workflow a franchi cinq échecs consécutifs et est désormais considéré comme défaillant.',
} as const satisfies Catalog;
