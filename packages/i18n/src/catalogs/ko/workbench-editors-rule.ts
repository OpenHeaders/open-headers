/**
 * Workbench editors — the rule editor — Korean. Mirrors
 * `catalogs/en/workbench-editors-rule.ts` key for key. The quick
 * editor reuses the `workbench.editors.rule.fields.*` keys directly
 * (S35 field-key reuse law) — field labels here stay consistent with
 * `ko/panel-quick-editor.ts` (op nouns 삽입 / 재정의 / 덧붙이기 / 병합 /
 * 제거, 모두 제거, the Mock raw tag + 수정 = Modify). Rule-type kickers
 * reuse the -규칙 family from workbench-chrome (헤더 규칙 / 차단 규칙 /
 * 리디렉션 규칙 / 쿼리 매개변수 규칙 / 삽입 규칙 / 지연 규칙 / 요청 본문
 * 규칙 / 응답 규칙 / WebSocket 규칙 / SSE 규칙 / 인증 규칙). MINTS:
 * 템플릿 = template (사용자 템플릿 = user template); 편집기 헤더 = the
 * editor header bar (S19 separate referent — 헤더 부분 the JWT segment
 * and HTTP 헤더 unchanged); 추가 / 바꾸기 = Add / Replace and 바꾸기만 =
 * Replace Only (the header-plane op — 재정의 stays the hover-snapshot
 * op noun, 덮어쓰기 stays file overwrite); 퍼스트 파티 / 서드 파티 =
 * first-/third-party; 툼스톤 = tombstone; 슬롯 = DNR slot; 잘라냄 =
 * clamped; 정적 데이터 / 동적 = Static Data / Dynamic; 정리됨 / Raw
 * carried from panel-storage. 챌린지 / 초안 / 화면 / 상한 / 디버그 모드 /
 * 범위 carried. Raw by design: gates AND/OR/NOT, DNR schema vocabulary
 * (`requestDomains`, `url-filter`, `firstParty`, slot ids),
 * `{{ns.NAME}}` reference syntax in placeholders, quoted browser UI
 * phrasing (raw en in “”, S80 law), scheme prefixes, HTTP method
 * lists, regex fragments, the Mock tag; `⋮ → 사용자 템플릿으로 저장`
 * menu-path splits quote the OH mint. Every raw token takes a head
 * noun before a particle (Chrome 브라우저가, URL 형식이, DNR 슬롯을).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': '저장됨',
  'workbench.editors.header.onTop': '편집기 헤더를 위에',
  'workbench.editors.header.atBottom': '편집기 헤더를 아래에',
  'workbench.editors.header.moreActions': '작업 더 보기',

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': '규칙 편집기',
  'workbench.editors.rule.templates.title': '템플릿',
  'workbench.editors.rule.templates.infoSummary': '빈 양식 대신 프리셋에서 시작합니다.',
  'workbench.editors.rule.templates.infoDescription':
    '시스템 템플릿은 앱에 내장되어 있고, 사용자 템플릿은 ⋮ → 사용자 템플릿으로 저장을 통해 직접 저장한 것입니다. 템플릿을 적용하면 필드만 미리 채워집니다. 저장 전에 무엇이든 조정하세요.',
  'workbench.editors.rule.templates.blank': '빈 템플릿',
  'workbench.editors.rule.templates.system': '시스템',
  'workbench.editors.rule.templates.user': '사용자',
  'workbench.editors.rule.templates.emptyTitle': '아직 사용자 템플릿이 없습니다',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    '사용자 템플릿은 이 규칙 유형을 위해 직접 만드는 재사용 가능한 프리셋입니다. 규칙을 원하는 대로 구성한 다음 편집기 헤더에서',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → 사용자 템플릿으로 저장',
  'workbench.editors.rule.templates.emptyAfterMenu': '항목을 선택하세요. 이 유형의 새 규칙마다 여기에 표시됩니다.',
  'workbench.editors.rule.saveAsTemplate': '사용자 템플릿으로 저장',
  'workbench.editors.rule.enabled': '활성',
  'workbench.editors.rule.disabled': '비활성',
  'workbench.editors.rule.toast.unknownType': '알 수 없는 규칙 유형',
  'workbench.editors.rule.toast.deletedOtherTab': '규칙이 다른 탭에서 삭제되었습니다',
  'workbench.editors.rule.toast.updateFailed': '규칙을 업데이트하지 못했습니다',
  'workbench.editors.rule.toast.updateFailedDetail': '규칙을 업데이트하지 못했습니다: {message}',
  'workbench.editors.rule.toast.publishFailed': '규칙은 저장했지만 게시에 실패했습니다',
  'workbench.editors.rule.toast.updated': '규칙을 업데이트했습니다',
  'workbench.editors.rule.toast.published': '규칙을 게시했습니다',
  'workbench.editors.rule.toast.formatSkipped': '저장 시 정리를 건너뛰었습니다: {reason}',
  'workbench.editors.rule.toast.noCollection': '컬렉션을 찾을 수 없습니다',
  'workbench.editors.rule.toast.restoreFailed': '규칙을 복원하지 못했습니다',
  'workbench.editors.rule.toast.restored': '규칙을 복원했습니다',
  'workbench.editors.rule.deleted.message': '이 규칙은 다른 화면에서 삭제되었습니다.',
  'workbench.editors.rule.deleted.description':
    '복원하면 새 id를 가진 새 사본이 만들어집니다 (원래 툼스톤은 영구적입니다. 동기화 엔진 사양 §7.2 참조).',
  'workbench.editors.rule.deleted.restore': '복원',
  'workbench.editors.rule.conditionsPane.title': '조건',
  'workbench.editors.rule.conditionsPane.infoSummary': '조건은 이 규칙이 어떤 요청에 적용될지 결정합니다.',
  'workbench.editors.rule.conditionsPane.infoAndBefore': '행끼리는',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '조건으로 결합됩니다. 모든 행이 일치해야 합니다.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': '한 행 안의 값들은',
  'workbench.editors.rule.conditionsPane.infoOrAfter':
    '조건으로 결합됩니다 (OR 배지는 여러 값을 받는 행을 표시합니다).',
  'workbench.editors.rule.conditionsPane.infoAddOne': '조건을 하나 이상 추가하세요.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': 'URL 일치',
  'workbench.editors.rule.condition.group.domainFiltering': '도메인 필터링',
  'workbench.editors.rule.condition.group.requestFiltering': '요청 필터링',
  'workbench.editors.rule.condition.group.headerMatching': '헤더 일치',
  'workbench.editors.rule.condition.type.urlFilter': 'URL 패턴',
  'workbench.editors.rule.condition.type.urlRegex': 'URL 정규식',
  'workbench.editors.rule.condition.type.requestDomains': '요청 도메인',
  'workbench.editors.rule.condition.type.excludeRequestDomains': '도메인 제외',
  'workbench.editors.rule.condition.type.initiatorDomains': '발신자 도메인',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': '발신자 제외',
  'workbench.editors.rule.condition.type.requestMethods': '메서드',
  'workbench.editors.rule.condition.type.excludeRequestMethods': '메서드 제외',
  'workbench.editors.rule.condition.type.resourceTypes': '리소스 유형',
  'workbench.editors.rule.condition.type.excludeResourceTypes': '리소스 제외',
  'workbench.editors.rule.condition.type.domainType': '도메인 종류',
  'workbench.editors.rule.condition.type.responseHeader': '응답 헤더',
  'workbench.editors.rule.condition.type.excludeResponseHeader': '응답 헤더 제외',
  'workbench.editors.rule.condition.suffix.notSupported': ': Chrome DNR 미지원',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ': 이미 사용 중',
  'workbench.editors.rule.condition.firstParty': '퍼스트 파티',
  'workbench.editors.rule.condition.thirdParty': '서드 파티',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': '조건이 없습니다. 규칙이 어떤 요청과도 일치하지 않습니다',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    '행끼리는 AND 조건으로 결합됩니다. 규칙이 실행되려면 모든 행이 일치해야 합니다. 각 행은 서로 다른 DNR 필드를 대상으로 하므로 행 간 AND 결합은 정확합니다. 한 필드 안에서 여러 값을 OR 조건으로 묶으려면 한 행 안에 나열하세요 (행의 OR 배지 참조).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    '제외 조건입니다. 나열된 값 중 어느 것도 일치하지 않을 때만 규칙이 실행됩니다.',
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    '이 행의 여러 값은 하나라도 일치하면 일치합니다 (OR). 아래 행들은 AND 조건으로 결합됩니다.',
  'workbench.editors.rule.condition.oneValueTag': '값 1개',
  'workbench.editors.rule.condition.oneValueTooltip':
    '이 조건은 값을 하나만 받습니다. 쉼표로 구분해도 효과가 없습니다. 아래 행들은 AND 조건으로 결합됩니다.',
  'workbench.editors.rule.condition.headerNamePlaceholder': '헤더 이름이 다음과 같음...',
  'workbench.editors.rule.condition.headerValuePlaceholder': '헤더 값이 다음과 같음...',
  'workbench.editors.rule.condition.selectMethods': '메서드 선택',
  'workbench.editors.rule.condition.selectTypes': '유형 선택',
  'workbench.editors.rule.condition.selectType': '유형 선택',
  'workbench.editors.rule.condition.valuePlaceholder': '값',
  'workbench.editors.rule.condition.add': '조건 추가',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    '마지막 {type} 행만 적용됩니다. 이 행의 값은 Chrome 브라우저에 전달되지 않습니다. 이 행을 제거하거나, 값을 적용되는 행으로 옮기세요.',
  'workbench.editors.rule.issue.mutexConflict':
    '{type} 조건과 {winningType} 조건은 같은 DNR 슬롯을 공유하므로 마지막 하나만 적용됩니다. 하나를 고르세요.',
  'workbench.editors.rule.issue.unsupportedByDnr':
    '이 조건 유형은 Chrome DNR 기능이 아직 지원하지 않습니다. 규칙은 저장되지만 이 행은 전송선에 아무것도 싣지 않습니다.',
  'workbench.editors.rule.issue.emptyUrlFilter': 'URL 패턴은 비워 둘 수 없습니다.',
  'workbench.editors.rule.issue.emptyUrlRegex': 'URL 정규식은 비워 둘 수 없습니다.',
  'workbench.editors.rule.issue.urlFilterWhitespace':
    'URL 패턴에는 공백을 넣을 수 없습니다. Chrome 브라우저는 url-filter 값에 공백이 있는 규칙을 거부합니다.',
  'workbench.editors.rule.issue.urlFilterNonAscii':
    'URL 패턴에 ASCII가 아닌 문자가 있습니다. Chrome 브라우저는 이를 거부합니다. IDN 호스트 이름에는 punycode 형식 (xn--…)을 사용하세요.',
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    '정규식처럼 보입니다. URL 패턴에서는 `(`, `[`, `+`, `?`, `\\d` 같은 문자가 문자 그대로 일치합니다. 정규식 문법이 필요하면 URL 정규식으로 전환하세요.',
  'workbench.editors.rule.issue.regexLookbehind':
    'Chrome 브라우저의 정규식 엔진 (RE2)은 후방 탐색 ((?<=…), (?<!…))을 지원하지 않습니다. 규칙을 불러오지 못할 수 있습니다.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Chrome 브라우저의 정규식 엔진 (RE2)은 Python 스타일의 명명 그룹 ((?P<name>…))을 지원하지 않습니다. 규칙을 불러오지 못할 수 있습니다.',
  'workbench.editors.rule.issue.invalidUrlRegex': '잘못된 정규식: {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    '"{value}"은(는) 유효한 HTTP 메서드가 아닙니다. 허용: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType':
    '"{value}"은(는) 유효한 리소스 유형이 아닙니다. 드롭다운에서 고르세요.',
  'workbench.editors.rule.issue.invalidDomainType':
    '"{value}"은(는) 유효한 도메인 종류가 아닙니다. "firstParty" 또는 "thirdParty"를 사용하세요.',
  'workbench.editors.rule.issue.headerNameRequired': '헤더 이름은 필수입니다.',
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    '값 안에 공백이 있습니다. 호스트 이름은 쉼표로 구분하세요. requestDomains 조건은 항목마다 순수 호스트 이름 하나를 받습니다.',
  'workbench.editors.rule.issue.domain.scheme':
    '스킴을 제거하세요. Chrome 브라우저의 requestDomains 조건은 URL 주소가 아니라 호스트 이름만 받습니다.',
  'workbench.editors.rule.issue.domain.wildcard':
    "와일드카드를 제거하세요. requestDomains 조건은 하위 도메인을 자동으로 일치시키므로 '*.foo.com'은 곧 'foo.com'입니다.",
  'workbench.editors.rule.issue.domain.port':
    '포트를 제거하세요. requestDomains 조건은 호스트 이름으로만 일치시키며, 규칙은 모든 포트를 자동으로 포함합니다.',
  'workbench.editors.rule.issue.domain.uppercase':
    '호스트 이름을 소문자로 바꾸세요. Chrome 브라우저는 requestDomains 조건에 소문자 ASCII 문자만 허용합니다.',
  'workbench.editors.rule.issue.domain.nonAscii':
    '호스트 이름에 Chrome 브라우저가 requestDomains 조건에서 거부하는 문자가 있습니다 (ASCII가 아닌 / IDN 항목일 가능성). punycode 형식 (xn--…)을 사용하세요.',
  'workbench.editors.rule.issue.domain.empty': '호스트 이름이 비어 있습니다. 이 행을 제거하세요.',
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), { other: '영향받는 항목 {count}개' }),
  'workbench.editors.rule.issue.domain.cleanUp': '정리',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': '리디렉션 대상에는 공백을 넣을 수 없습니다.',
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    '리디렉션 대상은 전체 URL 주소 (http://, https://, chrome-extension://)이거나 /로 시작하는 경로여야 합니다.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    '소스 URL 주소는 http://, https:// 또는 chrome-extension://을 사용해야 합니다.',
  'workbench.editors.rule.actionIssue.injectUrlInvalid': '소스 URL 값이 유효한 URL 형식이 아닙니다.',
  'workbench.editors.rule.actionIssue.invalidStatusCode': '상태 코드는 100-599 사이의 정수여야 합니다.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    '매개변수 이름에는 `&`, `=`, `#`, `?` 또는 공백을 넣을 수 없습니다.',
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    '메인 프레임 지연의 상한은 30000ms입니다. 그보다 큰 값은 전송선에서 잘라냅니다.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'XHR/fetch 몽키 패치는 HTTP 연결 풀 고갈을 막기 위해 지연을 5000ms로 제한합니다. 메인 프레임 리디렉션은 최대 30000ms까지 적용됩니다.',
  'workbench.editors.rule.actionIssue.invalidContentType':
    '콘텐츠 유형은 "type/subtype" 형태여야 합니다 (예: application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'GraphQL 필터 키는 필수입니다.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired': '필터를 구성했다면 메시지 필터 값은 필수입니다.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex': '메시지 필터가 유효한 정규식이 아닙니다.',
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    '일치하는 메시지 뒤에 삽입하려면 메시지 필터가 필요합니다.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 규칙에 해결되지 않은 변수 {count}개' }),
  'workbench.editors.rule.resolution.reason.unresolved': '미해결',
  'workbench.editors.rule.resolution.reason.unsetInScope': '범위에 없음',
  'workbench.editors.rule.resolution.reason.unknownNamespace': '알 수 없는 이름 공간',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': '단계 참조가 범위 밖',
  'workbench.editors.rule.resolution.reason.empty': '비어 있음',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': '잘못된 값',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': '인가 필요',
  'workbench.editors.rule.resolution.reason.secretNotFound': '시크릿을 찾을 수 없음',
  'workbench.editors.rule.resolution.reason.secretUnavailable': '관리자를 사용할 수 없음',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    '“{envName}” 환경의 캐시된 실행이 없습니다. 워크플로를 열고 이 환경 아래의 새로 고침을 눌러 채우세요',
  'workbench.editors.rule.resolution.hint.disabledLv':
    '라이브 변수가 비활성 상태입니다. 라이브 변수 편집기에서 활성화하세요',
  'workbench.editors.rule.resolution.hint.draftLv': '라이브 변수가 초안 상태입니다. 열어서 저장을 눌러 게시하세요',
  'workbench.editors.rule.resolution.noEnvironment': '환경 없음',
  'workbench.editors.rule.resolution.activeEnvFallback': '활성 환경',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': '작업',
  'workbench.editors.rule.fields.addAction': '작업 추가',
  'workbench.editors.rule.fields.reset': '재설정',
  'workbench.editors.rule.fields.optionalTag': '(선택 사항)',
  'workbench.editors.rule.fields.opAddReplace': '추가 / 바꾸기',
  'workbench.editors.rule.fields.opAppend': '덧붙이기',
  'workbench.editors.rule.fields.opRemove': '제거',
  'workbench.editors.rule.fields.opMerge': '병합',
  'workbench.editors.rule.fields.opReplaceOnly': '바꾸기만',
  'workbench.editors.rule.fields.opRemoveAll': '모두 제거',
  'workbench.editors.rule.fields.operatorEquals': '같음',
  'workbench.editors.rule.fields.operatorContains': '포함',
  'workbench.editors.rule.fields.restApi': 'REST API',
  'workbench.editors.rule.fields.graphqlApi': 'GraphQL API',
  'workbench.editors.rule.fields.staticData': '정적 데이터',
  'workbench.editors.rule.fields.dynamicJs': '동적 (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': '정리됨',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Raw',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    '정리된 보기는 JSON 형태의 본문에서만 사용할 수 있습니다.',
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': '정리된 보기',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': '본문',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    '정리됨과 Raw는 같은 본문 텍스트를 보는 두 가지 방식입니다. 규칙이 제공하는 것은 전송선 텍스트입니다.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': '예시: 값 하나, 보기 둘',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': '모드',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    '읽기용 보기입니다. 공백만 다릅니다. 편집 내용은 원래 전송선 형식으로 다시 인코딩되고, 저장은 그 전송선 텍스트를 씁니다. 편집 없이 저장하면 원래 바이트를 그대로 씁니다.',
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    '전송선 텍스트 그 자체입니다. 규칙이 제공하는 내용과 정확히 같습니다.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'GraphQL 작업 (요청 페이로드 필터)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': '키 (예: operationName)',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': '값 (예: getUsers)',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': '헤더 규칙',
  'workbench.editors.rule.fields.header.infoSummary': '일치하는 트래픽의 요청 및 응답 헤더를 다시 씁니다.',
  'workbench.editors.rule.fields.header.infoDescription':
    '잘못된 조합 (예: 사용자 지정 헤더에 덧붙이기)은 규칙을 초안으로 표시합니다. 초안은 저장되지만 실행되지 않습니다.',
  'workbench.editors.rule.fields.header.requestTab': '요청 헤더',
  'workbench.editors.rule.fields.header.requestTabSummary':
    '브라우저를 떠나기 전의 나가는 요청에 적용되는 헤더 작업입니다.',
  'workbench.editors.rule.fields.header.responseTab': '응답 헤더',
  'workbench.editors.rule.fields.header.responseTabSummary': '페이지가 보기 전의 응답에 적용되는 헤더 작업입니다.',
  'workbench.editors.rule.fields.header.responseTabDescription':
    '브라우저 자체의 DevTools 네트워크 탭은 항상 원래 서버 헤더를 보여 주므로, 이 변경은 적용되더라도 거기서는 보이지 않습니다. Open Headers DevTools 창에는 그런 제한이 없습니다. 페이지에 제공된 헤더를 그대로 보여 줍니다.',
  'workbench.editors.rule.fields.header.emptyRequest': '작업이 없습니다. 이 규칙은 요청 헤더를 바꾸지 않습니다',
  'workbench.editors.rule.fields.header.emptyResponse': '작업이 없습니다. 이 규칙은 응답 헤더를 바꾸지 않습니다',
  'workbench.editors.rule.fields.header.namePlaceholder': '헤더 이름',
  'workbench.editors.rule.fields.header.valuePlaceholder': '헤더 값',
  'workbench.editors.rule.fields.header.appendValuePlaceholder': '덧붙일 값',
  'workbench.editors.rule.fields.header.existingValue': '기존 값',
  'workbench.editors.rule.fields.header.switchTo': '{operation} 작업으로 전환',
  'workbench.editors.rule.fields.header.dragToReorder': '드래그하여 순서 변경',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': '차단 규칙',
  'workbench.editors.rule.fields.block.infoSummary': '차단은 일치하는 요청을 브라우저를 떠나기 전에 취소합니다.',
  'workbench.editors.rule.fields.block.infoDescription':
    '작업 구성은 필요 없습니다. 차단 자체가 작업이며, 조건이 무엇을 차단할지 결정합니다.',
  'workbench.editors.rule.fields.block.title': '요청 차단',
  'workbench.editors.rule.fields.block.body':
    '아래 조건과 일치하는 요청은 차단됩니다. 브라우저는 페이지에 네트워크 오류를 표시합니다.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': '리디렉션 규칙',
  'workbench.editors.rule.fields.redirect.infoSummary':
    '일치하는 요청을 네트워크에 도달하기 전에 다른 URL 주소로 보냅니다.',
  'workbench.editors.rule.fields.redirect.infoDescription':
    'URL 정규식 조건에서는 \\1, \\2 …가 캡처한 그룹을 대상 URL 주소에 치환합니다.',
  'workbench.editors.rule.fields.redirect.redirectsTo': '리디렉션 대상',
  'workbench.editors.rule.fields.redirect.anotherUrl': '다른 URL',
  'workbench.editors.rule.fields.redirect.localFile': '로컬 파일',
  'workbench.editors.rule.fields.redirect.desktopOnly': '데스크톱 앱에서 사용 가능',
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    '예: https://openheaders.com/redirected. URL 정규식 조건에서는 \\1, \\2 사용',

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': '쿼리 매개변수 규칙',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    '일치하는 요청 URL 주소의 쿼리 매개변수를 추가, 바꾸기 또는 제거합니다.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    '모두 제거는 쿼리 문자열 전체를 제거합니다. 같은 규칙의 추가 / 바꾸기 항목이 새 쿼리가 됩니다. 바꾸기만 및 제거 항목은 작용할 대상이 없으므로 모두 제거와 함께 있으면 무시됩니다.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    '모두 제거는 쿼리 문자열 전체를 제거하므로 바꾸기만 및 제거 항목은 작용할 대상이 없어 무시됩니다. 추가 / 바꾸기 항목은 계속 적용되어 새 쿼리가 됩니다.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': 'URL 주소에서 모든 쿼리 매개변수를 제거합니다',
  'workbench.editors.rule.fields.queryParam.namePlaceholder': '매개변수 이름',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': '매개변수 값',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': '삽입 규칙',
  'workbench.editors.rule.fields.inject.infoSummary': '일치하는 페이지가 로드될 때 스크립트나 스타일시트를 삽입합니다.',
  'workbench.editors.rule.fields.inject.language': '언어:',
  'workbench.editors.rule.fields.inject.codeSource': '코드 소스:',
  'workbench.editors.rule.fields.inject.insert': '삽입 시점:',
  'workbench.editors.rule.fields.inject.sourceCode': '코드',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': '페이지 로드 후',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': '가능한 한 빨리',
  'workbench.editors.rule.fields.inject.source': '소스',
  'workbench.editors.rule.fields.inject.code': '코드',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': '소스 URL 입력 (상대 또는 절대)',
  'workbench.editors.rule.fields.inject.bypassCsp': '삽입한 스크립트가 항상 실행되도록 Content-Security-Policy 우회',
  'workbench.editors.rule.fields.inject.cspBypassHint':
    '현재는 헤더 CSP 정책만 우회합니다. <meta> CSP 정책은 여전히 이 스크립트를 차단할 수 있습니다. 둘 다 우회하려면 브라우저의 확장 프로그램 설정에서 이 확장 프로그램의 “Allow user scripts”를 활성화하세요.',

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': '지연 규칙',
  'workbench.editors.rule.fields.delay.infoSummary': '일치하는 요청을 구성한 시간만큼 붙잡아 둔 뒤 계속 진행시킵니다.',
  'workbench.editors.rule.fields.delay.capsAlert':
    '문서 및 iframe 탐색은 로컬 대기 페이지를 통해 최대 30,000ms까지 지연됩니다. JS 코드가 시작한 XHR/Fetch 요청은 HTTP 연결 풀 고갈을 막기 위해 5,000ms로 제한됩니다. 하위 리소스 (CSS, JS, 이미지)는 지연되지 않습니다.',
  'workbench.editors.rule.fields.delay.label': '지연',
  'workbench.editors.rule.fields.delay.maxNote': '최대 30,000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': '요청 본문 규칙',
  'workbench.editors.rule.fields.requestBody.infoSummary': '일치하는 요청의 본문을 전송 전에 바꿉니다.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    '정적 데이터는 고정된 페이로드로 바꿔 넣고, 동적은 원래 본문을 대상으로 JavaScript 코드를 실행합니다.',
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'REST 또는 GraphQL API 요청의 fetch() 및 XMLHttpRequest 호출을 가로챕니다.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': '리소스 유형 선택',
  'workbench.editors.rule.fields.requestBody.bodyLabel': '요청 본문',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': '함수는',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    '값을 받아 수정된 본문을 반환해야 합니다. 문자열 또는 객체 (자동으로 JSON 직렬화)를 반환하세요.',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': '응답 규칙',
  'workbench.editors.rule.fields.response.infoSummary': '일치하는 요청에 서버가 반환한 것 대신 대체 응답을 제공합니다.',
  'workbench.editors.rule.fields.response.infoDescription':
    '정적 데이터는 고정된 페이로드를 제공하고, 동적은 원래 응답을 대상으로 JavaScript 코드를 실행합니다.',
  'workbench.editors.rule.fields.response.sourceLabel': '응답 소스',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'REST 또는 GraphQL API 요청의 fetch() 및 XMLHttpRequest 응답에 작용합니다.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock 모드는 서버를 호출하지 않고 내 본문을 제공하고, 수정 모드는 실제 요청을 보낸 뒤 페이지가 보기 전에 응답을 편집합니다.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock: 요청을 보내지 않음',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 수정: 서버의 응답을 편집',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    '실제 요청이 전송되며, 페이지가 보기 전에 응답에 변경 사항이 적용됩니다.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    '요청은 브라우저를 떠나지 않습니다. 페이지가 내 응답을 직접 받습니다.',
  'workbench.editors.rule.fields.response.resourceType': '리소스 유형',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    '규칙이 대상으로 하는 API 페이로드 형태입니다. REST 또는 GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    'GraphQL 유형은 아래에 작업 필터를 열어 주므로, 규칙이 공유 엔드포인트 안의 작업 하나와 일치할 수 있습니다.',
  'workbench.editors.rule.fields.response.statusCode': '상태 코드',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': '내 응답과 함께 제공되는 HTTP 상태입니다.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    '제공할 코드를 고르거나, 서버를 호출하는 경우 서버 응답의 원래 코드를 유지합니다.',
  'workbench.editors.rule.fields.response.keepOriginalStatus': '원래 상태 코드 유지',
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    '본문과 함께 제공되는 Content-Type 헤더입니다. 브라우저가 본문을 해석하는 방식을 제어합니다.',
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    '어떤 값이든 입력할 수 있으며, 제안은 편의를 위한 것입니다. 서버를 호출하는 경우 값을 설정했을 때만 실제 응답의 Content-Type 헤더를 재정의합니다.',
  'workbench.editors.rule.fields.response.headersLabel': '응답 헤더',
  'workbench.editors.rule.fields.response.headersInfoSummary': 'Content-Type 헤더와 함께 제공되는 추가 헤더입니다.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    '서버를 호출하는 경우 실제 응답의 헤더 위에 병합되고, Mock 모드에서는 응답의 헤더가 됩니다. 빈 행은 저장 시 버려집니다.',
  'workbench.editors.rule.fields.response.headerNamePlaceholder': '헤더 이름 (예: X-Custom)',
  'workbench.editors.rule.fields.response.headerValuePlaceholder': '헤더 값',
  'workbench.editors.rule.fields.response.addHeader': '헤더 추가',
  'workbench.editors.rule.fields.response.bodyLabel': '응답 본문',
  'workbench.editors.rule.fields.response.bodyInfoSummary': '일치하는 요청에 대해 페이지에 제공되는 페이로드입니다.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    '정적 데이터는 고정된 본문을 제공하고, 동적 (JavaScript)은 요청 시점에 본문을 만들거나 변환합니다.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': '실제 요청이 먼저 전송됩니다. 내',
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    '함수가 응답과 요청 컨텍스트를 받아 수정된 응답을 반환합니다. 문자열 또는 객체 (자동으로 JSON 직렬화)를 반환하세요.',
  'workbench.editors.rule.fields.response.dynMockBefore': '요청을 보내지 않습니다. 내',
  'workbench.editors.rule.fields.response.dynMockMid': '함수는',
  'workbench.editors.rule.fields.response.dynMockAfter':
    '값을 받아 응답 본문을 반환합니다. 문자열 또는 객체 (자동으로 JSON 직렬화)를 반환하세요.',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'WebSocket 규칙',
  'workbench.editors.rule.fields.message.sseKicker': 'SSE 규칙',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    '일치하는 연결의 WebSocket 프레임을 페이지나 전송선이 보기 전에 수정, 삽입 또는 폐기합니다.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    '일치하는 스트림의 서버 전송 이벤트를 리스너가 보기 전에 수정, 삽입 또는 폐기합니다.',
  'workbench.editors.rule.fields.message.wsIntro':
    '소켓 URL 주소가 조건과 일치하는, 페이지가 만든 WebSocket 연결을 가로챕니다. 프레임은 페이지 코드 (수신) 또는 전송선 (송신)에 도달하기 전에 페이지 안에서 수정, 삽입 또는 폐기됩니다.',
  'workbench.editors.rule.fields.message.sseIntro':
    'URL 주소가 조건과 일치하는, 페이지가 만든 EventSource 스트림을 가로챕니다. 이벤트는 리스너가 보기 전에 페이지 안에서 수정, 삽입 또는 폐기됩니다.',
  'workbench.editors.rule.fields.message.operation': '작업',
  'workbench.editors.rule.fields.message.opReplace': '바꾸기',
  'workbench.editors.rule.fields.message.opInject': '삽입',
  'workbench.editors.rule.fields.message.opDrop': '폐기',
  'workbench.editors.rule.fields.message.direction': '방향',
  'workbench.editors.rule.fields.message.incoming': '수신 (서버 → 페이지)',
  'workbench.editors.rule.fields.message.outgoing': '송신 (페이지 → 서버)',
  'workbench.editors.rule.fields.message.eventName': '이벤트 이름',
  'workbench.editors.rule.fields.message.eventNamePlaceholder': '비우면 기본 message 이벤트',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': '스트림의',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': '필드와 일치시킵니다',
  'workbench.editors.rule.fields.message.frameFilter': '프레임 필터',
  'workbench.editors.rule.fields.message.dataFilter': '데이터 필터',
  'workbench.editors.rule.fields.message.everyFrame': '모든 프레임',
  'workbench.editors.rule.fields.message.everyEvent': '모든 이벤트',
  'workbench.editors.rule.fields.message.filterRegex': '정규식',
  'workbench.editors.rule.fields.message.filterNoteWs':
    '필터는 텍스트 프레임에만 일치합니다. 필터가 설정되면 바이너리 프레임은 그대로 통과합니다.',
  'workbench.editors.rule.fields.message.filterNoteSse': '필터는 텍스트 이벤트에만 일치합니다.',
  'workbench.editors.rule.fields.message.injectWhen': '삽입 시점',
  'workbench.editors.rule.fields.message.connectionOpens': '연결이 열릴 때',
  'workbench.editors.rule.fields.message.streamOpens': '스트림이 열릴 때',
  'workbench.editors.rule.fields.message.matchingFrameArrives': '일치하는 프레임이 도착할 때',
  'workbench.editors.rule.fields.message.matchingEventArrives': '일치하는 이벤트가 도착할 때',
  'workbench.editors.rule.fields.message.injectedFrame': '삽입할 프레임',
  'workbench.editors.rule.fields.message.injectedEvent': '삽입할 이벤트',
  'workbench.editors.rule.fields.message.replacementFrame': '대체 프레임',
  'workbench.editors.rule.fields.message.replacementEvent': '대체 이벤트',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': '인증 규칙',
  'workbench.editors.rule.fields.auth.infoSummary':
    '일치하는 요청의 HTTP 또는 프록시 인증 챌린지에 이 자격 증명으로 응답합니다.',
  'workbench.editors.rule.fields.auth.infoDescription':
    '두 필드 모두 {{templates}} 참조를 해결하므로, 실제 시크릿을 규칙의 평문 대신 vault 저장소 ({{vault.*}})에 둘 수 있습니다. 디버그 모드 범위의 탭에서만 적용됩니다.',
  'workbench.editors.rule.fields.auth.introBefore':
    '일치하는 요청의 서버 (401) 또는 프록시 (407) 인증 챌린지에 응답합니다. 자격 증명이 규칙에 저장되지 않도록 vault 시크릿을 참조하세요. 예:',
  'workbench.editors.rule.fields.auth.introAfter': '.',
  'workbench.editors.rule.fields.auth.username': '사용자 이름',
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': '예: dev-user 또는 {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': '비밀번호',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': '예: {{vault.STAGING_PW}}',
} as const satisfies Catalog;
