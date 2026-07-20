/**
 * Workbench Docs panel — the Variables section body — Simplified
 * Chinese. Mirrors `catalogs/en/workbench-docs-variables.ts` key for
 * key. `{{ns.NAME}}` reference tokens ride raw as code chips composed
 * by the section body; `Vault` / `Live` / `Live Workflow` stay raw as
 * product and scope names (case follows the en key — lowercase
 * `vault` in prose stays lowercase); the `string` / `TOTP` vault
 * kinds ride raw. 作用域 = variable scope (S19 split law); 遮罩 =
 * masked (shipped mint); 机密 = secret. Sidebar entry names quoted in
 * prose copy the shipped `zh-CN/workbench-chrome-sidebar.ts` strings
 * verbatim（Vault、工作区变量、Live 变量、环境、变量）. MINTS:
 * 不带前缀的引用 = bare reference; 遍历 = the resolution walk; 阶梯 =
 * the ladder; 遮蔽 = shadowing (variable scopes — distinct from the
 * S79 evidence chip 被遮蔽 referent); 步骤 = workflow step.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    '任何可模板化的字段——标头值、重定向 URL、请求体、工作流步骤——都可以引用一个变量，写作',
  'workbench.docs.body.variables.intro1Suffix':
    '。值会在使用时代入，因此一个定义就能驱动提到它的每条规则、每个请求和每个工作流。变量存在于五个作用域中，' +
    '每个作用域在应用里有自己的家，当同一名称存在于多个作用域时也有自己的等级。',
  'workbench.docs.body.variables.ladderCaptionPrefix': '一个不带前缀的',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    '会自上而下走过四个作用域，在第一个命中处停下。Live 和其他带命名空间的作用域位于该遍历之外。',
  'workbench.docs.body.variables.scopesHeading': '五个作用域',
  'workbench.docs.body.variables.vaultHeading': 'Vault——机密，仅限本设备',
  'workbench.docs.body.variables.vault1Prefix':
    'vault 保存每台设备各自的机密：API 密钥、密码、TOTP 种子。Vault 条目从不同步、从不离开设备——它们不进入' +
    '工作区导出和 git 历史。存在两种类型：',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': '条目按原样解析，而',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    '条目解析为用存储的种子计算出的当前 6–8 位验证码——种子本身绝不会通过模板暴露。Vault 等级最高，因此 vault ' +
    '机密总是赢得不带前缀的引用。',
  'workbench.docs.body.variables.vaultCaptionPrefix': '在同步实体中用',
  'workbench.docs.body.variables.vaultCaptionSuffix': '引用机密——绝不要粘贴原始值。',
  'workbench.docs.body.variables.environmentHeading': '环境——可切换的值集',
  'workbench.docs.body.variables.environment1Prefix': '环境是你作为一个整体来回切换的一组命名变量——',
  'workbench.docs.body.variables.environment1Suffix':
    '，或队友的本地配置。活动环境在顶栏选择器中挑选；活动环境未定义的名称会先回退到默认环境，然后遍历再继续向下。' +
    '不选择任何环境也是有效状态——解析只是跳过该作用域。行可以标记为机密，其值在编辑器中以遮罩显示。',
  'workbench.docs.body.variables.environmentCaption': '一个名称，每个阶段一个值——切换环境，而不是复制规则。',
  'workbench.docs.body.variables.collectionHeading': '集合——限定在一个集合内',
  'workbench.docs.body.variables.collection1':
    '集合变量定义在集合上，只为属于它的规则和请求解析。对于只属于某一个 API 而非整个工作区的值——base URL、' +
    '租户 id、版本前缀——它们是最合适的家。',
  'workbench.docs.body.variables.collectionCaption': '集合变量只在自己的集合内解析——在其他地方，遍历会略过它们。',
  'workbench.docs.body.variables.workspaceHeading': '工作区——与所有人共享',
  'workbench.docs.body.variables.workspace1':
    '工作区变量是工作区范围的全局值——对每条规则、每个请求和每个工作流可见，并随工作区同步。它们等级最低，' +
    '因而是天然的基础层：把通用值放在这里，需要时让环境或集合覆盖它。',
  'workbench.docs.body.variables.workspaceCaption': '基础层——放处处成立的值。不放机密，也不放按阶段变化的值。',
  'workbench.docs.body.variables.liveHeading': 'Live——由工作流运行发布',
  'workbench.docs.body.variables.live1Prefix':
    'Live 变量由 Live Workflow 支撑——一条请求链完成登录、获取 token 并暴露一个捕获值。保存工作流即激活它；' +
    '一次成功的运行（手动或定时）发布被暴露的值，自动刷新会重新运行工作流以保持其新鲜。Live 值只能通过',
  'workbench.docs.body.variables.live1Suffix':
    '访问——绝不通过不带前缀的引用——因此当工作区或环境变量与其重名时，规则模板不会悄悄拿到一个刷新中的值。' +
    '编辑工作流的配方会把已发布的值标记为陈旧，直到下一次运行。',
  'workbench.docs.body.variables.liveRefCaptionPrefix': '始终带前缀——',
  'workbench.docs.body.variables.liveRefCaptionSuffix': '——且始终由工作流支撑，绝不是粘贴的 token。',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': '运行成功 → 暴露的捕获值发布为',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix': '→ 规则和请求消费它。计划任务会重新运行工作流。',
  'workbench.docs.body.variables.priorityHeading': '优先级与遮蔽',
  'workbench.docs.body.variables.priority1Prefix': '一个不带前缀的',
  'workbench.docs.body.variables.priority1Suffix':
    '按严格顺序穿过四个真实作用域——vault，然后是活动环境（带默认环境回退），然后是集合，最后是工作区——并在' +
    '第一个定义该名称的作用域停下。更低层的定义仍然存在；它们只是被遮蔽了。',
  'workbench.docs.body.variables.shadowingCaptionPrefix': '对不带前缀的引用，环境胜过工作区；',
  'workbench.docs.body.variables.shadowingCaptionSuffix': '仍能读到被遮蔽的值。',
  'workbench.docs.body.variables.namespacePin1Prefix':
    '每个作用域还有一个命名空间，可把解析钉在该作用域上，完全跳过阶梯：',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '。常规情况用不带前缀的形式；当你指的就是某个特定作用域、不管上层定义了什么时，用带命名空间的形式。',
  'workbench.docs.body.variables.tipTitle': '把机密放进 vault',
  'workbench.docs.body.variables.tip1Prefix': '规则、请求和工作流随工作区同步——vault 不会。在同步实体中引用',
  'workbench.docs.body.variables.tip1Suffix': '，每位队友在本地提供自己的值；任何敏感内容都不会落入共享数据。',
  'workbench.docs.body.variables.rulesHeading': '规则中的变量',
  'workbench.docs.body.variables.rules1':
    '规则携带的几乎每个字符串都可模板化：条件值（域、URL 模式、标头名）、标头值、重定向 URL、查询参数的名称' +
    '和值、静态请求体和响应体、注入代码、WS / SSE 负载，以及 Basic 认证凭据。规则编辑器会高亮每个引用，悬停时' +
    '显示解析后的值，并对解析不了的引用亮出横幅——在每个引用都有值之前，未解析的规则无法生效。',
  'workbench.docs.body.variables.consumersCaption': '一个模板化的值供给全部三个消费界面——在各自适用之处代入。',
  'workbench.docs.body.variables.dynamicNoteTitle': '动态（JS）正文不做模板替换',
  'workbench.docs.body.variables.dynamicNote1Prefix': '处于',
  'workbench.docs.body.variables.dynamicWord': '动态',
  'workbench.docs.body.variables.dynamicNote1Middle':
    '模式的请求体和响应规则运行你的 JavaScript，而不是替换模板——代码自己计算它的值。只有',
  'workbench.docs.body.variables.staticWord': '静态',
  'workbench.docs.body.variables.dynamicNote1Middle2': '正文参与',
  'workbench.docs.body.variables.dynamicNote1Suffix': '替换。',
  'workbench.docs.body.variables.requestsHeading': '请求中的变量',
  'workbench.docs.body.variables.requests1Prefix':
    '在 API 客户端中，URL、查询参数、标头、授权字段和正文都在发送时解析——包括请求所在集合的集合变量。' +
    '无法解析的引用会阻止发送并报出缺失变量的名称，而不是把字面的',
  'workbench.docs.body.variables.requests1Suffix': '发到线路上。',
  'workbench.docs.body.variables.workflowsHeading': '工作流中的变量',
  'workbench.docs.body.variables.workflows1Prefix': '每个 Live Workflow 步骤都像请求一样解析，外加一个额外作用域：',
  'workbench.docs.body.variables.workflows1Suffix':
    '引用同一次运行中较早步骤捕获的值——第 1 步登录，第 2 步花掉会话 token。步骤引用只在链执行期间存在；' +
    '标记为暴露的捕获值，会在运行成功时发布为 Live 变量。',
  'workbench.docs.body.variables.namespacesHeading': '纯命名空间助手',
  'workbench.docs.body.variables.helpers1': '还有三个命名空间解析的值根本不是存储的变量。',
  'workbench.docs.body.variables.helpersDynamicMiddle': '运行一个内置生成器——',
  'workbench.docs.body.variables.helpersFriends':
    '等等——在每次解析时产出新值：API 客户端里每次发送一次，静态规则每次编译一次（该值被固化，直到下次重新编译）。',
  'workbench.docs.body.variables.helpersFileMiddle': '按名称引用一个已存储的文件。而',
  'workbench.docs.body.variables.helpersStepSuffix':
    '（见上文）只在运行中的工作流链内有意义。它们都不参与不带前缀的遍历——只能通过各自的前缀访问。',
  'workbench.docs.body.variables.inspectingHeading': '创建与查看',
  'workbench.docs.body.variables.create1Prefix': '每个作用域都从侧边栏创建：',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': '工作区变量',
  'workbench.docs.body.variables.createAnd': '和',
  'workbench.docs.body.variables.sidebarLiveVars': 'Live 变量',
  'workbench.docs.body.variables.create1Middle': '是顶级条目；环境添加在',
  'workbench.docs.body.variables.sidebarEnvironments': '环境',
  'workbench.docs.body.variables.create1Middle2': '之下；每个集合有自己的',
  'workbench.docs.body.variables.sidebarVariables': '变量',
  'workbench.docs.body.variables.create1Suffix': '页面。',
  'workbench.docs.body.variables.creationMapCaption': '侧边栏中每个变量的家，标注了它供给的命名空间。',
  'workbench.docs.body.variables.inspect1Prefix': '名为',
  'workbench.docs.body.variables.inspect1Middle': '的工具窗口是查看变量的界面。',
  'workbench.docs.body.variables.inScopeLabel': '在作用域内',
  'workbench.docs.body.variables.inspect1Middle2':
    '列出获得焦点的规则、请求或模板实际引用的变量——每个都经过完整阶梯解析，让你看到将要生效的确切值。',
  'workbench.docs.body.variables.allScopesLabel': '所有作用域',
  'workbench.docs.body.variables.inspect1Middle3': '列出任何地方定义的一切，按优先级分组。在任何可模板化字段中，输入',
  'workbench.docs.body.variables.inspect1Suffix':
    '会打开列出所有可解析名称的建议器，悬停一个引用则显示其解析值和胜出的作用域。',
} as const satisfies Catalog;
