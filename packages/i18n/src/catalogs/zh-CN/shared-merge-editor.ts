/**
 * Shared merge-editor family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included, half-width ` · ` separator),
 * the ✕ ▶ ◀ ↘ ↙ · glyphs, the `+ − ~ =` kind-label prefixes and the
 * `Merge:` command-palette namespace prefix (de precedent) stay raw.
 * Mints: 区块 = hunk (个 measure word); 传入 = incoming / 当前 =
 * current / 基准 = base / 结果 = result (VS Code zh-CN merge
 * vocabulary); 对方 = theirs / 我的 = mine; 窗格 = pane; 侧边操作列 =
 * side gutters; 解决 = resolve; 无冲突 = non-conflicting; 合并 =
 * merge (prose referent — the palette prefix stays raw).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': '上一个区块 · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': '下一个区块 · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': '所有区块已解决',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '剩余 {count} 个区块' }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个冲突' }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} 个无冲突',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    '在一个撤销步骤中应用所有只有一侧改动过的区块。冲突保留待手动解决。 · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': '应用无冲突区块',
  'shared.mergeEditor.toolbar.acceptAll': '全部接受',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': '接受所有传入（此文件）',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': '接受所有当前（此文件）',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': '接受所有传入（整个会话）',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': '接受所有当前（整个会话）',
  'shared.mergeEditor.toolbar.acceptAllIncoming': '接受所有传入',
  'shared.mergeEditor.toolbar.acceptAllCurrent': '接受所有当前',
  'shared.mergeEditor.toolbar.baseUnavailable': '基准视图不可用——此会话中没有共同祖先。',
  'shared.mergeEditor.toolbar.resetLayout': '重置当前布局的窗格大小',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': '列',
  'shared.mergeEditor.layout.baseOnTop': '基准在顶部',
  'shared.mergeEditor.layout.baseInCenter': '基准在中间',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': '显示无冲突区块',
  'shared.mergeEditor.toggle.compactView': '紧凑视图',
  'shared.mergeEditor.toggle.compactViewTooltip':
    '折叠所有窗格中未更改的区域——只有区块区域（加上几行上下文）保持可见。适用于大部分行未更改的文件。',
  'shared.mergeEditor.toggle.singleClickResolve': '单击解决',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    '开启时，接受区块的一侧会自动忽略另一侧，一次点击即可解决该区块。关闭时保留对角追加（↘ / ↙）操作，让你可以叠加两侧。',
  'shared.mergeEditor.toggle.inlineLabels': '内联标签',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    '在侧窗格中每个待处理区块上方显示“{accept} | {combine} | {ignore}”标签。与布局无关。',
  'shared.mergeEditor.toggle.sideGutters': '侧边操作列',
  'shared.mergeEditor.toggle.sideGuttersTooltip': '在结果编辑器两侧显示 ✕ ▶ / ◀ ✕ 符号。',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    '侧边操作列仅在列布局中可用——“基准在顶部”和“基准在中间”会把结果窗格与对方 / 我的窗格放在不同的行上。',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': '接受所有传入（会话）',
  'shared.mergeEditor.confirm.acceptCurrentTitle': '接受所有当前（会话）',
  'shared.mergeEditor.confirm.replaceWithIncoming': '用传入版本替换 {scope}。',
  'shared.mergeEditor.confirm.resetToCurrent': '将 {scope} 重置为你的当前版本。',
  'shared.mergeEditor.confirm.discardsLocal': '这会丢弃会话中每个文件的本地编辑。',
  'shared.mergeEditor.confirm.discardsIncoming': '这会丢弃会话中每个文件的所有传入更改。',
  'shared.mergeEditor.confirm.okIncoming': '接受所有传入',
  'shared.mergeEditor.confirm.okCurrent': '接受所有当前',
  'shared.mergeEditor.confirm.cancel': '取消',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个文件' }),
  'shared.mergeEditor.groupOther': '其他',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': '应用时报告了错误：',
  'shared.mergeEditor.errors.unknown': '未知错误',
  'shared.mergeEditor.emptySession': '此合并会话中没有文件。',
  'shared.mergeEditor.footer.cancel': '取消',
  'shared.mergeEditor.footer.completeMerge': '完成合并',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': '传入（对方）',
  'shared.mergeEditor.pane.result': '结果',
  'shared.mergeEditor.pane.yoursEditHere': '你的（我的，在此编辑）',
  'shared.mergeEditor.pane.current': '当前（我的）',
  'shared.mergeEditor.pane.base': '基准（共同祖先）',
  'shared.mergeEditor.sash.columns12': '调整第 1 列 / 第 2 列大小',
  'shared.mergeEditor.sash.columns23': '调整第 2 列 / 第 3 列大小',
  'shared.mergeEditor.sash.rows': '调整顶部行 / 底部行大小',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': '已添加',
  'shared.mergeEditor.fileList.kindModified': '已修改',
  'shared.mergeEditor.fileList.kindRemoved': '已移除',
  'shared.mergeEditor.fileList.statusUnresolved': '未解决',
  'shared.mergeEditor.fileList.statusPartial': '部分解决',
  'shared.mergeEditor.fileList.statusResolved': '已解决',
  'shared.mergeEditor.fileList.statusFailed': '失败',
  'shared.mergeEditor.fileList.pairedWith': '配对：{label}',
  'shared.mergeEditor.fileList.hunksRemaining': '剩余 {count} 个区块',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': '接受传入',
  'shared.mergeEditor.zone.acceptCurrent': '接受当前',
  'shared.mergeEditor.zone.acceptCombination': '接受组合',
  'shared.mergeEditor.zone.ignore': '忽略',
  'shared.mergeEditor.zone.combineTooltip': '叠加两侧——传入在前，当前在后',
  'shared.mergeEditor.zone.removeIncoming': '移除传入',
  'shared.mergeEditor.zone.removeCurrent': '移除当前',
  'shared.mergeEditor.zone.revertIncomingTitle': '将传入恢复为待处理，以便重新决定',
  'shared.mergeEditor.zone.revertCurrentTitle': '将当前恢复为待处理，以便重新决定',
  'shared.mergeEditor.zone.statusNoChanges': '未接受任何更改',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': '传入 + 当前',
  'shared.mergeEditor.zone.statusIncoming': '传入',
  'shared.mergeEditor.zone.statusCurrent': '当前',
  'shared.mergeEditor.zone.statusIncomingSkipped': '已跳过传入',
  'shared.mergeEditor.zone.statusCurrentSkipped': '已跳过当前',
  'shared.mergeEditor.zone.kindAdds': '+ 添加',
  'shared.mergeEditor.zone.kindRemoves': '− 移除',
  'shared.mergeEditor.zone.kindModifies': '~ 修改',
  'shared.mergeEditor.zone.kindUnchanged': '= 未更改',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: 转到下一个区块',
  'shared.mergeEditor.action.prevHunk': 'Merge: 转到上一个区块',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: 接受光标处的传入区块',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: 接受光标处的当前区块',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: 应用无冲突更改',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: 接受所有传入',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: 接受所有当前',
  'shared.mergeEditor.action.undo': 'Merge: 撤销（缓冲区 + 选择状态）',
  'shared.mergeEditor.action.redo': 'Merge: 重做（缓冲区 + 选择状态）',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': '接受传入',
  'shared.mergeEditor.gutter.acceptCurrent': '接受当前',
  'shared.mergeEditor.gutter.appendIncoming': '同时把传入追加到当前之后',
  'shared.mergeEditor.gutter.appendCurrent': '同时把当前追加到传入之后',
  'shared.mergeEditor.gutter.skipIncoming': '跳过此区块的传入',
  'shared.mergeEditor.gutter.skipCurrent': '跳过此区块的当前',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': '所有区块已解决。',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '剩余 {count} 个区块。' }),
  'shared.mergeEditor.announce.acceptedIncoming': '已接受传入区块。',
  'shared.mergeEditor.announce.acceptedCurrent': '已接受当前区块。',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), { other: '已应用 {count} 个无冲突区块。' }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), { other: '已接受全部 {count} 个传入区块。' }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '已接受全部 {count} 个当前区块。' }),
} as const satisfies Catalog;
