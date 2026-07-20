/**
 * Workbench live/workflows station — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Reuses the live register
 * shipped in zh-CN/workbench-variables + the chrome mints: 刷新 =
 * Refresh, 覆盖 = override, 工作流 = workflow, 步骤 = step, 捕获 =
 * capture, 绑定 = binding, 解析器 = resolver, 陈旧 = stale, 标签页 =
 * tab, 界面 = surface, 配额 = quota, 上限 = cap, 无环境 = No
 * environment (tui/variables mint), 探测 = probe (shared mint), 提取器
 * = extractor, 断言 = assertion. MINTS: 电路 = circuit with 断开 /
 * 闭合 for the open/closed states; 断路器 = breaker; 提前 = lead
 * (prose; `lead` token raw); 公开 = expose; 调度器 = scheduler; 固定 =
 * pin; 重试层 = retry tier; 祖先步骤 = ancestor step; 隐式 / 显式 =
 * implicit / explicit; 字典序 = lexicographic. Technical plane stays
 * raw inside keyed sentences: `{{live.NAME}}` syntax, policy kind ids
 * (expires-in / expires-at), `lead` / `dependsOn` / oh.* field tokens,
 * step ids / capture names, code examples, MV3, alarm, backoff,
 * AND/OR/OPEN, epoch ms, the `(e.g.` abbrev fragment (S57 whole-raw)
 * and the lone `.` / `).`-prefixed help-split keys (S80 law:
 * half-width parens pair with the raw suffix), server error text
 * ({error}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': '空闲',
  'workbench.editors.live.circuit.idleHint': '还没有缓存——运行一次刷新来填充。',
  'workbench.editors.live.circuit.pausedLabel': '已暂停',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '连续 {count} 次失败后电路已断开。自动重试被推迟。点击“立即重试”可跳过 backoff。',
    }),
  'workbench.editors.live.circuit.probingLabel': '探测中…',
  'workbench.editors.live.circuit.probingHint': '探测尝试进行中——只需一次成功即可闭合电路。',
  'workbench.editors.live.circuit.retryLabel': '重试 {attempt}/3',
  'workbench.editors.live.circuit.retryHint':
    '断路器之前的重试层——快速重试，两次尝试之间有 5–10s 的 backoff。连续 3 次失败后电路断开。',
  'workbench.editors.live.circuit.healthyLabel': '健康',
  'workbench.editors.live.circuit.healthyHint': '电路已闭合，最近没有失败。',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': '上次刷新 {when}',
  'workbench.editors.live.schedule.manualOnly': '仅手动刷新',
  'workbench.editors.live.schedule.autoRefresh': '自动刷新 {when}',
  'workbench.editors.live.schedule.expires': '过期 {when}',
  'workbench.editors.live.policy.interval': '每 {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in 来自 {source}（提前 {lead}s）',
  'workbench.editors.live.policy.expiresAt': 'expires-at 来自 {source}（提前 {lead}s）',
  'workbench.editors.live.policy.manual': '手动刷新',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': '上次运行已完成',
  'workbench.editors.live.stepRun.failed': '上次运行在此步骤失败',
  'workbench.editors.live.stepRun.extractFailed': '已获取，但有一个捕获提取器未匹配',
  'workbench.editors.live.stepRun.skipped': '上次运行被其运行条件跳过',
  'workbench.editors.live.stepRun.notRun': '尚未参与任何成功的运行',
  'workbench.editors.live.maskEmpty': '（空）',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': '名称',
  'workbench.editors.live.form.descriptionPlaceholder': '描述（可选）',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': '未找到来源。',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': '已禁用',
  'workbench.editors.live.variable.overrideTag': '覆盖',
  'workbench.editors.live.variable.refresh': '刷新',
  'workbench.editors.live.variable.valueLabel': '值',
  'workbench.editors.live.variable.neverRefreshed': '（从未刷新）',
  'workbench.editors.live.variable.nameLabel': '名称',
  'workbench.editors.live.variable.nameHint': '引用形式为 {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': '描述',
  'workbench.editors.live.variable.bindingSection': '绑定',
  'workbench.editors.live.variable.workflowLabel': '工作流',
  'workbench.editors.live.variable.stepLabel': '步骤',
  'workbench.editors.live.variable.captureLabel': '捕获',
  'workbench.editors.live.variable.selectWorkflow': '选择一个工作流',
  'workbench.editors.live.variable.selectStep': '选择一个步骤',
  'workbench.editors.live.variable.selectCapture': '选择一个捕获',
  'workbench.editors.live.variable.stepOption': '{id}（{count} 个捕获）',
  'workbench.editors.live.variable.openFlow': '打开工作流',
  'workbench.editors.live.variable.overrideSection': '手动覆盖',
  'workbench.editors.live.variable.overrideValuePlaceholder': '固定的覆盖值',
  'workbench.editors.live.variable.overrideExpiresLabel': '过期（ms）',
  'workbench.editors.live.variable.overrideExpiresHint': '真实时间的 epoch ms——留空表示永久覆盖',
  'workbench.editors.live.variable.applyOverride': '应用覆盖',
  'workbench.editors.live.variable.clearOverride': '清除',
  'workbench.editors.live.variable.setOverride': '设置手动覆盖',
  'workbench.editors.live.variable.overrideNote': '解析器提供固定的值；调度器仍会刷新底层工作流。',
  'workbench.editors.live.variable.deletedElsewhere': '来源已在另一个标签页中被删除',
  'workbench.editors.live.variable.saveFailed': '保存 Live 变量失败',
  'workbench.editors.live.variable.refreshFailed': '刷新失败：{error}',
  'workbench.editors.live.variable.refreshed': '已刷新',
  'workbench.editors.live.variable.overrideSaveFailed': '保存覆盖失败。',
  'workbench.editors.live.variable.overrideApplied': '已应用覆盖',
  'workbench.editors.live.variable.overrideCleared': '已清除覆盖',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': '新建 Live 变量',
  'workbench.editors.live.create.namePlaceholder': '名称（例如 accessToken）',
  'workbench.editors.live.create.referenceAs': '引用形式为 {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': '创建一个工作流',
  'workbench.editors.live.create.noWorkflows': '还没有工作流。',
  'workbench.editors.live.create.nameRequired': '名称为必填项',
  'workbench.editors.live.create.bindingRequired': '选择工作流、步骤和捕获',
  'workbench.editors.live.create.createFailed': '创建 Live 变量失败',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': '已启用',
  'workbench.editors.live.toggles.enabledTooltip': '关闭后，规则和请求中的 {{live.NAME}} 引用将停止解析。',
  'workbench.editors.live.toggles.waitForFresh': '等待最新值',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    '应用规则前，先等待背后的工作流完成一次刷新（最多约 5s）。关闭时：规则使用最近缓存的值，并在后台刷新——更快，但在扩展唤醒后值可能短暂陈旧。',
  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': '仅手动',
  'workbench.editors.live.refreshPolicy.interval': '固定间隔',
  'workbench.editors.live.refreshPolicy.expiresIn': '在 N 秒后过期（相对）',
  'workbench.editors.live.refreshPolicy.expiresAt': '在 epoch ms 时过期（绝对）',
  'workbench.editors.live.refreshPolicy.secondsUnit': '秒',
  'workbench.editors.live.refreshPolicy.leadUnit': '提前 s',
  'workbench.editors.live.refreshPolicy.selectCapture': '选择捕获',
  'workbench.editors.live.refreshPolicy.noCaptures': '还没有定义捕获。',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    '低于一分钟的间隔会碰到 MV3 的 alarm 下限，并快速消耗配额。仅在必要时使用。',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix': '捕获值 = 距过期的秒数 (例如 OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). 刷新会提前 `lead` 秒触发',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': '捕获值 = 绝对 unix epoch，单位为',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': '毫秒',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix': '). 刷新会在该时刻前 `lead` 秒触发。',
  'workbench.editors.live.refreshPolicy.noCapturesWarning': '先给工作流添加一个捕获，让过期计算有一个来源。',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': '编辑器',
  'workbench.editors.live.workflow.viewPreview': '预览',
  'workbench.editors.live.workflow.refresh': '刷新',
  'workbench.editors.live.workflow.disabledTag': '已禁用',
  'workbench.editors.live.workflow.notFound': '未找到工作流。',
  'workbench.editors.live.workflow.deletedElsewhere': '工作流已在另一个标签页中被删除',
  'workbench.editors.live.workflow.saveFailed': '保存工作流失败',
  'workbench.editors.live.workflow.createFailed': '创建工作流失败',
  'workbench.editors.live.workflow.refreshed': '已刷新',
  'workbench.editors.live.workflow.refreshFailed': '刷新失败：{error}',
  'workbench.editors.live.workflow.defaultName': '工作流',
  'workbench.editors.live.workflow.newDraftName': '新建工作流',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': '工作流存在结构问题',
  'workbench.editors.live.form.stepsTitle': '步骤（{count}）',
  'workbench.editors.live.form.addStepButton': '步骤',
  'workbench.editors.live.form.noSteps': '还没有步骤——添加一个，把请求 + 提取接入此工作流。',
  'workbench.editors.live.form.enabledAria': '工作流已启用',
  'workbench.editors.live.form.enabled': '已启用',
  'workbench.editors.live.form.disabled': '已禁用',
  'workbench.editors.live.form.parallelLabel': '并行运行相互独立的步骤',
  'workbench.editors.live.form.parallelTooltip': 'v1 仅支持顺序执行。并行执行将在未来版本推出。',
  'workbench.editors.live.form.refreshPolicySection': '刷新策略',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': '步骤 {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': '名称',
  'workbench.editors.live.step.typeTooltip': '步骤类型——Foreach 和 Composite 将在未来版本推出。',
  'workbench.editors.live.step.typeRequest': '请求',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '满足 {count} 个条件时运行',
    }),
  'workbench.editors.live.step.priorityTag': '优先级：{ref}',
  'workbench.editors.live.step.scriptsTag': 'scripts',
  'workbench.editors.live.step.selectRequest': '选择一个请求',
  'workbench.editors.live.step.descriptionPlaceholder': '可选的步骤描述',
  'workbench.editors.live.step.capturesHeader': '捕获（{count}）',
  'workbench.editors.live.step.addCapture': '+ 捕获',
  'workbench.editors.live.step.captureRequired': '至少需要一个捕获，LV 才能绑定到此步骤。',
  'workbench.editors.live.step.removeCaptureAria': '移除捕获 {name}',
  'workbench.editors.live.step.exposeAria': '将捕获 {name} 公开为 Live 变量',
  'workbench.editors.live.step.exposeAs': '公开为',
  'workbench.editors.live.step.exposeTooltip':
    '开启后，保存工作流会创建一个 Live 变量，从此捕获解析 `{{live.<name>}}`。关闭则仅在此工作流内部使用该捕获（例如通过 {{step.<stepId>.<captureName>}}）。',
  'workbench.editors.live.step.afterChip': '↳ 在 {parents} 之后',
  'workbench.editors.live.step.implicitMark': '（隐式）',
  'workbench.editors.live.step.implicitTooltip':
    '对上一步骤的隐式依赖（未声明显式 dependsOn）。设置显式 dependsOn 以锁定这层关系。',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': '依赖于',
  'workbench.editors.live.sections.dependsOnImplicit': '（隐式——上一步）',
  'workbench.editors.live.sections.dependsOnRoot': '（根）',
  'workbench.editors.live.sections.dependsOnPlaceholder': '选择祖先步骤——留空 = 根步骤',
  'workbench.editors.live.sections.dependsOnImplicitHint': '没有显式 dependsOn——按声明顺序隐式依赖上一步。',
  'workbench.editors.live.sections.dependsOnRootHint': '显式根——工作流一启动就运行。',
  'workbench.editors.live.sections.useImplicit': '使用隐式',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '该步骤会等待 {count} 个祖先完成或被跳过。',
    }),
  'workbench.editors.live.sections.reset': '重置',
  'workbench.editors.live.sections.runCondition': '运行条件',
  'workbench.editors.live.sections.none': '（无）',
  'workbench.editors.live.sections.priority': '优先级',
  'workbench.editors.live.sections.priorityStepPlaceholder': '祖先步骤',
  'workbench.editors.live.sections.priorityCapturePlaceholder': '捕获名称',
  'workbench.editors.live.sections.sortNumeric': '数值',
  'workbench.editors.live.sections.sortLexicographic': '字典序',
  'workbench.editors.live.sections.priorityTooltip':
    '当多个步骤都可以接着运行时，优先级值最低的先运行。缺失的值排在最后。',
  'workbench.editors.live.sections.clear': '清除',
  'workbench.editors.live.sections.retryPolicy': '重试策略',
  'workbench.editors.live.sections.retrySummary': '（{count} 次尝试）',
  'workbench.editors.live.sections.retrySummaryExponential': '（{count} 次尝试，指数）',
  'workbench.editors.live.sections.attemptsPlaceholder': '尝试次数',
  'workbench.editors.live.sections.attemptsPrefix': '尝试次数',
  'workbench.editors.live.sections.delayPrefix': '延迟 ms',
  'workbench.editors.live.sections.backoffFixed': '固定',
  'workbench.editors.live.sections.backoffExponential': '指数',
  'workbench.editors.live.sections.retryOnNetwork': '仅网络错误',
  'workbench.editors.live.sections.retryOn5xx': '网络 + 5xx',
  'workbench.editors.live.sections.retryOn429': '网络 + 429',
  'workbench.editors.live.sections.retryOn4xx': '网络 + 4xx',
  'workbench.editors.live.sections.retryOnCustom': '自定义（作为数据编辑）',
  'workbench.editors.live.sections.retryTooltip':
    '网络故障（DNS、连接、超时）只要还有尝试次数就总会重试。添加状态匹配后，匹配的响应也会重试；提取错误从不重试。清空尝试次数字段可禁用重试。',
  'workbench.editors.live.sections.timeout': '超时',
  'workbench.editors.live.sections.noTimeoutPlaceholder': '无超时',
  'workbench.editors.live.sections.timeoutTooltip':
    '按每次尝试计——请求（包括读取响应体）超过此上限即中止。重试的步骤每次尝试都拥有完整的超时。清空该字段则不设上限。',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '（开）',
  'workbench.editors.live.sections.scriptsOff': '（关）',
  'workbench.editors.live.sections.runScriptsAria': '在此步骤运行该请求的脚本',
  'workbench.editors.live.sections.runScriptsLabel': '运行该请求的 pre-request / post-response 脚本',
  'workbench.editors.live.sections.scriptsTooltip':
    '在链条的每次尝试中运行。步骤脚本获得只读的 oh.* 界面（oh.sendRequest 和 oh.variables.set 会被拒绝）。脚本错误或失败的 oh.test 断言会让该步骤失败，从而保留最后一次的良好值——断言把关此工作流发布的内容。需要支持脚本的运行时；在没有的主机上，该步骤会不带脚本运行。',
  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': '状态',
  'workbench.editors.live.gate.kindCaptureExists': '捕获存在',
  'workbench.editors.live.gate.kindCaptureEquals': '捕获等于',
  'workbench.editors.live.gate.kindCaptureMatches': '捕获匹配',
  'workbench.editors.live.gate.kindNumericCompare': '捕获数值比较',
  'workbench.editors.live.gate.kindInList': '捕获在列表中',
  'workbench.editors.live.gate.kindHeaderContains': '标头包含',
  'workbench.editors.live.gate.futureNumericCompare': '数值比较——将在未来版本推出。',
  'workbench.editors.live.gate.futureInList': '列表匹配——将在未来版本推出。',
  'workbench.editors.live.gate.futureHeaderContains': '“标头包含”——将在未来版本推出。',
  'workbench.editors.live.gate.status2xx': '2xx（任意成功）',
  'workbench.editors.live.gate.status3xx': '3xx（重定向）',
  'workbench.editors.live.gate.status4xx': '4xx（客户端错误）',
  'workbench.editors.live.gate.status5xx': '5xx（服务器错误）',
  'workbench.editors.live.gate.statusEquals': '等于…',
  'workbench.editors.live.gate.statusNotEquals': '不等于…',
  'workbench.editors.live.gate.statusOneOf': '其中之一…',
  'workbench.editors.live.gate.allAnd': '全部（AND）',
  'workbench.editors.live.gate.anyOr': '任一（OR）',
  'workbench.editors.live.gate.orTooltip': 'OR 逻辑将在未来版本推出。目前请用多个步骤搭配互斥的条件。',
  'workbench.editors.live.gate.matchModesAria': '关于匹配模式',
  'workbench.editors.live.gate.noConditions': '没有条件——步骤在其依赖完成后即运行。',
  'workbench.editors.live.gate.conditionCount': '{count} 个条件',
  'workbench.editors.live.gate.addCondition': '添加条件',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': '步骤',
  'workbench.editors.live.gate.capturePlaceholder': '捕获名称',
  'workbench.editors.live.gate.equalsPlaceholder': '等于的值',
  'workbench.editors.live.gate.removeClauseAria': '移除子句 {number}',
  'workbench.editors.live.gate.statusClassTooltip': '匹配该类别中的任意状态（例如 2xx = 200-299）。',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': '{stepId} 的状态为 {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': '{stepId} 的状态不为 {value}',
  'workbench.editors.live.graph.clauseStatusIn': '{stepId} 的状态在 [{list}] 中',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} 存在',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} 匹配 /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': '添加步骤',
  'workbench.editors.live.graph.menuEditStep': '编辑步骤',
  'workbench.editors.live.graph.menuDeleteStep': '删除步骤',
  'workbench.editors.live.graph.connectTitle': '拖到另一个步骤以添加依赖',
  'workbench.editors.live.graph.removeDependency': '移除依赖',
  'workbench.editors.live.graph.zoomIn': '放大',
  'workbench.editors.live.graph.zoomOut': '缩小',
  'workbench.editors.live.graph.recenter': '重新居中',
  'workbench.editors.live.graph.legendClick': '单击',
  'workbench.editors.live.graph.legendSelect': '选择',
  'workbench.editors.live.graph.legendEditKeys': '2×单击 / ⏎',
  'workbench.editors.live.graph.legendEdit': '编辑',
  'workbench.editors.live.graph.legendDelete': '删除',
  'workbench.editors.live.graph.legendConnectKeys': '拖动 ○',
  'workbench.editors.live.graph.legendConnect': '连接',
  'workbench.editors.live.graph.legendRightClick': '右键单击',
  'workbench.editors.live.graph.legendMenu': '菜单',
  'workbench.editors.live.graph.legendDragNode': '拖动节点',
  'workbench.editors.live.graph.legendMove': '移动',
  'workbench.editors.live.graph.legendDragBg': '拖动背景',
  'workbench.editors.live.graph.legendPan': '平移',
  'workbench.editors.live.graph.legendScroll': '滚动',
  'workbench.editors.live.graph.legendZoom': '缩放',
  'workbench.editors.live.graph.editStepInForm': '在表单中编辑步骤',
  'workbench.editors.live.graph.requestNotFound': '未找到请求',
  'workbench.editors.live.graph.noRequestSelected': '未选择请求',
  'workbench.editors.live.graph.noCaptures': '没有捕获',
  'workbench.editors.live.graph.orderedBy': '按 {ref} 排序',
  'workbench.editors.live.graph.exposedAs': '已公开为 {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': '已公开为 {{live.{name}}}——等待首次运行',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': '工作流状态',
  'workbench.editors.live.status.noEnvironment': '无环境',
  'workbench.editors.live.status.unknownEnv': '未知环境',
  'workbench.editors.live.status.activeSuffix': '（活动）',
  'workbench.editors.live.status.pillPaused': '已暂停',
  'workbench.editors.live.status.pillProbing': '探测中',
  'workbench.editors.live.status.pillRetrying': '重试中',
  'workbench.editors.live.status.pillHealthy': '健康',
  'workbench.editors.live.status.summaryHealthy': '{count} 个健康',
  'workbench.editors.live.status.summaryRetrying': '{count} 个重试中',
  'workbench.editors.live.status.summaryProbing': '{count} 个探测中',
  'workbench.editors.live.status.summaryPaused': '{count} 个已暂停',
  'workbench.editors.live.status.loading': '加载中…',
  'workbench.editors.live.status.empty': '还没有工作流运行。创建一个工作流并点击“刷新”来填充。',
  'workbench.editors.live.status.failuresCount': '失败：{count}',
  'workbench.editors.live.status.failuresTooltip': '自上次成功刷新以来的连续失败次数。',
  'workbench.editors.live.status.openingsCount': '断开：{count}',
  'workbench.editors.live.status.openingsTooltip':
    '电路在当前周期内转入 OPEN 的次数。经过充分时间的恢复后减半，最近一次恢复后减一。',
  'workbench.editors.live.status.nextAttempt': '下次尝试 {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip': '下一次自动探测运行的真实时刻。点击“立即刷新”可跳过等待。',
  'workbench.editors.live.status.refreshNow': '立即刷新',
  'workbench.editors.live.status.resetCircuit': '重置电路',
  'workbench.editors.live.status.resetCircuitTooltip': '清除失败计数器 + 待定的 backoff。不会运行探测。',
  'workbench.editors.live.status.circuitReset': '电路已重置',
  'workbench.editors.live.status.resetFailed': '重置失败：{error}',
  'workbench.editors.live.status.dragToResize': '拖动以调整大小',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '已绑定：{count} 个变量',
    }),
  'workbench.editors.live.status.needsReRun': '需要重新运行',
  'workbench.editors.live.status.needsReRunTooltip':
    '自提取此值以来，工作流或其解析的某个输入已发生变化——运行“刷新”以重新提取。',
  'workbench.editors.live.status.neverRunForEnv': '此环境从未运行过——点击“刷新”来填充',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': '值保留自较早的一次运行',
  'workbench.editors.live.runOverlay.responseBytes': '响应 {bytes} 字节',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': '从“{name}”创建工作流',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '创建工作流（{count} 个步骤）',
    }),
  'workbench.editors.live.fromRequests.empty': '此容器没有可用来构建工作流的请求。',
  'workbench.editors.live.fromRequests.hint': '每个选中的请求都会按所示顺序成为一个工作流步骤。',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': '分组',
  'workbench.editors.live.extractor.groupBody': '响应体',
  'workbench.editors.live.extractor.groupResponse': '响应',
  'workbench.editors.live.extractor.wholeBody': '整个正文',
  'workbench.editors.live.extractor.jsonPath': 'JSON 路径',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': '标头',
  'workbench.editors.live.extractor.statusCode': '状态码',
} as const satisfies Catalog;
