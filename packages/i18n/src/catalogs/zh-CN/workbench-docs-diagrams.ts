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
} as const satisfies Catalog;
