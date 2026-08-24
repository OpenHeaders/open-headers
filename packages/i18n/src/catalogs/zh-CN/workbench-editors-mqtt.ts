/**
 * Workbench editors — the MQTT client editor — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-editors-mqtt.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: mqtt/mqtts/ws/wss schemes,
 * CONNECT / PUBLISH / SUBSCRIBE / PINGREQ / RETAIN tokens, QoS, topic
 * filters (+ / #), Base64 / Hexadecimal encodings, AsyncAPI, and the
 * 5.0 property names (Response Topic / Correlation Data / …) which the
 * spec fixes in English. 主题 = topic; 主题过滤器 = topic filter; 载荷
 * = payload (editors-websocket 负载 donor family kept for frames — MQTT
 * prose mints 载荷 for message payloads consistently here); 保留 =
 * retain; 遗嘱 = last will; 订阅 = subscribe/subscription; 会话 =
 * session; 代理 = broker.
 */

import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': '未找到 MQTT 请求。',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    '会话使用的 MQTT 协议版本。5.0 解锁属性与订阅选项；3.1.1 面向拒绝 5.0 的代理。',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.scheme.tooltip':
    '协议方案决定传输方式：mqtt/mqtts 在桌面应用或服务器上拨号 TCP 套接字；ws/wss 在任何主机上通过 WebSocket 运行 MQTT。',
  'workbench.editors.mqtt.connect.label': '连接',
  'workbench.editors.mqtt.connect.pending': '实时会话将在后续更新中推出——请求现在即可编写、保存并同步。',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': '消息',
  'workbench.editors.mqtt.tab.topics': '主题',
  'workbench.editors.mqtt.tab.auth': '授权',
  'workbench.editors.mqtt.tab.properties': '属性',
  'workbench.editors.mqtt.tab.lastWill': '遗嘱',
  'workbench.editors.mqtt.tab.spec': 'AsyncAPI',
  'workbench.editors.mqtt.tab.settings': '设置',
  'workbench.editors.mqtt.qos.q0': 'QoS 0 · 至多一次',
  'workbench.editors.mqtt.qos.q1': 'QoS 1 · 至少一次',
  'workbench.editors.mqtt.qos.q2': 'QoS 2 · 恰好一次',
  'workbench.editors.mqtt.retainLabel': '保留',
  'workbench.editors.mqtt.sendLabel': '发送',
  'workbench.editors.mqtt.topicPlaceholder': '要发布到的主题，例如 sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Text',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexadecimal',
  'workbench.editors.mqtt.payload.invalidGate': '请先修正载荷编码。',
  'workbench.editors.mqtt.payload.invalidBase64': '不是有效的 Base64——解码后的字节才是将要发布的内容。',
  'workbench.editors.mqtt.payload.invalidHex': '不是有效的十六进制——成对的 0-9 a-f 数字解码为要发布的字节。',
  'workbench.editors.mqtt.payloadPlaceholder': '编写要发布的载荷…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': '二进制载荷的 Base64，例如 aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': '二进制载荷的十六进制，例如 48656c6c6f…',
  'workbench.editors.mqtt.props.buttonTooltip': '消息属性',
  'workbench.editors.mqtt.props.hint': '随每条消息发送的 MQTT 5.0 元数据。',
  'workbench.editors.mqtt.props.v311': '消息属性是 MQTT 5.0 特性——此请求面向 3.1.1。',
  'workbench.editors.mqtt.props.userPropKey': '属性',
  'workbench.editors.mqtt.props.userPropValue': '值',
  'workbench.editors.mqtt.props.addUserProp': '用户属性',
  'workbench.editors.mqtt.props.removeUserProp': '移除用户属性',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval（秒）',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator——将载荷标记为 UTF-8 文本',
  'workbench.editors.mqtt.saved.title': '已保存消息',
  'workbench.editors.mqtt.saved.addTooltip': '将当前编写内容保存为可复用消息',
  'workbench.editors.mqtt.saved.emptyHint': '保存消息，以便在活动连接期间复用。',
  'workbench.editors.mqtt.saved.defaultName': '消息',
  'workbench.editors.mqtt.saved.rename': '重命名',
  'workbench.editors.mqtt.saved.duplicate': '复制',
  'workbench.editors.mqtt.saved.delete': '删除',
  'workbench.editors.mqtt.topics.hint': '会话打开时建立的订阅。欢迎使用通配符 + 和 #；关闭的行仍会保存，但不会订阅。',
  'workbench.editors.mqtt.topics.filterLabel': '主题过滤器',
  'workbench.editors.mqtt.topics.filterPlaceholder': '主题过滤器，例如 sensors/+/temperature',
  'workbench.editors.mqtt.topics.optionsLabel': 'QoS / 订阅',
  'workbench.editors.mqtt.topics.subscribeLabel': '会话打开时订阅',
  'workbench.editors.mqtt.topics.optionsHint': '此行的 MQTT 5.0 订阅选项。',
  'workbench.editors.mqtt.topics.noLocal': 'No Local——不回传此客户端自己的发布',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published——按发布原样转发 RETAIN 标志',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · 订阅时发送保留消息',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · 仅对新订阅发送',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · 不发送保留消息',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.auth.typeLabel': '类型',
  'workbench.editors.mqtt.auth.typeNone': '无授权',
  'workbench.editors.mqtt.auth.typeBasic': 'Basic 授权',
  'workbench.editors.mqtt.auth.pending': 'CONNECT 上的用户名/密码将与会话平面一起在后续更新中接通。',
  'workbench.editors.mqtt.userProps.hint': '随 CONNECT 发送的用户属性——代理与其他工具可读取的自由元数据。',
  'workbench.editors.mqtt.userProps.v311': 'CONNECT 用户属性是 MQTT 5.0 特性——此请求面向 3.1.1。',
  'workbench.editors.mqtt.userProps.keyPlaceholder': '属性',
  'workbench.editors.mqtt.userProps.valuePlaceholder': '值',
  'workbench.editors.mqtt.will.hint':
    '随 CONNECT 向代理注册；若会话在没有干净断开的情况下中断，代理会代为发布。主题为空表示没有遗嘱。',
  'workbench.editors.mqtt.will.topicPlaceholder': '遗嘱主题，例如 clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval，秒——MQTT 5.0。',
  'workbench.editors.mqtt.will.delayPlaceholder': '延迟（秒）',
  'workbench.editors.mqtt.will.payloadPlaceholder': '编写遗嘱载荷…',
  'workbench.editors.mqtt.spec.selectLabel': 'AsyncAPI 规范',
  'workbench.editors.mqtt.spec.selectPlaceholder': '关联一个 AsyncAPI 规范',
  'workbench.editors.mqtt.spec.summary': '{servers} 个服务器 · {channels} 个频道 · {operations} 个操作',
  'workbench.editors.mqtt.spec.parseFailure': '规范解析失败：{message}',
  'workbench.editors.mqtt.spec.issues': '{count} 个规范问题',
  'workbench.editors.mqtt.specFooter.using': '正在使用 {name}',
  'workbench.editors.mqtt.specFooter.none': '未关联 AsyncAPI 规范',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'CONNECT 携带的标识符。留空则每次连接生成新的；恢复代理会话需要稳定的 ID。',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': '每次连接自动生成',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    '连接时开始全新的代理会话。关闭可恢复上一会话的订阅与排队消息——这同样需要稳定的 Client ID。',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval（秒）',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    '断开后代理保留会话的时长。开启 Clean Start 时，仅当后续连接恢复该会话才生效。',
  'workbench.editors.mqtt.settings.v311Knob': 'MQTT 5.0 特性——此请求面向 3.1.1。',
  'workbench.editors.mqtt.settings.zeroDefault': '0',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive（秒）',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    '会话向代理承诺的心跳间隔——客户端应答并发出 PINGREQ。留空使用 60 秒；0 关闭心跳。',
  'workbench.editors.mqtt.settings.timeoutLabel': '连接超时（ms）',
  'workbench.editors.mqtt.settings.timeoutHelp': '仅限连接拨号的墙钟上限——已打开的会话没有上限。留空使用应用默认值。',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '默认',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp': '同时向此客户端在途的 QoS 1/2 消息数量上限。留空交由代理决定。',
  'workbench.editors.mqtt.settings.brokerDefault': '代理默认',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size（字节）',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    '此客户端接受的最大数据包——超过的包会被代理丢弃。留空表示不设上限。',
  'workbench.editors.mqtt.settings.noLimit': '不限制',
  'workbench.editors.mqtt.settings.sslVerifyLabel': 'SSL 证书验证',
  'workbench.editors.mqtt.settings.sslVerifyHelp':
    '对 mqtts/wss 会话按系统根证书验证代理证书。开发中的自签名代理可关闭。',
  'workbench.editors.mqtt.toast.deletedOtherTab': '此 MQTT 请求已在其他标签页中被删除。',
  'workbench.editors.mqtt.toast.updateFailed': '保存 MQTT 请求失败',
  'workbench.editors.mqtt.toast.updateFailedDetail': '保存 MQTT 请求失败：{message}',
} as const satisfies Catalog;
