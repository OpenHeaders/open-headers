/**
 * Workbench editors — the GraphQL client editor, Spanish. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}` envelope
 * names, SDL, introspection) rides raw inside keyed values. «esquema»
 * = schema; «explorador» = explorer; «variables» stays.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'Solicitud GraphQL no encontrada.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.pendingExecution': 'Ejecutar una consulta llega con la próxima entrega.',
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
  'workbench.editors.graphql.explorer.landsWithSchema': 'Llega con la entrega del esquema.',
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Generar variables',
  'workbench.editors.graphql.variables.generateHint':
    'Rellenar las variables a partir de las definiciones de variables de la operación seleccionada.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'La operación seleccionada no declara variables.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Cada operación GraphQL envía el sobre {query, variables, operationName} como JSON. Añade tu propia fila Content-Type para sustituirlo.',
  'workbench.editors.graphql.schema.sourceLabel': 'Origen del esquema',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Selecciona un esquema o pega un enlace a uno',
  'workbench.editors.graphql.schema.or': 'O',
  'workbench.editors.graphql.schema.hint':
    'El esquema alimenta el explorador, el autocompletado y la validación — introspeccionado desde el servidor con la autenticación y los ajustes de esta solicitud, enlazado desde una spec GraphQL o importado desde un archivo SDL o de introspección.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Antes de la consulta',
  'workbench.editors.graphql.scripts.afterResponse': 'Después de la respuesta',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Esta solicitud GraphQL se eliminó en otra pestaña.',
  'workbench.editors.graphql.toast.updateFailed': 'No se pudo guardar la solicitud GraphQL',
  'workbench.editors.graphql.toast.updateFailedDetail': 'No se pudo guardar la solicitud GraphQL: {message}',
} as const satisfies Catalog;
