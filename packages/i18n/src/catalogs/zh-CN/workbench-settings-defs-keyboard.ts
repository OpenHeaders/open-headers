/**
 * Workbench settings — keyboard-category setting definitions —
 * Simplified Chinese. Mirrors
 * `catalogs/en/workbench-settings-defs-keyboard.ts` key for key.
 * Chord notation and physical key names (ArrowDown, Enter, Space,
 * ⌘K, Alt+C, …) ride raw inside keyed values — localized key names
 * are a deferred Phase I workstream (zh-CN ships raw too, S46).
 * Action labels reuse the shipped `popup.shortcuts.*` zh wording
 * verbatim (S35 reuse law): 切换调试模式 / 循环切换主题 / 紧凑模式 /
 * 展开 / 进入子行 etc.; popup tab names quote the shipped zh labels
 * （“此页面”、“全部规则”、“集合”）. 活动流 = Activity Feed
 * (chrome-sidebar mint); 导览 = tour guide (popup mint). MINTS:
 * 命令面板 = Command Palette; 速查表 = cheatsheet; 预设 = preset;
 * 导入中心 = the import hub (`workbench-import-export.ts` must
 * reuse); spacebar in prose = 空格键. Brand tokens never compounded:
 * OpenHeaders 默认值、VS Code 风格.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': '切换调试模式',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    '从任何界面开启或关闭调试模式。仅在没有文本框获得焦点时触发。',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint': '调试模式可在 Chrome 和 Edge 中使用。',
  'workbench.settings.def.keyboard.commandPalette.label': '打开命令面板',
  'workbench.settings.def.keyboard.commandPalette.description': '显示命令面板浮层。',
  'workbench.settings.def.keyboard.openSettings.label': '打开设置',
  'workbench.settings.def.keyboard.openSettings.description': '打开设置对话框。',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': '启停左侧边栏',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': '显示或隐藏左侧边栏。',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': '启停右侧边栏',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': '显示或隐藏右侧边栏。',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': '启停底部面板',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': '显示或隐藏底部面板。',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': '启停活动流',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': '显示或隐藏活动流面板。',
  'workbench.settings.def.keyboard.newRule.label': '创建条目',
  'workbench.settings.def.keyboard.newRule.description': '打开规则和 API 请求的创建菜单。',
  'workbench.settings.def.keyboard.newTab.label': '新建标签页',
  'workbench.settings.def.keyboard.newTab.description': '打开一个新的 API 请求草稿标签页。',
  'workbench.settings.def.keyboard.import.label': '导入',
  'workbench.settings.def.keyboard.import.description': '打开导入中心，支持 curl、HAR 和工作区文件。',
  'workbench.settings.def.keyboard.save.label': '保存',
  'workbench.settings.def.keyboard.save.description': '保存活动的编辑器标签页。',
  'workbench.settings.def.keyboard.closeTab.label': '关闭标签页',
  'workbench.settings.def.keyboard.closeTab.description': '关闭获得焦点的编辑器标签页。',
  'workbench.settings.def.keyboard.previousTab.label': '上一个标签页',
  'workbench.settings.def.keyboard.previousTab.description': '聚焦上一个编辑器标签页。',
  'workbench.settings.def.keyboard.nextTab.label': '下一个标签页',
  'workbench.settings.def.keyboard.nextTab.description': '聚焦下一个编辑器标签页。',
  'workbench.settings.def.keyboard.tabSearch.label': '搜索标签页',
  'workbench.settings.def.keyboard.tabSearch.description': '打开跨所有已打开标签页的搜索浮层。',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': '聚焦当前区域的筛选框',
  'workbench.settings.def.keyboard.focusSidebarFilter.description': '把焦点移到你当前所在侧边栏区域的筛选输入框。',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': '聚焦左侧边栏',
  'workbench.settings.def.keyboard.focusLeftSidebar.description': '把键盘焦点移到左侧边栏。',
  'workbench.settings.def.keyboard.focusEditor.label': '聚焦编辑器',
  'workbench.settings.def.keyboard.focusEditor.description': '把键盘焦点移到编辑器区域。',
  'workbench.settings.def.keyboard.focusRightSidebar.label': '聚焦右侧边栏',
  'workbench.settings.def.keyboard.focusRightSidebar.description': '把键盘焦点移到右侧边栏。',
  'workbench.settings.def.keyboard.focusBottomPanel.label': '聚焦底部面板',
  'workbench.settings.def.keyboard.focusBottomPanel.description': '把键盘焦点移到底部面板的标签行。',
  'workbench.settings.def.keyboard.terminalNewTab.label': '新建终端标签页',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    '在终端面板获得焦点时开启一个新的终端标签页；在其他位置该组合键保持其通常的“新建标签页”操作。仅限桌面端应用。',
  'workbench.settings.def.keyboard.showShortcutHelp.label': '显示快捷键帮助',
  'workbench.settings.def.keyboard.showShortcutHelp.description': '显示键盘快捷键速查表。',
  'workbench.settings.def.keyboard.find.label': '在编辑器中查找',
  'workbench.settings.def.keyboard.find.description':
    '在获得焦点的代码编辑器中打开查找组件。仅在编辑器有焦点时触发——不干扰全局快捷键。',
  'workbench.settings.def.keyboard.replace.label': '在编辑器中替换',
  'workbench.settings.def.keyboard.replace.description':
    '在获得焦点的代码编辑器中打开查找并替换组件。仅在编辑器有焦点时触发——不干扰全局快捷键。',
  'workbench.settings.def.keyboard.formatCode.label': '格式化代码',
  'workbench.settings.def.keyboard.formatCode.description':
    '格式化获得焦点的代码编辑器缓冲区。仅在编辑器有焦点时触发——不干扰全局快捷键。',
  'workbench.settings.def.keyboard.preset.label': '键位预设',
  'workbench.settings.def.keyboard.preset.description':
    '快捷键的基础集合。你自定义的快捷键叠加在预设之上，切换预设后依然保留。',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'OpenHeaders 默认值',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'VS Code 风格',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': '弹窗——启停快捷键帮助',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description': '显示或隐藏弹窗的键盘快捷键速查表。',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': '弹窗——启停选项菜单',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description': '打开或关闭页脚的选项下拉菜单。',
  'workbench.settings.def.keyboard.popup.focusSearch.label': '弹窗——聚焦搜索框',
  'workbench.settings.def.keyboard.popup.focusSearch.description': '把键盘焦点移入活动标签页的搜索输入框。',
  'workbench.settings.def.keyboard.popup.prevPage.label': '弹窗——上一页',
  'workbench.settings.def.keyboard.popup.prevPage.description': '跳到活动标签页中规则的上一页。',
  'workbench.settings.def.keyboard.popup.nextPage.label': '弹窗——下一页',
  'workbench.settings.def.keyboard.popup.nextPage.description': '跳到活动标签页中规则的下一页。',
  'workbench.settings.def.keyboard.popup.moveDown.label': '弹窗——下移',
  'workbench.settings.def.keyboard.popup.moveDown.description': '把焦点推进到下一行。ArrowDown 始终可用作别名。',
  'workbench.settings.def.keyboard.popup.moveUp.label': '弹窗——上移',
  'workbench.settings.def.keyboard.popup.moveUp.description': '把焦点移到上一行。ArrowUp 始终可用作别名。',
  'workbench.settings.def.keyboard.popup.expandRow.label': '弹窗——展开 / 进入子行',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    '展开获得焦点的行。ArrowRight 和 Enter 始终可用作别名。',
  'workbench.settings.def.keyboard.popup.collapseRow.label': '弹窗——折叠 / 退出子行',
  'workbench.settings.def.keyboard.popup.collapseRow.description': '折叠获得焦点的行。ArrowLeft 始终可用作别名。',
  'workbench.settings.def.keyboard.popup.toggleRow.label': '弹窗——开 / 关行',
  'workbench.settings.def.keyboard.popup.toggleRow.description': '开启或关闭获得焦点的规则。默认是空格键。',
  'workbench.settings.def.keyboard.popup.editRow.label': '弹窗——编辑行',
  'workbench.settings.def.keyboard.popup.editRow.description': '在工作区编辑器中打开获得焦点的规则。',
  'workbench.settings.def.keyboard.popup.copyValue.label': '弹窗——复制值',
  'workbench.settings.def.keyboard.popup.copyValue.description': '把获得焦点的行的主值复制到剪贴板。',
  'workbench.settings.def.keyboard.popup.deleteRow.label': '弹窗——删除行',
  'workbench.settings.def.keyboard.popup.deleteRow.description': '把获得焦点的行标记待删除。再按一次（或 Enter）确认。',
  'workbench.settings.def.keyboard.popup.addRule.label': '弹窗——添加规则',
  'workbench.settings.def.keyboard.popup.addRule.description': '从弹窗创建一条新规则。',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': '弹窗——暂停 / 恢复所有规则（全局）',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description': '暂停或恢复每个集合中的每条规则。',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label': '弹窗——暂停 / 恢复（获得焦点的集合/文件夹）',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    '暂停或恢复“集合”标签页中获得焦点的集合或文件夹。对单条规则行无效——规则改用启用开关（Space）。',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': '弹窗——循环切换主题',
  'workbench.settings.def.keyboard.popup.cycleTheme.description': '在浅色、深色和自动主题之间轮换。',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': '弹窗——启停紧凑模式',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description': '在紧凑和舒适密度之间切换弹窗。',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': '弹窗——打开工作区',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': '打开完整的工作区标签页。',
  'workbench.settings.def.keyboard.popup.openSettings.label': '弹窗——打开设置',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    '在新的工作区标签页中打开设置页面。与工作区的绑定一致。',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': '弹窗——“此页面”标签页',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': '激活“此页面”规则标签页。',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': '弹窗——“全部规则”标签页',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': '激活“全部规则”标签页。',
  'workbench.settings.def.keyboard.popup.tabCollections.label': '弹窗——“集合”标签页',
  'workbench.settings.def.keyboard.popup.tabCollections.description': '激活“集合”标签页。',
  'workbench.settings.def.keyboard.popup.toggleSurface.label': '弹窗——切换界面（弹窗 ↔ 侧边栏）',
  'workbench.settings.def.keyboard.popup.toggleSurface.description': '从弹窗顶栏在弹窗和侧边栏布局之间切换。',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': '弹窗——打开导览',
  'workbench.settings.def.keyboard.popup.openTourGuide.description': '从任意弹窗标签页重放欢迎导览。',
} as const satisfies Catalog;
