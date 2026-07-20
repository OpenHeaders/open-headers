/**
 * DevTools panel — request inspector shell + detail tabs — Simplified
 * Chinese. Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw
 * by design: async stack labels (JS vocabulary), wire-shaped hover
 * titles, encoding names (Base64 / UTF-8), the detail section tab
 * nouns (Headers / Payload / … — host-panel parity vocabulary, the
 * panel-docs raw-quote precedent), Diff, and wire tokens (HEAD /
 * CONNECT / 204 No Content / Server-Timing). Mints: 发起者 =
 * initiator (prose referent — the tab noun rides raw); 级联 =
 * cascade; 调用栈 = call stack (堆栈跟踪 stays the fixed stack-trace
 * compound); 帧 here = stack frame (context-partitioned with the
 * WebSocket referent in panel-inspector-streams); 涂黑 = redact;
 * 格式化 = pretty print; 计时 = timing prose; 队头阻塞 =
 * head-of-line blocking; 拆分 = split carried from streams; Hex
 * 查看器 rides the 查看器 family; Mock rides raw (tag precedent).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  // The select prompt flanks an inline Network-panel glyph, so it keys
  // as prefix + suffix fragments.
  'panel.inspector.detailEmpty.requestGone': '请求已不可用（已清除或已离开页面）',
  'panel.inspector.detailEmpty.selectPrefix': '在',
  'panel.inspector.detailEmpty.selectSuffix': 'Network 面板中选择一个请求进行检查',
  'panel.inspector.detailEmpty.noSelection': '选择一个已捕获的请求进行检查',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  // Raw by design: method badges, status codes, tab labels (URLs, storage
  // keys, cookie/cache identities), the IDB/SS/LS/CS chips, the wire-shaped
  // pill hover title, and the ▾ / ▼ / ▶ / × glyphs beside keyed values.
  'panel.inspector.tabBar.closeTab': '关闭标签页',
  'panel.inspector.tabBar.unsavedChanges': '未保存的更改',
  'panel.inspector.tabBar.searchTabs': '搜索标签页',
  'panel.inspector.tabBar.searchPlaceholder': '搜索标签页…',
  'panel.inspector.tabBar.noOpenTabs': '没有打开的标签页',
  'panel.inspector.tabBar.noOpenTabsMatch': '没有匹配搜索的已打开标签页',
  'panel.inspector.tabBar.noClosedTabsMatch': '没有匹配搜索的已关闭标签页',
  'panel.inspector.tabBar.recentlyClosed': '最近关闭（{count}）',
  'panel.inspector.tabBar.recentlyClosedFiltered': '最近关闭（{matched}/{total}）',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': '保存更改？',
  'panel.inspector.tabBar.closeGuard.unsavedBody': '有未保存的更改。保存这些更改以免丢失你的工作。',
  'panel.inspector.tabBar.closeGuard.dontSave': '不保存',
  'panel.inspector.tabBar.closeGuard.cancel': '取消',
  'panel.inspector.tabBar.closeGuard.save': '保存更改',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': '关闭',
  'panel.inspector.tabMenu.closeOther': '关闭其他标签页',
  'panel.inspector.tabMenu.closeAll': '关闭所有标签页',
  'panel.inspector.tabMenu.closeToLeft': '关闭左侧标签页',
  'panel.inspector.tabMenu.closeToRight': '关闭右侧标签页',
  'panel.inspector.tabMenu.splitAndMove': '拆分并移动',
  'panel.inspector.tabMenu.right': '右',
  'panel.inspector.tabMenu.left': '左',
  'panel.inspector.tabMenu.down': '下',
  'panel.inspector.tabMenu.up': '上',
  'panel.inspector.tabMenu.moveToOppositeGroup': '移到对面的分组',
  'panel.inspector.tabMenu.changeSplitterOrientation': '切换分隔条方向',
  'panel.inspector.tabMenu.unsplit': '取消拆分',
  'panel.inspector.tabMenu.unsplitAll': '取消所有拆分',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns; ride raw in zh-CN per the
  // panel-docs raw-quote precedent and the de/es siblings).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': '编辑覆盖',
  'panel.inspector.overrideCta.editOverrideTitle': '编辑生成此响应的规则——更改应用于未来的请求',
  'panel.inspector.overrideCta.overrideResponse': '覆盖响应',
  'panel.inspector.overrideCta.overrideResponseTitle': '创建一条规则，把此响应作为可编辑的 Mock 提供',
  'panel.inspector.overrideCta.editQueryParams': '编辑查询参数覆盖',
  'panel.inspector.overrideCta.editQueryParamsTitle': '编辑改写了这些查询参数的规则——更改应用于未来的请求',
  'panel.inspector.overrideCta.overrideQueryParams': '覆盖查询参数',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': '创建一条改写这些查询参数的规则',
  'panel.inspector.overrideCta.editRequestBody': '编辑请求体覆盖',
  'panel.inspector.overrideCta.editRequestBodyTitle': '编辑替换了此请求体的规则——更改应用于未来的请求',
  'panel.inspector.overrideCta.overrideRequestBody': '覆盖请求体',
  'panel.inspector.overrideCta.overrideRequestBodyTitle': '创建一条规则，用可编辑的静态请求体替换此请求体',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': '完整响应',
  'panel.inspector.dualView.fullRequest': '完整请求',
  'panel.inspector.dualView.swapSides': '交换两侧',
  'panel.inspector.dualView.hideUnchanged': '隐藏未更改部分',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': '原始 · 服务器 → 页面',
  'panel.inspector.paneCaption.responseModified': '已修改 · 服务器 → Open Headers → 页面',
  'panel.inspector.paneCaption.requestOriginal': '原始 · 页面 → 服务器',
  'panel.inspector.paneCaption.requestModified': '已修改 · 页面 → Open Headers → 服务器',
  'panel.inspector.paneCaption.wsRecvDropped': '已丢弃 · 从未送达页面',
  'panel.inspector.paneCaption.wsSendDropped': '已丢弃 · 从未发送到服务器',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': '没有响应体',
  'panel.inspector.bodyState.noPreviewTitle': '没有可用的预览',
  'panel.inspector.bodyState.nothingToPreviewTitle': '没有可预览的内容',
  'panel.inspector.bodyState.noResponseDetail': '此请求没有可用的响应数据',
  'panel.inspector.bodyState.failedTitle': '加载响应数据失败',
  'panel.inspector.bodyState.emptyTitle': '（响应体为空）',
  'panel.inspector.bodyState.emptyDetail': '服务器返回了空的响应体。',
  'panel.inspector.bodyState.binaryPayloadBytes': '二进制负载（{count} 字节）。',
  'panel.inspector.bodyState.notApplicable.preflight': '预检请求没有可用的内容',
  'panel.inspector.bodyState.notApplicable.head': 'HEAD 请求没有响应体',
  'panel.inspector.bodyState.notApplicable.connect': 'CONNECT 请求没有响应体',
  'panel.inspector.bodyState.notApplicable.status204': '无内容（204 No Content）',
  'panel.inspector.bodyState.notApplicable.status205': '无内容（205 Reset Content）',
  'panel.inspector.bodyState.notApplicable.status304': '未修改——响应体由浏览器缓存提供',
  'panel.inspector.bodyState.notApplicable.informational': '无内容（信息性响应）',
  'panel.inspector.bodyState.notApplicable.websocket': 'WebSocket 连接已升级——请查看 Messages 标签页',
  'panel.inspector.bodyState.unavailable.opaque': '响应体不可用——不透明的跨源响应',
  'panel.inspector.bodyState.unavailable.cache': '响应体不可用——DevTools 打开之前响应已由缓存提供',
  'panel.inspector.bodyState.unavailable.redirect': '此请求被重定向，因此没有可用的内容',
  'panel.inspector.bodyState.unavailable.unknown':
    '响应体未捕获。宿主未返回内容——响应以不缓冲的方式流式传输，或由缓存提供。',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': '此内容类型没有可用的预览。',
  'panel.inspector.preview.imageAlt': '响应预览',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': '格式化',
  'panel.inspector.viewer.revertTitle': '恢复为声明的 Content-Type',
  'panel.inspector.viewer.parsedAsRevert': '已解析为 {format} · 恢复',
  'panel.inspector.viewer.looksLikeParse': '疑似 {format} · 解析',
  'panel.inspector.viewer.looksLikeTitle': 'Content-Type 似乎不对——响应体可按 {format} 解析。点击以重新解释。',
  'panel.inspector.viewer.cursorInfo': '第 {line} 行，第 {col} 列',
  'panel.inspector.viewer.lineCount': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 行' }),
  'panel.inspector.viewer.hexViewer': 'Hex 查看器',
  'panel.inspector.viewer.find': '查找',
  'panel.inspector.viewer.findTitle': '查找（{chord}）',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': '查询字符串参数',
  'panel.inspector.payload.requestBody': '请求体（{mime}）',
  'panel.inspector.payload.viewSource': '查看源代码',
  'panel.inspector.payload.viewParsed': '查看解析结果',
  'panel.inspector.payload.viewUrlEncoded': '查看 URL 编码形式',

  // ── Raw Data tab (inspector detail) — export-snippet band + raw HAR
  // band. Raw by design: the generated snippet text itself (paste-into-
  // terminal material), HAR / JSON / .har / HAR 1.2 format nouns riding
  // inside keyed values, and the technical tokens inside the format
  // option labels (cURL, bash, fetch, Node, Python requests,
  // Invoke-WebRequest). ────────────────────────────────────────────────
  'panel.inspector.rawData.exportSnippet': '导出代码片段',
  'panel.inspector.rawData.formatLabel': '格式',
  'panel.inspector.rawData.copy': '复制',
  'panel.inspector.rawData.copied': '已复制',
  'panel.inspector.rawData.rawHar': '原始 HAR（JSON）',
  'panel.inspector.rawData.downloadHar': '下载 .har',
  'panel.inspector.rawData.noRequestData': '（尚无请求数据）',
  'panel.inspector.rawData.view.label': '视图',
  'panel.inspector.rawData.view.includeHeaders': '包含请求标头',
  'panel.inspector.rawData.view.includeBody': '包含请求体',
  'panel.inspector.rawData.view.redactSecrets': '涂黑机密',
  'panel.inspector.rawData.view.ruleModifiedHeading': '规则修改过的标头',
  'panel.inspector.rawData.view.postRule': '规则之后（线路上）',
  'panel.inspector.rawData.view.original': '原始（规则之前）',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript——fetch（浏览器）',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript——fetch（Node）',
  'panel.inspector.rawData.format.pythonRequests': 'Python——requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell——Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP——原始消息',
  'panel.inspector.rawData.format.har': 'HAR——单个条目',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': '格式',
  'panel.inspector.rawData.harInfo.summary': '可移植的 HTTP 存档——一个请求的 JSON 快照。',
  'panel.inspector.rawData.harInfo.description':
    '保存后可附加到 bug 报告、分享给队友，或导入到其他能读取 HAR 文件的工具中。',

  // ── Initiator tab (inspector detail) — call stack, upstream chain,
  // downstream tree, cascade stats + insights. Raw by design: the
  // async-boundary section labels (`await in fn`, `Promise resolved
  // (async)` — JS vocabulary that also feeds the copied stack text),
  // `(anonymous)`, the `@` locator glyph, wire initiator-type values
  // (parser / script / other), filter grammar tokens riding inside the
  // keyed placeholder, the ▼ / ▶ toggles, and byte / ms figures. ──────
  'panel.inspector.initiator.noData': '没有可用的发起者数据。',
  'panel.inspector.initiator.typeLabel': '类型：',
  'panel.inspector.initiator.stack.heading': '请求的调用栈',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个帧' }),
  'panel.inspector.initiator.stack.resolvedCount': '已解析 {count} 个',
  'panel.inspector.initiator.stack.resolvedTitle': '函数名已通过 source map 解析',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), { other: '显示 {count} 个隐藏的帧' }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), { other: '隐藏 {count} 个噪声帧' }),
  'panel.inspector.initiator.stack.noiseTitle': '隐藏压缩混淆 bundle 中的匿名帧',
  'panel.inspector.initiator.stack.copyTitle': '以文本形式复制调用栈',
  'panel.inspector.initiator.stack.copy': '复制',
  'panel.inspector.initiator.stack.copied': '已复制',
  'panel.inspector.initiator.stack.filterPlaceholder': '筛选帧（函数名或 URL）…',
  'panel.inspector.initiator.stack.filterAria': '筛选调用栈中的帧',
  'panel.inspector.initiator.stack.noMatch': '没有匹配的帧。',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '{count} 个帧' });
    return `正在显示 ${String(shown)} 个，共 ${total}`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '（已隐藏 {count} 个）',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'source map 名称：{name}',
  'panel.inspector.initiator.stack.originalTitle': '{url}（原始：{source}）',
  'panel.inspector.initiator.moreFilters.label': '更多筛选',
  'panel.inspector.initiator.moreFilters.failuresOnly': '仅失败的',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': '仅第三方',
  'panel.inspector.initiator.view.label': '视图',
  'panel.inspector.initiator.view.sort': '排序',
  'panel.inspector.initiator.view.sortInitiator': '发起者顺序',
  'panel.inspector.initiator.view.sortChronological': '按时间顺序',
  'panel.inspector.initiator.view.sortLargest': '最大子树',
  'panel.inspector.initiator.view.showSuggestions': '显示建议',
  'panel.inspector.initiator.filterPlaceholder':
    '筛选——文本、is:failed、is:third-party、type:js、status:404、size:>50kb',
  'panel.inspector.initiator.filterAria': '筛选发起者链',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个匹配' }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': '请求发起者链',
  'panel.inspector.initiator.chainTree': '请求发起者链',
  'panel.inspector.initiator.collapse': '折叠',
  'panel.inspector.initiator.expand': '展开',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { other: '个请求' }),
  'panel.inspector.initiator.cascade.transferred': '已传输',
  'panel.inspector.initiator.cascade.cumulative': '累计',
  'panel.inspector.initiator.cascade.failed': '失败',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': '发起者类型',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP 状态',
  'panel.inspector.initiator.chip.requestFailedTitle': '请求失败',
  'panel.inspector.initiator.chip.failed': '失败',
  'panel.inspector.initiator.chip.transferredTitle': '已传输',
  'panel.inspector.initiator.chip.durationTitle': '持续时间',
  'panel.inspector.initiator.chip.thirdPartyTitle': '第三方源',
  'panel.inspector.initiator.chip.thirdParty': '第三方',
  'panel.inspector.initiator.chip.subtreeTitle': '子树权重（后代 · 字节）',
  'panel.inspector.initiator.chip.subtree': '+{count} 个请求 · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), { other: '此级联中有 {count} 个失败的请求。' }),
  'panel.inspector.initiator.insights.failedHint': '检查广告拦截器、CSP 规则和 CORS 配置。',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), { other: '加载了 {count} 个请求' });
    return `${String(host)} ${loaded}（${String(bytes)}）——占级联权重的 ${String(percent)}%。`;
  },
  'panel.inspector.initiator.insights.hostHint': '此级联中最大的单一主机。可能的话自行托管或延迟加载。',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '级联字节中有 {percent}% 来自第三方。',
  'panel.inspector.initiator.insights.thirdPartyHint': '削减、延迟或自行托管非必需的第三方资源。',

  // ── Timing tab (inspector detail) — the tab's OWN copy. Raw by
  // design (S34 parity-vocab lock): the eight rung names everywhere
  // (insight subjects, the open `Stalled:` step), the Server Timing
  // section name (header vocabulary), cache-source words (memory cache
  // / disk cache / service worker / miss — Size-column parity, and the
  // repeat section's cache-breakdown line with them), ms / s / B/s
  // figures on the Chrome scale, and protocol / priority / IP values. ─
  'panel.inspector.timing.noData': '没有可用的计时数据。',
  'panel.inspector.timing.view.label': '视图',
  'panel.inspector.timing.view.showSuggestions': '显示建议',
  'panel.inspector.timing.view.showContextStrip': '显示上下文条',
  'panel.inspector.timing.view.showPhaseBreakdown': '显示阶段明细',
  'panel.inspector.timing.view.showTimingBar': '显示计时条',
  'panel.inspector.timing.view.showServerTiming': '显示 Server-Timing',
  'panel.inspector.timing.view.showRepeats': '显示会话内的重复请求',
  'panel.inspector.timing.view.showTransferRate': '显示传输速率',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': '主导了此请求——{ms}（占总时长的 {percent}%）。',
  'panel.inspector.timing.insight.unusuallyHighTail': '异常偏高——{ms}。',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': '请求调度器暂缓了此请求',
  'panel.inspector.timing.phase.queueing.hint': '过多并发请求争夺槽位，或优先级较低。',
  'panel.inspector.timing.phase.stalled.what': '正在等待可用的连接',
  'panel.inspector.timing.phase.stalled.hint': '连接池上限、代理协商，或 HTTP/1.1 队头阻塞。',
  'panel.inspector.timing.phase.dns.what': 'DNS 查询',
  'panel.inspector.timing.phase.dns.hint': '只影响对此域名的第一个请求。可考虑 DNS 预取。',
  'panel.inspector.timing.phase.connect.what': '与服务器的 TCP 握手',
  'panel.inspector.timing.phase.connect.hint': '新连接——keep-alive 或 HTTP/2/3 多路复用可在多个请求间复用同一连接。',
  'panel.inspector.timing.phase.ssl.what': 'TLS 握手',
  'panel.inspector.timing.phase.ssl.hint': '可通过会话恢复 / 0-RTT（HTTP/3）缩短。',
  'panel.inspector.timing.phase.send.what': '正在上传请求体',
  'panel.inspector.timing.phase.send.hint': '请求体较大或上行较慢——通常只在 POST/PUT 上可见。',
  'panel.inspector.timing.phase.wait.what': '服务器首字节时间',
  'panel.inspector.timing.phase.wait.hint': '后端处理耗时。可在 Server-Timing 或数据库查询日志中查找后端计时。',
  'panel.inspector.timing.phase.receive.what': '正在下载响应负载',
  'panel.inspector.timing.phase.receive.hint': '负载大小或 CDN 吞吐量——检查有效传输速率。',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': '协议',
  'panel.inspector.timing.chip.connection': '连接',
  'panel.inspector.timing.chip.cache': '缓存',
  'panel.inspector.timing.chip.priority': '优先级',
  'panel.inspector.timing.chip.started': '开始时间',
  'panel.inspector.timing.chip.serverIp': '服务器 IP',
  'panel.inspector.timing.chip.connectionReused': '复用',
  'panel.inspector.timing.chip.connectionNew': '新建',
  'panel.inspector.timing.chip.openedBy': '由 {url} 打开',
  'panel.inspector.timing.totalTime': '总时长',
  'panel.inspector.timing.totalWhere': '（入队 → 结束）',
  'panel.inspector.timing.caution': '注意：请求尚未完成！',
  'panel.inspector.timing.queuedAt': '入队于 {offset}',
  'panel.inspector.timing.startedAt': '开始于 {offset}',
  'panel.inspector.timing.inProgress': '进行中…',
  'panel.inspector.timing.noDuration': '无时长',
  'panel.inspector.timing.transferRate.heading': '传输速率',
  'panel.inspector.timing.transferRate.contentDownloaded': '已下载内容：',
  'panel.inspector.timing.transferRate.effectiveRate': '有效速率：',
  'panel.inspector.timing.transferRate.amount': '{size}，用时 {duration}',
  'panel.inspector.timing.repeats.heading': '本会话内的重复请求',
  'panel.inspector.timing.repeats.hitCount': 'URL 命中次数：',
  'panel.inspector.timing.repeats.fastestMedianSlowest': '最快 / 中位 / 最慢：',
  'panel.inspector.timing.repeats.thisRequest': '此请求：',
  'panel.inspector.timing.repeats.slowestTag': '（最慢）',
  'panel.inspector.timing.repeats.fastestTag': '（最快）',
  'panel.inspector.timing.repeats.cacheBreakdown': '缓存明细：',
  'panel.inspector.timing.repeats.url': 'URL：',
} as const satisfies Catalog;
