/**
 * Workbench editors — the WebSocket client editor — Simplified
 * Chinese. Mirrors `catalogs/en/workbench-editors-websocket.ts` key
 * for key. Wire vocabulary rides raw inside keyed values: ws/wss
 * schemes, subprotocol identifiers, AsyncAPI, Socket.IO / CONNECT /
 * engine.io tokens, the sio decoded rows (verbatim wire), `Arg`,
 * Bearer / token, long-polling. The Params tab and Docs tab ride raw
 * (tab.params / Docs law); Settings tab = 设置; spec-browser section
 * headers mirror AsyncAPI document keywords and ride raw (spec
 * outline law) while prose says 频道 / 操作 (editors-spec donor). 帧
 * = frame; 握手 = handshake; 会话 = session; 时间线 = timeline; 捕获
 * = capture; 授权 = the Authorization tab; 标头 = Headers tab; 负载
 * = payload; 遮罩-free file. MINTS: 子协议 = subprotocol; 监听 = the
 * Listen column; 确认 = ack (prose; the sio row `ack` stays verbatim
 * wire); 事件 = the Events tab noun — future editors-request zh-CN
 * reuses 授权 / 标头 / Params for its twin tabs.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': '未找到 WebSocket 请求。',
  'workbench.editors.websocket.urlPlaceholder': 'wss://echo.openheaders.com/socket',
  'workbench.editors.websocket.scheme.wss': 'wss——TLS 已开启。点击切换为明文 ws。',
  'workbench.editors.websocket.scheme.ws': 'ws——明文。点击切换为 wss。',
  'workbench.editors.websocket.flavor.raw': 'WebSocket',
  'workbench.editors.websocket.flavor.socketio': 'Socket.IO',
  'workbench.editors.websocket.connect.label': '连接',
  'workbench.editors.websocket.connect.disconnect': '断开连接',
  'workbench.editors.websocket.connect.browserHost': 'WebSocket 会话在桌面端应用或服务器上运行。',
  'workbench.editors.websocket.connect.needsUrl': '输入 ws:// 或 wss:// URL 以连接。',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': '消息',
  'workbench.editors.websocket.tab.events': '事件',
  'workbench.editors.websocket.tab.auth': '授权',
  'workbench.editors.websocket.tab.headers': '标头',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.spec': 'AsyncAPI',
  'workbench.editors.websocket.tab.settings': '设置',
  'workbench.editors.websocket.messagePlaceholder': '编写下一条要发送的消息…',
  'workbench.editors.websocket.message.formatText': '文本',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.auth.typeLabel': '类型',
  'workbench.editors.websocket.auth.typeNone': '无授权',
  'workbench.editors.websocket.auth.typeBearer': 'Bearer token',
  'workbench.editors.websocket.auth.tokenLabel': 'Token',
  'workbench.editors.websocket.auth.tokenPlaceholder': 'Token 或 {{variable}}',
  'workbench.editors.websocket.auth.helpRaw':
    '在握手时作为 Authorization: Bearer 标头发送——适用于桌面端应用或服务器；浏览器无法在 WebSocket 上设置它。' +
    '显式的 Authorization 标头行优先。',
  'workbench.editors.websocket.auth.helpSocketio':
    '在每种主机上作为 CONNECT 包的 auth 负载（{"token": …}）发送，并在桌面端应用或服务器上作为 ' +
    'Authorization: Bearer 握手标头发送。显式的 Authorization 标头行优先于该标头。',
  'workbench.editors.websocket.events.hint':
    '要在会话时间线中显示的传入事件。没有任何行时，显示每个事件；捕获始终记录一切。',
  'workbench.editors.websocket.events.namePlaceholder': '事件名称',
  'workbench.editors.websocket.events.listenLabel': '监听',
  'workbench.editors.websocket.event.namePlaceholder': '事件名称',
  'workbench.editors.websocket.event.ackLabel': '期待确认',
  'workbench.editors.websocket.event.ackHelp': '每次发送都铸造一个确认 id，使服务器的确认应答能在时间线中关联起来。',
  'workbench.editors.websocket.event.argsPlaceholder': '编写 JSON 参数数组，例如 ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': '移除参数 {index}',
  'workbench.editors.websocket.event.argPlaceholder': '把此参数编写为 JSON，例如 "hello" 或 {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': '标头名称',
  'workbench.editors.websocket.headers.valuePlaceholder': '值',
  'workbench.editors.websocket.headers.nodeOnly':
    '自定义握手标头在会话运行于桌面端应用或服务器时适用——浏览器无法在 WebSocket 上设置它们。',
  'workbench.editors.websocket.params.keyPlaceholder': '参数名称',
  'workbench.editors.websocket.params.valuePlaceholder': '值',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI 规范',
  'workbench.editors.websocket.spec.selectPlaceholder': '关联一个 AsyncAPI 规范',
  'workbench.editors.websocket.spec.summary': '{servers} 个服务器 · {channels} 个频道 · {operations} 个操作',
  'workbench.editors.websocket.spec.parseFailure': '规范未能解析：{message}',
  'workbench.editors.websocket.spec.issues': '{count} 个规范问题',
  'workbench.editors.websocket.spec.useExample': '使用示例消息…',
  'workbench.editors.websocket.spec.browser.hint': '挑选一条消息以编写其示例负载。',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.specFooter.using': '使用 {name}',
  'workbench.editors.websocket.specFooter.none': '未关联 AsyncAPI 规范',
  'workbench.editors.websocket.settings.sslVerifyLabel': 'SSL 证书验证',
  'workbench.editors.websocket.settings.sslVerifyHelp':
    '对 wss: 会话按系统根证书验证服务器证书。对自签名的开发服务器可关闭。适用于桌面端应用或服务器。',
  'workbench.editors.websocket.settings.subprotocolsLabel': '子协议',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Sec-WebSocket-Protocol 提议列表，按偏好排序——服务器在握手期间从中选定一个。',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': '添加子协议…',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix 套接字',
  'workbench.editors.websocket.settings.unixSocketHelp':
    '拨号这个本地套接字——绝对 Unix 套接字路径，或形如 \\\\.\\pipe\\name 的 Windows 命名管道——而不是打开 TCP 连接。URL 仍决定握手 Host、TLS 服务器名和证书验证；只有连接的去向改变。留空则使用普通 TCP 连接。',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': '无套接字——TCP 连接',
  'workbench.editors.websocket.settings.timeoutLabel': '连接超时（ms）',
  'workbench.editors.websocket.settings.timeoutHelp': '连接握手的墙钟时间上限。留空使用应用默认值。',
  'workbench.editors.websocket.settings.timeoutPlaceholder': '默认',
  'workbench.editors.websocket.settings.namespaceLabel': 'Socket.IO 命名空间',
  'workbench.editors.websocket.settings.namespaceHelp':
    '会话连接到的命名空间——留空连接到根 /。会话直接拨号 websocket 传输；没有 long-polling 回退。',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/',
  'workbench.editors.websocket.toast.deletedOtherTab': '此 WebSocket 请求已在另一个标签页中被删除。',
  'workbench.editors.websocket.toast.updateFailed': '保存 WebSocket 请求失败',
  'workbench.editors.websocket.toast.updateFailedDetail': '保存 WebSocket 请求失败：{message}',
  'workbench.editors.websocket.toast.savedExample': '已保存示例 {name}',
  'workbench.editors.websocket.toast.saveExampleFailed': '保存示例失败',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': '保存示例失败：{message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.title': '会话',
  'workbench.editors.websocket.session.emptyHint': '连接即可开始会话——消息会实时出现在这里。',
  'workbench.editors.websocket.session.connectFailed': '打开会话失败',
  'workbench.editors.websocket.session.connectingBadge': '连接中',
  'workbench.editors.websocket.session.connectedBadge': '已连接',
  'workbench.editors.websocket.session.tab.timeline': '消息',
  'workbench.editors.websocket.session.tab.handshake': '握手',
  'workbench.editors.websocket.session.closedTag': '已关闭 {code}',
  'workbench.editors.websocket.session.stoppedTag': '已停止',
  'workbench.editors.websocket.session.noCloseFrame': '连接结束时没有 Close 帧',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': '发送',
  'workbench.editors.websocket.session.saveResponse': '保存响应',
  'workbench.editors.websocket.session.sendIdle': '连接后即可发送消息。',
  'workbench.editors.websocket.session.sendFailed': '发送消息失败',
  'workbench.editors.websocket.session.hostNotice': '正运行在浏览器 socket 上——{knobs}在此主机上不适用。',
  'workbench.editors.websocket.session.knobHeaders': '自定义握手标头',
  'workbench.editors.websocket.session.knobSslVerify': '关闭 SSL 验证',
  'workbench.editors.websocket.session.knobAuth': 'Bearer 凭据标头',
  'workbench.editors.websocket.session.handshakeProtocol': '子协议',
  'workbench.editors.websocket.session.handshakeExtensions': '扩展',
  'workbench.editors.websocket.session.handshakeNone': '未协商任何项',
  'workbench.editors.websocket.session.handshakeNote':
    '平台 socket 只暴露协商出的子协议和扩展——101 响应标头对客户端不可用。',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': '连接中',
  'workbench.editors.websocket.timeline.connected': '已连接',
  'workbench.editors.websocket.timeline.connectedProtocol': '已连接——子协议 {protocol}',
  'workbench.editors.websocket.timeline.disconnected': '已断开',
  'workbench.editors.websocket.timeline.stopped': '已停止',
  'workbench.editors.websocket.timeline.failed': '失败',
  'workbench.editors.websocket.timeline.waiting': '等待消息…',
  'workbench.editors.websocket.timeline.noMatches': '没有匹配筛选条件的消息。',
  'workbench.editors.websocket.timeline.searchMessages': '搜索消息',
  'workbench.editors.websocket.timeline.messageCount': '{count} 条消息',
  'workbench.editors.websocket.timeline.dropped': '{count} 条较早的消息已滚出捕获',
  'workbench.editors.websocket.timeline.filterAll': '全部',
  'workbench.editors.websocket.timeline.filterSent': '已发送',
  'workbench.editors.websocket.timeline.filterReceived': '已接收',
  'workbench.editors.websocket.timeline.newestFirst': '最新在前',
  'workbench.editors.websocket.timeline.oldestFirst': '最早在前',
  'workbench.editors.websocket.timeline.sortOrder': '排序方式',
  'workbench.editors.websocket.timeline.groupByDirection': '按方向分组',
  'workbench.editors.websocket.timeline.groupByEvent': '按事件分组',
  'workbench.editors.websocket.timeline.rowsPerGroup': '每组行数',
  'workbench.editors.websocket.timeline.noLimit': '不限制',
  'workbench.editors.websocket.timeline.clearMessages': '清除消息',
  'workbench.editors.websocket.timeline.newMessages': '新消息',
  'workbench.editors.websocket.timeline.binaryMessage': '二进制消息（{bytes} 字节）',
  'workbench.editors.websocket.timeline.sentAria': '已发送',
  'workbench.editors.websocket.timeline.receivedAria': '已接收',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': '二进制附件帧（{count} 个附件）',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': '正在加载示例…',
  'workbench.editors.wsExample.notFound': '此示例已不存在——它可能已在另一个标签页中被删除。',
  'workbench.editors.wsExample.openInRequest': '在请求中打开',
  'workbench.editors.wsExample.openInRequestTooltip': '打开父 WebSocket 请求，并把此捕获形态作为未保存的编辑载入。',
  'workbench.editors.wsExample.capturedTooltip': '捕获于 {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': '此示例已在另一个标签页中被删除。',
  'workbench.editors.wsExample.toast.saveFailed': '保存示例失败',
  'workbench.editors.wsExample.toast.saveFailedDetail': '保存示例失败：{message}',
} as const satisfies Catalog;
