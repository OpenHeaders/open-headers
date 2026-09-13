/**
 * Popup namespace — Russian. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the ru register contract (`ru/shared.ts`). Mints: совпавший
 * запрос = matched request; срабатывание = fire ({count} срабатываний);
 * evidence chips перекрыт = shadowed (обнаружение перекрытий = shadow
 * detection) / подтверждён = confirmed / косвенный = fallback / тихий =
 * silent / совпал = matched — short masculine forms agreeing with
 * запрос; delivery chips: live raw / кеш / raw sw; доставка = delivery
 * (column); признак = evidence (column); экскурсия = tour guide; значок
 * = badge; арбитраж = arbitration; связанный домен = related domain;
 * Настольное = Desktop tag; пустое правило = blank rule; меню
 * переполнения = overflow menu; exclude chip prefix = Кроме; инициатор
 * = initiator (condition label); режим отладки = debug mode (carried);
 * живой трафик = live traffic (carried); боковая панель = side panel
 * (carried). Rule-type option labels translate (product vocabulary);
 * resource-type parity labels stay literal in the components. Chip
 * sandwiches keep a structural `—` after a label chip (the hint
 * fragments); the `[chip] tab` sandwiches restructure so the chip
 * reads as an apposition (вкладку [OH] / вкладка «Open Headers»).
 * Browser-menu mocks quote the browsers' own ru UI (Chrome Вид →
 * Разработчикам → Инструменты разработчика, Safari Настройки →
 * Дополнения → Показывать функции для веб-разработчиков); the
 * status-popover subsystem names (Sync, Rules, …) ride verbatim raw.
 * The desktop-watch tooltip quotes the settings row «Разрешить
 * настольному приложению видеть этот браузер» — the ru settings file
 * quotes THIS value verbatim when it lands.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'Не удалось переключить вид',
  'popup.header.switchToSidePanel': 'Переключиться на боковую панель (остаётся открытой при просмотре)',
  'popup.header.switchToPopup': 'Переключиться в режим всплывающего окна (по клику на панели инструментов)',
  'popup.header.rulesResumed': 'Выполнение правил возобновлено',
  'popup.header.rulesPaused': 'Выполнение правил приостановлено',
  'popup.header.rulesLabel': 'Правила',
  'popup.header.resumeRules': 'Возобновить выполнение правил',
  'popup.header.pauseRules': 'Приостановить все правила (настройки отдельных правил сохраняются)',
  'popup.header.openSettings': 'Открыть настройки',
  'popup.header.notifications': 'Уведомления',
  'popup.header.openNotifications': 'Открыть уведомления',
  'popup.header.activeWorkspace': 'Активное рабочее пространство: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Активно',
  'popup.status.paused': 'Приостановлено',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'Как открыть наши расширенные инструменты разработчика в браузере.',
  'popup.footer.networkDebug': 'Отладка сети.',
  'popup.footer.tagline': 'Как и должно быть',
  'popup.footer.keyboardShortcuts': 'Сочетания клавиш',
  'popup.footer.systemStatus': 'Система',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'Просмотр с компьютера',
  'popup.desktopWatch.tooltip':
    'Настольное приложение Open Headers сейчас наблюдает за этим браузером в своей панели «Трафик». Нажмите, чтобы открыть настройки — выключатель называется «Разрешить настольному приложению видеть этот браузер».',
  'popup.desktopWatch.aria': 'Настольное приложение наблюдает за этим браузером — открыть настройки',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'Эта страница',
  'popup.tabs.allRules': 'Все правила',
  'popup.tabs.collections': 'Коллекции',
  'popup.tabs.openWorkspaceEditor': 'Открыть полный редактор рабочего пространства',
  'popup.tabs.workspace': 'Рабочее пространство',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': 'Удалить «{name}»?',
  'popup.deleteConfirm.confirm': 'подтвердить',
  'popup.deleteConfirm.cancel': 'отмена',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Искать что угодно...',
  'popup.table.sortOrder': 'Порядок сортировки',
  'popup.table.sortOrderHeading': 'ПОРЯДОК СОРТИРОВКИ',
  'popup.table.sortByStatus': 'По состоянию',
  'popup.table.sortByPriority': 'По приоритету',
  'popup.table.sortByColumn': 'По столбцу',
  'popup.table.sortWorkspaceOrder': 'Порядок рабочего пространства',
  'popup.table.sortWorkspaceOrderHint': 'Совпадает с порядком дерева в боковой панели рабочего пространства',
  'popup.table.sortByColumnHint': 'Отсортировано по столбцу «{column}» — нажмите любой вариант выше, чтобы сбросить',
  'popup.table.sortByPriorityHint':
    'Блокировка → Перенаправление → Запрос → Заголовок → Внедрение · внутри каждой группы по алфавиту',
  'popup.table.sortByStatusHintAll':
    'Активные → Приостановленные → Выключенные → Черновики · внутри каждой группы по приоритету',
  'popup.table.sortByStatusHintThisPage':
    'Активные → Приостановленные → Выключенные · внутри каждой группы по приоритету',
  'popup.table.sortByStatusHintCollections': 'Активные → Приостановленные · внутри каждой группы по алфавиту',
  'popup.table.columnName': 'Имя',
  'popup.table.columnDetails': 'Детали',
  'popup.table.columnConditions': 'Условия',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'Не удалось переключить правило',
  'popup.rule.deleted': 'Правило удалено',
  'popup.rule.deleteFailed': 'Не удалось удалить правило',
  'popup.rule.edit': 'Изменить правило',
  'popup.rule.delete': 'Удалить правило',
  'popup.rule.deleteOk': 'Удалить',
  'popup.rule.notConnected': 'Приложение не подключено',
  'popup.rule.desktopTag': 'Настольное',
  'popup.rule.comingSoon': 'скоро',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Правила',
  'popup.rules.activeSummary': 'Активно {active} из {total}',
  'popup.rules.draftSuffix': ', черновиков: {count}',
  'popup.rules.pausedByCollection': 'Приостановлено коллекцией: {count}',
  'popup.rules.addRule': 'Добавить правило',
  'popup.rules.addRuleTooltip': 'Добавить правило — поиск по типам и шаблонам',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `Совпало ${matched} из ${plural(locale, Number(total), {
      one: '{count} правила',
      few: '{count} правил',
      many: '{count} правил',
      other: '{count} правил',
    })}`,
  'popup.rules.emptyNoMatch': 'Подходящих правил не найдено',
  'popup.rules.emptyNone': 'Правил пока нет',
  'popup.rules.emptyHint': 'Нажмите «Добавить правило», чтобы изменять живые запросы браузера',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Коллекции',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), {
      one: '{count} коллекция',
      few: '{count} коллекции',
      many: '{count} коллекций',
      other: '{count} коллекций',
    })}, ${plural(locale, Number(rules), {
      one: '{count} правило',
      few: '{count} правила',
      many: '{count} правил',
      other: '{count} правил',
    })}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `Совпало ${matched} из ${plural(locale, Number(total), {
      one: '{count} коллекции',
      few: '{count} коллекций',
      many: '{count} коллекций',
      other: '{count} коллекций',
    })}`,
  'popup.collections.emptyNoMatch': 'Подходящих коллекций не найдено',
  'popup.collections.emptyNone': 'Нет коллекций',
  'popup.collections.emptyHint':
    'Создавайте правила в редакторе рабочего пространства, чтобы объединять их в коллекции',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `Включено ${enabled} из ${plural(locale, Number(total), {
      one: '{count} правила',
      few: '{count} правил',
      many: '{count} правил',
      other: '{count} правил',
    })}`,
  'popup.collections.pausedEnabledSummary': 'Приостановлено · включено {enabled} из {total}',
  'popup.collections.resumeTooltip':
    'Возобновить — закрепить активными правила ({count}), при необходимости переопределяя родителя',
  'popup.collections.pauseTooltip': 'Приостановить — остановить правила ({count}), не меняя их отдельные настройки',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'Все домены',
  'popup.conditions.none': 'Без условий',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Домен',
  'popup.conditions.short.excludeRequestDomains': 'Кроме домена',
  'popup.conditions.short.initiatorDomains': 'Откуда',
  'popup.conditions.short.excludeInitiatorDomains': 'Кроме откуда',
  'popup.conditions.short.requestMethods': 'Метод',
  'popup.conditions.short.excludeRequestMethods': 'Кроме метода',
  'popup.conditions.short.resourceTypes': 'Ресурс',
  'popup.conditions.short.excludeResourceTypes': 'Кроме ресурса',
  'popup.conditions.short.domainType': 'Тип домена',
  'popup.conditions.short.responseHeader': 'Загол. ответа',
  'popup.conditions.short.excludeResponseHeader': 'Кроме загол. ответа',
  'popup.conditions.full.urlFilter': 'Шаблон URL',
  'popup.conditions.full.urlRegex': 'Regex URL',
  'popup.conditions.full.requestDomains': 'Домены',
  'popup.conditions.full.excludeRequestDomains': 'Кроме доменов',
  'popup.conditions.full.initiatorDomains': 'Инициатор',
  'popup.conditions.full.excludeInitiatorDomains': 'Кроме инициатора',
  'popup.conditions.full.requestMethods': 'Методы',
  'popup.conditions.full.excludeRequestMethods': 'Кроме методов',
  'popup.conditions.full.resourceTypes': 'Ресурсы',
  'popup.conditions.full.excludeResourceTypes': 'Кроме ресурсов',
  'popup.conditions.full.domainType': 'Тип домена',
  'popup.conditions.full.responseHeader': 'Заголовок ответа',
  'popup.conditions.full.excludeResponseHeader': 'Кроме заголовка ответа',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Имя',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Количество',
  'popup.actionDetail.type': 'Тип',
  'popup.actionDetail.duration': 'Длительность',
  'popup.actionDetail.format': 'Формат',
  'popup.actionDetail.status': 'Статус',
  'popup.actionDetail.value': 'Значение',
  'popup.actionDetail.position': 'Позиция',
  'popup.actionDetail.body': 'Тело',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Метка',
  'popup.actionDetail.headers': 'Заголовки',
  'popup.actionDetail.params': 'Параметры',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': 'Загрузка сведений о текущей вкладке...',
  'popup.thisPage.noTab': 'Не удалось получить сведения о текущей вкладке',
  'popup.thisPage.columnMatch': 'Совпадение',
  'popup.thisPage.expandHeaderBadgeHint': 'Нажмите значок в строке, чтобы увидеть совпавшие запросы',
  'popup.thisPage.expandHeaderDocsHint': 'Нажмите значок ниже, чтобы открыть документацию',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} из ${plural(locale, Number(total), {
      one: '{count} запроса',
      few: '{count} запросов',
      many: '{count} запросов',
      other: '{count} запросов',
    })} содержат «${query}» — нажмите, чтобы развернуть`,
  'popup.thisPage.badgeNone': 'Совпавших запросов пока нет — нажмите, чтобы развернуть',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} совпавший запрос',
      few: '{count} совпавших запроса',
      many: '{count} совпавших запросов',
      other: '{count} совпавших запросов',
    })}, все отданы из кеша (тихие) — нажмите, чтобы развернуть`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), {
      one: '{count} совпавший запрос сработал',
      few: '{count} совпавших запроса сработали',
      many: '{count} совпавших запросов сработали',
      other: '{count} совпавших запросов сработали',
    })} + тихих (кеш): ${silent} — нажмите, чтобы развернуть`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} совпавший запрос',
      few: '{count} совпавших запроса',
      many: '{count} совпавших запросов',
      other: '{count} совпавших запросов',
    })} — нажмите, чтобы развернуть`,
  'popup.thisPage.systemPage': 'Системная страница',
  'popup.thisPage.systemPageHint': 'Правила заголовков не действуют на системных страницах браузера',
  'popup.thisPage.emptyNoRules': 'Ни одно правило не подходит к этой странице',
  'popup.thisPage.emptyNoRulesHint': 'Для этого домена правила не настроены',
  'popup.thisPage.ruleDisabled': 'Правило выключено',
  'popup.thisPage.rulePausedByGroup': 'Правило приостановлено своей коллекцией или папкой',
  'popup.thisPage.zeroRelated':
    'Правило нацелено на связанный домен — запросов к нему пока не наблюдалось. Оно сработает, как только страница выполнит такой запрос.',
  'popup.thisPage.zeroPage':
    'Шаблон подходит к этой странице, но подходящих запросов пока не наблюдалось. Повзаимодействуйте со страницей или перезагрузите её, чтобы их вызвать.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Единственный совпавший запрос ({count})',
      few: 'Все {count} совпавших запроса',
      many: 'Все {count} совпавших запросов',
      other: 'Все {count} совпавших запросов',
    }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} из {total} совпавших запросов',
  'popup.thisPage.shadowTooltip':
    '{prefix} обрываются правилом «{name}» (блокировка с более высоким приоритетом) — поэтому это правило на них заметно не влияет. Экспериментально: обнаружение перекрытий может ошибаться в обе стороны. Отключите в настройках, чтобы скрыть.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `Скрипт подтвердил ${plural(locale, Number(count), {
      one: '{count} срабатывание',
      few: '{count} срабатывания',
      many: '{count} срабатываний',
      other: '{count} срабатываний',
    })} на этой странице (достоверные данные от внедрения в страницу).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `Совпало ${plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    })} по URL-адресу, но внедрённый в страницу репортёр этого не подтвердил. Частые причины: строгая Content-Security-Policy блокирует внедрение, либо тип ресурса (таблица стилей, изображение, ссылка на манифест) обходит перехват fetch/XHR.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `Шаблон совпал с ${plural(locale, Number(count), {
      one: '{count} кешированным подресурсом',
      few: '{count} кешированными подресурсами',
      many: '{count} кешированными подресурсами',
      other: '{count} кешированными подресурсами',
    })} — действие не могло выполниться, потому что ответ миновал сеть. Перезагрузите страницу в обход кеша, чтобы выполнить свежий запрос.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `Совпало ${plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    })} на этой странице. Chrome declarativeNetRequest не сообщает, какое правило побеждает при нескольких совпадениях — мы наблюдаем совпадения URL-адресов, а не итоги арбитража.`,
  'popup.thisPage.pausedTagTooltip': 'Коллекция или папка приостановлена — правило не применяется',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} правило приостановлено',
      few: '{count} правила приостановлены',
      many: '{count} правил приостановлены',
      other: '{count} правил приостановлены',
    })} коллекцией`,
  'popup.thisPage.firing': 'сработали: {count}',
  'popup.thisPage.silentCached': 'тихих (кеш): {count}',
  'popup.thisPage.related': 'связанных: {count}',
  'popup.thisPage.liveMonitoring': 'Live — наблюдение за запросами',
  'popup.thisPage.visibleResourceTypes': 'ВИДИМЫЕ ТИПЫ РЕСУРСОВ',
  'popup.thisPage.showAll': 'Показать все',
  'popup.thisPage.filterResourceTypes': 'Фильтр типов ресурсов',
  'popup.thisPage.filterResourceTypesCount': 'Фильтр типов ресурсов (показано {shown} из {total})',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} тихий запрос (кеш)',
      few: '{count} тихих запроса (кеш)',
      many: '{count} тихих запросов (кеш)',
      other: '{count} тихих запросов (кеш)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    })} (тихих: ${silent})`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} из ${plural(locale, Number(total), {
      one: '{count} правила',
      few: '{count} правил',
      many: '{count} правил',
      other: '{count} правил',
    })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} из ${plural(locale, Number(total), {
      one: '{count} запроса',
      few: '{count} запросов',
      many: '{count} запросов',
      other: '{count} запросов',
    })}`,
  'popup.thisPage.matchedJoin': 'совпало: {parts}',
  'popup.thisPage.copyTsv': 'Копировать запросы как TSV',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Время',
  'popup.matched.columnUrl': 'URL запроса',
  'popup.matched.columnType': 'Тип',
  'popup.matched.columnDelivery': 'Доставка',
  'popup.matched.columnEvidence': 'Признак',
  'popup.matched.columnPattern': 'Шаблон',
  'popup.matched.matchedBy': 'совпало по',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': 'кеш',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip': 'Запрос в этом сеансе ушёл в сеть; ответ не был отдан из кеша.',
  'popup.matched.deliveryCachedTip':
    'Ответ отдан из HTTP-кеша браузера Chrome. Ваше правило применилось при первоначальной загрузке этого ответа или при повторной проверке.',
  'popup.matched.deliverySwTip':
    'Запрос перехватил сервис-воркер. Применилось ли ваше правило, зависит от того, что сервис-воркер сделал дальше.',
  'popup.matched.evidenceShadowed': 'перекрыт',
  'popup.matched.evidenceShadowedTip':
    'Этот запрос оборвало правило «{name}» (блокировка с более высоким приоритетом). Это правило на нём не выполнялось.',
  'popup.matched.evidenceConfirmed': 'подтверждён',
  'popup.matched.evidenceConfirmedTip':
    'Скрипт подтвердил это срабатывание из внедрения в страницу — достоверное свидетельство того, что правило выполнилось.',
  'popup.matched.evidenceFallback': 'косвенный',
  'popup.matched.evidenceFallbackTip':
    'Совпало по URL-адресу, но внедрённый в страницу репортёр этого не подтвердил. Частые причины: строгая Content-Security-Policy блокирует внедрение в MAIN-мир, либо тип ресурса (таблица стилей, изображение, ссылка на манифест) обходит перехват fetch/XHR.',
  'popup.matched.evidenceSilent': 'тихий',
  'popup.matched.evidenceSilentTip':
    'Шаблон совпал с этим подресурсом, но ответ был отдан из кеша / сервис-воркера / bfcache, поэтому действие правила не могло выполниться. Перезагрузите страницу в обход кеша, чтобы выполнить свежий запрос.',
  'popup.matched.evidenceMatched': 'совпал',
  'popup.matched.evidenceMatchedTip':
    'URL-адрес совпал с условиями этого правила. Chrome declarativeNetRequest не сообщает, какое правило побеждает в арбитраже — мы наблюдаем совпадения URL-адресов, а не выполнение.',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} из ${plural(locale, Number(total), {
      one: '{count} запроса',
      few: '{count} запросов',
      many: '{count} запросов',
      other: '{count} запросов',
    })} содержат «${query}»`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `Совпало ${plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    })}`,
  'popup.matched.emptySearch':
    'Ни один совпавший запрос не содержит «{query}». Очистите или расширьте поиск, чтобы увидеть все совпадения.',
  'popup.matched.emptyRelated':
    'Правило нацелено на связанный домен — совпадения появятся, когда страница выполнит запросы к этому домену.',
  'popup.matched.emptyPage':
    'Шаблон подходит к этой странице. Совпадения появятся, когда страница выполнит подходящие запросы — повзаимодействуйте со страницей или перезагрузите её, чтобы их вызвать.',
  'popup.matched.emptyNone': 'Совпавших запросов пока нет — перезагрузите страницу, чтобы их захватить.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'Заголовок',
  'popup.ruleType.block': 'Блокировка',
  'popup.ruleType.redirect': 'Перенаправление',
  'popup.ruleType.queryParam': 'Параметр запроса',
  'popup.ruleType.inject': 'Внедрение',
  'popup.ruleType.requestBody': 'API-запрос',
  'popup.ruleType.delay': 'Задержка',
  'popup.ruleType.response': 'API-ответ',
  'popup.ruleType.headerDesc': 'Изменять HTTP-заголовки',
  'popup.ruleType.blockDesc': 'Блокировать запросы',
  'popup.ruleType.redirectDesc': 'Перенаправлять запросы',
  'popup.ruleType.queryParamDesc': 'Изменять параметры запроса',
  'popup.ruleType.injectDesc': 'Внедрять скрипты или CSS',
  'popup.ruleType.requestBodyDesc': 'Изменять тело API-запроса (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Задерживать ответ',
  'popup.ruleType.responseDesc': 'Имитировать или изменять API-ответ (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'Совпадает напрямую с URL-адресом страницы',
  'popup.resourceType.subFrameTip': 'Применяется к фрейму iframe, загруженному этой страницей',
  'popup.resourceType.xhrTip': 'Применяется к вызовам fetch() и XMLHttpRequest',
  'popup.resourceType.scriptTip': 'Применяется к скриптам',
  'popup.resourceType.stylesheetTip': 'Применяется к таблицам стилей',
  'popup.resourceType.imageTip': 'Применяется к изображениям',
  'popup.resourceType.fontTip': 'Применяется к файлам шрифтов',
  'popup.resourceType.mediaTip': 'Применяется к аудио- и видеоресурсам',
  'popup.resourceType.websocketTip': 'Применяется к соединениям WebSocket',
  'popup.resourceType.pingTip': 'Применяется к запросам ping/beacon',
  'popup.resourceType.otherTip': 'Применяется к прочим ресурсам',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Пустое правило',
  'popup.palette.searchPlaceholder': 'Поиск по типам правил и шаблонам…',
  'popup.palette.noMatches': 'Нет совпадений для «{query}»',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Сочетания клавиш',
  'popup.shortcuts.press': 'для закрытия нажмите',
  'popup.shortcuts.or': 'или',
  'popup.shortcuts.toClose': '',
  'popup.shortcuts.groupNavigation': 'Навигация',
  'popup.shortcuts.groupActions': 'Действия',
  'popup.shortcuts.groupRow': 'Строки таблицы',
  'popup.shortcuts.groupBrowser': 'Браузер',
  'popup.shortcuts.groupTour': 'Экскурсия',
  'popup.shortcuts.openExtension': 'Открыть расширение',
  'popup.shortcuts.customize': 'Настроить сочетание для расширения ↗',
  'popup.shortcuts.toggleDebugMode': 'Переключить режим отладки',
  'popup.shortcuts.tabThisPage': 'Вкладка «Эта страница»',
  'popup.shortcuts.tabAllRules': 'Вкладка «Все правила»',
  'popup.shortcuts.tabCollections': 'Вкладка «Коллекции»',
  'popup.shortcuts.focusSearch': 'Перейти к поиску',
  'popup.shortcuts.prevPage': 'Предыдущая страница',
  'popup.shortcuts.nextPage': 'Следующая страница',
  'popup.shortcuts.addRule': 'Добавить новое правило',
  'popup.shortcuts.openWorkspace': 'Открыть рабочее пространство',
  'popup.shortcuts.openSettings': 'Открыть настройки',
  'popup.shortcuts.toggleSurface': 'Переключить всплывающее окно / боковую панель',
  'popup.shortcuts.toggleRulesPause': 'Приостановить / возобновить все правила',
  'popup.shortcuts.togglePauseFocused': 'Приостановить / возобновить коллекцию или папку',
  'popup.shortcuts.toggleOptionsMenu': 'Меню параметров',
  'popup.shortcuts.cycleTheme': 'Сменить тему',
  'popup.shortcuts.toggleCompactMode': 'Компактный режим',
  'popup.shortcuts.toggleShortcutsHelp': 'Эта панель',
  'popup.shortcuts.moveDown': 'Вниз',
  'popup.shortcuts.moveUp': 'Вверх',
  'popup.shortcuts.expandRow': 'Развернуть / войти в подстроки',
  'popup.shortcuts.collapseRow': 'Свернуть / выйти из подстрок',
  'popup.shortcuts.toggleRow': 'Включить / выключить',
  'popup.shortcuts.editRow': 'Изменить правило',
  'popup.shortcuts.copyValue': 'Копировать значение',
  'popup.shortcuts.deleteRow': 'Удалить (нажмите дважды)',
  'popup.shortcuts.openTourGuide': 'Открыть экскурсию',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Шаг {current} из {total}',
  'popup.tour.previous': 'Назад',
  'popup.tour.next': 'Далее',
  'popup.tour.finish': 'Готово',
  'popup.tour.welcomeTitle': 'Добро пожаловать в Open Headers',
  'popup.tour.welcomeSubtitle': 'Перехватывайте и изменяйте HTTP-трафик в реальном времени.',
  'popup.tour.modify': 'Изменяйте',
  'popup.tour.modifyDesc': 'Заголовки, файлы cookie, токены авторизации, CORS, полезные нагрузки',
  'popup.tour.route': 'Направляйте',
  'popup.tour.routeDesc': 'Перенаправляйте запросы, блокируйте трекеры, переписывайте URL-адреса',
  'popup.tour.debug': 'Отлаживайте',
  'popup.tour.debugDesc': 'Изучайте живые запросы, внедряйте скрипты, переопределяйте ответы',
  'popup.tour.migrateSwitching': 'Переходите с',
  'popup.tour.migrateOr': 'или',
  'popup.tour.migrateButton': 'Перенести из другого инструмента',
  'popup.tour.tabsTitle': 'Переключение вкладок',
  'popup.tour.tabsSubtitle': 'Нажмите цифру, чтобы переключиться мгновенно.',
  'popup.tour.thisPageHint': '— правила, подходящие к текущей вкладке',
  'popup.tour.allRulesHint': '— все созданные вами правила',
  'popup.tour.tagsLabel': 'Теги',
  'popup.tour.tagsHint': '— группируйте и приостанавливайте наборы',
  'popup.tour.workspaceTitle': 'Ваше рабочее пространство',
  'popup.tour.workspaceSubtitle': 'Полный редактор — открывается в отдельной вкладке.',
  'popup.tour.workspaceRequests': 'API-клиент',
  'popup.tour.workspaceRequestsHint': '— создавайте, отправляйте и сохраняйте API-запросы',
  'popup.tour.workspaceWorkflows': 'Рабочие процессы',
  'popup.tour.workspaceWorkflowsHint': '— объединяйте запросы в автоматические прогоны',
  'popup.tour.workspaceEnvs': 'Окружения и переменные',
  'popup.tour.workspaceEnvsHint': '— а также импорт, правила и командная синхронизация',
  'popup.tour.navTitle': 'Просмотр и навигация по правилам',
  'popup.tour.navSubtitle': 'Перемещайтесь по строкам с помощью сочетаний клавиш',
  'popup.tour.keyMove': 'Перейти',
  'popup.tour.keyExpand': 'Развернуть',
  'popup.tour.keyToggle': 'Переключить',
  'popup.tour.keyEdit': 'Изменить',
  'popup.tour.keyCopy': 'Копировать',
  'popup.tour.keyDelete': 'Удалить',
  'popup.tour.devtoolsTitle': 'Отладка сети в DevTools',
  'popup.tour.findThePrefix': 'Найдите вкладку',
  'popup.tour.findTheSuffix': 'в DevTools:',
  'popup.tour.devtoolsHint': 'Нажимайте эту кнопку в любой момент, чтобы увидеть инструкцию.',
  'popup.tour.shortcutsTitle': 'Все сочетания клавиш',
  'popup.tour.shortcutsSubtitle': 'Всплывающим окном можно полностью управлять с клавиатуры.',
  'popup.tour.pressLabel': 'Нажмите',
  'popup.tour.shortcutsHint': 'в любой момент, чтобы увидеть все сочетания',
  'popup.tour.debugModeTitle': 'Режим отладки',
  'popup.tour.debugModeSubtitle': 'Полный контроль над живым трафиком браузера.',
  'popup.tour.debugModeReqRes': 'Запросы и ответы',
  'popup.tour.debugModeReqResHint': '— переписывайте заголовки, тела и коды статуса на лету',
  'popup.tour.debugModeStreams': 'WebSocket и SSE',
  'popup.tour.debugModeStreamsHint': '— изучайте и редактируйте потоковые сообщения',
  'popup.tour.debugModeScripts': 'Скрипты и хранилище',
  'popup.tour.debugModeScriptsHint': '— внедряйте скрипты, изучайте файлы cookie и хранилище',
  'popup.tour.statusTitle': 'Состояние системы',
  'popup.tour.statusSubtitle':
    'Нажмите на точку, чтобы увидеть состояние подсистем: Sync, Rules, Requests, Permissions, Secrets и Live.',
  'popup.tour.statusGreen': 'Зелёный',
  'popup.tour.statusGreenDesc': '— всё в порядке',
  'popup.tour.statusYellow': 'Жёлтый',
  'popup.tour.statusYellowDesc': '— одна из подсистем сообщает о предупреждении',
  'popup.tour.statusRed': 'Красный',
  'popup.tour.statusRedDesc': '— одна из подсистем отказала',
  'popup.tour.growTitle': 'Помогите нам расти',
  'popup.tour.growSubtitle': 'Помогите нам расти и находить новых разработчиков.',
  'popup.tour.starGithub': 'Поставьте нам звезду на GitHub',
  'popup.tour.recommend': 'Порекомендуйте нас друзьям и коллегам',
  'popup.tour.growHint': 'Всё это всегда доступно под колокольчиком.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Изменение заголовков, запросов и ответов',
  'popup.devtools.featureTabs': 'Многовкладочные панели метаданных запроса',
  'popup.devtools.featureSearch': 'Расширенный поиск и фильтрация',
  'popup.devtools.featureDock': 'Перетаскиваемые боковые панели',
  'popup.devtools.addOverride': '+ Добавить/Переопределить',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Отладка сети',
  'popup.debug.step1': 'Откройте DevTools браузера',
  'popup.debug.step1a': 'На обычной странице, например',
  'popup.debug.notPrefix': 'Не на',
  'popup.debug.notSuffix': 'и не в новой вкладке (расширения там заблокированы).',
  'popup.debug.onPlatform': 'в {platform}',
  'popup.debug.menuHintSafari':
    'Сначала включите меню «Разработка» — Safari → Настройки → Дополнения → «Показывать функции для веб-разработчиков».',
  'popup.debug.clickThePrefix': 'Нажмите вкладку',
  'popup.debug.clickTheSuffix': '',
  'popup.debug.overflowPrefix': 'Последняя вкладка — может прятаться за кнопкой',
  'popup.debug.overflowSuffix': 'в меню переполнения.',
  'popup.debug.step3': 'Прокачайте свою отладку',
  'popup.debug.menuGlyphAria': 'Откройте меню Вид → Разработчикам → Инструменты разработчика',
  'popup.debug.tabGlyphAria':
    'DevTools закреплены с выбранной вкладкой Open Headers — боковые панели, список сети и разделённые многовкладочные панели',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': 'Разработчикам',
  'popup.debug.menuGlyphDeveloperTools': 'Инструменты разработчика',
} as const satisfies Catalog;
