/**
 * Workbench editors — the API spec editor — Japanese. Mirrors
 * `catalogs/en/workbench-editors-spec.ts` key for key. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto `package` /
 * `import` / `service` / `message` / `enum`) and ride raw; `Files` is
 * app grouping and translates（ファイル）. The AsyncAPI Send/Receive
 * badges mirror the document's `action` enum and stay raw — a
 * different referent from the Send button mint 送信. `ROOT` badge raw;
 * `baseUrl` verbatim as a bare variable name (never compounded).
 * Field chips translate per the de/es parity lock (名前 / 説明 /
 * ヘッダー / パラメーター / ボディ) with `auth` riding raw as the
 * code-ish field id. 仕様 = spec; コレクション = collection;
 * アウトライン = the outline (document tree); 概要 = the Overview pane
 * title. MINTS: streaming modes ユナリー / サーバーストリーミング /
 * クライアントストリーミング / 双方向ストリーミング — editors-grpc ja
 * MUST reuse; Root ファイル = Root file (Root raw, half-width space).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': '仕様が見つかりません。',
  'workbench.editors.spec.deletedElsewhere': 'この仕様は別のセッションで削除されました。',
  'workbench.editors.spec.saveFailed': '仕様を保存できませんでした。',
  'workbench.editors.spec.validation.clean': '問題は見つかりませんでした',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のエラー' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の警告' }),
  'workbench.editors.spec.outline.title': '概要',
  'workbench.editors.spec.outline.show': '概要を表示',
  'workbench.editors.spec.outline.hide': '概要を非表示',
  'workbench.editors.spec.outline.empty': 'ドキュメントが解析できるとアウトラインが表示されます。',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Root ファイルに指定',
  'workbench.editors.spec.outline.fileMenuAria': 'ファイルの操作',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.query': 'Query',
  'workbench.editors.spec.outline.groups.mutation': 'Mutation',
  'workbench.editors.spec.outline.groups.subscription': 'Subscription',
  'workbench.editors.spec.outline.groups.types': 'Types',
  'workbench.editors.spec.outline.groups.interfaces': 'Interfaces',
  'workbench.editors.spec.outline.groups.unions': 'Unions',
  'workbench.editors.spec.outline.groups.inputs': 'Inputs',
  'workbench.editors.spec.outline.groups.scalars': 'Scalars',
  'workbench.editors.spec.outline.groups.directives': 'Directives',
  'workbench.editors.spec.outline.groups.files': 'ファイル',
  'workbench.editors.spec.outline.streaming.unary': 'ユナリー',
  'workbench.editors.spec.outline.streaming.server': 'サーバーストリーミング',
  'workbench.editors.spec.outline.streaming.client': 'クライアントストリーミング',
  'workbench.editors.spec.outline.streaming.bidi': '双方向ストリーミング',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'サーバーを追加',
  'workbench.editors.spec.outline.add.tag': 'タグを追加',
  'workbench.editors.spec.outline.add.path': 'パスを追加',
  'workbench.editors.spec.outline.add.operation': '操作を追加',
  'workbench.editors.spec.outline.add.schema': 'スキーマを追加',
  'workbench.editors.spec.outline.add.securityScheme': 'セキュリティスキームを追加',
  'workbench.editors.spec.outline.add.securityRequirement': 'セキュリティ要件を追加',
  'workbench.editors.spec.generate.button': 'コレクションを生成',
  'workbench.editors.spec.generate.collectionsButton': 'コレクション',
  'workbench.editors.spec.generate.popoverTitle': '生成されたコレクション',
  'workbench.editors.spec.generate.modalTitle': 'コレクションを生成',
  'workbench.editors.spec.generate.blurb':
    'この仕様からコレクションを生成します。操作は baseUrl コレクション変数の下のリクエストになり、タグはフォルダーになり、セキュリティスキームは認証に対応付けられます。コレクションはこの仕様にリンクされたままになります。',
  'workbench.editors.spec.generate.namePlaceholder': 'コレクション名',
  'workbench.editors.spec.generate.nameRequired': 'コレクションには名前が必要です',
  'workbench.editors.spec.generate.dirtyHint':
    'エディターの未保存の変更は含まれません。生成は最後に保存したドキュメントを使います。',
  'workbench.editors.spec.generate.parseFailed': 'この仕様は解析できません',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリクエスト' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のフォルダー' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のコレクション変数' }),
  'workbench.editors.spec.generate.action': '生成',
  'workbench.editors.spec.generate.success': '「{name}」を生成しました：{summary}',
  'workbench.editors.spec.generate.failed': 'コレクションを作成できませんでした。',
  'workbench.editors.spec.generate.linkFailed':
    'コレクションは生成されましたが、仕様へのリンクの記録に失敗しました。この一覧には表示されません。',
  'workbench.editors.spec.generateProto.blurb':
    'この仕様からコレクションを生成します。サービスのメソッドは、例のメッセージが事前入力された gRPC リクエストになり、サービスごとのフォルダーにまとめられます。コレクションはこの仕様にリンクされたままになります。',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の gRPC リクエスト' }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のサービス' }),
  'workbench.editors.spec.generateProto.empty': 'ドキュメントには生成元となるサービスメソッドが宣言されていません。',
  'workbench.editors.spec.generateProto.partial': '欠けのある生成：{created} 件作成、{failed} 件失敗。',
  'workbench.editors.spec.generateWs.blurb':
    'この仕様からコレクションを生成します。操作は、ドキュメントの ws/wss サーバーを対象とする WebSocket リクエスト、または mqtt サーバーを対象とする MQTT リクエストになり、チャネルのスキーマから例のメッセージが事前入力されます。コレクションはこの仕様にリンクされたままになります。',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の WebSocket リクエスト' }),
  'workbench.editors.spec.generateWs.mqttRequestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の MQTT リクエスト' }),
  'workbench.editors.spec.generateWs.empty': 'ドキュメントには生成元となる操作が宣言されていません。',
  'workbench.editors.spec.generateWs.noServer':
    'ドキュメントには接続先となる ws、wss、または mqtt サーバーが宣言されていません。',
  'workbench.editors.spec.generateWs.partial': '欠けのある生成：{created} 件作成、{failed} 件失敗。',
  'workbench.editors.spec.generateWs.skipped': '{operation} をスキップしました：{reason}。',
  'workbench.editors.spec.generateGraphql.blurb':
    'このスキーマからコレクションを生成します。Query と Mutation のルートフィールドは、ドキュメントと例の変数が事前入力された GraphQL リクエストになり、両方がある場合はルート型ごとのフォルダーにまとめられます。subscription のフィールドは除外されます。コレクションはこの仕様にリンクされたままになります。',
  'workbench.editors.spec.generateGraphql.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の GraphQL リクエスト' }),
  'workbench.editors.spec.generateGraphql.empty':
    'スキーマには生成元となる Query または Mutation のフィールドが宣言されていません。',
  'workbench.editors.spec.generateGraphql.partial': '欠けのある生成：{created} 件作成、{failed} 件失敗。',
  'workbench.editors.spec.generateGraphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.spec.generateGraphql.urlHint':
    '生成されるすべてのリクエストはこのエンドポイントを対象にします。後で URL を埋めるには空のままにしてください。',
  'workbench.editors.spec.generateGraphql.subscriptionsSkipped': ({ count, fields }, locale) =>
    `${plural(locale, Number(count), {
      other: '{count} 件の subscription フィールドを除外しました',
    })}（${fields}）。subscription には対応していません。`,
  'workbench.editors.spec.generateGraphql.problem': 'スキーマの問題：{message}',
  'workbench.editors.spec.update.button': '更新',
  'workbench.editors.spec.update.protoUnavailable':
    'Protobuf 仕様からの更新はまだ利用できません。変更を取り込むには新しいコレクションを生成してください。',
  'workbench.editors.spec.update.graphqlUnavailable':
    'GraphQL スキーマからの更新はまだ利用できません。変更を取り込むには新しいコレクションを生成してください。',
  'workbench.editors.spec.update.inSyncBadge': '保存済みドキュメントと同期しています',
  'workbench.editors.spec.update.driftedBadge': '前回の更新以降に仕様が変更されました',
  'workbench.editors.spec.update.modalTitle': 'コレクションを更新',
  'workbench.editors.spec.update.blurb':
    '保存済みドキュメントと「{name}」の差分を確認し、選択した更新を適用します。チェックを外した行はそのままです。',
  'workbench.editors.spec.update.dirtyHint':
    'エディターの未保存の変更は含まれません。更新は最後に保存したドキュメントを使います。',
  'workbench.editors.spec.update.parseFailed': 'この仕様は解析できません',
  'workbench.editors.spec.update.inSync':
    'リクエスト単位の差分はありません。適用するとコレクションが保存済みドキュメントと同期済みとして記録されます。',
  'workbench.editors.spec.update.groupAdded': '追加（{count}）',
  'workbench.editors.spec.update.groupChanged': '変更（{count}）',
  'workbench.editors.spec.update.groupRemoved': '仕様から削除（{count}）',
  'workbench.editors.spec.update.removeHint': 'チェックを外したリクエストはコレクションに残ります。',
  'workbench.editors.spec.update.groupCollection': 'コレクション',
  'workbench.editors.spec.update.variablesRow': 'コレクション変数',
  'workbench.editors.spec.update.authRow': 'コレクションの認証',
  'workbench.editors.spec.update.field.name': '名前',
  'workbench.editors.spec.update.field.description': '説明',
  'workbench.editors.spec.update.field.headers': 'ヘッダー',
  'workbench.editors.spec.update.field.params': 'パラメーター',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'ボディ',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の更新を適用' }),
  'workbench.editors.spec.update.markInSync': '同期済みにする',
  'workbench.editors.spec.update.hashNote':
    '適用するとこのドキュメントのバージョンがコレクションのリンクに記録されるため、チェックを外した行があってもリンクは同期済みと読まれます。',
  'workbench.editors.spec.update.success': '「{name}」を更新しました：{count} 件適用',
  'workbench.editors.spec.update.partial':
    '{applied} 件適用、{failed} 件失敗。コレクションは部分的に更新されている可能性があります。',
  'workbench.editors.spec.update.failed': 'コレクションを更新できませんでした。',
} as const satisfies Catalog;
