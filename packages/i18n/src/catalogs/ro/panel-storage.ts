/**
 * DevTools panel — storage tool window — Romanian. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose (fereastra as head noun), example-card
 * payloads, char / byte / MB figures, the Key / Value input
 * placeholders (they name their raw columns), and data-plane not-sent
 * reasons riding as holes. Mints: intrare = entry (the storage grid
 * row AND the cache entry); înregistrare = the IndexedDB record (the
 * section noun carries the S19 split: înregistrare în {store});
 * element = item (the count lines); depozit de obiecte = object store;
 * cotă = quota (simulated limit) vs Utilizare = Usage (the nav
 * section); cadru = frame (page/iframe referent, carried); cursor;
 * editare pe loc = inline edit; plafon = cap / ceiling; chei cu
 * auto-incrementare = auto-increment keys with chei externe =
 * out-of-line keys; partiționat = partitioned; Formatat / Brut = the
 * Formatted / Raw toggle (Brut carried from panel.ts); depozitul de
 * cookie-uri (cookie jar) and ciornă carried from the shared register;
 * origine = origin; fila inspectată = the inspected tab; Golire totală
 * = Clear everything. The capitalized sentence-start `Cookie-ul` keeps
 * the glossary token (the hyphen breaks the boundary); prose cookie
 * stays lowercase Latin (cookie-ul / cookie-uri).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'Tip de stocare',
  'panel.storage.nav.local': 'Stocare locală',
  'panel.storage.nav.session': 'Stocare de sesiune',
  'panel.storage.nav.cookies': 'Cookie-uri',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Utilizare',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} potrivire',
      few: '{count} potriviri',
      other: '{count} de potriviri',
    }),
  'panel.storage.filterAria': 'Filtrare intrări de stocare',
  'panel.storage.revealedHidden': 'Rândul dezvăluit este ascuns de filtrul activ',
  'panel.storage.addCookieTitle': 'Adăugați un cookie în depozitul browserului (inclusiv HttpOnly)',
  'panel.storage.addCookieAria': 'Adăugare cookie',
  'panel.storage.addEntryTitle': 'Adăugare intrare',
  'panel.storage.addEntryAria': 'Adăugare intrare de stocare',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB este doar în citire aici',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage este doar în citire aici',
  'panel.storage.addReadOnly.quota': 'Utilizarea este doar în citire',
  'panel.storage.refreshTitle': 'Reîmprospătare',
  'panel.storage.refreshAria': 'Reîmprospătare stocare',
  'panel.storage.originAria': 'Originea stocării',
  'panel.storage.partitionedChip': 'partiționat',
  'panel.storage.partitionedTitle':
    'Stocare partiționată — datele acestei origini sunt indexate aici sub {site}.\nCheie de stocare: {raw}',
  'panel.storage.partitionFallback': 'o partiție',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} element',
      few: '{count} elemente',
      other: '{count} de elemente',
    }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} element',
      few: '{count} elemente',
      other: '{count} de elemente',
    });
    return `${String(shown)} din ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie',
      few: '{count} cookie-uri',
      other: '{count} de cookie-uri',
    }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} cookie',
      few: '{count} cookie-uri',
      other: '{count} de cookie-uri',
    });
    return `${String(shown)} din ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} bază de date',
      few: '{count} baze de date',
      other: '{count} de baze de date',
    }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cache',
      few: '{count} cache-uri',
      other: '{count} de cache-uri',
    }),
  'panel.storage.count.quotaUsed': '{used} din {total} utilizat',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} secțiune se potrivește',
      few: '{count} secțiuni se potrivesc',
      other: '{count} de secțiuni se potrivesc',
    }),
  'panel.storage.note.writeFailed': 'scrierea a eșuat',
  'panel.storage.note.deleteFailed': 'ștergerea a eșuat',
  'panel.storage.note.readFailed': 'citirea a eșuat — se afișează ultimele date',
  'panel.storage.note.truncated': 'listă trunchiată',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Golire stocare locală',
  'panel.storage.clear.label.session': 'Golire stocare de sesiune',
  'panel.storage.clear.label.cookies': 'Golire cookie-uri',
  'panel.storage.clear.label.indexeddb': 'Golire IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Golire Cache Storage',
  'panel.storage.clear.title.local': 'Golește fiecare intrare localStorage',
  'panel.storage.clear.title.session': 'Golește fiecare intrare sessionStorage',
  'panel.storage.clear.title.cookies': 'Golește fiecare cookie din depozitul acestui site',
  'panel.storage.clear.title.indexeddb': 'Golește fiecare bază de date IndexedDB',
  'panel.storage.clear.title.cachestorage': 'Golește fiecare cache',
  'panel.storage.clear.armedTitle.local': 'Șterge fiecare intrare localStorage pentru această origine',
  'panel.storage.clear.armedTitle.session': 'Șterge fiecare intrare sessionStorage pentru această origine',
  'panel.storage.clear.armedTitle.cookies': 'Șterge fiecare cookie din depozitul acestui site pentru această origine',
  'panel.storage.clear.armedTitle.indexeddb': 'Șterge fiecare bază de date IndexedDB pentru această origine',
  'panel.storage.clear.armedTitle.cachestorage': 'Șterge fiecare cache pentru această origine',
  'panel.storage.confirmClear': 'Confirmați golirea?',
  'panel.storage.confirmDelete': 'Confirmați ștergerea?',
  'panel.storage.confirmSuffixAria': '{action} — apăsați din nou pentru confirmare',
  'panel.storage.cleared': '✓ golit',
  'panel.storage.clearFailed': 'golirea a eșuat',
  // Empty / error states.
  'panel.storage.empty.loading': 'Se încarcă…',
  'panel.storage.empty.notAvailableTitle': 'Inspecția stocării nu este disponibilă aici',
  'panel.storage.empty.notAvailableSub': 'Această gazdă nu expune stocarea aplicației din fila inspectată.',
  'panel.storage.empty.noOriginsTitle': 'Nicio origine inspectabilă',
  'panel.storage.empty.noOriginsDomSub':
    'Această filă nu are cadre http(s) cu stocare DOM — paginile interne ale browserului nu pot fi inspectate.',
  'panel.storage.empty.noOriginsSub':
    'Această filă nu are cadre http(s) — paginile interne ale browserului nu pot fi inspectate.',
  'panel.storage.empty.noOriginsCookiesSub':
    'Această filă nu are cadre http(s) — paginile interne ale browserului nu poartă cookie-uri de site.',
  'panel.storage.empty.unavailableTitle': 'Stocare indisponibilă',
  'panel.storage.empty.unavailableSub':
    'Cadrul pentru {origin} nu poate fi citit în acest moment — este posibil să fi navigat în altă parte.',
  'panel.storage.thisOrigin': 'această origine',
  'panel.storage.empty.noItems': 'Niciun element în {area} pentru {origin}.',
  'panel.storage.empty.noItemsMatch': 'Niciun element nu corespunde filtrului dvs.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Cookie-urile nu sunt disponibile aici',
  'panel.storage.empty.cookiesUnavailableSub': 'Această gazdă nu expune depozitul de cookie-uri al browserului.',
  'panel.storage.empty.noCookies': 'Niciun cookie pentru {origin}.',
  'panel.storage.empty.noCookiesMatch': 'Niciun cookie nu corespunde filtrului dvs.',
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
  'panel.storage.grid.aria': 'Intrări de stocare',
  'panel.storage.grid.clipped': 'trunchiat ({length})',
  'panel.storage.grid.editTitle': 'Editare intrare',
  'panel.storage.grid.editAria': 'Editare {key}',
  'panel.storage.grid.deleteTitle': 'Ștergere intrare',
  'panel.storage.grid.deleteAria': 'Ștergere {key}',
  'panel.storage.grid.newKeyAria': 'Cheia noii intrări',
  'panel.storage.grid.newValueAria': 'Valoarea noii intrări',
  'panel.storage.grid.keyAria': 'Cheia intrării',
  'panel.storage.grid.valueAria': 'Valoarea intrării',
  'panel.storage.grid.addSaveHint': 'Scrie noua intrare în stocare',
  'panel.storage.grid.editSaveHint': 'Scrie intrarea editată înapoi în stocare',
  'panel.storage.grid.emptyKeyHint': 'Cheia nu poate fi goală',
  'panel.storage.grid.cancelTitle': 'Anulare',
  'panel.storage.grid.cancelAddAria': 'Anulare adăugare',
  'panel.storage.grid.cancelEditAria': 'Anulare editare',
  'panel.storage.grid.tooLarge': 'Prea mare pentru editare aici — valoarea completă depășește plafonul de editare.',
  'panel.storage.grid.fetchFailed': 'Valoarea completă nu poate fi citită în acest moment.',
  'panel.storage.grid.loadingFullValue': 'Se încarcă valoarea completă…',
  'panel.storage.save.label': 'Salvare',
  'panel.storage.save.noChanges': 'Nicio modificare de salvat',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Nu se trimite acestei pagini — {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie-ul {name} nu se trimite acestei pagini: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Partiționat sub {key}',
  'panel.storage.cookieRow.editTitle': 'Editare cookie în depozitul browserului',
  'panel.storage.cookieRow.editAria': 'Editare cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Ștergere cookie din depozitul browserului',
  'panel.storage.cookieRow.deleteAria': 'Ștergere cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB nu poate fi citit',
  'panel.storage.idb.cantReadSub':
    'Acest cadru nu își expune bazele de date în acest moment — este posibil să fi navigat în altă parte.',
  'panel.storage.idb.noDatabases': 'Nicio bază de date IndexedDB pentru această origine.',
  'panel.storage.idb.versionTitle': 'Versiunea bazei de date: {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} depozit',
      few: '{count} depozite',
      other: '{count} de depozite',
    }),
  'panel.storage.idb.metaKeyPath': 'cheie: {path}',
  'panel.storage.idb.metaAutoIncrement': 'chei cu auto-incrementare',
  'panel.storage.idb.metaOutOfLine': 'chei externe',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} index',
      few: '{count} indexuri',
      other: '{count} de indexuri',
    }),
  'panel.storage.idb.deleteDbTitle': 'Ștergere baza de date {name}',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Șterge {name} și fiecare depozit din ea — o pagină care o ține deschisă blochează ștergerea',
  'panel.storage.idb.deleteDbAria': 'Ștergere bază de date {name}',
  'panel.storage.idb.openStoreTitle': 'Deschidere {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Golire toate înregistrările din {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Șterge fiecare înregistrare din {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Golire depozit {store}',
  'panel.storage.idb.noStores': 'niciun depozit de obiecte',
  'panel.storage.idb.backTitle': 'Înapoi la bazele de date',
  'panel.storage.idb.cursorAria': 'Cursor de înregistrări',
  'panel.storage.idb.cursorTitle':
    'Citește depozitul printr-unul dintre indexurile sale — coloana cheii devine cheia indexului',
  'panel.storage.idb.primaryKeyOption': 'cheie primară',
  'panel.storage.idb.indexOption': 'index: {name}',
  'panel.storage.idb.noRecords': 'Nicio înregistrare în {store}.',
  'panel.storage.idb.noRecordsPage': 'Nicio înregistrare în {store} pe această pagină.',
  'panel.storage.idb.noRecordsMatch': 'Nicio înregistrare nu corespunde filtrului dvs.',
  'panel.storage.idb.gridAria': 'Înregistrări IndexedDB',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Deschidere înregistrare în editor',
  'panel.storage.idb.keyCellTitle': 'Cheie: {key}\nCheie primară: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Ștergere înregistrare',
  'panel.storage.idb.deleteRecordAria': 'Ștergere înregistrare {key}',
  'panel.storage.pager.prevTitle': 'Pagina anterioară',
  'panel.storage.pager.nextTitle': 'Pagina următoare',
  'panel.storage.pager.page': 'pagina {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage nu poate fi citit',
  'panel.storage.cache.cantReadSub':
    'Interfața API există doar în contexte securizate (https) — sau acest cadru nu poate fi citit în acest moment.',
  'panel.storage.cache.noCaches': 'Niciun cache pentru această origine.',
  'panel.storage.cache.noCachesMatch': 'Niciun cache nu corespunde filtrului dvs.',
  'panel.storage.cache.openTitle': 'Deschidere cache {name}',
  'panel.storage.cache.deleteTitle': 'Ștergere cache {name}',
  'panel.storage.cache.deleteConfirmTitle': 'Șterge {name} și fiecare intrare din el',
  'panel.storage.cache.deleteAria': 'Ștergere cache {name}',
  'panel.storage.cache.backTitle': 'Înapoi la cache-uri',
  'panel.storage.cache.noEntries': 'Nicio intrare în {name}.',
  'panel.storage.cache.noEntriesPage': 'Nicio intrare în {name} pe această pagină.',
  'panel.storage.cache.noEntriesMatch': 'Nicio intrare nu corespunde filtrului dvs.',
  'panel.storage.cache.gridAria': 'Intrări din cache',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Ștergere intrare',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Șterge răspunsul stocat — apăsați din nou pentru confirmare',
  'panel.storage.cache.deleteEntryAria': 'Ștergere intrare {url}',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'Utilizarea nu poate fi citită',
  'panel.storage.quota.cantReadSub':
    'Interfața API există doar în contexte securizate (https) — sau acest cadru nu poate fi citit în acest moment.',
  'panel.storage.quota.used': '{size} utilizat',
  'panel.storage.quota.ofTotal': 'din {size} ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Service workeri',
  'panel.storage.quota.type.fileSystems': 'Sisteme de fișiere',
  'panel.storage.quota.type.other': 'Altele',
  'panel.storage.quota.noBreakdown': 'Nicio utilizare pe tip raportată pentru această origine.',
  'panel.storage.quota.debugHint': 'Activați modul Depanare pentru a vedea defalcarea pe tip.',
  'panel.storage.quota.sessionNote': 'Stocarea de sesiune este per filă — aceasta golește cadrul filei inspectate',
  'panel.storage.quota.targetsCaption': 'Țintele acțiunii „Golire totală”',
  'panel.storage.quota.targetsTitle':
    '„Golire totală” (dreapta sus) șterge exact tipurile de date bifate pentru această origine',
  'panel.storage.quota.simulateLabel': 'Simulare cotă personalizată',
  'panel.storage.quota.simulateTitle':
    'Face browserul să raporteze și să impună o cotă mai mică pentru această origine — pentru a testa cum se comportă pagina când stocarea se epuizează',
  'panel.storage.quota.simulateSave': 'Salvare',
  'panel.storage.quota.simulateCancel': 'Anulare',
  'panel.storage.quota.simulateReset': 'Resetare',
  'panel.storage.quota.simulateResetTitle': 'Eliminare cotă simulată',
  'panel.storage.quota.simulateRange': 'introduceți 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'simularea a eșuat',
  'panel.storage.quota.clearEverything': 'Golire totală',
  'panel.storage.quota.clearArmedTitle': 'Șterge tipurile de date bifate pentru această origine',
  'panel.storage.quota.clearTitle': 'Golește tipurile de date bifate pentru această origine',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Exemplu de scriere',
  'panel.storage.domCol.key.summary':
    'Numele intrării — un șir sensibil la majuscule/minuscule, unic în {area} al acestei origini. Scrierea unei chei existente îi suprascrie valoarea.',
  'panel.storage.domCol.key.description':
    'Redenumirea unei intrări aici scrie mai întâi noua cheie, apoi o elimină pe cea veche — o scriere eșuată nu pierde niciodată originalul.',
  'panel.storage.domCol.value.summary':
    'Conținutul util stocat — întotdeauna un șir; paginile păstrează datele structurate serializate, de obicei ca JSON.',
  'panel.storage.domCol.value.description':
    'Grila afișează o previzualizare pe o linie și trunchiază valorile foarte lungi — deschiderea sau editarea unei intrări preia textul complet. Apăsați un rând pentru a-l deschide ca filă de editor; dublu clic (sau creionul) editează pe loc.',
  'panel.storage.cookieCol.name.summary':
    'Identificatorul cookie-ului. Browserele indexează după (name, domain, path) — același nume cu o altă sferă este un cookie separat.',
  'panel.storage.cookieCol.name.description':
    'Un triunghi de avertizare marchează un cookie din depozitul site-ului pe care browserul NU l-ar atașa unei cereri către pagina inspectată — treceți cursorul pentru motiv (cale limitată în altă parte, doar Secure pe http, limitat la subdomeniu, …).',
  'panel.storage.cookieCol.value.summary':
    'Conținutul util al cookie-ului — ce trimite browserul înapoi în antetul Cookie.',
  'panel.storage.cookieCol.value.description':
    'Apăsați un rând pentru a deschide cookie-ul ca filă de editor cu valoarea completă și vizualizările analizate; creionul editează pe loc.',
  'panel.storage.cookieCol.scope.summary':
    'Unde atașează browserul acest cookie — atributul său Domain plus, când este mai restrâns decât /, atributul Path.',
  'panel.storage.cookieCol.scope.description':
    'Un cookie pentru întregul domeniu (stocat cu un punct inițial) ajunge și la subdomenii; un cookie doar pentru gazdă este fixat exact pe gazda sa. Calea este un prefix — /api înseamnă că doar cererile de sub /api îl poartă.',
  'panel.storage.cookieCol.expires.summary':
    'Când șterge browserul cookie-ul, afișat relativ la momentul curent — treceți cursorul pentru data absolută.',
  'panel.storage.cookieCol.expires.description':
    'Session înseamnă fără Expires / Max-Age — browserul renunță la cookie când se încheie sesiunea.',
  'panel.storage.cacheCol.exampleCaption': 'Exemplu de intrare',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· stocat',
  'panel.storage.cacheCol.request.summary':
    'Adresa URL a cererii stocate — cheia cu care cache-ul potrivește apelurile fetch.',
  'panel.storage.cacheCol.request.description':
    'Trecerea cursorului peste un rând adaugă o previzualizare limitată a antetelor cererii stocate. Apăsați un rând pentru a deschide răspunsul stocat ca filă de editor; grila păstrează doar metadatele.',
  'panel.storage.cacheCol.method.summary':
    'Metoda HTTP a cererii stocate — parte din cheia cache-ului alături de adresa URL.',
  'panel.storage.cacheCol.method.description':
    'Aproape întotdeauna GET: Cache API respinge put / add pentru alte metode.',
  'panel.storage.cacheCol.size.summary': 'Dimensiunea răspunsului stocat, citită din antetul său content-length.',
  'panel.storage.cacheCol.size.description':
    'O linie de pauză înseamnă că răspunsul stocat nu poartă content-length — corpul este tot acolo, în fila de editor a intrării.',
  'panel.storage.cacheCol.time.summary': 'Când a fost stocat răspunsul în cache.',
  'panel.storage.cacheCol.time.description':
    'Derivabil doar pe filele atașate — o linie de pauză înseamnă că gazda nu a putut-o citi pentru această sferă.',
  'panel.storage.idbCol.exampleCaption': 'Exemplu de înregistrare',
  'panel.storage.idbCol.key.summary':
    'Cheia înregistrării sub cursorul curent — implicit cheia primară a depozitului; alegerea unui index în calea de navigare citește prin el, iar această coloană devine cheia indexului.',
  'panel.storage.idbCol.key.description':
    'Trecerea cursorului peste un rând afișează ambele chei (cheia cursorului și cheia primară). Cheile pot fi numere, șiruri, date sau matrice ale acestora.',
  'panel.storage.idbCol.value.summary':
    'O previzualizare pe o linie a valorii înregistrării (structured clone), serializată în pagină.',
  'panel.storage.idbCol.value.description':
    'Apăsați un rând pentru a deschide înregistrarea completă ca filă de editor cu arborele extensibil; grila păstrează doar previzualizarea.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Afișare în Storage',
  'panel.storage.doc.refreshConfirm': 'Renunță la editările dvs. — apăsați din nou pentru reîmprospătare',
  'panel.storage.doc.discardEdits': 'Renunțare la editările mele',
  'panel.storage.doc.openMergeView': 'Deschidere vizualizare de îmbinare',
  'panel.storage.doc.preview': 'Previzualizare',
  'panel.storage.doc.source': 'Sursă',
  'panel.storage.doc.formatAria': 'Formatul textului sursă',
  'panel.storage.doc.formatted': 'Formatat',
  'panel.storage.doc.raw': 'Brut',
  'panel.storage.doc.formattedTitle': 'Formatat pentru citire — Salvarea păstrează formatul stocat',
  'panel.storage.doc.rawTitle': 'Textul stocat exact',
  'panel.storage.doc.formatUnavailable': 'Vizualizarea formatată este disponibilă doar pentru valori de formă JSON',
  'panel.storage.doc.formatInfoTitle': 'Vizualizare formatată',
  'panel.storage.doc.formatInfoSummary': 'Formatat și Brut sunt două vizualizări ale aceluiași text stocat.',
  'panel.storage.doc.formatInfoExampleCaption': 'Exemplu — o valoare, două vizualizări',
  'panel.storage.doc.formatInfoModesHeading': 'Moduri',
  'panel.storage.doc.formatInfoFormattedDesc':
    'O vizualizare pentru citire — diferă doar spațiile albe. Editările sunt recodificate în formatul stocat original, iar Salvarea scrie acel text; o Salvare fără editări scrie exact octeții originali.',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    'O vizualizare pentru citire — diferă doar spațiile albe. Acest document este doar în citire, iar Formatat nu schimbă niciodată octeții stocați.',
  'panel.storage.doc.formatInfoRawDesc': 'Octeții stocați exact.',
  'panel.storage.doc.unavailableSub':
    'Este posibil să fi fost ștearsă sau cadrul nu poate fi citit în acest moment — Reîmprospătarea reîncearcă.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '… (încă {count} caracter)',
      few: '… (încă {count} caractere)',
      other: '… (încă {count} de caractere)',
    }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'Un cookie cu acel nume, domeniu și cale există deja — salvarea l-ar suprascrie. Alegeți o altă identitate.',
  'panel.storage.doc.cookie.saveFailed.write': 'Salvarea a eșuat — depozitul browserului a respins scrierea.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'Noul cookie a fost scris, dar originalul nu a putut fi eliminat — există ambele. Reîmprospătarea recitește depozitul.',
  'panel.storage.doc.cookie.saveHint': 'Scrie cookie-ul editat înapoi în depozitul browserului',
  'panel.storage.doc.cookie.blockedHint': 'Formularul este incomplet sau o referință nu se rezolvă',
  'panel.storage.doc.cookie.refreshTitle': 'Recitire cookie',
  'panel.storage.doc.cookie.refreshAria': 'Reîmprospătare cookie',
  'panel.storage.doc.cookie.revealTitle': 'Deschidere Cookie-uri în fereastra de instrumente Storage',
  'panel.storage.doc.cookie.readOnlyNote':
    'Depozitul de cookie-uri al acestei gazde este doar în citire — documentul reflectă depozitul, dar nu poate scrie înapoi.',
  'panel.storage.doc.cookie.goneNote':
    'Acest cookie a fost șters în browser — editările dvs. nesalvate sunt păstrate. Salvarea îl scrie înapoi.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie-ul nu mai este în depozit',
  'panel.storage.doc.cookie.unavailableSub':
    'Este posibil să fi fost șters sau să fi expirat, sau depozitul nu poate fi citit pe această gazdă — Reîmprospătarea reîncearcă.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'O intrare cu acea cheie există deja — salvarea ar suprascrie-o. Alegeți o altă cheie.',
  'panel.storage.doc.dom.saveFailed.gone':
    'Intrarea nu poate fi accesată — este posibil să fi fost ștearsă. Reîmprospătarea reverifică.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Salvarea a eșuat — cota de stocare a fost depășită. Intrarea originală este neschimbată.',
  'panel.storage.doc.dom.saveFailed.write': 'Salvarea a eșuat — scrierea a fost respinsă.',
  'panel.storage.doc.dom.modeAria': 'Mod de vizualizare a intrării',
  'panel.storage.doc.dom.previewTitle': 'Arbore restrângibil peste valoarea analizată',
  'panel.storage.doc.dom.previewNeedsJson': 'Previzualizarea necesită o valoare JSON',
  'panel.storage.doc.dom.sourceTitle': 'Vizualizare valoare brută',
  'panel.storage.doc.dom.saveHint': 'Scrie intrarea editată înapoi în stocare',
  'panel.storage.doc.dom.blockedHint': 'Cheia nu poate fi goală',
  'panel.storage.doc.dom.refreshTitle': 'Recitire intrare',
  'panel.storage.doc.dom.refreshAria': 'Reîmprospătare intrare',
  'panel.storage.doc.dom.revealTitle': 'Deschidere {area} în fereastra de instrumente Storage',
  'panel.storage.doc.dom.keyLabel': 'Cheie',
  'panel.storage.doc.dom.keyAria': 'Cheia intrării',
  'panel.storage.doc.dom.conflictNote': 'Valoarea s-a schimbat în browser în timp ce editați.',
  'panel.storage.doc.dom.mergeToast': 'Îmbinare aplicată ciornei — Salvarea o scrie în browser',
  'panel.storage.doc.dom.goneNote':
    'Această intrare a fost ștearsă în browser — editările dvs. nesalvate sunt păstrate. Salvarea o scrie înapoi.',
  'panel.storage.doc.dom.unavailableTitle': 'Intrarea nu mai este disponibilă',
  'panel.storage.doc.dom.tooLargeTitle': 'Prea mare pentru deschidere',
  'panel.storage.doc.dom.tooLargeSub': 'Valoarea depășește plafonul editorului și rămâne doar în citire.',
  'panel.storage.doc.dom.previewAria': 'Arborele valorii intrării',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'JSON nevalid — corectați sintaxa și salvați din nou.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'Cheia s-a schimbat — salvarea ar crea o înregistrare nouă. Restaurați cheia originală.',
  'panel.storage.doc.idb.saveFailed.gone':
    'Înregistrarea nu poate fi accesată — este posibil să fi fost ștearsă. Reîmprospătarea reverifică.',
  'panel.storage.doc.idb.saveFailed.write': 'Salvarea a eșuat — scrierea a fost respinsă.',
  'panel.storage.doc.idb.modeAria': 'Mod de vizualizare a înregistrării',
  'panel.storage.doc.idb.previewTitle': 'Arbore restrângibil peste valoarea înregistrării',
  'panel.storage.doc.idb.previewNeedsDoc': 'Previzualizarea necesită un document bine format',
  'panel.storage.doc.idb.sourceTitle': 'Vizualizare sursă a întregului document',
  'panel.storage.doc.idb.saveHint': 'Scrie valoarea editată înapoi în înregistrare',
  'panel.storage.doc.idb.refreshTitle': 'Recitire înregistrare',
  'panel.storage.doc.idb.refreshAria': 'Reîmprospătare înregistrare',
  'panel.storage.doc.idb.revealTitle': 'Deschidere {database} › {store} în fereastra de instrumente Storage',
  'panel.storage.doc.idb.truncatedNote': 'Trunchiat la plafonul de dimensiune — doar în citire.',
  'panel.storage.doc.idb.nonJsonNote':
    'Conține tipuri non-JSON (Date, Map, binare, …) — afișat ca o redare doar în citire.',
  'panel.storage.doc.idb.conflictNote': 'Înregistrarea s-a schimbat în browser în timp ce editați.',
  'panel.storage.doc.idb.mergeToast': 'Îmbinare aplicată ciornei — Salvarea o scrie în înregistrare',
  'panel.storage.doc.idb.goneNote':
    'Această înregistrare a fost ștearsă sau și-a schimbat forma în browser — editările dvs. nesalvate sunt păstrate. Salvarea le scrie înapoi.',
  'panel.storage.doc.idb.unavailableTitle': 'Înregistrarea nu mai este disponibilă',
  'panel.storage.doc.idb.previewAria': 'Arborele valorii înregistrării',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Ștergere intrare din cache',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Șterge răspunsul stocat — apăsați din nou pentru confirmare',
  'panel.storage.doc.cache.deleteAria': 'Ștergere intrare din cache',
  'panel.storage.doc.cache.refreshTitle': 'Recitire răspuns stocat',
  'panel.storage.doc.cache.refreshAria': 'Reîmprospătare intrare din cache',
  'panel.storage.doc.cache.revealTitle': 'Deschidere cache {cache} în fereastra de instrumente Storage',
  'panel.storage.doc.cache.deleteFailed': 'Ștergerea a eșuat — este posibil ca intrarea să fi dispărut deja.',
  'panel.storage.doc.cache.unavailableTitle': 'Intrarea din cache nu mai este disponibilă',
  'panel.storage.doc.cache.truncatedNote': 'Corp trunchiat la plafonul de dimensiune — {size} stocat.',
  'panel.storage.doc.cache.headersSummary': 'Antete de răspuns ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Filtrare antete',
  'panel.storage.doc.cache.filterAria': 'Filtrare antete de răspuns',
  'panel.storage.doc.cache.noHeaders': 'Niciun antet stocat.',
  'panel.storage.doc.cache.noHeadersMatch': 'Niciun antet nu corespunde filtrului dvs.',
  'panel.storage.doc.cache.bodySummary': 'Corpul răspunsului',
  'panel.storage.doc.cache.imageAria': 'Corp de imagine stocat',
  'panel.storage.doc.cache.imageAlt': 'Corpul răspunsului stocat pentru {url}',
  'panel.storage.doc.cache.binaryBody': 'Corp binar — {size} stocat.',
  'panel.storage.doc.cache.emptyBody': 'Corp gol.',
} as const satisfies Catalog;
