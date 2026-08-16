/**
 * Workbench variables station — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, {name} /
 * {message} holes. Page titles reuse the sidebar names quoted by the
 * variables doc body（工作区变量、Live 变量、环境、`Vault` raw）; the
 * Scope panel section titles ship the exact strings the doc body
 * quotes（在作用域内 / 所有作用域）; 作用域 throughout (S19 law);
 * 不带前缀的引用 = bare reference (docs-variables mint); 命名空间 =
 * namespace. Lowercase en `vault` in prose stays `vault` (per-case
 * token law); capitalized `Vault` stays Vault. Seed = 种子
 * (docs-variables precedent); capture = 捕获. MINTS: 解析器 = the
 * resolver; 绑定 = binding; the live markers 草稿 / 关 / 覆盖 mirror
 * the en draft / off / override chips; 证书 = certificate kind; 密码短语
 * = passphrase; 颁发者 = TOTP issuer.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': '变量',
  'workbench.variables.table.headerSecret': '机密',
  'workbench.variables.table.headerValue': '值',
  'workbench.variables.table.namePlaceholder': '名称',
  'workbench.variables.table.valuePlaceholder': '值',
  'workbench.variables.table.addVariable': '添加变量…',
  'workbench.variables.table.addSecret': '添加机密…',
  'workbench.variables.table.enableRow': '启用变量',
  'workbench.variables.table.disableRow': '禁用变量',
  'workbench.variables.table.markSensitive': '标记为敏感',
  'workbench.variables.table.unmarkSensitive': '取消敏感标记',
  'workbench.variables.table.showValue': '显示值',
  'workbench.variables.table.hideValue': '隐藏值',
  'workbench.variables.table.kindText': '文本',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': '证书',
  'workbench.variables.table.kindSecretManager': '机密管理器',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': '系统凭据存储',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': '提供方',
  'workbench.variables.table.smField.vault': '保险库',
  'workbench.variables.table.smField.item': '项目',
  'workbench.variables.table.smField.field': '字段',
  'workbench.variables.table.smField.account': '账户',
  'workbench.variables.table.smField.secretId': '机密 ID',
  'workbench.variables.table.smField.service': '服务',
  'workbench.variables.table.smField.name': '名称',
  'workbench.variables.table.smField.stage': '阶段',
  'workbench.variables.table.smField.region': '区域',
  'workbench.variables.table.smField.profile': '配置文件',
  'workbench.variables.table.smField.vaultUrl': '保险库 URL',
  'workbench.variables.table.smField.version': '版本',
  'workbench.variables.table.smField.mount': '挂载点',
  'workbench.variables.table.smField.path': '路径',
  'workbench.variables.table.smField.key': '键',
  'workbench.variables.table.smField.serverUrl': '服务器 URL',
  'workbench.variables.table.smFieldOptional': '{label}（可选）',
  'workbench.variables.table.smStatus.available': '可用',
  'workbench.variables.table.smStatus.notInstalled': '此设备上不可用',
  'workbench.variables.table.smStatus.integrationDisabled': '集成已禁用',
  'workbench.variables.table.smStatus.noCredentials': '未配置凭据',
  'workbench.variables.table.smStatus.locked': '已锁定',
  'workbench.variables.table.smStatus.unreachable': '无法访问',
  'workbench.variables.table.certPlaceholder': '证书（PEM）',
  'workbench.variables.table.certKeyPlaceholder': '私钥（PEM）',
  'workbench.variables.table.passphrasePlaceholder': '密钥的密码短语（可选）',
  'workbench.variables.table.showCertificate': '显示证书',
  'workbench.variables.table.hideCertificate': '隐藏证书',
  'workbench.variables.table.seedPlaceholder': 'Base32 种子',
  'workbench.variables.table.showSeed': '显示种子',
  'workbench.variables.table.hideSeed': '隐藏种子',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} 位 · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} 位 · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': '颁发者',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': '变量（{count}）',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': '工作区变量',
  'workbench.variables.workspace.description':
    '在此工作区的每个环境间共享。优先级最低——会被集合、环境和 vault 作用域覆盖。',
  'workbench.variables.workspace.saveFailed': '保存工作区变量失败',
  'workbench.variables.workspace.saveFailedDetail': '保存工作区变量失败：{message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': '未找到环境。',
  'workbench.variables.environment.activeTag': '活动',
  'workbench.variables.environment.defaultTag': '默认',
  'workbench.variables.environment.defaultTooltip': '当活动环境缺少某个变量时，解析器会回退到这里。',
  'workbench.variables.environment.setActive': '设为活动',
  'workbench.variables.environment.setDefault': '设为默认',
  'workbench.variables.environment.unsetDefault': '取消默认',
  'workbench.variables.environment.setDefaultTooltip': '设为默认——当活动环境缺少某个变量时，解析器会回退到这里。',
  'workbench.variables.environment.unsetDefaultTooltip': '取消默认——解析器将不再回退到此环境。',
  'workbench.variables.environment.deletedElsewhere': '环境已从另一个标签页中被删除',
  'workbench.variables.environment.updateFailed': '更新环境失败',
  'workbench.variables.environment.updateFailedDetail': '更新环境失败：{message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': '未找到集合。',
  'workbench.variables.collection.title': '{name} · 变量',
  'workbench.variables.collection.descriptionRule':
    '对此集合内每条规则可用的变量。会被环境和 vault 作用域覆盖；覆盖工作区作用域。以明文存储——机密请使用 Vault。',
  'workbench.variables.collection.descriptionRequest':
    '对此集合内每个请求可用的变量。会被环境和 vault 作用域覆盖；覆盖工作区作用域。以明文存储——机密请使用 Vault。',
  'workbench.variables.collection.descriptionTemplate':
    '对此集合内每个模板可用的变量。会被环境和 vault 作用域覆盖；覆盖工作区作用域。以明文存储——机密请使用 Vault。',
  'workbench.variables.collection.deletedElsewhere': '集合已从另一个标签页中被删除',
  'workbench.variables.collection.saveFailed': '保存集合变量失败',
  'workbench.variables.collection.saveFailedDetail': '保存集合变量失败：{message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner': 'Vault 机密在静态存储时加密、从不离开此设备，并优先于所有其他作用域。',
  'workbench.variables.vault.cipherLocked':
    '机密存储已锁定——系统拒绝了对其钥匙串的访问，本次会话无法读取或保存 vault 机密。',
  'workbench.variables.vault.cipherLockedRelaunch': '重新启动应用',
  'workbench.variables.vault.lockedTitle': 'Vault 已锁定——静态密钥丢失',
  'workbench.variables.vault.lockedDescription':
    '此 vault 的机密仍存储在此设备上，但已无法解密：封存它们的静态密钥不见了（清除了浏览器数据、新的用户配置文件，' +
    '或扩展密钥被重置）。编辑已被禁用，以免新条目覆盖被封存的数据。重新输入机密即可解锁 vault——现有条目会被替换。',
  'workbench.variables.vault.secretsCount':
    '机密（{strings} string · {totps} TOTP · {certs} 证书 · {refs} 机密管理器）',
  'workbench.variables.vault.saveFailed': '保存 vault 失败',
  'workbench.variables.vault.saveFailedDetail': '保存 vault 失败：{message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Live 变量',
  'workbench.variables.live.newVariable': '新建 Live 变量',
  'workbench.variables.live.descriptionPrefix':
    '每个绑定把一个名称映射到某个工作流（计划运行的请求链）的捕获值。在规则和请求中的引用形式为',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': '名称',
  'workbench.variables.live.headerValue': '值',
  'workbench.variables.live.headerWorkflow': '工作流',
  'workbench.variables.live.empty': '还没有 Live 变量。创建一个，把名称绑定到工作流的捕获值。',
  'workbench.variables.live.draftMarker': '草稿',
  'workbench.variables.live.offMarker': '关',
  'workbench.variables.live.overrideMarker': '覆盖',
  'workbench.variables.live.clickEyeToReveal': '点击眼睛以显示',
  'workbench.variables.live.showValue': '显示值',
  'workbench.variables.live.hideValue': '隐藏值',
  'workbench.variables.live.notCapturedYet': '尚未捕获',
  'workbench.variables.live.missingWorkflow': '缺少工作流',
  'workbench.variables.live.refreshNow': '立即刷新工作流',
  'workbench.variables.live.refreshAria': '刷新 {name}',
  'workbench.variables.live.editBinding': '编辑绑定（名称 / 启用 / 覆盖）',
  'workbench.variables.live.editAria': '编辑 {name}',
  'workbench.variables.live.delete': '删除',
  'workbench.variables.live.deleteAria': '删除 {name}',
  'workbench.variables.live.deleteFailed': '删除“{name}”失败',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': '环境',
  'workbench.variables.panel.scope.collection': '集合',
  'workbench.variables.panel.scope.workspace': '工作区',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': '在作用域内',
  'workbench.variables.panel.inContextTitleNamed': '在作用域内：{name}',
  'workbench.variables.panel.inContextSummary':
    '活动的规则、请求或模板引用的变量——每个都经过所有作用域解析，让你看到将要生效的确切值。打开其中之一前为空。',
  'workbench.variables.panel.allScopesTitle': '所有作用域',
  'workbench.variables.panel.allScopesSummary':
    '所有作用域中定义的每个变量，按解析优先级分组。打开某个作用域的 (i) 可了解如何引用它以及它的排位。',
  'workbench.variables.panel.sectionAboutAria': '关于{title}',
  'workbench.variables.panel.scopeAboutAria': '关于{scope}变量',
  'workbench.variables.panel.scopeSummary.vault': '按用户的机密，存储在你的 vault 中，从不同步。',
  'workbench.variables.panel.scopeSummary.environment': '来自活动环境的变量，带默认环境回退。',
  'workbench.variables.panel.scopeSummary.collection': '限定在活动集合内的变量。',
  'workbench.variables.panel.scopeSummary.workspace': '整个工作区共享的变量。',
  'workbench.variables.panel.scopeSummary.live': '由工作流支撑的值，从最近一次运行解析。',
  'workbench.variables.panel.scopeInfo.title': '{label}{qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': '机密',
  'workbench.variables.panel.scopeInfo.qualifierVariable': '变量',
  'workbench.variables.panel.scopeInfo.writePrefix': '写作',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': '——仅此一种，不能作为不带前缀的',
  'workbench.variables.panel.scopeInfo.orJustMiddle': '或就写',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': '不带前缀的',
  'workbench.variables.panel.scopeInfo.bareSuffix': '按优先级解析：',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live 位于此顺序之外。',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · 默认：{default}',
  'workbench.variables.panel.env.subtitleNoneDefault': '无环境 · 默认：{default}',
  'workbench.variables.panel.env.subtitleNone': '无环境',
  'workbench.variables.panel.env.editTooltip': '打开环境变量编辑器',
  'workbench.variables.panel.env.createTooltip': '创建你的第一个环境',
  'workbench.variables.panel.env.selectTooltip': '选择活动环境',
  'workbench.variables.panel.collection.noneActive': '没有活动集合',
  'workbench.variables.panel.live.resolvedCount': '已解析 {resolved}/{total}',
  'workbench.variables.panel.live.noneDefined': '未定义 Live 变量',
  'workbench.variables.panel.action.edit': '编辑',
  'workbench.variables.panel.action.editTooltip': '打开{scope}变量编辑器',
  'workbench.variables.panel.action.create': '创建',
  'workbench.variables.panel.action.select': '选择',
  'workbench.variables.panel.emptyScopeSecrets': '未定义机密。',
  'workbench.variables.panel.emptyScopeVariables': '未定义变量。',
  'workbench.variables.panel.openHint': '打开一个请求或规则，查看它引用的变量。',
  'workbench.variables.panel.noneReferenced': '此{noun}中没有引用任何变量。',
  'workbench.variables.panel.noun.rule': '规则',
  'workbench.variables.panel.noun.request': '请求',
  'workbench.variables.panel.noun.template': '模板',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), { other: '全部 {count} 个变量已解析' }),
  'workbench.variables.panel.unresolvedCount': '{count} 个未解析',
  'workbench.variables.panel.valueUnresolved': '未解析',
  'workbench.variables.panel.valueEmpty': '（空）',
  'workbench.variables.panel.showValue': '显示值',
  'workbench.variables.panel.hideValue': '隐藏值',
  'workbench.variables.panel.copyValue': '复制值',
  'workbench.variables.panel.copied': '已复制',
  'workbench.variables.panel.errors.title': '解析问题（{count}）',
  'workbench.variables.panel.errors.referenceTooltip': '{{…}} 内的原始引用',
  'workbench.variables.panel.errors.reason.unresolved': '未解析',
  'workbench.variables.panel.errors.reason.unsetInScope': '不在作用域内',
  'workbench.variables.panel.errors.reason.unknownNamespace': '未知命名空间',
  'workbench.variables.panel.errors.reason.stepOutOfContext': '步骤引用超出作用域',
  'workbench.variables.panel.errors.reason.empty': '空',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': '无效值',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': '需要授权',
  'workbench.variables.panel.errors.reason.secretNotFound': '未找到机密',
  'workbench.variables.panel.errors.reason.secretUnavailable': '管理器不可用',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': '复制验证码',
  'workbench.totpPreview.copied': '已复制',
  'workbench.totpPreview.refreshesTooltip': '{seconds}s 后刷新',
  'workbench.totpPreview.refreshesAria': 'TOTP 验证码 {seconds} 秒后刷新',
} as const satisfies Catalog;
