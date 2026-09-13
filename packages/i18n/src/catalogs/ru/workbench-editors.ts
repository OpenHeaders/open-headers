/**
 * Workbench editors — shared editor chrome — Russian. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the {column}
 * / {header} / {key} / {name} / {language} / {message} holes, `Tests`
 * group label raw per the de/es parity lock, lowercase en `vault` raw
 * lowercase (per-case token law) with секрет as its head noun, JSON /
 * URL / HTTP / CONNECT / PUBLISH / QoS / Socket.IO / OK raw. скрипт =
 * script; сниппет = snippet; пакет / Библиотека пакетов per
 * script-packages; package-flow strings shared with
 * `workbench-script-packages.ts` (duplicate name, not-found) reuse its
 * ru sentences verbatim. Авторизация = the Authorization field /
 * tab; секрет = secret (shipped mints). MINTS: Наследовать = the
 * Inherit option label — `workbench-editors-request.ts` MUST reuse
 * it; Массово = Bulk; Ключ-значение = Key-Value; Форматировать =
 * Format; черновик запроса = request draft (черновик carried from the
 * Draft mint); Тело = the bare `Body` tab noun (prose keeps тело
 * запроса / тело ответа per the shipped mints); подпротокол =
 * subprotocol; пара метаданных = metadata pair; последняя воля = last
 * will (prose; the `Last Will` tab rides raw); установление
 * соединения = dial; трейлер = trailer; брокер = broker; хук = hook.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': 'Подробнее',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': 'Сведения о соединении',
  'workbench.editors.session.subprotocol': 'Подпротокол',
  'workbench.editors.session.extensions': 'Расширения',
  'workbench.editors.session.closeCode': 'Код закрытия',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Ключ',
  'workbench.editors.grid.value': 'Значение',
  'workbench.editors.grid.description': 'Описание',
  'workbench.editors.grid.showColumns': 'Показывать колонки',
  'workbench.editors.grid.tableOptions': 'Параметры таблицы',
  'workbench.editors.grid.bulk': 'Массово',
  'workbench.editors.grid.keyValue': 'Ключ-значение',
  'workbench.editors.grid.selectAllAria': 'Включить или выключить все строки',
  'workbench.editors.grid.selectAllTitle': 'Включить / выключить все',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Изменить ширину колонки {column}',
  'workbench.editors.grid.overriddenBy': 'Дубликат — переопределён добавленной вами строкой {header}.',
  'workbench.editors.grid.suggestionValueAria': 'Значение {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': 'Коллекция запросов не найдена.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Папка не найдена.',
  'workbench.editors.ancestorScripts.saveFailed': 'Не удалось сохранить скрипты.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'Не удалось сохранить скрипты: {message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': 'Коллекция запросов не найдена.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Папка не найдена.',
  'workbench.editors.ancestorAuth.saveFailed': 'Не удалось сохранить авторизацию.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'Не удалось сохранить авторизацию: {message}',

  // ── Ancestor settings (collection/folder inheritable settings) ─────
  'workbench.editors.ancestorSettings.saveFailed': 'Не удалось сохранить настройки.',
  'workbench.editors.ancestorSettings.saveFailedDetail': 'Не удалось сохранить настройки: {message}',

  // ── Request container editor (a collection / folder: one tab, sections) ──
  'workbench.editors.requestContainer.tab.overview': 'Обзор',
  'workbench.editors.requestContainer.auth.emptyTitle': 'Авторизация не настроена',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection':
    'Выберите тип авторизации для запросов этой коллекции',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder': 'Выберите тип авторизации для запросов этой папки',
  'workbench.editors.requestContainer.auth.authTypes': 'Типы авторизации',
  'workbench.editors.requestContainer.auth.authTypesInfo':
    'Набор контейнера: по одной записи на каждую схему, нужную его запросам. Запросы с вариантом «Наследовать» используют запись по умолчанию, шаблон хоста направляет подходящие запросы к другой записи, а запрос может выбрать запись по имени.',
  'workbench.editors.requestContainer.auth.authTypesInfoHeading': 'Типы',
  'workbench.editors.requestContainer.auth.addEntryAria': 'Добавить тип авторизации',
  'workbench.editors.requestContainer.auth.inheritedTag': 'Унаследовано',
  'workbench.editors.requestContainer.auth.rename': 'Переименовать',
  'workbench.editors.requestContainer.auth.noneEntryNote': 'Запросы с этой записью отправляются без авторизации.',
  'workbench.editors.requestContainer.auth.defaultTag': 'По умолчанию',
  'workbench.editors.requestContainer.auth.setDefault': 'Сделать записью по умолчанию',
  'workbench.editors.requestContainer.auth.deleteEntry': 'Удалить',
  'workbench.editors.requestContainer.auth.entryActionsAria': 'Действия с записью',
  'workbench.editors.requestContainer.auth.appliesTo': 'Применять к хосту',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    'Запрос с вариантом «Наследовать», хост URL-адреса которого совпадает с шаблоном, получает эту запись вместо записи по умолчанию.',
  'workbench.editors.requestContainer.auth.appliesToOptionalTag': '(необязательно)',
  'workbench.editors.requestContainer.auth.appliesToInfoSummary':
    'Ограничивает эту запись запросами, хост URL-адреса которых совпадает с шаблоном.',
  'workbench.editors.requestContainer.auth.appliesToInfoRules':
    'Без учёта регистра; * совпадает с любой последовательностью символов, шаблон без него — точное совпадение хоста. Порт и путь никогда не учитываются. Оставьте поле пустым — тогда запись достижима только как запись по умолчанию или по выбору запроса.',
  'workbench.editors.requestContainer.auth.resetToInherited': 'Вернуть унаследованное',
  'workbench.editors.requestContainer.auth.resetConfirm': 'Удалить записи папки? Запросы перейдут к записям коллекции.',
  'workbench.editors.requestContainer.deletedElsewhere': 'Этот элемент был удалён в другом окне.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Загрузка примера…',
  'workbench.editors.responseExample.notFound': 'Пример не найден.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'Пример был удалён из другой вкладки',
  'workbench.editors.responseExample.toast.saveFailed': 'Не удалось сохранить пример',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'Не удалось сохранить пример: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Открыть как запрос',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Создаёт новый черновик запроса на основе запроса из этого примера',
  'workbench.editors.responseExample.editStatus': 'Изменить код статуса',
  'workbench.editors.responseExample.statusPlaceholder': 'Введите код ответа',
  'workbench.editors.responseExample.capturedTooltip': 'Захвачено {date}',
  'workbench.editors.responseExample.moreActionsAria': 'Другие действия с ответом',
  'workbench.editors.responseExample.tab.body': 'Тело',
  'workbench.editors.responseExample.tab.headers': 'Заголовки ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Язык тела',
  'workbench.editors.responseExample.format': 'Форматировать',
  'workbench.editors.responseExample.formatBody': 'Форматировать тело',
  'workbench.editors.responseExample.noFormatter': 'Нет форматировщика для {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Сниппеты',
  'workbench.editors.scriptEditor.packages': 'Пакеты',
  'workbench.editors.scriptEditor.searchSnippets': 'Поиск сниппетов',
  'workbench.editors.scriptEditor.searchPackages': 'Поиск пакетов',
  'workbench.editors.scriptEditor.noSnippetFound': 'Сниппет не найден',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'В этом рабочем пространстве пока нет пакетов',
  'workbench.editors.scriptEditor.noPackageFound': 'Пакет не найден',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Открыть библиотеку пакетов →',
  'workbench.editors.scriptEditor.saveToPackage': 'Сохранить в библиотеку пакетов',
  'workbench.editors.scriptEditor.newPackage': 'Новый пакет',
  'workbench.editors.scriptEditor.newPackageName': 'Имя нового пакета',
  'workbench.editors.scriptEditor.back': 'Назад',
  'workbench.editors.scriptEditor.create': 'Создать',
  'workbench.editors.scriptEditor.orAppend': 'Или добавить в существующий пакет:',
  'workbench.editors.scriptEditor.noPackagesYet': 'Пакетов пока нет',
  'workbench.editors.scriptEditor.savedTo': 'Сохранено в «{name}»',
  'workbench.editors.scriptEditor.packageCreated': 'Пакет «{name}» создан',
  'workbench.editors.scriptEditor.duplicatePackage':
    'Пакет с именем «{name}» уже существует в этом рабочем пространстве.',
  'workbench.editors.scriptEditor.packageNotFound': 'Пакет не найден — возможно, он был удалён.',
  'workbench.editors.scriptEditor.saveFailed': 'Не удалось сохранить',
  'workbench.editors.scriptEditor.menuFind': 'Найти',
  'workbench.editors.scriptEditor.group.request': 'Запрос',
  'workbench.editors.scriptEditor.group.variables': 'Переменные',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.group.requests': 'Запросы',
  'workbench.editors.scriptEditor.group.response': 'Ответ',
  'workbench.editors.scriptEditor.group.close': 'Закрытие',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Отправить HTTP-запрос',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Отправить HTTP-запрос с JSON-телом',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Получить переменную',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Задать переменную',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Получить секрет из vault',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Задать заголовок',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Удалить заголовок',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Задать параметр запроса',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Удалить параметр запроса',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Задать URL-адрес',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Задать метод',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Задать JSON-тело',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Код статуса равен 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Тело ответа содержит строку',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Тело ответа равно строке',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'JSON-значение в теле ответа верно',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Заголовок Content-Type присутствует',
  'workbench.editors.scriptEditor.snippet.responseTime': 'Время ответа меньше 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Сохранить значение из ответа в переменную',
  'workbench.editors.scriptEditor.group.connect': 'Подключение',
  'workbench.editors.scriptEditor.group.send': 'Отправка',
  'workbench.editors.scriptEditor.group.message': 'Сообщение',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': 'Задать предлагаемые подпротоколы',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': 'Продолжить при попытке переподключения',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': 'Переписать исходящее сообщение',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': 'Отбросить исходящее сообщение',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Переименовать событие Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsReply': 'Ответить на сообщение',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': 'Посчитать сообщения за сеанс',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Отправить событие Socket.IO',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': 'Сообщение — это JSON',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': 'Сохранить значение из сообщения в переменную',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': 'Сеанс закрыт корректно',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': 'Сообщения получены',
  'workbench.editors.scriptEditor.group.publish': 'Публикация',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': 'Задать идентификатор клиента',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'Задать учётные данные CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': 'Подписаться на топик при подключении',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': 'Задать последнюю волю',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'Задать пользовательское свойство CONNECT',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': 'Отметить попытку переподключения',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': 'Переписать исходящую полезную нагрузку',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': 'Перенацелить топик',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'Задать QoS и удержание',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': 'Отбросить исходящее сообщение',
  'workbench.editors.scriptEditor.snippet.mqttReply': 'Опубликовать ответ',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': 'Посчитать сообщения за сеанс',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': 'Полезная нагрузка — это JSON',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue': 'Сохранить значение из полезной нагрузки в переменную',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': 'Отключение прошло корректно',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': 'Сообщения получены',
  'workbench.editors.scriptEditor.group.invoke': 'Вызов',
  'workbench.editors.scriptEditor.snippet.grpcSetMetadata': 'Задать пару метаданных',
  'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata': 'Удалить пару метаданных',
  'workbench.editors.scriptEditor.snippet.grpcSetMessage': 'Переписать сообщение запроса',
  'workbench.editors.scriptEditor.snippet.grpcLogCall': 'Записать вызов в журнал',
  'workbench.editors.scriptEditor.snippet.grpcLogMessage': 'Записать декодированное сообщение в журнал',
  'workbench.editors.scriptEditor.snippet.grpcCountMessages': 'Посчитать сообщения за вызов',
  'workbench.editors.scriptEditor.snippet.grpcAssertDecoded': 'Сообщение декодировано',
  'workbench.editors.scriptEditor.snippet.grpcAssertField': 'Поле сообщения задано',
  'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue': 'Сохранить значение из сообщения в переменную',
  'workbench.editors.scriptEditor.snippet.grpcStatusOk': 'Статус равен OK',
  'workbench.editors.scriptEditor.snippet.grpcMessageCount': 'Сообщения получены',
  'workbench.editors.scriptEditor.snippet.grpcTrailerCheck': 'Трейлер присутствует',
  'workbench.editors.scriptEditor.snippet.logRequest': 'Записать запрос в журнал',
  'workbench.editors.scriptEditor.snippet.parseJsonBody': 'Разобрать JSON-тело',
  'workbench.editors.scriptEditor.snippet.findResponseHeader': 'Найти заголовок ответа',
  'workbench.editors.scriptEditor.snippet.logResponse': 'Записать ответ в журнал',
  'workbench.editors.scriptEditor.snippet.logDial': 'Записать установление соединения в журнал',
  'workbench.editors.scriptEditor.snippet.logOutgoingMessage': 'Записать исходящее сообщение в журнал',
  'workbench.editors.scriptEditor.snippet.logMessage': 'Записать сообщение в журнал',
  'workbench.editors.scriptEditor.snippet.logClose': 'Записать закрытие в журнал',
  'workbench.editors.scriptEditor.snippet.wsReplyBinary': 'Ответить двоичным фреймом',
  'workbench.editors.scriptEditor.snippet.wsNothingDropped': 'Ничего не отброшено',
  'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic': 'Задать топик ответа',
  'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty': 'Задать пользовательское свойство PUBLISH',
  'workbench.editors.scriptEditor.snippet.mqttConnackAccepted': 'Брокер принял сеанс',
  'workbench.editors.scriptEditor.snippet.grpcLogStatus': 'Записать статус в журнал',
} as const satisfies Catalog;
