/**
 * Shared merge-editor family — Japanese. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included, half-width ` · ` separator),
 * the ✕ ▶ ◀ ↘ ↙ · glyphs, the `+ − ~ =` kind-label prefixes and the
 * `Merge:` command-palette namespace prefix (de precedent) stay raw.
 * Mints: ハンク = hunk (個 counter); 入力側 = incoming / 現在 = current
 * / ベース = base / 結果 = result (VS Code ja merge vocabulary); 相手側
 * = theirs / 自分 = mine; 取り込む = accept (a side); ペイン = pane;
 * サイドガター = side gutters; 解決 = resolve; 競合なし =
 * non-conflicting; マージ = merge (prose referent — the palette prefix
 * stays raw); 共通の祖先 = common ancestor; 保留 = pending.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': '前のハンク · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': '次のハンク · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'すべてのハンクが解決済み',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '残り {count} 個のハンク' }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の競合' }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} 個の競合なし',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    '片側だけが変更したハンクをすべて、1 回の元に戻す操作にまとめて適用します。競合は手動解決のために残ります。 · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': '競合なしを適用',
  'shared.mergeEditor.toolbar.acceptAll': 'すべて取り込む',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': '入力側をすべて取り込む（このファイル）',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': '現在をすべて取り込む（このファイル）',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': '入力側をすべて取り込む（セッション全体）',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': '現在をすべて取り込む（セッション全体）',
  'shared.mergeEditor.toolbar.acceptAllIncoming': '入力側をすべて取り込む',
  'shared.mergeEditor.toolbar.acceptAllCurrent': '現在をすべて取り込む',
  'shared.mergeEditor.toolbar.baseUnavailable':
    'ベースビューは利用できません。このセッションには共通の祖先がありません。',
  'shared.mergeEditor.toolbar.resetLayout': '現在のレイアウトのペインサイズをリセット',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': '列',
  'shared.mergeEditor.layout.baseOnTop': 'ベースを上に',
  'shared.mergeEditor.layout.baseInCenter': 'ベースを中央に',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': '競合なしを表示',
  'shared.mergeEditor.toggle.compactView': 'コンパクトビュー',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'すべてのペインで変更のない領域を折りたたみ、ハンクの領域（と数行のコンテキスト）だけを表示します。ほとんどの行が変更されていないファイルに便利です。',
  'shared.mergeEditor.toggle.singleClickResolve': 'シングルクリックで解決',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'オンにすると、ハンクの片側を取り込んだときにもう片側が自動的に無視され、1 回のクリックでハンクが解決します。オフにすると斜め追記（↘ / ↙）の操作が残り、両側を重ねられます。',
  'shared.mergeEditor.toggle.inlineLabels': 'インラインラベル',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    'サイドペインの保留中の各ハンクの上に「{accept} | {combine} | {ignore}」ラベルを表示します。レイアウトには依存しません。',
  'shared.mergeEditor.toggle.sideGutters': 'サイドガター',
  'shared.mergeEditor.toggle.sideGuttersTooltip': '結果エディターの両脇に ✕ ▶ / ◀ ✕ の記号を表示します。',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'サイドガターは列レイアウトでのみ利用できます。「ベースを上に」と「ベースを中央に」では、結果が相手側 / 自分とは別の行に置かれます。',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': '入力側をすべて取り込む（セッション）',
  'shared.mergeEditor.confirm.acceptCurrentTitle': '現在をすべて取り込む（セッション）',
  'shared.mergeEditor.confirm.replaceWithIncoming': '{scope}を入力側のバージョンで置き換えます。',
  'shared.mergeEditor.confirm.resetToCurrent': '{scope}を現在のバージョンにリセットします。',
  'shared.mergeEditor.confirm.discardsLocal': 'セッション内のすべてのファイルについて、ローカルの編集が破棄されます。',
  'shared.mergeEditor.confirm.discardsIncoming':
    'セッション内のすべてのファイルについて、入力側の変更がすべて破棄されます。',
  'shared.mergeEditor.confirm.okIncoming': '入力側をすべて取り込む',
  'shared.mergeEditor.confirm.okCurrent': '現在をすべて取り込む',
  'shared.mergeEditor.confirm.cancel': 'キャンセル',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のファイル' }),
  'shared.mergeEditor.groupOther': 'その他',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': '適用でエラーが報告されました：',
  'shared.mergeEditor.errors.unknown': '不明なエラー',
  'shared.mergeEditor.emptySession': 'このマージセッションにファイルはありません。',
  'shared.mergeEditor.footer.cancel': 'キャンセル',
  'shared.mergeEditor.footer.completeMerge': 'マージを完了',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': '入力側（相手側）',
  'shared.mergeEditor.pane.result': '結果',
  'shared.mergeEditor.pane.yoursEditHere': '自分側（自分、ここで編集）',
  'shared.mergeEditor.pane.current': '現在（自分）',
  'shared.mergeEditor.pane.base': 'ベース（共通の祖先）',
  'shared.mergeEditor.sash.columns12': '列 1 / 列 2 のサイズを変更',
  'shared.mergeEditor.sash.columns23': '列 2 / 列 3 のサイズを変更',
  'shared.mergeEditor.sash.rows': '上の行 / 下の行のサイズを変更',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': '追加',
  'shared.mergeEditor.fileList.kindModified': '変更',
  'shared.mergeEditor.fileList.kindRemoved': '削除',
  'shared.mergeEditor.fileList.statusUnresolved': '未解決',
  'shared.mergeEditor.fileList.statusPartial': '一部解決',
  'shared.mergeEditor.fileList.statusResolved': '解決済み',
  'shared.mergeEditor.fileList.statusFailed': '失敗',
  'shared.mergeEditor.fileList.pairedWith': 'ペア：{label}',
  'shared.mergeEditor.fileList.hunksRemaining': '残り {count} 個のハンク',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': '入力側を取り込む',
  'shared.mergeEditor.zone.acceptCurrent': '現在を取り込む',
  'shared.mergeEditor.zone.acceptCombination': '両方を取り込む',
  'shared.mergeEditor.zone.ignore': '無視',
  'shared.mergeEditor.zone.combineTooltip': '両側を重ねます。入力側が先、現在が後です',
  'shared.mergeEditor.zone.removeIncoming': '入力側を削除',
  'shared.mergeEditor.zone.removeCurrent': '現在を削除',
  'shared.mergeEditor.zone.revertIncomingTitle': '入力側を保留に戻して、決め直せるようにします',
  'shared.mergeEditor.zone.revertCurrentTitle': '現在を保留に戻して、決め直せるようにします',
  'shared.mergeEditor.zone.statusNoChanges': '取り込んだ変更なし',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': '入力側 + 現在',
  'shared.mergeEditor.zone.statusIncoming': '入力側',
  'shared.mergeEditor.zone.statusCurrent': '現在',
  'shared.mergeEditor.zone.statusIncomingSkipped': '入力側をスキップ',
  'shared.mergeEditor.zone.statusCurrentSkipped': '現在をスキップ',
  'shared.mergeEditor.zone.kindAdds': '+ 追加',
  'shared.mergeEditor.zone.kindRemoves': '− 削除',
  'shared.mergeEditor.zone.kindModifies': '~ 変更',
  'shared.mergeEditor.zone.kindUnchanged': '= 変更なし',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Merge: 次のハンクへ移動',
  'shared.mergeEditor.action.prevHunk': 'Merge: 前のハンクへ移動',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Merge: カーソル位置の入力側ハンクを取り込む',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Merge: カーソル位置の現在ハンクを取り込む',
  'shared.mergeEditor.action.applyNonConflicting': 'Merge: 競合のない変更を適用',
  'shared.mergeEditor.action.acceptAllIncoming': 'Merge: 入力側をすべて取り込む',
  'shared.mergeEditor.action.acceptAllCurrent': 'Merge: 現在をすべて取り込む',
  'shared.mergeEditor.action.undo': 'Merge: 元に戻す（バッファ + 選択状態）',
  'shared.mergeEditor.action.redo': 'Merge: やり直し（バッファ + 選択状態）',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': '入力側を取り込む',
  'shared.mergeEditor.gutter.acceptCurrent': '現在を取り込む',
  'shared.mergeEditor.gutter.appendIncoming': '現在の後に入力側も追記',
  'shared.mergeEditor.gutter.appendCurrent': '入力側の後に現在も追記',
  'shared.mergeEditor.gutter.skipIncoming': 'このハンクの入力側をスキップ',
  'shared.mergeEditor.gutter.skipCurrent': 'このハンクの現在をスキップ',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'すべてのハンクが解決済みです。',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), { other: '残り {count} 個のハンクです。' }),
  'shared.mergeEditor.announce.acceptedIncoming': '入力側のハンクを取り込みました。',
  'shared.mergeEditor.announce.acceptedCurrent': '現在のハンクを取り込みました。',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), { other: '競合のないハンクを {count} 個適用しました。' }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), { other: '入力側のハンク {count} 個をすべて取り込みました。' }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '現在のハンク {count} 個をすべて取り込みました。' }),
} as const satisfies Catalog;
