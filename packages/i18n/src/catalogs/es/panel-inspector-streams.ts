/**
 * DevTools panel — inspector stream tabs — Spanish. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, and
 * Base64 / Hex / UTF-8 modes stay parity-raw. Mints: dropped rides the
 * S62 `descartado`; fire rail = the `disparo` family; capture plane =
 * `plano de captura`; seeded = `sembrada`; endpoints = `extremos`;
 * payload viewer = `visor de carga útil`; `wrapper` / `keepalive` ride
 * raw (m.); chars abbreviation = `car.`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': 'Borrar todo',
  'panel.inspector.streams.directionFilterTitle': 'Filtrar por dirección',
  'panel.inspector.streams.directionAll': 'Todas',
  'panel.inspector.streams.directionSend': 'Envío',
  'panel.inspector.streams.directionReceive': 'Recepción',
  'panel.inspector.streams.filterAria': 'Filtrar los mensajes del flujo',
  'panel.inspector.streams.sortByTitle': 'Ordenar por {column}',
  'panel.inspector.streams.resizeColumnAria': 'Redimensionar la columna {column}',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'Vista',
  'panel.inspector.streams.view.layout': 'Disposición',
  'panel.inspector.streams.view.layoutCompact': 'Compacta',
  'panel.inspector.streams.view.layoutWide': 'Ancha',
  'panel.inspector.streams.view.split': 'División',
  'panel.inspector.streams.view.splitSideBySide': 'Lado a lado',
  'panel.inspector.streams.view.splitStacked': 'Apilados',
  'panel.inspector.streams.view.splitDisabledTitle': 'Activa la vista previa de la carga útil para dividir el panel',
  'panel.inspector.streams.view.showPreview': 'Mostrar la vista previa de la carga útil',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': 'Regla aplicada — la carga útil del frame coincide con la de la regla',
  'panel.inspector.streams.fire.inferredFrame': 'Regla coincidente — aplicación no verificable para este frame',
  'panel.inspector.streams.fire.injectedFrame': 'Regla aplicada — este frame fue inyectado por la regla',
  'panel.inspector.streams.fire.replacedFrame': 'Regla aplicada — la regla reemplazó este frame',
  'panel.inspector.streams.fire.droppedSendFrame': 'La regla descartó este frame — nunca se envió al servidor',
  'panel.inspector.streams.fire.droppedRecvFrame': 'La regla descartó este frame — la página nunca lo recibió',
  'panel.inspector.streams.fire.appliedEvent': 'Regla aplicada — la carga útil del evento coincide con la de la regla',
  'panel.inspector.streams.fire.inferredEvent': 'Regla coincidente — aplicación no verificable para este evento',
  'panel.inspector.streams.fire.injectedEvent': 'Regla aplicada — este evento fue inyectado por la regla',
  'panel.inspector.streams.fire.replacedEvent': 'Regla aplicada — la regla reemplazó este evento',
  'panel.inspector.streams.fire.droppedEvent': 'La regla descartó este evento — la página nunca lo recibió',
  'panel.inspector.streams.row.copied': 'Copiado',
  'panel.inspector.streams.row.copyPayload': 'Copiar la carga útil',
  'panel.inspector.streams.row.editRule': 'Editar la regla',
  'panel.inspector.streams.row.override': 'Sustituir',
  'panel.inspector.streams.row.droppedSendCell': 'Descartado — nunca enviado al servidor',
  'panel.inspector.streams.row.droppedRecvCell': 'Descartado — nunca entregado a la página',
  'panel.inspector.streams.row.notCaptured': 'No capturado',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Filtrar los mensajes',
  'panel.inspector.messages.listAria': 'Mensajes WebSocket',
  'panel.inspector.messages.overrideMessage': 'Sustituir el mensaje',
  'panel.inspector.messages.overrideMessageTitle': 'Crear una regla de mensaje para esta conexión',
  'panel.inspector.messages.editRuleTitle': 'Editar la regla de mensaje que actuó sobre este frame',
  'panel.inspector.messages.createRuleTitle': 'Crear una regla de mensaje sembrada a partir de este frame',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Fila sintética — la página produjo este frame; la regla lo descartó antes del envío',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Frame sintético — inyectado por una regla dentro de la página; nunca cruzó la red',
  'panel.inspector.messages.emptyNoDebug':
    'Los frames WebSocket solo son visibles con el modo de depuración activado para esta pestaña.',
  'panel.inspector.messages.emptySynthetic':
    'Ningún frame cruzó la red — una regla de inyección se disparó aquí, y los frames inyectados se entregan ' +
    'sintéticamente dentro de la página, invisibles para la captura de red.',
  'panel.inspector.messages.emptyNone': 'Aún no se ha intercambiado ningún frame WebSocket.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} frame más antiguo descartado.',
      many: '{count} frames más antiguos descartados.',
      other: '{count} frames más antiguos descartados.',
    });
    return `Mostrando los últimos ${String(shown)} frames — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Filtrar los eventos',
  'panel.inspector.sse.listAria': 'Eventos enviados por el servidor',
  'panel.inspector.sse.overrideEvent': 'Sustituir el evento',
  'panel.inspector.sse.overrideEventTitle': 'Crear una regla de mensaje para este flujo',
  'panel.inspector.sse.editRuleTitle': 'Editar la regla de mensaje que actuó sobre este evento',
  'panel.inspector.sse.createRuleTitle': 'Crear una regla de mensaje sembrada a partir de este evento',
  'panel.inspector.sse.syntheticTitle':
    'Evento sintético — inyectado por una regla dentro de la página; nunca cruzó la red',
  'panel.inspector.sse.emptySynthetic':
    'Ningún evento cruzó la red — una regla de inyección se disparó aquí, y los eventos inyectados se entregan ' +
    'sintéticamente dentro de la página, invisibles para la captura de red.',
  'panel.inspector.sse.emptyUnparseable': 'Ningún evento SSE analizable en el cuerpo de la respuesta.',
  'panel.inspector.sse.emptyNoDebug':
    'No se capturó ningún evento. Sin el modo de depuración, los flujos server-sent solo se materializan cuando ' +
    'la solicitud termina; los flujos de larga duración pueden no aparecer aquí hasta que la conexión se cierre.',
  'panel.inspector.sse.emptyNone': 'Aún no se ha recibido ningún evento.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} evento más antiguo descartado.',
      many: '{count} eventos más antiguos descartados.',
      other: '{count} eventos más antiguos descartados.',
    });
    return `Mostrando los últimos ${String(shown)} eventos — ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'Ningún mensaje seleccionado',
  'panel.inspector.streams.preview.noMessageHint': 'Selecciona un mensaje para examinar su contenido.',
  'panel.inspector.streams.preview.noEventTitle': 'Ningún evento seleccionado',
  'panel.inspector.streams.preview.noEventHint': 'Selecciona un evento para examinar su contenido.',
  'panel.inspector.streams.preview.raw': 'Sin procesar',
  'panel.inspector.streams.preview.copy': 'Copiar',
  'panel.inspector.streams.preview.copied': 'Copiado',
  'panel.inspector.streams.preview.copyTitle': 'Copiar al portapapeles',
  'panel.inspector.streams.preview.decodeFailed': 'No se pudo decodificar la carga útil binaria.',
  'panel.inspector.messages.preview.droppedSendPane':
    'La regla descartó este frame — la página lo produjo, pero nunca se envió al servidor.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'La regla descartó este frame — llegó al navegador pero nunca se entregó a la página.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'El frame que produjo la página no se capturó — solo el frame modificado cruzó la red.',
  'panel.inspector.messages.preview.syntheticNote':
    'Frame sintético — inyectado por una regla dentro de la página; nunca cruzó la red.',
  'panel.inspector.sse.preview.droppedPane':
    'La regla descartó este evento — llegó al navegador pero nunca se entregó a la página.',
  'panel.inspector.sse.preview.syntheticNote':
    'Evento sintético — inyectado por una regla dentro de la página; nunca cruzó la red.',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': 'Derivado, no capturado',
  'panel.inspector.messages.inferredModified.summary':
    'Este lado muestra la carga útil de reemplazo de la regla — el plano de captura solo llegó a ver el frame ' +
    'de la red.',
  'panel.inspector.messages.inferredModified.description':
    'La red registró el frame original; la modificación ocurrió dentro de la página después de la captura. Que ' +
    'este frame exacto recibiera el reemplazo se infiere del selector de frames de la regla, en concordancia ' +
    'con el punto ámbar de disparo.',
  'panel.inspector.messages.inferredDropped.title': 'Descartado, inferido',
  'panel.inspector.messages.inferredDropped.summary':
    'La red registró este frame, pero la regla detuvo su entrega dentro de la página.',
  'panel.inspector.messages.inferredDropped.description':
    'El descarte ocurre después de la captura, así que nada puede registrar la no entrega en sí. Que este frame ' +
    'exacto fuera descartado se infiere del selector de frames de la regla, en concordancia con el punto ámbar ' +
    'de disparo.',
  'panel.inspector.sse.inferredModified.title': 'Derivado, no capturado',
  'panel.inspector.sse.inferredModified.summary':
    'Este lado muestra la carga útil de reemplazo de la regla — el plano de captura solo llegó a ver el evento ' +
    'de la red.',
  'panel.inspector.sse.inferredModified.description':
    'La red registró el evento original; la modificación ocurrió dentro de la página después de la captura. Que ' +
    'este evento exacto recibiera el reemplazo se infiere del selector de eventos de la regla, en concordancia ' +
    'con el punto ámbar de disparo.',
  'panel.inspector.sse.inferredDropped.title': 'Descartado, inferido',
  'panel.inspector.sse.inferredDropped.summary':
    'La red registró este evento, pero la regla detuvo su entrega dentro de la página.',
  'panel.inspector.sse.inferredDropped.description':
    'El descarte ocurre después de la captura, así que nada puede registrar la no entrega en sí. Que este ' +
    'evento exacto fuera descartado se infiere del selector de eventos de la regla, en concordancia con el ' +
    'punto ámbar de disparo.',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Frame de ejemplo',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'car. ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'La carga útil del frame — los frames de texto muestran su contenido tal cual.',
  'panel.inspector.messages.columnInfo.data.description':
    'Selecciona una fila para abrir el visor de carga útil: un árbol JSON cuando el texto se puede analizar, un ' +
    'visor Base64 / Hex / UTF-8 para los frames binarios.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'En lugar de la carga útil',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'Un frame binario — los bytes viven en el visor de carga útil, no en la celda.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc':
    'Frames de control keepalive intercambiados por los extremos.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'El handshake de cierre que termina el socket.',
  'panel.inspector.messages.columnInfo.length.summary':
    'El tamaño de la carga útil — un simple recuento de caracteres para los frames de texto, bytes formateados ' +
    '(p. ej. `4 B`) para los frames binarios.',
  'panel.inspector.messages.columnInfo.time.summary': 'El instante de reloj en que el frame cruzó la red.',
  'panel.inspector.messages.columnInfo.time.description':
    'La única columna ordenable. Ascendente es el orden de la red; los frames del mismo milisegundo conservan ' +
    'su orden de llegada en ambos sentidos.',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'En qué sentido viajó el frame.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Flechas',
  'panel.inspector.messages.directionInfo.sentDesc': 'Enviado — la página empujó este frame hacia el servidor.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Recibido — el servidor empujó este frame hacia la página.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Error — un fallo de transporte terminó el flujo; la fila se lee en rojo.',
  'panel.inspector.streams.fireRail.title': 'Disparos de reglas',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Colores de los puntos',
  'panel.inspector.messages.fireRail.summary':
    'Un punto marca cada frame sobre el que actuó una regla de mensaje WebSocket. Los frames no llevan ' +
    'atribución de regla, así que el punto es derivado: las reglas de mensaje disparadas de esta solicitud, con ' +
    'el selector de frames de cada regla reejecutado contra el frame.',
  'panel.inspector.messages.fireRail.appliedDesc':
    'Aplicado — la carga útil del frame es igual a la carga de reemplazo o inyectada de la regla.',
  'panel.inspector.messages.fireRail.inferredDesc':
    'Inferido — la dirección y el filtro de mensaje de la regla seleccionan este frame, pero la aplicación no ' +
    'es verificable (un frame modificado ya no contiene la carga útil con la que coincidió el filtro).',
  'panel.inspector.messages.fireRail.description':
    'Un frame saliente descartado nunca cruza la red, así que no tiene fila alguna. Un frame entrante ' +
    'descartado se capturó primero en la red — su fila permanece, marcada «Descartado — nunca entregado a la ' +
    'página».',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Evento de ejemplo',
  'panel.inspector.sse.columnInfo.id.summary':
    'El campo `id:` del evento — el cursor de reconexión que reparte el servidor.',
  'panel.inspector.sse.columnInfo.id.description':
    'Vacío cuando el servidor no envía ningún id. Al reconectar, el navegador devuelve el último id como ' +
    '`Last-Event-ID`, para que el servidor pueda reanudar el flujo donde lo dejó.',
  'panel.inspector.sse.columnInfo.type.summary':
    'El campo `event:` del evento — `message` para los eventos por defecto.',
  'panel.inspector.sse.columnInfo.type.description':
    'El código de la página se suscribe por tipo: `onmessage` solo ve los eventos por defecto; los eventos con ' +
    'nombre necesitan un `addEventListener` para ese tipo exacto.',
  'panel.inspector.sse.columnInfo.data.summary':
    'La carga útil del evento — siempre texto; los campos `data:` multilínea llegan unidos.',
  'panel.inspector.sse.columnInfo.data.description':
    'Selecciona una fila para abrir el visor de carga útil: un árbol JSON cuando el texto se puede analizar, ' +
    'tal cual en caso contrario.',
  'panel.inspector.sse.columnInfo.time.summary': 'El instante de reloj en que llegó el evento.',
  'panel.inspector.sse.columnInfo.time.description':
    'Ordenable, ascendente por defecto. Los eventos extraídos de un cuerpo de respuesta terminado no llevan ' +
    'hora — el formato de red SSE no la tiene — así que sus celdas quedan vacías.',
  'panel.inspector.sse.fireRail.summary':
    'Un punto marca cada evento sobre el que actuó una regla de mensaje SSE. Una captura registrada por el ' +
    'wrapper es prueba; sin ella, el punto es derivado: las reglas SSE disparadas de esta solicitud, con el ' +
    'selector de eventos de cada regla reejecutado contra el evento.',
  'panel.inspector.sse.fireRail.appliedDesc':
    'Aplicado — el wrapper registró que actuó sobre este evento exacto, o una carga útil inyectada coincide.',
  'panel.inspector.sse.fireRail.inferredDesc':
    'Inferido — el nombre de evento y el filtro de datos de la regla seleccionan este evento, pero la ' +
    'aplicación no es verificable solo desde la red.',
  'panel.inspector.sse.fireRail.description':
    'Los eventos server-sent solo viajan servidor → página, y la red los registra antes de que la regla actúe: ' +
    'un evento descartado conserva su fila, marcada «Descartado — nunca entregado a la página»; un evento ' +
    'inyectado nunca cruza la red y se muestra como una fila sintética.',
} as const satisfies Catalog;
