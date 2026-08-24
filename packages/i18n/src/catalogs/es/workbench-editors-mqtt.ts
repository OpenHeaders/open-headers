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
    'Versión del protocolo MQTT que usa la sesión. 5.0 desbloquea propiedades y opciones de suscripción; 3.1.1 apunta a brókers que rechazan 5.0.',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.scheme.tooltip':
    'El esquema elige el transporte: mqtt/mqtts abren un socket TCP en la aplicación de escritorio o el servidor; ws/wss ejecutan MQTT sobre WebSocket en cualquier host.',
  'workbench.editors.mqtt.connect.label': 'Conectar',
  'workbench.editors.mqtt.connect.pending':
    'Las sesiones en vivo llegan en una próxima actualización: la solicitud ya se compone, se guarda y se sincroniza.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Mensaje',
  'workbench.editors.mqtt.tab.topics': 'Temas',
  'workbench.editors.mqtt.tab.auth': 'Autorización',
  'workbench.editors.mqtt.tab.properties': 'Propiedades',
  'workbench.editors.mqtt.tab.lastWill': 'Testamento',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': 'Ajustes',
  'workbench.editors.mqtt.qos.q0': 'QoS 0 · Como máximo una vez',
  'workbench.editors.mqtt.qos.q1': 'QoS 1 · Al menos una vez',
  'workbench.editors.mqtt.qos.q2': 'QoS 2 · Exactamente una vez',
  'workbench.editors.mqtt.retainLabel': 'Retain',
  'workbench.editors.mqtt.sendLabel': 'Enviar',
  'workbench.editors.mqtt.topicPlaceholder': 'Tema donde publicar, p. ej. sensors/1/temperature',
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
  'workbench.editors.mqtt.props.buttonTooltip': 'Propiedades del mensaje',
  'workbench.editors.mqtt.props.hint': 'Metadatos MQTT 5.0 enviados con cada mensaje.',
  'workbench.editors.mqtt.props.v311':
    'Las propiedades de mensaje son una función de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Propiedad',
  'workbench.editors.mqtt.props.userPropValue': 'Valor',
  'workbench.editors.mqtt.props.addUserProp': 'Propiedad de usuario',
  'workbench.editors.mqtt.props.removeUserProp': 'Quitar propiedad de usuario',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval (s)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.payloadFormatIndicator':
    'Payload Format Indicator: marcar la carga útil como texto UTF-8',
  'workbench.editors.mqtt.saved.title': 'Mensajes guardados',
  'workbench.editors.mqtt.saved.addTooltip': 'Guardar la composición actual como mensaje reutilizable',
  'workbench.editors.mqtt.saved.emptyHint': 'Guarda mensajes para reutilizarlos durante una conexión activa.',
  'workbench.editors.mqtt.saved.defaultName': 'Mensaje',
  'workbench.editors.mqtt.saved.rename': 'Renombrar',
  'workbench.editors.mqtt.saved.duplicate': 'Duplicar',
  'workbench.editors.mqtt.saved.delete': 'Eliminar',
  'workbench.editors.mqtt.topics.hint':
    'Suscripciones con las que abre la sesión. Los comodines + y # son bienvenidos; las filas desactivadas se guardan pero no se suscriben.',
  'workbench.editors.mqtt.topics.filterLabel': 'Filtro de tema',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Filtro de tema, p. ej. sensors/+/temperature',
  'workbench.editors.mqtt.topics.optionsLabel': 'QoS / Suscripción',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Suscribirse al abrir la sesión',
  'workbench.editors.mqtt.topics.optionsHint': 'Opciones de suscripción MQTT 5.0 para esta fila.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local: no devolver las publicaciones de este cliente',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published: reenviar el indicador RETAIN tal cual',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Enviar mensajes retenidos al suscribirse',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Enviar solo para una suscripción nueva',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · No enviar mensajes retenidos',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.auth.typeLabel': 'Tipo',
  'workbench.editors.mqtt.auth.typeNone': 'Sin autenticación',
  'workbench.editors.mqtt.auth.typeBasic': 'Autenticación Basic',
  'workbench.editors.mqtt.auth.pending':
    'El usuario/contraseña en CONNECT llega en una próxima actualización, junto con el plano de sesión.',
  'workbench.editors.mqtt.userProps.hint':
    'Propiedades de usuario enviadas en CONNECT: metadatos libres que el bróker y otras herramientas pueden leer.',
  'workbench.editors.mqtt.userProps.v311':
    'Las propiedades de usuario de CONNECT son una función de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Propiedad',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Valor',
  'workbench.editors.mqtt.will.hint':
    'Se registra en el bróker con CONNECT y se publica por ti si la sesión cae sin una desconexión limpia. Un tema vacío significa sin testamento.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Tema del testamento, p. ej. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, en segundos — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayPlaceholder': 'Retraso (s)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Compón la carga útil del testamento…',
  'workbench.editors.mqtt.spec.selectLabel': 'Especificación AsyncAPI',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'Vincular una especificación AsyncAPI',
  'workbench.editors.mqtt.spec.summary': '{servers} servidores · {channels} canales · {operations} operaciones',
  'workbench.editors.mqtt.spec.parseFailure': 'La especificación no se pudo analizar: {message}',
  'workbench.editors.mqtt.spec.issues': '{count} problemas de especificación',
  'workbench.editors.mqtt.specFooter.using': 'Usando {name}',
  'workbench.editors.mqtt.specFooter.none': 'Sin especificación AsyncAPI vinculada',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identificador que lleva CONNECT. Vacío genera uno nuevo por conexión; reanudar una sesión del bróker necesita un ID estable.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Generado en cada conexión',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Iniciar una sesión de bróker nueva al conectar. Desactívalo para reanudar suscripciones y mensajes en cola de una sesión anterior; eso también necesita un Client ID estable.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval (s)',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Cuánto conserva el bróker la sesión tras la desconexión. Con Clean Start activado, solo aplica si una conexión posterior reanuda la sesión.',
  'workbench.editors.mqtt.settings.v311Knob': 'Una función de MQTT 5.0; esta solicitud apunta a 3.1.1.',
  'workbench.editors.mqtt.settings.zeroDefault': '0',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive (s)',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalo de latido prometido al bróker: el cliente responde y emite PINGREQ. Vacío usa 60 s; 0 lo desactiva.',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Tiempo de espera de conexión (ms)',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Techo de reloj solo para la marcación de la conexión; una sesión abierta no tiene techo. Vacío usa el valor por defecto de la aplicación.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': 'Predeterminado',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Cuántos mensajes QoS 1/2 pueden estar en vuelo hacia este cliente a la vez. Vacío lo deja al bróker.',
  'workbench.editors.mqtt.settings.brokerDefault': 'Predeterminado del bróker',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size (bytes)',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Paquete más grande que acepta este cliente; el bróker descarta los mayores. Vacío no impone límite.',
  'workbench.editors.mqtt.settings.noLimit': 'Sin límite',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'Verificación del certificado SSL',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    'Verificar el certificado del bróker contra las raíces del sistema en sesiones mqtts/wss. Desactívalo para brókers de desarrollo autofirmados.',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Esta solicitud MQTT se eliminó en otra pestaña.',
  'workbench.editors.mqtt.toast.updateFailed': 'No se pudo guardar la solicitud MQTT',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'No se pudo guardar la solicitud MQTT: {message}',
} as const satisfies Catalog;
