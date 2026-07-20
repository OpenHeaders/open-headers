/**
 * Resolution-hint family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; see that file
 * for the core-mirror rules. Raw by design inside keyed sentences:
 * `{{name}}` / `{{namespace.name}}` / `{{dynamic.uuid}}` /
 * `{{step.<stepId>.<captureName>}}` reference syntax, namespace ids
 * (env, vault, …), `requestDomains` / sha256 / punycode technical
 * vocabulary, Vault the surface name, the Live product prefix
 * (Live 变量 / Live 工作流). MINTS: 命名空间 = namespace; 环境 =
 * environment; 集合 = collection; 工作流 = workflow; 作用域 = scope;
 * 机密 = secret; 槽位 = slot; 裸主机名 = bare hostname; 清理 =
 * sanitization; 后备 = fallback.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': '引用为空。请使用 {{name}} 或 {{namespace.name}}。',
  'shared.resolutionHint.unknownNamespace':
    '未知的命名空间。有效的命名空间：env、vault、collection、workspace、file、live、step、dynamic。',
  'shared.resolutionHint.unset.envActive': '在“环境”→ 活动环境中设置此变量（或在默认环境中设置，作为后备）。',
  'shared.resolutionHint.unset.envNoActive': '未选择活动环境。请在“环境”中选择一个，或设置默认环境。',
  'shared.resolutionHint.unset.vault': '在 Vault 中设置此机密。',
  'shared.resolutionHint.unset.collection': '在当前集合中设置此变量。',
  'shared.resolutionHint.unset.workspace': '在工作区变量中设置此变量。',
  'shared.resolutionHint.unset.file': '在“设置”→“文件”中上传此文件（或通过其 sha256 哈希引用它）。',
  'shared.resolutionHint.unset.live': '没有同名的 Live 变量。请在“Live 变量”中创建一个，或等待其首次刷新填充数据。',
  'shared.resolutionHint.unset.step': '在此工作流运行中找不到该步骤 id 或捕获名称。请检查工作流步骤配置。',
  'shared.resolutionHint.unset.dynamic':
    '没有同名的内置生成器。请从建议列表中选择一个（{{dynamic.uuid}}、{{dynamic.timestamp}} 等）。',
  'shared.resolutionHint.unset.generic': '在此作用域中未设置。',
  'shared.resolutionHint.stepOutOfContext': '步骤引用（{{step.<stepId>.<captureName>}}）只在 Live 工作流步骤内有效。',
  'shared.resolutionHint.unresolved': '在 vault、环境、集合或工作区中都找不到。请在其中一个作用域中定义它。',
  'shared.resolutionHint.invalidDomain.whitespace':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含空白字符（请用逗号分隔主机名）。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.scheme':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含 scheme——请去掉协议前缀。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.wildcard':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含通配符——requestDomains 会自动匹配子域。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.port':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含端口——requestDomains 只按主机名匹配。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.uppercase':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含大写字符——requestDomains 只接受小写 ASCII。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.nonAscii':
    '变量解析出的值被 Chrome 在此槽位拒绝——包含 Chrome 拒绝的字符（IDN 名称请使用 punycode）。请使用以逗号分隔的裸主机名。',
  'shared.resolutionHint.invalidDomain.empty':
    '变量解析出的值被 Chrome 在此槽位拒绝——清理后为空。请使用以逗号分隔的裸主机名。',
} as const satisfies Catalog;
