/**
 * DevTools panel — inspector stream tabs — Romanian. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, Base64 /
 * Hex / UTF-8 modes, `keepalive` and `socket` stay parity-raw. Mints:
 * wire = rețea (crossed the wire = a trecut prin rețea; the wire
 * recorded = rețeaua a înregistrat — consistent with panel-network's
 * „în rețea”); cadru / conținut util carried; eliminat = dropped (a
 * rule drops a frame — the browser RESPINGE a Set-Cookie, the cookies
 * split); injectat = injected; sintetic = synthetic; livrat = delivered
 * (carried); dedus = inferred vs derivat = derived (two referents);
 * planul de captură = capture plane; wrapper raw (wrapper-ul); punct
 * final = endpoint; vizualizator de conținut util = payload viewer;
 * punct de declanșare = fire dot (chihlimbariu); inițializată din acest
 * cadru / eveniment = seeded from; Server-Sent Events rides raw (MDN
 * vocabulary) with evenimente as head noun; această parte = "this
 * side" of the split; Brut = Raw carried. Quoted OH labels copy this
 * file's mints in „…”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ───────────────────
  'panel.inspector.streams.clearAll': 'Golire toate',
  'panel.inspector.streams.directionFilterTitle': 'Filtrare după direcție',
  'panel.inspector.streams.directionAll': 'Toate',
  'panel.inspector.streams.directionSend': 'Trimitere',
  'panel.inspector.streams.directionReceive': 'Primire',
  'panel.inspector.streams.filterAria': 'Filtrare mesaje din flux',
  'panel.inspector.streams.sortByTitle': 'Sortare după {column}',
  'panel.inspector.streams.resizeColumnAria': 'Redimensionare coloană {column}',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'Vizualizare',
  'panel.inspector.streams.view.layout': 'Aspect',
  'panel.inspector.streams.view.layoutCompact': 'Compact',
  'panel.inspector.streams.view.layoutWide': 'Lat',
  'panel.inspector.streams.view.split': 'Divizare',
  'panel.inspector.streams.view.splitSideBySide': 'Alăturat',
  'panel.inspector.streams.view.splitStacked': 'Suprapus',
  'panel.inspector.streams.view.splitDisabledTitle':
    'Activați previzualizarea conținutului util pentru a diviza panoul',
  'panel.inspector.streams.view.showPreview': 'Afișare previzualizare conținut util',

  // Fire-rail dot titles + row actions.
  'panel.inspector.streams.fire.appliedFrame':
    'Regulă aplicată — conținutul util al cadrului corespunde conținutului util al regulii',
  'panel.inspector.streams.fire.inferredFrame': 'Regulă potrivită — aplicarea nu este verificabilă pentru acest cadru',
  'panel.inspector.streams.fire.injectedFrame': 'Regulă aplicată — acest cadru a fost injectat de regulă',
  'panel.inspector.streams.fire.replacedFrame': 'Regulă aplicată — regula a înlocuit acest cadru',
  'panel.inspector.streams.fire.droppedSendFrame':
    'Regula a eliminat acest cadru — nu a fost trimis niciodată la server',
  'panel.inspector.streams.fire.droppedRecvFrame': 'Regula a eliminat acest cadru — pagina nu l-a primit niciodată',
  'panel.inspector.streams.fire.appliedEvent':
    'Regulă aplicată — conținutul util al evenimentului corespunde conținutului util al regulii',
  'panel.inspector.streams.fire.inferredEvent':
    'Regulă potrivită — aplicarea nu este verificabilă pentru acest eveniment',
  'panel.inspector.streams.fire.injectedEvent': 'Regulă aplicată — acest eveniment a fost injectat de regulă',
  'panel.inspector.streams.fire.replacedEvent': 'Regulă aplicată — regula a înlocuit acest eveniment',
  'panel.inspector.streams.fire.droppedEvent': 'Regula a eliminat acest eveniment — pagina nu l-a primit niciodată',
  'panel.inspector.streams.row.copied': 'Copiat',
  'panel.inspector.streams.row.copyPayload': 'Copiere conținut util',
  'panel.inspector.streams.row.editRule': 'Editare regulă',
  'panel.inspector.streams.row.override': 'Suprascriere',
  'panel.inspector.streams.row.droppedSendCell': 'Eliminat — netrimis niciodată la server',
  'panel.inspector.streams.row.droppedRecvCell': 'Eliminat — nelivrat niciodată paginii',
  'panel.inspector.streams.row.notCaptured': 'Necapturat',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Filtrare mesaje',
  'panel.inspector.messages.listAria': 'Mesaje WebSocket',
  'panel.inspector.messages.overrideMessage': 'Suprascriere mesaj',
  'panel.inspector.messages.overrideMessageTitle': 'Creați o regulă de mesaje pentru această conexiune',
  'panel.inspector.messages.editRuleTitle': 'Editați regula de mesaje care a acționat asupra acestui cadru',
  'panel.inspector.messages.createRuleTitle': 'Creați o regulă de mesaje inițializată din acest cadru',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Rând sintetic — pagina a produs acest cadru; regula l-a eliminat înainte de trimitere',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Cadru sintetic — injectat de o regulă în interiorul paginii; nu a trecut niciodată prin rețea',
  'panel.inspector.messages.emptyNoDebug':
    'Cadrele WebSocket sunt vizibile doar cu modul Depanare activat pentru această filă.',
  'panel.inspector.messages.emptySynthetic':
    'Niciun cadru nu a trecut prin rețea — aici s-a declanșat o regulă de injectare, iar cadrele injectate sunt livrate sintetic în interiorul paginii, invizibile pentru captura de rețea.',
  'panel.inspector.messages.emptyNone': 'Niciun cadru WebSocket schimbat încă.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} cadru mai vechi eliminat.',
      few: '{count} cadre mai vechi eliminate.',
      other: '{count} de cadre mai vechi eliminate.',
    });
    return `Se afișează ultimele ${String(shown)} cadre — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Filtrare evenimente',
  'panel.inspector.sse.listAria': 'Evenimente Server-Sent Events',
  'panel.inspector.sse.overrideEvent': 'Suprascriere eveniment',
  'panel.inspector.sse.overrideEventTitle': 'Creați o regulă de mesaje pentru acest flux',
  'panel.inspector.sse.editRuleTitle': 'Editați regula de mesaje care a acționat asupra acestui eveniment',
  'panel.inspector.sse.createRuleTitle': 'Creați o regulă de mesaje inițializată din acest eveniment',
  'panel.inspector.sse.syntheticTitle':
    'Eveniment sintetic — injectat de o regulă în interiorul paginii; nu a trecut niciodată prin rețea',
  'panel.inspector.sse.emptySynthetic':
    'Niciun eveniment nu a trecut prin rețea — aici s-a declanșat o regulă de injectare, iar evenimentele injectate sunt livrate sintetic în interiorul paginii, invizibile pentru captura de rețea.',
  'panel.inspector.sse.emptyUnparseable': 'Niciun eveniment SSE analizabil în corpul răspunsului.',
  'panel.inspector.sse.emptyNoDebug':
    'Niciun eveniment capturat. Fără modul Depanare, fluxurile Server-Sent Events se materializează doar după încheierea cererii; fluxurile de lungă durată pot să nu apară aici până la închiderea conexiunii.',
  'panel.inspector.sse.emptyNone': 'Niciun eveniment primit încă.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} eveniment mai vechi eliminat.',
      few: '{count} evenimente mai vechi eliminate.',
      other: '{count} de evenimente mai vechi eliminate.',
    });
    return `Se afișează ultimele ${String(shown)} evenimente — ${dropped}`;
  },

  // Preview panes.
  'panel.inspector.streams.preview.noMessageTitle': 'Niciun mesaj selectat',
  'panel.inspector.streams.preview.noMessageHint': 'Selectați un mesaj pentru a-i răsfoi conținutul.',
  'panel.inspector.streams.preview.noEventTitle': 'Niciun eveniment selectat',
  'panel.inspector.streams.preview.noEventHint': 'Selectați un eveniment pentru a-i răsfoi conținutul.',
  'panel.inspector.streams.preview.raw': 'Brut',
  'panel.inspector.streams.preview.copy': 'Copiere',
  'panel.inspector.streams.preview.copied': 'Copiat',
  'panel.inspector.streams.preview.copyTitle': 'Copiere în clipboard',
  'panel.inspector.streams.preview.decodeFailed': 'Conținutul util binar nu a putut fi decodificat.',
  'panel.inspector.messages.preview.droppedSendPane':
    'Regula a eliminat acest cadru — pagina l-a produs, dar nu a fost trimis niciodată la server.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'Regula a eliminat acest cadru — a ajuns la browser, dar nu a fost livrat niciodată paginii.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'Cadrul produs de pagină nu a fost capturat — doar cadrul modificat a trecut prin rețea.',
  'panel.inspector.messages.preview.syntheticNote':
    'Cadru sintetic — injectat de o regulă în interiorul paginii; nu a trecut niciodată prin rețea.',
  'panel.inspector.sse.preview.droppedPane':
    'Regula a eliminat acest eveniment — a ajuns la browser, dar nu a fost livrat niciodată paginii.',
  'panel.inspector.sse.preview.syntheticNote':
    'Eveniment sintetic — injectat de o regulă în interiorul paginii; nu a trecut niciodată prin rețea.',

  // Inferred-tier (i) corpora on the split captions.
  'panel.inspector.messages.inferredModified.title': 'Derivat, necapturat',
  'panel.inspector.messages.inferredModified.summary':
    'Această parte afișează conținutul util de înlocuire al regulii — planul de captură a văzut doar cadrul din rețea.',
  'panel.inspector.messages.inferredModified.description':
    'Rețeaua a înregistrat cadrul original; modificarea s-a produs în interiorul paginii, după captură. Faptul că exact acest cadru a primit înlocuirea este dedus din selectorul de cadre al regulii, în acord cu punctul de declanșare chihlimbariu.',
  'panel.inspector.messages.inferredDropped.title': 'Eliminat, dedus',
  'panel.inspector.messages.inferredDropped.summary':
    'Rețeaua a înregistrat acest cadru, dar regula i-a oprit livrarea în interiorul paginii.',
  'panel.inspector.messages.inferredDropped.description':
    'Eliminarea are loc după captură, așa că nimic nu poate înregistra nelivrarea în sine. Faptul că exact acest cadru a fost eliminat este dedus din selectorul de cadre al regulii, în acord cu punctul de declanșare chihlimbariu.',
  'panel.inspector.sse.inferredModified.title': 'Derivat, necapturat',
  'panel.inspector.sse.inferredModified.summary':
    'Această parte afișează conținutul util de înlocuire al regulii — planul de captură a văzut doar evenimentul din rețea.',
  'panel.inspector.sse.inferredModified.description':
    'Rețeaua a înregistrat evenimentul original; modificarea s-a produs în interiorul paginii, după captură. Faptul că exact acest eveniment a primit înlocuirea este dedus din selectorul de evenimente al regulii, în acord cu punctul de declanșare chihlimbariu.',
  'panel.inspector.sse.inferredDropped.title': 'Eliminat, dedus',
  'panel.inspector.sse.inferredDropped.summary':
    'Rețeaua a înregistrat acest eveniment, dar regula i-a oprit livrarea în interiorul paginii.',
  'panel.inspector.sse.inferredDropped.description':
    'Eliminarea are loc după captură, așa că nimic nu poate înregistra nelivrarea în sine. Faptul că exact acest eveniment a fost eliminat este dedus din selectorul de evenimente al regulii, în acord cu punctul de declanșare chihlimbariu.',

  // Column / rail (i) corpora.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Exemplu de cadru',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'caractere ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'Conținutul util al cadrului — cadrele text își afișează conținutul ca atare.',
  'panel.inspector.messages.columnInfo.data.description':
    'Selectați un rând pentru a deschide vizualizatorul de conținut util: un arbore JSON când textul se analizează, un vizualizator Base64 / Hex / UTF-8 pentru cadrele binare.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'În locul conținutului util',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'Un cadru binar — octeții stau în vizualizatorul de conținut util, nu în celulă.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': 'Cadre de control keepalive schimbate de punctele finale.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'Handshake-ul de închidere care încheie socketul.',
  'panel.inspector.messages.columnInfo.length.summary':
    'Dimensiunea conținutului util — un simplu număr de caractere pentru cadrele text, octeți formatați (de ex. `4 B`) pentru cadrele binare.',
  'panel.inspector.messages.columnInfo.time.summary': 'Momentul de ceas la care cadrul a trecut prin rețea.',
  'panel.inspector.messages.columnInfo.time.description':
    'Singura coloană sortabilă. Crescător este ordinea din rețea; cadrele din aceeași milisecundă își păstrează oricum ordinea sosirii.',
  'panel.inspector.messages.directionInfo.title': 'Direcție',
  'panel.inspector.messages.directionInfo.summary': 'În ce sens a circulat cadrul.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Săgeți',
  'panel.inspector.messages.directionInfo.sentDesc': 'Trimis — pagina a împins acest cadru către server.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Primit — serverul a împins acest cadru către pagină.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Eroare — o defecțiune de transport a încheiat fluxul; rândul se citește roșu.',
  'panel.inspector.streams.fireRail.title': 'Declanșări de reguli',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Culorile punctelor',
  'panel.inspector.messages.fireRail.summary':
    'Un punct marchează fiecare cadru asupra căruia a acționat o regulă de mesaje WebSocket. Cadrele nu poartă atribuire de reguli, așa că punctul este derivat: regulile de mesaje declanșate ale acestei cereri, selectorul de cadre al fiecărei reguli rulat din nou pe cadru.',
  'panel.inspector.messages.fireRail.appliedDesc':
    'Aplicată — conținutul util al cadrului este egal cu conținutul util de înlocuire sau injectat al regulii.',
  'panel.inspector.messages.fireRail.inferredDesc':
    'Dedusă — direcția și filtrul de mesaje ale regulii selectează acest cadru, dar aplicarea nu este verificabilă (un cadru modificat nu mai conține conținutul util cu care s-a potrivit filtrul).',
  'panel.inspector.messages.fireRail.description':
    'Un cadru de ieșire eliminat nu trece niciodată prin rețea, așa că nu are niciun rând. Un cadru de intrare eliminat a fost capturat mai întâi în rețea — rândul său rămâne, marcat „Eliminat — nelivrat niciodată paginii”.',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Exemplu de eveniment',
  'panel.inspector.sse.columnInfo.id.summary':
    'Câmpul `id:` al evenimentului — cursorul de reconectare distribuit de server.',
  'panel.inspector.sse.columnInfo.id.description':
    'Gol când serverul nu trimite niciun id. La reconectare browserul returnează ultimul id ca `Last-Event-ID`, astfel încât serverul să poată relua fluxul de unde a rămas.',
  'panel.inspector.sse.columnInfo.type.summary':
    'Câmpul `event:` al evenimentului — `message` pentru evenimentele implicite.',
  'panel.inspector.sse.columnInfo.type.description':
    'Codul paginii se abonează per tip: `onmessage` vede doar evenimentele implicite; evenimentele denumite au nevoie de un `addEventListener` pentru exact acel tip.',
  'panel.inspector.sse.columnInfo.data.summary':
    'Conținutul util al evenimentului — întotdeauna text; câmpurile `data:` pe mai multe linii sosesc unite.',
  'panel.inspector.sse.columnInfo.data.description':
    'Selectați un rând pentru a deschide vizualizatorul de conținut util: un arbore JSON când textul se analizează, altfel ca atare.',
  'panel.inspector.sse.columnInfo.time.summary': 'Momentul de ceas la care a sosit evenimentul.',
  'panel.inspector.sse.columnInfo.time.description':
    'Sortabil, implicit crescător. Evenimentele analizate dintr-un corp de răspuns încheiat nu poartă timp — formatul SSE din rețea nu are așa ceva —, așa că celulele lor rămân goale.',
  'panel.inspector.sse.fireRail.summary':
    'Un punct marchează fiecare eveniment asupra căruia a acționat o regulă de mesaje SSE. O captură înregistrată de wrapper este o dovadă; fără una, punctul este derivat: regulile SSE declanșate ale acestei cereri, selectorul de evenimente al fiecărei reguli rulat din nou pe eveniment.',
  'panel.inspector.sse.fireRail.appliedDesc':
    'Aplicată — wrapper-ul a înregistrat că a acționat exact asupra acestui eveniment sau un conținut util injectat corespunde.',
  'panel.inspector.sse.fireRail.inferredDesc':
    'Dedusă — numele evenimentului și filtrul de date ale regulii selectează acest eveniment, dar aplicarea nu este verificabilă doar din rețea.',
  'panel.inspector.sse.fireRail.description':
    'Evenimentele Server-Sent Events circulă doar server → pagină, iar rețeaua le înregistrează înainte ca regula să acționeze: un eveniment eliminat își păstrează rândul, marcat „Eliminat — nelivrat niciodată paginii”; un eveniment injectat nu trece niciodată prin rețea și apare ca rând sintetic.',
} as const satisfies Catalog;
