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
  'workbench.editors.graphql.variables.title': 'Variablen',
  'workbench.editors.graphql.variables.generate': 'Variablen erzeugen',
  'workbench.editors.graphql.variables.generateHint':
    'Die Variablen aus den Variablendefinitionen der ausgewählten Operation füllen.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'Die ausgewählte Operation deklariert keine Variablen.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Jede GraphQL-Operation sendet den Umschlag {query, variables, operationName} als JSON. Fügen Sie eine eigene Content-Type-Zeile hinzu, um ihn zu überschreiben.',
  'workbench.editors.graphql.schema.sourceLabel': 'Schemaquelle',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Eine Schemaquelle auswählen',
  'workbench.editors.graphql.schema.or': 'ODER',
  'workbench.editors.graphql.schema.hint':
    'Das Schema speist Explorer, Vervollständigung und Validierung — per Introspektion vom Server über die Authentifizierung und Einstellungen dieser Anfrage, verknüpft aus einer GraphQL-Spezifikation oder importiert aus einer SDL- oder Introspektionsdatei.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Vor der Abfrage',
  'workbench.editors.graphql.scripts.afterResponse': 'Nach der Antwort',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Diese GraphQL-Anfrage wurde in einem anderen Tab gelöscht.',
  'workbench.editors.graphql.toast.updateFailed': 'Das Speichern der GraphQL-Anfrage ist fehlgeschlagen',
  'workbench.editors.graphql.toast.updateFailedDetail':
    'Das Speichern der GraphQL-Anfrage ist fehlgeschlagen: {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Zuerst die Endpunkt-URL eingeben.',
  'workbench.editors.graphql.explorer.introspecting': 'Introspektion läuft…',
  'workbench.editors.graphql.explorer.search': 'Typen und Felder suchen',
  'workbench.editors.graphql.explorer.noResults': 'Nichts passt zu „{term}“.',
  'workbench.editors.graphql.explorer.back': 'Zurück',
  'workbench.editors.graphql.explorer.fields': 'Felder',
  'workbench.editors.graphql.explorer.arguments': 'Argumente',
  'workbench.editors.graphql.explorer.values': 'Werte',
  'workbench.editors.graphql.explorer.inputFields': 'Eingabefelder',
  'workbench.editors.graphql.explorer.implements': 'Implementiert',
  'workbench.editors.graphql.explorer.possibleTypes': 'Mögliche Typen',
  'workbench.editors.graphql.explorer.returns': 'Gibt zurück',
  'workbench.editors.graphql.explorer.specifiedBy': 'Spezifiziert durch',
  'workbench.editors.graphql.explorer.deprecated': 'Veraltet: {reason}',
  'workbench.editors.graphql.explorer.insert': 'Am Cursor einfügen',
  'workbench.editors.graphql.explorer.insertHint':
    'Fügt das Feld an der Cursorposition ins Dokument ein — Pflichtargumente als Variablen, ein leerer Auswahlsatz, wenn es ein Objekt liefert. Einbahnstraße: das Dokument bleibt deins.',
  'workbench.editors.graphql.schema.source.introspection': 'GraphQL-Introspektion',
  'workbench.editors.graphql.schema.source.spec': 'Verknüpfte GraphQL-Spec',
  'workbench.editors.graphql.schema.refresh': 'Aktualisieren',
  'workbench.editors.graphql.schema.fetchedAt': 'Introspektion vom {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Noch keine Introspektion — das Schema wird vom Endpunkt mit der Authentifizierung, den Headern und den Einstellungen dieser Anfrage geladen.',
  'workbench.editors.graphql.schema.introspectFailed': 'Introspektion fehlgeschlagen: {message}',
  'workbench.editors.graphql.schema.specLabel': 'GraphQL-Spec',
  'workbench.editors.graphql.schema.specPlaceholder': 'Eine GraphQL-Spec auswählen',
  'workbench.editors.graphql.schema.specMissing': 'Die verknüpfte Spec existiert in diesem Arbeitsbereich nicht mehr.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Typ', other: '{count} Typen' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Schemaproblem', other: '{count} Schemaprobleme' }),
  'workbench.editors.graphql.schema.importReadFailed': 'Die Datei konnte nicht gelesen werden: {message}',
  'workbench.editors.graphql.schema.importFailed': 'Der Schema-Import ist fehlgeschlagen',
  'workbench.editors.graphql.schema.imported': '„{name}“ als GraphQL-Spec importiert und verknüpft.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Problem', other: '{count} Probleme' }),
} as const satisfies Catalog;
