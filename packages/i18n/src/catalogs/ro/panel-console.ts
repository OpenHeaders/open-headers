/**
 * DevTools panel — console tool window — Romanian. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level wire
 * names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context labels
 * (top / frame names / script URLs), source locations, "(anonymous)",
 * the browser's synthesized network phrasing quoted verbatim
 * ("finished loading", "Access to fetch at …"), key names (Tab /
 * Enter / arrows ride raw), and the example-transcript rows in the (i)
 * corpora. Panoul Network keeps the raw panel name (zh-CN precedent).
 * Mints: linia de comandă = prompt (REPL); evaluare anticipată = eager
 * evaluation; evaluare = evaluate; transcriere = transcript; captură =
 * capture (carried); urmărire stivă = stack trace; fixare = pin
 * (carried); sferă = the debug-reach scope (S19 law, carried);
 * păstrare = preserve; ieșire = output. OH's own setting labels quoted
 * in prose copy this file's mints in „…”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'Golire consolă',
  'panel.console.collapseAll': 'Restrângere toate',
  'panel.console.expandAll': 'Extindere toate',
  'panel.console.filterAria': 'Filtrare mesaje din consolă',
  'panel.console.levelTitle': 'Nivel de jurnal: {label}',
  'panel.console.settings': 'Setări consolă',
  'panel.console.settingsPaneAria': 'Setări consolă',
  'panel.console.contextTitle': 'Context JavaScript — unde se evaluează comenzile consolei',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Detaliat',
  'panel.console.levels.info': 'Informații',
  'panel.console.levels.warnings': 'Avertismente',
  'panel.console.levels.errors': 'Erori',
  'panel.console.levels.all': 'Toate nivelurile',
  'panel.console.levels.defaultLevels': 'Niveluri implicite',
  'panel.console.levels.hideAll': 'Ascundere toate',
  'panel.console.levels.only': 'Numai {level}',
  'panel.console.levels.custom': 'Niveluri personalizate',
  'panel.console.levels.default': 'Implicit',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Ascundere rețea',
  'panel.console.setting.hideNetworkTitle':
    'Ascunde intrările de jurnal de rețea ale browserului (cereri eșuate și blocate)',
  'panel.console.setting.logXhr': 'Înregistrare XMLHttpRequest',
  'panel.console.setting.logXhrTitle':
    'Înregistrează un mesaj când o cerere XHR, fetch sau EventSource se termină sau eșuează',
  'panel.console.setting.preserveLog': 'Păstrare jurnal',
  'panel.console.setting.preserveLogTitle': 'Nu golește jurnalul la navigare',
  'panel.console.setting.eagerEval': 'Evaluare anticipată',
  'panel.console.setting.eagerEvalTitle':
    'Evaluează anticipat textul din linia de comandă (previzualizare fără efecte secundare)',
  'panel.console.setting.selectedContextOnly': 'Numai contextul selectat',
  'panel.console.setting.selectedContextOnlyTitle': 'Afișează numai mesajele din contextul selectat',
  'panel.console.setting.autocompleteHistory': 'Completare automată din istoric',
  'panel.console.setting.autocompleteHistoryTitle':
    'Sugerează comenzile rulate anterior pe măsură ce tastați în linia de comandă',
  'panel.console.setting.groupSimilar': 'Grupare mesaje similare în consolă',
  'panel.console.setting.groupSimilarTitle': 'Restrânge mesajele identice repetate într-un singur rând cu un contor',
  'panel.console.setting.evalUserGesture': 'Tratare evaluare cod ca acțiune a utilizatorului',
  'panel.console.setting.evalUserGestureTitle':
    'Evaluează cu un gest al utilizatorului, astfel încât interfețele API condiționate de activarea utilizatorului să funcționeze din linia de comandă',
  'panel.console.setting.showCorsErrors': 'Afișare erori CORS în consolă',
  'panel.console.setting.showCorsErrorsTitle': 'Afișează erorile politicii CORS alături de ieșirea proprie a paginii',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Exemplu de consolă',
  'panel.console.info.hideNetwork.summary':
    'Ascunde intrările de jurnal de rețea proprii ale browserului — cereri eșuate și blocate —, în timp ce ieșirea consolei paginii rămâne întotdeauna.',
  'panel.console.info.hideNetwork.description':
    'Ascunde și rândurile „finished loading” sintetizate de „Înregistrare XMLHttpRequest” — și ele sunt mesaje cu sursă de rețea.',
  'panel.console.info.logXhr.summary':
    'Înregistrează un rând ori de câte ori o cerere XHR, fetch sau EventSource se termină sau eșuează.',
  'panel.console.info.logXhr.description':
    'Rândurile se înregistrează la nivelul Informații — și eșecurile —, iar adresa URL trimite la rândul cererii din panoul Network. „Ascundere rețea” ascunde și aceste rânduri.',
  'panel.console.info.preserveLog.summary': 'Păstrează jurnalul la navigările paginii în loc să îl golească.',
  'panel.console.info.preserveLog.description':
    'Dezactivat, o navigare — recrearea contextului de nivel superior al paginii — reduce vizualizarea la intrările care sosesc după ea.',
  'panel.console.info.eagerEval.summary':
    'Previzualizează rezultatul expresiei pe care o tastați pe linia gri de sub linia de comandă.',
  'panel.console.info.eagerEval.description':
    'Previzualizarea se evaluează fără efecte secundare: o expresie care ar schimba starea paginii nu afișează nimic în loc să ruleze, iar în jurnal nu se scrie nimic până nu apăsați Enter.',
  'panel.console.info.selectedContextOnly.summary':
    'Afișează numai mesajele din contextul JavaScript ales în selectorul de context din bara de instrumente.',
  'panel.console.info.selectedContextOnly.description':
    'Intrările fără context — intrările de jurnal proprii ale browserului — rămân întotdeauna vizibile.',
  'panel.console.info.autocompleteHistory.summary':
    'Sugerează cea mai recentă comandă care continuă ce ați tastat, ca o completare estompată în linia de comandă.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — sau → la sfârșitul textului — o acceptă; ↑/↓ parcurg în continuare istoricul. Istoricul durează cât sesiunea curentă a panoului.',
  'panel.console.info.groupSimilar.title': 'Grupare mesaje similare',
  'panel.console.info.groupSimilar.summary':
    'Restrânge mesajele identice consecutive într-un singur rând cu o insignă de contor.',
  'panel.console.info.groupSimilar.description':
    'Comenzile tastate și rezultatele lor nu se grupează niciodată — transcrierea rămâne literală.',
  'panel.console.info.evalUserGesture.summary':
    'Rulează comenzile din linia de comandă ca și cum le-ar fi declanșat un gest al utilizatorului.',
  'panel.console.info.evalUserGesture.description':
    'Interfețele API condiționate de activarea utilizatorului — deschiderea unei ferestre, scrierea în clipboard, ecranul complet — reușesc din linia de comandă cu această opțiune activată.',
  'panel.console.info.showCorsErrors.summary':
    'Afișează explicațiile browserului pentru CORS — „Access to fetch at … has been blocked by CORS policy: …” — alături de ieșirea paginii.',
  'panel.console.info.showCorsErrors.description':
    'Dezactivat ascunde doar aceste mesaje explicative; cererea blocată în sine apare în continuare în panoul Network.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Captura s-a oprit — această filă a ieșit din sfera modului Depanare. Se afișează ultima ieșire capturată.',
  'panel.console.banner.debugOff':
    'Captura s-a oprit — modul Depanare este dezactivat. Se afișează ultima ieșire capturată.',
  'panel.console.enableDebug': 'Activare mod Depanare',
  'panel.console.empty.noCdp.title': 'Captura consolei necesită modul Depanare',
  'panel.console.empty.noCdp.sub': 'Inspecția în modul Depanare nu este disponibilă în acest browser.',
  'panel.console.empty.capturing.title': 'Nicio ieșire în consolă încă',
  'panel.console.empty.capturing.sub':
    'Mesajele de jurnal și excepțiile netratate ale acestei file vor apărea aici pe măsură ce se produc.',
  'panel.console.empty.debugOff.title': 'Activați modul Depanare pentru a vedea jurnalele consolei',
  'panel.console.empty.debugOff.sub':
    'Open Headers capturează ieșirea consolei și excepțiile netratate ale acestei file cât timp modul Depanare este activ.',
  'panel.console.empty.outOfScope.title': 'Această filă este în afara sferei modului Depanare',
  'panel.console.empty.outOfScope.sub':
    'Aduceți-o în sferă din modul Depanare — schimbați sfera sau fixați această filă — pentru a-i captura ieșirea consolei.',
  'panel.console.noMatch': 'Nicio intrare din consolă nu corespunde filtrului dvs.',
  'panel.console.revealedHidden': 'Mesajul dezvăluit este ascuns de filtrul activ',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} mesaj identic',
      few: '{count} mesaje identice',
      other: '{count} de mesaje identice',
    }),
  'panel.console.expandStack': 'Extindere urmărire stivă',
  'panel.console.collapseStack': 'Restrângere urmărire stivă',

  // REPL prompt
  'panel.console.prompt.waiting': 'Se așteaptă un context JavaScript…',
  'panel.console.prompt.placeholder': 'Rulați JavaScript în contextul selectat',
  'panel.console.prompt.aria': 'Linia de comandă a consolei',
  'panel.console.prompt.previewAria': 'Previzualizare evaluare anticipată',
} as const satisfies Catalog;
