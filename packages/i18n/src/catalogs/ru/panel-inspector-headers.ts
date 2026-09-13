/**
 * DevTools panel — inspector Headers tab — Russian. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, `A → Z` / `Train-Case`, and wire values stay raw.
 * Mints: предварительные заголовки = provisional headers (Chrome's ru
 * DevTools wording); шумовые заголовки = noise headers; Общие = the
 * General section; диапазоны = status ranges (numeric referent);
 * переменная для домена = per-domain variable; заголовок JWT = the
 * JWT header segment (distinct from HTTP-заголовок); утверждение =
 * JWT claim; Совпавшие правила = Matched Rules (carried); кракозябры
 * = mojibake (with искажённая кодировка as the prose gloss); multipart
 * rides raw (граница multipart). Expiry rides the истечение / истёк
 * family (shared-info-cookies mint); блокировать = block carried from
 * the shared register; Исходный = Raw carried. Every raw token takes a
 * head noun before a case ending (флаг `Secure`, заголовок `{name}`,
 * значение JWT).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail) ───────────────────────────────────
  'panel.inspector.headers.filterPlaceholder':
    'Фильтр — текст, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Фильтр заголовков',
  'panel.inspector.headers.footprintTitle': '{rules} — нажмите, чтобы открыть «Совпавшие правила»',

  // General section + the rule-creation CTAs on its summary.
  'panel.inspector.headers.generalSection': 'Общие',
  'panel.inspector.headers.createApiRequest': 'Создать API-запрос',
  'panel.inspector.headers.createApiRequestTitle':
    'Открыть этот запрос в API-клиенте Рабочей среды как заполненный черновик — ничего не сохраняется, пока вы не сохраните',
  'panel.inspector.headers.redirect.label': 'Перенаправить',
  'panel.inspector.headers.redirect.title':
    'Отправлять совпавшие запросы в другое место — выберите, как заполнить цель',
  'panel.inspector.headers.redirect.url': 'URL-адрес перенаправления…',
  'panel.inspector.headers.redirect.urlTitle':
    'Отправлять совпавшие запросы на другой URL-адрес — цель задаётся как переменная для домена',
  'panel.inspector.headers.redirect.replaceHost': 'Заменить хост…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'Сохранить путь и запрос, поменять хост — задаётся переменная хоста для домена',
  'panel.inspector.headers.redirect.localhost': 'Направить на localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Сохранить путь и запрос, отправлять на ваш локальный dev-сервер по http — задаётся переменная порта для домена',
  'panel.inspector.headers.overrideQueryParamsTitle': 'Добавить, заменить или удалить параметры запроса этого запроса',
  'panel.inspector.headers.more.label': 'Ещё',
  'panel.inspector.headers.more.title': 'Ещё действия с запросом',
  'panel.inspector.headers.more.delay': 'Задержать запрос',
  'panel.inspector.headers.more.delayTitle': 'Задержать этот запрос',
  'panel.inspector.headers.more.block': 'Блокировать запрос',
  'panel.inspector.headers.more.blockTitle': 'Блокировать / отменить этот запрос',

  // General rows.
  'panel.inspector.headers.general.requestUrl': 'URL запроса',
  'panel.inspector.headers.general.requestMethod': 'Метод запроса',
  'panel.inspector.headers.general.statusCode': 'Код статуса',
  'panel.inspector.headers.general.remoteAddress': 'Удалённый адрес',
  'panel.inspector.headers.general.httpVersion': 'Версия HTTP',
  'panel.inspector.headers.general.compression': 'Сжатие',
  'panel.inspector.headers.general.transferred': 'Передано',
  'panel.inspector.headers.general.referrerPolicy': 'Политика Referrer',
  'panel.inspector.headers.general.decodedSuffix': '(декодировано {size})',

  // General (i) corpus.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'Полный URL-адрес, по которому браузер выполнил запрос — схема, хост, путь и строка запроса.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'Использованный HTTP-метод (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'Числовой код ответа, возвращённый сервером.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Диапазоны',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Информационные (редко — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Успех.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'Перенаправление (смотрите заголовок `Location`).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    'Ошибка клиента — запрос неверно сформирован или не авторизован.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx': 'Ошибка сервера — сервер не смог выполнить корректный запрос.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary': 'IP-адрес и порт, куда запрос был фактически отправлен.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'Отличается от хоста в URL-адресе, когда DNS разрешается в несколько IP-адресов, CDN маршрутизирует через anycast или локальный прокси перехватывает соединение.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': 'Версия протокола HTTP, согласованная соединением.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'Выбирается при TLS через ALPN. Фактическое сетевое значение (например `h2`, `h3`) показано в подсказке, когда оно отличается от понятной метки.',
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'Текстовый, по умолчанию один запрос на соединение.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Двоичный, мультиплексированный по одному TCP-соединению.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'Построен на QUIC поверх UDP — более быстрые рукопожатия, лучшее восстановление после потерь.',
  'panel.inspector.headers.generalInfo.compression.summary':
    'Кодирование, которое сервер применил к телу ответа — браузер декодирует его, прежде чем показать JavaScript.',
  'panel.inspector.headers.generalInfo.compression.gzip': 'Поддерживается повсеместно, умеренная степень сжатия.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — степень сжатия лучше, чем у gzip; поддерживается всеми современными браузерами.',
  'panel.inspector.headers.generalInfo.compression.zstd':
    'Более новое сжатие с высокой степенью; поддержка браузерами растёт.',
  'panel.inspector.headers.generalInfo.compression.deflate': 'Устаревшее, сегодня используется редко.',
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Байты, фактически прошедшие по сети, включая накладные расходы сжатия.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'Декодированный размер в скобках — то, что видит JavaScript после распаковки тела браузером. Большая разница между ними — выигрыш от сжатия.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'Какую часть URL-адреса браузер отправляет в `Referer` при исходящих переходах и запросах с этой страницы.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Задаётся заголовком ответа `Referrer-Policy`, тегом `<meta name="referrer">` или для отдельного запроса атрибутом `referrerpolicy`.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'Показаны предварительные заголовки — ответ отдан из кеша, поэтому исходные отправленные заголовки не сохранены.',
  'panel.inspector.headers.provisional.bannerPending':
    'Показаны предварительные заголовки — сетевой набор ещё не подтверждён.',
  'panel.inspector.headers.provisional.title': 'Предварительные заголовки',
  'panel.inspector.headers.provisional.kicker': 'Запрос',
  'panel.inspector.headers.provisional.summary':
    'Это заголовки, которые браузер собрал и собирался отправить — не подтверждённый захват того, что прошло по сети. Сетевой набор может отличаться (сетевой стек позже добавляет cookie, учётные данные и заголовки соединения).',
  'panel.inspector.headers.provisional.whyHeading': 'Почему у запроса только предварительные заголовки',
  'panel.inspector.headers.provisional.cacheLabel': 'Отдан из кеша',
  'panel.inspector.headers.provisional.cacheDesc':
    'Ответ получен локально (кеш в памяти / на диске или сервис-воркер) — в этот раз в сеть ничего не отправлялось, поэтому исходные отправленные заголовки не сохранялись.',
  'panel.inspector.headers.provisional.blockedLabel': 'До сети не дошёл',
  'panel.inspector.headers.provisional.blockedDesc':
    'Заблокирован или сбойнул до завершения обмена заголовками (недопустимый URL-адрес, блокировка CORS/CSP, ошибка соединения).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Ещё в полёте',
  'panel.inspector.headers.provisional.inFlightDesc':
    'Сетевой набор ещё не сообщён; он определится, когда запрос завершится.',

  // Header sections.
  'panel.inspector.headers.section.responseHeaders': 'Заголовки ответа',
  'panel.inspector.headers.section.requestHeaders': 'Заголовки запроса',
  'panel.inspector.headers.section.countAria': 'число видимых заголовков',
  'panel.inspector.headers.section.addHeader': 'Добавить заголовок',
  'panel.inspector.headers.section.raw': 'Исходный',
  'panel.inspector.headers.section.rawTitle': 'Показать как простой текст (Name: Value)',
  'panel.inspector.headers.section.copy': 'Копировать',
  'panel.inspector.headers.section.copyAll': 'Копировать все',
  'panel.inspector.headers.section.copyFiltered': 'Копировать отфильтрованные',
  'panel.inspector.headers.section.copyCurl': 'Копировать как cURL',
  'panel.inspector.headers.section.copyFetch': 'Копировать как fetch',
  'panel.inspector.headers.section.noneCaptured': 'Ничего не захвачено.',
  'panel.inspector.headers.section.noFilterMatch': 'Ни один заголовок не подходит под фильтр.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Скрыт {count} шумовой заголовок — наведите курсор, чтобы увидеть имена',
      few: 'Скрыто {count} шумовых заголовка — наведите курсор, чтобы увидеть имена',
      many: 'Скрыто {count} шумовых заголовков — наведите курсор, чтобы увидеть имена',
      other: 'Скрыто {count} шумовых заголовков — наведите курсор, чтобы увидеть имена',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus.
  'panel.inspector.headers.moreFilters.label': 'Ещё фильтры',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Только изменённые правилами',
  'panel.inspector.headers.moreFilters.securityOnly': 'Только заголовки безопасности',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Только переопределяемые',
  'panel.inspector.headers.moreFilters.hideNoise': 'Скрыть шум (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'Вид',
  'panel.inspector.headers.view.layout': 'Компоновка',
  'panel.inspector.headers.view.layoutGrouped': 'Группами',
  'panel.inspector.headers.view.layoutFlat': 'Плоская',
  'panel.inspector.headers.view.sort': 'Сортировка',
  'panel.inspector.headers.view.sortOriginal': 'Исходный порядок',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Сначала изменённые правилами',
  'panel.inspector.headers.view.nameCase': 'Регистр имён',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Как есть (raw)',
  'panel.inspector.headers.view.showTags': 'Показывать теги',
  'panel.inspector.headers.view.showSuggestions': 'Показывать рекомендации',

  // Header rows.
  'panel.inspector.headers.row.expandValue': 'Развернуть значение',
  'panel.inspector.headers.row.collapseValue': 'Свернуть значение',
  'panel.inspector.headers.row.copyValue': 'Копировать значение',
  'panel.inspector.headers.row.copied': 'Скопировано',
  'panel.inspector.headers.row.edit': 'Изменить',
  'panel.inspector.headers.row.editTitle': 'Изменить правило, задавшее этот заголовок',
  'panel.inspector.headers.row.override': 'Переопределить',
  'panel.inspector.headers.row.overrideTitle': 'Создать правило для переопределения этого заголовка',
  'panel.inspector.headers.row.overrideProtectedTitle':
    'Заголовок {name} защищён — движок Declarative Net Request браузера не позволяет расширениям его переопределять. Среди защищённых имён: host, content-length, connection, sec-fetch-*, sec-ch-ua-*.',
  'panel.inspector.headers.row.overrideSystemTitle':
    'Заголовок {name} внедряет {feature} — системная функция Open Headers; правилом его не переопределить.',
  'panel.inspector.headers.row.overrideManagedTitle':
    'Заголовком {name} уже управляет одно из ваших правил — измените правило из его поповера вместо переопределения.',
  'panel.inspector.headers.row.systemTitle': 'Внедрён функцией {feature} (системная функция Open Headers)',
  'panel.inspector.headers.row.sinceFire.deleted': 'правило с тех пор удалено',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'Правило удалено после этого запроса — к будущим запросам оно не применится',
  'panel.inspector.headers.row.sinceFire.disabled': 'правило с тех пор выключено',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'Правило выключено после этого запроса — к будущим запросам оно не применится',
  'panel.inspector.headers.row.sinceFire.edited': 'правило с тех пор изменено',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'Правило изменено после этого запроса — текущее правило применяется только к будущим запросам',
  'panel.inspector.headers.row.sinceFire.value': 'переменная с тех пор изменилась',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'Переменная, на которую ссылается это правило, теперь разрешается в другое значение — применяется только к будущим запросам',

  // Value chips.
  'panel.inspector.headers.chips.expires': 'истекает {duration}',
  'panel.inspector.headers.chips.session': 'сеанс',
  'panel.inspector.headers.chips.missingFlag': 'нет {flag}',
  'panel.inspector.headers.chips.expired': 'истёк',

  // Chip (i) corpora.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Флаг Set-Cookie',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Cookie скрыт от JavaScript (его нельзя прочитать через `document.cookie`).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'Смягчает XSS — внедрённый скрипт больше не может украсть cookie. От CSRF не помогает.',
  'panel.inspector.headers.chipInfo.secure.summary':
    'Cookie отправляется только по HTTPS. Никогда не утекает по обычному HTTP.',
  'panel.inspector.headers.chipInfo.partitioned.summary': 'CHIPS — cookie разделён по сайтам верхнего уровня.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Каждый сайт верхнего уровня получает свою копию cookie, поэтому встроенные контексты не могут использовать cookie для отслеживания пользователя между сайтами.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie отправляется только с запросами внутри сайта. Самая сильная защита от CSRF — даже ссылки с другого сайта приходят без cookie.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie отправляется с запросами внутри сайта и при межсайтовой навигации верхнего уровня (клики по ссылкам). По умолчанию в современных браузерах.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie отправляется со всеми межсайтовыми запросами. Требует `Secure`. Используйте осознанно — получатели могут сопоставлять cookie между сайтами.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Срок действия Cookie',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary': 'Cookie уже истёк. Браузер не будет его отправлять.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Cookie истекает через {duration} (в {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Cookie без `Max-Age` или `Expires` — сеансовые и исчезают при закрытии браузера. Задайте один из них, чтобы сделать cookie постоянным.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Сеансовый cookie',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'Нет `Max-Age` или `Expires` — браузер отбрасывает этот cookie при закрытии.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Добавьте `Max-Age=<seconds>` или `Expires=<date>`, чтобы он сохранялся между сеансами браузера.',
  'panel.inspector.headers.chipInfo.missingFlag.title': 'Нет {flag}',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Лучшая практика',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Без `Secure` этот cookie может утечь по обычному HTTP. Всегда задавайте для cookie на HTTPS.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    'Без `HttpOnly` JavaScript может прочитать этот cookie через `document.cookie` — ошибка XSS его украдёт.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Без явного `SameSite` браузеры используют `Lax`. Задавайте явно, чтобы политика была очевидна при ревью кода.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'Большинство cookie в продакшене должны нести `Secure`, `HttpOnly` и явный `SameSite`.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Директива кеша',
  'panel.inspector.headers.chipInfo.rawValue': 'Исходное значение: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Активные директивы',
  'panel.inspector.headers.chipInfo.maxAge': 'Свежий в течение {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Свежесть в общем кеше: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'Разрешает использовать устаревший ответ в течение {duration}, пока идёт фоновая повторная проверка.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Параметр Content-Type',
  'panel.inspector.headers.chipInfo.charset.summary': 'Кодировка символов, используемая телом.',
  'panel.inspector.headers.chipInfo.charset.description':
    'Для типов `text/*` современные стеки по умолчанию используют `utf-8`. Неверные значения дают искажённую кодировку (кракозябры).',
  'panel.inspector.headers.chipInfo.boundary.title': 'Граница multipart',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'Токен, разделяющий части тела multipart (загрузка файлов, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description':
    'Генерируется клиентом; не должен встречаться внутри тела ни одной из частей.',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Политика безопасности',
  'panel.inspector.headers.chipInfo.hsts.summary':
    'Браузер будет использовать HTTPS для этого хоста в течение {duration}.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': 'Схема авторизации',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — тройка `<header>.<payload>.<signature>` в кодировке base64.',
  'panel.inspector.headers.chipInfo.jwt.description':
    'Подпись доказывает, что токен выдал владелец ключа подписи. Заголовок (alg, typ) и полезная нагрузка (утверждения) НЕ зашифрованы — они просто закодированы в base64 и читаемы кем угодно.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'Заголовок JWT',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'Утверждение JWT',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'Алгоритм подписи, объявленный в заголовке JWT.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Частые значения: `HS256` (HMAC-SHA256, симметричный), `RS256` (RSA, асимметричный), `ES256` (ECDSA). `none` (без подписи) валидаторы должны всегда отклонять.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT истёк',
  'panel.inspector.headers.chipInfo.jwtExpired.summary': 'Токен истёк {duration} назад. Сервер должен его отклонить.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT истекает через {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'Токен близок к истечению — обновите его или ждите 401 в ближайшее время.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'Время до наступления утверждения `exp` в JWT.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    'Непрозрачные учётные данные bearer (OAuth 2.0 / API-токен). Обращайтесь как с паролем — любой, у кого он есть, может аутентифицироваться как пользователь.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic auth — `base64(username:password)`. Безопасно только по HTTPS.',
  'panel.inspector.headers.chipInfo.scheme.other': 'Имя схемы аутентификации. Формат учётных данных зависит от схемы.',

  // Header insights (t-fed `computeHeaderInsights`).
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS настроен неверно',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` нельзя сочетать с учётными данными — браузер отклонит этот ответ.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Переопределить на {origin}',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'CORS-запрос без Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'Запрос нёс `Origin: {origin}`, но в ответе нет `Access-Control-Allow-Origin`. Браузер заблокирует ответ.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Добавить Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'У Cookie `{name}` нет `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': 'Нет `Secure` у cookie: {count}',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Cookie, установленные по HTTPS, должны нести `Secure`, чтобы их нельзя было отправить по обычному HTTP.',
  'panel.inspector.headers.insights.missingCsp.title': 'Нет Content-Security-Policy в HTML-ответе',
  'panel.inspector.headers.insights.missingCsp.action': 'Добавить базовую CSP',
  'panel.inspector.headers.insights.hstsShort.title': 'Очень короткий max-age в HSTS ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'Большинство политик рекомендуют не менее 6 месяцев; preload требует 1 год.',
  'panel.inspector.headers.insights.jwtExpired.title': 'JWT в заголовке Authorization истёк',
  'panel.inspector.headers.insights.jwtExpired.detail': 'Истёк {duration} назад.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT истекает через {duration}',
  'panel.inspector.headers.insights.missingContentType.title': 'В ответе нет Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': 'Добавить Content-Type',
} as const satisfies Catalog;
