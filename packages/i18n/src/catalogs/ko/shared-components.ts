/**
 * Shared component families — Korean. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for
 * the family map and the raw technical plane (`{{ns.*}}` references,
 * claim/algorithm names, key caps and glyphs, format examples). Mints:
 * 변수 = variable; 환경 = environment; 컬렉션 = collection; 시크릿 =
 * secret; 생성기 = generator; 범위 = scope; 참조 = reference; 오래됨 =
 * stale; 캡처 = capture; 도크 = dock; 도구 창 = tool window; 목차 =
 * table of contents; 매개변수 = parameter; 지시문 = directive; 모의 =
 * mock; 삽입 = inject; 폐기 = drop; 교체 = replace. JWT part names
 * (Header / Payload / Signature) and header field names ride raw —
 * RFC vocabulary. The two peer-execute notices quote the Backup and
 * Sync › Your devices row labels — the ko settings file quotes THESE
 * values verbatim when it lands.
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': '값 편집',
  'shared.templateInput.showValue': '값 표시',
  'shared.templateInput.hideValue': '값 숨기기',
  'shared.templateInput.clearValue': '값 지우기',
  'shared.templateInput.unresolvedDot': '해결되지 않은 변수가 있습니다',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': '“{name}” 변수 만들기',
  'shared.templateInput.createNamedInScope': '{scope}에 “{name}” 변수 만들기',
  'shared.templateInput.noMatches': '일치 항목 없음',
  'shared.templateInput.footerNavigate': '↑↓ 이동',
  'shared.templateInput.footerSelect': '↵ 선택',
  'shared.templateInput.footerClose': 'esc 닫기',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': '실행 시 캡처',
  'shared.templateInput.totpPreview': 'TOTP {digits}자리 · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP {digits}자리 · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(비어 있음)',
  'shared.templateInput.staleBadge': '오래됨',
  'shared.templateInput.needsRerunBadge': '재실행 필요',
  'shared.templateInput.disabledBadge': '비활성',
  'shared.templateInput.scaffold.vault': '시크릿 추가',
  'shared.templateInput.scaffold.env': '환경 변수 추가',
  'shared.templateInput.scaffold.collection': '컬렉션 변수 추가',
  'shared.templateInput.scaffold.workspace': '워크스페이스 변수 추가',
  'shared.templateInput.scaffold.dynamic': '내장 생성기: uuid, timestamp, …',
  'shared.templateInput.reservedFile': '파일 참조는 곧 지원됩니다',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': '값 입력',
  'shared.templateInput.foundIn': '발견 위치:',
  'shared.templateInput.scopeFixedTooltip': '범위는 {prefix} 접두사로 고정되어 있습니다. 변경하려면 참조를 편집하세요.',
  'shared.templateInput.addToScope': '추가 위치: {scope}',
  'shared.templateInput.addToPickScope': '추가 위치: 범위 선택',
  'shared.templateInput.resolvedDefault': '해결 결과: 기본값',
  'shared.templateInput.resolvedDefaultNoEnv': '해결 결과: 기본값 (활성 환경 없음)',
  'shared.templateInput.noActiveEnvHint':
    '선택된 환경이 없습니다. 환경 변수를 추가하려면 환경 전환기에서 환경을 선택하세요.',
  'shared.templateInput.noCollectionHint': '활성 컬렉션이 없습니다. 컬렉션 변수를 추가하려면 컬렉션을 여세요.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': '환경 · {name}',
  'shared.templateInput.scope.collectionNamed': '컬렉션 · {name}',
  'shared.templateInput.scope.workspace': '워크스페이스',
  'shared.templateInput.scope.live': '라이브',
  'shared.templateInput.scope.liveOverride': '라이브 · 재정의',
  'shared.templateInput.scope.stepNamed': '단계 · {capture}',
  'shared.templateInput.scope.fileNamed': '파일 · {name}',
  'shared.templateInput.scope.dynamic': '동적',
  'shared.templateInput.scope.unresolved': '미해결',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': '환경',
  'shared.templateInput.createScope.collection': '컬렉션',
  'shared.templateInput.createScope.workspace': '워크스페이스',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': '활성 환경 없음',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': '빈 참조',
  'shared.templateInput.unresolved.unknownNamespace': '알 수 없는 네임스페이스',
  'shared.templateInput.unresolved.dynamic':
    '그런 이름의 내장 생성기가 없습니다. {{dynamic.…}} 제안 목록에서 하나를 선택하세요.',
  'shared.templateInput.unresolved.step': '라이브 워크플로 체인이 실행 중일 때만 해결됩니다.',
  'shared.templateInput.unresolved.envNotSet': '“{name}” 환경에 설정되어 있지 않습니다.',
  'shared.templateInput.unresolved.noActiveEnv': '활성 환경이 선택되어 있지 않습니다.',
  'shared.templateInput.unresolved.live': '그런 이름의 라이브 변수가 없습니다 (또는 아직 캐시된 값이 없습니다).',
  'shared.templateInput.unresolved.notDefined': '어떤 범위에도 정의되어 있지 않습니다.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': '“추가 위치”에서 범위를 선택하세요',
  'shared.templateInput.save.totpInVaultEditor': 'TOTP 시크릿은 Vault 편집기에서 편집해야 합니다',
  'shared.templateInput.save.vaultKindChanged': 'Vault 항목의 종류가 편집 중에 바뀌었습니다',
  'shared.templateInput.save.notEditable': '편집할 수 없음',
  'shared.templateInput.save.noActiveEnv': '활성 환경 없음',
  'shared.templateInput.save.noCollection': '컨텍스트에 컬렉션이 없습니다',
  'shared.templateInput.save.saved': '저장됨',
  'shared.templateInput.save.duplicateName': '같은 이름의 변수가 이 범위에 이미 있습니다.',
  'shared.templateInput.save.notFound': '변수를 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'shared.templateInput.save.failed': '저장 실패',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': '변수로 설정',
  'shared.templateInput.setAsNewVariable': '새 변수로 설정',
  'shared.templateInput.variableName': '변수 이름',
  'shared.templateInput.variableValue': '변수 값',
  'shared.templateInput.valuePlaceholder': '값',
  'shared.templateInput.menu.cut': '잘라내기',
  'shared.templateInput.menu.paste': '붙여넣기',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Vault 시크릿',
  'shared.templateInput.completion.scope.env': '환경',
  'shared.templateInput.completion.scope.collection': '컬렉션',
  'shared.templateInput.completion.scope.workspace': '워크스페이스',
  'shared.templateInput.completion.scope.live': '소스',
  'shared.templateInput.completion.scope.step': '소스 플로 단계 캡처',
  'shared.templateInput.completion.scope.file': '파일 참조',
  'shared.templateInput.completion.scope.dynamic': '동적 생성기',
  'shared.templateInput.completion.staleSuffix': '(오래됨)',
  'shared.templateInput.completion.comingSoon': '곧 지원',
  'shared.templateInput.completion.capturedAtRuntime': '실행 시 캡처',
  'shared.templateInput.completion.totpDetail': 'TOTP 코드 ({digits}자리, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': '값이 숨겨져 있습니다 (민감한 범위).',
  'shared.templateInput.completion.valueHiddenStale': '값이 숨겨져 있습니다 (오래된 라이브 변수).',
  'shared.templateInput.completion.valueDoc': '**값:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**오래된 값:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': '워크플로가 실행될 때 캡처됩니다.',
  'shared.templateInput.completion.totpDoc': '**TOTP 코드**: {algorithm}, {digits}자리, {period}s마다 갱신.',
  'shared.templateInput.completion.totpDocIssuer':
    '**{issuer}**의 **TOTP 코드**: {algorithm}, {digits}자리, {period}s마다 갱신.',
  'shared.templateInput.completion.secretManagerDoc':
    '**시크릿 관리자 참조**: `{reference}`. 전송 시점에 관리자에서 해결되며 값은 저장되지 않습니다.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': '디코딩됨',
  'shared.valueEditors.encodedPreview': '인코딩 미리보기',
  'shared.valueEditors.cannotEncode': '인코딩할 수 없습니다. 편집한 값이 이 유형에 유효하지 않습니다',
  'shared.valueEditors.encodedCopied': '인코딩된 값을 클립보드에 복사했습니다',
  'shared.valueEditors.copyFailed': '클립보드에 복사하지 못했습니다',
  'shared.valueEditors.openAsDocument': '문서로 열기',
  'shared.valueEditors.decode': '디코딩',
  'shared.valueEditors.decodeChipView': '디코딩 결과 보기: {title}',
  'shared.valueEditors.decodeChipEdit': '디코딩하여 편집: {title}',
  'shared.valueEditors.editJwt': 'JWT 편집',
  'shared.valueEditors.viewJwt': 'JWT 보기',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': '디코딩된 값',
  'shared.valueEditors.glance.openTab': '새 탭에서 열기',
  'shared.valueEditors.glance.openModal': '모달로 열기',
  'shared.valueEditors.glance.moreClaims': '+{count}개 더',
  'shared.valueEditors.glance.signatureElided':
    'Signature 부분은 표시되지 않습니다. 전체 token 값은 문서나 모달로 여세요.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': '이름',
  'shared.valueEditors.grid.key': '키',
  'shared.valueEditors.grid.value': '값',
  'shared.valueEditors.grid.flag': '플래그',
  'shared.valueEditors.grid.ariaNamePairs': '이름/값 쌍',
  'shared.valueEditors.grid.ariaKeyPairs': '키/값 쌍',
  'shared.valueEditors.grid.ariaRowName': '{row}행 이름',
  'shared.valueEditors.grid.ariaRowKey': '{row}행 키',
  'shared.valueEditors.grid.ariaRowValue': '{row}행 값',
  'shared.valueEditors.grid.moveRowUp': '{row}행 위로 이동',
  'shared.valueEditors.grid.moveRowDown': '{row}행 아래로 이동',
  'shared.valueEditors.grid.deleteRow': '{row}행 삭제',
  'shared.valueEditors.grid.addRow': '행 추가',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'JWT 편집기',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': '수정됨',
  'shared.valueEditors.jwt.decodeErrorTitle': 'token 값을 디코딩할 수 없습니다',
  'shared.valueEditors.jwt.decoded': '디코딩됨',
  'shared.valueEditors.jwt.encoded': '인코딩됨',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': '클레임:',
  'shared.valueEditors.jwt.rawToken': '원본 token',
  'shared.valueEditors.jwt.pasteOrEdit': '원본 token 값을 붙여넣거나 편집하세요',
  'shared.valueEditors.jwt.notDecodable': '디코딩할 수 있는 JWT 형식이 아닙니다',
  'shared.valueEditors.jwt.structure': '구조:',
  'shared.valueEditors.jwt.resignWithSecret': '시크릿으로 다시 서명',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} (header 기준)',
  'shared.valueEditors.jwt.signingSecret': '서명 시크릿',
  'shared.valueEditors.jwt.secretMemoryNote': '메모리에만 보관되며 편집기를 닫으면 폐기됩니다.',
  'shared.valueEditors.jwt.tokenExpired': 'token 만료됨',
  'shared.valueEditors.jwt.tokenNotExpired': 'token 만료되지 않음',
  'shared.valueEditors.jwt.expiredOn': '{date}에 만료됨',
  'shared.valueEditors.jwt.expiresOn': '{date}에 만료 예정',
  'shared.valueEditors.jwt.resigned': 'token 값을 {algorithm} 알고리즘으로 다시 서명했습니다',
  'shared.valueEditors.jwt.resignedDescription':
    '저장하면 내 시크릿으로 서명한 token 값이 기록됩니다. 위의 미리보기가 그대로 저장됩니다.',
  'shared.valueEditors.jwt.cannotResign': '이 알고리즘은 다시 서명할 수 없습니다',
  'shared.valueEditors.jwt.cannotResignDescription':
    '여기서는 HMAC 알고리즘 (HS256, HS384, HS512)만 다시 서명할 수 있습니다. 대신 원래 서명이 그대로 유지됩니다.',
  'shared.valueEditors.jwt.signError': 'token 값에 서명할 수 없습니다',
  'shared.valueEditors.jwt.signatureInvalid': '서명이 더 이상 유효하지 않습니다',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    '원래 서명이 그대로 유지되므로 서명을 검증하는 서버는 편집된 token 값을 거부합니다. 다시 서명하려면 서명 시크릿을 입력하세요.',
  'shared.valueEditors.jwt.copied': 'JWT 값을 클립보드에 복사했습니다',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'JWT 페이로드',
  'shared.valueEditors.valueTitle.urlEncoded': 'URL 인코딩된 값',
  'shared.valueEditors.valueTitle.base64': 'Base64 값',
  'shared.valueEditors.valueTitle.hex': '16진수 인코딩된 값',
  'shared.valueEditors.valueTitle.timestamp': 'Unix 타임스탬프',
  'shared.valueEditors.valueTitle.json': 'JSON 값',
  'shared.valueEditors.valueTitle.jsonString': '따옴표로 묶인 문자열',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Cookie 값',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'HTTP 날짜',
  'shared.valueEditors.valueTitle.queryString': '쿼리 문자열',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Link 헤더',
  'shared.valueEditors.valueTitle.authParams': 'Authorization 매개변수',
  'shared.valueEditors.valueTitle.acceptList': 'Accept 목록',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Vault 시크릿',
  'shared.scopeColors.environment': '환경 변수',
  'shared.scopeColors.collection': '컬렉션 변수',
  'shared.scopeColors.workspace': '워크스페이스 변수',
  'shared.scopeColors.live': '라이브 변수 (워크플로 기반)',
  'shared.scopeColors.step': '워크플로 단계 캡처',
  'shared.scopeColors.file': '파일 참조',
  'shared.scopeColors.dynamic': '동적 생성기',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'JWT 형식으로 편집',
  'shared.valueEditors.editTooltip.urlEncoded': 'URL 인코딩된 값 편집',
  'shared.valueEditors.editTooltip.base64': 'Base64 값 편집',
  'shared.valueEditors.editTooltip.hex': '16진수 인코딩된 값 편집',
  'shared.valueEditors.editTooltip.timestamp': '타임스탬프 편집',
  'shared.valueEditors.editTooltip.json': 'JSON 형식으로 편집',
  'shared.valueEditors.editTooltip.jsonString': '따옴표로 묶인 문자열 편집',
  'shared.valueEditors.editTooltip.dataUri': 'Data URI 내용 편집',
  'shared.valueEditors.editTooltip.cookie': 'Cookie 쌍 편집',
  'shared.valueEditors.editTooltip.csp': 'CSP 지시문 편집',
  'shared.valueEditors.editTooltip.httpDate': 'HTTP 날짜 편집',
  'shared.valueEditors.editTooltip.queryString': '쿼리 쌍 편집',
  'shared.valueEditors.editTooltip.cacheControl': '캐시 지시문 편집',
  'shared.valueEditors.editTooltip.hsts': 'HSTS 지시문 편집',
  'shared.valueEditors.editTooltip.contentDisposition': 'Disposition 매개변수 편집',
  'shared.valueEditors.editTooltip.link': '링크 편집',
  'shared.valueEditors.editTooltip.authParams': '인증 매개변수 편집',
  'shared.valueEditors.editTooltip.acceptList': 'Accept 목록 편집',

  // ── Default entity names ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': '새 규칙 컬렉션',
  'shared.defaults.newRequestsCollection': '새 요청 컬렉션',
  'shared.defaults.newEnvironment': '새 환경',
  'shared.defaults.newSpec': '새 사양',

  // ── Rule-type registry ─────────────────────────────────────────────
  'shared.ruleTypes.header.label': '헤더 수정',
  'shared.ruleTypes.header.description': 'HTTP 헤더를 추가, 재정의 또는 제거합니다',
  'shared.ruleTypes.requestBody.label': 'API 요청 본문 수정',
  'shared.ruleTypes.requestBody.description': 'API 요청 본문을 재정의하거나 변환합니다 (fetch/XHR만)',
  'shared.ruleTypes.response.label': 'API 응답 수정',
  'shared.ruleTypes.response.description': 'API 응답의 상태, 본문, 헤더를 모의 처리하거나 수정합니다 (fetch/XHR만)',
  'shared.ruleTypes.queryParam.label': '쿼리 매개변수 수정',
  'shared.ruleTypes.queryParam.description': 'URL 매개변수를 추가, 재정의 또는 제거합니다',
  'shared.ruleTypes.inject.label': '스크립트/스타일시트 삽입',
  'shared.ruleTypes.inject.description': '페이지에 JavaScript 또는 CSS 코드를 삽입합니다',
  'shared.ruleTypes.ws.label': 'WebSocket 메시지 수정',
  'shared.ruleTypes.ws.description': 'WebSocket 프레임을 교체, 삽입 또는 폐기합니다 (페이지 소켓만)',
  'shared.ruleTypes.sse.label': 'Server-Sent Events 수정',
  'shared.ruleTypes.sse.description': 'SSE 이벤트를 교체, 삽입 또는 폐기합니다 (페이지 스트림만)',
  'shared.ruleTypes.block.label': '요청 차단',
  'shared.ruleTypes.block.description': '요청이 완료되지 않도록 막습니다',
  'shared.ruleTypes.redirect.label': '요청 리디렉션',
  'shared.ruleTypes.redirect.description': '다른 URL 주소로 리디렉션합니다',
  'shared.ruleTypes.delay.label': '요청 지연',
  'shared.ruleTypes.delay.description': '네트워크 요청에 지연을 추가합니다 (fetch/XHR만)',
  'shared.ruleTypes.auth.label': '인증 챌린지 응답',
  'shared.ruleTypes.auth.description': 'HTTP/프록시 인증 챌린지에 자격 증명을 제공합니다 (디버그 모드 필요)',

  // ── Request-kind registry ──────────────────────────────────────────
  'shared.requestKinds.http.label': 'HTTP',
  'shared.requestKinds.grpc.label': 'gRPC',
  'shared.requestKinds.websocket.label': 'WebSocket',
  'shared.requestKinds.socketio.label': 'Socket.IO',
  'shared.requestKinds.mqtt.label': 'MQTT',
  'shared.requestKinds.graphql.label': 'GraphQL',

  // ── System rule-template registry ──────────────────────────────────
  'shared.ruleTemplates.blankRule': '빈 규칙',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS 및 보안',
  'shared.ruleTemplates.folder.authentication': '인증',
  'shared.ruleTemplates.folder.privacy': '개인정보 보호',
  'shared.ruleTemplates.folder.testing': '테스트',
  'shared.ruleTemplates.folder.urlHandling': 'URL 처리',
  'shared.ruleTemplates.folder.tracking': '추적',
  'shared.ruleTemplates.folder.debugging': '디버깅',
  'shared.ruleTemplates.folder.appearance': '외관',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': '상태 코드',
  'shared.ruleTemplates.folder.dynamic': '동적',

  'shared.ruleTemplates.corsBypass.name': 'CORS 우회',
  'shared.ruleTemplates.corsBypass.description': '개발 중 교차 출처 요청을 허용하도록 제한적인 CORS 헤더를 제거합니다',
  'shared.ruleTemplates.removeCsp.name': 'CSP 제거',
  'shared.ruleTemplates.removeCsp.description': '개발용으로 Content-Security-Policy 헤더를 제거합니다',
  'shared.ruleTemplates.allowEmbedding.name': '임베딩 허용',
  'shared.ruleTemplates.allowEmbedding.description': 'iframe 삽입을 허용하도록 X-Frame-Options 헤더를 제거합니다',
  'shared.ruleTemplates.apiAuth.name': 'API 인증 삽입',
  'shared.ruleTemplates.apiAuth.description': 'API 호출에 Authorization 헤더를 자동으로 삽입합니다',
  'shared.ruleTemplates.customUa.name': '사용자 지정 User-Agent',
  'shared.ruleTemplates.customUa.description': '특정 도메인에서 User-Agent 헤더를 재정의합니다',
  'shared.ruleTemplates.blockCookies.name': 'Cookie 차단',
  'shared.ruleTemplates.blockCookies.description': '나가는 요청에서 Cookie 헤더를 제거합니다',
  'shared.ruleTemplates.testMerge.name': '병합 테스트 (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    '응답 헤더에 덧붙여 병합 작업을 테스트합니다.\n1. 이 규칙을 활성화합니다\n2. 새 탭에서 httpbin.org 페이지를 엽니다\n' +
    '3. 콘솔에서 실행: fetch("https://httpbin.org/get").then(r=>{console.log("Content-Type:",' +
    'r.headers.get("Content-Type"))})\n4. Content-Type 값이 다음과 같이 표시되어야 합니다: "application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': '추적기 차단',
  'shared.ruleTemplates.blockTrackers.description': '분석 및 추적 스크립트를 차단합니다',
  'shared.ruleTemplates.blockAds.name': '광고 차단',
  'shared.ruleTemplates.blockAds.description': '일반적인 광고 네트워크 도메인을 차단합니다',
  'shared.ruleTemplates.redirectDomain.name': '도메인 리디렉션',
  'shared.ruleTemplates.redirectDomain.description': '한 도메인의 모든 트래픽을 다른 도메인으로 리디렉션합니다',
  'shared.ruleTemplates.forceHttps.name': 'HTTPS 강제',
  'shared.ruleTemplates.forceHttps.description':
    'HTTP 요청을 HTTPS 요청으로 업그레이드합니다. 정규식 캡처 그룹으로 전체 경로를 유지합니다',
  'shared.ruleTemplates.removeUtm.name': 'UTM 매개변수 제거',
  'shared.ruleTemplates.removeUtm.description': 'URL 주소에서 UTM 추적 매개변수를 제거합니다',
  'shared.ruleTemplates.addDebug.name': '디버그 플래그 추가',
  'shared.ruleTemplates.addDebug.description': 'API 호출에 debug=true 쿼리 매개변수를 추가합니다',
  'shared.ruleTemplates.darkMode.name': '다크 모드 CSS',
  'shared.ruleTemplates.darkMode.description': '기본적인 다크 모드 스타일시트를 삽입합니다',
  'shared.ruleTemplates.consoleLogger.name': '콘솔 로거',
  'shared.ruleTemplates.consoleLogger.description': '모든 fetch 요청을 콘솔에 기록합니다',
  'shared.ruleTemplates.slowApi.name': '느린 API (2s)',
  'shared.ruleTemplates.slowApi.description': 'API 호출에 2초 지연을 추가합니다. 로딩 상태 테스트용',
  'shared.ruleTemplates.timeoutTest.name': '시간 초과 테스트 (5s)',
  'shared.ruleTemplates.timeoutTest.description': '5초 지연을 추가합니다. 시간 초과 처리 테스트용',
  'shared.ruleTemplates.restBodyOverride.name': 'REST 본문 재정의',
  'shared.ruleTemplates.restBodyOverride.description': '요청 본문을 정적 JSON 페이로드로 교체합니다',
  'shared.ruleTemplates.graphqlOverride.name': 'GraphQL 재정의',
  'shared.ruleTemplates.graphqlOverride.description': 'GraphQL 요청 본문을 사용자 지정 쿼리와 변수로 재정의합니다',
  'shared.ruleTemplates.mock200.name': '모의 200 JSON',
  'shared.ruleTemplates.mock200.description': 'REST API 엔드포인트에 성공 JSON 응답을 반환합니다',
  'shared.ruleTemplates.mock404.name': '모의 404',
  'shared.ruleTemplates.mock404.description': '404 Not Found 응답을 반환합니다',
  'shared.ruleTemplates.mock500.name': '모의 서버 오류',
  'shared.ruleTemplates.mock500.description': '500 Internal Server Error 응답을 반환합니다. 오류 처리 테스트용',
  'shared.ruleTemplates.mockGraphql.name': '모의 GraphQL 응답',
  'shared.ruleTemplates.mockGraphql.description': '특정 GraphQL 작업에 사용자 지정 응답을 반환합니다',
  'shared.ruleTemplates.mockDynamic.name': '동적 REST 응답',
  'shared.ruleTemplates.mockDynamic.description':
    '실제 REST API 응답을 가로채 JavaScript 코드로 수정합니다. 테스트 데이터 삽입, 필드 제거, 응답 구조 변환에 사용합니다',
  'shared.ruleTemplates.mockDynamicGraphql.name': '동적 GraphQL 응답',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    '특정 GraphQL 작업의 응답을 가로채 JavaScript 코드로 수정합니다. 데이터 재구성, 모의 필드 삽입, 오류 시뮬레이션에 사용합니다',

  // ── Dock-layout chrome ─────────────────────────────────────────────
  'shared.dock.slot.leftTop': '왼쪽 위',
  'shared.dock.slot.leftBottom': '왼쪽 아래',
  'shared.dock.slot.rightTop': '오른쪽 위',
  'shared.dock.slot.rightBottom': '오른쪽 아래',
  'shared.dock.slot.bottomLeft': '아래쪽 왼쪽',
  'shared.dock.slot.bottomRight': '아래쪽 오른쪽',
  'shared.dock.slot.bottomTop': '아래쪽 상단',
  'shared.dock.slot.bottomBottom': '아래쪽 하단',
  'shared.dock.hide': '숨기기',
  'shared.dock.moveTo': '이동 위치',
  'shared.dock.currentSlot': '현재 슬롯',
  'shared.dock.showToolWindowNames': '도구 창 이름 표시',
  'shared.dock.hideThisDock': '이 도크 숨기기',
  'shared.dock.closeDock': '도크 닫기',
  'shared.dock.panelOptions': '패널 옵션',
  'shared.dock.hidePanel': '패널 숨기기',

  // ── Docs panel chrome ──────────────────────────────────────────────
  'shared.docs.title': '문서',
  'shared.docs.contents': '목차',
  'shared.docs.ariaOpenToc': '목차 열기',
  'shared.docs.ariaCloseToc': '목차 닫기',
  'shared.docs.filterPlaceholder': '섹션 필터',
  'shared.docs.noMatches': '일치 항목 없음',
  'shared.docs.hint.navigate': '이동',
  'shared.docs.hint.open': '열기',
  'shared.docs.hint.back': '뒤로',
  'shared.docs.hint.contents': '목차',
  'shared.docs.previous': '이전',
  'shared.docs.next': '다음',
  'shared.docs.previousTooltip': '이전: {title}',
  'shared.docs.nextTooltip': '다음: {title}',

  // ── Docs section primitives ────────────────────────────────────────
  'shared.docs.callout.note': '참고',
  'shared.docs.callout.warning': '경고',
  'shared.docs.callout.tip': '팁',
  'shared.docs.callout.limitation': '제한 사항',
  'shared.docs.example.rule': '규칙:',
  'shared.docs.example.before': '적용 전:',
  'shared.docs.example.after': '적용 후:',
  'shared.docs.example.appliesTo': '적용 대상:',
  'shared.docs.example.wontApply': '적용되지 않음:',
  'shared.docs.example.suggestion': '제안:',
  'shared.docs.onThisPage': '이 페이지의 내용',
  'shared.docs.copyCode': '코드 복사',
  'shared.docs.surfaces.header': '표시되는 위치',
  'shared.docs.surfaces.popup': '팝업',
  'shared.docs.surfaces.sidePanel': '사이드 패널',
  'shared.docs.surfaces.workbench': '워크벤치',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': '스크립트 기반',

  // ── Split-layout orientation ───────────────────────────────────────
  'shared.splitLayout.horizontal': '가로 레이아웃: 좌우 배치',
  'shared.splitLayout.vertical': '세로 레이아웃: 상하 배치',

  // ── Desktop teaser + shared editor chrome ──────────────────────────
  'shared.timelineGroup.showOlder': '이전 {count}개 표시',
  'shared.codeEditor.wrap': '줄 바꿈',
  'shared.codeEditor.find': '찾기',
  'shared.codeEditor.replace': '바꾸기',
  'shared.codeEditor.format': '서식 지정',
  'shared.codeEditor.formatError': '서식을 지정할 수 없습니다: 구문 분석 오류',
  'shared.editorMenu.label': '편집기',
  'shared.editorMenu.thisEditor': '이 편집기',
  'shared.editorMenu.allEditors': '모든 편집기',
  'shared.editorMenu.lineNumbers': '줄 번호',
  'shared.editorMenu.whitespace': '공백 문자',
  'shared.editorMenu.lineEnds': '줄 끝 문자',
  'shared.timelineGroup.showNewestOnly': '최신 {count}개만 표시',
  'shared.peerExecute.localDisabled':
    '이 기기의 브라우저에서 보내기가 데스크톱 앱에서 꺼져 있습니다. 백업 및 동기화 › 내 기기에서 “이 기기의 브라우저가 요청을 보내도록 허용”을 활성화하세요.',
  'shared.peerExecute.remoteDisabled':
    '다른 기기에서 보내기가 연결된 호스트에서 꺼져 있습니다. 해당 컴퓨터의 백업 및 동기화 › 내 기기에서 “연결된 다른 기기가 요청을 보내도록 허용”을 활성화하세요.',
  'shared.peerExecute.enableCta': '데스크톱 앱에서 활성화',
  // ── Execution place (the chip beside Send / Connect / Invoke) ───────
  'shared.executionPlace.info': '이 요청의 실행 위치',
  'shared.executionPlace.chip.here': '여기에서 실행',
  'shared.executionPlace.chip.desktopApp': '데스크톱 앱에서 실행',
  'shared.executionPlace.chip.server': '{place}에서 실행',
  'shared.executionPlace.chip.needsDesktopApp': '데스크톱 앱 필요',
  'shared.executionPlace.chip.notForwarded': '{place}에서는 아직 사용할 수 없음',
  'shared.executionPlace.chip.unavailable': '여기에서는 사용할 수 없음',
  'shared.executionPlace.chip.cannotRunOn': '{place}에서는 아직 실행할 수 없음',
  'shared.executionPlace.role.here': '이 기기',
  'shared.executionPlace.role.desktopApp': '데스크톱 앱',
  'shared.executionPlace.role.server': '서버',
  'shared.executionPlace.reason.runsHere': '이 컴퓨터의 이 앱에서 실행됩니다.',
  'shared.executionPlace.reason.runsHereBrowser': '이 컴퓨터의 확장 프로그램에서 실행됩니다.',
  'shared.executionPlace.reason.runsHerePageRealm': '이 컴퓨터의 확장 프로그램에서 브라우저 소켓을 통해 실행됩니다.',
  'shared.executionPlace.reason.contextSend':
    '연결된 백엔드인 {place}에서 전송하고 그곳에서 해석합니다. 대상에는 그 머신의 주소와 네트워크 위치가 보입니다.',
  'shared.executionPlace.reason.companionInvoke':
    'gRPC 호출은 이 컴퓨터의 데스크톱 앱으로 전달됩니다. 브라우저에는 트레일러를 노출하는 HTTP/2 스택이 없습니다.',
  'shared.executionPlace.reason.companionRequired':
    '호출하려면 데스크톱 앱을 연결하세요. 작성과 저장은 여기에서 할 수 있습니다.',
  'shared.executionPlace.reason.tcpScheme':
    'mqtt:// 및 mqtts:// 주소는 브라우저가 열 수 없는 원시 TCP 소켓을 엽니다. 이 요청을 데스크톱 앱에서 열거나, ws:// 또는 wss:// 주소로 바꿔 여기에서 연결하세요.',
  'shared.executionPlace.reason.sessionNotForwarded': '세션은 아직 {place}에 전달되지 않습니다.',
  'shared.executionPlace.reason.noRuntime': '이 종류의 요청은 데스크톱 앱이나 서버에서 실행됩니다.',
  'shared.executionPlace.reason.delegatedDesktopApp':
    '여기에서 확인한 뒤 데스크톱 앱에서 이 요청을 대신해 연결을 엽니다.',
  'shared.executionPlace.reason.delegatedServer':
    '여기에서 확인한 뒤 {place}에서 이 요청을 대신해 연결을 엽니다. 확인된 값(비밀 포함)이 그곳으로 전송됩니다.',
  'shared.executionPlace.picker.title': '실행 위치',
  'shared.executionPlace.option.here': '이 기기',
  'shared.executionPlace.option.desktopApp': '데스크톱 앱',
  'shared.executionPlace.option.server': '서버',
  'shared.executionPlace.knob.cookieJar': 'Cookie 저장소',
  'shared.executionPlace.knobsNotApplied': '{place}에서는 적용되지 않습니다: {knobs}.',
  'shared.executionPlace.reason.preferenceUnavailable':
    '이 요청은 {place}에서 실행하도록 설정되어 있지만, 여기에서는 아직 실행할 수 없습니다.',
  'shared.desktopTeaser.cta': '데스크톱 앱 다운로드',
  'shared.desktopTeaser.openApp': '데스크톱 앱에서 열기',
  'shared.desktopTeaser.launchApp': '데스크톱 앱 열기',
  'shared.desktopTeaser.otherPlatforms': '다른 플랫폼 및 채널',
  'shared.desktopTeaser.terminal.title': '통합 터미널',
  'shared.desktopTeaser.terminal.body':
    '워크스페이스 안에서 실제 터미널을 엽니다. 내 셸이 규칙과 요청 바로 옆에서 로컬로 실행됩니다.',
  'shared.desktopTeaser.git.title': 'Git 기록',
  'shared.desktopTeaser.git.body':
    '커밋별 상세 정보와 파일별 변경 내용을 포함해 워크스페이스의 커밋 타임라인을 살펴봅니다.',
  'shared.desktopTeaser.commit.title': '커밋',
  'shared.desktopTeaser.commit.body':
    '워크스페이스의 변경 사항을 검토하고 커밋합니다. 체크할 수 있는 파일 트리, 파일별 변경 내용, 커밋 메시지 입력란을 제공합니다.',
  'shared.desktopTeaser.proxy.title': '캡처 프록시',
  'shared.desktopTeaser.proxy.body': '내장 프록시로 실시간 HTTP(S) 트래픽을 캡처하고 모든 요청을 발생 즉시 검사합니다.',
  'shared.desktopTeaser.mcp.title': 'AI · MCP 서버',
  'shared.desktopTeaser.mcp.body': '내장 MCP 서버를 통해 AI 어시스턴트를 워크스페이스에 연결합니다.',
  'shared.desktopTeaser.liveNetwork.title': '라이브 네트워크',
  'shared.desktopTeaser.liveNetwork.body':
    '확장 프로그램에서 스트리밍되는 브라우저 탭의 트래픽을 데스크톱 앱에서 실시간으로 확인합니다. DevTools 창은 필요 없습니다.',

  // ── Settings rows ──────────────────────────────────────────────────
  'shared.settingsRows.enabled': '활성',
  'shared.settingsRows.disabled': '비활성',
  'shared.settingsRows.reset': '{label} 값을 기본값으로 재설정',
} as const satisfies Catalog;
