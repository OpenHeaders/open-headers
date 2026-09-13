/**
 * DevTools panel — storage tool window — Russian. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose (окно as head noun), example-card
 * payloads, char / byte / MB figures, the Key / Value input
 * placeholders (they name their raw columns), and data-plane not-sent
 * reasons riding as holes. Mints: запись = entry (the storage grid row
 * AND the cache entry AND the IndexedDB record — the section noun
 * carries the S19 split: запись в {store}); элемент = item (the count
 * lines); хранилище объектов = object store; квота = quota (simulated
 * limit) vs Использование = Usage (the nav section); фрейм = frame
 * (page/iframe referent, carried); курсор = cursor; правка на месте =
 * inline edit; предел = cap / ceiling; автоинкрементные ключи =
 * auto-increment keys with внешние ключи = out-of-line keys;
 * разделённое = partitioned; Форматированный / Исходный = the
 * Formatted / Raw toggle (carried from panel.ts); хранилище cookie
 * (cookie jar) and черновик carried from the shared register;
 * источник = origin; инспектируемая вкладка = the inspected tab.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': 'Тип хранилища',
  'panel.storage.nav.local': 'Локальное хранилище',
  'panel.storage.nav.session': 'Сеансовое хранилище',
  'panel.storage.nav.cookies': 'Файлы cookie',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Использование',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} совпадение',
      few: '{count} совпадения',
      many: '{count} совпадений',
      other: '{count} совпадений',
    }),
  'panel.storage.filterAria': 'Фильтр записей хранилища',
  'panel.storage.revealedHidden': 'Показанная строка скрыта активным фильтром',
  'panel.storage.addCookieTitle': 'Добавить cookie в хранилище браузера (включая HttpOnly)',
  'panel.storage.addCookieAria': 'Добавить cookie',
  'panel.storage.addEntryTitle': 'Добавить запись',
  'panel.storage.addEntryAria': 'Добавить запись хранилища',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB здесь только для чтения',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage здесь только для чтения',
  'panel.storage.addReadOnly.quota': 'Использование только для чтения',
  'panel.storage.refreshTitle': 'Обновить',
  'panel.storage.refreshAria': 'Обновить хранилище',
  'panel.storage.originAria': 'Источник хранилища',
  'panel.storage.partitionedChip': 'разделённое',
  'panel.storage.partitionedTitle':
    'Разделённое хранилище — данные этого источника здесь хранятся с ключом {site}.\nКлюч хранилища: {raw}',
  'panel.storage.partitionFallback': 'раздела',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} элемент',
      few: '{count} элемента',
      many: '{count} элементов',
      other: '{count} элементов',
    }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} элемента',
      few: '{count} элементов',
      many: '{count} элементов',
      other: '{count} элементов',
    });
    return `${String(shown)} из ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie',
      few: '{count} cookie',
      many: '{count} cookie',
      other: '{count} cookie',
    }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), {
      one: '{count} cookie',
      few: '{count} cookie',
      many: '{count} cookie',
      other: '{count} cookie',
    });
    return `${String(shown)} из ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} база данных',
      few: '{count} базы данных',
      many: '{count} баз данных',
      other: '{count} баз данных',
    }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} кеш',
      few: '{count} кеша',
      many: '{count} кешей',
      other: '{count} кешей',
    }),
  'panel.storage.count.quotaUsed': 'использовано {used} из {total}',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'совпал {count} раздел',
      few: 'совпало {count} раздела',
      many: 'совпало {count} разделов',
      other: 'совпало {count} разделов',
    }),
  'panel.storage.note.writeFailed': 'ошибка записи',
  'panel.storage.note.deleteFailed': 'ошибка удаления',
  'panel.storage.note.readFailed': 'ошибка чтения — показаны последние данные',
  'panel.storage.note.truncated': 'список усечён',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Очистить локальное хранилище',
  'panel.storage.clear.label.session': 'Очистить сеансовое хранилище',
  'panel.storage.clear.label.cookies': 'Очистить файлы cookie',
  'panel.storage.clear.label.indexeddb': 'Очистить IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Очистить Cache Storage',
  'panel.storage.clear.title.local': 'Очистить все записи localStorage',
  'panel.storage.clear.title.session': 'Очистить все записи sessionStorage',
  'panel.storage.clear.title.cookies': 'Очистить все cookie в хранилище этого сайта',
  'panel.storage.clear.title.indexeddb': 'Очистить все базы данных IndexedDB',
  'panel.storage.clear.title.cachestorage': 'Очистить все кеши',
  'panel.storage.clear.armedTitle.local': 'Удаляет все записи localStorage для этого источника',
  'panel.storage.clear.armedTitle.session': 'Удаляет все записи sessionStorage для этого источника',
  'panel.storage.clear.armedTitle.cookies': 'Удаляет все cookie в хранилище этого сайта для этого источника',
  'panel.storage.clear.armedTitle.indexeddb': 'Удаляет все базы данных IndexedDB для этого источника',
  'panel.storage.clear.armedTitle.cachestorage': 'Удаляет все кеши для этого источника',
  'panel.storage.confirmClear': 'Подтвердить очистку?',
  'panel.storage.confirmDelete': 'Подтвердить удаление?',
  'panel.storage.confirmSuffixAria': '{action} — нажмите ещё раз для подтверждения',
  'panel.storage.cleared': '✓ очищено',
  'panel.storage.clearFailed': 'ошибка очистки',
  // Empty / error states.
  'panel.storage.empty.loading': 'Загрузка…',
  'panel.storage.empty.notAvailableTitle': 'Инспекция хранилища здесь недоступна',
  'panel.storage.empty.notAvailableSub': 'Этот хост не открывает доступ к хранилищу приложения инспектируемой вкладки.',
  'panel.storage.empty.noOriginsTitle': 'Нет доступных для инспекции источников',
  'panel.storage.empty.noOriginsDomSub':
    'На этой вкладке нет http(s)-фреймов с DOM-хранилищем — внутренние страницы браузера инспектировать нельзя.',
  'panel.storage.empty.noOriginsSub':
    'На этой вкладке нет http(s)-фреймов — внутренние страницы браузера инспектировать нельзя.',
  'panel.storage.empty.noOriginsCookiesSub':
    'На этой вкладке нет http(s)-фреймов — у внутренних страниц браузера нет cookie сайтов.',
  'panel.storage.empty.unavailableTitle': 'Хранилище недоступно',
  'panel.storage.empty.unavailableSub':
    'Фрейм для {origin} сейчас не читается — возможно, он перешёл на другую страницу.',
  'panel.storage.thisOrigin': 'этого источника',
  'panel.storage.empty.noItems': 'Нет элементов в {area} для {origin}.',
  'panel.storage.empty.noItemsMatch': 'Ни один элемент не подходит под ваш фильтр.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Файлы cookie здесь недоступны',
  'panel.storage.empty.cookiesUnavailableSub': 'Этот хост не открывает доступ к хранилищу cookie браузера.',
  'panel.storage.empty.noCookies': 'Нет cookie для {origin}.',
  'panel.storage.empty.noCookiesMatch': 'Ни один cookie не подходит под ваш фильтр.',
  // Jar cookie grid column headers — 'Domain · Path' carries the raw
  // attribute vocabulary inside the keyed value.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'Записи хранилища',
  'panel.storage.grid.clipped': 'обрезано ({length})',
  'panel.storage.grid.editTitle': 'Изменить эту запись',
  'panel.storage.grid.editAria': 'Изменить {key}',
  'panel.storage.grid.deleteTitle': 'Удалить эту запись',
  'panel.storage.grid.deleteAria': 'Удалить {key}',
  'panel.storage.grid.newKeyAria': 'Ключ новой записи',
  'panel.storage.grid.newValueAria': 'Значение новой записи',
  'panel.storage.grid.keyAria': 'Ключ записи',
  'panel.storage.grid.valueAria': 'Значение записи',
  'panel.storage.grid.addSaveHint': 'Записать новую запись в хранилище',
  'panel.storage.grid.editSaveHint': 'Записать изменённую запись обратно в хранилище',
  'panel.storage.grid.emptyKeyHint': 'Ключ не может быть пустым',
  'panel.storage.grid.cancelTitle': 'Отмена',
  'panel.storage.grid.cancelAddAria': 'Отменить добавление',
  'panel.storage.grid.cancelEditAria': 'Отменить правку',
  'panel.storage.grid.tooLarge': 'Слишком большое для правки здесь — полное значение превышает предел редактора.',
  'panel.storage.grid.fetchFailed': 'Полное значение сейчас не читается.',
  'panel.storage.grid.loadingFullValue': 'Загрузка полного значения…',
  'panel.storage.save.label': 'Сохранить',
  'panel.storage.save.noChanges': 'Нет изменений для сохранения',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Не отправляется этой странице — {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} не отправляется этой странице: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Разделён по {key}',
  'panel.storage.cookieRow.editTitle': 'Изменить этот cookie в хранилище браузера',
  'panel.storage.cookieRow.editAria': 'Изменить cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Удалить этот cookie из хранилища браузера',
  'panel.storage.cookieRow.deleteAria': 'Удалить cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB не читается',
  'panel.storage.idb.cantReadSub':
    'Этот фрейм сейчас не открывает доступ к своим базам данных — возможно, он перешёл на другую страницу.',
  'panel.storage.idb.noDatabases': 'Нет баз данных IndexedDB для этого источника.',
  'panel.storage.idb.versionTitle': 'Версия базы данных: {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} хранилище',
      few: '{count} хранилища',
      many: '{count} хранилищ',
      other: '{count} хранилищ',
    }),
  'panel.storage.idb.metaKeyPath': 'key: {path}',
  'panel.storage.idb.metaAutoIncrement': 'автоинкрементные ключи',
  'panel.storage.idb.metaOutOfLine': 'внешние ключи',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} индекс',
      few: '{count} индекса',
      many: '{count} индексов',
      other: '{count} индексов',
    }),
  'panel.storage.idb.deleteDbTitle': 'Удалить базу данных {name}',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Удаляет {name} и все хранилища в ней — страница, держащая её открытой, блокирует удаление',
  'panel.storage.idb.deleteDbAria': 'Удалить базу данных {name}',
  'panel.storage.idb.openStoreTitle': 'Открыть {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Очистить все записи в {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Удаляет все записи в {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Очистить хранилище {store}',
  'panel.storage.idb.noStores': 'нет хранилищ объектов',
  'panel.storage.idb.backTitle': 'Назад к базам данных',
  'panel.storage.idb.cursorAria': 'Курсор записей',
  'panel.storage.idb.cursorTitle':
    'Читать хранилище через один из его индексов — столбец ключа становится ключом индекса',
  'panel.storage.idb.primaryKeyOption': 'первичный ключ',
  'panel.storage.idb.indexOption': 'индекс: {name}',
  'panel.storage.idb.noRecords': 'Нет записей в {store}.',
  'panel.storage.idb.noRecordsPage': 'Нет записей в {store} на этой странице.',
  'panel.storage.idb.noRecordsMatch': 'Ни одна запись не подходит под ваш фильтр.',
  'panel.storage.idb.gridAria': 'Записи IndexedDB',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Открыть эту запись в редакторе',
  'panel.storage.idb.keyCellTitle': 'Ключ: {key}\nПервичный ключ: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Удалить эту запись',
  'panel.storage.idb.deleteRecordAria': 'Удалить запись {key}',
  'panel.storage.pager.prevTitle': 'Предыдущая страница',
  'panel.storage.pager.nextTitle': 'Следующая страница',
  'panel.storage.pager.page': 'страница {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage не читается',
  'panel.storage.cache.cantReadSub':
    'Этот API существует только в защищённых контекстах (https) — либо этот фрейм сейчас не читается.',
  'panel.storage.cache.noCaches': 'Нет кешей для этого источника.',
  'panel.storage.cache.noCachesMatch': 'Ни один кеш не подходит под ваш фильтр.',
  'panel.storage.cache.openTitle': 'Открыть кеш {name}',
  'panel.storage.cache.deleteTitle': 'Удалить кеш {name}',
  'panel.storage.cache.deleteConfirmTitle': 'Удаляет {name} и все записи в нём',
  'panel.storage.cache.deleteAria': 'Удалить кеш {name}',
  'panel.storage.cache.backTitle': 'Назад к кешам',
  'panel.storage.cache.noEntries': 'Нет записей в {name}.',
  'panel.storage.cache.noEntriesPage': 'Нет записей в {name} на этой странице.',
  'panel.storage.cache.noEntriesMatch': 'Ни одна запись не подходит под ваш фильтр.',
  'panel.storage.cache.gridAria': 'Записи кеша',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Удалить эту запись',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Удаляет сохранённый ответ — нажмите ещё раз для подтверждения',
  'panel.storage.cache.deleteEntryAria': 'Удалить запись {url}',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'Использование не читается',
  'panel.storage.quota.cantReadSub':
    'Этот API существует только в защищённых контекстах (https) — либо этот фрейм сейчас не читается.',
  'panel.storage.quota.used': 'использовано {size}',
  'panel.storage.quota.ofTotal': 'из {size} ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Сервис-воркеры',
  'panel.storage.quota.type.fileSystems': 'Файловые системы',
  'panel.storage.quota.type.other': 'Прочее',
  'panel.storage.quota.noBreakdown': 'Для этого источника нет разбивки использования по типам.',
  'panel.storage.quota.debugHint': 'Включите режим отладки, чтобы увидеть разбивку по типам.',
  'panel.storage.quota.sessionNote':
    'Сеансовое хранилище отдельно у каждой вкладки — очищается фрейм инспектируемой вкладки',
  'panel.storage.quota.targetsCaption': 'Цели команды «Очистить всё»',
  'panel.storage.quota.targetsTitle':
    '«Очистить всё» (справа сверху) удаляет ровно отмеченные типы данных для этого источника',
  'panel.storage.quota.simulateLabel': 'Имитировать свою квоту',
  'panel.storage.quota.simulateTitle':
    'Заставить браузер сообщать и соблюдать меньшую квоту для этого источника — чтобы проверить, как страница ведёт себя, когда место заканчивается',
  'panel.storage.quota.simulateSave': 'Сохранить',
  'panel.storage.quota.simulateCancel': 'Отмена',
  'panel.storage.quota.simulateReset': 'Сбросить',
  'panel.storage.quota.simulateResetTitle': 'Убрать имитируемую квоту',
  'panel.storage.quota.simulateRange': 'введите 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'ошибка имитации',
  'panel.storage.quota.clearEverything': 'Очистить всё',
  'panel.storage.quota.clearArmedTitle': 'Удаляет отмеченные типы данных для этого источника',
  'panel.storage.quota.clearTitle': 'Очистить отмеченные типы данных для этого источника',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Пример записи',
  'panel.storage.domCol.key.summary':
    'Имя записи — строка с учётом регистра, уникальная внутри {area} этого источника. Запись по существующему ключу перезаписывает его значение.',
  'panel.storage.domCol.key.description':
    'Переименование записи здесь сначала записывает новый ключ, а затем удаляет старый — неудачная запись никогда не теряет оригинал.',
  'panel.storage.domCol.value.summary':
    'Хранимая полезная нагрузка — всегда строка; структурированные данные страницы держат сериализованными, обычно как JSON.',
  'panel.storage.domCol.value.description':
    'Сетка показывает однострочный предпросмотр и обрезает очень длинные значения — открытие или правка записи загружает полный текст. Нажмите строку, чтобы открыть её как вкладку редактора; двойной клик (или карандаш) правит на месте.',
  'panel.storage.cookieCol.name.summary':
    'Идентификатор cookie. Браузеры различают их по (name, domain, path) — то же имя с другой областью — отдельный cookie.',
  'panel.storage.cookieCol.name.description':
    'Треугольник предупреждения отмечает cookie из хранилища сайта, который браузер НЕ приложит к запросу к инспектируемой странице — наведите курсор, чтобы увидеть причину (путь в другой области, только Secure на http, область поддомена, …).',
  'panel.storage.cookieCol.value.summary':
    'Полезная нагрузка cookie — то, что браузер отправляет обратно в заголовке Cookie.',
  'panel.storage.cookieCol.value.description':
    'Нажмите строку, чтобы открыть cookie как вкладку редактора с полным значением и разобранными видами; карандаш правит на месте.',
  'panel.storage.cookieCol.scope.summary':
    'Куда браузер прикладывает этот cookie — его Domain плюс, если уже чем /, его Path.',
  'panel.storage.cookieCol.scope.description':
    'Cookie на весь домен (хранится с ведущей точкой) уходит и на поддомены; cookie только для хоста закреплён ровно за своим хостом. Путь — это префикс: /api означает, что его несут только запросы под /api.',
  'panel.storage.cookieCol.expires.summary':
    'Когда браузер удалит cookie, относительно текущего момента — наведите курсор, чтобы увидеть точную дату.',
  'panel.storage.cookieCol.expires.description':
    'Session означает отсутствие Expires / Max-Age — браузер отбрасывает cookie по окончании сеанса.',
  'panel.storage.cacheCol.exampleCaption': 'Пример записи',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· сохранено',
  'panel.storage.cacheCol.request.summary':
    'URL-адрес сохранённого запроса — ключ, по которому кеш сопоставляет запросы fetch.',
  'panel.storage.cacheCol.request.description':
    'При наведении на строку появляется ограниченный предпросмотр сохранённых заголовков запроса. Нажмите строку, чтобы открыть сохранённый ответ как вкладку редактора; сетка хранит только метаданные.',
  'panel.storage.cacheCol.method.summary': 'HTTP-метод сохранённого запроса — часть ключа кеша наряду с URL-адресом.',
  'panel.storage.cacheCol.method.description': 'Почти всегда GET: Cache API отклоняет put / add для других методов.',
  'panel.storage.cacheCol.size.summary': 'Размер сохранённого ответа, прочитанный из его заголовка content-length.',
  'panel.storage.cacheCol.size.description':
    'Длинное тире означает, что сохранённый ответ не несёт content-length — тело всё равно на месте, во вкладке редактора записи.',
  'panel.storage.cacheCol.time.summary': 'Когда ответ был сохранён в кеш.',
  'panel.storage.cacheCol.time.description':
    'Определяется только на подключённых вкладках — длинное тире означает, что хост не смог прочитать это для данной области.',
  'panel.storage.idbCol.exampleCaption': 'Пример записи',
  'panel.storage.idbCol.key.summary':
    'Ключ записи под текущим курсором — по умолчанию первичный ключ хранилища; выбор индекса в хлебных крошках читает через него, и этот столбец становится ключом индекса.',
  'panel.storage.idbCol.key.description':
    'При наведении на строку видны оба ключа (ключ курсора и первичный ключ). Ключи могут быть числами, строками, датами или массивами из них.',
  'panel.storage.idbCol.value.summary':
    'Однострочный предпросмотр значения записи (structured clone), сериализованного в странице.',
  'panel.storage.idbCol.value.description':
    'Нажмите строку, чтобы открыть полную запись как вкладку редактора с раскрываемым деревом; сетка хранит только предпросмотр.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Показать в Storage',
  'panel.storage.doc.refreshConfirm': 'Отменит ваши правки — нажмите ещё раз, чтобы обновить',
  'panel.storage.doc.discardEdits': 'Отменить мои правки',
  'panel.storage.doc.openMergeView': 'Открыть вид объединения',
  'panel.storage.doc.preview': 'Предпросмотр',
  'panel.storage.doc.source': 'Исходник',
  'panel.storage.doc.formatAria': 'Формат исходного текста',
  'panel.storage.doc.formatted': 'Форматированный',
  'panel.storage.doc.raw': 'Исходный',
  'panel.storage.doc.formattedTitle': 'Отформатировано для чтения — сохранение сохраняет исходный формат',
  'panel.storage.doc.rawTitle': 'Точный хранимый текст',
  'panel.storage.doc.formatUnavailable': 'Форматированный вид доступен только для значений в форме JSON',
  'panel.storage.doc.formatInfoTitle': 'Форматированный вид',
  'panel.storage.doc.formatInfoSummary': 'Форматированный и исходный — два вида одного и того же хранимого текста.',
  'panel.storage.doc.formatInfoExampleCaption': 'Пример — одно значение, два вида',
  'panel.storage.doc.formatInfoModesHeading': 'Режимы',
  'panel.storage.doc.formatInfoFormattedDesc':
    'Вид для чтения — отличаются только пробелы. Правки перекодируются в исходный хранимый формат, и сохранение записывает этот текст; сохранение без правок записывает точные исходные байты.',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    'Вид для чтения — отличаются только пробелы. Этот документ только для чтения, и форматированный вид никогда не меняет хранимые байты.',
  'panel.storage.doc.formatInfoRawDesc': 'Точные хранимые байты.',
  'panel.storage.doc.unavailableSub':
    'Возможно, она удалена, либо фрейм сейчас не читается — «Обновить» повторит попытку.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '… (ещё {count} символ)',
      few: '… (ещё {count} символа)',
      many: '… (ещё {count} символов)',
      other: '… (ещё {count} символов)',
    }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'Cookie с таким именем, доменом и путём уже существует — сохранение перезапишет его. Выберите другую идентичность.',
  'panel.storage.doc.cookie.saveFailed.write': 'Не удалось сохранить — хранилище браузера отклонило запись.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'Новый cookie записан, но исходный удалить не удалось — существуют оба. «Обновить» перечитает хранилище.',
  'panel.storage.doc.cookie.saveHint': 'Записать изменённый cookie обратно в хранилище браузера',
  'panel.storage.doc.cookie.blockedHint': 'Форма не заполнена или ссылка не разрешается',
  'panel.storage.doc.cookie.refreshTitle': 'Перечитать cookie',
  'panel.storage.doc.cookie.refreshAria': 'Обновить cookie',
  'panel.storage.doc.cookie.revealTitle': 'Открыть файлы cookie в окне инструментов Storage',
  'panel.storage.doc.cookie.readOnlyNote':
    'Хранилище cookie этого хоста только для чтения — документ отражает хранилище, но не может в него записывать.',
  'panel.storage.doc.cookie.goneNote':
    'Этот cookie удалён в браузере — ваши несохранённые правки сохранены. Сохранение запишет его обратно.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie больше нет в хранилище',
  'panel.storage.doc.cookie.unavailableSub':
    'Возможно, он удалён или истёк, либо хранилище на этом хосте не читается — «Обновить» повторит попытку.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'Запись с таким ключом уже существует — сохранение перезапишет её. Выберите другой ключ.',
  'panel.storage.doc.dom.saveFailed.gone': 'Запись недоступна — возможно, она удалена. «Обновить» проверит заново.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Не удалось сохранить — превышена квота хранилища. Исходная запись не изменена.',
  'panel.storage.doc.dom.saveFailed.write': 'Не удалось сохранить — запись отклонена.',
  'panel.storage.doc.dom.modeAria': 'Режим просмотра записи',
  'panel.storage.doc.dom.previewTitle': 'Сворачиваемое дерево разобранного значения',
  'panel.storage.doc.dom.previewNeedsJson': 'Для предпросмотра нужно JSON-значение',
  'panel.storage.doc.dom.sourceTitle': 'Вид исходного значения',
  'panel.storage.doc.dom.saveHint': 'Записать изменённую запись обратно в хранилище',
  'panel.storage.doc.dom.blockedHint': 'Ключ не может быть пустым',
  'panel.storage.doc.dom.refreshTitle': 'Перечитать запись',
  'panel.storage.doc.dom.refreshAria': 'Обновить запись',
  'panel.storage.doc.dom.revealTitle': 'Открыть {area} в окне инструментов Storage',
  'panel.storage.doc.dom.keyLabel': 'Ключ',
  'panel.storage.doc.dom.keyAria': 'Ключ записи',
  'panel.storage.doc.dom.conflictNote': 'Значение изменилось в браузере, пока вы его редактировали.',
  'panel.storage.doc.dom.mergeToast': 'Объединение применено к черновику — сохранение запишет его в браузер',
  'panel.storage.doc.dom.goneNote':
    'Эта запись удалена в браузере — ваши несохранённые правки сохранены. Сохранение запишет её обратно.',
  'panel.storage.doc.dom.unavailableTitle': 'Запись больше недоступна',
  'panel.storage.doc.dom.tooLargeTitle': 'Слишком большое для открытия',
  'panel.storage.doc.dom.tooLargeSub': 'Значение превышает предел редактора и остаётся только для чтения.',
  'panel.storage.doc.dom.previewAria': 'Дерево значения записи',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'Недопустимый JSON — исправьте синтаксис и сохраните снова.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'Ключ изменился — сохранение создаст новую запись. Верните исходный ключ.',
  'panel.storage.doc.idb.saveFailed.gone': 'Запись недоступна — возможно, она удалена. «Обновить» проверит заново.',
  'panel.storage.doc.idb.saveFailed.write': 'Не удалось сохранить — запись отклонена.',
  'panel.storage.doc.idb.modeAria': 'Режим просмотра записи',
  'panel.storage.doc.idb.previewTitle': 'Сворачиваемое дерево значения записи',
  'panel.storage.doc.idb.previewNeedsDoc': 'Для предпросмотра нужен корректный документ',
  'panel.storage.doc.idb.sourceTitle': 'Исходный вид всего документа',
  'panel.storage.doc.idb.saveHint': 'Записать изменённое значение обратно в запись',
  'panel.storage.doc.idb.refreshTitle': 'Перечитать запись',
  'panel.storage.doc.idb.refreshAria': 'Обновить запись',
  'panel.storage.doc.idb.revealTitle': 'Открыть {database} › {store} в окне инструментов Storage',
  'panel.storage.doc.idb.truncatedNote': 'Усечено по пределу размера — только для чтения.',
  'panel.storage.doc.idb.nonJsonNote':
    'Содержит типы вне JSON (Date, Map, двоичные данные, …) — показано как представление только для чтения.',
  'panel.storage.doc.idb.conflictNote': 'Запись изменилась в браузере, пока вы её редактировали.',
  'panel.storage.doc.idb.mergeToast': 'Объединение применено к черновику — сохранение запишет его в запись',
  'panel.storage.doc.idb.goneNote':
    'Эта запись удалена или изменила форму в браузере — ваши несохранённые правки сохранены. Сохранение запишет их обратно.',
  'panel.storage.doc.idb.unavailableTitle': 'Запись больше недоступна',
  'panel.storage.doc.idb.previewAria': 'Дерево значения записи',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Удалить эту запись из кеша',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Удаляет сохранённый ответ — нажмите ещё раз для подтверждения',
  'panel.storage.doc.cache.deleteAria': 'Удалить запись кеша',
  'panel.storage.doc.cache.refreshTitle': 'Перечитать сохранённый ответ',
  'panel.storage.doc.cache.refreshAria': 'Обновить запись кеша',
  'panel.storage.doc.cache.revealTitle': 'Открыть кеш {cache} в окне инструментов Storage',
  'panel.storage.doc.cache.deleteFailed': 'Не удалось удалить — возможно, записи уже нет.',
  'panel.storage.doc.cache.unavailableTitle': 'Запись кеша больше недоступна',
  'panel.storage.doc.cache.truncatedNote': 'Тело усечено по пределу размера — сохранено {size}.',
  'panel.storage.doc.cache.headersSummary': 'Заголовки ответа ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Фильтр заголовков',
  'panel.storage.doc.cache.filterAria': 'Фильтр заголовков ответа',
  'panel.storage.doc.cache.noHeaders': 'Заголовки не сохранены.',
  'panel.storage.doc.cache.noHeadersMatch': 'Ни один заголовок не подходит под ваш фильтр.',
  'panel.storage.doc.cache.bodySummary': 'Тело ответа',
  'panel.storage.doc.cache.imageAria': 'Сохранённое изображение тела',
  'panel.storage.doc.cache.imageAlt': 'Сохранённое тело ответа для {url}',
  'panel.storage.doc.cache.binaryBody': 'Двоичное тело — сохранено {size}.',
  'panel.storage.doc.cache.emptyBody': 'Пустое тело.',
} as const satisfies Catalog;
