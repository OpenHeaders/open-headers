/**
 * Shared info-popover corpus — HTTP status codes — Korean. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes, canonical
 * reason phrases and header names (Location, Range, WWW-Authenticate,
 * …) stay raw — only prose translates. Mints: 이유 구문 = reason
 * phrase (carried from panel-network); 리디렉션 = redirection;
 * 게이트웨이 = gateway; 업스트림 서버 = upstream server; 속도 제한 =
 * rate limit; 캡티브 포털 = captive portal; 표현 = representation
 * (content negotiation); 조건부 요청 = conditional request; the Body /
 * Authorization tab names ride raw with 탭 as head noun (zh-CN
 * precedent). Every raw header name takes 헤더 before a particle.
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'HTTP 상태 · {range}',
  'shared.info.status.undocumented':
    '이 코드 자체는 레지스트리에 문서화되어 있지 않습니다. 위의 범위가 표준 의미입니다.',
  'shared.info.status.serverPhrase': '서버가 이유 구문 “{statusText}”을 보냈습니다.',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx 정보',
  'shared.info.status.range1xx.fallback': '중간 응답입니다. 교환이 아직 진행 중이며 최종 상태가 뒤따릅니다.',
  'shared.info.status.range2xx.kicker': '2xx 성공',
  'shared.info.status.range2xx.fallback': '요청이 수신되고 이해되고 수락되었습니다.',
  'shared.info.status.range3xx.kicker': '3xx 리디렉션',
  'shared.info.status.range3xx.fallback': '요청을 완료하려면 추가 조치가 필요합니다. Location 응답 헤더를 보세요.',
  'shared.info.status.range4xx.kicker': '4xx 클라이언트 오류',
  'shared.info.status.range4xx.fallback': '서버가 보낸 그대로의 요청을 거부했습니다. 요청의 무언가를 바꿔야 합니다.',
  'shared.info.status.range5xx.kicker': '5xx 서버 오류',
  'shared.info.status.range5xx.fallback':
    '서버가 겉보기에 유효한 요청을 처리하지 못했습니다. 잘못은 서버 쪽에 있습니다.',
  'shared.info.status.rangeOther.kicker': '비표준',
  'shared.info.status.rangeOther.fallback': '이 코드는 표준 HTTP 상태 범위 밖입니다.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    '중간 응답입니다. 서버가 요청 헤더를 받았으며 클라이언트는 본문 전송을 계속해야 합니다.',
  'shared.info.status.s101.summary':
    '서버가 Upgrade 헤더로 요청된 프로토콜 전환 (예: WebSocket 연결로)에 동의했습니다.',
  'shared.info.status.s102.summary': '중간 WebDAV 응답입니다. 서버가 요청을 수락했지만 아직 완료하지 않았습니다.',
  'shared.info.status.s103.summary': '최종 응답에 앞서 헤더 (보통 Link 프리로드)를 실어 보내는 중간 응답입니다.',
  'shared.info.status.s200.summary': '요청이 성공했고 응답 본문에 결과가 실려 있습니다.',
  'shared.info.status.s201.summary': '요청이 성공했고 새 리소스가 만들어졌습니다.',
  'shared.info.status.s201.body': 'Location 응답 헤더가 보통 새 리소스를 가리킵니다.',
  'shared.info.status.s202.summary': '요청이 처리를 위해 수락되었지만 처리가 아직 끝나지 않았습니다.',
  'shared.info.status.s202.body':
    '비동기 작업에 흔합니다. 결과는 나중에 가져와야 하며, 보통 본문 안의 상태 URL 주소를 통해서입니다.',
  'shared.info.status.s203.summary': '응답은 성공했지만 서버와 클라이언트 사이의 변환 프록시가 수정했습니다.',
  'shared.info.status.s204.summary': '요청이 성공했고 응답 본문이 의도적으로 없습니다.',
  'shared.info.status.s204.body': '여기서 Body 탭이 비어 있는 것은 정상이며 오류가 아닙니다.',
  'shared.info.status.s205.summary':
    '요청이 성공했고 클라이언트는 요청을 보낸 보기를 재설정해야 합니다 (예: 양식 지우기).',
  'shared.info.status.s206.summary': '서버가 Range 요청 헤더로 요청된 바이트 범위만 반환했습니다.',
  'shared.info.status.s206.body': 'Content-Range 헤더가 이 본문이 전체 리소스의 어느 조각인지 알려 줍니다.',
  'shared.info.status.s207.summary': 'WebDAV 일괄 응답입니다. 본문이 각 하위 작업의 상태를 따로 실어 보냅니다.',
  'shared.info.status.s208.summary':
    'WebDAV 응답입니다. 이 구성원은 같은 multi-status 응답에서 이미 앞서 나열되었습니다.',
  'shared.info.status.s226.summary': '응답은 이전 버전에 대한 차이 (instance manipulation)이며 전체 리소스가 아닙니다.',
  'shared.info.status.s300.summary': '표현이 둘 이상 있으며 서버가 하나를 고르지 않습니다.',
  'shared.info.status.s301.summary': '리소스가 Location 헤더의 URL 주소로 영구히 이동했습니다.',
  'shared.info.status.s301.body': '클라이언트와 캐시가 이를 기억합니다. 요청 URL 주소를 새 주소로 바꾸세요.',
  'shared.info.status.s302.summary': '리소스가 일시적으로 Location 헤더의 URL 주소에 있습니다.',
  'shared.info.status.s302.body':
    '브라우저는 따라갈 때 메서드를 GET 방식으로 바꾸는 일이 흔합니다. 메서드를 유지하려면 307 코드를 쓰세요.',
  'shared.info.status.s303.summary': '결과가 Location 헤더의 URL 주소에 있으며 GET 방식으로 가져와야 합니다.',
  'shared.info.status.s303.body': 'POST 요청 뒤에 흔하며, 만들어진 페이지나 결과 페이지로 리디렉션합니다.',
  'shared.info.status.s304.summary': '캐시된 사본이 아직 유효합니다. 서버가 일부러 본문을 보내지 않았습니다.',
  'shared.info.status.s304.body': '조건부 요청 (If-None-Match / If-Modified-Since)에 대한 답으로 전송됩니다.',
  'shared.info.status.s305.summary':
    '사용 중단된 코드입니다. 리소스에는 Location 헤더의 프록시를 통해 접근해야 합니다. 최신 클라이언트는 무시합니다.',
  'shared.info.status.s307.summary':
    '일시적으로 Location 헤더의 URL 주소에 있습니다. 따라갈 때 메서드와 본문을 유지해야 합니다.',
  'shared.info.status.s308.summary':
    '영구히 Location 헤더의 URL 주소에 있습니다. 따라갈 때 메서드와 본문을 유지해야 합니다.',
  'shared.info.status.s400.summary': '서버가 보낸 그대로의 요청을 파싱하거나 수락할 수 없었습니다.',
  'shared.info.status.s400.body':
    '본문 구문, 쿼리 매개변수, 필수 헤더를 확인하세요. 응답 본문이 문제의 필드를 알려 주는 경우가 많습니다.',
  'shared.info.status.s401.summary': '요청에 유효한 인증 자격 증명이 없습니다.',
  'shared.info.status.s401.body':
    'WWW-Authenticate 응답 헤더가 기대되는 스킴을 알려 줍니다. Authorization 탭 / token 값의 신선도를 확인하세요.',
  'shared.info.status.s402.summary': '예약된 코드입니다. 일부 API 서비스가 할당량이나 결제 한도에 사용합니다.',
  'shared.info.status.s403.summary': '서버가 요청과 자격 증명을 이해했지만 허용을 거부합니다.',
  'shared.info.status.s403.body':
    '401 코드와 달리 다시 인증해도 도움이 되지 않습니다. 이 신원에는 이 리소스에 대한 권한이 없습니다.',
  'shared.info.status.s404.summary': '이 URL 주소에 리소스가 없습니다 (또는 서버가 존재 여부를 숨깁니다).',
  'shared.info.status.s404.body':
    '경로와 그 안의 ID 값을 확인하세요. 존재를 드러내지 않으려고 403 대신 404 코드를 반환하는 API 서비스도 있습니다.',
  'shared.info.status.s405.summary': '리소스는 있지만 이 HTTP 메서드에는 해당하지 않습니다.',
  'shared.info.status.s405.body': 'Allow 응답 헤더가 이 URL 주소가 받는 메서드를 나열합니다.',
  'shared.info.status.s406.summary': '서버가 요청의 Accept 헤더와 맞는 표현을 만들 수 없습니다.',
  'shared.info.status.s407.summary':
    '사용자와 서버 사이의 프록시가 자격 증명을 요구합니다 (Proxy-Authenticate 헤더가 스킴을 알려 줌).',
  'shared.info.status.s408.summary': '서버가 요청의 나머지를 기다리기를 포기하고 교환을 닫았습니다.',
  'shared.info.status.s409.summary': '요청이 리소스의 현재 상태와 충돌합니다.',
  'shared.info.status.s409.body': '동시 편집이나 중복 생성에 흔합니다. 리소스를 다시 읽고 다시 시도하세요.',
  'shared.info.status.s410.summary': '리소스가 있었지만 의도적으로 영구히 제거되었습니다.',
  'shared.info.status.s411.summary':
    '서버가 Content-Length 헤더를 요구하며 청크 분할되거나 크기 없는 본문을 거부합니다.',
  'shared.info.status.s412.summary':
    '조건부 헤더 (If-Match, If-Unmodified-Since 등)가 성립하지 않아 서버가 실행을 거부했습니다.',
  'shared.info.status.s413.summary': '요청 본문이 서버가 받는 크기를 넘습니다.',
  'shared.info.status.s414.summary':
    '요청 URL 주소가 서버 제한을 넘습니다. 보통 본문에 들어가야 할 쿼리 문자열 데이터입니다.',
  'shared.info.status.s415.summary': '서버가 본문 형식을 거부합니다.',
  'shared.info.status.s415.body': 'Content-Type 요청 헤더를 API 서비스가 기대하는 것과 대조하세요.',
  'shared.info.status.s416.summary': 'Range 요청 헤더가 리소스 밖의 바이트를 요구합니다.',
  'shared.info.status.s417.summary': '서버가 Expect 요청 헤더 (보통 Expect: 100-continue)를 충족할 수 없습니다.',
  'shared.info.status.s418.summary': '만우절 RFC 문서의 코드입니다. 일부 API 서비스가 장난스러운 거부에 사용합니다.',
  'shared.info.status.s421.summary':
    '요청이 이 권한 영역에 응답하도록 구성되지 않은 서버에 도달했습니다 (재사용된 HTTP/2 연결에서 흔함).',
  'shared.info.status.s422.summary': '본문이 구문상으로는 유효하지만 의미상 잘못되었습니다. 검증에 실패했습니다.',
  'shared.info.status.s422.body': '응답 본문이 보통 필드별 검증 오류를 나열합니다.',
  'shared.info.status.s423.summary': 'WebDAV 응답입니다. 리소스가 다른 작업에 잠겨 있습니다.',
  'shared.info.status.s424.summary': 'WebDAV 응답입니다. 의존하던 앞선 작업이 실패해 이 작업도 실패했습니다.',
  'shared.info.status.s425.summary': '서버가 재전송될 수 있는 요청 (TLS early data)의 처리를 거부합니다.',
  'shared.info.status.s426.summary': '서버가 다른 프로토콜을 고집합니다. Upgrade 응답 헤더가 그것을 알려 줍니다.',
  'shared.info.status.s428.summary': '서버가 업데이트 유실을 막기 위해 조건부 헤더 (보통 If-Match)를 요구합니다.',
  'shared.info.status.s429.summary': '속도 제한에 걸렸습니다. 속도를 늦추세요.',
  'shared.info.status.s429.body':
    'Retry-After 응답 헤더 (있으면)가 얼마나 기다릴지 알려 줍니다. RateLimit-* 헤더를 보내는 API 서비스도 많습니다.',
  'shared.info.status.s431.summary':
    '요청 헤더 하나 (또는 전체 합)가 서버의 크기 제한을 넘습니다. 너무 큰 쿠키가 원인인 경우가 많습니다.',
  'shared.info.status.s451.summary': '서버가 법적 이유 (검열, 법원 명령, GDPR 삭제 요청)로 접근을 거부합니다.',
  'shared.info.status.s500.summary': '서버가 예기치 않은 상황을 만났습니다. 실패는 서버 쪽에 있습니다.',
  'shared.info.status.s500.body':
    '일시적인 문제라면 다시 시도하면 될 수 있습니다. 아니면 고칠 곳은 요청이 아니라 서버 로그입니다.',
  'shared.info.status.s501.summary':
    '서버가 필요한 기능을 지원하지 않습니다. 인식하지 못하는 메서드인 경우가 많습니다.',
  'shared.info.status.s502.summary': '게이트웨이나 프록시가 업스트림 서버에서 잘못된 응답을 받았습니다.',
  'shared.info.status.s502.body': '프록시 뒤의 원본 서버가 장애 중이거나 도달할 수 없습니다. 보통 일시적입니다.',
  'shared.info.status.s503.summary': '서버가 일시적으로 요청을 처리할 수 없습니다 (과부하 또는 점검).',
  'shared.info.status.s503.body': 'Retry-After 헤더 (있으면)가 언제 다시 시도할지 알려 줍니다.',
  'shared.info.status.s504.summary': '게이트웨이나 프록시가 업스트림 서버를 기다리다 시간이 초과되었습니다.',
  'shared.info.status.s505.summary': '서버가 요청에 쓰인 HTTP 프로토콜 버전을 거부합니다.',
  'shared.info.status.s506.summary': '콘텐츠 협상의 서버 구성 오류입니다. 선택된 변형이 스스로 협상 대상이 됩니다.',
  'shared.info.status.s507.summary': 'WebDAV 응답입니다. 서버가 요청에 필요한 내용을 저장할 수 없습니다.',
  'shared.info.status.s508.summary': 'WebDAV 응답입니다. 서버가 요청을 처리하다 무한 루프를 발견했습니다.',
  'shared.info.status.s510.summary': '서버가 요청을 처리하려면 추가 확장이 필요합니다.',
  'shared.info.status.s511.summary': '네트워크 (보통 캡티브 포털)가 접근을 허용하기 전에 인증을 요구합니다.',
} as const satisfies Catalog;
