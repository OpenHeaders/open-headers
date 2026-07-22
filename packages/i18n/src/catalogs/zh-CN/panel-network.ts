/**
 * DevTools panel — traffic table plane — Simplified Chinese. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, `n/a`, and every µs/ms/s figure. Mints: 瀑布 =
 * waterfall (prose — the column name stays raw); 队列 = queue; 入队 =
 * queued; 未计入间隙 = untracked gaps; 热 socket = warm socket;
 * 关键时刻 = key moments; band names 调度 / 连接建立 / 传输; 合成行 =
 * synthesized row (合成 carried); 捕获保真度间隙 = capture-fidelity
 * gap; 层级 = sort level; 平局判定 = tiebreak; 脱敏 = sanitized;
 * 标注 = row annotation (rail) vs 注释 unused; 相矛盾 = contradicted;
 * 未到达 = the rung state with 未及此点 = the instant-tick referent
 * (separate referents); 调试模式滞留 = debug-mode hold.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus (station: traffic
  // menus) ─────────────────────────────────────────────────────────────
  // Raw by design (network-table parity vocabulary): the column names
  // (Name / Status / Type / … / Waterfall) everywhere they appear —
  // header cells, the column-visibility menu rows, the nested-sort
  // builder options, the closed-state sort subtitles — and the Waterfall
  // metric names (Start time / Response time / End time / Total duration
  // / Latency) plus their header tags (ST / RT / ET / TD / L). The menu
  // chrome AROUND them localizes; the vocabulary itself does not.
  'panel.network.filterSyntaxHelp': '筛选语法帮助',
  'panel.network.aboutTypeFilters': '关于请求类型筛选',
  'panel.network.aboutSorting': '关于排序',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': '由该源的 Service Worker 发出的请求',
  'panel.network.cell.jumpToPreflight': '跳转到预检请求',
  'panel.network.cell.selectPreflightInitiator': '选择发起此预检的请求',
  'panel.network.cell.pendingTitle': '请求尚未完成',
  'panel.network.cell.pending': '待处理',
  'panel.network.gridAria': '网络请求',
  'panel.network.noMatches': '没有匹配的请求。',
  'panel.network.reloadPage': '重新加载页面',
  'panel.network.startRecording': '开始录制',

  // View ▾ menu
  'panel.network.view.label': '视图',
  'panel.network.view.layout': '布局',
  'panel.network.view.layoutCompact': '紧凑',
  'panel.network.view.layoutWide': '宽',
  'panel.network.view.valueNumber': '数值',
  'panel.network.view.showValue': '显示数值',
  'panel.network.view.valuesAlways': '始终',
  'panel.network.view.valuesHover': '悬停时',
  'panel.network.view.valuesOff': '关闭',
  'panel.network.view.valueFormat': '数值格式',
  'panel.network.view.formatRelative': '相对',
  'panel.network.view.formatTimestamp': '时间戳',
  'panel.network.view.timezone': '时区',
  'panel.network.view.tzLocal': '本地',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': '解释数值',
  'panel.network.view.explainValueTitle': '在悬停弹出框中，高亮组成总时长的行并显示它们的和。',
  'panel.network.view.popover': '弹出框',
  'panel.network.view.popoverTitle': '悬停计时明细的方向。“自动”按面板宽度选择——宽时水平，窄时垂直。',
  'panel.network.view.popoverAuto': '自动',
  'panel.network.view.popoverCompact': '紧凑',
  'panel.network.view.popoverWide': '宽',
  'panel.network.view.showFireDots': '显示规则触发圆点',

  // Sort ▾ menu
  'panel.network.sort.label': '排序',
  'panel.network.sort.heading': '排序方式',
  'panel.network.sort.byTime': '按时间排序。',
  'panel.network.sort.groupPriority': '优先级',
  'panel.network.sort.groupPriorityHint': '最需要你注意的排在前。',
  'panel.network.sort.groupGrouping': '分组',
  'panel.network.sort.groupGroupingHint': '按类别聚合请求。',
  'panel.network.sort.ascending': '升序',
  'panel.network.sort.descending': '降序',
  'panel.network.sort.customNested': '自定义（嵌套）',
  'panel.network.sort.customNestedIdle': '多键排序——逐列设置。',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个层级——打开以编辑。' }),
  'panel.network.sort.noLevelsYet': '尚无层级——打开构建器。',
  'panel.network.sort.builderTitle': '依次按以下条件排序',
  'panel.network.sort.builderEmpty': '尚无层级。在下方添加。',
  'panel.network.sort.asc': '升序',
  'panel.network.sort.desc': '降序',
  'panel.network.sort.removeLevel': '移除层级 {n}',
  'panel.network.sort.addLevel': '+ 添加层级',
  'panel.network.sort.finalTiebreak': '最终平局判定：开始时间',
  'panel.network.sort.active': '生效中',
  'panel.network.sort.apply': '应用',
  'panel.network.sort.columnClick': '自定义（点击列）',
  'panel.network.sort.columnClickIdle': '点击列标题即可按其排序。',
  'panel.network.sort.columnClickUse': '点击列标题以使用此模式',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': '失败优先',
  'panel.network.sortMode.failuresSubtitle': '失败 → 待处理 → 已重定向 → 成功 · 各组内按开始时间。',
  'panel.network.sortMode.slowest': '最慢优先',
  'panel.network.sortMode.slowestSubtitle': '时长最长的在前 · 平局时按开始时间保持瀑布顺序。',
  'panel.network.sortMode.largest': '最大优先',
  'panel.network.sortMode.largestSubtitle': '线路字节最多的在前 · 平局内按开始时间。',
  'panel.network.sortMode.browserPriority': '浏览器优先级',
  'panel.network.sortMode.browserPrioritySubtitle': '按浏览器报告的优先级从 Highest → Lowest · 各组内按开始时间。',
  'panel.network.sortMode.byType': '按资源类型',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · 各组内按开始时间。',
  'panel.network.sortMode.byDomain': '按域名',
  'panel.network.sortMode.byDomainSubtitle': '按主机名分组（A → Z）· 各域名内按开始时间。',
  'panel.network.sortMode.ruleModified': '规则修改过的优先',
  'panel.network.sortMode.ruleModifiedSubtitle': '已应用规则 → 推断 → 未触发 · 各组内按开始时间。',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': '请求开始的时刻。',
  'panel.network.sortMetric.responseTime': '第一个响应字节到达的时刻。',
  'panel.network.sortMetric.endTime': '请求完成的时刻。',
  'panel.network.sortMetric.duration': '耗时多久——条形零点对齐。',
  'panel.network.sortMetric.latency': '首字节时间——条形零点对齐。',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': '规则触发',
  'panel.network.railAnnotations': '标注',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': '在新标签页中打开',
  'panel.requestMenu.createApiRequest': '创建 API 请求',
  'panel.requestMenu.copy': '复制',
  'panel.requestMenu.copyUrl': '复制 URL',
  'panel.requestMenu.copyAsCurl': '复制为 cURL',
  'panel.requestMenu.copyAsFetch': '复制为 fetch',
  'panel.requestMenu.copyRequestHeaders': '复制请求标头',
  'panel.requestMenu.copyResponseHeaders': '复制响应标头',
  'panel.requestMenu.copyResponse': '复制响应',
  'panel.requestMenu.copyAsHar': '复制为 HAR',
  'panel.requestMenu.copyAsHarSanitized': '复制为 HAR（已脱敏）',
  'panel.requestMenu.copyAllUrls': '复制所有 URL',
  'panel.requestMenu.copyAllAsCurl': '全部复制为 cURL',
  'panel.requestMenu.copyAllAsHar': '全部复制为 HAR',
  'panel.requestMenu.copyAllAsHarSanitized': '全部复制为 HAR（已脱敏）',
  'panel.requestMenu.blockRequests': '拦截请求',
  'panel.requestMenu.blockUrl': '拦截此请求 URL',
  'panel.requestMenu.blockDomain': '拦截此请求域名',
  'panel.requestMenu.saveAs': '另存为…',
  'panel.requestMenu.saveThisAsHar': '将此请求保存为 HAR',
  'panel.requestMenu.saveThisAsHarSanitized': '将此请求保存为 HAR（已脱敏）',
  'panel.requestMenu.saveAllAsHar': '全部保存为 HAR',
  'panel.requestMenu.saveAllAsHarSanitized': '全部保存为 HAR（已脱敏）',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': '请求类型',
  'panel.network.typeInfo.summary': '把列表缩小到一种或多种请求类型。“All”显示全部；选择类型进行筛选，也可组合多个。',
  'panel.network.typeInfo.inlineHeading': '内联',
  'panel.network.typeInfo.fetchXhrDesc': 'API 调用——fetch() 和 XMLHttpRequest。',
  'panel.network.typeInfo.socketDesc': 'WebSocket 连接。',
  'panel.network.typeInfo.underMoreHeading': '位于 More 之下',
  'panel.network.typeInfo.docCssJsDesc': '文档、样式表和脚本。',
  'panel.network.typeInfo.fontImgMediaDesc': '字体、图片和音频 / 视频。',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Web 应用清单、WebAssembly 以及其他所有内容。',
  'panel.network.sortInfo.summary': '决定请求列表的排序方式。悬停某个分组以选择具体模式。',
  'panel.network.sortInfo.modesHeading': '模式',
  'panel.network.sortInfo.waterfallDesc': '按时间——开始、响应、结束、时长或延迟。',
  'panel.network.sortInfo.priorityDesc': '最需要注意的在前——失败、最慢、最大。',
  'panel.network.sortInfo.groupingDesc': '按类型、域名或规则修改状态聚合。',
  'panel.network.sortInfo.custom': '自定义',
  'panel.network.sortInfo.customDesc': '点击列标题，或构建多键嵌套排序。',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': '示例请求',
  'panel.network.colInfo.name.summary': '资源的文件名或最后一段路径——认出一行最快的方式。',
  'panel.network.colInfo.name.description': '行首图标编码资源类型；行提示和详情视图包含完整 URL、标头、负载和计时。',
  'panel.network.colInfo.path.summary': '主机之后的所有内容——URL 路径及其查询字符串。',
  'panel.network.colInfo.url.summary': '完整的请求 URL：协议、主机、路径和查询，从头到尾。',
  'panel.network.colInfo.requestNumber.summary': '按录制期间发现请求的顺序分配的稳定序号，从 1 开始。',
  'panel.network.colInfo.requestNumber.description': '重新排序时它绝不改变，因此也可用来回溯原始捕获顺序。',
  'panel.network.colInfo.method.summary': '请求使用的 HTTP 动词。',
  'panel.network.colInfo.method.commonVerbsHeading': '常见动词',
  'panel.network.colInfo.method.getDesc': '读取资源——无请求体，可安全重复。',
  'panel.network.colInfo.method.postDesc': '创建或提交——携带请求体。',
  'panel.network.colInfo.method.putPatchDesc': '替换或部分更新资源。',
  'panel.network.colInfo.method.deleteDesc': '移除资源。',
  'panel.network.colInfo.status.summary': 'HTTP 响应代码（例如 200、404），或在没有代码时显示的简短状态标签。',
  'panel.network.colInfo.status.description':
    '状态区间不按颜色编码。真正的失败——线路错误、任何 4xx/5xx 或 CORS 拒绝——会让整行变红；缓存命中或无状态的行会让单元格变灰。原因短语（例如 “Not Found”）显示在单元格提示中。',
  'panel.network.colInfo.status.codeRangesHeading': '代码区间',
  'panel.network.colInfo.status.s2xxDesc': '成功——请求已被接收并处理（例如 200 OK）。',
  'panel.network.colInfo.status.s3xxDesc': '重定向——沿 Location 标头前往下一个 URL。',
  'panel.network.colInfo.status.s4xxDesc': '客户端错误——请求格式有误、未获授权或未找到。',
  'panel.network.colInfo.status.s5xxDesc': '服务器错误——服务器未能完成一个有效的请求。',
  'panel.network.colInfo.status.insteadHeading': '代替代码显示的内容',
  'panel.network.colInfo.status.pendingDesc': '已发送，但尚未收到响应——在途时显示为灰色。',
  'panel.network.colInfo.status.failedDesc': '线路层失败（DNS、TLS、超时、连接中断）；net-stack 代码内联显示。',
  'panel.network.colInfo.status.canceledDesc': '请求在完成之前被中止。',
  'panel.network.colInfo.status.blockedDesc': '浏览器出于策略原因拒绝了它——例如 csp，或 other（扩展 / 广告拦截）。',
  'panel.network.colInfo.status.corsDesc': '跨源检查拒绝了该响应。',
  'panel.network.colInfo.status.dataDesc': 'data: URL——内联提供，从未经过网络。',
  'panel.network.colInfo.status.finishedDesc': '未携带状态代码的响应。',
  'panel.network.colInfo.protocol.summary': '连接协商出的 HTTP 版本，在握手时选定。',
  'panel.network.colInfo.protocol.valuesHeading': '取值',
  'panel.network.colInfo.protocol.http11Desc': '基于文本，每个连接同时只有一个请求在途。',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2——二进制，在单个连接上多路复用。',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3——运行在基于 UDP 的 QUIC 上，握手更快。',
  'panel.network.colInfo.scheme.summary': 'URL 协议——`https`、`http`、`ws` 或 `wss`。',
  'panel.network.colInfo.domain.summary': '请求指向的主机名。',
  'panel.network.colInfo.remoteAddress.summary': '连接实际到达的 IP 地址和端口。',
  'panel.network.colInfo.remoteAddress.description':
    '当 DNS 返回多个 IP、CDN 通过 anycast 路由、或本地代理拦截连接时，会与域名不同。',
  'panel.network.colInfo.type.summary': '浏览器分配的资源类型——它决定行图标和表格上方的筛选片。',
  'panel.network.colInfo.type.examplesHeading': '示例',
  'panel.network.colInfo.type.documentDesc': '顶级或框架内的 HTML 导航。',
  'panel.network.colInfo.type.fetchXhrDesc': '由 JavaScript 发出的数据请求。',
  'panel.network.colInfo.type.scriptCssDesc': '由解析器加载的页面资源。',
  'panel.network.colInfo.type.imgFontMediaDesc': '静态资源。',
  'panel.network.colInfo.initiator.summary': '导致此请求被发送的原因。',
  'panel.network.colInfo.initiator.kindsHeading': '种类',
  'panel.network.colInfo.initiator.scriptDesc': '由 JavaScript 触发——单元格链接到调用位置。',
  'panel.network.colInfo.initiator.parserDesc': 'HTML 解析器发现了该资源（`<script>`、`<img>`、`<link>` 等）。',
  'panel.network.colInfo.initiator.redirectDesc': '一个 `3xx` 响应把浏览器带到了这里。',
  'panel.network.colInfo.initiator.otherDesc': '导航、预加载或无法归因的来源。',
  'panel.network.colInfo.cookies.summary': '浏览器在 `Cookie` 标头中附加到请求上的 Cookie 数量。没有时为空。',
  'panel.network.colInfo.setCookies.summary': '响应返回的 `Set-Cookie` 标头数量。没有时为空。',
  'panel.network.colInfo.setCookies.description': '打开该请求的 Cookies 标签页，查看浏览器接受或丢弃了哪些。',
  'panel.network.colInfo.size.summary': '经过线路的字节数，包含响应标头和压缩开销。',
  'panel.network.colInfo.size.insteadHeading': '代替数字显示的内容',
  'panel.network.colInfo.size.diskCacheDesc': '由磁盘缓存提供——没有任何内容经过网络。',
  'panel.network.colInfo.size.memoryCacheDesc': '由当前页面的内存缓存提供。',
  'panel.network.colInfo.size.pendingDesc': '请求尚未完成。',
  'panel.network.colInfo.time.summary': '从请求发出到最后一个响应字节的活动时长——排队时间不计入。',
  'panel.network.colInfo.time.description': '瞬时响应显示为 `0 ms`；请求仍在途时保持为空。',
  'panel.network.colInfo.priority.summary': '浏览器分配的抓取优先级，从 `Highest` 到 `Lowest`。',
  'panel.network.colInfo.priority.description':
    '优先级更高的资源会更早被请求并获得更多连接资源。页面可通过 `fetchpriority` 属性微调。',
  'panel.network.colInfo.waterfall.summary':
    '每个请求一条时间线条形。列标题菜单选择指标，以 `Waterfall (ST)` 这样的短标签显示。',
  'panel.network.colInfo.waterfall.metricTagsHeading': '指标标签',
  'panel.network.colInfo.waterfall.stDesc': 'Start time——条形按每个请求开始的时刻排在共享时间线上。',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time——按第一个响应字节到达的时刻放置。',
  'panel.network.colInfo.waterfall.etDesc': 'End time——按每个请求完成的时刻放置。',
  'panel.network.colInfo.waterfall.tdDesc': 'Total duration——零点对齐的条形，按完整请求时长确定长度。',
  'panel.network.colInfo.waterfall.lDesc': 'Latency——零点对齐的条形，在响应开始处分段。',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': '圆点标记每个被你的规则作用过的请求。',
  'panel.network.fireRail.dotColorsHeading': '圆点颜色',
  'panel.network.fireRail.appliedDesc':
    '已应用——规则引擎确认规则已执行、页面内报告器确认操作已运行，或修改在捕获的标头中可见。',
  'panel.network.fireRail.inferredDesc': '推断——规则已匹配，但无法为此请求验证是否已应用。',
  'panel.network.fireRail.contradictedDesc': '相矛盾——规则声称的标头更改被捕获的标头证伪。',
  'panel.network.annotationRail.summary': '标记 OpenHeaders 所知、但各列未显示的信息。悬停字形查看解释；点击打开详情。',
  'panel.network.annotationRail.glyphsHeading': '字形',
  'panel.network.annotationRail.warnDesc': '这一行并非表面所见——例如下载中途被中断的传输。',
  'panel.network.annotationRail.infoDesc': '来源或保真度上下文——从未完成、捕获间隙、合成行。',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  // Raw by design: the eight rung names (Queueing / Stalled / DNS Lookup
  // / TCP / TLS / Request sent / Waiting for server / Content Download —
  // browser Timing-tab parity), the terminal outcome labels mirroring
  // the Status cell ((canceled), (blocked:…), CORS error, (failed)
  // net::ERR_…), the Connection Start section name, and every µs/ms/s
  // figure. The OH-invented band names, absent-step reasons, key-moment
  // narrative, and footnote sentences key.
  'panel.network.timing.band.beforeWire': '调度',
  'panel.network.timing.band.connecting': '连接建立',
  'panel.network.timing.band.exchange': '传输',
  'panel.network.timing.where.beforeWire': '（浏览器）',
  'panel.network.timing.where.connecting': '（浏览器 ↔ 网络）',
  'panel.network.timing.where.exchange': '（网络）',
  'panel.network.timing.absent.reused': '连接已复用',
  'panel.network.timing.absent.notReached': '未到达',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': '无数据',
  'panel.network.timing.warmSocketTitle':
    '此请求的时钟上没有 TCP 握手——socket 已预先建立（可能已预连接）。这里只运行了 TLS。',
  'panel.network.timing.warmSocketHint': '热 socket',
  'panel.network.timing.moment.queued': '入队',
  'panel.network.timing.moment.started': '开始',
  'panel.network.timing.moment.response': '响应',
  'panel.network.timing.moment.ended': '结束',
  'panel.network.timing.momentWhy.queued': '请求已创建',
  'panel.network.timing.momentWhy.started': '离开队列',
  'panel.network.timing.momentWhy.response': '首字节（TTFB）',
  'panel.network.timing.momentWhy.ended': '最后一个字节，完成',
  'panel.network.timing.untrackedGaps': '未计入间隙：{parts}',
  'panel.network.timing.chromeEquivalent':
    'Chrome 对应：Initial connection = TCP {tcp} + TLS {tls} = {total}（SSL 画在其内部）',
  'panel.network.timing.terminalDetail.noResponse': '未收到响应',
  'panel.network.timing.terminalDetail.neverReached': '从未到达网络',
  'panel.network.timing.keyMoments': '关键时刻',
  'panel.network.timing.sinceFirstRequest': '（自第一个请求起）',
  'panel.network.timing.timingNotes': '计时说明',
  'panel.network.timing.totalTime': '总时长',
  'panel.network.timing.queuedToEnded': '（入队 → 结束）',
  'panel.network.timing.connectionOpenedBy': '↳ 连接由 {name} 打开',
  'panel.network.timing.notFinishedCaution': '注意：请求尚未完成！',
  'panel.network.timing.queuedAt': '入队于 {time}',
  'panel.network.timing.startedAt': '开始于 {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': '未及此点',
  'panel.network.timing.onTheWire': '🌐 线路上',
  'panel.network.timing.cdpExplainer': '启用 CDP 并在导航前重新加载，即可获得运行时的完整连接明细。',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': '计时',
  'panel.network.rungInfo.kickerBrowser': '计时 · 浏览器',
  'panel.network.rungInfo.kickerBrowserNetwork': '计时 · 浏览器 ↔ 网络',
  'panel.network.rungInfo.kickerNetwork': '计时 · 网络',
  'panel.network.rungInfo.kickerInstant': '计时 · 瞬时',
  'panel.network.rungInfo.kickerOutcome': '计时 · 结果',
  'panel.network.rungInfo.stripCaption': '示例请求——端到端 {ms} ms',
  'panel.network.rungInfo.stripStop': '标记处：请求停止的位置——之后的阶段从未运行',
  'panel.network.rungInfo.stripMarked': '标记处：{label}，位于 {ms} ms',
  'panel.network.rungInfo.stripGaps': '高亮处：未计入间隙（3 + 4 ms）',
  'panel.network.rungInfo.stripHighlighted': '高亮处：{segs}（{ms} ms）',
  'panel.network.rungInfo.queueing.summary': '请求在被允许开始之前，在浏览器中等待的时间。',
  'panel.network.rungInfo.queueing.description':
    '浏览器会推迟低优先级资源的请求、先加载高优先级资源，并在检查磁盘缓存时等待。在 HTTP/1.x 上，当发往该主机的所有 socket 都繁忙时也会在此等待。',
  'panel.network.rungInfo.stalled.summary': '已被允许开始，但在任何网络工作开始之前等待可用连接。',
  'panel.network.rungInfo.stalled.description':
    '通常是在等待某个 socket 变得可用，或等待代理决策。第一个网络步骤（DNS、TCP 或发送）开始的那一刻结束。',
  'panel.network.rungInfo.dns.summary': '把主机名解析为要连接的 IP 地址。',
  'panel.network.rungInfo.dns.description': '当请求搭乘已打开的连接时显示“连接已复用”——此请求的时钟上无需查询。',
  'panel.network.rungInfo.connect.summary': '仅 TCP 握手——打开通往服务器 socket 的那次往返。',
  'panel.network.rungInfo.connect.description':
    'Chrome 的 Timing 标签页画一条同时跨越此阶段和 TLS 握手的 “Initial connection” 条（其 SSL 条画在内部）。我们把它们拆成互不重叠的独立阶段，让每一毫秒都恰好计入一次——这里的 TCP + TLS 等于 Chrome 的 Initial connection 条。',
  'panel.network.rungInfo.ssl.summary': 'TLS 握手——协商密钥并验证证书，使连接得到加密。',
  'panel.network.rungInfo.ssl.description':
    '仅在 https:// 请求上（纯 http:// 为 n/a）。“连接已复用”表示较早的请求已在同一 socket 上支付过此成本。',
  'panel.network.rungInfo.send.summary': '把请求字节——标头和任何请求体——推上线路。',
  'panel.network.rungInfo.send.description': '仅有标头的请求通常远低于一毫秒；大体积上传会增长。',
  'panel.network.rungInfo.wait.summary': '从发送最后一个请求字节到收到第一个响应字节（首字节时间）。',
  'panel.network.rungInfo.wait.description': '服务器思考时间加一次网络往返——后端工作体现在这个阶段。',
  'panel.network.rungInfo.receive.summary': '下载响应体，从第一个字节到最后一个。',
  'panel.network.rungInfo.receive.description': '响应仍在流式传输时实时增长；图表下方的警示行标记从未完成的下载。',
  'panel.network.rungInfo.notes.summary': '对阶段之间时间碎片的记账——端到端有记录，但不属于任何阶段。',
  'panel.network.rungInfo.notes.description':
    '每个阶段都在自己的起止时刻之间测量，而总时长是端到端测量的——因此两个阶段之间可能存在微小的“未计入间隙”（例如 DNS 应答到达与 TCP 握手开始之间）。这就是各阶段之和不总等于总时长的原因。Chrome 的 Timing 标签页有同样的间隙，只是不画出来；我们把它们列出，让每一毫秒都有出处。',
  'panel.network.rungInfo.notes.linesHeading': '各行含义',
  'panel.network.rungInfo.notes.gapsLabel': '未计入间隙',
  'panel.network.rungInfo.notes.gapsDesc': '每个间隙以其前后阶段命名，并附时长。',
  'panel.network.rungInfo.notes.chromeLabel': 'Chrome 对应',
  'panel.network.rungInfo.notes.chromeDesc':
    '我们拆分的 TCP + TLS 阶段如何对应到 Chrome 单条 “Initial connection” 条（其 SSL 条画在那条内部，而不是其后）。',
  'panel.network.rungInfo.band.beforeWire.summary':
    '完全在浏览器内部、尚未进行任何网络工作的时间——还没有任何内容离开这台机器。',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing（等待获准开始）加 Stalled（等待可用连接）。此处耗时多的请求是被本地因素拖住了——优先级、连接上限或代理决策——而不是被服务器。',
  'panel.network.rungInfo.band.connecting.summary': '铺设通往服务器的路径：解析名称、打开 socket、加密它。',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS——握手往返。每个连接只支付一次：搭乘已打开 socket 的请求会跳过整个此区段（“连接已复用”）。',
  'panel.network.rungInfo.band.exchange.summary': '线路上的实际交换：发送请求、等待服务器、下载响应。',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server（TTFB）+ Content Download。服务器端的缓慢体现在 Waiting；大响应或慢链路体现在 Content Download。',
  'panel.network.rungInfo.moment.queued.summary': '浏览器创建请求的瞬间——此明细中每个阶段的计时零点。',
  'panel.network.rungInfo.moment.queued.description':
    '“于”后的数值是相对视图中第一个请求的偏移，因此各行可以在同一个时钟上比较。',
  'panel.network.rungInfo.moment.started.summary': '请求离开队列、实际开始处理的瞬间。',
  'panel.network.rungInfo.moment.started.description':
    '入队 + Queueing。此标记之前的一切是浏览器调度；之后是请求的实际推进。',
  'panel.network.rungInfo.moment.response.summary': '第一个响应字节到达的瞬间（首字节时间）。',
  'panel.network.rungInfo.moment.response.description':
    '服务器已应答；从这里开始下载响应体。从未收到响应时（先被拦截或失败）不存在。',
  'panel.network.rungInfo.moment.ended.summary': '最后一个响应字节到达的瞬间——请求完成。',
  'panel.network.rungInfo.moment.ended.description':
    '结束 − 入队是明细下方显示的总时长；结束 − 开始是 Time 列显示的活动时长。',
  'panel.network.rungInfo.keyMoments.summary': '请求生命周期的边界瞬间——一个阶段交棒给下一个阶段的位置。',
  'panel.network.rungInfo.keyMoments.description':
    '入队和开始总是存在；响应和结束只有在真正收到响应后才有（先被拦截或失败的请求改为显示其结果标记）。下方的各阶段就是这些瞬间之间的时间段。',
  'panel.network.rungInfo.terminal.whereHeading': '停在了哪里',
  'panel.network.rungInfo.terminal.noResponseDesc': '它到达了网络，但应答从未返回。',
  'panel.network.rungInfo.terminal.neverReachedDesc': '它死在了浏览器端调度中——什么都没有发出。',
  'panel.network.rungInfo.terminal.canceled.summary': '请求在完成之前被中止——✗ 标记停止的位置；之后的阶段从未运行。',
  'panel.network.rungInfo.terminal.canceled.description':
    '典型原因：页面在加载途中导航离开、脚本中止了 fetch，或用户停止了加载。网络没有任何问题——只是浏览器放弃了等待应答。',
  'panel.network.rungInfo.terminal.blocked.summary': '浏览器出于策略原因拒绝了该请求——冒号后的词指明是哪种策略。',
  'panel.network.rungInfo.terminal.stoppedHere': '✗ 标记停止的位置；之后的阶段从未运行。',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': '常见原因',
  'panel.network.rungInfo.terminal.blocked.cspDesc': '页面的 Content-Security-Policy 禁止此目标。',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc': 'https:// 页面上的不安全 http:// 资源。',
  'panel.network.rungInfo.terminal.blocked.otherDesc': '扩展、广告拦截器或浏览器内部规则拒绝了它。',
  'panel.network.rungInfo.terminal.cors.summary': '跨源检查拒绝了该响应——服务器应答了，但页面无权读取。',
  'panel.network.rungInfo.terminal.cors.description':
    '服务器必须通过 Access-Control-Allow-Origin（及相关标头）选择加入，跨源页面才能读取其响应。✗ 标记拒绝发生的位置。',
  'panel.network.rungInfo.terminal.failed.summary': '线路层失败——连接本身断了，net:: 代码指明确切原因。',
  'panel.network.rungInfo.terminal.failed.codesHeading': '常见代码',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS 找不到该主机。',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': '服务器拒绝或断开了 socket。',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': '在网络栈的时限内没有应答。',
  'panel.network.rungInfo.terminal.failed.certDesc': 'TLS 证书未通过验证。',

  // ── OH row annotations — one classifier, one copy family (traffic
  // rail glyph popover + Headers-tab insight cards). The rail is a hot
  // row loop: copy resolves once per locale via
  // `buildRowAnnotationMessages(t)` threaded through the stable cell
  // context — never `t()` in the row body. The popover kicker is the
  // raw brand mark. ───────────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': '此行还有',
  'panel.rowAnnotations.openDetails': '打开详情',
  'panel.rowAnnotations.interrupted.label': '传输被中断',
  'panel.rowAnnotations.interrupted.detail':
    '下载在完成之前被取消。状态反映的是中断前已到达的标头，收到的数据不完整——除此之外这一行与已完成的行无法区分。',
  'panel.rowAnnotations.neverFinished.label': '从未完成',
  'panel.rowAnnotations.neverFinished.detail':
    '发出此请求的页面在其仍在途时卸载了，因此从未记录任何结果——这就是 Status 和 Time 读作 “(unknown)” 的原因。',
  'panel.rowAnnotations.fidelityGap.label': '捕获保真度间隙',
  'panel.rowAnnotations.fidelityGap.detail':
    '对于从未完成的请求，默认捕获路径看不到已传输字节和响应体——CDP 增强检查会记录它们。',
  'panel.rowAnnotations.syntheticHar.label': '合成行',
  'panel.rowAnnotations.syntheticHar.detail': '此行由一条从未与实时请求关联的捕获记录重建而来，因此部分列无法填充。',
  'panel.rowAnnotations.syntheticMemory.label': '合成行',
  'panel.rowAnnotations.syntheticMemory.detail':
    '此行由页面的 Resource Timing 重建而来（内存缓存命中从不进入网络栈），因此没有标头和 Cookie 可用。',
  'panel.rowAnnotations.debugPaused.label': '调试模式滞留',
  'panel.rowAnnotations.debugPaused.detail':
    '此行时间中有 {ms} ms 是在调试模式拦截中暂停度过的，而不是在等待服务器或网络——调试模式在检查该请求时将其扣住，因此该行的总时长比请求本身更长。',
  'panel.rowAnnotations.queryParamRewrite.label': '查询参数改写',
  'panel.rowAnnotations.queryParamRewrite.detail':
    '此重定向是 Open Headers 在应用查询参数规则，而不是服务器所为。改写 URL 的查询字符串以内部重定向的方式执行，因此显示为独立的一跳；随后请求继续前往改写后的 URL，方法、请求体、Cookie 和标头原样保留。',
  'panel.rowAnnotations.redirectRule.label': '重定向规则',
  'panel.rowAnnotations.redirectRule.detail':
    '此重定向是 Open Headers 在应用重定向规则，而不是服务器所为。它以内部重定向的方式执行，因此原始请求显示为独立的一跳，然后请求继续前往改写后的 URL。',
  'panel.rowAnnotations.wireJoined.label': '已合并线路捕获',
  'panel.rowAnnotations.wireJoined.detail':
    '此交换也被本地代理在线路上捕获。该捕获提供的线路上实际标头、实测大小和套接字耗时会补全浏览器捕获自身未记录的部分。',
  'panel.rowAnnotations.wireSeen.label': '曾在浏览器标签页中出现',
  'panel.rowAnnotations.wireSeen.detail':
    '此线路交换也在浏览器标签页 {tab} 中被观察到——两行是同一请求，从两侧分别见证。',
  'panel.rowAnnotations.wireSeen.unknownTab': '受观察的标签页',
  'panel.rowAnnotations.wireSeen.jump': '在标签页来源中显示',
} as const satisfies Catalog;
