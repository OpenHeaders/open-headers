/**
 * Shared info-popover corpus — HTTP headers — Romanian. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: origine = origin (the
 * web-platform referent — cross-origin rides raw as the panel files
 * write it) vs serverul de origine = origin server (carried from
 * info-status); preflight raw (cererea preflight, carried from
 * panel-inspector); directivă carried; valori uzuale = common values;
 * revalidare carried from popup; sniffing raw (the MIME sniffing
 * loanword); hotlink raw (hotlink-uit never — resurse preluate direct
 * de alte site-uri); crawler raw (crawlere); nod de margine = edge (the
 * CDN tier, prose) with `Edge` standalone in en (Edge Side Includes,
 * Edge-to-origin, IE/Edge) riding raw and shield raw; urmărire
 * distribuită = distributed trace (urmărire stivă stays the console
 * compound); pseudo-antet = pseudo-header; salt cu salt = hop-by-hop
 * (the ro networking convention — decided over între noduri);
 * registru carried from info-status; depozitul de cookie-uri = cookie
 * jar carried from info-cookies; acreditări carried; negociere =
 * negotiation; indiciu de client = Client Hint; prospețime =
 * freshness; învechit = stale; în producție = in production;
 * dus-întors = round-trip carried; the CDN tiers read niveluri. Every
 * raw header name, value or protocol token takes a head noun (valoarea
 * ETag, antetul `Referer`, conexiune HTTPS, în HTTP/2 și versiunile
 * ulterioare, adresa IP, codul JavaScript).
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'Antet de cerere',
  'shared.info.header.direction.response': 'Antet de răspuns',
  'shared.info.header.direction.both': 'Antet de cerere / răspuns',
  'shared.info.header.section.directives': 'Directive',
  'shared.info.header.section.commonValues': 'Valori uzuale',
  'shared.info.header.fallback.customCategory': 'Personalizat sau nestandard',
  'shared.info.header.fallback.customSummary':
    'Acest antet este personalizat sau nestandard — nu există documentație în registrul nostru.',
  'shared.info.header.fallback.unknownSummary':
    'Antetul {name} nu este încă documentat în registrul nostru. Rândul îl clasifică drept {category}.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Acreditări care autentifică clientul față de server.',
  'shared.info.header.authorization.body1':
    'Format: `<scheme> <credentials>`. Scheme uzuale: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary':
    'Acreditări pentru un proxy intermediar (nu pentru serverul de origine).',
  'shared.info.header.proxyAuthorization.body1': 'Aceeași sintaxă ca `Authorization`, cu sferă distinctă.',
  'shared.info.header.wwwAuthenticate.summary':
    'Provocarea 401 a serverului — îi spune clientului ce schemă de autentificare să folosească.',
  'shared.info.header.wwwAuthenticate.body1':
    'Trimis cu `401 Unauthorized`. Declanșează dialogul de autentificare de bază al browserului când schema este `Basic`.',
  'shared.info.header.proxyAuthenticate.summary':
    'Echivalentul pentru proxy al lui `WWW-Authenticate`, trimis cu `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    'Încheie autentificarea reciprocă la succes — autentificarea Digest îl folosește pentru a confirma și serverul.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': 'Directive care guvernează cum este pus în cache și revalidat un răspuns.',
  'shared.info.header.cacheControl.body1':
    'Atât cererea, cât și răspunsul poartă directive. Mai multe tokenuri separate prin virgulă se combină prin ȘI. Comportamentul este per directivă — antetul nu este un singur mod.',
  'shared.info.header.cacheControl.directive.noStore': 'Nu se pune deloc în cache, nicăieri.',
  'shared.info.header.cacheControl.directive.noCache':
    'Se poate pune în cache, dar se revalidează de fiecare dată înainte de reutilizare.',
  'shared.info.header.cacheControl.directive.public': 'Orice cache poate stoca, inclusiv cele partajate / din CDN.',
  'shared.info.header.cacheControl.directive.private': 'Doar browserul utilizatorului poate stoca.',
  'shared.info.header.cacheControl.directive.maxAgeN':
    'Proaspăt timp de N secunde; se reutilizează fără a contacta originea.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'Ca max-age, dar doar pentru cache-urile partajate.',
  'shared.info.header.cacheControl.directive.mustRevalidate': 'Odată învechit, se revalidează înainte de a fi servit.',
  'shared.info.header.cacheControl.directive.immutable': 'Promite că un corp nu se va schimba pe durata max-age.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'Permite reutilizarea învechită cât timp rulează o revalidare în fundal.',
  'shared.info.header.pragma.summary': 'Control de cache moștenit din HTTP/1.0 — practic înlocuit de Cache-Control.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` este încă setat de unii clienți pentru compatibilitate. Serverele moderne ar trebui să respecte `Cache-Control` și să ignore `Pragma`.',
  'shared.info.header.expires.summary': 'Data / ora absolută după care răspunsul este considerat învechit.',
  'shared.info.header.expires.body1':
    'Înlocuit de `Cache-Control: max-age`. Dacă sunt setate ambele, `max-age` câștigă. Folosiți o dată din trecut (sau `0`) pentru a forța repreluarea.',
  'shared.info.header.etag.summary':
    'Identificator opac al corpului răspunsului — folosit pentru a revalida copiile din cache.',
  'shared.info.header.etag.body1':
    'Clienții îl returnează în `If-None-Match`. Dacă valoarea încă se potrivește, serverul răspunde `304 Not Modified` fără corp.',
  'shared.info.header.ifMatch.summary':
    'Cerere condiționată: se continuă doar dacă valoarea ETag curentă a resursei se potrivește.',
  'shared.info.header.ifMatch.body1':
    'Folosit la scrieri pentru a preveni suprascrierea modificărilor făcute de altcineva (concurență optimistă).',
  'shared.info.header.ifNoneMatch.summary':
    'Cerere condiționată: se continuă doar dacă valoarea ETag a resursei s-a schimbat.',
  'shared.info.header.ifNoneMatch.body1':
    'Folosit la citiri pentru a sări peste descărcarea unui răspuns neschimbat — serverul răspunde `304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Cerere condiționată: se continuă doar dacă resursa s-a schimbat după data dată.',
  'shared.info.header.ifModifiedSince.body1':
    'Mai puțin precis decât `If-None-Match` / ETag; preferați valorile ETag când sunt disponibile.',
  'shared.info.header.ifUnmodifiedSince.summary':
    'Cerere condiționată: se continuă doar dacă resursa nu a fost modificată de la data dată.',
  'shared.info.header.lastModified.summary': 'Data / ora la care resursa a fost modificată ultima dată.',
  'shared.info.header.lastModified.body1': 'Asociat cu `If-Modified-Since` pentru revalidare.',
  'shared.info.header.age.summary': 'Secundele de când răspunsul se află într-un cache partajat.',
  'shared.info.header.age.body1':
    'Returnat de rețelele CDN și de proxy-uri; îi ajută pe clienți să înțeleagă prospețimea răspunsului.',
  'shared.info.header.xCache.summary':
    'Rezultatul cache-ului CDN / proxy invers — format specific furnizorului (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Servit din cache.',
  'shared.info.header.xCache.value.miss': 'Nu era în cache; preluat de la origine.',
  'shared.info.header.xCache.value.hitHit':
    'Mai multe niveluri de cache au avut toate apariții (de ex. shield + edge).',
  'shared.info.header.xCacheHits.summary':
    'Contor de apariții în cache per nivel — specific furnizorului, frecvent la Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Separat prin virgulă când sunt implicate mai multe niveluri de cache. Valorile mari indică linii de cache foarte solicitate.',
  'shared.info.header.warning.summary':
    'Context suplimentar de cache (învechit, transformare aplicată etc.). Depreciat în HTTP/1.1 începând cu RFC 7234, dar încă emis.',
  'shared.info.header.surrogateControl.summary':
    'Control de cache Edge Side Includes — dirijează rețelele CDN, lăsând cache-ul browserului în seama lui `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Specific cache-urilor care cunosc ESI (Fastly, Akamai, Varnish în unele configurații).',
  'shared.info.header.surrogateCapability.summary': 'Indiciu Edge-to-origin: ce funcții ESI acceptă surogatul.',
  'shared.info.header.cfCacheStatus.summary': 'Rezultatul cache-ului Cloudflare pentru această cerere.',
  'shared.info.header.cfCacheStatus.value.hit': 'Servit din cache-ul Cloudflare.',
  'shared.info.header.cfCacheStatus.value.miss': 'Nu era în cache; preluat de la origine.',
  'shared.info.header.cfCacheStatus.value.expired': 'Era în cache, dar a expirat; reîmprospătat de la origine.',
  'shared.info.header.cfCacheStatus.value.bypass': 'Cache ocolit (reguli de pagină / antet no-cache).',
  'shared.info.header.cfCacheStatus.value.dynamic':
    'Nu poate fi pus în cache implicit (cookie-uri, șir de interogare etc.).',
  'shared.info.header.cfCacheStatus.value.revalidated': 'În cache și revalidat cu originea (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Indiciu de client: lista de mărci a browserului.',
  'shared.info.header.secChUa.body1':
    'Înlocuiește șirul liber `User-Agent` pentru părțile de care serverele chiar ar trebui să depindă.',
  'shared.info.header.secChUaMobile.summary': 'Indiciu de client: `?1` pe mobil, `?0` pe desktop.',
  'shared.info.header.secChUaPlatform.summary':
    'Indiciu de client: sistemul de operare al utilizatorului (`"Windows"`, `"macOS"`, `"Linux"` etc.).',
  'shared.info.header.userAgent.summary':
    'Șir liber moștenit care identifică browserul, sistemul de operare și motorul.',
  'shared.info.header.userAgent.body1':
    'Trimis în continuare de fiecare cerere. Înlocuitorul structurat este familia `Sec-CH-UA-*` — preferați-o când serverelor le pasă de identitatea browserului.',
  'shared.info.header.acceptCh.summary':
    'Enumeră antetele de indicii de client pe care serverul le dorește la cererile ulterioare.',
  'shared.info.header.acceptCh.body1':
    'Browserele trimit doar indiciile pentru care serverul a optat aici (cu excepția valorilor implicite cu entropie redusă).',
  'shared.info.header.criticalCh.summary':
    'Subsetul din `Accept-CH` pe care serverul îl consideră critic — browserele vor relua cererea pentru a le include.',
  'shared.info.header.criticalCh.body1': 'Folosiți cu măsură: fiecare ratare Critical-CH costă un dus-întors.',
  'shared.info.header.saveData.summary':
    '`on` când utilizatorul a activat un mod de economisire a datelor în browser / sistemul de operare.',
  'shared.info.header.saveData.body1':
    'Folosiți-l pentru a servi resurse cu lățime de bandă redusă (imagini de calitate mai mică, amânarea lucrului de sub linia de plutire etc.).',
  'shared.info.header.deviceMemory.summary':
    'Memoria RAM aproximativă a dispozitivului în GiB, rotunjită la un set mic de valori (`0.25`, `0.5`, `1`, `2`, `4`, `8`).',
  'shared.info.header.downlink.summary': 'Lățimea de bandă descendentă estimată în Mbps, rotunjită.',
  'shared.info.header.ect.summary': 'Effective Connection Type — `slow-2g`, `2g`, `3g` sau `4g`.',
  'shared.info.header.rtt.summary': 'Timpul dus-întors estimat în milisecunde, rotunjit.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Comenzi de conexiune salt cu salt (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Eliminat de proxy-uri între salturi. În HTTP/2 și versiunile ulterioare acest antet este interzis — gestionarea conexiunii este încorporată în protocol.',
  'shared.info.header.keepAlive.summary': 'Indicii pentru rezerva de conexiuni — de regulă `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1':
    'Are sens doar cu `Connection: keep-alive` în HTTP/1.1. Ignorat în HTTP/2 și versiunile ulterioare.',
  'shared.info.header.upgrade.summary':
    'Cere schimbarea protocolului pe aceeași conexiune (WebSocket, HTTP/2 în clar).',
  'shared.info.header.upgrade.body1': 'Folosit împreună cu `Connection: upgrade`. WebSocket: `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Codificările de transfer pe care clientul le acceptă (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1':
    'Majoritatea clienților moderni trimit doar `TE: trailers` pentru a opta pentru antetele finale.',
  'shared.info.header.expect.summary':
    'Precondiții de partea serverului pe care clientul se așteaptă să fie îndeplinite (`100-continue`).',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` îi permite clientului să trimită corpul doar după ce serverul semnalează `100 Continue`.',
  'shared.info.header.altSvc.summary':
    'Anunță căi alternative de a ajunge la aceeași origine (de ex. HTTP/3 peste QUIC).',
  'shared.info.header.altSvc.body1':
    'Browserele pun anunțul în cache și pot trece la alternativă pentru cererile ulterioare.',
  'shared.info.header.secWebsocketKey.summary': 'Nonce aleatoriu codificat base64, trimis la handshake-ul WebSocket.',
  'shared.info.header.secWebsocketKey.body1':
    'Serverul răspunde cu `Sec-WebSocket-Accept` derivat din această cheie + un GUID fix, dovedind că înțelege WebSocket.',
  'shared.info.header.secWebsocketAccept.summary':
    'Dovada serverului pentru handshake-ul WebSocket — `SHA-1(Sec-WebSocket-Key + GUID)` codificat base64.',
  'shared.info.header.secWebsocketVersion.summary':
    'Versiunea protocolului WebSocket cerută de client. Aproape întotdeauna `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Negocierea sub-protocolului pentru WebSocket — listă separată prin virgulă la cerere, o singură valoare aleasă la răspuns.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Extensiile WebSocket negociate (compresie etc.) — cel mai frecvent `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Tipul media al corpului cererii sau al răspunsului.',
  'shared.info.header.contentType.body1':
    'Determină cum parsează browserul corpul — valorile greșite produc eșecuri silențioase (JSON parsat ca HTML etc.).',
  'shared.info.header.contentType.body2':
    'Pentru tipurile `text/*`, includeți `charset=utf-8` dacă nu aveți un motiv să nu o faceți.',
  'shared.info.header.contentType.value.applicationJson': 'Corp JSON.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'Câmpuri de formular codificate URL.',
  'shared.info.header.contentType.value.multipartFormData': 'Formular multipart / încărcări de fișiere.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'Document HTML.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Binar opac.',
  'shared.info.header.contentLength.summary': 'Dimensiunea corpului în octeți (decodat).',
  'shared.info.header.contentLength.body1':
    'Se exclude reciproc cu `Transfer-Encoding: chunked`. Valorile greșite produc desincronizarea conexiunii.',
  'shared.info.header.contentEncoding.summary':
    'Compresia aplicată corpului — browserul decodează înainte de a-l expune codului JavaScript.',
  'shared.info.header.contentEncoding.body1':
    'Uzuale: `gzip`, `br` (Brotli), `zstd` (mai nou). Dimensiunea decodată este cea pe care o vede `response.body`.',
  'shared.info.header.contentDisposition.summary': 'Îi spune browserului dacă răspunsul este inline sau o descărcare.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (implicit) se afișează în browser. `attachment; filename="x"` declanșează o descărcare cu numele de fișier implicit dat.',
  'shared.info.header.accept.summary': 'Tipurile media pe care clientul este dispus să le primească.',
  'shared.info.header.accept.body1':
    'Valorile q exprimă preferința (`text/html;q=0.9`). Astăzi majoritatea serverelor ignoră tot în afară de primul tip.',
  'shared.info.header.acceptEncoding.summary': 'Compresiile pe care clientul le poate decoda.',
  'shared.info.header.acceptEncoding.body1':
    'Valoare tipică de browser: `gzip, deflate, br, zstd`. Serverele aleg una și răspund cu `Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Limbile umane pe care clientul le preferă.',
  'shared.info.header.acceptLanguage.body1':
    'Serverul alege un `Content-Language` din această listă, revenind adesea la o valoare implicită.',
  'shared.info.header.transferEncoding.summary':
    'Codificare aplicată doar pentru transport — eliminată înainte ca corpul să ajungă la aplicație.',
  'shared.info.header.transferEncoding.body1':
    'Aproape întotdeauna `chunked`. Se exclude reciproc cu `Content-Length`.',
  'shared.info.header.range.summary': 'Cere un interval de octeți din resursă în locul întregului corp.',
  'shared.info.header.range.body1':
    'Format: `bytes=<start>-<end>` (inclusiv). Serverul răspunde cu `206 Partial Content` și `Content-Range`.',
  'shared.info.header.contentRange.summary': 'Identifică ce interval de octeți din resursă se află în corp.',
  'shared.info.header.contentRange.body1': 'Format: `bytes <start>-<end>/<total>`. Returnat cu `206 Partial Content`.',
  'shared.info.header.acceptRanges.summary':
    'Îi spune clientului dacă cererile de interval sunt acceptate (`bytes`) sau nu (`none`).',
  'shared.info.header.contentMd5.summary':
    'Rezumat MD5 codificat Base64 al corpului, pentru verificarea integrității. Învechit în HTTP/1.1 RFC 7231, dar încă emis de unele servere.',
  'shared.info.header.contentMd5.body1':
    'Integritatea modernă se face prin `Digest` / `Want-Digest` sau prin TLS în sine.',
  'shared.info.header.contentLanguage.summary': 'Limba (limbile) naturală (naturale) a corpului răspunsului.',
  'shared.info.header.contentLanguage.body1':
    'Negociată față de `Accept-Language` din cerere. Valorile sunt etichete BCP-47 (`en-US`, `de-DE` etc.).',
  'shared.info.header.contentLocation.summary':
    'Adresa URL alternativă care identifică unic entitatea din acest răspuns.',
  'shared.info.header.contentLocation.body1':
    'Diferit de `Location`: `Content-Location` descrie resursa primită, nu unde să se redirecționeze.',
  'shared.info.header.acceptCharset.summary':
    'Codificările de caractere pe care clientul le acceptă. Depreciat — browserele moderne trimit întotdeauna UTF-8 și nu îl emit.',
  'shared.info.header.acceptCharset.body1': 'Majoritatea serverelor îl pot ignora fără probleme.',
  'shared.info.header.ifRange.summary':
    'Cerere de interval condiționată: se servește intervalul doar dacă resursa încă se potrivește cu valoarea ETag sau cu data dată.',
  'shared.info.header.ifRange.body1':
    'Dacă resursa s-a schimbat, serverul returnează corpul complet cu `200 OK` în loc de `206 Partial Content`.',
  'shared.info.header.trailer.summary':
    'Declară ce nume de câmpuri de antet vor apărea în antetele finale după un corp fragmentat.',
  'shared.info.header.trailer.body1':
    'Are sens doar cu `Transfer-Encoding: chunked`. Clientul trebuie să opteze prin `TE: trailers`.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary':
    'Cookie-urile pe care browserul le trimite cu această cerere, separate prin punct și virgulă.',
  'shared.info.header.cookie.body1':
    "Setat de browser din depozitul său de cookie-uri. Nu poate fi setat direct din JavaScript la `fetch` — folosiți `credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Definiție de cookie emisă de server.',
  'shared.info.header.setCookie.body1':
    'Un cookie per linie de antet `Set-Cookie`. Browserele stochează cea mai recentă valoare per tuplu (nume, domeniu, cale).',
  'shared.info.header.setCookie.body2':
    'Cookie-urile din producție ar trebui să poarte întotdeauna `Secure`, `HttpOnly` și un `SameSite` explicit (Lax sau Strict).',
  'shared.info.header.setCookie.directive.secure': 'Trimis doar prin HTTPS.',
  'shared.info.header.setCookie.directive.httpOnly': 'Ascuns față de JavaScript (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    'Politica de trimitere între site-uri. `None` necesită `Secure`.',
  'shared.info.header.setCookie.directive.domainHost': 'Se trimite acestei gazde și tuturor subdomeniilor ei.',
  'shared.info.header.setCookie.directive.pathPath': 'Se trimite doar adreselor URL care încep cu această cale.',
  'shared.info.header.setCookie.directive.maxAgeN': 'Durata de viață în secunde (are prioritate față de Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Expirare absolută; omisă = cookie de sesiune.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — partiționat per site de nivel superior.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary':
    'Îi spune browserului ce origini au voie să citească acest răspuns.',
  'shared.info.header.accessControlAllowOrigin.body1':
    'Setat pe răspuns de server. Browserul îl compară cu antetul `Origin` al cererii și blochează citirea corpului din JavaScript dacă nu se potrivesc.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` acceptă orice origine, dar este incompatibil cu acreditările — dacă cererea poartă cookie-uri sau autentificare, răspunsul trebuie să returneze în schimb exact originea solicitantă.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'Orice origine poate citi (fără acreditări).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': 'Doar originea numită poate citi.',
  'shared.info.header.accessControlAllowCredentials.summary':
    'Permite browserului să expună răspunsul când cererea a purtat acreditări.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Trebuie să fie `true` (litere mici). Când este setat, `Access-Control-Allow-Origin` NU trebuie să fie `*` — trebuie să returneze exact originea.',
  'shared.info.header.accessControlAllowMethods.summary':
    'Enumeră metodele HTTP pe care serverul le acceptă pentru cererile cross-origin.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Returnat la răspunsurile preflight (`OPTIONS`). Browserul pune răspunsul în cache timp de `Access-Control-Max-Age` secunde.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Enumeră antetele de cerere pe care serverul le acceptă la cererile cross-origin.',
  'shared.info.header.accessControlAllowHeaders.body1':
    'Necesar când browserul face preflight pentru antete non-simple (orice dincolo de `Accept`, `Accept-Language`, `Content-Language` și valorile simple de `Content-Type`).',
  'shared.info.header.accessControlExposeHeaders.summary':
    'Enumeră antetele de răspuns pe care JavaScript are voie să le citească.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'Implicit, codul JavaScript vede doar antetele de răspuns din lista sigură CORS (`Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Orice alt antet trebuie numit aici pentru ca `response.headers.get(...)` să îl returneze.',
  'shared.info.header.accessControlMaxAge.summary':
    'Cât timp poate browserul să păstreze în cache răspunsul preflight, în secunde.',
  'shared.info.header.accessControlMaxAge.body1':
    'Valorile mari reduc traficul preflight — o valoare de 86400 (1 zi) este uzuală. Chrome plafonează la 7200 de secunde; Firefox la 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Trimis la preflight pentru a declara metoda pe care o va folosi cererea propriu-zisă.',
  'shared.info.header.accessControlRequestMethod.body1':
    'Serverul răspunde cu `Access-Control-Allow-Methods` pentru a confirma.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Trimis la preflight pentru a declara antetele pe care le va purta cererea propriu-zisă.',
  'shared.info.header.accessControlRequestHeaders.body1':
    'Reflectat înapoi prin `Access-Control-Allow-Headers` dacă este acceptat.',
  'shared.info.header.origin.summary': 'Identifică originea care a inițiat o cerere cross-origin sau POST.',
  'shared.info.header.origin.body1':
    'Trimis automat de browser. Nu poate fi setat din JavaScript. Folosit de servere pentru a decide răspunsurile CORS și de apărările CSRF.',
  'shared.info.header.vary.summary':
    'Le spune cache-urilor ce antete de cerere influențează răspunsul, ca să varieze cheia de cache.',
  'shared.info.header.vary.body1':
    'Critic pentru CORS: includeți `Vary: Origin` ori de câte ori `Access-Control-Allow-Origin` este calculat din originea cererii, altfel un cache va servi răspunsul unei origini alteia.',
  'shared.info.header.timingAllowOrigin.summary':
    'Permite originilor străine să citească metrici de timp detaliate (`PerformanceResourceTiming`) pentru această resursă.',
  'shared.info.header.timingAllowOrigin.body1':
    'Fără acest antet, resursele cross-origin expun doar timpi cu granularitate grosieră.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': 'Setat de browser: relația dintre inițiatorul cererii și țintă.',
  'shared.info.header.secFetchSite.body1':
    'Valori: `same-origin`, `same-site`, `cross-site`, `none` (navigare directă).',
  'shared.info.header.secFetchMode.summary': 'Setat de browser: modul fetch al cererii.',
  'shared.info.header.secFetchMode.body1': 'Valori: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Setat de browser: unde va fi folosit răspunsul (document, script, imagine etc.).',
  'shared.info.header.secFetchDest.body1':
    'Îi permite serverului să detecteze preluări surprinzătoare — de ex. un răspuns HTML cerut ca `Sec-Fetch-Dest: script`.',
  'shared.info.header.secFetchUser.summary':
    'Setat de browser: `?1` când navigarea a fost o activare directă a utilizatorului.',
  'shared.info.header.secFetchUser.body1':
    'Absent altfel. Util pentru a deosebi clicurile utilizatorului de navigarea programatică.',
  'shared.info.header.secPurpose.summary':
    'Setat de browser când cererea este speculativă — de ex. `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    'Îi permite serverului să sară peste efectele secundare (analitice, jurnale de scriere) pentru preluări pe care utilizatorul nu le-a cerut încă.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'Îi spune serverului (sau clientului) cât de urgent și cât de incremental este acest transfer.',
  'shared.info.header.priority.body1':
    'Format: `u=<0-7>` (urgență, mai mic = prioritate mai mare) și opțional `, i` (incremental — poate fi procesat pe măsură ce sosește).',
  'shared.info.header.upgradeInsecureRequests.summary':
    '`1` setat de browser — îi spune serverului că clientul preferă HTTPS pentru orice resursă încorporată.',
  'shared.info.header.upgradeInsecureRequests.body1':
    'Asociat cu directiva CSP `upgrade-insecure-requests` de pe răspunsuri.',
  'shared.info.header.earlyData.summary': '`1` — setat de clienții care trimit date în modul 0-RTT din TLS 1.3.',
  'shared.info.header.earlyData.body1':
    'Serverele ar trebui să respingă datele timpurii la metodele neidempotente (POST etc.) pentru a evita atacurile prin reluare.',
  'shared.info.header.link.summary': 'Indicii de resurse — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Aceeași semantică precum `<link rel="...">` din HTML; util din răspunsurile non-HTML (interfețe API, redirecționări).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Preîncarcă o foaie de stil.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': 'Deschide o conexiune în avans.',
  'shared.info.header.xDnsPrefetchControl.summary':
    'Comută preluarea anticipată DNS a browserului pentru linkurile din pagină (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary':
    'Do Not Track — `1` dacă utilizatorul a refuzat urmărirea. În mare parte depreciat.',
  'shared.info.header.dnt.body1':
    'Majoritatea site-urilor mari îl ignoră; W3C a abandonat specificația în 2019. Respectarea este voluntară.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control — `1` semnalează că utilizatorul nu dorește ca datele sale să fie vândute sau partajate.',
  'shared.info.header.secGpc.body1':
    'Obligatoriu legal sub CCPA în California; respectat de unele browsere axate pe confidențialitate (Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Enumeră proxy-urile / gateway-urile prin care a trecut mesajul.',
  'shared.info.header.via.body1':
    'Fiecare proxy își adaugă identificatorul, astfel încât lanțul să poată fi reconstituit la depanare.',
  'shared.info.header.xForwardedFor.summary':
    'Nestandard, dar omniprezent: lanț separat prin virgulă de adrese IP de client prin proxy-uri.',
  'shared.info.header.xForwardedFor.body1':
    'Intrarea din stânga este clientul original. Antetul `Forwarded` din RFC 7239 este alternativa standardizată.',
  'shared.info.header.xForwardedProto.summary':
    'Schema originală (`http` sau `https`) pe care clientul a folosit-o pentru a ajunge la primul proxy.',
  'shared.info.header.xForwardedHost.summary':
    'Antetul `Host` original trimis de client înainte ca proxy-ul să îl rescrie.',
  'shared.info.header.xRealIp.summary':
    'Adresa IP originală a clientului, așa cum a văzut-o primul proxy. Valoare unică, nu un lanț.',
  'shared.info.header.forwarded.summary':
    'Lanțul de proxy-uri standardizat prin RFC 7239 — înlocuiește familia `X-Forwarded-*`.',
  'shared.info.header.forwarded.body1':
    'Format: `for=client; proto=https; by=proxy; host=original-host`. Mai multe proxy-uri se separă prin virgulă.',
  'shared.info.header.trueClientIp.summary':
    'Adresa IP originală a clientului, redirecționată de Akamai / Cloudflare Enterprise — valoare unică, nu un lanț.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'Pseudo-antet HTTP/2 și versiunile ulterioare — echivalentul lui `Host` din HTTP/1.1. Identifică serverul țintă.',
  'shared.info.header.authority.body1':
    'Pseudo-antetele încep cu `:` și trebuie să apară înaintea antetelor obișnuite. Browserul le setează; JavaScript nu poate.',
  'shared.info.header.method.summary':
    'Pseudo-antet HTTP/2 și versiunile ulterioare — metoda cererii (`GET`, `POST`, …).',
  'shared.info.header.path.summary':
    'Pseudo-antet HTTP/2 și versiunile ulterioare — calea cererii + șirul de interogare.',
  'shared.info.header.scheme.summary': 'Pseudo-antet HTTP/2 și versiunile ulterioare — `https` sau `http`.',
  'shared.info.header.status.summary':
    'Pseudo-antet HTTP/2 și versiunile ulterioare — starea numerică a răspunsului (de ex. `200`).',
  'shared.info.header.status.body1': 'Pseudo-antetele înlocuiesc linia de stare din HTTP/1.1 în HTTP/2 și HTTP/3.',
  'shared.info.header.host.summary':
    'Gazda țintă din HTTP/1.1 (și portul opțional). Înlocuit de `:authority` în HTTP/2 și versiunile ulterioare.',
  'shared.info.header.host.body1':
    'Obligatoriu la fiecare cerere HTTP/1.1. Serverele îl folosesc pentru a direcționa între gazdele virtuale de pe aceeași adresă IP.',
  'shared.info.header.location.summary':
    'Ținta redirecționării — trimis cu răspunsurile `3xx` sau ca rezultat al unei resurse create.',
  'shared.info.header.location.body1':
    'Adresele URL absolute sunt respectate universal; adresele URL relative se rezolvă față de adresa URL a cererii.',
  'shared.info.header.allow.summary': 'Enumeră metodele HTTP pe care resursa le acceptă.',
  'shared.info.header.allow.body1':
    'Obligatoriu într-un răspuns `405 Method Not Allowed`. Valori uzuale: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': 'Adresa URL a paginii care a inițiat această cerere.',
  'shared.info.header.referer.body1':
    'Observați greșeala de ortografie istorică — specificația o păstrează. Unele destinații elimină sau retrogradează `Referer` în funcție de `Referrer-Policy` al paginii.',
  'shared.info.header.retryAfter.summary':
    'Îi spune clientului când să reîncerce — secunde (delta) sau o dată HTTP absolută.',
  'shared.info.header.retryAfter.body1':
    'Frecvent la `503 Service Unavailable` și `429 Too Many Requests`. Crawlerele îl respectă.',
  'shared.info.header.maxForwards.summary':
    'Limitează numărul de proxy-uri care pot redirecționa o cerere `TRACE` sau `OPTIONS`.',
  'shared.info.header.maxForwards.body1':
    'Decrementat de fiecare proxy care redirecționează. Ajunge la 0 → proxy-ul răspunde el însuși.',
  'shared.info.header.serviceWorker.summary':
    '`script` setat de browser când cererea preia un fișier de script de service worker.',
  'shared.info.header.serviceWorker.body1':
    'Le permite serverelor să detecteze preluările de înregistrare SW și să răspundă cu antetul `Service-Worker-Allowed` potrivit.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Suprascrie restricția implicită de cale pentru sfera service worker-ului.',
  'shared.info.header.serviceWorkerAllowed.body1':
    'Implicit, un worker poate controla doar directorul său și subdirectoarele. Acest antet vă permite să lărgiți sfera — de ex. să controlați `/` dintr-un worker de la `/sw.js`.',
  'shared.info.header.protocol.summary':
    'Pseudo-antet pentru mecanismul Extended CONNECT (RFC 8441) — folosit de WebSocket peste HTTP/2 / 3.',
  'shared.info.header.protocol.body1':
    'Setat la `websocket` când clientul tunelează o conexiune WebSocket prin HTTP/2 sau HTTP/3.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Lista de surse permise din care pagina poate încărca resurse sau executa cod.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Directivele se separă prin spațiu, cu punct și virgulă între directive. Majoritatea aplicațiilor au nevoie cel puțin de `default-src`, `script-src`, `style-src` și `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Folosiți `Content-Security-Policy-Report-Only` pentru a observa încălcările înainte de a le impune.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc':
    'Rezervă pentru orice -src care nu este setat explicit.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc':
    'Surse permise pentru `<script>` și codul JavaScript inline.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc':
    'Surse permise pentru foile de stil și stilurile CSS inline.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': 'Surse de imagini permise.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Ținte fetch/XHR/WebSocket permise.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Cine poate încorpora această pagină într-un iframe (înlocuiește X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo':
    'Unde se trimit prin POST rapoartele de încălcare.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Aceeași sintaxă ca CSP, dar încălcările sunt raportate fără a fi blocate.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Folosiți-l pentru a testa o politică în producție înainte de a o impune.',
  'shared.info.header.strictTransportSecurity.summary':
    'Forțează browserul să folosească HTTPS pentru această gazdă pe o durată dată.',
  'shared.info.header.strictTransportSecurity.body1':
    'Setați `max-age` la cel puțin 6 luni în producție. Adăugați `includeSubDomains` pentru a acoperi fiecare gazdă de sub domeniu.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` vă permite să trimiteți domeniul în lista de preîncărcare HSTS încorporată în browsere (decizie fără cale de întoarcere — greu de anulat).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'Cât timp reține browserul regula HTTPS-only.',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Se aplică fiecărui subdomeniu.',
  'shared.info.header.strictTransportSecurity.directive.preload':
    'Eligibilitate pentru lista de preîncărcare a browserelor.',
  'shared.info.header.xContentTypeOptions.summary': 'Dezactivează sniffing-ul MIME.',
  'shared.info.header.xContentTypeOptions.body1':
    'O singură valoare validă: `nosniff`. Recomandat pe fiecare răspuns — împiedică executarea codului JavaScript servit ca `text/plain`.',
  'shared.info.header.xFrameOptions.summary': 'Controlează dacă pagina poate fi încorporată într-un iframe.',
  'shared.info.header.xFrameOptions.body1':
    'În mare parte înlocuit de `Content-Security-Policy: frame-ancestors`. Păstrați-le pe ambele în perioada de tranziție pentru acoperirea browserelor mai vechi.',
  'shared.info.header.xFrameOptions.value.deny': 'Niciodată încorporabil.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Încorporabil doar de paginile din aceeași origine.',
  'shared.info.header.xXssProtection.summary': 'Comutator moștenit al filtrului XSS — învechit în browserele moderne.',
  'shared.info.header.xXssProtection.body1':
    'Valoarea recomandată este `0`, pentru a dezactiva filtrul (a făcut mai mult rău decât a prevenit). Folosiți CSP în schimb.',
  'shared.info.header.referrerPolicy.summary':
    'Controlează cât din adresa URL se trimite în `Referer` la navigările și cererile de ieșire.',
  'shared.info.header.referrerPolicy.body1':
    'Trimis ca antet de răspuns de destinație sau setat per pagină prin `<meta>` / per cerere prin atributul `referrerpolicy`.',
  'shared.info.header.referrerPolicy.value.noReferrer': 'Nu se trimite niciodată un referer.',
  'shared.info.header.referrerPolicy.value.origin': 'Se trimit doar schema + gazda.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'Implicit — adresa URL completă în aceeași origine, doar originea cross-origin, nimic la retrogradarea HTTPS→HTTP.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': 'Se trimite întotdeauna adresa URL completă. De evitat.',
  'shared.info.header.permissionsPolicy.summary':
    'Listă de permisiuni pentru funcțiile browserului (geolocalizare, cameră, USB, plăți etc.).',
  'shared.info.header.permissionsPolicy.body1':
    'Fiecare funcție este restricționată la `self`, la o listă de origini sau la `*`. Înlocuiește antetul mai vechi `Feature-Policy`.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'Izolează pagina de relațiile de deschidere cross-origin (window.opener).',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` activează modul crossOriginIsolated — necesar pentru SharedArrayBuffer și temporizatoarele de înaltă rezoluție.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Cere ca fiecare subresursă încărcată să acorde permisiune cross-origin.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Setați `require-corp` pentru crossOriginIsolated. Se asociază cu `Cross-Origin-Opener-Policy: same-origin`.',
  'shared.info.header.crossOriginResourcePolicy.summary': 'Împiedică încărcarea resursei de către origini străine.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Valori: `same-site`, `same-origin`, `cross-origin`. Critic pentru resursele pe care nu vreți să fie preluate direct de alte site-uri (hotlink).',
  'shared.info.header.clearSiteData.summary':
    'Îi cere browserului să șteargă cookie-urile / cache-ul / stocarea pentru această origine.',
  'shared.info.header.clearSiteData.body1': 'Util pentru fluxurile de deconectare.',
  'shared.info.header.clearSiteData.value.cookies': 'Șterge cookie-urile originii.',
  'shared.info.header.clearSiteData.value.cache': 'Șterge cache-urile HTTP și de imagini.',
  'shared.info.header.clearSiteData.value.storage':
    'Șterge localStorage / IndexedDB / înregistrările de Service Worker.',
  'shared.info.header.clearSiteData.value.wildcard': 'Șterge totul.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` îi cere browserului să dea acestei origini propriul cluster de agenți (proces).',
  'shared.info.header.originAgentCluster.body1':
    'Oferă o izolare mai bună pentru `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory etc.',
  'shared.info.header.xRobotsTag.summary': 'Directive de indexare pentru crawlere (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    'Aceeași semantică precum eticheta `<meta name="robots">`, dar se aplică răspunsurilor non-HTML (fișiere PDF, JSON, imagini).',
  'shared.info.header.xUaCompatible.summary':
    'Directivă moștenită IE/Edge (`IE=edge`) — alege motorul de randare. Învechită în browserele moderne.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary':
    'Identificarea software-ului serverului de origine (de ex. `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1':
    'Adesea eliminat sau setat la o valoare fixă în producție, din motive de securitate operațională.',
  'shared.info.header.xPoweredBy.summary':
    'Antet nestandard care identifică framework-ul / runtime-ul din spatele răspunsului.',
  'shared.info.header.xPoweredBy.body1': 'Emis frecvent de Express, PHP, ASP.NET etc. Adesea suprimat în producție.',
  'shared.info.header.date.summary': 'Marcajul de timp al serverului de origine la generarea mesajului.',
  'shared.info.header.date.body1':
    'Folosit de cache-uri pentru a calcula vârsta răspunsului. Format: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Identifică ce nod de margine / nod de cache CDN a servit răspunsul.',
  'shared.info.header.xServedBy.body1':
    'Separat prin virgulă când mai multe niveluri au tratat cererea (shield → edge). Formatul variază în funcție de furnizor (punctele de prezență Fastly, nodurile de margine AWS CloudFront etc.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Metrici de performanță pe care serverul le atașează răspunsului.',
  'shared.info.header.serverTiming.body1':
    'Apare în DevTools și în interfața API JavaScript `PerformanceServerTiming`. Format: `<name>;dur=<ms>[;desc="..."]`, separat prin virgulă.',
  'shared.info.header.traceparent.summary':
    'Contextul de urmărire W3C: identifică un interval (span) într-o urmărire distribuită.',
  'shared.info.header.traceparent.body1':
    'Format: `<version>-<trace-id>-<parent-id>-<flags>`. Purtat între servicii, astfel încât urmăririle să poată fi reasamblate.',
  'shared.info.header.tracestate.summary':
    'Însoțitorul specific furnizorului al contextului de urmărire `traceparent`.',
  'shared.info.header.tracestate.body1':
    'Perechi `vendor=value` separate prin virgulă. Fiecare furnizor de urmărire își stochează aici propria stare.',
  'shared.info.header.xRequestId.summary':
    'Identificator atribuit de server acestei cereri — reflectat în jurnale și între servicii.',
  'shared.info.header.xRequestId.body1':
    'Nestandard, dar omniprezent. Util pentru a corela comportamentul clientului cu jurnalele serverului în timpul depanării.',
  'shared.info.header.xFastlyRequestId.summary':
    'Identificatorul de cerere Fastly — de corelat cu jurnalele / depanarea Fastly.',
  'shared.info.header.reportingEndpoints.summary':
    'Numește destinațiile pentru rapoartele generate de browser (încălcări CSP, deprecieri, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Format: `name="https://reports.example.com", name2="https://..."`. Înlocuiește antetul mai vechi `Report-To`.',
  'shared.info.header.reportTo.summary':
    'Declarația mai veche, bazată pe JSON, a punctelor finale de raportare — înlocuită de `Reporting-Endpoints`.',
  'shared.info.header.nel.summary':
    'Politica Network Error Logging — configurație JSON care numește un punct final pentru primirea eșecurilor de conexiune și a erorilor de protocol.',
  'shared.info.header.nel.body1':
    'Punctul final trebuie să fie deja înregistrat prin `Reporting-Endpoints` (sau prin mai vechiul `Report-To`).',
  'shared.info.header.cfRay.summary':
    'Identificatorul de cerere Cloudflare — folosit pentru a corela cererea în jurnalele Cloudflare.',
  'shared.info.header.cfRay.body1':
    'Format: `<request-id>-<colo-id>`, unde colo-id identifică centrul de date Cloudflare care a servit cererea.',
} as const satisfies Catalog;
