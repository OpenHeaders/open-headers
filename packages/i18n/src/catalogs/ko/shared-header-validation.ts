/**
 * Header-validation family — Korean. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key (core keeps
 * minting the English fallback; see the en header). The quoted header
 * name rides in as `{name}` with a head noun 헤더 so no particle
 * touches the hole; `Chrome's allowlist` reads Chrome 브라우저의.
 * Mints: 덧붙이기 = Append; 재정의 = Override; 병합 = Merge; 허용 목록 =
 * allowlist; 줄 접기 = line folding; 제어 문자 = control characters.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': '헤더 이름은 비워 둘 수 없습니다',
  'shared.headerValidation.nameWhitespaceOnly': '헤더 이름은 공백만으로 이루어질 수 없습니다',
  'shared.headerValidation.nameTooLong': '헤더 이름이 너무 깁니다 (최대 {max}자)',
  'shared.headerValidation.nameProtected': '“{name}” 헤더는 확장 프로그램이 수정할 수 없는 보호된 헤더입니다',
  'shared.headerValidation.nameInvalidCharacters':
    "헤더 이름에 잘못된 문자가 있습니다. 문자, 숫자, -_.~!#$%&'*+^`| 문자만 사용할 수 있습니다",
  'shared.headerValidation.nameTemplated': '헤더 이름에 템플릿이 사용되었습니다. 해결된 값은 요청 시점에 검증됩니다.',
  'shared.headerValidation.nameReferrerSpelling': '참고: 올바른 철자는 “Referer”입니다 (r 하나)',
  'shared.headerValidation.valueEmpty': '헤더 값은 비워 둘 수 없습니다',
  'shared.headerValidation.valueWhitespaceOnly': '헤더 값은 공백만으로 이루어질 수 없습니다',
  'shared.headerValidation.valueTooLong': '헤더 값이 너무 깁니다 (최대 {max}자)',
  'shared.headerValidation.valueNullBytes': '헤더 값에는 null 바이트를 넣을 수 없습니다',
  'shared.headerValidation.valueLineFolding': '헤더 값에는 줄 접기(CRLF 뒤에 공백/탭)를 넣을 수 없습니다',
  'shared.headerValidation.valueLineBreaks': '헤더 값에는 줄 바꿈을 넣을 수 없습니다',
  'shared.headerValidation.valueControlCharacters': '헤더 값에 잘못된 제어 문자가 있습니다',
  'shared.headerValidation.valueContentTypeFormat': 'Content-Type 헤더의 형식이 잘못되었습니다',
  'shared.headerValidation.valueNonAscii': '헤더 값에 호환성 문제를 일으킬 수 있는 비 ASCII 문자가 있습니다',
  'shared.headerValidation.appendNotAllowlisted.request':
    '덧붙이기는 표준 다중 값 요청 헤더에서만 지원됩니다. “{name}” 헤더는 Chrome 브라우저의 덧붙이기 허용 목록에 없습니다. 대신 재정의를 사용하거나, 스크립트 기반 덧붙이기를 위해 병합으로 전환하세요.',
  'shared.headerValidation.appendNotAllowlisted.response':
    '덧붙이기는 표준 다중 값 응답 헤더에서만 지원됩니다. “{name}” 헤더는 Chrome 브라우저의 덧붙이기 허용 목록에 없습니다. 대신 재정의를 사용하거나, 스크립트 기반 덧붙이기를 위해 병합으로 전환하세요.',
} as const satisfies Catalog;
