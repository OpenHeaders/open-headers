/**
 * DevTools panel — inspector stream tabs — Russian. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, Base64 /
 * Hex / UTF-8 modes, `keepalive` and `socket` stay parity-raw. Mints:
 * **wire = сеть** (crossed the wire = прошёл по сети; the wire recorded
 * = сетевой захват записал — decided over канал / провод, consistent
 * with panel-network's «в сети»); фрейм / полезная нагрузка carried;
 * отброшен = dropped; внедрён = injected; синтетический = synthetic;
 * доставлен = delivered (carried); выведено = inferred vs производное
 * = derived (two referents); уровень захвата = capture plane; обёртка
 * = wrapper; конечная точка = endpoint; просмотрщик полезной нагрузки
 * = payload viewer; точка срабатывания = fire dot (янтарная точка
 * срабатывания); на основе этого фрейма / события = seeded from;
 * Server-Sent Events rides raw (MDN vocabulary); эта сторона = "this
 * side" of the split; Исходный = Raw carried. Quoted OH labels copy
 * this file's mints in «…».
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ───────────────────
  'panel.inspector.streams.clearAll': 'Очистить всё',
  'panel.inspector.streams.directionFilterTitle': 'Фильтр по направлению',
  'panel.inspector.streams.directionAll': 'Все',
  'panel.inspector.streams.directionSend': 'Отправка',
  'panel.inspector.streams.directionReceive': 'Приём',
  'panel.inspector.streams.filterAria': 'Фильтр сообщений потока',
  'panel.inspector.streams.sortByTitle': 'Сортировать по столбцу {column}',
  'panel.inspector.streams.resizeColumnAria': 'Изменить ширину столбца {column}',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'Вид',
  'panel.inspector.streams.view.layout': 'Компоновка',
  'panel.inspector.streams.view.layoutCompact': 'Компактная',
  'panel.inspector.streams.view.layoutWide': 'Широкая',
  'panel.inspector.streams.view.split': 'Разделение',
  'panel.inspector.streams.view.splitSideBySide': 'Рядом',
  'panel.inspector.streams.view.splitStacked': 'Друг над другом',
  'panel.inspector.streams.view.splitDisabledTitle': 'Включите предпросмотр полезной нагрузки, чтобы разделить панель',
  'panel.inspector.streams.view.showPreview': 'Показывать предпросмотр полезной нагрузки',

  // Fire-rail dot titles + row actions.
  'panel.inspector.streams.fire.appliedFrame':
    'Правило применено — полезная нагрузка фрейма совпадает с полезной нагрузкой правила',
  'panel.inspector.streams.fire.inferredFrame': 'Правило совпало — применение для этого фрейма проверить нельзя',
  'panel.inspector.streams.fire.injectedFrame': 'Правило применено — этот фрейм внедрён правилом',
  'panel.inspector.streams.fire.replacedFrame': 'Правило применено — правило заменило этот фрейм',
  'panel.inspector.streams.fire.droppedSendFrame': 'Правило отбросило этот фрейм — он не был отправлен серверу',
  'panel.inspector.streams.fire.droppedRecvFrame': 'Правило отбросило этот фрейм — страница его не получила',
  'panel.inspector.streams.fire.appliedEvent':
    'Правило применено — полезная нагрузка события совпадает с полезной нагрузкой правила',
  'panel.inspector.streams.fire.inferredEvent': 'Правило совпало — применение для этого события проверить нельзя',
  'panel.inspector.streams.fire.injectedEvent': 'Правило применено — это событие внедрено правилом',
  'panel.inspector.streams.fire.replacedEvent': 'Правило применено — правило заменило это событие',
  'panel.inspector.streams.fire.droppedEvent': 'Правило отбросило это событие — страница его не получила',
  'panel.inspector.streams.row.copied': 'Скопировано',
  'panel.inspector.streams.row.copyPayload': 'Копировать полезную нагрузку',
  'panel.inspector.streams.row.editRule': 'Изменить правило',
  'panel.inspector.streams.row.override': 'Переопределить',
  'panel.inspector.streams.row.droppedSendCell': 'Отброшен — не отправлен серверу',
  'panel.inspector.streams.row.droppedRecvCell': 'Отброшен — не доставлен странице',
  'panel.inspector.streams.row.notCaptured': 'Не захвачен',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Фильтр сообщений',
  'panel.inspector.messages.listAria': 'Сообщения WebSocket',
  'panel.inspector.messages.overrideMessage': 'Переопределить сообщение',
  'panel.inspector.messages.overrideMessageTitle': 'Создать правило сообщений для этого соединения',
  'panel.inspector.messages.editRuleTitle': 'Изменить правило сообщений, подействовавшее на этот фрейм',
  'panel.inspector.messages.createRuleTitle': 'Создать правило сообщений на основе этого фрейма',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Синтетическая строка — страница создала этот фрейм; правило отбросило его до отправки',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Синтетический фрейм — внедрён правилом внутри страницы; по сети не проходил',
  'panel.inspector.messages.emptyNoDebug':
    'Фреймы WebSocket видны только при включённом для этой вкладки режиме отладки.',
  'panel.inspector.messages.emptySynthetic':
    'По сети фреймы не проходили — здесь сработало правило внедрения, а внедрённые фреймы доставляются синтетически внутри страницы и невидимы для сетевого захвата.',
  'panel.inspector.messages.emptyNone': 'Фреймы WebSocket пока не передавались.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} более старый фрейм отброшен.',
      few: '{count} более старых фрейма отброшены.',
      many: '{count} более старых фреймов отброшены.',
      other: '{count} более старых фреймов отброшены.',
    });
    return `Показаны последние ${String(shown)} фреймов — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Фильтр событий',
  'panel.inspector.sse.listAria': 'События Server-Sent Events',
  'panel.inspector.sse.overrideEvent': 'Переопределить событие',
  'panel.inspector.sse.overrideEventTitle': 'Создать правило сообщений для этого потока',
  'panel.inspector.sse.editRuleTitle': 'Изменить правило сообщений, подействовавшее на это событие',
  'panel.inspector.sse.createRuleTitle': 'Создать правило сообщений на основе этого события',
  'panel.inspector.sse.syntheticTitle':
    'Синтетическое событие — внедрено правилом внутри страницы; по сети не проходило',
  'panel.inspector.sse.emptySynthetic':
    'По сети события не проходили — здесь сработало правило внедрения, а внедрённые события доставляются синтетически внутри страницы и невидимы для сетевого захвата.',
  'panel.inspector.sse.emptyUnparseable': 'В теле ответа нет разбираемых событий SSE.',
  'panel.inspector.sse.emptyNoDebug':
    'События не захвачены. Без режима отладки потоки Server-Sent Events материализуются только после завершения запроса; долгие потоки могут не появиться здесь, пока соединение не закроется.',
  'panel.inspector.sse.emptyNone': 'События пока не получены.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} более старое событие отброшено.',
      few: '{count} более старых события отброшены.',
      many: '{count} более старых событий отброшены.',
      other: '{count} более старых событий отброшены.',
    });
    return `Показаны последние ${String(shown)} событий — ${dropped}`;
  },

  // Preview panes.
  'panel.inspector.streams.preview.noMessageTitle': 'Сообщение не выбрано',
  'panel.inspector.streams.preview.noMessageHint': 'Выберите сообщение, чтобы просмотреть его содержимое.',
  'panel.inspector.streams.preview.noEventTitle': 'Событие не выбрано',
  'panel.inspector.streams.preview.noEventHint': 'Выберите событие, чтобы просмотреть его содержимое.',
  'panel.inspector.streams.preview.raw': 'Исходный',
  'panel.inspector.streams.preview.copy': 'Копировать',
  'panel.inspector.streams.preview.copied': 'Скопировано',
  'panel.inspector.streams.preview.copyTitle': 'Копировать в буфер обмена',
  'panel.inspector.streams.preview.decodeFailed': 'Не удалось декодировать двоичную полезную нагрузку.',
  'panel.inspector.messages.preview.droppedSendPane':
    'Правило отбросило этот фрейм — страница его создала, но он не был отправлен серверу.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'Правило отбросило этот фрейм — он дошёл до браузера, но не был доставлен странице.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'Фрейм, созданный страницей, не захвачен — по сети прошёл только изменённый фрейм.',
  'panel.inspector.messages.preview.syntheticNote':
    'Синтетический фрейм — внедрён правилом внутри страницы; по сети он не проходил.',
  'panel.inspector.sse.preview.droppedPane':
    'Правило отбросило это событие — оно дошло до браузера, но не было доставлено странице.',
  'panel.inspector.sse.preview.syntheticNote':
    'Синтетическое событие — внедрено правилом внутри страницы; по сети оно не проходило.',

  // Inferred-tier (i) corpora on the split captions.
  'panel.inspector.messages.inferredModified.title': 'Производное, не захвачено',
  'panel.inspector.messages.inferredModified.summary':
    'Эта сторона показывает заменяющую полезную нагрузку правила — уровень захвата видел только сетевой фрейм.',
  'panel.inspector.messages.inferredModified.description':
    'Сетевой захват записал исходный фрейм; изменение произошло внутри страницы после захвата. То, что именно этот фрейм получил замену, выведено из селектора фреймов правила — как и янтарная точка срабатывания.',
  'panel.inspector.messages.inferredDropped.title': 'Отброшен, выведено',
  'panel.inspector.messages.inferredDropped.summary':
    'Сетевой захват записал этот фрейм, но правило остановило его доставку внутри страницы.',
  'panel.inspector.messages.inferredDropped.description':
    'Отбрасывание происходит после захвата, поэтому саму недоставку ничто записать не может. То, что именно этот фрейм отброшен, выведено из селектора фреймов правила — как и янтарная точка срабатывания.',
  'panel.inspector.sse.inferredModified.title': 'Производное, не захвачено',
  'panel.inspector.sse.inferredModified.summary':
    'Эта сторона показывает заменяющую полезную нагрузку правила — уровень захвата видел только сетевое событие.',
  'panel.inspector.sse.inferredModified.description':
    'Сетевой захват записал исходное событие; изменение произошло внутри страницы после захвата. То, что именно это событие получило замену, выведено из селектора событий правила — как и янтарная точка срабатывания.',
  'panel.inspector.sse.inferredDropped.title': 'Отброшено, выведено',
  'panel.inspector.sse.inferredDropped.summary':
    'Сетевой захват записал это событие, но правило остановило его доставку внутри страницы.',
  'panel.inspector.sse.inferredDropped.description':
    'Отбрасывание происходит после захвата, поэтому саму недоставку ничто записать не может. То, что именно это событие отброшено, выведено из селектора событий правила — как и янтарная точка срабатывания.',

  // Column / rail (i) corpora.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Пример фрейма',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'символов ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'Полезная нагрузка фрейма — текстовые фреймы показывают содержимое дословно.',
  'panel.inspector.messages.columnInfo.data.description':
    'Выберите строку, чтобы открыть просмотрщик полезной нагрузки: дерево JSON, если текст разбирается, и просмотрщик Base64 / Hex / UTF-8 для двоичных фреймов.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'Вместо полезной нагрузки',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'Двоичный фрейм — байты живут в просмотрщике полезной нагрузки, а не в ячейке.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc':
    'Управляющие фреймы keepalive, которыми обмениваются конечные точки.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'Закрывающее рукопожатие, завершающее сокет.',
  'panel.inspector.messages.columnInfo.length.summary':
    'Размер полезной нагрузки — простое число символов для текстовых фреймов, форматированные байты (например `4 B`) для двоичных.',
  'panel.inspector.messages.columnInfo.time.summary': 'Момент по часам, когда фрейм прошёл по сети.',
  'panel.inspector.messages.columnInfo.time.description':
    'Единственный сортируемый столбец. По возрастанию — сетевой порядок; фреймы в одной миллисекунде в любом случае сохраняют порядок прибытия.',
  'panel.inspector.messages.directionInfo.title': 'Направление',
  'panel.inspector.messages.directionInfo.summary': 'В какую сторону шёл фрейм.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Стрелки',
  'panel.inspector.messages.directionInfo.sentDesc': 'Отправлен — страница отправила этот фрейм серверу.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Получен — сервер отправил этот фрейм странице.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Ошибка — сбой транспорта завершил поток; строка читается красным.',
  'panel.inspector.streams.fireRail.title': 'Срабатывания правил',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Цвета точек',
  'panel.inspector.messages.fireRail.summary':
    'Точка отмечает каждый фрейм, на который подействовало правило сообщений WebSocket. Фреймы не несут атрибуции правил, поэтому точка выводится: сработавшие правила сообщений этого запроса, селектор фреймов каждого правила заново применён к фрейму.',
  'panel.inspector.messages.fireRail.appliedDesc':
    'Применено — полезная нагрузка фрейма равна заменяющей или внедрённой полезной нагрузке правила.',
  'panel.inspector.messages.fireRail.inferredDesc':
    'Выведено — направление и фильтр сообщений правила выбирают этот фрейм, но применение проверить нельзя (изменённый фрейм больше не содержит полезную нагрузку, с которой совпал фильтр).',
  'panel.inspector.messages.fireRail.description':
    'Отброшенный исходящий фрейм по сети не проходит, поэтому строки у него нет вовсе. Отброшенный входящий фрейм сначала захвачен из сети — его строка остаётся с пометкой «Отброшен — не доставлен странице».',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Пример события',
  'panel.inspector.sse.columnInfo.id.summary': 'Поле `id:` события — курсор переподключения, который выдаёт сервер.',
  'panel.inspector.sse.columnInfo.id.description':
    'Пусто, если сервер не отправляет id. При переподключении браузер возвращает последний id как `Last-Event-ID`, чтобы сервер мог продолжить поток с того же места.',
  'panel.inspector.sse.columnInfo.type.summary': 'Поле `event:` события — `message` для событий по умолчанию.',
  'panel.inspector.sse.columnInfo.type.description':
    'Код страницы подписывается по типу: `onmessage` видит только события по умолчанию; именованным событиям нужен `addEventListener` ровно для этого типа.',
  'panel.inspector.sse.columnInfo.data.summary':
    'Полезная нагрузка события — всегда текст; многострочные поля `data:` приходят объединёнными.',
  'panel.inspector.sse.columnInfo.data.description':
    'Выберите строку, чтобы открыть просмотрщик полезной нагрузки: дерево JSON, если текст разбирается, иначе дословно.',
  'panel.inspector.sse.columnInfo.time.summary': 'Момент по часам, когда событие пришло.',
  'panel.inspector.sse.columnInfo.time.description':
    'Сортируемый, по умолчанию по возрастанию. События, разобранные из завершённого тела ответа, времени не несут — в формате SSE его нет, — поэтому их ячейки остаются пустыми.',
  'panel.inspector.sse.fireRail.summary':
    'Точка отмечает каждое событие, на которое подействовало правило сообщений SSE. Захват, записанный обёрткой, — доказательство; без него точка выводится: сработавшие правила SSE этого запроса, селектор событий каждого правила заново применён к событию.',
  'panel.inspector.sse.fireRail.appliedDesc':
    'Применено — обёртка записала действие именно над этим событием, либо совпадает внедрённая полезная нагрузка.',
  'panel.inspector.sse.fireRail.inferredDesc':
    'Выведено — имя события и фильтр данных правила выбирают это событие, но применение по одной лишь сети проверить нельзя.',
  'panel.inspector.sse.fireRail.description':
    'События Server-Sent Events идут только сервер → страница, и сеть записывает их до того, как подействует правило: отброшенное событие сохраняет строку с пометкой «Отброшен — не доставлен странице»; внедрённое событие по сети не проходит и показывается синтетической строкой.',
} as const satisfies Catalog;
