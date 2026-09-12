/**
 * DevTools panel — inspector Cookies tab — Korean. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by
 * design: cookie names/values, Set-Cookie attribute names as titles
 * and field labels (Name / Value / Domain / Path / Expires / SameSite
 * / HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary (Unspecified /
 * None (cross-site) / Lax / Strict — rendered AND parsed, never
 * convert one side alone), the literal `Session`, `__Host-` /
 * `__Secure-` prefixes, role chips (auth? / tracking? / pref), format
 * nouns, and byte figures. Mints: On/Off projection = 켜짐/꺼짐
 * (round-trip, both sides); 폐기/거부 split — the browser 거부
 * (rejects) a Set-Cookie, the dropped chip reads 폐기됨; 서드 파티 =
 * third-party; 분할됨 = partitioned carried; 쿠키 저장소 = jar carried;
 * 역할 = role (classifier); 접두사 = prefix. Prefix prose leads with a
 * head noun (__Host- 접두사 쿠키) — never a particle onto the raw
 * token. DevTools path quotes Chrome's own ko UI (애플리케이션 →
 * 쿠키).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    '필터: 텍스트, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': '쿠키 필터',
  'panel.inspector.cookies.empty': '주고받은 쿠키가 없습니다.',

  // Table column headers. Set-Cookie attribute tokens (Domain / Path /
  // Expires / SameSite / HttpOnly / Secure) are glossary vocabulary and
  // stay raw where they label a column alone. Section headers localize
  // via the existing section.responseCookies/requestCookies keys — the
  // `label` prop stays the raw identifier.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '전송 {count}개 · {bytes} B',
  'panel.inspector.cookies.footprint.set': '설정 {count}개 · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count}개 폐기 예정',
  'panel.inspector.cookies.footprint.filteredOut': '{count}개 제외됨',
  'panel.inspector.cookies.footprint.flagged': '{count}개 표시됨',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': '쿠키 재정의',
  'panel.inspector.cookies.cta.overrideCookiesTitle': '일치하는 요청의 쿠키를 바꾸는 규칙을 만듭니다',
  'panel.inspector.cookies.cta.requestCookies': '요청 쿠키…',
  'panel.inspector.cookies.cta.requestCookiesTitle': '이 요청에서 보내는 Cookie 헤더를 교체합니다',
  'panel.inspector.cookies.cta.responseCookies': '응답 쿠키…',
  'panel.inspector.cookies.cta.responseCookiesTitle': '서버에서 돌아오는 Set-Cookie 헤더를 교체합니다',
  'panel.inspector.cookies.cta.noCookies': '쿠키를 보내지 않음…',
  'panel.inspector.cookies.cta.noCookiesTitle': 'Cookie 헤더를 완전히 제거해 서버가 쿠키를 보지 못하게 합니다',
  'panel.inspector.cookies.cta.addCookie': '쿠키 추가',
  'panel.inspector.cookies.cta.addCookieTitle': '브라우저 쿠키 저장소에 쿠키 추가 (HttpOnly 포함)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': '쿠키 재정의',
  'panel.inspector.cookies.ctaInfo.ruleKicker': '규칙',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    '실행되는 동안 일치하는 요청의 Cookie / Set-Cookie 헤더를 재작성하는 규칙을 만듭니다. 브라우저 쿠키 저장소는 건드리지 않습니다.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': '선택지',
  'panel.inspector.cookies.ctaInfo.requestLabel': '요청 쿠키',
  'panel.inspector.cookies.ctaInfo.requestDesc': '브라우저가 보내는 Cookie 헤더를 교체합니다.',
  'panel.inspector.cookies.ctaInfo.responseLabel': '응답 쿠키',
  'panel.inspector.cookies.ctaInfo.responseDesc': '서버에서 돌아오는 Set-Cookie 헤더를 교체합니다.',
  'panel.inspector.cookies.ctaInfo.noneLabel': '쿠키를 보내지 않음',
  'panel.inspector.cookies.ctaInfo.noneDesc': 'Cookie 헤더를 완전히 제거합니다. 서버에는 쿠키 없는 요청으로 보입니다.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Cookie 추가',
  'panel.inspector.cookies.ctaInfo.jarKicker': '브라우저 쿠키 저장소',
  'panel.inspector.cookies.ctaInfo.addSummary':
    '실제 쿠키를 브라우저 쿠키 저장소에 씁니다. 브라우저가 “애플리케이션 → 쿠키”에 표시하는 것과 같은 저장소입니다.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    '이 요청 이후에도 남으며, 도메인, 경로, 플래그가 일치하는 곳이면 어디든 브라우저가 붙입니다. 규칙은 관여하지 않습니다. 페이지 스크립트가 설정할 수 없는 HttpOnly 쿠키를 만드는 방법이기도 합니다. 값은 {{variable}} 참조를 받으며 저장할 때 한 번만 확인됩니다. 변수가 나중에 바뀌어도 저장소는 그 스냅샷을 유지합니다. 값이 변수를 따라가야 하면 “쿠키 재정의”를 사용하세요.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie “{name}” 항목을 저장했습니다',
  'panel.inspector.cookies.toast.saveFailed': '쿠키 “{name}” 항목을 저장할 수 없습니다',
  'panel.inspector.cookies.toast.saveFailedWithError': '쿠키 “{name}” 항목을 저장할 수 없습니다: {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie “{name}” 항목을 삭제했습니다',
  'panel.inspector.cookies.toast.deleteFailed': '쿠키 “{name}” 항목을 삭제할 수 없습니다',
  'panel.inspector.cookies.toast.mergeApplied': '병합 결과를 양식에 적용했습니다. 저장하면 브라우저에 씁니다',
  'panel.inspector.cookies.confirmDelete.title': '쿠키 “{name}” 항목을 삭제하시겠습니까?',
  'panel.inspector.cookies.confirmDelete.content':
    '브라우저 쿠키 저장소에서 제거합니다. 페이지가 더 이상 보내지 않습니다.',
  'panel.inspector.cookies.confirmDelete.ok': '삭제',

  // More filters ▾ / View ▾ — this tab's own menus (separate referents
  // from the headers tab's). Reset reuses `panel.menu.resetToDefault`.
  'panel.inspector.cookies.moreFilters.label': '추가 필터',
  'panel.inspector.cookies.moreFilters.problemsOnly': '문제 있는 것만',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': '서드 파티만',
  'panel.inspector.cookies.moreFilters.ruleOnly': '규칙으로 수정된 것만',
  'panel.inspector.cookies.moreFilters.showFilteredOut': '제외된 요청 쿠키 표시',
  'panel.inspector.cookies.view.label': '보기',
  'panel.inspector.cookies.view.sort': '정렬',
  'panel.inspector.cookies.view.sortOriginal': '원래 순서',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': '크기',
  'panel.inspector.cookies.view.sortExpires': '만료',
  'panel.inspector.cookies.view.expiresFormat': '만료',
  'panel.inspector.cookies.view.expiresRelative': '상대',
  'panel.inspector.cookies.view.expiresAbsolute': '절대',
  'panel.inspector.cookies.view.decodeValues': 'URL 인코딩된 값 디코딩',
  'panel.inspector.cookies.view.groupByRole': '역할별 그룹화 (auth / pref / tracking)',
  'panel.inspector.cookies.view.showTags': '태그 표시',
  'panel.inspector.cookies.view.showSuggestions': '제안 표시',

  // Section chrome. Column headers stay raw in the table; the visible
  // count sentence keys.
  'panel.inspector.cookies.section.responseCookies': '응답 쿠키',
  'panel.inspector.cookies.section.requestCookies': '요청 쿠키',
  'panel.inspector.cookies.section.countOf': '{total}개 중 {visible}개',

  // Role vocabulary — product classifier copy (fire-evidence badge
  // precedent: product vocabulary keys, it is not browser parity).
  'panel.inspector.cookies.role.chipAuth': 'auth?',
  'panel.inspector.cookies.role.chipTracking': 'tracking?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': '인증 및 세션',
  'panel.inspector.cookies.role.sectionFunctional': '기능',
  'panel.inspector.cookies.role.sectionPref': '환경 설정',
  'panel.inspector.cookies.role.sectionTracking': '분석 및 추적',
  'panel.inspector.cookies.role.nounAuth': '인증 / 세션',
  'panel.inspector.cookies.role.nounTracking': '분석 / 추적',
  'panel.inspector.cookies.role.nounPref': '환경 설정 / 동의',
  'panel.inspector.cookies.role.nounOther': '쿠키',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor}: {noun} 쿠키.',
  'panel.inspector.cookies.role.tooltipAuth': '인증 / 세션 쿠키로 보입니다 (추정).',
  'panel.inspector.cookies.role.tooltipTracking': '분석 / 추적 쿠키로 보입니다 (추정).',
  'panel.inspector.cookies.role.tooltipPref': '사용자 환경 설정 쿠키입니다.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': '분할됨',
  'panel.inspector.cookies.chips.partitionedTitle': '최상위 사이트로 격리됨: {key}',
  'panel.inspector.cookies.chips.thirdParty': '서드 파티',
  'panel.inspector.cookies.chips.justSet': '방금 설정됨',
  'panel.inspector.cookies.chips.justSetTitle': '이 응답에서 설정되었습니다.',
  'panel.inspector.cookies.chips.dropped': '폐기됨',
  'panel.inspector.cookies.chips.droppedTitle': '브라우저가 이 Set-Cookie 헤더를 거부합니다.',
  'panel.inspector.cookies.chips.filteredOut': '제외됨',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': '이 요청에서는 전송되지 않았습니다.',
  'panel.inspector.cookies.chips.problemTitle': '위의 제안을 보세요.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure 플래그: HTTPS 연결로만 전송됩니다.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Secure 플래그가 없습니다. SameSite=None 값에는 Secure 플래그가 필요합니다. 브라우저가 이 쿠키를 거부합니다.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix':
    'Secure 플래그가 없습니다. __Host- / __Secure- 접두사에는 Secure 플래그가 필요합니다.',
  'panel.inspector.cookies.glyphs.secureOff': 'Secure 속성이 없습니다.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly 플래그: JavaScript 코드에서 읽을 수 없습니다.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'JavaScript 코드에서 읽을 수 있습니다 (HttpOnly 플래그 없음).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict 값: 동일 사이트 탐색에서만 전송됩니다.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax 값: 교차 사이트 최상위 GET 요청에서 전송됩니다.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure':
    'SameSite=None 값에 Secure 플래그 없음. 브라우저가 거부합니다.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None 값: 모든 교차 사이트 요청에서 전송됩니다.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite 속성이 지정되지 않았습니다.',

  // Row actions + status dots + name/value tooltips. Prefix hints
  // append after the raw cookie name + blank line; the modified header
  // name (Cookie / Set-Cookie) rides the rule-dot title as a raw hole.
  'panel.inspector.cookies.row.copyValue': '값 복사',
  'panel.inspector.cookies.row.copied': '복사됨',
  'panel.inspector.cookies.row.override': '재정의',
  'panel.inspector.cookies.row.overrideSetCookieTitle': '이 Set-Cookie 헤더를 재정의하는 규칙 만들기',
  'panel.inspector.cookies.row.overrideCookieTitle': '이 Cookie 값을 재정의하는 규칙 만들기',
  'panel.inspector.cookies.row.editCookieTitle': '브라우저 쿠키 저장소에서 이 쿠키 편집',
  'panel.inspector.cookies.row.editCookieAria': '쿠키 편집',
  'panel.inspector.cookies.row.deleteCookieTitle': '브라우저 쿠키 저장소에서 이 쿠키 삭제',
  'panel.inspector.cookies.row.deleteCookieAria': '쿠키 삭제',
  'panel.inspector.cookies.row.ruleDotTitle': '규칙이 이 요청의 {header} 헤더를 수정합니다',
  'panel.inspector.cookies.row.ruleDotAria': '규칙 적용 중',
  'panel.inspector.cookies.row.editedDotTitle': '이 패널에서 편집됨',
  'panel.inspector.cookies.row.editedDotAria': '편집됨',
  'panel.inspector.cookies.row.hostPrefixHint':
    '__Host- 접두사는 이 쿠키를 호스트 하나에 고정합니다. 브라우저가 Secure 플래그, Path=/ 값, Domain 속성 없음을 강제합니다. 이 중 하나라도 어기는 Set-Cookie 줄은 거부됩니다.',
  'panel.inspector.cookies.row.securePrefixHint':
    '__Secure- 접두사는 이 쿠키를 Secure 플래그 (HTTPS 전용)로 강제합니다. Secure 플래그가 없는 Set-Cookie 줄은 거부됩니다.',
  'panel.inspector.cookies.row.editedValueTitle': '편집됨. 요청이 실은 값: {value}',
  'panel.inspector.cookies.row.valueNoteResponse': '이 응답이 설정한 값: {value}. 저장소 값은 그 뒤로 바뀌었습니다.',
  'panel.inspector.cookies.row.valueNoteRequest': '이 요청이 보낸 값: {value}. 저장소 값은 그 뒤로 바뀌었습니다.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': '상태',
  'panel.inspector.cookies.statusRail.summary': '사각형은 브라우저의 원래 상태가 아닌 쿠키를 표시합니다.',
  'panel.inspector.cookies.statusRail.colorsHeading': '사각형 색상',
  'panel.inspector.cookies.statusRail.blue': '파랑',
  'panel.inspector.cookies.statusRail.blueDesc':
    '이 요청에서 실행된 규칙이 이 방향의 Cookie / Set-Cookie 헤더를 수정합니다.',
  'panel.inspector.cookies.statusRail.grey': '회색',
  'panel.inspector.cookies.statusRail.greyDesc': '이 세션 중에 이 패널에서 추가하거나 편집했습니다.',

  // Add / edit popover. Title reuses the toolbar CTA (names-its-
  // control). The SameSite labels, On/Off flag words and the Session
  // expires word are ROUND-TRIP vocabulary: the conflict projection
  // renders them and the merge dialog parses them back, so display and
  // parse read the same keys (cookie-edit.ts is t-first on both sides).
  'panel.inspector.cookies.edit.editTitle': '쿠키 편집',
  'panel.inspector.cookies.edit.valueChanged': '값 변경됨',
  'panel.inspector.cookies.edit.goneNote':
    '양식이 열린 동안 이 쿠키가 브라우저에서 삭제되었습니다. 저장하면 다시 씁니다.',
  'panel.inspector.cookies.edit.openInTab': '새 탭에서 열기',
  'panel.inspector.cookies.edit.openDirtyTitle':
    '먼저 편집을 저장하거나 취소하세요. 문서는 브라우저 쿠키 저장소에서 열립니다',
  'panel.inspector.cookies.edit.openTitle': '이 쿠키를 문서 탭으로 열기',
  'panel.inspector.cookies.edit.save': '저장',
  'panel.inspector.cookies.edit.unresolved': '확인되지 않습니다. 변수를 만들거나 참조를 고치세요.',
  'panel.inspector.cookies.edit.writes': '쓸 값: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': '쿠키 이름',
  'panel.inspector.cookies.edit.valuePlaceholder': '값 또는 {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': '날짜 지정',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': '켜짐',
  'panel.inspector.cookies.edit.flagOff': '꺼짐',
  // Pre-write constraint sentences — the __Host- / __Secure- prefixes
  // and path “/” ride raw inside; the SameSite label feeds through a
  // hole so the sentence can never drift from the select option.
  'panel.inspector.cookies.edit.constraint.hostSecure': '__Host- 접두사 쿠키는 Secure 플래그가 켜져 있어야 합니다.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    '__Host- 접두사 쿠키는 Domain 속성을 가질 수 없습니다. “Host only”를 켜세요.',
  'panel.inspector.cookies.edit.constraint.hostPath': '__Host- 접두사 쿠키는 경로 “/”를 사용해야 합니다.',
  'panel.inspector.cookies.edit.constraint.securePrefix': '__Secure- 접두사 쿠키는 Secure 플래그가 켜져 있어야 합니다.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite “{label}” 값에는 Secure 플래그가 필요합니다.',
  // Merge parse-back errors — rendered inline in the merge modal. The
  // quoted field names are the JSON projection's raw keys; the quoted
  // vocabulary words feed through holes from the keys above.
  'panel.inspector.cookies.edit.merge.invalidJson':
    '병합 결과가 유효한 JSON 형식이 아닙니다. 구문을 고치고 병합을 다시 완료하세요.',
  'panel.inspector.cookies.edit.merge.notObject': '병합 결과는 쿠키 필드를 가진 JSON 객체여야 합니다.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" 필드는 문자열로 있어야 합니다.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" 필드는 "{on}" 또는 "{off}" 값이어야 합니다.',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" 필드는 {labels} 중 하나여야 합니다.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    '"expires" 필드는 "{session}" 값이거나 2026-07-09T14:30 같은 날짜여야 합니다.',

  // Edit-form field (i) corpus — titles are the raw attribute names;
  // the shared template note keys once and composes with ' '.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Set-Cookie 예시',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Cookie 필드',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Cookie 플래그',
  'panel.inspector.cookies.fieldInfo.templateNote':
    '{{variable}} 참조를 받으며 저장할 때 한 번만 확인됩니다. 저장소에는 확인된 텍스트가 저장됩니다.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    '쿠키 식별자입니다. 브라우저는 (name, domain, path)를 키로 삼습니다. 이름이 같아도 범위가 다르면 별개의 쿠키입니다.',
  'panel.inspector.cookies.fieldInfo.name.description':
    '접두사는 브라우저가 강제합니다. __Host- 접두사는 Secure 플래그, Path=/ 값, Domain 속성 없음을, __Secure- 접두사는 Secure 플래그를 요구합니다.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    '쿠키 페이로드입니다. 브라우저가 Cookie 헤더로 되돌려 보내는 내용입니다.',
  'panel.inspector.cookies.fieldInfo.value.description':
    '값은 스냅샷입니다. 변수가 나중에 바뀌어도 저장소는 이 텍스트를 유지합니다. 값이 변수를 따라가야 하면 “쿠키 재정의” 규칙을 사용하세요.',
  'panel.inspector.cookies.fieldInfo.domain.summary': '어떤 호스트가 쿠키를 받는지입니다.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'openheaders.com 같은 일반 도메인은 하위 도메인을 포함합니다 (브라우저는 앞에 점을 붙여 저장). Host-only 옵션을 켜면 쿠키가 정확히 이 호스트에 고정됩니다.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    '쿠키가 실리는 URL 경로 접두사입니다. /api 경로이면 /api 아래의 요청만 쿠키를 실어 보냅니다.',
  'panel.inspector.cookies.fieldInfo.path.description': '기본값은 / 경로입니다.',
  'panel.inspector.cookies.fieldInfo.expires.summary': '브라우저가 쿠키를 삭제하는 시점입니다.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Session 쿠키는 브라우저 세션이 끝날 때까지 삽니다. “날짜 지정”은 절대 만료 시점을 설정합니다 (Expires 속성으로 저장).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': '교차 사이트 요청이 언제 쿠키를 실을 수 있는지입니다.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': '값',
  'panel.inspector.cookies.fieldInfo.samesite.strict': '동일 사이트 요청만.',
  'panel.inspector.cookies.fieldInfo.samesite.lax': '동일 사이트에 더해 최상위 교차 사이트 탐색 (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none':
    '교차 사이트에서도 전송됩니다. 브라우저는 Secure 플래그를 함께 요구합니다.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified':
    '브라우저 기본값입니다 (Chrome 브라우저에서는 Lax 값으로 취급).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    '페이지 JavaScript 코드에서 쿠키를 숨깁니다. document.cookie 속성으로 읽거나 덮어쓸 수 없습니다.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'HttpOnly 쿠키는 서버 (Set-Cookie)와 이 편집기만 만들 수 있고 페이지 스크립트는 만들 수 없습니다. 세션 token 값의 표준 강화 수단입니다.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    '쿠키가 HTTPS 연결로만 이동합니다. 일반 http 요청은 절대 싣지 않습니다.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'SameSite=None 값과 __Host- / __Secure- 이름 접두사에 필요합니다.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    '쿠키를 정확히 Domain 호스트에 고정합니다. 하위 도메인은 받지 않습니다.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    '끄면 쿠키가 도메인 전체 (앞에 점 형식)로 저장되어 하위 도메인으로도 흘러갑니다. 서버가 Domain 속성을 생략하면 브라우저 자체 쿠키는 host-only 상태가 됩니다.',

  // Column (i) corpus — column-name titles stay raw; the Sec cell's
  // long title keys whole (glyph letters ride inside).
  'panel.inspector.cookies.columnInfo.name.summary':
    '쿠키 식별자입니다. 브라우저는 (name, domain, path)를 키로 삼습니다. 이름이 같고 범위가 다른 두 쿠키는 별개입니다.',
  'panel.inspector.cookies.columnInfo.name.description':
    '오른쪽 칩은 어느 열에도 없는 정보를 드러냅니다. 이름 옆에 나타나며, 행에 마우스를 올리면 값 위에 “재정의” 동작이 보입니다.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': '역할 (추정)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    '인증 / 세션 쿠키로 보입니다. 이름이 sess / session / auth / sid / token / csrf / xsrf 중 하나와 일치하거나, HttpOnly 플래그가 있고 긴 무작위 값을 가진 쿠키입니다.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    '분석 / 추적 쿠키로 보입니다. 이름이 알려진 추적기 (_ga, _gid, _fbp, NID, IDE, MUID, _hjid 등)와 일치하거나, 다른 분류가 없는 서드 파티 쿠키입니다.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    '사용자 환경 설정 쿠키입니다. tz, lang, locale, theme, color-mode, currency, cpu-bucket, font-size 등.',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': '수명 주기',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    '이 응답에 Set-Cookie 헤더가 도착했고 브라우저가 수락했습니다.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Set-Cookie 헤더가 도착했지만 브라우저가 거부합니다. Secure 플래그 없는 SameSite=None 값, __Host- 접두사 위반, Secure 플래그 없는 __Secure- 접두사, Secure 플래그 없는 Partitioned 속성 같은 규칙에 걸렸습니다.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    '저장소에는 이 쿠키가 있지만 이 요청에서는 전송되지 않았습니다 (경로 불일치, http 연결에서 Secure 플래그, 만료, SameSite 제한 등). “제외된 요청 쿠키 표시”가 켜져 있을 때만 나타납니다.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': '컨텍스트',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    '쿠키 도메인이 페이지 최상위 프레임 출처와 교차 사이트 관계입니다.',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'CHIPS 방식 격리입니다. 쿠키가 자체 범위에 더해 최상위 사이트로도 키가 지정됩니다. 마우스를 올리면 파티션 키가 보입니다.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    '이 쿠키가 인사이트 (탭 위쪽의 경고 카드)를 유발했습니다. 이유는 그 안내를 보세요.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': '접두사 (이름에 표시)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    '호스트 고정입니다. 브라우저가 Secure 플래그, Path=/ 값, Domain 속성 없음을 강제합니다. 위반은 거부됩니다.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'HTTPS 전용입니다. 브라우저가 Secure 플래그를 강제합니다. 위반은 거부됩니다.',
  'panel.inspector.cookies.columnInfo.value.summary':
    '쿠키 페이로드입니다. 값에 구조가 있으면 행을 클릭해 파싱된 보기 패널을 펼칠 수 있습니다.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': '자동 감지 형식',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'base64url 조각 세 개입니다. header와 payload는 디코딩되고 exp / iat / nbf 클레임은 상대 시간으로 표시됩니다.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc': '펼침 영역에서 정리해 표시합니다 (URL 디코딩 후에도 동작).',
  'panel.inspector.cookies.columnInfo.value.b64Desc':
    '일반 base64 형식입니다. 인쇄 가능하면 디코딩된 본문을 표시합니다.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    '퍼센트 인코딩된 텍스트입니다. “보기”에서 “URL 인코딩된 값 디코딩”을 켜면 디코딩 결과를 인라인으로 표시합니다.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    '브라우저가 이 쿠키를 붙이는 위치입니다. Domain 값과 Path 값을 합친 것입니다.',
  'panel.inspector.cookies.columnInfo.scope.description':
    '도메인 앞의 점 (예: `.openheaders.com`)은 하위 도메인이 포함된다는 뜻입니다. `/api` 같은 뒤쪽 경로는 그 경로 아래의 요청에서만 쿠키가 전송된다는 뜻입니다.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    '브라우저가 이 쿠키 전송을 멈추는 시점입니다. 색이 긴급도를 나타냅니다.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': '색 읽기',
  'panel.inspector.cookies.columnInfo.expires.red': '빨강',
  'panel.inspector.cookies.columnInfo.expires.redDesc': '이미 만료되었거나 1시간 안에 만료됩니다.',
  'panel.inspector.cookies.columnInfo.expires.yellow': '노랑',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': '24시간 안에 만료됩니다.',
  'panel.inspector.cookies.columnInfo.expires.plain': '기본',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': '미래입니다. 하루 넘게 남았습니다.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Expires / Max-Age 속성 없음. 세션이 끝나면 브라우저가 폐기합니다.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': '형식',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': '상대 (기본)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '“in 7mo”, “30s ago”처럼 지금 기준입니다. 마우스를 올리면 절대 날짜가 보입니다.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': '절대',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'UTC 날짜입니다. “보기 → 만료”에서 전환합니다.',
  'panel.inspector.cookies.columnInfo.size.summary':
    '직렬화된 쿠키 크기 (바이트)입니다. `name=value` 길이이며 요청별 페이로드 합계에 쓰입니다.',
  'panel.inspector.cookies.columnInfo.size.description':
    '대부분의 서버와 중간 장비는 Cookie 헤더 전체를 4 KB로 제한합니다. 너무 큰 페이로드는 분명한 오류 없이 4xx / 5xx 응답을 일으킬 수 있습니다.',
  'panel.inspector.cookies.columnInfo.sec.title': '보안 (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    '글리프 세 개가 Secure / HttpOnly / SameSite 속성을 셀 하나로 모읍니다. 색이 의미를 나타냅니다.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': '글리프',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure 플래그: HTTPS 연결로만 전송됩니다.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly 플래그: JavaScript 코드에서 읽을 수 없습니다.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'SameSite 제한 (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': '색',
  'panel.inspector.cookies.columnInfo.sec.green': '초록',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': '켜짐 / strict 값. 단단히 잠겨 있습니다.',
  'panel.inspector.cookies.columnInfo.sec.yellow': '노랑',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax 값: 최상위 교차 사이트 GET 요청에서 전송됩니다.',
  'panel.inspector.cookies.columnInfo.sec.red': '빨강',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    '필요한 곳에 없습니다 (Secure 플래그 없는 SameSite=None 값, Secure 플래그 없는 __Host- 접두사 등). 브라우저가 거부합니다.',
  'panel.inspector.cookies.columnInfo.sec.gray': '회색',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': '꺼짐 / 지정 안 됨.',

  // Cookie insights (t-fed `computeCookieInsights`). Names, origins,
  // byte figures and attribute vocabulary ride as raw holes / inline.
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), { other: '쿠키 {count}개가 SameSite=None 값으로 설정되었지만 Secure 플래그가 없음' }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    '최신 브라우저는 Secure 플래그가 없는 SameSite=None 쿠키를 거부합니다. 저장되지 않습니다.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Secure 속성 추가',
  'panel.inspector.cookies.insights.hostPrefix.title': '{names}에서 __Host- 접두사 위반',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    '__Host- 접두사 쿠키는 Secure 플래그, Path=/ 값이어야 하고 Domain 속성이 없어야 합니다. 아니면 브라우저가 거부합니다.',
  'panel.inspector.cookies.insights.securePrefix.title': '{names}에서 __Secure- 접두사 위반',
  'panel.inspector.cookies.insights.securePrefix.detail':
    '__Secure- 접두사 쿠키는 Secure 속성을 가져야 합니다. 아니면 브라우저가 거부합니다.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'Partitioned 쿠키 {count}개에 Secure 플래그 없음' }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Partitioned 쿠키는 Secure 플래그가 있어야 합니다.',
  'panel.inspector.cookies.insights.setOnHttp.title': '일반 HTTP 연결로 설정된 쿠키',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    '이 쿠키는 경로상의 누구나 관찰하고 재전송할 수 있습니다. HTTPS 연결과 Secure 속성을 사용하세요.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), { other: '만료된 쿠키 {count}개가 아직 전송되고 있음' }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    '이 쿠키는 만료 시점이 과거인데도 요청이 실어 보냈습니다. 저장소가 곧 폐기합니다.',
  'panel.inspector.cookies.insights.oversized.title': 'Cookie 헤더가 {bytes}B (일반적 한도 4KB 초과)',
  'panel.inspector.cookies.insights.oversized.detail':
    '서버와 중간 장비는 헤더 크기를 제한합니다. 너무 큰 Cookie 페이로드는 분명한 오류 없이 4xx / 5xx 응답을 일으킬 수 있습니다.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), { other: '서드 파티 쿠키 {count}개 설정됨' }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), { other: '서드 파티 쿠키 {count}개 설정됨' });
    return `${String(origin)} 출처에서 ${lead}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    '최신 브라우저는 Partitioned 속성으로 CHIPS 방식에 참여하지 않는 한 교차 사이트 컨텍스트에서 이를 차단할 수 있습니다.',
} as const satisfies Catalog;
