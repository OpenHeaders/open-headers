/**
 * DevTools panel — inspector stream tabs — Japanese. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, Base64 /
 * Hex / UTF-8 modes, `keepalive` and `socket` stay parity-raw. Mints:
 * ワイヤー = wire (crossed the wire = ワイヤーを通る); フレーム /
 * ペイロード carried; 破棄 = dropped; 注入 = injected; 合成 =
 * synthetic; 配信 = delivered; 推定 = inferred vs 導出 = derived (two
 * referents); キャプチャ面 = capture plane; ラッパー = wrapper;
 * エンドポイント = endpoint; ペイロードビューアー = payload viewer;
 * 発火ドット = fire dot (琥珀色の発火ドット); このフレーム/イベントを
 * 元に = seeded from; Server-Sent Events rides raw (MDN vocabulary);
 * この側 = "this side" of the split. Quoted OH labels copy this file's
 * mints in 「」.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': 'すべてクリア',
  'panel.inspector.streams.directionFilterTitle': '方向で絞り込む',
  'panel.inspector.streams.directionAll': 'すべて',
  'panel.inspector.streams.directionSend': '送信',
  'panel.inspector.streams.directionReceive': '受信',
  'panel.inspector.streams.filterAria': 'ストリームメッセージを絞り込む',
  'panel.inspector.streams.sortByTitle': '{column} で並べ替え',
  'panel.inspector.streams.resizeColumnAria': '{column} 列の幅を変更',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': '表示',
  'panel.inspector.streams.view.layout': 'レイアウト',
  'panel.inspector.streams.view.layoutCompact': 'コンパクト',
  'panel.inspector.streams.view.layoutWide': 'ワイド',
  'panel.inspector.streams.view.split': '分割',
  'panel.inspector.streams.view.splitSideBySide': '左右に並べる',
  'panel.inspector.streams.view.splitStacked': '上下に重ねる',
  'panel.inspector.streams.view.splitDisabledTitle': 'ペインを分割するにはペイロードプレビューを有効にしてください',
  'panel.inspector.streams.view.showPreview': 'ペイロードプレビューを表示',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': 'ルール適用済み。フレームのペイロードがルールのペイロードと一致します',
  'panel.inspector.streams.fire.inferredFrame': 'ルール一致。このフレームでは適用を検証できません',
  'panel.inspector.streams.fire.injectedFrame': 'ルール適用済み。このフレームはルールが注入しました',
  'panel.inspector.streams.fire.replacedFrame': 'ルール適用済み。ルールがこのフレームを置き換えました',
  'panel.inspector.streams.fire.droppedSendFrame': 'ルールがこのフレームを破棄しました。サーバーには送信されていません',
  'panel.inspector.streams.fire.droppedRecvFrame': 'ルールがこのフレームを破棄しました。ページは受信していません',
  'panel.inspector.streams.fire.appliedEvent': 'ルール適用済み。イベントのペイロードがルールのペイロードと一致します',
  'panel.inspector.streams.fire.inferredEvent': 'ルール一致。このイベントでは適用を検証できません',
  'panel.inspector.streams.fire.injectedEvent': 'ルール適用済み。このイベントはルールが注入しました',
  'panel.inspector.streams.fire.replacedEvent': 'ルール適用済み。ルールがこのイベントを置き換えました',
  'panel.inspector.streams.fire.droppedEvent': 'ルールがこのイベントを破棄しました。ページは受信していません',
  'panel.inspector.streams.row.copied': 'コピーしました',
  'panel.inspector.streams.row.copyPayload': 'ペイロードをコピー',
  'panel.inspector.streams.row.editRule': 'ルールを編集',
  'panel.inspector.streams.row.override': '上書き',
  'panel.inspector.streams.row.droppedSendCell': '破棄。サーバーには送信されていません',
  'panel.inspector.streams.row.droppedRecvCell': '破棄。ページには配信されていません',
  'panel.inspector.streams.row.notCaptured': '未キャプチャ',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'メッセージを絞り込む',
  'panel.inspector.messages.listAria': 'WebSocket メッセージ',
  'panel.inspector.messages.overrideMessage': 'メッセージを上書き',
  'panel.inspector.messages.overrideMessageTitle': 'この接続のメッセージルールを作成',
  'panel.inspector.messages.editRuleTitle': 'このフレームに作用したメッセージルールを編集',
  'panel.inspector.messages.createRuleTitle': 'このフレームを元にメッセージルールを作成',
  'panel.inspector.messages.syntheticDroppedTitle':
    '合成行。ページがこのフレームを生成しましたが、ルールが送信前に破棄しました',
  'panel.inspector.messages.syntheticInjectedTitle':
    '合成フレーム。ページ内でルールが注入したもので、ワイヤーを通っていません',
  'panel.inspector.messages.emptyNoDebug':
    'WebSocket フレームは、このタブでデバッグモードが有効な場合にのみ表示されます。',
  'panel.inspector.messages.emptySynthetic':
    'ワイヤーを通ったフレームはありません。ここでは注入ルールが発火しており、注入されたフレームはページ内で合成的に配信されるため、ネットワークキャプチャからは見えません。',
  'panel.inspector.messages.emptyNone': 'WebSocket フレームはまだ交換されていません。',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '古いフレーム {count} 件を破棄しました。' });
    return `最新の ${String(shown)} フレームを表示中。${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'イベントを絞り込む',
  'panel.inspector.sse.listAria': 'Server-Sent Events',
  'panel.inspector.sse.overrideEvent': 'イベントを上書き',
  'panel.inspector.sse.overrideEventTitle': 'このストリームのメッセージルールを作成',
  'panel.inspector.sse.editRuleTitle': 'このイベントに作用したメッセージルールを編集',
  'panel.inspector.sse.createRuleTitle': 'このイベントを元にメッセージルールを作成',
  'panel.inspector.sse.syntheticTitle': '合成イベント。ページ内でルールが注入したもので、ワイヤーを通っていません',
  'panel.inspector.sse.emptySynthetic':
    'ワイヤーを通ったイベントはありません。ここでは注入ルールが発火しており、注入されたイベントはページ内で合成的に配信されるため、ネットワークキャプチャからは見えません。',
  'panel.inspector.sse.emptyUnparseable': 'レスポンスボディに解析できる SSE イベントはありません。',
  'panel.inspector.sse.emptyNoDebug':
    'イベントはキャプチャされていません。デバッグモードなしでは、サーバー送信ストリームはリクエストの完了後にしか実体化されません。長時間実行されるストリームは、接続が閉じるまでここに表示されないことがあります。',
  'panel.inspector.sse.emptyNone': 'イベントはまだ受信していません。',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '古いイベント {count} 件を破棄しました。' });
    return `最新の ${String(shown)} イベントを表示中。${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'メッセージが選択されていません',
  'panel.inspector.streams.preview.noMessageHint': 'メッセージを選択すると内容を閲覧できます。',
  'panel.inspector.streams.preview.noEventTitle': 'イベントが選択されていません',
  'panel.inspector.streams.preview.noEventHint': 'イベントを選択すると内容を閲覧できます。',
  'panel.inspector.streams.preview.raw': 'Raw',
  'panel.inspector.streams.preview.copy': 'コピー',
  'panel.inspector.streams.preview.copied': 'コピーしました',
  'panel.inspector.streams.preview.copyTitle': 'クリップボードにコピー',
  'panel.inspector.streams.preview.decodeFailed': 'バイナリペイロードをデコードできませんでした。',
  'panel.inspector.messages.preview.droppedSendPane':
    'ルールがこのフレームを破棄しました。ページが生成しましたが、サーバーには送信されていません。',
  'panel.inspector.messages.preview.droppedRecvPane':
    'ルールがこのフレームを破棄しました。ブラウザーには届きましたが、ページには配信されていません。',
  'panel.inspector.messages.preview.originalNotCaptured':
    'ページが生成したフレームはキャプチャされていません。ワイヤーを通ったのは変更後のフレームだけです。',
  'panel.inspector.messages.preview.syntheticNote':
    '合成フレーム。ページ内でルールが注入したもので、ワイヤーを通っていません。',
  'panel.inspector.sse.preview.droppedPane':
    'ルールがこのイベントを破棄しました。ブラウザーには届きましたが、ページには配信されていません。',
  'panel.inspector.sse.preview.syntheticNote':
    '合成イベント。ページ内でルールが注入したもので、ワイヤーを通っていません。',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': '導出値。キャプチャではありません',
  'panel.inspector.messages.inferredModified.summary':
    'この側はルールの置換ペイロードを示します。キャプチャ面が見たのはワイヤー上のフレームだけです。',
  'panel.inspector.messages.inferredModified.description':
    'ワイヤーが記録したのは元のフレームで、変更はキャプチャ後にページ内で起きました。まさにこのフレームが置換されたことは、琥珀色の発火ドットに対応するルールのフレームセレクターから推定しています。',
  'panel.inspector.messages.inferredDropped.title': '破棄（推定）',
  'panel.inspector.messages.inferredDropped.summary':
    'ワイヤーはこのフレームを記録しましたが、ルールがページ内で配信を止めました。',
  'panel.inspector.messages.inferredDropped.description':
    '破棄はキャプチャ後に起きるため、未配信そのものを記録できるものはありません。まさにこのフレームが破棄されたことは、琥珀色の発火ドットに対応するルールのフレームセレクターから推定しています。',
  'panel.inspector.sse.inferredModified.title': '導出値。キャプチャではありません',
  'panel.inspector.sse.inferredModified.summary':
    'この側はルールの置換ペイロードを示します。キャプチャ面が見たのはワイヤー上のイベントだけです。',
  'panel.inspector.sse.inferredModified.description':
    'ワイヤーが記録したのは元のイベントで、変更はキャプチャ後にページ内で起きました。まさにこのイベントが置換されたことは、琥珀色の発火ドットに対応するルールのイベントセレクターから推定しています。',
  'panel.inspector.sse.inferredDropped.title': '破棄（推定）',
  'panel.inspector.sse.inferredDropped.summary':
    'ワイヤーはこのイベントを記録しましたが、ルールがページ内で配信を止めました。',
  'panel.inspector.sse.inferredDropped.description':
    '破棄はキャプチャ後に起きるため、未配信そのものを記録できるものはありません。まさにこのイベントが破棄されたことは、琥珀色の発火ドットに対応するルールのイベントセレクターから推定しています。',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'フレームの例',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': '文字 ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'フレームのペイロード。テキストフレームは内容をそのまま表示します。',
  'panel.inspector.messages.columnInfo.data.description':
    '行を選択するとペイロードビューアーが開きます。テキストが解析できれば JSON ツリー、バイナリフレームなら Base64 / Hex / UTF-8 ビューアーです。',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'ペイロードの代わりに',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'バイナリフレーム。バイトはセルではなくペイロードビューアーにあります。',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': 'エンドポイント間で交換される keepalive 制御フレーム。',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'socket を終了するクロージングハンドシェイク。',
  'panel.inspector.messages.columnInfo.length.summary':
    'ペイロードのサイズ。テキストフレームは素の文字数、バイナリフレームは整形したバイト数（例：`4 B`）です。',
  'panel.inspector.messages.columnInfo.time.summary': 'フレームがワイヤーを通った実時刻。',
  'panel.inspector.messages.columnInfo.time.description':
    '唯一の並べ替え可能な列。昇順がワイヤー順で、同じミリ秒のフレームはどちらの順でも到着順を保ちます。',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'フレームが進んだ方向。',
  'panel.inspector.messages.directionInfo.arrowsHeading': '矢印',
  'panel.inspector.messages.directionInfo.sentDesc': '送信。ページがこのフレームをサーバーへ送りました。',
  'panel.inspector.messages.directionInfo.receivedDesc': '受信。サーバーがこのフレームをページへ送りました。',
  'panel.inspector.messages.directionInfo.errorDesc':
    'エラー。トランスポートの障害でストリームが終了しました。行は赤く表示されます。',
  'panel.inspector.streams.fireRail.title': 'ルール発火',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'ドットの色',
  'panel.inspector.messages.fireRail.summary':
    'ドットは、WebSocket メッセージルールが作用した各フレームを示します。フレームはルールの帰属を持たないため、ドットは導出されたものです。このリクエストで発火したメッセージルールを取り、各ルールのフレームセレクターをそのフレームに対して再実行しています。',
  'panel.inspector.messages.fireRail.appliedDesc':
    '適用済み。フレームのペイロードが、ルールの置換または注入ペイロードと等しい。',
  'panel.inspector.messages.fireRail.inferredDesc':
    '推定。ルールの方向とメッセージフィルターがこのフレームを選びますが、適用は検証できません（変更後のフレームは、フィルターが一致したペイロードをもう持っていません）。',
  'panel.inspector.messages.fireRail.description':
    '破棄された送信フレームはワイヤーを通らないため、行がまったくありません。破棄された受信フレームは先にワイヤー上でキャプチャされています。その行は残り、「破棄。ページには配信されていません」と表示されます。',
  'panel.inspector.sse.columnInfo.exampleCaption': 'イベントの例',
  'panel.inspector.sse.columnInfo.id.summary': 'イベントの `id:` フィールド。サーバーが渡す再接続カーソルです。',
  'panel.inspector.sse.columnInfo.id.description':
    'サーバーが id を送らなければ空です。再接続時にブラウザーは最後の id を `Last-Event-ID` として返すため、サーバーは中断した場所からストリームを再開できます。',
  'panel.inspector.sse.columnInfo.type.summary':
    'イベントの `event:` フィールド。デフォルトのイベントでは `message` です。',
  'panel.inspector.sse.columnInfo.type.description':
    'ページのコードは種類ごとに購読します。`onmessage` はデフォルトのイベントしか見ません。名前付きイベントには、その種類に対する `addEventListener` が必要です。',
  'panel.inspector.sse.columnInfo.data.summary':
    'イベントのペイロード。常にテキストで、複数行の `data:` フィールドは結合されて届きます。',
  'panel.inspector.sse.columnInfo.data.description':
    '行を選択するとペイロードビューアーが開きます。テキストが解析できれば JSON ツリー、そうでなければそのまま表示します。',
  'panel.inspector.sse.columnInfo.time.summary': 'イベントが届いた実時刻。',
  'panel.inspector.sse.columnInfo.time.description':
    '並べ替え可能で、デフォルトは昇順です。完了したレスポンスボディから解析したイベントには時刻がありません（SSE のワイヤー形式には時刻がありません）。そのためセルは空のままです。',
  'panel.inspector.sse.fireRail.summary':
    'ドットは、SSE メッセージルールが作用した各イベントを示します。ラッパーが記録したキャプチャがあれば確証です。なければドットは導出されたものです。このリクエストで発火した SSE ルールを取り、各ルールのイベントセレクターをそのイベントに対して再実行しています。',
  'panel.inspector.sse.fireRail.appliedDesc':
    '適用済み。ラッパーがまさにこのイベントへの作用を記録したか、注入ペイロードが一致します。',
  'panel.inspector.sse.fireRail.inferredDesc':
    '推定。ルールのイベント名とデータフィルターがこのイベントを選びますが、ワイヤーだけでは適用を検証できません。',
  'panel.inspector.sse.fireRail.description':
    'Server-Sent Events はサーバー → ページの方向にしか流れず、ワイヤーはルールが作用する前に記録します。破棄されたイベントは行が残り、「破棄。ページには配信されていません」と表示されます。注入されたイベントはワイヤーを通らず、合成行として表示されます。',
} as const satisfies Catalog;
