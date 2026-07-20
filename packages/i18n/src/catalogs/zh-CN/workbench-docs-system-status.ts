/**
 * Workbench Docs panel — the System Status section body — Simplified
 * Chinese. Mirrors `catalogs/en/workbench-docs-system-status.ts` key
 * for key. Subsystem wire literals, state tokens, and the popover
 * status messages the doc quotes (Connected to desktop, N workflows
 * fresh, …) ride RAW — untranslated wire output, same class as the
 * quoted browser phrasing law (de/es parity). Subsystem display names
 * copy the shipped `zh-CN/shared-chrome.ts` labels（同步、规则、请求、
 * 权限、机密、Live、系统状态）. 指示条 = pill (debug-mode docs mint);
 * 工作区编辑器 = Workbench in prose; 唤醒 = service-worker wake; 配额
 * = quota. MINTS: 发送 = the Send button (editors-request zh-CN must
 * reuse); settings path 设置 → 数据 → 导出诊断日志 (the zh settings
 * files must reuse); 漂移 = schema drift.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': '系统状态',
  'workbench.docs.body.systemStatus.intro1':
    '是扩展健康状况的实时快照。工作区编辑器的页脚把它显示为一排六枚指示条——每个子系统一枚，各自带彩色圆点。' +
    '弹窗和侧边栏把它折叠成底部页脚中的单个',
  'workbench.docs.body.systemStatus.intro1Suffix': '条目，其圆点颜色跟随状态最差的子系统。',
  'workbench.docs.body.systemStatus.workbenchCaption': '在工作区编辑器中，这一排位于页脚，每个子系统一枚指示条。',
  'workbench.docs.body.systemStatus.popupCaption': '点击工具栏图标，同样的状态在弹窗页脚以一枚带标签的指示条出现。',
  'workbench.docs.body.systemStatus.worstLevel1':
    '每个子系统报告一个状态，最差级别胜出：红 > 黄 > 绿。任何一处的红都会把合成圆点翻成红色。',
  'workbench.docs.body.systemStatus.worstLevelCaption': '六个子系统状态经 max 折叠成一个合成值——红胜黄，黄胜绿。',
  'workbench.docs.body.systemStatus.popover1':
    '点击任意指示条都会打开同一个详情弹出框。行分为两组：灰色在前（本次 service worker 生命周期内还没有事件），' +
    '彩色在后（至少报告过一次）。每组内部保持规范的子系统顺序。完整历史在可观测性日志中——导出入口为',
  'workbench.docs.body.systemStatus.settingsExportPath': '设置 → 数据 → 导出诊断日志',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption': '分隔线上方是灰色，下方是彩色；首次报告时行迁移一次。',
  'workbench.docs.body.systemStatus.stateGreenLabel': '绿色',
  'workbench.docs.body.systemStatus.stateYellowLabel': '黄色',
  'workbench.docs.body.systemStatus.stateRedLabel': '红色',
  'workbench.docs.body.systemStatus.syncName': '同步',
  'workbench.docs.body.systemStatus.syncSubtitle': '桌面端应用连接',
  'workbench.docs.body.systemStatus.sync1Prefix':
    '映射扩展的 service worker 与运行在你机器上的 OpenHeaders 桌面端应用之间的 WebSocket 连接。链路仅限回环（',
  'workbench.docs.body.systemStatus.sync1Suffix':
    '），承载动态变量、团队工作区数据和在线状态——任何东西都不离开你的设备。',
  'workbench.docs.body.systemStatus.syncTopologyCaption': '扩展与 localhost 上的桌面端应用之间只有一条 WebSocket。',
  'workbench.docs.body.systemStatus.sync2':
    '指示条反映实时连接状态。掉线会触发指数退避重连；周期性 ping 能在严格的企业代理背后察觉无声断连。',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled 和 Connected 为绿色；Connecting、Reconnecting 和 URL rejected 为黄色。',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '（握手成功）或',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '（自动连接已关闭）。',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': '，或',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed': '保留给致命的桌面同步故障；目前没有任何代码路径发出它。',
  'workbench.docs.body.systemStatus.rulesName': '规则',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest 引擎',
  'workbench.docs.body.systemStatus.rules1Prefix':
    '报告每次 DNR 重建。每次保存都会让你的规则先经过四个阶段再生效：编译为 DNR JSON、解析',
  'workbench.docs.body.systemStatus.rules1Middle': '引用、执行活动规则上限，然后通过 Chrome 的',
  'workbench.docs.body.systemStatus.rules1Suffix': 'API 应用。每个阶段都可能翻转指示条。',
  'workbench.docs.body.systemStatus.rulesPipelineCaption': '四个阶段——任何一个出岔子都会发出一个状态级别。',
  'workbench.docs.body.systemStatus.rules2':
    '活动规则数映射到三段式容量条上的一个状态。超过上限的规则按匹配顺序丢弃（靠前者胜出），黄色消息会携带被' +
    '丢弃的数量。',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    '到警戒线之前是绿色，到上限之前是黄色，越过则是红色——但截断会让你在运行时始终不进入红区。',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': '或',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': '未解析的',
  'workbench.docs.body.systemStatus.rulesYellowRefs': '引用 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': ')、超出规则上限 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': ')，或正在逼近 DNR 容量 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix': '传输故障——Chrome 拒绝了动态或会话规则更新 (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': '请求',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'API 请求执行器',
  'workbench.docs.body.systemStatus.requests1Prefix': '反映最近一次临时 API 请求——它从请求编辑器的',
  'workbench.docs.body.systemStatus.requestsSend': '发送',
  'workbench.docs.body.systemStatus.requests1Middle': '按钮发出。指示条对',
  'workbench.docs.body.systemStatus.requestsAny': '任何',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP 响应都翻绿——包括 4xx 和 5xx——因为“请求完成了”与“服务器满意”是两个不同的问题。只有没有响应的' +
    '网络级故障才会把它翻黄。',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption': '任何状态码 = 绿色。黄色保留给没有响应返回的故障。',
  'workbench.docs.body.systemStatus.requests2Prefix': '后台流量不会更新此指示条：Live 工作流刷新走',
  'workbench.docs.body.systemStatus.requests2Suffix': '，网页请求流经规则引擎，而不是执行器。',
  'workbench.docs.body.systemStatus.requestsScopeCaption': '只有临时的发送按钮流量塑造此指示条——其余一切保持安静。',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '——任何 HTTP 响应 (例如',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '——响应之前的网络级故障 (例如',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': '、离线/DNS)。',
  'workbench.docs.body.systemStatus.permissionsName': '权限',
  'workbench.docs.body.systemStatus.permissionsSubtitle': '主机权限审计',
  'workbench.docs.body.systemStatus.permissions1Prefix': '目标主机的授权已从',
  'workbench.docs.body.systemStatus.permissions1Middle':
    '中撤销时，DNR 规则和内容脚本不会报错——它们只是无声地不执行。此审计的全部职责就是把这种隐藏状态摆到' +
    '明面上，否则你会花 30 分钟去调试一条',
  'workbench.docs.body.systemStatus.permissionsLooks': '看起来',
  'workbench.docs.body.systemStatus.permissions1Suffix': '没问题的规则。',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    '已授予：规则触发。被收窄：规则无声地不执行，标头永远不会到达。',
  'workbench.docs.body.systemStatus.permissions2Prefix': '审计在每次 service worker 唤醒时轮询',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    '。MV3 在 Chromium 中没有权限变更观察器，因此唤醒即轮询是我们能拿到的最便宜的信号。',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    '一次调用，三个分支——已授予为绿色，被收窄为红色，API 调用本身失败为黄色。',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': '仍在范围内。',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '——不寻常；浏览器没有暴露',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle': '——部分规则会在被撤销的主机上无声地不执行；恢复访问的入口是',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': '机密',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Vault 完整性',
  'workbench.docs.body.systemStatus.secrets1Prefix': '跟踪按工作区加密的 vault 数据块，它存于',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '之中。每次 service worker 唤醒时，每个已存储的机密都会按当前模式校验；未通过校验的条目会从内存中的 ' +
    'vault 中被丢弃，指示条翻黄，直到它们被重新保存。',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    '水合加载数据块；模式校验器保留匹配项、丢弃漂移项并报告黄色。',
  'workbench.docs.body.systemStatus.secrets2':
    '“漂移”通常意味着某个已存储的条目由更旧的构建写入（缺少现在必需的字段，或字段类型不对）。校验器的职责是' +
    '大声失败——无声地继承未知形态，正是六个版本之后那个 bug 的成因。',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    '同样两个字段并排对比：一个有效条目 vs 一个漂移条目——缺少 cipher，createdAt 类型错误。',
  'workbench.docs.body.systemStatus.secretsGreen': '默认——本次 service worker 生命周期内没有模式漂移事件。',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '——至少一个已存储的 vault 条目不符合当前形态，在水合时被丢弃。从 Vault 编辑器重新保存即可恢复。',
  'workbench.docs.body.systemStatus.secretsRed': '保留给密文解密失败；目前没有任何代码路径发出它。',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Live 变量工作流刷新',
  'workbench.docs.body.systemStatus.live1Prefix':
    '每个 Live 工作流按自己的节奏刷新。按工作流的状态取决于三项检查：最后一次提取器是否成功、运行是否在',
  'workbench.docs.body.systemStatus.live1Suffix':
    '其节奏之内，以及连续失败了多少次。三种状态经“最差胜出”折叠进指示条。',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    '新鲜 = 干净的运行 · 陈旧 = 超过 2 倍节奏或 1–4 次失败 · 失败中 = ≥ 5 次连续失败。',
  'workbench.docs.body.systemStatus.live2Prefix': '只有',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': '活动工作区的',
  'workbench.docs.body.systemStatus.live2Suffix':
    '工作流参与计入。非活动工作区被排除——那些规则你此刻既看不到也动不了，为它们亮指示条只会暴露你够不着的' +
    '噪声。切换工作区会按新的活动集合重新计算指示条。',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    '活动工作区的工作流经 max() 折叠成一枚指示条；其他工作区被跳过。',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '——活动工作区每个工作流的最后一次运行都成功，且在其节奏的 2 倍以内。没有工作流时也显示为',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': '。',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '——至少一次运行超过 2 倍节奏、最后一次提取器失败，或有 1–4 次连续失败。',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle': '——任何单个工作流越过五次连续失败，现在被视为失败中。',
  'workbench.docs.body.systemStatus.desktopNoteTitle': '桌面端应用——产品说明',
  'workbench.docs.body.systemStatus.desktopNote1':
    '桌面端应用仍在开发中，会在扩展稳定之后发布。与桌面端应用集成的工作区、变量和团队同步届时解锁。',
  'workbench.docs.body.systemStatus.desktopNote2': '子系统会在首次启动时自动从已关闭翻到连接中——无需重新安装。',
} as const satisfies Catalog;
