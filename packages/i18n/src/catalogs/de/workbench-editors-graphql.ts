/**
 * Workbench editors — the GraphQL client editor, German. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}` envelope
 * names, SDL, introspection) rides raw inside keyed values. „Schema“
 * stays; „Explorer“ stays; „Variablen“ = variables.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'GraphQL-Anfrage nicht gefunden.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Stopp',
  'workbench.editors.graphql.query.stopTooltip': 'Die Abfrage stoppen und behalten, was angekommen ist',
  'workbench.editors.graphql.operation.placeholder': 'Operation',
  'workbench.editors.graphql.operation.tooltip':
    'Die Operation, die Query ausführt — das Dokument enthält mehrere; die Wahl geht als operationName über die Leitung.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Fehler', other: '{count} Fehler' }),
  'workbench.editors.graphql.response.errorsTitle': 'GraphQL-Fehler',
  'workbench.editors.graphql.response.errorsSummary':
    'Der Server antwortete mit HTTP {status} und einer errors[]-Liste — ein Feld schlug fehl, das Dokument wurde abgelehnt oder die Authentifizierung fehlte. Lies data daneben: partiell oder null.',
  'workbench.editors.graphql.response.dataNull':
    'data ist null — jedes Wurzelfeld hat den Null-Wert hochgereicht, oder die Anfrage wurde vor der Ausführung abgelehnt.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Antwort-Extensions',
  'workbench.editors.graphql.response.extensionsSummary':
    'Das extensions-Objekt des Servers reist neben data — Tracing, Kosten, Cache-Hinweise, was immer er anhängen wollte.',
  'workbench.editors.graphql.query.hint': 'Das Dokument — eine oder mehrere Operationen, Fragmente willkommen.',
  'workbench.editors.graphql.query.prettify': 'Formatieren',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Autorisierung',
  'workbench.editors.graphql.tab.headers': 'Header',
  'workbench.editors.graphql.tab.schema': 'Schema',
  'workbench.editors.graphql.tab.scripts': 'Skripte',
  'workbench.editors.graphql.tab.settings': 'Einstellungen',
  'workbench.editors.graphql.explorer.emptyTitle': 'Die auf dem Server verfügbaren Daten erkunden',
  'workbench.editors.graphql.explorer.emptyHint':
    'Geben Sie die Server-URL ein, um das Schema per Introspektion zu laden.',
  'workbench.editors.graphql.explorer.introspect': 'GraphQL-Introspektion verwenden',
  'workbench.editors.graphql.explorer.useSpec': 'Eine GraphQL-Spezifikation verwenden',
  'workbench.editors.graphql.explorer.importSchema': 'Ein GraphQL-Schema importieren',
  'workbench.editors.graphql.explorer.landsWithSchema': 'Kommt mit dem Schema-Abschnitt.',
  'workbench.editors.graphql.variables.title': 'Variablen',
  'workbench.editors.graphql.variables.generate': 'Variablen erzeugen',
  'workbench.editors.graphql.variables.generateHint':
    'Die Variablen aus den Variablendefinitionen der ausgewählten Operation füllen.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'Die ausgewählte Operation deklariert keine Variablen.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Jede GraphQL-Operation sendet den Umschlag {query, variables, operationName} als JSON. Fügen Sie eine eigene Content-Type-Zeile hinzu, um ihn zu überschreiben.',
  'workbench.editors.graphql.schema.sourceLabel': 'Schemaquelle',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Ein Schema auswählen oder einen Link darauf einfügen',
  'workbench.editors.graphql.schema.or': 'ODER',
  'workbench.editors.graphql.schema.hint':
    'Das Schema speist Explorer, Vervollständigung und Validierung — per Introspektion vom Server über die Authentifizierung und Einstellungen dieser Anfrage, verknüpft aus einer GraphQL-Spezifikation oder importiert aus einer SDL- oder Introspektionsdatei.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Vor der Abfrage',
  'workbench.editors.graphql.scripts.afterResponse': 'Nach der Antwort',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Diese GraphQL-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.graphql.toast.updateFailed': 'Das Speichern der GraphQL-Anfrage ist fehlgeschlagen',
  'workbench.editors.graphql.toast.updateFailedDetail':
    'Das Speichern der GraphQL-Anfrage ist fehlgeschlagen: {message}',
} as const satisfies Catalog;
