/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, `A → Z`, header names, and every wire token. Option
 * labels quote the shipped zh-CN panel menus verbatim（失败优先 /
 * 最慢优先 / 最大优先 / 浏览器优先级 / 按资源类型 / 按域名 /
 * 规则修改过的优先 / 升序 / 降序 / 紧凑 / 宽 / 聚焦的工具 /
 * 仅 Network 工具 / 分组 / 平铺 / 原始顺序 / 原始（原样）/ 相对 /
 * 绝对 / 始终 / 悬停时 / 时间戳 / 本地 / 显示标签 / 显示建议 /
 * 显示负载预览 / 显示规则触发圆点 / 自定义（嵌套）+ the timing view
 * rows）. MINTS: 底栏 = the panel status bar (footer, panel.ts
 * precedent); 顶栏 = top bar; 范围 carries the footer scope sense
 * (作用域 stays variable/cookie scope, S19 law).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': '在底栏显示版本',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description': '在 DevTools 面板的底栏显示扩展的版本号。',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': '在底栏显示主题切换器',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    '在 DevTools 面板的底栏显示浅色/深色/自动主题下拉菜单。',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': '在底栏显示已修改数',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    '在 DevTools 面板的底栏显示你的规则实际修改了多少个请求。',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': '在底栏显示失败数',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    '在 DevTools 面板的底栏显示有多少个请求失败或返回了错误状态。',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': '在底栏显示缓存数',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    '在 DevTools 面板的底栏显示有多少个请求由缓存提供服务。',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': '在底栏显示当前页面',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    '在 DevTools 面板的底栏为计时里程碑标明它们描述的页面——在跨多次导航保留日志时很有用。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': '底栏计时范围',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    '底栏中的 Finish / DOMContentLoaded / Load 里程碑描述哪一次导航。聚合覆盖从第一次导航起的整个保留日志时间线（与浏览器一致）；仅当前页面只报告最近一次导航。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': '聚合（所有导航）',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load 覆盖从第一次导航起的整个时间线——浏览器默认行为。',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': '仅当前页面',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load 只报告最近一次导航，以其开始时刻为零点。',
  'workbench.settings.def.devpanelLayout.footerScope.label': '底栏摘要范围',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    '底栏汇总什么内容。聚焦的工具跟随你正在使用的工具窗口（Storage、Console 和搜索有各自的摘要行）；仅 Network 工具则始终显示 Network 数据。',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': '聚焦的工具',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    '底栏跟随聚焦的工具窗口——Storage、Console 和搜索显示各自的摘要；其他工具回退到 Network 行。',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': '仅 Network 工具',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    '无论哪个工具窗口获得焦点，底栏始终显示 Network 数据。',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': '在顶栏显示面板开关',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    '在 DevTools 面板的顶栏显示左侧/底部/右侧面板的启停图标。',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': '在顶栏显示布局菜单',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    '在 DevTools 面板的顶栏显示布局下拉菜单（底部全宽、工具窗口名称、活动栏布局）。',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': '底部面板对齐',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    '底部面板在 DevTools 面板中的位置。左/右将它对齐到一个侧边栏 + 编辑器之下；居中把它嵌套在中间列内；两端则横跨全宽。',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': '居中',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description': '底部面板嵌套在中间列内',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': '左',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description': '底部面板横跨左侧边栏 + 编辑器',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': '右',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    '底部面板横跨编辑器 + 右侧边栏',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': '两端',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    '底部面板横跨 DevTools 面板的全部宽度',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': '底部面板拆分',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    '两个已打开的底部停靠区如何共享底部面板：并排放置，或上下堆叠。',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': '并排',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description': '底部停靠区并排放置',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': '堆叠',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description': '底部停靠区上下堆叠',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': '显示工具窗口名称',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    '在 DevTools 面板中，于活动栏和停靠标签图标旁渲染文字名称。默认禁用，因为面板比工作区更窄。',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': '左活动栏宽度',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    '工具窗口名称可见时，DevTools 面板中左活动栏的宽度。仅图标模式下锁定为 36px。',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': '右活动栏宽度',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    '工具窗口名称可见时，DevTools 面板中右活动栏的宽度。仅图标模式下锁定为 36px。',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': '活动栏布局',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    '活动栏如何在 DevTools 面板中划分上下两组工具窗口。',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': '按比例',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description': '上下两组各占活动栏的一半',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': '紧凑',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description': '上组随内容收缩；下组固定在底部',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': '堆叠',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    '所有分组聚在顶部，之间以分隔线隔开',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': '动态',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    '图标分组镜像相邻面板的高度。关闭的停靠区收缩到内容大小，活动的邻居吸收空出的空间。',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Network 布局',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Network 表格如何吸收水平空间。紧凑让可伸缩列（Name、Waterfall）弹性适配面板宽度，表格永不水平滚动；宽则为这些列设上限，其余部分水平滚动。',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': '紧凑',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description': '可伸缩列吸收面板宽度。',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': '宽',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description': '列宽有上限，需要时水平滚动。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Messages 布局',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Messages 帧网格如何吸收水平空间。紧凑让 Data 列弹性适配窗格宽度，网格永不水平滚动；宽则为它设上限，需要时水平滚动。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': '紧凑',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description': 'Data 列吸收窗格宽度。',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': '宽',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description': '列宽有上限，需要时水平滚动。',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': '显示负载预览',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    '在 Messages / EventStream 网格下方显示负载预览窗格——即可调大小的拆分区域，选中的帧或事件在其中渲染为 JSON 树、原始文本或二进制查看器。关闭后网格占据整个窗格。',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Network 排序来源',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    '排序状态的哪一侧处于活动。`mode` 运行某个具名的复合排序模式（失败优先 / 最慢优先 / …）。`column` 运行用户点击列头选出的单列排序。面板会自动切换——点击列头把它设为 `column`；在“视图”菜单选择模式则设为 `mode`。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': '模式',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': '使用一个具名的复合排序模式。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': '列',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description': '使用用户点击的单列排序。',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': '自定义（嵌套）',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description': '使用用户自建的多键排序链。',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Network 排序模式',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    '具名的复合排序顺序——先按主轴，平局时按到达顺序。当排序来源 = `mode` 时生效。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': '失败优先',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description': '失败 → 进行中 → 已重定向 → 成功。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': '最慢优先',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': '时长最长的在前。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': '最大优先',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': '线路字节最多的在前。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': '浏览器优先级',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    '按报告的优先级从 Highest → Lowest。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': '按资源类型',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description': '按资源类型分组，组内按到达顺序。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': '按域名',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description': '按主机名分组，组内按到达顺序。',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': '规则修改过的优先',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    '已应用规则的在前，组内按到达顺序。',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Network 排序依据',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    '哪一列驱动列点击排序。当排序来源 = `column` 时生效。点击列头会更新此值。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    '按活动的 Waterfall 指标排时间线（默认为开始时间）。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description': '请求编号——请求被发现的顺序。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP 方法。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'URL 的最后一段。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': '路径 + 查询。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': '完整 URL。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': '响应状态码。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP 版本。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'URL 中的主机部分。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': '服务器 IP。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': '资源类型。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': '触发该请求的来源。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': '请求 Cookie 数量。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': '响应的 Set-Cookie 数量。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': '线路字节数。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': '请求的总时长。',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': '浏览器分配的优先级。',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Network 排序方向',
  'workbench.settings.def.devpanelNetwork.sortDir.description': '当前 Network 排序列的升序或降序。',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': '升序',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': '最小的在前。',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': '降序',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': '最大的在前。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Waterfall 指标',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Waterfall 列按哪个时间排序和绘制。Start / Response / End time 把条形放在绝对时间线上；Total duration 和 Latency 把条形零点对齐，长度可直接比较。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': '请求开始的时刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    '第一个响应字节到达的时刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': '请求完成的时刻。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description': '请求端到端花费的时间。',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description': '到第一个响应字节的时间。',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': '显示规则触发圆点',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    '显示带彩色圆点的前导 14px 列，圆点标记规则匹配（实心 = 规则实际已应用，空心 = 推断）。关闭可在密集窗格中收回这些水平像素。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Waterfall 数值',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    '何时把活动 Waterfall 指标的数值印在条形上——时间线指标显示 Start / Response / End time 数值块，Total duration 和 Latency 显示等待/下载标签。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': '始终',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': '数值块保持可见。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': '悬停时',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description': '悬停行时显示数值块。',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': '关',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': '隐藏数值块。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Waterfall 数值格式',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    '时间线指标的数值如何呈现：相对是与视图中第一个请求的偏移；时间戳是绝对的真实时刻。Total duration 和 Latency 始终是时长，不受此影响。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': '相对',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    '与视图中第一个请求的偏移。',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': '时间戳',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description': '绝对的真实时刻。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Waterfall 时间戳时区',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    '时间戳数值格式使用的时区——本地时间或 UTC。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': '本地',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': '你的本地时区。',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': '协调世界时。',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': '解释 Waterfall 数值',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    '在 Waterfall 的悬停弹出框中，为构成总值的阶段行加徽标并高亮，同时把它们的和以公式形式显示。纯视觉辅助——不会改变任何数值。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Waterfall 弹出框布局',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Waterfall 悬停计时明细的方向。紧凑把各步骤沿弹出框纵向堆叠；宽把同一阶梯放在时间轴上；自动按面板宽度选择——底部停靠的面板用宽，窄的（侧向停靠的）用紧凑。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': '紧凑',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description': '步骤沿弹出框纵向堆叠。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': '宽',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    '步骤放在水平时间轴上。',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': '自动',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description': '面板宽时用宽，否则用紧凑。',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Headers 布局',
  'workbench.settings.def.devpanelHeaders.layout.description':
    '标头行在请求/响应区块内如何组织。分组按类别（Auth、CORS、Caching、…）归拢行；平铺按选定的排序渲染单一列表。',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': '分组',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': '行按类别归拢。',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': '平铺',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description': '单一列表，无类别标题（Chrome 风格）。',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Headers 排序',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    '每个列表内（分组时为每组内）的行顺序。原始顺序保留服务器发送标头的顺序（HAR 顺序）；A → Z 按名称排序；规则修改过的优先把规则修改过的行浮到顶部。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': '原始顺序',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR 顺序。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': '按字母顺序。',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': '规则修改过的优先',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': '规则修改过的行置顶。',
  'workbench.settings.def.devpanelHeaders.nameCase.label': '标头名称大小写',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    '标头名称如何显示。Train-Case 把每个名称规范化（`Content-Type`、`Set-Cookie`、`ETag`），与 Chrome/Firefox 的 DevTools 一致——更易扫读。原始保留服务器发送的原样大小写（HTTP/2+ 在线路上全部小写）。',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': '原始（原样）',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    '服务器发送的原样（HTTP/2+ 上通常为小写）。',
  'workbench.settings.def.devpanelHeaders.showChips.label': '显示值标签',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    '在标头行上显示按值的标签（Cache-Control / Set-Cookie / HSTS / JWT 解码、…）。关闭可获得紧凑的纯值视图。',
  'workbench.settings.def.devpanelHeaders.showInsights.label': '显示建议',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    '在 Headers 标签页顶部显示可操作的警告卡片（CORS 配置错误、缺失的 CSP/HSTS、不安全的 Cookie、已过期的 JWT、…）。',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': '隐藏噪声标头',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    '折叠低信号的标头（Accept-*、Sec-Fetch-*、Sec-CH-UA-*、User-Agent、Connection、…）。每个区块下方的提示在悬停时列出被隐藏的名称。',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': '仅规则修改过的',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description': '只显示被 Open Headers 规则添加、修改或移除的标头。',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': '仅安全标头',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    '只显示与安全相关的标头（CSP、HSTS、X-Frame-Options、Permissions-Policy、…）。',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': '仅可覆盖的标头',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    '隐藏浏览器不允许规则覆盖的受保护标头（host、content-length、sec-ch-ua、…）。',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Initiator 子级排序',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    '发起者链内子请求的排序方式。发起者顺序保留原始的发起者图遍历顺序；按时间顺序按请求时间排序；最大子树把最重的子树放在最前。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': '发起者顺序',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': '按发现顺序。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': '按时间顺序',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': '按请求时间。',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': '最大子树',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': '最重的子树在前。',
  'workbench.settings.def.devpanelInitiator.showInsights.label': '显示建议',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    '在 Initiator 标签页顶部显示可操作的提示（失败的子请求、占主导的主机、第三方占比、…）。',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': '仅失败的',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description': '只显示发起者链中失败或被拦截的行。',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': '仅第三方',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description': '只显示来自与页面源不同的源的行。',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Cookies 排序',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    '每个 Cookie 区块内的行顺序。原始顺序保留服务器/请求使用的顺序；A → Z 按名称排序；Size 按序列化后的 Cookie 大小排序；Expires 把最早过期的排在最前（Session 排最后）。',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': '原始顺序',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': '按发送/设置顺序。',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': '按名称字母顺序。',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': '最大的 Cookie 在前。',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': '最早过期的在前。',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Expires 格式',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Cookie 过期时间的呈现方式。相对显示 "in 2d"、"30s ago"、"Session"；绝对显示解析后的 UTC 日期。',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': '相对',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': '绝对',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC 日期。',
  'workbench.settings.def.devpanelCookies.showChips.label': '显示标签',
  'workbench.settings.def.devpanelCookies.showChips.description':
    '在每个 Cookie 名称旁显示角色/生命周期/上下文标签（auth? / tracking? / pref / 刚设置 / 已丢弃 / 第三方 / 已分区 / …）。关闭可获得紧凑的纯列视图。',
  'workbench.settings.def.devpanelCookies.showInsights.label': '显示建议',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    '在 Cookies 标签页顶部显示可操作的警告卡片（SameSite=None 而无 Secure、违反 __Host- / __Secure- 前缀、过大的 Cookie、已过期仍被发送、…）。',
  'workbench.settings.def.devpanelCookies.decodeValues.label': '解码 URL 编码的值',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    '显示解码百分号编码后的 Cookie 值（"Europe%2FMadrid" → "Europe/Madrid"）。悬停值可查看原始形式。',
  'workbench.settings.def.devpanelCookies.groupByRole.label': '按角色分组',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    '在每个区块内按推断出的角色给 Cookie 分组——身份验证与会话在前，然后是功能、偏好、分析与跟踪。由启发式驱动；角色标签（auth? / tracking? / pref）带着问号作为提醒。',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': '显示被筛除的请求 Cookie',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    '对应 Chrome 的 "show filtered out request cookies" 开关——把 Cookie 罐中因路径 / Secure / SameSite / 过期不匹配而未随此请求发送的 Cookie 也列出来。',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': '仅有问题的',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    '只显示触发了警告的 Cookie——缺失 Secure、违反前缀、已过期仍被发送、…',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': '仅第三方',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description': '只显示其域相对于顶层框架源是跨站的 Cookie。',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': '仅规则修改过的',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    '只显示其 Cookie / Set-Cookie 行被规则添加、修改或移除的 Cookie。',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': '显示建议',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    '在 Timing 标签页顶部显示瓶颈 + 按阶段的警告卡片。关闭可获得只有数字的视图。',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': '显示上下文条',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    '在阶段明细上方显示协议/连接/缓存/优先级/开始/服务器 IP 的标签行。',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': '显示阶段明细',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    '显示 Resource Scheduling / Connection Start / Request-Response 区块及各阶段的毫秒行。',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': '显示计时条',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    '显示按比例分段的条形和各阶段的图例（及其下方的 Total 行）。',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': '显示 Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    '当服务器发送了 `Server-Timing` 响应标头指标时，显示解析结果。',
  'workbench.settings.def.devpanelTiming.showRepeats.label': '显示会话内的重复请求',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    '显示与当前面板会话内同一 URL 最快/中位/最慢命中的对比。',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': '显示传输速率',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    '当大小和接收阶段都已知时，显示有效的 Content-Download 吞吐量（正文字节 ÷ 下载时间）。',
} as const satisfies Catalog;
