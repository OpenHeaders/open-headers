/**
 * Popup namespace — Simplified Chinese. Mirrors `catalogs/en/popup.ts`
 * key for key; see that file for the namespace rules and English
 * boundary. Extends the zh-CN register contract (`zh-CN/shared.ts`).
 * Mints: matched request = 匹配的请求; fire = 触发 (carried); evidence
 * chips 被遮蔽 = shadowed (遮蔽检测 = shadow detection) / 已确认 =
 * confirmed / 间接 = fallback / 静默 = silent / 已匹配 = matched;
 * delivery chips: live raw / 缓存 / raw sw; 交付 = delivery (column);
 * 证据 = evidence; 导览 = tour guide; 徽章 = badge; 裁决 =
 * arbitration; 相关域名 = related domain; 集合 carried; 桌面端 =
 * Desktop tag; 空白规则 = blank rule; 溢出菜单 = overflow menu;
 * exclude chip prefix = 排除. Rule-type option labels translate
 * (product vocabulary); resource-type parity labels stay literal in
 * the components. Browser-menu mocks quote the browsers' own zh UI
 * （Chrome 开发者/开发者工具，Safari 设置/显示网页开发者功能）; the
 * status-popover subsystem names (Sync, Rules, …) ride verbatim raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': '无法切换视图',
  'popup.header.switchToSidePanel': '切换到侧边栏（浏览时保持打开）',
  'popup.header.switchToPopup': '切换到弹窗模式（点击工具栏图标）',
  'popup.header.rulesResumed': '规则执行已恢复',
  'popup.header.rulesPaused': '规则执行已暂停',
  'popup.header.rulesLabel': '规则',
  'popup.header.resumeRules': '恢复规则执行',
  'popup.header.pauseRules': '暂停所有规则（保留每条规则的单独设置）',
  'popup.header.openSettings': '打开设置',
  'popup.header.notifications': '通知',
  'popup.header.openNotifications': '打开通知',
  'popup.header.activeWorkspace': '活动工作区：{name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': '活动',
  'popup.status.paused': '已暂停',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': '如何找到我们强大的浏览器开发者工具。',
  'popup.footer.networkDebug': '网络调试。',
  'popup.footer.tagline': '本该如此',
  'popup.footer.keyboardShortcuts': '键盘快捷键',
  'popup.footer.systemStatus': '系统状态',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': '此页面',
  'popup.tabs.allRules': '全部规则',
  'popup.tabs.collections': '集合',
  'popup.tabs.openWorkspaceEditor': '打开完整的工作区编辑器',
  'popup.tabs.workspace': '工作区',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': '删除 “{name}”？',
  'popup.deleteConfirm.confirm': '确认',
  'popup.deleteConfirm.cancel': '取消',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': '搜索任何内容…',
  'popup.table.sortOrder': '排序方式',
  'popup.table.sortOrderHeading': '排序方式',
  'popup.table.sortByStatus': '按状态',
  'popup.table.sortByPriority': '按优先级',
  'popup.table.sortByColumn': '按列',
  'popup.table.sortWorkspaceOrder': '工作区顺序',
  'popup.table.sortWorkspaceOrderHint': '与工作区侧边栏树的顺序一致',
  'popup.table.sortByColumnHint': '已按 {column} 排序——点击上方任一选项以重置',
  'popup.table.sortByPriorityHint': '拦截 → 重定向 → 查询 → 标头 → 注入 · 各组内按 A-Z',
  'popup.table.sortByStatusHintAll': '活动 → 已暂停 → 已禁用 → 草稿 · 各组内按优先级',
  'popup.table.sortByStatusHintThisPage': '活动 → 已暂停 → 已禁用 · 各组内按优先级',
  'popup.table.sortByStatusHintCollections': '活动 → 已暂停 · 各组内按 A-Z',
  'popup.table.columnName': '名称',
  'popup.table.columnDetails': '详情',
  'popup.table.columnConditions': '条件',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': '启停规则失败',
  'popup.rule.deleted': '规则已删除',
  'popup.rule.deleteFailed': '删除规则失败',
  'popup.rule.edit': '编辑规则',
  'popup.rule.delete': '删除规则',
  'popup.rule.deleteOk': '删除',
  'popup.rule.notConnected': '应用未连接',
  'popup.rule.desktopTag': '桌面端',
  'popup.rule.comingSoon': '即将推出',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': '规则',
  'popup.rules.activeSummary': '{active} / {total} 活动',
  'popup.rules.draftSuffix': '，{count} 个草稿',
  'popup.rules.pausedByCollection': '{count} 条被集合暂停',
  'popup.rules.addRule': '添加规则',
  'popup.rules.addRuleTooltip': '添加规则——跨类型和模板搜索',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 条规则' })} 匹配`,
  'popup.rules.emptyNoMatch': '未找到匹配的规则',
  'popup.rules.emptyNone': '还没有规则',
  'popup.rules.emptyHint': '点击“添加规则”来修改浏览器的实时请求',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': '集合',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { other: '{count} 个集合' })}，${plural(locale, Number(rules), {
      other: '{count} 条规则',
    })}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 个集合' })} 匹配`,
  'popup.collections.emptyNoMatch': '未找到匹配的集合',
  'popup.collections.emptyNone': '没有集合',
  'popup.collections.emptyHint': '在工作区编辑器中创建规则，并将它们整理进集合',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `已启用 ${String(enabled)} / ${plural(locale, Number(total), { other: '{count} 条规则' })}`,
  'popup.collections.pausedEnabledSummary': '已暂停 · 已启用 {enabled} / {total}',
  'popup.collections.resumeTooltip': '恢复——将 {count} 条规则固定为活动（必要时覆盖上级）',
  'popup.collections.pauseTooltip': '暂停——挂起 {count} 条规则，不更改单独设置',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': '所有域名',
  'popup.conditions.none': '无条件',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': '正则',
  'popup.conditions.short.requestDomains': '域名',
  'popup.conditions.short.excludeRequestDomains': '排除域名',
  'popup.conditions.short.initiatorDomains': '来自',
  'popup.conditions.short.excludeInitiatorDomains': '排除来自',
  'popup.conditions.short.requestMethods': '方法',
  'popup.conditions.short.excludeRequestMethods': '排除方法',
  'popup.conditions.short.resourceTypes': '资源',
  'popup.conditions.short.excludeResourceTypes': '排除资源',
  'popup.conditions.short.domainType': '域类型',
  'popup.conditions.short.responseHeader': '响应标头',
  'popup.conditions.short.excludeResponseHeader': '排除响应标头',
  'popup.conditions.full.urlFilter': 'URL 模式',
  'popup.conditions.full.urlRegex': 'URL 正则',
  'popup.conditions.full.requestDomains': '域名',
  'popup.conditions.full.excludeRequestDomains': '排除域名',
  'popup.conditions.full.initiatorDomains': '发起者',
  'popup.conditions.full.excludeInitiatorDomains': '排除发起者',
  'popup.conditions.full.requestMethods': '方法',
  'popup.conditions.full.excludeRequestMethods': '排除方法',
  'popup.conditions.full.resourceTypes': '资源',
  'popup.conditions.full.excludeResourceTypes': '排除资源',
  'popup.conditions.full.domainType': '域类型',
  'popup.conditions.full.responseHeader': '响应标头',
  'popup.conditions.full.excludeResponseHeader': '排除响应标头',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': '名称',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': '数量',
  'popup.actionDetail.type': '类型',
  'popup.actionDetail.duration': '时长',
  'popup.actionDetail.format': '格式',
  'popup.actionDetail.status': '状态',
  'popup.actionDetail.value': '值',
  'popup.actionDetail.position': '位置',
  'popup.actionDetail.body': '正文',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': '标签',
  'popup.actionDetail.headers': '标头',
  'popup.actionDetail.params': '参数',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': '正在加载当前标签页信息…',
  'popup.thisPage.noTab': '无法获取当前标签页信息',
  'popup.thisPage.columnMatch': '匹配',
  'popup.thisPage.expandHeaderBadgeHint': '点击每行的徽章查看匹配的请求',
  'popup.thisPage.expandHeaderDocsHint': '点击下方图标查看文档',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 个请求' })} 匹配 “${String(
      query,
    )}”——点击展开`,
  'popup.thisPage.badgeNone': '尚无匹配的请求——点击展开',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 个匹配的请求' })}，全部由缓存提供（静默）——点击展开`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { other: '{count} 个匹配的请求' })}已触发 + ${String(
      silent,
    )} 个静默（缓存）——点击展开`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 个匹配的请求' })}——点击展开`,
  'popup.thisPage.systemPage': '系统页面',
  'popup.thisPage.systemPageHint': '标头规则不适用于浏览器系统页面',
  'popup.thisPage.emptyNoRules': '没有规则匹配此页面',
  'popup.thisPage.emptyNoRulesHint': '尚未为此域名配置任何规则',
  'popup.thisPage.ruleDisabled': '规则已禁用',
  'popup.thisPage.rulePausedByGroup': '规则被其集合或文件夹暂停',
  'popup.thisPage.zeroRelated': '规则针对相关域名——尚未观察到发往该域名的请求。页面发出请求时它会触发。',
  'popup.thisPage.zeroPage': '模式匹配此页面，但尚未观察到匹配的请求。与页面交互或重新加载以触发它们。',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '全部 {count} 个匹配的请求' }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} / {total} 个匹配的请求',
  'popup.thisPage.shadowTooltip':
    '{prefix}被 “{name}”（更高优先级的拦截规则）终止——因此此规则对它们没有可见效果。实验性功能：遮蔽检测可能高报或漏报。可在设置中禁用以隐藏。',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `脚本已确认在此页面上${plural(locale, Number(count), { other: '触发 {count} 次' })}（来自页面内注入的确证）。`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `通过 URL 匹配了 ${plural(locale, Number(count), {
      other: '{count} 个请求',
    })}，但页面内脚本报告器未确认。常见原因：严格的 Content-Security-Policy 阻止了注入，或资源类型（stylesheet、image、manifest link）绕过了 fetch/XHR 拦截。`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `模式匹配了 ${plural(locale, Number(count), {
      other: '{count} 个缓存的子资源',
    })}——响应绕过了网络，操作无法运行。绕过缓存重新加载以强制发出新请求。`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `在此页面上匹配了 ${plural(locale, Number(count), {
      other: '{count} 个请求',
    })}。Chrome 的 declarativeNetRequest 不会报告多条规则同时匹配时哪条胜出——我们观察的是 URL 匹配，而非裁决结果。`,
  'popup.thisPage.pausedTagTooltip': '集合或文件夹已暂停——规则未应用',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 条规则' })}被集合暂停`,
  'popup.thisPage.firing': '{count} 个触发中',
  'popup.thisPage.silentCached': '{count} 个静默（缓存）',
  'popup.thisPage.related': '{count} 个相关',
  'popup.thisPage.liveMonitoring': 'Live——正在监控请求',
  'popup.thisPage.visibleResourceTypes': '可见的资源类型',
  'popup.thisPage.showAll': '显示全部',
  'popup.thisPage.filterResourceTypes': '筛选资源类型',
  'popup.thisPage.filterResourceTypesCount': '筛选资源类型（显示 {shown} / {total}）',
  'popup.thisPage.requestCount': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 个请求' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个静默请求（缓存）' }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 个请求' })}（${String(silent)} 个静默）`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 条规则' })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 个请求' })}`,
  'popup.thisPage.matchedJoin': '{parts} 匹配',
  'popup.thisPage.copyTsv': '以 TSV 复制请求',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': '时间',
  'popup.matched.columnUrl': '请求 URL',
  'popup.matched.columnType': '类型',
  'popup.matched.columnDelivery': '交付',
  'popup.matched.columnEvidence': '证据',
  'popup.matched.columnPattern': '模式',
  'popup.matched.matchedBy': '匹配自',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': '缓存',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip': '请求在本会话中经过了网络；响应不是由缓存提供的。',
  'popup.matched.deliveryCachedTip':
    '响应由 Chrome 的 HTTP 缓存提供。你的规则在该响应最初获取时或在重新验证往返中已应用。',
  'popup.matched.deliverySwTip':
    '一个 Service Worker 拦截了该请求。你的规则是否生效取决于该 Service Worker 接下来的行为。',
  'popup.matched.evidenceShadowed': '被遮蔽',
  'popup.matched.evidenceShadowedTip': '此请求被 “{name}”（更高优先级的拦截规则）终止。此规则从未在其上运行。',
  'popup.matched.evidenceConfirmed': '已确认',
  'popup.matched.evidenceConfirmedTip': '脚本通过页面内注入确认了此次触发——规则确实运行了的确证。',
  'popup.matched.evidenceFallback': '间接',
  'popup.matched.evidenceFallbackTip':
    '通过 URL 匹配，但页面内脚本报告器未确认。常见原因：严格的 Content-Security-Policy 阻止了 MAIN-world 注入，或资源类型（stylesheet、image、manifest link）绕过了 fetch/XHR 拦截。',
  'popup.matched.evidenceSilent': '静默',
  'popup.matched.evidenceSilentTip':
    '模式匹配了此子资源，但响应由缓存 / Service Worker / bfcache 提供，规则的操作无法运行。绕过缓存重新加载以强制发出新请求。',
  'popup.matched.evidenceMatched': '已匹配',
  'popup.matched.evidenceMatchedTip':
    'URL 匹配了此规则的条件。Chrome 的 declarativeNetRequest 不会报告裁决中哪条规则胜出——我们观察的是 URL 匹配，而非执行。',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${String(matched)} / ${plural(locale, Number(total), { other: '{count} 个请求' })} 匹配 “${String(query)}”`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '{count} 个请求' })}匹配`,
  'popup.matched.emptySearch': '没有匹配的请求包含 “{query}”。清除或放宽搜索以查看全部匹配。',
  'popup.matched.emptyRelated': '规则针对相关域名——页面向该域名发出请求时会出现匹配。',
  'popup.matched.emptyPage': '模式匹配此页面。页面发出符合模式的请求时会出现匹配——与页面交互或重新加载以触发它们。',
  'popup.matched.emptyNone': '尚无匹配的请求——重新加载页面以捕获。',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': '标头',
  'popup.ruleType.block': '拦截',
  'popup.ruleType.redirect': '重定向',
  'popup.ruleType.queryParam': '查询参数',
  'popup.ruleType.inject': '注入',
  'popup.ruleType.requestBody': 'API 请求',
  'popup.ruleType.delay': '延迟',
  'popup.ruleType.response': 'API 响应',
  'popup.ruleType.headerDesc': '修改 HTTP 标头',
  'popup.ruleType.blockDesc': '拦截请求',
  'popup.ruleType.redirectDesc': '重定向请求',
  'popup.ruleType.queryParamDesc': '修改查询参数',
  'popup.ruleType.injectDesc': '注入脚本或 CSS',
  'popup.ruleType.requestBodyDesc': '修改 API 请求体（fetch/XHR）',
  'popup.ruleType.delayDesc': '延迟响应',
  'popup.ruleType.responseDesc': '模拟或修改 API 响应（fetch/XHR）',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': '直接匹配页面 URL',
  'popup.resourceType.subFrameTip': '应用于此页面加载的 iframe',
  'popup.resourceType.xhrTip': '应用于 fetch() 和 XMLHttpRequest 调用',
  'popup.resourceType.scriptTip': '应用于脚本资源',
  'popup.resourceType.stylesheetTip': '应用于样式表',
  'popup.resourceType.imageTip': '应用于图片',
  'popup.resourceType.fontTip': '应用于字体文件',
  'popup.resourceType.mediaTip': '应用于音频/视频资源',
  'popup.resourceType.websocketTip': '应用于 WebSocket 连接',
  'popup.resourceType.pingTip': '应用于 ping/beacon 请求',
  'popup.resourceType.otherTip': '应用于其他资源',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': '空白规则',
  'popup.palette.searchPlaceholder': '搜索规则类型和模板…',
  'popup.palette.noMatches': '没有与 “{query}” 匹配的结果',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': '键盘快捷键',
  'popup.shortcuts.press': '按',
  'popup.shortcuts.or': '或',
  'popup.shortcuts.toClose': '关闭',
  'popup.shortcuts.groupNavigation': '导航',
  'popup.shortcuts.groupActions': '操作',
  'popup.shortcuts.groupRow': '表格行',
  'popup.shortcuts.groupBrowser': '浏览器',
  'popup.shortcuts.groupTour': '导览',
  'popup.shortcuts.openExtension': '打开扩展',
  'popup.shortcuts.customize': '自定义扩展快捷键 ↗',
  'popup.shortcuts.toggleDebugMode': '切换调试模式',
  'popup.shortcuts.tabThisPage': '“此页面”标签页',
  'popup.shortcuts.tabAllRules': '“全部规则”标签页',
  'popup.shortcuts.tabCollections': '“集合”标签页',
  'popup.shortcuts.focusSearch': '聚焦搜索框',
  'popup.shortcuts.prevPage': '上一页',
  'popup.shortcuts.nextPage': '下一页',
  'popup.shortcuts.addRule': '添加新规则',
  'popup.shortcuts.openWorkspace': '打开工作区',
  'popup.shortcuts.openSettings': '打开设置',
  'popup.shortcuts.toggleSurface': '在弹窗 / 侧边栏之间切换',
  'popup.shortcuts.toggleRulesPause': '暂停 / 恢复所有规则',
  'popup.shortcuts.togglePauseFocused': '暂停 / 恢复集合或文件夹',
  'popup.shortcuts.toggleOptionsMenu': '选项菜单',
  'popup.shortcuts.cycleTheme': '循环切换主题',
  'popup.shortcuts.toggleCompactMode': '紧凑模式',
  'popup.shortcuts.toggleShortcutsHelp': '本面板',
  'popup.shortcuts.moveDown': '下移',
  'popup.shortcuts.moveUp': '上移',
  'popup.shortcuts.expandRow': '展开 / 进入子行',
  'popup.shortcuts.collapseRow': '折叠 / 退出子行',
  'popup.shortcuts.toggleRow': '开 / 关',
  'popup.shortcuts.editRow': '编辑规则',
  'popup.shortcuts.copyValue': '复制值',
  'popup.shortcuts.deleteRow': '删除（按两次）',
  'popup.shortcuts.openTourGuide': '打开导览',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': '第 {current} / {total} 步',
  'popup.tour.previous': '上一步',
  'popup.tour.next': '下一步',
  'popup.tour.finish': '完成',
  'popup.tour.welcomeTitle': '欢迎使用 Open Headers',
  'popup.tour.welcomeSubtitle': '实时拦截并修改 HTTP 流量。',
  'popup.tour.modify': '修改',
  'popup.tour.modifyDesc': '标头、Cookie、身份验证 token、CORS、负载',
  'popup.tour.route': '路由',
  'popup.tour.routeDesc': '重定向请求、拦截跟踪器、改写 URL',
  'popup.tour.debug': '调试',
  'popup.tour.debugDesc': '检查实时请求、注入脚本、覆盖响应',
  'popup.tour.migrateSwitching': '正在从以下工具切换：',
  'popup.tour.migrateOr': '或',
  'popup.tour.migrateButton': '从其他工具迁移',
  'popup.tour.tabsTitle': '在标签页之间切换',
  'popup.tour.tabsSubtitle': '按数字键即可立即切换。',
  'popup.tour.thisPageHint': '——匹配当前标签页的规则',
  'popup.tour.allRulesHint': '——你创建的所有规则',
  'popup.tour.tagsLabel': '标签',
  'popup.tour.tagsHint': '——组织并暂停分组',
  'popup.tour.workspaceTitle': '你的工作区',
  'popup.tour.workspaceSubtitle': '完整编辑器——在独立标签页中打开。',
  'popup.tour.workspaceRequests': 'API 客户端',
  'popup.tour.workspaceRequestsHint': '——创建、发送并保存 API 请求',
  'popup.tour.workspaceWorkflows': '工作流',
  'popup.tour.workspaceWorkflowsHint': '——把请求串联成自动化运行',
  'popup.tour.workspaceEnvs': '环境与变量',
  'popup.tour.workspaceEnvsHint': '——还有导入、规则和团队同步',
  'popup.tour.navTitle': '浏览与导航规则',
  'popup.tour.navSubtitle': '用键盘快捷键在行间导航',
  'popup.tour.keyMove': '移动',
  'popup.tour.keyExpand': '展开',
  'popup.tour.keyToggle': '开关',
  'popup.tour.keyEdit': '编辑',
  'popup.tour.keyCopy': '复制',
  'popup.tour.keyDelete': '删除',
  'popup.tour.devtoolsTitle': '在 DevTools 中调试网络',
  'popup.tour.findThePrefix': '在 DevTools 中找到',
  'popup.tour.findTheSuffix': '标签页：',
  'popup.tour.devtoolsHint': '随时点击此按钮查看设置步骤。',
  'popup.tour.shortcutsTitle': '所有键盘快捷键',
  'popup.tour.shortcutsSubtitle': '弹窗完全可用键盘操作。',
  'popup.tour.pressLabel': '按',
  'popup.tour.shortcutsHint': '随时查看所有快捷键',
  'popup.tour.debugModeTitle': '调试模式',
  'popup.tour.debugModeSubtitle': '完全掌控浏览器实时流量。',
  'popup.tour.debugModeReqRes': '请求与响应',
  'popup.tour.debugModeReqResHint': '——实时改写标头、正文和状态码',
  'popup.tour.debugModeStreams': 'WebSocket 与 SSE',
  'popup.tour.debugModeStreamsHint': '——检查并编辑流式消息',
  'popup.tour.debugModeScripts': '脚本与存储',
  'popup.tour.debugModeScriptsHint': '——注入脚本，检查 Cookie 与存储',
  'popup.tour.statusTitle': '系统状态',
  'popup.tour.statusSubtitle': '点击圆点查看 Sync、Rules、Requests、Permissions、Secrets 和 Live 各子系统的健康状况。',
  'popup.tour.statusGreen': '绿色',
  'popup.tour.statusGreenDesc': '——一切正常',
  'popup.tour.statusYellow': '黄色',
  'popup.tour.statusYellowDesc': '——某个子系统报告警告',
  'popup.tour.statusRed': '红色',
  'popup.tour.statusRedDesc': '——某个子系统已失败',
  'popup.tour.growTitle': '帮助我们成长',
  'popup.tour.growSubtitle': '帮助我们成长，触达更多开发者。',
  'popup.tour.starGithub': '在 GitHub 上给我们一颗星',
  'popup.tour.recommend': '把我们推荐给你的朋友和同事',
  'popup.tour.growHint': '这些随时可以在铃铛下找到。',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': '修改标头、请求与响应',
  'popup.devtools.featureTabs': '多标签页的请求元数据面板',
  'popup.devtools.featureSearch': '高级搜索与筛选',
  'popup.devtools.featureDock': '拖放侧边栏面板',
  'popup.devtools.addOverride': '+ 添加/覆盖',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': '调试网络',
  'popup.debug.step1': '打开浏览器 DevTools',
  'popup.debug.step1a': '在常规页面上，例如',
  'popup.debug.notPrefix': '不要用',
  'popup.debug.notSuffix': '或新标签页（扩展在那里被禁止）。',
  'popup.debug.onPlatform': '在 {platform} 上',
  'popup.debug.menuHintSafari': '先启用“开发”菜单——Safari → 设置 → 高级 → “显示网页开发者功能”。',
  'popup.debug.clickThePrefix': '点击',
  'popup.debug.clickTheSuffix': '标签页',
  'popup.debug.overflowPrefix': '最后一个标签页——可能藏在',
  'popup.debug.overflowSuffix': '溢出菜单中。',
  'popup.debug.step3': '为你的调试加满马力',
  'popup.debug.menuGlyphAria': '打开“视图”菜单 → 开发者 → 开发者工具',
  'popup.debug.tabGlyphAria': 'DevTools 已停靠并选中 Open Headers 标签页——侧边栏、网络列表和多标签拆分窗格',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': '开发者',
  'popup.debug.menuGlyphDeveloperTools': '开发者工具',
} as const satisfies Catalog;
