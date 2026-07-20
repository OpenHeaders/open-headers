/**
 * Workbench Docs panel — the Debug Mode section body — Simplified
 * Chinese. Mirrors `catalogs/en/workbench-docs-debug-mode.ts` key for
 * key. UI labels the prose references copy the shipped
 * `zh-CN/shared-chrome.ts` strings verbatim（附加到、打开了 DevTools
 * 的位置、获得焦点的标签页、两者、包含此浏览器标签页、已附加的标签页、
 * 标签页超出范围、系统状态、调试模式）; Overrides = 覆盖项 (panel
 * mint); the browser banner quote rides verbatim raw en inside “”.
 * 范围 = debug reach (S19 split law); 启发式 = heuristic
 * (panel-inspector-cookies precedent). MINT: 指示条 = the footer pill
 * (prose reference); 调试模式关闭 = the rules-list badge (future
 * editors-rule zh-CN must reuse). Raw by design: the `● Debug mode`
 * pill chip and `fetch` / `XHR` code chips composed by the section
 * body, `CSP`, worker/cross-origin vocabulary per the panel parity
 * laws.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': '调试模式',
  'workbench.docs.body.debugMode.intro1':
    '把 Open Headers 附加到浏览器的调试协议上，从而检查并修改普通扩展 API 无法触及的流量。这与浏览器自带' +
    '开发者工具使用的是同一套机制——因此在它开启期间，浏览器会显示一条',
  'workbench.docs.body.debugMode.introBanner': '“OH started debugging this browser”',
  'workbench.docs.body.debugMode.intro1Suffix': '横幅。',
  'workbench.docs.body.debugMode.intro2':
    '标准模式（调试模式关闭）已经覆盖了大多数规则——标头、拦截、重定向、查询参数，以及页面上下文中的请求体 / ' +
    '响应 / 注入规则。调试模式是为它们够不到的部分准备的自愿升级：导航、Worker、跨源框架，以及整个标签页的' +
    '环境更改。',
  'workbench.docs.body.debugMode.controlHeading': '在哪里控制它',
  'workbench.docs.body.debugMode.control1Prefix': '这条',
  'workbench.docs.body.debugMode.control1Middle': '指示条位于每个界面的页脚，紧挨在',
  'workbench.docs.body.debugMode.systemStatusLink': '系统状态',
  'workbench.docs.body.debugMode.control1Suffix':
    '左侧。内嵌开关负责开启和关闭，彩色圆点跟踪它的健康状况，点击圆点 + 标签会打开一个弹出框，包含其余的一切' +
    '——范围、按标签页固定，以及当前已附加标签页的列表。',
  'workbench.docs.body.debugMode.surfaceCaption': '内嵌开关负责开启；圆点 + 标签打开弹出框，处理其余的一切。',
  'workbench.docs.body.debugMode.scopeHeading': '选择要检查的对象',
  'workbench.docs.body.debugMode.scope1Prefix': '下拉框',
  'workbench.docs.body.debugMode.attachTo': '附加到',
  'workbench.docs.body.debugMode.scope1Middle': '决定调试模式附加到哪些标签页——',
  'workbench.docs.body.debugMode.scopeDevtools': '打开了 DevTools 的位置',
  'workbench.docs.body.debugMode.scope1DevtoolsParen': '（仅限打开了 Open Headers 面板的标签页；最窄的默认值），',
  'workbench.docs.body.debugMode.scopeFocused': '获得焦点的标签页',
  'workbench.docs.body.debugMode.scope1FocusedParen': '（随你切换而跟随活动标签页），或',
  'workbench.docs.body.debugMode.scopeBoth': '两者',
  'workbench.docs.body.debugMode.scope1BothParen': '（两者的并集）。',
  'workbench.docs.body.debugMode.consent1Prefix': '选定一个范围',
  'workbench.docs.body.debugMode.consentIs': '就是',
  'workbench.docs.body.debugMode.consent1Middle':
    '对浏览器横幅的同意——没有单独的提示。当前标签页尚未被该范围覆盖时，会出现一个',
  'workbench.docs.body.debugMode.includeTabPin': '包含此浏览器标签页',
  'workbench.docs.body.debugMode.consent1Suffix': '固定项，让你附加这一个标签页，而不必为其他一切扩大范围。',
  'workbench.docs.body.debugMode.attached1Prefix': '列表',
  'workbench.docs.body.debugMode.attachedTabs': '已附加的标签页',
  'workbench.docs.body.debugMode.attached1Suffix':
    '展示调试模式当前正在驱动的每个标签页，各自带有跳转到该标签页的操作。已附加集合始终根据你的范围、你的固定' +
    '项以及哪些面板处于打开状态重新计算——它反映的是当下，绝不是陈旧的快照。',
  'workbench.docs.body.debugMode.scopeCaption': '已附加集合每次都重新推导——重新附加会重放它，不存储任何东西。',
  'workbench.docs.body.debugMode.bannerCalloutTitle': '横幅是浏览器全局的',
  'workbench.docs.body.debugMode.banner1Prefix':
    '调试模式开启期间，浏览器的“OH started debugging this browser”横幅会显示在',
  'workbench.docs.body.debugMode.bannerEvery': '每个',
  'workbench.docs.body.debugMode.banner1Suffix':
    '标签页上——而不只是它附加到的那些。这是浏览器自身的行为；关闭调试模式会立即移除它。',
  'workbench.docs.body.debugMode.unlocksHeading': '它解锁了什么',
  'workbench.docs.body.debugMode.unlocksIntro': '在已附加的标签页上，规则和控制能越过页面上下文：',
  'workbench.docs.body.debugMode.anyRequestLead': '任何请求，任何上下文。',
  'workbench.docs.body.debugMode.anyRequest1': '模拟或改写顶层导航、Worker 请求和跨源 iframe——而不仅是页面的',
  'workbench.docs.body.debugMode.anyRequest2':
    '。请求体和响应体可以在这些同样的上下文中读取和转换，HTTP 身份验证质询也会为开发代理和预发环境自动应答。',
  'workbench.docs.body.debugMode.injectionLead': '更强的注入。',
  'workbench.docs.body.debugMode.injection1':
    '脚本注入变得无竞争且不受 CSP 影响，并能深入标准页面上下文路径触碰不到的 Worker 和跨源框架。',
  'workbench.docs.body.debugMode.tabEnvLead': '标签页环境。',
  'workbench.docs.body.debugMode.tabEnv1':
    '精确的缓存禁用、网络限速 / 离线，以及 User-Agent / 区域设置 / 时区 / 媒体覆盖——按标签页设置于面板工具栏和',
  'workbench.docs.body.debugMode.overrides': '覆盖项',
  'workbench.docs.body.debugMode.tabEnv2': '界面。',
  'workbench.docs.body.debugMode.reachCaption':
    '标准模式覆盖页面的 fetch / XHR；已附加的标签页把同样的规则扩展到其余的一切。',
  'workbench.docs.body.debugMode.silentHeading': '规则绝不无声失败',
  'workbench.docs.body.debugMode.silent1Prefix': '需要调试模式才能完全生效的规则，在它关闭期间会在规则列表中显示',
  'workbench.docs.body.debugMode.badgeOff': '调试模式关闭',
  'workbench.docs.body.debugMode.silent1Middle': '徽章，而当它开启但标签页不在范围内时，面板中会出现',
  'workbench.docs.body.debugMode.badgeOutOfScope': '标签页超出范围',
  'workbench.docs.body.debugMode.silent1Middle2': '提示。规则仍会通过标准页面上下文路径执行它',
  'workbench.docs.body.debugMode.silentCan': '能做',
  'workbench.docs.body.debugMode.silent1Suffix': '的一切——启用调试模式只是把同一条规则扩展到页面注入触及不到的上下文。',
  'workbench.docs.body.debugMode.colorsHeading': '状态颜色',
  'workbench.docs.body.debugMode.colors1Prefix': '圆点映射',
  'workbench.docs.body.debugMode.colors1Suffix': '行：',
  'workbench.docs.body.debugMode.statesCaption': '关闭时为灰色；开启后为绿 / 黄 / 红。',
  'workbench.docs.body.debugMode.stateGreenLabel': '绿色',
  'workbench.docs.body.debugMode.stateOn': '开启',
  'workbench.docs.body.debugMode.stateOnRest': '且干净地完成附加。（关闭时圆点就是灰色。）',
  'workbench.docs.body.debugMode.stateYellowLabel': '黄色',
  'workbench.docs.body.debugMode.stateYellowPrefix': '某个标签页',
  'workbench.docs.body.debugMode.stateYellowTerm': '回退到了启发式',
  'workbench.docs.body.debugMode.stateYellowSuffix': '——通常是因为浏览器的调试横幅被关掉了，于是该标签页退回标准观察。',
  'workbench.docs.body.debugMode.stateRedLabel': '红色',
  'workbench.docs.body.debugMode.stateRedPrefix': '某个标签页',
  'workbench.docs.body.debugMode.stateRedTerm': '附加失败',
  'workbench.docs.body.debugMode.stateRedSuffix': '——无法为它启动调试协议。',
  'workbench.docs.body.debugMode.chromiumTitle': '仅限 Chromium',
  'workbench.docs.body.debugMode.chromium1':
    '调试模式依赖一个只有基于 Chromium 的浏览器向扩展开放的调试协议。在 Firefox 和 Safari 中该指示条保持隐藏；' +
    '上面的标准模式规则在任何地方都可用。',
} as const satisfies Catalog;
