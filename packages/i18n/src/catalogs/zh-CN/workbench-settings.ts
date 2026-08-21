/**
 * Workbench settings — shell chrome — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `MCP` / `Shell` as dev loanwords, the DevTools-panel tab names in
 * category labels (Network, Headers, Initiator, Cookies, Timing —
 * panel parity vocabulary), `MIME` / `Hash` / `LAN` / `Multipart`,
 * lowercase `vault` (per-case token law), and the {version} / {when}
 * / {message} / {filename} / {sessionId} / {installId} holes. 数据
 * (Data category) matches the settings path quoted by the
 * system-status doc body（设置 → 数据 → …）. 后端 = Backend (shared
 * register mint); 工作区编辑器 = Workbench (chrome mint); 席位 = seat
 * and 档 = tier reuse the daemon-admin mints; 常规 = General (S79);
 * 规则引擎 = Rules Engine; 终端 = Terminal. MINTS: 设置项 = a
 * countable setting (the surface stays 设置); 重置 = reset; DevTools
 * 面板 = the DevTools panel; 布局 = Layout nav label.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': '设置',
  'workbench.settings.shell.openInEditor': '在编辑器中打开',
  'workbench.settings.shell.openInEditorSoon': '在编辑器中打开（即将推出）',
  'workbench.settings.shell.maximize': '最大化',
  'workbench.settings.shell.restoreWindow': '还原',
  'workbench.settings.shell.hint.search': '搜索',
  'workbench.settings.shell.hint.navigate': '导航',
  'workbench.settings.shell.hint.select': '选择',
  'workbench.settings.shell.hint.clearClose': '清除 / 关闭',
  'workbench.settings.shell.noneRegistered': '没有已注册的设置项。',
  'workbench.settings.shell.resetAll': '全部重置',
  'workbench.settings.shell.resetAllCount': '全部重置（{count}）',
  'workbench.settings.shell.resetAllTitle': '重置所有设置项？',
  'workbench.settings.shell.resetAllNone': '没有可重置的内容——所有设置项都处于默认值。',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), { other: '把 {count} 个设置项恢复为默认值。' }),
  'workbench.settings.shell.resetConfirm': '重置',
  'workbench.settings.shell.searchResults': '搜索结果',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个匹配，关键词：' }),
  'workbench.settings.shell.noMatchesFor': '没有匹配的设置项：',
  'workbench.settings.shell.jumpToCategory': '跳到分类',
  'workbench.settings.shell.navAria': '设置分类',
  'workbench.settings.shell.showCategoryNames': '显示分类名称',
  'workbench.settings.shell.otherGroup': '其他',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': '已从默认值修改',
  'workbench.settings.row.modifiedAria': '已修改',
  'workbench.settings.row.resetToDefault': '重置为默认值',
  'workbench.settings.row.experimental': '实验性',
  'workbench.settings.row.desktopBadge': '桌面端',
  'workbench.settings.row.desktopTip': '需要与 Open Headers 桌面端应用保持实时连接。权威值存储在桌面端应用中。',
  'workbench.settings.row.capabilityUnavailable': '此浏览器不支持此设置项。',
  'workbench.settings.row.connectionRequired': '连接桌面端应用后才能更改此设置项。',
  'workbench.settings.row.aboutAria': '关于{label}',
  'workbench.settings.row.disabledCapabilityAria': '已禁用——在此浏览器上不可用',
  'workbench.settings.row.disabledConnectionAria': '已禁用——需要桌面端连接',
  'workbench.settings.row.managed': '由你的组织管理',
  'workbench.settings.row.managedBadge': '受管理',
  'workbench.settings.row.disabledManagedAria': '已禁用——由你的组织管理',
  'workbench.settings.row.run': '运行',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': '后端',
  'workbench.settings.category.backend.description':
    '你的工作区、规则、vault 和历史所在之处。按你的覆盖面挑选主机——无论哪种都仅限本地。',
  'workbench.settings.category.backend.sub.connection': '连接',
  'workbench.settings.category.backend.sub.reliability': '可靠性',
  'workbench.settings.category.backend.sub.notifications': '通知',
  'workbench.settings.category.backend.sub.lan-peers': 'LAN 对等端',
  'workbench.settings.category.mcp.label': 'AI · MCP 服务器',
  'workbench.settings.category.mcp.description':
    '让 AI 代理和其他 MCP 客户端读取并控制此应用。访问分级——读取、写入、执行和机密显示是各自独立的开关，' +
    '默认全部关闭。',
  'workbench.settings.category.general.label': '常规',
  'workbench.settings.category.general.description': '应用级行为、启动和区域设置。',
  'workbench.settings.category.appearance.label': '外观',
  'workbench.settings.category.appearance.description': '主题、密度和视觉呈现。',
  'workbench.settings.category.workspaceLayout.label': '工作区布局',
  'workbench.settings.category.workspaceLayout.description': '页脚功能与工具窗口外壳的行为。',
  'workbench.settings.category.terminal.label': '终端',
  'workbench.settings.category.terminal.description': '集成终端工具窗口的行为。',
  'workbench.settings.category.devpanel.label': 'DevTools 面板',
  'workbench.settings.category.devpanel.description':
    '浏览器 DevTools 面板的默认值——工具窗口外壳和请求界面的每个标签页。',
  'workbench.settings.category.devpanelLayout.label': 'DevTools 面板 · 布局',
  'workbench.settings.category.devpanelLayout.navLabel': '布局',
  'workbench.settings.category.devpanelLayout.description': '浏览器 DevTools 面板的工具窗口外壳行为。',
  'workbench.settings.category.devpanelNetwork.label': 'DevTools 面板 · Network',
  'workbench.settings.category.devpanelNetwork.navLabel': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'DevTools 面板中 Network 请求表格的默认值——布局、排序、圆点列。',
  'workbench.settings.category.devpanelHeaders.label': 'DevTools 面板 · Headers',
  'workbench.settings.category.devpanelHeaders.navLabel': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'DevTools 面板中 Headers 标签页的默认值——布局、排序、筛选、建议。',
  'workbench.settings.category.devpanelInitiator.label': 'DevTools 面板 · Initiator',
  'workbench.settings.category.devpanelInitiator.navLabel': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'DevTools 面板中 Initiator 标签页的默认值——排序、筛选、建议。',
  'workbench.settings.category.devpanelCookies.label': 'DevTools 面板 · Cookies',
  'workbench.settings.category.devpanelCookies.navLabel': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'DevTools 面板中 Cookies 标签页的默认值——列、排序、筛选、建议。',
  'workbench.settings.category.devpanelTiming.label': 'DevTools 面板 · Timing',
  'workbench.settings.category.devpanelTiming.navLabel': 'Timing',
  'workbench.settings.category.devpanelTiming.description': 'DevTools 面板中 Timing 标签页的默认值——哪些区段可见。',
  'workbench.settings.category.inspection.label': '调试模式',
  'workbench.settings.category.inspection.description':
    '自愿开启的路径，附加浏览器的调试协议——以内置开发者工具同等的深度检查并修改请求。',
  'workbench.settings.category.trafficMonitor.label': '流量',
  'workbench.settings.category.trafficMonitor.description':
    '流量面板“开始观察”手势的默认选项，以及会话归档的磁盘预算。',
  'workbench.settings.category.editor.label': '代码编辑器',
  'workbench.settings.category.editor.description': '代码编辑界面的字体、缩进和视图选项。',
  'workbench.settings.category.requests.label': 'API 请求',
  'workbench.settings.category.requests.description': 'HTTP 请求发送与响应处理。',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.rulesEngine.label': '规则引擎',
  'workbench.settings.category.rulesEngine.description': '规则如何求值、编译与裁决。',
  'workbench.settings.category.keyboard.label': '键盘',
  'workbench.settings.category.keyboard.description': '自定义键盘快捷键。',
  'workbench.settings.category.keyboard.sub.global': '所有界面',
  'workbench.settings.category.keyboard.sub.workbench-general': '工作区编辑器',
  'workbench.settings.category.keyboard.sub.workbench-layout': '工作区编辑器 · 布局',
  'workbench.settings.category.keyboard.sub.workbench-tabs': '工作区编辑器 · 标签页',
  'workbench.settings.category.keyboard.sub.workbench-focus': '工作区编辑器 · 焦点',
  'workbench.settings.category.keyboard.sub.workbench-editor': '工作区编辑器 · 编辑器',
  'workbench.settings.category.keyboard.sub.popup-general': '弹窗和侧边栏',
  'workbench.settings.category.keyboard.sub.popup-navigation': '弹窗和侧边栏 · 导航',
  'workbench.settings.category.keyboard.sub.popup-rows': '弹窗和侧边栏 · 行操作',
  'workbench.settings.category.keyboard.sub.popup-tabs': '弹窗和侧边栏 · 标签页',
  'workbench.settings.category.workspaceSharing.label': '工作区共享',
  'workbench.settings.category.workspaceSharing.description': '工作区导出的导入预览的显示偏好。',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description': '把此工作区绑定到磁盘上的文件夹——一棵实时的、对 git 友好的 YAML 树。',
  'workbench.settings.category.proxy.label': '代理',
  'workbench.settings.category.proxy.description': '此设备的出站代理——请求如何抵达网络——以及捕获代理的信任设置。',
  'workbench.settings.category.proxyOutbound.label': '代理 · 出站请求',
  'workbench.settings.category.proxyOutbound.navLabel': '出站请求',
  'workbench.settings.category.proxyOutbound.description':
    '此设备的出站代理——请求、WebSocket 会话和 gRPC 调用如何抵达网络。',
  'workbench.settings.category.proxyTrust.label': '代理 · 系统',
  'workbench.settings.category.proxyTrust.navLabel': '系统代理',
  'workbench.settings.category.proxyTrust.description':
    '让 HTTPS 流量可被解密检查的证书颁发机构与信任存储——在本机创建,也可在此移除。',
  'workbench.settings.category.data.label': '数据',
  'workbench.settings.category.data.description': '诊断、导入/导出，以及破坏性维护。',
  'workbench.settings.category.license.label': '许可证',
  'workbench.settings.category.license.description':
    '今天 Open Headers 的一切在每个档位都包含——付费方案覆盖的是团队席位。免费档每个服务器最多准入 6 位' + '活跃用户。',
  'workbench.settings.category.updates.label': '更新',
  'workbench.settings.category.updates.description': '更新检查、通道与下载行为。',
  'workbench.settings.category.about.label': '关于',
  'workbench.settings.category.about.description': '版本、许可与构建信息。',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': '此构建的更新由你的安装通道处理。',
  'workbench.settings.updatesRow.checking': '正在检查更新…',
  'workbench.settings.updatesRow.securityFix': '版本 {version} 修复了影响当前版本的一个安全问题。',
  'workbench.settings.updatesRow.available': '版本 {version} 可用。',
  'workbench.settings.updatesRow.packageManager': '请通过你的 Linux 软件包管理器安装。',
  'workbench.settings.updatesRow.updateAndRestart': '更新并重启',
  'workbench.settings.updatesRow.downloading': '正在下载 {version}…',
  'workbench.settings.updatesRow.readyToInstall': '版本 {version} 已准备好安装。',
  'workbench.settings.updatesRow.restartToInstall': '重启以安装',
  'workbench.settings.updatesRow.checkFailed': '更新检查失败：{message}',
  'workbench.settings.updatesRow.retry': '重试',
  'workbench.settings.updatesRow.upToDate': '你已在最新版本（{version}）。',
  'workbench.settings.updatesRow.checkNow': '立即检查',
  'workbench.settings.updatesRow.releaseNotes': '发行说明',
  'workbench.settings.updatesRow.lastChecked': '上次检查于 {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': '系统默认 shell',
  'workbench.settings.terminalProfiles.add': '添加配置',
  'workbench.settings.terminalProfiles.edit': '编辑配置',
  'workbench.settings.terminalProfiles.remove': '移除配置',
  'workbench.settings.terminalProfiles.addTitle': '添加终端配置',
  'workbench.settings.terminalProfiles.editTitle': '编辑终端配置',
  'workbench.settings.terminalProfiles.name': '名称',
  'workbench.settings.terminalProfiles.shell': 'Shell 路径',
  'workbench.settings.terminalProfiles.args': '参数',
  'workbench.settings.terminalProfiles.cwd': '起始目录',
  'workbench.settings.terminalProfiles.cwdPlaceholder': '主目录',
  'workbench.settings.terminalProfiles.save': '保存',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': '重命名文件',
  'workbench.settings.fields.files.renameMissing': '文件已不存在于此工作区',
  'workbench.settings.fields.files.renameFailed': '无法重命名文件',
  'workbench.settings.fields.files.renameFailedReason': '无法重命名文件：{message}',
  'workbench.settings.fields.files.colFilename': '文件名',
  'workbench.settings.fields.files.colSize': '大小',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': '操作',
  'workbench.settings.fields.files.download': '下载',
  'workbench.settings.fields.files.deleteTitle': '删除 {filename}？',
  'workbench.settings.fields.files.deleteWarning': '引用此文件的 multipart 部件在发送时会报错。',
  'workbench.settings.fields.files.loading': '正在加载文件…',
  'workbench.settings.fields.files.empty': '还没有文件——使用上方的“上传文件”操作。',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'key',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'value',
  'workbench.settings.fields.keyValue.addEntry': '添加条目',
  'workbench.settings.fields.keybinding.pressCombo': '按下组合键…',
  'workbench.settings.fields.keybinding.record': '录制',
  'workbench.settings.fields.keybinding.cancel': '取消',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': '查看事件',
  'workbench.settings.telemetryRow.modalTitle': '本次会话的遥测事件',
  'workbench.settings.telemetryRow.sessionOn': '会话 {sessionId}——计数已开启',
  'workbench.settings.telemetryRow.sessionOff': '会话 {sessionId}——计数已关闭',
  'workbench.settings.telemetryRow.install': '安装 {installId}（随机——标识此次安装，而不是你）',
  'workbench.settings.telemetryRow.noInstall': '没有安装标识符——计数已关闭',
  'workbench.settings.telemetryRow.empty': '本次会话未记录任何遥测事件。',
  'workbench.settings.telemetryRow.confirmTitle': '关闭匿名使用计数？',
  'workbench.settings.telemetryRow.confirmHeading': '你的隐私已经受到保护',
  'workbench.settings.telemetryRow.confirmIntro':
    '一个随机标识符统计此次安装——从不统计你。绝不收集任何个人数据。计数所做的事如下：',
  'workbench.settings.telemetryRow.confirmPointFeatures': '显示哪些功能值得继续投入',
  'workbench.settings.telemetryRow.confirmPointScope': '只统计功能使用、平台和应用版本',
  'workbench.settings.telemetryRow.confirmPointInspect': '每个事件都在“查看事件”中逐字节可见',
  'workbench.settings.telemetryRow.confirmBadgePersonal': '无个人数据',
  'workbench.settings.telemetryRow.confirmBadgeUrls': '无 URL 或标头',
  'workbench.settings.telemetryRow.confirmBadgeContent': '无请求内容',
  'workbench.settings.telemetryRow.confirmKeep': '保持计数开启',
  'workbench.settings.telemetryRow.confirmDisable': '仍然关闭',
} as const satisfies Catalog;
