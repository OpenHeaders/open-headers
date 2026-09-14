/**
 * Workbench Docs panel — anchor registry bodies — Russian. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr/es S59 raw/keyed
 * split is followed exactly. Raw by design inside keyed prose:
 * wire/API tokens (declarativeNetRequest, webRequest, ResourceType,
 * queryTransform, block, main_frame, firstParty / thirdParty,
 * operationName / query / key / value, chrome.storage(.local),
 * fetch() / XMLHttpRequest, @font-face, Set-Cookie, Accept,
 * User-Agent, Content-Type, CORS, ERR_BLOCKED_BY_CLIENT, RE2, stdio,
 * HTTP/SSE, git log / git blame), ResourceType enum labels (Page,
 * Frame, Fetch/XHR, Script, …), the en figure strings `30,000 ms` /
 * `5,000 ms` verbatim with a head noun (задержки до … / предел — …;
 * `ms` is a glossary unit), DNR / AND / DOM / CA / PII / YAML / CDN /
 * MCP / MITM tokens with hyphenated appositions or head nouns
 * (DNR-правило, DNR-действие, JS-инициированный, CSS-код, движок DNR,
 * условия через AND). Quoted UI labels copy their shipped ru mints:
 * the header / query-param ops (Добавить / Заменить, Добавить в конец,
 * Удалить, Объединить, Только заменить, Удалить все — editors-rule),
 * the condition names and their Искл. variants, the inject timing
 * labels (Как можно раньше / После загрузки страницы), the popup tab
 * «Эта страница», the docs nav titles (workbench-chrome: Как
 * выполняются правила, Типы ресурсов, Сравнение с другими, Каждая
 * поверхность выпущена, Действия с заголовками, Блокировка,
 * Перенаправление, Параметры запроса, Внедрение JS / CSS, Задержка,
 * Тело запроса, Изменение ответа), Статические данные / Динамически
 * mode labels, Равно / Содержит = Equals / Contains, Основной /
 * Сторонний, монки-патч = monkey-patch, Тип домена, инициатор,
 * навигация, имитировать = mock (verb), Имитация = the Mock mode
 * (the Static response = the mock), значок, окно инструментов,
 * разделитель, Переопределить = Override, Объединить = Merge, место /
 * уровень carried, lowercase `vault` per-case law. MINTS: область
 * действия = reach carried (the debug-reach referent — a rule
 * engine's reach here); Статический = Static (the redirect / body /
 * response mode — закрепить stays pin); компромисс = trade-off;
 * фикстура = fixture; локальная страница ожидания = the waiting page;
 * полоса = delay lane (the timing band noun carried); преобразование
 * = transform; анонимизация; предел carried; локально-ориентированный
 * = local-first; гидратация carried. Whole-raw `.` / `).` / `A` / `An`
 * sentence tails copy verbatim and the Russian tail moves into the
 * preceding fragment; the `A` / `An` article pair keeps the raw terms
 * with the Russian gloss in parentheses; a fragment joined to a
 * preceding code chip with no space opens with `.` / `,` per en.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'Правила выполняются одним из двух движков в зависимости от того, что они делают. Понимание того, каким путём идёт ' +
    'правило, объясняет, где оно действует — и где не может.',
  'workbench.docs.body.execution.stackCaption':
    'JS-инициированные запросы проходят через Script, затем DNR. Статический трафик и навигации обходят Script целиком.',
  'workbench.docs.body.execution.dnrHeading': 'Нативный, быстрый, широкая область действия',
  'workbench.docs.body.execution.dnr1Prefix':
    'Правила заголовков Переопределить / Добавить в конец / Удалить, Блокировка, Перенаправление и Параметры запроса компилируются в записи',
  'workbench.docs.body.execution.dnr1Suffix':
    '. Chrome применяет их на сетевом уровне, до того как запрос покинет браузер.',
  'workbench.docs.body.execution.dnr2':
    'Область действия широкая: страницы, вложенные фреймы, скрипты, изображения, шрифты, fetch, XHR — каждый запрос, ' +
    'который браузер делает от имени страницы.',
  'workbench.docs.body.execution.dnrCaption': 'Один список в рамке — область действия DNR практически универсальна.',
  'workbench.docs.body.execution.scriptHeading': 'JS-контекст, узкая область действия',
  'workbench.docs.body.execution.script1Prefix':
    'Правила Внедрение, Задержка, Тело запроса, API-ответ и Объединить заголовки работают через монки-патч',
  'workbench.docs.body.execution.script1And': 'и',
  'workbench.docs.body.execution.script1Suffix':
    'изнутри страницы. Они могут преобразовывать JavaScript-инициированный трафик так, как DNR ' +
    'выразить не может — включая чтение и переписывание тел ответов, к которым у DNR нет доступа.',
  'workbench.docs.body.execution.scriptCaption':
    'Две колонки — что движок скриптов действительно перехватывает и что проходит мимо без изменений.',
  'workbench.docs.body.execution.limitPrefix': 'Статические ресурсы (',
  'workbench.docs.body.execution.limitSuffix':
    '), навигации страниц и внутренние запросы браузера обходят этот движок целиком. Для них используйте правило ' +
    'на базе DNR.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Краткий справочник по поведению, которое удивляет. Каждый пункт также отмечен прямо в разделе, ' +
    'к которому относится.',
  'workbench.docs.body.limitations.overviewCaption':
    'Четыре частые ловушки одним взглядом — подробности в выносках ниже.',
  'workbench.docs.body.limitations.devtoolsTitle': 'Изменённые заголовки не видны в DevTools',
  'workbench.docs.body.limitations.devtoolsBody':
    'Действия с заголовками применяются корректно, но вкладка Network браузера Chrome по-прежнему показывает исходные заголовки сервера.',
  'workbench.docs.body.limitations.scriptTitle': 'Правила на базе скриптов — узкая область действия',
  'workbench.docs.body.limitations.scriptPrefix':
    'Внедрение, Задержка, Тело, Имитация и Объединить заголовки перехватывают только',
  'workbench.docs.body.limitations.scriptAnd': 'и',
  'workbench.docs.body.limitations.scriptMiddle': '. Статические ресурсы и навигации страниц обходят их. См.',
  'workbench.docs.body.limitations.executionRef': 'Как выполняются правила',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'Объединить не читает заголовки браузера по умолчанию',
  'workbench.docs.body.limitations.mergeBody':
    'Операция Объединить видит только заголовки, явно заданные кодом страницы — Accept, User-Agent и другие ' +
    'заголовки браузера по умолчанию ей невидимы.',
  'workbench.docs.body.limitations.chromeTitle': 'Сопоставление заголовков требует Chrome 128 и новее',
  'workbench.docs.body.limitations.chromeBody':
    'Условия, сопоставляющие значения заголовков запроса / ответа, требуют Chrome 128 или новее. Старые браузеры ' +
    'молча игнорируют условие.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    'Несколько открытых вкладок рабочего пространства одновременно — полноправное состояние. Сохранённые данные синхронизируются через',
  'workbench.docs.body.multiTab.intro1Suffix':
    ', состояние компоновки остаётся у каждой вкладки, а намерения навигации переиспользуют существующие вкладки в том же окне, прежде чем ' +
    'открывать новые.',
  'workbench.docs.body.multiTab.syncCaption':
    'Вкладка A сохраняет, SW рассылает, вкладка B перегидратируется. Состояние компоновки остаётся в каждой вкладке.',
  'workbench.docs.body.multiTab.navHeading': 'Навигация переиспользует существующие вкладки',
  'workbench.docs.body.multiTab.nav1':
    'Сначала то же окно: если вкладка рабочего пространства уже открыта в окне, из которого вы нажимаете, она активируется ' +
    'и получает намерение (раздел документации для прокрутки, правило для редактирования). Другое окно: новая вкладка открывается ' +
    'в вашем текущем окне, а не перетягивает фокус между окнами Chrome — как работает собственный ' +
    'DevTools браузера Chrome, с одной панелью на окно.',
  'workbench.docs.body.multiTab.navCaption':
    'Тёплый путь активирует вкладку в том же окне; холодный путь открывает новую вкладку в окне вызывающего.',
  'workbench.docs.body.multiTab.numberingHeading': 'Нумерация вкладок',
  'workbench.docs.body.multiTab.numbering1Prefix':
    'При двух и более вкладках рабочего пространства заголовок каждой вкладки получает префикс с её порядковым номером —',
  'workbench.docs.body.multiTab.numbering1Suffix':
    '. Когда число снова падает до одной, оставшаяся вкладка сбрасывает префикс.',
  'workbench.docs.body.multiTab.numbering2Prefix': 'Порядковые номера стабильны в течение жизни вкладки: закрытие',
  'workbench.docs.body.multiTab.numbering2While': 'пока',
  'workbench.docs.body.multiTab.numbering2And': 'и',
  'workbench.docs.body.multiTab.numbering2Middle':
    'остаются, не перенумеровывает оставшиеся. Следующая открытая вкладка получает',
  'workbench.docs.body.multiTab.numbering2Middle2': '; нумерация сбрасывается до',
  'workbench.docs.body.multiTab.numbering2Suffix': 'только после закрытия всех вкладок рабочего пространства.',
  'workbench.docs.body.multiTab.numberingCaption':
    'Оставшиеся вкладки сохраняют номера при закрытиях; следующая вкладка — всегда максимум + 1.',
  'workbench.docs.body.multiTab.syncsHeading': 'Что синхронизируется, а что нет',
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Каждая сохраняемая сущность — правила, коллекции, папки, окружения, переменные рабочего пространства, vault, ' +
    'запросы, шаблоны — живёт в',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'как единственном источнике истины. Сохранения во вкладке A рассылаются через фон, и вкладка B перегидратируется. ' +
    'Переключения рабочего пространства и окружения распространяются так же.',
  'workbench.docs.body.multiTab.syncedCaption':
    'Один общий chrome.storage; обе вкладки читают и записывают одни и те же сохранённые данные.',
  'workbench.docs.body.multiTab.localCaption':
    'Перетаскивания компоновки и несохранённый ввод живут в каждой вкладке — другая вкладка их никогда не видит.',
  'workbench.docs.body.multiTab.layoutTitle': 'Компоновка не синхронизируется вживую',
  'workbench.docs.body.multiTab.layout1Prefix':
    'Пропорции панелей и состояние доков окон инструментов хранятся по рабочим пространствам, но изменения не распространяются на уже открытые ' +
    'вкладки. Перетаскивание разделителя во вкладке A не трогает вкладку B до перезагрузки — живая синхронизация компоновки ' +
    'дёргала бы во время ввода. Вкладка, открытая',
  'workbench.docs.body.multiTab.layoutAfter': 'после',
  'workbench.docs.body.multiTab.layout1Suffix': 'перетаскивания, наследует новую компоновку.',
  'workbench.docs.body.multiTab.draftsTitle': 'Несохранённые черновики локальны для вкладки',
  'workbench.docs.body.multiTab.drafts1':
    'Черновики редактора живут в памяти своей вкладки. Если вкладка A сохраняет то же правило, которое редактирует вкладка B, вкладка A ' +
    'выигрывает запись в хранилище — межвкладочного запроса «изменено, перезагрузить?» сегодня нет. Важно только когда две ' +
    'вкладки одновременно редактируют одну сущность.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'Вкладка',
  'workbench.docs.body.requestTracking.thisPage': 'Эта страница',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'во всплывающем окне показывает, какие правила активны для текущей страницы и с какими запросами они совпали. ' +
    'Отслеживание охватывает обе фазы — запрос и ответ — каждого соединения, которое делает страница.',
  'workbench.docs.body.requestTracking.phasesCaption': 'У одного соединения две фазы — обе входят в число на значке.',
  'workbench.docs.body.requestTracking.howHeading': 'Как это работает',
  'workbench.docs.body.requestTracking.how1Prefix': 'Расширение наблюдает за HTTP-запросами через',
  'workbench.docs.body.requestTracking.how1Middle':
    'API. Когда URL-адрес запроса совпадает с условиями правила (домены, URL-шаблон или URL-регулярное выражение), он ' +
    'записывается вместе с типом ресурса. Запись идёт вживую внутри сервис-воркера; всплывающее окно просто ' +
    'читает эту запись, когда вы открываете вкладку',
  'workbench.docs.body.requestTracking.how1Suffix': 'во всплывающем окне.',
  'workbench.docs.body.requestTracking.howCaption':
    'Браузер порождает события webRequest; расширение сопоставляет и записывает; всплывающее окно читает позже.',
  'workbench.docs.body.requestTracking.badge1':
    'Каждое совпавшее правило показывает значок с числом совпавших запросов. Нажмите на значок, чтобы ' +
    'раскрыть список меток времени, URL-адресов, типов ресурсов и совпавшего шаблона.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'Значок сворачивает число; нажатие раскрывает полный список совпадений.',
  'workbench.docs.body.requestTracking.directHeading': 'Прямые и косвенные совпадения',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    '(прямое) совпадение означает, что совпал сам URL-адрес страницы. An',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    '(косвенное) совпадение означает, что совпал только подресурс — скрипт, таблица стилей, XHR, изображение, шрифт, — а URL-адрес страницы ' +
    'нет. Одно и то же правило может дать любой из видов в зависимости от того, на какой странице вы находитесь.',
  'workbench.docs.body.requestTracking.directCaption':
    'Одно правило, два контекста страницы. Зелёное = совпало. Пунктир = исключено.',
  'workbench.docs.body.requestTracking.typesHeading': 'Типы ресурсов',
  'workbench.docs.body.requestTracking.types1Prefix': 'Каждый совпавший запрос несёт свой тип браузера Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping или Other. См. справочную страницу',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Типы ресурсов',
  'workbench.docs.body.requestTracking.types1Suffix': 'с полным соответствием и примерами.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'Справочник по значениям браузера Chrome',
  'workbench.docs.body.resourceTypes.introSuffix':
    ', которые показывают отслеживание запросов и условие «Типы ресурсов». Каждая подпись соответствует ровно одному ' +
    'базовому типу — строки не пересекаются.',
  'workbench.docs.body.resourceTypes.anatomyCaption': 'Какой запрос попадает в какой ResourceType — одним взглядом.',
  'workbench.docs.body.resourceTypes.descPage': 'Навигация документа верхнего уровня — URL-адрес в адресной строке.',
  'workbench.docs.body.resourceTypes.descFrame': 'Элемент iframe или вложенный фрейм внутри страницы.',
  'workbench.docs.body.resourceTypes.descXhr':
    'API-вызовы через fetch() или XMLHttpRequest. Chrome сообщает оба как один тип — различить их ' + 'невозможно.',
  'workbench.docs.body.resourceTypes.descScript': 'JavaScript-файлы, загружаемые страницей.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Таблицы стилей, загружаемые страницей.',
  'workbench.docs.body.resourceTypes.descImage': 'Изображения, загружаемые страницей или её стилями.',
  'workbench.docs.body.resourceTypes.descFont': 'Веб-шрифты, загружаемые через правила @font-face.',
  'workbench.docs.body.resourceTypes.descMedia': 'Аудио- или видеоресурсы.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'Рукопожатие WebSocket — начальный HTTP-запрос на апгрейд. Отслеживается только рукопожатие, а не отдельные ' +
    'сообщения.',
  'workbench.docs.body.resourceTypes.descPing':
    'Запросы beacon и ping, обычно используемые для аналитики и отслеживания.',
  'workbench.docs.body.resourceTypes.descOther': 'Всё, что не попадает в категории выше.',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'Действие — это часть правила «',
  'workbench.docs.body.actions.introDo': 'сделать',
  'workbench.docs.body.actions.intro1Middle': '». Если',
  'workbench.docs.body.actions.conditionLink': 'условие',
  'workbench.docs.body.actions.intro1Middle2': 'решает,',
  'workbench.docs.body.actions.introWhether': 'сработает ли',
  'workbench.docs.body.actions.intro1Middle3': 'правило, то действие решает,',
  'workbench.docs.body.actions.introWhatChanges': 'что изменится',
  'workbench.docs.body.actions.intro1Suffix':
    '. Каждое правило соединяет стопку условий, сопоставляемых через AND, ровно с одним действием.',
  'workbench.docs.body.actions.categories1':
    'Действия делятся на три категории — изменить исходящий запрос, изменить входящий ответ или выполнить ' +
    'код на странице. Каждое действие реализовано одним из двух движков:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '(из браузера Chrome —',
  'workbench.docs.body.actions.categoriesDnrSuffix': ', быстрый и нативный) или',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '(движок Open Headers внутри страницы — для того, что DNR выразить не может). См.',
  'workbench.docs.body.actions.executionLink': 'Как выполняются правила',
  'workbench.docs.body.actions.categories1Suffix': 'о компромиссах.',
  'workbench.docs.body.actions.ruleAnatomyCaption': 'Правило = условия через AND, соединённые ровно с одним действием.',
  'workbench.docs.body.actions.taxonomyCaption': 'Три категории, каждое действие с тегом своего движка.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Изменить запрос',
  'workbench.docs.body.actions.tagRequest': 'до того, как он покинет браузер',
  'workbench.docs.body.actions.modifyRequest1':
    'Перекроить исходящий запрос — его заголовки, URL-параметры, тело, назначение или вообще то, уходит ли он. ' +
    'Большинство правил живёт здесь.',
  'workbench.docs.body.actions.headerActionsLink': 'Действия с заголовками',
  'workbench.docs.body.actions.liHeaderActionsRequest':
    '— Добавить / Заменить / Добавить в конец / Удалить / Объединить для заголовков запроса.',
  'workbench.docs.body.actions.blockLink': 'Блокировка',
  'workbench.docs.body.actions.liBlock': '— отменить запрос на сетевом уровне.',
  'workbench.docs.body.actions.redirectLink': 'Перенаправление',
  'workbench.docs.body.actions.liRedirect':
    '— отправить запрос на другой URL-адрес, статический или по регулярному выражению.',
  'workbench.docs.body.actions.queryParamsLink': 'Параметры запроса',
  'workbench.docs.body.actions.liQueryParams': '— добавить, заменить или удалить URL-параметры.',
  'workbench.docs.body.actions.requestBodyLink': 'Тело запроса',
  'workbench.docs.body.actions.liRequestBody':
    '— переписать исходящее тело fetch / XHR (статически, динамически или с фильтром GraphQL).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Изменить ответ',
  'workbench.docs.body.actions.tagResponse': 'до того, как его увидит страница',
  'workbench.docs.body.actions.modifyResponse1':
    'Перекроить ответ на обратном пути — заголовки, тело или HTTP-статус. Полезно для имитации ещё не построенных ' +
    'конечных точек и принудительных сбоев при разработке.',
  'workbench.docs.body.actions.liHeaderActionsResponse': '— те же пять операций для заголовков ответа.',
  'workbench.docs.body.actions.responseLink': 'Изменение ответа',
  'workbench.docs.body.actions.liResponse':
    '— имитировать или изменить ответ: синтетическое тело, статус или заголовки.',
  'workbench.docs.body.actions.runCodeTitle': 'Выполнить код',
  'workbench.docs.body.actions.tagRunCode': 'внутри страницы или её планировщика',
  'workbench.docs.body.actions.runCode1':
    'Эффекты, которые не укладываются в «изменить запрос или ответ», — внедрение кода и искусственная задержка. ' +
    'Оба идут через движок Script, потому что у DNR нет эквивалента.',
  'workbench.docs.body.actions.injectLink': 'Внедрение JS / CSS',
  'workbench.docs.body.actions.liInject':
    '— выполнить JavaScript или CSS в контексте страницы, до скриптов страницы или после готовности DOM.',
  'workbench.docs.body.actions.delayLink': 'Задержка',
  'workbench.docs.body.actions.liDelay':
    '— добавить искусственную задержку навигациям и JS-инициированным fetch / XHR.',
  'workbench.docs.body.actions.oneActionTitle': 'Одно действие на правило',
  'workbench.docs.body.actions.oneAction1':
    'Каждое правило несёт ровно одно действие. Чтобы сделать две вещи сразу — например, добавить заголовок И перенаправить ' +
    '— напишите два правила с одинаковыми условиями. Оба срабатывают на одном запросе; DNR сочетает их в ' +
    'документированном порядке.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Четыре операции над заголовками запроса и ответа — три нативные (Добавить / Заменить, Добавить в конец, Удалить) плюс одна ' +
    'на базе скрипта (Объединить) для склейки значений, которую DNR выразить не может.',
  'workbench.docs.body.headerActions.opsCaption': 'Одни и те же исходные заголовки, четыре разных результата',
  'workbench.docs.body.headerActions.overrideTitle': 'Добавить / Заменить',
  'workbench.docs.body.headerActions.override1':
    'Задаёт заголовку это значение. Заменяет, если есть, добавляет, если нет — всегда один заголовок с вашим значением.',
  'workbench.docs.body.headerActions.overrideCaption':
    'Одно правило покрывает оба случая — заменяет, когда заголовок есть, добавляет, когда его нет.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    'Если условия правила не совпадают с запросом, ничего не происходит — без ошибки, пустая операция.',
  'workbench.docs.body.headerActions.appendTitle': 'Добавить в конец',
  'workbench.docs.body.headerActions.append1':
    'Добавляет новую запись заголовка с тем же именем. Исходная остаётся — получаются дублирующиеся заголовки. Используйте для ' +
    'Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    'Исходный заголовок остаётся; добавляется вторая строка с тем же именем. Доставляются обе.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    'Некоторые заголовки нельзя дублировать — браузер их схлопывает. Берите вместо этого Переопределить или Объединить.',
  'workbench.docs.body.headerActions.removeTitle': 'Удалить',
  'workbench.docs.body.headerActions.remove1': 'Удаляет все экземпляры этого заголовка. Значение не нужно.',
  'workbench.docs.body.headerActions.removeCaption': 'Целевая строка исчезает; всё остальное проходит без изменений.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    'Если заголовка нет, ничего не происходит — без ошибки, просто пустая операция.',
  'workbench.docs.body.headerActions.mergeTitle': 'Объединить',
  'workbench.docs.body.headerActions.merge1Prefix':
    'Читает существующее значение во время выполнения и добавляет ваше через разделитель. По умолчанию',
  'workbench.docs.body.headerActions.merge1Middle': 'для заголовка Cookie и',
  'workbench.docs.body.headerActions.merge1Suffix': 'для остальных. Разделитель может быть пустым для прямой склейки.',
  'workbench.docs.body.headerActions.mergeCaption':
    'Существующее значение остаётся; ваше добавляется после разделителя.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Только движок Script — навигации страниц и статические ресурсы проходят нетронутыми.',
  'workbench.docs.body.headerActions.mergeLimitation':
    'Объединить невидимо в DevTools и не читает заголовки браузера по умолчанию (Accept, User-Agent) — только ' +
    'заголовки, явно заданные кодом страницы.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Отменяет совпавшие запросы на сетевом уровне. Браузер получает сетевую ошибку, и страница видит, что ' +
    'запрос не удался, как будто сервер недоступен.',
  'workbench.docs.body.block.howTitle': 'Как это работает',
  'workbench.docs.body.block.how1Prefix': 'Компилируется в DNR-действие',
  'workbench.docs.body.block.how1Suffix':
    'без тела. Применяется независимо от типа ресурса — страницы, вложенные фреймы, скрипты, изображения, шрифты, ' +
    'fetch, XHR — так что одно правило покрывает всё, если не сузить его условием «Типы ресурсов».',
  'workbench.docs.body.block.blockCaption':
    'Запрос убивается до того, как покинет браузер; страница видит сетевую ошибку.',
  'workbench.docs.body.block.wontApplyCaption':
    'Уже загруженные ресурсы остаются загруженными — Блокировка ловит только будущие запросы.',
  'workbench.docs.body.block.whenTitle': 'Когда это использовать',
  'workbench.docs.body.block.when1Prefix':
    'Блокировка доменов рекламы / аналитики / отслеживания, имитация сбоев для одного хоста или запрет доступа к ' +
    'одной конечной точке при доступности остального API. Чтобы блокировать только документ страницы (не её ' +
    'подресурсы), добавьте условие «Типы ресурсов» со значением',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    'Четыре типичных сценария — ограничьте каждый условиями (Домены, URL-шаблон, Типы ресурсов).',
  'workbench.docs.body.block.note1Prefix': 'Блокировка запроса',
  'workbench.docs.body.block.note1Suffix':
    'показывает в Chrome страницу «ERR_BLOCKED_BY_CLIENT». Блокировки подресурсов происходят молча — что ' +
    'увидит пользователь, зависит от собственной обработки ошибок страницы.',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Перенаправляет совпавшие запросы на другой URL-адрес. Поддерживает статические URL-адреса и группы захвата регулярных выражений.',
  'workbench.docs.body.redirect.staticTitle': 'Статическое перенаправление',
  'workbench.docs.body.redirect.static1':
    'Введите полный URL-адрес, чтобы перенаправлять каждый совпавший запрос в одно и то же место.',
  'workbench.docs.body.redirect.staticCaption':
    'Одно назначение для каждого совпавшего запроса — полная подстановка URL-адреса.',
  'workbench.docs.body.redirect.regexTitle': 'Перенаправление по регулярному выражению',
  'workbench.docs.body.redirect.regex1Prefix': 'Сочетайте с условием «URL-регулярное выражение». Используйте',
  'workbench.docs.body.redirect.regex1Suffix': 'и т. д., чтобы ссылаться на группы захвата в целевом URL-адресе.',
  'workbench.docs.body.redirect.regexCaption': 'Совпавший текст группы захвата подставляется в целевой URL-адрес.',
  'workbench.docs.body.redirect.wontApplyCaption':
    'Перенаправление не применяется задним числом к уже загруженным страницам. Циклы Chrome молча ограничивает.',
  'workbench.docs.body.redirect.whenTitle': 'Когда это использовать',
  'workbench.docs.body.redirect.when1':
    'Принудительный HTTP → HTTPS, перевод пользователей со старого домена, переписывание версий API и проксирование CDN-трафика ' +
    'на локальный dev-сервер — четыре типичных сценария. Статический вариант — для полных URL-адресов, известных ' +
    'заранее; регулярное выражение — когда путь должен пройти через перенаправление.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Четыре типичных сценария — берите регулярное выражение, когда целевой путь зависит от совпадения.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'Изменяйте параметры строки запроса URL до того, как запрос покинет браузер. Компилируется в DNR-действие',
  'workbench.docs.body.queryParam.introSuffix': '.',
  'workbench.docs.body.queryParam.addTitle': 'Добавить / Заменить',
  'workbench.docs.body.queryParam.add1':
    'Добавляет параметр, если его нет, или заменяет его значение, если он уже есть.',
  'workbench.docs.body.queryParam.addCaption':
    'Добавляет, когда параметра нет, заменяет, когда есть — всегда один совпавший параметр с вашим значением.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Только заменить',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Заменяет значение',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'только когда параметр уже присутствует',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. URL-адреса без параметра остаются нетронутыми. Используйте это, чтобы канонизировать значение (например, принудительно задать',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    'на URL-адресах, уже несущих какой-либо регион), не внедряя его в URL-адреса, где его не было.',
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Заменяет только существующие значения — URL-адреса без параметра не трогаются.',
  'workbench.docs.body.queryParam.removeTitle': 'Удалить',
  'workbench.docs.body.queryParam.remove1': 'Удаляет указанные параметры по имени. Значение игнорируется.',
  'workbench.docs.body.queryParam.removeCaption':
    'Названный параметр исчезает; все остальные параметры запроса проходят.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Удалить все',
  'workbench.docs.body.queryParam.removeAll1':
    'Срезает всю строку запроса. Нельзя сочетать с Добавить / Заменить в одном правиле.',
  'workbench.docs.body.queryParam.removeAllCaption':
    'Срезает всю строку запроса за один шаг — URL-адрес остаётся голым.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Удалить все конфликтует с Добавить / Заменить на уровне DNR — разделите на два правила.',
  'workbench.docs.body.queryParam.whenTitle': 'Когда это использовать',
  'workbench.docs.body.queryParam.when1':
    'Принудительный флаг отладки, канонизация региона или языка, вычистка параметров отслеживания или срезание всех ' +
    'строк запроса ради приватности. Каждый случай чисто ложится на одну из четырёх операций выше.',
  'workbench.docs.body.queryParam.useCasesCaption':
    'Четыре типичных сценария — выберите операцию, отвечающую вашему замыслу.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    'Внедряйте JavaScript или CSS в совпавшие страницы. Код выполняется в контексте страницы через content script.',
  'workbench.docs.body.inject.timingCaption':
    'Время вставки — до скриптов страницы (Как можно раньше) или безопасно для DOM (После загрузки страницы).',
  'workbench.docs.body.inject.scriptTitle': 'Внедрение скрипта',
  'workbench.docs.body.inject.script1': 'Встроенный код или внешний URL-адрес. Выберите время вставки:',
  'workbench.docs.body.inject.asapStrong': 'Как можно раньше',
  'workbench.docs.body.inject.asap1':
    '— выполняется до собственных скриптов страницы. Полезно для монки-патчей, которым нужно выиграть гонку (например, обёртка',
  'workbench.docs.body.inject.asap1Suffix': 'до того, как код приложения захватит ссылку).',
  'workbench.docs.body.inject.afterStrong': 'После загрузки страницы',
  'workbench.docs.body.inject.after1':
    '— выполняется, когда страница разобрана. Более безопасный вариант по умолчанию для кода, читающего DOM, поскольку элементы ' +
    'гарантированно существуют.',
  'workbench.docs.body.inject.scriptCaption':
    'Скрипт попадает на страницу тегом <script> — видит те же глобальные объекты, что и JS страницы.',
  'workbench.docs.body.inject.cssTitle': 'Внедрение CSS',
  'workbench.docs.body.inject.css1Prefix': 'Внедрите собственный CSS-код тегом',
  'workbench.docs.body.inject.css1Suffix':
    '. Полезно для переопределений тёмной темы, скрытия шумных элементов или оформления по окружениям.',
  'workbench.docs.body.inject.cssCaption': 'CSS добавляется тегом <style> с обычной специфичностью CSS.',
  'workbench.docs.body.inject.wontApplyCaption':
    'Изолированные iframe и страницы со строгим CSP блокируют внедрённые скрипты.',
  'workbench.docs.body.inject.whenTitle': 'Когда это использовать',
  'workbench.docs.body.inject.when1':
    'Монки-патч браузерных API до того, как их захватит код приложения, принудительная тёмная тема, скрытие шумных элементов ' +
    'интерфейса и предзадание флагов функций на уровне window до инициализации страницы.',
  'workbench.docs.body.inject.useCasesCaption':
    'Четыре типичных сценария — для первого и четвёртого требуется время «Как можно раньше».',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    'Добавляет искусственную задержку совпавшим запросам. Три полосы работают параллельно в зависимости от вида запроса.',
  'workbench.docs.body.delay.routingCaption': 'Маршрутизация задержки — три полосы для трёх видов запросов.',
  'workbench.docs.body.delay.navHeading': 'Навигации документа и iframe',
  'workbench.docs.body.delay.nav1Prefix': 'Идут через локальную страницу ожидания. Соблюдаются задержки до',
  'workbench.docs.body.delay.navMs': '30,000 ms',
  'workbench.docs.body.delay.nav1Suffix': '— предел DNR-перенаправлений браузера Chrome.',
  'workbench.docs.body.delay.navCaption':
    'Локальная страница ожидания держит навигацию N ms, затем пересылает на настоящую цель.',
  'workbench.docs.body.delay.xhrHeading': 'JS-инициированные XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': 'Перехватываются монки-патчем',
  'workbench.docs.body.delay.xhr1Middle': '. Предел —',
  'workbench.docs.body.delay.xhrMs': '5,000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    ', чтобы не истощать пул HTTP-соединений браузера Chrome — значения выше обрезаются при отправке.',
  'workbench.docs.body.delay.xhrCaption':
    'setTimeout внутри патча уровня страницы держит вызов, прежде чем передать его в сеть.',
  'workbench.docs.body.delay.wontApplyCaption':
    'Подресурсы и запросы fetch сервис-воркера ускользают от монки-патча уровня страницы.',
  'workbench.docs.body.delay.whenTitle': 'Когда это использовать',
  'workbench.docs.body.delay.when1':
    'Выявление регрессий состояний загрузки, прогон путей кода с дебаунсом / троттлингом, обнаружение гонок ' +
    'между параллельными запросами и приближение к условиям медленной сети при локальной разработке.',
  'workbench.docs.body.delay.useCasesCaption':
    'Четыре типичных сценария — сочетайте с URL-шаблоном или Доменами, чтобы ограничить область.',
  'workbench.docs.body.delay.desktopNoteTitle': 'Настольное приложение — заметка о продукте',
  'workbench.docs.body.delay.desktopNote1':
    'Троттлинг статических ресурсов (изображений, скриптов, таблиц стилей, шрифтов) требует настоящего локального сетевого уровня, ' +
    'который может держать соединения открытыми и передавать байты потоком — расширению это недоступно. Настольное приложение скоро возьмёт ' +
    'это на себя.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'Переопределяйте или преобразуйте тела запросов до того, как они покинут браузер. На базе скрипта — перехватывает',
  'workbench.docs.body.requestBody.introAnd': 'и',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'Правило срабатывает между page.js и сетью — три формы преобразования',
  'workbench.docs.body.requestBody.staticTitle': 'Статическое тело',
  'workbench.docs.body.requestBody.static1':
    'Заменяет всё тело запроса фиксированной строкой. Работает и для REST, и для GraphQL — правило не ' +
    'разбирает тело, а подставляет целиком.',
  'workbench.docs.body.requestBody.staticCaption': 'Всё тело заменено — исходное отброшено.',
  'workbench.docs.body.requestBody.dynamicTitle': 'Динамическое тело',
  'workbench.docs.body.requestBody.dynamic1':
    'Напишите функцию, которая получает исходное тело и контекст запроса и возвращает изменённое тело. ' +
    'Функция получает',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': 'Функция видит исходное; возвращает то, что нужно отправить.',
  'workbench.docs.body.requestBody.graphqlTitle': 'Фильтр GraphQL',
  'workbench.docs.body.requestBody.graphql1Prefix':
    'Когда тип ресурса — GraphQL, правило срабатывает только на запросах, у которых настроенное поле JSON-полезной нагрузки ' +
    'совпадает со значением. Среда выполнения разбирает тело запроса как JSON, читает поле, названное в',
  'workbench.docs.body.requestBody.graphql1Middle': ', и проверяет его по',
  'workbench.docs.body.requestBody.graphql1Middle2': 'выбранным оператором (',
  'workbench.docs.body.requestBody.graphql1Middle3': 'для точного совпадения,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'для подстроки).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Частые ключи:',
  'workbench.docs.body.requestBody.graphql2Middle': 'для именованной операции,',
  'workbench.docs.body.requestBody.graphql2Suffix':
    'для подстроки текста запроса. Запросы без JSON-тела, а также с отсутствующим или несовпавшим ' +
    'полем проходят нетронутыми.',
  'workbench.docs.body.requestBody.graphqlCaption':
    'Фильтр на уровне поля — несовпавшие операции проходят нетронутыми.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'У GET/HEAD нечего заменять; статические ресурсы не попадают в перехват скриптом.',
  'workbench.docs.body.requestBody.whenTitle': 'Когда это использовать',
  'workbench.docs.body.requestBody.when1':
    'Принудительные тестовые фикстуры, штамповка каждой полезной нагрузки метаданными (флаги отладки, идентификаторы запросов), имитация ' +
    'отдельных операций GraphQL и анонимизация персональных данных перед воспроизведением — четыре типичных сценария.',
  'workbench.docs.body.requestBody.useCasesCaption':
    'Четыре типичных сценария — сочетайте с URL-шаблоном или Доменами, чтобы ограничить область.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Перехватывайте API-вызовы и возвращайте собственные ответы — полный контроль над кодом статуса, телом и заголовками ' +
    'ответа. На базе скрипта — перехватывает',
  'workbench.docs.body.response.introAnd': 'и',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    'Статический вариант вообще минует сеть; динамический сначала обращается к ней, затем преобразует.',
  'workbench.docs.body.response.staticTitle': 'Статический ответ',
  'workbench.docs.body.response.static1':
    'Возвращает фиксированное тело с полным контролем над синтетическим ответом — код статуса, Content-Type и любые ' +
    'дополнительные заголовки ответа (Set-Cookie, заголовки CORS, собственные флаги). Настоящий запрос никогда не выполняется. ' +
    'Полезно для офлайн-разработки против известной фикстуры.',
  'workbench.docs.body.response.staticCaption':
    'К серверу никто не обращается — страница получает фикстуру так, будто она пришла из сети.',
  'workbench.docs.body.response.dynamicTitle': 'Динамический ответ',
  'workbench.docs.body.response.dynamic1':
    'Сначала выполняется настоящий запрос. Ваша функция получает ответ и контекст запроса и возвращает ' +
    'изменённый ответ. Функция получает',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'Код статуса, Content-Type и поля заголовков ответа, заданные в правиле, по-прежнему применяются поверх ' +
    'возвращённого функцией значения, так что вы можете менять тело, а обёрточные заголовки оставить правилу.',
  'workbench.docs.body.response.dynamicCaption':
    'Сначала происходит настоящий вызов; функция переписывает то, что пришло.',
  'workbench.docs.body.response.graphqlTitle': 'Фильтр GraphQL',
  'workbench.docs.body.response.graphql1':
    'Когда тип ресурса — GraphQL, правило срабатывает только на запросах, у которых настроенное поле JSON-полезной нагрузки ' +
    'совпадает с заданным значением (Равно или Содержит) — так одну конечную точку, мультиплексирующую много операций, ' +
    'можно перехватывать по одной операции за раз. Запросы с несовпавшей полезной нагрузкой проходят прямо ' +
    'в сеть нетронутыми.',
  'workbench.docs.body.response.wontApplyCaption':
    'Статические ресурсы и навигации страниц никогда не попадают в перехват скриптом.',
  'workbench.docs.body.response.whenTitle': 'Когда это использовать',
  'workbench.docs.body.response.when1':
    'Офлайн-разработка против фикстуры, имитация конкретных ответов с ошибкой, скрытие персональных данных до того, как они ' +
    'дойдут до страницы, и прогон краевых форм полезной нагрузки, которые трудно воспроизвести на настоящем ' +
    'бэкенде.',
  'workbench.docs.body.response.useCasesCaption':
    'Четыре типичных сценария — статический для фикстур, динамический для преобразований настоящих данных.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    'Условие — это фильтр по одному атрибуту исходящего запроса. Сложите несколько условий, и они ' +
    'объединятся по логике AND — для срабатывания правила должны совпасть все. Каждое условие напрямую соответствует полю браузера Chrome',
  'workbench.docs.body.conditions.intro1Suffix': 'в DNR-правиле.',
  'workbench.docs.body.conditions.intro2Prefix': 'У большинства условий есть и вариант',
  'workbench.docs.body.conditions.exclStrong': 'Искл.',
  'workbench.docs.body.conditions.intro2Suffix':
    'в редакторе правил — Искл. методы, Искл. ресурсы, Искл. инициатора, Искл. загол. ответа — который ' +
    'обращает совпадение (например, «всё, кроме этих методов»). Используйте их, когда отрицательное множество ' +
    'меньше положительного.',
  'workbench.docs.body.conditions.anatomyCaption':
    'Правило соединяет условия через AND с одним действием — условия решают, сработает ли правило.',
  'workbench.docs.body.conditions.matchingCaption':
    'Каждое условие проверяет один атрибут запроса. Для срабатывания правила должны совпасть все.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    'URL-адрес страницы и URL-адрес назначения fetch отслеживаются отдельно — поэтому условий по домену ' + 'два.',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL-шаблон',
  'workbench.docs.body.conditions.urlPattern1Prefix':
    'Шаблон с подстановочными знаками по полному URL-адресу. Используйте',
  'workbench.docs.body.conditions.urlPattern1Middle': 'для любых символов. Протокол нужно указать:',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'для любого,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'только для HTTPS.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Золотое = подстановочный знак, зелёное = литерал. Каждый тестовый URL-адрес ниже показывает, совпадает ли с ним шаблон.',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL-регулярное выражение',
  'workbench.docs.body.conditions.urlRegex1':
    'Регулярное выражение RE2 по полному URL-адресу, включая протокол. Для сопоставления, которое подстановочные знаки выразить не могут. ' +
    'Нельзя сочетать с URL-шаблоном в одном правиле.',
  'workbench.docs.body.conditions.urlRegexCaption':
    'Фиолетовое = настоящий синтаксис регулярного выражения. Зелёное = литеральные символы. Каждый тестовый URL-адрес ниже показывает, совпадает ли ' +
    'выражение.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Домены запроса',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Совпадает с доменом и каждым его поддоменом автоматически. Введите корневой домен один раз; правило ' + 'покроет',
  'workbench.docs.body.conditions.requestDomains1Suffix':
    'и любую более глубокую вложенность без подстановочных знаков.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'Одно значение, все поддомены. Граничные случаи ниже показывают, что считается настоящим поддоменом.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Исключить домены',
  'workbench.docs.body.conditions.excludeDomains1':
    'Вычитает хосты из совпадений другого условия — та же семантика поддоменов, что у Доменов запроса, поэтому ' +
    'исключение хоста исключает и его поддомены. Само по себе ни с чем не совпадает.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    'Зелёное включение сужает до множества кандидатов; красное исключение убирает часть из них. Поддомены следуют за ними.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Домены инициатора',
  'workbench.docs.body.conditions.initiatorDomains1':
    'Совпадает по тому, какая страница открыта в момент запроса — по источнику запроса, а не по его назначению. Один и ' +
    'тот же вызов fetch к одному URL-адресу может совпасть или нет в зависимости от того, какую вкладку просматривает пользователь.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    'Одно назначение, два разных контекста страницы. Инициатор решает, какой из них совпадёт.',
  'workbench.docs.body.conditions.methodsTitle': 'Методы',
  'workbench.docs.body.conditions.methods1':
    'Фильтр по HTTP-методу. Множественный выбор — выберите методы, которые должны совпадать; остальные правило не ' +
    'запускают. Не добавляйте условие вовсе, чтобы совпадал любой метод.',
  'workbench.docs.body.conditions.methodsCaption':
    'Оранжевые чипы выбраны; серые пропущены. Тестовые запросы ниже прослеживают каждый метод до результата.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Типы ресурсов',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Фильтр по тому, какой ресурс загружается — навигации страниц, XHR/fetch, скрипты, изображения, шрифты ' +
    'и другое. Множественный выбор, как у Методов. См. справочник',
  'workbench.docs.body.conditions.resourceTypesLink': 'Типы ресурсов',
  'workbench.docs.body.conditions.resourceTypes1Suffix': 'с полным списком кодовых имён и конкретных примеров.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Фиолетовые виды совпадают; серые пропущены. Каждый тестовый запрос показывает свой вид рядом.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Тип домена',
  'workbench.docs.body.conditions.domainType1Prefix': 'Классифицирует каждый запрос по его отношению к странице —',
  'workbench.docs.body.conditions.domainType1Middle': ', когда назначение делит со страницей регистрируемый домен,',
  'workbench.docs.body.conditions.domainType1Suffix':
    ', когда нет. Частое применение: блокировка трекеров (совпадение только thirdParty) или ограничение правила своими ' +
    'сервисами (совпадение только firstParty).',
  'workbench.docs.body.conditions.domainTypeCaption':
    'Баннер страницы задаёт источник; селектор выбирает, какой тип совпадает; таблица показывает вердикт по каждому ' +
    'назначению.',
  'workbench.docs.body.conditions.headersTitle': 'Заголовки ответа',
  'workbench.docs.body.conditions.headers1':
    'Совпадение с ответами, несущими определённый заголовок с определённым значением. DNR браузера Chrome не даёт ' +
    'сопоставлять заголовки запроса — это условие только для стороны ответа. И имя заголовка, и значение ' +
    'сравниваются как точные строки (без подстановочных знаков, без частичного совпадения), и заголовок должен действительно присутствовать ' +
    'в ответе.',
  'workbench.docs.body.conditions.headersCaption':
    'Два чипа (имя + значение), соединённые знаком =, затем тестовые заголовки ответа для каждого варианта несовпадения.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Всё в одном расширении',
  'workbench.docs.body.paradigm.oneExtension1':
    'Три категории продуктов исторически делили эту область между собой: настольные прокси занимаются перехватом HTTP, ' +
    'облачные API-платформы хранят ваши запросы и коллекции, а лёгкие расширения для заголовков закрывают ' +
    'случай «просто переписать один заголовок». Ни один из них не включает остальные. Open Headers включает — внутри одного браузерного ' +
    'расширения, с одним хранилищем рабочих пространств, питающим каждую поверхность.',
  'workbench.docs.body.paradigm.convergenceCaption':
    'Три устаревшие категории сходятся в одной установке. Никто больше не поставляет это сочетание внутри расширения.',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Движок правил корпоративного уровня',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    'Движок правил — не один трюк, растянутый на девять интерфейсов, а два настоящих пути выполнения с одним общим ' +
    'языком поверх.',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR-нативные',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'правила компилируются в предоставляемый браузером Chrome',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API и ловят каждый запрос браузера (страницы, вложенные фреймы, fetch, XHR, изображения, шрифты, скрипты).',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'Движок скриптов',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    'подхватывает там, куда DNR не дотягивается, — объединение значений заголовков, преобразование тел, имитация ответов, внедрение ' +
    'кода, задержка вызовов. Оба движка читают один язык условий и одни и те же пять областей переменных, поэтому ' +
    'правило, написанное под DNR, переезжает в движок скриптов сменой одного типа действия.',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    'Два пути выполнения, девять категорий правил, один общий язык условий и переменных.',
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Полный каталог API-запросов',
  'workbench.docs.body.paradigm.apiCatalog1':
    'Каждая возможность настольного API-клиента — построение запросов, окружения, OAuth 2.0 (включая PKCE, ' +
    'Client Credentials и обновление), скрипты до запроса и после ответа, multipart с адресуемыми по содержимому файловыми блобами, ' +
    'коллекции и папки, GraphQL с интроспекцией схемы — живёт внутри расширения. То же хранилище рабочих пространств, что ' +
    'у правил, те же пять областей переменных, те же поверхности. Принесите коллекции с другой платформы и продолжайте ' +
    'работать; ничего не экспортируется обратно в облако, которое вы не контролируете.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'Редактор запросов с поддержкой протоколов, всеми типами авторизации, скриптами, файлами и коллекциями — внутри ' +
    'расширения.',
  'workbench.docs.body.paradigm.localFirstHeading': 'Локально-ориентированный по замыслу',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '«Локально-ориентированный» — это позиция, а не функция. У расширения нет системы учётных записей, облачного ретранслятора, отслеживания — ' +
    'единственные данные об использовании — анонимный подсчёт функций, проверяемый байт в байт и выключаемый одним переключателем, — и ' +
    'у вас есть настоящий выбор,',
  'workbench.docs.body.paradigm.localFirstWhere': 'где',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    'живёт бэкенд. Четыре варианта размещения, все только локальные, все под вашим контролем: сервис-воркер внутри браузера ' +
    '(сегодня, без настройки), встроенный бэкенд настольного приложения, автономный локальный сервер, обслуживающий каждую поверхность Open ' +
    'Headers на одной машине, или бэкенд, который вы сами размещаете на своей ВМ. Каждый вариант сохраняет те же ' +
    'гарантии; компромисс — в охвате, а не во владении.',
  'workbench.docs.body.paradigm.localFirst2':
    'Командная работа идёт через контролируемые пользователем бэкенды хранения (Git) — не через сервер поставщика.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'Тот же принцип относится к тому,',
  'workbench.docs.body.paradigm.frontEndsHow': 'как',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    'вы добираетесь до этих данных. Браузерное расширение — фронтенд по умолчанию, четыре поверхности внутри браузера. ' +
    'Рядом с ним поставляются нативное настольное приложение, CLI и удалённое веб-приложение. Каждый фронтенд говорит с бэкендом ' +
    'по вашему выбору; берите любое сочетание, и каждая поверхность остаётся синхронизированной.',
  'workbench.docs.body.paradigm.autoSyncHeading': 'Автосинхронизация без потери работы',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'Синхронизация между устройствами — обычно то место, где локально-ориентированные продукты сдаются и просят довериться их облаку. Open Headers ' +
    'решает это на',
  'workbench.docs.body.paradigm.perFieldStrong': 'уровне поля',
  'workbench.docs.body.paradigm.autoSync1Middle': ': всплывающее окно, переключающее флаг',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'правила, и рабочая среда, переписывающая значение заголовка в том же правиле, приземляются обе, в любом порядке, без баннера ' +
    'об устаревшем черновике и без перезаписи. Тот же подход масштабируется от четырёх поверхностей одного расширения до локального ' +
    'сервера за расширением, настольным приложением и CLI и до многопользовательских командных рабочих пространств через удалённый репозиторий Git — ' +
    'и никогда не требует сервера поставщика посередине.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    'Две поверхности, одно правило, разные поля — обе правки приземляются, ничего не перезаписано.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    'Хотите увидеть, чем это отличается от других инструментов, которые вы могли пробовать? Дальше —',
  'workbench.docs.body.paradigm.comparisonLink': 'Сравнение с другими',
  'workbench.docs.body.paradigm.noteCalloutMiddle': '. Хотите всю платформу одним взглядом? Перейдите к',
  'workbench.docs.body.paradigm.roadmapLink': 'Каждая поверхность выпущена',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    'Самая короткая версия: Open Headers — это то, что вы построили бы, взяв мощь формирования запросов настольного ' +
    'прокси, библиотеку правил облачной API-платформы и всегда включённую поверхность расширения только для заголовков и ' +
    'попросив их делить одно хранилище.',
  'workbench.docs.body.comparison.matrixCaption':
    'Три категории продуктов, у каждой свой набор компромиссов — и где оказывается Open Headers.',
  'workbench.docs.body.comparison.vsCloudHeading': 'против облачных API-платформ',
  'workbench.docs.body.comparison.vsCloud1':
    'Облачные инструменты ожидают, что ваш трафик, учётные данные и определения правил будут жить на их серверах. Эта модель ' +
    'предполагает, что вас устраивает уход этих данных с вашей машины — и поддержание учётной записи ради доступа к собственной ' +
    'работе. Open Headers не делает ни того, ни другого предположения. Всё остаётся локально; командная работа идёт через ' +
    'контролируемое пользователем хранилище (Git), а не через базу данных поставщика.',
  'workbench.docs.body.comparison.vsProxiesHeading': 'против настольных прокси',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'Прокси прогоняют весь ваш трафик через отдельный процесс. Они мощные, но тяжёлые: установить бинарник, ' +
    'установить CA-сертификат, настроить каждое приложение на порт прокси. Open Headers использует предоставляемый браузером Chrome',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API для статического трафика и постраничный движок скриптов для динамических преобразований. Без порта прокси, без CA-сертификата, без ' +
    'настройки каждого приложения — и совпавшие правила применяются с правами самой страницы, а не посредника.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'против расширений только для заголовков',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'Расширения только для заголовков поддерживают ровно один тип правил и на этом останавливаются. Open Headers поддерживает',
  'workbench.docs.body.comparison.nineLink': 'девять',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle':
    '— заголовки Добавить / Заменить / Добавить в конец / Удалить / Объединить,',
  'workbench.docs.body.comparison.blockLink': 'Блокировка',
  'workbench.docs.body.comparison.redirectLink': 'Перенаправление',
  'workbench.docs.body.comparison.queryParamsLink': 'Параметры запроса',
  'workbench.docs.body.comparison.injectLink': 'Внедрение',
  'workbench.docs.body.comparison.delayLink': 'Задержка',
  'workbench.docs.body.comparison.requestBodyLink': 'Тело запроса',
  'workbench.docs.body.comparison.responseLink': 'Ответ',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— все на одном',
  'workbench.docs.body.comparison.conditionLanguageLink': 'языке условий',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', все наблюдаемые через одну поверхность',
  'workbench.docs.body.comparison.requestTrackingLink': 'отслеживания запросов',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': '.',
  'workbench.docs.body.comparison.whyMattersTitle': 'Почему это важно на практике',
  'workbench.docs.body.comparison.whyMatters1':
    'Большинство рабочих процессов задевает больше одной из этих категорий. Имитация API-ответа, блокировка стороннего трекера ' +
    'и принудительный заголовок отладки в одном конкретном окружении — три разных типа правил — три разных ' +
    'установки в старом мире. Здесь они делят одно рабочее пространство.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers начинался только локальным — одно расширение на одном устройстве. Каждая веха ниже расширяет эту форму, ' +
    'не ломая её, и каждая из них уже выпущена. Синхронизация между пользователями идёт через',
  'workbench.docs.body.roadmap.userControlledStrong': 'контролируемые пользователем',
  'workbench.docs.body.roadmap.intro1Suffix':
    'средства — репозитории Git и самостоятельные развёртывания — и никогда через облако поставщика.',
  'workbench.docs.body.roadmap.gitHeading':
    'Совместная работа над рабочими пространствами через Git (готово для команд)',
  'workbench.docs.body.roadmap.git1Prefix':
    'Рабочие пространства сериализуются в YAML в репозитории Git, который вы контролируете. Pull синхронизирует; push делится; конфликты слияния разрешаются ' +
    'штатными инструментами Git. Без центрального сервера, без учётной записи, без привязки к поставщику. Присутствие в реальном времени — это',
  'workbench.docs.body.roadmap.gitAnd': 'и',
  'workbench.docs.body.roadmap.git1Suffix': '— надёжно, проверяемо, уже знакомо.',
  'workbench.docs.body.roadmap.desktopHeading': 'Настольное приложение',
  'workbench.docs.body.roadmap.desktop1':
    'Нативный бинарник, работающий с тем же хранилищем рабочих пространств, что и расширение. Полезен для поверхностей, до которых расширение ' +
    'не дотягивается, — формирование трафика на уровне системы, многооконное редактирование, более глубокая интеграция с файловой системой. Оба используют ' +
    'один формат на диске, поэтому открыть настольным приложением рабочее пространство, принадлежащее расширению, — это чтение, а не ' +
    'миграция.',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP-сервер — управление ИИ-агентами',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers открывает себя по протоколу',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    ', так что любой ИИ-клиент с поддержкой MCP — Claude Desktop, Claude Code, Cursor, VS Code, Cline и растущая экосистема ' +
    'за ними — может напрямую управлять вашим рабочим пространством. Попросите агента обычным языком добавить правило заголовка, выполнить ' +
    'сохранённый запрос против staging, переключить окружение, сравнить два рабочих пространства или импортировать коллекцию Postman; ' +
    'агент переведёт это в вызовы MCP-инструментов, и ваша рабочая среда отразит результат.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'Сервер работает',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'по умолчанию только локально',
  'workbench.docs.body.roadmap.mcp2Middle':
    '(транспорт stdio, сопряжённый один к одному с клиентом на той же машине) и',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'по HTTP/SSE для удалённого доступа',
  'workbench.docs.body.roadmap.mcp2Suffix':
    ', когда вы размещаете его сами. Без ретранслятора поставщика; ваш агент говорит напрямую с вашей установкой. Вызовы инструментов выполняются с теми же ' +
    'правами на рабочее пространство, что и у вас, — секреты остаются за vault, чувствительные операции включаются явно.',
  'workbench.docs.body.roadmap.serverHeading': 'Локальный / LAN-сервер для синхронизации между устройствами',
  'workbench.docs.body.roadmap.server1':
    'Сервер, который можно запустить на своей машине, в своей локальной сети или на туннелируемом хосте. Расширение, настольное приложение и CLI ' +
    'становятся клиентами одного сервера — одни рабочие пространства, одни правила, один vault на каждом вашем устройстве. ' +
    'Сервер остаётся в локальной сети; сверху нет никакого облачного пути по подписке.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Безголовые скрипты и интеграция с CI. Перечислить правила, переключить окружения, выполнить один сохранённый запрос из ' +
    'оболочки, сравнить рабочее пространство с другим. CLI говорит с тем же сервером, что расширение и настольное приложение, поэтому ' +
    'автоматизация остаётся синхронной с тем, что вы видите в интерфейсе.',
  'workbench.docs.body.roadmap.webAppHeading': 'Самостоятельное развёртывание на ВМ + веб-приложение',
  'workbench.docs.body.roadmap.webApp1':
    'Тот же интерфейс, поставляемый веб-бандлом, который можно раздавать со своего источника. Для закрытых корпоративных браузеров, ' +
    'киосков или любой среды, где установка расширения невозможна, — и для пользователей, которым нужно ' +
    'брендированное развёртывание Open Headers под собственным доменом.',
  'workbench.docs.body.roadmap.importersHeading': 'Импортёры',
  'workbench.docs.body.roadmap.importers1':
    'Рядом с импортёрами cURL / HAR / Postman: коллекции Insomnia, спецификации OpenAPI и полный импорт запросов из HAR ' +
    '(не только заголовков) — всё это уже работает. Паритет импортёров — то, чем Open Headers заслуживает переход людей, ' +
    'уже вложившихся в другой инструмент: перенесите коллекцию за один шаг и продолжайте работать.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'А как насчёт облачного бэкенда?',
  'workbench.docs.body.roadmap.cloudCallout1':
    'Пока не в планах — если вам нужен бэкенд в облаке, разместите его сами на своей ВМ (см. выше).',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Добавить / Заменить',
  'workbench.docs.anchor.override.summary':
    'Задаёт заголовку это значение — добавляется, когда его нет, заменяя любое существующее значение.',
  'workbench.docs.anchor.append.title': 'Добавить в конец',
  'workbench.docs.anchor.append.summary':
    'Добавляет это значение к существующему значению заголовка. Добавление поддерживают только стандартные заголовки-списки — для ' +
    'остальных правило сохраняется как черновик.',
  'workbench.docs.anchor.remove.title': 'Удалить',
  'workbench.docs.anchor.remove.summary':
    'Полностью убирает заголовок из совпавшего трафика; поле значения не используется.',
  'workbench.docs.anchor.merge.title': 'Объединить',
  'workbench.docs.anchor.merge.summary':
    'Объединяет это значение с существующим списком заголовка, пропуская уже присутствующие значения.',
  'workbench.docs.anchor.qpAdd.title': 'Добавить / Заменить',
  'workbench.docs.anchor.qpAdd.summary':
    'Задаёт параметр в URL-адресе — добавляется, когда его нет, заменяется, когда уже есть.',
  'workbench.docs.anchor.qpOverride.title': 'Только заменить',
  'workbench.docs.anchor.qpOverride.summary':
    'Заменяет значение параметра, только когда URL-адрес уже его несёт; URL-адреса без него проходят без изменений.',
  'workbench.docs.anchor.qpRemove.title': 'Удалить',
  'workbench.docs.anchor.qpRemove.summary': 'Удаляет параметр из совпавших URL-адресов.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Удалить все',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Срезает всю строку запроса из совпавших URL-адресов. Другие операции в том же правиле игнорируются, пока она ' +
    'присутствует.',
  'workbench.docs.anchor.urlPattern.title': 'URL-шаблон',
  'workbench.docs.anchor.urlPattern.summary':
    'Сопоставляет URL-адрес запроса с шаблоном urlFilter — подстановочные знаки *, доменные якоря ||, разделители ^.',
  'workbench.docs.anchor.urlRegex.title': 'URL-регулярное выражение',
  'workbench.docs.anchor.urlRegex.summary':
    'Сопоставляет URL-адрес запроса с регулярным выражением; группы захвата питают подстановки \\1, \\2 в целях ' +
    'перенаправления.',
  'workbench.docs.anchor.requestDomains.title': 'Домены запроса',
  'workbench.docs.anchor.requestDomains.summary':
    'Совпадает с запросами, целевой хост которых — один из перечисленных доменов, включая поддомены.',
  'workbench.docs.anchor.excludeDomains.title': 'Исключить домены',
  'workbench.docs.anchor.excludeDomains.summary':
    'Совпадает с каждым запросом, кроме тех, чей целевой хост перечислен.',
  'workbench.docs.anchor.initiatorDomains.title': 'Домены инициатора',
  'workbench.docs.anchor.initiatorDomains.summary':
    'Совпадает по странице, выпустившей запрос, а не по самому URL-адресу запроса. Вариант Искл. обращает ' + 'список.',
  'workbench.docs.anchor.methods.title': 'Методы',
  'workbench.docs.anchor.methods.summary': 'Совпадает по HTTP-методу (GET, POST, …). Вариант Искл. обращает список.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Типы ресурсов',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Совпадает по тому, что загружает браузер — документы, скрипты, XHR/fetch, изображения, … Вариант Искл. обращает ' +
    'список.',
  'workbench.docs.anchor.domainType.title': 'Тип домена',
  'workbench.docs.anchor.domainType.summary':
    'Основной совпадает с запросами к тому же сайту, что и страница; сторонний — с межсайтовыми запросами.',
  'workbench.docs.anchor.headers.title': 'Заголовок ответа',
  'workbench.docs.anchor.headers.summary':
    'Совпадает по заголовку полученного ответа — по наличию или по значению, когда оно задано.',
  'workbench.docs.anchor.redirectRegex.title': 'Подстановка регулярного выражения',
  'workbench.docs.anchor.redirectRegex.summary':
    'С условием «URL-регулярное выражение» \\1, \\2 … вставляют захваченные группы в цель перенаправления.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Динамически (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Выполняет ваш JavaScript для каждого совпавшего запроса, чтобы построить исходящее тело из исходного.',
  'workbench.docs.anchor.responseDynamic.title': 'Динамически (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Выполняет ваш JavaScript для каждого совпавшего ответа — преобразуя настоящий ответ (сеть) или строя его с ' +
    'нуля (имитация).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'Фильтр операций GraphQL',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'Дополнительно ограничивает правило именем операции GraphQL, найденным в полезной нагрузке запроса.',
  'workbench.docs.anchor.responseGraphql.title': 'Фильтр операций GraphQL',
  'workbench.docs.anchor.responseGraphql.summary':
    'Дополнительно ограничивает правило именем операции GraphQL, найденным в полезной нагрузке запроса.',
} as const satisfies Catalog;
