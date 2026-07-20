/**
 * Workbench editors — the API spec editor — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-editors-spec.ts` key for key.
 * Outline group labels mirror the document's own keywords (`paths:`,
 * `components:`, `schemas:`, AsyncAPI `channels:`/`operations:`,
 * proto `package`/`import`/`service`/`message`/`enum`) and ride raw;
 * `Files` is app grouping and translates（文件）. The AsyncAPI
 * Send/Receive badges mirror the document's `action` enum and stay
 * raw — a different referent from the Send button mint 发送. `ROOT`
 * badge raw; `baseUrl` verbatim as a bare variable name (never
 * compounded). Field chips translate per the de/es parity lock
 * (名称 / 描述 / 标头 / 参数 / 正文) with `auth` riding raw as the
 * code-ish field id. 规范 =
 * spec; 集合 = collection; 大纲 = the outline (document tree); 概览 =
 * the Overview pane title. MINTS: streaming modes 一元 / 服务器流式 /
 * 客户端流式 / 双向流式 — editors-grpc zh-CN MUST reuse; Root 文件 =
 * Root file (Root raw, half-width space).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': '未找到规范。',
  'workbench.editors.spec.deletedElsewhere': '此规范已在另一个会话中被删除。',
  'workbench.editors.spec.saveFailed': '无法保存规范。',
  'workbench.editors.spec.validation.clean': '未发现问题',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个错误' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个警告' }),
  'workbench.editors.spec.outline.title': '概览',
  'workbench.editors.spec.outline.show': '显示概览',
  'workbench.editors.spec.outline.hide': '隐藏概览',
  'workbench.editors.spec.outline.empty': '文档解析成功后会显示大纲。',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': '标记为 Root 文件',
  'workbench.editors.spec.outline.fileMenuAria': '文件操作',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.files': '文件',
  'workbench.editors.spec.outline.streaming.unary': '一元',
  'workbench.editors.spec.outline.streaming.server': '服务器流式',
  'workbench.editors.spec.outline.streaming.client': '客户端流式',
  'workbench.editors.spec.outline.streaming.bidi': '双向流式',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': '添加服务器',
  'workbench.editors.spec.outline.add.tag': '添加 tag',
  'workbench.editors.spec.outline.add.path': '添加路径',
  'workbench.editors.spec.outline.add.operation': '添加操作',
  'workbench.editors.spec.outline.add.schema': '添加模式',
  'workbench.editors.spec.outline.add.securityScheme': '添加安全方案',
  'workbench.editors.spec.outline.add.securityRequirement': '添加安全要求',
  'workbench.editors.spec.generate.button': '生成集合',
  'workbench.editors.spec.generate.collectionsButton': '集合',
  'workbench.editors.spec.generate.popoverTitle': '已生成的集合',
  'workbench.editors.spec.generate.modalTitle': '生成集合',
  'workbench.editors.spec.generate.blurb':
    '从此规范生成一个集合。操作变成 baseUrl 集合变量之下的请求，tag 变成文件夹，安全方案映射为授权。集合会与此规范保持关联。',
  'workbench.editors.spec.generate.namePlaceholder': '集合名称',
  'workbench.editors.spec.generate.nameRequired': '集合需要一个名称',
  'workbench.editors.spec.generate.dirtyHint': '未保存的编辑器更改不包含在内——生成使用最后保存的文档。',
  'workbench.editors.spec.generate.parseFailed': '此规范无法解析',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个请求' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个文件夹' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个集合变量' }),
  'workbench.editors.spec.generate.action': '生成',
  'workbench.editors.spec.generate.success': '已生成“{name}”——{summary}',
  'workbench.editors.spec.generate.failed': '无法创建集合。',
  'workbench.editors.spec.generate.linkFailed': '集合已生成，但记录其规范关联失败——它不会出现在此列表中。',
  'workbench.editors.spec.generateProto.blurb':
    '从此规范生成一个集合。服务方法变成 gRPC 请求并预填充示例消息，按服务分组到各自的文件夹。集合会与此规范保持关联。',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个 gRPC 请求' }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个服务' }),
  'workbench.editors.spec.generateProto.empty': '文档未声明可供生成的服务方法。',
  'workbench.editors.spec.generateProto.partial': '生成时有缺口——{created} 个已创建，{failed} 个失败。',
  'workbench.editors.spec.generateWs.blurb':
    '从此规范生成一个集合。操作变成指向文档 ws/wss 服务器的 WebSocket 请求，并根据频道的模式预填充一条示例消息。集合会与此规范保持关联。',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个 WebSocket 请求' }),
  'workbench.editors.spec.generateWs.empty': '文档未声明可供生成的操作。',
  'workbench.editors.spec.generateWs.noWsServer': '文档未声明可连接的 ws 或 wss 服务器。',
  'workbench.editors.spec.generateWs.partial': '生成时有缺口——{created} 个已创建，{failed} 个失败。',
  'workbench.editors.spec.generateWs.skipped': '已跳过 {operation}：{reason}。',
  'workbench.editors.spec.update.button': '更新',
  'workbench.editors.spec.update.protoUnavailable': '暂不支持从 Protobuf 规范更新——请生成一个新集合来获取更改。',
  'workbench.editors.spec.update.inSyncBadge': '与已保存的文档同步',
  'workbench.editors.spec.update.driftedBadge': '规范在上次更新后发生了变化',
  'workbench.editors.spec.update.modalTitle': '更新集合',
  'workbench.editors.spec.update.blurb':
    '检查已保存的文档与“{name}”之间的差异，然后应用所选的更新。未勾选的行保持不变。',
  'workbench.editors.spec.update.dirtyHint': '未保存的编辑器更改不包含在内——更新使用最后保存的文档。',
  'workbench.editors.spec.update.parseFailed': '此规范无法解析',
  'workbench.editors.spec.update.inSync': '没有请求级差异——应用会把集合标记为与已保存的文档同步。',
  'workbench.editors.spec.update.groupAdded': '已添加（{count}）',
  'workbench.editors.spec.update.groupChanged': '已更改（{count}）',
  'workbench.editors.spec.update.groupRemoved': '已从规范中移除（{count}）',
  'workbench.editors.spec.update.removeHint': '未勾选的请求会留在集合中。',
  'workbench.editors.spec.update.groupCollection': '集合',
  'workbench.editors.spec.update.variablesRow': '集合变量',
  'workbench.editors.spec.update.authRow': '集合授权',
  'workbench.editors.spec.update.field.name': '名称',
  'workbench.editors.spec.update.field.description': '描述',
  'workbench.editors.spec.update.field.headers': '标头',
  'workbench.editors.spec.update.field.params': '参数',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': '正文',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), { other: '应用 {count} 项更新' }),
  'workbench.editors.spec.update.markInSync': '标记为同步',
  'workbench.editors.spec.update.hashNote':
    '应用会在集合关联上记录此文档版本，因此即使有些行未勾选，关联也会显示为同步。',
  'workbench.editors.spec.update.success': '已更新“{name}”——已应用 {count} 项',
  'workbench.editors.spec.update.partial': '{applied} 项已应用，{failed} 项失败——集合可能只更新了一部分。',
  'workbench.editors.spec.update.failed': '无法更新集合。',
} as const satisfies Catalog;
