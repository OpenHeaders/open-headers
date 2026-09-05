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
  'workbench.editors.graphql.explorer.landsWithSchema': '将随模式阶段推出。',
  'workbench.editors.graphql.variables.title': '变量',
  'workbench.editors.graphql.variables.generate': '生成变量',
  'workbench.editors.graphql.variables.generateHint': '根据所选操作的变量定义填充变量。',
  'workbench.editors.graphql.variables.generateNeedsOperation': '所选操作未声明任何变量。',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    '每个 GraphQL 操作都以 JSON 发送 {query, variables, operationName} 信封。添加你自己的 Content-Type 行即可覆盖。',
  'workbench.editors.graphql.schema.sourceLabel': '模式来源',
  'workbench.editors.graphql.schema.sourcePlaceholder': '选择一个模式或粘贴其链接',
  'workbench.editors.graphql.schema.or': '或',
  'workbench.editors.graphql.schema.hint':
    '模式为资源管理器、补全和校验提供数据——可通过本请求的认证与设置从服务器自省获取，从 GraphQL 规范链接，或从 SDL 或自省文件导入。',
  'workbench.editors.graphql.scripts.beforeQuery': '查询前',
  'workbench.editors.graphql.scripts.afterResponse': '响应后',
  'workbench.editors.graphql.toast.deletedOtherTab': '此 GraphQL 请求已在另一个标签页中删除。',
  'workbench.editors.graphql.toast.updateFailed': '保存 GraphQL 请求失败',
  'workbench.editors.graphql.toast.updateFailedDetail': '保存 GraphQL 请求失败：{message}',
} as const satisfies Catalog;
