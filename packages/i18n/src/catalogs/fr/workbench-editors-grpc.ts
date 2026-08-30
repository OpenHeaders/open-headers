/**
 * Workbench editors — gRPC client + gRPC response examples — French.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key. Raw by
 * design: gRPC status-code names (OK, CANCELLED, …) with their
 * `Status code N NAME` lead-ins, rpc/service identifiers ({rpc}),
 * Protobuf / `.proto` / TLS / SSL / base64 vocabulary, `host:port`
 * and `authorization: Bearer <token>` wire syntax, `Metadata` /
 * `Trailers` tab nouns kept as the gRPC protocol terms, and the
 * {count} / {ms} / {bytes} / {name} / {message} holes.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'Requête gRPC introuvable.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (p. ex. grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS activé — cliquez pour passer en clair',
  'workbench.editors.grpc.tls.off': 'TLS désactivé (en clair) — cliquez pour passer en TLS',
  'workbench.editors.grpc.method.placeholder': 'Sélectionnez une méthode',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Liez une spec Protobuf pour choisir une méthode',
  'workbench.editors.grpc.method.unresolvedGroup': 'Absent de la spec liée',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (non résolu)',
  'workbench.editors.grpc.method.linkGroup': 'Lier une spec Protobuf',
  'workbench.editors.grpc.method.importProto': 'Importer un fichier .proto…',
  'workbench.editors.grpc.invoke.label': 'Invoquer',
  'workbench.editors.grpc.invoke.stop': 'Arrêter',
  'workbench.editors.grpc.invoke.browserHost':
    "L'invocation s'exécute sur l'application de bureau — composer et enregistrer fonctionne ici.",
  'workbench.editors.grpc.invoke.needsMethod': 'Choisissez une méthode qui se résout contre la spec liée pour invoquer',
  'workbench.editors.grpc.invoke.needsUrl': 'Saisissez un hôte cible pour invoquer',
  'workbench.editors.grpc.invoke.failed': "Échec de l'invocation — l'hôte n'a pas répondu à l'appel",
  'workbench.editors.grpc.response.title': 'Réponse',
  'workbench.editors.grpc.response.empty.prompt': 'Invoquez une méthode pour obtenir une réponse.',
  'workbench.editors.grpc.response.empty.invoking': 'Invocation…',
  'workbench.editors.grpc.status.kicker': 'Statut gRPC',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions; the `Status code N NAME` tokens ride raw.
  'workbench.editors.grpc.status.desc.unknownCode': 'Un code de statut non standard, hors du vocabulaire gRPC.',
  'workbench.editors.grpc.status.desc.OK':
    "Le code de statut 0 OK est la réponse standard d'une invocation réussie d'une méthode gRPC.",
  'workbench.editors.grpc.status.desc.CANCELLED':
    "Le code de statut 1 CANCELLED est renvoyé si l'opération est annulée par l'appelant.",
  'workbench.editors.grpc.status.desc.UNKNOWN':
    "Le code de statut 2 UNKNOWN est renvoyé si l'opération n'a pas pu aboutir à cause d'une erreur inconnue. " +
    "Par exemple, cette erreur peut être renvoyée quand une valeur de Status reçue d'un autre espace " +
    "d'adressage appartient à un espace d'erreurs inconnu ici. Les erreurs levées par des API qui ne " +
    "renvoient pas assez d'informations peuvent aussi être converties en cette erreur.",
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'Le code de statut 3 INVALID_ARGUMENT est renvoyé si le client a fourni un argument invalide. Il désigne ' +
    "des arguments problématiques quel que soit l'état du système (p. ex. un nom de fichier malformé).",
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    "Le code de statut 4 DEADLINE_EXCEEDED est renvoyé si l'échéance expire avant que l'opération ait pu " +
    "aboutir. Pour les opérations qui changent l'état du système, cette erreur peut être renvoyée même si " +
    "l'opération a réussi. Par exemple, une réponse réussie du serveur a pu être longuement retardée.",
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'Le code de statut 5 NOT_FOUND est renvoyé si une entité demandée (p. ex. un fichier ou un répertoire) ' +
    "n'a pas été trouvée.",
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    "Le code de statut 6 ALREADY_EXISTS est renvoyé si l'entité que vous avez tenté de créer (p. ex. un " +
    'fichier ou un répertoire) existe déjà.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    "Le code de statut 7 PERMISSION_DENIED est renvoyé si l'appelant n'a pas la permission d'exécuter " +
    "l'opération demandée. Ce code n'implique pas que la requête soit valide, ni que l'entité demandée " +
    "existe ou satisfasse d'autres préconditions.",
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'Le code de statut 8 RESOURCE_EXHAUSTED est renvoyé si un quota par utilisateur — voire tout le système ' +
    "de fichiers — est à court d'espace.",
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    "Le code de statut 9 FAILED_PRECONDITION est renvoyé si l'opération a été rejetée parce que le système " +
    "n'était pas dans l'état requis pour son exécution. Par exemple, le répertoire à supprimer n'est pas " +
    "vide, une opération rmdir est appliquée à autre chose qu'un répertoire, etc.",
  'workbench.editors.grpc.status.desc.ABORTED':
    "Le code de statut 10 ABORTED est renvoyé si l'opération a été interrompue, typiquement à cause d'un " +
    "problème de concurrence comme l'échec d'une vérification de séquenceur ou l'abandon d'une transaction.",
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    "Le code de statut 11 OUT_OF_RANGE est renvoyé si l'opération a été tentée au-delà de la plage valide. " +
    'Par exemple, chercher ou lire après la fin du fichier.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    "Le code de statut 12 UNIMPLEMENTED est renvoyé si l'opération n'est pas implémentée, ou n'est pas prise " +
    'en charge / activée dans ce service.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    "Le code de statut 13 INTERNAL est renvoyé en cas d'erreur interne. Cela signifie que des invariants " +
    'attendus par le système sous-jacent ont été rompus.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'Le code de statut 14 UNAVAILABLE est renvoyé si le service est actuellement indisponible.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'Le code de statut 15 DATA_LOSS est renvoyé en cas de perte ou de corruption irrécupérable de données.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    "Le code de statut 16 UNAUTHENTICATED est renvoyé si la requête ne porte pas d'identifiants " +
    "d'authentification valides pour l'opération.",
  'workbench.editors.grpc.response.error.title': "Échec de l'appel",
  'workbench.editors.grpc.response.error.localGuidance':
    "L'appel n'a jamais atteint une réponse. Vérifiez la cible, le mode TLS et que le serveur est joignable.",
  'workbench.editors.grpc.response.error.statusGuidance': 'Vérifiez le message et invoquez à nouveau la méthode.',
  'workbench.editors.grpc.response.tab.response': 'Réponse',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Filtrer les metadata',
  'workbench.editors.grpc.response.filterTrailers': 'Filtrer les trailers',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'Aucun statut gRPC',
  'workbench.editors.grpc.response.connectionLost': 'Connexion perdue',
  'workbench.editors.grpc.response.includeDefaultValues': 'Inclure les valeurs par défaut',
  'workbench.editors.grpc.response.noMessage': 'La réponse ne portait aucun message.',
  'workbench.editors.grpc.response.noMetadata': 'Aucune metadata',
  'workbench.editors.grpc.response.noTrailers': 'Aucun trailer',
  'workbench.editors.grpc.response.trailersOnly':
    "Réponse trailers-only — le statut est arrivé avec les metadata initiales et aucun message n'a suivi.",
  'workbench.editors.grpc.response.compressed':
    "La frame de réponse est compressée — la compression n'est pas négociée, elle ne peut donc pas être décodée.",
  'workbench.editors.grpc.response.structuralNotice':
    "Décodage structurel (numéros de champs) — le type de réponse ne s'est pas résolu contre la spec liée.",
  'workbench.editors.grpc.response.rawNotice': "Le message ne s'est pas décodé ; octets bruts affichés en base64.",
  'workbench.editors.grpc.response.extraFrames':
    '{count} frames de message sont arrivées — une réponse unaire en porte une ; la première est affichée.',
  'workbench.editors.grpc.response.incompleteTail':
    "La réponse s'est terminée au milieu d'une frame ; les frames complètes sont affichées.",
  'workbench.editors.grpc.response.truncated': 'Réponse plafonnée à {bytes} octets.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Message',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.settings': 'Paramètres',
  'workbench.editors.grpc.messagePlaceholder': 'Message de requête en JSON',
  'workbench.editors.grpc.example.label': "Utiliser le message d'exemple",
  'workbench.editors.grpc.example.needsMethod': "Choisissez d'abord une méthode qui se résout contre la spec liée",
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Clé',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Valeur',
  'workbench.editors.grpc.spec.selectLabel': 'Spec Protobuf',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Lier une spec Protobuf…',
  'workbench.editors.grpc.spec.summary': '{services} services · {methods} méthodes',
  'workbench.editors.grpc.spec.parseFailure': '{path} : {message}',
  'workbench.editors.grpc.spec.issue': '{kind} : {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'Échec de la lecture du fichier : {message}',
  'workbench.editors.grpc.spec.importFailed': "Échec de l'import du fichier .proto",
  'workbench.editors.grpc.method.usingSpec': 'Utilise {name}',
  'workbench.editors.grpc.method.refreshSpec': 'Reconstruire depuis les fichiers actuels de la spec',
  'workbench.editors.grpc.settings.exampleCaption': "Exemple d'appel",
  'workbench.editors.grpc.settings.group.connection': 'Connexion',
  'workbench.editors.grpc.settings.group.tls': 'TLS et confiance',
  'workbench.editors.grpc.settings.group.messages': 'Messages',
  'workbench.editors.grpc.settings.groupInfo.connection':
    'Comment l’appel atteint le serveur : la destination du canal, le nom auquel l’appel est adressé, le plafond sur l’appel entier et le keepalive qui détecte une connexion morte en cours d’appel.',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'Comment les canaux TLS établissent la confiance : vérification du certificat du serveur contre les racines système, certificat client présenté par cet appareil, fenêtre de versions TLS et liste de suites de chiffrement de la négociation, et nom SNI proposé.',
  'workbench.editors.grpc.settings.groupInfo.messages':
    'Comment l’atelier traite un message qui ne s’analyse pas — une posture à l’échelle de l’application, ' +
    'partagée avec les paramètres Requêtes API, pas un champ par requête.',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Se connecte à cette socket locale — un chemin absolu de socket Unix, ou un tube nommé Windows comme ' +
    "\\\\.\\pipe\\nom — au lieu d'ouvrir une connexion TCP. La cible continue de déterminer l'en-tête " +
    ':authority, le nom de serveur TLS et la vérification du certificat ; seule la destination de la ' +
    'connexion change. Laissez vide pour une connexion TCP normale.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'Connexion TCP (défaut)',
  'workbench.editors.grpc.settings.timeoutLabel': 'Délai d’appel',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Plafond en temps réel sur l’appel entier — envoyé comme deadline gRPC pour que le serveur puisse ' +
    'l’appliquer, et appliqué localement. Vide ne fixe aucune deadline.',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'Aucune limite (défaut)',
  'workbench.editors.grpc.settings.authorityLabel': 'Autorité',
  'workbench.editors.grpc.settings.authorityHelp':
    'Le :authority auquel l’appel est adressé sur le fil — le nom sur lequel le serveur route — alors que la connexion va toujours vers la cible. Pour une passerelle qui route sur l’autorité, ou un serveur joint par IP qui attend son propre nom. Le nom de serveur TLS et la vérification du certificat gardent l’hôte de la cible ; le réglage du nom de serveur SNI change celui-là. Laissez vide pour envoyer la cible elle-même.',
  'workbench.editors.grpc.settings.authorityPlaceholder': 'La cible (défaut)',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': 'Ping keepalive',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    'Envoie un PING HTTP/2 à cette cadence tant que l’appel est ouvert, pour qu’un flux serveur silencieux ou un unaire lent apprenne qu’une connexion est morte au lieu d’attendre l’échéance. Chaque connexion sert un seul appel, il n’y a donc rien à maintenir entre les appels. Les serveurs refusent les pings plus fréquents que leur plancher — 5 minutes sans données par défaut — en fermant la connexion avec too_many_pings ; l’appel le nomme alors. Laissez vide pour aucun ping.',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': 'Aucun ping (défaut)',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': 'Délai keepalive',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    'Combien de temps attendre l’accusé de réception du ping avant de déclarer la connexion morte et de terminer l’appel en le nommant. Laissez vide pour la valeur par défaut de 20 s.',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 s (défaut)',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': 'Envoyer les messages invalides',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    'Quand le message n’est pas du JSON valide, invoquer quand même avec un message vide et laisser le ' +
    'serveur répondre — en général INVALID_ARGUMENT. Désactivé par défaut : l’invocation échoue avant le ' +
    'réseau avec l’erreur d’analyse exacte. S’applique à toutes les requêtes gRPC.',
  'workbench.editors.grpc.tab.auth': 'Autorisation',
  'workbench.editors.grpc.auth.inheritUnsupported':
    '{type} — de {source} — ne peut pas s’appliquer à un appel gRPC.',
  'workbench.editors.grpc.auth.help':
    "Envoyé comme metadata authorization: Bearer <token> sur l'appel. Une ligne de metadata authorization " +
    'explicite prend le pas.',
  'workbench.editors.grpc.invoke.connectCompanion':
    "Connectez l'application de bureau pour invoquer — composer et enregistrer fonctionne ici.",
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Arrêté',
  'workbench.editors.grpc.stream.tab.timeline': 'Chronologie',
  'workbench.editors.grpc.stream.trailersPending': "Les trailers arrivent à la fin de l'appel.",
  'workbench.editors.grpc.stream.sendMessage': 'Envoyer le message',
  'workbench.editors.grpc.stream.endStreaming': 'Terminer le streaming',
  'workbench.editors.grpc.stream.controlsIdle': "Invoquez d'abord l'appel pour ouvrir le flux",
  'workbench.editors.grpc.stream.sendFailed': "Le message n'est pas parti",
  'workbench.editors.grpc.timeline.requestSent': 'Requête envoyée',
  'workbench.editors.grpc.timeline.noMetadataSent': 'Aucune métadonnée envoyée.',
  'workbench.editors.grpc.timeline.receivedMetadata': '{metadata} reçues.',
  'workbench.editors.grpc.timeline.receivedMetadataLink': 'Métadonnées',
  'workbench.editors.grpc.timeline.noMetadataReceived': 'Aucune métadonnée reçue.',
  'workbench.editors.grpc.timeline.responseReceived': 'Réponse reçue',
  'workbench.editors.grpc.timeline.completed': 'Appel terminé',
  'workbench.editors.grpc.timeline.stopped': 'Appel arrêté',
  'workbench.editors.grpc.timeline.failed': "Échec de l'appel",
  'workbench.editors.grpc.timeline.lost': 'Connexion perdue',
  'workbench.editors.grpc.timeline.noMatches': 'Aucun message ne correspond.',
  'workbench.editors.grpc.timeline.searchMessages': 'Rechercher dans les messages',
  'workbench.editors.grpc.timeline.filterAll': 'Tous',
  'workbench.editors.grpc.timeline.filterSent': 'Envoyés',
  'workbench.editors.grpc.timeline.filterReceived': 'Reçus',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} message',
      many: '{count} messages',
      other: '{count} messages',
    }),
  'workbench.editors.grpc.timeline.sortOrder': 'Tri et regroupement',
  'workbench.editors.grpc.timeline.newestFirst': "Les plus récents d'abord",
  'workbench.editors.grpc.timeline.oldestFirst': "Les plus anciens d'abord",
  'workbench.editors.grpc.timeline.showTypes': 'Afficher les types de message',
  'workbench.editors.grpc.timeline.groupByType': 'Grouper par type de message',
  'workbench.editors.grpc.timeline.groupByDirection': 'Grouper par direction',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Lignes par groupe',
  'workbench.editors.grpc.timeline.noLimit': 'Sans limite',
  'workbench.editors.grpc.timeline.clearMessages': 'Effacer les messages (affichage uniquement)',
  'workbench.editors.grpc.timeline.trustCertificate': 'Faire confiance au certificat',
  'workbench.editors.grpc.timeline.newMessages': 'Nouveaux messages',
  'workbench.editors.grpc.timeline.sentAria': 'Message envoyé',
  'workbench.editors.grpc.timeline.receivedAria': 'Message reçu',
  'workbench.editors.grpc.toast.deletedOtherTab': 'La requête gRPC a été supprimée depuis un autre onglet',
  'workbench.editors.grpc.toast.updateFailed': 'Échec de la mise à jour de la requête gRPC',
  'workbench.editors.grpc.toast.updateFailedDetail': 'Échec de la mise à jour de la requête gRPC : {message}',
  'workbench.editors.grpc.response.saveResponse': 'Enregistrer la réponse',
  'workbench.editors.grpc.toast.savedExample': 'Exemple « {name} » enregistré',
  'workbench.editors.grpc.toast.saveExampleFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.grpc.toast.saveExampleFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.grpcExample.loading': "Chargement de l'exemple…",
  'workbench.editors.grpcExample.notFound': 'Exemple introuvable.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': "L'exemple a été supprimé depuis un autre onglet",
  'workbench.editors.grpcExample.toast.saveFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.grpcExample.toast.saveFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.grpcExample.openInRequest': 'Ouvrir dans la requête',
  'workbench.editors.grpcExample.openInRequestTooltip':
    "Copier l'appel capturé de cet exemple dans l'éditeur de la requête gRPC parente comme modifications non " +
    'enregistrées',
  'workbench.editors.grpcExample.noMethod': 'Aucune méthode enregistrée',
  'workbench.editors.grpcExample.capturedTooltip': 'Capturé le {date}',
  'workbench.editors.grpcExample.result.title': 'Réponse capturée',
} as const satisfies Catalog;
