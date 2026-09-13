/**
 * DevTools panel — shell chrome — Russian. Mirrors `catalogs/en/panel.ts`
 * key for key; see that file for the family map and the English
 * boundary (resource-type pills, throttle tier names, CDP method names,
 * header names, event names, chords, units and glyphs ride raw). The
 * tool-window nouns Network / Storage / Console / Docs ride raw as in
 * zh-CN / ja / ko (parity vocabulary) and take a head noun (окно,
 * панель, инструмент) where a case ending would follow; Поиск /
 * Уведомления / Активность правил / Совпавшие правила translate.
 * Mints: Сохранять журнал = Preserve log; Ещё фильтры = More filters;
 * Вид футера = Footer View (футер = the footer strip); Отключить кеш =
 * Disable cache; троттлинг = throttling; Переопределения = Overrides
 * (system); панель действий = activity bar; окно инструментов = tool
 * window (carried); evidence chips опровергнут / достоверный /
 * подтверждён / косвенный / тихий / подкреплён / выведен =
 * contradicted / authoritative / confirmed / fallback / silent /
 * corroborated / inferred (short masculine forms agreeing with the
 * fire — the popup's four carry over); попадание = hit; вне HAR =
 * off-HAR; Соотносите = Attribute (tour imperative); снимок =
 * snapshot; Декодированный / Исходный = the Decoded / Raw readout toggle
 * (Исходный = raw, as received — batch 2 carries it into the Formatted
 * / Raw toggle); задержка = latency (throttle rows); режим отладки = Debug
 * mode (carried). The devpanel settings option labels quote THESE
 * menu-row values verbatim when the ru settings-defs file lands.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Записывать сетевой журнал',
  'panel.toolbar.stopRecording': 'Остановить запись',
  'panel.toolbar.clear': 'Очистить сетевой журнал',
  'panel.toolbar.filter': 'Фильтр',
  'panel.toolbar.search': 'Поиск',
  'panel.toolbar.preserveLog': 'Сохранять журнал',
  'panel.toolbar.preserveLogTitle':
    'Сохранять запросы при переходах между страницами. Если выключено, список очищается при каждом переходе или перезагрузке, как в собственной панели Network браузера.',
  'panel.toolbar.aboutPreserveLog': 'О функции «Сохранять журнал»',
  'panel.toolbar.aboutMoreFilters': 'О меню «Ещё фильтры»',
  'panel.toolbar.aboutFooterView': 'О меню «Вид футера»',
  'panel.toolbar.moreTools': 'Ещё инструменты',
  'panel.toolbar.activeWorkspaceAria': 'Активное рабочее пространство: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Левая боковая панель',
  'panel.toolbar.bottomPanel': 'Нижняя панель',
  'panel.toolbar.rightSidebar': 'Правая боковая панель',
  'panel.toolbar.chooseBottomAlignment': 'Выбрать выравнивание нижней панели',
  'panel.toolbar.layoutOptions': 'Параметры компоновки',
  'panel.toolbar.bottomAlignTooltip.center': 'Нижняя панель: по центру (вложенная)',
  'panel.toolbar.bottomAlignTooltip.left': 'Нижняя панель: по левому краю',
  'panel.toolbar.bottomAlignTooltip.right': 'Нижняя панель: по правому краю',
  'panel.toolbar.bottomAlignTooltip.justify': 'Нижняя панель: на всю ширину',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomLayout': 'Компоновка нижней панели',
  'panel.layout.alignCenter': 'По центру (вложенная)',
  'panel.layout.alignLeft': 'Слева',
  'panel.layout.alignRight': 'Справа',
  'panel.layout.alignJustify': 'По ширине (на всю ширину)',
  'panel.layout.splitColumns': 'Рядом',
  'panel.layout.splitRows': 'Друг над другом',
  'panel.layout.showToolWindowNames': 'Показывать имена окон инструментов',
  'panel.layout.activityBarLayout': 'Компоновка панели действий',
  'panel.layout.sidebarProportional': 'Пропорционально (равные половины)',
  'panel.layout.sidebarCompact': 'Компактно (нижняя закреплена)',
  'panel.layout.sidebarStacked': 'Стопкой (всё сверху)',
  'panel.layout.sidebarDynamic': 'Динамически (по высоте панелей)',
  'panel.layout.defaultLayoutDonor': 'Компоновка по умолчанию: {unit}',
  'panel.layout.inheritsDefault': 'Наследует компоновку по умолчанию',
  'panel.layout.donorTooltip': 'Этот элемент ({unit}) задаёт компоновку по умолчанию — новые {units} наследуют её.',
  'panel.layout.nonDonorTooltip':
    'Компоновку по умолчанию задаёт другой элемент ({unit}) — новые {units} наследуют её оттуда.',
  'panel.layout.resetToDefaults': 'Сбросить компоновку',
  'panel.layout.restoreHidden': 'Вернуть скрытые инструменты панели действий',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Фильтр',
  'panel.filter.clear': 'Очистить',
  'panel.filter.clearAria': 'Очистить фильтр',
  'panel.filter.matchCase': 'Учитывать регистр (Alt+C)',
  'panel.filter.wholeWord': 'Только слово целиком (Alt+W)',
  'panel.filter.regex': 'Регулярное выражение (Alt+R)',
  'panel.filter.more': 'Ещё',
  'panel.filter.hiddenClearFilter': 'Очистить фильтр',
  'panel.filter.hiddenDismiss': 'Скрыть',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': 'Сбросить по умолчанию',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'Ещё фильтры',
  'panel.moreFilters.hideDataUrls': 'Скрыть data-URL',
  'panel.moreFilters.hideExtensionUrls': 'Скрыть URL-адреса расширений',
  'panel.moreFilters.blockedRequests': 'Заблокированные запросы',
  'panel.moreFilters.thirdParty': 'Сторонние запросы',
  'panel.moreFilters.swRequests': 'Запросы сервис-воркера',
  'panel.moreFilters.ruleApplied': 'Запросы с применённым правилом',
  'panel.moreFilters.pageOriginPending': 'Источник страницы пока недоступен',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Вид футера',
  'panel.view.title': 'Выберите, какие показатели показывать в футере',
  'panel.view.focusedTool': 'Активный инструмент',
  'panel.view.focusedToolTitle':
    'Футер следует за окном инструментов в фокусе — Storage, Console и Поиск показывают свои сводки; остальные инструменты показывают строку Network.',
  'panel.view.networkOnly': 'Только инструмент Network',
  'panel.view.networkOnlyTitle':
    'Футер всегда показывает показатели Network, какое бы окно инструментов ни было в фокусе.',
  'panel.view.modifiedCount': 'Число изменённых',
  'panel.view.failedCount': 'Число неудачных',
  'panel.view.cachedCount': 'Число из кеша',
  'panel.view.pageLabel': 'Метка текущей страницы',
  'panel.view.pageLabelTitle':
    'Если журнал охватывает несколько переходов, показывает, к какой странице относятся временные вехи.',
  'panel.view.timingAllNavs': 'Время по всем переходам',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load охватывают всю хронологию сохранённого журнала с первого перехода (как в браузере по умолчанию). Снимите флажок, чтобы учитывать только последний переход.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Экспорт трафика',
  'panel.export.exportAll': 'Экспортировать всё как HAR',
  'panel.export.exportAllSanitized': 'Экспортировать всё как HAR (с очисткой)',
  'panel.export.copyAll': 'Копировать всё как HAR',
  'panel.export.copyAllSanitized': 'Копировать всё как HAR (с очисткой)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Отключить кеш',
  'panel.cache.tooltipDebug':
    'Кеш отключается на уровне сетевого стека (режим отладки) — как встроенная функция «Отключить кеш» браузера.',
  'panel.cache.tooltipStandard':
    'HTTP-кеш обходится принудительной повторной проверкой. Включите режим отладки для полного отключения на уровне сетевого стека (включая кеш в памяти).',
  'panel.cache.aboutAria': 'О функции «Отключить кеш»',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'Без троттлинга',
  'panel.throttle.custom': 'Свой',
  'panel.throttle.customEllipsis': 'Свой…',
  'panel.throttle.customHint': 'Задайте загрузку, отдачу и задержку.',
  'panel.throttle.customTitle': 'Свой троттлинг',
  'panel.throttle.download': 'Загрузка',
  'panel.throttle.upload': 'Отдача',
  'panel.throttle.latency': 'Задержка',
  'panel.throttle.appliesToTab': 'Действует для этой вкладки',
  'panel.throttle.morePresets': 'Ещё профили',
  'panel.throttle.morePresetsSubtitle': 'Оптоволокно, кабель, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Проводные',
  'panel.throttle.mobile': 'Мобильные',
  'panel.throttle.disabledTooltip':
    'Троттлинг сети доступен только в режиме отладки. Включите режим отладки, чтобы ограничить скорость этой вкладки.',
  'panel.throttle.aboutAria': 'О троттлинге сети',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · задержка 2 ms',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · задержка 8 ms',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · задержка 25 ms',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · задержка 8 ms',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · задержка 18 ms',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · задержка 165 ms',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · задержка 562.5 ms',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · задержка 2000 ms',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · задержка 2000 ms',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · задержка 3000 ms',
  'panel.throttle.subtitle.offline': 'Блокирует весь сетевой трафик вкладки.',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': 'Применить',
  'panel.debug.enableDebugMode': 'Включить режим отладки',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Переопределения',
  'panel.overrides.disabledTooltip':
    'Системные переопределения доступны только в режиме отладки. Включите режим отладки, чтобы переопределять эту вкладку.',
  'panel.overrides.aboutAria': 'О системных переопределениях',
  'panel.overrides.wireHint':
    'Отправляются с запросами и сообщаются скриптам страницы, пока вкладка остаётся в режиме отладки.',
  'panel.overrides.pageOnlyHint':
    'Только страница — меняют то, что видят собственные скрипты и CSS страницы, а не запросы.',
  'panel.overrides.platform': 'Платформа',
  'panel.overrides.locale': 'Локаль',
  'panel.overrides.timezone': 'Часовой пояс',
  'panel.overrides.colorScheme': 'Цветовая схема',
  'panel.overrides.reducedMotion': 'Меньше движения',
  'panel.overrides.printMedia': 'Медиа печати',
  'panel.overrides.uaPlaceholder': 'Своя строка User-Agent',
  'panel.overrides.alPlaceholder': 'например fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, например Linux',
  'panel.overrides.localePlaceholder': 'Настоящая локаль',
  'panel.overrides.timezonePlaceholder': 'Настоящий часовой пояс',
  'panel.overrides.auto': 'Авто',
  'panel.overrides.light': 'Светлая',
  'panel.overrides.dark': 'Тёмная',
  'panel.overrides.reduce': 'Меньше',
  'panel.overrides.noPref': 'Без предпочтения',
  'panel.overrides.screen': 'Экран',
  'panel.overrides.print': 'Печать',
  'panel.overrides.resetAll': 'Сбросить всё',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Сохраняет записанные запросы при переходах и перезагрузках страницы вместо очистки списка при каждой смене страницы.',
  'panel.info.preserveLog.description':
    'Включено — журнал переносится через каждый переход, поэтому запросы, выполненные прямо перед перенаправлением, отправкой формы или перезагрузкой, остаются видны. Выключено — список очищается при каждом переходе или перезагрузке, как в собственной панели Network браузера, и показывает только трафик текущей страницы.',
  'panel.info.preserveLog.whenHeading': 'Когда пригодится',
  'panel.info.preserveLog.redirects': 'Перенаправления',
  'panel.info.preserveLog.redirectsDesc': 'Изучить запрос, вызвавший переход, прежде чем новая страница его сотрёт.',
  'panel.info.preserveLog.forms': 'Отправка форм / вход',
  'panel.info.preserveLog.formsDesc': 'Сохранить POST-запрос и его ответ после перезагрузки страницы.',
  'panel.info.preserveLog.reloadLoops': 'Циклы перезагрузки',
  'panel.info.preserveLog.reloadLoopsDesc':
    'Увидеть, что выполнилось прямо перед тем, как страница перезагрузила сама себя.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Дополнительные фильтры запросов, спрятанные в меню — каждый сужает список, не занимая места на панели инструментов.',
  'panel.info.moreFilters.hideHeading': 'Скрыть',
  'panel.info.moreFilters.dataUrls': 'Data-URL',
  'panel.info.moreFilters.dataUrlsDesc':
    'Исключить встроенные ресурсы data: — изображения и шрифты в base64 и тому подобное.',
  'panel.info.moreFilters.extensionUrls': 'URL-адреса расширений',
  'panel.info.moreFilters.extensionUrlsDesc': 'Исключить запросы к источникам расширений браузера.',
  'panel.info.moreFilters.onlyHeading': 'Показывать только',
  'panel.info.moreFilters.blocked': 'Заблокированные запросы',
  'panel.info.moreFilters.blockedDesc': 'Оставить в списке только запросы, заблокированные правилом.',
  'panel.info.moreFilters.thirdParty': 'Сторонние запросы',
  'panel.info.moreFilters.thirdPartyDesc':
    'Оставить только запросы, источник которых отличается от источника страницы.',
  'panel.info.moreFilters.swRequests': 'Запросы сервис-воркера',
  'panel.info.moreFilters.swRequestsDesc':
    'Оставить только обмены с сервис-воркером — запросы, которые воркер выполнил сам (строки ⚙), и запросы страницы, на которые ответил его обработчик fetch.',
  'panel.info.moreFilters.ruleApplied': 'Запросы с применённым правилом',
  'panel.info.moreFilters.ruleAppliedDesc':
    'Оставить только запросы, которые правило Open Headers достоверно изменило.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Выбирает, какие дополнительные показатели футер показывает рядом с постоянными счётчиками запросов и переданных данных.',
  'panel.info.view.scopeHeading': 'Охват сводки',
  'panel.info.view.focusedTool': 'Активный инструмент',
  'panel.info.view.focusedToolDesc':
    'Футер следует за окном инструментов в фокусе — Storage, Console и Поиск показывают свои строки сводки; остальные инструменты показывают строку Network.',
  'panel.info.view.networkOnly': 'Только инструмент Network',
  'panel.info.view.networkOnlyDesc':
    'Футер всегда показывает показатели Network, какое бы окно инструментов ни было в фокусе.',
  'panel.info.view.countsHeading': 'Счётчики футера',
  'panel.info.view.modified': 'Изменённые',
  'panel.info.view.modifiedDesc': 'Сколько запросов изменило правило.',
  'panel.info.view.failed': 'Неудачные',
  'panel.info.view.failedDesc': 'Сколько запросов завершились ошибкой или были заблокированы.',
  'panel.info.view.cached': 'Из кеша',
  'panel.info.view.cachedDesc': 'Сколько ответов было отдано из кеша.',
  'panel.info.view.timingHeading': 'Время',
  'panel.info.view.pageLabel': 'Метка текущей страницы',
  'panel.info.view.pageLabelDesc':
    'Показывает, к какой странице относятся временные вехи, если журнал охватывает несколько переходов.',
  'panel.info.view.allNavs': 'По всем переходам',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load охватывают всю хронологию сохранённого журнала, а не только последний переход.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Запрещает этой вкладке отдавать ответы из кеша.',
  'panel.info.cache.debugDesc':
    'Вкладка в режиме отладки: кеш отключён на уровне сетевого стека — включая кеш в памяти — как встроенная функция «Отключить кеш» браузера.',
  'panel.info.cache.standardDesc':
    'Вкладка в обычном режиме: обходится только HTTP-кеш — сервер просят повторно проверить актуальность. Включите режим отладки для полного отключения на уровне сетевого стека, которое очищает и кеш в памяти.',
  'panel.info.cache.standardHeading': 'Обычный режим',
  'panel.info.cache.revalidateDesc':
    'Добавляется к каждому запросу, чтобы сервер заново проверил актуальность. Обходит только HTTP-кеш.',
  'panel.info.cache.debugHeading': 'Режим отладки',
  'panel.info.cache.cdpDesc': 'Отключает кеш для всей вкладки на уровне сетевого стека, включая кеш в памяти.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'Системные переопределения',
  'panel.info.overrides.summary':
    'Закрепляет системную идентичность этой вкладки — User-Agent, локаль, часовой пояс и эмулируемые медиа — чтобы увидеть, как сайт отвечает другому клиенту.',
  'panel.info.overrides.debugDesc':
    'Действует на этой вкладке через режим отладки. Аспекты User-Agent применяются к запросам и к скриптам страницы; локаль, часовой пояс и медиа меняют только то, что видят собственные скрипты и CSS страницы. «Сбросить всё» возвращает настоящие значения.',
  'panel.info.overrides.standardDesc':
    'Системным переопределениям нужен режим отладки — запасного варианта для обычного режима нет. Включите режим отладки и держите эту вкладку в области действия, чтобы переопределять её.',
  'panel.info.overrides.wireHeading': 'В запросах + скриптах страницы',
  'panel.info.overrides.uaDesc':
    'Задаёт заголовки User-Agent / Accept-Language, платформу и соответствующие значения navigator.*.',
  'panel.info.overrides.pageHeading': 'Только страница',
  'panel.info.overrides.localeDesc': 'Меняет локаль, которую читают скрипты страницы.',
  'panel.info.overrides.timezoneDesc': 'Меняет часовой пояс, который определяют Date и Intl.',
  'panel.info.overrides.mediaDesc': 'Принудительно задаёт медиазапросы color-scheme / reduced-motion / print.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Троттлинг сети',
  'panel.info.throttle.summary':
    'Имитирует медленные соединения, ограничивая пропускную способность этой вкладки и добавляя задержку.',
  'panel.info.throttle.debugDesc':
    'Действует на этой вкладке через режим отладки. Выберите профиль — стандартные плюс оптоволокно / кабель / DSL и 5G / 2G в меню «Ещё профили», — перейдите в режим Offline или задайте свои загрузку / отдачу / задержку.',
  'panel.info.throttle.standardDesc':
    'Троттлингу нужен режим отладки — запасного варианта для обычного режима нет. Включите режим отладки и держите эту вкладку в области действия, чтобы ограничить её скорость.',
  'panel.info.throttle.presetsHeading': 'Профили',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s на загрузку, задержка 165 ms.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s на загрузку, задержка 562.5 ms.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, задержка 2000 ms.',
  'panel.info.throttle.offlineDesc': 'Блокирует весь сетевой трафик вкладки.',
  'panel.info.throttle.wiredHeading': 'Ещё профили · Проводные',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, задержка 2 ms.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s на загрузку, задержка 8 ms.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s на загрузку, задержка 25 ms.',
  'panel.info.throttle.mobileHeading': 'Ещё профили · Мобильные',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s на загрузку, задержка 8 ms.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s на загрузку, задержка 18 ms.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, задержка 2000 ms.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, задержка 3000 ms.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    }),
  'panel.status.requestsSubset': '{subset} / {total} запросов',
  'panel.status.modified': 'изменено: {count}',
  'panel.status.modifiedTitle': 'Запросы, изменённые вашими правилами',
  'panel.status.failed': 'неудачных: {count}',
  'panel.status.failedTitle': 'Неудачные запросы и запросы со статусом ошибки',
  'panel.status.cached': 'из кеша: {count}',
  'panel.status.cachedTitle': 'Запросы, отданные из кеша',
  'panel.status.transferredOnly': 'передано {size}',
  'panel.status.transferredAndResources': 'передано {transferred} / ресурсов {resources}',
  'panel.status.transferredSubset': 'передано {subset} / {total}',
  'panel.status.resourcesSubset': 'ресурсов {subset} / {total}',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Событие Load',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} вкладка',
      few: '{count} вкладки',
      many: '{count} вкладок',
      other: '{count} вкладок',
    }),
  'panel.status.messagesOf': '{visible} из {total} сообщений',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сообщение',
      few: '{count} сообщения',
      many: '{count} сообщений',
      other: '{count} сообщений',
    }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} ошибка',
      few: '{count} ошибки',
      many: '{count} ошибок',
      other: '{count} ошибок',
    }),
  'panel.status.errorsTitle': 'Сообщения консоли уровня «ошибка»',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} предупреждение',
      few: '{count} предупреждения',
      many: '{count} предупреждений',
      other: '{count} предупреждений',
    }),
  'panel.status.warningsTitle': 'Сообщения консоли уровня «предупреждение»',
  'panel.status.systemStatus': 'Система',
  'panel.status.theme.light': 'Светлая',
  'panel.status.theme.dark': 'Тёмная',
  'panel.status.theme.auto': 'Авто',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.capture.collapsePlane': 'Свернуть этот раздел',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Поиск',
  'panel.toolWindows.notifications': 'Уведомления',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Активность правил',
  'panel.toolWindows.matchedRules': 'Совпавшие правила',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': 'Поиск (нажмите Enter)',
  'panel.search.inputAria': 'Поиск по захваченным данным',
  'panel.search.syntaxHelp': 'Справка по синтаксису поиска',
  'panel.search.run': 'Искать',
  'panel.search.runTitle': 'Выполнить поиск (Enter)',
  'panel.search.cancel': 'Отмена',
  'panel.search.cancelTitle': 'Отменить поиск',
  'panel.search.idleHintMin': 'Введите запрос (минимум 2 символа) и нажмите Enter для поиска.',
  'panel.search.idleHintShort': 'Нажмите Enter для поиска.',
  'panel.search.noMatches': 'Совпадений не найдено.',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': 'Поиск… {done} / {total}',
  'panel.search.status.noResults': 'Нет результатов · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), {
      one: 'Найдено {count} совпадение',
      few: 'Найдено {count} совпадения',
      many: 'Найдено {count} совпадений',
      other: 'Найдено {count} совпадений',
    });
    const where = plural(locale, Number(files), {
      one: '{count} файле',
      few: '{count} файлах',
      many: '{count} файлах',
      other: '{count} файлах',
    });
    return `${found} в ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'показаны первые {shown} — уточните запрос, чтобы увидеть остальные',

  // Result groups + rows
  'panel.search.group.countTitle': 'Совпадений в этом файле: {count}',
  'panel.search.group.countTitleCapped': 'Совпадений в этом файле: {count} — показаны первые {shown}',
  'panel.search.row.lineCol': 'Строка {line}, столбец {col}',
  'panel.search.row.line': 'Строка {line}',
  'panel.search.row.matchesOnLine': 'Совпадений в этой строке: {count}',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': 'Выберите запрос, чтобы увидеть, какие правила',
  'panel.matchedRules.selectPrompt.tail': 'к нему применяются',
  'panel.matchedRules.matchedCount': 'Совпали · {count}',
  'panel.matchedRules.futureCount': 'Будущие совпадения · {count}',
  'panel.matchedRules.noMatched': 'Ни одно правило не совпало с этим запросом.',
  'panel.matchedRules.noFuture': 'Другие правила с этим запросом не совпали бы.',
  'panel.matchedRules.pattern': 'Шаблон: {pattern}',
  'panel.matchedRules.wouldMatch': 'совпало бы',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': 'опровергнут',
  'panel.matchedRules.evidence.authoritative': 'достоверный',
  'panel.matchedRules.evidence.confirmed': 'подтверждён',
  'panel.matchedRules.evidence.fallback': 'косвенный',
  'panel.matchedRules.evidence.silent': 'тихий',
  'panel.matchedRules.evidence.corroborated': 'подкреплён',
  'panel.matchedRules.evidence.inferred': 'выведен',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Опровергнут — захваченные заголовки опровергают изменение, о котором заявило это правило.',
  'panel.matchedRules.evidenceTitle.authoritative':
    'Достоверный — движок правил подтвердил, что это DNR-правило выполнилось на запросе.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Подтверждён — правило изменило тело в контексте страницы, и для этого запроса захвачены обе стороны (отданная и исходная).',
  'panel.matchedRules.evidenceTitle.confirmed':
    'Подтверждён внедрённым в страницу репортёром — скриптовое действие выполнилось внутри страницы.',
  'panel.matchedRules.evidenceTitle.fallback':
    'Выведен из совпадения URL-адреса — ожидалось подтверждение от скрипта, но оно не пришло.',
  'panel.matchedRules.evidenceTitle.silent':
    'Шаблон совпал, но запрос был отдан из кеша / сервис-воркера — ни DNR-правило, ни скриптовое действие не выполнялись.',
  'panel.matchedRules.evidenceTitle.corroborated': 'Подкреплён — заявленное изменение видно в захваченных заголовках.',
  'panel.matchedRules.evidenceTitle.inferred':
    'Выведен из совпадения URL-адреса — по своим условиям правило совпало бы с этим запросом.',
  'panel.matchedRules.contradiction.stillPresent': 'Заголовок {header} всё ещё присутствует ({observed}).',
  'panel.matchedRules.contradiction.missing': 'Заголовок {header} отсутствует среди захваченных заголовков.',
  'panel.matchedRules.contradiction.otherValue':
    'Заголовок {header} содержит «{observed}» вместо заявленного значения.',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': 'правило удалено',
  'panel.matchedRules.ruleState.disabled': 'правило выключено',
  'panel.matchedRules.ruleState.modified': 'правило изменено',
  'panel.matchedRules.ruleStateTitle.deleted':
    'Это правило было удалено после срабатывания. Строка показывает, что оно делало в момент срабатывания.',
  'panel.matchedRules.ruleStateTitle.disabled':
    'Это правило было выключено после срабатывания — к следующему запросу оно не применится.',
  'panel.matchedRules.ruleStateTitle.modified':
    'Это правило было изменено после срабатывания. Строка показывает, что оно делало в момент срабатывания; наведите курсор, чтобы увидеть текущее правило.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'На этой вкладке пока нет активности правил.',
  'panel.ruleActivity.toolbarHint': 'Активность правил, сгруппированная по правилам.',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': 'Применённые',
  'panel.ruleActivity.hint.appliedDesc':
    'срабатывания подтверждены — движок правил сообщил, что правило выполнилось, внедрённый в страницу репортёр подтвердил действие, либо изменение видно в захваченных заголовках.',
  'panel.ruleActivity.hint.contradicted': 'Опровергнутые',
  'panel.ruleActivity.hint.contradictedDesc':
    'срабатывания заявили об изменении заголовка, которое захваченные заголовки опровергают.',
  'panel.ruleActivity.hint.inferred': 'Выведенные',
  'panel.ruleActivity.hint.inferredDesc':
    'срабатывания сопоставляют шаблоны ваших правил с наблюдаемыми запросами, но подтвердить их не удалось.',
  'panel.ruleActivity.hint.offHar': 'Вне HAR',
  'panel.ruleActivity.hint.offHarDesc': 'срабатывания — совпадения правил на запросах, которые панель не захватила.',
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} попадание',
      few: '{count} попадания',
      many: '{count} попаданий',
      other: '{count} попаданий',
    }),
  'panel.ruleActivity.applied': 'применено: {count}',
  'panel.ruleActivity.contradicted': 'опровергнуто: {count}',
  'panel.ruleActivity.offHar': 'вне HAR: {count}',
  'panel.ruleActivity.offHarTitle': 'Вне HAR — панель не захватила HAR-оболочку для этого срабатывания',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': 'Правила',
  'panel.valueDoc.saveHint': 'Заново закодировать изменённое значение и записать его обратно в правило',
  'panel.valueDoc.blockedHintInvalid': 'Изменённый текст нельзя закодировать для этого типа значения',
  'panel.valueDoc.blockedHintDetached': 'Поле правила, которому принадлежало это значение, исчезло',
  'panel.valueDoc.rereadTitle': 'Заново прочитать значение из правила',
  'panel.valueDoc.rereadConfirm': 'Отменит ваши правки — нажмите ещё раз, чтобы перечитать',
  'panel.valueDoc.rereadAria': 'Отменить правки и перечитать значение',
  'panel.valueDoc.openRuleTitle': 'Открыть это правило в редакторе рабочего пространства',
  'panel.valueDoc.openRule': 'Открыть правило в рабочем пространстве',
  'panel.valueDoc.driftNote':
    'Значение в правиле изменилось, пока вы его редактировали — ваши несохранённые правки сохранены. Сохранение перезапишет его.',
  'panel.valueDoc.undetectedNote':
    'Поле больше не содержит значение, которое этот редактор умеет кодировать — ваши несохранённые правки сохранены для копирования.',
  'panel.valueDoc.detachedNote':
    'Поле правила, которому принадлежало это значение, исчезло — ваши несохранённые правки сохранены для копирования.',
  'panel.valueDoc.discardEdits': 'Отменить мои правки',
  'panel.valueDoc.saveFailed.detached':
    'Изменение, которому принадлежало это значение, исчезло из правила — записывать некуда.',
  'panel.valueDoc.saveFailed.notFound': 'Правило не найдено — возможно, оно было удалено.',
  'panel.valueDoc.saveFailed.write': 'Не удалось сохранить — правило отклонило запись.',
  'panel.valueDoc.encodedPreview': 'Предпросмотр в закодированном виде',
  'panel.valueDoc.cannotEncode': 'Не удаётся закодировать — изменённое значение недопустимо для этого типа',
  'panel.valueDoc.undetectedTitle': 'Больше не закодированное значение',
  'panel.valueDoc.undetectedSub':
    'Текущее значение поля не подходит ни под один декодер — измените его в редакторе правил.',
  'panel.valueDoc.detachedTitle': 'Значения больше нет в правиле',
  'panel.valueDoc.detachedSub':
    'Правило или изменение, содержавшее это значение, удалено, либо операция больше не несёт значения.',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  // The crumb's source name rides raw as data; the type title comes
  // from the shared value-editor title keys.
  'panel.valueView.snapshotNote': 'Снимок',
  'panel.valueView.snapshotTitle': 'Захвачено при открытии этого документа — последующие изменения не отслеживаются.',
  'panel.valueView.encodedValue': 'Закодированное значение',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  // Rule names ride raw as data; status codes and MIME values stay raw.
  'panel.ruleDoc.crumbKind': 'Переопределение ответа',
  'panel.ruleDoc.nameLabel': 'Имя правила',
  'panel.ruleDoc.saveHint': 'Сохранить правило переопределения — оно остаётся опубликованным тем же шагом',
  'panel.ruleDoc.saveHintCreate': 'Создать правило и опубликовать его',
  'panel.ruleDoc.blockedHintDetached': 'Правило, которому принадлежал этот документ, исчезло',
  'panel.ruleDoc.rereadTitle': 'Перечитать правило',
  'panel.ruleDoc.rereadConfirm': 'Отменит ваши правки — нажмите ещё раз, чтобы перечитать',
  'panel.ruleDoc.rereadAria': 'Отменить правки и перечитать правило',
  'panel.ruleDoc.openRuleTitle': 'Открыть это правило в редакторе рабочего пространства',
  'panel.ruleDoc.openRule': 'Открыть в рабочем пространстве',
  'panel.ruleDoc.saveFailed.notFound': 'Правило не найдено — возможно, оно было удалено.',
  'panel.ruleDoc.saveFailed.write': 'Не удалось сохранить — правило отклонило запись.',
  'panel.ruleDoc.detachedTitle': 'Правило больше не существует',
  'panel.ruleDoc.detachedSub': 'Правило переопределения, которое редактировал этот документ, удалено.',
  'panel.ruleDoc.dynamicTitle': 'Правило с динамическим телом',
  'panel.ruleDoc.dynamicSub': 'Тела ответов на JavaScript редактируются в редакторе рабочего пространства.',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'Шаг {current} из {total}',
  'panel.tour.previous': 'Назад',
  'panel.tour.next': 'Далее',
  'panel.tour.finish': 'Готово',
  'panel.tour.welcomeTitle': 'Единый опыт DevTools',
  'panel.tour.welcomeSubtitle': 'Сетевой отладчик со встроенными правилами.',
  'panel.tour.welcomeCapture': 'Захватывайте',
  'panel.tour.welcomeCaptureHint': '— живые запросы с таймингами, заголовками и размерами',
  'panel.tour.welcomeRules': 'Соотносите',
  'panel.tour.welcomeRulesHint': '— смотрите, какие правила сработали на каждом запросе и почему',
  'panel.tour.welcomeState': 'Изучайте',
  'panel.tour.welcomeStateHint': '— файлы cookie, хранилище и консоль рядом с трафиком',
  'panel.tour.networkTitle': 'Окно Network',
  'panel.tour.networkSubtitle': 'Каждый запрос инспектируемой вкладки — вживую.',
  'panel.tour.networkFilters': 'Фильтруйте',
  'panel.tour.networkFiltersHint': '— по тексту, типу ресурса или профилям из меню «Ещё фильтры»',
  'panel.tour.networkToolbar': 'Управляйте',
  'panel.tour.networkToolbarHint': '— «Сохранять журнал», троттлинг и «Отключить кеш» сверху',
  'panel.tour.networkExport': 'Экспортируйте',
  'panel.tour.networkExportHint': '— сохраняйте или копируйте весь журнал как HAR',
  'panel.tour.storageTitle': 'Окно Storage',
  'panel.tour.storageSubtitle': 'Клиентское состояние инспектируемой вкладки в одном месте.',
  'panel.tour.storageAreas': 'Просматривайте',
  'panel.tour.storageAreasHint': '— локальное и сеансовое хранилище, файлы cookie, IndexedDB, кеши',
  'panel.tour.storageEdit': 'Редактируйте',
  'panel.tour.storageEditHint': '— открывайте любую запись как вкладку документа и меняйте её на месте',
  'panel.tour.inspectorTitle': 'Детали запроса',
  'panel.tour.inspectorSubtitle': 'Выберите запрос, чтобы открыть его здесь как вкладку.',
  'panel.tour.inspectorTabs': 'Разделы',
  'panel.tour.inspectorTabsHint': '— заголовки, полезная нагрузка, ответ, тайминги и файлы cookie',
  'panel.tour.inspectorEdit': 'Переопределяйте',
  'panel.tour.inspectorEditHint': '— создавайте правило из запроса, не покидая панель',
  'panel.tour.layoutTitle': 'Настройте под себя',
  'panel.tour.layoutSubtitle': 'В боковых рейках есть ещё окна инструментов.',
  'panel.tour.layoutTools': 'Ещё инструменты',
  'panel.tour.layoutToolsHint': '— Console, Поиск, Docs и уведомления живут на рейках',
  'panel.tour.layoutDrag': 'Переставляйте',
  'panel.tour.layoutDragHint': '— перетаскивайте окна инструментов между доками; меню компоновки сбрасывает всё',
  'panel.tour.debugTitle': 'Режим отладки',
  'panel.tour.debugSubtitle': 'По умолчанию выключен — включайте здесь, когда нужен более глубокий захват.',
  'panel.tour.debugUnlocks': 'Открывает',
  'panel.tour.debugUnlocksHint': '— тела ответов, консоль, точные тайминги и правила скриптового уровня',
  'panel.tour.debugBanner': 'Имейте в виду',
  'panel.tour.debugBannerHint': '— пока он включён, браузер показывает баннер отладки на подключённых вкладках',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': 'Декодированный',
  'panel.valueExpander.raw': 'Исходный',
} as const satisfies Catalog;
