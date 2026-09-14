/**
 * Workbench Docs panel — anchor registry bodies — Romanian. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr/es S59 raw/keyed
 * split is followed exactly. Raw by design inside keyed prose:
 * wire/API tokens (declarativeNetRequest, webRequest, ResourceType,
 * queryTransform, block, main_frame, firstParty / thirdParty,
 * operationName / query / key / value, chrome.storage(.local),
 * fetch() / XMLHttpRequest, @font-face, Set-Cookie, Accept,
 * User-Agent, Content-Type, CORS, ERR_BLOCKED_BY_CLIENT, RE2, stdio,
 * HTTP/SSE, git log / git blame), ResourceType enum labels (Page,
 * Frame, Fetch/XHR, Script, …), the prose figures 30.000 ms / 5.000 ms
 * (the S115 / S117 ro thousands law — `ms` is a glossary unit and
 * keeps en's spacing), DNR / AND / DOM / CA / PII / YAML / CDN / MCP
 * tokens with head nouns (acțiune DNR, regulă DNR, motorul DNR,
 * condiții prin AND, certificat CA, date PII). Quoted UI labels copy
 * their shipped ro mints: the header / query-param ops (Adăugare /
 * Înlocuire, Adăugare la sfârșit, Eliminare, Îmbinare, Doar înlocuire,
 * Eliminare toate — editors-rule; Suprascriere = Override where en
 * says Override), the condition names and their Excl. variants, the
 * inject timing labels (Cât mai curând posibil / După încărcarea
 * paginii), the popup tab „Această pagină”, the docs nav titles
 * (workbench-chrome: Cum se execută regulile, Tipuri de resurse, Cum
 * ne comparăm, Fiecare suprafață, livrată, Acțiuni pe antete, Blocare,
 * Redirecționare, Parametri de interogare, Injectare JS / CSS,
 * Întârziere, Corpul cererii, Modificarea răspunsului), Date statice /
 * Dinamic (JavaScript) mode labels, Este egal cu / Conține = Equals /
 * Contains, Primar / Terț, Tip de domeniu, inițiator, navigare,
 * Simulare = Mock (the Static response = the mock), insignă = badge,
 * fereastră de instrumente, separator, Suprascriere = Override,
 * Îmbinare = Merge, loc / nivel carried, lowercase `vault` per-case
 * law. MINTS: rază de acțiune = reach carried (the debug-reach noun
 * serves the engine-reach sense too); Static = Static (the redirect /
 * body / response mode — fixare stays pin); compromis = trade-off;
 * fixtură = fixture; pagină locală de așteptare = the waiting page;
 * bandă = delay lane; transformare = transform; anonimizare; plafon
 * carried; local-first raw (a gloss in prose); se rehidratează =
 * re-hydrates; monkey-patch raw (monkey-patch-uri); service worker
 * raw. THE S75 SAME-FRAGMENT LAW: `Chrome` / `API` / every glossary
 * token stays in the en fragment it sits in (browserul Chrome /
 * interfața oferită de browserul Chrome + [chip] + API …). Whole-raw
 * `.` / `).` / `A` / `An` sentence tails copy verbatim and the
 * Romanian tail moves into the preceding fragment; the `A` / `An`
 * article pair keeps the raw terms with the Romanian gloss in
 * parentheses (`A direct (directă) potrivire …`); a fragment joined to
 * a preceding code chip with no space opens with `.` / `,` per en.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'Regulile se execută printr-unul din două motoare, în funcție de ce fac. Știind pe ce cale merge o regulă, înțelegeți unde se aplică — și unde nu poate.',
  'workbench.docs.body.execution.stackCaption':
    'Cererile inițiate din JS trec prin Script, apoi prin DNR. Traficul static și navigările ocolesc complet Script.',
  'workbench.docs.body.execution.dnrHeading': 'Nativ, rapid, rază de acțiune largă',
  'workbench.docs.body.execution.dnr1Prefix':
    'Regulile de antete Suprascriere / Adăugare la sfârșit / Eliminare, Blocare, Redirecționare și Parametri de interogare se compilează în intrări',
  'workbench.docs.body.execution.dnr1Suffix':
    '. Browserul Chrome le aplică la nivelul rețelei, înainte ca vreo cerere să părăsească browserul.',
  'workbench.docs.body.execution.dnr2':
    'Raza de acțiune este largă: pagini, subcadre, scripturi, imagini, fonturi, fetch, XHR — fiecare cerere pe care o face browserul în numele paginii.',
  'workbench.docs.body.execution.dnrCaption':
    'O singură listă încadrată — raza de acțiune a DNR este practic universală.',
  'workbench.docs.body.execution.scriptHeading': 'Context JS, rază de acțiune îngustă',
  'workbench.docs.body.execution.script1Prefix':
    'Regulile Injectare, Întârziere, Corp cerere, Răspuns API și Îmbinare antete funcționează prin monkey-patch pe',
  'workbench.docs.body.execution.script1And': 'și',
  'workbench.docs.body.execution.script1Suffix':
    'din interiorul paginii. Pot transforma traficul inițiat din JavaScript în moduri pe care DNR nu le poate exprima — inclusiv citirea și rescrierea corpurilor de răspuns, la care DNR nu are acces.',
  'workbench.docs.body.execution.scriptCaption':
    'Două coloane — ce interceptează efectiv motorul de scripturi și ce trece neschimbat.',
  'workbench.docs.body.execution.limitPrefix': 'Resursele statice (',
  'workbench.docs.body.execution.limitSuffix':
    '), navigările de pagină și cererile interne ale browserului ocolesc complet acest motor. Folosiți o regulă bazată pe DNR pentru acestea.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Referință rapidă pentru comportamentele care surprind. Fiecare element este semnalat și inline în secțiunea pe care o afectează.',
  'workbench.docs.body.limitations.overviewCaption':
    'Patru capcane frecvente dintr-o privire — fiecare notă de mai jos are detaliile.',
  'workbench.docs.body.limitations.devtoolsTitle': 'Antetele modificate nu apar în fereastra DevTools',
  'workbench.docs.body.limitations.devtoolsBody':
    'Acțiunile pe antete se aplică corect, dar fila Network din browserul Chrome afișează în continuare antetele originale ale serverului.',
  'workbench.docs.body.limitations.scriptTitle': 'Regulile bazate pe script — rază de acțiune îngustă',
  'workbench.docs.body.limitations.scriptPrefix':
    'Injectare, Întârziere, Corp, Simulare și Îmbinare antete interceptează doar',
  'workbench.docs.body.limitations.scriptAnd': 'și',
  'workbench.docs.body.limitations.scriptMiddle': '. Resursele statice și navigările de pagină le ocolesc. Vedeți',
  'workbench.docs.body.limitations.executionRef': 'Cum se execută regulile',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'Îmbinarea nu poate citi antetele implicite ale browserului',
  'workbench.docs.body.limitations.mergeBody':
    'Operația Îmbinare vede doar antetele setate explicit de codul paginii — Accept, User-Agent și celelalte antete implicite ale browserului îi sunt invizibile.',
  'workbench.docs.body.limitations.chromeTitle': 'Potrivirea pe antete necesită Chrome 128+',
  'workbench.docs.body.limitations.chromeBody':
    'Condițiile care se potrivesc pe valorile antetelor de cerere / răspuns necesită Chrome 128 sau mai nou. Browserele mai vechi ignoră condiția în tăcere.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    'Mai multe file de spațiu de lucru deschise deodată sunt o stare de primă clasă. Datele persistate se sincronizează prin',
  'workbench.docs.body.multiTab.intro1Suffix':
    ', starea aspectului rămâne per filă, iar intențiile de navigare refolosesc filele existente din aceeași fereastră înainte de a deschide altele noi.',
  'workbench.docs.body.multiTab.syncCaption':
    'Fila A salvează, service worker-ul difuzează, fila B se rehidratează. Starea aspectului rămâne în fiecare filă.',
  'workbench.docs.body.multiTab.navHeading': 'Navigarea refolosește filele existente',
  'workbench.docs.body.multiTab.nav1':
    'Mai întâi aceeași fereastră: dacă o filă de spațiu de lucru este deja deschisă în fereastra din care apăsați, se activează și primește intenția (secțiunea de documentație la care să deruleze, regula de editat). Altă fereastră: o filă nouă se deschide în fereastra dvs. curentă, în loc să tragă focalizarea între ferestrele Chrome — la fel cum funcționează fereastra DevTools proprie a browserului Chrome, cu un panou per fereastră.',
  'workbench.docs.body.multiTab.navCaption':
    'Calea caldă activează fila din aceeași fereastră; calea rece deschide o filă nouă în fereastra apelantului.',
  'workbench.docs.body.multiTab.numberingHeading': 'Numerotarea filelor',
  'workbench.docs.body.multiTab.numbering1Prefix':
    'Cu două sau mai multe file de spațiu de lucru, titlul fiecărei file primește prefixul ordinalului ei —',
  'workbench.docs.body.multiTab.numbering1Suffix':
    '. Când numărul scade înapoi la una, supraviețuitoarea își pierde prefixul.',
  'workbench.docs.body.multiTab.numbering2Prefix': 'Ordinalele sunt stabile pe durata de viață a unei file: închiderea',
  'workbench.docs.body.multiTab.numbering2While': 'în timp ce',
  'workbench.docs.body.multiTab.numbering2And': 'și',
  'workbench.docs.body.multiTab.numbering2Middle':
    'rămân nu renumerotează supraviețuitoarele. Următoarea filă deschisă primește',
  'workbench.docs.body.multiTab.numbering2Middle2': '; numerotarea se resetează la',
  'workbench.docs.body.multiTab.numbering2Suffix': 'doar după ce fiecare filă de spațiu de lucru s-a închis.',
  'workbench.docs.body.multiTab.numberingCaption':
    'Supraviețuitoarele își păstrează numerele la închideri; următoarea filă este întotdeauna max + 1.',
  'workbench.docs.body.multiTab.syncsHeading': 'Ce se sincronizează și ce nu',
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Fiecare entitate persistată — reguli, colecții, foldere, medii, variabile de spațiu de lucru, vault, cereri, șabloane — trăiește în',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'ca unică sursă de adevăr. Salvările din fila A se difuzează prin fundal, iar fila B se rehidratează. Comutările de spațiu de lucru și de mediu se propagă la fel.',
  'workbench.docs.body.multiTab.syncedCaption':
    'Un singur chrome.storage partajat; ambele file citesc și scriu aceleași date persistate.',
  'workbench.docs.body.multiTab.localCaption':
    'Tragerile de aspect și tastarea nesalvată trăiesc în fiecare filă — cealaltă filă nu le vede niciodată.',
  'workbench.docs.body.multiTab.layoutTitle': 'Aspectul nu se sincronizează live',
  'workbench.docs.body.multiTab.layout1Prefix':
    'Proporțiile panourilor și starea de andocare a ferestrelor de instrumente sunt per spațiu de lucru, dar modificările nu se propagă la filele deja deschise. Tragerea unui separator în fila A lasă fila B neatinsă până la reîncărcare — sincronizarea live a aspectului ar fi deranjantă în timpul tastării. O filă deschisă',
  'workbench.docs.body.multiTab.layoutAfter': 'după',
  'workbench.docs.body.multiTab.layout1Suffix': 'tragere moștenește noul aspect.',
  'workbench.docs.body.multiTab.draftsTitle': 'Ciornele nesalvate sunt locale filei',
  'workbench.docs.body.multiTab.drafts1':
    'Ciornele de editor trăiesc în memoria propriei file. Dacă fila A salvează aceeași regulă pe care o editează fila B, fila A câștigă scrierea în stocare — nu există astăzi o solicitare între file de tipul „modificat, reîncărcați?”. Contează doar când două file editează simultan aceeași entitate.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'Fila',
  'workbench.docs.body.requestTracking.thisPage': 'Această pagină',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'din fereastra popup afișează ce reguli sunt active pentru pagina curentă și cu ce cereri s-au potrivit. Urmărirea acoperă ambele faze — cerere și răspuns — ale fiecărei conexiuni pe care o face pagina.',
  'workbench.docs.body.requestTracking.phasesCaption':
    'O singură conexiune are două faze — ambele contribuie la numărul din insignă.',
  'workbench.docs.body.requestTracking.howHeading': 'Cum funcționează',
  'workbench.docs.body.requestTracking.how1Prefix': 'Extensia observă cererile HTTP prin interfața',
  'workbench.docs.body.requestTracking.how1Middle':
    'API. Când adresa URL a unei cereri se potrivește cu condițiile unei reguli (domenii, model URL sau regex URL), este înregistrată împreună cu tipul resursei. Înregistrarea are loc live în service worker; fereastra popup doar citește acea înregistrare când deschideți fila',
  'workbench.docs.body.requestTracking.how1Suffix': '.',
  'workbench.docs.body.requestTracking.howCaption':
    'Browserul emite evenimente webRequest; extensia potrivește și înregistrează; fereastra popup citește mai târziu.',
  'workbench.docs.body.requestTracking.badge1':
    'Fiecare regulă potrivită afișează o insignă numerotată egală cu numărul cererilor cu care s-a potrivit. Apăsați insigna pentru a extinde o listă cu marcaje de timp, adrese URL, tipuri de resurse și modelul care s-a potrivit.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'Insigna restrânge numărul; clicul pe ea dezvăluie lista completă a potrivirilor.',
  'workbench.docs.body.requestTracking.directHeading': 'Potriviri directe și indirecte',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    '(directă) potrivire înseamnă că adresa URL a paginii în sine s-a potrivit. An',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    '(indirectă) potrivire înseamnă că doar o subresursă — script, foaie de stil, XHR, imagine, font — s-a potrivit, în timp ce adresa URL a paginii nu. Aceeași regulă poate produce oricare dintre ele, în funcție de pagina pe care sunteți.',
  'workbench.docs.body.requestTracking.directCaption':
    'O regulă, două contexte de pagină. Verde = potrivit. Punctat = exclus.',
  'workbench.docs.body.requestTracking.typesHeading': 'Tipuri de resurse',
  'workbench.docs.body.requestTracking.types1Prefix': 'Fiecare cerere potrivită poartă tipul său din browserul Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping sau Other. Vedeți pagina de referință',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Tipuri de resurse',
  'workbench.docs.body.requestTracking.types1Suffix': 'pentru maparea completă, cu exemple.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'Referință pentru valorile din browserul Chrome',
  'workbench.docs.body.resourceTypes.introSuffix':
    'afișate de urmărirea cererilor și de condiția Tipuri de resurse. Fiecare etichetă corespunde unui singur tip de bază — nu există suprapuneri între rânduri.',
  'workbench.docs.body.resourceTypes.anatomyCaption': 'Ce fel de cerere ajunge în ce ResourceType — dintr-o privire.',
  'workbench.docs.body.resourceTypes.descPage':
    'Navigarea documentului de nivel superior — adresa URL afișată în bara de adrese.',
  'workbench.docs.body.resourceTypes.descFrame': 'Un iframe sau un cadru imbricat încorporat în pagină.',
  'workbench.docs.body.resourceTypes.descXhr':
    'Apeluri API prin fetch() sau XMLHttpRequest. Browserul Chrome le raportează pe ambele ca același tip — nu există nicio modalitate de a le deosebi.',
  'workbench.docs.body.resourceTypes.descScript': 'Fișiere JavaScript încărcate de pagină.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Foi de stil încărcate de pagină.',
  'workbench.docs.body.resourceTypes.descImage': 'Imagini încărcate de pagină sau de stilurile ei.',
  'workbench.docs.body.resourceTypes.descFont': 'Fonturi web încărcate prin reguli @font-face.',
  'workbench.docs.body.resourceTypes.descMedia': 'Resurse audio sau video.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'Handshake WebSocket — cererea inițială de upgrade HTTP. Se urmărește doar handshake-ul, nu mesajele individuale.',
  'workbench.docs.body.resourceTypes.descPing': 'Cereri beacon și ping folosite de obicei pentru analiză/urmărire.',
  'workbench.docs.body.resourceTypes.descOther': 'Orice nu se încadrează în categoriile de mai sus.',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'O acțiune este partea „',
  'workbench.docs.body.actions.introDo': 'de făcut',
  'workbench.docs.body.actions.intro1Middle': '” a unei reguli. Acolo unde o',
  'workbench.docs.body.actions.conditionLink': 'condiție',
  'workbench.docs.body.actions.intro1Middle2': 'decide',
  'workbench.docs.body.actions.introWhether': 'dacă',
  'workbench.docs.body.actions.intro1Middle3': 'regula se declanșează, acțiunea decide',
  'workbench.docs.body.actions.introWhatChanges': 'ce se schimbă',
  'workbench.docs.body.actions.intro1Suffix':
    '. Fiecare regulă asociază o stivă de condiții potrivite prin AND cu exact o acțiune.',
  'workbench.docs.body.actions.categories1':
    'Acțiunile se împart în trei categorii — modifică cererea de ieșire, modifică răspunsul primit sau rulează cod în pagină. Fiecare acțiune este implementată de unul din două motoare:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '(din browserul Chrome —',
  'workbench.docs.body.actions.categoriesDnrSuffix': ', rapid și nativ) sau',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '(motorul din pagină al Open Headers, pentru lucrurile pe care DNR nu le poate exprima). Vedeți',
  'workbench.docs.body.actions.executionLink': 'Cum se execută regulile',
  'workbench.docs.body.actions.categories1Suffix': 'pentru compromisuri.',
  'workbench.docs.body.actions.ruleAnatomyCaption':
    'O regulă = condiții potrivite prin AND asociate cu exact o acțiune.',
  'workbench.docs.body.actions.taxonomyCaption': 'Trei categorii, fiecare acțiune cu eticheta motorului ei.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Modificarea cererii',
  'workbench.docs.body.actions.tagRequest': 'înainte să părăsească browserul',
  'workbench.docs.body.actions.modifyRequest1':
    'Remodelați cererea de ieșire — antetele, parametrii adresei URL, corpul, destinația sau dacă pleacă deloc. Majoritatea regulilor trăiesc aici.',
  'workbench.docs.body.actions.headerActionsLink': 'Acțiuni pe antete',
  'workbench.docs.body.actions.liHeaderActionsRequest':
    '— Adăugare / Înlocuire / Adăugare la sfârșit / Eliminare / Îmbinare pe antetele cererii.',
  'workbench.docs.body.actions.blockLink': 'Blocare',
  'workbench.docs.body.actions.liBlock': '— anulează cererea la nivelul rețelei.',
  'workbench.docs.body.actions.redirectLink': 'Redirecționare',
  'workbench.docs.body.actions.liRedirect': '— trimite cererea la altă adresă URL, statică sau regex.',
  'workbench.docs.body.actions.queryParamsLink': 'Parametri de interogare',
  'workbench.docs.body.actions.liQueryParams': '— adaugă, înlocuiește sau elimină parametri ai adresei URL.',
  'workbench.docs.body.actions.requestBodyLink': 'Corpul cererii',
  'workbench.docs.body.actions.liRequestBody':
    '— rescrie corpul de ieșire fetch / XHR (static, dinamic sau filtrat GraphQL).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Modificarea răspunsului',
  'workbench.docs.body.actions.tagResponse': 'înainte ca pagina să îl vadă',
  'workbench.docs.body.actions.modifyResponse1':
    'Remodelați răspunsul pe drumul înapoi — antete, corp sau stare HTTP. Util pentru simularea punctelor finale neconstruite încă și pentru forțarea modurilor de eșec în dezvoltare.',
  'workbench.docs.body.actions.liHeaderActionsResponse': '— aceleași cinci operații se aplică antetelor de răspuns.',
  'workbench.docs.body.actions.responseLink': 'Modificarea răspunsului',
  'workbench.docs.body.actions.liResponse': '— simulează sau modifică răspunsul: corp sintetic, stare sau antete.',
  'workbench.docs.body.actions.runCodeTitle': 'Rularea codului',
  'workbench.docs.body.actions.tagRunCode': 'în pagină sau în planificatorul ei',
  'workbench.docs.body.actions.runCode1':
    'Efecte care nu se încadrează clar în „modifică o cerere sau un răspuns” — injectarea de cod și latența artificială. Ambele rulează prin motorul Script, deoarece DNR nu are echivalent.',
  'workbench.docs.body.actions.injectLink': 'Injectare JS / CSS',
  'workbench.docs.body.actions.liInject':
    '— rulează JavaScript sau CSS în contextul paginii, înaintea scripturilor paginii sau după ce DOM-ul este gata.',
  'workbench.docs.body.actions.delayLink': 'Întârziere',
  'workbench.docs.body.actions.liDelay':
    '— adaugă latență artificială navigărilor și apelurilor fetch / XHR inițiate din JS.',
  'workbench.docs.body.actions.oneActionTitle': 'O acțiune per regulă',
  'workbench.docs.body.actions.oneAction1':
    'Fiecare regulă poartă exact o acțiune. Pentru a face două lucruri deodată — de exemplu, a adăuga un antet ȘI a redirecționa — scrieți două reguli cu aceleași condiții. Ambele se declanșează pe aceeași cerere; DNR le compune într-o ordine documentată.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Patru operații pe antetele de cerere și de răspuns — trei native (Adăugare / Înlocuire, Adăugare la sfârșit, Eliminare) plus una bazată pe script (Îmbinare) pentru concatenarea valorilor, pe care DNR nu o poate exprima.',
  'workbench.docs.body.headerActions.opsCaption': 'Aceleași antete de pornire, patru rezultate diferite',
  'workbench.docs.body.headerActions.overrideTitle': 'Adăugare / Înlocuire',
  'workbench.docs.body.headerActions.override1':
    'Setează antetul la această valoare. Înlocuiește dacă există, adaugă dacă lipsește — întotdeauna un singur antet cu valoarea dvs.',
  'workbench.docs.body.headerActions.overrideCaption':
    'Aceeași regulă acoperă ambele cazuri — înlocuiește când există, adaugă când lipsește.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    'Dacă condițiile regulii nu se potrivesc cu cererea, nu se întâmplă nimic — fără eroare, fără efect.',
  'workbench.docs.body.headerActions.appendTitle': 'Adăugare la sfârșit',
  'workbench.docs.body.headerActions.append1':
    'Adaugă o intrare nouă de antet cu același nume. Originalul rămâne — rezultă antete duplicate. Folosiți pentru Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    'Antetul original rămâne; se adaugă un al doilea rând cu același nume. Ambele sunt livrate.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    'Unele antete nu pot fi duplicate — browserul le comasează. Folosiți în schimb Suprascriere sau Îmbinare.',
  'workbench.docs.body.headerActions.removeTitle': 'Eliminare',
  'workbench.docs.body.headerActions.remove1': 'Șterge toate instanțele acestui antet. Nu este nevoie de valoare.',
  'workbench.docs.body.headerActions.removeCaption': 'Rândul țintit dispare; tot restul trece neschimbat.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    'Dacă antetul nu există, nu se întâmplă nimic — fără eroare, doar fără efect.',
  'workbench.docs.body.headerActions.mergeTitle': 'Îmbinare',
  'workbench.docs.body.headerActions.merge1Prefix':
    'Citește valoarea existentă la rulare și o adaugă pe a dvs. cu un separator. Implicit',
  'workbench.docs.body.headerActions.merge1Middle': 'pentru Cookie și',
  'workbench.docs.body.headerActions.merge1Suffix':
    'pentru celelalte. Separatorul poate fi gol pentru concatenare directă.',
  'workbench.docs.body.headerActions.mergeCaption':
    'Valoarea existentă rămâne; valoarea dvs. este adăugată după separator.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Doar motorul de scripturi — navigările de pagină și resursele statice trec neatinse.',
  'workbench.docs.body.headerActions.mergeLimitation':
    'Îmbinarea este invizibilă în fereastra DevTools și nu poate citi antetele implicite ale browserului (Accept, User-Agent) — doar antetele setate explicit de codul paginii.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Anulează cererile potrivite la nivelul rețelei. Browserul primește o eroare de rețea, iar pagina vede cererea eșuând ca și cum serverul ar fi inaccesibil.',
  'workbench.docs.body.block.howTitle': 'Cum funcționează',
  'workbench.docs.body.block.how1Prefix': 'Se compilează într-o acțiune DNR',
  'workbench.docs.body.block.how1Suffix':
    'fără corp. Se aplică indiferent de tipul resursei — pagini, subcadre, scripturi, imagini, fonturi, fetch, XHR — așa că o singură regulă acoperă totul, dacă nu o restrângeți cu o condiție Tip de resursă.',
  'workbench.docs.body.block.blockCaption':
    'Cererea este oprită înainte să părăsească browserul; pagina vede o eroare de rețea.',
  'workbench.docs.body.block.wontApplyCaption':
    'Resursele deja încărcate rămân încărcate — Blocarea prinde doar cererile viitoare.',
  'workbench.docs.body.block.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.block.when1Prefix':
    'Blocarea domeniilor de reclame / analiză / urmărire, simularea căderilor pentru o singură gazdă sau refuzarea accesului la un punct final lăsând restul unei interfețe API accesibil. Pentru a bloca doar documentul unei pagini (nu subresursele ei), adăugați o condiție Tip de resursă cu valoarea',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    'Patru tipare tipice — delimitați-l pe fiecare cu Condiții (Domenii, Model URL, Tip de resursă).',
  'workbench.docs.body.block.note1Prefix': 'Blocarea unei cereri',
  'workbench.docs.body.block.note1Suffix':
    'afișează o pagină „ERR_BLOCKED_BY_CLIENT” în browserul Chrome. Blocările subresurselor au loc în tăcere — ce vede utilizatorul depinde de tratarea erorilor de către pagina însăși.',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Redirecționează cererile potrivite către altă adresă URL. Acceptă adrese URL statice și grupuri de captură regex.',
  'workbench.docs.body.redirect.staticTitle': 'Redirecționare statică',
  'workbench.docs.body.redirect.static1':
    'Introduceți o adresă URL completă pentru a redirecționa fiecare cerere potrivită către aceeași destinație.',
  'workbench.docs.body.redirect.staticCaption':
    'Aceeași destinație pentru fiecare cerere potrivită — substituția completă a adresei URL.',
  'workbench.docs.body.redirect.regexTitle': 'Redirecționare regex',
  'workbench.docs.body.redirect.regex1Prefix': 'Asociați cu o condiție Regex URL. Folosiți',
  'workbench.docs.body.redirect.regex1Suffix':
    ' etc. pentru a face referire la grupurile de captură în adresa URL de destinație.',
  'workbench.docs.body.redirect.regexCaption':
    'Textul potrivit al grupului de captură este substituit în adresa URL de destinație.',
  'workbench.docs.body.redirect.wontApplyCaption':
    'Redirecționarea nu se aplică retroactiv paginilor deja încărcate. Buclele sunt plafonate în tăcere de browserul Chrome.',
  'workbench.docs.body.redirect.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.redirect.when1':
    'Forțarea HTTP → HTTPS, migrarea utilizatorilor de pe un domeniu vechi, rescrierea versiunilor API și trimiterea traficului CDN către un server de dezvoltare local sunt cele patru tipare tipice. Asociați Static cu adrese URL complete pe care le știți dinainte; recurgeți la Regex când calea trebuie să treacă prin redirecționare.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Patru tipare tipice — alegeți Regex când calea de destinație depinde de potrivire.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'Modificați parametrii de interogare ai adresei URL înainte ca cererea să părăsească browserul. Se compilează într-o acțiune DNR',
  'workbench.docs.body.queryParam.introSuffix': '.',
  'workbench.docs.body.queryParam.addTitle': 'Adăugare / Înlocuire',
  'workbench.docs.body.queryParam.add1':
    'Adaugă parametrul dacă lipsește sau îi înlocuiește valoarea dacă există deja.',
  'workbench.docs.body.queryParam.addCaption':
    'Adaugă când lipsește, înlocuiește când există — întotdeauna un singur parametru potrivit cu valoarea dvs.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Doar înlocuire',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Înlocuiește valoarea',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'doar când parametrul este deja prezent',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. Adresele URL fără parametru rămân neatinse. Folosiți-o pentru a canonicaliza o valoare (de ex. forțați',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    'pe adresele URL care poartă deja orice regiune) fără a-l injecta în adresele URL care nu îl aveau.',
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Înlocuiește doar valorile existente — adresele URL fără parametru rămân neatinse.',
  'workbench.docs.body.queryParam.removeTitle': 'Eliminare',
  'workbench.docs.body.queryParam.remove1': 'Elimină anumiți parametri după nume. Valoarea este ignorată.',
  'workbench.docs.body.queryParam.removeCaption':
    'Parametrul numit dispare; fiecare alt parametru de interogare trece mai departe.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Eliminare toate',
  'workbench.docs.body.queryParam.removeAll1':
    'Elimină întregul șir de interogare. Nu poate fi combinată cu Adăugare / Înlocuire în aceeași regulă.',
  'workbench.docs.body.queryParam.removeAllCaption':
    'Elimină toată interogarea dintr-un singur pas — adresa URL rămâne goală.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Eliminare toate intră în conflict cu Adăugare / Înlocuire la nivelul DNR — împărțiți în două reguli.',
  'workbench.docs.body.queryParam.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.queryParam.when1':
    'Forțarea unui indicator de depanare, canonicalizarea regiunii sau a limbii, curățarea parametrilor de urmărire sau eliminarea tuturor șirurilor de interogare pentru confidențialitate. Fiecare se mapează clar pe una dintre cele patru operații de mai sus.',
  'workbench.docs.body.queryParam.useCasesCaption':
    'Patru tipare tipice — alegeți operația care se potrivește intenției dvs.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    'Injectați JavaScript sau CSS în paginile potrivite. Codul rulează în contextul paginii, printr-un script de conținut.',
  'workbench.docs.body.inject.timingCaption':
    'Momentul inserării — înaintea scripturilor paginii (Cât mai curând posibil) sau în siguranță față de DOM (După încărcarea paginii).',
  'workbench.docs.body.inject.scriptTitle': 'Injectare de script',
  'workbench.docs.body.inject.script1': 'Cod inline sau o adresă URL externă. Alegeți momentul inserării:',
  'workbench.docs.body.inject.asapStrong': 'Cât mai curând posibil',
  'workbench.docs.body.inject.asap1':
    '— rulează înaintea scripturilor proprii ale paginii. Util pentru monkey-patch-urile care trebuie să câștige cursa (de ex. învelirea',
  'workbench.docs.body.inject.asap1Suffix': 'înainte ca codul aplicației să captureze o referință).',
  'workbench.docs.body.inject.afterStrong': 'După încărcarea paginii',
  'workbench.docs.body.inject.after1':
    '— rulează odată ce pagina a fost parsată. Valoarea implicită mai sigură pentru codul care citește DOM-ul, deoarece elementele există garantat.',
  'workbench.docs.body.inject.scriptCaption':
    'Scriptul ajunge ca etichetă <script> în pagină — vede aceleași globale ca JS-ul paginii.',
  'workbench.docs.body.inject.cssTitle': 'Injectare de CSS',
  'workbench.docs.body.inject.css1Prefix': 'Injectați CSS personalizat ca etichetă',
  'workbench.docs.body.inject.css1Suffix':
    '. Util pentru suprascrieri de mod întunecat, ascunderea elementelor zgomotoase sau tematizare per mediu.',
  'workbench.docs.body.inject.cssCaption': 'CSS-ul este adăugat ca etichetă <style>, cu specificitate CSS normală.',
  'workbench.docs.body.inject.wontApplyCaption':
    'Cadrele iframe izolate și paginile cu CSP strict blochează scripturile injectate.',
  'workbench.docs.body.inject.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.inject.when1':
    'Aplicarea de monkey-patch-uri pe interfețele API ale browserului înainte ca aplicația să le preia, forțarea unei teme de mod întunecat, ascunderea elementelor zgomotoase ale interfeței și plantarea de indicatoare de funcții la nivel de window înainte ca pagina să se inițializeze.',
  'workbench.docs.body.inject.useCasesCaption':
    'Patru tipare tipice — momentul „Cât mai curând posibil” este necesar pentru primul și al patrulea.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    'Adaugă latență artificială cererilor potrivite. Trei benzi rulează în paralel, în funcție de tipul cererii.',
  'workbench.docs.body.delay.routingCaption': 'Rutarea întârzierii — trei benzi pentru trei tipuri de cereri.',
  'workbench.docs.body.delay.navHeading': 'Navigări de document și iframe',
  'workbench.docs.body.delay.nav1Prefix': 'Rutate printr-o pagină locală de așteptare. Respectă întârzieri de până la',
  'workbench.docs.body.delay.navMs': '30.000 ms',
  'workbench.docs.body.delay.nav1Suffix': '— plafonul de redirecționare DNR al browserului Chrome.',
  'workbench.docs.body.delay.navCaption':
    'O pagină locală de așteptare reține navigarea N ms, apoi o trimite mai departe către ținta reală.',
  'workbench.docs.body.delay.xhrHeading': 'XHR / fetch inițiate din JS',
  'workbench.docs.body.delay.xhr1Prefix': 'Interceptate de un monkey-patch pe',
  'workbench.docs.body.delay.xhr1Middle': '. Plafonate la',
  'workbench.docs.body.delay.xhrMs': '5.000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    'pentru a nu epuiza bazinul de conexiuni HTTP al browserului Chrome — valorile mai mari sunt plafonate pe fir.',
  'workbench.docs.body.delay.xhrCaption':
    'Un setTimeout în patch-ul de la nivelul paginii reține apelul înainte de a-l trimite în rețea.',
  'workbench.docs.body.delay.wontApplyCaption':
    'Subresursele și apelurile fetch din service worker scapă de monkey-patch-ul de la nivelul paginii.',
  'workbench.docs.body.delay.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.delay.when1':
    'Scoaterea la iveală a regresiilor stărilor de încărcare, exersarea căilor de cod cu debounce/throttle, expunerea condițiilor de cursă între cereri concurente și aproximarea condițiilor de rețea lentă în dezvoltarea locală.',
  'workbench.docs.body.delay.useCasesCaption':
    'Patru tipare tipice — asociați cu Model URL sau Domenii pentru delimitare.',
  'workbench.docs.body.delay.desktopNoteTitle': 'Aplicația desktop — notă de produs',
  'workbench.docs.body.delay.desktopNote1':
    'Limitarea resurselor statice (imagini, scripturi, foi de stil, fonturi) necesită un strat de rețea local real, care să poată ține conexiunile deschise și să transmită octeți în flux — în afara razei de acțiune a unei extensii. Aplicația desktop preia asta în curând.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'Suprascrieți sau transformați corpurile cererilor înainte să părăsească browserul. Bazată pe script — interceptează',
  'workbench.docs.body.requestBody.introAnd': 'și',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'Regula se declanșează între page.js și rețea — trei forme de transformare',
  'workbench.docs.body.requestBody.staticTitle': 'Corp static',
  'workbench.docs.body.requestBody.static1':
    'Înlocuiește întregul corp al cererii cu un șir fix. Funcționează atât pentru REST, cât și pentru GraphQL — regula nu parsează corpul, îl substituie în întregime.',
  'workbench.docs.body.requestBody.staticCaption': 'Corpul întreg înlocuit — originalul este aruncat.',
  'workbench.docs.body.requestBody.dynamicTitle': 'Corp dinamic',
  'workbench.docs.body.requestBody.dynamic1':
    'Scrieți o funcție care primește corpul original și contextul cererii, apoi returnează corpul modificat. Funcția primește',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': 'Funcția vede originalul; returnează ce trebuie trimis.',
  'workbench.docs.body.requestBody.graphqlTitle': 'Filtru GraphQL',
  'workbench.docs.body.requestBody.graphql1Prefix':
    'Când Tipul de resursă este GraphQL, regula se declanșează doar pe cererile al căror câmp configurat din conținutul util JSON se potrivește cu valoarea. Runtime-ul parsează corpul cererii ca JSON, citește câmpul numit de',
  'workbench.docs.body.requestBody.graphql1Middle': ' și îl testează față de',
  'workbench.docs.body.requestBody.graphql1Middle2': 'folosind operatorul ales (',
  'workbench.docs.body.requestBody.graphql1Middle3': 'pentru potrivire exactă,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'pentru subșir).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Chei uzuale:',
  'workbench.docs.body.requestBody.graphql2Middle': 'pentru operația denumită,',
  'workbench.docs.body.requestBody.graphql2Suffix':
    'pentru un subșir al textului interogării. Cererile fără corp JSON sau cu un câmp lipsă ori nepotrivit trec neatinse.',
  'workbench.docs.body.requestBody.graphqlCaption':
    'Poartă la nivel de câmp — operațiile care nu se potrivesc trec neatinse.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'GET/HEAD nu au ce înlocui; resursele statice nu intră în interceptarea prin script.',
  'workbench.docs.body.requestBody.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.requestBody.when1':
    'Forțarea fixturilor de test, marcarea fiecărui conținut util cu metadate (indicatoare de depanare, id-uri de cerere), simularea anumitor operații GraphQL și anonimizarea datelor PII înainte de redare sunt cele patru tipare tipice.',
  'workbench.docs.body.requestBody.useCasesCaption':
    'Patru tipare tipice — asociați cu Model URL sau Domenii pentru delimitare.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Interceptați apelurile API și returnați răspunsuri personalizate — control complet asupra codului de stare, corpului și antetelor de răspuns. Bazată pe script — interceptează',
  'workbench.docs.body.response.introAnd': 'și',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    'Static sare complet peste rețea; Dinamic o atinge mai întâi, apoi transformă.',
  'workbench.docs.body.response.staticTitle': 'Răspuns static',
  'workbench.docs.body.response.static1':
    'Returnează un corp fix, cu control complet asupra răspunsului sintetic — codul de stare, Content-Type și orice antete de răspuns suplimentare (Set-Cookie, antete CORS, indicatoare personalizate). Cererea reală nu se face niciodată. Util pentru dezvoltarea offline pe o fixtură cunoscută.',
  'workbench.docs.body.response.staticCaption':
    'Serverul nu este contactat niciodată — pagina primește fixtura ca și cum ar fi venit de pe fir.',
  'workbench.docs.body.response.dynamicTitle': 'Răspuns dinamic',
  'workbench.docs.body.response.dynamic1':
    'Cererea reală se face mai întâi. Funcția dvs. primește răspunsul și contextul cererii, apoi returnează răspunsul modificat. Funcția primește',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'Codul de stare, Content-Type și câmpurile de antete de răspuns setate pe regulă se aplică în continuare peste valoarea returnată de funcție, așa că puteți modifica corpul lăsând regula să controleze antetele-înveliș.',
  'workbench.docs.body.response.dynamicCaption': 'Apelul real are loc mai întâi; funcția rescrie ce vine înapoi.',
  'workbench.docs.body.response.graphqlTitle': 'Filtru GraphQL',
  'workbench.docs.body.response.graphql1':
    'Când Tipul de resursă este GraphQL, regula se declanșează doar pe cererile al căror câmp configurat din conținutul util JSON se potrivește cu valoarea setată de dvs. (Este egal cu sau Conține) — astfel, un singur punct final care multiplexează multe operații poate fi interceptat operație cu operație. Cererile al căror conținut util nu se potrivește trec direct în rețea, neatinse.',
  'workbench.docs.body.response.wontApplyCaption':
    'Resursele statice și navigările de pagină nu intră niciodată în interceptarea prin script.',
  'workbench.docs.body.response.whenTitle': 'Când să o folosiți',
  'workbench.docs.body.response.when1':
    'Dezvoltarea offline pe o fixtură, simularea anumitor răspunsuri de eroare, mascarea datelor PII înainte să ajungă în pagină și exersarea formelor de conținut util de caz limită greu de reprodus pe un backend real.',
  'workbench.docs.body.response.useCasesCaption':
    'Patru tipare tipice — alegeți Static pentru fixturi, Dinamic pentru transformări pe date reale.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    'O condiție este un filtru pe un atribut al unei cereri de ieșire. Stivuiți mai multe condiții și ele se combină prin logica AND — fiecare condiție trebuie să se potrivească pentru ca regula să se declanșeze. Fiecare condiție corespunde direct, în browserul Chrome, câmpului',
  'workbench.docs.body.conditions.intro1Suffix': '.',
  'workbench.docs.body.conditions.intro2Prefix': 'Majoritatea condițiilor au și o variantă',
  'workbench.docs.body.conditions.exclStrong': 'Excl.',
  'workbench.docs.body.conditions.intro2Suffix':
    'în editorul de reguli — Excl. metode, Excl. resurse, Excl. inițiator, Excl. antet răsp. — care inversează potrivirea (de ex. „totul în afară de aceste metode”). Folosiți-le ori de câte ori setul negativ este mai mic decât cel pozitiv.',
  'workbench.docs.body.conditions.anatomyCaption':
    'O regulă asociază condiții potrivite prin AND cu o acțiune — condițiile decid dacă regula se declanșează.',
  'workbench.docs.body.conditions.matchingCaption':
    'Fiecare condiție verifică un atribut al cererii. Toate trebuie să se potrivească pentru ca regula să se declanșeze.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    'Adresa URL a paginii și adresa URL de destinație a apelului fetch sunt urmărite separat — de aceea există două condiții de domeniu.',
  'workbench.docs.body.conditions.urlPatternTitle': 'Model URL',
  'workbench.docs.body.conditions.urlPattern1Prefix': 'Model cu metacaractere pe adresa URL completă. Folosiți',
  'workbench.docs.body.conditions.urlPattern1Middle':
    'pentru a potrivi orice caractere. Protocolul trebuie specificat:',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'pentru oricare,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'doar pentru HTTPS.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Auriu = metacaracter, verde = literal. Fiecare adresă URL de test de mai jos arată dacă modelul se potrivește cu ea.',
  'workbench.docs.body.conditions.urlRegexTitle': 'Regex URL',
  'workbench.docs.body.conditions.urlRegex1':
    'Expresie regulată RE2 pe adresa URL completă, inclusiv protocolul. Pentru potriviri pe care metacaracterele nu le pot exprima. Nu poate fi combinată cu Model URL în aceeași regulă.',
  'workbench.docs.body.conditions.urlRegexCaption':
    'Violet = sintaxă regex reală. Verde = caractere literale. Fiecare adresă URL de test de mai jos arată dacă regex-ul se potrivește.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Domeniile cererii',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Potrivește un domeniu plus fiecare dintre subdomeniile lui, automat. Introduceți domeniul de bază o singură dată; regula acoperă',
  'workbench.docs.body.conditions.requestDomains1Suffix': ' și orice imbricare mai adâncă, fără metacaractere.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'O valoare, toate subdomeniile. Cazurile-limită de mai jos arată ce contează ca subdomeniu adevărat.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Excludere domenii',
  'workbench.docs.body.conditions.excludeDomains1':
    'Scade gazde din potrivirile altei condiții — aceeași semantică a subdomeniilor ca Domeniile cererii, așa că excluderea unei gazde îi exclude și subdomeniile. Nu potrivește nimic de una singură.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    'Includerea verde restrânge la un set de candidați; excluderea roșie elimină unii dintre ei. Subdomeniile urmează.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Domeniile inițiatorului',
  'workbench.docs.body.conditions.initiatorDomains1':
    'Potrivește după pagina deschisă în momentul cererii — originea cererii, nu destinația ei. Același apel fetch către aceeași adresă URL se poate potrivi sau nu, în funcție de fila pe care o navighează utilizatorul.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    'Aceeași destinație, două contexte de pagină diferite. Inițiatorul decide care se potrivește.',
  'workbench.docs.body.conditions.methodsTitle': 'Metode',
  'workbench.docs.body.conditions.methods1':
    'Filtrează după verbul HTTP. Selecție multiplă — alegeți metodele care trebuie să se potrivească; celelalte nu declanșează regula. Lăsați condiția complet oprită pentru a potrivi fiecare metodă.',
  'workbench.docs.body.conditions.methodsCaption':
    'Pastilele portocalii sunt selectate; cele gri sunt sărite. Cererile de test de mai jos urmăresc fiecare verb până la rezultatul lui.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Tipuri de resurse',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Filtrează după tipul resursei încărcate — navigări de pagină, XHR/fetch, scripturi, imagini, fonturi și altele. Selecție multiplă, ca la Metode. Vedeți referința',
  'workbench.docs.body.conditions.resourceTypesLink': 'Tipuri de resurse',
  'workbench.docs.body.conditions.resourceTypes1Suffix': 'pentru lista completă, cu numele de cod și exemple concrete.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Tipurile violete se potrivesc; tipurile gri sunt sărite. Fiecare cerere de test își arată tipul inline.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Tip de domeniu',
  'workbench.docs.body.conditions.domainType1Prefix': 'Clasifică fiecare cerere după relația ei cu pagina —',
  'workbench.docs.body.conditions.domainType1Middle': 'când destinația are același domeniu înregistrabil ca pagina,',
  'workbench.docs.body.conditions.domainType1Suffix':
    'când nu. Utilizare frecventă: blocarea trackerelor (potrivire doar thirdParty) sau limitarea unei reguli la propriile servicii (potrivire doar firstParty).',
  'workbench.docs.body.conditions.domainTypeCaption':
    'Bannerul paginii stabilește originea; selectorul alege ce tip se potrivește; tabelul arată verdictul per destinație.',
  'workbench.docs.body.conditions.headersTitle': 'Antete de răspuns',
  'workbench.docs.body.conditions.headers1':
    'Potrivește răspunsurile care poartă un anumit antet cu o anumită valoare. Motorul DNR al browserului Chrome nu expune potrivirea antetelor de cerere — această condiție este doar pe partea de răspuns. Atât numele antetului, cât și valoarea se compară ca șiruri exacte (fără metacaractere, fără potrivire parțială), iar antetul trebuie să fie efectiv prezent în răspuns.',
  'workbench.docs.body.conditions.headersCaption':
    'Două pastile (nume + valoare) unite prin =, apoi antete de răspuns de test care lovesc fiecare mod de eșec.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Totul într-o singură extensie',
  'workbench.docs.body.paradigm.oneExtension1':
    'Trei categorii de produse și-au împărțit istoric această suprafață: proxy-urile desktop se ocupă de interceptarea HTTP, platformele API din cloud vă păstrează cererile și colecțiile, iar extensiile ușoare de antete acoperă cazul „rescrie doar un antet”. Niciuna nu le livrează pe celelalte. Open Headers o face — într-o singură extensie de browser, cu un singur depozit de spațiu de lucru care alimentează fiecare suprafață.',
  'workbench.docs.body.paradigm.convergenceCaption':
    'Trei categorii tradiționale converg într-o singură instalare. Nimeni altcineva nu livrează această combinație în extensie.',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Motor de reguli de nivel enterprise',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    'Motorul de reguli nu este un singur truc întins peste nouă interfețe — sunt două căi de execuție reale, cu un limbaj comun deasupra.',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'Native DNR',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'regulile se compilează în interfața oferită de browserul Chrome',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API și prind fiecare cerere emisă de browser (pagini, subcadre, fetch, XHR, imagini, fonturi, scripturi). Iar',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'motorul de scripturi',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    'preia acolo unde DNR nu ajunge — îmbinarea valorilor antetelor, transformarea corpurilor, simularea răspunsurilor, injectarea de cod, întârzierea apelurilor. Ambele motoare citesc același limbaj al condițiilor și aceleași cinci sfere de variabile, așa că o regulă scrisă pentru DNR trece la motorul de scripturi schimbând un singur tip de acțiune.',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    'Două căi de execuție, nouă categorii de reguli, un singur limbaj comun al condițiilor + variabilelor.',
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Catalog complet de cereri API',
  'workbench.docs.body.paradigm.apiCatalog1':
    'Fiecare capacitate livrată de un client API desktop — construirea cererilor, medii, OAuth 2.0 (inclusiv PKCE + Client Credentials + reîmprospătare), scripturi înainte și după răspuns, multipart cu blob-uri de fișiere adresate după conținut, colecții + foldere, GraphQL cu introspecție de schemă — trăiește în extensie. Același depozit de spațiu de lucru ca regulile, aceleași cinci sfere de variabile, aceleași suprafețe. Aduceți-vă colecțiile de pe altă platformă și continuați să lucrați; nimic nu se exportă înapoi într-un cloud pe care nu îl controlați.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'Editorul de cereri, cu suport de protocoale, fiecare tip de autentificare, scripturi, fișiere și colecții — în extensie.',
  'workbench.docs.body.paradigm.localFirstHeading': 'Local-first prin design',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '„Local-first” (mai întâi local) este o atitudine, nu o funcție. Extensia nu are sistem de conturi, releu în cloud sau urmărire — singurele date de utilizare sunt contorizarea anonimă a funcțiilor, inspectabilă octet cu octet și oprită dintr-un singur comutator — și aveți o alegere reală în privința locului',
  'workbench.docs.body.paradigm.localFirstWhere': 'unde',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    'se află backend-ul. Patru opțiuni de găzduire, toate doar locale, toate sub controlul dvs.: service worker-ul din browser (astăzi, fără configurare), backend-ul încorporat al aplicației desktop, un server local de sine stătător care servește fiecare suprafață Open Headers pe un singur computer sau un backend găzduit de dvs. pe propria mașină virtuală. Fiecare opțiune păstrează aceleași garanții; compromisul este raza de acțiune, nu proprietatea.',
  'workbench.docs.body.paradigm.localFirst2':
    'Colaborarea în echipă se livrează prin backend-uri de stocare controlate de utilizator (Git) — nu printr-un server al furnizorului.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'Același principiu se aplică și modului',
  'workbench.docs.body.paradigm.frontEndsHow': 'în care',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    'ajungeți la acele date. Extensia de browser este interfața implicită — patru suprafețe în browser. O aplicație desktop nativă, un CLI și o aplicație web la distanță se livrează alături de ea. Fiecare interfață vorbește cu un backend la alegerea dvs.; alegeți orice combinație, iar fiecare suprafață rămâne sincronizată.',
  'workbench.docs.body.paradigm.autoSyncHeading': 'Sincronizare automată fără a vă pierde munca',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'Sincronizarea între dispozitive este de obicei locul unde produsele local-first cedează și vă cer să aveți încredere în cloudul lor. Open Headers o rezolvă la nivel',
  'workbench.docs.body.paradigm.perFieldStrong': 'de câmp',
  'workbench.docs.body.paradigm.autoSync1Middle': ': fereastra popup care comută indicatorul',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'al unei reguli și fereastra Workbench care rescrie o valoare de antet în aceeași regulă ajung amândouă, în orice ordine, fără banner de ciornă învechită și fără suprascriere. Aceeași abordare se extinde de la cele patru suprafețe ale unei extensii la un server local care susține extensia + aplicația desktop + CLI și la spații de lucru de echipă cu mai mulți utilizatori printr-un depozit Git la distanță — fără a avea vreodată nevoie de un server al furnizorului la mijloc.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    'Două suprafețe, o regulă, câmpuri diferite — ambele editări ajung, nimic nu este suprascris.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    'Vreți să vedeți cum se compară cu alte instrumente pe care poate le-ați încercat?',
  'workbench.docs.body.paradigm.comparisonLink': 'Cum ne comparăm',
  'workbench.docs.body.paradigm.noteCalloutMiddle': 'urmează. Vreți întreaga platformă dintr-o privire? Săriți la',
  'workbench.docs.body.paradigm.roadmapLink': 'Fiecare suprafață, livrată',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    'Versiunea cea mai scurtă: Open Headers este ce ați construi dacă ați lua puterea de modelare a cererilor a unui proxy desktop, biblioteca de reguli a unei platforme API din cloud și suprafața mereu prezentă a unei extensii doar pentru antete și le-ați cere să partajeze un singur depozit.',
  'workbench.docs.body.comparison.matrixCaption':
    'Trei categorii de produse, câte un set de compromisuri fiecare — și unde se situează Open Headers.',
  'workbench.docs.body.comparison.vsCloudHeading': 'față de platformele API din cloud',
  'workbench.docs.body.comparison.vsCloud1':
    'Instrumentele găzduite în cloud se așteaptă ca traficul, acreditările și definițiile regulilor dvs. să trăiască pe serverele lor. Acest model presupune că sunteți de acord ca acele date să părăsească computerul dvs. — și să întrețineți un cont pentru a accesa propria muncă. Open Headers nu face niciuna dintre aceste presupuneri. Totul rămâne local; colaborarea în echipă se livrează prin stocare controlată de utilizator (Git), nu prin baza de date a unui furnizor.',
  'workbench.docs.body.comparison.vsProxiesHeading': 'față de proxy-urile desktop',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'Proxy-urile trec întregul dvs. trafic printr-un proces separat. Sunt puternice, dar grele: instalați un binar, instalați un certificat CA, configurați fiecare aplicație să indice portul proxy-ului. Open Headers folosește interfața oferită de browserul Chrome',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API pentru traficul static și un motor de scripturi per pagină pentru transformările dinamice. Fără port de proxy, fără certificat CA, fără configurare per aplicație — iar regulile potrivite se aplică cu permisiunile paginii înseși, nu ale unui intermediar.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'față de extensiile doar pentru antete',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'Extensiile doar pentru antete tratează exact un tip de regulă și se opresc acolo. Open Headers tratează',
  'workbench.docs.body.comparison.nineLink': 'nouă',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle':
    '— antete Adăugare / Înlocuire / Adăugare la sfârșit / Eliminare / Îmbinare,',
  'workbench.docs.body.comparison.blockLink': 'Blocare',
  'workbench.docs.body.comparison.redirectLink': 'Redirecționare',
  'workbench.docs.body.comparison.queryParamsLink': 'Parametri de interogare',
  'workbench.docs.body.comparison.injectLink': 'Injectare',
  'workbench.docs.body.comparison.delayLink': 'Întârziere',
  'workbench.docs.body.comparison.requestBodyLink': 'Corpul cererii',
  'workbench.docs.body.comparison.responseLink': 'Răspuns',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— toate conduse de același',
  'workbench.docs.body.comparison.conditionLanguageLink': 'limbaj al condițiilor',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', toate observabile prin aceeași suprafață de',
  'workbench.docs.body.comparison.requestTrackingLink': 'urmărire a cererilor',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': '.',
  'workbench.docs.body.comparison.whyMattersTitle': 'De ce contează în practică',
  'workbench.docs.body.comparison.whyMatters1':
    'Majoritatea fluxurilor de lucru ating mai mult de una dintre aceste categorii. Simularea unui răspuns API, blocarea unui tracker terț și forțarea unui antet de depanare pe un anumit mediu sunt trei tipuri de reguli diferite — trei instalări diferite în lumea tradițională. Aici, ele împart un singur spațiu de lucru.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers a început doar local — o extensie pe un singur dispozitiv. Fiecare etapă de mai jos extinde acea formă fără a o rupe, și fiecare dintre ele s-a livrat. Sincronizarea între utilizatori se livrează prin mijloace',
  'workbench.docs.body.roadmap.userControlledStrong': 'controlate de utilizator',
  'workbench.docs.body.roadmap.intro1Suffix':
    '— depozite Git și implementări găzduite de dvs. — niciodată printr-un cloud găzduit de furnizor.',
  'workbench.docs.body.roadmap.gitHeading': 'Colaborare pe spații de lucru prin Git (pregătit pentru echipe)',
  'workbench.docs.body.roadmap.git1Prefix':
    'Spațiile de lucru se serializează în YAML într-un depozit Git pe care îl controlați. Pull sincronizează; push partajează; conflictele de îmbinare se rezolvă prin instrumentele existente ale Git. Fără server central, fără cont, fără dependență de furnizor. Prezența în timp real este',
  'workbench.docs.body.roadmap.gitAnd': 'și',
  'workbench.docs.body.roadmap.git1Suffix': '— durabile, auditabile, deja înțelese.',
  'workbench.docs.body.roadmap.desktopHeading': 'Aplicația desktop',
  'workbench.docs.body.roadmap.desktop1':
    'Un binar nativ care rulează același depozit de spațiu de lucru ca extensia. Util pentru suprafețele la care o extensie nu ajunge — modelarea traficului la nivel de sistem, editarea în mai multe ferestre, integrarea mai profundă cu sistemul de fișiere. Cele două împart același format pe disc, așa că deschiderea aplicației desktop pe un spațiu de lucru deținut de extensie este o citire, nu o migrare.',
  'workbench.docs.body.roadmap.mcpHeading': 'Server MCP — control prin agenți AI',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers se expune prin',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'astfel încât orice client AI compatibil MCP — Claude Desktop, Claude Code, Cursor, VS Code, Cline și ecosistemul tot mai mare din spatele lor — vă poate conduce direct spațiul de lucru. Cereți-i agentului, în limbaj natural, să adauge o regulă de antet, să ruleze o cerere salvată pe staging, să comute mediile, să compare două spații de lucru sau să importe o colecție Postman; agentul traduce asta în apeluri de instrumente MCP, iar fereastra Workbench reflectă rezultatul.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'Serverul rulează',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'doar local, implicit',
  'workbench.docs.body.roadmap.mcp2Middle':
    '(transport stdio, asociat unu-la-unu cu un client de pe același computer) și',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'HTTP/SSE pentru acces la distanță',
  'workbench.docs.body.roadmap.mcp2Suffix':
    'când găzduiți singuri. Fără releu al furnizorului; agentul dvs. vorbește direct cu instalarea dvs. Apelurile de instrumente rulează cu aceleași permisiuni de spațiu de lucru pe care le aveți dvs. — secretele rămân în spatele vault-ului, operațiile sensibile rămân opționale.',
  'workbench.docs.body.roadmap.serverHeading': 'Server local / LAN pentru sincronizare între dispozitive',
  'workbench.docs.body.roadmap.server1':
    'Un server pe care îl puteți rula pe computerul dvs., în rețeaua LAN sau pe o gazdă cu tunel. Extensia, aplicația desktop și CLI devin toate clienți ai aceluiași server — aceleași spații de lucru, aceleași reguli, același vault, pe fiecare dispozitiv pe care îl folosiți. Serverul rămâne în rețeaua locală; nu există o cale opțională către cloud suprapusă.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Scripting fără interfață și integrare CI. Listați reguli, comutați medii, rulați o singură cerere salvată din shell, comparați un spațiu de lucru cu altul. CLI vorbește cu același server ca extensia și aplicația desktop, așa că automatizarea rămâne sincronizată cu ce vedeți în interfață.',
  'workbench.docs.body.roadmap.webAppHeading': 'Implementare pe mașină virtuală proprie + aplicație web',
  'workbench.docs.body.roadmap.webApp1':
    'Aceeași interfață livrată ca pachet web pe care îl puteți servi de pe propria origine. Pentru browsere corporative restricționate, dispozitive chioșc sau orice mediu în care instalarea unei extensii nu este o opțiune — și pentru utilizatorii care vor o implementare personalizată a Open Headers sub propriul domeniu.',
  'workbench.docs.body.roadmap.importersHeading': 'Importatoare',
  'workbench.docs.body.roadmap.importers1':
    'Pe lângă importatoarele cURL / HAR / Postman: colecții Insomnia, specificații OpenAPI și importuri complete de cereri HAR (nu doar antete) — toate disponibile astăzi. Paritatea importatoarelor este felul în care Open Headers își câștigă adoptarea de la oamenii deja investiți în alt instrument — aduceți-vă colecția dintr-un singur pas, continuați să lucrați.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'Dar un backend găzduit în cloud?',
  'workbench.docs.body.roadmap.cloudCallout1':
    'Nu este în meniu deocamdată — dacă vreți un backend găzduit în cloud, îl puteți găzdui singuri pe propria mașină virtuală (vedeți mai sus).',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Adăugare / Înlocuire',
  'workbench.docs.anchor.override.summary':
    'Setează antetul la această valoare — adăugat când lipsește, înlocuind orice valoare existentă.',
  'workbench.docs.anchor.append.title': 'Adăugare la sfârșit',
  'workbench.docs.anchor.append.summary':
    'Adaugă această valoare la valoarea existentă a antetului. Doar antetele standard cu valori-listă acceptă adăugarea la sfârșit — pe celelalte regula se salvează ca ciornă.',
  'workbench.docs.anchor.remove.title': 'Eliminare',
  'workbench.docs.anchor.remove.summary':
    'Elimină complet antetul din traficul potrivit; câmpul de valoare nu este folosit.',
  'workbench.docs.anchor.merge.title': 'Îmbinare',
  'workbench.docs.anchor.merge.summary':
    'Îmbină această valoare în lista existentă a antetului, sărind peste valorile deja prezente.',
  'workbench.docs.anchor.qpAdd.title': 'Adăugare / Înlocuire',
  'workbench.docs.anchor.qpAdd.summary':
    'Setează parametrul pe adresa URL — adăugat când lipsește, înlocuit când există deja.',
  'workbench.docs.anchor.qpOverride.title': 'Doar înlocuire',
  'workbench.docs.anchor.qpOverride.summary':
    'Înlocuiește valoarea parametrului doar când adresa URL îl poartă deja; adresele URL fără el trec neschimbate.',
  'workbench.docs.anchor.qpRemove.title': 'Eliminare',
  'workbench.docs.anchor.qpRemove.summary': 'Elimină parametrul din adresele URL potrivite.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Eliminare toate',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Elimină întregul șir de interogare din adresele URL potrivite. Celelalte operații din aceeași regulă sunt ignorate cât timp este prezentă.',
  'workbench.docs.anchor.urlPattern.title': 'Model URL',
  'workbench.docs.anchor.urlPattern.summary':
    'Potrivește adresa URL a cererii cu un model urlFilter — metacaractere *, ancore de domeniu ||, separatori ^.',
  'workbench.docs.anchor.urlRegex.title': 'Regex URL',
  'workbench.docs.anchor.urlRegex.summary':
    'Potrivește adresa URL a cererii cu o expresie regulată; grupurile de captură alimentează substituțiile \\1, \\2 din țintele de redirecționare.',
  'workbench.docs.anchor.requestDomains.title': 'Domeniile cererii',
  'workbench.docs.anchor.requestDomains.summary':
    'Potrivește cererile a căror gazdă țintă este unul dintre domeniile listate, inclusiv subdomeniile.',
  'workbench.docs.anchor.excludeDomains.title': 'Excludere domenii',
  'workbench.docs.anchor.excludeDomains.summary':
    'Potrivește fiecare cerere, cu excepția celor a căror gazdă țintă este listată.',
  'workbench.docs.anchor.initiatorDomains.title': 'Domeniile inițiatorului',
  'workbench.docs.anchor.initiatorDomains.summary':
    'Potrivește după pagina care a emis cererea, nu după adresa URL a cererii în sine. Varianta Excl. inversează lista.',
  'workbench.docs.anchor.methods.title': 'Metode',
  'workbench.docs.anchor.methods.summary':
    'Potrivește după metoda HTTP (GET, POST, …). Varianta Excl. inversează lista.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Tipuri de resurse',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Potrivește după ce încarcă browserul — documente, scripturi, XHR/fetch, imagini, … Varianta Excl. inversează lista.',
  'workbench.docs.anchor.domainType.title': 'Tip de domeniu',
  'workbench.docs.anchor.domainType.summary':
    'Primar potrivește cererile către același site ca pagina; terț potrivește cererile cross-site.',
  'workbench.docs.anchor.headers.title': 'Antet de răspuns',
  'workbench.docs.anchor.headers.summary':
    'Potrivește după un antet al răspunsului primit — după prezență sau după valoare, când este dată una.',
  'workbench.docs.anchor.redirectRegex.title': 'Substituție regex',
  'workbench.docs.anchor.redirectRegex.summary':
    'Cu o condiție Regex URL, \\1, \\2 … inserează grupurile capturate în ținta de redirecționare.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Dinamic (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Rulează codul dvs. JavaScript pe fiecare cerere potrivită pentru a construi corpul de ieșire din cel original.',
  'workbench.docs.anchor.responseDynamic.title': 'Dinamic (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Rulează codul dvs. JavaScript pentru fiecare răspuns potrivit — transformând răspunsul real (rețea) sau construind unul de la zero (simulare).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'Filtru de operație GraphQL',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'Condiționează suplimentar regula de numele operației GraphQL găsit în conținutul util al cererii.',
  'workbench.docs.anchor.responseGraphql.title': 'Filtru de operație GraphQL',
  'workbench.docs.anchor.responseGraphql.summary':
    'Condiționează suplimentar regula de numele operației GraphQL găsit în conținutul util al cererii.',
} as const satisfies Catalog;
