/**
 * DevTools panel — shell chrome — Spanish. Mirrors `catalogs/en/panel.ts`
 * key for key; resource-type pills, throttle tier names, CDP method
 * names, header names, event names (Finish / DOMContentLoaded / Load),
 * keyboard chords, units (kB / kbit/s / ms) and the Aa / ab / .* / ▾ / ✓
 * glyphs stay raw. Mints: log = `registro`; throttling = `limitación de
 * red`; preset = `preajuste`; System overrides = `Sustituciones del
 * sistema` (quotes the S61 `sustitución` mint); layout rides the S61
 * `disposición`; sanitized = `saneado`; evidence chips = `fehaciente` /
 * `contradicha` / `corroborada` / `inferida` / `indirecta` (popup
 * parity) / `silenciosa`; Off-HAR = `fuera de HAR`; hit = `disparo`
 * (popup fire mint); Enter key = `Intro`; Raw = `sin procesar`
 * (shared-components precedent); `timing` rides raw with the fr
 * precedent.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Grabar el registro de red',
  'panel.toolbar.stopRecording': 'Detener la grabación',
  'panel.toolbar.clear': 'Limpiar el registro de red',
  'panel.toolbar.filter': 'Filtrar',
  'panel.toolbar.search': 'Buscar',
  'panel.toolbar.preserveLog': 'Conservar el registro',
  'panel.toolbar.preserveLogTitle':
    'Mantiene las solicitudes a través de las navegaciones de página. Desactivado, la lista se vacía en cada ' +
    'navegación o recarga, como el panel Network del propio navegador.',
  'panel.toolbar.aboutPreserveLog': 'Acerca de Conservar el registro',
  'panel.toolbar.aboutMoreFilters': 'Acerca de los filtros adicionales',
  'panel.toolbar.aboutFooterView': 'Acerca de la vista del pie de página',
  'panel.toolbar.moreTools': 'Más herramientas',
  'panel.toolbar.activeWorkspaceAria': 'Espacio de trabajo activo: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Barra lateral izquierda',
  'panel.toolbar.bottomPanel': 'Panel inferior',
  'panel.toolbar.rightSidebar': 'Barra lateral derecha',
  'panel.toolbar.chooseBottomAlignment': 'Elegir la alineación del panel inferior',
  'panel.toolbar.layoutOptions': 'Opciones de disposición',
  'panel.toolbar.bottomAlignTooltip.center': 'Panel inferior: centrado (anidado)',
  'panel.toolbar.bottomAlignTooltip.left': 'Panel inferior: alineado a la izquierda',
  'panel.toolbar.bottomAlignTooltip.right': 'Panel inferior: alineado a la derecha',
  'panel.toolbar.bottomAlignTooltip.justify': 'Panel inferior: ancho completo',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomAlignment': 'Alineación del panel inferior',
  'panel.layout.alignCenter': 'Centrado (anidado)',
  'panel.layout.alignLeft': 'Izquierda',
  'panel.layout.alignRight': 'Derecha',
  'panel.layout.alignJustify': 'Justificado (ancho completo)',
  'panel.layout.showToolWindowNames': 'Mostrar los nombres de las ventanas de herramientas',
  'panel.layout.activityBarLayout': 'Disposición de la barra de actividad',
  'panel.layout.sidebarProportional': 'Proporcional (mitades iguales)',
  'panel.layout.sidebarCompact': 'Compacta (abajo fijado)',
  'panel.layout.sidebarStacked': 'Apilada (todo arriba)',
  'panel.layout.sidebarDynamic': 'Dinámica (sigue las alturas de los paneles)',
  'panel.layout.defaultLayoutDonor': '{unit} de disposición predeterminada',
  'panel.layout.inheritsDefault': 'Hereda la disposición predeterminada',
  'panel.layout.donorTooltip': 'Este {unit} es el predeterminado — los nuevos {units} heredan esta disposición.',
  'panel.layout.nonDonorTooltip': 'Otro {unit} es el predeterminado — los nuevos {units} heredan de allí.',
  'panel.layout.resetToDefaults': 'Restablecer la disposición predeterminada',
  'panel.layout.restoreHidden': 'Restaurar las herramientas ocultas de la barra de actividad',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Filtrar',
  'panel.filter.clear': 'Borrar',
  'panel.filter.clearAria': 'Borrar el filtro',
  'panel.filter.matchCase': 'Distinguir mayúsculas y minúsculas (Alt+C)',
  'panel.filter.wholeWord': 'Palabra completa (Alt+W)',
  'panel.filter.regex': 'Usar expresión regular (Alt+R)',
  'panel.filter.more': 'Más',
  'panel.filter.hiddenClearFilter': 'Borrar el filtro',
  'panel.filter.hiddenDismiss': 'Descartar',

  'panel.menu.resetToDefault': 'Restablecer los valores predeterminados',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'Filtros adicionales',
  'panel.moreFilters.hideDataUrls': 'Ocultar las URL data',
  'panel.moreFilters.hideExtensionUrls': 'Ocultar las URL de extensión',
  'panel.moreFilters.blockedRequests': 'Solicitudes bloqueadas',
  'panel.moreFilters.thirdParty': 'Solicitudes de terceros',
  'panel.moreFilters.swRequests': 'Solicitudes de service worker',
  'panel.moreFilters.ruleApplied': 'Solicitudes modificadas por una regla',
  'panel.moreFilters.pageOriginPending': 'El origen de la página aún no está disponible',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Vista del pie de página',
  'panel.view.title': 'Elegir qué estadísticas muestra el pie de página',
  'panel.view.focusedTool': 'Herramienta enfocada',
  'panel.view.focusedToolTitle':
    'El pie de página sigue la ventana de herramienta enfocada — Storage, Console y la búsqueda muestran sus ' +
    'propios resúmenes; las demás herramientas recurren a la línea Network.',
  'panel.view.networkOnly': 'Solo la herramienta Network',
  'panel.view.networkOnlyTitle':
    'El pie de página muestra siempre las cifras de Network, sea cual sea la ventana de herramienta enfocada.',
  'panel.view.modifiedCount': 'Recuento de modificadas',
  'panel.view.failedCount': 'Recuento de fallidas',
  'panel.view.cachedCount': 'Recuento de en caché',
  'panel.view.pageLabel': 'Etiqueta de la página actual',
  'panel.view.pageLabelTitle':
    'Cuando el registro abarca más de una navegación, nombra la página que describen los hitos de timing.',
  'panel.view.timingAllNavs': 'Timing en todas las navegaciones',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load abarcan toda la cronología del registro conservado desde la primera ' +
    'navegación (el valor predeterminado del navegador). Desmarca para informar solo de la última navegación.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Exportar el tráfico',
  'panel.export.exportAll': 'Exportar todo como HAR',
  'panel.export.exportAllSanitized': 'Exportar todo como HAR (saneado)',
  'panel.export.copyAll': 'Copiar todo como HAR',
  'panel.export.copyAllSanitized': 'Copiar todo como HAR (saneado)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Desactivar caché',
  'panel.cache.tooltipDebug':
    'Caché desactivada a nivel de la pila de red (modo de depuración) — equivale al Disable cache nativo del ' +
    'navegador.',
  'panel.cache.tooltipStandard':
    'Elude la caché HTTP forzando la revalidación. Activa el modo de depuración para una desactivación ' +
    'completa de la pila de red (también la caché en memoria).',
  'panel.cache.aboutAria': 'Acerca de Desactivar caché',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'Sin limitación',
  'panel.throttle.custom': 'Personalizada',
  'panel.throttle.customEllipsis': 'Personalizada…',
  'panel.throttle.customHint': 'Define descarga, subida y latencia.',
  'panel.throttle.customTitle': 'Limitación personalizada',
  'panel.throttle.download': 'Descarga',
  'panel.throttle.upload': 'Subida',
  'panel.throttle.latency': 'Latencia',
  'panel.throttle.appliesToTab': 'Se aplica a esta pestaña',
  'panel.throttle.morePresets': 'Más preajustes',
  'panel.throttle.morePresetsSubtitle': 'Fibra, cable, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Por cable',
  'panel.throttle.mobile': 'Móvil',
  'panel.throttle.disabledTooltip':
    'La limitación de red solo está disponible en modo de depuración. Activa el modo de depuración para ' +
    'limitar esta pestaña.',
  'panel.throttle.aboutAria': 'Acerca de la limitación de red',
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 2 ms de latencia',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 8 ms de latencia',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 25 ms de latencia',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 8 ms de latencia',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 18 ms de latencia',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 165 ms de latencia',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 562.5 ms de latencia',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 2000 ms de latencia',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 2000 ms de latencia',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 3000 ms de latencia',
  'panel.throttle.subtitle.offline': 'Bloquea todo el tráfico de red de la pestaña.',

  'panel.debug.apply': 'Aplicar',
  'panel.debug.enableDebugMode': 'Activar el modo de depuración',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Sustituciones',
  'panel.overrides.disabledTooltip':
    'Las sustituciones del sistema solo están disponibles en modo de depuración. Activa el modo de depuración ' +
    'para sustituir esta pestaña.',
  'panel.overrides.aboutAria': 'Acerca de las sustituciones del sistema',
  'panel.overrides.wireHint':
    'Se envían en las solicitudes y se comunican a los scripts de página mientras esta pestaña siga en modo ' +
    'de depuración.',
  'panel.overrides.pageOnlyHint':
    'Solo la página — cambian lo que observan los scripts y el CSS de la propia página, no las solicitudes.',
  'panel.overrides.platform': 'Plataforma',
  'panel.overrides.locale': 'Locale',
  'panel.overrides.timezone': 'Zona horaria',
  'panel.overrides.colorScheme': 'Esquema de color',
  'panel.overrides.reducedMotion': 'Movimiento reducido',
  'panel.overrides.printMedia': 'Medio de impresión',
  'panel.overrides.uaPlaceholder': 'Cadena User-Agent personalizada',
  'panel.overrides.alPlaceholder': 'p. ej. fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, p. ej. Linux',
  'panel.overrides.localePlaceholder': 'Locale real',
  'panel.overrides.timezonePlaceholder': 'Zona horaria real',
  'panel.overrides.auto': 'Auto',
  'panel.overrides.light': 'Claro',
  'panel.overrides.dark': 'Oscuro',
  'panel.overrides.reduce': 'Reducir',
  'panel.overrides.noPref': 'Sin pref.',
  'panel.overrides.screen': 'Pantalla',
  'panel.overrides.print': 'Impresión',
  'panel.overrides.resetAll': 'Restablecer todo',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Conserva las solicitudes grabadas a través de navegaciones y recargas en lugar de vaciar la lista cada ' +
    'vez que cambia la página.',
  'panel.info.preserveLog.description':
    'Activado — el registro sobrevive a cada navegación: las solicitudes emitidas justo antes de una ' +
    'redirección, un envío de formulario o una recarga siguen visibles. Desactivado — la lista se vacía en ' +
    'cada navegación o recarga, como el panel Network del propio navegador, y muestra solo el tráfico de la ' +
    'página actual.',
  'panel.info.preserveLog.whenHeading': 'Úsalo para',
  'panel.info.preserveLog.redirects': 'Redirecciones',
  'panel.info.preserveLog.redirectsDesc':
    'Inspeccionar la solicitud que desencadenó una navegación antes de que la página nueva la borre.',
  'panel.info.preserveLog.forms': 'Envíos de formularios / inicios de sesión',
  'panel.info.preserveLog.formsDesc': 'Mantener visibles un POST y su respuesta después de que la página se recargue.',
  'panel.info.preserveLog.reloadLoops': 'Bucles de recarga',
  'panel.info.preserveLog.reloadLoopsDesc': 'Ver qué se emitió justo antes de que la página se recargara sola.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Filtros de solicitudes secundarios guardados tras un menú — cada uno acota la lista sin ocupar espacio ' +
    'de primer nivel en la barra de herramientas.',
  'panel.info.moreFilters.hideHeading': 'Ocultar',
  'panel.info.moreFilters.dataUrls': 'URL data',
  'panel.info.moreFilters.dataUrlsDesc': 'Excluir los recursos data: en línea — imágenes base64, fuentes y similares.',
  'panel.info.moreFilters.extensionUrls': 'URL de extensión',
  'panel.info.moreFilters.extensionUrlsDesc': 'Excluir las solicitudes a orígenes de extensiones del navegador.',
  'panel.info.moreFilters.onlyHeading': 'Mostrar solo',
  'panel.info.moreFilters.blocked': 'Solicitudes bloqueadas',
  'panel.info.moreFilters.blockedDesc': 'Restringir la lista a las solicitudes que una regla bloqueó.',
  'panel.info.moreFilters.thirdParty': 'Solicitudes de terceros',
  'panel.info.moreFilters.thirdPartyDesc': 'Restringir a las solicitudes cuyo origen difiere del de la página.',
  'panel.info.moreFilters.swRequests': 'Solicitudes de service worker',
  'panel.info.moreFilters.swRequestsDesc':
    'Restringir a los intercambios de service worker — las solicitudes que el worker emitió por sí mismo ' +
    '(filas ⚙) y las solicitudes de página que respondió su manejador fetch.',
  'panel.info.moreFilters.ruleApplied': 'Solicitudes modificadas por una regla',
  'panel.info.moreFilters.ruleAppliedDesc':
    'Restringir a las solicitudes que una regla de Open Headers modificó de forma verificable.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Elige qué estadísticas opcionales muestra el pie de página, junto a los recuentos de solicitudes y ' +
    'transferencia siempre visibles.',
  'panel.info.view.scopeHeading': 'Alcance del resumen',
  'panel.info.view.focusedTool': 'Herramienta enfocada',
  'panel.info.view.focusedToolDesc':
    'El pie de página sigue la ventana de herramienta enfocada — Storage, Console y la búsqueda muestran sus ' +
    'propias líneas de resumen; las demás herramientas recurren a la línea Network.',
  'panel.info.view.networkOnly': 'Solo la herramienta Network',
  'panel.info.view.networkOnlyDesc':
    'El pie de página muestra siempre las cifras de Network, sea cual sea la ventana de herramienta enfocada.',
  'panel.info.view.countsHeading': 'Recuentos del pie de página',
  'panel.info.view.modified': 'Modificadas',
  'panel.info.view.modifiedDesc': 'Cuántas solicitudes cambió una regla.',
  'panel.info.view.failed': 'Fallidas',
  'panel.info.view.failedDesc': 'Cuántas solicitudes fallaron o fueron bloqueadas.',
  'panel.info.view.cached': 'En caché',
  'panel.info.view.cachedDesc': 'Cuántas respuestas se sirvieron desde la caché.',
  'panel.info.view.timingHeading': 'Timing',
  'panel.info.view.pageLabel': 'Etiqueta de la página actual',
  'panel.info.view.pageLabelDesc':
    'Nombra la página que describen los hitos de timing cuando el registro abarca más de una navegación.',
  'panel.info.view.allNavs': 'En todas las navegaciones',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load abarcan toda la cronología del registro conservado, no solo la última ' +
    'navegación.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Impide que esta pestaña sirva respuestas desde la caché.',
  'panel.info.cache.debugDesc':
    'Esta pestaña está en modo de depuración: la caché está desactivada a nivel de la pila de red — también ' +
    'la caché en memoria — igual que el Disable cache nativo del navegador.',
  'panel.info.cache.standardDesc':
    'Esta pestaña está en modo estándar: solo se elude la caché HTTP, pidiendo al servidor que revalide. ' +
    'Activa el modo de depuración para una desactivación completa de la pila de red que también vacía la ' +
    'caché en memoria.',
  'panel.info.cache.standardHeading': 'Modo estándar',
  'panel.info.cache.revalidateDesc':
    'Se añade a cada solicitud para que el servidor recompruebe la frescura. Solo elude la caché HTTP.',
  'panel.info.cache.debugHeading': 'Modo de depuración',
  'panel.info.cache.cdpDesc':
    'Desactiva la caché para toda la pestaña a nivel de la pila de red, incluida la caché en memoria.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'Sustituciones del sistema',
  'panel.info.overrides.summary':
    'Fija la identidad de sistema de esta pestaña — User-Agent, locale, zona horaria y medios emulados — ' +
    'para ver cómo responde un sitio a un cliente distinto.',
  'panel.info.overrides.debugDesc':
    'Activas en esta pestaña a través del modo de depuración. Las facetas de User-Agent se aplican a las ' +
    'solicitudes y a los scripts de página; locale, zona horaria y medios solo cambian lo que observan los ' +
    'scripts y el CSS de la propia página. Restablecer todo restaura los valores reales.',
  'panel.info.overrides.standardDesc':
    'Las sustituciones del sistema requieren el modo de depuración — no hay alternativa en modo estándar. ' +
    'Activa el modo de depuración y mantén esta pestaña dentro del alcance para sustituirla.',
  'panel.info.overrides.wireHeading': 'En la red + scripts de página',
  'panel.info.overrides.uaDesc':
    'Establece los encabezados User-Agent / Accept-Language, la plataforma y los valores navigator.* ' +
    'correspondientes.',
  'panel.info.overrides.pageHeading': 'Solo la página',
  'panel.info.overrides.localeDesc': 'Cambia la locale que leen los scripts de página.',
  'panel.info.overrides.timezoneDesc': 'Cambia la zona horaria a la que se resuelven Date e Intl.',
  'panel.info.overrides.mediaDesc': 'Fuerza las media queries de color-scheme / reduced-motion / print.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Limitación de red',
  'panel.info.throttle.summary':
    'Simula conexiones más lentas limitando el ancho de banda de esta pestaña y añadiendo latencia.',
  'panel.info.throttle.debugDesc':
    'Activa en esta pestaña a través del modo de depuración. Elige un preajuste — los predeterminados más ' +
    'fibra / cable / DSL y 5G / 2G bajo Más preajustes — pasa a modo sin conexión, o define descarga / ' +
    'subida / latencia personalizadas.',
  'panel.info.throttle.standardDesc':
    'La limitación requiere el modo de depuración — no hay alternativa en modo estándar. Activa el modo de ' +
    'depuración y mantén esta pestaña dentro del alcance para limitarla.',
  'panel.info.throttle.presetsHeading': 'Preajustes',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s de bajada, 165 ms de latencia.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s de bajada, 562.5 ms de latencia.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, 2000 ms de latencia.',
  'panel.info.throttle.offlineDesc': 'Bloquea todo el tráfico de red de la pestaña.',
  'panel.info.throttle.wiredHeading': 'Más preajustes · Por cable',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, 2 ms de latencia.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s de bajada, 8 ms de latencia.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s de bajada, 25 ms de latencia.',
  'panel.info.throttle.mobileHeading': 'Más preajustes · Móvil',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s de bajada, 8 ms de latencia.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s de bajada, 18 ms de latencia.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, 2000 ms de latencia.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, 3000 ms de latencia.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud',
      many: '{count} solicitudes',
      other: '{count} solicitudes',
    }),
  'panel.status.requestsSubset': '{subset} / {total} solicitudes',
  'panel.status.modified': '{count} modificadas',
  'panel.status.modifiedTitle': 'Solicitudes que tus reglas modificaron',
  'panel.status.failed': '{count} fallidas',
  'panel.status.failedTitle': 'Solicitudes fallidas o con estado de error',
  'panel.status.cached': '{count} en caché',
  'panel.status.cachedTitle': 'Solicitudes servidas desde la caché',
  'panel.status.transferredOnly': '{size} transferidos',
  'panel.status.transferredAndResources': '{transferred} transferidos / {resources} recursos',
  'panel.status.transferredSubset': '{subset} / {total} transferidos',
  'panel.status.resourcesSubset': '{subset} / {total} recursos',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Evento Load',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} pestaña', many: '{count} pestañas', other: '{count} pestañas' }),
  'panel.status.messagesOf': '{visible} de {total} mensajes',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} mensaje', many: '{count} mensajes', other: '{count} mensajes' }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', many: '{count} errores', other: '{count} errores' }),
  'panel.status.errorsTitle': 'Mensajes de consola de nivel de error',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} advertencia',
      many: '{count} advertencias',
      other: '{count} advertencias',
    }),
  'panel.status.warningsTitle': 'Mensajes de consola de nivel de advertencia',
  'panel.status.systemStatus': 'Sistema',
  'panel.status.theme.light': 'Claro',
  'panel.status.theme.dark': 'Oscuro',
  'panel.status.theme.auto': 'Auto',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Búsqueda',
  'panel.toolWindows.notifications': 'Notificaciones',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Actividad de reglas',
  'panel.toolWindows.matchedRules': 'Reglas coincidentes',

  // ── Search tool window (station: search family) ─────────────────────
  'panel.search.placeholder': 'Buscar (pulsa Intro)',
  'panel.search.inputAria': 'Buscar en los datos capturados',
  'panel.search.syntaxHelp': 'Ayuda de sintaxis de búsqueda',
  'panel.search.run': 'Buscar',
  'panel.search.runTitle': 'Ejecutar la búsqueda (Intro)',
  'panel.search.cancel': 'Cancelar',
  'panel.search.cancelTitle': 'Cancelar la búsqueda',
  'panel.search.idleHintMin': 'Escribe una consulta (mín. 2 caracteres) y pulsa Intro para buscar.',
  'panel.search.idleHintShort': 'Pulsa Intro para buscar.',
  'panel.search.noMatches': 'No se encontraron coincidencias.',

  'panel.search.status.searching': 'Buscando… {done} / {total}',
  'panel.search.status.noResults': 'Sin resultados · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), {
      one: 'Se encontró {count} coincidencia',
      many: 'Se encontraron {count} coincidencias',
      other: 'Se encontraron {count} coincidencias',
    });
    const where = plural(locale, Number(files), {
      one: '{count} archivo',
      many: '{count} archivos',
      other: '{count} archivos',
    });
    return `${found} en ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'se muestran las primeras {shown} — afina la consulta para ver el resto',

  'panel.search.group.countTitle': '{count} coincidencias en este archivo',
  'panel.search.group.countTitleCapped': '{count} coincidencias en este archivo — se muestran las primeras {shown}',
  'panel.search.row.lineCol': 'Línea {line}, col. {col}',
  'panel.search.row.line': 'Línea {line}',
  'panel.search.row.matchesOnLine': '{count} coincidencias en esta línea',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  'panel.matchedRules.selectPrompt.lead': 'Selecciona una solicitud para ver las',
  'panel.matchedRules.selectPrompt.tail': 'reglas que se le aplican',
  'panel.matchedRules.matchedCount': 'Coincidentes · {count}',
  'panel.matchedRules.futureCount': 'Coincidencias futuras · {count}',
  'panel.matchedRules.noMatched': 'Ninguna regla coincidió con esta solicitud.',
  'panel.matchedRules.noFuture': 'Ninguna otra regla coincidiría con esta solicitud.',
  'panel.matchedRules.pattern': 'Patrón: {pattern}',
  'panel.matchedRules.wouldMatch': 'coincidiría',

  'panel.matchedRules.evidence.contradicted': 'contradicha',
  'panel.matchedRules.evidence.authoritative': 'fehaciente',
  'panel.matchedRules.evidence.confirmed': 'confirmada',
  'panel.matchedRules.evidence.fallback': 'indirecta',
  'panel.matchedRules.evidence.silent': 'silenciosa',
  'panel.matchedRules.evidence.corroborated': 'corroborada',
  'panel.matchedRules.evidence.inferred': 'inferida',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Contradicha — los encabezados capturados refutan una modificación que esta regla afirmaba.',
  'panel.matchedRules.evidenceTitle.authoritative':
    'Fehaciente — el motor de reglas confirmó que esta regla DNR se ejecutó sobre la solicitud.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Confirmada — la regla modificó el cuerpo en el contexto de la página y ambas versiones (servida y ' +
    'original) se capturaron para esta solicitud.',
  'panel.matchedRules.evidenceTitle.confirmed':
    'Confirmada por el reportero en la página — la acción scriptable se ejecutó dentro de la página.',
  'panel.matchedRules.evidenceTitle.fallback':
    'Inferida de la coincidencia de URL — se esperaba una confirmación scriptable pero no llegó.',
  'panel.matchedRules.evidenceTitle.silent':
    'El patrón coincidió pero la solicitud se sirvió desde la caché / un service worker — no se ejecutó ' +
    'ninguna acción DNR ni scriptable.',
  'panel.matchedRules.evidenceTitle.corroborated':
    'Corroborada — la modificación afirmada es visible en los encabezados capturados.',
  'panel.matchedRules.evidenceTitle.inferred':
    'Inferida de la coincidencia de URL — la regla coincidiría con esta solicitud según sus condiciones.',
  'panel.matchedRules.contradiction.stillPresent': '{header} sigue presente ({observed}).',
  'panel.matchedRules.contradiction.missing': '{header} falta en los encabezados capturados.',
  'panel.matchedRules.contradiction.otherValue': '{header} lleva «{observed}» en lugar del valor afirmado.',

  'panel.matchedRules.ruleState.deleted': 'regla eliminada',
  'panel.matchedRules.ruleState.disabled': 'regla desactivada',
  'panel.matchedRules.ruleState.modified': 'regla modificada',
  'panel.matchedRules.ruleStateTitle.deleted':
    'Esta regla se eliminó después de dispararse. La fila muestra lo que hizo en el momento del disparo.',
  'panel.matchedRules.ruleStateTitle.disabled':
    'Esta regla se desactivó después de dispararse — no se aplicará a la próxima solicitud.',
  'panel.matchedRules.ruleStateTitle.modified':
    'Esta regla se editó después de dispararse. La fila muestra lo que hizo en el momento del disparo; pasa ' +
    'el cursor para ver la regla actual.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'Aún no hay actividad de reglas en esta pestaña.',
  'panel.ruleActivity.toolbarHint': 'Actividad de reglas agrupada por regla.',
  'panel.ruleActivity.hint.applied': 'Aplicados',
  'panel.ruleActivity.hint.appliedDesc':
    '— disparos confirmados: el motor de reglas informó de la ejecución de la regla, el reportero en la ' +
    'página confirmó la acción, o la modificación es visible en los encabezados capturados.',
  'panel.ruleActivity.hint.contradicted': 'Contradichos',
  'panel.ruleActivity.hint.contradictedDesc':
    '— disparos que afirmaban un cambio de encabezado que los encabezados capturados refutan.',
  'panel.ruleActivity.hint.inferred': 'Inferidos',
  'panel.ruleActivity.hint.inferredDesc':
    '— disparos en los que tus patrones de regla coinciden con las solicitudes observadas sin confirmación ' +
    'posible.',
  'panel.ruleActivity.hint.offHar': 'Fuera de HAR',
  'panel.ruleActivity.hint.offHarDesc': '— disparos sobre solicitudes que el panel no capturó.',
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} disparo', many: '{count} disparos', other: '{count} disparos' }),
  'panel.ruleActivity.applied': '{count} aplicados',
  'panel.ruleActivity.contradicted': '{count} contradichos',
  'panel.ruleActivity.offHar': '{count} fuera de HAR',
  'panel.ruleActivity.offHarTitle': 'Fuera de HAR — el panel no capturó una envoltura HAR para este disparo',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  'panel.valueDoc.crumbFallback': 'Reglas',
  'panel.valueDoc.saveHint': 'Recodificar el valor editado y escribirlo de vuelta en la regla',
  'panel.valueDoc.blockedHintInvalid': 'El texto editado no se puede codificar para este tipo de valor',
  'panel.valueDoc.blockedHintDetached': 'El campo de regla al que pertenecía este valor ya no existe',
  'panel.valueDoc.rereadTitle': 'Releer el valor desde la regla',
  'panel.valueDoc.rereadConfirm': 'Descarta tus ediciones — haz clic de nuevo para releer',
  'panel.valueDoc.rereadAria': 'Descartar las ediciones y releer el valor',
  'panel.valueDoc.openRuleTitle': 'Abrir esta regla en el editor del espacio de trabajo',
  'panel.valueDoc.openRule': 'Abrir la regla en el espacio de trabajo',
  'panel.valueDoc.driftNote':
    'El valor cambió en la regla mientras editabas — tus ediciones sin guardar se conservan. Guardar lo ' +
    'sobrescribirá.',
  'panel.valueDoc.undetectedNote':
    'El campo ya no contiene un valor que este editor pueda codificar — tus ediciones sin guardar se ' +
    'conservan para copiarlas.',
  'panel.valueDoc.detachedNote':
    'El campo de regla al que pertenecía este valor ya no existe — tus ediciones sin guardar se conservan ' +
    'para copiarlas.',
  'panel.valueDoc.discardEdits': 'Descartar mis ediciones',
  'panel.valueDoc.saveFailed.detached':
    'La modificación a la que pertenecía este valor ya no está en la regla — no hay dónde escribir.',
  'panel.valueDoc.saveFailed.notFound': 'Regla no encontrada — puede que se haya eliminado.',
  'panel.valueDoc.saveFailed.write': 'No se pudo guardar — la regla rechazó la escritura.',
  'panel.valueDoc.encodedPreview': 'Vista previa codificada',
  'panel.valueDoc.cannotEncode': 'No se puede codificar — el valor editado no es válido para este tipo',
  'panel.valueDoc.undetectedTitle': 'Ya no es un valor codificado',
  'panel.valueDoc.undetectedSub':
    'El valor actual del campo no corresponde a ningún decodificador — edítalo mejor en el editor de reglas.',
  'panel.valueDoc.detachedTitle': 'El valor ya no está en la regla',
  'panel.valueDoc.detachedSub':
    'La regla o la modificación que contenía este valor se eliminó, o la operación ya no lleva un valor.',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  'panel.valueView.snapshotNote': 'Instantánea',
  'panel.valueView.snapshotTitle': 'Capturada al abrir este documento — no sigue los cambios posteriores.',
  'panel.valueView.encodedValue': 'Valor codificado',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  'panel.ruleDoc.crumbKind': 'Sustitución de respuesta',
  'panel.ruleDoc.nameLabel': 'Nombre de la regla',
  'panel.ruleDoc.saveHint': 'Guardar la regla de sustitución — permanece publicada en el mismo paso',
  'panel.ruleDoc.saveHintCreate': 'Crear la regla y publicarla',
  'panel.ruleDoc.blockedHintDetached': 'La regla a la que pertenecía este documento ya no existe',
  'panel.ruleDoc.rereadTitle': 'Releer la regla',
  'panel.ruleDoc.rereadConfirm': 'Descarta tus ediciones — haz clic de nuevo para releer',
  'panel.ruleDoc.rereadAria': 'Descartar las ediciones y releer la regla',
  'panel.ruleDoc.openRuleTitle': 'Abrir esta regla en el editor del espacio de trabajo',
  'panel.ruleDoc.openRule': 'Abrir en el espacio de trabajo',
  'panel.ruleDoc.saveFailed.notFound': 'Regla no encontrada — puede que se haya eliminado.',
  'panel.ruleDoc.saveFailed.write': 'No se pudo guardar — la regla rechazó la escritura.',
  'panel.ruleDoc.detachedTitle': 'La regla ya no existe',
  'panel.ruleDoc.detachedSub': 'La regla de sustitución que este documento editaba se eliminó.',
  'panel.ruleDoc.dynamicTitle': 'Regla de cuerpo dinámico',
  'panel.ruleDoc.dynamicSub': 'Los cuerpos de respuesta JavaScript se editan en el editor del espacio de trabajo.',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'Paso {current} de {total}',
  'panel.tour.previous': 'Anterior',
  'panel.tour.next': 'Siguiente',
  'panel.tour.finish': 'Finalizar',
  'panel.tour.welcomeTitle': 'Una experiencia DevTools unificada',
  'panel.tour.welcomeSubtitle': 'Un depurador de red con tus reglas integradas.',
  'panel.tour.welcomeCapture': 'Capturar',
  'panel.tour.welcomeCaptureHint': '— solicitudes en vivo con tiempos, encabezados y tamaños',
  'panel.tour.welcomeRules': 'Atribuir',
  'panel.tour.welcomeRulesHint': '— ve qué reglas se activaron en cada solicitud, y por qué',
  'panel.tour.welcomeState': 'Inspeccionar',
  'panel.tour.welcomeStateHint': '— cookies, almacenamiento y consola junto al tráfico',
  'panel.tour.networkTitle': 'La ventana Network',
  'panel.tour.networkSubtitle': 'Cada solicitud que hace la pestaña inspeccionada, en vivo.',
  'panel.tour.networkFilters': 'Filtrar',
  'panel.tour.networkFiltersHint': '— por texto, tipo de recurso o los preajustes de «Más filtros»',
  'panel.tour.networkToolbar': 'Controlar',
  'panel.tour.networkToolbarHint': '— conservar el registro, limitación y desactivar la caché arriba',
  'panel.tour.networkExport': 'Exportar',
  'panel.tour.networkExportHint': '— guarda o copia todo el registro como HAR',
  'panel.tour.storageTitle': 'La ventana Storage',
  'panel.tour.storageSubtitle': 'El estado del lado del cliente de la pestaña inspeccionada, en un solo lugar.',
  'panel.tour.storageAreas': 'Explorar',
  'panel.tour.storageAreasHint': '— almacenamiento local y de sesión, cookies, IndexedDB, cachés',
  'panel.tour.storageEdit': 'Editar',
  'panel.tour.storageEditHint': '— abre cualquier entrada como pestaña de documento y cámbiala en el sitio',
  'panel.tour.inspectorTitle': 'Detalle de la solicitud',
  'panel.tour.inspectorSubtitle': 'Selecciona una solicitud para abrirla aquí como pestaña.',
  'panel.tour.inspectorTabs': 'Secciones',
  'panel.tour.inspectorTabsHint': '— encabezados, carga útil, respuesta, tiempos y cookies',
  'panel.tour.inspectorEdit': 'Sustituir',
  'panel.tour.inspectorEditHint': '— crea una regla desde la solicitud sin salir del panel',
  'panel.tour.matchedTitle': 'Reglas de solicitud',
  'panel.tour.matchedSubtitle':
    'Qué reglas coincidieron con la solicitud seleccionada — y cuáles se activarían en la siguiente.',
  'panel.tour.layoutTitle': 'Hazlo tuyo',
  'panel.tour.layoutSubtitle': 'Los rieles laterales alojan más ventanas de herramientas.',
  'panel.tour.layoutTools': 'Más herramientas',
  'panel.tour.layoutToolsHint': '— Console, búsqueda, Docs y notificaciones viven en los rieles',
  'panel.tour.layoutDrag': 'Reorganizar',
  'panel.tour.layoutDragHint':
    '— arrastra ventanas de herramientas entre los acoples; el menú de disposición restablece',
  'panel.tour.debugTitle': 'Modo de depuración',
  'panel.tour.debugSubtitle': 'Desactivado por defecto — actívalo aquí cuando necesites una captura más profunda.',
  'panel.tour.debugUnlocks': 'Desbloquea',
  'panel.tour.debugUnlocksHint': '— cuerpos de respuesta, consola, tiempos exactos y reglas de nivel script',
  'panel.tour.debugBanner': 'Atención',
  'panel.tour.debugBannerHint':
    '— el navegador muestra un aviso de depuración en las pestañas conectadas mientras está activo',

  // ── Value expander (headers / cookies detail readout) ──────────────
  'panel.valueExpander.decoded': 'Decodificado',
  'panel.valueExpander.raw': 'Sin procesar',
} as const satisfies Catalog;
