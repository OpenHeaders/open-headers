/**
 * Workbench editors — the rule editor — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-editors-rule.ts` key for key. The quick
 * editor reuses the `workbench.editors.rule.fields.*` keys directly
 * (S35 field-key reuse law) — field labels here stay consistent with
 * `zh-CN/panel-quick-editor.ts` (op nouns 注入 / 覆盖 / 追加 / 合并 /
 * 移除, 全部移除, the Mock raw tag + 修改 = Modify). Rule-type kickers
 * mint the -规则 family（标头规则 / 拦截规则 / 重定向规则 /
 * 查询参数规则 / 注入规则 / 延迟规则 / 请求体规则 / 响应规则 /
 * WebSocket 规则 / SSE 规则 / 身份验证规则）— workbench-chrome's
 * ruleTypeName keys MUST reuse them. MINTS: 模板 = template
 * (用户模板 = user template); 头部 here also = the editor header bar
 * (S19 separate referent — JWT segment 头部 and HTTP 标头 unchanged);
 * 仅覆盖 = Replace Only; 第一方 / 第三方 = first-/third-party; 墓碑 =
 * tombstone; 槽位 = DNR slot; 钳制 = clamped. 质询 / 草稿 / 界面 /
 * 封顶于 / 调试模式 / 范围 carried. Raw by design: gates AND/OR/NOT,
 * DNR schema vocabulary (`requestDomains`, `url-filter`,
 * `firstParty`, slot ids), `{{ns.NAME}}` reference syntax in
 * placeholders, quoted browser UI phrasing (raw en in “”, S80 law),
 * scheme prefixes, HTTP method lists, regex fragments, the Mock tag,
 * `⋮ → 保存为用户模板` menu-path splits quote the OH mint.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': '已保存',
  'workbench.editors.header.onTop': '头部置顶',
  'workbench.editors.header.atBottom': '头部置底',
  'workbench.editors.header.moreActions': '更多操作',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': '规则编辑器',
  'workbench.editors.rule.templates.title': '模板',
  'workbench.editors.rule.templates.infoSummary': '从预设开始，而不是从空白表单开始。',
  'workbench.editors.rule.templates.infoDescription':
    '系统模板随应用一起提供；用户模板是你自己通过 ⋮ → 保存为用户模板 保存的。应用模板只会预填字段——保存前可任意调整。',
  'workbench.editors.rule.templates.blank': '空白',
  'workbench.editors.rule.templates.system': '系统',
  'workbench.editors.rule.templates.user': '用户',
  'workbench.editors.rule.templates.emptyTitle': '还没有用户模板',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    '用户模板是你自己为此规则类型准备的可复用预设。把规则配置好后，在头部选择',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → 保存为用户模板',
  'workbench.editors.rule.templates.emptyAfterMenu': '——它会显示在这里，供此类型的每条新规则使用。',
  'workbench.editors.rule.saveAsTemplate': '保存为用户模板',
  'workbench.editors.rule.enabled': '已启用',
  'workbench.editors.rule.disabled': '已禁用',
  'workbench.editors.rule.toast.unknownType': '未知的规则类型',
  'workbench.editors.rule.toast.deletedOtherTab': '规则已在另一个标签页中被删除',
  'workbench.editors.rule.toast.updateFailed': '更新规则失败',
  'workbench.editors.rule.toast.updateFailedDetail': '更新规则失败：{message}',
  'workbench.editors.rule.toast.publishFailed': '规则已保存，但发布失败',
  'workbench.editors.rule.toast.updated': '规则已更新',
  'workbench.editors.rule.toast.published': '规则已发布',
  'workbench.editors.rule.toast.formatSkipped': '保存时格式化已跳过：{reason}',
  'workbench.editors.rule.toast.noCollection': '未找到集合',
  'workbench.editors.rule.toast.restoreFailed': '恢复规则失败',
  'workbench.editors.rule.toast.restored': '规则已恢复',
  'workbench.editors.rule.deleted.message': '此规则已在另一个界面中被删除。',
  'workbench.editors.rule.deleted.description':
    '“恢复”会以新 id 创建一个全新副本（原始墓碑是永久的——见同步引擎规范 §7.2）。',
  'workbench.editors.rule.deleted.restore': '恢复',
  'workbench.editors.rule.conditionsPane.title': '条件',
  'workbench.editors.rule.conditionsPane.infoSummary': '条件决定此规则应用于哪些请求。',
  'workbench.editors.rule.conditionsPane.infoAndBefore': '行与行之间以',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '组合——每一行都必须匹配。',
  'workbench.editors.rule.conditionsPane.infoOrBefore': '同一行内的多个值以',
  'workbench.editors.rule.conditionsPane.infoOrAfter': '组合（OR 徽章标记接受多个值的行）。',
  'workbench.editors.rule.conditionsPane.infoAddOne': '至少添加一个条件。',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated wording across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'URL 匹配',
  'workbench.editors.rule.condition.group.domainFiltering': '域名筛选',
  'workbench.editors.rule.condition.group.requestFiltering': '请求筛选',
  'workbench.editors.rule.condition.group.headerMatching': '标头匹配',
  'workbench.editors.rule.condition.type.urlFilter': 'URL 模式',
  'workbench.editors.rule.condition.type.urlRegex': 'URL 正则',
  'workbench.editors.rule.condition.type.requestDomains': '请求域名',
  'workbench.editors.rule.condition.type.excludeRequestDomains': '排除域名',
  'workbench.editors.rule.condition.type.initiatorDomains': '发起者域名',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': '排除发起者',
  'workbench.editors.rule.condition.type.requestMethods': '方法',
  'workbench.editors.rule.condition.type.excludeRequestMethods': '排除方法',
  'workbench.editors.rule.condition.type.resourceTypes': '资源类型',
  'workbench.editors.rule.condition.type.excludeResourceTypes': '排除资源',
  'workbench.editors.rule.condition.type.domainType': '域类型',
  'workbench.editors.rule.condition.type.responseHeader': '响应标头',
  'workbench.editors.rule.condition.type.excludeResponseHeader': '排除响应标头',
  'workbench.editors.rule.condition.suffix.notSupported': '——Chrome DNR 不支持',
  'workbench.editors.rule.condition.suffix.alreadyUsed': '——已使用',
  'workbench.editors.rule.condition.firstParty': '第一方',
  'workbench.editors.rule.condition.thirdParty': '第三方',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': '没有条件——规则不会匹配任何请求',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    '行与行之间以 AND 组合——每一行都匹配规则才会触发。每一行对应一个不同的 DNR 字段，因此跨行的 AND 是精确的。要在同一字段内对多个值取 OR，把它们列在同一行里（见该行的 OR 徽章）。',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip': '这是一个排除条件——只有当列出的值一个都不匹配时，规则才会触发。',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip': '此行中的多个值只要任意一个匹配即算匹配（OR）。下方各行以 AND 组合。',
  'workbench.editors.rule.condition.oneValueTag': '1 个值',
  'workbench.editors.rule.condition.oneValueTooltip': '此条件只接受单个值——逗号分隔无效。下方各行以 AND 组合。',
  'workbench.editors.rule.condition.headerNamePlaceholder': '标头名称等于…',
  'workbench.editors.rule.condition.headerValuePlaceholder': '标头值等于…',
  'workbench.editors.rule.condition.selectMethods': '选择方法',
  'workbench.editors.rule.condition.selectTypes': '选择类型',
  'workbench.editors.rule.condition.selectType': '选择类型',
  'workbench.editors.rule.condition.valuePlaceholder': '值',
  'workbench.editors.rule.condition.add': '添加条件',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    '只有最后一个 {type} 行生效——此行的值不会到达 Chrome。移除此行，或把它的值并入生效的那一行。',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} 和 {winningType} 共用一个 DNR 槽位——只有最后一个生效。请二选一。',
  'workbench.editors.rule.issue.unsupportedByDnr':
    'Chrome DNR 尚不支持此条件类型——规则仍会保存，但此行不会在线路上生效。',
  'workbench.editors.rule.issue.emptyUrlFilter': 'URL 模式不能为空。',
  'workbench.editors.rule.issue.emptyUrlRegex': 'URL 正则不能为空。',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'URL 模式不能包含空白字符——Chrome 会拒绝 url-filter 中带空格的规则。',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'URL 模式包含非 ASCII 字符——Chrome 会拒绝它们。IDN 主机名请使用 punycode（xn--…）形式。',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    '这看起来像正则表达式——在“URL 模式”中，`(`、`[`、`+`、`?`、`\\d` 等字符按字面匹配。需要正则语法请切换到“URL 正则”。',
  'workbench.editors.rule.issue.regexLookbehind':
    'Chrome 的正则引擎（RE2）不支持后行断言（(?<=…)、(?<!…)）。规则可能加载失败。',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Chrome 的正则引擎（RE2）不支持 Python 风格的命名分组（(?P<name>…)）。规则可能加载失败。',
  'workbench.editors.rule.issue.invalidUrlRegex': '正则无效：{reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '"{value}" 不是有效的 HTTP 方法。允许：GET、POST、PUT、PATCH、DELETE、HEAD、OPTIONS、CONNECT、TRACE。',
  'workbench.editors.rule.issue.invalidResourceType': '"{value}" 不是有效的资源类型。请从下拉列表中选择。',
  'workbench.editors.rule.issue.invalidDomainType': '"{value}" 不是有效的域类型。请使用 "firstParty" 或 "thirdParty"。',
  'workbench.editors.rule.issue.headerNameRequired': '标头名称为必填项。',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    '值中包含空白字符——主机名之间请用逗号分隔。requestDomains 每个条目只接受一个纯主机名。',
  'workbench.editors.rule.issue.domain.scheme': '去掉协议前缀——Chrome 的 requestDomains 只接受主机名，不接受 URL。',
  'workbench.editors.rule.issue.domain.wildcard':
    "去掉通配符——requestDomains 会自动匹配所有子域名，因此 '*.foo.com' 就是 'foo.com'。",
  'workbench.editors.rule.issue.domain.port': '去掉端口——requestDomains 只按主机名匹配；规则自动覆盖所有端口。',
  'workbench.editors.rule.issue.domain.uppercase': '把主机名改为小写——Chrome 在 requestDomains 中只接受小写 ASCII。',
  'workbench.editors.rule.issue.domain.nonAscii':
    '主机名包含 Chrome 在 requestDomains 中拒绝的字符（可能是非 ASCII / IDN 条目）。请使用 punycode（xn--…）形式。',
  'workbench.editors.rule.issue.domain.empty': '主机名为空——移除此行。',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个受影响的条目' }),
  'workbench.editors.rule.issue.domain.cleanUp': '清理',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': '重定向目标不能包含空白字符。',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    '重定向目标必须是完整 URL（http://、https://、chrome-extension://）或以 / 开头的路径。',
  'workbench.editors.rule.actionIssue.injectUrlScheme': '源 URL 必须使用 http://、https:// 或 chrome-extension://。',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': '源 URL 不是有效的 URL。',
  'workbench.editors.rule.actionIssue.invalidStatusCode': '状态码必须是 100-599 的整数。',
  'workbench.editors.rule.actionIssue.invalidParamName': '参数名不能包含 `&`、`=`、`#`、`?` 或空白字符。',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap': '主框架延迟封顶于 30000ms；超出的值会在线路上被钳制。',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'XHR/fetch 的 monkey-patch 把延迟封顶于 5000ms，以避免 HTTP 连接池枯竭。主框架重定向最高支持 30000ms。',
  'workbench.editors.rule.actionIssue.invalidContentType': '内容类型应形如 "type/subtype"（例如 application/json）。',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'GraphQL 筛选键为必填项。',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired': '配置了筛选器时，消息筛选值为必填项。',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex': '消息筛选器不是有效的正则表达式。',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter': '在匹配消息之后注入需要一个消息筛选器。',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '此规则中有 {count} 个未解析的变量',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': '未解析',
  'workbench.editors.rule.resolution.reason.unsetInScope': '不在作用域内',
  'workbench.editors.rule.resolution.reason.unknownNamespace': '未知命名空间',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': '步骤引用超出作用域',
  'workbench.editors.rule.resolution.reason.empty': '为空',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': '值无效',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': '需要授权',
  'workbench.editors.rule.resolution.reason.secretNotFound': '未找到机密',
  'workbench.editors.rule.resolution.reason.secretUnavailable': '管理器不可用',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    '环境“{envName}”还没有缓存的运行——打开工作流并在该环境下点击“刷新”来填充',
  'workbench.editors.rule.resolution.hint.disabledLv': 'Live 变量已被禁用——请在 Live 变量编辑器中启用它',
  'workbench.editors.rule.resolution.hint.draftLv': 'Live 变量还是草稿——打开它并点击“保存”来发布',
  'workbench.editors.rule.resolution.noEnvironment': '无环境',
  'workbench.editors.rule.resolution.activeEnvFallback': '活动环境',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': '操作',
  'workbench.editors.rule.fields.addAction': '添加操作',
  'workbench.editors.rule.fields.reset': '重置',
  'workbench.editors.rule.fields.optionalTag': '（可选）',
  'workbench.editors.rule.fields.opAddReplace': '添加 / 覆盖',
  'workbench.editors.rule.fields.opAppend': '追加',
  'workbench.editors.rule.fields.opRemove': '移除',
  'workbench.editors.rule.fields.opMerge': '合并',
  'workbench.editors.rule.fields.opReplaceOnly': '仅覆盖',
  'workbench.editors.rule.fields.opRemoveAll': '全部移除',
  'workbench.editors.rule.fields.operatorEquals': '等于',
  'workbench.editors.rule.fields.operatorContains': '包含',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': '静态数据',
  'workbench.editors.rule.fields.dynamicJs': '动态（JavaScript）',
  'workbench.editors.rule.fields.formatAwareBody.formatted': '格式化',
  'workbench.editors.rule.fields.formatAwareBody.raw': '原始',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip': '格式化视图仅适用于 JSON 形态的正文。',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': '格式化视图',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': '正文',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    '格式化和原始是同一段正文文本的两种视图——线路文本才是规则实际提供的内容。',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': '示例——同一个值，两种视图',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': '模式',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    '阅读视图——只有空白字符不同。编辑会重新编码回原始线路格式，保存写入的是该线路文本；未编辑的保存写入与原始完全一致的字节。',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc': '线路文本本身——规则提供的就是它。',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'GraphQL 操作（请求负载筛选）',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': '键，例如 operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': '值，例如 getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': '标头规则',
  'workbench.editors.rule.fields.header.infoSummary': '在匹配的流量上重写请求和响应标头。',
  'workbench.editors.rule.fields.header.infoDescription':
    '无效组合（例如对自定义标头使用追加）会把规则标记为草稿。草稿会被保存，但不会执行。',
  'workbench.editors.rule.fields.header.requestTab': '请求标头',
  'workbench.editors.rule.fields.header.requestTabSummary': '在请求离开浏览器之前应用于传出请求的标头操作。',
  'workbench.editors.rule.fields.header.responseTab': '响应标头',
  'workbench.editors.rule.fields.header.responseTabSummary': '在页面看到之前应用于响应的标头操作。',
  'workbench.editors.rule.fields.header.responseTabDescription':
    '浏览器自带的 DevTools Network 标签页始终显示服务器的原始标头，因此这些修改虽然已生效，在那里却看不到。Open Headers 的 DevTools 窗口没有这个限制——它显示的正是提供给页面的标头。',
  'workbench.editors.rule.fields.header.emptyRequest': '没有操作——此规则不改动请求标头',
  'workbench.editors.rule.fields.header.emptyResponse': '没有操作——此规则不改动响应标头',
  'workbench.editors.rule.fields.header.namePlaceholder': '标头名称',
  'workbench.editors.rule.fields.header.valuePlaceholder': '标头值',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': '要追加的值',
  'workbench.editors.rule.fields.header.existingValue': '现有值',
  'workbench.editors.rule.fields.header.switchTo': '切换到{operation}',
  'workbench.editors.rule.fields.header.dragToReorder': '拖动以重新排序',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': '拦截规则',
  'workbench.editors.rule.fields.block.infoSummary': '拦截会在匹配的请求离开浏览器之前取消它们。',
  'workbench.editors.rule.fields.block.infoDescription': '无需配置操作——拦截本身就是操作；条件决定拦截什么。',
  'workbench.editors.rule.fields.block.title': '拦截请求',
  'workbench.editors.rule.fields.block.body': '匹配下方条件的请求将被拦截。浏览器会向页面显示网络错误。',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': '重定向规则',
  'workbench.editors.rule.fields.redirect.infoSummary': '在匹配的请求到达网络之前把它们发送到不同的 URL。',
  'workbench.editors.rule.fields.redirect.infoDescription': '配合“URL 正则”条件时，\\1、\\2 … 会把捕获组代入目标 URL。',
  'workbench.editors.rule.fields.redirect.redirectsTo': '重定向到',
  'workbench.editors.rule.fields.redirect.anotherUrl': '另一个 URL',
  'workbench.editors.rule.fields.redirect.localFile': '本地文件',
  'workbench.editors.rule.fields.redirect.desktopOnly': '在桌面端应用中可用',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    '例如 https://openheaders.com/redirected——配合“URL 正则”条件可使用 \\1、\\2',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': '查询参数规则',
  'workbench.editors.rule.fields.queryParam.infoSummary': '在匹配的请求 URL 上添加、覆盖或移除查询参数。',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    '“全部移除”会去掉整个查询字符串；同一规则中的“添加 / 覆盖”条目随后成为新的查询。“仅覆盖”和“移除”条目已没有可作用的对象，会与“全部移除”一起被忽略。',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    '“全部移除”会去掉整个查询字符串，因此“仅覆盖”和“移除”条目没有可作用的对象，会被忽略。“添加 / 覆盖”条目仍然生效——它们成为新的查询。',
  'workbench.editors.rule.fields.queryParam.removesAllNote': '从 URL 中移除所有查询参数',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': '参数名',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': '参数值',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': '注入规则',
  'workbench.editors.rule.fields.inject.infoSummary': '在匹配的页面加载时向其注入脚本或样式表。',
  'workbench.editors.rule.fields.inject.language': '语言：',
  'workbench.editors.rule.fields.inject.codeSource': '代码来源：',
  'workbench.editors.rule.fields.inject.insert': '插入：',
  'workbench.editors.rule.fields.inject.sourceCode': '代码',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': '页面加载后',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': '尽快',
  'workbench.editors.rule.fields.inject.source': '来源',
  'workbench.editors.rule.fields.inject.code': '代码',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': '输入源 URL（相对或绝对）',
  'workbench.editors.rule.fields.inject.bypassCsp': '绕过 Content-Security-Policy，让注入的脚本始终执行',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    '目前只覆盖标头中的 CSP——<meta> CSP 仍可能拦截此脚本。要同时绕过两者，请在浏览器的扩展设置中为此扩展启用“Allow user scripts”。',
  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': '延迟规则',
  'workbench.editors.rule.fields.delay.infoSummary': '把匹配的请求按配置的时间挂起后再放行。',
  'workbench.editors.rule.fields.delay.capsAlert':
    '文档和 iframe 导航通过本地等待页最多延迟 30,000ms。JS 发起的 XHR/Fetch 封顶于 5,000ms，以避免 HTTP 连接池枯竭。子资源（CSS、JS、图片）不会被延迟。',
  'workbench.editors.rule.fields.delay.label': '延迟',
  'workbench.editors.rule.fields.delay.maxNote': '最大 30,000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': '请求体规则',
  'workbench.editors.rule.fields.requestBody.infoSummary': '在匹配的请求发送之前替换其请求体。',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    '静态数据换入固定的负载；动态则对原始请求体运行 JavaScript。',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    '为 REST 或 GraphQL API 请求拦截 fetch() 和 XMLHttpRequest 调用。',
  'workbench.editors.rule.fields.requestBody.selectResourceType': '选择资源类型',
  'workbench.editors.rule.fields.requestBody.bodyLabel': '请求体',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': '你的函数会接收',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    '，并应返回修改后的请求体。返回字符串或对象（自动序列化为 JSON）。',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': '响应规则',
  'workbench.editors.rule.fields.response.infoSummary': '为匹配的请求提供替代响应，而不是服务器返回的内容。',
  'workbench.editors.rule.fields.response.infoDescription': '静态数据提供固定的负载；动态则对原始响应运行 JavaScript。',
  'workbench.editors.rule.fields.response.sourceLabel': '响应来源',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    '作用于 REST 或 GraphQL API 请求的 fetch() 和 XMLHttpRequest 响应。',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock 不调用服务器，直接提供你的响应体；修改则发送真实请求，并在页面看到之前编辑回复。',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock——不发送请求',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 修改——编辑服务器的回复',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    '真实请求会被发送；你的更改会在页面看到之前应用到回复上。',
  'workbench.editors.rule.fields.response.sourceNoteMock': '请求不会离开浏览器——页面直接得到你的响应。',
  'workbench.editors.rule.fields.response.resourceType': '资源类型',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary': '规则针对哪种 API 负载形态——REST 或 GraphQL。',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL 会解锁下方的操作筛选，让规则可以匹配共享端点内的单个操作。',
  'workbench.editors.rule.fields.response.statusCode': '状态码',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': '随你的响应一起提供的 HTTP 状态。',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    '选择要提供的状态码，或在调用服务器时保留其回复中的原始状态码。',
  'workbench.editors.rule.fields.response.keepOriginalStatus': '保留原始状态码',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    '随正文提供的 Content-Type 标头——控制浏览器如何解析它。',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    '可输入任意值；建议项只是为了方便。调用服务器时，只有设置了它才会覆盖真实回复的 Content-Type。',
  'workbench.editors.rule.fields.response.headersLabel': '响应标头',
  'workbench.editors.rule.fields.response.headersInfoSummary': '随 Content-Type 一起提供的额外标头。',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    '调用服务器时，它们合并覆盖真实回复的标头；Mock 时它们就是回复的标头。空行在保存时会被丢弃。',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': '标头名称（例如 X-Custom）',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': '标头值',
  'workbench.editors.rule.fields.response.addHeader': '添加标头',
  'workbench.editors.rule.fields.response.bodyLabel': '响应体',
  'workbench.editors.rule.fields.response.bodyInfoSummary': '为匹配的请求提供给页面的负载。',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    '静态数据提供固定的响应体；动态（JavaScript）在请求时构建或转换它。',
  'workbench.editors.rule.fields.response.dynNetworkBefore': '真实请求会先发出。你的',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    '函数接收响应和请求上下文，然后返回修改后的响应。返回字符串或对象（自动序列化为 JSON）。',
  'workbench.editors.rule.fields.response.dynMockBefore': '不发送任何请求。你的',
  'workbench.editors.rule.fields.response.dynMockMid': '函数接收',
  'workbench.editors.rule.fields.response.dynMockAfter': '，并返回响应体。返回字符串或对象（自动序列化为 JSON）。',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'WebSocket 规则',
  'workbench.editors.rule.fields.message.sseKicker': 'SSE 规则',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    '在页面或线路看到之前，修改、注入或丢弃匹配连接上的 WebSocket 帧。',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    '在监听器看到之前，修改、注入或丢弃匹配流上的服务器发送事件。',
  'workbench.editors.rule.fields.message.wsIntro':
    '拦截页面创建的、套接字 URL 匹配条件的 WebSocket 连接。帧在页面内被修改、注入或丢弃——发生在到达页面代码（传入）或线路（传出）之前。',
  'workbench.editors.rule.fields.message.sseIntro':
    '拦截页面创建的、URL 匹配条件的 EventSource 流。事件在页面内被修改、注入或丢弃——发生在监听器看到之前。',
  'workbench.editors.rule.fields.message.operation': '操作',
  'workbench.editors.rule.fields.message.opReplace': '替换',
  'workbench.editors.rule.fields.message.opInject': '注入',
  'workbench.editors.rule.fields.message.opDrop': '丢弃',
  'workbench.editors.rule.fields.message.direction': '方向',
  'workbench.editors.rule.fields.message.incoming': '传入（服务器 → 页面）',
  'workbench.editors.rule.fields.message.outgoing': '传出（页面 → 服务器）',
  'workbench.editors.rule.fields.message.eventName': '事件名',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': '留空 = 默认 message 事件',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': '匹配流的',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': '字段',
  'workbench.editors.rule.fields.message.frameFilter': '帧筛选',
  'workbench.editors.rule.fields.message.dataFilter': '数据筛选',
  'workbench.editors.rule.fields.message.everyFrame': '每一帧',
  'workbench.editors.rule.fields.message.everyEvent': '每个事件',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs': '筛选器只匹配文本帧——设置筛选器后，二进制帧会直接通过。',
  'workbench.editors.rule.fields.message.filterNoteSse': '筛选器只匹配文本事件。',
  'workbench.editors.rule.fields.message.injectWhen': '注入时机',
  'workbench.editors.rule.fields.message.connectionOpens': '连接打开时',
  'workbench.editors.rule.fields.message.streamOpens': '流打开时',
  'workbench.editors.rule.fields.message.matchingFrameArrives': '匹配的帧到达时',
  'workbench.editors.rule.fields.message.matchingEventArrives': '匹配的事件到达时',
  'workbench.editors.rule.fields.message.injectedFrame': '注入的帧',
  'workbench.editors.rule.fields.message.injectedEvent': '注入的事件',
  'workbench.editors.rule.fields.message.replacementFrame': '替换帧',
  'workbench.editors.rule.fields.message.replacementEvent': '替换事件',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': '身份验证规则',
  'workbench.editors.rule.fields.auth.infoSummary': '用这些凭据应答匹配请求上的 HTTP 或代理身份验证质询。',
  'workbench.editors.rule.fields.auth.infoDescription':
    '两个字段都会解析 {{templates}}，因此真正的机密可以放在 vault（{{vault.*}}）中，而不是明文写在规则里。仅对调试模式范围内的标签页生效。',
  'workbench.editors.rule.fields.auth.introBefore':
    '应答匹配请求上的服务器（401）或代理（407）身份验证质询。引用一个 vault 机密——例如',
  'workbench.editors.rule.fields.auth.introAfter': '——这样凭据就不会存储在规则里。',
  'workbench.editors.rule.fields.auth.username': '用户名',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': '例如 dev-user 或 {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': '密码',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': '例如 {{vault.STAGING_PW}}',
} as const satisfies Catalog;
