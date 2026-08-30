/**
 * Workbench editors — the WebSocket client editor, French. Wire
 * vocabulary (ws/wss schemes, subprotocol identifiers, AsyncAPI, the
 * `handshake` loanword) rides raw inside keyed values. The Params tab
 * stays raw — `Paramètres` is the Settings-tab mint (gRPC editor
 * precedent); prose says « paramètres ». The spec-browser section
 * headers mirror AsyncAPI document keywords and ride raw (spec
 * outline law); prose says « canaux » / « opérations ».
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'Requête WebSocket introuvable.',
  'workbench.editors.websocket.connect.label': 'Se connecter',
  'workbench.editors.websocket.connect.disconnect': 'Se déconnecter',
  'workbench.editors.websocket.connect.cancel': 'Annuler',
  'workbench.editors.websocket.connect.browserHost':
    "Les sessions WebSocket s'exécutent sur l'application de bureau ou le serveur.",
  'workbench.editors.websocket.connect.needsUrl': 'Saisissez une URL ws:// ou wss:// pour vous connecter.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Message',
  'workbench.editors.websocket.tab.events': 'Événements',
  'workbench.editors.websocket.tab.auth': 'Autorisation',
  'workbench.editors.websocket.tab.headers': 'En-têtes',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': 'Paramètres',
  'workbench.editors.websocket.messagePlaceholder': 'Composez le prochain message à envoyer…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 du message binaire, p. ex. aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hexadécimal du message binaire, p. ex. 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Texte',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Binaire',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexadécimal',
  'workbench.editors.websocket.message.invalidGate': 'Corrigez d’abord l’encodage du message.',
  'workbench.editors.websocket.message.invalidBase64':
    'Base64 invalide — ce sont les octets décodés qui seraient envoyés.',
  'workbench.editors.websocket.message.invalidHex':
    'Hexadécimal invalide — des paires de chiffres 0-9 a-f se décodent en octets envoyés.',
  'workbench.editors.websocket.auth.helpRaw':
    "Envoyé comme en-tête Authorization: Bearer sur le handshake — s'applique sur l'application de bureau ou " +
    "le serveur ; les navigateurs ne peuvent pas le définir sur un WebSocket. Une ligne d'en-tête " +
    'Authorization explicite est prioritaire.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Envoyé comme charge utile auth du paquet CONNECT ({"token": …}) sur chaque hôte, et comme en-tête de ' +
    "handshake Authorization: Bearer sur l'application de bureau ou le serveur. Une ligne d'en-tête " +
    "Authorization explicite est prioritaire sur l'en-tête.",
  'workbench.editors.websocket.events.hint':
    'Les événements entrants à afficher dans la chronologie de la session. Sans lignes, chaque événement ' +
    "s'affiche ; la capture enregistre toujours tout.",
  'workbench.editors.websocket.events.namePlaceholder': "Nom de l'événement",
  'workbench.editors.websocket.events.listenLabel': 'Écouter',
  'workbench.editors.websocket.event.namePlaceholder': "Nom de l'événement",
  'workbench.editors.websocket.event.ackLabel': 'Attendre un ack',
  'workbench.editors.websocket.event.ackHelp':
    "Émet un id d'accusé de réception à chaque Envoyer pour que la réponse ack du serveur se corrèle dans la " +
    'chronologie.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Composez le tableau d\'arguments JSON, p. ex. ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': "Retirer l'argument {index}",
  'workbench.editors.websocket.event.argPlaceholder': 'Composez cet argument en JSON, p. ex. "hello" ou {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': "Nom de l'en-tête",
  'workbench.editors.websocket.headers.valuePlaceholder': 'Valeur',
  'workbench.editors.websocket.headers.hint.host':
    'Dérivé de l’URL cible au moment de la connexion — l’hôte auquel la requête d’upgrade est adressée.',
  'workbench.editors.websocket.headers.hint.connection':
    'Demande au serveur de changer de protocole ; une poignée de main WebSocket porte toujours Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Nomme le protocole cible — chaque poignée de main WebSocket fait passer la connexion HTTP en websocket.',
  'workbench.editors.websocket.headers.hint.key':
    'Un nonce aléatoire généré pour chaque connexion ; le serveur prouve avoir lu la poignée de main en renvoyant son hachage dans Sec-WebSocket-Accept.',
  'workbench.editors.websocket.headers.hint.version':
    'La version du protocole WebSocket (RFC 6455) ; 13 est la seule version en usage.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Propose la compression par message ; le serveur peut accepter, restreindre ou ignorer l’offre dans sa réponse.',
  'workbench.editors.websocket.headers.hint.origin':
    'L’origine de la page que le navigateur appose sur chaque poignée de main WebSocket ; les serveurs s’en servent pour refuser les connexions inter-sites.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'Le navigateur s’identifie sur la poignée de main ; le code de la page ne peut pas le changer.',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'Le navigateur marque la requête d’upgrade comme non mise en cache.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'Les encodages de contenu acceptés par le navigateur sur la réponse de la poignée de main.',
  'workbench.editors.websocket.headers.hint.acceptLanguage':
    'Les langues préférées du navigateur, tirées de ses réglages.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'La poignée de main du runtime node accepte tout type de média en réponse.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage': 'La poignée de main du runtime node envoie un joker.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Apposé par le runtime node sur chaque poignée de main WebSocket.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'Le runtime node identifie cette application sur la poignée de main. Ajoutez votre propre ligne User-Agent pour en envoyer un autre.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'Le runtime node marque la requête d’upgrade comme non mise en cache.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'Les encodages de contenu que le runtime node accepte sur la réponse de la poignée de main.',
  'workbench.editors.websocket.headers.browserNotSent':
    'Non envoyé — le navigateur définit lui-même les en-têtes de la poignée de main. Les en-têtes personnalisés s’appliquent quand la session s’exécute sur l’application de bureau ou le serveur.',
  'workbench.editors.websocket.spec.selectLabel': 'Spécification AsyncAPI',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Lier une spécification AsyncAPI',
  'workbench.editors.websocket.spec.summary': '{servers} serveurs · {channels} canaux · {operations} opérations',
  'workbench.editors.websocket.spec.parseFailure': "La spécification ne s'analyse pas : {message}",
  'workbench.editors.websocket.spec.issues': '{count} problèmes dans la spécification',
  'workbench.editors.websocket.spec.useExample': "Utiliser un message d'exemple…",
  'workbench.editors.websocket.spec.browser.hint': "Choisissez un message pour en composer la charge utile d'exemple.",
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.settings.exampleCaption': 'Exemple de session',
  'workbench.editors.websocket.settings.group.connection': 'Connexion',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS et confiance',
  'workbench.editors.websocket.settings.group.resilience': 'Résilience de session',
  'workbench.editors.websocket.settings.groupInfo.resilience':
    'Ce qui garde une longue session en vie : si une connexion coupée se rouvre et avec quelle patience, combien de silence est toléré avant de considérer la connexion perdue, et le battement qu’envoie ce client.',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'Comment le handshake ouvre la session : les sous-protocoles proposés, la destination de la connexion et ' +
    'le plafond sur l’ouverture.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Comment la session Socket.IO adresse le serveur et lui parle : le chemin de handshake engine.io qu’elle monte, l’espace de noms qu’elle rejoint, la révision du protocole et combien de temps un événement attend son ack.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'Comment les sessions wss: établissent la confiance : vérification du certificat du serveur contre les racines système, certificat client présenté par cet appareil, fenêtre de versions TLS et liste de suites de chiffrement de la négociation, et nom SNI proposé.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Sous-protocoles',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    "Liste d'offres Sec-WebSocket-Protocol, par ordre de préférence — le serveur en choisit un pendant le handshake.",
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Aucun (défaut)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'p. ex. graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Se connecte à cette socket locale — un chemin absolu de socket Unix, ou un tube nommé Windows comme ' +
    "\\\\.\\pipe\\nom — au lieu d'ouvrir une connexion TCP. L'URL continue de déterminer le Host du " +
    'handshake, le nom de serveur TLS et la vérification du certificat ; seule la destination de la ' +
    'connexion change. Laissez vide pour une connexion TCP normale.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'Connexion TCP (défaut)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Délai de connexion',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Plafond horloge sur le handshake de connexion seulement — une session ouverte n’a pas de plafond. Vide ' +
    'ne fixe aucun délai.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Aucune limite (défaut)',
  'workbench.editors.websocket.settings.namespaceLabel': 'Espace de noms',
  'workbench.editors.websocket.settings.namespaceHelp':
    "L'espace de noms auquel la session se connecte — vide, elle se connecte à la racine /. Les sessions " +
    "composent directement le transport websocket ; il n'y a pas de repli long-polling.",
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (défaut)',
  'workbench.editors.websocket.settings.namespaceExample': 'p. ex. /admin',
  'workbench.editors.websocket.settings.socketioProtocolLabel': 'Protocole',
  'workbench.editors.websocket.settings.socketioProtocolHelp':
    'La révision du protocole Socket.IO que parle la session. v5 (engine.io 4) est celle des serveurs Socket.IO 3.x et 4.x ; choisissez v4 (engine.io 3) pour un serveur 1.x ou 2.x — là, le client envoie les pings, le serveur rejoint lui-même le namespace racine et le paquet connect ne porte aucune charge d’authentification : l’identifiant bearer ne voyage que dans l’en-tête du handshake.',
  'workbench.editors.websocket.settings.socketioProtocolPlaceholder': 'v5 (par défaut)',
  'workbench.editors.websocket.settings.socketioProtocolV5': 'v5 — serveurs Socket.IO 3.x / 4.x',
  'workbench.editors.websocket.settings.socketioProtocolV4': 'v4 — serveurs Socket.IO 1.x / 2.x',
  'workbench.editors.websocket.settings.ackTimeoutLabel': 'Délai d’ack',
  'workbench.editors.websocket.settings.ackTimeoutHelp':
    'Combien de temps un événement envoyé avec Ack attend l’accusé du serveur. Une fois le délai écoulé, la chronologie note l’ack comme expiré et cesse d’attendre ; un ack tardif s’affiche tout de même à son arrivée. Vide attend indéfiniment.',
  'workbench.editors.websocket.settings.ackTimeoutPlaceholder': 'Aucun délai (par défaut)',
  'workbench.editors.websocket.toast.deletedOtherTab':
    'Cette requête WebSocket a été supprimée depuis un autre onglet.',
  'workbench.editors.websocket.toast.updateFailed': "Échec de l'enregistrement de la requête WebSocket",
  'workbench.editors.websocket.toast.updateFailedDetail':
    "Échec de l'enregistrement de la requête WebSocket : {message}",
  'workbench.editors.websocket.toast.savedExample': 'Exemple {name} enregistré',
  'workbench.editors.websocket.toast.saveExampleFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.websocket.toast.saveExampleFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Réponse',
  'workbench.editors.websocket.session.emptyHint': 'Connectez-vous pour envoyer et recevoir des messages.',
  'workbench.editors.websocket.session.connectFailed': "Échec de l'ouverture de la session",
  'workbench.editors.websocket.session.connectingBadge': 'Connexion',
  'workbench.editors.websocket.session.connectedBadge': 'Connecté',
  'workbench.editors.websocket.session.closedTag': 'Fermée {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Arrêtée',
  'workbench.editors.websocket.session.disconnectedTag': 'Déconnecté',
  'workbench.editors.websocket.session.connectFailedTag': 'Échec de la connexion',
  'workbench.editors.websocket.session.abortedTag': 'Interrompue',
  'workbench.editors.websocket.session.noCloseFrame': 'Connexion terminée sans frame Close',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Envoyer',
  'workbench.editors.websocket.session.saveResponse': 'Enregistrer la réponse',
  'workbench.editors.websocket.session.sendIdle': 'Connectez-vous pour envoyer des messages.',
  'workbench.editors.websocket.session.sendFailed': "Échec de l'envoi du message",
  'workbench.editors.websocket.session.hostNotice':
    "Exécution sur le socket du navigateur — {knobs} ne s'appliquent pas sur cet hôte.",
  'workbench.editors.websocket.session.knobHeaders': 'les en-têtes de handshake personnalisés',
  'workbench.editors.websocket.session.knobSslVerify': 'la vérification SSL désactivée',
  'workbench.editors.websocket.session.knobAuth': "l'en-tête d'identifiants bearer",
  'workbench.editors.websocket.session.handshakeNone': 'Rien de négocié',
  'workbench.editors.websocket.session.handshakeNote':
    "Le socket de la plateforme n'expose que le sous-protocole et les extensions négociés — les en-têtes de " +
    'la réponse 101 ne sont pas accessibles aux clients.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Connexion',
  'workbench.editors.websocket.timeline.connected': 'Connecté',
  'workbench.editors.websocket.timeline.disconnected': 'Déconnecté',
  'workbench.editors.websocket.timeline.stopped': 'Arrêté',
  'workbench.editors.websocket.timeline.aborted': 'Connexion interrompue',
  'workbench.editors.websocket.connect.reconnectNow': 'Reconnecter maintenant',
  'workbench.editors.websocket.connect.reconnectNowHint':
    'Lancer la prochaine tentative de reconnexion sans attendre la période',
  'workbench.editors.websocket.session.reconnectingBadge': 'Reconnexion',
  'workbench.editors.websocket.session.reconnectExhaustedTag': 'Reconnexion abandonnée',
  'workbench.editors.websocket.session.reconnectExhausted': 'reconnexion abandonnée après {attempts}',
  'workbench.editors.websocket.session.reconnectExhaustedReason': 'reconnexion abandonnée après {attempts} : {reason}',
  'workbench.editors.websocket.session.reconnectAttemptsOne': 'une tentative',
  'workbench.editors.websocket.session.reconnectAttemptsMany': '{count} tentatives',
  'workbench.editors.websocket.timeline.lost': 'Connexion perdue',
  'workbench.editors.websocket.timeline.lostIdle': 'rien n’est arrivé avant le délai d’inactivité',
  'workbench.editors.websocket.timeline.reconnectingAfter': 'Tentative de reconnexion {attempt} après {delay}',
  'workbench.editors.websocket.timeline.reconnectingNow': 'Tentative de reconnexion {attempt} maintenant',
  'workbench.editors.websocket.timeline.reconnected': 'Reconnecté',
  'workbench.editors.websocket.timeline.reconnectedTo': 'Reconnecté à {url}',
  'workbench.editors.websocket.timeline.ackTimeout': 'Ack #{ackId} expiré après {timeout}',
  'workbench.editors.websocket.timeline.noMatches': 'Aucun message ne correspond au filtre.',
  'workbench.editors.websocket.timeline.connectedTo': 'Connecté à {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Copier le message',
  'workbench.editors.websocket.saved.title': 'Messages enregistrés',
  'workbench.editors.websocket.saved.addTooltip': 'Enregistrer la composition actuelle comme message réutilisable',
  'workbench.editors.websocket.saved.showRail': 'Afficher les messages enregistrés',
  'workbench.editors.websocket.saved.hideRail': 'Masquer les messages enregistrés',
  'workbench.editors.websocket.saved.emptyHint':
    'Enregistrez des messages pour les réutiliser pendant une connexion active.',
  'workbench.editors.websocket.saved.defaultName': 'Message',
  'workbench.editors.websocket.saved.rename': 'Renommer',
  'workbench.editors.websocket.saved.duplicate': 'Dupliquer',
  'workbench.editors.websocket.saved.delete': 'Supprimer',
  'workbench.editors.websocket.timeline.saveMessage': 'Enregistrer le message',
  'workbench.editors.websocket.timeline.info.label': 'Détails du message',
  'workbench.editors.websocket.timeline.info.size': 'Taille',
  'workbench.editors.websocket.timeline.info.time': 'Heure',
  'workbench.editors.websocket.timeline.info.frame': 'Trame',
  'workbench.editors.websocket.timeline.info.frameText': 'Texte',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Binaire',
  'workbench.editors.websocket.timeline.couldNotConnect': 'Connexion impossible à {url}',
  'workbench.editors.websocket.timeline.errorLabel': 'Erreur',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Déconnecté de {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Détails de la négociation',
  'workbench.editors.websocket.timeline.requestUrl': 'URL de la requête',
  'workbench.editors.websocket.timeline.requestMethod': 'Méthode de la requête',
  'workbench.editors.websocket.timeline.statusCode': 'Code de statut',
  'workbench.editors.websocket.timeline.requestHeaders': 'En-têtes de la requête',
  'workbench.editors.websocket.timeline.responseHeaders': 'En-têtes de la réponse',
  'workbench.editors.websocket.timeline.keyGenerated': '<généré par le socket>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'La session a été arrêtée depuis cette application.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    'Aucune signification enregistrée — un code applicatif ou privé.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'La connexion a été fermée correctement.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'Le point de terminaison s’en va — arrêt du serveur ou navigation de la page.',
  'workbench.editors.websocket.timeline.closeCode.1002':
    'Le point de terminaison a mis fin à la connexion suite à une erreur de protocole.',
  'workbench.editors.websocket.timeline.closeCode.1003':
    'Le point de terminaison a reçu des données d’un type qu’il ne peut pas accepter.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Aucun code de statut n’était présent dans la trame Close.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'La connexion a été coupée sans trame Close.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'Un message contenait des données incohérentes avec son type, comme de l’UTF-8 invalide dans une trame texte.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'Un message a enfreint la politique du point de terminaison.',
  'workbench.editors.websocket.timeline.closeCode.1009': 'Un message était trop volumineux pour être traité.',
  'workbench.editors.websocket.timeline.closeCode.1010':
    'Le serveur n’a pas négocié une extension requise par le client.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'Le serveur a rencontré une condition inattendue et n’a pas pu répondre.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'Le serveur redémarre.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'Le serveur est surchargé — réessayez plus tard.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'Une passerelle ou un proxy a reçu une réponse invalide du serveur en amont.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'La négociation TLS a échoué.',
  'workbench.editors.websocket.timeline.searchMessages': 'Rechercher dans les messages',
  'workbench.editors.websocket.timeline.messageCount': '{count} messages',
  'workbench.editors.websocket.timeline.dropped': '{count} messages plus anciens sont sortis de la capture',
  'workbench.editors.websocket.timeline.filterAll': 'Tous',
  'workbench.editors.websocket.timeline.filterSent': 'Envoyés',
  'workbench.editors.websocket.timeline.filterReceived': 'Reçus',
  'workbench.editors.websocket.timeline.newestFirst': 'Plus récents en premier',
  'workbench.editors.websocket.timeline.oldestFirst': 'Plus anciens en premier',
  'workbench.editors.websocket.timeline.sortOrder': 'Ordre de tri',
  'workbench.editors.websocket.timeline.groupByDirection': 'Grouper par direction',
  'workbench.editors.websocket.timeline.groupByEvent': 'Grouper par événement',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Lignes par groupe',
  'workbench.editors.websocket.timeline.noLimit': 'Sans limite',
  'workbench.editors.websocket.timeline.clearMessages': 'Effacer les messages',
  'workbench.editors.websocket.timeline.trustCertificate': 'Faire confiance au certificat',
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
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': "Chargement de l'exemple…",
  'workbench.editors.wsExample.notFound':
    "Cet exemple n'existe plus — il a peut-être été supprimé depuis un autre onglet.",
  'workbench.editors.wsExample.openInRequest': 'Ouvrir dans la requête',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Ouvre la requête WebSocket parente avec cette forme capturée comme modifications non enregistrées.',
  'workbench.editors.wsExample.capturedTooltip': 'Capturé le {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'Cet exemple a été supprimé depuis un autre onglet.',
  'workbench.editors.wsExample.toast.saveFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.wsExample.toast.saveFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
} as const satisfies Catalog;
