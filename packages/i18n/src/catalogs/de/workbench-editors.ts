/**
 * Workbench editors — shared editor chrome — German. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the
 * {column} / {header} / {key} / {name} / {language} / {message} holes,
 * das Snippet raw (panel-inspector precedent), `Workflows` / `Tests`
 * group labels raw, `Body` raw (der Body — panel-storage precedent;
 * compounds Antwort-Body / JSON-Body keep the token intact). Script
 * rides raw in the workbench family (script-packages precedent; the
 * panel/popup catalogs' `Skript` stays theirs). Package-flow strings
 * shared with `workbench-script-packages.ts` (duplicate name,
 * not-found, save failed, empty states) reuse its de sentences
 * verbatim; Paketbibliothek per the chrome mint. Mints: **Erben** =
 * Inherit option label — `workbench-editors-request.ts` MUST reuse
 * it; Massenbearbeitung = Bulk; Schlüssel-Wert = Key-Value;
 * Verschönern = Beautify; Formatieren = Format (panel mint);
 * Anfrage-Entwurf = request draft (Entwurf carried from chrome).
 * Lowercase en `vault` stays lowercase (per-case token law).
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': 'Weitere Informationen',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': 'Verbindungsdetails',
  'workbench.editors.session.subprotocol': 'Subprotokoll',
  'workbench.editors.session.extensions': 'Erweiterungen',
  'workbench.editors.session.closeCode': 'Schließcode',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Schlüssel',
  'workbench.editors.grid.value': 'Wert',
  'workbench.editors.grid.description': 'Beschreibung',
  'workbench.editors.grid.showColumns': 'Spalten anzeigen',
  'workbench.editors.grid.tableOptions': 'Tabellenoptionen',
  'workbench.editors.grid.bulk': 'Massenbearbeitung',
  'workbench.editors.grid.keyValue': 'Schlüssel-Wert',
  'workbench.editors.grid.selectAllAria': 'Alle Zeilen aktivieren oder deaktivieren',
  'workbench.editors.grid.selectAllTitle': 'Alle aktivieren / deaktivieren',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Größe der Spalte {column} ändern',
  'workbench.editors.grid.overriddenBy': 'Duplikat — überschrieben durch die Zeile {header}, die du hinzugefügt hast.',
  'workbench.editors.grid.suggestionValueAria': 'Wert von {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'Anfragesammlung nicht gefunden.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Ordner nicht gefunden.',
  'workbench.editors.ancestorScripts.saveFailed': 'Scripts konnten nicht gespeichert werden.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Scripts konnten nicht gespeichert werden: {message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'Anfragesammlung nicht gefunden.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Ordner nicht gefunden.',
  'workbench.editors.ancestorAuth.saveFailed': 'Autorisierung konnte nicht gespeichert werden.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Autorisierung konnte nicht gespeichert werden: {message}',

  // ── Anfragen-Container-Editor (Sammlung / Ordner: ein Tab, Abschnitte) ──
  'workbench.editors.requestContainer.tab.overview': 'Übersicht',
  'workbench.editors.requestContainer.auth.emptyTitle': 'Keine Autorisierung konfiguriert',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    'Wähle einen Autorisierungstyp für die Anfragen in dieser Sammlung',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder':
    'Wähle einen Autorisierungstyp für die Anfragen in diesem Ordner',
  'workbench.editors.requestContainer.auth.authTypes': 'Autorisierungstypen',
  'workbench.editors.requestContainer.auth.addEntryAria': 'Autorisierungstyp hinzufügen',
  'workbench.editors.requestContainer.auth.change': 'Ändern',
  'workbench.editors.requestContainer.auth.changeHint': 'Die von {source} geerbte Autorisierung überschreiben.',
  'workbench.editors.requestContainer.auth.inheritedTag': 'Geerbt',
  'workbench.editors.requestContainer.auth.rename': 'Umbenennen',
  'workbench.editors.requestContainer.auth.noneEntryNote':
    'Anfragen, die diesen Eintrag verwenden, werden ohne Autorisierung gesendet.',
  'workbench.editors.requestContainer.auth.defaultTag': 'Standard',
  'workbench.editors.requestContainer.auth.setDefault': 'Als Standard festlegen',
  'workbench.editors.requestContainer.auth.deleteEntry': 'Löschen',
  'workbench.editors.requestContainer.auth.entryActionsAria': 'Eintragsaktionen',
  'workbench.editors.requestContainer.auth.appliesTo': 'Auf Host anwenden',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    'Optionales Host-Muster (*-Platzhalter). Eine Anfrage auf Erben, deren URL-Host passt, erhält diesen Eintrag vor dem Standard. Leer — nur als Standard oder über die Wahl einer Anfrage erreichbar.',
  'workbench.editors.requestContainer.auth.resetToInherited': 'Auf Geerbt zurücksetzen',
  'workbench.editors.requestContainer.auth.resetConfirm':
    'Einträge des Ordners entfernen? Anfragen fallen auf die Sammlung zurück.',
  'workbench.editors.requestContainer.deletedElsewhere': 'Dieses Element wurde in einem anderen Fenster gelöscht.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Beispiel wird geladen…',
  'workbench.editors.responseExample.notFound': 'Beispiel nicht gefunden.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'Das Beispiel wurde in einem anderen Tab gelöscht',
  'workbench.editors.responseExample.toast.saveFailed': 'Beispiel konnte nicht gespeichert werden',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'Beispiel konnte nicht gespeichert werden: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Als Anfrage öffnen',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Erstellt einen neuen Anfrage-Entwurf auf Basis der Anfrage dieses Beispiels',
  'workbench.editors.responseExample.editStatus': 'Statuscode bearbeiten',
  'workbench.editors.responseExample.statusPlaceholder': 'Antwortcode eingeben',
  'workbench.editors.responseExample.capturedTooltip': 'Erfasst am {date}',
  'workbench.editors.responseExample.moreActionsAria': 'Weitere Aktionen zur Antwort',
  'workbench.editors.responseExample.tab.body': 'Body',
  'workbench.editors.responseExample.tab.headers': 'Header ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Sprache für den Body',
  'workbench.editors.responseExample.format': 'Formatieren',
  'workbench.editors.responseExample.formatBody': 'Body formatieren',
  'workbench.editors.responseExample.noFormatter': 'Kein Formatierer für {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Pakete',
  'workbench.editors.scriptEditor.searchSnippets': 'Snippets suchen',
  'workbench.editors.scriptEditor.searchPackages': 'Pakete suchen',
  'workbench.editors.scriptEditor.noSnippetFound': 'Kein Snippet gefunden',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'Noch keine Pakete in diesem Arbeitsbereich',
  'workbench.editors.scriptEditor.noPackageFound': 'Kein Paket gefunden',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Paketbibliothek öffnen →',
  'workbench.editors.scriptEditor.saveToPackage': 'In der Paketbibliothek speichern',
  'workbench.editors.scriptEditor.newPackage': 'Neues Paket',
  'workbench.editors.scriptEditor.newPackageName': 'Name des neuen Pakets',
  'workbench.editors.scriptEditor.back': 'Zurück',
  'workbench.editors.scriptEditor.create': 'Erstellen',
  'workbench.editors.scriptEditor.orAppend': 'Oder an ein bestehendes Paket anfügen:',
  'workbench.editors.scriptEditor.noPackagesYet': 'Noch keine Pakete',
  'workbench.editors.scriptEditor.savedTo': 'Gespeichert in „{name}“',
  'workbench.editors.scriptEditor.packageCreated': 'Paket „{name}“ erstellt',
  'workbench.editors.scriptEditor.duplicatePackage':
    'Ein Paket namens „{name}“ existiert in diesem Arbeitsbereich bereits.',
  'workbench.editors.scriptEditor.packageNotFound': 'Paket nicht gefunden — es wurde möglicherweise gelöscht.',
  'workbench.editors.scriptEditor.saveFailed': 'Speichern fehlgeschlagen',
  'workbench.editors.scriptEditor.menuFind': 'Suchen',
  'workbench.editors.scriptEditor.find': 'Suchen',
  'workbench.editors.scriptEditor.replace': 'Ersetzen',
  'workbench.editors.scriptEditor.beautify': 'Verschönern',
  'workbench.editors.scriptEditor.group.request': 'Anfrage',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': 'Pakete',
  'workbench.editors.scriptEditor.group.variables': 'Variablen',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Eine HTTP-Anfrage senden',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Eine HTTP-Anfrage mit einem JSON-Body senden',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Eine Variable lesen',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Eine Variable setzen',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Ein Secret aus dem vault lesen',
  'workbench.editors.scriptEditor.snippet.usePackage': 'Ein Paket verwenden',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Einen Header setzen',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Einen Header entfernen',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Einen Query-Parameter setzen',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Einen Query-Parameter entfernen',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Die URL setzen',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Die Methode setzen',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Einen JSON-Body setzen',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Der Statuscode ist 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Der Antwort-Body enthält eine Zeichenkette',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Der Antwort-Body ist gleich einer Zeichenkette',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'Einen JSON-Wert im Antwort-Body prüfen',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Einen Antwort-Header prüfen',
  'workbench.editors.scriptEditor.snippet.responseTime': 'Die Antwortzeit liegt unter 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Einen Wert aus der Antwort in einer Variablen speichern',
  'workbench.editors.scriptEditor.group.connect': 'Verbindung',
  'workbench.editors.scriptEditor.group.send': 'Senden',
  'workbench.editors.scriptEditor.group.message': 'Nachricht',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'Subprotokoll-Angebot festlegen',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': 'Bei einem Wiederverbindungsversuch fortsetzen',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': 'Ausgehende Nachricht umschreiben',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': 'Ausgehende Nachricht verwerfen',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Socket.IO-Event umbenennen',
  'workbench.editors.scriptEditor.snippet.wsReply': 'Auf eine Nachricht antworten',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'Nachrichten über die Sitzung zählen',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Socket.IO-Event senden',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'Nachricht ist JSON',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'Einen Nachrichtenwert in einer Variable speichern',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'Sitzung sauber geschlossen',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'Nachrichten sind eingetroffen',
  'workbench.editors.scriptEditor.group.publish': 'Veröffentlichen',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': 'Client-ID setzen',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'CONNECT-Zugangsdaten setzen',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': 'Ein Topic beim Verbinden abonnieren',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': 'Das Testament setzen',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'Eine CONNECT-User-Property setzen',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': 'Einen Wiederverbindungsversuch markieren',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': 'Die ausgehende Payload umschreiben',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': 'Das Topic umleiten',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'QoS und Retain setzen',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': 'Die ausgehende Nachricht verwerfen',
  'workbench.editors.scriptEditor.snippet.mqttReply': 'Eine Antwort veröffentlichen',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': 'Nachrichten über die Sitzung zählen',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': 'Payload ist JSON',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue': 'Einen Payload-Wert in einer Variablen speichern',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': 'Sauber getrennt',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': 'Nachrichten sind eingetroffen',
} as const satisfies Catalog;
