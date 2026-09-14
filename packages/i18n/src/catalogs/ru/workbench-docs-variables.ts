/**
 * Workbench Docs panel — the Variables section body — Russian. Mirrors
 * `catalogs/en/workbench-docs-variables.ts` key for key. `{{ns.NAME}}`
 * reference tokens and scope names ride raw inside keyed prose (the
 * render site composes them as code chips). Quotes the shipped ru
 * mints: the scoping nouns from `workbench-chrome.ts`'s varScope
 * block (Vault raw / Окружение / Коллекция / Рабочее пространство,
 * пространство имён, без префикса = bare), the sidebar entries (Vault
 * / «Переменные рабочего пространства» / «Переменные Live» /
 * «Окружения» / «Переменные» — the resolution-hints quotes), Переменные
 * = the tool window, перекрыт = shadowed (popup), рабочий процесс Live
 * / шаг / экстрактор / захват / опубликовать = publish carried,
 * Отправить = Send, Статические данные / Динамически = the
 * request-body modes, Динамически (JavaScript) = the mode label.
 * MINTS: обход = the walk (навигация stays navigation); лестница =
 * ladder; **В области / Все области = In scope / All scopes** (the
 * Variables tool-window tabs — `workbench-variables.ts` MUST reuse);
 * раскрыть = expose (a capture; раскрываемый = marked as exposed);
 * подсказчик = suggester; устаревший = stale carried. Section
 * headings keep the structural ` — ` as the label separator; prose
 * keeps it as the native aside dash. A fragment joined to a preceding
 * code chip with no space opens with `.` / `,` per en, never with a
 * case ending; holes take a head noun.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Любое поле с шаблонами — значение заголовка, URL-адрес перенаправления, тело запроса, шаг рабочего процесса — может ' +
    'ссылаться на переменную через',
  'workbench.docs.body.variables.intro1Suffix':
    '. Значение подставляется в момент использования, так что одно определение питает каждое правило, запрос и рабочий процесс, ' +
    'которые его упоминают. Переменные живут в пяти областях, у каждой свой дом в приложении и свой ранг, ' +
    'когда одно имя существует больше чем в одной.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'Ссылка без префикса',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'обходит четыре области сверху вниз и останавливается на первом попадании. Live и другие области с пространством имён стоят ' +
    'вне обхода.',
  'workbench.docs.body.variables.scopesHeading': 'Пять областей',
  'workbench.docs.body.variables.vaultHeading': 'Vault — секреты, только это устройство',
  'workbench.docs.body.variables.vault1Prefix':
    'Vault хранит секреты устройства: API-ключи, пароли, seed для TOTP. Записи vault никогда не синхронизируются и ' +
    'никогда не покидают устройство — они не попадают в экспорт рабочего пространства и историю git. Есть два вида:',
  'workbench.docs.body.variables.vaultKindString': 'строковые',
  'workbench.docs.body.variables.vault1Middle': 'записи разрешаются дословно, а записи',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'разрешаются в текущий код из 6–8 цифр, вычисленный из сохранённого seed, — сам seed через шаблон никогда ' +
    'не раскрывается. Vault стоит выше всех, поэтому секрет vault всегда выигрывает ссылку без префикса.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Ссылайтесь на секрет через',
  'workbench.docs.body.variables.vaultCaptionSuffix':
    'из синхронизируемых сущностей — никогда не вставляйте само значение.',
  'workbench.docs.body.variables.environmentHeading': 'Окружение — переключаемые наборы значений',
  'workbench.docs.body.variables.environment1Prefix':
    'Окружения — именованные наборы переменных, которые вы меняете целиком —',
  'workbench.docs.body.variables.environment1Suffix':
    ', локальная настройка коллеги. Активное окружение выбирается в селекторе заголовка; имя, которого активное ' +
    'окружение не определяет, откатывается к окружению по умолчанию, прежде чем обход продолжится вниз. ' +
    'Работа без выбранного окружения — допустимое состояние: разрешение просто пропускает область. Строки можно ' +
    'пометить как секретные, чтобы их значения показывались замаскированными в редакторе.',
  'workbench.docs.body.variables.environmentCaption':
    'Одно имя, значение на каждую стадию — переключайте окружение вместо дублирования правил.',
  'workbench.docs.body.variables.collectionHeading': 'Коллекция — в рамках одной коллекции',
  'workbench.docs.body.variables.collection1':
    'Переменные коллекции определяются в коллекции и разрешаются только для правил и запросов, которые ' +
    'ей принадлежат. Это правильный дом для значений, верных для одного API, но не для всего рабочего пространства, ' +
    '— базовый URL-адрес, идентификатор арендатора, префикс версии.',
  'workbench.docs.body.variables.collectionCaption':
    'Переменные коллекции разрешаются только внутри своей коллекции — в других местах обход проходит мимо них.',
  'workbench.docs.body.variables.workspaceHeading': 'Рабочее пространство — общее для всех',
  'workbench.docs.body.variables.workspace1':
    'Переменные рабочего пространства — глобальные для всего пространства: видны каждому правилу, запросу и рабочему процессу ' +
    'и синхронизируются вместе с пространством. Их ранг самый низкий, что делает их естественным базовым слоем: положите ' +
    'общее значение сюда и дайте окружению или коллекции переопределить его там, где нужно.',
  'workbench.docs.body.variables.workspaceCaption':
    'Базовый слой — для значений, верных везде. Не для секретов и не для значений по стадиям.',
  'workbench.docs.body.variables.liveHeading': 'Live — публикуется запуском рабочего процесса',
  'workbench.docs.body.variables.live1Prefix':
    'За переменной Live стоит рабочий процесс Live — цепочка запросов, которая выполняет вход, получает токен и ' +
    'раскрывает захваченное значение. Сохранение рабочего процесса активирует его; успешный запуск (ручной или по расписанию) ' +
    'публикует раскрытое значение, а автообновление перезапускает рабочий процесс, чтобы оно оставалось свежим. Значения Live ' +
    'доступны только как',
  'workbench.docs.body.variables.live1Suffix':
    '— никогда через ссылку без префикса, — чтобы шаблон правила не мог молча подхватить значение обновления в полёте, ' +
    'когда переменная рабочего пространства или окружения носит то же имя. Правка рецепта рабочего процесса помечает ' +
    'опубликованное значение устаревшим до следующего запуска.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Всегда с префиксом —',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '— и всегда из рабочего процесса, никогда не вставленный токен.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': 'Запуск удался → раскрытый захват публикуется как',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ правила и запросы используют его. Расписание перезапускает рабочий процесс.',
  'workbench.docs.body.variables.priorityHeading': 'Приоритет и перекрытие',
  'workbench.docs.body.variables.priority1Prefix': 'Ссылка без префикса',
  'workbench.docs.body.variables.priority1Suffix':
    'разрешается через четыре настоящие области в строгом порядке — vault, затем активное окружение (с ' +
    'откатом к окружению по умолчанию), затем коллекция, затем рабочее пространство — и останавливается на первой области, ' +
    'которая определяет имя. Нижние определения продолжают существовать; они просто перекрыты.',
  'workbench.docs.body.variables.shadowingCaptionPrefix':
    'Для ссылки без префикса окружение побеждает рабочее пространство;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'по-прежнему читает перекрытое значение.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'У каждой области есть и пространство имён, которое закрепляет разрешение за ней, минуя лестницу целиком:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Используйте форму без префикса в обычном случае и форму с пространством имён, когда имеете в виду конкретную область ' +
    'независимо от того, что определено выше неё.',
  'workbench.docs.body.variables.tipTitle': 'Держите секреты в vault',
  'workbench.docs.body.variables.tip1Prefix':
    'Правила, запросы и рабочие процессы синхронизируются с рабочим пространством — vault нет. Ссылайтесь на',
  'workbench.docs.body.variables.tip1Suffix':
    'из синхронизируемой сущности, и каждый коллега подставит своё значение локально; ничего чувствительного никогда не попадёт ' +
    'в общие данные.',
  'workbench.docs.body.variables.rulesHeading': 'Переменные в правилах',
  'workbench.docs.body.variables.rules1':
    'Почти каждая строка в правиле поддерживает шаблоны: значения условий (домены, URL-шаблоны, имена ' +
    'заголовков), значения заголовков, URL-адреса перенаправления, имена и значения параметров запроса, статические тела запроса и ответа, ' +
    'внедряемый код, полезные нагрузки WS / SSE и учётные данные Basic-аутентификации. Редактор правил подсвечивает каждую ' +
    'ссылку, показывает разрешённое значение при наведении и выводит баннер для любой ссылки, которая не разрешается, — ' +
    'неразрешённое правило не может вступить в силу, пока у каждой ссылки нет значения.',
  'workbench.docs.body.variables.consumersCaption':
    'Одно значение с шаблоном питает все три потребляющие поверхности — подставляется там, где применяется каждая.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Динамические (JS) тела не шаблонизируются',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Правила тела запроса и ответа в режиме',
  'workbench.docs.body.variables.dynamicWord': 'динамически',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'выполняют ваш JavaScript вместо подстановки шаблонов — код сам вычисляет свои значения. Только',
  'workbench.docs.body.variables.staticWord': 'статические',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'тела участвуют в подстановке ссылок',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'на переменные.',
  'workbench.docs.body.variables.requestsHeading': 'Переменные в запросах',
  'workbench.docs.body.variables.requests1Prefix':
    'В API-клиенте URL-адрес, параметры запроса, заголовки, поля авторизации и тело разрешаются при отправке — ' +
    'включая переменные коллекции, в которой живёт запрос. Ссылка, которую нельзя ' +
    'разрешить, блокирует отправку ошибкой с именем отсутствующей переменной, вместо того чтобы отправить в сеть литерал',
  'workbench.docs.body.variables.requests1Suffix': 'как есть.',
  'workbench.docs.body.variables.workflowsHeading': 'Переменные в рабочих процессах',
  'workbench.docs.body.variables.workflows1Prefix':
    'Каждый шаг рабочего процесса Live разрешается как запрос, плюс одна дополнительная область:',
  'workbench.docs.body.variables.workflows1Suffix':
    'ссылается на значение, захваченное более ранним шагом того же запуска — войдите на шаге 1, потратьте ' +
    'токен сеанса на шаге 2. Ссылки на шаги существуют только пока цепочка выполняется; захваты, помеченные как ' +
    'раскрываемые, и есть то, что публикуется как переменные Live при успешном запуске.',
  'workbench.docs.body.variables.namespacesHeading': 'Помощники только с пространством имён',
  'workbench.docs.body.variables.helpers1':
    'Ещё три пространства имён разрешают значения, которые вовсе не являются сохранёнными переменными.',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'запускает встроенный генератор —',
  'workbench.docs.body.variables.helpersFriends':
    ', и другие — выдавая свежее значение при каждом разрешении: на каждую отправку в API-клиенте, на каждую компиляцию ' +
    'для статических правил (значение запекается до следующей перекомпиляции).',
  'workbench.docs.body.variables.helpersFileMiddle': 'ссылается на сохранённый файл по имени. А',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', выше, имеет смысл только внутри выполняющейся цепочки рабочего процесса. Ни один из них не входит в обход без префикса — ' +
    'они доступны только через свой префикс.',
  'workbench.docs.body.variables.inspectingHeading': 'Создание и проверка',
  'workbench.docs.body.variables.create1Prefix': 'Каждая область создаётся из боковой панели:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Переменные рабочего пространства',
  'workbench.docs.body.variables.createAnd': 'и',
  'workbench.docs.body.variables.sidebarLiveVars': 'Переменные Live',
  'workbench.docs.body.variables.create1Middle': '— записи верхнего уровня; окружения добавляются в разделе',
  'workbench.docs.body.variables.sidebarEnvironments': 'Окружения',
  'workbench.docs.body.variables.create1Middle2': '; а у каждой коллекции есть собственная страница',
  'workbench.docs.body.variables.sidebarVariables': 'Переменные',
  'workbench.docs.body.variables.create1Suffix': 'внутри неё.',
  'workbench.docs.body.variables.creationMapCaption':
    'Каждый дом переменных в боковой панели с пометкой о пространстве имён, которое он питает.',
  'workbench.docs.body.variables.inspect1Prefix': 'Окно инструментов',
  'workbench.docs.body.variables.inspect1Middle': '— поверхность для проверки.',
  'workbench.docs.body.variables.inScopeLabel': 'В области',
  'workbench.docs.body.variables.inspect1Middle2':
    'перечисляет переменные, на которые действительно ссылается правило, запрос или шаблон в фокусе — каждая разрешена ' +
    'через полную лестницу, так что вы видите точное значение, которое применится.',
  'workbench.docs.body.variables.allScopesLabel': 'Все области',
  'workbench.docs.body.variables.inspect1Middle3':
    'перечисляет всё, что определено где угодно, сгруппированное по приоритету. В любом поле с шаблонами ввод',
  'workbench.docs.body.variables.inspect1Suffix':
    'открывает подсказчик со всеми разрешимыми именами, а наведение на ссылку показывает её разрешённое значение и ' +
    'победившую область.',
} as const satisfies Catalog;
