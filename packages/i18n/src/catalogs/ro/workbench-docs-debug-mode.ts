/**
 * Workbench Docs panel — the Debug Mode section body — Romanian.
 * Mirrors `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI
 * labels the prose references copy the shipped `ro/shared-chrome.ts`
 * strings verbatim (Atașare la, Unde este deschisă fereastra DevTools,
 * Fila focalizată, Ambele, Includere această filă de browser, Filele
 * atașate, Filă în afara razei de acțiune, Modul Depanare) and the
 * docs nav title Starea sistemului (workbench-chrome); Suprascrieri =
 * the Overrides surface (panel.ts); atașare = attach; pastilă = pill;
 * rază de acțiune = the debug REACH (the attach scope here — never
 * sferă, the variable scope); Activat = the On state; the browser
 * banner quote rides verbatim raw en inside „…”. MINTS: Modul Depanare
 * dezactivat = the rules-list badge (a later editors-rule rider must
 * reuse); modul standard = standard mode; a revenit la euristică =
 * fell back to heuristic; cadre cross-origin = cross-origin frames
 * (cross-origin raw); worker raw (workeri); rezistent la CSP =
 * CSP-proof; fără curse = race-free; armare = arming. Raw by design:
 * the `● Debug mode` pill chip and the `fetch` / `XHR` code chips
 * composed by the section body (the fragment after the `XHR` chip
 * opens with `.` — the render site joins that pair with no space),
 * Chromium / Firefox / Safari with browser as head noun. The bold term
 * opens its body with the verb (the render site joins
 * `<strong>{term}</strong> {intro1}` with its own space); the en
 * `banner.` / `surface.` / `row:` tails move their noun into the
 * preceding fragment and leave the punctuation.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'Modul Depanare',
  'workbench.docs.body.debugMode.intro1':
    'atașează Open Headers la protocolul de depanare al browserului, astfel încât să poată inspecta și modifica traficul la care interfețele API obișnuite ale extensiilor nu ajung. Este același mecanism pe care îl folosesc instrumentele pentru dezvoltatori ale browserului — de aceea, cât timp este activ, browserul afișează bannerul',
  'workbench.docs.body.debugMode.introBanner': '„OH started debugging this browser”',
  'workbench.docs.body.debugMode.intro1Suffix': '.',
  'workbench.docs.body.debugMode.intro2':
    'Modul standard (modul Depanare dezactivat) acoperă deja majoritatea regulilor — antete, blocare, redirecționare, parametri de interogare și regulile de corp / răspuns / injectare din contextul paginii. Modul Depanare este upgrade-ul opțional pentru ce nu pot atinge acestea: navigări, workeri, cadre cross-origin și modificări de mediu la nivelul întregii file.',
  'workbench.docs.body.debugMode.controlHeading': 'Unde îl controlați',
  'workbench.docs.body.debugMode.control1Prefix': 'Pastila',
  'workbench.docs.body.debugMode.control1Middle': 'stă în subsolul fiecărei suprafețe, imediat în stânga rândului',
  'workbench.docs.body.debugMode.systemStatusLink': 'Starea sistemului',
  'workbench.docs.body.debugMode.control1Suffix':
    '. Comutatorul inline îl activează și îl dezactivează, punctul colorat îi urmărește sănătatea, iar punctul + eticheta deschid un popover cu tot restul — raza de acțiune, fixările per filă și lista filelor atașate în acest moment.',
  'workbench.docs.body.debugMode.surfaceCaption':
    'Comutatorul inline îl activează; punctul + eticheta deschid popover-ul pentru tot restul.',
  'workbench.docs.body.debugMode.scopeHeading': 'Alegerea a ce se inspectează',
  'workbench.docs.body.debugMode.scope1Prefix': 'Lista derulantă',
  'workbench.docs.body.debugMode.attachTo': 'Atașare la',
  'workbench.docs.body.debugMode.scope1Middle': 'decide la ce file se atașează modul Depanare —',
  'workbench.docs.body.debugMode.scopeDevtools': 'Unde este deschisă fereastra DevTools',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(doar filele cu panoul Open Headers deschis; cea mai îngustă valoare implicită),',
  'workbench.docs.body.debugMode.scopeFocused': 'Fila focalizată',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(urmează fila activă pe măsură ce comutați) sau',
  'workbench.docs.body.debugMode.scopeBoth': 'Ambele',
  'workbench.docs.body.debugMode.scope1BothParen': '(reuniunea celor două).',
  'workbench.docs.body.debugMode.consent1Prefix': 'Alegerea unei raze de acțiune',
  'workbench.docs.body.debugMode.consentIs': 'este',
  'workbench.docs.body.debugMode.consent1Middle':
    'consimțământul pentru bannerul browserului — nu există o solicitare separată. Când fila curentă nu este deja acoperită de raza de acțiune, apare fixarea',
  'workbench.docs.body.debugMode.includeTabPin': 'Includere această filă de browser',
  'workbench.docs.body.debugMode.consent1Suffix':
    ', ca să puteți atașa acea singură filă fără a lărgi raza de acțiune pentru tot restul.',
  'workbench.docs.body.debugMode.attached1Prefix': 'Lista',
  'workbench.docs.body.debugMode.attachedTabs': 'Filele atașate',
  'workbench.docs.body.debugMode.attached1Suffix':
    'afișează fiecare filă pe care modul Depanare o conduce în acest moment, fiecare cu o acțiune de salt la filă. Setul atașat este recalculat mereu din raza dvs. de acțiune, fixările dvs. și panourile deschise — așa că reflectă prezentul, niciodată un instantaneu învechit.',
  'workbench.docs.body.debugMode.scopeCaption':
    'Setul atașat este derivat de fiecare dată — reatașarea îl redă, nimic nu se stochează.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'Bannerul este la nivelul întregului browser',
  'workbench.docs.body.debugMode.banner1Prefix':
    'Cât timp modul Depanare este activ, bannerul browserului „OH started debugging this browser” apare pe',
  'workbench.docs.body.debugMode.bannerEvery': 'fiecare',
  'workbench.docs.body.debugMode.banner1Suffix':
    'filă — nu doar pe cele la care este atașat. Este comportamentul propriu al browserului; dezactivarea modului Depanare îl elimină imediat.',
  'workbench.docs.body.debugMode.unlocksHeading': 'Ce deblochează',
  'workbench.docs.body.debugMode.unlocksIntro':
    'Pe o filă atașată, regulile și comenzile trec dincolo de contextul paginii:',
  'workbench.docs.body.debugMode.anyRequestLead': 'Orice cerere, orice context.',
  'workbench.docs.body.debugMode.anyRequest1':
    'Simulați sau rescrieți navigările de nivel superior, cererile workerilor și iframe-urile cross-origin — nu doar apelurile din pagină',
  'workbench.docs.body.debugMode.anyRequest2':
    '. Corpurile cererilor și răspunsurilor pot fi citite și transformate în aceleași contexte, iar provocările de autentificare HTTP pot primi răspuns automat pentru proxy-uri de dezvoltare și staging.',
  'workbench.docs.body.debugMode.injectionLead': 'Injectare mai puternică.',
  'workbench.docs.body.debugMode.injection1':
    'Injectarea de scripturi devine fără curse și rezistentă la CSP și ajunge în interiorul workerilor și al cadrelor cross-origin, pe care calea standard din contextul paginii nu le poate atinge.',
  'workbench.docs.body.debugMode.tabEnvLead': 'Mediul filei.',
  'workbench.docs.body.debugMode.tabEnv1':
    'Dezactivare exactă a cache-ului, limitare de rețea / offline și suprascrieri de user-agent / limbă / fus orar / media — setate per filă din bara de instrumente a panoului și din suprafața',
  'workbench.docs.body.debugMode.overrides': 'Suprascrieri',
  'workbench.docs.body.debugMode.tabEnv2': '.',
  'workbench.docs.body.debugMode.reachCaption':
    'Modul standard acoperă fetch / XHR din pagină; o filă atașată extinde aceleași reguli la tot restul.',
  'workbench.docs.body.debugMode.silentHeading': 'Regulile nu eșuează niciodată în tăcere',
  'workbench.docs.body.debugMode.silent1Prefix':
    'O regulă care are nevoie de modul Depanare pentru efect complet afișează insigna',
  'workbench.docs.body.debugMode.badgeOff': 'Modul Depanare dezactivat',
  'workbench.docs.body.debugMode.silent1Middle': 'în lista de reguli cât timp este dezactivat, și nota',
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Filă în afara razei de acțiune',
  'workbench.docs.body.debugMode.silent1Middle2':
    'în panou când este activ, dar fila nu este în raza de acțiune. Regula rulează în continuare tot ce',
  'workbench.docs.body.debugMode.silentCan': 'poate',
  'workbench.docs.body.debugMode.silent1Suffix':
    'prin calea standard din contextul paginii — armarea modului Depanare doar extinde aceeași regulă la contextele la care injectarea în pagină nu ajunge.',
  'workbench.docs.body.debugMode.colorsHeading': 'Culorile de stare',
  'workbench.docs.body.debugMode.colors1Prefix': 'Punctul reproduce rândul',
  'workbench.docs.body.debugMode.colors1Suffix': 'din starea sistemului:',
  'workbench.docs.body.debugMode.statesCaption': 'Gri când este dezactivat; verde / galben / roșu odată activat.',
  'workbench.docs.body.debugMode.stateGreenLabel': 'verde',
  'workbench.docs.body.debugMode.stateOn': 'Activat',
  'workbench.docs.body.debugMode.stateOnRest':
    'și atașat curat. (Când este dezactivat, punctul este pur și simplu gri.)',
  'workbench.docs.body.debugMode.stateYellowLabel': 'galben',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'O filă',
  'workbench.docs.body.debugMode.stateYellowTerm': 'a revenit la euristică',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '— de obicei pentru că bannerul de depanare al browserului a fost închis, așa că fila revine la observarea standard.',
  'workbench.docs.body.debugMode.stateRedLabel': 'roșu',
  'workbench.docs.body.debugMode.stateRedPrefix': 'O filă',
  'workbench.docs.body.debugMode.stateRedTerm': 'nu s-a putut atașa',
  'workbench.docs.body.debugMode.stateRedSuffix': '— protocolul de depanare nu a putut fi angajat pentru ea.',
  'workbench.docs.body.debugMode.chromiumTitle': 'Doar Chromium',
  'workbench.docs.body.debugMode.chromium1':
    'Modul Depanare se bazează pe un protocol de depanare pe care doar browserele bazate pe Chromium îl expun extensiilor. În browserele Firefox și Safari pastila rămâne ascunsă; regulile din modul standard de mai sus funcționează peste tot.',
} as const satisfies Catalog;
