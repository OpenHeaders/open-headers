/**
 * Header-validation family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; see that file
 * for the core-mirror rules. Extends the zh-CN register contract
 * (`zh-CN/shared.ts`). MINTS: 标头 = header (HTTP referent, Chrome
 * zh-CN vocabulary); the editor operation names quoted in the
 * append-allowlist sentences mint the zh-CN contract: Append = 追加,
 * Override = 覆盖, Merge = 合并; 模板 = template; 允许列表 =
 * allowlist. The quoted `{name}` rides in as an arg inside “”.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': '标头名称不能为空',
  'shared.headerValidation.nameWhitespaceOnly': '标头名称不能只包含空白字符',
  'shared.headerValidation.nameTooLong': '标头名称过长（最多 {max} 个字符）',
  'shared.headerValidation.nameProtected': '“{name}”是受保护的标头，扩展无法修改',
  'shared.headerValidation.nameInvalidCharacters': "标头名称包含无效字符。只允许字母、数字和 -_.~!#$%&'*+^`|",
  'shared.headerValidation.nameTemplated': '标头名称使用了模板——解析后的值会在请求时验证。',
  'shared.headerValidation.nameReferrerSpelling': '注意：正确的拼写是“Referer”（只有一个 r）',
  'shared.headerValidation.valueEmpty': '标头值不能为空',
  'shared.headerValidation.valueWhitespaceOnly': '标头值不能只包含空白字符',
  'shared.headerValidation.valueTooLong': '标头值过长（最多 {max} 个字符）',
  'shared.headerValidation.valueNullBytes': '标头值不能包含空字节',
  'shared.headerValidation.valueLineFolding': '标头值不能包含行折叠（CRLF 后跟空格/制表符）',
  'shared.headerValidation.valueLineBreaks': '标头值不能包含换行符',
  'shared.headerValidation.valueControlCharacters': '标头值包含无效的控制字符',
  'shared.headerValidation.valueContentTypeFormat': 'Content-Type 标头的格式无效',
  'shared.headerValidation.valueNonAscii': '标头值包含非 ASCII 字符，可能导致兼容性问题',
  'shared.headerValidation.appendNotAllowlisted.request':
    '追加只支持标准的多值请求标头。“{name}”不在 Chrome 的可追加允许列表中——请改用覆盖，或切换到合并以进行基于脚本的追加。',
  'shared.headerValidation.appendNotAllowlisted.response':
    '追加只支持标准的多值响应标头。“{name}”不在 Chrome 的可追加允许列表中——请改用覆盖，或切换到合并以进行基于脚本的追加。',
} as const satisfies Catalog;
