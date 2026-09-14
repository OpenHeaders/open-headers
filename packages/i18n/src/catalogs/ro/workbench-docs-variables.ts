/**
 * Workbench Docs panel — the Variables section body — Romanian.
 * Mirrors `catalogs/en/workbench-docs-variables.ts` key for key.
 * `{{ns.NAME}}` reference tokens and scope names ride raw inside keyed
 * prose (the render site composes them as code chips). Quotes the
 * shipped ro mints: the scoping nouns from `workbench-chrome.ts`'s
 * varScope block (Vault raw / Mediu / Colecție / Spațiu de lucru,
 * spațiu de nume, fără prefix = bare), the sidebar entries (Vault /
 * „Variabile de spațiu de lucru” / „Variabile Live” / „Medii” /
 * „Variabile” — the resolution-hints quotes), Variabile = the tool
 * window, umbrit = shadowed (popup), flux de lucru Live / pas /
 * extractor / captură / publicare carried, Trimitere = Send, static /
 * dinamic = the request-body modes; sferă = scope (the variable scope
 * — never rază de acțiune here). Vault / vault case law: en's
 * capitalized `Vault` and lowercase `vault` are each kept in their key
 * (Vault-ul păstrează … intrările din vault — the hyphen breaks the
 * boundary so the capitalized token survives). MINTS: parcurgere =
 * the walk; scară = ladder; În sferă / Toate sferele = In scope / All
 * scopes (the Variables tool-window tabs — `workbench-variables.ts`
 * MUST reuse); expunere / expus = expose / marked as exposed;
 * sugerator = suggester; referință fără prefix = bare reference;
 * substituție = template substitution (substituire stays supersede);
 * chiriaș = tenant; strat de bază = base layer; învechit = stale
 * carried. Section headings keep the structural ` — ` as the label
 * separator; prose keeps it as the native aside dash. A fragment
 * joined to a preceding code chip with no space opens with `.` / `,`
 * per en; the en `page.` tail moves its noun into the preceding
 * fragment.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Orice câmp șablonabil — o valoare de antet, o adresă URL de redirecționare, un corp de cerere, un pas de flux de lucru — poate face referire la o variabilă cu',
  'workbench.docs.body.variables.intro1Suffix':
    '. Valoarea este substituită la momentul utilizării, așa că o singură definiție alimentează fiecare regulă, cerere și flux de lucru care o menționează. Variabilele trăiesc în cinci sfere, fiecare cu propriul loc în aplicație și propriul rang atunci când același nume există în mai multe.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'O referință fără prefix',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'parcurge patru sfere de sus în jos și se oprește la prima apariție. Live și celelalte sfere cu spațiu de nume stau în afara parcurgerii.',
  'workbench.docs.body.variables.scopesHeading': 'Cele cinci sfere',
  'workbench.docs.body.variables.vaultHeading': 'Vault — secrete, doar pe acest dispozitiv',
  'workbench.docs.body.variables.vault1Prefix':
    'Vault-ul păstrează secrete per dispozitiv: chei API, parole, semințe TOTP. Intrările din vault nu se sincronizează niciodată și nu părăsesc niciodată dispozitivul — rămân în afara exporturilor de spațiu de lucru și a istoricului git. Există două tipuri: intrările de tip',
  'workbench.docs.body.variables.vaultKindString': 'șir',
  'workbench.docs.body.variables.vault1Middle': 'se rezolvă verbatim, iar intrările',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'se rezolvă la codul curent de 6–8 cifre calculat din semințele stocate — semințele în sine nu sunt expuse niciodată printr-un șablon. Vault ocupă rangul cel mai înalt, așa că un secret din vault câștigă întotdeauna o referință fără prefix.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Faceți referire la secret cu',
  'workbench.docs.body.variables.vaultCaptionSuffix':
    'din entitățile sincronizate — nu lipiți niciodată valoarea brută.',
  'workbench.docs.body.variables.environmentHeading': 'Mediu — seturi de valori comutabile',
  'workbench.docs.body.variables.environment1Prefix':
    'Mediile sunt seturi denumite de variabile pe care le schimbați ca un tot —',
  'workbench.docs.body.variables.environment1Suffix':
    ', configurația locală a unui coleg. Mediul activ se alege din selectorul din antet; un nume pe care mediul activ nu îl definește revine la mediul implicit înainte ca parcurgerea să continue în jos. Rularea fără niciun mediu selectat este o stare validă — rezolvarea sare pur și simplu peste sferă. Rândurile pot fi marcate ca secrete, astfel încât valorile lor se afișează mascate în editor.',
  'workbench.docs.body.variables.environmentCaption':
    'Un nume, o valoare per etapă — comutați mediul în loc să duplicați regulile.',
  'workbench.docs.body.variables.collectionHeading': 'Colecție — limitată la o singură colecție',
  'workbench.docs.body.variables.collection1':
    'Variabilele de colecție sunt definite pe o colecție și se rezolvă doar pentru regulile și cererile care îi aparțin. Sunt locul potrivit pentru valorile adevărate pentru o singură interfață API, dar nu pentru întregul spațiu de lucru — o adresă URL de bază, un id de chiriaș, un prefix de versiune.',
  'workbench.docs.body.variables.collectionCaption':
    'Variabilele de colecție se rezolvă doar în interiorul propriei colecții — în altă parte parcurgerea trece pe lângă ele.',
  'workbench.docs.body.variables.workspaceHeading': 'Spațiu de lucru — partajate cu toată lumea',
  'workbench.docs.body.variables.workspace1':
    'Variabilele de spațiu de lucru sunt globalele întregului spațiu de lucru — vizibile fiecărei reguli, cereri și fiecărui flux de lucru și sincronizate cu spațiul de lucru. Au rangul cel mai mic, ceea ce le face stratul de bază natural: puneți aici valoarea comună și lăsați un mediu sau o colecție să o suprascrie unde este nevoie.',
  'workbench.docs.body.variables.workspaceCaption':
    'Stratul de bază — pentru valori adevărate peste tot. Nu pentru secrete, nu pentru valori per etapă.',
  'workbench.docs.body.variables.liveHeading': 'Live — publicate de o rulare de flux de lucru',
  'workbench.docs.body.variables.live1Prefix':
    'O variabilă Live este susținută de un flux de lucru Live — un lanț de cereri care se autentifică, obține un token și expune o valoare capturată. Salvarea fluxului de lucru îl activează; o rulare reușită (manuală sau programată) publică valoarea expusă, iar reîmprospătarea automată rulează din nou fluxul de lucru pentru a o menține proaspătă. Valorile Live sunt accesibile doar ca',
  'workbench.docs.body.variables.live1Suffix':
    '— niciodată printr-o referință fără prefix — astfel încât un șablon de regulă nu poate prelua în tăcere o valoare de reîmprospătare în zbor atunci când o variabilă de spațiu de lucru sau de mediu are același nume. Editarea rețetei fluxului de lucru marchează valoarea publicată ca învechită până la următoarea rulare.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Întotdeauna prefixul —',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '— și întotdeauna susținută de un flux de lucru, niciodată un token lipit.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': 'Rularea reușește → captura expusă se publică drept',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ regulile și cererile o consumă. Programarea rulează din nou fluxul de lucru.',
  'workbench.docs.body.variables.priorityHeading': 'Prioritate și umbrire',
  'workbench.docs.body.variables.priority1Prefix': 'O referință fără prefix',
  'workbench.docs.body.variables.priority1Suffix':
    'se rezolvă prin cele patru sfere reale în ordine strictă — vault, apoi mediul activ (cu revenire la mediul implicit), apoi colecția, apoi spațiul de lucru — și se oprește la prima sferă care definește numele. Definițiile inferioare există în continuare; sunt doar umbrite.',
  'workbench.docs.body.variables.shadowingCaptionPrefix': 'Mediul bate spațiul de lucru pentru referința fără prefix;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'citește în continuare valoarea umbrită.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'Fiecare sferă are și un spațiu de nume care fixează rezolvarea la ea, sărind complet peste scară:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Folosiți forma fără prefix pentru cazul obișnuit și forma cu spațiu de nume când vă referiți la o anumită sferă, indiferent de ce este definit deasupra ei.',
  'workbench.docs.body.variables.tipTitle': 'Păstrați secretele în vault',
  'workbench.docs.body.variables.tip1Prefix':
    'Regulile, cererile și fluxurile de lucru se sincronizează cu spațiul de lucru — vault-ul nu. Faceți referire la',
  'workbench.docs.body.variables.tip1Suffix':
    'dintr-o entitate sincronizată și fiecare coleg își furnizează propria valoare local; nimic sensibil nu ajunge vreodată în datele partajate.',
  'workbench.docs.body.variables.rulesHeading': 'Variabile în reguli',
  'workbench.docs.body.variables.rules1':
    'Aproape fiecare șir pe care îl poartă o regulă este șablonabil: valorile condițiilor (domenii, modele URL, nume de antete), valorile antetelor, adresele URL de redirecționare, numele și valorile parametrilor de interogare, corpurile statice de cerere și de răspuns, codul injectat, conținutul util WS / SSE și acreditările de autentificare Basic. Editorul de reguli evidențiază fiecare referință, afișează valoarea rezolvată la trecerea cursorului și semnalează cu un banner orice referință care nu se rezolvă — o regulă nerezolvată nu poate intra în vigoare până când fiecare referință nu are o valoare.',
  'workbench.docs.body.variables.consumersCaption':
    'O singură valoare șablonată alimentează toate cele trei suprafețe consumatoare — substituită acolo unde se aplică fiecare.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Corpurile dinamice (JS) nu sunt șablonate',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Regulile de corp de cerere și de răspuns în modul',
  'workbench.docs.body.variables.dynamicWord': 'dinamic',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'rulează codul dvs. JavaScript în loc să substituie șabloane — codul își calculează singur valorile. Doar corpurile',
  'workbench.docs.body.variables.staticWord': 'statice',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'participă la substituția',
  'workbench.docs.body.variables.dynamicNote1Suffix': '.',
  'workbench.docs.body.variables.requestsHeading': 'Variabile în cereri',
  'workbench.docs.body.variables.requests1Prefix':
    'În clientul API, adresa URL, parametrii de interogare, antetele, câmpurile de autentificare și corpul se rezolvă toate la Trimitere — inclusiv variabilele de colecție ale colecției în care se află cererea. O referință care nu poate fi rezolvată blochează trimiterea cu o eroare care numește variabila lipsă, în loc să pună literalul',
  'workbench.docs.body.variables.requests1Suffix': 'pe fir.',
  'workbench.docs.body.variables.workflowsHeading': 'Variabile în fluxuri de lucru',
  'workbench.docs.body.variables.workflows1Prefix':
    'Fiecare pas de flux de lucru Live se rezolvă ca o cerere, plus o sferă suplimentară:',
  'workbench.docs.body.variables.workflows1Suffix':
    'face referire la o valoare capturată de un pas anterior din aceeași rulare — autentificați-vă cu pasul 1, folosiți tokenul de sesiune în pasul 2. Referințele la pași există doar cât timp lanțul se execută; capturile marcate ca expuse sunt cele care se publică drept variabile Live când rularea reușește.',
  'workbench.docs.body.variables.namespacesHeading': 'Ajutoare doar cu spațiu de nume',
  'workbench.docs.body.variables.helpers1':
    'Alte trei spații de nume rezolvă valori care nu sunt deloc variabile stocate.',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'rulează un generator încorporat —',
  'workbench.docs.body.variables.helpersFriends':
    ' și celelalte — producând o valoare proaspătă la fiecare rezolvare: per trimitere în clientul API, per compilare pentru regulile statice (valoarea rămâne fixată până la următoarea recompilare).',
  'workbench.docs.body.variables.helpersFileMiddle': 'face referire la un fișier stocat, după nume. Iar',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', de mai sus, are sens doar în interiorul unui lanț de flux de lucru în execuție. Niciunul nu intră în parcurgerea fără prefix — sunt accesibile doar prin prefixul lor.',
  'workbench.docs.body.variables.inspectingHeading': 'Creare și inspectare',
  'workbench.docs.body.variables.create1Prefix': 'Fiecare sferă se creează din bara laterală:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Variabile de spațiu de lucru',
  'workbench.docs.body.variables.createAnd': ' și',
  'workbench.docs.body.variables.sidebarLiveVars': 'Variabile Live',
  'workbench.docs.body.variables.create1Middle': 'sunt intrări de nivel superior; mediile se adaugă la',
  'workbench.docs.body.variables.sidebarEnvironments': 'Medii',
  'workbench.docs.body.variables.create1Middle2': '; iar fiecare colecție are propria pagină',
  'workbench.docs.body.variables.sidebarVariables': 'Variabile',
  'workbench.docs.body.variables.create1Suffix': '.',
  'workbench.docs.body.variables.creationMapCaption':
    'Fiecare loc al variabilelor din bara laterală, adnotat cu spațiul de nume pe care îl alimentează.',
  'workbench.docs.body.variables.inspect1Prefix': 'Fereastra de instrumente',
  'workbench.docs.body.variables.inspect1Middle': 'este suprafața de inspectare.',
  'workbench.docs.body.variables.inScopeLabel': 'În sferă',
  'workbench.docs.body.variables.inspect1Middle2':
    'listează variabilele la care regula, cererea sau șablonul focalizat face efectiv referire — fiecare rezolvată prin întreaga scară, ca să vedeți valoarea exactă care se va aplica.',
  'workbench.docs.body.variables.allScopesLabel': 'Toate sferele',
  'workbench.docs.body.variables.inspect1Middle3':
    'listează tot ce este definit oriunde, grupat după prioritate. În orice câmp șablonabil, tastarea',
  'workbench.docs.body.variables.inspect1Suffix':
    'deschide sugeratorul cu fiecare nume rezolvabil, iar trecerea cursorului peste o referință afișează valoarea rezolvată și sfera câștigătoare.',
} as const satisfies Catalog;
