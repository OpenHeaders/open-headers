/**
 * DevTools panel — traffic table plane — Spanish. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, and every µs/ms/s figure. Mints: waterfall =
 * `cascada`; queue = `fila`; untracked gaps = `intervalos no
 * rastreados`; warm socket = `socket caliente`; key moments =
 * `Momentos clave`; band names `Planificación`/`Conexión`/
 * `Transferencia`; synthesized row = `fila sintetizada`; capture gap =
 * `laguna de captura`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus ─────────────────────
  'panel.network.filterSyntaxHelp': 'Ayuda de sintaxis de filtrado',
  'panel.network.aboutTypeFilters': 'Acerca de los filtros por tipo de solicitud',
  'panel.network.aboutSorting': 'Acerca de la ordenación',

  // ── Remote capture — consent refusal ────────────────────────────────
  'panel.capture.watchRefused.title': 'La vista en vivo está desactivada en este navegador',
  'panel.capture.watchRefused.body':
    'La extensión de Open Headers de este navegador no permite que la aplicación de escritorio vea su tráfico, ' +
    'almacenamiento ni consola. Activa «Permitir que la aplicación de escritorio vea este navegador» en los ajustes ' +
    'de la extensión para observarlo aquí.',

  // Traffic table cells
  'panel.network.cell.workerGearTitle': 'Solicitud emitida por el service worker del origen',
  'panel.network.cell.jumpToPreflight': 'Ir a la solicitud preflight',
  'panel.network.cell.selectPreflightInitiator': 'Seleccionar la solicitud que inició este preflight',
  'panel.network.cell.pendingTitle': 'La solicitud aún no ha terminado',
  'panel.network.cell.pending': 'Pendiente',
  'panel.network.gridAria': 'Solicitudes de red',
  'panel.network.noMatches': 'No hay solicitudes que coincidan.',
  'panel.network.reloadPage': 'Recargar la página',
  'panel.network.startRecording': 'Iniciar la grabación',

  // View ▾ menu
  'panel.network.view.label': 'Vista',
  'panel.network.view.layout': 'Disposición',
  'panel.network.view.layoutCompact': 'Compacta',
  'panel.network.view.layoutWide': 'Amplia',
  'panel.network.view.valueNumber': 'Cifra del valor',
  'panel.network.view.showValue': 'Mostrar el valor',
  'panel.network.view.valuesAlways': 'Siempre',
  'panel.network.view.valuesHover': 'Al pasar el cursor',
  'panel.network.view.valuesOff': 'Desactivado',
  'panel.network.view.valueFormat': 'Formato del valor',
  'panel.network.view.formatRelative': 'Relativo',
  'panel.network.view.formatTimestamp': 'Marca de tiempo',
  'panel.network.view.timezone': 'Zona horaria',
  'panel.network.view.tzLocal': 'Local',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Explicar el valor',
  'panel.network.view.explainValueTitle':
    'En el popover al pasar el cursor, resalta las filas que componen el total y muestra su suma.',
  'panel.network.view.popover': 'Popover',
  'panel.network.view.popoverTitle':
    'Orientación del desglose de timing al pasar el cursor. Auto elige según el ancho del panel — horizontal ' +
    'cuando es ancho, vertical cuando es estrecho.',
  'panel.network.view.popoverAuto': 'Auto',
  'panel.network.view.popoverCompact': 'Compacto',
  'panel.network.view.popoverWide': 'Amplio',
  'panel.network.view.showFireDots': 'Mostrar los puntos de disparo de reglas',

  // Sort ▾ menu
  'panel.network.sort.label': 'Orden',
  'panel.network.sort.heading': 'Orden de clasificación',
  'panel.network.sort.byTime': 'Ordenar por tiempo.',
  'panel.network.sort.groupPriority': 'Prioridad',
  'panel.network.sort.groupPriorityHint': 'Lo que necesita tu atención primero.',
  'panel.network.sort.groupGrouping': 'Agrupación',
  'panel.network.sort.groupGroupingHint': 'Agrupar las solicitudes por categoría.',
  'panel.network.sort.ascending': 'Ascendente',
  'panel.network.sort.descending': 'Descendente',
  'panel.network.sort.customNested': 'Personalizado (anidado)',
  'panel.network.sort.customNestedIdle': 'Orden multiclave — columna por columna.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nivel — abrir para editar.',
      many: '{count} niveles — abrir para editar.',
      other: '{count} niveles — abrir para editar.',
    }),
  'panel.network.sort.noLevelsYet': 'Aún no hay niveles — abre el constructor.',
  'panel.network.sort.builderTitle': 'Ordenar por, en orden',
  'panel.network.sort.builderEmpty': 'Aún no hay niveles. Añade uno abajo.',
  'panel.network.sort.asc': 'Asc',
  'panel.network.sort.desc': 'Desc',
  'panel.network.sort.removeLevel': 'Quitar el nivel {n}',
  'panel.network.sort.addLevel': '+ Añadir nivel',
  'panel.network.sort.finalTiebreak': 'Desempate final: hora de inicio',
  'panel.network.sort.active': 'Activo',
  'panel.network.sort.apply': 'Aplicar',
  'panel.network.sort.columnClick': 'Personalizado (clic en columna)',
  'panel.network.sort.columnClickIdle': 'Haz clic en un encabezado de columna para ordenar por ella.',
  'panel.network.sort.columnClickUse': 'haz clic en un encabezado de columna para usar este modo',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Fallos primero',
  'panel.network.sortMode.failuresSubtitle':
    'Fallidas → pendientes → redirigidas → correctas · hora de inicio dentro de cada grupo.',
  'panel.network.sortMode.slowest': 'Más lentas primero',
  'panel.network.sortMode.slowestSubtitle':
    'La duración más larga primero · la hora de inicio conserva el orden de la cascada en los empates.',
  'panel.network.sortMode.largest': 'Más grandes primero',
  'panel.network.sortMode.largestSubtitle': 'Los mayores bytes transferidos primero · hora de inicio en los empates.',
  'panel.network.sortMode.browserPriority': 'Prioridad del navegador',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest según la prioridad informada por el navegador · hora de inicio dentro de cada nivel.',
  'panel.network.sortMode.byType': 'Por tipo de recurso',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · hora de inicio dentro de ' +
    'cada tipo.',
  'panel.network.sortMode.byDomain': 'Por dominio',
  'panel.network.sortMode.byDomainSubtitle':
    'Agrupa por nombre de host (A → Z) · hora de inicio dentro de cada dominio.',
  'panel.network.sortMode.ruleModified': 'Modificadas por regla primero',
  'panel.network.sortMode.ruleModifiedSubtitle':
    'Reglas aplicadas → inferidas → sin disparo · hora de inicio dentro de cada grupo.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'Cuándo comenzó la solicitud.',
  'panel.network.sortMetric.responseTime': 'Cuándo llegó el primer byte de respuesta.',
  'panel.network.sortMetric.endTime': 'Cuándo terminó la solicitud.',
  'panel.network.sortMetric.duration': 'Cuánto tardó — barras alineadas a cero.',
  'panel.network.sortMetric.latency': 'Tiempo hasta el primer byte — barras alineadas a cero.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Disparos de reglas',
  'panel.network.railAnnotations': 'Anotaciones',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'Abrir en una pestaña nueva',
  'panel.requestMenu.createApiRequest': 'Crear solicitud API',
  'panel.requestMenu.copy': 'Copiar',
  'panel.requestMenu.copyUrl': 'Copiar la URL',
  'panel.requestMenu.copyAsCurl': 'Copiar como cURL',
  'panel.requestMenu.copyAsFetch': 'Copiar como fetch',
  'panel.requestMenu.copyRequestHeaders': 'Copiar los encabezados de solicitud',
  'panel.requestMenu.copyResponseHeaders': 'Copiar los encabezados de respuesta',
  'panel.requestMenu.copyResponse': 'Copiar la respuesta',
  'panel.requestMenu.copyAsHar': 'Copiar como HAR',
  'panel.requestMenu.copyAsHarSanitized': 'Copiar como HAR (saneado)',
  'panel.requestMenu.copyAllUrls': 'Copiar todas las URL',
  'panel.requestMenu.copyAllAsCurl': 'Copiar todo como cURL',
  'panel.requestMenu.copyAllAsHar': 'Copiar todo como HAR',
  'panel.requestMenu.copyAllAsHarSanitized': 'Copiar todo como HAR (saneado)',
  'panel.requestMenu.blockRequests': 'Bloquear solicitudes',
  'panel.requestMenu.blockUrl': 'Bloquear la URL de la solicitud',
  'panel.requestMenu.blockDomain': 'Bloquear el dominio de la solicitud',
  'panel.requestMenu.saveAs': 'Guardar como...',
  'panel.requestMenu.saveThisAsHar': 'Guardar esta como HAR',
  'panel.requestMenu.saveThisAsHarSanitized': 'Guardar esta como HAR (saneado)',
  'panel.requestMenu.saveAllAsHar': 'Guardar todo como HAR',
  'panel.requestMenu.saveAllAsHarSanitized': 'Guardar todo como HAR (saneado)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Tipos de solicitud',
  'panel.network.typeInfo.summary':
    'Acota la lista a uno o más tipos de solicitud. «All» muestra todo; elige tipos para filtrar, o combina ' +
    'varios.',
  'panel.network.typeInfo.inlineHeading': 'En línea',
  'panel.network.typeInfo.fetchXhrDesc': 'Llamadas API — fetch() y XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'Conexiones WebSocket.',
  'panel.network.typeInfo.underMoreHeading': 'Bajo Más',
  'panel.network.typeInfo.docCssJsDesc': 'Documentos, hojas de estilos y scripts.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Fuentes, imágenes y audio / vídeo.',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Manifiestos de aplicaciones web, WebAssembly y todo lo demás.',
  'panel.network.sortInfo.summary':
    'Elige cómo se ordena la lista de solicitudes. Pasa el cursor por un grupo para elegir un modo concreto.',
  'panel.network.sortInfo.modesHeading': 'Modos',
  'panel.network.sortInfo.waterfallDesc': 'Por tiempo — inicio, respuesta, fin, duración o latencia.',
  'panel.network.sortInfo.priorityDesc': 'Lo que necesita atención primero — fallos, más lentas, más grandes.',
  'panel.network.sortInfo.groupingDesc': 'Agrupar por tipo, dominio o modificación por regla.',
  'panel.network.sortInfo.custom': 'Personalizado',
  'panel.network.sortInfo.customDesc': 'Haz clic en un encabezado de columna, o construye un orden anidado multiclave.',

  // Network column `(i)` corpora (titles stay the raw column names)
  'panel.network.colInfo.exampleCaption': 'Solicitud de ejemplo',
  'panel.network.colInfo.name.summary':
    'El nombre de archivo del recurso o el último segmento de su ruta — la forma más rápida de reconocer una ' +
    'fila.',
  'panel.network.colInfo.name.description':
    'El icono inicial codifica el tipo de recurso; la descripción emergente de la fila y la vista de detalle ' +
    'llevan la URL completa, los encabezados, la carga útil y el timing.',
  'panel.network.colInfo.path.summary': 'Todo lo que sigue al host — la ruta de la URL más su cadena de consulta.',
  'panel.network.colInfo.url.summary':
    'La URL completa de la solicitud: esquema, host, ruta y consulta, de extremo a extremo.',
  'panel.network.colInfo.requestNumber.summary':
    'Un índice estable asignado en el orden en que se descubrieron las solicitudes durante la grabación, ' +
    'empezando en 1.',
  'panel.network.colInfo.requestNumber.description':
    'Nunca cambia cuando reordenas, así que sirve también de referencia al orden de captura original.',
  'panel.network.colInfo.method.summary': 'El verbo HTTP que usó la solicitud.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Verbos comunes',
  'panel.network.colInfo.method.getDesc': 'Leer un recurso — sin cuerpo, seguro de repetir.',
  'panel.network.colInfo.method.postDesc': 'Crear o enviar — lleva un cuerpo de solicitud.',
  'panel.network.colInfo.method.putPatchDesc': 'Reemplazar o actualizar parcialmente un recurso.',
  'panel.network.colInfo.method.deleteDesc': 'Eliminar un recurso.',
  'panel.network.colInfo.status.summary':
    'El código de respuesta HTTP (p. ej. 200, 404), o una etiqueta breve de estado cuando no hay código.',
  'panel.network.colInfo.status.description':
    'Los rangos de estado no se codifican por color. Un fallo genuino — un error de red, cualquier 4xx/5xx o ' +
    'un rechazo CORS — pone toda la fila en rojo; un acierto de caché o una fila sin estado atenúa la celda ' +
    'en gris. La frase de motivo (p. ej. «Not Found») va en la descripción emergente de la celda.',
  'panel.network.colInfo.status.codeRangesHeading': 'Rangos de códigos',
  'panel.network.colInfo.status.s2xxDesc': 'Éxito — la solicitud se recibió y se atendió (p. ej. 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': 'Redirección — sigue el encabezado Location hasta la siguiente URL.',
  'panel.network.colInfo.status.s4xxDesc':
    'Error de cliente — la solicitud estaba mal formada, no autorizada o no se encontró.',
  'panel.network.colInfo.status.s5xxDesc': 'Error de servidor — el servidor no pudo atender una solicitud válida.',
  'panel.network.colInfo.status.insteadHeading': 'En lugar de un código',
  'panel.network.colInfo.status.pendingDesc':
    'Enviada, pero aún no ha llegado ninguna respuesta — gris mientras está en vuelo.',
  'panel.network.colInfo.status.failedDesc':
    'Un fallo a nivel de red (DNS, TLS, tiempo agotado, conexión perdida); el código de la pila de red se ' +
    'muestra en línea.',
  'panel.network.colInfo.status.canceledDesc': 'La solicitud se interrumpió antes de completarse.',
  'panel.network.colInfo.status.blockedDesc':
    'El navegador la rechazó por un motivo de política — p. ej. csp, u other para una extensión / un ' +
    'bloqueador de anuncios.',
  'panel.network.colInfo.status.corsDesc': 'Una comprobación cross-origin rechazó la respuesta.',
  'panel.network.colInfo.status.dataDesc': 'Una URL data: — servida en línea, nunca tocó la red.',
  'panel.network.colInfo.status.finishedDesc': 'Una respuesta que no llevaba código de estado.',
  'panel.network.colInfo.protocol.summary':
    'La versión HTTP que negoció la conexión, elegida en el momento del handshake.',
  'panel.network.colInfo.protocol.valuesHeading': 'Valores',
  'panel.network.colInfo.protocol.http11Desc': 'Textual, una solicitud en vuelo por conexión.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — binario y multiplexado sobre una sola conexión.',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3 — corre sobre QUIC encima de UDP para handshakes más rápidos.',
  'panel.network.colInfo.scheme.summary': 'El esquema de la URL — `https`, `http`, `ws` o `wss`.',
  'panel.network.colInfo.domain.summary': 'El nombre de host al que se dirigió la solicitud.',
  'panel.network.colInfo.remoteAddress.summary': 'La dirección IP y el puerto que la conexión alcanzó realmente.',
  'panel.network.colInfo.remoteAddress.description':
    'Difiere del dominio cuando el DNS devuelve varias IP, un CDN enruta por anycast o un proxy local ' +
    'intercepta la conexión.',
  'panel.network.colInfo.type.summary':
    'El tipo de recurso que asignó el navegador — determina el icono de la fila y los chips de filtro sobre ' +
    'la tabla.',
  'panel.network.colInfo.type.examplesHeading': 'Ejemplos',
  'panel.network.colInfo.type.documentDesc': 'Una navegación HTML de nivel superior o en un marco.',
  'panel.network.colInfo.type.fetchXhrDesc': 'Una solicitud de datos emitida desde JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Recursos de página cargados por el analizador.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Recursos estáticos.',
  'panel.network.colInfo.initiator.summary': 'Qué provocó el envío de la solicitud.',
  'panel.network.colInfo.initiator.kindsHeading': 'Clases',
  'panel.network.colInfo.initiator.scriptDesc': 'Disparada desde JavaScript — la celda enlaza al punto de llamada.',
  'panel.network.colInfo.initiator.parserDesc':
    'El analizador HTML encontró el recurso (un `<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'Una respuesta `3xx` envió aquí al navegador.',
  'panel.network.colInfo.initiator.otherDesc': 'Una navegación, una precarga o una fuente sin atribuir.',
  'panel.network.colInfo.cookies.summary':
    'Cuántas cookies adjuntó el navegador a la solicitud en su encabezado `Cookie`. En blanco cuando no hay ' +
    'ninguna.',
  'panel.network.colInfo.setCookies.summary':
    'Cuántos encabezados `Set-Cookie` devolvió la respuesta. En blanco cuando no hay ninguno.',
  'panel.network.colInfo.setCookies.description':
    'Abre la pestaña Cookies de la solicitud para ver si el navegador aceptó o descartó cada una.',
  'panel.network.colInfo.size.summary':
    'Bytes que cruzaron la red, incluidos los encabezados de respuesta y el sobrecoste de compresión.',
  'panel.network.colInfo.size.insteadHeading': 'En lugar de un número',
  'panel.network.colInfo.size.diskCacheDesc': 'Servida desde la caché de disco — nada tocó la red.',
  'panel.network.colInfo.size.memoryCacheDesc': 'Servida desde la caché en memoria de la página actual.',
  'panel.network.colInfo.size.pendingDesc': 'La solicitud aún no ha terminado.',
  'panel.network.colInfo.time.summary':
    'Duración activa desde el envío de la solicitud hasta el último byte de respuesta — el tiempo en fila se ' +
    'excluye.',
  'panel.network.colInfo.time.description':
    'Muestra `0 ms` para una respuesta instantánea; queda en blanco mientras la solicitud sigue en vuelo.',
  'panel.network.colInfo.priority.summary':
    'La prioridad de obtención que asignó el navegador, de `Highest` a `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Los recursos de mayor prioridad se solicitan antes y reciben más parte de la conexión. Una página puede ' +
    'influir con el atributo `fetchpriority`.',
  'panel.network.colInfo.waterfall.summary':
    'Una barra de cronología por solicitud. El menú del encabezado elige la métrica, mostrada como una ' +
    'etiqueta corta tipo `Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Etiquetas de métrica',
  'panel.network.colInfo.waterfall.stDesc':
    'Start time — las barras se colocan en una cronología compartida según cuándo comenzó cada solicitud.',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time — colocadas según la llegada del primer byte de respuesta.',
  'panel.network.colInfo.waterfall.etDesc': 'End time — colocadas según cuándo terminó cada solicitud.',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration — barras alineadas a cero, dimensionadas por la duración completa de la solicitud.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency — barras alineadas a cero, partidas donde comenzó la respuesta.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'Un punto marca cada solicitud sobre la que actuó una de tus reglas.',
  'panel.network.fireRail.dotColorsHeading': 'Colores de los puntos',
  'panel.network.fireRail.appliedDesc':
    'Aplicado — el motor de reglas confirmó la ejecución de la regla, nuestro reportero en la página confirmó ' +
    'la acción, o la modificación es visible en los encabezados capturados.',
  'panel.network.fireRail.inferredDesc':
    'Inferido — la regla coincidió, aplicación no verificable para esta solicitud.',
  'panel.network.fireRail.contradictedDesc':
    'Contradicho — la regla afirmaba un cambio de encabezado que los encabezados capturados refutan.',
  'panel.network.annotationRail.summary':
    'Señala lo que OpenHeaders sabe más allá de lo que muestran las columnas. Pasa el cursor por un glifo ' +
    'para la explicación; haz clic en él para abrir los detalles.',
  'panel.network.annotationRail.glyphsHeading': 'Glifos',
  'panel.network.annotationRail.warnDesc':
    'La fila no es lo que parece — p. ej. una transferencia interrumpida a mitad de descarga.',
  'panel.network.annotationRail.infoDesc':
    'Contexto de procedencia o fidelidad — nunca terminada, laguna de captura, fila sintetizada.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  'panel.network.timing.band.beforeWire': 'Planificación',
  'panel.network.timing.band.connecting': 'Conexión',
  'panel.network.timing.band.exchange': 'Transferencia',
  'panel.network.timing.where.beforeWire': '(Navegador)',
  'panel.network.timing.where.connecting': '(Navegador ↔ Red)',
  'panel.network.timing.where.exchange': '(Red)',
  'panel.network.timing.absent.reused': 'conexión reutilizada',
  'panel.network.timing.absent.notReached': 'no alcanzada',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'sin datos',
  'panel.network.timing.warmSocketTitle':
    'Sin handshake TCP en el reloj de esta solicitud — el socket ya estaba establecido (probablemente ' +
    'preconectado). Aquí solo se ejecutó TLS.',
  'panel.network.timing.warmSocketHint': 'socket caliente',
  'panel.network.timing.moment.queued': 'En fila',
  'panel.network.timing.moment.started': 'Iniciada',
  'panel.network.timing.moment.response': 'Respuesta',
  'panel.network.timing.moment.ended': 'Terminada',
  'panel.network.timing.momentWhy.queued': 'solicitud creada',
  'panel.network.timing.momentWhy.started': 'salió de la fila',
  'panel.network.timing.momentWhy.response': 'primer byte (TTFB)',
  'panel.network.timing.momentWhy.ended': 'último byte, hecho',
  'panel.network.timing.untrackedGaps': 'Intervalos no rastreados: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Equivalente en Chrome: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL dibujado dentro)',
  'panel.network.timing.terminalDetail.noResponse': 'no se recibió respuesta',
  'panel.network.timing.terminalDetail.neverReached': 'nunca alcanzó la red',
  'panel.network.timing.keyMoments': 'Momentos clave',
  'panel.network.timing.sinceFirstRequest': '(desde la primera solicitud)',
  'panel.network.timing.timingNotes': 'Notas de timing',
  'panel.network.timing.totalTime': 'Tiempo total',
  'panel.network.timing.queuedToEnded': '(en fila → terminada)',
  'panel.network.timing.connectionOpenedBy': '↳ conexión abierta por {name}',
  'panel.network.timing.notFinishedCaution': 'ATENCIÓN: ¡la solicitud aún no ha terminado!',
  'panel.network.timing.queuedAt': 'En fila a las {time}',
  'panel.network.timing.startedAt': 'Iniciada a las {time}',
  // Separate referent from the rung-state 'no alcanzada': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'no alcanzado',
  'panel.network.timing.onTheWire': '🌐 en la red',
  'panel.network.timing.cdpExplainer':
    'Activa CDP y recarga antes de navegar para obtener el desglose completo de la conexión en tiempo real.',

  // Timing `(i)` corpora (rung / terminal titles stay raw)
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Navegador',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Navegador ↔ Red',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Red',
  'panel.network.rungInfo.kickerInstant': 'Timing · Instante',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Desenlace',
  'panel.network.rungInfo.stripCaption': 'Solicitud de ejemplo — {ms} ms de extremo a extremo',
  'panel.network.rungInfo.stripStop':
    'marcado: donde se detuvo la solicitud — las fases posteriores nunca se ejecutaron',
  'panel.network.rungInfo.stripMarked': 'marcado: {label} a los {ms} ms',
  'panel.network.rungInfo.stripGaps': 'resaltado: los intervalos no rastreados (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'resaltado: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary':
    'Tiempo que la solicitud pasó esperando en el navegador antes de que se le permitiera empezar.',
  'panel.network.rungInfo.queueing.description':
    'El navegador aplaza las solicitudes de recursos de menor prioridad mientras los de mayor prioridad ' +
    'cargan primero y mientras comprueba la caché de disco. En HTTP/1.x también espera aquí cuando todos los ' +
    'sockets hacia el host están ocupados.',
  'panel.network.rungInfo.stalled.summary':
    'Autorizada a empezar, pero esperando una conexión utilizable antes de cualquier trabajo de red.',
  'panel.network.rungInfo.stalled.description':
    'Normalmente esperando a que se libere un socket o a una decisión de proxy. Termina en cuanto arranca el ' +
    'primer paso de red (DNS, TCP o envío).',
  'panel.network.rungInfo.dns.summary': 'Resolver el nombre de host a una dirección IP a la que conectarse.',
  'panel.network.rungInfo.dns.description':
    'Muestra «conexión reutilizada» cuando la solicitud viajó por una conexión ya abierta — no hizo falta ' +
    'ninguna resolución en el reloj de esta solicitud.',
  'panel.network.rungInfo.connect.summary':
    'Solo el handshake TCP — el viaje de ida y vuelta que abre el socket hacia el servidor.',
  'panel.network.rungInfo.connect.description':
    'La pestaña Timing de Chrome dibuja una sola barra «Initial connection» que abarca esta fase Y el ' +
    'handshake TLS (su barra SSL se dibuja dentro). Nosotros las separamos en fases distintas sin ' +
    'solapamiento para que cada milisegundo se cuente exactamente una vez — TCP + TLS aquí equivale a la ' +
    'barra Initial connection de Chrome.',
  'panel.network.rungInfo.ssl.summary':
    'El handshake TLS — negociar claves y verificar certificados para cifrar la conexión.',
  'panel.network.rungInfo.ssl.description':
    'Solo en solicitudes https:// (n/a en http:// plano). «Conexión reutilizada» significa que una solicitud ' +
    'anterior ya pagó este coste en el mismo socket.',
  'panel.network.rungInfo.send.summary':
    'Empujar los bytes de la solicitud — encabezados y cuerpo si lo hay — a la red.',
  'panel.network.rungInfo.send.description':
    'Normalmente muy por debajo del milisegundo para solicitudes de solo encabezados; crece con las subidas ' +
    'grandes.',
  'panel.network.rungInfo.wait.summary':
    'Del último byte de solicitud enviado al primer byte de respuesta recibido (tiempo hasta el primer byte).',
  'panel.network.rungInfo.wait.description':
    'Tiempo de procesamiento del servidor más un viaje de ida y vuelta de red — la fase donde aparece el ' +
    'trabajo del back-end.',
  'panel.network.rungInfo.receive.summary': 'Descargar el cuerpo de la respuesta, del primer byte al último.',
  'panel.network.rungInfo.receive.description':
    'Crece en directo mientras una respuesta sigue transmitiéndose; la línea de aviso bajo el gráfico señala ' +
    'una descarga que nunca terminó.',
  'panel.network.rungInfo.notes.summary':
    'Contabilidad de las esquirlas de tiempo entre fases — registradas de extremo a extremo, pero sin ' +
    'pertenecer a ninguna fase.',
  'panel.network.rungInfo.notes.description':
    'Cada fase se mide entre sus propios instantes de inicio y fin, mientras que el total se mide de extremo ' +
    'a extremo — así que pequeños «intervalos no rastreados» pueden quedar entre dos fases (p. ej. entre la ' +
    'llegada de la respuesta DNS y el inicio del handshake TCP). Por eso las fases no siempre suman el total. ' +
    'La pestaña Timing de Chrome tiene los mismos intervalos y simplemente no los dibuja; nosotros los ' +
    'listamos para que cada milisegundo quede contabilizado.',
  'panel.network.rungInfo.notes.linesHeading': 'Las líneas',
  'panel.network.rungInfo.notes.gapsLabel': 'Intervalos no rastreados',
  'panel.network.rungInfo.notes.gapsDesc': 'Cada intervalo, nombrado por las fases que lo rodean, con su duración.',
  'panel.network.rungInfo.notes.chromeLabel': 'Equivalente en Chrome',
  'panel.network.rungInfo.notes.chromeDesc':
    'Cómo nuestras fases TCP + TLS separadas se corresponden con la única barra «Initial connection» de ' +
    'Chrome (su barra SSL se dibuja dentro de esa barra, no después).',
  'panel.network.rungInfo.band.beforeWire.summary':
    'Tiempo pasado por completo dentro del navegador antes de cualquier trabajo de red — nada ha salido aún ' +
    'de la máquina.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (esperar permiso para empezar) más Stalled (esperar una conexión utilizable). Una solicitud ' +
    'pesada aquí está retenida localmente — por prioridades, límites de conexiones o decisiones de proxy — ' +
    'no por el servidor.',
  'panel.network.rungInfo.band.connecting.summary':
    'Preparar el camino hasta el servidor: resolver el nombre, abrir el socket, cifrarlo.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — los viajes de ida y vuelta del handshake. Se paga una vez por conexión: una ' +
    'solicitud que viaja por un socket ya abierto se salta toda esta banda («conexión reutilizada»).',
  'panel.network.rungInfo.band.exchange.summary':
    'El intercambio real por la red: enviar la solicitud, esperar al servidor, descargar la respuesta.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. La lentitud del lado del servidor aparece ' +
    'en Waiting for server; las respuestas grandes o los enlaces lentos aparecen en Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    'El instante en que el navegador creó la solicitud — el cero desde el que se mide cada fase de este ' + 'desglose.',
  'panel.network.rungInfo.moment.queued.description':
    'El valor «a los» es el desplazamiento desde la primera solicitud a la vista, para comparar las filas ' +
    'sobre un mismo reloj compartido.',
  'panel.network.rungInfo.moment.started.summary':
    'El instante en que la solicitud salió de la fila y el trabajo empezó de verdad.',
  'panel.network.rungInfo.moment.started.description':
    'En fila + Queueing. Todo lo anterior a esta marca es planificación del navegador; todo lo posterior es ' +
    'progreso real de la solicitud.',
  'panel.network.rungInfo.moment.response.summary':
    'El instante en que llegó el primer byte de respuesta (tiempo hasta el primer byte).',
  'panel.network.rungInfo.moment.response.description':
    'El servidor ha contestado; desde aquí el cuerpo se está descargando. Ausente cuando nunca llegó ' +
    'respuesta (bloqueada o fallida antes).',
  'panel.network.rungInfo.moment.ended.summary':
    'El instante en que llegó el último byte de respuesta — la solicitud ha terminado.',
  'panel.network.rungInfo.moment.ended.description':
    'Terminada − En fila es el tiempo total mostrado bajo el desglose; Terminada − Iniciada es la duración ' +
    'activa que muestra la columna Time.',
  'panel.network.rungInfo.keyMoments.summary':
    'Los instantes frontera de la vida de la solicitud — donde una etapa cede el paso a la siguiente.',
  'panel.network.rungInfo.keyMoments.description':
    'En fila e Iniciada existen siempre; Respuesta y Terminada solo cuando una respuesta llegó de verdad ' +
    '(una solicitud bloqueada o fallida antes muestra en su lugar su marcador de desenlace). Las fases de ' +
    'abajo son los tramos entre estos instantes.',
  'panel.network.rungInfo.terminal.whereHeading': 'Dónde se detuvo',
  'panel.network.rungInfo.terminal.noResponseDesc': 'Alcanzó la red, pero ninguna respuesta llegó de vuelta.',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    'Murió en la planificación del lado del navegador — no se envió nada.',
  'panel.network.rungInfo.terminal.canceled.summary':
    'La solicitud se interrumpió antes de completarse — la ✗ marca dónde se detuvo; las fases posteriores ' +
    'nunca se ejecutaron.',
  'panel.network.rungInfo.terminal.canceled.description':
    'Causas típicas: la página navegó a otro sitio a mitad de carga, un script abortó el fetch, o el usuario ' +
    'detuvo la carga. La red no tenía nada de malo — el navegador simplemente renunció a la respuesta.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'El navegador rechazó la solicitud por un motivo de política — la palabra tras los dos puntos nombra la ' +
    'política en cuestión.',
  'panel.network.rungInfo.terminal.stoppedHere':
    'La ✗ marca dónde se detuvo; las fases posteriores nunca se ejecutaron.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Motivos comunes',
  'panel.network.rungInfo.terminal.blocked.cspDesc': 'La Content-Security-Policy de la página prohíbe este destino.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'Un recurso http:// no seguro en una página https://.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    'Una extensión, un bloqueador de anuncios o una regla interna del navegador la rechazó.',
  'panel.network.rungInfo.terminal.cors.summary':
    'Una comprobación cross-origin rechazó la respuesta — el servidor contestó, pero la página no tenía ' +
    'permiso para leerla.',
  'panel.network.rungInfo.terminal.cors.description':
    'El servidor debe dar su consentimiento vía Access-Control-Allow-Origin (y compañía) para que una página ' +
    'cross-origin lea su respuesta. La ✗ marca dónde aterrizó el rechazo.',
  'panel.network.rungInfo.terminal.failed.summary':
    'Un fallo a nivel de red — la propia conexión se rompió, y el código net:: nombra la causa exacta.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Códigos comunes',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'El DNS no pudo encontrar el host.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'El servidor rechazó o cortó el socket.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc':
    'Ninguna respuesta dentro del límite de tiempo de la pila de red.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'El certificado TLS no superó la validación.',

  // ── OH row annotations ──────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'También en esta fila',
  'panel.rowAnnotations.openDetails': 'Abrir los detalles',
  'panel.rowAnnotations.interrupted.label': 'Transferencia interrumpida',
  'panel.rowAnnotations.interrupted.detail':
    'La descarga se canceló antes de terminar. El estado refleja los encabezados llegados antes de la ' +
    'interrupción, y los datos recibidos están incompletos — por lo demás la fila es indistinguible de una ' +
    'completada.',
  'panel.rowAnnotations.neverFinished.label': 'Nunca terminada',
  'panel.rowAnnotations.neverFinished.detail':
    'La página que emitió esta solicitud se descargó de memoria mientras seguía en vuelo, así que nunca se ' +
    'registró un desenlace — por eso Status y Time muestran «(unknown)».',
  'panel.rowAnnotations.fidelityGap.label': 'Laguna de fidelidad de captura',
  'panel.rowAnnotations.fidelityGap.detail':
    'Los bytes transferidos y el cuerpo de la respuesta no son visibles para la vía de captura ' +
    'predeterminada en solicitudes que nunca terminaron — la inspección reforzada con CDP sí los registra.',
  'panel.rowAnnotations.syntheticHar.label': 'Fila sintetizada',
  'panel.rowAnnotations.syntheticHar.detail':
    'Esta fila se reconstruyó a partir de un registro de captura que nunca se unió a una solicitud real, así ' +
    'que algunas columnas no pueden rellenarse.',
  'panel.rowAnnotations.syntheticMemory.label': 'Fila sintetizada',
  'panel.rowAnnotations.syntheticMemory.detail':
    'Esta fila se reconstruyó a partir del Resource Timing de la página (un acierto de caché en memoria ' +
    'nunca llega a la pila de red), así que los encabezados y las cookies no están disponibles.',
  'panel.rowAnnotations.debugPaused.label': 'Retención del modo de depuración',
  'panel.rowAnnotations.debugPaused.detail':
    '{ms} ms del tiempo de esta fila se pasaron en pausa en la interceptación del modo de depuración, no ' +
    'esperando al servidor ni a la red — el modo de depuración retuvo la solicitud mientras la ' +
    'inspeccionaba, así que el tiempo total de la fila supera lo que tardó la solicitud en sí.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Reescritura de parámetros de consulta',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'Esta redirección es Open Headers aplicando una regla de parámetros de consulta, no el servidor. ' +
    'Reescribir la cadena de consulta de una URL se realiza como una redirección interna, así que aparece ' +
    'como su propio salto; la solicitud continúa después hacia la URL reescrita con su método, cuerpo, ' +
    'cookies y encabezados transportados sin cambios.',
  'panel.rowAnnotations.redirectRule.label': 'Regla de redirección',
  'panel.rowAnnotations.redirectRule.detail':
    'Esta redirección es Open Headers aplicando una regla de redirección, no el servidor. Se realiza como ' +
    'una redirección interna, así que la solicitud original aparece como su propio salto antes de continuar ' +
    'hacia la URL reescrita.',
  'panel.rowAnnotations.interceptionJoined.label': 'Interceptación de tráfico unida',
  'panel.rowAnnotations.interceptionJoined.detail':
    'Este intercambio también fue capturado por la interceptación de tráfico — el proxy local. Los encabezados exactos en el ' +
    'cable, los tamaños medidos y los tiempos de socket de esa captura completan lo que la captura del ' +
    'navegador no registró por sí misma.',
  'panel.rowAnnotations.interceptionSeen.label': 'Visto en una pestaña del navegador',
  'panel.rowAnnotations.interceptionSeen.detail':
    'Este intercambio interceptado también se observó en la pestaña del navegador {tab} — las dos filas son ' +
    'la misma solicitud vista desde ambos lados.',
  'panel.rowAnnotations.interceptionSeen.unknownTab': 'una pestaña observada',
  'panel.rowAnnotations.interceptionSeen.jump': 'Mostrar en la fuente de la pestaña',
} as const satisfies Catalog;
