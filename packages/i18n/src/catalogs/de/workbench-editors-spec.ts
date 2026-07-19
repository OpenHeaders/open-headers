/**
 * Workbench editors — the API spec editor — German. Mirrors
 * `catalogs/en/workbench-editors-spec.ts` key for key. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto
 * `package`/`import`/`service`/`message`/`enum`) and ride raw; `Files`
 * is app grouping and translates (`Dateien`). The AsyncAPI
 * Send/Receive badges mirror the document's `action` enum and stay
 * raw — a different referent from the Send button mint `Senden`.
 * MINTS: outline (document tree) = die Gliederung (Übersicht =
 * Overview pane title); path = der Pfad (the `Paths` group stays
 * raw); Root raw (`ROOT` badge, die Root-Datei — universal German
 * dev vocabulary); das Tag raw in prose; streaming modes = `Unär` /
 * `Server-Streaming` / `Client-Streaming` / `Bidirektionales
 * Streaming` (editors-grpc MUST reuse); `baseUrl` verbatim as a bare
 * variable name (never compounded). Field chips keep German noun
 * caps (Name / Beschreibung / Header / Parameter / Body); `auth`
 * rides raw as the code-ish field id.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Spezifikation nicht gefunden.',
  'workbench.editors.spec.deletedElsewhere': 'Diese Spezifikation wurde in einer anderen Sitzung gelöscht.',
  'workbench.editors.spec.saveFailed': 'Spezifikation konnte nicht gespeichert werden.',
  'workbench.editors.spec.validation.clean': 'Keine Probleme gefunden',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Fehler', other: '{count} Fehler' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Warnung', other: '{count} Warnungen' }),
  'workbench.editors.spec.outline.title': 'Übersicht',
  'workbench.editors.spec.outline.show': 'Übersicht anzeigen',
  'workbench.editors.spec.outline.hide': 'Übersicht ausblenden',
  'workbench.editors.spec.outline.empty': 'Die Gliederung erscheint, sobald sich das Dokument parsen lässt.',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Als Root-Datei markieren',
  'workbench.editors.spec.outline.fileMenuAria': 'Dateiaktionen',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.files': 'Dateien',
  'workbench.editors.spec.outline.streaming.unary': 'Unär',
  'workbench.editors.spec.outline.streaming.server': 'Server-Streaming',
  'workbench.editors.spec.outline.streaming.client': 'Client-Streaming',
  'workbench.editors.spec.outline.streaming.bidi': 'Bidirektionales Streaming',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Server hinzufügen',
  'workbench.editors.spec.outline.add.tag': 'Tag hinzufügen',
  'workbench.editors.spec.outline.add.path': 'Pfad hinzufügen',
  'workbench.editors.spec.outline.add.operation': 'Operation hinzufügen',
  'workbench.editors.spec.outline.add.schema': 'Schema hinzufügen',
  'workbench.editors.spec.outline.add.securityScheme': 'Sicherheitsschema hinzufügen',
  'workbench.editors.spec.outline.add.securityRequirement': 'Sicherheitsanforderung hinzufügen',
  'workbench.editors.spec.generate.button': 'Sammlung generieren',
  'workbench.editors.spec.generate.collectionsButton': 'Sammlungen',
  'workbench.editors.spec.generate.popoverTitle': 'Generierte Sammlungen',
  'workbench.editors.spec.generate.modalTitle': 'SAMMLUNG GENERIEREN',
  'workbench.editors.spec.generate.blurb':
    'Generiere eine Sammlung aus dieser Spezifikation. Operationen werden zu Anfragen unter einer ' +
    'Sammlungsvariablen baseUrl, Tags werden zu Ordnern, und Sicherheitsschemata werden der Autorisierung ' +
    'zugeordnet. Die Sammlung bleibt mit dieser Spezifikation verknüpft.',
  'workbench.editors.spec.generate.namePlaceholder': 'Name der Sammlung',
  'workbench.editors.spec.generate.nameRequired': 'Die Sammlung braucht einen Namen',
  'workbench.editors.spec.generate.dirtyHint':
    'Ungespeicherte Änderungen im Editor werden nicht einbezogen — die Generierung verwendet das zuletzt ' +
    'gespeicherte Dokument.',
  'workbench.editors.spec.generate.parseFailed': 'Diese Spezifikation lässt sich nicht parsen',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Ordner', other: '{count} Ordner' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Sammlungsvariable', other: '{count} Sammlungsvariablen' }),
  'workbench.editors.spec.generate.action': 'Generieren',
  'workbench.editors.spec.generate.success': '„{name}“ generiert — {summary}',
  'workbench.editors.spec.generate.failed': 'Sammlung konnte nicht erstellt werden.',
  'workbench.editors.spec.generate.linkFailed':
    'Die Sammlung wurde generiert, aber ihre Verknüpfung mit der Spezifikation konnte nicht gespeichert ' +
    'werden — sie erscheint nicht in dieser Liste.',
  'workbench.editors.spec.generateProto.blurb':
    'Generiere eine Sammlung aus dieser Spezifikation. Service-Methoden werden zu gRPC-Anfragen mit ' +
    'vorausgefüllten Beispielnachrichten, gruppiert in einem Ordner pro Service. Die Sammlung bleibt mit ' +
    'dieser Spezifikation verknüpft.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} gRPC-Anfrage', other: '{count} gRPC-Anfragen' }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Service', other: '{count} Services' }),
  'workbench.editors.spec.generateProto.empty':
    'Das Dokument deklariert keine Service-Methoden, aus denen generiert werden könnte.',
  'workbench.editors.spec.generateProto.partial': 'Mit Lücken generiert — {created} erstellt, {failed} fehlgeschlagen.',
  'workbench.editors.spec.generateWs.blurb':
    'Generiere eine Sammlung aus dieser Spezifikation. Operationen werden zu WebSocket-Anfragen an den ' +
    'ws/wss-Server des Dokuments, mit einer aus dem Schema des Kanals vorausgefüllten Beispielnachricht. Die ' +
    'Sammlung bleibt mit dieser Spezifikation verknüpft.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} WebSocket-Anfrage', other: '{count} WebSocket-Anfragen' }),
  'workbench.editors.spec.generateWs.empty':
    'Das Dokument deklariert keine Operationen, aus denen generiert werden könnte.',
  'workbench.editors.spec.generateWs.noWsServer':
    'Das Dokument deklariert keinen ws- oder wss-Server für die Verbindung.',
  'workbench.editors.spec.generateWs.partial': 'Mit Lücken generiert — {created} erstellt, {failed} fehlgeschlagen.',
  'workbench.editors.spec.generateWs.skipped': '{operation} übersprungen: {reason}.',
  'workbench.editors.spec.update.button': 'Aktualisieren',
  'workbench.editors.spec.update.protoUnavailable':
    'Aktualisieren aus einer Protobuf-Spezifikation ist noch nicht verfügbar — generiere eine frische ' +
    'Sammlung, um Änderungen zu übernehmen.',
  'workbench.editors.spec.update.inSyncBadge': 'Synchron mit dem gespeicherten Dokument',
  'workbench.editors.spec.update.driftedBadge': 'Die Spezifikation hat sich seit der letzten Aktualisierung geändert',
  'workbench.editors.spec.update.modalTitle': 'SAMMLUNG AKTUALISIEREN',
  'workbench.editors.spec.update.blurb':
    'Prüfe die Unterschiede zwischen dem gespeicherten Dokument und „{name}“ und wende die ausgewählten ' +
    'Aktualisierungen an. Nicht angehakte Zeilen bleiben unberührt.',
  'workbench.editors.spec.update.dirtyHint':
    'Ungespeicherte Änderungen im Editor werden nicht einbezogen — die Aktualisierung verwendet das zuletzt ' +
    'gespeicherte Dokument.',
  'workbench.editors.spec.update.parseFailed': 'Diese Spezifikation lässt sich nicht parsen',
  'workbench.editors.spec.update.inSync':
    'Keine Unterschiede auf Anfrageebene — Anwenden markiert die Sammlung als synchron mit dem gespeicherten ' +
    'Dokument.',
  'workbench.editors.spec.update.groupAdded': 'Hinzugefügt ({count})',
  'workbench.editors.spec.update.groupChanged': 'Geändert ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Aus der Spezifikation entfernt ({count})',
  'workbench.editors.spec.update.removeHint': 'Nicht angehakte Anfragen bleiben in der Sammlung.',
  'workbench.editors.spec.update.groupCollection': 'Sammlung',
  'workbench.editors.spec.update.variablesRow': 'Sammlungsvariablen',
  'workbench.editors.spec.update.authRow': 'Autorisierung der Sammlung',
  'workbench.editors.spec.update.field.name': 'Name',
  'workbench.editors.spec.update.field.description': 'Beschreibung',
  'workbench.editors.spec.update.field.headers': 'Header',
  'workbench.editors.spec.update.field.params': 'Parameter',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'Body',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Aktualisierung anwenden',
      other: '{count} Aktualisierungen anwenden',
    }),
  'workbench.editors.spec.update.markInSync': 'Als synchron markieren',
  'workbench.editors.spec.update.hashNote':
    'Anwenden hinterlegt diese Dokumentversion an der Verknüpfung der Sammlung, sodass die Verknüpfung als ' +
    'synchron gilt, auch wenn Zeilen nicht angehakt waren.',
  'workbench.editors.spec.update.success': '„{name}“ aktualisiert — {count} angewendet',
  'workbench.editors.spec.update.partial':
    '{applied} angewendet, {failed} fehlgeschlagen — die Sammlung ist möglicherweise nur teilweise aktualisiert.',
  'workbench.editors.spec.update.failed': 'Sammlung konnte nicht aktualisiert werden.',
} as const satisfies Catalog;
