/**
 * Workbench editors — the API spec editor — Russian. Mirrors
 * `catalogs/en/workbench-editors-spec.ts` key for key. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto `package` /
 * `import` / `service` / `message` / `enum`) and ride raw; `Files` is
 * app grouping and translates (Файлы). The AsyncAPI Send/Receive
 * badges mirror the document's `action` enum and stay raw — a
 * different referent from the Send button mint Отправить. `ROOT` badge
 * raw; `baseUrl` verbatim as a bare variable name (never compounded).
 * Field chips translate per the de/es parity lock (имя / описание /
 * заголовки / параметры / тело) with `auth` riding raw as the code-ish
 * field id. спецификация = spec; коллекция = collection; Обзор = the
 * Overview pane title (the outline). MINTS: streaming modes унарный /
 * серверная потоковая передача / клиентская потоковая передача /
 * двунаправленная потоковая передача — editors-grpc ru reuses; файл
 * Root = Root file (Root raw); синхронизировано = in sync;
 * расхождение = the drift / differences.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Спецификация не найдена.',
  'workbench.editors.spec.deletedElsewhere': 'Эта спецификация была удалена в другом сеансе.',
  'workbench.editors.spec.saveFailed': 'Не удалось сохранить спецификацию.',
  'workbench.editors.spec.validation.clean': 'Проблем не найдено',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} ошибка',
      few: '{count} ошибки',
      many: '{count} ошибок',
      other: '{count} ошибок',
    }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} предупреждение',
      few: '{count} предупреждения',
      many: '{count} предупреждений',
      other: '{count} предупреждений',
    }),
  'workbench.editors.spec.outline.title': 'Обзор',
  'workbench.editors.spec.outline.show': 'Показать обзор',
  'workbench.editors.spec.outline.hide': 'Скрыть обзор',
  'workbench.editors.spec.outline.empty': 'Структура появится, как только документ разберётся.',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Пометить как файл Root',
  'workbench.editors.spec.outline.fileMenuAria': 'Действия с файлом',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.query': 'Query',
  'workbench.editors.spec.outline.groups.mutation': 'Mutation',
  'workbench.editors.spec.outline.groups.subscription': 'Subscription',
  'workbench.editors.spec.outline.groups.types': 'Types',
  'workbench.editors.spec.outline.groups.interfaces': 'Interfaces',
  'workbench.editors.spec.outline.groups.unions': 'Unions',
  'workbench.editors.spec.outline.groups.inputs': 'Inputs',
  'workbench.editors.spec.outline.groups.scalars': 'Scalars',
  'workbench.editors.spec.outline.groups.directives': 'Directives',
  'workbench.editors.spec.outline.groups.files': 'Файлы',
  'workbench.editors.spec.outline.streaming.unary': 'Унарный',
  'workbench.editors.spec.outline.streaming.server': 'Серверная потоковая передача',
  'workbench.editors.spec.outline.streaming.client': 'Клиентская потоковая передача',
  'workbench.editors.spec.outline.streaming.bidi': 'Двунаправленная потоковая передача',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Добавить сервер',
  'workbench.editors.spec.outline.add.tag': 'Добавить тег',
  'workbench.editors.spec.outline.add.path': 'Добавить путь',
  'workbench.editors.spec.outline.add.operation': 'Добавить операцию',
  'workbench.editors.spec.outline.add.schema': 'Добавить схему',
  'workbench.editors.spec.outline.add.securityScheme': 'Добавить схему безопасности',
  'workbench.editors.spec.outline.add.securityRequirement': 'Добавить требование безопасности',
  'workbench.editors.spec.generate.button': 'Сгенерировать коллекцию',
  'workbench.editors.spec.generate.collectionsButton': 'Коллекции',
  'workbench.editors.spec.generate.popoverTitle': 'Сгенерированные коллекции',
  'workbench.editors.spec.generate.modalTitle': 'ГЕНЕРАЦИЯ КОЛЛЕКЦИИ',
  'workbench.editors.spec.generate.blurb':
    'Сгенерировать коллекцию из этой спецификации. Операции становятся запросами под переменной коллекции baseUrl, теги — папками, а схемы безопасности отображаются на авторизацию. Коллекция остаётся привязанной к этой спецификации.',
  'workbench.editors.spec.generate.namePlaceholder': 'Имя коллекции',
  'workbench.editors.spec.generate.nameRequired': 'Коллекции нужно имя',
  'workbench.editors.spec.generate.dirtyHint':
    'Несохранённые правки редактора не учитываются — генерация использует последний сохранённый документ.',
  'workbench.editors.spec.generate.parseFailed': 'Эта спецификация не разбирается',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} папка',
      few: '{count} папки',
      many: '{count} папок',
      other: '{count} папок',
    }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} переменная коллекции',
      few: '{count} переменные коллекции',
      many: '{count} переменных коллекции',
      other: '{count} переменных коллекции',
    }),
  'workbench.editors.spec.generate.action': 'Сгенерировать',
  'workbench.editors.spec.generate.success': 'Сгенерировано «{name}» — {summary}',
  'workbench.editors.spec.generate.failed': 'Не удалось создать коллекцию.',
  'workbench.editors.spec.generate.linkFailed':
    'Коллекция сгенерирована, но записать её привязку к спецификации не удалось — в этом списке она не появится.',
  'workbench.editors.spec.generateProto.blurb':
    'Сгенерировать коллекцию из этой спецификации. Методы сервисов становятся запросами gRPC с заранее заполненными примерами сообщений, сгруппированными по папке на каждый сервис. Коллекция остаётся привязанной к этой спецификации.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос gRPC',
      few: '{count} запроса gRPC',
      many: '{count} запросов gRPC',
      other: '{count} запросов gRPC',
    }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сервис',
      few: '{count} сервиса',
      many: '{count} сервисов',
      other: '{count} сервисов',
    }),
  'workbench.editors.spec.generateProto.empty':
    'Документ не объявляет методов сервисов, из которых можно генерировать.',
  'workbench.editors.spec.generateProto.partial':
    'Сгенерировано с пропусками — создано: {created}, с ошибкой: {failed}.',
  'workbench.editors.spec.generateWs.blurb':
    'Сгенерировать коллекцию из этой спецификации. Операции становятся запросами WebSocket к серверу ws/wss документа или запросами MQTT к его серверу mqtt, с примером сообщения, заранее заполненным из схемы канала. Коллекция остаётся привязанной к этой спецификации.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос WebSocket',
      few: '{count} запроса WebSocket',
      many: '{count} запросов WebSocket',
      other: '{count} запросов WebSocket',
    }),
  'workbench.editors.spec.generateWs.mqttRequestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос MQTT',
      few: '{count} запроса MQTT',
      many: '{count} запросов MQTT',
      other: '{count} запросов MQTT',
    }),
  'workbench.editors.spec.generateWs.empty': 'Документ не объявляет операций, из которых можно генерировать.',
  'workbench.editors.spec.generateWs.noServer':
    'Документ не объявляет сервера ws, wss или mqtt, к которому можно подключиться.',
  'workbench.editors.spec.generateWs.partial': 'Сгенерировано с пропусками — создано: {created}, с ошибкой: {failed}.',
  'workbench.editors.spec.generateWs.skipped': 'Пропущено {operation}: {reason}.',
  'workbench.editors.spec.generateGraphql.blurb':
    'Сгенерировать коллекцию из этой схемы. Корневые поля Query и Mutation становятся запросами GraphQL с заранее заполненными документом и примерами переменных, сгруппированными по папке на каждый корневой тип, если есть оба; поля подписок не включаются. Коллекция остаётся привязанной к этой спецификации.',
  'workbench.editors.spec.generateGraphql.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос GraphQL',
      few: '{count} запроса GraphQL',
      many: '{count} запросов GraphQL',
      other: '{count} запросов GraphQL',
    }),
  'workbench.editors.spec.generateGraphql.empty':
    'Схема не объявляет полей Query или Mutation, из которых можно генерировать.',
  'workbench.editors.spec.generateGraphql.partial':
    'Сгенерировано с пропусками — создано: {created}, с ошибкой: {failed}.',
  'workbench.editors.spec.generateGraphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.spec.generateGraphql.urlHint':
    'Каждый сгенерированный запрос нацелен на эту конечную точку; оставьте пустым, чтобы заполнить URL-адрес позже.',
  'workbench.editors.spec.generateGraphql.subscriptionsSkipped': ({ count, fields }, locale) =>
    `${plural(locale, Number(count), {
      one: 'Не включено {count} поле подписки',
      few: 'Не включены {count} поля подписки',
      many: 'Не включено {count} полей подписки',
      other: 'Не включено {count} полей подписки',
    })} (${fields}) — подписки не поддерживаются.`,
  'workbench.editors.spec.generateGraphql.problem': 'Проблема со схемой: {message}',
  'workbench.editors.spec.update.button': 'Обновить',
  'workbench.editors.spec.update.protoUnavailable':
    'Обновление из спецификации Protobuf пока недоступно — сгенерируйте новую коллекцию, чтобы подхватить изменения.',
  'workbench.editors.spec.update.graphqlUnavailable':
    'Обновление из схемы GraphQL пока недоступно — сгенерируйте новую коллекцию, чтобы подхватить изменения.',
  'workbench.editors.spec.update.inSyncBadge': 'Синхронизировано с сохранённым документом',
  'workbench.editors.spec.update.driftedBadge': 'Спецификация изменилась с последнего обновления',
  'workbench.editors.spec.update.modalTitle': 'ОБНОВЛЕНИЕ КОЛЛЕКЦИИ',
  'workbench.editors.spec.update.blurb':
    'Просмотрите расхождения между сохранённым документом и «{name}», затем примените выбранные обновления. Неотмеченные строки остаются нетронутыми.',
  'workbench.editors.spec.update.dirtyHint':
    'Несохранённые правки редактора не учитываются — обновление использует последний сохранённый документ.',
  'workbench.editors.spec.update.parseFailed': 'Эта спецификация не разбирается',
  'workbench.editors.spec.update.inSync':
    'Расхождений на уровне запросов нет — применение пометит коллекцию как синхронизированную с сохранённым документом.',
  'workbench.editors.spec.update.groupAdded': 'Добавлено ({count})',
  'workbench.editors.spec.update.groupChanged': 'Изменено ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Удалено из спецификации ({count})',
  'workbench.editors.spec.update.removeHint': 'Неотмеченные запросы остаются в коллекции.',
  'workbench.editors.spec.update.groupCollection': 'Коллекция',
  'workbench.editors.spec.update.variablesRow': 'Переменные коллекции',
  'workbench.editors.spec.update.authRow': 'Авторизация коллекции',
  'workbench.editors.spec.update.field.name': 'имя',
  'workbench.editors.spec.update.field.description': 'описание',
  'workbench.editors.spec.update.field.headers': 'заголовки',
  'workbench.editors.spec.update.field.params': 'параметры',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'тело',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Применить {count} обновление',
      few: 'Применить {count} обновления',
      many: 'Применить {count} обновлений',
      other: 'Применить {count} обновлений',
    }),
  'workbench.editors.spec.update.markInSync': 'Пометить как синхронизированную',
  'workbench.editors.spec.update.hashNote':
    'Применение записывает эту версию документа в привязку коллекции, так что привязка читается как синхронизированная, даже если строки остались неотмеченными.',
  'workbench.editors.spec.update.success': 'Обновлено «{name}» — применено: {count}',
  'workbench.editors.spec.update.partial':
    'Применено: {applied}, с ошибкой: {failed} — коллекция может быть обновлена частично.',
  'workbench.editors.spec.update.failed': 'Не удалось обновить коллекцию.',
} as const satisfies Catalog;
