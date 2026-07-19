/**
 * Shared info-popover corpus — HTTP headers — German. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: Origin raw (f., the
 * web-platform referent) vs Ursprungsserver = origin server;
 * Preflight raw (m., es precedent); Challenge raw (f.); der Cache +
 * cachen/gecacht as verb family; MIME-Sniffing raw (n.); Hotlink
 * raw; Edge/Shield CDN tier names ride raw; Direktiven = directives
 * section label; Register = registry (shared-info-status precedent).
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'Anfrage-Header',
  'shared.info.header.direction.response': 'Antwort-Header',
  'shared.info.header.direction.both': 'Anfrage-/Antwort-Header',
  'shared.info.header.section.directives': 'Direktiven',
  'shared.info.header.section.commonValues': 'Häufige Werte',
  'shared.info.header.fallback.customCategory': 'Benutzerdefiniert oder nicht standardisiert',
  'shared.info.header.fallback.customSummary':
    'Dieser Header ist benutzerdefiniert oder nicht standardisiert — keine Dokumentation in unserem Register.',
  'shared.info.header.fallback.unknownSummary':
    '{name} ist in unserem Register noch nicht dokumentiert. Die Zeile stuft ihn als {category} ein.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Anmeldedaten, die den Client gegenüber dem Server authentifizieren.',
  'shared.info.header.authorization.body1':
    'Format: `<scheme> <credentials>`. Gängige Schemata: `Bearer <token>` (OAuth, JWT), ' +
    '`Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary':
    'Anmeldedaten für einen zwischengeschalteten Proxy (nicht den Ursprungsserver).',
  'shared.info.header.proxyAuthorization.body1':
    'Gleiche Syntax wie `Authorization`, gilt aber dem Proxy statt dem Ursprungsserver.',
  'shared.info.header.wwwAuthenticate.summary':
    '401-Challenge des Servers — nennt dem Client das zu verwendende Authentifizierungsschema.',
  'shared.info.header.wwwAuthenticate.body1':
    'Wird mit `401 Unauthorized` gesendet. Öffnet den Basic-Auth-Dialog des Browsers, wenn das Schema `Basic` ist.',
  'shared.info.header.proxyAuthenticate.summary':
    'Proxy-Gegenstück zu `WWW-Authenticate`, gesendet mit `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    'Schließt die gegenseitige Authentifizierung bei Erfolg ab — Digest-Auth bestätigt damit auch den Server.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': 'Direktiven, die steuern, wie eine Antwort gecacht und revalidiert wird.',
  'shared.info.header.cacheControl.body1':
    'Anfrage wie Antwort tragen Direktiven. Mehrere kommagetrennte Tokens werden UND-verknüpft. Das Verhalten ' +
    'gilt pro Direktive — der Header ist kein einzelner Modus.',
  'shared.info.header.cacheControl.directive.noStore': 'Überhaupt nicht cachen, nirgends.',
  'shared.info.header.cacheControl.directive.noCache':
    'Darf gecacht werden, aber vor jeder Wiederverwendung revalidieren.',
  'shared.info.header.cacheControl.directive.public': 'Jeder Cache darf speichern, auch geteilte/CDN.',
  'shared.info.header.cacheControl.directive.private': 'Nur der Browser des Nutzers darf speichern.',
  'shared.info.header.cacheControl.directive.maxAgeN':
    'Frisch für N Sekunden; Wiederverwendung ohne Kontakt zum Ursprungsserver.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'Wie max-age, aber nur für geteilte Caches.',
  'shared.info.header.cacheControl.directive.mustRevalidate': 'Einmal veraltet, vor dem Ausliefern revalidieren.',
  'shared.info.header.cacheControl.directive.immutable': 'Verspricht, dass sich der Body während max-age nicht ändert.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'Erlaubt veraltete Wiederverwendung, während im Hintergrund revalidiert wird.',
  'shared.info.header.pragma.summary': 'Veraltete HTTP/1.0-Cache-Steuerung — praktisch von Cache-Control abgelöst.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` wird von manchen Clients noch aus Kompatibilität gesetzt. Moderne Server sollten ' +
    '`Cache-Control` beachten und `Pragma` ignorieren.',
  'shared.info.header.expires.summary': 'Absoluter Zeitpunkt, ab dem die Antwort als veraltet gilt.',
  'shared.info.header.expires.body1':
    'Abgelöst durch `Cache-Control: max-age`. Sind beide gesetzt, gewinnt `max-age`. Ein Datum in der ' +
    'Vergangenheit (oder `0`) erzwingt erneutes Laden.',
  'shared.info.header.etag.summary': 'Opake Kennung für den Antwort-Body — dient zur Revalidierung gecachter Kopien.',
  'shared.info.header.etag.body1':
    'Clients schicken sie in `If-None-Match` zurück. Stimmt der Wert noch, antwortet der Server mit ' +
    '`304 Not Modified` ohne Body.',
  'shared.info.header.ifMatch.summary':
    'Bedingte Anfrage: nur fortfahren, wenn das aktuelle ETag der Ressource übereinstimmt.',
  'shared.info.header.ifMatch.body1':
    'Von Schreibzugriffen genutzt, um fremde Änderungen nicht zu überschreiben (optimistische Nebenläufigkeit).',
  'shared.info.header.ifNoneMatch.summary':
    'Bedingte Anfrage: nur fortfahren, wenn sich das ETag der Ressource geändert hat.',
  'shared.info.header.ifNoneMatch.body1':
    'Von Lesezugriffen genutzt, um den Download einer unveränderten Antwort zu sparen — der Server antwortet ' +
    'mit `304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Bedingte Anfrage: nur fortfahren, wenn sich die Ressource nach dem angegebenen Datum geändert hat.',
  'shared.info.header.ifModifiedSince.body1': 'Ungenauer als `If-None-Match`/ETag; bevorzuge ETags, wenn verfügbar.',
  'shared.info.header.ifUnmodifiedSince.summary':
    'Bedingte Anfrage: nur fortfahren, wenn die Ressource seit dem angegebenen Datum unverändert ist.',
  'shared.info.header.lastModified.summary': 'Zeitpunkt der letzten Änderung der Ressource.',
  'shared.info.header.lastModified.body1': 'Bildet mit `If-Modified-Since` das Paar für die Revalidierung.',
  'shared.info.header.age.summary': 'Sekunden, die die Antwort in einem geteilten Cache lag.',
  'shared.info.header.age.body1':
    'Von CDNs und Proxys zurückgegeben; hilft Clients, die Frische der Antwort einzuschätzen.',
  'shared.info.header.xCache.summary':
    'Cache-Ergebnis von CDN / Reverse-Proxy — herstellerspezifisches Format (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Aus dem Cache ausgeliefert.',
  'shared.info.header.xCache.value.miss': 'Nicht im Cache; vom Ursprungsserver geholt.',
  'shared.info.header.xCache.value.hitHit': 'Mehrere Cache-Ebenen haben alle getroffen (z. B. Shield + Edge).',
  'shared.info.header.xCacheHits.summary':
    'Cache-Trefferzähler pro Ebene — herstellerspezifisch, verbreitet bei Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Kommagetrennt, wenn mehrere Cache-Ebenen beteiligt sind. Hohe Werte deuten auf heiße Cache-Einträge hin.',
  'shared.info.header.warning.summary':
    'Zusätzlicher Caching-Kontext (veraltet, Transformation angewendet usw.). Seit RFC 7234 in HTTP/1.1 als ' +
    'veraltet markiert, wird aber noch gesendet.',
  'shared.info.header.surrogateControl.summary':
    'Cache-Steuerung für Edge Side Includes — lenkt CDNs und überlässt das Browser-Caching `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Spezifisch für ESI-fähige Caches (Fastly, Akamai, Varnish in manchen Konfigurationen).',
  'shared.info.header.surrogateCapability.summary':
    'Hinweis vom Edge an den Ursprungsserver: welche ESI-Funktionen das Surrogat unterstützt.',
  'shared.info.header.cfCacheStatus.summary': 'Cloudflare-Cache-Ergebnis für diese Anfrage.',
  'shared.info.header.cfCacheStatus.value.hit': 'Aus dem Cloudflare-Cache ausgeliefert.',
  'shared.info.header.cfCacheStatus.value.miss': 'Nicht im Cache; vom Ursprungsserver geholt.',
  'shared.info.header.cfCacheStatus.value.expired': 'War gecacht, aber abgelaufen; vom Ursprungsserver aufgefrischt.',
  'shared.info.header.cfCacheStatus.value.bypass': 'Cache umgangen (Page Rules / No-Cache-Header).',
  'shared.info.header.cfCacheStatus.value.dynamic': 'Standardmäßig nicht cachebar (Cookies, Query-String usw.).',
  'shared.info.header.cfCacheStatus.value.revalidated': 'Gecacht und mit dem Ursprungsserver revalidiert (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint: die Markenliste des Browsers.',
  'shared.info.header.secChUa.body1':
    'Ersetzt den formlosen `User-Agent` für die Teile, auf die sich Server tatsächlich verlassen sollten.',
  'shared.info.header.secChUaMobile.summary': 'Client Hint: `?1` auf Mobilgeräten, `?0` auf dem Desktop.',
  'shared.info.header.secChUaPlatform.summary':
    'Client Hint: das Betriebssystem (`"Windows"`, `"macOS"`, `"Linux"` usw.).',
  'shared.info.header.userAgent.summary':
    'Formlose Legacy-Zeichenkette, die Browser, Betriebssystem und Engine identifiziert.',
  'shared.info.header.userAgent.body1':
    'Wird weiterhin mit jeder Anfrage gesendet. Der strukturierte Ersatz ist die `Sec-CH-UA-*`-Familie — ' +
    'bevorzuge sie, wenn Server auf die Browser-Identität angewiesen sind.',
  'shared.info.header.acceptCh.summary':
    'Listet, welche Client-Hint-Header der Server bei künftigen Anfragen erhalten möchte.',
  'shared.info.header.acceptCh.body1':
    'Browser senden nur Hints, denen der Server hier zugestimmt hat (abgesehen von den Low-Entropy-Standards).',
  'shared.info.header.criticalCh.summary':
    'Teilmenge von `Accept-CH`, die der Server als kritisch einstuft — Browser wiederholen die Anfrage, um sie ' +
    'mitzusenden.',
  'shared.info.header.criticalCh.body1': 'Sparsam einsetzen: Jeder Critical-CH-Fehlschlag kostet einen Round-Trip.',
  'shared.info.header.saveData.summary':
    '`on`, wenn der Nutzer im Browser/Betriebssystem einen Datensparmodus aktiviert hat.',
  'shared.info.header.saveData.body1':
    'Nutze es, um bandbreitenschonendere Assets auszuliefern (geringere Bildqualität, Below-the-fold-Arbeit ' +
    'aufschieben usw.).',
  'shared.info.header.deviceMemory.summary':
    'Ungefährer Geräte-RAM in GiB, gerundet auf wenige Werte (`0.25`, `0.5`, `1`, `2`, `4`, `8`).',
  'shared.info.header.downlink.summary': 'Geschätzte Downstream-Bandbreite in Mbps, gerundet.',
  'shared.info.header.ect.summary': 'Effective Connection Type — `slow-2g`, `2g`, `3g` oder `4g`.',
  'shared.info.header.rtt.summary': 'Geschätzte Round-Trip-Zeit in Millisekunden, gerundet.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Hop-by-hop-Verbindungssteuerung (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Wird von Proxys zwischen den Hops entfernt. In HTTP/2+ ist dieser Header verboten — die ' +
    'Verbindungsverwaltung steckt im Protokoll selbst.',
  'shared.info.header.keepAlive.summary': 'Hinweise für den Verbindungspool — typisch `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1':
    'Nur mit `Connection: keep-alive` unter HTTP/1.1 von Bedeutung. In HTTP/2+ ignoriert.',
  'shared.info.header.upgrade.summary':
    'Bittet um einen Protokollwechsel auf derselben Verbindung (WebSocket, HTTP/2 Cleartext).',
  'shared.info.header.upgrade.body1':
    'Wird zusammen mit `Connection: upgrade` verwendet. WebSocket: `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Transfer-Codierungen, die der Client akzeptiert (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1':
    'Die meisten modernen Clients senden nur `TE: trailers`, um Trailing-Header zu erlauben.',
  'shared.info.header.expect.summary': 'Serverseitige Vorbedingungen, die der Client erwartet (`100-continue`).',
  'shared.info.header.expect.body1':
    'Mit `Expect: 100-continue` sendet der Client den Body erst, nachdem der Server `100 Continue` signalisiert hat.',
  'shared.info.header.altSvc.summary': 'Kündigt alternative Wege zur selben Origin an (z. B. HTTP/3 über QUIC).',
  'shared.info.header.altSvc.body1':
    'Browser merken sich die Ankündigung und können für folgende Anfragen zur Alternative wechseln.',
  'shared.info.header.secWebsocketKey.summary': 'Zufällige base64-codierte Nonce, gesendet beim WebSocket-Handshake.',
  'shared.info.header.secWebsocketKey.body1':
    'Der Server antwortet mit `Sec-WebSocket-Accept`, abgeleitet aus diesem Schlüssel + einer festen GUID, und ' +
    'beweist so, dass er WebSocket versteht.',
  'shared.info.header.secWebsocketAccept.summary':
    'Servernachweis für den WebSocket-Handshake — `SHA-1(Sec-WebSocket-Key + GUID)` base64-codiert.',
  'shared.info.header.secWebsocketVersion.summary':
    'WebSocket-Protokollversion, die der Client anfragt. Fast immer `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Subprotokoll-Aushandlung für WebSocket — kommagetrennte Liste in der Anfrage, ein gewählter Wert in der Antwort.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Ausgehandelte WebSocket-Erweiterungen (Kompression usw.) — am häufigsten `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Medientyp des Anfrage- oder Antwort-Bodys.',
  'shared.info.header.contentType.body1':
    'Bestimmt, wie der Browser den Body parst — falsche Werte führen zu stillen Fehlern (JSON als HTML geparst usw.).',
  'shared.info.header.contentType.body2': 'Gib für `text/*`-Typen `charset=utf-8` an, sofern nichts dagegen spricht.',
  'shared.info.header.contentType.value.applicationJson': 'JSON-Body.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'URL-codierte Formularfelder.',
  'shared.info.header.contentType.value.multipartFormData': 'Multipart-Formular / Datei-Uploads.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML-Dokument.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Opake Binärdaten.',
  'shared.info.header.contentLength.summary': 'Body-Größe in Bytes (decodiert).',
  'shared.info.header.contentLength.body1':
    'Schließt sich mit `Transfer-Encoding: chunked` gegenseitig aus. Falsche Werte desynchronisieren die Verbindung.',
  'shared.info.header.contentEncoding.summary':
    'Auf den Body angewendete Kompression — der Browser decodiert, bevor JS ihn sieht.',
  'shared.info.header.contentEncoding.body1':
    'Gängig: `gzip`, `br` (Brotli), `zstd` (neuer). Die decodierte Größe ist das, was `response.body` sieht.',
  'shared.info.header.contentDisposition.summary':
    'Sagt dem Browser, ob die Antwort inline angezeigt oder heruntergeladen wird.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (Standard) rendert im Browser. `attachment; filename="x"` löst einen Download mit dem angegebenen ' +
    'Standarddateinamen aus.',
  'shared.info.header.accept.summary': 'Medientypen, die der Client entgegennehmen möchte.',
  'shared.info.header.accept.body1':
    'Q-Werte drücken Präferenzen aus (`text/html;q=0.9`). Die meisten Server ignorieren heute alles außer dem ' +
    'ersten Typ.',
  'shared.info.header.acceptEncoding.summary': 'Kompressionen, die der Client decodieren kann.',
  'shared.info.header.acceptEncoding.body1':
    'Typischer Browser-Wert: `gzip, deflate, br, zstd`. Server wählen eine und antworten mit `Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Menschliche Sprachen, die der Client bevorzugt.',
  'shared.info.header.acceptLanguage.body1':
    'Der Server wählt daraus eine `Content-Language`, oft mit Rückfall auf einen Standard.',
  'shared.info.header.transferEncoding.summary':
    'Codierung nur für den Transport — wird entfernt, bevor der Body die Anwendung erreicht.',
  'shared.info.header.transferEncoding.body1':
    'Fast immer `chunked`. Schließt sich mit `Content-Length` gegenseitig aus.',
  'shared.info.header.range.summary': 'Fordert einen Bytebereich der Ressource an statt des ganzen Bodys.',
  'shared.info.header.range.body1':
    'Format: `bytes=<start>-<end>` (inklusiv). Der Server antwortet mit `206 Partial Content` und `Content-Range`.',
  'shared.info.header.contentRange.summary': 'Gibt an, welcher Bytebereich der Ressource im Body steckt.',
  'shared.info.header.contentRange.body1':
    'Format: `bytes <start>-<end>/<total>`. Kommt mit `206 Partial Content` zurück.',
  'shared.info.header.acceptRanges.summary':
    'Teilt dem Client mit, ob Bereichsanfragen unterstützt werden (`bytes`) oder nicht (`none`).',
  'shared.info.header.contentMd5.summary':
    'Base64-codierter MD5-Hash des Bodys zur Integritätsprüfung. Seit HTTP/1.1 RFC 7231 obsolet, wird aber von ' +
    'manchen Servern noch gesendet.',
  'shared.info.header.contentMd5.body1':
    'Moderne Integritätsprüfung läuft über `Digest` / `Want-Digest` oder über TLS selbst.',
  'shared.info.header.contentLanguage.summary': 'Natürliche Sprache(n) des Antwort-Bodys.',
  'shared.info.header.contentLanguage.body1':
    'Wird gegen das `Accept-Language` der Anfrage ausgehandelt. Werte sind BCP-47-Tags (`en-US`, `de-DE` usw.).',
  'shared.info.header.contentLocation.summary':
    'Alternative URL, die die Entität in dieser Antwort eindeutig identifiziert.',
  'shared.info.header.contentLocation.body1':
    'Anders als `Location`: `Content-Location` beschreibt die erhaltene Ressource, nicht ein Umleitungsziel.',
  'shared.info.header.acceptCharset.summary':
    'Zeichencodierungen, die der Client akzeptiert. Veraltet — moderne Browser senden immer UTF-8 und lassen ' +
    'den Header weg.',
  'shared.info.header.acceptCharset.body1': 'Die meisten Server können ihn gefahrlos ignorieren.',
  'shared.info.header.ifRange.summary':
    'Bedingte Bereichsanfrage: den Bereich nur ausliefern, wenn die Ressource noch zum angegebenen ETag oder ' +
    'Datum passt.',
  'shared.info.header.ifRange.body1':
    'Hat sich die Ressource geändert, liefert der Server den ganzen Body mit `200 OK` statt `206 Partial Content`.',
  'shared.info.header.trailer.summary':
    'Kündigt an, welche Header-Feldnamen nach einem Chunked-Body im Trailer erscheinen.',
  'shared.info.header.trailer.body1':
    'Nur mit `Transfer-Encoding: chunked` von Bedeutung. Der Client muss per `TE: trailers` zustimmen.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': 'Cookies, die der Browser mit dieser Anfrage sendet, durch Semikolons getrennt.',
  'shared.info.header.cookie.body1':
    'Vom Browser aus seinem Cookie-Glas gesetzt. Kann von JS nicht direkt auf `fetch` gesetzt werden — nutze ' +
    "`credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Vom Server ausgestellte Cookie-Definition.',
  'shared.info.header.setCookie.body1':
    'Ein Cookie pro `Set-Cookie`-Headerzeile. Browser speichern den jeweils letzten Wert pro Tupel (Name, ' +
    'Domain, Pfad).',
  'shared.info.header.setCookie.body2':
    'Produktions-Cookies sollten immer `Secure`, `HttpOnly` und ein explizites `SameSite` (Lax oder Strict) tragen.',
  'shared.info.header.setCookie.directive.secure': 'Wird nur über HTTPS gesendet.',
  'shared.info.header.setCookie.directive.httpOnly': 'Vor JavaScript verborgen (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    'Cross-Site-Sendeverhalten. `None` erfordert `Secure`.',
  'shared.info.header.setCookie.directive.domainHost': 'An diesen Host und alle seine Subdomains senden.',
  'shared.info.header.setCookie.directive.pathPath': 'Nur an URLs senden, die mit diesem Pfad beginnen.',
  'shared.info.header.setCookie.directive.maxAgeN': 'TTL in Sekunden (hat Vorrang vor Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Absoluter Ablauf; ohne Angabe = Session-Cookie.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — partitioniert pro Top-Level-Site.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary': 'Sagt dem Browser, welche Origins diese Antwort lesen dürfen.',
  'shared.info.header.accessControlAllowOrigin.body1':
    'Vom Server auf der Antwort gesetzt. Der Browser vergleicht ihn mit dem `Origin`-Header der Anfrage und ' +
    'hindert JavaScript am Lesen des Bodys, wenn sie nicht übereinstimmen.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` akzeptiert jede Origin, verträgt sich aber nicht mit Anmeldedaten — trägt die Anfrage Cookies oder ' +
    'Auth, muss die Antwort stattdessen exakt die anfragende Origin zurückgeben.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'Jede Origin darf lesen (ohne Anmeldedaten).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': 'Nur die genannte Origin darf lesen.',
  'shared.info.header.accessControlAllowCredentials.summary':
    'Erlaubt dem Browser, die Antwort freizugeben, wenn die Anfrage Anmeldedaten trug.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Muss `true` sein (kleingeschrieben). Wenn gesetzt, darf `Access-Control-Allow-Origin` NICHT `*` sein — er ' +
    'muss exakt die Origin zurückgeben.',
  'shared.info.header.accessControlAllowMethods.summary':
    'Listet HTTP-Methoden, die der Server für Cross-Origin-Anfragen akzeptiert.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Kommt auf Preflight-Antworten (`OPTIONS`) zurück. Der Browser cacht die Antwort für ' +
    '`Access-Control-Max-Age` Sekunden.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Listet Anfrage-Header, die der Server bei Cross-Origin-Anfragen akzeptiert.',
  'shared.info.header.accessControlAllowHeaders.body1':
    'Erforderlich, wenn der Browser nicht-einfache Header preflightet (alles jenseits von `Accept`, ' +
    '`Accept-Language`, `Content-Language` und einfachen `Content-Type`-Werten).',
  'shared.info.header.accessControlExposeHeaders.summary': 'Listet Antwort-Header, die JavaScript lesen darf.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'Standardmäßig sieht JS nur CORS-safelisted Antwort-Header (`Cache-Control`, `Content-Language`, ' +
    '`Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Jeder andere Header muss hier genannt sein, damit ' +
    '`response.headers.get(...)` ihn zurückgibt.',
  'shared.info.header.accessControlMaxAge.summary':
    'Wie lange der Browser die Preflight-Antwort cachen darf, in Sekunden.',
  'shared.info.header.accessControlMaxAge.body1':
    'Große Werte sparen Preflight-Verkehr — 86400 (1 Tag) ist verbreitet. Chrome deckelt bei 7200 Sekunden, ' +
    'Firefox bei 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Wird im Preflight gesendet und nennt die Methode der eigentlichen Anfrage.',
  'shared.info.header.accessControlRequestMethod.body1': 'Der Server bestätigt mit `Access-Control-Allow-Methods`.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Wird im Preflight gesendet und nennt die Header der eigentlichen Anfrage.',
  'shared.info.header.accessControlRequestHeaders.body1':
    'Wird bei Annahme über `Access-Control-Allow-Headers` zurückgespiegelt.',
  'shared.info.header.origin.summary':
    'Identifiziert die Origin, die eine Cross-Origin- oder POST-Anfrage ausgelöst hat.',
  'shared.info.header.origin.body1':
    'Wird automatisch vom Browser gesendet. Kann von JS nicht gesetzt werden. Server stützen darauf ' +
    'CORS-Antworten und CSRF-Abwehr.',
  'shared.info.header.vary.summary':
    'Sagt Caches, welche Anfrage-Header die Antwort beeinflussen, damit sie den Cache-Schlüssel variieren.',
  'shared.info.header.vary.body1':
    'Kritisch für CORS: Setze `Vary: Origin`, wann immer `Access-Control-Allow-Origin` aus der Origin der ' +
    'Anfrage berechnet wird — sonst liefert ein Cache die Antwort einer Origin an eine andere aus.',
  'shared.info.header.timingAllowOrigin.summary':
    'Erlaubt fremden Origins, detaillierte Timing-Metriken (`PerformanceResourceTiming`) für diese Ressource zu lesen.',
  'shared.info.header.timingAllowOrigin.body1':
    'Ohne diesen Header geben Cross-Origin-Ressourcen nur grobe Timings preis.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': 'Vom Browser gesetzt: die Beziehung zwischen Anfrage-Initiator und Ziel.',
  'shared.info.header.secFetchSite.body1':
    'Werte: `same-origin`, `same-site`, `cross-site`, `none` (direkte Navigation).',
  'shared.info.header.secFetchMode.summary': 'Vom Browser gesetzt: der Fetch-Modus der Anfrage.',
  'shared.info.header.secFetchMode.body1': 'Werte: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Vom Browser gesetzt: wo die Antwort verwendet wird (Dokument, Skript, Bild usw.).',
  'shared.info.header.secFetchDest.body1':
    'Lässt den Server überraschende Fetches erkennen — z. B. eine HTML-Antwort, die als ' +
    '`Sec-Fetch-Dest: script` angefordert wird.',
  'shared.info.header.secFetchUser.summary':
    'Vom Browser gesetzt: `?1`, wenn die Navigation eine direkte Nutzeraktion war.',
  'shared.info.header.secFetchUser.body1':
    'Sonst nicht vorhanden. Nützlich, um Nutzerklicks von programmatischer Navigation zu unterscheiden.',
  'shared.info.header.secPurpose.summary':
    'Vom Browser gesetzt, wenn die Anfrage spekulativ ist — z. B. `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    'Lässt den Server Nebenwirkungen (Analytics, Schreiblogs) für Fetches überspringen, die der Nutzer noch ' +
    'gar nicht angefordert hat.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'Sagt dem Server (oder dem Client), wie dringend und wie inkrementell dieser Transfer ist.',
  'shared.info.header.priority.body1':
    'Format: `u=<0-7>` (Dringlichkeit, niedriger = höhere Priorität) und optional `, i` (inkrementell — kann ' +
    'verarbeitet werden, während es eintrifft).',
  'shared.info.header.upgradeInsecureRequests.summary':
    'Vom Browser gesetzte `1` — signalisiert dem Server, dass der Client HTTPS für eingebettete Ressourcen bevorzugt.',
  'shared.info.header.upgradeInsecureRequests.body1':
    'Bildet mit der CSP-Direktive `upgrade-insecure-requests` auf Antworten das Paar.',
  'shared.info.header.earlyData.summary': '`1` — gesetzt von Clients, die Daten im TLS-1.3-0-RTT-Modus senden.',
  'shared.info.header.earlyData.body1':
    'Server sollten Early Data bei nicht-idempotenten Methoden (POST usw.) ablehnen, um Replay-Angriffe zu vermeiden.',
  'shared.info.header.link.summary': 'Ressourcen-Hinweise — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Gleiche Semantik wie `<link rel="...">` in HTML; nützlich aus Nicht-HTML-Antworten (APIs, Umleitungen).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Ein Stylesheet vorladen.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': 'Eine Verbindung im Voraus öffnen.',
  'shared.info.header.xDnsPrefetchControl.summary':
    'Schaltet das DNS-Prefetching des Browsers für Links auf der Seite um (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary': 'Do Not Track — `1`, wenn der Nutzer Tracking abgewählt hat. Weitgehend veraltet.',
  'shared.info.header.dnt.body1':
    'Die meisten großen Websites ignorieren ihn; das W3C hat die Spezifikation 2019 aufgegeben. Die Einhaltung ' +
    'ist freiwillig.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control — `1` signalisiert, dass die Daten des Nutzers nicht verkauft oder geteilt werden sollen.',
  'shared.info.header.secGpc.body1':
    'In Kalifornien unter dem CCPA rechtlich bindend; von einigen datenschutzorientierten Browsern beachtet ' +
    '(Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Listet Proxys / Gateways, die die Nachricht durchlaufen hat.',
  'shared.info.header.via.body1':
    'Jeder Proxy hängt seine Kennung an, sodass sich die Kette beim Debuggen rekonstruieren lässt.',
  'shared.info.header.xForwardedFor.summary':
    'Nicht standardisiert, aber allgegenwärtig: kommagetrennte Kette der Client-IPs durch Proxys.',
  'shared.info.header.xForwardedFor.body1':
    'Der linkeste Eintrag ist der ursprüngliche Client. Der `Forwarded`-Header aus RFC 7239 ist die ' +
    'standardisierte Alternative.',
  'shared.info.header.xForwardedProto.summary':
    'Ursprüngliches Schema (`http` oder `https`), mit dem der Client den ersten Proxy erreicht hat.',
  'shared.info.header.xForwardedHost.summary':
    'Ursprünglicher `Host`-Header des Clients, bevor der Proxy ihn umgeschrieben hat.',
  'shared.info.header.xRealIp.summary': 'Ursprüngliche Client-IP aus Sicht des ersten Proxys. Einzelwert, keine Kette.',
  'shared.info.header.forwarded.summary':
    'Standardisierte Proxy-Kette aus RFC 7239 — ersetzt die `X-Forwarded-*`-Familie.',
  'shared.info.header.forwarded.body1':
    'Format: `for=client; proto=https; by=proxy; host=original-host`. Mehrere Proxys durch Kommas getrennt.',
  'shared.info.header.trueClientIp.summary':
    'Ursprüngliche Client-IP, weitergereicht von Akamai / Cloudflare Enterprise — Einzelwert, keine Kette.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'HTTP/2+-Pseudo-Header — Entsprechung von `Host` in HTTP/1.1. Identifiziert den Zielserver.',
  'shared.info.header.authority.body1':
    'Pseudo-Header beginnen mit `:` und müssen vor regulären Headern stehen. Der Browser setzt sie; JavaScript ' +
    'kann es nicht.',
  'shared.info.header.method.summary': 'HTTP/2+-Pseudo-Header — die Anfragemethode (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'HTTP/2+-Pseudo-Header — Anfragepfad + Query-String.',
  'shared.info.header.scheme.summary': 'HTTP/2+-Pseudo-Header — `https` oder `http`.',
  'shared.info.header.status.summary': 'HTTP/2+-Pseudo-Header — der numerische Antwortstatus (z. B. `200`).',
  'shared.info.header.status.body1': 'Pseudo-Header ersetzen in HTTP/2 und HTTP/3 die Statuszeile von HTTP/1.1.',
  'shared.info.header.host.summary': 'HTTP/1.1-Zielhost (mit optionalem Port). In HTTP/2+ durch `:authority` ersetzt.',
  'shared.info.header.host.body1':
    'Auf jeder HTTP/1.1-Anfrage erforderlich. Server routen damit zwischen virtuellen Hosts auf derselben IP.',
  'shared.info.header.location.summary':
    'Umleitungsziel — kommt mit `3xx`-Antworten oder als Ergebnis einer angelegten Ressource.',
  'shared.info.header.location.body1':
    'Absolute URLs werden überall beachtet; relative URLs werden gegen die Anfrage-URL aufgelöst.',
  'shared.info.header.allow.summary': 'Listet HTTP-Methoden, die die Ressource akzeptiert.',
  'shared.info.header.allow.body1':
    'In einer `405 Method Not Allowed`-Antwort erforderlich. Übliche Werte: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': 'URL der Seite, die diese Anfrage ausgelöst hat.',
  'shared.info.header.referer.body1':
    'Beachte den historischen Schreibfehler — die Spezifikation behält ihn. Manche Ziele entfernen oder kürzen ' +
    '`Referer` gemäß der `Referrer-Policy` der Seite.',
  'shared.info.header.retryAfter.summary':
    'Sagt dem Client, wann er es erneut versuchen soll — Sekunden (Delta) oder absolutes HTTP-Datum.',
  'shared.info.header.retryAfter.body1':
    'Verbreitet bei `503 Service Unavailable` und `429 Too Many Requests`. Crawler halten sich daran.',
  'shared.info.header.maxForwards.summary':
    'Begrenzt, wie viele Proxys eine `TRACE`- oder `OPTIONS`-Anfrage weiterleiten dürfen.',
  'shared.info.header.maxForwards.body1':
    'Wird von jedem weiterleitenden Proxy heruntergezählt. Bei 0 antwortet der Proxy selbst.',
  'shared.info.header.serviceWorker.summary':
    'Vom Browser gesetztes `script`, wenn die Anfrage eine Service-Worker-Skriptdatei lädt.',
  'shared.info.header.serviceWorker.body1':
    'Lässt Server SW-Registrierungs-Fetches erkennen und mit dem passenden `Service-Worker-Allowed`-Header antworten.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Hebt die Standard-Pfadbeschränkung für den Scope des Service Workers auf.',
  'shared.info.header.serviceWorkerAllowed.body1':
    'Standardmäßig kann ein Worker nur sein Verzeichnis und darunter steuern. Dieser Header erweitert das — ' +
    'z. B. `/` von einem Worker unter `/sw.js` aus steuern.',
  'shared.info.header.protocol.summary':
    'Pseudo-Header für den Extended-CONNECT-Mechanismus (RFC 8441) — genutzt von WebSocket über HTTP/2 / 3.',
  'shared.info.header.protocol.body1':
    'Steht auf `websocket`, wenn der Client einen WebSocket durch HTTP/2 oder HTTP/3 tunnelt.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Positivliste der Quellen, aus denen die Seite Ressourcen laden oder Code ausführen darf.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Direktiven sind leerzeichengetrennt, Semikolons trennen Direktiven. Die meisten Apps brauchen mindestens ' +
    '`default-src`, `script-src`, `style-src` und `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Nutze `Content-Security-Policy-Report-Only`, um Verstöße zu beobachten, bevor du sie erzwingst.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc': 'Rückfall für jede nicht explizit gesetzte -src.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc': 'Erlaubte Quellen für `<script>` und Inline-JS.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc': 'Erlaubte Quellen für Stylesheets und Inline-CSS.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': 'Erlaubte Bildquellen.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Erlaubte Ziele für fetch/XHR/WebSocket.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Wer diese Seite in einem iframe einbetten darf (ersetzt X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo': 'Wohin Verstoßberichte per POST gehen.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Gleiche Syntax wie CSP, aber Verstöße werden nur gemeldet, nicht blockiert.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Nutze das, um eine Policy in Produktion zu testen, bevor du sie erzwingst.',
  'shared.info.header.strictTransportSecurity.summary':
    'Zwingt den Browser, diesen Host für eine bestimmte Dauer nur über HTTPS anzusprechen.',
  'shared.info.header.strictTransportSecurity.body1':
    'Setze `max-age` in Produktion auf mindestens 6 Monate. Ergänze `includeSubDomains`, um jeden Host unter ' +
    'der Domain abzudecken.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` erlaubt, die Domain für die in Browser eingebaute HSTS-Preload-Liste einzureichen ' +
    '(Einbahnentscheidung — schwer zurückzunehmen).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'Wie lange sich der Browser HTTPS-only merkt.',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Auf jede Subdomain anwenden.',
  'shared.info.header.strictTransportSecurity.directive.preload': 'Eignung für die Browser-Preload-Liste.',
  'shared.info.header.xContentTypeOptions.summary': 'Deaktiviert MIME-Sniffing.',
  'shared.info.header.xContentTypeOptions.body1':
    'Nur ein gültiger Wert: `nosniff`. Auf jeder Antwort empfohlen — verhindert, dass `text/plain`-JS ' +
    'ausgeführt wird.',
  'shared.info.header.xFrameOptions.summary': 'Steuert, ob die Seite in einem iframe eingebettet werden darf.',
  'shared.info.header.xFrameOptions.body1':
    'Weitgehend von `Content-Security-Policy: frame-ancestors` abgelöst. Behalte während der Übergangszeit ' +
    'beide für ältere Browser.',
  'shared.info.header.xFrameOptions.value.deny': 'Nie einbettbar.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Nur von Same-Origin-Seiten einbettbar.',
  'shared.info.header.xXssProtection.summary': 'Veralteter XSS-Filterschalter — in modernen Browsern obsolet.',
  'shared.info.header.xXssProtection.body1':
    'Empfohlener Wert ist `0`, um den Filter zu deaktivieren (er richtete mehr Schaden an, als er verhinderte). ' +
    'Nutze stattdessen CSP.',
  'shared.info.header.referrerPolicy.summary':
    'Steuert, wie viel der URL bei ausgehenden Navigationen und Anfragen im `Referer` mitgeht.',
  'shared.info.header.referrerPolicy.body1':
    'Vom Ziel als Antwort-Header gesendet, oder pro Seite via `<meta>` / pro Anfrage via ' +
    '`referrerpolicy`-Attribut gesetzt.',
  'shared.info.header.referrerPolicy.value.noReferrer': 'Nie einen Referer senden.',
  'shared.info.header.referrerPolicy.value.origin': 'Nur Schema + Host senden.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'Standard — volle URL same-origin, nur die Origin cross-origin, nichts beim HTTPS→HTTP-Downgrade.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': 'Immer die volle URL senden. Vermeiden.',
  'shared.info.header.permissionsPolicy.summary':
    'Positivliste für Browser-Funktionen (Geolokalisierung, Kamera, USB, Zahlung usw.).',
  'shared.info.header.permissionsPolicy.body1':
    'Jede Funktion wird auf `self`, eine Liste von Origins oder `*` beschränkt. Ersetzt den älteren ' +
    '`Feature-Policy`-Header.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'Isoliert die Seite von Cross-Origin-Opener-Beziehungen (window.opener).',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` aktiviert den crossOriginIsolated-Modus — Voraussetzung für SharedArrayBuffer und ' +
    'hochauflösende Timer.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Verlangt, dass jede geladene Subressource Cross-Origin-Erlaubnis erteilt.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Für crossOriginIsolated auf `require-corp` setzen. Bildet mit `Cross-Origin-Opener-Policy: same-origin` ' +
    'das Paar.',
  'shared.info.header.crossOriginResourcePolicy.summary': 'Verhindert, dass fremde Origins die Ressource laden.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Werte: `same-site`, `same-origin`, `cross-origin`. Kritisch für Assets, die nicht per Hotlink eingebunden ' +
    'werden sollen.',
  'shared.info.header.clearSiteData.summary':
    'Bittet den Browser, Cookies / Cache / Speicher für diese Origin zu löschen.',
  'shared.info.header.clearSiteData.body1': 'Nützlich für Logout-Abläufe.',
  'shared.info.header.clearSiteData.value.cookies': 'Cookies der Origin löschen.',
  'shared.info.header.clearSiteData.value.cache': 'HTTP- und Bild-Caches löschen.',
  'shared.info.header.clearSiteData.value.storage':
    'localStorage / IndexedDB / Service-Worker-Registrierungen löschen.',
  'shared.info.header.clearSiteData.value.wildcard': 'Alles löschen.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` bittet den Browser, dieser Origin einen eigenen Agent-Cluster (Prozess) zu geben.',
  'shared.info.header.originAgentCluster.body1':
    'Bessere Isolation für `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory usw.',
  'shared.info.header.xRobotsTag.summary': 'Indexierungsdirektiven für Crawler (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    'Gleiche Semantik wie das `<meta name="robots">`-Tag, gilt aber für Nicht-HTML-Antworten (PDFs, JSON, Bilder).',
  'shared.info.header.xUaCompatible.summary':
    'Veraltete IE/Edge-Direktive (`IE=edge`) — wählt die Rendering-Engine. In modernen Browsern obsolet.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary': 'Software-Kennung des Ursprungsservers (z. B. `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1':
    'Wird in Produktion aus Opsec-Gründen oft entfernt oder auf einen festen Wert gesetzt.',
  'shared.info.header.xPoweredBy.summary':
    'Nicht standardisierter Header, der Framework / Laufzeitumgebung hinter der Antwort nennt.',
  'shared.info.header.xPoweredBy.body1':
    'Häufig von Express, PHP, ASP.NET usw. gesendet. In Produktion oft unterdrückt.',
  'shared.info.header.date.summary': 'Zeitstempel des Ursprungsservers beim Erzeugen der Nachricht.',
  'shared.info.header.date.body1':
    'Caches berechnen damit das Antwortalter. Format: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Nennt den CDN-Edge- / Cache-Knoten, der die Antwort ausgeliefert hat.',
  'shared.info.header.xServedBy.body1':
    'Kommagetrennt, wenn mehrere Ebenen die Anfrage bearbeitet haben (Shield → Edge). Format variiert je nach ' +
    'Anbieter (Fastly-POPs, AWS-CloudFront-Edges usw.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Performance-Metriken, die der Server an die Antwort anhängt.',
  'shared.info.header.serverTiming.body1':
    'Erscheint in den DevTools und in der JS-API `PerformanceServerTiming`. Format: ' +
    '`<name>;dur=<ms>[;desc="..."]`, kommagetrennt.',
  'shared.info.header.traceparent.summary': 'W3C Trace-Context: identifiziert einen Span in einem verteilten Trace.',
  'shared.info.header.traceparent.body1':
    'Format: `<version>-<trace-id>-<parent-id>-<flags>`. Wird über Dienste hinweg mitgeführt, damit sich ' +
    'Traces wieder zusammensetzen lassen.',
  'shared.info.header.tracestate.summary': 'Herstellerspezifischer Trace-Context-Begleiter zu `traceparent`.',
  'shared.info.header.tracestate.body1':
    'Kommagetrennte `vendor=value`-Paare. Jeder Tracing-Anbieter legt hier seinen eigenen Zustand ab.',
  'shared.info.header.xRequestId.summary':
    'Vom Server vergebene Kennung für diese Anfrage — taucht in Logs und über Dienste hinweg auf.',
  'shared.info.header.xRequestId.body1':
    'Nicht standardisiert, aber allgegenwärtig. Nützlich, um Client-Verhalten beim Debuggen mit Server-Logs zu ' +
    'korrelieren.',
  'shared.info.header.xFastlyRequestId.summary': 'Fastly-Anfragekennung — korreliere sie mit Fastly-Logs / -Debugging.',
  'shared.info.header.reportingEndpoints.summary':
    'Benennt Ziele für browsergenerierte Berichte (CSP-Verstöße, Deprecations, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Format: `name="https://reports.example.com", name2="https://..."`. Ersetzt den älteren `Report-To`-Header.',
  'shared.info.header.reportTo.summary':
    'Ältere JSON-basierte Deklaration der Berichtsendpunkte — von `Reporting-Endpoints` abgelöst.',
  'shared.info.header.nel.summary':
    'Network-Error-Logging-Policy — JSON-Konfiguration, die einen Endpunkt für Verbindungs- und ' +
    'Protokollfehler benennt.',
  'shared.info.header.nel.body1':
    'Der Endpunkt muss bereits über `Reporting-Endpoints` (oder das ältere `Report-To`) registriert sein.',
  'shared.info.header.cfRay.summary':
    'Cloudflare-Anfragekennung — dient der Korrelation der Anfrage in Cloudflare-Logs.',
  'shared.info.header.cfRay.body1':
    'Format: `<request-id>-<colo-id>`, wobei colo-id das Cloudflare-Rechenzentrum nennt, das die Anfrage ' +
    'bedient hat.',
} as const satisfies Catalog;
