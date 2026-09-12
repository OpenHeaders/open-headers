/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Japanese. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw inside
 * keyed captions (「api」, 「Users」); tool-window and detail tab names
 * (Network, Console, Storage, Headers, …) stay raw, including the
 * whole-raw `otherPlainGroup` list. Mints: 語 = term; 一致トグル =
 * match toggles (single toggle = トグル); プロパティフィルター =
 * property filter; 否定 = negation; サンプルキャプチャ = example
 * capture (キャプチャ carried); sandwich fragments restructure so the
 * raw chip reads as the Japanese subject or object (「A X のような
 * token」, 「X と Y は同じフィルターです」); Enter rides raw;
 * トラッキングピクセル = tracking pixel.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': 'フィルター構文',
  'panel.docs.nav.filterSyntax.summary':
    'テキスト token、プロパティフィルター、一致トグル。各カードは共通のサンプルキャプチャを 1 つのフィルターで絞り込みます。',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  // Filter grammar, toggle glyphs, chords, the × clear glyph, and the
  // FilterExample device ride raw — S18 diagram boundary. DiagramFrame
  // captions, card prose, titles and headings key.
  'panel.docs.filterSyntax.intro1Prefix': 'トラフィックフィルターは、自由テキスト、',
  'panel.docs.filterSyntax.intro1Suffix':
    'のようなプロパティフィルター、そして 3 つの一致トグルを組み合わせます。スペースで区切った語はすべて一致する必要があります（AND）。下の各カードは、同じ 5 件のリクエストからなるサンプルキャプチャに自分のフィルターをかけます。各図はその全体像の 1 つの断面です。',
  'panel.docs.filterSyntax.intro2Prefix':
    'パネル内のすべてのフィルター入力（Network、Console、Storage、Headers、Cookies、Initiator、Messages）には、同じ 3 つのトグル',
  'panel.docs.filterSyntax.intro2MatchCase': '大文字と小文字を区別',
  'panel.docs.filterSyntax.intro2WholeWord': '単語単位',
  'panel.docs.filterSyntax.intro2Regex': '正規表現',
  'panel.docs.filterSyntax.intro2Middle': 'と、テキストをクリアする',
  'panel.docs.filterSyntax.intro2Suffix': 'ボタンがあります。',
  'panel.docs.filterSyntax.intro2Kbd': 'キーボード：',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'は、入力にフォーカスがある間トグルを切り替えます。',

  'panel.docs.filterSyntax.headingText': 'テキストフィルター',
  'panel.docs.filterExample.captureHeading': 'サンプルキャプチャ',
  'panel.docs.filterSyntax.headingProperty': 'プロパティフィルター',
  'panel.docs.filterSyntax.headingToggles': '一致トグル',
  'panel.docs.filterSyntax.headingElsewhere': 'その他の場所',

  'panel.docs.filterSyntax.textTitle': 'テキスト',
  'panel.docs.filterSyntax.text1':
    '裸の語は、URL にそれを含むすべてのリクエストを残します。複数の語は AND で結合されます。リクエストは位置を問わずすべての語を含む必要があります。',
  'panel.docs.filterSyntax.textCaption': '2 つの語。URL に「api」と「users」の両方を含むリクエストだけが残ります。',

  'panel.docs.filterSyntax.negationTitle': '否定',
  'panel.docs.filterSyntax.negation1Prefix': '先頭の',
  'panel.docs.filterSyntax.negation1Middle': 'はどの token も反転します：',
  'panel.docs.filterSyntax.negation1Middle2':
    'は一致するリクエストを残す代わりに隠します。プロパティフィルターにも効きます：',
  'panel.docs.filterSyntax.negationCaption': '否定した語に一致するリクエストを除いて、すべてが残ります。',

  'panel.docs.filterSyntax.phraseTitle': '完全一致フレーズ',
  'panel.docs.filterSyntax.phrase1Prefix': '引用符は、スペースを含むテキストを 1 つの token にまとめ、',
  'panel.docs.filterSyntax.phrase1Or': 'や',
  'panel.docs.filterSyntax.phrase1Suffix': 'のような文字をそのまま扱います。クエリ文字列に便利です。',
  'panel.docs.filterSyntax.phraseCaption': '引用したフレーズは URL の連続した 1 つの断片として一致します。',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    'のような token は、URL 全体ではなくリクエストの 1 つの属性を調べます。プロパティフィルターはテキスト token とも互いとも組み合わせられ、すべてが一致する必要があります。',

  'panel.docs.filterSyntax.domainTitle': 'ドメイン',
  'panel.docs.filterSyntax.domain1Prefix':
    'ホスト名を部分文字列で照合するため、頂点ドメインですべてのサブドメインが捕まります。',
  'panel.docs.filterSyntax.domain1Suffix': 'のように、ワイルドカードは不要です。',
  'panel.docs.filterSyntax.domainCaption':
    '1 つの値で openheaders.com のすべてのサブドメインをカバーします。サードパーティのホストは外れます。',

  'panel.docs.filterSyntax.statusCodeTitle': 'ステータスコード',
  'panel.docs.filterSyntax.statusCode1':
    'レスポンスがちょうどこのコードを返したリクエストを残します。保留中および失敗したリクエストにはコードがないため、決して一致しません。',
  'panel.docs.filterSyntax.statusCodeCaption': '404 だけが残ります。範囲ではなく、そのコードそのものです。',

  'panel.docs.filterSyntax.methodTitle': 'メソッド',
  'panel.docs.filterSyntax.method1Prefix': 'この HTTP 動詞を使うリクエストを残します。大文字と小文字は区別しません：',
  'panel.docs.filterSyntax.method1And': 'と',
  'panel.docs.filterSyntax.method1Suffix': 'は同じフィルターです。',
  'panel.docs.filterSyntax.methodCaption': 'POST だけが残ります。',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME タイプ',
  'panel.docs.filterSyntax.mime1Prefix': 'レスポンスのコンテンツタイプを部分文字列で照合します。',
  'panel.docs.filterSyntax.mime1Catches': 'は',
  'panel.docs.filterSyntax.mime1Suffix': 'はすべての画像形式に一致します。',
  'panel.docs.filterSyntax.mimeCaption': '2 つの JSON レスポンスが残ります。スクリプト、フォント、画像は外れます。',

  'panel.docs.filterSyntax.responseHeaderTitle': 'レスポンスヘッダー',
  'panel.docs.filterSyntax.respHeader1Prefix':
    'レスポンスにちょうどこの名前のヘッダーを持つリクエストを残します。値は問いません。CDN のキャッシュ動作',
  'panel.docs.filterSyntax.respHeader1Suffix':
    'や、欠けているセキュリティヘッダー（否定して使います）を見つけるのに便利です。',
  'panel.docs.filterSyntax.respHeaderCaption': 'CDN のレスポンスだけが x-cache ヘッダーを持っています。',

  'panel.docs.filterSyntax.largerThanTitle': 'サイズ超過',
  'panel.docs.filterSyntax.largerThan1':
    'N バイトを超えて転送したリクエストを残します。接尾辞で数値の単位が変わります：',
  'panel.docs.filterSyntax.largerThanCaption': '128 kB のバンドルだけが 100k のしきい値を超えます。',

  'panel.docs.filterSyntax.fromCacheTitle': 'キャッシュ由来',
  'panel.docs.filterSyntax.fromCache1Prefix': 'ブラウザーがキャッシュから提供したレスポンスを残します。',
  'panel.docs.filterSyntax.fromCache1Middle':
    '、またはネットワークに一切触れなかったディスク/メモリキャッシュのヒットです。否定',
  'panel.docs.filterSyntax.fromCache1Suffix': 'すると、実際にネットワークを通ったものだけが見えます。',
  'panel.docs.filterSyntax.fromCacheCaption': 'キャッシュ済みのトラッキングピクセルだけが残ります。',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    '入力内の 3 つのボタンは、テキスト token の比較方法を変えます。自由テキスト（および詳細タブの',
  'panel.docs.filterSyntax.togglesIntroMiddle': '形式の token）に適用されます。',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'とその他のプロパティフィルターは、それぞれ独自の意味を保ちます。',

  'panel.docs.filterSyntax.matchCaseTitle': '大文字と小文字を区別',
  'panel.docs.filterSyntax.matchCase1Prefix': 'オフ（デフォルト）では、',
  'panel.docs.filterSyntax.matchCase1And': 'と',
  'panel.docs.filterSyntax.matchCase1Suffix':
    'は同じフィルターです。オンにすると、語は URL の大文字と小文字に正確に一致する必要があります。',
  'panel.docs.filterSyntax.matchCaseCaption':
    'Aa をオンにすると、「Users」は何にも一致しません。キャプチャ内のすべての URL は小文字です。',

  'panel.docs.filterSyntax.wholeWordTitle': '単語単位',
  'panel.docs.filterSyntax.wholeWord1Prefix': '語は単語境界でのみ一致します。',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'などが境界として数えられます。短い語が長い単語の中に埋もれているときに使います。',
  'panel.docs.filterSyntax.wholeWordCaption':
    '「user」は「users」の内部にはもう一致しません。ab がオフなら、リクエスト #7 が一致するはずでした。',

  'panel.docs.filterSyntax.regexTitle': '正規表現',
  'panel.docs.filterSyntax.regex1':
    '入力全体が 1 つの正規表現になり、URL に対して検査されます。このモードではプロパティ token は解析されません。コンパイルできないパターンは入力を赤くし、何も隠しません。',
  'panel.docs.filterSyntax.regexCaption': '1 つのパターンで 2 つのファイル種別：.js または .woff2 で終わる URL。',

  'panel.docs.filterSyntax.otherInputsTitle': 'その他のフィルター入力',
  'panel.docs.filterSyntax.otherIntroPrefix':
    '詳細タブには同じ入力があり、それぞれ独自のプロパティキーを持ちます。トグルと',
  'panel.docs.filterSyntax.otherIntroSuffix': 'による否定はどこでも同じように動作します：',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    '3 つのトグル付きのプレーンテキスト。Storage は入力中、ナビゲーションレール上でセクションごとの一致数も数えます。',
  'panel.docs.filterSyntax.otherSearchPrefix': 'プレーンテキスト（または',
  'panel.docs.filterSyntax.otherSearchMiddle': 'では正規表現）に 3 つのトグルが付き、Enter で送信します。',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'のチップでスキャンするデータを選びます（少なくとも 1 つは選択されたまま）。各結果はその出所（リクエストタブ、ストレージセクション、または Console）を開きます。',
} as const satisfies Catalog;
