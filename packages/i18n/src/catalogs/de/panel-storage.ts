/**
 * DevTools panel — storage tool window — German. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose (Werkzeugfenster Storage), example-card
 * payloads, char / byte / MB figures, the Key / Value input
 * placeholders, and data-plane not-sent reasons riding as holes.
 * Mints: entry = der Eintrag; object store = der Objektspeicher;
 * IndexedDB record = der Datensatz (DB referent); database = die
 * Datenbank; cache = der Cache (m.); quota = das Kontingent; usage =
 * Nutzung; draft = der Entwurf (carried); size cap / ceiling = die
 * Obergrenze; page frame = der Frame (carried); merge editor = Merge
 * raw (shared-merge-editor mint) but the applied-toast prose rides
 * Zusammenführung (cookies-tab precedent); Origin raw (f., carried);
 * das Cookie-Glas carried.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'Speichertyp',
  'panel.storage.nav.local': 'Lokaler Speicher',
  'panel.storage.nav.session': 'Sitzungsspeicher',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Nutzung',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Treffer', other: '{count} Treffer' }),
  'panel.storage.filterAria': 'Speichereinträge filtern',
  'panel.storage.revealedHidden': 'Die aufgedeckte Zeile ist durch den aktiven Filter verborgen',
  'panel.storage.addCookieTitle': 'Ein Cookie zum Cookie-Glas des Browsers hinzufügen (einschließlich HttpOnly)',
  'panel.storage.addCookieAria': 'Cookie hinzufügen',
  'panel.storage.addEntryTitle': 'Eintrag hinzufügen',
  'panel.storage.addEntryAria': 'Speichereintrag hinzufügen',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB ist hier schreibgeschützt',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage ist hier schreibgeschützt',
  'panel.storage.addReadOnly.quota': 'Nutzung ist schreibgeschützt',
  'panel.storage.refreshTitle': 'Aktualisieren',
  'panel.storage.refreshAria': 'Speicher aktualisieren',
  'panel.storage.originAria': 'Speicher-Origin',
  'panel.storage.partitionedChip': 'partitioniert',
  'panel.storage.partitionedTitle':
    'Partitionierter Speicher — die Daten dieser Origin sind hier unter {site} geschlüsselt.\nSpeicherschlüssel: {raw}',
  'panel.storage.partitionFallback': 'einer Partition',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Eintrag', other: '{count} Einträge' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} Eintrag', other: '{count} Einträgen' });
    return `${String(shown)} von ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Cookie', other: '{count} Cookies' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} Cookie', other: '{count} Cookies' });
    return `${String(shown)} von ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Datenbank', other: '{count} Datenbanken' }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Cache', other: '{count} Caches' }),
  'panel.storage.count.quotaUsed': '{used} von {total} belegt',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Abschnitt passt', other: '{count} Abschnitte passen' }),
  'panel.storage.note.writeFailed': 'Schreiben fehlgeschlagen',
  'panel.storage.note.deleteFailed': 'Löschen fehlgeschlagen',
  'panel.storage.note.readFailed': 'Lesen fehlgeschlagen — letzte Daten werden gezeigt',
  'panel.storage.note.truncated': 'Liste gekürzt',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Lokalen Speicher leeren',
  'panel.storage.clear.label.session': 'Sitzungsspeicher leeren',
  'panel.storage.clear.label.cookies': 'Cookies leeren',
  'panel.storage.clear.label.indexeddb': 'IndexedDB leeren',
  'panel.storage.clear.label.cachestorage': 'Cache Storage leeren',
  'panel.storage.clear.title.local': 'Jeden localStorage-Eintrag leeren',
  'panel.storage.clear.title.session': 'Jeden sessionStorage-Eintrag leeren',
  'panel.storage.clear.title.cookies': 'Jedes Cookie im Glas dieser Site leeren',
  'panel.storage.clear.title.indexeddb': 'Jede IndexedDB-Datenbank leeren',
  'panel.storage.clear.title.cachestorage': 'Jeden Cache leeren',
  'panel.storage.clear.armedTitle.local': 'Löscht jeden localStorage-Eintrag für diese Origin',
  'panel.storage.clear.armedTitle.session': 'Löscht jeden sessionStorage-Eintrag für diese Origin',
  'panel.storage.clear.armedTitle.cookies': 'Löscht jedes Cookie im Glas dieser Site für diese Origin',
  'panel.storage.clear.armedTitle.indexeddb': 'Löscht jede IndexedDB-Datenbank für diese Origin',
  'panel.storage.clear.armedTitle.cachestorage': 'Löscht jeden Cache für diese Origin',
  'panel.storage.confirmClear': 'Leeren bestätigen?',
  'panel.storage.confirmDelete': 'Löschen bestätigen?',
  'panel.storage.confirmSuffixAria': '{action} — zum Bestätigen erneut klicken',
  'panel.storage.cleared': '✓ geleert',
  'panel.storage.clearFailed': 'Leeren fehlgeschlagen',
  // Empty / error states.
  'panel.storage.empty.loading': 'Wird geladen…',
  'panel.storage.empty.notAvailableTitle': 'Speicher-Inspektion ist hier nicht verfügbar',
  'panel.storage.empty.notAvailableSub': 'Dieser Host gibt den Anwendungsspeicher des inspizierten Tabs nicht frei.',
  'panel.storage.empty.noOriginsTitle': 'Keine inspizierbaren Origins',
  'panel.storage.empty.noOriginsDomSub':
    'Dieser Tab hat keine http(s)-Frames mit DOM-Speicher — browserinterne Seiten lassen sich nicht inspizieren.',
  'panel.storage.empty.noOriginsSub':
    'Dieser Tab hat keine http(s)-Frames — browserinterne Seiten lassen sich nicht inspizieren.',
  'panel.storage.empty.noOriginsCookiesSub':
    'Dieser Tab hat keine http(s)-Frames — browserinterne Seiten tragen keine Site-Cookies.',
  'panel.storage.empty.unavailableTitle': 'Speicher nicht verfügbar',
  'panel.storage.empty.unavailableSub':
    'Der Frame für {origin} lässt sich gerade nicht lesen — vielleicht hat er wegnavigiert.',
  'panel.storage.thisOrigin': 'diese Origin',
  'panel.storage.empty.noItems': 'Keine Einträge in {area} für {origin}.',
  'panel.storage.empty.noItemsMatch': 'Kein Eintrag passt zu deinem Filter.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Cookies sind hier nicht verfügbar',
  'panel.storage.empty.cookiesUnavailableSub': 'Dieser Host gibt das Cookie-Glas des Browsers nicht frei.',
  'panel.storage.empty.noCookies': 'Keine Cookies für {origin}.',
  'panel.storage.empty.noCookiesMatch': 'Kein Cookie passt zu deinem Filter.',
  // Jar cookie grid column headers — 'Domain · Path' carries the raw
  // attribute vocabulary inside the keyed value.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'Speichereinträge',
  'panel.storage.grid.clipped': 'beschnitten ({length})',
  'panel.storage.grid.editTitle': 'Diesen Eintrag bearbeiten',
  'panel.storage.grid.editAria': '{key} bearbeiten',
  'panel.storage.grid.deleteTitle': 'Diesen Eintrag löschen',
  'panel.storage.grid.deleteAria': '{key} löschen',
  'panel.storage.grid.newKeyAria': 'Schlüssel des neuen Eintrags',
  'panel.storage.grid.newValueAria': 'Wert des neuen Eintrags',
  'panel.storage.grid.keyAria': 'Eintragsschlüssel',
  'panel.storage.grid.valueAria': 'Eintragswert',
  'panel.storage.grid.addSaveHint': 'Den neuen Eintrag in den Speicher schreiben',
  'panel.storage.grid.editSaveHint': 'Den bearbeiteten Eintrag zurück in den Speicher schreiben',
  'panel.storage.grid.emptyKeyHint': 'Der Schlüssel darf nicht leer sein',
  'panel.storage.grid.cancelTitle': 'Abbrechen',
  'panel.storage.grid.cancelAddAria': 'Hinzufügen abbrechen',
  'panel.storage.grid.cancelEditAria': 'Bearbeiten abbrechen',
  'panel.storage.grid.tooLarge':
    'Zu groß, um hier bearbeitet zu werden — der volle Wert übersteigt die Bearbeitungs-Obergrenze.',
  'panel.storage.grid.fetchFailed': 'Der volle Wert lässt sich gerade nicht lesen.',
  'panel.storage.grid.loadingFullValue': 'Voller Wert wird geladen…',
  'panel.storage.save.label': 'Speichern',
  'panel.storage.save.noChanges': 'Keine Änderungen zu speichern',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Nicht an diese Seite gesendet — {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} wird nicht an diese Seite gesendet: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Partitioniert unter {key}',
  'panel.storage.cookieRow.editTitle': 'Dieses Cookie im Cookie-Glas des Browsers bearbeiten',
  'panel.storage.cookieRow.editAria': 'Cookie {name} bearbeiten',
  'panel.storage.cookieRow.deleteTitle': 'Dieses Cookie aus dem Cookie-Glas des Browsers löschen',
  'panel.storage.cookieRow.deleteAria': 'Cookie {name} löschen',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB lässt sich nicht lesen',
  'panel.storage.idb.cantReadSub':
    'Dieser Frame gibt seine Datenbanken gerade nicht frei — vielleicht hat er wegnavigiert.',
  'panel.storage.idb.noDatabases': 'Keine IndexedDB-Datenbanken für diese Origin.',
  'panel.storage.idb.versionTitle': 'Datenbankversion {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Objektspeicher', other: '{count} Objektspeicher' }),
  'panel.storage.idb.metaKeyPath': 'key: {path}',
  'panel.storage.idb.metaAutoIncrement': 'Auto-Increment-Schlüssel',
  'panel.storage.idb.metaOutOfLine': 'Out-of-line-Schlüssel',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Index', other: '{count} Indizes' }),
  'panel.storage.idb.deleteDbTitle': 'Die Datenbank {name} löschen',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Löscht {name} und jeden Objektspeicher darin — eine Seite, die sie offen hält, blockiert das Löschen',
  'panel.storage.idb.deleteDbAria': 'Datenbank {name} löschen',
  'panel.storage.idb.openStoreTitle': '{database} › {store} öffnen',
  'panel.storage.idb.clearStoreTitle': 'Alle Datensätze in {store} leeren',
  'panel.storage.idb.clearStoreConfirmTitle': 'Löscht jeden Datensatz in {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Objektspeicher {store} leeren',
  'panel.storage.idb.noStores': 'keine Objektspeicher',
  'panel.storage.idb.backTitle': 'Zurück zu den Datenbanken',
  'panel.storage.idb.cursorAria': 'Datensatz-Cursor',
  'panel.storage.idb.cursorTitle':
    'Den Objektspeicher über einen seiner Indizes lesen — die Schlüsselspalte wird zum Indexschlüssel',
  'panel.storage.idb.primaryKeyOption': 'Primärschlüssel',
  'panel.storage.idb.indexOption': 'Index: {name}',
  'panel.storage.idb.noRecords': 'Keine Datensätze in {store}.',
  'panel.storage.idb.noRecordsPage': 'Keine Datensätze in {store} auf dieser Seite.',
  'panel.storage.idb.noRecordsMatch': 'Kein Datensatz passt zu deinem Filter.',
  'panel.storage.idb.gridAria': 'IndexedDB-Datensätze',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Diesen Datensatz im Editor öffnen',
  'panel.storage.idb.keyCellTitle': 'Schlüssel: {key}\nPrimärschlüssel: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Diesen Datensatz löschen',
  'panel.storage.idb.deleteRecordAria': 'Datensatz {key} löschen',
  'panel.storage.pager.prevTitle': 'Vorherige Seite',
  'panel.storage.pager.nextTitle': 'Nächste Seite',
  'panel.storage.pager.page': 'Seite {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage lässt sich nicht lesen',
  'panel.storage.cache.cantReadSub':
    'Die API existiert nur in sicheren Kontexten (https) — oder dieser Frame lässt sich gerade nicht lesen.',
  'panel.storage.cache.noCaches': 'Keine Caches für diese Origin.',
  'panel.storage.cache.noCachesMatch': 'Kein Cache passt zu deinem Filter.',
  'panel.storage.cache.openTitle': 'Den Cache {name} öffnen',
  'panel.storage.cache.deleteTitle': 'Den Cache {name} löschen',
  'panel.storage.cache.deleteConfirmTitle': 'Löscht {name} und jeden Eintrag darin',
  'panel.storage.cache.deleteAria': 'Cache {name} löschen',
  'panel.storage.cache.backTitle': 'Zurück zu den Caches',
  'panel.storage.cache.noEntries': 'Keine Einträge in {name}.',
  'panel.storage.cache.noEntriesPage': 'Keine Einträge in {name} auf dieser Seite.',
  'panel.storage.cache.noEntriesMatch': 'Kein Eintrag passt zu deinem Filter.',
  'panel.storage.cache.gridAria': 'Cache-Einträge',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Diesen Eintrag löschen',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Löscht die gespeicherte Antwort — zum Bestätigen erneut klicken',
  'panel.storage.cache.deleteEntryAria': 'Eintrag {url} löschen',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'Nutzung lässt sich nicht lesen',
  'panel.storage.quota.cantReadSub':
    'Die API existiert nur in sicheren Kontexten (https) — oder dieser Frame lässt sich gerade nicht lesen.',
  'panel.storage.quota.used': '{size} belegt',
  'panel.storage.quota.ofTotal': 'von {size} ({percent} %)',
  'panel.storage.quota.type.serviceWorkers': 'Service Worker',
  'panel.storage.quota.type.fileSystems': 'Dateisysteme',
  'panel.storage.quota.type.other': 'Sonstiges',
  'panel.storage.quota.noBreakdown': 'Für diese Origin wird keine Nutzung pro Typ gemeldet.',
  'panel.storage.quota.debugHint': 'Aktiviere den Debug-Modus, um die Aufschlüsselung pro Typ zu sehen.',
  'panel.storage.quota.sessionNote': 'Sitzungsspeicher gilt pro Tab — das leert den Frame des inspizierten Tabs',
  'panel.storage.quota.targetsCaption': 'Ziele von Alles leeren',
  'panel.storage.quota.targetsTitle':
    'Alles leeren (oben rechts) löscht genau die angehakten Datentypen für diese Origin',
  'panel.storage.quota.simulateLabel': 'Benutzerdefiniertes Kontingent simulieren',
  'panel.storage.quota.simulateTitle':
    'Den Browser ein kleineres Kontingent für diese Origin melden und durchsetzen lassen — um zu testen, wie ' +
    'sich die Seite verhält, wenn der Speicher ausgeht',
  'panel.storage.quota.simulateSave': 'Speichern',
  'panel.storage.quota.simulateCancel': 'Abbrechen',
  'panel.storage.quota.simulateReset': 'Zurücksetzen',
  'panel.storage.quota.simulateResetTitle': 'Das simulierte Kontingent entfernen',
  'panel.storage.quota.simulateRange': 'gib 0–{max} MB ein',
  'panel.storage.quota.simulateFailed': 'Simulation fehlgeschlagen',
  'panel.storage.quota.clearEverything': 'Alles leeren',
  'panel.storage.quota.clearArmedTitle': 'Löscht die angehakten Datentypen für diese Origin',
  'panel.storage.quota.clearTitle': 'Die angehakten Datentypen für diese Origin leeren',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Beispiel-Schreibvorgang',
  'panel.storage.domCol.key.summary':
    'Der Name des Eintrags — ein String mit Groß-/Kleinschreibung, eindeutig innerhalb des {area} dieser ' +
    'Origin. Das Schreiben eines vorhandenen Schlüssels überschreibt seinen Wert.',
  'panel.storage.domCol.key.description':
    'Beim Umbenennen eines Eintrags wird hier zuerst der neue Schlüssel geschrieben und dann der alte ' +
    'entfernt — ein fehlgeschlagener Schreibvorgang verliert nie das Original.',
  'panel.storage.domCol.value.summary':
    'Die gespeicherte Payload — immer ein String; Seiten halten strukturierte Daten serialisiert, meist als JSON.',
  'panel.storage.domCol.value.description':
    'Das Raster zeigt eine einzeilige Vorschau und beschneidet sehr lange Werte — Öffnen oder Bearbeiten holt ' +
    'den vollen Text. Klicke auf eine Zeile, um sie als Editor-Tab zu öffnen; Doppelklick (oder der Stift) ' +
    'bearbeitet inline.',
  'panel.storage.cookieCol.name.summary':
    'Der Bezeichner des Cookies. Browser schlüsseln nach (name, domain, path) — derselbe Name mit anderem ' +
    'Geltungsbereich ist ein eigenes Cookie.',
  'panel.storage.cookieCol.name.description':
    'Ein Warndreieck markiert ein Cookie im Site-Glas, das der Browser einer Anfrage an die inspizierte Seite ' +
    'NICHT anhängen würde — fahre darüber für den Grund (Pfad anderswo gebunden, Secure-only auf http, an eine ' +
    'Subdomain gebunden, …).',
  'panel.storage.cookieCol.value.summary':
    'Die Payload des Cookies — das, was der Browser im Cookie-Header zurückschickt.',
  'panel.storage.cookieCol.value.description':
    'Klicke auf eine Zeile, um das Cookie als Editor-Tab mit vollem Wert und geparsten Ansichten zu öffnen; ' +
    'der Stift bearbeitet inline.',
  'panel.storage.cookieCol.scope.summary':
    'Wo der Browser dieses Cookie anhängt — seine Domain plus, wenn enger als /, sein Path.',
  'panel.storage.cookieCol.scope.description':
    'Ein domainweites Cookie (mit führendem Punkt gespeichert) fließt auch zu Subdomains; ein host-only-Cookie ' +
    'ist exakt an seinen Host gebunden. Der Pfad ist ein Präfix — /api bedeutet, dass nur Anfragen unter /api ' +
    'es tragen.',
  'panel.storage.cookieCol.expires.summary':
    'Wann der Browser das Cookie löscht, relativ zu jetzt — fahre darüber für das absolute Datum.',
  'panel.storage.cookieCol.expires.description':
    'Session bedeutet kein Expires / Max-Age — der Browser verwirft das Cookie, wenn die Sitzung endet.',
  'panel.storage.cacheCol.exampleCaption': 'Beispiel-Eintrag',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· gespeichert',
  'panel.storage.cacheCol.request.summary':
    'Die URL der gespeicherten Anfrage — der Schlüssel, gegen den der Cache Fetches abgleicht.',
  'panel.storage.cacheCol.request.description':
    'Beim Überfahren einer Zeile erscheint eine begrenzte Vorschau der gespeicherten Anfrage-Header. Klicke ' +
    'auf eine Zeile, um die gespeicherte Antwort als Editor-Tab zu öffnen; das Raster hält nur Metadaten.',
  'panel.storage.cacheCol.method.summary':
    'Die HTTP-Methode der gespeicherten Anfrage — neben der URL Teil des Cache-Schlüssels.',
  'panel.storage.cacheCol.method.description':
    'Fast immer GET: Die Cache API weist put / add für andere Methoden zurück.',
  'panel.storage.cacheCol.size.summary':
    'Die Größe der gespeicherten Antwort, gelesen aus ihrem content-length-Header.',
  'panel.storage.cacheCol.size.description':
    'Ein Gedankenstrich bedeutet, dass die gespeicherte Antwort kein content-length trägt — der Body ist ' +
    'trotzdem da, im Editor-Tab des Eintrags.',
  'panel.storage.cacheCol.time.summary': 'Wann die Antwort im Cache gespeichert wurde.',
  'panel.storage.cacheCol.time.description':
    'Nur auf angehefteten Tabs ableitbar — ein Gedankenstrich bedeutet, dass der Host es für diesen Bereich ' +
    'nicht lesen konnte.',
  'panel.storage.idbCol.exampleCaption': 'Beispiel-Datensatz',
  'panel.storage.idbCol.key.summary':
    'Der Schlüssel des Datensatzes unter dem aktuellen Cursor — standardmäßig der Primärschlüssel des ' +
    'Objektspeichers; die Wahl eines Index in der Pfadleiste liest über ihn, und diese Spalte wird zum ' +
    'Indexschlüssel.',
  'panel.storage.idbCol.key.description':
    'Beim Überfahren einer Zeile erscheinen beide Schlüssel (Cursor-Schlüssel und Primärschlüssel). Schlüssel ' +
    'können Zahlen, Strings, Datumswerte oder Arrays daraus sein.',
  'panel.storage.idbCol.value.summary':
    'Eine einzeilige Vorschau des Structured-Clone-Werts des Datensatzes, in der Seite serialisiert.',
  'panel.storage.idbCol.value.description':
    'Klicke auf eine Zeile, um den vollen Datensatz als Editor-Tab mit dem aufklappbaren Baum zu öffnen; das ' +
    'Raster hält nur die Vorschau.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'In Storage anzeigen',
  'panel.storage.doc.refreshConfirm': 'Verwirft deine Änderungen — zum Aktualisieren erneut klicken',
  'panel.storage.doc.discardEdits': 'Meine Änderungen verwerfen',
  'panel.storage.doc.openMergeView': 'Merge-Ansicht öffnen',
  'panel.storage.doc.preview': 'Vorschau',
  'panel.storage.doc.source': 'Quelle',
  'panel.storage.doc.formatAria': 'Format des Quelltexts',
  'panel.storage.doc.formatted': 'Formatiert',
  'panel.storage.doc.raw': 'Roh',
  'panel.storage.doc.formattedTitle': 'Zum Lesen formatiert — Speichern behält das gespeicherte Format',
  'panel.storage.doc.rawTitle': 'Der exakte gespeicherte Text',
  'panel.storage.doc.formatUnavailable': 'Die formatierte Ansicht gibt es nur für JSON-förmige Werte',
  'panel.storage.doc.formatInfoTitle': 'Formatierte Ansicht',
  'panel.storage.doc.formatInfoSummary': 'Formatiert und Roh sind zwei Ansichten desselben gespeicherten Texts.',
  'panel.storage.doc.formatInfoExampleCaption': 'Beispiel — ein Wert, zwei Ansichten',
  'panel.storage.doc.formatInfoModesHeading': 'Modi',
  'panel.storage.doc.formatInfoFormattedDesc':
    'Eine Leseansicht — nur der Leerraum unterscheidet sich. Änderungen werden zurück in das ursprüngliche ' +
    'gespeicherte Format codiert, und Speichern schreibt diesen Text; ein Speichern ohne Änderung schreibt ' +
    'exakt die ursprünglichen Bytes.',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    'Eine Leseansicht — nur der Leerraum unterscheidet sich. Dieses Dokument ist schreibgeschützt, und ' +
    'Formatiert ändert die gespeicherten Bytes nie.',
  'panel.storage.doc.formatInfoRawDesc': 'Die exakten gespeicherten Bytes.',
  'panel.storage.doc.unavailableSub':
    'Vielleicht wurde es gelöscht, oder der Frame lässt sich gerade nicht lesen — Aktualisieren versucht es erneut.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { one: '… ({count} weiteres Zeichen)', other: '… ({count} weitere Zeichen)' }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'Ein Cookie mit diesem Namen, dieser Domain und diesem Pfad existiert bereits — Speichern würde es ' +
    'überschreiben. Wähle eine andere Identität.',
  'panel.storage.doc.cookie.saveFailed.write':
    'Speichern fehlgeschlagen — das Cookie-Glas des Browsers hat den Schreibvorgang abgewiesen.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'Das neue Cookie wurde geschrieben, aber das Original ließ sich nicht entfernen — beide existieren. ' +
    'Aktualisieren liest das Glas neu ein.',
  'panel.storage.doc.cookie.saveHint': 'Das bearbeitete Cookie zurück in das Cookie-Glas des Browsers schreiben',
  'panel.storage.doc.cookie.blockedHint': 'Das Formular ist unvollständig oder eine Referenz löst sich nicht auf',
  'panel.storage.doc.cookie.refreshTitle': 'Das Cookie neu einlesen',
  'panel.storage.doc.cookie.refreshAria': 'Cookie aktualisieren',
  'panel.storage.doc.cookie.revealTitle': 'Cookies im Werkzeugfenster Storage öffnen',
  'panel.storage.doc.cookie.readOnlyNote':
    'Das Cookie-Glas dieses Hosts ist schreibgeschützt — das Dokument spiegelt das Glas, kann aber nicht ' +
    'zurückschreiben.',
  'panel.storage.doc.cookie.goneNote':
    'Dieses Cookie wurde im Browser gelöscht — deine ungespeicherten Änderungen bleiben erhalten. Speichern ' +
    'schreibt es zurück.',
  'panel.storage.doc.cookie.unavailableTitle': 'Das Cookie ist nicht mehr im Glas',
  'panel.storage.doc.cookie.unavailableSub':
    'Vielleicht wurde es gelöscht oder ist abgelaufen, oder das Glas lässt sich auf diesem Host nicht lesen — ' +
    'Aktualisieren versucht es erneut.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'Ein Eintrag mit diesem Schlüssel existiert bereits — Speichern würde ihn überschreiben. Wähle einen ' +
    'anderen Schlüssel.',
  'panel.storage.doc.dom.saveFailed.gone':
    'Der Eintrag ist nicht erreichbar — vielleicht wurde er gelöscht. Aktualisieren prüft erneut.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Speichern fehlgeschlagen — das Speicherkontingent wurde überschritten. Der ursprüngliche Eintrag ist ' +
    'unverändert.',
  'panel.storage.doc.dom.saveFailed.write': 'Speichern fehlgeschlagen — der Schreibvorgang wurde abgewiesen.',
  'panel.storage.doc.dom.modeAria': 'Ansichtsmodus des Eintrags',
  'panel.storage.doc.dom.previewTitle': 'Zuklappbarer Baum über dem geparsten Wert',
  'panel.storage.doc.dom.previewNeedsJson': 'Die Vorschau braucht einen JSON-Wert',
  'panel.storage.doc.dom.sourceTitle': 'Rohwert-Ansicht',
  'panel.storage.doc.dom.saveHint': 'Den bearbeiteten Eintrag zurück in den Speicher schreiben',
  'panel.storage.doc.dom.blockedHint': 'Der Schlüssel darf nicht leer sein',
  'panel.storage.doc.dom.refreshTitle': 'Den Eintrag neu einlesen',
  'panel.storage.doc.dom.refreshAria': 'Eintrag aktualisieren',
  'panel.storage.doc.dom.revealTitle': '{area} im Werkzeugfenster Storage öffnen',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': 'Eintragsschlüssel',
  'panel.storage.doc.dom.conflictNote': 'Der Wert hat sich im Browser geändert, während du bearbeitet hast.',
  'panel.storage.doc.dom.mergeToast':
    'Zusammenführung auf den Entwurf angewendet — Speichern schreibt ihn in den Browser',
  'panel.storage.doc.dom.goneNote':
    'Dieser Eintrag wurde im Browser gelöscht — deine ungespeicherten Änderungen bleiben erhalten. Speichern ' +
    'schreibt ihn zurück.',
  'panel.storage.doc.dom.unavailableTitle': 'Eintrag nicht mehr verfügbar',
  'panel.storage.doc.dom.tooLargeTitle': 'Zu groß zum Öffnen',
  'panel.storage.doc.dom.tooLargeSub': 'Der Wert liegt über der Obergrenze des Editors und bleibt schreibgeschützt.',
  'panel.storage.doc.dom.previewAria': 'Wertebaum des Eintrags',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'Kein gültiges JSON — korrigiere die Syntax und speichere erneut.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'Der Schlüssel hat sich geändert — Speichern würde einen neuen Datensatz anlegen. Stelle den ' +
    'ursprünglichen Schlüssel wieder her.',
  'panel.storage.doc.idb.saveFailed.gone':
    'Der Datensatz ist nicht erreichbar — vielleicht wurde er gelöscht. Aktualisieren prüft erneut.',
  'panel.storage.doc.idb.saveFailed.write': 'Speichern fehlgeschlagen — der Schreibvorgang wurde abgewiesen.',
  'panel.storage.doc.idb.modeAria': 'Ansichtsmodus des Datensatzes',
  'panel.storage.doc.idb.previewTitle': 'Zuklappbarer Baum über dem Datensatzwert',
  'panel.storage.doc.idb.previewNeedsDoc': 'Die Vorschau braucht ein wohlgeformtes Dokument',
  'panel.storage.doc.idb.sourceTitle': 'Quellansicht des ganzen Dokuments',
  'panel.storage.doc.idb.saveHint': 'Den bearbeiteten Wert zurück in den Datensatz schreiben',
  'panel.storage.doc.idb.refreshTitle': 'Den Datensatz neu einlesen',
  'panel.storage.doc.idb.refreshAria': 'Datensatz aktualisieren',
  'panel.storage.doc.idb.revealTitle': '{database} › {store} im Werkzeugfenster Storage öffnen',
  'panel.storage.doc.idb.truncatedNote': 'An der Größen-Obergrenze gekürzt — schreibgeschützt.',
  'panel.storage.doc.idb.nonJsonNote':
    'Enthält Nicht-JSON-Typen (Date, Map, binär, …) — als schreibgeschützte Darstellung gezeigt.',
  'panel.storage.doc.idb.conflictNote': 'Der Datensatz hat sich im Browser geändert, während du bearbeitet hast.',
  'panel.storage.doc.idb.mergeToast':
    'Zusammenführung auf den Entwurf angewendet — Speichern schreibt ihn in den Datensatz',
  'panel.storage.doc.idb.goneNote':
    'Dieser Datensatz wurde im Browser gelöscht oder hat seine Form geändert — deine ungespeicherten ' +
    'Änderungen bleiben erhalten. Speichern schreibt sie zurück.',
  'panel.storage.doc.idb.unavailableTitle': 'Datensatz nicht mehr verfügbar',
  'panel.storage.doc.idb.previewAria': 'Wertebaum des Datensatzes',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Diesen Eintrag aus dem Cache löschen',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Löscht die gespeicherte Antwort — zum Bestätigen erneut klicken',
  'panel.storage.doc.cache.deleteAria': 'Cache-Eintrag löschen',
  'panel.storage.doc.cache.refreshTitle': 'Die gespeicherte Antwort neu einlesen',
  'panel.storage.doc.cache.refreshAria': 'Cache-Eintrag aktualisieren',
  'panel.storage.doc.cache.revealTitle': 'Den Cache {cache} im Werkzeugfenster Storage öffnen',
  'panel.storage.doc.cache.deleteFailed': 'Löschen fehlgeschlagen — der Eintrag ist vielleicht schon weg.',
  'panel.storage.doc.cache.unavailableTitle': 'Cache-Eintrag nicht mehr verfügbar',
  'panel.storage.doc.cache.truncatedNote': 'Body an der Größen-Obergrenze gekürzt — {size} gespeichert.',
  'panel.storage.doc.cache.headersSummary': 'Antwort-Header ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Header filtern',
  'panel.storage.doc.cache.filterAria': 'Antwort-Header filtern',
  'panel.storage.doc.cache.noHeaders': 'Keine Header gespeichert.',
  'panel.storage.doc.cache.noHeadersMatch': 'Kein Header passt zu deinem Filter.',
  'panel.storage.doc.cache.bodySummary': 'Antwort-Body',
  'panel.storage.doc.cache.imageAria': 'Gespeicherter Bild-Body',
  'panel.storage.doc.cache.imageAlt': 'Gespeicherter Antwort-Body für {url}',
  'panel.storage.doc.cache.binaryBody': 'Binärer Body — {size} gespeichert.',
  'panel.storage.doc.cache.emptyBody': 'Leerer Body.',
} as const satisfies Catalog;
