/**
 * Workbench editors — the rule editor, Spanish. Extends the es
 * register contract (`es/shared.ts`). The quick editor reuses the
 * `workbench.editors.rule.fields.*` keys directly (S35 field-key reuse
 * law) — field labels here stay consistent with
 * `es/panel-quick-editor.ts` (`Añadir un encabezado`, `Quitar todo`,
 * `Cambiar a {operation}`, `Mock` / `Modificación`). Rules are
 * feminine (`Activada` / `Desactivada`). Message ops quote the shared
 * rule-type registry (`Sustituir` / `Inyectar` / `Descartar`). MINTS:
 * template = `plantilla` (user template = `plantilla de usuario`);
 * header ops = `Añadir / Reemplazar`, `Anexar`, `Quitar`, `Fusionar`,
 * `Solo reemplazar`, `Quitar todo`; variable scope prose = `ámbito`,
 * debug reach = `alcance` (two-word law). Raw by design: gates
 * AND/OR/NOT, DNR schema vocabulary (`requestDomains`, `url-filter`,
 * `firstParty`, slot ids), `{{ns.NAME}}` reference syntax in
 * placeholders, quoted browser UI phrasing, scheme prefixes, HTTP
 * method lists, `main-frame` / `monkey-patch` loanwords, `frame` (m.)
 * for wire frames, `Mock` and `Live` tags.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Guardado',
  'workbench.editors.header.onTop': 'Cabecera arriba',
  'workbench.editors.header.atBottom': 'Cabecera abajo',
  'workbench.editors.header.moreActions': 'Más acciones',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Editor de reglas',
  'workbench.editors.rule.templates.title': 'Plantillas',
  'workbench.editors.rule.templates.infoSummary': 'Parte de un preajuste en lugar de un formulario en blanco.',
  'workbench.editors.rule.templates.infoDescription':
    'Las plantillas de sistema vienen con la aplicación; las plantillas de usuario son las que guardas tú vía ' +
    '⋮ → Guardar como plantilla de usuario. Aplicar una plantilla solo prerrellena los campos — ajusta lo que ' +
    'quieras antes de guardar.',
  'workbench.editors.rule.templates.blank': 'En blanco',
  'workbench.editors.rule.templates.system': 'Sistema',
  'workbench.editors.rule.templates.user': 'Usuario',
  'workbench.editors.rule.templates.emptyTitle': 'Aún no hay plantillas de usuario',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'Las plantillas de usuario son tus propios preajustes reutilizables para este tipo de regla. Configura la ' +
    'regla como quieras y elige',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Guardar como plantilla de usuario',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'en la cabecera — aparecerá aquí para cada regla nueva de este tipo.',
  'workbench.editors.rule.saveAsTemplate': 'Guardar como plantilla de usuario',
  'workbench.editors.rule.enabled': 'Activada',
  'workbench.editors.rule.disabled': 'Desactivada',
  'workbench.editors.rule.toast.unknownType': 'Tipo de regla desconocido',
  'workbench.editors.rule.toast.deletedOtherTab': 'La regla se eliminó desde otra pestaña',
  'workbench.editors.rule.toast.updateFailed': 'No se pudo actualizar la regla',
  'workbench.editors.rule.toast.updateFailedDetail': 'No se pudo actualizar la regla: {message}',
  'workbench.editors.rule.toast.publishFailed': 'La regla se guardó pero la publicación falló',
  'workbench.editors.rule.toast.updated': 'Regla actualizada',
  'workbench.editors.rule.toast.published': 'Regla publicada',
  'workbench.editors.rule.toast.formatSkipped': 'Formateo al guardar omitido: {reason}',
  'workbench.editors.rule.toast.noCollection': 'No se encontró ninguna colección',
  'workbench.editors.rule.toast.restoreFailed': 'No se pudo restaurar la regla',
  'workbench.editors.rule.toast.restored': 'Regla restaurada',
  'workbench.editors.rule.deleted.message': 'Esta regla se eliminó desde otra superficie.',
  'workbench.editors.rule.deleted.description':
    'Restaurar crea una copia nueva con un id nuevo (la tombstone original es permanente — ver la ' +
    'especificación del motor de sincronización, §7.2).',
  'workbench.editors.rule.deleted.restore': 'Restaurar',
  'workbench.editors.rule.conditionsPane.title': 'Condiciones',
  'workbench.editors.rule.conditionsPane.infoSummary':
    'Las condiciones deciden a qué solicitudes se aplica esta regla.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Las filas se combinan con',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— cada fila debe coincidir.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': 'Los valores dentro de una misma fila se combinan con',
  'workbench.editors.rule.conditionsPane.infoOrAfter': '(la insignia OR marca las filas que aceptan varios valores).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Añade al menos una condición.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'Coincidencia de URL',
  'workbench.editors.rule.condition.group.domainFiltering': 'Filtrado por dominio',
  'workbench.editors.rule.condition.group.requestFiltering': 'Filtrado de solicitudes',
  'workbench.editors.rule.condition.group.headerMatching': 'Coincidencia de encabezados',
  'workbench.editors.rule.condition.type.urlFilter': 'Patrón de URL',
  'workbench.editors.rule.condition.type.urlRegex': 'Regex de URL',
  'workbench.editors.rule.condition.type.requestDomains': 'Dominios de solicitud',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Excluir dominios',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Dominios iniciadores',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Excl. iniciador',
  'workbench.editors.rule.condition.type.requestMethods': 'Métodos',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Excl. métodos',
  'workbench.editors.rule.condition.type.resourceTypes': 'Tipos de recurso',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Excl. recursos',
  'workbench.editors.rule.condition.type.domainType': 'Tipo de dominio',
  'workbench.editors.rule.condition.type.responseHeader': 'Encabezado de respuesta',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Excl. enc. resp.',
  'workbench.editors.rule.condition.suffix.notSupported': ' — no compatible con Chrome DNR',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — ya en uso',
  'workbench.editors.rule.condition.firstParty': 'Primera parte',
  'workbench.editors.rule.condition.thirdParty': 'Terceros',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'Sin condiciones — la regla no coincidirá con ninguna solicitud',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    'Las filas se combinan con AND — cada fila debe coincidir para que la regla se dispare. Cada fila apunta a ' +
    'un campo DNR distinto, así que el AND entre filas es exacto. Para combinar varios valores en OR dentro de ' +
    'un mismo campo, lístalos en una sola fila (mira la insignia OR de la fila).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'Esta es una condición de exclusión — la regla se dispara solo cuando NINGUNO de los valores listados ' +
    'coincide.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'Varios valores en esta fila coinciden si CUALQUIERA de ellos coincide (OR). Las filas de abajo se ' +
    'combinan con AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 valor',
  'workbench.editors.rule.condition.oneValueTooltip':
    'Esta condición toma un solo valor — separar con comas no tiene efecto. Las filas de abajo se combinan ' +
    'con AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'Nombre de encabezado igual a...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'Valor de encabezado igual a...',
  'workbench.editors.rule.condition.selectMethods': 'Selecciona métodos',
  'workbench.editors.rule.condition.selectTypes': 'Selecciona tipos',
  'workbench.editors.rule.condition.selectType': 'Selecciona un tipo',
  'workbench.editors.rule.condition.valuePlaceholder': 'valor',
  'workbench.editors.rule.condition.add': 'Añadir condición',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    'Solo la última fila {type} se aplica — el valor de esta fila no llegará a Chrome. Quita esta fila, o ' +
    'mueve sus valores a la fila que gana.',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} y {winningType} comparten un slot DNR — solo el último se aplica. Elige uno.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'Este tipo de condición aún no es compatible con Chrome DNR — la regla se guarda igualmente pero esta ' +
    'fila no envía nada a la red.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'El patrón de URL no puede estar vacío.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'La regex de URL no puede estar vacía.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'El patrón de URL no puede contener espacios — Chrome rechaza las reglas con espacios en url-filter.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'El patrón de URL contiene caracteres no ASCII — Chrome los rechaza. Usa punycode (xn--…) para los ' +
    'nombres de host IDN.',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    'Esto parece una regex — en Patrón de URL, caracteres como `(`, `[`, `+`, `?`, `\\d` se toman ' +
    'literalmente. Cambia a Regex de URL si necesitas sintaxis de regex.',
  'workbench.editors.rule.issue.regexLookbehind':
    'El motor de regex de Chrome (RE2) no admite las aserciones lookbehind ((?<=…), (?<!…)). La regla puede ' +
    'fallar al cargarse.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'El motor de regex de Chrome (RE2) no admite los grupos con nombre al estilo Python ((?P<name>…)). La ' +
    'regla puede fallar al cargarse.',
  'workbench.editors.rule.issue.invalidUrlRegex': 'Regex no válida: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '«{value}» no es un método HTTP válido. Permitidos: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, ' +
    'CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType':
    '«{value}» no es un tipo de recurso válido. Elige uno del desplegable.',
  'workbench.editors.rule.issue.invalidDomainType':
    '«{value}» no es un tipo de dominio válido. Usa «firstParty» o «thirdParty».',
  'workbench.editors.rule.issue.headerNameRequired': 'El nombre del encabezado es obligatorio.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    'Espacio dentro del valor — separa los nombres de host con una coma. requestDomains toma un solo nombre ' +
    'de host desnudo por entrada.',
  'workbench.editors.rule.issue.domain.scheme':
    'Quita el esquema — el requestDomains de Chrome solo toma nombres de host, no URL.',
  'workbench.editors.rule.issue.domain.wildcard':
    'Quita el comodín — requestDomains cubre todos los subdominios automáticamente, así que «*.foo.com» es ' +
    'simplemente «foo.com».',
  'workbench.editors.rule.issue.domain.port':
    'Quita el puerto — requestDomains compara solo por nombre de host; la regla cubre todos los puertos ' +
    'automáticamente.',
  'workbench.editors.rule.issue.domain.uppercase':
    'Pon el nombre de host en minúsculas — Chrome solo acepta ASCII en minúsculas en requestDomains.',
  'workbench.editors.rule.issue.domain.nonAscii':
    'El nombre de host contiene caracteres que Chrome rechaza en requestDomains (probablemente una entrada ' +
    'no ASCII / IDN). Usa la forma punycode (xn--…).',
  'workbench.editors.rule.issue.domain.empty': 'Nombre de host vacío — quita esta fila.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entrada afectada',
      many: '{count} entradas afectadas',
      other: '{count} entradas afectadas',
    }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Limpiar',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'El destino de la redirección no puede contener espacios.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'El destino de la redirección debe ser una URL completa (http://, https://, chrome-extension://) o una ' +
    'ruta que empiece por /.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'La URL de origen debe usar http://, https:// o chrome-extension://.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'La URL de origen no es una URL válida.',
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'El código de estado debe ser un entero entre 100 y 599.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    'El nombre del parámetro no puede contener `&`, `=`, `#`, `?` ni espacios.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'El retraso main-frame está limitado a 30000ms; los valores superiores se recortan en la red.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'El monkey-patch de XHR/fetch limita los retrasos a 5000ms para evitar agotar el pool de conexiones HTTP. ' +
    'Las redirecciones main-frame respetan hasta 30000ms.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'El tipo de contenido debe parecerse a «type/subtype» (p. ej. application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'La clave del filtro GraphQL es obligatoria.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'El valor del filtro de mensajes es obligatorio cuando hay un filtro configurado.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    'El filtro de mensajes no es una expresión regular válida.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Inyectar tras un mensaje coincidente requiere un filtro de mensajes.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable sin resolver en esta regla',
      many: '{count} variables sin resolver en esta regla',
      other: '{count} variables sin resolver en esta regla',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'sin resolver',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'fuera de ámbito',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'espacio de nombres desconocido',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'ref. de paso fuera de ámbito',
  'workbench.editors.rule.resolution.reason.empty': 'vacía',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'valor no válido',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'autorización requerida',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'secreto no encontrado',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'gestor no disponible',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    'no hay ejecución en caché para el entorno «{envName}» — abre el workflow y haz clic en Actualizar bajo ' +
    'ese entorno para rellenarla',
  'workbench.editors.rule.resolution.hint.disabledLv':
    'la variable Live está desactivada — actívala en el editor de Variables Live',
  'workbench.editors.rule.resolution.hint.draftLv':
    'la variable Live es un borrador — ábrela y haz clic en Guardar para publicarla',
  'workbench.editors.rule.resolution.noEnvironment': 'Sin entorno',
  'workbench.editors.rule.resolution.activeEnvFallback': 'entorno activo',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Acciones',
  'workbench.editors.rule.fields.addAction': 'Añadir una acción',
  'workbench.editors.rule.fields.reset': 'Restablecer',
  'workbench.editors.rule.fields.optionalTag': '(opcional)',
  'workbench.editors.rule.fields.opAddReplace': 'Añadir / Reemplazar',
  'workbench.editors.rule.fields.opAppend': 'Anexar',
  'workbench.editors.rule.fields.opRemove': 'Quitar',
  'workbench.editors.rule.fields.opMerge': 'Fusionar',
  'workbench.editors.rule.fields.opReplaceOnly': 'Solo reemplazar',
  'workbench.editors.rule.fields.opRemoveAll': 'Quitar todo',
  'workbench.editors.rule.fields.operatorEquals': 'Igual a',
  'workbench.editors.rule.fields.operatorContains': 'Contiene',
  'workbench.editors.rule.fields.restApi': 'API REST',
  'workbench.editors.rule.fields.graphqlApi': 'API GraphQL',
  'workbench.editors.rule.fields.staticData': 'Datos estáticos',
  'workbench.editors.rule.fields.dynamicJs': 'Dinámico (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Formateado',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Sin procesar',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    'La vista formateada solo está disponible para cuerpos con forma JSON.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Vista formateada',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Cuerpo',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Formateado y Sin procesar son dos vistas del mismo texto de cuerpo — el texto de red es lo que la regla ' +
    'sirve.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Ejemplo — un valor, dos vistas',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Modos',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'Una vista de lectura — solo cambian los espacios. Las ediciones se recodifican al formato de red ' +
    'original, y Guardar escribe ese texto de red; guardar sin ediciones escribe exactamente los bytes ' +
    'originales.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    'El texto de red en sí — exactamente lo que la regla sirve.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'Operación GraphQL (filtro de carga útil de solicitud)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Clave, p. ej. operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'valor, p. ej. getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'Regla de encabezados',
  'workbench.editors.rule.fields.header.infoSummary':
    'Reescribe encabezados de solicitud y de respuesta en el tráfico coincidente.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Las combinaciones no válidas (p. ej. Anexar en un encabezado personalizado) marcan la regla como ' +
    'borrador. Los borradores se guardan pero no se ejecutan.',
  'workbench.editors.rule.fields.header.requestTab': 'Encabezados de solicitud',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'Acciones de encabezado aplicadas a la solicitud saliente antes de que salga del navegador.',
  'workbench.editors.rule.fields.header.responseTab': 'Encabezados de respuesta',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'Acciones de encabezado aplicadas a la respuesta antes de que la página la vea.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'La pestaña Network de las DevTools del propio navegador muestra siempre los encabezados originales del ' +
    'servidor, así que estos cambios son invisibles allí aunque se apliquen. La ventana de DevTools de Open ' +
    'Headers no tiene esa limitación — muestra los encabezados exactamente como se sirven a la página.',
  'workbench.editors.rule.fields.header.emptyRequest':
    'Sin acciones — esta regla deja los encabezados de solicitud sin cambios',
  'workbench.editors.rule.fields.header.emptyResponse':
    'Sin acciones — esta regla deja los encabezados de respuesta sin cambios',
  'workbench.editors.rule.fields.header.namePlaceholder': 'Nombre del encabezado',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'Valor del encabezado',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Valor a anexar',
  'workbench.editors.rule.fields.header.existingValue': 'valor existente',
  'workbench.editors.rule.fields.header.switchTo': 'Cambiar a {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Arrastra para reordenar',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Regla de bloqueo',
  'workbench.editors.rule.fields.block.infoSummary':
    'El bloqueo cancela las solicitudes coincidentes antes de que salgan del navegador.',
  'workbench.editors.rule.fields.block.infoDescription':
    'No hace falta configurar ninguna acción — el bloqueo en sí es la acción; las condiciones deciden qué se ' +
    'bloquea.',
  'workbench.editors.rule.fields.block.title': 'Bloquear solicitudes',
  'workbench.editors.rule.fields.block.body':
    'Las solicitudes que coincidan con las condiciones de abajo se bloquearán. El navegador mostrará un error ' +
    'de red a la página.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Regla de redirección',
  'workbench.editors.rule.fields.redirect.infoSummary':
    'Envía las solicitudes coincidentes a otra URL antes de que lleguen a la red.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'Con una condición Regex de URL, \\1, \\2 … sustituyen los grupos capturados en la URL de destino.',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Redirige a',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Otra URL',
  'workbench.editors.rule.fields.redirect.localFile': 'Archivo local',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'Disponible en la aplicación de escritorio',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    'p. ej. https://openheaders.com/redirected — usa \\1, \\2 con condiciones Regex de URL',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Regla de parámetros de consulta',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Añade, reemplaza o quita parámetros de consulta en las URL de solicitud coincidentes.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    'Quitar todo elimina la cadena de consulta entera; las entradas Añadir / Reemplazar de la misma regla se ' +
    'convierten entonces en la nueva consulta. Las entradas Solo reemplazar y Quitar ya no tienen sobre qué ' +
    'actuar y se ignoran junto a Quitar todo.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    'Quitar todo elimina la cadena de consulta entera, así que las entradas Solo reemplazar y Quitar no ' +
    'tienen sobre qué actuar y se ignoran. Las entradas Añadir / Reemplazar sí se aplican — se convierten en ' +
    'la nueva consulta.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'Quita todos los parámetros de consulta de la URL',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Nombre del parámetro',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Valor del parámetro',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': 'Regla de inyección',
  'workbench.editors.rule.fields.inject.infoSummary':
    'Inyecta un script o una hoja de estilos en las páginas coincidentes mientras se cargan.',
  'workbench.editors.rule.fields.inject.language': 'Lenguaje:',
  'workbench.editors.rule.fields.inject.codeSource': 'Origen del código:',
  'workbench.editors.rule.fields.inject.insert': 'Inserción:',
  'workbench.editors.rule.fields.inject.sourceCode': 'Código',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'Tras la carga de la página',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'Lo antes posible',
  'workbench.editors.rule.fields.inject.source': 'Origen',
  'workbench.editors.rule.fields.inject.code': 'Código',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': 'Introduce la URL de origen (relativa o absoluta)',
  'workbench.editors.rule.fields.inject.bypassCsp':
    'Omitir Content-Security-Policy para que los scripts inyectados se ejecuten siempre',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    'Por ahora cubre solo la CSP de encabezado — una CSP <meta> aún puede bloquear este script. Para omitir ' +
    'ambas, activa «Allow user scripts» para esta extensión en la configuración de extensiones de tu ' +
    'navegador.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Regla de retraso',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Retiene las solicitudes coincidentes durante el tiempo configurado antes de dejarlas continuar.',
  'workbench.editors.rule.fields.delay.capsAlert':
    'Las navegaciones de documento y de iframe se retrasan hasta 30 000 ms mediante una página de espera ' +
    'local. Los XHR/Fetch iniciados por JS se limitan a 5 000 ms para evitar agotar el pool de conexiones ' +
    'HTTP. Los subrecursos (CSS, JS, imágenes) no se retrasan.',
  'workbench.editors.rule.fields.delay.label': 'Retraso',
  'workbench.editors.rule.fields.delay.maxNote': 'Máx. 30 000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Regla de cuerpo de solicitud',
  'workbench.editors.rule.fields.requestBody.infoSummary':
    'Reemplaza el cuerpo de las solicitudes coincidentes antes de enviarlas.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    'Datos estáticos intercambia una carga útil fija; Dinámico ejecuta JavaScript sobre el cuerpo original.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Intercepta las llamadas fetch() y XMLHttpRequest de las solicitudes API REST o GraphQL.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Selecciona el tipo de recurso',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Cuerpo de solicitud',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Tu función recibe',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'y debe devolver el cuerpo modificado. Devuelve una cadena o un objeto (autoserializado a JSON).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Regla de respuesta',
  'workbench.editors.rule.fields.response.infoSummary':
    'Sirve una respuesta sustituta a las solicitudes coincidentes en lugar de lo que devolvió el servidor.',
  'workbench.editors.rule.fields.response.infoDescription':
    'Datos estáticos sirve una carga útil fija; Dinámico ejecuta JavaScript sobre la respuesta original.',
  'workbench.editors.rule.fields.response.sourceLabel': 'Origen de la respuesta',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Actúa sobre las respuestas fetch() y XMLHttpRequest de las solicitudes API REST o GraphQL.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock sirve tu cuerpo sin llamar al servidor; Modificación envía la solicitud real y edita la respuesta ' +
    'antes de que la página la vea.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock — no se envía ninguna solicitud',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 Modificación — editar la respuesta del servidor',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'La solicitud real se envía; tus cambios se aplican a la respuesta antes de que la página la vea.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'La solicitud nunca sale del navegador — la página recibe tu respuesta directamente.',
  'workbench.editors.rule.fields.response.resourceType': 'Tipo de recurso',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'A qué forma de carga útil de API apunta la regla — REST o GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL desbloquea un filtro de operación más abajo, de modo que la regla puede coincidir con una sola ' +
    'operación dentro de un endpoint compartido.',
  'workbench.editors.rule.fields.response.statusCode': 'Código de estado',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'El estado HTTP servido con tu respuesta.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    'Elige un código para servirlo, o conserva el original de la respuesta del servidor cuando se llama al ' +
    'servidor.',
  'workbench.editors.rule.fields.response.keepOriginalStatus': 'Conservar el código de estado original',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'El encabezado Content-Type servido con el cuerpo — controla cómo lo analiza el navegador.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    'Escribe cualquier valor; las sugerencias son una comodidad. Cuando se llama al servidor, solo ' +
    'sobrescribe el Content-Type de la respuesta real si está definido.',
  'workbench.editors.rule.fields.response.headersLabel': 'Encabezados de respuesta',
  'workbench.editors.rule.fields.response.headersInfoSummary': 'Encabezados extra servidos junto a Content-Type.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'Cuando se llama al servidor, se fusionan sobre los encabezados de la respuesta real; en modo mock se ' +
    'convierten en los encabezados de la respuesta. Las filas vacías se descartan al guardar.',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'Nombre de encabezado (p. ej. X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'Valor de encabezado',
  'workbench.editors.rule.fields.response.addHeader': 'Añadir un encabezado',
  'workbench.editors.rule.fields.response.bodyLabel': 'Cuerpo de respuesta',
  'workbench.editors.rule.fields.response.bodyInfoSummary':
    'La carga útil servida a la página para las solicitudes coincidentes.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Datos estáticos sirve un cuerpo fijo; Dinámico (JavaScript) lo construye o lo transforma en el momento ' +
    'de la solicitud.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': 'La solicitud real se envía primero. Tu',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'función recibe la respuesta y el contexto de la solicitud, y devuelve la respuesta modificada. Devuelve ' +
    'una cadena o un objeto (autoserializado a JSON).',
  'workbench.editors.rule.fields.response.dynMockBefore': 'No se envía ninguna solicitud. Tu',
  'workbench.editors.rule.fields.response.dynMockMid': 'función recibe',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'y devuelve el cuerpo de la respuesta. Devuelve una cadena o un objeto (autoserializado a JSON).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'Regla WebSocket',
  'workbench.editors.rule.fields.message.sseKicker': 'Regla SSE',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Modifica, inyecta o descarta frames WebSocket en las conexiones coincidentes antes de que la página o la ' +
    'red los vean.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Modifica, inyecta o descarta eventos de servidor en los streams coincidentes antes de que los listeners ' +
    'los vean.',
  'workbench.editors.rule.fields.message.wsIntro':
    'Intercepta las conexiones WebSocket creadas por la página cuya URL de socket coincide con las ' +
    'condiciones. Los frames se modifican, inyectan o descartan en la página antes de llegar al código de la ' +
    'página (entrantes) o a la red (salientes).',
  'workbench.editors.rule.fields.message.sseIntro':
    'Intercepta los streams EventSource creados por la página cuya URL coincide con las condiciones. Los ' +
    'eventos se modifican, inyectan o descartan en la página antes de que los listeners los vean.',
  'workbench.editors.rule.fields.message.operation': 'Operación',
  'workbench.editors.rule.fields.message.opReplace': 'Sustituir',
  'workbench.editors.rule.fields.message.opInject': 'Inyectar',
  'workbench.editors.rule.fields.message.opDrop': 'Descartar',
  'workbench.editors.rule.fields.message.direction': 'Dirección',
  'workbench.editors.rule.fields.message.incoming': 'Entrante (servidor → página)',
  'workbench.editors.rule.fields.message.outgoing': 'Saliente (página → servidor)',
  'workbench.editors.rule.fields.message.eventName': 'Nombre del evento',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Vacío = eventos message por defecto',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'Coincide con el campo',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'del stream',
  'workbench.editors.rule.fields.message.frameFilter': 'Filtro de frames',
  'workbench.editors.rule.fields.message.dataFilter': 'Filtro de datos',
  'workbench.editors.rule.fields.message.everyFrame': 'Cada frame',
  'workbench.editors.rule.fields.message.everyEvent': 'Cada evento',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'Los filtros solo coinciden con frames de texto — los frames binarios pasan cuando hay un filtro definido.',
  'workbench.editors.rule.fields.message.filterNoteSse': 'Los filtros solo coinciden con eventos de texto.',
  'workbench.editors.rule.fields.message.injectWhen': 'Inyectar cuando',
  'workbench.editors.rule.fields.message.connectionOpens': 'Se abre la conexión',
  'workbench.editors.rule.fields.message.streamOpens': 'Se abre el stream',
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'Llega un frame coincidente',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'Llega un evento coincidente',
  'workbench.editors.rule.fields.message.injectedFrame': 'Frame inyectado',
  'workbench.editors.rule.fields.message.injectedEvent': 'Evento inyectado',
  'workbench.editors.rule.fields.message.replacementFrame': 'Frame de sustitución',
  'workbench.editors.rule.fields.message.replacementEvent': 'Evento de sustitución',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': 'Regla de autenticación',
  'workbench.editors.rule.fields.auth.infoSummary':
    'Responde a los desafíos de autenticación HTTP o de proxy en las solicitudes coincidentes con estas ' +
    'credenciales.',
  'workbench.editors.rule.fields.auth.infoDescription':
    'Ambos campos resuelven {{templates}}, así que el secreto real puede vivir en el vault ({{vault.*}}) en ' +
    'lugar de en claro en la regla. Solo surte efecto en las pestañas dentro del alcance del modo de ' +
    'depuración.',
  'workbench.editors.rule.fields.auth.introBefore':
    'Responde a un desafío de autenticación de servidor (401) o de proxy (407) en las solicitudes ' +
    'coincidentes. Referencia un secreto del vault — p. ej.',
  'workbench.editors.rule.fields.auth.introAfter': '— así la credencial no se guarda en la regla.',
  'workbench.editors.rule.fields.auth.username': 'Nombre de usuario',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'p. ej. dev-user o {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Contraseña',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'p. ej. {{vault.STAGING_PW}}',
} as const satisfies Catalog;
