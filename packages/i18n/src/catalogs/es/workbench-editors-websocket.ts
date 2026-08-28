/**
 * Workbench editors — the WebSocket client editor, Spanish. Wire
 * vocabulary (ws/wss schemes, subprotocol identifiers, AsyncAPI, the
 * `handshake` loanword, `frame` (m.) for wire frames, Socket.IO
 * decoded-row vocabulary, `ack`, `Arg`, `Bearer token`, `Token`,
 * `long-polling`, `array` (m.)) rides raw inside keyed values. The
 * Params tab stays raw — `Configuración` is the Settings-tab mint
 * (gRPC editor precedent); prose says «parámetros». The spec-browser
 * section headers mirror AsyncAPI document keywords and ride raw
 * (spec outline law); prose says «canales» / «operaciones». Quoted
 * mints: tab `Autorización` (request editor), `Enviar`, `Guardar la
 * respuesta` (grpc donors), toast idiom «No se pudo…», `acuñar` for
 * mint (S66).
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'No se encontró la solicitud WebSocket.',
  'workbench.editors.websocket.connect.label': 'Conectar',
  'workbench.editors.websocket.connect.disconnect': 'Desconectar',
  'workbench.editors.websocket.connect.cancel': 'Cancelar',
  'workbench.editors.websocket.connect.browserHost':
    'Las sesiones WebSocket se ejecutan en la aplicación de escritorio o el servidor.',
  'workbench.editors.websocket.connect.needsUrl': 'Introduce una URL ws:// o wss:// para conectarte.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Mensaje',
  'workbench.editors.websocket.tab.events': 'Eventos',
  'workbench.editors.websocket.tab.auth': 'Autorización',
  'workbench.editors.websocket.tab.headers': 'Encabezados',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': 'Configuración',
  'workbench.editors.websocket.messagePlaceholder': 'Compón el siguiente mensaje a enviar…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 del mensaje binario, p. ej. aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hexadecimal del mensaje binario, p. ej. 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Texto',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Binario',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexadecimal',
  'workbench.editors.websocket.message.invalidGate': 'Corrige primero la codificación del mensaje.',
  'workbench.editors.websocket.message.invalidBase64':
    'Base64 no válido: los bytes decodificados son lo que se enviaría.',
  'workbench.editors.websocket.message.invalidHex':
    'Hexadecimal no válido: pares de dígitos 0-9 a-f se decodifican en los bytes enviados.',
  'workbench.editors.websocket.auth.helpRaw':
    'Se envía como encabezado Authorization: Bearer en el handshake — se aplica en la aplicación de ' +
    'escritorio o el servidor; los navegadores no pueden definirlo en un WebSocket. Una fila de encabezado ' +
    'Authorization explícita tiene prioridad.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Se envía como carga auth del paquete CONNECT ({"token": …}) en cada host, y como encabezado de ' +
    'handshake Authorization: Bearer en la aplicación de escritorio o el servidor. Una fila de encabezado ' +
    'Authorization explícita tiene prioridad sobre el encabezado.',
  'workbench.editors.websocket.events.hint':
    'Los eventos entrantes que mostrar en la cronología de la sesión. Sin filas, se muestra cada evento; ' +
    'la captura siempre lo registra todo.',
  'workbench.editors.websocket.events.namePlaceholder': 'Nombre del evento',
  'workbench.editors.websocket.events.listenLabel': 'Escuchar',
  'workbench.editors.websocket.event.namePlaceholder': 'Nombre del evento',
  'workbench.editors.websocket.event.ackLabel': 'Esperar ack',
  'workbench.editors.websocket.event.ackHelp':
    'Acuña un id de acuse de recibo con cada Enviar para que la respuesta ack del servidor se correlacione ' +
    'en la cronología.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Compón el array de argumentos JSON, p. ej. ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': 'Quitar el argumento {index}',
  'workbench.editors.websocket.event.argPlaceholder': 'Compón este argumento como JSON, p. ej. "hello" o {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Nombre del encabezado',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Valor',
  'workbench.editors.websocket.headers.hint.host':
    'Derivado de la URL de destino al conectar — el host al que se dirige la solicitud de upgrade.',
  'workbench.editors.websocket.headers.hint.connection':
    'Pide al servidor cambiar de protocolo; un saludo de apertura WebSocket siempre lleva Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Nombra el protocolo de destino — cada saludo WebSocket cambia la conexión HTTP a websocket.',
  'workbench.editors.websocket.headers.hint.key':
    'Un nonce aleatorio generado para cada conexión; el servidor demuestra haber leído el saludo devolviendo su hash en Sec-WebSocket-Accept.',
  'workbench.editors.websocket.headers.hint.version':
    'La versión del protocolo WebSocket (RFC 6455); 13 es la única versión en uso.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Ofrece compresión por mensaje; el servidor puede aceptar, acotar o ignorar la oferta en su respuesta.',
  'workbench.editors.websocket.headers.hint.origin':
    'El origen de la página que el navegador añade a cada saludo WebSocket; los servidores lo usan para rechazar conexiones entre sitios.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'El navegador se identifica en el saludo; el código de la página no puede cambiarlo.',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'El navegador marca la solicitud de upgrade como no cacheable.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'Las codificaciones de contenido que el navegador acepta en la respuesta del saludo.',
  'workbench.editors.websocket.headers.hint.acceptLanguage':
    'Los idiomas preferidos del navegador, tomados de su configuración.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'El saludo del runtime de node acepta cualquier tipo de medio en la respuesta.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage': 'El saludo del runtime de node envía un comodín.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Añadido por el runtime de node en cada saludo WebSocket.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'El runtime de node identifica esta aplicación en el saludo. Añade tu propia fila User-Agent para enviar otro.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'El runtime de node marca la solicitud de upgrade como no cacheable.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'Las codificaciones de contenido que el runtime de node acepta en la respuesta del saludo.',
  'workbench.editors.websocket.headers.browserNotSent':
    'No se envía — el navegador fija por sí mismo las cabeceras del saludo. Las cabeceras personalizadas se aplican cuando la sesión se ejecuta en la aplicación de escritorio o el servidor.',
  'workbench.editors.websocket.spec.selectLabel': 'Especificación AsyncAPI',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Vincular una especificación AsyncAPI',
  'workbench.editors.websocket.spec.summary': '{servers} servidores · {channels} canales · {operations} operaciones',
  'workbench.editors.websocket.spec.parseFailure': 'La especificación no se pudo analizar: {message}',
  'workbench.editors.websocket.spec.issues': '{count} problemas en la especificación',
  'workbench.editors.websocket.spec.useExample': 'Usar un mensaje de ejemplo…',
  'workbench.editors.websocket.spec.browser.hint': 'Elige un mensaje para componer su carga de ejemplo.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.specFooter.using': 'Usando {name}',
  'workbench.editors.websocket.specFooter.none': 'Ninguna especificación AsyncAPI vinculada',
  'workbench.editors.websocket.settings.group.connection': 'Conexión',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS y confianza',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'Cómo abre el handshake la sesión: los subprotocolos que ofrece, adónde marca la conexión y el techo de ' +
    'la apertura.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Cómo dirige el CONNECT de Socket.IO al servidor: el espacio de nombres al que se une la sesión.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'Cómo establecen confianza las sesiones wss:: si se verifica el certificado del servidor contra las ' +
    'raíces del sistema.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotocolos',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Lista de ofertas Sec-WebSocket-Protocol, en orden de preferencia — el servidor elige uno durante el ' +
    'handshake.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Ninguno (por defecto)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'p. ej. graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Conecta a este socket local — una ruta absoluta de socket Unix, o una tubería con nombre de Windows ' +
    'como \\\\.\\pipe\\nombre — en lugar de abrir una conexión TCP. La URL sigue determinando el Host del ' +
    'handshake, el nombre de servidor TLS y la verificación del certificado; solo cambia adónde va la ' +
    'conexión. Déjalo vacío para una conexión TCP normal.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'Conexión TCP (por defecto)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Tiempo de espera de conexión',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Techo de reloj solo para el handshake de conexión; una sesión abierta no tiene techo. Vacío no fija ' +
    'ningún plazo.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Sin límite (por defecto)',
  'workbench.editors.websocket.settings.namespaceLabel': 'Espacio de nombres',
  'workbench.editors.websocket.settings.namespaceHelp':
    'El espacio de nombres al que se conecta la sesión — vacío conecta a la raíz /. Las sesiones marcan ' +
    'directamente el transporte websocket; no hay respaldo de long-polling.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (por defecto)',
  'workbench.editors.websocket.settings.namespaceExample': 'p. ej. /admin',
  'workbench.editors.websocket.settings.sslVerifyLabel': 'Verificación del certificado SSL',
  'workbench.editors.websocket.settings.sslVerifyHelp':
    'Verifica el certificado del servidor contra las raíces del sistema para las sesiones wss:. Desactívala ' +
    'para servidores de desarrollo con certificados autofirmados. Se aplica en la aplicación de escritorio ' +
    'o el servidor.',
  'workbench.editors.websocket.settings.sslVerifyWarning':
    'Las sesiones omiten la comprobación de identidad del servidor — se acepta cualquier certificado, ' +
    'incluidos los autofirmados y caducados.',
  'workbench.editors.websocket.toast.deletedOtherTab': 'Esta solicitud WebSocket se eliminó desde otra pestaña.',
  'workbench.editors.websocket.toast.updateFailed': 'No se pudo guardar la solicitud WebSocket',
  'workbench.editors.websocket.toast.updateFailedDetail': 'No se pudo guardar la solicitud WebSocket: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Ejemplo {name} guardado',
  'workbench.editors.websocket.toast.saveExampleFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Respuesta',
  'workbench.editors.websocket.session.emptyHint': 'Conéctate para enviar y recibir mensajes.',
  'workbench.editors.websocket.session.connectFailed': 'No se pudo abrir la sesión',
  'workbench.editors.websocket.session.connectingBadge': 'Conectando',
  'workbench.editors.websocket.session.connectedBadge': 'Conectado',
  'workbench.editors.websocket.session.closedTag': 'Cerrada {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Detenida',
  'workbench.editors.websocket.session.disconnectedTag': 'Desconectado',
  'workbench.editors.websocket.session.connectFailedTag': 'Error de conexión',
  'workbench.editors.websocket.session.abortedTag': 'Cancelada',
  'workbench.editors.websocket.session.noCloseFrame': 'La conexión terminó sin frame Close',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Enviar',
  'workbench.editors.websocket.session.saveResponse': 'Guardar la respuesta',
  'workbench.editors.websocket.session.sendIdle': 'Conéctate para enviar mensajes.',
  'workbench.editors.websocket.session.sendFailed': 'No se pudo enviar el mensaje',
  'workbench.editors.websocket.session.hostNotice':
    'Ejecutando en el socket del navegador — {knobs} no se aplican en este host.',
  'workbench.editors.websocket.session.knobHeaders': 'los encabezados de handshake personalizados',
  'workbench.editors.websocket.session.knobSslVerify': 'la verificación SSL desactivada',
  'workbench.editors.websocket.session.knobAuth': 'el encabezado de credenciales bearer',
  'workbench.editors.websocket.session.handshakeNone': 'Nada negociado',
  'workbench.editors.websocket.session.handshakeNote':
    'El socket de la plataforma solo expone el subprotocolo y las extensiones negociados — los encabezados ' +
    'de la respuesta 101 no están disponibles para los clientes.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Conectando',
  'workbench.editors.websocket.timeline.connected': 'Conectado',
  'workbench.editors.websocket.timeline.disconnected': 'Desconectado',
  'workbench.editors.websocket.timeline.stopped': 'Detenido',
  'workbench.editors.websocket.timeline.aborted': 'Conexión cancelada',
  'workbench.editors.websocket.timeline.noMatches': 'Ningún mensaje coincide con el filtro.',
  'workbench.editors.websocket.timeline.connectedTo': 'Conectado a {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Copiar mensaje',
  'workbench.editors.websocket.saved.title': 'Mensajes guardados',
  'workbench.editors.websocket.saved.addTooltip': 'Guardar la composición actual como mensaje reutilizable',
  'workbench.editors.websocket.saved.showRail': 'Mostrar mensajes guardados',
  'workbench.editors.websocket.saved.hideRail': 'Ocultar mensajes guardados',
  'workbench.editors.websocket.saved.emptyHint': 'Guarda mensajes para reutilizarlos durante una conexión activa.',
  'workbench.editors.websocket.saved.defaultName': 'Mensaje',
  'workbench.editors.websocket.saved.sendTooltip': 'Enviar este mensaje guardado tal como está',
  'workbench.editors.websocket.saved.rename': 'Renombrar',
  'workbench.editors.websocket.saved.duplicate': 'Duplicar',
  'workbench.editors.websocket.saved.delete': 'Eliminar',
  'workbench.editors.websocket.timeline.saveMessage': 'Guardar mensaje',
  'workbench.editors.websocket.timeline.info.label': 'Detalles del mensaje',
  'workbench.editors.websocket.timeline.info.size': 'Tamaño',
  'workbench.editors.websocket.timeline.info.time': 'Hora',
  'workbench.editors.websocket.timeline.info.frame': 'Trama',
  'workbench.editors.websocket.timeline.info.frameText': 'Texto',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Binario',
  'workbench.editors.websocket.timeline.couldNotConnect': 'No se pudo conectar a {url}',
  'workbench.editors.websocket.timeline.errorLabel': 'Error',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Desconectado de {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Detalles del handshake',
  'workbench.editors.websocket.timeline.requestUrl': 'URL de la solicitud',
  'workbench.editors.websocket.timeline.requestMethod': 'Método de la solicitud',
  'workbench.editors.websocket.timeline.statusCode': 'Código de estado',
  'workbench.editors.websocket.timeline.requestHeaders': 'Cabeceras de la solicitud',
  'workbench.editors.websocket.timeline.responseHeaders': 'Cabeceras de la respuesta',
  'workbench.editors.websocket.timeline.keyGenerated': '<generado por el socket>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'La sesión se detuvo desde esta aplicación.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    'Sin significado registrado: un código de aplicación o privado.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'La conexión se cerró correctamente.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'El extremo se retira: apagado del servidor o navegación de la página.',
  'workbench.editors.websocket.timeline.closeCode.1002': 'El extremo terminó la conexión por un error de protocolo.',
  'workbench.editors.websocket.timeline.closeCode.1003': 'El extremo recibió datos de un tipo que no puede aceptar.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'No había código de estado en la trama Close.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'La conexión se cortó sin trama Close.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'Un mensaje llevaba datos incoherentes con su tipo, como UTF-8 no válido en una trama de texto.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'Un mensaje violó la política del extremo.',
  'workbench.editors.websocket.timeline.closeCode.1009': 'Un mensaje era demasiado grande para procesarlo.',
  'workbench.editors.websocket.timeline.closeCode.1010':
    'El servidor no negoció una extensión que el cliente requería.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'El servidor encontró una condición inesperada y no pudo atender la solicitud.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'El servidor se está reiniciando.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'El servidor está sobrecargado: inténtalo más tarde.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'Una pasarela o proxy recibió una respuesta no válida del servidor ascendente.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'El handshake TLS falló.',
  'workbench.editors.websocket.timeline.searchMessages': 'Buscar en los mensajes',
  'workbench.editors.websocket.timeline.messageCount': '{count} mensajes',
  'workbench.editors.websocket.timeline.dropped': '{count} mensajes más antiguos salieron de la captura',
  'workbench.editors.websocket.timeline.filterAll': 'Todos',
  'workbench.editors.websocket.timeline.filterSent': 'Enviados',
  'workbench.editors.websocket.timeline.filterReceived': 'Recibidos',
  'workbench.editors.websocket.timeline.newestFirst': 'Más recientes primero',
  'workbench.editors.websocket.timeline.oldestFirst': 'Más antiguos primero',
  'workbench.editors.websocket.timeline.sortOrder': 'Orden de clasificación',
  'workbench.editors.websocket.timeline.groupByDirection': 'Agrupar por dirección',
  'workbench.editors.websocket.timeline.groupByEvent': 'Agrupar por evento',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Filas por grupo',
  'workbench.editors.websocket.timeline.noLimit': 'Sin límite',
  'workbench.editors.websocket.timeline.clearMessages': 'Borrar los mensajes',
  'workbench.editors.websocket.timeline.newMessages': 'Mensajes nuevos',
  'workbench.editors.websocket.timeline.binaryMessage': 'Mensaje binario ({bytes} bytes)',
  'workbench.editors.websocket.timeline.sentAria': 'Enviado',
  'workbench.editors.websocket.timeline.receivedAria': 'Recibido',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'Frame de adjuntos binarios ({count} adjuntos)',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': 'Cargando el ejemplo…',
  'workbench.editors.wsExample.notFound': 'Este ejemplo ya no existe — puede que se haya eliminado desde otra pestaña.',
  'workbench.editors.wsExample.openInRequest': 'Abrir en la solicitud',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Abre la solicitud WebSocket padre con esta forma capturada como cambios sin guardar.',
  'workbench.editors.wsExample.capturedTooltip': 'Capturado el {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'Este ejemplo se eliminó desde otra pestaña.',
  'workbench.editors.wsExample.toast.saveFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.wsExample.toast.saveFailedDetail': 'No se pudo guardar el ejemplo: {message}',
} as const satisfies Catalog;
