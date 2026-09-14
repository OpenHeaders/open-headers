/**
 * Workbench Docs panel — the System Status section body — Romanian.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals and state tokens ride raw (in `<code>` at
 * the render site) inside keyed prose; every pill MESSAGE string
 * (Connected to desktop, N active DNR rule(s), Last request:, All
 * host permissions granted, Schema drift: dropped entry from, N
 * workflows fresh, …) rides raw as a wire mirror (S18, ja / zh-CN /
 * ko / ru parity). The six subsystem names quote `ro/shared-chrome.ts`
 * (Sincronizare / Reguli / Cereri / Permisiuni / Secrete / Live — the
 * docs `liveName` is raw `Live` because the ro footer pill is Live);
 * the settings path quotes `ro/workbench-settings*.ts` (Aplicație ›
 * Date › Export jurnal de diagnostic — jurnalul de diagnostic = the
 * Observability log in prose too); Trimitere = the Send button
 * (editors); pastilă = pill; subsistem; durată de viață = lifetime;
 * plafon = cap; extractor; service worker raw (service worker-ul);
 * flux de lucru carried; lowercase `vault` per-case law (vault-ul).
 * MINTS: executor = executor; backoff exponențial = exponential
 * backoff (backoff raw apposition); hidratare = hydrate; deviere =
 * drift (carried from spec); text cifrat = cipher; cadență =
 * cadence; proaspăt / învechit / în eșec = fresh / stale / failing;
 * trei zone = three-zone. State-row bodies after a raw message label
 * open with a dash or a parenthesis as en does (the render site joins
 * with a space); the fragment after a code chip joined with no space
 * opens with `,` per en; the bold term opens `este un instantaneu viu
 * al sănătății extensiei.`
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'Starea sistemului',
  'workbench.docs.body.systemStatus.intro1':
    'este un instantaneu viu al sănătății extensiei. Subsolul ferestrei Workbench o afișează ca un rând de șase pastile — o pastilă per subsistem, fiecare cu propriul punct colorat. Fereastra popup și panoul lateral o restrâng la o singură intrare',
  'workbench.docs.body.systemStatus.intro1Suffix':
    'în subsolul lor de jos, culoarea punctului urmărind subsistemul cu starea cea mai proastă.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    'În Workbench, rândul stă în subsol, cu o pastilă per subsistem.',
  'workbench.docs.body.systemStatus.popupCaption':
    'Apăsați pictograma din bara de instrumente și aceeași stare apare ca o singură pastilă etichetată în subsolul ferestrei popup.',
  'workbench.docs.body.systemStatus.worstLevel1':
    'Fiecare subsistem raportează o singură stare, iar nivelul cel mai grav câștigă: roșu > galben > verde. Un singur roșu oriunde face punctul compus roșu.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Șase stări de subsistem se pliază într-una compusă prin max — roșu bate galben bate verde.',
  'workbench.docs.body.systemStatus.popover1':
    'Un clic pe orice pastilă deschide același popover cu detalii. Rândurile vin în două grupuri: gri mai întâi (fără evenimente încă în această durată de viață a service worker-ului) și colorate după (au raportat cel puțin o dată). În fiecare grup se păstrează ordinea canonică a subsistemelor. Istoricul complet se află în jurnalul de diagnostic — exportați din',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Aplicație › Date › Export jurnal de diagnostic',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Griurile deasupra separatorului, coloratele dedesubt; la primul raport un rând migrează o singură dată.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'verde',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'galben',
  'workbench.docs.body.systemStatus.stateRedLabel': 'roșu',
  'workbench.docs.body.systemStatus.syncName': 'Sincronizare',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Conexiunea cu aplicația desktop',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Reproduce conexiunea WebSocket dintre service worker-ul extensiei și aplicația desktop OpenHeaders care rulează pe computerul dvs. Legătura este doar loopback (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') și transportă variabile dinamice, date de spațiu de lucru de echipă și prezență — nimic nu părăsește dispozitivul dvs.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'O singură conexiune WebSocket între extensie și aplicația desktop pe localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'Pastila reflectă starea conexiunii live. O cădere declanșează reconectări cu backoff exponențial; ping-urile periodice detectează deconectările silențioase din spatele proxy-urilor corporative stricte.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Dezactivat și Conectat sunt verzi; Se conectează, Se reconectează și URL respins sunt galbene.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(handshake reușit) sau',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(conectare automată dezactivată).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': ', sau',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Rezervat pentru eșecurile fatale de sincronizare cu aplicația desktop; niciun traseu de cod nu îl emite astăzi.',
  'workbench.docs.body.systemStatus.rulesName': 'Reguli',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'Motorul declarativeNetRequest',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Raportează la fiecare recompilare DNR. Fiecare salvare trece regula dvs. prin patru etape înainte de a intra în vigoare: compilare în DNR JSON, rezolvarea referințelor',
  'workbench.docs.body.systemStatus.rules1Middle':
    ', aplicarea plafonului de reguli active, apoi aplicarea prin browserul Chrome, cu',
  'workbench.docs.body.systemStatus.rules1Suffix': 'API. Fiecare etapă poate comuta pastila.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Patru etape — fiecare poate emite un nivel de stare dacă ceva merge prost.',
  'workbench.docs.body.systemStatus.rules2':
    'Numărul de reguli active se traduce într-o stare pe o bară de capacitate cu trei zone. Regulile peste plafon sunt eliminate în ordinea potrivirii (cea de sus câștigă), iar mesajul galben poartă numărul celor eliminate.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Verde până la pragul de avertizare, galben până la plafon, roșu dincolo — dar trunchierea vă ține în afara zonei roșii la rulare.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'sau',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Referințe',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'nerezolvate (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), plafonul de reguli a fost depășit (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': ') sau vă apropiați de capacitatea DNR (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Eșec de transport — browserul Chrome a respins actualizarea regulilor dinamice sau de sesiune (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Cereri',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'Executorul de cereri API',
  'workbench.docs.body.systemStatus.requests1Prefix': 'Reflectă ultima cerere API ad-hoc lansată din butonul',
  'workbench.docs.body.systemStatus.requestsSend': 'Trimitere',
  'workbench.docs.body.systemStatus.requests1Middle': 'al editorului de cereri. Pastila devine verde pentru',
  'workbench.docs.body.systemStatus.requestsAny': 'orice',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'răspuns HTTP — inclusiv 4xx și 5xx — pentru că „cererea s-a încheiat” este o întrebare separată de „serverului i-a plăcut”. Doar eșecurile la nivel de rețea, fără răspuns, o fac galbenă.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Orice cod de stare = verde. Galbenul este rezervat eșecurilor fără niciun răspuns.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    'Traficul de fundal nu actualizează această pastilă: reîmprospătările fluxurilor de lucru Live trec prin',
  'workbench.docs.body.systemStatus.requests2Suffix':
    ', iar cererile paginilor web trec prin motorul de reguli, nu prin executor.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Doar traficul ad-hoc al butonului Trimitere modelează această pastilă — tot restul rămâne tăcut.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— orice răspuns HTTP (de ex.',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— eșec la nivel de rețea înainte de un răspuns (de ex.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', offline/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Permisiuni',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Audit al permisiunilor de gazdă',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    'Regulile DNR și scripturile de conținut care țintesc o gazdă revocată din',
  'workbench.docs.body.systemStatus.permissions1Middle':
    'nu dau eroare — pur și simplu nu fac nimic, în tăcere. Singura sarcină a acestui audit este să scoată la iveală acea stare ascunsă, altfel ați petrece 30 de minute depanând o regulă care',
  'workbench.docs.body.systemStatus.permissionsLooks': 'pare',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'în regulă.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Acordată: regula se declanșează. Restrânsă: regula nu face nimic în tăcere, iar antetul nu ajunge niciodată.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'Auditul interoghează',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'la fiecare trezire a service worker-ului. MV3 nu are un observator al schimbărilor de permisiuni în Chromium, așa că interogarea la trezire este cel mai ieftin semnal pe care îl putem obține.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'Un apel, trei ramuri — verde pentru acordate, roșu pentru restrânse, galben dacă apelul API în sine eșuează.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'rămâne acoperită.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '— neobișnuit; browserul nu a expus',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— unele reguli nu vor face nimic, în tăcere, pe gazdele revocate până când accesul este restaurat din',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'Secrete',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Integritatea secțiunii Vault',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Urmărește blob-ul de vault criptat per spațiu de lucru din',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. La fiecare trezire a service worker-ului, fiecare secret stocat este validat față de schema curentă; intrările care pică validarea sunt eliminate din vault-ul din memorie, iar pastila devine galbenă până când sunt salvate din nou.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'Hidratarea încarcă blob-ul; validatorul de schemă păstrează potrivirile, elimină devierile și raportează galben.',
  'workbench.docs.body.systemStatus.secrets2':
    '„Deviere” înseamnă de obicei că o intrare stocată a fost scrisă de un build mai vechi (îi lipsește un câmp acum obligatoriu sau un câmp are tipul greșit). Sarcina validatorului este să eșueze zgomotos — moștenirea în tăcere a formelor necunoscute este ceea ce provoacă eroarea șase versiuni mai târziu.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Aceleași două câmpuri, alăturate: o intrare validă față de o intrare deviată, fără text cifrat și cu un createdAt de tip greșit.',
  'workbench.docs.body.systemStatus.secretsGreen':
    'Implicit — niciun eveniment de deviere de schemă în această durată de viață a service worker-ului.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '— cel puțin o intrare stocată în vault nu a corespuns formei curente și a fost eliminată la hidratare. Salvarea din nou din editorul Vault o restaurează.',
  'workbench.docs.body.systemStatus.secretsRed':
    'Rezervat pentru eșecurile de decriptare a textului cifrat; niciun traseu de cod nu îl emite astăzi.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Reîmprospătarea fluxurilor de lucru ale variabilelor Live',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Fiecare flux de lucru Live se reîmprospătează în propria cadență. Starea per flux de lucru depinde de trei verificări: dacă ultimul extractor a reușit, dacă rularea se încadrează în',
  'workbench.docs.body.systemStatus.live1Suffix':
    'cadența sa și câte eșecuri consecutive a avut. Cele trei stări se pliază în pastilă prin „cel mai grav câștigă”.',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Proaspăt = rulare curată · învechit = peste 2× cadența sau 1–4 eșecuri · în eșec = ≥ 5 eșecuri consecutive.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Doar fluxurile de lucru ale',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': 'spațiului de lucru activ',
  'workbench.docs.body.systemStatus.live2Suffix':
    'contribuie. Spațiile de lucru inactive sunt excluse — nu puteți vedea sau acționa asupra acelor reguli acum, așa că semnalarea lor ar scoate la iveală zgomot la care nu ajungeți. Comutarea spațiilor de lucru recalculează pastila față de noul set activ.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Fluxurile de lucru ale spațiului activ se pliază într-o singură pastilă prin max(); celelalte spații de lucru sunt sărite.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '— ultima rulare a fiecărui flux de lucru din spațiul activ a fost OK și în limita a 2× cadența sa. Afișat și ca',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': 'când nu există niciunul.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— cel puțin o rulare a depășit 2× cadența, ultimul extractor a eșuat sau există 1–4 eșecuri consecutive.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— un singur flux de lucru a depășit cinci eșecuri consecutive și este acum considerat în eșec.',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Aplicația desktop — notă de produs',
  'workbench.docs.body.systemStatus.desktopNote1':
    'Aplicația desktop este în dezvoltare și se livrează după ce extensia se stabilizează. Spațiile de lucru, variabilele și sincronizarea de echipă care se integrează cu aplicația desktop se deblochează atunci. Subsistemul',
  'workbench.docs.body.systemStatus.desktopNote2':
    'trece automat de la dezactivat la conectare la prima lansare — nu este necesară reinstalarea.',
} as const satisfies Catalog;
