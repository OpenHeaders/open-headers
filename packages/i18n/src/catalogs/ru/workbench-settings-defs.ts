/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories — Russian. Mirrors `catalogs/en/workbench-settings-defs.ts`
 * key for key. Brand and platform vocabulary (Chrome / Firefox / Edge,
 * font names, window titles) rides raw per the S48 settings-station
 * decisions; `declarativeNetRequest`, `url-filter`, `Cache-Control:
 * no-cache`, `{{ns.X}}` references, INVALID_ARGUMENT and IP/port
 * literals are wire tokens. The workspaceLayout section quotes the ru
 * devpanel-defs twins verbatim (По ширине / Стопкой / Динамически /
 * Пропорционально / строка состояния / верхняя панель, aligned with the
 * shipped `panel.ts` layout menu); merge strategies mint the
 * import-export vocabulary here («Добавить как новые» / «Заменить» /
 * «Пропустить» — `workbench-import-export.ts` must reuse); «Эта
 * страница» quotes the popup tab name; режим отладки / подключить
 * (attach) / область действия follow the debug vocabulary; «Отключить
 * кеш» quotes the panel toolbar mint; «Обновить и перезапустить» /
 * «Что нового» / Лента активности / панель «Трафик» carried. The three
 * peer-execute / desktop-watch labels copy the shipped shared-components
 * / popup quotes verbatim; the sessionAgentRawReads label «Разрешить
 * чтение сеансов без скрытия» matches the sidebar's «разрешение на
 * чтение сеансов без скрытия». MINTS: агент = agent (MCP); оболочка
 * интерфейса = the UI chrome; профиль = terminal profile; буфер
 * прокрутки = scrollback; рядом / единый = side-by-side / unified diff
 * (Рядом is the layout row); лигатуры; акцентный цвет = accent color;
 * дебаунс = debounce (Дебаунс обновлений); Как в системе = Follow
 * system; Просторно / Компактно = the density pair; theme variant
 * names (Warm / Rose / Sepia / Dim / Midnight / Forest / Arctic) ride
 * raw as palette proper names; стратегия вычисления = evaluation
 * strategy; затенённый = shadowed (the rule-effect sense; the evidence
 * chip stays перекрыт). Every raw token takes a hyphenated apposition
 * or a head noun (браузер Chrome, JSON-файл, URL-адрес, локальная сеть
 * (LAN)).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': 'Сопрягать автоматически',
  'workbench.settings.def.backend.nmAutoJoin.description':
    'Когда настольное приложение Open Headers запущено на этом компьютере, подключаться к нему без кода сопряжения — настольное приложение проверяет этот браузер через операционную систему, прежде чем выдать доступ. Выключите, чтобы сопрягать только явным действием.',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': 'Проверять в фоне',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    'Пока настольное приложение не подключено, проверять раз в пару минут, не установлено ли оно, чтобы свежая установка подключилась сама. Выключите, чтобы проверять только при запуске расширения.',
  'workbench.settings.def.backend.requireNmIdentity.label': 'Требовать проверенное сопряжение',
  'workbench.settings.def.backend.requireNmIdentity.description':
    'Отклоняет коды сопряжения и вставленные токены для настольного приложения на этом компьютере — доступ выдаёт только передача, проверенная операционной системой. Удалённые бэкенды не затрагиваются. Обычно задаётся политикой организации.',
  'workbench.settings.def.backend.allowDesktopWatch.label': 'Разрешить настольному приложению видеть этот браузер',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    'Разрешает сопряжённому настольному приложению на этом компьютере наблюдать за сетевым трафиком, хранилищем и консолью этого браузера в своей панели «Трафик». Выключите, чтобы правила и синхронизация продолжали работать, а живые представления настольного приложения вежливо отклонялись.',
  'workbench.settings.def.backend.bindAddress.label': 'Синхронизация с устройствами в сети',
  'workbench.settings.def.backend.bindAddress.description':
    'Позволяет другим компьютерам и браузерам в той же сети подключаться к этому приложению и пользоваться его рабочими пространствами. По умолчанию выключено — приложение доступно только с этого компьютера.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Только loopback (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'Подключаться может только эта машина. По умолчанию.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'Все интерфейсы (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'Подключаться могут другие устройства в локальной сети. Требуется токен авторизации из U3.2.',
  'workbench.settings.def.backend.bindPort.label': 'Порт',
  'workbench.settings.def.backend.bindPort.description':
    'Порт, который это приложение открывает для подключения браузеров и других устройств. Меняйте его, только если порт по умолчанию уже занят. Клиенты должны указывать тот же порт.',
  'workbench.settings.def.backend.serveWebApp.label': 'Раздавать веб-приложение',
  'workbench.settings.def.backend.serveWebApp.description':
    'Раздавать Рабочую среду как веб-страницу на порту бэкенда, чтобы вкладка браузера могла открыть её прямо из этого приложения — без расширения. Любой, кто достигает порта, видит окно входа; для доступа к данным по-прежнему нужен сопряжённый токен.',
  'workbench.settings.def.backend.allowLocalPeerExecute.label':
    'Разрешить браузерам этого устройства отправлять запросы',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    'Разрешить сопряжённым браузерам на ЭТОЙ машине отправлять API-запросы через это приложение — расширение использует его как движок запросов, поэтому их кнопка «Отправить» в рабочей среде выполняется здесь. По умолчанию включено: сопряжение и есть согласие. Каждая отправка по-прежнему требует права записи в рабочее пространство.',
  'workbench.settings.def.backend.allowRemotePeerExecute.label':
    'Разрешить другим подключённым устройствам отправлять запросы',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    'Разрешить сопряжённым устройствам на ДРУГИХ машинах отправлять API-запросы через это приложение — их кнопка «Отправить» в рабочей среде выполняется на этой машине, с её сетевым доступом и адресом. По умолчанию выключено: это решение оператора, сопряжение его не подразумевает. Каждая отправка по-прежнему требует права записи в рабочее пространство.',
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Начальная задержка',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'Сколько ждать (ms) перед первой попыткой переподключения после разрыва.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Максимальная задержка',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Верхняя граница (ms) экспоненциальной задержки между попытками переподключения.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Интервал keep-alive',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'Как часто (ms) отправлять пинг, чтобы соединение WebSocket оставалось открытым за строгими прокси.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Значок при разрыве соединения',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'Показывать красный значок на иконке панели инструментов, когда связь с бэкендом потеряна.',
  'workbench.settings.def.backend.offlineFallbackOrder.label': 'Порядок хостов',
  'workbench.settings.def.backend.offlineFallbackOrder.description':
    'Если бэкенд уходит в офлайн, первый доступный хост из этого списка сам обновляет учётные данные эксклюзивного рабочего процесса. Хосты добавляются автоматически; перетаскивайте, чтобы изменить порядок.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'Включить',
  'workbench.settings.def.mcp.enabled.description':
    'Отвечать MCP-клиентам на порту бэкенда этого приложения. Пока выключено, конечной точки не существует. Когда включено, агенты с токеном доступа могут читать ваши рабочие пространства.',
  'workbench.settings.def.mcp.allowObserve.label': 'Наблюдение за трафиком',
  'workbench.settings.def.mcp.allowObserve.description':
    'Агенты могут читать живой трафик источников, которые вы захватываете в панели «Трафик». Незахваченные источники остаются невидимыми; заголовки авторизации, cookie и значения, похожие на токены, заменяются стабильными маркерами.',
  'workbench.settings.def.mcp.allowWrite.label': 'Инструменты записи',
  'workbench.settings.def.mcp.allowWrite.description':
    'Агенты могут создавать, изменять и удалять правила, запросы, окружения, переменные и рабочие процессы. Каждое изменение попадает в Ленту активности, и его можно откатить.',
  'workbench.settings.def.mcp.allowExecute.label': 'Инструменты выполнения',
  'workbench.settings.def.mcp.allowExecute.description':
    'Агенты могут отправлять сохранённые запросы и запускать рабочие процессы — настоящий сетевой трафик уходит с этой машины от их имени.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Раскрытие секретов',
  'workbench.settings.def.mcp.allowSecrets.description':
    'Агенты могут читать значения секретов vault открытым текстом. Пока выключено, каждый секрет остаётся замаскированным.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Язык',
  'workbench.settings.def.general.language.description':
    'Язык интерфейса. Применяется сразу ко всем открытым поверхностям — без перезагрузки. Техническая лексика (имена заголовков, HTTP-методы, термины протоколов) остаётся английской на любом языке.',
  'workbench.settings.def.general.language.option.auto.label': 'Как в системе',
  'workbench.settings.def.general.language.option.auto.description':
    'Совпадает с языком браузера или операционной системы',
  'workbench.settings.def.general.language.option.pseudo.description':
    'Английский с акцентами и удлинением — для поиска непереведённого или обрезанного текста',
  'workbench.settings.def.general.confirmOnDelete.label': 'Подтверждать удаление',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Показывать диалог подтверждения перед удалением правил, папок или коллекций.',
  'workbench.settings.def.general.showEmptyStateHints.label': 'Показывать подсказки в пустых состояниях',
  'workbench.settings.def.general.showEmptyStateHints.description':
    'Показывать инструкции и советы в пустых панелях и областях знакомства с приложением.',
  'workbench.settings.def.terminal.profiles.label': 'Профили',
  'workbench.settings.def.terminal.profiles.description':
    'Оболочки, с которыми терминал может открыть вкладку. Обычные новые вкладки используют профиль по умолчанию; стрелка рядом с + в строке вкладок выбирает конкретный профиль.',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': 'Подтверждать закрытие с запущенным процессом',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'Спрашивать перед закрытием вкладки терминала, в оболочке которой ещё выполняется процесс. Простаивающие оболочки всегда закрываются молча.',
  'workbench.settings.def.terminal.startDirectory.label': 'Начальный каталог',
  'workbench.settings.def.terminal.startDirectory.description':
    'Каталог, в котором открываются новые вкладки терминала. Профиль с собственным каталогом имеет приоритет; пустое значение означает домашний каталог. Применяется к следующей открытой вкладке.',
  'workbench.settings.def.terminal.defaultTabName.label': 'Имя вкладки по умолчанию',
  'workbench.settings.def.terminal.defaultTabName.description':
    'Имя для вкладок терминала, открытых без профиля и не переименованных. Пустое значение даёт «Local». Несколько вкладок с одним именем остаются пронумерованными.',
  'workbench.settings.def.terminal.fontFamilyPreset.label': 'Шрифт',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    'Гарнитура текста терминала. Предустановки либо поставляются с приложением, либо опираются на шрифты, которые есть в каждой операционной системе.',
  'workbench.settings.def.terminal.fontSize.label': 'Размер шрифта',
  'workbench.settings.def.terminal.fontSize.description': 'Размер текста терминала в пикселях.',
  'workbench.settings.def.terminal.lineHeight.label': 'Высота строки',
  'workbench.settings.def.terminal.lineHeight.description':
    'Межстрочный интервал как множитель размера шрифта. 1 — естественный интервал шрифта.',
  'workbench.settings.def.terminal.cursorStyle.label': 'Форма курсора',
  'workbench.settings.def.terminal.cursorStyle.description': 'Как рисуется курсор терминала.',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': 'Блок',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': 'Подчёркивание',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': 'Вертикальная черта',
  'workbench.settings.def.terminal.cursorBlink.label': 'Мигание курсора',
  'workbench.settings.def.terminal.cursorBlink.description': 'Мигать курсором терминала.',
  'workbench.settings.def.terminal.minimumContrastRatio.label': 'Минимальный коэффициент контрастности',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    'Подстраивать цвета текста, пока они не достигнут этого контраста с фоном. 1 оставляет цвета как есть; 4.5 соответствует WCAG AA; 21 даёт максимальный контраст.',
  'workbench.settings.def.terminal.scrollback.label': 'Буфер прокрутки',
  'workbench.settings.def.terminal.scrollback.description':
    'Сколько строк терминал хранит выше видимого экрана. Большие значения расходуют больше памяти на вкладку.',
  'workbench.settings.def.terminal.macOptionIsMeta.label': 'Использовать Option как Meta',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    'В macOS считать клавишу Option клавишей Meta, чтобы сочетания вроде Option+B доходили до редактирования строки в оболочке, а не вводили специальные символы.',
  'workbench.settings.def.terminal.copyOnSelect.label': 'Копировать при выделении',
  'workbench.settings.def.terminal.copyOnSelect.description':
    'Копировать выделенный текст терминала в буфер обмена сразу при выделении.',
  'workbench.settings.def.terminal.hyperlinks.label': 'Подсвечивать ссылки',
  'workbench.settings.def.terminal.hyperlinks.description':
    'Находить URL-адреса в выводе терминала и открывать их в браузере по щелчку.',
  'workbench.settings.def.terminal.audibleBell.label': 'Звуковой сигнал',
  'workbench.settings.def.terminal.audibleBell.description':
    'Проигрывать короткий сигнал, когда программа вызывает звонок терминала.',
  'workbench.settings.def.terminal.closeTabOnExit.label': 'Закрывать вкладку при выходе из оболочки',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    'Закрывать вкладку терминала сразу после завершения оболочки. Когда выключено, вкладка остаётся открытой с кнопкой «Перезапустить».',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Восстанавливать вкладки при запуске',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    'Снова открывать вкладки редактора, которые были открыты в конце предыдущего сеанса.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': 'Автопереключение окружения',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'Как меняется активное окружение при переходе между коллекциями и сущностями внутри них (правилами, запросами, папками). Действует и для коллекций правил, и для коллекций API-запросов. Коллекция может нести окружение по умолчанию и закреплять короткий список рекомендуемых окружений; этот параметр определяет, применяются ли такие значения автоматически.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': 'Сохранять выбранное окружение',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'Что бы вы ни выбрали (в том числе отсутствие окружения), выбор сохраняется при переходе между коллекциями и их подпапками, правилами или запросами. Окружение коллекции по умолчанию применяется, только когда окружение не выбрано.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label':
    'Применять значения коллекций по умолчанию',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    'Окружение коллекции по умолчанию действует, пока вы внутри неё (или любой её подпапки, правила или запроса). Ваш последний ручной выбор — базовое окружение; оно восстанавливается, когда вы покидаете коллекцию или входите в коллекцию без значения по умолчанию. Память по коллекциям не ведётся.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Следовать каждой коллекции',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    'Открытие коллекции (или любой подпапки, правила или запроса внутри неё) с окружением по умолчанию переключает на это окружение. Выбор, сделанный внутри коллекции, запоминается для этой коллекции. Коллекции без значения по умолчанию не переключают окружение.',
  'workbench.settings.def.general.settingsOpenMode.label': 'Режим открытия',
  'workbench.settings.def.general.settingsOpenMode.description':
    'Как открывается страница настроек из панели инструментов, всплывающего окна или палитры команд.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Модальное окно',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': 'Окно поверх текущей страницы, по центру',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Модальное окно (развёрнутое)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'Окно поверх страницы, занимающее почти всю область просмотра',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'Вкладка редактора',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'Открывать как полноценную вкладку редактора в рабочем пространстве',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': 'Показывать имена категорий в боковой панели',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Показывать текстовые подписи рядом со значками категорий в боковой панели настроек. Переключается щелчком правой кнопкой по боковой панели. Выключите для компактной рейки из одних значков.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Цветовая тема',
  'workbench.settings.def.appearance.theme.description': 'Определяет общую цветовую тему приложения.',
  'workbench.settings.def.appearance.theme.option.light.label': 'Светлая',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Тёмная',
  'workbench.settings.def.appearance.theme.option.auto.label': 'Как в системе',
  'workbench.settings.def.appearance.theme.option.auto.description': 'Совпадает с операционной системой',
  'workbench.settings.def.appearance.lightVariant.label': 'Вариант светлой темы',
  'workbench.settings.def.appearance.lightVariant.description':
    'Палитра, используемая, когда итоговая цветовая тема светлая.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'По умолчанию',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Сбалансированная нейтральная светлая тема на каждый день.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'Высокая контрастность',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Максимальная читаемость — чисто белые поверхности, почти чёрный текст, контраст AAA.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Похожие на бумагу поверхности с тёплыми нейтральными тонами и янтарным акцентом — мягче для глаз в долгих сеансах.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Светлая тема с серо-синим оттенком — чёткие поверхности и стальной синий акцент.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Мягкие розоватые поверхности с пурпурным акцентом — лёгкое тепло без янтарного тона Warm.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Насыщенная пергаментная палитра с тёмно-коричневым текстом — самый тонированный светлый вариант, идеален для долгого чтения.',
  'workbench.settings.def.appearance.darkVariant.label': 'Вариант тёмной темы',
  'workbench.settings.def.appearance.darkVariant.description':
    'Палитра, используемая, когда итоговая цветовая тема тёмная.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'По умолчанию',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Сбалансированная нейтральная тёмная тема на каждый день.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'Высокая контрастность',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Максимальная читаемость — чисто чёрные поверхности, яркий текст, контраст AAA.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'Мягкие серо-синие поверхности с меньшим бликом — легче для глаз при слабом освещении.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Глубокие тёмно-синие поверхности с ярким синим акцентом — насыщеннее и богаче, чем Dim.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Тёмные поверхности с зелёным оттенком и изумрудным акцентом — спокойная растительная палитра.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Холодная сине-серая тёмная тема с морозным бирюзовым акцентом — более плоская и менее насыщенная, чем Dim или Midnight.',
  'workbench.settings.def.appearance.uiScale.label': 'Масштаб',
  'workbench.settings.def.appearance.uiScale.description':
    'Масштабирует всю оболочку интерфейса — кнопки, текст, отступы, элементы управления — не меняя размер шрифта редактора.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Крошечный (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    'Самая плотная компоновка — полезна в паре со шрифтом интерфейса Press Start 2P, который необычно высок и широк.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Компактный (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Более плотная оболочка, в которой по-прежнему удобно попадать по элементам.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Малый (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'Немного плотнее обычного — на экран помещается больше.',
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Обычный (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Размер оболочки по умолчанию.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Крупный (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': 'Немного увеличен для удобного чтения.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Очень крупный (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    'Максимальный масштаб оболочки — лучший для доступности.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'Семейство шрифтов',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    'Подобранные наборы гротесков для оболочки приложения. По умолчанию — Inter в Windows / Linux ради единообразия между платформами и System Sans в macOS, чтобы сохранить родные оптические размеры SF Pro. Каждый вариант поставляется с расширением. У поверхностей редактора собственная настройка шрифта.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    'Встроенный гротеск для интерфейсов, созданный для экранов — отображается одинаково в любой операционной системе, поэтому приложение выглядит одинаково в macOS, Windows и Linux.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'Стандартный гротеск интерфейса операционной системы — San Francisco в macOS, Segoe UI в Windows, Roboto в Linux. Выберите, если предпочитаете родной вид ценой единообразия между платформами.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Гротеск для читаемости при слабом зрении — характерные формы букв уменьшают путаницу символов. Встроен — всегда доступен.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    'Моноширинный интерфейс под стать встроенному шрифту терминала — вид инструмента разработчика по всей оболочке. Встроен — всегда доступен.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'Пиксельный декоративный шрифт, который мы поставляем с приложением. Встроен — всегда доступен. Выбор ради забавы: читаем, но высок и широк; отступы оболочки будут выглядеть щедрыми.',
  'workbench.settings.def.appearance.density.label': 'Плотность',
  'workbench.settings.def.appearance.density.description':
    'Компактный режим уменьшает отступы в списках, таблицах и формах.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Просторно',
  'workbench.settings.def.appearance.density.option.compact.label': 'Компактно',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'Положение заголовка редактора',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    'Где каждый редактор размещает строку с названием и действиями (имя, переключатель включения, Сохранить). Внизу — верх редактора легче, а основные действия ближе к содержимому, которое вы редактируете.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'Сверху',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'Классическое размещение над содержимым редактора.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'Снизу',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'Под содержимым редактора, над строкой состояния.',
  'workbench.settings.def.appearance.clockFormat.label': 'Формат времени',
  'workbench.settings.def.appearance.clockFormat.description':
    'Как отображаются метки времени по всему приложению (уведомления, журналы). Задаётся явно, потому что локаль браузера следует языку браузера, а не региональному формату вашей системы.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24-часовой',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12-часовой',
  'workbench.settings.def.appearance.accentColor.label': 'Акцентный цвет',
  'workbench.settings.def.appearance.accentColor.description':
    'Основной цвет кнопок, ссылок и активных выделений. Действует только для вариантов тем «По умолчанию» — высококонтрастные и тонированные варианты закрепляют собственный акцент.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Показывать версию',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'Показывать номер версии расширения в строке состояния рабочего пространства.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': 'Показывать переключатель темы',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'Показывать выпадающий список темы (светлая / тёмная / авто) в строке состояния рабочего пространства.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': 'Показывать переключатели панелей',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Показывать значки переключения левой / нижней / правой панели в верхней панели рабочего пространства.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': 'Показывать меню компоновки',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'Показывать выпадающее меню компоновки (нижняя панель на всю ширину, подписи окон инструментов, компоновка боковой панели) в верхней панели рабочего пространства.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Выравнивание нижней панели',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'Где нижняя панель располагается в оболочке. Слева / справа выравнивает её под одной боковой панелью и редактором; по центру вкладывает в среднюю колонку; по ширине растягивает на всю область просмотра.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'По центру',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Нижняя панель вложена в среднюю колонку',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Слева',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    'Нижняя панель под левой боковой панелью и редактором',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Справа',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    'Нижняя панель под редактором и правой боковой панелью',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'По ширине',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'Нижняя панель на всю ширину области просмотра',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': 'Разделение нижней панели',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    'Как два открытых нижних дока делят нижнюю панель: рядом друг с другом или один над другим.',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': 'Рядом',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description':
    'Нижние доки располагаются рядом друг с другом',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': 'Друг над другом',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description':
    'Нижние доки располагаются один над другим',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': 'Показывать имена окон инструментов',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'Показывать текстовые подписи рядом со значками панели действий и вкладок доков. Выключите для компактной оболочки из одних значков.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': 'Ширина левой панели действий',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'Ширина левой панели действий, когда подписи окон инструментов видны. В режиме одних значков фиксирована на 36px.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': 'Ширина правой панели действий',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'Ширина правой панели действий, когда подписи окон инструментов видны. В режиме одних значков фиксирована на 36px.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'Компоновка панели действий',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'Как панель действий делит верхнюю и нижнюю группы окон инструментов.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Пропорционально',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    'Верхняя и нижняя группы делят панель действий поровну',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Компактно',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'Верхняя группа по содержимому; нижняя прижата к низу',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Стопкой',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'Все группы собраны сверху с разделителями между ними',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Динамически',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Группы чипов повторяют высоту соседних панелей. Закрытые доки сжимаются по содержимому, а живые соседи занимают освободившееся место.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Режим отладки',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Изучайте и изменяйте запросы с той же глубиной, что и встроенные инструменты разработчика браузера — загрузки страниц, воркеры и iframe, а не только запросы уровня страницы. Пока это включено, браузер показывает баннер отладки на каждой подключённой вкладке; по умолчанию выключено, и включить можно в любой момент.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'Режим отладки доступен в браузерах Chrome и Edge.',
  'workbench.settings.def.inspection.cdpScope.label': 'К каким вкладкам подключаться',
  'workbench.settings.def.inspection.cdpScope.description':
    'К каким вкладкам режим отладки подключается, пока он включён. «Где открыто окно DevTools» подключается к вкладкам браузера с открытыми инструментами разработчика. «Вкладка в фокусе» следует за активной вкладкой браузера без открытых инструментов разработчика — переход на новую или служебную вкладку оставляет подключённой предыдущую, а не дёргает подключение. «Обе» объединяет оба варианта. Отдельные вкладки браузера можно также закрепить из футера независимо от этого выбора.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'Режим отладки доступен в браузерах Chrome и Edge.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Где открыто окно DevTools',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Вкладки браузера с открытыми инструментами разработчика.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'Вкладка в фокусе',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'Активная вкладка браузера, следуя за фокусом — инструменты разработчика не нужны.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Обе',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'Вкладки с DevTools и активная вкладка.',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': 'Начинать захват в режиме отладки',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    'Новые захваты подключают отладчик браузера ради полной точности — тел ответов и точных заголовков. Браузер показывает баннер отладки на вкладке. Каждый жест запуска может переопределить это в разделе «Дополнительно».',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': 'Сохранять захваты в архив',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    'Новые захваты записываются в зашифрованный архив сеансов на этом компьютере. Каждый жест запуска может переопределить это в разделе «Дополнительно».',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label': 'Разрешить чтение сеансов без скрытия',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    'Подключённые агенты читают архивные сеансы с настоящими значениями вместо маркеров скрытия — включая заголовки аутентификации, cookie и значения, похожие на токены. По умолчанию выключено; пока включено, каждое чтение без скрытия записывается в Ленту активности.',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': 'Бюджет размера архива (GiB)',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    'Общее место на диске для архивных сеансов. Когда архив превышает бюджет, первыми удаляются самые старые запечатанные сеансы; сеанс, который ещё записывается, не удаляется никогда.',
  'workbench.settings.def.trafficMonitor.railSide.label': 'Сторона источников',
  'workbench.settings.def.trafficMonitor.railSide.description':
    'С какой стороны панели «Трафик» находится список источников. Кнопка компоновки в заголовке панели тоже переключает её.',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': 'Слева',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description':
    'Список источников слева, представления трафика справа.',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': 'Справа',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description':
    'Список источников справа, представления трафика слева.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Размер шрифта',
  'workbench.settings.def.editor.fontSize.description': 'Размер шрифта в пикселях для поверхностей редактора.',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Семейство шрифтов',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    'Подобранные моноширинные наборы для редактора. Каждый вариант поставляется с расширением — устанавливать в систему ничего не нужно. По умолчанию — JetBrains Mono в Windows / Linux ради единообразия между платформами и System Mono в macOS, чтобы сохранить родное отображение SF Mono.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Стандартный моноширинный шрифт операционной системы — SF Mono в macOS, Consolas в Windows, Liberation Mono в Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Моноширинный шрифт с программистскими лигатурами. Встроен — всегда доступен.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Моноширинный шрифт, настроенный для редакторов, с лигатурами. Встроен — всегда доступен.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Моноширинный шрифт с программистскими лигатурами. Встроен — всегда доступен.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Моноширинный шрифт Adobe, настроенный для кода. Встроен — всегда доступен.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'Пиксельный декоративный шрифт, который мы поставляем с приложением. Встроен — всегда доступен. Выбор ради забавы: читаем, но высок и широк.',
  'workbench.settings.def.editor.fontLigatures.label': 'Лигатуры шрифта',
  'workbench.settings.def.editor.fontLigatures.description':
    'Включить программистские лигатуры — объединять последовательности символов вроде `=>` или `!=` в один глиф. Требуется шрифт с поддержкой лигатур (например, Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Высота строки',
  'workbench.settings.def.editor.lineHeight.description':
    'Высота строки редактора в пикселях. 0 позволяет редактору выбрать высоту пропорционально размеру шрифта; значения от 8 и выше трактуются как точные пиксели.',
  'workbench.settings.def.editor.tabSize.label': 'Размер табуляции',
  'workbench.settings.def.editor.tabSize.description': 'Сколько столбцов занимает символ табуляции.',
  'workbench.settings.def.editor.insertSpaces.label': 'Вставлять пробелы',
  'workbench.settings.def.editor.insertSpaces.description':
    'Вставлять пробелы вместо символов табуляции при нажатии Tab.',
  'workbench.settings.def.editor.wordWrap.label': 'Перенос строк',
  'workbench.settings.def.editor.wordWrap.description': 'Переносить ли длинные строки на следующую строку в редакторе.',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Выключено',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'По ширине области просмотра',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'По столбцу',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Столбец переноса строк',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Столбец, на котором переносятся строки, когда перенос строк установлен в «По столбцу».',
  'workbench.settings.def.editor.lineNumbers.label': 'Номера строк',
  'workbench.settings.def.editor.lineNumbers.description': 'Показывать номера строк в левом поле.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Отображать пробелы',
  'workbench.settings.def.editor.renderWhitespace.description': 'Визуально отображать пробельные символы.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'Нет',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Только на границах',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'Все',
  'workbench.settings.def.editor.renderLineEnds.label': 'Отображать концы строк',
  'workbench.settings.def.editor.renderLineEnds.description':
    'Рисовать бледный ¬ после последнего символа каждой настоящей строки, чтобы мягко перенесённые строки (пустой номер в поле, висячий отступ, без знака) нельзя было спутать с переводами строки. Только отображение: знак никогда не выделяется, не копируется и не отправляется.',
  'workbench.settings.def.editor.formatOnSave.label': 'Форматировать при сохранении',
  'workbench.settings.def.editor.formatOnSave.description':
    'Автоматически форматировать содержимое редактора при сохранении правила или шаблона.',
  'workbench.settings.def.editor.bracketPairColorization.label': 'Раскраска парных скобок',
  'workbench.settings.def.editor.bracketPairColorization.description': 'Подсвечивать парные скобки разными цветами.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.trustedRoots.label': 'Сертификаты рабочего пространства',
  'workbench.settings.def.requests.trustedRoots.description':
    'Центры сертификации, которым это рабочее пространство доверяет помимо встроенных корневых, — применяются к каждому TLS-соединению, которое устанавливает среда выполнения приложения. Доступны каждому участнику рабочего пространства — публичный материал, никогда не секрет.',
  'workbench.settings.def.requests.deviceTrust.label': 'Сертификаты устройства',
  'workbench.settings.def.requests.deviceTrust.description':
    'Сертификаты, которые эта машина закрепляет рядом со списком рабочего пространства, — самоподписанный localhost, тестовый сервер. Никогда не синхронизируются и не экспортируются; применяются к каждому TLS-соединению, которое среда выполнения приложения устанавливает с этого устройства.',
  'workbench.settings.def.requests.systemTrust.label': 'Системное хранилище доверия',
  'workbench.settings.def.requests.systemTrust.description':
    'Доверять также сертификатам из хранилища операционной системы этой машины — корневому сертификату, который ИТ-профиль установил для корпоративного прокси. Добавляется рядом со встроенными корневыми, списком рабочего пространства и закреплёнными на устройстве; никогда не синхронизируется и не экспортируется.',
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Предел тела ответа (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    'Какую часть тела ответа исполнитель хранит для показа. Более крупные тела обрезаются на этом пределе — полный размер по-прежнему измеряется и сообщается. Повышение предела увеличивает расход памяти на каждую открытую вкладку запроса.',
  'workbench.settings.def.requests.executionPlace.label': 'Место выполнения',
  'workbench.settings.def.requests.executionPlace.description': 'Где запросы API открывают соединение, если коллекция, папка или запрос не задают своё: на этом устройстве, в настольном приложении или на сервере рабочего пространства.',
  'workbench.settings.def.requests.executionPlace.option.auto.label': 'Автоматически',
  'workbench.settings.def.requests.executionPlace.option.auto.description': 'Выполняется здесь, когда это устройство может, иначе — в единственном месте, которое может.',
  'workbench.settings.def.requests.executionPlace.option.here.label': 'Это устройство',
  'workbench.settings.def.requests.executionPlace.option.here.description': 'Соединение открывает поверхность, с которой вы отправляете.',
  'workbench.settings.def.requests.executionPlace.option.desktop-app.label': 'Настольное приложение',
  'workbench.settings.def.requests.executionPlace.option.desktop-app.description': 'Соединение открывает настольное приложение на этом устройстве.',
  'workbench.settings.def.requests.executionPlace.option.workspace-server.label': 'Сервер рабочего пространства',
  'workbench.settings.def.requests.executionPlace.option.workspace-server.description': 'Соединение открывает сервер, предоставляющий рабочее пространство; разрешённые значения передаются на него.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'Сначала новые',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Порядок списка событий Server-Sent Events — новые события сверху. Выключите, чтобы читать сначала старые. Панель инструментов списка меняет тот же параметр.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'Группировать по имени события',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Собирать список событий Server-Sent Events под сворачиваемыми заголовками по имени события, сохраняя порядок поступления внутри каждой группы. Панель инструментов списка меняет тот же параметр.',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'Строк на группу',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'При группировке по имени события показывать только столько новейших событий каждой группы — окно сдвигается по мере поступления новых событий, так что за несколькими группами можно следить одновременно. 0 показывает все события. Панель инструментов списка меняет тот же параметр.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'Сначала новые',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Порядок хронологии сообщений gRPC — новые сообщения сверху. Выключите, чтобы читать сначала старые. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.label': 'Включать значения по умолчанию',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.description':
    'Показывать поля, которые ответ gRPC не передал по сети, с их значениями по умолчанию — нулевые числа, пустые строки, false, первое значение перечисления, пустые списки и словари — так, как proto3 JSON выводит значения по умолчанию. По умолчанию выключено: ответ показывает поля, которые сервер действительно отправил. Поля с признаком присутствия (сообщения, optional, члены oneof) отсутствуют в любом случае. Меню ⋯ панели ответа меняет тот же параметр.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'Показывать типы сообщений',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Помечать каждую строку хронологии объявленным типом сообщения protobuf. По умолчанию выключено — типы rpc фиксированы для каждого направления, так что значок направления уже различает строки. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'Группировать по типу сообщения',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'Собирать хронологию сообщений gRPC под сворачиваемыми заголовками по типу сообщения, сохраняя порядок поступления внутри каждой группы. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': 'Группировать по направлению',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    'Собирать хронологию сообщений gRPC под сворачиваемыми заголовками «отправлено / получено». Вместе с группировкой по типу сообщения каждая пара (тип, направление) получает свою группу — полезно для двунаправленных вызовов, у которых запрос и ответ используют один тип сообщения. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'Строк на группу',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'При группировке по типу сообщения показывать только столько новейших сообщений каждой группы — окно сдвигается по мере поступления новых сообщений, так что за несколькими группами можно следить одновременно. 0 показывает все сообщения. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.label': 'Сначала новые',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.description':
    'Порядок хронологии сообщений MQTT — новые сообщения сверху. Выключите, чтобы читать сначала старые. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'Сначала новые',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Порядок хронологии сообщений WebSocket — новые сообщения сверху. Выключите, чтобы читать сначала старые. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': 'Группировать по направлению',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    'Собирать хронологию сообщений WebSocket под сворачиваемыми заголовками «отправлено / получено», сохраняя порядок поступления внутри каждой группы. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': 'Группировать по событию',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    'Собирать хронологии сеансов Socket.IO под сворачиваемыми заголовками по декодированному имени события (управляющие фреймы группируются по своему сетевому типу). Вместе с группировкой по направлению каждая пара (событие, направление) получает свою группу. Действует только для сеансов Socket.IO — у сырых фреймов WebSocket нет имён событий. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.label': 'Скрывать heartbeat',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.description':
    'Скрывать строки keep-alive ping / pong протокола engine.io в хронологиях сеансов Socket.IO. Фреймы по-прежнему захватываются и экспортируются — фильтруется только отображение. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesHideHandshake.label': 'Скрывать фреймы рукопожатия',
  'workbench.settings.def.requests.wsMessagesHideHandshake.description':
    'Скрывать строки служебного обмена рукопожатия Socket.IO — open / close протокола engine.io и подключение к пространству имён с его подтверждением — в хронологиях сеансов. Отключения и ошибки подключения показываются всегда. Фреймы по-прежнему захватываются и экспортируются. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': 'Строк на группу',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    'При группировке по направлению показывать только столько новейших сообщений каждой группы — окно сдвигается по мере поступления новых сообщений, так что за обеими группами можно следить одновременно. 0 показывает все сообщения. Панель инструментов хронологии меняет тот же параметр.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'Отправлять недопустимые сообщения',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'Когда сообщение gRPC — не валидный JSON, всё равно вызывать с пустым сообщением и дать серверу ответить — обычно INVALID_ARGUMENT. По умолчанию выключено: вызов завершается ошибкой до отправки в сеть с точным сообщением о разборе.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'Приостановить выполнение правил',
  'workbench.settings.def.rulesEngine.paused.description':
    'Перестать применять правила к живым сетевым запросам. Правила остаются редактируемыми.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': 'Стратегия вычисления',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'Как движок выбирает между правилами, когда одному запросу соответствуют несколько.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'Первое совпадение',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    'Использовать первое правило в порядке приоритета',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Ближайшее совпадение',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Предпочитать самое конкретное совпавшее правило',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'Все совпавшие',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    'Применять каждое совпавшее правило по порядку',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Дебаунс обновлений',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Задержка (ms) перед отправкой правок правил в declarativeNetRequest.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Максимум активных правил',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Максимальное число правил, одновременно компилируемых в динамический набор правил.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Видимые типы ресурсов',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'Какие типы ресурсов запросов показываются в представлении «Эта страница» всплывающего окна. Собирается всегда всё; это меняет только то, что показывает интерфейс. Встроенная строка чипов во всплывающем окне записывает тот же параметр.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'Показывать предупреждения о перекрытии',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'Подсвечивать правила, эффект которых перекрыт правилом с более высоким приоритетом (блокировка, перенаправление, имитация, задержка или конфликт наложения заголовков).',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Предупреждать о больших наборах правил',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Показывать предупреждение, когда число активных правил приближается к пределу браузера.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Порог большого набора правил',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    'Число активных правил, при котором срабатывает предупреждение.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Режим живых правил',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'Внедряет Cache-Control: no-cache в каждый запрос, совпавший с одним из ваших правил, принуждая к повторной проверке на сервере, чтобы эффект правила всегда применялся заново. Не даёт устаревшим кешированным ответам скрыть правило — полезно, когда значение правила меняется (например, токен авторизации), а страница продолжает отдавать старый ответ из кеша.',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'Обходить HTTP-кеш',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    'Добавляет Cache-Control: no-cache в каждый запрос на наблюдаемой вкладке — принуждает к повторной проверке на сервере. Область — только HTTP-кеш; собственная функция «Отключить кеш» браузера Chrome (вкладка Network) обходит ещё и кеш в памяти отрисовщика. Запросы, совпавшие с правилами, всегда автоматически поддерживаются свежими режимом живых правил.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Автодополнение переменных',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Предлагать ссылки `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` по мере ввода. Открывается по `{{` в любом поле значения правила и в редакторах тела JSON/GraphQL/XML/plaintext. Выключите, если предпочитаете редактирование обычного текста.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': 'Стратегия URL для черновиков',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'Как предзаполненные правила из инспектора DevTools превращают захваченный URL-адрес в шаблон url-filter. Точный (по умолчанию) сохраняет URL-адрес дословно, так что правило совпадает только с изученным запросом. Подстановка в пути заменяет последний сегмент пути на *, чтобы совпадали соседние ресурсы. Только хост расширяет на весь домен.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'Точный URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Совпадать с этим URL-адресом дословно, с нормализацией (рекомендуется)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Подстановка в пути',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Заменить последний сегмент пути подстановочным знаком',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Только хост',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    'Совпадать с каждым запросом на хосте',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'Исходный URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Совпадать с этим URL-адресом дословно, без нормализации',

  // ── Diff Viewer category defs ──────────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    'Показывать стратегию объединения в строках',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    'Когда включено, каждая строка сущности в левой боковой панели предпросмотра импорта показывает выбранную стратегию объединения («Добавить как новые», «Заменить», «Пропустить», …) рядом со счётчиками строк. Выключите, чтобы освободить ширину строки в узких панелях.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': 'Компоновка',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Показывать целевую и входящую версии рядом или в едином встроенном виде. Автоматически переключается на единый вид, когда панель сравнения слишком узкая.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Рядом',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Единый',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label': 'Обработка пробелов',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Считать ли изменения только в пробелах правками или скрывать их.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'Не игнорировать',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Игнорировать пробелы',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    'Сворачивать неизменённые области',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Скрывать серии неизменённых строк, заменяя их заглушкой, раскрываемой по щелчку.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label': 'Показывать пробельные символы',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Отображать пробелы и табуляции видимыми глифами (·, →) в сравнении.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label': 'Показывать номера строк',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Показывать столбец номеров строк в поле рядом с каждой стороной сравнения.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label': 'Показывать направляющие отступов',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'Отображать вертикальные направляющие отступов, чтобы вложенность YAML было легче просматривать.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label': 'Мягкий перенос длинных строк',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Переносить длинные строки на следующую визуальную строку вместо горизонтальной прокрутки.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Уровень журнала',
  'workbench.settings.def.data.logLevel.description':
    'Подробность журнала расширения. Каждый уровень включает все уровни выше него.',
  'workbench.settings.def.data.logLevel.option.error.label': 'Ошибки',
  'workbench.settings.def.data.logLevel.option.error.description': 'Только сбои',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Предупреждения',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Аномалии и повторы',
  'workbench.settings.def.data.logLevel.option.info.label': 'Информация',
  'workbench.settings.def.data.logLevel.option.info.description': 'Рабочие события',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Отладка',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Подробные внутренние события',
  'workbench.settings.def.data.exportSettings.label': 'Экспорт настроек',
  'workbench.settings.def.data.exportSettings.description': 'Скачать все настройки как JSON-файл.',
  'workbench.settings.def.data.exportSettings.action.label': 'Экспортировать',
  'workbench.settings.def.data.importSettings.label': 'Импорт настроек',
  'workbench.settings.def.data.importSettings.description':
    'Загрузить настройки из ранее экспортированного JSON-файла.',
  'workbench.settings.def.data.importSettings.action.label': 'Импортировать…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Экспорт диагностического журнала',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Скачать последние 500 структурированных событий (пересборки правил, ошибки запросов, переключения рабочих пространств) как JSON. Только локально; ничто не покидает устройство, если вы сами не приложите файл к отчёту об ошибке.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Экспортировать журнал',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Очистка диагностического журнала',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'Удалить все накопленные события. Не затрагивает правила, запросы и данные рабочих пространств.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Очистить',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    'Очистить диагностический журнал? Все накопленные события будут удалены.',
  'workbench.settings.def.data.exportImportReports.label': 'Экспорт отчётов об импорте',
  'workbench.settings.def.data.exportImportReports.description':
    'Скачать структурированные отчёты об отброшенном и преобразованном для каждого импорта (сегодня curl; далее HAR / Postman / Insomnia) как JSON. Хранятся по рабочим пространствам — 50 последних импортов на пространство. Ничто не покидает устройство, если вы сами не приложите файл.',
  'workbench.settings.def.data.exportImportReports.action.label': 'Экспортировать отчёты',
  'workbench.settings.def.data.clearImportReports.label': 'Очистка отчётов об импорте',
  'workbench.settings.def.data.clearImportReports.description':
    'Удалить все отчёты об импорте активного рабочего пространства. Не затрагивает сами запросы — только журнал того, что было отброшено или преобразовано при импорте.',
  'workbench.settings.def.data.clearImportReports.action.label': 'Очистить',
  'workbench.settings.def.data.clearImportReports.confirm':
    'Очистить отчёты об импорте для этого рабочего пространства? Это действие нельзя отменить.',
  'workbench.settings.def.data.uploadFile.label': 'Загрузить файл',
  'workbench.settings.def.data.uploadFile.description':
    'Добавить файл в активное рабочее пространство для использования в телах multipart и ссылках `{{file.X}}`. Файлы адресуются по содержимому (sha256), так что повторная загрузка тех же байтов остаётся одним блобом. Хранилище — локальный IndexedDB; ничто не покидает устройство.',
  'workbench.settings.def.data.uploadFile.action.label': 'Загрузить…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Экспорт манифеста файлов',
  'workbench.settings.def.data.exportFilesManifest.description':
    'Скачать список файлов активного рабочего пространства (имя файла, хеш, размер, MIME-тип) как JSON. Байты НЕ включаются — это манифест для аудита и повторной загрузки коллегами, а не резервная копия содержимого.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Экспортировать манифест',
  'workbench.settings.def.data.filesBrowser.label': 'Файлы',
  'workbench.settings.def.data.filesBrowser.description':
    'Каждый загруженный блоб активного рабочего пространства. Скачивайте байты, копируйте короткий хеш или удаляйте. Метаданные файлов (имя файла, размер, MIME-тип, хеш) доступны для поиска по индексу настроек.',
  'workbench.settings.def.data.clearAllFiles.label': 'Удалить все файлы',
  'workbench.settings.def.data.clearAllFiles.description':
    'Удалить все файловые блобы активного рабочего пространства. Запросы, ссылающиеся на эти файлы через части multipart, при выполнении дадут ошибку; файлы придётся загрузить заново или изменить такие запросы.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Удалить все',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'Удалить все файлы в этом рабочем пространстве? Части multipart, ссылающиеся на них, при отправке дадут ошибку.',
  'workbench.settings.def.data.resetAllSettings.label': 'Сбросить все настройки',
  'workbench.settings.def.data.resetAllSettings.description':
    'Вернуть каждому параметру каждой категории значение по умолчанию.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Сбросить по умолчанию',
  'workbench.settings.def.data.resetAllSettings.confirm':
    'Сбросить все параметры до значений по умолчанию? Это действие нельзя отменить.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Обновление программы',
  'workbench.settings.def.updates.state.description':
    'Текущее состояние обновления. Загрузка и установка всегда требуют вашего явного нажатия.',
  'workbench.settings.def.updates.check.label': 'Проверять обновления',
  'workbench.settings.def.updates.check.description':
    'Искать новые версии раз в день и показывать точку уведомления, когда версия доступна. Проверка ничего не загружает и ничего не отправляет о вас или этой установке — она читает публичный список версий и сравнивает локально. «Только исправления безопасности» молчит, пока выпуск не исправит проблему безопасности, затрагивающую вашу версию. Обновления никогда не устанавливаются без вашего явного действия.',
  'workbench.settings.def.updates.check.option.all.label': 'Все выпуски',
  'workbench.settings.def.updates.check.option.security-only.label': 'Только исправления безопасности',
  'workbench.settings.def.updates.check.option.off.label': 'Выключено',
  'workbench.settings.def.updates.channel.label': 'Канал обновлений',
  'workbench.settings.def.updates.channel.description':
    'За какой линией выпусков следуют проверки обновлений. Бета получает новые функции раньше, но может быть менее отполирована. Возврат на стабильный канал никогда не откатывает версию — установленная остаётся, пока её не обгонит следующий стабильный выпуск. Уведомления безопасности на любом канале всегда следуют стабильной линии.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Стабильный',
  'workbench.settings.def.updates.channel.option.beta.label': 'Бета',
  'workbench.settings.def.updates.showWhatsNew.label': 'Показывать «Что нового» после обновления',
  'workbench.settings.def.updates.showWhatsNew.description':
    'Открывать вкладку с главным из выпуска при первом открытии рабочей среды после выпуска с новыми функциями. Патч-выпуски её никогда не открывают — они остаются в хронологии уведомлений. Заметки поставляются внутри приложения; ничего не загружается.',
  'workbench.settings.def.updates.autoDownload.label': 'Загружать обновления автоматически',
  'workbench.settings.def.updates.autoDownload.description':
    'Когда обновление найдено, сразу загружать его в фоне, чтобы установка сводилась к одному нажатию «Обновить и перезапустить» — а простой выход и повторное открытие приложения запускали новую версию. Когда выключено, ничего не загружается, пока вы сами не выберете «Обновить и перезапустить». В любом случае приложение никогда не перезапускается само.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Версия',
  'workbench.settings.def.about.version.description': 'Установленная сейчас версия расширения.',
  'workbench.settings.def.about.build.label': 'Сборка',
  'workbench.settings.def.about.build.description': 'Номер и дата сборки.',
  'workbench.settings.def.about.commit.label': 'Коммит',
  'workbench.settings.def.about.commit.description': 'Коммит Git, из которого собрана эта сборка.',
  'workbench.settings.def.about.protocol.label': 'Протокол',
  'workbench.settings.def.about.protocol.description':
    'Версия сетевого протокола, на котором это расширение общается с настольным приложением. Пиры с несовпадающей версией отклоняются с понятным предложением обновиться.',
  'workbench.settings.def.about.browser.label': 'Браузер',
  'workbench.settings.def.about.browser.description': 'Обнаруженные браузер и платформа.',
  'workbench.settings.def.about.openSource.label': 'Встроенные пакеты',
  'workbench.settings.def.about.openSource.description':
    'Открытое ПО, включённое в эту сборку, с лицензией каждого пакета.',
} as const satisfies Catalog;
