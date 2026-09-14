/**
 * DevTools panel — inspector Cookies tab — Romanian. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by
 * design: cookie names/values, Set-Cookie attribute names as titles
 * and field labels (Name / Value / Domain / Path / Expires / SameSite
 * / HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary (Unspecified /
 * None (cross-site) / Lax / Strict — rendered AND parsed, never
 * convert one side alone), the literal `Session`, `__Host-` /
 * `__Secure-` prefixes, role chips (auth? / tracking? / pref), format
 * nouns, and byte figures. Mints: On/Off projection = Activat /
 * Dezactivat (round-trip, both sides — decided once); the respins /
 * eliminat split — the browser RESPINGE (rejects) a Set-Cookie, the
 * dropped chip reads respins, a rule ELIMINĂ (drops) a frame (carried
 * from streams); terț = third-party (carried); partiționat carried;
 * depozitul de cookie-uri = jar carried; rol = role (classifier);
 * prefix; Suprascriere cookie-uri = the Override Cookies CTA (quoted
 * later in „…”); Adăugare Cookie keeps the glossary token of the
 * (i) title while the toolbar button reads Adăugare cookie (en case).
 * Prefix prose leads with a head noun (cookie-urile cu prefixul
 * __Host-) — never a butted ending on the raw token. The DevTools
 * path quotes Chrome's own ro UI (Aplicație → Cookie-uri). The
 * capitalized sentence-start `Cookie-ul` keeps the glossary token.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ───────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'Filtru — text, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Filtrare cookie-uri',
  'panel.inspector.cookies.empty': 'Niciun cookie trimis sau primit.',

  // Table column headers.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': 'trimise: {count} · {bytes} B',
  'panel.inspector.cookies.footprint.set': 'setate: {count} · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': 'vor fi respinse: {count}',
  'panel.inspector.cookies.footprint.filteredOut': 'filtrate: {count}',
  'panel.inspector.cookies.footprint.flagged': 'semnalate: {count}',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Suprascriere cookie-uri',
  'panel.inspector.cookies.cta.overrideCookiesTitle':
    'Creați o regulă care schimbă cookie-urile de pe cererile potrivite',
  'panel.inspector.cookies.cta.requestCookies': 'Cookie-uri de cerere…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Înlocuiește antetul Cookie trimis la această cerere',
  'panel.inspector.cookies.cta.responseCookies': 'Cookie-uri de răspuns…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Înlocuiește un antet Set-Cookie venit de la server',
  'panel.inspector.cookies.cta.noCookies': 'Fără trimitere de cookie-uri…',
  'panel.inspector.cookies.cta.noCookiesTitle':
    'Elimină antetul Cookie în întregime, astfel încât serverul nu vede niciun cookie',
  'panel.inspector.cookies.cta.addCookie': 'Adăugare cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Adăugați un cookie în depozitul browserului (inclusiv HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Suprascriere cookie-uri',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Regulă',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Creează o regulă care rescrie antetele Cookie / Set-Cookie la cererile potrivite cât timp se declanșează. Depozitul de cookie-uri al browserului rămâne neatins.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Opțiuni',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Cookie-uri de cerere',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Înlocuiește antetul Cookie trimis de browser.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Cookie-uri de răspuns',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Înlocuiește un antet Set-Cookie venit de la server.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'Fără trimitere de cookie-uri',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Elimină antetul Cookie în întregime — serverul vede o cerere fără cookie-uri.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Adăugare Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Depozitul browserului',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Scrie un cookie real în depozitul browserului — același depozit pe care browserul îl afișează sub Aplicație → Cookie-uri.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'Persistă dincolo de această cerere, iar browserul îl atașează oriunde se potrivesc domeniul, calea și indicatoarele sale — fără nicio regulă implicată. Este și modul de a crea cookie-uri HttpOnly, pe care scripturile paginii nu le pot seta. Valoarea acceptă referințe {{variable}}, rezolvate o singură dată la salvare — depozitul păstrează acel instantaneu chiar dacă variabila se schimbă ulterior; folosiți „Suprascriere cookie-uri” când valoarea trebuie să urmeze variabila.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie-ul „{name}” a fost salvat',
  'panel.inspector.cookies.toast.saveFailed': 'Cookie-ul „{name}” nu a putut fi salvat',
  'panel.inspector.cookies.toast.saveFailedWithError': 'Cookie-ul „{name}” nu a putut fi salvat — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie-ul „{name}” a fost șters',
  'panel.inspector.cookies.toast.deleteFailed': 'Cookie-ul „{name}” nu a putut fi șters',
  'panel.inspector.cookies.toast.mergeApplied': 'Îmbinare aplicată formularului — Salvarea o scrie în browser',
  'panel.inspector.cookies.confirmDelete.title': 'Ștergeți cookie-ul „{name}”?',
  'panel.inspector.cookies.confirmDelete.content':
    'Acesta îl elimină din depozitul de cookie-uri al browserului. Pagina nu îl va mai trimite.',
  'panel.inspector.cookies.confirmDelete.ok': 'Ștergere',

  // More filters ▾ / View ▾ — this tab's own menus.
  'panel.inspector.cookies.moreFilters.label': 'Mai multe filtre',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Numai probleme',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'Numai terțe',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Numai modificate de reguli',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Afișare cookie-uri de cerere filtrate',
  'panel.inspector.cookies.view.label': 'Vizualizare',
  'panel.inspector.cookies.view.sort': 'Sortare',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Dimensiune',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relativ',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absolut',
  'panel.inspector.cookies.view.decodeValues': 'Decodificare valori codificate URL',
  'panel.inspector.cookies.view.groupByRole': 'Grupare după rol (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': 'Afișare etichete',
  'panel.inspector.cookies.view.showSuggestions': 'Afișare sugestii',

  // Section chrome.
  'panel.inspector.cookies.section.responseCookies': 'Cookie-uri de răspuns',
  'panel.inspector.cookies.section.requestCookies': 'Cookie-uri de cerere',
  'panel.inspector.cookies.section.countOf': '{visible} din {total}',

  // Role vocabulary — product classifier copy.
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Autentificare și sesiune',
  'panel.inspector.cookies.role.sectionFunctional': 'Funcționale',
  'panel.inspector.cookies.role.sectionPref': 'Preferințe',
  'panel.inspector.cookies.role.sectionTracking': 'Analiză și urmărire',
  'panel.inspector.cookies.role.nounAuth': 'autentificare / sesiune',
  'panel.inspector.cookies.role.nounTracking': 'analiză / urmărire',
  'panel.inspector.cookies.role.nounPref': 'preferință / consimțământ',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — cookie de {noun}.',
  'panel.inspector.cookies.role.tooltipAuth': 'Pare un cookie de autentificare / sesiune (euristic).',
  'panel.inspector.cookies.role.tooltipTracking': 'Pare un cookie de analiză / urmărire (euristic).',
  'panel.inspector.cookies.role.tooltipPref': 'Un cookie de preferință a utilizatorului.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'partiționat',
  'panel.inspector.cookies.chips.partitionedTitle': 'Izolat la site-ul de nivel superior: {key}',
  'panel.inspector.cookies.chips.thirdParty': 'terț',
  'panel.inspector.cookies.chips.justSet': 'setat acum',
  'panel.inspector.cookies.chips.justSetTitle': 'Setat de acest răspuns.',
  'panel.inspector.cookies.chips.dropped': 'respins',
  'panel.inspector.cookies.chips.droppedTitle': 'Browserul va respinge acest Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'filtrat',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'Netrimis la această cerere.',
  'panel.inspector.cookies.chips.problemTitle': 'Vedeți sugestia de mai sus.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — trimis doar prin HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Lipsește Secure — SameSite=None necesită Secure; browserul va respinge acest cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix':
    'Lipsește Secure — prefixul __Host- / __Secure- necesită Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'Fără atribut Secure.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — nu poate fi citit din JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Poate fi citit din JavaScript (fără HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — trimis doar la navigările same-site.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — trimis la cererile GET cross-site de nivel superior.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None fără Secure — browserul va respinge.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — trimis la fiecare cerere cross-site.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite nespecificat.',

  // Row actions + status dots + name/value tooltips.
  'panel.inspector.cookies.row.copyValue': 'Copiere valoare',
  'panel.inspector.cookies.row.copied': 'Copiat',
  'panel.inspector.cookies.row.override': 'Suprascriere',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Creați o regulă pentru a suprascrie acest Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Creați o regulă pentru a suprascrie această valoare Cookie',
  'panel.inspector.cookies.row.editCookieTitle': 'Editați acest cookie în depozitul browserului',
  'panel.inspector.cookies.row.editCookieAria': 'Editare cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Ștergeți acest cookie din depozitul browserului',
  'panel.inspector.cookies.row.deleteCookieAria': 'Ștergere cookie',
  'panel.inspector.cookies.row.ruleDotTitle': 'O regulă modifică antetul {header} la această cerere',
  'panel.inspector.cookies.row.ruleDotAria': 'Se aplică o regulă',
  'panel.inspector.cookies.row.editedDotTitle': 'Editat din acest panou',
  'panel.inspector.cookies.row.editedDotAria': 'Editat',
  'panel.inspector.cookies.row.hostPrefixHint':
    'Prefixul __Host- fixează acest cookie pe o singură gazdă: browserul impune Secure, Path=/ și lipsa atributului Domain. Liniile Set-Cookie care încalcă oricare dintre acestea sunt respinse.',
  'panel.inspector.cookies.row.securePrefixHint':
    'Prefixul __Secure- forțează acest cookie să fie Secure (doar HTTPS). Liniile Set-Cookie fără Secure sunt respinse.',
  'panel.inspector.cookies.row.editedValueTitle': 'Editat — cererea a purtat: {value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'Acest răspuns a setat: {value} — valoarea din depozit s-a schimbat între timp.',
  'panel.inspector.cookies.row.valueNoteRequest':
    'Această cerere a trimis: {value} — valoarea din depozit s-a schimbat între timp.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Stare',
  'panel.inspector.cookies.statusRail.summary':
    'Un pătrat marchează cookie-urile care nu sunt în starea lor brută din browser.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Culorile pătratelor',
  'panel.inspector.cookies.statusRail.blue': 'albastru',
  'panel.inspector.cookies.statusRail.blueDesc':
    'O regulă declanșată la această cerere modifică antetul Cookie / Set-Cookie al acestei direcții.',
  'panel.inspector.cookies.statusRail.grey': 'gri',
  'panel.inspector.cookies.statusRail.greyDesc': 'Adăugat sau editat din acest panou în această sesiune.',

  // Add / edit popover. The SameSite labels, On/Off flag words and the
  // Session expires word are ROUND-TRIP vocabulary.
  'panel.inspector.cookies.edit.editTitle': 'Editare cookie',
  'panel.inspector.cookies.edit.valueChanged': 'valoare schimbată',
  'panel.inspector.cookies.edit.goneNote':
    'Acest cookie a fost șters în browser cât timp formularul era deschis — Salvarea îl scrie înapoi.',
  'panel.inspector.cookies.edit.openInTab': 'Deschidere în filă nouă',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Salvați sau anulați mai întâi editările — documentul se deschide din depozitul browserului',
  'panel.inspector.cookies.edit.openTitle': 'Deschideți acest cookie ca filă de document',
  'panel.inspector.cookies.edit.save': 'Salvare',
  'panel.inspector.cookies.edit.unresolved': 'Nu se rezolvă — creați variabila sau corectați referința.',
  'panel.inspector.cookies.edit.writes': 'Scrie: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'nume cookie',
  'panel.inspector.cookies.edit.valuePlaceholder': 'valoare sau {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'La o dată',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'Activat',
  'panel.inspector.cookies.edit.flagOff': 'Dezactivat',
  // Pre-write constraint sentences.
  'panel.inspector.cookies.edit.constraint.hostSecure':
    'Cookie-urile cu prefixul __Host- trebuie să aibă indicatorul Secure activat.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    'Cookie-urile cu prefixul __Host- nu pot purta un atribut Domain — activați „Host only”.',
  'panel.inspector.cookies.edit.constraint.hostPath':
    'Cookie-urile cu prefixul __Host- trebuie să folosească calea „/”.',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    'Cookie-urile cu prefixul __Secure- trebuie să aibă indicatorul Secure activat.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite „{label}” necesită indicatorul Secure.',
  // Merge parse-back errors — rendered inline in the merge modal.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'Rezultatul îmbinării nu este JSON valid — corectați sintaxa și finalizați îmbinarea din nou.',
  'panel.inspector.cookies.edit.merge.notObject':
    'Rezultatul îmbinării trebuie să fie un obiect JSON cu câmpurile cookie-ului.',
  'panel.inspector.cookies.edit.merge.fieldMissing': 'Câmpul "{field}" trebuie să fie prezent ca șir.',
  'panel.inspector.cookies.edit.merge.flagOnOff': 'Câmpul "{field}" trebuie să fie "{on}" sau "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': 'Câmpul "sameSite" trebuie să fie unul dintre {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    'Câmpul "expires" trebuie să fie "{session}" sau o dată precum 2026-07-09T14:30.',

  // Edit-form field (i) corpus.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Exemplu de Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Câmp Cookie',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Indicator Cookie',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Acceptă referințe {{variable}}, rezolvate o singură dată la salvare — depozitul stochează textul rezolvat.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'Identificatorul cookie-ului. Browserele indexează după (name, domain, path) — același nume cu o altă sferă este un cookie separat.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'Prefixele sunt impuse de browser: __Host- necesită Secure, Path=/ și lipsa lui Domain; __Secure- necesită Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'Conținutul util al cookie-ului — ce trimite browserul înapoi în antetul Cookie.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'Valoarea este un instantaneu: dacă variabila se schimbă ulterior, depozitul păstrează acest text — folosiți o regulă „Suprascriere cookie-uri” când valoarea trebuie să urmeze variabila.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Ce gazde primesc cookie-ul.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'Un domeniu simplu precum openheaders.com își include subdomeniile (browserul îl stochează cu un punct inițial), cu excepția cazului în care Host-only este activat, ceea ce fixează cookie-ul exact pe această gazdă.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'Prefixul de cale URL pe care circulă cookie-ul — /api înseamnă că doar cererile de sub /api îl poartă.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Implicit /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'Când șterge browserul cookie-ul.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Cookie-urile de sesiune trăiesc până la încheierea sesiunii de browser; „La o dată” setează o expirare absolută (stocată ca atribut Expires).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'Când pot purta cererile cross-site cookie-ul.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Valori',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Doar cererile same-site.',
  'panel.inspector.cookies.fieldInfo.samesite.lax': 'Same-site plus navigările cross-site de nivel superior (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Trimis și cross-site — browserul cere Secure împreună cu el.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified': 'Implicitul browserului (tratat ca Lax în Chrome).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Ascunde cookie-ul de scripturile JavaScript ale paginii — document.cookie nu îl poate citi sau suprascrie.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Doar serverele (Set-Cookie) și acest editor pot crea cookie-uri HttpOnly; scripturile paginii nu pot. Întărirea standard pentru tokenurile de sesiune.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'Cookie-ul circulă doar prin HTTPS — cererile http simple nu îl poartă niciodată.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Obligatoriu pentru SameSite=None și pentru prefixele de nume __Host- / __Secure-.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Fixează cookie-ul exact pe gazda din Domain — subdomeniile nu îl primesc.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Dezactivat, cookie-ul este stocat pentru întregul domeniu (forma cu punct inițial) și ajunge la subdomenii. Cookie-urile proprii ale browserului sunt host-only când serverul a omis atributul Domain.',

  // Column (i) corpus.
  'panel.inspector.cookies.columnInfo.name.summary':
    'Identificatorul cookie-ului. Browserele indexează după (name, domain, path) — două cookie-uri cu același nume, dar cu sfere diferite, sunt distincte.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Cipurile din dreapta scot la iveală lucruri care nu se află în nicio coloană. Apar lângă nume; treceți cursorul peste un rând pentru a dezvălui acțiunea Suprascriere deasupra valorii.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Rol (euristic)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Pare un cookie de autentificare / sesiune — numele corespunde cu sess / session / auth / sid / token / csrf / xsrf, sau cookie-ul este HttpOnly cu o valoare aleatorie lungă.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Pare un cookie de analiză / urmărire — numele corespunde unui tracker cunoscut (_ga, _gid, _fbp, NID, IDE, MUID, _hjid, …), sau cookie-ul este terț fără altă clasificare.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'Un cookie de preferință a utilizatorului — tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Ciclu de viață',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'Set-Cookie a sosit cu acest răspuns și browserul l-a acceptat.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie a sosit, dar browserul îl va respinge — a încălcat o regulă precum SameSite=None fără Secure, încălcarea prefixului __Host-, prefixul __Secure- fără Secure sau Partitioned fără Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'Depozitul conține acest cookie, dar nu a fost trimis la această cerere (nepotrivire de cale, Secure pe http, expirat, restricție SameSite, …). Apare doar când „Afișare cookie-uri de cerere filtrate” este activat.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Context',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    'Domeniul cookie-ului este cross-site față de originea cadrului superior al paginii.',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'Izolare în stil CHIPS — cookie-ul este indexat după site-ul de nivel superior pe lângă propria sferă. Treceți cursorul pentru cheia de partiție.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'Acest cookie a declanșat o sugestie (cardurile de avertizare din partea de sus a filei). Vedeți nota pentru a afla de ce.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Prefixe (vizibile în nume)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'Fixat pe gazdă — browserul impune Secure, Path=/, fără Domain. Încălcările sunt respinse.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'Doar HTTPS — browserul impune Secure. Încălcările sunt respinse.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'Conținutul util al cookie-ului. Apăsați un rând pentru a extinde un panou cu vizualizări analizate când valoarea are structură.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Formate detectate automat',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Trei segmente base64url — antetul și conținutul util sunt decodificate; revendicările exp / iat / nbf apar ca timpi relativi.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc':
    'Formatat în panoul extensibil (funcționează și după decodificarea URL).',
  'panel.inspector.cookies.columnInfo.value.b64Desc':
    'base64 simplu — corpul decodificat este afișat când este imprimabil.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Text codificat procentual — comutați „Decodificare valori codificate URL” în Vizualizare pentru a afișa decodificat inline.',
  'panel.inspector.cookies.columnInfo.scope.summary': 'Unde va atașa browserul acest cookie — Domain + Path combinate.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'Un punct inițial în domeniu (de ex. `.openheaders.com`) înseamnă că subdomeniile sunt incluse. O cale finală precum `/api` înseamnă că cookie-ul se trimite doar la cererile de sub acea cale.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'Când va înceta browserul să trimită acest cookie. Culoarea urmărește urgența.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Citirea culorii',
  'panel.inspector.cookies.columnInfo.expires.red': 'roșu',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Deja expirat sau expiră în mai puțin de o oră.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'galben',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Expiră în 24 de ore.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'simplu',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'Viitor — la mai mult de o zi distanță.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Fără Expires / Max-Age — browserul renunță la el când se încheie sesiunea.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Format',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relativ (implicit)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '„în 7 luni”, „acum 30 s” — relativ la momentul curent. Treceți cursorul pentru data absolută.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absolut',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'Dată UTC. Se comută în Vizualizare → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Dimensiunea cookie-ului serializat în octeți — lungimea `name=value`, folosită pentru totalul conținutului util per cerere.',
  'panel.inspector.cookies.columnInfo.size.description':
    'Majoritatea serverelor și intermediarilor plafonează antetul Cookie combinat la 4 KB. Conținutul util supradimensionat poate cauza răspunsuri 4xx / 5xx fără o eroare clară.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Securitate (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Trei glifuri restrâng atributele Secure / HttpOnly / SameSite într-o singură celulă. Culoarea poartă sensul.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Glifuri',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — trimis doar prin HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — nu poate fi citit din JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'Restricție SameSite (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Culoare',
  'panel.inspector.cookies.columnInfo.sec.green': 'verde',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'Activat / strict — bine securizat.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'galben',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — trimis la cererile GET cross-site de nivel superior.',
  'panel.inspector.cookies.columnInfo.sec.red': 'roșu',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Lipsește acolo unde este obligatoriu (SameSite=None fără Secure, __Host- fără Secure, …) — browserul va respinge.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'gri',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Dezactivat / nespecificat.',

  // Cookie insights (t-fed `computeCookieInsights`).
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie setat cu SameSite=None, dar fără Secure',
      few: '{count} cookie-uri setate cu SameSite=None, dar fără Secure',
      other: '{count} de cookie-uri setate cu SameSite=None, dar fără Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Browserele moderne resping cookie-urile SameSite=None care nu sunt și Secure — nu vor fi stocate.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Adăugare atribut Secure',
  'panel.inspector.cookies.insights.hostPrefix.title': 'Prefix __Host- încălcat la {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    'Cookie-urile cu prefixul __Host- trebuie să fie Secure, Path=/ și fără atribut Domain. Altfel browserele le resping.',
  'panel.inspector.cookies.insights.securePrefix.title': 'Prefix __Secure- încălcat la {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    'Cookie-urile cu prefixul __Secure- trebuie să poarte atributul Secure. Altfel browserele le resping.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie Partitioned fără Secure',
      few: '{count} cookie-uri Partitioned fără Secure',
      other: '{count} de cookie-uri Partitioned fără Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Cookie-urile Partitioned trebuie să fie Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookie-uri setate prin HTTP simplu',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'Aceste cookie-uri pot fi observate și reluate de oricine de pe traseu. Folosiți HTTPS + atributul Secure.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie expirat încă trimis',
      few: '{count} cookie-uri expirate încă trimise',
      other: '{count} de cookie-uri expirate încă trimise',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'Aceste cookie-uri au o expirare în trecut, dar cererea le-a purtat — depozitul le va elimina în curând.',
  'panel.inspector.cookies.insights.oversized.title': 'Antetul Cookie are {bytes}B (peste limita uzuală de 4KB)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Serverele și intermediarii plafonează dimensiunea antetelor; conținutul Cookie supradimensionat poate cauza 4xx / 5xx fără o eroare clară.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie terț setat',
      few: '{count} cookie-uri terțe setate',
      other: '{count} de cookie-uri terțe setate',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} cookie terț setat de',
      few: '{count} cookie-uri terțe setate de',
      other: '{count} de cookie-uri terțe setate de',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Browserele moderne le pot bloca în contexte cross-site, cu excepția cazului în care optează pentru CHIPS prin atributul Partitioned.',
} as const satisfies Catalog;
