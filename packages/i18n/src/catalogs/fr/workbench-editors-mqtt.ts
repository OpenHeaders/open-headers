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
    'Version du protocole MQTT utilisée par la session. 5.0 débloque les propriétés et les options d’abonnement ; 3.1.1 cible les courtiers qui refusent 5.0.',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.scheme.tooltip':
    'Le schéma choisit le transport : mqtt/mqtts ouvrent une socket TCP sur l’application de bureau ou le serveur ; ws/wss font passer MQTT sur WebSocket sur tous les hôtes.',
  'workbench.editors.mqtt.connect.label': 'Se connecter',
  'workbench.editors.mqtt.connect.pending':
    'Les sessions en direct arrivent dans une prochaine mise à jour — la requête se compose, s’enregistre et se synchronise dès maintenant.',
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
  'workbench.editors.mqtt.saved.emptyHint':
    'Enregistrez des messages pour les réutiliser pendant une connexion active.',
  'workbench.editors.mqtt.saved.defaultName': 'Message',
  'workbench.editors.mqtt.saved.rename': 'Renommer',
  'workbench.editors.mqtt.saved.duplicate': 'Dupliquer',
  'workbench.editors.mqtt.saved.delete': 'Supprimer',
  'workbench.editors.mqtt.topics.hint':
    'Abonnements ouverts avec la session. Les jokers + et # sont bienvenus ; les lignes désactivées restent enregistrées mais ne s’abonnent pas.',
  'workbench.editors.mqtt.topics.filterLabel': 'Filtre de sujet',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Filtre de sujet, p. ex. sensors/+/temperature',
  'workbench.editors.mqtt.topics.optionsLabel': 'QoS / Abonnement',
  'workbench.editors.mqtt.topics.subscribeLabel': 'S’abonner à l’ouverture de la session',
  'workbench.editors.mqtt.topics.optionsHint': 'Options d’abonnement MQTT 5.0 pour cette ligne.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local — ne pas renvoyer les publications de ce client',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published — transmettre le drapeau RETAIN tel quel',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Envoyer les messages retenus à l’abonnement',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Envoyer seulement pour un nouvel abonnement',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Ne pas envoyer les messages retenus',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.auth.typeLabel': 'Type',
  'workbench.editors.mqtt.auth.typeNone': 'Aucune authentification',
  'workbench.editors.mqtt.auth.typeBasic': 'Authentification Basic',
  'workbench.editors.mqtt.auth.pending':
    'Le nom d’utilisateur/mot de passe sur CONNECT arrive dans une prochaine mise à jour, avec le plan de session.',
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
  'workbench.editors.mqtt.specFooter.using': 'Utilise {name}',
  'workbench.editors.mqtt.specFooter.none': 'Aucune spécification AsyncAPI liée',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identifiant porté par CONNECT. Vide en génère un nouveau à chaque connexion ; reprendre une session du courtier demande un ID stable.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Généré à chaque connexion',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Démarrer une session de courtier neuve à la connexion. Désactivez pour reprendre les abonnements et messages en file d’une session précédente — cela demande aussi un Client ID stable.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval (s)',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Durée pendant laquelle le courtier conserve la session après déconnexion. Avec Clean Start activé, ne s’applique que si une connexion ultérieure reprend la session.',
  'workbench.editors.mqtt.settings.v311Knob': 'Une fonctionnalité MQTT 5.0 — cette requête cible 3.1.1.',
  'workbench.editors.mqtt.settings.zeroDefault': '0',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive (s)',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalle de battement promis au courtier — le client répond et émet PINGREQ. Vide utilise 60 s ; 0 le désactive.',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Délai de connexion (ms)',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Plafond horloge sur l’ouverture de connexion seulement — une session ouverte n’a pas de plafond. Vide utilise la valeur par défaut de l’application.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': 'Par défaut',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Nombre de messages QoS 1/2 pouvant être en vol vers ce client à la fois. Vide laisse le courtier décider.',
  'workbench.editors.mqtt.settings.brokerDefault': 'Défaut du courtier',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size (octets)',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Plus grand paquet accepté par ce client — le courtier abandonne les plus gros. Vide n’impose aucune limite.',
  'workbench.editors.mqtt.settings.noLimit': 'Aucune limite',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'Vérification du certificat SSL',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Vérifier le certificat du courtier contre les racines système pour les sessions mqtts/wss. Désactivez pour les courtiers auto-signés de développement.',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Cette requête MQTT a été supprimée dans un autre onglet.',
  'workbench.editors.mqtt.toast.updateFailed': 'L’enregistrement de la requête MQTT a échoué',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'L’enregistrement de la requête MQTT a échoué : {message}',
} as const satisfies Catalog;
