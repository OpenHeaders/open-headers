/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — German. Mirrors `catalogs/en/panel-quick-editor.ts` key
 * for key. Raw by design: rule/collection/folder/header/param names,
 * URLs, `{{template}}` chips, status codes + MIME values, code/JSON
 * example placeholders, direction glyphs (⬇ ⬆), `mergeSeparator` and
 * DNR schema vocabulary, the Mock tag, and core validator sentences
 * riding as holes. Mints: template prose = die Vorlage; listeners
 * ride raw (m., JS vocabulary, frame precedent); retarget = neu
 * ausrichten; snapshot op words render as the nominalized op mints
 * (Injizieren / Überschreiben / Anfügen / Zusammenführen /
 * Entfernen); Arbeitsbereich / Sammlung / Entwurf / Auslösung
 * carried.
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'Regelnamen löschen',
  'panel.quickEditor.renameTitle': '{name} — zum Umbenennen klicken',
  'panel.quickEditor.enabledOn': 'Aktiviert',
  'panel.quickEditor.enabledOff': 'Deaktiviert',
  'panel.quickEditor.ruleEnabledAria': 'Regel aktiviert',
  'panel.quickEditor.openInTab': 'In Tab öffnen',
  'panel.quickEditor.openInWorkspace': 'Im Arbeitsbereich öffnen →',
  'panel.quickEditor.saveButton': 'Speichern',
  'panel.quickEditor.openToInspect': 'Öffne den Arbeitsbereich, um diese Regel zu inspizieren oder zu ändern.',
  'panel.quickEditor.variableMissing':
    'Variable fehlt — fahre über die rote Referenz, um sie anzulegen und Speichern zu aktivieren.',
  'panel.quickEditor.retargetHint': 'Passe die Bedingungen unten an, um die Regel neu auszurichten.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Regel aktualisiert',
  'panel.quickEditor.toast.ruleNotFound': 'Regel nicht gefunden — vielleicht wurde sie gelöscht.',
  'panel.quickEditor.toast.saveFailed': 'Speichern fehlgeschlagen',
  'panel.quickEditor.toast.toggleFailed': 'Die Regel ließ sich nicht umschalten',
  'panel.quickEditor.toast.changedElsewhere':
    'Die Regel wurde anderswo geändert — schließe das Popover und öffne es erneut.',
  'panel.quickEditor.toast.noWorkspace': 'Kein aktiver Arbeitsbereich',
  'panel.quickEditor.toast.collectionCreateFailed': 'Es ließ sich keine Sammlung für die Regel anlegen',
  'panel.quickEditor.toast.folderCreateFailed':
    'Der Ordner „{name}“ ließ sich nicht anlegen — gespeichert wird in der Wurzel der Sammlung.',
  'panel.quickEditor.toast.createFailed': 'Die Regel ließ sich nicht anlegen',
  'panel.quickEditor.toast.createdDraft': 'Regel als Entwurf angelegt — veröffentliche sie aus dem Arbeitsbereich.',
  'panel.quickEditor.toast.created': 'Regel angelegt',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Wählen, wo die Regel gespeichert wird',
  'panel.quickEditor.destination.savingTo': 'Gespeichert in',
  'panel.quickEditor.destination.newTag': 'neu',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — Wurzel der Sammlung',
  'panel.quickEditor.destination.root': 'Wurzel der Sammlung',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Zeigen und bearbeiten, wann diese Regel auslöst',
  'panel.quickEditor.conditions.label': 'Bedingungen',
  'panel.quickEditor.conditions.none': 'keine — trifft keine Anfragen',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': 'Header hinzufügen',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Trennzeichen fürs Zusammenführen',
  'panel.quickEditor.header.directionRequest': 'Anfrage',
  'panel.quickEditor.header.directionResponse': 'Antwort',
  'panel.quickEditor.validation.nameRequired': 'Der Header-Name ist erforderlich.',
  'panel.quickEditor.validation.invalidName': 'Ungültiger Header-Name.',
  'panel.quickEditor.validation.invalidValue': 'Ungültiger Header-Wert.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Zu {operation} wechseln',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': 'z. B. https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint':
    'Getroffene Anfragen werden an diese URL geschickt, bevor sie das Netzwerk erreichen.',
  'panel.quickEditor.delay.hint':
    'Navigationen werden bis zu 30 000 ms verzögert; XHR/fetch ist auf 5 000 ms begrenzt. Unterressourcen ' +
    'werden nicht verzögert.',
  'panel.quickEditor.block.editHint': 'Getroffene Anfragen werden blockiert, bevor sie das Netzwerk erreichen.',
  'panel.quickEditor.block.blockRequestsTo': 'Anfragen blockieren an',
  'panel.quickEditor.block.createHint':
    'Getroffene Anfragen werden abgebrochen, bevor sie den Browser verlassen — die Seite sieht einen ' +
    'Netzwerkfehler.',
  'panel.quickEditor.response.tagModify': 'Änderung',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    'Diese Regel baut ihre Antwort mit JavaScript. Öffne den Arbeitsbereich, um das Skript zu bearbeiten.',
  'panel.quickEditor.requestBody.hint': 'Getroffene Anfragen werden mit diesem Body gesendet statt mit dem der Seite.',
  'panel.quickEditor.requestBody.dynamicBody':
    'Diese Regel baut ihren Body mit JavaScript. Öffne den Arbeitsbereich, um das Skript zu bearbeiten.',
  'panel.quickEditor.inject.sourceUrlLabel': 'Quell-URL',
  'panel.quickEditor.inject.loadsStylesheetHint': 'Getroffene Seiten laden dieses Stylesheet beim Laden.',
  'panel.quickEditor.inject.loadsScriptHint': 'Getroffene Seiten laden dieses Skript beim Laden.',
  'panel.quickEditor.inject.injectedHint': 'Wird beim Laden in getroffene Seiten injiziert.',
  'panel.quickEditor.message.incoming': 'Eingehend ⬇',
  'panel.quickEditor.message.outgoing': 'Ausgehend ⬆',
  'panel.quickEditor.message.injectedConnectionsHint':
    'Wird auf getroffenen Verbindungen injiziert, bevor Listener es sehen.',
  'panel.quickEditor.message.injectedStreamsHint': 'Wird auf getroffenen Streams injiziert, bevor Listener es sehen.',
  'panel.quickEditor.message.replacedFramesHint':
    'Getroffene Frames werden durch diese Payload ersetzt, bevor sie gesehen werden.',
  'panel.quickEditor.message.replacedEventsHint':
    'Getroffene Events werden durch diese Payload ersetzt, bevor sie gesehen werden.',
  'panel.quickEditor.message.droppedFramesHint': 'Getroffene Frames werden verworfen, bevor sie gesehen werden.',
  'panel.quickEditor.message.droppedEventsHint': 'Getroffene Events werden verworfen, bevor sie gesehen werden.',
  'panel.quickEditor.queryParam.addAction': 'Aktion hinzufügen',
  'panel.quickEditor.queryParam.removeAllWarning':
    'Alle entfernen streicht den gesamten Query-String — die übrigen Operationen dieser Regel werden ignoriert.',
  'panel.quickEditor.auth.challengesHint':
    'Beantwortet Authentifizierungs-Challenges von Servern (401) und Proxys (407) auf getroffenen Anfragen.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': 'Regel bearbeitet',
  'panel.ruleHover.tagVariableChanged': 'Variable geändert',
  'panel.ruleHover.tagDeleted': 'Gelöscht',
  'panel.ruleHover.tagDisabled': 'Deaktiviert',
  'panel.ruleHover.tagModRemoved': 'Mod entfernt',
  'panel.ruleHover.tagConditionsMismatch': 'Bedingungen passen nicht',
  'panel.ruleHover.tagWontFire': 'Wird nicht auslösen',
  'panel.ruleHover.tagTitle.ruleDisabled':
    'Das Aktiviert-Flag der Regel ist aus — sie wird auf keiner künftigen Anfrage auslösen.',
  'panel.ruleHover.tagTitle.modGone': 'Die zugehörige Modifikation wurde aus der Regel entfernt.',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'Die Bedingungen der Regel decken diese URL nicht mehr ab.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    'Die Vorlage des Header-Namens lässt sich nicht vollständig auflösen (z. B. referenziert sie einen TOTP). ' +
    'DNR weist wörtliche Vorlagenzeichen in Header-Namen zurück.',
  'panel.ruleHover.tagTitle.valueUnresolved': 'Die Vorlage des Header-Werts lässt sich nicht vollständig auflösen.',
  'panel.ruleHover.tagTitle.separatorUnresolved':
    'Die Vorlage des Zusammenführungs-Trennzeichens lässt sich nicht vollständig auflösen.',
  'panel.ruleHover.deletedBody':
    'Diese Regel wurde gelöscht. Die Erfassung oben zeigt, was sie bei ihrer Auslösung getan hat.',
  'panel.ruleHover.modRemovedBody':
    'Die zugehörige Modifikation wurde aus der Regel entfernt. Öffne den Arbeitsbereich, um sie neu anzulegen ' +
    'oder anzupassen.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'Injizieren',
  'panel.ruleHover.snapshot.opOverride': 'Überschreiben',
  'panel.ruleHover.snapshot.opAppend': 'Anfügen',
  'panel.ruleHover.snapshot.opMerge': 'Zusammenführen',
  'panel.ruleHover.snapshot.opRemove': 'Entfernen',
  'panel.ruleHover.snapshot.templateTitle': 'Vorlage vor der Variablenauflösung zum Auslösungszeitpunkt',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'Dieselbe Vorlage — eine referenzierte Variable löst sich jetzt zu einem anderen Header-Namen auf',
  'panel.ruleHover.snapshot.cancels': 'hebt „{rule}“ auf',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Jetzt',
  'panel.ruleHover.snapshot.future': 'Zukunft',
  'panel.ruleHover.snapshot.futureTitle': 'Was die nächste getroffene Anfrage erhalten würde',
  'panel.ruleHover.snapshot.removed': 'entfernt',
  'panel.ruleHover.snapshot.empty': '(leer)',
  'panel.ruleHover.snapshot.totpNote':
    'TOTP- / verzögerte Referenzen werden zum Anfragezeitpunkt aufgelöst und hier nicht erfasst.',
  'panel.ruleHover.snapshot.alsoByRule': 'Ebenfalls durch diese Regel auf dieser Anfrage',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'die Regel wurde gelöscht — wird nicht auslösen',
  'panel.ruleHover.future.ruleDisabled': 'die Regel ist deaktiviert — wird nicht auslösen',
  'panel.ruleHover.future.modGone': 'diese Modifikation wurde aus der Regel entfernt',
  'panel.ruleHover.future.conditionsMismatch': 'die Bedingungen der Regel passen nicht mehr auf diese URL',
  'panel.ruleHover.future.nameUnresolved':
    'die Vorlage des Header-Namens lässt sich nicht auflösen — die Regel wird nicht auslösen',
  'panel.ruleHover.future.valueUnresolved':
    'die Wert-Vorlage lässt sich nicht auflösen — die Regel wird nicht auslösen',
  'panel.ruleHover.future.separatorUnresolved':
    'die mergeSeparator-Vorlage lässt sich nicht auflösen — die Regel wird nicht auslösen',
  'panel.ruleHover.future.templateTitle': 'Vorlage: {template}',
} as const satisfies Catalog;
