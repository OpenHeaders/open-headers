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
 * reuse); settings path 应用程序 › 数据 › 导出诊断日志 (the zh settings
 * files must reuse); 漂移 = schema drift.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': '系统状态',
  'workbench.docs.body.systemStatus.intro1':
    '是扩展健康状况的实时快照。工作区编辑器的页脚把它显示为一排八枚指示条——每个子系统一枚，各自带彩色圆点。弹窗和侧边栏把它折叠成底部页脚中的单个',
  'workbench.docs.body.systemStatus.intro1Suffix': '条目，其圆点颜色跟随状态最差的子系统。',
  'workbench.docs.body.systemStatus.workbenchCaption': '在工作区编辑器中，这一排位于页脚，每个子系统一枚指示条。',
  'workbench.docs.body.systemStatus.popupCaption': '点击工具栏图标，同样的状态在弹窗页脚以一枚带标签的指示条出现。',
  'workbench.docs.body.systemStatus.worstLevel1':
    '每个子系统报告一个状态，最差级别胜出：红 > 黄 > 绿。任何一处的红都会把合成圆点翻成红色。',
  'workbench.docs.body.systemStatus.worstLevelCaption': '八个子系统状态经 max 折叠成一个合成值——红胜黄，黄胜绿。',
  'workbench.docs.body.systemStatus.popover1':
    '点击任意指示条都会打开同一个详情弹出框。行按固定顺序排在四个带标题的分组之下——连接、浏览器拦截器、API 请求和应用程序。在本次 service worker 生命周期内子系统首次报告之前，行是灰色的，之后变为彩色。完整历史在可观测性日志中——导出入口为',
  'workbench.docs.body.systemStatus.settingsExportPath': '应用程序 › 数据 › 导出诊断日志',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption': '四个带标题的分组按固定顺序排列；首次报告时行变为彩色，位置不变。',
  'workbench.docs.body.systemStatus.stateGreenLabel': '绿色',
  'workbench.docs.body.systemStatus.stateYellowLabel': '黄色',
  'workbench.docs.body.systemStatus.stateRedLabel': '红色',
  'workbench.docs.body.systemStatus.syncName': '同步',
  'workbench.docs.body.systemStatus.syncSubtitle': '后端连接',
  'workbench.docs.body.systemStatus.sync1Prefix': '把此界面作为客户端连接的每个后端——这台机器上的桌面应用（',
  'workbench.docs.body.systemStatus.sync1Suffix':
    '）和任何 OpenHeaders Server——汇成一行：最差的连接决定标签，弹出框里每个后端在其下各占一行。没有配置后端时，该行显示"在此浏览器中运行"——扩展就是自己的后端。',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    '每个后端一条 WebSocket——图中是 localhost 上的桌面应用；服务器是经网络的同一条链路。',
  'workbench.docs.body.systemStatus.sync2':
    '每条线路报告两层。套接字：连接中、断开后按指数退避重连中、已连接——周期性 ping 可发现严格企业代理后面的静默断开。其上的握手：握手中、补齐离线期间错过的变更、已同步。同一后端内最新报告胜出；后端之间最差状态胜出。',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    '已禁用、已连接和已同步为绿色；连接中、重连中、补齐中和 URL 被拒绝为黄色。',
  'workbench.docs.body.systemStatus.sync3':
    '桌面应用或服务器也是他人的后端，这一角色也进入同一汇总：扩展管道的绑定——另一实例占用端口时为红色，启动期间为黄色——绑定后则是连接的扩展数量，以及来自本机还是局域网。绑定了 git 的工作区会加上未提交的变更数。',
  'workbench.docs.body.systemStatus.syncGreenSynced': '已与后端同步',
  'workbench.docs.body.systemStatus.syncGreenConnected': '已连接到后端',
  'workbench.docs.body.systemStatus.syncGreenDisabled': '后端同步已禁用',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': '在此浏览器中运行',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    '——握手已完成、套接字已建立但握手仍在进行、自动连接已关闭，或未配置后端。提供服务的主机则报告其对端：',
  'workbench.docs.body.systemStatus.syncGreenIdle': '空闲——没有扩展连接',
  'workbench.docs.body.systemStatus.syncGreenPeers': '已连接本机上的 N 个扩展',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '（或局域网上）。',
  'workbench.docs.body.systemStatus.syncYellowConnecting': '正在连接后端…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': '重连中（第 N 次尝试）',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': '正在与后端握手…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': '正在补齐变更…',
  'workbench.docs.body.systemStatus.syncYellowRejected': '桌面 URL 被设置拒绝',
  'workbench.docs.body.systemStatus.syncYellowOff': '<后端> 已关闭——其工作区未在同步',
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '——套接字正在建立或恢复、握手进行中、记录没有可用的 URL，或已加入的后端被关闭。提供服务的主机还会加上',
  'workbench.docs.body.systemStatus.syncYellowPipe': '正在启动扩展管道…',
  'workbench.docs.body.systemStatus.syncYellowGit': 'N 项未提交的变更',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '（绑定了 git 的工作区）。',
  'workbench.docs.body.systemStatus.syncRedRejected': '后端拒绝了握手',
  'workbench.docs.body.systemStatus.syncRedTimedOut': '后端未响应握手——正在重试',
  'workbench.docs.body.systemStatus.syncRedCatchUp': '补齐失败',
  'workbench.docs.body.systemStatus.syncRedExplain':
    '——服务器拒绝了握手（协议不匹配、未知工作区、缺少认证；该行会说明原因）、从未应答，或补齐回放失败。提供服务的主机还会加上',
  'workbench.docs.body.systemStatus.syncRedPipe': '扩展管道离线——端口 N 已被占用',
  'workbench.docs.body.systemStatus.syncRedSuffix': '（另一实例占用端口时）。',
  'workbench.docs.body.systemStatus.activityName': '活动',
  'workbench.docs.body.systemStatus.activitySubtitle': '活动流',
  'workbench.docs.body.systemStatus.activity1':
    '统计当前工作区活动流中的未读条目——经同步到达的变更：实体被创建、编辑、删除或移动，本地编辑被覆盖，敏感字段被轮换，权限范围被扩大，AI 代理观察流量。',
  'workbench.docs.body.systemStatus.activity2':
    '只统计当前工作区。其他工作区的条目仍落入各自的活动流，切换过去时会从日志重新读取计数——没有哪个工作区会背上别处的徽标。',
  'workbench.docs.body.systemStatus.activityGreenLabel': '活动已是最新',
  'workbench.docs.body.systemStatus.activityGreenSuffix': '——当前工作区没有未读条目。',
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N 条新 · <标题>',
  'workbench.docs.body.systemStatus.activityYellowMiddle': '——未读条目，以最新一条为标题，直到活动流被阅读。',
  'workbench.docs.body.systemStatus.activityRed': '保留；目前没有代码路径会发出它。',
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
  'workbench.docs.body.systemStatus.debugModeName': '调试模式',
  'workbench.docs.body.systemStatus.debugModeSubtitle': '调试器附加状态',
  'workbench.docs.body.systemStatus.debugMode1':
    '映射调试模式为精确关联请求而附加到标签页的调试器。关闭时报告绿色——开关关闭时故障无关紧要。开启时，该行统计已附加的标签页；浏览器拒绝附加的标签页使其变红，回退到启发式路径的标签页使其变黄。',
  'workbench.docs.body.systemStatus.debugMode2':
    '没有调试器 API 的浏览器从不安装这个报告器，因此那里的行保持灰色，只有启发式路径。',
  'workbench.docs.body.systemStatus.debugModeGreenOff': '关闭',
  'workbench.docs.body.systemStatus.debugModeGreenOr': '或',
  'workbench.docs.body.systemStatus.debugModeGreenOn': '开启 · N 个标签页',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix': '——开关已关闭，或已开启且每个已附加的标签页都正常。',
  'workbench.docs.body.systemStatus.debugModeYellowLabel': '标签页 N 回退到启发式',
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    '——调试器已从该标签页分离（例如取消了横幅），在重新附加之前该标签页按启发式路径关联。',
  'workbench.docs.body.systemStatus.debugModeRedLabel': '标签页 N 附加失败',
  'workbench.docs.body.systemStatus.debugModeRedMiddle': '——浏览器拒绝了附加，通常是因为另一个调试器已占用该标签页。',
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
} as const satisfies Catalog;
