/**
 * Workbench live/workflows station — Japanese. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Reuses the live register
 * shipped in ja/workbench-variables + the chrome mints: 更新 = Refresh,
 * 上書き = override, ワークフロー = workflow, ステップ = step, キャプチャ
 * = capture, バインディング = binding, リゾルバー = resolver, 古い =
 * stale, タブ = tab, 面 = surface, クォータ = quota, 上限 = cap, 環境
 * なし = No environment (tui/variables mint), プローブ = probe (shared
 * mint), 抽出器 = extractor, アサーション = assertion. MINTS: サーキット
 * = circuit with 開放 / 閉鎖 for the open/closed states; ブレーカー =
 * breaker; 先行 = lead (prose; `lead` token raw); 公開 = expose;
 * スケジューラー = scheduler; 固定 = pin; 再試行段階 = retry tier;
 * 祖先ステップ = ancestor step; 暗黙 / 明示 = implicit / explicit;
 * 辞書順 = lexicographic. Technical plane stays raw inside keyed
 * sentences: `{{live.NAME}}` syntax, policy kind ids (expires-in /
 * expires-at), `lead` / `dependsOn` / oh.* field tokens, step ids /
 * capture names, code examples, MV3, alarm, backoff, AND/OR/OPEN,
 * epoch ms, the `(e.g.` abbrev fragment (S57 whole-raw) and the lone
 * `.` / `).`-prefixed help-split keys (S80 law: half-width parens pair
 * with the raw suffix), server error text ({error}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'アイドル',
  'workbench.editors.live.circuit.idleHint': 'キャッシュはまだありません。更新を実行して値を用意してください。',
  'workbench.editors.live.circuit.pausedLabel': '一時停止中',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      other:
        '{count} 回の連続失敗の後、サーキットは開放されています。自動再試行は先送りされています。バックオフをバイパスするには「今すぐ再試行」をクリックしてください。',
    }),
  'workbench.editors.live.circuit.probingLabel': 'プローブ中…',
  'workbench.editors.live.circuit.probingHint': 'プローブ試行が進行中です。1 回成功すればサーキットは閉鎖されます。',
  'workbench.editors.live.circuit.retryLabel': '再試行 {attempt} / 3',
  'workbench.editors.live.circuit.retryHint':
    'ブレーカー前の再試行段階です。試行間に 5–10 秒のバックオフを挟む短い再試行を行います。3 回連続で失敗するとサーキットが開放されます。',
  'workbench.editors.live.circuit.healthyLabel': '正常',
  'workbench.editors.live.circuit.healthyHint': 'サーキットは閉鎖されており、最近の失敗はありません。',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': '前回 {when}',
  'workbench.editors.live.schedule.manualOnly': '手動更新のみ',
  'workbench.editors.live.schedule.autoRefresh': '自動更新 {when}',
  'workbench.editors.live.schedule.expires': '有効期限 {when}',
  'workbench.editors.live.policy.interval': '{seconds} 秒ごと',
  'workbench.editors.live.policy.expiresIn': '{source} からの expires-in（先行 {lead} 秒）',
  'workbench.editors.live.policy.expiresAt': '{source} からの expires-at（先行 {lead} 秒）',
  'workbench.editors.live.policy.manual': '手動更新',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': '前回の実行で完了',
  'workbench.editors.live.stepRun.failed': '前回の実行はこのステップで失敗',
  'workbench.editors.live.stepRun.extractFailed': '取得しましたが、キャプチャの抽出器が一致しませんでした',
  'workbench.editors.live.stepRun.skipped': '前回の実行では実行条件によりスキップ',
  'workbench.editors.live.stepRun.notRun': 'まだ成功した実行に含まれていません',
  'workbench.editors.live.maskEmpty': '（空）',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': '名前',
  'workbench.editors.live.form.descriptionPlaceholder': '説明（省略可）',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'ソースが見つかりません。',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': '無効',
  'workbench.editors.live.variable.overrideTag': '上書き',
  'workbench.editors.live.variable.refresh': '更新',
  'workbench.editors.live.variable.valueLabel': '値',
  'workbench.editors.live.variable.neverRefreshed': '（未更新）',
  'workbench.editors.live.variable.nameLabel': '名前',
  'workbench.editors.live.variable.nameHint': '参照は {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': '説明',
  'workbench.editors.live.variable.bindingSection': 'バインディング',
  'workbench.editors.live.variable.workflowLabel': 'ワークフロー',
  'workbench.editors.live.variable.stepLabel': 'ステップ',
  'workbench.editors.live.variable.captureLabel': 'キャプチャ',
  'workbench.editors.live.variable.selectWorkflow': 'ワークフローを選択',
  'workbench.editors.live.variable.selectStep': 'ステップを選択',
  'workbench.editors.live.variable.selectCapture': 'キャプチャを選択',
  'workbench.editors.live.variable.stepOption': '{id}（{count} 件のキャプチャ）',
  'workbench.editors.live.variable.openFlow': 'フローを開く',
  'workbench.editors.live.variable.overrideSection': '手動上書き',
  'workbench.editors.live.variable.overrideValuePlaceholder': '固定の上書き値',
  'workbench.editors.live.variable.overrideExpiresLabel': '有効期限（ms）',
  'workbench.editors.live.variable.overrideExpiresHint':
    '実時刻の epoch ms。恒久的な上書きにするには空のままにしてください',
  'workbench.editors.live.variable.applyOverride': '上書きを適用',
  'workbench.editors.live.variable.clearOverride': 'クリア',
  'workbench.editors.live.variable.setOverride': '手動上書きを設定',
  'workbench.editors.live.variable.overrideNote':
    'リゾルバーは固定した値を提供します。スケジューラーは引き続き基盤のワークフローを更新します。',
  'workbench.editors.live.variable.deletedElsewhere': 'ソースが別のタブから削除されました',
  'workbench.editors.live.variable.saveFailed': 'ライブ変数の保存に失敗しました',
  'workbench.editors.live.variable.refreshFailed': '更新に失敗しました：{error}',
  'workbench.editors.live.variable.refreshed': '更新しました',
  'workbench.editors.live.variable.overrideSaveFailed': '上書きの保存に失敗しました。',
  'workbench.editors.live.variable.overrideApplied': '上書きを適用しました',
  'workbench.editors.live.variable.overrideCleared': '上書きをクリアしました',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': '新しいライブ変数',
  'workbench.editors.live.create.namePlaceholder': '名前（例：accessToken）',
  'workbench.editors.live.create.referenceAs': '参照は {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'ワークフローを作成',
  'workbench.editors.live.create.noWorkflows': 'ワークフローはまだありません。',
  'workbench.editors.live.create.nameRequired': '名前は必須です',
  'workbench.editors.live.create.bindingRequired': 'ワークフロー、ステップ、キャプチャを選択してください',
  'workbench.editors.live.create.createFailed': 'ライブ変数の作成に失敗しました',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': '有効',
  'workbench.editors.live.toggles.enabledTooltip':
    'オフにすると、ルールとリクエスト内の {{live.NAME}} 参照は解決されなくなります。',
  'workbench.editors.live.toggles.waitForFresh': '新しい値を待つ',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'ルールを適用する前に、基盤のワークフローが更新を終えるまで待ちます（最大約 5 秒）。オフ：ルールは最後にキャッシュした値を使い、バックグラウンドで更新します。速いですが、拡張機能のウェイク直後は一時的に古い値になることがあります。',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': '手動のみ',
  'workbench.editors.live.refreshPolicy.interval': '固定間隔',
  'workbench.editors.live.refreshPolicy.expiresIn': 'N 秒後に期限切れ（相対）',
  'workbench.editors.live.refreshPolicy.expiresAt': 'epoch ms で期限切れ（絶対）',
  'workbench.editors.live.refreshPolicy.leadUnit': '先行 秒',
  'workbench.editors.live.refreshPolicy.selectCapture': 'キャプチャを選択',
  'workbench.editors.live.refreshPolicy.noCaptures': 'キャプチャはまだ定義されていません。',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    '1 分未満の間隔は MV3 のアラームの下限に当たり、クォータを急速に消費します。必要な場合にのみ使ってください。',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix': 'キャプチャ値 = 期限切れまでの秒数 (例：OAuth の',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': ')。更新は `lead` 秒前に発火します：',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'キャプチャ値 = 絶対的な unix epoch、単位は',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'ミリ秒',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix': ')。更新はその時刻の `lead` 秒前に発火します。',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    '期限の計算に元となる値が必要です。まずワークフローにキャプチャを追加してください。',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'エディター',
  'workbench.editors.live.workflow.viewPreview': 'プレビュー',
  'workbench.editors.live.workflow.refresh': '更新',
  'workbench.editors.live.workflow.disabledTag': '無効',
  'workbench.editors.live.workflow.notFound': 'ワークフローが見つかりません。',
  'workbench.editors.live.workflow.deletedElsewhere': 'ワークフローが別のタブから削除されました',
  'workbench.editors.live.workflow.saveFailed': 'ワークフローの保存に失敗しました',
  'workbench.editors.live.workflow.createFailed': 'ワークフローの作成に失敗しました',
  'workbench.editors.live.workflow.refreshed': '更新しました',
  'workbench.editors.live.workflow.refreshFailed': '更新に失敗しました：{error}',
  'workbench.editors.live.workflow.defaultName': 'ワークフロー',
  'workbench.editors.live.workflow.newDraftName': '新しいワークフロー',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'ワークフローに構造上の問題があります',
  'workbench.editors.live.form.stepsTitle': 'ステップ（{count}）',
  'workbench.editors.live.form.addStepButton': 'ステップ',
  'workbench.editors.live.form.noSteps':
    'ステップはまだありません。追加して、リクエストと抽出をこのワークフローに組み込んでください。',
  'workbench.editors.live.form.enabledAria': 'ワークフローが有効',
  'workbench.editors.live.form.enabled': '有効',
  'workbench.editors.live.form.disabled': '無効',
  'workbench.editors.live.form.parallelLabel': '独立したステップを並列に実行',
  'workbench.editors.live.form.parallelTooltip': 'v1 では逐次実行のみです。並列実行は今後のリリースで提供予定です。',
  'workbench.editors.live.form.refreshPolicySection': '更新ポリシー',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'ステップ {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': '名前',
  'workbench.editors.live.step.typeTooltip': 'ステップの種類。Foreach と Composite は今後のリリースで提供予定です。',
  'workbench.editors.live.step.typeRequest': 'リクエスト',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の条件で実行' }),
  'workbench.editors.live.step.priorityTag': '優先度：{ref}',
  'workbench.editors.live.step.scriptsTag': 'scripts',
  'workbench.editors.live.step.selectRequest': 'リクエストを選択',
  'workbench.editors.live.step.descriptionPlaceholder': 'ステップの説明（省略可）',
  'workbench.editors.live.step.capturesHeader': 'キャプチャ（{count}）',
  'workbench.editors.live.step.addCapture': '+ キャプチャ',
  'workbench.editors.live.step.captureRequired':
    'ライブ変数をこのステップにバインドするには、キャプチャが少なくとも 1 つ必要です。',
  'workbench.editors.live.step.removeCaptureAria': 'キャプチャ {name} を削除',
  'workbench.editors.live.step.exposeAria': 'キャプチャ {name} をライブ変数として公開',
  'workbench.editors.live.step.exposeAs': '公開名',
  'workbench.editors.live.step.exposeTooltip':
    'オンにすると、ワークフローの保存時に、このキャプチャから `{{live.<name>}}` を解決するライブ変数が作成されます。このワークフロー内でのみキャプチャを使う場合（例：{{step.<stepId>.<captureName>}} 経由）はオフにしてください。',
  'workbench.editors.live.step.afterChip': '↳ {parents} の後',
  'workbench.editors.live.step.implicitMark': '（暗黙）',
  'workbench.editors.live.step.implicitTooltip':
    '直前のステップへの暗黙の依存です（明示的な dependsOn は宣言されていません）。関係を固定するには明示的な dependsOn を設定してください。',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': '依存先',
  'workbench.editors.live.sections.dependsOnImplicit': '（暗黙：直前のステップ）',
  'workbench.editors.live.sections.dependsOnRoot': '（ルート）',
  'workbench.editors.live.sections.dependsOnPlaceholder': '祖先ステップを選択。空 = ルートステップ',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    '明示的な dependsOn がありません。宣言順で直前のステップに暗黙に依存します。',
  'workbench.editors.live.sections.dependsOnRootHint': '明示的なルートです。ワークフローの開始と同時に実行されます。',
  'workbench.editors.live.sections.useImplicit': '暗黙を使う',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'ステップは {count} 個の祖先の完了またはスキップを待ちます。' }),
  'workbench.editors.live.sections.reset': 'リセット',
  'workbench.editors.live.sections.runCondition': '実行条件',
  'workbench.editors.live.sections.none': '（なし）',
  'workbench.editors.live.sections.priority': '優先度',
  'workbench.editors.live.sections.priorityStepPlaceholder': '祖先ステップ',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'キャプチャ名',
  'workbench.editors.live.sections.sortNumeric': '数値順',
  'workbench.editors.live.sections.sortLexicographic': '辞書順',
  'workbench.editors.live.sections.priorityTooltip':
    '次に実行できるステップが複数あるとき、優先度の値が最も小さいものが先に実行されます。値がないものは最後に並びます。',
  'workbench.editors.live.sections.clear': 'クリア',
  'workbench.editors.live.sections.retryPolicy': '再試行ポリシー',
  'workbench.editors.live.sections.retrySummary': '（{count} 回試行）',
  'workbench.editors.live.sections.retrySummaryExponential': '（{count} 回試行、指数）',
  'workbench.editors.live.sections.attemptsPlaceholder': '試行回数',
  'workbench.editors.live.sections.attemptsPrefix': '試行回数',
  'workbench.editors.live.sections.delayPrefix': '遅延 ms',
  'workbench.editors.live.sections.backoffFixed': '固定',
  'workbench.editors.live.sections.backoffExponential': '指数',
  'workbench.editors.live.sections.retryOnNetwork': 'ネットワークエラーのみ',
  'workbench.editors.live.sections.retryOn5xx': 'ネットワーク + 5xx',
  'workbench.editors.live.sections.retryOn429': 'ネットワーク + 429',
  'workbench.editors.live.sections.retryOn4xx': 'ネットワーク + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'カスタム（データとして編集）',
  'workbench.editors.live.sections.retryTooltip':
    'ネットワークの失敗（DNS、接続、タイムアウト）は、試行回数が残っている限り常に再試行します。ステータスの一致を追加すると、一致するレスポンスも再試行します。抽出エラーは決して再試行しません。再試行を無効にするには試行回数のフィールドをクリアしてください。',
  'workbench.editors.live.sections.timeout': 'タイムアウト',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'タイムアウトなし',
  'workbench.editors.live.sections.timeoutTooltip':
    '試行ごとの上限です。リクエスト（ボディの読み取りを含む）はこの上限を過ぎると中止されます。再試行するステップは試行のたびに完全なタイムアウトを得ます。上限をなくすにはフィールドをクリアしてください。',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '（オン）',
  'workbench.editors.live.sections.scriptsOff': '（オフ）',
  'workbench.editors.live.sections.runScriptsAria': 'このステップでリクエストのスクリプトを実行',
  'workbench.editors.live.sections.runScriptsLabel': 'リクエストのプリリクエスト / ポストレスポンススクリプトを実行',
  'workbench.editors.live.sections.scriptsTooltip':
    'チェーンの試行ごとに実行されます。ステップのスクリプトは読み取り専用の oh.* の面を得ます（oh.sendRequest と oh.variables.set は拒否されます）。スクリプトのエラーや oh.test のアサーションの失敗はステップを失敗させるため、最後の正常な値が保持されます。アサーションがこのワークフローの公開内容を制御します。スクリプト対応のランタイムが必要で、対応していないホストではステップはスクリプトなしで実行されます。',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'ステータス',
  'workbench.editors.live.gate.kindCaptureExists': 'キャプチャが存在する',
  'workbench.editors.live.gate.kindCaptureEquals': 'キャプチャが等しい',
  'workbench.editors.live.gate.kindCaptureMatches': 'キャプチャが一致する',
  'workbench.editors.live.gate.kindNumericCompare': 'キャプチャの数値比較',
  'workbench.editors.live.gate.kindInList': 'キャプチャがリストに含まれる',
  'workbench.editors.live.gate.kindHeaderContains': 'ヘッダーが含む',
  'workbench.editors.live.gate.futureNumericCompare': '数値比較は今後のリリースで提供予定です。',
  'workbench.editors.live.gate.futureInList': 'リスト内一致は今後のリリースで提供予定です。',
  'workbench.editors.live.gate.futureHeaderContains': 'ヘッダーが含むは今後のリリースで提供予定です。',
  'workbench.editors.live.gate.status2xx': '2xx（すべての成功）',
  'workbench.editors.live.gate.status3xx': '3xx（リダイレクト）',
  'workbench.editors.live.gate.status4xx': '4xx（クライアントエラー）',
  'workbench.editors.live.gate.status5xx': '5xx（サーバーエラー）',
  'workbench.editors.live.gate.statusEquals': '等しい…',
  'workbench.editors.live.gate.statusNotEquals': '等しくない…',
  'workbench.editors.live.gate.statusOneOf': 'いずれか…',
  'workbench.editors.live.gate.allAnd': 'すべて（AND）',
  'workbench.editors.live.gate.anyOr': 'いずれか（OR）',
  'workbench.editors.live.gate.orTooltip':
    'OR 論理は今後のリリースで提供予定です。当面は相互に排他的なゲートを持つ複数のステップを使ってください。',
  'workbench.editors.live.gate.matchModesAria': '一致モードについて',
  'workbench.editors.live.gate.noConditions': '条件がありません。依存先が完了するたびにステップが実行されます。',
  'workbench.editors.live.gate.conditionCount': '{count} 件の条件',
  'workbench.editors.live.gate.addCondition': '条件を追加',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'ステップ',
  'workbench.editors.live.gate.capturePlaceholder': 'キャプチャ名',
  'workbench.editors.live.gate.equalsPlaceholder': '等しい値',
  'workbench.editors.live.gate.removeClauseAria': '句 {number} を削除',
  'workbench.editors.live.gate.statusClassTooltip': 'そのクラスのすべてのステータスに一致します（例：2xx = 200-299）。',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': '{stepId} のステータスが {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': '{stepId} のステータスが {value} でない',
  'workbench.editors.live.graph.clauseStatusIn': '{stepId} のステータスが [{list}] のいずれか',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} が存在する',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} が /{pattern}/ に一致する',
  'workbench.editors.live.graph.menuAddStep': 'ステップを追加',
  'workbench.editors.live.graph.menuEditStep': 'ステップを編集',
  'workbench.editors.live.graph.menuDeleteStep': 'ステップを削除',
  'workbench.editors.live.graph.connectTitle': '別のステップへドラッグすると依存関係を追加します',
  'workbench.editors.live.graph.removeDependency': '依存関係を削除',
  'workbench.editors.live.graph.zoomIn': '拡大',
  'workbench.editors.live.graph.zoomOut': '縮小',
  'workbench.editors.live.graph.recenter': '中央に戻す',
  'workbench.editors.live.graph.legendClick': 'クリック',
  'workbench.editors.live.graph.legendSelect': '選択',
  'workbench.editors.live.graph.legendEditKeys': '2×クリック / ⏎',
  'workbench.editors.live.graph.legendEdit': '編集',
  'workbench.editors.live.graph.legendDelete': '削除',
  'workbench.editors.live.graph.legendConnectKeys': '○ をドラッグ',
  'workbench.editors.live.graph.legendConnect': '接続',
  'workbench.editors.live.graph.legendRightClick': '右クリック',
  'workbench.editors.live.graph.legendMenu': 'メニュー',
  'workbench.editors.live.graph.legendDragNode': 'ノードをドラッグ',
  'workbench.editors.live.graph.legendMove': '移動',
  'workbench.editors.live.graph.legendDragBg': '背景をドラッグ',
  'workbench.editors.live.graph.legendPan': 'パン',
  'workbench.editors.live.graph.legendScroll': 'スクロール',
  'workbench.editors.live.graph.legendZoom': 'ズーム',
  'workbench.editors.live.graph.editStepInForm': 'フォームでステップを編集',
  'workbench.editors.live.graph.requestNotFound': 'リクエストが見つかりません',
  'workbench.editors.live.graph.noRequestSelected': 'リクエストが選択されていません',
  'workbench.editors.live.graph.noCaptures': 'キャプチャなし',
  'workbench.editors.live.graph.orderedBy': '{ref} で順序付け',
  'workbench.editors.live.graph.exposedAs': '{{live.{name}}} として公開',
  'workbench.editors.live.graph.exposedAsPending': '{{live.{name}}} として公開。初回実行待ち',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'ワークフローステータス',
  'workbench.editors.live.status.noEnvironment': '環境なし',
  'workbench.editors.live.status.unknownEnv': '不明な環境',
  'workbench.editors.live.status.activeSuffix': '（アクティブ）',
  'workbench.editors.live.status.pillPaused': '一時停止中',
  'workbench.editors.live.status.pillProbing': 'プローブ中',
  'workbench.editors.live.status.pillRetrying': '再試行中',
  'workbench.editors.live.status.pillHealthy': '正常',
  'workbench.editors.live.status.summaryHealthy': '{count} 件正常',
  'workbench.editors.live.status.summaryRetrying': '{count} 件再試行中',
  'workbench.editors.live.status.summaryProbing': '{count} 件プローブ中',
  'workbench.editors.live.status.summaryPaused': '{count} 件一時停止中',
  'workbench.editors.live.status.loading': '読み込み中…',
  'workbench.editors.live.status.empty':
    'ワークフローの実行はまだありません。ワークフローを作成し、「更新」をクリックして値を用意してください。',
  'workbench.editors.live.status.failuresCount': '失敗：{count}',
  'workbench.editors.live.status.failuresTooltip': '最後に成功した更新以降の連続失敗回数です。',
  'workbench.editors.live.status.openingsCount': '開放：{count}',
  'workbench.editors.live.status.openingsTooltip':
    '現在のサイクルでサーキットが OPEN に遷移した回数です。十分に時間の経った回復で半減し、最近の回復で 1 減ります。',
  'workbench.editors.live.status.nextAttempt': '次回試行 {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    '次の自動プローブが実行される実時刻です。バイパスするには「今すぐ更新」をクリックしてください。',
  'workbench.editors.live.status.refreshNow': '今すぐ更新',
  'workbench.editors.live.status.resetCircuit': 'サーキットをリセット',
  'workbench.editors.live.status.resetCircuitTooltip':
    '失敗カウンターと保留中のバックオフをクリアします。プローブは実行しません。',
  'workbench.editors.live.status.circuitReset': 'サーキットをリセットしました',
  'workbench.editors.live.status.resetFailed': 'リセットに失敗しました：{error}',
  'workbench.editors.live.status.dragToResize': 'ドラッグしてサイズを変更',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'バインド：{count} 件の変数' }),
  'workbench.editors.live.status.needsReRun': '再実行が必要',
  'workbench.editors.live.status.needsReRunTooltip':
    'この値を抽出した後にワークフローまたはそれが解決する入力が変わりました。再抽出するには「更新」を実行してください。',
  'workbench.editors.live.status.neverRunForEnv':
    'この環境ではまだ実行されていません。「更新」をクリックして値を用意してください',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': '以前の実行の値を保持',
  'workbench.editors.live.runOverlay.responseBytes': 'レスポンス {bytes} バイト',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': '「{name}」からワークフローを作成',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'ワークフローを作成（{count} ステップ）' }),
  'workbench.editors.live.fromRequests.empty': 'このコンテナーにはワークフローの元になるリクエストがありません。',
  'workbench.editors.live.fromRequests.hint': '選択した各リクエストが、表示順にワークフローのステップになります。',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'グループ',
  'workbench.editors.live.extractor.groupBody': 'レスポンスボディ',
  'workbench.editors.live.extractor.groupResponse': 'レスポンス',
  'workbench.editors.live.extractor.wholeBody': 'ボディ全体',
  'workbench.editors.live.extractor.jsonPath': 'JSON パス',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': 'ヘッダー',
  'workbench.editors.live.extractor.statusCode': 'ステータスコード',
} as const satisfies Catalog;
