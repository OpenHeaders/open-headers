/**
 * Workbench editors — gRPC client + gRPC response examples —
 * Simplified Chinese. Mirrors `catalogs/en/workbench-editors-grpc.ts`
 * key for key. Raw by design: gRPC status-code names (OK, CANCELLED,
 * …) with their lead-ins rendered as 状态码 N NAME, rpc/service
 * identifiers ({rpc}), Protobuf / `.proto` / TLS / SSL / lowercase
 * `base64` vocabulary, `host:port` and `authorization: Bearer
 * <token>` wire syntax, `Metadata` / `Trailers` tab nouns kept as the
 * gRPC protocol terms, `Docs` / `Streaming` raw, and the {count} /
 * {ms} / {bytes} / {name} / {message} holes. Settings tab = 设置;
 * 时间线 = timeline; 帧 = frame; streaming modes reuse the
 * editors-spec mints（一元 / 流式）; 授权 / 标头-family tab nouns per
 * editors-websocket. MINTS: 调用 = invoke / the call; 服务定义 = the
 * Service definition tab; 封顶于 = capped at (byte cap).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': '未找到 gRPC 请求。',
  'workbench.editors.grpc.urlPlaceholder': 'host:port（例如 grpc.openheaders.com:443）',
  'workbench.editors.grpc.tls.on': 'TLS 已开启——点击切换为明文',
  'workbench.editors.grpc.tls.off': 'TLS 已关闭（明文）——点击切换为 TLS',
  'workbench.editors.grpc.method.placeholder': '选择一个方法',
  'workbench.editors.grpc.method.noSpecPlaceholder': '关联一个 Protobuf 规范以挑选方法',
  'workbench.editors.grpc.method.unresolvedGroup': '不在已关联的规范中',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc}（未解析）',
  'workbench.editors.grpc.method.linkGroup': '关联一个 Protobuf 规范',
  'workbench.editors.grpc.method.importProto': '导入 .proto 文件…',
  'workbench.editors.grpc.invoke.label': '调用',
  'workbench.editors.grpc.invoke.stop': '停止',
  'workbench.editors.grpc.invoke.browserHost': '调用在桌面端应用上运行——编写和保存在这里可用。',
  'workbench.editors.grpc.invoke.needsMethod': '挑选一个能在已关联规范中解析的方法以调用',
  'workbench.editors.grpc.invoke.needsUrl': '输入目标主机以调用',
  'workbench.editors.grpc.invoke.failed': '调用失败——主机没有应答此次调用',
  'workbench.editors.grpc.response.title': '响应',
  'workbench.editors.grpc.response.empty.prompt': '调用一个方法以获取响应。',
  'workbench.editors.grpc.response.empty.invoking': '正在调用…',
  'workbench.editors.grpc.status.kicker': 'gRPC 状态',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, so the pill popover reads exactly like the protocol
  // documentation.
  'workbench.editors.grpc.status.desc.unknownCode': '一个不在 gRPC 词汇表内的非标准状态码。',
  'workbench.editors.grpc.status.desc.OK': '状态码 0 OK 是成功调用 gRPC 方法的标准响应。',
  'workbench.editors.grpc.status.desc.CANCELLED': '状态码 1 CANCELLED 在操作被调用方取消时返回。',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    '状态码 2 UNKNOWN 在操作因未知错误而无法完成时返回。例如，当从另一个地址空间收到的 Status 值属于本地址空间' +
    '不认识的错误空间时，可能返回此错误。未返回足够错误信息的 API 抛出的错误也可能被转换为此错误。',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    '状态码 3 INVALID_ARGUMENT 在客户端指定了无效参数时返回。它代表无论系统状态如何都成问题的参数（例如格式' +
    '错误的文件名）。',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    '状态码 4 DEADLINE_EXCEEDED 在截止时间先于操作完成到期时返回。对改变系统状态的操作，即使操作已成功完成也' +
    '可能返回此错误。例如，服务器的成功响应可能被延迟了太久。',
  'workbench.editors.grpc.status.desc.NOT_FOUND': '状态码 5 NOT_FOUND 在请求的实体（例如文件或目录）未找到时返回。',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    '状态码 6 ALREADY_EXISTS 在你试图创建的实体（例如文件或目录）已存在时返回。',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    '状态码 7 PERMISSION_DENIED 在调用方没有权限执行指定操作时返回。此错误码并不意味着请求有效、请求的实体存在' +
    '或满足其他前置条件。',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    '状态码 8 RESOURCE_EXHAUSTED 在按用户的配额耗尽、或整个文件系统空间不足时返回。',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    '状态码 9 FAILED_PRECONDITION 在系统未处于执行该操作所需的状态、操作因此被拒绝时返回。例如，要删除的目录' +
    '非空、对非目录执行 rmdir 操作等。',
  'workbench.editors.grpc.status.desc.ABORTED':
    '状态码 10 ABORTED 在操作被中止时返回，通常因为并发问题，例如序列器检查失败或事务中止。',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    '状态码 11 OUT_OF_RANGE 在操作试图越过有效范围时返回。例如，寻址或读取越过了文件末尾。',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    '状态码 12 UNIMPLEMENTED 在操作未实现、或在此服务中不受支持 / 未启用时返回。',
  'workbench.editors.grpc.status.desc.INTERNAL':
    '状态码 13 INTERNAL 在出现内部错误时返回。这意味着底层系统所期待的某些不变量被破坏了。',
  'workbench.editors.grpc.status.desc.UNAVAILABLE': '状态码 14 UNAVAILABLE 在服务当前不可用时返回。',
  'workbench.editors.grpc.status.desc.DATA_LOSS': '状态码 15 DATA_LOSS 在出现不可恢复的数据丢失或损坏时返回。',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    '状态码 16 UNAUTHENTICATED 在请求没有该操作的有效身份验证凭据时返回。',
  'workbench.editors.grpc.response.error.title': '调用失败',
  'workbench.editors.grpc.response.error.localGuidance': '调用从未得到应答。检查目标、TLS 模式，以及服务器是否可达。',
  'workbench.editors.grpc.response.error.statusGuidance': '检查消息后再次调用该方法。',
  'workbench.editors.grpc.response.tab.response': '响应',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata（{count}）',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers（{count}）',
  'workbench.editors.grpc.response.filterMetadata': '筛选 metadata',
  'workbench.editors.grpc.response.filterTrailers': '筛选 trailers',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': '没有 gRPC 状态',
  'workbench.editors.grpc.response.noMessage': '应答未携带响应消息。',
  'workbench.editors.grpc.response.noMetadata': '没有 metadata',
  'workbench.editors.grpc.response.noTrailers': '没有 trailers',
  'workbench.editors.grpc.response.trailersOnly': '仅 trailers 的应答——状态随初始 metadata 到达，之后没有消息。',
  'workbench.editors.grpc.response.compressed': '响应帧被压缩——压缩未经协商，因此无法解码。',
  'workbench.editors.grpc.response.structuralNotice': '结构化解码（字段编号）——响应类型未能在已关联的规范中解析。',
  'workbench.editors.grpc.response.rawNotice': '消息未能解码；原始字节以 base64 显示。',
  'workbench.editors.grpc.response.extraFrames': '到达了 {count} 个消息帧——一元应答只携带一个；显示第一个。',
  'workbench.editors.grpc.response.incompleteTail': '响应在帧中途结束；显示完整的帧。',
  'workbench.editors.grpc.response.truncated': '响应封顶于 {bytes} 字节。',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': '消息',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.serviceDefinition': '服务定义',
  'workbench.editors.grpc.tab.settings': '设置',
  'workbench.editors.grpc.messagePlaceholder': '以 JSON 编写请求消息',
  'workbench.editors.grpc.example.label': '使用示例消息',
  'workbench.editors.grpc.example.needsMethod': '先挑选一个能在已关联规范中解析的方法',
  'workbench.editors.grpc.metadata.keyPlaceholder': '键',
  'workbench.editors.grpc.metadata.valuePlaceholder': '值',
  'workbench.editors.grpc.spec.selectLabel': 'Protobuf 规范',
  'workbench.editors.grpc.spec.selectPlaceholder': '关联一个 Protobuf 规范…',
  'workbench.editors.grpc.spec.summary': '{services} 个服务 · {methods} 个方法',
  'workbench.editors.grpc.spec.parseFailure': '{path}：{message}',
  'workbench.editors.grpc.spec.issue': '{kind}：{reference}',
  'workbench.editors.grpc.spec.importReadFailed': '读取文件失败：{message}',
  'workbench.editors.grpc.spec.importFailed': '导入 .proto 文件失败',
  'workbench.editors.grpc.specFooter.using': '使用 {name}',
  'workbench.editors.grpc.specFooter.none': '未关联规范',
  'workbench.editors.grpc.specFooter.issues': '{count} 个未解析',
  'workbench.editors.grpc.specFooter.refresh': '按规范当前的文件重建',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Unix 套接字',
  'workbench.editors.grpc.settings.unixSocketHelp':
    '拨号这个本地套接字——绝对 Unix 套接字路径，或形如 \\\\.\\pipe\\name 的 Windows 命名管道——而不是打开 TCP 连接。目标仍决定 :authority 标头、TLS 服务器名和证书验证；只有连接的去向改变。留空则使用普通 TCP 连接。',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': '无套接字——TCP 连接',
  'workbench.editors.grpc.settings.timeoutLabel': '调用超时（ms）',
  'workbench.editors.grpc.settings.timeoutPlaceholder': '无限制',
  'workbench.editors.grpc.settings.timeoutHelp': '整个调用的墙钟时间上限——作为 gRPC 截止时间发送，并在本地强制执行。',
  'workbench.editors.grpc.settings.sslVerifyLabel': 'SSL 证书验证',
  'workbench.editors.grpc.settings.sslVerifyHelp': '按系统根证书验证服务器证书。对自签名的开发服务器可关闭。',
  'workbench.editors.grpc.tab.auth': '授权',
  'workbench.editors.grpc.auth.typeLabel': '类型',
  'workbench.editors.grpc.auth.typeNone': '无授权',
  'workbench.editors.grpc.auth.typeBearer': 'Bearer token',
  'workbench.editors.grpc.auth.tokenLabel': 'Token',
  'workbench.editors.grpc.auth.tokenPlaceholder': 'Token 或 {{variable}}',
  'workbench.editors.grpc.auth.help':
    '作为 authorization: Bearer <token> metadata 随调用发送。显式的 authorization metadata 行优先。',
  'workbench.editors.grpc.invoke.connectCompanion': '连接桌面端应用以调用——编写和保存在这里可用。',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': '已停止',
  'workbench.editors.grpc.stream.tab.timeline': '时间线',
  'workbench.editors.grpc.stream.trailersPending': 'Trailers 在调用完成时到达。',
  'workbench.editors.grpc.stream.sendMessage': '发送消息',
  'workbench.editors.grpc.stream.endStreaming': '结束流式传输',
  'workbench.editors.grpc.stream.controlsIdle': '先调用以打开流',
  'workbench.editors.grpc.stream.sendFailed': '消息未发送',
  'workbench.editors.grpc.timeline.requestSent': '请求已发送',
  'workbench.editors.grpc.timeline.responseReceived': '响应已接收',
  'workbench.editors.grpc.timeline.completed': '调用已完成',
  'workbench.editors.grpc.timeline.stopped': '调用已停止',
  'workbench.editors.grpc.timeline.failed': '调用失败',
  'workbench.editors.grpc.timeline.waiting': '等待消息…',
  'workbench.editors.grpc.timeline.noMatches': '没有匹配的消息。',
  'workbench.editors.grpc.timeline.searchMessages': '搜索消息',
  'workbench.editors.grpc.timeline.filterAll': '全部',
  'workbench.editors.grpc.timeline.filterSent': '已发送',
  'workbench.editors.grpc.timeline.filterReceived': '已接收',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 条消息' }),
  'workbench.editors.grpc.timeline.sortOrder': '排序与分组',
  'workbench.editors.grpc.timeline.newestFirst': '最新在前',
  'workbench.editors.grpc.timeline.oldestFirst': '最早在前',
  'workbench.editors.grpc.timeline.showTypes': '显示消息类型',
  'workbench.editors.grpc.timeline.groupByType': '按消息类型分组',
  'workbench.editors.grpc.timeline.groupByDirection': '按方向分组',
  'workbench.editors.grpc.timeline.rowsPerGroup': '每组行数',
  'workbench.editors.grpc.timeline.noLimit': '无限制',
  'workbench.editors.grpc.timeline.clearMessages': '清除消息（仅显示层）',
  'workbench.editors.grpc.timeline.newMessages': '新消息',
  'workbench.editors.grpc.timeline.sentAria': '已发送的消息',
  'workbench.editors.grpc.timeline.receivedAria': '已接收的消息',
  'workbench.editors.grpc.toast.deletedOtherTab': 'gRPC 请求已从另一个标签页中被删除',
  'workbench.editors.grpc.toast.updateFailed': '更新 gRPC 请求失败',
  'workbench.editors.grpc.toast.updateFailedDetail': '更新 gRPC 请求失败：{message}',
  'workbench.editors.grpc.response.saveResponse': '保存响应',
  'workbench.editors.grpc.toast.savedExample': '已保存示例“{name}”',
  'workbench.editors.grpc.toast.saveExampleFailed': '保存示例失败',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': '保存示例失败：{message}',
  'workbench.editors.grpcExample.loading': '正在加载示例…',
  'workbench.editors.grpcExample.notFound': '未找到示例。',
  'workbench.editors.grpcExample.toast.deletedOtherTab': '示例已从另一个标签页中被删除',
  'workbench.editors.grpcExample.toast.saveFailed': '保存示例失败',
  'workbench.editors.grpcExample.toast.saveFailedDetail': '保存示例失败：{message}',
  'workbench.editors.grpcExample.openInRequest': '在请求中打开',
  'workbench.editors.grpcExample.openInRequestTooltip':
    '把此示例捕获的调用复制到父 gRPC 请求的编辑器中，作为未保存的编辑',
  'workbench.editors.grpcExample.noMethod': '未记录方法',
  'workbench.editors.grpcExample.capturedTooltip': '捕获于 {date}',
  'workbench.editors.grpcExample.result.title': '捕获的响应',
} as const satisfies Catalog;
