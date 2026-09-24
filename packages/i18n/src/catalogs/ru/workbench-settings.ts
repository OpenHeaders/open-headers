/**
 * Workbench settings — shell chrome — Russian. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `MCP` / `Git` / `TLS` / `HTTP` / `SSE` / `gRPC` / `WebSocket` / `MQTT`
 * as dev tokens (MCP-сервер / API-запросы as hyphenated appositions),
 * the DevTools-panel tab names in category labels (Network, Headers,
 * Initiator, Cookies, Timing, Waterfall — panel parity vocabulary),
 * `MIME` / `Hash` / `Multipart`, and the {version} / {when} /
 * {message} / {filename} / {sessionId} / {installId} holes with a
 * head noun (версия {version}, сеанс {sessionId}, установка
 * {installId}). Category labels quoted by shipped files copy them
 * verbatim: «Резервное копирование и синхронизация» (shared-workspace),
 * «Ваши устройства» (shared-components' «… › Ваши устройства»),
 * «Инструменты › Трафик» (workbench-chrome-sidebar), Режим отладки,
 * Браузерный перехватчик (workbench-chrome), Управление версиями,
 * Обновить и перезапустить + примечания к выпуску (shared-chrome).
 * MINTS: параметр = a countable setting row (the page stays
 * Настройки; {count} параметр / параметра / параметров); сбросить =
 * reset; панель DevTools = the DevTools panel; Компоновка = the Layout
 * nav label; строка состояния = status bar; верхняя панель = top bar;
 * футер carried; Просмотрщик Diff = Diff Viewer; профиль = terminal
 * profile; подсчёт использования = usage counting (telemetry);
 * Подключение = Connectivity (category — the editors' Соединение stays
 * the connection GROUP) / Синхронизация = Sync; Настольное приложение
 * / Дополнительно = the Desktop app / Advanced categories; Движок
 * правил = Rules Engine; Оболочка = Shell; место = a seat, уровень =
 * tier (бесплатный уровень); Среда = the About Environment sub (not
 * окружение = the variable environment); Открытое ПО = Open-Source
 * Software.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Настройки',
  'workbench.settings.shell.openInEditor': 'Открыть в редакторе',
  'workbench.settings.shell.openInEditorSoon': 'Открыть в редакторе (скоро)',
  'workbench.settings.shell.maximize': 'Развернуть',
  'workbench.settings.shell.restoreWindow': 'Восстановить',
  'workbench.settings.shell.hint.search': 'Поиск',
  'workbench.settings.shell.hint.navigate': 'Навигация',
  'workbench.settings.shell.hint.select': 'Выбрать',
  'workbench.settings.shell.hint.clearClose': 'Очистить / Закрыть',
  'workbench.settings.shell.noneRegistered': 'Нет зарегистрированных параметров.',
  'workbench.settings.shell.resetAll': 'Сбросить все',
  'workbench.settings.shell.resetAllCount': 'Сбросить все ({count})',
  'workbench.settings.shell.resetAllTitle': 'Сбросить все настройки?',
  'workbench.settings.shell.resetAllNone': 'Сбрасывать нечего — все параметры имеют значения по умолчанию.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Вернуть {count} параметру значение по умолчанию.',
      few: 'Вернуть {count} параметрам значения по умолчанию.',
      many: 'Вернуть {count} параметрам значения по умолчанию.',
      other: 'Вернуть {count} параметрам значения по умолчанию.',
    }),
  'workbench.settings.shell.resetConfirm': 'Сбросить',
  'workbench.settings.shell.searchResults': 'Результаты поиска',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} совпадение для',
      few: '{count} совпадения для',
      many: '{count} совпадений для',
      other: '{count} совпадений для',
    }),
  'workbench.settings.shell.noMatchesFor': 'Нет параметров по запросу',
  'workbench.settings.shell.jumpToCategory': 'Перейти к категории',
  'workbench.settings.shell.navAria': 'Категории настроек',
  'workbench.settings.shell.showCategoryNames': 'Показывать имена категорий',
  'workbench.settings.shell.otherGroup': 'Прочее',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Отличается от значения по умолчанию',
  'workbench.settings.row.modifiedAria': 'изменено',
  'workbench.settings.row.resetToDefault': 'Сбросить по умолчанию',
  'workbench.settings.row.experimental': 'Экспериментально',
  'workbench.settings.row.desktopBadge': 'Настольное',
  'workbench.settings.row.desktopTip':
    'Требуется активное соединение с настольным приложением Open Headers. Настольное приложение хранит авторитетное значение.',
  'workbench.settings.row.capabilityUnavailable': 'Этот браузер не поддерживает этот параметр.',
  'workbench.settings.row.connectionRequired': 'Подключите настольное приложение, чтобы изменить этот параметр.',
  'workbench.settings.row.aboutAria': 'О параметре «{label}»',
  'workbench.settings.row.disabledCapabilityAria': 'Недоступно — не поддерживается в этом браузере',
  'workbench.settings.row.disabledConnectionAria': 'Недоступно — требуется соединение с настольным приложением',
  'workbench.settings.row.managed': 'Управляется вашей организацией',
  'workbench.settings.row.managedBadge': 'Управляется',
  'workbench.settings.row.disabledManagedAria': 'Недоступно — управляется вашей организацией',
  'workbench.settings.row.run': 'Запустить',
  'workbench.settings.row.presetsHeading': 'Предустановки',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Резервное копирование и синхронизация',
  'workbench.settings.category.backend.description':
    'Где хранятся резервные копии ваших рабочих пространств и с чем они синхронизируются — настольное приложение на этом компьютере или сервер, который запускаете вы или ваша команда.',
  'workbench.settings.category.backendConnections.label': 'Синхронизация',
  'workbench.settings.category.backendConnections.description':
    'Места, с которыми синхронизируются ваши рабочие пространства, и способ входа в них.',
  'workbench.settings.category.backendServer.label': 'Ваши устройства',
  'workbench.settings.category.backendServer.description':
    'Разрешите другим вашим устройствам синхронизироваться с этим компьютером и просматривайте сопряжённые устройства.',
  'workbench.settings.category.backendServer.sub.network': 'Сеть',
  'workbench.settings.category.backendServer.sub.peer-requests': 'Запросы от пиров',
  'workbench.settings.category.backendServer.sub.devices': 'Устройства',
  'workbench.settings.category.backendPairing.label': 'Настольное приложение',
  'workbench.settings.category.backendPairing.description':
    'Как этот браузер подключается к настольному приложению на этом компьютере и что приложению разрешено видеть.',
  'workbench.settings.category.backendPairing.sub.automatic': 'Автоматически',
  'workbench.settings.category.backendPairing.sub.policy': 'Политика',
  'workbench.settings.category.backendPairing.sub.sharing': 'Совместный доступ',
  'workbench.settings.category.backendReliability.label': 'Дополнительно',
  'workbench.settings.category.backendReliability.description':
    'Повторное подключение, состояние и автономный режим для каждого соединения синхронизации.',
  'workbench.settings.category.backendReliability.sub.reconnection': 'Повторное подключение',
  'workbench.settings.category.backendReliability.sub.status': 'Состояние',
  'workbench.settings.category.backendReliability.sub.offline-fallback': 'Автономный режим',
  'workbench.settings.category.mcp.label': 'ИИ · MCP-сервер',
  'workbench.settings.category.mcp.description':
    'Разрешите ИИ-агентам и другим MCP-клиентам читать это приложение и управлять им. Доступ многоуровневый — чтение, запись, выполнение и раскрытие секретов включаются отдельно, по умолчанию всё выключено.',
  'workbench.settings.category.mcpAccess.label': 'Доступ',
  'workbench.settings.category.mcpAccess.description':
    'Включите сервер и выберите, что разрешено подключённым агентам. Каждый уровень по умолчанию выключен.',
  'workbench.settings.category.mcpAccess.sub.server': 'Сервер',
  'workbench.settings.category.mcpAccess.sub.permissions': 'Разрешения',
  'workbench.settings.category.mcpClients.label': 'Клиенты',
  'workbench.settings.category.mcpClients.description': 'Подключите oh CLI и MCP-клиенты к этому приложению.',
  'workbench.settings.category.mcpClients.sub.command-line': 'Командная строка',
  'workbench.settings.category.mcpClients.sub.configuration': 'Конфигурация',
  'workbench.settings.category.appearanceBehavior.label': 'Оформление и поведение',
  'workbench.settings.category.appearanceBehavior.description':
    'Как приложение выглядит и ведёт себя — язык, тема и оболочка рабочей среды.',
  'workbench.settings.category.general.label': 'Общие',
  'workbench.settings.category.general.description': 'Поведение всего приложения, запуск и язык.',
  'workbench.settings.category.general.sub.locale': 'Язык',
  'workbench.settings.category.general.sub.behavior': 'Поведение',
  'workbench.settings.category.general.sub.settings': 'Настройки',
  'workbench.settings.category.general.sub.privacy': 'Конфиденциальность',
  'workbench.settings.category.appearance.label': 'Оформление',
  'workbench.settings.category.appearance.description': 'Тема, плотность и внешний вид.',
  'workbench.settings.category.appearance.sub.theme': 'Тема',
  'workbench.settings.category.appearance.sub.interface': 'Интерфейс',
  'workbench.settings.category.workspaceLayout.label': 'Компоновка рабочего пространства',
  'workbench.settings.category.workspaceLayout.description': 'Элементы футера и поведение оболочки окон инструментов.',
  'workbench.settings.category.workspaceLayout.sub.shell': 'Оболочка',
  'workbench.settings.category.workspaceLayout.sub.topbar': 'Верхняя панель',
  'workbench.settings.category.workspaceLayout.sub.footer': 'Футер',
  'workbench.settings.category.tools.label': 'Инструменты',
  'workbench.settings.category.tools.description':
    'Окна инструментов с собственными настройками — терминал, монитор трафика и MCP-сервер.',
  'workbench.settings.category.terminal.label': 'Терминал',
  'workbench.settings.category.terminal.description': 'Поведение встроенного окна инструментов «Терминал».',
  'workbench.settings.category.terminal.sub.shell': 'Оболочка',
  'workbench.settings.category.terminal.sub.appearance': 'Оформление',
  'workbench.settings.category.terminal.sub.behavior': 'Поведение',
  'workbench.settings.category.terminal.sub.tabs': 'Вкладки',
  'workbench.settings.category.devpanel.label': 'Панель DevTools',
  'workbench.settings.category.devpanel.description':
    'Значения по умолчанию для панели DevTools браузера — оболочка окон инструментов и каждая вкладка поверхности запросов.',
  'workbench.settings.category.devpanelLayout.label': 'Компоновка',
  'workbench.settings.category.devpanelLayout.description':
    'Поведение оболочки окон инструментов в панели DevTools браузера.',
  'workbench.settings.category.devpanelLayout.sub.shell': 'Оболочка',
  'workbench.settings.category.devpanelLayout.sub.topbar': 'Верхняя панель',
  'workbench.settings.category.devpanelLayout.sub.footer': 'Футер',
  'workbench.settings.category.devpanelNetwork.label': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Значения по умолчанию для таблицы запросов Network в панели DevTools — компоновка, сортировка, столбец точек.',
  'workbench.settings.category.devpanelNetwork.sub.table': 'Таблица',
  'workbench.settings.category.devpanelNetwork.sub.sorting': 'Сортировка',
  'workbench.settings.category.devpanelNetwork.sub.waterfall': 'Waterfall',
  'workbench.settings.category.devpanelHeaders.label': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'Значения по умолчанию для вкладки Headers в панели DevTools — компоновка, сортировка, фильтры, рекомендации.',
  'workbench.settings.category.devpanelHeaders.sub.view': 'Вид',
  'workbench.settings.category.devpanelHeaders.sub.filters': 'Фильтры',
  'workbench.settings.category.devpanelInitiator.label': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'Значения по умолчанию для вкладки Initiator в панели DevTools — сортировка, фильтры, рекомендации.',
  'workbench.settings.category.devpanelInitiator.sub.view': 'Вид',
  'workbench.settings.category.devpanelInitiator.sub.filters': 'Фильтры',
  'workbench.settings.category.devpanelCookies.label': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'Значения по умолчанию для вкладки Cookies в панели DevTools — столбцы, сортировка, фильтры, рекомендации.',
  'workbench.settings.category.devpanelCookies.sub.view': 'Вид',
  'workbench.settings.category.devpanelCookies.sub.filters': 'Фильтры',
  'workbench.settings.category.devpanelTiming.label': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'Значения по умолчанию для вкладки Timing в панели DevTools — какие полосы показывать.',
  'workbench.settings.category.devpanelTiming.sub.view': 'Вид',
  'workbench.settings.category.inspection.label': 'Режим отладки',
  'workbench.settings.category.inspection.description':
    'Включаемый вручную путь, который подключает протокол отладки вашего браузера — изучайте и изменяйте запросы с той же глубиной, что и встроенные инструменты разработчика.',
  'workbench.settings.category.inspection.sub.protocol': 'Протокол отладки',
  'workbench.settings.category.trafficMonitor.label': 'Трафик',
  'workbench.settings.category.trafficMonitor.description':
    'Значения по умолчанию для жеста начала наблюдения в панели «Трафик» и дисковый бюджет архива сеансов.',
  'workbench.settings.category.trafficMonitor.sub.layout': 'Компоновка',
  'workbench.settings.category.trafficMonitor.sub.capture': 'Захват',
  'workbench.settings.category.trafficMonitor.sub.sessions': 'Сеансы',
  'workbench.settings.category.editor.label': 'Редактор',
  'workbench.settings.category.editor.description': 'Поверхности кода и сравнения внутри каждой вкладки редактора.',
  'workbench.settings.category.codeEditor.label': 'Редактор кода',
  'workbench.settings.category.codeEditor.description':
    'Шрифт, отступы и параметры отображения для поверхностей редактирования кода.',
  'workbench.settings.category.codeEditor.sub.font': 'Шрифт',
  'workbench.settings.category.codeEditor.sub.indentation': 'Отступы',
  'workbench.settings.category.codeEditor.sub.wrapping': 'Перенос строк',
  'workbench.settings.category.codeEditor.sub.display': 'Отображение',
  'workbench.settings.category.codeEditor.sub.editing': 'Редактирование',
  'workbench.settings.category.requests.label': 'API-запросы',
  'workbench.settings.category.requests.description': 'Отправка запросов и обработка ответов для каждого протокола.',
  'workbench.settings.category.requests.sub.tls': 'TLS',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.requests.sub.mqtt': 'MQTT',
  'workbench.settings.category.browserInterceptor.label': 'Браузерный перехватчик',
  'workbench.settings.category.browserInterceptor.description':
    'Браузерная сторона — движок правил, переписывающий трафик, подключение протокола отладки и панель DevTools.',
  'workbench.settings.category.rulesEngine.label': 'Движок правил',
  'workbench.settings.category.rulesEngine.description': 'Как правила вычисляются, компилируются и арбитрируются.',
  'workbench.settings.category.rulesEngine.sub.engine': 'Движок',
  'workbench.settings.category.rulesEngine.sub.caching': 'Кеширование',
  'workbench.settings.category.rulesEngine.sub.warnings': 'Предупреждения',
  'workbench.settings.category.rulesEngine.sub.drafting': 'Составление правил',
  'workbench.settings.category.rulesEngine.sub.display': 'Отображение',
  'workbench.settings.category.keyboard.label': 'Клавиатура',
  'workbench.settings.category.keyboard.description': 'Настройте сочетания клавиш.',
  'workbench.settings.category.keyboard.sub.global': 'Все поверхности',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Рабочая среда',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Рабочая среда · Компоновка',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Рабочая среда · Вкладки',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Рабочая среда · Фокус',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Рабочая среда · Редактор',
  'workbench.settings.category.keyboard.sub.popup-general': 'Всплывающее окно и боковая панель',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Всплывающее окно и боковая панель · Навигация',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Всплывающее окно и боковая панель · Действия со строками',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Всплывающее окно и боковая панель · Вкладки',
  'workbench.settings.category.diffViewer.label': 'Просмотрщик Diff',
  'workbench.settings.category.diffViewer.description':
    'Как отображаются различия — компоновка, пробелы и боковое поле — везде, где приложение сравнивает две версии.',
  'workbench.settings.category.diffViewer.sub.view': 'Вид',
  'workbench.settings.category.diffViewer.sub.importPreview': 'Предпросмотр импорта',
  'workbench.settings.category.versionControl.label': 'Управление версиями',
  'workbench.settings.category.versionControl.description':
    'Рабочие пространства на базе Git — история и рабочее дерево за ними.',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Привяжите это рабочее пространство к папке на диске — живому YAML-дереву, удобному для git.',
  'workbench.settings.category.gitFolder.label': 'Папка',
  'workbench.settings.category.gitFolder.description': 'Папка на диске, к которой привязано это рабочее пространство.',
  'workbench.settings.category.gitFolder.sub.binding': 'Привязка',
  'workbench.settings.category.gitFolder.sub.requirements': 'Требования',
  'workbench.settings.category.gitAutomation.label': 'Автоматизация',
  'workbench.settings.category.gitAutomation.description': 'Что движок коммитит и отправляет самостоятельно.',
  'workbench.settings.category.gitAutomation.sub.commits': 'Коммиты',
  'workbench.settings.category.gitAutomation.sub.remote': 'Удалённый репозиторий',
  'workbench.settings.category.proxy.label': 'Прокси',
  'workbench.settings.category.proxy.description':
    'Исходящий прокси этого устройства — как запросы попадают в сеть — и настройка доверия для прокси захвата.',
  'workbench.settings.category.proxyOutbound.label': 'Исходящие запросы',
  'workbench.settings.category.proxyOutbound.description':
    'Исходящий прокси этого устройства — как запросы, сеансы WebSocket и вызовы gRPC попадают в сеть.',
  'workbench.settings.category.proxyTrust.label': 'Доверие HTTPS',
  'workbench.settings.category.proxyTrust.description':
    'Центр сертификации и хранилища доверия, которые позволяют расшифровывать HTTPS-трафик для изучения — создаются на этой машине, удаляются здесь.',
  'workbench.settings.category.application.label': 'Приложение',
  'workbench.settings.category.application.description': 'Само приложение — его данные, обновления, лицензия и версия.',
  'workbench.settings.category.data.label': 'Данные',
  'workbench.settings.category.data.description': 'Диагностика, импорт/экспорт и необратимое обслуживание.',
  'workbench.settings.category.data.sub.settings': 'Настройки',
  'workbench.settings.category.data.sub.diagnostics': 'Диагностика',
  'workbench.settings.category.data.sub.importReports': 'Отчёты об импорте',
  'workbench.settings.category.data.sub.files': 'Файлы',
  'workbench.settings.category.license.label': 'Лицензия',
  'workbench.settings.category.license.description':
    'Всё, что есть в Open Headers сегодня, включено в каждый уровень — платные планы покрывают места для команды. Бесплатный уровень допускает до 6 активных пользователей на сервер.',
  'workbench.settings.category.updates.label': 'Обновления',
  'workbench.settings.category.updates.description': 'Проверка обновлений, канал и поведение загрузки.',
  'workbench.settings.category.updates.sub.status': 'Состояние',
  'workbench.settings.category.updates.sub.behavior': 'Поведение',
  'workbench.settings.category.about.label': 'О программе',
  'workbench.settings.category.about.description': 'Версия, лицензии и сведения о сборке.',
  'workbench.settings.category.about.sub.application': 'Приложение',
  'workbench.settings.category.about.sub.environment': 'Среда',
  'workbench.settings.category.about.sub.openSource': 'Открытое ПО',
  'workbench.settings.thirdParty.software': 'Программа',
  'workbench.settings.thirdParty.license': 'Лицензия',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': 'В этой сборке обновлениями занимается ваш канал установки.',
  'workbench.settings.updatesRow.checking': 'Проверка обновлений…',
  'workbench.settings.updatesRow.securityFix':
    'Версия {version} исправляет проблему безопасности, затрагивающую эту версию.',
  'workbench.settings.updatesRow.available': 'Доступна версия {version}.',
  'workbench.settings.updatesRow.packageManager': 'Установите её через пакетный менеджер вашего дистрибутива Linux.',
  'workbench.settings.updatesRow.updateAndRestart': 'Обновить и перезапустить',
  'workbench.settings.updatesRow.downloading': 'Загрузка версии {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'Версия {version} готова к установке.',
  'workbench.settings.updatesRow.restartToInstall': 'Перезапустить для установки',
  'workbench.settings.updatesRow.checkFailed': 'Не удалось проверить обновления: {message}',
  'workbench.settings.updatesRow.retry': 'Повторить',
  'workbench.settings.updatesRow.upToDate': 'У вас последняя версия ({version}).',
  'workbench.settings.updatesRow.checkNow': 'Проверить сейчас',
  'workbench.settings.updatesRow.releaseNotes': 'Примечания к выпуску',
  'workbench.settings.updatesRow.lastChecked': 'Последняя проверка: {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': 'Системная оболочка по умолчанию',
  'workbench.settings.terminalProfiles.add': 'Добавить профиль',
  'workbench.settings.terminalProfiles.edit': 'Изменить профиль',
  'workbench.settings.terminalProfiles.remove': 'Удалить профиль',
  'workbench.settings.terminalProfiles.addTitle': 'Добавить профиль терминала',
  'workbench.settings.terminalProfiles.editTitle': 'Изменить профиль терминала',
  'workbench.settings.terminalProfiles.name': 'Имя',
  'workbench.settings.terminalProfiles.shell': 'Путь к оболочке',
  'workbench.settings.terminalProfiles.args': 'Аргументы',
  'workbench.settings.terminalProfiles.cwd': 'Начальный каталог',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Домашний каталог',
  'workbench.settings.terminalProfiles.save': 'Сохранить',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Переименовать файл',
  'workbench.settings.fields.files.renameMissing': 'Файла больше нет в этом рабочем пространстве',
  'workbench.settings.fields.files.renameFailed': 'Не удалось переименовать файл',
  'workbench.settings.fields.files.renameFailedReason': 'Не удалось переименовать файл: {message}',
  'workbench.settings.fields.files.colFilename': 'Имя файла',
  'workbench.settings.fields.files.colSize': 'Размер',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Действия',
  'workbench.settings.fields.files.download': 'Скачать',
  'workbench.settings.fields.files.deleteTitle': 'Удалить {filename}?',
  'workbench.settings.fields.files.deleteWarning':
    'Части Multipart, ссылающиеся на этот файл, при отправке дадут ошибку.',
  'workbench.settings.fields.files.loading': 'Загрузка файлов…',
  'workbench.settings.fields.files.empty': 'Файлов пока нет — используйте действие «Загрузить файл» выше.',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'ключ',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'значение',
  'workbench.settings.fields.keyValue.addEntry': 'Добавить запись',
  'workbench.settings.fields.keybinding.pressCombo': 'Нажмите сочетание клавиш…',
  'workbench.settings.fields.keybinding.record': 'Записать',
  'workbench.settings.fields.keybinding.cancel': 'Отмена',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'Показать события',
  'workbench.settings.telemetryRow.modalTitle': 'События телеметрии за этот сеанс',
  'workbench.settings.telemetryRow.sessionOn': 'Сеанс {sessionId} — подсчёт включён',
  'workbench.settings.telemetryRow.sessionOff': 'Сеанс {sessionId} — подсчёт выключен',
  'workbench.settings.telemetryRow.install':
    'Установка {installId} (случайный идентификатор — обозначает эту установку, а не вас)',
  'workbench.settings.telemetryRow.noInstall': 'Нет идентификатора установки — подсчёт выключен',
  'workbench.settings.telemetryRow.empty': 'За этот сеанс события телеметрии не записаны.',
  'workbench.settings.telemetryRow.confirmTitle': 'Выключить анонимный подсчёт использования?',
  'workbench.settings.telemetryRow.confirmHeading': 'Ваша конфиденциальность уже защищена',
  'workbench.settings.telemetryRow.confirmIntro':
    'Случайный идентификатор считает эту установку — никогда не вас. Личные данные никогда не собираются. Вот что делает подсчёт:',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Показывает, какие функции заслуживают дальнейшей работы',
  'workbench.settings.telemetryRow.confirmPointScope':
    'Считает только использование функций, платформу и версию приложения',
  'workbench.settings.telemetryRow.confirmPointInspect': 'Каждое событие видно байт в байт в окне «Показать события»',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'Без личных данных',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'Без URL-адресов и заголовков',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'Без содержимого запросов',
  'workbench.settings.telemetryRow.confirmKeep': 'Оставить подсчёт включённым',
  'workbench.settings.telemetryRow.confirmDisable': 'Всё равно выключить',
} as const satisfies Catalog;
