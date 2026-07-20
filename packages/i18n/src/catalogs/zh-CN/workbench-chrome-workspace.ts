/**
 * Workbench chrome — the workspace plane — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); Org stays the raw product noun
 * (shared-workspace precedent); 后端 = back-end (register); `OAuth`,
 * `Logo`, format names (PNG, JPEG, WebP, SVG) and the `KB` unit ride
 * raw as en writes them; Vault raw per the ledger (Vault 内容). Runtime-
 * quoted names use “” (S57). File mints: 副本 = duplicate / copy-of
 * (创建副本 verb form — 复制 stays the copy action); 切换器 = switcher;
 * 授予 = grant; 活动工作区 carries the 活动 active mint; organization
 * prose = 组织 (Org the product noun stays raw).
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': '工作区',
  'workbench.workspace.newWorkspace': '新建工作区',
  'workbench.workspace.intro': '每个工作区拥有自己的规则、集合、文件夹、模板、变量和测试运行历史。拖动即可重新排序。',
  'workbench.workspace.deleteTitle': '删除“{name}”？',
  'workbench.workspace.deleteBody':
    '将永久删除该工作区及其所有规则、集合、文件夹、模板、变量和测试运行历史。此操作无法撤销。',
  'workbench.workspace.deleteOk': '删除',
  'workbench.workspace.deleteFailed': '删除工作区失败',
  'workbench.workspace.deletedToast': '已删除“{name}”',
  'workbench.workspace.createOk': '创建',
  'workbench.workspace.createFailed': '创建工作区失败',
  'workbench.workspace.createdToastPrefix': '已创建工作区',
  'workbench.workspace.duplicateTitle': '创建“{name}”的副本',
  'workbench.workspace.duplicateTitleFallback': '创建工作区副本',
  'workbench.workspace.duplicateOk': '创建副本',
  'workbench.workspace.duplicateFailed': '创建工作区副本失败',
  'workbench.workspace.duplicatedToast': '已创建副本：“{source}” → “{name}”',
  'workbench.workspace.publishFailed': '发布工作区失败',
  'workbench.workspace.publishedToast': '已将“{name}”发布到 {org}',
  'workbench.workspace.selectedOrgFallback': '所选 Org',
  'workbench.workspace.editTitle': '编辑工作区',
  'workbench.workspace.saveOk': '保存',
  'workbench.workspace.updatedToast': '已更新“{name}”',
  'workbench.workspace.deletedElsewhere': '此工作区已在另一个标签页中被删除',
  'workbench.workspace.updateFailed': '更新工作区失败',
  'workbench.workspace.updateFailedWithMessage': '更新工作区失败：{message}',
  'workbench.workspace.newWorkspacesGoTo': '新工作区归入',
  'workbench.workspace.orgPrefHint': '随时可以更改——现有工作区保持原位。',
  'workbench.workspace.otherWorkspaces': '其他工作区',
  'workbench.workspace.dragToReorder': '拖动以重新排序',
  'workbench.workspace.activePill': '活动',
  'workbench.workspace.switch': '切换',
  'workbench.workspace.renameAria': '重命名工作区',
  'workbench.workspace.duplicateAria': '创建工作区副本',
  'workbench.workspace.publishAria': '将工作区发布到后端',
  'workbench.workspace.deleteAria': '删除工作区',
  'workbench.workspace.prefixLabel': '前缀',
  'workbench.workspace.nameLabel': '名称',
  'workbench.workspace.nameRequired': '必须填写名称',
  'workbench.workspace.nameTooLong': '名称请保持在 60 个字符以内',
  'workbench.workspace.namePlaceholder': '我的工作区',
  'workbench.workspace.descriptionLabel': '描述（可选）',
  'workbench.workspace.copyOfName': '{name} 的副本',
  'workbench.workspace.copyOfPlaceholder': '… 的副本',
  'workbench.workspace.intoOrg': '归入 Org',
  'workbench.workspace.includeSecrets': '包含 vault 内容（机密）',
  'workbench.workspace.includeSecretsHint': '如有需要，在副本中重新输入机密。无论如何，OAuth 连接都需要重新授权。',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': '将“{name}”设为活动工作区？',
  'workbench.workspace.makeActiveBody': '弹窗、侧边栏以及任何未固定到特定工作区的新 {units} 都将切换到“{name}”。',
  'workbench.workspace.makeActiveOk': '设为活动',
  'workbench.workspace.cancel': '取消',
  'workbench.workspace.nowActiveToast': '“{name}”现在是活动工作区',
  'workbench.workspace.switcherAria': '此 {unit} 正在编辑工作区：{name}。点击可切换。',

  // ── Workspace: publish modal ────────────────────────────────────────
  'workbench.workspace.publishTitle': '发布“{name}”',
  'workbench.workspace.publishTitleFallback': '发布工作区',
  'workbench.workspace.publishToOk': '发布到 {org}',
  'workbench.workspace.publishOk': '发布',
  'workbench.workspace.publishIntro': '发布会将此工作区复制到所选 Org，并通过该后端同步。原工作区保留在这里。',
  'workbench.workspace.toOrg': '目标 Org',
  'workbench.workspace.pickTargetOrg': '选择目标 Org',
  'workbench.workspace.includeSecretsPublishHint':
    '如有需要，在发布的副本中重新输入机密。无论如何，OAuth 连接都需要重新授权。',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': '更改此组织的 Logo',
  'workbench.workspace.org.renameButton': '重命名',
  'workbench.workspace.org.renameAria': '重命名此组织',
  'workbench.workspace.org.renameTitle': '重命名 {hint}',
  'workbench.workspace.org.renameTitleFallback': '重命名',
  'workbench.workspace.org.nameUpdated': '名称已更新',
  'workbench.workspace.org.identityLoading': '身份信息仍在加载——请稍后再试',
  'workbench.workspace.org.renameExtra': '显示在工作区切换器中，也会显示给与你共享工作区的所有人。',
  'workbench.workspace.org.nameTooLong': '名称请保持在 {max} 个字符以内',
  'workbench.workspace.org.namePlaceholder': '我的工作电脑',
  'workbench.workspace.org.logoTitle': '{hint} 的 Logo',
  'workbench.workspace.org.logoTitleFallback': '组织 Logo',
  'workbench.workspace.org.logoAlt': '当前组织 Logo',
  'workbench.workspace.org.replace': '替换…',
  'workbench.workspace.org.upload': '上传…',
  'workbench.workspace.org.remove': '移除',
  'workbench.workspace.org.logoUpdated': 'Logo 已更新',
  'workbench.workspace.org.logoRemoved': 'Logo 已移除',
  'workbench.workspace.org.fileReadFailed': '无法读取该文件。',
  'workbench.workspace.org.logoHint':
    'PNG、JPEG、WebP 或 SVG，最大 {kb} KB。方形图片效果最佳。会显示给与此组织同步的所有人。',
  'workbench.workspace.org.logoReject.notImage': '无法将该文件作为图片读取。',
  'workbench.workspace.org.logoReject.corruptImage': '该文件不是其声明类型的有效图片。',
  'workbench.workspace.org.logoReject.unsupportedFormat': '请使用 PNG、JPEG、WebP 或 SVG 文件。',
  'workbench.workspace.org.logoReject.tooLarge': 'Logo 请保持在 {kb} KB 以内。',
  'workbench.workspace.org.logoReject.unsafeSvg': '此 SVG 包含脚本或外部引用——请导出纯净、自包含的 SVG。',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': '你现在可以访问一个工作区',
  'workbench.workspace.grant.arrivedTitle': '有一个工作区现已可用',
  'workbench.workspace.grant.open': '打开工作区',
  'workbench.workspace.grant.notifTitleActive': '你现在可以访问“{name}”',
  'workbench.workspace.grant.notifTitle': '工作区“{name}”现已可用',
  'workbench.workspace.grant.notifBodyActive': '管理员已授予你访问权限——你现在正在其中工作。',
  'workbench.workspace.grant.notifBody': '管理员已授予你访问权限——它会出现在工作区切换器中。',
  'workbench.workspace.grant.orgFallback': '你的组织',
  'workbench.workspace.grant.zeroBanner':
    '已连接到 {orgs}——尚未向你授予任何工作区。你正在本地工作区中工作；管理员授予访问权限后，被授予的工作区会自动出现在这里。',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': '颜色 {name}',
  'workbench.workspace.picker.searchIcons': '搜索图标...',
  'workbench.workspace.picker.noIconTooltip': '无图标——仅显示色块',
  'workbench.workspace.picker.noIconAria': '无图标',
  'workbench.workspace.picker.triggerAria': '选择工作区前缀（颜色或图标）',
} as const satisfies Catalog;
