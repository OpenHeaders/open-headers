/**
 * Workbench Docs panel — SVG diagram labels — Romanian. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key; register per
 * the `ro/shared.ts` header. Vocabulary is QUOTED from the shipped ro
 * files, never re-minted: the sidebar entries (Reguli / Cereri / Medii
 * / Colecții / Fluxuri de lucru / Șabloane / Vault / Variabile de
 * spațiu de lucru / Variabile Live / Interceptor de browser / Cereri
 * API), every condition name in its rule-editor form (Domeniile
 * cererii / Excludere domenii / Domeniile inițiatorului / Metode /
 * Tipuri de resurse / Tip de domeniu / Antet de răspuns — the docs
 * section Antete de răspuns / Model URL / Regex URL), the header ops
 * (Adăugare / Înlocuire, Adăugare la sfârșit, Eliminare, Îmbinare,
 * Doar înlocuire, Eliminare toate; Suprascriere = the Override op
 * noun), the rule types (Blocare / Redirecționare / Injectare /
 * Întârziere / Parametri de interogare / Corpul cererii / Modificarea
 * răspunsului — the docs nav), the action categories (Modificarea
 * cererilor / Modificarea răspunsurilor / Rularea codului — the docs
 * nav groups, singular in the category cards), the inject timings
 * (Cât mai curând posibil / După încărcarea paginii — cut to După
 * încărcare for the timing box), the popup tab („Această pagină”),
 * the six subsystem pills (Sincronizare / Reguli / Cereri / Permisiuni
 * / Secrete / Live), the debug-mode labels (Modul Depanare / Starea
 * sistemului / Ambele / Includere această filă de browser / Filele
 * atașate / modul standard / a revenit la euristică), the docs nouns
 * (referință fără prefix / parcurgere / scară / umbrită / sferă /
 * ratare / Static / dinamic / direct / indirect / ecran de așteptare /
 * bandă / fixtură / monkey-patch / pastilă / subsistem / rezumat /
 * limită / trezire / hidratare / deviere / text cifrat / executor /
 * cadență / proaspăt / învechit / în eșec / declanșare), the keyboard
 * regions in short register (Bară stângă / Editor / Bară dreaptă /
 * Bară de jos — the fr Barre gauche precedent). Kickers translate
 * under caps (REGULĂ / ÎNAINTE / DUPĂ / CÂND NU SE DECLANȘEAZĂ /
 * CONDIȚII / ACȚIUNE / CAPTURAT / LEGENDĂ). MINTS: OCOL = DETOUR beside
 * INLINE raw (the vsProxy stamps); convergență = convergence (aria
 * only); operație nulă = no-op; blob carried; cu întreruperi =
 * faltering; capcană = gotcha; scurtcircuitată = short-circuited;
 * servit = served (the synthetic response); înlocuitor = stub;
 * hyperscaleri / Din UE / Enterprise = the platform groups; VM raw.
 * Raw per ja / ko / ru: DNR / Script / Popup / Workbench / DevTools as
 * plane and surface names, Chrome ResourceType names, `Vault` as the
 * box label and lowercase `vault` wherever en is, `Params` beside
 * Autorizare / Antete / Corp / Scripturi / Setări for the twin tabs,
 * the HTTP reason phrases, `popup` raw in the 56px glyph, Production /
 * Staging / Payments API / Billing API as sample names, every wire
 * mirror verbatim; the ECHIPA PLĂȚI workspace header follows the fr
 * ÉQUIPE PAIEMENTS precedent. The real wire string in `footerPaused`
 * copies the ro docs body (raw). Sandwich fragments open with a head
 * noun after a raw chip and keep their en edge spaces (render sites
 * checked: `conditions/*.tsx`, `multi-tab/navigation.tsx`,
 * `system-status/vault.tsx`, `open-headers/paradigm-field-sync.tsx`,
 * `paradigm-local-first.tsx`). Width: Romanian runs ~20% longer than
 * en — labels take the shortest correct form (`popup` raw in the 56px
 * glyph, Mediu beside the fr Env).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: resolution ladder ────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    'O referință de variabilă fără prefix se rezolvă prin vault, mediu, colecție, apoi spațiul de lucru — câștigă prima potrivire. ' +
    'Live, pas, fișier și dinamic sunt accesibile doar prin prefixul spațiului de nume.',
  'workbench.docs.diagrams.variables.ladder.title': 'Referință fără prefix — câștigă prima sferă care o definește',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'secrete · doar acest dispozitiv',
  'workbench.docs.diagrams.variables.ladder.environment': 'Mediu',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'activ, apoi implicit',
  'workbench.docs.diagrams.variables.ladder.collection': 'Colecție',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'doar colecția activă',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Spațiu de lucru',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'partajat cu toți',
  'workbench.docs.diagrams.variables.ladder.miss': 'ratare',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'DOAR SPAȚIU DE NUME',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'accesibile doar prin prefix —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'niciodată în parcurgerea fără prefix',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — prefixul fixează o singură sferă.',

  // ── Variables: creation map ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Harta barei laterale — variabilele colecției trăiesc pe colecție, mediile sub „Medii”, iar Vault, ' +
    '„Variabile de spațiu de lucru” și „Variabile Live” sunt intrări de nivel superior în bara laterală',
  'workbench.docs.diagrams.variables.creation.title': 'Unde se creează fiecare sferă',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'ECHIPA PLĂȚI',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Colecții',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments API',
  'workbench.docs.diagrams.variables.creation.variables': 'Variabile',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Medii',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'Variabile de spațiu de lucru',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Variabile Live',
  'workbench.docs.diagrams.variables.creation.footer1': 'Colecțiile au propria pagină „Variabile”;',
  'workbench.docs.diagrams.variables.creation.footer2': 'tot restul sunt intrări în bara laterală.',

  // ── Variables: shadowing ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host definită atât în mediu, cât și în spațiul de lucru — referința fără prefix se rezolvă la valoarea mediului; ' +
    'forma cu spațiu de nume citește în continuare valoarea spațiului de lucru',
  'workbench.docs.diagrams.variables.shadowing.title': 'Același nume în două sfere — câștigă cea de sus',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ câștigă',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'umbrită',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Mediu · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Spațiu de lucru',
  'workbench.docs.diagrams.variables.shadowing.footer': 'Prefixul sare peste scară și citește direct o singură sferă.',

  // ── Variables: live lifecycle ───────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Un flux de lucru Live își rulează pașii, publică captura expusă ca variabilă Live, iar regulile și cererile ' +
    'o consumă; reîmprospătarea automată rulează din nou fluxul de lucru',
  'workbench.docs.diagrams.variables.live.title': 'O rulare reușită publică valoarea',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Flux de lucru Live',
  'workbench.docs.diagrams.variables.live.step1': 'Pasul 1 · autentificare',
  'workbench.docs.diagrams.variables.live.step2': 'Pasul 2 · obținere token',
  'workbench.docs.diagrams.variables.live.expose': 'expunere: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': 'rularea reușește',
  'workbench.docs.diagrams.variables.live.publishes': 'publică',
  'workbench.docs.diagrams.variables.live.rules': 'Reguli',
  'workbench.docs.diagrams.variables.live.requests': 'Cereri',
  'workbench.docs.diagrams.variables.live.autoRefresh': 'reîmprospătarea automată o rulează din nou',
  'workbench.docs.diagrams.variables.live.footer1': 'Salvarea activează fluxul de lucru — valoarea apare doar după',
  'workbench.docs.diagrams.variables.live.footer2':
    'o rulare reușită și se reîmprospătează după programul fluxului de lucru.',

  // ── Variables: consumers ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'O singură valoare șablonată — Authorization: Bearer token — consumată de reguli, cereri și fluxuri de lucru',
  'workbench.docs.diagrams.variables.consumers.title': 'Definiți o dată, referiți peste tot',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Reguli',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'antete, redirecționare,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'corpuri, injectare',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'când se aplică o regulă',
  'workbench.docs.diagrams.variables.consumers.requests': 'Cereri',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, parametri,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'antete, autorizare, corp',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': 'la Trimitere',
  'workbench.docs.diagrams.variables.consumers.workflows': 'Fluxuri de lucru',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'fiecare pas,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'capturi înlănțuite',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'per rulare',
  'workbench.docs.diagrams.variables.consumers.footer1':
    'Valorile se substituie la momentul folosirii — modificați variabila o dată,',
  'workbench.docs.diagrams.variables.consumers.footer2': 'și fiecare regulă, cerere și flux de lucru o preia.',

  // ── Variables: per-scope references ─────────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'Nu așa:',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: referiți secretele din entitățile sincronizate prin șabloane vault; nu lipiți niciodată chei brute în reguli sau ' +
    'variabile de spațiu de lucru',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — secrete care nu părăsesc niciodată acest dispozitiv',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'rezolvat local',
  'workbench.docs.diagrams.variables.refs.vault.good1Note':
    'regulă sincronizată — se completează cheia proprie a fiecărui coleg',
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'intrare TOTP — rezolvă codul curent, niciodată seed-ul',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'intrările din vault rămân în afara sincronizării, exporturilor și git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… într-o regulă',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason':
    'textul în clar lipit se sincronizează în tot spațiul de lucru',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'api_key ca variabilă de spațiu de lucru',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason': 'se sincronizează și ea — vault este singura sferă locală',
  'workbench.docs.diagrams.variables.refs.vault.footer1':
    'Vault este deasupra oricărei sfere — un {{api_key}} fără prefix',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'alege mereu valoarea din vault când există una.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Mediu: un nume de variabilă se rezolvă la o valoare diferită per etapă; comutați mediile în loc să ' +
    'duplicați regulile și păstrați secretele în vault',
  'workbench.docs.diagrams.variables.refs.environment.title': 'Mediu — un nume, o valoare per etapă',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Medii · staging (activ)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'câștigă mediul activ',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'cât timp staging este activ',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': 'comutați mediul — aceleași reguli, zero modificări',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote': 'o ratare revine mai întâi la mediul implicit',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'cheie sk-live tastată în production',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason': 'mediile se sincronizează — secretele țin de Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'o copie staging a fiecărei reguli',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason': 'nu duplicați regulile per etapă — comutați mediul',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    'Aceeași valoare în fiecare etapă? Folosiți Spațiu de lucru.',
  'workbench.docs.diagrams.variables.refs.environment.footer2':
    'Secret per utilizator? Vault este deasupra oricărui mediu.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Colecție: variabilele se rezolvă doar pentru regulile și cererile din colecția lor; mutați valorile valabile în tot ' +
    'spațiul de lucru în sfera spațiului de lucru',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Colecție — sfera unui singur API',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments API · Variabile',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'se rezolvă în Payments API',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'cerere din colecția Payments API',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'regulă din colecția Payments API',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': 'Nu se rezolvă:',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': '{{base_url}} în Billing API',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'altă colecție — definiți-o acolo',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} într-o regulă fără colecție',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason':
    'fără colecție → referința trece pe lângă această sferă',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    'Necesară în fiecare colecție? Mutați-o în Spațiu de lucru.',
  'workbench.docs.diagrams.variables.refs.collection.footer2': 'O variabilă de mediu cu același nume este deasupra ei.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'Spațiu de lucru: variabilele sale se rezolvă peste tot și au rangul cel mai mic; păstrați secretele în vault și ' +
    'valorile per etapă în medii',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Spațiu de lucru — stratul de bază partajat',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'Variabile de spațiu de lucru',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'se rezolvă peste tot',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': 'regulă de antet — orice colecție, orice mediu',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'adresa URL a cererii',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note':
    'fixată — chiar și când o sferă superioară umbrește numele',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason': 'sincronizată cu toți — păstrați secretele în Vault',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': 'diferă per etapă — definiți-o în fiecare Mediu',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    'Secret? Folosiți Vault. Diferit per etapă? Folosiți Mediu.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2':
    'Spațiul de lucru este pentru valori adevărate peste tot.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live: referiți valorile publicate de fluxuri de lucru cu prefixul live; o referință fără prefix nu se rezolvă niciodată la Live, iar ' +
    'tokenurile lipite manual se învechesc',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — produsă de o rulare a fluxului de lucru',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Variabile Live · fluxul de lucru de autentificare OAuth',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'publicată de ultima rulare',
  'workbench.docs.diagrams.variables.refs.live.good1Note': 'regulă de antet care nu se învechește niciodată',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} în cereri și fluxuri de lucru',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'mereu ultima valoare publicată',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — fără prefix',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    'live nu intră niciodată în parcurgerea fără prefix — scrieți {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': 'un token lipit într-o variabilă de mediu',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'expiră în tăcere — susțineți-l cu un flux de lucru',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'Ați modificat fluxul de lucru? Valoarea apare învechită —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'doar următoarea rulare reușită o republică.',

  // ── Multi-tab: side-by-side sync overview ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    'Două file de spațiu de lucru deschise una lângă alta — spații de lucru diferite sau aspecte diferite, lucrând în paralel',
  'workbench.docs.diagrams.multiTab.sync.title': 'Două file, două contexte — în același timp',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Reguli',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Cereri',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Mediu',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': 'Antet Auth',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'Ocolire CORS',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Blocare reclame',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Editor de reguli',
  'workbench.docs.diagrams.multiTab.sync.envEditor': 'Editor de medii',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Regulile + colecțiile se sincronizează prin stocare.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Fiecare filă își păstrează spațiul de lucru + aspectul.',

  // ── Multi-tab: ordinal numbering timeline ───────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    'Cronologia numerotării filelor — ordinalele sunt stabile pe durata de viață a unei file; închiderea #1 nu renumerotează, ' +
    'următoarea filă primește #4',
  'workbench.docs.diagrams.multiTab.numbering.title': 'Ordinalele rămân stabile pe durata de viață a filei',
  'workbench.docs.diagrams.multiTab.numbering.step1': '1 filă deschisă',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'fără prefix',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'deschideți alta',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'apar prefixele',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'deschideți a treia',
  'workbench.docs.diagrams.multiTab.numbering.step4': 'închideți #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 neschimbate',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'deschideți încă una',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'urmează #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    'Numerotarea se resetează la #1 doar după ce s-au închis toate filele spațiului de lucru.',

  // ── Multi-tab: navigation reuse ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'Reutilizarea navigării — mai întâi aceeași fereastră. Sus: aceeași fereastră are o filă de spațiu de lucru, clicul o activează. Jos: ' +
    'doar altă fereastră are o filă de spațiu de lucru, una nouă se deschide în fereastra apelantului.',
  'workbench.docs.diagrams.multiTab.navigation.title': 'Clic pe „editare regulă” în fereastra popup —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle':
    'fereastra popup caută mai întâi o filă de spațiu de lucru în fereastra DVS.',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'Aceeași fereastră',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '— există deja o filă a spațiului de lucru',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Fereastra 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Fereastra 1 (apelant)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Fereastra 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'editare regulă ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': 'fila existentă se activează · nicio filă nouă',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Altă fereastră',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '— fereastra dvs. nu are niciuna',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ filă nouă',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'neatinsă · fără furt de focalizare',
  'workbench.docs.diagrams.multiTab.navigation.footer1':
    'La fel cum fereastra DevTools a browserului Chrome se andochează per fereastră —',
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'rămâneți în fereastra în care erați deja.',

  // ── Multi-tab: what syncs (shared pool) ─────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'Ce se sincronizează între file — chrome.storage păstrează regulile, colecțiile, folderele, mediile, variabilele, vault, ' +
    'cererile, șabloanele. Ambele file citesc și scriu prin el.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Se sincronizează între file',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'fiecare filă citește și scrie același chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'sursă unică de adevăr',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'reguli',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'colecții',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'foldere',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'medii',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'variabile',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'cereri',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'șabloane',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Fila #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Fila #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'date în timp real',
  'workbench.docs.diagrams.multiTab.synced.footer': 'Salvați în oricare filă — cealaltă se rehidratează instant.',

  // ── Multi-tab: what stays local ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'Ce rămâne în fiecare filă — raportul separatorului de aspect și ciornele nesalvate. Două file diferă vizibil: împărțiri 25/75 față de 65/35, ' +
    'una cu o ciornă și una fără.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Rămâne în fiecare filă',
  'workbench.docs.diagrams.multiTab.local.subtitle':
    'raportul separatorului + tastarea nesalvată — private acolo unde le-ați făcut',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Fila {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'aspect',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'ciornă nesalvată',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● nesalvat',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'nicio modificare nesalvată',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Fiecare filă își păstrează separatorul + ciorna.',
  'workbench.docs.diagrams.multiTab.local.footer2': 'O filă deschisă DUPĂ tragerea dvs. moștenește noul aspect.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'REGULĂ',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'ÎNAINTE',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'DUPĂ',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': 'CÂND NU SE DECLANȘEAZĂ',
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Sfat',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Patru operații pe antete aplicate aceluiași antet de pornire — Suprascriere înlocuiește, Adăugare la sfârșit adaugă un duplicat, Eliminare ' +
    'șterge, Îmbinare concatenează.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Același antet de pornire → patru rezultate',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Suprascriere',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Adăugare la sfârșit',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Eliminare',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Îmbinare',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(antet dispărut)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — nativ, aplicat de Chrome',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script — fetch / XHR cu patch (doar Îmbinare)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    'Adăugare / Înlocuire — aceeași regulă acoperă ambele cazuri. Înlocuiește valoarea unui antet X-Auth existent sau adaugă antetul când ' +
    'lipsește. Ambele ajung la același rezultat.',
  'workbench.docs.diagrams.headerActions.override.rule': 'Suprascriere X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Înlocuire',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Adăugare',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'antet deja prezent',
  'workbench.docs.diagrams.headerActions.override.addSub': 'încă niciun antet X-Auth',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(fără X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'valoare înlocuită',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'antet adăugat',
  'workbench.docs.diagrams.headerActions.override.stamp': 'Oricum → un singur antet X-Auth cu valoarea dvs.',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    'Adăugare / Înlocuire nu se aplică atunci când condițiile regulii nu se potrivesc cu cererea — este o operație nulă, în tăcere. Sugestie: ' +
    'verificați condițiile Domeniile cererii sau Model URL.',
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Cerere către un domeniu care nu se potrivește',
  'workbench.docs.diagrams.headerActions.override.wontDetail':
    'Condițiile păzesc acțiunea — fără potrivire, operație nulă.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    'Verificați condițiile Domeniile cererii sau Model URL ale regulii.',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    'Adăugare la sfârșit adaugă un al doilea rând de antet cu același nume — ambele livrate. ÎNAINTE are un rând Set-Cookie; DUPĂ are ' +
    'două, cel nou evidențiat.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Adăugare la sfârșit Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 rând duplicat',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Două rânduri Set-Cookie — ambele livrate.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Folosiți pentru Set-Cookie, Link, Via — antete care permit duplicate.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    'Adăugare la sfârșit nu se aplică curat antetelor care nu acceptă duplicate — browserul păstrează doar unul. Folosiți Suprascriere ' +
    'pentru a înlocui sau Îmbinare pentru a concatena.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': 'Antete care nu permit duplicate',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    'de ex. Authorization, Host, Content-Type — browserul păstrează doar unul.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': 'Folosiți Suprascriere pentru a înlocui valoarea.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2':
    'Folosiți Îmbinare pentru a adăuga la valoarea existentă.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    'Eliminare șterge antetul vizat. ÎNAINTE arată X-Frame-Options tăiat; DUPĂ arată doar antetul ' +
    'Content-Type supraviețuitor.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Eliminare X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'țintă eliminată',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'Toate instanțele X-Frame-Options șterse.',
  'workbench.docs.diagrams.headerActions.remove.stamp2':
    'Rândurile duplicate ale aceluiași antet sunt eliminate toate deodată.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    'Eliminare este o operație nulă când antetul vizat nu este prezent — nu apare nicio eroare. Folosiți Suprascriere dacă voiați să setați o ' +
    'altă valoare.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'Antet deja absent',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'Operație nulă — fără eroare, cererea trece pur și simplu neschimbată.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Folosiți Suprascriere dacă voiați să setați valoarea, nu să o eliminați.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'Îmbinare citește valoarea existentă a antetului la rulare, unește valoarea dvs. cu un separator și înlocuiește originalul.',
  'workbench.docs.diagrams.headerActions.merge.rule': "Îmbinare Cookie + new=val  (separator: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'unire cu separator',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': 'Valoarea existentă + valoarea dvs., unite prin separator.',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "Separator implicit: '; ' pentru Cookie, ', ' pentru celelalte antete.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'Îmbinare interceptează doar fetch / XHR inițiate din JS — navigările de pagină și resursele statice trec neschimbate. ' +
    'Folosiți Suprascriere sau Adăugare la sfârșit (DNR) pentru acestea.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Navigări de pagină',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Doar fetch / XHR inițiate din JS trec prin motorul de scripturi.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Resurse statice (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': 'Emise de browser — nu ating niciodată fetch / XHR.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'Pentru antete la nivel de pagină, folosiți Suprascriere sau Adăugare la sfârșit (DNR).',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Regulă:',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Cereri de test:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Testat pe adresele URL:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'ÎNAINTE',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'DUPĂ',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'literal — potrivire exactă',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Folosiți în schimb condiția ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': '.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Domeniile cererii',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'Model URL',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Domeniile inițiatorului',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'Două adrese URL într-un singur fetch — adresa URL din bara de adrese este originea (Domeniile inițiatorului); adresa URL de destinație a fetch este ' +
    'gazda (Domeniile cererii)',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Două adrese URL, două condiții',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'JS din această pagină face:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Același fetch — două adrese URL diferite.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ' — adresa URL a paginii → verificată de ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — destinația fetch → verificată de ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Fiecare condiție verifică un atribut al cererii — pastilele colorate din dreapta numesc tipul de condiție care ' +
    'verifică atributul fiecărui rând. Toate condițiile se combină prin AND.',
  'workbench.docs.diagrams.conditions.matching.title': 'Fiecare condiție verifică un atribut al cererii',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'ATRIBUTUL CERERII',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'VERIFICAT DE',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'metodă:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'gazdă:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'origine:',
  'workbench.docs.diagrams.conditions.matching.attrType': 'tip:',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'parte:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'antet:',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Metode',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'Model URL',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Domeniile cererii',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Domeniile inițiatorului',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Tipuri de resurse',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Tip de domeniu',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Antete de răspuns',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'Toate trebuie să se potrivească (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ regula se declanșează',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'Când toate condițiile se potrivesc, regula se declanșează — antetul Authorization este înlocuit înainte ca cererea să părăsească ' +
    'browserul',
  'workbench.docs.diagrams.conditions.ruleFires.title':
    'Condițiile se potrivesc → regula se declanșează → cererea se schimbă',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Suprascriere',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'regula',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'se declanșează',
  'workbench.docs.diagrams.conditions.ruleFires.footer': 'Regula schimbă doar ținta ei — restul trece neatins.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Domeniile cererii: o intrare include automat domeniul rădăcină plus fiecare subdomeniu, pe orice cale sau interogare',
  'workbench.docs.diagrams.conditions.requestDomains.title':
    'Domeniile cererii — o intrare, toate subdomeniile, orice cale',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'include automat',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'potrivire doar pe gazdă — orice cale sau șir de interogare se califică',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': 'Nu se potrivește:',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'alt TLD (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'nu este un subdomeniu real — fără punct înainte de „openheaders.com”',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix':
    'Trebuie să restrângeți după cale? Adăugați regulii condiția ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': '.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    'Mai multe domenii? Adăugați fiecare domeniu ca intrare separată.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    'Excludere domenii scade gazde din potrivirile altei condiții; nu potrivește nimic de una singură',
  'workbench.docs.diagrams.conditions.excludeDomains.title': 'Excludere domenii — scade din altă condiție',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': 'Scade din potrivirile altei condiții',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ DOMENIILE CERERII',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− EXCLUDERE DOMENII',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Gazde potrivite în final:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'exclus',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    'exclus — regula subdomeniilor se aplică și la Excludere',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Excluderea singură nu potrivește nimic.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': 'Doar scade din potrivirile altei condiții.',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Domeniile inițiatorului: aceeași destinație, origini de pagină diferite, rezultate opuse',
  'workbench.docs.diagrams.conditions.initiatorDomains.title':
    'Domeniile inițiatorului — potrivire după pagina care a făcut apelul',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle':
    'Același fetch, două contexte de pagină → rezultate diferite',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Domeniile inițiatorului: portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'PAGINĂ DESCHISĂ',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ face fetch',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ SE POTRIVEȘTE',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ FĂRĂ POTRIVIRE',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'inițiator =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': 'Vreți potrivire după destinație, nu după origine?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Metode — selecție multiplă de verbe HTTP; doar metodele selectate (portocalii) se potrivesc',
  'workbench.docs.diagrams.conditions.methods.title': 'Metode — alegeți ce verbe HTTP se potrivesc',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    'Selecție multiplă — metodele portocalii se potrivesc; restul nu declanșează regula',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'metoda nu este în lista selectată',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'Vreți să potriviți orice metodă?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Eliminați această condiție — implicit sunt toate metodele.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Tipuri de resurse — selecție multiplă de tipuri de cereri; tipurile selectate (violet) se potrivesc, celelalte sunt sărite',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Tipuri de resurse — selecție multiplă de tipuri de cereri',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle':
    'Tipurile violet se potrivesc; restul nu declanșează regula',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'vizită /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'pagină',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'imagine — sărită',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script — sărit',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'Vreți să potriviți orice tip de resursă?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA':
    'Eliminați această condiție — implicit sunt toate tipurile.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Tip de domeniu — fiecare cerere este clasificată primar (același domeniu înregistrabil) sau terț; selecția ' +
    'regulii decide ce tip se potrivește',
  'workbench.docs.diagrams.conditions.domainType.title': 'Tip de domeniu — primar față de terț',
  'workbench.docs.diagrams.conditions.domainType.subtitle':
    'Clasificat după relația dintre pagină și adresa URL a cererii',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Pagină:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Selecția regulii:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'DESTINAȚIE',
  'workbench.docs.diagrams.conditions.domainType.colType': 'TIP',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'POTRIVIRE',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'primar',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'terț',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': 'Vreți ambele? Selectați firstParty ȘI thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'Sau eliminați condiția — implicit sunt ambele.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Condiția Antete de răspuns — nume exact plus valoare exactă, doar pe partea de răspuns (Chrome DNR nu potrivește ' +
    'antetele de cerere)',
  'workbench.docs.diagrams.conditions.headers.title': 'Antete de răspuns — nume exact + valoare exactă',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    'Doar pe răspuns — Chrome DNR nu potrivește antetele de cerere',
  'workbench.docs.diagrams.conditions.headers.exactName': 'nume exact',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'valoare exactă',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'Antete de răspuns de test:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'numele se potrivește, dar valoarea diferă',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'alt nume de antet',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(răspuns fără Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent':
    'antet absent — trebuie să fie prezent ca să se potrivească',
  'workbench.docs.diagrams.conditions.headers.footer':
    'Utilizare frecventă: filtrarea regulilor după Content-Type al răspunsului sau indicatoare personalizate',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'Model URL folosește metacaractere pe adresa URL completă — anatomia modelului plus exemple cu și fără potrivire',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'Model URL — metacaractere (*) pe adresa URL completă',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'orice',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'protocol',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'gazdă literală',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(fără metacaractere)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'orice cale',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ șir de interogare',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'metacaracter — potrivește orice',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '„cdn” ≠ „api” — nepotrivire de subdomeniu',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'cu totul altă gazdă',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'Trebuie să potriviți toate subdomeniile deodată?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Domeniile cererii: openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'Anatomia Regex URL plus exemple cu și fără potrivire — părțile violet sunt regex real; restul este literal',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'Regex URL — regex RE2 pe adresa URL completă',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'început',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'ancoră',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'caractere literale',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. potrivește caracterul .)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'una sau mai multe',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'cifre',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'sintaxă regex — sens special',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': 'regexul specifică https:// — http nu se potrivește',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '„latest” nu se potrivește cu /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'Vreți atât http, cât și https?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Folosiți ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — semnul ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' face s opțional.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    'Anatomia unei reguli — o cerere HTTP de ieșire este comparată cu condițiile regulii unite prin AND; dacă toate se potrivesc, ' +
    'acțiunea modifică cererea înainte să părăsească browserul.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'O regulă = Condiții + Acțiune',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    'Condițiile decid dacă regula se declanșează. Acțiunea decide ce se schimbă.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Cerere de ieșire',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'înainte',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'după',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'ADĂUGAT',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'verificare',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'aplicare',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Regulă',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'entitate din editor',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'CONDIȚII',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'ACȚIUNE',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Metode',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Domeniile cererii',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Antete de răspuns',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'TOATE TREBUIE SĂ SE POTRIVEASCĂ (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'una per regulă',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'Acțiune pe antet · Adăugare',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'categorie: Modificarea cererii',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Condițiile filtrează',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'acțiunea transformă',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'cererea pleacă modificată',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Taxonomia acțiunilor — trei categorii (Modificarea cererii, Modificarea răspunsului, Rularea codului) listând fiecare acțiune cu ' +
    'motorul ei de execuție (DNR sau Script).',
  'workbench.docs.diagrams.actions.taxonomy.title': 'Acțiuni — pe categorii',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'Fiecare acțiune aparține uneia dintre cele trei categorii. Eticheta motorului vă spune unde se execută.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Modificarea cererii',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'înainte să părăsească browserul',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Modificarea răspunsului',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'înainte să-l vadă pagina',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Rularea codului',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'în pagină sau în planificatorul ei',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'Acțiuni pe antete',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': 'Adăugare · Adăugare la sfârșit · Eliminare · Îmbinare',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Blocare',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'anulare la nivelul rețelei',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Redirecționare',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'adresă URL statică sau regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Parametri de interogare',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'adăugare · înlocuire · eliminare',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Corpul cererii',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'static · dinamic · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'antete pe partea de răspuns',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Corpul răspunsului',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'corp simulat · stare · antete',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'Injectare JS / CSS',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'înaintea scripturilor paginii sau după DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Întârziere',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'navigări + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict':
    'Alegeți o categorie · alegeți o acțiune · împerecheați-o cu condiții',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Sincronizare',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Reguli',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Cereri',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Permisiuni',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Secrete',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'Starea sistemului',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'Niciun eveniment încă',
  'workbench.docs.diagrams.systemStatus.shared.green': 'verde',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'galben',
  'workbench.docs.diagrams.systemStatus.shared.red': 'roșu',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'Aplicația desktop',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'trezire SW',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'Suprafața Workbench — fila Workbench a OpenHeaders. Rândul de stare stă în subsolul de jos, cu o pastilă ' +
    'per subsistem.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'Workbench: rândul de stare în subsol',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ șase pastile — una per subsistem, clic pe oricare deschide popover-ul.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    'Suprafața popup — fereastra popup a extensiei atârnă de pictograma din bara de instrumente. Pastila de stare stă în subsolul ' +
    'ferestrei popup ca un punct plus eticheta „Starea sistemului”.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'Popup: pastila Starea sistemului în subsol',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ punctul + eticheta „Starea sistemului” stau în banda de subsol a ferestrei popup.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Agregatorul celei mai rele stări — șase stări de subsistem se varsă într-un singur punct compozit. Câștigă cea mai rea culoare: roșul bate ' +
    'galbenul, care bate verdele.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'Câștigă cea mai rea culoare',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'roșu > galben > verde · gri = niciun eveniment încă (tratat ca verde)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'conectat',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': 'active: 12',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'niciun eveniment încă',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'gazdă restrânsă',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'decriptare',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': 'proaspete: 3',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'compozit',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'punct',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'Un roșu oriunde → compozitul este roșu. Conduce punctul din popup / panoul lateral.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'Aspectul popover-ului de stare — rândurile gri ale subsistemelor fără evenimente apar deasupra rândurilor colorate ale subsistemelor ' +
    'care au raportat.',
  'workbench.docs.diagrams.systemStatus.popover.title': 'Ordinea în popover: întâi gri, apoi colorate',
  'workbench.docs.diagrams.systemStatus.popover.subtitle':
    'În fiecare nivel se păstrează ordinea canonică a subsistemelor',
  'workbench.docs.diagrams.systemStatus.popover.header': '● Starea sistemului',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Conectat',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': 'Reguli active: 12',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Gazde restrânse',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Decriptarea textului cifrat a eșuat',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ niciun eveniment încă · ↓ au raportat',
  'workbench.docs.diagrams.systemStatus.popover.footer':
    'La primul raport, un rând migrează o singură dată din gri → colorat.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    'Topologia sincronizării — service worker-ul extensiei ține o singură conexiune WebSocket către aplicația desktop pe 127.0.0.1:8137, ' +
    'schimbând spații de lucru, variabile și date de sincronizare de echipă.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'Cum se conectează subsistemul Sincronizare',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Extensie',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'service worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'client WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'pe mașina dvs.',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'server WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries':
    'Transportă: variabile dinamice · spații de lucru · sincronizare de echipă',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'Doar loopback — nu părăsește niciodată mașina dvs.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'Ciclul de viață al conexiunii de sincronizare ca diagramă de secvență — service worker-ul extensiei se conectează la aplicația desktop, ' +
    'pastila de stare trece din verde în galben și înapoi în verde în timp',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': 'Cum se schimbă pastila Sincronizare în timp',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'SW extensie',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Pastila Sincronizare',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'citește setările',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'dacă conectarea automată = oprită →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Dezactivat',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Se conectează',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Conectat',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Reîncercare #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Reîncercare #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'altfel →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'conectare WebSocket',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'handshake OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ conexiunea cade',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'backoff',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'reîncercare conectare',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Backoff exponențial între reîncercări · ping-urile detectează căderile silențioase ale proxy-ului',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Conducta regulilor — regula utilizatorului se compilează, rezolvă variabilele, trece verificarea plafonului, apoi Chrome o aplică. Fiecare ' +
    'etapă poate emite un nivel de Stare dacă ceva merge prost.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'Cum devine o regulă o intrare DNR activă',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Regula dvs.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Compilare',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': 'Rezolvare {{VAR}}',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Verificare plafon',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Aplicare Chrome',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Regulă activă',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'în DNR JSON',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · workspace',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'potrivește cererile',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'nerezolvat → galben',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'peste plafon → galben',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'respins → roșu',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'active: N → verde',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild':
    'Reconstruirea se declanșează la fiecare salvare.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused': 'În pauză rămâne verde („Rule execution paused”).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'Bara de capacitate DNR — verde până la pragul de avertizare, galben până la plafonul de trunchiere, roșu dincolo. Regulile ' +
    'peste plafon sunt eliminate, așa că zona roșie nu este atinsă niciodată la rulare.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title':
    'Capacitatea regulilor — unde ajunge fiecare număr de reguli',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ sănătos',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'apropiere',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'trunchiat',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'prag',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'plafon',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    'Regulile peste plafon sunt eliminate în ordinea potrivirii (cea de sus câștigă).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Plafonul dur al browserului Chrome stă mult mai departe, la 30,000.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'Rezultatele executorului de cereri — orice răspuns HTTP, inclusiv 4xx și 5xx, face pastila verde. Doar ' +
    'eșecurile la nivel de rețea, fără răspuns, o fac galbenă.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': 'Ce face pastila Cereri de ce culoare?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Editor de cereri',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Trimitere ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Executorul se declanșează',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ răspuns HTTP primit',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'orice cod de stare contează',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Not Found',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Server Error',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Anulată',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Offline / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Pastilă → verde',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Pastilă → galben',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ fără răspuns',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'eșec la nivel de rețea',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'Un 500 este tot „verde” — cererea s-a încheiat, doar că ați primit un 500.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'Sfera executorului de cereri — doar cererile din butonul Trimitere actualizează pastila. Reîmprospătările fluxurilor de lucru Live sunt silențioase; ' +
    'traficul paginilor web folosește motorul de reguli.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': 'Ce actualizează pastila Cereri?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'Trimitere ▸ în editorul de cereri',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Reîmprospătare flux de lucru Live',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'fetch / XHR din pagina web',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'inițiat de utilizator',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'tact în fundal',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'observat de motorul de reguli',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'actualizează pastila',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'alt sistem',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'fără actualizare',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'Doar traficul ad-hoc din butonul Trimitere modelează această pastilă.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    'Aceeași regulă, două stări de permisiuni. Cu all_urls acordat, regula DNR se declanșează. Cu gazda revocată, regula ' +
    'este o operație nulă silențioasă, iar antetul nu ajunge niciodată.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': 'Aceeași regulă, două stări de permisiuni',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Acordată',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Restrânsă',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'gazdă revocată',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Adăugare antet',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Pagină',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': 'se aplică',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'operație nulă',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ antetul ajunge',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ antetul lipsește',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'regula s-a declanșat',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'operație nulă silențioasă',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    'Gazdele restrânse nu dau eroare — regulile pur și simplu nu fac nimic, în tăcere.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    'Roșul pastilei este singurul indiciu până restaurați accesul.',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    'Când rulează auditul și ce nivel de Stare raportează fiecare rezultat.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title':
    'Când rulează auditul și ce raportează fiecare ramură?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'prima hidratare',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'calea fericită',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'utilizatorul a revocat o gazdă',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API indisponibil',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'aruncă excepție',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '„Toate acordate”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '„Gazde restrânse”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '„Audit eșuat”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1':
    'MV3 nu are un observator al schimbărilor de permisiuni —',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2':
    'reverificarea se declanșează la fiecare trezire a SW.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Hidratarea Vault — blob-ul vault se încarcă din stocare, fiecare intrare trece prin schemă. Potrivirile sunt păstrate; ' +
    'intrările deviate sunt eliminate și raportate ca galben.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Hidratarea Vault la trezirea SW',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (blob criptat)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Validator de schemă',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'corespunde schemei',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'deviere: formă veche',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ păstrată',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ eliminată',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Secrete · galben',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'intrările păstrate',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'se hidratează curat',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'Cum arată de fapt devierea de schemă — o intrare validă are uid, label și cipher; o intrare deviată poate să nu aibă ' +
    'câmpul cipher. Validatorul elimină rândul greșit și emite o stare galbenă.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'Cum arată de fapt „devierea de schemă”',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Intrare validă',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Intrare deviată',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'Token API',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'Token vechi',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— lipsă —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': 'probleme de schemă: 2 → eliminată',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'Intrările deviate sunt eliminate la hidratare, iar pastila devine galbenă.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Salvarea din nou din editorul Vault restaurează forma curentă a intrării.',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'Regulile per stare ale fluxurilor de lucru Live — proaspăt, învechit / cu întreruperi, în eșec — fixate la pragurile reale.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'Reguli de stare per flux de lucru',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'proaspăt',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'învechit / cu întreruperi',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'în eșec',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh': 'ultima rulare OK · sub 2× cadența · eșecuri: 0',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': 'peste 2× cadența  · SAU  eșecuri consecutive: 1–4',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': 'eșecuri consecutive: 5+',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'de ex. fiecare reîmprospătare primește 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'de ex. un timeout, se reîncearcă',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'de ex. API căzut de o oră',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer':
    'Cadența = intervalul de reîmprospătare configurat al fluxului de lucru.',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Agregarea pastilei Live — trei fluxuri de lucru ale spațiului de lucru activ se pliază într-un singur compozit prin max; fluxurile de lucru ' +
    'ale spațiilor de lucru inactive sunt excluse.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    'Fluxurile spațiului de lucru activ se pliază într-o pastilă',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Spațiu de lucru activ',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'contribuie la pastilă',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'proaspăt',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': 'eșecuri consecutive: 2',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Alte spații de lucru',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'excluse deliberat',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ utilizatorul nu poate acționa asupra lor — sărite',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Pastila Live',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = galben',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    'Un singur flux de lucru în starea cea mai rea răstoarnă întreaga pastilă.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    'Comutați spațiul de lucru și pastila se recalculează după rulările acelui spațiu de lucru.',

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'CEL MAI BUN DIN CLASĂ',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': 'ASTĂZI',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'FOAIE DE PARCURS',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'SUPORTĂ',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'În browser',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'Aplicația desktop',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Server local',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'VM-ul dvs.',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'în curând',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'Schimbarea de paradigmă — contraste grupate între Open Headers și orice alt instrument din domeniu. Totul într-o ' +
    'singură extensie de browser, fără cont, doar local, fără urmărire, un singur motor pentru nouă tipuri de reguli, sincronizare la nivel de câmp, ' +
    'un nivel gratuit complet fără funcții blocate, prețuri per loc și fără blocare la expirare — față de ' +
    'restul pieței.',
  'workbench.docs.diagrams.openHeaders.shift.title': 'SCHIMBAREA DE PARADIGMĂ',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Toți ceilalți',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Arhitectură și acoperire',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Confidențialitate și proprietate',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Capabilitate',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Sincronizare și reziliență',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Prețuri și încredere',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'UNIC',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'CONTROLAT DE UTILIZATOR',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'FĂRĂ FUNCȚII BLOCATE',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Totul în interiorul browserului',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'backend + frontend',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- în extensie',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Backend în afara browserului',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'aplicație desktop / cloud, necesită internet',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Găzduiți singuri backend-ul',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'browser · aplicație desktop · server · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Doar cloudul lor',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'nicio alegere unde stau datele dvs.',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Frontend nativ offline',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'extensie · desktop · CLI · web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Frontend doar în cloud (online)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'necesită internet pentru accesul la backend',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'Fără cont',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'fără autentificare, fără zid de conectare',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Autentificare obligatorie',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'ca să vă folosiți propriile date',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Doar local',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'fără releu în cloud',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Retransmis prin cloud',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'traficul dvs. trece prin ei',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'Fără urmărire',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'contoare anonime · un singur comutator de oprire',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Urmărire implicită',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': 'date de utilizare trimise acasă',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Motor de reguli',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'interceptare și modificare cereri',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'Fără motor în browser',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'necesită proxy sau aplicație separată',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'Catalog de cereri API',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — toate în browser',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Autentificare pe o platformă',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'și instalarea aplicației lor',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Automatizați-vă spațiul de lucru',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'agentul dvs. AI, local sau la distanță',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- dvs. decideți',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Doar privat sau AI-ul din cloudul lor',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'fără acces deschis sau programatic',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Motor de sincronizare în timp real',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'multi-dispozitiv, browser, suprafață',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Ultima scriere câștigă',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'sau deloc sincronizare',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Salvare concurentă fără conflicte',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'la nivel de câmp, toate modificările comise',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'Suprascriere la nivel de entitate',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': 'salvările se pot șterge reciproc',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Funcționează offline, complet editabil',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': 'se sincronizează automat când reveniți',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Necesită conexiune online',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'sau niciun acces',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': 'Totul astăzi, pe fiecare nivel',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'gratuit până la 6 utilizatori · plătit = locuri de echipă',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Niveluri cu funcții blocate',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'capabilități de bază în spatele upsell-urilor',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO și securitate mereu gratuite',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · audit · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'Taxa pe SSO',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'securitatea vândută ca supliment enterprise',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'O expirare nu vă blochează niciodată',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'grație, apoi nivel gratuit — datele sunt ale dvs.',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': 'Nu mai plătiți, pierdeți accesul',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'paywall peste propriile date',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Local-first. Prin design. Nu ca o idee ulterioară.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'Catalogul de cereri API — o machetă stilizată a editorului de cereri arătând selectorul de metodă, bara URL, banda de file și ' +
    'previzualizarea corpului, plus o bandă de funcții acoperind protocoale, autorizare, scripturi, variabile, fișiere, colecții și ' +
    'cookie-uri.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'Catalog de cereri API',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'Construirea, trimiterea și gestionarea completă a cererilor și colecțiilor — în interiorul extensiei.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Trimitere ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Autorizare',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'Antete',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Corp',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Scripturi',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Setări',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Autorizare',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API Key',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Scripturi',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'înainte de cerere + după răspuns',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Variabile',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 sfere · diagnostice structurate',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Fișiere',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · rezolvare {{file.X}}',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Colecții',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'foldere · medii · per cerere',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookie-uri',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'credentialsMode opțional',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker': 'TOT CE LIVREAZĂ UN CLIENT API DESKTOP — ÎN EXTENSIE',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'O platformă API completă — fără platformă.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Motorul de reguli Open Headers — două căi de execuție (nativ DNR și interceptare bazată pe script), nouă categorii de tipuri ' +
    'de reguli grupate pe motor, plus limbajul comun al condițiilor și lanțul sferelor de variabile din care ' +
    'citește fiecare regulă.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Motor de reguli',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'nativ MV3 · două motoare · nouă categorii de reguli',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · nativ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · interceptare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'Antete',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Suprascriere · Adăugare la sfârșit · Eliminare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Blocare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'anulare la nivelul rețelei',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Redirecționare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'adresă URL statică sau regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Parametri de interogare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'adăugare · înlocuire · eliminare · eliminare toate',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'Antete (Îmbinare)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'concatenare de valori',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Injectare',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS sau CSS, două momente',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Întârziere',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'navigare + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Corpul cererii',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'static · dinamic · filtru GraphQL',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Corpul răspunsului',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'corp + stare + antete',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'prinde fiecare cerere emisă de browser',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'prinde fetch / XHR inițiate din JS',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'UN SINGUR LIMBAJ DE CONDIȚII',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Domeniile cererii · Model URL · Regex URL · Metode · Resurse · Inițiator · Antete · Tip de domeniu',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'CINCI SFERE DE VARIABILE',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    'Un motor. Două căi de execuție. Limbaj complet de condiții + variabile. În interiorul extensiei.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Trei categorii de produse moștenite — proxy-uri desktop, platforme API în cloud, extensii doar pentru antete — converg ' +
    'într-o singură extensie de browser Open Headers. Un browser Chromium stilizat arată pagina Workbench a extensiei ' +
    'deschisă, iar fiecare capabilitate pe care o ofereau cele trei categorii trăiește în acea singură filă.',
  'workbench.docs.diagrams.openHeaders.convergence.title': 'Trei categorii de instrumente. O extensie.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'Ce necesita trei instalări separate trăiește acum într-o singură filă de browser.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Proxy-uri desktop',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub':
    'interceptare HTTP · certificat CA · binar separat',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'Platforme API',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub': 'cereri + colecții · găzduite în cloud · cont',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'Extensii de antete',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub':
    'un tip de regulă · fără scripturi · fără autorizare',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ TOATE DESCHISE ÎNTR-O FILĂ',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'suprafața Workbench',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'nativ MV3',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Motor de reguli',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'Catalog de cereri API',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Motor de sincronizare în timp real',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Salvare fără conflicte',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'Fără cont · fără autentificare',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Doar local · fără releu în cloud',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'Fără urmărire · fără date personale',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'UI multi-suprafață',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Multi-suprafață · sincronizare între dispozitive · doar local prin design',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Albastru = capabilități · violet = postură · toate opt trăiesc într-o singură filă',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Două suprafețe editează aceeași regulă simultan. DevTools adaugă, modifică și elimină antete; Workbench ' +
    'editează trei câmpuri diferite ale aceleiași reguli. Toate cele șase modificări ajung în regula îmbinată fără banner sau ' +
    'suprascriere.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Două suprafețe, aceeași regulă, ambele modificări ajung',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    'Sincronizare per câmp — fără banner, fără suprascriere, fără muncă pierdută',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'suprafața A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'suprafața B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'editează antete',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Regula X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'antete',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'MOTOR DE SINCRONIZARE · îmbinare per câmp',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'instantaneu îmbinat · antete',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Adăugate',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Modificate',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Eliminate',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← sursă: ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ ambele modificări aplicate — fără banner, fără conflict',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    'Aceeași cale scalează: extensie azi → extensie + desktop + CLI mâine',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Alegeți-vă frontend-ul — cum accesați și gestionați datele. Patru forme de frontend stivuite vertical: ' +
    'extensie de browser, aplicație desktop, aplicație CLI și aplicație web. Fiecare card listează suprafețele pe care le expune, backend-urile ' +
    'la care se poate conecta (primul cip este implicitul) și platformele pe care rulează.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'Alegeți-vă frontend-ul — cum accesați și gestionați datele',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Aceleași date, orice frontend — alegeți unul, folosiți-le pe toate, fiecare suprafață rămâne sincronizată.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Extensie de browser',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'în interiorul unui browser',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'fereastră nativă',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'linie de comandă',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'Aplicație web',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'filă de browser',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Panou lateral',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Linie de comandă',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Încorporat',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'SUPRAFEȚE',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'SE CONECTEAZĂ LA BACKEND',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'ALEGEȚI UN FRONTEND SAU PE TOATE — SUNT ACELEAȘI DATE',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ extensie · ✓ desktop · ✓ CLI · ✓ web — toate citind aceleași entități canonice',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Aceleași date, pe orice cale ajungeți la ele — fiecare suprafață rămâne sincronizată.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'Alegeți-vă backend-ul — unde stau datele. Patru opțiuni de găzduire stivuite vertical. Fiecare nivel moștenește ' +
    'toate capabilitățile nivelului anterior și adaugă altele noi, evidențiate într-un dreptunghi verde punctat. O ' +
    'coloană SUPORTĂ în dreapta listează browserele, sistemele de operare și furnizorii cloud pe care rulează fiecare nivel. ' +
    'Toate cele patru niveluri doar locale.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Alegeți-vă backend-ul — unde stau datele',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    'Fiecare nivel moștenește nivelul anterior — caseta verde arată noutățile — coloana din dreapta arată unde rulează.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': 'service worker-ul extensiei',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'backend încorporat',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'proces de sine stătător',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'găzduiți-l oriunde',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'zero configurare',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'un singur dispozitiv',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'o instanță per browser',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'editare concurentă multi-suprafață',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'editare concurentă multi-fereastră',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'Doar localhost',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'instanțe în mai multe browsere',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'o instanță per aplicație',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'sistem de fișiere nativ',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML pe disc',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'integrare git (local/la distanță)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'configurare minimă',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'accesibil în LAN',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'instanțe în mai multe aplicații',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'mai multe dispozitive',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'extensie · aplicație desktop · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'configurare standard',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'accesibil din WAN/internet',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'pregătit pentru echipă',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'autentificare SSO',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'gestionare utilizatori RBAC',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': 'jurnale și rapoarte de audit',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'Toate SO',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Încorporat',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Hyperscaleri',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'Din UE',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Altele',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Enterprise',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Mini PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Server de acasă',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Laptop vechi',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Cloudul dvs.',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'On-prem',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'MOȘTENEȘTE DE LA {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ NOU ÎN ACEST NIVEL',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'ORICE ALEGEȚI — ESTE AL DVS., DE LA UN CAPĂT LA ALTUL',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ fără cont · ✓ fără releu în cloud · ✓ fără urmărire · ✓ fără date personale',
  'workbench.docs.diagrams.openHeaders.localFirst.footer':
    'Datele dvs., backend-ul dvs., alegerea dvs. — la fiecare pas.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Patru carduri de categorie comparând platformele API SaaS, proxy-urile desktop și extensiile doar pentru antete cu ' +
    'Open Headers.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'UNDE SE SITUEAZĂ OPEN HEADERS',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'Platforme API SaaS',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Proxy-uri desktop',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Extensii doar pentru antete',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'nativ',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'lite',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'noi',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Datele dvs. stau pe serverele lor',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Cont + autentificare obligatorii',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Set larg de funcții',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Binar separat de instalat + rulat',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'Certificat CA + configurare proxy per aplicație',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Vede orice fel de trafic',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'În browser, fără configurare',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'Un singur tip de regulă — doar antete',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts':
    'Fără scripturi, fără autorizare, fără editări de corp',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'În browser · doar local · fără cont',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Nouă tipuri de reguli · un singur limbaj de condiții',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'Scripturi + OAuth + fișiere în extensie',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Patru suprafețe partajează un singur depozit',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'față de platformele API în cloud. Platformele cloud păstrează acreditările, definițiile regulilor și jurnalele cererilor pe un server al ' +
    'furnizorului. Open Headers le păstrează pe toate trei pe dispozitivul utilizatorului.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Unde ajung datele dvs.',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Acreditări, definiții de reguli, jurnale de cereri — local sau la distanță?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'acreditări',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'definiții de reguli',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'jurnale de cereri',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'pe dispozitivul dvs.',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'pe serverul furnizorului',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Platformă API în cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'dvs.',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'datele dvs.',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'dispozitivul dvs.',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'acreditări · reguli · jurnale',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'toate într-un singur loc',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Datele dvs. nu părăsesc niciodată mașina dvs.',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'față de extensiile doar pentru antete. Extensiile doar pentru antete gestionează un singur tip de regulă. Open Headers gestionează nouă — antete, ' +
    'blocare, redirecționare, parametri de interogare, îmbinare antete, injectare, întârziere, corpul cererii, corpul răspunsului.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'Câte tipuri de reguli',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'Un instrument care face un lucru — sau un instrument care face nouă.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Extensie doar pentru antete',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'Antete',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'suprascriere',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Blocare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'anulare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Redirecționare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'static / regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Interogare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'adăugare · eliminare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Îmbinare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'antete ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Injectare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Întârziere',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'nav. / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Corp cerere',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'static · din.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Corp răspuns',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'corp / stare',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft':
    'Aveți nevoie de oricare dintre celelalte 8? — instalați altă extensie',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight':
    'Aceleași condiții, aceeași suprafață, un singur spațiu de lucru',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Nouă tipuri de reguli, un singur limbaj de condiții, o singură suprafață observabilă',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'față de proxy-urile desktop. Proxy-urile rutează traficul printr-un proces separat, în spatele unui certificat CA. Open Headers ' +
    'aplică regulile inline prin interfețele API native ale browserului — fără port de proxy, fără certificat.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'Cum sunt modelate cererile',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Reguli inline în browser — fără port de proxy, fără certificat CA, fără configurare per aplicație.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Proxy desktop',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'OCOL',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'INLINE',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'Aplicație',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'configurată',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'port de proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'certificat CA',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Internet',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Browser',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'instalați binarul',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'instalați certificatul CA',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'configurați fiecare aplicație',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': 'instalați extensia',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': 'atât',
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    'O instalare · zero certificate · regulile rulează cu permisiunile paginii',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Etapă a foii de parcurs — CLI. O fereastră de terminal arătând comenzi de exemplu pentru listarea regulilor, comutarea ' +
    'mediilor și trimiterea unei cereri salvate — toate vorbind cu același server ca UI-ul.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · scripting headless',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'Același server ca UI-ul — automatizarea rămâne sincronizată cu ce vedeți.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · terminal',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# același server · același spațiu de lucru ca UI-ul',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict': 'Listare · comutare · trimitere · diff — direct din shell',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Etapă a foii de parcurs — server local / LAN. Un server în centru; extensia, aplicația desktop și CLI se conectează ' +
    'toate ca clienți prin rețeaua dvs. LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Server local / LAN · un singur hub de sincronizare',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Extensie · desktop · CLI — toți clienți ai aceluiași server, toți în rețeaua dvs.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'spații de lucru',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'reguli · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'motor de sincronizare',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'accesibil în LAN',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Extensie',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'laptop',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'stație de lucru',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · mai multe ferestre',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'orice mașină · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': 'Un server · mulți clienți · rămâne în rețeaua dvs.',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'Etapă a foii de parcurs — aplicația desktop. Extensia de browser și aplicația desktop nativă expun ambele suprafața Workbench ' +
    'peste același depozit de pe disc. Aplicația desktop adaugă protocoale pe care o extensie de browser nu le poate găzdui nativ: AI, ' +
    'MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Fereastră nativă · același depozit · rază mai mare',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    'Același Workbench, același spațiu de lucru — desktopul adaugă protocoale pe care un browser nu le poate găzdui.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Extensie de browser',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': 'astăzi',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'SUPRAFAȚĂ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'FUNCȚII',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'CATALOG API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Interceptor de browser',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Variabile',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Fluxuri de lucru',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'Catalog API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'local / la distanță',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ DOAR DESKTOP',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'Toate patru sunt fezabile în browser.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': 'același depozit de spații de lucru pe disc',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    'Un spațiu de lucru, două frontend-uri, raza suplimentară acolo unde browserul nu poate ajunge',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Etapă a foii de parcurs — spații de lucru de echipă prin Git. Două dispozitive țin fiecare un spațiu de lucru; ambele fac push și pull către un ' +
    'depozit Git partajat. Depozitul este stratul de sincronizare; niciun server al furnizorului la mijloc.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Spații de lucru ca depozite Git',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'Pull sincronizează · push partajează · îmbinare prin Git — fără server al furnizorului.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'dispozitivul A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'dispozitivul B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Spațiu de lucru',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'reguli · medii · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Datele dvs., depozitul dvs., istoricul dvs. auditabil',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Importatoare. Șase formate sursă se varsă într-un singur spațiu de lucru Open Headers — cURL, antete HAR, Postman, cereri HAR ' +
    'complete, Insomnia, OpenAPI — toate disponibile astăzi.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Importatoare · aduceți-vă colecția',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, cereri HAR complete — toate disponibile astăzi.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'antete',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Colecție Postman',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR (cereri complete)',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Colecție Insomnia',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'Specificație OpenAPI',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'ASTĂZI',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'URMEAZĂ',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'spațiu de lucru',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'IMPORTATE ÎN',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Interceptor de browser',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'Colecții de cereri API',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Medii',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Intrări Vault',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict':
    'Aduceți-o într-un singur pas — continuați să lucrați',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Etapă a foii de parcurs — arhitectura serverului MCP. Un client AI se conectează la Open Headers prin Model Context ' +
    'Protocol (stdio local, HTTP/SSE la distanță). Serverul MCP OH modifică spațiul de lucru al utilizatorului; rezultatul ' +
    'apare în Workbench.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'Server MCP · spațiul dvs. de lucru, orice client AI',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers vorbește Model Context Protocol — orice agent capabil de MCP vă poate conduce spațiul de lucru.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'Client AI',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'agentul dvs.',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'ORICE CLIENT MCP',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'Server MCP OH',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'EXPUNE',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Reguli · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'Cereri API',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Medii',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Variabile · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Fluxuri de lucru',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'local',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'la distanță',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'modifică',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · spațiul dvs. de lucru',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'live',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'reguli · medii · variabile · fluxuri de lucru · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    'Conduceți-vă spațiul de lucru cu orice agent AI · local sau la distanță',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Etapă a foii de parcurs — catalogul de instrumente al serverului MCP. Șapte domenii expunând {n} instrumente în total: reguli, cereri, ' +
    'medii, variabile, fluxuri de lucru, spații de lucru, activitate.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'Ce poate face agentul AI',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    'Șapte domenii — CRUD complet unde are sens, doar citire delimitată unde nu.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Reguli',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'antet · blocare · redirecționare · răspuns',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Cereri',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'Catalog API',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Medii',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'per spațiu de lucru',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Variabile',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'toate sferele · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Fluxuri de lucru',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'apeluri API înlănțuite',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Spații de lucru',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'multi-spațiu de lucru',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': 'INSTRUMENTE: {n}',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 INSTRUMENT',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Activitate',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    'fluxul de modificări — un agent vede ce s-a schimbat înainte să acționeze',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict':
    'instrumente: {n} · șapte domenii · întreaga suprafață Open Headers',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Etape — carduri ordonate într-un cadru de fereastră de browser: spații de lucru Git, aplicație desktop, server MCP, server ' +
    'local, CLI, aplicație web auto-găzduită, importatoare — toate disponibile.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Fiecare suprafață, livrată',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    'Livrate în ordine — doar local a rămas produsul prin fiecare etapă.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'LIVRAT',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'CONTROLAT DE UTILIZATOR',
  'workbench.docs.diagrams.openHeaders.milestones.msGit':
    'Colaborare în spațiul de lucru prin Git (pregătit pentru echipă)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML într-un depozit Git pe care îl controlați — pull, push, îmbinare prin Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    'Binar nativ pe același depozit — ajunge unde o extensie nu poate.',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'Server MCP (control prin agent AI)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers prin MCP — lăsați un agent AI să vă conducă spațiul de lucru.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Server local / LAN',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Server pe mașina dvs. sau în rețeaua LAN — extensia, desktopul, CLI drept clienți.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Scripting headless și CI — listare, comutare, trimitere din shell.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Implementare auto-găzduită pe VM + aplicație web',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Pachet web pe VM-ul dvs. — browsere restricționate sau implementări cu marcă proprie.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'Mai multe importatoare',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Dincolo de Postman — Insomnia, specificații OpenAPI, importuri HAR complete.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'Sincronizarea între utilizatori se livrează prin Git și implementări auto-găzduite — fără cloud găzduit de furnizor.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Etapă a foii de parcurs — aplicație web auto-găzduită. Originea dvs. servește același pachet UI; utilizatorii îl deschid ca filă de ' +
    'browser pe un domeniu pe care îl controlați. Aceeași suprafață Workbench, fără extensie.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Implementare auto-găzduită pe VM + aplicație web',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'VM-ul dvs. servește pachetul web — originea dvs., domeniul dvs., utilizatorii dvs.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'servește',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': 'aceeași suprafață ca extensia + desktopul',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'Același UI · originea dvs. · fără extensie',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'REGULĂ',
  'workbench.docs.diagrams.shared.useCasesKicker': 'CAZURI FRECVENTE',
  'workbench.docs.diagrams.shared.wontFireKicker': 'CÂND NU SE DECLANȘEAZĂ',
  'workbench.docs.diagrams.shared.suggestion': 'Sfat',
  'workbench.docs.diagrams.shared.beforeKicker': 'ÎNAINTE',
  'workbench.docs.diagrams.shared.afterKicker': 'DUPĂ',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Blocare anulează cererile potrivite la nivelul rețelei — pagina vede o eroare de rețea. Blocările main_frame ' +
    'afișează ERR_BLOCKED_BY_CLIENT; blocările de subresurse eșuează în tăcere.',
  'workbench.docs.diagrams.block.rule': 'Blocare · Domeniile cererii: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Pagină',
  'workbench.docs.diagrams.block.dnrBlock': 'Blocare DNR',
  'workbench.docs.diagrams.block.network': 'Rețea',
  'workbench.docs.diagrams.block.neverReached': 'niciodată atinsă',
  'workbench.docs.diagrams.block.requestCancelled': 'cerere anulată',
  'workbench.docs.diagrams.block.pageSeesKicker': 'CE VEDE PAGINA',
  'workbench.docs.diagrams.block.chromeBlockPage': 'Pagina de blocare Chrome',
  'workbench.docs.diagrams.block.silentFailure': 'Eșec silențios',
  'workbench.docs.diagrams.block.pageHandlesError': 'pagina își gestionează propria eroare',
  'workbench.docs.diagrams.block.useCasesAria':
    'Blocare — cazuri frecvente: reclame și trackere, simulare de pană, refuz de punct final și blocare doar a paginii.',
  'workbench.docs.diagrams.block.card1Title': 'Reclame și trackere',
  'workbench.docs.diagrams.block.card1Example': 'Blocare ads.openheaders.com',
  'workbench.docs.diagrams.block.card2Title': 'Simulare de pană',
  'workbench.docs.diagrams.block.card2Example': 'Scoateți o gazdă offline pentru test',
  'workbench.docs.diagrams.block.card3Title': 'Refuz de punct final',
  'workbench.docs.diagrams.block.card3Example': 'Blocare doar /api/admin',
  'workbench.docs.diagrams.block.card4Title': 'Blocare doar a paginii',
  'workbench.docs.diagrams.block.card4Example': 'Adăugați condiția main_frame',
  'workbench.docs.diagrams.block.useCasesFooter': 'Împerecheați Blocare cu Condiții pentru a o restrânge.',
  'workbench.docs.diagrams.block.wontApplyAria':
    'Blocare nu anulează retroactiv resursele deja încărcate. Reîncărcați pagina după activarea regulii pentru a prinde ' +
    'cererile viitoare.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Resurse deja încărcate',
  'workbench.docs.diagrams.block.alreadyLoadedSub':
    'Doar cererile viitoare sunt interceptate — cele trecute rămân încărcate.',
  'workbench.docs.diagrams.block.suggestionText': 'Reîncărcați pagina după activarea regulii.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Redirecționare statică — fiecare cerere potrivită este rescrisă către aceeași adresă URL de destinație.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Redirecționare → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'CERERE ORIGINALĂ',
  'workbench.docs.diagrams.redirect.urlRewritten': 'adresa URL rescrisă',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'REDIRECȚIONATĂ CĂTRE',
  'workbench.docs.diagrams.redirect.staticStamp': 'Fiecare potrivire → aceeași adresă URL de destinație.',
  'workbench.docs.diagrams.redirect.staticStampSub':
    'Browserul navighează ca și cum serverul ar fi returnat o redirecționare.',
  'workbench.docs.diagrams.redirect.regexAria':
    'Redirecționare regex — grupurile de captură ale modelului URL sunt referite ca \\1, \\2 în adresa URL de destinație.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'Regex URL: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Redirecționare → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'ADRESA URL ORIGINALĂ',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 substituit',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 moștenește tot ce a potrivit grupul de captură.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'Redirecționare — cazuri frecvente: upgrade HTTP→HTTPS, migrare de domeniu, rescriere de cale, proxy de dezvoltare local.',
  'workbench.docs.diagrams.redirect.card1Example': 'Forțați tot http la https',
  'workbench.docs.diagrams.redirect.card2Title': 'Migrare de domeniu',
  'workbench.docs.diagrams.redirect.card3Title': 'Rescriere de cale',
  'workbench.docs.diagrams.redirect.card4Title': 'Proxy de dezvoltare local',
  'workbench.docs.diagrams.redirect.useCasesFooter':
    'Folosiți Regex URL cu referințe înapoi pentru rescrieri care păstrează calea.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    'Redirecționare nu se aplică retroactiv paginilor încărcate, iar buclele de redirecționare sunt limitate de Chrome pentru a preveni ' +
    'ciclurile infinite.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Pagină deja încărcată',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Doar navigările și fetch-urile viitoare sunt interceptate.',
  'workbench.docs.diagrams.redirect.loops': 'Bucle de redirecționare',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome le limitează — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': 'Reîncărcați. Asigurați-vă că condițiile nu formează o buclă.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    'Momentul injectării — „Cât mai curând posibil” rulează înaintea scripturilor paginii; „După încărcarea paginii” rulează după parsarea DOM.',
  'workbench.docs.diagrams.inject.timeAxis': 'timp →',
  'workbench.docs.diagrams.inject.navigation': 'navigare',
  'workbench.docs.diagrams.inject.domParsed': 'DOM parsat',
  'workbench.docs.diagrams.inject.loadEvent': 'eveniment load',
  'workbench.docs.diagrams.inject.asap': 'Cât mai curând',
  'workbench.docs.diagrams.inject.prePageScript': 'înaintea scripturilor paginii',
  'workbench.docs.diagrams.inject.afterLoad': 'După încărcare',
  'workbench.docs.diagrams.inject.domSafe': 'DOM gata',
  'workbench.docs.diagrams.inject.timingFooter': '„Cât mai curând” pentru curse · „După încărcare” pentru DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    'Injectare de script — JavaScript rulează în pagină, fie cât mai curând posibil (înaintea scripturilor paginii), fie după încărcarea paginii (DOM gata).',
  'workbench.docs.diagrams.inject.ruleScript':
    'Script (cât mai curând): împachetați fetch pentru a jurnaliza fiecare apel',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // injectat de extensie',
  'workbench.docs.diagrams.inject.runsInPage':
    'Rulează în contextul paginii — vede aceleași variabile globale ca JS din pagină.',
  'workbench.docs.diagrams.inject.scriptFooter':
    '„Cât mai curând” câștigă cursele înaintea codului aplicației; „După încărcare” citește un DOM parsat.',
  'workbench.docs.diagrams.inject.cssAria':
    'Injectare CSS — o etichetă <style> este adăugată în head-ul paginii, ascunzând elementul banner.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'regulă',
  'workbench.docs.diagrams.inject.ruleApplied2': 'aplicată',
  'workbench.docs.diagrams.inject.hidden': '(ascuns)',
  'workbench.docs.diagrams.inject.cssFooter':
    'Injectat ca etichetă <style> — aceeași specificitate CSS ca stilurile paginii.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    'Injectare nu se aplică iframe-urilor sandbox sau paginilor cu CSP strict care blochează scripturile inline.',
  'workbench.docs.diagrams.inject.sandboxed': 'Iframe-uri sandbox',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Pagini cu sandbox="" care dezactivează scripturile.',
  'workbench.docs.diagrams.inject.strictCsp': "CSP strict (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': 'Scripturile injectate inline sunt blocate de politica paginii.',
  'workbench.docs.diagrams.inject.suggestionText': 'Injectați în pagina părinte; postMessage în iframe.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'Injectare JS / CSS — cazuri frecvente: monkey-patch, mod întunecat, ascunderea elementelor, indicatoare de funcții.',
  'workbench.docs.diagrams.inject.card1Title': 'Monkey-patch',
  'workbench.docs.diagrams.inject.card1Example': 'Împachetați fetch / XHR (cât mai curând)',
  'workbench.docs.diagrams.inject.card2Title': 'Mod întunecat',
  'workbench.docs.diagrams.inject.card2Example': 'Forțați o temă CSS',
  'workbench.docs.diagrams.inject.card3Title': 'Ascundeți zgomotul',
  'workbench.docs.diagrams.inject.card3Example': 'display: none pe bannere',
  'workbench.docs.diagrams.inject.card4Title': 'Indicatoare de funcții',
  'workbench.docs.diagrams.inject.card4Example': 'Setați indicatoarele window cât mai curând',
  'workbench.docs.diagrams.inject.useCasesFooter':
    '„Cât mai curând” pentru cod care trebuie să ruleze primul; „După încărcare” pentru citiri DOM.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Rutarea Întârziere pe benzile navigare, fetch și subresurse — doar primele două sunt interceptate, ' +
    'subresursele trec neatinse.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Cerere potrivită',
  'workbench.docs.diagrams.delay.document': 'Document',
  'workbench.docs.diagrams.delay.documentSub': 'navigare iframe',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': 'prin ecranul de așteptare',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'inițiat din JS',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'cu monkey-patch',
  'workbench.docs.diagrams.delay.subResource': 'Subresursă',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'neîntârziată',
  'workbench.docs.diagrams.delay.passesThrough': 'trece neatinsă',
  'workbench.docs.diagrams.delay.routingFooter': 'Plafoanele mai mari necesită un proxy local real',
  'workbench.docs.diagrams.delay.navAria':
    'Întârziere de navigare — browserul este redirecționat către un ecran de așteptare local care ține N ms înainte de a ' +
    'trimite mai departe către adresa URL țintă reală.',
  'workbench.docs.diagrams.delay.ruleNav': 'Întârziere 8,000 ms · navigare de pagină',
  'workbench.docs.diagrams.delay.click': 'Clic',
  'workbench.docs.diagrams.delay.waitingPage': 'Ecran de așteptare',
  'workbench.docs.diagrams.delay.holds8s': '⏱ ține 8 s',
  'workbench.docs.diagrams.delay.loadsNow': 'se încarcă acum',
  'workbench.docs.diagrams.delay.navStamp':
    'Respectată până la 30,000 ms — plafonul de redirecționări al browserului Chrome.',
  'workbench.docs.diagrams.delay.navStampSub': 'Implementată ca redirecționare DNR către un ecran de așteptare local.',
  'workbench.docs.diagrams.delay.xhrAria':
    'Întârziere fetch/XHR inițiat din JS — un setTimeout cu monkey-patch ține rezolvarea. Plafonată la 5,000 ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Întârziere 3,000 ms · fetch / XHR din JS',
  'workbench.docs.diagrams.delay.intercept': 'interceptare',
  'workbench.docs.diagrams.delay.network': 'rețea',
  'workbench.docs.diagrams.delay.hold3000': 'reținere 3,000 ms',
  'workbench.docs.diagrams.delay.realRequest': 'cerere reală',
  'workbench.docs.diagrams.delay.responseDelayed': 'răspuns (întârziat cu 3 s)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Plafonată la 5,000 ms — valorile de deasupra sunt limitate pe fir.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    'Întârziere nu se aplică subresurselor (img/css/js) sau fetch-urilor din service worker, care ocolesc monkey-patch-ul de la nivelul ' +
    'paginii.',
  'workbench.docs.diagrams.delay.subResources': 'Subresurse (img, css, js, fonturi)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Browserul le emite — niciun monkey-patch nu le poate reține.',
  'workbench.docs.diagrams.delay.swFetches': 'Fetch-uri din service worker',
  'workbench.docs.diagrams.delay.swFetchesSub':
    'Rulează într-o altă sferă; patch-urile de la nivelul paginii nu ajung la ele.',
  'workbench.docs.diagrams.delay.suggestionText': 'Limitarea subresurselor sosește în curând cu aplicația desktop.',
  'workbench.docs.diagrams.delay.useCasesAria':
    'Întârziere — cazuri frecvente: QA pentru stări de încărcare, testare debounce, scoaterea la iveală a condițiilor de cursă, simulare de rețea ' +
    'lentă.',
  'workbench.docs.diagrams.delay.card1Title': 'Stări de încărcare',
  'workbench.docs.diagrams.delay.card1Example': 'Afișați spinnere fiabil',
  'workbench.docs.diagrams.delay.card2Title': 'Verificări debounce',
  'workbench.docs.diagrams.delay.card2Example': 'Testați limitarea tastării',
  'workbench.docs.diagrams.delay.card3Title': 'Condiții de cursă',
  'workbench.docs.diagrams.delay.card3Example': 'Scoateți la iveală ordinea cererilor',
  'workbench.docs.diagrams.delay.card4Title': 'Simulare rețea lentă',
  'workbench.docs.diagrams.delay.card4Example': 'Latență aproximativ ca 3G',
  'workbench.docs.diagrams.delay.useCasesFooter':
    'Resursele statice necesită un proxy real — extensiile nu le pot reține.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Adăugare / Înlocuire · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'parametru adăugat sau înlocuit',
  'workbench.docs.diagrams.queryParams.addStamp': 'Adaugă când lipsește, înlocuiește când există.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Doar înlocuire — înlocuiește valorile parametrilor de interogare existenți, dar lasă neatinse adresele URL fără parametru.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Doar înlocuire · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Prezent',
  'workbench.docs.diagrams.queryParams.presentSub': 'parametrul există deja',
  'workbench.docs.diagrams.queryParams.absent': 'Absent',
  'workbench.docs.diagrams.queryParams.absentSub': 'fără parametrul region',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'valoare înlocuită',
  'workbench.docs.diagrams.queryParams.unchanged': 'neschimbată',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    'Înlocuiește, nu adaugă niciodată — adresele URL fără parametru trec neatinse.',
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Eliminare · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'parametru eliminat',
  'workbench.docs.diagrams.queryParams.removeStamp': 'Parametrul numit eliminat; tot restul trece neatins.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Eliminare toate',
  'workbench.docs.diagrams.queryParams.noQueryString': '(fără șir de interogare)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'întreaga interogare eliminată',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Întregul șir de interogare eliminat într-un singur pas.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'Capcană la Parametri de interogare — Eliminare toate nu poate fi combinată cu Adăugare / Înlocuire în aceeași regulă.',
  'workbench.docs.diagrams.queryParams.watchForKicker': 'LA CE SĂ VĂ UITAȚI',
  'workbench.docs.diagrams.queryParams.combining': 'Combinarea Eliminare toate cu Adăugare / Înlocuire',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR respinge regulile care elimină întreaga interogare și adaugă parametri noi.',
  'workbench.docs.diagrams.queryParams.suggestionText':
    'Folosiți două reguli — mai întâi Eliminare toate, apoi Adăugare / Înlocuire.',
  'workbench.docs.diagrams.queryParams.suggestionSub':
    'Ordinea regulilor contează; ambele trebuie să potrivească aceeași cerere.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'Parametri de interogare — cazuri frecvente: forțarea unui indicator, canonizarea unei valori, eliminarea trackerelor, eliminarea totală în modul de confidențialitate.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Forțați un indicator',
  'workbench.docs.diagrams.queryParams.card1Example': 'Adăugați debug=true',
  'workbench.docs.diagrams.queryParams.card2Title': 'Canonizare',
  'workbench.docs.diagrams.queryParams.card2Example': 'Înlocuiți doar region',
  'workbench.docs.diagrams.queryParams.card3Title': 'Eliminați trackerele',
  'workbench.docs.diagrams.queryParams.card3Example': 'Eliminați parametrii utm_*',
  'workbench.docs.diagrams.queryParams.card4Title': 'Mod de confidențialitate',
  'workbench.docs.diagrams.queryParams.card4Example': 'Eliminați toate interogările',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'Împerecheați cu Model URL sau Domenii pentru a restrânge la anumite rute.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'Conducta de interceptare a corpului cererii — apelul din page.js intră în interceptarea motorului de scripturi, se ramifică în ' +
    'transformări Static / Dinamic / GraphQL, apoi pleacă spre rețeaua reală.',
  'workbench.docs.diagrams.requestBody.pageSub': 'apel fetch / XHR',
  'workbench.docs.diagrams.requestBody.intercept': 'Interceptare',
  'workbench.docs.diagrams.requestBody.interceptSub': 'monkey-patch al extensiei',
  'workbench.docs.diagrams.requestBody.branchStatic': 'Static',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'înlocuiește corpul',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'în întregime',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Dinamic',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'corp modificat',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': 'operația se potrivește? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'aplică : sare',
  'workbench.docs.diagrams.requestBody.realNetwork': 'rețea reală',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'CORP ORIGINAL',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'CORP TRIMIS',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Corp static: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'corp substituit în întregime',
  'workbench.docs.diagrams.requestBody.staticStamp':
    'Întregul corp înlocuit; regula nu inspectează niciodată originalul.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Corp dinamic: fn(orig) → marcat',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn citește și rescrie',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'funcția transformă',
  'workbench.docs.diagrams.requestBody.dynamicStamp': 'Funcția primește originalul; returnează noul corp.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'Filtru GraphQL — regula se declanșează doar când câmpul numit din corpul JSON se potrivește. Celelalte operații trec ' +
    'neatinse.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Este egal cu "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ substituire cu corp static',
  'workbench.docs.diagrams.requestBody.match': 'Potrivire',
  'workbench.docs.diagrams.requestBody.noMatch': 'Fără potrivire',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'orice altă operație',
  'workbench.docs.diagrams.requestBody.ruleFires': 'regula se declanșează',
  'workbench.docs.diagrams.requestBody.passesThrough': 'trece neatinsă',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'Filtru la nivel de câmp — se aplică doar operațiilor potrivite.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    'Cererile cu câmpuri lipsă sau corpuri non-JSON sar peste regulă.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Regulile de corp se declanșează doar pe fetch/XHR inițiate din JS cu un corp. Cererile GET și HEAD nu au nimic de ' +
    'înlocuit; resursele statice nu intră niciodată în interceptarea de script.',
  'workbench.docs.diagrams.requestBody.getHead': 'Cereri GET / HEAD',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'Conform specificației, fără corp — nimic de înlocuit.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Resurse statice (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Emise de browser — nu ating niciodată fetch / XHR.',
  'workbench.docs.diagrams.requestBody.suggestionText':
    'Confirmați că cererea este un POST/PUT/PATCH din JS din pagină.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'Corpul cererii — cazuri frecvente: fixturi de test, marcarea cu metadate, simularea operațiilor GraphQL, anonimizarea ' +
    'PII.',
  'workbench.docs.diagrams.requestBody.card1Title': 'Fixturi de test',
  'workbench.docs.diagrams.requestBody.card1Example': 'Forțați un conținut util cunoscut',
  'workbench.docs.diagrams.requestBody.card2Title': 'Marcați metadate',
  'workbench.docs.diagrams.requestBody.card2Example': 'Adăugați debug: true',
  'workbench.docs.diagrams.requestBody.card3Title': 'Operații GraphQL',
  'workbench.docs.diagrams.requestBody.card3Example': 'Simulați un singur operationName',
  'workbench.docs.diagrams.requestBody.card4Title': 'Modelarea redării',
  'workbench.docs.diagrams.requestBody.card4Example': 'Anonimizați câmpurile PII',
  'workbench.docs.diagrams.requestBody.useCasesFooter':
    'Doar motorul de scripturi — se aplică fetch / XHR inițiate din JS.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'mai târziu',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'Modul Depanare stă în subsol — un comutator inline îl activează; punctul și eticheta deschid un popover cu ' +
    'raza de acțiune, fixarea per filă și lista filelor atașate.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'Modul Depanare stă în subsol',
  'workbench.docs.diagrams.debugMode.surfaceCaption':
    'Comutatorul îl activează · punctul + eticheta deschid popover-ul.',
  'workbench.docs.diagrams.debugMode.debugMode': 'Modul Depanare',
  'workbench.docs.diagrams.debugMode.systemStatus': 'Starea sistemului',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Atașare la',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Ambele ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Includere această filă',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Filele atașate (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Fila #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'Setul atașat este derivat: raza de acțiune aleasă reunită cu filele fixate, intersectată cu comutatorul ' +
    'principal. Cu modul Depanare oprit, nimic nu se atașează.',
  'workbench.docs.diagrams.debugMode.scopeTitle': 'Ce se atașează',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( rază ∪ fixări ) ∩ comutator principal',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Atașare la: Ambele',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ fila focalizată',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Fixată: Fila #11',
  'workbench.docs.diagrams.debugMode.candidates': 'candidate',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Depanare PORNITĂ',
  'workbench.docs.diagrams.debugMode.attached': 'Atașate',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Fila #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Fila #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1':
    'Depanare OPRITĂ → nimic nu se atașează, oricare ar fi raza de acțiune.',
  'workbench.docs.diagrams.debugMode.scopeFooter2': 'Reatașarea redă de aici — niciodată dintr-un instantaneu stocat.',
  'workbench.docs.diagrams.debugMode.reachAria':
    'Modul standard atinge doar fetch și XHR din pagină. O filă atașată în modul Depanare atinge și navigările, ' +
    'workerii, iframe-urile cross-origin și mediul filei.',
  'workbench.docs.diagrams.debugMode.reachTitle': 'Ce poate atinge fiecare mod',
  'workbench.docs.diagrams.debugMode.standardMode': 'Mod standard',
  'workbench.docs.diagrams.debugMode.rowFetch': 'Fetch / XHR din pagină',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Navigări',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Workeri',
  'workbench.docs.diagrams.debugMode.rowIframes': 'Iframe-uri cross-origin',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'Mediul filei',
  'workbench.docs.diagrams.debugMode.bannerFree': 'fără banner',
  'workbench.docs.diagrams.debugMode.showsBanner': 'afișează bannerul',
  'workbench.docs.diagrams.debugMode.statesAria':
    'Punctul are patru stări: gri oprit, verde pornit și atașat, galben a revenit la euristică la închiderea ' +
    'bannerului și roșu când o filă nu s-a putut atașa.',
  'workbench.docs.diagrams.debugMode.statesTitle': 'Punctul dintr-o privire',
  'workbench.docs.diagrams.debugMode.stateOff': 'Oprit',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'modul Depanare dezactivat',
  'workbench.docs.diagrams.debugMode.stateOn': 'Pornit · file: 2',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'atașat și sănătos',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'A revenit',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'banner închis → euristică',
  'workbench.docs.diagrams.debugMode.stateFailed': 'Eșec la atașare',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': 'nu a putut angaja protocolul',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Două faze ale fiecărei conexiuni — cerere și răspuns — fiecare cu propriile câmpuri capturate.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'Fiecare conexiune are două faze',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'CERERE',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Pagină → Rețea',
  'workbench.docs.diagrams.requestTracking.outbound': 'ieșire',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Metodă',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'Antete',
  'workbench.docs.diagrams.requestTracking.capBody': 'Corp',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'RĂSPUNS',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Rețea → Pagină',
  'workbench.docs.diagrams.requestTracking.inbound': 'intrare',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Cod de stare',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Timpi',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'per dus-întors HTTP',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'CAPTURAT',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'aceeași conexiune',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    'Ambele faze contribuie cu date la numărul din insigna din „Această pagină”.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Diagramă de secvență: cererea observată, potrivită, înregistrată, apoi citită de fereastra popup',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Browser',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'stiva de rețea',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Extensie',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'service worker',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Popup',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'fila „Această pagină”',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (cerere)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'potrivire cu regulile',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'înregistrare (regulă + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'tip de resursă)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (răspuns)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'înregistrare faza de răspuns',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'utilizatorul deschide fereastra popup',
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'reguli potrivite + insigne',
  'workbench.docs.diagrams.requestTracking.seqFooter':
    'Înregistrarea are loc în timp real; fereastra popup doar o citește înapoi.',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'Anatomia UI — insigna restrânsă se extinde într-o listă de cereri potrivite',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Rândul regulii în fereastra popup',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Blocare ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'clic pe insignă',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'potrivit: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'marcaj temporal · URL · tip de resursă · model potrivit',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'numărul din insignă = numărul de rânduri',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Anatomia tipurilor de resurse — o machetă stilizată de pagină cu explicații pentru fiecare ResourceType Chrome: Page, ' +
    'Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Fiecare fel de cerere corespunde unui singur ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'LEGENDĂ',
  'workbench.docs.diagrams.resourceTypes.footer':
    'Fiecare intrare corespunde 1:1 — nu există suprapuneri între rânduri.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'Limitări frecvente — punct orb DevTools pentru antetele modificate; motorul de scripturi vede doar fetch/XHR; ' +
    'Îmbinare vede doar antetele setate de pagină; potrivirea antetelor necesită Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'CAPCANE FRECVENTE',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'Punct orb DevTools',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Fila Network arată',
  'workbench.docs.diagrams.limitations.devtoolsLine2': 'antetele originale.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Raza Script',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Doar fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'fără navigare, fără static.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Sfera Îmbinare',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Vede doar antetele',
  'workbench.docs.diagrams.limitations.mergeLine2': 'setate de codul paginii.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': 'Browserele mai vechi',
  'workbench.docs.diagrams.limitations.chromeLine2': 'sar potrivirea antetelor.',
  'workbench.docs.diagrams.limitations.seeCallout': 'Vedeți nota de mai jos.',
  'workbench.docs.diagrams.limitations.footer':
    'Fiecare capcană este semnalată și inline în secțiunea pe care o afectează.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Unde interceptează fiecare motor fluxul cererii — JS trece prin Script, apoi DNR; static și ' +
    'navigarea sar peste Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Unde interceptează fiecare motor',
  'workbench.docs.diagrams.execution.stackJsLane': 'Inițiat din JS',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Static / navigare',
  'workbench.docs.diagrams.execution.stackPageJs': 'JS din pagină',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Browser',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, navigare etc.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Motor de scripturi',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'monkey-patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'ocolește',
  'workbench.docs.diagrams.execution.stackBypasses2': 'motorul de scripturi',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'Motor DNR',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'rețeaua Chrome — prinde totul',
  'workbench.docs.diagrams.execution.stackNetwork': 'Rețea',
  'workbench.docs.diagrams.execution.stackFooter':
    'DNR este larg; Script este îngust, dar poate citi corpurile răspunsurilor.',
  'workbench.docs.diagrams.execution.dnrAria':
    'Raza largă a DNR — fiecare tip de resursă pe care browserul îl descarcă este interceptat',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR prinde orice fel de cerere',
  'workbench.docs.diagrams.execution.dnrItemNav': 'navigare de pagină',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'subcadru',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'scripturi',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'foi de stil',
  'workbench.docs.diagrams.execution.dnrItemImages': 'imagini',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'fonturi',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'media',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'fiecare tip de resursă pe care browserul îl descarcă',
  'workbench.docs.diagrams.execution.reachAria': 'Raza motorului de scripturi — ce prinde față de ce îl ocolește',
  'workbench.docs.diagrams.execution.reachTitle': 'Ce vede de fapt motorul de scripturi',
  'workbench.docs.diagrams.execution.reachCaught': '✓ prins',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'motorul le vede',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'fetch SW',
  'workbench.docs.diagrams.execution.reachInScope': '(în sferă)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ ratat',
  'workbench.docs.diagrams.execution.reachMissedSub': 'îl ocolește complet',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'navigare de pagină',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'interne browserului',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon etc.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria':
    'Potriviri directe față de indirecte — aceeași regulă, două contexte de pagină',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Regulă',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Domeniile cererii: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Directă',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'adresa URL a paginii se potrivește ea însăși',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'pagină',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Pagina + subresursele',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'de pe aceeași gazdă urmărite',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'insignă:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'directă',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirectă',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Indirectă',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'doar o subresursă se potrivește',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Doar subresursa',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'potrivită urmărită',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'potrivește regula',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'nu se potrivește',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    'Static sare complet peste rețea; Dinamic o atinge mai întâi, apoi transformă răspunsul real.',
  'workbench.docs.diagrams.mock.flowStatic': 'Static',
  'workbench.docs.diagrams.mock.flowDynamic': 'Dinamic',
  'workbench.docs.diagrams.mock.flowIntercept': 'Interceptare',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(rețeaua reală',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'niciodată atinsă)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'rețea reală',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'răspuns real',
  'workbench.docs.diagrams.mock.flowSynthetic': 'corp sintetic',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'pagina primește',
  'workbench.docs.diagrams.mock.staticRule': 'Răspuns static: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'REȚEA REALĂ',
  'workbench.docs.diagrams.mock.staticNever1': '(niciodată atinsă)',
  'workbench.docs.diagrams.mock.staticNever2': '— cerere scurtcircuitată',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'PAGINA PRIMEȘTE',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'răspuns sintetic servit',
  'workbench.docs.diagrams.mock.staticStamp': 'Corp + stare + antete fixe — serverul nu este contactat niciodată.',
  'workbench.docs.diagrams.mock.dynamicRule': 'Răspuns dinamic: mascați câmpurile PII',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'RĂSPUNS REAL',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[redacted]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(răspuns real) →',
  'workbench.docs.diagrams.mock.dynamicStamp': 'Apelul real are loc în continuare; funcția dvs. rescrie corpul.',
  'workbench.docs.diagrams.mock.wontAria':
    'Simulările interceptează doar fetch / XHR inițiate din JS — resursele statice trec neschimbate. Folosiți un proxy ' +
    'local real pentru fixturile de subresurse.',
  'workbench.docs.diagrams.mock.wontStatic': 'Resurse statice (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Emise de browser — nu ating niciodată fetch / XHR.',
  'workbench.docs.diagrams.mock.wontNav': 'Navigări de pagină',
  'workbench.docs.diagrams.mock.wontNavSub': 'Încărcările HTML de nivel superior ocolesc complet motorul de scripturi.',
  'workbench.docs.diagrams.mock.suggestionText': 'Folosiți un proxy local real pentru fixturile de subresurse.',
  'workbench.docs.diagrams.mock.useCasesAria':
    'Corp + stare de răspuns — cazuri frecvente: dezvoltare offline, simulare de erori, mascarea PII, forme de conținut util pentru ' +
    'cazuri-limită.',
  'workbench.docs.diagrams.mock.caseOffline': 'Dezvoltare offline',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'Înlocuitor pentru întregul API',
  'workbench.docs.diagrams.mock.caseError': 'Simulare de erori',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Forțați 500 pe o singură rută',
  'workbench.docs.diagrams.mock.casePii': 'Mascarea PII',
  'workbench.docs.diagrams.mock.casePiiEx': 'Mascați e-mailurile pe fir',
  'workbench.docs.diagrams.mock.caseEdge': 'Cazuri-limită',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Matrice goale, conținut util uriaș',
  'workbench.docs.diagrams.mock.useCasesFooter': 'Static = mod fixtură · Dinamic = trecere prin apel real + editare.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Regiunile de focalizare ale Workbench — bara laterală stângă, editorul, bara laterală dreaptă și panoul de jos — fiecare etichetată cu ' +
    'combinația ei de taste de focalizare.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Combinațiile de focalizare vă duc într-una din patru regiuni',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Bară stângă',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Editor',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Bară dreaptă',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Bară de jos',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Reasociați orice combinație în setările Tastatură.',

  // ── Wire mirrors (whole-raw in every locale) ────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
