/**
 * Popup namespace — Spanish. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the es register contract (`es/shared.ts`). Mints: rule fire
 * = `disparo`/`dispararse`; shadowed evidence = `eclipsada` (shadow
 * detection = `detección de eclipsado`); fallback evidence chip =
 * `indirecta` (fr precedent); badge = `insignia`; delivery chips agree
 * with `entrega` (f.): `directa`/`caché`/raw `sw`; expand = `expandir`
 * / collapse = `contraer`; tour = `visita guiada`; Delay = `Retraso`;
 * Query Param = `Parámetro de consulta` (query = consulta, request =
 * solicitud); Add Rule = `Añadir regla`; ground truth = `verdad sobre
 * el terreno`; overflow menu = `menú de desbordamiento`. Header-op
 * quotes copy the S60 mints (`Sobrescribir`); browser-menu mocks quote
 * the browsers' own es UI (Chrome `Herramientas para desarrolladores`,
 * Safari `Ajustes`/`Desarrollo`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'No se pudo cambiar de vista',
  'popup.header.switchToSidePanel': 'Cambiar a panel lateral (permanece abierto mientras navegas)',
  'popup.header.switchToPopup': 'Cambiar a modo popup (clic en la barra de herramientas)',
  'popup.header.rulesResumed': 'Ejecución de reglas reanudada',
  'popup.header.rulesPaused': 'Ejecución de reglas en pausa',
  'popup.header.rulesLabel': 'Reglas',
  'popup.header.resumeRules': 'Reanudar la ejecución de reglas',
  'popup.header.pauseRules': 'Pausar todas las reglas (conserva la configuración individual de cada regla)',
  'popup.header.openSettings': 'Abrir la configuración',
  'popup.header.notifications': 'Notificaciones',
  'popup.header.openNotifications': 'Abrir las notificaciones',
  'popup.header.activeWorkspace': 'Espacio de trabajo activo: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Activo',
  'popup.status.paused': 'En pausa',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'Cómo llegar a nuestras superpotenciadas herramientas de desarrollo del navegador.',
  'popup.footer.networkDebug': 'Depuración de red.',
  'popup.footer.tagline': 'Como debe ser',
  'popup.footer.keyboardShortcuts': 'Atajos de teclado',
  'popup.footer.systemStatus': 'Sistema',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'Escritorio observando',
  'popup.desktopWatch.tooltip':
    'La aplicación de escritorio de Open Headers está viendo este navegador en su Traffic Monitor. Haz clic para ' +
    'abrir los ajustes — «Permitir que la aplicación de escritorio vea este navegador» es el interruptor.',
  'popup.desktopWatch.aria': 'La aplicación de escritorio está viendo este navegador — abrir ajustes',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'Esta página',
  'popup.tabs.allRules': 'Todas las reglas',
  'popup.tabs.collections': 'Colecciones',
  'popup.tabs.openWorkspaceEditor': 'Abrir el editor completo del espacio de trabajo',
  'popup.tabs.workspace': 'Espacio de trabajo',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': '¿Eliminar «{name}»?',
  'popup.deleteConfirm.confirm': 'confirmar',
  'popup.deleteConfirm.cancel': 'cancelar',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Buscar cualquier cosa...',
  'popup.table.sortOrder': 'Orden de clasificación',
  'popup.table.sortOrderHeading': 'ORDEN DE CLASIFICACIÓN',
  'popup.table.sortByStatus': 'Por estado',
  'popup.table.sortByPriority': 'Por prioridad',
  'popup.table.sortByColumn': 'Por columna',
  'popup.table.sortWorkspaceOrder': 'Orden del espacio de trabajo',
  'popup.table.sortWorkspaceOrderHint': 'Sigue el orden del árbol de la barra lateral del espacio de trabajo',
  'popup.table.sortByColumnHint': 'Ordenado por {column} — haz clic en una opción de arriba para restablecer',
  'popup.table.sortByPriorityHint':
    'Bloquear → Redirigir → Parámetro → Encabezado → Inyectar · A-Z dentro de cada tipo',
  'popup.table.sortByStatusHintAll': 'Activas → En pausa → Desactivadas → Borradores · prioridad dentro de cada grupo',
  'popup.table.sortByStatusHintThisPage': 'Activas → En pausa → Desactivadas · prioridad dentro de cada grupo',
  'popup.table.sortByStatusHintCollections': 'Activas → En pausa · A-Z dentro de cada grupo',
  'popup.table.columnName': 'Nombre',
  'popup.table.columnDetails': 'Detalles',
  'popup.table.columnConditions': 'Condiciones',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'No se pudo activar o desactivar la regla',
  'popup.rule.deleted': 'Regla eliminada',
  'popup.rule.deleteFailed': 'No se pudo eliminar la regla',
  'popup.rule.edit': 'Editar regla',
  'popup.rule.delete': 'Eliminar regla',
  'popup.rule.deleteOk': 'Eliminar',
  'popup.rule.notConnected': 'Aplicación no conectada',
  'popup.rule.desktopTag': 'Desktop',
  'popup.rule.comingSoon': 'próximamente',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Reglas',
  'popup.rules.activeSummary': '{active} de {total} activas',
  'popup.rules.draftSuffix': ', {count} en borrador',
  'popup.rules.pausedByCollection': '{count} en pausa por su colección',
  'popup.rules.addRule': 'Añadir regla',
  'popup.rules.addRuleTooltip': 'Añadir una regla — busca entre tipos y plantillas',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} regla', many: '{count} reglas', other: '{count} reglas' })} coinciden`,
  'popup.rules.emptyNoMatch': 'No se encontraron reglas que coincidan',
  'popup.rules.emptyNone': 'Aún no hay reglas',
  'popup.rules.emptyHint': 'Haz clic en «Añadir regla» para modificar en directo las solicitudes del navegador',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Colecciones',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { one: '{count} colección', many: '{count} colecciones', other: '{count} colecciones' })}, ${plural(
      locale,
      Number(rules),
      { one: '{count} regla', many: '{count} reglas', other: '{count} reglas' },
    )}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} colección', many: '{count} colecciones', other: '{count} colecciones' })} coinciden`,
  'popup.collections.emptyNoMatch': 'No se encontraron colecciones que coincidan',
  'popup.collections.emptyNone': 'No hay colecciones',
  'popup.collections.emptyHint': 'Crea reglas en el editor del espacio de trabajo para organizarlas en colecciones',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${enabled} de ${plural(locale, Number(total), { one: '{count} regla', many: '{count} reglas', other: '{count} reglas' })} activadas`,
  'popup.collections.pausedEnabledSummary': 'En pausa · {enabled} de {total} activadas',
  'popup.collections.resumeTooltip': 'Reanudar — fija {count} reglas como activas (anula al padre si es necesario)',
  'popup.collections.pauseTooltip': 'Pausar — suspende {count} reglas sin cambiar su configuración individual',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'Todos los dominios',
  'popup.conditions.none': 'Sin condiciones',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Dominio',
  'popup.conditions.short.excludeRequestDomains': 'Excl. dominio',
  'popup.conditions.short.initiatorDomains': 'Origen',
  'popup.conditions.short.excludeInitiatorDomains': 'Excl. origen',
  'popup.conditions.short.requestMethods': 'Método',
  'popup.conditions.short.excludeRequestMethods': 'Excl. método',
  'popup.conditions.short.resourceTypes': 'Recurso',
  'popup.conditions.short.excludeResourceTypes': 'Excl. recurso',
  'popup.conditions.short.domainType': 'Tipo de dominio',
  'popup.conditions.short.responseHeader': 'Enc. resp.',
  'popup.conditions.short.excludeResponseHeader': 'Excl. enc. resp.',
  'popup.conditions.full.urlFilter': 'Patrón de URL',
  'popup.conditions.full.urlRegex': 'Regex de URL',
  'popup.conditions.full.requestDomains': 'Dominios',
  'popup.conditions.full.excludeRequestDomains': 'Excl. dominios',
  'popup.conditions.full.initiatorDomains': 'Iniciador',
  'popup.conditions.full.excludeInitiatorDomains': 'Excl. iniciador',
  'popup.conditions.full.requestMethods': 'Métodos',
  'popup.conditions.full.excludeRequestMethods': 'Excl. métodos',
  'popup.conditions.full.resourceTypes': 'Recursos',
  'popup.conditions.full.excludeResourceTypes': 'Excl. recursos',
  'popup.conditions.full.domainType': 'Tipo de dominio',
  'popup.conditions.full.responseHeader': 'Encabezado de respuesta',
  'popup.conditions.full.excludeResponseHeader': 'Excl. encabezado de respuesta',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Nombre',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Recuento',
  'popup.actionDetail.type': 'Tipo',
  'popup.actionDetail.duration': 'Duración',
  'popup.actionDetail.format': 'Formato',
  'popup.actionDetail.status': 'Estado',
  'popup.actionDetail.value': 'Valor',
  'popup.actionDetail.position': 'Posición',
  'popup.actionDetail.body': 'Cuerpo',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Etiqueta',
  'popup.actionDetail.headers': 'Encabezados',
  'popup.actionDetail.params': 'Parámetros',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': 'Cargando la información de la pestaña actual...',
  'popup.thisPage.noTab': 'No se pudo obtener la información de la pestaña actual',
  'popup.thisPage.columnMatch': 'Coincidencia',
  'popup.thisPage.expandHeaderBadgeHint': 'Haz clic en la insignia de cada fila para ver las solicitudes coincidentes',
  'popup.thisPage.expandHeaderDocsHint': 'Haz clic en el icono de abajo para ver la documentación',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })} coinciden con «${query}» — haz clic para expandir`,
  'popup.thisPage.badgeNone': 'Aún no hay solicitudes coincidentes — haz clic para expandir',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} solicitud coincidente', many: '{count} solicitudes coincidentes', other: '{count} solicitudes coincidentes' })}, todas servidas desde la caché (silenciosas) — haz clic para expandir`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { one: '{count} solicitud coincidente disparada', many: '{count} solicitudes coincidentes disparadas', other: '{count} solicitudes coincidentes disparadas' })} + ${silent} silenciosas (en caché) — haz clic para expandir`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} solicitud coincidente', many: '{count} solicitudes coincidentes', other: '{count} solicitudes coincidentes' })} — haz clic para expandir`,
  'popup.thisPage.systemPage': 'Página del sistema',
  'popup.thisPage.systemPageHint': 'Las reglas de encabezados no se aplican a las páginas del sistema del navegador',
  'popup.thisPage.emptyNoRules': 'Ninguna regla coincide con esta página',
  'popup.thisPage.emptyNoRulesHint': 'No hay reglas configuradas para este dominio',
  'popup.thisPage.ruleDisabled': 'La regla está desactivada',
  'popup.thisPage.rulePausedByGroup': 'La regla está en pausa por su colección o carpeta',
  'popup.thisPage.zeroRelated':
    'La regla apunta a un dominio relacionado — aún no se ha observado ninguna solicitud hacia ese dominio. Se disparará si la página emite una.',
  'popup.thisPage.zeroPage':
    'El patrón coincide con esta página pero aún no se ha observado ninguna solicitud coincidente. Interactúa con la página o recárgala para provocarlas.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud coincidente',
      many: 'Las {count} solicitudes coincidentes',
      other: 'Las {count} solicitudes coincidentes',
    }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} de {total} solicitudes coincidentes',
  'popup.thisPage.shadowTooltip':
    '{prefix} quedan interrumpidas por «{name}» (regla de bloqueo de mayor prioridad) — esta regla no tiene ningún efecto visible sobre ellas. Experimental: la detección de eclipsado puede sobrestimar o subestimar. Desactívala en la configuración para ocultarla.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `El script confirmó ${plural(locale, Number(count), { one: '{count} disparo', many: '{count} disparos', other: '{count} disparos' })} en esta página (verdad sobre el terreno obtenida de la inyección en la página).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `Coincidieron ${plural(locale, Number(count), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })} por URL, pero el reportero de script en la página no lo confirmó. Causas habituales: una Content-Security-Policy estricta que bloquea la inyección, o un tipo de recurso (hoja de estilos, imagen, enlace de manifiesto) que elude la interceptación de fetch/XHR.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `El patrón coincidió con ${plural(locale, Number(count), { one: '{count} subrecurso en caché', many: '{count} subrecursos en caché', other: '{count} subrecursos en caché' })} — la acción no pudo ejecutarse porque la respuesta eludió la red. Recarga ignorando la caché para forzar una solicitud nueva.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `Coincidieron ${plural(locale, Number(count), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })} en esta página. El declarativeNetRequest de Chrome no indica qué regla gana cuando varias coinciden — observamos coincidencias de URL, no resultados de arbitraje.`,
  'popup.thisPage.pausedTagTooltip': 'La colección o carpeta está en pausa — la regla no se aplica',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} regla en pausa', many: '{count} reglas en pausa', other: '{count} reglas en pausa' })} por su colección`,
  'popup.thisPage.firing': '{count} disparadas',
  'popup.thisPage.silentCached': '{count} silenciosas (en caché)',
  'popup.thisPage.related': '{count} relacionadas',
  'popup.thisPage.liveMonitoring': 'En directo — supervisando solicitudes',
  'popup.thisPage.visibleResourceTypes': 'TIPOS DE RECURSOS VISIBLES',
  'popup.thisPage.showAll': 'Mostrar todo',
  'popup.thisPage.filterResourceTypes': 'Filtrar tipos de recursos',
  'popup.thisPage.filterResourceTypesCount': 'Filtrar tipos de recursos ({shown} de {total} mostrados)',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud',
      many: '{count} solicitudes',
      other: '{count} solicitudes',
    }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud silenciosa (en caché)',
      many: '{count} solicitudes silenciosas (en caché)',
      other: '{count} solicitudes silenciosas (en caché)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })} (${silent} silenciosas)`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} regla', many: '{count} reglas', other: '{count} reglas' })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })}`,
  'popup.thisPage.matchedJoin': '{parts} coincidentes',
  'popup.thisPage.copyTsv': 'Copiar las solicitudes como TSV',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Hora',
  'popup.matched.columnUrl': 'URL de la solicitud',
  'popup.matched.columnType': 'Tipo',
  'popup.matched.columnDelivery': 'Entrega',
  'popup.matched.columnEvidence': 'Evidencia',
  'popup.matched.columnPattern': 'Patrón',
  'popup.matched.matchedBy': 'coincide vía',
  'popup.matched.deliveryLive': 'directa',
  'popup.matched.deliveryCached': 'caché',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip':
    'La solicitud salió a la red durante esta sesión; la respuesta no se sirvió desde la caché.',
  'popup.matched.deliveryCachedTip':
    'La respuesta se sirvió desde la caché HTTP de Chrome. Tu regla se aplicó cuando esta respuesta se obtuvo originalmente o en la ronda de revalidación.',
  'popup.matched.deliverySwTip':
    'Un service worker interceptó la solicitud. Que tu regla se aplicara depende de lo que el service worker hiciera después.',
  'popup.matched.evidenceShadowed': 'eclipsada',
  'popup.matched.evidenceShadowedTip':
    'Esta solicitud fue interrumpida por «{name}» (regla de bloqueo de mayor prioridad). Esta regla nunca se ejecutó sobre ella.',
  'popup.matched.evidenceConfirmed': 'confirmada',
  'popup.matched.evidenceConfirmedTip':
    'El script confirmó este disparo desde la inyección en la página — verdad sobre el terreno: la regla se ejecutó.',
  'popup.matched.evidenceFallback': 'indirecta',
  'popup.matched.evidenceFallbackTip':
    'Coincidió por URL, pero el reportero de script en la página no lo confirmó. Causas habituales: una Content-Security-Policy estricta que bloquea la inyección MAIN-world, o un tipo de recurso (hoja de estilos, imagen, enlace de manifiesto) que elude la interceptación de fetch/XHR.',
  'popup.matched.evidenceSilent': 'silenciosa',
  'popup.matched.evidenceSilentTip':
    'El patrón coincidió con este subrecurso pero la respuesta se sirvió desde la caché / un service worker / el bfcache, así que la acción de la regla no pudo ejecutarse. Recarga ignorando la caché para forzar una solicitud nueva.',
  'popup.matched.evidenceMatched': 'coincidente',
  'popup.matched.evidenceMatchedTip':
    'La URL coincide con las condiciones de esta regla. El declarativeNetRequest de Chrome no indica qué regla gana el arbitraje — observamos coincidencias de URL, no la ejecución.',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} de ${plural(locale, Number(total), { one: '{count} solicitud', many: '{count} solicitudes', other: '{count} solicitudes' })} para «${query}»`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} solicitud coincidente', many: '{count} solicitudes coincidentes', other: '{count} solicitudes coincidentes' })}`,
  'popup.matched.emptySearch':
    'Ninguna solicitud coincidente contiene «{query}». Borra o amplía la búsqueda para ver todas las coincidencias.',
  'popup.matched.emptyRelated':
    'La regla apunta a un dominio relacionado — las coincidencias aparecerán si la página emite solicitudes hacia ese dominio.',
  'popup.matched.emptyPage':
    'El patrón coincide con esta página. Las coincidencias aparecerán cuando la página emita solicitudes que encajen con el patrón — interactúa con la página o recárgala para provocarlas.',
  'popup.matched.emptyNone': 'Aún no hay solicitudes coincidentes — recarga la página para capturar.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'Encabezado',
  'popup.ruleType.block': 'Bloquear',
  'popup.ruleType.redirect': 'Redirigir',
  'popup.ruleType.queryParam': 'Parámetro de consulta',
  'popup.ruleType.inject': 'Inyectar',
  'popup.ruleType.requestBody': 'Solicitud API',
  'popup.ruleType.delay': 'Retraso',
  'popup.ruleType.response': 'Respuesta API',
  'popup.ruleType.headerDesc': 'Modificar encabezados HTTP',
  'popup.ruleType.blockDesc': 'Bloquear solicitudes',
  'popup.ruleType.redirectDesc': 'Redirigir solicitudes',
  'popup.ruleType.queryParamDesc': 'Modificar parámetros de consulta',
  'popup.ruleType.injectDesc': 'Inyectar scripts o CSS',
  'popup.ruleType.requestBodyDesc': 'Modificar el cuerpo de solicitudes API (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Retrasar la respuesta',
  'popup.ruleType.responseDesc': 'Simular o modificar una respuesta API (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'Coincide directamente con la URL de la página',
  'popup.resourceType.subFrameTip': 'Se aplica a un iframe cargado por esta página',
  'popup.resourceType.xhrTip': 'Se aplica a las llamadas a fetch() y XMLHttpRequest',
  'popup.resourceType.scriptTip': 'Se aplica a los recursos de script',
  'popup.resourceType.stylesheetTip': 'Se aplica a las hojas de estilos',
  'popup.resourceType.imageTip': 'Se aplica a las imágenes',
  'popup.resourceType.fontTip': 'Se aplica a los archivos de fuentes',
  'popup.resourceType.mediaTip': 'Se aplica a los recursos de audio/vídeo',
  'popup.resourceType.websocketTip': 'Se aplica a las conexiones WebSocket',
  'popup.resourceType.pingTip': 'Se aplica a las solicitudes ping/beacon',
  'popup.resourceType.otherTip': 'Se aplica a los demás recursos',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Regla en blanco',
  'popup.palette.searchPlaceholder': 'Buscar tipos de regla y plantillas…',
  'popup.palette.noMatches': 'Sin resultados para «{query}»',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Atajos de teclado',
  'popup.shortcuts.press': 'pulsa',
  'popup.shortcuts.or': 'o',
  'popup.shortcuts.toClose': 'para cerrar',
  'popup.shortcuts.groupNavigation': 'Navegación',
  'popup.shortcuts.groupActions': 'Acciones',
  'popup.shortcuts.groupRow': 'Filas de la tabla',
  'popup.shortcuts.groupBrowser': 'Navegador',
  'popup.shortcuts.groupTour': 'Visita guiada',
  'popup.shortcuts.openExtension': 'Abrir la extensión',
  'popup.shortcuts.customize': 'Personalizar el atajo de la extensión ↗',
  'popup.shortcuts.toggleDebugMode': 'Alternar el modo de depuración',
  'popup.shortcuts.tabThisPage': 'Pestaña Esta página',
  'popup.shortcuts.tabAllRules': 'Pestaña Todas las reglas',
  'popup.shortcuts.tabCollections': 'Pestaña Colecciones',
  'popup.shortcuts.focusSearch': 'Enfocar la búsqueda',
  'popup.shortcuts.prevPage': 'Página anterior',
  'popup.shortcuts.nextPage': 'Página siguiente',
  'popup.shortcuts.addRule': 'Añadir una regla nueva',
  'popup.shortcuts.openWorkspace': 'Abrir el espacio de trabajo',
  'popup.shortcuts.openSettings': 'Abrir la configuración',
  'popup.shortcuts.toggleSurface': 'Alternar popup / panel lateral',
  'popup.shortcuts.toggleRulesPause': 'Pausar / reanudar todas las reglas',
  'popup.shortcuts.togglePauseFocused': 'Pausar / reanudar la colección o carpeta',
  'popup.shortcuts.toggleOptionsMenu': 'Menú de opciones',
  'popup.shortcuts.cycleTheme': 'Cambiar de tema',
  'popup.shortcuts.toggleCompactMode': 'Modo compacto',
  'popup.shortcuts.toggleShortcutsHelp': 'Este panel',
  'popup.shortcuts.moveDown': 'Bajar',
  'popup.shortcuts.moveUp': 'Subir',
  'popup.shortcuts.expandRow': 'Expandir / entrar en las subfilas',
  'popup.shortcuts.collapseRow': 'Contraer / salir de las subfilas',
  'popup.shortcuts.toggleRow': 'Activar / desactivar',
  'popup.shortcuts.editRow': 'Editar regla',
  'popup.shortcuts.copyValue': 'Copiar el valor',
  'popup.shortcuts.deleteRow': 'Eliminar (pulsa dos veces)',
  'popup.shortcuts.openTourGuide': 'Abrir la visita guiada',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Paso {current} de {total}',
  'popup.tour.previous': 'Anterior',
  'popup.tour.next': 'Siguiente',
  'popup.tour.finish': 'Finalizar',
  'popup.tour.welcomeTitle': 'Te damos la bienvenida a Open Headers',
  'popup.tour.welcomeSubtitle': 'Intercepta y modifica el tráfico HTTP en tiempo real.',
  'popup.tour.modify': 'Modificar',
  'popup.tour.modifyDesc': 'Encabezados, cookies, tokens de autenticación, CORS, cargas útiles',
  'popup.tour.route': 'Enrutar',
  'popup.tour.routeDesc': 'Redirige solicitudes, bloquea rastreadores, reescribe URL',
  'popup.tour.debug': 'Depurar',
  'popup.tour.debugDesc': 'Inspecciona solicitudes en directo, inyecta scripts, sustituye respuestas',
  'popup.tour.migrateSwitching': 'Vienes de',
  'popup.tour.migrateOr': 'o',
  'popup.tour.migrateButton': 'Migrar desde otra herramienta',
  'popup.tour.tabsTitle': 'Cambia entre pestañas',
  'popup.tour.tabsSubtitle': 'Pulsa una tecla numérica para cambiar al instante.',
  'popup.tour.thisPageHint': '— las reglas que coinciden con la pestaña actual',
  'popup.tour.allRulesHint': '— todas las reglas que has creado',
  'popup.tour.tagsLabel': 'Etiquetas',
  'popup.tour.tagsHint': '— organiza y pausa grupos',
  'popup.tour.workspaceTitle': 'Tu espacio de trabajo',
  'popup.tour.workspaceSubtitle': 'El editor completo — se abre en su propia pestaña.',
  'popup.tour.workspaceRequests': 'Cliente API',
  'popup.tour.workspaceRequestsHint': '— crea, envía y guarda solicitudes API',
  'popup.tour.workspaceWorkflows': 'Workflows',
  'popup.tour.workspaceWorkflowsHint': '— encadena solicitudes en ejecuciones automatizadas',
  'popup.tour.workspaceEnvs': 'Entornos y variables',
  'popup.tour.workspaceEnvsHint': '— más importaciones, reglas y sincronización de equipo',
  'popup.tour.navTitle': 'Explora y navega por las reglas',
  'popup.tour.navSubtitle': 'Navega por las filas con atajos de teclado',
  'popup.tour.keyMove': 'Mover',
  'popup.tour.keyExpand': 'Expandir',
  'popup.tour.keyToggle': 'Alternar',
  'popup.tour.keyEdit': 'Editar',
  'popup.tour.keyCopy': 'Copiar',
  'popup.tour.keyDelete': 'Eliminar',
  'popup.tour.devtoolsTitle': 'Depura la red en las DevTools',
  'popup.tour.findThePrefix': 'Encuentra la pestaña',
  'popup.tour.findTheSuffix': 'en las DevTools:',
  'popup.tour.devtoolsHint': 'Haz clic en este botón en cualquier momento para ver los pasos de configuración.',
  'popup.tour.shortcutsTitle': 'Todos los atajos de teclado',
  'popup.tour.shortcutsSubtitle': 'El popup se maneja por completo con el teclado.',
  'popup.tour.pressLabel': 'Pulsa',
  'popup.tour.shortcutsHint': 'en cualquier momento para ver todos los atajos',
  'popup.tour.debugModeTitle': 'Modo de depuración',
  'popup.tour.debugModeSubtitle': 'Control total del tráfico del navegador en directo.',
  'popup.tour.debugModeReqRes': 'Solicitudes y respuestas',
  'popup.tour.debugModeReqResHint': '— reescribe encabezados, cuerpos y códigos de estado en directo',
  'popup.tour.debugModeStreams': 'WebSockets y SSE',
  'popup.tour.debugModeStreamsHint': '— inspecciona y edita los mensajes transmitidos en continuo',
  'popup.tour.debugModeScripts': 'Scripts y almacenamiento',
  'popup.tour.debugModeScriptsHint': '— inyecta scripts, inspecciona cookies y almacenamiento',
  'popup.tour.statusTitle': 'Estado del sistema',
  'popup.tour.statusSubtitle':
    'Haz clic en el punto para ver un desglose de salud de Sync, Reglas, Solicitudes, Permisos, Secretos y Live.',
  'popup.tour.statusGreen': 'Verde',
  'popup.tour.statusGreenDesc': '— todo está en buen estado',
  'popup.tour.statusYellow': 'Amarillo',
  'popup.tour.statusYellowDesc': '— un subsistema informa de una advertencia',
  'popup.tour.statusRed': 'Rojo',
  'popup.tour.statusRedDesc': '— un subsistema ha fallado',
  'popup.tour.growTitle': 'Ayúdanos a crecer',
  'popup.tour.growSubtitle': 'Ayúdanos a crecer y a llegar a más desarrolladores.',
  'popup.tour.starGithub': 'Danos una estrella en GitHub',
  'popup.tour.recommend': 'Recomiéndanos a tus amigos y colegas',
  'popup.tour.growHint': 'Encuentra todo esto cuando quieras bajo la campana.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Modifica encabezados, solicitudes y respuestas',
  'popup.devtools.featureTabs': 'Paneles de metadatos de solicitud con varias pestañas',
  'popup.devtools.featureSearch': 'Búsqueda y filtros avanzados',
  'popup.devtools.featureDock': 'Paneles laterales de arrastrar y soltar',
  'popup.devtools.addOverride': '+ Añadir/Sobrescribir',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Depuración de red',
  'popup.debug.step1': 'Abre las DevTools del navegador',
  'popup.debug.step1a': 'En una página normal, p. ej.',
  'popup.debug.notPrefix': 'No',
  'popup.debug.notSuffix': 'ni una pestaña nueva (las extensiones están bloqueadas ahí).',
  'popup.debug.onPlatform': 'en {platform}',
  'popup.debug.menuHintSafari':
    'Activa antes Desarrollo — Safari → Ajustes → Avanzado → «Mostrar funciones para desarrolladores web».',
  'popup.debug.clickThePrefix': 'Haz clic en la pestaña',
  'popup.debug.clickTheSuffix': '',
  'popup.debug.overflowPrefix': 'Última pestaña — puede ocultarse en el menú',
  'popup.debug.overflowSuffix': 'de desbordamiento.',
  'popup.debug.step3': 'Superpotencia tu depuración',
  'popup.debug.menuGlyphAria': 'Abrir el menú Ver → Desarrollador → Herramientas para desarrolladores',
  'popup.debug.tabGlyphAria':
    'DevTools acopladas con la pestaña Open Headers seleccionada — barras laterales, lista de red y paneles divididos con varias pestañas',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': 'Desarrollador',
  'popup.debug.menuGlyphDeveloperTools': 'Herramientas para desarrolladores',
} as const satisfies Catalog;
