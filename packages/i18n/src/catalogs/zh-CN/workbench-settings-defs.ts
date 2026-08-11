/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-settings-defs.ts` key for key. Brand and
 * platform vocabulary (Chrome / Firefox / Edge, font names, window
 * titles) rides raw per the S48 settings-station decisions;
 * `declarativeNetRequest`, `url-filter`, `Cache-Control: no-cache`,
 * `{{ns.X}}` references, INVALID_ARGUMENT and IP/port literals are
 * wire tokens. The workspaceLayout section quotes the zh devpanel-defs
 * twins verbatim（两端 / 堆叠 / 动态 / 按比例 / 底栏 / 顶栏）; merge
 * strategies quote the import-export mints（“添加为新项” /
 * “替换现有项”）; 此页面 quotes the popup tab name; 调试模式 / 附加 /
 * 范围 follow the debug vocabulary; 停用缓存 quotes the panel toolbar
 * mint; 更新并重启 / 导出诊断日志 carried. MINTS: 智能体 = agent
 * (MCP); 活动流 = Activity Feed; 界面外壳（短形 外壳）= the UI
 * chrome; 配置文件 = terminal profile (platform convention); 回滚缓冲区
 * = scrollback; 并排 / 统一 = side-by-side / unified diff; 连字 =
 * ligatures; 强调色 = accent color; 防抖 = debounce; theme variant
 * names (Warm / Rose / Sepia / Dim / Midnight / Forest / Arctic) ride
 * raw as palette proper names.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': '自动与桌面应用配对',
  'workbench.settings.def.backend.nmAutoJoin.description':
    '当本机运行 Open Headers 桌面应用时，无需配对码即可连接——桌面应用会先通过操作系统验证此浏览器，再授予访问权限。关闭后仅通过显式操作配对。',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': '在后台检测桌面应用',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    '未连接桌面应用时，每隔约两分钟检测一次是否已安装，以便新安装的应用自动连接。关闭后仅在扩展启动时检测。',
  'workbench.settings.def.backend.requireNmIdentity.label': '要求与桌面应用进行经验证的配对',
  'workbench.settings.def.backend.requireNmIdentity.description':
    '拒绝本机桌面应用的配对码和粘贴令牌——只有经操作系统验证的握手才能授予其访问权限。远程后端不受影响。通常由组织策略设置。',
  'workbench.settings.def.backend.allowDesktopWatch.label': '允许桌面应用查看此浏览器',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    '允许本机上已配对的桌面应用在其流量面板中观察此浏览器的网络流量、存储和控制台。关闭后规则与同步照常工作，' +
    '桌面端的实时视图则会收到明确的拒绝。',
  'workbench.settings.def.backend.bindAddress.label': '与你网络中的设备同步',
  'workbench.settings.def.backend.bindAddress.description':
    '允许同一网络中的其他电脑和浏览器连接到此应用并共享其工作区。默认关闭——只有这台电脑能访问。',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': '仅回环（127.0.0.1）',
  'workbench.settings.def.backend.bindAddress.option.loopback.description': '只有本机可以连接。默认。',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': '所有网络接口（LAN）',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    '本地网络中的其他设备可以连接。需要 U3.2 的身份验证 token。',
  'workbench.settings.def.backend.bindPort.label': '后端端口',
  'workbench.settings.def.backend.bindPort.description':
    '此应用绑定的端口，供浏览器和其他设备连接。仅当默认端口已被占用时才更改。客户端必须指向同一端口。',
  'workbench.settings.def.backend.serveWebApp.label': '提供 Web 应用',
  'workbench.settings.def.backend.serveWebApp.description':
    '在后端端口上把工作区编辑器作为网页提供，浏览器标签页可以直接从此应用打开它——无需扩展。任何能访问该端口的人都会看到登录门；访问数据仍需要已配对的 token。',
  'workbench.settings.def.backend.allowLocalPeerExecute.label': '允许此设备的浏览器发送请求',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    '让本机上已配对的浏览器通过此应用发送 API 请求——扩展把它用作请求引擎，其工作台的发送就在这里执行。默认开启：配对即同意。每次发送仍需要工作区的写入权限。',
  'workbench.settings.def.backend.allowRemotePeerExecute.label': '允许其他已连接设备发送请求',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    '让其他机器上已配对的设备通过此应用发送 API 请求——其工作台的发送在本机执行，使用本机的网络访问与地址。默认关闭：这是运维者的决定，配对本身绝不隐含此授权。每次发送仍需要工作区的写入权限。',
  'workbench.settings.def.backend.reconnectDelayMs.label': '初始重连延迟',
  'workbench.settings.def.backend.reconnectDelayMs.description': '断开后到第一次重连尝试之前等待的时间（ms）。',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': '最大重连延迟',
  'workbench.settings.def.backend.maxReconnectDelayMs.description': '重连尝试之间指数 backoff 的上限（ms）。',
  'workbench.settings.def.backend.pingIntervalMs.label': '保活间隔',
  'workbench.settings.def.backend.pingIntervalMs.description':
    '发送 ping 的频率（ms），让 WebSocket 在严格的代理后保持打开。',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': '断开时显示徽章',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    '后端链路中断时，在工具栏图标上显示红色徽章。',
  'workbench.settings.def.backend.showDiagrams.label': '显示后端示意图',
  'workbench.settings.def.backend.showDiagrams.description': '在后端设置中显示图解的档位与数据流面板。',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': '启用 MCP 服务器',
  'workbench.settings.def.mcp.enabled.description':
    '在此应用的后端端口上应答 MCP 客户端。关闭时端点不存在。开启后，持有访问 token 的智能体可以读取你的工作区。',
  'workbench.settings.def.mcp.allowObserve.label': '允许观察流量',
  'workbench.settings.def.mcp.allowObserve.description':
    '智能体可以读取你在流量面板中捕获的来源的实时流量。未捕获的来源保持不可见；身份验证标头、Cookie 和 token 形态的值会被替换为稳定的标记。',
  'workbench.settings.def.mcp.allowWrite.label': '允许写入工具',
  'workbench.settings.def.mcp.allowWrite.description':
    '智能体可以创建、编辑和删除规则、请求、环境、变量和工作流。每次更改都会进入活动流，并且可以回退。',
  'workbench.settings.def.mcp.allowExecute.label': '允许执行工具',
  'workbench.settings.def.mcp.allowExecute.description':
    '智能体可以发送已保存的请求并运行工作流——真实的网络流量会代表它们离开这台机器。',
  'workbench.settings.def.mcp.allowSecrets.label': '允许显示机密',
  'workbench.settings.def.mcp.allowSecrets.description': '智能体可以以明文读取 vault 机密值。关闭时所有机密保持遮罩。',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': '语言',
  'workbench.settings.def.general.language.description':
    '界面的显示语言。立即应用到每个打开的界面——无需重新加载。技术词汇（标头名称、HTTP 方法、协议术语）在每种语言中都保留英文。',
  'workbench.settings.def.general.language.option.auto.label': '跟随系统',
  'workbench.settings.def.general.language.option.auto.description': '匹配你的浏览器或操作系统语言',
  'workbench.settings.def.general.language.option.pseudo.description':
    '带重音、加长的英文，用于发现未翻译或被截断的文本',
  'workbench.settings.def.general.confirmOnDelete.label': '删除前确认',
  'workbench.settings.def.general.confirmOnDelete.description': '删除规则、文件夹或集合之前显示确认对话框。',
  'workbench.settings.def.general.showEmptyStateHints.label': '显示空状态提示',
  'workbench.settings.def.general.showEmptyStateHints.description': '在空面板和引导区域渲染指引和提示。',
  'workbench.settings.def.terminal.profiles.label': '配置文件',
  'workbench.settings.def.terminal.profiles.description':
    '终端可用来打开标签页的 shell。普通新标签页使用默认项；标签行中 + 旁的箭头可选择特定配置文件。',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': '关闭运行中的进程前确认',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    '关闭 shell 仍有进程运行的终端标签页之前先询问。空闲的 shell 总是静默关闭。',
  'workbench.settings.def.terminal.startDirectory.label': '起始目录',
  'workbench.settings.def.terminal.startDirectory.description':
    '新终端标签页的起始目录。带有自己目录的配置文件会覆盖此项；留空表示你的主目录。对下一个打开的标签页生效。',
  'workbench.settings.def.terminal.defaultTabName.label': '默认标签页名称',
  'workbench.settings.def.terminal.defaultTabName.description':
    '未用配置文件打开且未重命名的终端标签页的名称。留空使用 "Local"。多个同名标签页会保持编号。',
  'workbench.settings.def.terminal.fontFamilyPreset.label': '字体',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    '终端文本的字体。预设要么随应用附带，要么依赖每个操作系统都提供的字体。',
  'workbench.settings.def.terminal.fontSize.label': '字号',
  'workbench.settings.def.terminal.fontSize.description': '终端文本大小，单位为像素。',
  'workbench.settings.def.terminal.lineHeight.label': '行高',
  'workbench.settings.def.terminal.lineHeight.description': '以字号倍数表示的行距。1 为字体的自然行距。',
  'workbench.settings.def.terminal.cursorStyle.label': '光标形状',
  'workbench.settings.def.terminal.cursorStyle.description': '终端光标的绘制方式。',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': '块',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': '下划线',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': '竖线',
  'workbench.settings.def.terminal.cursorBlink.label': '光标闪烁',
  'workbench.settings.def.terminal.cursorBlink.description': '让终端光标闪烁。',
  'workbench.settings.def.terminal.minimumContrastRatio.label': '最小对比度',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    '调整文本颜色直到与背景达到此对比度。1 不改动颜色；4.5 满足 WCAG AA；21 强制最大对比度。',
  'workbench.settings.def.terminal.scrollback.label': '回滚缓冲区',
  'workbench.settings.def.terminal.scrollback.description':
    '终端在可见屏幕上方保留的行数。数值越高，每个标签页占用的内存越多。',
  'workbench.settings.def.terminal.macOptionIsMeta.label': '将 Option 用作 Meta 键',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    '在 macOS 上把 Option 键当作 Meta，让 Option+B 这类快捷键到达 shell 行编辑，而不是输入特殊字符。',
  'workbench.settings.def.terminal.copyOnSelect.label': '选中即复制',
  'workbench.settings.def.terminal.copyOnSelect.description': '选中终端文本后立即复制到剪贴板。',
  'workbench.settings.def.terminal.hyperlinks.label': '高亮链接',
  'workbench.settings.def.terminal.hyperlinks.description': '检测终端输出中的 URL，点击时在浏览器中打开。',
  'workbench.settings.def.terminal.audibleBell.label': '响铃',
  'workbench.settings.def.terminal.audibleBell.description': '程序触发终端响铃时播放短促的哔声。',
  'workbench.settings.def.terminal.closeTabOnExit.label': 'Shell 退出时关闭标签页',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    'shell 一退出就关闭其终端标签页。关闭此项时，标签页保持打开并显示“重启”按钮。',
  'workbench.settings.def.general.restoreTabsOnStartup.label': '启动时恢复标签页',
  'workbench.settings.def.general.restoreTabsOnStartup.description': '重新打开上次会话结束时打开的编辑器标签页。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': '集合环境切换',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    '当你在集合及其内部实体（规则、请求、文件夹）之间移动时，活动环境如何变化。适用于规则集合和 API 请求集合。集合可以携带默认环境并固定一小组推荐环境；此设置控制这些默认值是否自动接管。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': '保持所选环境',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    '你所选的（包括无环境）在你于集合及其子文件夹、规则或请求之间导航时保持选中。集合的默认环境只在未选择环境时生效。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label': '应用集合默认值',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    '当你位于某个集合（或其中的任何子文件夹、规则或请求）内时，其默认环境接管。你最后一次手动选择是基准环境——离开集合或进入没有默认值的集合时恢复。没有按集合的记忆。',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': '跟随各个集合',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    '打开带默认环境的集合（或其中任何子文件夹、规则或请求）会切换到该默认环境。你在集合内做出的选择会为该集合记住。没有默认值的集合不会自动切换。',
  'workbench.settings.def.general.settingsOpenMode.label': '设置打开方式',
  'workbench.settings.def.general.settingsOpenMode.description': '从工具栏、弹窗或命令面板启动时，设置页面的打开方式。',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': '模态',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': '居中于当前页面的浮层',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': '模态（最大化）',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description': '几乎填满视口的浮层',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': '编辑器标签页',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description': '在工作区中作为完整的编辑器标签页打开',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': '在设置侧边栏显示类别名称',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    '在设置侧边栏的类别图标旁渲染文字名称。右键侧边栏可切换。禁用后为仅图标的紧凑栏。',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': '颜色主题',
  'workbench.settings.def.appearance.theme.description': '控制应用的整体颜色主题。',
  'workbench.settings.def.appearance.theme.option.light.label': '浅色',
  'workbench.settings.def.appearance.theme.option.dark.label': '深色',
  'workbench.settings.def.appearance.theme.option.auto.label': '跟随系统',
  'workbench.settings.def.appearance.theme.option.auto.description': '匹配你的操作系统',
  'workbench.settings.def.appearance.lightVariant.label': '浅色主题变体',
  'workbench.settings.def.appearance.lightVariant.description': '解析出的颜色主题为浅色时使用的调色板。',
  'workbench.settings.def.appearance.lightVariant.option.default.label': '默认',
  'workbench.settings.def.appearance.lightVariant.option.default.description': '均衡中性的浅色主题，适合日常使用。',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': '高对比度',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    '最大易读性——纯白表面、近黑文本、AAA 对比度。',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    '纸张般的表面，暖色中性色和琥珀色强调——长时间使用更护眼。',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    '带石板蓝色调的浅色主题——清爽的表面配钢蓝色强调。',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    '柔和的绯色表面配洋红强调——温和的暖意，没有 Warm 的琥珀色调。',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    '饱和的羊皮纸调色板配深棕文本——着色最重的浅色变体，适合长时间阅读。',
  'workbench.settings.def.appearance.darkVariant.label': '深色主题变体',
  'workbench.settings.def.appearance.darkVariant.description': '解析出的颜色主题为深色时使用的调色板。',
  'workbench.settings.def.appearance.darkVariant.option.default.label': '默认',
  'workbench.settings.def.appearance.darkVariant.option.default.description': '均衡中性的深色主题，适合日常使用。',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': '高对比度',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    '最大易读性——纯黑表面、明亮文本、AAA 对比度。',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    '柔和的石板蓝表面，眩光更低——在弱光环境下更护眼。',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    '深海军蓝表面配鲜明的蓝色强调——比 Dim 更浓郁、更饱和。',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    '绿色调的深色表面配祖母绿强调——平静的植物系调色板。',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    '冷蓝灰的深色主题配霜青色强调——比 Dim 或 Midnight 更平、饱和度更低。',
  'workbench.settings.def.appearance.uiScale.label': 'UI 缩放',
  'workbench.settings.def.appearance.uiScale.description':
    '缩放整个界面外壳——按钮、文本、内边距、控件——而不改变编辑器字号。',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': '极小（70%）',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    '最密的布局——与 Press Start 2P UI 字体搭配时有用，该字体渲染得异常高且宽。',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': '紧凑（80%）',
  'workbench.settings.def.appearance.uiScale.option.0.8.description': '更紧的外壳，仍保留舒适的点击目标。',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': '小（90%）',
  'workbench.settings.def.appearance.uiScale.option.0.9.description': '比默认略紧——屏幕上能容纳更多。',
  'workbench.settings.def.appearance.uiScale.option.1.label': '正常（100%）',
  'workbench.settings.def.appearance.uiScale.option.1.description': '默认外壳大小。',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': '大（110%）',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': '略微放大，更易阅读。',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': '特大（125%）',
  'workbench.settings.def.appearance.uiScale.option.1.25.description': '最大外壳缩放——最适合无障碍。',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'UI 字体族',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    '为应用外壳精选的无衬线字体栈。默认在 Windows / Linux 上为 Inter 以保证跨平台一致，在 macOS 上为 System Sans 以保留 SF Pro 的原生光学字号。每个选项都随扩展打包。编辑器界面有自己的字体设置。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    '为屏幕设计的打包 UI 无衬线字体——在每个操作系统上渲染一致，应用在 macOS、Windows 和 Linux 上看起来相同。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    '操作系统默认 UI 无衬线字体——macOS 上是 San Francisco，Windows 上是 Segoe UI，Linux 上是 Roboto。想要原生外观、可接受跨平台不一致时使用。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    '为低视力可读性设计的无衬线字体——独特的字形减少字符混淆。已打包——始终可用。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    '与内置终端字体一致的等宽 UI——让整个外壳呈现开发者工具的观感。已打包——始终可用。',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    '随应用附带的像素风展示字体。已打包——始终可用。趣味之选：清晰可读但又高又宽；外壳内边距会显得很宽裕。',
  'workbench.settings.def.appearance.density.label': 'UI 密度',
  'workbench.settings.def.appearance.density.description': '紧凑模式减少列表、表格和表单的内边距。',
  'workbench.settings.def.appearance.density.option.comfortable.label': '舒适',
  'workbench.settings.def.appearance.density.option.compact.label': '紧凑',
  'workbench.settings.def.appearance.editorHeaderPosition.label': '编辑器头部位置',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    '每个编辑器停靠其标题与操作行（名称、启用开关、保存）的位置。底部让编辑器顶部更轻，并让主要操作靠近你正在编辑的内容。',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': '顶部',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description': '编辑器内容上方的经典位置。',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': '底部',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    '停靠在编辑器内容下方、状态栏上方。',
  'workbench.settings.def.appearance.clockFormat.label': '时钟格式',
  'workbench.settings.def.appearance.clockFormat.description':
    '时间戳在应用各处（通知、日志）的呈现方式。之所以显式设置，是因为浏览器区域设置跟随浏览器语言，而不是你的系统区域格式。',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 小时制',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 小时制',
  'workbench.settings.def.appearance.accentColor.label': '强调色',
  'workbench.settings.def.appearance.accentColor.description':
    '用于按钮、链接和活动高亮的主色。仅适用于默认主题变体——高对比度和着色变体固定自己的强调色。',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': '在底栏显示版本',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description': '在工作区的底栏显示扩展的版本号。',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': '在底栏显示主题切换器',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    '在工作区的底栏显示浅色/深色/自动主题下拉菜单。',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': '在顶栏显示面板开关',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    '在工作区的顶栏显示左侧/底部/右侧面板的启停图标。',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': '在顶栏显示布局菜单',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    '在工作区的顶栏显示布局下拉菜单（底部全宽、工具窗口名称、活动栏布局）。',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': '底部面板对齐',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    '底部面板在外壳中的位置。左/右将它对齐到一个侧边栏 + 编辑器之下；居中把它嵌套在中间列内；两端则横跨整个视口。',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': '居中',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description': '底部面板嵌套在中间列内',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': '左',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    '底部面板横跨左侧边栏 + 编辑器',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': '右',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    '底部面板横跨编辑器 + 右侧边栏',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': '两端',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description': '底部面板横跨整个视口宽度',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': '底部面板拆分',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    '两个已打开的底部停靠区如何共享底部面板：并排放置，或上下堆叠。',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': '并排',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description': '底部停靠区并排放置',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': '堆叠',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description': '底部停靠区上下堆叠',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': '显示工具窗口名称',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    '在活动栏和停靠标签图标旁渲染文字名称。禁用后为仅图标的紧凑外壳。',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': '左活动栏宽度',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    '工具窗口名称可见时左活动栏的宽度。仅图标模式下锁定为 36px。',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': '右活动栏宽度',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    '工具窗口名称可见时右活动栏的宽度。仅图标模式下锁定为 36px。',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': '活动栏布局',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description': '活动栏如何划分上下两组工具窗口。',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': '按比例',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description': '上下两组各占活动栏的一半',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': '紧凑',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description': '上组随内容收缩；下组固定在底部',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': '堆叠',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    '所有分组聚在顶部，之间以分隔线隔开',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': '动态',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    '图标分组镜像相邻面板的高度。关闭的停靠区收缩到内容大小，活动的邻居吸收空出的空间。',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': '调试模式',
  'workbench.settings.def.inspection.cdpEnabled.description':
    '以与浏览器内置开发者工具相同的深度检查和修改请求——页面加载、worker 和 iframe，而不只是页面级 fetch。开启期间浏览器会在每个已附加的标签页上显示调试横幅；它默认关闭，你可以随时开启。',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint': '调试模式在 Chrome 和 Edge 中可用。',
  'workbench.settings.def.inspection.cdpScope.label': '附加到哪些标签页',
  'workbench.settings.def.inspection.cdpScope.description':
    '开启时调试模式附加到哪些标签页。“DevTools 打开处”附加到开着开发者工具的浏览器标签页。“聚焦的标签页”跟随活动的浏览器标签页，无需打开开发者工具——切换到新标签页或内部页面时，保持附加在之前的标签页上而不是来回抖动。“两者”将二者结合。无论此选择如何，也可以从底栏把单个浏览器标签页固定进来。',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint': '调试模式在 Chrome 和 Edge 中可用。',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'DevTools 打开处',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description': '开着开发者工具的浏览器标签页。',
  'workbench.settings.def.inspection.cdpScope.option.active.label': '聚焦的标签页',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    '跟随焦点的活动浏览器标签页——无需开发者工具。',
  'workbench.settings.def.inspection.cdpScope.option.both.label': '两者',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'DevTools 标签页加聚焦的标签页。',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': '以调试模式开始捕获',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    '新的捕获会附加浏览器调试器以获得完整保真度——响应正文与精确的标头。浏览器会在该标签页上显示调试横幅。每次开始手势都可在“高级”中覆盖此设置。',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': '把捕获保存到归档',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    '新的捕获会录制到本机的加密会话归档中。每次开始手势都可在“高级”中覆盖此设置。',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label': '智能体以未脱敏方式读取归档会话',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    '已连接的智能体读取归档会话时会看到真实值而非脱敏标记——包括身份验证标头、Cookie 和 token 形态的值。默认关闭；开启期间，每次未脱敏读取都会记录到活动信息流。',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': '会话归档大小预算（GiB）',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    '归档会话占用的磁盘空间总额。超出预算后，最旧的已封存会话会最先被删除；正在录制的会话永远不会被删除。',
  'workbench.settings.def.trafficMonitor.railSide.label': '来源列表位置',
  'workbench.settings.def.trafficMonitor.railSide.description':
    '来源列表位于流量面板的哪一侧。面板标题栏上的布局按钮也可以切换。',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': '左侧',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description': '来源列表在左，流量视图在右。',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': '右侧',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description': '来源列表在右，流量视图在左。',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': '字号',
  'workbench.settings.def.editor.fontSize.description': '编辑器界面的字号，单位为像素。',
  'workbench.settings.def.editor.fontFamilyPreset.label': '字体族',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    '为编辑器精选的等宽字体栈。每个选项都随扩展打包——无需系统安装。默认在 Windows / Linux 上为 JetBrains Mono 以保证跨平台一致，在 macOS 上为 System Mono 以保留 SF Mono 的原生渲染。',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    '操作系统默认等宽字体——macOS 上是 SF Mono，Windows 上是 Consolas，Linux 上是 Liberation Mono。',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    '带编程连字的等宽字体。已打包——始终可用。',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    '为编辑器调校的等宽字体，带连字。已打包——始终可用。',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    '带编程连字的等宽字体。已打包——始终可用。',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Adobe 为代码调校的等宽字体。已打包——始终可用。',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    '随应用附带的像素风展示字体。已打包——始终可用。趣味之选：清晰可读但又高又宽。',
  'workbench.settings.def.editor.fontLigatures.label': '字体连字',
  'workbench.settings.def.editor.fontLigatures.description':
    '启用编程连字——把 `=>` 或 `!=` 这类字符序列合成单个字形。需要支持连字的字体（例如 Fira Code、JetBrains Mono）。',
  'workbench.settings.def.editor.lineHeight.label': '行高',
  'workbench.settings.def.editor.lineHeight.description':
    '编辑器行高，单位为像素。0 让编辑器按字号比例选择行高；8 及以上的值按显式像素解释。',
  'workbench.settings.def.editor.tabSize.label': '制表符宽度',
  'workbench.settings.def.editor.tabSize.description': '一个制表符占据的列数。',
  'workbench.settings.def.editor.insertSpaces.label': '插入空格',
  'workbench.settings.def.editor.insertSpaces.description': '按 Tab 时插入空格而不是制表符。',
  'workbench.settings.def.editor.wordWrap.label': '自动换行',
  'workbench.settings.def.editor.wordWrap.description': '长行是否在编辑器中折到下一行。',
  'workbench.settings.def.editor.wordWrap.option.off.label': '关',
  'workbench.settings.def.editor.wordWrap.option.on.label': '视口宽度',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': '限定列',
  'workbench.settings.def.editor.wordWrapColumn.label': '自动换行列',
  'workbench.settings.def.editor.wordWrapColumn.description': '自动换行设为“限定列”时的折行列。',
  'workbench.settings.def.editor.lineNumbers.label': '行号',
  'workbench.settings.def.editor.lineNumbers.description': '在左侧栏显示行号。',
  'workbench.settings.def.editor.renderWhitespace.label': '显示空白字符',
  'workbench.settings.def.editor.renderWhitespace.description': '以可见方式渲染空白字符。',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': '无',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': '仅边界',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': '全部',
  'workbench.settings.def.editor.renderLineEnds.label': '显示行尾符',
  'workbench.settings.def.editor.renderLineEnds.description':
    '在每个真实行的最后一个字符后绘制一个淡淡的 ¬，这样软换行的行（行号槽空白、悬挂缩进、无标记）绝不会被误认成换行。仅用于显示：该标记不可选中，也不会被复制或发送。',
  'workbench.settings.def.editor.formatOnSave.label': '保存时格式化',
  'workbench.settings.def.editor.formatOnSave.description': '保存规则或模板时自动格式化编辑器内容。',
  'workbench.settings.def.editor.bracketPairColorization.label': '括号对着色',
  'workbench.settings.def.editor.bracketPairColorization.description': '用不同颜色高亮匹配的括号。',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.responseBodyCapMB.label': '响应体上限（MB）',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    '执行器为显示保留的响应体大小。更大的响应体会在此上限处截断——完整大小仍会被测量并报告。提高上限会增加每个打开的请求标签页的内存占用。',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'SSE 事件：最新在前',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    '服务器发送事件列表的顺序——最新事件在顶部。关闭则从最旧开始读。列表工具栏更改的是同一设置。',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'SSE 事件：按事件名分组',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    '把服务器发送事件列表聚在可折叠的事件名标题下，每组内保持到达顺序。列表工具栏更改的是同一设置。',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'SSE 事件：每组行数',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    '按事件名分组时，每组只显示这么多条最新事件——窗口随新事件滑动，多个组可同时观察。0 显示所有事件。列表工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'gRPC 消息：最新在前',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'gRPC 消息时间线的顺序——最新消息在顶部。关闭则从最旧开始读。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'gRPC 消息：显示消息类型',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    '给每条时间线行标注其声明的 protobuf 消息类型。默认关闭——一个 rpc 的类型按方向固定，方向徽章已足以区分行。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'gRPC 消息：按消息类型分组',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    '把 gRPC 消息时间线聚在可折叠的消息类型标题下，每组内保持到达顺序。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': 'gRPC 消息：按方向分组',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    '把 gRPC 消息时间线聚在可折叠的已发送 / 已接收标题下。与按消息类型分组组合时，每个（类型，方向）对得到自己的分组——对请求与响应共用同一消息类型的双向调用很有用。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'gRPC 消息：每组行数',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    '按消息类型分组时，每组只显示这么多条最新消息——窗口随新消息滑动，多个组可同时观察。0 显示所有消息。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'WebSocket 消息：最新在前',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'WebSocket 消息时间线的顺序——最新消息在顶部。关闭则从最旧开始读。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': 'WebSocket 消息：按方向分组',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    '把 WebSocket 消息时间线聚在可折叠的已发送 / 已接收标题下，每组内保持到达顺序。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': 'WebSocket 消息：按事件分组',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    '把 Socket.IO 会话时间线聚在可折叠的已解码事件名标题下（控制帧按其线上类型归类）。与按方向分组组合时，每个（事件，方向）对得到自己的分组。仅适用于 Socket.IO 会话——原始 WebSocket 帧不携带事件名。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': 'WebSocket 消息：每组行数',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    '按方向分组时，每组只显示这么多条最新消息——窗口随新消息到来滑动，两个分组因此可以同时观察。0 表示显示全部消息。时间线工具栏更改的是同一设置。',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'gRPC：发送无效消息',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'gRPC 消息不是有效 JSON 时，仍以空消息发起调用并让服务器应答——通常是 INVALID_ARGUMENT。默认关闭：调用在上线路之前失败，并给出确切的解析错误。',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': '暂停规则执行',
  'workbench.settings.def.rulesEngine.paused.description': '停止把规则应用到实时网络请求。规则仍可编辑。',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': '求值策略',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description': '多条规则匹配同一请求时，引擎如何取舍。',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': '首个匹配',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    '使用优先级顺序中的第一条规则',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': '最接近匹配',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description': '优先使用最具体的匹配规则',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': '全部匹配',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description': '按顺序应用每条匹配的规则',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': '更新防抖',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    '规则编辑推送到 declarativeNetRequest 之前的延迟（ms）。',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': '最大活动规则数',
  'workbench.settings.def.rulesEngine.maxActiveRules.description': '一次编译进动态规则集的规则数量上限。',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': '可见资源类型',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    '哪些请求资源类型出现在弹窗的“此页面”视图中。所有内容始终都会被收集；这只改变 UI 显示什么。弹窗上的内联标签行写入的是同一设置。',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': '显示遮蔽警告',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    '高亮效果被更高优先级规则遮蔽的规则（拦截、重定向、mock、延迟或标头叠加冲突）。',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': '大规则集警告',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description': '活动规则数接近浏览器上限时给出警告。',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': '大规则集阈值',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description': '触发警告的活动规则数。',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Live 规则模式',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    '在每个匹配你规则的请求上注入 Cache-Control: no-cache，强制与服务器重新验证，让规则的效果始终新鲜生效。防止陈旧的缓存响应掩盖规则——当规则的值发生变化（如 auth token）而页面仍从缓存提供旧响应时很有用。',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': '绕过 HTTP 缓存',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    '给被检查标签页上的每个请求添加 Cache-Control: no-cache——强制与服务器重新验证。范围仅限 HTTP 缓存；Chrome 自己的停用缓存（Network 标签页）还会绕过渲染器内存缓存。规则匹配的请求始终由 Live 规则模式自动保持新鲜。',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': '变量自动补全',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    '输入时建议 `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` 引用。在任何规则字段值输入框以及 JSON/GraphQL/XML/纯文本正文编辑器中输入 `{{` 即打开。偏好纯文本编辑时可禁用。',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': '草稿 URL 策略',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    '来自 DevTools 检查器的预填规则如何把捕获的 URL 变成 url-filter 模式。精确（默认）保留 URL 原文，规则只匹配被检查的请求。路径通配符把最后一个路径段替换为 *，让同级资源也匹配。仅主机扩大到整个域。',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': '精确 URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description': '规范化后按原文匹配此 URL（推荐）',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': '路径通配符',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description': '通配最后一个路径段',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': '仅主机',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description': '匹配该主机上的每个请求',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': '原始 URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description': '不规范化，按原文匹配此 URL',

  // ── Workspace Sharing category defs ────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label': '在导入预览行上显示合并策略',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    '开启后，导入预览左侧边栏中的每个实体行都会在行计数旁内联显示所选合并策略（添加为新项、替换、跳过、…）。关闭可在窄窗格中释放行宽。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': '导入预览差异查看器',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    '并排渲染目标与传入内容，或以内联堆叠渲染。差异窗格太窄时自动切换为统一视图。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': '并排',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': '统一',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label': '导入预览差异的空白字符处理',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    '差异是把仅空白字符的更改视为编辑，还是将其隐藏。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': '不忽略',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': '忽略空白字符',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label': '折叠导入预览差异中未更改的区域',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    '隐藏连续未更改的行，代之以点击展开的占位。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label': '在导入预览差异中显示空白字符',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    '在差异中把空格和制表符渲染为可见字形（·、→）。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label': '在导入预览差异中显示行号',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description': '在差异两侧显示侧栏行号列。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label': '在导入预览差异中显示缩进参考线',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    '渲染垂直缩进参考线，让 YAML 嵌套更易扫读。',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label': '在导入预览差异中软换行长行',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    '把长行折到下一可视行，而不是水平滚动。',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': '日志级别',
  'workbench.settings.def.data.logLevel.description': '扩展日志器的详细程度。更高级别包含其上的每个级别。',
  'workbench.settings.def.data.logLevel.option.error.label': '错误',
  'workbench.settings.def.data.logLevel.option.error.description': '仅失败',
  'workbench.settings.def.data.logLevel.option.warn.label': '警告',
  'workbench.settings.def.data.logLevel.option.warn.description': '异常与重试',
  'workbench.settings.def.data.logLevel.option.info.label': '信息',
  'workbench.settings.def.data.logLevel.option.info.description': '运行事件',
  'workbench.settings.def.data.logLevel.option.debug.label': '调试',
  'workbench.settings.def.data.logLevel.option.debug.description': '详细内部信息',
  'workbench.settings.def.data.exportSettings.label': '导出设置',
  'workbench.settings.def.data.exportSettings.description': '把所有设置下载为 JSON 文件。',
  'workbench.settings.def.data.exportSettings.action.label': '导出',
  'workbench.settings.def.data.importSettings.label': '导入设置',
  'workbench.settings.def.data.importSettings.description': '从之前导出的 JSON 文件加载设置。',
  'workbench.settings.def.data.importSettings.action.label': '导入…',
  'workbench.settings.def.data.exportObservabilityLog.label': '导出诊断日志',
  'workbench.settings.def.data.exportObservabilityLog.description':
    '把最近 500 条结构化事件（规则重建、请求错误、工作区切换）下载为 JSON。仅限本地；除非你自己把文件附到 bug 报告，否则不会离开设备。',
  'workbench.settings.def.data.exportObservabilityLog.action.label': '导出日志',
  'workbench.settings.def.data.clearObservabilityLog.label': '清除诊断日志',
  'workbench.settings.def.data.clearObservabilityLog.description':
    '丢弃所有已缓冲的事件。不影响规则、请求或任何工作区数据。',
  'workbench.settings.def.data.clearObservabilityLog.action.label': '清除',
  'workbench.settings.def.data.clearObservabilityLog.confirm': '清除诊断日志？这会丢弃所有已缓冲的事件。',
  'workbench.settings.def.data.exportImportReports.label': '导出导入报告',
  'workbench.settings.def.data.exportImportReports.description':
    '把每次导入运行的结构化丢弃/转换报告（目前是 curl；HAR / Postman / Insomnia 随后）下载为 JSON。按工作区保存——每个工作区最近 50 次导入。除非你附上文件，否则绝不离开设备。',
  'workbench.settings.def.data.exportImportReports.action.label': '导出报告',
  'workbench.settings.def.data.clearImportReports.label': '清除导入报告',
  'workbench.settings.def.data.clearImportReports.description':
    '丢弃活动工作区的所有导入报告。不影响请求本身——只影响记录导入期间丢弃/转换内容的审计日志。',
  'workbench.settings.def.data.clearImportReports.action.label': '清除',
  'workbench.settings.def.data.clearImportReports.confirm': '清除此工作区的导入报告？此操作无法撤销。',
  'workbench.settings.def.data.uploadFile.label': '上传文件',
  'workbench.settings.def.data.uploadFile.description':
    '向活动工作区添加文件，用于 multipart 正文和 `{{file.X}}` 引用。文件按内容寻址（sha256），重新上传相同字节仍是同一个 blob。存储在本地 IndexedDB；不会离开设备。',
  'workbench.settings.def.data.uploadFile.action.label': '上传…',
  'workbench.settings.def.data.exportFilesManifest.label': '导出文件清单',
  'workbench.settings.def.data.exportFilesManifest.description':
    '把活动工作区中的文件列表（文件名、哈希、大小、MIME 类型）下载为 JSON。不包含字节——这是供审计和队友重新上传的清单，不是内容备份。',
  'workbench.settings.def.data.exportFilesManifest.action.label': '导出清单',
  'workbench.settings.def.data.filesBrowser.label': '文件',
  'workbench.settings.def.data.filesBrowser.description':
    '活动工作区中每个已上传的 blob。可下载字节、复制短哈希或删除。文件元数据（文件名、大小、MIME 类型、哈希）可在设置索引中搜索。',
  'workbench.settings.def.data.clearAllFiles.label': '清除所有文件',
  'workbench.settings.def.data.clearAllFiles.description':
    '删除活动工作区中的每个文件 blob。通过 multipart 部件引用这些文件的请求执行时会报错；你需要重新上传文件或编辑那些请求。',
  'workbench.settings.def.data.clearAllFiles.action.label': '全部清除',
  'workbench.settings.def.data.clearAllFiles.confirm':
    '删除此工作区中的每个文件？引用它们的 multipart 部件在发送时会报错。',
  'workbench.settings.def.data.resetAllSettings.label': '重置所有设置',
  'workbench.settings.def.data.resetAllSettings.description': '把每个类别中的每个设置恢复为默认值。',
  'workbench.settings.def.data.resetAllSettings.action.label': '重置为默认值',
  'workbench.settings.def.data.resetAllSettings.confirm': '把每个设置重置为默认值？此操作无法撤销。',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': '软件更新',
  'workbench.settings.def.updates.state.description': '当前更新状态。下载和安装始终需要你显式点击。',
  'workbench.settings.def.updates.check.label': '检查更新',
  'workbench.settings.def.updates.check.description':
    '每天查找一次新版本，有可用版本时显示通知圆点。检查不下载任何内容，也不发送任何关于你或此安装的信息——它读取公开的版本列表并在本地比较。“仅安全修复”保持静默，除非某个发布修复了影响你所运行版本的安全问题。更新绝不会在没有你显式操作的情况下安装。',
  'workbench.settings.def.updates.check.option.all.label': '所有发布',
  'workbench.settings.def.updates.check.option.security-only.label': '仅安全修复',
  'workbench.settings.def.updates.check.option.off.label': '关',
  'workbench.settings.def.updates.channel.label': '更新通道',
  'workbench.settings.def.updates.channel.description':
    '更新检查跟随哪条发布线。Beta 更早获得新功能，但可能不够打磨。切回稳定版绝不会降级——你保留已安装的版本，直到下一个稳定版超过它。安全通知在任一通道上都始终跟随稳定线。',
  'workbench.settings.def.updates.channel.option.stable.label': '稳定版',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
  'workbench.settings.def.updates.showWhatsNew.label': '更新后显示新特性',
  'workbench.settings.def.updates.showWhatsNew.description':
    '功能发布后第一次打开工作区编辑器时，打开一个包含发布亮点的标签页。补丁发布绝不会打开它——它们留在通知时间线里。说明随应用附带；不会联网获取。',
  'workbench.settings.def.updates.autoDownload.label': '自动下载更新',
  'workbench.settings.def.updates.autoDownload.description':
    '发现更新时立即在后台获取，安装只需一次“更新并重启”——而且直接退出再打开应用也会启动新版本。关闭表示在你自己选择“更新并重启”之前不下载任何内容。无论哪种方式，应用都绝不会自行重启。',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': '版本',
  'workbench.settings.def.about.version.description': '当前安装的扩展版本。',
  'workbench.settings.def.about.build.label': '构建',
  'workbench.settings.def.about.build.description': '构建编号和日期。',
  'workbench.settings.def.about.commit.label': '提交',
  'workbench.settings.def.about.commit.description': '产出此构建的 Git 提交。',
  'workbench.settings.def.about.protocol.label': '协议',
  'workbench.settings.def.about.protocol.description':
    '此扩展与桌面端应用通信的线路协议版本。版本不匹配的对端会被拒绝，并给出明确的更新提示。',
  'workbench.settings.def.about.browser.label': '浏览器',
  'workbench.settings.def.about.browser.description': '检测到的浏览器和平台。',
} as const satisfies Catalog;
