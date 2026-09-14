/**
 * Workbench editors — the API request editor — Russian. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key. Raw by
 * design: HTTP methods, header names, MIME types, auth scheme names
 * (Basic Auth / Bearer Token / OAuth 2.0 / Digest Auth / Hawk
 * Authentication / JWT Bearer / HTTP Message Signature …), OAuth /
 * PKCE / JWT parameter names (code_verifier, kid, alg, iat / exp …),
 * the `<calculated…>` placeholders, the phase tokens DNS / TCP / TLS /
 * TTFB, `{{ns.NAME}}` refs and every example value. Quoted verbatim
 * from the shipped ru files: the editor tab family (Авторизация /
 * Заголовки / Тело / Скрипты / Настройки; `Docs` / `Params` raw — the
 * S109 tab-noun decision), Наследовать = Inherit, Отправить = Send,
 * Наследовать от родителя / API-ключ / Bearer Token (the chrome
 * apiRequests rows), the settings-knob scalar twins from
 * `shared-conflicts.ts` (every wired knob label in the Settings tab IS
 * the twin: Минимальная версия TLS / Максимальная версия TLS / Наборы
 * шифров TLS / Имя сервера SNI / Версия HTTP / Разрешать в адрес /
 * Клиентский сертификат / URL-адрес прокси / Учётные данные прокси /
 * Сокет Unix / Хранилище Cookie / Тайм-аут запроса / Предел размера
 * ответа / Максимум перенаправлений / Сохранять исходный HTTP-метод /
 * Сохранять заголовок Authorization / Следовать перенаправлениям /
 * Скрипт перед запросом / Скрипт после ответа; Проверка
 * SSL-сертификата keeps en's extra noun over the bare twin), «Копировать
 * как cURL» / «Копировать как fetch» (panel-network), Проверки = test
 * assertions (the session-pane mint — the response tab reads Проверки /
 * `Проверки (пройдено: {count})`), Перед запросом / После ответа
 * (graphql), Библиотека пакетов, Предустановка, установление соединения
 * = dial, heartbeat-кадры, простой = idle, переподключение, трейлер,
 * Hex-просмотрщик, Предпросмотр, Форматировать = the prettify action,
 * Доверять сертификату, Открыть в новой вкладке, Сохранить ответ /
 * Создать рабочий процесс, Экспоненциальная задержка = backoff,
 * Тайм-аут простоя, Рукопожатие TLS prose, закрытый ключ / издатель /
 * утверждение = claim (panel-inspector-headers), полезная нагрузка =
 * payload, the Настройки › API-запросы › TLS path. MINTS: Безопасный
 * режим / Режим разработчика = the script execution modes; нижний
 * предел TLS = TLS floor (верхний предел carried); песочница = sandbox;
 * подпись / подписание = signature / signing; Область подписи = the
 * Coverage group; подписываемые компоненты = covered components;
 * Доставка = the Delivery group; челлендж = challenge (вызов stays the
 * gRPC call); грант = the OAuth grant (выдать доступ stays the
 * server grant — S19); потребитель = consumer; ПРОЙДЕН / ПРОВАЛЕН =
 * the PASS / FAIL pills (caps kept); утверждение клиента = the OAuth
 * / JWT client assertion (S19 split beside проверка = test assertion);
 * передаётся = rides (никогда не передаётся = never rides); Ожидание
 * соединения = Stalled in the phase ladder (the panel-network rung
 * stays raw) beside DNS-запрос / TCP-соединение / TLS-рукопожатие /
 * Ожидание (TTFB) / Загрузка содержимого; токен доступа / токен
 * обновления (nouns) vs обновить = refresh (verb) vs «Обновить сейчас»
 * = the button; Отключить = Disconnect; URL-адрес обратного вызова =
 * callback URL; авторизация устройства; Обнаружить = Discover;
 * обрезано = truncated; Предпросмотр / Правка = the Docs tab modes;
 * Привязать к существующему рабочему процессу; переходов: {count} /
 * 20 переходов = redirect hops; Хранилище Cookie for en-capitalized
 * `Cookie jar` (response meta + the jar info title) vs хранилище cookie
 * in prose (`Use cookie jar` → Использовать хранилище cookie); the
 * `Cookies` group and tab labels read Файлы cookie (`Cookies` is not a
 * glossary hit — the boundary); lowercase-en `vault` rides RAW (записи
 * vault, покидают vault) — the S100 case trap. Browser interstitial
 * paths quote the browsers' own ru UI (Chrome «Дополнительные» →
 * «Перейти на сайт (небезопасно)», Firefox «Дополнительно…» → «Принять
 * риск и продолжить»). Render sites: `OAuth2AuthEditor.tsx` joins the
 * callback-tip fragments with spaces except `callbackTipAfterApi` (no
 * space after the code chip) → it opens `. Идентификатор расширения
 * …`; `queryWarningBefore` ends on «заголовок по умолчанию» so the
 * `Authorization: Bearer` chip reads as the modified head and
 * `queryWarningAfter` opens with a bare clause; `storedFootnoteAfter`
 * opens with `.`; `RequestUrlBar.tsx` joins `<strong>{q}</strong>
 * {forbiddenSuffix}` with a space → «нельзя отправить из браузера.»;
 * `usePrefix` = «Использовать:»-style bare verb. Case-ending law: raw
 * tokens take a hyphenated apposition (URL-адрес, JWT-токен, API-ключ,
 * HTTP-метод, TLS-рукопожатие, DNS-запрос, TCP-соединение, PAC-скрипт,
 * SOCKS5-прокси) or a head noun (схема Bearer, заголовок Cookie, токен
 * DPoP, метод POST, ответ 401, версия TLS 1.2).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Запрос не найден.',
  'workbench.editors.request.loading': 'Загрузка запроса…',
  'workbench.editors.request.toast.deletedOtherTab': 'Запрос был удалён из другой вкладки',
  'workbench.editors.request.toast.updateFailed': 'Не удалось обновить запрос',
  'workbench.editors.request.toast.updateFailedDetail': 'Не удалось обновить запрос: {message}',
  'workbench.editors.request.toast.invalidSetting':
    'Недопустимое значение поля {label} — исправьте его на вкладке «Настройки» перед сохранением.',
  'workbench.editors.request.toast.savedExample': 'Пример «{name}» сохранён',
  'workbench.editors.request.toast.saveExampleFailed': 'Не удалось сохранить пример',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'Не удалось сохранить пример: {message}',
  'workbench.editors.request.send.label': 'Отправить',
  'workbench.editors.request.send.sending': 'Отправка…',
  'workbench.editors.request.send.unresolvedTooltip':
    'В запросе есть неразрешённые переменные. Перед отправкой определите их в vault, окружении, коллекции, рабочем пространстве или рабочем процессе Live.',
  'workbench.editors.request.send.remoteDispatchHint': 'Выполняется на хосте {host} — подключённом бэкенде',
  'workbench.editors.request.send.stop': 'Остановить',
  'workbench.editors.request.send.stopTooltip': 'Остановить запрос и сохранить то, что уже пришло',
  'workbench.editors.request.menu.copyAsCurl': 'Копировать как cURL',
  'workbench.editors.request.menu.copyAsFetch': 'Копировать как fetch',
  'workbench.editors.request.convert.menu': 'Преобразовать в запрос GraphQL',
  'workbench.editors.request.convert.title': 'ПРЕОБРАЗОВАТЬ В ЗАПРОС GRAPHQL',
  'workbench.editors.request.convert.body':
    '«{name}» станет запросом GraphQL на том же месте — заголовки, авторизация, скрипты, настройки и документация переносятся, а HTTP-запрос удаляется.',
  'workbench.editors.request.convert.noteParamsFolded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} параметр запроса сворачивается в URL-адрес.',
      few: '{count} параметра запроса сворачиваются в URL-адрес.',
      many: '{count} параметров запроса сворачиваются в URL-адрес.',
      other: '{count} параметров запроса сворачиваются в URL-адрес.',
    }),
  'workbench.editors.request.convert.noteDisabledParamsDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} выключенный параметр запроса отбрасывается — запрос GraphQL их не хранит.',
      few: '{count} выключенных параметра запроса отбрасываются — запрос GraphQL их не хранит.',
      many: '{count} выключенных параметров запроса отбрасываются — запрос GraphQL их не хранит.',
      other: '{count} выключенных параметров запроса отбрасываются — запрос GraphQL их не хранит.',
    }),
  'workbench.editors.request.convert.noteMethodChanged':
    'Метод {method} становится POST — каждая операция GraphQL отправляется методом POST.',
  'workbench.editors.request.convert.noteExamples': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сохранённый ответ переезжает под новый запрос.',
      few: '{count} сохранённых ответа переезжают под новый запрос.',
      many: '{count} сохранённых ответов переезжают под новый запрос.',
      other: '{count} сохранённых ответов переезжают под новый запрос.',
    }),
  'workbench.editors.request.convert.ok': 'Преобразовать',
  'workbench.editors.request.convert.notConvertible': 'Преобразовать можно только запрос, тело которого — GraphQL.',
  'workbench.editors.request.convert.saveFirst': 'Сохраните запрос перед преобразованием.',
  'workbench.editors.request.convert.failed': 'Не удалось преобразовать запрос.',
  'workbench.editors.request.convert.failedDetail': 'Не удалось преобразовать запрос: {message}',
  'workbench.editors.request.convert.done': '«{name}» преобразован в запрос GraphQL.',
  'workbench.editors.request.schemeHint':
    'В URL-адресе нет схемы. Он будет отправлен как https:// — щёлкните адресную строку и нажмите Tab или Enter, чтобы зафиксировать это.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Авторизация',
  'workbench.editors.request.tab.headers': 'Заголовки',
  'workbench.editors.request.tab.body': 'Тело',
  'workbench.editors.request.tab.scripts': 'Скрипты',
  'workbench.editors.request.tab.settings': 'Настройки',
  'workbench.editors.request.spec.selectLabel': 'Спецификация OpenAPI',
  'workbench.editors.request.spec.none': 'К этому запросу не привязана спецификация OpenAPI.',
  'workbench.editors.request.spec.selectPlaceholder': 'Привязать спецификацию OpenAPI…',
  'workbench.editors.request.spec.inheritedPlaceholder': 'Наследуется от коллекции: {name}',
  'workbench.editors.request.spec.fromCollection': 'Из коллекции {name}',
  'workbench.editors.request.spec.missing': 'Привязанной спецификации больше нет в этом рабочем пространстве.',
  'workbench.editors.request.spec.parseFailure': 'Спецификация не разобрана: {message}',
  'workbench.editors.request.spec.drifted': 'Спецификация изменилась после создания этой коллекции.',
  'workbench.editors.request.spec.operation': 'Операция',
  'workbench.editors.request.spec.noOperation': 'В спецификации нет операции, соответствующей {method} {url}.',
  'workbench.editors.request.spec.inSync': 'Синхронизировано со спецификацией.',
  'workbench.editors.request.spec.fieldDiffers': 'Поле {field} отличается от спецификации.',
  'workbench.editors.request.spec.apply': 'Применить',
  'workbench.editors.request.spec.applyAll': 'Применить всё',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Введите URL-адрес или вставьте текст',
  'workbench.editors.request.url.socketCta':
    'URL-адрес в стиле сокета — отправляет подключение {path} через настройку «Сокет Unix».',
  'workbench.editors.request.url.socketCtaApply': 'Применить',
  'workbench.editors.request.method.customGroup': 'Свои',
  'workbench.editors.request.method.usePrefix': 'Использовать',
  'workbench.editors.request.method.forbiddenSuffix': 'нельзя отправить из браузера.',
  'workbench.editors.request.method.invalidHint': 'В методах допустимы буквы, цифры и дефисы (не более 32).',
  'workbench.editors.request.method.removeCustomAria': 'Удалить свой метод {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Перейти к авторизации',
  'workbench.editors.request.goToBody': 'Перейти к телу',
  'workbench.editors.request.headers.keyPlaceholder': 'Заголовок',
  'workbench.editors.request.headers.hideAuto': 'Скрыть автоматически создаваемые заголовки',
  'workbench.editors.request.headers.hiddenCount': 'скрыто: {count}',
  'workbench.editors.request.headers.autoInfo':
    'Эти заголовки будут добавлены автоматически и отправлены вместе с запросом. Нажмите значок информации в строке, чтобы увидеть подробности по каждому заголовку.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Это дублирующий заголовок — его переопределит заголовок {header}, создаваемый настройками авторизации.',
  'workbench.editors.request.headers.calculated': '<вычисляется при отправке запроса>',
  'workbench.editors.request.headers.browserUserAgent': '<User-Agent браузера>',
  'workbench.editors.request.headers.hint.cacheControl':
    '«Cache-Control: no-cache» уходит с каждой отправкой из браузерного хоста, чтобы при повторе запроса сервер никогда не отвечал из устаревшего кеша. Добавьте свою строку Cache-Control, чтобы отправить другое значение.',
  'workbench.editors.request.headers.hint.contentType':
    'Среда выполнения вычисляет Content-Type из кодировки тела (form-data → multipart/form-data с boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; raw JSON → application/json и т. д.). Задайте свой заголовок, чтобы переопределить его.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length вычисляется из размера сериализованного тела в байтах перед отправкой запроса. Браузер не принимает заданный пользователем Content-Length, не совпадающий с фактической длиной тела.',
  'workbench.editors.request.headers.hint.host':
    'Браузер выводит Host из целевого URL-адреса и не позволяет пользовательскому коду его переопределить.',
  'workbench.editors.request.headers.hint.userAgent':
    'User-Agent идентифицирует клиента. Запросы уходят с собственным User-Agent браузера; добавьте свою строку User-Agent ниже, чтобы переопределить его.',
  'workbench.editors.request.headers.hint.accept':
    'Accept сообщает серверу, какие медиатипы клиент способен разобрать. `*/*` оставляет выбор серверу; переопределите более узким набором (например, `application/json`), чтобы ограничить ответы.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Алгоритмы сжатия, которые поддерживает браузер. Задаётся браузером и согласуется для каждого соединения; из пользовательского кода не переопределяется.',
  'workbench.editors.request.headers.hint.connection':
    'Повторное использование соединения HTTP/1.1. Браузер управляет пулом соединений и не позволяет пользовательскому коду переопределить этот заголовок.',
  'workbench.editors.request.headers.hint.node.host':
    'Выводится из целевого URL-адреса при отправке запроса. Ваша собственная строка Host заменяет его в сети.',
  'workbench.editors.request.headers.hint.node.connection':
    'Среда выполнения node держит соединения открытыми и объединяет их в пул по источникам. Ваша собственная строка Connection заменяет его.',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'Клиент fetch среды выполнения node отправляет подстановочный знак. Ваша собственная строка заменяет его.',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'Проставляется клиентом fetch среды выполнения node при каждой отправке. Ваша собственная строка заменяет его.',
  'workbench.editors.request.headers.hint.node.userAgent':
    'Среда выполнения node идентифицирует это приложение при каждой отправке. Добавьте свою строку User-Agent, чтобы отправить другой.',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'Сжатие, которое среда выполнения node принимает и распаковывает за вас. Ваша собственная строка заменяет его — тело ответа тогда приходит как отправлено.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <учётные данные>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <токен>',
  'workbench.editors.request.authPreview.apiKeyValue': '<значение>',
  'workbench.editors.request.authPreview.accessTokenValue': '<токен доступа>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <токен доступа>',
  'workbench.editors.request.authPreview.basicHint':
    'Создаётся вкладкой «Авторизация» (Basic Auth). Имя пользователя и пароль кодируются в base64 в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.bearerHint':
    'Создаётся вкладкой «Авторизация» (Bearer Token). Токен добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Создаётся вкладкой «Авторизация» (API-ключ). Значение добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Создаётся вкладкой «Авторизация» (API-ключ). Значение добавляется в этот параметр запроса при отправке запроса.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Создаётся вкладкой «Авторизация» (OAuth 2.0). Токен доступа добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Создаётся вкладкой «Авторизация» (OAuth 2.0). Токен доступа добавляется к URL-адресу запроса при отправке запроса.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <подпись>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<метка времени запроса>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Создаётся вкладкой «Авторизация» (AWS Signature v4). Запрос подписывается вашими учётными данными при отправке.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Создаётся вкладкой «Авторизация» (AWS Signature v4). Метка времени подписания добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<подписанные параметры>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    'Создаётся вкладкой «Авторизация» (AWS Signature v4). Параметры X-Amz-* добавляются в строку запроса URL-адреса при отправке запроса.',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <подписанные параметры>',
  'workbench.editors.request.authPreview.edgeGridHint':
    'Создаётся вкладкой «Авторизация» (Akamai EdgeGrid). Запрос подписывается вашими учётными данными при отправке.',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <подписанный JWT>',
  'workbench.editors.request.authPreview.asapHint':
    'Создаётся вкладкой «Авторизация» (ASAP). Свежий токен подписывается вашим закрытым ключом и добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<подписываемые компоненты>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<подпись>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    'Создаётся вкладкой «Авторизация» (HTTP Message Signature). Запрос подписывается вашим ключом при отправке.',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<дайджест тела>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    'Создаётся вкладкой «Авторизация» (HTTP Message Signature). Дайджест тела вычисляется при отправке запроса.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <ответ на челлендж>',
  'workbench.editors.request.authPreview.digestHint':
    'Создаётся вкладкой «Авторизация» (Digest Auth). Значение вычисляется из челленджа сервера при отправке запроса, затем запрос отправляется повторно с ним.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <подписанные параметры>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Создаётся вкладкой «Авторизация» (OAuth 1.0). Запрос подписывается вашими учётными данными при отправке.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<подписанные параметры>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Создаётся вкладкой «Авторизация» (OAuth 1.0). Параметры oauth_* добавляются в строку запроса URL-адреса при отправке запроса.',
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <подписанные параметры>',
  'workbench.editors.request.authPreview.hawkHint':
    'Создаётся вкладкой «Авторизация» (Hawk Authentication). Запрос подписывается вашими учётными данными при отправке.',
  'workbench.editors.request.authPreview.jwtValue': '<подписанный JWT>',
  'workbench.editors.request.authPreview.jwtHint':
    'Создаётся вкладкой «Авторизация» (JWT Bearer). Токен подписывается и добавляется в этот заголовок при отправке запроса.',
  'workbench.editors.request.authPreview.jwtQueryHint':
    'Создаётся вкладкой «Авторизация» (JWT Bearer). Токен подписывается и добавляется в этот параметр запроса при отправке запроса.',
  'workbench.editors.request.authPreview.inheritedFrom': 'Наследуется от {source} — измените в родителе.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Тип авторизации',
  'workbench.editors.request.auth.group.credentials': 'Учётные данные',
  'workbench.editors.request.auth.group.token': 'Токен',
  'workbench.editors.request.auth.group.signing': 'Подписание',
  'workbench.editors.request.auth.group.consumer': 'Потребитель',
  'workbench.editors.request.auth.group.attributes': 'Атрибуты',
  'workbench.editors.request.auth.group.delivery': 'Доставка',
  'workbench.editors.request.auth.group.challenge': 'Челлендж',
  'workbench.editors.request.auth.group.grant': 'Грант',
  'workbench.editors.request.auth.group.advanced': 'Дополнительно',
  'workbench.editors.request.auth.group.coverage': 'Область подписи',
  'workbench.editors.request.auth.group.parameters': 'Параметры',
  'workbench.editors.request.auth.typeInfo.none':
    'Ничего не добавляется — запрос уходит ровно таким, каким его показывают вкладки «Заголовки» и Params.',
  'workbench.editors.request.auth.typeInfo.basic':
    'Имя пользователя и пароль соединяются двоеточием, кодируются в base64 и отправляются заголовком Authorization: Basic при каждой отправке — закодированы, а не зашифрованы, поэтому только по HTTPS.',
  'workbench.editors.request.auth.typeInfo.bearer':
    'Токен отправляется как есть после схемы Bearer в заголовке Authorization при каждой отправке.',
  'workbench.editors.request.auth.typeInfo.apiKey':
    'Ключ называет заголовок или параметр запроса, а значение передаётся в нём — схема с открытыми учётными данными, которой пользуется большинство публичных API.',
  'workbench.editors.request.auth.typeInfo.digest':
    'Первая отправка получает челлендж 401 от сервера (realm, nonce, qop); учётные данные хешируются с ним в response=, и запрос повторяется — сам пароль никогда не передаётся.',
  'workbench.editors.request.auth.typeInfo.oauth1':
    'Учётные данные потребителя и токена подписывают базовую строку из метода, URL-адреса и параметров; подписанные параметры oauth_* передаются в заголовке Authorization или в URL-адресе, а nonce, метка времени и версия создаются при каждой отправке.',
  'workbench.editors.request.auth.typeInfo.hawk':
    'MAC по методу, URL-адресу, метке времени, nonce и необязательным атрибутам передаётся в заголовке Authorization: Hawk; метка времени и nonce создаются при каждой отправке.',
  'workbench.editors.request.auth.typeInfo.jwt':
    'При каждой отправке из указанного здесь ключевого материала создаётся и подписывается свежий JWT — заголовок, полезная нагрузка и подпись ниже — и доставляется как токен bearer или параметр запроса.',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'Пара, которая становится учётными данными base64 — отправляются обе части, закодированные, но не зашифрованные.',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    'Токен в том виде, в каком его выдал сервер; схема Bearer добавляется спереди при передаче.',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    'Имя и секрет — имя задаёт заголовок или параметр, значение — то, что в нём передаётся.',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    'Куда попадает ключ: в заголовок запроса или в параметр запроса, добавляемый к URL-адресу.',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    'Пара, из которой вычисляется ответ на челлендж — имя пользователя передаётся, пароль — только как часть хеша ответа.',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    'Как обрабатывается этап 401 при отправках из настольного приложения и CLI — отвечается и повторяется автоматически, если не выключено.',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    'Метод, подписывающий базовую строку — HMAC с секретами, RSA с закрытым ключом или PLAINTEXT — и хешируется ли в неё тело.',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    'Учётные данные приложения — ключ передаётся как oauth_consumer_key, секрет (или закрытый ключ) — только через oauth_signature.',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    'Пара токена доступа пользователя из трёхстороннего потока — оставьте обе части пустыми для односторонних вызовов.',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'Куда попадают параметры oauth_* — в заголовок Authorization (с необязательным realm) или в строку запроса URL-адреса.',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'Идентификатор передаётся в заголовке; ключ — только через MAC, который он вычисляет.',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'Дайджест MAC и хешируется ли тело запроса в него как hash=.',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    'Необязательные атрибуты схемы — данные приложения (ext), идентификатор приложения (app) и делегирующего приложения (dlg) — подписываются, если заданы.',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'Алгоритм, названный в заголовке JWT, и ключевой материал, которым он подписывается — общий секрет для HS, закрытый ключ для RS / PS / ES.',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'Что несёт JWT — утверждения полезной нагрузки, дополнительные защищённые заголовки и необязательный срок жизни, проставляемый как iat / exp.',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    'Куда попадает подписанный JWT — в заголовок Authorization за своим префиксом или в параметр запроса token.',
  'workbench.editors.request.auth.rowInfo.basicUsername': 'Передаётся перед двоеточием в учётных данных base64.',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    'Передаётся после двоеточия — закодирован, но не зашифрован, поэтому только по HTTPS.',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Отправляется как есть после Bearer; у вставленного «Bearer …» префикс здесь отбрасывается.',
  'workbench.editors.request.auth.rowInfo.apiKeyKey':
    'Имя заголовка или имя параметра запроса, в котором передаётся значение.',
  'workbench.editors.request.auth.rowInfo.apiKeyValue':
    'Секрет, отправляемый как значение заголовка или значение параметра.',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    '«Заголовок» помещает ключ в запрос; «Параметры запроса» добавляет его к URL-адресу, где он попадает в журналы.',
  'workbench.editors.request.auth.rowInfo.digestUsername': 'Передаётся как username= в ответе на челлендж.',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    'Никогда не передаётся — хешируется вместе с realm, nonce и методом в response=.',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    'Останавливает автоматический второй этап: ответ 401 возвращается как ответ, а не отвечается.',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'Называет алгоритм подписи в oauth_signature_method и выбирает набор учётных данных ниже.',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    'Хеширует тело, не являющееся формой, хешем метода в oauth_body_hash, подписываемый вместе с остальным.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    'Идентифицирует приложение — передаётся как oauth_consumer_key.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    'Подписывает запрос вместе с секретом токена; сам никогда не передаётся — передаётся только oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'PEM-ключ, подписывающий базовую строку для методов RSA — передаётся только подпись.',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    'Токен доступа пользователя, отправляемый как oauth_token; пусто для односторонних вызовов.',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    'Вторая половина ключа подписи; сама никогда не передаётся — передаётся только oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    '«Заголовок» несёт параметры oauth_* в заголовке Authorization; «Параметры запроса» добавляет их к URL-адресу.',
  'workbench.editors.request.auth.rowInfo.oauth1Realm':
    'Повторяется как realm= в начале заголовка, называя пространство защиты.',
  'workbench.editors.request.auth.rowInfo.hawkAuthId':
    'Идентифицирует учётные данные — передаётся как id= в заголовке.',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey': 'Общий секрет, вычисляющий mac=; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm':
    'Дайджест HMAC, который используют MAC и хеш полезной нагрузки.',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    'Хеширует тело и его тип содержимого в hash=, привязывая полезную нагрузку к подписи.',
  'workbench.editors.request.auth.rowInfo.hawkExt':
    'Данные, специфичные для приложения — передаются как ext= и подписываются.',
  'workbench.editors.request.auth.rowInfo.hawkApp': 'Идентификатор приложения — передаётся как app= и подписывается.',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    'Идентификатор делегирующего приложения — передаётся как dlg= после app= и подписывается.',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm':
    'Записывается как alg в защищённом заголовке и выбирает поле ключа ниже.',
  'workbench.editors.request.auth.rowInfo.jwtSecret':
    'Общий секрет HMAC, создающий подпись; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    'Декодирует секрет из base64 перед подписанием — для секретов, выданных в таком виде.',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'Закрытый PEM-ключ, создающий подпись для RS / PS / ES; передаётся только подпись.',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'Утверждения в виде JSON — шаблоны разрешаются при каждой отправке; заданные здесь iat или exp побеждают срок жизни.',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'Дополнительные защищённые заголовки в виде JSON (обычно kid); alg и typ добавляются автоматически.',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    'Проставляет iat и exp в полезную нагрузку при подписании, чтобы каждая отправка несла свежий срок жизни.',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    '«Заголовок» отправляет JWT в заголовке Authorization; «Параметры запроса» добавляет его к URL-адресу как token=.',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Схема перед JWT в заголовке Authorization — по умолчанию Bearer; пустое значение отправляет токен без префикса.',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    'Секретный ключ подписывает метод, путь, строку запроса, заголовки и хеш полезной нагрузки; подпись передаётся в заголовке Authorization: AWS4-HMAC-SHA256 вместе с X-Amz-Date или как параметры запроса X-Amz-* — ничего секретного не передаётся.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'Ключ доступа передаётся в Credential=, секретный ключ — только через подпись, которую он вычисляет; токен сеанса передаётся как X-Amz-Security-Token для временных учётных данных.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    'Область учётных данных, через которую выводится ключ подписи — сервис и регион; оставьте любое поле пустым, и оно выводится из имени хоста AWS (регион по умолчанию — us-east-1).',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    'Куда попадает подпись — в заголовок Authorization вместе с X-Amz-Date или в параметры запроса X-Amz-* для конечных точек, не принимающих заголовок.',
  'workbench.editors.request.auth.rowInfo.awsAccessKey':
    'Идентифицирует пару ключей — передаётся в Credential= перед областью.',
  'workbench.editors.request.auth.rowInfo.awsSecretKey':
    'Ключевой материал, из которого выводится ключ подписи; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'Токен сеанса STS — передаётся как X-Amz-Security-Token, подписанный, только для временных учётных данных.',
  'workbench.editors.request.auth.rowInfo.awsService':
    'Сервис в области учётных данных (s3, execute-api, …); пустое значение выводится из имени хоста AWS. s3 дополнительно подписывает хеш полезной нагрузки как заголовок.',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    'Регион в области учётных данных; пустое значение выводится из имени хоста AWS, иначе us-east-1.',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    'Заголовок (по умолчанию) или строка запроса URL-адреса — предподписанная форма для конечных точек, не принимающих заголовок.',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'Секрет клиента подписывает метод, схему, хост, путь, перечисленные заголовки и хеш тела POST; токены, метка времени и nonce для каждой отправки и подпись передаются в заголовке Authorization: EG1-HMAC-SHA256 — секрет никогда не передаётся.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    'Два токена передаются в заголовке как client_token= и access_token=; секрет клиента — только через подпись, которую он выводит.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    'Что покрывает подпись помимо строки запроса — заголовки, которые называет API, в том же порядке, и хеш тела POST в пределах байтового окна (128 КиБ по схеме, если API не говорит иного).',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'Идентифицирует клиента API — передаётся как client_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken':
    'Идентифицирует учётные данные — передаётся как access_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    'Ключевой материал, из которого выводится ключ подписи для каждой отправки; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    'Имена заголовков, включаемых в подпись, через запятую, в порядке подписания; перечисленный заголовок, которого нет в запросе, пропускается, а неперечисленные никогда не подписываются.',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    'Байтовое окно тела POST, которое покрывает хеш содержимого; пусто = 131072 по схеме.',
  'workbench.editors.request.auth.typeInfo.asap':
    'При каждой отправке создаётся свежий JWT — издатель, аудитория и субъект как утверждения, iat / exp по часам, уникальный nonce jti — подписывается закрытым ключом под заголовком kid и доставляется как токен bearer; ключ никогда не передаётся.',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'Асимметричное семейство, названное в заголовке JWT, идентификатор ключа, по которому получатель находит открытый ключ, и закрытый ключ, который подписывает.',
  'workbench.editors.request.auth.groupInfo.asap.token':
    'Что утверждает токен — кто его выдал, для кого, от чьего имени, дополнительные утверждения и как долго он живёт (по умолчанию — часовой потолок схемы).',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    'Называет семейство подписи в заголовке; HS схемой не допускается.',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'Передаётся как kid — issuer/key-name по разметке схемы; получатель получает по нему открытый ключ.',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    'PEM (или форма data:application/pkcs8 от Atlassian), который подписывает; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.asapIssuer': 'Зарегистрированный идентификатор сервиса — передаётся как iss.',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    'Для кого токен — передаётся как aud; массив — через «Дополнительные утверждения».',
  'workbench.editors.request.auth.rowInfo.asapSubject':
    'От чьего имени — передаётся как sub; пустое значение отправляет издателя.',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    'Дополнительные утверждения, объединяемые последними — они побеждают каждое составленное утверждение, включая jti / iat / exp.',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'Срок жизни, проставляемый как exp − iat; пусто = 3600, потолок схемы.',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    'Запрос подписывается при отправке (RFC 9421): из подписываемых компонентов — метода, цели, названных заголовков, Content-Digest тела — плюс параметров подписи строится база подписи, подписывается ключом и доставляется как Signature-Input и Signature; ключ никогда не передаётся.',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    'Зарегистрированный алгоритм, идентификатор ключа, по которому проверяющий находит ключ, и ключ, который подписывает — закрытый PEM-ключ или общий секрет под hmac-sha256.',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    'Что покрывает подпись: компоненты в порядке подписания — производные, такие как @method и @target-uri, поля заголовков по имени — и создаётся ли Content-Digest тела для покрытия.',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    'Метаданные @signature-params: метка, которую несут оба заголовка, моменты created / expires, nonce для каждой отправки, параметр alg, тег приложения.',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    'Один из шести зарегистрированных алгоритмов; у проверяющего должен быть соответствующий ключ. rsa-pss-sha512 открывает собственные примеры RFC.',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'Передаётся как keyid — проверяющий получает по нему открытый ключ (или секрет). Пустое значение опускает параметр.',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey':
    'PEM, который подписывает — PKCS#8, PKCS#1 или SEC1; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    'Секрет, общий с проверяющим — ключ HMAC; сам никогда не передаётся.',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    'Секрет — это текст base64; декодировать его в сырые байты ключа перед подписанием.',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    'Через пробел, в порядке подписания: @method, @target-uri, @authority, @scheme, @request-target, @path, @query и имена заголовков. Подписываемый заголовок, которого нет в запросе, проваливает отправку.',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    'Создавать Content-Digest по байтам тела (RFC 9530), чтобы content-digest можно было покрыть; отправка без тела хеширует пустое содержимое. Тела multipart хешировать нельзя.',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Ключ словаря, под которым Signature-Input и Signature несут эту подпись; пусто = sig1.',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'Записывать created = момент подписания; по нему проверяющие отклоняют устаревшие подписи. Выключено — параметр отбрасывается (и expires вместе с ним).',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'Записывать expires = created + столько секунд; пустое значение не записывает срок.',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    'Записывать свежий случайный nonce при каждой отправке — защита от повтора для проверяющих, которые их отслеживают.',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    'Записывать alg с именем алгоритма; выключено — оставляет это ключу, который разрешает проверяющий (умолчание RFC).',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    'Параметр tag, специфичный для приложения, чтобы проверяющий мог различать подписи; пустое значение опускает его.',
  'workbench.editors.request.auth.typeInfo.oauth2':
    'Клиент получает токен доступа у поставщика — авторизация в браузере, затем обмен на токен, либо прямой обмен для машинных и парольных грантов — и каждая отправка несёт его как токен bearer, обновляя по истечении, если был выдан токен обновления.',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    'Токен, который эта конфигурация хранит сейчас — что отправка несёт после Bearer и обновляется ли он сам.',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    'Как получается новый токен — грант, конечные точки поставщика, удостоверение клиента и что запрашивается.',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    'Этап обновления и дополнительные параметры, которые несёт каждый из трёх запросов к поставщику.',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    'JWT, который создаёт эта конфигурация — как утверждение клиента при каждом запросе токена или как сам грант JWT bearer.',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    'Токен доступа, сохранённый последним потоком — отправляется после Bearer при каждой отправке; пусто, пока поток не выполнен.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP (RFC 9449) привязывает токен к паре ключей, создаваемой при обмене: каждый запрос токена и каждая отправка несут доказательство, подписанное для метода и URL-адреса этого запроса, поставщик выдаёт токен как DPoP, и он отправляется под этой схемой — префикс заголовка и режим URL-адреса отступают. Ключ хранится рядом с сохранённым токеном, никогда — в конфигурации.',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    'Семейство подписи доказательства — пара ключей создаётся под него. ES256 принимает каждое развёртывание DPoP.',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Схема перед токеном в заголовке Authorization — пустое значение отправляет token_type, выданный поставщиком (по умолчанию Bearer); заданное побеждает при передаче.',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    'Истёкший токен доступа обновляется перед отправкой — токеном обновления, если поставщик его выдал, или повторным выполнением гранта, которому не нужен браузер.',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    'Сколько ещё действителен сохранённый токен; «Обновить сейчас» обменивает его немедленно, «Отключить» забывает его.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    'Метка этого токена в приложении — ничего не передаётся в сеть.',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    'Параметр grant_type обмена на токен и какие этапы выполняются перед ним — авторизация в браузере для грантов с кодом, никаких — для учётных данных клиента, пароля или JWT bearer.',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    'Параметр redirect_uri, на который поставщик возвращает браузер с кодом — зарегистрируйте его у поставщика.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl':
    'Конечная точка авторизации поставщика, на которую сначала отправляется браузер.',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    'Конечная точка авторизации устройства у поставщика (RFC 8628) — выдаёт код пользователя и URL-адрес подтверждения, который вы одобряете на любом устройстве, пока этот хост опрашивает конечную точку токена.',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    'Идентификатор издателя у поставщика или его URL-адрес метаданных /.well-known/. «Обнаружить» читает документ метаданных (RFC 8414 / OpenID Connect Discovery), заполняет строки конечных точек ниже и перечисляет, что документ говорит о ваших выборах — больше ничего не меняется, и строки остаются вашими.',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    'Конечная точка токена у поставщика, где код (или учётные данные) обменивается на токен.',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    'Имя пользователя владельца ресурса, отправляемое в теле запроса токена — только парольный грант.',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    'Пароль владельца ресурса, отправляемый в теле запроса токена — только парольный грант.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    'Идентифицирует приложение — в URL-адресе авторизации и в запросе токена.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    'Аутентифицирует приложение на конечной точке токена — в теле или заголовком Basic согласно «Аутентификации клиента».',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE: code_challenge в URL-адресе авторизации — это дайджест S256 верификатора, создаваемого для каждого потока.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    'Создаётся для каждого потока и отправляется как code_verifier при обмене на токен, доказывая, что поток начал тот же клиент.',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    'Запрашиваемые области — отправляются через пробел как scope в URL-адресе авторизации или в запросе токена.',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    'Создаётся для каждого потока и возвращается поставщиком, чтобы обратный вызов сопоставлялся с этой авторизацией.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    'Как клиент подтверждает себя в запросе токена — учётные данные в теле формы или в заголовке Authorization: Basic, либо подписанный client_assertion вместо секрета.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    'Утверждение iss утверждения гранта — служебная учётная запись или ключ потребителя, зарегистрированный у поставщика.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    'Необязательное утверждение sub — пользователь, от имени которого действует токен (делегирование на уровне домена, олицетворение); пустое значение ничего не отправляет.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    'Дополнительные утверждения, объединяемые в утверждение гранта и побеждающие составленные — утверждения вендора или собственная область.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    'Семейство JWS, которым подписывается утверждение — асимметричное для закрытого ключа, HS256/384/512 для секрета клиента.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    'Заголовок kid с именем зарегистрированного ключа, чтобы поставщик выбрал правильную открытую половину.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    'Ключ подписи — PEM, чистый DER или форма data:application/pkcs8; никогда не экспортируется.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'Утверждение aud — пустое значение отправляет URL-адрес токена доступа; FAPI и Keycloak ждут вместо него идентификатор издателя.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp минус iat, проставляется при подписании — по умолчанию 300 секунд; поставщик может ограничить (Google: один час).',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    'Дополнительный JSON защищённого заголовка, объединяемый в утверждение — отпечаток сертификата x5t#S256 у Azure.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    'Конечная точка, на которую отправляется обмен обновления — пустое значение означает URL-адрес токена доступа.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    'Дополнительные параметры, добавляемые к URL-адресу авторизации (audience, prompt, …).',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    'Дополнительные параметры запроса токена — каждый передаётся в теле формы, заголовке или URL-адресе согласно своему полю «Передавать в».',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    'Дополнительные параметры запроса обновления — каждый передаётся в теле формы, заголовке или URL-адресе согласно своему полю «Передавать в».',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    '«Заголовки запроса» отправляет токен после Bearer в заголовке Authorization; «URL-адрес запроса» добавляет его как access_token — устарело, только для старых поставщиков.',
  'workbench.editors.request.auth.type.inherit': 'Наследовать от родителя',
  'workbench.editors.request.auth.type.none': 'Без авторизации',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API-ключ',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP Message Signature',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Ключ потребителя',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'ключ потребителя',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Секрет потребителя',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'секрет потребителя',
  'workbench.editors.request.auth.oauth1Token': 'Токен доступа',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'необязательно — пусто для односторонних вызовов',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Секрет токена',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'необязательно — пусто для односторонних вызовов',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Метод подписи',
  'workbench.editors.request.auth.oauth1PrivateKey': 'Закрытый ключ',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} или PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': 'Включать хеш тела',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'необязательно',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': 'Алгоритм',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': 'необязательно — данные приложения',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': 'необязательно — идентификатор приложения',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': 'необязательно — идентификатор делегирующего приложения',
  'workbench.editors.request.auth.hawkIncludePayloadHash': 'Включать хеш полезной нагрузки',
  'workbench.editors.request.auth.jwtAddTo': 'Добавлять JWT-токен в',
  'workbench.editors.request.auth.jwtAlgorithm': 'Алгоритм',
  'workbench.editors.request.auth.jwtSecret': 'Секрет',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'секрет',
  'workbench.editors.request.auth.jwtSecretBase64': 'Секрет в кодировке Base64',
  'workbench.editors.request.auth.jwtPrivateKey': 'Закрытый ключ',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} или PEM',
  'workbench.editors.request.auth.jwtPayload': 'Полезная нагрузка',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'Заголовки JWT',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': 'Заголовки, специфичные для алгоритма, добавляются автоматически.',
  'workbench.editors.request.auth.jwtHeaderPrefix': 'Префикс заголовка запроса',
  'workbench.editors.request.auth.jwtExpiresIn': 'Истекает через (секунды)',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': 'необязательно',
  'workbench.editors.request.auth.jwtExpiresInNote':
    'Если задано, iat и exp проставляются в полезную нагрузку при отправке. Утверждения, заданные в полезной нагрузке, побеждают.',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth отвечает на челлендж сервера вторым запросом, который выполняется в настольном приложении и CLI. Отправки с этой поверхности уходят без него — сервер отвечает 401.',
  'workbench.editors.request.auth.digestRetryNote':
    'По умолчанию на челлендж 401 даётся ответ, и запрос повторяется автоматически. Выключить это?',
  'workbench.editors.request.auth.digestDisableRetry': 'Да, выключить повтор запроса',
  'workbench.editors.request.auth.authAutoGeneratedNote':
    'Заголовок авторизации будет создан автоматически при отправке запроса.',
  'workbench.editors.request.auth.inheritNote':
    'Заголовок авторизации будет создан автоматически при отправке запроса.',
  'workbench.editors.request.auth.noneNote': 'Этот запрос не использует авторизацию.',
  'workbench.editors.request.auth.inheritDetail':
    'Этот запрос использует помощник авторизации родительской коллекции. Чтобы изменить его, откройте вкладку «Авторизация» коллекции.',
  'workbench.editors.request.auth.inheritedNone': 'Без авторизации — ничего не задано ни на папке, ни на коллекции.',
  'workbench.editors.request.auth.sourceCollection': 'Коллекция «{name}»',
  'workbench.editors.request.auth.sourceFolder': 'Папка «{name}»',
  'workbench.editors.request.auth.groupInherited': 'Унаследовано',
  'workbench.editors.request.auth.refusalQualifier.inQuery': 'в строке запроса',
  'workbench.editors.request.auth.refusalQualifier.inHeader': 'в заголовке',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'привязан к ключу DPoP',
  'workbench.editors.request.auth.groupOwn': 'Этот запрос',
  'workbench.editors.request.auth.groupOwnFolder': 'Эта папка',
  'workbench.editors.request.auth.optionMissingEntry': 'Запись отсутствует',
  'workbench.editors.request.auth.danglingPick':
    'Записи, которую выбрал этот запрос, больше нет — вместо неё применяется ближайшая запись по умолчанию.',
  'workbench.editors.request.auth.editInParent': 'Изменить в родителе',
  // The settings rows' inherited line — {source} is the level label
  // above (Коллекция «X» / Папка «X»).
  'workbench.editors.request.settings.inheritedFrom': 'Наследуется от {source}',
  'workbench.editors.request.settings.overridesSource': 'Переопределяет {source} ({value})',
  'workbench.editors.request.settings.settingChainTitle': 'Где задана эта настройка',
  'workbench.editors.request.settings.settingChainSummary':
    'Каждый уровень, задающий эту настройку, начиная с внешнего — действует значение самого внутреннего.',
  'workbench.editors.request.settings.settingChainHeading': 'Уровни',
  'workbench.editors.request.settings.thisRequest': 'Этот запрос',
  'workbench.editors.request.settings.thisFolder': 'Эта папка',
  'workbench.editors.request.auth.resetToInheritedAuth': 'Сбросить к унаследованной авторизации',
  'workbench.editors.request.auth.resizeRailAria': 'Изменить ширину списка типов авторизации',
  'workbench.editors.request.auth.username': 'Имя пользователя',
  'workbench.editors.request.auth.password': 'Пароль',
  'workbench.editors.request.auth.token': 'Токен',
  'workbench.editors.request.auth.key': 'Ключ',
  'workbench.editors.request.auth.keyPlaceholder': 'например, X-API-Key',
  'workbench.editors.request.auth.value': 'Значение',
  'workbench.editors.request.auth.addTo': 'Добавлять в',
  'workbench.editors.request.auth.addToHeader': 'Заголовок',
  'workbench.editors.request.auth.addToQuery': 'Параметры запроса',
  'workbench.editors.request.auth.usernamePlaceholder': 'имя пользователя',
  'workbench.editors.request.auth.passwordPlaceholder': 'пароль',
  'workbench.editors.request.auth.tokenPlaceholder': 'токен bearer',
  'workbench.editors.request.auth.valuePlaceholder': 'значение API-ключа',
  'workbench.editors.request.auth.awsAccessKey': 'Ключ доступа',
  'workbench.editors.request.auth.awsSecretKey': 'Секретный ключ',
  'workbench.editors.request.auth.awsSessionToken': 'Токен сеанса',
  'workbench.editors.request.auth.awsService': 'Имя сервиса',
  'workbench.editors.request.auth.awsRegion': 'Регион',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'например, AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'секретный ключ доступа',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'необязательно — только временные учётные данные (STS)',
  'workbench.editors.request.auth.awsServicePlaceholder': 'автоматически из хоста AWS — например, s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'автоматически из хоста AWS, иначе us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Токен клиента',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Токен доступа',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Секрет клиента',
  'workbench.editors.request.auth.edgeGridHeadersToSign': 'Подписываемые заголовки',
  'workbench.editors.request.auth.edgeGridMaxBodySize': 'Макс. размер тела',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': 'например, akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': 'например, akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'секрет клиента',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder':
    'необязательно — через запятую, например, X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': 'Алгоритм',
  'workbench.editors.request.auth.asapKeyId': 'Идентификатор ключа',
  'workbench.editors.request.auth.asapPrivateKey': 'Закрытый ключ',
  'workbench.editors.request.auth.asapIssuer': 'Издатель',
  'workbench.editors.request.auth.asapAudience': 'Аудитория',
  'workbench.editors.request.auth.asapSubject': 'Субъект',
  'workbench.editors.request.auth.asapClaims': 'Дополнительные утверждения',
  'workbench.editors.request.auth.asapExpiresIn': 'Срок действия (секунды)',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': 'например, my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … или форма data:application/pkcs8',
  'workbench.editors.request.auth.asapIssuerPlaceholder': 'например, my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': 'например, api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': 'необязательно — пустое значение отправляет издателя',
  'workbench.editors.request.auth.asapClaimsPlaceholder': 'необязательно — JSON, например, {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': 'Алгоритм',
  'workbench.editors.request.auth.httpSigKeyId': 'Идентификатор ключа',
  'workbench.editors.request.auth.httpSigPrivateKey': 'Закрытый ключ',
  'workbench.editors.request.auth.httpSigSecret': 'Общий секрет',
  'workbench.editors.request.auth.httpSigSecretBase64': 'Секрет в кодировке base64',
  'workbench.editors.request.auth.httpSigComponents': 'Подписываемые компоненты',
  'workbench.editors.request.auth.httpSigContentDigest': 'Дайджест содержимого',
  'workbench.editors.request.auth.httpSigDigestNone': 'Нет',
  'workbench.editors.request.auth.httpSigLabel': 'Метка',
  'workbench.editors.request.auth.httpSigCreated': 'Метка времени created',
  'workbench.editors.request.auth.httpSigExpiresIn': 'Истекает через (секунды)',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': 'Параметр алгоритма (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Тег',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': 'например, my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': 'секрет, общий с проверяющим',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': 'необязательно — например, 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': 'необязательно — тег приложения',
  'workbench.editors.request.auth.sendAsLabel': 'Добавлять данные авторизации в',
  'workbench.editors.request.auth.sendAsHeaders': 'Заголовки запроса',
  'workbench.editors.request.auth.sendAsUrl': 'URL-адрес запроса',
  'workbench.editors.request.auth.presetLabel': 'Предустановка поставщика',
  'workbench.editors.request.auth.presetInfo':
    'Выбор поставщика заполняет его конечные точки авторизации и токена, области по умолчанию и рекомендуемый поток. Выберите «Своя», чтобы настроить всё вручную.',
  'workbench.editors.request.auth.presetCustom': 'Своя (без предустановки)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Отправка токена доступа в URL-адресе устарела',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 сохранил метод параметра строки запроса URI, но предостерегает от него: токены утекают в журналы серверов, заголовки HTTP `Referer`, историю браузера и кеши посредников. Предпочитайте заголовок по умолчанию',
  'workbench.editors.request.oauth.queryWarningAfter': '— если только поставщик не требует форму строки запроса.',
  'workbench.editors.request.oauth.tokenLabel': 'Токен',
  'workbench.editors.request.oauth.noTokenPlaceholder':
    'Токена ещё нет — используйте «Получить новый токен доступа» ниже',
  'workbench.editors.request.oauth.headerPrefix': 'Префикс заголовка',
  'workbench.editors.request.oauth.tokenBinding': 'Привязка токена',
  'workbench.editors.request.oauth.tokenBindingNone': 'Нет (bearer)',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': 'Алгоритм доказательства',
  'workbench.editors.request.oauth.autoRefresh': 'Автообновление токена',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Истёкший токен будет автоматически обновлён перед отправкой запроса.',
  'workbench.editors.request.oauth.status': 'Состояние',
  'workbench.editors.request.oauth.statusExpired':
    'Истёк — следующая отправка обновит его автоматически, если сохранён refresh_token.',
  'workbench.editors.request.oauth.statusValid': 'Действителен · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Обновить сейчас',
  'workbench.editors.request.oauth.disconnect': 'Отключить',
  'workbench.editors.request.oauth.tokenName': 'Имя токена',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Произвольная метка, показываемая в списке учётных данных, когда в рабочем пространстве несколько токенов одного поставщика.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Введите имя токена…',
  'workbench.editors.request.oauth.grantType': 'Тип гранта',
  'workbench.editors.request.oauth.callbackUrl': 'URL-адрес обратного вызова',
  'workbench.editors.request.oauth.detecting': 'Определение…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Зарегистрируйте этот URL-адрес у своего поставщика OAuth. Он отличается от',
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    'URL-адреса в адресной строке, потому что Chrome предоставляет отдельный',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'хост перенаправления для',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    '. Идентификатор расширения тот же; различаются только хост и схема.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Авторизоваться через браузер',
  'workbench.editors.request.oauth.noTokenNote':
    'Токена ещё нет — выполните поток ниже, чтобы получить его. Для токена, выданного отдельно, используйте авторизацию Bearer Token.',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    'Вход открывается в браузере по умолчанию — там ваш сеанс у поставщика, менеджер паролей и ключи доступа, а поставщики удостоверений блокируют вход, встроенный в приложения (RFC 8252).',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    'Поставщик возвращает браузер на URL-адрес обратного вызова на порту бэкенда приложения — смена порта в настройках меняет URL-адрес для регистрации.',
  'workbench.editors.request.oauth.authUrl': 'URL-адрес авторизации',
  'workbench.editors.request.oauth.accessTokenUrl': 'URL-адрес токена доступа',
  'workbench.editors.request.oauth.clientId': 'Идентификатор клиента',
  'workbench.editors.request.oauth.clientSecret': 'Секрет клиента',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Создаётся автоматически, если оставить пустым',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': 'например, read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Создаётся автоматически для каждого запроса авторизации',
  'workbench.editors.request.oauth.clientAuthentication': 'Аутентификация клиента',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Как клиент подтверждает себя в POST-запросах токена — идентификатор и секрет в теле или заголовок Basic, либо JWT, подписанный закрытым ключом (private_key_jwt) или секретом (client_secret_jwt).',
  'workbench.editors.request.oauth.clientAuthBody': 'Передавать учётные данные клиента в теле',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Передавать заголовком Basic Auth',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': 'Передавать подписанный JWT (private_key_jwt)',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'Передавать HMAC-JWT (client_secret_jwt)',
  'workbench.editors.request.oauth.assertionIssuer': 'Издатель',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': 'например, service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': 'Субъект',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder':
    'необязательно — пользователь, от имени которого действует токен',
  'workbench.editors.request.oauth.assertionClaims': 'Дополнительные утверждения',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder':
    'необязательно — JSON, например, {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': 'Алгоритм',
  'workbench.editors.request.oauth.assertionKeyId': 'Идентификатор ключа',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': 'необязательно — заголовок kid, например, key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': 'Закрытый ключ',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … (PEM или форма data:application/pkcs8)',
  'workbench.editors.request.oauth.assertionAudience': 'Аудитория',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': 'пусто = URL-адрес токена доступа',
  'workbench.editors.request.oauth.assertionLifetime': 'Срок жизни (секунды)',
  'workbench.editors.request.oauth.assertionHeaders': 'Дополнительные заголовки',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': 'необязательно — JSON, например, {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro': 'Здесь можно задать более тонкие настройки ваших запросов OAuth2.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Подробнее о настройке',
  'workbench.editors.request.oauth.refreshTokenUrl': 'URL-адрес обновления токена',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Большинство поставщиков используют для обновления тот же URL-адрес токена доступа; задайте переопределение, только если поставщик предоставляет отдельный путь.',
  'workbench.editors.request.oauth.sendInColumn': 'Передавать в',
  'workbench.editors.request.oauth.sendInBody': 'Тело',
  'workbench.editors.request.oauth.sendInHeader': 'Заголовок',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
  'workbench.editors.request.oauth.authRequest': 'Запрос авторизации',
  'workbench.editors.request.oauth.tokenRequest': 'Запрос токена',
  'workbench.editors.request.oauth.refreshRequest': 'Запрос обновления',
  'workbench.editors.request.oauth.getNewToken': 'Получить новый токен доступа',
  'workbench.editors.request.oauth.clearCookies': 'Очистить файлы cookie',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Токены хранятся для каждого рабочего пространства в',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Удалите рабочее пространство, чтобы стереть их.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: токен получен',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: авторизация завершена',
  'workbench.editors.request.oauth.toast.failed': 'Сбой OAuth: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: токен доступа обновлён',
  'workbench.editors.request.oauth.toast.refreshFailed': 'Не удалось обновить: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: отключено',
  'workbench.editors.request.oauth.toast.callbackCopied': 'URL-адрес обратного вызова скопирован',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Копирование не поддерживается — выделите URL-адрес вручную',
  'workbench.editors.request.oauth.deviceAuthUrl': 'URL-адрес авторизации устройства',
  'workbench.editors.request.oauth.deviceWaitingTitle': 'Ожидание вашего подтверждения на {host}',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    'Откройте ссылку на любом устройстве, введите код и подтвердите. Эта страница обновится сама.',
  'workbench.editors.request.oauth.deviceCode': 'Код',
  'workbench.editors.request.oauth.deviceOpen': 'Открыть',
  'workbench.editors.request.oauth.deviceCancel': 'Отмена',
  'workbench.editors.request.oauth.deviceExpiresIn': 'Истекает через {duration}',
  'workbench.editors.request.oauth.deviceCheckEvery': 'Проверка каждые {seconds}s',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth: подтвердите на {host} с кодом {code}',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth: авторизация устройства подтверждена',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth: в авторизации отказано — {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth: код устройства истёк — {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'Сбой авторизации устройства OAuth: {error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth: авторизация устройства отменена',
  'workbench.editors.request.oauth.toast.codeCopied': 'Код скопирован',
  'workbench.editors.request.oauth.issuerUrl': 'URL-адрес издателя',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com — или URL-адрес метаданных /.well-known/…',
  'workbench.editors.request.oauth.discover': 'Обнаружить',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth: конечные точки обнаружены',
  'workbench.editors.request.oauth.toast.discoveryFailed': 'Сбой обнаружения: {error}',
  'workbench.editors.request.oauth.discoveryTitle': 'Обнаружено из {url}',
  'workbench.editors.request.oauth.discoveryFilled': 'Заполнено: {rows}',
  'workbench.editors.request.oauth.discoveryFilledNone': 'Документ не называет конечных точек — ничего не заполнено',
  'workbench.editors.request.oauth.discoveryListed': '{pick} — в списке поставщика',
  'workbench.editors.request.oauth.discoveryUnlisted': '{pick} — не в списке; поставщик перечисляет {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': 'Аутентификация клиента {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': 'Грант {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'Алгоритм DPoP {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': 'Алгоритм утверждения {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    'Идентификатор издателя — {issuer}; некоторые поставщики ждут его в поле «Аудитория» утверждения вместо URL-адреса токена доступа',
  'workbench.editors.request.oauth.discoveryScopes': 'Предлагаемые области: {supported} — подсказаны в строке Scope',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'У этого запроса нет тела',
  'workbench.editors.request.body.modeNoneInfo':
    'Запрос отправляется без полезной нагрузки — ни байтов тела, ни заголовка Content-Type.',
  'workbench.editors.request.body.modeFormDataInfo':
    'Отправляет части одной полезной нагрузкой multipart/form-data — каждая строка это текстовое поле или файловая часть.',
  'workbench.editors.request.body.modeFormDataDescription':
    'Content-Type с boundary создаётся при отправке; заданный вручную multipart Content-Type заменяется, чтобы boundary всегда совпадал с полезной нагрузкой.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'Отправляет поля парами key=value в процентном кодировании с Content-Type application/x-www-form-urlencoded. Выключенные строки остаются в редакторе, но никогда не уходят в сеть.',
  'workbench.editors.request.body.modeRawInfo':
    'Отправляет содержимое редактора как есть — байты в сети ровно те, что вы набрали.',
  'workbench.editors.request.body.modeRawDescription':
    'Выбор формата управляет подсветкой синтаксиса и Content-Type по умолчанию (application/json, application/xml, text/plain, text/javascript, text/html); Content-Type, заданный на вкладке «Заголовки», побеждает.',
  'workbench.editors.request.body.modeGraphqlInfo':
    'Отправляет запрос и переменные одной полезной нагрузкой application/json — { query, variables } — по HTTP-транспорту GraphQL.',
  'workbench.editors.request.body.modeGraphqlDescription':
    'Переменные должны быть корректным JSON; неразбираемая панель переменных исключается из тела в сети, и запрос отправляется один.',
  'workbench.editors.request.body.format': 'Форматировать',
  'workbench.editors.request.body.formatAria': 'Форматировать тело',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'Запрос GraphQL',
  'workbench.editors.request.body.queryInfoSummary':
    'Отправляется обычным POST с JSON-телом { query, variables }. Интроспекция схемы и автодополнение запроса пока недоступны.',
  'workbench.editors.request.body.variablesTitle': 'Переменные GraphQL',
  'workbench.editors.request.body.variablesInfoTitle': 'Переменные GraphQL',
  'workbench.editors.request.body.variablesInfoSummary':
    'Определите переменные в формате JSON, чтобы ссылаться на них из запроса (например, $id).',
  'workbench.editors.request.body.kindText': 'Текст',
  'workbench.editors.request.body.kindFile': 'Файл',
  'workbench.editors.request.body.newFile': 'Новый файл с этого компьютера',
  'workbench.editors.request.body.uploadedFiles': 'Загруженные файлы',
  'workbench.editors.request.body.allAttached': 'Все загруженные файлы уже прикреплены',
  'workbench.editors.request.body.selectFiles': 'Выбрать файлы',
  'workbench.editors.request.body.loadingFiles': 'Загрузка файлов…',
  'workbench.editors.request.body.addFile': '+ Добавить файл',
  'workbench.editors.request.body.uploadRequired': 'Требуется загрузка',
  'workbench.editors.request.body.deleteFileAria': 'Удалить файл {filename} из рабочего пространства',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Правка',
  'workbench.editors.request.docs.preview': 'Предпросмотр',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Опишите этот запрос — зачем он существует, когда его выполнять, какая область авторизации ожидается. Поддерживается Markdown: заголовки, списки, таблицы, блоки кода, ссылки. Ссылки {{variable}} отображаются в предпросмотре как чипы.',
  'workbench.editors.request.docs.placeholder':
    'Что делает этот запрос?\nЗачем он существует, когда его выполнять, какая область авторизации ожидается.',
  'workbench.editors.request.docs.empty': 'Пока ничего не описано — переключитесь на «Правка», чтобы добавить заметки.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Перед запросом',
  'workbench.editors.request.scripts.postResponse': 'После ответа',
  'workbench.editors.request.scripts.preInfoTitle': 'Скрипт перед запросом',
  'workbench.editors.request.scripts.preInfoSummary':
    'Выполняется один раз перед уходом запроса. Переписывайте URL-адрес, заголовки, параметры и тело через API oh.',
  'workbench.editors.request.scripts.postInfoTitle': 'Скрипт после ответа',
  'workbench.editors.request.scripts.postInfoSummary':
    'Выполняется один раз после прихода ответа. Читайте статус, заголовки и тело; результаты проверок попадают в панель «Ответ».',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'добавить или заменить заголовок',
  'workbench.editors.request.scripts.apiSetQueryParam': 'добавить или заменить параметр запроса',
  'workbench.editors.request.scripts.apiSetUrl': 'переписать целевой URL-адрес',
  'workbench.editors.request.scripts.apiSetBody': 'заменить тело запроса',
  'workbench.editors.request.scripts.apiRequire': 'загрузить пакет скриптов из Библиотеки пакетов',
  'workbench.editors.request.scripts.apiTest': 'зарегистрировать проверку',
  'workbench.editors.request.scripts.runsAfter': 'Выполняется после скриптов ({count}):',
  'workbench.editors.request.scripts.runsAfterOne': 'Выполняется после 1 скрипта:',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    'Пишите скрипты, выполняемые перед отправкой каждого HTTP-запроса.',
  'workbench.editors.request.scripts.postPlaceholderContainer':
    'Пишите скрипты, выполняемые в конце каждого HTTP-ответа.',
  'workbench.editors.request.scripts.prePlaceholder':
    'Используйте JavaScript, чтобы изменить этот запрос перед отправкой.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Используйте JavaScript, чтобы проверить и прочитать этот ответ после его прихода.',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': 'Перед вызовом',
  'workbench.editors.request.scripts.grpcOnMessage': 'При сообщении',
  'workbench.editors.request.scripts.grpcAfterResponse': 'После ответа',
  'workbench.editors.request.scripts.wsBeforeConnect': 'Перед подключением',
  'workbench.editors.request.scripts.wsBeforeSend': 'Перед отправкой',
  'workbench.editors.request.scripts.wsOnMessage': 'При сообщении',
  'workbench.editors.request.scripts.wsAfterClose': 'После закрытия',
  'workbench.editors.request.scripts.mqttBeforeConnect': 'Перед подключением',
  'workbench.editors.request.scripts.mqttBeforePublish': 'Перед публикацией',
  'workbench.editors.request.scripts.mqttOnMessage': 'При сообщении',
  'workbench.editors.request.scripts.mqttAfterClose': 'После закрытия',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder':
    'Используйте JavaScript, чтобы изменить метаданные и сообщение перед выполнением этого вызова.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder':
    'Используйте JavaScript, чтобы читать каждый кадр сообщения по мере прихода.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder':
    'Используйте JavaScript, чтобы проверить и прочитать ответ после завершения этого вызова.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder':
    'Используйте JavaScript, чтобы изменить рукопожатие перед подключением этого сеанса.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder':
    'Используйте JavaScript, чтобы изменить или отбросить каждое сообщение перед отправкой.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder':
    'Используйте JavaScript, чтобы реагировать на каждое сообщение по мере прихода.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder':
    'Используйте JavaScript, чтобы проверить и прочитать этот сеанс после его закрытия.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder':
    'Используйте JavaScript, чтобы изменить пакет CONNECT перед подключением этого сеанса.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder':
    'Используйте JavaScript, чтобы изменить или отбросить каждое сообщение перед публикацией.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder':
    'Используйте JavaScript, чтобы реагировать на каждое сообщение по мере прихода.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder':
    'Используйте JavaScript, чтобы проверить и прочитать этот сеанс после его отключения.',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer':
    'Пишите скрипты, выполняемые перед каждым вызовом gRPC.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer':
    'Пишите скрипты, выполняемые на каждом кадре сообщения gRPC.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer':
    'Пишите скрипты, выполняемые в конце каждого вызова gRPC.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    'Пишите скрипты, выполняемые перед подключением каждого сеанса WebSocket.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer':
    'Пишите скрипты, выполняемые перед отправкой каждого сообщения WebSocket.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer':
    'Пишите скрипты, выполняемые на каждом полученном сообщении WebSocket.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer':
    'Пишите скрипты, выполняемые после закрытия каждого сеанса WebSocket.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer':
    'Пишите скрипты, выполняемые перед подключением каждого сеанса MQTT.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer':
    'Пишите скрипты, выполняемые перед публикацией каждого сообщения MQTT.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer':
    'Пишите скрипты, выполняемые на каждом полученном сообщении MQTT.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer':
    'Пишите скрипты, выполняемые после отключения каждого сеанса MQTT.',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': 'Скрипт перед вызовом',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    'Выполняется один раз перед вызовом. Переписывайте метаданные и сообщение запроса через API oh; oh.session переносит состояние в последующие хуки вызова.',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': 'Скрипт при сообщении',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    'Выполняется на каждом кадре сообщения, который захватывает вызов, в обоих направлениях, после захвата. Читайте декодированное сообщение; захват никогда не задерживается.',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': 'Скрипт после ответа',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    'Выполняется после завершения вызова. Читайте статус, заголовки, трейлеры и сообщения; результаты проверок попадают в панель ответа.',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': 'Скрипт перед подключением',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    'Выполняется при каждом установлении соединения, включая переподключения. Переписывайте URL-адрес, заголовки, параметры и подпротоколы через API oh; сбой записывается, и соединение устанавливается без изменений.',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': 'Скрипт перед отправкой',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    'Выполняется перед каждым отправляемым вами сообщением. Переписывайте или отбрасывайте исходящее сообщение; heartbeat-кадры и протокольные фреймы сюда никогда не попадают.',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': 'Скрипт при сообщении',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    'Выполняется на каждом полученном сообщении, после захвата. Реагируйте на него: отвечайте через oh.send, храните состояние в oh.session, регистрируйте проверки.',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': 'Скрипт после закрытия',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    'Выполняется один раз, когда открывшийся сеанс завершается. Читайте запись о закрытии и счётчики сеанса; результаты проверок попадают в панель сеанса.',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': 'Скрипт перед подключением',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    'Выполняется при каждом установлении соединения, включая переподключения. Переписывайте идентификатор клиента, учётные данные, will и подписки через API oh; сбой записывается, и соединение устанавливается без изменений.',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': 'Скрипт перед публикацией',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    'Выполняется перед каждым публикуемым вами сообщением. Переписывайте топик, полезную нагрузку, QoS, флаг retain и свойства или отбрасывайте публикацию.',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': 'Скрипт при сообщении',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    'Выполняется на каждом полученном сообщении, после захвата. Реагируйте на него: отвечайте через oh.publish, храните состояние в oh.session, регистрируйте проверки.',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': 'Скрипт после закрытия',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    'Выполняется один раз, когда открывшийся сеанс завершается. Читайте запись о завершении, CONNACK и счётчики сеанса; результаты проверок попадают в панель сеанса.',
  'workbench.editors.request.scripts.apiConnect':
    'подключение как составлено — URL-адрес, заголовки, параметры, подпротоколы, попытка',
  'workbench.editors.request.scripts.apiSetSubprotocols': 'заменить предложение подпротоколов',
  'workbench.editors.request.scripts.apiMessage': 'сообщение — текст, тип фрейма, индекс захвата',
  'workbench.editors.request.scripts.apiSetMessage': 'заменить исходящий текст',
  'workbench.editors.request.scripts.apiSetEvent': 'переименовать событие Socket.IO',
  'workbench.editors.request.scripts.apiDrop': 'отбросить сообщение — ничего не уходит в сеть',
  'workbench.editors.request.scripts.apiSend': 'отправить текстовый фрейм в сеанс',
  'workbench.editors.request.scripts.apiSendBinary': 'отправить двоичный фрейм (base64)',
  'workbench.editors.request.scripts.apiEmit': 'отправить событие Socket.IO',
  'workbench.editors.request.scripts.apiClose': 'запись о завершении — код закрытия, причина, счётчики, длительность',
  'workbench.editors.request.scripts.apiSession': 'состояние, общее для всех хуков этого сеанса',
  'workbench.editors.request.scripts.apiMqttConnect':
    'пакет CONNECT как составлен — идентификатор клиента, учётные данные, will, подписки, пользовательские свойства, попытка',
  'workbench.editors.request.scripts.apiSetClientId': 'заменить идентификатор клиента',
  'workbench.editors.request.scripts.apiSetUsername': 'заменить имя пользователя',
  'workbench.editors.request.scripts.apiSetPassword': 'заменить пароль',
  'workbench.editors.request.scripts.apiSetWill': 'заменить last will (null не регистрирует ничего)',
  'workbench.editors.request.scripts.apiAddSubscription': 'подписаться на фильтр топиков при открытии',
  'workbench.editors.request.scripts.apiSetUserProperty': 'задать пользовательское свойство 5.0',
  'workbench.editors.request.scripts.apiMqttMessage':
    'сообщение — топик, полезная нагрузка, QoS, retain, индекс захвата',
  'workbench.editors.request.scripts.apiSetTopic': 'перенацелить публикацию',
  'workbench.editors.request.scripts.apiSetPayload': 'заменить полезную нагрузку (текст или байты base64)',
  'workbench.editors.request.scripts.apiSetQos': 'задать QoS',
  'workbench.editors.request.scripts.apiSetRetain': 'задать флаг RETAIN',
  'workbench.editors.request.scripts.apiPublish': 'опубликовать сообщение в сеанс',
  'workbench.editors.request.scripts.apiMqttClose':
    'запись о завершении — как завершился, CONNACK, счётчики, длительность',
  'workbench.editors.request.scripts.apiInvoke':
    'вызов как составлен — цель, метод, форма вызова, метаданные, текст сообщения',
  'workbench.editors.request.scripts.apiSetMetadata': 'задать пару метаданных',
  'workbench.editors.request.scripts.apiRemoveMetadata': 'удалить пару метаданных',
  'workbench.editors.request.scripts.apiGrpcSetMessage': 'заменить текст сообщения (JSON)',
  'workbench.editors.request.scripts.apiGrpcMessage':
    'захваченный кадр — направление, тип, декодированное сообщение, индекс захвата',
  'workbench.editors.request.scripts.apiGrpcResponse':
    'запись о завершении — статус, метаданные, трейлеры, счётчики в обоих направлениях, длительность',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.followRedirects': 'Следовать перенаправлениям',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Следовать ответам HTTP 3xx к их цели. Выключите, чтобы остановиться на самом перенаправлении — ответ показывается как непрозрачное перенаправление без заголовков и тела; полезно, чтобы убедиться, что перенаправление вообще происходит.',
  'workbench.editors.request.settings.maxRedirects': 'Максимум перенаправлений',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'Сколько перенаправлений может пройти отправка, прежде чем завершиться ошибкой с указанием предела. Оставьте пустым для значения по умолчанию 20. Задайте 0, чтобы любое перенаправление приводило к ошибке.',
  'workbench.editors.request.settings.followOriginalMethod': 'Сохранять исходный HTTP-метод',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Сохранять исходный метод и тело, когда перенаправление 301, 302 или 303 обычно переключило бы запрос на GET. Перенаправления 307 и 308 сохраняют метод в любом случае.',
  'workbench.editors.request.settings.followAuthHeader': 'Сохранять заголовок Authorization',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    'Сохранять заголовок Authorization, когда перенаправление ведёт на другой источник. Обычно он отбрасывается при переходе между источниками, чтобы учётные данные никогда не уходили на хост, к которому запрос не обращался.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Учётные данные уходят на любой хост, на котором заканчивается цепочка перенаправлений. Ответ, чья цепочка действительно пересекла источники, помечается.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Отправлять файлы cookie браузера',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    'Прикреплять к этому запросу существующие файлы cookie браузера для целевого сайта. Выключено — безопасное умолчание: запрос отправляется без cookie, поэтому результаты не зависят от вашего входа в браузере.',
  'workbench.editors.request.settings.sslVerification': 'Проверка SSL-сертификата',
  'workbench.editors.request.settings.sslVerificationSummary':
    'Проверять TLS-сертификат сервера по доверенному хранилищу CA среды выполнения — включено по умолчанию.',
  'workbench.editors.request.settings.sslVerificationDescription':
    'Хост с самоподписанным, истёкшим или иначе недоверенным сертификатом завершается ошибкой TLS-сертификата — выключите проверку, чтобы всё же до него достучаться, например, до сервера разработки с самоподписанным сертификатом.',
  'workbench.editors.request.settings.sslVerificationWarning':
    'Отправки пропускают проверку подлинности сервера — принимается любой сертификат, включая самоподписанные и истёкшие.',
  'workbench.editors.request.settings.tlsMin': 'Минимальная версия TLS',
  'workbench.editors.request.settings.tlsMinSummary':
    'Наименьшая версия протокола TLS, которую может согласовать отправка — пусто сохраняет умолчание среды выполнения TLS 1.2.',
  'workbench.editors.request.settings.tlsMinDescription':
    'Выбор 1.0 или 1.1 опускает нижний предел ниже умолчания ради старых серверов — ответ, отправленный с пониженным нижним пределом, помечается.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (по умолчанию)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Отправки могут согласовать TLS ниже 1.2 — версии протокола с известными слабостями. Ответ помечается.',
  'workbench.editors.request.settings.tlsMax': 'Максимальная версия TLS',
  'workbench.editors.request.settings.tlsMaxSummary':
    'Наибольшая версия протокола TLS, которую может согласовать отправка — пусто сохраняет умолчание среды выполнения TLS 1.3.',
  'workbench.editors.request.settings.tlsMaxDescription':
    'Понизьте, чтобы проверить поведение сервера на более старом протоколе — возможно, придётся понизить и минимум, иначе они не пересекутся.',
  'workbench.editors.request.settings.tlsVersionsHeading': 'Версии',
  'workbench.editors.request.settings.tlsVersionLegacyDesc': 'Устаревшая, известные слабости — отправки помечаются.',
  'workbench.editors.request.settings.tlsVersion12Desc': 'Нижний предел по умолчанию.',
  'workbench.editors.request.settings.tlsVersion13Desc': 'Верхний предел по умолчанию — текущая лучшая практика.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (по умолчанию)',
  'workbench.editors.request.settings.tlsCipherSuites': 'Наборы шифров TLS',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'Наборы шифров, предлагаемые в TLS-рукопожатии, одним списком через двоеточие — пусто предлагает наборы среды выполнения по умолчанию.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'Сервер выбирает набор из предложенных в своём порядке предпочтения.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': 'Формат',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'Набор TLS 1.3 по его имени IANA.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'Более старый набор по его имени OpenSSL — оба вида идут в один список.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': 'Соединяет записи — без пробелов.',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Наборы среды выполнения по умолчанию',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    'Только имена наборов OpenSSL через двоеточие — без пробелов.',
  'workbench.editors.request.settings.tlsCipherSuitesExample':
    'например, TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 переходов (по умолчанию)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} переход',
      few: '{count} перехода',
      many: '{count} переходов',
      other: '{count} переходов',
    }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 МБ (по умолчанию)',
  'workbench.editors.request.settings.resetToDefault': 'Сбросить к умолчанию',
  'workbench.editors.request.settings.group.redirects': 'Перенаправления',
  'workbench.editors.request.settings.group.tls': 'TLS и доверие',
  'workbench.editors.request.settings.group.connection': 'Соединение',
  'workbench.editors.request.settings.group.cookies': 'Файлы cookie',
  'workbench.editors.request.settings.group.execution': 'Выполнение и ограничения',
  'workbench.editors.request.settings.groupInfo.connection':
    'Как отправка достигает сервера — протокол HTTP, на котором она говорит, и путь, по которому идёт соединение: напрямую, через прокси, на закреплённый адрес или в локальный сокет.',
  'workbench.editors.request.settings.groupInfo.tls':
    'Чему отправка доверяет и что предлагает в TLS-рукопожатии — проверка сертификата, окно протокола, наборы шифров и клиентский сертификат.',
  'workbench.editors.request.settings.groupInfo.redirects':
    'Что происходит, когда сервер отвечает перенаправлением — следовать ли цепочке, как далеко и что несут последующие запросы.',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Передаются ли файлы cookie с отправкой — по умолчанию выключено, чтобы результаты никогда не зависели от фонового состояния входа.',
  'workbench.editors.request.settings.groupInfo.execution':
    'Как ограничен сам запуск — режим скриптов, бюджет времени и предел размера ответа.',
  'workbench.editors.request.settings.httpVersion': 'Версия HTTP',
  'workbench.editors.request.settings.httpVersionSummary':
    'На каком HTTP говорит отправка — «Авто» (по умолчанию) предлагает HTTP/2 наряду с HTTP/1.1, и сервер выбирает.',
  'workbench.editors.request.settings.httpVersionDescription':
    'Закреплённая версия, на которой сервер не говорит, завершается понятной ошибкой, а не тихим откатом. Всплывающее окно «Сеть» на ответе всегда показывает протокол, фактически согласованный в сети.',
  'workbench.editors.request.settings.httpVersionValuesHeading': 'Значения',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'Предлагает HTTP/2 + HTTP/1.1 в TLS-рукопожатии, и сервер выбирает — обычный http:// остаётся HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion11Desc': 'Закрепляет классическую семантику HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion2Desc': 'Закрепляет HTTP/2 через предложение в рукопожатии.',
  'workbench.editors.request.settings.httpVersionPkDesc':
    'Говорит на HTTP/2 сразу, без согласования — путь для серверов HTTP/2 без шифрования.',
  'workbench.editors.request.settings.httpVersion3Desc': 'Подключается к серверу напрямую по QUIC, без отката на TCP.',
  'workbench.editors.request.settings.exampleCaption': 'Пример отправки',
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Авто — выбирает сервер',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': 'Разрешать в адрес',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'Отправлять этот запрос на конкретный адрес сервера вместо того, что ответит DNS — имя хоста из URL-адреса по-прежнему используется для TLS и заголовка Host, поэтому при включённой проверке сертификат всё равно должен ему соответствовать. Полезно, чтобы протестировать один конкретный бэкенд за балансировщиком нагрузки. URL-адрес сохраняет свой порт, и перенаправление на другой хост тоже попадает на этот адрес. Оставьте пустым, чтобы разрешать через DNS как обычно.',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'Системный DNS',
  'workbench.editors.request.settings.resolveToAddressError': 'Только IPv4- или IPv6-адрес — без имени хоста и порта.',
  'workbench.editors.request.settings.resolveToAddressExample': 'например, 10.0.0.12 или 2001:db8::1',
  'workbench.editors.request.settings.sni': 'Имя сервера SNI',
  'workbench.editors.request.settings.sniInfo':
    'Имя сервера, предъявляемое в TLS-рукопожатии вместо хоста URL-адреса — шлюз перед множеством имён на одном адресе или сертификат, выданный на имя, которое DNS не отвечает. Пусто отправляет хост URL-адреса.',
  'workbench.editors.request.settings.sniPlaceholder': 'Авто — хост URL-адреса',
  'workbench.editors.request.settings.sniExample': 'например, api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': 'Клиентский сертификат (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Предъявлять клиентский сертификат в TLS-рукопожатии — взаимный TLS (mTLS) — для API за шлюзами взаимного TLS, которые аутентифицируют вызывающего по сертификату. Выберите запись сертификата из vault — запрос сохраняет только имя записи, и каждое устройство предъявляет собственную запись vault с этим именем; сертификат и ключ никогда не покидают vault. Оставьте пустым, чтобы подключаться без клиентского сертификата.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Без клиентского сертификата',
  'workbench.editors.request.settings.clientCertificateEmpty':
    'В vault этого устройства пока нет записей клиентских сертификатов.',
  'workbench.editors.request.settings.vaultManageCertificates': 'Управлять сертификатами в vault',
  'workbench.editors.request.settings.clientCertificateDangling':
    'На этом устройстве нет записи сертификата vault с именем «{name}» — отправки будут завершаться ошибкой, пока запись не появится или эта настройка не будет очищена.',
  'workbench.editors.request.settings.proxy': 'Прокси',
  'workbench.editors.request.settings.proxySummary':
    'Как эта отправка выходит в сеть. По умолчанию она наследует системную настройку исполняющего устройства — системные настройки прокси, PAC или переменные окружения прокси — поэтому прокси, выданный корпоративной машине, просто работает; «Напрямую» выводит этот один запрос из-под любого фонового прокси, а «Свой URL-адрес» направляет его через собственный прокси.',
  'workbench.editors.request.settings.proxyDescription':
    'Метаданные ответа всегда записывают маршрут, которым отправка фактически прошла — какой прокси и решил ли это запрос или система. Поддерживаются прокси HTTP(S) и SOCKS5 — URL-адрес socks5:// работает и как свой прокси, и как системный ответ; только семейство SOCKS4 получает понятную ошибку с его именем.',
  'workbench.editors.request.settings.proxyModesHeading': 'Режимы',
  'workbench.editors.request.settings.proxyModePlaceholder': 'Наследовать — решает система',
  'workbench.editors.request.settings.proxyModeDirect': 'Напрямую — без прокси',
  'workbench.editors.request.settings.proxyModeCustom': 'Свой URL-адрес',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    'Система исполняющего устройства решает для каждого URL-адреса — прокси там, где машина настроена на него, иначе напрямую. Унаследованный прокси отступает для отправок, которые закрепляют HTTP/3, подключаются к локальному сокету или разрешаются в фиксированный адрес.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    'Никогда не использовать прокси для этого запроса, что бы ни говорили системные настройки машины.',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'Туннелировать через собственный URL-адрес прокси этого запроса — синхронизируется с запросом, один и тот же маршрут на каждом устройстве.',
  'workbench.editors.request.settings.proxyUrl': 'URL-адрес прокси',
  'workbench.editors.request.settings.proxyUrlInfo':
    'Направлять этот запрос через этот прокси HTTP(S). Соединение с целью туннелируется через прокси, поэтому обмен по https остаётся сквозным шифрованным, а проверка сертификата по-прежнему выполняется для цели. Учётные данные задаются в настройке «Учётные данные прокси» ниже, никогда — в этом URL-адресе.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    'Режиму «Свой URL-адрес» нужен URL-адрес прокси — введите его или переключите режим обратно.',
  'workbench.editors.request.settings.proxyError':
    'Только URL-адрес http://, https:// или socks5:// с хостом и портом — без учётных данных в URL-адресе.',
  'workbench.editors.request.settings.proxyUrlExample': 'например, http://127.0.0.1:8080 или socks5://127.0.0.1:1080',
  'workbench.editors.request.settings.proxyResolveConflict':
    'Также задана настройка «Разрешать в адрес», но прокси разрешает имя хоста сам — отправки будут завершаться ошибкой, пока одна из двух не будет очищена.',
  'workbench.editors.request.settings.proxyCredentials': 'Учётные данные прокси',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'Аутентифицироваться на прокси учётными данными из vault в виде user:password в строковой записи. Запрос сохраняет только имя записи, и каждое устройство разрешает его по собственному локальному vault — учётные данные никогда не покидают vault и отправляются только прокси, никогда — цели. Оставьте пустым для прокси без аутентификации.',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'Без аутентификации',
  'workbench.editors.request.settings.proxyCredentialsEmpty': 'В vault этого устройства пока нет строковых записей.',
  'workbench.editors.request.settings.vaultManageCredentials': 'Управлять учётными данными в vault',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'На этом устройстве нет строковой записи vault с именем «{name}» — отправки будут завершаться ошибкой, пока запись не появится или эта настройка не будет очищена.',
  // ── Session resilience block (WebSocket / Socket.IO / MQTT) ─────────
  'workbench.editors.request.settings.autoReconnect': 'Переподключаться автоматически',
  'workbench.editors.request.settings.autoReconnectInfo':
    'Переоткрывать сеанс, когда открытое соединение обрывается — разрыв сокета, закрытие сервером, тайм-аут простоя — повторяя подключение с периодом переподключения, пока оно не откроется снова или вы не отключитесь. Первое подключение, которое не удалось, никогда не повторяется. По умолчанию выключено.',
  'workbench.editors.request.settings.reconnectPeriod': 'Период переподключения',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    'Ожидание между попытками переподключения. Пусто — 5 с по умолчанию.',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 с (по умолчанию)',
  'workbench.editors.request.settings.reconnectMaxAttempts': 'Попытки переподключения',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    'Предел подряд идущих попыток переподключения после одного обрыва — открывшееся переподключение сбрасывает счёт; исчерпанный предел завершает сеанс как «Переподключение прекращено». Пусто — пытаться, пока сервер не вернётся или вы не отключитесь.',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': 'Без ограничения (по умолчанию)',
  'workbench.editors.request.settings.reconnectBackoff': 'Экспоненциальная задержка',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    'Удваивать ожидание после каждой неудачной попытки — период, затем 2×, 4× … до 60 с — с небольшим случайным разбросом, чтобы клиенты никогда не переподключались в унисон. По умолчанию включено; выключено — каждый раз ждать ровно период.',
  'workbench.editors.request.settings.idleTimeout': 'Тайм-аут простоя',
  'workbench.editors.request.settings.idleTimeoutInfo':
    'Закрывать соединение как потерянное, когда ничего не приходит столько времени — проверка живости, которую клиент не может сделать фреймом ping. При включённом «Переподключаться автоматически» сеанс подключается заново. Пусто — без предела простоя.',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    'Закрывать соединение как потерянное, когда ничего не приходит столько времени. При включённом «Переподключаться автоматически» сеанс подключается заново. Пусто следует рукопожатию сервера — ping ожидается каждые pingInterval и может опоздать на pingTimeout, правило официального клиента.',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': 'Выключено (по умолчанию)',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': 'Частота ping сервера (по умолчанию)',
  'workbench.editors.request.settings.heartbeatMessage': 'Сообщение heartbeat',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    'Текстовый фрейм, отправляемый с интервалом heartbeat, чтобы держать простаивающий сеанс живым через балансировщики нагрузки и прокси — что бы ни ожидал ваш сервер. Ни один клиент WebSocket не может отправить протокольный фрейм ping, поэтому keepalive — это сообщение приложения; оно захватывается как любой отправленный фрейм. Шаблоны приветствуются. Пусто — без heartbeat.',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': 'Без heartbeat',
  'workbench.editors.request.settings.heartbeatMessageExample': 'например, ping или {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': 'Интервал heartbeat',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    'Ожидание между сообщениями heartbeat. Пусто — 30 с по умолчанию, меньше отсечки простоя 60 с, которую применяет большинство балансировщиков нагрузки.',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 с (по умолчанию)',
  'workbench.editors.request.settings.unixSocket': 'Сокет Unix',
  'workbench.editors.request.settings.unixSocketInfo':
    'Подключаться к этому локальному сокету — абсолютный путь к сокету Unix или именованный канал Windows вроде \\\\.\\pipe\\name — вместо открытия TCP-соединения, например, к демону Docker или локальному сервису разработки, слушающему сокет. Хост URL-адреса больше не решает, куда идёт соединение, но заголовок Host, имя сервера TLS и проверка сертификата по-прежнему используют его, и перенаправление на другой хост тоже подключается к этому же сокету. Оставьте пустым для обычного TCP-соединения.',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'Без сокета — TCP-соединение',
  'workbench.editors.request.settings.unixSocketError':
    'Только абсолютный путь к сокету Unix (/…) или именованный канал Windows (\\\\.\\pipe\\…).',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Также задан прокси, но туннель прокси не может подключиться к локальному сокету — отправки будут завершаться ошибкой, пока одна из двух настроек не будет очищена.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Также задана настройка «Разрешать в адрес», но подключение к сокету не разрешает имя хоста — отправки будут завершаться ошибкой, пока одна из двух не будет очищена.',
  'workbench.editors.request.settings.unixSocketExample': 'например, /var/run/docker.sock',
  'workbench.editors.request.settings.cookieJar': 'Использовать хранилище cookie',
  'workbench.editors.request.settings.cookieJarInfo':
    'Сохранять ответы Set-Cookie этого запроса в собственном хранилище cookie приложения и автоматически прикреплять подходящие cookie — чтобы запрос входа и следующий за ним аутентифицированный вызов работали без копирования значений cookie вручную. Хранилище живёт в памяти для каждого рабочего пространства, используется только запросами с включённой настройкой, никогда не синхронизируется и очищается при выходе из приложения. Заголовок Cookie, заданный вами, всегда побеждает. По умолчанию выключено: cookie не прикрепляются, а ответы Set-Cookie отбрасываются.',
  'workbench.editors.request.settings.timeout': 'Тайм-аут запроса',
  'workbench.editors.request.settings.timeoutInfo':
    'Максимальное время всего запроса — подключение, ожидание ответа и чтение тела. По истечении предела отправка прерывается и завершается ошибкой тайм-аута с его указанием. Оставьте пустым, чтобы не ограничивать запрос; действуют только собственные тайм-ауты сетевого стека.',
  'workbench.editors.request.settings.timeoutPlaceholder': 'Без ограничения',
  'workbench.editors.request.settings.responseSizeLimit': 'Предел размера ответа',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Максимальный размер тела ответа, читаемый из сети; всё сверх него обрезается, и ответ помечается как обрезанный. Оставьте пустым для предела по умолчанию 2 048 КБ (2 МБ). Поднимите до 10 240 КБ (10 МБ) для крупных полезных нагрузок или понизьте, чтобы посмотреть, как выглядит обрезанный ответ.',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.maxMessageSize': 'Макс. размер сообщения',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    'Наибольшее входящее сообщение, которое принимает сеанс. Сообщение сверх предела никогда не захватывается: сеанс закрывается с кодом 1009 (Message Too Big) с указанием обоих размеров, и автопереподключение его не переоткрывает — это попросил клиент. Оставьте пустым, чтобы не ограничивать запрос; среда выполнения настольного приложения собирает сообщения до 128 МБ, браузер предела не ставит.',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': 'Без ограничения (по умолчанию)',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    'Следовать ответу 3xx на рукопожатие и подключаться к его Location — так шлюз авторизации перебрасывает апгрейды. По умолчанию выключено, собственное правило стандарта WebSocket: перенаправленное рукопожатие завершается ошибкой с указанием перенаправления. Действует, когда сеанс выполняется в настольном приложении или на сервере; браузеры никогда не следуют.',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    'Сколько перенаправлений рукопожатия может пройти подключение, прежде чем завершиться ошибкой с указанием предела. Оставьте пустым для значения по умолчанию 20.',
  'workbench.editors.request.settings.managed.browserKicker': 'Управляется браузером',
  'workbench.editors.request.settings.managed.nodeKicker': 'Управляется средой выполнения',
  'workbench.editors.request.settings.managed.browserIntro':
    'Зафиксировано браузером для каждого запроса, отправляемого из расширения — показано, чтобы вы знали, что не обсуждается.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Зафиксировано сетевой средой выполнения приложения для каждого запроса — показано, чтобы вы знали, что не обсуждается.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Скрыть настройки, управляемые браузером',
  'workbench.editors.request.settings.managed.hideNode': 'Скрыть настройки, управляемые средой выполнения',
  'workbench.editors.request.settings.managed.countBrowser': 'управляется браузером: {count}',
  'workbench.editors.request.settings.managed.countNode': 'управляется средой выполнения: {count}',
  'workbench.editors.request.settings.managed.on': 'Вкл.',
  'workbench.editors.request.settings.managed.off': 'Выкл.',
  'workbench.editors.request.settings.managed.auto': 'Авто',
  'workbench.editors.request.settings.managed.policy': 'Политика',
  'workbench.editors.request.settings.managed.browser': 'Браузер',
  'workbench.editors.request.settings.managed.browserStore': 'Хранилище браузера',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Не отправляется',
  'workbench.editors.request.settings.managed.offered': 'Предлагается',
  'workbench.editors.request.settings.managed.none': 'Нет',
  'workbench.editors.request.settings.managed.never': 'Никогда',
  'workbench.editors.request.settings.managed.websocketOnly': 'Только WebSocket',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': 'Сжатие',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    'permessage-deflate предлагается в каждом рукопожатии, и сервер решает, сжимать ли фреймы; строка «Подключено» показывает, что согласовано. Отозвать предложение для отдельного запроса нельзя.',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    'Сообщения уходят без сжатия, и grpc-encoding не согласуется; сжатый кадр от сервера показывается как сжатый, не декодируется.',
  'workbench.editors.request.settings.managed.transport': 'Транспорт',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    'Сеанс подключается к транспорту WebSocket напрямую, пропуская рукопожатие HTTP long-polling, с которого начинает и апгрейдится официальный клиент.',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC идёт только по HTTP/2: каналы TLS согласуют h2 через ALPN, каналы без шифрования говорят на h2 с prior knowledge.',
  'workbench.editors.request.settings.managed.connectionReuse': 'Повторное использование соединения',
  'workbench.editors.request.settings.managed.onePerCall': 'Одно на вызов',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    'Каждый вызов открывает собственное соединение HTTP/2 и закрывает его по завершении; между вызовами ничего не объединяется в пул и не держится открытым, поэтому keepalive работает только пока вызов открыт.',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    'Браузер никогда не следует перенаправленному рукопожатию; ответ 3xx проваливает соединение. Выполните сеанс в настольном приложении или на сервере, чтобы следовать перенаправлениям.',
  'workbench.editors.request.settings.managed.httpVersion': 'Версия HTTP',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'Браузер согласует HTTP/1.1, HTTP/2 или HTTP/3 для каждого соединения; API fetch не даёт выбрать версию.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Сертификаты проверяются по политике браузера. Запрос к хосту с недействительным сертификатом завершается ошибкой; отключить проверку для отдельного запроса нельзя.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'При перенаправлении 301/302/303 браузер переключает методы, отличные от GET, на GET согласно спецификации fetch. 307/308 всегда сохраняют метод.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'Браузер убирает заголовок Authorization, когда перенаправление ведёт на другой источник; это защитное поведение не переопределяется.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Убирать заголовок Referer при перенаправлении',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'Обработка Referer при перенаправлениях следует политике referrer браузера для контекста расширения.',
  'workbench.editors.request.settings.managed.strictParser': 'Строгий HTTP-парсер',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'Сетевой стек браузера всегда отвергает некорректные заголовки ответа; мягкого режима нет.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'HTTP-парсер среды выполнения отвергает некорректные заголовки ответа; мягкого режима нет.',
  'workbench.editors.request.settings.managed.encodeUrl': 'Кодировать URL-адрес автоматически',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'Путь и строка запроса URL-адреса кодируются парсером URL в процентном кодировании перед уходом запроса в сеть. Вводите уже закодированные последовательности, чтобы сохранить их как есть.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Порядок наборов шифров сервера',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'Согласование шифров TLS принадлежит браузеру; ни список наборов, ни порядок не настраиваются.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'API fetch ограничивает цепочку перенаправлений примерно 20 переходами. Предел для отдельного запроса нереализуем: ручной режим перенаправлений возвращает непрозрачный ответ без заголовков, по которым можно следовать.',
  'workbench.editors.request.settings.managed.tlsVersions': 'Версии протокола TLS/SSL',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Включённые версии протокола TLS зафиксированы браузером; выбор для отдельного запроса не предоставляется.',
  'workbench.editors.request.settings.managed.referer': 'Заголовок Referer',
  'workbench.editors.request.settings.managed.refererDesc':
    'У среды выполнения нет контекста страницы, поэтому Referer не уходит в сеть, если вы сами не добавите его как заголовок.',
  'workbench.editors.request.settings.managed.scripts': 'Скрипты перед запросом / после ответа',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'Здесь не выполняются',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'У хоста, отвечающего на отправки с этой поверхности, нет среды выполнения скриптов, поэтому скрипты перед запросом и после ответа пропускаются, а ответ не несёт результатов скриптов.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Безопасный режим',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'Отправки с этой поверхности выполняются на подключённом бэкенде, который запускает скрипты перед запросом и после ответа в своей изолированной безопасной среде: только API скриптов oh.* — без файловой системы, без доступа к процессам, без загрузчика модулей. Пересланные отправки никогда не выполняются в режиме разработчика, и каждый запуск записывает на ответе режим, в котором выполнялся.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Выполнение скриптов',
  'workbench.editors.request.settings.scriptModeSummary':
    'Как скрипты перед запросом и после ответа в этом рабочем пространстве выполняются на этом устройстве.',
  'workbench.editors.request.settings.scriptModeDescription':
    'Выбор действует на каждый запрос в рабочем пространстве, остаётся на этом устройстве и никогда не синхронизируется — каждый запуск записывает на ответе режим, в котором выполнялся.',
  'workbench.editors.request.settings.scriptModeModesHeading': 'Режимы',
  'workbench.editors.request.settings.scriptModeSafe': 'Безопасный режим',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Режим разработчика',
  'workbench.editors.request.settings.scriptModeWarning':
    'Режим разработчика выполняет скрипты этого рабочего пространства с полным доступом к системе — файловой системе, процессам и сети. Включайте его, только если доверяете всем, кто может редактировать скрипты этого рабочего пространства. Шаги рабочих процессов и запросы, пересланные другими устройствами, продолжают выполняться в безопасном режиме.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Выполнение скриптов: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Рекомендуется',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Скрипты выполняются в изолированной среде выполнения скриптов приложения — только API скриптов oh.*, без доступа к файловой системе и процессам, без загрузчика модулей.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Скрипты выполняются в полной среде Node.js — require, файловая система, процессы и доступ к сети.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Используйте, только если доверяете всем, кто может редактировать скрипты этого рабочего пространства',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Действует на каждый запрос в этом рабочем пространстве, только на этом устройстве — выбор никогда не синхронизируется.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie в хранилище этого рабочего пространства',
      few: '{count} cookie в хранилище этого рабочего пространства',
      many: '{count} cookie в хранилище этого рабочего пространства',
      other: '{count} cookie в хранилище этого рабочего пространства',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Содержимое хранилища Cookie',
  'workbench.editors.request.settings.jar.infoSummary':
    'Файлы cookie, которые сейчас держит хранилище этого рабочего пространства в памяти — сохранённые отправками с включённым хранилищем, прикрепляемые к подходящим отправкам с включённым хранилищем и исчезающие при выходе из приложения. Значения — учётные данные сеанса, они остаются внутри сетевой среды выполнения приложения; показываются только имя, область и срок.',
  'workbench.editors.request.settings.jar.storedHeading': 'Сохранённые файлы cookie',
  'workbench.editors.request.settings.jar.clear': 'Очистить',
  'workbench.editors.request.settings.jar.delete': 'Удалить {name}',
  'workbench.editors.request.settings.jar.expires': 'истекает {date}',
  'workbench.editors.request.settings.jar.session': 'сеанс',
  'workbench.editors.request.settings.jar.httpsOnly': 'только https',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Ответ',
  'workbench.editors.request.response.clear': 'Очистить',
  'workbench.editors.request.response.saveResponse': 'Сохранить ответ',
  'workbench.editors.request.response.createWorkflow': 'Создать рабочий процесс',
  'workbench.editors.request.response.createWorkflowNew': 'Создать новый рабочий процесс',
  'workbench.editors.request.response.createWorkflowAttach': 'Привязать к существующему рабочему процессу',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'Этот запрос не сохранён — сначала сохраните его, чтобы использовать в рабочем процессе',
  'workbench.editors.request.response.copyBody': 'Копировать тело',
  'workbench.editors.request.response.saveBodyToFile': 'Сохранить тело в файл',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'Сохранить тело в файл (обрезано — сохраняется то, что было оставлено)',
  'workbench.editors.request.response.clearResponse': 'Очистить ответ',
  'workbench.editors.request.response.moreActionsAria': 'Ещё действия с ответом',
  'workbench.editors.request.response.copied': 'Скопировано',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Тело',
  'workbench.editors.request.response.tab.headers': 'Заголовки ({count})',
  'workbench.editors.request.response.tab.cookies': 'Файлы cookie ({count})',
  'workbench.editors.request.response.tab.assertions': 'Проверки',
  'workbench.editors.request.response.tab.assertionsFailed': 'Проверки (провалено: {count})',
  'workbench.editors.request.response.tab.assertionsPassed': 'Проверки (пройдено: {count})',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Метаданные ответа',
  'workbench.editors.request.response.meta.timingTitle': 'Время',
  'workbench.editors.request.response.meta.timingSummary': 'Измерено вокруг вызова fetch: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'Платформа не записала запись resource-timing для этого запроса, поэтому разбивка по этапам недоступна.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Итого по сети {duration}. Сервер не раскрыл подробности времени этому межсайтовому запросу (нет заголовка Timing-Allow-Origin), поэтому этапы DNS / соединение / TTFB / загрузка скрыты.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Перенаправления',
  'workbench.editors.request.response.meta.phase.stalled': 'Ожидание соединения',
  'workbench.editors.request.response.meta.phase.dns': 'DNS-запрос',
  'workbench.editors.request.response.meta.phase.connect': 'TCP-соединение',
  'workbench.editors.request.response.meta.phase.tls': 'TLS-рукопожатие',
  'workbench.editors.request.response.meta.phase.waiting': 'Ожидание (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Загрузка содержимого',
  'workbench.editors.request.response.meta.totalNetwork': 'Итого (сеть)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, соединение и TLS не наблюдаемы для отдельной отправки из сетевой среды выполнения приложения — они включены в «Ожидание».',
  'workbench.editors.request.response.meta.sizeTitle': 'Размер',
  'workbench.editors.request.response.meta.sizeSummary': 'Байты в каждом направлении этого обмена.',
  'workbench.editors.request.response.meta.responseSize': 'Размер ответа',
  'workbench.editors.request.response.meta.requestSize': 'Размер запроса',
  'workbench.editors.request.response.meta.rowHeaders': 'Заголовки',
  'workbench.editors.request.response.meta.rowBody': 'Тело',
  'workbench.editors.request.response.meta.rowCompressed': 'Сжато',
  'workbench.editors.request.response.meta.rowTransferred': 'Передано',
  'workbench.editors.request.response.meta.noteHeaderBytes': 'Байты заголовков как видны — HTTP/2+ сжимает их в сети.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Заголовки запроса считают только то, что задала эта отправка; браузер добавляет свои (Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    'Заголовки запроса считают только то, что задала эта отправка; среда выполнения добавляет свои (Host, Accept-Encoding, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Тело обрезано по пределу размера ответа {cap}; полный размер учтён.',
  'workbench.editors.request.response.meta.noteTruncated': 'Просмотр тела обрезан; полный размер учтён.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'Размер тела запроса приблизительный — boundary для multipart создаёт браузер.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Размеры в сети (сжато, передано) скрыты: сервер не отправил Timing-Allow-Origin.',
  'workbench.editors.request.response.meta.networkTitle': 'Сеть',
  'workbench.editors.request.response.meta.networkSummary': 'Факты уровня соединения для этого обмена.',
  'workbench.editors.request.response.meta.httpVersion': 'Версия HTTP',
  'workbench.editors.request.response.meta.localAddress': 'Локальный адрес',
  'workbench.editors.request.response.meta.remoteAddress': 'Удалённый адрес',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'Версия HTTP скрыта: согласованный протокол не был наблюдаем для этой отправки (отправки через прокси согласуют его внутри туннеля).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'Версия HTTP скрыта: платформа не записала запись времени для этого запроса.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Удалённый адрес недоступен: сетевой захват ничего не увидел для этого fetch.',
  'workbench.editors.request.response.meta.tlsProtocol': 'Протокол TLS',
  'workbench.editors.request.response.meta.tlsCipher': 'Имя шифра',
  'workbench.editors.request.response.meta.tlsCertificate': 'CN сертификата',
  'workbench.editors.request.response.meta.tlsIssuer': 'CN издателя',
  'workbench.editors.request.response.meta.tlsValidUntil': 'Действителен до',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': 'Сертификат не проверен ({code})',
  'workbench.editors.request.response.meta.trustPinned':
    'Сертификат закреплён на этом устройстве — отправьте снова, чтобы проверить.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Локальный адрес, TLS и сведения о сертификате не раскрываются коду расширения в Chromium.',
  'workbench.editors.request.response.meta.tlsSelfSigned': 'Самоподписанный сертификат',
  'workbench.editors.request.response.meta.tlsUnverified': 'Сертификат не проверен',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'Нижний предел TLS понижен',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'Этот запрос был отправлен с минимальной версией TLS ниже 1.2 в его настройках, поэтому соединению было разрешено согласовать TLS 1.0 или 1.1 — версии протокола с известными слабостями, которые среды выполнения отключают по умолчанию.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization передан',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'Перенаправление увело этот запрос на другой источник, а его настройки сохраняют заголовок Authorization между источниками — поэтому учётные данные были повторно отправлены новому хосту. Обычно заголовок отбрасывается, когда перенаправление покидает исходный источник.',
  'workbench.editors.request.response.meta.authTitle': 'Авторизация',
  'workbench.editors.request.response.meta.authSummaryRequest':
    'Отправлено с собственной конфигурацией {type} запроса.',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type} — унаследовано от {source}.',
  'workbench.editors.request.response.meta.authSummaryNone':
    'Отправлено без авторизации — над запросом ничего не задано.',
  'workbench.editors.request.response.meta.authDangling':
    'Записи, которую выбрал запрос, больше нет — вместо неё применилась запись по умолчанию.',
  // The Inherited settings tag — the knobs the run took from the
  // levels above the request, each listed against its source.
  'workbench.editors.request.response.meta.inheritedSettingsTag': 'Унаследованные настройки · {count}',
  'workbench.editors.request.response.meta.inheritedSettingsTitle': 'Унаследованные настройки',
  'workbench.editors.request.response.meta.inheritedSettingsSummary':
    'Настройки, которые запуск взял из коллекции или папки над запросом — разрешённые так, как их показывает вкладка «Настройки»: собственные значения запроса побеждают цепочку.',
  'workbench.editors.request.response.meta.inheritedSettingsHeading': 'Настройка · источник',
  'workbench.editors.request.response.meta.scriptsTag': 'Скрипты · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': 'Цепочка скриптов',
  'workbench.editors.request.response.meta.scriptsSummary':
    'Каждый уровень цепочки выполнился и завершился успешно — скрипты коллекции и папки перед собственными скриптами запроса, как перед запросом, так и после ответа. Записано по тому, что запуск фактически сделал.',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    'Один из уровней цепочки завершился ошибкой — строки ниже называют какой и почему.',
  'workbench.editors.request.response.meta.scriptsLevelRequest': 'Запрос',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
  'workbench.editors.request.response.meta.executedOnTag': 'Отправлено с {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Выполнено на подключённом бэкенде',
  'workbench.editors.request.response.meta.executedOnSummary':
    'Этот запрос отправил «{name}» — бэкенд, к которому подключена эта поверхность, — а не это устройство. Целевой сервер видел IP-адрес и расположение в сети той машины, поэтому поведение по гео- или IP-признаку отражает то, где работает бэкенд. Записано на этом запуске хостом, который его выполнил.',
  'workbench.editors.request.response.meta.cookieJar': 'Хранилище Cookie',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'Этот запрос использовал хранилище cookie рабочего пространства в памяти: подходящие сохранённые cookie были прикреплены автоматически, а ответы Set-Cookie сохранены для последующих отправок с включённым хранилищем.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Прикреплено к первому запросу',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Ничего — ни один сохранённый cookie не подошёл, или победил заголовок Cookie, заданный на запросе.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Сохранено из ответов Set-Cookie',
  'workbench.editors.request.response.meta.jarStoredNone': 'Ничего — ни один ответ не задал cookie.',
  'workbench.editors.request.response.meta.proxyTag': 'Через прокси',
  'workbench.editors.request.response.meta.proxyTitle': 'Маршрут прокси',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    'Этот запуск туннелировался через прокси, заданный в собственных настройках запроса — записано по тому, что отправка фактически сделала.',
  'workbench.editors.request.response.meta.proxySummarySystem':
    'Этот запуск туннелировался через прокси, который называет система исполняющего устройства — записано по тому, что запуск фактически сделал, а не по живому чтению настроек.',
  'workbench.editors.request.response.meta.proxyRowUrl': 'Прокси',
  'workbench.editors.request.response.meta.proxyRowSource': 'Кем решено',
  'workbench.editors.request.response.meta.proxySourceRequest': 'Настройки запроса',
  'workbench.editors.request.response.meta.proxySourceDevice': 'Настройки прокси устройства',
  'workbench.editors.request.response.meta.proxySourceEnv': 'Переменные окружения',
  'workbench.editors.request.response.meta.proxySourceSystem': 'Системные настройки прокси',
  'workbench.editors.request.response.meta.proxySourceManual': 'Ручная настройка прокси',
  'workbench.editors.request.response.meta.proxySourcePac': 'PAC-скрипт',
  'workbench.editors.request.response.meta.proxyStandDownTag': 'Прокси обойдён',
  'workbench.editors.request.response.meta.proxyStandDownTitle': 'Системный прокси отступил',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    'Система называет прокси, но этот запуск нацелен на локальный сокет, к которому туннель прокси не может подключиться — он прошёл напрямую.',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    'Система называет прокси, но этот запуск закрепляет собственное разрешение адреса, которое прокси переопределил бы — он прошёл напрямую.',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    'Система называет прокси, но этот запуск закреплён за HTTP/3, который подключается по собственному пути QUIC — он прошёл напрямую.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} перенаправление',
      few: '{count} перенаправления',
      many: '{count} перенаправлений',
      other: '{count} перенаправлений',
    }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Цепочка перенаправлений',
  'workbench.editors.request.response.meta.redirectsSummary':
    'Переходы, которые этот запрос прошёл до итогового ответа — каждый показывает отправленный запрос и перенаправление, которым тот ответил; записано при выполнении отправки.',
  'workbench.editors.request.response.meta.redirectMethodChanged': 'Метод изменён на {method} для следующего запроса',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Заголовок Authorization отброшен — следующий запрос ушёл на другой источник',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Заголовок Authorization повторно отправлен между источниками — сохранён настройками этого запроса',
  'workbench.editors.request.response.meta.redirectFinal': 'Итоговый ответ',
  'workbench.editors.request.response.meta.streamedEnd': 'Поток завершён',
  'workbench.editors.request.response.meta.streamedStop': 'Остановлено',
  'workbench.editors.request.response.meta.streamedCap': 'Поток обрезан по пределу',
  'workbench.editors.request.response.meta.streamedTimeout': 'Тайм-аут посреди потока',
  'workbench.editors.request.response.meta.streamedError': 'Сбой потока',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'Этот ответ приходил потоком в реальном времени, пока сервер не закрыл поток. Тело ниже — полный захват.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    'Ответ ещё шёл потоком, когда обмен завершился, поэтому тело ниже — частичный захват до этого момента; всё, что пришло, сохранено.',
  'workbench.editors.request.response.streamReceiving': 'Приём потока — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Подключено к {url}',
  'workbench.editors.request.response.sse.closed': 'Соединение закрыто',
  'workbench.editors.request.response.sse.stopped': 'Соединение остановлено',
  'workbench.editors.request.response.sse.capped': 'Захват обрезан — достигнут предел тела',
  'workbench.editors.request.response.sse.timedOut': 'Тайм-аут соединения',
  'workbench.editors.request.response.sse.failed': 'Сбой соединения',
  'workbench.editors.request.response.sse.searchEvents': 'Поиск событий',
  'workbench.editors.request.response.sse.noMatches': 'Нет подходящих событий.',
  'workbench.editors.request.response.sse.waiting': 'Ожидание событий…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} событие',
      few: '{count} события',
      many: '{count} событий',
      other: '{count} событий',
    }),
  'workbench.editors.request.response.sse.clearEvents': 'Очистить события (только отображение)',
  'workbench.editors.request.response.sse.newEvents': 'Новые события',
  'workbench.editors.request.response.sse.sortOrder': 'Порядок сортировки',
  'workbench.editors.request.response.sse.newestFirst': 'Сначала новые',
  'workbench.editors.request.response.sse.oldestFirst': 'Сначала старые',
  'workbench.editors.request.response.sse.groupByName': 'Группировать по имени события',
  'workbench.editors.request.response.sse.rowsPerGroup': 'Строк в группе',
  'workbench.editors.request.response.sse.noLimit': 'Без ограничения',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Размер',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': 'Сведения о событии',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Ответ обрезан по {cap} (исходно {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Увеличить предел',
  'workbench.editors.request.response.body.limitHint': 'Предел настраивается в настройках «API-запросы».',
  'workbench.editors.request.response.body.viewPickerAria': 'Вид тела',
  'workbench.editors.request.response.body.preview': 'Предпросмотр',
  'workbench.editors.request.response.body.wrapLines': 'Переносить строки',
  'workbench.editors.request.response.body.unwrapLines': 'Не переносить строки',
  'workbench.editors.request.response.body.renderAnsi': 'Отображать цвета ANSI',
  'workbench.editors.request.response.body.plainAnsi': 'Показать обычный текст',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Фильтр тела (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Фильтр тела (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Фильтр тела (семейства метрик)',
  'workbench.editors.request.response.body.filterAria': 'Фильтр тела',
  'workbench.editors.request.response.body.invalidJsonPath': 'Недопустимое выражение JSONPath.',
  'workbench.editors.request.response.body.invalidXPath': 'Недопустимое выражение XPath, или документ не разбирается.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Недопустимый селектор метрик.',
  'workbench.editors.request.response.body.noMatches': 'Нет совпадений по этому пути.',
  'workbench.editors.request.response.body.showingLastMatch': 'Показано последнее совпадение.',
  'workbench.editors.request.response.body.hexCapNotice': 'Hex-просмотрщик показывает первые {shown} из {total}.',
  'workbench.editors.spec.tab': 'Спецификация',
  'workbench.editors.spec.noSpecs': 'В этом рабочем пространстве пока нет спецификации {format}.',
  'workbench.editors.spec.goToSpecs': 'К спецификациям',
  'workbench.editors.timelineViewer.format': 'Формат сообщения',
  'workbench.editors.timelineViewer.showMessage': 'Показать сообщение',
  'workbench.editors.timelineViewer.showHexdump': 'Показать hexdump',
  'workbench.editors.request.response.body.previewIframeTitle': 'Предпросмотр ответа',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'Предпросмотр PDF',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Изображение ответа',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'Данные изображения не декодируются — сырые байты смотрите в Hex-просмотрщике.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Предпросмотр медиа',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'Медиаданные не декодируются — сырые байты смотрите в Hex-просмотрщике.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Тело запроса не отправлено — браузер не может прикрепить тело к запросам GET или HEAD.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Дублирующиеся ключи JSON — показано последнее значение: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Тело обрезано — предпросмотр и фильтр показывают только полностью захваченные значения.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'Декодирование без схемы (по возможности) — показаны номера полей; вложенность и текст выведены из байтов в сети.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Имя',
  'workbench.editors.request.response.headers.value': 'Значение',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Фильтр заголовков',
  'workbench.editors.request.response.headers.copyAll': 'Копировать все заголовки',
  'workbench.editors.request.response.headers.copyAria': 'Копировать {name}',
  'workbench.editors.request.response.headers.copyTitle': 'Копировать заголовок',
  'workbench.editors.request.response.headers.empty': 'Нет заголовков',
  'workbench.editors.request.response.headers.noMatch': 'Нет заголовков, соответствующих «{query}»',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Имя',
  'workbench.editors.request.response.cookies.value': 'Значение',
  'workbench.editors.request.response.cookies.copyAria': 'Копировать Set-Cookie для {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Копировать строку Set-Cookie',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'Этот запрос выполнялся с включёнными учётными данными, поэтому браузер мог сохранить эти cookie (с учётом атрибутов каждого cookie) и будет отправлять их в будущих запросах с учётными данными.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'Сервер отправил эти cookie, но запрос выполнялся без учётных данных (по умолчанию), поэтому браузер отбросил их — ничего не сохранено.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'Эти cookie не сохранены — запрос выполнялся без хранилища cookie (по умолчанию), или хранилище не приняло ни один из них.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'Этот запрос выполнялся с включённым хранилищем cookie, которое сохранило {names} в хранилище рабочего пространства в памяти для будущих запросов с включённым хранилищем.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'Этот запрос выполнялся с включённым хранилищем cookie, которое сохранило {names} в хранилище рабочего пространства в памяти для будущих запросов с включённым хранилищем. Некоторые были заданы на промежуточных переходах перенаправлений, поэтому их строки Set-Cookie здесь не перечислены — показаны только заголовки итогового ответа.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'ПРОЙДЕН',
  'workbench.editors.request.response.assertions.fail': 'ПРОВАЛЕН',
  'workbench.editors.request.response.console.preRequest': 'Перед запросом',
  'workbench.editors.request.response.console.postResponse': 'После ответа',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Отправка запроса…',
  'workbench.editors.request.response.empty.prompt': 'Отправьте запрос, чтобы увидеть ответ здесь.',
  'workbench.editors.request.response.error.title': 'Не удалось отправить запрос',
  'workbench.editors.request.response.error.openInTab': 'Открыть в новой вкладке',
  'workbench.editors.request.response.error.trust.title': 'Доверять сертификату, который предъявил {origin}',
  'workbench.editors.request.response.error.trust.probing': 'Чтение сертификата, который предъявляет сервер…',
  'workbench.editors.request.response.error.trust.probeFailed': 'Не удалось прочитать сертификат сервера: {message}',
  'workbench.editors.request.response.error.trust.retryProbe': 'Повторить',
  'workbench.editors.request.response.error.trust.failure': 'Сбой',
  'workbench.editors.request.response.error.trust.noAnchor':
    'Сервер не предъявляет свой корневой сертификат, поэтому здесь нечего закрепить. Добавьте выпустивший CA в разделе Настройки › API-запросы › TLS.',
  'workbench.editors.request.response.error.trust.trustOnDevice': 'Доверять на этом устройстве',
  'workbench.editors.request.response.error.trust.addToWorkspace': 'Добавить в рабочее пространство',
  'workbench.editors.request.response.error.certSteps.summary':
    'Локальные серверы разработки обычно работают с самоподписанным сертификатом, который нужно принять.',
  'workbench.editors.request.response.error.certSteps.step1': 'Откройте URL-адрес в новой вкладке',
  'workbench.editors.request.response.error.certSteps.step2': 'Примите предупреждение о сертификате',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium':
    'Дополнительные → Перейти на сайт (небезопасно)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Дополнительно… → Принять риск и продолжить',
  'workbench.editors.request.response.error.certSteps.step3': 'Отправьте запрос снова',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'новая вкладка',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Дополнительные',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Отправить',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Перейти на сайт (небезопасно)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Принять риск и продолжить',
} as const satisfies Catalog;
