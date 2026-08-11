/**
 * Shared component families — Simplified Chinese. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for the
 * family rules and the raw-by-design technical plane (`{{ns.*}}` refs,
 * generator/claim names, algorithm names, key caps, embedded code in
 * template descriptions). Mints: 陈旧 = stale; 覆盖 rides the ops mint
 * for override; 模拟 = mock (verb); 停靠栏 = dock; 工具窗口 = tool
 * window; 生成器 = generator; 签名密钥 = signing secret (distinct from
 * the vault 机密); 质询 = auth challenge; 跨源 = cross-origin
 * (distinct from the minted 跨站 = cross-site); 拦截 = block (rule
 * verb); 跟踪器 = tracker; JWT Header/Payload/Claims/Signature ride
 * raw (RFC 7519 structure vocabulary, fr/es/de precedent); Docs title
 * raw; Workbench surface label = 工作区编辑器 (awareness mint).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': '编辑值',
  'shared.templateInput.showValue': '显示值',
  'shared.templateInput.hideValue': '隐藏值',
  'shared.templateInput.clearValue': '清除值',
  'shared.templateInput.unresolvedDot': '包含未解析的变量',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': '创建变量“{name}”',
  'shared.templateInput.createNamedInScope': '在 {scope} 中创建变量“{name}”',
  'shared.templateInput.noMatches': '无匹配项',
  'shared.templateInput.footerNavigate': '↑↓ 导航',
  'shared.templateInput.footerSelect': '↵ 选择',
  'shared.templateInput.footerClose': 'esc 关闭',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': '在运行时捕获',
  'shared.templateInput.totpPreview': 'TOTP {digits} 位 · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits} 位 · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '（空）',
  'shared.templateInput.staleBadge': '陈旧',
  'shared.templateInput.needsRerunBadge': '需要重新运行',
  'shared.templateInput.disabledBadge': '已禁用',
  // Namespace-scaffold / reserved rows: core mints the English subtitle
  // for its own (locale-free) plane; the UI resolves these keys from the
  // row's kind + scope instead of rendering core's copy.
  'shared.templateInput.scaffold.vault': '添加机密',
  'shared.templateInput.scaffold.env': '添加环境变量',
  'shared.templateInput.scaffold.collection': '添加集合变量',
  'shared.templateInput.scaffold.workspace': '添加工作区变量',
  'shared.templateInput.scaffold.dynamic': '内置生成器——uuid、timestamp、…',
  'shared.templateInput.reservedFile': '文件引用即将推出',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': '输入值',
  'shared.templateInput.foundIn': '出现于：',
  'shared.templateInput.scopeFixedTooltip': '作用域由 {prefix} 前缀固定——编辑引用以更改。',
  'shared.templateInput.addToScope': '添加到：{scope}',
  'shared.templateInput.addToPickScope': '添加到：选择作用域',
  'shared.templateInput.resolvedDefault': '解析结果：默认',
  'shared.templateInput.resolvedDefaultNoEnv': '解析结果：默认（无活动环境）',
  'shared.templateInput.noActiveEnvHint': '未选择环境——在环境切换器中选择一个，以添加环境变量。',
  'shared.templateInput.noCollectionHint': '没有活动集合——打开一个集合以添加集合变量。',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': '环境 · {name}',
  'shared.templateInput.scope.collectionNamed': '集合 · {name}',
  'shared.templateInput.scope.workspace': '工作区',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · 覆盖',
  'shared.templateInput.scope.stepNamed': '步骤 · {capture}',
  'shared.templateInput.scope.fileNamed': '文件 · {name}',
  'shared.templateInput.scope.dynamic': '动态',
  'shared.templateInput.scope.unresolved': '未解析',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': '环境',
  'shared.templateInput.createScope.collection': '集合',
  'shared.templateInput.createScope.workspace': '工作区',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': '无活动环境',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': '空引用',
  'shared.templateInput.unresolved.unknownNamespace': '未知命名空间',
  'shared.templateInput.unresolved.dynamic': '没有该名称的内置生成器。从 {{dynamic.…}} 建议列表中选择一个。',
  'shared.templateInput.unresolved.step': '仅在 Live 工作流链运行时解析。',
  'shared.templateInput.unresolved.envNotSet': '未在环境“{name}”中设置。',
  'shared.templateInput.unresolved.noActiveEnv': '未选择活动环境。',
  'shared.templateInput.unresolved.live': '没有该名称的 Live 变量（或尚无缓存值）。',
  'shared.templateInput.unresolved.notDefined': '未在任何作用域中定义。',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': '请从“添加到”中选择作用域',
  'shared.templateInput.save.totpInVaultEditor': 'TOTP 机密必须在 Vault 编辑器中编辑',
  'shared.templateInput.save.vaultKindChanged': 'Vault 条目种类已被外部更改',
  'shared.templateInput.save.notEditable': '不可编辑',
  'shared.templateInput.save.noActiveEnv': '无活动环境',
  'shared.templateInput.save.noCollection': '上下文中没有集合',
  'shared.templateInput.save.saved': '已保存',
  'shared.templateInput.save.duplicateName': '此作用域中已存在同名变量。',
  'shared.templateInput.save.notFound': '未找到变量——可能已被删除。',
  'shared.templateInput.save.failed': '保存失败',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': '设为变量',
  'shared.templateInput.setAsNewVariable': '设为新变量',
  'shared.templateInput.variableName': '变量名称',
  'shared.templateInput.variableValue': '变量值',
  'shared.templateInput.valuePlaceholder': '值',
  'shared.templateInput.menu.cut': '剪切',
  'shared.templateInput.menu.paste': '粘贴',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Vault 机密',
  'shared.templateInput.completion.scope.env': '环境',
  'shared.templateInput.completion.scope.collection': '集合',
  'shared.templateInput.completion.scope.workspace': '工作区',
  'shared.templateInput.completion.scope.live': '来源',
  'shared.templateInput.completion.scope.step': '来源流程步骤捕获',
  'shared.templateInput.completion.scope.file': '文件引用',
  'shared.templateInput.completion.scope.dynamic': '动态生成器',
  'shared.templateInput.completion.staleSuffix': '（陈旧）',
  'shared.templateInput.completion.comingSoon': '即将推出',
  'shared.templateInput.completion.capturedAtRuntime': '在运行时捕获',
  'shared.templateInput.completion.totpDetail': 'TOTP 代码（{digits} 位，{period}s）',
  'shared.templateInput.completion.valueHiddenSensitive': '值已隐藏（敏感作用域）。',
  'shared.templateInput.completion.valueHiddenStale': '值已隐藏（陈旧的 Live 变量）。',
  'shared.templateInput.completion.valueDoc': '**值：**`{value}`',
  'shared.templateInput.completion.staleValueDoc': '**陈旧值：**`{value}`',
  'shared.templateInput.completion.capturedWhenRuns': '在工作流运行时捕获。',
  'shared.templateInput.completion.totpDoc': '**TOTP 代码**——{algorithm}，{digits} 位，每 {period}s 刷新。',
  'shared.templateInput.completion.totpDocIssuer':
    '**{issuer}** 的 **TOTP 代码**——{algorithm}，{digits} 位，每 {period}s 刷新。',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': '已解码',
  'shared.valueEditors.encodedPreview': '编码预览',
  'shared.valueEditors.cannotEncode': '无法编码——编辑后的值对此类型无效',
  'shared.valueEditors.encodedCopied': '编码值已复制到剪贴板',
  'shared.valueEditors.copyFailed': '复制到剪贴板失败',
  'shared.valueEditors.openAsDocument': '作为文档打开',
  'shared.valueEditors.decode': '解码',
  'shared.valueEditors.decodeChipView': '查看解码结果——{title}',
  'shared.valueEditors.decodeChipEdit': '解码并编辑——{title}',
  'shared.valueEditors.editJwt': '编辑 JWT',
  'shared.valueEditors.viewJwt': '查看 JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': '解码后的值',
  'shared.valueEditors.glance.openTab': '在新标签页中打开',
  'shared.valueEditors.glance.openModal': '以模态框打开',
  'shared.valueEditors.glance.moreClaims': '+{count} 项',
  'shared.valueEditors.glance.signatureElided': '未显示 Signature——打开文档或模态框查看完整 token。',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': '名称',
  'shared.valueEditors.grid.key': '键',
  'shared.valueEditors.grid.value': '值',
  'shared.valueEditors.grid.flag': '标志',
  'shared.valueEditors.grid.ariaNamePairs': '名称/值对',
  'shared.valueEditors.grid.ariaKeyPairs': '键/值对',
  'shared.valueEditors.grid.ariaRowName': '第 {row} 行名称',
  'shared.valueEditors.grid.ariaRowKey': '第 {row} 行键',
  'shared.valueEditors.grid.ariaRowValue': '第 {row} 行值',
  'shared.valueEditors.grid.moveRowUp': '将第 {row} 行上移',
  'shared.valueEditors.grid.moveRowDown': '将第 {row} 行下移',
  'shared.valueEditors.grid.deleteRow': '删除第 {row} 行',
  'shared.valueEditors.grid.addRow': '添加行',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT 编辑器',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': '已修改',
  'shared.valueEditors.jwt.decodeErrorTitle': '无法解码 token',
  'shared.valueEditors.jwt.decoded': '已解码',
  'shared.valueEditors.jwt.encoded': '已编码',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims：',
  'shared.valueEditors.jwt.rawToken': '原始 token',
  'shared.valueEditors.jwt.pasteOrEdit': '粘贴或编辑原始 token',
  'shared.valueEditors.jwt.notDecodable': '不是可解码的 JWT',
  'shared.valueEditors.jwt.structure': '结构：',
  'shared.valueEditors.jwt.resignWithSecret': '用密钥重新签名',
  'shared.valueEditors.jwt.algFromHeader': '来自 Header 的 {algorithm}',
  'shared.valueEditors.jwt.signingSecret': '签名密钥',
  'shared.valueEditors.jwt.secretMemoryNote': '仅保存在内存中，编辑器关闭后即丢弃。',
  'shared.valueEditors.jwt.tokenExpired': 'token 已过期',
  'shared.valueEditors.jwt.tokenNotExpired': 'token 未过期',
  'shared.valueEditors.jwt.expiredOn': '已于 {date} 过期',
  'shared.valueEditors.jwt.expiresOn': '将于 {date} 过期',
  'shared.valueEditors.jwt.resigned': '已用 {algorithm} 重新签名 token',
  'shared.valueEditors.jwt.resignedDescription': '保存会写入用你的密钥签名的 token——上方预览与保存内容完全一致。',
  'shared.valueEditors.jwt.cannotResign': '无法重新签名此算法',
  'shared.valueEditors.jwt.cannotResignDescription':
    '只有 HMAC 算法（HS256、HS384、HS512）可以在这里重新签名。原始签名将被原样保留。',
  'shared.valueEditors.jwt.signError': '无法签名 token',
  'shared.valueEditors.jwt.signatureInvalid': '签名不再有效',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    '原始签名被原样保留，因此验证签名的服务器会拒绝编辑后的 token。输入签名密钥以重新签名。',
  'shared.valueEditors.jwt.copied': 'JWT 已复制到剪贴板',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'JWT payload',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL 编码值',
  'shared.valueEditors.valueTitle.base64': 'Base64 值',
  'shared.valueEditors.valueTitle.hex': '十六进制编码值',
  'shared.valueEditors.valueTitle.timestamp': 'Unix 时间戳',
  'shared.valueEditors.valueTitle.json': 'JSON 值',
  'shared.valueEditors.valueTitle.jsonString': '带引号的字符串',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Cookie 值',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP 日期',
  'shared.valueEditors.valueTitle.queryString': '查询字符串',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Link 标头',
  'shared.valueEditors.valueTitle.authParams': '授权参数',
  'shared.valueEditors.valueTitle.acceptList': 'Accept 列表',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Vault 机密',
  'shared.scopeColors.environment': '环境变量',
  'shared.scopeColors.collection': '集合变量',
  'shared.scopeColors.workspace': '工作区变量',
  'shared.scopeColors.live': 'Live 变量（基于工作流）',
  'shared.scopeColors.step': '工作流步骤捕获',
  'shared.scopeColors.file': '文件引用',
  'shared.scopeColors.dynamic': '动态生成器',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': '以 JWT 编辑',
  'shared.valueEditors.editTooltip.urlEncoded': '编辑 URL 编码值',
  'shared.valueEditors.editTooltip.base64': '编辑 Base64 值',
  'shared.valueEditors.editTooltip.hex': '编辑十六进制编码值',
  'shared.valueEditors.editTooltip.timestamp': '编辑时间戳',
  'shared.valueEditors.editTooltip.json': '以 JSON 编辑',
  'shared.valueEditors.editTooltip.jsonString': '编辑带引号的字符串',
  'shared.valueEditors.editTooltip.dataUri': '编辑 data URI 内容',
  'shared.valueEditors.editTooltip.cookie': '编辑 Cookie 对',
  'shared.valueEditors.editTooltip.csp': '编辑 CSP 指令',
  'shared.valueEditors.editTooltip.httpDate': '编辑 HTTP 日期',
  'shared.valueEditors.editTooltip.queryString': '编辑查询对',
  'shared.valueEditors.editTooltip.cacheControl': '编辑缓存指令',
  'shared.valueEditors.editTooltip.hsts': '编辑 HSTS 指令',
  'shared.valueEditors.editTooltip.contentDisposition': '编辑 disposition 参数',
  'shared.valueEditors.editTooltip.link': '编辑链接',
  'shared.valueEditors.editTooltip.authParams': '编辑授权参数',
  'shared.valueEditors.editTooltip.acceptList': '编辑 Accept 列表',

  // ── Default entity names (multi-surface: sidebar create actions +
  //    save-modal prefilled collection create). 'User Templates' is NOT
  //    here — it identity-compares against the background seed and
  //    stays raw everywhere. ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': '新建规则集合',
  'shared.defaults.newRequestsCollection': '新建请求集合',
  'shared.defaults.newEnvironment': '新建环境',
  'shared.defaults.newSpec': '新建规范',

  // ── Rule-type registry (multi-surface: workbench create menus +
  //    overviews + command palette + tool-window info, popup
  //    AddRulePalette). Labels and descriptions single-source every
  //    create/picker menu; type ids and code badges (HDR…) stay raw. ──
  'shared.ruleTypes.header.label': '修改标头',
  'shared.ruleTypes.header.description': '添加、覆盖或移除 HTTP 标头',
  'shared.ruleTypes.requestBody.label': '修改 API 请求体',
  'shared.ruleTypes.requestBody.description': '覆盖或转换 API 请求体（仅 fetch/XHR）',
  'shared.ruleTypes.response.label': '修改 API 响应',
  'shared.ruleTypes.response.description': '模拟或修改 API 响应的状态、响应体和标头（仅 fetch/XHR）',
  'shared.ruleTypes.queryParam.label': '修改查询参数',
  'shared.ruleTypes.queryParam.description': '添加、覆盖或移除 URL 参数',
  'shared.ruleTypes.inject.label': '注入脚本/样式表',
  'shared.ruleTypes.inject.description': '向页面注入 JavaScript 或 CSS',
  'shared.ruleTypes.ws.label': '修改 WebSocket 消息',
  'shared.ruleTypes.ws.description': '替换、注入或丢弃 WebSocket 帧（仅页面套接字）',
  'shared.ruleTypes.sse.label': '修改服务器发送事件',
  'shared.ruleTypes.sse.description': '替换、注入或丢弃 SSE 事件（仅页面流）',
  'shared.ruleTypes.block.label': '拦截请求',
  'shared.ruleTypes.block.description': '阻止请求完成',
  'shared.ruleTypes.redirect.label': '重定向请求',
  'shared.ruleTypes.redirect.description': '重定向到不同的 URL',
  'shared.ruleTypes.delay.label': '延迟请求',
  'shared.ruleTypes.delay.description': '为网络请求增加延迟（仅 fetch/XHR）',
  'shared.ruleTypes.auth.label': '应答身份验证质询',
  'shared.ruleTypes.auth.description': '为 HTTP/代理身份验证质询提供凭据（需要调试模式）',

  // ── System rule-template registry (same surfaces as the rule types).
  //    Template keys, icons, conditions, and form values stay raw data;
  //    embedded code/URLs inside descriptions travel inside the value. ──
  'shared.ruleTemplates.blankRule': '空白规则',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS 与安全',
  'shared.ruleTemplates.folder.authentication': '身份验证',
  'shared.ruleTemplates.folder.privacy': '隐私',
  'shared.ruleTemplates.folder.testing': '测试',
  'shared.ruleTemplates.folder.urlHandling': 'URL 处理',
  'shared.ruleTemplates.folder.tracking': '跟踪',
  'shared.ruleTemplates.folder.debugging': '调试',
  'shared.ruleTemplates.folder.appearance': '外观',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': '状态码',
  'shared.ruleTemplates.folder.dynamic': '动态',

  'shared.ruleTemplates.corsBypass.name': 'CORS 绕过',
  'shared.ruleTemplates.corsBypass.description': '移除限制性 CORS 标头，允许开发期间的跨源请求',
  'shared.ruleTemplates.removeCsp.name': '移除 CSP',
  'shared.ruleTemplates.removeCsp.description': '在开发中去除 Content-Security-Policy 标头',
  'shared.ruleTemplates.allowEmbedding.name': '允许嵌入',
  'shared.ruleTemplates.allowEmbedding.description': '移除 X-Frame-Options 以允许 iframe 嵌入',
  'shared.ruleTemplates.apiAuth.name': 'API 授权注入',
  'shared.ruleTemplates.apiAuth.description': '自动向 API 调用注入 Authorization 标头',
  'shared.ruleTemplates.customUa.name': '自定义 User-Agent',
  'shared.ruleTemplates.customUa.description': '为特定域覆盖 User-Agent 标头',
  'shared.ruleTemplates.blockCookies.name': '拦截 Cookie',
  'shared.ruleTemplates.blockCookies.description': '从传出请求中移除 Cookie 标头',
  'shared.ruleTemplates.testMerge.name': '合并测试（httpbin）',
  'shared.ruleTemplates.testMerge.description':
    '通过向响应标头追加内容来测试合并操作。\n1. 启用此规则\n2. 在新标签页中打开 httpbin.org\n3. 在控制台中运行：' +
    'fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",r.headers.get("Content-Type"))})' +
    '\n4. Content-Type 应显示 "application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': '拦截跟踪器',
  'shared.ruleTemplates.blockTrackers.description': '拦截分析和跟踪脚本',
  'shared.ruleTemplates.blockAds.name': '拦截广告',
  'shared.ruleTemplates.blockAds.description': '拦截常见广告网络域名',
  'shared.ruleTemplates.redirectDomain.name': '重定向域名',
  'shared.ruleTemplates.redirectDomain.description': '将一个域名的所有流量重定向到另一个域名',
  'shared.ruleTemplates.forceHttps.name': '强制 HTTPS',
  'shared.ruleTemplates.forceHttps.description': '将 HTTP 升级为 HTTPS——使用正则捕获组保留完整路径',
  'shared.ruleTemplates.removeUtm.name': '移除 UTM 参数',
  'shared.ruleTemplates.removeUtm.description': '从 URL 中去除 UTM 跟踪参数',
  'shared.ruleTemplates.addDebug.name': '添加调试标志',
  'shared.ruleTemplates.addDebug.description': '为 API 调用添加 debug=true 查询参数',
  'shared.ruleTemplates.darkMode.name': '深色模式 CSS',
  'shared.ruleTemplates.darkMode.description': '注入基础的深色模式样式表',
  'shared.ruleTemplates.consoleLogger.name': '控制台记录器',
  'shared.ruleTemplates.consoleLogger.description': '把所有 fetch 请求记录到控制台',
  'shared.ruleTemplates.slowApi.name': '慢速 API（2s）',
  'shared.ruleTemplates.slowApi.description': '为 API 调用增加 2 秒延迟——测试加载状态',
  'shared.ruleTemplates.timeoutTest.name': '超时测试（5s）',
  'shared.ruleTemplates.timeoutTest.description': '增加 5 秒延迟——测试超时处理',
  'shared.ruleTemplates.restBodyOverride.name': 'REST 请求体覆盖',
  'shared.ruleTemplates.restBodyOverride.description': '用静态 JSON 负载替换请求体',
  'shared.ruleTemplates.graphqlOverride.name': 'GraphQL 覆盖',
  'shared.ruleTemplates.graphqlOverride.description': '用自定义查询和变量覆盖 GraphQL 请求体',
  'shared.ruleTemplates.mock200.name': '模拟 200 JSON',
  'shared.ruleTemplates.mock200.description': '为 REST API 端点返回成功的 JSON 响应',
  'shared.ruleTemplates.mock404.name': '模拟 404',
  'shared.ruleTemplates.mock404.description': '返回 404 Not Found 响应',
  'shared.ruleTemplates.mock500.name': '模拟服务器错误',
  'shared.ruleTemplates.mock500.description': '返回 500 Internal Server Error——测试错误处理',
  'shared.ruleTemplates.mockGraphql.name': '模拟 GraphQL 响应',
  'shared.ruleTemplates.mockGraphql.description': '为特定 GraphQL 操作返回自定义响应',
  'shared.ruleTemplates.mockDynamic.name': '动态 REST 响应',
  'shared.ruleTemplates.mockDynamic.description':
    '拦截真实的 REST API 响应并用 JavaScript 修改——注入测试数据、移除字段或转换响应结构',
  'shared.ruleTemplates.mockDynamicGraphql.name': '动态 GraphQL 响应',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    '拦截特定 GraphQL 操作的响应并用 JavaScript 修改——重塑数据、注入模拟字段或模拟错误',

  // ── Dock-layout chrome (shared shell: workbench + devtools panel).
  //    Slot labels feed the Move-to submenu, drop-zone overlays, and
  //    the restore rows on both surfaces. ────────────────────────────
  'shared.dock.slot.leftTop': '左上',
  'shared.dock.slot.leftBottom': '左下',
  'shared.dock.slot.rightTop': '右上',
  'shared.dock.slot.rightBottom': '右下',
  'shared.dock.slot.bottomLeft': '底部左侧',
  'shared.dock.slot.bottomRight': '底部右侧',
  'shared.dock.slot.bottomTop': '底部上方',
  'shared.dock.slot.bottomBottom': '底部下方',
  'shared.dock.hide': '隐藏',
  'shared.dock.moveTo': '移动到',
  'shared.dock.currentSlot': '当前槽位',
  'shared.dock.showToolWindowNames': '显示工具窗口名称',
  'shared.dock.hideThisDock': '隐藏此停靠栏',
  'shared.dock.closeDock': '关闭停靠栏',
  'shared.dock.panelOptions': '面板选项',
  'shared.dock.hidePanel': '隐藏面板',

  // ── Docs panel chrome (shared reader: workbench + devtools panel).
  //    Registry titles/summaries resolve per-surface via the
  //    raw-or-key DocSection idiom; these are the reader's own
  //    labels. Key caps / chords (↑↓ ↵ esc ← →) stay raw. ─────────────
  'shared.docs.title': 'Docs',
  'shared.docs.contents': '目录',
  'shared.docs.ariaOpenToc': '打开目录',
  'shared.docs.ariaCloseToc': '关闭目录',
  'shared.docs.filterPlaceholder': '筛选章节',
  'shared.docs.noMatches': '无匹配项',
  'shared.docs.hint.navigate': '导航',
  'shared.docs.hint.open': '打开',
  'shared.docs.hint.back': '返回',
  'shared.docs.hint.contents': '目录',
  'shared.docs.previous': '上一篇',
  'shared.docs.next': '下一篇',
  'shared.docs.previousTooltip': '上一篇：{title}',
  'shared.docs.nextTooltip': '下一篇：{title}',

  // ── Docs section primitives (shared: workbench + devtools panel).
  //    Callout kind labels, the Example block's structural labels, the
  //    surface-context banner, and the in-section TOC header. The DNR
  //    engine tag, BrowserTag versions, and every SVG-internal label
  //    (incl. the surface-glyph <title>s) stay raw. ────────────────────
  'shared.docs.callout.note': '说明',
  'shared.docs.callout.warning': '警告',
  'shared.docs.callout.tip': '提示',
  'shared.docs.callout.limitation': '限制',
  'shared.docs.example.rule': '规则：',
  'shared.docs.example.before': '之前：',
  'shared.docs.example.after': '之后：',
  'shared.docs.example.appliesTo': '适用于：',
  'shared.docs.example.wontApply': '不适用：',
  'shared.docs.example.suggestion': '建议：',
  'shared.docs.onThisPage': '本页内容',
  'shared.docs.copyCode': '复制代码',
  'shared.docs.surfaces.header': '你会在哪里看到它',
  'shared.docs.surfaces.popup': '弹窗',
  'shared.docs.surfaces.sidePanel': '侧边栏',
  'shared.docs.surfaces.workbench': '工作区编辑器',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': '基于脚本',

  // ── Split-layout orientation (shared/split-layout) — overflow-menu
  //    entries for the two-pane split direction. ─────────────────────
  'shared.splitLayout.horizontal': '水平布局——并排',
  'shared.splitLayout.vertical': '垂直布局——堆叠',

  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': '显示 {count} 条更早的',
  'shared.timelineGroup.showNewestOnly': '仅显示最新 {count} 条',
  // Compose-editor toolbar wrap toggle + the "Editor" dropdown.
  'shared.codeEditor.wrap': '自动换行',
  'shared.editorMenu.label': '编辑器',
  'shared.editorMenu.thisEditor': '此编辑器',
  'shared.editorMenu.allEditors': '所有编辑器',
  'shared.editorMenu.lineNumbers': '行号',
  'shared.editorMenu.whitespace': '空白字符',
  'shared.editorMenu.lineEnds': '行尾符',
  // Peer-execute refusal notice (the quoted phrases are the settings
  // rows' own labels, verbatim).
  'shared.peerExecute.localDisabled':
    '从此设备的浏览器发送请求已在桌面应用中关闭。请在 设置 → 后端 中启用“允许此设备的浏览器发送请求”。',
  'shared.peerExecute.remoteDisabled':
    '从其他设备发送请求已在所连接的主机上关闭。请在那台机器的 设置 → 后端 中启用“允许其他已连接设备发送请求”。',
  'shared.peerExecute.enableCta': '在桌面应用中启用',

  // ── Desktop teaser ─────────────────────────────────────────────────
  'shared.desktopTeaser.cta': '下载桌面应用',
  'shared.desktopTeaser.openApp': '在桌面应用中打开',
  'shared.desktopTeaser.launchApp': '打开桌面应用',
  'shared.desktopTeaser.otherPlatforms': '其他平台与通道',
  'shared.desktopTeaser.terminal.title': '集成终端',
  'shared.desktopTeaser.terminal.body': '在工作区中打开真正的终端——你自己的 shell 在本地运行，就在规则和请求旁边。',
  'shared.desktopTeaser.git.title': 'Git 历史',
  'shared.desktopTeaser.git.body': '浏览工作区的提交时间线，查看每个提交的详情和文件差异。',
  'shared.desktopTeaser.proxy.title': '捕获代理',
  'shared.desktopTeaser.proxy.body': '使用内置代理实时捕获 HTTP(S) 流量，在请求发生的同时进行检查。',
  'shared.desktopTeaser.mcp.title': 'AI · MCP 服务器',
  'shared.desktopTeaser.mcp.body': '通过内置的 MCP 服务器，把 AI 助手连接到你的工作区。',
  'shared.desktopTeaser.liveNetwork.title': '实时网络',
  'shared.desktopTeaser.liveNetwork.body': '在桌面应用中实时查看浏览器标签页的流量，由扩展流式传输——无需 DevTools。',
} as const satisfies Catalog;
