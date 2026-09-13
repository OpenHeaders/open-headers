/**
 * Shared info-popover corpus — HTTP headers — Russian. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: источник = origin (the
 * web-platform referent — межсайтовый / cross-origin = между
 * источниками, carried from the panel files) vs исходный сервер =
 * origin server; preflight-запрос carried (hyphenated apposition);
 * директива carried from panel-inspector-headers; типичные значения =
 * common values; повторная проверка = revalidation carried; сниффинг =
 * sniffing; хотлинк = hotlink; краулер = crawler; граничный узел = edge
 * (the CDN tier, prose) with `Edge` standalone in en (Edge Side
 * Includes, Edge-to-origin, IE/Edge) riding raw and shield raw;
 * распределённая трассировка = distributed trace (трассировка стека
 * stays the console compound); псевдозаголовок = pseudo-header;
 * поэтапный = hop-by-hop (decided over между узлами); реестр carried
 * from info-status; хранилище cookie = cookie jar carried from the
 * shared register; учётные данные carried; согласование = negotiation;
 * подсказка клиента = Client Hint; свежесть = freshness; устаревший =
 * stale; шардинг never — the CDN tiers read уровни. Every raw header
 * name, value or protocol token takes a head noun or a hyphenated
 * apposition (значение ETag, заголовок `Referer`, HTTPS-соединение, в
 * HTTP/2 и новее, IP-адрес, JavaScript-код).
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'Заголовок запроса',
  'shared.info.header.direction.response': 'Заголовок ответа',
  'shared.info.header.direction.both': 'Заголовок запроса / ответа',
  'shared.info.header.section.directives': 'Директивы',
  'shared.info.header.section.commonValues': 'Типичные значения',
  'shared.info.header.fallback.customCategory': 'Пользовательский или нестандартный',
  'shared.info.header.fallback.customSummary':
    'Этот заголовок пользовательский или нестандартный — в нашем реестре нет документации.',
  'shared.info.header.fallback.unknownSummary':
    'Заголовок {name} ещё не описан в нашем реестре. Строка относит его к категории {category}.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Учётные данные, аутентифицирующие клиента перед сервером.',
  'shared.info.header.authorization.body1':
    'Формат: `<scheme> <credentials>`. Типичные схемы: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary': 'Учётные данные для промежуточного прокси (не исходного сервера).',
  'shared.info.header.proxyAuthorization.body1': 'Тот же синтаксис, что у `Authorization`, но другая область действия.',
  'shared.info.header.wwwAuthenticate.summary':
    'Вызов сервера при 401 — сообщает клиенту, какую схему аутентификации использовать.',
  'shared.info.header.wwwAuthenticate.body1':
    'Отправляется вместе с `401 Unauthorized`. При схеме `Basic` вызывает диалог базовой аутентификации браузера.',
  'shared.info.header.proxyAuthenticate.summary':
    'Прокси-эквивалент `WWW-Authenticate`, отправляется вместе с `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    'Завершает взаимную аутентификацию при успехе — Digest-аутентификация подтверждает им и сервер.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': 'Директивы, управляющие кешированием и повторной проверкой ответа.',
  'shared.info.header.cacheControl.body1':
    'Директивы несут и запрос, и ответ. Несколько токенов через запятую объединяются по И. Поведение задаётся по директивам — заголовок не является единым режимом.',
  'shared.info.header.cacheControl.directive.noStore': 'Не кешировать вообще, нигде.',
  'shared.info.header.cacheControl.directive.noCache':
    'Кешировать можно, но перед каждым повторным использованием проверять заново.',
  'shared.info.header.cacheControl.directive.public': 'Хранить может любой кеш, включая общие / CDN.',
  'shared.info.header.cacheControl.directive.private': 'Хранить может только браузер пользователя.',
  'shared.info.header.cacheControl.directive.maxAgeN':
    'Свежий N секунд; повторно использовать без обращения к источнику.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'Как max-age, но только для общих кешей.',
  'shared.info.header.cacheControl.directive.mustRevalidate':
    'После устаревания проверить заново, прежде чем отдавать.',
  'shared.info.header.cacheControl.directive.immutable': 'Обещание, что тело не изменится в течение max-age.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'Разрешить использовать устаревшую копию, пока идёт фоновая повторная проверка.',
  'shared.info.header.pragma.summary': 'Устаревшее управление кешем из HTTP/1.0 — фактически заменено Cache-Control.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` до сих пор ставят некоторые клиенты для совместимости. Современным серверам следует учитывать `Cache-Control` и игнорировать `Pragma`.',
  'shared.info.header.expires.summary': 'Абсолютная дата и время, после которых ответ считается устаревшим.',
  'shared.info.header.expires.body1':
    'Заменён `Cache-Control: max-age`. Если заданы оба, побеждает `max-age`. Дата в прошлом (или `0`) принудительно вызывает повторную загрузку.',
  'shared.info.header.etag.summary':
    'Непрозрачный идентификатор тела ответа — используется для повторной проверки кешированных копий.',
  'shared.info.header.etag.body1':
    'Клиенты возвращают его в `If-None-Match`. Если значение всё ещё совпадает, сервер отвечает `304 Not Modified` без тела.',
  'shared.info.header.ifMatch.summary':
    'Условный запрос: выполнять, только если текущее значение ETag ресурса совпадает.',
  'shared.info.header.ifMatch.body1':
    'Используется при записи, чтобы не перезаписать чужие изменения (оптимистичная конкурентность).',
  'shared.info.header.ifNoneMatch.summary': 'Условный запрос: выполнять, только если значение ETag ресурса изменилось.',
  'shared.info.header.ifNoneMatch.body1':
    'Используется при чтении, чтобы не скачивать неизменившийся ответ — сервер отвечает `304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Условный запрос: выполнять, только если ресурс изменился после указанной даты.',
  'shared.info.header.ifModifiedSince.body1':
    'Менее точен, чем `If-None-Match` / ETag; предпочитайте ETag, когда он доступен.',
  'shared.info.header.ifUnmodifiedSince.summary':
    'Условный запрос: выполнять, только если ресурс не менялся с указанной даты.',
  'shared.info.header.lastModified.summary': 'Дата и время последнего изменения ресурса.',
  'shared.info.header.lastModified.body1': 'В паре с `If-Modified-Since` служит для повторной проверки.',
  'shared.info.header.age.summary': 'Сколько секунд ответ пробыл в общем кеше.',
  'shared.info.header.age.body1': 'Возвращают CDN и прокси; помогает клиентам понять свежесть ответа.',
  'shared.info.header.xCache.summary':
    'Результат кеша CDN / обратного прокси — формат зависит от поставщика (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Отдано из кеша.',
  'shared.info.header.xCache.value.miss': 'Не кешировано; получено с исходного сервера.',
  'shared.info.header.xCache.value.hitHit': 'Попадание на всех уровнях кеша (например, shield + граничный узел).',
  'shared.info.header.xCacheHits.summary':
    'Счётчик попаданий в кеш по уровням — зависит от поставщика, типичен для Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Через запятую, когда задействовано несколько уровней кеша. Большие значения указывают на «горячие» записи кеша.',
  'shared.info.header.warning.summary':
    'Дополнительный контекст кеширования (устарел, применено преобразование и т. д.). Признан устаревшим в HTTP/1.1 начиная с RFC 7234, но всё ещё встречается.',
  'shared.info.header.surrogateControl.summary':
    'Управление кешем Edge Side Includes — направляет CDN, оставляя кеширование в браузере заголовку `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Только для кешей с поддержкой ESI (Fastly, Akamai, Varnish в некоторых конфигурациях).',
  'shared.info.header.surrogateCapability.summary':
    'Подсказка Edge-to-origin: какие возможности ESI поддерживает суррогат.',
  'shared.info.header.cfCacheStatus.summary': 'Результат кеша Cloudflare для этого запроса.',
  'shared.info.header.cfCacheStatus.value.hit': 'Отдано из кеша Cloudflare.',
  'shared.info.header.cfCacheStatus.value.miss': 'В кеше нет; получено с исходного сервера.',
  'shared.info.header.cfCacheStatus.value.expired': 'Было в кеше, но устарело; обновлено с исходного сервера.',
  'shared.info.header.cfCacheStatus.value.bypass': 'Кеш обойдён (правила страниц / заголовок no-cache).',
  'shared.info.header.cfCacheStatus.value.dynamic': 'По умолчанию не кешируется (cookie, строка запроса и т. д.).',
  'shared.info.header.cfCacheStatus.value.revalidated': 'В кеше и повторно проверено на исходном сервере (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Подсказка клиента: список брендов браузера.',
  'shared.info.header.secChUa.body1':
    'Заменяет свободный `User-Agent` в той части, на которую серверам действительно стоит полагаться.',
  'shared.info.header.secChUaMobile.summary': 'Подсказка клиента: `?1` на мобильных, `?0` на настольных.',
  'shared.info.header.secChUaPlatform.summary':
    'Подсказка клиента: ОС пользователя (`"Windows"`, `"macOS"`, `"Linux"` и т. д.).',
  'shared.info.header.userAgent.summary': 'Устаревшая свободная строка, идентифицирующая браузер, ОС и движок.',
  'shared.info.header.userAgent.body1':
    'По-прежнему отправляется с каждым запросом. Структурированная замена — семейство `Sec-CH-UA-*`; предпочитайте его, когда серверу важна идентичность браузера.',
  'shared.info.header.acceptCh.summary':
    'Перечисляет заголовки подсказок клиента, которые сервер хочет получать в последующих запросах.',
  'shared.info.header.acceptCh.body1':
    'Браузеры отправляют только те подсказки, на которые сервер здесь подписался (кроме низкоэнтропийных по умолчанию).',
  'shared.info.header.criticalCh.summary':
    'Подмножество `Accept-CH`, которое сервер считает критичным — браузеры перезапустят запрос, чтобы включить их.',
  'shared.info.header.criticalCh.body1':
    'Используйте экономно: каждый промах Critical-CH стоит одного кругового обмена.',
  'shared.info.header.saveData.summary': '`on`, когда пользователь включил режим экономии трафика в браузере / ОС.',
  'shared.info.header.saveData.body1':
    'Используйте, чтобы отдавать менее тяжёлые ресурсы (ниже качество изображений, отложить работу ниже линии сгиба и т. д.).',
  'shared.info.header.deviceMemory.summary':
    'Приблизительный объём ОЗУ устройства в GiB, округлённый до небольшого набора значений (`0.25`, `0.5`, `1`, `2`, `4`, `8`).',
  'shared.info.header.downlink.summary': 'Оценка нисходящей пропускной способности в Mbps, округлённая.',
  'shared.info.header.ect.summary': 'Эффективный тип соединения — `slow-2g`, `2g`, `3g` или `4g`.',
  'shared.info.header.rtt.summary': 'Оценка времени кругового обмена в миллисекундах, округлённая.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Поэтапное управление соединением (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Прокси убирают его между узлами. В HTTP/2 и новее этот заголовок запрещён — управление соединением встроено в протокол.',
  'shared.info.header.keepAlive.summary': 'Подсказки для пула соединений — обычно `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1':
    'Имеет смысл только вместе с `Connection: keep-alive` в HTTP/1.1. В HTTP/2 и новее игнорируется.',
  'shared.info.header.upgrade.summary':
    'Просит сменить протокол в том же соединении (WebSocket, HTTP/2 без шифрования).',
  'shared.info.header.upgrade.body1':
    'Используется вместе с `Connection: upgrade`. Для WebSocket: `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Транспортные кодировки, которые клиент готов принять (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1':
    'Большинство современных клиентов отправляют только `TE: trailers`, подписываясь на завершающие заголовки.',
  'shared.info.header.expect.summary': 'Предусловия на стороне сервера, которых ожидает клиент (`100-continue`).',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` позволяет клиенту отправить тело только после того, как сервер ответит `100 Continue`.',
  'shared.info.header.altSvc.summary':
    'Объявляет альтернативные способы достичь того же источника (например, HTTP/3 поверх QUIC).',
  'shared.info.header.altSvc.body1':
    'Браузеры кешируют объявление и могут переключиться на альтернативу для последующих запросов.',
  'shared.info.header.secWebsocketKey.summary':
    'Случайный nonce в кодировке base64, отправляемый при рукопожатии WebSocket.',
  'shared.info.header.secWebsocketKey.body1':
    'Сервер отвечает `Sec-WebSocket-Accept`, выведенным из этого ключа и фиксированного GUID, доказывая, что понимает WebSocket.',
  'shared.info.header.secWebsocketAccept.summary':
    'Доказательство сервера при рукопожатии WebSocket — `SHA-1(Sec-WebSocket-Key + GUID)` в кодировке base64.',
  'shared.info.header.secWebsocketVersion.summary':
    'Версия протокола WebSocket, которую запрашивает клиент. Почти всегда `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Согласование подпротокола WebSocket — список через запятую в запросе, одно выбранное значение в ответе.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Согласованные расширения WebSocket (сжатие и т. д.) — чаще всего `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Медиатип тела запроса или ответа.',
  'shared.info.header.contentType.body1':
    'Определяет, как браузер разбирает тело — неверные значения приводят к тихим сбоям (JSON разобран как HTML и т. д.).',
  'shared.info.header.contentType.body2':
    'Для типов `text/*` указывайте `charset=utf-8`, если нет причин поступить иначе.',
  'shared.info.header.contentType.value.applicationJson': 'JSON-тело.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'Поля формы в URL-кодировке.',
  'shared.info.header.contentType.value.multipartFormData': 'Составная форма / загрузка файлов.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML-документ.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Непрозрачные двоичные данные.',
  'shared.info.header.contentLength.summary': 'Размер тела в байтах (после декодирования).',
  'shared.info.header.contentLength.body1':
    'Взаимоисключающ с `Transfer-Encoding: chunked`. Неверные значения рассинхронизируют соединение.',
  'shared.info.header.contentEncoding.summary':
    'Сжатие, применённое к телу — браузер декодирует его, прежде чем показать JS.',
  'shared.info.header.contentEncoding.body1':
    'Типичные: `gzip`, `br` (Brotli), `zstd` (новее). `response.body` видит уже декодированный размер.',
  'shared.info.header.contentDisposition.summary': 'Сообщает браузеру, показывать ответ встроенно или скачивать.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (по умолчанию) отображается в браузере. `attachment; filename="x"` запускает скачивание с указанным именем файла по умолчанию.',
  'shared.info.header.accept.summary': 'Медиатипы, которые клиент готов получить.',
  'shared.info.header.accept.body1':
    'Q-значения выражают предпочтение (`text/html;q=0.9`). Большинство серверов сегодня учитывают только первый тип.',
  'shared.info.header.acceptEncoding.summary': 'Сжатия, которые клиент умеет декодировать.',
  'shared.info.header.acceptEncoding.body1':
    'Типичное значение браузера: `gzip, deflate, br, zstd`. Сервер выбирает одно и отвечает через `Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Языки, которые предпочитает клиент.',
  'shared.info.header.acceptLanguage.body1':
    'Сервер выбирает `Content-Language` из этого списка, часто откатываясь к значению по умолчанию.',
  'shared.info.header.transferEncoding.summary':
    'Кодировка только для передачи — снимается до того, как тело дойдёт до приложения.',
  'shared.info.header.transferEncoding.body1': 'Почти всегда `chunked`. Взаимоисключающ с `Content-Length`.',
  'shared.info.header.range.summary': 'Запрашивает диапазон байтов ресурса вместо всего тела.',
  'shared.info.header.range.body1':
    'Формат: `bytes=<start>-<end>` (включительно). Сервер отвечает `206 Partial Content` и `Content-Range`.',
  'shared.info.header.contentRange.summary': 'Указывает, какой диапазон байтов ресурса содержится в теле.',
  'shared.info.header.contentRange.body1':
    'Формат: `bytes <start>-<end>/<total>`. Возвращается вместе с `206 Partial Content`.',
  'shared.info.header.acceptRanges.summary':
    'Сообщает клиенту, поддерживаются ли запросы диапазонов (`bytes`) или нет (`none`).',
  'shared.info.header.contentMd5.summary':
    'MD5-дайджест тела в кодировке Base64 для проверки целостности. Устарел в HTTP/1.1 (RFC 7231), но некоторые серверы всё ещё его отправляют.',
  'shared.info.header.contentMd5.body1':
    'Современная проверка целостности делается через `Digest` / `Want-Digest` или средствами самого TLS.',
  'shared.info.header.contentLanguage.summary': 'Естественный язык (или языки) тела ответа.',
  'shared.info.header.contentLanguage.body1':
    'Согласуется с `Accept-Language` запроса. Значения — теги BCP-47 (`en-US`, `de-DE` и т. д.).',
  'shared.info.header.contentLocation.summary':
    'Альтернативный URL-адрес, однозначно идентифицирующий сущность в этом ответе.',
  'shared.info.header.contentLocation.body1':
    'Отличается от `Location`: `Content-Location` описывает полученный ресурс, а не адрес перенаправления.',
  'shared.info.header.acceptCharset.summary':
    'Кодировки символов, которые принимает клиент. Устарел — современные браузеры всегда отправляют UTF-8 и этот заголовок не шлют.',
  'shared.info.header.acceptCharset.body1': 'Большинство серверов могут спокойно его игнорировать.',
  'shared.info.header.ifRange.summary':
    'Условный запрос диапазона: отдать диапазон, только если ресурс всё ещё соответствует указанному ETag или дате.',
  'shared.info.header.ifRange.body1':
    'Если ресурс изменился, сервер возвращает полное тело с `200 OK` вместо `206 Partial Content`.',
  'shared.info.header.trailer.summary':
    'Объявляет, какие имена полей заголовков появятся в трейлере после тела по частям.',
  'shared.info.header.trailer.body1':
    'Имеет смысл только с `Transfer-Encoding: chunked`. Клиент должен подписаться через `TE: trailers`.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary':
    'Файлы cookie, которые браузер отправляет с этим запросом, через точку с запятой.',
  'shared.info.header.cookie.body1':
    "Заполняется браузером из его хранилища cookie. Нельзя задать из JS напрямую в `fetch` — используйте `credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Определение cookie, выданное сервером.',
  'shared.info.header.setCookie.body1':
    'Один cookie на строку заголовка `Set-Cookie`. Браузеры хранят последнее значение для каждой тройки (имя, домен, путь).',
  'shared.info.header.setCookie.body2':
    'Боевые cookie всегда должны нести `Secure`, `HttpOnly` и явный `SameSite` (Lax или Strict).',
  'shared.info.header.setCookie.directive.secure': 'Отправляется только по HTTPS.',
  'shared.info.header.setCookie.directive.httpOnly': 'Скрыт от JavaScript (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    'Политика межсайтовой отправки. `None` требует `Secure`.',
  'shared.info.header.setCookie.directive.domainHost': 'Отправлять этому хосту и всем его поддоменам.',
  'shared.info.header.setCookie.directive.pathPath': 'Отправлять только на URL-адреса, начинающиеся с этого пути.',
  'shared.info.header.setCookie.directive.maxAgeN': 'Время жизни в секундах (перекрывает Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Абсолютный срок; без него — сеансовый cookie.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — разделён по сайту верхнего уровня.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary':
    'Сообщает браузеру, каким источникам разрешено читать этот ответ.',
  'shared.info.header.accessControlAllowOrigin.body1':
    'Ставится сервером в ответе. Браузер сравнивает его с заголовком `Origin` запроса и не даёт JavaScript прочитать тело, если они не совпадают.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` принимает любой источник, но несовместим с учётными данными — если запрос несёт cookie или авторизацию, ответ должен вместо этого повторить точный источник запроса.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'Читать может любой источник (без учётных данных).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': 'Читать может только названный источник.',
  'shared.info.header.accessControlAllowCredentials.summary':
    'Разрешает браузеру раскрыть ответ, когда запрос нёс учётные данные.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Должен быть `true` (строчными). Когда задан, `Access-Control-Allow-Origin` НЕ должен быть `*` — он обязан повторить точный источник.',
  'shared.info.header.accessControlAllowMethods.summary':
    'Перечисляет HTTP-методы, которые сервер принимает для запросов между источниками.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Возвращается в ответах на preflight-запросы (`OPTIONS`). Браузер кеширует ответ на `Access-Control-Max-Age` секунд.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Перечисляет заголовки запроса, которые сервер принимает в запросах между источниками.',
  'shared.info.header.accessControlAllowHeaders.body1':
    'Требуется, когда браузер делает preflight-запрос для непростых заголовков (всё, что сверх `Accept`, `Accept-Language`, `Content-Language` и простых значений `Content-Type`).',
  'shared.info.header.accessControlExposeHeaders.summary':
    'Перечисляет заголовки ответа, которые разрешено читать JavaScript.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'По умолчанию JS видит только безопасные для CORS заголовки ответа (`Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Любой другой заголовок нужно назвать здесь, чтобы `response.headers.get(...)` его вернул.',
  'shared.info.header.accessControlMaxAge.summary':
    'Сколько секунд браузер может кешировать ответ на preflight-запрос.',
  'shared.info.header.accessControlMaxAge.body1':
    'Большие значения сокращают preflight-трафик — распространено значение 86400 (1 день). Chrome ограничивает 7200 секундами, Firefox — 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Отправляется в preflight-запросе, чтобы объявить метод, который использует настоящий запрос.',
  'shared.info.header.accessControlRequestMethod.body1':
    'Сервер отвечает `Access-Control-Allow-Methods` для подтверждения.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Отправляется в preflight-запросе, чтобы объявить заголовки, которые понесёт настоящий запрос.',
  'shared.info.header.accessControlRequestHeaders.body1':
    'Если принято, отражается обратно через `Access-Control-Allow-Headers`.',
  'shared.info.header.origin.summary':
    'Идентифицирует источник, инициировавший запрос между источниками или POST-запрос.',
  'shared.info.header.origin.body1':
    'Отправляется браузером автоматически. Нельзя задать из JS. Серверы используют его для решений по CORS, а защита от CSRF — как сигнал.',
  'shared.info.header.vary.summary':
    'Сообщает кешам, какие заголовки запроса влияют на ответ, чтобы они варьировали ключ кеша.',
  'shared.info.header.vary.body1':
    'Критично для CORS: указывайте `Vary: Origin` всякий раз, когда `Access-Control-Allow-Origin` вычисляется из источника запроса, иначе кеш отдаст ответ одного источника другому.',
  'shared.info.header.timingAllowOrigin.summary':
    'Позволяет чужим источникам читать подробные метрики времени (`PerformanceResourceTiming`) для этого ресурса.',
  'shared.info.header.timingAllowOrigin.body1':
    'Без этого заголовка ресурсы из других источников раскрывают только грубые показатели времени.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': 'Ставит браузер: отношение между инициатором запроса и целью.',
  'shared.info.header.secFetchSite.body1':
    'Значения: `same-origin`, `same-site`, `cross-site`, `none` (прямая навигация).',
  'shared.info.header.secFetchMode.summary': 'Ставит браузер: режим fetch запроса.',
  'shared.info.header.secFetchMode.body1': 'Значения: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Ставит браузер: где будет использован ответ (документ, скрипт, изображение и т. д.).',
  'shared.info.header.secFetchDest.body1':
    'Позволяет серверу замечать неожиданные загрузки — например, HTML-ответ, запрошенный как `Sec-Fetch-Dest: script`.',
  'shared.info.header.secFetchUser.summary':
    'Ставит браузер: `?1`, когда навигация была прямым действием пользователя.',
  'shared.info.header.secFetchUser.body1':
    'Иначе отсутствует. Полезно, чтобы отличать клики пользователя от программной навигации.',
  'shared.info.header.secPurpose.summary':
    'Ставит браузер, когда запрос спекулятивный — например, `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    'Позволяет серверу пропустить побочные эффекты (аналитику, журналы записи) для загрузок, которые пользователь ещё не запросил.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'Сообщает серверу (или клиенту), насколько срочна и насколько инкрементальна эта передача.',
  'shared.info.header.priority.body1':
    'Формат: `u=<0-7>` (срочность, меньше = выше приоритет) и необязательное `, i` (инкрементально — можно обрабатывать по мере поступления).',
  'shared.info.header.upgradeInsecureRequests.summary':
    'Ставит браузер `1` — сообщает серверу, что клиент предпочитает HTTPS для всех встроенных ресурсов.',
  'shared.info.header.upgradeInsecureRequests.body1': 'В паре с CSP-директивой `upgrade-insecure-requests` в ответах.',
  'shared.info.header.earlyData.summary': '`1` — ставят клиенты, отправляющие данные в режиме 0-RTT TLS 1.3.',
  'shared.info.header.earlyData.body1':
    'Серверам следует отклонять ранние данные для неидемпотентных методов (POST и т. д.), чтобы избежать атак повторного воспроизведения.',
  'shared.info.header.link.summary': 'Подсказки о ресурсах — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Та же семантика, что у `<link rel="...">` в HTML; полезно в ответах не-HTML (API, перенаправления).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Предзагрузить таблицу стилей.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': 'Заранее открыть соединение.',
  'shared.info.header.xDnsPrefetchControl.summary':
    'Переключает предварительное разрешение DNS для ссылок на странице (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary':
    'Do Not Track — `1`, если пользователь отказался от отслеживания. В основном устарел.',
  'shared.info.header.dnt.body1':
    'Большинство крупных сайтов его игнорируют; W3C отказался от спецификации в 2019 году. Соблюдение добровольное.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control — `1` означает, что пользователь не хочет, чтобы его данные продавали или передавали.',
  'shared.info.header.secGpc.body1':
    'Юридически обязателен по CCPA в Калифорнии; соблюдается некоторыми браузерами с упором на приватность (Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Перечисляет прокси / шлюзы, через которые прошло сообщение.',
  'shared.info.header.via.body1':
    'Каждый прокси добавляет свой идентификатор, чтобы цепочку можно было восстановить при отладке.',
  'shared.info.header.xForwardedFor.summary':
    'Нестандартный, но повсеместный: цепочка IP-адресов клиента через прокси, через запятую.',
  'shared.info.header.xForwardedFor.body1':
    'Крайняя левая запись — исходный клиент. Стандартизированная альтернатива — заголовок `Forwarded` из RFC 7239.',
  'shared.info.header.xForwardedProto.summary':
    'Исходная схема (`http` или `https`), по которой клиент достиг первого прокси.',
  'shared.info.header.xForwardedHost.summary':
    'Исходный заголовок `Host`, отправленный клиентом до того, как прокси его переписал.',
  'shared.info.header.xRealIp.summary':
    'Исходный IP-адрес клиента, каким его увидел первый прокси. Одно значение, не цепочка.',
  'shared.info.header.forwarded.summary':
    'Стандартизированная в RFC 7239 цепочка прокси — заменяет семейство `X-Forwarded-*`.',
  'shared.info.header.forwarded.body1':
    'Формат: `for=client; proto=https; by=proxy; host=original-host`. Несколько прокси разделяются запятыми.',
  'shared.info.header.trueClientIp.summary':
    'Исходный IP-адрес клиента, переданный Akamai / Cloudflare Enterprise — одно значение, не цепочка.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'Псевдозаголовок HTTP/2 и новее — эквивалент `Host` в HTTP/1.1. Идентифицирует целевой сервер.',
  'shared.info.header.authority.body1':
    'Псевдозаголовки начинаются с `:` и должны идти перед обычными заголовками. Их ставит браузер; JavaScript не может.',
  'shared.info.header.method.summary': 'Псевдозаголовок HTTP/2 и новее — метод запроса (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'Псевдозаголовок HTTP/2 и новее — путь запроса + строка запроса.',
  'shared.info.header.scheme.summary': 'Псевдозаголовок HTTP/2 и новее — `https` или `http`.',
  'shared.info.header.status.summary': 'Псевдозаголовок HTTP/2 и новее — числовой статус ответа (например, `200`).',
  'shared.info.header.status.body1': 'В HTTP/2 и HTTP/3 псевдозаголовки заменяют строку статуса HTTP/1.1.',
  'shared.info.header.host.summary':
    'Целевой хост HTTP/1.1 (и необязательный порт). В HTTP/2 и новее заменён на `:authority`.',
  'shared.info.header.host.body1':
    'Обязателен в каждом запросе HTTP/1.1. Серверы маршрутизируют по нему между виртуальными хостами на одном IP-адресе.',
  'shared.info.header.location.summary':
    'Цель перенаправления — отправляется с ответами `3xx` или как результат созданного ресурса.',
  'shared.info.header.location.body1':
    'Абсолютные URL-адреса учитываются повсеместно; относительные разрешаются относительно URL-адреса запроса.',
  'shared.info.header.allow.summary': 'Перечисляет HTTP-методы, которые принимает ресурс.',
  'shared.info.header.allow.body1':
    'Обязателен в ответе `405 Method Not Allowed`. Типичные значения: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': 'URL-адрес страницы, инициировавшей этот запрос.',
  'shared.info.header.referer.body1':
    'Обратите внимание на историческую опечатку — спецификация её сохраняет. Некоторые адресаты убирают или урезают `Referer` согласно `Referrer-Policy` страницы.',
  'shared.info.header.retryAfter.summary':
    'Сообщает клиенту, когда повторить — секунды (дельта) или абсолютная HTTP-дата.',
  'shared.info.header.retryAfter.body1':
    'Типичен для `503 Service Unavailable` и `429 Too Many Requests`. Краулеры его соблюдают.',
  'shared.info.header.maxForwards.summary':
    'Ограничивает число прокси, которые могут переслать запрос `TRACE` или `OPTIONS`.',
  'shared.info.header.maxForwards.body1':
    'Каждый пересылающий прокси уменьшает его на единицу. Дошло до 0 → прокси отвечает сам.',
  'shared.info.header.serviceWorker.summary':
    'Ставит браузер `script`, когда запрос загружает файл скрипта сервис-воркера.',
  'shared.info.header.serviceWorker.body1':
    'Позволяет серверам распознавать загрузки при регистрации SW и отвечать правильным заголовком `Service-Worker-Allowed`.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Переопределяет ограничение по пути, действующее по умолчанию для области сервис-воркера.',
  'shared.info.header.serviceWorkerAllowed.body1':
    'По умолчанию воркер может управлять только своим каталогом и вложенными. Этот заголовок позволяет расширить область — например, управлять `/` из воркера по адресу `/sw.js`.',
  'shared.info.header.protocol.summary':
    'Псевдозаголовок механизма Extended CONNECT (RFC 8441) — используется для WebSocket поверх HTTP/2 / 3.',
  'shared.info.header.protocol.body1': 'Равен `websocket`, когда клиент туннелирует WebSocket через HTTP/2 или HTTP/3.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Белый список источников, из которых страница может загружать ресурсы или выполнять код.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Директивы разделяются пробелами, между директивами — точка с запятой. Большинству приложений нужны как минимум `default-src`, `script-src`, `style-src` и `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Используйте `Content-Security-Policy-Report-Only`, чтобы наблюдать нарушения до принудительного применения.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc': 'Запасной вариант для любой -src, не заданной явно.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc':
    'Разрешённые источники для `<script>` и встроенного JS.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc':
    'Разрешённые источники для таблиц стилей и встроенного CSS.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': 'Разрешённые источники изображений.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Разрешённые цели для fetch / XHR / WebSocket.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Кто может встраивать эту страницу в iframe (заменяет X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo':
    'Куда отправлять отчёты о нарушениях методом POST.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Тот же синтаксис, что у CSP, но о нарушениях сообщается без блокировки.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Используйте, чтобы проверить политику в бою до принудительного применения.',
  'shared.info.header.strictTransportSecurity.summary':
    'Заставляет браузер использовать HTTPS для этого хоста в течение заданного срока.',
  'shared.info.header.strictTransportSecurity.body1':
    'В бою задавайте `max-age` не меньше 6 месяцев. Добавьте `includeSubDomains`, чтобы охватить все хосты домена.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` позволяет подать домен во встроенный в браузеры список предзагрузки HSTS (решение в одну сторону — откатить трудно).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'Сколько браузер помнит режим «только HTTPS».',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Применять к каждому поддомену.',
  'shared.info.header.strictTransportSecurity.directive.preload': 'Право на включение в список предзагрузки браузера.',
  'shared.info.header.xContentTypeOptions.summary': 'Отключает сниффинг MIME.',
  'shared.info.header.xContentTypeOptions.body1':
    'Единственное допустимое значение: `nosniff`. Рекомендуется в каждом ответе — не даёт выполнить JS, отданный как `text/plain`.',
  'shared.info.header.xFrameOptions.summary': 'Определяет, можно ли встраивать страницу в iframe.',
  'shared.info.header.xFrameOptions.body1':
    'В основном заменён `Content-Security-Policy: frame-ancestors`. На время перехода держите оба ради старых браузеров.',
  'shared.info.header.xFrameOptions.value.deny': 'Встраивать нельзя никогда.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Встраивать могут только страницы того же источника.',
  'shared.info.header.xXssProtection.summary':
    'Устаревший переключатель XSS-фильтра — в современных браузерах не действует.',
  'shared.info.header.xXssProtection.body1':
    'Рекомендуемое значение — `0`, отключающее фильтр (он приносил больше вреда, чем пользы). Вместо него используйте CSP.',
  'shared.info.header.referrerPolicy.summary':
    'Определяет, какая часть URL-адреса отправляется в `Referer` при исходящих навигациях и запросах.',
  'shared.info.header.referrerPolicy.body1':
    'Отправляется адресатом как заголовок ответа либо задаётся для страницы через `<meta>` / для запроса через атрибут `referrerpolicy`.',
  'shared.info.header.referrerPolicy.value.noReferrer': 'Никогда не отправлять referer.',
  'shared.info.header.referrerPolicy.value.origin': 'Отправлять только схему + хост.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'По умолчанию — полный URL-адрес в том же источнике, только источник между источниками, ничего при понижении HTTPS→HTTP.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': 'Всегда отправлять полный URL-адрес. Избегайте.',
  'shared.info.header.permissionsPolicy.summary':
    'Список разрешённых возможностей браузера (геолокация, камера, USB, платежи и т. д.).',
  'shared.info.header.permissionsPolicy.body1':
    'Каждая возможность ограничена `self`, списком источников или `*`. Заменяет более старый заголовок `Feature-Policy`.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'Изолирует страницу от связей с открывшими её другими источниками (window.opener).',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` включает режим crossOriginIsolated — он нужен для SharedArrayBuffer и таймеров высокого разрешения.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Требует, чтобы каждый загружаемый подресурс явно разрешил доступ из другого источника.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Для crossOriginIsolated задайте `require-corp`. В паре с `Cross-Origin-Opener-Policy: same-origin`.',
  'shared.info.header.crossOriginResourcePolicy.summary': 'Не даёт чужим источникам загружать ресурс.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Значения: `same-site`, `same-origin`, `cross-origin`. Критично для ресурсов, которые вы не хотите отдавать по хотлинку.',
  'shared.info.header.clearSiteData.summary': 'Просит браузер очистить cookie / кеш / хранилище для этого источника.',
  'shared.info.header.clearSiteData.body1': 'Полезно при выходе из учётной записи.',
  'shared.info.header.clearSiteData.value.cookies': 'Очистить cookie источника.',
  'shared.info.header.clearSiteData.value.cache': 'Очистить HTTP-кеш и кеш изображений.',
  'shared.info.header.clearSiteData.value.storage': 'Очистить localStorage / IndexedDB / регистрации сервис-воркеров.',
  'shared.info.header.clearSiteData.value.wildcard': 'Очистить всё.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` просит браузер выделить этому источнику собственный кластер агентов (процесс).',
  'shared.info.header.originAgentCluster.body1':
    'Даёт лучшую изоляцию для `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory и т. д.',
  'shared.info.header.xRobotsTag.summary': 'Директивы индексирования для краулеров (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    'Та же семантика, что у тега `<meta name="robots">`, но применяется к ответам не-HTML (PDF, JSON, изображения).',
  'shared.info.header.xUaCompatible.summary':
    'Устаревшая директива IE/Edge (`IE=edge`) — выбирает движок рендеринга. В современных браузерах не действует.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary': 'Идентификация ПО исходного сервера (например, `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1': 'В бою часто убирается или заменяется фиксированным значением ради безопасности.',
  'shared.info.header.xPoweredBy.summary':
    'Нестандартный заголовок, называющий фреймворк / среду выполнения за ответом.',
  'shared.info.header.xPoweredBy.body1': 'Часто отправляют Express, PHP, ASP.NET и т. д. В бою обычно подавляется.',
  'shared.info.header.date.summary': 'Метка времени исходного сервера на момент формирования сообщения.',
  'shared.info.header.date.body1':
    'Кеши используют его для вычисления возраста ответа. Формат: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Указывает, какой граничный узел / узел кеша CDN отдал ответ.',
  'shared.info.header.xServedBy.body1':
    'Через запятую, когда запрос обработали несколько уровней (shield → граничный узел). Формат зависит от поставщика (POP Fastly, граничные узлы AWS CloudFront и т. д.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Метрики производительности, которые сервер прикрепляет к ответу.',
  'shared.info.header.serverTiming.body1':
    'Показываются в DevTools и через JS-API `PerformanceServerTiming`. Формат: `<name>;dur=<ms>[;desc="..."]`, через запятую.',
  'shared.info.header.traceparent.summary': 'W3C trace-context: идентифицирует span в распределённой трассировке.',
  'shared.info.header.traceparent.body1':
    'Формат: `<version>-<trace-id>-<parent-id>-<flags>`. Передаётся между сервисами, чтобы трассировки можно было собрать заново.',
  'shared.info.header.tracestate.summary': 'Спутник `traceparent` в trace-context с данными поставщика.',
  'shared.info.header.tracestate.body1':
    'Пары `vendor=value` через запятую. Каждый поставщик трассировки хранит здесь своё состояние.',
  'shared.info.header.xRequestId.summary':
    'Назначенный сервером идентификатор этого запроса — повторяется в журналах и между сервисами.',
  'shared.info.header.xRequestId.body1':
    'Нестандартный, но повсеместный. Полезен, чтобы при отладке сопоставлять поведение клиента с журналами сервера.',
  'shared.info.header.xFastlyRequestId.summary':
    'Идентификатор запроса Fastly — для сопоставления с журналами / отладкой Fastly.',
  'shared.info.header.reportingEndpoints.summary':
    'Называет адресатов для отчётов, формируемых браузером (нарушения CSP, устаревшие API, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Формат: `name="https://reports.example.com", name2="https://..."`. Заменяет более старый заголовок `Report-To`.',
  'shared.info.header.reportTo.summary':
    'Более старое объявление конечной точки отчётов на JSON — заменено `Reporting-Endpoints`.',
  'shared.info.header.nel.summary':
    'Политика Network Error Logging — JSON-конфигурация, называющая конечную точку для сбоев соединения и ошибок протокола.',
  'shared.info.header.nel.body1':
    'Конечная точка уже должна быть зарегистрирована через `Reporting-Endpoints` (или более старый `Report-To`).',
  'shared.info.header.cfRay.summary':
    'Идентификатор запроса Cloudflare — для сопоставления запроса в журналах Cloudflare.',
  'shared.info.header.cfRay.body1':
    'Формат: `<request-id>-<colo-id>`, где colo-id указывает дата-центр Cloudflare, отдавший запрос.',
} as const satisfies Catalog;
