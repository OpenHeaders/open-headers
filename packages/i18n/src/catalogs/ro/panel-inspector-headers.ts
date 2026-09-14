/**
 * DevTools panel — inspector Headers tab — Romanian. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, `A → Z` / `Train-Case`, and wire values stay raw.
 * Mints: antete provizorii = provisional headers (Chrome's ro DevTools
 * wording); antete de zgomot = noise headers; General = the General
 * section (raw, the row-info section title); intervale = status ranges
 * (numeric referent); variabilă per domeniu = per-domain variable;
 * antet JWT = the JWT header segment (distinct from antetul HTTP);
 * revendicare = JWT claim (carried from shared-components); Reguli
 * potrivite = Matched Rules (carried); caractere corupte (mojibake) =
 * mojibake gloss; multipart rides raw (delimitator multipart); între
 * timp = the since-fire chips; Bună practică = Best practice; expirare
 * / expirat ride the shared-info-cookies family; Brut = Raw carried.
 * Every raw token takes a head noun before an article (indicatorul
 * `Secure`, antetul `{name}`, valoarea JWT); the capitalized
 * sentence-start `Cookie-ul` keeps the glossary token.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail) ───────────────────────────────────
  'panel.inspector.headers.filterPlaceholder':
    'Filtru — text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Filtrare antete',
  'panel.inspector.headers.footprintTitle': '{rules} — apăsați pentru a deschide „Reguli potrivite”',

  // General section + the rule-creation CTAs on its summary.
  'panel.inspector.headers.generalSection': 'General',
  'panel.inspector.headers.createApiRequest': 'Creare cerere API',
  'panel.inspector.headers.createApiRequestTitle':
    'Deschide această cerere în clientul API din Workbench ca ciornă precompletată — nimic nu se salvează până nu salvați dvs.',
  'panel.inspector.headers.redirect.label': 'Redirecționare',
  'panel.inspector.headers.redirect.title':
    'Trimiteți cererile potrivite în altă parte — alegeți cum se precompletează ținta',
  'panel.inspector.headers.redirect.url': 'Adresă URL de redirecționare…',
  'panel.inspector.headers.redirect.urlTitle':
    'Trimite cererile potrivite la o altă adresă URL — ținta se inițializează ca variabilă per domeniu',
  'panel.inspector.headers.redirect.replaceHost': 'Înlocuire gazdă…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'Păstrează calea și interogarea, schimbă gazda — inițializează o variabilă de gazdă per domeniu',
  'panel.inspector.headers.redirect.localhost': 'Trimitere către localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Păstrează calea și interogarea, trimite către serverul dvs. local de dezvoltare prin http — inițializează o variabilă de port per domeniu',
  'panel.inspector.headers.overrideQueryParamsTitle':
    'Adăugați, înlocuiți sau eliminați parametrii de interogare ai acestei cereri',
  'panel.inspector.headers.more.label': 'Mai multe',
  'panel.inspector.headers.more.title': 'Mai multe acțiuni pentru cerere',
  'panel.inspector.headers.more.delay': 'Întârziere cerere',
  'panel.inspector.headers.more.delayTitle': 'Întârzie această cerere',
  'panel.inspector.headers.more.block': 'Blocare cerere',
  'panel.inspector.headers.more.blockTitle': 'Blochează / anulează această cerere',

  // General rows.
  'panel.inspector.headers.general.requestUrl': 'Adresă URL a cererii',
  'panel.inspector.headers.general.requestMethod': 'Metoda cererii',
  'panel.inspector.headers.general.statusCode': 'Cod de stare',
  'panel.inspector.headers.general.remoteAddress': 'Adresă la distanță',
  'panel.inspector.headers.general.httpVersion': 'Versiune HTTP',
  'panel.inspector.headers.general.compression': 'Compresie',
  'panel.inspector.headers.general.transferred': 'Transferat',
  'panel.inspector.headers.general.referrerPolicy': 'Politică Referrer',
  'panel.inspector.headers.general.decodedSuffix': '(decodat {size})',

  // General (i) corpus.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'Adresa URL completă la care browserul a emis cererea — schemă, gazdă, cale și șir de interogare.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'Metoda HTTP folosită (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'Codul numeric de răspuns returnat de server.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Intervale',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Informațional (rar — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Succes.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'Redirecționare (vedeți antetul `Location`).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    'Eroare de client — cererea a fost malformată sau neautorizată.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx':
    'Eroare de server — serverul nu a reușit să onoreze o cerere validă.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary':
    'Adresa IP și portul la care a fost trimisă efectiv cererea.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'Diferă de gazda din adresa URL când DNS se rezolvă la mai multe adrese IP, un CDN rutează prin anycast sau un proxy local interceptează conexiunea.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': 'Versiunea protocolului HTTP negociată de conexiune.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'Aleasă la momentul TLS prin ALPN. Valoarea reală din rețea (de ex. `h2`, `h3`) apare în sfat când diferă de eticheta prietenoasă.',
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'Bazat pe text, implicit o cerere per conexiune.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Binar, multiplexat pe o singură conexiune TCP.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'Construit pe QUIC peste UDP — handshake-uri mai rapide, recuperare mai bună după pierderi.',
  'panel.inspector.headers.generalInfo.compression.summary':
    'Codificarea aplicată de server corpului răspunsului — browserul o decodifică înainte de a o expune către JavaScript.',
  'panel.inspector.headers.generalInfo.compression.gzip': 'Suportat universal, raport de compresie modest.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — raport mai bun decât gzip, suportat de toate browserele moderne.',
  'panel.inspector.headers.generalInfo.compression.zstd':
    'Compresie mai nouă cu raport ridicat; suport în browsere în creștere.',
  'panel.inspector.headers.generalInfo.compression.deflate': 'Moștenire, folosit rar astăzi.',
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Octeții care au trecut efectiv prin rețea, inclusiv supraîncărcarea compresiei.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'Dimensiunea decodată din paranteze este ce vede JavaScript după ce browserul decomprimă corpul. O diferență mare între cele două este câștigul compresiei.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'Cât din adresa URL trimite browserul în `Referer` la navigările și cererile emise din această pagină.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Setată prin antetul de răspuns `Referrer-Policy`, eticheta `<meta name="referrer">` sau per cerere prin atributul `referrerpolicy`.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'Se afișează antete provizorii — servit din cache, așa că antetele trimise inițial nu sunt stocate.',
  'panel.inspector.headers.provisional.bannerPending':
    'Se afișează antete provizorii — setul din rețea nu a fost încă confirmat.',
  'panel.inspector.headers.provisional.title': 'Antete provizorii',
  'panel.inspector.headers.provisional.kicker': 'Cerere',
  'panel.inspector.headers.provisional.summary':
    'Acestea sunt antetele pe care browserul le-a asamblat și intenționa să le trimită — nu o captură confirmată a ceea ce a trecut prin rețea. Setul din rețea poate diferi (stiva de rețea adaugă ulterior cookie-uri, acreditări și antete de conexiune).',
  'panel.inspector.headers.provisional.whyHeading': 'De ce o cerere afișează doar antete provizorii',
  'panel.inspector.headers.provisional.cacheLabel': 'Servită din cache',
  'panel.inspector.headers.provisional.cacheDesc':
    'Răspuns obținut local (cache în memorie/pe disc sau un service worker) — de data aceasta nimic nu a fost trimis în rețea, așa că antetele trimise inițial nu au fost stocate niciodată.',
  'panel.inspector.headers.provisional.blockedLabel': 'Nu a ajuns niciodată în rețea',
  'panel.inspector.headers.provisional.blockedDesc':
    'Blocată sau eșuată înainte de finalizarea unui schimb de antete (o adresă URL nevalidă, un blocaj CORS/CSP, o eroare de conexiune).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Încă în zbor',
  'panel.inspector.headers.provisional.inFlightDesc':
    'Setul din rețea nu a fost încă raportat; se rezolvă când cererea se încheie.',

  // Header sections.
  'panel.inspector.headers.section.responseHeaders': 'Antete de răspuns',
  'panel.inspector.headers.section.requestHeaders': 'Antete de cerere',
  'panel.inspector.headers.section.countAria': 'număr de antete vizibile',
  'panel.inspector.headers.section.addHeader': 'Adăugare antet',
  'panel.inspector.headers.section.raw': 'Brut',
  'panel.inspector.headers.section.rawTitle': 'Afișare ca text simplu (Name: Value)',
  'panel.inspector.headers.section.copy': 'Copiere',
  'panel.inspector.headers.section.copyAll': 'Copiere toate',
  'panel.inspector.headers.section.copyFiltered': 'Copiere filtrate',
  'panel.inspector.headers.section.copyCurl': 'Copiere ca cURL',
  'panel.inspector.headers.section.copyFetch': 'Copiere ca fetch',
  'panel.inspector.headers.section.noneCaptured': 'Nimic capturat.',
  'panel.inspector.headers.section.noFilterMatch': 'Niciun antet nu corespunde filtrului.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} antet de zgomot ascuns — treceți cursorul pentru nume',
      few: '{count} antete de zgomot ascunse — treceți cursorul pentru nume',
      other: '{count} de antete de zgomot ascunse — treceți cursorul pentru nume',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus.
  'panel.inspector.headers.moreFilters.label': 'Mai multe filtre',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Numai modificate de reguli',
  'panel.inspector.headers.moreFilters.securityOnly': 'Numai antete de securitate',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Numai suprascriibile',
  'panel.inspector.headers.moreFilters.hideNoise': 'Ascundere zgomot (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'Vizualizare',
  'panel.inspector.headers.view.layout': 'Aspect',
  'panel.inspector.headers.view.layoutGrouped': 'Grupat',
  'panel.inspector.headers.view.layoutFlat': 'Plat',
  'panel.inspector.headers.view.sort': 'Sortare',
  'panel.inspector.headers.view.sortOriginal': 'Original',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Modificate de reguli mai întâi',
  'panel.inspector.headers.view.nameCase': 'Majuscule în nume',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Original (brut)',
  'panel.inspector.headers.view.showTags': 'Afișare etichete',
  'panel.inspector.headers.view.showSuggestions': 'Afișare sugestii',

  // Header rows.
  'panel.inspector.headers.row.expandValue': 'Extindere valoare',
  'panel.inspector.headers.row.collapseValue': 'Restrângere valoare',
  'panel.inspector.headers.row.copyValue': 'Copiere valoare',
  'panel.inspector.headers.row.copied': 'Copiat',
  'panel.inspector.headers.row.edit': 'Editare',
  'panel.inspector.headers.row.editTitle': 'Editați regula care a setat acest antet',
  'panel.inspector.headers.row.override': 'Suprascriere',
  'panel.inspector.headers.row.overrideTitle': 'Creați o regulă pentru a suprascrie acest antet',
  'panel.inspector.headers.row.overrideProtectedTitle':
    'Antetul {name} este protejat — motorul Declarative Net Request al browserului refuză să lase extensiile să îl suprascrie. Nume protejate frecvente: host, content-length, connection, sec-fetch-*, sec-ch-ua-*.',
  'panel.inspector.headers.row.overrideSystemTitle':
    'Antetul {name} este injectat de {feature}, o funcție de sistem Open Headers — nu poate fi suprascris cu o regulă.',
  'panel.inspector.headers.row.overrideManagedTitle':
    'Antetul {name} este deja gestionat de una dintre regulile dvs. — editați regula din popover-ul ei în loc să suprascrieți.',
  'panel.inspector.headers.row.systemTitle': 'Injectat de {feature} (funcție de sistem Open Headers)',
  'panel.inspector.headers.row.sinceFire.deleted': 'regulă ștearsă între timp',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'Regula a fost ștearsă după această cerere — nu se va aplica cererilor viitoare',
  'panel.inspector.headers.row.sinceFire.disabled': 'regulă dezactivată între timp',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'Regula a fost dezactivată după această cerere — nu se va aplica cererilor viitoare',
  'panel.inspector.headers.row.sinceFire.edited': 'regulă editată între timp',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'Regula a fost editată după această cerere — regula curentă se aplică doar cererilor viitoare',
  'panel.inspector.headers.row.sinceFire.value': 'variabilă schimbată între timp',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'O variabilă referită de această regulă se rezolvă acum la o altă valoare — se aplică doar cererilor viitoare',

  // Value chips.
  'panel.inspector.headers.chips.expires': 'expiră {duration}',
  'panel.inspector.headers.chips.session': 'sesiune',
  'panel.inspector.headers.chips.missingFlag': 'fără {flag}',
  'panel.inspector.headers.chips.expired': 'expirat',

  // Chip (i) corpora.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Indicator Set-Cookie',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Cookie-ul este ascuns de JavaScript (nu poate fi citit prin `document.cookie`).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'Atenuează XSS — un script injectat nu mai poate exfiltra cookie-ul. Nu ajută împotriva CSRF.',
  'panel.inspector.headers.chipInfo.secure.summary':
    'Cookie-ul se trimite doar prin HTTPS. Nu se scurge niciodată prin HTTP simplu.',
  'panel.inspector.headers.chipInfo.partitioned.summary':
    'CHIPS — cookie-ul este partiționat per site de nivel superior.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Fiecare site de nivel superior primește propria copie a cookie-ului, astfel încât contextele încorporate nu pot folosi cookie-uri pentru a urmări utilizatorul între site-uri.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie-ul se trimite doar la cererile same-site. Cea mai puternică protecție CSRF — chiar și linkurile de pe alt site sosesc fără cookie.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie-ul se trimite la cererile same-site și la navigările cross-site de nivel superior (clicuri pe linkuri). Implicit în browserele moderne.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie-ul se trimite la toate cererile cross-site. Necesită `Secure`. Folosiți-l intenționat — destinatarii pot corela cookie-ul între site-uri.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Expirare Cookie',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'Cookie-ul a expirat deja. Browserul nu îl va trimite.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Cookie-ul expiră în {duration} (la {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Cookie-urile fără `Max-Age` sau `Expires` sunt cookie-uri de sesiune și dispar când browserul se închide. Setați unul pentru a face cookie-ul persistent.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Cookie de sesiune',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'Fără `Max-Age` sau `Expires` — browserul renunță la acest cookie când se închide.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Adăugați `Max-Age=<seconds>` sau `Expires=<date>` pentru a-l face persistent între sesiunile de browser.',
  'panel.inspector.headers.chipInfo.missingFlag.title': 'Lipsește {flag}',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Bună practică',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Fără `Secure`, acest cookie se poate scurge prin HTTP simplu. Setați-l întotdeauna pe cookie-urile HTTPS.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    'Fără `HttpOnly`, JavaScript poate citi acest cookie prin `document.cookie` — o eroare XSS îl exfiltrează.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Fără un `SameSite` explicit, browserele revin la `Lax`. Fiți explicit pentru ca politica să fie evidentă la revizuirea codului.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'Majoritatea cookie-urilor de producție ar trebui să poarte `Secure`, `HttpOnly` și un `SameSite` explicit.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Directivă de cache',
  'panel.inspector.headers.chipInfo.rawValue': 'Valoare brută: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Directive active',
  'panel.inspector.headers.chipInfo.maxAge': 'Proaspăt timp de {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Prospețime în cache-ul partajat: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'Permite reutilizarea învechită timp de {duration} cât timp rulează o revalidare în fundal.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Parametru Content-Type',
  'panel.inspector.headers.chipInfo.charset.summary': 'Codificarea de caractere folosită de corp.',
  'panel.inspector.headers.chipInfo.charset.description':
    'Pentru tipurile `text/*`, stivele moderne folosesc implicit `utf-8`. Valorile greșite produc caractere corupte (mojibake).',
  'panel.inspector.headers.chipInfo.boundary.title': 'Delimitator multipart',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'Token care separă părțile unui corp multipart (încărcări de fișiere, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description':
    'Generat de client; nu trebuie să apară în corpul niciunei părți.',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Politică de securitate',
  'panel.inspector.headers.chipInfo.hsts.summary': 'Browserul va folosi HTTPS pentru această gazdă timp de {duration}.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': 'Schemă de autorizare',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — un triplet `<header>.<payload>.<signature>` codificat base64.',
  'panel.inspector.headers.chipInfo.jwt.description':
    'Semnătura dovedește că tokenul a fost emis de cineva care deține cheia de semnare. Antetul (alg, typ) și conținutul util (revendicările) NU sunt criptate — sunt doar codificate base64 și pot fi citite de oricine.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'Antet JWT',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'Revendicare JWT',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'Algoritmul de semnare declarat în antetul JWT.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Valori frecvente: `HS256` (HMAC-SHA256, simetric), `RS256` (RSA, asimetric), `ES256` (ECDSA). `none` (fără semnătură) ar trebui respins întotdeauna de validatoare.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT expirat',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'Tokenul a expirat acum {duration}. Serverul ar trebui să îl respingă.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT expiră în {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'Tokenul este aproape de expirare — reîmprospătați-l sau așteptați-vă la un 401 în curând.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'Timpul până la atingerea revendicării `exp` din JWT.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    'Acreditare bearer opacă (OAuth 2.0 / token API). Tratați-o ca pe o parolă — oricine o are se poate autentifica drept utilizatorul.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic auth — `base64(username:password)`. Sigur doar prin HTTPS.',
  'panel.inspector.headers.chipInfo.scheme.other':
    'Numele schemei de autentificare. Formatul acreditării depinde de schemă.',

  // Header insights (t-fed `computeHeaderInsights`).
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS configurat greșit',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` nu poate fi combinat cu acreditări — browserul va respinge acest răspuns.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Suprascriere cu {origin}',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'Cerere CORS fără Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'Cererea a purtat `Origin: {origin}`, dar răspunsul nu are `Access-Control-Allow-Origin`. Browserul va bloca răspunsul.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Adăugare Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie-ul `{name}` nu are `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': 'Cookie-uri fără `Secure`: {count}',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Cookie-urile setate prin HTTPS ar trebui să poarte `Secure` pentru a nu putea fi trimise prin HTTP simplu.',
  'panel.inspector.headers.insights.missingCsp.title': 'Fără Content-Security-Policy pe răspunsul HTML',
  'panel.inspector.headers.insights.missingCsp.action': 'Adăugare CSP de bază',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS max-age este foarte scurt ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'Majoritatea politicilor recomandă cel puțin 6 luni; preload necesită 1 an.',
  'panel.inspector.headers.insights.jwtExpired.title': 'JWT din antetul Authorization a expirat',
  'panel.inspector.headers.insights.jwtExpired.detail': 'A expirat acum {duration}.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT expiră în {duration}',
  'panel.inspector.headers.insights.missingContentType.title': 'Răspunsul nu are Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': 'Adăugare Content-Type',
} as const satisfies Catalog;
