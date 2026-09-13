/**
 * DevTools panel — request inspector shell + detail tabs — Russian.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary, the
 * panel-docs raw-quote precedent, вкладка as head noun), Diff, and
 * wire tokens (HEAD / CONNECT / 204 No Content / Server-Timing).
 * Mints: инициатор = initiator (prose referent — the tab noun rides
 * raw; carried from the popup condition label); каскад = cascade; стек
 * вызовов = call stack (трассировка стека stays the fixed stack-trace
 * compound); фрейм here = stack frame (context-partitioned with the
 * WebSocket referent in panel-inspector-streams); скрыть = redact
 * (секреты); форматировать = pretty print (carried from
 * panel-storage's Форматированный); тайминги = timing prose;
 * блокировка головы очереди = head-of-line blocking; разделить =
 * split carried from streams; Hex-просмотрщик rides the просмотрщик
 * family; имитация = mock carried. The timing insight tails carry NO
 * leading space — the render site joins `<strong>{rung}</strong>
 * {tail}` with its own space, so the tail OPENS with the head noun
 * (этап …).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  'panel.inspector.detailEmpty.requestGone': 'Запрос больше недоступен (очищен или страница ушла)',
  'panel.inspector.detailEmpty.selectPrefix': 'Выберите запрос в панели',
  'panel.inspector.detailEmpty.selectSuffix': 'Network, чтобы изучить его',
  'panel.inspector.detailEmpty.noSelection': 'Выберите захваченный запрос для изучения',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  'panel.inspector.tabBar.closeTab': 'Закрыть вкладку',
  'panel.inspector.tabBar.unsavedChanges': 'Несохранённые изменения',
  'panel.inspector.tabBar.searchTabs': 'Поиск по вкладкам',
  'panel.inspector.tabBar.searchPlaceholder': 'Поиск по вкладкам…',
  'panel.inspector.tabBar.noOpenTabs': 'Нет открытых вкладок',
  'panel.inspector.tabBar.noOpenTabsMatch': 'Ни одна открытая вкладка не подходит под ваш запрос',
  'panel.inspector.tabBar.noClosedTabsMatch': 'Ни одна закрытая вкладка не подходит под ваш запрос',
  'panel.inspector.tabBar.recentlyClosed': 'Недавно закрытые ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Недавно закрытые ({matched} из {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': 'Сохранить изменения?',
  'panel.inspector.tabBar.closeGuard.unsavedBody':
    'содержит несохранённые изменения. Сохраните их, чтобы не потерять работу.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'Не сохранять',
  'panel.inspector.tabBar.closeGuard.cancel': 'Отмена',
  'panel.inspector.tabBar.closeGuard.save': 'Сохранить изменения',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': 'Закрыть',
  'panel.inspector.tabMenu.closeOther': 'Закрыть другие вкладки',
  'panel.inspector.tabMenu.closeAll': 'Закрыть все вкладки',
  'panel.inspector.tabMenu.closeToLeft': 'Закрыть вкладки слева',
  'panel.inspector.tabMenu.closeToRight': 'Закрыть вкладки справа',
  'panel.inspector.tabMenu.splitAndMove': 'Разделить и переместить',
  'panel.inspector.tabMenu.right': 'Вправо',
  'panel.inspector.tabMenu.left': 'Влево',
  'panel.inspector.tabMenu.down': 'Вниз',
  'panel.inspector.tabMenu.up': 'Вверх',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'Переместить в противоположную группу',
  'panel.inspector.tabMenu.changeSplitterOrientation': 'Сменить ориентацию разделителя',
  'panel.inspector.tabMenu.unsplit': 'Объединить',
  'panel.inspector.tabMenu.unsplitAll': 'Объединить все',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns, same as the workbench tab nouns).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': 'Изменить переопределение',
  'panel.inspector.overrideCta.editOverrideTitle':
    'Изменить правило, создавшее этот ответ — изменения применятся к будущим запросам',
  'panel.inspector.overrideCta.overrideResponse': 'Переопределить ответ',
  'panel.inspector.overrideCta.overrideResponseTitle':
    'Создать правило, которое отдаёт этот ответ как редактируемую имитацию',
  'panel.inspector.overrideCta.editQueryParams': 'Изменить переопределение параметров запроса',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'Изменить правило, переписавшее эти параметры запроса — изменения применятся к будущим запросам',
  'panel.inspector.overrideCta.overrideQueryParams': 'Переопределить параметры запроса',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'Создать правило, которое переписывает эти параметры запроса',
  'panel.inspector.overrideCta.editRequestBody': 'Изменить переопределение тела запроса',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'Изменить правило, заменившее это тело запроса — изменения применятся к будущим запросам',
  'panel.inspector.overrideCta.overrideRequestBody': 'Переопределить тело запроса',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Создать правило, которое заменяет это тело запроса редактируемым статическим телом',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Полный ответ',
  'panel.inspector.dualView.fullRequest': 'Полный запрос',
  'panel.inspector.dualView.swapSides': 'Поменять стороны',
  'panel.inspector.dualView.hideUnchanged': 'Скрыть неизменённое',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': 'Исходный · сервер → страница',
  'panel.inspector.paneCaption.responseModified': 'Изменённый · сервер → Open Headers → страница',
  'panel.inspector.paneCaption.requestOriginal': 'Исходный · страница → сервер',
  'panel.inspector.paneCaption.requestModified': 'Изменённый · страница → Open Headers → сервер',
  'panel.inspector.paneCaption.wsRecvDropped': 'Отброшен · до страницы не дошёл',
  'panel.inspector.paneCaption.wsSendDropped': 'Отброшен · до сервера не дошёл',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': 'Нет тела ответа',
  'panel.inspector.bodyState.noPreviewTitle': 'Предпросмотр недоступен',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Нечего показывать',
  'panel.inspector.bodyState.noResponseDetail': 'У этого запроса нет доступных данных ответа',
  'panel.inspector.bodyState.failedTitle': 'Не удалось загрузить данные ответа',
  'panel.inspector.bodyState.emptyTitle': '(пустое тело ответа)',
  'panel.inspector.bodyState.emptyDetail': 'Сервер вернул пустое тело.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Двоичная полезная нагрузка ({count} байт).',
  'panel.inspector.bodyState.notApplicable.preflight': 'Для preflight-запроса содержимого нет',
  'panel.inspector.bodyState.notApplicable.head': 'У запроса HEAD нет тела ответа',
  'panel.inspector.bodyState.notApplicable.connect': 'У запроса CONNECT нет тела ответа',
  'panel.inspector.bodyState.notApplicable.status204': 'Нет содержимого (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'Нет содержимого (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'Не изменено — тело отдано из кеша браузера',
  'panel.inspector.bodyState.notApplicable.informational': 'Нет содержимого (информационный ответ)',
  'panel.inspector.bodyState.notApplicable.websocket': 'Соединение WebSocket установлено — см. вкладку Messages',
  'panel.inspector.bodyState.unavailable.opaque': 'Тело ответа недоступно — непрозрачный ответ другого источника',
  'panel.inspector.bodyState.unavailable.cache': 'Тело недоступно — ответ был отдан из кеша до открытия DevTools',
  'panel.inspector.bodyState.unavailable.redirect': 'Содержимого нет, потому что этот запрос был перенаправлен',
  'panel.inspector.bodyState.unavailable.unknown':
    'Тело не захвачено. Хост не вернул содержимое — ответ передавался потоком без буферизации или был отдан из кеша.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Предпросмотр для этого типа содержимого недоступен.',
  'panel.inspector.preview.imageAlt': 'предпросмотр ответа',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': 'Форматировать',
  'panel.inspector.viewer.revertTitle': 'Вернуться к объявленному Content-Type',
  'panel.inspector.viewer.parsedAsRevert': 'Разобрано как {format} · вернуть',
  'panel.inspector.viewer.looksLikeParse': 'Похоже на {format} · разобрать',
  'panel.inspector.viewer.looksLikeTitle':
    'Content-Type выглядит неверным — тело разбирается как {format}. Нажмите, чтобы переинтерпретировать.',
  'panel.inspector.viewer.cursorInfo': 'Строка {line}, столбец {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} строка',
      few: '{count} строки',
      many: '{count} строк',
      other: '{count} строк',
    }),
  'panel.inspector.viewer.hexViewer': 'Hex-просмотрщик',
  'panel.inspector.viewer.find': 'Найти',
  'panel.inspector.viewer.findTitle': 'Найти ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Параметры строки запроса',
  'panel.inspector.payload.requestBody': 'Тело запроса ({mime})',
  'panel.inspector.payload.viewSource': 'Показать исходник',
  'panel.inspector.payload.viewParsed': 'Показать разобранное',
  'panel.inspector.payload.viewUrlEncoded': 'Показать в URL-кодировке',

  // ── Raw Data tab (inspector detail) ──────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'Экспортировать фрагмент',
  'panel.inspector.rawData.formatLabel': 'Формат',
  'panel.inspector.rawData.copy': 'Копировать',
  'panel.inspector.rawData.copied': 'Скопировано',
  'panel.inspector.rawData.rawHar': 'Исходный HAR (JSON)',
  'panel.inspector.rawData.downloadHar': 'Скачать .har',
  'panel.inspector.rawData.noRequestData': '(данных запроса пока нет)',
  'panel.inspector.rawData.view.label': 'Вид',
  'panel.inspector.rawData.view.includeHeaders': 'Включать заголовки запроса',
  'panel.inspector.rawData.view.includeBody': 'Включать тело запроса',
  'panel.inspector.rawData.view.redactSecrets': 'Скрывать секреты',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'Заголовки, изменённые правилами',
  'panel.inspector.rawData.view.postRule': 'После правил (в сети)',
  'panel.inspector.rawData.view.original': 'Исходные (до правил)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (браузер)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — сырое сообщение',
  'panel.inspector.rawData.format.har': 'HAR — одна запись',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Формат',
  'panel.inspector.rawData.harInfo.summary': 'Переносимый HTTP Archive — JSON-снимок одного запроса.',
  'panel.inspector.rawData.harInfo.description':
    'Сохраните его, чтобы приложить к отчёту об ошибке, поделиться с коллегой или импортировать в другой инструмент, читающий HAR-файлы.',

  // ── Initiator tab (inspector detail) ─────────────────────────────────
  'panel.inspector.initiator.noData': 'Данных об инициаторе нет.',
  'panel.inspector.initiator.typeLabel': 'Тип:',
  'panel.inspector.initiator.stack.heading': 'Стек вызовов запроса',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} фрейм',
      few: '{count} фрейма',
      many: '{count} фреймов',
      other: '{count} фреймов',
    }),
  'panel.inspector.initiator.stack.resolvedCount': 'разрешено: {count}',
  'panel.inspector.initiator.stack.resolvedTitle': 'Имена функций разрешены по source map',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Показать {count} скрытый',
      few: 'Показать {count} скрытых',
      many: 'Показать {count} скрытых',
      other: 'Показать {count} скрытых',
    }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Скрыть {count} шумный',
      few: 'Скрыть {count} шумных',
      many: 'Скрыть {count} шумных',
      other: 'Скрыть {count} шумных',
    }),
  'panel.inspector.initiator.stack.noiseTitle': 'Скрыть анонимные фреймы внутри минифицированных бандлов',
  'panel.inspector.initiator.stack.copyTitle': 'Копировать стек как текст',
  'panel.inspector.initiator.stack.copy': 'Копировать',
  'panel.inspector.initiator.stack.copied': 'Скопировано',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Фильтр фреймов (имя функции или URL)…',
  'panel.inspector.initiator.stack.filterAria': 'Фильтр фреймов стека вызовов',
  'panel.inspector.initiator.stack.noMatch': 'Нет подходящих фреймов.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} фрейма',
      few: '{count} фреймов',
      many: '{count} фреймов',
      other: '{count} фреймов',
    });
    return `Показано ${String(shown)} из ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '(скрыто: {count})',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Имя из source map: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (оригинал: {source})',
  'panel.inspector.initiator.moreFilters.label': 'Ещё фильтры',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Только сбои',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'Только сторонние',
  'panel.inspector.initiator.view.label': 'Вид',
  'panel.inspector.initiator.view.sort': 'Сортировка',
  'panel.inspector.initiator.view.sortInitiator': 'Порядок инициаторов',
  'panel.inspector.initiator.view.sortChronological': 'Хронологический',
  'panel.inspector.initiator.view.sortLargest': 'Самое большое поддерево',
  'panel.inspector.initiator.view.showSuggestions': 'Показывать рекомендации',
  'panel.inspector.initiator.filterPlaceholder':
    'Фильтр — текст, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': 'Фильтр цепочки инициаторов',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} совпадение',
      few: '{count} совпадения',
      many: '{count} совпадений',
      other: '{count} совпадений',
    }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': 'Цепочка инициаторов запроса',
  'panel.inspector.initiator.chainTree': 'Цепочка инициаторов запроса',
  'panel.inspector.initiator.collapse': 'Свернуть',
  'panel.inspector.initiator.expand': 'Развернуть',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'запрос', few: 'запроса', many: 'запросов', other: 'запросов' }),
  'panel.inspector.initiator.cascade.transferred': 'передано',
  'panel.inspector.initiator.cascade.cumulative': 'суммарно',
  'panel.inspector.initiator.cascade.failed': 'со сбоем',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'Тип инициатора',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP-статус',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Запрос завершился сбоем',
  'panel.inspector.initiator.chip.failed': 'сбой',
  'panel.inspector.initiator.chip.transferredTitle': 'Передано',
  'panel.inspector.initiator.chip.durationTitle': 'Длительность',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Сторонний источник',
  'panel.inspector.initiator.chip.thirdParty': 'сторонний',
  'panel.inspector.initiator.chip.subtreeTitle': 'Вес поддерева (потомки · байты)',
  'panel.inspector.initiator.chip.subtree': '+{count} запр. · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} неудачный запрос в этом каскаде.',
      few: '{count} неудачных запроса в этом каскаде.',
      many: '{count} неудачных запросов в этом каскаде.',
      other: '{count} неудачных запросов в этом каскаде.',
    }),
  'panel.inspector.initiator.insights.failedHint': 'Проверьте блокировщики рекламы, правила CSP и настройку CORS.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'загрузил {count} запрос',
      few: 'загрузил {count} запроса',
      many: 'загрузил {count} запросов',
      other: 'загрузил {count} запросов',
    });
    return `Хост ${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)}% веса каскада.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'Самый крупный хост в этом каскаде. По возможности разместите у себя или отложите загрузку.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent}% байт каскада — сторонние.',
  'panel.inspector.initiator.insights.thirdPartyHint':
    'Сократите, отложите или разместите у себя несущественные сторонние ресурсы.',

  // ── Timing tab (inspector detail) — the tab's OWN copy ───────────────
  'panel.inspector.timing.noData': 'Данных о таймингах нет.',
  'panel.inspector.timing.view.label': 'Вид',
  'panel.inspector.timing.view.showSuggestions': 'Показывать рекомендации',
  'panel.inspector.timing.view.showContextStrip': 'Показывать полосу контекста',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Показывать разбивку по этапам',
  'panel.inspector.timing.view.showTimingBar': 'Показывать полосу таймингов',
  'panel.inspector.timing.view.showServerTiming': 'Показывать Server-Timing',
  'panel.inspector.timing.view.showRepeats': 'Показывать повторы в сеансе',
  'panel.inspector.timing.view.showTransferRate': 'Показывать скорость передачи',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': 'этап доминирует в этом запросе — {ms} ({percent}% от общего).',
  'panel.inspector.timing.insight.unusuallyHighTail': 'этап необычно долгий — {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'Планировщик запросов удерживал этот запрос',
  'panel.inspector.timing.phase.queueing.hint':
    'Слишком много одновременных запросов борются за слоты, либо низкий приоритет.',
  'panel.inspector.timing.phase.stalled.what': 'Ожидание свободного соединения',
  'panel.inspector.timing.phase.stalled.hint':
    'Лимит пула соединений, согласование с прокси или блокировка головы очереди в HTTP/1.1.',
  'panel.inspector.timing.phase.dns.what': 'Поиск DNS',
  'panel.inspector.timing.phase.dns.hint': 'Влияет только на первый запрос к этому домену. Рассмотрите DNS prefetch.',
  'panel.inspector.timing.phase.connect.what': 'Рукопожатие TCP с сервером',
  'panel.inspector.timing.phase.connect.hint':
    'Новое соединение — keep-alive или мультиплексирование HTTP/2/3 переиспользует одно на много запросов.',
  'panel.inspector.timing.phase.ssl.what': 'Рукопожатие TLS',
  'panel.inspector.timing.phase.ssl.hint': 'Сокращается возобновлением сеанса / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Отправка тела запроса',
  'panel.inspector.timing.phase.send.hint':
    'Большое тело запроса или медленный исходящий канал — обычно заметно только на POST/PUT.',
  'panel.inspector.timing.phase.wait.what': 'Время сервера до первого байта',
  'panel.inspector.timing.phase.wait.hint':
    'Обработка на бэкенде. Ищите тайминги бэкенда в Server-Timing или журналах запросов к БД.',
  'panel.inspector.timing.phase.receive.what': 'Загрузка полезной нагрузки ответа',
  'panel.inspector.timing.phase.receive.hint':
    'Размер полезной нагрузки или пропускная способность CDN — проверьте эффективную скорость передачи.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Протокол',
  'panel.inspector.timing.chip.connection': 'Соединение',
  'panel.inspector.timing.chip.cache': 'Кеш',
  'panel.inspector.timing.chip.priority': 'Приоритет',
  'panel.inspector.timing.chip.started': 'Начат',
  'panel.inspector.timing.chip.serverIp': 'IP сервера',
  'panel.inspector.timing.chip.connectionReused': 'переиспользовано',
  'panel.inspector.timing.chip.connectionNew': 'новое',
  'panel.inspector.timing.chip.openedBy': 'открыл {url}',
  'panel.inspector.timing.totalTime': 'Общее время',
  'panel.inspector.timing.totalWhere': '(в очереди → завершён)',
  'panel.inspector.timing.caution': 'ВНИМАНИЕ: запрос ещё не завершён!',
  'panel.inspector.timing.queuedAt': 'В очереди в {offset}',
  'panel.inspector.timing.startedAt': 'Начат в {offset}',
  'panel.inspector.timing.inProgress': 'выполняется…',
  'panel.inspector.timing.noDuration': 'нет длительности',
  'panel.inspector.timing.transferRate.heading': 'Скорость передачи',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Загружено содержимого:',
  'panel.inspector.timing.transferRate.effectiveRate': 'Эффективная скорость:',
  'panel.inspector.timing.transferRate.amount': '{size} за {duration}',
  'panel.inspector.timing.repeats.heading': 'Повторы в этом сеансе',
  'panel.inspector.timing.repeats.hitCount': 'Обращений к URL:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'Самый быстрый / медиана / самый медленный:',
  'panel.inspector.timing.repeats.thisRequest': 'Этот запрос:',
  'panel.inspector.timing.repeats.slowestTag': '(самый медленный)',
  'panel.inspector.timing.repeats.fastestTag': '(самый быстрый)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Разбивка по кешу:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
