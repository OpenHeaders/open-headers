/**
 * Workbench editors — the GraphQL client editor — Russian. Mirrors
 * `catalogs/en/workbench-editors-graphql.ts` key for key. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}`
 * envelope names, SDL, introspection, `Query` / `Subscription` tab
 * and pane nouns, `extensions`, `Docs`) rides raw inside keyed values.
 * схема = schema; обозреватель схемы = schema explorer; переменные =
 * variables; интроспекция = introspection; подписка = subscription
 * (prose; the pane title stays the raw `Subscription`); документ = the
 * GraphQL document (S19 separate referent beside Docs = the raw tab
 * noun); конструктор = builder; фрагмент = GraphQL fragment
 * (context-partitioned from the merge-editor hunk — the GraphQL ru
 * docs' own term); Авторизация / Заголовки / Скрипты / Настройки /
 * Схема = the editor tab family (the ko S102 TAB-NOUN DECISION twin;
 * Docs / Query stay raw); спецификация = spec carried; операция =
 * operation. Every raw token takes a head noun or a hyphenated
 * apposition (статус HTTP {status}, список errors[], значение data).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'Запрос GraphQL не найден.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Остановить',
  'workbench.editors.graphql.query.stopTooltip': 'Остановить запрос и оставить то, что уже пришло',
  'workbench.editors.graphql.operation.placeholder': 'Операция',
  'workbench.editors.graphql.operation.tooltip':
    'Операция, которую выполняет этот Query — документ содержит несколько; выбор уходит в сеть как operationName.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} ошибка',
      few: '{count} ошибки',
      many: '{count} ошибок',
      other: '{count} ошибок',
    }),
  'workbench.editors.graphql.response.errorsTitle': 'Ошибки GraphQL',
  'workbench.editors.graphql.response.errorsSummary':
    'Сервер ответил статусом HTTP {status} со списком errors[] — поле не удалось, документ отклонён или не хватило авторизации. Смотрите значение data рядом: частичное или null.',
  'workbench.editors.graphql.response.dataNull':
    'Значение data — null: каждое корневое поле завершилось ошибкой, или запрос был отклонён до выполнения.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Расширения ответа',
  'workbench.editors.graphql.response.extensionsSummary':
    'Объект extensions сервера идёт рядом с data — трассировка, стоимость, подсказки кеша, что бы сервер ни решил приложить.',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Авторизация',
  'workbench.editors.graphql.tab.headers': 'Заголовки',
  'workbench.editors.graphql.tab.schema': 'Схема',
  'workbench.editors.graphql.tab.scripts': 'Скрипты',
  'workbench.editors.graphql.tab.settings': 'Настройки',
  'workbench.editors.graphql.explorer.emptyTitle': 'Изучите данные, доступные на сервере',
  'workbench.editors.graphql.explorer.emptyHint':
    'Введите URL-адрес сервера, чтобы загрузить схему через интроспекцию.',
  'workbench.editors.graphql.explorer.introspect': 'Использовать интроспекцию GraphQL',
  'workbench.editors.graphql.explorer.loadFailed': 'Не удалось загрузить схему GraphQL.',
  'workbench.editors.graphql.explorer.tryAgain': 'Повторить',
  'workbench.editors.graphql.explorer.useSpec': 'Использовать спецификацию GraphQL',
  'workbench.editors.graphql.explorer.importSchema': 'Импортировать схему GraphQL',
  'workbench.editors.graphql.variables.title': 'Переменные',
  'workbench.editors.graphql.variables.generate': 'Сгенерировать переменные',
  'workbench.editors.graphql.variables.generateHint':
    'Заполнить переменные из объявлений переменных выбранной операции.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'Выбранная операция не объявляет переменных.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Каждая операция GraphQL отправляет оболочку {query, variables, operationName} как JSON. Добавьте собственную строку Content-Type, чтобы переопределить.',
  'workbench.editors.graphql.schema.sourceLabel': 'Источник схемы',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Выберите источник схемы',
  'workbench.editors.graphql.schema.or': 'ИЛИ',
  'workbench.editors.graphql.schema.hint':
    'Схема питает обозреватель, автодополнение и проверку — получена интроспекцией с сервера через авторизацию и настройки этого запроса, привязана из спецификации GraphQL или импортирована из файла SDL или интроспекции.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Перед запросом',
  'workbench.editors.graphql.scripts.afterResponse': 'После ответа',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Этот запрос GraphQL был удалён в другой вкладке.',
  'workbench.editors.graphql.toast.updateFailed': 'Не удалось сохранить запрос GraphQL',
  'workbench.editors.graphql.toast.updateFailedDetail': 'Не удалось сохранить запрос GraphQL: {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Сначала введите URL-адрес конечной точки.',
  'workbench.editors.graphql.explorer.introspecting': 'Интроспекция…',
  'workbench.editors.graphql.explorer.search': 'Поиск типов и полей',
  'workbench.editors.graphql.explorer.noResults': 'Ничего не совпадает с «{term}».',
  'workbench.editors.graphql.explorer.back': 'Назад',
  'workbench.editors.graphql.explorer.fields': 'Поля',
  'workbench.editors.graphql.explorer.arguments': 'Аргументы',
  'workbench.editors.graphql.explorer.values': 'Значения',
  'workbench.editors.graphql.explorer.inputFields': 'Входные поля',
  'workbench.editors.graphql.explorer.implements': 'Реализует',
  'workbench.editors.graphql.explorer.possibleTypes': 'Возможные типы',
  'workbench.editors.graphql.explorer.returns': 'Возвращает',
  'workbench.editors.graphql.explorer.specifiedBy': 'Определено в',
  'workbench.editors.graphql.explorer.deprecated': 'Устарело: {reason}',
  'workbench.editors.graphql.explorer.insert': 'Вставить в позицию курсора',
  'workbench.editors.graphql.explorer.insertHint':
    'Добавляет поле в документ в позицию курсора — обязательные аргументы как переменные, пустой набор выборки, если возвращается объект. В одну сторону: документ остаётся вашим.',
  'workbench.editors.graphql.schema.source.introspection': 'Интроспекция GraphQL',
  'workbench.editors.graphql.schema.source.spec': 'Привязанная спецификация GraphQL',
  'workbench.editors.graphql.schema.refresh': 'Обновить',
  'workbench.editors.graphql.schema.fetchedAt': 'Интроспекция выполнена {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Интроспекция ещё не выполнялась — схема загружается с конечной точки через авторизацию, заголовки и настройки этого запроса.',
  'workbench.editors.graphql.schema.introspectFailed': 'Интроспекция не удалась: {message}',
  'workbench.editors.graphql.schema.noSpecLinked': 'Спецификация GraphQL не привязана.',
  'workbench.editors.graphql.schema.linkInSpecTab': 'Привяжите её на вкладке «Спецификация»',
  'workbench.editors.graphql.schema.changeInSpecTab': 'Изменить на вкладке «Спецификация»',
  'workbench.editors.graphql.schema.specMissing': 'Привязанной спецификации больше нет в этом рабочем пространстве.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} тип',
      few: '{count} типа',
      many: '{count} типов',
      other: '{count} типов',
    }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} проблема со схемой',
      few: '{count} проблемы со схемой',
      many: '{count} проблем со схемой',
      other: '{count} проблем со схемой',
    }),
  'workbench.editors.graphql.schema.importReadFailed': 'Не удалось прочитать файл: {message}',
  'workbench.editors.graphql.schema.importFailed': 'Не удалось импортировать схему',
  'workbench.editors.graphql.schema.imported': 'Файл «{name}» импортирован как спецификация GraphQL и привязан.',
  'workbench.editors.graphql.spec.selectLabel': 'Спецификация GraphQL',
  'workbench.editors.graphql.spec.selectPlaceholder': 'Привязать спецификацию GraphQL…',
  'workbench.editors.graphql.spec.none': 'К этому запросу не привязана спецификация GraphQL.',
  'workbench.editors.graphql.spec.hint':
    'Привязанная спецификация — источник схемы этого запроса; обозреватель, автодополнение и проверка читают её. Внутри коллекции, созданной из спецификации, запрос читает привязку коллекции, пока не привяжет собственную.',
  'workbench.editors.graphql.explorer.title': 'Обозреватель схемы',
  'workbench.editors.graphql.explorer.hide': 'Скрыть обозреватель',
  'workbench.editors.graphql.explorer.show': 'Показать обозреватель',
  'workbench.editors.graphql.explorer.showDescriptions': 'Показывать описания',
  'workbench.editors.graphql.explorer.hideDescriptions': 'Скрывать описания',
  'workbench.editors.graphql.builder.broken': 'Исправьте документ, чтобы использовать конструктор — он не разбирается.',
  'workbench.editors.graphql.builder.expand': 'Развернуть',
  'workbench.editors.graphql.builder.collapse': 'Свернуть',
  'workbench.editors.graphql.builder.fragmentReadOnly': 'Фрагменты здесь только для чтения — правьте их в документе.',
  'workbench.editors.graphql.builder.argumentPlaceholder': 'значение или $variable',
  'workbench.editors.graphql.builder.invalidValue': 'Не является значением GraphQL.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} проблема',
      few: '{count} проблемы',
      many: '{count} проблем',
      other: '{count} проблем',
    }),
  // ── Subscriptions (graphql-transport-ws over the WebSocket plane) ──
  'workbench.editors.graphql.subscription.tooltip':
    'Подписаться — открывает подписку через WebSocket (graphql-transport-ws) и передаёт её события потоком',
  'workbench.editors.graphql.subscription.stopTooltip': 'Остановить подписку — отправляет complete и закрывает сеанс',
  'workbench.editors.graphql.subscription.openFailed': 'Не удалось открыть подписку',
  'workbench.editors.graphql.subscription.paneTitle': 'Subscription',
  'workbench.editors.graphql.subscription.subscribing': 'Подписка…',
  'workbench.editors.graphql.subscription.subscribed': 'Подписка оформлена',
  'workbench.editors.graphql.subscription.completed': 'Завершена',
  'workbench.editors.graphql.subscription.stopped': 'Остановлена',
  'workbench.editors.graphql.subscription.errored': 'Ошибка',
  'workbench.editors.graphql.subscription.closed': 'Закрыто {code}',
  'workbench.editors.graphql.subscription.events': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} событие',
      few: '{count} события',
      many: '{count} событий',
      other: '{count} событий',
    }),
  'workbench.editors.graphql.subscription.errorsSummary':
    'Подписка ответила списком errors[] — поле не удалось в событии, или операция была отклонена до начала.',
  'workbench.editors.graphql.subscription.close.badRequest': 'Некорректный запрос',
  'workbench.editors.graphql.subscription.close.unauthorized': 'Не авторизовано',
  'workbench.editors.graphql.subscription.close.forbidden': 'Запрещено',
  'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable': 'Подпротокол не принят',
  'workbench.editors.graphql.subscription.close.connectionInitTimeout': 'Тайм-аут инициализации соединения',
  'workbench.editors.graphql.subscription.close.subscriberAlreadyExists': 'Подписчик уже существует',
  'workbench.editors.graphql.subscription.close.tooManyInitRequests': 'Слишком много запросов инициализации',
} as const satisfies Catalog;
