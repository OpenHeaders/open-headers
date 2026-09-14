/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Romanian. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw inside
 * keyed captions; `token` (the filter-grammar noun) stays token /
 * tokenuri per the shared ledger. Sandwich fragments keep the en order
 * (the chips read as appositions: tokenul [domain:], filtrele
 * [method:post] și [method:POST]); a whole-raw prefix (`A`) copies
 * verbatim and the suffix restructures (`— un astfel de token …`).
 * Mints: termen = filter term; comutator de potrivire = match toggle;
 * filtru de proprietate = property filter; negare = negation;
 * captură-exemplu = example capture; cuvânt întreg = whole word;
 * potrivire majuscule/minuscule = match case; frază exactă = exact
 * phrase; cip = chip (the search source chips); șină = rail (carried).
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panou',
  'panel.docs.nav.filterSyntax.title': 'Sintaxa filtrului',
  'panel.docs.nav.filterSyntax.summary':
    'Tokenuri de text, filtre de proprietate și comutatoarele de potrivire — fiecare card filtrează aceeași captură-exemplu partajată.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': 'Filtrul de trafic combină text liber,',
  'panel.docs.filterSyntax.intro1Suffix':
    'filtre de proprietate și trei comutatoare de potrivire. Termenii separați prin spații trebuie să se potrivească ' +
    'TOȚI (AND), iar fiecare card de mai jos își rulează filtrul pe aceeași captură-exemplu de cinci cereri — ' +
    'fiecare diagramă este o felie a acelei imagini.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Fiecare câmp de filtru din panou — Network, Console, Storage, Headers, Cookies, Initiator, Messages — poartă ' +
    'aceleași trei comutatoare',
  'panel.docs.filterSyntax.intro2MatchCase': 'potrivire majuscule/minuscule',
  'panel.docs.filterSyntax.intro2WholeWord': 'cuvânt întreg',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'și un buton',
  'panel.docs.filterSyntax.intro2Suffix': 'care golește textul.',
  'panel.docs.filterSyntax.intro2Kbd': 'Tastatură:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'comută opțiunile cât timp câmpul are focalizarea.',

  'panel.docs.filterSyntax.headingText': 'Filtre de text',
  'panel.docs.filterExample.captureHeading': 'Captura-exemplu',
  'panel.docs.filterSyntax.headingProperty': 'Filtre de proprietate',
  'panel.docs.filterSyntax.headingToggles': 'Comutatoare de potrivire',
  'panel.docs.filterSyntax.headingElsewhere': 'Peste tot în altă parte',

  'panel.docs.filterSyntax.textTitle': 'Text',
  'panel.docs.filterSyntax.text1':
    'Un termen simplu păstrează fiecare cerere a cărei adresă URL îl conține. Mai mulți termeni se combină prin AND — ' +
    'o cerere trebuie să îi conțină pe toți, în orice poziție.',
  'panel.docs.filterSyntax.textCaption':
    'Doi termeni — supraviețuiește doar cererea a cărei adresă URL conține atât „api”, cât și „users”.',

  'panel.docs.filterSyntax.negationTitle': 'Negare',
  'panel.docs.filterSyntax.negation1Prefix': 'Un',
  'panel.docs.filterSyntax.negation1Middle': 'inițial inversează orice token:',
  'panel.docs.filterSyntax.negation1Middle2':
    'ascunde cererile potrivite în loc să le păstreze. Funcționează și cu filtrele de proprietate —',
  'panel.docs.filterSyntax.negationCaption': 'Rămâne totul, CU EXCEPȚIA cererilor care se potrivesc cu termenul negat.',

  'panel.docs.filterSyntax.phraseTitle': 'Frază exactă',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Ghilimelele fac un singur token din text care conține spații și păstrează caractere precum',
  'panel.docs.filterSyntax.phrase1Or': 'sau',
  'panel.docs.filterSyntax.phrase1Suffix': 'ca atare — util pentru șirurile de interogare.',
  'panel.docs.filterSyntax.phraseCaption':
    'Fraza între ghilimele se potrivește ca o singură bucată contiguă a adresei URL.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '— un astfel de token verifică un singur atribut al cererii în loc de întreaga adresă URL. Filtrele de ' +
    'proprietate se combină cu tokenurile de text și între ele — toate trebuie să se potrivească.',

  'panel.docs.filterSyntax.domainTitle': 'Domeniu',
  'panel.docs.filterSyntax.domain1Prefix':
    'Potrivește numele de gazdă prin subșir, așa că un domeniu apex prinde fiecare subdomeniu —',
  'panel.docs.filterSyntax.domain1Suffix': '— fără metacaractere.',
  'panel.docs.filterSyntax.domainCaption':
    'O singură valoare acoperă fiecare subdomeniu openheaders.com; gazda terță nu se potrivește.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Cod de stare',
  'panel.docs.filterSyntax.statusCode1':
    'Păstrează cererile al căror răspuns a purtat exact acest cod. Cererile în așteptare și cele eșuate nu au cod, ' +
    'deci nu se potrivesc niciodată.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Supraviețuiește doar 404 — codul exact, nu un interval.',

  'panel.docs.filterSyntax.methodTitle': 'Metodă',
  'panel.docs.filterSyntax.method1Prefix':
    'Păstrează cererile care folosesc acest verb HTTP, comparat fără a ține cont de majuscule —',
  'panel.docs.filterSyntax.method1And': 'și',
  'panel.docs.filterSyntax.method1Suffix': 'sunt același filtru.',
  'panel.docs.filterSyntax.methodCaption': 'Supraviețuiește doar POST.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'Tip MIME',
  'panel.docs.filterSyntax.mime1Prefix': 'Potrivește tipul de conținut al răspunsului prin subșir —',
  'panel.docs.filterSyntax.mime1Catches': 'prinde',
  'panel.docs.filterSyntax.mime1Suffix': 'prinde fiecare format de imagine.',
  'panel.docs.filterSyntax.mimeCaption':
    'Supraviețuiesc ambele răspunsuri JSON; scripturile, fonturile și imaginile nu.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Antet de răspuns',
  'panel.docs.filterSyntax.respHeader1Prefix':
    'Păstrează cererile al căror răspuns poartă un antet cu exact acest nume — valoarea nu contează. Util pentru ' +
    'a observa comportamentul cache-ului CDN',
  'panel.docs.filterSyntax.respHeader1Suffix': 'sau antetele de securitate lipsă (negați-l).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Doar răspunsul CDN poartă un antet x-cache.',

  'panel.docs.filterSyntax.largerThanTitle': 'Mai mare decât',
  'panel.docs.filterSyntax.largerThan1':
    'Păstrează cererile care au transferat mai mult de N octeți. Sufixele scalează numărul:',
  'panel.docs.filterSyntax.largerThanCaption': 'Doar pachetul de 128 kB trece pragul de 100k.',

  'panel.docs.filterSyntax.fromCacheTitle': 'Din cache',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Păstrează răspunsurile pe care browserul le-a servit din cache — un',
  'panel.docs.filterSyntax.fromCache1Middle':
    'sau o potrivire în cache-ul de pe disc/din memorie care nu a atins niciodată rețeaua. Negați-l',
  'panel.docs.filterSyntax.fromCache1Suffix': 'pentru a vedea doar ce a trecut efectiv prin rețea.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Supraviețuiește doar pixelul de urmărire din cache.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'Cele trei butoane din interiorul câmpului schimbă modul în care se compară tokenurile de text. Se aplică ' +
    'textului liber (și tokenurilor de tip',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'de pe filele de detalii);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'și celelalte filtre de proprietate își păstrează propria semantică.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Potrivire majuscule/minuscule',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Dezactivat (implicit),',
  'panel.docs.filterSyntax.matchCase1And': 'și',
  'panel.docs.filterSyntax.matchCase1Suffix':
    'sunt același filtru. Activat, termenul trebuie să se potrivească exact cu majusculele/minusculele din adresa URL.',
  'panel.docs.filterSyntax.matchCaseCaption':
    'Cu Aa activat, „Users” nu se potrivește cu nimic — fiecare adresă URL din captură este cu minuscule.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Cuvânt întreg',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'Termenul se potrivește doar la limitele cuvintelor —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'și celelalte asemenea contează ca limite. Folosiți-l când un termen scurt este îngropat în cuvinte mai lungi.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '„user” nu se mai potrivește în interiorul lui „users” — cu ab dezactivat, cererea #7 s-ar potrivi.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    'Întregul text introdus devine o singură expresie regulată testată pe adresa URL — tokenurile de proprietate ' +
    'nu sunt analizate în acest mod. Un model care nu se compilează colorează câmpul în roșu și nu ascunde nimic.',
  'panel.docs.filterSyntax.regexCaption':
    'Un model, două tipuri de fișiere: adrese URL care se termină în .js sau .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Alte câmpuri de filtru',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'Filele de detalii poartă același câmp cu propriile chei de proprietate; comutatoarele și negarea cu',
  'panel.docs.filterSyntax.otherIntroSuffix': 'funcționează identic în fiecare:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'text simplu cu cele trei comutatoare; Storage numără și potrivirile pe secțiune pe șina sa de navigare în timp ' +
    'ce tastați.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'text simplu (sau un regex sub',
  'panel.docs.filterSyntax.otherSearchMiddle': ') cu cele trei comutatoare, trimis cu Enter. Cipurile',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'aleg ce date scanează — cel puțin unul rămâne selectat — și fiecare rezultat își deschide sursa: fila cererii, ' +
    'secțiunea de stocare sau Console.',
} as const satisfies Catalog;
