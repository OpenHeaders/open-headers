/**
 * Workbench editors — the MQTT client editor, Spanish. Wire vocabulary
 * (mqtt/mqtts/ws/wss schemes, CONNECT / PUBLISH / RETAIN / PINGREQ
 * tokens, QoS, topic filters, AsyncAPI, the 5.0 property names the
 * spec fixes in English) rides raw inside keyed values. «tema» =
 * topic; «filtro de tema» = topic filter; «carga útil» = payload;
 * «testamento» = last will; «bróker» = broker.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': 'Solicitud MQTT no encontrada.',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    'Versión del protocolo MQTT que usa la sesión.\n5.0 · propiedades y opciones de suscripción\n3.1.1 · brókers que rechazan 5.0',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.version.lockedWhileConnected': 'No se puede cambiar la versión mientras está conectado.',
  'workbench.editors.mqtt.scheme.tooltip':
    'El esquema elige el transporte.\nmqtt/mqtts · socket TCP en la aplicación de escritorio o el servidor\nws/wss · MQTT sobre WebSocket en cualquier host',
  'workbench.editors.mqtt.connect.label': 'Conectar',
  'workbench.editors.mqtt.connect.disconnect': 'Desconectar',
  'workbench.editors.mqtt.connect.cancel': 'Cancelar',
  'workbench.editors.mqtt.connect.reconnectNow': 'Reconectar ahora',
  'workbench.editors.mqtt.connect.reconnectNowHint':
    'Iniciar el siguiente intento de reconexión sin esperar el periodo',
  'workbench.editors.mqtt.connect.browserHost':
    'Las sesiones MQTT se ejecutan en la aplicación de escritorio o el servidor.',
  'workbench.editors.mqtt.connect.needsUrl': 'Introduce una URL de broker para conectar.',
  'workbench.editors.mqtt.connect.tcpSchemeBrowser':
    'Las sesiones {scheme}:// se ejecutan en la aplicación de escritorio o el servidor — cambia a ws:// o wss:// para conectar aquí.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Mensaje',
  'workbench.editors.mqtt.tab.topics': 'Temas',
  'workbench.editors.mqtt.tab.auth': 'Autorización',
  'workbench.editors.mqtt.tab.properties': 'Propiedades',
  'workbench.editors.mqtt.tab.lastWill': 'Testamento',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': 'Ajustes',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS:',
  'workbench.editors.mqtt.qos.meaning0': 'Como máximo una vez',
  'workbench.editors.mqtt.qos.meaning1': 'Al menos una vez',
  'workbench.editors.mqtt.qos.meaning2': 'Exactamente una vez',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Enviar',
  'workbench.editors.mqtt.topicPlaceholder': 'Tema donde publicar',
  'workbench.editors.mqtt.topicExample': 'p. ej. sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Texto',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexadecimal',
  'workbench.editors.mqtt.payload.invalidGate': 'Corrige primero la codificación de la carga útil.',
  'workbench.editors.mqtt.payload.invalidBase64': 'Base64 no válido: los bytes decodificados son lo que se publicaría.',
  'workbench.editors.mqtt.payload.invalidHex':
    'Hexadecimal no válido: pares de dígitos 0-9 a-f se decodifican en los bytes publicados.',
  'workbench.editors.mqtt.payloadPlaceholder': 'Compón la carga útil a publicar…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': 'Base64 de la carga útil binaria, p. ej. aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': 'Hexadecimal de la carga útil binaria, p. ej. 48656c6c6f…',
  'workbench.editors.mqtt.props.buttonTooltip': 'Opciones del mensaje',
  'workbench.editors.mqtt.props.hint': 'Metadatos MQTT 5.0 enviados con cada mensaje.',
  'workbench.editors.mqtt.props.v311':
    'Las propiedades de mensaje son una función de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Propiedad',
  'workbench.editors.mqtt.props.userPropValue': 'Valor',
  'workbench.editors.mqtt.props.addUserProp': 'Propiedad de usuario',
  'workbench.editors.mqtt.props.removeUserProp': 'Quitar propiedad de usuario',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.responseTopicDesc':
    'Tema en el que se pide al receptor que responda: petición/respuesta sobre pub/sub. Vacío significa que la propiedad no se envía.',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.correlationDataDesc':
    'Token opaco que el receptor copia en su respuesta para que pueda emparejarse con este mensaje. Vacío significa que la propiedad no se envía.',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval',
  'workbench.editors.mqtt.props.messageExpiryDesc':
    'Segundos durante los que el bróker mantiene el mensaje entregable; transcurridos, se descarta en lugar de entregarse. Vacío significa que el mensaje nunca expira.',
  'workbench.editors.mqtt.props.messageExpiryPlaceholder': 'Sin expiración (por defecto)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.contentTypeDesc':
    'Tipo MIME que describe la carga útil, transmitido tal cual a los receptores. Vacío significa que la propiedad no se envía.',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator',
  'workbench.editors.mqtt.props.payloadFormatIndicatorDesc':
    'Marca la carga útil como texto UTF-8 en lugar de bytes sin especificar; el bróker y los receptores pueden validarla.',
  'workbench.editors.mqtt.props.nonePlaceholder': 'Ninguno (por defecto)',
  'workbench.editors.mqtt.props.sectionProperties': 'Propiedades',
  'workbench.editors.mqtt.props.sectionPropertiesDesc':
    'Pares clave-valor libres que viajan con el mensaje: metadatos de aplicación que el bróker transmite tal cual.',
  'workbench.editors.mqtt.props.sectionSettings': 'Ajustes',
  'workbench.editors.mqtt.saved.title': 'Mensajes guardados',
  'workbench.editors.mqtt.saved.addTooltip': 'Guardar la composición actual como mensaje reutilizable',
  'workbench.editors.mqtt.saved.topicTagPlaceholder': 'tema',
  'workbench.editors.mqtt.saved.showRail': 'Mostrar mensajes guardados',
  'workbench.editors.mqtt.saved.hideRail': 'Ocultar mensajes guardados',
  'workbench.editors.mqtt.saved.emptyHint': 'Guarda mensajes para reutilizarlos durante una conexión activa.',
  'workbench.editors.mqtt.saved.defaultName': 'Mensaje',
  'workbench.editors.mqtt.saved.sendTooltip': 'Publicar este mensaje guardado tal como está',
  'workbench.editors.mqtt.saved.rename': 'Renombrar',
  'workbench.editors.mqtt.saved.duplicate': 'Duplicar',
  'workbench.editors.mqtt.saved.delete': 'Eliminar',
  'workbench.editors.mqtt.topics.hint':
    'Suscripciones con las que abre la sesión. Los comodines + y # son bienvenidos; las filas desactivadas se guardan pero no se suscriben.',
  'workbench.editors.mqtt.topics.filterLabel': 'Tema',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Tema, p. ej. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Opciones',
  'workbench.editors.mqtt.topics.optionsTooltip': 'Opciones de suscripción',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Suscripción',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Suscribirse al abrir la sesión',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'Suscribirse / cancelar la suscripción en la sesión abierta — la fila guardada no se modifica',
  'workbench.editors.mqtt.topics.optionsHint': 'Opciones de suscripción MQTT 5.0 para esta fila.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local',
  'workbench.editors.mqtt.topics.noLocalDesc': 'El broker no devuelve a este cliente sus propias publicaciones.',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published',
  'workbench.editors.mqtt.topics.retainAsPublishedDesc':
    'Los mensajes conservan el indicador RETAIN tal como se publicaron.',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandlingDesc':
    'Si el broker envía los mensajes retenidos existentes al realizar esta suscripción.',
  'workbench.editors.mqtt.topics.retainHandlingValuesHeading': 'Valores',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Recibir al suscribirse',
  'workbench.editors.mqtt.topics.retainHandling0Desc':
    'El broker envía los mensajes retenidos cada vez que se realiza esta suscripción.',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Solo suscripciones nuevas',
  'workbench.editors.mqtt.topics.retainHandling1Desc':
    'El broker envía los mensajes retenidos solo si la suscripción no existe ya.',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · No recibir',
  'workbench.editors.mqtt.topics.retainHandling2Desc': 'El broker no envía mensajes retenidos para esta suscripción.',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.topics.subscriptionIdDesc':
    'Identificador numérico que el broker adjunta a los mensajes entregados por esta suscripción.',
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'Ninguno (por defecto)',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Propiedades',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'User Properties enviadas una vez con el paquete SUBSCRIBE de esta fila. El broker define su significado; no se adjuntan a los mensajes entregados.',
  'workbench.editors.mqtt.topics.subscribeSettings': 'Ajustes',
  'workbench.editors.mqtt.auth.help':
    'Se envían como User Name y Password del paquete CONNECT en todos los hosts — ambas versiones de MQTT los transportan. Las variables se resuelven al conectar; los ejemplos guardados nunca capturan la credencial.',
  'workbench.editors.mqtt.userProps.hint':
    'Propiedades de usuario enviadas en CONNECT: metadatos libres que el bróker y otras herramientas pueden leer.',
  'workbench.editors.mqtt.userProps.v311':
    'Las propiedades de usuario de CONNECT son una función de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Propiedad',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Valor',
  'workbench.editors.mqtt.will.hint':
    'Se registra en el bróker con CONNECT y se publica por ti si la sesión cae sin una desconexión limpia. Un tema vacío significa sin testamento.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Tema del testamento',
  'workbench.editors.mqtt.will.topicExample': 'p. ej. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, en segundos — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayLabel': 'Retraso del testamento',
  'workbench.editors.mqtt.will.delayPlaceholder': '0 s (por defecto)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Compón la carga útil del testamento…',
  'workbench.editors.mqtt.spec.selectLabel': 'Especificación AsyncAPI',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'Vincular una especificación AsyncAPI',
  'workbench.editors.mqtt.spec.summary': '{servers} servidores · {channels} canales · {operations} operaciones',
  'workbench.editors.mqtt.spec.parseFailure': 'La especificación no se pudo analizar: {message}',
  'workbench.editors.mqtt.spec.issues': '{count} problemas de especificación',
  'workbench.editors.mqtt.spec.useExample': 'Usar un mensaje de ejemplo…',
  'workbench.editors.mqtt.spec.browser.hint':
    'Elige un mensaje para componer su carga de ejemplo; un mensaje de canal también rellena el tema de publicación.',
  'workbench.editors.mqtt.spec.browser.servers': 'Servers',
  'workbench.editors.mqtt.spec.browser.channels': 'Channels',
  'workbench.editors.mqtt.spec.browser.operations': 'Operations',
  'workbench.editors.mqtt.spec.browser.components': 'Components',
  'workbench.editors.mqtt.specFooter.using': 'Usando {name}',
  'workbench.editors.mqtt.specFooter.none': 'Sin especificación AsyncAPI vinculada',
  'workbench.editors.mqtt.settings.exampleCaption': 'Sesión de ejemplo',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identificador que lleva CONNECT. Vacío genera uno nuevo por conexión; reanudar una sesión del bróker necesita un ID estable.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Auto — generado al conectar',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Iniciar una sesión de bróker nueva al conectar. Desactívalo para reanudar suscripciones y mensajes en cola de una sesión anterior; eso también necesita un Client ID estable.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Cuánto conserva el bróker la sesión tras la desconexión; 0 la termina al desconectar. Clean Start solo descarta la sesión anterior al conectar; el intervalo rige la nueva en cualquier caso.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (por defecto)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalo de latido prometido al bróker: el cliente responde y emite PINGREQ. Vacío usa 60 s; 0 lo desactiva.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (por defecto)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Tiempo de espera de conexión',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Techo de reloj solo para la marcación de la conexión; una sesión abierta no tiene techo. Vacío aplica el plazo por defecto de 30 s.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '30 s (por defecto)',
  'workbench.editors.mqtt.settings.autoReconnectLabel': 'Reconectar automáticamente',
  'workbench.editors.mqtt.settings.autoReconnectHelp':
    'Reabre la sesión cuando una conexión abierta se cae — socket cortado o DISCONNECT del broker — volviendo a marcar cada periodo de reconexión hasta que abra de nuevo o desconectes. Una primera conexión que falla nunca reintenta. Desactivado por defecto.',
  'workbench.editors.mqtt.settings.reconnectPeriodLabel': 'Periodo de reconexión',
  'workbench.editors.mqtt.settings.reconnectPeriodHelp':
    'Espera entre intentos de reconexión. Vacío usa los 5 s por defecto.',
  'workbench.editors.mqtt.settings.reconnectPeriodPlaceholder': '5 s (por defecto)',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsLabel': 'Intentos de reconexión',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsHelp':
    'Tope de intentos de reconexión consecutivos tras una caída — una reconexión que abre reinicia la cuenta; un tope agotado termina la sesión como Reconexión abandonada. Vacío sigue intentando hasta que el broker vuelva o desconectes.',
  'workbench.editors.mqtt.settings.reconnectMaxAttemptsPlaceholder': 'Sin límite (por defecto)',
  'workbench.editors.mqtt.settings.reconnectBackoffLabel': 'Espera exponencial',
  'workbench.editors.mqtt.settings.reconnectBackoffHelp':
    'Duplica la espera tras cada intento fallido — el periodo, luego 2×, 4× … hasta 60 s — con una pequeña variación aleatoria para que los clientes nunca reconecten al unísono. Activado por defecto; desactivado, cada intento espera exactamente el periodo.',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Cuántos mensajes QoS 1/2 pueden estar en vuelo hacia este cliente a la vez. Vacío aplica el valor por defecto de la especificación, 65.535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65.535 (por defecto)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Paquete más grande que acepta este cliente; el bróker descarta los mayores. Vacío no impone límite.',
  'workbench.editors.mqtt.settings.noLimit': 'Sin límite (por defecto)',
  'workbench.editors.mqtt.settings.cleanSessionLabel': 'Clean Session',
  'workbench.editors.mqtt.settings.topicAliasMaximumLabel': 'Topic Alias Maximum',
  'workbench.editors.mqtt.settings.topicAliasMaximumHelp':
    'Cuántos alias de topic puede usar el bróker hacia este cliente; las publicaciones con alias llevan un número en lugar del topic. Vacío no permite ninguno, el valor por defecto de la especificación.',
  'workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder': '0 (por defecto)',
  'workbench.editors.mqtt.settings.requestResponseInfoLabel': 'Request Response Information',
  'workbench.editors.mqtt.settings.requestResponseInfoHelp':
    'Pedir al bróker una Response Information en CONNACK: el topic base de los intercambios petición/respuesta. Desactivado por defecto.',
  'workbench.editors.mqtt.settings.requestProblemInfoLabel': 'Request Problem Information',
  'workbench.editors.mqtt.settings.requestProblemInfoHelp':
    'Permitir que el bróker adjunte Reason Strings y propiedades de usuario a los paquetes de fallo. Activado por defecto.',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'Verificación del certificado SSL',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Verificar el certificado del bróker contra las raíces del sistema en sesiones mqtts/wss. Desactívalo para brókers de desarrollo autofirmados.',
  'workbench.editors.mqtt.settings.sslVerifyWarning':
    'Las sesiones omiten la comprobación de identidad del bróker — se acepta cualquier certificado, incluidos ' +
    'los autofirmados y caducados.',
  'workbench.editors.mqtt.settings.clientIdExample': 'p. ej. reporter-1',
  'workbench.editors.mqtt.settings.clientCertificateHelp':
    'Presentar una entrada de certificado de cliente de la bóveda en el saludo mqtts/wss; para brókeres que autentican dispositivos por certificado. La petición guarda solo el nombre de la entrada; cada dispositivo presenta su propia entrada con ese nombre.',
  'workbench.editors.mqtt.settings.sniLabel': 'Nombre de servidor SNI',
  'workbench.editors.mqtt.settings.sniHelp':
    'Nombre de servidor enviado en el saludo TLS de las sesiones mqtts; los brókeres tras un punto compartido eligen su certificado con él. Vacío envía el host de la URL.',
  'workbench.editors.mqtt.settings.sniPlaceholder': 'Auto: el host de la URL',
  'workbench.editors.mqtt.settings.sniExample': 'p. ej. broker.openheaders.com',
  'workbench.editors.mqtt.settings.alpnLabel': 'Protocolo ALPN',
  'workbench.editors.mqtt.settings.alpnHelp':
    'Protocolo de aplicación ofrecido en el saludo TLS de las sesiones mqtts; los brókeres que multiplexan MQTT en un puerto TLS compartido eligen con él. Vacío no ofrece ninguno.',
  'workbench.editors.mqtt.settings.alpnPlaceholder': 'Ninguno (por defecto)',
  'workbench.editors.mqtt.settings.alpnExample': 'p. ej. mqtt',
  'workbench.editors.mqtt.settings.group.connection': 'Conexión',
  'workbench.editors.mqtt.settings.group.session': 'Sesión — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS y confianza',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'Cómo CONNECT abre la sesión: la identidad que presenta, si empieza de cero, los techos de latido y de ' +
    'apertura que promete, y si una conexión caída se reabre.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'Condiciones MQTT 5.0 que CONNECT ofrece al bróker: cuánto sobrevive la sesión a una desconexión, más los ' +
    'techos de mensajes en vuelo y de tamaño de paquete que acepta este cliente.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'Cómo establecen confianza las sesiones mqtts/wss: si se verifica el certificado del bróker contra las raíces del sistema, el certificado de cliente que presenta este dispositivo, y el nombre SNI y la oferta ALPN del saludo.',
  'workbench.editors.mqtt.settings.sessionV311': 'Ajustes de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  // ── Panel de sesión ─────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Respuesta',
  'workbench.editors.mqtt.session.emptyHint': 'Conéctate para enviar y recibir mensajes.',
  'workbench.editors.mqtt.session.connectFailed': 'No se pudo abrir la sesión',
  'workbench.editors.mqtt.session.connectingBadge': 'CONECTANDO',
  'workbench.editors.mqtt.session.connectedBadge': 'CONECTADO',
  'workbench.editors.mqtt.session.notSubscribed': 'Sin suscripción a ningún tema',
  'workbench.editors.mqtt.session.subscribedOne': 'Suscrito a 1 tema',
  'workbench.editors.mqtt.session.subscribedMany': 'Suscrito a {count} temas',
  'workbench.editors.mqtt.session.tab.timeline': 'Mensajes',
  'workbench.editors.mqtt.session.tab.connection': 'Conexión',
  'workbench.editors.mqtt.session.duration': '{ms} ms',
  'workbench.editors.mqtt.session.sendIdle': 'Conéctate para publicar mensajes.',
  'workbench.editors.mqtt.session.sendFailed': 'No se pudo publicar el mensaje',
  'workbench.editors.mqtt.session.subscribeFailed': 'No se pudo cambiar la suscripción',
  'workbench.editors.mqtt.session.hostNotice':
    'Ejecutando en el socket del navegador — {knobs} no se aplican en este host.',
  'workbench.editors.mqtt.session.knobSslVerify': 'la verificación SSL desactivada',
  'workbench.editors.mqtt.session.disconnectedTag': 'Desconectado',
  'workbench.editors.mqtt.session.brokerDisconnectedTag': 'Desconectado por el broker',
  'workbench.editors.mqtt.session.severedTag': 'Conexión interrumpida',
  'workbench.editors.mqtt.session.stoppedTag': 'Detenido',
  'workbench.editors.mqtt.session.connectFailedTag': 'Error de conexión',
  'workbench.editors.mqtt.session.abortedTag': 'Cancelada',
  'workbench.editors.mqtt.timeline.aborted': 'Conexión cancelada',
  'workbench.editors.mqtt.timeline.abortedDisconnected': 'Desconectado del broker',
  'workbench.editors.mqtt.timeline.lost': 'Conexión perdida',
  'workbench.editors.mqtt.timeline.reconnecting': 'Intento de reconexión {attempt}',
  'workbench.editors.mqtt.timeline.reconnected': 'Reconectado al broker',
  'workbench.editors.mqtt.session.reconnectingBadge': 'RECONECTANDO',
  'workbench.editors.mqtt.session.reconnectRefusedTag': 'Reconexión rechazada',
  'workbench.editors.mqtt.session.reconnectRefused': 'reconexión rechazada: {reason}',
  'workbench.editors.mqtt.timeline.reconnectingAfter': 'Intento de reconexión {attempt} tras {delay}',
  'workbench.editors.mqtt.timeline.reconnectingNow': 'Intento de reconexión {attempt} ahora',
  'workbench.editors.mqtt.timeline.reconnectedDroppedOne': 'un mensaje sin confirmar descartado',
  'workbench.editors.mqtt.timeline.reconnectedDroppedMany': '{count} mensajes sin confirmar descartados',
  'workbench.editors.mqtt.session.reconnectExhaustedTag': 'Reconexión abandonada',
  'workbench.editors.mqtt.session.reconnectExhausted': 'reconexión abandonada tras {attempts}',
  'workbench.editors.mqtt.session.reconnectExhaustedReason': 'reconexión abandonada tras {attempts}: {reason}',
  'workbench.editors.mqtt.session.reconnectAttemptsOne': 'un intento',
  'workbench.editors.mqtt.session.reconnectAttemptsMany': '{count} intentos',
  'workbench.editors.mqtt.session.cleanDisconnect': 'desconexión limpia',
  'workbench.editors.mqtt.session.brokerDisconnect': 'el broker envió DISCONNECT: {reason}',
  'workbench.editors.mqtt.session.brokerDisconnectBare': 'el broker envió DISCONNECT',
  'workbench.editors.mqtt.session.severed': 'la conexión terminó sin DISCONNECT',
  'workbench.editors.mqtt.session.connectionClientId': 'ID de cliente',
  'workbench.editors.mqtt.session.connectionReason': 'Razón CONNACK',
  'workbench.editors.mqtt.session.connectionSessionPresent': 'Sesión presente',
  'workbench.editors.mqtt.session.yes': 'Sí',
  'workbench.editors.mqtt.session.no': 'No',
  'workbench.editors.mqtt.session.connectionNote':
    'Los hechos del CONNACK tal como los respondió el broker: códigos de razón literales, con sus nombres al lado.',
  // ── Cronología de mensajes ──────────────────────────────────────────
  'workbench.editors.mqtt.timeline.connecting': 'Conectando',
  'workbench.editors.mqtt.timeline.connected': 'Conectado al broker',
  'workbench.editors.mqtt.timeline.disconnected': 'Desconectado',
  'workbench.editors.mqtt.timeline.stopped': 'Detenido',
  'workbench.editors.mqtt.timeline.subscribed': 'Suscrito a',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Suscripción cancelada de',
  'workbench.editors.mqtt.timeline.grantFailed': 'Rechazado, código {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'Ningún mensaje coincide con el filtro.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Buscar mensajes',
  'workbench.editors.mqtt.timeline.messageCount': '{count} mensajes',
  'workbench.editors.mqtt.timeline.dropped': '{count} mensajes más antiguos salieron de la captura',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'Todos los topics',
  'workbench.editors.mqtt.timeline.filterAll': 'Todos',
  'workbench.editors.mqtt.timeline.filterSent': 'Enviados',
  'workbench.editors.mqtt.timeline.filterReceived': 'Recibidos',
  'workbench.editors.mqtt.timeline.newestFirst': 'Más recientes primero',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Más antiguos primero',
  'workbench.editors.mqtt.timeline.sortOrder': 'Orden',
  'workbench.editors.mqtt.timeline.clearMessages': 'Borrar mensajes',
  'workbench.editors.mqtt.timeline.newMessages': 'Mensajes nuevos',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Carga binaria ({bytes} bytes)',
  'workbench.editors.mqtt.timeline.byteCount': '{bytes} B',
  'workbench.editors.mqtt.timeline.retainedTag': 'Retenido',
  'workbench.editors.mqtt.timeline.sentAria': 'Enviado',
  'workbench.editors.mqtt.timeline.receivedAria': 'Recibido',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Esta solicitud MQTT se eliminó en otra pestaña.',
  'workbench.editors.mqtt.toast.updateFailed': 'No se pudo guardar la solicitud MQTT',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'No se pudo guardar la solicitud MQTT: {message}',
  'workbench.editors.mqtt.session.saveResponse': 'Guardar la respuesta',
  'workbench.editors.mqtt.toast.savedExample': 'Ejemplo {name} guardado',
  'workbench.editors.mqtt.toast.saveExampleFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.mqtt.toast.saveExampleFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  'workbench.editors.mqttExample.loading': 'Cargando el ejemplo…',
  'workbench.editors.mqttExample.notFound':
    'Este ejemplo ya no existe — puede que se haya eliminado desde otra pestaña.',
  'workbench.editors.mqttExample.openInRequest': 'Abrir en la solicitud',
  'workbench.editors.mqttExample.openInRequestTooltip':
    'Abre la solicitud MQTT padre con esta forma capturada como cambios sin guardar.',
  'workbench.editors.mqttExample.capturedTooltip': 'Capturado el {date}',
  'workbench.editors.mqttExample.toast.deletedOtherTab': 'Este ejemplo se eliminó desde otra pestaña.',
  'workbench.editors.mqttExample.toast.saveFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.mqttExample.toast.saveFailedDetail': 'No se pudo guardar el ejemplo: {message}',
} as const satisfies Catalog;
