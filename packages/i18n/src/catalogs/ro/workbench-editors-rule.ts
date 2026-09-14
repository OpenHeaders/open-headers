/**
 * Workbench editors — the rule editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-rule.ts` key for key. The quick
 * editor reuses the `workbench.editors.rule.fields.*` keys directly
 * (S35 field-key reuse law) — field labels here stay consistent with
 * `ro/panel-quick-editor.ts` (Suprascriere / Adăugare la sfârșit /
 * Îmbinare / Eliminare, „Eliminare toate”, the Simulare / Modificare =
 * Mock / Modify tags). Rule-type kickers reuse the Regulă … family
 * from workbench-chrome (Regulă de antete / de blocare / de
 * redirecționare / de parametru de interogare / de injectare / de
 * întârziere / de corp cerere / de răspuns / WebSocket / SSE / de
 * autentificare). MINTS: șablon = template (șablon de utilizator = user
 * template); antetul editorului = the editor header bar (S19 separate
 * referent — antet JWT the segment and antet HTTP unchanged); Adăugare
 * / Înlocuire = Add / Replace and Doar înlocuire = Replace Only (the
 * header-plane op — Suprascriere stays the hover-snapshot op noun);
 * Primar / Terț = first-/third-party (carried from panel-network);
 * înregistrare-fantomă = tombstone; slot DNR = the DNR slot; se
 * plafonează = clamped; Date statice / Dinamic (JavaScript) = Static
 * Data / Dynamic; Formatat / Brut carried from panel-network;
 * presetare = preset. Raw by design: gates AND/OR/NOT, DNR schema
 * vocabulary (`requestDomains`, `url-filter`, `firstParty`, slot ids),
 * `{{ns.NAME}}` reference syntax in placeholders, quoted browser UI
 * phrasing (raw en in „”, S80 law), scheme prefixes, HTTP method
 * lists, regex fragments; the `⋮ → Salvare ca șablon de utilizator`
 * menu-path split quotes the OH mint. Every raw token takes a head
 * noun (browserul Chrome, modelul URL, slotul DNR, corpul JSON).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Salvat',
  'workbench.editors.header.onTop': 'Antetul editorului sus',
  'workbench.editors.header.atBottom': 'Antetul editorului jos',
  'workbench.editors.header.moreActions': 'Mai multe acțiuni',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Editor de reguli',
  'workbench.editors.rule.templates.title': 'Șabloane',
  'workbench.editors.rule.templates.infoSummary': 'Porniți de la o presetare în loc de un formular gol.',
  'workbench.editors.rule.templates.infoDescription':
    'Șabloanele de sistem vin cu aplicația; șabloanele de utilizator sunt cele pe care le salvați dvs. prin ⋮ → Salvare ca șablon de utilizator. Aplicarea unui șablon doar precompletează câmpurile — ajustați orice înainte de a salva.',
  'workbench.editors.rule.templates.blank': 'Gol',
  'workbench.editors.rule.templates.system': 'Sistem',
  'workbench.editors.rule.templates.user': 'Utilizator',
  'workbench.editors.rule.templates.emptyTitle': 'Niciun șablon de utilizator încă',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'Șabloanele de utilizator sunt propriile dvs. presetări reutilizabile pentru acest tip de regulă. Configurați regula așa cum doriți, apoi alegeți',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Salvare ca șablon de utilizator',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'din antet — va apărea aici pentru fiecare regulă nouă de acest tip.',
  'workbench.editors.rule.saveAsTemplate': 'Salvare ca șablon de utilizator',
  'workbench.editors.rule.enabled': 'Activată',
  'workbench.editors.rule.disabled': 'Dezactivată',
  'workbench.editors.rule.toast.unknownType': 'Tip de regulă necunoscut',
  'workbench.editors.rule.toast.deletedOtherTab': 'Regula a fost ștearsă dintr-o altă filă',
  'workbench.editors.rule.toast.updateFailed': 'Actualizarea regulii a eșuat',
  'workbench.editors.rule.toast.updateFailedDetail': 'Actualizarea regulii a eșuat: {message}',
  'workbench.editors.rule.toast.publishFailed': 'Regula a fost salvată, dar publicarea a eșuat',
  'workbench.editors.rule.toast.updated': 'Regulă actualizată',
  'workbench.editors.rule.toast.published': 'Regulă publicată',
  'workbench.editors.rule.toast.formatSkipped': 'Formatarea la salvare a fost omisă: {reason}',
  'workbench.editors.rule.toast.noCollection': 'Nicio colecție găsită',
  'workbench.editors.rule.toast.restoreFailed': 'Restaurarea regulii a eșuat',
  'workbench.editors.rule.toast.restored': 'Regulă restaurată',
  'workbench.editors.rule.deleted.message': 'Această regulă a fost ștearsă de pe o altă suprafață.',
  'workbench.editors.rule.deleted.description':
    'Restaurarea creează o copie nouă, cu un id nou (înregistrarea-fantomă originală este permanentă — vezi specificația motorului de sincronizare §7.2).',
  'workbench.editors.rule.deleted.restore': 'Restaurare',
  'workbench.editors.rule.conditionsPane.title': 'Condiții',
  'workbench.editors.rule.conditionsPane.infoSummary': 'Condițiile decid la ce cereri se aplică această regulă.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Rândurile se combină prin',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— fiecare rând trebuie să se potrivească.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': 'Valorile din același rând se combină prin',
  'workbench.editors.rule.conditionsPane.infoOrAfter':
    '(insigna OR marchează rândurile care acceptă mai multe valori).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Adăugați cel puțin o condiție.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'Potrivire URL',
  'workbench.editors.rule.condition.group.domainFiltering': 'Filtrare după domeniu',
  'workbench.editors.rule.condition.group.requestFiltering': 'Filtrare după cerere',
  'workbench.editors.rule.condition.group.headerMatching': 'Potrivire antete',
  'workbench.editors.rule.condition.type.urlFilter': 'Model URL',
  'workbench.editors.rule.condition.type.urlRegex': 'Regex URL',
  'workbench.editors.rule.condition.type.requestDomains': 'Domeniile cererii',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Excludere domenii',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Domeniile inițiatorului',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Excl. inițiator',
  'workbench.editors.rule.condition.type.requestMethods': 'Metode',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Excl. metode',
  'workbench.editors.rule.condition.type.resourceTypes': 'Tipuri de resurse',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Excl. resurse',
  'workbench.editors.rule.condition.type.domainType': 'Tip de domeniu',
  'workbench.editors.rule.condition.type.responseHeader': 'Antet de răspuns',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Excl. antet răsp.',
  'workbench.editors.rule.condition.suffix.notSupported': ' — neacceptat de Chrome DNR',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — deja folosit',
  'workbench.editors.rule.condition.firstParty': 'Primar',
  'workbench.editors.rule.condition.thirdParty': 'Terț',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'Nicio condiție — regula nu se va potrivi cu nicio cerere',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    'Rândurile se combină prin AND — fiecare rând trebuie să se potrivească pentru ca regula să se declanșeze. Fiecare rând țintește un alt câmp DNR, așa că AND între rânduri este exact. Pentru OR între mai multe valori din același câmp, listați-le în același rând (vezi insigna OR a rândului).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'Aceasta este o condiție de excludere — regula se declanșează doar când NICIUNA dintre valorile listate nu se potrivește.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'Mai multe valori din acest rând se potrivesc dacă ORICARE valoare se potrivește (OR). Rândurile de mai jos se combină prin AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 valoare',
  'workbench.editors.rule.condition.oneValueTooltip':
    'Această condiție acceptă o singură valoare — separarea prin virgulă nu are efect. Rândurile de mai jos se combină prin AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'Numele antetului este egal cu...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'Valoarea antetului este egală cu...',
  'workbench.editors.rule.condition.selectMethods': 'Selectați metodele',
  'workbench.editors.rule.condition.selectTypes': 'Selectați tipurile',
  'workbench.editors.rule.condition.selectType': 'Selectați tipul',
  'workbench.editors.rule.condition.valuePlaceholder': 'valoare',
  'workbench.editors.rule.condition.add': 'Adăugare condiție',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    'Doar ultimul rând {type} se aplică — valoarea acestui rând nu va ajunge la Chrome. Eliminați acest rând sau mutați-i valorile în rândul care câștigă.',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} și {winningType} împart același slot DNR — doar ultimul se aplică. Alegeți unul.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'Acest tip de condiție nu este încă acceptat de Chrome DNR — regula se salvează totuși, dar acest rând nu trimite nimic în rețea.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'Modelul URL nu poate fi gol.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'Expresia regex URL nu poate fi goală.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'Modelul URL nu poate conține spații — Chrome respinge regulile cu spații în url-filter.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'Modelul URL conține caractere non-ASCII — Chrome le respinge. Folosiți punycode (xn--…) pentru numele de gazdă IDN.',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    'Aceasta arată ca o expresie regulată — în Model URL, caractere precum `(`, `[`, `+`, `?`, `\\d` se potrivesc literal. Treceți la Regex URL dacă aveți nevoie de sintaxă regex.',
  'workbench.editors.rule.issue.regexLookbehind':
    'Motorul regex al browserului Chrome (RE2) nu acceptă aserțiuni lookbehind ((?<=…), (?<!…)). Este posibil ca regula să nu se încarce.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Motorul regex al browserului Chrome (RE2) nu acceptă grupuri denumite în stil Python ((?P<name>…)). Este posibil ca regula să nu se încarce.',
  'workbench.editors.rule.issue.invalidUrlRegex': 'Expresie regulată nevalidă: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '„{value}” nu este o metodă HTTP validă. Permise: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType':
    '„{value}” nu este un tip de resursă valid. Alegeți din lista derulantă.',
  'workbench.editors.rule.issue.invalidDomainType':
    '„{value}” nu este un tip de domeniu valid. Folosiți „firstParty” sau „thirdParty”.',
  'workbench.editors.rule.issue.headerNameRequired': 'Numele antetului este obligatoriu.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    'Spații în interiorul valorii — separați numele de gazdă prin virgulă. Condiția requestDomains acceptă un singur nume de gazdă simplu per intrare.',
  'workbench.editors.rule.issue.domain.scheme':
    'Eliminați schema — condiția requestDomains din Chrome acceptă doar nume de gazdă, nu adrese URL.',
  'workbench.editors.rule.issue.domain.wildcard':
    'Eliminați metacaracterul — condiția requestDomains se potrivește automat cu toate subdomeniile, așa că „*.foo.com” este pur și simplu „foo.com”.',
  'workbench.editors.rule.issue.domain.port':
    'Eliminați portul — condiția requestDomains se potrivește doar după numele de gazdă; regula acoperă automat fiecare port.',
  'workbench.editors.rule.issue.domain.uppercase':
    'Scrieți numele de gazdă cu minuscule — Chrome acceptă doar ASCII cu minuscule în requestDomains.',
  'workbench.editors.rule.issue.domain.nonAscii':
    'Numele de gazdă conține caractere pe care Chrome le respinge în requestDomains (probabil o intrare non-ASCII / IDN). Folosiți forma punycode (xn--…).',
  'workbench.editors.rule.issue.domain.empty': 'Nume de gazdă gol — eliminați acest rând.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} intrare afectată',
      few: '{count} intrări afectate',
      other: '{count} de intrări afectate',
    }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Curățare',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'Ținta redirecționării nu poate conține spații.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'Ținta redirecționării trebuie să fie o adresă URL completă (http://, https://, chrome-extension://) sau o cale care începe cu /.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'Adresa URL a sursei trebuie să folosească http://, https:// sau chrome-extension://.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'Adresa URL a sursei nu este o adresă URL validă.',
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'Codul de stare trebuie să fie un întreg între 100 și 599.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    'Numele parametrului nu poate conține `&`, `=`, `#`, `?` sau spații.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'Întârzierea cadrului principal este plafonată la 30000ms; valorile mai mari se plafonează în rețea.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'Interceptarea XHR/fetch plafonează întârzierile la 5000ms, pentru a evita epuizarea rezervei de conexiuni HTTP. Redirecționările cadrului principal onorează până la 30000ms.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'Tipul de conținut ar trebui să arate ca „tip/subtip” (de ex. application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'Cheia filtrului GraphQL este obligatorie.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'Valoarea filtrului de mesaje este obligatorie când un filtru este configurat.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    'Filtrul de mesaje nu este o expresie regulată validă.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Injectarea după un mesaj potrivit necesită un filtru de mesaje.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variabilă nerezolvată în această regulă',
      few: '{count} variabile nerezolvate în această regulă',
      other: '{count} de variabile nerezolvate în această regulă',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'nerezolvată',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'nu este în sferă',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'spațiu de nume necunoscut',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'referință la pas în afara sferei',
  'workbench.editors.rule.resolution.reason.empty': 'goală',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'valoare nevalidă',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'necesită autorizare',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'secretul nu a fost găsit',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'managerul nu este disponibil',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    'nicio rulare în cache pentru mediul „{envName}” — deschideți fluxul de lucru și apăsați Reîmprospătare sub acest mediu pentru a-l popula',
  'workbench.editors.rule.resolution.hint.disabledLv':
    'variabila live este dezactivată — activați-o în editorul de variabile Live',
  'workbench.editors.rule.resolution.hint.draftLv':
    'variabila live este o ciornă — deschideți-o și apăsați Salvare pentru a o publica',
  'workbench.editors.rule.resolution.noEnvironment': 'Fără mediu',
  'workbench.editors.rule.resolution.activeEnvFallback': 'mediul activ',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Acțiuni',
  'workbench.editors.rule.fields.addAction': 'Adăugare acțiune',
  'workbench.editors.rule.fields.reset': 'Resetare',
  'workbench.editors.rule.fields.optionalTag': '(opțional)',
  'workbench.editors.rule.fields.opAddReplace': 'Adăugare / Înlocuire',
  'workbench.editors.rule.fields.opAppend': 'Adăugare la sfârșit',
  'workbench.editors.rule.fields.opRemove': 'Eliminare',
  'workbench.editors.rule.fields.opMerge': 'Îmbinare',
  'workbench.editors.rule.fields.opReplaceOnly': 'Doar înlocuire',
  'workbench.editors.rule.fields.opRemoveAll': 'Eliminare toate',
  'workbench.editors.rule.fields.operatorEquals': 'Este egal cu',
  'workbench.editors.rule.fields.operatorContains': 'Conține',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': 'Date statice',
  'workbench.editors.rule.fields.dynamicJs': 'Dinamic (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Formatat',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Brut',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    'Vizualizarea formatată este disponibilă doar pentru corpurile în formă JSON.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Vizualizare formatată',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Corp',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Formatat și Brut sunt două vizualizări ale aceluiași text al corpului — textul de rețea este ceea ce servește regula.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Exemplu — o valoare, două vizualizări',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Moduri',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'O vizualizare de citire — diferă doar spațiile. Editările sunt recodificate în formatul de rețea original, iar Salvare scrie acel text de rețea; o salvare fără editări scrie exact octeții originali.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    'Textul de rețea însuși — exact ceea ce servește regula.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'Operație GraphQL (filtru pe conținutul util al cererii)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Cheie, de ex. operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'valoare, de ex. getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'Regulă de antete',
  'workbench.editors.rule.fields.header.infoSummary': 'Rescrie antetele de cerere și de răspuns pe traficul potrivit.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Combinațiile nevalide (de ex. Adăugare la sfârșit pe un antet personalizat) marchează regula ca ciornă. Ciornele se salvează, dar nu se execută.',
  'workbench.editors.rule.fields.header.requestTab': 'Antete de cerere',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'Acțiuni pe antete aplicate cererii trimise înainte ca aceasta să părăsească browserul.',
  'workbench.editors.rule.fields.header.responseTab': 'Antete de răspuns',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'Acțiuni pe antete aplicate răspunsului înainte ca pagina să îl vadă.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'Fila Network din DevTools a browserului afișează întotdeauna antetele originale ale serverului, așa că aceste modificări sunt invizibile acolo, deși sunt aplicate. Fereastra DevTools Open Headers nu are această limitare — afișează antetele exact așa cum sunt servite paginii.',
  'workbench.editors.rule.fields.header.emptyRequest':
    'Nicio acțiune — această regulă lasă antetele de cerere neschimbate',
  'workbench.editors.rule.fields.header.emptyResponse':
    'Nicio acțiune — această regulă lasă antetele de răspuns neschimbate',
  'workbench.editors.rule.fields.header.namePlaceholder': 'Nume antet',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'Valoare antet',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Valoare de adăugat la sfârșit',
  'workbench.editors.rule.fields.header.existingValue': 'valoarea existentă',
  'workbench.editors.rule.fields.header.switchTo': 'Comutare la {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Trageți pentru a reordona',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Regulă de blocare',
  'workbench.editors.rule.fields.block.infoSummary':
    'Blocarea anulează cererile potrivite înainte ca acestea să părăsească browserul.',
  'workbench.editors.rule.fields.block.infoDescription':
    'Nu este necesară nicio configurare a acțiunii — blocarea însăși este acțiunea; condițiile decid ce se blochează.',
  'workbench.editors.rule.fields.block.title': 'Blocare cereri',
  'workbench.editors.rule.fields.block.body':
    'Cererile care corespund condițiilor de mai jos vor fi blocate. Browserul va afișa paginii o eroare de rețea.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Regulă de redirecționare',
  'workbench.editors.rule.fields.redirect.infoSummary':
    'Trimite cererile potrivite către o altă adresă URL înainte ca acestea să ajungă în rețea.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'Cu o condiție Regex URL, \\1, \\2 … substituie grupurile capturate în adresa URL țintă.',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Redirecționează către',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Altă adresă URL',
  'workbench.editors.rule.fields.redirect.localFile': 'Fișier local',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'Disponibil în aplicația desktop',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    'de ex. https://openheaders.com/redirected — folosiți \\1, \\2 cu condiții Regex URL',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Regulă de parametru de interogare',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Adaugă, înlocuiește sau elimină parametri de interogare din adresele URL ale cererilor potrivite.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    'Eliminare toate elimină întregul șir de interogare; intrările Adăugare / Înlocuire din aceeași regulă devin apoi noua interogare. Intrările Doar înlocuire și Eliminare nu mai au pe ce acționa și sunt ignorate alături de Eliminare toate.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    'Eliminare toate elimină întregul șir de interogare, așa că intrările Doar înlocuire și Eliminare nu au pe ce acționa și sunt ignorate. Intrările Adăugare / Înlocuire se aplică în continuare — ele devin noua interogare.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'Elimină toți parametrii de interogare din adresa URL',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Nume parametru',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Valoare parametru',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': 'Regulă de injectare',
  'workbench.editors.rule.fields.inject.infoSummary':
    'Injectează un script sau o foaie de stil în paginile potrivite pe măsură ce se încarcă.',
  'workbench.editors.rule.fields.inject.language': 'Limbaj:',
  'workbench.editors.rule.fields.inject.codeSource': 'Sursa codului:',
  'workbench.editors.rule.fields.inject.insert': 'Inserare:',
  'workbench.editors.rule.fields.inject.sourceCode': 'Cod',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'După încărcarea paginii',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'Cât mai curând posibil',
  'workbench.editors.rule.fields.inject.source': 'Sursă',
  'workbench.editors.rule.fields.inject.code': 'Cod',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder':
    'Introduceți adresa URL a sursei (relativă sau absolută)',
  'workbench.editors.rule.fields.inject.bypassCsp':
    'Ocolire Content-Security-Policy, astfel încât scripturile injectate să se execute întotdeauna',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    'Acoperă deocamdată doar politica CSP din antet — o politică CSP din <meta> poate în continuare bloca acest script. Pentru a le ocoli pe ambele, activați „Allow user scripts” pentru această extensie în setările de extensii ale browserului.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Regulă de întârziere',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Reține cererile potrivite pentru timpul configurat înainte de a le lăsa să continue.',
  'workbench.editors.rule.fields.delay.capsAlert':
    'Navigările de document și iframe sunt întârziate cu până la 30.000 ms printr-o pagină locală de așteptare. Cererile XHR/Fetch inițiate din JS sunt plafonate la 5.000 ms, pentru a evita epuizarea rezervei de conexiuni HTTP. Subresursele (CSS, JS, imagini) nu sunt întârziate.',
  'workbench.editors.rule.fields.delay.label': 'Întârziere',
  'workbench.editors.rule.fields.delay.maxNote': 'Maximum 30.000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Regulă de corp cerere',
  'workbench.editors.rule.fields.requestBody.infoSummary':
    'Înlocuiește corpul cererilor potrivite înainte ca acestea să fie trimise.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    'Date statice pune în loc un conținut util fix; Dinamic rulează JavaScript peste corpul original.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Interceptează apelurile fetch() și XMLHttpRequest pentru cererile API REST sau GraphQL.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Selectați tipul de resursă',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Corpul cererii',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Funcția dvs. primește',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'și trebuie să returneze corpul modificat. Returnați un șir sau un obiect (serializat automat ca JSON).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Regulă de răspuns',
  'workbench.editors.rule.fields.response.infoSummary':
    'Servește un răspuns substitut pentru cererile potrivite în locul celui returnat de server.',
  'workbench.editors.rule.fields.response.infoDescription':
    'Date statice servește un conținut util fix; Dinamic rulează JavaScript peste răspunsul original.',
  'workbench.editors.rule.fields.response.sourceLabel': 'Sursa răspunsului',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Acționează asupra răspunsurilor fetch() și XMLHttpRequest pentru cererile API REST sau GraphQL.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Simulare servește corpul dvs. fără a apela serverul; Modificare trimite cererea reală și editează răspunsul înainte ca pagina să îl vadă.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Simulare — nicio cerere trimisă',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 Modificare — editarea răspunsului serverului',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'Cererea reală este trimisă; modificările dvs. se aplică răspunsului înainte ca pagina să îl vadă.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'Cererea nu părăsește niciodată browserul — pagina primește direct răspunsul dvs.',
  'workbench.editors.rule.fields.response.resourceType': 'Tip de resursă',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'Ce formă de conținut util API țintește regula — REST sau GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL deblochează mai jos un filtru de operație, astfel încât regula să se potrivească cu o singură operație dintr-un punct final partajat.',
  'workbench.editors.rule.fields.response.statusCode': 'Cod de stare',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'Starea HTTP servită împreună cu răspunsul dvs.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    'Alegeți un cod de servit sau păstrați-l pe cel original din răspunsul serverului atunci când apelați serverul.',
  'workbench.editors.rule.fields.response.keepOriginalStatus': 'Păstrare cod de stare original',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'Antetul Content-Type servit împreună cu corpul — controlează cum îl parsează browserul.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    'Tastați orice valoare; sugestiile sunt doar o comoditate. Când apelați serverul, suprascrie antetul Content-Type al răspunsului real doar dacă este setat.',
  'workbench.editors.rule.fields.response.headersLabel': 'Antete de răspuns',
  'workbench.editors.rule.fields.response.headersInfoSummary': 'Antete suplimentare servite alături de Content-Type.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'Când apelați serverul, acestea se îmbină peste antetele răspunsului real; la simulare devin antetele răspunsului. Rândurile goale sunt eliminate la salvare.',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'Nume antet (de ex. X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'Valoare antet',
  'workbench.editors.rule.fields.response.addHeader': 'Adăugare antet',
  'workbench.editors.rule.fields.response.bodyLabel': 'Corpul răspunsului',
  'workbench.editors.rule.fields.response.bodyInfoSummary': 'Conținutul util servit paginii pentru cererile potrivite.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Date statice servește un corp fix; Dinamic (JavaScript) îl construiește sau îl transformă la momentul cererii.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': 'Cererea reală se face mai întâi. Funcția dvs.',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'primește răspunsul și contextul cererii, apoi returnează răspunsul modificat. Returnați un șir sau un obiect (serializat automat ca JSON).',
  'workbench.editors.rule.fields.response.dynMockBefore': 'Nicio cerere nu este trimisă. Funcția dvs.',
  'workbench.editors.rule.fields.response.dynMockMid': 'primește',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'și returnează corpul răspunsului. Returnați un șir sau un obiect (serializat automat ca JSON).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'Regulă WebSocket',
  'workbench.editors.rule.fields.message.sseKicker': 'Regulă SSE',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Modifică, injectează sau elimină cadre WebSocket pe conexiunile potrivite înainte ca pagina sau rețeaua să le vadă.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Modifică, injectează sau elimină evenimente server-sent pe fluxurile potrivite înainte ca ascultătorii să le vadă.',
  'workbench.editors.rule.fields.message.wsIntro':
    'Interceptează conexiunile WebSocket create de pagină a căror adresă URL de socket corespunde condițiilor. Cadrele sunt modificate, injectate sau eliminate în pagină înainte de a ajunge la codul paginii (primite) sau în rețea (trimise).',
  'workbench.editors.rule.fields.message.sseIntro':
    'Interceptează fluxurile EventSource create de pagină a căror adresă URL corespunde condițiilor. Evenimentele sunt modificate, injectate sau eliminate în pagină înainte ca ascultătorii să le vadă.',
  'workbench.editors.rule.fields.message.operation': 'Operație',
  'workbench.editors.rule.fields.message.opReplace': 'Înlocuire',
  'workbench.editors.rule.fields.message.opInject': 'Injectare',
  'workbench.editors.rule.fields.message.opDrop': 'Eliminare',
  'workbench.editors.rule.fields.message.direction': 'Direcție',
  'workbench.editors.rule.fields.message.incoming': 'Primite (server → pagină)',
  'workbench.editors.rule.fields.message.outgoing': 'Trimise (pagină → server)',
  'workbench.editors.rule.fields.message.eventName': 'Nume eveniment',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Gol = evenimentele message implicite',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'Se potrivește cu câmpul',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'al fluxului',
  'workbench.editors.rule.fields.message.frameFilter': 'Filtru de cadre',
  'workbench.editors.rule.fields.message.dataFilter': 'Filtru de date',
  'workbench.editors.rule.fields.message.everyFrame': 'Fiecare cadru',
  'workbench.editors.rule.fields.message.everyEvent': 'Fiecare eveniment',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'Filtrele se potrivesc doar cu cadrele text — cadrele binare trec neatinse când un filtru este setat.',
  'workbench.editors.rule.fields.message.filterNoteSse': 'Filtrele se potrivesc doar cu evenimentele text.',
  'workbench.editors.rule.fields.message.injectWhen': 'Injectare când',
  'workbench.editors.rule.fields.message.connectionOpens': 'Se deschide conexiunea',
  'workbench.editors.rule.fields.message.streamOpens': 'Se deschide fluxul',
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'Sosește un cadru potrivit',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'Sosește un eveniment potrivit',
  'workbench.editors.rule.fields.message.injectedFrame': 'Cadru injectat',
  'workbench.editors.rule.fields.message.injectedEvent': 'Eveniment injectat',
  'workbench.editors.rule.fields.message.replacementFrame': 'Cadru de înlocuire',
  'workbench.editors.rule.fields.message.replacementEvent': 'Eveniment de înlocuire',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': 'Regulă de autentificare',
  'workbench.editors.rule.fields.auth.infoSummary':
    'Răspunde provocărilor de autentificare HTTP sau proxy de pe cererile potrivite cu aceste acreditări.',
  'workbench.editors.rule.fields.auth.infoDescription':
    'Ambele câmpuri rezolvă {{templates}}, așa că secretul real poate sta în vault ({{vault.*}}) în loc de text simplu pe regulă. Are efect doar pe filele din raza de acțiune a modului Depanare.',
  'workbench.editors.rule.fields.auth.introBefore':
    'Răspunde unei provocări de autentificare de server (401) sau de proxy (407) pe cererile potrivite. Faceți referire la un secret din vault — de ex.',
  'workbench.editors.rule.fields.auth.introAfter': '— astfel încât acreditarea să nu fie stocată în regulă.',
  'workbench.editors.rule.fields.auth.username': 'Nume de utilizator',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'de ex. dev-user sau {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Parolă',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'de ex. {{vault.STAGING_PW}}',
} as const satisfies Catalog;
