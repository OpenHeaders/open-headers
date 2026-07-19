/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — Spanish. Extends the es register contract
 * (`es/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, header names, and every wire token. Option labels reuse
 * the shipped es panel menus verbatim (`Fallos primero`,
 * `Herramienta enfocada`, `Agrupada`/`Plana`,
 * `Ascendente`/`Descendente`, timing view rows, streams
 * `Compacta`/`Ancha`). MINTS: status bar = `barra de estado`;
 * top bar = `barra superior`; footer = `pie de página` (panel.ts
 * quote); summary scope = `alcance` (debug-reach word, two-word law);
 * `chip` rides raw m. (cookies precedent).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Mostrar la versión en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Muestra el número de versión de la extensión en la barra de estado del panel de DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label':
    'Mostrar el selector de tema en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Muestra el desplegable de tema claro/oscuro/auto en la barra de estado del panel de DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label':
    'Mostrar el recuento de modificadas en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Muestra cuántas solicitudes modificaron realmente tus reglas en la barra de estado del panel de DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': 'Mostrar el recuento de fallidas en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Muestra cuántas solicitudes fallaron o devolvieron un estado de error en la barra de estado del panel de ' +
    'DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Mostrar el recuento de en caché en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Muestra cuántas solicitudes se sirvieron desde la caché en la barra de estado del panel de DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Mostrar la página actual en el pie de página',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Etiqueta los hitos de timing con la página que describen en la barra de estado del panel de DevTools — ' +
    'útil cuando el registro se conserva a lo largo de varias navegaciones.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Alcance del timing del pie de página',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Qué navegación describen los hitos Finish / DOMContentLoaded / Load de la barra de estado del panel de ' +
    'DevTools. Agregado abarca toda la cronología del registro conservado desde la primera navegación (como el ' +
    'navegador); Solo la página actual informa únicamente de la última navegación.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Agregado (todas las navegaciones)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load abarcan toda la cronología desde la primera navegación — el valor por defecto del ' +
    'navegador.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Solo la página actual',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load informan solo de la última navegación, anclados a su inicio.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Alcance del resumen del pie de página',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'Qué resume la barra de estado del panel de DevTools. Herramienta enfocada sigue la ventana de herramienta ' +
    'en la que trabajas (Storage, Console y la búsqueda tienen sus propias líneas de resumen); Solo la ' +
    'herramienta Network muestra siempre las cifras de Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Herramienta enfocada',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'El pie de página sigue la ventana de herramienta enfocada — Storage, Console y la búsqueda muestran sus ' +
    'propios resúmenes; las demás herramientas recaen en la línea de Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Solo la herramienta Network',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'El pie de página muestra siempre las cifras de Network, sea cual sea la ventana de herramienta enfocada.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label':
    'Mostrar los botones de paneles en la barra superior',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Muestra los iconos de alternancia de los paneles izquierdo / inferior / derecho en la barra superior del ' +
    'panel de DevTools.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label':
    'Mostrar el menú de disposición en la barra superior',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Muestra el menú de disposición (panel inferior a ancho completo, nombres de las ventanas de herramientas, ' +
    'disposición de la barra de actividad) en la barra superior del panel de DevTools.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Alineación del panel inferior',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Dónde se coloca el panel inferior en el panel de DevTools. Izquierda/derecha lo alinea bajo una barra ' +
    'lateral + el editor; centrado lo anida en la columna central; justificado abarca todo el ancho.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Centrado',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Panel inferior anidado en la columna central',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Izquierda',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'El panel inferior abarca la barra lateral izquierda + el editor',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Derecha',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'El panel inferior abarca el editor + la barra lateral derecha',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Justificado',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'El panel inferior abarca todo el ancho del panel de DevTools',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label':
    'Mostrar los nombres de las ventanas de herramientas',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Muestra etiquetas de texto junto a los iconos de la barra de actividad y de las pestañas de dock en el ' +
    'panel de DevTools. Desactivado por defecto porque el panel es más estrecho que el espacio de trabajo.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Ancho de la barra de actividad izquierda',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Ancho de la barra de actividad izquierda en el panel de DevTools cuando los nombres de las ventanas de ' +
    'herramientas están visibles. Bloqueado a 36px en modo solo iconos.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Ancho de la barra de actividad derecha',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Ancho de la barra de actividad derecha en el panel de DevTools cuando los nombres de las ventanas de ' +
    'herramientas están visibles. Bloqueado a 36px en modo solo iconos.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Disposición de la barra de actividad',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'Cómo reparte la barra de actividad los grupos de ventanas de herramientas superior e inferior en el panel ' +
    'de DevTools.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proporcional',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Los grupos superior e inferior se reparten la barra de actividad al 50/50',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Compacta',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'El grupo superior se ajusta al contenido; el inferior queda fijado abajo',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Apilada',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'Todos los grupos agrupados arriba con separadores entre ellos',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dinámica',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Los grupos de chips siguen las alturas de los paneles adyacentes. Los docks cerrados se pliegan al ' +
    'contenido y los vecinos activos absorben el espacio.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Disposición de Network',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Cómo absorbe la tabla Network el espacio horizontal. Compacta deja que las columnas extensibles (Name, ' +
    'Waterfall) se flexionen para caber en el ancho del panel, de modo que la tabla nunca se desplaza ' +
    'horizontalmente; Amplia limita esas columnas y se desplaza horizontalmente para el resto.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Compacta',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description':
    'Las columnas extensibles absorben el ancho del panel.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Amplia',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Anchos limitados, desplazamiento horizontal cuando hace falta.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Disposición de Messages',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Cómo absorbe la cuadrícula de frames de Messages el espacio horizontal. Compacta deja que la columna Data ' +
    'se flexione para caber en el ancho del panel, de modo que la cuadrícula nunca se desplaza horizontalmente; ' +
    'Ancha la limita y se desplaza horizontalmente cuando hace falta.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Compacta',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'La columna Data absorbe el ancho del panel.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Ancha',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Anchos limitados, desplazamiento horizontal cuando hace falta.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Mostrar la vista previa de la carga útil',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Muestra el panel de vista previa de la carga útil bajo las cuadrículas Messages / EventStream — la ' +
    'división redimensionable donde el frame o el evento seleccionado se representa como árbol JSON, texto sin ' +
    'procesar o visor binario. Desactívalo para darle todo el panel a la cuadrícula.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Fuente del orden de Network',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Qué lado del estado de orden está activo. `mode` ejecuta uno de los modos de orden compuestos con nombre ' +
    '(Fallos primero / Más lentas primero / …). `column` ejecuta el orden de una sola columna que el usuario ' +
    'eligió al hacer clic en un encabezado de columna. El panel cambia automáticamente — hacer clic en un ' +
    'encabezado de columna pone esto en `column`; elegir un modo en el menú Vista lo pone en `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Modo',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description':
    'Usar un modo de orden compuesto con nombre.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Columna',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Usar el orden de una sola columna en la que hizo clic el usuario.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Personalizado (anidado)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Usar la cadena de orden multiclave construida por el usuario.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Modo de orden de Network',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Orden compuesto con nombre — eje principal y llegada como desempate. Activo cuando la fuente del orden = ' +
    '`mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Fallos primero',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Fallidas → pendientes → redirigidas → correctas.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Más lentas primero',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'La duración más larga primero.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Más grandes primero',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description':
    'Los mayores bytes transferidos primero.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Prioridad del navegador',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Prioridad notificada de Highest → Lowest.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'Por tipo de recurso',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Agrupadas por tipo de recurso, llegada dentro de cada tipo.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'Por dominio',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    'Agrupadas por nombre de host, llegada dentro de cada dominio.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Modificadas por regla primero',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Reglas aplicadas primero, llegada dentro de cada grupo.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Columna de orden de Network',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Qué columna dirige el orden por clic de columna. Activo cuando la fuente del orden = `column`. Hacer clic ' +
    'en un encabezado de columna actualiza este valor.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Cronología según la métrica Waterfall activa (hora de inicio por defecto).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Número de solicitud — el orden en que se descubrieron las solicitudes.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'Método HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Último segmento de la URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Ruta + consulta.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'URL completa.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Código de estado de la respuesta.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'Versión de HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Parte de host de la URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'IP del servidor.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Tipo de recurso.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'Qué desencadenó la solicitud.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Número de cookies de la solicitud.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description':
    'Número de Set-Cookie de la respuesta.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Bytes transferidos.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Duración total de la solicitud.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Prioridad asignada por el navegador.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Sentido del orden de Network',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Orden ascendente o descendente para la columna de orden de Network actual.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Ascendente',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'El más bajo primero.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Descendente',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'El más alto primero.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Métrica de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Según qué tiempo ordena y dibuja la columna Waterfall. Start / Response / End time colocan las barras en ' +
    'una cronología absoluta; Total duration y Latency alinean las barras en cero para comparar las longitudes ' +
    'directamente.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'Cuándo empezó la solicitud.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'Cuándo llegó el primer byte de la respuesta.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'Cuándo terminó la solicitud.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'Cuánto tardó la solicitud de extremo a extremo.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'Tiempo hasta el primer byte de la respuesta.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Mostrar los puntos de disparo de reglas',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Muestra la columna inicial de 14px con el punto de color que marca las coincidencias de reglas (relleno = ' +
    'una regla se aplicó realmente, hueco = inferido). Desactívalo para recuperar los píxeles horizontales en ' +
    'paneles densos.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Valores de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'Cuándo imprimir en la barra el valor o los valores de la métrica Waterfall activa — el chip de Start / ' +
    'Response / End time para las métricas de cronología, o las etiquetas de espera / descarga para Total ' +
    'duration y Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Siempre',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description':
    'Mantener visible el chip de valor.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'Al pasar el cursor',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Revelar el chip de valor al pasar el cursor por la fila.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Desactivado',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Ocultar el chip de valor.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Formato del valor de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'Cómo se lee el valor de una métrica de cronología: Relativo es el desplazamiento desde la primera ' +
    'solicitud a la vista; Marca de tiempo es el instante absoluto de reloj. Total duration y Latency son ' +
    'siempre duraciones en cualquier caso.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relativo',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Desplazamiento desde la primera solicitud a la vista.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Marca de tiempo',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Instante absoluto de reloj.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label':
    'Zona horaria de las marcas de tiempo de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Zona horaria del formato de valor Marca de tiempo — hora local o UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Local',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Tu zona horaria local.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Tiempo universal coordinado.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Explicar el valor de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'En el popover al pasar el cursor por la Waterfall, señala con una insignia y resalta las filas de fase ' +
    'que componen el total y muestra su suma como fórmula. Ayuda puramente visual — no cambia ningún valor.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Disposición del popover de Waterfall',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Orientación del desglose de timing al pasar el cursor por la Waterfall. Compacto apila los pasos a lo ' +
    'largo del popover; Amplio coloca la misma escalera sobre un eje de tiempo; Auto elige según el ancho del ' +
    'panel — amplio en un panel anclado abajo, compacto en uno estrecho (anclado a un lado).',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Compacto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Pasos apilados a lo largo del popover.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Amplio',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Pasos colocados sobre un eje de tiempo horizontal.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Amplio cuando el panel es ancho; si no, compacto.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Disposición de Headers',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'Cómo se organizan las filas de encabezados dentro de las secciones de solicitud/respuesta. Agrupada ' +
    'agrupa las filas por categoría (Auth, CORS, Caching, …); Plana representa una sola lista en el orden ' +
    'elegido.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Agrupada',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Filas agrupadas por categoría.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Plana',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Lista única, sin títulos de categoría (al estilo de Chrome).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Orden de Headers',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Orden de las filas dentro de cada lista (y dentro de cada grupo, en disposición agrupada). Original ' +
    'conserva el orden en que el servidor envió los encabezados (orden HAR); A → Z ordena por nombre; ' +
    'Modificados por regla primero sube las filas modificadas por una regla.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'Orden HAR.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alfabético.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Modificados por regla primero',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description':
    'Filas modificadas por regla arriba.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Caja de los nombres de encabezados',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'Cómo se muestran los nombres de los encabezados. Train-Case canoniza cada nombre (`Content-Type`, ' +
    '`Set-Cookie`, `ETag`) para coincidir con las DevTools de Chrome/Firefox — más fácil de escanear. Original ' +
    'conserva la caja sin procesar que envió el servidor (HTTP/2+ pone todo en minúsculas en la red).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Exactamente lo que envió el servidor (a menudo en minúsculas en HTTP/2+).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Mostrar las etiquetas de valor',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Muestra las etiquetas por valor en las filas de encabezados (Cache-Control / Set-Cookie / HSTS / ' +
    'decodificación JWT, …). Desactívalo para una vista ajustada, solo valores.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Mostrar las sugerencias',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Muestra las tarjetas de aviso accionables en la parte superior de la pestaña Headers (CORS mal ' +
    'configurado, CSP/HSTS ausentes, cookies no seguras, JWT caducado, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Ocultar los encabezados de ruido',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Pliega los encabezados de poca señal (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). La ' +
    'pista bajo cada sección lista los nombres ocultos al pasar el cursor.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Solo modificados por regla',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Muestra solo los encabezados añadidos, modificados o eliminados por una regla de Open Headers.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Solo encabezados de seguridad',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Muestra solo los encabezados relacionados con la seguridad (CSP, HSTS, X-Frame-Options, ' +
    'Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Solo encabezados sustituibles',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Oculta los encabezados protegidos que el navegador no deja sustituir a las reglas (host, content-length, ' +
    'sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Orden de los hijos de Initiator',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'Cómo se ordenan las solicitudes hijas dentro de la cadena de iniciadores. Orden de iniciador conserva el ' +
    'recorrido original del grafo de iniciadores; Cronológico ordena por hora de solicitud; Subárbol más ' +
    'grande coloca primero el subárbol más pesado.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Orden de iniciador',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'Tal como se descubrieron.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Cronológico',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'Por hora de solicitud.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Subárbol más grande',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Los subárboles más pesados primero.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Mostrar las sugerencias',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Muestra los avisos accionables en la parte superior de la pestaña Initiator (subsolicitudes fallidas, ' +
    'host dominante, cuota de terceros, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Solo fallos',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Muestra solo las filas fallidas o bloqueadas en la cadena de iniciadores.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'Solo terceros',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Muestra solo las filas de orígenes distintos del origen de la página.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Orden de Cookies',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Orden de las filas dentro de cada sección de cookies. Original conserva el orden que usaron el servidor / ' +
    'la solicitud; A → Z ordena por nombre; Size ordena por tamaño de cookie serializada; Expires coloca ' +
    'primero las que caducan antes (Session al final).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'Tal como se enviaron / definieron.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alfabético por nombre.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'La cookie más grande primero.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'La caducidad más próxima primero.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Formato de Expires',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Cómo se representa la caducidad de las cookies. Relativo muestra «dentro de 2 d», «hace 30 s», «Session»; ' +
    'Absoluto muestra la fecha UTC analizada.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relativo',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absoluto',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'Fecha UTC.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Mostrar las etiquetas',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Muestra las etiquetas de rol / ciclo de vida / contexto junto a cada nombre de cookie (¿auth? / ' +
    '¿rastreo? / pref / recién definida / rechazada / terceros / particionada / …). Desactívalo para una ' +
    'vista ajustada, solo columnas.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Mostrar las sugerencias',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Muestra las tarjetas de aviso accionables en la parte superior de la pestaña Cookies (SameSite=None sin ' +
    'Secure, violaciones de prefijo __Host- / __Secure-, cookies demasiado grandes, caducadas pero enviadas, ' +
    '…).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Decodificar los valores con codificación URL',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Muestra los valores de cookies con la codificación de porcentaje decodificada («Europe%2FMadrid» → ' +
    '«Europe/Madrid»). Pasa el cursor por el valor para ver la forma sin procesar.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Agrupar por rol',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Agrupa las cookies por su rol inferido dentro de cada sección — Auth y sesión primero, luego ' +
    'Funcionales, Preferencias, Analítica y rastreo. Guiado por heurística; los chips de rol (¿auth? / ' +
    '¿rastreo? / pref) llevan el signo de interrogación como recordatorio.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Mostrar las cookies de solicitud filtradas',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Refleja el interruptor «show filtered out request cookies» de Chrome — lista también las cookies del ' +
    'tarro que no se enviaron en esta solicitud por no coincidir la ruta / Secure / SameSite / caducidad.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Solo problemas',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Muestra solo las cookies que activaron un aviso — Secure ausente, violación de prefijo, caducada pero ' +
    'enviada, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'Solo terceros',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Muestra solo las cookies cuyo dominio es cross-site respecto al origen del marco superior.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Solo modificadas por regla',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Muestra solo las cookies cuya línea Cookie / Set-Cookie fue añadida, modificada o eliminada por una regla.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Mostrar las sugerencias',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Muestra las tarjetas de cuello de botella + avisos por fase en la parte superior de la pestaña Timing. ' +
    'Desactívalo para una vista de solo cifras.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Mostrar la banda de contexto',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Muestra la fila de chips protocolo / conexión / caché / prioridad / inicio / IP del servidor encima del ' +
    'desglose de fases.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Mostrar el desglose de fases',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Muestra las secciones Resource Scheduling / Connection Start / Request-Response con las filas de ' +
    'milisegundos por fase.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Mostrar la barra de timing',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Muestra la barra segmentada proporcional con la leyenda por fase (y la fila Total debajo).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Mostrar Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Muestra las métricas analizadas del encabezado de respuesta `Server-Timing` cuando el servidor envió ' + 'alguna.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Mostrar las repeticiones de la sesión',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Muestra la comparación con la visita más rápida / mediana / más lenta de esta misma URL dentro de la ' +
    'sesión de panel actual.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Mostrar la tasa de transferencia',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Muestra el rendimiento efectivo de Content-Download (bytes del cuerpo ÷ tiempo de descarga) cuando se ' +
    'conocen tanto el tamaño como el tramo de recepción.',
} as const satisfies Catalog;
