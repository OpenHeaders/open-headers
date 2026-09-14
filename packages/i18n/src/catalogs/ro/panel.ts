/**
 * DevTools panel — shell chrome — Romanian. Mirrors `catalogs/en/panel.ts`
 * key for key; see that file for the family map and the English
 * boundary (resource-type pills, throttle tier names, CDP method names,
 * header names, event names, chords, units and glyphs ride raw). The
 * tool-window nouns Network / Storage / Console / Docs ride raw as in
 * zh-CN / ja / ko / ru (parity vocabulary) and take a head noun
 * (fereastra, panoul, instrumentul) where prose needs one; Căutare /
 * Notificări / Activitate reguli / Reguli potrivite translate.
 * Mints: Păstrare jurnal = Preserve log; Mai multe filtre = More
 * filters; Vizualizare subsol = Footer View (subsol = the footer strip);
 * Dezactivare cache = Disable cache; limitare = throttling (Fără
 * limitare = No throttling); Suprascrieri = Overrides (system); bara de
 * activități = activity bar; fereastră de instrumente = tool window
 * (carried); șină = rail; doc = dock (carried); evidence chips
 * contrazisă / autoritară / confirmată / indirectă / silențioasă /
 * coroborată / dedusă = contradicted / authoritative / confirmed /
 * fallback / silent / corroborated / inferred (short feminine forms
 * agreeing with cerere — the popup's four carry over); apariție = hit;
 * În afara HAR = off-HAR; înveliș HAR = HAR shell; Atribuiți =
 * Attribute (tour imperative); instantaneu = snapshot; Decodat / Brut
 * = the Decoded / Raw readout toggle (Brut = raw, as received — batch
 * 2 carries it into the Formatted / Raw toggle); latență = latency
 * (throttle rows — figures keep en decimals inside raw unit strings
 * only where the whole value is raw; prose figures take the Romanian
 * decimal comma: 8,1 Mbit/s); setare regională = locale; fus orar =
 * timezone; conținut util = payload in prose (the Payload TAB rides
 * raw); modul Depanare = Debug mode (carried); sferă = scope (carried).
 * The devpanel settings option labels quote THESE menu-row values
 * verbatim when the ro settings-defs file lands.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Înregistrare jurnal de rețea',
  'panel.toolbar.stopRecording': 'Oprire înregistrare',
  'panel.toolbar.clear': 'Golire jurnal de rețea',
  'panel.toolbar.filter': 'Filtru',
  'panel.toolbar.search': 'Căutare',
  'panel.toolbar.preserveLog': 'Păstrare jurnal',
  'panel.toolbar.preserveLogTitle':
    'Păstrează cererile la navigările între pagini. Dezactivat, lista se golește la fiecare navigare sau reîncărcare, ca în panoul Network propriu al browserului.',
  'panel.toolbar.aboutPreserveLog': 'Despre „Păstrare jurnal”',
  'panel.toolbar.aboutMoreFilters': 'Despre „Mai multe filtre”',
  'panel.toolbar.aboutFooterView': 'Despre „Vizualizare subsol”',
  'panel.toolbar.moreTools': 'Mai multe instrumente',
  'panel.toolbar.activeWorkspaceAria': 'Spațiu de lucru activ: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Bară laterală stânga',
  'panel.toolbar.bottomPanel': 'Panou inferior',
  'panel.toolbar.rightSidebar': 'Bară laterală dreapta',
  'panel.toolbar.chooseBottomAlignment': 'Alegere aliniere panou inferior',
  'panel.toolbar.layoutOptions': 'Opțiuni de aspect',
  'panel.toolbar.bottomAlignTooltip.center': 'Panou inferior: centrat (imbricat)',
  'panel.toolbar.bottomAlignTooltip.left': 'Panou inferior: aliniat la stânga',
  'panel.toolbar.bottomAlignTooltip.right': 'Panou inferior: aliniat la dreapta',
  'panel.toolbar.bottomAlignTooltip.justify': 'Panou inferior: lățime completă',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomLayout': 'Aspect panou inferior',
  'panel.layout.alignCenter': 'Centrat (imbricat)',
  'panel.layout.alignLeft': 'Stânga',
  'panel.layout.alignRight': 'Dreapta',
  'panel.layout.alignJustify': 'Justificat (lățime completă)',
  'panel.layout.splitColumns': 'Alăturat',
  'panel.layout.splitRows': 'Suprapus',
  'panel.layout.showToolWindowNames': 'Afișare nume ferestre de instrumente',
  'panel.layout.activityBarLayout': 'Aspect bară de activități',
  'panel.layout.sidebarProportional': 'Proporțional (jumătăți egale)',
  'panel.layout.sidebarCompact': 'Compact (cel de jos fixat)',
  'panel.layout.sidebarStacked': 'Suprapus (toate sus)',
  'panel.layout.sidebarDynamic': 'Dinamic (urmează înălțimile panourilor)',
  'panel.layout.defaultLayoutDonor': 'Aspect implicit: {unit}',
  'panel.layout.inheritsDefault': 'Moștenește aspectul implicit',
  'panel.layout.donorTooltip': 'Acest element ({unit}) este cel implicit — noile {units} moștenesc acest aspect.',
  'panel.layout.nonDonorTooltip':
    'Un alt element ({unit}) este cel implicit — noile {units} moștenesc aspectul de acolo.',
  'panel.layout.resetToDefaults': 'Resetare aspect la valorile implicite',
  'panel.layout.restoreHidden': 'Restaurare instrumente ascunse din bara de activități',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Filtru',
  'panel.filter.clear': 'Golire',
  'panel.filter.clearAria': 'Golire filtru',
  'panel.filter.matchCase': 'Potrivire majuscule/minuscule (Alt+C)',
  'panel.filter.wholeWord': 'Potrivire cuvânt întreg (Alt+W)',
  'panel.filter.regex': 'Utilizare expresie regulată (Alt+R)',
  'panel.filter.more': 'Mai multe',
  'panel.filter.hiddenClearFilter': 'Golire filtru',
  'panel.filter.hiddenDismiss': 'Respingere',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': 'Resetare la valorile implicite',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'Mai multe filtre',
  'panel.moreFilters.hideDataUrls': 'Ascundere adrese URL de tip data',
  'panel.moreFilters.hideExtensionUrls': 'Ascundere adrese URL de extensii',
  'panel.moreFilters.blockedRequests': 'Cereri blocate',
  'panel.moreFilters.thirdParty': 'Cereri terțe',
  'panel.moreFilters.swRequests': 'Cereri service worker',
  'panel.moreFilters.ruleApplied': 'Cereri cu regulă aplicată',
  'panel.moreFilters.pageOriginPending': 'Originea paginii nu este încă disponibilă',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Vizualizare subsol',
  'panel.view.title': 'Alegeți ce statistici se afișează în subsol',
  'panel.view.focusedTool': 'Instrumentul focalizat',
  'panel.view.focusedToolTitle':
    'Subsolul urmează fereastra de instrumente focalizată — Storage, Console și Căutare își afișează propriile rezumate; celelalte instrumente revin la linia Network.',
  'panel.view.networkOnly': 'Numai instrumentul Network',
  'panel.view.networkOnlyTitle':
    'Subsolul afișează întotdeauna cifrele Network, indiferent de fereastra de instrumente focalizată.',
  'panel.view.modifiedCount': 'Număr modificate',
  'panel.view.failedCount': 'Număr eșuate',
  'panel.view.cachedCount': 'Număr din cache',
  'panel.view.pageLabel': 'Eticheta paginii curente',
  'panel.view.pageLabelTitle':
    'Când jurnalul acoperă mai multe navigări, denumește pagina descrisă de reperele de timp.',
  'panel.view.timingAllNavs': 'Timp pentru toate navigările',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load acoperă întreaga cronologie a jurnalului păstrat, de la prima navigare (implicitul browserului). Debifați pentru a raporta doar ultima navigare.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Export trafic',
  'panel.export.exportAll': 'Export toate ca HAR',
  'panel.export.exportAllSanitized': 'Export toate ca HAR (curățat)',
  'panel.export.copyAll': 'Copiere toate ca HAR',
  'panel.export.copyAllSanitized': 'Copiere toate ca HAR (curățat)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Dezactivare cache',
  'panel.cache.tooltipDebug':
    'Cache-ul se dezactivează la nivelul stivei de rețea (modul Depanare) — la fel ca opțiunea nativă „Dezactivare cache” a browserului.',
  'panel.cache.tooltipStandard':
    'Ocolește cache-ul HTTP forțând revalidarea. Activați modul Depanare pentru o dezactivare completă la nivelul stivei de rețea (inclusiv cache-ul din memorie).',
  'panel.cache.aboutAria': 'Despre „Dezactivare cache”',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'Fără limitare',
  'panel.throttle.custom': 'Personalizat',
  'panel.throttle.customEllipsis': 'Personalizat…',
  'panel.throttle.customHint': 'Setați descărcarea, încărcarea și latența.',
  'panel.throttle.customTitle': 'Limitare personalizată',
  'panel.throttle.download': 'Descărcare',
  'panel.throttle.upload': 'Încărcare',
  'panel.throttle.latency': 'Latență',
  'panel.throttle.appliesToTab': 'Se aplică acestei file',
  'panel.throttle.morePresets': 'Mai multe presetări',
  'panel.throttle.morePresetsSubtitle': 'Fibră, cablu, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Cu fir',
  'panel.throttle.mobile': 'Mobil',
  'panel.throttle.disabledTooltip':
    'Limitarea rețelei este disponibilă numai în modul Depanare. Activați modul Depanare pentru a limita această filă.',
  'panel.throttle.aboutAria': 'Despre limitarea rețelei',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · latență 2 ms',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · latență 8 ms',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · latență 25 ms',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · latență 8 ms',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · latență 18 ms',
  'panel.throttle.subtitle.fast4g': '≈8,1 Mbit/s · latență 165 ms',
  'panel.throttle.subtitle.slow4g': '≈1,44 Mbit/s · latență 562,5 ms',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · latență 2000 ms',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · latență 2000 ms',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · latență 3000 ms',
  'panel.throttle.subtitle.offline': 'Blochează tot traficul de rețea al filei.',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': 'Aplicare',
  'panel.debug.enableDebugMode': 'Activare mod Depanare',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Suprascrieri',
  'panel.overrides.disabledTooltip':
    'Suprascrierile de sistem sunt disponibile numai în modul Depanare. Activați modul Depanare pentru a suprascrie această filă.',
  'panel.overrides.aboutAria': 'Despre suprascrierile de sistem',
  'panel.overrides.wireHint':
    'Trimise cu cererile și raportate scripturilor paginii cât timp această filă rămâne în modul Depanare.',
  'panel.overrides.pageOnlyHint':
    'Numai pagina — acestea schimbă ce observă scripturile proprii și stilurile CSS ale paginii, nu cererile.',
  'panel.overrides.platform': 'Platformă',
  'panel.overrides.locale': 'Setare regională',
  'panel.overrides.timezone': 'Fus orar',
  'panel.overrides.colorScheme': 'Schemă de culori',
  'panel.overrides.reducedMotion': 'Mișcare redusă',
  'panel.overrides.printMedia': 'Media de tipărire',
  'panel.overrides.uaPlaceholder': 'Șir User-Agent personalizat',
  'panel.overrides.alPlaceholder': 'de ex. fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, de ex. Linux',
  'panel.overrides.localePlaceholder': 'Setarea regională reală',
  'panel.overrides.timezonePlaceholder': 'Fusul orar real',
  'panel.overrides.auto': 'Auto',
  'panel.overrides.light': 'Luminoasă',
  'panel.overrides.dark': 'Întunecată',
  'panel.overrides.reduce': 'Redusă',
  'panel.overrides.noPref': 'Fără preferință',
  'panel.overrides.screen': 'Ecran',
  'panel.overrides.print': 'Tipărire',
  'panel.overrides.resetAll': 'Resetare toate',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Păstrează cererile înregistrate la navigările și reîncărcările paginii, în loc să golească lista de fiecare dată când pagina se schimbă.',
  'panel.info.preserveLog.description':
    'Activat — jurnalul se transferă peste fiecare navigare, astfel încât cererile declanșate chiar înainte de o redirecționare, o trimitere de formular sau o reîncărcare rămân vizibile. Dezactivat — lista se golește la fiecare navigare sau reîncărcare, ca în panoul Network propriu al browserului, afișând doar traficul paginii curente.',
  'panel.info.preserveLog.whenHeading': 'Utilă atunci când',
  'panel.info.preserveLog.redirects': 'Redirecționări',
  'panel.info.preserveLog.redirectsDesc':
    'Inspectați cererea care a declanșat o navigare înainte ca noua pagină să o șteargă.',
  'panel.info.preserveLog.forms': 'Trimiteri de formulare / autentificări',
  'panel.info.preserveLog.formsDesc': 'Păstrați un POST și răspunsul său vizibile după reîncărcarea paginii.',
  'panel.info.preserveLog.reloadLoops': 'Bucle de reîncărcare',
  'panel.info.preserveLog.reloadLoopsDesc': 'Vedeți ce s-a declanșat chiar înainte ca pagina să se reîncarce singură.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Filtre secundare de cereri ascunse în spatele unui meniu — fiecare restrânge lista fără a ocupa spațiu de prim rang în bara de instrumente.',
  'panel.info.moreFilters.hideHeading': 'Ascundere',
  'panel.info.moreFilters.dataUrls': 'Adrese URL de tip data',
  'panel.info.moreFilters.dataUrlsDesc': 'Exclude resursele data: inline — imagini base64, fonturi și altele asemenea.',
  'panel.info.moreFilters.extensionUrls': 'Adrese URL de extensii',
  'panel.info.moreFilters.extensionUrlsDesc': 'Exclude cererile către originile extensiilor de browser.',
  'panel.info.moreFilters.onlyHeading': 'Afișare numai',
  'panel.info.moreFilters.blocked': 'Cereri blocate',
  'panel.info.moreFilters.blockedDesc': 'Restrânge lista la cererile blocate de o regulă.',
  'panel.info.moreFilters.thirdParty': 'Cereri terțe',
  'panel.info.moreFilters.thirdPartyDesc': 'Restrânge la cererile a căror origine diferă de cea a paginii.',
  'panel.info.moreFilters.swRequests': 'Cereri service worker',
  'panel.info.moreFilters.swRequestsDesc':
    'Restrânge la schimburile cu service worker-ul — cererile emise de worker însuși (rândurile ⚙) și cererile paginii la care a răspuns handler-ul său fetch.',
  'panel.info.moreFilters.ruleApplied': 'Cereri cu regulă aplicată',
  'panel.info.moreFilters.ruleAppliedDesc':
    'Restrânge la cererile pe care o regulă Open Headers le-a modificat în mod verificabil.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Alege ce statistici opționale afișează subsolul, pe lângă numărul de cereri și volumul transferat, afișate permanent.',
  'panel.info.view.scopeHeading': 'Sfera rezumatului',
  'panel.info.view.focusedTool': 'Instrumentul focalizat',
  'panel.info.view.focusedToolDesc':
    'Subsolul urmează fereastra de instrumente focalizată — Storage, Console și Căutare își afișează propriile linii de rezumat; celelalte instrumente revin la linia Network.',
  'panel.info.view.networkOnly': 'Numai instrumentul Network',
  'panel.info.view.networkOnlyDesc':
    'Subsolul afișează întotdeauna cifrele Network, indiferent de fereastra de instrumente focalizată.',
  'panel.info.view.countsHeading': 'Contoare din subsol',
  'panel.info.view.modified': 'Modificate',
  'panel.info.view.modifiedDesc': 'Câte cereri a schimbat o regulă.',
  'panel.info.view.failed': 'Eșuate',
  'panel.info.view.failedDesc': 'Câte cereri au dat eroare sau au fost blocate.',
  'panel.info.view.cached': 'Din cache',
  'panel.info.view.cachedDesc': 'Câte răspunsuri au fost servite din cache.',
  'panel.info.view.timingHeading': 'Timp',
  'panel.info.view.pageLabel': 'Eticheta paginii curente',
  'panel.info.view.pageLabelDesc':
    'Denumește pagina descrisă de reperele de timp când jurnalul acoperă mai multe navigări.',
  'panel.info.view.allNavs': 'Pentru toate navigările',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load acoperă întreaga cronologie a jurnalului păstrat, nu doar ultima navigare.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Împiedică această filă să servească răspunsuri din cache.',
  'panel.info.cache.debugDesc':
    'Această filă este în modul Depanare: cache-ul este dezactivat la nivelul stivei de rețea — inclusiv cache-ul din memorie — la fel ca opțiunea nativă „Dezactivare cache” a browserului.',
  'panel.info.cache.standardDesc':
    'Această filă este în modul standard: doar cache-ul HTTP este ocolit, cerând serverului să revalideze. Activați modul Depanare pentru o dezactivare completă la nivelul stivei de rețea, care golește și cache-ul din memorie.',
  'panel.info.cache.standardHeading': 'Modul standard',
  'panel.info.cache.revalidateDesc':
    'Adăugat la fiecare cerere pentru ca serverul să reverifice prospețimea. Ocolește doar cache-ul HTTP.',
  'panel.info.cache.debugHeading': 'Modul Depanare',
  'panel.info.cache.cdpDesc':
    'Dezactivează cache-ul pentru întreaga filă la nivelul stivei de rețea, inclusiv cache-ul din memorie.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'Suprascrieri de sistem',
  'panel.info.overrides.summary':
    'Fixează identitatea de sistem a acestei file — User-Agent, setarea regională, fusul orar și media emulată — pentru a vedea cum răspunde un site unui client diferit.',
  'panel.info.overrides.debugDesc':
    'Active pe această filă prin modul Depanare. Fațetele User-Agent se aplică cererilor și scripturilor paginii; setarea regională, fusul orar și media schimbă doar ce observă scripturile proprii și stilurile CSS ale paginii. „Resetare toate” restaurează valorile reale.',
  'panel.info.overrides.standardDesc':
    'Suprascrierile de sistem necesită modul Depanare — nu există o alternativă în modul standard. Activați modul Depanare și păstrați această filă în sferă pentru a o suprascrie.',
  'panel.info.overrides.wireHeading': 'În rețea + scripturile paginii',
  'panel.info.overrides.uaDesc':
    'Setează antetele User-Agent / Accept-Language, platforma și valorile navigator.* corespunzătoare.',
  'panel.info.overrides.pageHeading': 'Numai pagina',
  'panel.info.overrides.localeDesc': 'Schimbă setarea regională citită de scripturile paginii.',
  'panel.info.overrides.timezoneDesc': 'Schimbă fusul orar rezolvat de Date și Intl.',
  'panel.info.overrides.mediaDesc': 'Forțează interogările media color-scheme / reduced-motion / print.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Limitarea rețelei',
  'panel.info.throttle.summary':
    'Simulează conexiuni mai lente plafonând lățimea de bandă a acestei file și adăugând latență.',
  'panel.info.throttle.debugDesc':
    'Activă pe această filă prin modul Depanare. Alegeți o presetare — cele implicite plus fibră / cablu / DSL și 5G / 2G sub „Mai multe presetări” —, treceți Offline sau setați descărcarea / încărcarea / latența personalizat.',
  'panel.info.throttle.standardDesc':
    'Limitarea necesită modul Depanare — nu există o alternativă în modul standard. Activați modul Depanare și păstrați această filă în sferă pentru a o limita.',
  'panel.info.throttle.presetsHeading': 'Presetări',
  'panel.info.throttle.fast4gDesc': '≈8,1 Mbit/s descărcare, latență 165 ms.',
  'panel.info.throttle.slow4gDesc': '≈1,44 Mbit/s descărcare, latență 562,5 ms.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, latență 2000 ms.',
  'panel.info.throttle.offlineDesc': 'Blochează tot traficul de rețea al filei.',
  'panel.info.throttle.wiredHeading': 'Mai multe presetări · Cu fir',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, latență 2 ms.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s descărcare, latență 8 ms.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s descărcare, latență 25 ms.',
  'panel.info.throttle.mobileHeading': 'Mai multe presetări · Mobil',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s descărcare, latență 8 ms.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s descărcare, latență 18 ms.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, latență 2000 ms.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, latență 3000 ms.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    }),
  'panel.status.requestsSubset': '{subset} / {total} cereri',
  'panel.status.modified': 'modificate: {count}',
  'panel.status.modifiedTitle': 'Cereri modificate de regulile dvs.',
  'panel.status.failed': 'eșuate: {count}',
  'panel.status.failedTitle': 'Cereri eșuate sau cu stare de eroare',
  'panel.status.cached': 'din cache: {count}',
  'panel.status.cachedTitle': 'Cereri servite din cache',
  'panel.status.transferredOnly': '{size} transferat',
  'panel.status.transferredAndResources': '{transferred} transferat / {resources} resurse',
  'panel.status.transferredSubset': '{subset} / {total} transferat',
  'panel.status.resourcesSubset': '{subset} / {total} resurse',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Evenimentul Load',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} filă',
      few: '{count} file',
      other: '{count} de file',
    }),
  'panel.status.messagesOf': '{visible} din {total} mesaje',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} mesaj',
      few: '{count} mesaje',
      other: '{count} de mesaje',
    }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eroare',
      few: '{count} erori',
      other: '{count} de erori',
    }),
  'panel.status.errorsTitle': 'Mesaje din consolă la nivelul eroare',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} avertisment',
      few: '{count} avertismente',
      other: '{count} de avertismente',
    }),
  'panel.status.warningsTitle': 'Mesaje din consolă la nivelul avertisment',
  'panel.status.systemStatus': 'Sistem',
  'panel.status.theme.light': 'Luminoasă',
  'panel.status.theme.dark': 'Întunecată',
  'panel.status.theme.auto': 'Auto',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.capture.collapsePlane': 'Restrângere secțiune',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Căutare',
  'panel.toolWindows.notifications': 'Notificări',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Activitate reguli',
  'panel.toolWindows.matchedRules': 'Reguli potrivite',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': 'Căutare (apăsați Enter)',
  'panel.search.inputAria': 'Căutare în datele capturate',
  'panel.search.syntaxHelp': 'Ajutor pentru sintaxa de căutare',
  'panel.search.run': 'Căutare',
  'panel.search.runTitle': 'Rulare căutare (Enter)',
  'panel.search.cancel': 'Anulare',
  'panel.search.cancelTitle': 'Anulare căutare',
  'panel.search.idleHintMin': 'Introduceți o interogare (minimum 2 caractere) și apăsați Enter pentru a căuta.',
  'panel.search.idleHintShort': 'Apăsați Enter pentru a căuta.',
  'panel.search.noMatches': 'Nicio potrivire găsită.',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': 'Se caută… {done} / {total}',
  'panel.search.status.noResults': 'Niciun rezultat · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), {
      one: 'S-a găsit {count} potrivire',
      few: 'S-au găsit {count} potriviri',
      other: 'S-au găsit {count} de potriviri',
    });
    const where = plural(locale, Number(files), {
      one: '{count} fișier',
      few: '{count} fișiere',
      other: '{count} de fișiere',
    });
    return `${found} în ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'se afișează primele {shown} — rafinați interogarea pentru a vedea restul',

  // Result groups + rows
  'panel.search.group.countTitle': 'Potriviri în acest fișier: {count}',
  'panel.search.group.countTitleCapped': 'Potriviri în acest fișier: {count} — se afișează primele {shown}',
  'panel.search.row.lineCol': 'Linia {line}, col. {col}',
  'panel.search.row.line': 'Linia {line}',
  'panel.search.row.matchesOnLine': 'Potriviri pe această linie: {count}',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': 'Selectați o cerere pentru a vedea regulile',
  'panel.matchedRules.selectPrompt.tail': 'care i se aplică',
  'panel.matchedRules.matchedCount': 'Potrivite · {count}',
  'panel.matchedRules.futureCount': 'Potriviri viitoare · {count}',
  'panel.matchedRules.noMatched': 'Nicio regulă nu s-a potrivit cu această cerere.',
  'panel.matchedRules.noFuture': 'Nicio altă regulă nu s-ar potrivi cu această cerere.',
  'panel.matchedRules.pattern': 'Model: {pattern}',
  'panel.matchedRules.wouldMatch': 's-ar potrivi',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': 'contrazisă',
  'panel.matchedRules.evidence.authoritative': 'autoritară',
  'panel.matchedRules.evidence.confirmed': 'confirmată',
  'panel.matchedRules.evidence.fallback': 'indirectă',
  'panel.matchedRules.evidence.silent': 'silențioasă',
  'panel.matchedRules.evidence.corroborated': 'coroborată',
  'panel.matchedRules.evidence.inferred': 'dedusă',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Contrazisă — antetele capturate infirmă o modificare pretinsă de această regulă.',
  'panel.matchedRules.evidenceTitle.authoritative':
    'Autoritară — motorul de reguli a confirmat că această regulă DNR s-a executat pe cerere.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Confirmată — regula a modificat corpul în contextul paginii și ambele părți (servit vs. original) au fost capturate pentru această cerere.',
  'panel.matchedRules.evidenceTitle.confirmed':
    'Confirmată de raportorul din pagină — acțiunea scriptabilă a rulat în interiorul paginii.',
  'panel.matchedRules.evidenceTitle.fallback':
    'Dedusă din potrivirea adresei URL — se aștepta o confirmare scriptabilă, dar nu a sosit.',
  'panel.matchedRules.evidenceTitle.silent':
    'Modelul s-a potrivit, dar cererea a fost servită din cache / un service worker — nu a rulat nicio acțiune DNR sau scriptabilă.',
  'panel.matchedRules.evidenceTitle.corroborated':
    'Coroborată — modificarea pretinsă este vizibilă în antetele capturate.',
  'panel.matchedRules.evidenceTitle.inferred':
    'Dedusă din potrivirea adresei URL — regula s-ar potrivi cu această cerere pe baza condițiilor sale.',
  'panel.matchedRules.contradiction.stillPresent': 'Antetul {header} este încă prezent ({observed}).',
  'panel.matchedRules.contradiction.missing': 'Antetul {header} lipsește din antetele capturate.',
  'panel.matchedRules.contradiction.otherValue': 'Antetul {header} conține „{observed}” în locul valorii pretinse.',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': 'regulă ștearsă',
  'panel.matchedRules.ruleState.disabled': 'regulă dezactivată',
  'panel.matchedRules.ruleState.modified': 'regulă modificată',
  'panel.matchedRules.ruleStateTitle.deleted':
    'Această regulă a fost ștearsă de la declanșare. Rândul arată ce a făcut la momentul declanșării.',
  'panel.matchedRules.ruleStateTitle.disabled':
    'Această regulă a fost dezactivată de la declanșare — nu se va aplica următoarei cereri.',
  'panel.matchedRules.ruleStateTitle.modified':
    'Această regulă a fost editată de la declanșare. Rândul arată ce a făcut la momentul declanșării; treceți cursorul pentru a vedea regula curentă.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'Nicio activitate a regulilor pe această filă încă.',
  'panel.ruleActivity.toolbarHint': 'Activitatea regulilor grupată pe regulă.',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': 'Aplicate',
  'panel.ruleActivity.hint.appliedDesc':
    '— declanșări confirmate ca rulate: motorul de reguli a raportat că regula s-a executat, raportorul din pagină a confirmat că acțiunea a rulat sau modificarea este vizibilă în antetele capturate.',
  'panel.ruleActivity.hint.contradicted': 'Contrazise',
  'panel.ruleActivity.hint.contradictedDesc':
    '— declanșări care au pretins o schimbare de antet infirmată de antetele capturate.',
  'panel.ruleActivity.hint.inferred': 'Deduse',
  'panel.ruleActivity.hint.inferredDesc':
    '— declanșări care potrivesc modelele regulilor dvs. cu cererile observate, dar nu au putut fi confirmate.',
  'panel.ruleActivity.hint.offHar': 'În afara HAR',
  'panel.ruleActivity.hint.offHarDesc': '— potriviri de reguli pe cereri pe care panoul nu le-a capturat.',
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} apariție',
      few: '{count} apariții',
      other: '{count} de apariții',
    }),
  'panel.ruleActivity.applied': 'aplicate: {count}',
  'panel.ruleActivity.contradicted': 'contrazise: {count}',
  'panel.ruleActivity.offHar': 'în afara HAR: {count}',
  'panel.ruleActivity.offHarTitle': 'În afara HAR — panoul nu a capturat un înveliș HAR pentru această declanșare',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': 'Reguli',
  'panel.valueDoc.saveHint': 'Recodifică valoarea editată și o scrie înapoi în regulă',
  'panel.valueDoc.blockedHintInvalid': 'Textul editat nu poate fi codificat pentru acest tip de valoare',
  'panel.valueDoc.blockedHintDetached': 'Câmpul regulii căruia îi aparținea această valoare a dispărut',
  'panel.valueDoc.rereadTitle': 'Recitire valoare din regulă',
  'panel.valueDoc.rereadConfirm': 'Renunță la editările dvs. — apăsați din nou pentru recitire',
  'panel.valueDoc.rereadAria': 'Renunțare la editări și recitire valoare',
  'panel.valueDoc.openRuleTitle': 'Deschidere regulă în editorul spațiului de lucru',
  'panel.valueDoc.openRule': 'Deschidere regulă în spațiul de lucru',
  'panel.valueDoc.driftNote':
    'Valoarea s-a schimbat în regulă în timp ce editați — editările dvs. nesalvate sunt păstrate. Salvarea o suprascrie.',
  'panel.valueDoc.undetectedNote':
    'Câmpul nu mai conține o valoare pe care acest editor o poate codifica — editările dvs. nesalvate sunt păstrate pentru copiere.',
  'panel.valueDoc.detachedNote':
    'Câmpul regulii căruia îi aparținea această valoare a dispărut — editările dvs. nesalvate sunt păstrate pentru copiere.',
  'panel.valueDoc.discardEdits': 'Renunțare la editările mele',
  'panel.valueDoc.saveFailed.detached':
    'Modificarea căreia îi aparținea această valoare a dispărut din regulă — nu există unde să se scrie.',
  'panel.valueDoc.saveFailed.notFound': 'Regula nu a fost găsită — este posibil să fi fost ștearsă.',
  'panel.valueDoc.saveFailed.write': 'Salvarea a eșuat — regula a respins scrierea.',
  'panel.valueDoc.encodedPreview': 'Previzualizare codată',
  'panel.valueDoc.cannotEncode': 'Nu se poate codifica — valoarea editată nu este validă pentru acest tip',
  'panel.valueDoc.undetectedTitle': 'Nu mai este o valoare codată',
  'panel.valueDoc.undetectedSub':
    'Valoarea curentă a câmpului nu corespunde niciunui decodor — editați-o în editorul de reguli.',
  'panel.valueDoc.detachedTitle': 'Valoarea nu mai este în regulă',
  'panel.valueDoc.detachedSub':
    'Regula sau modificarea care conținea această valoare a fost ștearsă, sau operația nu mai poartă o valoare.',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  // The crumb's source name rides raw as data; the type title comes
  // from the shared value-editor title keys.
  'panel.valueView.snapshotNote': 'Instantaneu',
  'panel.valueView.snapshotTitle': 'Capturat la deschiderea acestui document — nu urmărește modificările ulterioare.',
  'panel.valueView.encodedValue': 'Valoare codată',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  // Rule names ride raw as data; status codes and MIME values stay raw.
  'panel.ruleDoc.crumbKind': 'Suprascriere răspuns',
  'panel.ruleDoc.nameLabel': 'Nume regulă',
  'panel.ruleDoc.saveHint': 'Salvează regula de suprascriere — rămâne publicată în același pas',
  'panel.ruleDoc.saveHintCreate': 'Creează regula și o publică',
  'panel.ruleDoc.blockedHintDetached': 'Regula căreia îi aparținea acest document a dispărut',
  'panel.ruleDoc.rereadTitle': 'Recitire regulă',
  'panel.ruleDoc.rereadConfirm': 'Renunță la editările dvs. — apăsați din nou pentru recitire',
  'panel.ruleDoc.rereadAria': 'Renunțare la editări și recitire regulă',
  'panel.ruleDoc.openRuleTitle': 'Deschidere regulă în editorul spațiului de lucru',
  'panel.ruleDoc.openRule': 'Deschidere în spațiul de lucru',
  'panel.ruleDoc.saveFailed.notFound': 'Regula nu a fost găsită — este posibil să fi fost ștearsă.',
  'panel.ruleDoc.saveFailed.write': 'Salvarea a eșuat — regula a respins scrierea.',
  'panel.ruleDoc.detachedTitle': 'Regula nu mai există',
  'panel.ruleDoc.detachedSub': 'Regula de suprascriere editată de acest document a fost ștearsă.',
  'panel.ruleDoc.dynamicTitle': 'Regulă cu corp dinamic',
  'panel.ruleDoc.dynamicSub': 'Corpurile de răspuns JavaScript se editează în editorul spațiului de lucru.',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'Pasul {current} din {total}',
  'panel.tour.previous': 'Înapoi',
  'panel.tour.next': 'Înainte',
  'panel.tour.finish': 'Finalizare',
  'panel.tour.welcomeTitle': 'Experiență DevTools unificată',
  'panel.tour.welcomeSubtitle': 'Un depanator de rețea cu regulile dvs. integrate.',
  'panel.tour.welcomeCapture': 'Capturați',
  'panel.tour.welcomeCaptureHint': '— cereri în timp real, cu timpi, antete și dimensiuni',
  'panel.tour.welcomeRules': 'Atribuiți',
  'panel.tour.welcomeRulesHint': '— vedeți ce reguli s-au declanșat pe fiecare cerere și de ce',
  'panel.tour.welcomeState': 'Inspectați',
  'panel.tour.welcomeStateHint': '— cookie-uri, stocare și consolă lângă trafic',
  'panel.tour.networkTitle': 'Fereastra Network',
  'panel.tour.networkSubtitle': 'Fiecare cerere făcută de fila inspectată, în timp real.',
  'panel.tour.networkFilters': 'Filtrați',
  'panel.tour.networkFiltersHint': '— după text, tip de resursă sau presetările din „Mai multe filtre”',
  'panel.tour.networkToolbar': 'Controlați',
  'panel.tour.networkToolbarHint': '— „Păstrare jurnal”, limitarea și „Dezactivare cache”, sus',
  'panel.tour.networkExport': 'Exportați',
  'panel.tour.networkExportHint': '— salvați sau copiați întregul jurnal ca HAR',
  'panel.tour.storageTitle': 'Fereastra Storage',
  'panel.tour.storageSubtitle': 'Starea de pe partea clientului a filei inspectate, într-un singur loc.',
  'panel.tour.storageAreas': 'Răsfoiți',
  'panel.tour.storageAreasHint': '— stocare locală și de sesiune, cookie-uri, IndexedDB, cache-uri',
  'panel.tour.storageEdit': 'Editați',
  'panel.tour.storageEditHint': '— deschideți orice intrare ca filă de document și modificați-o pe loc',
  'panel.tour.inspectorTitle': 'Detaliile cererii',
  'panel.tour.inspectorSubtitle': 'Selectați o cerere pentru a o deschide aici ca filă.',
  'panel.tour.inspectorTabs': 'Secțiuni',
  'panel.tour.inspectorTabsHint': '— antete, conținut util, răspuns, timpi și cookie-uri',
  'panel.tour.inspectorEdit': 'Suprascrieți',
  'panel.tour.inspectorEditHint': '— creați o regulă din cerere fără a părăsi panoul',
  'panel.tour.layoutTitle': 'Personalizați-l',
  'panel.tour.layoutSubtitle': 'Șinele laterale găzduiesc mai multe ferestre de instrumente.',
  'panel.tour.layoutTools': 'Mai multe instrumente',
  'panel.tour.layoutToolsHint': '— Console, Căutare, Docs și notificările stau pe șine',
  'panel.tour.layoutDrag': 'Rearanjați',
  'panel.tour.layoutDragHint': '— trageți ferestrele de instrumente între docuri; meniul de aspect resetează',
  'panel.tour.debugTitle': 'Modul Depanare',
  'panel.tour.debugSubtitle': 'Dezactivat implicit — activați-l aici când aveți nevoie de o captură mai profundă.',
  'panel.tour.debugUnlocks': 'Deblochează',
  'panel.tour.debugUnlocksHint': '— corpuri de răspuns, consolă, timpi exacți și reguli de nivel script',
  'panel.tour.debugBanner': 'Atenție',
  'panel.tour.debugBannerHint': '— browserul afișează un banner de depanare pe filele atașate cât timp este activ',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': 'Decodat',
  'panel.valueExpander.raw': 'Brut',
} as const satisfies Catalog;
