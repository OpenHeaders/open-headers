/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Japanese. Mirrors `catalogs/en/panel-quick-editor.ts` key
 * for key. Raw by design: rule/collection/folder/header/param names,
 * URLs, `{{template}}` chips, status codes + MIME values, code/JSON
 * example placeholders, direction glyphs (⬇ ⬆), `mergeSeparator` and
 * DNR schema vocabulary, the Mock tag, and core validator sentences
 * riding as holes. Mints: テンプレート = template (prose); リスナー =
 * listener; ポップオーバー = popover (ポップアップ stays the extension
 * popup); 再ターゲット = retarget; ペイロード = payload; フレーム =
 * frame; snapshot op words 注入/上書き/追記/マージ/削除 carry the
 * shared op mints; チャレンジ / 下書き / コレクション carried. OH's
 * own labels quoted in prose copy their mints in 「」 (「保存」,
 * 「すべて削除」).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'ルール名をクリア',
  'panel.quickEditor.renameTitle': '{name}。クリックして名前を変更',
  'panel.quickEditor.enabledOn': '有効',
  'panel.quickEditor.enabledOff': '無効',
  'panel.quickEditor.ruleEnabledAria': 'ルールが有効',
  'panel.quickEditor.openInTab': 'タブで開く',
  'panel.quickEditor.openInWorkspace': 'ワークスペースで開く →',
  'panel.quickEditor.saveButton': '保存',
  'panel.quickEditor.openToInspect': 'このルールを調べたり変更したりするには、ワークスペースで開いてください。',
  'panel.quickEditor.variableMissing': '変数がありません。赤い参照にホバーすると作成でき、「保存」が有効になります。',
  'panel.quickEditor.retargetHint': 'ルールを再ターゲットするには、下の条件を調整してください。',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'ルールを更新しました',
  'panel.quickEditor.toast.ruleNotFound': 'ルールが見つかりません。削除された可能性があります。',
  'panel.quickEditor.toast.saveFailed': '保存に失敗しました',
  'panel.quickEditor.toast.toggleFailed': 'ルールを切り替えられませんでした',
  'panel.quickEditor.toast.changedElsewhere':
    'ルールが別の場所で変更されました。ポップオーバーを閉じて開き直してください。',
  'panel.quickEditor.toast.noWorkspace': 'アクティブなワークスペースがありません',
  'panel.quickEditor.toast.collectionCreateFailed': 'ルール用のコレクションを作成できませんでした',
  'panel.quickEditor.toast.folderCreateFailed':
    'フォルダー「{name}」を作成できませんでした。コレクションのルートに保存します。',
  'panel.quickEditor.toast.createFailed': 'ルールの作成に失敗しました',
  'panel.quickEditor.toast.createdDraft': 'ルールを下書きとして作成しました。ワークスペースから公開してください。',
  'panel.quickEditor.toast.created': 'ルールを作成しました',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'ルールの保存先を選択',
  'panel.quickEditor.destination.savingTo': '保存先',
  'panel.quickEditor.destination.newTag': '新規',
  'panel.quickEditor.destination.autoNamed': '自動：{folder}',
  'panel.quickEditor.destination.autoRoot': '自動：コレクションのルート',
  'panel.quickEditor.destination.root': 'コレクションのルート',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'このルールがいつ発火するかを表示・編集',
  'panel.quickEditor.conditions.label': '条件',
  'panel.quickEditor.conditions.none': 'なし。どのリクエストにも一致しません',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': 'ヘッダーを追加',
  'panel.quickEditor.header.mergeSeparatorTitle': 'マージ区切り文字',
  'panel.quickEditor.header.directionRequest': 'リクエスト',
  'panel.quickEditor.header.directionResponse': 'レスポンス',
  'panel.quickEditor.validation.nameRequired': 'ヘッダー名は必須です。',
  'panel.quickEditor.validation.invalidName': 'ヘッダー名が無効です。',
  'panel.quickEditor.validation.invalidValue': 'ヘッダー値が無効です。',
  'panel.quickEditor.validation.switchTo': '{operation} に切り替え',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': '例：https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': '一致するリクエストは、ネットワークに到達する前にこの URL へ送られます。',
  'panel.quickEditor.delay.hint':
    'ナビゲーションは最大 30,000 ms、XHR/fetch は上限 5,000 ms まで遅延します。サブリソースは遅延しません。',
  'panel.quickEditor.block.editHint': '一致するリクエストは、ネットワークに到達する前にブロックされます。',
  'panel.quickEditor.block.blockRequestsTo': '次へのリクエストをブロック',
  'panel.quickEditor.block.createHint':
    '一致するリクエストは、ブラウザーを出る前にキャンセルされます。ページにはネットワークエラーとして見えます。',
  'panel.quickEditor.response.tagModify': '変更',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    'このルールは JavaScript でレスポンスを組み立てます。スクリプトを編集するにはワークスペースで開いてください。',
  'panel.quickEditor.requestBody.hint': '一致するリクエストは、ページのボディの代わりにこのボディで送られます。',
  'panel.quickEditor.requestBody.dynamicBody':
    'このルールは JavaScript でボディを組み立てます。スクリプトを編集するにはワークスペースで開いてください。',
  'panel.quickEditor.inject.sourceUrlLabel': 'ソース URL',
  'panel.quickEditor.inject.loadsStylesheetHint': '一致するページは、読み込み時にこのスタイルシートを読み込みます。',
  'panel.quickEditor.inject.loadsScriptHint': '一致するページは、読み込み時にこのスクリプトを読み込みます。',
  'panel.quickEditor.inject.injectedHint': '一致するページの読み込み時に注入されます。',
  'panel.quickEditor.message.incoming': '受信 ⬇',
  'panel.quickEditor.message.outgoing': '送信 ⬆',
  'panel.quickEditor.message.injectedConnectionsHint': 'リスナーが見る前に、一致する接続へ注入されます。',
  'panel.quickEditor.message.injectedStreamsHint': 'リスナーが見る前に、一致するストリームへ注入されます。',
  'panel.quickEditor.message.replacedFramesHint': '一致するフレームは、見られる前にこのペイロードに置き換えられます。',
  'panel.quickEditor.message.replacedEventsHint': '一致するイベントは、見られる前にこのペイロードに置き換えられます。',
  'panel.quickEditor.message.droppedFramesHint': '一致するフレームは、見られる前に破棄されます。',
  'panel.quickEditor.message.droppedEventsHint': '一致するイベントは、見られる前に破棄されます。',
  'panel.quickEditor.queryParam.addAction': 'アクションを追加',
  'panel.quickEditor.queryParam.removeAllWarning':
    '「すべて削除」はクエリ文字列全体を取り除きます。このルールの他の操作は無視されます。',
  'panel.quickEditor.auth.challengesHint':
    '一致するリクエストでのサーバー（401）およびプロキシ（407）の認証チャレンジに応答します。',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': 'ルール編集済み',
  'panel.ruleHover.tagVariableChanged': '変数が変更',
  'panel.ruleHover.tagDeleted': '削除済み',
  'panel.ruleHover.tagDisabled': '無効',
  'panel.ruleHover.tagModRemoved': '変更が削除',
  'panel.ruleHover.tagConditionsMismatch': '条件が不一致',
  'panel.ruleHover.tagWontFire': '発火しません',
  'panel.ruleHover.tagTitle.ruleDisabled': 'ルールの有効フラグがオフです。今後のどのリクエストでも発火しません。',
  'panel.ruleHover.tagTitle.modGone': '一致する変更はルールから削除されました。',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'ルールの条件はもうこの URL をカバーしていません。',
  'panel.ruleHover.tagTitle.nameUnresolved':
    'ヘッダー名テンプレートを完全には解決できません（例：TOTP を参照している）。DNR はヘッダー名内のテンプレート文字をそのまま受け付けません。',
  'panel.ruleHover.tagTitle.valueUnresolved': 'ヘッダー値テンプレートを完全には解決できません。',
  'panel.ruleHover.tagTitle.separatorUnresolved': 'マージ区切り文字テンプレートを完全には解決できません。',
  'panel.ruleHover.deletedBody': 'このルールは削除されました。上のキャプチャは、発火時に行った内容を示しています。',
  'panel.ruleHover.modRemovedBody':
    '一致する変更はルールから削除されました。作り直すか調整するには、ワークスペースで開いてください。',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': '注入',
  'panel.ruleHover.snapshot.opOverride': '上書き',
  'panel.ruleHover.snapshot.opAppend': '追記',
  'panel.ruleHover.snapshot.opMerge': 'マージ',
  'panel.ruleHover.snapshot.opRemove': '削除',
  'panel.ruleHover.snapshot.templateTitle': '発火時の変数解決前のテンプレート',
  'panel.ruleHover.snapshot.nameDriftTitle':
    '同じテンプレートですが、参照している変数が今は別のヘッダー名に解決されます',
  'panel.ruleHover.snapshot.cancels': '「{rule}」を打ち消し',
  'panel.ruleHover.snapshot.original': '元',
  'panel.ruleHover.snapshot.now': '現在',
  'panel.ruleHover.snapshot.future': '今後',
  'panel.ruleHover.snapshot.futureTitle': '次に一致するリクエストが受け取る内容',
  'panel.ruleHover.snapshot.removed': '削除',
  'panel.ruleHover.snapshot.empty': '（空）',
  'panel.ruleHover.snapshot.totpNote': 'TOTP / 遅延参照はリクエスト時に解決され、ここにはキャプチャされません。',
  'panel.ruleHover.snapshot.alsoByRule': 'このリクエストでこのルールが行った他の変更',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'ルールは削除されました。発火しません',
  'panel.ruleHover.future.ruleDisabled': 'ルールは無効です。発火しません',
  'panel.ruleHover.future.modGone': 'この変更はルールから削除されました',
  'panel.ruleHover.future.conditionsMismatch': 'ルールの条件はもうこの URL に一致しません',
  'panel.ruleHover.future.nameUnresolved': 'ヘッダー名テンプレートを解決できません。ルールは発火しません',
  'panel.ruleHover.future.valueUnresolved': '値テンプレートを解決できません。ルールは発火しません',
  'panel.ruleHover.future.separatorUnresolved': 'mergeSeparator テンプレートを解決できません。ルールは発火しません',
  'panel.ruleHover.future.templateTitle': 'テンプレート：{template}',
} as const satisfies Catalog;
