/**
 * Workbench editors — the MQTT client editor, French. Wire vocabulary
 * (mqtt/mqtts/ws/wss schemes, CONNECT / PUBLISH / RETAIN / PINGREQ
 * tokens, QoS, topic filters, AsyncAPI, the 5.0 property names the
 * spec fixes in English) rides raw inside keyed values. « sujet » =
 * topic; « filtre de sujet » = topic filter; « charge utile » =
 * payload; « testament » = last will; « courtier » = broker.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': 'Requête MQTT introuvable.',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    'Version du protocole MQTT utilisée par la session.\n5.0 · propriétés et options d’abonnement\n3.1.1 · courtiers qui refusent 5.0',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.version.lockedWhileConnected':
    'Impossible de changer de version pendant une session connectée.',
  'workbench.editors.mqtt.scheme.tooltip':
    'Le schéma choisit le transport.\nmqtt/mqtts · socket TCP sur l’application de bureau ou le serveur\nws/wss · MQTT sur WebSocket sur tous les hôtes',
  'workbench.editors.mqtt.connect.label': 'Se connecter',
  'workbench.editors.mqtt.connect.disconnect': 'Se déconnecter',
  'workbench.editors.mqtt.connect.cancel': 'Annuler',
  'workbench.editors.mqtt.connect.browserHost':
    'Les sessions MQTT s’exécutent sur l’application de bureau ou le serveur.',
  'workbench.editors.mqtt.connect.needsUrl': 'Saisissez une URL de broker pour vous connecter.',
  'workbench.editors.mqtt.connect.tcpSchemeBrowser':
    'Les sessions {scheme}:// s’exécutent sur l’application de bureau ou le serveur — passez à ws:// ou wss:// pour vous connecter ici.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Message',
  'workbench.editors.mqtt.tab.topics': 'Sujets',
  'workbench.editors.mqtt.tab.auth': 'Autorisation',
  'workbench.editors.mqtt.tab.properties': 'Propriétés',
  'workbench.editors.mqtt.tab.lastWill': 'Testament',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': 'Paramètres',
  'workbench.editors.mqtt.qos.q0': 'QoS 0 · Au plus une fois',
  'workbench.editors.mqtt.qos.q1': 'QoS 1 · Au moins une fois',
  'workbench.editors.mqtt.qos.q2': 'QoS 2 · Exactement une fois',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS :',
  'workbench.editors.mqtt.qos.meaning0': 'Au plus une fois',
  'workbench.editors.mqtt.qos.meaning1': 'Au moins une fois',
  'workbench.editors.mqtt.qos.meaning2': 'Exactement une fois',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Envoyer',
  'workbench.editors.mqtt.topicPlaceholder': 'Sujet de publication, p. ex. sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Texte',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexadécimal',
  'workbench.editors.mqtt.payload.invalidGate': 'Corrigez d’abord l’encodage de la charge utile.',
  'workbench.editors.mqtt.payload.invalidBase64': 'Base64 invalide — ce sont les octets décodés qui seraient publiés.',
  'workbench.editors.mqtt.payload.invalidHex':
    'Hexadécimal invalide — des paires de chiffres 0-9 a-f se décodent en octets publiés.',
  'workbench.editors.mqtt.payloadPlaceholder': 'Composez la charge utile à publier…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': 'Base64 de la charge utile binaire, p. ex. aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': 'Hexadécimal de la charge utile binaire, p. ex. 48656c6c6f…',
  'workbench.editors.mqtt.props.buttonTooltip': 'Propriétés du message',
  'workbench.editors.mqtt.props.hint': 'Métadonnées MQTT 5.0 envoyées avec chaque message.',
  'workbench.editors.mqtt.props.v311':
    'Les propriétés de message sont une fonctionnalité MQTT 5.0 — cette requête cible 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Propriété',
  'workbench.editors.mqtt.props.userPropValue': 'Valeur',
  'workbench.editors.mqtt.props.addUserProp': 'Propriété utilisateur',
  'workbench.editors.mqtt.props.removeUserProp': 'Supprimer la propriété utilisateur',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval (s)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.payloadFormatIndicator':
    'Payload Format Indicator — marquer la charge utile comme texte UTF-8',
  'workbench.editors.mqtt.saved.title': 'Messages enregistrés',
  'workbench.editors.mqtt.saved.addTooltip': 'Enregistrer la composition actuelle comme message réutilisable',
  'workbench.editors.mqtt.saved.topicTagPlaceholder': 'sujet',
  'workbench.editors.mqtt.saved.showRail': 'Afficher les messages enregistrés',
  'workbench.editors.mqtt.saved.hideRail': 'Masquer les messages enregistrés',
  'workbench.editors.mqtt.saved.emptyHint':
    'Enregistrez des messages pour les réutiliser pendant une connexion active.',
  'workbench.editors.mqtt.saved.defaultName': 'Message',
  'workbench.editors.mqtt.saved.sendTooltip': 'Publier ce message enregistré tel quel',
  'workbench.editors.mqtt.saved.rename': 'Renommer',
  'workbench.editors.mqtt.saved.duplicate': 'Dupliquer',
  'workbench.editors.mqtt.saved.delete': 'Supprimer',
  'workbench.editors.mqtt.topics.hint':
    'Abonnements ouverts avec la session. Les jokers + et # sont bienvenus ; les lignes désactivées restent enregistrées mais ne s’abonnent pas.',
  'workbench.editors.mqtt.topics.filterLabel': 'Filtre de sujet',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Filtre de sujet, p. ex. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Options',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Abonnement',
  'workbench.editors.mqtt.topics.subscribeLabel': 'S’abonner à l’ouverture de la session',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'S’abonner / se désabonner sur la session ouverte — la ligne enregistrée n’est pas modifiée',
  'workbench.editors.mqtt.topics.optionsHint': 'Options d’abonnement MQTT 5.0 pour cette ligne.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local',
  'workbench.editors.mqtt.topics.noLocalDesc': 'Le broker ne renvoie pas à ce client ses propres publications.',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published',
  'workbench.editors.mqtt.topics.retainAsPublishedDesc':
    'Les messages conservent le drapeau RETAIN tel qu’il a été publié.',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandlingDesc':
    'Indique si le broker envoie les messages retenus existants lors de la souscription de cet abonnement.',
  'workbench.editors.mqtt.topics.retainHandlingValuesHeading': 'Valeurs',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Recevoir à l’abonnement',
  'workbench.editors.mqtt.topics.retainHandling0Desc':
    'Le broker envoie les messages retenus à chaque souscription de cet abonnement.',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Nouveaux abonnements seulement',
  'workbench.editors.mqtt.topics.retainHandling1Desc':
    'Le broker n’envoie les messages retenus que si l’abonnement n’existe pas déjà.',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Ne pas recevoir',
  'workbench.editors.mqtt.topics.retainHandling2Desc': 'Le broker n’envoie aucun message retenu pour cet abonnement.',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.topics.subscriptionIdDesc':
    'Identifiant numérique que le broker joint aux messages livrés via cet abonnement.',
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'Aucun',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Propriétés',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'User Properties envoyées une fois avec le paquet SUBSCRIBE de cette ligne. Le broker définit leur signification ; elles ne sont pas jointes aux messages livrés.',
  'workbench.editors.mqtt.topics.subscribeSettings': 'Paramètres',
  'workbench.editors.mqtt.auth.typeLabel': 'Type',
  'workbench.editors.mqtt.auth.typeNone': 'Aucune authentification',
  'workbench.editors.mqtt.auth.typeBasic': 'Authentification Basic',
  'workbench.editors.mqtt.auth.usernameLabel': 'Nom d’utilisateur',
  'workbench.editors.mqtt.auth.usernamePlaceholder': 'Nom d’utilisateur ou {{variable}}',
  'workbench.editors.mqtt.auth.passwordLabel': 'Mot de passe',
  'workbench.editors.mqtt.auth.passwordPlaceholder': 'Mot de passe ou {{variable}}',
  'workbench.editors.mqtt.auth.help':
    'Envoyés comme User Name et Password du paquet CONNECT sur chaque hôte — les deux versions MQTT les transportent. Les variables se résolvent à la connexion ; les exemples enregistrés ne capturent jamais l’identifiant.',
  'workbench.editors.mqtt.userProps.hint':
    'Propriétés utilisateur envoyées sur CONNECT — métadonnées libres lisibles par le courtier et d’autres outils.',
  'workbench.editors.mqtt.userProps.v311':
    'Les propriétés utilisateur CONNECT sont une fonctionnalité MQTT 5.0 — cette requête cible 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Propriété',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Valeur',
  'workbench.editors.mqtt.will.hint':
    'Déposé auprès du courtier sur CONNECT et publié à votre place si la session tombe sans déconnexion propre. Un sujet vide signifie pas de testament.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Sujet du testament, p. ex. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, en secondes — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayPlaceholder': 'Délai (s)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Composez la charge utile du testament…',
  'workbench.editors.mqtt.spec.selectLabel': 'Spécification AsyncAPI',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'Lier une spécification AsyncAPI',
  'workbench.editors.mqtt.spec.summary': '{servers} serveurs · {channels} canaux · {operations} opérations',
  'workbench.editors.mqtt.spec.parseFailure': 'La spécification ne s’est pas analysée : {message}',
  'workbench.editors.mqtt.spec.issues': '{count} problèmes de spécification',
  'workbench.editors.mqtt.spec.useExample': "Utiliser un message d'exemple…",
  'workbench.editors.mqtt.spec.browser.hint':
    "Choisissez un message pour en composer la charge utile d'exemple ; un message de canal remplit aussi le sujet de publication.",
  'workbench.editors.mqtt.spec.browser.servers': 'Servers',
  'workbench.editors.mqtt.spec.browser.channels': 'Channels',
  'workbench.editors.mqtt.spec.browser.operations': 'Operations',
  'workbench.editors.mqtt.spec.browser.components': 'Components',
  'workbench.editors.mqtt.specFooter.using': 'Utilise {name}',
  'workbench.editors.mqtt.specFooter.none': 'Aucune spécification AsyncAPI liée',
  'workbench.editors.mqtt.settings.exampleCaption': 'Exemple de session',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identifiant porté par CONNECT. Vide en génère un nouveau à chaque connexion ; reprendre une session du courtier demande un ID stable.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Auto — généré à la connexion',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Démarrer une session de courtier neuve à la connexion. Désactivez pour reprendre les abonnements et messages en file d’une session précédente — cela demande aussi un Client ID stable.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Durée pendant laquelle le courtier conserve la session après déconnexion. Avec Clean Start activé, ne s’applique que si une connexion ultérieure reprend la session.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (défaut)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalle de battement promis au courtier — le client répond et émet PINGREQ. Vide utilise 60 s ; 0 le désactive.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (défaut)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Délai de connexion',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Plafond horloge sur l’ouverture de connexion seulement — une session ouverte n’a pas de plafond. Vide n’impose aucun délai d’ouverture.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': 'Sans limite',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Nombre de messages QoS 1/2 pouvant être en vol vers ce client à la fois. Vide applique le défaut de la spécification, 65 535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65 535 (défaut)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Plus grand paquet accepté par ce client — le courtier abandonne les plus gros. Vide n’impose aucune limite.',
  'workbench.editors.mqtt.settings.noLimit': 'Aucune limite',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'Vérification du certificat SSL',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Vérifier le certificat du courtier contre les racines système pour les sessions mqtts/wss. Désactivez pour les courtiers auto-signés de développement.',
  'workbench.editors.mqtt.settings.sslVerifyWarning':
    'Les sessions sautent la vérification d’identité du courtier — tout certificat est accepté, y compris ' +
    'auto-signés et expirés.',
  'workbench.editors.mqtt.settings.clientIdExample': 'p. ex. reporter-1',
  'workbench.editors.mqtt.settings.group.connection': 'Connexion',
  'workbench.editors.mqtt.settings.group.session': 'Session — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS et confiance',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'Comment CONNECT ouvre la session : l’identité présentée, s’il repart de zéro, et les plafonds de battement ' +
    'et d’ouverture promis.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'Conditions MQTT 5.0 que CONNECT propose au courtier : combien de temps la session survit à une déconnexion, ' +
    'plus les plafonds de messages en vol et de taille de paquet acceptés par ce client.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'Si les sessions mqtts/wss vérifient le certificat du courtier contre les racines système.',
  'workbench.editors.mqtt.settings.sessionV311': 'Réglages MQTT 5.0 — cette requête cible 3.1.1.',
  // ── Volet de session ────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Réponse',
  'workbench.editors.mqtt.session.emptyHint': 'Connectez-vous pour envoyer et recevoir des messages.',
  'workbench.editors.mqtt.session.connectFailed': 'L’ouverture de la session a échoué',
  'workbench.editors.mqtt.session.connectingBadge': 'CONNEXION',
  'workbench.editors.mqtt.session.connectedBadge': 'CONNECTÉ',
  'workbench.editors.mqtt.session.notSubscribed': 'Abonné à aucun sujet',
  'workbench.editors.mqtt.session.subscribedOne': 'Abonné à 1 sujet',
  'workbench.editors.mqtt.session.subscribedMany': 'Abonné à {count} sujets',
  'workbench.editors.mqtt.session.tab.timeline': 'Messages',
  'workbench.editors.mqtt.session.tab.connection': 'Connexion',
  'workbench.editors.mqtt.session.duration': '{ms} ms',
  'workbench.editors.mqtt.session.sendIdle': 'Connectez-vous pour publier des messages.',
  'workbench.editors.mqtt.session.sendFailed': 'La publication du message a échoué',
  'workbench.editors.mqtt.session.subscribeFailed': 'La modification de l’abonnement a échoué',
  'workbench.editors.mqtt.session.hostNotice':
    "Exécution sur le socket du navigateur — {knobs} ne s'appliquent pas sur cet hôte.",
  'workbench.editors.mqtt.session.knobSslVerify': 'la vérification SSL désactivée',
  'workbench.editors.mqtt.session.disconnectedTag': 'Déconnecté',
  'workbench.editors.mqtt.session.brokerDisconnectedTag': 'Déconnecté par le broker',
  'workbench.editors.mqtt.session.severedTag': 'Connexion interrompue',
  'workbench.editors.mqtt.session.stoppedTag': 'Arrêté',
  'workbench.editors.mqtt.session.connectFailedTag': 'Échec de la connexion',
  'workbench.editors.mqtt.session.abortedTag': 'Interrompue',
  'workbench.editors.mqtt.timeline.aborted': 'Connexion interrompue',
  'workbench.editors.mqtt.timeline.abortedDisconnected': 'Déconnecté du broker',
  'workbench.editors.mqtt.session.cleanDisconnect': 'déconnexion propre',
  'workbench.editors.mqtt.session.brokerDisconnect': 'le broker a envoyé DISCONNECT : {reason}',
  'workbench.editors.mqtt.session.brokerDisconnectBare': 'le broker a envoyé DISCONNECT',
  'workbench.editors.mqtt.session.severed': 'la connexion s’est terminée sans DISCONNECT',
  'workbench.editors.mqtt.session.connectionClientId': 'ID client',
  'workbench.editors.mqtt.session.connectionReason': 'Raison CONNACK',
  'workbench.editors.mqtt.session.connectionSessionPresent': 'Session présente',
  'workbench.editors.mqtt.session.yes': 'Oui',
  'workbench.editors.mqtt.session.no': 'Non',
  'workbench.editors.mqtt.session.connectionNote':
    'Les faits du CONNACK tels que le broker les a répondus — codes de raison mot pour mot, noms à côté.',
  // ── Chronologie des messages ────────────────────────────────────────
  'workbench.editors.mqtt.timeline.connecting': 'Connexion',
  'workbench.editors.mqtt.timeline.connected': 'Connecté au broker',
  'workbench.editors.mqtt.timeline.disconnected': 'Déconnecté',
  'workbench.editors.mqtt.timeline.stopped': 'Arrêté',
  'workbench.editors.mqtt.timeline.subscribed': 'Abonné à',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Désabonné de',
  'workbench.editors.mqtt.timeline.grantFailed': 'Refusé, code {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'Aucun message ne correspond au filtre.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Rechercher des messages',
  'workbench.editors.mqtt.timeline.messageCount': '{count} messages',
  'workbench.editors.mqtt.timeline.dropped': '{count} messages plus anciens sortis de la capture',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'Tous les topics',
  'workbench.editors.mqtt.timeline.filterAll': 'Tous',
  'workbench.editors.mqtt.timeline.filterSent': 'Envoyés',
  'workbench.editors.mqtt.timeline.filterReceived': 'Reçus',
  'workbench.editors.mqtt.timeline.newestFirst': 'Plus récents en premier',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Plus anciens en premier',
  'workbench.editors.mqtt.timeline.sortOrder': 'Ordre de tri',
  'workbench.editors.mqtt.timeline.clearMessages': 'Effacer les messages',
  'workbench.editors.mqtt.timeline.newMessages': 'Nouveaux messages',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Charge utile binaire ({bytes} octets)',
  'workbench.editors.mqtt.timeline.byteCount': '{bytes} o',
  'workbench.editors.mqtt.timeline.retainedTag': 'Retenu',
  'workbench.editors.mqtt.timeline.sentAria': 'Envoyé',
  'workbench.editors.mqtt.timeline.receivedAria': 'Reçu',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Cette requête MQTT a été supprimée dans un autre onglet.',
  'workbench.editors.mqtt.toast.updateFailed': 'L’enregistrement de la requête MQTT a échoué',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'L’enregistrement de la requête MQTT a échoué : {message}',
  'workbench.editors.mqtt.session.saveResponse': 'Enregistrer la réponse',
  'workbench.editors.mqtt.toast.savedExample': 'Exemple {name} enregistré',
  'workbench.editors.mqtt.toast.saveExampleFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.mqtt.toast.saveExampleFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.mqttExample.loading': "Chargement de l'exemple…",
  'workbench.editors.mqttExample.notFound':
    "Cet exemple n'existe plus — il a peut-être été supprimé depuis un autre onglet.",
  'workbench.editors.mqttExample.openInRequest': 'Ouvrir dans la requête',
  'workbench.editors.mqttExample.openInRequestTooltip':
    'Ouvre la requête MQTT parente avec cette forme capturée comme modifications non enregistrées.',
  'workbench.editors.mqttExample.capturedTooltip': 'Capturé le {date}',
  'workbench.editors.mqttExample.toast.deletedOtherTab': 'Cet exemple a été supprimé depuis un autre onglet.',
  'workbench.editors.mqttExample.toast.saveFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.mqttExample.toast.saveFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
} as const satisfies Catalog;
