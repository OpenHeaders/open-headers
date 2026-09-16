/**
 * Shared chrome family — Russian. Mirrors
 * `catalogs/en/shared-chrome.ts` key for key; see that file for the
 * family rules and the raw-by-design plane (browser banner quoted
 * verbatim raw en, nav / worker / OOPIF, xhr/fetch, boot.interactive).
 * Mints: режим отладки = Debug mode (carried); область действия = the
 * debug scope (reach referent — distinct from область = variable scope,
 * disambiguated by the qualifier, the de Reichweite split); подключить
 * = attach (Chrome's ru DevTools vocabulary; подключённые вкладки
 * carried from the panel tour; the network подключение = connection is
 * context-partitioned); компоновка = layout (carried from panel.ts);
 * источник компоновки = layout donor; Набросок = Scratch (unsaved
 * tier) vs Черновик = Draft (saved tier, carried); холодный старт =
 * cold start / холодное пробуждение = cold wake; Процессы = Processes;
 * жизненный цикл = lifecycle (carried from panel-inspector-cookies);
 * примечания к выпуску = release notes (carried); Выйти из учётной
 * записи = Sign out (distinct from the tray's Выйти = Quit); Дополнения
 * = Add-ons; Оформление = Appearance; Экскурсия = Tour guide (carried);
 * Исправно / Сбой / Проблемы = Healthy / Failure / Issues; Включено /
 * Выключено = the On / Off states here (the Вкл. / Выкл. round-trip is
 * cookies-only); Настроен / Не настроен = the CLI Set up / Not set up
 * states (CLI м. р.); Live raw with a head noun (состояние Live). The
 * {unit} / {units} holes carry localized host nouns and take элемент
 * ({unit}) as in panel.ts, never an agreeing adjective; {version} holes
 * take версия (Обновить до версии {version}); the update-dialog
 * sandwich reads `v{version} уже доступна!` (версия f.).
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Режим отладки',
  'shared.chrome.debug.titleShort': 'Отладка',
  'shared.chrome.debug.unavailableHint': 'Режим отладки доступен в браузерах Chrome и Edge.',
  'shared.chrome.debug.toggleAria': 'Переключить режим отладки',
  'shared.chrome.debug.aboutTooltip': 'О режиме отладки',
  'shared.chrome.debug.openDocsAria': 'Открыть документацию по режиму отладки',
  'shared.chrome.debug.controlsAria': 'Элементы управления режимом отладки',
  'shared.chrome.debug.turnOn': 'Включить режим отладки',
  'shared.chrome.debug.turnOff': 'Выключить режим отладки',
  'shared.chrome.debug.scopeDevtools': 'Где открыто окно DevTools',
  'shared.chrome.debug.scopeActive': 'Вкладка в фокусе',
  'shared.chrome.debug.scopeBoth': 'Обе',
  'shared.chrome.debug.attachTo': 'Подключать к',
  'shared.chrome.debug.includeThisTab': 'Включить эту вкладку браузера',
  'shared.chrome.debug.pinThisTabAria': 'Закрепить эту вкладку браузера',
  'shared.chrome.debug.attachedTabs': 'Подключённые вкладки',
  'shared.chrome.debug.noTabsAttached': 'Подключённых вкладок пока нет',
  'shared.chrome.debug.bannerNote':
    'Пока режим отладки включён, баннер браузера «OH started debugging this browser» показывается на каждой вкладке — не только на подключённых.',
  'shared.chrome.debug.tabNumber': 'Вкладка #{number}',
  'shared.chrome.debug.tabFallback': 'Вкладка {id}',
  'shared.chrome.debug.onThisTab': 'Вы на этой вкладке',
  'shared.chrome.debug.switchTo': 'Переключиться на вкладку {target}',
  'shared.chrome.debug.dormantTooltip':
    'Режим отладки включён, но эта вкладка вне его области действия — эффекты nav / worker / OOPIF ваших правил уровня отладки здесь неактивны. Включите её в область действия из режима отладки (измените область или закрепите эту вкладку). Над запросами страницы (xhr/fetch) они по-прежнему работают.',
  'shared.chrome.debug.tabOutOfScope': 'Вкладка вне области действия',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'Система',
  'shared.chrome.status.aria': 'Состояние системы: {summary}',
  'shared.chrome.status.aboutTooltip': 'Об этой панели',
  'shared.chrome.status.openDocsAria': 'Открыть документацию по состоянию системы',
  'shared.chrome.status.healthy': 'Исправно',
  'shared.chrome.status.failure': 'Сбой',
  'shared.chrome.status.issues': 'Проблемы',
  'shared.chrome.status.noEvents': 'Событий пока нет',
  'shared.chrome.status.subsystemSync': 'Синхронизация',
  'shared.chrome.status.subsystemRules': 'Правила',
  'shared.chrome.status.subsystemRequests': 'Запросы',
  'shared.chrome.status.subsystemPermissions': 'Разрешения',
  'shared.chrome.status.subsystemSecrets': 'Секреты',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Активность',
  'shared.chrome.status.subsystemDebugMode': 'Режим отладки',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': 'сборка {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'Перезапустить приложение',
  'shared.chrome.status.backendOff': 'Выключено',
  'shared.chrome.status.backendConnecting': 'Подключение…',
  'shared.chrome.status.companionDesktopApp': 'Настольное приложение',
  'shared.chrome.status.companionExtensions': 'Расширения',
  'shared.chrome.status.companionConnected': 'Подключено',
  'shared.chrome.status.companionRunsRequests': 'выполняет запросы',
  'shared.chrome.status.companionNotConnected': 'Не подключено',
  'shared.chrome.status.companionInstalledNotConnected': 'Установлено · не подключено',
  'shared.chrome.status.companionNotInstalled': 'Не установлено',
  'shared.chrome.status.companionDownload': 'Скачать',
  'shared.chrome.status.companionPeersConnected': 'Подключено: {count}',
  'shared.chrome.status.companionNoPeers': 'Нет подключённых',
  'shared.chrome.status.companionConnect': 'Подключить',
  'shared.chrome.status.companionOpenApp': 'Открыть приложение',
  'shared.chrome.addons.title': 'Дополнения',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Сервер',
  'shared.chrome.addons.cliSetUp': 'Настроен',
  'shared.chrome.addons.cliNotSetUp': 'Не настроен',
  'shared.chrome.addons.cliStale': 'Токен отозван — настройте заново',
  'shared.chrome.addons.cliExternal': 'Внешняя конфигурация',
  'shared.chrome.addons.cliMalformed': 'Конфигурация повреждена',
  'shared.chrome.addons.cliProvision': 'Настроить',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'Включено',
  'shared.chrome.addons.mcpTurnOn': 'Включить',
  'shared.chrome.addons.notConfigured': 'Не настроено',
  'shared.chrome.addons.requiresDesktop': 'Требуется настольное приложение',
  'shared.chrome.addons.cliViaDesktop': 'Настройте из настольного приложения',
  'shared.chrome.status.coldStart': 'Холодный старт',
  'shared.chrome.status.coldStartMessage': 'Обнаружено снижение производительности — см. диагностический экспорт',
  'shared.chrome.status.coldStartTooltip':
    'Три холодных пробуждения подряд превысили базовый уровень на ≥20%. Последние значения boot.interactive (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Обновление',
  'shared.chrome.updates.downloading': 'Скачивание…',
  'shared.chrome.updates.downloadingPercent': 'Скачивание… {percent}%',
  'shared.chrome.updates.updateAndRestart': 'Обновить и перезапустить',
  'shared.chrome.updates.ignore': 'Пропустить это обновление',
  'shared.chrome.updates.remindLater': 'Напомнить позже',
  'shared.chrome.updates.nowAvailableSuffix': 'уже доступна!',
  'shared.chrome.updates.moreDetailsPrefix': 'Подробнее см.',
  'shared.chrome.updates.releaseNotes': 'примечания к выпуску',
  'shared.chrome.updates.updatingTo': 'Обновление с версии {from} до версии {to}.',
  'shared.chrome.updates.configure': 'Настроить обновления…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': 'Скачать версию {version}',
  'shared.chrome.gearMenu.versionAvailable': 'Доступна версия {version}…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Обновить до версии {version} и перезапустить',
  'shared.chrome.gearMenu.downloadingVersion': 'Скачивание версии {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Перезапустить для установки версии {version}',
  'shared.chrome.gearMenu.settings': 'Настройки…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Сочетания клавиш…',
  'shared.chrome.gearMenu.appearance': 'Оформление…',
  'shared.chrome.gearMenu.about': 'О программе Open Headers',
  'shared.chrome.gearMenu.tourGuide': 'Экскурсия',
  'shared.chrome.gearMenu.signOut': 'Выйти из учётной записи',
  'shared.chrome.gearMenu.searchPlaceholder': 'Поиск',
  'shared.chrome.gearMenu.noMatches': 'Нет совпадений',
  'shared.chrome.gearMenu.settingsTooltip': 'Настройки',
  'shared.chrome.gearMenu.settingsMenuAria': 'Меню настроек',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Процессы',
  'shared.chrome.tasks.hidePanelAria': 'Скрыть панель процессов',
  'shared.chrome.tasks.allCompleted': 'Все фоновые задачи завершены',
  'shared.chrome.tasks.aboutNoteAria': 'Об этой заметке',
  'shared.chrome.tasks.stop': 'Остановить',
  'shared.chrome.tasks.keepRunning': 'Продолжить выполнение',
  'shared.chrome.tasks.stopTaskAria': 'Остановить фоновую задачу',
  'shared.chrome.tasks.hideTaskAria': 'Скрыть фоновую задачу',
  'shared.chrome.tasks.hideProcesses': 'Скрыть процессы',
  'shared.chrome.tasks.hideProcessesCount': 'Скрыть процессы ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': 'Элемент по умолчанию ({unit}) — новые {units} наследуют компоновку отсюда.',
  'shared.chrome.donor.nonDefaultTooltip':
    'Источник компоновки по умолчанию — другой элемент ({unit}); новые {units} наследуют её оттуда.',
  'shared.chrome.donor.isDonorBody':
    'Этот элемент ({unit}) сейчас задаёт компоновку по умолчанию. Новые {units} наследуют её.',
  'shared.chrome.donor.nonDonorBody':
    'Компоновку по умолчанию сейчас задаёт другой элемент ({unit}). Новые {units} наследуют компоновку того элемента ({unit}).',
  'shared.chrome.donor.reset': 'Сбросить компоновку к значениям по умолчанию',
  'shared.chrome.donor.defaultAria':
    'Элемент по умолчанию ({unit}), от которого наследуют компоновку новые элементы ({unit})',
  'shared.chrome.donor.nonDefaultAria':
    'Не элемент по умолчанию ({unit}), от которого наследуют компоновку новые элементы ({unit})',
  'shared.chrome.donor.defaultLabel': 'По умолчанию: {unit}',
  'shared.chrome.donor.inheritsLabel': 'Наследует компоновку',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'Состояния жизненного цикла',
  'shared.chrome.lifecycle.scratch': 'Набросок',
  'shared.chrome.lifecycle.scratchBody':
    'Несохранённый черновик. Ничего не сохраняется, пока вы не нажмёте «Сохранить».',
  'shared.chrome.lifecycle.unresolved': 'Не разрешено',
  'shared.chrome.lifecycle.unresolvedBody': 'Содержит ссылки {{ref}}, которые не разрешаются в активной области.',
  'shared.chrome.lifecycle.draft': 'Черновик',
  'shared.chrome.lifecycle.draftBody':
    'Сохранено, но ещё не в состоянии Live — не заполнены обязательные поля или ещё не опубликовано.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Опубликовано и активно.',
} as const satisfies Catalog;
