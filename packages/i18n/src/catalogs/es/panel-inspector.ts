/**
 * DevTools panel — request inspector shell + detail tabs — Spanish.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary), and wire
 * tokens (HEAD / CONNECT / 204 No Content / Server-Timing). Mints:
 * split = `dividir` / unsplit = `deshacer la división`; frame rides
 * raw (m., JS vocabulary, fr precedent); redact = `censurar`;
 * pretty print = `Formatear`; hex viewer = `Visor hexadecimal`;
 * `{percent}%` unspaced per the es register (unlike fr).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  'panel.inspector.detailEmpty.requestGone': 'La solicitud ya no está disponible (borrada o página abandonada)',
  'panel.inspector.detailEmpty.selectPrefix': 'Selecciona una solicitud en el',
  'panel.inspector.detailEmpty.selectSuffix': 'panel Network para inspeccionarla',
  'panel.inspector.detailEmpty.noSelection': 'Selecciona una solicitud capturada para inspeccionarla',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  'panel.inspector.tabBar.closeTab': 'Cerrar la pestaña',
  'panel.inspector.tabBar.unsavedChanges': 'Cambios sin guardar',
  'panel.inspector.tabBar.searchTabs': 'Buscar en las pestañas',
  'panel.inspector.tabBar.searchPlaceholder': 'Buscar pestañas…',
  'panel.inspector.tabBar.noOpenTabs': 'No hay pestañas abiertas',
  'panel.inspector.tabBar.noOpenTabsMatch': 'Ninguna pestaña abierta coincide con tu búsqueda',
  'panel.inspector.tabBar.noClosedTabsMatch': 'Ninguna pestaña cerrada coincide con tu búsqueda',
  'panel.inspector.tabBar.recentlyClosed': 'Cerradas recientemente ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Cerradas recientemente ({matched} de {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': '¿Guardar los cambios?',
  'panel.inspector.tabBar.closeGuard.unsavedBody': 'tiene cambios sin guardar. Guárdalos para no perder tu trabajo.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'No guardar',
  'panel.inspector.tabBar.closeGuard.cancel': 'Cancelar',
  'panel.inspector.tabBar.closeGuard.save': 'Guardar los cambios',

  // Tab context menu
  'panel.inspector.tabMenu.close': 'Cerrar',
  'panel.inspector.tabMenu.closeOther': 'Cerrar las demás pestañas',
  'panel.inspector.tabMenu.closeAll': 'Cerrar todas las pestañas',
  'panel.inspector.tabMenu.closeToLeft': 'Cerrar las pestañas a la izquierda',
  'panel.inspector.tabMenu.closeToRight': 'Cerrar las pestañas a la derecha',
  'panel.inspector.tabMenu.splitAndMove': 'Dividir y mover',
  'panel.inspector.tabMenu.right': 'Derecha',
  'panel.inspector.tabMenu.left': 'Izquierda',
  'panel.inspector.tabMenu.down': 'Abajo',
  'panel.inspector.tabMenu.up': 'Arriba',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'Mover al grupo opuesto',
  'panel.inspector.tabMenu.changeSplitterOrientation': 'Cambiar la orientación del separador',
  'panel.inspector.tabMenu.unsplit': 'Deshacer la división',
  'panel.inspector.tabMenu.unsplitAll': 'Deshacer todas las divisiones',

  // Detail section tabs — host-panel tab nouns stay raw (parity
  // vocabulary, same posture as the tool-window labels).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab.
  'panel.inspector.overrideCta.editOverride': 'Editar la sustitución',
  'panel.inspector.overrideCta.editOverrideTitle':
    'Editar la regla que produjo esta respuesta — los cambios se aplican a las solicitudes futuras',
  'panel.inspector.overrideCta.overrideResponse': 'Sustituir la respuesta',
  'panel.inspector.overrideCta.overrideResponseTitle': 'Crear una regla que sirva esta respuesta como un mock editable',
  'panel.inspector.overrideCta.editQueryParams': 'Editar la sustitución de parámetros de consulta',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'Editar la regla que reescribió estos parámetros de consulta — los cambios se aplican a las solicitudes ' +
    'futuras',
  'panel.inspector.overrideCta.overrideQueryParams': 'Sustituir los parámetros de consulta',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'Crear una regla que reescriba estos parámetros de consulta',
  'panel.inspector.overrideCta.editRequestBody': 'Editar la sustitución del cuerpo de solicitud',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'Editar la regla que reemplazó este cuerpo de solicitud — los cambios se aplican a las solicitudes futuras',
  'panel.inspector.overrideCta.overrideRequestBody': 'Sustituir el cuerpo de solicitud',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Crear una regla que reemplace este cuerpo de solicitud por un cuerpo estático editable',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Respuesta completa',
  'panel.inspector.dualView.fullRequest': 'Solicitud completa',
  'panel.inspector.dualView.swapSides': 'Intercambiar los lados',
  'panel.inspector.dualView.hideUnchanged': 'Ocultar lo sin cambios',

  // Delivery-path pane captions for the two-sided views.
  'panel.inspector.paneCaption.responseOriginal': 'Original · servidor → página',
  'panel.inspector.paneCaption.responseModified': 'Modificada · servidor → Open Headers → página',
  'panel.inspector.paneCaption.requestOriginal': 'Original · página → servidor',
  'panel.inspector.paneCaption.requestModified': 'Modificada · página → Open Headers → servidor',
  'panel.inspector.paneCaption.wsRecvDropped': 'Descartado · nunca llegó a la página',
  'panel.inspector.paneCaption.wsSendDropped': 'Descartado · nunca llegó al servidor',

  // Body-state notices (Response tab + Preview tab twins).
  'panel.inspector.bodyState.noResponseBodyTitle': 'Sin cuerpo de respuesta',
  'panel.inspector.bodyState.noPreviewTitle': 'No hay vista previa disponible',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Nada que previsualizar',
  'panel.inspector.bodyState.noResponseDetail': 'Esta solicitud no tiene datos de respuesta disponibles',
  'panel.inspector.bodyState.failedTitle': 'No se pudieron cargar los datos de respuesta',
  'panel.inspector.bodyState.emptyTitle': '(cuerpo de respuesta vacío)',
  'panel.inspector.bodyState.emptyDetail': 'El servidor devolvió un cuerpo vacío.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Carga útil binaria ({count} bytes).',
  'panel.inspector.bodyState.notApplicable.preflight': 'No hay contenido disponible para una solicitud preflight',
  'panel.inspector.bodyState.notApplicable.head': 'Sin cuerpo de respuesta para una solicitud HEAD',
  'panel.inspector.bodyState.notApplicable.connect': 'Sin cuerpo de respuesta para una solicitud CONNECT',
  'panel.inspector.bodyState.notApplicable.status204': 'Sin contenido (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'Sin contenido (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'No modificado — cuerpo servido desde la caché del navegador',
  'panel.inspector.bodyState.notApplicable.informational': 'Sin contenido (respuesta informativa)',
  'panel.inspector.bodyState.notApplicable.websocket': 'Conexión WebSocket establecida — mira la pestaña Messages',
  'panel.inspector.bodyState.unavailable.opaque': 'Cuerpo de respuesta no disponible — respuesta cross-origin opaca',
  'panel.inspector.bodyState.unavailable.cache':
    'Cuerpo no disponible — la respuesta se sirvió desde la caché antes de abrir las DevTools',
  'panel.inspector.bodyState.unavailable.redirect': 'No hay contenido disponible porque esta solicitud fue redirigida',
  'panel.inspector.bodyState.unavailable.unknown':
    'Cuerpo no capturado. El host no devolvió contenido — la respuesta se transmitió sin almacenarse en búfer ' +
    'o se sirvió desde la caché.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Vista previa no disponible para este tipo de contenido.',
  'panel.inspector.preview.imageAlt': 'vista previa de la respuesta',

  // Shared body-viewer toolbars.
  'panel.inspector.viewer.prettyPrintTitle': 'Formatear',
  'panel.inspector.viewer.revertTitle': 'Volver al Content-Type declarado',
  'panel.inspector.viewer.parsedAsRevert': 'Interpretado como {format} · volver',
  'panel.inspector.viewer.looksLikeParse': 'Parece {format} · interpretar',
  'panel.inspector.viewer.looksLikeTitle':
    'El Content-Type parece incorrecto — el cuerpo se interpreta como {format}. Haz clic para reinterpretar.',
  'panel.inspector.viewer.cursorInfo': 'Línea {line}, columna {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} línea', many: '{count} líneas', other: '{count} líneas' }),
  'panel.inspector.viewer.hexViewer': 'Visor hexadecimal',
  'panel.inspector.viewer.find': 'Buscar',
  'panel.inspector.viewer.findTitle': 'Buscar ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Parámetros de la cadena de consulta',
  'panel.inspector.payload.requestBody': 'Cuerpo de la solicitud ({mime})',
  'panel.inspector.payload.viewSource': 'Ver el código fuente',
  'panel.inspector.payload.viewParsed': 'Ver el análisis',
  'panel.inspector.payload.viewUrlEncoded': 'Ver la codificación URL',

  // ── Raw Data tab (inspector detail) ─────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'Fragmento de exportación',
  'panel.inspector.rawData.formatLabel': 'Formato',
  'panel.inspector.rawData.copy': 'Copiar',
  'panel.inspector.rawData.copied': 'Copiado',
  'panel.inspector.rawData.rawHar': 'HAR sin procesar (JSON)',
  'panel.inspector.rawData.downloadHar': 'Descargar el .har',
  'panel.inspector.rawData.noRequestData': '(aún no hay datos de solicitud)',
  'panel.inspector.rawData.view.label': 'Vista',
  'panel.inspector.rawData.view.includeHeaders': 'Incluir los encabezados de solicitud',
  'panel.inspector.rawData.view.includeBody': 'Incluir el cuerpo de solicitud',
  'panel.inspector.rawData.view.redactSecrets': 'Censurar los secretos',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'Encabezados modificados por una regla',
  'panel.inspector.rawData.view.postRule': 'Tras las reglas (en la red)',
  'panel.inspector.rawData.view.original': 'Originales (antes de las reglas)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (navegador)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — mensaje sin procesar',
  'panel.inspector.rawData.format.har': 'HAR — entrada única',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Formato',
  'panel.inspector.rawData.harInfo.summary': 'Archivo HTTP portátil — una instantánea JSON de una solicitud.',
  'panel.inspector.rawData.harInfo.description':
    'Guárdalo para adjuntarlo a un informe de error, compartirlo con un compañero o importarlo en otra ' +
    'herramienta que lea archivos HAR.',

  // ── Initiator tab (inspector detail) ────────────────────────────────
  'panel.inspector.initiator.noData': 'No hay datos de iniciador disponibles.',
  'panel.inspector.initiator.typeLabel': 'Tipo:',
  'panel.inspector.initiator.stack.heading': 'Pila de llamadas de la solicitud',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} frame', many: '{count} frames', other: '{count} frames' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count} resueltos',
  'panel.inspector.initiator.stack.resolvedTitle': 'Nombres de función resueltos vía source maps',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Mostrar {count} oculto',
      many: 'Mostrar {count} ocultos',
      other: 'Mostrar {count} ocultos',
    }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Ocultar {count} ruidoso',
      many: 'Ocultar {count} ruidosos',
      other: 'Ocultar {count} ruidosos',
    }),
  'panel.inspector.initiator.stack.noiseTitle': 'Ocultar los frames anónimos dentro de bundles minificados',
  'panel.inspector.initiator.stack.copyTitle': 'Copiar la pila como texto',
  'panel.inspector.initiator.stack.copy': 'Copiar',
  'panel.inspector.initiator.stack.copied': 'Copiado',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Filtrar los frames (nombre de función o URL)…',
  'panel.inspector.initiator.stack.filterAria': 'Filtrar los frames de la pila de llamadas',
  'panel.inspector.initiator.stack.noMatch': 'Ningún frame coincide.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} frame',
      many: '{count} frames',
      other: '{count} frames',
    });
    return `Mostrando ${String(shown)} de ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '({count} ocultos)',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Nombre en el source map: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (original: {source})',
  'panel.inspector.initiator.moreFilters.label': 'Filtros adicionales',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Solo fallos',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'Solo terceros',
  'panel.inspector.initiator.view.label': 'Vista',
  'panel.inspector.initiator.view.sort': 'Orden',
  'panel.inspector.initiator.view.sortInitiator': 'Orden de iniciador',
  'panel.inspector.initiator.view.sortChronological': 'Cronológico',
  'panel.inspector.initiator.view.sortLargest': 'Subárbol más grande',
  'panel.inspector.initiator.view.showSuggestions': 'Mostrar las sugerencias',
  'panel.inspector.initiator.filterPlaceholder':
    'Filtrar — texto, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': 'Filtrar la cadena de iniciadores',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} coincidencia',
      many: '{count} coincidencias',
      other: '{count} coincidencias',
    }),
  // Two sections are separate referents: the upstream (ancestor) chain
  // and the downstream tree — same Spanish surface, separate keys.
  'panel.inspector.initiator.upstreamChain': 'Cadena de iniciadores de la solicitud',
  'panel.inspector.initiator.chainTree': 'Cadena de iniciadores de la solicitud',
  'panel.inspector.initiator.collapse': 'Contraer',
  'panel.inspector.initiator.expand': 'Expandir',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'solicitud', many: 'solicitudes', other: 'solicitudes' }),
  'panel.inspector.initiator.cascade.transferred': 'transferidos',
  'panel.inspector.initiator.cascade.cumulative': 'acumulados',
  'panel.inspector.initiator.cascade.failed': 'fallidas',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'Tipo de iniciador',
  'panel.inspector.initiator.chip.httpStatusTitle': 'Estado HTTP',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Solicitud fallida',
  'panel.inspector.initiator.chip.failed': 'fallida',
  'panel.inspector.initiator.chip.transferredTitle': 'Transferido',
  'panel.inspector.initiator.chip.durationTitle': 'Duración',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Origen de terceros',
  'panel.inspector.initiator.chip.thirdParty': 'terceros',
  'panel.inspector.initiator.chip.subtreeTitle': 'Peso del subárbol (descendientes · bytes)',
  'panel.inspector.initiator.chip.subtree': '+{count} sol. · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`).
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud fallida en esta cascada.',
      many: '{count} solicitudes fallidas en esta cascada.',
      other: '{count} solicitudes fallidas en esta cascada.',
    }),
  'panel.inspector.initiator.insights.failedHint':
    'Revisa los bloqueadores de anuncios, las reglas CSP y la configuración de CORS.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'cargó {count} solicitud',
      many: 'cargó {count} solicitudes',
      other: 'cargó {count} solicitudes',
    });
    return `${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)}% del peso de la cascada.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'El host más pesado de esta cascada. Alójalo tú mismo o aplázalo si puedes.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent}% de los bytes de la cascada son de terceros.',
  'panel.inspector.initiator.insights.thirdPartyHint': 'Recorta, aplaza o autoaloja los terceros no esenciales.',

  // ── Timing tab (inspector detail) — the tab's OWN copy ──────────────
  'panel.inspector.timing.noData': 'No hay datos de timing disponibles.',
  'panel.inspector.timing.view.label': 'Vista',
  'panel.inspector.timing.view.showSuggestions': 'Mostrar las sugerencias',
  'panel.inspector.timing.view.showContextStrip': 'Mostrar la banda de contexto',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Mostrar el desglose de fases',
  'panel.inspector.timing.view.showTimingBar': 'Mostrar la barra de timing',
  'panel.inspector.timing.view.showServerTiming': 'Mostrar Server-Timing',
  'panel.inspector.timing.view.showRepeats': 'Mostrar las repeticiones de la sesión',
  'panel.inspector.timing.view.showTransferRate': 'Mostrar la tasa de transferencia',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary.
  'panel.inspector.timing.insight.dominatesTail': 'domina esta solicitud — {ms} ({percent}% del total).',
  'panel.inspector.timing.insight.unusuallyHighTail': 'es inusualmente alto — {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'El planificador de solicitudes retuvo esta solicitud',
  'panel.inspector.timing.phase.queueing.hint':
    'Demasiadas solicitudes simultáneas compitiendo por los huecos, o prioridad baja.',
  'panel.inspector.timing.phase.stalled.what': 'Esperando una conexión disponible',
  'panel.inspector.timing.phase.stalled.hint':
    'Límite del grupo de conexiones, negociación de proxy o bloqueo head-of-line de HTTP/1.1.',
  'panel.inspector.timing.phase.dns.what': 'Resolución DNS',
  'panel.inspector.timing.phase.dns.hint':
    'Solo afecta a la primera solicitud hacia este dominio. Considera el DNS prefetch.',
  'panel.inspector.timing.phase.connect.what': 'Handshake TCP hacia el servidor',
  'panel.inspector.timing.phase.connect.hint':
    'Conexión nueva — keep-alive o el multiplexado HTTP/2/3 reutiliza una entre solicitudes.',
  'panel.inspector.timing.phase.ssl.what': 'Handshake TLS',
  'panel.inspector.timing.phase.ssl.hint': 'Se reduce con la reanudación de sesión / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Subiendo el cuerpo de la solicitud',
  'panel.inspector.timing.phase.send.hint':
    'Cuerpo de solicitud grande o subida lenta — normalmente solo visible en POST/PUT.',
  'panel.inspector.timing.phase.wait.what': 'Tiempo del servidor hasta el primer byte',
  'panel.inspector.timing.phase.wait.hint':
    'Procesamiento del back-end. Busca el timing del back-end en Server-Timing o en los registros de ' +
    'consultas de la base de datos.',
  'panel.inspector.timing.phase.receive.what': 'Descargando la carga útil de la respuesta',
  'panel.inspector.timing.phase.receive.hint':
    'Tamaño de la carga útil o rendimiento del CDN — comprueba la tasa de transferencia efectiva.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Protocolo',
  'panel.inspector.timing.chip.connection': 'Conexión',
  'panel.inspector.timing.chip.cache': 'Caché',
  'panel.inspector.timing.chip.priority': 'Prioridad',
  'panel.inspector.timing.chip.started': 'Iniciada',
  'panel.inspector.timing.chip.serverIp': 'IP del servidor',
  'panel.inspector.timing.chip.connectionReused': 'reutilizada',
  'panel.inspector.timing.chip.connectionNew': 'nueva',
  'panel.inspector.timing.chip.openedBy': 'abierta por {url}',
  'panel.inspector.timing.totalTime': 'Tiempo total',
  'panel.inspector.timing.totalWhere': '(en fila → terminada)',
  'panel.inspector.timing.caution': 'ATENCIÓN: ¡la solicitud aún no ha terminado!',
  'panel.inspector.timing.queuedAt': 'En fila a {offset}',
  'panel.inspector.timing.startedAt': 'Iniciada a {offset}',
  'panel.inspector.timing.inProgress': 'en curso…',
  'panel.inspector.timing.noDuration': 'sin duración',
  'panel.inspector.timing.transferRate.heading': 'Tasa de transferencia',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Contenido descargado:',
  'panel.inspector.timing.transferRate.effectiveRate': 'Tasa efectiva:',
  'panel.inspector.timing.transferRate.amount': '{size} en {duration}',
  'panel.inspector.timing.repeats.heading': 'Repeticiones en esta sesión',
  'panel.inspector.timing.repeats.hitCount': 'Recuento de accesos a la URL:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'La más rápida / mediana / la más lenta:',
  'panel.inspector.timing.repeats.thisRequest': 'Esta solicitud:',
  'panel.inspector.timing.repeats.slowestTag': '(la más lenta)',
  'panel.inspector.timing.repeats.fastestTag': '(la más rápida)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Desglose de la caché:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
