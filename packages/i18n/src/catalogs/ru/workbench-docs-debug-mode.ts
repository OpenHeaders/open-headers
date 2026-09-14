/**
 * Workbench Docs panel — the Debug Mode section body — Russian. Mirrors
 * `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI labels the
 * prose references copy the shipped `ru/shared-chrome.ts` strings
 * verbatim (Подключать к, Где открыто окно DevTools, Вкладка в фокусе,
 * Обе, Включить эту вкладку браузера, Подключённые вкладки, Вкладка
 * вне области действия, Состояние системы, Режим отладки);
 * Переопределения = the Overrides surface (panel mint); подключить =
 * attach (S108); индикатор = pill (the traffic-light pill noun);
 * Включён / Выключен = the On / Off states here (the verb form —
 * режим м. р.); the browser banner quote rides verbatim raw en inside
 * «». MINTS: Режим отладки выключен = the rules-list badge (a later
 * ru editors-rule rider must reuse); стандартный режим = standard
 * mode; перешла на эвристику = fell back to heuristic; из других
 * источников = cross-origin (frames); воркер = worker. Raw by design:
 * the `● Debug mode` pill chip and the `fetch` / `XHR` code chips
 * composed by the section body (the fragment after the `XHR` chip
 * opens with `.` — the render site joins that pair with no space),
 * CSP with a hyphenated apposition (CSP-устойчивым), Chromium /
 * Firefox / Safari with браузер as head noun. The bold term opens its
 * body with the verb (the render site joins
 * `<strong>{term}</strong> {intro1}` with its own space).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'Режим отладки',
  'workbench.docs.body.debugMode.intro1':
    'подключает Open Headers к протоколу отладки браузера, чтобы изучать и менять трафик, до которого ' +
    'обычные API расширений не дотягиваются. Это тот же механизм, которым пользуются собственные инструменты разработчика браузера, — ' +
    'поэтому, пока он включён, браузер показывает баннер',
  'workbench.docs.body.debugMode.introBanner': '«OH started debugging this browser»',
  'workbench.docs.body.debugMode.intro1Suffix': '.',
  'workbench.docs.body.debugMode.intro2':
    'Стандартный режим (режим отладки выключен) уже покрывает большинство правил — заголовки, блокировку, перенаправление, параметры запроса и ' +
    'правила тела / ответа / внедрения в контексте страницы. Режим отладки — включаемое вручную расширение для того, до чего они ' +
    'не дотягиваются: навигаций, воркеров, фреймов из других источников и изменений окружения на всю вкладку.',
  'workbench.docs.body.debugMode.controlHeading': 'Где им управлять',
  'workbench.docs.body.debugMode.control1Prefix': 'Индикатор',
  'workbench.docs.body.debugMode.control1Middle': 'находится в футере каждой поверхности, слева от индикатора',
  'workbench.docs.body.debugMode.systemStatusLink': 'Состояние системы',
  'workbench.docs.body.debugMode.control1Suffix':
    '. Встроенный переключатель включает и выключает его, цветная точка отслеживает его здоровье, а точка с подписью открывают ' +
    'поповер со всем остальным — областью действия, закреплениями по вкладкам и списком подключённых сейчас вкладок.',
  'workbench.docs.body.debugMode.surfaceCaption':
    'Встроенный переключатель включает его; точка с подписью открывают поповер для всего остального.',
  'workbench.docs.body.debugMode.scopeHeading': 'Выбор того, что изучать',
  'workbench.docs.body.debugMode.scope1Prefix': 'Выпадающий список',
  'workbench.docs.body.debugMode.attachTo': 'Подключать к',
  'workbench.docs.body.debugMode.scope1Middle': 'решает, к каким вкладкам подключается режим отладки —',
  'workbench.docs.body.debugMode.scopeDevtools': 'Где открыто окно DevTools',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(только вкладки с открытой панелью Open Headers; самый узкий вариант по умолчанию),',
  'workbench.docs.body.debugMode.scopeFocused': 'Вкладка в фокусе',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(следует за активной вкладкой по мере переключения) или',
  'workbench.docs.body.debugMode.scopeBoth': 'Обе',
  'workbench.docs.body.debugMode.scope1BothParen': '(объединение двух).',
  'workbench.docs.body.debugMode.consent1Prefix': 'Выбор области',
  'workbench.docs.body.debugMode.consentIs': 'и есть',
  'workbench.docs.body.debugMode.consent1Middle':
    'согласие на баннер браузера — отдельного запроса нет. Когда текущая вкладка ещё не покрыта ' +
    'областью, появляется закрепление',
  'workbench.docs.body.debugMode.includeTabPin': 'Включить эту вкладку браузера',
  'workbench.docs.body.debugMode.consent1Suffix':
    ', чтобы подключить одну эту вкладку, не расширяя область для всего остального.',
  'workbench.docs.body.debugMode.attached1Prefix': 'Список',
  'workbench.docs.body.debugMode.attachedTabs': 'Подключённые вкладки',
  'workbench.docs.body.debugMode.attached1Suffix':
    'показывает каждую вкладку, которой сейчас управляет режим отладки, с действием перехода к вкладке. Подключённый набор ' +
    'всегда пересчитывается из вашей области, ваших закреплений и того, какие панели открыты, — поэтому он отражает ' +
    'настоящее, а не устаревший снимок.',
  'workbench.docs.body.debugMode.scopeCaption':
    'Подключённый набор выводится каждый раз заново — повторное подключение воспроизводит его, ничего не хранится.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'Баннер — на весь браузер',
  'workbench.docs.body.debugMode.banner1Prefix':
    'Пока режим отладки включён, баннер браузера «OH started debugging this browser» показывается на',
  'workbench.docs.body.debugMode.bannerEvery': 'каждой',
  'workbench.docs.body.debugMode.banner1Suffix':
    'вкладке — не только на подключённых. Это собственное поведение браузера; выключение режима отладки ' +
    'убирает его сразу.',
  'workbench.docs.body.debugMode.unlocksHeading': 'Что он открывает',
  'workbench.docs.body.debugMode.unlocksIntro':
    'На подключённой вкладке правила и элементы управления выходят за пределы контекста страницы:',
  'workbench.docs.body.debugMode.anyRequestLead': 'Любой запрос, любой контекст.',
  'workbench.docs.body.debugMode.anyRequest1':
    'Имитируйте или переписывайте навигации верхнего уровня, запросы воркеров и iframe из других источников — не только',
  'workbench.docs.body.debugMode.anyRequest2':
    '. Тела запросов и ответов в тех же контекстах можно читать и преобразовывать, а на запросы HTTP-аутентификации ' +
    'отвечать автоматически для dev-прокси и staging.',
  'workbench.docs.body.debugMode.injectionLead': 'Более сильное внедрение.',
  'workbench.docs.body.debugMode.injection1':
    'Внедрение скриптов становится свободным от гонок и CSP-устойчивым и достаёт внутрь воркеров и фреймов из других источников, ' +
    'до которых стандартный путь контекста страницы не дотягивается.',
  'workbench.docs.body.debugMode.tabEnvLead': 'Окружение вкладки.',
  'workbench.docs.body.debugMode.tabEnv1':
    'Точное отключение кеша, троттлинг сети / офлайн и переопределения user-agent / языка / часового пояса / медиа ' +
    '— задаются для каждой вкладки из панели инструментов панели и поверхности',
  'workbench.docs.body.debugMode.overrides': 'Переопределения',
  'workbench.docs.body.debugMode.tabEnv2': 'этой панели.',
  'workbench.docs.body.debugMode.reachCaption':
    'Стандартный режим покрывает fetch / XHR страницы; подключённая вкладка распространяет те же правила на всё остальное.',
  'workbench.docs.body.debugMode.silentHeading': 'Правила никогда не отказывают молча',
  'workbench.docs.body.debugMode.silent1Prefix':
    'Правило, которому для полного эффекта нужен режим отладки, показывает значок',
  'workbench.docs.body.debugMode.badgeOff': 'Режим отладки выключен',
  'workbench.docs.body.debugMode.silent1Middle': 'в списке правил, пока режим выключен, и пометку',
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Вкладка вне области действия',
  'workbench.docs.body.debugMode.silent1Middle2':
    'в панели, когда он включён, но вкладка не в области. Правило по-прежнему выполняет всё, что',
  'workbench.docs.body.debugMode.silentCan': 'может',
  'workbench.docs.body.debugMode.silent1Suffix':
    ', через стандартный путь контекста страницы — включение режима отладки лишь распространяет то же правило на контексты, ' +
    'до которых внедрение в страницу не дотягивается.',
  'workbench.docs.body.debugMode.colorsHeading': 'Цвета состояния',
  'workbench.docs.body.debugMode.colors1Prefix': 'Точка повторяет строку',
  'workbench.docs.body.debugMode.colors1Suffix': 'в состоянии системы:',
  'workbench.docs.body.debugMode.statesCaption': 'Серая, когда выключен; зелёная / жёлтая / красная, когда включён.',
  'workbench.docs.body.debugMode.stateGreenLabel': 'зелёная',
  'workbench.docs.body.debugMode.stateOn': 'Включён',
  'workbench.docs.body.debugMode.stateOnRest': 'и подключён без ошибок. (Когда выключен, точка просто серая.)',
  'workbench.docs.body.debugMode.stateYellowLabel': 'жёлтая',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'Вкладка',
  'workbench.docs.body.debugMode.stateYellowTerm': 'перешла на эвристику',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '— обычно потому, что баннер отладки браузера был закрыт, и эта вкладка возвращается к стандартному наблюдению.',
  'workbench.docs.body.debugMode.stateRedLabel': 'красная',
  'workbench.docs.body.debugMode.stateRedPrefix': 'Вкладку',
  'workbench.docs.body.debugMode.stateRedTerm': 'не удалось подключить',
  'workbench.docs.body.debugMode.stateRedSuffix': '— протокол отладки для неё не удалось задействовать.',
  'workbench.docs.body.debugMode.chromiumTitle': 'Только Chromium',
  'workbench.docs.body.debugMode.chromium1':
    'Режим отладки опирается на протокол отладки, который расширениям открывают только браузеры на базе Chromium. В ' +
    'браузерах Firefox и Safari индикатор остаётся скрытым; правила стандартного режима выше работают везде.',
} as const satisfies Catalog;
