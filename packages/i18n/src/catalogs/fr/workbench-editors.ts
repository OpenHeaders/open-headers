/**
 * Workbench editors — shared editor chrome — French. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the
 * {column} / {header} / {key} / {name} / {language} / {message} holes,
 * and `package` / `snippet` as dev loanwords (m., script-packages
 * precedent). Package-flow strings shared with
 * `workbench-script-packages.ts` (duplicate name, not-found, save
 * failed) reuse its fr sentences verbatim; `Hériter` mints the
 * Inherit option label — `workbench-editors-request.ts` must reuse it.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': "Plus d'informations",

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': 'Détails de la connexion',
  'workbench.editors.session.subprotocol': 'Sous-protocole',
  'workbench.editors.session.extensions': 'Extensions',
  'workbench.editors.session.closeCode': 'Code de fermeture',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Clé',
  'workbench.editors.grid.value': 'Valeur',
  'workbench.editors.grid.description': 'Description',
  'workbench.editors.grid.showColumns': 'Afficher les colonnes',
  'workbench.editors.grid.tableOptions': 'Options du tableau',
  'workbench.editors.grid.bulk': 'En bloc',
  'workbench.editors.grid.keyValue': 'Clé-Valeur',
  'workbench.editors.grid.selectAllAria': 'Activer ou désactiver toutes les lignes',
  'workbench.editors.grid.selectAllTitle': 'Tout activer / désactiver',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Redimensionner la colonne {column}',
  'workbench.editors.grid.overriddenBy': 'Doublon — substitué par la ligne {header} que vous avez ajoutée.',
  'workbench.editors.grid.suggestionValueAria': 'Valeur de {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'Collection de requêtes introuvable.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Dossier introuvable.',
  'workbench.editors.ancestorScripts.saveFailed': "Impossible d'enregistrer les scripts.",
  'workbench.editors.ancestorScripts.saveFailedDetail': "Impossible d'enregistrer les scripts : {message}",

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'Collection de requêtes introuvable.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Dossier introuvable.',
  'workbench.editors.ancestorAuth.saveFailed': "Impossible d'enregistrer l'autorisation.",
  'workbench.editors.ancestorAuth.saveFailedDetail': "Impossible d'enregistrer l'autorisation : {message}",

  // ── Éditeur du conteneur de requêtes (collection / dossier : un onglet, des sections) ──
  'workbench.editors.requestContainer.tab.overview': 'Aperçu',
  'workbench.editors.requestContainer.auth.emptyTitle': 'Aucune autorisation configurée',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    "Choisissez un type d'autorisation pour les requêtes de cette collection",
  'workbench.editors.requestContainer.auth.emptySubtitleFolder':
    "Choisissez un type d'autorisation pour les requêtes de ce dossier",
  'workbench.editors.requestContainer.auth.authTypes': "Types d'autorisation",
  'workbench.editors.requestContainer.auth.authTypesInfo':
    'Le pool d’un conteneur : une entrée par schéma dont ses requêtes ont besoin. Les requêtes en Hériter ' +
    'utilisent l’entrée par défaut, un motif d’hôte dirige les requêtes correspondantes vers une autre ' +
    'entrée, et une requête peut en choisir une par son nom.',
  'workbench.editors.requestContainer.auth.authTypesInfoHeading': 'Types',
  'workbench.editors.requestContainer.auth.addEntryAria': "Ajouter un type d'autorisation",
  'workbench.editors.requestContainer.auth.change': 'Changer',
  'workbench.editors.requestContainer.auth.changeHint':
    "Remplacer la configuration d'autorisation héritée de {source}.",
  'workbench.editors.requestContainer.auth.inheritedTag': 'Hérité',
  'workbench.editors.requestContainer.auth.rename': 'Renommer',
  'workbench.editors.requestContainer.auth.noneEntryNote':
    'Les requêtes utilisant cette entrée partent sans autorisation.',
  'workbench.editors.requestContainer.auth.defaultTag': 'Défaut',
  'workbench.editors.requestContainer.auth.setDefault': 'Définir par défaut',
  'workbench.editors.requestContainer.auth.deleteEntry': 'Supprimer',
  'workbench.editors.requestContainer.auth.entryActionsAria': "Actions de l'entrée",
  'workbench.editors.requestContainer.auth.appliesTo': "Appliquer à l'hôte",
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    "Motif d'hôte facultatif (joker *). Une requête en héritage dont l'hôte de l'URL correspond reçoit cette entrée avant le défaut. Vide — atteinte uniquement comme défaut ou par le choix d'une requête.",
  'workbench.editors.requestContainer.auth.resetToInherited': "Rétablir l'héritage",
  'workbench.editors.requestContainer.auth.resetConfirm':
    'Supprimer les entrées du dossier ? Les requêtes retomberont sur la collection.',
  'workbench.editors.requestContainer.deletedElsewhere': 'Cet élément a été supprimé dans une autre fenêtre.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': "Chargement de l'exemple…",
  'workbench.editors.responseExample.notFound': 'Exemple introuvable.',
  'workbench.editors.responseExample.toast.deletedOtherTab': "L'exemple a été supprimé depuis un autre onglet",
  'workbench.editors.responseExample.toast.saveFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.responseExample.toast.saveFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.responseExample.openAsRequest': 'Ouvrir comme requête',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Crée un nouveau brouillon de requête amorcé depuis la requête de cet exemple',
  'workbench.editors.responseExample.editStatus': 'Modifier le code de statut',
  'workbench.editors.responseExample.statusPlaceholder': 'Saisissez le code de réponse',
  'workbench.editors.responseExample.capturedTooltip': 'Capturé le {date}',
  'workbench.editors.responseExample.moreActionsAria': "Plus d'actions de réponse",
  'workbench.editors.responseExample.tab.body': 'Corps',
  'workbench.editors.responseExample.tab.headers': 'En-têtes ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Langage du corps',
  'workbench.editors.responseExample.format': 'Formater',
  'workbench.editors.responseExample.formatBody': 'Formater le corps',
  'workbench.editors.responseExample.noFormatter': 'Aucun formateur pour {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Packages',
  'workbench.editors.scriptEditor.searchSnippets': 'Rechercher des snippets',
  'workbench.editors.scriptEditor.searchPackages': 'Rechercher des packages',
  'workbench.editors.scriptEditor.noSnippetFound': 'Aucun snippet trouvé',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'Aucun package dans cet espace de travail pour le moment',
  'workbench.editors.scriptEditor.noPackageFound': 'Aucun package trouvé',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Ouvrir la Bibliothèque de packages →',
  'workbench.editors.scriptEditor.saveToPackage': 'Enregistrer dans la Bibliothèque de packages',
  'workbench.editors.scriptEditor.newPackage': 'Nouveau package',
  'workbench.editors.scriptEditor.newPackageName': 'Nom du nouveau package',
  'workbench.editors.scriptEditor.back': 'Retour',
  'workbench.editors.scriptEditor.create': 'Créer',
  'workbench.editors.scriptEditor.orAppend': 'Ou ajouter à un package existant :',
  'workbench.editors.scriptEditor.noPackagesYet': 'Aucun package pour le moment',
  'workbench.editors.scriptEditor.savedTo': 'Enregistré dans « {name} »',
  'workbench.editors.scriptEditor.packageCreated': 'Package « {name} » créé',
  'workbench.editors.scriptEditor.duplicatePackage':
    'Un package nommé « {name} » existe déjà dans cet espace de travail.',
  'workbench.editors.scriptEditor.packageNotFound': 'Package introuvable — il a peut-être été supprimé.',
  'workbench.editors.scriptEditor.saveFailed': "Échec de l'enregistrement",
  'workbench.editors.scriptEditor.menuFind': 'Rechercher',
  'workbench.editors.scriptEditor.find': 'Rechercher',
  'workbench.editors.scriptEditor.replace': 'Remplacer',
  'workbench.editors.scriptEditor.beautify': 'Embellir',
  'workbench.editors.scriptEditor.group.request': 'Requête',
  'workbench.editors.scriptEditor.group.variables': 'Variables',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.group.requests': 'Requêtes',
  'workbench.editors.scriptEditor.group.response': 'Réponse',
  'workbench.editors.scriptEditor.group.close': 'Fermeture',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Envoyer une requête HTTP',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Envoyer une requête HTTP avec un corps JSON',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Lire une variable',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Définir une variable',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Lire un secret du vault',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Définir un en-tête',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Retirer un en-tête',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Définir un paramètre de requête',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Retirer un paramètre de requête',
  'workbench.editors.scriptEditor.snippet.setUrl': "Définir l'URL",
  'workbench.editors.scriptEditor.snippet.setMethod': 'Définir la méthode',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Définir un corps JSON',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Le code de statut est 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Le corps de la réponse contient une chaîne',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Le corps de la réponse est égal à une chaîne',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'La valeur JSON du corps de réponse est correcte',
  'workbench.editors.scriptEditor.snippet.headerCheck': "L'en-tête Content-Type est présent",
  'workbench.editors.scriptEditor.snippet.responseTime': 'Le temps de réponse est inférieur à 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Enregistrer une valeur de la réponse dans une variable',
  'workbench.editors.scriptEditor.group.connect': 'Connexion',
  'workbench.editors.scriptEditor.group.send': 'Envoi',
  'workbench.editors.scriptEditor.group.message': 'Message',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'Définir l’offre de sous-protocoles',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': 'Reprendre lors d’une tentative de reconnexion',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': 'Réécrire le message sortant',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': 'Abandonner le message sortant',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Renommer l’événement Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsReply': 'Répondre à un message',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'Compter les messages sur la session',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Émettre un événement Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'Le message est du JSON',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'Enregistrer une valeur du message dans une variable',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'Session fermée proprement',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'Des messages sont arrivés',
  'workbench.editors.scriptEditor.group.publish': 'Publication',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': 'Définir le client id',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'Définir les identifiants du CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': 'Abonner un sujet à la connexion',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': 'Définir le testament',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'Définir une propriété utilisateur du CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': 'Marquer une tentative de reconnexion',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': 'Réécrire la charge utile sortante',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': 'Recibler le sujet',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'Définir la QoS et retain',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': 'Abandonner le message sortant',
  'workbench.editors.scriptEditor.snippet.mqttReply': 'Publier une réponse',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': 'Compter les messages de la session',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': 'La charge utile est du JSON',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue':
    'Enregistrer une valeur de la charge utile dans une variable',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': 'Déconnexion propre',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': 'Des messages sont arrivés',
  'workbench.editors.scriptEditor.group.invoke': 'Appel',
  'workbench.editors.scriptEditor.snippet.grpcSetMetadata': 'Définir une paire de métadonnées',
  'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata': 'Retirer une paire de métadonnées',
  'workbench.editors.scriptEditor.snippet.grpcSetMessage': 'Réécrire le message de requête',
  'workbench.editors.scriptEditor.snippet.grpcLogCall': 'Journaliser l’appel',
  'workbench.editors.scriptEditor.snippet.grpcLogMessage': 'Journaliser le message décodé',
  'workbench.editors.scriptEditor.snippet.grpcCountMessages': 'Compter les messages sur l’appel',
  'workbench.editors.scriptEditor.snippet.grpcAssertDecoded': 'Le message est décodé',
  'workbench.editors.scriptEditor.snippet.grpcAssertField': 'Le champ du message est renseigné',
  'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue': 'Enregistrer une valeur du message dans une variable',
  'workbench.editors.scriptEditor.snippet.grpcStatusOk': 'Le statut est OK',
  'workbench.editors.scriptEditor.snippet.grpcMessageCount': 'Des messages sont arrivés',
  'workbench.editors.scriptEditor.snippet.grpcTrailerCheck': 'Le trailer est présent',
  'workbench.editors.scriptEditor.snippet.logRequest': 'Journaliser la requête',
  'workbench.editors.scriptEditor.snippet.parseJsonBody': 'Analyser le corps JSON',
  'workbench.editors.scriptEditor.snippet.findResponseHeader': 'Trouver un en-tête de réponse',
  'workbench.editors.scriptEditor.snippet.logResponse': 'Journaliser la réponse',
  'workbench.editors.scriptEditor.snippet.logDial': 'Journaliser la connexion',
  'workbench.editors.scriptEditor.snippet.logOutgoingMessage': 'Journaliser le message sortant',
  'workbench.editors.scriptEditor.snippet.logMessage': 'Journaliser le message',
  'workbench.editors.scriptEditor.snippet.logClose': 'Journaliser la fermeture',
  'workbench.editors.scriptEditor.snippet.wsReplyBinary': 'Répondre par une trame binaire',
  'workbench.editors.scriptEditor.snippet.wsNothingDropped': "Rien n'a été abandonné",
  'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic': 'Définir un topic de réponse',
  'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty': 'Définir une propriété utilisateur PUBLISH',
  'workbench.editors.scriptEditor.snippet.mqttConnackAccepted': 'Le broker a accepté la session',
  'workbench.editors.scriptEditor.snippet.grpcLogStatus': 'Journaliser le statut',
} as const satisfies Catalog;
