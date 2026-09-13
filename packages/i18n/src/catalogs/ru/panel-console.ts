/**
 * DevTools panel — console tool window — Russian. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level wire
 * names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context labels
 * (top / frame names / script URLs), source locations, "(anonymous)",
 * the browser's synthesized network phrasing quoted verbatim
 * ("finished loading", "Access to fetch at …"), key names (Tab /
 * Enter / arrows ride raw), and the example-transcript rows in the (i)
 * corpora. Панель Network keeps the raw panel name (zh-CN precedent).
 * Mints: строка ввода = prompt (REPL); упреждающее вычисление = eager
 * evaluation; вычислить = evaluate; расшифровка = transcript; захват =
 * capture (carried); трассировка стека = stack trace; закрепить = pin
 * (carried); область = the debug-reach scope (S19 law); сохранять =
 * preserve. OH's own setting labels quoted in prose copy this file's
 * mints in «…».
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'Очистить консоль',
  'panel.console.collapseAll': 'Свернуть всё',
  'panel.console.expandAll': 'Развернуть всё',
  'panel.console.filterAria': 'Фильтр сообщений консоли',
  'panel.console.levelTitle': 'Уровень журнала: {label}',
  'panel.console.settings': 'Настройки консоли',
  'panel.console.settingsPaneAria': 'Настройки консоли',
  'panel.console.contextTitle': 'Контекст JavaScript — где вычисляются команды консоли',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Подробно',
  'panel.console.levels.info': 'Сведения',
  'panel.console.levels.warnings': 'Предупреждения',
  'panel.console.levels.errors': 'Ошибки',
  'panel.console.levels.all': 'Все уровни',
  'panel.console.levels.defaultLevels': 'Уровни по умолчанию',
  'panel.console.levels.hideAll': 'Скрыть все',
  'panel.console.levels.only': 'Только {level}',
  'panel.console.levels.custom': 'Свои уровни',
  'panel.console.levels.default': 'По умолчанию',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Скрыть сеть',
  'panel.console.setting.hideNetworkTitle':
    'Скрывать сетевые записи журнала браузера (неудачные и заблокированные запросы)',
  'panel.console.setting.logXhr': 'Записывать XMLHttpRequest',
  'panel.console.setting.logXhrTitle':
    'Записывать сообщение, когда запрос XHR, fetch или EventSource завершается или завершается ошибкой',
  'panel.console.setting.preserveLog': 'Сохранять журнал',
  'panel.console.setting.preserveLogTitle': 'Не очищать журнал при переходе',
  'panel.console.setting.eagerEval': 'Упреждающее вычисление',
  'panel.console.setting.eagerEvalTitle': 'Вычислять текст в строке ввода заранее (предпросмотр без побочных эффектов)',
  'panel.console.setting.selectedContextOnly': 'Только выбранный контекст',
  'panel.console.setting.selectedContextOnlyTitle': 'Показывать сообщения только из выбранного контекста',
  'panel.console.setting.autocompleteHistory': 'Автодополнение из истории',
  'panel.console.setting.autocompleteHistoryTitle': 'Предлагать ранее выполненные команды по мере ввода в строке ввода',
  'panel.console.setting.groupSimilar': 'Группировать похожие сообщения в консоли',
  'panel.console.setting.groupSimilarTitle':
    'Сворачивать повторяющиеся одинаковые сообщения в одну строку со счётчиком',
  'panel.console.setting.evalUserGesture': 'Считать вычисление кода действием пользователя',
  'panel.console.setting.evalUserGestureTitle':
    'Вычислять с жестом пользователя, чтобы из строки ввода работали API, требующие активации пользователем',
  'panel.console.setting.showCorsErrors': 'Показывать ошибки CORS в консоли',
  'panel.console.setting.showCorsErrorsTitle': 'Показывать ошибки политики CORS рядом с собственным выводом страницы',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Пример консоли',
  'panel.console.info.hideNetwork.summary':
    'Скрывает собственные сетевые записи журнала браузера — неудачные и заблокированные запросы, — а вывод консоли страницы остаётся всегда.',
  'panel.console.info.hideNetwork.description':
    'Скрывает и строки «finished loading», которые синтезирует «Записывать XMLHttpRequest» — они тоже сообщения с сетевым источником.',
  'panel.console.info.logXhr.summary':
    'Записывает строку всякий раз, когда запрос XHR, fetch или EventSource завершается или завершается ошибкой.',
  'panel.console.info.logXhr.description':
    'Строки записываются на уровне «Сведения» — ошибки тоже, — а URL-адрес ведёт к строке запроса в панели Network. «Скрыть сеть» скрывает и эти строки.',
  'panel.console.info.preserveLog.summary': 'Сохраняет журнал при переходах между страницами вместо его очистки.',
  'panel.console.info.preserveLog.description':
    'Если выключено, переход — пересоздание верхнего контекста страницы — обрезает вид до записей, пришедших после него.',
  'panel.console.info.eagerEval.summary': 'Показывает результат вводимого выражения на серой строке под строкой ввода.',
  'panel.console.info.eagerEval.description':
    'Предпросмотр вычисляется без побочных эффектов: выражение, которое изменило бы состояние страницы, ничего не показывает вместо выполнения, и в журнал ничего не пишется, пока вы не нажмёте Enter.',
  'panel.console.info.selectedContextOnly.summary':
    'Показывает только сообщения из контекста JavaScript, выбранного в селекторе контекста на панели инструментов.',
  'panel.console.info.selectedContextOnly.description':
    'Записи без контекста — собственные записи журнала браузера — остаются видимыми всегда.',
  'panel.console.info.autocompleteHistory.summary':
    'Предлагает самую недавнюю команду, продолжающую введённое, как приглушённое дополнение в строке ввода.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — или → в конце ввода — принимает его; ↑/↓ по-прежнему листают историю. История живёт в течение текущего сеанса панели.',
  'panel.console.info.groupSimilar.title': 'Группировать похожие сообщения',
  'panel.console.info.groupSimilar.summary':
    'Сворачивает идущие подряд одинаковые сообщения в одну строку со значком-счётчиком.',
  'panel.console.info.groupSimilar.description':
    'Введённые команды и их результаты никогда не группируются — расшифровка остаётся дословной.',
  'panel.console.info.evalUserGesture.summary':
    'Выполняет команды из строки ввода так, будто их вызвал жест пользователя.',
  'panel.console.info.evalUserGesture.description':
    'API, требующие активации пользователем — открытие окна, запись в буфер обмена, полноэкранный режим, — с этой настройкой срабатывают из строки ввода.',
  'panel.console.info.showCorsErrors.summary':
    'Показывает пояснения браузера об ошибках CORS — «Access to fetch at … has been blocked by CORS policy: …» — рядом с выводом страницы.',
  'panel.console.info.showCorsErrors.description':
    'Если выключено, скрываются только эти пояснения; сам заблокированный запрос по-прежнему виден в панели Network.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Захват остановлен — эта вкладка вышла из области режима отладки. Показан последний захваченный вывод.',
  'panel.console.banner.debugOff': 'Захват остановлен — режим отладки выключен. Показан последний захваченный вывод.',
  'panel.console.enableDebug': 'Включить режим отладки',
  'panel.console.empty.noCdp.title': 'Для захвата консоли нужен режим отладки',
  'panel.console.empty.noCdp.sub': 'Инспекция в режиме отладки в этом браузере недоступна.',
  'panel.console.empty.capturing.title': 'Вывода консоли пока нет',
  'panel.console.empty.capturing.sub':
    'Сообщения журнала и необработанные исключения этой вкладки будут появляться здесь по мере возникновения.',
  'panel.console.empty.debugOff.title': 'Включите режим отладки, чтобы видеть журнал консоли',
  'panel.console.empty.debugOff.sub':
    'Open Headers захватывает вывод консоли и необработанные исключения этой вкладки, пока включён режим отладки.',
  'panel.console.empty.outOfScope.title': 'Эта вкладка вне области режима отладки',
  'panel.console.empty.outOfScope.sub':
    'Включите её в область из режима отладки — измените область или закрепите эту вкладку, — чтобы захватывать её вывод консоли.',
  'panel.console.noMatch': 'Ни одна запись консоли не подходит под ваш фильтр.',
  'panel.console.revealedHidden': 'Показанное сообщение скрыто активным фильтром',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} одинаковое сообщение',
      few: '{count} одинаковых сообщения',
      many: '{count} одинаковых сообщений',
      other: '{count} одинаковых сообщений',
    }),
  'panel.console.expandStack': 'Развернуть трассировку стека',
  'panel.console.collapseStack': 'Свернуть трассировку стека',

  // REPL prompt
  'panel.console.prompt.waiting': 'Ожидание контекста JavaScript…',
  'panel.console.prompt.placeholder': 'Выполнить JavaScript в выбранном контексте',
  'panel.console.prompt.aria': 'Строка ввода консоли',
  'panel.console.prompt.previewAria': 'Предпросмотр упреждающего вычисления',
} as const satisfies Catalog;
