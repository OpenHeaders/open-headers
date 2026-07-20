/**
 * DevTools panel — console tool window — Simplified Chinese. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level wire
 * names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context labels
 * (top / frame names / script URLs), source locations, "(anonymous)",
 * the browser's synthesized network phrasing quoted verbatim
 * (“finished loading”, “Access to fetch at …”), key names (Tab / Enter
 * / arrows ride raw — zh keyboards label the key Enter), and the
 * example-transcript rows in the (i) corpora. Network 面板 keeps the
 * raw panel name (de/es precedent). Mints: 提示符 = prompt (REPL);
 * 及早求值 = eager evaluation; 求值 = evaluate; 转录 = transcript;
 * 捕获 = capture; 堆栈跟踪 = stack trace (fixed CS compound — outside
 * the 追踪/跟踪 referent split); 固定 = pin; scope rides the debug-reach
 * 范围 (S19 law). OH's own setting labels quoted in prose copy this
 * file's mints in “”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': '清空控制台',
  'panel.console.collapseAll': '全部折叠',
  'panel.console.expandAll': '全部展开',
  'panel.console.filterAria': '筛选控制台消息',
  'panel.console.levelTitle': '日志级别：{label}',
  'panel.console.settings': '控制台设置',
  'panel.console.settingsPaneAria': '控制台设置',
  'panel.console.contextTitle': 'JavaScript 上下文——控制台命令在其中求值',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': '详细',
  'panel.console.levels.info': '信息',
  'panel.console.levels.warnings': '警告',
  'panel.console.levels.errors': '错误',
  'panel.console.levels.all': '所有级别',
  'panel.console.levels.defaultLevels': '默认级别',
  'panel.console.levels.hideAll': '全部隐藏',
  'panel.console.levels.only': '仅 {level}',
  'panel.console.levels.custom': '自定义级别',
  'panel.console.levels.default': '默认',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': '隐藏网络',
  'panel.console.setting.hideNetworkTitle': '隐藏浏览器的网络日志条目（失败和被拦截的请求）',
  'panel.console.setting.logXhr': '记录 XMLHttpRequest',
  'panel.console.setting.logXhrTitle': '当 XHR、fetch 或 EventSource 请求完成或失败时记录一条消息',
  'panel.console.setting.preserveLog': '保留日志',
  'panel.console.setting.preserveLogTitle': '导航时不清空日志',
  'panel.console.setting.eagerEval': '及早求值',
  'panel.console.setting.eagerEvalTitle': '对提示符中输入的文本及早求值（无副作用的预览）',
  'panel.console.setting.selectedContextOnly': '仅选定上下文',
  'panel.console.setting.selectedContextOnlyTitle': '仅显示来自选定上下文的消息',
  'panel.console.setting.autocompleteHistory': '从历史记录自动补全',
  'panel.console.setting.autocompleteHistoryTitle': '在提示符中输入时，建议你之前运行过的命令',
  'panel.console.setting.groupSimilar': '在控制台中对相似消息分组',
  'panel.console.setting.groupSimilarTitle': '将重复的相同消息折叠为带计数的一行',
  'panel.console.setting.evalUserGesture': '将代码求值视为用户操作',
  'panel.console.setting.evalUserGestureTitle': '以用户手势进行求值，使受用户激活限制的 API 可以在提示符中工作',
  'panel.console.setting.showCorsErrors': '在控制台中显示 CORS 错误',
  'panel.console.setting.showCorsErrorsTitle': '在页面自身的输出旁显示 CORS 策略错误',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': '示例控制台',
  'panel.console.info.hideNetwork.summary':
    '隐藏浏览器自身的网络日志条目——失败和被拦截的请求——页面的控制台输出则始终保留。',
  'panel.console.info.hideNetwork.description':
    '也会隐藏由“记录 XMLHttpRequest”合成的“finished loading”行——它们同样是来自网络源的消息。',
  'panel.console.info.logXhr.summary': '每当 XHR、fetch 或 EventSource 请求完成或失败时记录一行。',
  'panel.console.info.logXhr.description':
    '这些行以信息级别记录——失败也一样——其 URL 链接到该请求在 Network 面板中的行。“隐藏网络”也会隐藏这些行。',
  'panel.console.info.preserveLog.summary': '在页面导航之间保留日志，而不是清空它。',
  'panel.console.info.preserveLog.description':
    '关闭时，一次导航——页面的 top 上下文被重建——会把视图裁剪为其后到达的条目。',
  'panel.console.info.eagerEval.summary': '在提示符下方的灰色行中预览你正在输入的表达式的结果。',
  'panel.console.info.eagerEval.description':
    '预览以无副作用方式求值：会更改页面状态的表达式不会运行而是什么都不显示，在你按 Enter 之前也不会向日志写入任何内容。',
  'panel.console.info.selectedContextOnly.summary': '仅显示来自工具栏上下文选择器中所选 JavaScript 上下文的消息。',
  'panel.console.info.selectedContextOnly.description': '不带上下文的条目——浏览器自身的日志条目——始终可见。',
  'panel.console.info.autocompleteHistory.summary': '以提示符中变暗的补全形式，建议能接续你所输入内容的最近命令。',
  'panel.console.info.autocompleteHistory.description':
    'Tab——或在输入末尾按 →——接受它；↑/↓ 仍然遍历历史记录。历史记录只在当前面板会话内保留。',
  'panel.console.info.groupSimilar.title': '对相似消息分组',
  'panel.console.info.groupSimilar.summary': '将连续的相同消息折叠为带计数徽标的一行。',
  'panel.console.info.groupSimilar.description': '输入的命令及其结果从不分组——转录始终逐字保留。',
  'panel.console.info.evalUserGesture.summary': '运行提示符命令时，如同由用户手势触发。',
  'panel.console.info.evalUserGesture.description':
    '受用户激活限制的 API——打开窗口、写入剪贴板、全屏——在开启此项后可以从提示符成功调用。',
  'panel.console.info.showCorsErrors.summary':
    '显示浏览器的 CORS 解释——“Access to fetch at … has been blocked by CORS policy: …”——与页面自身的输出并列。',
  'panel.console.info.showCorsErrors.description':
    '关闭时只隐藏这些解释消息；被拦截的请求本身仍会显示在 Network 面板中。',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope': '捕获已停止——此标签页已离开调试模式的范围。正在显示最后捕获的输出。',
  'panel.console.banner.debugOff': '捕获已停止——调试模式已关闭。正在显示最后捕获的输出。',
  'panel.console.enableDebug': '启用调试模式',
  'panel.console.empty.noCdp.title': '控制台捕获需要调试模式',
  'panel.console.empty.noCdp.sub': '调试模式检查在此浏览器中不可用。',
  'panel.console.empty.capturing.title': '还没有控制台输出',
  'panel.console.empty.capturing.sub': '此标签页的日志消息和未捕获的异常会在发生时显示在这里。',
  'panel.console.empty.debugOff.title': '启用调试模式以查看控制台日志',
  'panel.console.empty.debugOff.sub': '调试模式开启期间，Open Headers 会捕获此标签页的控制台输出和未捕获的异常。',
  'panel.console.empty.outOfScope.title': '此标签页在调试模式的范围之外',
  'panel.console.empty.outOfScope.sub': '通过调试模式将其纳入范围——更改范围或固定此标签页——以捕获其控制台输出。',
  'panel.console.noMatch': '没有符合你的筛选条件的控制台条目。',
  'panel.console.revealedHidden': '定位到的消息被当前筛选隐藏',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 条相同消息' }),
  'panel.console.expandStack': '展开堆栈跟踪',
  'panel.console.collapseStack': '折叠堆栈跟踪',

  // REPL prompt
  'panel.console.prompt.waiting': '正在等待 JavaScript 上下文…',
  'panel.console.prompt.placeholder': '在选定的上下文中运行 JavaScript',
  'panel.console.prompt.aria': '控制台提示符',
  'panel.console.prompt.previewAria': '及早求值预览',
} as const satisfies Catalog;
