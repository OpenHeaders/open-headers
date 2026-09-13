/**
 * Workbench editors — shared editor chrome — Korean. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the {column}
 * / {header} / {key} / {name} / {language} / {message} holes, `Tests`
 * group label raw per the de/es parity lock, lowercase en `vault` raw
 * lowercase (per-case token law) with 시크릿 as its head noun, JSON /
 * URL / HTTP / CONNECT / PUBLISH / QoS / Socket.IO / OK raw.
 * 스크립트 = script; 스니펫 = snippet; 패키지 / 패키지 라이브러리 per
 * script-packages; package-flow strings shared with
 * `workbench-script-packages.ts` (duplicate name, not-found, save
 * failed, empty states) reuse its ko sentences verbatim. 인가 =
 * Authorization; 시크릿 = secret (shipped mints). MINTS: 상속 = the
 * Inherit option label — `workbench-editors-request.ts` MUST reuse
 * it; 일괄 = Bulk; 키와 값 = Key-Value; 정리 = Format (panel mint);
 * 요청 초안 = request draft (초안 carried from the Draft mint); 본문 =
 * the bare `Body` tab noun (prose keeps 요청 본문 / 응답 본문 per the
 * shipped mints); 하위 프로토콜 carried from shared-info-headers;
 * 메타데이터 쌍 = metadata pair; 유언 = last will; 다이얼 = dial;
 * 트레일러 = trailer; 브로커 = broker.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': '자세한 정보',

  // ── Session chrome (shared: WS/MQTT session panes) ─────────────────
  'workbench.editors.session.connectionDetails': '연결 세부 정보',
  'workbench.editors.session.subprotocol': '하위 프로토콜',
  'workbench.editors.session.extensions': '확장',
  'workbench.editors.session.closeCode': '종료 코드',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': '키',
  'workbench.editors.grid.value': '값',
  'workbench.editors.grid.description': '설명',
  'workbench.editors.grid.showColumns': '열 표시',
  'workbench.editors.grid.tableOptions': '표 옵션',
  'workbench.editors.grid.bulk': '일괄',
  'workbench.editors.grid.keyValue': '키와 값',
  'workbench.editors.grid.selectAllAria': '모든 행 활성 또는 비활성',
  'workbench.editors.grid.selectAllTitle': '모두 활성 / 비활성',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': '{column} 열 크기 조정',
  'workbench.editors.grid.overriddenBy': '중복입니다. 추가한 {header} 행이 이 행을 재정의합니다.',
  'workbench.editors.grid.suggestionValueAria': '{key} 값',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.notFoundCollection': '요청 컬렉션을 찾을 수 없습니다.',
  'workbench.editors.ancestorScripts.notFoundFolder': '폴더를 찾을 수 없습니다.',
  'workbench.editors.ancestorScripts.saveFailed': '스크립트를 저장할 수 없습니다.',
  'workbench.editors.ancestorScripts.saveFailedDetail': '스크립트를 저장할 수 없습니다: {message}',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.notFoundCollection': '요청 컬렉션을 찾을 수 없습니다.',
  'workbench.editors.ancestorAuth.notFoundFolder': '폴더를 찾을 수 없습니다.',
  'workbench.editors.ancestorAuth.saveFailed': '인가를 저장할 수 없습니다.',
  'workbench.editors.ancestorAuth.saveFailedDetail': '인가를 저장할 수 없습니다: {message}',

  // ── Ancestor settings (collection/folder inheritable settings) ─────
  'workbench.editors.ancestorSettings.saveFailed': '설정을 저장할 수 없습니다.',
  'workbench.editors.ancestorSettings.saveFailedDetail': '설정을 저장할 수 없습니다: {message}',

  // ── Request container editor (a collection / folder: one tab, sections) ──
  'workbench.editors.requestContainer.tab.overview': '개요',
  'workbench.editors.requestContainer.auth.emptyTitle': '구성된 인증이 없습니다',
  'workbench.editors.requestContainer.auth.emptySubtitleCollection': '이 컬렉션의 요청에 사용할 인가 유형을 선택하세요',
  'workbench.editors.requestContainer.auth.emptySubtitleFolder': '이 폴더의 요청에 사용할 인가 유형을 선택하세요',
  'workbench.editors.requestContainer.auth.authTypes': '인증 유형',
  'workbench.editors.requestContainer.auth.authTypesInfo':
    '컨테이너의 풀입니다. 요청에 필요한 스킴마다 항목 하나를 둡니다. “상속”으로 설정된 요청은 기본 항목을 사용하고, ' +
    '호스트 패턴은 일치하는 요청을 다른 항목으로 보내며, 요청은 이름으로 항목을 직접 고를 수도 있습니다.',
  'workbench.editors.requestContainer.auth.authTypesInfoHeading': '유형',
  'workbench.editors.requestContainer.auth.addEntryAria': '인증 유형 추가',
  'workbench.editors.requestContainer.auth.inheritedTag': '상속됨',
  'workbench.editors.requestContainer.auth.rename': '이름 바꾸기',
  'workbench.editors.requestContainer.auth.noneEntryNote': '이 항목을 사용하는 요청은 인가 없이 전송됩니다.',
  'workbench.editors.requestContainer.auth.defaultTag': '기본',
  'workbench.editors.requestContainer.auth.setDefault': '기본으로 설정',
  'workbench.editors.requestContainer.auth.deleteEntry': '삭제',
  'workbench.editors.requestContainer.auth.entryActionsAria': '항목 작업',
  'workbench.editors.requestContainer.auth.appliesTo': '적용 호스트',
  'workbench.editors.requestContainer.auth.appliesToPlaceholder': '*.openheaders.com',
  'workbench.editors.requestContainer.auth.appliesToHelp':
    '“상속”으로 설정된 요청의 URL 호스트가 일치하면 기본 항목보다 이 항목을 먼저 받습니다.',
  'workbench.editors.requestContainer.auth.appliesToOptionalTag': '(선택 사항)',
  'workbench.editors.requestContainer.auth.appliesToInfoSummary':
    '이 항목을 URL 호스트가 패턴과 일치하는 요청으로 한정합니다.',
  'workbench.editors.requestContainer.auth.appliesToInfoRules':
    '대소문자를 구분하지 않습니다. * 는 임의의 문자열과 일치하며, * 가 없는 패턴은 호스트와 정확히 일치해야 합니다. 포트와 경로는 고려하지 않습니다. 비워 두면 이 항목은 기본 항목으로서 또는 요청의 선택으로만 사용됩니다.',
  'workbench.editors.requestContainer.auth.resetToInherited': '상속 값으로 재설정',
  'workbench.editors.requestContainer.auth.resetConfirm':
    '폴더의 항목을 제거하시겠습니까? 요청은 컬렉션 항목으로 넘어갑니다.',
  'workbench.editors.requestContainer.deletedElsewhere': '이 항목은 다른 창에서 삭제되었습니다.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': '예시를 불러오는 중…',
  'workbench.editors.responseExample.notFound': '예시를 찾을 수 없습니다.',
  'workbench.editors.responseExample.toast.deletedOtherTab': '예시가 다른 탭에서 삭제되었습니다',
  'workbench.editors.responseExample.toast.saveFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.responseExample.toast.saveFailedDetail': '예시를 저장하지 못했습니다: {message}',
  'workbench.editors.responseExample.openAsRequest': '요청으로 열기',
  'workbench.editors.responseExample.openAsRequestTooltip': '이 예시의 요청을 바탕으로 새 요청 초안을 만듭니다',
  'workbench.editors.responseExample.editStatus': '상태 코드 편집',
  'workbench.editors.responseExample.statusPlaceholder': '응답 코드 입력',
  'workbench.editors.responseExample.capturedTooltip': '{date}에 캡처됨',
  'workbench.editors.responseExample.moreActionsAria': '응답 작업 더 보기',
  'workbench.editors.responseExample.tab.body': '본문',
  'workbench.editors.responseExample.tab.headers': '헤더 ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': '본문 언어',
  'workbench.editors.responseExample.format': '정리',
  'workbench.editors.responseExample.formatBody': '본문 정리',
  'workbench.editors.responseExample.noFormatter': '{language} 형식에는 정리 도구가 없습니다',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': '스니펫',
  'workbench.editors.scriptEditor.packages': '패키지',
  'workbench.editors.scriptEditor.searchSnippets': '스니펫 검색',
  'workbench.editors.scriptEditor.searchPackages': '패키지 검색',
  'workbench.editors.scriptEditor.noSnippetFound': '스니펫을 찾을 수 없습니다',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': '이 워크스페이스에는 아직 패키지가 없습니다',
  'workbench.editors.scriptEditor.noPackageFound': '패키지를 찾을 수 없습니다',
  'workbench.editors.scriptEditor.openPackageLibrary': '패키지 라이브러리 열기 →',
  'workbench.editors.scriptEditor.saveToPackage': '패키지 라이브러리에 저장',
  'workbench.editors.scriptEditor.newPackage': '새 패키지',
  'workbench.editors.scriptEditor.newPackageName': '새 패키지 이름',
  'workbench.editors.scriptEditor.back': '뒤로',
  'workbench.editors.scriptEditor.create': '만들기',
  'workbench.editors.scriptEditor.orAppend': '또는 기존 패키지에 덧붙이기:',
  'workbench.editors.scriptEditor.noPackagesYet': '아직 패키지가 없습니다',
  'workbench.editors.scriptEditor.savedTo': '“{name}”에 저장했습니다',
  'workbench.editors.scriptEditor.packageCreated': '“{name}” 패키지를 만들었습니다',
  'workbench.editors.scriptEditor.duplicatePackage': '“{name}” 패키지가 이 워크스페이스에 이미 있습니다.',
  'workbench.editors.scriptEditor.packageNotFound': '패키지를 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'workbench.editors.scriptEditor.saveFailed': '저장 실패',
  'workbench.editors.scriptEditor.menuFind': '찾기',
  'workbench.editors.scriptEditor.group.request': '요청',
  'workbench.editors.scriptEditor.group.variables': '변수',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.group.requests': '요청',
  'workbench.editors.scriptEditor.group.response': '응답',
  'workbench.editors.scriptEditor.group.close': '종료',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'HTTP 요청 보내기',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'JSON 본문과 함께 HTTP 요청 보내기',
  'workbench.editors.scriptEditor.snippet.getVariable': '변수 가져오기',
  'workbench.editors.scriptEditor.snippet.setVariable': '변수 설정',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'vault 시크릿 가져오기',
  'workbench.editors.scriptEditor.snippet.setHeader': '헤더 설정',
  'workbench.editors.scriptEditor.snippet.removeHeader': '헤더 제거',
  'workbench.editors.scriptEditor.snippet.setQueryParam': '쿼리 매개변수 설정',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': '쿼리 매개변수 제거',
  'workbench.editors.scriptEditor.snippet.setUrl': 'URL 설정',
  'workbench.editors.scriptEditor.snippet.setMethod': '메서드 설정',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'JSON 본문 설정',
  'workbench.editors.scriptEditor.snippet.statusCode200': '상태 코드가 200임',
  'workbench.editors.scriptEditor.snippet.bodyContains': '응답 본문에 문자열이 포함됨',
  'workbench.editors.scriptEditor.snippet.bodyEquals': '응답 본문이 문자열과 같음',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': '응답 본문의 JSON 값이 올바름',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Content-Type 헤더가 있음',
  'workbench.editors.scriptEditor.snippet.responseTime': '응답 시간이 200 ms 미만임',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': '응답 값을 변수에 저장',
  'workbench.editors.scriptEditor.group.connect': '연결',
  'workbench.editors.scriptEditor.group.send': '전송',
  'workbench.editors.scriptEditor.group.message': '메시지',
  'workbench.editors.scriptEditor.snippet.wsSetSubprotocols': '하위 프로토콜 제안 설정',
  'workbench.editors.scriptEditor.snippet.wsReconnectAttempt': '재연결 시도 시 이어가기',
  'workbench.editors.scriptEditor.snippet.wsSetMessage': '보내는 메시지 다시 쓰기',
  'workbench.editors.scriptEditor.snippet.wsDropMessage': '보내는 메시지 폐기',
  'workbench.editors.scriptEditor.snippet.wsSetEvent': 'Socket.IO 이벤트 이름 바꾸기',
  'workbench.editors.scriptEditor.snippet.wsReply': '메시지에 회신',
  'workbench.editors.scriptEditor.snippet.wsCountMessages': '세션 전체의 메시지 수 세기',
  'workbench.editors.scriptEditor.snippet.wsEmitEvent': 'Socket.IO 이벤트 내보내기',
  'workbench.editors.scriptEditor.snippet.wsAssertJson': '메시지가 JSON 형식임',
  'workbench.editors.scriptEditor.snippet.wsSaveMessageValue': '메시지 값을 변수에 저장',
  'workbench.editors.scriptEditor.snippet.wsClosedClean': '세션이 정상 종료됨',
  'workbench.editors.scriptEditor.snippet.wsMessageCount': '메시지가 도착함',
  'workbench.editors.scriptEditor.group.publish': '게시',
  'workbench.editors.scriptEditor.snippet.mqttSetClientId': '클라이언트 ID 설정',
  'workbench.editors.scriptEditor.snippet.mqttSetCredentials': 'CONNECT 자격 증명 설정',
  'workbench.editors.scriptEditor.snippet.mqttAddSubscription': '연결 시 토픽 구독',
  'workbench.editors.scriptEditor.snippet.mqttSetWill': '유언 설정',
  'workbench.editors.scriptEditor.snippet.mqttSetUserProperty': 'CONNECT 사용자 속성 설정',
  'workbench.editors.scriptEditor.snippet.mqttReconnectAttempt': '재연결 시도 표시',
  'workbench.editors.scriptEditor.snippet.mqttSetPayload': '보내는 페이로드 다시 쓰기',
  'workbench.editors.scriptEditor.snippet.mqttSetTopic': '토픽 대상 변경',
  'workbench.editors.scriptEditor.snippet.mqttSetFlags': 'QoS 및 보존 설정',
  'workbench.editors.scriptEditor.snippet.mqttDropMessage': '보내는 메시지 폐기',
  'workbench.editors.scriptEditor.snippet.mqttReply': '회신 게시',
  'workbench.editors.scriptEditor.snippet.mqttCountMessages': '세션 전체의 메시지 수 세기',
  'workbench.editors.scriptEditor.snippet.mqttAssertJson': '페이로드가 JSON 형식임',
  'workbench.editors.scriptEditor.snippet.mqttSaveMessageValue': '페이로드 값을 변수에 저장',
  'workbench.editors.scriptEditor.snippet.mqttClosedClean': '정상 연결 해제됨',
  'workbench.editors.scriptEditor.snippet.mqttMessageCount': '메시지가 도착함',
  'workbench.editors.scriptEditor.group.invoke': '호출',
  'workbench.editors.scriptEditor.snippet.grpcSetMetadata': '메타데이터 쌍 설정',
  'workbench.editors.scriptEditor.snippet.grpcRemoveMetadata': '메타데이터 쌍 제거',
  'workbench.editors.scriptEditor.snippet.grpcSetMessage': '요청 메시지 다시 쓰기',
  'workbench.editors.scriptEditor.snippet.grpcLogCall': '호출 로그 남기기',
  'workbench.editors.scriptEditor.snippet.grpcLogMessage': '디코딩된 메시지 로그 남기기',
  'workbench.editors.scriptEditor.snippet.grpcCountMessages': '호출 전체의 메시지 수 세기',
  'workbench.editors.scriptEditor.snippet.grpcAssertDecoded': '메시지가 디코딩됨',
  'workbench.editors.scriptEditor.snippet.grpcAssertField': '메시지 필드가 설정됨',
  'workbench.editors.scriptEditor.snippet.grpcSaveMessageValue': '메시지 값을 변수에 저장',
  'workbench.editors.scriptEditor.snippet.grpcStatusOk': '상태가 OK임',
  'workbench.editors.scriptEditor.snippet.grpcMessageCount': '메시지가 도착함',
  'workbench.editors.scriptEditor.snippet.grpcTrailerCheck': '트레일러가 있음',
  'workbench.editors.scriptEditor.snippet.logRequest': '요청 로그 남기기',
  'workbench.editors.scriptEditor.snippet.parseJsonBody': 'JSON 본문 파싱',
  'workbench.editors.scriptEditor.snippet.findResponseHeader': '응답 헤더 찾기',
  'workbench.editors.scriptEditor.snippet.logResponse': '응답 로그 남기기',
  'workbench.editors.scriptEditor.snippet.logDial': '다이얼 로그 남기기',
  'workbench.editors.scriptEditor.snippet.logOutgoingMessage': '보내는 메시지 로그 남기기',
  'workbench.editors.scriptEditor.snippet.logMessage': '메시지 로그 남기기',
  'workbench.editors.scriptEditor.snippet.logClose': '종료 로그 남기기',
  'workbench.editors.scriptEditor.snippet.wsReplyBinary': '바이너리 프레임으로 회신',
  'workbench.editors.scriptEditor.snippet.wsNothingDropped': '폐기된 것이 없음',
  'workbench.editors.scriptEditor.snippet.mqttSetResponseTopic': '응답 토픽 설정',
  'workbench.editors.scriptEditor.snippet.mqttSetPublishUserProperty': 'PUBLISH 사용자 속성 설정',
  'workbench.editors.scriptEditor.snippet.mqttConnackAccepted': '브로커가 세션을 수락함',
  'workbench.editors.scriptEditor.snippet.grpcLogStatus': '상태 로그 남기기',
} as const satisfies Catalog;
