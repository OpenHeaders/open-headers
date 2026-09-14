/**
 * DevTools panel — request inspector shell + detail tabs — Romanian.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary, the
 * panel-docs raw-quote precedent, fila as head noun), Diff, and wire
 * tokens (HEAD / CONNECT / 204 No Content / Server-Timing). Mints:
 * inițiator = initiator (prose referent — the tab noun rides raw;
 * carried from the popup condition label); cascadă = cascade; stivă de
 * apeluri = call stack (urmărire stivă stays the fixed stack-trace
 * compound); cadru here = stack frame (context-partitioned with the
 * WebSocket referent in panel-inspector-streams); mascare = redact
 * (secrete); Formatare = pretty print (carried from panel-storage's
 * Formatat); timpi = timing prose; blocarea capului de coadă =
 * head-of-line blocking; divizare = split carried from streams;
 * Vizualizator Hex rides the vizualizator family; simulare = mock
 * carried. The timing insight tails carry NO leading space — the render
 * site joins `<strong>{rung}</strong> {tail}` with its own space, so
 * the ro tail OPENS with a spaced dash and the head noun (`— această
 * fază …`), which keeps the raw rung name in front where Romanian
 * apposition order needs it.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  'panel.inspector.detailEmpty.requestGone':
    'Cererea nu mai este disponibilă (golită sau pagina a navigat în altă parte)',
  'panel.inspector.detailEmpty.selectPrefix': 'Selectați o cerere din panoul',
  'panel.inspector.detailEmpty.selectSuffix': 'Network pentru inspectare',
  'panel.inspector.detailEmpty.noSelection': 'Selectați o cerere capturată pentru inspectare',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  'panel.inspector.tabBar.closeTab': 'Închidere filă',
  'panel.inspector.tabBar.unsavedChanges': 'Modificări nesalvate',
  'panel.inspector.tabBar.searchTabs': 'Căutare în file',
  'panel.inspector.tabBar.searchPlaceholder': 'Căutați în file…',
  'panel.inspector.tabBar.noOpenTabs': 'Nicio filă deschisă',
  'panel.inspector.tabBar.noOpenTabsMatch': 'Nicio filă deschisă nu corespunde căutării dvs.',
  'panel.inspector.tabBar.noClosedTabsMatch': 'Nicio filă închisă nu corespunde căutării dvs.',
  'panel.inspector.tabBar.recentlyClosed': 'Închise recent ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Închise recent ({matched} din {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': 'Salvați modificările?',
  'panel.inspector.tabBar.closeGuard.unsavedBody': 'are modificări nesalvate. Salvați-le pentru a nu vă pierde munca.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'Fără salvare',
  'panel.inspector.tabBar.closeGuard.cancel': 'Anulare',
  'panel.inspector.tabBar.closeGuard.save': 'Salvare modificări',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': 'Închidere',
  'panel.inspector.tabMenu.closeOther': 'Închidere celelalte file',
  'panel.inspector.tabMenu.closeAll': 'Închidere toate filele',
  'panel.inspector.tabMenu.closeToLeft': 'Închidere filele din stânga',
  'panel.inspector.tabMenu.closeToRight': 'Închidere filele din dreapta',
  'panel.inspector.tabMenu.splitAndMove': 'Divizare și mutare',
  'panel.inspector.tabMenu.right': 'Dreapta',
  'panel.inspector.tabMenu.left': 'Stânga',
  'panel.inspector.tabMenu.down': 'Jos',
  'panel.inspector.tabMenu.up': 'Sus',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'Mutare în grupul opus',
  'panel.inspector.tabMenu.changeSplitterOrientation': 'Schimbare orientare separator',
  'panel.inspector.tabMenu.unsplit': 'Anulare divizare',
  'panel.inspector.tabMenu.unsplitAll': 'Anulare toate divizările',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns, same as the workbench tab nouns).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': 'Editare suprascriere',
  'panel.inspector.overrideCta.editOverrideTitle':
    'Editați regula care a produs acest răspuns — modificările se aplică cererilor viitoare',
  'panel.inspector.overrideCta.overrideResponse': 'Suprascriere răspuns',
  'panel.inspector.overrideCta.overrideResponseTitle':
    'Creează o regulă care servește acest răspuns ca simulare editabilă',
  'panel.inspector.overrideCta.editQueryParams': 'Editare suprascriere parametri de interogare',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'Editați regula care a rescris acești parametri de interogare — modificările se aplică cererilor viitoare',
  'panel.inspector.overrideCta.overrideQueryParams': 'Suprascriere parametri de interogare',
  'panel.inspector.overrideCta.overrideQueryParamsTitle':
    'Creează o regulă care rescrie acești parametri de interogare',
  'panel.inspector.overrideCta.editRequestBody': 'Editare suprascriere corp cerere',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'Editați regula care a înlocuit acest corp de cerere — modificările se aplică cererilor viitoare',
  'panel.inspector.overrideCta.overrideRequestBody': 'Suprascriere corp cerere',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Creează o regulă care înlocuiește acest corp de cerere cu un corp static editabil',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Răspuns complet',
  'panel.inspector.dualView.fullRequest': 'Cerere completă',
  'panel.inspector.dualView.swapSides': 'Inversare părți',
  'panel.inspector.dualView.hideUnchanged': 'Ascundere neschimbate',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': 'Original · server → pagină',
  'panel.inspector.paneCaption.responseModified': 'Modificat · server → Open Headers → pagină',
  'panel.inspector.paneCaption.requestOriginal': 'Original · pagină → server',
  'panel.inspector.paneCaption.requestModified': 'Modificat · pagină → Open Headers → server',
  'panel.inspector.paneCaption.wsRecvDropped': 'Eliminat · nu a ajuns niciodată la pagină',
  'panel.inspector.paneCaption.wsSendDropped': 'Eliminat · nu a ajuns niciodată la server',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': 'Fără corp de răspuns',
  'panel.inspector.bodyState.noPreviewTitle': 'Nicio previzualizare disponibilă',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Nimic de previzualizat',
  'panel.inspector.bodyState.noResponseDetail': 'Această cerere nu are date de răspuns disponibile',
  'panel.inspector.bodyState.failedTitle': 'Datele răspunsului nu au putut fi încărcate',
  'panel.inspector.bodyState.emptyTitle': '(corp de răspuns gol)',
  'panel.inspector.bodyState.emptyDetail': 'Serverul a returnat un corp gol.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Conținut util binar ({count} octeți).',
  'panel.inspector.bodyState.notApplicable.preflight': 'Niciun conținut disponibil pentru cererea preflight',
  'panel.inspector.bodyState.notApplicable.head': 'Fără corp de răspuns pentru cererea HEAD',
  'panel.inspector.bodyState.notApplicable.connect': 'Fără corp de răspuns pentru cererea CONNECT',
  'panel.inspector.bodyState.notApplicable.status204': 'Fără conținut (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'Fără conținut (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'Nemodificat — corp servit din cache-ul browserului',
  'panel.inspector.bodyState.notApplicable.informational': 'Fără conținut (răspuns informațional)',
  'panel.inspector.bodyState.notApplicable.websocket': 'Conexiune WebSocket stabilită — vedeți fila Messages',
  'panel.inspector.bodyState.unavailable.opaque': 'Corpul răspunsului nu este disponibil — răspuns cross-origin opac',
  'panel.inspector.bodyState.unavailable.cache':
    'Corp indisponibil — răspunsul a fost servit din cache înainte de deschiderea DevTools',
  'panel.inspector.bodyState.unavailable.redirect':
    'Niciun conținut disponibil, deoarece această cerere a fost redirecționată',
  'panel.inspector.bodyState.unavailable.unknown':
    'Corp necapturat. Gazda nu a returnat niciun conținut — răspunsul a fost transmis în flux fără memorare sau servit din cache.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Previzualizarea nu este disponibilă pentru acest tip de conținut.',
  'panel.inspector.preview.imageAlt': 'previzualizare răspuns',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': 'Formatare',
  'panel.inspector.viewer.revertTitle': 'Revenire la Content-Type declarat',
  'panel.inspector.viewer.parsedAsRevert': 'Analizat ca {format} · revenire',
  'panel.inspector.viewer.looksLikeParse': 'Pare a fi {format} · analizare',
  'panel.inspector.viewer.looksLikeTitle':
    'Content-Type pare greșit — corpul se analizează ca {format}. Apăsați pentru reinterpretare.',
  'panel.inspector.viewer.cursorInfo': 'Linia {line}, coloana {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} linie',
      few: '{count} linii',
      other: '{count} de linii',
    }),
  'panel.inspector.viewer.hexViewer': 'Vizualizator Hex',
  'panel.inspector.viewer.find': 'Căutare',
  'panel.inspector.viewer.findTitle': 'Căutare ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Parametrii șirului de interogare',
  'panel.inspector.payload.requestBody': 'Corpul cererii ({mime})',
  'panel.inspector.payload.viewSource': 'Afișare sursă',
  'panel.inspector.payload.viewParsed': 'Afișare analizat',
  'panel.inspector.payload.viewUrlEncoded': 'Afișare codificat URL',

  // ── Raw Data tab (inspector detail) ──────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'Export fragment',
  'panel.inspector.rawData.formatLabel': 'Format',
  'panel.inspector.rawData.copy': 'Copiere',
  'panel.inspector.rawData.copied': 'Copiat',
  'panel.inspector.rawData.rawHar': 'HAR brut (JSON)',
  'panel.inspector.rawData.downloadHar': 'Descărcare .har',
  'panel.inspector.rawData.noRequestData': '(nu există încă date de cerere)',
  'panel.inspector.rawData.view.label': 'Vizualizare',
  'panel.inspector.rawData.view.includeHeaders': 'Includere antete cerere',
  'panel.inspector.rawData.view.includeBody': 'Includere corp cerere',
  'panel.inspector.rawData.view.redactSecrets': 'Mascare secrete',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'Antete modificate de reguli',
  'panel.inspector.rawData.view.postRule': 'După reguli (în rețea)',
  'panel.inspector.rawData.view.original': 'Original (înainte de reguli)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (browser)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — mesaj brut',
  'panel.inspector.rawData.format.har': 'HAR — o singură intrare',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Format',
  'panel.inspector.rawData.harInfo.summary': 'HTTP Archive portabil — un instantaneu JSON al unei singure cereri.',
  'panel.inspector.rawData.harInfo.description':
    'Salvați-l pentru a-l atașa unui raport de eroare, a-l partaja cu un coleg sau a-l importa în alt instrument care citește fișiere HAR.',

  // ── Initiator tab (inspector detail) ─────────────────────────────────
  'panel.inspector.initiator.noData': 'Nu există date despre inițiator.',
  'panel.inspector.initiator.typeLabel': 'Tip:',
  'panel.inspector.initiator.stack.heading': 'Stiva de apeluri a cererii',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cadru',
      few: '{count} cadre',
      other: '{count} de cadre',
    }),
  'panel.inspector.initiator.stack.resolvedCount': 'rezolvate: {count}',
  'panel.inspector.initiator.stack.resolvedTitle': 'Nume de funcții rezolvate prin source map',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Afișare {count} ascuns',
      few: 'Afișare {count} ascunse',
      other: 'Afișare {count} de ascunse',
    }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Ascundere {count} zgomotos',
      few: 'Ascundere {count} zgomotoase',
      other: 'Ascundere {count} de zgomotoase',
    }),
  'panel.inspector.initiator.stack.noiseTitle': 'Ascunde cadrele anonime din pachetele minificate',
  'panel.inspector.initiator.stack.copyTitle': 'Copiere stivă ca text',
  'panel.inspector.initiator.stack.copy': 'Copiere',
  'panel.inspector.initiator.stack.copied': 'Copiat',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Filtrare cadre (nume de funcție sau URL)…',
  'panel.inspector.initiator.stack.filterAria': 'Filtrare cadre din stiva de apeluri',
  'panel.inspector.initiator.stack.noMatch': 'Niciun cadru nu se potrivește.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} cadru',
      few: '{count} cadre',
      other: '{count} de cadre',
    });
    return `Se afișează ${String(shown)} din ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '(ascunse: {count})',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Nume din source map: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (original: {source})',
  'panel.inspector.initiator.moreFilters.label': 'Mai multe filtre',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Numai eșecuri',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'Numai terțe',
  'panel.inspector.initiator.view.label': 'Vizualizare',
  'panel.inspector.initiator.view.sort': 'Sortare',
  'panel.inspector.initiator.view.sortInitiator': 'Ordinea inițiatorilor',
  'panel.inspector.initiator.view.sortChronological': 'Cronologic',
  'panel.inspector.initiator.view.sortLargest': 'Cel mai mare subarbore',
  'panel.inspector.initiator.view.showSuggestions': 'Afișare sugestii',
  'panel.inspector.initiator.filterPlaceholder':
    'Filtru — text, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': 'Filtrare lanț de inițiatori',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} potrivire',
      few: '{count} potriviri',
      other: '{count} de potriviri',
    }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': 'Lanțul de inițiatori al cererii',
  'panel.inspector.initiator.chainTree': 'Lanțul de inițiatori al cererii',
  'panel.inspector.initiator.collapse': 'Restrângere',
  'panel.inspector.initiator.expand': 'Extindere',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'cerere', few: 'cereri', other: 'de cereri' }),
  'panel.inspector.initiator.cascade.transferred': 'transferat',
  'panel.inspector.initiator.cascade.cumulative': 'cumulat',
  'panel.inspector.initiator.cascade.failed': 'eșuate',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'Tipul inițiatorului',
  'panel.inspector.initiator.chip.httpStatusTitle': 'Stare HTTP',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Cererea a eșuat',
  'panel.inspector.initiator.chip.failed': 'eșuată',
  'panel.inspector.initiator.chip.transferredTitle': 'Transferat',
  'panel.inspector.initiator.chip.durationTitle': 'Durată',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Origine terță',
  'panel.inspector.initiator.chip.thirdParty': 'terță',
  'panel.inspector.initiator.chip.subtreeTitle': 'Greutatea subarborelui (descendenți · octeți)',
  'panel.inspector.initiator.chip.subtree': '+{count} cer. · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere eșuată în această cascadă.',
      few: '{count} cereri eșuate în această cascadă.',
      other: '{count} de cereri eșuate în această cascadă.',
    }),
  'panel.inspector.initiator.insights.failedHint':
    'Verificați blocatoarele de reclame, regulile CSP și configurația CORS.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'a încărcat {count} cerere',
      few: 'a încărcat {count} cereri',
      other: 'a încărcat {count} de cereri',
    });
    return `Gazda ${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)}% din greutatea cascadei.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'Cea mai mare gazdă din această cascadă. Găzduiți local sau amânați dacă puteți.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent}% din octeții cascadei sunt terți.',
  'panel.inspector.initiator.insights.thirdPartyHint':
    'Reduceți, amânați sau găzduiți local resursele terțe neesențiale.',

  // ── Timing tab (inspector detail) — the tab's OWN copy ───────────────
  'panel.inspector.timing.noData': 'Nu există date de timp.',
  'panel.inspector.timing.view.label': 'Vizualizare',
  'panel.inspector.timing.view.showSuggestions': 'Afișare sugestii',
  'panel.inspector.timing.view.showContextStrip': 'Afișare bandă de context',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Afișare defalcare pe faze',
  'panel.inspector.timing.view.showTimingBar': 'Afișare bară de timp',
  'panel.inspector.timing.view.showServerTiming': 'Afișare Server-Timing',
  'panel.inspector.timing.view.showRepeats': 'Afișare repetări în sesiune',
  'panel.inspector.timing.view.showTransferRate': 'Afișare rată de transfer',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': '— această fază domină cererea: {ms} ({percent}% din total).',
  'panel.inspector.timing.insight.unusuallyHighTail': '— această fază este neobișnuit de lungă: {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'Planificatorul de cereri a reținut această cerere',
  'panel.inspector.timing.phase.queueing.hint':
    'Prea multe cereri concurente care se luptă pentru sloturi, sau prioritate scăzută.',
  'panel.inspector.timing.phase.stalled.what': 'Se așteaptă o conexiune disponibilă',
  'panel.inspector.timing.phase.stalled.hint':
    'Limita rezervei de conexiuni, negocierea cu proxy-ul sau blocarea capului de coadă în HTTP/1.1.',
  'panel.inspector.timing.phase.dns.what': 'Căutare DNS',
  'panel.inspector.timing.phase.dns.hint':
    'Afectează doar prima cerere către acest domeniu. Luați în calcul DNS prefetch.',
  'panel.inspector.timing.phase.connect.what': 'Handshake TCP cu serverul',
  'panel.inspector.timing.phase.connect.hint':
    'Conexiune nouă — keep-alive sau multiplexarea HTTP/2/3 reutilizează una pentru mai multe cereri.',
  'panel.inspector.timing.phase.ssl.what': 'Handshake TLS',
  'panel.inspector.timing.phase.ssl.hint': 'Redus prin reluarea sesiunii / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Încărcarea corpului cererii',
  'panel.inspector.timing.phase.send.hint':
    'Corp de cerere mare sau legătură ascendentă lentă — de obicei vizibil doar la POST/PUT.',
  'panel.inspector.timing.phase.wait.what': 'Timpul serverului până la primul octet',
  'panel.inspector.timing.phase.wait.hint':
    'Procesare pe backend. Căutați timpii backend-ului în Server-Timing sau în jurnalele de interogări ale bazei de date.',
  'panel.inspector.timing.phase.receive.what': 'Descărcarea conținutului util al răspunsului',
  'panel.inspector.timing.phase.receive.hint':
    'Dimensiunea conținutului util sau debitul CDN — verificați rata efectivă de transfer.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Protocol',
  'panel.inspector.timing.chip.connection': 'Conexiune',
  'panel.inspector.timing.chip.cache': 'Cache',
  'panel.inspector.timing.chip.priority': 'Prioritate',
  'panel.inspector.timing.chip.started': 'Începută',
  'panel.inspector.timing.chip.serverIp': 'IP server',
  'panel.inspector.timing.chip.connectionReused': 'reutilizată',
  'panel.inspector.timing.chip.connectionNew': 'nouă',
  'panel.inspector.timing.chip.openedBy': 'deschisă de {url}',
  'panel.inspector.timing.totalTime': 'Timp total',
  'panel.inspector.timing.totalWhere': '(în coadă → încheiată)',
  'panel.inspector.timing.caution': 'ATENȚIE: cererea nu s-a terminat încă!',
  'panel.inspector.timing.queuedAt': 'În coadă la {offset}',
  'panel.inspector.timing.startedAt': 'Începută la {offset}',
  'panel.inspector.timing.inProgress': 'în curs…',
  'panel.inspector.timing.noDuration': 'fără durată',
  'panel.inspector.timing.transferRate.heading': 'Rată de transfer',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Conținut descărcat:',
  'panel.inspector.timing.transferRate.effectiveRate': 'Rată efectivă:',
  'panel.inspector.timing.transferRate.amount': '{size} în {duration}',
  'panel.inspector.timing.repeats.heading': 'Repetări în această sesiune',
  'panel.inspector.timing.repeats.hitCount': 'Număr de accesări ale adresei URL:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'Cea mai rapidă / mediană / cea mai lentă:',
  'panel.inspector.timing.repeats.thisRequest': 'Această cerere:',
  'panel.inspector.timing.repeats.slowestTag': '(cea mai lentă)',
  'panel.inspector.timing.repeats.fastestTag': '(cea mai rapidă)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Defalcare pe cache:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
