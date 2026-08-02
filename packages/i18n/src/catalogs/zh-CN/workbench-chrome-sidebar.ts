/**
 * Workbench chrome — the navigator plane — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Entity names,
 * collection names, and counts ride raw inside keyed values; `vars` /
 * `VAULT` / `Vault` / `delete-wins` / the Live prefix ride raw. zh has
 * no capitalization — section headers render the plain nouns. Reuses
 * mints: 暂存 = Scratch, 草稿 = Draft, 拦截 = Block, 覆盖 = override,
 * 集合 / 工作流 / 环境 / 规范 carried; rule-type names align with the
 * shared rule-type registry (标头/拦截/重定向/查询参数/注入/延迟).
 * File mints: 包库 = Package Library; 取代 = supersede (superseded
 * local edit); 覆盖范围 = rule-match coverage (scope-widened — third
 * referent beside 作用域 and 范围, S19 law); 暂停覆盖 = pause
 * override; 恢复 = resume/unpause; 撤销此更改 = revert (活动流 =
 * activity feed carried from shared mints).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': '规则',
  'workbench.sidebar.section.templates': '模板',
  'workbench.sidebar.section.requests': '请求',
  'workbench.sidebar.section.workflows': '工作流',
  'workbench.sidebar.section.environments': '环境',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': '工作区变量',
  'workbench.sidebar.section.liveVariables': 'LIVE 变量',
  'workbench.sidebar.section.packageLibrary': '包库',
  'workbench.sidebar.section.specs': '规范',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'HTTP 规则',
  'workbench.sidebar.view.apiRequests': 'API 请求',
  'workbench.sidebar.view.workflows': '工作流',
  'workbench.sidebar.view.variables': '变量',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': '新建规则',
  'workbench.sidebar.header.addRequest': '添加请求',
  'workbench.sidebar.header.createNewEnvironment': '新建环境',
  'workbench.sidebar.header.createNewSpec': '新建规范',
  'workbench.sidebar.header.newWorkflow': '新建工作流',
  'workbench.sidebar.header.newTemplateCollection': '新建模板集合',
  'workbench.sidebar.header.exportSelected': '导出所选的 {count} 项…',
  'workbench.sidebar.header.exportSelectedAria': '导出所选的 {count} 项',
  'workbench.sidebar.header.clearSelection': '清除选择',
  'workbench.sidebar.header.clearSelectionAria': '清除导出选择',
  'workbench.sidebar.header.selectOpenedTab': '选中已打开的标签页',
  'workbench.sidebar.header.selectOpenedTabAria': '选中已打开的标签页',
  'workbench.sidebar.header.expandAll': '全部展开',
  'workbench.sidebar.header.expandAllAria': '全部展开',
  'workbench.sidebar.header.collapseAll': '全部折叠',
  'workbench.sidebar.header.collapseAllAria': '全部折叠',
  'workbench.sidebar.behavior.title': '行为',
  'workbench.sidebar.behavior.openEntriesSingleClick': '单击打开条目',
  'workbench.sidebar.behavior.openCollectionsSingleClick': '单击打开集合',
  'workbench.sidebar.behavior.openFoldersSingleClick': '单击打开文件夹',
  'workbench.sidebar.behavior.alwaysSelectOpened': '始终选中已打开的标签页',
  'workbench.sidebar.filterPlaceholder': '筛选',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': '新建集合',
  'workbench.sidebar.menu.newRequest': '新建请求',
  'workbench.sidebar.menu.import': '导入…',
  'workbench.sidebar.menu.addRule': '添加规则',
  'workbench.sidebar.menu.addRequest': '添加请求',
  'workbench.sidebar.menu.addGrpcRequest': '添加 gRPC 请求',
  'workbench.sidebar.menu.addWebSocketRequest': '添加 WebSocket 请求',
  'workbench.sidebar.menu.addSocketIoRequest': '添加 Socket.IO 请求',
  'workbench.sidebar.menu.addFolder': '添加文件夹',
  'workbench.sidebar.menu.rename': '重命名',
  'workbench.sidebar.menu.editVariables': '编辑变量',
  'workbench.sidebar.menu.createWorkflow': '创建工作流…',
  'workbench.sidebar.menu.export': '导出…',
  'workbench.sidebar.menu.delete': '删除',
  'workbench.sidebar.menu.duplicate': '创建副本',
  'workbench.sidebar.menu.copyAs': '复制为',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.pauseCollection': '暂停集合',
  'workbench.sidebar.menu.unpauseCollection': '恢复集合',
  'workbench.sidebar.menu.pauseFolder': '暂停文件夹',
  'workbench.sidebar.menu.unpauseFolder': '恢复文件夹',
  'workbench.sidebar.menu.resetCollectionPauseOverride': '重置集合的暂停覆盖',
  'workbench.sidebar.menu.resetFolderPauseOverride': '重置文件夹的暂停覆盖',
  'workbench.sidebar.menu.clearNestedPauseOverrides': '清除嵌套的暂停覆盖',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': '已暂停',
  'workbench.sidebar.badge.draft': '草稿',
  'workbench.sidebar.badge.unresolved': '未解析',
  'workbench.sidebar.badge.off': '关',
  'workbench.sidebar.badge.incomplete': '不完整',
  'workbench.sidebar.badge.scratch': '暂存',
  'workbench.sidebar.badge.scripts': '脚本',
  'workbench.sidebar.badge.specDrift': '已更改',
  'workbench.sidebar.badge.scriptsTooltip': '此导入的请求在运行时会执行 JavaScript。打开它以审查这些脚本。',
  'workbench.sidebar.badge.dirtyAria': '未保存的更改',
  'workbench.sidebar.rule.enable': '启用规则',
  'workbench.sidebar.rule.disable': '禁用规则',
  'workbench.sidebar.env.setActive': '设为活动',
  'workbench.sidebar.env.setInactive': '设为非活动',
  'workbench.sidebar.env.setDefault': '设为默认',
  'workbench.sidebar.env.unsetDefault': '取消默认',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} vars' }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个 Live 变量绑定到此工作流' }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': '文件夹为空',
  'workbench.sidebar.placeholder.collectionEmptyTitle': '集合为空',
  'workbench.sidebar.placeholder.requestsEmptyTitle': '还没有请求',
  'workbench.sidebar.placeholder.templatesEmptyTitle': '还没有模板',
  'workbench.sidebar.placeholder.addRuleOrFolder': '添加规则或文件夹即可开始。',
  'workbench.sidebar.placeholder.addRequestOrFolder': '添加请求或文件夹即可开始。',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': '将规则保存为模板即可填充。',
  'workbench.sidebar.placeholder.templatesEmptyMessage': '在编辑器中将规则保存为模板。',
  'workbench.sidebar.placeholder.addRule': '添加规则',
  'workbench.sidebar.placeholder.addFolder': '添加文件夹',
  'workbench.sidebar.placeholder.addRequest': '添加请求',
  'workbench.sidebar.emptySection': '此分区中没有条目',
  'workbench.sidebar.emptySectionCreate': '创建',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': '系统模板',
  'workbench.sidebar.ruleType.header': '标头',
  'workbench.sidebar.ruleType.block': '拦截',
  'workbench.sidebar.ruleType.redirect': '重定向',
  'workbench.sidebar.ruleType.queryParam': '查询参数',
  'workbench.sidebar.ruleType.inject': '注入',
  'workbench.sidebar.ruleType.delay': '延迟',
  'workbench.sidebar.ruleType.requestBody': 'API 请求体',
  'workbench.sidebar.ruleType.response': 'API 响应',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': '工作区变量',
  'workbench.sidebar.singleton.liveVariables': 'Live 变量',
  'workbench.sidebar.singleton.packageLibrary': '包库',

  // ── Sidebar: default entity names ───────────────────────────────────
  'workbench.sidebar.defaults.newFolder': '新建文件夹',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': '删除该项？',
  'workbench.sidebar.confirmDelete.bodyPrefix': '确定要删除 ',
  'workbench.sidebar.confirmDelete.bodySuffix': ' 吗？此操作无法撤销。',
  'workbench.sidebar.confirmDelete.ok': '删除',
  'workbench.sidebar.toast.toggleRuleFailed': '启停规则失败',
  'workbench.sidebar.toast.renameExampleFailed': '重命名示例失败',
  'workbench.sidebar.toast.duplicateExampleFailed': '创建示例副本失败',
  'workbench.sidebar.toast.deleteExampleFailed': '删除示例失败',
  'workbench.sidebar.toast.createRequestCollectionFailed': '创建请求集合失败',
  'workbench.sidebar.toast.createEnvironmentFailed': '创建环境失败',
  'workbench.sidebar.toast.createSpecFailed': '创建规范失败',
  'workbench.sidebar.toast.renameSpecFailed': '重命名规范失败',
  'workbench.sidebar.toast.deleteSpecFailed': '删除规范失败',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': '拖动以重新排序文件夹',

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': '更改已撤销',
  'workbench.activityFeed.revertFailed': '撤销失败：{reason}',
  'workbench.activityFeed.emptyTitle': '还没有活动',
  'workbench.activityFeed.emptyHint': '来自其他节点的传入更改会显示在这里。',
  'workbench.activityFeed.view': '查看',
  'workbench.activityFeed.mute': '静音',
  'workbench.activityFeed.unmute': '取消静音',
  'workbench.activityFeed.muteTip': '不再为此实体显示后续传入活动行。已有的行会保留。',
  'workbench.activityFeed.unmuteTip': '恢复显示此实体的传入活动。',
  'workbench.activityFeed.revert': '撤销',
  'workbench.activityFeed.revertTip': '应用此更改的逆操作。会发出一个新的变更，将实体恢复到传入之前的状态。',
  'workbench.activityFeed.revertUnavailableDelete': '删除是永久性的，无法撤销（§7.2 delete-wins）。',
  'workbench.activityFeed.revertUnavailable': '此更改无法撤销。',
  'workbench.activityFeed.kind.created': '已创建',
  'workbench.activityFeed.kind.createdTip': '新实体从其他节点到达。',
  'workbench.activityFeed.kind.edited': '已编辑',
  'workbench.activityFeed.kind.editedTip': '其他节点编辑了此实体的字段。',
  'workbench.activityFeed.kind.deleted': '已删除',
  'workbench.activityFeed.kind.deletedTip': '其他节点删除了此实体。',
  'workbench.activityFeed.kind.superseded': '取代了本地编辑',
  'workbench.activityFeed.kind.supersededTip': '一个传入的变更取代了你正在进行的本地编辑。',
  'workbench.activityFeed.kind.sensitiveRotation': '敏感字段已轮换',
  'workbench.activityFeed.kind.sensitiveRotationTip': '一个敏感字段（机密 / token / 敏感标头）被替换。',
  'workbench.activityFeed.kind.scopeWidened': '覆盖范围已扩大',
  'workbench.activityFeed.kind.scopeWidenedTip': '一个规则条件被放宽——该规则现在匹配更广的 URL/方法集合。',
  'workbench.activityFeed.kind.agentObserved': '智能体读取',
  'workbench.activityFeed.kind.agentObservedTip':
    '一个智能体通过 MCP observe 层级读取了实时流量——来自已授权来源的脱敏投影。',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 条规则' }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个请求' }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个模板' }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· {count} 个文件夹' }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· {count} 个子文件夹' }),
  'workbench.overview.stats.activeTag': '{count} 个活动',
  'workbench.overview.stats.disabledTag': '{count} 个已禁用',
  'workbench.overview.stats.draftTag': '{count} 个草稿',
  'workbench.overview.stats.pausedTag': '已暂停',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), { other: '文件夹 · {count} 条规则' }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '文件夹 · {count} 个请求' }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), { other: '文件夹 · {count} 个模板' }),
  'workbench.overview.status.draft': '草稿',
  'workbench.overview.status.incomplete': '不完整',
  'workbench.overview.status.disabled': '已禁用',
  'workbench.overview.status.paused': '已暂停',
  'workbench.overview.status.active': '活动',
  'workbench.overview.action.addRule': '添加规则',
  'workbench.overview.action.addRequest': '添加请求',
  'workbench.overview.action.pause': '暂停',
  'workbench.overview.action.resume': '恢复',
  'workbench.overview.action.pauseCollectionTooltip': '暂停此集合中的所有规则',
  'workbench.overview.action.resumeCollectionTooltip': '恢复此集合中的所有规则',
  'workbench.overview.action.pauseFolderTooltip': '暂停此文件夹中的所有规则',
  'workbench.overview.action.resumeFolderTooltip': '恢复此文件夹中的所有规则',
  'workbench.overview.action.variables': '变量',
  'workbench.overview.action.variablesTooltip': '编辑作用域为此集合的变量',
  'workbench.overview.action.variablesTooltipRequest': '编辑作用域为此请求集合的变量',
  'workbench.overview.action.variablesTooltipTemplate': '编辑作用域为此模板集合的变量',
  'workbench.overview.action.scripts': '脚本',
  'workbench.overview.action.scriptsTooltipCollection': '编辑为此集合中每个请求运行的脚本',
  'workbench.overview.action.scriptsTooltipFolder': '编辑为此文件夹中每个请求运行的脚本',
  'workbench.overview.action.auth': '授权',
  'workbench.overview.action.authTooltipCollection': '设置此集合中每个请求继承的默认授权',
  'workbench.overview.action.authTooltipFolder': '设置此文件夹中每个请求继承的默认授权',
  'workbench.overview.caption.description': '描述',
  'workbench.overview.caption.contents': '内容',
  'workbench.overview.empty.collectionNotFound': '未找到集合',
  'workbench.overview.empty.folderNotFound': '未找到文件夹',
  'workbench.overview.empty.requestCollectionNotFound': '未找到请求集合',
  'workbench.overview.empty.templateCollectionNotFound': '未找到模板集合',
  'workbench.overview.empty.noItems': '还没有条目',
  'workbench.overview.empty.noRequests': '还没有请求',
  'workbench.overview.empty.templatesCollection': '此集合中没有模板。将规则保存为模板即可填充此集合。',
  'workbench.overview.empty.templatesFolder': '还没有模板——在规则编辑器中将规则保存为模板即可填充此文件夹。',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': '搜索集合',
  'workbench.collectionPicker.empty': '还没有集合——导入时会为你创建一个。',
  'workbench.collectionPicker.noMatch': '没有匹配的集合。',
  'workbench.collectionPicker.newCollection': '新建集合',
} as const satisfies Catalog;
