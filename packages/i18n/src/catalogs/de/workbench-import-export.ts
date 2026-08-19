/**
 * Import/export family — German. Extends the de register contract
 * (`de/shared.ts`). Mirrors `catalogs/en/workbench-import-export.ts`
 * key for key.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI), file extensions and
 * filenames rendered as `<Text code>` chips (`.bru`,
 * `.openheaders.yaml`), export ids / fingerprints / entity names
 * ({id} / {name} holes carry data), the ` · ` separator glyphs,
 * third-party UI paths and button labels (Postman menus, DevTools
 * `Save all as HAR`, `Copy as cURL` — Postman does not localize
 * German), `uid` / `{{template}}` tokens, and `vault` lowercase per
 * the glossary (never genitive-compound onto brand tokens — „die
 * Menüs von Postman“). The hub quotes the S73 mint `der Import-Hub`;
 * the report hover quotes the shipped settings path `Einstellungen →
 * Daten`. MINTS: export (noun) = der Export; passphrase = die
 * Passphrase; fingerprint = der Fingerabdruck; drop = die Verwerfung
 * (verworfen family), transform = die Transformation; merge
 * strategies = „als neu hinzufügen“ / „Bestehendes ersetzen“
 * (settings-defs must reuse); scan = „Diesen Computer scannen“.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Exportieren',
  'workbench.importExport.export.cancel': 'Abbrechen',
  'workbench.importExport.export.download': 'Herunterladen',
  'workbench.importExport.export.sourceLabel': 'Quelle:',
  'workbench.importExport.export.scopeLabel': 'Umfang:',
  'workbench.importExport.export.filenameLabel': 'Dateiname:',
  'workbench.importExport.export.scopeWholeWorkspace': 'Ganzer Arbeitsbereich',
  'workbench.importExport.export.vaultSecrets': 'Vault-Secrets',
  'workbench.importExport.export.vaultOmit': 'Weglassen (Standard)',
  'workbench.importExport.export.vaultEncrypted': 'Verschlüsselt (Passphrase)',
  'workbench.importExport.export.vaultPlaintext': 'Klartext (fortgeschritten)',
  'workbench.importExport.export.passphrasePlaceholder': 'Passphrase',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Passphrase bestätigen',
  'workbench.importExport.export.hintPlaceholder':
    'Optionaler Hinweis (für Empfänger sichtbar — niemals die Passphrase selbst)',
  'workbench.importExport.export.strengthEmpty': 'gib eine Passphrase ein',
  'workbench.importExport.export.strengthWeak': 'schwach',
  'workbench.importExport.export.strengthFair': 'mäßig',
  'workbench.importExport.export.strengthGood': 'gut',
  'workbench.importExport.export.strengthStrong': 'stark',
  'workbench.importExport.export.strengthNote':
    'Stärke der Passphrase: {label}. Teile die Passphrase auf einem anderen Kanal (Signal, Passwortmanager, ' +
    'mündlich). Wer die Passphrase hat, kann jedes Secret in diesem Export lesen.',
  'workbench.importExport.export.plaintextTitle': 'Klartext-Secrets kann jeder lesen, der diese Datei sieht',
  'workbench.importExport.export.plaintextUseOnly':
    'Nur beim Teilen mit einem voll vertrauten System verwenden (z. B. Backup auf dein eigenes ' +
    'verschlüsseltes Laufwerk).',
  'workbench.importExport.export.switchToEncrypted': 'Zu verschlüsselt wechseln (empfohlen)',
  'workbench.importExport.export.acknowledgeRisks': 'Ich verstehe die Risiken',
  'workbench.importExport.export.fingerprintsTitle': 'Verschlüsselt — teile diese Fingerabdrücke mit dem Empfänger',
  'workbench.importExport.export.ciphertextFingerprint': 'Chiffrat-Fingerabdruck:',
  'workbench.importExport.export.keyFingerprint': 'Schlüssel-Fingerabdruck:',
  'workbench.importExport.export.fingerprintMatchNote':
    'Nachdem der Empfänger die Passphrase eingegeben hat, sieht er denselben Schlüssel-Fingerabdruck, wenn er ' +
    'mit deinem übereinstimmt.',
  'workbench.importExport.export.advanced': 'Erweitert',
  'workbench.importExport.export.strictLiteralLabel': 'Strikt wörtlich — nur meine Auswahl exportieren',
  'workbench.importExport.export.strictLiteralHelp':
    'Standardmäßig zieht die Auswahl einer Sammlung oder eines Ordners jeden Nachfahren plus die ' +
    'Eltern-Container mit, damit der Import für sich steht. Mit strikt wörtlich reisen nur die gewählten uids ' +
    '— der Empfänger sieht fehlende Abhängigkeiten für alles, was du nicht eingeschlossen hast.',
  'workbench.importExport.export.oauthNote':
    'OAuth-Client-Secrets werden unabhängig vom vault-Modus immer weggelassen. Der Empfänger gibt bei der ' +
    'ersten Authentifizierung eigene ein.',
  'workbench.importExport.export.exportFailed': 'Export fehlgeschlagen',
  'workbench.importExport.export.exportedShareFingerprints':
    '{filename} exportiert — teile die Fingerabdrücke mit dem Empfänger',
  'workbench.importExport.export.exported': '{filename} exportiert',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'IMPORTIEREN',
  'workbench.importExport.hub.closeAria': 'Import schließen',
  'workbench.importExport.hub.readingFile': 'Datei wird gelesen…',
  'workbench.importExport.hub.pastePlaceholder': 'Füge einen curl-Befehl oder eine URL ein',
  'workbench.importExport.hub.continueAria': 'Import fortsetzen',
  'workbench.importExport.hub.notRecognized':
    'Noch nicht erkannt — füge einen curl-Befehl, eine URL, ein HAR, einen Postman- / Insomnia- / ' +
    'Bruno-Export, ein OpenAPI-Dokument oder einen Arbeitsbereich-Export ein.',
  'workbench.importExport.hub.dropAria': 'Ziehe eine importierbare Datei oder einen Ordner hierher',
  'workbench.importExport.hub.dropTitle': 'Ziehe eine Datei oder einen Ordner zum Importieren hierher',
  'workbench.importExport.hub.kindHar': 'HAR-Aufzeichnung',
  'workbench.importExport.hub.kindPostman': 'Postman-Sammlung oder -Backup',
  'workbench.importExport.hub.kindInsomnia': 'Insomnia-Export',
  'workbench.importExport.hub.kindBrunoSuffix': 'Datei oder Sammlungsordner',
  'workbench.importExport.hub.kindOpenapi': 'OpenAPI-3.x-Dokument',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'Arbeitsbereich-Export',
  'workbench.importExport.hub.autoDetected': 'Das Format wird automatisch erkannt.',
  'workbench.importExport.hub.browseFiles': 'Dateien durchsuchen…',
  'workbench.importExport.hub.browseFolder': 'Ordner durchsuchen…',
  'workbench.importExport.hub.switchingFrom': 'Du wechselst von',
  'workbench.importExport.hub.switchingOr': 'oder',
  'workbench.importExport.hub.migrateCta': 'Aus einem anderen Tool migrieren',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    'Keine Bruno-Dateien in diesem Ordner — erwartet wurden .bru-Dateien oder eine bruno.json.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Datei ließ sich nicht lesen und wurde übersprungen.',
      other: '{count} Dateien ließen sich nicht lesen und wurden übersprungen.',
    }),
  'workbench.importExport.modals.readFailed': '{name} ließ sich nicht lesen: {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Entität', other: '{count} Entitäten' })} aus „${label}“ importiert`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'ARBEITSBEREICH-EXPORT IMPORTIEREN',
  'workbench.importExport.preview.closeAria': 'Importvorschau schließen',
  'workbench.importExport.preview.cancel': 'Abbrechen',
  'workbench.importExport.preview.emptyFile': 'Ziehe eine .openheaders.yaml-Datei hierher, um sie anzusehen.',
  'workbench.importExport.preview.emptyClipboard': 'Füge einen Arbeitsbereich-Export ein, um ihn anzusehen.',
  'workbench.importExport.preview.preparing': 'Import wird vorbereitet…',
  'workbench.importExport.preview.footerExportInfo': 'Export {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Wähle eine Datei für die Vorschau',
  'workbench.importExport.preview.footerNoData': 'Keine Daten',
  'workbench.importExport.preview.importInto': 'Importieren in:',
  'workbench.importExport.preview.staleTitle': 'Der Arbeitsbereich hat sich seit dem Öffnen dieser Vorschau geändert',
  'workbench.importExport.preview.staleDescription':
    'Öffne die Importvorschau erneut, um den Diff zu aktualisieren, und versuche es dann noch einmal.',
  'workbench.importExport.preview.advanced': 'Erweitert',
  'workbench.importExport.preview.advancedCount': 'Erweitert ({count})',
  'workbench.importExport.preview.previewFailed': 'Vorschau fehlgeschlagen',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Import — ${plural(locale, Number(count), { one: '{count} Element', other: '{count} Elemente' })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Importieren in',
  'workbench.importExport.target.current': 'Aktuell',
  'workbench.importExport.target.new': 'Neu',
  'workbench.importExport.target.pickExisting': 'Bestehenden wählen',
  'workbench.importExport.target.noActiveWorkspace': 'Kein aktiver Arbeitsbereich',
  'workbench.importExport.target.selectWorkspace': 'Wähle einen Arbeitsbereich',
  'workbench.importExport.target.landsOnOrg': 'Landet auf {name} und synchronisiert auf dessen Geräte',
  'workbench.importExport.target.staysLocal': 'Bleibt auf diesem Gerät',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Erweitert',
  'workbench.importExport.advanced.closeAria': 'Erweitert-Bereich schließen',
  'workbench.importExport.advanced.backupRestoreLabel': 'Das ist meins — Aktualisierung per uid bevorzugen',
  'workbench.importExport.advanced.backupRestoreHelp':
    'Stellt uid-gleiche Kollisionen von „als neu hinzufügen“ auf „Bestehendes ersetzen“ um. Übersprungen für ' +
    'Entitäten, die seit dem Export lokal bearbeitet wurden.',
  'workbench.importExport.advanced.trustExportLabel': 'Diesem Export vertrauen — Aktiviert-Flags behalten',
  'workbench.importExport.advanced.trustExportHelp':
    'Importierte Regeln / Live-Workflows / Live-Variablen landen standardmäßig deaktiviert. Aktiviere dies ' +
    'nur, wenn du dem Absender vertraust.',
  'workbench.importExport.advanced.stripScriptsLabel': 'Anfrage-Scripts beim Import entfernen',
  'workbench.importExport.advanced.stripScriptsHelp':
    'Entfernt Pre-Request- und Post-Response-Scripts aus jeder importierten Anfrage. Empfohlen, wenn der ' +
    'Absender unbekannt ist.',
  'workbench.importExport.advanced.omitOAuthLabel': 'OAuth-Konfigurationen weglassen',
  'workbench.importExport.advanced.omitOAuthHelp':
    'Standardmäßig reisen OAuth2-Konfigurationen mit der Anfrage (Token-Endpunkt, Client-Id, Scopes — niemals ' +
    'Client-Secret oder Tokens). Mit dieser Option landet jede OAuth2-Anfrage mit Authentifizierung „keine“.',
  'workbench.importExport.advanced.keepOrderLabel': 'Bei Aktualisierung die Reihenfolge der Ziel-Sammlung behalten',
  'workbench.importExport.advanced.keepOrderHelp':
    'Standardmäßig übernimmt eine aktualisierte Sammlung die Kind-Reihenfolge des Exports. Mit dieser Option ' +
    'bleibt deine bestehende Ziel-Reihenfolge erhalten.',
  'workbench.importExport.advanced.workspaceSettingsLabel': 'Einstellungen auf Arbeitsbereich-Ebene einschließen',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'Reserviert für eine künftige Positivliste arbeitsbereich-semantischer Einstellungen. Die aktuelle ' +
    'Positivliste ist leer — in v1 reist über diesen Schalter nichts.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Bei workspace.uid-Kollision ablehnen',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'Standardmäßig erzeugt der Import in einen neuen Arbeitsbereich bei einer Kollision stillschweigend eine ' +
    'neue Arbeitsbereich-uid. Mit dieser Option blockiert ein bestehender Arbeitsbereich mit derselben uid ' +
    'den Import.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Ausblenden',
  'workbench.importExport.chips.plaintextLabel': 'Klartext-Secrets',
  'workbench.importExport.chips.plaintextTitle': 'Dieser Export enthält vault-Secrets im Klartext.',
  'workbench.importExport.chips.plaintextBody':
    'Wer diese Datei hat, kann jedes darin enthaltene Secret lesen. Erwäge, sie vor dem Weiterleiten neu als ' +
    'verschlüsselt auszustellen.',
  'workbench.importExport.chips.skippedLabel': '{count} übersprungen',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Entität ließ sich nicht parsen und wird übersprungen.',
      other: '{count} Entitäten ließen sich nicht parsen und werden übersprungen.',
    }),
  'workbench.importExport.chips.andMore': '…und {count} weitere',
  'workbench.importExport.chips.dedupSameLabel': 'Hier bereits importiert',
  'workbench.importExport.chips.dedupSameTitle': 'Du hast diesen Export ({id}) hier am {date} importiert.',
  'workbench.importExport.chips.dedupSameBody':
    'Ein erneuter Import wendet deine aktuellen Strategie-Entscheidungen pro Entität an.',
  'workbench.importExport.chips.dedupOtherLabel': 'Anderswo importiert',
  'workbench.importExport.chips.dedupOtherTitle': 'Du hast den Export {id} auch in „{name}“ importiert.',
  'workbench.importExport.chips.dedupOtherBody': 'Jener Arbeitsbereich bleibt von diesem Import unberührt.',
  'workbench.importExport.chips.dedupUidLabel': 'Quelle existiert bereits',
  'workbench.importExport.chips.dedupUidTitle': 'Ein Arbeitsbereich aus dieser Quelle existiert bereits („{name}“).',
  'workbench.importExport.chips.dedupUidBody':
    'Stelle das Ziel oben um, um ihn zu aktualisieren, oder importiere als neue Kopie.',
  'workbench.importExport.chips.staleLabel': 'Daten geändert',
  'workbench.importExport.chips.staleTitle': 'Der Ziel-Arbeitsbereich wurde von einem anderen Tab verändert.',
  'workbench.importExport.chips.staleBody':
    'Der Kollisionsbaum unten wurde aktualisiert — sieh ihn durch und klicke erneut auf Importieren.',
  'workbench.importExport.chips.previewErrorLabel': 'Vorschau fehlgeschlagen',
  'workbench.importExport.chips.previewErrorTitle': 'Der Kollisions-Diff ließ sich nicht berechnen.',
  'workbench.importExport.chips.unresolvedLabel': '{count} nicht aufgelöst',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nicht aufgelöste Referenz.',
      other: '{count} nicht aufgelöste Referenzen.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    'Diese Namen lösen sich weder im Export noch im Ziel auf. Die Importe landen als kaputte Bindungen — ' +
    'binde neu, sobald die fehlende Entität auftaucht.',
  'workbench.importExport.chips.referencedBy': 'referenziert von {count}',
  'workbench.importExport.chips.summaryThen': 'Damals:',
  'workbench.importExport.chips.summaryNow': 'Jetzt:',
  'workbench.importExport.chips.summaryNew': '{count} neu',
  'workbench.importExport.chips.summaryKept': '{count} behalten',
  'workbench.importExport.chips.summaryRemoved': '{count} entfernt',
  'workbench.importExport.chips.showBreakdown': 'Aufschlüsselung pro Abschnitt anzeigen',
  'workbench.importExport.chips.hideBreakdown': 'Aufschlüsselung ausblenden',
  'workbench.importExport.chips.sectionNew': '(+{count} neu)',
  'workbench.importExport.chips.sectionRemoved': '({count} entfernt)',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Verschlüsselter Vault — {count} Secret',
      other: 'Verschlüsselter Vault — {count} Secrets',
    }),
  'workbench.importExport.vault.hintFromSender': 'Hinweis vom Absender:',
  'workbench.importExport.vault.enterPassphrase':
    'Gib die Passphrase ein, um diese Secrets lokal zu entschlüsseln. Das Überspringen der Entschlüsselung ' +
    'setzt den restlichen Import fort — die Secrets werden einfach weggelassen.',
  'workbench.importExport.vault.passphrasePlaceholder': 'Passphrase',
  'workbench.importExport.vault.decrypt': 'Den vault entschlüsseln',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault entschlüsselt — {count} Secret bereit zum Import',
      other: 'Vault entschlüsselt — {count} Secrets bereit zum Import',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Schlüssel-Fingerabdruck:',
  'workbench.importExport.vault.compareWithSender': '(mit dem Absender vergleichen)',
  'workbench.importExport.vault.ciphertextFingerprint': 'Chiffrat-Fingerabdruck:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Secret ließ sich nicht decodieren — wird im Import weggelassen',
      other: '{count} Secrets ließen sich nicht decodieren — werden im Import weggelassen',
    }),
  'workbench.importExport.vault.andMore': '…und {count} weitere',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Abbrechen',
  'workbench.importExport.import.importCta': 'Importieren',
  'workbench.importExport.import.importCtaCount': 'Importieren ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Importieren ({shortcut})',
  'workbench.importExport.import.importTo': 'IMPORTIEREN IN',
  'workbench.importExport.import.hintNavigate': 'navigieren',
  'workbench.importExport.import.hintSelect': 'auswählen',
  'workbench.importExport.import.hintImport': 'importieren',
  'workbench.importExport.import.hintClose': 'schließen',
  'workbench.importExport.import.cantReadFile': 'Diese Datei ließ sich nicht lesen',
  'workbench.importExport.import.failedCreateCollection': 'Sammlung ließ sich nicht anlegen',
  'workbench.importExport.import.importFailed': 'Import fehlgeschlagen: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Transformation', other: '{count} Transformationen' }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Verwerfung', other: '{count} Verwerfungen' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Anfrage importiert', other: '{count} Anfragen importiert' }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'AUS HAR IMPORTIEREN',
  'workbench.importExport.har.tooltipChooseFile': 'Wähle zuerst eine .har-Datei',
  'workbench.importExport.har.tooltipSelectEntry': 'Wähle mindestens einen Eintrag',
  'workbench.importExport.har.footerSelected': '{selected} von {total} ausgewählt',
  'workbench.importExport.har.footerChooseFile': 'Wähle eine .har-Datei',
  'workbench.importExport.har.introPrefix': 'Importiere eine',
  'workbench.importExport.har.introSuffix':
    'Datei (HTTP Archive), exportiert aus den DevTools oder einem Proxy. Jeder Eintrag wird zu einer ' +
    'Ziel-Anfrage in der gewählten Sammlung. Cookies und Multipart-Uploads werden mit ' +
    'Nachverfolgungs-Anmerkungen verworfen; Auth-Header werden zu erstklassigen Auth-Typen befördert.',
  'workbench.importExport.har.filterPlaceholder': 'Nach URL / Methode / Name filtern',
  'workbench.importExport.har.selectAll': 'Alle auswählen',
  'workbench.importExport.har.selectNone': 'Keine',
  'workbench.importExport.har.readFailed': 'HAR ließ sich nicht lesen: {message}',
  'workbench.importExport.har.dropTitle': 'Ziehe eine .har-Datei hierher oder klicke, um eine zu wählen',
  'workbench.importExport.har.dropHint': 'Exportiert aus DevTools Network → Rechtsklick → Save all as HAR',
  'workbench.importExport.har.noImportableEntries': 'Die Datei hat keine importierbaren Einträge.',
  'workbench.importExport.har.noFilterMatch': 'Keine Einträge passen auf den Filter.',
  'workbench.importExport.har.showingFirst':
    'Die ersten {shown} von {total} werden gezeigt. Nutze den Filter zum Eingrenzen.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Transformation auf die Quelle angewendet',
      other: '{count} Transformationen auf die Quelle angewendet',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Verwerfung aufgezeichnet',
      other: '{count} Verwerfungen aufgezeichnet',
    }),
  'workbench.importExport.har.transformsTooltip':
    'Transformationen schreiben Quellfelder in normalisierte Entsprechungen um — z. B. die Beförderung von ' +
    'Authorization-Headern zu erstklassigen Auth-Typen.',
  'workbench.importExport.har.dropsTooltip':
    'Verwerfungen sind Quellfelder, die sich nicht aufs Modell abbilden lassen (Cookies, Multipart-Uploads ' +
    'usw.). Jede hat eine Nachverfolgungs-Anmerkung im vollständigen Bericht.',
  'workbench.importExport.har.reportHover':
    'Für Details überfahren · vollständige Liste im Importbericht-Export (Einstellungen → Daten)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'AUS CURL IMPORTIEREN',
  'workbench.importExport.curl.tooltipPasteFirst': 'Füge zuerst einen curl-Befehl ein',
  'workbench.importExport.curl.tooltipEnterName': 'Gib einen Namen ein',
  'workbench.importExport.curl.introPrefix': 'Füge einen',
  'workbench.importExport.curl.introSuffix':
    'Befehl ein — z. B. „Copy as cURL“ aus den Browser-DevTools oder aus API-Dokumentation.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': 'Dieser Befehl ließ sich nicht parsen',
  'workbench.importExport.curl.parseFallback': 'Parsen nicht möglich — prüfe den Befehl und versuche es erneut.',
  'workbench.importExport.curl.nameLabel': 'NAME',
  'workbench.importExport.curl.namePlaceholder': 'So erscheint diese Anfrage in der Seitenleiste',
  'workbench.importExport.curl.failedCreateRequest': 'Anfrage ließ sich nicht anlegen',
  'workbench.importExport.curl.importedName': '„{name}“ importiert',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Header', other: '{count} Header' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Query-Parameter', other: '{count} Query-Parameter' }),
  'workbench.importExport.curl.noBody': 'kein Body',
  'workbench.importExport.curl.bodyType': '{type}-Body',
  'workbench.importExport.curl.noAuth': 'keine Auth',
  'workbench.importExport.curl.authType': '{type}-Auth',
  'workbench.importExport.curl.droppedWord': 'verworfen',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'AUS POSTMAN IMPORTIEREN',
  'workbench.importExport.postman.intro':
    'Importiere ein Postman-Collection-v2.1-JSON. Ordnerstruktur, Sammlungsvariablen, Anfrage-Doku und ' +
    '-Einstellungen, Auth pro Anfrage (basic / bearer / api-key / OAuth 2.0) und Anfrage-Scripts (wo möglich ' +
    'in die oh.*-API übersetzt) bleiben erhalten. AWS sigv4 und Datei-Uploads werden als Verwerfungen ' +
    'nachverfolgt. Optional kannst du eine Postman-Umgebungsdatei anhängen, um eine passende Umgebung ' +
    'anzulegen.',
  'workbench.importExport.postman.tooltipChooseFile': 'Wähle zuerst eine Sammlungsdatei',
  'workbench.importExport.postman.tooltipEnterName': 'Gib einen Sammlungsnamen ein',
  'workbench.importExport.postman.collectionNameLabel': 'SAMMLUNGSNAME',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Name für die neue Sammlung',
  'workbench.importExport.postman.readFileFailed': 'Datei ließ sich nicht lesen: {message}',
  'workbench.importExport.postman.readEnvFailed': 'Umgebung ließ sich nicht lesen: {message}',
  'workbench.importExport.postman.parsedCollection': 'GEPARSTE SAMMLUNG',
  'workbench.importExport.postman.requestsLabel': 'Anfragen:',
  'workbench.importExport.postman.foldersLabel': 'Ordner:',
  'workbench.importExport.postman.collectionVarsLabel': 'Sammlungsvariablen:',
  'workbench.importExport.postman.folderTree': 'Ordnerbaum',
  'workbench.importExport.postman.optionalEnvFile': 'OPTIONAL · UMGEBUNGSDATEI',
  'workbench.importExport.postman.environmentLabel': 'Umgebung: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Variable', other: '{count} Variablen' }),
  'workbench.importExport.postman.secretCount': '{count} Secret',
  'workbench.importExport.postman.remove': 'Entfernen',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Umgebungsvariable verworfen (deaktivierte Einträge)',
      other: '{count} Umgebungsvariablen verworfen (deaktivierte Einträge)',
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Ziehe ein Postman-Collection-v2.1-JSON hierher oder klicke, um eines zu wählen',
  'workbench.importExport.postman.dropEnvTitle': 'Ziehe ein Postman-Umgebungs-JSON hierher (optional)',
  'workbench.importExport.postman.dropCollectionHint':
    'Exportiert aus Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Exportiert aus Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Ordner', other: '{count} Ordner' }),
  'workbench.importExport.postman.oneEnvironment': '1 Umgebung',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'AUS EINEM POSTMAN-BACKUP IMPORTIEREN',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Importiere einen Postman-Backup-Datenexport. Sammlungen, Umgebungen, Globals und Header-Presets werden ' +
    'erkannt; Header-Presets landen als unveröffentlichte Header-Regeln. Scripts, OAuth 2.0, AWS sigv4 und ' +
    'Datei-Uploads werden als Verwerfungen nachverfolgt.',
  'workbench.importExport.sectioned.titleInsomnia': 'AUS INSOMNIA IMPORTIEREN',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Importiere einen Insomnia-Export (v4-JSON oder v5-YAML). Arbeitsbereiche werden zu Sammlungen mit ihren ' +
    'Ordnerbäumen; Umgebungen werden flach (Unterumgebungen mischen sich über ihre Basis), und ' +
    '{{ _.var }}-Referenzen werden zu {{var}} umgeschrieben; eingebettete API-Spezifikationen bleiben als ' +
    'bearbeitbare Spezifikationen erhalten, verknüpft mit ihren erzeugten Sammlungen.',
  'workbench.importExport.sectioned.titleBruno': 'AUS BRUNO IMPORTIEREN',
  'workbench.importExport.sectioned.blurbBruno':
    'Importiere eine Bruno-.bru-Anfrage oder einen ganzen Sammlungsordner. Methode, Header, Parameter, Body ' +
    'und basic-/bearer-/api-key-Auth bleiben erhalten; ein Ordner bringt seinen Ordnerbaum, seine Reihenfolge ' +
    'und Umgebungen mit; Scripts, Tests und Doku-Blöcke werden als Verwerfungen nachverfolgt.',
  'workbench.importExport.sectioned.titleOpenapi': 'AUS OPENAPI IMPORTIEREN',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Importiere ein OpenAPI-3.x-Dokument (JSON oder YAML). Operationen werden zu Anfragen unter {{baseUrl}}, ' +
    'Tags werden zu Ordnern, Parameter und Anfrage-Bodys bleiben erhalten (Bodys mit reinem Schema bekommen ' +
    'ein Platzhalter-Gerüst), und Sicherheitsschemata werden auf Auth abgebildet — fülle die Platzhalter ' +
    '{{clientId}}/{{clientSecret}} nach dem Import aus. Das Dokument kann auch als bearbeitbare ' +
    'Spezifikation weiterleben, verknüpft mit der erzeugten Sammlung.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Noch nichts geparst',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Jede Sammlung braucht einen Namen',
  'workbench.importExport.sectioned.cantReadImport': 'Dieser Import ließ sich nicht lesen',
  'workbench.importExport.sectioned.readInputFailed': 'Eingabe ließ sich nicht lesen: {message}',
  'workbench.importExport.sectioned.importAs': 'IMPORTIEREN ALS',
  'workbench.importExport.sectioned.specWithCollection': 'Spezifikation mit einer Sammlung',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'Das Dokument lebt als bearbeitbare Spezifikation weiter, verknüpft mit der erzeugten Sammlung.',
  'workbench.importExport.sectioned.collectionOnly': 'Sammlung',
  'workbench.importExport.sectioned.collectionOnlyHelp': 'Nur konvertieren — das Dokument selbst wird nicht behalten.',
  'workbench.importExport.sectioned.specificationsSection': 'SPEZIFIKATIONEN · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'SAMMLUNGEN · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'UMGEBUNGEN · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'HEADER-PRESETS · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Sammlungsname',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Variable', other: '{count} Variablen' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Header', other: '{count} Header' }),
  'workbench.importExport.sectioned.presetsNote':
    'Jedes Preset landet als unveröffentlichte Header-Regel — füge Bedingungen hinzu und veröffentliche sie, ' +
    'wenn sie bereit ist; bis dahin berührt nichts den Live-Traffic.',
  'workbench.importExport.sectioned.nothingImportable': 'Nichts Importierbares in dieser Datei',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'Die Datei wurde geparst, aber jeder Abschnitt war leer oder verworfen — siehe die Importhinweise unten.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Spezifikation', other: '{count} Spezifikationen' }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Umgebung', other: '{count} Umgebungen' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Header-Regel (unveröffentlicht)',
      other: '{count} Header-Regeln (unveröffentlicht)',
    }),
  'workbench.importExport.sectioned.importedLead': '{parts} importiert',
  'workbench.importExport.sectioned.emptyFinish': 'Import abgeschlossen — nichts zu übernehmen',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Aus einem anderen Tool migrieren',
  'workbench.importExport.migrate.scanCta': 'Diesen Computer scannen',
  'workbench.importExport.migrate.pullCta': 'Aus einem Postman-Konto importieren',
  'workbench.importExport.migrate.scanNote':
    'Der Scan prüft eine feste Liste von Anwendungsordnern und liest nur Tool-Datendateien (Backups und ' +
    'lokale Datenspeicher). Er öffnet niemals Zugangsdaten-, Cookie- oder Sitzungsdateien, und nichts ' +
    'verlässt diesen Computer. Etwas zu importieren ist ein separater, ausdrücklicher Schritt.',
  'workbench.importExport.migrate.scanFailed':
    'Der Scan konnte nicht laufen — versuche es erneut oder nutze den Import-Hub mit einer exportierten Datei.',
  'workbench.importExport.migrate.backupReadFailed': 'Die Backup-Datei ließ sich nicht lesen.',
  'workbench.importExport.migrate.localReadFailed': 'Die lokalen Daten ließen sich nicht lesen.',
  'workbench.importExport.migrate.detected': 'Erkannt',
  'workbench.importExport.migrate.notFound': 'Nicht gefunden',
  'workbench.importExport.migrate.cancel': 'Abbrechen',
  'workbench.importExport.migrate.fromAccount': 'Aus deinem Postman-Konto importieren',
  'workbench.importExport.migrate.localDataPrefix':
    'Du hast lokale Daten von Insomnia, Thunder Client oder Bruno? Exportiere sie aus dem Tool und ziehe die ' +
    'Datei in den',
  'workbench.importExport.migrate.importHub': 'Import-Hub',
  'workbench.importExport.migrate.localDataSuffix':
    '— oder scanne diesen Computer mit der Desktop-App von Open Headers.',
  'workbench.importExport.migrate.desktopConnected':
    'Deine Desktop-App ist verbunden — wähle dort „Aus einem anderen Tool migrieren“; der Fortschritt ' +
    'spiegelt sich hier, und die importierten Arbeitsbereiche synchronisieren herüber.',
  'workbench.importExport.migrate.desktopNeeded':
    'Der Scan braucht die Desktop-App; sobald er dort läuft, synchronisieren die importierten ' +
    'Arbeitsbereiche in diesen Browser.',
  'workbench.importExport.migrate.closeConfirmTitle': 'Den Import schließen?',
  'workbench.importExport.migrate.closeListingContent':
    'Deine Arbeitsbereiche werden noch aufgelistet — große Konten können eine Minute brauchen. Schließen ' +
    'bricht die Auflistung ab.',
  'workbench.importExport.migrate.closeListingOk': 'Weiter warten',
  'workbench.importExport.migrate.closeSelectingContent':
    'Deine Arbeitsbereich-Auswahl wird verworfen. Es wurde noch nichts importiert.',
  'workbench.importExport.migrate.closeSelectingOk': 'Weiter auswählen',
  'workbench.importExport.migrate.closeAnyway': 'Trotzdem schließen',
  'workbench.importExport.migrate.discardAndClose': 'Verwerfen und schließen',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman does not localize German, so the
  // quoted labels ride raw English.
  'workbench.importExport.pull.keyIntro':
    'Füge einen Postman-API-Schlüssel ein, um deine Arbeitsbereiche aufzulisten und die zu importierenden ' +
    'auszuwählen.',
  'workbench.importExport.pull.keyAria': 'Postman-API-Schlüssel',
  'workbench.importExport.pull.listCta': 'Arbeitsbereiche auflisten',
  'workbench.importExport.pull.listFailed': 'Die Arbeitsbereiche ließen sich nicht auflisten.',
  'workbench.importExport.pull.startFailed': 'Der Import konnte nicht starten.',
  'workbench.importExport.pull.quipContacting': 'Dein Postman-Konto wird kontaktiert',
  'workbench.importExport.pull.quipCounting': 'Sammlungen werden gezählt',
  'workbench.importExport.pull.quipWeighing': 'Umgebungen werden gewogen',
  'workbench.importExport.pull.quipWrangling': 'Arbeitsbereiche werden eingefangen',
  'workbench.importExport.pull.quipAlphabetizing': 'Ordner werden alphabetisiert',
  'workbench.importExport.pull.quipSniffing': 'Anfragen werden aufgespürt',
  'workbench.importExport.pull.quipUntangling': 'Variablen werden entwirrt',
  'workbench.importExport.pull.quipStacking': 'Header werden gestapelt',
  'workbench.importExport.pull.pickIntro':
    'Jeder ausgewählte Postman-Arbeitsbereich landet in einem eigenen Arbeitsbereich, behält seinen exakten ' +
    'Namen und bekommt einen Abschlussbericht.',
  'workbench.importExport.pull.noWorkspaces': 'Auf diesem Konto wurden keine Arbeitsbereiche gefunden.',
  'workbench.importExport.pull.workspaceCounts': '{collections} Sammlungen · {environments} Umgebungen',
  'workbench.importExport.pull.importCta': 'Auswahl importieren',
  'workbench.importExport.pull.back': 'Zurück',
  'workbench.importExport.pull.steps.menuA': 'In der Postman-App oder auf https://postman.co',
  'workbench.importExport.pull.steps.menuB': 'Settings-Menü → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Linke Seitenleiste → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Einen beliebigen Namen eintragen → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Den Schlüssel kopieren → oben einfügen',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Anbieter',
  'workbench.importExport.detection.dataFoundCol': 'Gefundene Daten',
  'workbench.importExport.detection.contentsCol': 'Inhalt',
  'workbench.importExport.detection.backupFrom': 'Backup vom {date}',
  'workbench.importExport.detection.localData': 'Lokale Daten',
  'workbench.importExport.detection.importCta': 'Importieren…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'Oder exportiere sie (Preferences → Data → Export) und ziehe die Datei in den',
  'workbench.importExport.detection.backupContents':
    '{collections} Sammlungen · {environments} Umgebungen · {headerPresets} Header-Presets · {globals} Globals',
  'workbench.importExport.detection.localContents':
    '{collections} Sammlungen · {environments} Umgebungen · {requests} Anfragen',
  'workbench.importExport.detection.emptyScanned':
    'Auf diesem Computer wurden keine importierbaren Datenspeicher gefunden.',
  'workbench.importExport.detection.emptyNotScanned':
    'Noch nichts gescannt — „Diesen Computer scannen“ listet importierbare Daten hier auf.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Datenspeicher-Datei wurde übersprungen —',
      other: '{count} Datenspeicher-Dateien wurden übersprungen —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Postman-Importbericht',
  'workbench.importExport.report.noReport': 'Für diesen Arbeitsbereich wurde kein Importbericht gefunden.',
  'workbench.importExport.report.cleanImport':
    'Alles wurde sauber importiert — keine Verwerfungen oder Transformationen.',
  'workbench.importExport.report.copyOk': 'Bericht als JSON kopiert',
  'workbench.importExport.report.copyAnonymizedOk': 'Anonymisierter Bericht als JSON kopiert',
  'workbench.importExport.report.copyFailed': 'Der Bericht ließ sich nicht kopieren.',
  'workbench.importExport.report.copyReport': 'Bericht kopieren',
  'workbench.importExport.report.download': 'Herunterladen',
  'workbench.importExport.report.anonymizeTooltip':
    'Fürs öffentliche Teilen (z. B. ein GitHub-Issue): Arbeitsbereich-Namen werden zu „Workspace N“ und ' +
    'umgeschriebene Werte geschwärzt. Pfade, Gründe und Zähler bleiben, damit der Bericht debugbar bleibt.',
  'workbench.importExport.report.anonymize': 'Anonymisieren',
  'workbench.importExport.report.close': 'Schließen',
  'workbench.importExport.report.openWorkspace': 'Arbeitsbereich öffnen',
  'workbench.importExport.report.countsLine':
    '{collections} Sammlungen · {environments} Umgebungen · {requests} Anfragen',
  'workbench.importExport.report.savedExamplesPart': '{count} gespeicherte Beispiele',
  'workbench.importExport.report.globalVariablesPart': '{count} globale Variablen',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Hinweis', other: '{count} Hinweise' }),
  'workbench.importExport.report.summaryImported': 'Importiert',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Sammlung', other: 'Sammlungen' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Umgebung', other: 'Umgebungen' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Anfrage', other: 'Anfragen' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'gespeichertes Beispiel', other: 'gespeicherte Beispiele' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'globale Variable', other: 'globale Variablen' }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Arbeitsbereich', other: '{count} Arbeitsbereiche' }),
  'workbench.importExport.report.withOpen': '(mit',
  'workbench.importExport.report.and': 'und',
  'workbench.importExport.report.into': 'in',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'zuvor',
  'workbench.importExport.reimport.previouslyImported': '(zuvor importiert {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} neues Problem seit dem letzten Import',
      other: '{count} neue Probleme seit dem letzten Import',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} zuvor nicht unterstützter Eintrag wird jetzt verarbeitet',
      other: '{count} zuvor nicht unterstützte Einträge werden jetzt verarbeitet',
    }),
  'workbench.importExport.reimport.countsChanged': 'Zähler seit dem letzten Import geändert',
  'workbench.importExport.reimport.minorChanges': 'Kleine Änderungen gegenüber dem letzten Import',
  'workbench.importExport.reimport.newDrops': 'Neue Verwerfungen ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Verwerfungen behoben ({count})',
  'workbench.importExport.reimport.newTransforms': 'Neue Transformationen ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Transformationen nicht mehr nötig ({count})',
} as const satisfies Catalog;
