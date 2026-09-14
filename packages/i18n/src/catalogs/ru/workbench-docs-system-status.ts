/**
 * Workbench Docs panel — the System Status section body — Russian.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals and state tokens ride raw (in `<code>` at
 * the render site) inside keyed prose; every pill MESSAGE string
 * (Connected to desktop, N active DNR rule(s), Last request:, All
 * host permissions granted, Schema drift: dropped entry from, N
 * workflows fresh, …) rides raw as a wire mirror (S18, ja / zh-CN /
 * ko parity). The six subsystem names quote `ru/shared-chrome.ts`
 * (Синхронизация / Правила / Запросы / Разрешения / Секреты / Live —
 * the docs `liveName` is raw `Live` because the ru footer pill is
 * Live); the settings path quotes `ru/workbench-settings*.ts`
 * (Приложение › Данные › Экспорт диагностического журнала —
 * диагностический журнал = the Observability log in prose too);
 * Отправить = the Send button (editors); индикатор = pill; подсистема
 * = subsystem; жизненный цикл / предел / экстрактор / сервис-воркер /
 * рабочий процесс carried. MINTS: исполнитель = executor;
 * экспоненциальная задержка = exponential backoff; гидратация =
 * hydrate; расхождение = drift (carried from spec); шифротекст =
 * cipher; периодичность = cadence; свежий / устаревший / сбоящий =
 * fresh / stale / failing; три зоны = three-zone. State-row bodies
 * after a raw message label open with a dash or a parenthesis as en
 * does (the render site joins with a space); the fragment after a
 * code chip joined with no space opens with `,` per en.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'Состояние системы',
  'workbench.docs.body.systemStatus.intro1':
    '— это живой снимок здоровья расширения. Футер рабочей среды показывает его строкой из шести индикаторов — по одному ' +
    'на подсистему, у каждого своя цветная точка. Всплывающее окно и боковая панель сворачивают его до одной записи',
  'workbench.docs.body.systemStatus.intro1Suffix':
    'в своём нижнем футере, и цвет точки следует за подсистемой в худшем состоянии.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    'В рабочей среде строка находится в футере, по одному индикатору на подсистему.',
  'workbench.docs.body.systemStatus.popupCaption':
    'Нажмите значок на панели инструментов — то же состояние появится одним подписанным индикатором в футере всплывающего окна.',
  'workbench.docs.body.systemStatus.worstLevel1':
    'Каждая подсистема сообщает одно состояние, и побеждает худший уровень: красный > жёлтый > зелёный. Один красный где угодно ' +
    'делает сводную точку красной.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Шесть состояний подсистем сворачиваются в одно сводное через максимум — красный бьёт жёлтый, жёлтый бьёт зелёный.',
  'workbench.docs.body.systemStatus.popover1':
    'Нажатие на любой индикатор открывает один и тот же поповер с подробностями. Строки идут двумя группами: сначала серые (событий ' +
    'за эту жизнь сервис-воркера ещё не было), затем цветные (сообщали хотя бы раз). Внутри каждой группы ' +
    'сохраняется канонический порядок подсистем. Полная история живёт в диагностическом журнале — экспортируйте из раздела',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Приложение › Данные › Экспорт диагностического журнала',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Серые над разделителем, цветные под ним; при первом сообщении строка переезжает один раз.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'зелёный',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'жёлтый',
  'workbench.docs.body.systemStatus.stateRedLabel': 'красный',
  'workbench.docs.body.systemStatus.syncName': 'Синхронизация',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Соединение с настольным приложением',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Отражает соединение WebSocket между сервис-воркером расширения и настольным приложением OpenHeaders, ' +
    'запущенным на вашей машине. Связь только через loopback (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') и несёт динамические переменные, данные командных рабочих пространств и присутствие — ничто не покидает ваше устройство.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Одно соединение WebSocket между расширением и настольным приложением на localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'Индикатор отражает живое состояние соединения. Разрыв запускает переподключения с экспоненциальной задержкой; периодические ' +
    'пинги обнаруживают тихие разрывы за строгими корпоративными прокси.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled и Connected — зелёные; Connecting, Reconnecting и URL rejected — жёлтые.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(рукопожатие удалось) или',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(автоподключение выключено).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': 'или',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Зарезервирован для фатальных сбоев синхронизации с настольным приложением; сегодня ни один путь кода его не выдаёт.',
  'workbench.docs.body.systemStatus.rulesName': 'Правила',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'Движок declarativeNetRequest',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Сообщает о каждой пересборке DNR. Каждое сохранение прогоняет ваше правило через четыре этапа, прежде чем оно вступит в силу: ' +
    'компиляция в DNR JSON, разрешение ссылок',
  'workbench.docs.body.systemStatus.rules1Middle':
    ', соблюдение предела активных правил, затем применение через браузер Chrome и его',
  'workbench.docs.body.systemStatus.rules1Suffix': 'API. Каждый этап может переключить индикатор.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Четыре этапа — каждый может выдать уровень состояния, если что-то пойдёт не так.',
  'workbench.docs.body.systemStatus.rules2':
    'Число активных правил соответствует состоянию на полосе ёмкости из трёх зон. Правила сверх предела отбрасываются в ' +
    'порядке сопоставления (верхние побеждают), а жёлтое сообщение несёт число отброшенных.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Зелёный до порога предупреждения, жёлтый до предела, красный дальше — но усечение не пускает вас в ' +
    'красную зону во время работы.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'или',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Неразрешённые ссылки',
  'workbench.docs.body.systemStatus.rulesYellowRefs': '(',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), превышен предел правил (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': ') или вы приближаетесь к ёмкости DNR (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Сбой транспорта — Chrome отклонил обновление динамических или сеансовых правил (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Запросы',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'Исполнитель API-запросов',
  'workbench.docs.body.systemStatus.requests1Prefix': 'Отражает последний разовый API-запрос, отправленный кнопкой',
  'workbench.docs.body.systemStatus.requestsSend': 'Отправить',
  'workbench.docs.body.systemStatus.requests1Middle': 'редактора запросов. Индикатор становится зелёным на',
  'workbench.docs.body.systemStatus.requestsAny': 'любой',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP-ответ — включая 4xx и 5xx — потому что «запрос завершился» и «серверу понравилось» — разные ' +
    'вопросы. Жёлтым его делают только сбои сетевого уровня без ответа.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Любой код статуса = зелёный. Жёлтый зарезервирован для сбоев без ответа.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    'Фоновый трафик этот индикатор не обновляет: обновления рабочих процессов Live передают',
  'workbench.docs.body.systemStatus.requests2Suffix':
    ', а запросы веб-страниц идут через движок правил, а не через исполнитель.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Только разовый трафик кнопки «Отправить» формирует этот индикатор — всё остальное молчит.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— любой HTTP-ответ (например,',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— сбой сетевого уровня до ответа (например,',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', офлайн/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Разрешения',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Аудит разрешений на хосты',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    'DNR-правила и content script, нацеленные на хост, доступ к которому отозван в',
  'workbench.docs.body.systemStatus.permissions1Middle':
    ', не выдают ошибку — они молча ничего не делают. Вся задача этого аудита — вытащить это скрытое состояние наружу, ' +
    'иначе вы потратите 30 минут на отладку правила, которое',
  'workbench.docs.body.systemStatus.permissionsLooks': 'выглядит',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'исправным.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Выдано: правило срабатывает. Сужено: правило молча ничего не делает, и заголовок так и не приходит.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'Аудит опрашивает',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'при каждом пробуждении сервис-воркера. В MV3 в Chromium нет наблюдателя за изменением разрешений, так что опрос при пробуждении — ' +
    'самый дешёвый доступный сигнал.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'Один вызов, три ветки — зелёный, если выдано, красный, если сужено, жёлтый, если сам API-вызов не удался.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'по-прежнему в области действия.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '— необычно; браузер не открыл',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— некоторые правила будут молча бездействовать на отозванных хостах, пока доступ не будет восстановлен в',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'Секреты',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Целостность vault',
  'workbench.docs.body.systemStatus.secrets1Prefix':
    'Отслеживает зашифрованный блоб vault каждого рабочего пространства в',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. При каждом пробуждении сервис-воркера каждый сохранённый секрет проверяется по текущей схеме; записи, ' +
    'не прошедшие проверку, выбрасываются из vault в памяти, и индикатор становится жёлтым, пока их ' +
    'не сохранят заново.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'Гидратация загружает блоб; валидатор схемы оставляет совпавшие, выбрасывает расхождения и сообщает жёлтым.',
  'workbench.docs.body.systemStatus.secrets2':
    '«Расхождение» обычно означает, что сохранённая запись была записана старой сборкой (без поля, которое теперь ' +
    'обязательно, или с полем неверного типа). Задача валидатора — отказывать громко: молчаливое наследование ' +
    'неизвестных форм и есть то, что вызывает ошибку шесть версий спустя.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Те же два поля рядом: корректная запись против записи с расхождением — без шифротекста и с неверно типизированным ' +
    'createdAt.',
  'workbench.docs.body.systemStatus.secretsGreen':
    'По умолчанию — событий расхождения схемы за эту жизнь сервис-воркера не было.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '— хотя бы одна сохранённая запись vault не совпала с текущей формой и была выброшена при гидратации. Повторное сохранение ' +
    'из редактора Vault восстанавливает её.',
  'workbench.docs.body.systemStatus.secretsRed':
    'Зарезервирован для сбоев расшифровки шифротекста; сегодня ни один путь кода его не выдаёт.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Обновление рабочих процессов переменных Live',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Каждый рабочий процесс Live обновляется со своей периодичностью. Состояние каждого рабочего процесса зависит от трёх проверок: удался ли ' +
    'последний экстрактор, укладывается ли запуск в',
  'workbench.docs.body.systemStatus.live1Suffix':
    'своей периодичности и сколько сбоев подряд у него было. Три состояния сворачиваются в индикатор по принципу ' +
    '«худший побеждает».',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Свежий = чистый запуск · устаревший = дольше 2× периодичности или 1–4 сбоя · сбоящий = ≥ 5 сбоев подряд.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Учитываются только рабочие процессы',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': 'активного рабочего пространства',
  'workbench.docs.body.systemStatus.live2Suffix':
    '. Неактивные рабочие пространства исключены — вы не видите их правила и не можете на них влиять прямо ' +
    'сейчас, так что индикатор по ним показывал бы шум, до которого вам не добраться. Переключение рабочего пространства пересчитывает индикатор ' +
    'по новому активному набору.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Рабочие процессы активного рабочего пространства сворачиваются в один индикатор через max(); остальные рабочие пространства пропускаются.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '— последний запуск каждого рабочего процесса активного рабочего пространства прошёл успешно и уложился в 2× его периодичности. Также показывается как',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': ', когда их нет.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— хотя бы один запуск вышел за 2× периодичности, последний экстрактор не удался или было 1–4 сбоя подряд.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— какой-то один рабочий процесс перешёл порог в пять сбоев подряд и теперь считается сбоящим.',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Настольное приложение — заметка о продукте',
  'workbench.docs.body.systemStatus.desktopNote1':
    'Настольное приложение в разработке и выходит после стабилизации расширения. Рабочие пространства, переменные и ' +
    'командная синхронизация, интегрированные с настольным приложением, откроются тогда. Подсистема',
  'workbench.docs.body.systemStatus.desktopNote2':
    'при первом запуске автоматически переходит из выключенного состояния в подключение — переустановка не нужна.',
} as const satisfies Catalog;
