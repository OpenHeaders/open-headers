/**
 * Workbench editors — gRPC client + gRPC response examples — Russian.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key. Raw by
 * design: gRPC status-code names (OK, CANCELLED, …) with their
 * lead-ins rendered as Код состояния N NAME, rpc/service identifiers
 * ({rpc}), Protobuf / `.proto` / TLS / SSL / lowercase `base64`
 * vocabulary, `host:port` and `authorization: Bearer <token>` wire
 * syntax, `Metadata` / `Trailers` tab nouns kept as the gRPC protocol
 * terms, `Docs` / `Streaming` / `Authority` raw, and the {count} /
 * {ms} / {bytes} / {name} / {message} holes. Settings tab =
 * Настройки; Сообщение = the Message tab; хронология = timeline; фрейм
 * = frame; streaming modes reuse the editors-spec mints (унарный /
 * потоковая передача); Авторизация / Заголовки family tab nouns per
 * editors-websocket; the TLS scalar twins (Имя сервера SNI /
 * Клиентский сертификат / Сокет Unix) per shared-conflicts. MINTS:
 * вызов = invoke / the call (Вызвать = the Invoke button); предел =
 * capped at (byte cap, carried); keepalive-пинг = keepalive ping;
 * дедлайн = deadline (the gRPC ru term); Доверять сертификату = trust
 * certificate; метаданные = metadata prose; трейлеры = trailers prose.
 * Every raw token takes a head noun or a hyphenated apposition (режим
 * TLS, фрейм HTTP/2 PING, JSON-формат).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'Запрос gRPC не найден.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (например, grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS включён — нажмите, чтобы переключиться на открытый текст',
  'workbench.editors.grpc.tls.off': 'TLS выключен (открытый текст) — нажмите, чтобы переключиться на TLS',
  'workbench.editors.grpc.method.placeholder': 'Выберите метод',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Привяжите спецификацию Protobuf, чтобы выбрать метод',
  'workbench.editors.grpc.method.unresolvedGroup': 'Нет в привязанной спецификации',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (не разрешён)',
  'workbench.editors.grpc.method.linkGroup': 'Привязать спецификацию Protobuf',
  'workbench.editors.grpc.method.importProto': 'Импортировать файл .proto…',
  'workbench.editors.grpc.invoke.label': 'Вызвать',
  'workbench.editors.grpc.invoke.stop': 'Остановить',
  'workbench.editors.grpc.invoke.needsMethod':
    'Для вызова выберите метод, который разрешается по привязанной спецификации',
  'workbench.editors.grpc.invoke.needsUrl': 'Для вызова введите целевой хост',
  'workbench.editors.grpc.invoke.failed': 'Вызов не удался — хост не ответил на вызов',
  'workbench.editors.grpc.response.title': 'Ответ',
  'workbench.editors.grpc.response.empty.prompt': 'Вызовите метод, чтобы получить ответ.',
  'workbench.editors.grpc.response.empty.invoking': 'Вызов…',
  'workbench.editors.grpc.status.kicker': 'Статус gRPC',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, verbatim, so the pill popover reads exactly like the
  // protocol documentation.
  'workbench.editors.grpc.status.desc.unknownCode': 'Нестандартный код состояния вне словаря gRPC.',
  'workbench.editors.grpc.status.desc.OK': 'Код состояния 0 OK — стандартный ответ при успешном вызове метода gRPC.',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'Код состояния 1 CANCELLED возвращается, если операция отменена вызывающей стороной.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'Код состояния 2 UNKNOWN возвращается, если операцию не удалось завершить из-за неизвестной ошибки. Например, эта ошибка может возвращаться, когда значение Status, полученное из другого адресного пространства, принадлежит пространству ошибок, неизвестному в этом адресном пространстве. Также в эту ошибку могут преобразовываться ошибки API, которые не возвращают достаточно сведений об ошибке.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'Код состояния 3 INVALID_ARGUMENT возвращается, если клиент указал недопустимый аргумент. Это аргументы, проблемные независимо от состояния системы (например, неправильно сформированное имя файла).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'Код состояния 4 DEADLINE_EXCEEDED возвращается, если дедлайн истёк до завершения операции. Для операций, меняющих состояние системы, эта ошибка может возвращаться, даже если операция завершилась успешно. Например, успешный ответ сервера мог сильно задержаться.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'Код состояния 5 NOT_FOUND возвращается, если запрошенная сущность (например, файл или каталог) не найдена.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'Код состояния 6 ALREADY_EXISTS возвращается, если сущность, которую вы пытались создать (например, файл или каталог), уже существует.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'Код состояния 7 PERMISSION_DENIED возвращается, если у вызывающей стороны нет разрешения на выполнение указанной операции. Этот код ошибки не означает, что запрос допустим, что запрошенная сущность существует или что выполнены другие предусловия.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'Код состояния 8 RESOURCE_EXHAUSTED возвращается, если исчерпана квота пользователя или, возможно, закончилось место во всей файловой системе.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'Код состояния 9 FAILED_PRECONDITION возвращается, если операция отклонена, потому что система не находится в состоянии, необходимом для её выполнения. Например, удаляемый каталог не пуст, операция rmdir применена не к каталогу и т. п.',
  'workbench.editors.grpc.status.desc.ABORTED':
    'Код состояния 10 ABORTED возвращается, если операция прервана, обычно из-за проблемы параллелизма — например, сбоя проверки последовательности или отмены транзакции.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'Код состояния 11 OUT_OF_RANGE возвращается, если операция выполнялась за пределами допустимого диапазона. Например, позиционирование или чтение за концом файла.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'Код состояния 12 UNIMPLEMENTED возвращается, если операция не реализована либо не поддерживается или не включена в этом сервисе.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'Код состояния 13 INTERNAL возвращается при внутренней ошибке. Это значит, что нарушены некоторые инварианты, ожидаемые нижележащей системой.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'Код состояния 14 UNAVAILABLE возвращается, если сервис сейчас недоступен.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'Код состояния 15 DATA_LOSS возвращается при невосстановимой потере или повреждении данных.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'Код состояния 16 UNAUTHENTICATED возвращается, если у запроса нет действительных учётных данных аутентификации для операции.',
  'workbench.editors.grpc.response.error.title': 'Вызов не удался',
  'workbench.editors.grpc.response.error.localGuidance':
    'Вызов так и не получил ответа. Проверьте цель, режим TLS и доступность сервера.',
  'workbench.editors.grpc.response.error.statusGuidance': 'Проверьте сообщение и вызовите метод снова.',
  'workbench.editors.grpc.response.tab.response': 'Ответ',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Фильтр метаданных',
  'workbench.editors.grpc.response.filterTrailers': 'Фильтр трейлеров',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'Нет статуса gRPC',
  'workbench.editors.grpc.response.connectionLost': 'Соединение потеряно',
  'workbench.editors.grpc.response.includeDefaultValues': 'Включать значения по умолчанию',
  'workbench.editors.grpc.response.noMessage': 'Ответ не содержал сообщения.',
  'workbench.editors.grpc.response.noMetadata': 'Метаданных нет',
  'workbench.editors.grpc.response.noTrailers': 'Трейлеров нет',
  'workbench.editors.grpc.response.trailersOnly':
    'Ответ только из трейлеров — статус пришёл вместе с начальными метаданными, сообщения не последовало.',
  'workbench.editors.grpc.response.compressed':
    'Фрейм ответа сжат — сжатие не согласовано, поэтому декодировать его нельзя.',
  'workbench.editors.grpc.response.structuralNotice':
    'Структурное декодирование (номера полей) — тип ответа не разрешился по привязанной спецификации.',
  'workbench.editors.grpc.response.rawNotice': 'Сообщение не декодировалось; исходные байты показаны как base64.',
  'workbench.editors.grpc.response.extraFrames':
    'Пришло {count} фреймов сообщений — унарный ответ несёт один; показан первый.',
  'workbench.editors.grpc.response.incompleteTail': 'Ответ оборвался посреди фрейма; показаны полные фреймы.',
  'workbench.editors.grpc.response.truncated': 'Ответ ограничен {bytes} байтами.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Сообщение',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.scripts': 'Скрипты',
  'workbench.editors.grpc.tab.settings': 'Настройки',
  'workbench.editors.grpc.messagePlaceholder': 'Сообщение запроса в формате JSON',
  'workbench.editors.grpc.example.label': 'Использовать пример сообщения',
  'workbench.editors.grpc.example.needsMethod':
    'Сначала выберите метод, который разрешается по привязанной спецификации',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Ключ',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Значение',
  'workbench.editors.grpc.spec.selectLabel': 'Спецификация Protobuf',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Привязать спецификацию Protobuf…',
  'workbench.editors.grpc.spec.summary': 'сервисов: {services} · методов: {methods}',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'Не удалось прочитать файл: {message}',
  'workbench.editors.grpc.spec.importFailed': 'Не удалось импортировать файл .proto',
  'workbench.editors.grpc.method.usingSpec': 'Используется {name}',
  'workbench.editors.grpc.method.refreshSpec': 'Пересобрать из текущих файлов спецификации',
  'workbench.editors.grpc.settings.exampleCaption': 'Пример вызова',
  'workbench.editors.grpc.settings.group.connection': 'Соединение',
  'workbench.editors.grpc.settings.group.tls': 'TLS и доверие',
  'workbench.editors.grpc.settings.group.messages': 'Сообщения',
  'workbench.editors.grpc.settings.groupInfo.connection':
    'Как вызов достигает сервера: куда подключается канал, имя, которому адресован вызов, предел для всего вызова и keepalive-пинг, который ловит мёртвое соединение посреди вызова.',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'Как каналы TLS устанавливают доверие: проверяется ли сертификат сервера по системным корневым сертификатам, какой клиентский сертификат предъявляет это устройство, окно версий TLS и список шифров в рукопожатии, а также имя SNI, которое оно предлагает.',
  'workbench.editors.grpc.settings.groupInfo.messages':
    'Как Рабочая среда обращается с сообщением, которое не разбирается — общая для всего приложения настройка, разделяемая с настройками API-запросов, а не поле отдельного запроса.',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Сокет Unix',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Подключаться к этому локальному сокету — абсолютный путь к сокету Unix или именованный канал Windows вроде \\\\.\\pipe\\name — вместо открытия TCP-соединения. Цель по-прежнему определяет заголовок :authority, имя сервера TLS и проверку сертификата; меняется только то, куда идёт соединение. Оставьте пустым для обычного TCP-соединения.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'TCP-соединение (по умолчанию)',
  'workbench.editors.grpc.settings.timeoutLabel': 'Тайм-аут вызова',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Предел реального времени на весь вызов — отправляется как дедлайн gRPC, чтобы сервер мог его соблюдать, и применяется локально. Пусто — без дедлайна.',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'Без ограничения (по умолчанию)',
  'workbench.editors.grpc.settings.authorityLabel': 'Authority',
  'workbench.editors.grpc.settings.authorityHelp':
    'Значение :authority, которому адресован вызов в сети — имя, по которому маршрутизирует сервер, — при том что соединение по-прежнему идёт к цели. Для шлюза, маршрутизирующего по authority, или сервера, доступного по IP-адресу, но ожидающего собственное имя. Имя сервера TLS и проверка сертификата сохраняют хост цели; это меняет настройка «Имя сервера SNI». Оставьте пустым, чтобы отправлять саму цель.',
  'workbench.editors.grpc.settings.authorityPlaceholder': 'Цель (по умолчанию)',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': 'Keepalive-пинг',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    'Отправлять фрейм HTTP/2 PING с этим интервалом, пока вызов открыт, чтобы тихий серверный поток или медленный унарный вызов узнал о мёртвом соединении, не дожидаясь дедлайна. Каждое соединение обслуживает один вызов, так что между вызовами поддерживать нечего. Серверы отвергают пинги чаще своего порога — по умолчанию 5 минут без передачи данных, — закрывая соединение с too_many_pings; вызов тогда сообщает об этом. Оставьте пустым, чтобы не отправлять пинги.',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': 'Без пингов (по умолчанию)',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': 'Тайм-аут keepalive',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    'Сколько ждать подтверждения пинга, прежде чем соединение будет объявлено мёртвым и вызов завершится с сообщением об этом. Оставьте пустым для значения по умолчанию 20 с.',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 с (по умолчанию)',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': 'Отправлять недопустимые сообщения',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    'Если сообщение не является допустимым JSON, всё равно выполнить вызов с пустым сообщением и дать серверу ответить — обычно INVALID_ARGUMENT. По умолчанию выключено: вызов завершается до отправки с точной ошибкой разбора. Применяется к каждому запросу gRPC.',
  'workbench.editors.grpc.tab.auth': 'Авторизация',
  'workbench.editors.grpc.auth.help':
    'Отправляется как метаданные authorization: Bearer <token> в вызове. Явная строка метаданных authorization имеет приоритет.',
  'workbench.editors.grpc.auth.inheritUnsupported': '{type} — из {source} — нельзя применить к вызову gRPC.',
  'workbench.editors.grpc.auth.helpOwn':
    'Выпускается один раз на вызов и отправляется как метаданные authorization (или под собственным именем ключа) в вызове — размещение в строке запроса никогда не участвует в вызове gRPC. Явная строка метаданных с тем же именем имеет приоритет.',
  'workbench.editors.grpc.auth.ownUnsupported': '{type} нельзя применить к вызову gRPC.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Остановлено',
  'workbench.editors.grpc.stream.tab.timeline': 'Хронология',
  'workbench.editors.grpc.stream.trailersPending': 'Трейлеры придут, когда вызов завершится.',
  'workbench.editors.grpc.stream.sendMessage': 'Отправить сообщение',
  'workbench.editors.grpc.stream.endStreaming': 'Завершить поток',
  'workbench.editors.grpc.stream.controlsIdle': 'Сначала выполните вызов, чтобы открыть поток',
  'workbench.editors.grpc.stream.sendFailed': 'Сообщение не отправлено',
  'workbench.editors.grpc.timeline.requestSent': 'Запрос отправлен',
  'workbench.editors.grpc.timeline.noMetadataSent': 'Метаданные не отправлялись.',
  // {metadata} marks where the linked word (receivedMetadataLink)
  // renders — the display splits on it, so word order stays free.
  'workbench.editors.grpc.timeline.receivedMetadata': 'Получены {metadata}.',
  'workbench.editors.grpc.timeline.receivedMetadataLink': 'метаданные',
  'workbench.editors.grpc.timeline.noMetadataReceived': 'Метаданные не получены.',
  'workbench.editors.grpc.timeline.responseReceived': 'Ответ получен',
  'workbench.editors.grpc.timeline.completed': 'Вызов завершён',
  'workbench.editors.grpc.timeline.stopped': 'Вызов остановлен',
  'workbench.editors.grpc.timeline.failed': 'Вызов не удался',
  'workbench.editors.grpc.timeline.lost': 'Соединение потеряно',
  'workbench.editors.grpc.timeline.noMatches': 'Нет подходящих сообщений.',
  'workbench.editors.grpc.timeline.searchMessages': 'Поиск сообщений',
  'workbench.editors.grpc.timeline.filterAll': 'Все',
  'workbench.editors.grpc.timeline.filterSent': 'Отправленные',
  'workbench.editors.grpc.timeline.filterReceived': 'Полученные',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} сообщение',
      few: '{count} сообщения',
      many: '{count} сообщений',
      other: '{count} сообщений',
    }),
  'workbench.editors.grpc.timeline.sortOrder': 'Сортировка и группировка',
  'workbench.editors.grpc.timeline.newestFirst': 'Сначала новые',
  'workbench.editors.grpc.timeline.oldestFirst': 'Сначала старые',
  'workbench.editors.grpc.timeline.showTypes': 'Показывать типы сообщений',
  'workbench.editors.grpc.timeline.groupByType': 'Группировать по типу сообщения',
  'workbench.editors.grpc.timeline.groupByDirection': 'Группировать по направлению',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Строк в группе',
  'workbench.editors.grpc.timeline.noLimit': 'Без ограничения',
  'workbench.editors.grpc.timeline.clearMessages': 'Очистить сообщения (только на экране)',
  'workbench.editors.grpc.timeline.trustCertificate': 'Доверять сертификату',
  'workbench.editors.grpc.timeline.newMessages': 'Новые сообщения',
  'workbench.editors.grpc.timeline.sentAria': 'Отправленное сообщение',
  'workbench.editors.grpc.timeline.receivedAria': 'Полученное сообщение',
  'workbench.editors.grpc.timeline.script': '{hook} — {levels}',
  'workbench.editors.grpc.timeline.scriptFailed': '{hook} — ошибка: {error}',
  // ── The call's scripts — the result panes' Scripts tab and tag ──────
  'workbench.editors.grpc.response.tab.scripts': 'Скрипты',
  'workbench.editors.grpc.scripts.empty': 'В этом вызове не выполнялся ни один скрипт.',
  'workbench.editors.grpc.scripts.console': 'Консоль',
  'workbench.editors.grpc.scripts.tests': 'Tests',
  'workbench.editors.grpc.scripts.consoleEmpty': 'В журнале пусто.',
  'workbench.editors.grpc.scripts.testsEmpty': 'Проверки не зарегистрированы.',
  'workbench.editors.grpc.scripts.attempt': 'попытка {attempt}',
  'workbench.editors.grpc.scripts.atMessage': 'сообщение {index}',
  'workbench.editors.grpc.scripts.tag': 'Скрипты · {count}',
  'workbench.editors.grpc.scripts.tagTitle': 'Скрипты вызова',
  'workbench.editors.grpc.scripts.tagSummary': 'Хуки, выполненные в этом вызове, и уровни, которые в них участвовали.',
  'workbench.editors.grpc.scripts.tagSummaryFailed': 'Хук завершился ошибкой — его последняя ошибка указана под ним.',
  'workbench.editors.grpc.scripts.runs': 'запусков: {count}',
  'workbench.editors.grpc.scripts.runsOne': '1 запуск',
  'workbench.editors.grpc.scripts.failed': 'с ошибкой: {count}',
  'workbench.editors.grpc.scripts.dropped': 'отброшено: {count}',
  'workbench.editors.grpc.scripts.marksCapped':
    'Подробности по сообщениям перестали записываться после {count} запусков; хуки продолжают работать, и полные счётчики появятся, когда вызов завершится.',
  'workbench.editors.grpc.toast.deletedOtherTab': 'Запрос gRPC был удалён из другой вкладки',
  'workbench.editors.grpc.toast.updateFailed': 'Не удалось обновить запрос gRPC',
  'workbench.editors.grpc.toast.updateFailedDetail': 'Не удалось обновить запрос gRPC: {message}',
  'workbench.editors.grpc.response.saveResponse': 'Сохранить ответ',
  'workbench.editors.grpc.toast.savedExample': 'Пример «{name}» сохранён',
  'workbench.editors.grpc.toast.saveExampleFailed': 'Не удалось сохранить пример',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': 'Не удалось сохранить пример: {message}',
  'workbench.editors.grpcExample.loading': 'Загрузка примера…',
  'workbench.editors.grpcExample.notFound': 'Пример не найден.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': 'Пример был удалён из другой вкладки',
  'workbench.editors.grpcExample.toast.saveFailed': 'Не удалось сохранить пример',
  'workbench.editors.grpcExample.toast.saveFailedDetail': 'Не удалось сохранить пример: {message}',
  'workbench.editors.grpcExample.openInRequest': 'Открыть в запросе',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'Скопировать захваченный вызов этого примера в редактор родительского запроса gRPC как несохранённые правки',
  'workbench.editors.grpcExample.noMethod': 'Метод не записан',
  'workbench.editors.grpcExample.capturedTooltip': 'Захвачено {date}',
  'workbench.editors.grpcExample.result.title': 'Захваченный ответ',
} as const satisfies Catalog;
