/**
 * Workbench settings — shell chrome — French. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `Backend` / `MCP` / `shell` as dev loanwords, the DevTools-panel
 * tab names in category labels (Network, Headers, Initiator, Cookies,
 * Timing — panel parity vocabulary), `MIME` / `Hash` / `LAN` /
 * `multipart`, and the {version} / {when} / {message} / {filename} /
 * {sessionId} / {installId} holes. `Données` (Data category) matches
 * the settings path quoted by the system-status doc body.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Paramètres',
  'workbench.settings.shell.openInEditor': "Ouvrir dans l'éditeur",
  'workbench.settings.shell.openInEditorSoon': "Ouvrir dans l'éditeur (bientôt disponible)",
  'workbench.settings.shell.maximize': 'Agrandir',
  'workbench.settings.shell.restoreWindow': 'Restaurer',
  'workbench.settings.shell.hint.search': 'Rechercher',
  'workbench.settings.shell.hint.navigate': 'Naviguer',
  'workbench.settings.shell.hint.select': 'Sélectionner',
  'workbench.settings.shell.hint.clearClose': 'Effacer / Fermer',
  'workbench.settings.shell.noneRegistered': 'Aucun paramètre enregistré.',
  'workbench.settings.shell.resetAll': 'Tout réinitialiser',
  'workbench.settings.shell.resetAllCount': 'Tout réinitialiser ({count})',
  'workbench.settings.shell.resetAllTitle': 'Réinitialiser tous les paramètres ?',
  'workbench.settings.shell.resetAllNone':
    'Rien à réinitialiser — tous les paramètres sont à leurs valeurs par défaut.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Rétablir {count} paramètre à sa valeur par défaut.',
      many: 'Rétablir {count} paramètres à leurs valeurs par défaut.',
      other: 'Rétablir {count} paramètres à leurs valeurs par défaut.',
    }),
  'workbench.settings.shell.resetConfirm': 'Réinitialiser',
  'workbench.settings.shell.searchResults': 'Résultats de recherche',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} correspondance pour',
      many: '{count} correspondances pour',
      other: '{count} correspondances pour',
    }),
  'workbench.settings.shell.noMatchesFor': 'Aucun paramètre ne correspond à',
  'workbench.settings.shell.jumpToCategory': 'Aller à la catégorie',
  'workbench.settings.shell.navAria': 'Catégories de paramètres',
  'workbench.settings.shell.showCategoryNames': 'Afficher les noms des catégories',
  'workbench.settings.shell.otherGroup': 'Autre',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Modifié par rapport au défaut',
  'workbench.settings.row.modifiedAria': 'modifié',
  'workbench.settings.row.resetToDefault': 'Rétablir la valeur par défaut',
  'workbench.settings.row.experimental': 'Expérimental',
  'workbench.settings.row.desktopBadge': 'Bureau',
  'workbench.settings.row.desktopTip':
    "Nécessite une connexion active à l'application de bureau Open Headers. L'application de bureau stocke la " +
    'valeur de référence.',
  'workbench.settings.row.capabilityUnavailable': 'Ce navigateur ne prend pas en charge ce paramètre.',
  'workbench.settings.row.connectionRequired': "Connectez l'application de bureau pour modifier ce paramètre.",
  'workbench.settings.row.aboutAria': 'À propos de {label}',
  'workbench.settings.row.disabledCapabilityAria': 'Désactivé — indisponible sur ce navigateur',
  'workbench.settings.row.disabledConnectionAria': 'Désactivé — nécessite la connexion au bureau',
  'workbench.settings.row.managed': 'Géré par votre organisation',
  'workbench.settings.row.managedBadge': 'Géré',
  'workbench.settings.row.disabledManagedAria': 'Désactivé — géré par votre organisation',
  'workbench.settings.row.run': 'Exécuter',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Backend',
  'workbench.settings.category.backend.description':
    "Où vivent vos espaces de travail, règles, vault et historique. Choisissez l'hôte qui correspond à votre " +
    'portée — local uniquement dans tous les cas.',
  'workbench.settings.category.backend.sub.connection': 'Connexion',
  'workbench.settings.category.backend.sub.reliability': 'Fiabilité',
  'workbench.settings.category.backend.sub.notifications': 'Notifications',
  'workbench.settings.category.backend.sub.lan-peers': 'Pairs LAN',
  'workbench.settings.category.mcp.label': 'IA · Serveur MCP',
  'workbench.settings.category.mcp.description':
    "Laissez les agents IA et les autres clients MCP lire et contrôler cette application. L'accès est étagé — " +
    'lecture, écriture, exécution et révélation de secrets sont des interrupteurs séparés, tous désactivés par ' +
    'défaut.',
  'workbench.settings.category.general.label': 'Général',
  'workbench.settings.category.general.description': "Comportement global de l'application, démarrage et locale.",
  'workbench.settings.category.appearance.label': 'Apparence',
  'workbench.settings.category.appearance.description': 'Thème, densité et présentation visuelle.',
  'workbench.settings.category.workspaceLayout.label': "Disposition de l'espace de travail",
  'workbench.settings.category.workspaceLayout.description':
    "Affordances du pied de page et comportement du shell des fenêtres d'outils.",
  'workbench.settings.category.terminal.label': 'Terminal',
  'workbench.settings.category.terminal.description': "Comportement de la fenêtre d'outils Terminal intégrée.",
  'workbench.settings.category.devpanel.label': 'Panneau DevTools',
  'workbench.settings.category.devpanel.description':
    "Réglages par défaut du panneau DevTools du navigateur — le shell des fenêtres d'outils et chaque onglet " +
    'de la surface des requêtes.',
  'workbench.settings.category.devpanelLayout.label': 'Panneau DevTools · Disposition',
  'workbench.settings.category.devpanelLayout.navLabel': 'Disposition',
  'workbench.settings.category.devpanelLayout.description':
    "Comportement du shell des fenêtres d'outils pour le panneau DevTools du navigateur.",
  'workbench.settings.category.devpanelNetwork.label': 'Panneau DevTools · Network',
  'workbench.settings.category.devpanelNetwork.navLabel': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Réglages par défaut du tableau des requêtes Network dans le panneau DevTools — disposition, tri, colonne ' +
    'de points.',
  'workbench.settings.category.devpanelHeaders.label': 'Panneau DevTools · Headers',
  'workbench.settings.category.devpanelHeaders.navLabel': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    "Réglages par défaut de l'onglet Headers dans le panneau DevTools — disposition, tri, filtres, suggestions.",
  'workbench.settings.category.devpanelInitiator.label': 'Panneau DevTools · Initiator',
  'workbench.settings.category.devpanelInitiator.navLabel': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    "Réglages par défaut de l'onglet Initiator dans le panneau DevTools — tri, filtres, suggestions.",
  'workbench.settings.category.devpanelCookies.label': 'Panneau DevTools · Cookies',
  'workbench.settings.category.devpanelCookies.navLabel': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    "Réglages par défaut de l'onglet Cookies dans le panneau DevTools — colonnes, tri, filtres, suggestions.",
  'workbench.settings.category.devpanelTiming.label': 'Panneau DevTools · Timing',
  'workbench.settings.category.devpanelTiming.navLabel': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    "Réglages par défaut de l'onglet Timing dans le panneau DevTools — quelles bandes sont visibles.",
  'workbench.settings.category.inspection.label': 'Mode débogage',
  'workbench.settings.category.inspection.description':
    'La voie opt-in qui attache le protocole de débogage de votre navigateur — inspectez et modifiez les ' +
    'requêtes avec la même profondeur que les outils de développement intégrés.',
  'workbench.settings.category.trafficMonitor.label': 'Trafic',
  'workbench.settings.category.trafficMonitor.description':
    'Valeurs par défaut du geste « Démarrer l’observation » du panneau Trafic, et budget disque de ' +
    'l’archive de sessions.',
  'workbench.settings.category.editor.label': 'Éditeur de code',
  'workbench.settings.category.editor.description':
    "Police, indentation et options d'affichage des surfaces d'édition de code.",
  'workbench.settings.category.requests.label': 'Requêtes API',
  'workbench.settings.category.requests.description': 'Envoi des requêtes HTTP et traitement des réponses.',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.rulesEngine.label': 'Moteur de règles',
  'workbench.settings.category.rulesEngine.description': 'Comment les règles sont évaluées, compilées et arbitrées.',
  'workbench.settings.category.keyboard.label': 'Clavier',
  'workbench.settings.category.keyboard.description': 'Personnalisez les raccourcis clavier.',
  'workbench.settings.category.keyboard.sub.global': 'Toutes les surfaces',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Espace de travail',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Espace de travail · Disposition',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Espace de travail · Onglets',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Espace de travail · Focus',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Espace de travail · Éditeur',
  'workbench.settings.category.keyboard.sub.popup-general': 'Popup et panneau latéral',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Popup et panneau latéral · Navigation',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Popup et panneau latéral · Actions de ligne',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Popup et panneau latéral · Onglets',
  'workbench.settings.category.workspaceSharing.label': "Partage d'espace de travail",
  'workbench.settings.category.workspaceSharing.description':
    "Préférences d'affichage pour l'aperçu d'import des exports d'espace de travail.",
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Liez cet espace de travail à un dossier sur disque — une arborescence YAML vivante, adaptée à git.',
  'workbench.settings.category.proxy.label': 'Proxy',
  'workbench.settings.category.proxy.description':
    'Le proxy sortant de cet appareil — comment les requêtes atteignent le réseau — et la mise en place ' +
    'de la confiance pour le proxy de capture.',
  'workbench.settings.category.proxyOutbound.label': 'Proxy · Requêtes sortantes',
  'workbench.settings.category.proxyOutbound.navLabel': 'Requêtes sortantes',
  'workbench.settings.category.proxyOutbound.description':
    'Le proxy sortant de cet appareil — comment les requêtes, sessions WebSocket et appels gRPC ' +
    'atteignent le réseau.',
  'workbench.settings.category.proxyTrust.label': 'Proxy · Système',
  'workbench.settings.category.proxyTrust.navLabel': 'Proxy système',
  'workbench.settings.category.proxyTrust.description':
    "L'autorité de certification et les magasins de confiance qui permettent de déchiffrer le trafic " +
    'HTTPS pour inspection — créée sur cette machine, révocable ici.',
  'workbench.settings.category.data.label': 'Données',
  'workbench.settings.category.data.description': 'Diagnostics, import/export et maintenance destructive.',
  'workbench.settings.category.license.label': 'Licence',
  'workbench.settings.category.license.description':
    "Tout ce qu'Open Headers propose aujourd'hui est inclus dans chaque palier — les offres payantes couvrent " +
    "les sièges d'équipe. Le palier gratuit admet jusqu'à 6 utilisateurs actifs par serveur.",
  'workbench.settings.category.updates.label': 'Mises à jour',
  'workbench.settings.category.updates.description':
    'Recherche de mises à jour, canal et comportement de téléchargement.',
  'workbench.settings.category.about.label': 'À propos',
  'workbench.settings.category.about.description': 'Version, licences et informations de build.',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported':
    "Les mises à jour sont gérées par votre canal d'installation dans ce build.",
  'workbench.settings.updatesRow.checking': 'Recherche de mises à jour…',
  'workbench.settings.updatesRow.securityFix':
    'La version {version} corrige un problème de sécurité affectant cette version.',
  'workbench.settings.updatesRow.available': 'La version {version} est disponible.',
  'workbench.settings.updatesRow.packageManager': 'Installez-la via votre gestionnaire de paquets Linux.',
  'workbench.settings.updatesRow.updateAndRestart': 'Mettre à jour et redémarrer',
  'workbench.settings.updatesRow.downloading': 'Téléchargement de {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'La version {version} est prête à installer.',
  'workbench.settings.updatesRow.restartToInstall': 'Redémarrer pour installer',
  'workbench.settings.updatesRow.checkFailed': 'Échec de la vérification de mise à jour : {message}',
  'workbench.settings.updatesRow.retry': 'Réessayer',
  'workbench.settings.updatesRow.upToDate': 'Vous êtes sur la dernière version ({version}).',
  'workbench.settings.updatesRow.checkNow': 'Vérifier maintenant',
  'workbench.settings.updatesRow.releaseNotes': 'Notes de version',
  'workbench.settings.updatesRow.lastChecked': 'Dernière vérification {when}',

  'workbench.settings.terminalProfiles.systemDefault': 'Shell par défaut du système',
  'workbench.settings.terminalProfiles.add': 'Ajouter un profil',
  'workbench.settings.terminalProfiles.edit': 'Modifier le profil',
  'workbench.settings.terminalProfiles.remove': 'Supprimer le profil',
  'workbench.settings.terminalProfiles.addTitle': 'Ajouter un profil de terminal',
  'workbench.settings.terminalProfiles.editTitle': 'Modifier le profil de terminal',
  'workbench.settings.terminalProfiles.name': 'Nom',
  'workbench.settings.terminalProfiles.shell': 'Chemin du shell',
  'workbench.settings.terminalProfiles.args': 'Arguments',
  'workbench.settings.terminalProfiles.cwd': 'Répertoire de départ',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Répertoire personnel',
  'workbench.settings.terminalProfiles.save': 'Enregistrer',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Renommer le fichier',
  'workbench.settings.fields.files.renameMissing': "Le fichier n'existe plus dans cet espace de travail",
  'workbench.settings.fields.files.renameFailed': 'Impossible de renommer le fichier',
  'workbench.settings.fields.files.renameFailedReason': 'Impossible de renommer le fichier : {message}',
  'workbench.settings.fields.files.colFilename': 'Nom de fichier',
  'workbench.settings.fields.files.colSize': 'Taille',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Actions',
  'workbench.settings.fields.files.download': 'Télécharger',
  'workbench.settings.fields.files.deleteTitle': 'Supprimer {filename} ?',
  'workbench.settings.fields.files.deleteWarning': "Les parties multipart référençant ce fichier échoueront à l'envoi.",
  'workbench.settings.fields.files.loading': 'Chargement des fichiers…',
  'workbench.settings.fields.files.empty':
    "Aucun fichier pour le moment — utilisez l'action Téléverser un fichier ci-dessus.",
  'workbench.settings.fields.keyValue.keyPlaceholder': 'clé',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'valeur',
  'workbench.settings.fields.keyValue.addEntry': 'Ajouter une entrée',
  'workbench.settings.fields.keybinding.pressCombo': 'Appuyez sur une combinaison de touches…',
  'workbench.settings.fields.keybinding.record': 'Capturer',
  'workbench.settings.fields.keybinding.cancel': 'Annuler',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'Voir les événements',
  'workbench.settings.telemetryRow.modalTitle': 'Événements de télémétrie de cette session',
  'workbench.settings.telemetryRow.sessionOn': 'Session {sessionId} — le comptage est activé',
  'workbench.settings.telemetryRow.sessionOff': 'Session {sessionId} — le comptage est désactivé',
  'workbench.settings.telemetryRow.install':
    'Installation {installId} (aléatoire — identifie cette installation, pas vous)',
  'workbench.settings.telemetryRow.noInstall': "Aucun identifiant d'installation — le comptage est désactivé",
  'workbench.settings.telemetryRow.empty': 'Aucun événement de télémétrie enregistré cette session.',
  'workbench.settings.telemetryRow.confirmTitle': 'Désactiver le comptage anonyme d’utilisation ?',
  'workbench.settings.telemetryRow.confirmHeading': 'Votre vie privée est déjà protégée',
  'workbench.settings.telemetryRow.confirmIntro':
    'Un identifiant aléatoire compte cette installation — jamais vous. Aucune donnée personnelle n’est jamais collectée. Voici ce que fait le comptage :',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Montre quelles fonctionnalités méritent d’être développées',
  'workbench.settings.telemetryRow.confirmPointScope':
    'Ne compte que l’usage des fonctionnalités, la plateforme et la version de l’application',
  'workbench.settings.telemetryRow.confirmPointInspect':
    'Chaque événement reste visible octet par octet dans « Voir les événements »',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'Aucune donnée personnelle',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'Aucune URL ni en-tête',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'Aucun contenu de requête',
  'workbench.settings.telemetryRow.confirmKeep': 'Garder le comptage activé',
  'workbench.settings.telemetryRow.confirmDisable': 'Désactiver quand même',
} as const satisfies Catalog;
