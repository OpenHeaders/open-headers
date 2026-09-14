/**
 * DevTools panel — traffic table plane — Romanian. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, `n/a`, and every µs/ms/s figure. Mints: cascadă =
 * waterfall (prose — the Waterfall column name stays raw); coadă =
 * queue; În coadă = Queued; lacune neurmărite = untracked gaps; socket
 * cald = warm socket; momente-cheie = key moments; band names
 * Planificare / Conectare / Transfer; rând sintetizat = synthesized row;
 * lacună de fidelitate a capturii = capture-fidelity gap; nivel = sort
 * level; criteriu de departajare = tiebreak; curățat = sanitized
 * (carried from panel.ts); adnotare = row annotation (rail); contrazisă
 * = contradicted (carried); neatins = the rung state with neatins în
 * acest moment = the instant-tick referent (separate referents);
 * reținere în modul Depanare = debug-mode hold; Proxy de sistem =
 * System Proxy (the desktop file quotes it later); frază-motiv = reason
 * phrase (shared-info-status quotes it); dus-întors = round trip; în
 * zbor = in flight. Rung names, Initial connection, Highest → Lowest,
 * the resource-type chain and `n/a` ride raw with faza / bara as head
 * nouns (faza Waiting for server, bara Initial connection). The
 * desktop-watch settings row „Permiteți aplicației desktop să vadă
 * acest browser” copies the popup mint verbatim.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus ──────────────────────
  'panel.network.filterSyntaxHelp': 'Ajutor pentru sintaxa filtrului',
  'panel.network.aboutTypeFilters': 'Despre filtrele de tip de cerere',
  'panel.network.aboutSorting': 'Despre sortare',

  // ── Remote capture — consent refusal ─────────────────────────────────
  'panel.capture.watchRefused.title': 'Vizualizarea Live este dezactivată în acest browser',
  'panel.capture.watchRefused.body':
    'Extensia Open Headers din acest browser nu permite aplicației desktop să îi vadă traficul, stocarea sau consola. Activați „Permiteți aplicației desktop să vadă acest browser” în setările extensiei pentru a-l urmări aici.',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': 'Cerere emisă de service worker-ul originii',
  'panel.network.cell.jumpToPreflight': 'Salt la cererea preflight',
  'panel.network.cell.selectPreflightInitiator': 'Selectare cerere care a inițiat acest preflight',
  'panel.network.cell.pendingTitle': 'Cererea nu s-a terminat încă',
  'panel.network.cell.pending': 'În așteptare',
  'panel.network.gridAria': 'Cereri de rețea',
  'panel.network.noMatches': 'Nicio cerere potrivită.',
  'panel.network.reloadPage': 'Reîncărcare pagină',
  'panel.network.startRecording': 'Pornire înregistrare',

  // View ▾ menu
  'panel.network.view.label': 'Vizualizare',
  'panel.network.view.layout': 'Aspect',
  'panel.network.view.layoutCompact': 'Compact',
  'panel.network.view.layoutWide': 'Lat',
  'panel.network.view.valueNumber': 'Număr în valoare',
  'panel.network.view.showValue': 'Afișare valoare',
  'panel.network.view.valuesAlways': 'Întotdeauna',
  'panel.network.view.valuesHover': 'La trecerea cursorului',
  'panel.network.view.valuesOff': 'Dezactivat',
  'panel.network.view.valueFormat': 'Format valoare',
  'panel.network.view.formatRelative': 'Relativ',
  'panel.network.view.formatTimestamp': 'Marcaj de timp',
  'panel.network.view.timezone': 'Fus orar',
  'panel.network.view.tzLocal': 'Local',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Explicare valoare',
  'panel.network.view.explainValueTitle':
    'În popover-ul de la trecerea cursorului, evidențiază rândurile care compun totalul și afișează suma lor.',
  'panel.network.view.popover': 'Popover',
  'panel.network.view.popoverTitle':
    'Orientarea defalcării timpilor la trecerea cursorului. Auto alege după lățimea panoului — orizontal când este lat, vertical când este îngust.',
  'panel.network.view.popoverAuto': 'Auto',
  'panel.network.view.popoverCompact': 'Compact',
  'panel.network.view.popoverWide': 'Lat',
  'panel.network.view.showFireDots': 'Afișare puncte de declanșare a regulilor',

  // Sort ▾ menu
  'panel.network.sort.label': 'Sortare',
  'panel.network.sort.heading': 'Ordine de sortare',
  'panel.network.sort.byTime': 'Sortare după timp.',
  'panel.network.sort.groupPriority': 'Prioritate',
  'panel.network.sort.groupPriorityHint': 'Ce necesită atenția dvs. mai întâi.',
  'panel.network.sort.groupGrouping': 'Grupare',
  'panel.network.sort.groupGroupingHint': 'Grupează cererile pe categorii.',
  'panel.network.sort.ascending': 'Crescător',
  'panel.network.sort.descending': 'Descrescător',
  'panel.network.sort.customNested': 'Personalizată (imbricată)',
  'panel.network.sort.customNestedIdle': 'Sortare cu chei multiple — coloană cu coloană.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nivel — deschideți pentru editare.',
      few: '{count} niveluri — deschideți pentru editare.',
      other: '{count} de niveluri — deschideți pentru editare.',
    }),
  'panel.network.sort.noLevelsYet': 'Niciun nivel încă — deschideți constructorul.',
  'panel.network.sort.builderTitle': 'Sortare după, în ordine',
  'panel.network.sort.builderEmpty': 'Niciun nivel încă. Adăugați unul mai jos.',
  'panel.network.sort.asc': 'Cresc.',
  'panel.network.sort.desc': 'Descr.',
  'panel.network.sort.removeLevel': 'Eliminare nivel {n}',
  'panel.network.sort.addLevel': '+ Adăugare nivel',
  'panel.network.sort.finalTiebreak': 'Criteriu final de departajare: ora de început',
  'panel.network.sort.active': 'Activă',
  'panel.network.sort.apply': 'Aplicare',
  'panel.network.sort.columnClick': 'Personalizată (clic pe coloană)',
  'panel.network.sort.columnClickIdle': 'Apăsați un antet de coloană pentru a sorta după el.',
  'panel.network.sort.columnClickUse': 'apăsați un antet de coloană pentru a o folosi',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Eșecurile mai întâi',
  'panel.network.sortMode.failuresSubtitle':
    'Eșuate → în așteptare → redirecționate → reușite · ora de început în cadrul fiecărei grupe.',
  'panel.network.sortMode.slowest': 'Cele mai lente mai întâi',
  'panel.network.sortMode.slowestSubtitle':
    'Durata cea mai lungă mai întâi · la egalitate, ora de început păstrează ordinea cascadei.',
  'panel.network.sortMode.largest': 'Cele mai mari mai întâi',
  'panel.network.sortMode.largestSubtitle': 'Cei mai mulți octeți în rețea mai întâi · ora de început la egalitate.',
  'panel.network.sortMode.browserPriority': 'Prioritatea browserului',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest după prioritatea raportată de browser · ora de început în cadrul fiecărei grupe.',
  'panel.network.sortMode.byType': 'După tipul resursei',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · ora de început în cadrul fiecărei grupe.',
  'panel.network.sortMode.byDomain': 'După domeniu',
  'panel.network.sortMode.byDomainSubtitle':
    'Grupare după numele de gazdă (A → Z) · ora de început în cadrul fiecărui domeniu.',
  'panel.network.sortMode.ruleModified': 'Modificate de reguli mai întâi',
  'panel.network.sortMode.ruleModifiedSubtitle':
    'Reguli aplicate → deduse → fără declanșare · ora de început în cadrul fiecărei grupe.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'Când a început cererea.',
  'panel.network.sortMetric.responseTime': 'Când a sosit primul octet al răspunsului.',
  'panel.network.sortMetric.endTime': 'Când s-a terminat cererea.',
  'panel.network.sortMetric.duration': 'Cât a durat — bare aliniate la zero.',
  'panel.network.sortMetric.latency': 'Timpul până la primul octet — bare aliniate la zero.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Declanșări de reguli',
  'panel.network.railAnnotations': 'Adnotări',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'Deschidere în filă nouă',
  'panel.requestMenu.createApiRequest': 'Creare cerere API',
  'panel.requestMenu.copy': 'Copiere',
  'panel.requestMenu.copyUrl': 'Copiere URL',
  'panel.requestMenu.copyAsCurl': 'Copiere ca cURL',
  'panel.requestMenu.copyAsFetch': 'Copiere ca fetch',
  'panel.requestMenu.copyRequestHeaders': 'Copiere antete cerere',
  'panel.requestMenu.copyResponseHeaders': 'Copiere antete răspuns',
  'panel.requestMenu.copyResponse': 'Copiere răspuns',
  'panel.requestMenu.copyAsHar': 'Copiere ca HAR',
  'panel.requestMenu.copyAsHarSanitized': 'Copiere ca HAR (curățat)',
  'panel.requestMenu.copyAllUrls': 'Copiere toate adresele URL',
  'panel.requestMenu.copyAllAsCurl': 'Copiere toate ca cURL',
  'panel.requestMenu.copyAllAsHar': 'Copiere toate ca HAR',
  'panel.requestMenu.copyAllAsHarSanitized': 'Copiere toate ca HAR (curățat)',
  'panel.requestMenu.blockRequests': 'Blocare cereri',
  'panel.requestMenu.blockUrl': 'Blocare adresă URL a cererii',
  'panel.requestMenu.blockDomain': 'Blocare domeniu al cererii',
  'panel.requestMenu.saveAs': 'Salvare ca...',
  'panel.requestMenu.saveThisAsHar': 'Salvare aceasta ca HAR',
  'panel.requestMenu.saveThisAsHarSanitized': 'Salvare aceasta ca HAR (curățat)',
  'panel.requestMenu.saveAllAsHar': 'Salvare toate ca HAR',
  'panel.requestMenu.saveAllAsHarSanitized': 'Salvare toate ca HAR (curățat)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Tipuri de cereri',
  'panel.network.typeInfo.summary':
    'Restrânge lista la unul sau mai multe tipuri de cereri. „All” afișează totul; alegeți tipuri pentru filtrare sau combinați mai multe.',
  'panel.network.typeInfo.inlineHeading': 'Inline',
  'panel.network.typeInfo.fetchXhrDesc': 'Apeluri API — fetch() și XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'Conexiuni WebSocket.',
  'panel.network.typeInfo.underMoreHeading': 'Sub More',
  'panel.network.typeInfo.docCssJsDesc': 'Documente, foi de stil și scripturi.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Fonturi, imagini și audio / video.',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Manifeste de aplicații web, WebAssembly și tot restul.',
  'panel.network.sortInfo.summary':
    'Alege cum este ordonată lista de cereri. Treceți cursorul peste o grupă pentru a alege un mod anume.',
  'panel.network.sortInfo.modesHeading': 'Moduri',
  'panel.network.sortInfo.waterfallDesc': 'După timp — început, răspuns, sfârșit, durată sau latență.',
  'panel.network.sortInfo.priorityDesc': 'Ce necesită atenție mai întâi — eșecuri, cele mai lente, cele mai mari.',
  'panel.network.sortInfo.groupingDesc': 'Grupare după tip, domeniu sau modificare de reguli.',
  'panel.network.sortInfo.custom': 'Personalizată',
  'panel.network.sortInfo.customDesc':
    'Apăsați un antet de coloană sau construiți o sortare imbricată cu chei multiple.',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': 'Exemplu de cerere',
  'panel.network.colInfo.name.summary':
    'Numele fișierului resursei sau ultimul segment al căii — cel mai rapid mod de a recunoaște un rând.',
  'panel.network.colInfo.name.description':
    'Pictograma din față codifică tipul resursei; sfatul rândului și vizualizarea de detalii poartă adresa URL completă, antetele, conținutul util și timpii.',
  'panel.network.colInfo.path.summary': 'Tot ce urmează după gazdă — calea adresei URL plus șirul său de interogare.',
  'panel.network.colInfo.url.summary':
    'Adresa URL completă a cererii: schemă, gazdă, cale și interogare, de la un capăt la altul.',
  'panel.network.colInfo.requestNumber.summary':
    'Un index stabil atribuit în ordinea în care cererile au fost descoperite în timpul înregistrării, începând de la 1.',
  'panel.network.colInfo.requestNumber.description':
    'Nu se schimbă niciodată la resortare, așa că servește și ca referință la ordinea originală a capturii.',
  'panel.network.colInfo.method.summary': 'Verbul HTTP folosit de cerere.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Verbe frecvente',
  'panel.network.colInfo.method.getDesc': 'Citește o resursă — fără corp, sigur de repetat.',
  'panel.network.colInfo.method.postDesc': 'Creează sau trimite — poartă un corp de cerere.',
  'panel.network.colInfo.method.putPatchDesc': 'Înlocuiește sau actualizează parțial o resursă.',
  'panel.network.colInfo.method.deleteDesc': 'Elimină o resursă.',
  'panel.network.colInfo.status.summary':
    'Codul răspunsului HTTP (de ex. 200, 404) sau o etichetă scurtă de stare când nu există cod.',
  'panel.network.colInfo.status.description':
    'Intervalele de stare nu sunt codificate pe culori. Un eșec real — o eroare de rețea, orice 4xx/5xx sau o respingere CORS — colorează întregul rând în roșu; o potrivire în cache sau un rând fără stare estompează celula în gri. Fraza-motiv (de ex. „Not Found”) apare în sfatul celulei.',
  'panel.network.colInfo.status.codeRangesHeading': 'Intervale de coduri',
  'panel.network.colInfo.status.s2xxDesc': 'Succes — cererea a fost primită și tratată (de ex. 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': 'Redirecționare — urmați antetul Location către următoarea adresă URL.',
  'panel.network.colInfo.status.s4xxDesc':
    'Eroare de client — cererea a fost malformată, neautorizată sau resursa nu a fost găsită.',
  'panel.network.colInfo.status.s5xxDesc': 'Eroare de server — serverul nu a reușit să onoreze o cerere validă.',
  'panel.network.colInfo.status.insteadHeading': 'În locul unui cod',
  'panel.network.colInfo.status.pendingDesc':
    'Trimisă, dar niciun răspuns nu a sosit încă — gri cât timp este în zbor.',
  'panel.network.colInfo.status.failedDesc':
    'Un eșec la nivel de rețea (DNS, TLS, expirare, conexiune pierdută); codul stivei de rețea apare inline.',
  'panel.network.colInfo.status.canceledDesc': 'Cererea a fost abandonată înainte de a se termina.',
  'panel.network.colInfo.status.blockedDesc':
    'Browserul a refuzat-o dintr-un motiv de politică — de ex. csp, sau other pentru o extensie / un blocator de reclame.',
  'panel.network.colInfo.status.corsDesc': 'O verificare cross-origin a respins răspunsul.',
  'panel.network.colInfo.status.dataDesc': 'O adresă URL data: — servită inline, nu a atins niciodată rețeaua.',
  'panel.network.colInfo.status.finishedDesc': 'Un răspuns care nu a purtat niciun cod de stare.',
  'panel.network.colInfo.protocol.summary': 'Versiunea HTTP negociată de conexiune, aleasă la momentul handshake-ului.',
  'panel.network.colInfo.protocol.valuesHeading': 'Valori',
  'panel.network.colInfo.protocol.http11Desc': 'Bazat pe text, o singură cerere în zbor per conexiune.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — binar și multiplexat pe o singură conexiune.',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3 — rulează pe QUIC peste UDP pentru handshake-uri mai rapide.',
  'panel.network.colInfo.scheme.summary': 'Schema adresei URL — `https`, `http`, `ws` sau `wss`.',
  'panel.network.colInfo.domain.summary': 'Numele de gazdă căruia i-a fost adresată cererea.',
  'panel.network.colInfo.remoteAddress.summary': 'Adresa IP și portul la care a ajuns efectiv conexiunea.',
  'panel.network.colInfo.remoteAddress.description':
    'Diferă de domeniu când DNS returnează mai multe adrese IP, un CDN rutează prin anycast sau un proxy local interceptează conexiunea.',
  'panel.network.colInfo.type.summary':
    'Tipul resursei atribuit de browser — determină pictograma rândului și cipurile de filtrare de deasupra tabelului.',
  'panel.network.colInfo.type.examplesHeading': 'Exemple',
  'panel.network.colInfo.type.documentDesc': 'O navigare HTML de nivel superior sau în cadru.',
  'panel.network.colInfo.type.fetchXhrDesc': 'O cerere de date făcută din JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Resurse ale paginii încărcate de parser.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Resurse statice.',
  'panel.network.colInfo.initiator.summary': 'Ce a cauzat trimiterea cererii.',
  'panel.network.colInfo.initiator.kindsHeading': 'Tipuri',
  'panel.network.colInfo.initiator.scriptDesc': 'Declanșată din JavaScript — celula trimite la locul apelului.',
  'panel.network.colInfo.initiator.parserDesc': 'Parserul HTML a găsit resursa (un `<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'Un răspuns `3xx` a trimis browserul aici.',
  'panel.network.colInfo.initiator.otherDesc': 'O navigare, o preîncărcare sau o sursă neatribuită.',
  'panel.network.colInfo.cookies.summary':
    'Câte cookie-uri a atașat browserul cererii în antetul său `Cookie`. Gol când niciunul.',
  'panel.network.colInfo.setCookies.summary': 'Câte antete `Set-Cookie` a returnat răspunsul. Gol când niciunul.',
  'panel.network.colInfo.setCookies.description':
    'Deschideți fila Cookies a cererii pentru a vedea dacă browserul a acceptat sau a respins fiecare.',
  'panel.network.colInfo.size.summary':
    'Octeții care au trecut prin rețea, inclusiv antetele răspunsului și supraîncărcarea compresiei.',
  'panel.network.colInfo.size.insteadHeading': 'În locul unui număr',
  'panel.network.colInfo.size.diskCacheDesc': 'Servit din cache-ul de pe disc — nimic nu a atins rețeaua.',
  'panel.network.colInfo.size.memoryCacheDesc': 'Servit din cache-ul din memorie pentru pagina curentă.',
  'panel.network.colInfo.size.pendingDesc': 'Cererea nu s-a terminat încă.',
  'panel.network.colInfo.time.summary':
    'Durata activă de la trimiterea cererii până la ultimul octet al răspunsului — timpul petrecut în coadă este exclus.',
  'panel.network.colInfo.time.description':
    'Afișează `0 ms` pentru un răspuns instantaneu; rămâne gol cât timp o cerere este încă în zbor.',
  'panel.network.colInfo.priority.summary':
    'Prioritatea de preluare atribuită de browser, de la `Highest` până la `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Resursele cu prioritate mai mare sunt cerute mai devreme și primesc mai mult din conexiune. O pagină o poate influența cu atributul `fetchpriority`.',
  'panel.network.colInfo.waterfall.summary':
    'O bară de cronologie per cerere. Meniul antetului alege metrica, afișată ca o etichetă scurtă precum `Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Etichete de metrici',
  'panel.network.colInfo.waterfall.stDesc':
    'Start time — barele stau pe o cronologie comună după momentul în care a început fiecare cerere.',
  'panel.network.colInfo.waterfall.rtDesc':
    'Response time — plasate după momentul sosirii primului octet al răspunsului.',
  'panel.network.colInfo.waterfall.etDesc': 'End time — plasate după momentul în care s-a terminat fiecare cerere.',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration — bare aliniate la zero, dimensionate după durata completă a cererii.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency — bare aliniate la zero, împărțite acolo unde a început răspunsul.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary':
    'Un punct marchează fiecare cerere asupra căreia a acționat una dintre regulile dvs.',
  'panel.network.fireRail.dotColorsHeading': 'Culorile punctelor',
  'panel.network.fireRail.appliedDesc':
    'Aplicată — motorul de reguli a confirmat că regula s-a executat, raportorul nostru din pagină a confirmat că acțiunea a rulat sau modificarea este vizibilă în antetele capturate.',
  'panel.network.fireRail.inferredDesc':
    'Dedusă — regula s-a potrivit, aplicarea nu este verificabilă pentru această cerere.',
  'panel.network.fireRail.contradictedDesc':
    'Contrazisă — regula a pretins o schimbare de antet infirmată de antetele capturate.',
  'panel.network.annotationRail.summary':
    'Semnalează ce știe OpenHeaders dincolo de ce arată coloanele. Treceți cursorul peste un glif pentru explicație; apăsați-l pentru a deschide detaliile.',
  'panel.network.annotationRail.glyphsHeading': 'Glifuri',
  'panel.network.annotationRail.warnDesc':
    'Rândul nu este ceea ce pare — de ex. un transfer întrerupt în mijlocul descărcării.',
  'panel.network.annotationRail.infoDesc':
    'Context de proveniență sau fidelitate — neterminată, lacună de captură, rând sintetizat.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  'panel.network.timing.band.beforeWire': 'Planificare',
  'panel.network.timing.band.connecting': 'Conectare',
  'panel.network.timing.band.exchange': 'Transfer',
  'panel.network.timing.where.beforeWire': '(Browser)',
  'panel.network.timing.where.connecting': '(Browser ↔ Rețea)',
  'panel.network.timing.where.exchange': '(Rețea)',
  'panel.network.timing.absent.reused': 'conexiune reutilizată',
  'panel.network.timing.absent.notReached': 'neatins',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'fără date',
  'panel.network.timing.warmSocketTitle':
    'Niciun handshake TCP pe ceasul acestei cereri — socketul era deja stabilit (probabil preconectat). Doar TLS a rulat aici.',
  'panel.network.timing.warmSocketHint': 'socket cald',
  'panel.network.timing.moment.queued': 'În coadă',
  'panel.network.timing.moment.started': 'Începută',
  'panel.network.timing.moment.response': 'Răspuns',
  'panel.network.timing.moment.ended': 'Încheiată',
  'panel.network.timing.momentWhy.queued': 'cerere creată',
  'panel.network.timing.momentWhy.started': 'a părăsit coada',
  'panel.network.timing.momentWhy.response': 'primul octet (TTFB)',
  'panel.network.timing.momentWhy.ended': 'ultimul octet, gata',
  'panel.network.timing.untrackedGaps': 'Lacune neurmărite: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Echivalent Chrome: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL desenat în interior)',
  'panel.network.timing.terminalDetail.noResponse': 'niciun răspuns primit',
  'panel.network.timing.terminalDetail.neverReached': 'nu a ajuns niciodată în rețea',
  'panel.network.timing.keyMoments': 'Momente-cheie',
  'panel.network.timing.sinceFirstRequest': '(de la prima cerere)',
  'panel.network.timing.timingNotes': 'Note de timp',
  'panel.network.timing.totalTime': 'Timp total',
  'panel.network.timing.queuedToEnded': '(în coadă → încheiată)',
  'panel.network.timing.connectionOpenedBy': '↳ conexiune deschisă de {name}',
  'panel.network.timing.notFinishedCaution': 'ATENȚIE: cererea nu s-a terminat încă!',
  'panel.network.timing.queuedAt': 'În coadă la {time}',
  'panel.network.timing.startedAt': 'Începută la {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'neatins în acest moment',
  'panel.network.timing.onTheWire': '🌐 în rețea',
  'panel.network.timing.cdpExplainer':
    'Activați CDP și reîncărcați înainte de a naviga pentru defalcarea completă a conexiunii pe măsură ce rulează.',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Browser',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Browser ↔ Rețea',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Rețea',
  'panel.network.rungInfo.kickerInstant': 'Timing · Moment',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Rezultat',
  'panel.network.rungInfo.stripCaption': 'Exemplu de cerere — {ms} ms de la un capăt la altul',
  'panel.network.rungInfo.stripStop': 'marcat: unde s-a oprit cererea — fazele ulterioare nu au rulat',
  'panel.network.rungInfo.stripMarked': 'marcat: {label} la {ms} ms',
  'panel.network.rungInfo.stripGaps': 'evidențiate: lacunele neurmărite (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'evidențiate: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary':
    'Timpul petrecut de cerere în așteptare în browser înainte de a i se permite să înceapă.',
  'panel.network.rungInfo.queueing.description':
    'Browserul amână cererile pentru resurse cu prioritate mai mică, în timp ce cele cu prioritate mai mare se încarcă primele, și cât timp verifică cache-ul de pe disc. Pe HTTP/1.x așteaptă aici și când toate socketurile către gazdă sunt ocupate.',
  'panel.network.rungInfo.stalled.summary':
    'Permisă să înceapă, dar așteaptă o conexiune utilizabilă înainte ca orice lucru de rețea să poată începe.',
  'panel.network.rungInfo.stalled.description':
    'De obicei așteaptă ca un socket să devină disponibil sau o decizie a proxy-ului. Se încheie în momentul în care începe primul pas de rețea (DNS, TCP sau trimiterea).',
  'panel.network.rungInfo.dns.summary': 'Rezolvarea numelui de gazdă într-o adresă IP la care să se conecteze.',
  'panel.network.rungInfo.dns.description':
    'Afișează „conexiune reutilizată” când cererea a mers pe o conexiune deja deschisă — nu a fost nevoie de nicio căutare pe ceasul acestei cereri.',
  'panel.network.rungInfo.connect.summary': 'Doar handshake-ul TCP — dus-întorsul care deschide socketul către server.',
  'panel.network.rungInfo.connect.description':
    'Fila Timing din Chrome desenează o singură bară „Initial connection” care acoperă această fază ȘI handshake-ul TLS (bara sa SSL este desenată în interior). Le împărțim în faze separate, fără suprapunere, astfel încât fiecare milisecundă să fie numărată exact o dată — TCP + TLS de aici egalează bara Initial connection din Chrome.',
  'panel.network.rungInfo.ssl.summary':
    'Handshake-ul TLS — negocierea cheilor și verificarea certificatelor pentru ca conexiunea să fie criptată.',
  'panel.network.rungInfo.ssl.description':
    'Doar pe cererile https:// (n/a pe http:// simplu). „Conexiune reutilizată” înseamnă că o cerere anterioară a plătit deja acest cost pe același socket.',
  'panel.network.rungInfo.send.summary': 'Împingerea octeților cererii — antete și eventualul corp — în rețea.',
  'panel.network.rungInfo.send.description':
    'De obicei mult sub o milisecundă pentru cererile doar cu antete; crește la încărcări mari.',
  'panel.network.rungInfo.wait.summary':
    'De la ultimul octet al cererii trimis până la primul octet al răspunsului primit (timpul până la primul octet).',
  'panel.network.rungInfo.wait.description':
    'Timpul de gândire al serverului plus un dus-întors de rețea — faza în care apare munca backend-ului.',
  'panel.network.rungInfo.receive.summary': 'Descărcarea corpului răspunsului, de la primul octet la ultimul.',
  'panel.network.rungInfo.receive.description':
    'Crește în timp real cât timp un răspuns este încă transmis în flux; linia de atenție de sub diagramă semnalează o descărcare care nu s-a terminat niciodată.',
  'panel.network.rungInfo.notes.summary':
    'Evidența fragmentelor de timp dintre faze — înregistrate de la un capăt la altul, dar neaparținând niciunei faze.',
  'panel.network.rungInfo.notes.description':
    'Fiecare fază este măsurată între propriile momente de început și de sfârșit, în timp ce totalul este măsurat de la un capăt la altul — așa că mici „lacune neurmărite” pot sta între două faze (de ex. între sosirea răspunsului DNS și începerea handshake-ului TCP). Din cauza lor fazele nu se însumează întotdeauna la total. Fila Timing din Chrome are aceleași lacune și pur și simplu nu le desenează; noi le enumerăm pentru ca fiecare milisecundă să rămână contabilizată.',
  'panel.network.rungInfo.notes.linesHeading': 'Liniile',
  'panel.network.rungInfo.notes.gapsLabel': 'Lacune neurmărite',
  'panel.network.rungInfo.notes.gapsDesc': 'Fiecare lacună, denumită după fazele din jurul ei, cu durata sa.',
  'panel.network.rungInfo.notes.chromeLabel': 'Echivalent Chrome',
  'panel.network.rungInfo.notes.chromeDesc':
    'Cum se mapează fazele noastre separate TCP + TLS pe bara unică „Initial connection” din Chrome (bara sa SSL este desenată în interiorul acelei bare, nu după ea).',
  'panel.network.rungInfo.band.beforeWire.summary':
    'Timp petrecut în întregime în browser înainte de orice lucru de rețea — nimic nu a părăsit încă mașina.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (așteptarea permisiunii de a începe) plus Stalled (așteptarea unei conexiuni utilizabile). O cerere grea aici este reținută local — de priorități, limite de conexiuni sau decizii de proxy —, nu de server.',
  'panel.network.rungInfo.band.connecting.summary':
    'Pregătirea căii către server: rezolvarea numelui, deschiderea socketului, criptarea lui.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — dus-întorsurile handshake-urilor. Plătită o dată per conexiune: o cerere care merge pe un socket deja deschis sare peste toată această bandă („conexiune reutilizată”).',
  'panel.network.rungInfo.band.exchange.summary':
    'Schimbul propriu-zis prin rețea: trimiterea cererii, așteptarea serverului, descărcarea răspunsului.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. Lentoarea de pe server apare în faza Waiting; răspunsurile mari sau legăturile lente apar în faza Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    'Momentul în care browserul a creat cererea — zeroul de la care măsoară fiecare fază din această defalcare.',
  'panel.network.rungInfo.moment.queued.description':
    'Valoarea „la” este decalajul față de prima cerere vizibilă, astfel încât rândurile să poată fi comparate pe un singur ceas comun.',
  'panel.network.rungInfo.moment.started.summary':
    'Momentul în care cererea a părăsit coada și lucrul la ea a început efectiv.',
  'panel.network.rungInfo.moment.started.description':
    'În coadă + Queueing. Tot ce este înainte de acest reper este planificare a browserului; tot ce urmează este progres real al cererii.',
  'panel.network.rungInfo.moment.response.summary':
    'Momentul în care a sosit primul octet al răspunsului (timpul până la primul octet).',
  'panel.network.rungInfo.moment.response.description':
    'Serverul a răspuns; de aici corpul se descarcă. Absent când niciun răspuns nu a sosit vreodată (blocată sau eșuată mai întâi).',
  'panel.network.rungInfo.moment.ended.summary':
    'Momentul în care a sosit ultimul octet al răspunsului — cererea este gata.',
  'panel.network.rungInfo.moment.ended.description':
    'Încheiată − În coadă este timpul total afișat sub defalcare; Încheiată − Începută este durata activă afișată în coloana Time.',
  'panel.network.rungInfo.keyMoments.summary':
    'Momentele de graniță din viața cererii — unde o etapă predă ștafeta următoarei.',
  'panel.network.rungInfo.keyMoments.description':
    'În coadă și Începută există întotdeauna; Răspuns și Încheiată doar după ce un răspuns a sosit efectiv (o cerere blocată sau eșuată mai întâi își afișează în schimb marcajul de rezultat). Fazele de mai jos sunt intervalele dintre aceste momente.',
  'panel.network.rungInfo.terminal.whereHeading': 'Unde s-a oprit',
  'panel.network.rungInfo.terminal.noResponseDesc': 'A ajuns în rețea, dar niciun răspuns nu s-a mai întors.',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    'A murit în planificarea de pe partea browserului — nimic nu a fost trimis.',
  'panel.network.rungInfo.terminal.canceled.summary':
    'Cererea a fost abandonată înainte de a se termina — ✗ marchează unde s-a oprit; fazele ulterioare nu au rulat.',
  'panel.network.rungInfo.terminal.canceled.description':
    'Cauze tipice: pagina a navigat în altă parte în mijlocul încărcării, un script a abandonat apelul fetch sau utilizatorul a oprit încărcarea. Rețeaua nu a avut nicio problemă — browserul pur și simplu a renunțat la răspuns.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'Browserul a refuzat cererea dintr-un motiv de politică — cuvântul de după două puncte numește politica.',
  'panel.network.rungInfo.terminal.stoppedHere': '✗ marchează unde s-a oprit; fazele ulterioare nu au rulat.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Motive frecvente',
  'panel.network.rungInfo.terminal.blocked.cspDesc': 'Content-Security-Policy a paginii interzice această destinație.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'O resursă nesecurizată http:// pe o pagină https://.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    'O extensie, un blocator de reclame sau o regulă internă a browserului a refuzat-o.',
  'panel.network.rungInfo.terminal.cors.summary':
    'O verificare cross-origin a respins răspunsul — serverul a răspuns, dar paginii nu i s-a permis să îl citească.',
  'panel.network.rungInfo.terminal.cors.description':
    'Serverul trebuie să consimtă cu Access-Control-Allow-Origin (și antetele înrudite) pentru ca o pagină cross-origin să îi poată citi răspunsul. ✗ marchează unde a survenit respingerea.',
  'panel.network.rungInfo.terminal.failed.summary':
    'Un eșec la nivel de rețea — conexiunea în sine s-a rupt, iar codul net:: numește cauza exactă.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Coduri frecvente',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS nu a putut găsi gazda.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'Serverul a respins sau a închis socketul.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': 'Niciun răspuns în limita de timp a stivei de rețea.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'Certificatul TLS nu a trecut validarea.',

  // ── OH row annotations ───────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'Tot pe acest rând',
  'panel.rowAnnotations.openDetails': 'Deschidere detalii',
  'panel.rowAnnotations.interrupted.label': 'Transfer întrerupt',
  'panel.rowAnnotations.interrupted.detail':
    'Descărcarea a fost anulată înainte de a se termina. Starea reflectă antetele sosite înainte de întrerupere, iar datele primite sunt incomplete — altfel rândul nu se deosebește de unul terminat.',
  'panel.rowAnnotations.neverFinished.label': 'Neterminată',
  'panel.rowAnnotations.neverFinished.detail':
    'Pagina care a emis această cerere s-a descărcat cât timp cererea era încă în zbor, așa că niciun rezultat nu a fost înregistrat — de aceea Status și Time afișează „(unknown)”.',
  'panel.rowAnnotations.fidelityGap.label': 'Lacună de fidelitate a capturii',
  'panel.rowAnnotations.fidelityGap.detail':
    'Octeții transferați și corpul răspunsului nu sunt vizibile pentru calea de captură implicită la cererile care nu s-au terminat niciodată — inspecția îmbunătățită prin CDP le înregistrează.',
  'panel.rowAnnotations.syntheticHar.label': 'Rând sintetizat',
  'panel.rowAnnotations.syntheticHar.detail':
    'Acest rând a fost reconstruit dintr-o înregistrare de captură care nu s-a alăturat niciodată unei cereri în timp real, așa că unele coloane nu pot fi completate.',
  'panel.rowAnnotations.syntheticMemory.label': 'Rând sintetizat',
  'panel.rowAnnotations.syntheticMemory.detail':
    'Acest rând a fost reconstruit din Resource Timing al paginii (o potrivire în cache-ul din memorie nu ajunge niciodată la stiva de rețea), așa că antetele și cookie-urile nu sunt disponibile.',
  'panel.rowAnnotations.debugPaused.label': 'Reținere în modul Depanare',
  'panel.rowAnnotations.debugPaused.detail':
    '{ms} ms din timpul acestui rând au fost petrecute în pauză în interceptarea modului Depanare, nu în așteptarea serverului sau a rețelei — modul Depanare a reținut cererea cât timp a inspectat-o, așa că timpul total al rândului este mai lung decât a durat cererea în sine.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Rescriere parametri de interogare',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'Această redirecționare este Open Headers aplicând o regulă de parametri de interogare, nu serverul. Rescrierea șirului de interogare al unei adrese URL se face ca redirecționare internă, așa că apare ca propriul său salt; cererea continuă apoi către adresa URL rescrisă, cu metoda, corpul, cookie-urile și antetele transferate neschimbate.',
  'panel.rowAnnotations.redirectRule.label': 'Regulă de redirecționare',
  'panel.rowAnnotations.redirectRule.detail':
    'Această redirecționare este Open Headers aplicând o regulă de redirecționare, nu serverul. Se face ca redirecționare internă, așa că cererea originală apare ca propriul său salt înainte ca cererea să continue către adresa URL rescrisă.',
  'panel.rowAnnotations.systemProxyJoined.label': 'Proxy de sistem alăturat',
  'panel.rowAnnotations.systemProxyJoined.detail':
    'Acest schimb a fost capturat și de Proxy-ul de sistem — proxy-ul local. Antetele exacte din rețea, dimensiunile măsurate și timpii de socket din acea captură completează acolo unde captura browserului nu are propria înregistrare.',
  'panel.rowAnnotations.systemProxySeen.label': 'Văzut pe o filă de browser',
  'panel.rowAnnotations.systemProxySeen.detail':
    'Acest schimb interceptat a fost observat și pe fila de browser {tab} — cele două rânduri sunt aceeași cerere văzută din ambele părți.',
  'panel.rowAnnotations.systemProxySeen.unknownTab': 'o filă urmărită',
  'panel.rowAnnotations.systemProxySeen.jump': 'Afișare în sursa filei',
} as const satisfies Catalog;
