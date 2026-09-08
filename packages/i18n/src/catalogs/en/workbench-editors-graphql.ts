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
  'workbench.editors.graphql.explorer.loadFailed': 'Could not load the GraphQL schema.',
  'workbench.editors.graphql.explorer.tryAgain': 'Try again',
  'workbench.editors.graphql.explorer.useSpec': 'Use a GraphQL spec',
  'workbench.editors.graphql.explorer.importSchema': 'Import a GraphQL schema',
  'workbench.editors.graphql.variables.title': 'Variables',
  'workbench.editors.graphql.variables.generate': 'Generate variables',
  'workbench.editors.graphql.variables.generateHint':
    'Fill the variables from the selected operation’s variable definitions.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'The selected operation declares no variables.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Every GraphQL operation posts the {query, variables, operationName} envelope as JSON. Add your own Content-Type row to override.',
  'workbench.editors.graphql.schema.sourceLabel': 'Schema source',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Select a schema source',
  'workbench.editors.graphql.schema.or': 'OR',
  'workbench.editors.graphql.schema.hint':
    'The schema feeds the explorer, completion and validation — introspected from the server through this request’s auth and settings, linked from a GraphQL spec, or imported from an SDL or introspection file.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Before query',
  'workbench.editors.graphql.scripts.afterResponse': 'After response',
  'workbench.editors.graphql.toast.deletedOtherTab': 'This GraphQL request was deleted in another tab.',
  'workbench.editors.graphql.toast.updateFailed': 'Saving the GraphQL request failed',
  'workbench.editors.graphql.toast.updateFailedDetail': 'Saving the GraphQL request failed: {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Enter the endpoint URL first.',
  'workbench.editors.graphql.explorer.introspecting': 'Introspecting…',
  'workbench.editors.graphql.explorer.search': 'Search types and fields',
  'workbench.editors.graphql.explorer.noResults': 'Nothing matches “{term}”.',
  'workbench.editors.graphql.explorer.back': 'Back',
  'workbench.editors.graphql.explorer.fields': 'Fields',
  'workbench.editors.graphql.explorer.arguments': 'Arguments',
  'workbench.editors.graphql.explorer.values': 'Values',
  'workbench.editors.graphql.explorer.inputFields': 'Input fields',
  'workbench.editors.graphql.explorer.implements': 'Implements',
  'workbench.editors.graphql.explorer.possibleTypes': 'Possible types',
  'workbench.editors.graphql.explorer.returns': 'Returns',
  'workbench.editors.graphql.explorer.specifiedBy': 'Specified by',
  'workbench.editors.graphql.explorer.deprecated': 'Deprecated: {reason}',
  'workbench.editors.graphql.explorer.insert': 'Insert at cursor',
  'workbench.editors.graphql.explorer.insertHint':
    'Adds the field to the document at the cursor — its required arguments as variables, an empty selection set when it returns an object. One-way: the document stays yours.',
  'workbench.editors.graphql.schema.source.introspection': 'GraphQL introspection',
  'workbench.editors.graphql.schema.source.spec': 'Linked GraphQL spec',
  'workbench.editors.graphql.schema.refresh': 'Refresh',
  'workbench.editors.graphql.schema.fetchedAt': 'Introspected {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Not introspected yet — the schema loads from the endpoint through this request’s auth, headers and settings.',
  'workbench.editors.graphql.schema.introspectFailed': 'Introspection failed: {message}',
  'workbench.editors.graphql.schema.specLabel': 'GraphQL spec',
  'workbench.editors.graphql.schema.specPlaceholder': 'Select a GraphQL spec',
  'workbench.editors.graphql.schema.specMissing': 'The linked spec no longer exists in this workspace.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} type', other: '{count} types' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} schema problem', other: '{count} schema problems' }),
  'workbench.editors.graphql.schema.importReadFailed': 'Reading the file failed: {message}',
  'workbench.editors.graphql.schema.importFailed': 'Importing the schema failed',
  'workbench.editors.graphql.schema.imported': 'Imported “{name}” as a GraphQL spec and linked it.',
  'workbench.editors.graphql.explorer.title': 'Schema explorer',
  'workbench.editors.graphql.explorer.hide': 'Hide the explorer',
  'workbench.editors.graphql.explorer.show': 'Show the explorer',
  'workbench.editors.graphql.explorer.showDescriptions': 'Show descriptions',
  'workbench.editors.graphql.explorer.hideDescriptions': 'Hide descriptions',
  'workbench.editors.graphql.builder.broken': 'Fix the document to use the builder — it does not parse.',
  'workbench.editors.graphql.builder.otherOperation':
    'The document’s operation is a {operation} — only its root fields can be selected here.',
  'workbench.editors.graphql.builder.expand': 'Expand',
  'workbench.editors.graphql.builder.collapse': 'Collapse',
  'workbench.editors.graphql.builder.fragmentReadOnly': 'Fragments are read-only here — edit them in the document.',
  'workbench.editors.graphql.builder.argumentPlaceholder': 'value or $variable',
  'workbench.editors.graphql.builder.invalidValue': 'Not a GraphQL value.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} problem', other: '{count} problems' }),
  // ── Subscriptions (graphql-transport-ws over the WebSocket plane) ──
  'workbench.editors.graphql.subscription.tooltip':
    'Subscribe — opens the subscription over WebSocket (graphql-transport-ws) and streams its events',
  'workbench.editors.graphql.subscription.stopTooltip': 'Stop the subscription — sends complete and closes the session',
  'workbench.editors.graphql.subscription.browserHost': 'Subscriptions run on the desktop app or in the extension.',
  'workbench.editors.graphql.subscription.openFailed': 'Opening the subscription failed',
  'workbench.editors.graphql.subscription.paneTitle': 'Subscription',
  'workbench.editors.graphql.subscription.subscribing': 'Subscribing…',
  'workbench.editors.graphql.subscription.subscribed': 'Subscribed',
  'workbench.editors.graphql.subscription.completed': 'Completed',
  'workbench.editors.graphql.subscription.stopped': 'Stopped',
  'workbench.editors.graphql.subscription.errored': 'Error',
  'workbench.editors.graphql.subscription.closed': 'Closed {code}',
  'workbench.editors.graphql.subscription.events': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} event', other: '{count} events' }),
  'workbench.editors.graphql.subscription.errorsSummary':
    'The subscription answered an errors[] list — a field failed in an event, or the operation was refused before it started.',
  'workbench.editors.graphql.subscription.close.badRequest': 'Bad request',
  'workbench.editors.graphql.subscription.close.unauthorized': 'Unauthorized',
  'workbench.editors.graphql.subscription.close.forbidden': 'Forbidden',
  'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable': 'Subprotocol not acceptable',
  'workbench.editors.graphql.subscription.close.connectionInitTimeout': 'Connection initialisation timeout',
  'workbench.editors.graphql.subscription.close.subscriberAlreadyExists': 'Subscriber already exists',
  'workbench.editors.graphql.subscription.close.tooManyInitRequests': 'Too many initialisation requests',
} as const satisfies Catalog;
