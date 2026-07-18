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
  'workbench.editors.websocket.connect.disabledPhase':
    "La connexion n'est pas encore câblée — la composition, les docs et les paramètres s'enregistrent déjà ; " +
    'le plan de session arrive ensuite.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Message',
  'workbench.editors.websocket.tab.headers': 'En-têtes',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Paramètres',
  'workbench.editors.websocket.messagePlaceholder': 'Composez le prochain message à envoyer…',
  'workbench.editors.websocket.message.formatText': 'Texte',
  'workbench.editors.websocket.message.formatJson': 'JSON',
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
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Sous-protocoles',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    "Liste d'offres Sec-WebSocket-Protocol, par ordre de préférence — le serveur en choisit un pendant le handshake.",
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Ajouter un sous-protocole…',
  'workbench.editors.websocket.settings.timeoutLabel': 'Délai de connexion (ms)',
  'workbench.editors.websocket.settings.timeoutHelp':
    "Plafond en temps réel sur le handshake de connexion. Vide, la valeur par défaut de l'application s'applique.",
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Par défaut',
  'workbench.editors.websocket.toast.deletedOtherTab':
    'Cette requête WebSocket a été supprimée depuis un autre onglet.',
  'workbench.editors.websocket.toast.updateFailed': "Échec de l'enregistrement de la requête WebSocket",
  'workbench.editors.websocket.toast.updateFailedDetail':
    "Échec de l'enregistrement de la requête WebSocket : {message}",
} as const satisfies Catalog;
