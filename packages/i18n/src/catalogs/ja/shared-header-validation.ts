/**
 * Header-validation family — Japanese. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; see that file
 * for the core mirror contract. The quoted header name rides in as
 * `{name}` inside 「」; the allowed-character run and Chrome stay raw.
 * Mints: 上書き = Override; マージ = Merge; 追記 = Append.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'ヘッダー名を空にすることはできません',
  'shared.headerValidation.nameWhitespaceOnly': 'ヘッダー名を空白のみにすることはできません',
  'shared.headerValidation.nameTooLong': 'ヘッダー名が長すぎます（最大 {max} 文字）',
  'shared.headerValidation.nameProtected': '「{name}」は保護されたヘッダーで、拡張機能からは変更できません',
  'shared.headerValidation.nameInvalidCharacters':
    "ヘッダー名に無効な文字が含まれています。使用できるのは英字、数字、および -_.~!#$%&'*+^`| のみです",
  'shared.headerValidation.nameTemplated':
    'ヘッダー名にテンプレートが使われています。解決後の値はリクエスト時に検証されます。',
  'shared.headerValidation.nameReferrerSpelling': '注：正しいつづりは「Referer」（r は 1 つ）です',
  'shared.headerValidation.valueEmpty': 'ヘッダー値を空にすることはできません',
  'shared.headerValidation.valueWhitespaceOnly': 'ヘッダー値を空白のみにすることはできません',
  'shared.headerValidation.valueTooLong': 'ヘッダー値が長すぎます（最大 {max} 文字）',
  'shared.headerValidation.valueNullBytes': 'ヘッダー値に null バイトを含めることはできません',
  'shared.headerValidation.valueLineFolding':
    'ヘッダー値に行の折り返し（CRLF の後にスペースまたはタブ）を含めることはできません',
  'shared.headerValidation.valueLineBreaks': 'ヘッダー値に改行を含めることはできません',
  'shared.headerValidation.valueControlCharacters': 'ヘッダー値に無効な制御文字が含まれています',
  'shared.headerValidation.valueContentTypeFormat': 'Content-Type ヘッダーの形式が無効です',
  'shared.headerValidation.valueNonAscii':
    'ヘッダー値に非 ASCII 文字が含まれており、互換性の問題を起こす可能性があります',
  'shared.headerValidation.appendNotAllowlisted.request':
    '追記は標準的な複数値リクエストヘッダーでのみサポートされます。「{name}」は Chrome の追記可能な許可リストに含まれていません。代わりに上書きを使うか、スクリプトベースの追記にはマージに切り替えてください。',
  'shared.headerValidation.appendNotAllowlisted.response':
    '追記は標準的な複数値レスポンスヘッダーでのみサポートされます。「{name}」は Chrome の追記可能な許可リストに含まれていません。代わりに上書きを使うか、スクリプトベースの追記にはマージに切り替えてください。',
} as const satisfies Catalog;
