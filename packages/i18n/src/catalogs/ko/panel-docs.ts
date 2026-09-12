/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Korean. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw inside
 * keyed captions; `token` (the filter-grammar noun) rides raw per the
 * token-lowercase law with a head noun 조건 where a particle would
 * follow. Sandwich fragments restructure SOV: the Korean predicate
 * moves into the suffix and a whole-raw prefix (`A`) copies verbatim.
 * Mints: 항목 = filter term; 일치 토글 = match toggle; 속성 필터 =
 * property filter; 부정 = negation; 예시 캡처 = example capture; 단어
 * 단위 = whole word; 대소문자 구분 = match case.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': '필터 구문',
  'panel.docs.nav.filterSyntax.summary':
    '텍스트 token, 속성 필터, 일치 토글. 각 카드는 공통 예시 캡처 하나를 필터링합니다.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': '트래픽 필터는 자유 텍스트,',
  'panel.docs.filterSyntax.intro1Suffix':
    '같은 속성 필터, 그리고 세 가지 일치 토글을 결합합니다. 공백으로 구분한 항목은 모두 일치해야 합니다 (AND). 아래의 각 카드는 같은 다섯 개 요청으로 이루어진 예시 캡처에 자기 필터를 적용합니다. 각 그림은 그 전체 그림의 한 조각입니다.',
  'panel.docs.filterSyntax.intro2Prefix':
    '패널의 모든 필터 입력(Network, Console, Storage, Headers, Cookies, Initiator, Messages)에는 같은 세 가지 토글',
  'panel.docs.filterSyntax.intro2MatchCase': '대소문자 구분',
  'panel.docs.filterSyntax.intro2WholeWord': '단어 단위',
  'panel.docs.filterSyntax.intro2Regex': '정규식',
  'panel.docs.filterSyntax.intro2Middle': '그리고 텍스트를 지우는',
  'panel.docs.filterSyntax.intro2Suffix': '버튼이 있습니다.',
  'panel.docs.filterSyntax.intro2Kbd': '키보드:',
  'panel.docs.filterSyntax.intro2KbdSuffix': '단축키는 입력에 포커스가 있는 동안 토글을 전환합니다.',

  'panel.docs.filterSyntax.headingText': '텍스트 필터',
  'panel.docs.filterExample.captureHeading': '예시 캡처',
  'panel.docs.filterSyntax.headingProperty': '속성 필터',
  'panel.docs.filterSyntax.headingToggles': '일치 토글',
  'panel.docs.filterSyntax.headingElsewhere': '다른 모든 곳',

  'panel.docs.filterSyntax.textTitle': '텍스트',
  'panel.docs.filterSyntax.text1':
    '단순 항목은 URL 주소에 그 항목이 포함된 모든 요청을 남깁니다. 여러 항목은 AND 조건으로 결합되어, 요청이 위치에 상관없이 모든 항목을 포함해야 합니다.',
  'panel.docs.filterSyntax.textCaption': '두 항목. URL 주소에 “api”와 “users”를 모두 포함하는 요청만 남습니다.',

  'panel.docs.filterSyntax.negationTitle': '부정',
  'panel.docs.filterSyntax.negation1Prefix': '앞에 붙은',
  'panel.docs.filterSyntax.negation1Middle': '기호는 모든 token 조건을 뒤집습니다:',
  'panel.docs.filterSyntax.negation1Middle2': '조건은 일치하는 요청을 남기는 대신 숨깁니다. 속성 필터에도 적용됩니다:',
  'panel.docs.filterSyntax.negationCaption': '부정한 항목과 일치하는 요청을 제외한 모든 요청이 남습니다.',

  'panel.docs.filterSyntax.phraseTitle': '정확한 구문',
  'panel.docs.filterSyntax.phrase1Prefix': '따옴표는 공백이 포함된 텍스트를 token 하나로 묶고,',
  'panel.docs.filterSyntax.phrase1Or': '또는',
  'panel.docs.filterSyntax.phrase1Suffix': '같은 문자를 그대로 유지합니다. 쿼리 문자열에 유용합니다.',
  'panel.docs.filterSyntax.phraseCaption': '따옴표로 묶은 구문은 URL 주소의 연속된 한 부분으로 일치합니다.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '같은 token 조건은 URL 전체가 아니라 요청의 속성 하나를 검사합니다. 속성 필터는 텍스트 token 및 서로 간에 결합되며, 모두 일치해야 합니다.',

  'panel.docs.filterSyntax.domainTitle': '도메인',
  'panel.docs.filterSyntax.domain1Prefix':
    '호스트 이름을 부분 문자열로 비교하므로 최상위 도메인 하나로 모든 하위 도메인이 잡힙니다.',
  'panel.docs.filterSyntax.domain1Suffix': '처럼 와일드카드는 필요 없습니다.',
  'panel.docs.filterSyntax.domainCaption':
    '값 하나로 모든 openheaders.com 하위 도메인을 포괄합니다. 서드파티 호스트는 빠집니다.',

  'panel.docs.filterSyntax.statusCodeTitle': '상태 코드',
  'panel.docs.filterSyntax.statusCode1':
    '응답이 정확히 이 코드를 반환한 요청을 남깁니다. 대기 중이거나 실패한 요청에는 코드가 없으므로 절대 일치하지 않습니다.',
  'panel.docs.filterSyntax.statusCodeCaption': '404 응답만 남습니다. 범위가 아니라 정확한 코드입니다.',

  'panel.docs.filterSyntax.methodTitle': '메서드',
  'panel.docs.filterSyntax.method1Prefix':
    '이 HTTP 동사를 사용하는 요청을 남깁니다. 대소문자를 구분하지 않고 비교하므로',
  'panel.docs.filterSyntax.method1And': '및',
  'panel.docs.filterSyntax.method1Suffix': '두 token 조건은 같은 필터입니다.',
  'panel.docs.filterSyntax.methodCaption': 'POST 요청만 남습니다.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME 유형',
  'panel.docs.filterSyntax.mime1Prefix': '응답의 콘텐츠 유형을 부분 문자열로 비교합니다.',
  'panel.docs.filterSyntax.mime1Catches': '조건은',
  'panel.docs.filterSyntax.mime1Suffix': '조건은 모든 이미지 형식과 일치합니다.',
  'panel.docs.filterSyntax.mimeCaption': '두 JSON 응답이 남습니다. 스크립트, 글꼴, 이미지는 빠집니다.',

  'panel.docs.filterSyntax.responseHeaderTitle': '응답 헤더',
  'panel.docs.filterSyntax.respHeader1Prefix':
    '응답에 정확히 이 이름의 헤더가 있는 요청을 남깁니다. 값은 상관없습니다. CDN 캐시 동작을 찾을 때',
  'panel.docs.filterSyntax.respHeader1Suffix': '조건이, 누락된 보안 헤더를 찾을 때는 부정 조건이 유용합니다.',
  'panel.docs.filterSyntax.respHeaderCaption': 'CDN 응답만 x-cache 헤더를 가지고 있습니다.',

  'panel.docs.filterSyntax.largerThanTitle': '크기 초과',
  'panel.docs.filterSyntax.largerThan1': 'N 바이트보다 많이 전송한 요청을 남깁니다. 접미사로 숫자 단위를 조정합니다:',
  'panel.docs.filterSyntax.largerThanCaption': '128 kB 번들만 100k 임계값을 넘습니다.',

  'panel.docs.filterSyntax.fromCacheTitle': '캐시 출처',
  'panel.docs.filterSyntax.fromCache1Prefix': '브라우저가 캐시에서 제공한 응답을 남깁니다.',
  'panel.docs.filterSyntax.fromCache1Middle':
    '응답이거나 네트워크를 전혀 거치지 않은 디스크/메모리 캐시 적중이 해당합니다.',
  'panel.docs.filterSyntax.fromCache1Suffix': '처럼 부정하면 실제로 네트워크를 거친 것만 보입니다.',
  'panel.docs.filterSyntax.fromCacheCaption': '캐시된 추적 픽셀만 남습니다.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    '입력 안의 세 버튼은 텍스트 token 비교 방식을 바꿉니다. 자유 텍스트(및 상세 탭의',
  'panel.docs.filterSyntax.togglesIntroMiddle': '형식의 token 조건)에 적용됩니다.',
  'panel.docs.filterSyntax.togglesIntroSuffix': '조건과 다른 속성 필터는 각자의 의미를 유지합니다.',

  'panel.docs.filterSyntax.matchCaseTitle': '대소문자 구분',
  'panel.docs.filterSyntax.matchCase1Prefix': '끄면(기본값)',
  'panel.docs.filterSyntax.matchCase1And': '및',
  'panel.docs.filterSyntax.matchCase1Suffix':
    '두 token 조건은 같은 필터입니다. 켜면 항목이 URL 주소의 대소문자와 정확히 일치해야 합니다.',
  'panel.docs.filterSyntax.matchCaseCaption':
    'Aa 토글을 켜면 “Users”는 아무것과도 일치하지 않습니다. 캡처의 모든 URL 주소가 소문자이기 때문입니다.',

  'panel.docs.filterSyntax.wholeWordTitle': '단어 단위',
  'panel.docs.filterSyntax.wholeWord1Prefix': '항목이 단어 경계에서만 일치합니다.',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    '같은 문자가 경계로 간주됩니다. 짧은 항목이 긴 단어 안에 묻혀 있을 때 사용하세요.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '“user”는 더 이상 “users” 안에서 일치하지 않습니다. ab 토글이 꺼져 있으면 요청 #7 행이 일치했을 것입니다.',

  'panel.docs.filterSyntax.regexTitle': '정규식',
  'panel.docs.filterSyntax.regex1':
    '입력 전체가 하나의 정규식이 되어 URL 주소와 대조됩니다. 이 모드에서는 속성 token 조건이 해석되지 않습니다. 컴파일되지 않는 패턴은 입력을 빨갛게 표시하고 아무것도 숨기지 않습니다.',
  'panel.docs.filterSyntax.regexCaption': '패턴 하나로 두 파일 유형: .js 또는 .woff2 확장자로 끝나는 URL 주소.',

  'panel.docs.filterSyntax.otherInputsTitle': '다른 필터 입력',
  'panel.docs.filterSyntax.otherIntroPrefix': '상세 탭에는 같은 입력이 각자의 속성 키와 함께 있습니다. 토글과',
  'panel.docs.filterSyntax.otherIntroSuffix': '부정은 어디서나 동일하게 작동합니다:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    '세 가지 토글이 있는 일반 텍스트. Storage 탭은 입력하는 동안 탐색 레일에서 섹션별 일치 수도 셉니다.',
  'panel.docs.filterSyntax.otherSearchPrefix': '일반 텍스트(또는',
  'panel.docs.filterSyntax.otherSearchMiddle': '토글에서는 정규식)에 세 가지 토글이 있으며 Enter 키로 제출합니다.',
  'panel.docs.filterSyntax.otherSearchSuffix':
    '칩으로 검사할 데이터를 고르며(최소 하나는 선택된 채로 유지), 각 결과는 출처(요청 탭, 저장소 섹션 또는 Console)를 엽니다.',
} as const satisfies Catalog;
