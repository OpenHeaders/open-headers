/**
 * Shared chrome family — French. Mirrors `catalogs/en/shared-chrome.ts`
 * key for key; see that file for the family rules and the raw-by-design
 * plane (browser banner quoted verbatim, nav / worker / OOPIF,
 * xhr/fetch, boot.interactive).
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Mode débogage',
  'shared.chrome.debug.titleShort': 'Débogage',
  'shared.chrome.debug.unavailableHint': 'Le mode débogage est disponible dans Chrome et Edge.',
  'shared.chrome.debug.toggleAria': 'Activer/désactiver le mode débogage',
  'shared.chrome.debug.aboutTooltip': 'À propos du mode débogage',
  'shared.chrome.debug.openDocsAria': 'Ouvrir la documentation du mode débogage',
  'shared.chrome.debug.controlsAria': 'Commandes du mode débogage',
  'shared.chrome.debug.turnOn': 'Activer le mode débogage',
  'shared.chrome.debug.turnOff': 'Désactiver le mode débogage',
  'shared.chrome.debug.scopeDevtools': 'Où DevTools est ouvert',
  'shared.chrome.debug.scopeActive': "L'onglet actif",
  'shared.chrome.debug.scopeBoth': 'Les deux',
  'shared.chrome.debug.attachTo': 'Attacher à',
  'shared.chrome.debug.includeThisTab': 'Inclure cet onglet du navigateur',
  'shared.chrome.debug.pinThisTabAria': 'Épingler cet onglet du navigateur',
  'shared.chrome.debug.attachedTabs': 'Onglets attachés',
  'shared.chrome.debug.noTabsAttached': 'Aucun onglet attaché pour le moment',
  'shared.chrome.debug.bannerNote':
    'Tant que le mode débogage est actif, le bandeau du navigateur « OH started debugging this browser » ' +
    "s'affiche sur tous les onglets — pas seulement ceux auxquels il est attaché.",
  'shared.chrome.debug.tabNumber': 'Onglet #{number}',
  'shared.chrome.debug.tabFallback': 'Onglet {id}',
  'shared.chrome.debug.onThisTab': 'Vous êtes sur cet onglet',
  'shared.chrome.debug.switchTo': 'Passer à {target}',
  'shared.chrome.debug.dormantTooltip':
    'Le mode débogage est actif, mais cet onglet est hors de son périmètre — les effets nav / worker / OOPIF de ' +
    'vos règles de niveau débogage y sont dormants. Ramenez-le dans le périmètre depuis le mode débogage ' +
    "(changez le périmètre ou épinglez cet onglet). Elles s'exécutent toujours sur les requêtes de page (xhr/fetch).",
  'shared.chrome.debug.tabOutOfScope': 'Onglet hors périmètre',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'Système',
  'shared.chrome.status.aria': 'État du système : {summary}',
  'shared.chrome.status.aboutTooltip': 'À propos de ce panneau',
  'shared.chrome.status.openDocsAria': "Ouvrir la documentation de l'état du système",
  'shared.chrome.status.healthy': 'Sain',
  'shared.chrome.status.failure': 'Défaillance',
  'shared.chrome.status.issues': 'Problèmes',
  'shared.chrome.status.noEvents': 'Aucun événement pour le moment',
  'shared.chrome.status.subsystemSync': 'Synchronisation',
  'shared.chrome.status.subsystemRules': 'Règles',
  'shared.chrome.status.subsystemRequests': 'Requêtes',
  'shared.chrome.status.subsystemPermissions': 'Autorisations',
  'shared.chrome.status.subsystemSecrets': 'Secrets',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Activité',
  'shared.chrome.status.subsystemDebugMode': 'Mode débogage',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (bêta)',
  'shared.chrome.status.buildNumber': 'build {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': "Relancer l'application",
  'shared.chrome.status.backendOff': 'Arrêté',
  'shared.chrome.status.backendConnecting': 'Connexion…',
  'shared.chrome.status.companionDesktopApp': 'App de bureau',
  'shared.chrome.status.companionExtensions': 'Extensions',
  'shared.chrome.status.companionConnected': 'Connectée',
  'shared.chrome.status.companionNotConnected': 'Non connectée',
  'shared.chrome.status.companionInstalledNotConnected': 'Installée · non connectée',
  'shared.chrome.status.companionNotInstalled': 'Non installée',
  'shared.chrome.status.companionDownload': 'Télécharger',
  'shared.chrome.status.companionPeersConnected': '{count} connectée(s)',
  'shared.chrome.status.companionNoPeers': 'Aucune connectée',
  'shared.chrome.status.companionConnect': 'Connecter',
  'shared.chrome.status.companionOpenApp': "Ouvrir l'app",
  'shared.chrome.addons.title': 'Modules',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Serveur',
  'shared.chrome.addons.cliSetUp': 'Configurée',
  'shared.chrome.addons.cliNotSetUp': 'Non configurée',
  'shared.chrome.addons.cliStale': 'Jeton révoqué — reconfigurez',
  'shared.chrome.addons.cliExternal': 'Config externe',
  'shared.chrome.addons.cliMalformed': 'Config malformée',
  'shared.chrome.addons.cliProvision': 'Configurer',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'Activé',
  'shared.chrome.addons.mcpTurnOn': 'Activer',
  'shared.chrome.addons.notConfigured': 'Non configuré',
  'shared.chrome.addons.requiresDesktop': "Nécessite l'application de bureau",
  'shared.chrome.addons.cliViaDesktop': "À configurer depuis l'application de bureau",
  'shared.chrome.status.coldStart': 'Démarrage à froid',
  'shared.chrome.status.coldStartMessage': "Régression de performance détectée — voir l'export de diagnostic",
  'shared.chrome.status.coldStartTooltip':
    'Trois réveils à froid consécutifs ont dépassé la référence de ≥20%. Échantillons boot.interactive ' +
    'récents (ms) : {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Mise à jour Open Headers',
  'shared.chrome.updates.downloading': 'Téléchargement…',
  'shared.chrome.updates.downloadingPercent': 'Téléchargement… {percent} %',
  'shared.chrome.updates.updateAndRestart': 'Mettre à jour et redémarrer',
  'shared.chrome.updates.ignore': 'Ignorer cette mise à jour',
  'shared.chrome.updates.remindLater': 'Me le rappeler plus tard',
  'shared.chrome.updates.nowAvailableSuffix': 'est maintenant disponible !',
  'shared.chrome.updates.moreDetailsPrefix': 'Pour plus de détails, consultez les',
  'shared.chrome.updates.releaseNotes': 'notes de version',
  'shared.chrome.updates.updatingTo': 'Mise à jour de {from} vers {to}.',
  'shared.chrome.updates.configure': 'Configurer les mises à jour…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': 'Télécharger {version}',
  'shared.chrome.gearMenu.versionAvailable': '{version} disponible…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Mettre à jour vers {version} et redémarrer',
  'shared.chrome.gearMenu.downloadingVersion': 'Téléchargement de {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Redémarrer pour installer {version}',
  'shared.chrome.gearMenu.settings': 'Paramètres…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Raccourcis clavier…',
  'shared.chrome.gearMenu.appearance': 'Apparence…',
  'shared.chrome.gearMenu.about': "À propos d'Open Headers",
  'shared.chrome.gearMenu.tourGuide': 'Visite guidée',
  'shared.chrome.gearMenu.signOut': 'Se déconnecter',
  'shared.chrome.gearMenu.searchPlaceholder': 'Rechercher',
  'shared.chrome.gearMenu.noMatches': 'Aucune correspondance',
  'shared.chrome.gearMenu.settingsTooltip': 'Paramètres',
  'shared.chrome.gearMenu.settingsMenuAria': 'Menu des paramètres',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Processus',
  'shared.chrome.tasks.hidePanelAria': 'Masquer le panneau des processus',
  'shared.chrome.tasks.allCompleted': 'Toutes les tâches en arrière-plan sont terminées',
  'shared.chrome.tasks.aboutNoteAria': 'À propos de cette note',
  'shared.chrome.tasks.stop': 'Arrêter',
  'shared.chrome.tasks.keepRunning': 'Laisser tourner',
  'shared.chrome.tasks.stopTaskAria': 'Arrêter la tâche en arrière-plan',
  'shared.chrome.tasks.hideTaskAria': 'Masquer la tâche en arrière-plan',
  'shared.chrome.tasks.hideProcesses': 'Masquer les processus',
  'shared.chrome.tasks.hideProcessesCount': 'Masquer les processus ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': '{unit} par défaut — les nouveaux {units} héritent de cette disposition.',
  'shared.chrome.donor.nonDefaultTooltip':
    'Un autre {unit} est le donneur par défaut — les nouveaux {units} héritent de sa disposition.',
  'shared.chrome.donor.isDonorBody':
    'Ce {unit} est le défaut actuel. Les nouveaux {units} héritent de cette disposition.',
  'shared.chrome.donor.nonDonorBody':
    'Un autre {unit} est le défaut actuel. Les nouveaux {units} héritent de la disposition de ce {unit}.',
  'shared.chrome.donor.reset': 'Rétablir la disposition par défaut',
  'shared.chrome.donor.defaultAria': "{unit} par défaut pour l'héritage des nouveaux {unit}",
  'shared.chrome.donor.nonDefaultAria': "Pas le {unit} par défaut pour l'héritage des nouveaux {unit}",
  'shared.chrome.donor.defaultLabel': '{unit} par défaut',
  'shared.chrome.donor.inheritsLabel': 'Hérite de la disposition',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'États du cycle de vie',
  'shared.chrome.lifecycle.scratch': 'Esquisse',
  'shared.chrome.lifecycle.scratchBody':
    "Brouillon non enregistré. Rien n'est conservé tant que vous n'enregistrez pas.",
  'shared.chrome.lifecycle.unresolved': 'Non résolu',
  'shared.chrome.lifecycle.unresolvedBody': 'Contient des {{ref}} qui ne se résolvent pas dans la portée active.',
  'shared.chrome.lifecycle.draft': 'Brouillon',
  'shared.chrome.lifecycle.draftBody':
    'Enregistrée mais pas encore Live — champs requis manquants, ou pas encore publiée.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Publiée et active.',
} as const satisfies Catalog;
