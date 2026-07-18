/**
 * DevTools panel — storage tool window — Spanish. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose, example-card payloads, char / byte /
 * MB figures, the Key / Value input placeholders, and data-plane
 * not-sent reasons riding as holes. Mints: object store = `almacén`;
 * IndexedDB record = `registro` (DB referent — the log referent keys
 * separately); em dash = `raya`; breadcrumb = `ruta de navegación`;
 * size cap / ceiling = `límite`; page frame = `marco`; edits =
 * `ediciones`; draft = `borrador`; caché rides f.; capital-`Cookie`
 * sentences keep the S60/S61 dodge (`La Cookie ya no está en el
 * tarro`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'Tipo de almacenamiento',
  'panel.storage.nav.local': 'Almacenamiento local',
  'panel.storage.nav.session': 'Almacenamiento de sesión',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Uso',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} coincidencia',
      many: '{count} coincidencias',
      other: '{count} coincidencias',
    }),
  'panel.storage.filterAria': 'Filtrar las entradas de almacenamiento',
  'panel.storage.revealedHidden': 'La fila revelada está oculta por el filtro activo',
  'panel.storage.addCookieTitle': 'Añadir una cookie al tarro del navegador (incluidas las HttpOnly)',
  'panel.storage.addCookieAria': 'Añadir una cookie',
  'panel.storage.addEntryTitle': 'Añadir una entrada',
  'panel.storage.addEntryAria': 'Añadir una entrada de almacenamiento',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB es de solo lectura aquí',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage es de solo lectura aquí',
  'panel.storage.addReadOnly.quota': 'El uso es de solo lectura',
  'panel.storage.refreshTitle': 'Actualizar',
  'panel.storage.refreshAria': 'Actualizar el almacenamiento',
  'panel.storage.originAria': 'Origen del almacenamiento',
  'panel.storage.partitionedChip': 'particionado',
  'panel.storage.partitionedTitle':
    'Almacenamiento particionado — los datos de este origen aquí se indexan bajo {site}.\nClave de ' +
    'almacenamiento: {raw}',
  'panel.storage.partitionFallback': 'una partición',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} elemento', many: '{count} elementos', other: '{count} elementos' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} elemento',
      many: '{count} elementos',
      other: '{count} elementos',
    });
    return `${String(shown)} de ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cookie', many: '{count} cookies', other: '{count} cookies' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} cookie',
      many: '{count} cookies',
      other: '{count} cookies',
    });
    return `${String(shown)} de ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} base de datos',
      many: '{count} bases de datos',
      other: '{count} bases de datos',
    }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} caché', many: '{count} cachés', other: '{count} cachés' }),
  'panel.storage.count.quotaUsed': '{used} de {total} usados',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} sección coincide',
      many: '{count} secciones coinciden',
      other: '{count} secciones coinciden',
    }),
  'panel.storage.note.writeFailed': 'fallo de escritura',
  'panel.storage.note.deleteFailed': 'fallo de eliminación',
  'panel.storage.note.readFailed': 'fallo de lectura — se muestran los últimos datos',
  'panel.storage.note.truncated': 'lista truncada',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Borrar el almacenamiento local',
  'panel.storage.clear.label.session': 'Borrar el almacenamiento de sesión',
  'panel.storage.clear.label.cookies': 'Borrar las cookies',
  'panel.storage.clear.label.indexeddb': 'Borrar IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Borrar Cache Storage',
  'panel.storage.clear.title.local': 'Borrar todas las entradas de localStorage',
  'panel.storage.clear.title.session': 'Borrar todas las entradas de sessionStorage',
  'panel.storage.clear.title.cookies': 'Borrar todas las cookies del tarro de este sitio',
  'panel.storage.clear.title.indexeddb': 'Borrar todas las bases de datos IndexedDB',
  'panel.storage.clear.title.cachestorage': 'Borrar todas las cachés',
  'panel.storage.clear.armedTitle.local': 'Elimina todas las entradas de localStorage de este origen',
  'panel.storage.clear.armedTitle.session': 'Elimina todas las entradas de sessionStorage de este origen',
  'panel.storage.clear.armedTitle.cookies': 'Elimina todas las cookies del tarro de este sitio para este origen',
  'panel.storage.clear.armedTitle.indexeddb': 'Elimina todas las bases de datos IndexedDB de este origen',
  'panel.storage.clear.armedTitle.cachestorage': 'Elimina todas las cachés de este origen',
  'panel.storage.confirmClear': '¿Confirmar el borrado?',
  'panel.storage.confirmDelete': '¿Confirmar la eliminación?',
  'panel.storage.confirmSuffixAria': '{action} — haz clic de nuevo para confirmar',
  'panel.storage.cleared': '✓ borrado',
  'panel.storage.clearFailed': 'fallo al borrar',
  // Empty / error states.
  'panel.storage.empty.loading': 'Cargando…',
  'panel.storage.empty.notAvailableTitle': 'La inspección del almacenamiento no está disponible aquí',
  'panel.storage.empty.notAvailableSub':
    'Este host no expone el almacenamiento de aplicación de la pestaña inspeccionada.',
  'panel.storage.empty.noOriginsTitle': 'No hay orígenes inspeccionables',
  'panel.storage.empty.noOriginsDomSub':
    'Esta pestaña no tiene marcos http(s) con almacenamiento DOM — las páginas internas del navegador no se ' +
    'pueden inspeccionar.',
  'panel.storage.empty.noOriginsSub':
    'Esta pestaña no tiene marcos http(s) — las páginas internas del navegador no se pueden inspeccionar.',
  'panel.storage.empty.noOriginsCookiesSub':
    'Esta pestaña no tiene marcos http(s) — las páginas internas del navegador no llevan cookies de sitio.',
  'panel.storage.empty.unavailableTitle': 'Almacenamiento no disponible',
  'panel.storage.empty.unavailableSub':
    'El marco de {origin} no se puede leer ahora mismo — puede que haya navegado a otra parte.',
  'panel.storage.thisOrigin': 'este origen',
  'panel.storage.empty.noItems': 'No hay elementos en {area} para {origin}.',
  'panel.storage.empty.noItemsMatch': 'Ningún elemento coincide con tu filtro.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Las cookies no están disponibles aquí',
  'panel.storage.empty.cookiesUnavailableSub': 'Este host no expone el tarro de cookies del navegador.',
  'panel.storage.empty.noCookies': 'No hay cookies para {origin}.',
  'panel.storage.empty.noCookiesMatch': 'Ninguna cookie coincide con tu filtro.',
  // Jar cookie grid column headers — parity-shaped headers stay raw.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'Entradas de almacenamiento',
  'panel.storage.grid.clipped': 'recortado ({length})',
  'panel.storage.grid.editTitle': 'Editar esta entrada',
  'panel.storage.grid.editAria': 'Editar {key}',
  'panel.storage.grid.deleteTitle': 'Eliminar esta entrada',
  'panel.storage.grid.deleteAria': 'Eliminar {key}',
  'panel.storage.grid.newKeyAria': 'Clave de la entrada nueva',
  'panel.storage.grid.newValueAria': 'Valor de la entrada nueva',
  'panel.storage.grid.keyAria': 'Clave de la entrada',
  'panel.storage.grid.valueAria': 'Valor de la entrada',
  'panel.storage.grid.addSaveHint': 'Escribir la entrada nueva en el almacenamiento',
  'panel.storage.grid.editSaveHint': 'Escribir la entrada editada de vuelta al almacenamiento',
  'panel.storage.grid.emptyKeyHint': 'La clave no puede estar vacía',
  'panel.storage.grid.cancelTitle': 'Cancelar',
  'panel.storage.grid.cancelAddAria': 'Cancelar la adición',
  'panel.storage.grid.cancelEditAria': 'Cancelar la edición',
  'panel.storage.grid.tooLarge': 'Demasiado grande para editarlo aquí — el valor completo supera el límite de edición.',
  'panel.storage.grid.fetchFailed': 'El valor completo no se puede leer ahora mismo.',
  'panel.storage.grid.loadingFullValue': 'Cargando el valor completo…',
  'panel.storage.save.label': 'Guardar',
  'panel.storage.save.noChanges': 'No hay cambios que guardar',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'No enviada a esta página — {reason}',
  'panel.storage.cookieRow.notSentAria': 'La Cookie {name} no se envía a esta página: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Particionada bajo {key}',
  'panel.storage.cookieRow.editTitle': 'Editar esta cookie en el tarro del navegador',
  'panel.storage.cookieRow.editAria': 'Editar la cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Eliminar esta cookie del tarro del navegador',
  'panel.storage.cookieRow.deleteAria': 'Eliminar la cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB no se puede leer',
  'panel.storage.idb.cantReadSub':
    'Este marco no expone sus bases de datos ahora mismo — puede que haya navegado a otra parte.',
  'panel.storage.idb.noDatabases': 'No hay bases de datos IndexedDB para este origen.',
  'panel.storage.idb.versionTitle': 'Versión {version} de la base de datos',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} almacén', many: '{count} almacenes', other: '{count} almacenes' }),
  'panel.storage.idb.metaKeyPath': 'clave: {path}',
  'panel.storage.idb.metaAutoIncrement': 'claves autoincrementales',
  'panel.storage.idb.metaOutOfLine': 'claves out-of-line',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} índice', many: '{count} índices', other: '{count} índices' }),
  'panel.storage.idb.deleteDbTitle': 'Eliminar la base de datos {name}',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Elimina {name} y todos sus almacenes — una página que la mantenga abierta bloquea la eliminación',
  'panel.storage.idb.deleteDbAria': 'Eliminar la base de datos {name}',
  'panel.storage.idb.openStoreTitle': 'Abrir {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Borrar todos los registros de {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Elimina todos los registros de {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Borrar el almacén {store}',
  'panel.storage.idb.noStores': 'sin almacenes de objetos',
  'panel.storage.idb.backTitle': 'Volver a las bases de datos',
  'panel.storage.idb.cursorAria': 'Cursor de registros',
  'panel.storage.idb.cursorTitle':
    'Leer el almacén a través de uno de sus índices — la columna Key se convierte en la clave del índice',
  'panel.storage.idb.primaryKeyOption': 'clave primaria',
  'panel.storage.idb.indexOption': 'índice: {name}',
  'panel.storage.idb.noRecords': 'No hay registros en {store}.',
  'panel.storage.idb.noRecordsPage': 'No hay registros en {store} en esta página.',
  'panel.storage.idb.noRecordsMatch': 'Ningún registro coincide con tu filtro.',
  'panel.storage.idb.gridAria': 'Registros de IndexedDB',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Abrir este registro en el editor',
  'panel.storage.idb.keyCellTitle': 'Clave: {key}\nClave primaria: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Eliminar este registro',
  'panel.storage.idb.deleteRecordAria': 'Eliminar el registro {key}',
  'panel.storage.pager.prevTitle': 'Página anterior',
  'panel.storage.pager.nextTitle': 'Página siguiente',
  'panel.storage.pager.page': 'página {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage no se puede leer',
  'panel.storage.cache.cantReadSub':
    'La API solo existe en contextos seguros (https) — o este marco no se puede leer ahora mismo.',
  'panel.storage.cache.noCaches': 'No hay cachés para este origen.',
  'panel.storage.cache.noCachesMatch': 'Ninguna caché coincide con tu filtro.',
  'panel.storage.cache.openTitle': 'Abrir la caché {name}',
  'panel.storage.cache.deleteTitle': 'Eliminar la caché {name}',
  'panel.storage.cache.deleteConfirmTitle': 'Elimina {name} y todas sus entradas',
  'panel.storage.cache.deleteAria': 'Eliminar la caché {name}',
  'panel.storage.cache.backTitle': 'Volver a las cachés',
  'panel.storage.cache.noEntries': 'No hay entradas en {name}.',
  'panel.storage.cache.noEntriesPage': 'No hay entradas en {name} en esta página.',
  'panel.storage.cache.noEntriesMatch': 'Ninguna entrada coincide con tu filtro.',
  'panel.storage.cache.gridAria': 'Entradas de caché',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Eliminar esta entrada',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Elimina la respuesta almacenada — haz clic de nuevo para confirmar',
  'panel.storage.cache.deleteEntryAria': 'Eliminar la entrada {url}',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'El uso no se puede leer',
  'panel.storage.quota.cantReadSub':
    'La API solo existe en contextos seguros (https) — o este marco no se puede leer ahora mismo.',
  'panel.storage.quota.used': '{size} usados',
  'panel.storage.quota.ofTotal': 'de {size} ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Service workers',
  'panel.storage.quota.type.fileSystems': 'Sistemas de archivos',
  'panel.storage.quota.type.other': 'Otro',
  'panel.storage.quota.noBreakdown': 'No se informa de uso por tipo para este origen.',
  'panel.storage.quota.debugHint': 'Activa el modo de depuración para ver el desglose por tipo.',
  'panel.storage.quota.sessionNote':
    'El almacenamiento de sesión es por pestaña — esto borra el marco de la pestaña inspeccionada',
  'panel.storage.quota.targetsCaption': 'Objetivos de «Borrar todo»',
  'panel.storage.quota.targetsTitle':
    'Borrar todo (arriba a la derecha) elimina exactamente los tipos de datos marcados para este origen',
  'panel.storage.quota.simulateLabel': 'Simular una cuota personalizada',
  'panel.storage.quota.simulateTitle':
    'Hacer que el navegador informe y aplique una cuota más pequeña para este origen — para probar cómo se ' +
    'comporta la página cuando el almacenamiento se agota',
  'panel.storage.quota.simulateSave': 'Guardar',
  'panel.storage.quota.simulateCancel': 'Cancelar',
  'panel.storage.quota.simulateReset': 'Restablecer',
  'panel.storage.quota.simulateResetTitle': 'Quitar la cuota simulada',
  'panel.storage.quota.simulateRange': 'introduce 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'fallo de la simulación',
  'panel.storage.quota.clearEverything': 'Borrar todo',
  'panel.storage.quota.clearArmedTitle': 'Elimina los tipos de datos marcados para este origen',
  'panel.storage.quota.clearTitle': 'Borrar los tipos de datos marcados para este origen',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Ejemplo de escritura',
  'panel.storage.domCol.key.summary':
    'El nombre de la entrada — una cadena sensible a mayúsculas y minúsculas, única dentro del {area} de este ' +
    'origen. Escribir una clave existente sobrescribe su valor.',
  'panel.storage.domCol.key.description':
    'Renombrar una entrada aquí escribe primero la clave nueva y luego quita la antigua — una escritura ' +
    'fallida nunca pierde el original.',
  'panel.storage.domCol.value.summary':
    'La carga útil almacenada — siempre una cadena; las páginas guardan los datos estructurados serializados, ' +
    'normalmente como JSON.',
  'panel.storage.domCol.value.description':
    'La cuadrícula muestra una vista previa de una línea y recorta los valores muy largos — abrir o editar ' +
    'una entrada recupera el texto completo. Haz clic en una fila para abrirla como pestaña de editor; el ' +
    'doble clic (o el lápiz) edita en línea.',
  'panel.storage.cookieCol.name.summary':
    'El identificador de la cookie. Los navegadores indexan por (name, domain, path) — el mismo nombre con ' +
    'otro ámbito es una cookie distinta.',
  'panel.storage.cookieCol.name.description':
    'Un triángulo de aviso marca una cookie del tarro del sitio que el navegador NO adjuntaría a una ' +
    'solicitud a la página inspeccionada — pasa el cursor para ver el motivo (ruta limitada a otra parte, ' +
    'solo Secure sobre http, limitada a un subdominio, …).',
  'panel.storage.cookieCol.value.summary':
    'La carga útil de la cookie — lo que el navegador devuelve en el encabezado Cookie.',
  'panel.storage.cookieCol.value.description':
    'Haz clic en una fila para abrir la cookie como pestaña de editor con el valor completo y las vistas ' +
    'analizadas; el lápiz edita en línea.',
  'panel.storage.cookieCol.scope.summary':
    'Dónde adjunta el navegador esta cookie — su Domain más, cuando es más estrecho que /, su Path.',
  'panel.storage.cookieCol.scope.description':
    'Una cookie de todo el dominio (almacenada con un punto inicial) fluye también hacia los subdominios; una ' +
    'cookie host-only queda fijada exactamente a su host. La ruta es un prefijo — /api significa que solo la ' +
    'llevan las solicitudes bajo /api.',
  'panel.storage.cookieCol.expires.summary':
    'Cuándo elimina el navegador la cookie, mostrado en relación con ahora — pasa el cursor para ver la fecha ' +
    'absoluta.',
  'panel.storage.cookieCol.expires.description':
    'Session significa que no hay Expires / Max-Age — el navegador descarta la cookie cuando termina la sesión.',
  'panel.storage.cacheCol.exampleCaption': 'Ejemplo de entrada',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· almacenado',
  'panel.storage.cacheCol.request.summary':
    'La URL de la solicitud almacenada — la clave contra la que la caché compara los fetch.',
  'panel.storage.cacheCol.request.description':
    'Pasar el cursor por una fila añade una vista previa acotada de los encabezados de la solicitud ' +
    'almacenada. Haz clic en una fila para abrir la respuesta almacenada como pestaña de editor; la ' +
    'cuadrícula solo guarda los metadatos.',
  'panel.storage.cacheCol.method.summary':
    'El método HTTP de la solicitud almacenada — parte de la clave de caché junto con la URL.',
  'panel.storage.cacheCol.method.description':
    'Casi siempre GET: la API Cache rechaza put / add para los demás métodos.',
  'panel.storage.cacheCol.size.summary': 'El tamaño de la respuesta almacenada, leído de su encabezado content-length.',
  'panel.storage.cacheCol.size.description':
    'Una raya significa que la respuesta almacenada no lleva content-length — el cuerpo sigue ahí, en la ' +
    'pestaña de editor de la entrada.',
  'panel.storage.cacheCol.time.summary': 'Cuándo se almacenó la respuesta en la caché.',
  'panel.storage.cacheCol.time.description':
    'Solo derivable en pestañas conectadas — una raya significa que el host no pudo leerlo para este ámbito.',
  'panel.storage.idbCol.exampleCaption': 'Ejemplo de registro',
  'panel.storage.idbCol.key.summary':
    'La clave del registro bajo el cursor actual — la clave primaria del almacén por defecto; elegir un ' +
    'índice en la ruta de navegación lee a través de él, y esta columna se convierte en la clave del índice.',
  'panel.storage.idbCol.key.description':
    'Pasar el cursor por una fila muestra ambas claves (la clave del cursor y la primaria). Las claves pueden ' +
    'ser números, cadenas, fechas o arrays de estos.',
  'panel.storage.idbCol.value.summary':
    'Una vista previa de una línea del valor structured-clone del registro, serializado en la página.',
  'panel.storage.idbCol.value.description':
    'Haz clic en una fila para abrir el registro completo como pestaña de editor con el árbol expandible; la ' +
    'cuadrícula solo guarda la vista previa.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Revelar en Storage',
  'panel.storage.doc.refreshConfirm': 'Descarta tus ediciones — haz clic de nuevo para actualizar',
  'panel.storage.doc.discardEdits': 'Descartar mis ediciones',
  'panel.storage.doc.openMergeView': 'Abrir la vista de fusión',
  'panel.storage.doc.preview': 'Vista previa',
  'panel.storage.doc.source': 'Fuente',
  'panel.storage.doc.formatAria': 'Formato del texto fuente',
  'panel.storage.doc.formatted': 'Formateado',
  'panel.storage.doc.raw': 'Sin procesar',
  'panel.storage.doc.formattedTitle': 'Formateado para leer — Guardar conserva el formato almacenado',
  'panel.storage.doc.rawTitle': 'El texto almacenado exacto',
  'panel.storage.doc.formatUnavailable': 'La vista formateada solo está disponible para valores con forma de JSON',
  'panel.storage.doc.formatInfoTitle': 'Vista formateada',
  'panel.storage.doc.formatInfoSummary': 'Formateado y Sin procesar son dos vistas del mismo texto almacenado.',
  'panel.storage.doc.formatInfoExampleCaption': 'Ejemplo — un valor, dos vistas',
  'panel.storage.doc.formatInfoModesHeading': 'Modos',
  'panel.storage.doc.formatInfoFormattedDesc':
    'Una vista de lectura — solo cambian los espacios. Las ediciones se recodifican al formato almacenado ' +
    'original, y Guardar escribe ese texto; un Guardar sin ediciones escribe exactamente los bytes originales.',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    'Una vista de lectura — solo cambian los espacios. Este documento es de solo lectura, y Formateado nunca ' +
    'cambia los bytes almacenados.',
  'panel.storage.doc.formatInfoRawDesc': 'Los bytes almacenados exactos.',
  'panel.storage.doc.unavailableSub':
    'Puede que se haya eliminado, o el marco no se puede leer ahora mismo — Actualizar reintenta.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '… ({count} carácter más)',
      many: '… ({count} caracteres más)',
      other: '… ({count} caracteres más)',
    }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'Ya existe una cookie con ese nombre, dominio y ruta — guardar la sobrescribiría. Elige otra identidad.',
  'panel.storage.doc.cookie.saveFailed.write': 'Fallo al guardar — el tarro del navegador rechazó la escritura.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'La cookie nueva se escribió pero la original no se pudo quitar — existen ambas. Actualizar vuelve a leer ' +
    'el tarro.',
  'panel.storage.doc.cookie.saveHint': 'Escribir la cookie editada de vuelta al tarro del navegador',
  'panel.storage.doc.cookie.blockedHint': 'El formulario está incompleto o una referencia no se resuelve',
  'panel.storage.doc.cookie.refreshTitle': 'Volver a leer la cookie',
  'panel.storage.doc.cookie.refreshAria': 'Actualizar la cookie',
  'panel.storage.doc.cookie.revealTitle': 'Abrir Cookies en la ventana de herramientas Storage',
  'panel.storage.doc.cookie.readOnlyNote':
    'El tarro de cookies de este host es de solo lectura — el documento refleja el tarro pero no puede ' +
    'escribir en él.',
  'panel.storage.doc.cookie.goneNote':
    'Esta cookie se eliminó en el navegador — tus ediciones sin guardar se conservan. Guardar la vuelve a ' +
    'escribir.',
  'panel.storage.doc.cookie.unavailableTitle': 'La Cookie ya no está en el tarro',
  'panel.storage.doc.cookie.unavailableSub':
    'Puede que se haya eliminado o caducado, o el tarro no se puede leer en este host — Actualizar reintenta.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'Ya existe una entrada con esa clave — guardar la sobrescribiría. Elige otra clave.',
  'panel.storage.doc.dom.saveFailed.gone':
    'No se puede acceder a la entrada — puede que se haya eliminado. Actualizar lo vuelve a comprobar.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Fallo al guardar — se superó la cuota de almacenamiento. La entrada original queda sin cambios.',
  'panel.storage.doc.dom.saveFailed.write': 'Fallo al guardar — la escritura fue rechazada.',
  'panel.storage.doc.dom.modeAria': 'Modo de vista de la entrada',
  'panel.storage.doc.dom.previewTitle': 'Árbol plegable sobre el valor analizado',
  'panel.storage.doc.dom.previewNeedsJson': 'La vista previa necesita un valor JSON',
  'panel.storage.doc.dom.sourceTitle': 'Vista del valor sin procesar',
  'panel.storage.doc.dom.saveHint': 'Escribir la entrada editada de vuelta al almacenamiento',
  'panel.storage.doc.dom.blockedHint': 'La clave no puede estar vacía',
  'panel.storage.doc.dom.refreshTitle': 'Volver a leer la entrada',
  'panel.storage.doc.dom.refreshAria': 'Actualizar la entrada',
  'panel.storage.doc.dom.revealTitle': 'Abrir {area} en la ventana de herramientas Storage',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': 'Clave de la entrada',
  'panel.storage.doc.dom.conflictNote': 'El valor cambió en el navegador mientras editabas.',
  'panel.storage.doc.dom.mergeToast': 'Fusión aplicada al borrador — Guardar la escribe en el navegador',
  'panel.storage.doc.dom.goneNote':
    'Esta entrada se eliminó en el navegador — tus ediciones sin guardar se conservan. Guardar la vuelve a ' +
    'escribir.',
  'panel.storage.doc.dom.unavailableTitle': 'La entrada ya no está disponible',
  'panel.storage.doc.dom.tooLargeTitle': 'Demasiado grande para abrir',
  'panel.storage.doc.dom.tooLargeSub': 'El valor supera el límite del editor y queda de solo lectura.',
  'panel.storage.doc.dom.previewAria': 'Árbol del valor de la entrada',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'No es JSON válido — corrige la sintaxis y guarda de nuevo.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'La clave cambió — guardar crearía un registro nuevo. Restaura la clave original.',
  'panel.storage.doc.idb.saveFailed.gone':
    'No se puede acceder al registro — puede que se haya eliminado. Actualizar lo vuelve a comprobar.',
  'panel.storage.doc.idb.saveFailed.write': 'Fallo al guardar — la escritura fue rechazada.',
  'panel.storage.doc.idb.modeAria': 'Modo de vista del registro',
  'panel.storage.doc.idb.previewTitle': 'Árbol plegable sobre el valor del registro',
  'panel.storage.doc.idb.previewNeedsDoc': 'La vista previa necesita un documento bien formado',
  'panel.storage.doc.idb.sourceTitle': 'Vista fuente del documento completo',
  'panel.storage.doc.idb.saveHint': 'Escribir el valor editado de vuelta al registro',
  'panel.storage.doc.idb.refreshTitle': 'Volver a leer el registro',
  'panel.storage.doc.idb.refreshAria': 'Actualizar el registro',
  'panel.storage.doc.idb.revealTitle': 'Abrir {database} › {store} en la ventana de herramientas Storage',
  'panel.storage.doc.idb.truncatedNote': 'Truncado en el límite de tamaño — de solo lectura.',
  'panel.storage.doc.idb.nonJsonNote':
    'Contiene tipos no JSON (Date, Map, binario, …) — se muestra como una representación de solo lectura.',
  'panel.storage.doc.idb.conflictNote': 'El registro cambió en el navegador mientras editabas.',
  'panel.storage.doc.idb.mergeToast': 'Fusión aplicada al borrador — Guardar lo escribe en el registro',
  'panel.storage.doc.idb.goneNote':
    'Este registro se eliminó o cambió de forma en el navegador — tus ediciones sin guardar se conservan. ' +
    'Guardar las vuelve a escribir.',
  'panel.storage.doc.idb.unavailableTitle': 'El registro ya no está disponible',
  'panel.storage.doc.idb.previewAria': 'Árbol del valor del registro',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Eliminar esta entrada de la caché',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Elimina la respuesta almacenada — haz clic de nuevo para confirmar',
  'panel.storage.doc.cache.deleteAria': 'Eliminar la entrada de caché',
  'panel.storage.doc.cache.refreshTitle': 'Volver a leer la respuesta almacenada',
  'panel.storage.doc.cache.refreshAria': 'Actualizar la entrada de caché',
  'panel.storage.doc.cache.revealTitle': 'Abrir la caché {cache} en la ventana de herramientas Storage',
  'panel.storage.doc.cache.deleteFailed': 'Fallo al eliminar — puede que la entrada ya no exista.',
  'panel.storage.doc.cache.unavailableTitle': 'La entrada de caché ya no está disponible',
  'panel.storage.doc.cache.truncatedNote': 'Cuerpo truncado en el límite de tamaño — {size} almacenados.',
  'panel.storage.doc.cache.headersSummary': 'Encabezados de respuesta ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Filtrar los encabezados',
  'panel.storage.doc.cache.filterAria': 'Filtrar los encabezados de respuesta',
  'panel.storage.doc.cache.noHeaders': 'No hay encabezados almacenados.',
  'panel.storage.doc.cache.noHeadersMatch': 'Ningún encabezado coincide con tu filtro.',
  'panel.storage.doc.cache.bodySummary': 'Cuerpo de la respuesta',
  'panel.storage.doc.cache.imageAria': 'Cuerpo de imagen almacenado',
  'panel.storage.doc.cache.imageAlt': 'Cuerpo de la respuesta almacenada para {url}',
  'panel.storage.doc.cache.binaryBody': 'Cuerpo binario — {size} almacenados.',
  'panel.storage.doc.cache.emptyBody': 'Cuerpo vacío.',
} as const satisfies Catalog;
