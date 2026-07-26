/**
 * Workbench Docs panel — anchor registry bodies — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-docs.ts` key for key; the fr/es S59
 * raw/keyed split is followed exactly. Raw by design inside keyed
 * prose: wire/API tokens (declarativeNetRequest, webRequest,
 * ResourceType, queryTransform, block, main_frame, firstParty /
 * thirdParty, Equals / Contains, operationName / query / key / value,
 * chrome.storage(.local), fetch() / XMLHttpRequest, @font-face,
 * Set-Cookie, Accept, User-Agent, Content-Type, CORS,
 * ERR_BLOCKED_BY_CLIENT, RE2, stdio, HTTP/SSE, git log / git blame),
 * ResourceType enum labels (Page, Frame, Fetch/XHR, Script, …),
 * monkey-patch raw (editors-rule precedent), the en figure strings
 * `30,000 ms` / `5,000 ms` verbatim (figure style follows en), and
 * DNR / AND / DOM / CA / PII / YAML / CDN / MCP loanwords. Quoted UI
 * labels copy their shipped zh-CN mints: header/query-param ops
 * （添加 / 覆盖、追加、移除、合并、仅覆盖、全部移除）, condition
 * names and the 排除 variants (workbench-editors-rule), inject
 * timing labels（尽快 / 页面加载后）, popup tab“此页面”, docs nav
 * titles (workbench-chrome), 动态（JavaScript）／静态数据 mode
 * labels, rule kickers (-规则 family), 第一方 / 第三方. Reuses 触达
 * = reach (debug referent), 引擎 = engine, 模拟 = mock, 徽章 =
 * badge, 工具窗口, 分隔条 = splitter, 转换 =
 * transform, 匿名化 = anonymize, lowercase `vault` per-case law.
 * MINTS: 取舍 = trade-off; 固定测试数据 = fixture; 等待页 = the
 * local waiting page; 泳道 = delay lane.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    '规则依其用途经由两套引擎之一执行。知道一条规则走哪条路径，就能解释它在哪里生效——以及在哪里无能为力。',
  'workbench.docs.body.execution.stackCaption':
    'JS 发起的请求先经过 Script 再经过 DNR。静态与导航流量完全绕开 Script。',
  'workbench.docs.body.execution.dnrHeading': '原生、快速、触达广',
  'workbench.docs.body.execution.dnr1Prefix': '标头覆盖 / 追加 / 移除、拦截、重定向和查询参数规则会编译为',
  'workbench.docs.body.execution.dnr1Suffix': '条目。Chrome 在网络层应用它们，早于任何请求离开浏览器。',
  'workbench.docs.body.execution.dnr2':
    '触达范围很广：页面、子框架、脚本、图像、字体、fetch、XHR——浏览器代表页面发出的每一个请求。',
  'workbench.docs.body.execution.dnrCaption': '单个带边框的列表——DNR 的触达基本上是全域的。',
  'workbench.docs.body.execution.scriptHeading': 'JS 上下文、触达窄',
  'workbench.docs.body.execution.script1Prefix': '注入、延迟、请求体、API 响应和标头合并规则的工作方式，是从页面内部给',
  'workbench.docs.body.execution.script1And': '和',
  'workbench.docs.body.execution.script1Suffix':
    '打 monkey-patch。它们能以 DNR 无法表达的方式转换 JavaScript 发起的流量——包括读取和改写响应体，而响应体是 DNR 完全无法访问的。',
  'workbench.docs.body.execution.scriptCaption': '两列——脚本引擎实际拦截什么，以及什么原样溜过。',
  'workbench.docs.body.execution.limitPrefix': '静态资源（',
  'workbench.docs.body.execution.limitSuffix':
    '）、页面导航和浏览器内部请求完全绕开此引擎。这些情况请使用基于 DNR 的规则。',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro': '让人意外的行为速查。每一项也会在其影响的章节中就地标注。',
  'workbench.docs.body.limitations.overviewCaption': '四个常见陷阱一览——下方每个提示框都有详情。',
  'workbench.docs.body.limitations.devtoolsTitle': '修改后的标头不显示在 DevTools 中',
  'workbench.docs.body.limitations.devtoolsBody':
    '标头操作被正确应用，但 Chrome 的 Network 标签页仍显示服务器的原始标头。',
  'workbench.docs.body.limitations.scriptTitle': '基于脚本的规则——触达窄',
  'workbench.docs.body.limitations.scriptPrefix': '注入、延迟、请求体、Mock 和标头合并只拦截',
  'workbench.docs.body.limitations.scriptAnd': '和',
  'workbench.docs.body.limitations.scriptMiddle': '。静态资源和页面导航会绕开它们。参见',
  'workbench.docs.body.limitations.executionRef': '规则如何执行',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': '合并无法读取浏览器默认标头',
  'workbench.docs.body.limitations.mergeBody':
    '合并操作只看得到页面代码显式设置的标头——Accept、User-Agent 等浏览器默认标头对它不可见。',
  'workbench.docs.body.limitations.chromeTitle': '标头匹配需要 Chrome 128+',
  'workbench.docs.body.limitations.chromeBody':
    '按请求 / 响应标头值匹配的条件需要 Chrome 128 或更新版本。更旧的浏览器会静默忽略该条件。',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix': '同时打开多个工作区标签页是一等状态。持久化数据经由',
  'workbench.docs.body.multiTab.intro1Suffix':
    '同步，布局状态保持每标签页独立，导航意图会优先复用同一窗口中的现有标签页，然后才打开新的。',
  'workbench.docs.body.multiTab.syncCaption': '标签页 A 保存，SW 广播，标签页 B 重新水合。布局状态留在各自的标签页里。',
  'workbench.docs.body.multiTab.navHeading': '导航复用现有标签页',
  'workbench.docs.body.multiTab.nav1':
    '同窗口优先：如果你点击时所在的窗口里已有工作区标签页，它会被激活并接收该意图（要滚动到的文档章节、要编辑的规则）。不同窗口时：在你当前的窗口里打开新标签页，而不是把焦点拽到另一个 Chrome 窗口——与 Chrome 自己的 DevTools 一致，每个窗口一个面板。',
  'workbench.docs.body.multiTab.navCaption': '热路径激活同窗口标签页；冷路径在调用方窗口打开新标签页。',
  'workbench.docs.body.multiTab.numberingHeading': '标签页编号',
  'workbench.docs.body.multiTab.numbering1Prefix': '有两个或更多工作区标签页时，每个标签页的标题前会加上其序号——',
  'workbench.docs.body.multiTab.numbering1Suffix': '。数量回落到一个时，幸存者会去掉前缀。',
  'workbench.docs.body.multiTab.numbering2Prefix': '序号在标签页的生命周期内稳定：关闭',
  'workbench.docs.body.multiTab.numbering2While': '而',
  'workbench.docs.body.multiTab.numbering2And': '和',
  'workbench.docs.body.multiTab.numbering2Middle': '仍在时不会重新编号。下一个打开的标签页得到',
  'workbench.docs.body.multiTab.numbering2Middle2': '；编号只有在每个工作区标签页都关闭之后才重置为',
  'workbench.docs.body.multiTab.numbering2Suffix': '。',
  'workbench.docs.body.multiTab.numberingCaption': '幸存者跨关闭保留编号；下一个标签页总是最大值 + 1。',
  'workbench.docs.body.multiTab.syncsHeading': '什么同步，什么不同步',
  'workbench.docs.body.multiTab.syncs1Prefix':
    '每个持久化实体——规则、集合、文件夹、环境、工作区变量、vault、请求、模板——都以',
  'workbench.docs.body.multiTab.syncs1Suffix':
    '为唯一事实来源。标签页 A 的保存经由后台广播，标签页 B 重新水合。工作区和环境切换以同样的方式传播。',
  'workbench.docs.body.multiTab.syncedCaption': '一个共享的 chrome.storage；两个标签页读写同一份持久化数据。',
  'workbench.docs.body.multiTab.localCaption': '布局拖动和未保存的输入留在各自的标签页——另一个标签页永远看不到。',
  'workbench.docs.body.multiTab.layoutTitle': '布局不实时同步',
  'workbench.docs.body.multiTab.layout1Prefix':
    '窗格比例和工具窗口停靠状态按工作区保存，但更改不会传播到已打开的标签页。在标签页 A 拖动分隔条不影响标签页 B，直到重新加载——输入时的实时布局同步会让人不适。在拖动',
  'workbench.docs.body.multiTab.layoutAfter': '之后',
  'workbench.docs.body.multiTab.layout1Suffix': '打开的标签页会继承新布局。',
  'workbench.docs.body.multiTab.draftsTitle': '未保存的草稿是标签页本地的',
  'workbench.docs.body.multiTab.drafts1':
    '编辑器草稿留在各自标签页的内存里。如果标签页 A 保存了标签页 B 正在编辑的同一条规则，标签页 A 赢得存储写入——目前没有跨标签页的“已修改，重新加载？”提示。只有两个标签页同时编辑同一实体时才有影响。',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': '弹窗中的',
  'workbench.docs.body.requestTracking.thisPage': '此页面',
  'workbench.docs.body.requestTracking.intro1Suffix':
    '标签页显示当前页面有哪些规则处于活动状态，以及它们匹配了哪些请求。跟踪覆盖页面发出的每条连接的请求和响应两个阶段。',
  'workbench.docs.body.requestTracking.phasesCaption': '一条连接有两个阶段——两者都计入徽章计数。',
  'workbench.docs.body.requestTracking.howHeading': '工作原理',
  'workbench.docs.body.requestTracking.how1Prefix': '扩展观察 HTTP 请求的途径是',
  'workbench.docs.body.requestTracking.how1Middle':
    'API 观察 HTTP 请求。当请求 URL 匹配某条规则的条件（域名、URL 模式或 URL 正则）时，它连同资源类型一起被记录。记录在 Service Worker 内实时发生；弹窗只是在你打开',
  'workbench.docs.body.requestTracking.how1Suffix': '标签页时把记录读回来。',
  'workbench.docs.body.requestTracking.howCaption': '浏览器触发 webRequest 事件；扩展匹配并记录；弹窗稍后读取。',
  'workbench.docs.body.requestTracking.badge1':
    '每条匹配的规则显示一个数字徽章，等于它匹配到的请求数。点击徽章可展开为时间戳、URL、资源类型和所匹配模式的列表。',
  'workbench.docs.body.requestTracking.badgeCaption': '徽章折叠为计数；点击后展示完整的匹配列表。',
  'workbench.docs.body.requestTracking.directHeading': '直接匹配与间接匹配',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle': '（直接）匹配指页面 URL 本身匹配了。而',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    '匹配指只有子资源——脚本、样式表、XHR、图像、字体——匹配了，而页面 URL 没有。同一条规则在不同页面上可能产生任一种。',
  'workbench.docs.body.requestTracking.directCaption': '一条规则，两个页面上下文。绿色 = 匹配。虚线 = 被排除。',
  'workbench.docs.body.requestTracking.typesHeading': '资源类型',
  'workbench.docs.body.requestTracking.types1Prefix': '每个匹配的请求都带有其 Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '——Page、Frame、Fetch/XHR、Script、CSS、Image、Font、Media、WebSocket、Ping 或 Other。参见',
  'workbench.docs.body.requestTracking.resourceTypesLink': '资源类型',
  'workbench.docs.body.requestTracking.types1Suffix': '参考页，获取带示例的完整映射。',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': '本页是 Chrome',
  'workbench.docs.body.resourceTypes.introSuffix':
    '值的参考，来自请求跟踪和“资源类型”条件。每个标签映射到单一底层类型——行与行之间没有重叠。',
  'workbench.docs.body.resourceTypes.anatomyCaption': '哪种请求落在哪个 ResourceType——一目了然。',
  'workbench.docs.body.resourceTypes.descPage': '顶级文档导航——地址栏中显示的 URL。',
  'workbench.docs.body.resourceTypes.descFrame': '页面中嵌入的 iframe 或嵌套框架。',
  'workbench.docs.body.resourceTypes.descXhr':
    '经由 fetch() 或 XMLHttpRequest 的 API 调用。Chrome 把两者报告为同一类型——无法区分。',
  'workbench.docs.body.resourceTypes.descScript': '页面加载的 JavaScript 文件。',
  'workbench.docs.body.resourceTypes.descStylesheet': '页面加载的样式表。',
  'workbench.docs.body.resourceTypes.descImage': '页面或其样式加载的图像。',
  'workbench.docs.body.resourceTypes.descFont': '经由 @font-face 规则加载的 Web 字体。',
  'workbench.docs.body.resourceTypes.descMedia': '音频或视频资源。',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'WebSocket 握手——最初的 HTTP 升级请求。只跟踪握手，不跟踪单条消息。',
  'workbench.docs.body.resourceTypes.descPing': '通常用于分析/跟踪的 Beacon 和 ping 请求。',
  'workbench.docs.body.resourceTypes.descOther': '不属于上述任何类别的一切。',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': '操作是规则中“',
  'workbench.docs.body.actions.introDo': '做',
  'workbench.docs.body.actions.intro1Middle': '”的那部分。',
  'workbench.docs.body.actions.conditionLink': '条件',
  'workbench.docs.body.actions.intro1Middle2': '决定规则',
  'workbench.docs.body.actions.introWhether': '是否',
  'workbench.docs.body.actions.intro1Middle3': '触发，操作则决定',
  'workbench.docs.body.actions.introWhatChanges': '改变什么',
  'workbench.docs.body.actions.intro1Suffix': '。每条规则把一叠 AND 匹配的条件与恰好一个操作配对。',
  'workbench.docs.body.actions.categories1':
    '操作分三类——修改传出请求、修改传入响应，或在页面中运行代码。每个操作由两套引擎之一实现：',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '（Chrome 的',
  'workbench.docs.body.actions.categoriesDnrSuffix': '，快速且原生）或',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen': '（Open Headers 的页面内引擎，处理 DNR 无法表达的事）。参见',
  'workbench.docs.body.actions.executionLink': '规则如何执行',
  'workbench.docs.body.actions.categories1Suffix': '了解两者的取舍。',
  'workbench.docs.body.actions.ruleAnatomyCaption': '一条规则 = AND 匹配的条件配上恰好一个操作。',
  'workbench.docs.body.actions.taxonomyCaption': '三个类别，每个操作都带着它的引擎标签。',
  'workbench.docs.body.actions.modifyRequestTitle': '修改请求',
  'workbench.docs.body.actions.tagRequest': '在它离开浏览器之前',
  'workbench.docs.body.actions.modifyRequest1':
    '重塑传出请求——它的标头、URL 参数、正文、目的地，或它是否发出。大多数规则都在这里。',
  'workbench.docs.body.actions.headerActionsLink': '标头操作',
  'workbench.docs.body.actions.liHeaderActionsRequest': '——对请求标头进行添加 / 覆盖 / 追加 / 移除 / 合并。',
  'workbench.docs.body.actions.blockLink': '拦截',
  'workbench.docs.body.actions.liBlock': '——在网络层取消请求。',
  'workbench.docs.body.actions.redirectLink': '重定向',
  'workbench.docs.body.actions.liRedirect': '——把请求发送到不同的 URL，静态或正则。',
  'workbench.docs.body.actions.queryParamsLink': '查询参数',
  'workbench.docs.body.actions.liQueryParams': '——添加、覆盖或移除 URL 参数。',
  'workbench.docs.body.actions.requestBodyLink': '请求体',
  'workbench.docs.body.actions.liRequestBody': '——改写传出的 fetch / XHR 正文（静态、动态或经 GraphQL 过滤）。',
  'workbench.docs.body.actions.modifyResponseTitle': '修改响应',
  'workbench.docs.body.actions.tagResponse': '在页面看到它之前',
  'workbench.docs.body.actions.modifyResponse1':
    '在响应返回的路上重塑它——标头、正文或 HTTP 状态。适合模拟尚未建成的端点，以及在开发中强制触发失败模式。',
  'workbench.docs.body.actions.liHeaderActionsResponse': '——同样五种操作适用于响应标头。',
  'workbench.docs.body.actions.responseLink': '修改响应',
  'workbench.docs.body.actions.liResponse': '——模拟或修改回复：合成的正文、状态或标头。',
  'workbench.docs.body.actions.runCodeTitle': '运行代码',
  'workbench.docs.body.actions.tagRunCode': '在页面或其调度器内部',
  'workbench.docs.body.actions.runCode1':
    '不能干净地归入“修改请求或响应”的效果——代码注入与人为延迟。两者都走 Script 引擎，因为 DNR 没有等价物。',
  'workbench.docs.body.actions.injectLink': '注入 JS / CSS',
  'workbench.docs.body.actions.liInject': '——在页面上下文中运行 JavaScript 或 CSS，在页面脚本之前或 DOM 就绪之后。',
  'workbench.docs.body.actions.delayLink': '延迟',
  'workbench.docs.body.actions.liDelay': '——为导航和 JS 发起的 fetch / XHR 添加人为延迟。',
  'workbench.docs.body.actions.oneActionTitle': '每条规则一个操作',
  'workbench.docs.body.actions.oneAction1':
    '每条规则恰好携带一个操作。要同时做两件事——比如添加标头 AND 重定向——就写两条条件相同的规则。两条都会在同一请求上触发；DNR 按文档化的顺序组合它们。',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    '针对请求和响应标头的四种操作——三种原生（添加 / 覆盖、追加、移除），加一种基于脚本的（合并），用于 DNR 无法表达的值拼接。',
  'workbench.docs.body.headerActions.opsCaption': '相同的起始标头，四种不同的结果',
  'workbench.docs.body.headerActions.overrideTitle': '添加 / 覆盖',
  'workbench.docs.body.headerActions.override1':
    '把标头设为此值。已存在则覆盖，缺失则添加——最终始终是一个带你的值的标头。',
  'workbench.docs.body.headerActions.overrideCaption': '同一条规则覆盖两种情况——存在时覆盖，缺失时添加。',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    '如果规则的条件不匹配请求，什么也不发生——没有错误，只是无操作。',
  'workbench.docs.body.headerActions.appendTitle': '追加',
  'workbench.docs.body.headerActions.append1':
    '添加一个同名的新标头条目。原有的保留——产生重复标头。用于 Set-Cookie、Link、Via。',
  'workbench.docs.body.headerActions.appendCaption': '原标头保留；添加一行同名的新条目。两者都会被送达。',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    '有些标头不能重复——浏览器会把它们折叠。这种情况请改用覆盖或合并。',
  'workbench.docs.body.headerActions.removeTitle': '移除',
  'workbench.docs.body.headerActions.remove1': '删除此标头的所有实例。无需填写值。',
  'workbench.docs.body.headerActions.removeCaption': '目标行消失；其他一切原样通过。',
  'workbench.docs.body.headerActions.removeWontApplyCaption': '如果标头不存在，什么也不发生——没有错误，只是无操作。',
  'workbench.docs.body.headerActions.mergeTitle': '合并',
  'workbench.docs.body.headerActions.merge1Prefix': '在运行时读取现有值，用分隔符把你的值接在后面。默认为',
  'workbench.docs.body.headerActions.merge1Middle': '（用于 Cookie）和',
  'workbench.docs.body.headerActions.merge1Suffix': '（用于其他标头）。分隔符可以为空，实现直接拼接。',
  'workbench.docs.body.headerActions.mergeCaption': '现有值保留；你的值接在分隔符之后。',
  'workbench.docs.body.headerActions.mergeWontApplyCaption': '仅限脚本引擎——页面导航和静态资源原样流过。',
  'workbench.docs.body.headerActions.mergeLimitation':
    '合并在 DevTools 中不可见，也读不到浏览器默认标头（Accept、User-Agent）——只有页面代码显式设置的标头。',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    '在网络层取消匹配的请求。浏览器收到网络错误，页面看到的请求失败与服务器不可达时一致。',
  'workbench.docs.body.block.howTitle': '工作原理',
  'workbench.docs.body.block.how1Prefix': '编译为不带主体的 DNR',
  'workbench.docs.body.block.how1Suffix':
    '操作。无论资源类型都适用——页面、子框架、脚本、图像、字体、fetch、XHR——因此除非用“资源类型”条件收窄范围，单条规则就覆盖一切。',
  'workbench.docs.body.block.blockCaption': '请求在离开浏览器之前就被杀掉；页面看到网络错误。',
  'workbench.docs.body.block.wontApplyCaption': '已加载的资源保持已加载——拦截只捕获未来的请求。',
  'workbench.docs.body.block.whenTitle': '何时使用',
  'workbench.docs.body.block.when1Prefix':
    '拦截广告 / 分析 / 跟踪域名、为单个主机模拟宕机，或在 API 其余部分保持可达的同时拒绝某一个端点。要只拦截页面的文档（而不是其子资源），请添加一个“资源类型”条件，其值为',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption': '四种典型模式——用条件（域名、URL 模式、资源类型）为每一种限定范围。',
  'workbench.docs.body.block.note1Prefix': '拦截',
  'workbench.docs.body.block.note1Suffix':
    '请求会让 Chrome 渲染一个 "ERR_BLOCKED_BY_CLIENT" 页面。子资源的拦截静默发生——用户看到什么取决于页面自己的错误处理。',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro': '把匹配的请求重定向到不同的 URL。支持静态 URL 和正则捕获组。',
  'workbench.docs.body.redirect.staticTitle': '静态重定向',
  'workbench.docs.body.redirect.static1': '输入完整 URL，把每个匹配的请求都重定向到同一个目的地。',
  'workbench.docs.body.redirect.staticCaption': '每个匹配请求同一个目的地——整段 URL 替换。',
  'workbench.docs.body.redirect.regexTitle': '正则重定向',
  'workbench.docs.body.redirect.regex1Prefix': '与 URL 正则条件配对使用。用',
  'workbench.docs.body.redirect.regex1Suffix': '等在目标 URL 中引用捕获组。',
  'workbench.docs.body.redirect.regexCaption': '捕获组匹配到的文本被替换进目标 URL。',
  'workbench.docs.body.redirect.wontApplyCaption': '重定向不追溯应用到已加载的页面。循环会被 Chrome 静默封顶。',
  'workbench.docs.body.redirect.whenTitle': '何时使用',
  'workbench.docs.body.redirect.when1':
    '强制 HTTP → HTTPS、把用户从旧域名迁走、改写 API 版本、把 CDN 流量代理到本地开发服务器，是四种典型模式。目的地完整可知时用静态；路径需要穿过重定向时用正则。',
  'workbench.docs.body.redirect.useCasesCaption': '四种典型模式——目标路径依赖匹配内容时选正则。',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix': '在请求离开浏览器之前修改 URL 查询参数。编译为 DNR',
  'workbench.docs.body.queryParam.introSuffix': '操作。',
  'workbench.docs.body.queryParam.addTitle': '添加 / 覆盖',
  'workbench.docs.body.queryParam.add1': '参数缺失时添加，已存在时覆盖其值。',
  'workbench.docs.body.queryParam.addCaption': '缺失时添加，存在时覆盖——最终始终是一个带你的值的匹配参数。',
  'workbench.docs.body.queryParam.replaceOnlyTitle': '仅覆盖',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': '仅当',
  'workbench.docs.body.queryParam.replaceOnlyStrong': '参数已经存在时才覆盖其值',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '。不带该参数的 URL 保持原样。用它来规范化一个值（例如把已带任意区域的 URL 强制为',
  'workbench.docs.body.queryParam.replaceOnly1Suffix': '），而不把它注入本来没有的 URL。',
  'workbench.docs.body.queryParam.replaceOnlyCaption': '只覆盖已存在的值——不带该参数的 URL 不受影响。',
  'workbench.docs.body.queryParam.removeTitle': '移除',
  'workbench.docs.body.queryParam.remove1': '按名称移除特定参数。值会被忽略。',
  'workbench.docs.body.queryParam.removeCaption': '指名的参数消失；其他每个查询参数照常通过。',
  'workbench.docs.body.queryParam.removeAllTitle': '全部移除',
  'workbench.docs.body.queryParam.removeAll1': '剥除整个查询字符串。不能与“添加 / 覆盖”组合在同一条规则中。',
  'workbench.docs.body.queryParam.removeAllCaption': '一步剥掉整个查询——URL 变得干干净净。',
  'workbench.docs.body.queryParam.wontApplyCaption': '“全部移除”与“添加 / 覆盖”在 DNR 层冲突——请拆成两条规则。',
  'workbench.docs.body.queryParam.whenTitle': '何时使用',
  'workbench.docs.body.queryParam.when1':
    '强制调试标志、规范化区域或语言、清洗跟踪参数，或出于隐私剥除全部查询字符串。每一种都干净地对应上面四种操作之一。',
  'workbench.docs.body.queryParam.useCasesCaption': '四种典型模式——选择与你意图对应的操作。',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro': '向匹配的页面注入 JavaScript 或 CSS。代码经由内容脚本在页面上下文中运行。',
  'workbench.docs.body.inject.timingCaption': '插入时机——页面脚本之前（尽快）与 DOM 安全（页面加载后）。',
  'workbench.docs.body.inject.scriptTitle': '脚本注入',
  'workbench.docs.body.inject.script1': '内联代码或外部 URL。选择插入时机：',
  'workbench.docs.body.inject.asapStrong': '尽快',
  'workbench.docs.body.inject.asap1':
    '——在页面自己的脚本之前运行。适合需要抢先的 monkey-patch（例如在应用代码持有引用之前包裹',
  'workbench.docs.body.inject.asap1Suffix': '）。',
  'workbench.docs.body.inject.afterStrong': '页面加载后',
  'workbench.docs.body.inject.after1': '——在页面解析完成后运行。对读取 DOM 的代码是更安全的默认，因为元素保证存在。',
  'workbench.docs.body.inject.scriptCaption': '脚本作为 <script> 标签落进页面——与页面 JS 看到相同的全局对象。',
  'workbench.docs.body.inject.cssTitle': 'CSS 注入',
  'workbench.docs.body.inject.css1Prefix': '把自定义 CSS 作为',
  'workbench.docs.body.inject.css1Suffix': '标签注入。适合深色模式覆盖、隐藏碍眼的元素，或按环境定制主题。',
  'workbench.docs.body.inject.cssCaption': 'CSS 作为 <style> 标签追加，遵循正常的 CSS 特异性。',
  'workbench.docs.body.inject.wontApplyCaption': '沙箱化的 iframe 和严格 CSP 页面会拦截注入的脚本。',
  'workbench.docs.body.inject.whenTitle': '何时使用',
  'workbench.docs.body.inject.when1':
    '在应用代码抓取浏览器 API 之前打 monkey-patch、强制深色主题、隐藏碍眼的 UI 元素，以及在页面初始化之前预置 window 级功能开关。',
  'workbench.docs.body.inject.useCasesCaption': '四种典型模式——第一种和第四种必须用“尽快”时机。',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro': '为匹配的请求添加人为延迟。三条泳道并行运行，取决于请求的种类。',
  'workbench.docs.body.delay.routingCaption': '延迟路由——三种请求种类对应三条泳道。',
  'workbench.docs.body.delay.navHeading': '文档与 iframe 导航',
  'workbench.docs.body.delay.nav1Prefix': '经由本地等待页路由。支持的延迟最高',
  'workbench.docs.body.delay.navMs': '30,000 ms',
  'workbench.docs.body.delay.nav1Suffix': '——Chrome 的 DNR 重定向上限。',
  'workbench.docs.body.delay.navCaption': '本地等待页把导航扣留 N ms，然后转发到真实目标。',
  'workbench.docs.body.delay.xhrHeading': 'JS 发起的 XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': '被',
  'workbench.docs.body.delay.xhr1Middle': 'monkey-patch 拦截。封顶于',
  'workbench.docs.body.delay.xhrMs': '5,000 ms',
  'workbench.docs.body.delay.xhr1Suffix': '，以免耗尽 Chrome 的 HTTP 连接池——超出的值在线路上被钳制。',
  'workbench.docs.body.delay.xhrCaption': '页面级补丁里的 setTimeout 先扣住调用，再转发到网络。',
  'workbench.docs.body.delay.wontApplyCaption': '子资源和 Service Worker 的 fetch 会逃过页面级 monkey-patch。',
  'workbench.docs.body.delay.whenTitle': '何时使用',
  'workbench.docs.body.delay.when1':
    '暴露加载状态的回归、锻炼防抖/节流代码路径、揭示并发请求之间的竞态，以及在本地开发中近似慢网络条件。',
  'workbench.docs.body.delay.useCasesCaption': '四种典型模式——配合 URL 模式或域名来限定范围。',
  'workbench.docs.body.delay.desktopNoteTitle': '桌面端应用——产品说明',
  'workbench.docs.body.delay.desktopNote1':
    '对静态资源（图像、脚本、样式表、字体）限速需要一个能保持连接、流式传输字节的真实本地网络层——扩展做不到。桌面端应用很快会接手这件事。',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix': '在请求体离开浏览器之前覆盖或转换它。基于脚本——拦截',
  'workbench.docs.body.requestBody.introAnd': '和',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption': '规则在 page.js 与网络之间触发——三种转换形态',
  'workbench.docs.body.requestBody.staticTitle': '静态正文',
  'workbench.docs.body.requestBody.static1':
    '把整个请求体替换为固定字符串。REST 和 GraphQL 都适用——规则不解析正文，而是整体替换。',
  'workbench.docs.body.requestBody.staticCaption': '整个正文被替换——原始内容被丢弃。',
  'workbench.docs.body.requestBody.dynamicTitle': '动态正文',
  'workbench.docs.body.requestBody.dynamic1': '编写一个函数，接收原始正文和请求上下文，返回修改后的正文。该函数接收',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': '函数看到原始内容；返回什么就发送什么。',
  'workbench.docs.body.requestBody.graphqlTitle': 'GraphQL 过滤',
  'workbench.docs.body.requestBody.graphql1Prefix':
    '当资源类型为 GraphQL 时，规则只在 JSON 负载的配置字段匹配该值的请求上触发。运行时把请求体解析为 JSON，读取由',
  'workbench.docs.body.requestBody.graphql1Middle': '指名的字段，然后用所选运算符（',
  'workbench.docs.body.requestBody.graphql1Middle2': '为精确匹配、',
  'workbench.docs.body.requestBody.graphql1Middle3': '为子串）对照',
  'workbench.docs.body.requestBody.graphql1Suffix': '进行测试。',
  'workbench.docs.body.requestBody.graphql2Prefix': '常用键：',
  'workbench.docs.body.requestBody.graphql2Middle': '对应具名操作，',
  'workbench.docs.body.requestBody.graphql2Suffix':
    '对应查询文本的子串。没有 JSON 正文、字段缺失或不匹配的请求原样通过。',
  'workbench.docs.body.requestBody.graphqlCaption': '字段级闸门——不匹配的操作原样流过。',
  'workbench.docs.body.requestBody.wontApplyCaption': 'GET/HEAD 没有可替换的内容；静态资源不进入脚本拦截。',
  'workbench.docs.body.requestBody.whenTitle': '何时使用',
  'workbench.docs.body.requestBody.when1':
    '强制测试固定数据、给每个负载盖上元数据（调试标志、请求 ID）、模拟特定的 GraphQL 操作，以及在重放前对 PII 匿名化，是四种典型模式。',
  'workbench.docs.body.requestBody.useCasesCaption': '四种典型模式——配合 URL 模式或域名来限定范围。',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    '拦截 API 调用并返回自定义响应——完全控制状态码、正文和响应标头。基于脚本——拦截',
  'workbench.docs.body.response.introAnd': '和',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption': '静态完全跳过网络；动态先访问网络，再转换。',
  'workbench.docs.body.response.staticTitle': '静态响应',
  'workbench.docs.body.response.static1':
    '返回固定正文，并完全控制合成响应——状态码、Content-Type，以及任何附加响应标头（Set-Cookie、CORS 标头、自定义标志）。真实请求永远不会发出。适合对着已知的固定测试数据做离线开发。',
  'workbench.docs.body.response.staticCaption': '服务器从未被联系——页面收到的固定数据就像来自线路一样。',
  'workbench.docs.body.response.dynamicTitle': '动态响应',
  'workbench.docs.body.response.dynamic1':
    '先发出真实请求。你的函数接收响应和请求上下文，然后返回修改后的响应。该函数接收',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    '规则上设置的状态码、Content-Type 和响应标头字段仍会叠加在函数返回值之上，因此你可以改动正文，同时让规则控制外层标头。',
  'workbench.docs.body.response.dynamicCaption': '真实调用先发生；函数改写返回的一切。',
  'workbench.docs.body.response.graphqlTitle': 'GraphQL 过滤',
  'workbench.docs.body.response.graphql1':
    '当资源类型为 GraphQL 时，规则只在 JSON 负载的配置字段匹配你设置的值（Equals 或 Contains）的请求上触发——因此一个复用多种操作的端点可以按操作逐个拦截。负载不匹配的请求径直通向网络，不受影响。',
  'workbench.docs.body.response.wontApplyCaption': '静态资源和页面导航永远不进入脚本拦截。',
  'workbench.docs.body.response.whenTitle': '何时使用',
  'workbench.docs.body.response.when1':
    '对着固定测试数据做离线开发、模拟特定错误响应、在 PII 到达页面之前遮蔽它，以及演练难以在真实后端复现的边缘负载形态。',
  'workbench.docs.body.response.useCasesCaption': '四种典型模式——固定数据选静态，真实数据转换选动态。',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    '条件是针对传出请求某一个属性的筛选器。堆叠多个条件时按 AND 逻辑组合——每个条件都必须匹配，规则才会触发。每个条件都直接映射到一个 Chrome',
  'workbench.docs.body.conditions.intro1Suffix': '字段。',
  'workbench.docs.body.conditions.intro2Prefix': '大多数条件在规则编辑器中还有',
  'workbench.docs.body.conditions.exclStrong': '排除',
  'workbench.docs.body.conditions.intro2Suffix':
    '变体——排除方法、排除资源、排除发起者、排除响应标头——把匹配反转（例如“除这些方法之外的一切”）。当反向集合小于正向集合时就用它们。',
  'workbench.docs.body.conditions.anatomyCaption': '规则把 AND 匹配的条件与一个操作配对——条件决定规则是否触发。',
  'workbench.docs.body.conditions.matchingCaption': '每个条件检查请求的一个属性。全部匹配，规则才触发。',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    '页面 URL 与 fetch 的目标 URL 分开跟踪——这就是为什么有两个域名条件。',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL 模式',
  'workbench.docs.body.conditions.urlPattern1Prefix': '针对完整 URL 的通配符模式。用',
  'workbench.docs.body.conditions.urlPattern1Middle': '匹配任意字符。协议必须写明：',
  'workbench.docs.body.conditions.urlPattern1Middle2': '表示任意协议，',
  'workbench.docs.body.conditions.urlPattern1Suffix': '表示仅 HTTPS。',
  'workbench.docs.body.conditions.urlPatternCaption':
    '金色 = 通配符，绿色 = 字面量。下方每个测试 URL 都标出模式是否匹配它。',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL 正则',
  'workbench.docs.body.conditions.urlRegex1':
    '针对包含协议的完整 URL 的 RE2 正则表达式。用于通配符无法表达的匹配。不能与 URL 模式组合在同一条规则中。',
  'workbench.docs.body.conditions.urlRegexCaption':
    '紫色 = 真正的正则语法。绿色 = 字面字符。下方每个测试 URL 都标出正则是否匹配。',
  'workbench.docs.body.conditions.requestDomainsTitle': '请求域名',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    '自动匹配一个域名及其全部子域名。只需输入一次顶点域名；规则即可覆盖',
  'workbench.docs.body.conditions.requestDomains1Suffix': '以及任何更深的嵌套，无需通配符。',
  'workbench.docs.body.conditions.requestDomainsCaption':
    '一个值，覆盖所有子域名。下方边界用例展示什么才算真正的子域名。',
  'workbench.docs.body.conditions.excludeDomainsTitle': '排除域名',
  'workbench.docs.body.conditions.excludeDomains1':
    '从另一个条件的匹配中减去主机——子域名语义与请求域名相同，排除一个主机也排除其子域名。它单独不匹配任何东西。',
  'workbench.docs.body.conditions.excludeDomainsCaption': '绿色包含缩小到候选集合；红色排除去掉其中一些。子域名跟随。',
  'workbench.docs.body.conditions.initiatorDomainsTitle': '发起者域名',
  'workbench.docs.body.conditions.initiatorDomains1':
    '按发出请求时打开的是哪个页面来匹配——请求的来源，而不是它的目的地。对同一 URL 的同一个 fetch 调用，可能匹配也可能不匹配，取决于用户正在浏览哪个标签页。',
  'workbench.docs.body.conditions.initiatorDomainsCaption': '相同目的地，两个不同的页面上下文。发起者决定哪一个匹配。',
  'workbench.docs.body.conditions.methodsTitle': '方法',
  'workbench.docs.body.conditions.methods1':
    '按 HTTP 动词筛选。多选——选中应当匹配的方法；其余的不会触发规则。完全不加此条件则匹配所有方法。',
  'workbench.docs.body.conditions.methodsCaption': '橙色药丸为选中；灰色被跳过。下方的测试请求追踪每个动词的结果。',
  'workbench.docs.body.conditions.resourceTypesTitle': '资源类型',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    '按正在加载的资源种类筛选——页面导航、XHR/fetch、脚本、图像、字体等。与“方法”一样多选。参见',
  'workbench.docs.body.conditions.resourceTypesLink': '资源类型',
  'workbench.docs.body.conditions.resourceTypes1Suffix': '参考，获取带代码名和具体示例的完整列表。',
  'workbench.docs.body.conditions.resourceTypesCaption': '紫色种类匹配；灰色种类被跳过。每个测试请求就地标出其种类。',
  'workbench.docs.body.conditions.domainTypeTitle': '域类型',
  'workbench.docs.body.conditions.domainType1Prefix': '按每个请求与页面的关系分类——目的地与页面共享可注册域名时为',
  'workbench.docs.body.conditions.domainType1Middle': '，否则为',
  'workbench.docs.body.conditions.domainType1Suffix':
    '。常见用法：拦截跟踪器（只匹配 thirdParty），或把规则限定到你自己的服务（只匹配 firstParty）。',
  'workbench.docs.body.conditions.domainTypeCaption':
    '页面横幅设定来源；选择器决定匹配哪一类；表格给出每个目的地的判定。',
  'workbench.docs.body.conditions.headersTitle': '响应标头',
  'workbench.docs.body.conditions.headers1':
    '匹配携带特定标头和特定值的响应。Chrome 的 DNR 不提供请求标头匹配——此条件仅限响应侧。标头名和值都按精确字符串比较（没有通配符、没有部分匹配），而且该标头必须真的出现在响应上。',
  'workbench.docs.body.conditions.headersCaption':
    '两颗药丸（名称 + 值）以 = 相连，随后是命中每种失败模式的测试响应标头。',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': '一切都在一个扩展里',
  'workbench.docs.body.paradigm.oneExtension1':
    '历史上有三类产品瓜分这片领域：桌面代理负责 HTTP 拦截，云端 API 平台保管你的请求和集合，轻量标头扩展覆盖“只改一个标头”的场景。它们谁也不带上另外两个。Open Headers 全都带上了——在单个浏览器扩展内，用一个工作区存储驱动每个界面。',
  'workbench.docs.body.paradigm.convergenceCaption': '三个传统品类汇聚成一次安装。没有别人把这个组合装进扩展里。',
  'workbench.docs.body.paradigm.ruleEngineHeading': '企业级规则引擎',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    '规则引擎不是把一个把戏摊到九个 UI 上——它是两条真实的执行路径，上面共享一种语言。',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR 原生',
  'workbench.docs.body.paradigm.ruleEngine1Middle': '规则会编译到 Chrome 的',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API，捕获浏览器发出的每个请求（页面、子框架、fetch、XHR、图像、字体、脚本）。',
  'workbench.docs.body.paradigm.scriptEngineStrong': '脚本引擎',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    '则接手 DNR 够不到的地方——按值合并标头、转换正文、模拟响应、注入代码、延迟调用。两套引擎读同一种条件语言和同样五个变量作用域，所以你对着 DNR 写的规则，换一个操作类型就迁移到了脚本引擎。',
  'workbench.docs.body.paradigm.ruleEngineCaption': '两条执行路径、九种规则类别、一种共享的条件 + 变量语言。',
  'workbench.docs.body.paradigm.apiCatalogHeading': '完整的 API 请求目录',
  'workbench.docs.body.paradigm.apiCatalog1':
    '桌面 API 客户端具备的每项能力——请求构建、环境、OAuth 2.0（包括 PKCE + Client Credentials + 刷新）、请求前与响应后脚本、带内容寻址文件 blob 的 multipart、集合 + 文件夹、带 schema 自省的 GraphQL——都住在扩展里。与规则同一个工作区存储、同样五个变量作用域、同样的界面。把你的集合从其他平台带过来继续干活；什么也不会导出回一个你无法控制的云。',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    '请求编辑器——协议支持、每种授权类型、脚本、文件和集合——都在扩展里。',
  'workbench.docs.body.paradigm.localFirstHeading': '设计上的本地优先',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '“本地优先”是一种姿态，不是一个功能。扩展没有账号系统、没有云中继、没有跟踪——唯一的使用数据是匿名的功能计数，可逐字节查验，一个开关即可关闭——而且你在后端',
  'workbench.docs.body.paradigm.localFirstWhere': '住在哪里',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    '这件事上有真正的选择。四种托管方式，全部仅限本地、全部在你掌控之下：浏览器内 Service Worker（今天即可，零设置）、桌面端应用的内嵌后端、在一台机器上服务所有 Open Headers 界面的独立本地服务器，或你在自己 VM 上自托管的后端。每种方式都保有同样的保证；取舍在于触达范围，而不是所有权。',
  'workbench.docs.body.paradigm.localFirst2': '团队协作经由用户掌控的存储后端（Git）交付——而不是经由供应商的服务器。',
  'workbench.docs.body.paradigm.frontEnds1Prefix': '同样的原则也适用于你',
  'workbench.docs.body.paradigm.frontEndsHow': '如何',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    '接触这些数据。浏览器扩展是默认前端——浏览器内的四个界面。原生桌面应用、CLI 和远程 Web 应用与它并肩交付。每个前端都对话你选定的后端；任意组合，每个界面都保持同步。',
  'workbench.docs.body.paradigm.autoSyncHeading': '自动同步，不丢你的工作',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    '跨设备同步通常是本地优先产品折腰、请你信任其云端的地方。Open Headers 在',
  'workbench.docs.body.paradigm.perFieldStrong': '按字段',
  'workbench.docs.body.paradigm.autoSync1Middle': '的层面解决它：弹窗切换某条规则的',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    '标志，工作区编辑器改写同一条规则里的标头值——两者以任意顺序都能落地，没有过期草稿横幅，没有覆盖。同一套方案从一个扩展的四个界面，扩展到一个本地服务器支撑扩展 + 桌面 + CLI，再到经由 Git 远程的多用户团队工作区——中间始终不需要供应商的服务器。',
  'workbench.docs.body.paradigm.fieldSyncCaption': '两个界面、一条规则、不同字段——两次编辑都落地，什么也没被覆盖。',
  'workbench.docs.body.paradigm.noteCalloutPrefix': '想看看这与你可能试过的其他工具相比如何？',
  'workbench.docs.body.paradigm.comparisonLink': '我们与同类的对比',
  'workbench.docs.body.paradigm.noteCalloutMiddle': '就在下一节。想一眼看完整个平台？跳到',
  'workbench.docs.body.paradigm.roadmapLink': '每个界面，皆已交付',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    '最短的版本：Open Headers 就是——把桌面代理的请求塑形能力、云端 API 平台的规则库和仅标头扩展的常驻界面拿来，让它们共享同一个存储——你会造出的东西。',
  'workbench.docs.body.comparison.matrixCaption': '三个产品品类，各有一组取舍——以及 Open Headers 落在哪里。',
  'workbench.docs.body.comparison.vsCloudHeading': '对比云端 API 平台',
  'workbench.docs.body.comparison.vsCloud1':
    '云托管工具期望你的流量、凭据和规则定义住在它们的服务器上。这个模式假定你不介意那些数据离开你的机器——也不介意为访问自己的工作而维护一个账号。Open Headers 两者都不假定。一切留在本地；团队协作经由用户掌控的存储（Git）交付，而不是经由供应商的数据库。',
  'workbench.docs.body.comparison.vsProxiesHeading': '对比桌面代理',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    '代理把你的全部流量导过一个独立进程。它们强大但笨重：安装二进制程序、安装 CA 证书、逐个应用配置代理端口。Open Headers 用 Chrome 的',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API 处理静态流量，用按页面的脚本引擎做动态转换。没有代理端口、没有 CA 证书、不用逐应用配置——匹配的规则以页面自己的权限生效，而不是以中间人的权限。',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': '对比仅标头扩展',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix': '仅标头扩展只处理一种规则类型，到此为止。Open Headers 处理',
  'workbench.docs.body.comparison.nineLink': '九种',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle': '——标头添加 / 覆盖 / 追加 / 移除 / 合并、',
  'workbench.docs.body.comparison.blockLink': '拦截',
  'workbench.docs.body.comparison.redirectLink': '重定向',
  'workbench.docs.body.comparison.queryParamsLink': '查询参数',
  'workbench.docs.body.comparison.injectLink': '注入',
  'workbench.docs.body.comparison.delayLink': '延迟',
  'workbench.docs.body.comparison.requestBodyLink': '请求体',
  'workbench.docs.body.comparison.responseLink': '响应',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '——全部由同一种',
  'workbench.docs.body.comparison.conditionLanguageLink': '条件语言',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': '驱动，全部经由同一个',
  'workbench.docs.body.comparison.requestTrackingLink': '请求跟踪',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': '界面可观察。',
  'workbench.docs.body.comparison.whyMattersTitle': '为什么这在实践中重要',
  'workbench.docs.body.comparison.whyMatters1':
    '大多数工作流会碰到不止一个品类。模拟一个 API 响应、拦截一个第三方跟踪器、把调试标头强加到某个特定环境，是三种不同的规则类型——在旧世界里是三次不同的安装。在这里，它们共享一个工作区。',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers 从纯本地起步——一台设备上的一个扩展。下面的每个里程碑都在不破坏这个形态的前提下延展它，而且每一个都已交付。跨用户同步经由',
  'workbench.docs.body.roadmap.userControlledStrong': '用户掌控',
  'workbench.docs.body.roadmap.intro1Suffix': '的手段交付——Git 仓库与自托管部署——绝不经由供应商托管的云。',
  'workbench.docs.body.roadmap.gitHeading': '经由 Git 的工作区协作（团队就绪）',
  'workbench.docs.body.roadmap.git1Prefix':
    '工作区序列化为 YAML，存进你掌控的 Git 仓库。拉取即同步；推送即分享；合并冲突用 Git 现成的工具解决。没有中心服务器、没有账号、没有供应商锁定。实时在场感就是',
  'workbench.docs.body.roadmap.gitAnd': '和',
  'workbench.docs.body.roadmap.git1Suffix': '——持久、可审计、早已被人理解。',
  'workbench.docs.body.roadmap.desktopHeading': '桌面端应用',
  'workbench.docs.body.roadmap.desktop1':
    '一个原生二进制程序，运行与扩展相同的工作区存储。适合扩展够不到的界面——系统级流量塑形、多窗口编辑、更深的文件系统集成。两者共享同一种磁盘格式，因此用桌面端应用打开扩展拥有的工作区是一次读取，而不是一次迁移。',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP 服务器——AI 智能体控制',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers 通过',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    '公开自身，因此任何支持 MCP 的 AI 客户端——Claude Desktop、Claude Code、Cursor、VS Code、Cline 及其身后不断壮大的生态——都能直接驱动你的工作区。用平实的语言让智能体添加一条标头规则、对 staging 运行一个已保存的请求、切换环境、对比两个工作区，或导入一个 Postman 集合；智能体把它翻译成 MCP 工具调用，你的工作区编辑器反映结果。',
  'workbench.docs.body.roadmap.mcp2Prefix': '服务器',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': '默认仅限本地',
  'workbench.docs.body.roadmap.mcp2Middle': '运行（stdio 传输，与同一台机器上的客户端一对一配对），自托管时支持',
  'workbench.docs.body.roadmap.mcpRemoteStrong': '面向远程的 HTTP/SSE',
  'workbench.docs.body.roadmap.mcp2Suffix':
    '。没有供应商中继；你的智能体直接对话你的安装。工具调用以你自己的工作区权限运行——机密留在 vault 之后，敏感操作保持可选启用。',
  'workbench.docs.body.roadmap.serverHeading': '用于跨设备同步的本地 / LAN 服务器',
  'workbench.docs.body.roadmap.server1':
    '一个可以跑在你的机器、你的 LAN 或一台隧道主机上的服务器。扩展、桌面端应用和 CLI 都成为同一个服务器的客户端——同样的工作区、同样的规则、同样的 vault，横跨你使用的每台设备。服务器留在本地网络上；没有叠加在上面的可选云通道。',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    '无界面脚本与 CI 集成。列出规则、切换环境、从 shell 运行单个已保存的请求、把一个工作区与另一个做对比。CLI 与扩展和桌面端应用对话同一个服务器，因此自动化与你在 UI 中看到的保持同步。',
  'workbench.docs.body.roadmap.webAppHeading': '自托管 VM 部署 + Web 应用',
  'workbench.docs.body.roadmap.webApp1':
    '同一套 UI 以 Web 包的形式交付，可从你自己的源站提供。适合锁死的企业浏览器、kiosk 设备，或任何装不了扩展的环境——也适合想在自己域名下部署品牌化 Open Headers 的用户。',
  'workbench.docs.body.roadmap.importersHeading': '导入器',
  'workbench.docs.body.roadmap.importers1':
    '在 cURL / HAR / Postman 导入器之外：Insomnia 集合、OpenAPI 规范和完整的 HAR 请求导入（不只是标头）——今天全部可用。导入器的对等能力是 Open Headers 赢得已投入其他工具的用户的方式——一步把你的集合带过来，继续干活。',
  'workbench.docs.body.roadmap.cloudCalloutTitle': '托管的云后端呢？',
  'workbench.docs.body.roadmap.cloudCallout1':
    '暂不提供——想要云托管的后端，可以在你自己的 VM 上自托管（见上文）。当下的重心是产品本身，而不是为最终用户运行和维护免费的云基础设施。如果你在搭建自托管部署时遇到麻烦，乐意帮忙；只是没有条件提供托管本身。',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': '添加 / 覆盖',
  'workbench.docs.anchor.override.summary': '把标头设为此值——缺失时添加，存在时覆盖任何现有值。',
  'workbench.docs.anchor.append.title': '追加',
  'workbench.docs.anchor.append.summary':
    '把此值追加到标头的现有值之后。只有标准的列表值标头支持追加——其他标头上规则会被保存为草稿。',
  'workbench.docs.anchor.remove.title': '移除',
  'workbench.docs.anchor.remove.summary': '把该标头从匹配的流量中完全剥除；值字段不使用。',
  'workbench.docs.anchor.merge.title': '合并',
  'workbench.docs.anchor.merge.summary': '把此值合并进标头的现有列表，已存在的值会被跳过。',
  'workbench.docs.anchor.qpAdd.title': '添加 / 覆盖',
  'workbench.docs.anchor.qpAdd.summary': '在 URL 上设置该参数——缺失时添加，已存在时覆盖。',
  'workbench.docs.anchor.qpOverride.title': '仅覆盖',
  'workbench.docs.anchor.qpOverride.summary': '仅当 URL 已携带该参数时才覆盖其值；不带它的 URL 原样通过。',
  'workbench.docs.anchor.qpRemove.title': '移除',
  'workbench.docs.anchor.qpRemove.summary': '从匹配的 URL 中移除该参数。',
  'workbench.docs.anchor.qpRemoveAll.title': '全部移除',
  'workbench.docs.anchor.qpRemoveAll.summary':
    '从匹配的 URL 中剥除整个查询字符串。它存在时，同一规则中的其他操作会被忽略。',
  'workbench.docs.anchor.urlPattern.title': 'URL 模式',
  'workbench.docs.anchor.urlPattern.summary': '用 urlFilter 模式匹配请求 URL——* 通配符、|| 域名锚点、^ 分隔符。',
  'workbench.docs.anchor.urlRegex.title': 'URL 正则',
  'workbench.docs.anchor.urlRegex.summary': '用正则表达式匹配请求 URL；捕获组供重定向目标中的 \\1、\\2 替换使用。',
  'workbench.docs.anchor.requestDomains.title': '请求域名',
  'workbench.docs.anchor.requestDomains.summary': '匹配目标主机是所列域名之一的请求，子域名也包含在内。',
  'workbench.docs.anchor.excludeDomains.title': '排除域名',
  'workbench.docs.anchor.excludeDomains.summary': '匹配除目标主机在列的请求之外的每个请求。',
  'workbench.docs.anchor.initiatorDomains.title': '发起者域名',
  'workbench.docs.anchor.initiatorDomains.summary': '按发出请求的页面匹配，而不是请求 URL 本身。“排除”变体反转此列表。',
  'workbench.docs.anchor.methods.title': '方法',
  'workbench.docs.anchor.methods.summary': '按 HTTP 方法（GET、POST 等）匹配。“排除”变体反转此列表。',
  'workbench.docs.anchor.conditionResourceTypes.title': '资源类型',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    '按浏览器正在获取的内容匹配——文档、脚本、XHR/fetch、图像等。“排除”变体反转此列表。',
  'workbench.docs.anchor.domainType.title': '域类型',
  'workbench.docs.anchor.domainType.summary': '第一方匹配指向与页面同一站点的请求；第三方匹配跨站请求。',
  'workbench.docs.anchor.headers.title': '响应标头',
  'workbench.docs.anchor.headers.summary': '按收到的响应上的某个标头匹配——按存在与否，或在给定值时按值匹配。',
  'workbench.docs.anchor.redirectRegex.title': '正则替换',
  'workbench.docs.anchor.redirectRegex.summary': '与 URL 正则条件配合，\\1、\\2 等把捕获的分组插入重定向目标。',
  'workbench.docs.anchor.requestBodyDynamic.title': '动态（JavaScript）',
  'workbench.docs.anchor.requestBodyDynamic.summary': '对每个匹配的请求运行你的 JavaScript，从原始正文构建传出正文。',
  'workbench.docs.anchor.responseDynamic.title': '动态（JavaScript）',
  'workbench.docs.anchor.responseDynamic.summary':
    '为每个匹配的响应运行你的 JavaScript——转换真实回复（网络）或从零构建一个（模拟）。',
  'workbench.docs.anchor.requestBodyGraphql.title': 'GraphQL 操作过滤',
  'workbench.docs.anchor.requestBodyGraphql.summary': '额外按请求负载中找到的 GraphQL 操作名对规则设闸。',
  'workbench.docs.anchor.responseGraphql.title': 'GraphQL 操作过滤',
  'workbench.docs.anchor.responseGraphql.summary': '额外按请求负载中找到的 GraphQL 操作名对规则设闸。',
} as const satisfies Catalog;
