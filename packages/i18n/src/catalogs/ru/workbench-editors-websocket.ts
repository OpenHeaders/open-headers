/**
 * Workbench editors — the WebSocket client editor — Russian. Mirrors
 * `catalogs/en/workbench-editors-websocket.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: ws/wss schemes,
 * subprotocol identifiers, AsyncAPI, Socket.IO / CONNECT / engine.io
 * tokens, the sio decoded rows (verbatim wire), `Arg`, Bearer / token,
 * long-polling, `Ack`. The Params tab and Docs tab ride raw
 * (tab.params / Docs law); Settings tab = Настройки; spec-browser
 * section headers mirror AsyncAPI document keywords and ride raw (spec
 * outline law) while prose says канал / операция (editors-spec
 * donor). фрейм = frame; рукопожатие = handshake; сеанс = session;
 * хронология = timeline; захват = capture; Авторизация = the
 * Authorization tab; Заголовки = Headers tab; полезная нагрузка =
 * payload. MINTS: подпротокол = subprotocol (carried from
 * workbench-editors); Прослушивать = the Listen column; подтверждение
 * = ack (prose; the sio row `ack` stays verbatim wire); События = the
 * Events tab noun; пространство имён = namespace (carried from
 * workbench-editors-rule); heartbeat-кадры = heartbeat frames (raw
 * apposition); простой = idle — future editors-request ru reuses
 * Авторизация / Заголовки / Params for its twin tabs. Every raw token
 * takes a head noun or a hyphenated apposition (сеанс Socket.IO,
 * рукопожатие engine.io, параметр Ack, URL-адрес).
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'Запрос WebSocket не найден.',
  'workbench.editors.websocket.connect.label': 'Подключиться',
  'workbench.editors.websocket.connect.disconnect': 'Отключиться',
  'workbench.editors.websocket.connect.cancel': 'Отмена',
  'workbench.editors.websocket.connect.needsUrl': 'Для подключения введите URL-адрес ws:// или wss://.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Сообщение',
  'workbench.editors.websocket.tab.events': 'События',
  'workbench.editors.websocket.tab.auth': 'Авторизация',
  'workbench.editors.websocket.tab.headers': 'Заголовки',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': 'Настройки',
  'workbench.editors.websocket.tab.scripts': 'Скрипты',
  'workbench.editors.websocket.messagePlaceholder': 'Составьте следующее сообщение для отправки…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 двоичного сообщения, например aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hex двоичного сообщения, например 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Текст',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Двоичное',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Шестнадцатеричный',
  'workbench.editors.websocket.message.invalidGate': 'Сначала исправьте кодировку сообщения.',
  'workbench.editors.websocket.message.invalidBase64':
    'Недопустимый Base64 — отправляются именно декодированные байты.',
  'workbench.editors.websocket.message.invalidHex':
    'Недопустимый hex — пары цифр 0-9 a-f декодируются в отправляемые байты.',
  'workbench.editors.websocket.auth.helpRaw':
    'Отправляется как заголовок Authorization: Bearer в рукопожатии — действует в настольном приложении или на сервере; браузеры не могут задать его для WebSocket. Явная строка заголовка Authorization имеет приоритет.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Отправляется как полезная нагрузка auth пакета CONNECT ({"token": …}) на любом хосте и как заголовок рукопожатия Authorization: Bearer в настольном приложении или на сервере. Явная строка заголовка Authorization имеет приоритет над заголовком.',
  'workbench.editors.websocket.auth.inheritUnsupported': '{type} — из {source} — нельзя применить к сеансу WebSocket.',
  'workbench.editors.websocket.auth.helpOwn':
    'Выпускается при каждом подключении и каждом переподключении: заголовок идёт в рукопожатии в настольном приложении или на сервере (браузеры не могут его задать), размещение в строке запроса или подписанный URL-адрес AWS идёт в URL-адресе подключения на любом хосте, а вариант Socket.IO также отправляет токен в форме bearer как полезную нагрузку auth пакета CONNECT. Явная строка заголовка с тем же именем имеет приоритет.',
  'workbench.editors.websocket.auth.ownUnsupported': '{type} нельзя применить к сеансу WebSocket.',
  'workbench.editors.websocket.events.hint':
    'Входящие события, показываемые в хронологии сеанса. Без строк показываются все события; захват всегда записывает всё.',
  'workbench.editors.websocket.events.namePlaceholder': 'Имя события',
  'workbench.editors.websocket.events.listenLabel': 'Прослушивать',
  'workbench.editors.websocket.event.namePlaceholder': 'Имя события',
  'workbench.editors.websocket.event.ackLabel': 'Ожидать подтверждение',
  'workbench.editors.websocket.event.ackHelp':
    'Выпускать идентификатор подтверждения при каждой отправке, чтобы ответ-подтверждение сервера сопоставлялся в хронологии.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Составьте JSON-массив аргументов, например ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': 'Удалить аргумент {index}',
  'workbench.editors.websocket.event.argPlaceholder':
    'Составьте этот аргумент как JSON, например "hello" или {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Имя заголовка',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Значение',
  'workbench.editors.websocket.headers.hint.host':
    'Выводится из целевого URL-адреса при подключении — хост, которому адресован запрос обновления протокола.',
  'workbench.editors.websocket.headers.hint.connection':
    'Просит сервер переключить протокол; открывающее рукопожатие WebSocket всегда несёт Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Называет протокол, на который переключиться — каждое рукопожатие WebSocket обновляет HTTP-соединение до websocket.',
  'workbench.editors.websocket.headers.hint.key':
    'Случайный одноразовый код, генерируемый для каждого соединения; сервер доказывает, что прочитал рукопожатие, возвращая его хеш в Sec-WebSocket-Accept.',
  'workbench.editors.websocket.headers.hint.version':
    'Версия протокола WebSocket (RFC 6455); 13 — единственная используемая версия.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Предлагает сжатие по сообщениям; сервер может принять, сузить или проигнорировать предложение в ответе на рукопожатие.',
  'workbench.editors.websocket.headers.hint.origin':
    'Источник страницы, который браузер ставит на каждое рукопожатие WebSocket; серверы используют его, чтобы отклонять межсайтовые соединения.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'Браузер представляется в рукопожатии; код страницы не может это изменить.',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'Браузер помечает запрос обновления протокола как некешируемый.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'Кодировки содержимого, которые браузер принимает в ответе на рукопожатие.',
  'workbench.editors.websocket.headers.hint.acceptLanguage': 'Предпочитаемые языки браузера из его настроек.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'Рукопожатие среды выполнения node принимает любой медиатип ответа.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage':
    'Рукопожатие среды выполнения node отправляет подстановочный знак.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Ставится средой выполнения node на каждое рукопожатие WebSocket.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'Среда выполнения node представляет это приложение в рукопожатии. Добавьте собственную строку User-Agent, чтобы отправить другое значение.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'Среда выполнения node помечает запрос обновления протокола как некешируемый.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'Кодировки содержимого, которые среда выполнения node принимает в ответе на рукопожатие.',
  'workbench.editors.websocket.headers.browserNotSent':
    'Не отправляется — браузер сам задаёт заголовки рукопожатия. Пользовательские заголовки действуют, когда сеанс выполняется в настольном приложении или на сервере.',
  'workbench.editors.websocket.spec.selectLabel': 'Спецификация AsyncAPI',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Привязать спецификацию AsyncAPI',
  'workbench.editors.websocket.spec.summary': 'серверов: {servers} · каналов: {channels} · операций: {operations}',
  'workbench.editors.websocket.spec.parseFailure': 'Спецификация не разбирается: {message}',
  'workbench.editors.websocket.spec.issues': 'проблем в спецификации: {count}',
  'workbench.editors.websocket.spec.useExample': 'Использовать пример сообщения…',
  'workbench.editors.websocket.spec.browser.hint': 'Выберите сообщение, чтобы составить его пример полезной нагрузки.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.settings.exampleCaption': 'Пример сеанса',
  'workbench.editors.websocket.settings.group.connection': 'Соединение',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS и доверие',
  'workbench.editors.websocket.settings.group.resilience': 'Устойчивость сеанса',
  'workbench.editors.websocket.settings.groupInfo.resilience':
    'Что поддерживает долгий сеанс: переоткрывается ли оборванное соединение и насколько терпеливо, как долго может длиться тишина, прежде чем соединение считается потерянным, и heartbeat-кадры, которые отправляет этот клиент.',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'Как рукопожатие открывает сеанс: предлагаемые подпротоколы, куда идёт соединение и предел на открытие.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Как сеанс Socket.IO адресует сервер и говорит с ним: путь рукопожатия engine.io, который он использует, пространство имён, к которому присоединяется, ревизия протокола и как долго событие ждёт своего подтверждения.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'Как сеансы wss: устанавливают доверие: проверяется ли сертификат сервера по системным корневым сертификатам, какой клиентский сертификат предъявляет это устройство, окно версий TLS и список шифров в рукопожатии, а также имя SNI, которое оно предлагает.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Подпротоколы',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Список предложений Sec-WebSocket-Protocol в порядке предпочтения — сервер выбирает один во время рукопожатия.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Нет (по умолчанию)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'например, graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Сокет Unix',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Подключаться к этому локальному сокету — абсолютный путь к сокету Unix или именованный канал Windows вроде \\\\.\\pipe\\name — вместо открытия TCP-соединения. URL-адрес по-прежнему определяет Host рукопожатия, имя сервера TLS и проверку сертификата; меняется только то, куда идёт соединение. Оставьте пустым для обычного TCP-соединения.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'TCP-соединение (по умолчанию)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Тайм-аут подключения',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Предел реального времени только на рукопожатие соединения — у открытого сеанса предела нет. Пусто — без дедлайна.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Без ограничения (по умолчанию)',
  'workbench.editors.websocket.settings.handshakePathLabel': 'Путь рукопожатия',
  'workbench.editors.websocket.settings.handshakePathHelp':
    'Путь на сервере, по которому идёт рукопожатие engine.io — точка монтирования Socket.IO, а не пространство имён. Пусто — стандартный /socket.io/. Сеансы подключаются к транспорту websocket напрямую; отката к long-polling нет.',
  'workbench.editors.websocket.settings.handshakePathPlaceholder': '/socket.io/ (по умолчанию)',
  'workbench.editors.websocket.settings.handshakePathExample': 'например, /net/sio-probe',
  'workbench.editors.websocket.settings.namespaceLabel': 'Пространство имён',
  'workbench.editors.websocket.settings.namespaceHelp':
    'Пространство имён, к которому присоединяется сеанс — путь URL-адреса, как его читает официальный клиент (ws://host/admin присоединяется к /admin). Правьте здесь или в URL-адресе; они остаются согласованными. Пусто — присоединение к корню /.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (по умолчанию)',
  'workbench.editors.websocket.settings.namespaceExample': 'например, /admin',
  'workbench.editors.websocket.settings.socketioProtocolLabel': 'Протокол',
  'workbench.editors.websocket.settings.socketioProtocolHelp':
    'Ревизия протокола Socket.IO, на которой говорит сеанс. v5 (engine.io 4) — язык серверов Socket.IO 3.x и 4.x; выберите v4 (engine.io 3) для сервера 1.x или 2.x — там пинги отправляет клиент, сервер сам присоединяет к корневому пространству имён, а пакет connect не несёт полезной нагрузки auth, поэтому учётные данные bearer идут только в заголовке рукопожатия.',
  'workbench.editors.websocket.settings.socketioProtocolPlaceholder': 'v5 (по умолчанию)',
  'workbench.editors.websocket.settings.socketioProtocolV5': 'v5 — серверы Socket.IO 3.x / 4.x',
  'workbench.editors.websocket.settings.socketioProtocolV4': 'v4 — серверы Socket.IO 1.x / 2.x',
  'workbench.editors.websocket.settings.ackTimeoutLabel': 'Тайм-аут подтверждения',
  'workbench.editors.websocket.settings.ackTimeoutHelp':
    'Как долго событие, отправленное с параметром Ack, ждёт подтверждения сервера. Когда ожидание истекает, хронология записывает подтверждение как просроченное и перестаёт ждать; запоздавшее подтверждение всё равно показывается по прибытии. Пусто — ждать бесконечно.',
  'workbench.editors.websocket.settings.ackTimeoutPlaceholder': 'Без тайм-аута (по умолчанию)',
  'workbench.editors.websocket.toast.deletedOtherTab': 'Этот запрос WebSocket был удалён в другой вкладке.',
  'workbench.editors.websocket.toast.updateFailed': 'Не удалось сохранить запрос WebSocket',
  'workbench.editors.websocket.toast.updateFailedDetail': 'Не удалось сохранить запрос WebSocket: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Пример {name} сохранён',
  'workbench.editors.websocket.toast.saveExampleFailed': 'Не удалось сохранить пример',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'Не удалось сохранить пример: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Ответ',
  'workbench.editors.websocket.session.emptyHint': 'Подключитесь, чтобы отправлять и получать сообщения.',
  'workbench.editors.websocket.session.connectFailed': 'Не удалось открыть сеанс',
  'workbench.editors.websocket.session.connectingBadge': 'Подключение',
  'workbench.editors.websocket.session.connectedBadge': 'Подключено',
  'workbench.editors.websocket.session.closedTag': 'Закрыто {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Остановлено',
  'workbench.editors.websocket.session.disconnectedTag': 'Отключено',
  'workbench.editors.websocket.session.connectFailedTag': 'Сбой подключения',
  'workbench.editors.websocket.session.abortedTag': 'Прервано',
  'workbench.editors.websocket.session.noCloseFrame': 'Соединение завершилось без фрейма Close',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Отправить',
  'workbench.editors.websocket.session.saveResponse': 'Сохранить ответ',
  'workbench.editors.websocket.session.sendIdle': 'Подключитесь, чтобы отправлять сообщения.',
  'workbench.editors.websocket.session.sendFailed': 'Не удалось отправить сообщение',
  'workbench.editors.websocket.session.hostNotice':
    'Работает через сокет браузера — {knobs} на этом хосте не действуют.',
  'workbench.editors.websocket.session.knobHeaders': 'пользовательские заголовки рукопожатия',
  'workbench.editors.websocket.session.knobSslVerify': 'отключённая проверка SSL',
  'workbench.editors.websocket.session.knobAuth': 'заголовок рукопожатия с учётными данными',
  'workbench.editors.websocket.session.handshakeNone': 'Ничего не согласовано',
  'workbench.editors.websocket.session.handshakeNote':
    'Платформенный сокет раскрывает только согласованные подпротокол и расширения — заголовки ответа 101 клиентам недоступны.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Подключение',
  'workbench.editors.websocket.timeline.connected': 'Подключено',
  'workbench.editors.websocket.timeline.disconnected': 'Отключено',
  'workbench.editors.websocket.timeline.stopped': 'Остановлено',
  'workbench.editors.websocket.timeline.aborted': 'Соединение прервано',
  'workbench.editors.websocket.connect.reconnectNow': 'Переподключиться сейчас',
  'workbench.editors.websocket.connect.reconnectNowHint':
    'Выполнить следующую попытку переподключения, не дожидаясь конца периода',
  'workbench.editors.websocket.session.reconnectingBadge': 'Переподключение',
  'workbench.editors.websocket.session.reconnectExhaustedTag': 'Переподключение прекращено',
  'workbench.editors.websocket.session.reconnectExhausted': 'переподключение прекращено после {attempts}',
  'workbench.editors.websocket.session.reconnectExhaustedReason':
    'переподключение прекращено после {attempts}: {reason}',
  'workbench.editors.websocket.session.reconnectAttemptsOne': 'одной попытки',
  'workbench.editors.websocket.session.reconnectAttemptsMany': 'попыток ({count})',
  'workbench.editors.websocket.timeline.lost': 'Соединение потеряно',
  'workbench.editors.websocket.timeline.lostIdle': 'ничего не пришло до истечения тайм-аута простоя',
  'workbench.editors.websocket.timeline.reconnectingAfter': 'Попытка переподключения {attempt} через {delay}',
  'workbench.editors.websocket.timeline.reconnectingNow': 'Попытка переподключения {attempt} сейчас',
  'workbench.editors.websocket.timeline.reconnected': 'Повторно подключено',
  'workbench.editors.websocket.timeline.reconnectedTo': 'Повторно подключено к {url}',
  'workbench.editors.websocket.timeline.ackTimeout': 'Подтверждение #{ackId} просрочено после {timeout}',
  'workbench.editors.websocket.timeline.noMatches': 'Нет сообщений, соответствующих фильтру.',
  'workbench.editors.websocket.timeline.connectedTo': 'Подключено к {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Копировать сообщение',
  'workbench.editors.websocket.saved.title': 'Сохранённые сообщения',
  'workbench.editors.websocket.saved.addTooltip': 'Сохранить текущий черновик как повторно используемое сообщение',
  'workbench.editors.websocket.saved.showRail': 'Показать сохранённые сообщения',
  'workbench.editors.websocket.saved.hideRail': 'Скрыть сохранённые сообщения',
  'workbench.editors.websocket.saved.emptyHint':
    'Сохраняйте сообщения, чтобы использовать их повторно во время активного соединения.',
  'workbench.editors.websocket.saved.defaultName': 'Сообщение',
  'workbench.editors.websocket.saved.rename': 'Переименовать',
  'workbench.editors.websocket.saved.duplicate': 'Дублировать',
  'workbench.editors.websocket.saved.delete': 'Удалить',
  'workbench.editors.websocket.timeline.saveMessage': 'Сохранить сообщение',
  'workbench.editors.websocket.timeline.info.label': 'Сведения о сообщении',
  'workbench.editors.websocket.timeline.info.size': 'Размер',
  'workbench.editors.websocket.timeline.info.time': 'Время',
  'workbench.editors.websocket.timeline.info.frame': 'Фрейм',
  'workbench.editors.websocket.timeline.info.frameText': 'Текстовый',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Двоичный',
  'workbench.editors.websocket.timeline.couldNotConnect': 'Не удалось подключиться к {url}',
  'workbench.editors.websocket.timeline.errorLabel': 'Ошибка',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Отключено от {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Сведения о рукопожатии',
  'workbench.editors.websocket.timeline.requestUrl': 'URL-адрес запроса',
  'workbench.editors.websocket.timeline.requestMethod': 'Метод запроса',
  'workbench.editors.websocket.timeline.statusCode': 'Код статуса',
  'workbench.editors.websocket.timeline.requestHeaders': 'Заголовки запроса',
  'workbench.editors.websocket.timeline.responseHeaders': 'Заголовки ответа',
  'workbench.editors.websocket.timeline.keyGenerated': '<сгенерирован сокетом>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'Сеанс был остановлен из этого приложения.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    'Зарегистрированного значения нет — код приложения или частный код.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'Соединение успешно закрыто.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'Конечная точка уходит — остановка сервера или переход на другую страницу.',
  'workbench.editors.websocket.timeline.closeCode.1002': 'Конечная точка разорвала соединение из-за ошибки протокола.',
  'workbench.editors.websocket.timeline.closeCode.1003':
    'Конечная точка получила данные типа, который не может принять.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Во фрейме Close не было кода состояния.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'Соединение оборвалось без фрейма Close.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'Сообщение несло данные, не соответствующие его типу, например недопустимый UTF-8 в текстовом фрейме.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'Сообщение нарушило политику конечной точки.',
  'workbench.editors.websocket.timeline.closeCode.1009': 'Сообщение слишком велико для обработки конечной точкой.',
  'workbench.editors.websocket.timeline.closeCode.1010': 'Сервер не согласовал расширение, которое требовал клиент.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'Сервер столкнулся с непредвиденным состоянием и не смог выполнить запрос.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'Сервер перезапускается.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'Сервер перегружен — повторите попытку позже.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'Шлюз или прокси получил недопустимый ответ от вышестоящего сервера.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'Рукопожатие TLS не удалось.',
  'workbench.editors.websocket.timeline.searchMessages': 'Поиск сообщений',
  'workbench.editors.websocket.timeline.messageCount': 'сообщений: {count}',
  'workbench.editors.websocket.timeline.dropped': 'старых сообщений выпало из захвата: {count}',
  'workbench.editors.websocket.timeline.script': '{hook} — {levels}',
  'workbench.editors.websocket.timeline.scriptFailed': '{hook} — ошибка: {error}',
  'workbench.editors.websocket.timeline.scriptDropped': '{hook} отбросил сообщение — {level}',
  'workbench.editors.websocket.timeline.scriptAttempt': 'попытка {attempt}',
  'workbench.editors.websocket.session.view.timeline': 'Хронология',
  'workbench.editors.websocket.session.view.scripts': 'Скрипты',
  'workbench.editors.websocket.session.scripts.empty': 'В этом сеансе не выполнялся ни один скрипт.',
  'workbench.editors.websocket.session.scripts.console': 'Консоль',
  'workbench.editors.websocket.session.scripts.tests': 'Tests',
  'workbench.editors.websocket.session.scripts.consoleEmpty': 'В журнале пусто.',
  'workbench.editors.websocket.session.scripts.testsEmpty': 'Проверки не зарегистрированы.',
  'workbench.editors.websocket.session.scripts.attempt': 'попытка {attempt}',
  'workbench.editors.websocket.session.scripts.atMessage': 'сообщение {index}',
  'workbench.editors.websocket.session.scripts.tag': 'Скрипты · {count}',
  'workbench.editors.websocket.session.scripts.tagTitle': 'Скрипты сеанса',
  'workbench.editors.websocket.session.scripts.tagSummary':
    'Хуки, выполненные в этом сеансе, и уровни, которые в них участвовали.',
  'workbench.editors.websocket.session.scripts.tagSummaryFailed':
    'Хук завершился ошибкой — его последняя ошибка указана под ним.',
  'workbench.editors.websocket.session.scripts.runs': 'запусков: {count}',
  'workbench.editors.websocket.session.scripts.runsOne': '1 запуск',
  'workbench.editors.websocket.session.scripts.failed': 'с ошибкой: {count}',
  'workbench.editors.websocket.session.scripts.dropped': 'отброшено: {count}',
  'workbench.editors.websocket.session.scripts.marksCapped':
    'Подробности по событиям перестали записываться после {count} запусков; хуки продолжают работать, и полные счётчики появятся, когда сеанс завершится.',
  'workbench.editors.websocket.timeline.filterAll': 'Все',
  'workbench.editors.websocket.timeline.filterSent': 'Отправленные',
  'workbench.editors.websocket.timeline.filterReceived': 'Полученные',
  'workbench.editors.websocket.timeline.newestFirst': 'Сначала новые',
  'workbench.editors.websocket.timeline.oldestFirst': 'Сначала старые',
  'workbench.editors.websocket.timeline.sortOrder': 'Сортировка и группировка',
  'workbench.editors.websocket.timeline.groupByDirection': 'Группировать по направлению',
  'workbench.editors.websocket.timeline.groupByEvent': 'Группировать по событию',
  'workbench.editors.websocket.timeline.hideHeartbeat': 'Скрыть heartbeat-кадры (ping / pong)',
  'workbench.editors.websocket.timeline.hideHandshake': 'Скрыть фреймы рукопожатия (open / connect)',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Строк в группе',
  'workbench.editors.websocket.timeline.noLimit': 'Без ограничения',
  'workbench.editors.websocket.timeline.clearMessages': 'Очистить сообщения',
  'workbench.editors.websocket.timeline.trustCertificate': 'Доверять сертификату',
  'workbench.editors.websocket.timeline.newMessages': 'Новые сообщения',
  'workbench.editors.websocket.timeline.binaryMessage': 'Двоичное сообщение ({bytes} байт)',
  'workbench.editors.websocket.timeline.sentAria': 'Отправлено',
  'workbench.editors.websocket.timeline.receivedAria': 'Получено',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'Фрейм двоичных вложений (вложений: {count})',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': 'Загрузка примера…',
  'workbench.editors.wsExample.notFound': 'Этого примера больше нет — возможно, он был удалён в другой вкладке.',
  'workbench.editors.wsExample.openInRequest': 'Открыть в запросе',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Открыть родительский запрос WebSocket с этой захваченной формой как несохранёнными правками.',
  'workbench.editors.wsExample.capturedTooltip': 'Захвачено {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'Этот пример был удалён в другой вкладке.',
  'workbench.editors.wsExample.toast.saveFailed': 'Не удалось сохранить пример',
  'workbench.editors.wsExample.toast.saveFailedDetail': 'Не удалось сохранить пример: {message}',
} as const satisfies Catalog;
