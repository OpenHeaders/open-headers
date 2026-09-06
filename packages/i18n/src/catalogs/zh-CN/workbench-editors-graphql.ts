/**
 * Workbench editors — the GraphQL client editor, Simplified Chinese.
 * Wire vocabulary (GraphQL, the `{query, variables, operationName}`
 * envelope names, SDL, introspection) rides raw inside keyed values.
 * 「模式」= schema；「资源管理器」= explorer；「变量」= variables.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': '未找到 GraphQL 请求。',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': '停止',
  'workbench.editors.graphql.query.stopTooltip': '停止查询并保留已到达的内容',
  'workbench.editors.graphql.operation.placeholder': '操作',
  'workbench.editors.graphql.operation.tooltip':
    'Query 执行的操作——文档包含多个操作；所选操作以 operationName 随请求发送。',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个错误' }),
  'workbench.editors.graphql.response.errorsTitle': 'GraphQL 错误',
  'workbench.editors.graphql.response.errorsSummary':
    '服务器以 HTTP {status} 返回了 errors[] 列表——某个字段失败、文档被拒绝或缺少认证。请一并查看 data：部分数据，或 null。',
  'workbench.editors.graphql.response.dataNull': 'data 为 null——每个根字段都向上传播了空值，或请求在执行前被拒绝。',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': '响应扩展',
  'workbench.editors.graphql.response.extensionsSummary':
    '服务器的 extensions 对象随 data 一同返回——追踪、成本、缓存提示，以及它选择附加的任何内容。',
  'workbench.editors.graphql.query.hint': '文档——一个或多个操作，可包含片段。',
  'workbench.editors.graphql.query.prettify': '美化',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': '文档',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': '授权',
  'workbench.editors.graphql.tab.headers': '标头',
  'workbench.editors.graphql.tab.schema': '模式',
  'workbench.editors.graphql.tab.scripts': '脚本',
  'workbench.editors.graphql.tab.settings': '设置',
  'workbench.editors.graphql.explorer.emptyTitle': '浏览服务器提供的数据',
  'workbench.editors.graphql.explorer.emptyHint': '输入服务器 URL，通过自省加载模式。',
  'workbench.editors.graphql.explorer.introspect': '使用 GraphQL 自省',
  'workbench.editors.graphql.explorer.useSpec': '使用 GraphQL 规范',
  'workbench.editors.graphql.explorer.importSchema': '导入 GraphQL 模式',
  'workbench.editors.graphql.variables.title': '变量',
  'workbench.editors.graphql.variables.generate': '生成变量',
  'workbench.editors.graphql.variables.generateHint': '根据所选操作的变量定义填充变量。',
  'workbench.editors.graphql.variables.generateNeedsOperation': '所选操作未声明任何变量。',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    '每个 GraphQL 操作都以 JSON 发送 {query, variables, operationName} 信封。添加你自己的 Content-Type 行即可覆盖。',
  'workbench.editors.graphql.schema.sourceLabel': '模式来源',
  'workbench.editors.graphql.schema.sourcePlaceholder': '选择模式来源',
  'workbench.editors.graphql.schema.or': '或',
  'workbench.editors.graphql.schema.hint':
    '模式为资源管理器、补全和校验提供数据——可通过本请求的认证与设置从服务器自省获取，从 GraphQL 规范链接，或从 SDL 或自省文件导入。',
  'workbench.editors.graphql.scripts.beforeQuery': '查询前',
  'workbench.editors.graphql.scripts.afterResponse': '响应后',
  'workbench.editors.graphql.toast.deletedOtherTab': '此 GraphQL 请求已在另一个标签页中删除。',
  'workbench.editors.graphql.toast.updateFailed': '保存 GraphQL 请求失败',
  'workbench.editors.graphql.toast.updateFailedDetail': '保存 GraphQL 请求失败：{message}',
  'workbench.editors.graphql.explorer.needsUrl': '请先输入端点 URL。',
  'workbench.editors.graphql.explorer.introspecting': '正在自省…',
  'workbench.editors.graphql.explorer.search': '搜索类型和字段',
  'workbench.editors.graphql.explorer.noResults': '没有与“{term}”匹配的内容。',
  'workbench.editors.graphql.explorer.back': '返回',
  'workbench.editors.graphql.explorer.fields': '字段',
  'workbench.editors.graphql.explorer.arguments': '参数',
  'workbench.editors.graphql.explorer.values': '取值',
  'workbench.editors.graphql.explorer.inputFields': '输入字段',
  'workbench.editors.graphql.explorer.implements': '实现',
  'workbench.editors.graphql.explorer.possibleTypes': '可能的类型',
  'workbench.editors.graphql.explorer.returns': '返回',
  'workbench.editors.graphql.explorer.specifiedBy': '规范来源',
  'workbench.editors.graphql.explorer.deprecated': '已弃用：{reason}',
  'workbench.editors.graphql.explorer.insert': '在光标处插入',
  'workbench.editors.graphql.explorer.insertHint':
    '在光标处把该字段加入文档——必填参数作为变量，返回对象时附带一个空的选择集。单向操作：文档仍由你掌控。',
  'workbench.editors.graphql.schema.source.introspection': 'GraphQL 自省',
  'workbench.editors.graphql.schema.source.spec': '已关联的 GraphQL 规范',
  'workbench.editors.graphql.schema.refresh': '刷新',
  'workbench.editors.graphql.schema.fetchedAt': '自省于 {when}',
  'workbench.editors.graphql.schema.notIntrospected': '尚未自省——模式将通过此请求的认证、头部和设置从端点加载。',
  'workbench.editors.graphql.schema.introspectFailed': '自省失败：{message}',
  'workbench.editors.graphql.schema.specLabel': 'GraphQL 规范',
  'workbench.editors.graphql.schema.specPlaceholder': '选择一个 GraphQL 规范',
  'workbench.editors.graphql.schema.specMissing': '关联的规范已不存在于此工作区。',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个类型' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个模式问题' }),
  'workbench.editors.graphql.schema.importReadFailed': '读取文件失败：{message}',
  'workbench.editors.graphql.schema.importFailed': '导入模式失败',
  'workbench.editors.graphql.schema.imported': '已将“{name}”导入为 GraphQL 规范并关联。',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个问题' }),
} as const satisfies Catalog;
