/**
 * Workbench settings — keyboard-category setting definitions — Russian.
 * Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts` key for
 * key. Chord notation and physical key names (ArrowDown, Enter, Space,
 * ⌘K, Alt+C, …) ride raw inside keyed values — localized key names
 * are a deferred Phase I workstream (ru ships raw too, S46). Action
 * labels reuse the shipped `popup.shortcuts.*` ru wording (S35 reuse
 * law): Переключить режим отладки / Сменить тему / Компактный режим /
 * Развернуть / войти в подстроки etc.; popup tab names quote the
 * shipped ru labels («Эта страница» / «Все правила» / «Коллекции»);
 * the `Popup —` label prefix KEEPS as the spaced aside dash
 * (Всплывающее окно — …) with the shipped popup mint verbatim after
 * it. Лента активности = Activity Feed (chrome mint); экскурсия =
 * tour guide (popup mint); палитра команд carried from
 * workbench-chrome. MINTS: шпаргалка = cheatsheet; предустановка =
 * preset (carried); центр импорта = the import hub
 * (`workbench-import-export.ts` must reuse); spacebar in prose =
 * клавиша пробела. Brand tokens never compounded: по умолчанию
 * OpenHeaders, в стиле VS Code.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Переключить режим отладки',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'Включить или выключить режим отладки с любой поверхности. Срабатывает, только когда ни одно текстовое поле не в фокусе.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'Режим отладки доступен в браузерах Chrome и Edge.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Открыть палитру команд',
  'workbench.settings.def.keyboard.commandPalette.description': 'Показать палитру команд поверх окна.',
  'workbench.settings.def.keyboard.openSettings.label': 'Открыть настройки',
  'workbench.settings.def.keyboard.openSettings.description': 'Открыть модальное окно настроек.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Переключить левую боковую панель',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Показать или скрыть левую боковую панель.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Переключить правую боковую панель',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Показать или скрыть правую боковую панель.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Переключить нижнюю панель',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Показать или скрыть нижнюю панель.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'Переключить Ленту активности',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': 'Показать или скрыть панель «Лента активности».',
  'workbench.settings.def.keyboard.newRule.label': 'Создать элемент',
  'workbench.settings.def.keyboard.newRule.description': 'Открыть меню создания правил и API-запросов.',
  'workbench.settings.def.keyboard.newTab.label': 'Новая вкладка',
  'workbench.settings.def.keyboard.newTab.description': 'Открыть новую вкладку с черновиком API-запроса.',
  'workbench.settings.def.keyboard.import.label': 'Импорт',
  'workbench.settings.def.keyboard.import.description':
    'Открыть центр импорта для curl, HAR и файлов рабочего пространства.',
  'workbench.settings.def.keyboard.save.label': 'Сохранить',
  'workbench.settings.def.keyboard.save.description': 'Сохранить активную вкладку редактора.',
  'workbench.settings.def.keyboard.closeTab.label': 'Закрыть вкладку',
  'workbench.settings.def.keyboard.closeTab.description': 'Закрыть вкладку редактора в фокусе.',
  'workbench.settings.def.keyboard.previousTab.label': 'Предыдущая вкладка',
  'workbench.settings.def.keyboard.previousTab.description': 'Перейти к предыдущей вкладке редактора.',
  'workbench.settings.def.keyboard.nextTab.label': 'Следующая вкладка',
  'workbench.settings.def.keyboard.nextTab.description': 'Перейти к следующей вкладке редактора.',
  'workbench.settings.def.keyboard.tabSearch.label': 'Поиск по вкладкам',
  'workbench.settings.def.keyboard.tabSearch.description': 'Открыть поиск по всем открытым вкладкам.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Перейти к фильтру активного раздела',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    'Перевести фокус в поле фильтра того раздела боковой панели, в котором вы сейчас находитесь.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Перейти к левой боковой панели',
  'workbench.settings.def.keyboard.focusLeftSidebar.description': 'Перевести фокус клавиатуры на левую боковую панель.',
  'workbench.settings.def.keyboard.focusEditor.label': 'Перейти к редактору',
  'workbench.settings.def.keyboard.focusEditor.description': 'Перевести фокус клавиатуры в область редактора.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Перейти к правой боковой панели',
  'workbench.settings.def.keyboard.focusRightSidebar.description':
    'Перевести фокус клавиатуры на правую боковую панель.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Перейти к нижней панели',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    'Перевести фокус клавиатуры на строку вкладок нижней панели.',
  'workbench.settings.def.keyboard.terminalNewTab.label': 'Новая вкладка терминала',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'Открыть новую вкладку терминала, пока панель «Терминал» в фокусе; в остальных местах сочетание сохраняет обычное ' +
    'действие «Новая вкладка». Только в настольном приложении.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'Показать справку по сочетаниям',
  'workbench.settings.def.keyboard.showShortcutHelp.description': 'Показать шпаргалку по сочетаниям клавиш.',
  'workbench.settings.def.keyboard.find.label': 'Найти в редакторе',
  'workbench.settings.def.keyboard.find.description':
    'Открыть виджет поиска в редакторе кода в фокусе. Срабатывает, только когда редактор в фокусе — не мешает глобальным сочетаниям.',
  'workbench.settings.def.keyboard.replace.label': 'Заменить в редакторе',
  'workbench.settings.def.keyboard.replace.description':
    'Открыть виджет поиска и замены в редакторе кода в фокусе. Срабатывает, только когда редактор в фокусе — не мешает глобальным сочетаниям.',
  'workbench.settings.def.keyboard.formatCode.label': 'Форматировать код',
  'workbench.settings.def.keyboard.formatCode.description':
    'Отформатировать буфер редактора кода в фокусе. Срабатывает, только когда редактор в фокусе — не мешает глобальным сочетаниям.',
  'workbench.settings.def.keyboard.preset.label': 'Предустановка',
  'workbench.settings.def.keyboard.preset.description':
    'Базовый набор сочетаний. Настроенные вами сочетания накладываются поверх предустановки и переживают её смену.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'По умолчанию OpenHeaders',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'В стиле VS Code',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'Всплывающее окно — Справка по сочетаниям',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Показать или скрыть шпаргалку по сочетаниям клавиш всплывающего окна.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Всплывающее окно — Меню параметров',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'Открыть или закрыть выпадающее меню параметров в футере.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Всплывающее окно — Перейти к поиску',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'Перевести фокус клавиатуры в поле поиска активной вкладки.',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Всплывающее окно — Предыдущая страница',
  'workbench.settings.def.keyboard.popup.prevPage.description':
    'Перейти к предыдущей странице правил в активной вкладке.',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Всплывающее окно — Следующая страница',
  'workbench.settings.def.keyboard.popup.nextPage.description':
    'Перейти к следующей странице правил в активной вкладке.',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Всплывающее окно — Вниз',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Перейти к следующей строке. ArrowDown всегда доступна как синоним.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Всплывающее окно — Вверх',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Перейти к предыдущей строке. ArrowUp всегда доступна как синоним.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Всплывающее окно — Развернуть / войти в подстроки',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Развернуть строку в фокусе. ArrowRight и Enter всегда доступны как синонимы.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Всплывающее окно — Свернуть / выйти из подстрок',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Свернуть строку в фокусе. ArrowLeft всегда доступна как синоним.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Всплывающее окно — Включить / выключить',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'Включить или выключить правило в фокусе. По умолчанию — клавиша пробела.',
  'workbench.settings.def.keyboard.popup.editRow.label': 'Всплывающее окно — Изменить правило',
  'workbench.settings.def.keyboard.popup.editRow.description':
    'Открыть правило в фокусе в редакторе рабочего пространства.',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Всплывающее окно — Копировать значение',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Скопировать основное значение строки в фокусе в буфер обмена.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Всплывающее окно — Удалить',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Пометить строку в фокусе к удалению. Нажмите ещё раз (или Enter), чтобы подтвердить.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Всплывающее окно — Добавить новое правило',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Создать новое правило из всплывающего окна.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label':
    'Всплывающее окно — Приостановить / возобновить все правила',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Приостановить или возобновить все правила во всех коллекциях.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'Всплывающее окно — Приостановить / возобновить коллекцию или папку',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    'Приостановить или возобновить коллекцию или папку в фокусе на вкладке «Коллекции». Не действует на отдельные строки правил — правила переключаются выключателем включения (Space).',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Всплывающее окно — Сменить тему',
  'workbench.settings.def.keyboard.popup.cycleTheme.description':
    'Переключаться по кругу между светлой, тёмной и автоматической темой.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Всплывающее окно — Компактный режим',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Переключать всплывающее окно между компактной и просторной плотностью.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'Всплывающее окно — Открыть рабочее пространство',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': 'Открыть полную вкладку рабочего пространства.',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Всплывающее окно — Открыть настройки',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    'Открыть страницу настроек в новой вкладке рабочего пространства. Совпадает с сочетанием рабочего пространства.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Всплывающее окно — Вкладка «Эта страница»',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': 'Открыть вкладку правил «Эта страница».',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Всплывающее окно — Вкладка «Все правила»',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': 'Открыть вкладку «Все правила».',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Всплывающее окно — Вкладка «Коллекции»',
  'workbench.settings.def.keyboard.popup.tabCollections.description': 'Открыть вкладку «Коллекции».',
  'workbench.settings.def.keyboard.popup.toggleSurface.label':
    'Всплывающее окно — Переключить всплывающее окно / боковую панель',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'Переключаться между компоновками всплывающего окна и боковой панели из заголовка всплывающего окна.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Всплывающее окно — Открыть экскурсию',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    'Повторить приветственную экскурсию с любой вкладки всплывающего окна.',
} as const satisfies Catalog;
