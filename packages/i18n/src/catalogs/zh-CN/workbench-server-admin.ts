/**
 * Daemon-admin family — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.com/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and the ` · ` separator glyphs. 守护进程
 * = daemon; 席位 / 个人席位 + 个人席位密钥（oh-license.…） reused
 * verbatim from `zh-CN/web.ts`; 邮箱 = email; 授予 = grant (shipped
 * mints). MINTS: 池 = the seat pool; 单人档 / 团队档 = solo / team
 * tier (档 = tier); 准入 = admission; 目录用户 = directory user;
 * 吸收 = absorb (seat into pool).
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': '服务器管理',
  'workbench.serverAdmin.intro':
    '目录用户用绑定的 token 或 SSO 登录，只能看到这里授予的工作区。停用会吊销该用户的 token 并立即断开其连接。',
  'workbench.serverAdmin.deniedDescription': '管理此服务器需要 daemon.admin 能力。',
  'workbench.serverAdmin.cancel': '取消',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': '版本说明',
  'workbench.serverAdmin.notes.sectionHint': '此控制台所管理服务器构建版本的更新内容。',
  'workbench.serverAdmin.notes.versionLine': '服务器 {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': '用户',
  'workbench.serverAdmin.users.sectionHint': '先准入用户，再在下方按工作区授予角色。邮箱把 SSO 登录关联到该记录。',
  'workbench.serverAdmin.users.nameRequired': '名称是必填项',
  'workbench.serverAdmin.users.displayNamePlaceholder': '显示名称',
  'workbench.serverAdmin.users.emailPlaceholder': '邮箱（可选——SSO 必填）',
  'workbench.serverAdmin.users.seatKeyPlaceholder': '个人席位密钥（oh-license.…）',
  'workbench.serverAdmin.users.addUser': '添加用户',
  'workbench.serverAdmin.users.seatLimit':
    '此服务器已达席位上限。为你的团队许可证增加席位，或在上方粘贴加入用户自己的个人席位密钥——这样准入不占用池中席位。',
  'workbench.serverAdmin.users.seatsSoldAt': '个人席位的购买地址：',
  'workbench.serverAdmin.users.emptyDirectory': '还没有目录用户——服务器运行在单人档。添加一个用户即可开启团队档。',
  'workbench.serverAdmin.users.deactivatedOn': '已于 {date} 停用',
  'workbench.serverAdmin.users.addedOn': '添加于 {date}',
  'workbench.serverAdmin.users.loadFailed': '加载用户目录失败：{message}',
  'workbench.serverAdmin.users.addFailed': '添加用户失败：{message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': '个人席位',
  'workbench.serverAdmin.seat.healthyTooltip': '由其本人的个人席位（{id}）准入——不计入此服务器的池。',
  'workbench.serverAdmin.seat.lapsedTooltip':
    '其个人席位（{id}）为 {status}。他们保持登录状态——失效绝不驱逐——但该席位不再续期。',
  'workbench.serverAdmin.seat.absorbTitle': '把此席位吸收进池？',
  'workbench.serverAdmin.seat.absorbDescription':
    '该用户变为普通的池中席位，其个人许可证在此不再续期。此操作无法撤销。',
  'workbench.serverAdmin.seat.absorbOk': '吸收',
  'workbench.serverAdmin.seat.absorbCta': '吸收进池',
  'workbench.serverAdmin.seat.absorbed': '席位已吸收进池。',
  'workbench.serverAdmin.seat.absorbFailed': '吸收席位失败：{message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': '停用此用户？',
  'workbench.serverAdmin.deactivate.description':
    '其 token 会被吊销，实时连接会被关闭。之后重新添加同一邮箱即可再次准入。',
  'workbench.serverAdmin.deactivate.cta': '停用',
  'workbench.serverAdmin.deactivate.done': '用户已停用。其 token 已被吊销，实时连接已关闭。',
  'workbench.serverAdmin.deactivate.failed': '停用失败：{message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': '查看者',
  'workbench.serverAdmin.grants.roleEditor': '编辑者',
  'workbench.serverAdmin.grants.roleOwner': '所有者',
  'workbench.serverAdmin.grants.none': '尚无工作区访问权限。',
  'workbench.serverAdmin.grants.idpTooltip': '由身份提供方映射授予。撤销只维持到其下一次 SSO 登录重新应用为止。',
  'workbench.serverAdmin.grants.workspacePlaceholder': '工作区',
  'workbench.serverAdmin.grants.grantCta': '授予',
  'workbench.serverAdmin.grants.everyWorkspace': '已在每个工作区上授予。',
  'workbench.serverAdmin.grants.grantFailed': '授予失败：{message}',
  'workbench.serverAdmin.grants.revokeFailed': '撤销授予失败：{message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': '设置密码——{name}',
  'workbench.serverAdmin.password.resetTitle': '重置密码——{name}',
  'workbench.serverAdmin.password.explainer':
    '该用户在服务器的 Web 入口用邮箱和此密码登录。请直接把它交给对方——密码在服务器上以哈希存储，无法读回。',
  'workbench.serverAdmin.password.placeholder': '新密码（至少 8 个字符）',
  'workbench.serverAdmin.password.setCta': '设置密码',
  'workbench.serverAdmin.password.resetCta': '重置密码',
  'workbench.serverAdmin.password.removeCta': '移除密码',
  'workbench.serverAdmin.password.setDone': '密码已设置。',
  'workbench.serverAdmin.password.removedDone': '密码已移除。',
  'workbench.serverAdmin.password.updateFailed': '更新密码失败：{message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': '设置 Git 邮箱——{name}',
  'workbench.serverAdmin.gitEmail.changeTitle': '更改 Git 邮箱——{name}',
  'workbench.serverAdmin.gitEmail.explainer':
    '携带该用户工作的提交会以此地址署名，从而关联到其 Git 托管平台的个人资料。未设置时使用目录邮箱，' +
    '再退回 noreply 地址。',
  'workbench.serverAdmin.gitEmail.placeholder': '提交作者邮箱',
  'workbench.serverAdmin.gitEmail.setCta': '设置 Git 邮箱',
  'workbench.serverAdmin.gitEmail.changeCta': '更改 Git 邮箱',
  'workbench.serverAdmin.gitEmail.removeCta': '移除覆盖',
  'workbench.serverAdmin.gitEmail.setDone': 'Git 邮箱已设置。',
  'workbench.serverAdmin.gitEmail.removedDone': 'Git 邮箱覆盖已移除。',
  'workbench.serverAdmin.gitEmail.updateFailed': '更新 Git 邮箱失败：{message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    '把服务器的工作区绑定到一个仓库，并远程驱动提交、拉取、推送和分支。路径位于服务器自己的文件系统上。',
  'workbench.serverAdmin.git.workspaceLabel': '工作区',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': '报告',
  'workbench.serverAdmin.audit.sectionHint':
    '此服务器做出的每个权限决定和每次设备准入，构成可筛选的审计记录。导出遵循当前生效的筛选条件。',
  'workbench.serverAdmin.audit.capAdmission': '准入（连接）',
  'workbench.serverAdmin.audit.capAdminPlane': '管理平面',
  'workbench.serverAdmin.audit.capSsoGrant': 'SSO 授予（映射）',
  'workbench.serverAdmin.audit.capSsoRevoke': 'SSO 撤销（映射）',
  'workbench.serverAdmin.audit.capWorkspaceRead': '工作区读取',
  'workbench.serverAdmin.audit.capWorkspaceWrite': '工作区写入',
  'workbench.serverAdmin.audit.capWorkspaceList': '工作区列表',
  'workbench.serverAdmin.audit.rangeLastHour': '最近 1 小时',
  'workbench.serverAdmin.audit.rangeLast24Hours': '最近 24 小时',
  'workbench.serverAdmin.audit.rangeLast7Days': '最近 7 天',
  'workbench.serverAdmin.audit.rangeLast30Days': '最近 30 天',
  'workbench.serverAdmin.audit.colTime': '时间',
  'workbench.serverAdmin.audit.colEvent': '事件',
  'workbench.serverAdmin.audit.colCapability': '能力',
  'workbench.serverAdmin.audit.colWorkspace': '工作区',
  'workbench.serverAdmin.audit.colActor': '操作者',
  'workbench.serverAdmin.audit.eventAdmission': '准入',
  'workbench.serverAdmin.audit.eventAdmissionRefused': '准入被拒',
  'workbench.serverAdmin.audit.eventSsoGrant': 'SSO 授予',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'SSO 撤销',
  'workbench.serverAdmin.audit.eventAllow': '允许',
  'workbench.serverAdmin.audit.eventDeny': '拒绝',
  'workbench.serverAdmin.audit.filterActor': '操作者',
  'workbench.serverAdmin.audit.filterCapability': '能力',
  'workbench.serverAdmin.audit.filterDecision': '决定',
  'workbench.serverAdmin.audit.filterWorkspace': '工作区',
  'workbench.serverAdmin.audit.filterAnyTime': '任意时间',
  'workbench.serverAdmin.audit.decisionAllow': '允许',
  'workbench.serverAdmin.audit.decisionDeny': '拒绝',
  'workbench.serverAdmin.audit.refresh': '刷新',
  'workbench.serverAdmin.audit.exportJsonl': '导出 JSONL',
  'workbench.serverAdmin.audit.emptyText': '没有匹配的审计行。',
  'workbench.serverAdmin.audit.loadMore': '加载更多',
} as const satisfies Catalog;
