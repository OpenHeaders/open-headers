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
 * (`Sauvegarde et synchronisation › Synchronisation`); `Administration du daemon` copies the
 * fr/workbench-server-admin title; `palier` / `siège` / `annuaire`
 * reuse the daemon-admin + settings-defs register; `Préréglage de
 * raccourcis` and `Capturer` reuse fr/workbench-settings-defs-keyboard
 * + fr/workbench-settings mints. Token rotation rides the
 * `renouveler` / `renouvellement` family.
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.learnMore': 'En savoir plus',
  'workbench.settings.backendPane.rowMenuAria': 'Actions pour {label}',
  'workbench.settings.backendPane.tierZero.title.extension': 'Ce navigateur',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Cet ordinateur',
  'workbench.settings.backendPane.tierZero.title.web': 'Ce serveur',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'Vos espaces de travail vivent ici. Ils ne sont sauvegardés et synchronisés que par les lieux ci-dessous.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    "Vos espaces de travail vivent dans l'application de bureau sur cet ordinateur. Ils ne sont sauvegardés et " +
    'synchronisés que par les lieux ci-dessous.',
  'workbench.settings.backendPane.tierZero.copy.web':
    "Vos espaces de travail vivent sur ce serveur. Chaque navigateur et appareil qui s'y connecte travaille sur " +
    'les mêmes copies.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Toujours actif',
  'workbench.settings.backendPane.tierZero.administer': 'Administrer…',
  'workbench.settings.backendPane.wizard.step.connect': 'Connexion',
  'workbench.settings.backendPane.wizard.editTitle': 'Modifier {label}',
  'workbench.settings.backendPane.wizard.title.desktop': "Connecter l'application de bureau",
  'workbench.settings.backendPane.wizard.title.server': 'Se connecter à un serveur',
  'workbench.settings.backendPane.wizard.step.address': 'Adresse',
  'workbench.settings.backendPane.wizard.step.signIn': 'Connexion',
  'workbench.settings.backendPane.wizard.connect': 'Connecter',
  'workbench.settings.backendPane.wizard.checkAgain': 'Vérifier à nouveau',
  'workbench.settings.backendPane.wizard.checking': 'Vérification de {host}…',
  'workbench.settings.backendPane.wizard.verdict.needsPairing':
    "{host} demande à cet appareil de s'appairer. Saisissez le code qu'il affiche, ou collez un jeton.",
  'workbench.settings.backendPane.wizard.verdict.signedIn': 'Connecté à {name}.',
  'workbench.settings.backendPane.wizard.verdict.signedInUnnamed': 'Connecté.',
  'workbench.settings.backendPane.wizard.back': 'Retour',
  'workbench.settings.backendPane.wizard.next': 'Suivant',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Terminer sans connecter',
  'workbench.settings.backendPane.wizard.connectIntro':
    "L'adresse à laquelle cet appareil se connecte. Rien ne se connecte avant que la dernière étape ne la vérifie.",
  'workbench.settings.backendPane.wizard.autoPairFallback':
    "L'appairage automatique avec l'application de bureau n'a pas abouti — elle n'est peut-être pas lancée, ou " +
    "ce navigateur n'a pas pu être vérifié. Appairez plutôt avec le code ou le jeton.",
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    "Prêt : {label} sur {url}, connecté. Connecter vérifie d'abord l'adresse et la connexion ; ses espaces de " +
    'travail se synchronisent ensuite et restent utilisables hors ligne.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    "Prêt : {label} sur {url} — pas encore connecté. Connecter vérifie d'abord l'adresse et la connexion ; ses " +
    'espaces de travail se synchronisent ensuite et restent utilisables hors ligne.',
  'workbench.settings.backendPane.wizard.additionalConnection':
    "C'est une connexion supplémentaire. Ses espaces de travail apparaissent comme un nouveau groupe dans le " +
    'sélecteur, le popover de statut gagne une ligne pour elle, et chaque groupe se synchronise depuis un seul ' +
    'endroit — un groupe déjà fourni par une autre connexion ne rejoint pas deux fois.',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} est connecté. Modifier la connexion revient à déplacer un fil sous tension, donc elle se ' +
    "déconnecte d'abord — vos réglages et l'appairage sont conservés, et la réactivation vérifie la nouvelle " +
    'configuration avant toute connexion.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Déconnecter et modifier',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Synchronisé avec',
  'workbench.settings.backendPane.connections.connectDesktop': "Connecter l'application de bureau",
  'workbench.settings.backendPane.connections.signInServer': 'Se connecter à un serveur…',
  'workbench.settings.backendPane.connections.emptyDesktopLine':
    "Synchroniser entre les navigateurs de cet ordinateur : connectez l'application de bureau.",
  'workbench.settings.backendPane.connections.emptyServerLine':
    'Synchroniser entre vos appareils ou avec une équipe : connectez-vous à un OpenHeaders Server.',
  'workbench.settings.backendPane.connections.menu.connect': 'Connecter',
  'workbench.settings.backendPane.connections.menu.disconnect': 'Déconnecter',
  'workbench.settings.backendPane.connections.menu.edit': 'Modifier…',
  'workbench.settings.backendPane.connections.menu.remove': 'Supprimer…',
  'workbench.settings.backendPane.connections.place.desktopApp': 'Application de bureau sur cet ordinateur',
  'workbench.settings.backendPane.placement.section': 'Nouveaux espaces de travail',
  'workbench.settings.backendPane.placement.label': 'Où ils vont',
  'workbench.settings.backendPane.placement.description':
    'Changez-le à tout moment. Les espaces de travail existants restent où ils sont.',
  'workbench.settings.backendPane.connections.writeFailed': 'Impossible d’enregistrer la connexion',
  'workbench.settings.backendPane.connections.status.connected': 'Connecté',
  'workbench.settings.backendPane.connections.status.connecting': 'Connexion…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Réappairage requis',
  'workbench.settings.backendPane.connections.status.error': 'Connexion coupée',
  'workbench.settings.backendPane.connections.status.off': 'Désactivé',
  'workbench.settings.backendPane.connections.repair': 'Réappairer',
  'workbench.settings.backendPane.connections.autoConnect': 'Connexion automatique',
  'workbench.settings.backendPane.connections.orgConflict':
    "L'Org « {org} » est déjà fournie par {provider} — non jointe",
  'workbench.settings.backendPane.connections.removedBackend': 'une connexion supprimée',

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
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} espace de travail',
      many: '{count} espaces de travail',
      other: '{count} espaces de travail',
    }),
  'workbench.settings.backendPane.remove.body.prefix': 'Cette connexion fournit',
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
    "Chaque espace de travail est d'abord sauvegardé dans un fichier téléchargé, puis supprimé de cet appareil. Se " +
    'reconnecter plus tard les synchronise à nouveau.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Inclure les secrets du vault dans les fichiers de sauvegarde (en clair — gardez les fichiers en sécurité)',
  'workbench.settings.backendPane.remove.removeBackend': 'Supprimer la connexion',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Sauvegarder, puis supprimer',
  'workbench.settings.backendPane.remove.progress.removing': 'Suppression de la connexion…',
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
    "Saisissez le code affiché par l'application de bureau ou le serveur. Il est échangé contre un jeton qui " +
    'connecte cet appareil.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    "Collez le jeton affiché par l'application de bureau ou le serveur — un renouvellement n'affiche le nouveau " +
    "secret qu'une fois. Il est enregistré comme identifiant de cet appareil.",
  'workbench.settings.backendPane.pair.codePlaceholder': 'Code à 6 chiffres',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': "Nom de l'appareil (facultatif)",
  'workbench.settings.backendPane.pair.codeRequired':
    "Saisissez le code d'appairage affiché par l'application de bureau ou le serveur.",
  'workbench.settings.backendPane.pair.pasteTokenRequired':
    "Collez le jeton affiché par l'application de bureau ou le serveur.",
  'workbench.settings.backendPane.pair.pairAction': 'Appairer',
  'workbench.settings.backendPane.pair.saveToken': 'Enregistrer le jeton',
  'workbench.settings.backendPane.pair.tokenSaved': "Jeton d'authentification enregistré.",
  'workbench.settings.backendPane.pair.pairedSaved': "Appairé — jeton d'authentification enregistré.",
  'workbench.settings.backendPane.pair.switchToToken': 'Vous avez un jeton ? Collez-le plutôt',
  'workbench.settings.backendPane.pair.switchToCode': "Plutôt un code d'appairage ?",
  'workbench.settings.backendPane.pair.fail.unknown':
    'Ce code est inconnu ou a expiré. Demandez un code neuf et réessayez.',
  'workbench.settings.backendPane.pair.fail.expired':
    "Ce code d'appairage a expiré. Générez-en un nouveau sur l'application de bureau ou le serveur.",
  'workbench.settings.backendPane.pair.fail.consumed':
    "Ce code a déjà été utilisé. Générez-en un nouveau sur l'application de bureau ou le serveur.",
  'workbench.settings.backendPane.pair.fail.unreachable':
    "Rien n'a répondu sur {url}. S'exécute-t-il à cette adresse ?",
  'workbench.settings.backendPane.pair.fail.generic': "Échec de l'appairage. Réessayez.",
  'workbench.settings.backendPane.pair.nmRequired':
    "L'appairage manuel avec l'application de bureau est désactivé — ce navigateur ne se connecte que par appairage vérifié. Voir le réglage « Exiger un appairage vérifié ».",

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Nom',
  'workbench.settings.backendPane.field.label.description':
    "Le nom de cette connexion dans toute l'application. Par défaut, son adresse.",
  'workbench.settings.backendPane.field.label.placeholder': 'VM du travail',
  'workbench.settings.backendPane.field.label.aria': 'Nom de la connexion',
  'workbench.settings.backendPane.field.url.label': 'Adresse',
  'workbench.settings.backendPane.field.url.description':
    '`ws://` pour cet ordinateur ou votre réseau, `wss://` pour un serveur distant.',
  'workbench.settings.backendPane.field.url.schemeAria': 'Schéma',
  'workbench.settings.backendPane.field.url.addressAria': 'Adresse',
  'workbench.settings.backendPane.field.url.portAria': 'Port',
  'workbench.settings.backendPane.field.auth.label': 'Connexion',
  'workbench.settings.backendPane.field.auth.description':
    'Comment cet appareil se connecte. Appairez avec un code, ou collez un jeton directement.',
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
    "L'application de bureau écoutera sur chaque interface réseau locale pour que les autres appareils de votre " +
    'réseau puissent se connecter. Chaque connexion, depuis votre réseau ou depuis cet ordinateur, doit présenter ' +
    "un jeton appairé ; il n'existe aucun chemin sans jeton. Les appareils s'appairent avec le code que " +
    "l'application affiche (ou collez un jeton dans Sauvegarde et synchronisation › Synchronisation).",

  // ── Backend pane: offline fallback order ───────────────────────────
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
  'workbench.settings.keymapPane.presetSection': 'Raccourcis',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurer le préréglage ({count} personnalisation)',
      many: 'Restaurer le préréglage ({count} personnalisations)',
      other: 'Restaurer le préréglage ({count} personnalisations)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Réinitialiser chaque raccourci personnalisé au préréglage actif.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'Appareils appairés',
  'workbench.settings.backendTokens.sectionBlurb':
    "Chaque appareil qui se connecte à ce back-end s'authentifie avec un jeton d'accès. Les appareils connectés " +
    "sont mis en évidence ; renouvelez un jeton pour émettre un secret neuf et retirer l'ancien.",
  'workbench.settings.backendTokens.labelPlaceholder': "Libellé (facultatif) — p. ex. « téléphone d'alice »",
  'workbench.settings.backendTokens.bindUserPlaceholder': 'Lier à un utilisateur (facultatif)',
  'workbench.settings.backendTokens.generate': 'Générer un jeton',
  'workbench.settings.backendTokens.pairDevice': 'Appairer un appareil',
  'workbench.settings.backendTokens.explainer.intro': 'Les deux ajoutent un jeton ci-dessous.',
  'workbench.settings.backendTokens.explainer.generateText':
    "vous montre le secret à copier et coller vous-même dans l'appareil.",
  'workbench.settings.backendTokens.explainer.pairText':
    "affiche un code court que l'appareil saisit sous Sauvegarde et synchronisation › Synchronisation › Appairer avec un " +
    "code (ou ouvre un lien, en repli) — utilisez-le quand quelqu'un d'autre configure l'appareil.",
  'workbench.settings.backendTokens.empty':
    'Aucun appareil pour le moment. Générez un jeton et collez-le dans Sauvegarde et synchronisation › Synchronisation de ' +
    "l'appareil, ou appairez un appareil et faites-lui saisir le code là-bas.",
  'workbench.settings.backendTokens.mintFailed': 'Échec de la création du jeton : {message}',
  'workbench.settings.backendTokens.rotateFailed': 'Échec du renouvellement : {message}',
  'workbench.settings.backendTokens.revokeFailed': 'Échec de la révocation : {message}',
  'workbench.settings.backendTokens.revokedDevice': "Jeton révoqué. Tout appareil qui l'utilisait a été déconnecté.",
  'workbench.settings.backendTokens.revokedSession': "Session révoquée. L'utilisateur a été déconnecté.",
  'workbench.settings.backendTokens.rotate': 'Renouveler',
  'workbench.settings.backendTokens.revoke': 'Révoquer',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'Renouveler ce jeton ?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    "Un secret neuf est créé et l'actuel est révoqué. L'appareil doit recevoir le nouveau jeton avant de " +
    'pouvoir se reconnecter.',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'Révoquer ce jeton ?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    "Tout appareil qui l'utilise actuellement est déconnecté immédiatement et ne peut plus se reconnecter.",
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'Révoquer cette session ?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    "L'utilisateur est déconnecté immédiatement. Il devra se reconnecter via le fournisseur d'identité.",
  'workbench.settings.backendTokens.revokedTag': 'Révoqué {when}',
  'workbench.settings.backendTokens.connectedTag': 'Connecté',
  'workbench.settings.backendTokens.expiredTag': 'Expiré',
  'workbench.settings.backendTokens.unlabeled': '(sans libellé)',
  'workbench.settings.backendTokens.unbound': '(non lié)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · créé {created} · dernière utilisation {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'utilisateur {user}',
  'workbench.settings.backendTokens.meta.session':
    'connecté {signedIn} · expire {expires} · vu pour la dernière fois {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'Sessions SSO',
  'workbench.settings.backendTokens.ssoBlurb':
    "Chaque connexion SSO crée une session qui expire d'elle-même. Révoquez-en une pour déconnecter " +
    "l'utilisateur immédiatement — il devra se reconnecter via le fournisseur d'identité.",
  'workbench.settings.backendTokens.secretTitle': 'Copiez ce jeton maintenant',
  'workbench.settings.backendTokens.secretTitleRotated': 'Copiez le jeton renouvelé maintenant',
  'workbench.settings.backendTokens.secretBody':
    "Le back-end ne stocke qu'un hachage de cette valeur. Une fois cette boîte de dialogue fermée, le secret ne " +
    'peut pas être récupéré — si vous le perdez, révoquez le jeton et créez-en un nouveau.',
  'workbench.settings.backendTokens.secretBodyRotated':
    "Le jeton précédent est maintenant révoqué — donnez ce nouveau secret à l'appareil pour qu'il puisse se " +
    "reconnecter. Le back-end ne stocke qu'un hachage de cette valeur. Une fois cette boîte de dialogue fermée, " +
    'le secret ne peut pas être récupéré — si vous le perdez, révoquez le jeton et créez-en un nouveau.',
  'workbench.settings.backendTokens.secretSaved': "Je l'ai enregistré",

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Terminé',
  'workbench.settings.backendTokens.pairModal.allocating': 'Allocation du code…',
  'workbench.settings.backendTokens.pairModal.startFailed': "Impossible de démarrer l'appairage",
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Appairage expiré',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    "La fenêtre de 5 minutes s'est écoulée sans confirmation. Fermez cette boîte de dialogue et cliquez à " +
    'nouveau sur Appairer un appareil pour recommencer.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Appairé',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    "L'appareil a confirmé le code. Un jeton d'accès neuf a été émis et enregistré sur cet appareil ; il " +
    "apparaît dans la liste ci-dessous. Si l'appareil ne parvient pas à se connecter, révoquez l'entrée et " +
    'appairez à nouveau.',
  'workbench.settings.backendTokens.pairModal.intro.part1': "Sur l'autre appareil, ouvrez",
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'Sauvegarde et synchronisation › Synchronisation',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', pointez son',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Adresse du back-end',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'vers cette application, puis cliquez sur',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'et saisissez :',
  'workbench.settings.backendTokens.pairModal.codeLabel': "Code d'appairage",
  'workbench.settings.backendTokens.pairModal.expiresIn': 'expire dans {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Adresse du back-end pour cette application',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'Aucune option',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    "sur cet appareil ? Ouvrez plutôt l'un de ces liens là-bas — il sert une page qui remet un jeton à coller " +
    'à la main.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Accès CLI',
  'workbench.settings.cliAccess.sectionBlurb':
    "Un clic connecte l'outil en ligne de commande oh de cette machine à l'application — un jeton d'accès " +
    'est créé et enregistré pour lui, sans copie.',
  'workbench.settings.cliAccess.statusUnconfigured': "La CLI de cette machine n'est pas encore connectée.",
  'workbench.settings.cliAccess.statusConfigured': 'CLI connectée en tant que {label}.',
  'workbench.settings.cliAccess.statusStale':
    "Le jeton CLI enregistré n'est plus valide — configurez de nouveau l'accès pour reconnecter.",
  'workbench.settings.cliAccess.statusExternal':
    "La CLI est actuellement connectée à un autre back-end ({url}). Configurer l'accès ici la pointe vers " +
    'cette application à la place.',
  'workbench.settings.cliAccess.statusMalformed': 'Le fichier de configuration de la CLI est illisible : {message}',
  'workbench.settings.cliAccess.pathNote': 'Enregistré dans {path}',
  'workbench.settings.cliAccess.setUp': "Configurer l'accès CLI",
  'workbench.settings.cliAccess.rotate': "Renouveler l'accès CLI",
  'workbench.settings.cliAccess.connectHere': 'Connecter à cette application',
  'workbench.settings.cliAccess.provisioned':
    "Accès CLI configuré — oh fonctionne désormais dans n'importe quel terminal de cette machine.",
  'workbench.settings.cliAccess.rotated': "Jeton CLI renouvelé — l'ancien jeton est révoqué.",
  'workbench.settings.cliAccess.provisionFailed': 'Échec de la configuration CLI : {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.connect.title': 'Connecter un client',
  'workbench.settings.mcpPane.connect.blurb':
    "Choisissez votre client, remplacez l'espace réservé du jeton par un jeton d'accès, et ajustez le chemin " +
    "de l'application si vous l'avez installée ailleurs. L'application doit être en cours d'exécution pour que " +
    'les clients se connectent.',
  'workbench.settings.mcpPane.tokensHome': "Les jetons d'accès se génèrent et se révoquent sous",
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle':
    'claude_desktop_config.json — à fusionner dans le fichier existant',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'À exécuter une fois dans un terminal',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'À exécuter une fois dans un terminal — les lancements suivants de oh ne nécessitent aucune option',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Pour les clients qui parlent directement streamable HTTP',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'Activer le serveur MCP',
  'workbench.settings.mcpConsent.body':
    'Les clients agents et la TUI oh communiquent avec cette application via le serveur MCP, actuellement désactivé.',
  'workbench.settings.mcpConsent.info.title': 'Serveur MCP',
  'workbench.settings.mcpConsent.info.summary':
    'Les clients MCP joignent cette application via le point de terminaison /mcp du back-end (Model Context ' +
    "Protocol sur HTTP en flux). Le réglage mcp.enabled contrôle ce point de terminaison — tant qu'il est " +
    "désactivé, il renvoie 404. Les clients s'authentifient avec les mêmes jetons d'accès que toute autre " +
    'connexion.',
  'workbench.settings.mcpConsent.ok': 'Activer',

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
    'utilisateurs actifs par serveur. Installez une clé de licence pour relever la limite de sièges.',
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
  'workbench.settings.licensePane.getLicenseCta': 'Obtenir une licence',
  'workbench.settings.licensePane.renewLicenseCta': 'Renouveler la licence',
  'workbench.settings.licensePane.detailsSection': 'Licence',
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

  // ── System-plane proxy section (the request-engine proxy design P3) ─
  'workbench.settings.systemProxy.section': 'Proxy',
  'workbench.settings.systemProxy.previewSection': 'Aperçu de la route',
  'workbench.settings.systemProxy.introNote':
    "Local à l'appareil, jamais synchronisé — tout le suit, sauf si une requête définit son propre mode de proxy.",
  'workbench.settings.systemProxy.mode.label': 'Mode',
  'workbench.settings.systemProxy.mode.infoTitle': 'Modes de proxy',
  'workbench.settings.systemProxy.mode.infoSummary':
    'Comment cet appareil décide de la route que prend chaque requête, session WebSocket et appel gRPC.',
  'workbench.settings.systemProxy.mode.infoHeading': 'Modes',
  'workbench.settings.systemProxy.mode.system': 'Système',
  'workbench.settings.systemProxy.mode.systemDesc':
    'Suit la configuration de proxy de cette machine — réglages système, fichiers PAC et découverte ' +
    'automatique — exactement comme le navigateur. Le mode par défaut ; une machine non administrée se ' +
    'connecte simplement en direct.',
  'workbench.settings.systemProxy.system.valuesLabel': 'Valeurs système',
  'workbench.settings.systemProxy.system.sourcedNote':
    'Lues depuis cette machine ({source}) — la résolution répond toujours par URL.',
  'workbench.settings.systemProxy.system.unavailable': "La configuration système n'a pas pu être lue : {message}",
  'workbench.settings.systemProxy.mode.manual': 'Manuel',
  'workbench.settings.systemProxy.mode.manualDesc':
    "Un proxy pour tout — HTTP, HTTPS ou SOCKS5 selon le schéma de l'URL — avec identifiants du vault et liste de contournement.",
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    "Un fichier PAC par URL ou chemin local décide par URL. Le script ne s'exécute que dans la pile réseau " +
    "du navigateur, en bac à sable, jamais dans l'application.",
  'workbench.settings.systemProxy.mode.off': 'Désactivé',
  'workbench.settings.systemProxy.mode.offDesc': 'Toujours se connecter en direct, quoi que dise la machine.',
  'workbench.settings.systemProxy.manual.url': 'Proxy',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'Aucun proxy — connexion directe',
  'workbench.settings.systemProxy.manual.urlExample': 'ex. http://proxy.example:8080 ou socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'Saisissez hôte:port ou une URL de proxy http://, https:// ou socks5:// — SOCKS4 n’est pas pris en charge.',
  'workbench.settings.systemProxy.manual.credentials': 'Identifiants',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': "Pas d'authentification",
  'workbench.settings.systemProxy.manual.credentialsEmpty':
    'Aucune entrée de type chaîne dans le vault de cet appareil pour l’instant.',
  'workbench.settings.systemProxy.manual.credentialsManage': 'Gérer les identifiants dans le vault',
  'workbench.settings.systemProxy.manual.bypass': 'Liste de contournement',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'Aucun contournement — chaque hôte passe par le proxy',
  'workbench.settings.systemProxy.manual.bypassExample': 'ex. localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    "Entrées séparées par des virgules — pas d'espaces dans une entrée, pas de schéma.",
  'workbench.settings.systemProxy.manual.supported': 'Pris en charge',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'Aucune URL PAC — connexion directe',
  'workbench.settings.systemProxy.pac.sourceExample': 'ex. https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'Doit être une URL PAC http:// ou https://.',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': 'Fichier',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'Aucun fichier PAC — connexion directe',
  'workbench.settings.systemProxy.pac.fileExample': 'ex. /chemin/vers/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': 'Doit être un chemin de fichier absolu.',
  'workbench.settings.systemProxy.pac.browse': 'Parcourir…',
  'workbench.settings.systemProxy.saveFailed': "Le réglage n'a pas pu être enregistré : {message}",
  'workbench.settings.systemProxy.previewPlaceholder': 'Prévisualiser une URL — quelle route prendrait-elle ?',
  'workbench.settings.systemProxy.previewButton': 'Résoudre',

  // ── Proxy trust pane body (the proxy-security design §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    "Déchiffrer le trafic HTTPS demande une autorité de certification créée sur cette machine. Rien n'est " +
    'installé tant que vous ne mettez pas en place la confiance ici, et tout ce qui est installé ici peut ' +
    'être retiré ici.',
  'workbench.settings.proxyTrustPane.refresh': 'Revérifier',
  'workbench.settings.proxyTrustPane.loadFailed': "L'état de confiance n'a pas pu être lu : {message}",
  'workbench.settings.proxyTrustPane.ca.title': 'Autorité de certification',
  'workbench.settings.proxyTrustPane.ca.none':
    "Aucune autorité de certification n'existe encore. Elle est créée sur cette machine la première fois " +
    "que vous mettez en place la confiance — elle n'est jamais livrée avec l'application et sa clé privée " +
    'ne quitte jamais cet ordinateur.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Subject',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'Empreinte SHA-256',
  'workbench.settings.proxyTrustPane.ca.validity': 'Valide',
  'workbench.settings.proxyTrustPane.ca.validityRange': "De {from} jusqu'à {until}",
  'workbench.settings.proxyTrustPane.ca.deleteButton': "Supprimer l'autorité de certification",
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': "Supprimer l'autorité de certification ?",
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'La paire de clés est supprimée de cette machine. Remettre en place la confiance crée une autorité ' + 'neuve.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Supprimer',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Autorité de certification supprimée',
  'workbench.settings.proxyTrustPane.ca.deleteFailed':
    "L'autorité de certification n'a pas pu être supprimée : {message}",
  'workbench.settings.proxyTrustPane.stores.title': 'Magasins de confiance',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Trousseau de session',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'Trousseau système',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Profil Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'De confiance',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'Non installé',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Présent, pas de confiance',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Certificat différent',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Illisible',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Couvert via le magasin du système',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': 'Désactivé dans Firefox',
  'workbench.settings.proxyTrustPane.stores.empty': "Aucun magasin de confiance n'est visible sur cette machine.",
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'Un magasin de confiance contient un certificat différent',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    "Un certificat portant le nom de notre autorité est installé, mais son empreinte n'est pas l'autorité " +
    "de cette machine. Cette application ne l'a pas installé et ne l'utilise jamais — examinez le magasin " +
    'où il se trouve.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} installation enregistrée',
      many: '{count} installations enregistrées',
      other: '{count} installations enregistrées',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Mettre en place la confiance…',
  'workbench.settings.proxyTrustPane.wizard.title': "Installer l'autorité de certification du proxy",
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'Ce qui est installé',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'Un certificat racine créé sur cette machine, unique à cette installation. Sa clé privée est chiffrée ' +
    "au repos et n'est jamais envoyée nulle part.",
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'Ce que cela permet',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Les magasins de confiance qui le contiennent acceptent les certificats du proxy de capture, qui peut ' +
    'donc déchiffrer HTTPS — uniquement pour les hôtes que vous délimitez explicitement. Tout le reste ' +
    'passe intact.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'Comment cela se retire',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Chaque changement est enregistré, et un clic sur cette page défait exactement ces changements. ' +
    "Désinstaller l'application fait de même.",
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Choisir les magasins de confiance',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    'Choisissez où installer. Rien ne change tant que vous ne confirmez pas.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    "Les applications qui s'exécutent en votre nom — aucune approbation administrateur requise.",
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'Tous les utilisateurs de cette machine — demande une approbation administrateur.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    "La confiance à l'échelle du système n'est pas encore disponible dans cette version — elle nécessite " +
    "l'assistant OpenHeaders. Utilisez le trousseau de session pour l'instant.",
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox garde son propre magasin de confiance — installation dans chaque profil trouvé.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone':
    "Aucun profil Firefox n'a été trouvé sur cette machine.",
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    "Des profils Firefox ont été trouvés, mais certutil (outils NSS) n'est pas installé — leurs magasins de confiance ne peuvent pas être gérés depuis cette machine.",
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox fait automatiquement confiance au magasin du système (Firefox 120+) — les trousseaux ci-dessus le couvrent.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Installer dans {count} magasin',
      many: 'Installer dans {count} magasins',
      other: 'Installer dans {count} magasins',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': 'La confiance est installée dans chaque magasin choisi.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Certains magasins sont restés inchangés. Rien ne réessaie tout seul — corrigez la cause et remettez ' +
    'en place la confiance, ou retirez la confiance pour revenir en arrière.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Installé et de confiance',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    "L'approbation administrateur a été refusée — le magasin est resté inchangé.",
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'Le certificat a été ajouté mais n’a pas pu être approuvé. Utilisez « Retirer la confiance » pour nettoyer.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Échec : {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'La mise en place de la confiance a échoué : {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Terminé',
  'workbench.settings.proxyTrustPane.removeButton': 'Retirer la confiance',
  'workbench.settings.proxyTrustPane.removeConfirm.title': 'Retirer le certificat de chaque magasin enregistré ?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Chaque installation enregistrée est défaite et vérifiée propre avant que son enregistrement ne soit ' +
    "abandonné. L'autorité de certification elle-même est conservée pour une réinstallation ultérieure.",
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Retirer',
  'workbench.settings.proxyTrustPane.removed': 'Confiance retirée — chaque magasin enregistré est vérifié propre.',
  'workbench.settings.proxyTrustPane.removePartial':
    "Certains magasins n'ont pas pu être vérifiés propres. Leurs enregistrements sont conservés — relancez " +
    'le retrait une fois la cause corrigée.',
  'workbench.settings.proxyTrustPane.removeFailed': 'Le retrait a échoué : {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Assistant privilégié',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'La confiance du trousseau Système passe par un assistant signé, enregistré auprès de macOS comme élément d’arrière-plan. Il ne déplace que les octets du certificat — chaque décision de confiance passe toujours par la boîte de dialogue d’administration macOS.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'Absent de cette version — uniquement dans les versions macOS empaquetées.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Enregistrement',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Serveur',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Enregistré',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'En attente d’approbation',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'Non enregistré',
  'workbench.settings.proxyTrustPane.helper.state.notFound':
    'Introuvable — installez d’abord l’application dans Applications',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Inconnu',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Répond',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'Ne répond pas',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS attend une approbation : activez OpenHeaders dans Éléments ouverts à la connexion › « Autoriser en arrière-plan », puis vérifiez à nouveau.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Enregistrer',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Désenregistrer',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Ouvrir les éléments de connexion',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'L’action de l’assistant a échoué : {message}',

  // ── Panneau Git (carte de liaison workspace-arborescence) ──────────
  'workbench.settings.gitPane.notBound.title': 'Aucun dossier lié',
  'workbench.settings.gitPane.notBound.body':
    'Liez cet espace de travail à un dossier pour maintenir une arborescence YAML vivante de chaque règle, requête et environnement — prête pour les sauvegardes, les diffs, les éditions manuelles et (bientôt) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Chemin absolu du dossier',
  'workbench.settings.gitPane.chooseFolder': 'Choisir un dossier…',
  'workbench.settings.gitPane.bindButton': 'Lier le dossier',
  'workbench.settings.gitPane.bound': 'Dossier lié.',
  'workbench.settings.gitPane.boundInitialized': 'Dossier initialisé comme nouvelle arborescence d’espace de travail.',
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
  'workbench.settings.gitPane.git.available': 'Git {version} détecté',
  'workbench.settings.gitPane.needsRepo': 'Cette page nécessite un dossier lié avec un dépôt — liez-en un sous',
  'workbench.settings.gitPane.section.workingTree': 'Arbre de travail',
  'workbench.settings.gitPane.section.branches': 'Branches',
  'workbench.settings.gitPane.section.commit': 'Commit',
  'workbench.settings.gitPane.section.history': 'Historique',
  'workbench.settings.gitPane.git.missing.title': 'Git n’est pas installé',
  'workbench.settings.gitPane.git.missing.body':
    'Installez git pour valider l’historique de ce dossier. Tout le reste continue de fonctionner sans lui.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'La version de git installée ({version}) est trop ancienne pour cette fonctionnalité. Mettez git à jour pour activer les commits.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} modification non commitée',
      many: '{count} modifications non commitées',
      other: '{count} modifications non commitées',
    }),
  'workbench.settings.gitPane.git.clean': 'Arbre de travail propre',
  'workbench.settings.gitPane.git.indexBusy':
    'L’auto-commit est en pause tant que votre propre index git contient des changements indexés.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Message de commit',
  'workbench.settings.gitPane.git.commitButton': 'Commit',
  'workbench.settings.gitPane.git.committed': 'Commit {sha} créé.',
  'workbench.settings.gitPane.git.nothingToCommit': 'Rien à commiter — l’arbre correspond au dernier commit.',
  'workbench.settings.gitPane.git.commitFailed': 'Échec du commit : {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Auto-commit',
  'workbench.settings.gitPane.git.cadenceDescription':
    'Quand le moteur enregistre vos modifications en commits de lui-même. Désactivé garde chaque commit comme un geste explicite.',
  'workbench.settings.gitPane.git.cadenceOff': 'Désactivé — commit manuel',
  'workbench.settings.gitPane.git.cadenceAuto': 'Après une pause d’édition',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'Quand le focus quitte l’application',
  'workbench.settings.gitPane.git.cadenceEvery': 'Toutes les {minutes} minutes',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'Ignorer les hooks git',
  'workbench.settings.gitPane.git.bypassHooksDescription':
    'Exécuter les commits du moteur avec --no-verify, en sautant vos hooks pre-commit et commit-msg.',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Tant que cette option est active, les commits du moteur ignorent vos hooks pre-commit et commit-msg.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream} : synchronisé',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream} : {ahead} en avance, {behind} en retard',
  'workbench.settings.gitPane.git.noUpstream':
    'Aucun dépôt distant configuré — ajoutez-en un avec git remote add puis git push -u pour activer Pull.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': 'Fusion {sha} effectuée.',
  'workbench.settings.gitPane.git.upToDate': 'Déjà à jour.',
  'workbench.settings.gitPane.git.pullFailed': 'Échec du pull : {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': 'Push de {sha} effectué.',
  'workbench.settings.gitPane.git.nothingToPush': 'Rien à pousser — déjà synchronisé.',
  'workbench.settings.gitPane.git.pushFailed': 'Échec du push : {detail}',
  'workbench.settings.gitPane.git.pushRejected':
    'Le dépôt distant a de nouveaux commits — faites un pull d’abord, puis poussez à nouveau.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'Pas d’accès en écriture',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'Ce dépôt distant est en lecture seule pour vous. Vos commits restent locaux ; vous pouvez les publier sur une nouvelle branche et ouvrir une merge request depuis votre hébergeur git.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'nom-de-branche',
  'workbench.settings.gitPane.git.exportBranchButton': 'Pousser comme nouvelle branche',
  'workbench.settings.gitPane.git.exportedBranch': 'Branche {branch} poussée.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Pousser après chaque commit',
  'workbench.settings.gitPane.git.autoPushDescription':
    'Pousser la branche courante vers son upstream juste après chaque commit enregistré par le moteur.',
  'workbench.settings.gitPane.git.branch.current': 'Sur la branche {branch}',
  'workbench.settings.gitPane.git.branch.detached': 'HEAD détaché — créez une branche pour conserver cet historique.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Basculer vers',
  'workbench.settings.gitPane.git.branch.switched': 'Basculé vers {branch}.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'Échec du basculement : {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'Vous avez des modifications non commitées',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Commitez, remisez ou abandonnez {count} modification non commitée avant de basculer vers {branch}.',
        many: 'Commitez, remisez ou abandonnez {count} modifications non commitées avant de basculer vers {branch}.',
        other: 'Commitez, remisez ou abandonnez {count} modifications non commitées avant de basculer vers {branch}.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Commiter puis basculer',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Remiser puis basculer',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Abandonner les modifications',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': 'Abandonner les modifications non commitées ?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Toutes les modifications non commitées sont supprimées, y compris les nouveaux fichiers. Cette action est irréversible.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Abandonner',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'nom-de-branche',
  'workbench.settings.gitPane.git.branch.createButton': 'Créer et basculer',
  'workbench.settings.gitPane.git.branch.created': 'Branche {branch} créée.',
  'workbench.settings.gitPane.git.branch.createFailed': 'Impossible de créer la branche : {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'Fusionner dans la branche courante',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Fusionner',
  'workbench.settings.gitPane.git.branch.merged': 'Fusion {sha} effectuée.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Déjà à jour.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'Échec de la fusion : {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'L’historique distant a été réécrit',
  'workbench.settings.gitPane.git.forcePush.body':
    'La branche distante ne contient plus l’historique synchronisé la dernière fois ({sha}). Choisissez comment procéder — rien ne change tant que vous n’avez pas décidé.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Abandonner les changements locaux',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'Abandonner les changements locaux ?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Les commits locaux depuis la dernière synchronisation sont abandonnés et l’historique distant réécrit devient l’état du workspace.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Abandonner',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Préserver sur une branche de secours',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Réappliquer par-dessus',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Historique réécrit accepté ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Historique local préservé sur {branch}.',
  'workbench.settings.gitPane.git.forcePush.failed': 'Résolution impossible : {detail}',
  'workbench.settings.gitPane.git.history.show': 'Afficher l’historique',
  'workbench.settings.gitPane.git.history.hide': 'Masquer',
  'workbench.settings.gitPane.git.history.empty': 'Aucun commit pour l’instant.',
  'workbench.settings.gitPane.git.history.loadFailed': 'Impossible de lire l’historique : {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Co-écrit par {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'Historique — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'Aucun commit ne touche ce fichier pour l’instant.',
} as const satisfies Catalog;
