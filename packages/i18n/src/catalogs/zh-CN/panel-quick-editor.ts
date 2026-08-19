/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Simplified Chinese. Mirrors `catalogs/en/panel-quick-editor.ts`
 * key for key. Raw by design: rule/collection/folder/header/param
 * names, URLs, `{{template}}` chips, status codes + MIME values,
 * code/JSON example placeholders, direction glyphs (⬇ ⬆),
 * `mergeSeparator` and DNR schema vocabulary, the Mock tag, and core
 * validator sentences riding as holes. Mints: 模板 = template (prose);
 * 监听器 = listener (zh has the established JS term — deviates from the
 * de/es raw loanword); 弹出框 = popover (弹窗 stays the extension
 * popup); 重新定位 = retarget; 负载 = payload; 帧 = frame; snapshot op
 * words 注入/覆盖/追加/合并/移除 carry the shared op mints; 质询 /
 * 草稿 / 集合 / 追加 carried. OH's own labels quoted in prose copy
 * their mints in “” (“保存”, “全部移除”).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': '清除规则名称',
  'panel.quickEditor.renameTitle': '{name}——点击重命名',
  'panel.quickEditor.enabledOn': '已启用',
  'panel.quickEditor.enabledOff': '已禁用',
  'panel.quickEditor.ruleEnabledAria': '规则已启用',
  'panel.quickEditor.openInTab': '在标签页中打开',
  'panel.quickEditor.openInWorkspace': '在工作区中打开 →',
  'panel.quickEditor.saveButton': '保存',
  'panel.quickEditor.openToInspect': '在工作区中打开以检查或更改此规则。',
  'panel.quickEditor.variableMissing': '变量缺失——将鼠标悬停在红色引用上即可创建它并启用“保存”。',
  'panel.quickEditor.retargetHint': '调整下方条件以重新定位此规则。',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': '规则已更新',
  'panel.quickEditor.toast.ruleNotFound': '未找到规则——它可能已被删除。',
  'panel.quickEditor.toast.saveFailed': '保存失败',
  'panel.quickEditor.toast.toggleFailed': '无法启停该规则',
  'panel.quickEditor.toast.changedElsewhere': '规则已在别处更改——请关闭并重新打开弹出框。',
  'panel.quickEditor.toast.noWorkspace': '没有活动工作区',
  'panel.quickEditor.toast.collectionCreateFailed': '无法为该规则创建集合',
  'panel.quickEditor.toast.folderCreateFailed': '无法创建“{name}”文件夹——将保存到集合根目录。',
  'panel.quickEditor.toast.createFailed': '创建规则失败',
  'panel.quickEditor.toast.createdDraft': '规则已创建为草稿——请从工作区发布它。',
  'panel.quickEditor.toast.created': '规则已创建',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': '选择规则的保存位置',
  'panel.quickEditor.destination.savingTo': '保存到',
  'panel.quickEditor.destination.newTag': '新',
  'panel.quickEditor.destination.autoNamed': '自动——{folder}',
  'panel.quickEditor.destination.autoRoot': '自动——集合根目录',
  'panel.quickEditor.destination.root': '集合根目录',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': '查看并编辑此规则何时触发',
  'panel.quickEditor.conditions.label': '条件',
  'panel.quickEditor.conditions.none': '无——不匹配任何请求',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': '添加标头',
  'panel.quickEditor.header.mergeSeparatorTitle': '合并分隔符',
  'panel.quickEditor.header.directionRequest': '请求',
  'panel.quickEditor.header.directionResponse': '响应',
  'panel.quickEditor.validation.nameRequired': '必须填写标头名称。',
  'panel.quickEditor.validation.invalidName': '标头名称无效。',
  'panel.quickEditor.validation.invalidValue': '标头值无效。',
  'panel.quickEditor.validation.switchTo': '切换为 {operation}',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': '例如 https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': '匹配的请求会在到达网络之前被发送到此 URL。',
  'panel.quickEditor.delay.hint': '导航最多延迟 30,000 ms；XHR/fetch 上限为 5,000 ms。子资源不会被延迟。',
  'panel.quickEditor.block.editHint': '匹配的请求会在到达网络之前被拦截。',
  'panel.quickEditor.block.blockRequestsTo': '拦截发往以下地址的请求',
  'panel.quickEditor.block.createHint': '匹配的请求会在离开浏览器之前被取消——页面会看到一个网络错误。',
  'panel.quickEditor.response.tagModify': '修改',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody': '此规则使用 JavaScript 构建其响应。在工作区中打开以编辑脚本。',
  'panel.quickEditor.requestBody.hint': '匹配的请求会用此请求体替代页面的请求体发送。',
  'panel.quickEditor.requestBody.dynamicBody': '此规则使用 JavaScript 构建其请求体。在工作区中打开以编辑脚本。',
  'panel.quickEditor.inject.sourceUrlLabel': '来源 URL',
  'panel.quickEditor.inject.loadsStylesheetHint': '匹配的页面会在加载时加载此样式表。',
  'panel.quickEditor.inject.loadsScriptHint': '匹配的页面会在加载时加载此脚本。',
  'panel.quickEditor.inject.injectedHint': '在匹配的页面加载时注入其中。',
  'panel.quickEditor.message.incoming': '传入 ⬇',
  'panel.quickEditor.message.outgoing': '传出 ⬆',
  'panel.quickEditor.message.injectedConnectionsHint': '在监听器看到之前注入匹配的连接。',
  'panel.quickEditor.message.injectedStreamsHint': '在监听器看到之前注入匹配的流。',
  'panel.quickEditor.message.replacedFramesHint': '匹配的帧会在被看到之前替换为此负载。',
  'panel.quickEditor.message.replacedEventsHint': '匹配的事件会在被看到之前替换为此负载。',
  'panel.quickEditor.message.droppedFramesHint': '匹配的帧会在被看到之前被丢弃。',
  'panel.quickEditor.message.droppedEventsHint': '匹配的事件会在被看到之前被丢弃。',
  'panel.quickEditor.queryParam.addAction': '添加操作',
  'panel.quickEditor.queryParam.removeAllWarning': '“全部移除”会去掉整个查询字符串——此规则中的其他操作将被忽略。',
  'panel.quickEditor.auth.challengesHint': '应答匹配请求上的服务器（401）和代理（407）身份验证质询。',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': '规则已编辑',
  'panel.ruleHover.tagVariableChanged': '变量已更改',
  'panel.ruleHover.tagDeleted': '已删除',
  'panel.ruleHover.tagDisabled': '已禁用',
  'panel.ruleHover.tagModRemoved': '修改已移除',
  'panel.ruleHover.tagConditionsMismatch': '条件不匹配',
  'panel.ruleHover.tagWontFire': '不会触发',
  'panel.ruleHover.tagTitle.ruleDisabled': '规则的启用开关已关闭——它不会在任何后续请求上触发。',
  'panel.ruleHover.tagTitle.modGone': '匹配的修改已从规则中移除。',
  'panel.ruleHover.tagTitle.conditionsMismatch': '规则的条件不再覆盖此 URL。',
  'panel.ruleHover.tagTitle.nameUnresolved':
    '标头名称模板无法完全解析（例如引用了 TOTP）。DNR 拒绝标头名称中的字面模板字符。',
  'panel.ruleHover.tagTitle.valueUnresolved': '标头值模板无法完全解析。',
  'panel.ruleHover.tagTitle.separatorUnresolved': '合并分隔符模板无法完全解析。',
  'panel.ruleHover.deletedBody': '此规则已被删除。上方的捕获显示了它触发时所做的事情。',
  'panel.ruleHover.modRemovedBody': '匹配的修改已从规则中移除。在工作区中打开以重新创建或调整它。',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': '注入',
  'panel.ruleHover.snapshot.opOverride': '覆盖',
  'panel.ruleHover.snapshot.opAppend': '追加',
  'panel.ruleHover.snapshot.opMerge': '合并',
  'panel.ruleHover.snapshot.opRemove': '移除',
  'panel.ruleHover.snapshot.templateTitle': '触发时变量解析前的模板',
  'panel.ruleHover.snapshot.nameDriftTitle': '模板相同——所引用的变量现在解析为不同的标头名称',
  'panel.ruleHover.snapshot.cancels': '取消“{rule}”',
  'panel.ruleHover.snapshot.original': '原始',
  'panel.ruleHover.snapshot.now': '现在',
  'panel.ruleHover.snapshot.future': '将来',
  'panel.ruleHover.snapshot.futureTitle': '下一个匹配的请求将得到的内容',
  'panel.ruleHover.snapshot.removed': '已移除',
  'panel.ruleHover.snapshot.empty': '（空）',
  'panel.ruleHover.snapshot.totpNote': 'TOTP / 延迟引用在请求时解析，此处不捕获。',
  'panel.ruleHover.snapshot.alsoByRule': '此规则在此请求上的其他修改',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': '规则已删除——不会触发',
  'panel.ruleHover.future.ruleDisabled': '规则已禁用——不会触发',
  'panel.ruleHover.future.modGone': '此修改已从规则中移除',
  'panel.ruleHover.future.conditionsMismatch': '规则的条件不再匹配此 URL',
  'panel.ruleHover.future.nameUnresolved': '标头名称模板无法解析——规则不会触发',
  'panel.ruleHover.future.valueUnresolved': '值模板无法解析——规则不会触发',
  'panel.ruleHover.future.separatorUnresolved': 'mergeSeparator 模板无法解析——规则不会触发',
  'panel.ruleHover.future.templateTitle': '模板：{template}',
} as const satisfies Catalog;
