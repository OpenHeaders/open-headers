/**
 * DevTools panel — inspector stream tabs — Simplified Chinese. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, Base64 /
 * Hex / UTF-8 modes, `keepalive` and `socket` stay parity-raw. Mints:
 * 线路 = wire (crossed the wire = 经过线路); 帧 / 负载 carried; 丢弃 =
 * dropped; 注入 = injected; 合成 = synthetic; 送达 = delivered; 推断 =
 * inferred vs 推导 = derived (two referents); 捕获层 = capture plane;
 * 包装器 = wrapper (established zh JS term — de rides raw); 端点 =
 * endpoint; 负载查看器 = payload viewer; 触发点 = fire dot (琥珀色
 * 触发点); 从此帧/事件预填充 = seeded from; 服务器发送事件 = SSE
 * spelled out (MDN vocabulary); 这一侧 = "this side" of the split.
 * Quoted OH labels copy this file's mints in “”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': '全部清除',
  'panel.inspector.streams.directionFilterTitle': '按方向筛选',
  'panel.inspector.streams.directionAll': '全部',
  'panel.inspector.streams.directionSend': '发送',
  'panel.inspector.streams.directionReceive': '接收',
  'panel.inspector.streams.filterAria': '筛选流消息',
  'panel.inspector.streams.sortByTitle': '按 {column} 排序',
  'panel.inspector.streams.resizeColumnAria': '调整 {column} 列宽',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': '视图',
  'panel.inspector.streams.view.layout': '布局',
  'panel.inspector.streams.view.layoutCompact': '紧凑',
  'panel.inspector.streams.view.layoutWide': '宽',
  'panel.inspector.streams.view.split': '拆分',
  'panel.inspector.streams.view.splitSideBySide': '并排',
  'panel.inspector.streams.view.splitStacked': '堆叠',
  'panel.inspector.streams.view.splitDisabledTitle': '启用负载预览后才能拆分窗格',
  'panel.inspector.streams.view.showPreview': '显示负载预览',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': '规则已应用——该帧的负载与规则的负载一致',
  'panel.inspector.streams.fire.inferredFrame': '规则已匹配——无法验证是否已应用于此帧',
  'panel.inspector.streams.fire.injectedFrame': '规则已应用——此帧由规则注入',
  'panel.inspector.streams.fire.replacedFrame': '规则已应用——规则替换了此帧',
  'panel.inspector.streams.fire.droppedSendFrame': '规则丢弃了此帧——它从未被发送到服务器',
  'panel.inspector.streams.fire.droppedRecvFrame': '规则丢弃了此帧——页面从未收到它',
  'panel.inspector.streams.fire.appliedEvent': '规则已应用——该事件的负载与规则的负载一致',
  'panel.inspector.streams.fire.inferredEvent': '规则已匹配——无法验证是否已应用于此事件',
  'panel.inspector.streams.fire.injectedEvent': '规则已应用——此事件由规则注入',
  'panel.inspector.streams.fire.replacedEvent': '规则已应用——规则替换了此事件',
  'panel.inspector.streams.fire.droppedEvent': '规则丢弃了此事件——页面从未收到它',
  'panel.inspector.streams.row.copied': '已复制',
  'panel.inspector.streams.row.copyPayload': '复制负载',
  'panel.inspector.streams.row.editRule': '编辑规则',
  'panel.inspector.streams.row.override': '覆盖',
  'panel.inspector.streams.row.droppedSendCell': '已丢弃——从未发送到服务器',
  'panel.inspector.streams.row.droppedRecvCell': '已丢弃——从未送达页面',
  'panel.inspector.streams.row.notCaptured': '未捕获',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': '筛选消息',
  'panel.inspector.messages.listAria': 'WebSocket 消息',
  'panel.inspector.messages.overrideMessage': '覆盖消息',
  'panel.inspector.messages.overrideMessageTitle': '为此连接创建一条消息规则',
  'panel.inspector.messages.editRuleTitle': '编辑作用于此帧的消息规则',
  'panel.inspector.messages.createRuleTitle': '从此帧预填充创建一条消息规则',
  'panel.inspector.messages.syntheticDroppedTitle': '合成行——页面生成了此帧；规则在发送前将其丢弃',
  'panel.inspector.messages.syntheticInjectedTitle': '合成帧——由页面内的规则注入；从未经过线路',
  'panel.inspector.messages.emptyNoDebug': '仅在为此标签页启用调试模式后才能看到 WebSocket 帧。',
  'panel.inspector.messages.emptySynthetic':
    '没有帧经过线路——一条注入规则在此触发，注入的帧在页面内合成送达，网络捕获不可见。',
  'panel.inspector.messages.emptyNone': '尚未交换任何 WebSocket 帧。',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '已丢弃 {count} 个较早的帧。' });
    return `正在显示最新的 ${String(shown)} 个帧——${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': '筛选事件',
  'panel.inspector.sse.listAria': '服务器发送事件',
  'panel.inspector.sse.overrideEvent': '覆盖事件',
  'panel.inspector.sse.overrideEventTitle': '为此流创建一条消息规则',
  'panel.inspector.sse.editRuleTitle': '编辑作用于此事件的消息规则',
  'panel.inspector.sse.createRuleTitle': '从此事件预填充创建一条消息规则',
  'panel.inspector.sse.syntheticTitle': '合成事件——由页面内的规则注入；从未经过线路',
  'panel.inspector.sse.emptySynthetic':
    '没有事件经过线路——一条注入规则在此触发，注入的事件在页面内合成送达，网络捕获不可见。',
  'panel.inspector.sse.emptyUnparseable': '响应体中没有可解析的 SSE 事件。',
  'panel.inspector.sse.emptyNoDebug':
    '未捕获任何事件。没有调试模式时，服务器发送的流只有在请求结束后才会具体化；长时间运行的流可能要等连接关闭后才会显示在这里。',
  'panel.inspector.sse.emptyNone': '尚未收到任何事件。',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '已丢弃 {count} 个较早的事件。' });
    return `正在显示最新的 ${String(shown)} 个事件——${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': '未选择消息',
  'panel.inspector.streams.preview.noMessageHint': '选择一条消息以浏览其内容。',
  'panel.inspector.streams.preview.noEventTitle': '未选择事件',
  'panel.inspector.streams.preview.noEventHint': '选择一个事件以浏览其内容。',
  'panel.inspector.streams.preview.raw': '原始',
  'panel.inspector.streams.preview.copy': '复制',
  'panel.inspector.streams.preview.copied': '已复制',
  'panel.inspector.streams.preview.copyTitle': '复制到剪贴板',
  'panel.inspector.streams.preview.decodeFailed': '无法解码二进制负载。',
  'panel.inspector.messages.preview.droppedSendPane': '规则丢弃了此帧——页面生成了它，但它从未被发送到服务器。',
  'panel.inspector.messages.preview.droppedRecvPane': '规则丢弃了此帧——它到达了浏览器，但从未送达页面。',
  'panel.inspector.messages.preview.originalNotCaptured': '页面生成的帧未被捕获——只有修改后的帧经过了线路。',
  'panel.inspector.messages.preview.syntheticNote': '合成帧——由页面内的规则注入；它从未经过线路。',
  'panel.inspector.sse.preview.droppedPane': '规则丢弃了此事件——它到达了浏览器，但从未送达页面。',
  'panel.inspector.sse.preview.syntheticNote': '合成事件——由页面内的规则注入；它从未经过线路。',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': '推导所得，并非捕获',
  'panel.inspector.messages.inferredModified.summary': '这一侧显示规则的替换负载——捕获层只见过线路上的帧。',
  'panel.inspector.messages.inferredModified.description':
    '线路记录的是原始帧；修改发生在捕获之后的页面内。此帧确实被替换这一点，是根据规则的帧选择器推断的，与琥珀色触发点对应。',
  'panel.inspector.messages.inferredDropped.title': '已丢弃（推断）',
  'panel.inspector.messages.inferredDropped.summary': '线路记录了此帧，但规则在页面内阻止了它的送达。',
  'panel.inspector.messages.inferredDropped.description':
    '丢弃发生在捕获之后，因此没有任何机制能记录未送达本身。此帧确实被丢弃这一点，是根据规则的帧选择器推断的，与琥珀色触发点对应。',
  'panel.inspector.sse.inferredModified.title': '推导所得，并非捕获',
  'panel.inspector.sse.inferredModified.summary': '这一侧显示规则的替换负载——捕获层只见过线路上的事件。',
  'panel.inspector.sse.inferredModified.description':
    '线路记录的是原始事件；修改发生在捕获之后的页面内。此事件确实被替换这一点，是根据规则的事件选择器推断的，与琥珀色触发点对应。',
  'panel.inspector.sse.inferredDropped.title': '已丢弃（推断）',
  'panel.inspector.sse.inferredDropped.summary': '线路记录了此事件，但规则在页面内阻止了它的送达。',
  'panel.inspector.sse.inferredDropped.description':
    '丢弃发生在捕获之后，因此没有任何机制能记录未送达本身。此事件确实被丢弃这一点，是根据规则的事件选择器推断的，与琥珀色触发点对应。',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': '示例帧',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': '个字符 ·',
  'panel.inspector.messages.columnInfo.data.summary': '帧负载——文本帧逐字显示其内容。',
  'panel.inspector.messages.columnInfo.data.description':
    '选择一行以打开负载查看器：文本可解析时显示 JSON 树，二进制帧则显示 Base64 / Hex / UTF-8 查看器。',
  'panel.inspector.messages.columnInfo.data.insteadHeading': '代替负载显示的内容',
  'panel.inspector.messages.columnInfo.data.binaryDesc': '二进制帧——字节位于负载查看器中，而不是单元格里。',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': '两端端点之间交换的 keepalive 控制帧。',
  'panel.inspector.messages.columnInfo.data.closeDesc': '结束该 socket 的关闭握手。',
  'panel.inspector.messages.columnInfo.length.summary':
    '负载大小——文本帧为纯字符数，二进制帧为格式化的字节数（例如 `4 B`）。',
  'panel.inspector.messages.columnInfo.time.summary': '帧经过线路的实际时刻。',
  'panel.inspector.messages.columnInfo.time.description':
    '唯一可排序的列。升序即线路顺序；同一毫秒内的帧无论如何都保持到达顺序。',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': '帧的传输方向。',
  'panel.inspector.messages.directionInfo.arrowsHeading': '箭头',
  'panel.inspector.messages.directionInfo.sentDesc': '已发送——页面将此帧推送到服务器。',
  'panel.inspector.messages.directionInfo.receivedDesc': '已接收——服务器将此帧推送到页面。',
  'panel.inspector.messages.directionInfo.errorDesc': '错误——传输故障终止了流；该行显示为红色。',
  'panel.inspector.streams.fireRail.title': '规则触发',
  'panel.inspector.streams.fireRail.dotColorsHeading': '圆点颜色',
  'panel.inspector.messages.fireRail.summary':
    '每个被 WebSocket 消息规则作用过的帧都有一个圆点标记。帧不携带规则归属，因此圆点是推导出来的：取此请求已触发的消息规则，将每条规则的帧选择器重新在该帧上运行。',
  'panel.inspector.messages.fireRail.appliedDesc': '已应用——该帧的负载等于规则的替换或注入负载。',
  'panel.inspector.messages.fireRail.inferredDesc':
    '推断——规则的方向和消息筛选选中了此帧，但无法验证是否已应用（修改后的帧不再包含筛选所匹配的负载）。',
  'panel.inspector.messages.fireRail.description':
    '被丢弃的传出帧从未经过线路，因此完全没有对应的行。被丢弃的传入帧先在线路上被捕获——它的行会保留，并标记为“已丢弃——从未送达页面”。',
  'panel.inspector.sse.columnInfo.exampleCaption': '示例事件',
  'panel.inspector.sse.columnInfo.id.summary': '事件的 `id:` 字段——服务器发放的重连游标。',
  'panel.inspector.sse.columnInfo.id.description':
    '服务器不发送 id 时为空。重连时浏览器会把最后一个 id 作为 `Last-Event-ID` 回传，服务器便可从中断处恢复流。',
  'panel.inspector.sse.columnInfo.type.summary': '事件的 `event:` 字段——默认事件为 `message`。',
  'panel.inspector.sse.columnInfo.type.description':
    '页面代码按类型订阅：`onmessage` 只能看到默认事件；具名事件需要针对该确切类型的 `addEventListener`。',
  'panel.inspector.sse.columnInfo.data.summary': '事件负载——始终是文本；多行 `data:` 字段合并后到达。',
  'panel.inspector.sse.columnInfo.data.description':
    '选择一行以打开负载查看器：文本可解析时显示 JSON 树，否则逐字显示。',
  'panel.inspector.sse.columnInfo.time.summary': '事件到达的实际时刻。',
  'panel.inspector.sse.columnInfo.time.description':
    '可排序，默认升序。从已完成的响应体中解析出的事件没有时间——SSE 线路格式中没有时间字段——因此其单元格保持为空。',
  'panel.inspector.sse.fireRail.summary':
    '每个被 SSE 消息规则作用过的事件都有一个圆点标记。包装器记录的捕获是确证；没有时圆点是推导出来的：取此请求已触发的 SSE 规则，将每条规则的事件选择器重新在该事件上运行。',
  'panel.inspector.sse.fireRail.appliedDesc': '已应用——包装器记录了对此确切事件的操作，或注入的负载相匹配。',
  'panel.inspector.sse.fireRail.inferredDesc':
    '推断——规则的事件名和数据筛选选中了此事件，但仅凭线路无法验证是否已应用。',
  'panel.inspector.sse.fireRail.description':
    '服务器发送事件只沿服务器 → 页面方向传输，且线路在规则作用之前就记录它们：被丢弃的事件保留其行，并标记为“已丢弃——从未送达页面”；注入的事件从未经过线路，显示为合成行。',
} as const satisfies Catalog;
