/**
 * DevTools panel — traffic table plane — Russian. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, `n/a`, and every µs/ms/s figure. Mints: водопад =
 * waterfall (prose — the Waterfall column name stays raw); очередь =
 * queue; В очереди = Queued; неучтённые промежутки = untracked gaps;
 * прогретый сокет = warm socket; ключевые моменты = key moments; band
 * names Планирование / Подключение / Передача; синтезированная строка
 * = synthesized row; пробел точности захвата = capture-fidelity gap;
 * уровень = sort level; последний критерий = tiebreak; с очисткой =
 * sanitized (carried from panel.ts); аннотация = row annotation
 * (rail); опровергнут = contradicted (carried); не достигнуто = the
 * rung state with не достигнуто в этот момент = the instant-tick
 * referent (separate referents); удержание в режиме отладки =
 * debug-mode hold; **Системный прокси = System Proxy** (the desktop
 * file quotes it later); фраза причины = reason phrase
 * (shared-info-status quotes it). Rung names, Initial connection,
 * Highest → Lowest, the resource-type chain and `n/a` ride raw with
 * этап / полоса as head nouns (этап Waiting for server, полоса Initial
 * connection).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus ──────────────────────
  'panel.network.filterSyntaxHelp': 'Справка по синтаксису фильтра',
  'panel.network.aboutTypeFilters': 'О фильтрах по типу запроса',
  'panel.network.aboutSorting': 'О сортировке',

  // ── Remote capture — consent refusal ─────────────────────────────────
  'panel.capture.watchRefused.title': 'Просмотр Live в этом браузере выключен',
  'panel.capture.watchRefused.body':
    'Расширение Open Headers в этом браузере не разрешает настольному приложению видеть его трафик, хранилище и консоль. Включите «Разрешить настольному приложению видеть этот браузер» в настройках расширения, чтобы наблюдать за ним здесь.',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': 'Запрос выполнен сервис-воркером источника',
  'panel.network.cell.jumpToPreflight': 'Перейти к preflight-запросу',
  'panel.network.cell.selectPreflightInitiator': 'Выбрать запрос, который инициировал этот preflight',
  'panel.network.cell.pendingTitle': 'Запрос ещё не завершён',
  'panel.network.cell.pending': 'Ожидание',
  'panel.network.gridAria': 'Сетевые запросы',
  'panel.network.noMatches': 'Нет подходящих запросов.',
  'panel.network.reloadPage': 'Перезагрузить страницу',
  'panel.network.startRecording': 'Начать запись',

  // View ▾ menu
  'panel.network.view.label': 'Вид',
  'panel.network.view.layout': 'Компоновка',
  'panel.network.view.layoutCompact': 'Компактная',
  'panel.network.view.layoutWide': 'Широкая',
  'panel.network.view.valueNumber': 'Число в значении',
  'panel.network.view.showValue': 'Показывать значение',
  'panel.network.view.valuesAlways': 'Всегда',
  'panel.network.view.valuesHover': 'При наведении',
  'panel.network.view.valuesOff': 'Выключено',
  'panel.network.view.valueFormat': 'Формат значения',
  'panel.network.view.formatRelative': 'Относительный',
  'panel.network.view.formatTimestamp': 'Отметка времени',
  'panel.network.view.timezone': 'Часовой пояс',
  'panel.network.view.tzLocal': 'Местный',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Пояснять значение',
  'panel.network.view.explainValueTitle':
    'В поповере при наведении подсвечивать строки, из которых складывается итог, и показывать их сумму.',
  'panel.network.view.popover': 'Поповер',
  'panel.network.view.popoverTitle':
    'Ориентация разбивки таймингов при наведении. «Авто» выбирает по ширине панели — горизонтально в широкой, вертикально в узкой.',
  'panel.network.view.popoverAuto': 'Авто',
  'panel.network.view.popoverCompact': 'Компактный',
  'panel.network.view.popoverWide': 'Широкий',
  'panel.network.view.showFireDots': 'Показывать точки срабатывания правил',

  // Sort ▾ menu
  'panel.network.sort.label': 'Сортировка',
  'panel.network.sort.heading': 'Порядок сортировки',
  'panel.network.sort.byTime': 'Сортировать по времени.',
  'panel.network.sort.groupPriority': 'Приоритет',
  'panel.network.sort.groupPriorityHint': 'Что требует вашего внимания в первую очередь.',
  'panel.network.sort.groupGrouping': 'Группировка',
  'panel.network.sort.groupGroupingHint': 'Собирать запросы по категориям.',
  'panel.network.sort.ascending': 'По возрастанию',
  'panel.network.sort.descending': 'По убыванию',
  'panel.network.sort.customNested': 'Своя (вложенная)',
  'panel.network.sort.customNestedIdle': 'Сортировка по нескольким ключам — столбец за столбцом.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} уровень — откройте, чтобы изменить.',
      few: '{count} уровня — откройте, чтобы изменить.',
      many: '{count} уровней — откройте, чтобы изменить.',
      other: '{count} уровней — откройте, чтобы изменить.',
    }),
  'panel.network.sort.noLevelsYet': 'Уровней пока нет — откройте конструктор.',
  'panel.network.sort.builderTitle': 'Сортировать по, по порядку',
  'panel.network.sort.builderEmpty': 'Уровней пока нет. Добавьте ниже.',
  'panel.network.sort.asc': 'Возр.',
  'panel.network.sort.desc': 'Убыв.',
  'panel.network.sort.removeLevel': 'Убрать уровень {n}',
  'panel.network.sort.addLevel': '+ Добавить уровень',
  'panel.network.sort.finalTiebreak': 'Последний критерий: время начала',
  'panel.network.sort.active': 'Активна',
  'panel.network.sort.apply': 'Применить',
  'panel.network.sort.columnClick': 'Своя (клик по столбцу)',
  'panel.network.sort.columnClickIdle': 'Нажмите заголовок столбца, чтобы сортировать по нему.',
  'panel.network.sort.columnClickUse': 'нажмите заголовок столбца, чтобы использовать',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Сначала сбои',
  'panel.network.sortMode.failuresSubtitle':
    'Неудачные → ожидающие → перенаправленные → успешные · внутри каждой группы по времени начала.',
  'panel.network.sortMode.slowest': 'Сначала самые медленные',
  'panel.network.sortMode.slowestSubtitle':
    'Сначала самые долгие · при равенстве время начала сохраняет порядок водопада.',
  'panel.network.sortMode.largest': 'Сначала самые большие',
  'panel.network.sortMode.largestSubtitle': 'Сначала больше всего байт по сети · при равенстве по времени начала.',
  'panel.network.sortMode.browserPriority': 'Приоритет браузера',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest по приоритету, сообщённому браузером · внутри каждой группы по времени начала.',
  'panel.network.sortMode.byType': 'По типу ресурса',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · внутри каждой группы по времени начала.',
  'panel.network.sortMode.byDomain': 'По домену',
  'panel.network.sortMode.byDomainSubtitle':
    'Группировка по имени хоста (A → Z) · внутри каждого домена по времени начала.',
  'panel.network.sortMode.ruleModified': 'Сначала изменённые правилами',
  'panel.network.sortMode.ruleModifiedSubtitle':
    'Применённые правила → выведенные → без срабатывания · внутри каждой группы по времени начала.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'Когда запрос начался.',
  'panel.network.sortMetric.responseTime': 'Когда пришёл первый байт ответа.',
  'panel.network.sortMetric.endTime': 'Когда запрос завершился.',
  'panel.network.sortMetric.duration': 'Сколько он занял — полосы выровнены по нулю.',
  'panel.network.sortMetric.latency': 'Время до первого байта — полосы выровнены по нулю.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Срабатывания правил',
  'panel.network.railAnnotations': 'Аннотации',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'Открыть в новой вкладке',
  'panel.requestMenu.createApiRequest': 'Создать API-запрос',
  'panel.requestMenu.copy': 'Копировать',
  'panel.requestMenu.copyUrl': 'Копировать URL',
  'panel.requestMenu.copyAsCurl': 'Копировать как cURL',
  'panel.requestMenu.copyAsFetch': 'Копировать как fetch',
  'panel.requestMenu.copyRequestHeaders': 'Копировать заголовки запроса',
  'panel.requestMenu.copyResponseHeaders': 'Копировать заголовки ответа',
  'panel.requestMenu.copyResponse': 'Копировать ответ',
  'panel.requestMenu.copyAsHar': 'Копировать как HAR',
  'panel.requestMenu.copyAsHarSanitized': 'Копировать как HAR (с очисткой)',
  'panel.requestMenu.copyAllUrls': 'Копировать все URL',
  'panel.requestMenu.copyAllAsCurl': 'Копировать всё как cURL',
  'panel.requestMenu.copyAllAsHar': 'Копировать всё как HAR',
  'panel.requestMenu.copyAllAsHarSanitized': 'Копировать всё как HAR (с очисткой)',
  'panel.requestMenu.blockRequests': 'Блокировать запросы',
  'panel.requestMenu.blockUrl': 'Блокировать URL запроса',
  'panel.requestMenu.blockDomain': 'Блокировать домен запроса',
  'panel.requestMenu.saveAs': 'Сохранить как...',
  'panel.requestMenu.saveThisAsHar': 'Сохранить этот как HAR',
  'panel.requestMenu.saveThisAsHarSanitized': 'Сохранить этот как HAR (с очисткой)',
  'panel.requestMenu.saveAllAsHar': 'Сохранить всё как HAR',
  'panel.requestMenu.saveAllAsHarSanitized': 'Сохранить всё как HAR (с очисткой)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Типы запросов',
  'panel.network.typeInfo.summary':
    'Сужает список до одного или нескольких типов запросов. «All» показывает всё; выберите типы для фильтра или сочетайте несколько.',
  'panel.network.typeInfo.inlineHeading': 'В строке',
  'panel.network.typeInfo.fetchXhrDesc': 'API-вызовы — fetch() и XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'Соединения WebSocket.',
  'panel.network.typeInfo.underMoreHeading': 'В меню More',
  'panel.network.typeInfo.docCssJsDesc': 'Документы, таблицы стилей и скрипты.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Шрифты, изображения и аудио / видео.',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Манифесты веб-приложений, WebAssembly и всё остальное.',
  'panel.network.sortInfo.summary':
    'Выбирает порядок списка запросов. Наведите курсор на группу, чтобы выбрать конкретный режим.',
  'panel.network.sortInfo.modesHeading': 'Режимы',
  'panel.network.sortInfo.waterfallDesc': 'По времени — начало, ответ, конец, длительность или задержка.',
  'panel.network.sortInfo.priorityDesc': 'Что требует внимания первым — сбои, самые медленные, самые большие.',
  'panel.network.sortInfo.groupingDesc': 'Группировка по типу, домену или изменению правилом.',
  'panel.network.sortInfo.custom': 'Своя',
  'panel.network.sortInfo.customDesc':
    'Нажмите заголовок столбца или соберите вложенную сортировку по нескольким ключам.',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': 'Пример запроса',
  'panel.network.colInfo.name.summary':
    'Имя файла ресурса или последний сегмент пути — самый быстрый способ узнать строку.',
  'panel.network.colInfo.name.description':
    'Значок в начале кодирует тип ресурса; подсказка строки и вид деталей несут полный URL-адрес, заголовки, полезную нагрузку и тайминги.',
  'panel.network.colInfo.path.summary': 'Всё после хоста — путь URL-адреса плюс его строка запроса.',
  'panel.network.colInfo.url.summary': 'Полный URL-адрес запроса: схема, хост, путь и запрос, от начала до конца.',
  'panel.network.colInfo.requestNumber.summary':
    'Стабильный индекс, присвоенный в порядке обнаружения запросов во время записи, начиная с 1.',
  'panel.network.colInfo.requestNumber.description':
    'Он не меняется при пересортировке, поэтому служит и ссылкой на исходный порядок захвата.',
  'panel.network.colInfo.method.summary': 'HTTP-метод, который использовал запрос.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Частые методы',
  'panel.network.colInfo.method.getDesc': 'Прочитать ресурс — без тела, безопасно повторять.',
  'panel.network.colInfo.method.postDesc': 'Создать или отправить — несёт тело запроса.',
  'panel.network.colInfo.method.putPatchDesc': 'Заменить или частично обновить ресурс.',
  'panel.network.colInfo.method.deleteDesc': 'Удалить ресурс.',
  'panel.network.colInfo.status.summary':
    'Код HTTP-ответа (например 200, 404) или короткая метка состояния, когда кода нет.',
  'panel.network.colInfo.status.description':
    'Диапазоны статусов цветом не кодируются. Настоящий сбой — сетевая ошибка, любой 4xx/5xx или отказ CORS — красит всю строку в красный; попадание в кеш или строка без статуса приглушает ячейку серым. Фраза причины (например «Not Found») находится в подсказке ячейки.',
  'panel.network.colInfo.status.codeRangesHeading': 'Диапазоны кодов',
  'panel.network.colInfo.status.s2xxDesc': 'Успех — запрос получен и обработан (например 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': 'Перенаправление — следуйте заголовку Location к следующему URL-адресу.',
  'panel.network.colInfo.status.s4xxDesc':
    'Ошибка клиента — запрос неверно сформирован, не авторизован или ресурс не найден.',
  'panel.network.colInfo.status.s5xxDesc': 'Ошибка сервера — сервер не смог выполнить корректный запрос.',
  'panel.network.colInfo.status.insteadHeading': 'Вместо кода',
  'panel.network.colInfo.status.pendingDesc': 'Отправлен, но ответ ещё не пришёл — серый, пока в полёте.',
  'panel.network.colInfo.status.failedDesc':
    'Сбой на уровне сети (DNS, TLS, тайм-аут, потеря соединения); код сетевого стека показан в строке.',
  'panel.network.colInfo.status.canceledDesc': 'Запрос прерван до завершения.',
  'panel.network.colInfo.status.blockedDesc':
    'Браузер отказал по причине политики — например csp, или other для расширения / блокировщика рекламы.',
  'panel.network.colInfo.status.corsDesc': 'Межсайтовая проверка отклонила ответ.',
  'panel.network.colInfo.status.dataDesc': 'URL-адрес data: — отдан встроенно, сеть не задействована.',
  'panel.network.colInfo.status.finishedDesc': 'Ответ, не нёсший кода статуса.',
  'panel.network.colInfo.protocol.summary': 'Версия HTTP, согласованная соединением при рукопожатии.',
  'panel.network.colInfo.protocol.valuesHeading': 'Значения',
  'panel.network.colInfo.protocol.http11Desc': 'Текстовый, один запрос в полёте на соединение.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — двоичный и мультиплексированный по одному соединению.',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3 — работает на QUIC поверх UDP ради более быстрых рукопожатий.',
  'panel.network.colInfo.scheme.summary': 'Схема URL-адреса — `https`, `http`, `ws` или `wss`.',
  'panel.network.colInfo.domain.summary': 'Имя хоста, к которому обращён запрос.',
  'panel.network.colInfo.remoteAddress.summary': 'IP-адрес и порт, которых соединение фактически достигло.',
  'panel.network.colInfo.remoteAddress.description':
    'Отличается от домена, когда DNS возвращает несколько IP-адресов, CDN маршрутизирует по anycast или локальный прокси перехватывает соединение.',
  'panel.network.colInfo.type.summary':
    'Тип ресурса, назначенный браузером — он задаёт значок строки и чипы фильтра над таблицей.',
  'panel.network.colInfo.type.examplesHeading': 'Примеры',
  'panel.network.colInfo.type.documentDesc': 'HTML-навигация верхнего уровня или во фрейме.',
  'panel.network.colInfo.type.fetchXhrDesc': 'Запрос данных из JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Ресурсы страницы, загруженные парсером.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Статические ресурсы.',
  'panel.network.colInfo.initiator.summary': 'Что вызвало отправку запроса.',
  'panel.network.colInfo.initiator.kindsHeading': 'Виды',
  'panel.network.colInfo.initiator.scriptDesc': 'Из JavaScript — ячейка ссылается на место вызова.',
  'panel.network.colInfo.initiator.parserDesc': 'Ресурс нашёл HTML-парсер (`<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'Ответ `3xx` направил браузер сюда.',
  'panel.network.colInfo.initiator.otherDesc': 'Навигация, предзагрузка или источник без атрибуции.',
  'panel.network.colInfo.cookies.summary':
    'Сколько cookie браузер приложил к запросу в его заголовке `Cookie`. Пусто, если ни одного.',
  'panel.network.colInfo.setCookies.summary': 'Сколько заголовков `Set-Cookie` вернул ответ. Пусто, если ни одного.',
  'panel.network.colInfo.setCookies.description':
    'Откройте вкладку Cookies запроса, чтобы увидеть, принял браузер каждый из них или отбросил.',
  'panel.network.colInfo.size.summary':
    'Байты, прошедшие по сети, включая заголовки ответа и накладные расходы сжатия.',
  'panel.network.colInfo.size.insteadHeading': 'Вместо числа',
  'panel.network.colInfo.size.diskCacheDesc': 'Отдано из дискового кеша — сеть не задействована.',
  'panel.network.colInfo.size.memoryCacheDesc': 'Отдано из кеша в памяти текущей страницы.',
  'panel.network.colInfo.size.pendingDesc': 'Запрос ещё не завершён.',
  'panel.network.colInfo.time.summary':
    'Активная длительность от отправки запроса до последнего байта ответа — время в очереди не учитывается.',
  'panel.network.colInfo.time.description':
    'Показывает `0 ms` для мгновенного ответа; остаётся пустым, пока запрос в полёте.',
  'panel.network.colInfo.priority.summary': 'Приоритет загрузки, назначенный браузером, от `Highest` до `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Ресурсы с более высоким приоритетом запрашиваются раньше и получают больше соединения. Страница может повлиять на него атрибутом `fetchpriority`.',
  'panel.network.colInfo.waterfall.summary':
    'Полоса хронологии для каждого запроса. Меню заголовка выбирает метрику, показанную коротким тегом вроде `Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Теги метрик',
  'panel.network.colInfo.waterfall.stDesc': 'Start time — полосы лежат на общей хронологии по началу каждого запроса.',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time — размещены по приходу первого байта ответа.',
  'panel.network.colInfo.waterfall.etDesc': 'End time — размещены по завершению каждого запроса.',
  'panel.network.colInfo.waterfall.tdDesc': 'Total duration — полосы от нуля, длиной в полную длительность запроса.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency — полосы от нуля, разделённые там, где начался ответ.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'Точка отмечает каждый запрос, на который подействовало одно из ваших правил.',
  'panel.network.fireRail.dotColorsHeading': 'Цвета точек',
  'panel.network.fireRail.appliedDesc':
    'Применено — движок правил подтвердил выполнение правила, наш внедрённый в страницу репортёр подтвердил действие, либо изменение видно в захваченных заголовках.',
  'panel.network.fireRail.inferredDesc': 'Выведено — правило совпало, применение для этого запроса проверить нельзя.',
  'panel.network.fireRail.contradictedDesc':
    'Опровергнуто — правило заявило об изменении заголовка, которое захваченные заголовки опровергают.',
  'panel.network.annotationRail.summary':
    'Отмечает то, что OpenHeaders знает сверх показанного в столбцах. Наведите курсор на глиф для пояснения; нажмите, чтобы открыть детали.',
  'panel.network.annotationRail.glyphsHeading': 'Глифы',
  'panel.network.annotationRail.warnDesc': 'Строка не то, чем кажется — например передача прервана посреди загрузки.',
  'panel.network.annotationRail.infoDesc':
    'Контекст происхождения или точности — не завершён, пробел захвата, синтезированная строка.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  'panel.network.timing.band.beforeWire': 'Планирование',
  'panel.network.timing.band.connecting': 'Подключение',
  'panel.network.timing.band.exchange': 'Передача',
  'panel.network.timing.where.beforeWire': '(Браузер)',
  'panel.network.timing.where.connecting': '(Браузер ↔ Сеть)',
  'panel.network.timing.where.exchange': '(Сеть)',
  'panel.network.timing.absent.reused': 'соединение переиспользовано',
  'panel.network.timing.absent.notReached': 'не достигнуто',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'нет данных',
  'panel.network.timing.warmSocketTitle':
    'На часах этого запроса нет рукопожатия TCP — сокет уже был установлен (вероятно, предварительное подключение). Здесь выполнялся только TLS.',
  'panel.network.timing.warmSocketHint': 'прогретый сокет',
  'panel.network.timing.moment.queued': 'В очереди',
  'panel.network.timing.moment.started': 'Начат',
  'panel.network.timing.moment.response': 'Ответ',
  'panel.network.timing.moment.ended': 'Завершён',
  'panel.network.timing.momentWhy.queued': 'запрос создан',
  'panel.network.timing.momentWhy.started': 'покинул очередь',
  'panel.network.timing.momentWhy.response': 'первый байт (TTFB)',
  'panel.network.timing.momentWhy.ended': 'последний байт, готово',
  'panel.network.timing.untrackedGaps': 'Неучтённые промежутки: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Эквивалент Chrome: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL рисуется внутри)',
  'panel.network.timing.terminalDetail.noResponse': 'ответ не получен',
  'panel.network.timing.terminalDetail.neverReached': 'до сети не дошёл',
  'panel.network.timing.keyMoments': 'Ключевые моменты',
  'panel.network.timing.sinceFirstRequest': '(от первого запроса)',
  'panel.network.timing.timingNotes': 'Примечания к таймингам',
  'panel.network.timing.totalTime': 'Общее время',
  'panel.network.timing.queuedToEnded': '(в очереди → завершён)',
  'panel.network.timing.connectionOpenedBy': '↳ соединение открыл {name}',
  'panel.network.timing.notFinishedCaution': 'ВНИМАНИЕ: запрос ещё не завершён!',
  'panel.network.timing.queuedAt': 'В очереди в {time}',
  'panel.network.timing.startedAt': 'Начат в {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'не достигнуто в этот момент',
  'panel.network.timing.onTheWire': '🌐 в сети',
  'panel.network.timing.cdpExplainer':
    'Включите CDP и перезагрузите страницу до перехода, чтобы видеть полную разбивку соединения по ходу выполнения.',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Браузер',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Браузер ↔ Сеть',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Сеть',
  'panel.network.rungInfo.kickerInstant': 'Timing · Момент',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Исход',
  'panel.network.rungInfo.stripCaption': 'Пример запроса — {ms} ms от начала до конца',
  'panel.network.rungInfo.stripStop': 'отмечено: где запрос остановился — поздние этапы не выполнялись',
  'panel.network.rungInfo.stripMarked': 'отмечено: {label} на {ms} ms',
  'panel.network.rungInfo.stripGaps': 'подсвечено: неучтённые промежутки (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'подсвечено: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary':
    'Время, которое запрос провёл в ожидании в браузере, прежде чем ему разрешили начаться.',
  'panel.network.rungInfo.queueing.description':
    'Браузер откладывает запросы ресурсов с низким приоритетом, пока грузятся более приоритетные и пока он проверяет дисковый кеш. На HTTP/1.x он ждёт здесь и тогда, когда все сокеты к хосту заняты.',
  'panel.network.rungInfo.stalled.summary':
    'Разрешено начаться, но ждёт пригодного соединения, прежде чем начнётся какая-либо сетевая работа.',
  'panel.network.rungInfo.stalled.description':
    'Обычно ожидание освобождения сокета или решения прокси. Заканчивается в момент начала первого сетевого шага (DNS, TCP или отправка).',
  'panel.network.rungInfo.dns.summary': 'Разрешение имени хоста в IP-адрес для подключения.',
  'panel.network.rungInfo.dns.description':
    'Показывает «соединение переиспользовано», когда запрос шёл по уже открытому соединению — на часах этого запроса поиск не требовался.',
  'panel.network.rungInfo.connect.summary': 'Только рукопожатие TCP — круговой обход, открывающий сокет к серверу.',
  'panel.network.rungInfo.connect.description':
    'Вкладка Timing в Chrome рисует одну полосу «Initial connection», охватывающую этот этап И рукопожатие TLS (её полоса SSL рисуется внутри). Мы разделяем их на отдельные непересекающиеся этапы, чтобы каждая миллисекунда считалась ровно один раз — TCP + TLS здесь равны полосе Initial connection в Chrome.',
  'panel.network.rungInfo.ssl.summary':
    'Рукопожатие TLS — согласование ключей и проверка сертификатов, чтобы соединение было зашифровано.',
  'panel.network.rungInfo.ssl.description':
    'Только для запросов https:// (n/a для обычного http://). «Соединение переиспользовано» означает, что более ранний запрос уже оплатил это на том же сокете.',
  'panel.network.rungInfo.send.summary': 'Отправка байтов запроса — заголовков и тела, если есть, — в сеть.',
  'panel.network.rungInfo.send.description':
    'Обычно намного меньше миллисекунды для запросов из одних заголовков; растёт с большими загрузками на сервер.',
  'panel.network.rungInfo.wait.summary':
    'От последнего отправленного байта запроса до первого полученного байта ответа (время до первого байта).',
  'panel.network.rungInfo.wait.description':
    'Время раздумий сервера плюс один сетевой круговой обход — этап, в котором проявляется работа бэкенда.',
  'panel.network.rungInfo.receive.summary': 'Загрузка тела ответа, от первого байта до последнего.',
  'panel.network.rungInfo.receive.description':
    'Растёт вживую, пока ответ ещё передаётся потоком; строка внимания под диаграммой отмечает незавершившуюся загрузку.',
  'panel.network.rungInfo.notes.summary':
    'Учёт крошечных отрезков времени между этапами — записанных от начала до конца, но не принадлежащих ни одному этапу.',
  'panel.network.rungInfo.notes.description':
    'Каждый этап измеряется между своими собственными моментами начала и конца, а итог — от начала до конца, поэтому между двумя этапами могут лежать крошечные «неучтённые промежутки» (например между приходом ответа DNS и началом рукопожатия TCP). Из-за них этапы не всегда складываются в итог. У вкладки Timing в Chrome те же промежутки, она просто их не рисует; мы их перечисляем, чтобы каждая миллисекунда оставалась учтённой.',
  'panel.network.rungInfo.notes.linesHeading': 'Строки',
  'panel.network.rungInfo.notes.gapsLabel': 'Неучтённые промежутки',
  'panel.network.rungInfo.notes.gapsDesc': 'Каждый промежуток, названный по этапам вокруг него, с его длительностью.',
  'panel.network.rungInfo.notes.chromeLabel': 'Эквивалент Chrome',
  'panel.network.rungInfo.notes.chromeDesc':
    'Как наши раздельные этапы TCP + TLS ложатся на единую полосу «Initial connection» в Chrome (её полоса SSL рисуется внутри этой полосы, а не после).',
  'panel.network.rungInfo.band.beforeWire.summary':
    'Время, проведённое целиком внутри браузера до любой сетевой работы — ничего ещё не покинуло машину.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (ожидание разрешения начать) плюс Stalled (ожидание пригодного соединения). Запрос, тяжёлый здесь, сдерживается локально — приоритетами, лимитами соединений или решениями прокси, — а не сервером.',
  'panel.network.rungInfo.band.connecting.summary':
    'Прокладка пути к серверу: разрешить имя, открыть сокет, зашифровать его.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — круговые обходы рукопожатий. Оплачивается один раз на соединение: запрос по уже открытому сокету пропускает всю эту полосу («соединение переиспользовано»).',
  'panel.network.rungInfo.band.exchange.summary':
    'Собственно обмен по сети: отправить запрос, дождаться сервера, загрузить ответ.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. Медленность сервера проявляется в этапе Waiting; большие ответы и медленные каналы — в этапе Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    'Момент, когда браузер создал запрос — ноль, от которого отсчитывается каждый этап этой разбивки.',
  'panel.network.rungInfo.moment.queued.description':
    'Значение «в» — смещение от первого запроса в поле зрения, чтобы строки можно было сравнивать по одним общим часам.',
  'panel.network.rungInfo.moment.started.summary':
    'Момент, когда запрос покинул очередь и работа над ним действительно началась.',
  'panel.network.rungInfo.moment.started.description':
    'В очереди + Queueing. Всё до этой отметки — планирование браузера; всё после — реальное продвижение запроса.',
  'panel.network.rungInfo.moment.response.summary': 'Момент прихода первого байта ответа (время до первого байта).',
  'panel.network.rungInfo.moment.response.description':
    'Сервер ответил; отсюда загружается тело. Отсутствует, если ответ так и не пришёл (сначала заблокирован или сбой).',
  'panel.network.rungInfo.moment.ended.summary': 'Момент прихода последнего байта ответа — запрос завершён.',
  'panel.network.rungInfo.moment.ended.description':
    'Завершён − В очереди — общее время под разбивкой; Завершён − Начат — активная длительность, показанная в столбце Time.',
  'panel.network.rungInfo.keyMoments.summary':
    'Граничные моменты жизни запроса — где одна стадия передаёт дело следующей.',
  'panel.network.rungInfo.keyMoments.description':
    '«В очереди» и «Начат» есть всегда; «Ответ» и «Завершён» — только когда ответ действительно пришёл (запрос, который сначала был заблокирован или сбойнул, вместо них показывает маркер исхода). Этапы ниже — промежутки между этими моментами.',
  'panel.network.rungInfo.terminal.whereHeading': 'Где остановился',
  'panel.network.rungInfo.terminal.noResponseDesc': 'До сети дошёл, но ответ так и не вернулся.',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    'Погиб в планировании на стороне браузера — ничего не отправлено.',
  'panel.network.rungInfo.terminal.canceled.summary':
    'Запрос прерван до завершения — ✗ отмечает, где он остановился; поздние этапы не выполнялись.',
  'panel.network.rungInfo.terminal.canceled.description':
    'Типичные причины: страница ушла посреди загрузки, скрипт прервал fetch или пользователь остановил загрузку. С сетью всё было в порядке — браузер просто перестал ждать ответ.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'Браузер отказал запросу по причине политики — слово после двоеточия называет, какой именно.',
  'panel.network.rungInfo.terminal.stoppedHere': '✗ отмечает, где он остановился; поздние этапы не выполнялись.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Частые причины',
  'panel.network.rungInfo.terminal.blocked.cspDesc': 'Content-Security-Policy страницы запрещает это назначение.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'Небезопасный ресурс http:// на странице https://.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    'Отказало расширение, блокировщик рекламы или внутреннее правило браузера.',
  'panel.network.rungInfo.terminal.cors.summary':
    'Межсайтовая проверка отклонила ответ — сервер ответил, но странице не разрешено его читать.',
  'panel.network.rungInfo.terminal.cors.description':
    'Сервер должен явно разрешить чтение заголовком Access-Control-Allow-Origin (и родственными), чтобы страница другого источника могла прочитать его ответ. ✗ отмечает, где произошёл отказ.',
  'panel.network.rungInfo.terminal.failed.summary':
    'Сбой на уровне сети — сломалось само соединение, а код net:: называет точную причину.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Частые коды',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS не смог найти хост.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': 'Сервер отклонил или сбросил сокет.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': 'Нет ответа в пределах лимита времени сетевого стека.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'TLS-сертификат не прошёл проверку.',

  // ── OH row annotations ───────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'Также в этой строке',
  'panel.rowAnnotations.openDetails': 'Открыть детали',
  'panel.rowAnnotations.interrupted.label': 'Передача прервана',
  'panel.rowAnnotations.interrupted.detail':
    'Загрузка отменена до завершения. Статус отражает заголовки, пришедшие до прерывания, а полученные данные неполны — в остальном строка неотличима от завершённой.',
  'panel.rowAnnotations.neverFinished.label': 'Не завершён',
  'panel.rowAnnotations.neverFinished.detail':
    'Страница, выполнившая этот запрос, выгрузилась, пока он был в полёте, поэтому исход не был записан — вот почему Status и Time показывают «(unknown)».',
  'panel.rowAnnotations.fidelityGap.label': 'Пробел точности захвата',
  'panel.rowAnnotations.fidelityGap.detail':
    'Переданные байты и тело ответа не видны обычному пути захвата для запросов, которые не завершились — их записывает расширенная инспекция через CDP.',
  'panel.rowAnnotations.syntheticHar.label': 'Синтезированная строка',
  'panel.rowAnnotations.syntheticHar.detail':
    'Эта строка восстановлена из записи захвата, которая так и не соединилась с живым запросом, поэтому некоторые столбцы заполнить нельзя.',
  'panel.rowAnnotations.syntheticMemory.label': 'Синтезированная строка',
  'panel.rowAnnotations.syntheticMemory.detail':
    'Эта строка восстановлена из Resource Timing страницы (попадание в кеш в памяти не доходит до сетевого стека), поэтому заголовки и cookie недоступны.',
  'panel.rowAnnotations.debugPaused.label': 'Удержание в режиме отладки',
  'panel.rowAnnotations.debugPaused.detail':
    '{ms} ms времени этой строки проведены на паузе в перехвате режима отладки, а не в ожидании сервера или сети — режим отладки удерживал запрос, пока изучал его, поэтому общее время строки длиннее, чем занял сам запрос.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Перезапись параметров запроса',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'Это перенаправление — Open Headers применяет правило параметров запроса, а не сервер. Перезапись строки запроса URL-адреса выполняется как внутреннее перенаправление, поэтому показана отдельным переходом; затем запрос продолжается к перезаписанному URL-адресу с теми же методом, телом, cookie и заголовками без изменений.',
  'panel.rowAnnotations.redirectRule.label': 'Правило перенаправления',
  'panel.rowAnnotations.redirectRule.detail':
    'Это перенаправление — Open Headers применяет правило перенаправления, а не сервер. Оно выполняется как внутреннее перенаправление, поэтому исходный запрос показан отдельным переходом, прежде чем запрос продолжится к перезаписанному URL-адресу.',
  'panel.rowAnnotations.systemProxyJoined.label': 'Дополнено Системным прокси',
  'panel.rowAnnotations.systemProxyJoined.detail':
    'Этот обмен также захватил Системный прокси — локальный прокси. Точные сетевые заголовки, измеренные размеры и тайминги сокета из того захвата заполняют то, о чём у захвата браузера нет собственных записей.',
  'panel.rowAnnotations.systemProxySeen.label': 'Замечен во вкладке браузера',
  'panel.rowAnnotations.systemProxySeen.detail':
    'Этот перехваченный обмен также наблюдался во вкладке браузера {tab} — две строки представляют один и тот же запрос, увиденный с обеих сторон.',
  'panel.rowAnnotations.systemProxySeen.unknownTab': 'под наблюдением',
  'panel.rowAnnotations.systemProxySeen.jump': 'Показать в источнике вкладки',
} as const satisfies Catalog;
