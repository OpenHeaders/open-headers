/**
 * Workbench editors — the GraphQL client editor, Spanish. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}` envelope
 * names, SDL, introspection) rides raw inside keyed values. «esquema»
 * = schema; «explorador» = explorer; «variables» stays.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'Solicitud GraphQL no encontrada.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Detener',
  'workbench.editors.graphql.query.stopTooltip': 'Detener la consulta y conservar lo que ha llegado',
  'workbench.editors.graphql.operation.placeholder': 'Operación',
  'workbench.editors.graphql.operation.tooltip':
    'La operación que Query ejecuta — el documento contiene varias; la elección viaja por el cable como operationName.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', many: '{count} errores', other: '{count} errores' }),
  'workbench.editors.graphql.response.errorsTitle': 'Errores GraphQL',
  'workbench.editors.graphql.response.errorsSummary':
    'El servidor respondió HTTP {status} con una lista errors[] — un campo falló, el documento fue rechazado o faltaba la autenticación. Lee data al lado: parcial, o null.',
  'workbench.editors.graphql.response.dataNull':
    'data es null — cada campo raíz propagó el nulo, o la solicitud fue rechazada antes de ejecutarse.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Extensiones de la respuesta',
  'workbench.editors.graphql.response.extensionsSummary':
    'El objeto extensions del servidor viaja junto a data — trazas, coste, pistas de caché, lo que haya decidido adjuntar.',
  'workbench.editors.graphql.query.hint': 'El documento — una o más operaciones, fragmentos bienvenidos.',
  'workbench.editors.graphql.query.prettify': 'Embellecer',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Autorización',
  'workbench.editors.graphql.tab.headers': 'Encabezados',
  'workbench.editors.graphql.tab.schema': 'Esquema',
  'workbench.editors.graphql.tab.scripts': 'Scripts',
  'workbench.editors.graphql.tab.settings': 'Ajustes',
  'workbench.editors.graphql.explorer.emptyTitle': 'Explorar los datos disponibles en el servidor',
  'workbench.editors.graphql.explorer.emptyHint':
    'Introduce la URL del servidor para cargar el esquema mediante introspección.',
  'workbench.editors.graphql.explorer.introspect': 'Usar introspección GraphQL',
  'workbench.editors.graphql.explorer.useSpec': 'Usar una spec GraphQL',
  'workbench.editors.graphql.explorer.importSchema': 'Importar un esquema GraphQL',
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Generar variables',
  'workbench.editors.graphql.variables.generateHint':
    'Rellenar las variables a partir de las definiciones de variables de la operación seleccionada.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'La operación seleccionada no declara variables.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Cada operación GraphQL envía el sobre {query, variables, operationName} como JSON. Añade tu propia fila Content-Type para sustituirlo.',
  'workbench.editors.graphql.schema.sourceLabel': 'Origen del esquema',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Selecciona una fuente de esquema',
  'workbench.editors.graphql.schema.or': 'O',
  'workbench.editors.graphql.schema.hint':
    'El esquema alimenta el explorador, el autocompletado y la validación — introspeccionado desde el servidor con la autenticación y los ajustes de esta solicitud, enlazado desde una spec GraphQL o importado desde un archivo SDL o de introspección.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Antes de la consulta',
  'workbench.editors.graphql.scripts.afterResponse': 'Después de la respuesta',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Esta solicitud GraphQL se eliminó en otra pestaña.',
  'workbench.editors.graphql.toast.updateFailed': 'No se pudo guardar la solicitud GraphQL',
  'workbench.editors.graphql.toast.updateFailedDetail': 'No se pudo guardar la solicitud GraphQL: {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Introduce primero la URL del endpoint.',
  'workbench.editors.graphql.explorer.introspecting': 'Introspección en curso…',
  'workbench.editors.graphql.explorer.search': 'Buscar tipos y campos',
  'workbench.editors.graphql.explorer.noResults': 'Nada coincide con «{term}».',
  'workbench.editors.graphql.explorer.back': 'Atrás',
  'workbench.editors.graphql.explorer.fields': 'Campos',
  'workbench.editors.graphql.explorer.arguments': 'Argumentos',
  'workbench.editors.graphql.explorer.values': 'Valores',
  'workbench.editors.graphql.explorer.inputFields': 'Campos de entrada',
  'workbench.editors.graphql.explorer.implements': 'Implementa',
  'workbench.editors.graphql.explorer.possibleTypes': 'Tipos posibles',
  'workbench.editors.graphql.explorer.returns': 'Devuelve',
  'workbench.editors.graphql.explorer.specifiedBy': 'Especificado por',
  'workbench.editors.graphql.explorer.deprecated': 'Obsoleto: {reason}',
  'workbench.editors.graphql.explorer.insert': 'Insertar en el cursor',
  'workbench.editors.graphql.explorer.insertHint':
    'Añade el campo al documento en el cursor — sus argumentos obligatorios como variables, un conjunto de selección vacío si devuelve un objeto. En un solo sentido: el documento sigue siendo tuyo.',
  'workbench.editors.graphql.schema.source.introspection': 'Introspección GraphQL',
  'workbench.editors.graphql.schema.source.spec': 'Spec GraphQL vinculada',
  'workbench.editors.graphql.schema.refresh': 'Actualizar',
  'workbench.editors.graphql.schema.fetchedAt': 'Introspección realizada el {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Aún sin introspección — el esquema se carga desde el endpoint con la autenticación, las cabeceras y los ajustes de esta petición.',
  'workbench.editors.graphql.schema.introspectFailed': 'La introspección falló: {message}',
  'workbench.editors.graphql.schema.specLabel': 'Spec GraphQL',
  'workbench.editors.graphql.schema.specPlaceholder': 'Selecciona una spec GraphQL',
  'workbench.editors.graphql.schema.specMissing': 'La spec vinculada ya no existe en este espacio de trabajo.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} tipo', many: '{count} tipos', other: '{count} tipos' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} problema de esquema',
      many: '{count} problemas de esquema',
      other: '{count} problemas de esquema',
    }),
  'workbench.editors.graphql.schema.importReadFailed': 'La lectura del archivo falló: {message}',
  'workbench.editors.graphql.schema.importFailed': 'La importación del esquema falló',
  'workbench.editors.graphql.schema.imported': '«{name}» importado como spec GraphQL y vinculado.',
  'workbench.editors.graphql.explorer.title': 'Explorador de esquema',
  'workbench.editors.graphql.explorer.hide': 'Ocultar el explorador',
  'workbench.editors.graphql.explorer.show': 'Mostrar el explorador',
  'workbench.editors.graphql.explorer.showDescriptions': 'Mostrar descripciones',
  'workbench.editors.graphql.explorer.hideDescriptions': 'Ocultar descripciones',
  'workbench.editors.graphql.builder.broken': 'Corrige el documento para usar el constructor — no se puede analizar.',
  'workbench.editors.graphql.builder.otherOperation':
    'La operación del documento es una {operation} — solo sus campos raíz pueden seleccionarse aquí.',
  'workbench.editors.graphql.builder.expand': 'Expandir',
  'workbench.editors.graphql.builder.collapse': 'Contraer',
  'workbench.editors.graphql.builder.fragmentReadOnly':
    'Los fragmentos son de solo lectura aquí — edítalos en el documento.',
  'workbench.editors.graphql.builder.argumentPlaceholder': 'valor o $variable',
  'workbench.editors.graphql.builder.invalidValue': 'No es un valor GraphQL.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} problema', many: '{count} problemas', other: '{count} problemas' }),
} as const satisfies Catalog;
