/**
 * Workbench settings — the DevTools-panel setting-definition corpus —
 * Romanian. Mirrors `catalogs/en/workbench-settings-defs-devpanel.ts`
 * key for key; see that file for the corpus rules. Parity vocabulary
 * named inside values rides raw (the column names Name / Waterfall /
 * Data, the tool names Network / Storage / Console / Search, the
 * milestones Finish / DOMContentLoaded / DCL / Load, the metric names
 * Start / Response / End time / Total duration / Latency in the
 * option descriptions' en-anchored positions, the sortBy column names
 * as the ru / ko did, `mode` / `column` as the wire values, Train-Case,
 * HAR, A → Z, `Server-Timing`, Content-Download, the header and cookie
 * names). Every option label quotes the shipped ro panel menus
 * VERBATIM: the sort modes (Eșecurile mai întâi / Cele mai lente mai
 * întâi / Cele mai mari mai întâi / Prioritatea browserului / După
 * tipul resursei / După domeniu / Modificate de reguli mai întâi), the
 * layout pair Compact / Lat, Personalizată (imbricată), Crescător /
 * Descrescător, the value rows Întotdeauna / La trecerea cursorului /
 * Dezactivat, Relativ / Marcaj de timp, Local / UTC, Auto / Compact /
 * Lat, Afișare puncte de declanșare a regulilor, the headers rows
 * Grupat / Plat / Original / A → Z / Modificate de reguli mai întâi /
 * Train-Case / Original (brut) / Afișare etichete / Afișare sugestii /
 * Numai modificate de reguli / Numai antete de securitate / Numai
 * suprascriibile / Ascundere zgomot, the initiator rows Ordinea
 * inițiatorilor / Cronologic / Cel mai mare subarbore / Numai eșecuri
 * / Numai terțe, the cookies rows Original / A → Z / Dimensiune /
 * Expires / Relativ / Absolut / Decodificare valori codificate URL /
 * Grupare după rol / Numai probleme, the timing rows (Afișare bandă de
 * context / defalcare pe faze / bară de timp / Server-Timing /
 * repetări în sesiune / rată de transfer), the footer rows Instrumentul
 * focalizat / Numai instrumentul Network and the layout menu rows
 * (panel.ts). MINTS: Sfera rezumatului = Summary Scope (the shipped
 * `panel.info.view.scopeHeading` wording — sferă serves the footer
 * summary referent as it shipped in S115; cuprindere NOT minted);
 * Cumulat (toate navigările) / Doar pagina curentă = the footer timing
 * scope; cipul de valoare = the Waterfall value chip; coloana de
 * puncte = the dot column; Sursa sortării = Sort Source; Mod / Coloană
 * = the sort-source pair; Metrică = the Waterfall metric; Valori =
 * Values; Format valoare carried; Fusul orar al marcajului de timp;
 * Explicare valoare carried; Aspect popover; Aspectul mesajelor;
 * Afișare previzualizare conținut util = Show Payload Preview; Sortare
 * copii = Children Sort; Majuscule în nume carried; Format Expires;
 * Afișare cookie-uri de cerere filtrate = the filtered-out toggle.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Afișare versiune',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Afișează numărul versiunii extensiei în bara de stare a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'Afișare comutator de temă',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Afișează lista derulantă de temă luminoasă/întunecată/automată în bara de stare a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': 'Afișare număr modificate',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Afișează câte cereri au modificat efectiv regulile dvs. în bara de stare a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': 'Afișare număr eșuate',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Afișează câte cereri au eșuat sau au returnat o stare de eroare în bara de stare a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Afișare număr din cache',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Afișează câte cereri au fost servite din cache în bara de stare a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Afișare pagina curentă',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Etichetează reperele de timp cu pagina pe care o descriu în bara de stare a panoului DevTools — util cu „Păstrare jurnal” pe parcursul mai multor navigări.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Sfera timpilor',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Ce navigare descriu reperele Finish / DOMContentLoaded / Load din bara de stare a panoului DevTools. Cumulat acoperă întreaga cronologie cu jurnalul păstrat, de la prima navigare (ca în browser); Doar pagina curentă raportează doar ultima navigare.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Cumulat (toate navigările)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load acoperă întreaga cronologie de la prima navigare — valoarea implicită a browserului.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Doar pagina curentă',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load raportează doar ultima navigare, ancorate la momentul în care a început.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Sfera rezumatului',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'Ce rezumă bara de stare a panoului DevTools. Instrumentul focalizat urmează fereastra de instrumente în care lucrați (Storage, Console și Search au propriile rânduri de rezumat); Numai instrumentul Network afișează întotdeauna cifrele Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Instrumentul focalizat',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'Subsolul urmează fereastra de instrumente focalizată — Storage, Console și Search își afișează propriile rezumate; celelalte instrumente revin la rândul Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Numai instrumentul Network',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'Subsolul afișează întotdeauna cifrele Network, indiferent de fereastra de instrumente focalizată.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': 'Afișare comutatoare de panouri',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Afișează pictogramele de comutare a panourilor din stânga / de jos / din dreapta în bara de sus a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'Afișare meniu de aspect',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Afișează lista derulantă de aspect (panou inferior pe toată lățimea, etichete ale ferestrelor de instrumente, aspectul barei laterale) în bara de sus a panoului DevTools.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Alinierea panoului inferior',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Unde stă panoul inferior în panoul DevTools. Stânga/dreapta îl aliniază sub o bară laterală + editor; centrat îl imbrică în coloana din mijloc; justificat îl întinde pe toată lățimea.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Centrat (imbricat)',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Panoul inferior imbricat în coloana din mijloc',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Stânga',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'Panoul inferior se întinde sub bara laterală stângă + editor',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Dreapta',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'Panoul inferior se întinde sub editor + bara laterală dreaptă',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Justificat (lățime completă)',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Panoul inferior se întinde pe toată lățimea panoului DevTools',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': 'Împărțirea panoului inferior',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    'Cum împart două docuri deschise panoul inferior: unul lângă altul sau unul deasupra celuilalt.',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': 'Alăturat',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description':
    'Docurile inferioare stau unul lângă altul',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': 'Suprapus',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description':
    'Docurile inferioare se așază unul deasupra celuilalt',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'Afișare nume ferestre de instrumente',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Afișează etichete text lângă pictogramele din bara de activități și din filele docurilor în panoul DevTools. Dezactivată implicit, deoarece panoul este mai îngust decât spațiul de lucru.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Lățimea barei de activități din stânga',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Lățimea barei de activități din stânga în panoul DevTools când etichetele ferestrelor de instrumente sunt vizibile. Fixată la 36px în modul doar cu pictograme.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Lățimea barei de activități din dreapta',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Lățimea barei de activități din dreapta în panoul DevTools când etichetele ferestrelor de instrumente sunt vizibile. Fixată la 36px în modul doar cu pictograme.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Aspect bară de activități',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'Cum împarte bara de activități grupurile de ferestre de instrumente de sus și de jos în panoul DevTools.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proporțional',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Grupurile de sus și de jos împart bara de activități 50/50',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Grupul de sus se dimensionează după conținut; cel de jos e fixat jos',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Suprapus',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'Toate grupurile adunate sus, cu separatoare între ele',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dinamic',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Grupurile de cipuri urmează înălțimile panourilor adiacente. Docurile închise se restrâng la conținut, iar vecinii activi preiau spațiul.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Aspect',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Cum absoarbe tabelul Network spațiul orizontal. Compact lasă coloanele elastice (Name, Waterfall) să se întindă pe lățimea panoului, astfel încât tabelul nu derulează niciodată orizontal; Lat plafonează acele coloane și derulează orizontal pentru rest.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description':
    'Coloanele elastice absorb lățimea panoului.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Lat',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Lățimi plafonate, derulează orizontal la nevoie.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Aspectul mesajelor',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Cum absoarbe grila de cadre Messages spațiul orizontal. Compact lasă coloana Data să se întindă pe lățimea panoului, astfel încât grila nu derulează niciodată orizontal; Lat o plafonează și derulează orizontal la nevoie.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'Coloana Data absoarbe lățimea panoului.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Lat',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Lățimi plafonate, derulează orizontal la nevoie.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Afișare previzualizare conținut util',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Afișează panoul de previzualizare a conținutului util sub grilele Messages / EventStream — împărțirea redimensionabilă în care cadrul sau evenimentul selectat se redă ca arbore JSON, text brut sau vizualizator binar. Dezactivați pentru a da grilei tot panoul.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Sursa sortării',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Ce parte a stării de sortare este activă. `mode` rulează unul dintre modurile de sortare compuse cu nume (Eșecurile mai întâi / Cele mai lente mai întâi / …). `column` rulează sortarea pe o singură coloană aleasă de utilizator cu un clic pe antetul coloanei. Panoul comută automat — clicul pe un antet de coloană o setează la `column`; alegerea unui mod din meniul Vizualizare o setează la `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Mod',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description':
    'Folosește un mod de sortare compus cu nume.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Coloană',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Folosește sortarea pe o singură coloană aleasă de utilizator.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Personalizată (imbricată)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Folosește lanțul de sortare cu chei multiple construit de utilizator.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Mod de sortare',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Ordine de sortare compusă cu nume — axa principală, apoi sosirea la egalitate. Activ când sursa sortării = `mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Eșecurile mai întâi',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Eșuate → în așteptare → redirecționate → reușite.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Cele mai lente mai întâi',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Cea mai lungă durată mai întâi.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Cele mai mari mai întâi',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description':
    'Cei mai mulți octeți în rețea mai întâi.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Prioritatea browserului',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'De la cea mai mare la cea mai mică prioritate raportată.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'După tipul resursei',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Grupate după tipul resursei, sosirea în cadrul grupului.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'După domeniu',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    'Grupate după numele de gazdă, sosirea în cadrul grupului.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Modificate de reguli mai întâi',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Regulile aplicate mai întâi, sosirea în cadrul grupului.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Sortare după',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Ce coloană conduce sortarea prin clic pe coloană. Activă când sursa sortării = `column`. Clicul pe un antet de coloană actualizează această valoare.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Cronologie după metrica Waterfall activă (ora de început implicit).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Numărul cererii — ordinea în care au fost descoperite cererile.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'Metoda HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Ultimul segment al adresei URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Calea + interogarea.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'Adresa URL completă.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Codul de stare al răspunsului.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'Versiunea HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Partea de gazdă a adresei URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'Adresa IP a serverului.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Tipul resursei.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'Ce a declanșat cererea.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Numărul de cookie-uri din cerere.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description':
    'Numărul de antete Set-Cookie din răspuns.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Octeți în rețea.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Durata totală a cererii.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Prioritatea atribuită de browser.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Direcția sortării',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Ordine crescătoare sau descrescătoare pentru coloana de sortare Network curentă.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Crescător',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Cele mai mici mai întâi.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Descrescător',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Cele mai mari mai întâi.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Metrică',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'După ce timp sortează și desenează coloana Waterfall. Start / Response / End time așază barele pe o cronologie absolută; Total duration și Latency aliniază barele la zero, astfel încât lungimile se compară direct.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'Când a început cererea.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'Când a sosit primul octet al răspunsului.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'Când s-a încheiat cererea.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'Cât a durat cererea de la un capăt la altul.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'Timpul până la primul octet al răspunsului.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Afișare puncte de declanșare a regulilor',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Afișează coloana de 14px din față care poartă punctul colorat ce marchează potrivirile de reguli (plin = o regulă aplicată efectiv, gol = dedusă). Dezactivați pentru a recupera pixelii orizontali în panourile dense.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Valori',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'Când se afișează pe bară valoarea (valorile) metricii Waterfall active — cipul Start / Response / End time pentru metricile de cronologie sau etichetele de așteptare / descărcare pentru Total duration și Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Întotdeauna',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description':
    'Păstrează cipul de valoare vizibil.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'La trecerea cursorului',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Dezvăluie cipul de valoare la trecerea cursorului peste rând.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Dezactivat',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Ascunde cipul de valoare.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Format valoare',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'Cum se citește valoarea unei metrici de cronologie: Relativ este decalajul față de prima cerere din vizualizare; Marcaj de timp este momentul absolut al ceasului. Total duration și Latency sunt întotdeauna durate, indiferent de alegere.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relativ',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Decalajul față de prima cerere din vizualizare.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Marcaj de timp',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Momentul absolut al ceasului.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Fusul orar al marcajului de timp',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Fusul orar pentru formatul de valoare Marcaj de timp — ora locală sau UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Local',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Fusul dvs. orar local.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Timpul universal coordonat.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Explicare valoare',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'În popover-ul Waterfall de la trecerea cursorului, marchează și evidențiază rândurile de fază care compun totalul și afișează suma lor ca formulă. Doar un ajutor vizual — nu schimbă nicio valoare.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Aspect popover',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Orientarea defalcării timpilor Waterfall la trecerea cursorului. Compact așază pașii unul sub altul în popover; Lat întinde aceeași scară pe o axă a timpului; Auto alege după lățimea panoului — lat pe un panou andocat jos, compact pe unul îngust (andocat lateral).',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Pașii așezați unul sub altul în popover.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Lat',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Pașii întinși pe o axă orizontală a timpului.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Lat când panoul este lat, altfel compact.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Aspect',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'Cum sunt organizate rândurile de antete în secțiunile Request/Response. Grupat așază rândurile pe categorii (Auth, CORS, Caching, …); Plat redă o singură listă în ordinea de sortare aleasă.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Grupat',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Rânduri așezate pe categorii.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Plat',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'O singură listă, fără titluri de categorie (în stilul Chrome).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Sortare',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Ordinea rândurilor în fiecare listă (și în fiecare grup, când sunt grupate). Original păstrează ordinea în care serverul a trimis antetele (ordinea HAR); A → Z sortează după nume; Modificate de reguli mai întâi ridică sus rândurile modificate de reguli.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'Ordinea HAR.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alfabetic.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Modificate de reguli mai întâi',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description':
    'Rândurile modificate de reguli sus.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Majuscule în numele antetelor',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'Cum se afișează numele antetelor. Train-Case canonicalizează fiecare nume (`Content-Type`, `Set-Cookie`, `ETag`) pentru a se potrivi cu fereastra DevTools din Chrome/Firefox — mai ușor de parcurs. Original păstrează scrierea brută trimisă de server (HTTP/2+ scrie totul cu minuscule pe fir).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Exact ce a trimis serverul (adesea cu minuscule pe HTTP/2+).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Afișare etichete de valoare',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Afișează etichetele per valoare pe rândurile de antete (Cache-Control / Set-Cookie / HSTS / decodare JWT, …). Dezactivați pentru o vizualizare strânsă, doar cu valori.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Afișare sugestii',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Afișează cardurile de avertisment acționabile din partea de sus a filei Headers (configurări CORS greșite, CSP/HSTS lipsă, cookie-uri nesigure, JWT expirat, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Ascundere antete de zgomot',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Pliază antetele cu semnal slab (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). Indicația de sub fiecare secțiune listează numele ascunse la trecerea cursorului.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Numai modificate de reguli',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Afișează doar antetele adăugate, modificate sau eliminate de o regulă Open Headers.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Numai antete de securitate',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Afișează doar antetele legate de securitate (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Numai antete suprascriibile',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Ascunde antetele protejate pe care browserul nu lasă regulile să le suprascrie (host, content-length, sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Sortare copii',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'Cum sunt ordonate cererile copil în lanțul inițiatorilor. Ordinea inițiatorilor păstrează parcurgerea originală a grafului de inițiatori; Cronologic ordonează după ora cererii; Cel mai mare subarbore pune primul subarborele cel mai greu.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Ordinea inițiatorilor',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'În ordinea descoperirii.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Cronologic',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'După ora cererii.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Cel mai mare subarbore',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Subarborii cei mai grei mai întâi.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Afișare sugestii',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Afișează observațiile acționabile din partea de sus a filei Initiator (subcereri eșuate, gazdă dominantă, pondere terță, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Numai eșecuri',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Afișează doar rândurile eșuate sau blocate din lanțul inițiatorilor.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'Numai terțe',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Afișează doar rândurile de la origini diferite de originea paginii.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Sortare',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Ordinea rândurilor în fiecare secțiune de cookie-uri. Original păstrează ordinea folosită de server / cerere; A → Z sortează după nume; Dimensiune sortează după dimensiunea serializată a cookie-ului; Expires pune primele cookie-urile care expiră cel mai curând (Session ultimele).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'Așa cum au fost trimise / setate.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alfabetic după nume.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Dimensiune',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Cel mai mare cookie mai întâi.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Cea mai apropiată expirare mai întâi.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Format Expires',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Cum se redă expirarea cookie-urilor. Relativ afișează „în 2 z”, „acum 30 s”, „Session”; Absolut afișează data UTC parsată.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relativ',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absolut',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'Data UTC.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Afișare etichete',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Afișează etichetele de rol / ciclu de viață / context lângă numele fiecărui cookie (auth? / tracking? / pref / abia setat / eliminat / terț / partiționat / …). Dezactivați pentru o vizualizare strânsă, doar cu coloane.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Afișare sugestii',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Afișează cardurile de avertisment acționabile din partea de sus a filei Cookies (SameSite=None fără Secure, încălcări ale prefixelor __Host- / __Secure-, cookie-uri supradimensionate, expirate dar trimise, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Decodificare valori codificate URL',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Afișează valorile cookie-urilor cu codificarea procentuală decodificată („Europe%2FMadrid” → „Europe/Madrid”). Treceți cursorul peste valoare pentru forma brută.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Grupare după rol',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Grupează cookie-urile după rolul dedus în fiecare secțiune — Autentificare și sesiune mai întâi, apoi Funcționale, Preferințe, Analiză și urmărire. Bazată pe euristici; cipurile de rol (auth? / tracking? / pref) poartă semnul întrebării ca memento.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Afișare cookie-uri de cerere filtrate',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Reproduce comutatorul „show filtered out request cookies” din Chrome — listează și cookie-urile din jar care nu au fost trimise cu această cerere din cauza nepotrivirii de cale / Secure / SameSite / expirare.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Numai probleme',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Afișează doar cookie-urile care au declanșat un avertisment — Secure lipsă, încălcare de prefix, expirate dar trimise, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'Numai terțe',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Afișează doar cookie-urile al căror domeniu este cross-site față de originea cadrului principal.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Numai modificate de reguli',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Afișează doar cookie-urile a căror linie Cookie / Set-Cookie a fost adăugată, modificată sau eliminată de o regulă.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Afișare sugestii',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Afișează cardurile de avertisment cu blocajul + per fază din partea de sus a filei Timing. Dezactivați pentru o vizualizare doar cu cifre.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Afișare bandă de context',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Afișează rândul de cipuri protocol / conexiune / cache / prioritate / pornire / IP server deasupra defalcării pe faze.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Afișare defalcare pe faze',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Afișează secțiunile Resource Scheduling / Connection Start / Request-Response cu rânduri de milisecunde per fază.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Afișare bară de timp',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Afișează bara segmentată proporțională cu legenda per fază (și rândul Total de sub ea).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Afișare Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Afișează metricile parsate din antetul de răspuns `Server-Timing` când serverul a trimis vreuna.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Afișare repetări în sesiune',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Afișează comparația cu cea mai rapidă / mediana / cea mai lentă apariție a aceleiași adrese URL în sesiunea curentă a panoului.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Afișare rată de transfer',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Afișează debitul efectiv Content-Download (octeții corpului ÷ timpul de descărcare) când sunt cunoscute atât dimensiunea, cât și etapa de primire.',
} as const satisfies Catalog;
