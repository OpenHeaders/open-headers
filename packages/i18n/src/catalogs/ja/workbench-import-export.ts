/**
 * Import/export family — Japanese. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI), file extensions and
 * filenames rendered as `<Text code>` chips (`.bru`,
 * `.openheaders.yaml`), export ids / fingerprints / entity names
 * ({id} / {name} holes carry data), the ` · ` separator glyphs,
 * Postman menus and glyph labels verbatim raw (Postman does not
 * localize Japanese), `uid` / `{{template}}` tokens, and `vault`
 * lowercase per the glossary. Chrome DevTools paths quote the real
 * ja strings（すべてを HAR 形式で保存 / cURL としてコピー — S79
 * localized-browser law）. The hub quotes the インポートハブ mint
 * (settings-defs-keyboard); the report hover quotes the shipped
 * settings path アプリケーション › データ. MINTS: フィンガープリント =
 * fingerprint; 暗号文 = ciphertext; 破棄項目 = drop (import ledger
 * noun — 拒否 / 破棄済み referents unchanged); 変換 = transform; merge
 * strategies 「新規として追加」/「置き換え」 (settings-defs reuses);
 * このコンピューターをスキャン = Scan this computer; 厳密リテラル =
 * strict literal; 匿名化 = anonymize. パスフレーズ / シークレット / 秘匿
 * / 注釈 / プリセット / 範囲 (export scope) carried.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'エクスポート',
  'workbench.importExport.export.cancel': 'キャンセル',
  'workbench.importExport.export.download': 'ダウンロード',
  'workbench.importExport.export.sourceLabel': 'ソース：',
  'workbench.importExport.export.scopeLabel': '範囲：',
  'workbench.importExport.export.filenameLabel': 'ファイル名：',
  'workbench.importExport.export.scopeWholeWorkspace': 'ワークスペース全体',
  'workbench.importExport.export.vaultSecrets': 'Vault のシークレット',
  'workbench.importExport.export.vaultOmit': '省略（デフォルト）',
  'workbench.importExport.export.vaultEncrypted': '暗号化（パスフレーズ）',
  'workbench.importExport.export.vaultPlaintext': '平文（詳細）',
  'workbench.importExport.export.passphrasePlaceholder': 'パスフレーズ',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'パスフレーズを確認',
  'workbench.importExport.export.hintPlaceholder':
    'ヒント（省略可。受信者に見えます。パスフレーズそのものは決して書かないでください）',
  'workbench.importExport.export.strengthEmpty': 'パスフレーズを入力してください',
  'workbench.importExport.export.strengthWeak': '弱い',
  'workbench.importExport.export.strengthFair': 'まずまず',
  'workbench.importExport.export.strengthGood': '良い',
  'workbench.importExport.export.strengthStrong': '強い',
  'workbench.importExport.export.strengthNote':
    'パスフレーズの強度：{label}。パスフレーズは別の経路（Signal、パスワードマネージャー、口頭）で共有してください。パスフレーズを知る人は誰でも、このエクスポート内のすべてのシークレットを読めます。',
  'workbench.importExport.export.plaintextTitle': '平文のシークレットは、このファイルを見る誰にでも読めます',
  'workbench.importExport.export.plaintextUseOnly':
    '完全に信頼できるシステムと共有する場合（例：自分の暗号化ドライブへのバックアップ）にのみ使ってください。',
  'workbench.importExport.export.switchToEncrypted': '暗号化に切り替え（推奨）',
  'workbench.importExport.export.acknowledgeRisks': 'リスクを理解しました',
  'workbench.importExport.export.fingerprintsTitle': '暗号化済み。これらのフィンガープリントを受信者と共有してください',
  'workbench.importExport.export.ciphertextFingerprint': '暗号文のフィンガープリント：',
  'workbench.importExport.export.keyFingerprint': '鍵のフィンガープリント：',
  'workbench.importExport.export.fingerprintMatchNote':
    '受信者がパスフレーズを入力すると、一致していれば同じ鍵のフィンガープリントが表示されます。',
  'workbench.importExport.export.advanced': '詳細',
  'workbench.importExport.export.strictLiteralLabel': '厳密リテラル：選択したものだけをエクスポート',
  'workbench.importExport.export.strictLiteralHelp':
    'デフォルトでは、コレクションやフォルダーを選ぶと、インポートが単独で成り立つようにすべての子孫と親のコンテナーも含まれます。厳密リテラルをオンにすると、選んだ uid だけが含まれ、含めなかったものについて受信者には依存関係の欠落が表示されます。',
  'workbench.importExport.export.oauthNote':
    'OAuth のクライアントシークレットは vault のモードにかかわらず常に省略されます。受信者は最初の認証時に自分のものを入力します。',
  'workbench.importExport.export.exportFailed': 'エクスポートに失敗しました',
  'workbench.importExport.export.exportedShareFingerprints':
    '{filename} をエクスポートしました。フィンガープリントを受信者と共有してください',
  'workbench.importExport.export.exported': '{filename} をエクスポートしました',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'インポート',
  'workbench.importExport.hub.closeAria': 'インポートを閉じる',
  'workbench.importExport.hub.readingFile': 'ファイルを読み込んでいます…',
  'workbench.importExport.hub.pastePlaceholder': 'curl コマンドまたは URL を貼り付け',
  'workbench.importExport.hub.continueAria': 'インポートを続行',
  'workbench.importExport.hub.notRecognized':
    'まだ認識できません。curl コマンド、URL、HAR、Postman / Insomnia / Bruno のエクスポート、OpenAPI ドキュメント、またはワークスペースのエクスポートを貼り付けてください。',
  'workbench.importExport.hub.dropAria': 'インポートできるファイルまたはフォルダーをここにドロップ',
  'workbench.importExport.hub.dropTitle': 'ファイルまたはフォルダーをドロップしてインポート',
  'workbench.importExport.hub.kindHar': 'HAR キャプチャ',
  'workbench.importExport.hub.kindPostman': 'Postman のコレクションまたはバックアップ',
  'workbench.importExport.hub.kindInsomnia': 'Insomnia のエクスポート',
  'workbench.importExport.hub.kindBrunoSuffix': 'ファイルまたはコレクションフォルダー',
  'workbench.importExport.hub.kindOpenapi': 'OpenAPI 3.x ドキュメント',
  'workbench.importExport.hub.kindGraphqlSchema': 'GraphQL スキーマ（SDL またはイントロスペクション JSON）',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'ワークスペースのエクスポート',
  'workbench.importExport.hub.autoDetected': '形式は自動的に認識されます。',
  'workbench.importExport.hub.browseFiles': 'ファイルを参照…',
  'workbench.importExport.hub.browseFolder': 'フォルダーを参照…',
  'workbench.importExport.hub.switchingFrom': '移行元が',
  'workbench.importExport.hub.switchingOr': 'または',
  'workbench.importExport.hub.migrateCta': '別のツールから移行',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    'そのフォルダーに Bruno のファイルはありません。.bru ファイルまたは bruno.json が必要です。',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のファイルを読み取れず、スキップしました。' }),
  'workbench.importExport.modals.readFailed': '{name} を読み取れませんでした：{message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `"${label}" から ${plural(locale, Number(count), { other: '{count} 件のエンティティをインポートしました' })}`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'ワークスペースのエクスポートをインポート',
  'workbench.importExport.preview.closeAria': 'インポートプレビューを閉じる',
  'workbench.importExport.preview.cancel': 'キャンセル',
  'workbench.importExport.preview.emptyFile': '.openheaders.yaml ファイルをドロップするとプレビューします。',
  'workbench.importExport.preview.emptyClipboard': 'ワークスペースのエクスポートを貼り付けるとプレビューします。',
  'workbench.importExport.preview.preparing': 'インポートを準備中…',
  'workbench.importExport.preview.footerExportInfo': 'エクスポート {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'プレビューするファイルを選択',
  'workbench.importExport.preview.footerNoData': 'データなし',
  'workbench.importExport.preview.importInto': 'インポート先：',
  'workbench.importExport.preview.staleTitle': 'このプレビューを開いた後にワークスペースが変更されました',
  'workbench.importExport.preview.staleDescription':
    'インポートプレビューを開き直して差分を更新し、もう一度お試しください。',
  'workbench.importExport.preview.advanced': '詳細',
  'workbench.importExport.preview.advancedCount': '詳細（{count}）',
  'workbench.importExport.preview.previewFailed': 'プレビューに失敗しました',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `インポート：${plural(locale, Number(count), { other: '{count} 件のアイテム' })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'インポート先',
  'workbench.importExport.target.current': '現在',
  'workbench.importExport.target.new': '新規',
  'workbench.importExport.target.pickExisting': '既存を選択',
  'workbench.importExport.target.noActiveWorkspace': 'アクティブなワークスペースがありません',
  'workbench.importExport.target.selectWorkspace': 'ワークスペースを選択',
  'workbench.importExport.target.landsOnOrg': '{name} に置かれ、そのデバイスに同期されます',
  'workbench.importExport.target.staysLocal': 'このデバイスに留まります',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': '詳細',
  'workbench.importExport.advanced.closeAria': '詳細パネルを閉じる',
  'workbench.importExport.advanced.backupRestoreLabel': 'これは自分のものです：uid での更新を優先',
  'workbench.importExport.advanced.backupRestoreHelp':
    'uid が一致する衝突を「新規として追加」から「置き換え」に切り替えます。エクスポート作成後にローカルで編集されたエンティティはスキップされます。',
  'workbench.importExport.advanced.trustExportLabel': 'このエクスポートを信頼：有効フラグを保持',
  'workbench.importExport.advanced.trustExportHelp':
    'インポートされたルール / ライブワークフロー / ライブ変数はデフォルトで無効の状態で置かれます。送信者を信頼できる場合にのみ有効にしてください。',
  'workbench.importExport.advanced.stripScriptsLabel': 'インポート時にリクエストスクリプトを除去',
  'workbench.importExport.advanced.stripScriptsHelp':
    'インポートされるすべてのリクエストからプリリクエストとポストレスポンスのスクリプトを削除します。送信者に馴染みがない場合に推奨します。',
  'workbench.importExport.advanced.omitOAuthLabel': 'OAuth の設定を省略',
  'workbench.importExport.advanced.omitOAuthHelp':
    'デフォルトでは、OAuth2 の設定はリクエストとともに運ばれます（token エンドポイント、client id、スコープ。クライアントシークレットや token は決して含まれません）。オンにすると、すべての OAuth2 リクエストは認証が「なし」の状態で置かれます。',
  'workbench.importExport.advanced.keepOrderLabel': '更新時に対象コレクションの順序を保持',
  'workbench.importExport.advanced.keepOrderHelp':
    'デフォルトでは、更新されたコレクションはエクスポートの子の順序を取ります。オンにすると、既存の対象側の順序が保たれます。',
  'workbench.importExport.advanced.workspaceSettingsLabel': 'ワークスペースレベルの設定を含める',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'ワークスペースの意味を持つ設定の将来の許可リストのために予約されています。現在の許可リストは空で、v1 ではこの切り替えで何も運ばれません。',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'workspace.uid の衝突時に拒否',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'デフォルトでは、新しいワークスペースへのインポートは衝突時にワークスペースの uid をサイレントに再生成します。オンにすると、同じ uid を持つ既存のワークスペースがインポートをブロックします。',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': '閉じる',
  'workbench.importExport.chips.plaintextLabel': '平文のシークレット',
  'workbench.importExport.chips.plaintextTitle': 'このエクスポートには平文の vault シークレットが含まれています。',
  'workbench.importExport.chips.plaintextBody':
    'このファイルを持つ人は誰でも、そこに含まれるすべてのシークレットを読めます。転送する前に暗号化して再発行することを検討してください。',
  'workbench.importExport.chips.skippedLabel': '{count} 件スキップ',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のエンティティを解析できず、スキップされます。' }),
  'workbench.importExport.chips.andMore': '…他 {count} 件',
  'workbench.importExport.chips.dedupSameLabel': 'ここに既にインポート済み',
  'workbench.importExport.chips.dedupSameTitle': 'このエクスポート（{id}）は {date} にここにインポートされています。',
  'workbench.importExport.chips.dedupSameBody':
    '再インポートすると、現在のエンティティごとの戦略の選択が適用されます。',
  'workbench.importExport.chips.dedupOtherLabel': '別の場所にインポート済み',
  'workbench.importExport.chips.dedupOtherTitle': 'エクスポート {id} は「{name}」にもインポートされています。',
  'workbench.importExport.chips.dedupOtherBody': 'そのワークスペースはこのインポートの影響を受けません。',
  'workbench.importExport.chips.dedupUidLabel': 'ソースが既に存在します',
  'workbench.importExport.chips.dedupUidTitle': 'このソースからのワークスペースが既に存在します（「{name}」）。',
  'workbench.importExport.chips.dedupUidBody':
    'それを更新するには上の対象を切り替えてください。または新しいコピーとしてインポートします。',
  'workbench.importExport.chips.staleLabel': 'データが変更されました',
  'workbench.importExport.chips.staleTitle': '対象のワークスペースが別のタブで変更されました。',
  'workbench.importExport.chips.staleBody':
    '下の衝突ツリーは更新されました。確認してから、もう一度「インポート」をクリックしてください。',
  'workbench.importExport.chips.previewErrorLabel': 'プレビューに失敗',
  'workbench.importExport.chips.previewErrorTitle': '衝突の差分を計算できませんでした。',
  'workbench.importExport.chips.unresolvedLabel': '{count} 件未解決',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の未解決の参照。' }),
  'workbench.importExport.chips.unresolvedBody':
    'これらの名前はエクスポートでも対象でも解決されません。インポートすると壊れたバインディングとして置かれます。欠けているエンティティが現れたら再バインドしてください。',
  'workbench.importExport.chips.referencedBy': '{count} 件から参照',
  'workbench.importExport.chips.summaryThen': '以前：',
  'workbench.importExport.chips.summaryNow': '現在：',
  'workbench.importExport.chips.summaryNew': '{count} 件新規',
  'workbench.importExport.chips.summaryKept': '{count} 件保持',
  'workbench.importExport.chips.summaryRemoved': '{count} 件削除',
  'workbench.importExport.chips.showBreakdown': 'セクションごとの内訳を表示',
  'workbench.importExport.chips.hideBreakdown': '内訳を非表示',
  'workbench.importExport.chips.sectionNew': '（+{count} 件新規）',
  'workbench.importExport.chips.sectionRemoved': '（{count} 件削除）',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '暗号化された vault：{count} 件のシークレット' }),
  'workbench.importExport.vault.hintFromSender': '送信者からのヒント：',
  'workbench.importExport.vault.enterPassphrase':
    'これらのシークレットをローカルで復号するにはパスフレーズを入力してください。復号をスキップしても残りのインポートは進み、シークレットは単に省略されます。',
  'workbench.importExport.vault.passphrasePlaceholder': 'パスフレーズ',
  'workbench.importExport.vault.decrypt': 'vault を復号',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'vault を復号しました：{count} 件のシークレットをインポートできます' }),
  'workbench.importExport.vault.keyFingerprint': '鍵のフィンガープリント：',
  'workbench.importExport.vault.compareWithSender': '（送信者と照合してください）',
  'workbench.importExport.vault.ciphertextFingerprint': '暗号文のフィンガープリント：',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      other: '{count} 件のシークレットをデコードできませんでした。インポートから省略されます',
    }),
  'workbench.importExport.vault.andMore': '…他 {count} 件',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'キャンセル',
  'workbench.importExport.import.importCta': 'インポート',
  'workbench.importExport.import.importCtaCount': 'インポート（{count}）',
  'workbench.importExport.import.importShortcutTooltip': 'インポート（{shortcut}）',
  'workbench.importExport.import.importTo': 'インポート先',
  'workbench.importExport.import.hintNavigate': '移動',
  'workbench.importExport.import.hintSelect': '選択',
  'workbench.importExport.import.hintImport': 'インポート',
  'workbench.importExport.import.hintClose': '閉じる',
  'workbench.importExport.import.cantReadFile': 'このファイルを読み取れませんでした',
  'workbench.importExport.import.failedCreateCollection': 'コレクションの作成に失敗しました',
  'workbench.importExport.import.importFailed': 'インポートに失敗しました：{message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の変換' }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の破棄項目' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリクエストをインポートしました' }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'HAR からインポート',
  'workbench.importExport.har.tooltipChooseFile': 'まず .har ファイルを選んでください',
  'workbench.importExport.har.tooltipSelectEntry': 'エントリを少なくとも 1 つ選んでください',
  'workbench.importExport.har.footerSelected': '{total} 件中 {selected} 件を選択',
  'workbench.importExport.har.footerChooseFile': '.har ファイルを選択',
  'workbench.importExport.har.introPrefix': 'DevTools やプロキシからエクスポートした',
  'workbench.importExport.har.introSuffix':
    'ファイル（HTTP Archive）をインポートします。各エントリは選んだコレクション内のリクエストになります。Cookie と multipart のアップロードは追跡用の注釈付きで破棄され、認証ヘッダーは第一級の認証タイプに昇格します。',
  'workbench.importExport.har.filterPlaceholder': 'URL / メソッド / 名前でフィルター',
  'workbench.importExport.har.selectAll': 'すべて選択',
  'workbench.importExport.har.selectNone': 'なし',
  'workbench.importExport.har.readFailed': 'HAR の読み取りに失敗しました：{message}',
  'workbench.importExport.har.dropTitle': '.har ファイルをここにドロップするか、クリックして選択',
  'workbench.importExport.har.dropHint': 'DevTools の Network → 右クリック → すべてを HAR 形式で保存 でエクスポート',
  'workbench.importExport.har.noImportableEntries': 'このファイルにインポートできるエントリはありません。',
  'workbench.importExport.har.noFilterMatch': 'フィルターに一致するエントリはありません。',
  'workbench.importExport.har.showingFirst':
    '{total} 件中最初の {shown} 件を表示しています。フィルターで絞り込んでください。',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'ソースに {count} 件の変換を適用' }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の破棄項目を記録' }),
  'workbench.importExport.har.transformsTooltip':
    '変換はソースのフィールドを正規化された同等物に書き換えます。例：Authorization ヘッダーを第一級の認証タイプに昇格。',
  'workbench.importExport.har.dropsTooltip':
    '破棄項目はモデルに対応しないソースのフィールド（Cookie、multipart のアップロードなど）です。それぞれ完全なレポートに追跡用の注釈があります。',
  'workbench.importExport.har.reportHover':
    'ホバーで詳細 · 完全な一覧はインポートレポートのエクスポート（アプリケーション › データ）',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'curl からインポート',
  'workbench.importExport.curl.tooltipPasteFirst': 'まず curl コマンドを貼り付けてください',
  'workbench.importExport.curl.tooltipEnterName': '名前を入力してください',
  'workbench.importExport.curl.introPrefix': '',
  'workbench.importExport.curl.introSuffix':
    'コマンドを貼り付けてください。例：ブラウザーの DevTools の「cURL としてコピー」や API ドキュメントから。',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': 'このコマンドを解析できませんでした',
  'workbench.importExport.curl.parseFallback': '解析できませんでした。コマンドを確認してもう一度お試しください。',
  'workbench.importExport.curl.nameLabel': '名前',
  'workbench.importExport.curl.namePlaceholder': 'サイドバーでのこのリクエストの表示名',
  'workbench.importExport.curl.failedCreateRequest': 'リクエストの作成に失敗しました',
  'workbench.importExport.curl.importedName': '「{name}」をインポートしました',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のヘッダー' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のクエリパラメーター' }),
  'workbench.importExport.curl.noBody': 'ボディなし',
  'workbench.importExport.curl.bodyType': '{type} ボディ',
  'workbench.importExport.curl.noAuth': '認証なし',
  'workbench.importExport.curl.authType': '{type} 認証',
  'workbench.importExport.curl.droppedWord': '破棄',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'Postman からインポート',
  'workbench.importExport.postman.intro':
    'Postman Collection v2.1 の JSON をインポートします。フォルダー構造、コレクション変数、リクエストのドキュメントと設定、リクエストごとの認証（basic / bearer / api-key / OAuth 2.0）、リクエストスクリプト（可能な限り oh.* API に翻訳）が保持されます。AWS sigv4 とファイルアップロードは破棄項目として追跡されます。任意で Postman の環境ファイルを添付すると、対応する環境が置かれます。',
  'workbench.importExport.postman.tooltipChooseFile': 'まずコレクションファイルを選んでください',
  'workbench.importExport.postman.tooltipEnterName': 'コレクション名を入力してください',
  'workbench.importExport.postman.collectionNameLabel': 'コレクション名',
  'workbench.importExport.postman.collectionNamePlaceholder': '新しいコレクションの名前',
  'workbench.importExport.postman.readFileFailed': 'ファイルの読み取りに失敗しました：{message}',
  'workbench.importExport.postman.readEnvFailed': '環境の読み取りに失敗しました：{message}',
  'workbench.importExport.postman.parsedCollection': '解析したコレクション',
  'workbench.importExport.postman.requestsLabel': 'リクエスト：',
  'workbench.importExport.postman.foldersLabel': 'フォルダー：',
  'workbench.importExport.postman.collectionVarsLabel': 'コレクション変数：',
  'workbench.importExport.postman.folderTree': 'フォルダーツリー',
  'workbench.importExport.postman.optionalEnvFile': '省略可 · 環境ファイル',
  'workbench.importExport.postman.environmentLabel': '環境：{name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の変数' }),
  'workbench.importExport.postman.secretCount': '{count} 件のシークレット',
  'workbench.importExport.postman.remove': '削除',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の環境変数を破棄（無効なエントリ）' }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Postman Collection v2.1 の JSON をここにドロップするか、クリックして選択',
  'workbench.importExport.postman.dropEnvTitle': 'Postman の環境 JSON をここにドロップ（省略可）',
  'workbench.importExport.postman.dropCollectionHint':
    'Postman → Collection → ⋯ → Export（Collection v2.1）でエクスポート',
  'workbench.importExport.postman.dropEnvHint': 'Postman → Environments → ⋯ → Export でエクスポート',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のフォルダー' }),
  'workbench.importExport.postman.oneEnvironment': '1 個の環境',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'Postman のバックアップからインポート',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Postman のバックアップデータダンプをインポートします。コレクション、環境、グローバル、ヘッダープリセットが認識され、ヘッダープリセットは未公開のヘッダールールとして置かれます。スクリプト、OAuth 2.0、AWS sigv4、ファイルアップロードは破棄項目として追跡されます。',
  'workbench.importExport.sectioned.titleInsomnia': 'Insomnia からインポート',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Insomnia のエクスポート（v4 JSON または v5 YAML）をインポートします。ワークスペースはフォルダーツリー付きのコレクションになり、環境は平坦化され（サブ環境はベースの上にマージ）、{{ _.var }} の参照は {{var}} に書き換えられます。埋め込まれた API 仕様は、生成されたコレクションにリンクされた編集可能な仕様として保持されます。',
  'workbench.importExport.sectioned.titleBruno': 'Bruno からインポート',
  'workbench.importExport.sectioned.blurbBruno':
    'Bruno の .bru リクエストまたはコレクションフォルダー全体をインポートします。メソッド、ヘッダー、パラメーター、ボディ、basic / bearer / api-key の認証が保持されます。フォルダーはフォルダーツリー、順序、環境を持ち込みます。スクリプト、テスト、ドキュメントのブロックは破棄項目として追跡されます。',
  'workbench.importExport.sectioned.titleOpenapi': 'OpenAPI からインポート',
  'workbench.importExport.sectioned.blurbOpenapi':
    'OpenAPI 3.x ドキュメント（JSON または YAML）をインポートします。操作は {{baseUrl}} の下のリクエストになり、タグはフォルダーになり、パラメーターとリクエストボディは保持され（スキーマのみのボディにはプレースホルダーの雛形が入ります）、セキュリティスキームは認証に対応付けられます。インポート後に {{clientId}}/{{clientSecret}} のプレースホルダーを埋めてください。ドキュメントは、生成されたコレクションにリンクされた編集可能な仕様として残すこともできます。',
  'workbench.importExport.sectioned.titleGraphqlSchema': 'GraphQL スキーマをインポート',
  'workbench.importExport.sectioned.blurbGraphqlSchema':
    'GraphQL スキーマ（SDL テキストまたはイントロスペクション結果）をインポートします。GraphQL リクエストがスキーマのソースとしてリンクする編集可能な仕様として置かれます。後で開くと、ルートフィールドからリクエストのコレクションを生成できます。',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'まだ何も解析されていません',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'すべてのコレクションに名前が必要です',
  'workbench.importExport.sectioned.cantReadImport': 'このインポートを読み取れませんでした',
  'workbench.importExport.sectioned.readInputFailed': '入力の読み取りに失敗しました：{message}',
  'workbench.importExport.sectioned.importAs': 'インポート形式',
  'workbench.importExport.sectioned.specWithCollection': 'コレクション付きの仕様',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'ドキュメントは、生成されたコレクションにリンクされた編集可能な仕様として残ります。',
  'workbench.importExport.sectioned.collectionOnly': 'コレクション',
  'workbench.importExport.sectioned.collectionOnlyHelp': '変換のみ。ドキュメントそのものは保持されません。',
  'workbench.importExport.sectioned.specificationsSection': '仕様 · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'コレクション · {count}',
  'workbench.importExport.sectioned.environmentsSection': '環境 · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'ヘッダープリセット · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'コレクション名',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の変数' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のヘッダー' }),
  'workbench.importExport.sectioned.presetsNote':
    '各プリセットは未公開のヘッダールールとして置かれます。条件を追加し、準備ができたら公開してください。それまではライブトラフィックに何も触れません。',
  'workbench.importExport.sectioned.nothingImportable': 'このファイルにインポートできるものはありません',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'ファイルは解析できましたが、すべてのセクションが空か破棄されました。下のインポートの注記を参照してください。',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリクエスト' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の仕様' }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個の環境' }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のヘッダールール（未公開）' }),
  'workbench.importExport.sectioned.importedLead': '{parts}をインポートしました',
  'workbench.importExport.sectioned.emptyFinish': 'インポートが完了しました。持ち込むものはありませんでした',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': '別のツールから移行',
  'workbench.importExport.migrate.scanCta': 'このコンピューターをスキャン',
  'workbench.importExport.migrate.pullCta': 'Postman アカウントからインポート',
  'workbench.importExport.migrate.scanNote':
    'スキャンは決まったアプリケーションフォルダーの一覧を確認し、ツールのデータファイル（バックアップとローカルストア）だけを読みます。資格情報、Cookie、セッションのファイルは決して開かず、何もこのコンピューターから出ません。何かをインポートするのは別の明示的なステップです。',
  'workbench.importExport.migrate.scanFailed':
    'スキャンを実行できませんでした。もう一度お試しいただくか、エクスポートしたファイルでインポートハブを使ってください。',
  'workbench.importExport.migrate.backupReadFailed': 'バックアップファイルを読み取れませんでした。',
  'workbench.importExport.migrate.localReadFailed': 'ローカルデータを読み取れませんでした。',
  'workbench.importExport.migrate.detected': '検出',
  'workbench.importExport.migrate.notFound': '見つかりません',
  'workbench.importExport.migrate.cancel': 'キャンセル',
  'workbench.importExport.migrate.fromAccount': 'Postman アカウントからインポート',
  'workbench.importExport.migrate.localDataPrefix':
    'ローカルの Insomnia、Thunder Client、Bruno のデータがありますか？ツールからエクスポートして、ファイルを',
  'workbench.importExport.migrate.importHub': 'インポートハブ',
  'workbench.importExport.migrate.localDataSuffix':
    'にドロップしてください。または Open Headers デスクトップアプリでこのコンピューターをスキャンしてください。',
  'workbench.importExport.migrate.desktopConnected':
    'デスクトップアプリが接続されています。そちらで「別のツールから移行」を選んでください。進捗はここに反映され、インポートされたワークスペースは同期されます。',
  'workbench.importExport.migrate.desktopNeeded':
    'スキャンにはデスクトップアプリが必要です。そちらで実行すると、インポートされたワークスペースがこのブラウザーに同期されます。',
  'workbench.importExport.migrate.closeConfirmTitle': 'インポートを閉じますか？',
  'workbench.importExport.migrate.closeListingContent':
    'ワークスペースの一覧をまだ取得中です。大きなアカウントでは 1 分ほどかかることがあります。閉じると一覧の取得を中断します。',
  'workbench.importExport.migrate.closeListingOk': '待ち続ける',
  'workbench.importExport.migrate.closeSelectingContent':
    'ワークスペースの選択は破棄されます。まだ何もインポートされていません。',
  'workbench.importExport.migrate.closeSelectingOk': '選択を続ける',
  'workbench.importExport.migrate.closeAnyway': 'それでも閉じる',
  'workbench.importExport.migrate.discardAndClose': '破棄して閉じる',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — translate to match Postman's UI language
  // where it localizes; otherwise keep the English labels.
  'workbench.importExport.pull.keyIntro':
    'Postman API key を貼り付けると、ワークスペースを一覧し、インポートするものを選べます。',
  'workbench.importExport.pull.keyAria': 'Postman API key',
  'workbench.importExport.pull.listCta': 'ワークスペースを一覧',
  'workbench.importExport.pull.listFailed': 'ワークスペースを一覧できませんでした。',
  'workbench.importExport.pull.startFailed': 'インポートを開始できませんでした。',
  'workbench.importExport.pull.quipContacting': 'Postman アカウントに問い合わせ中',
  'workbench.importExport.pull.quipCounting': 'コレクションを数えています',
  'workbench.importExport.pull.quipWeighing': '環境を量っています',
  'workbench.importExport.pull.quipWrangling': 'ワークスペースをまとめています',
  'workbench.importExport.pull.quipAlphabetizing': 'フォルダーを並べ替えています',
  'workbench.importExport.pull.quipSniffing': 'リクエストを嗅ぎ回っています',
  'workbench.importExport.pull.quipUntangling': '変数をほぐしています',
  'workbench.importExport.pull.quipStacking': 'ヘッダーを積み上げています',
  'workbench.importExport.pull.pickIntro':
    '選択した各 Postman ワークスペースは、名前をそのままに独自のワークスペースとして置かれ、終了時にレポートが付きます。',
  'workbench.importExport.pull.noWorkspaces': 'このアカウントにワークスペースは見つかりませんでした。',
  'workbench.importExport.pull.workspaceCounts': '{collections} 個のコレクション · {environments} 個の環境',
  'workbench.importExport.pull.importCta': '選択したものをインポート',
  'workbench.importExport.pull.back': '戻る',
  'workbench.importExport.pull.steps.menuA': 'Postman アプリまたは https://postman.co で',
  'workbench.importExport.pull.steps.menuB': 'Settings menu → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Left sidebar → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': '任意の名前を入力 → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'キーをコピー → 上に貼り付け',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'ベンダー',
  'workbench.importExport.detection.dataFoundCol': '見つかったデータ',
  'workbench.importExport.detection.contentsCol': '内容',
  'workbench.importExport.detection.backupFrom': '{date} のバックアップ',
  'workbench.importExport.detection.localData': 'ローカルデータ',
  'workbench.importExport.detection.importCta': 'インポート…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'またはエクスポートして（Preferences → Data → Export）、ファイルを次にドロップしてください：',
  'workbench.importExport.detection.backupContents':
    '{collections} 個のコレクション · {environments} 個の環境 · {headerPresets} 件のヘッダープリセット · {globals} 件のグローバル',
  'workbench.importExport.detection.localContents':
    '{collections} 個のコレクション · {environments} 個の環境 · {requests} 件のリクエスト',
  'workbench.importExport.detection.emptyScanned':
    'このコンピューターにインポートできるデータストアは見つかりませんでした。',
  'workbench.importExport.detection.emptyNotScanned':
    'まだスキャンしていません。「このコンピューターをスキャン」でインポートできるデータをここに一覧します。',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のストアファイルをスキップしました：' }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Postman インポートレポート',
  'workbench.importExport.report.noReport': 'このワークスペースのインポートレポートは見つかりませんでした。',
  'workbench.importExport.report.cleanImport': 'すべてクリーンにインポートされました。破棄項目も変換もありません。',
  'workbench.importExport.report.copyOk': 'レポートを JSON としてコピーしました',
  'workbench.importExport.report.copyAnonymizedOk': '匿名化したレポートを JSON としてコピーしました',
  'workbench.importExport.report.copyFailed': 'レポートをコピーできませんでした。',
  'workbench.importExport.report.copyReport': 'レポートをコピー',
  'workbench.importExport.report.download': 'ダウンロード',
  'workbench.importExport.report.anonymizeTooltip':
    '公開で共有する場合（例：GitHub の issue）向けです。ワークスペース名は「Workspace N」になり、書き換えられた値は秘匿されます。パス、理由、件数は残るため、レポートは引き続きデバッグに使えます。',
  'workbench.importExport.report.anonymize': '匿名化',
  'workbench.importExport.report.close': '閉じる',
  'workbench.importExport.report.openWorkspace': 'ワークスペースを開く',
  'workbench.importExport.report.countsLine':
    '{collections} 個のコレクション · {environments} 個の環境 · {requests} 件のリクエスト',
  'workbench.importExport.report.savedExamplesPart': '{count} 件の保存済みの例',
  'workbench.importExport.report.globalVariablesPart': '{count} 件のグローバル変数',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の注記' }),
  'workbench.importExport.report.summaryImported': 'インポート済み',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'コレクション' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { other: '環境' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'リクエスト' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), { other: '保存済みの例' }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'グローバル変数' }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のワークスペース' }),
  'workbench.importExport.report.withOpen': '（含む：',
  'workbench.importExport.report.and': 'と',
  'workbench.importExport.report.into': '→',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': '以前',
  'workbench.importExport.reimport.previouslyImported': '（{age}にインポート済み）',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), { other: '前回のインポート以降の新しい問題 {count} 件' }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), { other: '以前は非対応だったエントリ {count} 件が対応済みになりました' }),
  'workbench.importExport.reimport.countsChanged': '前回のインポート以降に件数が変わりました',
  'workbench.importExport.reimport.minorChanges': '前回のインポートとの軽微な差',
  'workbench.importExport.reimport.newDrops': '新しい破棄項目（{count}）',
  'workbench.importExport.reimport.dropsResolved': '解消した破棄項目（{count}）',
  'workbench.importExport.reimport.newTransforms': '新しい変換（{count}）',
  'workbench.importExport.reimport.transformsResolved': '不要になった変換（{count}）',
} as const satisfies Catalog;
