/**
 * Workbench editors — the WebSocket client editor, French. Wire
 * vocabulary (ws/wss schemes, subprotocol identifiers, AsyncAPI, the
 * `handshake` loanword) rides raw inside keyed values. The Params tab
 * stays raw — `Paramètres` is the Settings-tab mint (gRPC editor
 * precedent); prose says « paramètres ».
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'Requête WebSocket introuvable.',
  'workbench.editors.websocket.urlPlaceholder': 'wss://echo.openheaders.io/socket',
  'workbench.editors.websocket.scheme.wss': 'wss — TLS activé. Cliquez pour passer en ws non chiffré.',
  'workbench.editors.websocket.scheme.ws': 'ws — en clair. Cliquez pour passer en wss.',
  'workbench.editors.websocket.flavor.raw': 'WebSocket',
  'workbench.editors.websocket.flavor.socketio': 'Socket.IO',
  'workbench.editors.websocket.connect.label': 'Se connecter',
  'workbench.editors.websocket.connect.disconnect': 'Se déconnecter',
  'workbench.editors.websocket.connect.browserHost':
    "Les sessions WebSocket s'exécutent sur l'application de bureau ou le daemon.",
  'workbench.editors.websocket.connect.needsUrl': 'Saisissez une URL ws:// ou wss:// pour vous connecter.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Message',
  'workbench.editors.websocket.tab.headers': 'En-têtes',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Paramètres',
  'workbench.editors.websocket.messagePlaceholder': 'Composez le prochain message à envoyer…',
  'workbench.editors.websocket.message.formatText': 'Texte',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.event.namePlaceholder': "Nom de l'événement",
  'workbench.editors.websocket.event.ackLabel': 'Attendre un ack',
  'workbench.editors.websocket.event.ackHelp':
    "Émet un id d'accusé de réception à chaque Envoyer pour que la réponse ack du serveur se corrèle dans la " +
    'chronologie.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Composez le tableau d\'arguments JSON, p. ex. ["hello", 42]…',
  'workbench.editors.websocket.headers.keyPlaceholder': "Nom de l'en-tête",
  'workbench.editors.websocket.headers.valuePlaceholder': 'Valeur',
  'workbench.editors.websocket.headers.nodeOnly':
    "Les en-têtes de handshake personnalisés s'appliquent quand la session s'exécute sur l'application de " +
    'bureau ou le daemon — les navigateurs ne peuvent pas les définir sur un WebSocket.',
  'workbench.editors.websocket.params.keyPlaceholder': 'Nom du paramètre',
  'workbench.editors.websocket.params.valuePlaceholder': 'Valeur',
  'workbench.editors.websocket.spec.selectLabel': 'Spécification AsyncAPI',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Lier une spécification AsyncAPI',
  'workbench.editors.websocket.spec.summary': '{servers} serveurs · {channels} canaux · {operations} opérations',
  'workbench.editors.websocket.spec.parseFailure': "La spécification ne s'analyse pas : {message}",
  'workbench.editors.websocket.spec.issues': '{count} problèmes dans la spécification',
  'workbench.editors.websocket.specFooter.using': 'Utilise {name}',
  'workbench.editors.websocket.specFooter.none': 'Aucune spécification AsyncAPI liée',
  'workbench.editors.websocket.settings.sslVerifyLabel': 'Vérification du certificat SSL',
  'workbench.editors.websocket.settings.sslVerifyHelp':
    'Vérifie le certificat du serveur contre les racines du système pour les sessions wss:. Désactivez pour ' +
    "les serveurs de développement auto-signés. S'applique sur l'application de bureau ou le daemon.",
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Sous-protocoles',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    "Liste d'offres Sec-WebSocket-Protocol, par ordre de préférence — le serveur en choisit un pendant le handshake.",
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Ajouter un sous-protocole…',
  'workbench.editors.websocket.settings.timeoutLabel': 'Délai de connexion (ms)',
  'workbench.editors.websocket.settings.timeoutHelp':
    "Plafond en temps réel sur le handshake de connexion. Vide, la valeur par défaut de l'application s'applique.",
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Par défaut',
  'workbench.editors.websocket.settings.namespaceLabel': 'Espace de noms Socket.IO',
  'workbench.editors.websocket.settings.namespaceHelp':
    "L'espace de noms auquel la session se connecte — vide, elle se connecte à la racine /. Les sessions " +
    "composent directement le transport websocket ; il n'y a pas de repli long-polling.",
  'workbench.editors.websocket.settings.namespacePlaceholder': '/',
  'workbench.editors.websocket.toast.deletedOtherTab':
    'Cette requête WebSocket a été supprimée depuis un autre onglet.',
  'workbench.editors.websocket.toast.updateFailed': "Échec de l'enregistrement de la requête WebSocket",
  'workbench.editors.websocket.toast.updateFailedDetail':
    "Échec de l'enregistrement de la requête WebSocket : {message}",
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.title': 'Session',
  'workbench.editors.websocket.session.emptyHint':
    'Connectez-vous pour démarrer la session — les messages apparaissent ici en direct.',
  'workbench.editors.websocket.session.connectFailed': "Échec de l'ouverture de la session",
  'workbench.editors.websocket.session.connectingBadge': 'CONNEXION',
  'workbench.editors.websocket.session.connectedBadge': 'CONNECTÉ',
  'workbench.editors.websocket.session.tab.timeline': 'Messages',
  'workbench.editors.websocket.session.tab.handshake': 'Handshake',
  'workbench.editors.websocket.session.closedTag': 'Fermée {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Arrêtée',
  'workbench.editors.websocket.session.noCloseFrame': 'Connexion terminée sans frame Close',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Envoyer',
  'workbench.editors.websocket.session.sendIdle': 'Connectez-vous pour envoyer des messages.',
  'workbench.editors.websocket.session.sendFailed': "Échec de l'envoi du message",
  'workbench.editors.websocket.session.hostNotice':
    "Exécution sur le socket du navigateur — {knobs} ne s'appliquent pas sur cet hôte.",
  'workbench.editors.websocket.session.knobHeaders': 'les en-têtes de handshake personnalisés',
  'workbench.editors.websocket.session.knobSslVerify': 'la vérification SSL désactivée',
  'workbench.editors.websocket.session.handshakeProtocol': 'Sous-protocole',
  'workbench.editors.websocket.session.handshakeExtensions': 'Extensions',
  'workbench.editors.websocket.session.handshakeNone': 'Rien de négocié',
  'workbench.editors.websocket.session.handshakeNote':
    "Le socket de la plateforme n'expose que le sous-protocole et les extensions négociés — les en-têtes de " +
    'la réponse 101 ne sont pas accessibles aux clients.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Connexion',
  'workbench.editors.websocket.timeline.connected': 'Connecté',
  'workbench.editors.websocket.timeline.connectedProtocol': 'Connecté — sous-protocole {protocol}',
  'workbench.editors.websocket.timeline.disconnected': 'Déconnecté',
  'workbench.editors.websocket.timeline.stopped': 'Arrêté',
  'workbench.editors.websocket.timeline.failed': 'Échec',
  'workbench.editors.websocket.timeline.waiting': 'En attente de messages…',
  'workbench.editors.websocket.timeline.noMatches': 'Aucun message ne correspond au filtre.',
  'workbench.editors.websocket.timeline.searchMessages': 'Rechercher dans les messages',
  'workbench.editors.websocket.timeline.messageCount': '{count} messages',
  'workbench.editors.websocket.timeline.dropped': '{count} messages plus anciens sont sortis de la capture',
  'workbench.editors.websocket.timeline.filterAll': 'Tous',
  'workbench.editors.websocket.timeline.filterSent': 'Envoyés',
  'workbench.editors.websocket.timeline.filterReceived': 'Reçus',
  'workbench.editors.websocket.timeline.newestFirst': 'Plus récents en premier',
  'workbench.editors.websocket.timeline.oldestFirst': 'Plus anciens en premier',
  'workbench.editors.websocket.timeline.sortOrder': 'Ordre de tri',
  'workbench.editors.websocket.timeline.clearMessages': 'Effacer les messages',
  'workbench.editors.websocket.timeline.newMessages': 'Nouveaux messages',
  'workbench.editors.websocket.timeline.binaryMessage': 'Message binaire ({bytes} octets)',
  'workbench.editors.websocket.timeline.sentAria': 'Envoyé',
  'workbench.editors.websocket.timeline.receivedAria': 'Reçu',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments':
    'Frame de pièces jointes binaires ({count} pièces jointes)',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
} as const satisfies Catalog;
