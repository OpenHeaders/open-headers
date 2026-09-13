/**
 * Workbench chrome — the shell plane — Russian. Mirrors
 * `catalogs/en/workbench-chrome.ts` key for key; extends the ru
 * register contract (`ru/shared.ts`). Reuses shipped mints: the
 * layout-menu wording quoted verbatim from the `ru/panel.ts` twin
 * (Показывать имена окон инструментов, Компактно (нижняя закреплена),
 * Пропорционально (равные половины), the donor tooltips), Набросок =
 * Scratch (shared-chrome), закрепить = pin (trusted-roots /
 * shared-chrome), Доверенные сертификаты (trusted-roots), Что нового =
 * What's New (shared-notifications), Системный прокси (panel-network),
 * Режим отладки, «Разрешить настольному приложению видеть этот
 * браузер» quoted from ru/popup, Библиотека пакетов (script-packages),
 * вышестоящий сервер (info-status), сеанс = session (notifications),
 * панель действий = activity bar (panel). MINTS: Браузерный
 * перехватчик = Browser Interceptor; разделитель = splitter (Убрать
 * разделение = unsplit); палитра команд = command palette; Лента
 * активности = Activity Feed (панель действий stays the activity bar);
 * пир = peer (carried); индикатор-светофор = the traffic-light status
 * pill; выпустить = mint (a token); область расшифровки = decrypt
 * scope; непрозрачный туннель = opaque tunnel; список изменений =
 * changelist; отложить = shelve (the JetBrains ru convention);
 * спрятать = stash (Спрятать / Восстановить спрятанные изменения);
 * Изменить последний коммит = Amend; Cherry-pick raw (JetBrains ru);
 * ревизия = revision; неотслеживаемые = unversioned; топологически =
 * topologically; Администрирование сервера = Server Admin (the
 * server-admin file quotes it); выдать доступ = grant. Raw by design:
 * `Docs` / `Params` tab names (gRPC precedent), auth scheme and
 * body-mode enums (Basic, Bearer Token, Form data, raw, GraphQL),
 * Chrome ResourceType values (Page, Frame, Fetch/XHR, Script), DNR /
 * AND / DOM / TLS, Vault / Live labels, lowercase vault / live / shell
 * / pty / oh (token case follows en), the proxy scope placeholder wire
 * value, footer key caps (↑↓ / ← / → / ↵ / esc) and the {chord} /
 * {unit} / {units} holes. Bold-prefix bodies open with the head noun
 * and no leading space (Вкладка содержит …, Элемент ещё не …) since
 * the render site joins `<strong>{label}</strong> {body}` with its own
 * space; prefix / suffix sandwiches keep their en edge spaces. The
 * draft seed `New {name}` lands on the hole's own label (`{name}
 * (новое)` — every filler is a «Правило …» from this file) and the
 * palette row reads `Создать: {type}`; `{a}` / `{b}` / `{branch}` /
 * `{from}` refs take ветка / ссылка as head nouns or a preposition
 * with no ending.
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': 'Дублировать вкладку',
  'workbench.tabbar.menu.close': 'Закрыть',
  'workbench.tabbar.menu.closeOther': 'Закрыть другие вкладки',
  'workbench.tabbar.menu.closeAll': 'Закрыть все вкладки',
  'workbench.tabbar.menu.closeUnmodified': 'Закрыть неизменённые вкладки',
  'workbench.tabbar.menu.closeLeft': 'Закрыть вкладки слева',
  'workbench.tabbar.menu.closeRight': 'Закрыть вкладки справа',
  'workbench.tabbar.menu.splitAndMove': 'Разделить и переместить',
  'workbench.tabbar.menu.right': 'Вправо',
  'workbench.tabbar.menu.left': 'Влево',
  'workbench.tabbar.menu.down': 'Вниз',
  'workbench.tabbar.menu.up': 'Вверх',
  'workbench.tabbar.menu.moveOpposite': 'Переместить в противоположную группу',
  'workbench.tabbar.menu.changeSplitterOrientation': 'Изменить ориентацию разделителя',
  'workbench.tabbar.menu.unsplit': 'Убрать разделение',
  'workbench.tabbar.menu.unsplitAll': 'Убрать все разделения',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': 'Сохранить изменения?',
  'workbench.tabbar.closeGuard.unsavedBody':
    'Вкладка содержит несохранённые изменения. Сохраните их, чтобы не потерять работу.',
  'workbench.tabbar.closeGuard.dontSave': 'Не сохранять',
  'workbench.tabbar.closeGuard.cancel': 'Отмена',
  'workbench.tabbar.closeGuard.save': 'Сохранить изменения',
  'workbench.tabbar.closeGuard.draftTitle': 'Отменить черновик?',
  'workbench.tabbar.closeGuard.draftBody':
    'Элемент ещё не опубликован. Отмена удаляет черновик; если оставить его, он останется в боковой панели, чтобы закончить позже.',
  'workbench.tabbar.closeGuard.discard': 'Отменить',
  'workbench.tabbar.closeGuard.keep': 'Оставить как черновик',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'Создать API-запрос',
  'workbench.tabbar.createRule': 'Создать правило',
  'workbench.tabbar.createItem': 'Создать элемент',
  'workbench.tabbar.searchTabs': 'Поиск по вкладкам',
  'workbench.tabbar.search.placeholder': 'Поиск по вкладкам...',
  'workbench.tabbar.search.noMatch': 'Нет открытых вкладок, соответствующих запросу',
  'workbench.tabbar.search.noOpenTabs': 'Нет открытых вкладок',
  'workbench.tabbar.search.noClosedMatch': 'Нет закрытых вкладок, соответствующих запросу',
  'workbench.tabbar.search.recentlyClosed': 'Недавно закрытые ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Недавно закрытые ({matched} из {total})',
  'workbench.tabbar.envPinnedAria': 'Окружение закреплено',
  'workbench.tabbar.fromExample': 'из «{name}»',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Набросок запроса',
  'workbench.scratch.rule': 'Набросок правила',
  'workbench.scratch.variable': 'Набросок переменной',
  'workbench.scratch.workflow': 'Набросок рабочего процесса',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Коллекции',
  'workbench.shell.commandPalette.searchInGroup': 'Поиск в {name}...',
  'workbench.shell.commandPalette.placeholder': 'Ищите правила, коллекции или введите > для команд...',
  'workbench.shell.commandPalette.noResults': 'Ничего не найдено',
  'workbench.shell.commandPalette.emptyHint': 'Введите запрос для поиска или > для команд',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ навигация',
  'workbench.shell.commandPalette.footer.back': '← назад',
  'workbench.shell.commandPalette.footer.open': '→ открыть',
  'workbench.shell.commandPalette.footer.select': '↵ выбрать',
  'workbench.shell.commandPalette.footer.close': 'esc закрыть',
  'workbench.shell.commandPalette.group.rules': 'Правила',
  'workbench.shell.commandPalette.group.templates': 'Шаблоны',
  'workbench.shell.commandPalette.group.requests': 'Запросы',
  'workbench.shell.commandPalette.group.systemTemplates': 'Системные шаблоны',
  'workbench.shell.commandPalette.group.settings': 'Настройки',
  'workbench.shell.commandPalette.section.create': 'Создать',
  'workbench.shell.commandPalette.section.commands': 'Команды',
  'workbench.shell.commandPalette.section.variables': 'Переменные',
  'workbench.shell.commandPalette.cmd.createItem': 'Создать элемент...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'Создать: {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Переключить левую боковую панель',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Переключить правую боковую панель',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Переключить нижнюю панель',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': 'Переключить ленту активности',
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Сочетания клавиш',
  'workbench.shell.commandPalette.cmd.openSettings': 'Открыть настройки',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': 'Открыть переменные рабочего пространства',
  'workbench.shell.commandPalette.cmd.openVault': 'Открыть Vault',
  'workbench.shell.commandPalette.cmd.openTrustedRoots': 'Открыть доверенные сертификаты',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Открыть переменные Live',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Открыть библиотеку пакетов',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Открыть окружение: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Поиск или выполнение команды...',
  'workbench.shell.topbar.layout.bottomLayout': 'Компоновка нижней панели',
  'workbench.shell.topbar.layout.alignCenter': 'По центру (вложенная)',
  'workbench.shell.topbar.layout.alignLeft': 'Слева',
  'workbench.shell.topbar.layout.alignRight': 'Справа',
  'workbench.shell.topbar.layout.alignJustify': 'По ширине (на всю ширину)',
  'workbench.shell.topbar.layout.splitColumns': 'Рядом',
  'workbench.shell.topbar.layout.splitRows': 'Друг над другом',
  'workbench.shell.topbar.layout.showToolWindowNames': 'Показывать имена окон инструментов',
  'workbench.shell.topbar.layout.activityBarLayout': 'Компоновка панели действий',
  'workbench.shell.topbar.layout.sidebarProportional': 'Пропорционально (равные половины)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Компактно (нижняя закреплена)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Стопкой (всё сверху)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Динамически (по высоте панелей)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': 'Компоновка по умолчанию: {unit}',
  'workbench.shell.topbar.layout.inheritsDefault': 'Наследует компоновку по умолчанию',
  'workbench.shell.topbar.layout.donorTooltip':
    'Этот элемент ({unit}) задаёт компоновку по умолчанию — новые {units} наследуют её.',
  'workbench.shell.topbar.layout.nonDonorTooltip':
    'Компоновку по умолчанию задаёт другой элемент ({unit}) — новые {units} наследуют её оттуда.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Сбросить компоновку',
  'workbench.shell.topbar.layout.restoreHidden': 'Вернуть скрытые инструменты панели действий',
  'workbench.shell.topbar.toggle.leftSidebar': 'Левая боковая панель',
  'workbench.shell.topbar.toggle.bottomPanel': 'Нижняя панель',
  'workbench.shell.topbar.toggle.rightSidebar': 'Правая боковая панель',
  'workbench.shell.topbar.bottomAlign.center': 'Нижняя панель: по центру (вложенная)',
  'workbench.shell.topbar.bottomAlign.left': 'Нижняя панель: по левому краю',
  'workbench.shell.topbar.bottomAlign.right': 'Нижняя панель: по правому краю',
  'workbench.shell.topbar.bottomAlign.justify': 'Нижняя панель: на всю ширину',
  'workbench.shell.topbar.bottomAlign.chooseAria': 'Выбрать выравнивание нижней панели',
  'workbench.shell.topbar.layoutOptions': 'Параметры компоновки',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Светлая',
  'workbench.shell.statusbar.theme.dark': 'Тёмная',
  'workbench.shell.statusbar.theme.auto': 'Авто',
  'workbench.shell.statusbar.systemStatus': 'Система',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Скрыть подписи',
  'workbench.shell.activityBar.showLabels': 'Показать подписи',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Создать правило',
  'workbench.shell.empty.createRuleDesc': 'Заголовки, перенаправления, блокировка и не только',
  'workbench.shell.empty.createVariable': 'Создать переменную',
  'workbench.shell.empty.createVariableDesc': 'Окружение, рабочее пространство, Live и не только',
  'workbench.shell.empty.createRequest': 'Создать API-запрос',
  'workbench.shell.empty.createRequestDesc': 'HTTP, gRPC, WebSocket и не только',
  'workbench.shell.empty.createWorkflow': 'Создать рабочий процесс',
  'workbench.shell.empty.createWorkflowDesc': 'Объединяйте API-запросы в цепочки и запускайте их по расписанию',
  'workbench.shell.empty.import': 'Импорт',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman и не только',
  'workbench.shell.empty.migrate': 'Перенести из другого инструмента',
  'workbench.shell.empty.migrateDesc': 'Перенесите свои данные из Postman, Insomnia или Bruno',
  'workbench.shell.empty.browseTemplates': 'Все шаблоны…',
  'workbench.shell.empty.varEnvironment': 'Переменная окружения',
  'workbench.shell.empty.varWorkspace': 'Переменная рабочего пространства',
  'workbench.shell.empty.varLive': 'Переменная Live',
  'workbench.shell.empty.varVault': 'Секрет Vault',
  'workbench.shell.empty.varCollection': 'Переменная коллекции',
  'workbench.shell.empty.varCollectionTooltip': 'Переменные коллекции создаются изнутри коллекции.',
  'workbench.shell.empty.adminNoWorkspace':
    'Вы вошли как администратор сервера без выданного доступа к рабочим пространствам. Данные рабочих пространств недоступны, пока доступ не выдан — в том числе вами самому себе.',
  'workbench.shell.empty.adminOpenServerAdmin': 'Открыть администрирование сервера',
  'workbench.shell.empty.adminOpenServerAdminDesc': 'Управление пользователями, доступом и сервером',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Без окружения',
  'workbench.shell.envSelector.defaultPill': 'ПО УМОЛЧАНИЮ',
  'workbench.shell.envSelector.defaultTooltip':
    'Окружение по умолчанию выбирается автоматически во время работы с коллекцией.',
  'workbench.shell.envSelector.openEnv': 'Изменить переменные',
  'workbench.shell.envSelector.pinToTab': 'Закрепить за этой вкладкой',
  'workbench.shell.envSelector.unpinFromTab': 'Открепить от этой вкладки',
  'workbench.shell.envSelector.pinToTabDesc': 'Переключается на это окружение всякий раз, когда вкладка в фокусе.',
  'workbench.shell.envSelector.pinToCollection': 'Закрепить за коллекцией',
  'workbench.shell.envSelector.unpinFromCollection': 'Открепить от коллекции',
  'workbench.shell.envSelector.pinToCollectionDesc': 'Показывает это окружение в списке закреплённых у коллекции.',
  'workbench.shell.envSelector.pinAria': 'Закрепить окружение',
  'workbench.shell.envSelector.setCollectionDefault': 'Сделать окружением коллекции по умолчанию',
  'workbench.shell.envSelector.clearCollectionDefault': 'Сбросить окружение коллекции по умолчанию',
  'workbench.shell.envSelector.searchPlaceholder': 'Поиск окружений…',
  'workbench.shell.envSelector.modeLabel': 'Режим: {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'При переключении между коллекциями',
  'workbench.shell.envSelector.switchBehavior.keep': 'Сохранять выбранное окружение',
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    'Ваш выбор сохраняется во всех коллекциях и во всём, что внутри них.',
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Применять окружения коллекций по умолчанию',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    'Внутри коллекции действует её окружение по умолчанию. В остальных местах восстанавливается ваш последний ручной выбор.',
  'workbench.shell.envSelector.switchBehavior.follow': 'Следовать за каждой коллекцией',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    'Коллекции с окружением по умолчанию переключаются на него (и запоминают ваш выбор). Остальные не переключаются.',
  'workbench.shell.envSelector.switchBehavior.aria': 'Поведение при переключении окружений',
  'workbench.shell.envSelector.pinnedBanner': 'Закреплено за текущей вкладкой — выбор окружения переносит закрепление.',
  'workbench.shell.envSelector.unpin': 'Открепить',
  'workbench.shell.envSelector.createNew': 'Создать новое окружение',
  'workbench.shell.envSelector.pinnedSection': 'Закреплены за этой коллекцией',
  'workbench.shell.envSelector.othersSection': 'Другие окружения',
  'workbench.shell.envSelector.noMatches': 'Нет подходящих окружений',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Коллекция',
  'workbench.shell.envSelector.footer.workspace': 'Рабочее пространство',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Активное окружение: {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Активное окружение: {name} (закреплено этой вкладкой)',
  'workbench.shell.envSelector.triggerAriaNone': 'Окружение не выбрано',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'Окружение не выбрано (закреплено этой вкладкой)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Настройки',
  'workbench.shell.breadcrumbs.whatsNew': 'Что нового',
  'workbench.shell.breadcrumbs.workspaces': 'Рабочие пространства',
  'workbench.shell.breadcrumbs.serverAdmin': 'Администрирование сервера',
  'workbench.shell.breadcrumbs.environments': 'Окружения',
  'workbench.shell.breadcrumbs.specs': 'Спецификации',
  'workbench.shell.breadcrumbs.workspaceVariables': 'Переменные рабочего пространства',
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Библиотека пакетов',
  'workbench.shell.breadcrumbs.rules': 'Правила',
  'workbench.shell.breadcrumbs.requests': 'Запросы',
  'workbench.shell.breadcrumbs.templates': 'Шаблоны',
  'workbench.shell.breadcrumbs.variables': 'Переменные',
  'workbench.shell.breadcrumbs.apiRequests': 'API-запросы',
  'workbench.shell.breadcrumbs.workflows': 'Рабочие процессы',
  'workbench.shell.breadcrumbs.liveVariables': 'Переменные Live',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Рабочий процесс',
  'workbench.shell.fallback.template': 'Шаблон',
  'workbench.shell.fallback.environment': 'Окружение',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Переменные',
  'workbench.shell.tabLabel.newRequest': 'Новый запрос',
  'workbench.shell.tabLabel.newGrpcRequest': 'Новый запрос gRPC',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Новый запрос WebSocket',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Новый запрос Socket.IO',
  'workbench.shell.tabLabel.newMqttRequest': 'Новый запрос MQTT',
  'workbench.shell.tabLabel.newGraphqlRequest': 'Новый запрос GraphQL',
  'workbench.shell.tabLabel.newWorkflow': 'Новый рабочий процесс',
  'workbench.shell.tabLabel.newLiveVariable': 'Новая переменная Live',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': 'Этот элемент ({unit}) переключён на',
  'workbench.shell.appGlue.andMadeActive': ' и сделано активным',
  'workbench.shell.appGlue.discardTitle': 'Отменить несохранённые черновики?',
  'workbench.shell.appGlue.discardBody':
    'Переключение рабочего пространства закроет вкладки редактора с несохранёнными изменениями.',
  'workbench.shell.appGlue.discardOk': 'Переключить и отменить',
  'workbench.shell.appGlue.cancel': 'Отмена',
  'workbench.shell.toast.createEnvironmentFailed': 'Не удалось создать окружение',
  'workbench.shell.toast.noActiveWorkspace': 'Нет активного рабочего пространства',
  'workbench.shell.toast.createRuleFailed': 'Не удалось создать правило',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'СОХРАНЕНИЕ',
  'workbench.save.newFolder': 'Новая папка',
  'workbench.save.newFolderTooltip': 'Новая папка ({chord})',
  'workbench.save.newCollection': 'Новая коллекция',
  'workbench.save.newCollectionTooltip': 'Новая коллекция ({chord})',
  'workbench.save.cancel': 'Отмена',
  'workbench.save.save': 'Сохранить',
  'workbench.save.selectCollectionFirst': 'Сначала выберите коллекцию',
  'workbench.save.enterName': 'Введите имя',
  'workbench.save.saveWithChord': 'Сохранить ({chord})',
  'workbench.save.footer.navigate': '↑↓ навигация',
  'workbench.save.footer.open': '→ открыть',
  'workbench.save.footer.back': '← назад',
  'workbench.save.footer.new': '{chord} создать',
  'workbench.save.footer.save': '{chord} сохранить',
  'workbench.save.footer.close': 'esc закрыть',
  'workbench.save.nameLabel': 'Имя',
  'workbench.save.saveTo': 'Сохранить в ',
  'workbench.save.rootCrumb': 'Локальные правила',
  'workbench.save.searchFolders': 'Поиск папок',
  'workbench.save.searchCollections': 'Поиск коллекции',
  'workbench.save.nameYourCollection': 'Назовите коллекцию',
  'workbench.save.create': 'Создать',
  'workbench.save.noCollections': 'Коллекций пока нет.',
  'workbench.save.noMatchingCollections': 'Нет подходящих коллекций.',
  'workbench.save.createCollection': 'Создать коллекцию',
  'workbench.save.orPressPrefix': 'или нажмите',
  'workbench.save.nameYourFolder': 'Назовите папку',
  'workbench.save.folderEmpty': 'Эта папка пуста.',
  'workbench.save.collectionEmpty': 'Эта коллекция пуста.',
  'workbench.save.pressPrefix': 'Нажмите',
  'workbench.save.pressMiddle': 'чтобы сохранить сюда, или',
  'workbench.save.pressSuffix': 'для новой папки.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Сохранить как пользовательский шаблон',
  'workbench.save.template.next': 'Далее',
  'workbench.save.template.intro': 'Сохранить текущую конфигурацию ({type}) как повторно используемый шаблон.',
  'workbench.save.template.iconLabel': 'Значок',
  'workbench.save.template.nameLabel': 'Имя *',
  'workbench.save.template.namePlaceholder': 'Имя моего шаблона',
  'workbench.save.template.descriptionLabel': 'Описание',
  'workbench.save.template.descriptionPlaceholder': 'Что делает этот шаблон? (необязательно)',
  'workbench.save.template.includeConditions': 'Включить условия',
  'workbench.save.template.includeActions': 'Включить действия',
  'workbench.save.template.ruleFallback': 'Правило',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'Заголовок',
  'workbench.save.ruleType.block': 'Блокировка',
  'workbench.save.ruleType.redirect': 'Перенаправление',
  'workbench.save.ruleType.queryParam': 'Параметр запроса',
  'workbench.save.ruleType.inject': 'Внедрение',
  'workbench.save.ruleType.delay': 'Задержка',
  'workbench.save.ruleType.requestBody': 'Тело API-запроса',
  'workbench.save.ruleType.response': 'API-ответ',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': 'Правило заголовков',
  'workbench.shell.ruleTypeName.block': 'Правило блокировки',
  'workbench.shell.ruleTypeName.redirect': 'Правило перенаправления',
  'workbench.shell.ruleTypeName.queryParam': 'Правило параметра запроса',
  'workbench.shell.ruleTypeName.inject': 'Правило внедрения',
  'workbench.shell.ruleTypeName.delay': 'Правило задержки',
  'workbench.shell.ruleTypeName.requestBody': 'Правило тела API-запроса',
  'workbench.shell.ruleTypeName.response': 'Правило API-ответа',
  'workbench.shell.ruleTypeName.ws': 'Правило WebSocket',
  'workbench.shell.ruleTypeName.sse': 'Правило SSE',
  'workbench.shell.ruleTypeName.fallback': 'Правило',
  'workbench.shell.ruleTypeName.draftName': '{name} (новое)',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.serverAdmin': 'Администрирование сервера',
  'workbench.toolWindows.httpRules': 'Браузерный перехватчик',
  'workbench.toolWindows.apiRequests': 'API-запросы',
  'workbench.toolWindows.workflows': 'Рабочие процессы',
  'workbench.toolWindows.notifications': 'Уведомления',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Область переменных',
  'workbench.toolWindows.variables': 'Переменные',
  'workbench.toolWindows.workflowStatus': 'Состояние рабочих процессов',
  'workbench.toolWindows.activity': 'Активность',
  'workbench.toolWindows.activityTooltip': 'Лента активности — входящие изменения от пиров',
  'workbench.toolWindows.trafficMonitor': 'Трафик',
  'workbench.toolWindows.terminal': 'Терминал',
  'workbench.toolWindows.git': 'Git · Управление версиями',
  'workbench.toolWindows.versionControl': 'Управление версиями',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.serverAdmin.summary':
    'Администрирование этого сервера: пользователи и их доступ, сопряжённые устройства, привязки репозиториев и журнал аудита. Каждая строка открывается в своей вкладке.',
  'workbench.toolWindows.info.serverAdmin.domainsHeading': 'Разделы администрирования',
  'workbench.toolWindows.info.httpRules.summary':
    'Создавайте правила, которые переписывают исходящие запросы и входящие ответы. Правила живут в коллекциях и могут подставлять значения из переменных, vault и рабочих процессов Live.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Типы правил',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'Производитель переменных с обновлением по расписанию: цепочка запросов плюс правило извлечения. Его результат доступен как ссылка',
  'workbench.toolWindows.info.workflows.summarySuffix':
    ', которую можно использовать везде, где принимается переменная.',
  'workbench.toolWindows.info.docs.summary':
    'Встроенная документация по правилам, переменным, рабочим процессам и самой Рабочей среде — читайте, не покидая приложение.',
  'workbench.toolWindows.info.varScope.summaryPrefix':
    'Переменные, на которые ссылается активная вкладка, и все области, в которых они разрешаются. Простая ссылка',
  'workbench.toolWindows.info.varScope.summaryMiddle':
    'проходит по порядку приоритета ниже; ссылки с пространством имён вроде',
  'workbench.toolWindows.info.varScope.summarySuffix': 'нацелены на одну область напрямую.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Порядок приоритета',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc':
    'Личные секреты пользователя, никогда не синхронизируются — высший приоритет.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Окружение',
  'workbench.toolWindows.info.varScope.environmentDesc': 'Активное окружение, с откатом к окружению по умолчанию.',
  'workbench.toolWindows.info.varScope.collectionLabel': 'Коллекция',
  'workbench.toolWindows.info.varScope.collectionDesc': 'Коллекция активного элемента.',
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Рабочее пространство',
  'workbench.toolWindows.info.varScope.workspaceDesc': 'Общие для всего рабочего пространства — низший приоритет.',
  'workbench.toolWindows.info.varScope.namespacedHeading': 'С пространством имён',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'На основе рабочих процессов; доступны только через',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', разрешаются из последнего запуска.',
  'workbench.toolWindows.info.variables.summary':
    'Каталог переменных — всё, что определено в окружениях, коллекциях, рабочем пространстве и vault. Откройте «Область переменных», чтобы увидеть, что реально действует для активной вкладки.',
  'workbench.toolWindows.info.variables.typesHeading': 'Типы переменных',
  'workbench.toolWindows.info.variables.vaultDesc':
    'Личные секреты пользователя — хранятся локально, никогда не синхронизируются.',
  'workbench.toolWindows.info.variables.environmentDesc': 'Определяются в каждом окружении; значения даёт активное.',
  'workbench.toolWindows.info.variables.collectionDesc': 'Определяются в коллекции; действуют на элементы внутри неё.',
  'workbench.toolWindows.info.variables.workspaceDesc': 'Общие для всего рабочего пространства.',
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Значения, произведённые рабочими процессами; ссылка вида',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    'Сохранённые API-запросы и окружения, в которых они выполняются, организованные в коллекции и папки.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Редактор запросов',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Произвольные заметки к запросу — поддерживается Markdown.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': 'Параметры запроса, добавляемые к URL-адресу запроса.',
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Авторизация',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    'Наследовать от родителя, Basic, Bearer Token, API-ключ или OAuth 2.0 — применяется при отправке.',
  'workbench.toolWindows.info.apiRequests.headersLabel': 'Заголовки',
  'workbench.toolWindows.info.apiRequests.headersDesc':
    'Заголовки запроса; ссылки на переменные разрешаются при отправке.',
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Тело',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML) или GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Скрипты',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'Хуки JavaScript перед запросом и после ответа.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Настройки',
  'workbench.toolWindows.info.apiRequests.settingsDesc':
    'Поведение отдельного запроса — проверка SSL, перенаправления и не только.',
  'workbench.toolWindows.info.trafficMonitor.summary':
    'Единое представление живого трафика — выберите источник из списка: подключённую вкладку браузера (расширение передаёт её трафик в реальном времени) или Системный прокси (любой инструмент на этой машине, направленный на локальный порт прокси). Оба показывают тот же сетевой журнал, что и панель DevTools; ничего не передаётся, пока источник не выбран. Сохранённые сеансы лежат в разделе «СЕАНСЫ» — они получают имя и раскладываются автоматически по завершении; щёлкните сеанс, чтобы воспроизвести его во вкладке.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Панель автоматических выключателей для каждого рабочего процесса — состояние, число подряд идущих сбоев, срабатывания и обратный отсчёт до следующей попытки, с ручными действиями «Повторить» и «Сбросить выключатель».',
  'workbench.toolWindows.info.activity.summary':
    'Лента входящих изменений от пиров по всему рабочему пространству, с подсветкой классификатора для ротаций чувствительных полей, расширений областей разрешений и замещений локальных правок.',
  'workbench.terminal.sessionEnded': 'Сеанс завершён',
  'workbench.terminal.restart': 'Перезапустить оболочку',
  'workbench.terminal.tabLocal': 'Локальный',
  'workbench.terminal.tabLocalN': 'Локальный ({n})',
  'workbench.terminal.newTab': 'Новая вкладка терминала',
  'workbench.terminal.newTabWithProfile': 'Новая вкладка из профиля',
  'workbench.terminal.closeTab': 'Закрыть вкладку',
  'workbench.terminal.openTui': 'TUI',
  'workbench.terminal.closeConfirm.title': 'Процесс выполняется',
  'workbench.terminal.closeConfirm.bodyPrefix': 'Во вкладке ',
  'workbench.terminal.closeConfirm.bodySuffix': ' ещё выполняется процесс. Завершить его?',
  'workbench.terminal.closeConfirm.ok': 'Завершить',
  'workbench.terminal.closeConfirm.bodyMany':
    'В {count} из закрываемых вкладок ещё выполняются процессы. Завершить их?',
  'workbench.terminal.menu.rename': 'Переименовать',
  'workbench.terminal.rename.title': 'Переименовать вкладку',
  'workbench.terminal.settings': 'Настройки',
  'workbench.terminal.cliGate.title': 'Подключить OpenHeaders CLI',
  'workbench.terminal.cliGate.body':
    'Режим TUI работает на инструменте командной строки oh, который ещё не подключён к этому приложению.',
  'workbench.terminal.cliGate.bodyInfo.title': 'Подключение CLI',
  'workbench.terminal.cliGate.bodyInfo.summary':
    'Подключение выпускает токен доступа и записывает его в {path}. Инструмент oh читает этот файл для аутентификации в локальном демоне, поэтому после подключения oh работает в любом терминале на этой машине. Отмена ничего не выпускает.',
  'workbench.terminal.cliGate.enableMcp': 'Включить сервер MCP',
  'workbench.terminal.cliGate.enableMcpRider':
    'Пока конечная точка выключена, TUI сообщает, что демон недоступен. Снимите флажок, чтобы только выпустить токен.',
  'workbench.terminal.cliGate.ok': 'Подключить и открыть',
  'workbench.terminal.cliGate.openSettings': 'Открыть настройки',
  'workbench.terminal.cliGate.installTitle': 'Установить OpenHeaders CLI',
  'workbench.terminal.cliGate.installBody':
    'Режим TUI работает на инструменте командной строки oh, который ещё не установлен на этой машине. Выполните это в любом терминале, чтобы установить его, затем снова откройте режим TUI:',
  'workbench.terminal.cliGate.installOk': 'Открыть терминал',
  'workbench.toolWindows.info.terminal.summary':
    'Встроенный терминал, запускающий вашу оболочку в настоящем pty — всё, что можно запустить в отдельном терминале, работает и здесь, включая oh CLI для локального приложения.',
  'workbench.toolWindows.info.git.summary':
    'История коммитов для привязки Git активного рабочего пространства — хронология рабочего пространства с изменёнными файлами каждого коммита, авторством и историей по файлам.',

  // ── Git tool window (log view) ───────────────────────────────────
  'workbench.gitLog.logTab': 'Журнал: {branch}',
  'workbench.gitLog.logTabAll': 'Журнал',
  'workbench.gitLog.closeTab': 'Закрыть вкладку',
  'workbench.gitLog.newLogTab': 'Новая вкладка журнала',
  'workbench.gitLog.tabMenu': 'Параметры вкладки',
  'workbench.gitLog.console.tab': 'Консоль',
  'workbench.gitLog.console.show': 'Показать консоль Git',
  'workbench.gitLog.console.empty':
    'Здесь будут появляться команды Git, которые приложение выполняет в этом репозитории.',
  'workbench.gitLog.filterPlaceholder': 'Текст или хеш',
  'workbench.gitLog.filter.regex': 'Регулярное выражение',
  'workbench.gitLog.filter.matchCase': 'Учитывать регистр',
  'workbench.gitLog.chip.branch': 'Ветка',
  'workbench.gitLog.chip.tag': 'Тег',
  'workbench.gitLog.chip.user': 'Пользователь',
  'workbench.gitLog.chip.date': 'Дата',
  'workbench.gitLog.chip.paths': 'Пути',
  'workbench.gitLog.chip.pathsCount': 'Путей: {count}',
  'workbench.gitLog.menu.select': 'Выбрать…',
  'workbench.gitLog.menu.selectInTree': 'Выбрать в дереве…',
  'workbench.gitLog.menu.favorites': 'Избранное',
  'workbench.gitLog.user.me': 'я',
  'workbench.gitLog.date.last24h': 'Последние 24 часа',
  'workbench.gitLog.date.last7d': 'Последние 7 дней',
  'workbench.gitLog.date.title': 'Фильтр по дате',
  'workbench.gitLog.date.since': 'С',
  'workbench.gitLog.date.until': 'По',
  'workbench.gitLog.paths.title': 'Фильтр по путям',
  'workbench.gitLog.paths.hint': 'Один путь относительно репозитория в строке — папка охватывает всё внутри неё.',
  'workbench.gitLog.modal.ok': 'ОК',
  'workbench.gitLog.modal.cancel': 'Отмена',
  'workbench.gitLog.graphOptions': 'Параметры графа',
  'workbench.gitLog.sort.heading': 'Сортировка',
  'workbench.gitLog.sort.byDate': 'По дате коммита',
  'workbench.gitLog.sort.topo': 'Топологически',
  'workbench.gitLog.options.heading': 'Параметры',
  'workbench.gitLog.options.firstParent': 'Только первый родитель',
  'workbench.gitLog.options.noMerges': 'Без слияний',
  'workbench.gitLog.branchActions.heading': 'Действия с ветками',
  'workbench.gitLog.branchActions.collapseLinear': 'Свернуть линейные ветки',
  'workbench.gitLog.branchActions.expandLinear': 'Развернуть линейные ветки',
  'workbench.gitLog.cherryPick': 'Cherry-pick',
  'workbench.gitLog.viewOptions': 'Параметры вида',
  'workbench.gitLog.show.heading': 'Показывать',
  'workbench.gitLog.show.compactRefs': 'Компактный вид ссылок',
  'workbench.gitLog.show.tagNames': 'Имена тегов',
  'workbench.gitLog.show.longEdges': 'Длинные рёбра',
  'workbench.gitLog.show.commitTimestamp': 'Время коммита',
  'workbench.gitLog.show.refsOnLeft': 'Ссылки слева',
  'workbench.gitLog.show.columns': 'Колонки',
  'workbench.gitLog.highlight.heading': 'Подсветка',
  'workbench.gitLog.highlight.myCommits': 'Мои коммиты',
  'workbench.gitLog.highlight.mergeCommits': 'Коммиты слияния',
  'workbench.gitLog.highlight.currentBranch': 'Текущая ветка',
  'workbench.gitLog.highlight.notCherryPicked': 'Коммиты без cherry-pick',
  'workbench.gitLog.goTo': 'Перейти к хешу/ветке/тегу',
  'workbench.gitLog.goTo.placeholder': 'Хеш, ветка или тег',
  'workbench.gitLog.goTo.notFound': 'Не найдено в загруженном журнале.',
  'workbench.gitLog.details.showDiff': 'Показать Diff',
  'workbench.gitLog.details.revertSelected': 'Откатить выбранные изменения',
  'workbench.gitLog.details.groupBy': 'Группировать по',
  'workbench.gitLog.details.directory': 'Каталог',
  'workbench.gitLog.details.layout': 'Компоновка',
  'workbench.gitLog.details.showDetails': 'Показывать подробности',
  'workbench.gitLog.details.showDiffPreview': 'Показывать предпросмотр Diff',
  'workbench.gitLog.refresh': 'Обновить',
  'workbench.gitLog.empty':
    'Коммитов пока нет — они создаются по настроенному расписанию, или сделайте коммит вручную в разделе «Настройки › Git».',
  'workbench.gitLog.noMatches': 'Нет коммитов, соответствующих фильтрам',
  'workbench.gitLog.resetFilters': 'Сбросить фильтры',
  'workbench.gitLog.selectCommit': 'Выберите коммит, чтобы увидеть его изменения',
  'workbench.gitLog.noneSelected': 'Коммит не выбран',
  'workbench.gitLog.loadFailed': 'Не удалось загрузить историю: {detail}',
  'workbench.gitLog.authorLine': '{author} <{email}>, {date}',
  'workbench.gitLog.coAuthors': 'Соавторы: {authors}',
  'workbench.gitLog.filesHeading': 'Изменённые файлы',
  'workbench.gitLog.filesCount': 'Файлов: {count}',
  'workbench.gitLog.expandAll': 'Развернуть всё',
  'workbench.gitLog.collapseAll': 'Свернуть всё',
  'workbench.gitLog.date.yesterday': 'Вчера, {time}',
  'workbench.gitLog.diff.title': 'Diff — {path}',
  'workbench.gitLog.diff.binary': 'Двоичный файл — текстовый предпросмотр недоступен.',
  'workbench.gitLog.diff.tooLarge': 'Файл слишком велик для предпросмотра ({size} KB).',
  'workbench.gitLog.refs.search': 'Ветка или тег',
  'workbench.gitLog.refs.head': 'HEAD (текущая ветка)',
  'workbench.gitLog.refs.local': 'Локальные',
  'workbench.gitLog.refs.remote': 'Удалённые',
  'workbench.gitLog.refs.tags': 'Теги',
  'workbench.gitLog.refs.empty': 'Ветки появятся после первого коммита.',
  'workbench.gitLog.rail.hide': 'Скрыть ветки Git',
  'workbench.gitLog.rail.show': 'Показать ветки Git',
  'workbench.gitLog.rail.branchesStrip': 'Ветки',
  'workbench.gitLog.rail.newBranch': 'Новая ветка',
  'workbench.gitLog.rail.updateSelected': 'Обновить выбранную',
  'workbench.gitLog.rail.deleteBranch': 'Удалить ветку',
  'workbench.gitLog.rail.compareWithCurrent': 'Сравнить с текущей',
  'workbench.gitLog.rail.showMyBranches': 'Показать мои ветки',
  'workbench.gitLog.rail.fetch': 'Fetch',
  'workbench.gitLog.rail.toggleFavorite': 'Добавить в избранное / убрать из избранного',
  'workbench.gitLog.rail.navigateToHead': 'Перейти в журнале к вершине выбранной ветки',
  'workbench.gitLog.rail.paneSettings': 'Настройки панели веток',
  'workbench.gitLog.rail.singleClickHeading': 'По одиночному щелчку',
  'workbench.gitLog.rail.singleClickFilter': 'Обновлять фильтр по ветке',
  'workbench.gitLog.rail.singleClickNavigate': 'Переходить в журнале к вершине ветки',
  'workbench.gitLog.rail.showTags': 'Показывать теги',
  'workbench.gitLog.rail.groupByDirectory': 'Группировать по каталогу',
  'workbench.gitLog.rail.expandAll': 'Развернуть всё',
  'workbench.gitLog.rail.collapseAll': 'Свернуть всё',
  'workbench.gitLog.createBranch.title': 'Создать ветку от {from}',
  'workbench.gitLog.createBranch.nameLabel': 'Имя ветки:',
  'workbench.gitLog.createBranch.checkout': 'Переключиться на ветку',
  'workbench.gitLog.createBranch.overwrite': 'Перезаписать существующую ветку',
  'workbench.gitLog.createBranch.create': 'Создать',
  'workbench.gitLog.createBranch.cancel': 'Отмена',
  'workbench.gitLog.createBranch.exists': 'Ветка {name} уже существует — отметьте «Перезаписать», чтобы сбросить её.',
  'workbench.gitLog.createBranch.failed': 'Не удалось создать ветку: {detail}',
  'workbench.gitLog.createBranch.checkedOut': 'Выполнено переключение на новую ветку {branch}, созданную от {from}',
  'workbench.gitLog.deleteBranch.deleted': 'Ветка удалена: {branch}',
  'workbench.gitLog.deleteBranch.restore': 'Восстановить',
  'workbench.gitLog.deleteBranch.failed': 'Не удалось удалить ветку: {detail}',
  'workbench.gitLog.updateBranch.noUpstream': 'У ветки {branch} нет вышестоящей ветки для обновления.',
  'workbench.gitLog.updateBranch.failed': 'Не удалось обновить ветку {branch}: {detail}',
  'workbench.gitLog.fetch.noRemote': 'Удалённые репозитории не настроены.',
  'workbench.gitLog.fetch.failed': 'Fetch не выполнен: {detail}',
  'workbench.gitLog.compareTab': 'Сравнение: {a} и {b}',
  'workbench.gitLog.compare.onlyIn': 'Коммиты, которые есть в {a}, но отсутствуют в {b}',
  'workbench.gitLog.compare.containsAll': 'В {a} есть все коммиты из {b}',
  'workbench.gitLog.compare.failed': 'Не удалось сравнить: {detail}',

  // ── Commit tool window ───────────────────────────────────────────
  'workbench.toolWindows.commit': 'Git · Коммит',
  'workbench.toolWindows.info.commit.summary':
    'Коммит изменений из привязки Git активного рабочего пространства — дерево изменений с флажками, сообщение коммита и «Коммит» / «Коммит и Push» под вашей собственной идентичностью git и с вашими хуками.',
  'workbench.commitTool.groups.changes': 'Изменения',
  'workbench.commitTool.oneFile': '1 файл',
  'workbench.commitTool.oneDirectory': '1 каталог',
  'workbench.commitTool.directoriesCount': 'каталогов: {count}',
  'workbench.commitTool.dirsAndFiles': '{dirs} и {files}',
  'workbench.commitTool.groups.unversioned': 'Неотслеживаемые файлы',
  'workbench.commitTool.groups.ignored': 'Игнорируемые файлы',
  'workbench.commitTool.refresh': 'Обновить',
  'workbench.commitTool.rollback': 'Откатить…',
  'workbench.commitTool.shelve': 'Отложить без подтверждения',
  'workbench.commitTool.show': 'Показывать',
  'workbench.commitTool.ignoredFiles': 'Игнорируемые файлы',
  'workbench.commitTool.selectOpened': 'Выбрать открытый файл в дереве изменений',
  'workbench.commitTool.amend': 'Изменить последний коммит',
  'workbench.commitTool.historyTooltip': 'История сообщений коммитов',
  'workbench.commitTool.historyEmpty': 'Сообщений коммитов пока нет',
  'workbench.commitTool.messagePlaceholder': 'Сообщение коммита',
  'workbench.commitTool.commit': 'Коммит',
  'workbench.commitTool.commitAndPush': 'Коммит и Push…',
  'workbench.commitTool.optionsTooltip': 'Показать параметры коммита',
  'workbench.commitTool.options.gitSection': 'Git',
  'workbench.commitTool.options.signOff': 'Добавить Signed-off-by',
  'workbench.commitTool.options.runGitHooks': 'Запускать хуки Git',
  'workbench.commitTool.counter.modified': 'изменено: {count}',
  'workbench.commitTool.counter.added': 'добавлено: {count}',
  'workbench.commitTool.counter.deleted': 'удалено: {count}',
  'workbench.commitTool.counter.unversioned': 'неотслеживаемых: {count}',
  'workbench.commitTool.nothingToCommit': 'В выбранных файлах нет изменений',
  'workbench.commitTool.committed': 'Создан коммит {sha}',
  'workbench.commitTool.menu.commitFile': 'Коммит файла…',
  'workbench.commitTool.menu.moveToChangelist': 'Переместить в другой список изменений…',
  'workbench.commitTool.menu.showDiff': 'Показать Diff',
  'workbench.commitTool.menu.showDiffNewTab': 'Показать Diff в новой вкладке',
  'workbench.commitTool.menu.jumpToSource': 'Перейти к источнику',
  'workbench.commitTool.menu.delete': 'Удалить…',
  'workbench.commitTool.menu.addToVcs': 'Добавить в VCS',
  'workbench.commitTool.menu.addToGitignore': 'Добавить в .gitignore',
  'workbench.commitTool.menu.excludeFile': '.git/info/exclude',
  'workbench.commitTool.menu.newChangelist': 'Новый список изменений…',
  'workbench.commitTool.menu.editChangelist': 'Изменить список изменений…',
  'workbench.commitTool.menu.createPatch': 'Создать патч из локальных изменений…',
  'workbench.commitTool.menu.copyPatch': 'Копировать как патч в буфер обмена',
  'workbench.commitTool.menu.shelveChanges': 'Отложить изменения…',
  'workbench.commitTool.menu.localHistory': 'Локальная история',
  'workbench.commitTool.menu.localHistoryShow': 'Показать историю…',
  'workbench.commitTool.menu.showProjectHistory': 'Показать историю проекта…',
  'workbench.commitTool.menu.recentChanges': 'Недавние изменения',
  'workbench.commitTool.menu.putLabel': 'Поставить метку…',
  'workbench.commitTool.menu.git': 'Git',
  'workbench.commitTool.menu.add': 'Добавить',
  'workbench.commitTool.menu.compareRevision': 'Сравнить с ревизией…',
  'workbench.commitTool.menu.compareBranch': 'Сравнить с веткой или тегом…',
  'workbench.commitTool.menu.showHistory': 'Показать историю',
  'workbench.commitTool.menu.showCurrentRevision': 'Показать текущую ревизию',
  'workbench.commitTool.menu.push': 'Push…',
  'workbench.commitTool.menu.pull': 'Pull…',
  'workbench.commitTool.menu.fetch': 'Fetch',
  'workbench.commitTool.menu.merge': 'Слить…',
  'workbench.commitTool.menu.rebase': 'Rebase…',
  'workbench.commitTool.menu.branches': 'Ветки…',
  'workbench.commitTool.menu.newBranch': 'Новая ветка…',
  'workbench.commitTool.menu.newTag': 'Новый тег…',
  'workbench.commitTool.menu.resetHead': 'Сбросить HEAD…',
  'workbench.commitTool.menu.stash': 'Спрятать изменения…',
  'workbench.commitTool.menu.unstash': 'Восстановить спрятанные изменения…',
  'workbench.commitTool.menu.github': 'GitHub',
  'workbench.commitTool.menu.manageRemotes': 'Управление удалёнными репозиториями…',
  'workbench.commitTool.menu.clone': 'Клонировать…',
  'workbench.commitTool.menu.comparePickerTitle': 'Сравнить с веткой или тегом',
  'workbench.commitTool.menu.comparePickerSearch': 'Поиск веток и тегов',
  'workbench.commitTool.menu.comparePickerEmpty': 'Нет подходящих ссылок',
  'workbench.commitTool.menu.pullUpToDate': 'Уже актуально',
  'workbench.commitTool.menu.pullDone': 'Pull завершён',
  'workbench.commitTool.menu.pullFailed': 'Pull не выполнен: {detail}',
  'workbench.commitTool.menu.ignoreFailed': 'Не удалось обновить файл игнорирования: {detail}',
  'workbench.commitTool.menu.stopIgnoring': 'Перестать игнорировать',
  'workbench.commitTool.ignoreSourceGlobal': 'глобальный',
  'workbench.commitTool.menu.fetchDone': 'Fetch завершён',
  'workbench.commitTool.pushed': 'Отправлено',
  'workbench.commitTool.nothingToPush': 'Нечего отправлять',
  'workbench.commitTool.errors.notARepo': 'У этого рабочего пространства нет репозитория Git',
  'workbench.commitTool.errors.gitUnavailable': 'Git недоступен на этой машине',
  'workbench.commitTool.errors.emptyMessage': 'Введите сообщение коммита',
  'workbench.commitTool.errors.noPaths': 'Выберите хотя бы один файл для коммита',
  'workbench.commitTool.errors.amendUnborn': 'Ещё нет коммита, который можно изменить',
  'workbench.commitTool.errors.amendMerge': 'Коммиты слияния нельзя изменять',
  'workbench.commitTool.errors.amendPushed':
    'HEAD уже отправлен в вышестоящую ветку — изменение перепишет опубликованную историю',
  'workbench.commitTool.errors.stageFailed': 'Не удалось проиндексировать выбранные файлы',
  'workbench.commitTool.errors.commitFailed': 'Коммит не выполнен',
  'workbench.commitTool.errors.pushFailed': 'Push не выполнен',

  // ── Proxy capture tool window (control strip) ────────────────────
  'workbench.proxyCapture.running': 'Работает · :{port}',
  'workbench.proxyCapture.stopped': 'Остановлен',
  'workbench.proxyCapture.start': 'Запустить',
  'workbench.proxyCapture.stop': 'Остановить',
  'workbench.proxyCapture.port': 'Порт',
  'workbench.proxyCapture.scope': 'Область расшифровки',
  'workbench.proxyCapture.optionsAria': 'Настройки Системного прокси',
  'workbench.proxyCapture.scopePlaceholder': 'example.com, *.example.com',
  'workbench.proxyCapture.scopeHint':
    'Расшифровываются только перечисленные хосты; весь остальной HTTPS-трафик проходит как непрозрачный туннель.',
  'workbench.proxyCapture.scopeSaved': 'Область расшифровки обновлена',
  'workbench.proxyCapture.scopeFailed': 'Не удалось обновить область: {message}',
  'workbench.proxyCapture.startFailed': 'Не удалось запустить прокси: {message}',
  'workbench.proxyCapture.emptyRunning': 'Ожидание трафика через прокси…',
  'workbench.proxyCapture.emptyRunningHint':
    'Направьте любое приложение — CLI-инструменты, скрипты, другое устройство — на http://127.0.0.1:{port}, чтобы захватывать его запросы',
  'workbench.proxyCapture.emptyStopped': 'Прокси остановлен',
  'workbench.proxyCapture.emptyStoppedHint': 'Запустите прокси, чтобы начать захват трафика',
  'workbench.proxyCapture.noCa':
    'Доверенного CA нет — HTTP захватывается полностью; HTTPS остаётся непрозрачным туннелем, пока вы его не установите.',
  'workbench.proxyCapture.noCaAction': 'Установить CA',
  'workbench.proxyCapture.routing': 'Направлять браузеры',
  'workbench.proxyCapture.routingFailed': 'Не удалось обновить маршрутизацию: {message}',
  'workbench.proxyCapture.routingActiveLead':
    'Эти браузеры теперь отправляют хосты из области расшифровки через прокси захвата; всё остальное идёт напрямую.',
  'workbench.proxyCapture.routingCaveat':
    'На направляемых хостах HTTP/3 откатывается к HTTP/2 или 1.1, а конечные точки с закреплёнными сертификатами могут не работать.',
  'workbench.proxyCapture.routingInactive': 'Браузеры направляют хосты из области, как только прокси запущен.',
  'workbench.proxyCapture.routingUnsupported': '{agent} · не поддерживается',
  'workbench.proxyCapture.scopeInfo.exampleCaption': 'Пример области',
  'workbench.proxyCapture.scopeInfo.exampleDecrypted': 'расшифровывается',
  'workbench.proxyCapture.scopeInfo.exampleOpaque': 'непрозрачный туннель',
  'workbench.proxyCapture.scopeInfo.summary':
    'Только перечисленные хосты расшифровываются по TLS и проверяются — каждое другое HTTPS-соединение проходит как непрозрачный туннель и никогда не перехватывается.',
  'workbench.proxyCapture.scopeInfo.description':
    'Пустой список ничего не расшифровывает: перехват — всегда явный выбор, хост за хостом.',
  'workbench.proxyCapture.scopeInfo.patternsHeading': 'Шаблоны',
  'workbench.proxyCapture.scopeInfo.exactDesc': 'Точное имя хоста — совпадает только с корневым доменом.',
  'workbench.proxyCapture.scopeInfo.wildcardDesc': 'Любой поддомен — никогда сам корневой домен.',
  'workbench.proxyCapture.scopeInfo.ipDesc': 'IP-адрес совпадает точно.',
  'workbench.proxyCapture.routingInfo.exampleCaption': 'Пример маршрутизации',
  'workbench.proxyCapture.routingInfo.summary':
    'Подключённые браузеры отправляют хосты из области расшифровки через прокси захвата — без настроек прокси в ОС и без ручной настройки; всё остальное идёт напрямую. В основном для браузеров, за которыми нельзя наблюдать или которые нельзя отлаживать напрямую.',
  'workbench.proxyCapture.routingInfo.description':
    'Маршрутизация сохраняется, пока вы её не выключите — перезапуск приложения или обрыв соединения никогда не оставляет браузер за мёртвым прокси.',
  'workbench.proxyCapture.routingInfo.behaviorHeading': 'Поведение',
  'workbench.proxyCapture.routingInfo.appliedDesc':
    'Браузеры на Chromium применяют сгенерированный PAC; Firefox направляет каждый запрос отдельно.',
  'workbench.proxyCapture.routingInfo.failoverDesc':
    'Если порт захвата недоступен, трафик откатывается к прямому соединению — пробел в захвате, но никогда не сломанный браузер.',
  'workbench.proxyCapture.routingInfo.h3Desc':
    'Направляемые хосты откатываются с HTTP/3 к HTTP/2 или 1.1; конечные точки с закреплёнными сертификатами могут не работать, пока направляются.',
  'workbench.proxyCapture.routingPopoverHint':
    'Направляет хосты из области расшифровки от подключённых браузеров через прокси захвата. В основном для браузеров, за которыми нельзя наблюдать или которые нельзя отлаживать напрямую — наблюдаемой вкладке больше даёт режим отладки в её строке.',

  // ── Traffic Monitor tool window (unified observability surface) ─────
  'workbench.trafficMonitor.browserConnected': 'Подключённых браузеров: {count}',
  'workbench.trafficMonitor.noBrowser': 'Браузер не подключён',
  'workbench.trafficMonitor.untitledTab': 'Вкладка без названия',
  'workbench.trafficMonitor.closeSourceTab': 'Закрыть вкладку',
  'workbench.trafficMonitor.railSideToRight': 'Переместить источники вправо',
  'workbench.trafficMonitor.railSideToLeft': 'Переместить источники влево',
  'workbench.trafficMonitor.extensionVersion': 'v{version}',
  'workbench.trafficMonitor.emptyWatching': 'Ожидание трафика…',
  'workbench.trafficMonitor.emptyWatchingHint':
    'Работайте в наблюдаемой вкладке — её запросы появятся здесь в реальном времени',
  'workbench.trafficMonitor.browserTabs': 'Вкладки браузера',
  'workbench.trafficMonitor.windowLabel': 'Окно {n}',
  'workbench.trafficMonitor.proxySystem': 'Прокси · Системный',
  'workbench.trafficMonitor.systemProxy': 'Системный прокси',
  'workbench.trafficMonitor.systemProxyHint':
    'Небраузерный и ненаблюдаемый трафик — всё, что направлено через порт захвата: CLI-инструменты, нативные приложения, другие устройства',
  'workbench.trafficMonitor.emptyNoSource': 'Источник не выбран',
  'workbench.trafficMonitor.emptyNoSourceHint':
    'Выберите вкладку браузера или Системный прокси в списке источников, чтобы наблюдать за трафиком',
  'workbench.trafficMonitor.debugTab': 'Отлаживать эту вкладку — полная точность: тела, точные заголовки, тайминги',
  'workbench.trafficMonitor.debugAttached': 'Эта вкладка отлаживается — полная точность через отладчик браузера',
  'workbench.trafficMonitor.debugPinned': 'Закреплена для отладки — подключится, как только включится режим отладки',
  'workbench.trafficMonitor.debugPinAria': 'Переключить отладку этой вкладки',
  'workbench.trafficMonitor.debugModeHint':
    'Режим отладки — подключает отладчик браузера к вкладкам в области действия и закреплённым вкладкам ради тел и точных заголовков. Браузер показывает баннер на каждой подключённой вкладке.',
  'workbench.trafficMonitor.captureAria': 'Параметры захвата для этого источника',
  'workbench.trafficMonitor.captureMenuStart': 'Начать захват',
  'workbench.trafficMonitor.captureMenuStartHint':
    'Сохраняет недавний трафик этого источника: подключённые ИИ-агенты могут его читать (чувствительные значения скрыты), а «Сохранить сеанс» записывает его на диск. Для наблюдения за живым представлением здесь это не нужно.',
  'workbench.trafficMonitor.captureAdvanced': 'Дополнительно',
  'workbench.trafficMonitor.captureDebugOptionHint':
    'Полная точность через отладчик браузера — тела ответов и точные заголовки. Браузер показывает баннер отладки.',
  'workbench.trafficMonitor.captureSaveOption': 'Сохранить сеанс',
  'workbench.trafficMonitor.captureSaveOptionHint':
    'Записывает захват в зашифрованный архив сеансов на этом компьютере',
  'workbench.trafficMonitor.captureMenuStop': 'Остановить захват',
  'workbench.trafficMonitor.captureMenuStopRecordingHint': 'Завершает запись и сохраняет сеанс',
  'workbench.trafficMonitor.sessionsTitle': 'Сеансы',
  'workbench.trafficMonitor.noBrowsersHint':
    'Браузеры не подключены. Откройте браузер с установленным расширением или установите его:',
  'workbench.trafficMonitor.installExtension': 'Установить расширение для {browser}',
  'workbench.trafficMonitor.watchConsentOff': 'Просмотр выключен',
  'workbench.trafficMonitor.watchConsentOffHint':
    'Расширение в этом браузере не разрешает настольному приложению видеть его трафик, хранилище и консоль. Правила и синхронизация продолжают работать. Включите «Разрешить настольному приложению видеть этот браузер» в настройках расширения, чтобы наблюдать за ним здесь.',
  'workbench.trafficMonitor.watchConsentOffEmpty': 'Просмотр в реальном времени выключен в этом браузере',
  'workbench.trafficMonitor.watchConsentOffEmptyHint':
    'Включите «Разрешить настольному приложению видеть этот браузер» в настройках расширения, чтобы наблюдать здесь за трафиком, хранилищем и консолью этой вкладки',

  // ── The SESSIONS rail section (the sessions archive, in-rail) ───────
  'workbench.trafficSessions.empty': 'Сохранённых сеансов пока нет',
  'workbench.trafficSessions.emptyHint':
    'Захватите источник в панели «Трафик» с включённым «Сохранить сеанс» — сохранённые сеансы попадают сюда',
  'workbench.trafficSessions.stateRecording': 'Запись',
  'workbench.trafficSessions.stateSealing': 'Запечатывание…',
  'workbench.trafficSessions.move': 'Переместить в папку',
  'workbench.trafficSessions.moveNew': 'Новая папка…',
  'workbench.trafficSessions.moveNone': 'Убрать из папки',
  'workbench.trafficSessions.deleteTitle': 'Удалить этот сеанс?',
  'workbench.trafficSessions.deleteBody':
    '«{name}» и все записанные данные, на которые ссылается только этот сеанс, удаляются с диска.',
  'workbench.trafficSessions.deleteOk': 'Удалить',
  'workbench.trafficSessions.deleteGroupTitle': 'Удалить «{name}»?',
  'workbench.trafficSessions.deleteGroupBody':
    'Сеансы в этой папке ({count}) и все записанные данные, на которые ссылаются только они, удаляются с диска.',

  // ── Session replay tab (C6 — an archived session in the live views) ──
  'workbench.sessionReplay.empty': 'В этом сеансе не записано ни одного запроса',
  'workbench.sessionReplay.emptyHint': 'Источник был захвачен, но во время записи через него не прошёл трафик',
  'workbench.sessionReplay.unavailableTitle': 'Не удалось открыть этот сеанс',
  'workbench.sessionReplay.unavailableBody':
    'Записанные данные отсутствуют или повреждены, либо зашифрованы ключом, которого у этого приложения больше нет.',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Заголовок',
  'workbench.markdown.bold': 'Полужирный',
  'workbench.markdown.italic': 'Курсив',
  'workbench.markdown.strikethrough': 'Зачёркнутый',
  'workbench.markdown.codeBlock': 'Блок кода',
  'workbench.markdown.link': 'Ссылка',
  'workbench.markdown.bulletedList': 'Маркированный список',
  'workbench.markdown.numberedList': 'Нумерованный список',
  'workbench.markdown.table': 'Таблица',
  'workbench.markdown.copyCode': 'Копировать код',
  'workbench.markdown.copied': 'Скопировано',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Поиск значков...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Шаблон сохранён',
  'workbench.templateEditor.toast.saveFailed': 'Не удалось сохранить шаблон',
  'workbench.templateEditor.notFound': 'Шаблон не найден',
  'workbench.templateEditor.namePlaceholder': 'Имя шаблона',
  'workbench.templateEditor.descriptionPlaceholder': 'Описание (необязательно)',
  'workbench.templateEditor.includeConditions': 'Включить условия',
  'workbench.templateEditor.includeActions': 'Включить действия',
  'workbench.templateEditor.conditionsTitle': 'Условия',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': 'Что нового в версии {version}',
  'workbench.whatsNew.noNotes': 'Эта сборка поставляется без примечаний к выпуску.',
  'workbench.whatsNew.historyTitle': 'Предыдущие выпуски',
  'workbench.whatsNew.historyShowNotes': 'Показать примечания',
  'workbench.whatsNew.historyHideNotes': 'Скрыть примечания',
  'workbench.whatsNew.historyNotesUnavailable': 'Не удалось загрузить примечания к выпуску.',
  'workbench.whatsNew.historyBetaTag': 'Beta',
  'workbench.whatsNew.historySecurityTag': 'Безопасность',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Переключить левую боковую панель',
  'workbench.shortcuts.action.toggleRightSidebar': 'Переключить правую боковую панель',
  'workbench.shortcuts.action.toggleBottomPanel': 'Переключить нижнюю панель',
  'workbench.shortcuts.action.toggleActivityFeed': 'Переключить ленту активности',
  'workbench.shortcuts.action.terminalNewTab': 'Новая вкладка терминала',
  'workbench.shortcuts.action.closeTab': 'Закрыть вкладку',
  'workbench.shortcuts.action.newTab': 'Новая вкладка',
  'workbench.shortcuts.action.prevTab': 'Предыдущая вкладка',
  'workbench.shortcuts.action.nextTab': 'Следующая вкладка',
  'workbench.shortcuts.action.tabSearch': 'Поиск по вкладкам',
  'workbench.shortcuts.action.commandPalette': 'Палитра команд',
  'workbench.shortcuts.action.focusFilter': 'Фокус на фильтр активного раздела',
  'workbench.shortcuts.action.focusLeftSidebar': 'Фокус на левую боковую панель',
  'workbench.shortcuts.action.focusEditor': 'Фокус на редактор',
  'workbench.shortcuts.action.focusRightSidebar': 'Фокус на правую боковую панель',
  'workbench.shortcuts.action.focusBottomPanel': 'Фокус на нижнюю панель',
  'workbench.shortcuts.action.save': 'Сохранить',
  'workbench.shortcuts.action.newRule': 'Создать элемент',
  'workbench.shortcuts.action.import': 'Импорт',
  'workbench.shortcuts.action.showShortcuts': 'Сочетания клавиш',
  'workbench.shortcuts.action.openSettings': 'Открыть настройки',
  'workbench.shortcuts.action.find': 'Найти в редакторе',
  'workbench.shortcuts.action.replace': 'Заменить в редакторе',
  'workbench.shortcuts.action.formatCode': 'Форматировать код',
  'workbench.shortcuts.category.panels': 'Панели',
  'workbench.shortcuts.category.tabs': 'Вкладки',
  'workbench.shortcuts.category.navigation': 'Навигация',
  'workbench.shortcuts.category.actions': 'Действия',
  'workbench.shortcuts.allSurfacesTitle': 'Все поверхности',
  'workbench.shortcuts.toggleDebugMode': 'Переключить режим отладки',
  'workbench.shortcuts.goToTab': 'Перейти к вкладке 1–9 (9 = последняя)',
  'workbench.shortcuts.introPrefix': 'Нажмите',
  'workbench.shortcuts.introMiddle': 'в любой момент, чтобы попасть сюда. Сочетания используют',
  'workbench.shortcuts.introSuffix': 'как клавишу-модификатор.',
  'workbench.shortcuts.regionsCaption': 'Четыре сочетания ставят фокус в одну из четырёх областей оболочки.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Концепции',
  'workbench.docs.nav.group.modifyRequests': 'Изменение запросов',
  'workbench.docs.nav.group.modifyResponses': 'Изменение ответов',
  'workbench.docs.nav.group.runCode': 'Выполнение кода',
  'workbench.docs.nav.group.reference': 'Справочник',
  'workbench.docs.nav.paradigm.title': 'Что мы делаем (иначе)',
  'workbench.docs.nav.paradigm.summary':
    'Расширение браузера, которое делает то, для чего раньше нужен был прокси, настольная программа или облачная учётная запись.',
  'workbench.docs.nav.comparison.title': 'Сравнение с другими',
  'workbench.docs.nav.comparison.summary':
    'Как Open Headers выглядит на фоне облачных платформ, настольных прокси и расширений только для заголовков.',
  'workbench.docs.nav.roadmap.title': 'Каждая поверхность выпущена',
  'workbench.docs.nav.roadmap.summary':
    'Достигнутые вехи — рабочие пространства Git, настольное приложение, сервер MCP, собственный сервер, CLI, веб-приложение, импортёры.',
  'workbench.docs.nav.conditions.title': 'Условия',
  'workbench.docs.nav.conditions.summary':
    'Фильтры с логикой AND, через которые проходит каждое правило — домены, шаблоны URL, методы, заголовки.',
  'workbench.docs.nav.actions.title': 'Действия',
  'workbench.docs.nav.actions.summary':
    'Половина правила «что делать» — изменить запрос, изменить ответ или выполнить код. Работает в паре с условиями.',
  'workbench.docs.nav.variables.title': 'Переменные',
  'workbench.docs.nav.variables.summary':
    'Пять областей переменных — vault, окружение, коллекция, рабочее пространство, Live — и как разрешаются ссылки.',
  'workbench.docs.nav.requestTracking.title': 'Отслеживание запросов',
  'workbench.docs.nav.requestTracking.summary':
    'Как совпавшие запросы наблюдаются, записываются и показываются значками во всплывающем окне.',
  'workbench.docs.nav.execution.title': 'Как выполняются правила',
  'workbench.docs.nav.execution.summary':
    'Два движка (DNR и на основе скриптов), которые решают, где применяется каждое правило.',
  'workbench.docs.nav.multiTab.title': 'Поведение с несколькими вкладками',
  'workbench.docs.nav.multiTab.summary':
    'Что синхронизируется между вкладками рабочего пространства (данные), а что остаётся у каждой вкладки (компоновка, черновики).',
  'workbench.docs.nav.systemStatus.title': 'Состояние системы',
  'workbench.docs.nav.systemStatus.summary':
    'Индикатор-светофор — что сообщает каждая подсистема и что значат красный / жёлтый / зелёный.',
  'workbench.docs.nav.debugMode.title': 'Режим отладки',
  'workbench.docs.nav.debugMode.summary':
    'Подключение к протоколу отладки браузера — более глубокий доступ к запросам, внедрению и окружению вкладки.',
  'workbench.docs.nav.headerActions.title': 'Действия с заголовками',
  'workbench.docs.nav.headerActions.summary':
    'Добавить, заменить, дописать, удалить или объединить заголовки запроса и ответа.',
  'workbench.docs.nav.block.title': 'Блокировка',
  'workbench.docs.nav.block.summary': 'Отмена совпавших запросов на сетевом уровне.',
  'workbench.docs.nav.redirect.title': 'Перенаправление',
  'workbench.docs.nav.redirect.summary':
    'Отправка совпавших запросов на другой URL-адрес — статический или с подстановкой по регулярному выражению.',
  'workbench.docs.nav.queryParam.title': 'Параметры запроса',
  'workbench.docs.nav.queryParam.summary': 'Добавить, заменить или удалить URL-параметры до того, как запрос уйдёт.',
  'workbench.docs.nav.requestBody.title': 'Тело запроса',
  'workbench.docs.nav.requestBody.summary':
    'Переопределение или преобразование исходящих тел fetch / XHR — статически, динамически или с фильтром GraphQL.',
  'workbench.docs.nav.response.title': 'Изменение ответа',
  'workbench.docs.nav.response.summary':
    'Имитация или изменение API-ответов — синтетическое или преобразованное тело, статус и заголовки.',
  'workbench.docs.nav.inject.title': 'Внедрение JS / CSS',
  'workbench.docs.nav.inject.summary':
    'Выполнение JavaScript или CSS в контексте страницы — до скриптов страницы или после готовности DOM.',
  'workbench.docs.nav.delay.title': 'Задержка',
  'workbench.docs.nav.delay.summary': 'Искусственная задержка для навигаций и fetch / XHR, инициированных из JS.',
  'workbench.docs.nav.resourceTypes.title': 'Типы ресурсов',
  'workbench.docs.nav.resourceTypes.summary':
    'Справочная таблица значений Chrome ResourceType — Page, Frame, Fetch/XHR, Script и остальные.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Сочетания клавиш',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Все сочетания клавиш Рабочей среды, сгруппированные по поверхностям — панели, вкладки, навигация, действия.',
  'workbench.docs.nav.limitations.title': 'Ограничения',
  'workbench.docs.nav.limitations.summary':
    'Известные неожиданности в одном месте — видимость в DevTools, охват скриптов, сопоставление заголовков, объединение.',

  // ── Copy-as-snippet toasts (sidebar row menu + request editor ⋯) ────
  'workbench.copySnippet.copied': 'Скопировано как {format}',
  'workbench.copySnippet.failed': 'Не удалось скопировать',
  'workbench.copySnippet.failedDetail': 'Не удалось скопировать: {message}',
} as const satisfies Catalog;
