/**
 * Workbench editors — the rule editor — Russian. Mirrors
 * `catalogs/en/workbench-editors-rule.ts` key for key. The quick
 * editor reuses the `workbench.editors.rule.fields.*` keys directly
 * (S35 field-key reuse law) — field labels here stay consistent with
 * `ru/panel-quick-editor.ts` (op infinitives внедрить / переопределить
 * / добавить в конец / объединить / удалить, «Удалить все», the
 * Имитация / Изменение = Mock / Modify tags). Rule-type kickers reuse
 * the Правило … family from workbench-chrome (Правило заголовков /
 * блокировки / перенаправления / параметра запроса / внедрения /
 * задержки / тела запроса / ответа / WebSocket / SSE / аутентификации).
 * MINTS: шаблон = template (пользовательский шаблон = user template);
 * заголовок редактора = the editor header bar (S19 separate referent —
 * заголовок JWT the segment and HTTP-заголовок unchanged); Добавить /
 * Заменить = Add / Replace and Только заменить = Replace Only (the
 * header-plane op — переопределить stays the hover-snapshot op noun,
 * перезаписать stays file overwrite); основной / сторонний =
 * first-/third-party (Chrome's ru cookie wording); запись-надгробие =
 * tombstone; слот = DNR slot; обрезается = clamped; Статические данные
 * / Динамически = Static Data / Dynamic; Форматированный / Исходный
 * carried from panel-network; предустановка = preset. Raw by design:
 * gates AND/OR/NOT, DNR schema vocabulary (`requestDomains`,
 * `url-filter`, `firstParty`, slot ids), `{{ns.NAME}}` reference syntax
 * in placeholders, quoted browser UI phrasing (raw en in «», S80 law),
 * scheme prefixes, HTTP method lists, regex fragments; `⋮ → Сохранить
 * как пользовательский шаблон` menu-path splits quote the OH mint.
 * Every raw token takes a head noun or a hyphenated apposition
 * (браузер Chrome, URL-шаблон, DNR-слот, JSON-тело).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Сохранено',
  'workbench.editors.header.onTop': 'Заголовок редактора сверху',
  'workbench.editors.header.atBottom': 'Заголовок редактора снизу',
  'workbench.editors.header.moreActions': 'Другие действия',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Редактор правил',
  'workbench.editors.rule.templates.title': 'Шаблоны',
  'workbench.editors.rule.templates.infoSummary': 'Начните с предустановки вместо пустой формы.',
  'workbench.editors.rule.templates.infoDescription':
    'Системные шаблоны поставляются с приложением; пользовательские вы сохраняете сами через ⋮ → Сохранить как пользовательский шаблон. Применение шаблона лишь заполняет поля — измените что угодно перед сохранением.',
  'workbench.editors.rule.templates.blank': 'Пустой',
  'workbench.editors.rule.templates.system': 'Системные',
  'workbench.editors.rule.templates.user': 'Пользовательские',
  'workbench.editors.rule.templates.emptyTitle': 'Пользовательских шаблонов пока нет',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'Пользовательские шаблоны — ваши собственные предустановки для этого типа правил. Настройте правило как нужно, затем выберите',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Сохранить как пользовательский шаблон',
  'workbench.editors.rule.templates.emptyAfterMenu':
    'в заголовке редактора — шаблон появится здесь для каждого нового правила этого типа.',
  'workbench.editors.rule.saveAsTemplate': 'Сохранить как пользовательский шаблон',
  'workbench.editors.rule.enabled': 'Включено',
  'workbench.editors.rule.disabled': 'Выключено',
  'workbench.editors.rule.toast.unknownType': 'Неизвестный тип правила',
  'workbench.editors.rule.toast.deletedOtherTab': 'Правило было удалено из другой вкладки',
  'workbench.editors.rule.toast.updateFailed': 'Не удалось обновить правило',
  'workbench.editors.rule.toast.updateFailedDetail': 'Не удалось обновить правило: {message}',
  'workbench.editors.rule.toast.publishFailed': 'Правило сохранено, но опубликовать его не удалось',
  'workbench.editors.rule.toast.updated': 'Правило обновлено',
  'workbench.editors.rule.toast.published': 'Правило опубликовано',
  'workbench.editors.rule.toast.formatSkipped': 'Форматирование при сохранении пропущено: {reason}',
  'workbench.editors.rule.toast.noCollection': 'Коллекция не найдена',
  'workbench.editors.rule.toast.restoreFailed': 'Не удалось восстановить правило',
  'workbench.editors.rule.toast.restored': 'Правило восстановлено',
  'workbench.editors.rule.deleted.message': 'Это правило было удалено с другой поверхности.',
  'workbench.editors.rule.deleted.description':
    'Восстановление создаёт новую копию с новым идентификатором (исходная запись-надгробие постоянна — см. спецификацию движка синхронизации, §7.2).',
  'workbench.editors.rule.deleted.restore': 'Восстановить',
  'workbench.editors.rule.conditionsPane.title': 'Условия',
  'workbench.editors.rule.conditionsPane.infoSummary': 'Условия определяют, к каким запросам применяется это правило.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Строки объединяются через',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— каждая строка должна совпасть.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': 'Значения внутри одной строки объединяются через',
  'workbench.editors.rule.conditionsPane.infoOrAfter': '(значок OR отмечает строки, принимающие несколько значений).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Добавьте хотя бы одно условие.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'Сопоставление URL',
  'workbench.editors.rule.condition.group.domainFiltering': 'Фильтрация по домену',
  'workbench.editors.rule.condition.group.requestFiltering': 'Фильтрация запросов',
  'workbench.editors.rule.condition.group.headerMatching': 'Сопоставление заголовков',
  'workbench.editors.rule.condition.type.urlFilter': 'URL-шаблон',
  'workbench.editors.rule.condition.type.urlRegex': 'URL-регулярное выражение',
  'workbench.editors.rule.condition.type.requestDomains': 'Домены запроса',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Исключить домены',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Домены инициатора',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Искл. инициатора',
  'workbench.editors.rule.condition.type.requestMethods': 'Методы',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Искл. методы',
  'workbench.editors.rule.condition.type.resourceTypes': 'Типы ресурсов',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Искл. ресурсы',
  'workbench.editors.rule.condition.type.domainType': 'Тип домена',
  'workbench.editors.rule.condition.type.responseHeader': 'Заголовок ответа',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Искл. загол. ответа',
  'workbench.editors.rule.condition.suffix.notSupported': ' — не поддерживается Chrome DNR',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — уже используется',
  'workbench.editors.rule.condition.firstParty': 'Основной',
  'workbench.editors.rule.condition.thirdParty': 'Сторонний',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'Нет условий — правило не совпадёт ни с одним запросом',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    'Строки объединяются через AND — для срабатывания правила должна совпасть каждая строка. Каждая строка нацелена на своё поле DNR, поэтому AND между строками точное. Чтобы объединить несколько значений одного поля через OR, перечислите их в одной строке (см. значок OR у строки).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    'Это условие-исключение — правило срабатывает, только если НИ ОДНО из перечисленных значений не совпало.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    'Несколько значений в этой строке совпадают, если совпало ЛЮБОЕ из них (OR). Строки ниже объединяются через AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 значение',
  'workbench.editors.rule.condition.oneValueTooltip':
    'Это условие принимает одно значение — разделение запятыми ничего не даёт. Строки ниже объединяются через AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': 'Имя заголовка равно...',
  'workbench.editors.rule.condition.headerValuePlaceholder': 'Значение заголовка равно...',
  'workbench.editors.rule.condition.selectMethods': 'Выберите методы',
  'workbench.editors.rule.condition.selectTypes': 'Выберите типы',
  'workbench.editors.rule.condition.selectType': 'Выберите тип',
  'workbench.editors.rule.condition.valuePlaceholder': 'значение',
  'workbench.editors.rule.condition.add': 'Добавить условие',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    'Действует только последняя строка типа {type} — значение этой строки не дойдёт до Chrome. Удалите эту строку или перенесите её значения в ту строку, которая побеждает.',
  'workbench.editors.rule.issue.mutexConflict':
    'Условия {type} и {winningType} делят один DNR-слот — действует только последнее. Выберите одно.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'Этот тип условия пока не поддерживается Chrome DNR — правило сохранится, но эта строка ничего не отправит в сеть.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'URL-шаблон не может быть пустым.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'URL-регулярное выражение не может быть пустым.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'URL-шаблон не может содержать пробелы — Chrome отклоняет правила с пробелами в url-filter.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'URL-шаблон содержит символы вне ASCII — Chrome их отклоняет. Для IDN-имён хостов используйте punycode (xn--…).',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    'Похоже на регулярное выражение — в URL-шаблоне символы вроде `(`, `[`, `+`, `?`, `\\d` сопоставляются буквально. Переключитесь на URL-регулярное выражение, если нужен синтаксис regex.',
  'workbench.editors.rule.issue.regexLookbehind':
    'Движок регулярных выражений Chrome (RE2) не поддерживает ретроспективные проверки ((?<=…), (?<!…)). Правило может не загрузиться.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Движок регулярных выражений Chrome (RE2) не поддерживает именованные группы в стиле Python ((?P<name>…)). Правило может не загрузиться.',
  'workbench.editors.rule.issue.invalidUrlRegex': 'Недопустимое регулярное выражение: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '«{value}» — недопустимый HTTP-метод. Разрешены: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType': '«{value}» — недопустимый тип ресурса. Выберите из списка.',
  'workbench.editors.rule.issue.invalidDomainType':
    '«{value}» — недопустимый тип домена. Используйте «firstParty» или «thirdParty».',
  'workbench.editors.rule.issue.headerNameRequired': 'Имя заголовка обязательно.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    'Пробел внутри значения — разделяйте имена хостов запятой. Условие requestDomains принимает по одному чистому имени хоста на запись.',
  'workbench.editors.rule.issue.domain.scheme':
    'Уберите схему — условие requestDomains в Chrome принимает только имена хостов, а не URL-адреса.',
  'workbench.editors.rule.issue.domain.wildcard':
    'Уберите подстановочный знак — условие requestDomains автоматически совпадает со всеми поддоменами, так что «*.foo.com» — это просто «foo.com».',
  'workbench.editors.rule.issue.domain.port':
    'Уберите порт — условие requestDomains сопоставляет только имя хоста; правило автоматически охватывает все порты.',
  'workbench.editors.rule.issue.domain.uppercase':
    'Переведите имя хоста в нижний регистр — Chrome принимает в requestDomains только строчные символы ASCII.',
  'workbench.editors.rule.issue.domain.nonAscii':
    'Имя хоста содержит символы, которые Chrome отклоняет в requestDomains (вероятно, запись вне ASCII / IDN). Используйте форму punycode (xn--…).',
  'workbench.editors.rule.issue.domain.empty': 'Пустое имя хоста — удалите эту строку.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Затронута {count} запись',
      few: 'Затронуты {count} записи',
      many: 'Затронуто {count} записей',
      other: 'Затронуто {count} записей',
    }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Исправить',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': 'Цель перенаправления не может содержать пробелы.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'Цель перенаправления должна быть полным URL-адресом (http://, https://, chrome-extension://) или путём, начинающимся с /.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    'URL-адрес источника должен использовать http://, https:// или chrome-extension://.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': 'URL-адрес источника недопустим.',
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'Код статуса должен быть целым числом от 100 до 599.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    'Имя параметра не может содержать `&`, `=`, `#`, `?` или пробелы.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'Задержка основного фрейма ограничена 30000ms; большие значения обрезаются при отправке.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'Перехват XHR/fetch ограничивает задержки 5000ms, чтобы не исчерпать пул HTTP-соединений. Перенаправления основного фрейма допускают до 30000ms.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    'Тип содержимого должен иметь вид «type/subtype» (например, application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'Ключ GraphQL-фильтра обязателен.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'Значение фильтра сообщений обязательно, если фильтр настроен.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    'Фильтр сообщений — недопустимое регулярное выражение.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Внедрение после совпавшего сообщения требует фильтра сообщений.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} неразрешённая переменная в этом правиле',
      few: '{count} неразрешённые переменные в этом правиле',
      many: '{count} неразрешённых переменных в этом правиле',
      other: '{count} неразрешённых переменных в этом правиле',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'не разрешена',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'не в области',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'неизвестное пространство имён',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': 'ссылка на шаг вне области',
  'workbench.editors.rule.resolution.reason.empty': 'пустая',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'недопустимое значение',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'требуется авторизация',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'секрет не найден',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'менеджер недоступен',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    'нет кешированного запуска для окружения «{envName}» — откройте рабочий процесс и нажмите «Обновить» в этом окружении, чтобы заполнить',
  'workbench.editors.rule.resolution.hint.disabledLv':
    'переменная Live выключена — включите её в редакторе переменных Live',
  'workbench.editors.rule.resolution.hint.draftLv':
    'переменная Live — черновик: откройте её и нажмите «Сохранить», чтобы опубликовать',
  'workbench.editors.rule.resolution.noEnvironment': 'Без окружения',
  'workbench.editors.rule.resolution.activeEnvFallback': 'активное окружение',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Действия',
  'workbench.editors.rule.fields.addAction': 'Добавить действие',
  'workbench.editors.rule.fields.reset': 'Сбросить',
  'workbench.editors.rule.fields.optionalTag': '(необязательно)',
  'workbench.editors.rule.fields.opAddReplace': 'Добавить / Заменить',
  'workbench.editors.rule.fields.opAppend': 'Добавить в конец',
  'workbench.editors.rule.fields.opRemove': 'Удалить',
  'workbench.editors.rule.fields.opMerge': 'Объединить',
  'workbench.editors.rule.fields.opReplaceOnly': 'Только заменить',
  'workbench.editors.rule.fields.opRemoveAll': 'Удалить все',
  'workbench.editors.rule.fields.operatorEquals': 'Равно',
  'workbench.editors.rule.fields.operatorContains': 'Содержит',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': 'Статические данные',
  'workbench.editors.rule.fields.dynamicJs': 'Динамически (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Форматированный',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Исходный',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    'Форматированный вид доступен только для тел в форме JSON.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Форматированный вид',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Тело',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Форматированный и Исходный — два вида одного и того же текста тела; правило отдаёт именно текст для сети.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Пример — одно значение, два вида',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Режимы',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'Вид для чтения — отличаются только пробелы. Правки перекодируются в исходный формат для сети, и «Сохранить» записывает этот текст; сохранение без правок записывает в точности исходные байты.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc': 'Сам текст для сети — ровно то, что отдаёт правило.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'Операция GraphQL (фильтр полезной нагрузки запроса)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Ключ, например operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'значение, например getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': 'Правило заголовков',
  'workbench.editors.rule.fields.header.infoSummary': 'Переписывает заголовки запроса и ответа в совпавшем трафике.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Недопустимые сочетания (например, «Добавить в конец» для нестандартного заголовка) помечают правило как черновик. Черновики сохраняются, но не выполняются.',
  'workbench.editors.rule.fields.header.requestTab': 'Заголовки запроса',
  'workbench.editors.rule.fields.header.requestTabSummary':
    'Действия с заголовками, применяемые к исходящему запросу до того, как он покинет браузер.',
  'workbench.editors.rule.fields.header.responseTab': 'Заголовки ответа',
  'workbench.editors.rule.fields.header.responseTabSummary':
    'Действия с заголовками, применяемые к ответу до того, как его увидит страница.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    'Собственная вкладка Network в DevTools браузера всегда показывает исходные заголовки сервера, поэтому там эти изменения не видны, хотя и применяются. У окна DevTools Open Headers такого ограничения нет — оно показывает заголовки ровно такими, какими их получила страница.',
  'workbench.editors.rule.fields.header.emptyRequest': 'Нет действий — это правило не меняет заголовки запроса',
  'workbench.editors.rule.fields.header.emptyResponse': 'Нет действий — это правило не меняет заголовки ответа',
  'workbench.editors.rule.fields.header.namePlaceholder': 'Имя заголовка',
  'workbench.editors.rule.fields.header.valuePlaceholder': 'Значение заголовка',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Значение для добавления в конец',
  'workbench.editors.rule.fields.header.existingValue': 'существующее значение',
  'workbench.editors.rule.fields.header.switchTo': 'Переключить на {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Перетащите, чтобы изменить порядок',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Правило блокировки',
  'workbench.editors.rule.fields.block.infoSummary':
    'Блокировка отменяет совпавшие запросы до того, как они покинут браузер.',
  'workbench.editors.rule.fields.block.infoDescription':
    'Настраивать действие не нужно — сама блокировка и есть действие; условия решают, что блокировать.',
  'workbench.editors.rule.fields.block.title': 'Блокировать запросы',
  'workbench.editors.rule.fields.block.body':
    'Запросы, совпавшие с условиями ниже, будут заблокированы. Браузер покажет странице сетевую ошибку.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Правило перенаправления',
  'workbench.editors.rule.fields.redirect.infoSummary':
    'Отправляет совпавшие запросы на другой URL-адрес до того, как они попадут в сеть.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'С условием «URL-регулярное выражение» \\1, \\2 … подставляют захваченные группы в целевой URL-адрес.',
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Перенаправлять на',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Другой URL-адрес',
  'workbench.editors.rule.fields.redirect.localFile': 'Локальный файл',
  'workbench.editors.rule.fields.redirect.desktopOnly': 'Доступно в настольном приложении',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    'например, https://openheaders.com/redirected — используйте \\1, \\2 с условиями «URL-регулярное выражение»',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Правило параметра запроса',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Добавляет, заменяет или удаляет параметры запроса в совпавших URL-адресах.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    '«Удалить все» убирает всю строку запроса; записи «Добавить / Заменить» из того же правила затем становятся новой строкой запроса. Записям «Только заменить» и «Удалить» не с чем работать, и рядом с «Удалить все» они игнорируются.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    '«Удалить все» убирает всю строку запроса, поэтому записям «Только заменить» и «Удалить» не с чем работать, и они игнорируются. Записи «Добавить / Заменить» по-прежнему действуют — они становятся новой строкой запроса.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'Удаляет все параметры запроса из URL-адреса',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Имя параметра',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Значение параметра',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': 'Правило внедрения',
  'workbench.editors.rule.fields.inject.infoSummary':
    'Внедряет скрипт или таблицу стилей в совпавшие страницы при их загрузке.',
  'workbench.editors.rule.fields.inject.language': 'Язык:',
  'workbench.editors.rule.fields.inject.codeSource': 'Источник кода:',
  'workbench.editors.rule.fields.inject.insert': 'Вставка:',
  'workbench.editors.rule.fields.inject.sourceCode': 'Код',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'После загрузки страницы',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'Как можно раньше',
  'workbench.editors.rule.fields.inject.source': 'Источник',
  'workbench.editors.rule.fields.inject.code': 'Код',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder':
    'Введите URL-адрес источника (относительный или абсолютный)',
  'workbench.editors.rule.fields.inject.bypassCsp':
    'Обходить Content-Security-Policy, чтобы внедрённые скрипты выполнялись всегда',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    'Сейчас охватывает только CSP в заголовке — CSP в <meta> всё ещё может заблокировать этот скрипт. Чтобы обойти оба, включите «Allow user scripts» для этого расширения в настройках расширений браузера.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Правило задержки',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Удерживает совпавшие запросы заданное время, прежде чем пропустить их дальше.',
  'workbench.editors.rule.fields.delay.capsAlert':
    'Навигации документов и iframe задерживаются до 30 000 ms через локальную страницу ожидания. XHR/Fetch, инициированные из JS, ограничены 5 000 ms, чтобы не исчерпать пул HTTP-соединений. Подресурсы (CSS, JS, изображения) не задерживаются.',
  'workbench.editors.rule.fields.delay.label': 'Задержка',
  'workbench.editors.rule.fields.delay.maxNote': 'Максимум 30 000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Правило тела запроса',
  'workbench.editors.rule.fields.requestBody.infoSummary': 'Заменяет тело совпавших запросов до их отправки.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    'Статические данные подставляют фиксированную полезную нагрузку; Динамически — выполняет JavaScript над исходным телом.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Перехватывает вызовы fetch() и XMLHttpRequest для API-запросов REST или GraphQL.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Выберите тип ресурса',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Тело запроса',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Ваша функция получает',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'и должна вернуть изменённое тело. Верните строку или объект (автоматически сериализуется в JSON).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Правило ответа',
  'workbench.editors.rule.fields.response.infoSummary':
    'Отдаёт для совпавших запросов подменённый ответ вместо того, что вернул сервер.',
  'workbench.editors.rule.fields.response.infoDescription':
    'Статические данные отдают фиксированную полезную нагрузку; Динамически — выполняет JavaScript над исходным ответом.',
  'workbench.editors.rule.fields.response.sourceLabel': 'Источник ответа',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Действует на ответы fetch() и XMLHttpRequest для API-запросов REST или GraphQL.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Имитация отдаёт ваше тело без обращения к серверу; Изменение отправляет настоящий запрос и правит ответ до того, как его увидит страница.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Имитация — запрос не отправляется',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 Изменение — правка ответа сервера',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'Настоящий запрос отправляется; ваши изменения применяются к ответу до того, как его увидит страница.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'Запрос никогда не покидает браузер — страница получает ваш ответ напрямую.',
  'workbench.editors.rule.fields.response.resourceType': 'Тип ресурса',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'На какую форму полезной нагрузки API нацелено правило — REST или GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL открывает фильтр операций ниже, чтобы правило совпадало с одной операцией внутри общей конечной точки.',
  'workbench.editors.rule.fields.response.statusCode': 'Код статуса',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'HTTP-статус, отдаваемый вместе с вашим ответом.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    'Выберите код для отдачи или оставьте исходный из ответа сервера, когда сервер вызывается.',
  'workbench.editors.rule.fields.response.keepOriginalStatus': 'Оставить исходный код статуса',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    'Заголовок Content-Type, отдаваемый вместе с телом — определяет, как браузер его разбирает.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    'Введите любое значение; подсказки — лишь для удобства. При вызове сервера он переопределяет Content-Type настоящего ответа только если задан.',
  'workbench.editors.rule.fields.response.headersLabel': 'Заголовки ответа',
  'workbench.editors.rule.fields.response.headersInfoSummary':
    'Дополнительные заголовки, отдаваемые вместе с Content-Type.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'При вызове сервера они объединяются поверх заголовков настоящего ответа; при имитации становятся заголовками ответа. Пустые строки отбрасываются при сохранении.',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': 'Имя заголовка (например, X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': 'Значение заголовка',
  'workbench.editors.rule.fields.response.addHeader': 'Добавить заголовок',
  'workbench.editors.rule.fields.response.bodyLabel': 'Тело ответа',
  'workbench.editors.rule.fields.response.bodyInfoSummary':
    'Полезная нагрузка, отдаваемая странице для совпавших запросов.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Статические данные отдают фиксированное тело; Динамически (JavaScript) строит или преобразует его в момент запроса.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': 'Сначала выполняется настоящий запрос. Ваша функция',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'получает ответ и контекст запроса, затем возвращает изменённый ответ. Верните строку или объект (автоматически сериализуется в JSON).',
  'workbench.editors.rule.fields.response.dynMockBefore': 'Запрос не отправляется. Ваша функция',
  'workbench.editors.rule.fields.response.dynMockMid': 'получает',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'и возвращает тело ответа. Верните строку или объект (автоматически сериализуется в JSON).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'Правило WebSocket',
  'workbench.editors.rule.fields.message.sseKicker': 'Правило SSE',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Изменяет, внедряет или отбрасывает фреймы WebSocket в совпавших соединениях до того, как их увидит страница или сеть.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Изменяет, внедряет или отбрасывает события Server-Sent Events в совпавших потоках до того, как их увидят слушатели.',
  'workbench.editors.rule.fields.message.wsIntro':
    'Перехватывает созданные страницей соединения WebSocket, URL-адрес сокета которых совпадает с условиями. Фреймы изменяются, внедряются или отбрасываются на странице до того, как дойдут до кода страницы (входящие) или до сети (исходящие).',
  'workbench.editors.rule.fields.message.sseIntro':
    'Перехватывает созданные страницей потоки EventSource, URL-адрес которых совпадает с условиями. События изменяются, внедряются или отбрасываются на странице до того, как их увидят слушатели.',
  'workbench.editors.rule.fields.message.operation': 'Операция',
  'workbench.editors.rule.fields.message.opReplace': 'Заменить',
  'workbench.editors.rule.fields.message.opInject': 'Внедрить',
  'workbench.editors.rule.fields.message.opDrop': 'Отбросить',
  'workbench.editors.rule.fields.message.direction': 'Направление',
  'workbench.editors.rule.fields.message.incoming': 'Входящие (сервер → страница)',
  'workbench.editors.rule.fields.message.outgoing': 'Исходящие (страница → сервер)',
  'workbench.editors.rule.fields.message.eventName': 'Имя события',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Пусто = события message по умолчанию',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'Сопоставляется с полем',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'потока',
  'workbench.editors.rule.fields.message.frameFilter': 'Фильтр фреймов',
  'workbench.editors.rule.fields.message.dataFilter': 'Фильтр данных',
  'workbench.editors.rule.fields.message.everyFrame': 'Каждый фрейм',
  'workbench.editors.rule.fields.message.everyEvent': 'Каждое событие',
  'workbench.editors.rule.fields.message.filterRegex': 'Регулярное выражение',
  'workbench.editors.rule.fields.message.filterNoteWs':
    'Фильтры сопоставляются только с текстовыми фреймами — двоичные фреймы проходят насквозь, когда фильтр задан.',
  'workbench.editors.rule.fields.message.filterNoteSse': 'Фильтры сопоставляются только с текстовыми событиями.',
  'workbench.editors.rule.fields.message.injectWhen': 'Внедрять, когда',
  'workbench.editors.rule.fields.message.connectionOpens': 'Открывается соединение',
  'workbench.editors.rule.fields.message.streamOpens': 'Открывается поток',
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'Приходит совпавший фрейм',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'Приходит совпавшее событие',
  'workbench.editors.rule.fields.message.injectedFrame': 'Внедряемый фрейм',
  'workbench.editors.rule.fields.message.injectedEvent': 'Внедряемое событие',
  'workbench.editors.rule.fields.message.replacementFrame': 'Фрейм-замена',
  'workbench.editors.rule.fields.message.replacementEvent': 'Событие-замена',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': 'Правило аутентификации',
  'workbench.editors.rule.fields.auth.infoSummary':
    'Отвечает этими учётными данными на запросы аутентификации HTTP или прокси в совпавших запросах.',
  'workbench.editors.rule.fields.auth.infoDescription':
    'Оба поля разрешают {{templates}}, поэтому настоящий секрет может лежать в vault ({{vault.*}}), а не открытым текстом в правиле. Действует только на вкладках в области действия режима отладки.',
  'workbench.editors.rule.fields.auth.introBefore':
    'Отвечает на запрос аутентификации сервера (401) или прокси (407) в совпавших запросах. Сошлитесь на секрет vault — например,',
  'workbench.editors.rule.fields.auth.introAfter': '— чтобы учётные данные не хранились в правиле.',
  'workbench.editors.rule.fields.auth.username': 'Имя пользователя',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'например, dev-user или {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Пароль',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'например, {{vault.STAGING_PW}}',
} as const satisfies Catalog;
