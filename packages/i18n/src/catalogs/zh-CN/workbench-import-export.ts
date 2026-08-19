/**
 * Import/export family — Simplified Chinese. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI), file extensions and
 * filenames rendered as `<Text code>` chips (`.bru`,
 * `.openheaders.yaml`), export ids / fingerprints / entity names
 * ({id} / {name} holes carry data), the ` · ` separator glyphs,
 * Postman menus and glyph labels verbatim raw (Postman does not
 * localize Simplified Chinese), `uid` / `{{template}}` tokens, and
 * `vault` lowercase per the glossary. Chrome DevTools paths quote the
 * real zh strings（以 HAR 格式保存所有内容 / 以 cURL 格式复制 — S79
 * localized-browser law）. The hub quotes the 导入中心 mint
 * (settings-defs-keyboard); the report hover quotes the shipped
 * settings path 设置 → 数据. MINTS: 指纹 = fingerprint; 密文 =
 * ciphertext; 丢弃项 = drop (import ledger noun — 拒绝/已丢弃
 * referents unchanged); 转换 = transform; merge strategies
 * “添加为新项” / “替换现有项” (settings-defs must reuse); 扫描这台电脑
 * = Scan this computer; 严格字面 = strict literal; 匿名化 = anonymize.
 * 密码短语 / 机密 / 涂黑 / 标注 / 预设 / 范围 (export scope) carried.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': '导出',
  'workbench.importExport.export.cancel': '取消',
  'workbench.importExport.export.download': '下载',
  'workbench.importExport.export.sourceLabel': '来源：',
  'workbench.importExport.export.scopeLabel': '范围：',
  'workbench.importExport.export.filenameLabel': '文件名：',
  'workbench.importExport.export.scopeWholeWorkspace': '整个工作区',
  'workbench.importExport.export.vaultSecrets': 'Vault 机密',
  'workbench.importExport.export.vaultOmit': '省略（默认）',
  'workbench.importExport.export.vaultEncrypted': '加密（密码短语）',
  'workbench.importExport.export.vaultPlaintext': '明文（高级）',
  'workbench.importExport.export.passphrasePlaceholder': '密码短语',
  'workbench.importExport.export.confirmPassphrasePlaceholder': '确认密码短语',
  'workbench.importExport.export.hintPlaceholder': '可选提示（接收者可见——绝不要写密码短语本身）',
  'workbench.importExport.export.strengthEmpty': '输入密码短语',
  'workbench.importExport.export.strengthWeak': '弱',
  'workbench.importExport.export.strengthFair': '一般',
  'workbench.importExport.export.strengthGood': '良好',
  'workbench.importExport.export.strengthStrong': '强',
  'workbench.importExport.export.strengthNote':
    '密码短语强度：{label}。请通过带外渠道分享密码短语（Signal、密码管理器、口头）。任何持有密码短语的人都能读取此导出中的每个机密。',
  'workbench.importExport.export.plaintextTitle': '看到此文件的任何人都能读取明文机密',
  'workbench.importExport.export.plaintextUseOnly': '仅在与你完全信任的系统共享时使用（例如备份到你自己的加密磁盘）。',
  'workbench.importExport.export.switchToEncrypted': '切换为加密（推荐）',
  'workbench.importExport.export.acknowledgeRisks': '我了解风险',
  'workbench.importExport.export.fingerprintsTitle': '已加密——把这些指纹分享给接收者',
  'workbench.importExport.export.ciphertextFingerprint': '密文指纹：',
  'workbench.importExport.export.keyFingerprint': '密钥指纹：',
  'workbench.importExport.export.fingerprintMatchNote': '接收者输入密码短语后，如果匹配，会看到与你相同的密钥指纹。',
  'workbench.importExport.export.advanced': '高级',
  'workbench.importExport.export.strictLiteralLabel': '严格字面——只导出我选中的内容',
  'workbench.importExport.export.strictLiteralHelp':
    '默认情况下，选中集合或文件夹会带上所有后代及父容器，让导入自成一体。开启严格字面后，只导出选中的 uid——接收者会看到未包含内容的缺失依赖。',
  'workbench.importExport.export.oauthNote':
    '无论 vault 模式如何，OAuth 客户端机密始终被省略。接收者首次授权时输入自己的机密。',
  'workbench.importExport.export.exportFailed': '导出失败',
  'workbench.importExport.export.exportedShareFingerprints': '已导出 {filename}——把指纹分享给接收者',
  'workbench.importExport.export.exported': '已导出 {filename}',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': '导入',
  'workbench.importExport.hub.closeAria': '关闭导入',
  'workbench.importExport.hub.readingFile': '正在读取文件…',
  'workbench.importExport.hub.pastePlaceholder': '粘贴 curl 命令或 URL',
  'workbench.importExport.hub.continueAria': '继续导入',
  'workbench.importExport.hub.notRecognized':
    '尚未识别——请粘贴 curl 命令、URL、HAR、Postman / Insomnia / Bruno 导出、OpenAPI 文档或工作区导出。',
  'workbench.importExport.hub.dropAria': '将可导入的文件或文件夹拖放到此处',
  'workbench.importExport.hub.dropTitle': '拖放文件或文件夹以导入',
  'workbench.importExport.hub.kindHar': 'HAR 捕获',
  'workbench.importExport.hub.kindPostman': 'Postman 集合或备份',
  'workbench.importExport.hub.kindInsomnia': 'Insomnia 导出',
  'workbench.importExport.hub.kindBrunoSuffix': '文件或集合文件夹',
  'workbench.importExport.hub.kindOpenapi': 'OpenAPI 3.x 文档',
  'workbench.importExport.hub.kindWorkspaceSuffix': '工作区导出',
  'workbench.importExport.hub.autoDetected': '格式会被自动识别。',
  'workbench.importExport.hub.browseFiles': '浏览文件…',
  'workbench.importExport.hub.browseFolder': '浏览文件夹…',
  'workbench.importExport.hub.switchingFrom': '正在从',
  'workbench.importExport.hub.switchingOr': '或',
  'workbench.importExport.hub.migrateCta': '从其他工具迁移',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles': '该文件夹中没有 Bruno 文件——预期为 .bru 文件或 bruno.json。',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个文件无法读取，已跳过。',
    }),
  'workbench.importExport.modals.readFailed': '无法读取 {name}：{message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), { other: '已导入 {count} 个实体' })}，来自“${label}”`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': '导入工作区导出',
  'workbench.importExport.preview.closeAria': '关闭导入预览',
  'workbench.importExport.preview.cancel': '取消',
  'workbench.importExport.preview.emptyFile': '拖放一个 .openheaders.yaml 文件以预览。',
  'workbench.importExport.preview.emptyClipboard': '粘贴工作区导出以预览。',
  'workbench.importExport.preview.preparing': '正在准备导入…',
  'workbench.importExport.preview.footerExportInfo': '导出 {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': '选择要预览的文件',
  'workbench.importExport.preview.footerNoData': '无数据',
  'workbench.importExport.preview.importInto': '导入到：',
  'workbench.importExport.preview.staleTitle': '自打开此预览以来工作区已发生变化',
  'workbench.importExport.preview.staleDescription': '重新打开导入预览以刷新差异，然后重试。',
  'workbench.importExport.preview.advanced': '高级',
  'workbench.importExport.preview.advancedCount': '高级（{count}）',
  'workbench.importExport.preview.previewFailed': '预览失败',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `导入——${plural(locale, Number(count), { other: '{count} 项' })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': '导入到',
  'workbench.importExport.target.current': '当前',
  'workbench.importExport.target.new': '新建',
  'workbench.importExport.target.pickExisting': '选择现有',
  'workbench.importExport.target.noActiveWorkspace': '没有活动的工作区',
  'workbench.importExport.target.selectWorkspace': '选择一个工作区',
  'workbench.importExport.target.landsOnOrg': '落到 {name} 并同步到其设备',
  'workbench.importExport.target.staysLocal': '仅保留在此设备上',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': '高级',
  'workbench.importExport.advanced.closeAria': '关闭高级面板',
  'workbench.importExport.advanced.backupRestoreLabel': '这是我自己的——优先按 uid 更新',
  'workbench.importExport.advanced.backupRestoreHelp':
    '把 uid 匹配的冲突从“添加为新项”改为“替换现有项”。导出之后在本地编辑过的实体会被跳过。',
  'workbench.importExport.advanced.trustExportLabel': '信任此导出——保留启用标志',
  'workbench.importExport.advanced.trustExportHelp':
    '导入的规则 / Live 工作流 / Live 变量默认落地为禁用。只有在信任发送者时才开启。',
  'workbench.importExport.advanced.stripScriptsLabel': '导入时剥离请求脚本',
  'workbench.importExport.advanced.stripScriptsHelp':
    '从每个导入的请求中移除请求前和响应后脚本。发送者不熟悉时建议开启。',
  'workbench.importExport.advanced.omitOAuthLabel': '省略 OAuth 配置',
  'workbench.importExport.advanced.omitOAuthHelp':
    '默认情况下，OAuth2 配置随请求一起导入（token 端点、客户端 id、作用域——绝不含客户端机密或 token）。开启后，每个 OAuth2 请求落地时身份验证设为无。',
  'workbench.importExport.advanced.keepOrderLabel': '更新时保留目标集合的顺序',
  'workbench.importExport.advanced.keepOrderHelp':
    '默认情况下，被更新的集合会采用导出中的子项顺序。开启后保留你现有的目标顺序。',
  'workbench.importExport.advanced.workspaceSettingsLabel': '包含工作区级设置',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    '为未来的工作区语义设置允许列表预留。当前允许列表为空——v1 中此开关不会带入任何内容。',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'workspace.uid 冲突时拒绝',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    '默认情况下，导入到新工作区时若发生冲突，会静默重新生成工作区 uid。开启后，存在相同 uid 的工作区会阻止导入。',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': '忽略',
  'workbench.importExport.chips.plaintextLabel': '明文机密',
  'workbench.importExport.chips.plaintextTitle': '此导出包含明文的 vault 机密。',
  'workbench.importExport.chips.plaintextBody':
    '任何持有此文件的人都能读取其中的每个机密。转发之前请考虑重新以加密方式导出。',
  'workbench.importExport.chips.skippedLabel': '已跳过 {count} 个',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个实体无法解析，将被跳过。',
    }),
  'workbench.importExport.chips.andMore': '…还有 {count} 个',
  'workbench.importExport.chips.dedupSameLabel': '此处已导入过',
  'workbench.importExport.chips.dedupSameTitle': '你在 {date} 已把此导出（{id}）导入到这里。',
  'workbench.importExport.chips.dedupSameBody': '重新导入会应用你当前的按实体策略选择。',
  'workbench.importExport.chips.dedupOtherLabel': '已在别处导入',
  'workbench.importExport.chips.dedupOtherTitle': '你还把导出 {id} 导入到了“{name}”。',
  'workbench.importExport.chips.dedupOtherBody': '该工作区不受此次导入影响。',
  'workbench.importExport.chips.dedupUidLabel': '来源已存在',
  'workbench.importExport.chips.dedupUidTitle': '来自此来源的工作区已存在（“{name}”）。',
  'workbench.importExport.chips.dedupUidBody': '在上方切换目标以刷新它，或作为新副本导入。',
  'workbench.importExport.chips.staleLabel': '数据已变化',
  'workbench.importExport.chips.staleTitle': '目标工作区被另一个标签页修改了。',
  'workbench.importExport.chips.staleBody': '下方的冲突树已刷新——请检查后再次点击“导入”。',
  'workbench.importExport.chips.previewErrorLabel': '预览失败',
  'workbench.importExport.chips.previewErrorTitle': '无法计算冲突差异。',
  'workbench.importExport.chips.unresolvedLabel': '{count} 个未解析',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个未解析的引用。',
    }),
  'workbench.importExport.chips.unresolvedBody':
    '这些名称在导出和目标中都无法解析。导入后会成为损坏的绑定——等缺失的实体出现后重新绑定。',
  'workbench.importExport.chips.referencedBy': '被 {count} 处引用',
  'workbench.importExport.chips.summaryThen': '当时：',
  'workbench.importExport.chips.summaryNow': '现在：',
  'workbench.importExport.chips.summaryNew': '{count} 个新增',
  'workbench.importExport.chips.summaryKept': '{count} 个保留',
  'workbench.importExport.chips.summaryRemoved': '{count} 个移除',
  'workbench.importExport.chips.showBreakdown': '显示分节明细',
  'workbench.importExport.chips.hideBreakdown': '隐藏明细',
  'workbench.importExport.chips.sectionNew': '（+{count} 新增）',
  'workbench.importExport.chips.sectionRemoved': '（{count} 移除）',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '已加密的 vault——{count} 个机密',
    }),
  'workbench.importExport.vault.hintFromSender': '发送者的提示：',
  'workbench.importExport.vault.enterPassphrase':
    '输入密码短语以在本地解密这些机密。跳过解密会继续导入其余内容——机密只是被省略。',
  'workbench.importExport.vault.passphrasePlaceholder': '密码短语',
  'workbench.importExport.vault.decrypt': '解密 vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: 'Vault 已解密——{count} 个机密可导入',
    }),
  'workbench.importExport.vault.keyFingerprint': '密钥指纹：',
  'workbench.importExport.vault.compareWithSender': '（与发送者核对）',
  'workbench.importExport.vault.ciphertextFingerprint': '密文指纹：',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个机密无法解码——将从导入中省略',
    }),
  'workbench.importExport.vault.andMore': '…还有 {count} 个',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': '取消',
  'workbench.importExport.import.importCta': '导入',
  'workbench.importExport.import.importCtaCount': '导入（{count}）',
  'workbench.importExport.import.importShortcutTooltip': '导入（{shortcut}）',
  'workbench.importExport.import.importTo': '导入到',
  'workbench.importExport.import.hintNavigate': '导航',
  'workbench.importExport.import.hintSelect': '选择',
  'workbench.importExport.import.hintImport': '导入',
  'workbench.importExport.import.hintClose': '关闭',
  'workbench.importExport.import.cantReadFile': '无法读取此文件',
  'workbench.importExport.import.failedCreateCollection': '创建集合失败',
  'workbench.importExport.import.importFailed': '导入失败：{message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个转换' }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个丢弃项' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '已导入 {count} 个请求' }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': '从 HAR 导入',
  'workbench.importExport.har.tooltipChooseFile': '请先选择一个 .har 文件',
  'workbench.importExport.har.tooltipSelectEntry': '至少选择一个条目',
  'workbench.importExport.har.footerSelected': '已选择 {selected} / {total}',
  'workbench.importExport.har.footerChooseFile': '选择一个 .har 文件',
  'workbench.importExport.har.introPrefix': '导入一个',
  'workbench.importExport.har.introSuffix':
    '文件（HTTP Archive），可从 DevTools 或代理导出。每个条目会成为所选集合中的一个目标请求。Cookie 和 multipart 上传会被丢弃并带跟踪标注；身份验证标头会被提升为一等身份验证类型。',
  'workbench.importExport.har.filterPlaceholder': '按 URL / 方法 / 名称筛选',
  'workbench.importExport.har.selectAll': '全选',
  'workbench.importExport.har.selectNone': '全不选',
  'workbench.importExport.har.readFailed': '读取 HAR 失败：{message}',
  'workbench.importExport.har.dropTitle': '把 .har 文件拖放到此处，或点击选择',
  'workbench.importExport.har.dropHint': '从 DevTools 网络面板导出：右键 → “以 HAR 格式保存所有内容”',
  'workbench.importExport.har.noImportableEntries': '此文件没有可导入的条目。',
  'workbench.importExport.har.noFilterMatch': '没有条目匹配筛选。',
  'workbench.importExport.har.showingFirst': '仅显示前 {shown} 个，共 {total} 个。用筛选缩小范围。',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '对来源应用了 {count} 个转换',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), { other: '记录了 {count} 个丢弃项' }),
  'workbench.importExport.har.transformsTooltip':
    '转换会把来源字段改写为规范化的等价形式——例如把 Authorization 标头提升为一等身份验证类型。',
  'workbench.importExport.har.dropsTooltip':
    '丢弃项是无法映射到模型的来源字段（Cookie、multipart 上传等）。每一项在完整报告中都有跟踪标注。',
  'workbench.importExport.har.reportHover': '悬停查看详情 · 完整列表见导入报告导出（设置 → 数据）',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': '从 cURL 导入',
  'workbench.importExport.curl.tooltipPasteFirst': '请先粘贴 curl 命令',
  'workbench.importExport.curl.tooltipEnterName': '请输入名称',
  'workbench.importExport.curl.introPrefix': '粘贴一条',
  'workbench.importExport.curl.introSuffix': '命令——例如浏览器 DevTools 的“以 cURL 格式复制”，或来自 API 文档。',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': '无法解析此命令',
  'workbench.importExport.curl.parseFallback': '无法解析——请检查命令后重试。',
  'workbench.importExport.curl.nameLabel': '名称',
  'workbench.importExport.curl.namePlaceholder': '此请求在侧边栏中的显示名称',
  'workbench.importExport.curl.failedCreateRequest': '创建请求失败',
  'workbench.importExport.curl.importedName': '已导入“{name}”',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个标头' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个查询参数' }),
  'workbench.importExport.curl.noBody': '无正文',
  'workbench.importExport.curl.bodyType': '{type} 正文',
  'workbench.importExport.curl.noAuth': '无身份验证',
  'workbench.importExport.curl.authType': '{type} 身份验证',
  'workbench.importExport.curl.droppedWord': '已丢弃',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': '从 Postman 导入',
  'workbench.importExport.postman.intro':
    '导入 Postman Collection v2.1 JSON。保留文件夹结构、集合变量、请求文档与设置、按请求的身份验证（basic / bearer / api-key / OAuth 2.0），以及请求脚本（尽可能翻译为 oh.* API）。AWS sigv4 和文件上传会作为丢弃项跟踪。可选附加 Postman 环境文件以落地一个对应的环境。',
  'workbench.importExport.postman.tooltipChooseFile': '请先选择集合文件',
  'workbench.importExport.postman.tooltipEnterName': '请输入集合名称',
  'workbench.importExport.postman.collectionNameLabel': '集合名称',
  'workbench.importExport.postman.collectionNamePlaceholder': '新集合的名称',
  'workbench.importExport.postman.readFileFailed': '读取文件失败：{message}',
  'workbench.importExport.postman.readEnvFailed': '读取环境失败：{message}',
  'workbench.importExport.postman.parsedCollection': '已解析的集合',
  'workbench.importExport.postman.requestsLabel': '请求：',
  'workbench.importExport.postman.foldersLabel': '文件夹：',
  'workbench.importExport.postman.collectionVarsLabel': '集合变量：',
  'workbench.importExport.postman.folderTree': '文件夹树',
  'workbench.importExport.postman.optionalEnvFile': '可选 · 环境文件',
  'workbench.importExport.postman.environmentLabel': '环境：{name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个变量' }),
  'workbench.importExport.postman.secretCount': '{count} 个机密',
  'workbench.importExport.postman.remove': '移除',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '丢弃了 {count} 个环境变量（已禁用的条目）',
    }),
  'workbench.importExport.postman.dropCollectionTitle': '把 Postman Collection v2.1 JSON 拖放到此处，或点击选择',
  'workbench.importExport.postman.dropEnvTitle': '把 Postman 环境 JSON 拖放到此处（可选）',
  'workbench.importExport.postman.dropCollectionHint': '从 Postman 导出：Collection → ⋯ → Export（Collection v2.1）',
  'workbench.importExport.postman.dropEnvHint': '从 Postman 导出：Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个文件夹' }),
  'workbench.importExport.postman.oneEnvironment': '1 个环境',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': '从 Postman 备份导入',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    '导入 Postman 备份数据转储。可识别集合、环境、全局变量和标头预设；标头预设落地为未发布的标头规则。脚本、OAuth 2.0、AWS sigv4 和文件上传会作为丢弃项跟踪。',
  'workbench.importExport.sectioned.titleInsomnia': '从 Insomnia 导入',
  'workbench.importExport.sectioned.blurbInsomnia':
    '导入 Insomnia 导出（v4 JSON 或 v5 YAML）。工作区变为带文件夹树的集合；环境会被展平（子环境合并覆盖其基础环境），{{ _.var }} 引用改写为 {{var}}；内嵌的 API 规范保留为可编辑的规范，并链接到生成的集合。',
  'workbench.importExport.sectioned.titleBruno': '从 Bruno 导入',
  'workbench.importExport.sectioned.blurbBruno':
    '导入 Bruno 的 .bru 请求或整个集合文件夹。保留方法、标头、参数、正文和 basic/bearer/api-key 身份验证；文件夹会带上其文件夹树、顺序和环境；脚本、测试和文档块会作为丢弃项跟踪。',
  'workbench.importExport.sectioned.titleOpenapi': '从 OpenAPI 导入',
  'workbench.importExport.sectioned.blurbOpenapi':
    '导入 OpenAPI 3.x 文档（JSON 或 YAML）。操作成为 {{baseUrl}} 下的请求，标签成为文件夹，参数和请求体被保留（仅有 schema 的请求体会得到占位脚手架），安全方案映射为身份验证——导入后填写 {{clientId}}/{{clientSecret}} 占位符。文档也可以作为可编辑的规范保留，并链接到生成的集合。',
  'workbench.importExport.sectioned.tooltipNothingParsed': '尚未解析出任何内容',
  'workbench.importExport.sectioned.tooltipNeedsNames': '每个集合都需要名称',
  'workbench.importExport.sectioned.cantReadImport': '无法读取此导入',
  'workbench.importExport.sectioned.readInputFailed': '读取输入失败：{message}',
  'workbench.importExport.sectioned.importAs': '导入为',
  'workbench.importExport.sectioned.specWithCollection': '带集合的规范',
  'workbench.importExport.sectioned.specWithCollectionHelp': '文档作为可编辑的规范保留，并链接到生成的集合。',
  'workbench.importExport.sectioned.collectionOnly': '集合',
  'workbench.importExport.sectioned.collectionOnlyHelp': '仅转换——不保留文档本身。',
  'workbench.importExport.sectioned.specificationsSection': '规范 · {count}',
  'workbench.importExport.sectioned.collectionsSection': '集合 · {count}',
  'workbench.importExport.sectioned.environmentsSection': '环境 · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': '标头预设 · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': '集合名称',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个变量' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个标头' }),
  'workbench.importExport.sectioned.presetsNote':
    '每个预设都会落地为未发布的标头规则——准备好后添加条件并发布；在那之前不会影响任何实际流量。',
  'workbench.importExport.sectioned.nothingImportable': '此文件中没有可导入的内容',
  'workbench.importExport.sectioned.nothingImportableDesc': '文件解析成功，但每个区块都为空或被丢弃——见下方导入说明。',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个请求' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个规范' }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个环境' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 条标头规则（未发布）',
    }),
  'workbench.importExport.sectioned.importedLead': '已导入 {parts}',
  'workbench.importExport.sectioned.emptyFinish': '导入完成——没有可带入的内容',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': '从其他工具迁移',
  'workbench.importExport.migrate.scanCta': '扫描这台电脑',
  'workbench.importExport.migrate.pullCta': '从 Postman 账户导入',
  'workbench.importExport.migrate.scanNote':
    '扫描会检查固定的一组应用程序文件夹，只读取工具数据文件（备份和本地存储）。绝不会打开凭据、Cookie 或会话文件，也没有任何内容离开这台电脑。导入任何内容都是单独的显式步骤。',
  'workbench.importExport.migrate.scanFailed': '扫描无法运行——请重试，或在导入中心使用导出的文件。',
  'workbench.importExport.migrate.backupReadFailed': '无法读取备份文件。',
  'workbench.importExport.migrate.localReadFailed': '无法读取本地数据。',
  'workbench.importExport.migrate.detected': '已检测到',
  'workbench.importExport.migrate.notFound': '未找到',
  'workbench.importExport.migrate.cancel': '取消',
  'workbench.importExport.migrate.fromAccount': '从你的 Postman 账户导入',
  'workbench.importExport.migrate.localDataPrefix':
    '有本地的 Insomnia、Thunder Client 或 Bruno 数据？从工具中导出后，把文件拖放到',
  'workbench.importExport.migrate.importHub': '导入中心',
  'workbench.importExport.migrate.localDataSuffix': '——或用 Open Headers 桌面端应用扫描这台电脑。',
  'workbench.importExport.migrate.desktopConnected':
    '你的桌面端应用已连接——在那里选择“从其他工具迁移”；进度会在此处镜像，导入的工作区会同步过来。',
  'workbench.importExport.migrate.desktopNeeded': '扫描需要桌面端应用；在那里运行后，导入的工作区会同步到此浏览器。',
  'workbench.importExport.migrate.closeConfirmTitle': '关闭导入？',
  'workbench.importExport.migrate.closeListingContent': '你的工作区仍在列出中——大账户可能需要一分钟。关闭会放弃列出。',
  'workbench.importExport.migrate.closeListingOk': '继续等待',
  'workbench.importExport.migrate.closeSelectingContent': '你的工作区选择将被丢弃。目前尚未导入任何内容。',
  'workbench.importExport.migrate.closeSelectingOk': '继续选择',
  'workbench.importExport.migrate.closeAnyway': '仍然关闭',
  'workbench.importExport.migrate.discardAndClose': '丢弃并关闭',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman does not localize Simplified Chinese,
  // so the English labels ride verbatim raw.
  'workbench.importExport.pull.keyIntro': '粘贴 Postman API key 以列出你的工作区，并选择要导入的工作区。',
  'workbench.importExport.pull.keyAria': 'Postman API key',
  'workbench.importExport.pull.listCta': '列出工作区',
  'workbench.importExport.pull.listFailed': '无法列出工作区。',
  'workbench.importExport.pull.startFailed': '导入无法开始。',
  'workbench.importExport.pull.quipContacting': '正在联系你的 Postman 账户',
  'workbench.importExport.pull.quipCounting': '正在清点集合',
  'workbench.importExport.pull.quipWeighing': '正在称量环境',
  'workbench.importExport.pull.quipWrangling': '正在整理工作区',
  'workbench.importExport.pull.quipAlphabetizing': '正在为文件夹排序',
  'workbench.importExport.pull.quipSniffing': '正在嗅探请求',
  'workbench.importExport.pull.quipUntangling': '正在解开变量',
  'workbench.importExport.pull.quipStacking': '正在堆叠标头',
  'workbench.importExport.pull.pickIntro':
    '每个选中的 Postman 工作区都会落到自己的工作区，保留原名，并附带运行结束报告。',
  'workbench.importExport.pull.noWorkspaces': '此账户上未找到工作区。',
  'workbench.importExport.pull.workspaceCounts': '{collections} 个集合 · {environments} 个环境',
  'workbench.importExport.pull.importCta': '导入所选',
  'workbench.importExport.pull.back': '返回',
  'workbench.importExport.pull.steps.menuA': '在 Postman 应用或 https://postman.co 中',
  'workbench.importExport.pull.steps.menuB': 'Settings 菜单 → Account settings',
  'workbench.importExport.pull.steps.generateA': '左侧边栏 → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': '随便起个名字 → Generate API key',
  'workbench.importExport.pull.steps.copyB': '复制密钥 → 粘贴到上方',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': '供应商',
  'workbench.importExport.detection.dataFoundCol': '发现的数据',
  'workbench.importExport.detection.contentsCol': '内容',
  'workbench.importExport.detection.backupFrom': '{date} 的备份',
  'workbench.importExport.detection.localData': '本地数据',
  'workbench.importExport.detection.importCta': '导入…',
  'workbench.importExport.detection.exportFallbackPrefix':
    '或从工具中导出（Preferences → Data → Export），然后把文件拖放到',
  'workbench.importExport.detection.backupContents':
    '{collections} 个集合 · {environments} 个环境 · {headerPresets} 个标头预设 · {globals} 个全局变量',
  'workbench.importExport.detection.localContents': '{collections} 个集合 · {environments} 个环境 · {requests} 个请求',
  'workbench.importExport.detection.emptyScanned': '这台电脑上未找到可导入的数据存储。',
  'workbench.importExport.detection.emptyNotScanned': '尚未扫描——“扫描这台电脑”会在此列出可导入的数据。',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '跳过了 {count} 个存储文件——',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Postman 导入报告',
  'workbench.importExport.report.noReport': '未找到此工作区的导入报告。',
  'workbench.importExport.report.cleanImport': '全部干净导入——没有丢弃或转换。',
  'workbench.importExport.report.copyOk': '报告已复制为 JSON',
  'workbench.importExport.report.copyAnonymizedOk': '匿名化报告已复制为 JSON',
  'workbench.importExport.report.copyFailed': '无法复制报告。',
  'workbench.importExport.report.copyReport': '复制报告',
  'workbench.importExport.report.download': '下载',
  'workbench.importExport.report.anonymizeTooltip':
    '用于公开分享（例如 GitHub issue）：工作区名称变为 “Workspace N”，改写过的值会被涂黑。路径、原因和计数保留，报告仍可用于调试。',
  'workbench.importExport.report.anonymize': '匿名化',
  'workbench.importExport.report.close': '关闭',
  'workbench.importExport.report.openWorkspace': '打开工作区',
  'workbench.importExport.report.countsLine': '{collections} 个集合 · {environments} 个环境 · {requests} 个请求',
  'workbench.importExport.report.savedExamplesPart': '{count} 个已保存示例',
  'workbench.importExport.report.globalVariablesPart': '{count} 个全局变量',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 条说明' }),
  'workbench.importExport.report.summaryImported': '已导入',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { other: '集合' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { other: '环境' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) => plural(locale, Number(count), { other: '请求' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { other: '已保存示例' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), { other: '全局变量' }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个工作区' }),
  'workbench.importExport.report.withOpen': '（含',
  'workbench.importExport.report.and': '和',
  'workbench.importExport.report.into': '到',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': '此前',
  'workbench.importExport.reimport.previouslyImported': '（此前导入于 {age}）',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '自上次导入以来新增 {count} 个问题',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 个此前不支持的条目现已支持',
    }),
  'workbench.importExport.reimport.countsChanged': '计数自上次导入以来有变化',
  'workbench.importExport.reimport.minorChanges': '与上次导入相比有少量变化',
  'workbench.importExport.reimport.newDrops': '新增丢弃项（{count}）',
  'workbench.importExport.reimport.dropsResolved': '已解决的丢弃项（{count}）',
  'workbench.importExport.reimport.newTransforms': '新增转换（{count}）',
  'workbench.importExport.reimport.transformsResolved': '不再需要的转换（{count}）',
} as const satisfies Catalog;
