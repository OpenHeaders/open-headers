/**
 * DevTools panel — inspector Headers tab — Korean. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, `A → Z` / `Train-Case`, and wire values stay raw.
 * Mints: 임시 헤더 = provisional headers (Chrome ko vocabulary); 노이즈
 * 헤더 = noise headers; 일반 = the General section; 범위 = status
 * ranges (numeric referent); 도메인별 변수 = per-domain variable; 헤더
 * 부분 = the JWT header segment (distinct from HTTP 헤더); 클레임 = JWT
 * claim; 일치한 규칙 = Matched Rules (carried); 깨진 글자 = mojibake;
 * multipart rides raw (multipart 경계). Expiry rides the 만료 family
 * (shared-info-cookies mint); 차단 = block carried from the shared
 * register. Every raw token takes a head noun before a particle
 * (`Secure` 플래그, `{name}` 헤더, JWT 토큰 값).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail). Raw by design: header names and
  // values, filter grammar tokens inside the placeholder (name: /
  // value: / is: must survive translation verbatim), header category
  // labels (shared registry lock — category names never localize),
  // Set-Cookie / SameSite / JWT / alg / scheme / cache-directive chip
  // vocabulary, the `exp {duration}` and `boundary` chips, the ALPN
  // hover title, General row wire values, and the ▾ / → / ⚠ / · / +
  // glyphs beside keyed values. General row labels are keyed —
  // info-table labels (section-tab shading), not the network-table
  // parity lock, whose scope is hot-path column headers. ─────────────
  'panel.inspector.headers.filterPlaceholder':
    '필터: 텍스트, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': '헤더 필터',
  'panel.inspector.headers.footprintTitle': '{rules}. 클릭하면 “일치한 규칙”이 열립니다',

  // General section + the rule-creation CTAs on its summary. The
  // query-params CTA label reuses `panel.inspector.overrideCta.
  // overrideQueryParams` (same control, same popover); its hover title
  // is this surface's own sentence.
  'panel.inspector.headers.generalSection': '일반',
  'panel.inspector.headers.createApiRequest': 'API 요청 만들기',
  'panel.inspector.headers.createApiRequestTitle':
    '이 요청을 워크벤치의 API 클라이언트에서 미리 채워진 초안으로 엽니다. 저장하기 전까지는 아무것도 저장되지 않습니다',
  'panel.inspector.headers.redirect.label': '리디렉션',
  'panel.inspector.headers.redirect.title': '일치하는 요청을 다른 곳으로 보냅니다. 대상을 미리 채우는 방식을 고르세요',
  'panel.inspector.headers.redirect.url': '리디렉션 URL…',
  'panel.inspector.headers.redirect.urlTitle':
    '일치하는 요청을 다른 URL 주소로 보냅니다. 대상은 도메인별 변수로 미리 채워집니다',
  'panel.inspector.headers.redirect.replaceHost': '호스트 교체…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    '경로와 쿼리는 유지하고 호스트만 바꿉니다. 도메인별 호스트 변수를 미리 채웁니다',
  'panel.inspector.headers.redirect.localhost': 'localhost 주소로 보내기…',
  'panel.inspector.headers.redirect.localhostTitle':
    '경로와 쿼리는 유지하고 http 프로토콜로 로컬 개발 서버에 보냅니다. 도메인별 포트 변수를 미리 채웁니다',
  'panel.inspector.headers.overrideQueryParamsTitle': '이 요청의 쿼리 매개변수를 추가, 교체 또는 제거합니다',
  'panel.inspector.headers.more.label': '더 보기',
  'panel.inspector.headers.more.title': '추가 요청 작업',
  'panel.inspector.headers.more.delay': '요청 지연',
  'panel.inspector.headers.more.delayTitle': '이 요청을 지연시킵니다',
  'panel.inspector.headers.more.block': '요청 차단',
  'panel.inspector.headers.more.blockTitle': '이 요청을 차단 / 취소합니다',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': '요청 URL',
  'panel.inspector.headers.general.requestMethod': '요청 메서드',
  'panel.inspector.headers.general.statusCode': '상태 코드',
  'panel.inspector.headers.general.remoteAddress': '원격 주소',
  'panel.inspector.headers.general.httpVersion': 'HTTP 버전',
  'panel.inspector.headers.general.compression': '압축',
  'panel.inspector.headers.general.transferred': '전송량',
  'panel.inspector.headers.general.referrerPolicy': 'Referrer 정책',
  'panel.inspector.headers.general.decodedSuffix': '(디코딩 후 {size})',

  // General (i) corpus. Range/protocol/encoding item LABELS (1xx…,
  // HTTP/2, gzip…) are wire vocabulary and stay raw in the builder;
  // the Common values heading reuses the shared header-corpus key.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    '브라우저가 요청을 보낸 전체 URL 주소입니다. 스킴, 호스트, 경로, 쿼리 문자열입니다.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    '사용된 HTTP 메서드입니다 (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': '서버가 반환한 숫자 응답 코드입니다.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': '범위',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': '정보입니다 (드묾. `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': '성공입니다.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': '리디렉션입니다 (`Location` 헤더를 보세요).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    '클라이언트 오류입니다. 요청이 잘못되었거나 인증되지 않았습니다.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx': '서버 오류입니다. 서버가 유효한 요청을 처리하지 못했습니다.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary': '요청이 실제로 전송된 IP 주소와 포트입니다.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'DNS 응답이 여러 IP 주소로 확인되거나, CDN 서비스가 anycast 방식으로 라우팅하거나, 로컬 프록시가 연결을 가로채면 URL 호스트와 달라집니다.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': '연결이 협상한 HTTP 프로토콜 버전입니다.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'TLS 핸드셰이크 시점에 ALPN 확장으로 고릅니다. 실제 전송된 값 (예: `h2`, `h3`)은 친숙한 레이블과 다를 때 툴팁에 표시됩니다.',
  'panel.inspector.headers.generalInfo.httpVersion.http11': '텍스트 기반이며 기본적으로 연결당 요청 하나입니다.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': '바이너리이며 단일 TCP 연결 위에서 다중화됩니다.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'UDP 기반 QUIC 위에 구축되었습니다. 핸드셰이크가 빠르고 손실 복구가 좋습니다.',
  'panel.inspector.headers.generalInfo.compression.summary':
    '서버가 응답 본문에 적용한 인코딩입니다. 브라우저는 JavaScript 코드에 노출하기 전에 디코딩합니다.',
  'panel.inspector.headers.generalInfo.compression.gzip': '보편적으로 지원되며 압축률은 보통입니다.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli 방식입니다. gzip 방식보다 압축률이 높고 모든 최신 브라우저가 지원합니다.',
  'panel.inspector.headers.generalInfo.compression.zstd': '더 새로운 고압축 방식입니다. 브라우저 지원이 늘고 있습니다.',
  'panel.inspector.headers.generalInfo.compression.deflate': '레거시 방식으로 요즘은 거의 쓰이지 않습니다.',
  'panel.inspector.headers.generalInfo.transferred.summary': '압축 부담을 포함해 실제로 전송된 바이트 수입니다.',
  'panel.inspector.headers.generalInfo.transferred.description':
    '괄호 안의 디코딩 후 크기는 브라우저가 본문을 압축 해제한 뒤 JavaScript 코드가 보는 크기입니다. 둘의 차이가 크면 압축 효과가 큰 것입니다.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    '이 페이지에서 나가는 탐색과 요청에서 브라우저가 `Referer` 헤더에 URL 주소를 어디까지 보낼지입니다.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    '`Referrer-Policy` 응답 헤더, `<meta name="referrer">` 태그 또는 요청별 `referrerpolicy` 속성으로 설정합니다.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    '임시 헤더를 표시합니다. 캐시에서 제공되어 원래 전송된 헤더가 저장되어 있지 않습니다.',
  'panel.inspector.headers.provisional.bannerPending':
    '임시 헤더를 표시합니다. 실제 전송된 헤더 집합이 아직 확인되지 않았습니다.',
  'panel.inspector.headers.provisional.title': '임시 헤더',
  'panel.inspector.headers.provisional.kicker': '요청',
  'panel.inspector.headers.provisional.summary':
    '브라우저가 조립해 보내려 한 헤더이며, 실제로 전송된 내용의 확정된 캡처가 아닙니다. 실제 전송된 집합은 다를 수 있습니다 (네트워크 스택이 나중에 쿠키, 자격 증명, 연결 헤더를 추가합니다).',
  'panel.inspector.headers.provisional.whyHeading': '요청에 임시 헤더만 표시되는 이유',
  'panel.inspector.headers.provisional.cacheLabel': '캐시에서 제공됨',
  'panel.inspector.headers.provisional.cacheDesc':
    '로컬에서 응답했습니다 (메모리/디스크 캐시 또는 서비스 워커). 이번에는 아무것도 전송되지 않아 원래 전송된 헤더가 저장되지 않았습니다.',
  'panel.inspector.headers.provisional.blockedLabel': '네트워크에 도달하지 못함',
  'panel.inspector.headers.provisional.blockedDesc':
    '헤더 교환이 끝나기 전에 차단되거나 실패했습니다 (잘못된 URL 주소, CORS/CSP 차단, 연결 오류).',
  'panel.inspector.headers.provisional.inFlightLabel': '아직 진행 중',
  'panel.inspector.headers.provisional.inFlightDesc':
    '실제 전송된 집합이 아직 보고되지 않았습니다. 요청이 끝나면 확정됩니다.',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': '응답 헤더',
  'panel.inspector.headers.section.requestHeaders': '요청 헤더',
  'panel.inspector.headers.section.countAria': '표시 중인 헤더 수',
  'panel.inspector.headers.section.addHeader': '헤더 추가',
  'panel.inspector.headers.section.raw': 'Raw',
  'panel.inspector.headers.section.rawTitle': '일반 텍스트로 표시 (Name: Value)',
  'panel.inspector.headers.section.copy': '복사',
  'panel.inspector.headers.section.copyAll': '모두 복사',
  'panel.inspector.headers.section.copyFiltered': '필터 결과 복사',
  'panel.inspector.headers.section.copyCurl': 'cURL 형식으로 복사',
  'panel.inspector.headers.section.copyFetch': 'fetch 형식으로 복사',
  'panel.inspector.headers.section.noneCaptured': '캡처된 것이 없습니다.',
  'panel.inspector.headers.section.noFilterMatch': '필터와 일치하는 헤더가 없습니다.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), { other: '노이즈 헤더 {count}개 숨김. 마우스를 올리면 이름이 보입니다' }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's (`panel.moreFilters.*` /
  // `panel.network.view.*`). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.headers.moreFilters.label': '추가 필터',
  'panel.inspector.headers.moreFilters.ruleOnly': '규칙으로 수정된 것만',
  'panel.inspector.headers.moreFilters.securityOnly': '보안 헤더만',
  'panel.inspector.headers.moreFilters.overridableOnly': '재정의 가능한 것만',
  'panel.inspector.headers.moreFilters.hideNoise': '노이즈 숨기기 (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': '보기',
  'panel.inspector.headers.view.layout': '레이아웃',
  'panel.inspector.headers.view.layoutGrouped': '그룹화',
  'panel.inspector.headers.view.layoutFlat': '평면',
  'panel.inspector.headers.view.sort': '정렬',
  'panel.inspector.headers.view.sortOriginal': '원래 순서',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': '규칙으로 수정된 것 우선',
  'panel.inspector.headers.view.nameCase': '이름 대소문자',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': '원래 그대로 (raw)',
  'panel.inspector.headers.view.showTags': '태그 표시',
  'panel.inspector.headers.view.showSuggestions': '제안 표시',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': '값 펼치기',
  'panel.inspector.headers.row.collapseValue': '값 접기',
  'panel.inspector.headers.row.copyValue': '값 복사',
  'panel.inspector.headers.row.copied': '복사됨',
  'panel.inspector.headers.row.edit': '편집',
  'panel.inspector.headers.row.editTitle': '이 헤더를 설정한 규칙 편집',
  'panel.inspector.headers.row.override': '재정의',
  'panel.inspector.headers.row.overrideTitle': '이 헤더를 재정의하는 규칙 만들기',
  'panel.inspector.headers.row.overrideProtectedTitle':
    '{name} 헤더는 보호된 헤더입니다. 브라우저의 Declarative Net Request 엔진은 확장 프로그램의 재정의를 허용하지 않습니다. 흔한 보호 이름으로 host, content-length, connection, sec-fetch-*, sec-ch-ua-* 등이 있습니다.',
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} 헤더는 Open Headers 시스템 기능인 {feature} 기능이 삽입합니다. 규칙으로 재정의할 수 없습니다.',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} 헤더는 이미 내 규칙 중 하나가 관리합니다. 재정의하는 대신 그 규칙의 팝오버에서 편집하세요.',
  'panel.inspector.headers.row.systemTitle': '{feature} 기능이 삽입함 (Open Headers 시스템 기능)',
  'panel.inspector.headers.row.sinceFire.deleted': '이후 규칙 삭제됨',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    '이 요청 이후 규칙이 삭제되었습니다. 이후 요청에는 적용되지 않습니다',
  'panel.inspector.headers.row.sinceFire.disabled': '이후 규칙 비활성화됨',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    '이 요청 이후 규칙이 비활성화되었습니다. 이후 요청에는 적용되지 않습니다',
  'panel.inspector.headers.row.sinceFire.edited': '이후 규칙 편집됨',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    '이 요청 이후 규칙이 편집되었습니다. 현재 규칙은 이후 요청에만 적용됩니다',
  'panel.inspector.headers.row.sinceFire.value': '이후 변수 변경됨',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    '이 규칙이 참조하는 변수가 지금은 다른 값으로 확인됩니다. 이후 요청에만 적용됩니다',

  // Value chips. Flag/attribute chip TEXTS (HttpOnly, SameSite=Lax,
  // JWT, alg, `exp {duration}`, cache-directive summaries, boundary)
  // are wire vocabulary and stay raw; only the UI-worded chips key.
  'panel.inspector.headers.chips.expires': '{duration} 후 만료',
  'panel.inspector.headers.chips.session': '세션',
  'panel.inspector.headers.chips.missingFlag': '{flag} 없음',
  'panel.inspector.headers.chips.expired': '만료됨',

  // Chip (i) corpora. Titles that are wire vocabulary (HttpOnly,
  // SameSite=X, Cache-Control: …, Strict-Transport-Security, JWT,
  // scheme names) stay raw. Cache/HSTS directive descriptions reuse
  // the shared header corpus where the referent matches; the
  // parameterized ones (durations in the hole) live here.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Set-Cookie 플래그',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Cookie 값이 JavaScript 코드에서 숨겨집니다 (`document.cookie` 속성으로 읽을 수 없음).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'XSS 공격을 완화합니다. 삽입된 스크립트가 쿠키를 빼돌릴 수 없게 됩니다. CSRF 공격에는 도움이 되지 않습니다.',
  'panel.inspector.headers.chipInfo.secure.summary':
    'Cookie 값이 HTTPS 연결로만 전송됩니다. 일반 HTTP 연결로는 절대 새지 않습니다.',
  'panel.inspector.headers.chipInfo.partitioned.summary': 'CHIPS 방식입니다. 쿠키가 최상위 사이트별로 분할됩니다.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    '최상위 사이트마다 쿠키 사본을 따로 갖기 때문에 임베드된 컨텍스트가 쿠키로 사이트 간 사용자를 추적할 수 없습니다.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie 값이 동일 사이트 요청에서만 전송됩니다. 가장 강한 CSRF 보호로, 다른 사이트에서 온 링크도 쿠키 없이 도착합니다.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie 값이 동일 사이트 요청과 최상위 교차 사이트 탐색 (링크 클릭)에서 전송됩니다. 최신 브라우저의 기본값입니다.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie 값이 모든 교차 사이트 요청에서 전송됩니다. `Secure` 플래그가 필요합니다. 의도를 갖고 쓰세요. 수신자가 사이트 간에 쿠키를 연결할 수 있습니다.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Cookie 만료',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'Cookie 값이 이미 만료되었습니다. 브라우저는 보내지 않습니다.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Cookie 값이 {duration} 후 ({date}) 만료됩니다.',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    '`Max-Age` 또는 `Expires` 속성이 없는 쿠키는 세션 쿠키이며 브라우저를 종료하면 사라집니다. 둘 중 하나를 설정하면 쿠키가 유지됩니다.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': '세션 쿠키',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    '`Max-Age` 또는 `Expires` 속성이 없습니다. 브라우저가 종료할 때 이 쿠키를 폐기합니다.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    '`Max-Age=<seconds>` 또는 `Expires=<date>` 속성을 추가하면 브라우저 세션에 걸쳐 유지됩니다.',
  'panel.inspector.headers.chipInfo.missingFlag.title': '{flag} 없음',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': '모범 사례',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    '`Secure` 플래그가 없으면 이 쿠키가 일반 HTTP 연결로 샐 수 있습니다. HTTPS 쿠키에는 항상 설정하세요.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    '`HttpOnly` 플래그가 없으면 JavaScript 코드가 `document.cookie` 속성으로 이 쿠키를 읽을 수 있습니다. XSS 버그 하나로 빼돌려집니다.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    '명시적인 `SameSite` 속성이 없으면 브라우저는 `Lax` 값으로 대체합니다. 코드 리뷰에서 정책이 분명하도록 명시하세요.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    '프로덕션 쿠키 대부분은 `Secure`, `HttpOnly`, 명시적인 `SameSite` 속성을 가져야 합니다.',
  'panel.inspector.headers.chipInfo.cacheKicker': '캐시 지시어',
  'panel.inspector.headers.chipInfo.rawValue': 'Raw 값: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': '활성 지시어',
  'panel.inspector.headers.chipInfo.maxAge': '{duration} 동안 신선합니다.',
  'panel.inspector.headers.chipInfo.sMaxage': '공유 캐시 신선도: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    '백그라운드 재검증이 실행되는 동안 {duration} 동안 오래된 내용의 재사용을 허용합니다.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Content-Type 매개변수',
  'panel.inspector.headers.chipInfo.charset.summary': '본문이 사용하는 문자 인코딩입니다.',
  'panel.inspector.headers.chipInfo.charset.description':
    '`text/*` 유형에서 최신 스택은 기본적으로 `utf-8` 인코딩입니다. 값이 틀리면 글자가 깨집니다.',
  'panel.inspector.headers.chipInfo.boundary.title': 'multipart 경계',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'multipart 본문의 각 부분을 구분하는 token 값입니다 (파일 업로드, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description':
    '클라이언트가 생성합니다. 어떤 부분의 본문 안에도 나타나면 안 됩니다.',
  'panel.inspector.headers.chipInfo.hsts.kicker': '보안 정책',
  'panel.inspector.headers.chipInfo.hsts.summary': '브라우저가 이 호스트에 {duration} 동안 HTTPS 연결을 사용합니다.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': '인가 스킴',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token 형식입니다. base64 인코딩된 `<header>.<payload>.<signature>` 세 부분입니다.',
  'panel.inspector.headers.chipInfo.jwt.description':
    '서명은 서명 키를 가진 쪽이 token 값을 발급했음을 증명합니다. 헤더 부분 (alg, typ)과 페이로드 (클레임)는 암호화되지 않습니다. 단지 base64 인코딩되어 누구나 읽을 수 있습니다.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'JWT 헤더 부분',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'JWT 클레임',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'JWT 헤더 부분에 선언된 서명 알고리즘입니다.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    '흔한 값: `HS256` (HMAC-SHA256, 대칭), `RS256` (RSA, 비대칭), `ES256` (ECDSA). `none` (서명 없음)은 검증기가 항상 거부해야 합니다.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT 만료됨',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'token 값이 {duration} 전에 만료되었습니다. 서버는 거부해야 합니다.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT 만료까지 {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'token 값이 만료에 가깝습니다. 갱신하거나 곧 401 응답을 예상하세요.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'JWT `exp` 클레임에 도달하기까지의 시간입니다.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    '불투명한 bearer 자격 증명입니다 (OAuth 2.0 / API token). 비밀번호처럼 다루세요. 가진 사람은 누구나 그 사용자로 인증할 수 있습니다.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'HTTP Basic 인증입니다. `base64(username:password)` 형식입니다. HTTPS 연결에서만 안전합니다.',
  'panel.inspector.headers.chipInfo.scheme.other': '인증 스킴 이름입니다. 자격 증명 형식은 스킴에 따라 다릅니다.',

  // Header insights (t-fed `computeHeaderInsights`). Origins, cookie
  // names, HSTS summaries, and durations ride as raw holes.
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS 설정 오류',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` 헤더는 자격 증명과 함께 쓸 수 없습니다. 브라우저가 이 응답을 거부합니다.',
  'panel.inspector.headers.insights.corsWildcard.action': '{origin} 값으로 재정의',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'Access-Control-Allow-Origin 헤더가 없는 CORS 요청',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    '요청은 `Origin: {origin}` 헤더를 실었지만 응답에 `Access-Control-Allow-Origin` 헤더가 없습니다. 브라우저가 응답을 차단합니다.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Access-Control-Allow-Origin: {origin} 추가',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` 항목에 `Secure` 플래그 없음',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '쿠키 {count}개에 `Secure` 플래그 없음',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'HTTPS 연결로 설정되는 쿠키는 일반 HTTP 연결로 전송되지 않도록 `Secure` 플래그를 가져야 합니다.',
  'panel.inspector.headers.insights.missingCsp.title': 'HTML 응답에 Content-Security-Policy 헤더 없음',
  'panel.inspector.headers.insights.missingCsp.action': '기본 CSP 정책 추가',
  'panel.inspector.headers.insights.hstsShort.title': 'HSTS max-age 값이 매우 짧음 ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    '대부분의 정책은 최소 6개월을 권장합니다. preload 등록에는 1년이 필요합니다.',
  'panel.inspector.headers.insights.jwtExpired.title': 'Authorization 헤더의 JWT 토큰이 만료됨',
  'panel.inspector.headers.insights.jwtExpired.detail': '{duration} 전에 만료되었습니다.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'JWT 만료까지 {duration}',
  'panel.inspector.headers.insights.missingContentType.title': '응답에 Content-Type 헤더 없음',
  'panel.inspector.headers.insights.missingContentType.action': 'Content-Type 추가',
} as const satisfies Catalog;
