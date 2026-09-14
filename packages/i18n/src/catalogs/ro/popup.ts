/**
 * Popup namespace — Romanian. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the ro register contract (`ro/shared.ts`). Mints: cerere
 * potrivită = matched request; declanșare = fire ({count} declanșări /
 * de declanșări); evidence chips umbrită = shadowed (detectarea
 * umbririi = shadow detection) / confirmată = confirmed / indirectă =
 * fallback / silențioasă = silent / potrivită = matched — short
 * feminine forms agreeing with cerere; delivery chips: live raw / cache
 * / sw raw; Livrare = delivery (column); Dovadă = evidence (column);
 * tur ghidat = tour guide; insignă = badge; arbitraj = arbitration;
 * domeniu asociat = related domain; Desktop = the Desktop tag (raw as
 * the ledger's aplicația desktop); Regulă goală = blank rule (carried);
 * meniul suplimentar = overflow menu; the exclude chip prefix = Excl.;
 * Inițiator = initiator (condition label); modul Depanare = Debug mode
 * (carried); în timp real = live traffic prose (Live stays the raw
 * product noun); Panou lateral = side panel (carried); ciornă = draft.
 * Count lines with a verb that would need to agree take a colon frame
 * (declanșate: {count}; Potrivite: 3 din 5 reguli). Rule-type option
 * labels translate (product vocabulary); resource-type parity labels
 * stay literal in the components. Chip sandwiches keep a structural `—`
 * after a label chip (the hint fragments); the `[chip] tab` sandwiches
 * read the chip as an apposition (fila [OH] / fila „Open Headers”) with
 * an EMPTY suffix (the de precedent). Browser-menu mocks quote the
 * browsers' own ro UI (Chrome Vizualizare → Dezvoltator → Instrumente
 * pentru dezvoltatori, Safari Configurări → Avansate → Afișează
 * funcționalitățile pentru dezvoltatorii web); the status-popover
 * subsystem names (Sync, Rules, …) ride verbatim raw. The desktop-watch
 * tooltip quotes the settings row „Permiteți aplicației desktop să vadă
 * acest browser” and the desktop panel „Trafic” — the ro settings file
 * and panel-network quote THESE values verbatim when they land.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'Vizualizarea nu a putut fi comutată',
  'popup.header.switchToSidePanel': 'Comutare la panoul lateral (rămâne deschis în timp ce navigați)',
  'popup.header.switchToPopup': 'Comutare la modul fereastră popup (clic în bara de instrumente)',
  'popup.header.rulesResumed': 'Executarea regulilor a fost reluată',
  'popup.header.rulesPaused': 'Executarea regulilor a fost pusă în pauză',
  'popup.header.rulesLabel': 'Reguli',
  'popup.header.resumeRules': 'Reluare executare reguli',
  'popup.header.pauseRules': 'Pauză pentru toate regulile (setările individuale ale regulilor se păstrează)',
  'popup.header.openSettings': 'Deschidere setări',
  'popup.header.notifications': 'Notificări',
  'popup.header.openNotifications': 'Deschidere notificări',
  'popup.header.activeWorkspace': 'Spațiu de lucru activ: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Activ',
  'popup.status.paused': 'În pauză',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'Cum ajungeți la instrumentele noastre de dezvoltare supraalimentate pentru browser.',
  'popup.footer.networkDebug': 'Depanare rețea.',
  'popup.footer.tagline': 'Așa cum ar trebui să fie',
  'popup.footer.keyboardShortcuts': 'Scurtături de tastatură',
  'popup.footer.systemStatus': 'Sistem',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'Vizualizare de pe desktop',
  'popup.desktopWatch.tooltip':
    'Aplicația desktop Open Headers vizualizează în acest moment acest browser în panoul său „Trafic”. Apăsați pentru a deschide Setările — „Permiteți aplicației desktop să vadă acest browser” este comutatorul de oprire.',
  'popup.desktopWatch.aria': 'Aplicația desktop vizualizează acest browser — deschidere setări',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'Această pagină',
  'popup.tabs.allRules': 'Toate regulile',
  'popup.tabs.collections': 'Colecții',
  'popup.tabs.openWorkspaceEditor': 'Deschidere editor complet de spațiu de lucru',
  'popup.tabs.workspace': 'Spațiu de lucru',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': 'Ștergeți „{name}”?',
  'popup.deleteConfirm.confirm': 'confirmare',
  'popup.deleteConfirm.cancel': 'anulare',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Căutați orice...',
  'popup.table.sortOrder': 'Ordine de sortare',
  'popup.table.sortOrderHeading': 'ORDINE DE SORTARE',
  'popup.table.sortByStatus': 'După stare',
  'popup.table.sortByPriority': 'După prioritate',
  'popup.table.sortByColumn': 'După coloană',
  'popup.table.sortWorkspaceOrder': 'Ordinea spațiului de lucru',
  'popup.table.sortWorkspaceOrderHint': 'Corespunde ordinii arborelui din bara laterală a spațiului de lucru',
  'popup.table.sortByColumnHint': 'Sortat după {column} — apăsați o opțiune de mai sus pentru resetare',
  'popup.table.sortByPriorityHint':
    'Blocare → Redirecționare → Interogare → Antet → Injectare · A-Z în cadrul fiecărei grupe',
  'popup.table.sortByStatusHintAll': 'Active → În pauză → Dezactivate → Ciorne · prioritate în cadrul fiecărei grupe',
  'popup.table.sortByStatusHintThisPage': 'Active → În pauză → Dezactivate · prioritate în cadrul fiecărei grupe',
  'popup.table.sortByStatusHintCollections': 'Active → În pauză · A-Z în cadrul fiecărei grupe',
  'popup.table.columnName': 'Nume',
  'popup.table.columnDetails': 'Detalii',
  'popup.table.columnConditions': 'Condiții',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'Regula nu a putut fi comutată',
  'popup.rule.deleted': 'Regulă ștearsă',
  'popup.rule.deleteFailed': 'Regula nu a putut fi ștearsă',
  'popup.rule.edit': 'Editare regulă',
  'popup.rule.delete': 'Ștergere regulă',
  'popup.rule.deleteOk': 'Ștergere',
  'popup.rule.notConnected': 'Aplicația nu este conectată',
  'popup.rule.desktopTag': 'Desktop',
  'popup.rule.comingSoon': 'în curând',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Reguli',
  'popup.rules.activeSummary': '{active} din {total} active',
  'popup.rules.draftSuffix': ', ciorne: {count}',
  'popup.rules.pausedByCollection': 'În pauză prin colecție: {count}',
  'popup.rules.addRule': 'Adăugare regulă',
  'popup.rules.addRuleTooltip': 'Adăugați o regulă — căutare în tipuri și șabloane',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `Potrivite: ${matched} din ${plural(locale, Number(total), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    })}`,
  'popup.rules.emptyNoMatch': 'Nu s-a găsit nicio regulă potrivită',
  'popup.rules.emptyNone': 'Nicio regulă încă',
  'popup.rules.emptyHint': 'Apăsați „Adăugare regulă” pentru a modifica cererile browserului în timp real',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Colecții',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), {
      one: '{count} colecție',
      few: '{count} colecții',
      other: '{count} de colecții',
    })}, ${plural(locale, Number(rules), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    })}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `Potrivite: ${matched} din ${plural(locale, Number(total), {
      one: '{count} colecție',
      few: '{count} colecții',
      other: '{count} de colecții',
    })}`,
  'popup.collections.emptyNoMatch': 'Nu s-a găsit nicio colecție potrivită',
  'popup.collections.emptyNone': 'Nicio colecție',
  'popup.collections.emptyHint': 'Creați reguli în editorul spațiului de lucru pentru a le organiza în colecții',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `Activate: ${enabled} din ${plural(locale, Number(total), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    })}`,
  'popup.collections.pausedEnabledSummary': 'În pauză · activate {enabled} din {total}',
  'popup.collections.resumeTooltip':
    'Reluare — fixează regulile ({count}) ca active (suprascrie părintele dacă este necesar)',
  'popup.collections.pauseTooltip': 'Pauză — suspendă regulile ({count}) fără a modifica setările individuale',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'Toate domeniile',
  'popup.conditions.none': 'Fără condiții',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Domeniu',
  'popup.conditions.short.excludeRequestDomains': 'Excl. domeniu',
  'popup.conditions.short.initiatorDomains': 'De la',
  'popup.conditions.short.excludeInitiatorDomains': 'Excl. de la',
  'popup.conditions.short.requestMethods': 'Metodă',
  'popup.conditions.short.excludeRequestMethods': 'Excl. metodă',
  'popup.conditions.short.resourceTypes': 'Resursă',
  'popup.conditions.short.excludeResourceTypes': 'Excl. resursă',
  'popup.conditions.short.domainType': 'Tip domeniu',
  'popup.conditions.short.responseHeader': 'Antet răsp.',
  'popup.conditions.short.excludeResponseHeader': 'Excl. antet răsp.',
  'popup.conditions.full.urlFilter': 'Model URL',
  'popup.conditions.full.urlRegex': 'Regex URL',
  'popup.conditions.full.requestDomains': 'Domenii',
  'popup.conditions.full.excludeRequestDomains': 'Excl. domenii',
  'popup.conditions.full.initiatorDomains': 'Inițiator',
  'popup.conditions.full.excludeInitiatorDomains': 'Excl. inițiator',
  'popup.conditions.full.requestMethods': 'Metode',
  'popup.conditions.full.excludeRequestMethods': 'Excl. metode',
  'popup.conditions.full.resourceTypes': 'Resurse',
  'popup.conditions.full.excludeResourceTypes': 'Excl. resurse',
  'popup.conditions.full.domainType': 'Tip domeniu',
  'popup.conditions.full.responseHeader': 'Antet răspuns',
  'popup.conditions.full.excludeResponseHeader': 'Excl. antet răspuns',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Nume',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Număr',
  'popup.actionDetail.type': 'Tip',
  'popup.actionDetail.duration': 'Durată',
  'popup.actionDetail.format': 'Format',
  'popup.actionDetail.status': 'Stare',
  'popup.actionDetail.value': 'Valoare',
  'popup.actionDetail.position': 'Poziție',
  'popup.actionDetail.body': 'Corp',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Etichetă',
  'popup.actionDetail.headers': 'Antete',
  'popup.actionDetail.params': 'Parametri',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': 'Se încarcă informațiile despre fila curentă...',
  'popup.thisPage.noTab': 'Informațiile despre fila curentă nu au putut fi obținute',
  'popup.thisPage.columnMatch': 'Potrivire',
  'popup.thisPage.expandHeaderBadgeHint': 'Apăsați insigna de pe fiecare rând pentru a vedea cererile potrivite',
  'popup.thisPage.expandHeaderDocsHint': 'Apăsați pictograma de mai jos pentru a vedea documentația',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} din ${plural(locale, Number(total), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })} cu „${query}” — apăsați pentru extindere`,
  'popup.thisPage.badgeNone': 'Nicio cerere potrivită încă — apăsați pentru extindere',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} cerere potrivită, servită din cache (silențioasă)',
      few: '{count} cereri potrivite, toate servite din cache (silențioase)',
      other: '{count} de cereri potrivite, toate servite din cache (silențioase)',
    })} — apăsați pentru extindere`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), {
      one: '{count} cerere potrivită declanșată',
      few: '{count} cereri potrivite declanșate',
      other: '{count} de cereri potrivite declanșate',
    })} + ${silent} silențioase (cache) — apăsați pentru extindere`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} cerere potrivită',
      few: '{count} cereri potrivite',
      other: '{count} de cereri potrivite',
    })} — apăsați pentru extindere`,
  'popup.thisPage.systemPage': 'Pagină de sistem',
  'popup.thisPage.systemPageHint': 'Regulile de antete nu se aplică paginilor de sistem ale browserului',
  'popup.thisPage.emptyNoRules': 'Nicio regulă nu se potrivește cu această pagină',
  'popup.thisPage.emptyNoRulesHint': 'Nu este configurată nicio regulă pentru acest domeniu',
  'popup.thisPage.ruleDisabled': 'Regula este dezactivată',
  'popup.thisPage.rulePausedByGroup': 'Regula este pusă în pauză de colecția sau folderul său',
  'popup.thisPage.zeroRelated':
    'Regula vizează un domeniu asociat — nu s-a observat încă nicio cerere către acel domeniu. Se va declanșa dacă pagina face una.',
  'popup.thisPage.zeroPage':
    'Modelul se potrivește cu această pagină, dar nu s-a observat încă nicio cerere potrivită. Interacționați cu pagina sau reîncărcați-o pentru a le declanșa.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Singura cerere potrivită ({count})',
      few: 'Toate cele {count} cereri potrivite',
      other: 'Toate cele {count} de cereri potrivite',
    }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} din {total} cereri potrivite',
  'popup.thisPage.shadowTooltip':
    '{prefix}: întrerupere de către „{name}” (regulă de blocare cu prioritate mai mare) — deci această regulă nu are niciun efect vizibil asupra lor. Experimental: detectarea umbririi poate raporta în plus sau în minus. Dezactivați-o din setări pentru a o ascunde.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `Scriptul a confirmat ${plural(locale, Number(count), {
      one: '{count} declanșare',
      few: '{count} declanșări',
      other: '{count} de declanșări',
    })} pe această pagină (adevăr de bază din injectarea în pagină).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `Potrivire prin adresa URL pentru ${plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })}, dar raportorul injectat în pagină nu a confirmat. Cauze frecvente: o directivă Content-Security-Policy strictă care blochează injectarea sau tipul resursei (foaie de stil, imagine, link de manifest) care ocolește interceptarea fetch/XHR.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `Modelul s-a potrivit cu ${plural(locale, Number(count), {
      one: '{count} subresursă din cache',
      few: '{count} subresurse din cache',
      other: '{count} de subresurse din cache',
    })} — acțiunea nu a putut rula, deoarece răspunsul a ocolit rețeaua. Reîncărcați ocolind cache-ul pentru a forța o cerere nouă.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `Potrivire pentru ${plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })} pe această pagină. declarativeNetRequest din Chrome nu raportează care regulă câștigă atunci când se potrivesc mai multe — observăm potrivirile de adresă URL, nu rezultatele arbitrajului.`,
  'popup.thisPage.pausedTagTooltip': 'Colecția sau folderul este în pauză — regula nu se aplică',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} regulă pusă în pauză',
      few: '{count} reguli puse în pauză',
      other: '{count} de reguli puse în pauză',
    })} de colecție`,
  'popup.thisPage.firing': 'declanșate: {count}',
  'popup.thisPage.silentCached': 'silențioase (cache): {count}',
  'popup.thisPage.related': 'asociate: {count}',
  'popup.thisPage.liveMonitoring': 'Live — se monitorizează cererile',
  'popup.thisPage.visibleResourceTypes': 'TIPURI DE RESURSE VIZIBILE',
  'popup.thisPage.showAll': 'Afișare toate',
  'popup.thisPage.filterResourceTypes': 'Filtrare tipuri de resurse',
  'popup.thisPage.filterResourceTypesCount': 'Filtrare tipuri de resurse ({shown} din {total} afișate)',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere silențioasă (cache)',
      few: '{count} cereri silențioase (cache)',
      other: '{count} de cereri silențioase (cache)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })} (silențioase: ${silent})`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} din ${plural(locale, Number(total), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} din ${plural(locale, Number(total), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })}`,
  'popup.thisPage.matchedJoin': 'potrivite: {parts}',
  'popup.thisPage.copyTsv': 'Copiere cereri ca TSV',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Oră',
  'popup.matched.columnUrl': 'Adresa URL a cererii',
  'popup.matched.columnType': 'Tip',
  'popup.matched.columnDelivery': 'Livrare',
  'popup.matched.columnEvidence': 'Dovadă',
  'popup.matched.columnPattern': 'Model',
  'popup.matched.matchedBy': 'potrivită după',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': 'cache',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip': 'Cererea a ajuns în rețea în această sesiune; răspunsul nu a fost servit din cache.',
  'popup.matched.deliveryCachedTip':
    'Răspunsul a fost servit din cache-ul HTTP al browserului Chrome. Regula dvs. s-a aplicat când acest răspuns a fost preluat inițial sau la revalidare.',
  'popup.matched.deliverySwTip':
    'Un service worker a interceptat cererea. Dacă regula dvs. s-a aplicat depinde de ce a făcut service worker-ul în continuare.',
  'popup.matched.evidenceShadowed': 'umbrită',
  'popup.matched.evidenceShadowedTip':
    'Această cerere a fost întreruptă de „{name}” (regulă de blocare, prioritate mai mare). Această regulă nu a rulat niciodată pe ea.',
  'popup.matched.evidenceConfirmed': 'confirmată',
  'popup.matched.evidenceConfirmedTip':
    'Scriptul a confirmat această declanșare din injectarea în pagină — adevăr de bază că regula a rulat.',
  'popup.matched.evidenceFallback': 'indirectă',
  'popup.matched.evidenceFallbackTip':
    'Potrivire prin adresa URL, dar raportorul injectat în pagină nu a confirmat. Cauze frecvente: o directivă Content-Security-Policy strictă care blochează injectarea în lumea MAIN sau un tip de resursă (foaie de stil, imagine, link de manifest) care ocolește interceptarea fetch/XHR.',
  'popup.matched.evidenceSilent': 'silențioasă',
  'popup.matched.evidenceSilentTip':
    'Modelul s-a potrivit cu această subresursă, dar răspunsul a fost servit din cache / un service worker / bfcache, așa că acțiunea regulii nu a putut rula. Reîncărcați ocolind cache-ul pentru a forța o cerere nouă.',
  'popup.matched.evidenceMatched': 'potrivită',
  'popup.matched.evidenceMatchedTip':
    'Adresa URL s-a potrivit cu condițiile acestei reguli. declarativeNetRequest din Chrome nu raportează care regulă câștigă arbitrajul — observăm potrivirile de adresă URL, nu execuția.',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} din ${plural(locale, Number(total), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })} cu „${query}”`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `Potrivite: ${plural(locale, Number(count), {
      one: '{count} cerere',
      few: '{count} cereri',
      other: '{count} de cereri',
    })}`,
  'popup.matched.emptySearch':
    'Nicio cerere potrivită nu conține „{query}”. Goliți sau lărgiți căutarea pentru a vedea toate potrivirile.',
  'popup.matched.emptyRelated':
    'Regula vizează un domeniu asociat — potrivirile vor apărea dacă pagina face cereri către acel domeniu.',
  'popup.matched.emptyPage':
    'Modelul se potrivește cu această pagină. Potrivirile vor apărea pe măsură ce pagina emite cereri care se încadrează în model — interacționați cu pagina sau reîncărcați-o pentru a le declanșa.',
  'popup.matched.emptyNone': 'Nicio cerere potrivită încă — reîncărcați pagina pentru captură.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'Antet',
  'popup.ruleType.block': 'Blocare',
  'popup.ruleType.redirect': 'Redirecționare',
  'popup.ruleType.queryParam': 'Parametru de interogare',
  'popup.ruleType.inject': 'Injectare',
  'popup.ruleType.requestBody': 'Cerere API',
  'popup.ruleType.delay': 'Întârziere',
  'popup.ruleType.response': 'Răspuns API',
  'popup.ruleType.headerDesc': 'Modificare antete HTTP',
  'popup.ruleType.blockDesc': 'Blocare cereri',
  'popup.ruleType.redirectDesc': 'Redirecționare cereri',
  'popup.ruleType.queryParamDesc': 'Modificare parametri de interogare',
  'popup.ruleType.injectDesc': 'Injectare scripturi sau CSS',
  'popup.ruleType.requestBodyDesc': 'Modificare corp cerere API (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Întârziere răspuns',
  'popup.ruleType.responseDesc': 'Simulare sau modificare răspuns API (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'Se potrivește direct cu adresa URL a paginii',
  'popup.resourceType.subFrameTip': 'Se aplică unui iframe încărcat de această pagină',
  'popup.resourceType.xhrTip': 'Se aplică apelurilor fetch() și XMLHttpRequest',
  'popup.resourceType.scriptTip': 'Se aplică resurselor de tip script',
  'popup.resourceType.stylesheetTip': 'Se aplică foilor de stil',
  'popup.resourceType.imageTip': 'Se aplică imaginilor',
  'popup.resourceType.fontTip': 'Se aplică fișierelor de fonturi',
  'popup.resourceType.mediaTip': 'Se aplică resurselor audio/video',
  'popup.resourceType.websocketTip': 'Se aplică conexiunilor WebSocket',
  'popup.resourceType.pingTip': 'Se aplică cererilor ping/beacon',
  'popup.resourceType.otherTip': 'Se aplică altor resurse',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Regulă goală',
  'popup.palette.searchPlaceholder': 'Căutați tipuri de reguli și șabloane…',
  'popup.palette.noMatches': 'Nicio potrivire pentru „{query}”',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Scurtături de tastatură',
  'popup.shortcuts.press': 'apăsați',
  'popup.shortcuts.or': 'sau',
  'popup.shortcuts.toClose': 'pentru închidere',
  'popup.shortcuts.groupNavigation': 'Navigare',
  'popup.shortcuts.groupActions': 'Acțiuni',
  'popup.shortcuts.groupRow': 'Rânduri de tabel',
  'popup.shortcuts.groupBrowser': 'Browser',
  'popup.shortcuts.groupTour': 'Tur ghidat',
  'popup.shortcuts.openExtension': 'Deschidere extensie',
  'popup.shortcuts.customize': 'Personalizare scurtătură extensie ↗',
  'popup.shortcuts.toggleDebugMode': 'Comutare mod Depanare',
  'popup.shortcuts.tabThisPage': 'Fila „Această pagină”',
  'popup.shortcuts.tabAllRules': 'Fila „Toate regulile”',
  'popup.shortcuts.tabCollections': 'Fila „Colecții”',
  'popup.shortcuts.focusSearch': 'Focalizare căutare',
  'popup.shortcuts.prevPage': 'Pagina anterioară',
  'popup.shortcuts.nextPage': 'Pagina următoare',
  'popup.shortcuts.addRule': 'Adăugare regulă nouă',
  'popup.shortcuts.openWorkspace': 'Deschidere spațiu de lucru',
  'popup.shortcuts.openSettings': 'Deschidere setări',
  'popup.shortcuts.toggleSurface': 'Comutare fereastră popup / panou lateral',
  'popup.shortcuts.toggleRulesPause': 'Pauză / reluare toate regulile',
  'popup.shortcuts.togglePauseFocused': 'Pauză / reluare colecție sau folder',
  'popup.shortcuts.toggleOptionsMenu': 'Meniu de opțiuni',
  'popup.shortcuts.cycleTheme': 'Schimbare temă',
  'popup.shortcuts.toggleCompactMode': 'Mod compact',
  'popup.shortcuts.toggleShortcutsHelp': 'Acest panou',
  'popup.shortcuts.moveDown': 'În jos',
  'popup.shortcuts.moveUp': 'În sus',
  'popup.shortcuts.expandRow': 'Extindere / intrare în sub-rânduri',
  'popup.shortcuts.collapseRow': 'Restrângere / ieșire din sub-rânduri',
  'popup.shortcuts.toggleRow': 'Comutare activat / dezactivat',
  'popup.shortcuts.editRow': 'Editare regulă',
  'popup.shortcuts.copyValue': 'Copiere valoare',
  'popup.shortcuts.deleteRow': 'Ștergere (apăsați de două ori)',
  'popup.shortcuts.openTourGuide': 'Deschidere tur ghidat',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Pasul {current} din {total}',
  'popup.tour.previous': 'Înapoi',
  'popup.tour.next': 'Înainte',
  'popup.tour.finish': 'Finalizare',
  'popup.tour.welcomeTitle': 'Bun venit la Open Headers',
  'popup.tour.welcomeSubtitle': 'Interceptați și modificați traficul HTTP în timp real.',
  'popup.tour.modify': 'Modificați',
  'popup.tour.modifyDesc': 'Antete, cookie-uri, tokenuri de autentificare, CORS, conținut util',
  'popup.tour.route': 'Direcționați',
  'popup.tour.routeDesc': 'Redirecționați cereri, blocați trackere, rescrieți adrese URL',
  'popup.tour.debug': 'Depanați',
  'popup.tour.debugDesc': 'Inspectați cereri în timp real, injectați scripturi, suprascrieți răspunsuri',
  'popup.tour.migrateSwitching': 'Treceți de la',
  'popup.tour.migrateOr': 'sau',
  'popup.tour.migrateButton': 'Migrare de la alt instrument',
  'popup.tour.tabsTitle': 'Comutare între file',
  'popup.tour.tabsSubtitle': 'Apăsați o tastă numerică pentru a comuta instantaneu.',
  'popup.tour.thisPageHint': '— regulile care se potrivesc cu fila curentă',
  'popup.tour.allRulesHint': '— fiecare regulă pe care ați creat-o',
  'popup.tour.tagsLabel': 'Etichete',
  'popup.tour.tagsHint': '— organizați și puneți în pauză grupuri',
  'popup.tour.workspaceTitle': 'Spațiul dvs. de lucru',
  'popup.tour.workspaceSubtitle': 'Editorul complet — se deschide în propria filă.',
  'popup.tour.workspaceRequests': 'Client API',
  'popup.tour.workspaceRequestsHint': '— creați, trimiteți și salvați cereri API',
  'popup.tour.workspaceWorkflows': 'Fluxuri de lucru',
  'popup.tour.workspaceWorkflowsHint': '— înlănțuiți cereri în rulări automate',
  'popup.tour.workspaceEnvs': 'Medii și variabile',
  'popup.tour.workspaceEnvsHint': '— plus importuri, reguli și sincronizare în echipă',
  'popup.tour.navTitle': 'Răsfoiți și navigați prin reguli',
  'popup.tour.navSubtitle': 'Navigați prin rânduri cu scurtături de tastatură',
  'popup.tour.keyMove': 'Mutare',
  'popup.tour.keyExpand': 'Extindere',
  'popup.tour.keyToggle': 'Comutare',
  'popup.tour.keyEdit': 'Editare',
  'popup.tour.keyCopy': 'Copiere',
  'popup.tour.keyDelete': 'Ștergere',
  'popup.tour.devtoolsTitle': 'Depanare rețea în DevTools',
  'popup.tour.findThePrefix': 'Găsiți fila',
  'popup.tour.findTheSuffix': 'în DevTools:',
  'popup.tour.devtoolsHint': 'Apăsați acest buton oricând pentru instrucțiuni de configurare.',
  'popup.tour.shortcutsTitle': 'Toate scurtăturile de tastatură',
  'popup.tour.shortcutsSubtitle': 'Fereastra popup poate fi navigată complet de la tastatură.',
  'popup.tour.pressLabel': 'Apăsați',
  'popup.tour.shortcutsHint': 'oricând pentru a vedea toate scurtăturile',
  'popup.tour.debugModeTitle': 'Modul Depanare',
  'popup.tour.debugModeSubtitle': 'Control complet asupra traficului browserului în timp real.',
  'popup.tour.debugModeReqRes': 'Cereri și răspunsuri',
  'popup.tour.debugModeReqResHint': '— rescrieți antete, corpuri și coduri de stare în timp real',
  'popup.tour.debugModeStreams': 'WebSocket și SSE',
  'popup.tour.debugModeStreamsHint': '— inspectați și editați mesajele transmise în flux',
  'popup.tour.debugModeScripts': 'Scripturi și stocare',
  'popup.tour.debugModeScriptsHint': '— injectați scripturi, inspectați cookie-uri și stocarea',
  'popup.tour.statusTitle': 'Starea sistemului',
  'popup.tour.statusSubtitle':
    'Apăsați punctul pentru o defalcare a stării subsistemelor Sync, Rules, Requests, Permissions, Secrets și Live.',
  'popup.tour.statusGreen': 'Verde',
  'popup.tour.statusGreenDesc': '— totul funcționează',
  'popup.tour.statusYellow': 'Galben',
  'popup.tour.statusYellowDesc': '— un subsistem raportează un avertisment',
  'popup.tour.statusRed': 'Roșu',
  'popup.tour.statusRedDesc': '— un subsistem a eșuat',
  'popup.tour.growTitle': 'Ajutați-ne să creștem',
  'popup.tour.growSubtitle': 'Ajutați-ne să creștem și să ajungem la mai mulți dezvoltatori.',
  'popup.tour.starGithub': 'Dați-ne o stea pe GitHub',
  'popup.tour.recommend': 'Recomandați-ne prietenilor și colegilor',
  'popup.tour.growHint': 'Le găsiți oricând sub clopoțel.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Modificare antete, cereri și răspunsuri',
  'popup.devtools.featureTabs': 'Panouri de metadate ale cererii cu file multiple',
  'popup.devtools.featureSearch': 'Căutare și filtrare avansată',
  'popup.devtools.featureDock': 'Panouri laterale cu tragere și plasare',
  'popup.devtools.addOverride': '+ Adăugare/Suprascriere',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Depanare rețea',
  'popup.debug.step1': 'Deschideți DevTools în browser',
  'popup.debug.step1a': 'Pe o pagină obișnuită, de ex.',
  'popup.debug.notPrefix': 'Nu pe',
  'popup.debug.notSuffix': 'sau într-o filă nouă (extensiile sunt blocate acolo).',
  'popup.debug.onPlatform': 'pe {platform}',
  'popup.debug.menuHintSafari':
    'Activați mai întâi meniul Dezvoltare — Safari → Configurări → Avansate → „Afișează funcționalitățile pentru dezvoltatorii web”.',
  'popup.debug.clickThePrefix': 'Apăsați fila',
  'popup.debug.clickTheSuffix': '',
  'popup.debug.overflowPrefix': 'Ultima filă — se poate ascunde în spatele butonului',
  'popup.debug.overflowSuffix': 'din meniul suplimentar.',
  'popup.debug.step3': 'Supraalimentați-vă depanarea',
  'popup.debug.menuGlyphAria': 'Deschideți meniul Vizualizare → Dezvoltator → Instrumente pentru dezvoltatori',
  'popup.debug.tabGlyphAria':
    'DevTools andocat cu fila Open Headers selectată — bare laterale, listă de rețea și panouri divizate cu file multiple',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': 'Dezvoltator',
  'popup.debug.menuGlyphDeveloperTools': 'Instrumente pentru dezvoltatori',
} as const satisfies Catalog;
