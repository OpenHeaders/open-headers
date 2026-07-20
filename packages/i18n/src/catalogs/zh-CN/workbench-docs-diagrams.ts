/**
 * Workbench Docs panel — SVG diagram labels — Simplified Chinese.
 * Mirrors `catalogs/en/workbench-docs-diagrams.ts` key for key.
 * Vocabulary is quoted from the shipped zh-CN catalogs: 作用域 =
 * scope, 不带前缀的引用 = bare reference, 遮蔽/被遮蔽 = shadowing/
 * shadowed, 阶梯 = the ladder, 遍历 = the walk (all from
 * `zh-CN/workbench-docs-variables.ts`); sidebar entry names copy
 * `zh-CN/workbench-chrome-sidebar.ts` verbatim（Vault、工作区变量、
 * Live 变量、环境、变量）; 公开 = expose and 发送 = Send reuse the
 * shipped editor mints. Monospace wire fragments and `{{ns.*}}`
 * tokens are whole-raw values copied verbatim. Sample identifiers
 * (staging, production, api_host) ride raw.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── 变量：解析阶梯 ──────────────────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    '一个不带前缀的变量引用依次经过 vault、环境、集合、工作区解析——第一个命中者胜出。Live、step、file 和 dynamic ' +
    '只能通过命名空间前缀访问。',
  'workbench.docs.diagrams.variables.ladder.title': '不带前缀的引用——第一个定义它的作用域胜出',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': '机密 · 仅限本设备',
  'workbench.docs.diagrams.variables.ladder.environment': '环境',
  'workbench.docs.diagrams.variables.ladder.environmentSub': '先活动环境，再默认环境',
  'workbench.docs.diagrams.variables.ladder.collection': '集合',
  'workbench.docs.diagrams.variables.ladder.collectionSub': '仅限活动集合',
  'workbench.docs.diagrams.variables.ladder.workspace': '工作区',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': '与所有人共享',
  'workbench.docs.diagrams.variables.ladder.miss': '未命中',
  'workbench.docs.diagrams.variables.ladder.railHeading': '仅命名空间',
  'workbench.docs.diagrams.variables.ladder.railFoot1': '只能通过前缀访问——',
  'workbench.docs.diagrams.variables.ladder.railFoot2': '绝不参与不带前缀的遍历',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}}——前缀把解析钉在一个作用域上。',

  // ── 变量：创建地图 ──────────────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    '侧边栏地图——集合变量在集合上，环境在“环境”之下，Vault、工作区变量和 Live 变量是顶级侧边栏条目',
  'workbench.docs.diagrams.variables.creation.title': '每个作用域在哪里创建',
  'workbench.docs.diagrams.variables.creation.workspaceName': '支付团队',
  'workbench.docs.diagrams.variables.creation.collections': '▾ 集合',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ 支付 API',
  'workbench.docs.diagrams.variables.creation.variables': '变量',
  'workbench.docs.diagrams.variables.creation.environments': '▾ 环境',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': '工作区变量',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Live 变量',
  'workbench.docs.diagrams.variables.creation.footer1': '集合带有自己的“变量”页面；',
  'workbench.docs.diagrams.variables.creation.footer2': '其余都是侧边栏条目。',

  // ── 变量：遮蔽 ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host 同时定义在环境和工作区中——不带前缀的引用解析为环境值；带命名空间的形式仍能读到工作区值',
  'workbench.docs.diagrams.variables.shadowing.title': '同一名称在两个作用域——更高者胜出',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ 胜出',
  'workbench.docs.diagrams.variables.shadowing.shadowed': '被遮蔽',
  'workbench.docs.diagrams.variables.shadowing.envLabel': '环境 · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': '工作区',
  'workbench.docs.diagrams.variables.shadowing.footer': '前缀跳过阶梯，直接读取一个作用域。',

  // ── 变量：Live 生命周期 ─────────────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Live Workflow 运行各步骤，把暴露的捕获值发布为 Live 变量，规则和请求消费它；自动刷新会重新运行工作流',
  'workbench.docs.diagrams.variables.live.title': '一次成功的运行发布该值',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': '第 1 步 · 登录',
  'workbench.docs.diagrams.variables.live.step2': '第 2 步 · 获取 token',
  'workbench.docs.diagrams.variables.live.expose': '公开：token',
  'workbench.docs.diagrams.variables.live.runSucceeds': '运行成功',
  'workbench.docs.diagrams.variables.live.publishes': '发布',
  'workbench.docs.diagrams.variables.live.rules': '规则',
  'workbench.docs.diagrams.variables.live.requests': '请求',
  'workbench.docs.diagrams.variables.live.autoRefresh': '自动刷新重新运行',
  'workbench.docs.diagrams.variables.live.footer1': '保存即激活工作流——该值只在一次成功的运行后出现，',
  'workbench.docs.diagrams.variables.live.footer2': '并按工作流的计划刷新。',

  // ── 变量：消费方 ────────────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    '一个模板化的值——Authorization: Bearer token——由规则、请求和工作流消费',
  'workbench.docs.diagrams.variables.consumers.title': '定义一次，处处引用',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': '规则',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': '标头、重定向、',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': '正文、注入',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': '当规则生效时',
  'workbench.docs.diagrams.variables.consumers.requests': '请求',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL、参数、',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': '标头、授权、正文',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': '点击“发送”时',
  'workbench.docs.diagrams.variables.consumers.workflows': '工作流',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': '每个步骤、',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': '链式捕获',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': '每次运行',
  'workbench.docs.diagrams.variables.consumers.footer1': '值在使用时代入——只需改一次变量，',
  'workbench.docs.diagrams.variables.consumers.footer2': '每条规则、每个请求和每个工作流都会拿到新值。',

  // ── 多标签页：并排同步总览 ──────────────────────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria': '两个工作区标签页并排打开——不同的工作区或不同的布局，并行工作',
  'workbench.docs.diagrams.multiTab.sync.title': '两个标签页，两个上下文——同时进行',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': '生产',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': '预发布',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': '规则',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': '请求',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': '环境',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': '认证标头',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': '绕过 CORS',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': '拦截广告',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': '规则编辑器',
  'workbench.docs.diagrams.multiTab.sync.envEditor': '环境编辑器',
  'workbench.docs.diagrams.multiTab.sync.footer1': '规则和集合通过存储同步。',
  'workbench.docs.diagrams.multiTab.sync.footer2': '每个标签页保留自己的工作区和布局。',

  // ── 多标签页：序号时间线 ────────────────────────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    '标签页编号时间线——序号在标签页的生命周期内保持稳定；关闭 #1 不会重新编号，下一个标签页得到 #4',
  'workbench.docs.diagrams.multiTab.numbering.title': '序号在标签页的生命周期内保持稳定',
  'workbench.docs.diagrams.multiTab.numbering.step1': '打开 1 个标签页',
  'workbench.docs.diagrams.multiTab.numbering.note1': '无前缀',
  'workbench.docs.diagrams.multiTab.numbering.step2': '再打开一个',
  'workbench.docs.diagrams.multiTab.numbering.note2': '出现前缀',
  'workbench.docs.diagrams.multiTab.numbering.step3': '打开第三个',
  'workbench.docs.diagrams.multiTab.numbering.step4': '关闭 #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 不变',
  'workbench.docs.diagrams.multiTab.numbering.step5': '再开一个',
  'workbench.docs.diagrams.multiTab.numbering.note5': '下一个是 #4',
  'workbench.docs.diagrams.multiTab.numbering.footer': '只有当所有工作区标签页都关闭后，编号才会重置为 #1。',

  // ── 多标签页：导航复用 ──────────────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    '导航复用——优先同一窗口。上：同一窗口已有工作区标签页，点击即激活。下：只有另一个窗口有，' +
    '新标签页在发起方窗口中打开。',
  'workbench.docs.diagrams.multiTab.navigation.title': '在弹窗中点击“编辑规则”——',
  'workbench.docs.diagrams.multiTab.navigation.subtitle': '弹窗会先在你自己的窗口中寻找工作区标签页',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': '同一窗口',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '——已有工作区标签页',
  'workbench.docs.diagrams.multiTab.navigation.window1': '窗口 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': '窗口 1（发起方）',
  'workbench.docs.diagrams.multiTab.navigation.window2': '窗口 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': '弹窗',
  'workbench.docs.diagrams.multiTab.navigation.editRule': '编辑规则 ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': '激活现有标签页 · 不新建标签页',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': '另一个窗口',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '——你的窗口没有',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ 新标签页',
  'workbench.docs.diagrams.multiTab.navigation.untouched': '保持原样 · 不抢占焦点',
  'workbench.docs.diagrams.multiTab.navigation.footer1': '与 Chrome 的 DevTools 按窗口停靠一致——',
  'workbench.docs.diagrams.multiTab.navigation.footer2': '你会留在原来所在的窗口。',

  // ── 多标签页：同步的内容（共享池） ──────────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    '跨标签页同步的内容——chrome.storage 保存规则、集合、文件夹、环境、变量、vault、请求、模板。' +
    '两个标签页都通过它读写。',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ 跨标签页同步',
  'workbench.docs.diagrams.multiTab.synced.subtitle': '每个标签页读写同一个 chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': '唯一事实来源',
  'workbench.docs.diagrams.multiTab.synced.pillRules': '规则',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': '集合',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': '文件夹',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': '环境',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': '变量',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': '请求',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': '模板',
  'workbench.docs.diagrams.multiTab.synced.tab1': '标签页 #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': '标签页 #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': '实时数据',
  'workbench.docs.diagrams.multiTab.synced.footer': '在任一标签页保存——另一个会立即重新加载。',

  // ── 多标签页：留在本地的内容 ────────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    '留在各自标签页的内容——布局分隔条比例和未保存的草稿。两个标签页明显不同：25/75 与 65/35 的拆分，' +
    '只有一个带草稿。',
  'workbench.docs.diagrams.multiTab.local.title': '✗ 留在各自标签页',
  'workbench.docs.diagrams.multiTab.local.subtitle': '分隔条比例和未保存的输入——只属于你操作的标签页',
  'workbench.docs.diagrams.multiTab.local.tabTitle': '标签页 {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': '布局',
  'workbench.docs.diagrams.multiTab.local.draftLabel': '未保存的草稿',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● 未保存',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': '没有未保存的更改',
  'workbench.docs.diagrams.multiTab.local.footer1': '每个标签页保留自己的分隔条和草稿。',
  'workbench.docs.diagrams.multiTab.local.footer2': '在你拖动之后打开的标签页会继承新布局。',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': '规则',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': '之前',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': '之后',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': '何时不生效',
  'workbench.docs.diagrams.headerActions.shared.suggestion': '建议',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    '四种标头操作应用于同一个起始标头——覆盖替换值，追加添加重复行，移除删除，合并拼接。',
  'workbench.docs.diagrams.headerActions.overview.title': '同一个起始标头 → 四种结果',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': '覆盖',
  'workbench.docs.diagrams.headerActions.overview.opAppend': '追加',
  'workbench.docs.diagrams.headerActions.overview.opRemove': '移除',
  'workbench.docs.diagrams.headerActions.overview.opMerge': '合并',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '（标头已移除）',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR——原生，由 Chrome 应用',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script——打补丁的 fetch / XHR（仅限合并）',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    '添加 / 覆盖——同一条规则覆盖两种情况。已有 X-Auth 标头则替换其值，缺失则添加。两种情况都到达同一结果。',
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': '覆盖',
  'workbench.docs.diagrams.headerActions.override.addLabel': '添加',
  'workbench.docs.diagrams.headerActions.override.replaceSub': '标头已存在',
  'workbench.docs.diagrams.headerActions.override.addSub': '尚无 X-Auth 标头',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '（无 X-Auth）',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': '值已替换',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': '标头已添加',
  'workbench.docs.diagrams.headerActions.override.stamp': '两种情况 → 一个带你的值的 X-Auth 标头',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    '当规则的条件不匹配请求时，添加 / 覆盖不会生效——静默无操作。建议：检查“请求域名”或“URL 模式”条件。',
  'workbench.docs.diagrams.headerActions.override.wontTitle': '请求发往不匹配的域名',
  'workbench.docs.diagrams.headerActions.override.wontDetail': '条件把守着操作——不匹配，就无操作。',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion': '检查规则的“请求域名”或“URL 模式”。',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    '追加会添加第二行同名标头——两行都会送达。之前只有一行 Set-Cookie；之后有两行，新的一行高亮。',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 重复行',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': '两行 Set-Cookie——两行都会送达。',
  'workbench.docs.diagrams.headerActions.append.stamp2': '用于 Set-Cookie、Link、Via——允许重复的标头。',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    '对不支持重复的标头，追加无法干净地生效——浏览器只保留一个。改用覆盖来替换，或用合并来拼接。',
  'workbench.docs.diagrams.headerActions.append.wontTitle': '不允许重复的标头',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    '例如 Authorization、Host、Content-Type——浏览器只保留一个。',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': '用覆盖来替换值。',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2': '用合并把值接到现有值后面。',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    '移除会删除目标标头。之前显示被划掉的 X-Frame-Options；之后只剩存留的 Content-Type 标头。',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': '目标已移除',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'X-Frame-Options 的所有实例都被删除。',
  'workbench.docs.diagrams.headerActions.remove.stamp2': '同名标头的重复行会被一次性全部移除。',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    '目标标头不存在时，移除是无操作——不会报错。若你想设置另一个值，请改用添加 / 覆盖。',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': '标头本就不存在',
  'workbench.docs.diagrams.headerActions.remove.wontDetail': '无操作——没有错误，请求原样通过。',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion': '若你想设置值而不是移除它，请用添加 / 覆盖。',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    '合并在运行时读取现有标头值，用分隔符把你的值接在后面，然后替换原值。',
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': '用分隔符拼接',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': '现有值 + 你的值，由分隔符连接。',
  'workbench.docs.diagrams.headerActions.merge.stamp2': "默认分隔符：'; ' 用于 Cookie，', ' 用于其他标头。",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    '合并只拦截 JS 发起的 fetch / XHR——页面导航和静态资源原样流过。这些情况请用添加 / 覆盖或追加（DNR）。',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': '页面导航',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1': '只有 JS 发起的 fetch / XHR 经过脚本引擎。',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': '静态资源（img、script、link）',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': '由浏览器发出——从不经过 fetch / XHR。',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion': '页面级标头请用添加 / 覆盖或追加（DNR）。',
} as const satisfies Catalog;
