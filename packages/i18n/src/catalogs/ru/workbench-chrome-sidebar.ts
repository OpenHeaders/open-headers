/**
 * Workbench chrome — the navigator plane — Russian. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Entity names,
 * collection names, and counts ride raw inside keyed values; `VAULT` /
 * `Vault` / `delete-wins` / `cURL` / `fetch` / the Live prefix ride
 * raw. Section headers keep en's caps (ПРАВИЛА, ПЕРЕМЕННЫЕ LIVE — the
 * shared-workspace АКТИВНО precedent). Reuses mints: Набросок =
 * Scratch, Черновик = Draft, Блокировка = Block, переопределение =
 * override, коллекция / рабочий процесс / окружение / спецификация
 * carried; rule-type names align with the chrome registry (Заголовок /
 * Блокировка / Перенаправление / Параметр запроса / Внедрение /
 * Задержка / Тело API-запроса / API-ответ). File mints: Библиотека
 * пакетов carried; заместить = supersede (the superseded local edit);
 * покрытие = rule-match coverage (scope-widened — a third referent
 * beside область = variable scope and область действия = debug reach,
 * S19 law); переопределение паузы = pause override; возобновить =
 * resume / unpause; откатить = revert; заглушить = mute; без скрытия =
 * unredacted (скрыть = redact carried from panel-inspector); пир
 * carried; Инструменты › Трафик = the Tools › Traffic settings path
 * (the settings file quotes it). The confirm-delete sandwich keeps its
 * en edge spaces around the bold name. Plurals one / few / many /
 * other (элемент / элемента / элементов, папка / папки / папок).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'ПРАВИЛА',
  'workbench.sidebar.section.templates': 'ШАБЛОНЫ',
  'workbench.sidebar.section.requests': 'ЗАПРОСЫ',
  'workbench.sidebar.section.workflows': 'РАБОЧИЕ ПРОЦЕССЫ',
  'workbench.sidebar.section.environments': 'ОКРУЖЕНИЯ',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'ПЕРЕМЕННЫЕ РАБОЧЕГО ПРОСТРАНСТВА',
  'workbench.sidebar.section.liveVariables': 'ПЕРЕМЕННЫЕ LIVE',
  'workbench.sidebar.section.packageLibrary': 'БИБЛИОТЕКА ПАКЕТОВ',
  'workbench.sidebar.section.specs': 'СПЕЦИФИКАЦИИ',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'Браузерный перехватчик',
  'workbench.sidebar.view.apiRequests': 'API-запросы',
  'workbench.sidebar.view.workflows': 'Рабочие процессы',
  'workbench.sidebar.view.variables': 'Переменные',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'Новое правило',
  'workbench.sidebar.header.addRequest': 'Добавить запрос',
  'workbench.sidebar.header.createNewEnvironment': 'Создать новое окружение',
  'workbench.sidebar.header.createNewSpec': 'Создать новую спецификацию',
  'workbench.sidebar.header.newWorkflow': 'Новый рабочий процесс',
  'workbench.sidebar.header.newTemplateCollection': 'Новая коллекция шаблонов',
  'workbench.sidebar.header.exportSelected': 'Экспортировать выбранное ({count})…',
  'workbench.sidebar.header.exportSelectedAria': 'Экспортировать выбранные элементы ({count})',
  'workbench.sidebar.header.clearSelection': 'Снять выделение',
  'workbench.sidebar.header.clearSelectionAria': 'Снять выделение для экспорта',
  'workbench.sidebar.header.selectOpenedTab': 'Выбрать открытую вкладку',
  'workbench.sidebar.header.selectOpenedTabAria': 'Выбрать открытую вкладку',
  'workbench.sidebar.header.expandAll': 'Развернуть всё',
  'workbench.sidebar.header.expandAllAria': 'Развернуть всё',
  'workbench.sidebar.header.collapseAll': 'Свернуть всё',
  'workbench.sidebar.header.collapseAllAria': 'Свернуть всё',
  'workbench.sidebar.behavior.title': 'Поведение',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'Открывать записи одиночным щелчком',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'Открывать коллекции одиночным щелчком',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'Открывать папки одиночным щелчком',
  'workbench.sidebar.behavior.alwaysSelectOpened': 'Всегда выбирать открытую вкладку',
  'workbench.sidebar.appearance.title': 'Оформление',
  'workbench.sidebar.appearance.showIndentGuides': 'Показывать направляющие отступов',
  'workbench.sidebar.dnd.itemsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} элемент',
      few: '{count} элемента',
      many: '{count} элементов',
      other: '{count} элементов',
    }),
  'workbench.sidebar.toast.itemsMoved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Перемещён {count} элемент',
      few: 'Перемещено {count} элемента',
      many: 'Перемещено {count} элементов',
      other: 'Перемещено {count} элементов',
    }),
  'workbench.sidebar.toast.moveFailed': 'Не удалось переместить',
  'workbench.sidebar.filterPlaceholder': 'Фильтр',

  // ── Sidebar: speed-search bar (on-demand, dual filter/search mode) ──
  'workbench.sidebar.menu.search': 'Поиск',
  'workbench.sidebar.search.searchPlaceholder': 'Поиск',
  'workbench.sidebar.search.modeSearch': 'Поиск: подсвечивать совпадающие строки',
  'workbench.sidebar.search.modeFilter': 'Фильтр: скрывать несовпадающие строки',
  'workbench.sidebar.search.noMatches': 'Нет совпадений',
  'workbench.sidebar.search.close': 'Закрыть поиск',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'Новая коллекция',
  'workbench.sidebar.menu.newRequest': 'Новый запрос',
  'workbench.sidebar.menu.import': 'Импорт…',
  'workbench.sidebar.menu.addRule': 'Добавить правило',
  'workbench.sidebar.menu.addRequest': 'Добавить запрос',
  'workbench.sidebar.menu.addFolder': 'Добавить папку',
  'workbench.sidebar.menu.rename': 'Переименовать',
  'workbench.sidebar.menu.editVariables': 'Изменить переменные',
  'workbench.sidebar.menu.createWorkflow': 'Создать рабочий процесс…',
  'workbench.sidebar.menu.export': 'Экспорт…',
  'workbench.sidebar.menu.delete': 'Удалить',
  'workbench.sidebar.menu.duplicate': 'Дублировать',
  'workbench.sidebar.menu.copyAs': 'Копировать как',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.convertToGraphql': 'Преобразовать в запрос GraphQL',
  'workbench.sidebar.menu.pauseCollection': 'Приостановить коллекцию',
  'workbench.sidebar.menu.unpauseCollection': 'Возобновить коллекцию',
  'workbench.sidebar.menu.pauseFolder': 'Приостановить папку',
  'workbench.sidebar.menu.unpauseFolder': 'Возобновить папку',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Сбросить переопределение паузы коллекции',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Сбросить переопределение паузы папки',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Очистить вложенные переопределения паузы',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'на паузе',
  'workbench.sidebar.badge.draft': 'черновик',
  'workbench.sidebar.badge.unresolved': 'не разрешено',
  'workbench.sidebar.badge.off': 'выключено',
  'workbench.sidebar.badge.incomplete': 'не завершено',
  'workbench.sidebar.badge.scratch': 'набросок',
  'workbench.sidebar.badge.scripts': 'скрипты',
  'workbench.sidebar.badge.specDrift': 'изменено',
  'workbench.sidebar.badge.scriptsTooltip':
    'Этот импортированный запрос при выполнении запустит JavaScript. Откройте его, чтобы просмотреть скрипты.',
  'workbench.sidebar.badge.dirtyAria': 'несохранённые изменения',
  'workbench.sidebar.rule.enable': 'Включить правило',
  'workbench.sidebar.rule.disable': 'Выключить правило',
  'workbench.sidebar.env.setActive': 'Сделать активным',
  'workbench.sidebar.env.setInactive': 'Сделать неактивным',
  'workbench.sidebar.env.setDefault': 'Сделать окружением по умолчанию',
  'workbench.sidebar.env.unsetDefault': 'Снять статус «по умолчанию»',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} перем.',
      few: '{count} перем.',
      many: '{count} перем.',
      other: '{count} перем.',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'К этому рабочему процессу привязана {count} переменная Live',
      few: 'К этому рабочему процессу привязаны {count} переменные Live',
      many: 'К этому рабочему процессу привязано {count} переменных Live',
      other: 'К этому рабочему процессу привязано {count} переменных Live',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'Папка пуста',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'Коллекция пуста',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'Запросов пока нет',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'Шаблонов пока нет',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Добавьте правило или папку, чтобы начать.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Добавьте запрос или папку, чтобы начать.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Сохраните правило как шаблон, чтобы заполнить папку.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'Сохраните правило как шаблон из редактора.',
  'workbench.sidebar.placeholder.addRule': 'Добавить правило',
  'workbench.sidebar.placeholder.addFolder': 'Добавить папку',
  'workbench.sidebar.placeholder.addRequest': 'Добавить запрос',
  'workbench.sidebar.emptySection': 'В этом разделе нет элементов',
  'workbench.sidebar.emptySectionCreate': 'Создать',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'Системные шаблоны',
  'workbench.sidebar.ruleType.header': 'Заголовок',
  'workbench.sidebar.ruleType.block': 'Блокировка',
  'workbench.sidebar.ruleType.redirect': 'Перенаправление',
  'workbench.sidebar.ruleType.queryParam': 'Параметр запроса',
  'workbench.sidebar.ruleType.inject': 'Внедрение',
  'workbench.sidebar.ruleType.delay': 'Задержка',
  'workbench.sidebar.ruleType.requestBody': 'Тело API-запроса',
  'workbench.sidebar.ruleType.response': 'API-ответ',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'Переменные рабочего пространства',
  'workbench.sidebar.singleton.liveVariables': 'Переменные Live',
  'workbench.sidebar.singleton.packageLibrary': 'Библиотека пакетов',

  // ── Sidebar: default entity names ───────────────────────────────────
  // (New Rules/Requests Collection promoted to `shared.defaults.*` when
  // the save modals became their second converted consumer; New
  // Environment followed when App's env-selector create flow converted.)
  'workbench.sidebar.defaults.newFolder': 'Новая папка',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': 'Удалить элемент?',
  'workbench.sidebar.confirmDelete.bodyPrefix': 'Вы действительно хотите удалить ',
  'workbench.sidebar.confirmDelete.bodySuffix': '? Это действие нельзя отменить.',
  'workbench.sidebar.confirmDelete.ok': 'Удалить',
  'workbench.sidebar.toast.toggleRuleFailed': 'Не удалось переключить правило',
  'workbench.sidebar.toast.renameExampleFailed': 'Не удалось переименовать пример',
  'workbench.sidebar.toast.duplicateExampleFailed': 'Не удалось дублировать пример',
  'workbench.sidebar.toast.deleteExampleFailed': 'Не удалось удалить пример',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'Не удалось создать коллекцию запросов',
  'workbench.sidebar.toast.createEnvironmentFailed': 'Не удалось создать окружение',
  'workbench.sidebar.toast.createSpecFailed': 'Не удалось создать спецификацию',
  'workbench.sidebar.toast.renameSpecFailed': 'Не удалось переименовать спецификацию',
  'workbench.sidebar.toast.deleteSpecFailed': 'Не удалось удалить спецификацию',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'Изменение откачено',
  'workbench.activityFeed.revertFailed': 'Не удалось откатить: {reason}',
  'workbench.activityFeed.emptyTitle': 'Активности пока нет',
  'workbench.activityFeed.emptyHint': 'Здесь будут появляться входящие изменения от пиров.',
  'workbench.activityFeed.view': 'Просмотр',
  'workbench.activityFeed.mute': 'Заглушить',
  'workbench.activityFeed.unmute': 'Снять заглушение',
  'workbench.activityFeed.muteTip':
    'Не показывать дальнейшие строки входящей активности для этого элемента. Прошлые строки сохраняются.',
  'workbench.activityFeed.unmuteTip': 'Снова показывать входящую активность для этого элемента.',
  'workbench.activityFeed.revert': 'Откатить',
  'workbench.activityFeed.revertTip':
    'Применить обратное этому изменению. Создаёт новую мутацию, которая возвращает элемент к состоянию до входящего изменения.',
  'workbench.activityFeed.revertUnavailableDelete': 'Удаления необратимы, их нельзя откатить (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'Это изменение нельзя откатить.',
  'workbench.activityFeed.revertUnavailableParentGone': 'Папки, из которой пришёл этот элемент, больше нет.',
  'workbench.activityFeed.kind.created': 'Создано',
  'workbench.activityFeed.kind.createdTip': 'Новый элемент пришёл от пира.',
  'workbench.activityFeed.kind.edited': 'Изменено',
  'workbench.activityFeed.kind.editedTip': 'Пир изменил поля этого элемента.',
  'workbench.activityFeed.kind.deleted': 'Удалено',
  'workbench.activityFeed.kind.deletedTip': 'Пир удалил этот элемент.',
  'workbench.activityFeed.kind.superseded': 'Замещена локальная правка',
  'workbench.activityFeed.kind.supersededTip': 'Входящая мутация заместила вашу незавершённую локальную правку.',
  'workbench.activityFeed.kind.sensitiveRotation': 'Ротация чувствительного поля',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'Заменено чувствительное поле (секрет / токен / чувствительный заголовок).',
  'workbench.activityFeed.kind.scopeWidened': 'Покрытие расширено',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'Условие правила ослаблено — теперь правило совпадает с более широким набором URL-адресов и методов.',
  'workbench.activityFeed.kind.agentObserved': 'Чтение агентом',
  'workbench.activityFeed.kind.agentObservedTip':
    'Агент прочитал живой трафик через уровень наблюдения MCP — проекции со скрытыми значениями из активированного источника.',
  'workbench.activityFeed.kind.rehomed': 'Перемещено в корень коллекции',
  'workbench.activityFeed.kind.rehomedTip':
    'Его папку удалил или переместил внутрь самой себя другой пир, поэтому этот элемент заново прикреплён к корню коллекции.',
  'workbench.activityFeed.rawRead': 'Без скрытия',
  'workbench.activityFeed.rawReadTip':
    'Это чтение вернуло исходные значения — было включено разрешение на чтение сеансов без скрытия в разделе «Инструменты › Трафик».',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} правило',
      few: '{count} правила',
      many: '{count} правил',
      other: '{count} правил',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} запрос',
      few: '{count} запроса',
      many: '{count} запросов',
      other: '{count} запросов',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} шаблон',
      few: '{count} шаблона',
      many: '{count} шаблонов',
      other: '{count} шаблонов',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} папка',
      few: '· {count} папки',
      many: '· {count} папок',
      other: '· {count} папок',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} подпапка',
      few: '· {count} подпапки',
      many: '· {count} подпапок',
      other: '· {count} подпапок',
    }),
  'workbench.overview.stats.activeTag': 'активных: {count}',
  'workbench.overview.stats.disabledTag': 'выключенных: {count}',
  'workbench.overview.stats.draftTag': 'черновиков: {count}',
  'workbench.overview.stats.pausedTag': 'На паузе',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Папка · {count} правило',
      few: 'Папка · {count} правила',
      many: 'Папка · {count} правил',
      other: 'Папка · {count} правил',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Папка · {count} запрос',
      few: 'Папка · {count} запроса',
      many: 'Папка · {count} запросов',
      other: 'Папка · {count} запросов',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Папка · {count} шаблон',
      few: 'Папка · {count} шаблона',
      many: 'Папка · {count} шаблонов',
      other: 'Папка · {count} шаблонов',
    }),
  'workbench.overview.status.draft': 'Черновик',
  'workbench.overview.status.incomplete': 'Не завершено',
  'workbench.overview.status.disabled': 'Выключено',
  'workbench.overview.status.paused': 'На паузе',
  'workbench.overview.status.active': 'Активно',
  'workbench.overview.action.addRule': 'Добавить правило',
  'workbench.overview.action.addRequest': 'Добавить запрос',
  'workbench.overview.action.pause': 'Приостановить',
  'workbench.overview.action.resume': 'Возобновить',
  'workbench.overview.action.pauseCollectionTooltip': 'Приостановить все правила в этой коллекции',
  'workbench.overview.action.resumeCollectionTooltip': 'Возобновить все правила в этой коллекции',
  'workbench.overview.action.pauseFolderTooltip': 'Приостановить все правила в этой папке',
  'workbench.overview.action.resumeFolderTooltip': 'Возобновить все правила в этой папке',
  'workbench.overview.action.variables': 'Переменные',
  'workbench.overview.action.variablesTooltip': 'Изменить переменные в области этой коллекции',
  'workbench.overview.action.variablesTooltipTemplate': 'Изменить переменные в области этой коллекции шаблонов',
  'workbench.overview.caption.description': 'Описание',
  'workbench.overview.caption.contents': 'Содержимое',
  'workbench.overview.empty.collectionNotFound': 'Коллекция не найдена',
  'workbench.overview.empty.folderNotFound': 'Папка не найдена',
  'workbench.overview.empty.requestCollectionNotFound': 'Коллекция запросов не найдена',
  'workbench.overview.empty.templateCollectionNotFound': 'Коллекция шаблонов не найдена',
  'workbench.overview.empty.noItems': 'Элементов пока нет',
  'workbench.overview.empty.noRequests': 'Запросов пока нет',
  'workbench.overview.empty.templatesCollection':
    'В этой коллекции нет шаблонов. Сохраните правило как шаблон, чтобы заполнить коллекцию.',
  'workbench.overview.empty.templatesFolder':
    'Шаблонов пока нет — сохраните правило как шаблон из редактора правил, чтобы заполнить эту папку.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Поиск коллекции',
  'workbench.collectionPicker.empty': 'Коллекций пока нет — одна будет создана при импорте.',
  'workbench.collectionPicker.noMatch': 'Нет подходящих коллекций.',
  'workbench.collectionPicker.newCollection': 'Новая коллекция',
} as const satisfies Catalog;
