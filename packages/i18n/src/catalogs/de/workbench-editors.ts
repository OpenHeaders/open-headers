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
  'workbench.editors.ancestorScripts.titleCollection': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.titleFolder': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.descriptionCollection':
    'Diese Scripts laufen für jede Anfrage in dieser Sammlung — das Pre-Request-Script vor jedem Senden, das ' +
    'Post-Response-Script nach jeder Antwort. Die Reihenfolge: erst die Scripts der Sammlung, dann die des ' +
    'Ordners, dann die eigenen Scripts der Anfrage.',
  'workbench.editors.ancestorScripts.descriptionFolder':
    'Diese Scripts laufen für jede Anfrage in diesem Ordner — das Pre-Request-Script vor jedem Senden, das ' +
    'Post-Response-Script nach jeder Antwort. Sie laufen nach den Scripts der Sammlung und vor den eigenen ' +
    'Scripts der Anfrage.',
  'workbench.editors.ancestorScripts.notFoundCollection': 'Anfragesammlung nicht gefunden.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Ordner nicht gefunden.',
  'workbench.editors.ancestorScripts.saveFailed': 'Scripts konnten nicht gespeichert werden.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Scripts konnten nicht gespeichert werden: {message}',
  'workbench.editors.ancestorScripts.deletedElsewhere': 'Dieses Element wurde in einem anderen Fenster gelöscht.',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.titleCollection': 'Autorisierung — {name}',
  'workbench.editors.ancestorAuth.titleFolder': 'Autorisierung — {name}',
  'workbench.editors.ancestorAuth.descriptionCollection':
    'Anfragen, die auf Erben eingestellt sind, verwenden diese Autorisierung. Die eigene Autorisierung eines ' +
    'Ordners hat Vorrang, und die explizite Autorisierung einer Anfrage gewinnt immer. Erben bedeutet hier, ' +
    'dass auf dieser Ebene nichts konfiguriert ist.',
  'workbench.editors.ancestorAuth.descriptionFolder':
    'Anfragen, die auf Erben eingestellt sind, verwenden diese Autorisierung vor der der Sammlung. Die ' +
    'explizite Autorisierung einer Anfrage gewinnt immer. Erben bedeutet hier, dass auf dieser Ebene nichts ' +
    'konfiguriert ist — Anfragen fallen auf die Sammlung zurück.',
  'workbench.editors.ancestorAuth.notFoundCollection': 'Anfragesammlung nicht gefunden.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Ordner nicht gefunden.',
  'workbench.editors.ancestorAuth.saveFailed': 'Autorisierung konnte nicht gespeichert werden.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Autorisierung konnte nicht gespeichert werden: {message}',
  'workbench.editors.ancestorAuth.deletedElsewhere': 'Dieses Element wurde in einem anderen Fenster gelöscht.',

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
} as const satisfies Catalog;
