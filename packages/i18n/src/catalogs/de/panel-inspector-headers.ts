/**
 * DevTools panel — inspector Headers tab — German. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, and wire values stay raw. Where en capitalizes `Cookie`
 * the de noun capital coincides naturally (das Cookie). Expiry rides
 * the Ablauf / abgelaufen family (shared-info-cookies mint). Mints:
 * provisional headers = vorläufige Header; noise headers =
 * Rausch-Header; insight = Hinweis; footprint CTA vocabulary reuses
 * the Überschreiben op mint.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail). Raw by design: header names and
  // values, filter grammar tokens inside the placeholder (name: /
  // value: / is: must survive translation verbatim), header category
  // labels (shared registry lock — category names never localize),
  // Set-Cookie / SameSite / JWT / alg / scheme / cache-directive chip
  // vocabulary, the `exp {duration}` and `boundary` chips, the ALPN
  // hover title, General row wire values, and the ▾ / → / ⚠ / · / +
  // glyphs beside keyed values. General row labels are keyed —
  // info-table labels (section-tab shading), not the network-table
  // parity lock, whose scope is hot-path column headers. ─────────────
  'panel.inspector.headers.filterPlaceholder':
    'Filtern — Text, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Header filtern',
  'panel.inspector.headers.footprintTitle': '{rules} — klicke, um „Getroffene Regeln“ zu öffnen',

  // General section + the rule-creation CTAs on its summary. The
  // query-params CTA label reuses `panel.inspector.overrideCta.
  // overrideQueryParams` (same control, same popover); its hover title
  // is this surface's own sentence.
  'panel.inspector.headers.generalSection': 'General',
  'panel.inspector.headers.createApiRequest': 'API-Anfrage erstellen',
  'panel.inspector.headers.createApiRequestTitle':
    'Diese Anfrage im API-Client des Arbeitsbereichs als vorausgefüllten Entwurf öffnen — gespeichert wird ' +
    'erst, wenn du speicherst',
  'panel.inspector.headers.redirect.label': 'Umleiten',
  'panel.inspector.headers.redirect.title':
    'Passende Anfragen woandershin schicken — wähle, wie das Ziel vorausgefüllt wird',
  'panel.inspector.headers.redirect.url': 'Umleitungs-URL…',
  'panel.inspector.headers.redirect.urlTitle':
    'Passende Anfragen an eine andere URL schicken — das Ziel wird als Pro-Domain-Variable angelegt',
  'panel.inspector.headers.redirect.replaceHost': 'Host ersetzen…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'Pfad und Query behalten, den Host tauschen — legt eine Pro-Domain-Host-Variable an',
  'panel.inspector.headers.redirect.localhost': 'Auf localhost zeigen…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Pfad und Query behalten, an deinen lokalen Dev-Server über http schicken — legt eine ' +
    'Pro-Domain-Port-Variable an',
  'panel.inspector.headers.overrideQueryParamsTitle':
    'Query-Parameter dieser Anfrage hinzufügen, ersetzen oder entfernen',
  'panel.inspector.headers.more.label': 'Mehr',
  'panel.inspector.headers.more.title': 'Weitere Anfrage-Aktionen',
  'panel.inspector.headers.more.delay': 'Anfrage verzögern',
  'panel.inspector.headers.more.delayTitle': 'Diese Anfrage verzögern',
  'panel.inspector.headers.more.block': 'Anfrage blockieren',
  'panel.inspector.headers.more.blockTitle': 'Diese Anfrage blockieren / abbrechen',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': 'Anfrage-URL',
  'panel.inspector.headers.general.requestMethod': 'Anfragemethode',
  'panel.inspector.headers.general.statusCode': 'Statuscode',
  'panel.inspector.headers.general.remoteAddress': 'Remote-Adresse',
  'panel.inspector.headers.general.httpVersion': 'HTTP-Version',
  'panel.inspector.headers.general.compression': 'Kompression',
  'panel.inspector.headers.general.transferred': 'Übertragen',
  'panel.inspector.headers.general.referrerPolicy': 'Referrer-Policy',
  'panel.inspector.headers.general.decodedSuffix': '(decodiert {size})',

  // General (i) corpus. Range/protocol/encoding item LABELS (1xx…,
  // HTTP/2, gzip…) are wire vocabulary and stay raw in the builder;
  // the Common values heading reuses the shared header-corpus key.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'Die vollständige URL, gegen die der Browser die Anfrage gestellt hat — Schema, Host, Pfad und Query-String.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'Die verwendete HTTP-Methode (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'Der numerische Antwortcode, den der Server zurückgab.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Bereiche',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Informativ (selten — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Erfolg.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'Umleitung (sieh dir den `Location`-Header an).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    'Client-Fehler — die Anfrage war fehlerhaft oder nicht autorisiert.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx':
    'Server-Fehler — der Server konnte eine gültige Anfrage nicht erfüllen.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary':
    'IP-Adresse und Port, an die die Anfrage tatsächlich gesendet wurde.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'Weicht vom URL-Host ab, wenn DNS zu mehreren IPs auflöst, ein CDN per Anycast routet oder ein lokaler ' +
    'Proxy die Verbindung abfängt.',
  'panel.inspector.headers.generalInfo.httpVersion.summary':
    'Die HTTP-Protokollversion, die die Verbindung ausgehandelt hat.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'Beim TLS-Handshake per ALPN gewählt. Der tatsächliche Wire-Wert (z. B. `h2`, `h3`) steht im Tooltip, ' +
    'wenn er vom freundlichen Label abweicht.',
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'Textbasiert, standardmäßig eine Anfrage pro Verbindung.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Binär, gemultiplext über eine einzige TCP-Verbindung.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'Baut auf QUIC über UDP — schnellere Handshakes, bessere Verlustkompensation.',
  'panel.inspector.headers.generalInfo.compression.summary':
    'Die Codierung, die der Server auf den Antwort-Body angewendet hat — der Browser decodiert, bevor ' +
    'JavaScript ihn sieht.',
  'panel.inspector.headers.generalInfo.compression.gzip': 'Universell unterstützt, moderates Kompressionsverhältnis.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — besseres Verhältnis als gzip, von allen modernen Browsern unterstützt.',
  'panel.inspector.headers.generalInfo.compression.zstd':
    'Neuere Kompression mit hohem Verhältnis; wachsende Browser-Unterstützung.',
  'panel.inspector.headers.generalInfo.compression.deflate': 'Veraltet, heute selten genutzt.',
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Bytes, die tatsächlich über die Leitung gingen, einschließlich Kompressions-Overhead.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'Die decodierte Größe in Klammern ist das, was JavaScript nach dem Entpacken sieht. Eine große Differenz ' +
    'zwischen beiden ist der Kompressionsgewinn.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'Wie viel der URL der Browser bei ausgehenden Navigationen und Anfragen dieser Seite im `Referer` sendet.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Gesetzt über den `Referrer-Policy`-Antwort-Header, das `<meta name="referrer">`-Tag oder pro Anfrage via ' +
    '`referrerpolicy`-Attribut.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'Vorläufige Header werden angezeigt — aus dem Cache bedient, daher wurden die ursprünglich gesendeten ' +
    'Header nicht gespeichert.',
  'panel.inspector.headers.provisional.bannerPending':
    'Vorläufige Header werden angezeigt — der Wire-Satz ist noch nicht bestätigt.',
  'panel.inspector.headers.provisional.title': 'Vorläufige Header',
  'panel.inspector.headers.provisional.kicker': 'Anfrage',
  'panel.inspector.headers.provisional.summary':
    'Das sind die Header, die der Browser zusammengestellt hat und senden wollte — keine bestätigte Erfassung ' +
    'dessen, was über die Leitung ging. Der Wire-Satz kann abweichen (der Netzwerk-Stack ergänzt Cookies, ' +
    'Anmeldedaten und Verbindungs-Header später).',
  'panel.inspector.headers.provisional.whyHeading': 'Warum eine Anfrage nur vorläufige Header zeigt',
  'panel.inspector.headers.provisional.cacheLabel': 'Aus dem Cache bedient',
  'panel.inspector.headers.provisional.cacheDesc':
    'Lokal beantwortet (Memory-/Disk-Cache oder ein Service Worker) — diesmal ging nichts über die Leitung, ' +
    'die ursprünglich gesendeten Header wurden also nie gespeichert.',
  'panel.inspector.headers.provisional.blockedLabel': 'Hat das Netzwerk nie erreicht',
  'panel.inspector.headers.provisional.blockedDesc':
    'Blockiert oder fehlgeschlagen, bevor ein Header-Austausch zustande kam (ungültige URL, CORS-/CSP-Block, ' +
    'Verbindungsfehler).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Noch unterwegs',
  'panel.inspector.headers.provisional.inFlightDesc':
    'Der Wire-Satz wurde noch nicht gemeldet; er steht fest, sobald die Anfrage abgeschlossen ist.',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': 'Antwort-Header',
  'panel.inspector.headers.section.requestHeaders': 'Anfrage-Header',
  'panel.inspector.headers.section.countAria': 'Anzahl sichtbarer Header',
  'panel.inspector.headers.section.addHeader': 'Header hinzufügen',
  'panel.inspector.headers.section.raw': 'Roh',
  'panel.inspector.headers.section.rawTitle': 'Als reinen Text anzeigen (Name: Wert)',
  'panel.inspector.headers.section.copy': 'Kopieren',
  'panel.inspector.headers.section.copyAll': 'Alle kopieren',
  'panel.inspector.headers.section.copyFiltered': 'Gefilterte kopieren',
  'panel.inspector.headers.section.copyCurl': 'Als cURL kopieren',
  'panel.inspector.headers.section.copyFetch': 'Als fetch kopieren',
  'panel.inspector.headers.section.noneCaptured': 'Keine erfasst.',
  'panel.inspector.headers.section.noFilterMatch': 'Kein Header passt zum Filter.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Rausch-Header ausgeblendet — Namen beim Überfahren',
      other: '{count} Rausch-Header ausgeblendet — Namen beim Überfahren',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's (`panel.moreFilters.*` /
  // `panel.network.view.*`). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.headers.moreFilters.label': 'Weitere Filter',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Nur regelveränderte',
  'panel.inspector.headers.moreFilters.securityOnly': 'Nur Sicherheits-Header',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Nur überschreibbare',
  'panel.inspector.headers.moreFilters.hideNoise': 'Rauschen ausblenden (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'Ansicht',
  'panel.inspector.headers.view.layout': 'Layout',
  'panel.inspector.headers.view.layoutGrouped': 'Gruppiert',
  'panel.inspector.headers.view.layoutFlat': 'Flach',
  'panel.inspector.headers.view.sort': 'Sortieren',
  'panel.inspector.headers.view.sortOriginal': 'Original',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Regelveränderte zuerst',
  'panel.inspector.headers.view.nameCase': 'Namensschreibweise',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Original (roh)',
  'panel.inspector.headers.view.showTags': 'Tags anzeigen',
  'panel.inspector.headers.view.showSuggestions': 'Vorschläge anzeigen',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': 'Wert aufklappen',
  'panel.inspector.headers.row.collapseValue': 'Wert zuklappen',
  'panel.inspector.headers.row.copyValue': 'Wert kopieren',
  'panel.inspector.headers.row.copied': 'Kopiert',
  'panel.inspector.headers.row.edit': 'Bearbeiten',
  'panel.inspector.headers.row.editTitle': 'Die Regel bearbeiten, die diesen Header gesetzt hat',
  'panel.inspector.headers.row.override': 'Überschreiben',
  'panel.inspector.headers.row.overrideTitle': 'Eine Regel anlegen, die diesen Header überschreibt',
  'panel.inspector.headers.row.overrideProtectedTitle':
    '{name} ist ein geschützter Header — die Declarative-Net-Request-Engine des Browsers lässt Erweiterungen ' +
    'ihn nicht überschreiben. Häufige geschützte Namen: host, content-length, connection, sec-fetch-*, ' +
    'sec-ch-ua-*.',
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} wird von {feature} injiziert, einer Systemfunktion von Open Headers — nicht per Regel ' + 'überschreibbar.',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} wird bereits von einer deiner Regeln verwaltet — bearbeite die Regel über ihr Popover, statt zu ' +
    'überschreiben.',
  'panel.inspector.headers.row.systemTitle': 'Injiziert von {feature} (Systemfunktion von Open Headers)',
  'panel.inspector.headers.row.sinceFire.deleted': 'Regel seither gelöscht',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'Die Regel wurde seit dieser Anfrage gelöscht — auf künftige Anfragen wird sie nicht angewendet',
  'panel.inspector.headers.row.sinceFire.disabled': 'Regel seither deaktiviert',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'Die Regel wurde seit dieser Anfrage deaktiviert — auf künftige Anfragen wird sie nicht angewendet',
  'panel.inspector.headers.row.sinceFire.edited': 'Regel seither bearbeitet',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'Die Regel wurde seit dieser Anfrage bearbeitet — die aktuelle Regel gilt nur für künftige Anfragen',
  'panel.inspector.headers.row.sinceFire.value': 'Variable seither geändert',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'Eine von dieser Regel referenzierte Variable löst jetzt zu einem anderen Wert auf — gilt nur für ' +
    'künftige Anfragen',

  // Value chips. Flag/attribute chip TEXTS (HttpOnly, SameSite=Lax,
  // JWT, alg, `exp {duration}`, cache-directive summaries, boundary)
  // are wire vocabulary and stay raw; only the UI-worded chips key.
  'panel.inspector.headers.chips.expires': 'läuft ab {duration}',
  'panel.inspector.headers.chips.session': 'Session',
  'panel.inspector.headers.chips.missingFlag': 'ohne {flag}',
  'panel.inspector.headers.chips.expired': 'abgelaufen',

  // Chip (i) corpora. Titles that are wire vocabulary (HttpOnly,
  // SameSite=X, Cache-Control: …, Strict-Transport-Security, JWT,
  // scheme names) stay raw. Cache/HSTS directive descriptions reuse
  // the shared header corpus where the referent matches; the
  // parameterized ones (durations in the hole) live here.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Set-Cookie-Flag',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Das Cookie ist vor JavaScript verborgen (nicht über `document.cookie` lesbar).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'Mildert XSS — ein injiziertes Skript kann das Cookie nicht mehr ausleiten. Hilft nicht gegen CSRF.',
  'panel.inspector.headers.chipInfo.secure.summary':
    'Das Cookie wird nur über HTTPS gesendet. Es lernt reines HTTP nie kennen.',
  'panel.inspector.headers.chipInfo.partitioned.summary': 'CHIPS — das Cookie ist pro Top-Level-Site partitioniert.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Jede Top-Level-Site bekommt ihre eigene Kopie des Cookies, sodass eingebettete Kontexte Nutzer nicht per ' +
    'Cookie über Websites hinweg verfolgen können.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Das Cookie wird nur bei Same-Site-Anfragen gesendet. Stärkster CSRF-Schutz — selbst Links von anderen ' +
    'Websites kommen ohne Cookie an.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Das Cookie wird bei Same-Site-Anfragen und Top-Level-Cross-Site-Navigationen (Linkklicks) gesendet. ' +
    'Standard in modernen Browsern.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Das Cookie wird bei allen Cross-Site-Anfragen gesendet. Erfordert `Secure`. Bewusst einsetzen — ' +
    'Empfänger können das Cookie über Websites hinweg korrelieren.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Cookie-Ablauf',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'Das Cookie ist bereits abgelaufen. Der Browser wird es nicht senden.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Das Cookie läuft in {duration} ab (am {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Cookies ohne `Max-Age` oder `Expires` sind Session-Cookies und verschwinden beim Beenden des Browsers. ' +
    'Setze eines davon, um das Cookie dauerhaft zu machen.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Session-Cookie',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'Kein `Max-Age` oder `Expires` — der Browser verwirft dieses Cookie beim Beenden.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Ergänze `Max-Age=<seconds>` oder `Expires=<date>`, damit es Browser-Sitzungen überdauert.',
  'panel.inspector.headers.chipInfo.missingFlag.title': '{flag} fehlt',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Best Practice',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Ohne `Secure` kann dieses Cookie über reines HTTP durchsickern. Auf HTTPS-Cookies immer setzen.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    'Ohne `HttpOnly` kann JavaScript dieses Cookie über `document.cookie` lesen — ein XSS-Bug leitet es aus.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Ohne explizites `SameSite` fallen Browser auf `Lax` zurück. Sei explizit, damit die Policy im Code-Review ' +
    'offensichtlich ist.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'Die meisten Produktions-Cookies sollten `Secure`, `HttpOnly` und ein explizites `SameSite` tragen.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Cache-Direktive',
  'panel.inspector.headers.chipInfo.rawValue': 'Rohwert: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Aktive Direktiven',
  'panel.inspector.headers.chipInfo.maxAge': 'Frisch für {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Frische im geteilten Cache: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'Erlaubt veraltete Wiederverwendung für {duration}, während im Hintergrund revalidiert wird.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Content-Type-Parameter',
  'panel.inspector.headers.chipInfo.charset.summary': 'Zeichencodierung des Bodys.',
  'panel.inspector.headers.chipInfo.charset.description':
    'Für `text/*`-Typen ist `utf-8` der moderne Standard. Falsche Werte erzeugen Zeichensalat.',
  'panel.inspector.headers.chipInfo.boundary.title': 'Multipart-Boundary',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'Token, das die Teile eines Multipart-Bodys trennt (Datei-Uploads, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description': 'Vom Client erzeugt; darf im Body keines Teils vorkommen.',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Sicherheitsrichtlinie',
  'panel.inspector.headers.chipInfo.hsts.summary': 'Der Browser nutzt für diesen Host {duration} lang nur HTTPS.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': 'Authorization-Schema',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — ein base64-codiertes Tripel `<header>.<payload>.<signature>`.',
  'panel.inspector.headers.chipInfo.jwt.description':
    'Die Signatur beweist, dass der Token von jemandem mit dem Signierschlüssel ausgestellt wurde. Header ' +
    '(alg, typ) und Payload (Claims) sind NICHT verschlüsselt — nur base64-codiert und für jeden lesbar.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'JWT-Header',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'JWT-Claim',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'Im JWT-Header deklarierter Signieralgorithmus.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Gängige Werte: `HS256` (HMAC-SHA256, symmetrisch), `RS256` (RSA, asymmetrisch), `ES256` (ECDSA). `none` ' +
    '(keine Signatur) sollten Validatoren immer ablehnen.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT abgelaufen',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'Der Token ist seit {duration} abgelaufen. Der Server sollte ihn ablehnen.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT läuft in {duration} ab',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'Der Token steht kurz vor dem Ablauf — erneuere ihn oder rechne bald mit einem 401.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'Zeit bis zum Erreichen des JWT-`exp`-Claims.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    'Opake Bearer-Anmeldung (OAuth 2.0 / API-Token). Behandle sie wie ein Passwort — wer sie hat, kann sich ' +
    'als der Nutzer authentifizieren.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic Auth — `base64(username:password)`. Nur über HTTPS sicher.',
  'panel.inspector.headers.chipInfo.scheme.other':
    'Name des Authentifizierungsschemas. Das Anmeldedaten-Format hängt vom Schema ab.',

  // Header insights (t-fed `computeHeaderInsights`). Origins, cookie
  // names, HSTS summaries, and durations ride as raw holes.
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS fehlkonfiguriert',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` verträgt sich nicht mit Anmeldedaten — der Browser wird diese Antwort ' +
    'ablehnen.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Mit {origin} überschreiben',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'CORS-Anfrage ohne Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'Die Anfrage trug `Origin: {origin}`, aber die Antwort hat kein `Access-Control-Allow-Origin`. Der Browser ' +
    'wird die Antwort blockieren.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Access-Control-Allow-Origin: {origin} hinzufügen',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` ohne `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} Cookies ohne `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Über HTTPS gesetzte Cookies sollten `Secure` tragen, damit sie nicht über reines HTTP gesendet werden ' +
    'können.',
  'panel.inspector.headers.insights.missingCsp.title': 'Keine Content-Security-Policy auf einer HTML-Antwort',
  'panel.inspector.headers.insights.missingCsp.action': 'Eine Basis-CSP hinzufügen',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS-max-age ist sehr kurz ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'Die meisten Richtlinien empfehlen mindestens 6 Monate; preload verlangt 1 Jahr.',
  'panel.inspector.headers.insights.jwtExpired.title': 'JWT im Authorization-Header ist abgelaufen',
  'panel.inspector.headers.insights.jwtExpired.detail': 'Seit {duration} abgelaufen.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT läuft in {duration} ab',
  'panel.inspector.headers.insights.missingContentType.title': 'Antwort ohne Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': 'Content-Type hinzufügen',
} as const satisfies Catalog;
