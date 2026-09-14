/**
 * Workbench Docs panel — SVG diagram labels — Russian. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key; register per
 * the `ru/shared.ts` header. Vocabulary is QUOTED from the shipped ru
 * files, never re-minted: the sidebar entries (Правила / Запросы /
 * Окружения / Коллекции / Рабочие процессы / Шаблоны / Vault /
 * Переменные рабочего пространства / Переменные Live / Браузерный
 * перехватчик / API-запросы), every condition name in its rule-editor
 * form (Домены запроса / Исключить домены / Домены инициатора / Методы
 * / Типы ресурсов / Тип домена / Заголовок ответа — the docs section
 * Заголовки ответа / URL-шаблон / URL-регулярное выражение), the
 * header ops (Добавить / Заменить, Добавить в конец, Удалить,
 * Объединить, Только заменить, Удалить все; Переопределить = the
 * Override op noun), the rule types (Блокировка / Перенаправление /
 * Внедрение / Задержка / Параметры запроса / Тело запроса / Тело
 * ответа — the docs nav), the action categories (Изменение запроса /
 * Изменение ответа / Выполнение кода — the docs nav groups), the inject
 * timings (Как можно раньше / После загрузки страницы), the popup tab
 * («Эта страница»), the six subsystem pills (Синхронизация / Правила /
 * Запросы / Разрешения / Секреты / Live), the debug-mode labels (Режим
 * отладки / Состояние системы / Подключать к / Обе / Включить эту
 * вкладку браузера / Подключённые вкладки / стандартный режим /
 * перешла на эвристику), the docs nouns (ссылка без префикса / обход /
 * лестница / перекрыта / область действия / Статический / динамический
 * / прямое / косвенное / страница ожидания / полоса / фикстура /
 * монки-патч / индикатор = pill / подсистема / сводный / предел /
 * пробуждение / гидратация / расхождение = drift / шифротекст /
 * исполнитель / периодичность / свежий / устаревший / сбоящий /
 * срабатывание = fire), the keyboard regions (левая боковая панель /
 * редактор / правая боковая панель / нижняя панель). Kickers translate
 * under caps (ПРАВИЛО / ДО / ПОСЛЕ / КОГДА НЕ СРАБАТЫВАЕТ / Совет /
 * ЧАСТЫЕ СЛУЧАИ / НА ЧТО СМОТРЕТЬ). MINTS: обходной путь = detour
 * beside встроенно = inline; схождение = convergence; пустая операция
 * = no-op carried; блоб carried; с перебоями = faltering. Rule banners
 * mimic the ru rule row (Блокировка · Домены запроса:
 * ads.openheaders.com); Chrome ResourceType names, DNR / Script / Popup
 * / Workbench / DevTools as plane names, HTTP reason phrases and every
 * wire mirror ride raw; the system-status popover rows and audit
 * messages translate as diagram illustrations while the real wire
 * string in `footerPaused` copies the ru docs body (raw). Sandwich
 * fragments open with a head noun after a raw chip and keep their en
 * edge spaces (render sites checked: `conditions/*.tsx`,
 * `multi-tab/navigation.tsx`, `system-status/vault.tsx`,
 * `open-headers/paradigm-field-sync.tsx`, `paradigm-local-first.tsx`).
 * Width: the helper counts Cyrillic 1.0 — labels take the shortest
 * correct form (fr / de precedents: `popup` raw in the 56px glyph,
 * Окр. beside the fr Env).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: resolution ladder ────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    'Ссылка на переменную без префикса разрешается через vault, окружение, коллекцию, затем рабочее пространство — побеждает первое попадание. ' +
    'Live, шаг, файл и динамические области доступны только по префиксу пространства имён.',
  'workbench.docs.diagrams.variables.ladder.title':
    'Ссылка без префикса — побеждает первая область, где она определена',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'секреты · только это устройство',
  'workbench.docs.diagrams.variables.ladder.environment': 'Окружение',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'активное, затем по умолчанию',
  'workbench.docs.diagrams.variables.ladder.collection': 'Коллекция',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'только активная коллекция',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Рабочее пространство',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'общее для всех',
  'workbench.docs.diagrams.variables.ladder.miss': 'промах',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'ТОЛЬКО ПРОСТРАНСТВО ИМЁН',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'доступны только по префиксу —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'никогда не входят в обход',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — префикс закрепляет одну область.',

  // ── Variables: creation map ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Карта боковой панели — переменные коллекции живут в коллекции, окружения под «Окружениями», а Vault, ' +
    '«Переменные рабочего пространства» и «Переменные Live» — записи верхнего уровня боковой панели',
  'workbench.docs.diagrams.variables.creation.title': 'Где создаётся каждая область',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'КОМАНДА ПЛАТЕЖЕЙ',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Коллекции',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments API',
  'workbench.docs.diagrams.variables.creation.variables': 'Переменные',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Окружения',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'Переменные рабочего пространства',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Переменные Live',
  'workbench.docs.diagrams.variables.creation.footer1': 'У коллекций своя страница «Переменные»;',
  'workbench.docs.diagrams.variables.creation.footer2': 'всё остальное — записи боковой панели.',

  // ── Variables: shadowing ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host определена и в окружении, и в рабочем пространстве — ссылка без префикса разрешается в значение окружения; ' +
    'форма с пространством имён по-прежнему читает значение рабочего пространства',
  'workbench.docs.diagrams.variables.shadowing.title': 'Одно имя в двух областях — побеждает верхняя',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ побеждает',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'перекрыта',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Окружение · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Рабочее пространство',
  'workbench.docs.diagrams.variables.shadowing.footer': 'Префикс пропускает лестницу и читает одну область напрямую.',

  // ── Variables: live lifecycle ───────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Рабочий процесс Live выполняет шаги, публикует раскрытый захват как переменную Live, а правила и запросы ' +
    'её потребляют; автообновление перезапускает рабочий процесс',
  'workbench.docs.diagrams.variables.live.title': 'Успешный запуск публикует значение',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Рабочий процесс Live',
  'workbench.docs.diagrams.variables.live.step1': 'Шаг 1 · вход',
  'workbench.docs.diagrams.variables.live.step2': 'Шаг 2 · получить токен',
  'workbench.docs.diagrams.variables.live.expose': 'раскрыть: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': 'запуск успешен',
  'workbench.docs.diagrams.variables.live.publishes': 'публикует',
  'workbench.docs.diagrams.variables.live.rules': 'Правила',
  'workbench.docs.diagrams.variables.live.requests': 'Запросы',
  'workbench.docs.diagrams.variables.live.autoRefresh': 'автообновление перезапускает',
  'workbench.docs.diagrams.variables.live.footer1':
    'Сохранение активирует рабочий процесс — значение появляется только после',
  'workbench.docs.diagrams.variables.live.footer2': 'успешного запуска и обновляется по расписанию рабочего процесса.',

  // ── Variables: consumers ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'Одно шаблонное значение — Authorization: Bearer token — потребляют правила, запросы и рабочие процессы',
  'workbench.docs.diagrams.variables.consumers.title': 'Определите один раз, ссылайтесь везде',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Правила',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'заголовки, перенаправление,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'тела, внедрение',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'когда правило применяется',
  'workbench.docs.diagrams.variables.consumers.requests': 'Запросы',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, параметры,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'заголовки, авторизация, тело',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': 'при отправке',
  'workbench.docs.diagrams.variables.consumers.workflows': 'Рабочие процессы',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'каждый шаг,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'цепочка захватов',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'на каждый запуск',
  'workbench.docs.diagrams.variables.consumers.footer1':
    'Значения подставляются в момент использования — измените переменную один раз,',
  'workbench.docs.diagrams.variables.consumers.footer2': 'и каждое правило, запрос и рабочий процесс подхватят её.',

  // ── Variables: per-scope references ─────────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'Не так:',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: ссылайтесь на секреты из синхронизируемых сущностей через шаблоны vault; никогда не вставляйте сырые ключи в правила или ' +
    'переменные рабочего пространства',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — секреты, которые никогда не покидают это устройство',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'разрешается локально',
  'workbench.docs.diagrams.variables.refs.vault.good1Note':
    'синхронизируемое правило — у каждого коллеги подставляется свой ключ',
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'запись TOTP — разрешается в текущий код, никогда в seed',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'записи vault не попадают в синхронизацию, экспорт и git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… в правиле',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason':
    'вставленный открытый текст синхронизируется на всё рабочее пространство',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'api_key как переменная рабочего пространства',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason':
    'тоже синхронизируется — vault единственная локальная область',
  'workbench.docs.diagrams.variables.refs.vault.footer1': 'Vault выше любой области — {{api_key}} без префикса',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'всегда берёт значение vault, если оно есть.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Окружение: одно имя переменной разрешается в своё значение на каждой стадии; переключайте окружения вместо ' +
    'дублирования правил, а секреты держите в vault',
  'workbench.docs.diagrams.variables.refs.environment.title': 'Окружение — одно имя, значение на каждую стадию',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Окружения · staging (активное)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'побеждает активное окружение',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'пока активно staging',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': 'переключите окружение — те же правила, ноль правок',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote':
    'при промахе сначала берётся окружение по умолчанию',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'ключ sk-live, вписанный в production',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason':
    'окружения синхронизируются — секретам место в Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'копия каждого правила для staging',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    'не дублируйте правила по стадиям — переключайте окружение',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    'Одно значение на всех стадиях? Используйте Рабочее пространство.',
  'workbench.docs.diagrams.variables.refs.environment.footer2': 'Секрет на пользователя? Vault выше любого окружения.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Коллекция: переменные разрешаются только для правил и запросов внутри своей коллекции; значения для всего рабочего пространства ' +
    'переносите в область рабочего пространства',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Коллекция — область одного API',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments API · Переменные',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'разрешается внутри Payments API',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'запрос в коллекции Payments API',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'правило в коллекции Payments API',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': 'Не разрешается:',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': '{{base_url}} в Billing API',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'другая коллекция — определите её там',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} в правиле вне коллекции',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason': 'нет коллекции → ссылка проходит мимо этой области',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    'Нужна каждой коллекции? Перенесите в Рабочее пространство.',
  'workbench.docs.diagrams.variables.refs.collection.footer2': 'Одноимённая переменная окружения выше неё.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'Рабочее пространство: его переменные разрешаются везде и стоят ниже всех; секреты держите в vault, а значения по стадиям — ' +
    'в окружениях',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Рабочее пространство — общий базовый слой',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'Переменные рабочего пространства',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'разрешается везде',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': 'правило заголовка — любая коллекция, любое окружение',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'URL-адрес запроса',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note':
    'закреплено — даже когда верхняя область перекрывает имя',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason': 'синхронизируется всем — секреты держите в Vault',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': 'меняется по стадиям — определите в каждом окружении',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    'Секрет? Используйте Vault. Разное по стадиям? Используйте Окружение.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2': 'Рабочее пространство — для значений, верных везде.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live: ссылайтесь на значения, опубликованные рабочим процессом, через префикс live; ссылка без префикса никогда не разрешается в Live, а ' +
    'вставленные вручную токены устаревают',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — производится запуском рабочего процесса',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Переменные Live · рабочий процесс входа OAuth',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'опубликовано последним запуском',
  'workbench.docs.diagrams.variables.refs.live.good1Note': 'правило заголовка, которое никогда не устаревает',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} в запросах и рабочих процессах',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'всегда последнее опубликованное значение',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — без префикса',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason': 'live никогда не входит в обход — пишите {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': 'вставленный токен в переменной окружения',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'истекает молча — подкрепите его рабочим процессом',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'Изменили рабочий процесс? Значение показано как устаревшее —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'заново опубликует его только следующий успешный запуск.',

  // ── Multi-tab: side-by-side sync overview ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    'Две вкладки рабочего пространства открыты рядом — разные рабочие пространства или разные раскладки, работа параллельно',
  'workbench.docs.diagrams.multiTab.sync.title': 'Две вкладки, два контекста — одновременно',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Правила',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Запросы',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Окр.',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': 'Заголовок Auth',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'Обход CORS',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Блок рекламы',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Редактор правил',
  'workbench.docs.diagrams.multiTab.sync.envEditor': 'Редактор окружений',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Правила + коллекции синхронизируются через хранилище.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Каждая вкладка хранит своё рабочее пространство + раскладку.',

  // ── Multi-tab: ordinal numbering timeline ───────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    'Хронология нумерации вкладок — номера стабильны на протяжении жизни вкладки; закрытие #1 не перенумеровывает, ' +
    'следующая вкладка получает #4',
  'workbench.docs.diagrams.multiTab.numbering.title': 'Номера стабильны на протяжении жизни вкладки',
  'workbench.docs.diagrams.multiTab.numbering.step1': 'открыта 1 вкладка',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'без префикса',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'открыть ещё одну',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'появляются префиксы',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'открыть третью',
  'workbench.docs.diagrams.multiTab.numbering.step4': 'закрыть #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 без изменений',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'открыть ещё одну',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'следующая — #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    'Нумерация сбрасывается на #1, только когда закрыты все вкладки рабочего пространства.',

  // ── Multi-tab: navigation reuse ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'Повторное использование при навигации — сначала то же окно. Сверху: в том же окне есть вкладка рабочего пространства, клик активирует её. Снизу: ' +
    'вкладка рабочего пространства есть только в другом окне — новая открывается в окне, откуда пришёл вызов.',
  'workbench.docs.diagrams.multiTab.navigation.title': 'Нажмите «изменить правило» во всплывающем окне —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle': 'оно ищет вкладку рабочего пространства сначала в ВАШЕМ окне',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'То же окно',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '— уже есть вкладка рабочего пространства',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Окно 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Окно 1 (вызывающее)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Окно 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'изменить правило ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': 'существующая вкладка активируется · без новой',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Другое окно',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '— в вашем окне нет',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ новая вкладка',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'не тронуто · фокус не крадётся',
  'workbench.docs.diagrams.multiTab.navigation.footer1':
    'Так же, как окно DevTools браузера Chrome докуется в своём окне —',
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'вы остаётесь в том окне, где уже были.',

  // ── Multi-tab: what syncs (shared pool) ─────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'Что синхронизируется между вкладками — chrome.storage хранит правила, коллекции, папки, окружения, переменные, vault, ' +
    'запросы, шаблоны. Обе вкладки читают и пишут через него.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Синхронизируется между вкладками',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'каждая вкладка читает и пишет один и тот же chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'единый источник истины',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'правила',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'коллекции',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'папки',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'окружения',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'переменные',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'запросы',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'шаблоны',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Вкладка #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Вкладка #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'живые данные',
  'workbench.docs.diagrams.multiTab.synced.footer': 'Сохраните в любой вкладке — другая тут же гидратируется заново.',

  // ── Multi-tab: what stays local ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'Что остаётся в каждой вкладке — положение разделителя раскладки и несохранённые черновики. Две вкладки заметно различаются: деление 25/75 и 65/35, ' +
    'в одной черновик, в другой нет.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Остаётся в каждой вкладке',
  'workbench.docs.diagrams.multiTab.local.subtitle':
    'положение разделителя + несохранённый ввод — приватны там, где вы их сделали',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Вкладка {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'раскладка',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'несохранённый черновик',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● не сохранено',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'нет несохранённых изменений',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Каждая вкладка хранит свой разделитель + черновик.',
  'workbench.docs.diagrams.multiTab.local.footer2':
    'Вкладка, открытая ПОСЛЕ вашего перетаскивания, наследует новую раскладку.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'ПРАВИЛО',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'ДО',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'ПОСЛЕ',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': 'КОГДА НЕ СРАБАТЫВАЕТ',
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Совет',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Четыре операции с заголовками над одним исходным заголовком — Переопределить заменяет, Добавить в конец добавляет дубликат, Удалить ' +
    'удаляет, Объединить склеивает.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Один исходный заголовок → четыре исхода',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Переопределить',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Добавить в конец',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Удалить',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Объединить',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(заголовка нет)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — нативно, применяет Chrome',
  'workbench.docs.diagrams.headerActions.overview.legendScript':
    'Script — пропатченные fetch / XHR (только Объединить)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    'Добавить / Заменить — одно правило покрывает оба случая. Заменяет значение существующего заголовка X-Auth или добавляет заголовок, если ' +
    'его нет. Оба пути приходят к одному исходу.',
  'workbench.docs.diagrams.headerActions.override.rule': 'Переопределить X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Заменить',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Добавить',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'заголовок уже есть',
  'workbench.docs.diagrams.headerActions.override.addSub': 'заголовка X-Auth ещё нет',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(без X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'значение заменено',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'заголовок добавлен',
  'workbench.docs.diagrams.headerActions.override.stamp': 'В любом случае → один заголовок X-Auth с вашим значением',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    'Добавить / Заменить не применяется, когда условия правила не совпадают с запросом — молча ничего не делает. Совет: ' +
    'проверьте условия «Домены запроса» или «URL-шаблон».',
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Запрос к несовпадающему домену',
  'workbench.docs.diagrams.headerActions.override.wontDetail':
    'Условия ограничивают действие — нет совпадения, пустая операция.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    'Проверьте условия «Домены запроса» или «URL-шаблон» правила.',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    'Добавить в конец добавляет вторую строку заголовка с тем же именем — доставляются обе. ДО — одна строка Set-Cookie; ПОСЛЕ — ' +
    'две, новая подсвечена.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Добавить в конец Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 дублирующая строка',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Две строки Set-Cookie — доставлены обе.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Для Set-Cookie, Link, Via — заголовков, допускающих дубликаты.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    'Добавить в конец не применяется чисто к заголовкам без поддержки дубликатов — браузер оставляет только один. Используйте Переопределить, ' +
    'чтобы заменить, или Объединить, чтобы склеить.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': 'Заголовки, не допускающие дубликатов',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    'напр. Authorization, Host, Content-Type — браузер оставляет только один.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1':
    'Используйте «Переопределить», чтобы заменить значение.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2':
    'Используйте «Объединить», чтобы дописать к существующему значению.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    'Удалить убирает целевой заголовок. ДО показывает зачёркнутый X-Frame-Options; ПОСЛЕ — только ' +
    'уцелевший заголовок Content-Type.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Удалить X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'цель удалена',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'Все экземпляры X-Frame-Options удалены.',
  'workbench.docs.diagrams.headerActions.remove.stamp2': 'Дублирующие строки одного заголовка удаляются все сразу.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    'Удалить — пустая операция, когда целевого заголовка нет — ошибка не возникает. Используйте Переопределить, если хотели задать ' +
    'другое значение.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'Заголовка уже нет',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'Пустая операция — без ошибки, запрос просто проходит без изменений.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Используйте «Переопределить», если хотели задать значение, а не удалить его.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'Объединить читает существующее значение заголовка во время выполнения, соединяет ваше значение через разделитель и заменяет исходное.',
  'workbench.docs.diagrams.headerActions.merge.rule': "Объединить Cookie + new=val  (разделитель: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'соединить через разделитель',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': 'Существующее значение + ваше, соединённые разделителем.',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "Разделитель по умолчанию: '; ' для Cookie, ', ' для остальных заголовков.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'Объединить перехватывает только fetch / XHR, инициированные JS — навигации страниц и статические ресурсы проходят без изменений. ' +
    'Для них используйте Переопределить или Добавить в конец (DNR).',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Навигации страниц',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Через движок скриптов проходят только fetch / XHR, инициированные JS.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Статические ресурсы (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': 'Их выпускает браузер — fetch / XHR не затрагиваются.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'Для заголовков уровня страницы используйте «Переопределить» или «Добавить в конец» (DNR).',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Правило:',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Тестовые запросы:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Проверка по URL-адресам:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'ДО',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'ПОСЛЕ',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'литерал — точное совпадение',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Вместо этого используйте условие ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': '.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Домены запроса',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'URL-шаблон',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Домены инициатора',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'Два URL-адреса в одном fetch — URL-адрес в адресной строке это источник (Домены инициатора); URL-адрес назначения fetch это ' +
    'хост (Домены запроса)',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Два URL-адреса, два условия',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'JS этой страницы выполняет:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Один fetch — два разных URL-адреса.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ' — URL-адрес страницы → проверяет условие ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — адрес назначения fetch → проверяет условие ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Каждое условие проверяет один атрибут запроса — цветные индикаторы справа называют тип условия, который ' +
    'проверяет атрибут каждой строки. Все условия объединяются через AND.',
  'workbench.docs.diagrams.conditions.matching.title': 'Каждое условие проверяет один атрибут запроса',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'АТРИБУТ ЗАПРОСА',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'ПРОВЕРЯЕТ',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'метод:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'хост:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'источник:',
  'workbench.docs.diagrams.conditions.matching.attrType': 'тип:',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'сторона:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'заголовок:',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Методы',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'URL-шаблон',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Домены запроса',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Домены инициатора',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Типы ресурсов',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Тип домена',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Заголовки ответа',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'Все должны совпасть (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ правило срабатывает',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'Когда все условия совпали, правило срабатывает — заголовок Authorization заменяется до того, как запрос покинет ' +
    'браузер',
  'workbench.docs.diagrams.conditions.ruleFires.title': 'Условия совпали → правило срабатывает → запрос меняется',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Переопределить',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'правило',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'срабатывает',
  'workbench.docs.diagrams.conditions.ruleFires.footer':
    'Правило меняет только свою цель — остальное проходит как есть.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Домены запроса: одна запись автоматически включает корневой домен и каждый поддомен, на любом пути и с любой строкой запроса',
  'workbench.docs.diagrams.conditions.requestDomains.title': 'Домены запроса — одна запись, все поддомены, любой путь',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'автоматически включает',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'совпадение только по хосту — подходит любой путь и строка запроса',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': 'Не совпадает:',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'другой TLD (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'не настоящий поддомен — нет точки перед «openheaders.com»',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix':
    'Нужно ограничить путём? Добавьте в правило условие ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': '.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    'Несколько доменов? Добавьте каждый отдельной записью.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    'Исключить домены вычитает хосты из совпадений другого условия; само по себе оно ни с чем не совпадает',
  'workbench.docs.diagrams.conditions.excludeDomains.title': 'Исключить домены — вычитает из другого условия',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': 'Вычитает из совпадений другого условия',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ ДОМЕНЫ ЗАПРОСА',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− ИСКЛЮЧИТЬ ДОМЕНЫ',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Итоговые хосты:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'исключён',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    'исключён — правило поддоменов действует и для исключения',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Одно исключение не совпадает ни с чем.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': 'Оно только вычитает из совпадений другого условия.',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Домены инициатора: одно назначение, разные страницы-источники, противоположные исходы',
  'workbench.docs.diagrams.conditions.initiatorDomains.title':
    'Домены инициатора — совпадение по странице, сделавшей вызов',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle': 'Один fetch, два контекста страницы → разные исходы',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Домены инициатора: portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'ОТКРЫТАЯ СТРАНИЦА',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ запрашивает',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ СОВПАДАЕТ',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ НЕТ СОВПАДЕНИЯ',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'инициатор =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': 'Хотите совпадение по назначению, а не по источнику?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Методы — мультивыбор HTTP-методов; совпадают только выбранные (оранжевые) методы',
  'workbench.docs.diagrams.conditions.methods.title': 'Методы — выберите, какие HTTP-методы совпадают',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    'Мультивыбор — оранжевые методы совпадают; остальные правило не запускают',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'метода нет среди выбранных',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'Хотите совпадение по любому методу?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Удалите это условие — по умолчанию все методы.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Типы ресурсов — мультивыбор видов запросов; выбранные фиолетовые типы совпадают, остальные пропускаются',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Типы ресурсов — мультивыбор видов запросов',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle':
    'Фиолетовые виды совпадают; остальные правило не запускают',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'открыть /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'страница',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'изображение — пропущено',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'скрипт — пропущен',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'Хотите совпадение по любому типу ресурса?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': 'Удалите это условие — по умолчанию все виды.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Тип домена — каждый запрос классифицируется как основной (тот же регистрируемый домен) или сторонний; селектор ' +
    'правила решает, какой тип совпадает',
  'workbench.docs.diagrams.conditions.domainType.title': 'Тип домена — основной или сторонний',
  'workbench.docs.diagrams.conditions.domainType.subtitle':
    'Классифицируется по отношению между страницей и URL-адресом запроса',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Страница:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Выбор в правиле:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'НАЗНАЧЕНИЕ',
  'workbench.docs.diagrams.conditions.domainType.colType': 'ТИП',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'СОВПАДЕНИЕ',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'основной',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'сторонний',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': 'Нужны оба? Выберите firstParty И thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'Или удалите условие — по умолчанию оба.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Условие «Заголовки ответа» — точное имя плюс точное значение, только на стороне ответа (Chrome DNR не сопоставляет ' +
    'заголовки запроса)',
  'workbench.docs.diagrams.conditions.headers.title': 'Заголовки ответа — точное имя + точное значение',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    'Только на стороне ответа — Chrome DNR не сопоставляет заголовки запроса',
  'workbench.docs.diagrams.conditions.headers.exactName': 'точное имя',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'точное значение',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'Тестовые заголовки ответа:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'имя совпадает, но значение другое',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'другое имя заголовка',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(ответ без Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'заголовка нет — для совпадения он должен присутствовать',
  'workbench.docs.diagrams.conditions.headers.footer':
    'Частый случай: фильтровать правила по Content-Type ответа или своим флагам',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'URL-шаблон использует подстановочные знаки на полном URL-адресе — анатомия шаблона плюс примеры совпадений и несовпадений',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'URL-шаблон — подстановочные знаки (*) на полном URL-адресе',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'любой',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'протокол',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'литеральный хост',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(без подстановок)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'любой путь',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ строка запроса',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'подстановочный знак — совпадает с чем угодно',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '«cdn» ≠ «api» — поддомен не совпал',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'совсем другой хост',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'Нужно совпадение по всем поддоменам сразу?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Домены запроса: openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'Анатомия URL-регулярного выражения плюс примеры совпадений и несовпадений — фиолетовые части это настоящий regex; всё остальное литерал',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'URL-регулярное выражение — RE2 на полном URL-адресе',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'начало',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'якорь',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'литеральные символы',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. совпадает с символом .)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'одна или более',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'цифр',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'синтаксис regex — особое значение',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': 'regex задаёт https:// — http не совпадает',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '«latest» не совпадает с /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'Нужны и http, и https?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Используйте ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — символ ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' делает s необязательной.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    'Анатомия правила — исходящий HTTP-запрос сверяется с условиями правила, объединёнными через AND; если совпали все, ' +
    'действие изменяет запрос до того, как он покинет браузер.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'Правило = условия + действие',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    'Условия решают, сработает ли правило. Действие решает, что изменится.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Исходящий запрос',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'до',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'после',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'ДОБАВЛЕНО',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'проверка',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'применение',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Правило',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'сущность редактора',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'УСЛОВИЯ',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'ДЕЙСТВИЕ',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Методы',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Домены запроса',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Заголовки ответа',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'ВСЕ ДОЛЖНЫ СОВПАСТЬ (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'одно на правило',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'Действие с заголовком · Добавить',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'категория: Изменение запроса',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Условия фильтруют',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'действие преобразует',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'запрос уходит изменённым',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Таксономия действий — три категории (Изменение запроса, Изменение ответа, Выполнение кода) перечисляют каждое действие с ' +
    'его движком выполнения (DNR или Script).',
  'workbench.docs.diagrams.actions.taxonomy.title': 'Действия — по категориям',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'Каждое действие принадлежит одной из трёх категорий. Метка движка показывает, где оно выполняется.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Изменение запроса',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'до того, как он покинет браузер',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Изменение ответа',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'до того, как его увидит страница',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Выполнение кода',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'внутри страницы или её планировщика',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'Действия с заголовками',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': 'Добавить · Добавить в конец · Удалить · Объединить',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Блокировка',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'отмена на сетевом уровне',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Перенаправление',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'статический URL-адрес или regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Параметры запроса',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'добавить · заменить · удалить',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Тело запроса',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'статическое · динамическое · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'заголовки на стороне ответа',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Тело ответа',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'имитация тела · статус · заголовки',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'Внедрение JS / CSS',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'до скриптов страницы или после DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Задержка',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'навигации + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict': 'Выберите категорию · выберите действие · сочетайте с условиями',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Синхронизация',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Правила',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Запросы',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Разрешения',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Секреты',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'Состояние системы',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'Событий пока нет',
  'workbench.docs.diagrams.systemStatus.shared.green': 'зелёный',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'жёлтый',
  'workbench.docs.diagrams.systemStatus.shared.red': 'красный',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'Настольное приложение',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'пробуждение SW',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'Поверхность рабочей среды — вкладка рабочей среды OpenHeaders. Строка состояния живёт в нижнем футере, по одному индикатору ' +
    'на подсистему.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'Рабочая среда: строка состояния в футере',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ шесть индикаторов — по одному на подсистему, нажмите любой, чтобы открыть поповер.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    'Поверхность всплывающего окна — оно раскрывается из значка на панели инструментов. Индикатор состояния сидит в нижнем футере ' +
    'всплывающего окна как точка плюс подпись «Состояние системы».',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title':
    'Всплывающее окно: индикатор «Состояние системы» в футере',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ точка + подпись «Состояние системы» сидят в полосе футера всплывающего окна.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Агрегатор худшего состояния — шесть состояний подсистем сходятся в одну сводную точку. Побеждает худший цвет: красный бьёт ' +
    'жёлтый, жёлтый бьёт зелёный.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'Побеждает худший цвет',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'красный > жёлтый > зелёный · серый = событий пока нет (считается зелёным)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'подключено',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': 'активных: 12',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'событий пока нет',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'хост сужен',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'расшифровка',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': 'свежих: 3',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'сводная',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'точка',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'Один красный где угодно → сводная точка красная. Она управляет точкой всплывающего окна / боковой панели.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'Раскладка поповера состояния — серые строки подсистем без событий стоят над цветными строками подсистем, ' +
    'которые уже отчитались.',
  'workbench.docs.diagrams.systemStatus.popover.title': 'Порядок в поповере: сначала серые, затем цветные',
  'workbench.docs.diagrams.systemStatus.popover.subtitle':
    'Внутри каждого яруса сохраняется канонический порядок подсистем',
  'workbench.docs.diagrams.systemStatus.popover.header': '● Состояние системы',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Подключено',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': 'Активных правил: 12',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Хосты сужены',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Сбой расшифровки шифротекста',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ событий пока нет · ↓ уже отчитались',
  'workbench.docs.diagrams.systemStatus.popover.footer':
    'При первом отчёте строка один раз переходит из серой в цветную.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    'Топология синхронизации — сервис-воркер расширения держит одно соединение WebSocket с настольным приложением на 127.0.0.1:8137, ' +
    'обмениваясь рабочими пространствами, переменными и данными командной синхронизации.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'Как подключается подсистема «Синхронизация»',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Расширение',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'сервис-воркер',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'клиент WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'на вашей машине',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'сервер WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries':
    'Несёт: динамические переменные · рабочие пространства · командная синхронизация',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'Только loopback — никогда не покидает вашу машину.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'Жизненный цикл соединения синхронизации как диаграмма последовательности — сервис-воркер расширения подключается к настольному приложению, ' +
    'индикатор состояния со временем переходит из зелёного в жёлтый и обратно в зелёный',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': 'Как индикатор «Синхронизация» меняется со временем',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'SW расширения',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Индикатор',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'читает настройки',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'если автоподключение = выкл. →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Отключено',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Подключение',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Подключено',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Повтор #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Повтор #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'иначе →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'подключение WebSocket',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'рукопожатие OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ соединение оборвалось',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'задержка',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'повтор подключения',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Экспоненциальная задержка между повторами · пинги выявляют тихие обрывы через прокси',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Конвейер правил — правило пользователя компилируется, разрешает переменные, проходит проверку предела, затем его применяет Chrome. Каждая ' +
    'стадия может выдать уровень состояния, если что-то пошло не так.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'Как правило становится живой записью DNR',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Ваше правило',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Компиляция',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': 'Разрешение {{VAR}}',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Проверка предела',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Применяет Chrome',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Живое правило',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'в DNR JSON',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · workspace',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'совпадает с запросами',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'не разрешено → жёлтый',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'выше предела → жёлтый',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'отклонено → красный',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'активных: N → зелёный',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': 'Пересборка срабатывает при каждом сохранении.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    'На паузе остаётся зелёным («Rule execution paused»).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'Полоса ёмкости DNR — зелёная до порога предупреждения, жёлтая до предела усечения, красная дальше. Правила ' +
    'сверх предела отбрасываются, поэтому красная зона во время работы недостижима.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'Ёмкость правил — куда попадает каждое число правил',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ исправно',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'приближение',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'усечено',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'порог',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'предел',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    'Правила сверх предела отбрасываются в порядке совпадения (верхние побеждают).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Жёсткий потолок браузера Chrome стоит гораздо дальше — 30,000.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'Исходы исполнителя запросов — любой HTTP-ответ, включая 4xx и 5xx, делает индикатор зелёным. Только ' +
    'сбои сетевого уровня без ответа делают его жёлтым.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': 'Что и в какой цвет красит индикатор «Запросы»?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Редактор запроса',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Отправить ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Исполнитель срабатывает',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ получен HTTP-ответ',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'считается любой код статуса',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Not Found',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Server Error',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Прервано',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Офлайн / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Индикатор → зелёный',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Индикатор → жёлтый',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ нет ответа',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'сбой сетевого уровня',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'Ответ 500 всё равно «зелёный» — запрос завершился, просто вы получили 500.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'Область исполнителя запросов — индикатор обновляют только запросы по кнопке «Отправить». Обновления рабочих процессов Live тихие; ' +
    'трафик веб-страниц идёт через движок правил.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': 'Что обновляет индикатор «Запросы»?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'Отправить ▸ в редакторе запроса',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Обновление рабочего процесса Live',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'fetch / XHR веб-страницы',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'инициировано пользователем',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'фоновый тик',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'наблюдает движок правил',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'обновляет индикатор',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'другая система',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'не обновляет',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'Этот индикатор формирует только разовый трафик по кнопке «Отправить».',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    'Одно правило, два состояния разрешений. С выданным all_urls DNR-правило срабатывает. С отозванным хостом правило ' +
    'молча ничего не делает, и заголовок не приходит.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': 'Одно правило, два состояния разрешений',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Выдано',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Сужено',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'хост отозван',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Добавить заголовок',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Страница',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': 'применяется',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'пустая операция',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ заголовок приходит',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ заголовка нет',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'правило сработало',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'тихая пустая операция',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    'Суженные хосты не дают ошибки — правила просто молча ничего не делают.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    'Красный индикатор — единственная подсказка, пока вы не вернёте доступ.',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    'Когда выполняется аудит и какой уровень состояния сообщает каждый исход.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title': 'Когда выполняется аудит и что сообщает каждая ветка?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'первая гидратация',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'штатный путь',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'пользователь отозвал хост',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API недоступен',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'исключение',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '«Всё выдано»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '«Хосты сужены»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '«Сбой аудита»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1': 'В MV3 нет наблюдателя за сменой разрешений —',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2':
    'перепроверка срабатывает при каждом пробуждении SW.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Гидратация Vault — блоб vault загружается из хранилища, каждая запись проходит через схему. Совпавшие остаются; ' +
    'записи с расхождением отбрасываются и сообщаются жёлтым.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Гидратация Vault при пробуждении SW',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (зашифрованный блоб)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Валидатор схемы',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'соответствует схеме',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'расхождение: старая форма',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ оставлено',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ отброшено',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Секреты · жёлтый',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'оставшиеся записи',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'гидратируются чисто',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'Как на самом деле выглядит расхождение схемы — у корректной записи есть uid, label и cipher; у записи с расхождением может ' +
    'не хватать поля cipher. Валидатор отбрасывает плохую строку и выдаёт жёлтое состояние.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'Как на самом деле выглядит «расхождение схемы»',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Корректная запись',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Запись с расхождением',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'Токен API',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'Старый токен',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— отсутствует —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': 'проблем схемы: 2 → отброшено',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'Записи с расхождением отбрасываются при гидратации, и индикатор становится жёлтым.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Повторное сохранение в редакторе Vault возвращает записи текущую форму.',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'Правила состояний рабочих процессов Live — свежий, устаревший / с перебоями, сбоящий — привязанные к реальным порогам.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'Правила состояния для каждого рабочего процесса',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'свежий',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'устаревший / с перебоями',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'сбоящий',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh':
    'последний запуск OK · в пределах 2× периодичности · сбоев: 0',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': 'дольше 2× периодичности  · ИЛИ  сбоев подряд: 1–4',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': 'сбоев подряд: 5+',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'напр. каждое обновление получает 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'напр. один тайм-аут, идёт повтор',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'напр. API лежит уже час',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer':
    'Периодичность = настроенный интервал обновления рабочего процесса.',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Агрегация индикатора Live — три рабочих процесса активного рабочего пространства сходятся в одно сводное значение через max; рабочие процессы ' +
    'неактивных рабочих пространств исключены.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    'Рабочие процессы активного рабочего пространства сходятся в один индикатор',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Активное рабочее пространство',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'вносит вклад в индикатор',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'свежий',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': 'сбоев подряд: 2',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Другие рабочие пространства',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'намеренно исключены',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ пользователь не может на них повлиять — пропущены',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Индикатор Live',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = жёлтый',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    'Один рабочий процесс в худшем состоянии переключает весь индикатор.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    'Переключите рабочее пространство — индикатор пересчитается по запускам того пространства.',

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'ЛУЧШИЙ В КЛАССЕ',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': 'СЕГОДНЯ',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'ДОРОЖНАЯ КАРТА',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'ПОДДЕРЖИВАЕТ',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'В браузере',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'Настольное приложение',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Локальный сервер',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'Ваша ВМ',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'скоро',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'Смена парадигмы — сгруппированные противопоставления Open Headers и любого другого инструмента в этой области. Всё в ' +
    'одном браузерном расширении, без учётной записи, только локально, без отслеживания, один движок для девяти типов правил, синхронизация на уровне полей, ' +
    'полнофункциональный бесплатный уровень без ограничений по функциям, оплата за места и никакой блокировки при просрочке — против ' +
    'остального рынка.',
  'workbench.docs.diagrams.openHeaders.shift.title': 'СМЕНА ПАРАДИГМЫ',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Все остальные',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Архитектура и охват',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Приватность и владение',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Возможности',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Синхронизация и устойчивость',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Цены и доверие',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'УНИКАЛЬНО',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'ПОД КОНТРОЛЕМ ПОЛЬЗОВАТЕЛЯ',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'БЕЗ ОГРАНИЧЕНИЙ ПО ФУНКЦИЯМ',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Всё внутри браузера',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'бэкенд + фронтенд',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- в расширении',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Бэкенд вне браузера',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'настольное приложение / облако, нужен интернет',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Разместите бэкенд сами',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'браузер · настольное приложение · сервер · ВМ',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Только их облако',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'никакого выбора, где живут ваши данные',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Фронтенд нативно работает офлайн',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'расширение · настольное · CLI · веб',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Только облачный фронтенд (онлайн)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'для доступа к бэкенду нужен интернет',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'Без учётной записи',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'без входа, без стены логина',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Требуется вход',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'чтобы пользоваться своими данными',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Только локально',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'без облачного ретранслятора',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Через облако',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'ваш трафик идёт через них',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'Без отслеживания',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'анонимные счётчики · выключаются одним переключателем',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Отслеживание по умолчанию',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': 'данные об использовании уходят им',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Движок правил',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'перехват и изменение запросов',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'Нет движка в браузере',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'нужен отдельный прокси или приложение',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'Каталог API-запросов',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — всё в браузере',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Войдите на платформу',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'и установите их приложение',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Автоматизируйте рабочее пространство',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'ваш ИИ-агент, локальный или удалённый',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- решаете вы',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Закрыто или только их облачный ИИ',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'без открытого или программного доступа',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Движок синхронизации в реальном времени',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'несколько устройств, браузеров, поверхностей',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Побеждает последняя запись',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'или синхронизации нет вовсе',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Бесконфликтное одновременное сохранение',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'на уровне полей, все изменения зафиксированы',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'Перезапись на уровне сущности',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': 'сохранения могут стирать друг друга',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Работает офлайн, полностью редактируемо',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': 'синхронизируется само, когда вы вернётесь',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Нужно подключение',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'или доступа нет вовсе',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': 'Всё сегодня, на каждом уровне',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'бесплатно до 6 пользователей · платно = места команды',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Уровни с ограничением функций',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'ключевые возможности за доплатой',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO и безопасность всегда бесплатно',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · аудит · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'Налог на SSO',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'безопасность продаётся как корпоративная надбавка',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'Просрочка никогда не закрывает доступ',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'льготный период, затем бесплатный уровень — данные ваши',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': 'Перестали платить — потеряли доступ',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'платная стена перед вашими же данными',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Локально-ориентированный. По замыслу. Не задним числом.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'Каталог API-запросов — стилизованный макет редактора запросов с выбором метода, строкой URL-адреса, полосой вкладок и ' +
    'предпросмотром тела, плюс полоса возможностей: протоколы, авторизация, скрипты, переменные, файлы, коллекции и ' +
    'файлы cookie.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'Каталог API-запросов',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'Полное построение, отправка запросов и управление коллекциями — внутри расширения.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Отправить ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Авторизация',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'Заголовки',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Тело',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Скрипты',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Настройки',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Авторизация',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API Key',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Скрипты',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'перед запросом + после ответа',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Переменные',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 областей · структурная диагностика',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Файлы',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · разрешение {{file.X}}',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Коллекции',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'папки · окружения · на каждый запрос',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Файлы cookie',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'credentialsMode по выбору',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    'ВСЁ, ЧТО ЕСТЬ У НАСТОЛЬНОГО API-КЛИЕНТА, — ВНУТРИ РАСШИРЕНИЯ',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'Полная API-платформа — без платформы.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Движок правил Open Headers — два пути выполнения (нативный DNR и перехват скриптом), девять категорий типов правил, ' +
    'сгруппированных по движку, плюс общий язык условий и цепочка областей переменных, из которых читает каждое ' +
    'правило.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Движок правил',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'нативный MV3 · два движка · девять категорий правил',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · нативно',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · перехват',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'Заголовки',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Переопределить · Добавить в конец · Удалить',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Блокировка',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'отмена на сетевом уровне',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Перенаправление',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'статический URL-адрес или regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Параметры запроса',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'добавить · заменить · удалить · удалить все',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'Заголовки (Объединить)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'склейка значений',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Внедрение',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS или CSS, два момента',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Задержка',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'навигация + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Тело запроса',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'статическое · динамическое · фильтр GraphQL',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Тело ответа',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'тело + статус + заголовки',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'ловит каждый запрос, выпущенный браузером',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'ловит fetch / XHR, инициированные JS',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'ОДИН ЯЗЫК УСЛОВИЙ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Домены запроса · URL-шаблон · URL-регулярное выражение · Методы · Ресурсы · Инициатор · Заголовки · Тип домена',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'ПЯТЬ ОБЛАСТЕЙ ПЕРЕМЕННЫХ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    'Один движок. Два пути выполнения. Полный язык условий и переменных. Внутри расширения.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Три устаревшие категории продуктов — настольные прокси, облачные API-платформы, расширения только для заголовков — сходятся ' +
    'в одно браузерное расширение Open Headers. Стилизованный браузер Chromium показывает открытую страницу рабочей среды расширения, ' +
    'и каждая возможность, которую раньше давали три категории, живёт внутри этой одной вкладки.',
  'workbench.docs.diagrams.openHeaders.convergence.title': 'Три категории инструментов. Одно расширение.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'То, что раньше требовало трёх отдельных установок, теперь живёт в одной вкладке браузера.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Настольные прокси',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub':
    'перехват HTTP · CA-сертификат · отдельный бинарник',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'API-платформы',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'запросы + коллекции · в облаке · учётная запись',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'Расширения для заголовков',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub':
    'один тип правил · без скриптов · без авторизации',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ ВСЁ ОТКРЫТО В ОДНОЙ ВКЛАДКЕ',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'поверхность рабочей среды',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'нативный MV3',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Движок правил',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'Каталог API-запросов',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Движок синхронизации в реальном времени',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Бесконфликтное сохранение',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'Без учётной записи · без входа',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Только локально · без облачного ретранслятора',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'Без отслеживания · без личных данных',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'Многоповерхностный UI',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Много поверхностей · синхронизация между устройствами · только локально по замыслу',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Синий = возможности · фиолетовый = позиция · все восемь живут в одной вкладке',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Две поверхности одновременно редактируют одно правило. DevTools добавляет, изменяет и удаляет заголовки; рабочая среда ' +
    'редактирует три других поля того же правила. Все шесть правок приземляются в объединённом правиле без баннера и ' +
    'перезаписи.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Две поверхности, одно правило, приземляются обе правки',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    'Синхронизация по полям — без баннера, без перезаписи, без потери работы',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'поверхность A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'поверхность B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'правит заголовки',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Правило X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'заголовки',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'ДВИЖОК СИНХРОНИЗАЦИИ · слияние по полям',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'объединённый снимок · заголовки',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Добавлено',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Изменено',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Удалено',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← источник: ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ обе правки применены — без баннера, без конфликта',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    'Тот же путь масштабируется: сегодня расширение → завтра расширение + настольное приложение + CLI',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Выберите фронтенд — как вы получаете доступ к данным и управляете ими. Четыре форм-фактора фронтенда сложены вертикально: ' +
    'браузерное расширение, настольное приложение, CLI и веб-приложение. Каждая карточка перечисляет поверхности, бэкенды, ' +
    'к которым она подключается (первый чип — по умолчанию), и платформы, на которых работает.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title':
    'Выберите фронтенд — как вы получаете доступ к данным и управляете ими',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Те же данные, любой фронтенд — выберите один, пользуйтесь всеми, каждая поверхность остаётся синхронизированной.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Браузерное расширение',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'внутри браузера',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'нативное окно',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'командная строка',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'Веб-приложение',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'вкладка браузера',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Боковая панель',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Командная строка',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Встроенный',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'ПОВЕРХНОСТИ',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'ПОДКЛЮЧАЕТСЯ К БЭКЕНДУ',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'ВЫБЕРИТЕ ОДИН ФРОНТЕНД ИЛИ ВСЕ СРАЗУ — ДАННЫЕ ТЕ ЖЕ',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ расширение · ✓ настольное · ✓ CLI · ✓ веб — все читают одни канонические сущности',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Те же данные, каким бы путём вы ни пришли — каждая поверхность остаётся синхронизированной.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'Выберите бэкенд — где живут ваши данные. Четыре варианта размещения сложены вертикально. Каждый уровень наследует ' +
    'все возможности предыдущего и добавляет новые, выделенные зелёным пунктирным прямоугольником. Столбец ' +
    'ПОДДЕРЖИВАЕТ справа перечисляет браузеры, операционные системы и облачных провайдеров для каждого уровня. ' +
    'Все четыре уровня только локальные.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Выберите бэкенд — где живут ваши данные',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    'Каждый уровень наследует предыдущий — зелёная рамка показывает новое — правый столбец показывает, где он работает.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': 'сервис-воркер расширения',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'встроенный бэкенд',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'автономный процесс',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'размещайте где угодно',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'без настройки',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'одно устройство',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'экземпляр на браузер',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'одновременная правка с нескольких поверхностей',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'одновременная правка из нескольких окон',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'Только localhost',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'экземпляры в нескольких браузерах',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'экземпляр на приложение',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'нативная файловая система',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML на диске',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'интеграция с git (локально/удалённо)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'минимальная настройка',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'доступен по LAN',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'экземпляры в нескольких приложениях',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'несколько устройств',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'расширение · настольное приложение · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'стандартная настройка',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'доступен по WAN/интернету',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'готов для команды',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'вход через SSO',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'управление пользователями RBAC',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': 'журналы и отчёты аудита',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'Все ОС',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Встроенный',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Гиперскейлеры',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'Из ЕС',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Другое',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Корпоративные',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Мини-ПК',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Домашний сервер',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Старый ноутбук',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Ваше облако',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'On-prem',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'НАСЛЕДУЕТ ОТ {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ НОВОЕ НА ЭТОМ УРОВНЕ',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'ЧТО БЫ ВЫ НИ ВЫБРАЛИ — ЭТО ВАШЕ, ОТ НАЧАЛА ДО КОНЦА',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ без учётной записи · ✓ без облачного ретранслятора · ✓ без отслеживания · ✓ без личных данных',
  'workbench.docs.diagrams.openHeaders.localFirst.footer': 'Ваши данные, ваш бэкенд, ваш выбор — на каждом шаге.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Четыре карточки категорий сравнивают SaaS API-платформы, настольные прокси и расширения только для заголовков с ' +
    'Open Headers.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'ГДЕ СТОИТ OPEN HEADERS',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'SaaS API-платформы',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Настольные прокси',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Расширения только для заголовков',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'облако',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'нативные',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'лёгкие',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'мы',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Ваши данные живут на их серверах',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Нужны учётная запись + вход',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Широкий набор функций',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Отдельный бинарник: установить + запустить',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'CA-сертификат + настройка прокси в каждом приложении',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Видят любой трафик',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'В браузере, без настройки',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'Один тип правил — только заголовки',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'Без скриптов, авторизации и правки тел',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'В браузере · только локально · без учётной записи',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Девять типов правил · один язык условий',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'Скрипты + OAuth + файлы в расширении',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Четыре поверхности с одним хранилищем',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'против облачных API-платформ. Облачные платформы держат учётные данные, определения правил и журналы запросов на сервере ' +
    'поставщика. Open Headers держит все три на устройстве пользователя.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Где оказываются ваши данные',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Учётные данные, определения правил, журналы запросов — локально или удалённо?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'учётные данные',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'определения правил',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'журналы запросов',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'на вашем устройстве',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'на сервере поставщика',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Облачная API-платформа',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'вы',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'ваши данные',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'облако',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'ваше устройство',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'учётные данные · правила · журналы',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'всё в одном месте',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Ваши данные никогда не покидают вашу машину',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'против расширений только для заголовков. Такие расширения умеют один тип правил. Open Headers умеет девять — заголовки, ' +
    'блокировка, перенаправление, параметры запроса, объединение заголовков, внедрение, задержка, тело запроса, тело ответа.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'Сколько типов правил',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'Инструмент, который делает одно, — или инструмент, который делает девять.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Расширение только для заголовков',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'Заголовки',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'переопределить',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Блокировка',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'отмена',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Перенаправление',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'статич. / regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Query',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'добавить · удалить',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Объединить',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'заголовки ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Внедрение',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Задержка',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'нав. / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Тело запроса',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'статич. · динам.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Тело ответа',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'тело / статус',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft':
    'Нужно что-то из остальных 8? — ставьте ещё одно расширение',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight':
    'Те же условия, та же поверхность, одно рабочее пространство',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Девять типов правил, один язык условий, одна наблюдаемая поверхность',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'против настольных прокси. Прокси гонят трафик через отдельный процесс за CA-сертификатом. Open Headers ' +
    'применяет правила встроенно, через нативные API браузера — без порта прокси, без сертификата.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'Как формируются запросы',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Встроенные правила в браузере — без порта прокси, без CA-сертификата, без настройки в каждом приложении.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Настольный прокси',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'ОБХОДНОЙ ПУТЬ',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'ВСТРОЕННО',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'Приложение',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'настроено',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'порт прокси',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Прокси',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'CA-сертификат',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Интернет',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Браузер',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'установить бинарник',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'установить CA-сертификат',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'настроить каждое приложение',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': 'установить расширение',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': 'и всё',
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    'Одна установка · ноль сертификатов · правила работают с правами самой страницы',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Веха дорожной карты — CLI. Окно терминала с примерами команд: список правил, переключение ' +
    'окружений и отправка сохранённого запроса — все говорят с тем же сервером, что и UI.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · скрипты без интерфейса',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'Тот же сервер, что у UI, — автоматизация остаётся синхронной с тем, что вы видите.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · терминал',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# тот же сервер · то же рабочее пространство, что у UI',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict':
    'Список · переключение · отправка · diff — прямо из оболочки',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Веха дорожной карты — локальный / LAN-сервер. Сервер в центре; расширение, настольное приложение и CLI подключаются ' +
    'как клиенты по вашей LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Локальный / LAN-сервер · один узел синхронизации',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Расширение · настольное · CLI — все клиенты одного сервера, все в вашей сети.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'рабочие пространства',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'правила · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'движок синхронизации',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'доступен по LAN',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Расширение',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'ноутбук',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'рабочая станция',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · много окон',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'любая машина · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': 'Один сервер · много клиентов · остаётся в вашей сети',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'Веха дорожной карты — настольное приложение. Браузерное расширение и нативное настольное приложение открывают одну поверхность Workbench ' +
    'над одним хранилищем на диске. Настольное приложение добавляет протоколы, которые браузерное расширение не может держать нативно: ИИ, ' +
    'MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Нативное окно · то же хранилище · больший охват',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    'Та же рабочая среда, то же рабочее пространство — настольное добавляет протоколы, недоступные браузеру.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Браузерное расширение',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': 'сегодня',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'ПОВЕРХНОСТЬ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'ВОЗМОЖНОСТИ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'КАТАЛОГ API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Браузерный перехватчик',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Переменные',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Рабочие процессы',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'Каталог API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'локально / удалённо',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ ТОЛЬКО НАСТОЛЬНОЕ',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'Все четыре возможны в браузере.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': 'то же хранилище рабочих пространств на диске',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    'Одно рабочее пространство, два фронтенда, больший охват там, куда браузеру не дотянуться',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Веха дорожной карты — командные рабочие пространства через Git. Два устройства держат по рабочему пространству; оба отправляют в общий ' +
    'репозиторий Git и забирают из него. Репозиторий — слой синхронизации; сервера поставщика посередине нет.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Рабочие пространства как репозитории Git',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'Pull синхронизирует · push делится · слияние через Git — без сервера поставщика.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'устройство A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'устройство B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Рабочее пространство',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'правила · окружения · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Ваши данные, ваш репозиторий, ваша проверяемая история',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Импортёры. Шесть исходных форматов сходятся в одно рабочее пространство Open Headers — cURL, заголовки HAR, Postman, полные ' +
    'запросы HAR, Insomnia, OpenAPI — все доступны сегодня.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Импортёры · перенесите свою коллекцию',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, полные запросы HAR — все доступны сегодня.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'заголовки',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Коллекция Postman',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR (полные запросы)',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Коллекция Insomnia',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'Спецификация OpenAPI',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'СЕГОДНЯ',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'ДАЛЕЕ',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'рабочее пространство',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'ИМПОРТИРУЕТСЯ В',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Браузерный перехватчик',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'Коллекции API-запросов',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Окружения',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Записи Vault',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict': 'Перенесите за один шаг — и продолжайте работать',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Веха дорожной карты — архитектура MCP-сервера. ИИ-клиент подключается к Open Headers через Model Context ' +
    'Protocol (stdio локально, HTTP/SSE удалённо). MCP-сервер OH изменяет рабочее пространство пользователя; результат ' +
    'появляется в рабочей среде.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'MCP-сервер · ваше рабочее пространство, любой ИИ-клиент',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers говорит на Model Context Protocol — любой агент с поддержкой MCP может управлять вашим рабочим пространством.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'ИИ-клиент',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'ваш агент',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'ЛЮБОЙ MCP-КЛИЕНТ',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'MCP-сервер OH',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'ОТКРЫВАЕТ',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Правила · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'API-запросы',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Окружения',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Переменные · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Рабочие процессы',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'локально',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'удалённо',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'изменяет',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Рабочая среда · ваше рабочее пространство',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'живое',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents':
    'правила · окружения · переменные · рабочие процессы · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    'Управляйте рабочим пространством любым ИИ-агентом · локально или удалённо',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Веха дорожной карты — каталог инструментов MCP-сервера. Семь доменов, всего инструментов: {n} — правила, запросы, ' +
    'окружения, переменные, рабочие процессы, рабочие пространства, активность.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'Что умеет ИИ-агент',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    'Семь доменов — полный CRUD там, где это уместно, ограниченное чтение там, где нет.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Правила',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'заголовок · блокировка · перенаправление · ответ',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Запросы',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'Каталог API',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Окружения',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'на рабочее пространство',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Переменные',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'все области · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Рабочие процессы',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'цепочки вызовов API',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Рабочие пространства',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'несколько пространств',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': 'ИНСТРУМЕНТОВ: {n}',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 ИНСТРУМЕНТ',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Активность',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    'лента изменений — агент видит, что изменилось, прежде чем действовать',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict':
    'инструментов: {n} · семь доменов · вся поверхность Open Headers',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Вехи — упорядоченные карточки в рамке окна браузера: рабочие пространства Git, настольное приложение, MCP-сервер, локальный ' +
    'сервер, CLI, самостоятельно размещаемое веб-приложение, импортёры — все выпущены.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Каждая поверхность выпущена',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    'Выпущено по порядку — «только локально» оставалось сутью продукта на каждой вехе.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'ВЫПУЩЕНО',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'ПОД КОНТРОЛЕМ ПОЛЬЗОВАТЕЛЯ',
  'workbench.docs.diagrams.openHeaders.milestones.msGit':
    'Совместная работа над рабочим пространством через Git (для команд)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML в репозитории Git под вашим контролем — pull, push, слияние через Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    'Нативный бинарник над тем же хранилищем — дотягивается туда, куда расширение не может.',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'MCP-сервер (управление ИИ-агентом)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers через MCP — позвольте ИИ-агенту управлять вашим рабочим пространством.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Локальный / LAN-сервер',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Сервер на вашей машине или в LAN — расширение, настольное приложение, CLI как клиенты.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Скрипты без интерфейса и CI — список, переключение, отправка из оболочки.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Самостоятельное размещение на ВМ + веб-приложение',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Веб-сборка на вашей ВМ — для закрытых браузеров или брендированных развёртываний.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'Больше импортёров',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Не только Postman — Insomnia, спецификации OpenAPI, полный импорт HAR.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'Синхронизация между пользователями идёт через Git и самостоятельные развёртывания — без облака поставщика.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Веха дорожной карты — самостоятельно размещаемое веб-приложение. Ваш источник отдаёт ту же UI-сборку; пользователи открывают её как вкладку ' +
    'браузера на домене под вашим контролем. Та же поверхность рабочей среды, расширение не требуется.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Самостоятельное размещение на ВМ + веб-приложение',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'Ваша ВМ отдаёт веб-сборку — ваш источник, ваш домен, ваши пользователи.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'отдаёт',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · веб',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': 'та же поверхность, что у расширения + настольного',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'Тот же UI · ваш источник · расширение не требуется',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'ПРАВИЛО',
  'workbench.docs.diagrams.shared.useCasesKicker': 'ЧАСТЫЕ СЛУЧАИ',
  'workbench.docs.diagrams.shared.wontFireKicker': 'КОГДА НЕ СРАБАТЫВАЕТ',
  'workbench.docs.diagrams.shared.suggestion': 'Совет',
  'workbench.docs.diagrams.shared.beforeKicker': 'ДО',
  'workbench.docs.diagrams.shared.afterKicker': 'ПОСЛЕ',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Блокировка отменяет совпавшие запросы на сетевом уровне — страница видит сетевую ошибку. Блокировки main_frame ' +
    'показывают ERR_BLOCKED_BY_CLIENT; блокировки подресурсов падают молча.',
  'workbench.docs.diagrams.block.rule': 'Блокировка · Домены запроса: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Страница',
  'workbench.docs.diagrams.block.dnrBlock': 'Блокировка DNR',
  'workbench.docs.diagrams.block.network': 'Сеть',
  'workbench.docs.diagrams.block.neverReached': 'не достигнута',
  'workbench.docs.diagrams.block.requestCancelled': 'запрос отменён',
  'workbench.docs.diagrams.block.pageSeesKicker': 'ЧТО ВИДИТ СТРАНИЦА',
  'workbench.docs.diagrams.block.chromeBlockPage': 'Страница блокировки Chrome',
  'workbench.docs.diagrams.block.silentFailure': 'Тихий сбой',
  'workbench.docs.diagrams.block.pageHandlesError': 'страница сама обрабатывает ошибку',
  'workbench.docs.diagrams.block.useCasesAria':
    'Блокировка — частые случаи: реклама и трекеры, имитация сбоя, запрет эндпоинта и блокировка только страницы.',
  'workbench.docs.diagrams.block.card1Title': 'Реклама и трекеры',
  'workbench.docs.diagrams.block.card1Example': 'Блокировать ads.openheaders.com',
  'workbench.docs.diagrams.block.card2Title': 'Имитация сбоя',
  'workbench.docs.diagrams.block.card2Example': 'Отключить хост для теста',
  'workbench.docs.diagrams.block.card3Title': 'Запрет эндпоинта',
  'workbench.docs.diagrams.block.card3Example': 'Блокировать только /api/admin',
  'workbench.docs.diagrams.block.card4Title': 'Только страница',
  'workbench.docs.diagrams.block.card4Example': 'Добавить условие main_frame',
  'workbench.docs.diagrams.block.useCasesFooter': 'Сочетайте Блокировку с условиями, чтобы сузить её.',
  'workbench.docs.diagrams.block.wontApplyAria':
    'Блокировка не отменяет задним числом уже загруженные ресурсы. Перезагрузите страницу после включения правила, чтобы поймать ' +
    'будущие запросы.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Уже загруженные ресурсы',
  'workbench.docs.diagrams.block.alreadyLoadedSub':
    'Перехватываются только будущие запросы — прошлые остаются загруженными.',
  'workbench.docs.diagrams.block.suggestionText': 'Перезагрузите страницу после включения правила.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Статическое перенаправление — каждый совпавший запрос переписывается на один и тот же URL-адрес назначения.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Перенаправление → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'ИСХОДНЫЙ ЗАПРОС',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL-адрес переписан',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'ПЕРЕНАПРАВЛЕНО НА',
  'workbench.docs.diagrams.redirect.staticStamp': 'Каждое совпадение → один и тот же URL-адрес назначения.',
  'workbench.docs.diagrams.redirect.staticStampSub': 'Браузер переходит так, будто сервер вернул перенаправление.',
  'workbench.docs.diagrams.redirect.regexAria':
    'Перенаправление по regex — группы захвата URL-шаблона подставляются как \\1, \\2 в URL-адрес назначения.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL-регулярное выражение: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Перенаправление → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'ИСХОДНЫЙ URL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 подставлено',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 наследует всё, что совпало с группой захвата.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'Перенаправление — частые случаи: переход HTTP→HTTPS, миграция домена, переписывание пути, локальный dev-прокси.',
  'workbench.docs.diagrams.redirect.card1Example': 'Принудительно http → https',
  'workbench.docs.diagrams.redirect.card2Title': 'Миграция домена',
  'workbench.docs.diagrams.redirect.card3Title': 'Переписывание пути',
  'workbench.docs.diagrams.redirect.card4Title': 'Локальный dev-прокси',
  'workbench.docs.diagrams.redirect.useCasesFooter':
    'Для переписывания с сохранением пути используйте URL-регулярное выражение с обратными ссылками.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    'Перенаправление не применяется задним числом к загруженным страницам, а циклы перенаправлений ограничивает Chrome, чтобы не допустить бесконечных ' +
    'петель.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Страница уже загружена',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Перехватываются только будущие навигации и fetch.',
  'workbench.docs.diagrams.redirect.loops': 'Циклы перенаправлений',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome их ограничивает — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': 'Перезагрузите. Убедитесь, что условия не зацикливаются.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    'Момент внедрения — «Как можно раньше» выполняется до скриптов страницы; «После загрузки страницы» — когда DOM разобран.',
  'workbench.docs.diagrams.inject.timeAxis': 'время →',
  'workbench.docs.diagrams.inject.navigation': 'навигация',
  'workbench.docs.diagrams.inject.domParsed': 'DOM разобран',
  'workbench.docs.diagrams.inject.loadEvent': 'событие load',
  'workbench.docs.diagrams.inject.asap': 'Как можно раньше',
  'workbench.docs.diagrams.inject.prePageScript': 'до скриптов страницы',
  'workbench.docs.diagrams.inject.afterLoad': 'После загрузки',
  'workbench.docs.diagrams.inject.domSafe': 'DOM готов',
  'workbench.docs.diagrams.inject.timingFooter': '«Как можно раньше» для гонок · «После загрузки» для DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    'Внедрение скрипта — JavaScript выполняется внутри страницы: либо как можно раньше (до скриптов страницы), либо после загрузки (DOM готов).',
  'workbench.docs.diagrams.inject.ruleScript':
    'Скрипт (как можно раньше): обернуть fetch, чтобы логировать каждый вызов',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // внедрено расширением',
  'workbench.docs.diagrams.inject.runsInPage':
    'Выполняется в контексте страницы — видит те же глобальные объекты, что и JS страницы.',
  'workbench.docs.diagrams.inject.scriptFooter':
    '«Как можно раньше» выигрывает гонки у кода приложения; «После загрузки» читает разобранный DOM.',
  'workbench.docs.diagrams.inject.cssAria':
    'Внедрение CSS — тег <style> добавляется в head страницы и скрывает элемент баннера.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'правило',
  'workbench.docs.diagrams.inject.ruleApplied2': 'применено',
  'workbench.docs.diagrams.inject.hidden': '(скрыто)',
  'workbench.docs.diagrams.inject.cssFooter': 'Внедряется тегом <style> — та же специфичность CSS, что у CSS страницы.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    'Внедрение не применяется к iframe в песочнице и к страницам со строгой CSP, блокирующей встроенные скрипты.',
  'workbench.docs.diagrams.inject.sandboxed': 'iframe в песочнице',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Страницы с sandbox="", отключающим скрипты.',
  'workbench.docs.diagrams.inject.strictCsp': "Строгая CSP (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': 'Встроенные внедрённые скрипты блокирует политика страницы.',
  'workbench.docs.diagrams.inject.suggestionText':
    'Внедряйте в родительскую страницу; в iframe передавайте через postMessage.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'Внедрение JS / CSS — частые случаи: монки-патчи, тёмная тема, скрытие элементов, флаги функций.',
  'workbench.docs.diagrams.inject.card1Title': 'Монки-патч',
  'workbench.docs.diagrams.inject.card1Example': 'Обернуть fetch / XHR (как можно раньше)',
  'workbench.docs.diagrams.inject.card2Title': 'Тёмная тема',
  'workbench.docs.diagrams.inject.card2Example': 'Принудительная тема CSS',
  'workbench.docs.diagrams.inject.card3Title': 'Скрыть лишнее',
  'workbench.docs.diagrams.inject.card3Example': 'display: none для баннеров',
  'workbench.docs.diagrams.inject.card4Title': 'Флаги функций',
  'workbench.docs.diagrams.inject.card4Example': 'Выставить флаги window как можно раньше',
  'workbench.docs.diagrams.inject.useCasesFooter':
    '«Как можно раньше» для кода, который должен идти первым; «После загрузки» для чтения DOM.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Маршрутизация задержки по полосам навигации, fetch и подресурсов — перехватываются только первые две, ' +
    'подресурсы проходят как есть.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Совпавший запрос',
  'workbench.docs.diagrams.delay.document': 'Документ',
  'workbench.docs.diagrams.delay.documentSub': 'навигация iframe',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': 'через страницу ожидания',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'инициирован JS',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'монки-патч',
  'workbench.docs.diagrams.delay.subResource': 'Подресурс',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'не задерживается',
  'workbench.docs.diagrams.delay.passesThrough': 'проходит как есть',
  'workbench.docs.diagrams.delay.routingFooter': 'Для больших пределов нужен настоящий локальный прокси',
  'workbench.docs.diagrams.delay.navAria':
    'Задержка навигации — браузер перенаправляется на локальную страницу ожидания, которая держит N ms, а затем ' +
    'передаёт на настоящий целевой URL-адрес.',
  'workbench.docs.diagrams.delay.ruleNav': 'Задержка 8,000 ms · навигация страницы',
  'workbench.docs.diagrams.delay.click': 'Клик',
  'workbench.docs.diagrams.delay.waitingPage': 'Страница ожидания',
  'workbench.docs.diagrams.delay.holds8s': '⏱ держит 8 с',
  'workbench.docs.diagrams.delay.loadsNow': 'загружается',
  'workbench.docs.diagrams.delay.navStamp': 'Соблюдается до 30,000 ms — потолок перенаправлений Chrome.',
  'workbench.docs.diagrams.delay.navStampSub': 'Реализовано как DNR-перенаправление на локальную страницу ожидания.',
  'workbench.docs.diagrams.delay.xhrAria':
    'Задержка fetch/XHR, инициированных JS — монки-патч setTimeout удерживает разрешение. Предел 5000ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Задержка 3,000 ms · JS fetch / XHR',
  'workbench.docs.diagrams.delay.intercept': 'перехват',
  'workbench.docs.diagrams.delay.network': 'сеть',
  'workbench.docs.diagrams.delay.hold3000': 'удержание 3,000 ms',
  'workbench.docs.diagrams.delay.realRequest': 'настоящий запрос',
  'workbench.docs.diagrams.delay.responseDelayed': 'ответ (задержан на 3 с)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Предел 5,000 ms — значения выше обрезаются на проводе.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    'Задержка не применяется к подресурсам (img/css/js) и к fetch сервис-воркеров, которые обходят монки-патч уровня ' +
    'страницы.',
  'workbench.docs.diagrams.delay.subResources': 'Подресурсы (img, css, js, шрифты)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Их выпускает браузер — никакой монки-патч их не удержит.',
  'workbench.docs.diagrams.delay.swFetches': 'fetch сервис-воркеров',
  'workbench.docs.diagrams.delay.swFetchesSub':
    'Работают в другой области; патчи уровня страницы до них не дотягиваются.',
  'workbench.docs.diagrams.delay.suggestionText': 'Троттлинг подресурсов скоро появится в настольном приложении.',
  'workbench.docs.diagrams.delay.useCasesAria':
    'Задержка — частые случаи: проверка состояний загрузки, тест debounce, выявление гонок, имитация медленной ' +
    'сети.',
  'workbench.docs.diagrams.delay.card1Title': 'Состояния загрузки',
  'workbench.docs.diagrams.delay.card1Example': 'Надёжно показать спиннеры',
  'workbench.docs.diagrams.delay.card2Title': 'Проверка debounce',
  'workbench.docs.diagrams.delay.card2Example': 'Тест троттлинга ввода',
  'workbench.docs.diagrams.delay.card3Title': 'Гонки',
  'workbench.docs.diagrams.delay.card3Example': 'Выявить порядок запросов',
  'workbench.docs.diagrams.delay.card4Title': 'Медленная сеть',
  'workbench.docs.diagrams.delay.card4Example': 'Задержка примерно как у 3G',
  'workbench.docs.diagrams.delay.useCasesFooter':
    'Статическим ресурсам нужен настоящий прокси — расширения их не удержат.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Добавить / Заменить · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'параметр добавлен или заменён',
  'workbench.docs.diagrams.queryParams.addStamp': 'Добавляет, если нет; заменяет, если есть.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Только заменить — заменяет значения существующих параметров запроса, но не трогает URL-адреса без этого параметра.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Только заменить · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Есть',
  'workbench.docs.diagrams.queryParams.presentSub': 'параметр уже там',
  'workbench.docs.diagrams.queryParams.absent': 'Нет',
  'workbench.docs.diagrams.queryParams.absentSub': 'параметра region нет',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'значение заменено',
  'workbench.docs.diagrams.queryParams.unchanged': 'без изменений',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    'Заменяет, никогда не добавляет — URL-адреса без параметра проходят как есть.',
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Удалить · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'параметр вырезан',
  'workbench.docs.diagrams.queryParams.removeStamp': 'Названный параметр удалён; всё остальное проходит как есть.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Удалить все',
  'workbench.docs.diagrams.queryParams.noQueryString': '(без строки запроса)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'вся строка запроса вырезана',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Вся строка запроса удалена за один шаг.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'Подвох параметров запроса — «Удалить все» нельзя сочетать с «Добавить / Заменить» в одном правиле.',
  'workbench.docs.diagrams.queryParams.watchForKicker': 'НА ЧТО СМОТРЕТЬ',
  'workbench.docs.diagrams.queryParams.combining': 'Сочетание «Удалить все» с «Добавить / Заменить»',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR отклоняет правила, которые вырезают всю строку запроса и добавляют новые параметры.',
  'workbench.docs.diagrams.queryParams.suggestionText':
    'Используйте два правила — сначала «Удалить все», затем «Добавить / Заменить».',
  'workbench.docs.diagrams.queryParams.suggestionSub': 'Порядок правил важен; оба должны совпасть с одним запросом.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'Параметры запроса — частые случаи: принудительный флаг, канонизация значения, вырезание трекеров, режим приватности с удалением всего.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Принудительный флаг',
  'workbench.docs.diagrams.queryParams.card1Example': 'Добавить debug=true',
  'workbench.docs.diagrams.queryParams.card2Title': 'Канонизация',
  'workbench.docs.diagrams.queryParams.card2Example': 'Заменить только region',
  'workbench.docs.diagrams.queryParams.card3Title': 'Вырезать трекеры',
  'workbench.docs.diagrams.queryParams.card3Example': 'Удалить параметры utm_*',
  'workbench.docs.diagrams.queryParams.card4Title': 'Режим приватности',
  'workbench.docs.diagrams.queryParams.card4Example': 'Вырезать все строки запроса',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'Сочетайте с URL-шаблоном или Доменами, чтобы ограничить конкретными маршрутами.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'Конвейер перехвата тела запроса — вызов page.js входит в перехват движка скриптов, ветвится на ' +
    'преобразования Статическое / Динамическое / GraphQL, затем уходит в настоящую сеть.',
  'workbench.docs.diagrams.requestBody.pageSub': 'вызов fetch / XHR',
  'workbench.docs.diagrams.requestBody.intercept': 'Перехват',
  'workbench.docs.diagrams.requestBody.interceptSub': 'монки-патч расширения',
  'workbench.docs.diagrams.requestBody.branchStatic': 'Статическое',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'заменить тело',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'целиком',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Динамическое',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'изменённое тело',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': 'операция совпала? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'применить : пропустить',
  'workbench.docs.diagrams.requestBody.realNetwork': 'настоящая сеть',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'ИСХОДНОЕ ТЕЛО',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'ОТПРАВЛЕННОЕ ТЕЛО',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Статическое тело: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'тело подменено целиком',
  'workbench.docs.diagrams.requestBody.staticStamp': 'Всё тело заменено; правило никогда не смотрит на исходное.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Динамическое тело: fn(orig) → с отметкой',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn читает и переписывает',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'функция преобразует',
  'workbench.docs.diagrams.requestBody.dynamicStamp': 'Функция получает исходное тело и возвращает новое.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'Фильтр GraphQL — правило срабатывает, только когда названное поле JSON-тела совпадает. Остальные операции проходят ' +
    'нетронутыми.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Равно "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ подмена статическим телом',
  'workbench.docs.diagrams.requestBody.match': 'Совпадение',
  'workbench.docs.diagrams.requestBody.noMatch': 'Нет совпадения',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'любая другая операция',
  'workbench.docs.diagrams.requestBody.ruleFires': 'правило срабатывает',
  'workbench.docs.diagrams.requestBody.passesThrough': 'проходит как есть',
  'workbench.docs.diagrams.requestBody.graphqlStamp':
    'Фильтр на уровне поля — применяется только к совпавшим операциям.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    'Запросы без нужных полей или с телом не в JSON пропускают правило.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Правила тела срабатывают только на fetch/XHR, инициированных JS, с телом. У запросов GET и HEAD нечего ' +
    'заменять; статические ресурсы никогда не входят в перехват скриптом.',
  'workbench.docs.diagrams.requestBody.getHead': 'Запросы GET / HEAD',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'По спецификации без тела — нечего заменять.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Статические ресурсы (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Их выпускает браузер — fetch / XHR не затрагиваются.',
  'workbench.docs.diagrams.requestBody.suggestionText': 'Убедитесь, что запрос — POST/PUT/PATCH из JS страницы.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'Тело запроса — частые случаи: тестовые фикстуры, отметка метаданных, имитация операций GraphQL, анонимизация ' +
    'PII.',
  'workbench.docs.diagrams.requestBody.card1Title': 'Тестовые фикстуры',
  'workbench.docs.diagrams.requestBody.card1Example': 'Задать известную полезную нагрузку',
  'workbench.docs.diagrams.requestBody.card2Title': 'Отметить метаданные',
  'workbench.docs.diagrams.requestBody.card2Example': 'Добавить debug: true',
  'workbench.docs.diagrams.requestBody.card3Title': 'Операции GraphQL',
  'workbench.docs.diagrams.requestBody.card3Example': 'Имитировать один operationName',
  'workbench.docs.diagrams.requestBody.card4Title': 'Подготовка повтора',
  'workbench.docs.diagrams.requestBody.card4Example': 'Анонимизировать поля PII',
  'workbench.docs.diagrams.requestBody.useCasesFooter':
    'Только движок скриптов — применяется к fetch / XHR, инициированным JS.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'позже',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'Режим отладки живёт в футере — встроенный переключатель включает его; точка и подпись открывают поповер с ' +
    'областью, закреплением по вкладкам и списком подключённых вкладок.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'Режим отладки живёт в футере',
  'workbench.docs.diagrams.debugMode.surfaceCaption': 'Переключатель включает его · точка + подпись открывают поповер.',
  'workbench.docs.diagrams.debugMode.debugMode': 'Режим отладки',
  'workbench.docs.diagrams.debugMode.systemStatus': 'Состояние системы',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Подключать к',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Обе ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Включить эту вкладку',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Подключённые вкладки (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Вкладка #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'Набор подключённых вкладок выводится: выбранная область объединяется с закреплёнными вкладками и пересекается с главным ' +
    'переключателем. При выключенном режиме отладки ничего не подключается.',
  'workbench.docs.diagrams.debugMode.scopeTitle': 'Что подключается',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( область ∪ закреплённые ) ∩ главный переключатель',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Подключать к: Обе',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ вкладка в фокусе',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Закреплена: вкладка #11',
  'workbench.docs.diagrams.debugMode.candidates': 'кандидаты',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Отладка ВКЛ',
  'workbench.docs.diagrams.debugMode.attached': 'Подключены',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Вкладка #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Вкладка #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': 'Отладка ВЫКЛ → ничего не подключается, какой бы ни была область.',
  'workbench.docs.diagrams.debugMode.scopeFooter2':
    'Повторное подключение воспроизводится отсюда — никогда из сохранённого снимка.',
  'workbench.docs.diagrams.debugMode.reachAria':
    'Стандартный режим дотягивается только до fetch и XHR страницы. Подключённая вкладка в режиме отладки дотягивается также до навигаций, ' +
    'воркеров, iframe из других источников и окружения вкладки.',
  'workbench.docs.diagrams.debugMode.reachTitle': 'До чего дотягивается каждый режим',
  'workbench.docs.diagrams.debugMode.standardMode': 'Стандартный режим',
  'workbench.docs.diagrams.debugMode.rowFetch': 'fetch / XHR страницы',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Навигации',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Воркеры',
  'workbench.docs.diagrams.debugMode.rowIframes': 'iframe из других источников',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'Окружение вкладки',
  'workbench.docs.diagrams.debugMode.bannerFree': 'без баннера',
  'workbench.docs.diagrams.debugMode.showsBanner': 'показывает баннер',
  'workbench.docs.diagrams.debugMode.statesAria':
    'У точки четыре состояния: серая — выключен, зелёная — включён и подключён, жёлтая — перешла на эвристику после закрытия ' +
    'баннера, красная — вкладку не удалось подключить.',
  'workbench.docs.diagrams.debugMode.statesTitle': 'Точка с одного взгляда',
  'workbench.docs.diagrams.debugMode.stateOff': 'Выключен',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'режим отладки выключен',
  'workbench.docs.diagrams.debugMode.stateOn': 'Включён · вкладок: 2',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'подключён и исправен',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'Откат',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'баннер закрыт → эвристика',
  'workbench.docs.diagrams.debugMode.stateFailed': 'Сбой подключения',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': 'не удалось задействовать протокол',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Две фазы каждого соединения — запрос и ответ — у каждой свои захваченные поля.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'У каждого соединения две фазы',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'ЗАПРОС',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Страница → Сеть',
  'workbench.docs.diagrams.requestTracking.outbound': 'исходящий',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Метод',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'Заголовки',
  'workbench.docs.diagrams.requestTracking.capBody': 'Тело',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'ОТВЕТ',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Сеть → Страница',
  'workbench.docs.diagrams.requestTracking.inbound': 'входящий',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Код статуса',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Тайминги',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'на каждый HTTP-обмен',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'ЗАХВАЧЕНО',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'то же соединение',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    'Обе фазы дают данные для счётчика значка на вкладке «Эта страница».',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Диаграмма последовательности: запрос замечен, сопоставлен, записан, затем прочитан всплывающим окном',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Браузер',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'сетевой стек',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Расширение',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'сервис-воркер',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Всплывающее окно',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'вкладка «Эта страница»',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (запрос)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'сверка с правилами',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'запись (правило + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'тип ресурса)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (ответ)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'запись фазы ответа',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'пользователь открывает окно',
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'совпавшие правила + значки',
  'workbench.docs.diagrams.requestTracking.seqFooter': 'Запись идёт вживую; всплывающее окно лишь читает её.',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'Анатомия UI — свёрнутый значок раскрывается в список совпавших запросов',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Строка правила во всплывающем окне',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Блокировка ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'нажмите значок',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'совпало: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'время · URL · тип ресурса · совпавший шаблон',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'число на значке = число строк',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Анатомия типов ресурсов — стилизованный макет страницы с выносками к каждому ResourceType браузера Chrome: Page, ' +
    'Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Каждый вид запроса соответствует одному ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'ЛЕГЕНДА',
  'workbench.docs.diagrams.resourceTypes.footer': 'Каждая запись соответствует 1:1 — строки не пересекаются.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'Частые ограничения — слепое пятно DevTools для изменённых заголовков; движок скриптов видит только fetch/XHR; ' +
    'Объединить видит только заголовки, заданные страницей; сопоставление заголовков требует Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'ЧАСТЫЕ ПОДВОХИ',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'Слепота DevTools',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Вкладка Network показывает',
  'workbench.docs.diagrams.limitations.devtoolsLine2': 'исходные заголовки.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Охват Script',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Только fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'без навигации и статики.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Область Объединить',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Видит только заголовки,',
  'workbench.docs.diagrams.limitations.mergeLine2': 'заданные кодом страницы.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': 'Старые браузеры',
  'workbench.docs.diagrams.limitations.chromeLine2': 'пропускают заголовки.',
  'workbench.docs.diagrams.limitations.seeCallout': 'См. врезку ниже.',
  'workbench.docs.diagrams.limitations.footer': 'Каждый подвох отмечен и внутри раздела, которого он касается.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Где каждый движок перехватывает поток запросов — JS идёт через Script, затем DNR; статика и ' +
    'навигация минуют Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Где перехватывает каждый движок',
  'workbench.docs.diagrams.execution.stackJsLane': 'Инициировано JS',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Статика / навигация',
  'workbench.docs.diagrams.execution.stackPageJs': 'JS страницы',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Браузер',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, навигация и т. д.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Движок скриптов',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'монки-патч',
  'workbench.docs.diagrams.execution.stackBypasses1': 'минует',
  'workbench.docs.diagrams.execution.stackBypasses2': 'движок скриптов',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'Движок DNR',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'сеть Chrome — ловит всё',
  'workbench.docs.diagrams.execution.stackNetwork': 'Сеть',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR широк; Script узок, но умеет читать тела ответов.',
  'workbench.docs.diagrams.execution.dnrAria':
    'Широкая область действия DNR — перехватывается каждый тип ресурса, который запрашивает браузер',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR ловит каждый вид запроса',
  'workbench.docs.diagrams.execution.dnrItemNav': 'навигация страницы',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'вложенный фрейм',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'скрипты',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'таблицы стилей',
  'workbench.docs.diagrams.execution.dnrItemImages': 'изображения',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'шрифты',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'медиа',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'каждый тип ресурса, который запрашивает браузер',
  'workbench.docs.diagrams.execution.reachAria': 'Область действия движка скриптов — что он ловит и что его минует',
  'workbench.docs.diagrams.execution.reachTitle': 'Что на самом деле видит движок скриптов',
  'workbench.docs.diagrams.execution.reachCaught': '✓ поймано',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'движок это видит',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'fetch SW',
  'workbench.docs.diagrams.execution.reachInScope': '(в области)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ мимо',
  'workbench.docs.diagrams.execution.reachMissedSub': 'минует полностью',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'навигация страницы',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'внутренние запросы браузера',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon и т. д.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria':
    'Прямые и косвенные совпадения — одно правило, два контекста страницы',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Правило',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Домены запроса: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Прямое',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'совпадает сам URL-адрес страницы',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'страница',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Страница + подресурсы',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'того же хоста отслеживаются',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'значок:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'прямое',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'косвенное',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Косвенное',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'совпадает только подресурс',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Отслеживается только',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'совпавший подресурс',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'совпадает с правилом',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'не совпадает',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    'Статический полностью минует сеть; Динамический сначала идёт в неё, затем преобразует настоящий ответ.',
  'workbench.docs.diagrams.mock.flowStatic': 'Статический',
  'workbench.docs.diagrams.mock.flowDynamic': 'Динамический',
  'workbench.docs.diagrams.mock.flowIntercept': 'Перехват',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(настоящая сеть',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'не задействована)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'настоящая сеть',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'настоящий ответ',
  'workbench.docs.diagrams.mock.flowSynthetic': 'синтетическое тело',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'страница получает',
  'workbench.docs.diagrams.mock.staticRule': 'Статический ответ: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'НАСТОЯЩАЯ СЕТЬ',
  'workbench.docs.diagrams.mock.staticNever1': '(не достигнута)',
  'workbench.docs.diagrams.mock.staticNever2': '— запрос замкнут накоротко',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'СТРАНИЦА ПОЛУЧАЕТ',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'отдан синтетический ответ',
  'workbench.docs.diagrams.mock.staticStamp': 'Фиксированные тело + статус + заголовки — сервер не задействован.',
  'workbench.docs.diagrams.mock.dynamicRule': 'Динамический ответ: скрыть поля PII',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'НАСТОЯЩИЙ ОТВЕТ',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[redacted]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(настоящий ответ) →',
  'workbench.docs.diagrams.mock.dynamicStamp': 'Настоящий вызов всё равно происходит; ваша функция переписывает тело.',
  'workbench.docs.diagrams.mock.wontAria':
    'Имитации перехватывают только fetch / XHR, инициированные JS — статические ресурсы проходят без изменений. Для фикстур ' +
    'подресурсов используйте настоящий локальный прокси.',
  'workbench.docs.diagrams.mock.wontStatic': 'Статические ресурсы (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Их выпускает браузер — fetch / XHR не затрагиваются.',
  'workbench.docs.diagrams.mock.wontNav': 'Навигации страниц',
  'workbench.docs.diagrams.mock.wontNavSub': 'Загрузки HTML верхнего уровня полностью минуют движок скриптов.',
  'workbench.docs.diagrams.mock.suggestionText': 'Для фикстур подресурсов используйте настоящий локальный прокси.',
  'workbench.docs.diagrams.mock.useCasesAria':
    'Тело + статус ответа — частые случаи: офлайн-разработка, имитация ошибок, скрытие PII, крайние формы ' +
    'полезной нагрузки.',
  'workbench.docs.diagrams.mock.caseOffline': 'Офлайн-разработка',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'Заглушить весь API',
  'workbench.docs.diagrams.mock.caseError': 'Имитация ошибок',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Отдать 500 на одном маршруте',
  'workbench.docs.diagrams.mock.casePii': 'Скрытие PII',
  'workbench.docs.diagrams.mock.casePiiEx': 'Замаскировать email на проводе',
  'workbench.docs.diagrams.mock.caseEdge': 'Крайние случаи',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Пустые массивы, огромные тела',
  'workbench.docs.diagrams.mock.useCasesFooter':
    'Статический = режим фикстуры · Динамический = настоящий вызов + правка.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Области фокуса рабочей среды — левая боковая панель, редактор, правая боковая панель и нижняя панель — у каждой ' +
    'подписано своё сочетание для фокуса.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Сочетания фокуса переносят вас в одну из четырёх областей',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Левая панель',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Редактор',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Правая панель',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Нижняя панель',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Переназначьте любое сочетание в настройках «Клавиатура».',

  // ── Wire mirrors (whole-raw in every locale) ────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
