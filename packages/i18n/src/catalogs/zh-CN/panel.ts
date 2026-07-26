/**
 * DevTools panel — shell chrome — Simplified Chinese. Mirrors
 * `catalogs/en/panel.ts` key for key. English boundary raw by design:
 * resource-type pills (All / Fetch/XHR / Doc / …), throttle tier
 * names (Fast 4G, Fiber, DSL, …), CDP method names, header names
 * (User-Agent), event names (DOMContentLoaded / Load), keyboard
 * chords (Alt+C), size and timing units (kB / kbit/s / ms), and the
 * Aa / ab / .* / ▾ / ✓ glyphs; the Network / Storage / Console /
 * Docs tool-window nouns ride raw (panel-docs precedent). Mints:
 * 规则活动 = Rule Activity; 匹配的规则 = Matched Rules (carried);
 * evidence badges 权威 = authoritative / 佐证 = corroborated /
 * 相矛盾 = contradicted (carried) with 已确认 / 间接 / 静默 / 推断
 * carried from popup; HAR 外 = off-HAR; 限速 = throttling; 保留日志
 * = preserve log; 系统覆盖 = system overrides; 活动栏 = activity
 * bar; 底部面板 = bottom panel; 里程碑 = milestone.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': '录制网络日志',
  'panel.toolbar.stopRecording': '停止录制',
  'panel.toolbar.clear': '清除网络日志',
  'panel.toolbar.filter': '筛选',
  'panel.toolbar.search': '搜索',
  'panel.toolbar.preserveLog': '保留日志',
  'panel.toolbar.preserveLogTitle':
    '跨页面导航保留请求。关闭时，每次导航或重新加载都会清空列表，与浏览器自带的 Network 面板一致。',
  'panel.toolbar.aboutPreserveLog': '关于保留日志',
  'panel.toolbar.aboutMoreFilters': '关于更多筛选',
  'panel.toolbar.aboutFooterView': '关于底栏视图',
  'panel.toolbar.moreTools': '更多工具',
  'panel.toolbar.activeWorkspaceAria': '活动工作区：{name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': '左侧边栏',
  'panel.toolbar.bottomPanel': '底部面板',
  'panel.toolbar.rightSidebar': '右侧边栏',
  'panel.toolbar.chooseBottomAlignment': '选择底部面板对齐方式',
  'panel.toolbar.layoutOptions': '布局选项',
  'panel.toolbar.bottomAlignTooltip.center': '底部面板：居中（嵌套）',
  'panel.toolbar.bottomAlignTooltip.left': '底部面板：左对齐',
  'panel.toolbar.bottomAlignTooltip.right': '底部面板：右对齐',
  'panel.toolbar.bottomAlignTooltip.justify': '底部面板：全宽',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomAlignment': '底部面板对齐',
  'panel.layout.alignCenter': '居中（嵌套）',
  'panel.layout.alignLeft': '左',
  'panel.layout.alignRight': '右',
  'panel.layout.alignJustify': '两端（全宽）',
  'panel.layout.showToolWindowNames': '显示工具窗口名称',
  'panel.layout.activityBarLayout': '活动栏布局',
  'panel.layout.sidebarProportional': '按比例（均分两半）',
  'panel.layout.sidebarCompact': '紧凑（底部固定）',
  'panel.layout.sidebarStacked': '堆叠（全部置顶）',
  'panel.layout.sidebarDynamic': '动态（跟随面板高度）',
  'panel.layout.defaultLayoutDonor': '默认布局{unit}',
  'panel.layout.inheritsDefault': '继承默认布局',
  'panel.layout.donorTooltip': '此{unit}是默认的——新{units}会继承此布局。',
  'panel.layout.nonDonorTooltip': '另一个{unit}是默认的——新{units}从那里继承。',
  'panel.layout.resetToDefaults': '重置布局为默认值',
  'panel.layout.restoreHidden': '恢复隐藏的活动栏工具',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': '筛选',
  'panel.filter.clear': '清除',
  'panel.filter.clearAria': '清除筛选',
  'panel.filter.matchCase': '区分大小写（Alt+C）',
  'panel.filter.wholeWord': '全字匹配（Alt+W）',
  'panel.filter.regex': '使用正则表达式（Alt+R）',
  'panel.filter.more': '更多',
  'panel.filter.hiddenClearFilter': '清除筛选',
  'panel.filter.hiddenDismiss': '关闭提示',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': '重置为默认',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': '更多筛选',
  'panel.moreFilters.hideDataUrls': '隐藏 data URL',
  'panel.moreFilters.hideExtensionUrls': '隐藏扩展 URL',
  'panel.moreFilters.blockedRequests': '被拦截的请求',
  'panel.moreFilters.thirdParty': '第三方请求',
  'panel.moreFilters.swRequests': 'Service Worker 请求',
  'panel.moreFilters.ruleApplied': '规则已应用的请求',
  'panel.moreFilters.pageOriginPending': '页面源尚不可用',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': '底栏视图',
  'panel.view.title': '选择底栏显示哪些统计',
  'panel.view.focusedTool': '聚焦的工具',
  'panel.view.focusedToolTitle':
    '底栏跟随聚焦的工具窗口——Storage、Console 和搜索显示各自的摘要；其他工具回退到 Network 行。',
  'panel.view.networkOnly': '仅 Network 工具',
  'panel.view.networkOnlyTitle': '无论哪个工具窗口获得焦点，底栏始终显示 Network 数据。',
  'panel.view.modifiedCount': '已修改数',
  'panel.view.failedCount': '失败数',
  'panel.view.cachedCount': '缓存数',
  'panel.view.pageLabel': '当前页面标签',
  'panel.view.pageLabelTitle': '当日志跨越多次导航时，标明计时里程碑描述的是哪个页面。',
  'panel.view.timingAllNavs': '跨所有导航的计时',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load 覆盖从第一次导航起的整个保留日志时间线（浏览器默认行为）。取消勾选则只报告最近一次导航。',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': '导出流量',
  'panel.export.exportAll': '全部导出为 HAR',
  'panel.export.exportAllSanitized': '全部导出为 HAR（已脱敏）',
  'panel.export.copyAll': '全部复制为 HAR',
  'panel.export.copyAllSanitized': '全部复制为 HAR（已脱敏）',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': '停用缓存',
  'panel.cache.tooltipDebug': '在网络栈层面停用缓存（调试模式）——与浏览器原生的停用缓存一致。',
  'panel.cache.tooltipStandard': '通过强制重新验证绕过 HTTP 缓存。启用调试模式可在网络栈层面完全停用（包括内存缓存）。',
  'panel.cache.aboutAria': '关于停用缓存',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': '不限速',
  'panel.throttle.custom': '自定义',
  'panel.throttle.customEllipsis': '自定义…',
  'panel.throttle.customHint': '设置下载、上传和延迟。',
  'panel.throttle.customTitle': '自定义限速',
  'panel.throttle.download': '下载',
  'panel.throttle.upload': '上传',
  'panel.throttle.latency': '延迟',
  'panel.throttle.appliesToTab': '应用于此标签页',
  'panel.throttle.morePresets': '更多预设',
  'panel.throttle.morePresetsSubtitle': '光纤、有线、DSL、5G、2G。',
  'panel.throttle.wired': '有线',
  'panel.throttle.mobile': '移动网络',
  'panel.throttle.disabledTooltip': '网络限速仅在调试模式下可用。启用调试模式即可对此标签页限速。',
  'panel.throttle.aboutAria': '关于网络限速',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 2 ms 延迟',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 8 ms 延迟',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 25 ms 延迟',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 8 ms 延迟',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 18 ms 延迟',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 165 ms 延迟',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 562.5 ms 延迟',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 2000 ms 延迟',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 2000 ms 延迟',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 3000 ms 延迟',
  'panel.throttle.subtitle.offline': '拦截此标签页的所有网络流量。',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': '应用',
  'panel.debug.enableDebugMode': '启用调试模式',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': '覆盖项',
  'panel.overrides.disabledTooltip': '系统覆盖仅在调试模式下可用。启用调试模式即可覆盖此标签页。',
  'panel.overrides.aboutAria': '关于系统覆盖',
  'panel.overrides.wireHint': '在此标签页保持调试模式期间，随请求发送并上报给页面脚本。',
  'panel.overrides.pageOnlyHint': '仅页面——这些只改变页面自身脚本和 CSS 观察到的内容，不影响请求。',
  'panel.overrides.platform': '平台',
  'panel.overrides.locale': '区域设置',
  'panel.overrides.timezone': '时区',
  'panel.overrides.colorScheme': '配色方案',
  'panel.overrides.reducedMotion': '减少动态效果',
  'panel.overrides.printMedia': '打印媒体',
  'panel.overrides.uaPlaceholder': '自定义 User-Agent 字符串',
  'panel.overrides.alPlaceholder': '例如 fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform，例如 Linux',
  'panel.overrides.localePlaceholder': '真实区域设置',
  'panel.overrides.timezonePlaceholder': '真实时区',
  'panel.overrides.auto': '自动',
  'panel.overrides.light': '浅色',
  'panel.overrides.dark': '深色',
  'panel.overrides.reduce': '减少',
  'panel.overrides.noPref': '无偏好',
  'panel.overrides.screen': '屏幕',
  'panel.overrides.print': '打印',
  'panel.overrides.resetAll': '全部重置',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary': '跨页面导航和重新加载保留已录制的请求，而不是每次页面变化时清空列表。',
  'panel.info.preserveLog.description':
    '开启——日志跨越每次导航延续，重定向、表单提交或重新加载前一刻触发的请求保持可见。关闭——每次导航或重新加载都会清空列表，与浏览器自带的 Network 面板一致，只显示当前页面的流量。',
  'panel.info.preserveLog.whenHeading': '适用场景',
  'panel.info.preserveLog.redirects': '重定向',
  'panel.info.preserveLog.redirectsDesc': '在新页面抹掉它之前，检查触发导航的那个请求。',
  'panel.info.preserveLog.forms': '表单提交 / 登录',
  'panel.info.preserveLog.formsDesc': '页面重新加载后，POST 及其响应保持可见。',
  'panel.info.preserveLog.reloadLoops': '重载循环',
  'panel.info.preserveLog.reloadLoopsDesc': '查看页面自行重新加载前一刻触发了什么。',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary': '收在菜单里的次级请求筛选——每一项都能缩小列表，又不占用一级工具栏空间。',
  'panel.info.moreFilters.hideHeading': '隐藏',
  'panel.info.moreFilters.dataUrls': 'data URL',
  'panel.info.moreFilters.dataUrlsDesc': '排除内联 data: 资源——base64 图片、字体等。',
  'panel.info.moreFilters.extensionUrls': '扩展 URL',
  'panel.info.moreFilters.extensionUrlsDesc': '排除发往浏览器扩展源的请求。',
  'panel.info.moreFilters.onlyHeading': '只显示',
  'panel.info.moreFilters.blocked': '被拦截的请求',
  'panel.info.moreFilters.blockedDesc': '把列表限定为被规则拦截的请求。',
  'panel.info.moreFilters.thirdParty': '第三方请求',
  'panel.info.moreFilters.thirdPartyDesc': '限定为源与页面不同的请求。',
  'panel.info.moreFilters.swRequests': 'Service Worker 请求',
  'panel.info.moreFilters.swRequestsDesc':
    '限定为 Service Worker 相关的交换——worker 自己发出的请求（⚙ 行）以及由其 fetch 处理器应答的页面请求。',
  'panel.info.moreFilters.ruleApplied': '规则已应用的请求',
  'panel.info.moreFilters.ruleAppliedDesc': '限定为可验证被 Open Headers 规则修改过的请求。',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary': '选择底栏在始终显示的请求数和传输量之外，还显示哪些可选统计。',
  'panel.info.view.scopeHeading': '摘要范围',
  'panel.info.view.focusedTool': '聚焦的工具',
  'panel.info.view.focusedToolDesc':
    '底栏跟随聚焦的工具窗口——Storage、Console 和搜索显示各自的摘要行；其他工具回退到 Network 行。',
  'panel.info.view.networkOnly': '仅 Network 工具',
  'panel.info.view.networkOnlyDesc': '无论哪个工具窗口获得焦点，底栏始终显示 Network 数据。',
  'panel.info.view.countsHeading': '底栏计数',
  'panel.info.view.modified': '已修改',
  'panel.info.view.modifiedDesc': '被规则更改过的请求数量。',
  'panel.info.view.failed': '失败',
  'panel.info.view.failedDesc': '出错或被拦截的请求数量。',
  'panel.info.view.cached': '缓存',
  'panel.info.view.cachedDesc': '由缓存提供的响应数量。',
  'panel.info.view.timingHeading': '计时',
  'panel.info.view.pageLabel': '当前页面标签',
  'panel.info.view.pageLabelDesc': '当日志跨越多次导航时，标明计时里程碑描述的是哪个页面。',
  'panel.info.view.allNavs': '跨所有导航',
  'panel.info.view.allNavsDesc': 'Finish / DOMContentLoaded / Load 覆盖整个保留日志时间线，而不只是最近一次导航。',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': '阻止此标签页从缓存中提供响应。',
  'panel.info.cache.debugDesc':
    '此标签页处于调试模式：缓存在网络栈层面被停用——包括内存缓存——与浏览器原生的停用缓存一致。',
  'panel.info.cache.standardDesc':
    '此标签页处于标准模式：只绕过 HTTP 缓存，方式是要求服务器重新验证。启用调试模式可在网络栈层面完全停用，并同时清掉内存缓存。',
  'panel.info.cache.standardHeading': '标准模式',
  'panel.info.cache.revalidateDesc': '添加到每个请求上，让服务器重新检查新鲜度。只绕过 HTTP 缓存。',
  'panel.info.cache.debugHeading': '调试模式',
  'panel.info.cache.cdpDesc': '在网络栈层面为整个标签页停用缓存，包括内存缓存。',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': '系统覆盖',
  'panel.info.overrides.summary':
    '固定此标签页的系统身份——User-Agent、区域设置、时区和模拟媒体——观察站点对不同客户端的反应。',
  'panel.info.overrides.debugDesc':
    '通过调试模式在此标签页上生效。User-Agent 相关维度作用于请求和页面脚本；区域设置、时区和媒体只改变页面自身脚本和 CSS 观察到的内容。“全部重置”恢复真实值。',
  'panel.info.overrides.standardDesc':
    '系统覆盖需要调试模式——没有标准模式的回退。启用调试模式并让此标签页保持在范围内即可覆盖它。',
  'panel.info.overrides.wireHeading': '线路上 + 页面脚本',
  'panel.info.overrides.uaDesc': '设置 User-Agent / Accept-Language 标头、平台以及相应的 navigator.* 值。',
  'panel.info.overrides.pageHeading': '仅页面',
  'panel.info.overrides.localeDesc': '改变页面脚本读取到的区域设置。',
  'panel.info.overrides.timezoneDesc': '改变 Date 和 Intl 解析出的时区。',
  'panel.info.overrides.mediaDesc': '强制 color-scheme / reduced-motion / print 媒体查询。',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': '网络限速',
  'panel.info.throttle.summary': '通过限制此标签页的带宽并增加延迟来模拟较慢的连接。',
  'panel.info.throttle.debugDesc':
    '通过调试模式在此标签页上生效。选择一个预设——默认项加上“更多预设”里的光纤 / 有线 / DSL 和 5G / 2G——或转为 Offline，或自定义下载 / 上传 / 延迟。',
  'panel.info.throttle.standardDesc':
    '限速需要调试模式——没有标准模式的回退。启用调试模式并让此标签页保持在范围内即可限速。',
  'panel.info.throttle.presetsHeading': '预设',
  'panel.info.throttle.fast4gDesc': '下行 ≈8.1 Mbit/s，165 ms 延迟。',
  'panel.info.throttle.slow4gDesc': '下行 ≈1.44 Mbit/s，562.5 ms 延迟。',
  'panel.info.throttle.3gDesc': '≈400 kbit/s，2000 ms 延迟。',
  'panel.info.throttle.offlineDesc': '拦截此标签页的所有网络流量。',
  'panel.info.throttle.wiredHeading': '更多预设 · 有线',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s，2 ms 延迟。',
  'panel.info.throttle.cableDesc': '下行 ≈200 Mbit/s，8 ms 延迟。',
  'panel.info.throttle.dslDesc': '下行 ≈20 Mbit/s，25 ms 延迟。',
  'panel.info.throttle.mobileHeading': '更多预设 · 移动网络',
  'panel.info.throttle.fast5gDesc': '下行 ≈100 Mbit/s，8 ms 延迟。',
  'panel.info.throttle.slow5gDesc': '下行 ≈30 Mbit/s，18 ms 延迟。',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s，2000 ms 延迟。',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s，3000 ms 延迟。',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 个请求' }),
  'panel.status.requestsSubset': '{subset} / {total} 个请求',
  'panel.status.modified': '{count} 个已修改',
  'panel.status.modifiedTitle': '被你的规则修改过的请求',
  'panel.status.failed': '{count} 个失败',
  'panel.status.failedTitle': '失败或错误状态的请求',
  'panel.status.cached': '{count} 个缓存',
  'panel.status.cachedTitle': '由缓存提供的请求',
  'panel.status.transferredOnly': '已传输 {size}',
  'panel.status.transferredAndResources': '已传输 {transferred} / 资源 {resources}',
  'panel.status.transferredSubset': '已传输 {subset} / {total}',
  'panel.status.resourcesSubset': '资源 {subset} / {total}',
  'panel.status.finish': 'Finish：{time}',
  'panel.status.loadEventTitle': 'Load 事件',
  'panel.status.tabs': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 个标签页' }),
  'panel.status.messagesOf': '{visible} / {total} 条消息',
  'panel.status.messages': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 条消息' }),
  'panel.status.errors': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 个错误' }),
  'panel.status.errorsTitle': '错误级别的控制台消息',
  'panel.status.warnings': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 个警告' }),
  'panel.status.warningsTitle': '警告级别的控制台消息',
  'panel.status.systemStatus': '系统',
  'panel.status.theme.light': '浅色',
  'panel.status.theme.dark': '深色',
  'panel.status.theme.auto': '自动',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': '搜索',
  'panel.toolWindows.notifications': '通知',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': '规则活动',
  'panel.toolWindows.matchedRules': '匹配的规则',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': '搜索（按 Enter）',
  'panel.search.inputAria': '搜索已捕获的数据',
  'panel.search.syntaxHelp': '搜索语法帮助',
  'panel.search.run': '搜索',
  'panel.search.runTitle': '运行搜索（Enter）',
  'panel.search.cancel': '取消',
  'panel.search.cancelTitle': '取消搜索',
  'panel.search.idleHintMin': '输入查询（至少 2 个字符）并按 Enter 搜索。',
  'panel.search.idleHintShort': '按 Enter 搜索。',
  'panel.search.noMatches': '未找到匹配项。',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': '正在搜索… {done} / {total}',
  'panel.search.status.noResults': '无结果 · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), { other: '找到 {count} 个匹配' });
    const where = plural(locale, Number(files), { other: '{count} 个文件' });
    return `在 ${where} 中${found} · ${String(elapsed)}`;
  },
  'panel.search.status.capped': '显示前 {shown} 个——细化查询以查看其余',

  // Result groups + rows
  'panel.search.group.countTitle': '此文件中有 {count} 个匹配',
  'panel.search.group.countTitleCapped': '此文件中有 {count} 个匹配——显示前 {shown} 个',
  'panel.search.row.lineCol': '第 {line} 行，第 {col} 列',
  'panel.search.row.line': '第 {line} 行',
  'panel.search.row.matchesOnLine': '此行有 {count} 个匹配',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': '选择一个请求，查看作用于它的',
  'panel.matchedRules.selectPrompt.tail': '规则',
  'panel.matchedRules.matchedCount': '已匹配 · {count}',
  'panel.matchedRules.futureCount': '未来匹配 · {count}',
  'panel.matchedRules.noMatched': '没有规则匹配此请求。',
  'panel.matchedRules.noFuture': '没有其他规则会匹配此请求。',
  'panel.matchedRules.pattern': '模式：{pattern}',
  'panel.matchedRules.wouldMatch': '将会匹配',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': '相矛盾',
  'panel.matchedRules.evidence.authoritative': '权威',
  'panel.matchedRules.evidence.confirmed': '已确认',
  'panel.matchedRules.evidence.fallback': '间接',
  'panel.matchedRules.evidence.silent': '静默',
  'panel.matchedRules.evidence.corroborated': '佐证',
  'panel.matchedRules.evidence.inferred': '推断',
  'panel.matchedRules.evidenceTitle.contradicted': '相矛盾——捕获的标头证伪了此规则声称的修改。',
  'panel.matchedRules.evidenceTitle.authoritative': '权威——规则引擎确认此 DNR 规则已在该请求上执行。',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    '已确认——规则在页面上下文中修改了响应体，且此请求的两侧（送达版与原始版）均已捕获。',
  'panel.matchedRules.evidenceTitle.confirmed': '由页面内报告器确认——可脚本化操作已在页面内运行。',
  'panel.matchedRules.evidenceTitle.fallback': '由 URL 匹配推断——预期会有可脚本化确认，但未到达。',
  'panel.matchedRules.evidenceTitle.silent':
    '模式已匹配，但请求由缓存 / Service Worker 提供——没有 DNR 或可脚本化操作运行。',
  'panel.matchedRules.evidenceTitle.corroborated': '佐证——声称的修改在捕获的标头中可见。',
  'panel.matchedRules.evidenceTitle.inferred': '由 URL 匹配推断——按其条件，此规则会匹配此请求。',
  'panel.matchedRules.contradiction.stillPresent': '{header} 仍然存在（{observed}）。',
  'panel.matchedRules.contradiction.missing': '{header} 不在捕获的标头中。',
  'panel.matchedRules.contradiction.otherValue': '{header} 携带的是 "{observed}"，而非声称的值。',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': '规则已删除',
  'panel.matchedRules.ruleState.disabled': '规则已禁用',
  'panel.matchedRules.ruleState.modified': '规则已修改',
  'panel.matchedRules.ruleStateTitle.deleted': '此规则在触发之后已被删除。此行显示的是它在触发时做了什么。',
  'panel.matchedRules.ruleStateTitle.disabled': '此规则在触发之后已被禁用——它不会应用于下一个请求。',
  'panel.matchedRules.ruleStateTitle.modified':
    '此规则在触发之后已被编辑。此行显示的是它在触发时做了什么；悬停查看当前规则。',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': '此标签页上尚无规则活动。',
  'panel.ruleActivity.toolbarHint': '按规则分组的规则活动。',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': '已应用',
  'panel.ruleActivity.hint.appliedDesc':
    '的触发已确认运行——规则引擎报告规则已执行、页面内报告器确认操作已运行，或修改在捕获的标头中可见。',
  'panel.ruleActivity.hint.contradicted': '相矛盾',
  'panel.ruleActivity.hint.contradictedDesc': '的触发声称的标头更改被捕获的标头证伪。',
  'panel.ruleActivity.hint.inferred': '推断',
  'panel.ruleActivity.hint.inferredDesc': '的触发把你的规则模式与观察到的请求相匹配，但无法确认。',
  'panel.ruleActivity.hint.offHar': 'HAR 外',
  'panel.ruleActivity.hint.offHarDesc': '的触发是面板未捕获的请求上的规则匹配。',
  'panel.ruleActivity.hits': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 次命中' }),
  'panel.ruleActivity.applied': '{count} 个已应用',
  'panel.ruleActivity.contradicted': '{count} 个相矛盾',
  'panel.ruleActivity.offHar': '{count} 个 HAR 外',
  'panel.ruleActivity.offHarTitle': 'HAR 外——面板没有为此次触发捕获 HAR 外壳',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': '规则',
  'panel.valueDoc.saveHint': '重新编码编辑后的值并写回规则',
  'panel.valueDoc.blockedHintInvalid': '编辑后的文本无法按此值类型编码',
  'panel.valueDoc.blockedHintDetached': '此值所属的规则字段已不存在',
  'panel.valueDoc.rereadTitle': '从规则重新读取该值',
  'panel.valueDoc.rereadConfirm': '将丢弃你的编辑——再次点击以重新读取',
  'panel.valueDoc.rereadAria': '丢弃编辑并重新读取值',
  'panel.valueDoc.openRuleTitle': '在工作区编辑器中打开此规则',
  'panel.valueDoc.openRule': '在工作区中打开规则',
  'panel.valueDoc.driftNote': '在你编辑期间，规则中的该值已发生变化——你未保存的编辑仍保留。保存会覆盖它。',
  'panel.valueDoc.undetectedNote': '该字段不再持有此编辑器能编码的值——你未保存的编辑保留以供复制。',
  'panel.valueDoc.detachedNote': '此值所属的规则字段已不存在——你未保存的编辑保留以供复制。',
  'panel.valueDoc.discardEdits': '丢弃我的编辑',
  'panel.valueDoc.saveFailed.detached': '此值所属的修改已从规则中消失——没有可写入的目标。',
  'panel.valueDoc.saveFailed.notFound': '未找到规则——它可能已被删除。',
  'panel.valueDoc.saveFailed.write': '保存失败——规则拒绝了写入。',
  'panel.valueDoc.encodedPreview': '编码预览',
  'panel.valueDoc.cannotEncode': '无法编码——编辑后的值对此类型无效',
  'panel.valueDoc.undetectedTitle': '不再是编码值',
  'panel.valueDoc.undetectedSub': '该字段的当前值与任何解码器都不匹配——请改在规则编辑器中编辑。',
  'panel.valueDoc.detachedTitle': '值已不在规则中',
  'panel.valueDoc.detachedSub': '持有此值的规则或修改已被删除，或该操作不再携带值。',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  // The crumb's source name rides raw as data; the type title comes
  // from the shared value-editor title keys.
  'panel.valueView.snapshotNote': '快照',
  'panel.valueView.snapshotTitle': '在此文档打开时捕获——不跟随之后的变化。',
  'panel.valueView.encodedValue': '编码值',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  // Rule names ride raw as data; status codes and MIME values stay raw.
  'panel.ruleDoc.crumbKind': '响应覆盖',
  'panel.ruleDoc.nameLabel': '规则名称',
  'panel.ruleDoc.saveHint': '保存覆盖规则——同一步骤中保持已发布状态',
  'panel.ruleDoc.saveHintCreate': '创建并发布该规则',
  'panel.ruleDoc.blockedHintDetached': '此文档所属的规则已不存在',
  'panel.ruleDoc.rereadTitle': '重新读取该规则',
  'panel.ruleDoc.rereadConfirm': '将丢弃你的编辑——再次点击以重新读取',
  'panel.ruleDoc.rereadAria': '丢弃编辑并重新读取规则',
  'panel.ruleDoc.openRuleTitle': '在工作区编辑器中打开此规则',
  'panel.ruleDoc.openRule': '在工作区中打开',
  'panel.ruleDoc.saveFailed.notFound': '未找到规则——它可能已被删除。',
  'panel.ruleDoc.saveFailed.write': '保存失败——规则拒绝了写入。',
  'panel.ruleDoc.detachedTitle': '规则已不存在',
  'panel.ruleDoc.detachedSub': '此文档正在编辑的覆盖规则已被删除。',
  'panel.ruleDoc.dynamicTitle': '动态响应体规则',
  'panel.ruleDoc.dynamicSub': 'JavaScript 响应体在工作区编辑器中编辑。',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': '第 {current} / {total} 步',
  'panel.tour.previous': '上一步',
  'panel.tour.next': '下一步',
  'panel.tour.finish': '完成',
  'panel.tour.welcomeTitle': '统一的 DevTools 体验',
  'panel.tour.welcomeSubtitle': '内置你的规则的网络调试器。',
  'panel.tour.welcomeCapture': '捕获',
  'panel.tour.welcomeCaptureHint': '——实时请求，含时序、标头与大小',
  'panel.tour.welcomeRules': '归因',
  'panel.tour.welcomeRulesHint': '——查看每个请求上生效的规则及其原因',
  'panel.tour.welcomeState': '检查',
  'panel.tour.welcomeStateHint': '——Cookie、存储与控制台就在流量旁边',
  'panel.tour.networkTitle': 'Network 窗口',
  'panel.tour.networkSubtitle': '被检查标签页发出的每个请求，实时呈现。',
  'panel.tour.networkFilters': '过滤',
  'panel.tour.networkFiltersHint': '——按文本、资源类型或“更多过滤器”预设',
  'panel.tour.networkToolbar': '控制',
  'panel.tour.networkToolbarHint': '——顶部有保留日志、节流与停用缓存',
  'panel.tour.networkExport': '导出',
  'panel.tour.networkExportHint': '——将整个日志保存或复制为 HAR',
  'panel.tour.storageTitle': 'Storage 窗口',
  'panel.tour.storageSubtitle': '被检查标签页的客户端状态，尽收一处。',
  'panel.tour.storageAreas': '浏览',
  'panel.tour.storageAreasHint': '——本地与会话存储、Cookie、IndexedDB、缓存',
  'panel.tour.storageEdit': '编辑',
  'panel.tour.storageEditHint': '——将任意条目作为文档标签页打开并就地修改',
  'panel.tour.inspectorTitle': '请求详情',
  'panel.tour.inspectorSubtitle': '选择一个请求，在此处作为标签页打开。',
  'panel.tour.inspectorTabs': '分区',
  'panel.tour.inspectorTabsHint': '——标头、负载、响应、时序与 Cookie',
  'panel.tour.inspectorEdit': '覆盖',
  'panel.tour.inspectorEditHint': '——不离开面板即可从请求创建规则',
  'panel.tour.matchedTitle': '请求规则',
  'panel.tour.matchedSubtitle': '哪些规则匹配了所选请求——以及哪些会在下一个请求上生效。',
  'panel.tour.layoutTitle': '按你的方式布局',
  'panel.tour.layoutSubtitle': '两侧边栏承载更多工具窗口。',
  'panel.tour.layoutTools': '更多工具',
  'panel.tour.layoutToolsHint': '——Console、搜索、Docs 与通知都在边栏上',
  'panel.tour.layoutDrag': '重新排布',
  'panel.tour.layoutDragHint': '——在停靠区之间拖动工具窗口；布局菜单可重置',
  'panel.tour.debugTitle': '调试模式',
  'panel.tour.debugSubtitle': '默认关闭——需要更深入的捕获时在此开启。',
  'panel.tour.debugUnlocks': '解锁',
  'panel.tour.debugUnlocksHint': '——响应体、控制台、精确时序与脚本层级规则',
  'panel.tour.debugBanner': '请注意',
  'panel.tour.debugBannerHint': '——开启期间，浏览器会在已附加的标签页上显示调试横幅',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': '已解码',
  'panel.valueExpander.raw': '原始',
} as const satisfies Catalog;
