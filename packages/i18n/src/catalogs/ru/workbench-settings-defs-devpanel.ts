/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — Russian. Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, `A → Z`, header names, and every wire token. Option
 * labels quote the shipped ru panel menus verbatim (Сначала сбои /
 * Сначала самые медленные / Сначала самые большие / Приоритет браузера
 * / По типу ресурса / По домену / Сначала изменённые правилами / По
 * возрастанию / По убыванию / Компактная / Широкая / Группами /
 * Плоская / Исходный порядок / Как есть (raw) / Относительно /
 * Абсолютно / Относительный / Отметка времени / Всегда / При наведении
 * / Местный / Показывать теги / Показывать рекомендации / Показывать
 * точки срабатывания правил / Своя (вложенная) / Активный инструмент /
 * Только инструмент Network / Компактный / Широкий / Авто + the timing
 * view rows); the layout twins quote `panel.ts` (По ширине / Рядом /
 * Друг над другом / Показывать имена окон инструментов /
 * Пропорционально / Компактно / Стопкой / Динамически). MINTS: строка
 * состояния = the panel status bar (footer); верхняя панель = top bar;
 * охват = the footer summary scope (beside область = variable scope,
 * область действия = debug reach, покрытие = rule-match — S19);
 * Совокупно = aggregate; Только текущая страница = current page only;
 * чип значения = the Waterfall value chip (carried from
 * panel-network); столбец точек = the fire-dot column.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Показывать версию',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Показывать номер версии расширения в строке состояния панели DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'Показывать переключатель темы',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Показывать выпадающий список темы (светлая / тёмная / авто) в строке состояния панели DevTools.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': 'Показывать число изменённых',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Показывать в строке состояния панели DevTools, сколько запросов ваши правила действительно изменили.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': 'Показывать число неудачных',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Показывать в строке состояния панели DevTools, сколько запросов завершились сбоем или вернули статус ошибки.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Показывать число из кеша',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Показывать в строке состояния панели DevTools, сколько запросов обслужено из кеша.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Показывать текущую страницу',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Подписывать ключевые моменты таймингов страницей, которую они описывают, в строке состояния панели DevTools — полезно вместе с «Сохранять журнал» при нескольких переходах.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Охват таймингов',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Какой переход описывают ключевые моменты Finish / DOMContentLoaded / Load в строке состояния панели DevTools. Совокупно охватывает всю хронологию сохранённого журнала с первого перехода (как в браузере); Только текущая страница сообщает только о последнем переходе.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Совокупно (все переходы)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load охватывают всю хронологию с первого перехода — как в браузере по умолчанию.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Только текущая страница',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load сообщают только о последнем переходе, отсчитывая от его начала.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Охват сводки',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'Что суммирует строка состояния панели DevTools. Активный инструмент следует за окном инструментов, в котором вы работаете (у Storage, Console и Поиска собственные строки сводки); Только инструмент Network всегда показывает показатели Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Активный инструмент',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'Футер следует за активным окном инструментов — Storage, Console и Поиск показывают собственные сводки; остальные инструменты возвращаются к строке Network.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Только инструмент Network',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'Футер всегда показывает показатели Network, какое бы окно инструментов ни было в фокусе.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': 'Показывать переключатели панелей',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Показывать значки переключения левой / нижней / правой панели в верхней панели панели DevTools.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'Показывать меню компоновки',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Показывать выпадающее меню компоновки (нижняя панель на всю ширину, подписи окон инструментов, компоновка боковой панели) в верхней панели панели DevTools.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Выравнивание нижней панели',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Где нижняя панель располагается в панели DevTools. Слева / справа выравнивает её под одной боковой панелью и редактором; по центру вкладывает в среднюю колонку; по ширине растягивает на всю ширину.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'По центру',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Нижняя панель вложена в среднюю колонку',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Слева',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'Нижняя панель под левой боковой панелью и редактором',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Справа',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'Нижняя панель под редактором и правой боковой панелью',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'По ширине',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Нижняя панель на всю ширину панели DevTools',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': 'Разделение нижней панели',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    'Как два открытых нижних дока делят нижнюю панель: рядом друг с другом или один над другим.',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': 'Рядом',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description':
    'Нижние доки располагаются рядом друг с другом',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': 'Друг над другом',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description':
    'Нижние доки располагаются один над другим',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'Показывать имена окон инструментов',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Показывать текстовые подписи рядом со значками панели действий и вкладок доков в панели DevTools. По умолчанию выключено, потому что панель уже рабочего пространства.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Ширина левой панели действий',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Ширина левой панели действий в панели DevTools, когда подписи окон инструментов видны. В режиме одних значков фиксирована на 36px.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Ширина правой панели действий',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Ширина правой панели действий в панели DevTools, когда подписи окон инструментов видны. В режиме одних значков фиксирована на 36px.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Компоновка панели действий',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'Как панель действий делит верхнюю и нижнюю группы окон инструментов в панели DevTools.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Пропорционально',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Верхняя и нижняя группы делят панель действий поровну',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Компактно',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Верхняя группа по содержимому; нижняя прижата к низу',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Стопкой',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'Все группы собраны сверху с разделителями между ними',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Динамически',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Группы чипов повторяют высоту соседних панелей. Закрытые доки сжимаются по содержимому, а живые соседи занимают освободившееся место.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Компоновка',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Как таблица Network распределяет горизонтальное пространство. Компактная позволяет растяжимым столбцам (Name, Waterfall) подстраиваться под ширину панели, так что таблица никогда не прокручивается по горизонтали; Широкая ограничивает эти столбцы и прокручивает остальное по горизонтали.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Компактная',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description':
    'Растяжимые столбцы занимают ширину панели.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Широкая',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Ограниченные ширины, горизонтальная прокрутка при необходимости.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Компоновка сообщений',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Как сетка фреймов Messages распределяет горизонтальное пространство. Компактная позволяет столбцу Data подстраиваться под ширину панели, так что сетка никогда не прокручивается по горизонтали; Широкая ограничивает его и прокручивает по горизонтали при необходимости.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Компактная',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'Столбец Data занимает ширину панели.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Широкая',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Ограниченные ширины, горизонтальная прокрутка при необходимости.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Показывать предпросмотр полезной нагрузки',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Показывать панель предпросмотра полезной нагрузки под сетками Messages / EventStream — изменяемое разделение, где выбранный фрейм или событие отображается как JSON-дерево, исходный текст или двоичный просмотрщик. Выключите, чтобы отдать сетке всю панель.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Источник сортировки',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Какая сторона состояния сортировки активна. `mode` запускает один из именованных составных режимов сортировки (Сначала сбои / Сначала самые медленные / …). `column` запускает сортировку по одному столбцу, который пользователь выбрал щелчком по заголовку. Панель переключает это автоматически — щелчок по заголовку столбца задаёт `column`; выбор режима в меню «Вид» задаёт `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Режим',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description':
    'Использовать именованный составной режим сортировки.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Столбец',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Использовать сортировку по одному столбцу, который выбрал пользователь.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Своя (вложенная)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Использовать цепочку сортировки по нескольким ключам, собранную пользователем.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Режим сортировки',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Именованный составной порядок сортировки — основная ось, затем порядок поступления как последний критерий. Активен, когда источник сортировки = `mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Сначала сбои',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Сбой → в ожидании → перенаправлен → успех.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Сначала самые медленные',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Сначала самая большая длительность.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Сначала самые большие',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': 'Сначала больше всего байт по сети.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Приоритет браузера',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Сообщённый приоритет от Highest к Lowest.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'По типу ресурса',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Группировка по типу ресурса, внутри — по поступлению.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'По домену',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    'Группировка по имени хоста, внутри — по поступлению.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Сначала изменённые правилами',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Сначала с применёнными правилами, внутри — по поступлению.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Сортировать по',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Какой столбец задаёт сортировку по щелчку. Активно, когда источник сортировки = `column`. Щелчок по заголовку столбца обновляет это значение.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Хронология по активной метрике Waterfall (по умолчанию — время начала).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Номер запроса — порядок, в котором запросы были обнаружены.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP-метод.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Последний сегмент URL-адреса.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Путь + строка запроса.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'Полный URL-адрес.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Код статуса ответа.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'Версия HTTP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Хостовая часть URL-адреса.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'IP-адрес сервера.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Тип ресурса.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'Что вызвало запрос.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Число cookie в запросе.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'Число Set-Cookie в ответе.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Байты по сети.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Общая длительность запроса.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Приоритет, назначенный браузером.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Направление сортировки',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'По возрастанию или по убыванию для текущего столбца сортировки Network.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'По возрастанию',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Сначала наименьшие.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'По убыванию',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Сначала наибольшие.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Метрика',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'По какому времени столбец Waterfall сортирует и рисует. Start / Response / End time размещают полосы на абсолютной хронологии; Total duration и Latency выравнивают полосы по нулю, чтобы длины сравнивались напрямую.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'Когда запрос начался.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'Когда пришёл первый байт ответа.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'Когда запрос завершился.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'Сколько запрос занял от начала до конца.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description': 'Время до первого байта ответа.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Показывать точки срабатывания правил',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Показывать ведущий столбец шириной 14px с цветной точкой, отмечающей совпадения правил (закрашенная = правило действительно применено, пустая = выведено). Выключите, чтобы вернуть горизонтальные пиксели в плотных панелях.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Значения',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'Когда печатать значения активной метрики Waterfall на полосе — чип Start / Response / End time для хронологических метрик или подписи ожидания / загрузки для Total duration и Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Всегда',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': 'Чип значения виден всегда.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'При наведении',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Показывать чип значения при наведении на строку.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Выключено',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Скрыть чип значения.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Формат значения',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'Как читается значение хронологической метрики: Относительный — смещение от первого запроса в поле зрения; Отметка времени — абсолютный момент по часам. Total duration и Latency в любом случае остаются длительностями.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Относительный',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Смещение от первого запроса в поле зрения.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Отметка времени',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Абсолютный момент по часам.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Часовой пояс отметки времени',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Часовой пояс для формата «Отметка времени» — местное время или UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Местный',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Ваш местный часовой пояс.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description':
    'Всемирное координированное время.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Пояснять значение',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'В поповере при наведении на Waterfall помечать и подсвечивать строки этапов, из которых складывается итог, и показывать их сумму формулой. Чисто визуальная подсказка — значения не меняются.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Компоновка поповера',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Ориентация разбивки таймингов при наведении на Waterfall. Компактный складывает шаги вниз по поповеру; Широкий раскладывает ту же лесенку на оси времени; Авто выбирает по ширине панели — широкий на панели, пристыкованной снизу, компактный на узкой (пристыкованной сбоку).',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Компактный',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Шаги сложены вниз по поповеру.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Широкий',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Шаги разложены на горизонтальной оси времени.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Авто',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Широкий, когда панель широкая, иначе компактный.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Компоновка',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'Как строки заголовков организованы внутри разделов Request / Response. Группами раскладывает строки по категориям (авторизация, CORS, кеширование, …); Плоская показывает один список в выбранном порядке сортировки.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Группами',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Строки разложены по категориям.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Плоская',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Один список без заголовков категорий (как в Chrome).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Сортировка',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Порядок строк внутри каждого списка (и внутри каждой группы при группировке). Исходный порядок сохраняет порядок, в котором сервер отправил заголовки (порядок HAR); A → Z сортирует по имени; Сначала изменённые правилами поднимает изменённые правилами строки наверх.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Исходный порядок',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'Порядок HAR.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'По алфавиту.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Сначала изменённые правилами',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description':
    'Изменённые правилами строки сверху.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Регистр имён заголовков',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'Как отображаются имена заголовков. Train-Case приводит каждое имя к каноническому виду (`Content-Type`, `Set-Cookie`, `ETag`), как в DevTools браузеров Chrome и Firefox — легче просматривать. Как есть сохраняет регистр, который отправил сервер (HTTP/2 и новее переводит всё в нижний регистр по сети).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Как есть (raw)',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Ровно то, что отправил сервер (в HTTP/2 и новее часто нижний регистр).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Показывать теги значений',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Показывать теги для отдельных значений в строках заголовков (Cache-Control / Set-Cookie / HSTS / декодирование JWT, …). Выключите для плотного вида из одних значений.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Показывать рекомендации',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Показывать карточки предупреждений с действиями вверху вкладки Headers (ошибки настройки CORS, отсутствующие CSP/HSTS, небезопасные cookie, истёкший JWT, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Скрывать шумовые заголовки',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Сворачивать малоинформативные заголовки (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). Подсказка под каждым разделом перечисляет скрытые имена при наведении.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Только изменённые правилами',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Показывать только заголовки, добавленные, изменённые или удалённые правилом Open Headers.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Только заголовки безопасности',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Показывать только заголовки, связанные с безопасностью (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Только переопределяемые',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Скрывать защищённые заголовки, которые браузер не даёт переопределить правилами (host, content-length, sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Сортировка потомков',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'Как упорядочены дочерние запросы внутри цепочки инициаторов. Порядок инициаторов сохраняет исходный обход графа инициаторов; Хронологический упорядочивает по времени запроса; Самое большое поддерево ставит самое тяжёлое поддерево первым.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Порядок инициаторов',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'В порядке обнаружения.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Хронологический',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'По времени запроса.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Самое большое поддерево',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Сначала самые тяжёлые поддеревья.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Показывать рекомендации',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Показывать выноски с действиями вверху вкладки Initiator (неудачные подзапросы, доминирующий хост, доля сторонних, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Только сбои',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Показывать только неудачные или заблокированные строки в цепочке инициаторов.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'Только сторонние',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Показывать только строки из источников, отличных от источника страницы.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Сортировка',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Порядок строк внутри каждого раздела cookie. Исходный порядок сохраняет порядок сервера / запроса; A → Z сортирует по имени; Размер сортирует по размеру сериализованного cookie; Expires сортирует по ближайшему истечению (сеансовые в конце).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Исходный порядок',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'Как отправлено / установлено.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'По алфавиту по имени.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Размер',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Сначала самые большие cookie.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Сначала ближайшее истечение.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Формат Expires',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Как отображается срок действия cookie. Относительно показывает «через 2 д», «30 с назад», «Сеанс»; Абсолютно показывает разобранную дату в UTC.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Относительно',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Абсолютно',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'Дата в UTC.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Показывать теги',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Показывать теги роли / жизненного цикла / контекста рядом с именем каждого cookie (auth? / tracking? / pref / только что установлен / отброшен / сторонний / разделённый / …). Выключите для плотного вида из одних столбцов.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Показывать рекомендации',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Показывать карточки предупреждений с действиями вверху вкладки Cookies (SameSite=None без Secure, нарушения префиксов __Host- / __Secure-, слишком большие cookie, истёкшие, но отправленные, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Декодировать значения в URL-кодировке',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Показывать значения cookie с декодированным процентным кодированием («Europe%2FMadrid» → «Europe/Madrid»). Наведите на значение, чтобы увидеть исходную форму.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Группировать по роли',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Группировать cookie по выведенной роли внутри каждого раздела — сначала авторизация и сеанс, затем функциональные, предпочтения, аналитика и отслеживание. Основано на эвристике; чипы ролей (auth? / tracking? / pref) несут вопросительный знак как напоминание.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Показывать отфильтрованные cookie запроса',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Повторяет переключатель Chrome «show filtered out request cookies» — также перечислять cookie из хранилища, которые не были отправлены с этим запросом из-за несовпадения пути / Secure / SameSite / срока действия.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Только с проблемами',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Показывать только cookie, вызвавшие предупреждение — отсутствует Secure, нарушение префикса, истёк, но отправлен, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'Только сторонние',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Показывать только cookie, домен которых является межсайтовым по отношению к источнику верхнего фрейма.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Только изменённые правилами',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Показывать только cookie, строка Cookie / Set-Cookie которых была добавлена, изменена или удалена правилом.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Показывать рекомендации',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Показывать карточки об узком месте и предупреждения по этапам вверху вкладки Timing. Выключите для вида из одних чисел.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Показывать полосу контекста',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Показывать строку чипов протокол / соединение / кеш / приоритет / начало / IP-адрес сервера над разбивкой по этапам.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Показывать разбивку по этапам',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Показывать разделы Resource Scheduling / Connection Start / Request-Response со строками миллисекунд по каждому этапу.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Показывать полосу таймингов',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Показывать пропорциональную сегментированную полосу с легендой по этапам (и строкой Total под ней).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Показывать Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Показывать разобранные метрики заголовка ответа `Server-Timing`, когда сервер их отправил.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Показывать повторы в сеансе',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Показывать сравнение с самым быстрым / медианным / самым медленным попаданием по тому же URL-адресу в текущем сеансе панели.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Показывать скорость передачи',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Показывать эффективную пропускную способность Content-Download (байты тела ÷ время загрузки), когда известны и размер, и этап приёма.',
} as const satisfies Catalog;
