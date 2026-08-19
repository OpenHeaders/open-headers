/**
 * Workbench editors — gRPC client + gRPC response examples — Spanish.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key; extends
 * the es register contract (`es/shared.ts`). Raw by design: gRPC
 * status-code names (OK, CANCELLED, …) with their `Status code N NAME`
 * lead-ins rendered as `El código de estado N NAME`, rpc/service
 * identifiers ({rpc}), Protobuf / `.proto` / TLS / SSL / base64
 * vocabulary, `host:port` and `authorization: Bearer <token>` wire
 * syntax, `Metadata` / `Trailers` tab nouns kept as the gRPC protocol
 * terms, `frame` (m.) and `token` (m.) as register loanwords (es
 * breaks from fr's `jeton`), and the {count} / {ms} / {bytes} /
 * {name} / {message} holes. Settings tab = `Configuración` (S58 law);
 * unary reuses the spec-outline `Unario` family (`respuesta unaria`);
 * Timeline = `Cronología`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'Solicitud gRPC no encontrada.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (p. ej. grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS activado — haz clic para pasar a texto plano',
  'workbench.editors.grpc.tls.off': 'TLS desactivado (texto plano) — haz clic para pasar a TLS',
  'workbench.editors.grpc.method.placeholder': 'Selecciona un método',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Vincula una spec Protobuf para elegir un método',
  'workbench.editors.grpc.method.unresolvedGroup': 'Ausente de la spec vinculada',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (sin resolver)',
  'workbench.editors.grpc.method.linkGroup': 'Vincular una spec Protobuf',
  'workbench.editors.grpc.method.importProto': 'Importar un archivo .proto…',
  'workbench.editors.grpc.invoke.label': 'Invocar',
  'workbench.editors.grpc.invoke.stop': 'Detener',
  'workbench.editors.grpc.invoke.browserHost':
    'La invocación se ejecuta en la aplicación de escritorio — componer y guardar funciona aquí.',
  'workbench.editors.grpc.invoke.needsMethod': 'Elige un método que se resuelva contra la spec vinculada para invocar',
  'workbench.editors.grpc.invoke.needsUrl': 'Introduce un host de destino para invocar',
  'workbench.editors.grpc.invoke.failed': 'Falló la invocación — el host no respondió a la llamada',
  'workbench.editors.grpc.response.title': 'Respuesta',
  'workbench.editors.grpc.response.empty.prompt': 'Invoca un método para obtener una respuesta.',
  'workbench.editors.grpc.response.empty.invoking': 'Invocando…',
  'workbench.editors.grpc.status.kicker': 'Estado gRPC',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions; the status-code name tokens ride raw.
  'workbench.editors.grpc.status.desc.unknownCode': 'Un código de estado no estándar, fuera del vocabulario de gRPC.',
  'workbench.editors.grpc.status.desc.OK':
    'El código de estado 0 OK es la respuesta estándar de una invocación correcta de un método gRPC.',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'El código de estado 1 CANCELLED se devuelve si el llamante cancela la operación.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'El código de estado 2 UNKNOWN se devuelve si la operación no pudo completarse por un error desconocido. ' +
    'Por ejemplo, este error puede devolverse cuando un valor de Status recibido de otro espacio de ' +
    'direcciones pertenece a un espacio de errores desconocido aquí. Los errores lanzados por API que no ' +
    'devuelven suficiente información de error también pueden convertirse en este error.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'El código de estado 3 INVALID_ARGUMENT se devuelve si el cliente especificó un argumento no válido. ' +
    'Designa argumentos problemáticos sea cual sea el estado del sistema (p. ej. un nombre de archivo mal ' +
    'formado).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'El código de estado 4 DEADLINE_EXCEEDED se devuelve si el plazo expira antes de que la operación pudiera ' +
    'completarse. Para operaciones que cambian el estado del sistema, este error puede devolverse aunque la ' +
    'operación haya terminado con éxito. Por ejemplo, una respuesta correcta del servidor pudo retrasarse ' +
    'demasiado.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'El código de estado 5 NOT_FOUND se devuelve si una entidad solicitada (p. ej. un archivo o directorio) ' +
    'no se encontró.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'El código de estado 6 ALREADY_EXISTS se devuelve si la entidad que intentaste crear (p. ej. un archivo ' +
    'o directorio) ya existe.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'El código de estado 7 PERMISSION_DENIED se devuelve si el llamante no tiene permiso para ejecutar la ' +
    'operación indicada. Este código no implica que la solicitud sea válida, ni que la entidad solicitada ' +
    'exista o cumpla otras condiciones previas.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'El código de estado 8 RESOURCE_EXHAUSTED se devuelve si una cuota por usuario — o incluso todo el ' +
    'sistema de archivos — se queda sin espacio.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'El código de estado 9 FAILED_PRECONDITION se devuelve si la operación fue rechazada porque el sistema no ' +
    'estaba en el estado requerido para su ejecución. Por ejemplo, el directorio a eliminar no está vacío, ' +
    'una operación rmdir se aplica a algo que no es un directorio, etc.',
  'workbench.editors.grpc.status.desc.ABORTED':
    'El código de estado 10 ABORTED se devuelve si la operación se interrumpió, normalmente por un problema ' +
    'de concurrencia como el fallo de una comprobación de secuenciador o el aborto de una transacción.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'El código de estado 11 OUT_OF_RANGE se devuelve si la operación se intentó más allá del rango válido. ' +
    'Por ejemplo, buscar o leer más allá del final del archivo.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'El código de estado 12 UNIMPLEMENTED se devuelve si la operación no está implementada o no está ' +
    'admitida/activada en este servicio.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'El código de estado 13 INTERNAL se devuelve si hay un error interno. Significa que se han roto ' +
    'invariantes que el sistema subyacente daba por supuestos.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'El código de estado 14 UNAVAILABLE se devuelve si el servicio no está disponible en este momento.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'El código de estado 15 DATA_LOSS se devuelve si hay una pérdida o corrupción de datos irrecuperable.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'El código de estado 16 UNAUTHENTICATED se devuelve si la solicitud no lleva credenciales de ' +
    'autenticación válidas para la operación.',
  'workbench.editors.grpc.response.error.title': 'Falló la llamada',
  'workbench.editors.grpc.response.error.localGuidance':
    'La llamada nunca llegó a una respuesta. Comprueba el destino, el modo TLS y que el servidor sea accesible.',
  'workbench.editors.grpc.response.error.statusGuidance': 'Comprueba el mensaje e invoca el método de nuevo.',
  'workbench.editors.grpc.response.tab.response': 'Respuesta',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Filtrar metadata',
  'workbench.editors.grpc.response.filterTrailers': 'Filtrar trailers',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'Sin estado gRPC',
  'workbench.editors.grpc.response.noMessage': 'La respuesta no llevaba ningún mensaje.',
  'workbench.editors.grpc.response.noMetadata': 'Sin metadata',
  'workbench.editors.grpc.response.noTrailers': 'Sin trailers',
  'workbench.editors.grpc.response.trailersOnly':
    'Respuesta trailers-only — el estado llegó con los metadata iniciales y no siguió ningún mensaje.',
  'workbench.editors.grpc.response.compressed':
    'El frame de respuesta está comprimido — la compresión no está negociada, así que no se puede decodificar.',
  'workbench.editors.grpc.response.structuralNotice':
    'Decodificación estructural (números de campo) — el tipo de respuesta no se resolvió contra la spec ' +
    'vinculada.',
  'workbench.editors.grpc.response.rawNotice': 'El mensaje no se decodificó; bytes en bruto mostrados como base64.',
  'workbench.editors.grpc.response.extraFrames':
    'Llegaron {count} frames de mensaje — una respuesta unaria lleva uno; se muestra el primero.',
  'workbench.editors.grpc.response.incompleteTail':
    'La respuesta terminó a mitad de un frame; se muestran los frames completos.',
  'workbench.editors.grpc.response.truncated': 'Respuesta limitada a {bytes} bytes.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Mensaje',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.serviceDefinition': 'Definición del servicio',
  'workbench.editors.grpc.tab.settings': 'Configuración',
  'workbench.editors.grpc.messagePlaceholder': 'Mensaje de solicitud en JSON',
  'workbench.editors.grpc.example.label': 'Usar el mensaje de ejemplo',
  'workbench.editors.grpc.example.needsMethod': 'Elige primero un método que se resuelva contra la spec vinculada',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Clave',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Valor',
  'workbench.editors.grpc.spec.selectLabel': 'Spec Protobuf',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Vincular una spec Protobuf…',
  'workbench.editors.grpc.spec.summary': '{services} servicios · {methods} métodos',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'No se pudo leer el archivo: {message}',
  'workbench.editors.grpc.spec.importFailed': 'No se pudo importar el archivo .proto',
  'workbench.editors.grpc.specFooter.using': 'Usando {name}',
  'workbench.editors.grpc.specFooter.none': 'Sin spec vinculada',
  'workbench.editors.grpc.specFooter.issues': '{count} sin resolver',
  'workbench.editors.grpc.specFooter.refresh': 'Reconstruir desde los archivos actuales de la spec',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Conecta a este socket local — una ruta absoluta de socket Unix, o una tubería con nombre de Windows ' +
    'como \\\\.\\pipe\\nombre — en lugar de abrir una conexión TCP. El destino sigue determinando la ' +
    'cabecera :authority, el nombre de servidor TLS y la verificación del certificado; solo cambia adónde ' +
    'va la conexión. Déjalo vacío para una conexión TCP normal.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'Sin socket — conexión TCP',
  'workbench.editors.grpc.settings.timeoutLabel': 'Tiempo de espera de la llamada (ms)',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'Sin límite',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Tope de tiempo real sobre la llamada entera — se envía como deadline de gRPC y se aplica localmente.',
  'workbench.editors.grpc.settings.sslVerifyLabel': 'Verificación del certificado SSL',
  'workbench.editors.grpc.settings.sslVerifyHelp':
    'Verificar el certificado del servidor contra las raíces del sistema. Desactívalo para servidores de ' +
    'desarrollo autofirmados.',
  'workbench.editors.grpc.tab.auth': 'Autorización',
  'workbench.editors.grpc.auth.typeLabel': 'Tipo',
  'workbench.editors.grpc.auth.typeNone': 'Sin auth',
  'workbench.editors.grpc.auth.typeBearer': 'Token Bearer',
  'workbench.editors.grpc.auth.tokenLabel': 'Token',
  'workbench.editors.grpc.auth.tokenPlaceholder': 'Token o {{variable}}',
  'workbench.editors.grpc.auth.help':
    'Se envía como metadata authorization: Bearer <token> en la llamada. Una fila de metadata authorization ' +
    'explícita tiene prioridad.',
  'workbench.editors.grpc.invoke.connectCompanion':
    'Conecta la aplicación de escritorio para invocar — componer y guardar funciona aquí.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Detenido',
  'workbench.editors.grpc.stream.tab.timeline': 'Cronología',
  'workbench.editors.grpc.stream.trailersPending': 'Los trailers llegan cuando la llamada termina.',
  'workbench.editors.grpc.stream.sendMessage': 'Enviar el mensaje',
  'workbench.editors.grpc.stream.endStreaming': 'Terminar el streaming',
  'workbench.editors.grpc.stream.controlsIdle': 'Invoca primero la llamada para abrir el flujo',
  'workbench.editors.grpc.stream.sendFailed': 'El mensaje no se envió',
  'workbench.editors.grpc.timeline.requestSent': 'Solicitud enviada',
  'workbench.editors.grpc.timeline.responseReceived': 'Respuesta recibida',
  'workbench.editors.grpc.timeline.completed': 'Llamada completada',
  'workbench.editors.grpc.timeline.stopped': 'Llamada detenida',
  'workbench.editors.grpc.timeline.failed': 'Falló la llamada',
  'workbench.editors.grpc.timeline.waiting': 'Esperando mensajes…',
  'workbench.editors.grpc.timeline.noMatches': 'Ningún mensaje coincide.',
  'workbench.editors.grpc.timeline.searchMessages': 'Buscar en los mensajes',
  'workbench.editors.grpc.timeline.filterAll': 'Todos',
  'workbench.editors.grpc.timeline.filterSent': 'Enviados',
  'workbench.editors.grpc.timeline.filterReceived': 'Recibidos',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} mensaje',
      many: '{count} mensajes',
      other: '{count} mensajes',
    }),
  'workbench.editors.grpc.timeline.sortOrder': 'Orden y agrupación',
  'workbench.editors.grpc.timeline.newestFirst': 'Los más recientes primero',
  'workbench.editors.grpc.timeline.oldestFirst': 'Los más antiguos primero',
  'workbench.editors.grpc.timeline.showTypes': 'Mostrar los tipos de mensaje',
  'workbench.editors.grpc.timeline.groupByType': 'Agrupar por tipo de mensaje',
  'workbench.editors.grpc.timeline.groupByDirection': 'Agrupar por dirección',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Filas por grupo',
  'workbench.editors.grpc.timeline.noLimit': 'Sin límite',
  'workbench.editors.grpc.timeline.clearMessages': 'Borrar los mensajes (solo visualización)',
  'workbench.editors.grpc.timeline.newMessages': 'Mensajes nuevos',
  'workbench.editors.grpc.timeline.sentAria': 'Mensaje enviado',
  'workbench.editors.grpc.timeline.receivedAria': 'Mensaje recibido',
  'workbench.editors.grpc.toast.deletedOtherTab': 'La solicitud gRPC se eliminó desde otra pestaña',
  'workbench.editors.grpc.toast.updateFailed': 'No se pudo actualizar la solicitud gRPC',
  'workbench.editors.grpc.toast.updateFailedDetail': 'No se pudo actualizar la solicitud gRPC: {message}',
  'workbench.editors.grpc.response.saveResponse': 'Guardar la respuesta',
  'workbench.editors.grpc.toast.savedExample': 'Se guardó el ejemplo «{name}»',
  'workbench.editors.grpc.toast.saveExampleFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  'workbench.editors.grpcExample.loading': 'Cargando el ejemplo…',
  'workbench.editors.grpcExample.notFound': 'Ejemplo no encontrado.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': 'El ejemplo se eliminó desde otra pestaña',
  'workbench.editors.grpcExample.toast.saveFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.grpcExample.toast.saveFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  'workbench.editors.grpcExample.openInRequest': 'Abrir en la solicitud',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'Copiar la llamada capturada de este ejemplo en el editor de la solicitud gRPC principal como cambios sin ' +
    'guardar',
  'workbench.editors.grpcExample.noMethod': 'Sin método registrado',
  'workbench.editors.grpcExample.capturedTooltip': 'Capturado el {date}',
  'workbench.editors.grpcExample.result.title': 'Respuesta capturada',
} as const satisfies Catalog;
