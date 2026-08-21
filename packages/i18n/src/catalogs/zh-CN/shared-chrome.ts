/**
 * Shared chrome family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-chrome.ts` key for key; see that file for the
 * family rules and the raw-by-design plane (browser banner quoted
 * verbatim raw en, nav / worker / OOPIF, xhr/fetch, boot.interactive).
 * Mints: 调试模式 = Debug mode; debug scope (reach referent, distinct
 * from the variable-scope 作用域) = 范围; 附加 = attach (Chrome
 * DevTools zh vocabulary); 布局 = layout; 布局来源 = layout donor;
 * 暂存 = Scratch (unsaved tier) vs 草稿 = Draft (saved tier); 冷启动 =
 * cold start / 冷唤醒 = cold wake; 进程 = Processes; 生命周期 =
 * lifecycle; 发行说明 = release notes; 退出登录 = sign out; {unit}
 * holes carry localized CJK host nouns, so they set tight without a
 * separating space.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': '调试模式',
  'shared.chrome.debug.titleShort': '调试',
  'shared.chrome.debug.unavailableHint': '调试模式可在 Chrome 和 Edge 中使用。',
  'shared.chrome.debug.toggleAria': '切换调试模式',
  'shared.chrome.debug.aboutTooltip': '关于调试模式',
  'shared.chrome.debug.openDocsAria': '打开调试模式文档',
  'shared.chrome.debug.controlsAria': '调试模式控件',
  'shared.chrome.debug.turnOn': '开启调试模式',
  'shared.chrome.debug.turnOff': '关闭调试模式',
  'shared.chrome.debug.scopeDevtools': '打开了 DevTools 的位置',
  'shared.chrome.debug.scopeActive': '获得焦点的标签页',
  'shared.chrome.debug.scopeBoth': '两者',
  'shared.chrome.debug.attachTo': '附加到',
  'shared.chrome.debug.includeThisTab': '包含此浏览器标签页',
  'shared.chrome.debug.pinThisTabAria': '固定此浏览器标签页',
  'shared.chrome.debug.attachedTabs': '已附加的标签页',
  'shared.chrome.debug.noTabsAttached': '尚未附加任何标签页',
  'shared.chrome.debug.bannerNote':
    '调试模式开启时，浏览器的横幅“OH started debugging this browser”会显示在每个标签页上——不仅是已附加的那些。',
  'shared.chrome.debug.tabNumber': '标签页 #{number}',
  'shared.chrome.debug.tabFallback': '标签页 {id}',
  'shared.chrome.debug.onThisTab': '你正在此标签页上',
  'shared.chrome.debug.switchTo': '切换到 {target}',
  'shared.chrome.debug.dormantTooltip':
    '调试模式已开启，但此标签页在其范围之外——你的调试层级规则的 nav / worker / OOPIF 效果在这里处于休眠状态。请在调试模式中将其纳入范围（更改范围或固定此标签页）。它们仍会作用于页面请求（xhr/fetch）。',
  'shared.chrome.debug.tabOutOfScope': '标签页超出范围',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': '系统',
  'shared.chrome.status.aria': '系统状态：{summary}',
  'shared.chrome.status.aboutTooltip': '关于此面板',
  'shared.chrome.status.openDocsAria': '打开系统状态文档',
  'shared.chrome.status.healthy': '健康',
  'shared.chrome.status.failure': '故障',
  'shared.chrome.status.issues': '问题',
  'shared.chrome.status.noEvents': '暂无事件',
  'shared.chrome.status.subsystemSync': '同步',
  'shared.chrome.status.subsystemRules': '规则',
  'shared.chrome.status.subsystemRequests': '请求',
  'shared.chrome.status.subsystemPermissions': '权限',
  'shared.chrome.status.subsystemSecrets': '机密',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': '活动',
  'shared.chrome.status.subsystemDebugMode': '调试模式',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': '构建 {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': '重新启动应用',
  'shared.chrome.status.backendOff': '已关闭',
  'shared.chrome.status.backendConnecting': '连接中…',
  'shared.chrome.status.companionDesktopApp': '桌面应用',
  'shared.chrome.status.companionExtensions': '扩展',
  'shared.chrome.status.companionConnected': '已连接',
  'shared.chrome.status.companionNotConnected': '未连接',
  'shared.chrome.status.companionInstalledNotConnected': '已安装 · 未连接',
  'shared.chrome.status.companionNotInstalled': '未安装',
  'shared.chrome.status.companionDownload': '下载',
  'shared.chrome.status.companionPeersConnected': '已连接 {count} 个',
  'shared.chrome.status.companionNoPeers': '暂无连接',
  'shared.chrome.status.companionConnect': '连接',
  'shared.chrome.status.companionOpenApp': '打开应用',
  'shared.chrome.addons.title': '附加组件',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': '服务器',
  'shared.chrome.addons.cliSetUp': '已配置',
  'shared.chrome.addons.cliNotSetUp': '未配置',
  'shared.chrome.addons.cliStale': 'Token 已撤销——请重新配置',
  'shared.chrome.addons.cliExternal': '外部配置',
  'shared.chrome.addons.cliMalformed': '配置格式错误',
  'shared.chrome.addons.cliProvision': '配置',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': '已开启',
  'shared.chrome.addons.mcpTurnOn': '开启',
  'shared.chrome.addons.notConfigured': '未配置',
  'shared.chrome.addons.requiresDesktop': '需要桌面应用',
  'shared.chrome.addons.cliViaDesktop': '通过桌面应用配置',
  'shared.chrome.status.coldStart': '冷启动',
  'shared.chrome.status.coldStartMessage': '检测到性能回退——参见诊断导出',
  'shared.chrome.status.coldStartTooltip':
    '连续三次冷唤醒超出基线 ≥20%。最近的 boot.interactive 样本（ms）：{samples}。',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': '更新',
  'shared.chrome.updates.downloading': '下载中…',
  'shared.chrome.updates.downloadingPercent': '下载中… {percent}%',
  'shared.chrome.updates.updateAndRestart': '更新并重启',
  'shared.chrome.updates.ignore': '忽略此更新',
  'shared.chrome.updates.remindLater': '稍后提醒我',
  'shared.chrome.updates.nowAvailableSuffix': '现已发布！',
  'shared.chrome.updates.moreDetailsPrefix': '如需了解更多详情，请参阅',
  'shared.chrome.updates.releaseNotes': '发行说明',
  'shared.chrome.updates.updatingTo': '正在从 {from} 更新到 {to}。',
  'shared.chrome.updates.configure': '配置更新…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': '下载 {version}',
  'shared.chrome.gearMenu.versionAvailable': '{version} 可用…',
  'shared.chrome.gearMenu.updateAndRestartVersion': '更新到 {version} 并重启',
  'shared.chrome.gearMenu.downloadingVersion': '正在下载 {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': '重启以安装 {version}',
  'shared.chrome.gearMenu.settings': '设置…',
  'shared.chrome.gearMenu.keyboardShortcuts': '键盘快捷键…',
  'shared.chrome.gearMenu.appearance': '外观…',
  'shared.chrome.gearMenu.about': '关于 Open Headers',
  'shared.chrome.gearMenu.tourGuide': '导览',
  'shared.chrome.gearMenu.signOut': '退出登录',
  'shared.chrome.gearMenu.searchPlaceholder': '搜索',
  'shared.chrome.gearMenu.noMatches': '无匹配项',
  'shared.chrome.gearMenu.settingsTooltip': '设置',
  'shared.chrome.gearMenu.settingsMenuAria': '设置菜单',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': '进程',
  'shared.chrome.tasks.hidePanelAria': '隐藏进程面板',
  'shared.chrome.tasks.allCompleted': '所有后台任务已完成',
  'shared.chrome.tasks.aboutNoteAria': '关于此说明',
  'shared.chrome.tasks.stop': '停止',
  'shared.chrome.tasks.keepRunning': '继续运行',
  'shared.chrome.tasks.stopTaskAria': '停止后台任务',
  'shared.chrome.tasks.hideTaskAria': '隐藏后台任务',
  'shared.chrome.tasks.hideProcesses': '隐藏进程',
  'shared.chrome.tasks.hideProcessesCount': '隐藏进程（{count}）',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': '默认{unit}——新建的{units}会从这里继承布局。',
  'shared.chrome.donor.nonDefaultTooltip': '另一个{unit}是默认布局来源——新建的{units}会从那里继承。',
  'shared.chrome.donor.isDonorBody': '此{unit}是当前默认。新建的{units}会继承此布局。',
  'shared.chrome.donor.nonDonorBody': '另一个{unit}是当前默认。新建的{units}会继承那个{unit}的布局。',
  'shared.chrome.donor.reset': '将布局重置为默认值',
  'shared.chrome.donor.defaultAria': '供新建{unit}继承布局的默认{unit}',
  'shared.chrome.donor.nonDefaultAria': '不是供新建{unit}继承布局的默认{unit}',
  'shared.chrome.donor.defaultLabel': '默认{unit}',
  'shared.chrome.donor.inheritsLabel': '继承布局',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': '生命周期状态',
  'shared.chrome.lifecycle.scratch': '暂存',
  'shared.chrome.lifecycle.scratchBody': '未保存的草稿。在你点击“保存”之前，不会持久化任何内容。',
  'shared.chrome.lifecycle.unresolved': '未解析',
  'shared.chrome.lifecycle.unresolvedBody': '包含在活动作用域中无法解析的 {{ref}}。',
  'shared.chrome.lifecycle.draft': '草稿',
  'shared.chrome.lifecycle.draftBody': '已保存但尚未 Live——缺少必填字段，或尚未发布。',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': '已发布且处于活动状态。',
} as const satisfies Catalog;
