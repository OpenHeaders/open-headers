/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Simplified Chinese. Mirrors `catalogs/en/panel-docs.ts` key for key.
 * Filter grammar tokens, chord chips, and the FilterExample device ride
 * raw under the S18 diagram boundary; quoted example terms ride raw
 * inside keyed captions (“api”, “Users”); tool-window and detail tab
 * names (Network, Console, Storage, Headers, …) stay raw, including the
 * whole-raw `otherPlainGroup` list. Mints: 词条 = term; 匹配开关 =
 * match toggles (single toggle = 开关); 属性筛选器 = property filter;
 * 取反 = negation; 示例捕获 = example capture (捕获 carried); the
 * `otherSearchSuffix` chips fragment starts with the verb — the raw
 * chips act as subject (de/es precedent); Enter rides raw (zh keyboards
 * label the key Enter); 跟踪像素 carries the tracking-side 跟踪.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': '筛选语法',
  'panel.docs.nav.filterSyntax.summary': '文本 token、属性筛选器和匹配开关——每张卡片都筛选同一份共享的示例捕获。',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  // Filter grammar, toggle glyphs, chords, the × clear glyph, and the
  // FilterExample device ride raw — S18 diagram boundary. DiagramFrame
  // captions, card prose, titles and headings key.
  'panel.docs.filterSyntax.intro1Prefix': '流量筛选器组合了自由文本、',
  'panel.docs.filterSyntax.intro1Suffix':
    '属性筛选器和三个匹配开关。以空格分隔的词条必须全部匹配（AND）；下方每张卡片都在同一份含五个请求的示例捕获上运行自己的筛选——每张图都是这幅全景的一个切片。',
  'panel.docs.filterSyntax.intro2Prefix':
    '面板中的每个筛选输入框——Network、Console、Storage、Headers、Cookies、Initiator、Messages——都带有相同的三个开关',
  'panel.docs.filterSyntax.intro2MatchCase': '区分大小写',
  'panel.docs.filterSyntax.intro2WholeWord': '全字匹配',
  'panel.docs.filterSyntax.intro2Regex': '正则',
  'panel.docs.filterSyntax.intro2Middle': '，以及一个',
  'panel.docs.filterSyntax.intro2Suffix': '按钮，用于清除文本。',
  'panel.docs.filterSyntax.intro2Kbd': '键盘：',
  'panel.docs.filterSyntax.intro2KbdSuffix': '在输入框获得焦点时切换这些开关。',

  'panel.docs.filterSyntax.headingText': '文本筛选',
  'panel.docs.filterExample.captureHeading': '示例捕获',
  'panel.docs.filterSyntax.headingProperty': '属性筛选器',
  'panel.docs.filterSyntax.headingToggles': '匹配开关',
  'panel.docs.filterSyntax.headingElsewhere': '其他各处',

  'panel.docs.filterSyntax.textTitle': '文本',
  'panel.docs.filterSyntax.text1':
    '一个裸词条会保留 URL 包含它的每个请求。多个词条以 AND 组合——请求必须包含全部词条，位置不限。',
  'panel.docs.filterSyntax.textCaption': '两个词条——只有 URL 同时包含“api”和“users”的请求才会保留。',

  'panel.docs.filterSyntax.negationTitle': '取反',
  'panel.docs.filterSyntax.negation1Prefix': '前置的',
  'panel.docs.filterSyntax.negation1Middle': '会翻转任何 token：',
  'panel.docs.filterSyntax.negation1Middle2': '会隐藏匹配的请求而不是保留它们。对属性筛选器同样有效——',
  'panel.docs.filterSyntax.negationCaption': '除匹配取反词条的请求外，其余全部保留。',

  'panel.docs.filterSyntax.phraseTitle': '精确短语',
  'panel.docs.filterSyntax.phrase1Prefix': '引号把含空格的文本变成单个 token，并让诸如',
  'panel.docs.filterSyntax.phrase1Or': '或',
  'panel.docs.filterSyntax.phrase1Suffix': '之类的字符保持字面含义——对查询字符串很有用。',
  'panel.docs.filterSyntax.phraseCaption': '带引号的短语作为 URL 中一段连续内容进行匹配。',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '——这样的 token 检查请求的某个属性，而不是整个 URL。属性筛选器可与文本 token 及彼此组合——所有条件都必须匹配。',

  'panel.docs.filterSyntax.domainTitle': '域名',
  'panel.docs.filterSyntax.domain1Prefix': '按子串匹配主机名，因此填主域名即可命中它的每个子域名——',
  'panel.docs.filterSyntax.domain1Suffix': '——无需通配符。',
  'panel.docs.filterSyntax.domainCaption': '一个值覆盖 openheaders.com 的所有子域名；第三方主机不匹配。',

  'panel.docs.filterSyntax.statusCodeTitle': '状态码',
  'panel.docs.filterSyntax.statusCode1': '保留响应恰好带有此状态码的请求。待处理和失败的请求没有状态码，因此永不匹配。',
  'panel.docs.filterSyntax.statusCodeCaption': '只有 404 保留——精确匹配该状态码，而不是范围。',

  'panel.docs.filterSyntax.methodTitle': '方法',
  'panel.docs.filterSyntax.method1Prefix': '保留使用此 HTTP 动词的请求，比较时不区分大小写——',
  'panel.docs.filterSyntax.method1And': '和',
  'panel.docs.filterSyntax.method1Suffix': '是同一个筛选。',
  'panel.docs.filterSyntax.methodCaption': '只有 POST 保留。',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME 类型',
  'panel.docs.filterSyntax.mime1Prefix': '按子串匹配响应的内容类型——',
  'panel.docs.filterSyntax.mime1Catches': '命中',
  'panel.docs.filterSyntax.mime1Suffix': '命中所有图片格式。',
  'panel.docs.filterSyntax.mimeCaption': '两个 JSON 响应都保留；脚本、字体和图片不匹配。',

  'panel.docs.filterSyntax.responseHeaderTitle': '响应标头',
  'panel.docs.filterSyntax.respHeader1Prefix': '保留响应带有此确切名称标头的请求——值无关紧要。便于观察 CDN 缓存行为',
  'panel.docs.filterSyntax.respHeader1Suffix': '或缺失的安全标头（对它取反）。',
  'panel.docs.filterSyntax.respHeaderCaption': '只有 CDN 响应带有 x-cache 标头。',

  'panel.docs.filterSyntax.largerThanTitle': '大于',
  'panel.docs.filterSyntax.largerThan1': '保留传输量超过 N 字节的请求。后缀会缩放数字：',
  'panel.docs.filterSyntax.largerThanCaption': '只有 128 kB 的打包文件超过 100k 阈值。',

  'panel.docs.filterSyntax.fromCacheTitle': '来自缓存',
  'panel.docs.filterSyntax.fromCache1Prefix': '保留浏览器从缓存提供的响应——即',
  'panel.docs.filterSyntax.fromCache1Middle': '，或从未触网的磁盘/内存缓存命中。对它取反',
  'panel.docs.filterSyntax.fromCache1Suffix': '就能只看真正经过网络的请求。',
  'panel.docs.filterSyntax.fromCacheCaption': '只有已缓存的跟踪像素保留。',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    '输入框内的三个按钮改变文本 token 的比较方式。它们作用于自由文本（以及详情标签页上',
  'panel.docs.filterSyntax.togglesIntroMiddle': '风格的 token）；',
  'panel.docs.filterSyntax.togglesIntroSuffix': '而其他属性筛选器保持各自的语义。',

  'panel.docs.filterSyntax.matchCaseTitle': '区分大小写',
  'panel.docs.filterSyntax.matchCase1Prefix': '关闭时（默认），',
  'panel.docs.filterSyntax.matchCase1And': '和',
  'panel.docs.filterSyntax.matchCase1Suffix': '是同一个筛选。开启后，词条必须与 URL 的大小写完全一致。',
  'panel.docs.filterSyntax.matchCaseCaption': '开启 Aa 后，“Users”不匹配任何内容——捕获中的所有 URL 都是小写。',

  'panel.docs.filterSyntax.wholeWordTitle': '全字匹配',
  'panel.docs.filterSyntax.wholeWord1Prefix': '词条只在单词边界处匹配——',
  'panel.docs.filterSyntax.wholeWord1Suffix': '等字符都算作边界。当短词条埋在较长单词中时使用它。',
  'panel.docs.filterSyntax.wholeWordCaption': '“user”不再匹配“users”内部——关闭 ab 时，请求 #7 本会匹配。',

  'panel.docs.filterSyntax.regexTitle': '正则',
  'panel.docs.filterSyntax.regex1':
    '整个输入会作为一个正则表达式与 URL 匹配——此模式下不解析属性 token。无法编译的模式会让输入框变红，且不隐藏任何内容。',
  'panel.docs.filterSyntax.regexCaption': '一个模式匹配两种文件类型：以 .js 或 .woff2 结尾的 URL。',

  'panel.docs.filterSyntax.otherInputsTitle': '其他筛选输入框',
  'panel.docs.filterSyntax.otherIntroPrefix': '详情标签页带有相同的输入框和各自的属性键；开关和',
  'panel.docs.filterSyntax.otherIntroSuffix': '取反在每处的行为都相同：',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    '带三个开关的纯文本；Storage 还会在你输入时，在其导航栏上按分区统计匹配数。',
  'panel.docs.filterSyntax.otherSearchPrefix': '纯文本（或在',
  'panel.docs.filterSyntax.otherSearchMiddle': '下作为正则），带三个开关，按 Enter 提交。',
  'panel.docs.filterSyntax.otherSearchSuffix':
    '选择要扫描的数据——至少保留一个选中——每条结果都会打开其来源：请求标签页、存储分区或 Console。',
} as const satisfies Catalog;
