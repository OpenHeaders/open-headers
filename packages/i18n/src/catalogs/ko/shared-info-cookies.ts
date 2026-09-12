/**
 * Shared info-popover corpus — Set-Cookie attributes, Korean. Mirrors
 * `catalogs/en/shared-info-cookies.ts` key for key; attribute names
 * (Domain / Path / Expires / Max-Age / SameSite / Secure …) ride raw
 * with a head noun 속성 where a particle follows. Mints: 쿠키 = the
 * prose cookie (en lowercase; `Cookie` the header stays raw); 쿠키
 * 저장소 = cookie jar; 교차 사이트 = cross-site; 최상위 탐색 = top-level
 * navigation; 서드파티 = third-party.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Set-Cookie 속성',
  'shared.info.cookie.fallbackSummary': '이 속성은 저희 레지스트리에 문서화되어 있지 않습니다.',
  'shared.info.cookie.fallbackDescription':
    '공급업체별 또는 실험적인 Set-Cookie 확장일 수 있습니다. 브라우저는 인식하지 못하는 속성을 무시합니다.',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary': '쿠키가 전송되는 호스트입니다. 설정하면 하위 도메인도 포함됩니다.',
  'shared.info.cookie.domain.body':
    'Domain 속성이 없으면 쿠키는 응답한 호스트에만 정확히 한정되며 하위 도메인은 제외됩니다.',
  'shared.info.cookie.path.summary': '브라우저가 쿠키를 보내려면 URL 경로에 있어야 하는 접두사입니다.',
  'shared.info.cookie.expires.summary': '절대 만료 일시입니다. 쿠키는 이 시점까지 유지됩니다.',
  'shared.info.cookie.expires.body':
    'Expires 또는 Max-Age 속성이 없으면 세션 쿠키가 되어 브라우저 세션이 끝날 때 폐기됩니다.',
  'shared.info.cookie.maxAge.summary': '수신 시점부터의 수명(초)입니다. 둘 다 있으면 Expires 속성보다 우선합니다.',
  'shared.info.cookie.maxAge.body': '0 또는 음수이면 쿠키가 즉시 만료됩니다. 쿠키를 삭제하는 표준 방법입니다.',
  'shared.info.cookie.secure.summary': '쿠키가 HTTPS 연결에서만 전송됩니다.',
  'shared.info.cookie.secure.body':
    'SameSite=None 쿠키에 필수입니다. 브라우저는 이 속성이 없는 교차 사이트 쿠키를 거부합니다.',
  'shared.info.cookie.httponly.summary':
    '쿠키가 페이지 JavaScript 코드(document.cookie)에 보이지 않습니다. 요청에만 실립니다.',
  'shared.info.cookie.httponly.body': '스크립트 삽입을 통한 세션 토큰 탈취에 대한 표준 방어책입니다.',
  'shared.info.cookie.samesite.summary': '쿠키가 교차 사이트 요청에 실리는지 제어합니다: Strict, Lax 또는 None.',
  'shared.info.cookie.samesite.body':
    'Strict: 동일 사이트만. Lax (기본값): 최상위 탐색도 포함. None: 모든 곳, 단 Secure 속성 필요.',
  'shared.info.cookie.partitioned.summary':
    '쿠키를 최상위 사이트별로 저장합니다 (CHIPS). 사이트 간 추적이 불가능한 서드파티 쿠키입니다.',
  'shared.info.cookie.priority.summary':
    '쿠키 저장소가 가득 찼을 때를 위한 Chromium 전용 제거 우선순위 힌트 (Low / Medium / High)입니다.',
} as const satisfies Catalog;
