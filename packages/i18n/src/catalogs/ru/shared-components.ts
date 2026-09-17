/**
 * Shared component families — Russian. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for
 * the family map and the raw technical plane (`{{ns.*}}` references,
 * claim/algorithm names, key caps and glyphs, format examples). Mints:
 * переменная = variable; окружение = environment; коллекция =
 * collection; секрет = secret; генератор = generator; область = scope;
 * ссылка = reference; устаревший = stale; захват = capture; док =
 * dock; окно инструментов = tool window; оглавление = table of
 * contents; параметр = parameter; директива = directive; имитация /
 * имитировать = mock; внедрить = inject; отбросить = drop; заменить =
 * replace; переопределение = override (Live). JWT part names (Header /
 * Payload / Signature) and header field names ride raw — RFC
 * vocabulary; the hyphenated apposition carries them into prose
 * (JWT-редактор, JSON-значение, URL-параметры, CSP-директивы). The two
 * peer-execute notices quote the Backup and Sync › Your devices row
 * labels — the ru settings file quotes THESE values verbatim when it
 * lands («Разрешить браузерам этого устройства отправлять запросы»,
 * «Разрешить другим подключённым устройствам отправлять запросы»,
 * «Резервное копирование и синхронизация › Ваши устройства»).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Изменить значение',
  'shared.templateInput.showValue': 'Показать значение',
  'shared.templateInput.hideValue': 'Скрыть значение',
  'shared.templateInput.clearValue': 'Очистить значение',
  'shared.templateInput.unresolvedDot': 'Содержит неразрешённую переменную',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Создать переменную «{name}»',
  'shared.templateInput.createNamedInScope': 'Создать переменную «{name}» в области {scope}',
  'shared.templateInput.noMatches': 'Нет совпадений',
  'shared.templateInput.footerNavigate': '↑↓ переход',
  'shared.templateInput.footerSelect': '↵ выбрать',
  'shared.templateInput.footerClose': 'esc закрыть',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': 'Захватывается во время выполнения',
  'shared.templateInput.totpPreview': 'TOTP, {digits} цифр · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP, {digits} цифр · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(пусто)',
  'shared.templateInput.staleBadge': 'устарело',
  'shared.templateInput.needsRerunBadge': 'нужен повторный запуск',
  'shared.templateInput.disabledBadge': 'выключено',
  // Namespace-scaffold / reserved rows: core mints the English subtitle
  // for its own (locale-free) plane; the UI resolves these keys from the
  // row's kind + scope instead of rendering core's copy.
  'shared.templateInput.scaffold.vault': 'Добавить секрет',
  'shared.templateInput.scaffold.env': 'Добавить переменную окружения',
  'shared.templateInput.scaffold.collection': 'Добавить переменную коллекции',
  'shared.templateInput.scaffold.workspace': 'Добавить переменную рабочего пространства',
  'shared.templateInput.scaffold.dynamic': 'Встроенные генераторы — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'Ссылки на файлы появятся позже',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Введите значение',
  'shared.templateInput.foundIn': 'Найдено в:',
  'shared.templateInput.scopeFixedTooltip':
    'Область задана префиксом {prefix} — чтобы изменить её, отредактируйте ссылку.',
  'shared.templateInput.addToScope': 'Добавить в: {scope}',
  'shared.templateInput.addToPickScope': 'Добавить в: выберите область',
  'shared.templateInput.resolvedDefault': 'Разрешено: по умолчанию',
  'shared.templateInput.resolvedDefaultNoEnv': 'Разрешено: по умолчанию (нет активного окружения)',
  'shared.templateInput.noActiveEnvHint':
    'Окружение не выбрано — выберите его в переключателе окружений, чтобы добавить переменную окружения.',
  'shared.templateInput.noCollectionHint':
    'Нет активной коллекции — откройте коллекцию, чтобы добавить переменную коллекции.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Окружение · {name}',
  'shared.templateInput.scope.collectionNamed': 'Коллекция · {name}',
  'shared.templateInput.scope.workspace': 'Рабочее пространство',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · переопределение',
  'shared.templateInput.scope.stepNamed': 'Шаг · {capture}',
  'shared.templateInput.scope.fileNamed': 'Файл · {name}',
  'shared.templateInput.scope.dynamic': 'Динамическая',
  'shared.templateInput.scope.unresolved': 'Не разрешена',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Окружение',
  'shared.templateInput.createScope.collection': 'Коллекция',
  'shared.templateInput.createScope.workspace': 'Рабочее пространство',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'нет активного окружения',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Пустая ссылка',
  'shared.templateInput.unresolved.unknownNamespace': 'Неизвестное пространство имён',
  'shared.templateInput.unresolved.dynamic':
    'Встроенного генератора с таким именем нет. Выберите его из списка подсказок {{dynamic.…}}.',
  'shared.templateInput.unresolved.step': 'Разрешается только во время выполнения цепочки рабочего процесса Live.',
  'shared.templateInput.unresolved.envNotSet': 'Не задана в окружении «{name}».',
  'shared.templateInput.unresolved.noActiveEnv': 'Активное окружение не выбрано.',
  'shared.templateInput.unresolved.live': 'Переменной Live с таким именем нет (или значение ещё не закешировано).',
  'shared.templateInput.unresolved.notDefined': 'Не определена ни в одной области.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Выберите область в поле «Добавить в»',
  'shared.templateInput.save.totpInVaultEditor': 'Секреты TOTP редактируются в редакторе Vault',
  'shared.templateInput.save.vaultKindChanged': 'Тип записи Vault изменился в процессе работы',
  'shared.templateInput.save.notEditable': 'Недоступно для редактирования',
  'shared.templateInput.save.noActiveEnv': 'Нет активного окружения',
  'shared.templateInput.save.noCollection': 'Нет коллекции в контексте',
  'shared.templateInput.save.saved': 'Сохранено',
  'shared.templateInput.save.duplicateName': 'Переменная с таким именем уже существует в этой области.',
  'shared.templateInput.save.notFound': 'Переменная не найдена — возможно, она была удалена.',
  'shared.templateInput.save.failed': 'Не удалось сохранить',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Сделать переменной',
  'shared.templateInput.setAsNewVariable': 'Сделать новой переменной',
  'shared.templateInput.variableName': 'Имя переменной',
  'shared.templateInput.variableValue': 'Значение переменной',
  'shared.templateInput.valuePlaceholder': 'Значение',
  'shared.templateInput.menu.cut': 'Вырезать',
  'shared.templateInput.menu.paste': 'Вставить',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Секрет Vault',
  'shared.templateInput.completion.scope.env': 'Окружение',
  'shared.templateInput.completion.scope.collection': 'Коллекция',
  'shared.templateInput.completion.scope.workspace': 'Рабочее пространство',
  'shared.templateInput.completion.scope.live': 'Источник',
  'shared.templateInput.completion.scope.step': 'Захват шага потока источника',
  'shared.templateInput.completion.scope.file': 'Ссылка на файл',
  'shared.templateInput.completion.scope.dynamic': 'Динамический генератор',
  'shared.templateInput.completion.staleSuffix': '(устарело)',
  'shared.templateInput.completion.comingSoon': 'скоро',
  'shared.templateInput.completion.capturedAtRuntime': 'захватывается во время выполнения',
  'shared.templateInput.completion.totpDetail': 'Код TOTP ({digits} цифр, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Значение скрыто (конфиденциальная область).',
  'shared.templateInput.completion.valueHiddenStale': 'Значение скрыто (устаревшая переменная Live).',
  'shared.templateInput.completion.valueDoc': '**Значение:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Устаревшее значение:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'Захватывается при запуске рабочего процесса.',
  'shared.templateInput.completion.totpDoc': '**Код TOTP** — {algorithm}, {digits} цифр, обновляется каждые {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**Код TOTP** для **{issuer}** — {algorithm}, {digits} цифр, обновляется каждые {period}s.',
  'shared.templateInput.completion.secretManagerDoc':
    '**Ссылка на менеджер секретов** — `{reference}`. Разрешается из менеджера при отправке; значение никогда ' +
    'не сохраняется.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Декодировано',
  'shared.valueEditors.encodedPreview': 'Предпросмотр в закодированном виде',
  'shared.valueEditors.cannotEncode': 'Не удаётся закодировать — изменённое значение недопустимо для этого типа',
  'shared.valueEditors.encodedCopied': 'Закодированное значение скопировано в буфер обмена',
  'shared.valueEditors.copyFailed': 'Не удалось скопировать в буфер обмена',
  'shared.valueEditors.openAsDocument': 'Открыть как документ',
  'shared.valueEditors.decode': 'Декодировать',
  'shared.valueEditors.decodeChipView': 'Просмотреть декодированное — {title}',
  'shared.valueEditors.decodeChipEdit': 'Декодировать и изменить — {title}',
  'shared.valueEditors.editJwt': 'Изменить JWT',
  'shared.valueEditors.viewJwt': 'Просмотреть JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Декодированное значение',
  'shared.valueEditors.glance.openTab': 'Открыть в новой вкладке',
  'shared.valueEditors.glance.openModal': 'Открыть в модальном окне',
  'shared.valueEditors.glance.moreClaims': 'ещё {count}',
  'shared.valueEditors.glance.signatureElided':
    'Подпись не показана — откройте документ или модальное окно, чтобы увидеть токен целиком.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Имя',
  'shared.valueEditors.grid.key': 'Ключ',
  'shared.valueEditors.grid.value': 'Значение',
  'shared.valueEditors.grid.flag': 'флаг',
  'shared.valueEditors.grid.ariaNamePairs': 'Пары имя/значение',
  'shared.valueEditors.grid.ariaKeyPairs': 'Пары ключ/значение',
  'shared.valueEditors.grid.ariaRowName': 'Имя в строке {row}',
  'shared.valueEditors.grid.ariaRowKey': 'Ключ в строке {row}',
  'shared.valueEditors.grid.ariaRowValue': 'Значение в строке {row}',
  'shared.valueEditors.grid.moveRowUp': 'Переместить строку {row} вверх',
  'shared.valueEditors.grid.moveRowDown': 'Переместить строку {row} вниз',
  'shared.valueEditors.grid.deleteRow': 'Удалить строку {row}',
  'shared.valueEditors.grid.addRow': 'Добавить строку',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT-редактор',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Изменено',
  'shared.valueEditors.jwt.decodeErrorTitle': 'Не удалось декодировать токен',
  'shared.valueEditors.jwt.decoded': 'Декодировано',
  'shared.valueEditors.jwt.encoded': 'Закодировано',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims:',
  'shared.valueEditors.jwt.rawToken': 'Исходный токен',
  'shared.valueEditors.jwt.pasteOrEdit': 'Вставьте или отредактируйте исходный токен',
  'shared.valueEditors.jwt.notDecodable': 'Не является декодируемым JWT',
  'shared.valueEditors.jwt.structure': 'Структура:',
  'shared.valueEditors.jwt.resignWithSecret': 'Переподписать секретом',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} из части Header',
  'shared.valueEditors.jwt.signingSecret': 'Секрет для подписи',
  'shared.valueEditors.jwt.secretMemoryNote': 'Хранится только в памяти и удаляется при закрытии редактора.',
  'shared.valueEditors.jwt.tokenExpired': 'Срок действия токена истёк',
  'shared.valueEditors.jwt.tokenNotExpired': 'Срок действия токена не истёк',
  'shared.valueEditors.jwt.expiredOn': 'Истёк {date}',
  'shared.valueEditors.jwt.expiresOn': 'Истекает {date}',
  'shared.valueEditors.jwt.resigned': 'Токен переподписан алгоритмом {algorithm}',
  'shared.valueEditors.jwt.resignedDescription':
    'При сохранении записывается токен, подписанный вашим секретом — предпросмотр выше в точности совпадает с тем, ' +
    'что будет сохранено.',
  'shared.valueEditors.jwt.cannotResign': 'Этот алгоритм нельзя переподписать',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Здесь можно переподписать только алгоритмы HMAC (HS256, HS384, HS512). Вместо этого сохраняется исходная ' +
    'часть Signature.',
  'shared.valueEditors.jwt.signError': 'Не удалось подписать токен',
  'shared.valueEditors.jwt.signatureInvalid': 'Часть Signature больше не действительна',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    'Исходная часть Signature сохраняется как есть, поэтому серверы, проверяющие её, отклонят изменённый токен. ' +
    'Введите секрет для подписи, чтобы переподписать его.',
  'shared.valueEditors.jwt.copied': 'JWT скопирован в буфер обмена',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'Payload JWT',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL-кодированное значение',
  'shared.valueEditors.valueTitle.base64': 'Значение Base64',
  'shared.valueEditors.valueTitle.hex': 'Hex-кодированное значение',
  'shared.valueEditors.valueTitle.timestamp': 'Метка времени Unix',
  'shared.valueEditors.valueTitle.json': 'JSON-значение',
  'shared.valueEditors.valueTitle.jsonString': 'Строка в кавычках',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Значение Cookie',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP-дата',
  'shared.valueEditors.valueTitle.queryString': 'Строка запроса',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Заголовок Link',
  'shared.valueEditors.valueTitle.authParams': 'Параметры Authorization',
  'shared.valueEditors.valueTitle.acceptList': 'Список Accept',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Секрет Vault',
  'shared.scopeColors.environment': 'Переменная окружения',
  'shared.scopeColors.collection': 'Переменная коллекции',
  'shared.scopeColors.workspace': 'Переменная рабочего пространства',
  'shared.scopeColors.live': 'Переменная Live (из рабочего процесса)',
  'shared.scopeColors.step': 'Захват шага рабочего процесса',
  'shared.scopeColors.file': 'Ссылка на файл',
  'shared.scopeColors.dynamic': 'Динамический генератор',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Изменить как JWT',
  'shared.valueEditors.editTooltip.urlEncoded': 'Изменить URL-кодированное значение',
  'shared.valueEditors.editTooltip.base64': 'Изменить значение Base64',
  'shared.valueEditors.editTooltip.hex': 'Изменить hex-кодированное значение',
  'shared.valueEditors.editTooltip.timestamp': 'Изменить метку времени',
  'shared.valueEditors.editTooltip.json': 'Изменить как JSON',
  'shared.valueEditors.editTooltip.jsonString': 'Изменить строку в кавычках',
  'shared.valueEditors.editTooltip.dataUri': 'Изменить содержимое data URI',
  'shared.valueEditors.editTooltip.cookie': 'Изменить пары cookie',
  'shared.valueEditors.editTooltip.csp': 'Изменить CSP-директивы',
  'shared.valueEditors.editTooltip.httpDate': 'Изменить HTTP-дату',
  'shared.valueEditors.editTooltip.queryString': 'Изменить пары запроса',
  'shared.valueEditors.editTooltip.cacheControl': 'Изменить директивы кеширования',
  'shared.valueEditors.editTooltip.hsts': 'Изменить директивы HSTS',
  'shared.valueEditors.editTooltip.contentDisposition': 'Изменить параметры disposition',
  'shared.valueEditors.editTooltip.link': 'Изменить ссылки',
  'shared.valueEditors.editTooltip.authParams': 'Изменить параметры авторизации',
  'shared.valueEditors.editTooltip.acceptList': 'Изменить список Accept',

  // ── Default entity names (multi-surface: sidebar create actions +
  //    save-modal prefilled collection create). 'User Templates' is NOT
  //    here — it identity-compares against the background seed and
  //    stays raw everywhere. ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'Новая коллекция правил',
  'shared.defaults.newRequestsCollection': 'Новая коллекция запросов',
  'shared.defaults.newEnvironment': 'Новое окружение',
  'shared.defaults.newSpec': 'Новая спецификация',

  // ── Rule-type registry (multi-surface: workbench create menus +
  //    overviews + command palette + tool-window info, popup
  //    AddRulePalette). Labels and descriptions single-source every
  //    create/picker menu; type ids and code badges (HDR…) stay raw. ──
  'shared.ruleTypes.header.label': 'Изменить заголовки',
  'shared.ruleTypes.header.description': 'Добавить, переопределить или удалить HTTP-заголовки',
  'shared.ruleTypes.requestBody.label': 'Изменить тело API-запроса',
  'shared.ruleTypes.requestBody.description': 'Переопределить или преобразовать тело API-запроса (только fetch/XHR)',
  'shared.ruleTypes.response.label': 'Изменить API-ответ',
  'shared.ruleTypes.response.description':
    'Имитировать или изменить статус, тело и заголовки API-ответа (только fetch/XHR)',
  'shared.ruleTypes.queryParam.label': 'Изменить параметры запроса',
  'shared.ruleTypes.queryParam.description': 'Добавить, переопределить или удалить URL-параметры',
  'shared.ruleTypes.inject.label': 'Внедрить скрипт/стили',
  'shared.ruleTypes.inject.description': 'Внедрить JavaScript или CSS на страницы',
  'shared.ruleTypes.ws.label': 'Изменить сообщения WebSocket',
  'shared.ruleTypes.ws.description': 'Заменить, внедрить или отбросить фреймы WebSocket (только сокеты страницы)',
  'shared.ruleTypes.sse.label': 'Изменить Server-Sent Events',
  'shared.ruleTypes.sse.description': 'Заменить, внедрить или отбросить события SSE (только потоки страницы)',
  'shared.ruleTypes.block.label': 'Блокировать запросы',
  'shared.ruleTypes.block.description': 'Не давать запросам завершиться',
  'shared.ruleTypes.redirect.label': 'Перенаправлять запросы',
  'shared.ruleTypes.redirect.description': 'Перенаправлять на другой URL-адрес',
  'shared.ruleTypes.delay.label': 'Задерживать запросы',
  'shared.ruleTypes.delay.description': 'Добавить задержку к сетевым запросам (только fetch/XHR)',
  'shared.ruleTypes.auth.label': 'Отвечать на запрос аутентификации',
  'shared.ruleTypes.auth.description':
    'Передавать учётные данные в ответ на запрос аутентификации HTTP или прокси (требуется режим отладки)',

  // ── Request-kind registry ──────────────────────────────────────────
  'shared.requestKinds.http.label': 'HTTP',
  'shared.requestKinds.grpc.label': 'gRPC',
  'shared.requestKinds.websocket.label': 'WebSocket',
  'shared.requestKinds.socketio.label': 'Socket.IO',
  'shared.requestKinds.mqtt.label': 'MQTT',
  'shared.requestKinds.graphql.label': 'GraphQL',

  // ── System rule-template registry (same surfaces as the rule types).
  //    Template keys, icons, conditions, and form values stay raw data;
  //    embedded code/URLs inside descriptions travel inside the value. ──
  'shared.ruleTemplates.blankRule': 'Пустое правило',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS и безопасность',
  'shared.ruleTemplates.folder.authentication': 'Аутентификация',
  'shared.ruleTemplates.folder.privacy': 'Конфиденциальность',
  'shared.ruleTemplates.folder.testing': 'Тестирование',
  'shared.ruleTemplates.folder.urlHandling': 'Обработка URL',
  'shared.ruleTemplates.folder.tracking': 'Трекинг',
  'shared.ruleTemplates.folder.debugging': 'Отладка',
  'shared.ruleTemplates.folder.appearance': 'Внешний вид',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Коды состояния',
  'shared.ruleTemplates.folder.dynamic': 'Динамические',

  'shared.ruleTemplates.corsBypass.name': 'Обход CORS',
  'shared.ruleTemplates.corsBypass.description':
    'Удалить ограничивающие CORS-заголовки, чтобы разрешить кросс-доменные запросы во время разработки',
  'shared.ruleTemplates.removeCsp.name': 'Удалить CSP',
  'shared.ruleTemplates.removeCsp.description': 'Убрать заголовки Content-Security-Policy на время разработки',
  'shared.ruleTemplates.allowEmbedding.name': 'Разрешить встраивание',
  'shared.ruleTemplates.allowEmbedding.description': 'Удалить X-Frame-Options, чтобы разрешить встраивание в iframe',
  'shared.ruleTemplates.apiAuth.name': 'Внедрение API-авторизации',
  'shared.ruleTemplates.apiAuth.description': 'Автоматически добавлять заголовок Authorization в API-вызовы',
  'shared.ruleTemplates.customUa.name': 'Свой User-Agent',
  'shared.ruleTemplates.customUa.description': 'Переопределить заголовок User-Agent для отдельных доменов',
  'shared.ruleTemplates.blockCookies.name': 'Блокировать cookie',
  'shared.ruleTemplates.blockCookies.description': 'Удалить заголовок Cookie из исходящих запросов',
  'shared.ruleTemplates.testMerge.name': 'Тест объединения (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    'Проверьте операцию «Объединить», добавив значение в конец заголовка ответа.\n1. Включите это правило\n2. ' +
    'Откройте httpbin.org в новой вкладке\n3. Выполните в консоли: fetch("https://httpbin.org/get").then(r=>{' +
    'console.log("Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type должен показать ' +
    '"application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': 'Блокировать трекеры',
  'shared.ruleTemplates.blockTrackers.description': 'Блокировать скрипты аналитики и отслеживания',
  'shared.ruleTemplates.blockAds.name': 'Блокировать рекламу',
  'shared.ruleTemplates.blockAds.description': 'Блокировать домены распространённых рекламных сетей',
  'shared.ruleTemplates.redirectDomain.name': 'Перенаправить домен',
  'shared.ruleTemplates.redirectDomain.description': 'Перенаправлять весь трафик с одного домена на другой',
  'shared.ruleTemplates.forceHttps.name': 'Принудительный HTTPS',
  'shared.ruleTemplates.forceHttps.description':
    'Повышать HTTP до HTTPS — группа захвата регулярного выражения сохраняет полный путь',
  'shared.ruleTemplates.removeUtm.name': 'Удалить UTM-параметры',
  'shared.ruleTemplates.removeUtm.description': 'Убирать UTM-параметры отслеживания из URL-адресов',
  'shared.ruleTemplates.addDebug.name': 'Добавить флаг отладки',
  'shared.ruleTemplates.addDebug.description': 'Добавлять параметр запроса debug=true к API-вызовам',
  'shared.ruleTemplates.darkMode.name': 'CSS тёмной темы',
  'shared.ruleTemplates.darkMode.description': 'Внедрить простую таблицу стилей тёмной темы',
  'shared.ruleTemplates.consoleLogger.name': 'Логгер консоли',
  'shared.ruleTemplates.consoleLogger.description': 'Выводить все fetch-запросы в консоль',
  'shared.ruleTemplates.slowApi.name': 'Медленный API (2s)',
  'shared.ruleTemplates.slowApi.description': 'Добавить задержку 2 секунды к API-вызовам — проверка состояний загрузки',
  'shared.ruleTemplates.timeoutTest.name': 'Тест тайм-аута (5s)',
  'shared.ruleTemplates.timeoutTest.description': 'Добавить задержку 5 секунд — проверка обработки тайм-аутов',
  'shared.ruleTemplates.restBodyOverride.name': 'Переопределение тела REST',
  'shared.ruleTemplates.restBodyOverride.description': 'Заменить тело запроса статическим JSON-содержимым',
  'shared.ruleTemplates.graphqlOverride.name': 'Переопределение GraphQL',
  'shared.ruleTemplates.graphqlOverride.description':
    'Переопределить тело GraphQL-запроса своим запросом и переменными',
  'shared.ruleTemplates.mock200.name': 'Имитация 200 JSON',
  'shared.ruleTemplates.mock200.description': 'Возвращать успешный JSON-ответ для конечной точки REST API',
  'shared.ruleTemplates.mock404.name': 'Имитация 404',
  'shared.ruleTemplates.mock404.description': 'Возвращать ответ 404 Not Found',
  'shared.ruleTemplates.mock500.name': 'Имитация ошибки сервера',
  'shared.ruleTemplates.mock500.description': 'Возвращать ответ 500 Internal Server Error — проверка обработки ошибок',
  'shared.ruleTemplates.mockGraphql.name': 'Имитация GraphQL-ответа',
  'shared.ruleTemplates.mockGraphql.description': 'Возвращать свой ответ для конкретной GraphQL-операции',
  'shared.ruleTemplates.mockDynamic.name': 'Динамический REST-ответ',
  'shared.ruleTemplates.mockDynamic.description':
    'Перехватывать реальный ответ REST API и изменять его с помощью JavaScript — внедрять тестовые данные, ' +
    'удалять поля или преобразовывать структуру ответа',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Динамический GraphQL-ответ',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    'Перехватывать ответ конкретной GraphQL-операции и изменять его с помощью JavaScript — менять структуру ' +
    'данных, внедрять тестовые поля или имитировать ошибки',

  // ── Dock-layout chrome (shared shell: workbench + devtools panel).
  //    Slot labels feed the Move-to submenu, drop-zone overlays, and
  //    the restore rows on both surfaces. ────────────────────────────
  'shared.dock.slot.leftTop': 'Слева сверху',
  'shared.dock.slot.leftBottom': 'Слева снизу',
  'shared.dock.slot.rightTop': 'Справа сверху',
  'shared.dock.slot.rightBottom': 'Справа снизу',
  'shared.dock.slot.bottomLeft': 'Снизу слева',
  'shared.dock.slot.bottomRight': 'Снизу справа',
  // Stacked (rows) bottom-split names for the same two slots.
  'shared.dock.slot.bottomTop': 'Снизу, верхняя часть',
  'shared.dock.slot.bottomBottom': 'Снизу, нижняя часть',
  'shared.dock.hide': 'Скрыть',
  'shared.dock.moveTo': 'Переместить в',
  'shared.dock.currentSlot': 'текущая позиция',
  'shared.dock.showToolWindowNames': 'Показывать названия окон инструментов',
  'shared.dock.hideThisDock': 'Скрыть этот док',
  'shared.dock.closeDock': 'Закрыть док',
  'shared.dock.panelOptions': 'Параметры панели',
  'shared.dock.hidePanel': 'Скрыть панель',

  // ── Docs panel chrome (shared reader: workbench + devtools panel).
  //    Registry titles/summaries resolve per-surface via the
  //    raw-or-key DocSection idiom; these are the reader's own
  //    labels. Key caps / chords (↑↓ ↵ esc ← →) stay raw. ─────────────
  'shared.docs.title': 'Документация',
  'shared.docs.contents': 'Оглавление',
  'shared.docs.ariaOpenToc': 'Открыть оглавление',
  'shared.docs.ariaCloseToc': 'Закрыть оглавление',
  'shared.docs.filterPlaceholder': 'Фильтр разделов',
  'shared.docs.noMatches': 'Нет совпадений',
  'shared.docs.hint.navigate': 'переход',
  'shared.docs.hint.open': 'открыть',
  'shared.docs.hint.back': 'назад',
  'shared.docs.hint.contents': 'оглавление',
  'shared.docs.previous': 'Назад',
  'shared.docs.next': 'Далее',
  'shared.docs.previousTooltip': 'Назад: {title}',
  'shared.docs.nextTooltip': 'Далее: {title}',

  // ── Docs section primitives (shared: workbench + devtools panel).
  //    Callout kind labels, the Example block's structural labels, the
  //    surface-context banner, and the in-section TOC header. The DNR
  //    engine tag, BrowserTag versions, and every SVG-internal label
  //    (incl. the surface-glyph <title>s) stay raw. ────────────────────
  'shared.docs.callout.note': 'Примечание',
  'shared.docs.callout.warning': 'Предупреждение',
  'shared.docs.callout.tip': 'Совет',
  'shared.docs.callout.limitation': 'Ограничение',
  'shared.docs.example.rule': 'Правило:',
  'shared.docs.example.before': 'До:',
  'shared.docs.example.after': 'После:',
  'shared.docs.example.appliesTo': 'Применяется к:',
  'shared.docs.example.wontApply': 'Не применяется к:',
  'shared.docs.example.suggestion': 'Рекомендация:',
  'shared.docs.onThisPage': 'На этой странице',
  'shared.docs.copyCode': 'Копировать код',
  'shared.docs.surfaces.header': 'Где это отображается',
  'shared.docs.surfaces.popup': 'Всплывающее окно',
  'shared.docs.surfaces.sidePanel': 'Боковая панель',
  'shared.docs.surfaces.workbench': 'Рабочая среда',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'На основе скрипта',

  // ── Split-layout orientation (shared/split-layout) — overflow-menu
  //    entries for the two-pane split direction. ─────────────────────
  'shared.splitLayout.horizontal': 'Горизонтальная раскладка — рядом',
  'shared.splitLayout.vertical': 'Вертикальная раскладка — друг под другом',

  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': 'Показать ещё {count} (старые)',
  'shared.timelineGroup.showNewestOnly': 'Показать только новейшие {count}',
  // Compose-editor toolbar wrap toggle + the "Editor" dropdown.
  'shared.codeEditor.wrap': 'Перенос',
  'shared.codeEditor.find': 'Найти',
  'shared.codeEditor.replace': 'Заменить',
  'shared.codeEditor.format': 'Форматировать',
  'shared.codeEditor.formatError': 'Не удаётся отформатировать — ошибка разбора',
  'shared.editorMenu.label': 'Редактор',
  'shared.editorMenu.thisEditor': 'Этот редактор',
  'shared.editorMenu.allEditors': 'Все редакторы',
  'shared.editorMenu.lineNumbers': 'Номера строк',
  'shared.editorMenu.whitespace': 'Пробелы',
  'shared.editorMenu.lineEnds': 'Концы строк',
  // Peer-execute refusal notice (the quoted phrases are the settings
  // rows' own labels, verbatim).
  'shared.peerExecute.localDisabled':
    'Отправка из браузеров этого устройства выключена в настольном приложении. Включите «Разрешить браузерам ' +
    'этого устройства отправлять запросы» в разделе «Резервное копирование и синхронизация › Ваши устройства».',
  'shared.peerExecute.remoteDisabled':
    'Отправка с других устройств выключена на подключённом хосте. Включите «Разрешить другим подключённым ' +
    'устройствам отправлять запросы» в его разделе «Резервное копирование и синхронизация › Ваши устройства» на ' +
    'той машине.',
  'shared.peerExecute.enableCta': 'Включить в настольном приложении',

  // ── Desktop teaser ─────────────────────────────────────────────────
  // ── Execution place (the chip beside Send / Connect / Invoke) ───────
  'shared.executionPlace.info': 'Где выполняется этот запрос',
  'shared.executionPlace.chip.here': 'Выполняется здесь',
  'shared.executionPlace.chip.desktopApp': 'Выполняется в настольном приложении',
  'shared.executionPlace.chip.server': 'Выполняется: {place}',
  'shared.executionPlace.chip.needsDesktopApp': 'Нужно настольное приложение',
  'shared.executionPlace.chip.notForwarded': 'Пока недоступно: {place}',
  'shared.executionPlace.chip.unavailable': 'Здесь недоступно',
  'shared.executionPlace.chip.cannotRunOn': 'Пока нельзя выполнить: {place}',
  'shared.executionPlace.role.here': 'это устройство',
  'shared.executionPlace.role.desktopApp': 'настольное приложение',
  'shared.executionPlace.role.server': 'сервер',
  'shared.executionPlace.reason.runsHere': 'Выполняется в этом приложении, на этом компьютере.',
  'shared.executionPlace.reason.runsHereBrowser': 'Выполняется в расширении, на этом компьютере.',
  'shared.executionPlace.reason.runsHerePageRealm':
    'Выполняется в расширении через сокет браузера, на этом компьютере.',
  'shared.executionPlace.reason.contextSend':
    'Отправлен подключённым бэкендом {place} и разрешён там. Целевой сервер видит адрес и сетевое расположение той машины.',
  'shared.executionPlace.reason.companionInvoke':
    'Вызовы gRPC перенаправляются в настольное приложение на этом компьютере — в браузере нет стека HTTP/2 с доступом к трейлерам.',
  'shared.executionPlace.reason.companionRequired':
    'Подключите настольное приложение, чтобы вызвать — составление и сохранение работают здесь.',
  'shared.executionPlace.reason.tcpScheme':
    'Адреса mqtt:// и mqtts:// открывают «сырой» сокет TCP, что браузеру недоступно. Откройте этот запрос в настольном приложении или перейдите на ws:// или wss://, чтобы подключиться здесь.',
  'shared.executionPlace.reason.sessionNotForwarded': 'Сеансы пока не перенаправляются: {place}.',
  'shared.executionPlace.reason.noRuntime': 'Запросы этого вида выполняются в настольном приложении или на сервере.',
  'shared.executionPlace.reason.delegatedDesktopApp':
    'Разрешается здесь; соединение от имени этого запроса открывает настольное приложение.',
  'shared.executionPlace.reason.delegatedServer':
    'Разрешается здесь; соединение от имени этого запроса открывает {place}. Разрешённые значения, включая секреты, передаются туда.',
  'shared.executionPlace.picker.title': 'Выполнять на',
  'shared.executionPlace.option.here': 'Это устройство',
  'shared.executionPlace.option.desktopApp': 'Настольное приложение',
  'shared.executionPlace.option.server': 'Сервер',
  'shared.executionPlace.knob.cookieJar': 'хранилище cookie',
  'shared.executionPlace.knobsNotApplied': '{place} не применяет: {knobs}.',
  'shared.executionPlace.reason.preferenceUnavailable':
    'Для этого запроса задано место выполнения: {place}. Отсюда оно пока недоступно.',
  'shared.desktopTeaser.cta': 'Скачать настольное приложение',
  'shared.desktopTeaser.openApp': 'Открыть в настольном приложении',
  'shared.desktopTeaser.launchApp': 'Открыть настольное приложение',
  'shared.desktopTeaser.otherPlatforms': 'Другие платформы и каналы',
  'shared.desktopTeaser.terminal.title': 'Встроенный терминал',
  'shared.desktopTeaser.terminal.body':
    'Откройте настоящий терминал прямо в рабочем пространстве — ваша собственная оболочка, запущенная локально ' +
    'рядом с правилами и запросами.',
  'shared.desktopTeaser.git.title': 'История Git',
  'shared.desktopTeaser.git.body':
    'Просматривайте хронологию коммитов рабочего пространства с подробностями по каждому коммиту и диффами файлов.',
  'shared.desktopTeaser.commit.title': 'Коммит',
  'shared.desktopTeaser.commit.body':
    'Просматривайте и коммитьте изменения рабочего пространства — дерево файлов с флажками, диффы по каждому ' +
    'файлу и поле для сообщения коммита.',
  'shared.desktopTeaser.proxy.title': 'Прокси для захвата',
  'shared.desktopTeaser.proxy.body':
    'Захватывайте живой HTTP(S)-трафик встроенным прокси и изучайте каждый запрос в момент его выполнения.',
  'shared.desktopTeaser.mcp.title': 'ИИ · MCP-сервер',
  'shared.desktopTeaser.mcp.body':
    'Подключайте ИИ-ассистентов к своим рабочим пространствам через встроенный MCP-сервер.',
  'shared.desktopTeaser.liveNetwork.title': 'Сеть Live',
  'shared.desktopTeaser.liveNetwork.body':
    'Наблюдайте за трафиком вкладки браузера в реальном времени в настольном приложении — поток идёт из ' +
    'расширения, DevTools не нужны.',

  // ── Settings rows ──────────────────────────────────────────────────
  'shared.settingsRows.enabled': 'Включено',
  'shared.settingsRows.disabled': 'Выключено',
  'shared.settingsRows.reset': 'Сбросить {label} к значению по умолчанию',
} as const satisfies Catalog;
