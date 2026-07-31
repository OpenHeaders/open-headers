/**
 * Workbench settings — custom pane components — Simplified Chinese.
 * Extends the zh-CN register contract (`zh-CN/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: back-end 保留 后端 mint, Daemon 保留 守护进程 mint, vault /
 * workflow-seed `seed` / `Org` as dev loanwords, networking
 * vocabulary (loopback, LAN, WAN, RFC1918, mDNS, CGNAT, ULA, APIPA,
 * TLS, `ws://` / `wss://`), IANA port constants (1024 / 49152 /
 * 65535), IP literals and range notes' technical tokens (fd00::/8,
 * 100.64/10, Docker, Tailscale, Bonjour / Avahi), `MCP` / `SSO` /
 * `RBAC` / `CLI` / `oh` / streamable HTTP, snippet filenames
 * (claude_desktop_config.json), the `oh-license.…` key prefix, git
 * command vocabulary (`git remote add`, `--no-verify`, HEAD), and
 * the {chord} / {token} / {url} holes. Settings paths quote the zh
 * shell mints（设置 → 后端）; 守护进程管理 matches the daemon-admin
 * title; 席位 / 档 / 免费档 / 目录用户 / 吊销 / 准入 reuse the
 * daemon-admin mints; 签发 = mint (a token) reuses the chrome mint;
 * 预设 and 快捷键 reuse workbench-settings-defs-keyboard; 配对 =
 * pair carries the shared mint（配对码 = pairing code）; 红绿灯 /
 * scope vocabulary unchanged. MINTS: 轮换 = rotate (a token); 贮藏 =
 * git stash; 层级卡 = tier card (层级 carried from chrome); 信任存储
 * = trust store; 证书颁发机构 = certificate authority (CA raw in
 * chip contexts); 救援分支 = rescue branch; 落到 = fall back to.
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.intro.whoLabel': '谁：',
  'workbench.settings.backendPane.intro.whoText': '处理并存储你的数据。',
  'workbench.settings.backendPane.intro.whereLabel': '在哪：',
  'workbench.settings.backendPane.intro.whereText': '本地或远程。',
  'workbench.settings.backendPane.showDiagrams': '显示图解',
  'workbench.settings.backendPane.learnMore': '了解更多',
  'workbench.settings.backendPane.subsection.reliability.blurb': '不稳定线路上的自动重连行为。适用于每条连接。',
  'workbench.settings.backendPane.subsection.notifications.blurb': '链路断开时的视觉提示。',
  'workbench.settings.backendPane.tierZero.title.extension': '此浏览器',
  'workbench.settings.backendPane.tierZero.title.desktop': '此应用',
  'workbench.settings.backendPane.tierZero.title.web': '此应用',
  'workbench.settings.backendPane.tierZero.copy.extension':
    '扩展自身处理并存储你的数据——工作区、规则和 vault 都留在此浏览器中。始终开启；无需设置。',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    '桌面端应用进程就是后端。其他本地客户端连接到它；你的数据留在这台机器上。始终开启；无需设置。',
  'workbench.settings.backendPane.tierZero.copy.web':
    '提供此页面的应用就是后端。你的数据留在那台主机上。始终开启；无需设置。',
  'workbench.settings.backendPane.tierZero.alwaysOn': '始终开启',
  'workbench.settings.backendPane.tierZero.adminTitle': '服务器管理',
  'workbench.settings.backendPane.tierZero.adminDescription': '管理用户目录和按工作区的访问授权。',
  'workbench.settings.backendPane.tierZero.adminOpen': '打开管理控制台',
  'workbench.settings.backendPane.scenario.desktop-app.title': '桌面应用程序',
  'workbench.settings.backendPane.scenario.desktop-app.hint': '这台机器上的 Open Headers 应用',
  'workbench.settings.backendPane.scenario.local-self-hosted.title': '本地 / LAN',
  'workbench.settings.backendPane.scenario.local-self-hosted.hint': '这台机器或你网络上的服务器',
  'workbench.settings.backendPane.scenario.remote-self-hosted.title': '远程 / WAN',
  'workbench.settings.backendPane.scenario.remote-self-hosted.hint': '你在自己的 VM 上自托管的服务器',
  'workbench.settings.backendPane.wizard.step.scenario': '场景',
  'workbench.settings.backendPane.wizard.step.connect': '连接',
  'workbench.settings.backendPane.wizard.step.pair': '配对',
  'workbench.settings.backendPane.wizard.step.turnOn': '开启',
  'workbench.settings.backendPane.wizard.addTitle': '添加后端',
  'workbench.settings.backendPane.wizard.editTitle': '编辑 {label}',
  'workbench.settings.backendPane.wizard.back': '返回',
  'workbench.settings.backendPane.wizard.next': '下一步',
  'workbench.settings.backendPane.wizard.comingSoon': '即将推出',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': '完成但不连接',
  'workbench.settings.backendPane.wizard.verifyConnect': '验证并连接',
  'workbench.settings.backendPane.wizard.scenarioIntro': '这是哪种后端？选择一个卡片，查看该层级能给你什么。',
  'workbench.settings.backendPane.wizard.scenarioAria': '后端场景',
  'workbench.settings.backendPane.wizard.soonBadge': '即将推出',
  'workbench.settings.backendPane.wizard.connectIntro': '此客户端在哪里拨号后端？连接保持关闭，直到最后一步验证通过。',
  'workbench.settings.backendPane.wizard.pairIntro':
    '向后端证明这台设备——用它显示的配对码配对，或粘贴一个 token。开启前可以先测试连接。',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    '未能自动与桌面应用配对——它可能未在运行，或无法验证此浏览器。请改用配对码或 token 配对。',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    '就绪：{label}，地址 {url}，已配对。开启时会先验证可达性和身份验证；成功后其工作区同步下来，并可离线使用。',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    '就绪：{label}，地址 {url}——尚未配对。开启时会先验证可达性和身份验证；成功后其工作区同步下来，并可离线使用。',
  'workbench.settings.backendPane.wizard.additionalBackend':
    '这是一个额外的后端。它的 Org 会作为新分组出现在工作区切换器中，状态弹出框为每个后端增加一行，每个 Org 只从一个后端同步——已由其他连接提供的 Org 不会重复加入。',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} 已连接。编辑连接等于挪动带电的线路，所以会先断开——你的设置和配对保留，重新开启时会先验证新配置再连接。',
  'workbench.settings.backendPane.wizard.disconnectEdit': '断开并编辑',
  'workbench.settings.backendPane.wizard.testConnection': '测试连接',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': '连接',
  'workbench.settings.backendPane.connections.blurbBrowser':
    '此浏览器已加入的后端。它们的工作区同步下来，并可离线使用。',
  'workbench.settings.backendPane.connections.blurbApp': '此应用已加入的后端。它们的工作区同步下来，并可离线使用。',
  'workbench.settings.backendPane.connections.add': '添加后端',
  'workbench.settings.backendPane.connections.emptyBrowser':
    '没有连接——一切都运行在此浏览器中。添加后端即可从桌面端应用或自托管服务器同步工作区。',
  'workbench.settings.backendPane.connections.emptyApp':
    '没有连接——一切都运行在此应用中。添加后端即可从桌面端应用或自托管服务器同步工作区。',
  'workbench.settings.backendPane.connections.status.connected': '已连接',
  'workbench.settings.backendPane.connections.status.connecting': '正在连接…',
  'workbench.settings.backendPane.connections.status.authRequired': '需要重新配对',
  'workbench.settings.backendPane.connections.status.error': '连接中断',
  'workbench.settings.backendPane.connections.status.off': '关闭',
  'workbench.settings.backendPane.connections.repair': '重新配对',
  'workbench.settings.backendPane.connections.autoConnect': '自动连接',
  'workbench.settings.backendPane.connections.editTooltipConnected': '编辑（会先断开）',
  'workbench.settings.backendPane.connections.editTooltip': '编辑',
  'workbench.settings.backendPane.connections.editAria': '编辑 {label}',
  'workbench.settings.backendPane.connections.disconnectTooltip': '断开（设置会保留）',
  'workbench.settings.backendPane.connections.connectTooltip': '验证并连接',
  'workbench.settings.backendPane.connections.enabledAria': '{label} 已启用',
  'workbench.settings.backendPane.connections.orgConflict': 'Org“{org}”已由 {provider} 提供——未加入',
  'workbench.settings.backendPane.connections.removedBackend': '一个已移除的后端',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': '正在连接到 {label}…',
  'workbench.settings.backendPane.enable.connected': '已连接到 {label}。',
  'workbench.settings.backendPane.enable.orgNotJoined': '{label} 已连接，但其 Org 未加入——见连接行。',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': '移除 {label}？',
  'workbench.settings.backendPane.remove.confirmBody': '它的地址和配对会被忘记。尚未从它同步过任何内容。',
  'workbench.settings.backendPane.remove.aria': '移除 {label}',
  'workbench.settings.backendPane.remove.removed': '已移除 {label}。',
  'workbench.settings.backendPane.remove.tooltip': '移除此后端——由你决定其已同步工作区的去向',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个工作区' }),
  'workbench.settings.backendPane.remove.body.prefix': '此后端提供',
  'workbench.settings.backendPane.remove.body.suffix':
    '，其中 {workspaces} 已同步到这台设备。它自己的数据绝不会被触碰——请选择本地副本的去向。',
  'workbench.settings.backendPane.remove.outcomeAria': '移除结果',
  'workbench.settings.backendPane.remove.recommendedBadge': '推荐',
  'workbench.settings.backendPane.remove.keep.title': '保留本地副本',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} 停止同步。{workspaces} 作为离线本地数据留在这台设备上。',
  'workbench.settings.backendPane.remove.discard.title': '丢弃本地副本',
  'workbench.settings.backendPane.remove.discard.description':
    '每个工作区先备份到下载文件，然后从这台设备删除。之后重新加入该后端会把它们重新同步下来。',
  'workbench.settings.backendPane.remove.discard.includeSecrets': '在备份文件中包含 vault 机密（明文——请妥善保管文件）',
  'workbench.settings.backendPane.remove.removeBackend': '移除后端',
  'workbench.settings.backendPane.remove.backupThenRemove': '先备份，再移除',
  'workbench.settings.backendPane.remove.progress.removing': '正在移除后端…',
  'workbench.settings.backendPane.remove.progress.preparing': '正在准备备份…',
  'workbench.settings.backendPane.remove.progress.backingUp': '正在备份“{name}”…',
  'workbench.settings.backendPane.remove.progress.deleting': '正在删除“{name}”…',
  'workbench.settings.backendPane.remove.keepDone': '已移除 {label}。{orgs} 停止同步；{workspaces} 留在这台设备上。',
  'workbench.settings.backendPane.remove.discardDone': '已移除 {label}。已备份并删除 {workspaces}；{orgs} 已解绑。',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      other: `已移除 ${String(label)}，但 {count} 个工作区被留下`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody': '无法删除：{names}。它们作为本地数据保留。',
  'workbench.settings.backendPane.remove.backupFailedTitle': '“{name}”的备份失败',
  'workbench.settings.backendPane.remove.backupFailedBody': '导出未完成。什么也没有被移除。',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': '用配对码配对',
  'workbench.settings.backendPane.pair.pasteTokenTitle': '粘贴 token',
  'workbench.settings.backendPane.pair.codeBlurb':
    '输入后端显示的配对码。我们会用它换取身份验证 token 并连接此浏览器。',
  'workbench.settings.backendPane.pair.tokenBlurb':
    '粘贴后端显示的 token——轮换只显示新机密一次。它会被保存为此浏览器的凭据。',
  'workbench.settings.backendPane.pair.codePlaceholder': '6 位配对码',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': '设备名称（可选）',
  'workbench.settings.backendPane.pair.codeRequired': '请输入后端显示的配对码。',
  'workbench.settings.backendPane.pair.pasteTokenRequired': '请粘贴后端显示的 token。',
  'workbench.settings.backendPane.pair.pairAction': '配对',
  'workbench.settings.backendPane.pair.saveToken': '保存 token',
  'workbench.settings.backendPane.pair.tokenSaved': '身份验证 token 已保存。',
  'workbench.settings.backendPane.pair.pairedSaved': '已配对——身份验证 token 已保存。',
  'workbench.settings.backendPane.pair.switchToToken': '有 token？改为粘贴它',
  'workbench.settings.backendPane.pair.switchToCode': '改用配对码？',
  'workbench.settings.backendPane.pair.fail.unknown': '该配对码未知或已过期。请索取新的配对码后重试。',
  'workbench.settings.backendPane.pair.fail.expired': '该配对码已过期。请在后端生成一个新的。',
  'workbench.settings.backendPane.pair.fail.consumed': '该配对码已被使用。请在后端生成一个新的。',
  'workbench.settings.backendPane.pair.fail.unreachable': '无法在 {url} 访问到后端。它在那个地址上运行吗？',
  'workbench.settings.backendPane.pair.fail.generic': '配对失败。请重试。',
  'workbench.settings.backendPane.pair.nmRequired':
    '与桌面应用的手动配对已关闭——此浏览器仅通过经验证的配对进行连接。请参阅"要求经验证的配对"设置。',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': '名称',
  'workbench.settings.backendPane.field.label.description': '此后端在整个应用中的叫法。默认为它的地址。',
  'workbench.settings.backendPane.field.label.placeholder': '工作 VM',
  'workbench.settings.backendPane.field.label.aria': '后端名称',
  'workbench.settings.backendPane.field.url.label': '后端地址',
  'workbench.settings.backendPane.field.url.description':
    '此客户端在哪里拨号后端。本地 / LAN 主机用 `ws://`，远程用 `wss://`。',
  'workbench.settings.backendPane.field.url.schemeAria': '协议',
  'workbench.settings.backendPane.field.url.addressAria': '地址',
  'workbench.settings.backendPane.field.url.portAria': '端口',
  'workbench.settings.backendPane.field.auth.label': '身份验证',
  'workbench.settings.backendPane.field.auth.description':
    '这台设备如何向后端证明自己。用配对码配对，或直接粘贴 token。',
  'workbench.settings.backendPane.field.auth.codeAria': '配对码',
  'workbench.settings.backendPane.field.auth.tokenAria': '身份验证 token',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': '粘贴 token',
  'workbench.settings.backendPane.field.auth.paired': '已配对——访问 token 已保存',
  'workbench.settings.backendPane.field.auth.useToken': '改用身份验证 token',
  'workbench.settings.backendPane.field.auth.useCode': '改用配对码配对',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': '请输入端口。',
  'workbench.settings.backendPane.port.notInteger': '端口必须是整数。',
  'workbench.settings.backendPane.port.privileged': '1024 以下的端口是特权端口，需要提升权限——请选择 1024 或更高。',
  'workbench.settings.backendPane.port.aboveMax': '端口必须不超过 65535。',
  'workbench.settings.backendPane.port.ephemeral':
    '49152–65535 是操作系统分配给传出连接的端口范围；在这里监听可能会间歇性地绑定失败。1024–49151 范围内的端口更可靠。',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': '允许 LAN 上的对等方？',
  'workbench.settings.backendPane.lan.confirmOk': '允许 LAN 对等方',
  'workbench.settings.backendPane.lan.confirmCancel': '仅保留环回',
  'workbench.settings.backendPane.lan.confirmBody':
    '桌面后端将绑定每个本地网络接口，使你网络上的其他设备可以连接。每条连接——无论 LAN 还是环回——都必须出示已配对的身份验证 token；没有免 token 的通道。设备用应用显示的配对码配对（或把 token 粘贴到设置 → 后端 → 身份验证 token）。',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.title': '离线回退顺序',
  'workbench.settings.backendPane.fallback.blurb':
    '如果后端离线，此列表上第一个可达的主机会自行刷新独占工作流的凭据。主机自动加入；拖动可重新排序。',
  'workbench.settings.backendPane.fallback.empty':
    '还没有主机加入。当某个浏览器持有此工作区中独占 Live 工作流的 seed 时，它就会加入此列表。',
  'workbench.settings.backendPane.fallback.saveFailed': '保存新顺序失败',
  'workbench.settings.backendPane.fallback.removeFailed': '移除主机失败',
  'workbench.settings.backendPane.fallback.dragAria': '拖动以重新排序',
  'workbench.settings.backendPane.fallback.selfTag': '此浏览器',
  'workbench.settings.backendPane.fallback.pruneTitle': '移除此主机？',
  'workbench.settings.backendPane.fallback.pruneBody': '如果它仍持有某个独占工作流的 seed，会自动重新加入。',

  // ── Backend pane: tier cards ────────────────────────────────────────
  // The tier registry (`backend-tier-data.ts`) renders inside a
  // fixed-geometry SVG card. Titles, capability bullets, and range-
  // category labels are keyed; IP ranges, URL patterns, and platform
  // proper nouns stay literal (technical plane). Networking vocabulary
  // inside keyed labels (loopback, RFC1918, mDNS, …) is
  // glossary-protected on translator handoff.
  'workbench.settings.backendPane.tier.cardAria': '{title} 层级卡',
  'workbench.settings.backendPane.tier.badge.today': '现已可用',
  'workbench.settings.backendPane.tier.badge.roadmap': '路线图',
  'workbench.settings.backendPane.tier.inheritsFrom': '继承自{tier}',
  'workbench.settings.backendPane.tier.newInTier': '+ 此层级新增',
  'workbench.settings.backendPane.tier.supports': '支持',
  'workbench.settings.backendPane.tier.in-browser.title': '浏览器内',
  'workbench.settings.backendPane.tier.in-browser.sub': '扩展 Service Worker',
  'workbench.settings.backendPane.tier.desktop-app.title': '桌面端应用',
  'workbench.settings.backendPane.tier.desktop-app.sub': '内嵌服务器',
  'workbench.settings.backendPane.tier.local-self-hosted.title': '本地服务器',
  'workbench.settings.backendPane.tier.local-self-hosted.sub': '在你的 LAN 上',
  'workbench.settings.backendPane.tier.remote-self-hosted.title': '远程服务器',
  'workbench.settings.backendPane.tier.remote-self-hosted.sub': '在 WAN 上',
  'workbench.settings.backendPane.tier.bullet.zeroSetup': '零设置',
  'workbench.settings.backendPane.tier.bullet.minimalSetup': '极简设置',
  'workbench.settings.backendPane.tier.bullet.standardSetup': '标准设置',
  'workbench.settings.backendPane.tier.bullet.singleDevice': '单台设备',
  'workbench.settings.backendPane.tier.bullet.multipleDevices': '多台设备',
  'workbench.settings.backendPane.tier.bullet.perBrowserInstance': '按浏览器实例',
  'workbench.settings.backendPane.tier.bullet.perAppInstance': '按应用实例',
  'workbench.settings.backendPane.tier.bullet.multiBrowserInstances': '多浏览器实例',
  'workbench.settings.backendPane.tier.bullet.multiAppInstances': '多应用实例',
  'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing': '多界面并发编辑',
  'workbench.settings.backendPane.tier.bullet.multiWindowEditing': '多窗口并发编辑',
  'workbench.settings.backendPane.tier.bullet.localhostOnly': '仅限 localhost',
  'workbench.settings.backendPane.tier.bullet.localhostSupported': '支持 localhost',
  'workbench.settings.backendPane.tier.bullet.lanReachable': 'LAN 可达',
  'workbench.settings.backendPane.tier.bullet.wanReachable': 'WAN/互联网可达',
  'workbench.settings.backendPane.tier.bullet.nativeFilesystem': '原生文件系统',
  'workbench.settings.backendPane.tier.bullet.yamlOnDisk': '磁盘上的 YAML',
  'workbench.settings.backendPane.tier.bullet.gitIntegration': 'git 集成（本地/远程）',
  'workbench.settings.backendPane.tier.bullet.clients': '浏览器扩展 · 桌面端应用 · CLI',
  'workbench.settings.backendPane.tier.bullet.headlessByDefault': '默认无界面 · 网站可选启用',
  'workbench.settings.backendPane.tier.bullet.teamReady': '团队就绪',
  'workbench.settings.backendPane.tier.bullet.ssoAuth': 'SSO 身份验证',
  'workbench.settings.backendPane.tier.bullet.rbac': 'RBAC 用户管理',
  'workbench.settings.backendPane.tier.bullet.auditLogs': '审计日志与报告',
  'workbench.settings.backendPane.tier.note.soon': '即将推出',
  'workbench.settings.backendPane.tier.group.allOs': '所有操作系统',
  'workbench.settings.backendPane.tier.group.embedded': '内嵌',
  'workbench.settings.backendPane.tier.group.hyperscalers': '超大规模云',
  'workbench.settings.backendPane.tier.group.euNative': '欧盟本土云',
  'workbench.settings.backendPane.tier.group.other': '其他',
  'workbench.settings.backendPane.tier.group.enterprise': '企业级',
  'workbench.settings.backendPane.tier.platform.yourCloud': '你的云',
  'workbench.settings.backendPane.tier.platform.onPrem': '本地部署',
  'workbench.settings.backendPane.tier.platform.homeServer': '家庭服务器',
  'workbench.settings.backendPane.tier.platform.oldLaptop': '旧笔记本电脑',
  'workbench.settings.backendPane.tier.platform.miniPc': '迷你主机',
  'workbench.settings.backendPane.tier.reach.none': 'N/A',
  'workbench.settings.backendPane.tier.reach.localhost': 'Localhost',
  'workbench.settings.backendPane.tier.reach.lan': 'Localhost/LAN',
  'workbench.settings.backendPane.tier.reach.wan': '互联网/WAN',
  'workbench.settings.backendPane.tier.cat.whyNoWire': '为什么没有线路？',
  'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces': '同浏览器界面',
  'workbench.settings.backendPane.tier.cat.perBrowserInstance': '按浏览器实例',
  'workbench.settings.backendPane.tier.cat.ipv4Loopback': 'IPv4 环回',
  'workbench.settings.backendPane.tier.cat.ipv6Loopback': 'IPv6 环回',
  'workbench.settings.backendPane.tier.cat.defaultPort': '默认端口',
  'workbench.settings.backendPane.tier.cat.localhostLoopback': 'Localhost / 环回',
  'workbench.settings.backendPane.tier.cat.rfc1918': 'RFC1918 私有 IPv4',
  'workbench.settings.backendPane.tier.cat.ipv6Ula': 'IPv6 ULA',
  'workbench.settings.backendPane.tier.cat.cgnat': 'CGNAT / overlay',
  'workbench.settings.backendPane.tier.cat.zeroConfig': '零配置 / 无 DHCP 回退',
  'workbench.settings.backendPane.tier.cat.mdns': 'mDNS 主机名',
  'workbench.settings.backendPane.tier.cat.publicDns': '公共 DNS 主机名',
  'workbench.settings.backendPane.tier.cat.publicIpv4': '公网 IPv4',
  'workbench.settings.backendPane.tier.cat.publicIpv6': '公网 IPv6',
  'workbench.settings.backendPane.tier.cat.transport': '传输',
  'workbench.settings.backendPane.tier.rangeNote.backendIsSw': '没有可监听的端口，没有向其他设备公开的 IPC 界面',
  'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging':
    '弹窗 / 工作区编辑器 / DevTools / 侧边面板与 SW 进程内通信',
  'workbench.settings.backendPane.tier.rangeNote.storageLocal':
    'Chrome ≠ Firefox ≠ Edge——每个浏览器数据独立，不跨设备、不跨浏览器',
  'workbench.settings.backendPane.tier.rangeNote.typicalLoopback': '通常为 127.0.0.1',
  'workbench.settings.backendPane.tier.rangeNote.portOverride': '在后端 → 连接中覆盖',
  'workbench.settings.backendPane.tier.rangeNote.serverOwnBox': 'IPv4——服务器在你自己的机器上（Docker、sidecar）',
  'workbench.settings.backendPane.tier.rangeNote.ipv6': 'IPv6',
  'workbench.settings.backendPane.tier.rangeNote.ulaPractically': '实际上是 fd00::/8——IPv6 私有分配',
  'workbench.settings.backendPane.tier.rangeNote.overlayVendors': 'Tailscale 等',
  'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal': 'IPv4 链路本地（APIPA）',
  'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal': 'IPv6 链路本地——每个接口自动分配一个',
  'workbench.settings.backendPane.tier.rangeNote.bonjour': 'Bonjour / Avahi',
  'workbench.settings.backendPane.tier.rangeNote.tlsCert': '推荐——TLS 证书',
  'workbench.settings.backendPane.tier.rangeNote.publicIpv4': 'RFC1918 / 100.64/10 之外的一切',
  'workbench.settings.backendPane.tier.rangeNote.globallyRoutable': '全球可路由',
  'workbench.settings.backendPane.tier.rangeNote.tlsRequired': '必需——客户端拒绝对非环回主机使用 ws://',

  // ── Backend pane: scene-diagram aria labels ────────────────────────
  // The topology scenes themselves stay literal English (illustration
  // plane, S3 glyph precedent); only their accessible names localize.
  'workbench.settings.backendPane.detail.aria.in-browser': '浏览器内后端',
  'workbench.settings.backendPane.detail.aria.desktop-app': '桌面端应用后端',
  'workbench.settings.backendPane.detail.aria.local-self-hosted': '本地 LAN 服务器后端',
  'workbench.settings.backendPane.detail.aria.remote-self-hosted': '远程自托管后端',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': '搜索快捷键',
  'workbench.settings.keymapPane.noMatches': '没有快捷键匹配你的搜索。',
  'workbench.settings.keymapPane.recording': '请按键…',
  'workbench.settings.keymapPane.unbound': '未绑定',
  'workbench.settings.keymapPane.recordTip': '点击以录制新快捷键',
  'workbench.settings.keymapPane.recordAria': '更改 {label} 的快捷键',
  'workbench.settings.keymapPane.unbind': '移除快捷键',
  'workbench.settings.keymapPane.unbindAria': '移除 {label} 的快捷键',
  'workbench.settings.keymapPane.resetAria': '重置 {label} 的快捷键',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个快捷键存在冲突的分配' }),
  'workbench.settings.keymapPane.conflictShowOnly': '显示冲突',
  'workbench.settings.keymapPane.conflictShowAll': '显示所有快捷键',
  'workbench.settings.keymapPane.conflictBadgeAria': '快捷键冲突',
  'workbench.settings.keymapPane.conflictTooltip': '还被分配给：{labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': '保留快捷键',
  'workbench.settings.keymapPane.reservedBrowser': '浏览器保留了此快捷键——它可能在到达应用之前就被响应。',
  'workbench.settings.keymapPane.reservedSystem': '操作系统保留了此快捷键——它可能在到达应用之前就被响应。',
  'workbench.settings.keymapPane.lookupTip': '按下快捷键即可查找对应操作',
  'workbench.settings.keymapPane.lookupAria': '按快捷键查找操作',
  'workbench.settings.keymapPane.lookupEmpty': '没有操作绑定到 {chord}。',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} 已被分配给：{labels}',
  'workbench.settings.keymapPane.conflictReassign': '重新分配',
  'workbench.settings.keymapPane.conflictKeepBoth': '两者都保留',
  'workbench.settings.keymapPane.presetAria': '快捷键预设',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), { other: '恢复预设（{count} 处自定义）' }),
  'workbench.settings.keymapPane.presetRestoreTip': '把每个自定义过的快捷键重置为当前预设。',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': '已配对的设备',
  'workbench.settings.backendTokens.sectionBlurb':
    '每台连接到此后端的设备都用一个访问 token 进行身份验证。已连接的设备会高亮显示；轮换 token 会签发新机密并让旧的退役。',
  'workbench.settings.backendTokens.labelPlaceholder': '标签（可选）——例如“alice 的手机”',
  'workbench.settings.backendTokens.bindUserPlaceholder': '绑定到用户（可选）',
  'workbench.settings.backendTokens.generate': '生成 token',
  'workbench.settings.backendTokens.pairDevice': '配对设备',
  'workbench.settings.backendTokens.explainer.intro': '两种方式都会在下方添加一个 token。',
  'workbench.settings.backendTokens.explainer.generateText': '会显示机密，由你自己复制并粘贴到设备中。',
  'workbench.settings.backendTokens.explainer.pairText':
    '会显示一个短配对码，设备在设置 → 后端 → 用配对码配对处输入（或作为回退打开一个链接）——由别人设置设备时用这种方式。',
  'workbench.settings.backendTokens.empty':
    '还没有设备。生成一个 token 并粘贴到设备的设置 → 后端中，或配对一台设备并让它在那里输入配对码。',
  'workbench.settings.backendTokens.mintFailed': '签发 token 失败：{message}',
  'workbench.settings.backendTokens.rotateFailed': '轮换失败：{message}',
  'workbench.settings.backendTokens.revokeFailed': '吊销失败：{message}',
  'workbench.settings.backendTokens.revokedDevice': 'token 已吊销。使用它的设备都已断开连接。',
  'workbench.settings.backendTokens.revokedSession': '会话已吊销。该用户已被登出。',
  'workbench.settings.backendTokens.rotate': '轮换',
  'workbench.settings.backendTokens.revoke': '吊销',
  'workbench.settings.backendTokens.rotateConfirmTitle': '轮换此 token？',
  'workbench.settings.backendTokens.rotateConfirmBody':
    '会签发一个新机密并吊销当前的。设备必须拿到新 token 才能重新连接。',
  'workbench.settings.backendTokens.revokeConfirmTitle': '吊销此 token？',
  'workbench.settings.backendTokens.revokeConfirmBody': '当前使用它的设备会立即断开连接，且无法重新连接。',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': '吊销此会话？',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    '该用户会被立即登出并断开连接。他们必须重新通过身份提供方登录。',
  'workbench.settings.backendTokens.revokedTag': '{when}已吊销',
  'workbench.settings.backendTokens.connectedTag': '已连接',
  'workbench.settings.backendTokens.expiredTag': '已过期',
  'workbench.settings.backendTokens.unlabeled': '（无标签）',
  'workbench.settings.backendTokens.unbound': '（未绑定）',
  'workbench.settings.backendTokens.meta.device': 'id {id} · 创建于 {created} · 最近使用 {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': '用户 {user}',
  'workbench.settings.backendTokens.meta.session':
    '登录于 {signedIn} · 过期于 {expires} · 最近活动 {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'SSO 会话',
  'workbench.settings.backendTokens.ssoBlurb':
    '每次 SSO 登录都会签发一个自行过期的会话。吊销即可立即登出该用户——他们必须重新通过身份提供方登录。',
  'workbench.settings.backendTokens.secretTitle': '现在复制此 token',
  'workbench.settings.backendTokens.secretTitleRotated': '现在复制轮换后的 token',
  'workbench.settings.backendTokens.secretBody':
    '后端只存储此值的哈希。此对话框关闭后机密将无法恢复——如果丢失，请吊销该 token 并签发一个新的。',
  'workbench.settings.backendTokens.secretBodyRotated':
    '之前的 token 现已吊销——把这个新机密交给设备，它才能重新连接。后端只存储此值的哈希。此对话框关闭后机密将无法恢复——如果丢失，请吊销该 token 并签发一个新的。',
  'workbench.settings.backendTokens.secretSaved': '我已保存',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': '完成',
  'workbench.settings.backendTokens.pairModal.allocating': '正在分配配对码…',
  'workbench.settings.backendTokens.pairModal.startFailed': '无法开始配对',
  'workbench.settings.backendTokens.pairModal.expiredTitle': '配对已过期',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    '5 分钟窗口内没有收到确认。关闭此对话框，再次点击“配对设备”重新开始。',
  'workbench.settings.backendTokens.pairModal.pairedTitle': '已配对',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    '设备确认了配对码。已签发一个新的访问 token 并保存在那台设备上；它出现在下方列表中。如果设备无法连接，请吊销该条目并重新配对。',
  'workbench.settings.backendTokens.pairModal.intro.part1': '在另一台设备上，打开',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': '设置 → 后端',
  'workbench.settings.backendTokens.pairModal.intro.part2': '，把它的',
  'workbench.settings.backendTokens.pairModal.intro.address': '后端地址',
  'workbench.settings.backendTokens.pairModal.intro.part3': '指向此应用，然后点击',
  'workbench.settings.backendTokens.pairModal.intro.part4': '并输入：',
  'workbench.settings.backendTokens.pairModal.codeLabel': '配对码',
  'workbench.settings.backendTokens.pairModal.expiresIn': '{remaining}后过期',
  'workbench.settings.backendTokens.pairModal.addressListLabel': '此应用的后端地址',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': '那台设备上没有',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    '选项？改为在那里打开这些链接之一——它会提供一个页面，交出一个可手动粘贴的 token。',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': '命令行访问',
  'workbench.settings.cliAccess.sectionBlurb':
    '一次点击即可把这台机器上的命令行工具 oh 连接到应用——为它创建并保存一个访问 token，无需复制。',
  'workbench.settings.cliAccess.statusUnconfigured': '这台机器上的 CLI 尚未连接。',
  'workbench.settings.cliAccess.statusConfigured': 'CLI 已连接，身份为 {label}。',
  'workbench.settings.cliAccess.statusStale': '已保存的 CLI token 不再有效——重新设置访问即可重新连接。',
  'workbench.settings.cliAccess.statusExternal':
    'CLI 当前连接到另一个后端（{url}）。在这里设置访问会把它改为指向此应用。',
  'workbench.settings.cliAccess.statusMalformed': 'CLI 配置文件无法读取：{message}',
  'workbench.settings.cliAccess.pathNote': '保存在 {path}',
  'workbench.settings.cliAccess.setUp': '设置 CLI 访问',
  'workbench.settings.cliAccess.rotate': '轮换 CLI 访问',
  'workbench.settings.cliAccess.connectHere': '连接到此应用',
  'workbench.settings.cliAccess.provisioned': 'CLI 访问已设置——oh 现在可在这台机器上的任何终端中使用。',
  'workbench.settings.cliAccess.rotated': 'CLI token 已轮换——之前的 token 已吊销。',
  'workbench.settings.cliAccess.provisionFailed': 'CLI 设置失败：{message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff': 'MCP 服务器已关闭——启用之前客户端无法连接。',
  'workbench.settings.mcpPane.connect.title': '连接客户端',
  'workbench.settings.mcpPane.connect.blurb':
    '选择你的客户端，把 {token} 替换为上方生成的 token，如果安装在别处再调整应用路径。客户端连接时应用必须在运行。',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json——合并进现有文件',
  'workbench.settings.mcpPane.snippet.runOnceTitle': '在终端中运行一次',
  'workbench.settings.mcpPane.snippet.cliTitle': '在终端中运行一次——之后的 oh 运行无需任何标志',
  'workbench.settings.mcpPane.snippet.httpTitle': '用于直接使用 streamable HTTP 的客户端',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': '启用 MCP 服务器',
  'workbench.settings.mcpConsent.body': '代理客户端和 oh TUI 通过 MCP 服务器与此应用通信，该服务器当前处于关闭状态。',
  'workbench.settings.mcpConsent.info.title': 'MCP 服务器',
  'workbench.settings.mcpConsent.info.summary':
    'MCP 客户端通过后端的 /mcp 端点（基于可流式 HTTP 的 Model Context Protocol）访问此应用。' +
    'mcp.enabled 设置项控制该端点——它关闭时端点返回 404。客户端使用与其他连接相同的访问 token 进行身份验证。',
  'workbench.settings.mcpConsent.ok': '启用',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': '安装的文件不是许可证密钥。',
  'workbench.settings.licensePane.invalid.schema-mismatch': '安装的许可证不匹配此版本支持的任何 schema。',
  'workbench.settings.licensePane.invalid.unknown-kid': '安装的许可证由此构建版本不信任的密钥签名。',
  'workbench.settings.licensePane.invalid.bad-signature': '安装的许可证未通过签名验证——文本在签名后被改动过。',
  'workbench.settings.licensePane.installed': '许可证已安装',
  'workbench.settings.licensePane.removed': '许可证已移除——回到免费档',
  'workbench.settings.licensePane.removeFailed': '移除许可证失败：{message}',
  'workbench.settings.licensePane.freeTier.title': '免费档',
  'workbench.settings.licensePane.freeTier.body':
    'Open Headers 今天的一切功能都包含在内——免费档每个服务器最多准入 {limit} 个活跃用户。安装许可证密钥可提高席位上限。',
  'workbench.settings.licensePane.invalidAlert.title': '已安装的许可证不可用',
  'workbench.settings.licensePane.invalidAlert.body':
    '应用继续以免费档运行（最多 {limit} 个活跃用户）。在下方粘贴新密钥或联系支持。',
  'workbench.settings.licensePane.grace.title': '许可证已过期——宽限期生效中',
  'workbench.settings.licensePane.grace.body':
    '此许可证已于 {expiredOn} 过期。请在 {graceEndsOn} 之前续期——此后创建或重新激活用户会落到免费上限 {limit}。现有用户照常登录，任何数据都绝不受影响。',
  'workbench.settings.licensePane.expired.title': '许可证和宽限期都已结束',
  'workbench.settings.licensePane.expired.body':
    '新用户创建和重新激活现在遵循 {limit} 个活跃用户的免费上限。现有用户照常登录，现有工作区照常工作，任何数据都绝不受影响。安装续期后的密钥可恢复许可的席位数量。',
  'workbench.settings.licensePane.detail.licensedTo': '授权给',
  'workbench.settings.licensePane.detail.contact': '联系人',
  'workbench.settings.licensePane.detail.seats': '席位',
  'workbench.settings.licensePane.detail.validUntil': '有效期至',
  'workbench.settings.licensePane.detail.licenseId': '许可证 id',
  'workbench.settings.licensePane.tag.active': '生效中',
  'workbench.settings.licensePane.tag.offline': '离线许可证',
  'workbench.settings.licensePane.removeConfirm.title': '移除此许可证？',
  'workbench.settings.licensePane.removeConfirm.body':
    '应用回到免费档（最多 {limit} 个活跃用户）。任何数据都不受影响。',
  'workbench.settings.licensePane.removeConfirm.ok': '移除',
  'workbench.settings.licensePane.removeButton': '移除许可证',
  'workbench.settings.licensePane.replaceTitle': '替换许可证',
  'workbench.settings.licensePane.installTitle': '安装许可证',
  'workbench.settings.licensePane.pastePlaceholder': '粘贴你的许可证密钥（oh-license.…）',
  'workbench.settings.licensePane.installButton': '安装',
  'workbench.settings.licensePane.loadFromFile': '从文件加载…',

  // ── System-plane proxy section (REQUEST_ENGINE_PROXY_DESIGN.md P3) ─
  'workbench.settings.systemProxy.title': '出站代理——此设备',
  'workbench.settings.systemProxy.intro':
    '从这台机器发出的请求、WebSocket 会话和 gRPC 调用如何抵达网络。设备本地、永不同步——除非请求自己设置了代理模式，否则都遵循此处配置。',
  'workbench.settings.systemProxy.mode.system': '系统',
  'workbench.settings.systemProxy.mode.systemDesc':
    '遵循这台机器自己的代理配置——系统设置、PAC 文件与自动发现——与浏览器完全一致。默认值；未托管的机器就是直接连接。',
  'workbench.settings.systemProxy.mode.manual': '手动',
  'workbench.settings.systemProxy.mode.manualDesc': '在此配置一个代理用于所有流量——含 vault 凭据与绕过列表。',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    '由 URL 或本地路径指定的 PAC 文件按 URL 决定。脚本只在沙盒化的浏览器网络栈内运行，绝不在应用内。',
  'workbench.settings.systemProxy.mode.off': '关闭',
  'workbench.settings.systemProxy.mode.offDesc': '始终直接连接，无论机器怎么配置。',
  'workbench.settings.systemProxy.manual.url': '代理',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'proxy.example:8080 或 http://proxy.example:8080',
  'workbench.settings.systemProxy.manual.credentials': '凭据',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': '无身份验证',
  'workbench.settings.systemProxy.manual.bypass': '绕过列表',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.pac.source': 'PAC URL 或文件',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'https://proxy.example/proxy.pac 或 /path/to/proxy.pac',
  'workbench.settings.systemProxy.saveFailed': '设置无法保存：{message}',
  'workbench.settings.systemProxy.sourced': '将 {url} 解析为',
  'workbench.settings.systemProxy.refresh': '刷新',
  'workbench.settings.systemProxy.previewPlaceholder': '预览一个 URL——它会走哪条路由？',
  'workbench.settings.systemProxy.previewButton': '解析',

  // ── Proxy trust pane body (PROXY_SECURITY.md §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    '解密 HTTPS 流量需要一个在这台机器上创建的证书颁发机构。在你于此设置信任之前不会安装任何东西，在此安装的一切也都能在此移除。',
  'workbench.settings.proxyTrustPane.refresh': '重新检查',
  'workbench.settings.proxyTrustPane.loadFailed': '无法读取信任状态：{message}',
  'workbench.settings.proxyTrustPane.ca.title': '证书颁发机构',
  'workbench.settings.proxyTrustPane.ca.none':
    '还没有证书颁发机构。第一次设置信任时会在这台机器上创建一个——它绝不随应用一起分发，其私钥绝不离开这台电脑。',
  'workbench.settings.proxyTrustPane.ca.subject': '主题',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'SHA-256 指纹',
  'workbench.settings.proxyTrustPane.ca.validity': '有效期',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from} 至 {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': '删除证书颁发机构',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': '删除证书颁发机构？',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    '密钥对将从这台机器上删除。再次设置信任会创建一个全新的颁发机构。',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': '删除',
  'workbench.settings.proxyTrustPane.ca.deleted': '证书颁发机构已删除',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': '无法删除证书颁发机构：{message}',
  'workbench.settings.proxyTrustPane.stores.title': '信任存储',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': '登录钥匙串',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': '系统钥匙串',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Firefox 配置文件',
  'workbench.settings.proxyTrustPane.stores.state.trusted': '已信任',
  'workbench.settings.proxyTrustPane.stores.state.absent': '未安装',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': '存在，但未受信任',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': '不同的证书',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': '无法读取',
  'workbench.settings.proxyTrustPane.stores.state.covered': '经系统存储覆盖',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': '已在 Firefox 中停用',
  'workbench.settings.proxyTrustPane.stores.empty': '这台机器上看不到任何信任存储。',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': '某个信任存储中有不同的证书',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    '安装了一个带有我们颁发机构名称的证书，但其指纹不是这台机器的颁发机构。此应用没有安装它，也绝不使用它——请检查它所在的存储。',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 条已记录的安装' }),
  'workbench.settings.proxyTrustPane.installButton': '设置信任…',
  'workbench.settings.proxyTrustPane.wizard.title': '安装代理证书颁发机构',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': '会安装什么',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    '一个在这台机器上创建、专属于此安装的根证书。其私钥静态加密存储，绝不发送到任何地方。',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': '它能做什么',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    '持有它的信任存储会接受捕获代理的证书，因此代理能解密 HTTPS——仅限你显式列入范围的主机。其余一切原样通过。',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': '如何移除',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    '每次更改都有记录，在此页面上一次点击即可精确撤销这些更改。卸载应用也会做同样的事。',
  'workbench.settings.proxyTrustPane.wizard.explain.next': '选择信任存储',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb': '选择安装位置。在你确认之前什么都不会改变。',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote': '以你的身份运行的应用——无需管理员批准。',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote': '这台机器上的每个用户——会请求管理员批准。',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    '此构建版本还不支持系统级信任——它需要 OpenHeaders 辅助程序。目前请使用登录钥匙串。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox 有自己的信任存储——会安装进找到的每个配置文件。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone': '这台机器上没有找到 Firefox 配置文件。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    '找到了 Firefox 配置文件，但未安装 certutil（NSS 工具）— 无法在这台机器上管理它们的信任存储。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox 会自动信任系统存储（Firefox 120+）——上面的钥匙串已将其覆盖。',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), { other: '安装进 {count} 个存储' }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': '你选中的每个存储都已安装信任。',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    '部分存储保持原样。不会自行重试——修复原因后再次设置信任，或移除信任以回滚。',
  'workbench.settings.proxyTrustPane.wizard.results.ok': '已安装并受信任',
  'workbench.settings.proxyTrustPane.wizard.results.elevation': '管理员批准被拒绝——该存储保持原样。',
  'workbench.settings.proxyTrustPane.wizard.results.residue': '证书已添加但无法被信任。使用“移除信任”清理它。',
  'workbench.settings.proxyTrustPane.wizard.results.failed': '失败：{message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': '信任设置失败：{message}',
  'workbench.settings.proxyTrustPane.wizard.done': '完成',
  'workbench.settings.proxyTrustPane.removeButton': '移除信任',
  'workbench.settings.proxyTrustPane.removeConfirm.title': '从每个已记录的存储中移除证书？',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    '每条已记录的安装都会被撤销并验证干净，然后其记录才被删除。证书颁发机构本身会保留，供以后重新安装。',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': '移除',
  'workbench.settings.proxyTrustPane.removed': '信任已移除——每个已记录的存储都已验证干净。',
  'workbench.settings.proxyTrustPane.removePartial': '部分存储无法验证干净。它们的记录被保留——修复原因后再次运行移除。',
  'workbench.settings.proxyTrustPane.removeFailed': '移除失败：{message}',
  'workbench.settings.proxyTrustPane.helper.title': '特权助手',
  'workbench.settings.proxyTrustPane.helper.blurb':
    '系统钥匙串信任经由一个已签名的助手完成，它以后台项目的身份注册到 macOS。它只搬运证书字节 — 每一次信任决定仍要经过 macOS 管理员对话框。',
  'workbench.settings.proxyTrustPane.helper.notPresent': '此构建不包含 — 仅限打包的 macOS 构建。',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': '注册',
  'workbench.settings.proxyTrustPane.helper.serverLabel': '服务器',
  'workbench.settings.proxyTrustPane.helper.state.enabled': '已注册',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': '等待批准',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': '未注册',
  'workbench.settings.proxyTrustPane.helper.state.notFound': '未找到 — 请先将应用安装到“应用程序”',
  'workbench.settings.proxyTrustPane.helper.state.unknown': '未知',
  'workbench.settings.proxyTrustPane.helper.probe.ok': '有响应',
  'workbench.settings.proxyTrustPane.helper.probe.down': '无响应',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS 正在等待批准：在“登录项” › “允许在后台运行”中启用 OpenHeaders，然后重新检查。',
  'workbench.settings.proxyTrustPane.helper.registerButton': '注册',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': '取消注册',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': '打开登录项',
  'workbench.settings.proxyTrustPane.helper.actionFailed': '助手操作失败：{message}',

  // ── Backend-details scene pills ────────────────────────────────────
  // Architecture component names (sync-engine · rule-engine · oracle ·
  // vault) are glossary vocabulary and ride raw inside the pills; only
  // the connective text keys here.
  'workbench.settings.backendDetails.backEndTitle': '后端 = {engine}',
  'workbench.settings.backendDetails.servedOn': '经由 {via} 提供',
  'workbench.settings.backendDetails.apiClientsTitle': 'API 客户端 = {count}',
  'workbench.settings.backendDetails.frontEndTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '前端 = {count} 个托管界面' }),
  'workbench.settings.backendDetails.optIn': '（可选启用）',

  // ── Backend-details device-frame labels ────────────────────────────
  // The scene diagrams' device-container labels are user-facing scene
  // vocabulary and key here. Inner window corners ("Browser" / "CLI"),
  // the CI/CD YAML mock, prompt glyphs, and engine/where pill args stay
  // raw as diagram internals. Browser window titles (Chrome / Firefox /
  // Edge) are glossary proper nouns; the in-browser combined title keys
  // with the brand vocabulary raw inside the value.
  'workbench.settings.backendDetails.device.laptop': '笔记本电脑',
  'workbench.settings.backendDetails.device.desktop': '台式机',
  'workbench.settings.backendDetails.device.workstation': '工作站',
  'workbench.settings.backendDetails.device.localServer': '本地服务器',
  'workbench.settings.backendDetails.device.remoteServer': '远程服务器',
  'workbench.settings.backendDetails.device.yourDevice': '你的设备',
  'workbench.settings.backendDetails.inBrowserTitle': 'Open Headers——Chrome / Edge / Firefox',

  // ── Git pane (workspace-tree binding card, GIT_PLAN.md §9) ─────────
  'workbench.settings.gitPane.notBound.title': '未绑定文件夹',
  'workbench.settings.gitPane.notBound.body':
    '把此工作区绑定到一个文件夹，即可维持一棵包含每条规则、每个请求和每个环境的实时 YAML 树——随时可用于备份、diff、手工编辑以及（即将支持的）git。',
  'workbench.settings.gitPane.pathPlaceholder': '文件夹绝对路径',
  'workbench.settings.gitPane.chooseFolder': '选择文件夹…',
  'workbench.settings.gitPane.bindButton': '绑定文件夹',
  'workbench.settings.gitPane.bound': '文件夹已绑定。',
  'workbench.settings.gitPane.boundInitialized': '文件夹已初始化为新的工作区树。',
  'workbench.settings.gitPane.boundTitle': '已绑定的文件夹',
  'workbench.settings.gitPane.boundBody': '编辑会持续物化到此文件夹；对文件的更改会回落到应用中。',
  'workbench.settings.gitPane.unbindButton': '解绑',
  'workbench.settings.gitPane.unbindConfirm.title': '解绑此文件夹？',
  'workbench.settings.gitPane.unbindConfirm.body': '该文件夹仍是磁盘上有效的工作区树；应用只是停止读写它。',
  'workbench.settings.gitPane.unbindConfirm.ok': '解绑',
  'workbench.settings.gitPane.unbound': '文件夹已解绑。',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个文件无法读取，保持原样' }),
  'workbench.settings.gitPane.refusal.locked': '此文件夹已被另一个正在运行的引擎绑定（进程 {pid}）。',
  'workbench.settings.gitPane.refusal.uuidCollision': '此文件夹持有的工作区已通过其他来源存在于此主机上。',
  'workbench.settings.gitPane.refusal.identityMismatch': '此文件夹属于另一个工作区（{uid}）。',
  'workbench.settings.gitPane.refusal.invalidManifest': '文件夹的 workspace.yaml 无法读取：{message}',
  'workbench.settings.gitPane.refusal.alreadyBound': '此工作区已绑定到一个文件夹。',
  'workbench.settings.gitPane.refusal.unknownWorkspace': '没有可绑定的活动工作区。',
  'workbench.settings.gitPane.git.title': 'Git',
  'workbench.settings.gitPane.git.missing.title': '未安装 Git',
  'workbench.settings.gitPane.git.missing.body': '安装 git 即可为此文件夹提交历史。其他一切没有它也照常工作。',
  'workbench.settings.gitPane.git.belowFloor.body':
    '已安装的 git（{version}）对此功能来说太旧了。更新 git 以启用提交。',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 项未提交的更改' }),
  'workbench.settings.gitPane.git.clean': '工作树干净',
  'workbench.settings.gitPane.git.indexBusy': '你自己的 git 索引有已暂存的更改时，自动提交会暂停。',
  'workbench.settings.gitPane.git.messagePlaceholder': '提交信息',
  'workbench.settings.gitPane.git.commitButton': '提交',
  'workbench.settings.gitPane.git.committed': '已提交 {sha}。',
  'workbench.settings.gitPane.git.nothingToCommit': '没有可提交的内容——树与上次提交一致。',
  'workbench.settings.gitPane.git.commitFailed': '提交失败：{detail}',
  'workbench.settings.gitPane.git.cadenceLabel': '自动提交',
  'workbench.settings.gitPane.git.cadenceOff': '关闭——手动提交',
  'workbench.settings.gitPane.git.cadenceAuto': '编辑安静后',
  'workbench.settings.gitPane.git.cadenceOnBlur': '焦点离开应用时',
  'workbench.settings.gitPane.git.cadenceEvery': '每 {minutes} 分钟',
  'workbench.settings.gitPane.git.bypassHooksLabel': '绕过 git 钩子（--no-verify）',
  'workbench.settings.gitPane.git.bypassHooksWarning': '开启期间，引擎提交会跳过你的 pre-commit 和 commit-msg 钩子。',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}：已同步',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}：领先 {ahead}，落后 {behind}',
  'workbench.settings.gitPane.git.noUpstream': '未配置远程——用 git remote add 添加一个并 git push -u，即可启用拉取。',
  'workbench.settings.gitPane.git.pullButton': '拉取',
  'workbench.settings.gitPane.git.pulled': '已合并 {sha}。',
  'workbench.settings.gitPane.git.upToDate': '已是最新。',
  'workbench.settings.gitPane.git.pullFailed': '拉取失败：{detail}',
  'workbench.settings.gitPane.git.pushButton': '推送',
  'workbench.settings.gitPane.git.pushed': '已推送 {sha}。',
  'workbench.settings.gitPane.git.nothingToPush': '没有可推送的内容——已经同步。',
  'workbench.settings.gitPane.git.pushFailed': '推送失败：{detail}',
  'workbench.settings.gitPane.git.pushRejected': '远程有新提交——先拉取，再推送。',
  'workbench.settings.gitPane.git.pushNoPermission.title': '没有推送权限',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    '此远程对你是只读的。你的提交留在本地；你可以把它们发布为一个新分支，并在你的 git 主机上发起合并请求。',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': '推送为新分支',
  'workbench.settings.gitPane.git.exportedBranch': '已推送分支 {branch}。',
  'workbench.settings.gitPane.git.autoPushLabel': '每次提交后推送',
  'workbench.settings.gitPane.git.branch.title': '分支',
  'workbench.settings.gitPane.git.branch.current': '当前分支 {branch}',
  'workbench.settings.gitPane.git.branch.detached': '游离的 HEAD——创建一个分支以保留这段历史。',
  'workbench.settings.gitPane.git.branch.switchLabel': '切换到',
  'workbench.settings.gitPane.git.branch.switched': '已切换到 {branch}。',
  'workbench.settings.gitPane.git.branch.switchFailed': '切换失败：{detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': '你有未提交的更改',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        other: '切换到 {branch} 之前，请先提交、贮藏或丢弃 {count} 项未提交的更改。',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': '提交并切换',
  'workbench.settings.gitPane.git.branch.dirtyStash': '贮藏并切换',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': '丢弃更改',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': '丢弃未提交的更改？',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    '每项未提交的更改都会被删除，包括新文件。此操作无法撤销。',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': '丢弃',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': '创建并切换',
  'workbench.settings.gitPane.git.branch.created': '已创建分支 {branch}。',
  'workbench.settings.gitPane.git.branch.createFailed': '无法创建分支：{detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': '合并进当前分支',
  'workbench.settings.gitPane.git.branch.mergeButton': '合并',
  'workbench.settings.gitPane.git.branch.merged': '已合并 {sha}。',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': '已是最新。',
  'workbench.settings.gitPane.git.branch.mergeFailed': '合并失败：{detail}',
  'workbench.settings.gitPane.git.forcePush.title': '远程历史被改写',
  'workbench.settings.gitPane.git.forcePush.body':
    '远程分支不再包含你上次同步的历史（{sha}）。请选择如何继续——在你决定之前什么都不会改变。',
  'workbench.settings.gitPane.git.forcePush.abandon': '放弃本地更改',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': '放弃本地更改？',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    '自上次同步以来的本地提交会被丢弃，改写后的远程历史成为工作区状态。',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': '放弃',
  'workbench.settings.gitPane.git.forcePush.rescue': '保留到救援分支',
  'workbench.settings.gitPane.git.forcePush.reapply': '在其上重新应用',
  'workbench.settings.gitPane.git.forcePush.resolved': '已接受改写后的历史（{sha}）。',
  'workbench.settings.gitPane.git.forcePush.rescued': '本地历史已保留在 {branch}。',
  'workbench.settings.gitPane.git.forcePush.failed': '无法解决：{detail}',
  'workbench.settings.gitPane.git.history.title': '历史',
  'workbench.settings.gitPane.git.history.show': '显示历史',
  'workbench.settings.gitPane.git.history.hide': '隐藏',
  'workbench.settings.gitPane.git.history.empty': '还没有提交。',
  'workbench.settings.gitPane.git.history.loadFailed': '无法读取历史：{detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': '共同作者：{authors}',
  'workbench.settings.gitPane.git.history.fileTitle': '历史——{path}',
  'workbench.settings.gitPane.git.history.fileEmpty': '还没有提交涉及此文件。',
} as const satisfies Catalog;
