/**
 * Workbench settings — custom pane components — French. Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: `back-end` / `daemon` / `vault` / `workflow` / `seed` /
 * `Org` (f.) as dev loanwords, networking vocabulary (loopback, LAN,
 * WAN, RFC1918, mDNS, CGNAT, ULA, APIPA, TLS, `ws://` / `wss://`),
 * IANA port constants (1024 / 49152 / 65535), IP literals and range
 * notes' technical tokens (fd00::/8, 100.64/10, Docker, Tailscale,
 * Bonjour / Avahi), `MCP` / `SSO` / `RBAC` / `CLI` / `oh` /
 * `streamable HTTP`, snippet filenames (claude_desktop_config.json),
 * the `oh-license.…` key prefix (web.ts precedent) and the {chord} /
 * {token} / {url} holes. Settings paths quote the fr shell mints
 * (`Paramètres → Backend`); `Administration du daemon` copies the
 * fr/workbench-daemon-admin title; `palier` / `siège` / `annuaire`
 * reuse the daemon-admin + settings-defs register; `Préréglage de
 * raccourcis` and `Capturer` reuse fr/workbench-settings-defs-keyboard
 * + fr/workbench-settings mints. Token rotation rides the
 * `renouveler` / `renouvellement` family.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.intro.whoLabel': 'Qui :',
  'workbench.settings.backendPane.intro.whoText': 'traite et stocke vos données.',
  'workbench.settings.backendPane.intro.whereLabel': 'Où :',
  'workbench.settings.backendPane.intro.whereText': 'local ou distant.',
  'workbench.settings.backendPane.showDiagrams': 'Afficher les diagrammes',
  'workbench.settings.backendPane.learnMore': 'En savoir plus',
  'workbench.settings.backendPane.subsection.reliability.blurb':
    "Comportement de reconnexion automatique sur un fil instable. S'applique à chaque connexion.",
  'workbench.settings.backendPane.subsection.notifications.blurb': 'Repères visuels quand un lien est coupé.',
  'workbench.settings.backendPane.tierZero.title.extension': 'Ce navigateur',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Cette application',
  'workbench.settings.backendPane.tierZero.title.web': 'Cette application',
  'workbench.settings.backendPane.tierZero.copy.extension':
    "L'extension elle-même traite et stocke vos données — espaces de travail, règles et vault vivent dans ce " +
    'navigateur. Toujours actif ; aucune configuration.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    "Le processus de l'application de bureau est le back-end. Les autres clients locaux s'y connectent ; vos " +
    'données vivent sur cette machine. Toujours actif ; aucune configuration.',
  'workbench.settings.backendPane.tierZero.copy.web':
    "L'application qui a servi cette page est le back-end. Vos données vivent sur cet hôte. Toujours actif ; " +
    'aucune configuration.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Toujours actif',
  'workbench.settings.backendPane.tierZero.adminTitle': 'Administration du daemon',
  'workbench.settings.backendPane.tierZero.adminDescription':
    "Gérez l'annuaire des utilisateurs et les accès accordés par espace de travail.",
  'workbench.settings.backendPane.tierZero.adminOpen': "Ouvrir la console d'administration",
  'workbench.settings.backendPane.scenario.desktop-app.title': 'Application de bureau',
  'workbench.settings.backendPane.scenario.desktop-app.hint': "L'application Open Headers sur cette machine",
  'workbench.settings.backendPane.scenario.local-self-hosted.title': 'Local / LAN',
  'workbench.settings.backendPane.scenario.local-self-hosted.hint': 'Un serveur sur cette machine ou sur votre réseau',
  'workbench.settings.backendPane.scenario.remote-self-hosted.title': 'Distant / WAN',
  'workbench.settings.backendPane.scenario.remote-self-hosted.hint':
    'Un serveur que vous auto-hébergez sur votre propre VM',
  'workbench.settings.backendPane.wizard.step.scenario': 'Scénario',
  'workbench.settings.backendPane.wizard.step.connect': 'Connexion',
  'workbench.settings.backendPane.wizard.step.pair': 'Appairage',
  'workbench.settings.backendPane.wizard.step.turnOn': 'Activation',
  'workbench.settings.backendPane.wizard.addTitle': 'Ajouter un back-end',
  'workbench.settings.backendPane.wizard.editTitle': 'Modifier {label}',
  'workbench.settings.backendPane.wizard.back': 'Retour',
  'workbench.settings.backendPane.wizard.next': 'Suivant',
  'workbench.settings.backendPane.wizard.comingSoon': 'Bientôt disponible',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Terminer sans connecter',
  'workbench.settings.backendPane.wizard.verifyConnect': 'Vérifier et connecter',
  'workbench.settings.backendPane.wizard.scenarioIntro':
    'Quel genre de back-end est-ce ? Choisissez une tuile pour voir ce que le palier vous apporte.',
  'workbench.settings.backendPane.wizard.scenarioAria': 'Scénario de back-end',
  'workbench.settings.backendPane.wizard.soonBadge': 'Bientôt',
  'workbench.settings.backendPane.wizard.connectIntro':
    "Où ce client appelle-t-il le back-end ? La connexion reste désactivée jusqu'à ce que la dernière étape la " +
    'vérifie.',
  'workbench.settings.backendPane.wizard.pairIntro':
    "Prouvez cet appareil auprès du back-end — appairez avec le code qu'il affiche, ou collez un jeton. Vous " +
    "pouvez tester la connexion avant de l'activer.",
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    "Prêt : {label} sur {url}, appairé. L'activation vérifie d'abord la joignabilité et l'authentification ; en " +
    'cas de succès, ses espaces de travail se synchronisent et restent utilisables hors ligne.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    "Prêt : {label} sur {url} — PAS encore appairé. L'activation vérifie d'abord la joignabilité et " +
    "l'authentification ; en cas de succès, ses espaces de travail se synchronisent et restent utilisables hors " +
    'ligne.',
  'workbench.settings.backendPane.wizard.additionalBackend':
    "C'est un back-end supplémentaire. Ses Orgs apparaissent comme de nouveaux groupes dans le sélecteur " +
    "d'espaces de travail, le popover de statut gagne une ligne par back-end, et chaque Org se synchronise " +
    'depuis exactement un back-end — une Org déjà fournie par une autre connexion ne sera pas jointe deux fois.',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} est connecté. Modifier la connexion revient à déplacer un fil sous tension, donc elle se ' +
    "déconnecte d'abord — vos réglages et l'appairage sont conservés, et la réactivation vérifie la nouvelle " +
    'configuration avant toute connexion.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Déconnecter et modifier',
  'workbench.settings.backendPane.wizard.testConnection': 'Tester la connexion',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Connexions',
  'workbench.settings.backendPane.connections.blurbBrowser':
    'Les back-ends que ce navigateur a rejoints. Leurs espaces de travail se synchronisent et restent ' +
    'utilisables hors ligne.',
  'workbench.settings.backendPane.connections.blurbApp':
    'Les back-ends que cette application a rejoints. Leurs espaces de travail se synchronisent et restent ' +
    'utilisables hors ligne.',
  'workbench.settings.backendPane.connections.add': 'Ajouter un back-end',
  'workbench.settings.backendPane.connections.emptyBrowser':
    "Aucune connexion — tout s'exécute dans ce navigateur. Ajoutez un back-end pour synchroniser des espaces " +
    "de travail depuis l'application de bureau ou un serveur auto-hébergé.",
  'workbench.settings.backendPane.connections.emptyApp':
    "Aucune connexion — tout s'exécute dans cette application. Ajoutez un back-end pour synchroniser des " +
    "espaces de travail depuis l'application de bureau ou un serveur auto-hébergé.",
  'workbench.settings.backendPane.connections.status.connected': 'Connecté',
  'workbench.settings.backendPane.connections.status.connecting': 'Connexion…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Réappairage requis',
  'workbench.settings.backendPane.connections.status.error': 'Connexion coupée',
  'workbench.settings.backendPane.connections.status.off': 'Désactivé',
  'workbench.settings.backendPane.connections.repair': 'Réappairer',
  'workbench.settings.backendPane.connections.autoConnect': 'Connexion automatique',
  'workbench.settings.backendPane.connections.editTooltipConnected': "Modifier (déconnecte d'abord)",
  'workbench.settings.backendPane.connections.editTooltip': 'Modifier',
  'workbench.settings.backendPane.connections.editAria': 'Modifier {label}',
  'workbench.settings.backendPane.connections.disconnectTooltip': 'Déconnecter (les réglages sont conservés)',
  'workbench.settings.backendPane.connections.connectTooltip': 'Vérifier et connecter',
  'workbench.settings.backendPane.connections.enabledAria': '{label} activé',
  'workbench.settings.backendPane.connections.orgConflict':
    "L'Org « {org} » est déjà fournie par {provider} — non jointe",
  'workbench.settings.backendPane.connections.removedBackend': 'un back-end supprimé',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Connexion à {label}…',
  'workbench.settings.backendPane.enable.connected': 'Connecté à {label}.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    "{label} est connecté, mais son Org n'a pas été jointe — voir la ligne de connexion.",

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': 'Supprimer {label} ?',
  'workbench.settings.backendPane.remove.confirmBody':
    "Son adresse et son appairage sont oubliés. Rien n'en a encore été synchronisé.",
  'workbench.settings.backendPane.remove.aria': 'Supprimer {label}',
  'workbench.settings.backendPane.remove.removed': '{label} supprimé.',
  'workbench.settings.backendPane.remove.tooltip':
    'Supprimer ce back-end — vous choisissez le sort de ses espaces de travail synchronisés',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} espace de travail',
      many: '{count} espaces de travail',
      other: '{count} espaces de travail',
    }),
  'workbench.settings.backendPane.remove.body.prefix': 'Ce back-end fournit',
  'workbench.settings.backendPane.remove.body.suffix':
    'avec {workspaces} synchronisés sur cet appareil. Ses propres données ne sont jamais touchées — choisissez ' +
    'le sort des copies locales.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Résultat de la suppression',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Recommandé',
  'workbench.settings.backendPane.remove.keep.title': 'Garder les copies locales',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} cessent de se synchroniser. Les {workspaces} restent sur cet appareil comme données locales hors ' +
    'ligne.',
  'workbench.settings.backendPane.remove.discard.title': 'Abandonner les copies locales',
  'workbench.settings.backendPane.remove.discard.description':
    "Chaque espace de travail est d'abord sauvegardé dans un fichier téléchargé, puis supprimé de cet " +
    'appareil. Rejoindre le back-end plus tard les synchronise à nouveau.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Inclure les secrets du vault dans les fichiers de sauvegarde (en clair — gardez les fichiers en sécurité)',
  'workbench.settings.backendPane.remove.removeBackend': 'Supprimer le back-end',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Sauvegarder, puis supprimer',
  'workbench.settings.backendPane.remove.progress.removing': 'Suppression du back-end…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Préparation des sauvegardes…',
  'workbench.settings.backendPane.remove.progress.backingUp': 'Sauvegarde de « {name} »…',
  'workbench.settings.backendPane.remove.progress.deleting': 'Suppression de « {name} »…',
  'workbench.settings.backendPane.remove.keepDone':
    '{label} supprimé. {orgs} ont cessé de se synchroniser ; {workspaces} restent sur cet appareil.',
  'workbench.settings.backendPane.remove.discardDone':
    '{label} supprimé. {workspaces} sauvegardés et supprimés ; {orgs} déliées.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `${String(label)} supprimé, mais {count} espace de travail est resté`,
      many: `${String(label)} supprimé, mais {count} espaces de travail sont restés`,
      other: `${String(label)} supprimé, mais {count} espaces de travail sont restés`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    'Suppression impossible : {names}. Ils restent comme données locales.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'Échec de la sauvegarde de « {name} »',
  'workbench.settings.backendPane.remove.backupFailedBody': "L'export ne s'est pas terminé. Rien n'a été supprimé.",

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Appairer avec un code',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Coller un jeton',
  'workbench.settings.backendPane.pair.codeBlurb':
    "Saisissez le code affiché par le back-end. Nous l'échangerons contre un jeton d'authentification et " +
    'connecterons ce navigateur.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    "Collez le jeton affiché par le back-end — un renouvellement n'affiche le nouveau secret qu'une fois. Il " +
    'est enregistré comme identifiant de ce navigateur.',
  'workbench.settings.backendPane.pair.codePlaceholder': 'Code à 6 chiffres',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': "Nom de l'appareil (facultatif)",
  'workbench.settings.backendPane.pair.codeRequired': "Saisissez le code d'appairage affiché sur le back-end.",
  'workbench.settings.backendPane.pair.pasteTokenRequired': 'Collez le jeton affiché par le back-end.',
  'workbench.settings.backendPane.pair.pairAction': 'Appairer',
  'workbench.settings.backendPane.pair.saveToken': 'Enregistrer le jeton',
  'workbench.settings.backendPane.pair.tokenSaved': "Jeton d'authentification enregistré.",
  'workbench.settings.backendPane.pair.pairedSaved': "Appairé — jeton d'authentification enregistré.",
  'workbench.settings.backendPane.pair.switchToToken': 'Vous avez un jeton ? Collez-le plutôt',
  'workbench.settings.backendPane.pair.switchToCode': "Plutôt un code d'appairage ?",
  'workbench.settings.backendPane.pair.fail.unknown':
    'Ce code est inconnu ou a expiré. Demandez un code neuf et réessayez.',
  'workbench.settings.backendPane.pair.fail.expired':
    "Ce code d'appairage a expiré. Générez-en un nouveau sur le back-end.",
  'workbench.settings.backendPane.pair.fail.consumed':
    'Ce code a déjà été utilisé. Générez-en un nouveau sur le back-end.',
  'workbench.settings.backendPane.pair.fail.unreachable':
    "Impossible de joindre le back-end sur {url}. S'exécute-t-il à cette adresse ?",
  'workbench.settings.backendPane.pair.fail.generic': "Échec de l'appairage. Réessayez.",

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Nom',
  'workbench.settings.backendPane.field.label.description':
    "Le nom de ce back-end dans toute l'application. Par défaut, son adresse.",
  'workbench.settings.backendPane.field.label.placeholder': 'VM du travail',
  'workbench.settings.backendPane.field.label.aria': 'Nom du back-end',
  'workbench.settings.backendPane.field.url.label': 'Adresse du back-end',
  'workbench.settings.backendPane.field.url.description':
    'Où ce client appelle le back-end. `ws://` pour les hôtes locaux / LAN, `wss://` pour le distant.',
  'workbench.settings.backendPane.field.url.schemeAria': 'Schéma',
  'workbench.settings.backendPane.field.url.addressAria': 'Adresse',
  'workbench.settings.backendPane.field.url.portAria': 'Port',
  'workbench.settings.backendPane.field.auth.label': 'Authentification',
  'workbench.settings.backendPane.field.auth.description':
    'Comment cet appareil se prouve auprès du back-end. Appairez avec un code, ou collez un jeton directement.',
  'workbench.settings.backendPane.field.auth.codeAria': "Code d'appairage",
  'workbench.settings.backendPane.field.auth.tokenAria': "Jeton d'authentification",
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Collez un jeton',
  'workbench.settings.backendPane.field.auth.paired': "Appairé — jeton d'accès enregistré",
  'workbench.settings.backendPane.field.auth.useToken': "Utiliser plutôt un jeton d'authentification",
  'workbench.settings.backendPane.field.auth.useCode': 'Appairer plutôt avec un code',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Saisissez un port.',
  'workbench.settings.backendPane.port.notInteger': 'Le port doit être un nombre entier.',
  'workbench.settings.backendPane.port.privileged':
    'Les ports sous 1024 sont privilégiés et nécessitent des permissions élevées — choisissez 1024 ou plus.',
  'workbench.settings.backendPane.port.aboveMax': 'Le port doit être 65535 ou moins.',
  'workbench.settings.backendPane.port.ephemeral':
    "Les ports 49152–65535 sont la plage que l'OS distribue pour les connexions sortantes ; un écouteur ici " +
    'peut échouer à se lier par intermittence. Un port de 1024–49151 est plus fiable.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'Autoriser les pairs LAN ?',
  'workbench.settings.backendPane.lan.confirmOk': 'Autoriser les pairs LAN',
  'workbench.settings.backendPane.lan.confirmCancel': 'Garder le loopback uniquement',
  'workbench.settings.backendPane.lan.confirmBody':
    'Le daemon de bureau se liera à chaque interface réseau locale pour que les autres appareils de votre ' +
    'réseau puissent se connecter. Chaque connexion — LAN ou loopback — doit présenter un jeton ' +
    "d'authentification appairé ; il n'existe aucun chemin sans jeton. Les appareils s'appairent avec le code " +
    "que le daemon affiche (ou collez un jeton dans Paramètres → Backend → Jeton d'authentification du daemon).",

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.title': 'Ordre de repli hors ligne',
  'workbench.settings.backendPane.fallback.blurb':
    'Si le back-end passe hors ligne, le premier hôte joignable de cette liste rafraîchit lui-même ' +
    "l'identifiant d'un workflow exclusif. Les hôtes s'enrôlent automatiquement ; glissez pour reclasser.",
  'workbench.settings.backendPane.fallback.empty':
    "Aucun hôte ne s'est encore enrôlé. Un navigateur rejoint cette liste dès qu'il détient le seed d'un Live " +
    'Workflow exclusif dans cet espace de travail.',
  'workbench.settings.backendPane.fallback.saveFailed': "Échec de l'enregistrement du nouvel ordre",
  'workbench.settings.backendPane.fallback.removeFailed': "Échec de la suppression de l'hôte",
  'workbench.settings.backendPane.fallback.dragAria': 'Glisser pour réordonner',
  'workbench.settings.backendPane.fallback.selfTag': 'Ce navigateur',
  'workbench.settings.backendPane.fallback.pruneTitle': 'Supprimer cet hôte ?',
  'workbench.settings.backendPane.fallback.pruneBody':
    "Il se réenrôle automatiquement s'il détient encore le seed d'un workflow exclusif.",

  // ── Backend pane: tier cards ────────────────────────────────────────
  // The tier registry (`backend-tier-data.ts`) renders inside a
  // fixed-geometry SVG card. Titles, capability bullets, and range-
  // category labels are keyed; IP ranges, URL patterns, and platform
  // proper nouns stay literal (technical plane). Networking vocabulary
  // inside keyed labels (loopback, RFC1918, mDNS, …) is
  // glossary-protected on translator handoff.
  'workbench.settings.backendPane.tier.cardAria': 'Carte de palier {title}',
  'workbench.settings.backendPane.tier.badge.today': "Aujourd'hui",
  'workbench.settings.backendPane.tier.badge.roadmap': 'Feuille de route',
  'workbench.settings.backendPane.tier.inheritsFrom': 'Hérite de {tier}',
  'workbench.settings.backendPane.tier.newInTier': '+ Nouveau dans ce palier',
  'workbench.settings.backendPane.tier.supports': 'Prend en charge',
  'workbench.settings.backendPane.tier.in-browser.title': 'Dans le navigateur',
  'workbench.settings.backendPane.tier.in-browser.sub': "service worker de l'extension",
  'workbench.settings.backendPane.tier.desktop-app.title': 'Application de bureau',
  'workbench.settings.backendPane.tier.desktop-app.sub': 'serveur embarqué',
  'workbench.settings.backendPane.tier.local-self-hosted.title': 'Serveur local',
  'workbench.settings.backendPane.tier.local-self-hosted.sub': 'sur votre LAN',
  'workbench.settings.backendPane.tier.remote-self-hosted.title': 'Serveur distant',
  'workbench.settings.backendPane.tier.remote-self-hosted.sub': 'sur le WAN',
  'workbench.settings.backendPane.tier.bullet.zeroSetup': 'zéro configuration',
  'workbench.settings.backendPane.tier.bullet.minimalSetup': 'configuration minimale',
  'workbench.settings.backendPane.tier.bullet.standardSetup': 'configuration standard',
  'workbench.settings.backendPane.tier.bullet.singleDevice': 'appareil unique',
  'workbench.settings.backendPane.tier.bullet.multipleDevices': 'plusieurs appareils',
  'workbench.settings.backendPane.tier.bullet.perBrowserInstance': 'instance par navigateur',
  'workbench.settings.backendPane.tier.bullet.perAppInstance': 'instance par application',
  'workbench.settings.backendPane.tier.bullet.multiBrowserInstances': 'instances multi-navigateurs',
  'workbench.settings.backendPane.tier.bullet.multiAppInstances': 'instances multi-applications',
  'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing': 'édition concurrente multi-surfaces',
  'workbench.settings.backendPane.tier.bullet.multiWindowEditing': 'édition concurrente multi-fenêtres',
  'workbench.settings.backendPane.tier.bullet.localhostOnly': 'Localhost uniquement',
  'workbench.settings.backendPane.tier.bullet.localhostSupported': 'Localhost pris en charge',
  'workbench.settings.backendPane.tier.bullet.lanReachable': 'Joignable en LAN',
  'workbench.settings.backendPane.tier.bullet.wanReachable': 'Joignable en WAN/Internet',
  'workbench.settings.backendPane.tier.bullet.nativeFilesystem': 'système de fichiers natif',
  'workbench.settings.backendPane.tier.bullet.yamlOnDisk': 'YAML sur disque',
  'workbench.settings.backendPane.tier.bullet.gitIntegration': 'intégration git (local/distant)',
  'workbench.settings.backendPane.tier.bullet.clients': 'ext. navigateur · app de bureau · CLI',
  'workbench.settings.backendPane.tier.bullet.headlessByDefault': 'headless par défaut · site web en opt-in',
  'workbench.settings.backendPane.tier.bullet.teamReady': 'prêt pour les équipes',
  'workbench.settings.backendPane.tier.bullet.ssoAuth': 'Auth SSO',
  'workbench.settings.backendPane.tier.bullet.rbac': 'gestion des utilisateurs RBAC',
  'workbench.settings.backendPane.tier.bullet.auditLogs': "journaux d'audit et rapports",
  'workbench.settings.backendPane.tier.note.soon': 'bientôt',
  'workbench.settings.backendPane.tier.group.allOs': 'Tous les OS',
  'workbench.settings.backendPane.tier.group.embedded': 'Embarqué',
  'workbench.settings.backendPane.tier.group.hyperscalers': 'Hyperscalers',
  'workbench.settings.backendPane.tier.group.euNative': 'Natif UE',
  'workbench.settings.backendPane.tier.group.other': 'Autre',
  'workbench.settings.backendPane.tier.group.enterprise': 'Entreprise',
  'workbench.settings.backendPane.tier.platform.yourCloud': 'Votre cloud',
  'workbench.settings.backendPane.tier.platform.onPrem': 'Sur site',
  'workbench.settings.backendPane.tier.platform.homeServer': 'Serveur domestique',
  'workbench.settings.backendPane.tier.platform.oldLaptop': 'Vieux portable',
  'workbench.settings.backendPane.tier.platform.miniPc': 'Mini PC',
  'workbench.settings.backendPane.tier.reach.none': 'N/A',
  'workbench.settings.backendPane.tier.reach.localhost': 'Localhost',
  'workbench.settings.backendPane.tier.reach.lan': 'Localhost/LAN',
  'workbench.settings.backendPane.tier.reach.wan': 'Internet/WAN',
  'workbench.settings.backendPane.tier.cat.whyNoWire': 'Pourquoi aucun fil ?',
  'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces': 'Surfaces du même navigateur',
  'workbench.settings.backendPane.tier.cat.perBrowserInstance': 'Instance par navigateur',
  'workbench.settings.backendPane.tier.cat.ipv4Loopback': 'Loopback IPv4',
  'workbench.settings.backendPane.tier.cat.ipv6Loopback': 'Loopback IPv6',
  'workbench.settings.backendPane.tier.cat.defaultPort': 'Port par défaut',
  'workbench.settings.backendPane.tier.cat.localhostLoopback': 'Localhost / loopback',
  'workbench.settings.backendPane.tier.cat.rfc1918': 'IPv4 privé RFC1918',
  'workbench.settings.backendPane.tier.cat.ipv6Ula': 'IPv6 ULA',
  'workbench.settings.backendPane.tier.cat.cgnat': 'CGNAT / overlay',
  'workbench.settings.backendPane.tier.cat.zeroConfig': 'Zero-config / repli sans DHCP',
  'workbench.settings.backendPane.tier.cat.mdns': "Noms d'hôte mDNS",
  'workbench.settings.backendPane.tier.cat.publicDns': "Nom d'hôte DNS public",
  'workbench.settings.backendPane.tier.cat.publicIpv4': 'IPv4 publique',
  'workbench.settings.backendPane.tier.cat.publicIpv6': 'IPv6 publique',
  'workbench.settings.backendPane.tier.cat.transport': 'Transport',
  'workbench.settings.backendPane.tier.rangeNote.backendIsSw':
    "aucun port d'écoute, aucune surface IPC exposée aux autres appareils",
  'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging':
    'popup / workbench / DevTools / panneau latéral parlent au SW dans le même processus',
  'workbench.settings.backendPane.tier.rangeNote.storageLocal':
    'Chrome ≠ Firefox ≠ Edge — données séparées par navigateur, ni inter-appareils, ni inter-navigateurs',
  'workbench.settings.backendPane.tier.rangeNote.typicalLoopback': 'généralement 127.0.0.1',
  'workbench.settings.backendPane.tier.rangeNote.portOverride': 'remplaçable dans Backend → Connexion',
  'workbench.settings.backendPane.tier.rangeNote.daemonOwnBox':
    'IPv4 — daemon sur votre propre machine (Docker, sidecar)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6': 'IPv6',
  'workbench.settings.backendPane.tier.rangeNote.ulaPractically': 'en pratique fd00::/8 — allocation privée IPv6',
  'workbench.settings.backendPane.tier.rangeNote.overlayVendors': 'Tailscale, etc.',
  'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal': 'IPv4 lien-local (APIPA)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal':
    "IPv6 lien-local — chaque interface s'en auto-assigne une",
  'workbench.settings.backendPane.tier.rangeNote.bonjour': 'Bonjour / Avahi',
  'workbench.settings.backendPane.tier.rangeNote.tlsCert': 'recommandé — certificat TLS',
  'workbench.settings.backendPane.tier.rangeNote.publicIpv4': 'tout ce qui sort de RFC1918 / 100.64/10',
  'workbench.settings.backendPane.tier.rangeNote.globallyRoutable': 'routable mondialement',
  'workbench.settings.backendPane.tier.rangeNote.tlsRequired':
    'requis — les clients refusent ws:// vers un hôte non loopback',

  // ── Backend pane: scene-diagram aria labels ────────────────────────
  // The topology scenes themselves stay literal English (illustration
  // plane, S3 glyph precedent); only their accessible names localize.
  'workbench.settings.backendPane.detail.aria.in-browser': 'Back-end dans le navigateur',
  'workbench.settings.backendPane.detail.aria.desktop-app': "Back-end de l'application de bureau",
  'workbench.settings.backendPane.detail.aria.local-self-hosted': 'Back-end daemon sur le LAN local',
  'workbench.settings.backendPane.detail.aria.remote-self-hosted': 'Back-end distant auto-hébergé',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Rechercher des raccourcis',
  'workbench.settings.keymapPane.noMatches': 'Aucun raccourci ne correspond à votre recherche.',
  'workbench.settings.keymapPane.recording': 'Appuyez sur les touches…',
  'workbench.settings.keymapPane.unbound': 'Non assigné',
  'workbench.settings.keymapPane.recordTip': 'Cliquez pour capturer un nouveau raccourci',
  'workbench.settings.keymapPane.recordAria': 'Changer le raccourci de {label}',
  'workbench.settings.keymapPane.unbind': 'Retirer le raccourci',
  'workbench.settings.keymapPane.unbindAria': 'Retirer le raccourci de {label}',
  'workbench.settings.keymapPane.resetAria': 'Réinitialiser le raccourci de {label}',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} raccourci a une assignation en conflit',
      many: '{count} raccourcis ont des assignations en conflit',
      other: '{count} raccourcis ont des assignations en conflit',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Afficher les conflits',
  'workbench.settings.keymapPane.conflictShowAll': 'Afficher tous les raccourcis',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Conflit de raccourci',
  'workbench.settings.keymapPane.conflictTooltip': 'Aussi assigné à : {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Raccourci réservé',
  'workbench.settings.keymapPane.reservedBrowser':
    "Le navigateur réserve ce raccourci — il peut agir dessus avant qu'il n'atteigne l'application.",
  'workbench.settings.keymapPane.reservedSystem':
    "Le système d'exploitation réserve ce raccourci — il peut agir dessus avant qu'il n'atteigne l'application.",
  'workbench.settings.keymapPane.lookupTip': 'Trouvez les actions en appuyant sur leur raccourci',
  'workbench.settings.keymapPane.lookupAria': 'Trouver une action par raccourci',
  'workbench.settings.keymapPane.lookupEmpty': "Aucune action n'est assignée à {chord}.",
  'workbench.settings.keymapPane.conflictPrompt': '{chord} est déjà assigné à : {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Réassigner',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Garder les deux',
  'workbench.settings.keymapPane.presetAria': 'Préréglage de raccourcis',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurer le préréglage ({count} personnalisation)',
      many: 'Restaurer le préréglage ({count} personnalisations)',
      other: 'Restaurer le préréglage ({count} personnalisations)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Réinitialiser chaque raccourci personnalisé au préréglage actif.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.daemonTokens.sectionTitle': 'Appareils appairés',
  'workbench.settings.daemonTokens.sectionBlurb':
    "Chaque appareil qui se connecte à ce daemon s'authentifie avec un jeton d'accès. Les appareils connectés " +
    "sont mis en évidence ; renouvelez un jeton pour émettre un secret neuf et retirer l'ancien.",
  'workbench.settings.daemonTokens.labelPlaceholder': "Libellé (facultatif) — p. ex. « téléphone d'alice »",
  'workbench.settings.daemonTokens.bindUserPlaceholder': 'Lier à un utilisateur (facultatif)',
  'workbench.settings.daemonTokens.generate': 'Générer un jeton',
  'workbench.settings.daemonTokens.pairDevice': 'Appairer un appareil',
  'workbench.settings.daemonTokens.explainer.intro': 'Les deux ajoutent un jeton ci-dessous.',
  'workbench.settings.daemonTokens.explainer.generateText':
    "vous montre le secret à copier et coller vous-même dans l'appareil.",
  'workbench.settings.daemonTokens.explainer.pairText':
    "affiche un code court que l'appareil saisit sous Paramètres → Backend → Appairer avec un code (ou ouvre " +
    "un lien, en repli) — utilisez-le quand quelqu'un d'autre configure l'appareil.",
  'workbench.settings.daemonTokens.empty':
    "Aucun appareil pour le moment. Générez un jeton et collez-le dans Paramètres → Backend de l'appareil, ou " +
    'appairez un appareil et faites-lui saisir le code là-bas.',
  'workbench.settings.daemonTokens.mintFailed': 'Échec de la création du jeton : {message}',
  'workbench.settings.daemonTokens.rotateFailed': 'Échec du renouvellement : {message}',
  'workbench.settings.daemonTokens.revokeFailed': 'Échec de la révocation : {message}',
  'workbench.settings.daemonTokens.revokedDevice': "Jeton révoqué. Tout appareil qui l'utilisait a été déconnecté.",
  'workbench.settings.daemonTokens.revokedSession': "Session révoquée. L'utilisateur a été déconnecté.",
  'workbench.settings.daemonTokens.rotate': 'Renouveler',
  'workbench.settings.daemonTokens.revoke': 'Révoquer',
  'workbench.settings.daemonTokens.rotateConfirmTitle': 'Renouveler ce jeton ?',
  'workbench.settings.daemonTokens.rotateConfirmBody':
    "Un secret neuf est créé et l'actuel est révoqué. L'appareil doit recevoir le nouveau jeton avant de " +
    'pouvoir se reconnecter.',
  'workbench.settings.daemonTokens.revokeConfirmTitle': 'Révoquer ce jeton ?',
  'workbench.settings.daemonTokens.revokeConfirmBody':
    "Tout appareil qui l'utilise actuellement est déconnecté immédiatement et ne peut plus se reconnecter.",
  'workbench.settings.daemonTokens.revokeSessionConfirmTitle': 'Révoquer cette session ?',
  'workbench.settings.daemonTokens.revokeSessionConfirmBody':
    "L'utilisateur est déconnecté immédiatement. Il devra se reconnecter via le fournisseur d'identité.",
  'workbench.settings.daemonTokens.revokedTag': 'Révoqué {when}',
  'workbench.settings.daemonTokens.connectedTag': 'Connecté',
  'workbench.settings.daemonTokens.expiredTag': 'Expiré',
  'workbench.settings.daemonTokens.unlabeled': '(sans libellé)',
  'workbench.settings.daemonTokens.unbound': '(non lié)',
  'workbench.settings.daemonTokens.meta.device': 'id {id} · créé {created} · dernière utilisation {lastUsed}',
  'workbench.settings.daemonTokens.meta.boundUser': 'utilisateur {user}',
  'workbench.settings.daemonTokens.meta.session':
    'connecté {signedIn} · expire {expires} · vu pour la dernière fois {lastSeen} · id {id}',
  'workbench.settings.daemonTokens.ssoTitle': 'Sessions SSO',
  'workbench.settings.daemonTokens.ssoBlurb':
    "Chaque connexion SSO crée une session qui expire d'elle-même. Révoquez-en une pour déconnecter " +
    "l'utilisateur immédiatement — il devra se reconnecter via le fournisseur d'identité.",
  'workbench.settings.daemonTokens.secretTitle': 'Copiez ce jeton maintenant',
  'workbench.settings.daemonTokens.secretTitleRotated': 'Copiez le jeton renouvelé maintenant',
  'workbench.settings.daemonTokens.secretBody':
    "Le daemon ne stocke qu'un hachage de cette valeur. Une fois cette boîte de dialogue fermée, le secret ne " +
    'peut pas être récupéré — si vous le perdez, révoquez le jeton et créez-en un nouveau.',
  'workbench.settings.daemonTokens.secretBodyRotated':
    "Le jeton précédent est maintenant révoqué — donnez ce nouveau secret à l'appareil pour qu'il puisse se " +
    "reconnecter. Le daemon ne stocke qu'un hachage de cette valeur. Une fois cette boîte de dialogue fermée, " +
    'le secret ne peut pas être récupéré — si vous le perdez, révoquez le jeton et créez-en un nouveau.',
  'workbench.settings.daemonTokens.secretSaved': "Je l'ai enregistré",

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.daemonTokens.pairModal.done': 'Terminé',
  'workbench.settings.daemonTokens.pairModal.allocating': 'Allocation du code…',
  'workbench.settings.daemonTokens.pairModal.startFailed': "Impossible de démarrer l'appairage",
  'workbench.settings.daemonTokens.pairModal.expiredTitle': 'Appairage expiré',
  'workbench.settings.daemonTokens.pairModal.expiredBody':
    "La fenêtre de 5 minutes s'est écoulée sans confirmation. Fermez cette boîte de dialogue et cliquez à " +
    'nouveau sur Appairer un appareil pour recommencer.',
  'workbench.settings.daemonTokens.pairModal.pairedTitle': 'Appairé',
  'workbench.settings.daemonTokens.pairModal.pairedBody':
    "L'appareil a confirmé le code. Un jeton d'accès neuf a été émis et enregistré sur cet appareil ; il " +
    "apparaît dans la liste ci-dessous. Si l'appareil ne parvient pas à se connecter, révoquez l'entrée et " +
    'appairez à nouveau.',
  'workbench.settings.daemonTokens.pairModal.intro.part1': "Sur l'autre appareil, ouvrez",
  'workbench.settings.daemonTokens.pairModal.intro.settingsPath': 'Paramètres → Backend',
  'workbench.settings.daemonTokens.pairModal.intro.part2': ', pointez son',
  'workbench.settings.daemonTokens.pairModal.intro.address': 'Adresse du back-end',
  'workbench.settings.daemonTokens.pairModal.intro.part3': 'vers cette application, puis cliquez sur',
  'workbench.settings.daemonTokens.pairModal.intro.part4': 'et saisissez :',
  'workbench.settings.daemonTokens.pairModal.codeLabel': "Code d'appairage",
  'workbench.settings.daemonTokens.pairModal.expiresIn': 'expire dans {remaining}',
  'workbench.settings.daemonTokens.pairModal.addressListLabel': 'Adresse du back-end pour cette application',
  'workbench.settings.daemonTokens.pairModal.fallback.prefix': 'Aucune option',
  'workbench.settings.daemonTokens.pairModal.fallback.suffix':
    "sur cet appareil ? Ouvrez plutôt l'un de ces liens là-bas — il sert une page qui remet un jeton à coller " +
    'à la main.',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff':
    "Le serveur MCP est désactivé — les clients ne peuvent pas se connecter tant que vous ne l'activez pas.",
  'workbench.settings.mcpPane.connect.title': 'Connecter un client',
  'workbench.settings.mcpPane.connect.blurb':
    'Choisissez votre client, remplacez {token} par un jeton généré ci-dessus, et ajustez le chemin de ' +
    "l'application si vous l'avez installée ailleurs. L'application doit être en cours d'exécution pour que " +
    'les clients se connectent.',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle':
    'claude_desktop_config.json — à fusionner dans le fichier existant',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'À exécuter une fois dans un terminal',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'À exécuter une fois dans un terminal — les lancements suivants de oh ne nécessitent aucune option',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Pour les clients qui parlent directement streamable HTTP',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': "Le fichier installé n'est pas une clé de licence.",
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'La licence installée ne correspond à aucun schéma pris en charge par cette version.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'La licence installée est signée avec une clé à laquelle ce build ne fait pas confiance.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'La licence installée a échoué à la vérification de signature — le texte a été modifié après la signature.',
  'workbench.settings.licensePane.installed': 'Licence installée',
  'workbench.settings.licensePane.removed': 'Licence supprimée — retour au palier gratuit',
  'workbench.settings.licensePane.removeFailed': 'Échec de la suppression de la licence : {message}',
  'workbench.settings.licensePane.freeTier.title': 'Palier gratuit',
  'workbench.settings.licensePane.freeTier.body':
    "Tout ce qu'Open Headers propose aujourd'hui est inclus — le palier gratuit admet jusqu'à {limit} " +
    'utilisateurs actifs par daemon. Installez une clé de licence pour relever la limite de sièges.',
  'workbench.settings.licensePane.invalidAlert.title': 'La licence installée est inutilisable',
  'workbench.settings.licensePane.invalidAlert.body':
    "L'application continue sur le palier gratuit (jusqu'à {limit} utilisateurs actifs). Collez une clé " +
    'neuve ci-dessous ou contactez le support.',
  'workbench.settings.licensePane.grace.title': 'Licence expirée — période de grâce active',
  'workbench.settings.licensePane.grace.body':
    'Cette licence a expiré le {expiredOn}. Renouvelez avant le {graceEndsOn} — au-delà, la création ou la ' +
    "réactivation d'utilisateurs retombe à la limite gratuite de {limit}. Les utilisateurs existants " +
    "continuent de se connecter et aucune donnée n'est jamais affectée.",
  'workbench.settings.licensePane.expired.title': 'Licence et période de grâce terminées',
  'workbench.settings.licensePane.expired.body':
    "La création et la réactivation d'utilisateurs suivent désormais la limite gratuite de {limit} " +
    'utilisateurs actifs. Les utilisateurs existants continuent de se connecter, les espaces de travail ' +
    "existants continuent de fonctionner, et aucune donnée n'est jamais affectée. Installez une clé " +
    'renouvelée pour restaurer le nombre de sièges sous licence.',
  'workbench.settings.licensePane.detail.licensedTo': 'Titulaire',
  'workbench.settings.licensePane.detail.contact': 'Contact',
  'workbench.settings.licensePane.detail.seats': 'Sièges',
  'workbench.settings.licensePane.detail.validUntil': "Valide jusqu'au",
  'workbench.settings.licensePane.detail.licenseId': 'Id de licence',
  'workbench.settings.licensePane.tag.active': 'Active',
  'workbench.settings.licensePane.tag.offline': 'Licence hors ligne',
  'workbench.settings.licensePane.removeConfirm.title': 'Supprimer cette licence ?',
  'workbench.settings.licensePane.removeConfirm.body':
    "L'application revient au palier gratuit (jusqu'à {limit} utilisateurs actifs). Aucune donnée n'est " + 'affectée.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Supprimer',
  'workbench.settings.licensePane.removeButton': 'Supprimer la licence',
  'workbench.settings.licensePane.replaceTitle': 'Remplacer la licence',
  'workbench.settings.licensePane.installTitle': 'Installer une licence',
  'workbench.settings.licensePane.pastePlaceholder': 'Collez votre clé de licence (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Installer',
  'workbench.settings.licensePane.loadFromFile': 'Charger depuis un fichier…',

  // ── Backend-details scene pills ────────────────────────────────────
  // Architecture component names (sync-engine · rule-engine · oracle ·
  // vault) are glossary vocabulary and ride raw inside the pills; only
  // the connective text keys here.
  'workbench.settings.backendDetails.backEndTitle': 'Back-end = {engine}',
  'workbench.settings.backendDetails.servedOn': 'servi sur {via}',
  'workbench.settings.backendDetails.apiClientsTitle': 'Clients API = {count}',
  'workbench.settings.backendDetails.frontEndTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Front-end = {count} surface hébergée',
      many: 'Front-end = {count} surfaces hébergées',
      other: 'Front-end = {count} surfaces hébergées',
    }),
  'workbench.settings.backendDetails.optIn': '(opt-in)',

  // ── Backend-details device-frame labels ────────────────────────────
  // The scene diagrams' device-container labels are user-facing scene
  // vocabulary and key here. Inner window corners ("Browser" / "CLI"),
  // the CI/CD YAML mock, prompt glyphs, and engine/where pill args stay
  // raw as diagram internals. Browser window titles (Chrome / Firefox /
  // Edge) are glossary proper nouns; the in-browser combined title keys
  // with the brand vocabulary raw inside the value.
  'workbench.settings.backendDetails.device.laptop': 'Portable',
  'workbench.settings.backendDetails.device.desktop': 'Ordinateur de bureau',
  'workbench.settings.backendDetails.device.workstation': 'Station de travail',
  'workbench.settings.backendDetails.device.localServer': 'Serveur local',
  'workbench.settings.backendDetails.device.remoteServer': 'Serveur distant',
  'workbench.settings.backendDetails.device.yourDevice': 'Votre appareil',
  'workbench.settings.backendDetails.inBrowserTitle': 'Open Headers — Chrome / Edge / Firefox',

  // ── Panneau Git (carte de liaison workspace-arborescence) ──────────
  'workbench.settings.gitPane.notBound.title': 'Aucun dossier lié',
  'workbench.settings.gitPane.notBound.body':
    'Liez cet espace de travail à un dossier pour maintenir une arborescence YAML vivante de chaque règle, requête et environnement — prête pour les sauvegardes, les diffs, les éditions manuelles et (bientôt) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Chemin absolu du dossier',
  'workbench.settings.gitPane.chooseFolder': 'Choisir un dossier…',
  'workbench.settings.gitPane.bindButton': 'Lier le dossier',
  'workbench.settings.gitPane.bound': 'Dossier lié.',
  'workbench.settings.gitPane.boundInitialized': 'Dossier initialisé comme nouvelle arborescence d’espace de travail.',
  'workbench.settings.gitPane.boundTitle': 'Dossier lié',
  'workbench.settings.gitPane.boundBody':
    'Les modifications se matérialisent en continu dans ce dossier ; les changements apportés aux fichiers reviennent dans l’application.',
  'workbench.settings.gitPane.unbindButton': 'Délier',
  'workbench.settings.gitPane.unbindConfirm.title': 'Délier ce dossier ?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'Le dossier reste une arborescence d’espace de travail valide sur disque ; l’application cesse simplement de le lire et d’y écrire.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Délier',
  'workbench.settings.gitPane.unbound': 'Dossier délié.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fichier n’a pas pu être lu et est laissé intact',
      many: '{count} fichiers n’ont pas pu être lus et sont laissés intacts',
      other: '{count} fichiers n’ont pas pu être lus et sont laissés intacts',
    }),
  'workbench.settings.gitPane.refusal.locked':
    'Ce dossier est déjà lié à un autre moteur en cours d’exécution (processus {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'Ce dossier contient un espace de travail déjà présent sur cet hôte via une autre source.',
  'workbench.settings.gitPane.refusal.identityMismatch': 'Ce dossier appartient à un autre espace de travail ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest': 'Le workspace.yaml du dossier n’a pas pu être lu : {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'Cet espace de travail est déjà lié à un dossier.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'Aucun espace de travail actif à lier.',
} as const satisfies Catalog;
