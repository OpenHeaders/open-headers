/**
 * Workbench live/workflows station — Russian. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Technical plane stays
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, policy
 * kind ids (expires-in / expires-at), duration values and relative-time
 * phrases interpolated as {when} / {countdown}, step ids / capture
 * names / workflow names, code examples ({"expires_in": 3600},
 * run_time + captured_seconds, epoch ms), MV3, `lead`, oh.* API names,
 * dependsOn, server error text ({error} / {message}); `id` / `Foreach`
 * / `Composite` / `AND` ride raw (ja / ko parity); the `liveTag` is
 * raw `Live` (the register's product noun). Quotes the shipped ru
 * mints: выключатель = the circuit (breaker) with «Повторить» /
 * «Сбросить выключатель» (workbench-chrome's workflowStatus info —
 * разомкнут / замыкает = open / closes), захват = capture, экстрактор,
 * политика повторов, упреждение = lead (shared-conflicts «секунды
 * упреждения обновления»), рабочий процесс / переменная Live
 * (sidebar, chrome), Обновить = Refresh (the rule editor quotes it),
 * опубликовать = publish, переопределение = override, простой = idle,
 * проверка = probe, экспоненциальная задержка = backoff (system-status),
 * Включено / Выключено = Enabled / Disabled, Исправно = healthy
 * (shared-chrome), Скрипты (the translated tab family), Регулярное
 * выражение (the Regex extractor), Код состояния = Status code.
 * MINTS: шаг-предок = ancestor step; условие запуска = run condition;
 * неявный / явный = implicit / explicit; лексикографический; условие =
 * a gate clause (the clause list IS the condition list); закреплённое
 * значение = the pinned override value; резолвер = resolver;
 * планировщик = scheduler; the circuit pills ИСПРАВНО / ПОВТОР /
 * ПРОВЕРКА / НА ПАУЗЕ keep en's caps (fr / de parity), their summary
 * rows read `{count} исправно / с повтором / на проверке / на паузе`.
 * Plurals one / few / many / other (сбоя / сбоев, условии / условиях,
 * шаг-предок / шага-предка / шагов-предков, переменная / переменные /
 * переменных, шаг / шага / шагов). The `{id}` / `{ref}` / `{stepId}`
 * holes take шаг / захват as head nouns or a colon frame (захватов:
 * {count}; приоритет: {ref}; порядок по {ref}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'простой',
  'workbench.editors.live.circuit.idleHint': 'Кеша ещё нет — запустите обновление, чтобы заполнить его.',
  'workbench.editors.live.circuit.pausedLabel': 'на паузе',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Выключатель разомкнут после {count} сбоя подряд. Автоматический повтор отложен. Нажмите «Повторить сейчас», чтобы обойти задержку.',
      few: 'Выключатель разомкнут после {count} сбоев подряд. Автоматический повтор отложен. Нажмите «Повторить сейчас», чтобы обойти задержку.',
      many: 'Выключатель разомкнут после {count} сбоев подряд. Автоматический повтор отложен. Нажмите «Повторить сейчас», чтобы обойти задержку.',
      other:
        'Выключатель разомкнут после {count} сбоев подряд. Автоматический повтор отложен. Нажмите «Повторить сейчас», чтобы обойти задержку.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'проверка…',
  'workbench.editors.live.circuit.probingHint':
    'Идёт проверочная попытка — одного успеха достаточно, чтобы замкнуть выключатель.',
  'workbench.editors.live.circuit.retryLabel': 'повтор {attempt} из 3',
  'workbench.editors.live.circuit.retryHint':
    'Уровень повторов до срабатывания выключателя — быстрые повторы с задержкой 5–10 с между попытками. После 3 сбоев подряд выключатель размыкается.',
  'workbench.editors.live.circuit.healthyLabel': 'исправно',
  'workbench.editors.live.circuit.healthyHint': 'Выключатель замкнут, недавних сбоев нет.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'последнее {when}',
  'workbench.editors.live.schedule.manualOnly': 'только ручное обновление',
  'workbench.editors.live.schedule.autoRefresh': 'автообновление {when}',
  'workbench.editors.live.schedule.expires': 'истекает {when}',
  'workbench.editors.live.policy.interval': 'каждые {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in из захвата {source} (упреждение {lead} с)',
  'workbench.editors.live.policy.expiresAt': 'expires-at из захвата {source} (упреждение {lead} с)',
  'workbench.editors.live.policy.manual': 'ручное обновление',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Завершён в последнем запуске',
  'workbench.editors.live.stepRun.failed': 'Последний запуск сбоил на этом шаге',
  'workbench.editors.live.stepRun.extractFailed': 'Ответ получен, но экстрактор захвата не совпал',
  'workbench.editors.live.stepRun.skipped': 'Пропущен по условию запуска в последнем запуске',
  'workbench.editors.live.stepRun.notRun': 'Ещё не входил в успешный запуск',
  'workbench.editors.live.maskEmpty': '(пусто)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Имя',
  'workbench.editors.live.form.descriptionPlaceholder': 'Описание (необязательно)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Источник не найден.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Выключено',
  'workbench.editors.live.variable.overrideTag': 'переопределение',
  'workbench.editors.live.variable.refresh': 'Обновить',
  'workbench.editors.live.variable.valueLabel': 'Значение',
  'workbench.editors.live.variable.neverRefreshed': '(ещё не обновлялось)',
  'workbench.editors.live.variable.nameLabel': 'Имя',
  'workbench.editors.live.variable.nameHint': 'Ссылка: {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Описание',
  'workbench.editors.live.variable.bindingSection': 'Привязка',
  'workbench.editors.live.variable.workflowLabel': 'Рабочий процесс',
  'workbench.editors.live.variable.stepLabel': 'Шаг',
  'workbench.editors.live.variable.captureLabel': 'Захват',
  'workbench.editors.live.variable.selectWorkflow': 'Выберите рабочий процесс',
  'workbench.editors.live.variable.selectStep': 'Выберите шаг',
  'workbench.editors.live.variable.selectCapture': 'Выберите захват',
  'workbench.editors.live.variable.stepOption': '{id} (захватов: {count})',
  'workbench.editors.live.variable.openFlow': 'Открыть процесс',
  'workbench.editors.live.variable.overrideSection': 'Ручное переопределение',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Фиксированное значение переопределения',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Истекает (ms)',
  'workbench.editors.live.variable.overrideExpiresHint':
    'Реальное время в epoch ms — оставьте пустым для постоянного переопределения',
  'workbench.editors.live.variable.applyOverride': 'Применить переопределение',
  'workbench.editors.live.variable.clearOverride': 'Очистить',
  'workbench.editors.live.variable.setOverride': 'Задать ручное переопределение',
  'workbench.editors.live.variable.overrideNote':
    'Резолвер отдаёт закреплённое значение; планировщик по-прежнему обновляет базовый рабочий процесс.',
  'workbench.editors.live.variable.deletedElsewhere': 'Источник удалён из другой вкладки',
  'workbench.editors.live.variable.saveFailed': 'Не удалось сохранить переменную Live',
  'workbench.editors.live.variable.refreshFailed': 'Обновление не удалось: {error}',
  'workbench.editors.live.variable.refreshed': 'Обновлено',
  'workbench.editors.live.variable.overrideSaveFailed': 'Не удалось сохранить переопределение.',
  'workbench.editors.live.variable.overrideApplied': 'Переопределение применено',
  'workbench.editors.live.variable.overrideCleared': 'Переопределение очищено',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'Новая переменная Live',
  'workbench.editors.live.create.namePlaceholder': 'Имя (например, accessToken)',
  'workbench.editors.live.create.referenceAs': 'Ссылка: {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Создать рабочий процесс',
  'workbench.editors.live.create.noWorkflows': 'Рабочих процессов пока нет.',
  'workbench.editors.live.create.nameRequired': 'Имя обязательно',
  'workbench.editors.live.create.bindingRequired': 'Выберите рабочий процесс, шаг и захват',
  'workbench.editors.live.create.createFailed': 'Не удалось создать переменную Live',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Включено',
  'workbench.editors.live.toggles.enabledTooltip':
    'Когда выключено, ссылки {{live.NAME}} перестают разрешаться в правилах и запросах.',
  'workbench.editors.live.toggles.waitForFresh': 'Ждать свежее значение',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'Перед применением правил дождаться, пока базовый рабочий процесс завершит обновление (до ~5 с). Выключено: правила используют последнее кешированное значение и обновляются в фоне — быстрее, но сразу после пробуждения расширения значение может быть ненадолго устаревшим.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Только вручную',
  'workbench.editors.live.refreshPolicy.interval': 'Фиксированный интервал',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Истекает через N секунд (относительно)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'Истекает в момент epoch ms (абсолютно)',
  'workbench.editors.live.refreshPolicy.leadUnit': 'упреждение, с',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Выберите захват',
  'workbench.editors.live.refreshPolicy.noCaptures': 'Захваты ещё не определены.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    'Интервалы короче минуты упираются в нижний предел будильников MV3 и быстро расходуют квоту. Используйте только при необходимости.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix':
    'Значение захвата = секунды до истечения (например, OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). Обновление запускается за `lead` секунд до',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Значение захвата = абсолютное время unix epoch в',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'миллисекундах',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix':
    '). Обновление запускается за `lead` секунд до этого момента.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    'Сначала добавьте в рабочий процесс захват, чтобы у расчёта истечения был источник.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'Редактор',
  'workbench.editors.live.workflow.viewPreview': 'Предпросмотр',
  'workbench.editors.live.workflow.refresh': 'Обновить',
  'workbench.editors.live.workflow.disabledTag': 'Выключено',
  'workbench.editors.live.workflow.notFound': 'Рабочий процесс не найден.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Рабочий процесс удалён из другой вкладки',
  'workbench.editors.live.workflow.saveFailed': 'Не удалось сохранить рабочий процесс',
  'workbench.editors.live.workflow.createFailed': 'Не удалось создать рабочий процесс',
  'workbench.editors.live.workflow.refreshed': 'Обновлено',
  'workbench.editors.live.workflow.refreshFailed': 'Обновление не удалось: {error}',
  'workbench.editors.live.workflow.defaultName': 'Рабочий процесс',
  'workbench.editors.live.workflow.newDraftName': 'Новый рабочий процесс',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'В рабочем процессе есть структурные проблемы',
  'workbench.editors.live.form.stepsTitle': 'Шаги ({count})',
  'workbench.editors.live.form.addStepButton': 'Шаг',
  'workbench.editors.live.form.noSteps':
    'Шагов пока нет — добавьте шаг, чтобы связать запрос и извлечение в этом рабочем процессе.',
  'workbench.editors.live.form.enabledAria': 'Рабочий процесс включён',
  'workbench.editors.live.form.enabled': 'Включено',
  'workbench.editors.live.form.disabled': 'Выключено',
  'workbench.editors.live.form.parallelLabel': 'Выполнять независимые шаги параллельно',
  'workbench.editors.live.form.parallelTooltip':
    'В v1 только последовательно. Параллельное выполнение появится в одном из следующих выпусков.',
  'workbench.editors.live.form.refreshPolicySection': 'Политика обновления',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Шаг {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'имя',
  'workbench.editors.live.step.typeTooltip':
    'Тип шага — типы Foreach и Composite появятся в одном из следующих выпусков.',
  'workbench.editors.live.step.typeRequest': 'Запрос',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'запуск при {count} условии',
      few: 'запуск при {count} условиях',
      many: 'запуск при {count} условиях',
      other: 'запуск при {count} условиях',
    }),
  'workbench.editors.live.step.priorityTag': 'приоритет: {ref}',
  'workbench.editors.live.step.scriptsTag': 'скрипты',
  'workbench.editors.live.step.selectRequest': 'Выберите запрос',
  'workbench.editors.live.step.descriptionPlaceholder': 'Описание шага (необязательно)',
  'workbench.editors.live.step.capturesHeader': 'ЗАХВАТЫ ({count})',
  'workbench.editors.live.step.addCapture': '+ Захват',
  'workbench.editors.live.step.captureRequired':
    'Нужен хотя бы один захват, прежде чем переменная Live сможет привязаться к этому шагу.',
  'workbench.editors.live.step.removeCaptureAria': 'Удалить захват {name}',
  'workbench.editors.live.step.exposeAria': 'Раскрыть захват {name} как переменную Live',
  'workbench.editors.live.step.exposeAs': 'Раскрыть как',
  'workbench.editors.live.step.exposeTooltip':
    'Когда включено, сохранение рабочего процесса создаёт переменную Live, которая разрешает `{{live.<name>}}` из этого захвата. Выключите, чтобы использовать захват только внутри этого рабочего процесса (например, через {{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ после {parents}',
  'workbench.editors.live.step.implicitMark': '(неявно)',
  'workbench.editors.live.step.implicitTooltip':
    'Неявная зависимость от предыдущего шага (явный dependsOn не объявлен). Задайте явный dependsOn, чтобы зафиксировать связь.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Зависит от',
  'workbench.editors.live.sections.dependsOnImplicit': '(неявно — предыдущий шаг)',
  'workbench.editors.live.sections.dependsOnRoot': '(корень)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Выберите шаги-предки — пусто = корневой шаг',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    'Явного dependsOn нет — шаг неявно зависит от предыдущего в порядке объявления.',
  'workbench.editors.live.sections.dependsOnRootHint': 'Явный корень — запускается сразу при старте рабочего процесса.',
  'workbench.editors.live.sections.useImplicit': 'Использовать неявную',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Шаг ждёт, пока {count} шаг-предок завершится или будет пропущен.',
      few: 'Шаг ждёт, пока {count} шага-предка завершатся или будут пропущены.',
      many: 'Шаг ждёт, пока {count} шагов-предков завершатся или будут пропущены.',
      other: 'Шаг ждёт, пока {count} шагов-предков завершатся или будут пропущены.',
    }),
  'workbench.editors.live.sections.reset': 'Сбросить',
  'workbench.editors.live.sections.runCondition': 'Условие запуска',
  'workbench.editors.live.sections.none': '(нет)',
  'workbench.editors.live.sections.priority': 'Приоритет',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Шаг-предок',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Имя захвата',
  'workbench.editors.live.sections.sortNumeric': 'Числовой',
  'workbench.editors.live.sections.sortLexicographic': 'Лексикографический',
  'workbench.editors.live.sections.priorityTooltip':
    'Когда следующими могут запуститься несколько шагов, первым идёт шаг с наименьшим значением приоритета. Шаги без значения идут последними.',
  'workbench.editors.live.sections.clear': 'Очистить',
  'workbench.editors.live.sections.retryPolicy': 'Политика повторов',
  'workbench.editors.live.sections.retrySummary': '(попыток: {count})',
  'workbench.editors.live.sections.retrySummaryExponential': '(попыток: {count}, экспоненциально)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Попытки',
  'workbench.editors.live.sections.attemptsPrefix': 'попытки',
  'workbench.editors.live.sections.delayPrefix': 'задержка ms',
  'workbench.editors.live.sections.backoffFixed': 'Фиксированная',
  'workbench.editors.live.sections.backoffExponential': 'Экспоненциальная',
  'workbench.editors.live.sections.retryOnNetwork': 'Только сетевые ошибки',
  'workbench.editors.live.sections.retryOn5xx': 'Сеть + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Сеть + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Сеть + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Своя (правится как данные)',
  'workbench.editors.live.sections.retryTooltip':
    'Сетевые сбои (DNS, соединение, тайм-аут) повторяются всегда, пока остаются попытки. Добавление совпадения по статусу повторяет и совпавшие ответы; ошибки извлечения не повторяются никогда. Очистите поле попыток, чтобы отключить повторы.',
  'workbench.editors.live.sections.timeout': 'Тайм-аут',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Без тайм-аута',
  'workbench.editors.live.sections.timeoutTooltip':
    'На каждую попытку — запрос (включая чтение тела) прерывается по достижении этого предела. Шаг с повторами получает полный тайм-аут на каждую попытку. Очистите поле, чтобы снять предел.',
  'workbench.editors.live.sections.scripts': 'Скрипты',
  'workbench.editors.live.sections.scriptsOn': '(вкл.)',
  'workbench.editors.live.sections.scriptsOff': '(выкл.)',
  'workbench.editors.live.sections.runScriptsAria': 'Выполнять скрипты запроса на этом шаге',
  'workbench.editors.live.sections.runScriptsLabel': 'Выполнять скрипты запроса до запроса / после ответа',
  'workbench.editors.live.sections.scriptsTooltip':
    'Выполняется при каждой попытке цепочки. Скрипты шага получают поверхность oh.* только для чтения (oh.sendRequest и oh.variables.set отклоняются). Ошибка скрипта или проваленная проверка oh.test приводит к сбою шага, так что последние удачные значения сохраняются — проверки решают, что публикует этот рабочий процесс. Нужна среда выполнения с поддержкой скриптов; на хостах без неё шаг выполняется без скриптов.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Статус',
  'workbench.editors.live.gate.kindCaptureExists': 'Захват существует',
  'workbench.editors.live.gate.kindCaptureEquals': 'Захват равен',
  'workbench.editors.live.gate.kindCaptureMatches': 'Захват совпадает',
  'workbench.editors.live.gate.kindNumericCompare': 'Числовое сравнение захвата',
  'workbench.editors.live.gate.kindInList': 'Захват в списке',
  'workbench.editors.live.gate.kindHeaderContains': 'Заголовок содержит',
  'workbench.editors.live.gate.futureNumericCompare': 'Числовое сравнение — появится в одном из следующих выпусков.',
  'workbench.editors.live.gate.futureInList': 'Совпадение по списку — появится в одном из следующих выпусков.',
  'workbench.editors.live.gate.futureHeaderContains': '«Заголовок содержит» — появится в одном из следующих выпусков.',
  'workbench.editors.live.gate.status2xx': '2xx (любой успех)',
  'workbench.editors.live.gate.status3xx': '3xx (перенаправление)',
  'workbench.editors.live.gate.status4xx': '4xx (ошибка клиента)',
  'workbench.editors.live.gate.status5xx': '5xx (ошибка сервера)',
  'workbench.editors.live.gate.statusEquals': 'равен…',
  'workbench.editors.live.gate.statusNotEquals': 'не равен…',
  'workbench.editors.live.gate.statusOneOf': 'один из…',
  'workbench.editors.live.gate.allAnd': 'Все (AND)',
  'workbench.editors.live.gate.anyOr': 'Любое (OR)',
  'workbench.editors.live.gate.orTooltip':
    'Логика OR появится в одном из следующих выпусков. Пока используйте несколько шагов со взаимоисключающими условиями.',
  'workbench.editors.live.gate.matchModesAria': 'О режимах совпадения',
  'workbench.editors.live.gate.noConditions': 'Условий нет — шаг запускается, как только завершатся его зависимости.',
  'workbench.editors.live.gate.conditionCount': 'условий: {count}',
  'workbench.editors.live.gate.addCondition': 'Добавить условие',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Шаг',
  'workbench.editors.live.gate.capturePlaceholder': 'Имя захвата',
  'workbench.editors.live.gate.equalsPlaceholder': 'Значение для сравнения',
  'workbench.editors.live.gate.removeClauseAria': 'Удалить условие {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Совпадает с любым статусом класса (например, 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': 'статус шага {stepId} равен {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': 'статус шага {stepId} не равен {value}',
  'workbench.editors.live.graph.clauseStatusIn': 'статус шага {stepId} в [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': 'захват {ref} существует',
  'workbench.editors.live.graph.clauseCaptureMatches': 'захват {ref} совпадает с /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Добавить шаг',
  'workbench.editors.live.graph.menuEditStep': 'Изменить шаг',
  'workbench.editors.live.graph.menuDeleteStep': 'Удалить шаг',
  'workbench.editors.live.graph.connectTitle': 'Перетащите на другой шаг, чтобы добавить зависимость',
  'workbench.editors.live.graph.removeDependency': 'Удалить зависимость',
  'workbench.editors.live.graph.zoomIn': 'Увеличить',
  'workbench.editors.live.graph.zoomOut': 'Уменьшить',
  'workbench.editors.live.graph.recenter': 'По центру',
  'workbench.editors.live.graph.legendClick': 'щелчок',
  'workbench.editors.live.graph.legendSelect': 'выбрать',
  'workbench.editors.live.graph.legendEditKeys': '2×щелчок / ⏎',
  'workbench.editors.live.graph.legendEdit': 'изменить',
  'workbench.editors.live.graph.legendDelete': 'удалить',
  'workbench.editors.live.graph.legendConnectKeys': 'тянуть ○',
  'workbench.editors.live.graph.legendConnect': 'соединить',
  'workbench.editors.live.graph.legendRightClick': 'правый щелчок',
  'workbench.editors.live.graph.legendMenu': 'меню',
  'workbench.editors.live.graph.legendDragNode': 'тянуть узел',
  'workbench.editors.live.graph.legendMove': 'переместить',
  'workbench.editors.live.graph.legendDragBg': 'тянуть фон',
  'workbench.editors.live.graph.legendPan': 'прокрутить холст',
  'workbench.editors.live.graph.legendScroll': 'колесо',
  'workbench.editors.live.graph.legendZoom': 'масштаб',
  'workbench.editors.live.graph.editStepInForm': 'Изменить шаг в форме',
  'workbench.editors.live.graph.requestNotFound': 'Запрос не найден',
  'workbench.editors.live.graph.noRequestSelected': 'Запрос не выбран',
  'workbench.editors.live.graph.noCaptures': 'Захватов нет',
  'workbench.editors.live.graph.orderedBy': 'Порядок по {ref}',
  'workbench.editors.live.graph.exposedAs': 'Раскрыт как {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': 'Раскрыт как {{live.{name}}} — ожидает первого запуска',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Состояние рабочих процессов',
  'workbench.editors.live.status.noEnvironment': 'Без окружения',
  'workbench.editors.live.status.unknownEnv': 'Неизвестное окружение',
  'workbench.editors.live.status.activeSuffix': '(активно)',
  'workbench.editors.live.status.pillPaused': 'НА ПАУЗЕ',
  'workbench.editors.live.status.pillProbing': 'ПРОВЕРКА',
  'workbench.editors.live.status.pillRetrying': 'ПОВТОР',
  'workbench.editors.live.status.pillHealthy': 'ИСПРАВНО',
  'workbench.editors.live.status.summaryHealthy': '{count} исправно',
  'workbench.editors.live.status.summaryRetrying': '{count} с повтором',
  'workbench.editors.live.status.summaryProbing': '{count} на проверке',
  'workbench.editors.live.status.summaryPaused': '{count} на паузе',
  'workbench.editors.live.status.loading': 'Загрузка…',
  'workbench.editors.live.status.empty':
    'Запусков рабочих процессов пока нет. Создайте рабочий процесс и нажмите «Обновить», чтобы заполнить.',
  'workbench.editors.live.status.failuresCount': 'сбоев: {count}',
  'workbench.editors.live.status.failuresTooltip': 'Сбои подряд с момента последнего успешного обновления.',
  'workbench.editors.live.status.openingsCount': 'размыканий: {count}',
  'workbench.editors.live.status.openingsTooltip':
    'Сколько раз выключатель переходил в разомкнутое состояние в текущем цикле. Уменьшается вдвое после давнего восстановления и на единицу — после недавнего.',
  'workbench.editors.live.status.nextAttempt': 'следующая попытка {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    'Реальное время следующей автоматической проверки. Нажмите «Обновить сейчас», чтобы не ждать.',
  'workbench.editors.live.status.refreshNow': 'Обновить сейчас',
  'workbench.editors.live.status.resetCircuit': 'Сбросить выключатель',
  'workbench.editors.live.status.resetCircuitTooltip':
    'Очистить счётчики сбоев и отложенную задержку. Проверку не запускает.',
  'workbench.editors.live.status.circuitReset': 'Выключатель сброшен',
  'workbench.editors.live.status.resetFailed': 'Сброс не удался: {error}',
  'workbench.editors.live.status.dragToResize': 'Потяните, чтобы изменить размер',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'привязано: {count} переменная',
      few: 'привязано: {count} переменные',
      many: 'привязано: {count} переменных',
      other: 'привязано: {count} переменных',
    }),
  'workbench.editors.live.status.needsReRun': 'нужен повторный запуск',
  'workbench.editors.live.status.needsReRunTooltip':
    'Рабочий процесс или разрешаемые им входные данные изменились после извлечения этого значения — запустите «Обновить», чтобы извлечь заново.',
  'workbench.editors.live.status.neverRunForEnv':
    'в этом окружении ещё не запускался — нажмите «Обновить», чтобы заполнить',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': 'значения сохранены из более раннего запуска',
  'workbench.editors.live.runOverlay.responseBytes': 'ответ {bytes} байт',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Создать рабочий процесс из «{name}»',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Создать рабочий процесс ({count} шаг)',
      few: 'Создать рабочий процесс ({count} шага)',
      many: 'Создать рабочий процесс ({count} шагов)',
      other: 'Создать рабочий процесс ({count} шагов)',
    }),
  'workbench.editors.live.fromRequests.empty':
    'В этом контейнере нет запросов, из которых можно собрать рабочий процесс.',
  'workbench.editors.live.fromRequests.hint':
    'Каждый выбранный запрос становится шагом рабочего процесса в показанном порядке.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'группа',
  'workbench.editors.live.extractor.groupBody': 'Тело ответа',
  'workbench.editors.live.extractor.groupResponse': 'Ответ',
  'workbench.editors.live.extractor.wholeBody': 'Всё тело',
  'workbench.editors.live.extractor.jsonPath': 'JSON-путь',
  'workbench.editors.live.extractor.regex': 'Регулярное выражение',
  'workbench.editors.live.extractor.header': 'Заголовок',
  'workbench.editors.live.extractor.statusCode': 'Код состояния',
} as const satisfies Catalog;
