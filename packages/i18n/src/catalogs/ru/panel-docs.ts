/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Russian. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw inside
 * keyed captions; `token` (the filter-grammar noun) translates as токен
 * per the shared ledger. Sandwich fragments keep the en order (the
 * chips read as appositions: токен [domain:], фильтры [method:post] и
 * [method:POST]); a whole-raw prefix (`A`) copies verbatim. Mints:
 * термин = filter term; переключатель совпадения = match toggle;
 * фильтр по свойству = property filter; отрицание = negation; пример
 * захвата = example capture; слово целиком = whole word; учёт регистра
 * = match case; точная фраза = exact phrase.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Панель',
  'panel.docs.nav.filterSyntax.title': 'Синтаксис фильтра',
  'panel.docs.nav.filterSyntax.summary':
    'Текстовые токены, фильтры по свойствам и переключатели совпадения — каждая карточка фильтрует один общий пример захвата.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': 'Фильтр трафика сочетает свободный текст,',
  'panel.docs.filterSyntax.intro1Suffix':
    'фильтры по свойствам и три переключателя совпадения. Термины, разделённые пробелами, должны совпасть ВСЕ ' +
    '(AND), и каждая карточка ниже применяет свой фильтр к одному и тому же примеру захвата из пяти запросов — ' +
    'каждая диаграмма показывает один срез этой картины.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Каждое поле фильтра в панели — Network, Console, Storage, Headers, Cookies, Initiator, Messages — несёт ' +
    'те же три переключателя',
  'panel.docs.filterSyntax.intro2MatchCase': 'учёт регистра',
  'panel.docs.filterSyntax.intro2WholeWord': 'слово целиком',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'и кнопку',
  'panel.docs.filterSyntax.intro2Suffix': ', которая очищает текст.',
  'panel.docs.filterSyntax.intro2Kbd': 'Клавиатура:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'переключают их, пока поле в фокусе.',

  'panel.docs.filterSyntax.headingText': 'Текстовые фильтры',
  'panel.docs.filterExample.captureHeading': 'Пример захвата',
  'panel.docs.filterSyntax.headingProperty': 'Фильтры по свойствам',
  'panel.docs.filterSyntax.headingToggles': 'Переключатели совпадения',
  'panel.docs.filterSyntax.headingElsewhere': 'Везде остальное',

  'panel.docs.filterSyntax.textTitle': 'Текст',
  'panel.docs.filterSyntax.text1':
    'Простой термин оставляет каждый запрос, чей URL-адрес его содержит. Несколько терминов объединяются по AND — ' +
    'запрос должен содержать их все, в любом месте.',
  'panel.docs.filterSyntax.textCaption':
    'Два термина — выживает только запрос, чей URL-адрес содержит и «api», и «users».',

  'panel.docs.filterSyntax.negationTitle': 'Отрицание',
  'panel.docs.filterSyntax.negation1Prefix': 'Ведущий',
  'panel.docs.filterSyntax.negation1Middle': 'инвертирует любой токен:',
  'panel.docs.filterSyntax.negation1Middle2':
    'скрывает совпавшие запросы вместо того, чтобы оставлять их. Работает и с фильтрами по свойствам —',
  'panel.docs.filterSyntax.negationCaption': 'Остаётся всё, КРОМЕ запросов, совпавших с отрицаемым термином.',

  'panel.docs.filterSyntax.phraseTitle': 'Точная фраза',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Кавычки делают один токен из текста с пробелами и сохраняют такие символы, как',
  'panel.docs.filterSyntax.phrase1Or': 'или',
  'panel.docs.filterSyntax.phrase1Suffix': ', буквально — удобно для строк запроса.',
  'panel.docs.filterSyntax.phraseCaption': 'Фраза в кавычках совпадает как один непрерывный фрагмент URL-адреса.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '— такой токен проверяет один атрибут запроса вместо всего URL-адреса. Фильтры по свойствам сочетаются ' +
    'с текстовыми токенами и друг с другом — совпасть должны все.',

  'panel.docs.filterSyntax.domainTitle': 'Домен',
  'panel.docs.filterSyntax.domain1Prefix':
    'Сопоставляет имя хоста по подстроке, поэтому корневой домен ловит каждый поддомен —',
  'panel.docs.filterSyntax.domain1Suffix': '— без подстановочных знаков.',
  'panel.docs.filterSyntax.domainCaption':
    'Одно значение покрывает каждый поддомен openheaders.com; сторонний хост мимо.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Код статуса',
  'panel.docs.filterSyntax.statusCode1':
    'Оставляет запросы, чей ответ нёс ровно этот код. У ожидающих и неудачных запросов кода нет, ' +
    'поэтому они никогда не совпадают.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Выживает только 404 — точный код, а не диапазон.',

  'panel.docs.filterSyntax.methodTitle': 'Метод',
  'panel.docs.filterSyntax.method1Prefix': 'Оставляет запросы с этим HTTP-методом, сравнивая без учёта регистра —',
  'panel.docs.filterSyntax.method1And': 'и',
  'panel.docs.filterSyntax.method1Suffix': '— один и тот же фильтр.',
  'panel.docs.filterSyntax.methodCaption': 'Выживает только POST.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME-тип',
  'panel.docs.filterSyntax.mime1Prefix': 'Сопоставляет тип содержимого ответа по подстроке —',
  'panel.docs.filterSyntax.mime1Catches': 'ловит',
  'panel.docs.filterSyntax.mime1Suffix': 'ловит все форматы изображений.',
  'panel.docs.filterSyntax.mimeCaption': 'Выживают оба JSON-ответа; скрипты, шрифты и изображения мимо.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Заголовок ответа',
  'panel.docs.filterSyntax.respHeader1Prefix':
    'Оставляет запросы, чей ответ несёт заголовок ровно с этим именем — значение не важно. Удобно, чтобы ' +
    'заметить поведение кеша CDN',
  'panel.docs.filterSyntax.respHeader1Suffix': 'или отсутствующие заголовки безопасности (с отрицанием).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Заголовок x-cache несёт только ответ CDN.',

  'panel.docs.filterSyntax.largerThanTitle': 'Больше чем',
  'panel.docs.filterSyntax.largerThan1': 'Оставляет запросы, передавшие больше N байт. Суффиксы масштабируют число:',
  'panel.docs.filterSyntax.largerThanCaption': 'Порог 100k преодолевает только бандл на 128 kB.',

  'panel.docs.filterSyntax.fromCacheTitle': 'Из кеша',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Оставляет ответы, которые браузер отдал из кеша — ответ',
  'panel.docs.filterSyntax.fromCache1Middle':
    'или попадание в дисковый / memory-кеш, которое не касалось сети. Добавьте отрицание',
  'panel.docs.filterSyntax.fromCache1Suffix': ', чтобы видеть только то, что действительно ушло в сеть.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Выживает только кешированный пиксель отслеживания.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'Три кнопки внутри поля меняют способ сравнения текстовых токенов. Они действуют на свободный текст (и ' +
    'на токены вида',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'на вкладках деталей);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'и остальные фильтры по свойствам сохраняют свою семантику.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Учёт регистра',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Когда выключено (по умолчанию),',
  'panel.docs.filterSyntax.matchCase1And': 'и',
  'panel.docs.filterSyntax.matchCase1Suffix':
    '— один и тот же фильтр. Когда включено, термин должен совпасть с точным регистром URL-адреса.',
  'panel.docs.filterSyntax.matchCaseCaption':
    'С включённым Aa «Users» не совпадает ни с чем — каждый URL-адрес в захвате в нижнем регистре.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Слово целиком',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'Термин совпадает только на границах слов —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'и подобные символы считаются границами. Пригодится, когда короткий термин прячется внутри длинных слов.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '«user» больше не совпадает внутри «users» — с выключенным ab запрос #7 совпал бы.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    'Весь ввод становится одним регулярным выражением, которое проверяется по URL-адресу — токены свойств ' +
    'в этом режиме не разбираются. Шаблон, который не компилируется, окрашивает поле в красный и ничего не скрывает.',
  'panel.docs.filterSyntax.regexCaption': 'Один шаблон, два типа файлов: URL-адреса, оканчивающиеся на .js или .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Другие поля фильтра',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'Вкладки деталей несут то же поле со своими ключами свойств; переключатели и отрицание через',
  'panel.docs.filterSyntax.otherIntroSuffix': 'работают в каждой одинаково:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'простой текст с тремя переключателями; Storage к тому же считает совпадения по разделам на своей ' +
    'навигационной рейке, пока вы печатаете.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'простой текст (или regex под',
  'panel.docs.filterSyntax.otherSearchMiddle': ') с тремя переключателями, отправляется по Enter. Чипы',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'выбирают, какие данные он просматривает — хотя бы один остаётся выбранным, — и каждый результат ' +
    'открывает свой источник: вкладку запроса, раздел хранилища или Console.',
} as const satisfies Catalog;
