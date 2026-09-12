/**
 * Shared info-popover corpus — HTTP headers — Korean. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: 출처 = origin (the web-platform
 * referent, carried from the panel files) vs 원본 서버 = origin server;
 * 프리플라이트 carried; 지시어 = directive (carried from
 * panel-inspector-headers); 일반적인 값 = common values; 재검증 carried;
 * 스니핑 = sniffing; 핫링크 = hotlink; 크롤러 = crawler; 에지 = edge (CDN
 * tier) with shield riding raw; 분산 추적 = distributed trace (the
 * 추적 = tracking sense is context-partitioned); 의사 헤더 =
 * pseudo-header; 홉 단위 = hop-by-hop; 레지스트리 carried from
 * info-status; 쿠키 저장소 = cookie jar carried from the shared
 * register; 자격 증명 = credentials carried. Every raw header name,
 * value or protocol token takes a Korean head noun before a particle
 * (ETag 값이, `Referer` 헤더를, HTTPS 연결을, HTTP/2 이상에서는).
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': '요청 헤더',
  'shared.info.header.direction.response': '응답 헤더',
  'shared.info.header.direction.both': '요청 / 응답 헤더',
  'shared.info.header.section.directives': '지시어',
  'shared.info.header.section.commonValues': '일반적인 값',
  'shared.info.header.fallback.customCategory': '사용자 정의 또는 비표준',
  'shared.info.header.fallback.customSummary':
    '이 헤더는 사용자 정의이거나 비표준입니다. 레지스트리에 문서가 없습니다.',
  'shared.info.header.fallback.unknownSummary':
    '{name} 헤더는 아직 레지스트리에 문서화되지 않았습니다. 이 행은 {category} 범주로 분류됩니다.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': '클라이언트를 서버에 인증하는 자격 증명입니다.',
  'shared.info.header.authorization.body1':
    '형식: `<scheme> <credentials>`. 일반적인 스킴: `Bearer <token>` (OAuth, JWT), `Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary': '중간 프록시 (원본 서버가 아님)에 대한 자격 증명입니다.',
  'shared.info.header.proxyAuthorization.body1': '구문은 `Authorization` 헤더와 같지만 적용 범위가 다릅니다.',
  'shared.info.header.wwwAuthenticate.summary':
    '서버의 401 챌린지입니다. 클라이언트에 어떤 인증 스킴을 쓸지 알려 줍니다.',
  'shared.info.header.wwwAuthenticate.body1':
    '`401 Unauthorized` 응답과 함께 전송됩니다. 스킴이 `Basic`이면 브라우저의 기본 인증 대화 상자를 띄웁니다.',
  'shared.info.header.proxyAuthenticate.summary':
    '`WWW-Authenticate` 헤더의 프록시 버전으로, `407 Proxy Authentication Required` 응답과 함께 전송됩니다.',
  'shared.info.header.authenticationInfo.summary':
    '성공 시 상호 인증을 완료합니다. Digest 인증은 이를 사용해 서버 쪽도 확인합니다.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary': '응답을 어떻게 캐시하고 재검증할지 규정하는 지시어입니다.',
  'shared.info.header.cacheControl.body1':
    '요청과 응답 모두 지시어를 실을 수 있습니다. 쉼표로 구분된 여러 token 값은 AND로 결합됩니다. 동작은 지시어별로 정해지며, 이 헤더는 단일 모드가 아닙니다.',
  'shared.info.header.cacheControl.directive.noStore': '어디에도 전혀 캐시하지 않습니다.',
  'shared.info.header.cacheControl.directive.noCache': '캐시할 수는 있지만 재사용 전에 매번 재검증합니다.',
  'shared.info.header.cacheControl.directive.public': '공유 캐시 / CDN 캐시를 포함해 어떤 캐시든 저장할 수 있습니다.',
  'shared.info.header.cacheControl.directive.private': '사용자의 브라우저만 저장할 수 있습니다.',
  'shared.info.header.cacheControl.directive.maxAgeN':
    'N초 동안 신선한 것으로 보고, 원본 서버에 문의하지 않고 재사용합니다.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'max-age 지시어와 같지만 공유 캐시에만 적용됩니다.',
  'shared.info.header.cacheControl.directive.mustRevalidate': '오래되면 제공하기 전에 재검증합니다.',
  'shared.info.header.cacheControl.directive.immutable': 'max-age 기간 동안 본문이 바뀌지 않음을 약속합니다.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    '백그라운드에서 재검증하는 동안 오래된 내용의 재사용을 허용합니다.',
  'shared.info.header.pragma.summary': '구식 HTTP/1.0 캐시 제어입니다. 사실상 Cache-Control 헤더로 대체되었습니다.',
  'shared.info.header.pragma.body1':
    '일부 클라이언트는 호환성을 위해 지금도 `Pragma: no-cache` 값을 설정합니다. 현대 서버는 `Cache-Control` 헤더를 따르고 `Pragma` 헤더는 무시해야 합니다.',
  'shared.info.header.expires.summary': '이 시각 이후로 응답이 오래된 것으로 간주되는 절대 날짜/시각입니다.',
  'shared.info.header.expires.body1':
    '`Cache-Control: max-age` 지시어로 대체되었습니다. 둘 다 설정되면 `max-age` 지시어가 우선합니다. 과거 날짜 (또는 `0`)를 쓰면 재가져오기를 강제할 수 있습니다.',
  'shared.info.header.etag.summary': '응답 본문의 불투명한 식별자입니다. 캐시된 사본을 재검증하는 데 쓰입니다.',
  'shared.info.header.etag.body1':
    '클라이언트는 이 값을 `If-None-Match` 헤더로 되돌려 보냅니다. 값이 여전히 일치하면 서버는 본문 없이 `304 Not Modified` 응답을 돌려줍니다.',
  'shared.info.header.ifMatch.summary': '조건부 요청: 리소스의 현재 ETag 값이 일치할 때만 진행합니다.',
  'shared.info.header.ifMatch.body1':
    '쓰기에서 사용해 다른 사람이 만든 변경을 덮어쓰지 않도록 막습니다 (낙관적 동시성 제어).',
  'shared.info.header.ifNoneMatch.summary': '조건부 요청: 리소스의 ETag 값이 바뀌었을 때만 진행합니다.',
  'shared.info.header.ifNoneMatch.body1':
    '읽기에서 사용해 바뀌지 않은 응답의 다운로드를 건너뜁니다. 서버는 `304 Not Modified` 응답을 돌려줍니다.',
  'shared.info.header.ifModifiedSince.summary': '조건부 요청: 지정한 날짜 이후에 리소스가 변경되었을 때만 진행합니다.',
  'shared.info.header.ifModifiedSince.body1':
    '`If-None-Match`/ETag 방식보다 정밀도가 낮습니다. 가능하면 ETag 값을 우선하세요.',
  'shared.info.header.ifUnmodifiedSince.summary':
    '조건부 요청: 지정한 날짜 이후로 리소스가 수정되지 않았을 때만 진행합니다.',
  'shared.info.header.lastModified.summary': '리소스가 마지막으로 변경된 날짜/시각입니다.',
  'shared.info.header.lastModified.body1': '재검증을 위해 `If-Modified-Since` 헤더와 짝을 이룹니다.',
  'shared.info.header.age.summary': '응답이 공유 캐시에 머문 초 수입니다.',
  'shared.info.header.age.body1':
    'CDN 서비스와 프록시가 돌려줍니다. 클라이언트가 응답의 신선도를 파악하는 데 도움이 됩니다.',
  'shared.info.header.xCache.summary':
    'CDN / 리버스 프록시의 캐시 결과입니다. 형식은 공급업체마다 다릅니다 (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': '캐시에서 제공되었습니다.',
  'shared.info.header.xCache.value.miss': '캐시되지 않았고, 원본 서버에서 가져왔습니다.',
  'shared.info.header.xCache.value.hitHit': '여러 캐시 계층 모두에서 적중했습니다 (예: shield + 에지).',
  'shared.info.header.xCacheHits.summary':
    '계층별 캐시 적중 횟수입니다. 공급업체마다 다르며 Fastly 서비스에서 흔합니다.',
  'shared.info.header.xCacheHits.body1':
    '여러 캐시 계층이 관여하면 쉼표로 구분됩니다. 값이 클수록 자주 쓰이는 캐시 라인을 뜻합니다.',
  'shared.info.header.warning.summary':
    '추가 캐시 맥락 (오래됨, 변환 적용됨 등)입니다. RFC 7234 이후 HTTP/1.1 규격에서는 사용 중단되었지만 지금도 내보내집니다.',
  'shared.info.header.surrogateControl.summary':
    'Edge Side Includes 캐시 제어입니다. 브라우저 캐시는 `Cache-Control` 헤더에 맡기고 CDN 서비스에 지시합니다.',
  'shared.info.header.surrogateControl.body1': 'ESI 지원 캐시 (Fastly, Akamai, 일부 구성의 Varnish)에 한정됩니다.',
  'shared.info.header.surrogateCapability.summary':
    'Edge 계층에서 원본 서버로 보내는 힌트: 대리 캐시가 지원하는 ESI 기능입니다.',
  'shared.info.header.cfCacheStatus.summary': '이 요청에 대한 Cloudflare 캐시 결과입니다.',
  'shared.info.header.cfCacheStatus.value.hit': 'Cloudflare 캐시에서 제공되었습니다.',
  'shared.info.header.cfCacheStatus.value.miss': '캐시에 없어 원본 서버에서 가져왔습니다.',
  'shared.info.header.cfCacheStatus.value.expired': '캐시되어 있었지만 만료되어 원본 서버에서 새로 가져왔습니다.',
  'shared.info.header.cfCacheStatus.value.bypass': '캐시를 우회했습니다 (페이지 규칙 / no-cache 헤더).',
  'shared.info.header.cfCacheStatus.value.dynamic': '기본적으로 캐시할 수 없습니다 (쿠키, 쿼리 문자열 등).',
  'shared.info.header.cfCacheStatus.value.revalidated': '캐시되어 있으며 원본 서버와 재검증했습니다 (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint: 브라우저의 브랜드 목록입니다.',
  'shared.info.header.secChUa.body1':
    '서버가 실제로 의존해야 하는 부분에 한해 자유 형식의 `User-Agent` 헤더를 대체합니다.',
  'shared.info.header.secChUaMobile.summary': 'Client Hint: 모바일에서는 `?1`, 데스크톱에서는 `?0` 값입니다.',
  'shared.info.header.secChUaPlatform.summary':
    'Client Hint: 사용자의 OS 이름입니다 (`"Windows"`, `"macOS"`, `"Linux"` 등).',
  'shared.info.header.userAgent.summary': '브라우저, OS, 엔진을 식별하는 구식 자유 형식 문자열입니다.',
  'shared.info.header.userAgent.body1':
    '지금도 모든 요청에서 전송됩니다. 구조화된 후속 규격은 `Sec-CH-UA-*` 계열입니다. 서버가 브라우저 식별에 신경 쓴다면 그쪽을 우선하세요.',
  'shared.info.header.acceptCh.summary': '이후 요청에서 서버가 원하는 Client Hint 헤더를 나열합니다.',
  'shared.info.header.acceptCh.body1': '브라우저는 서버가 여기서 선택한 힌트만 보냅니다 (저엔트로피 기본값은 예외).',
  'shared.info.header.criticalCh.summary':
    '서버가 중요하게 보는 `Accept-CH` 헤더의 부분집합입니다. 브라우저는 이를 포함하기 위해 요청을 다시 시작합니다.',
  'shared.info.header.criticalCh.body1': '아껴서 쓰세요. Critical-CH 값이 빠질 때마다 왕복 한 번이 소요됩니다.',
  'shared.info.header.saveData.summary': '사용자가 브라우저 / OS에서 데이터 절약 모드를 켰으면 `on` 값입니다.',
  'shared.info.header.saveData.body1':
    '저대역폭용 자산을 제공하는 데 쓰세요 (이미지 품질 낮추기, 첫 화면 밖 작업 미루기 등).',
  'shared.info.header.deviceMemory.summary':
    '기기의 대략적인 RAM 용량 (GiB)으로, 소수의 값 (`0.25`, `0.5`, `1`, `2`, `4`, `8`)으로 반올림됩니다.',
  'shared.info.header.downlink.summary': '추정 하향 대역폭 (Mbps, 반올림)입니다.',
  'shared.info.header.ect.summary':
    '유효 연결 유형 (Effective Connection Type): `slow-2g`, `2g`, `3g`, `4g` 중 하나입니다.',
  'shared.info.header.rtt.summary': '추정 왕복 시간 (밀리초, 반올림)입니다.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': '홉 단위 연결 제어입니다 (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    '홉 사이의 프록시에서 제거됩니다. HTTP/2 이상에서는 이 헤더가 금지되며, 연결 관리는 프로토콜에 내장되어 있습니다.',
  'shared.info.header.keepAlive.summary': '연결 풀 힌트입니다. 보통 `timeout=N, max=N` 형식입니다.',
  'shared.info.header.keepAlive.body1':
    'HTTP/1.1 연결에서 `Connection: keep-alive` 헤더와 함께 쓸 때만 의미가 있습니다. HTTP/2 이상에서는 무시됩니다.',
  'shared.info.header.upgrade.summary': '같은 연결에서 프로토콜 전환을 요청합니다 (WebSocket, HTTP/2 평문).',
  'shared.info.header.upgrade.body1':
    '`Connection: upgrade` 헤더와 함께 씁니다. WebSocket 연결의 경우: `Upgrade: websocket`.',
  'shared.info.header.te.summary': '클라이언트가 받아들이는 전송 인코딩입니다 (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1': '현대 클라이언트 대부분은 트레일러 헤더를 받기 위해 `TE: trailers` 값만 보냅니다.',
  'shared.info.header.expect.summary': '클라이언트가 성립하기를 기대하는 서버 쪽 전제 조건입니다 (`100-continue`).',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` 헤더를 쓰면 클라이언트는 서버가 `100 Continue` 응답을 보낸 뒤에만 본문을 보냅니다.',
  'shared.info.header.altSvc.summary': '같은 출처에 도달하는 다른 방법을 알립니다 (예: QUIC 위의 HTTP/3).',
  'shared.info.header.altSvc.body1': '브라우저는 이 알림을 캐시하고, 이후 요청에서 대체 경로로 전환할 수 있습니다.',
  'shared.info.header.secWebsocketKey.summary':
    'WebSocket 핸드셰이크에서 보내는 base64 인코딩된 임의의 nonce 값입니다.',
  'shared.info.header.secWebsocketKey.body1':
    '서버는 이 키와 고정 GUID 값에서 도출한 `Sec-WebSocket-Accept` 헤더로 응답해 WebSocket 프로토콜을 이해함을 증명합니다.',
  'shared.info.header.secWebsocketAccept.summary':
    'WebSocket 핸드셰이크에 대한 서버 쪽 증명입니다. `SHA-1(Sec-WebSocket-Key + GUID)` 값을 base64로 인코딩한 것입니다.',
  'shared.info.header.secWebsocketVersion.summary':
    '클라이언트가 요청하는 WebSocket 프로토콜 버전입니다. 거의 항상 `13`입니다 (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'WebSocket 하위 프로토콜 협상입니다. 요청에서는 쉼표로 구분된 목록, 응답에서는 선택된 단일 값입니다.',
  'shared.info.header.secWebsocketExtensions.summary':
    '협상된 WebSocket 확장 (압축 등)입니다. 가장 흔한 값은 `permessage-deflate`입니다.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': '요청 또는 응답 본문의 미디어 유형입니다.',
  'shared.info.header.contentType.body1':
    '브라우저가 본문을 어떻게 파싱할지 결정합니다. 잘못된 값은 조용한 실패를 부릅니다 (JSON 본문이 HTML 문서로 파싱되는 등).',
  'shared.info.header.contentType.body2': '`text/*` 유형에는 특별한 이유가 없는 한 `charset=utf-8` 값을 포함하세요.',
  'shared.info.header.contentType.value.applicationJson': 'JSON 본문입니다.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'URL 인코딩된 폼 필드입니다.',
  'shared.info.header.contentType.value.multipartFormData': '멀티파트 폼 / 파일 업로드입니다.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'HTML 문서입니다.',
  'shared.info.header.contentType.value.applicationOctetStream': '불투명한 바이너리입니다.',
  'shared.info.header.contentLength.summary': '본문 크기 (바이트, 디코딩 후)입니다.',
  'shared.info.header.contentLength.body1':
    '`Transfer-Encoding: chunked` 헤더와 함께 쓸 수 없습니다. 잘못된 값은 연결 동기화 어긋남을 부릅니다.',
  'shared.info.header.contentEncoding.summary':
    '본문에 적용된 압축입니다. 브라우저는 JS 코드에 노출하기 전에 디코딩합니다.',
  'shared.info.header.contentEncoding.body1':
    '일반적인 값: `gzip`, `br` (Brotli), `zstd` (비교적 새로움). `response.body` 속성이 보는 것은 디코딩된 크기입니다.',
  'shared.info.header.contentDisposition.summary': '응답을 인라인으로 표시할지 다운로드할지 브라우저에 알립니다.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (기본값)은 브라우저 안에서 렌더링합니다. `attachment; filename="x"` 값은 지정한 기본 파일 이름으로 다운로드를 시작합니다.',
  'shared.info.header.accept.summary': '클라이언트가 받아들일 수 있는 미디어 유형입니다.',
  'shared.info.header.accept.body1':
    'q 값으로 선호도를 표현합니다 (`text/html;q=0.9`). 오늘날 대부분의 서버는 첫 번째 유형 외에는 무시합니다.',
  'shared.info.header.acceptEncoding.summary': '클라이언트가 디코딩할 수 있는 압축 방식입니다.',
  'shared.info.header.acceptEncoding.body1':
    '일반적인 브라우저 값: `gzip, deflate, br, zstd`. 서버는 하나를 골라 `Content-Encoding` 헤더로 응답합니다.',
  'shared.info.header.acceptLanguage.summary': '클라이언트가 선호하는 자연어입니다.',
  'shared.info.header.acceptLanguage.body1':
    '서버는 이 목록에서 `Content-Language` 값을 고르며, 흔히 기본값으로 대체합니다.',
  'shared.info.header.transferEncoding.summary':
    '전송을 위해서만 적용되는 인코딩입니다. 본문이 애플리케이션에 도달하기 전에 제거됩니다.',
  'shared.info.header.transferEncoding.body1':
    '거의 항상 `chunked` 값입니다. `Content-Length` 헤더와 함께 쓸 수 없습니다.',
  'shared.info.header.range.summary': '본문 전체 대신 리소스의 바이트 범위를 요청합니다.',
  'shared.info.header.range.body1':
    '형식: `bytes=<start>-<end>` (양 끝 포함). 서버는 `206 Partial Content` 응답과 `Content-Range` 헤더로 응답합니다.',
  'shared.info.header.contentRange.summary': '본문에 담긴 리소스의 바이트 범위를 나타냅니다.',
  'shared.info.header.contentRange.body1':
    '형식: `bytes <start>-<end>/<total>`. `206 Partial Content` 응답과 함께 반환됩니다.',
  'shared.info.header.acceptRanges.summary':
    '범위 요청을 지원하는지 (`bytes`) 지원하지 않는지 (`none`) 클라이언트에 알립니다.',
  'shared.info.header.contentMd5.summary':
    '무결성 검사를 위한, 본문의 Base64 인코딩된 MD5 다이제스트입니다. HTTP/1.1 RFC 7231 규격에서 폐지되었지만 일부 서버는 지금도 내보냅니다.',
  'shared.info.header.contentMd5.body1':
    '현대의 무결성 검사는 `Digest` / `Want-Digest` 헤더나 TLS 자체로 이루어집니다.',
  'shared.info.header.contentLanguage.summary': '응답 본문의 자연어입니다.',
  'shared.info.header.contentLanguage.body1':
    '요청의 `Accept-Language` 헤더와 대조해 협상됩니다. 값은 BCP-47 태그입니다 (`en-US`, `de-DE` 등).',
  'shared.info.header.contentLocation.summary': '이 응답의 엔터티를 고유하게 식별하는 대체 URL 주소입니다.',
  'shared.info.header.contentLocation.body1':
    '`Location` 헤더와 다릅니다. `Content-Location` 헤더는 받은 리소스를 설명하며, 리디렉션 대상이 아닙니다.',
  'shared.info.header.acceptCharset.summary':
    '클라이언트가 받아들이는 문자 인코딩입니다. 사용 중단되었습니다. 현대 브라우저는 항상 UTF-8 인코딩을 보내며 이 헤더를 내보내지 않습니다.',
  'shared.info.header.acceptCharset.body1': '대부분의 서버는 안전하게 무시할 수 있습니다.',
  'shared.info.header.ifRange.summary':
    '조건부 범위 요청: 리소스가 지정한 ETag 값이나 날짜와 여전히 일치할 때만 범위를 제공합니다.',
  'shared.info.header.ifRange.body1':
    '리소스가 변경되었으면 서버는 `206 Partial Content` 대신 `200 OK` 응답으로 본문 전체를 돌려줍니다.',
  'shared.info.header.trailer.summary': '청크 본문 뒤의 트레일러에 나타날 헤더 필드 이름을 선언합니다.',
  'shared.info.header.trailer.body1':
    '`Transfer-Encoding: chunked` 헤더와 함께 쓸 때만 의미가 있습니다. 클라이언트는 `TE: trailers` 값으로 받겠다고 알려야 합니다.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': '브라우저가 이 요청과 함께 보내는 쿠키입니다. 세미콜론으로 구분됩니다.',
  'shared.info.header.cookie.body1':
    "브라우저가 쿠키 저장소에서 설정합니다. `fetch` 호출에서는 JS 코드로 직접 설정할 수 없습니다. `credentials: 'include'` 옵션을 쓰세요.",
  'shared.info.header.setCookie.summary': '서버가 발급하는 쿠키 정의입니다.',
  'shared.info.header.setCookie.body1':
    '`Set-Cookie` 헤더 한 줄에 쿠키 하나입니다. 브라우저는 (이름, 도메인, 경로) 조합마다 최신 값을 저장합니다.',
  'shared.info.header.setCookie.body2':
    '운영 환경의 쿠키에는 항상 `Secure`, `HttpOnly`, 그리고 명시적인 `SameSite` (Lax 또는 Strict) 속성을 붙이세요.',
  'shared.info.header.setCookie.directive.secure': 'HTTPS 연결에서만 전송합니다.',
  'shared.info.header.setCookie.directive.httpOnly': 'JavaScript 코드 (document.cookie)에서 숨깁니다.',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    '교차 사이트 전송 정책입니다. `None` 값에는 `Secure` 속성이 필요합니다.',
  'shared.info.header.setCookie.directive.domainHost': '이 호스트와 모든 하위 도메인에 전송합니다.',
  'shared.info.header.setCookie.directive.pathPath': '이 경로로 시작하는 URL 주소에만 전송합니다.',
  'shared.info.header.setCookie.directive.maxAgeN': '초 단위 TTL 값입니다 (Expires 속성보다 우선).',
  'shared.info.header.setCookie.directive.expiresDate': '절대 만료 시각입니다. 생략하면 세션 쿠키가 됩니다.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS: 최상위 사이트별로 분할됩니다.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary': '이 응답을 읽도록 허용된 출처를 브라우저에 알립니다.',
  'shared.info.header.accessControlAllowOrigin.body1':
    '서버가 응답에 설정합니다. 브라우저는 이를 요청의 `Origin` 헤더와 비교하고, 일치하지 않으면 JavaScript 코드의 본문 읽기를 차단합니다.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` 값은 모든 출처를 허용하지만 자격 증명과는 양립하지 않습니다. 요청이 쿠키나 인증 정보를 실으면 응답은 대신 요청한 출처를 정확히 그대로 돌려줘야 합니다.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': '어떤 출처든 읽을 수 있습니다 (자격 증명 없음).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': '지정한 출처만 읽을 수 있습니다.',
  'shared.info.header.accessControlAllowCredentials.summary':
    '요청이 자격 증명을 실었을 때 브라우저가 응답을 노출하도록 허용합니다.',
  'shared.info.header.accessControlAllowCredentials.body1':
    '`true` (소문자) 값이어야 합니다. 설정하면 `Access-Control-Allow-Origin` 헤더는 `*` 값이면 안 되며, 정확한 출처를 돌려줘야 합니다.',
  'shared.info.header.accessControlAllowMethods.summary':
    '교차 출처 요청에 대해 서버가 허용하는 HTTP 메서드를 나열합니다.',
  'shared.info.header.accessControlAllowMethods.body1':
    '프리플라이트 (`OPTIONS`) 응답에서 반환됩니다. 브라우저는 이 답을 `Access-Control-Max-Age` 초 동안 캐시합니다.',
  'shared.info.header.accessControlAllowHeaders.summary': '교차 출처 요청에서 서버가 허용하는 요청 헤더를 나열합니다.',
  'shared.info.header.accessControlAllowHeaders.body1':
    '브라우저가 단순하지 않은 헤더 (`Accept`, `Accept-Language`, `Content-Language`, 단순한 `Content-Type` 값 외의 것)를 프리플라이트할 때 필수입니다.',
  'shared.info.header.accessControlExposeHeaders.summary': 'JavaScript 코드가 읽을 수 있는 응답 헤더를 나열합니다.',
  'shared.info.header.accessControlExposeHeaders.body1':
    '기본적으로 JS 코드는 CORS 안전 목록의 응답 헤더 (`Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`)만 봅니다. 그 밖의 헤더는 `response.headers.get(...)` 호출이 돌려줄 수 있도록 여기에 이름을 올려야 합니다.',
  'shared.info.header.accessControlMaxAge.summary': '브라우저가 프리플라이트 응답을 캐시해도 되는 시간 (초)입니다.',
  'shared.info.header.accessControlMaxAge.body1':
    '큰 값은 프리플라이트 왕복을 줄입니다. 86400 (1일)이 흔히 쓰입니다. Chrome 브라우저는 7200초, Firefox 브라우저는 86400초를 상한으로 둡니다.',
  'shared.info.header.accessControlRequestMethod.summary':
    '프리플라이트에서 보내며, 실제 요청이 쓸 메서드를 선언합니다.',
  'shared.info.header.accessControlRequestMethod.body1':
    '서버는 `Access-Control-Allow-Methods` 헤더로 응답해 확인합니다.',
  'shared.info.header.accessControlRequestHeaders.summary':
    '프리플라이트에서 보내며, 실제 요청이 실을 헤더를 선언합니다.',
  'shared.info.header.accessControlRequestHeaders.body1':
    '허용되면 `Access-Control-Allow-Headers` 헤더로 되돌려집니다.',
  'shared.info.header.origin.summary': '교차 출처 또는 POST 요청을 시작한 출처를 식별합니다.',
  'shared.info.header.origin.body1':
    '브라우저가 자동으로 보냅니다. JS 코드로는 설정할 수 없습니다. 서버가 CORS 응답을 결정하거나 CSRF 방어에 쓰입니다.',
  'shared.info.header.vary.summary': '어떤 요청 헤더가 응답에 영향을 주는지 캐시에 알려 캐시 키를 달리하게 합니다.',
  'shared.info.header.vary.body1':
    'CORS 처리에 매우 중요합니다. `Access-Control-Allow-Origin` 헤더를 요청의 출처에서 계산한다면 반드시 `Vary: Origin` 헤더를 포함하세요. 그러지 않으면 캐시가 한 출처의 응답을 다른 출처에 제공합니다.',
  'shared.info.header.timingAllowOrigin.summary':
    '외부 출처가 이 리소스의 상세 타이밍 지표 (`PerformanceResourceTiming`)를 읽을 수 있게 합니다.',
  'shared.info.header.timingAllowOrigin.body1': '이 헤더가 없으면 교차 출처 리소스는 대략적인 타이밍만 노출합니다.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary': '브라우저 설정: 요청 발신자와 대상 사이의 관계입니다.',
  'shared.info.header.secFetchSite.body1': '값: `same-origin`, `same-site`, `cross-site`, `none` (직접 탐색).',
  'shared.info.header.secFetchMode.summary': '브라우저 설정: 요청의 fetch 모드입니다.',
  'shared.info.header.secFetchMode.body1': '값: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary': '브라우저 설정: 응답이 쓰일 자리입니다 (document, script, image 등).',
  'shared.info.header.secFetchDest.body1':
    '서버가 뜻밖의 가져오기를 감지할 수 있게 합니다. 예: HTML 응답이 `Sec-Fetch-Dest: script` 값으로 요청되는 경우.',
  'shared.info.header.secFetchUser.summary': '브라우저 설정: 탐색이 사용자의 직접 조작이었으면 `?1` 값입니다.',
  'shared.info.header.secFetchUser.body1':
    '그 밖에는 붙지 않습니다. 사용자 클릭과 프로그램에 의한 탐색을 구분하는 데 유용합니다.',
  'shared.info.header.secPurpose.summary': '요청이 투기적일 때 브라우저가 설정합니다. 예: `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    '사용자가 아직 실제로 요청하지 않은 가져오기에 대해 서버가 부수 효과 (분석, 로그 기록)를 건너뛸 수 있게 합니다.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    '이 전송이 얼마나 긴급하고 얼마나 점진적인지 서버 (또는 클라이언트)에 알립니다.',
  'shared.info.header.priority.body1':
    '형식: `u=<0-7>` (긴급도, 작을수록 높은 우선순위)와 선택적인 `, i` (점진적: 도착하는 대로 처리 가능).',
  'shared.info.header.upgradeInsecureRequests.summary':
    '브라우저가 설정하는 `1` 값입니다. 포함된 리소스에 대해 클라이언트가 HTTPS 연결을 선호함을 서버에 알립니다.',
  'shared.info.header.upgradeInsecureRequests.body1':
    '응답 쪽의 CSP 지시어 `upgrade-insecure-requests`와 짝을 이룹니다.',
  'shared.info.header.earlyData.summary': '`1` 값: TLS 1.3 0-RTT 모드로 데이터를 보내는 클라이언트가 설정합니다.',
  'shared.info.header.earlyData.body1':
    '재전송 공격을 피하려면 서버는 멱등하지 않은 메서드 (POST 등)의 early-data 전송을 거부해야 합니다.',
  'shared.info.header.link.summary': '리소스 힌트입니다: preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'HTML 문서의 `<link rel="...">` 요소와 같은 의미입니다. HTML 문서가 아닌 응답 (API 응답, 리디렉션)에서 쓸 수 있어 유용합니다.',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': '스타일시트를 미리 불러옵니다.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': '연결을 미리 엽니다.',
  'shared.info.header.xDnsPrefetchControl.summary':
    '페이지 안 링크에 대한 브라우저의 DNS 프리페치를 켜고 끕니다 (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary':
    'Do Not Track: 사용자가 추적을 거부했으면 `1` 값입니다. 대체로 사용 중단되었습니다.',
  'shared.info.header.dnt.body1':
    '주요 사이트 대부분이 무시하며, W3C 단체는 2019년에 규격을 철회했습니다. 준수는 자발적입니다.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control: `1` 값은 사용자가 자기 데이터의 판매나 공유를 원하지 않음을 알립니다.',
  'shared.info.header.secGpc.body1':
    '캘리포니아주에서는 CCPA 법 아래 법적 구속력이 있습니다. 개인 정보 보호 중심 브라우저 (Brave, Firefox, DuckDuckGo) 일부가 따릅니다.',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': '메시지가 거쳐 온 프록시 / 게이트웨이를 나열합니다.',
  'shared.info.header.via.body1': '각 프록시가 자기 식별자를 덧붙이므로 디버깅할 때 경로를 재구성할 수 있습니다.',
  'shared.info.header.xForwardedFor.summary':
    '비표준이지만 어디서나 쓰입니다. 프록시를 거쳐 온 클라이언트 IP 주소의 쉼표 구분 연쇄입니다.',
  'shared.info.header.xForwardedFor.body1':
    '가장 왼쪽 항목이 원래 클라이언트입니다. RFC 7239 규격의 `Forwarded` 헤더가 표준화된 대안입니다.',
  'shared.info.header.xForwardedProto.summary':
    '클라이언트가 첫 번째 프록시에 도달할 때 쓴 원래 스킴 (`http` 또는 `https`)입니다.',
  'shared.info.header.xForwardedHost.summary': '프록시가 다시 쓰기 전에 클라이언트가 보낸 원래 `Host` 헤더입니다.',
  'shared.info.header.xRealIp.summary': '첫 번째 프록시가 본 원래 클라이언트 IP 주소입니다. 연쇄가 아닌 단일 값입니다.',
  'shared.info.header.forwarded.summary':
    'RFC 7239 규격으로 표준화된 프록시 연쇄입니다. `X-Forwarded-*` 계열을 대체합니다.',
  'shared.info.header.forwarded.body1':
    '형식: `for=client; proto=https; by=proxy; host=original-host`. 프록시가 여럿이면 쉼표로 구분합니다.',
  'shared.info.header.trueClientIp.summary':
    'Akamai / Cloudflare Enterprise 서비스가 전달하는 원래 클라이언트 IP 주소입니다. 연쇄가 아닌 단일 값입니다.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'HTTP/2 이상의 의사 헤더로, HTTP/1.1 규격의 `Host` 헤더에 해당합니다. 대상 서버를 식별합니다.',
  'shared.info.header.authority.body1':
    '의사 헤더는 `:` 문자로 시작하며 일반 헤더보다 앞에 와야 합니다. 브라우저가 설정하며 JavaScript 코드로는 설정할 수 없습니다.',
  'shared.info.header.method.summary': 'HTTP/2 이상의 의사 헤더: 요청 메서드입니다 (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'HTTP/2 이상의 의사 헤더: 요청 경로와 쿼리 문자열입니다.',
  'shared.info.header.scheme.summary': 'HTTP/2 이상의 의사 헤더: `https` 또는 `http` 값입니다.',
  'shared.info.header.status.summary': 'HTTP/2 이상의 의사 헤더: 숫자 응답 상태입니다 (예: `200`).',
  'shared.info.header.status.body1':
    'HTTP/2 및 HTTP/3 프로토콜에서는 의사 헤더가 HTTP/1.1 규격의 상태 줄을 대체합니다.',
  'shared.info.header.host.summary':
    'HTTP/1.1 규격의 대상 호스트 (및 선택적 포트)입니다. HTTP/2 이상에서는 `:authority` 의사 헤더로 대체됩니다.',
  'shared.info.header.host.body1':
    '모든 HTTP/1.1 요청에 필수입니다. 서버는 같은 IP 주소의 가상 호스트 사이를 라우팅하는 데 씁니다.',
  'shared.info.header.location.summary':
    '리디렉션 대상입니다. `3xx` 응답과 함께, 또는 리소스 생성의 결과로 전송됩니다.',
  'shared.info.header.location.body1':
    '절대 URL 주소는 예외 없이 따릅니다. 상대 URL 주소는 요청 URL 주소를 기준으로 해석됩니다.',
  'shared.info.header.allow.summary': '리소스가 허용하는 HTTP 메서드를 나열합니다.',
  'shared.info.header.allow.body1':
    '`405 Method Not Allowed` 응답에서는 필수입니다. 일반적인 값: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': '이 요청을 시작한 페이지의 URL 주소입니다.',
  'shared.info.header.referer.body1':
    '역사적인 철자 오류에 주의하세요. 규격은 그대로 유지합니다. 일부 대상은 페이지의 `Referrer-Policy` 헤더에 따라 `Referer` 헤더를 제거하거나 축소합니다.',
  'shared.info.header.retryAfter.summary':
    '언제 재시도할지 클라이언트에 알립니다. 초 (차이) 또는 절대 HTTP 날짜입니다.',
  'shared.info.header.retryAfter.body1':
    '`503 Service Unavailable` 및 `429 Too Many Requests` 응답에서 흔합니다. 크롤러는 이를 따릅니다.',
  'shared.info.header.maxForwards.summary': '`TRACE` 또는 `OPTIONS` 요청을 전달할 수 있는 프록시 수를 제한합니다.',
  'shared.info.header.maxForwards.body1': '전달하는 프록시마다 1씩 줄어듭니다. 0에 이르면 그 프록시가 직접 응답합니다.',
  'shared.info.header.serviceWorker.summary':
    '서비스 워커 스크립트 파일을 가져오는 요청에서 브라우저가 설정하는 `script` 값입니다.',
  'shared.info.header.serviceWorker.body1':
    '서버가 SW 등록 가져오기를 감지하고 알맞은 `Service-Worker-Allowed` 헤더로 응답할 수 있게 합니다.',
  'shared.info.header.serviceWorkerAllowed.summary': '서비스 워커 범위에 대한 기본 경로 제한을 재정의합니다.',
  'shared.info.header.serviceWorkerAllowed.body1':
    '기본적으로 워커는 자기 디렉터리와 그 아래만 제어할 수 있습니다. 이 헤더로 범위를 넓힐 수 있습니다. 예: `/sw.js` 경로의 워커에서 `/` 경로 제어.',
  'shared.info.header.protocol.summary':
    '확장 CONNECT 메커니즘 (RFC 8441)의 의사 헤더입니다. HTTP/2 / 3 위의 WebSocket 연결에 쓰입니다.',
  'shared.info.header.protocol.body1':
    '클라이언트가 HTTP/2 또는 HTTP/3 프로토콜을 통해 WebSocket 연결을 터널링하면 `websocket` 값으로 설정됩니다.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    '페이지가 리소스를 불러오거나 코드를 실행할 수 있는 소스의 허용 목록입니다.',
  'shared.info.header.contentSecurityPolicy.body1':
    '지시어 안은 공백으로, 지시어 사이는 세미콜론으로 구분합니다. 대부분의 앱에는 최소한 `default-src`, `script-src`, `style-src`, `connect-src` 지시어가 필요합니다.',
  'shared.info.header.contentSecurityPolicy.body2':
    '강제하기 전에 위반을 관찰하려면 `Content-Security-Policy-Report-Only` 헤더를 쓰세요.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc':
    '명시적으로 설정하지 않은 모든 -src 지시어의 대체값입니다.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc':
    '`<script>` 요소와 인라인 JS 코드에 허용되는 소스입니다.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc': '스타일시트와 인라인 CSS 코드에 허용되는 소스입니다.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': '허용되는 이미지 소스입니다.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': '허용되는 fetch / XHR / WebSocket 대상입니다.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    '이 페이지를 iframe 요소에 넣을 수 있는 상대입니다 (X-Frame-Options 헤더를 대체).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo': '위반 보고서를 POST 메서드로 보낼 곳입니다.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'CSP 헤더와 같은 구문이지만 위반이 차단되지 않고 보고만 됩니다.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1': '운영 환경에서 정책을 강제하기 전에 시험하는 데 쓰세요.',
  'shared.info.header.strictTransportSecurity.summary':
    '지정한 기간 동안 이 호스트에 대해 브라우저가 HTTPS 연결을 쓰도록 강제합니다.',
  'shared.info.header.strictTransportSecurity.body1':
    '운영 환경에서는 `max-age` 값을 최소 6개월로 설정하세요. 도메인 아래 모든 호스트를 포함하려면 `includeSubDomains` 지시어를 추가하세요.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` 지시어를 쓰면 브라우저에 내장되는 HSTS 프리로드 목록에 도메인을 제출할 수 있습니다 (되돌리기 어려운 일방향 결정).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': '브라우저가 HTTPS 전용을 기억하는 기간입니다.',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': '모든 하위 도메인에 적용합니다.',
  'shared.info.header.strictTransportSecurity.directive.preload': '브라우저 프리로드 목록 등록 자격입니다.',
  'shared.info.header.xContentTypeOptions.summary': 'MIME 스니핑을 끕니다.',
  'shared.info.header.xContentTypeOptions.body1':
    '유효한 값은 `nosniff` 하나뿐입니다. 모든 응답에 권장됩니다. `text/plain` 유형의 JS 코드가 실행되는 것을 막습니다.',
  'shared.info.header.xFrameOptions.summary': '페이지를 iframe 요소에 넣을 수 있는지 제어합니다.',
  'shared.info.header.xFrameOptions.body1':
    '대체로 `Content-Security-Policy: frame-ancestors` 지시어로 대체되었습니다. 오래된 브라우저까지 포함하려면 전환 기간 동안 둘 다 유지하세요.',
  'shared.info.header.xFrameOptions.value.deny': '어디에도 넣을 수 없습니다.',
  'shared.info.header.xFrameOptions.value.sameorigin': '같은 출처의 페이지에만 넣을 수 있습니다.',
  'shared.info.header.xXssProtection.summary': '구식 XSS 필터 토글입니다. 현대 브라우저에서는 폐지되었습니다.',
  'shared.info.header.xXssProtection.body1':
    '권장 값은 필터를 끄는 `0`입니다 (막는 것보다 해가 더 컸습니다). 대신 CSP 헤더를 쓰세요.',
  'shared.info.header.referrerPolicy.summary':
    '나가는 탐색과 요청에서 `Referer` 헤더에 URL 주소를 어디까지 보낼지 제어합니다.',
  'shared.info.header.referrerPolicy.body1':
    '대상이 응답 헤더로 보내거나, 페이지 단위로는 `<meta>` 요소, 요청 단위로는 `referrerpolicy` 속성으로 설정합니다.',
  'shared.info.header.referrerPolicy.value.noReferrer': '리퍼러를 전혀 보내지 않습니다.',
  'shared.info.header.referrerPolicy.value.origin': '스킴과 호스트만 보냅니다.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    '기본값: 같은 출처에는 전체 URL 주소, 교차 출처에는 출처만, HTTPS→HTTP 다운그레이드에는 아무것도 보내지 않습니다.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': '항상 전체 URL 주소를 보냅니다. 피하세요.',
  'shared.info.header.permissionsPolicy.summary': '브라우저 기능 (위치 정보, 카메라, USB, 결제 등)의 허용 목록입니다.',
  'shared.info.header.permissionsPolicy.body1':
    '각 기능은 `self`, 출처 목록 또는 `*` 값으로 제한됩니다. 오래된 `Feature-Policy` 헤더를 대체합니다.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    '교차 출처 오프너 관계 (window.opener)로부터 페이지를 격리합니다.',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` 값은 crossOriginIsolated 모드를 켭니다. SharedArrayBuffer 객체와 고해상도 타이머에 필요합니다.',
  'shared.info.header.crossOriginEmbedderPolicy.summary': '불러오는 모든 하위 리소스에 교차 출처 허용을 요구합니다.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'crossOriginIsolated 모드에는 `require-corp` 값을 설정하세요. `Cross-Origin-Opener-Policy: same-origin` 헤더와 짝을 이룹니다.',
  'shared.info.header.crossOriginResourcePolicy.summary': '외부 출처가 이 리소스를 불러오지 못하게 막습니다.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    '값: `same-site`, `same-origin`, `cross-origin`. 핫링크되기를 원하지 않는 자산에 매우 중요합니다.',
  'shared.info.header.clearSiteData.summary': '이 출처의 쿠키 / 캐시 / 저장소를 지우도록 브라우저에 요청합니다.',
  'shared.info.header.clearSiteData.body1': '로그아웃 흐름에 유용합니다.',
  'shared.info.header.clearSiteData.value.cookies': '이 출처의 쿠키를 지웁니다.',
  'shared.info.header.clearSiteData.value.cache': 'HTTP 캐시와 이미지 캐시를 지웁니다.',
  'shared.info.header.clearSiteData.value.storage': 'localStorage / IndexedDB / Service Worker 등록을 지웁니다.',
  'shared.info.header.clearSiteData.value.wildcard': '모두 지웁니다.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` 값은 이 출처에 전용 에이전트 클러스터 (프로세스)를 주도록 브라우저에 요청합니다.',
  'shared.info.header.originAgentCluster.body1':
    '`SharedArrayBuffer` 객체, performance.measureUserAgentSpecificMemory 등에 더 나은 격리를 제공합니다.',
  'shared.info.header.xRobotsTag.summary': '크롤러를 위한 검색 색인 지시어입니다 (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    '`<meta name="robots">` 태그와 같은 의미지만 HTML 문서가 아닌 응답 (PDF, JSON, 이미지)에 적용됩니다.',
  'shared.info.header.xUaCompatible.summary':
    '구식 IE / Edge 지시어 (`IE=edge`)로, 렌더링 엔진을 고릅니다. 현대 브라우저에서는 폐지되었습니다.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary': '원본 서버의 소프트웨어 식별입니다 (예: `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1': '운영 환경에서는 보안상 제거하거나 고정값으로 설정하는 경우가 많습니다.',
  'shared.info.header.xPoweredBy.summary': '응답 뒤의 프레임워크 / 런타임을 식별하는 비표준 헤더입니다.',
  'shared.info.header.xPoweredBy.body1': 'Express, PHP, ASP.NET 등이 흔히 내보냅니다. 운영 환경에서는 대개 억제됩니다.',
  'shared.info.header.date.summary': '메시지가 생성된 시점의 원본 서버 타임스탬프입니다.',
  'shared.info.header.date.body1':
    '캐시가 응답 경과 시간을 계산하는 데 씁니다. 형식: IMF-fixdate (`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': '응답을 제공한 CDN 에지 / 캐시 노드를 식별합니다.',
  'shared.info.header.xServedBy.body1':
    '여러 계층이 요청을 처리했으면 쉼표로 구분됩니다 (shield → 에지). 형식은 공급업체마다 다릅니다 (Fastly POP, AWS CloudFront 에지 등).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': '서버가 응답에 붙이는 성능 지표입니다.',
  'shared.info.header.serverTiming.body1':
    'DevTools 창과 `PerformanceServerTiming` JS API 기능에 표시됩니다. 형식: `<name>;dur=<ms>[;desc="..."]`, 쉼표 구분.',
  'shared.info.header.traceparent.summary': 'W3C trace-context: 분산 추적 안의 스팬을 식별합니다.',
  'shared.info.header.traceparent.body1':
    '형식: `<version>-<trace-id>-<parent-id>-<flags>`. 서비스 사이에서 이어져 추적을 재조립할 수 있습니다.',
  'shared.info.header.tracestate.summary': '`traceparent` 헤더에 딸린 공급업체별 trace-context 정보입니다.',
  'shared.info.header.tracestate.body1':
    '쉼표로 구분된 `vendor=value` 쌍입니다. 각 추적 공급업체가 자기 상태를 여기에 저장합니다.',
  'shared.info.header.xRequestId.summary':
    '서버가 이 요청에 할당한 식별자입니다. 로그와 서비스 사이에서 그대로 전달됩니다.',
  'shared.info.header.xRequestId.body1':
    '비표준이지만 어디서나 쓰입니다. 디버깅할 때 클라이언트 동작과 서버 로그를 맞춰 보는 데 유용합니다.',
  'shared.info.header.xFastlyRequestId.summary': 'Fastly 요청 식별자입니다. Fastly 로그 / 디버깅과 맞춰 봅니다.',
  'shared.info.header.reportingEndpoints.summary':
    '브라우저가 생성하는 보고서 (CSP 위반, 사용 중단, NEL, …)의 대상에 이름을 붙입니다.',
  'shared.info.header.reportingEndpoints.body1':
    '형식: `name="https://reports.example.com", name2="https://..."`. 오래된 `Report-To` 헤더를 대체합니다.',
  'shared.info.header.reportTo.summary':
    '오래된 JSON 기반 보고 엔드포인트 선언입니다. `Reporting-Endpoints` 헤더로 대체되었습니다.',
  'shared.info.header.nel.summary':
    'Network Error Logging 정책입니다. 연결 실패와 프로토콜 오류를 받을 엔드포인트를 지정하는 JSON 설정입니다.',
  'shared.info.header.nel.body1':
    '엔드포인트는 `Reporting-Endpoints` (또는 오래된 `Report-To`) 헤더로 미리 등록되어 있어야 합니다.',
  'shared.info.header.cfRay.summary': 'Cloudflare 요청 식별자입니다. Cloudflare 로그에서 요청을 맞춰 보는 데 씁니다.',
  'shared.info.header.cfRay.body1':
    '형식: `<request-id>-<colo-id>`. colo-id 부분은 요청을 처리한 Cloudflare 데이터 센터를 식별합니다.',
} as const satisfies Catalog;
