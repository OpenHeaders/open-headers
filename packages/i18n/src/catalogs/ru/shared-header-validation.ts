/**
 * Header-validation family — Russian. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key (core keeps
 * minting the English fallback; see the en header). The quoted header
 * name rides in as `{name}` inside «…»; `Chrome's allowlist` reads
 * список Chrome with the brand as a raw apposition. Mints: Добавить в
 * конец = Append; Переопределить = Override; Объединить = Merge;
 * список разрешённых = allowlist; перенос строки внутри значения =
 * line folding; управляющие символы = control characters; шаблон =
 * template.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'Имя заголовка не может быть пустым',
  'shared.headerValidation.nameWhitespaceOnly': 'Имя заголовка не может состоять только из пробелов',
  'shared.headerValidation.nameTooLong': 'Имя заголовка слишком длинное (не более {max} символов)',
  'shared.headerValidation.nameProtected': '«{name}» — защищённый заголовок, расширения не могут его изменять',
  'shared.headerValidation.nameInvalidCharacters':
    "Имя заголовка содержит недопустимые символы. Разрешены только буквы, цифры и -_.~!#$%&'*+^`|",
  'shared.headerValidation.nameTemplated':
    'Имя заголовка использует шаблоны — разрешённое значение проверяется в момент запроса.',
  'shared.headerValidation.nameReferrerSpelling': 'Примечание: правильное написание — «Referer» (одна r)',
  'shared.headerValidation.valueEmpty': 'Значение заголовка не может быть пустым',
  'shared.headerValidation.valueWhitespaceOnly': 'Значение заголовка не может состоять только из пробелов',
  'shared.headerValidation.valueTooLong': 'Значение заголовка слишком длинное (не более {max} символов)',
  'shared.headerValidation.valueNullBytes': 'Значение заголовка не может содержать нулевые байты',
  'shared.headerValidation.valueLineFolding':
    'Значение заголовка не может содержать перенос строки внутри значения (CRLF с последующим пробелом или табуляцией)',
  'shared.headerValidation.valueLineBreaks': 'Значение заголовка не может содержать переводы строки',
  'shared.headerValidation.valueControlCharacters': 'Значение заголовка содержит недопустимые управляющие символы',
  'shared.headerValidation.valueContentTypeFormat': 'Заголовок Content-Type имеет недопустимый формат',
  'shared.headerValidation.valueNonAscii':
    'Значение заголовка содержит символы вне ASCII, которые могут вызвать проблемы совместимости',
  'shared.headerValidation.appendNotAllowlisted.request':
    'Операция «Добавить в конец» поддерживается только для стандартных многозначных заголовков запроса. «{name}» ' +
    'нет в списке Chrome для добавления — используйте «Переопределить» или переключитесь на «Объединить» для ' +
    'добавления скриптом.',
  'shared.headerValidation.appendNotAllowlisted.response':
    'Операция «Добавить в конец» поддерживается только для стандартных многозначных заголовков ответа. «{name}» ' +
    'нет в списке Chrome для добавления — используйте «Переопределить» или переключитесь на «Объединить» для ' +
    'добавления скриптом.',
} as const satisfies Catalog;
