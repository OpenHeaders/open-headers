/**
 * Workbench editors — the MQTT client editor, French. Wire vocabulary
 * (mqtt/mqtts/ws/wss schemes, CONNECT / PUBLISH / RETAIN / PINGREQ
 * tokens, QoS, topic filters, AsyncAPI, the 5.0 property names the
 * spec fixes in English) rides raw inside keyed values. « sujet » =
 * topic; « filtre de sujet » = topic filter; « charge utile » =
 * payload; « testament » = last will; « courtier » = broker.
 */

import { plural } from '../../runtime';
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
  'workbench.editors.mqtt.connect.label': 'Se connecter',
  'workbench.editors.mqtt.connect.disconnect': 'Se déconnecter',
  'workbench.editors.mqtt.connect.cancel': 'Annuler',
  'workbench.editors.mqtt.connect.reconnectNow': 'Reconnecter maintenant',
  'workbench.editors.mqtt.connect.reconnectNowHint':
    'Lancer la prochaine tentative de reconnexion sans attendre la fin du délai',
  'workbench.editors.mqtt.connect.needsUrl': 'Saisissez une URL de broker pour vous connecter.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Message',
  'workbench.editors.mqtt.tab.topics': 'Sujets',
  'workbench.editors.mqtt.tab.auth': 'Autorisation',
  'workbench.editors.mqtt.tab.properties': 'Propriétés',
  'workbench.editors.mqtt.tab.lastWill': 'Testament',
  'workbench.editors.mqtt.tab.settings': 'Paramètres',
  'workbench.editors.mqtt.tabInfo.docs.summary':
    'Notes Markdown conservées avec cette requête et montrées à quiconque l’ouvre.',
  'workbench.editors.mqtt.tabInfo.docs.detail': 'Des notes pour les humains ; rien d’ici n’atteint le courtier.',
  'workbench.editors.mqtt.tabInfo.message.summary':
    'Le sujet, la charge utile, le QoS et le drapeau retain qu’Envoyer publie, avec les messages enregistrés pour réutilisation.',
  'workbench.editors.mqtt.tabInfo.message.detail':
    'Les propriétés de publication (5.0) vivent derrière l’engrenage Propriétés de la barre de composition ; les variables se résolvent à l’envoi.',
  'workbench.editors.mqtt.tabInfo.topics.summary':
    'Les abonnements que la session ouvre dès que le courtier accepte la connexion, un filtre par ligne.',
  'workbench.editors.mqtt.tabInfo.topics.detail':
    'Les jokers + et # sont bienvenus ; les lignes désactivées restent enregistrées et ne s’abonnent pas ; les options 5.0 sont derrière l’engrenage de chaque ligne.',
  'workbench.editors.mqtt.tabInfo.auth.summary':
    'User Name et Password dans le paquet CONNECT ; les deux versions MQTT les transportent.',
  'workbench.editors.mqtt.tabInfo.auth.detail':
    'Aucune n’envoie pas d’identifiant, Hériter reprend l’auth de la collection ou de l’espace de travail ; les variables se résolvent à la connexion.',
  'workbench.editors.mqtt.tabInfo.properties.summary':
    'Propriétés utilisateur envoyées une fois sur CONNECT ; métadonnées libres lisibles par le courtier et d’autres outils.',
  'workbench.editors.mqtt.tabInfo.properties.detail':
    'Une fonction MQTT 5.0 ; dans une session 3.1.1 les lignes restent enregistrées et ne sont pas envoyées.',
  'workbench.editors.mqtt.tabInfo.lastWill.summary':
    'Déposé auprès du courtier sur CONNECT et publié à votre place si la session tombe sans déconnexion propre.',
  'workbench.editors.mqtt.tabInfo.lastWill.detail':
    'Un testament ne se dépose qu’avec un sujet ; un bloc sans sujet est conservé, pas envoyé. Le délai et les propriétés sont 5.0.',
  'workbench.editors.mqtt.tabInfo.scripts.summary':
    'Quatre crochets autour de la session : Avant la connexion, Avant la publication, À la réception, Après la fermeture.',
  'workbench.editors.mqtt.tabInfo.scripts.detail':
    'Les scripts de la collection et de l’espace de travail s’exécutent autour de ceux de cette requête ; les exécutions et les échecs s’affichent dans l’onglet Scripts de la session.',
  'workbench.editors.mqtt.tabInfo.settings.summary':
    'Les réglages CONNECT de la session : identifiant client, clean start, keep-alive, limites de session, reconnexion, TLS.',
  'workbench.editors.mqtt.tabInfo.settings.detail':
    'Une ligne laissée vide hérite de la valeur de la collection ou de l’espace de travail ; les valeurs propres à la requête marquent leur ligne d’un point.',
  'workbench.editors.mqtt.tabInfo.spec.summary':
    'Liez une spécification AsyncAPI pour composer à partir de ses canaux et de ses messages d’exemple.',
  'workbench.editors.mqtt.tabInfo.spec.detail':
    'Une liaison est une métadonnée de la requête, pas une partie de la session ; rien n’est envoyé.',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS :',
  'workbench.editors.mqtt.qos.meaning0': 'Au plus une fois',
  'workbench.editors.mqtt.qos.meaning1': 'Au moins une fois',
  'workbench.editors.mqtt.qos.meaning2': 'Exactement une fois',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Envoyer',
  'workbench.editors.mqtt.composeInfo.topic':
    'Le sujet sur lequel Envoyer publie ; un nom concret, sans joker. Les variables se résolvent à l’envoi.',
  'workbench.editors.mqtt.composeInfo.qos':
    'Le niveau de livraison que le courtier doit à ce message ; un abonné le reçoit au plus bas de ce niveau et du QoS de son propre abonnement.',
  'workbench.editors.mqtt.composeInfo.retain':
    'Demande au courtier de garder ce message comme le dernier du sujet et de le remettre à chaque nouvel abonné ; une charge utile retenue vide l’efface.',
  'workbench.editors.mqtt.topicPlaceholder': 'Sujet de publication',
  'workbench.editors.mqtt.topicExample': 'p. ex. sensors/1/temperature',
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
  'workbench.editors.mqtt.props.hint': 'Métadonnées MQTT 5.0 envoyées avec chaque message.',
  'workbench.editors.mqtt.props.title': 'Propriétés du message',
  'workbench.editors.mqtt.props.gearLabel': 'Propriétés',
  'workbench.editors.mqtt.props.userProperties': 'Propriétés utilisateur',
  'workbench.editors.mqtt.props.v5Note':
    'Une fonctionnalité MQTT 5.0 ; dans une session 3.1.1 les valeurs restent enregistrées et ne sont pas envoyées.',
  'workbench.editors.mqtt.props.userPropKey': 'Propriété',
  'workbench.editors.mqtt.props.userPropValue': 'Valeur',
  'workbench.editors.mqtt.props.addUserProp': 'Propriété utilisateur',
  'workbench.editors.mqtt.props.removeUserProp': 'Supprimer la propriété utilisateur',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.responseTopicDesc':
    'Sujet sur lequel le destinataire est invité à répondre — requête/réponse par-dessus pub/sub. Vide signifie que la propriété n’est pas envoyée.',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.correlationDataDesc':
    'Jeton opaque que le destinataire recopie sur sa réponse afin qu’elle puisse être rattachée à ce message. Vide signifie que la propriété n’est pas envoyée.',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval',
  'workbench.editors.mqtt.props.messageExpiryDesc':
    'Secondes pendant lesquelles le courtier garde le message livrable ; passé ce délai il est abandonné au lieu d’être livré. Vide signifie que le message n’expire jamais.',
  'workbench.editors.mqtt.props.messageExpiryPlaceholder': 'Sans expiration (défaut)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.contentTypeDesc':
    'Type MIME décrivant la charge utile, transmis tel quel aux destinataires. Vide signifie que la propriété n’est pas envoyée.',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator',
  'workbench.editors.mqtt.props.payloadFormatIndicatorDesc':
    'Marque la charge utile comme texte UTF-8 plutôt que comme octets non spécifiés ; le courtier et les destinataires peuvent la valider.',
  'workbench.editors.mqtt.props.nonePlaceholder': 'Aucun (défaut)',
  'workbench.editors.mqtt.props.sectionPropertiesDesc':
    'Paires clé-valeur libres transportées avec le message — des métadonnées applicatives que le courtier transmet telles quelles.',
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
  'workbench.editors.mqtt.topics.filterLabel': 'Sujet',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Sujet, p. ex. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Options',
  'workbench.editors.mqtt.topics.optionsTitle': 'Options d’abonnement',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Abonnement',
  'workbench.editors.mqtt.topics.subscribeLabel': 'S’abonner à l’ouverture de la session',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'S’abonner / se désabonner sur la session ouverte — la ligne enregistrée n’est pas modifiée',
  'workbench.editors.mqtt.topics.colInfo.filter':
    'Le filtre de sujet auquel cette ligne s’abonne ; un SUBSCRIBE par ligne. + couvre un niveau, # tout ce qui suit ; les variables se résolvent à la connexion.',
  'workbench.editors.mqtt.topics.colInfo.qos':
    'Le QoS le plus élevé que le courtier peut livrer sur cet abonnement ; un message publié à un niveau inférieur arrive au sien.',
  'workbench.editors.mqtt.topics.qosLevelsHeading': 'Niveaux',
  'workbench.editors.mqtt.topics.colInfo.options':
    'Les options d’abonnement MQTT 5.0 et les propriétés utilisateur envoyées avec le SUBSCRIBE de cette ligne ; une session 3.1.1 n’envoie que le filtre et le QoS.',
  'workbench.editors.mqtt.topics.colInfo.subscribe':
    'Si la ligne s’abonne à l’ouverture de la session ; désactivée, elle reste enregistrée et silencieuse. Connecté, l’interrupteur est la bascule en direct, et un octroi refusé marque la ligne.',
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
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'Aucun (défaut)',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Propriétés d’abonnement',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'Le Subscription Identifier que le paquet SUBSCRIBE porte comme propriété ; le broker le renvoie avec chaque message livré par cet abonnement.',
  'workbench.editors.mqtt.topics.subscribeUserPropertiesDesc':
    'User Properties envoyées une fois avec le paquet SUBSCRIBE de cette ligne. Le broker définit leur signification ; elles ne sont pas jointes aux messages livrés.',
  'workbench.editors.mqtt.auth.inheritUnsupported':
    '{type} — de {source} — ne peut pas s’appliquer à une session MQTT.',
  'workbench.editors.mqtt.auth.ownUnsupported': '{type} ne peut pas s’appliquer à une session MQTT.',
  'workbench.editors.mqtt.auth.help':
    'Envoyés comme User Name et Password du paquet CONNECT sur chaque hôte — les deux versions MQTT les transportent. Les variables se résolvent à la connexion ; les exemples enregistrés ne capturent jamais l’identifiant.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Propriété',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Valeur',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Sujet du testament',
  'workbench.editors.mqtt.will.topicExample': 'p. ex. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, en secondes — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayLabel': 'Délai du testament',
  'workbench.editors.mqtt.will.propsTitle': 'Propriétés du testament',
  'workbench.editors.mqtt.will.propsSummary':
    'Propriétés MQTT 5.0 du message de testament, déposées dans CONNECT ; le broker les joint quand il publie le testament.',
  'workbench.editors.mqtt.will.info.topic':
    'Le sujet sur lequel le courtier publie le testament ; un nom concret, sans joker. Sans sujet, aucun testament n’est déposé.',
  'workbench.editors.mqtt.will.info.qos': 'Le niveau de livraison que le courtier utilise pour publier le testament.',
  'workbench.editors.mqtt.will.info.retain':
    'Garde le testament comme dernier message du sujet une fois publié — ainsi un sujet d’état continue de se lire « hors ligne » après la coupure.',
  'workbench.editors.mqtt.will.info.delay':
    'Secondes que le courtier attend après la chute de la session avant de publier le testament ; une reconnexion dans ce délai l’annule. MQTT 5.0.',
  'workbench.editors.mqtt.will.delayPlaceholder': '0 s (défaut)',
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
    'Durée pendant laquelle le courtier conserve la session après déconnexion — 0 la termine à la déconnexion. Clean Start ne fait qu’écarter la session précédente à la connexion ; l’intervalle régit la nouvelle dans tous les cas.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (défaut)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalle de battement promis au courtier — le client répond et émet PINGREQ. Vide utilise 60 s ; 0 le désactive.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (défaut)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Délai de connexion',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Plafond horloge sur l’ouverture de connexion seulement — une session ouverte n’a pas de plafond. Vide applique le délai par défaut de 30 s.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '30 s (défaut)',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Nombre de messages QoS 1/2 pouvant être en vol vers ce client à la fois. Vide applique le défaut de la spécification, 65 535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65 535 (défaut)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Plus grand paquet accepté par ce client — le courtier abandonne les plus gros. Vide n’impose aucune limite.',
  'workbench.editors.mqtt.settings.noLimit': 'Aucune limite (défaut)',
  'workbench.editors.mqtt.settings.cleanSessionLabel': 'Clean Session',
  'workbench.editors.mqtt.settings.topicAliasMaximumLabel': 'Topic Alias Maximum',
  'workbench.editors.mqtt.settings.topicAliasMaximumHelp':
    'Nombre d’alias de topic que le courtier peut employer vers ce client — les publications aliasées portent un numéro au lieu du topic. Vide n’en autorise aucun, le défaut de la spécification.',
  'workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder': '0 (défaut)',
  'workbench.editors.mqtt.settings.requestResponseInfoLabel': 'Request Response Information',
  'workbench.editors.mqtt.settings.requestResponseInfoHelp':
    'Demander au courtier une Response Information dans CONNACK — le topic de base des échanges requête/réponse. Désactivé par défaut.',
  'workbench.editors.mqtt.settings.requestProblemInfoLabel': 'Request Problem Information',
  'workbench.editors.mqtt.settings.requestProblemInfoHelp':
    'Autoriser le courtier à joindre des Reason Strings et des propriétés utilisateur aux paquets d’échec. Activé par défaut.',
  'workbench.editors.mqtt.settings.clientIdExample': 'p. ex. reporter-1',
  'workbench.editors.mqtt.settings.alpnLabel': 'Protocole ALPN',
  'workbench.editors.mqtt.settings.alpnHelp':
    'Protocole applicatif proposé dans la poignée de main TLS des sessions mqtts — les courtiers multiplexant MQTT sur un port TLS partagé y font leur choix. Vide n’en propose aucun.',
  'workbench.editors.mqtt.settings.alpnPlaceholder': 'Aucun (défaut)',
  'workbench.editors.mqtt.settings.alpnExample': 'p. ex. mqtt',
  'workbench.editors.mqtt.settings.group.connection': 'Connexion',
  'workbench.editors.mqtt.settings.group.session': 'Session — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS et confiance',
  'workbench.editors.mqtt.settings.group.resilience': 'Résilience de session',
  'workbench.editors.mqtt.settings.groupInfo.resilience':
    'Si une connexion coupée se rouvre et avec quelle patience : la période de reconnexion, le plafond de tentatives et l’attente exponentielle entre elles.',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'Comment CONNECT ouvre la session : l’identité présentée, s’il repart de zéro et les plafonds de battement ' +
    'et d’ouverture promis.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'Conditions MQTT 5.0 que CONNECT propose au courtier : combien de temps la session survit à une déconnexion, ' +
    'plus les plafonds de messages en vol et de taille de paquet acceptés par ce client.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'Comment les sessions mqtts/wss établissent la confiance : vérification du certificat du broker contre les racines système, certificat client présenté par cet appareil, fenêtre de versions TLS et liste de suites de chiffrement, et nom SNI et offre ALPN de la négociation.',
  'workbench.editors.mqtt.settings.sessionV311': 'Réglages MQTT 5.0 — cette requête cible 3.1.1.',
  // ── Volet de session ────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Réponse',
  'workbench.editors.mqtt.session.emptyHint': 'Connectez-vous pour envoyer et recevoir des messages.',
  'workbench.editors.mqtt.session.connectFailed': 'L’ouverture de la session a échoué',
  'workbench.editors.mqtt.session.connectingBadge': 'Connexion',
  'workbench.editors.mqtt.session.connectedBadge': 'Connecté',
  'workbench.editors.mqtt.session.notSubscribed': 'Abonné à aucun sujet',
  'workbench.editors.mqtt.session.subscribedOne': 'Abonné à 1 sujet',
  'workbench.editors.mqtt.session.subscribedMany': 'Abonné à {count} sujets',
  'workbench.editors.mqtt.session.tab.timeline': 'Chronologie',
  'workbench.editors.mqtt.session.tab.connection': 'Connexion',
  'workbench.editors.mqtt.session.tab.scripts': 'Scripts',
  'workbench.editors.mqtt.tab.scripts': 'Scripts',
  'workbench.editors.mqtt.timeline.script': '{hook} — {levels}',
  'workbench.editors.mqtt.timeline.scriptFailed': '{hook} a échoué — {error}',
  'workbench.editors.mqtt.timeline.scriptDropped': '{hook} a abandonné le message — {level}',
  'workbench.editors.mqtt.timeline.scriptAttempt': 'tentative {attempt}',
  'workbench.editors.mqtt.session.scripts.empty': "Aucun script n'a été exécuté dans cette session.",
  'workbench.editors.mqtt.session.scripts.console': 'Console',
  'workbench.editors.mqtt.session.scripts.tests': 'Tests',
  'workbench.editors.mqtt.session.scripts.consoleEmpty': 'Rien de journalisé.',
  'workbench.editors.mqtt.session.scripts.testsEmpty': 'Aucune assertion enregistrée.',
  'workbench.editors.mqtt.session.scripts.attempt': 'tentative {attempt}',
  'workbench.editors.mqtt.session.scripts.atMessage': 'événement {index}',
  'workbench.editors.mqtt.session.scripts.tag': 'Scripts · {count}',
  'workbench.editors.mqtt.session.scripts.tagTitle': 'Scripts de session',
  'workbench.editors.mqtt.session.scripts.tagSummary':
    'Les hooks exécutés dans cette session, avec les niveaux qui ont contribué.',
  'workbench.editors.mqtt.session.scripts.tagSummaryFailed':
    'Un hook a échoué — sa dernière erreur est indiquée en dessous.',
  'workbench.editors.mqtt.session.scripts.runs': '{count} exécutions',
  'workbench.editors.mqtt.session.scripts.runsOne': '1 exécution',
  'workbench.editors.mqtt.session.scripts.failed': '{count} en échec',
  'workbench.editors.mqtt.session.scripts.dropped': '{count} abandonnés',
  'workbench.editors.mqtt.session.scripts.marksCapped':
    'Le détail par événement s’est arrêté après {count} exécutions ; les hooks continuent de s’exécuter et les compteurs complets arrivent à la fin de la session.',
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
  'workbench.editors.mqtt.timeline.lost': 'Connexion perdue',
  'workbench.editors.mqtt.timeline.reconnecting': 'Tentative de reconnexion {attempt}',
  'workbench.editors.mqtt.timeline.reconnected': 'Reconnecté au broker',
  'workbench.editors.mqtt.session.reconnectingBadge': 'Reconnexion',
  'workbench.editors.mqtt.session.reconnectRefusedTag': 'Reconnexion refusée',
  'workbench.editors.mqtt.session.reconnectRefused': 'reconnexion refusée : {reason}',
  'workbench.editors.mqtt.timeline.reconnectingAfter': 'Tentative de reconnexion {attempt} après {delay}',
  'workbench.editors.mqtt.timeline.reconnectingNow': 'Tentative de reconnexion {attempt} maintenant',
  'workbench.editors.mqtt.timeline.reconnectedDroppedOne': 'un message non acquitté abandonné',
  'workbench.editors.mqtt.timeline.reconnectedDroppedMany': '{count} messages non acquittés abandonnés',
  'workbench.editors.mqtt.session.reconnectExhaustedTag': 'Reconnexion abandonnée',
  'workbench.editors.mqtt.session.reconnectExhausted': 'reconnexion abandonnée après {attempts}',
  'workbench.editors.mqtt.session.reconnectExhaustedReason': 'reconnexion abandonnée après {attempts} : {reason}',
  'workbench.editors.mqtt.session.reconnectAttemptsOne': 'une tentative',
  'workbench.editors.mqtt.session.reconnectAttemptsMany': '{count} tentatives',
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
  'workbench.editors.mqtt.timeline.disconnected': 'Déconnecté du broker',
  'workbench.editors.mqtt.timeline.stopped': 'Arrêté',
  'workbench.editors.mqtt.timeline.subscribed': 'Abonné à',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Désabonné de',
  'workbench.editors.mqtt.timeline.grantFailed': 'Refusé, code {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'Aucun message ne correspond au filtre.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Rechercher des messages',
  'workbench.editors.mqtt.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} message',
      many: '{count} messages',
      other: '{count} messages',
    }),
  'workbench.editors.mqtt.timeline.messageCountFiltered': '{shown} sur {total} messages',
  'workbench.editors.mqtt.timeline.dropped': '{count} messages plus anciens sortis de la capture',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'Tous les topics',
  'workbench.editors.mqtt.timeline.filterAll': 'Tous',
  'workbench.editors.mqtt.timeline.filterSent': 'Envoyés',
  'workbench.editors.mqtt.timeline.filterReceived': 'Reçus',
  'workbench.editors.mqtt.timeline.filterLifecycle': 'Cycle de vie uniquement',
  'workbench.editors.mqtt.timeline.newestFirst': 'Plus récents en premier',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Plus anciens en premier',
  'workbench.editors.mqtt.timeline.sortOrder': 'Ordre de tri',
  'workbench.editors.mqtt.timeline.sortBy': 'Trier par',
  'workbench.editors.mqtt.timeline.view': 'Affichage',
  'workbench.editors.mqtt.timeline.viewTooltip': 'Options d’affichage',
  'workbench.editors.mqtt.timeline.viewGroup': 'Grouper',
  'workbench.editors.mqtt.timeline.groupByTopic': 'Grouper par topic',
  'workbench.editors.mqtt.timeline.groupByDirection': 'Grouper par direction',
  'workbench.editors.mqtt.timeline.rowsPerGroup': 'Lignes par groupe',
  'workbench.editors.mqtt.timeline.noLimit': 'Sans limite',
  'workbench.editors.mqtt.timeline.clearMessages': 'Effacer les messages',
  'workbench.editors.mqtt.timeline.clear': 'Effacer',
  'workbench.editors.mqtt.timeline.filterAllMessages': 'Tous les messages',
  'workbench.editors.mqtt.timeline.directionFilter': 'Sens des messages',
  'workbench.editors.mqtt.timeline.trustCertificate': 'Faire confiance au certificat',
  'workbench.editors.mqtt.timeline.newMessages': 'Nouveaux messages',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Charge utile binaire ({bytes} octets)',
  'workbench.editors.mqtt.timeline.emptyMessage': '(vide)',
  'workbench.editors.mqtt.timeline.copyMessage': 'Copier le message',
  'workbench.editors.mqtt.timeline.info.label': 'Détails du message',
  'workbench.editors.mqtt.timeline.info.size': 'Taille',
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
