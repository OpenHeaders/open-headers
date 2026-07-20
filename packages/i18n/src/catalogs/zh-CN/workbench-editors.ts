/**
 * Workbench editors — shared editor chrome — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-editors.ts` key for key. Raw by
 * design: snippet code bodies and `oh.*` API names (never keyed), the
 * {column} / {header} / {key} / {name} / {language} / {message} holes,
 * `Workflows` / `Tests` group labels raw per the de/es parity lock,
 * lowercase en `vault` raw lowercase (per-case token law), JSON / URL
 * / HTTP raw. 脚本 = script; 代码片段 = snippet (panel-inspector
 * precedent); 包 / 包库 per script-packages; package-flow strings
 * shared with `workbench-script-packages.ts` (duplicate name,
 * not-found, save failed, empty states) reuse its zh sentences
 * verbatim. 授权 = Authorization; 机密 = secret (shipped mints).
 * MINTS: 继承 = the Inherit option label —
 * `workbench-editors-request.ts` MUST reuse it; 批量 = Bulk; 键值 =
 * Key-Value; 美化 = Beautify; 格式化 = Format (panel mint); 请求草稿
 * = request draft (草稿 carried from the Draft mint); 正文 = the bare
 * `Body` tab noun (prose keeps 请求体 / 响应体 per the shipped mints
 * — future editors-request zh-CN must reuse 正文 for bare tabs).
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': '更多信息',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': '键',
  'workbench.editors.grid.value': '值',
  'workbench.editors.grid.description': '描述',
  'workbench.editors.grid.showColumns': '显示列',
  'workbench.editors.grid.tableOptions': '表格选项',
  'workbench.editors.grid.bulk': '批量',
  'workbench.editors.grid.keyValue': '键值',
  'workbench.editors.grid.selectAllAria': '启用或禁用所有行',
  'workbench.editors.grid.selectAllTitle': '启用 / 禁用全部',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': '调整 {column} 列的宽度',
  'workbench.editors.grid.overriddenBy': '重复——已被你添加的 {header} 行覆盖。',
  'workbench.editors.grid.suggestionValueAria': '{key} 的值',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.titleCollection': '脚本——{name}',
  'workbench.editors.ancestorScripts.titleFolder': '脚本——{name}',
  'workbench.editors.ancestorScripts.descriptionCollection':
    '这些脚本对此集合中的每个请求运行——请求前脚本在每次发送之前，响应后脚本在每次响应之后。它们最先运行：先是集合脚本，然后是文件夹脚本，最后是请求自己的脚本。',
  'workbench.editors.ancestorScripts.descriptionFolder':
    '这些脚本对此文件夹中的每个请求运行——请求前脚本在每次发送之前，响应后脚本在每次响应之后。它们在集合的脚本之后、请求自己的脚本之前运行。',
  'workbench.editors.ancestorScripts.notFoundCollection': '未找到请求集合。',
  'workbench.editors.ancestorScripts.notFoundFolder': '未找到文件夹。',
  'workbench.editors.ancestorScripts.saveFailed': '无法保存脚本。',
  'workbench.editors.ancestorScripts.saveFailedDetail': '无法保存脚本：{message}',
  'workbench.editors.ancestorScripts.deletedElsewhere': '此条目已在另一个窗口中被删除。',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.titleCollection': '授权——{name}',
  'workbench.editors.ancestorAuth.titleFolder': '授权——{name}',
  'workbench.editors.ancestorAuth.descriptionCollection':
    '设为“继承”的请求使用此授权。文件夹自己的授权优先，而请求显式设置的授权总是胜出。此处的“继承”表示这一层未配置任何内容。',
  'workbench.editors.ancestorAuth.descriptionFolder':
    '设为“继承”的请求先于集合的授权使用此授权。请求显式设置的授权总是胜出。此处的“继承”表示这一层未配置任何内容——请求会落回到集合。',
  'workbench.editors.ancestorAuth.notFoundCollection': '未找到请求集合。',
  'workbench.editors.ancestorAuth.notFoundFolder': '未找到文件夹。',
  'workbench.editors.ancestorAuth.saveFailed': '无法保存授权。',
  'workbench.editors.ancestorAuth.saveFailedDetail': '无法保存授权：{message}',
  'workbench.editors.ancestorAuth.deletedElsewhere': '此条目已在另一个窗口中被删除。',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': '正在加载示例…',
  'workbench.editors.responseExample.notFound': '未找到示例。',
  'workbench.editors.responseExample.toast.deletedOtherTab': '示例已从另一个标签页中被删除',
  'workbench.editors.responseExample.toast.saveFailed': '保存示例失败',
  'workbench.editors.responseExample.toast.saveFailedDetail': '保存示例失败：{message}',
  'workbench.editors.responseExample.openAsRequest': '作为请求打开',
  'workbench.editors.responseExample.openAsRequestTooltip': '创建一个新的请求草稿，从此示例的请求预填充',
  'workbench.editors.responseExample.editStatus': '编辑状态码',
  'workbench.editors.responseExample.statusPlaceholder': '输入响应代码',
  'workbench.editors.responseExample.capturedTooltip': '捕获于 {date}',
  'workbench.editors.responseExample.moreActionsAria': '更多响应操作',
  'workbench.editors.responseExample.tab.body': '正文',
  'workbench.editors.responseExample.tab.headers': '标头（{count}）',
  'workbench.editors.responseExample.bodyLanguageAria': '正文语言',
  'workbench.editors.responseExample.format': '格式化',
  'workbench.editors.responseExample.formatBody': '格式化正文',
  'workbench.editors.responseExample.noFormatter': '没有适用于 {language} 的格式化工具',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': '代码片段',
  'workbench.editors.scriptEditor.packages': '包',
  'workbench.editors.scriptEditor.searchSnippets': '搜索代码片段',
  'workbench.editors.scriptEditor.searchPackages': '搜索包',
  'workbench.editors.scriptEditor.noSnippetFound': '未找到代码片段',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': '此工作区中还没有包',
  'workbench.editors.scriptEditor.noPackageFound': '未找到包',
  'workbench.editors.scriptEditor.openPackageLibrary': '打开包库 →',
  'workbench.editors.scriptEditor.saveToPackage': '保存到包库',
  'workbench.editors.scriptEditor.newPackage': '新建包',
  'workbench.editors.scriptEditor.newPackageName': '新包名称',
  'workbench.editors.scriptEditor.back': '返回',
  'workbench.editors.scriptEditor.create': '创建',
  'workbench.editors.scriptEditor.orAppend': '或追加到现有的包：',
  'workbench.editors.scriptEditor.noPackagesYet': '还没有包',
  'workbench.editors.scriptEditor.savedTo': '已保存到“{name}”',
  'workbench.editors.scriptEditor.packageCreated': '包“{name}”已创建',
  'workbench.editors.scriptEditor.duplicatePackage': '此工作区中已存在名为“{name}”的包。',
  'workbench.editors.scriptEditor.packageNotFound': '未找到该包——它可能已被删除。',
  'workbench.editors.scriptEditor.saveFailed': '保存失败',
  'workbench.editors.scriptEditor.menuFind': '查找',
  'workbench.editors.scriptEditor.find': '查找',
  'workbench.editors.scriptEditor.replace': '替换',
  'workbench.editors.scriptEditor.beautify': '美化',
  'workbench.editors.scriptEditor.group.request': '请求',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': '包',
  'workbench.editors.scriptEditor.group.variables': '变量',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': '发送一个 HTTP 请求',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': '发送一个带 JSON 正文的 HTTP 请求',
  'workbench.editors.scriptEditor.snippet.getVariable': '获取一个变量',
  'workbench.editors.scriptEditor.snippet.setVariable': '设置一个变量',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': '获取一个 vault 机密',
  'workbench.editors.scriptEditor.snippet.usePackage': '使用一个包',
  'workbench.editors.scriptEditor.snippet.setHeader': '设置一个标头',
  'workbench.editors.scriptEditor.snippet.removeHeader': '移除一个标头',
  'workbench.editors.scriptEditor.snippet.setQueryParam': '设置一个查询参数',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': '移除一个查询参数',
  'workbench.editors.scriptEditor.snippet.setUrl': '设置 URL',
  'workbench.editors.scriptEditor.snippet.setMethod': '设置方法',
  'workbench.editors.scriptEditor.snippet.setJsonBody': '设置一个 JSON 正文',
  'workbench.editors.scriptEditor.snippet.statusCode200': '状态码为 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': '响应体包含某个字符串',
  'workbench.editors.scriptEditor.snippet.bodyEquals': '响应体等于某个字符串',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': '响应体 JSON 值检查',
  'workbench.editors.scriptEditor.snippet.headerCheck': '响应标头检查',
  'workbench.editors.scriptEditor.snippet.responseTime': '响应时间低于 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': '把响应中的某个值保存到变量',
} as const satisfies Catalog;
