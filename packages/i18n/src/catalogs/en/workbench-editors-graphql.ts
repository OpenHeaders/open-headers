/**
 * Workbench editors — the GraphQL client editor. Wire vocabulary
 * (GraphQL, the `{query, variables, operationName}` envelope names,
 * SDL, introspection) rides raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'GraphQL request not found.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Stop',
  'workbench.editors.graphql.query.stopTooltip': 'Stop the query and keep what has arrived',
  'workbench.editors.graphql.operation.placeholder': 'Operation',
  'workbench.editors.graphql.operation.tooltip':
    'The operation this Query runs — the document holds several; the pick rides the wire as operationName.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', other: '{count} errors' }),
  'workbench.editors.graphql.response.errorsTitle': 'GraphQL errors',
  'workbench.editors.graphql.response.errorsSummary':
    'The server answered HTTP {status} with an errors[] list — a field failed, the document was refused, or auth was missing. Read data beside it: partial, or null.',
  'workbench.editors.graphql.response.dataNull':
    'data is null — every root field bubbled, or the request was refused before execution.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Response extensions',
  'workbench.editors.graphql.response.extensionsSummary':
    'The server’s extensions object rides beside data — tracing, cost, cache hints, whatever it chose to attach.',
  'workbench.editors.graphql.query.hint': 'The document — one or more operations, fragments welcome.',
  'workbench.editors.graphql.query.prettify': 'Prettify',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Authorization',
  'workbench.editors.graphql.tab.headers': 'Headers',
  'workbench.editors.graphql.tab.schema': 'Schema',
  'workbench.editors.graphql.tab.scripts': 'Scripts',
  'workbench.editors.graphql.tab.settings': 'Settings',
  'workbench.editors.graphql.explorer.emptyTitle': 'Explore data available from the server',
  'workbench.editors.graphql.explorer.emptyHint': 'Enter the server URL to load the schema using introspection.',
  'workbench.editors.graphql.explorer.introspect': 'Use GraphQL introspection',
  'workbench.editors.graphql.explorer.useSpec': 'Use a GraphQL spec',
  'workbench.editors.graphql.explorer.importSchema': 'Import a GraphQL schema',
  'workbench.editors.graphql.explorer.landsWithSchema': 'Lands with the schema slice.',
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Generate variables',
  'workbench.editors.graphql.variables.generateHint':
    'Fill the variables from the selected operation’s variable definitions.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'The selected operation declares no variables.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Every GraphQL operation posts the {query, variables, operationName} envelope as JSON. Add your own Content-Type row to override.',
  'workbench.editors.graphql.schema.sourceLabel': 'Schema source',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Select a schema or paste a link to one',
  'workbench.editors.graphql.schema.or': 'OR',
  'workbench.editors.graphql.schema.hint':
    'The schema feeds the explorer, completion and validation — introspected from the server through this request’s auth and settings, linked from a GraphQL spec, or imported from an SDL or introspection file.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Before query',
  'workbench.editors.graphql.scripts.afterResponse': 'After response',
  'workbench.editors.graphql.toast.deletedOtherTab': 'This GraphQL request was deleted in another tab.',
  'workbench.editors.graphql.toast.updateFailed': 'Saving the GraphQL request failed',
  'workbench.editors.graphql.toast.updateFailedDetail': 'Saving the GraphQL request failed: {message}',
} as const satisfies Catalog;
