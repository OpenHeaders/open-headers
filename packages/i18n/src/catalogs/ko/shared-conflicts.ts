/**
 * Shared conflicts family — Korean. Mirrors
 * `catalogs/en/shared-conflicts.ts` key for key; schema paths, entity
 * uids, {name}/{step}/{uid} wire data and identifier leaf labels
 * (dependsOn, runIf, priorityFrom, id, timeout — de precedent) stay
 * raw; `seed` rides raw (S67/S75 + de precedent); `Cookie 저장소` = the
 * capitalized en `Cookie jar` label (the case-exact glossary trap —
 * 쿠키 저장소 stays the prose form). Mints: 외부 변경 = external
 * change; 내 것 유지 = keep mine / 저장본 사용 = use saved; 사양 = spec
 * (carried from shared-components); bodies stay 요청 본문 / 응답 본문;
 * 인가 = Authorization (field-label referent — the raw header name
 * Authorization stays raw; carried from panel-inspector-headers' 인가
 * 스킴); 캡처 carried; 추출기 = extractor; 재시도 정책 = retry policy;
 * 암호 구문 = passphrase; 자격 증명 carried. The en aside dash in the
 * order-changed labels restructures into `:`; leaf/label holes carry
 * localized words and sit inside half-width parens. `{noun}` takes the
 * invariant 에 (never 이/가) — `{noun}에 외부 변경이 있었습니다`.
 */

import type { Catalog } from '../../types';

export const sharedConflicts = {
  // ── Entity banner ──────────────────────────────────────────────────
  'shared.conflicts.banner.changedExternally': '편집하는 동안 {noun}에 외부 변경이 있었습니다.',
  'shared.conflicts.banner.fieldsNoun': '필드',
  'shared.conflicts.banner.review': '변경 검토',
  'shared.conflicts.banner.keepAllMine': '모두 내 것 유지',
  'shared.conflicts.banner.useAllSaved': '모두 저장본 사용',

  // ── Merge-dialog shim ──────────────────────────────────────────────
  'shared.conflicts.dialog.title': '외부 변경 해결',

  // ── Per-leaf diff chip ─────────────────────────────────────────────
  'shared.conflicts.chip.trigger': '외부 변경이 있습니다. 클릭하여 해결하세요',
  'shared.conflicts.chip.externalChange': '외부 변경',
  'shared.conflicts.chip.savedValue': '저장된 값',
  'shared.conflicts.chip.yourEdit': '내 편집',
  'shared.conflicts.chip.keepMine': '내 것 유지',
  'shared.conflicts.chip.useSaved': '저장본 사용',
  'shared.conflicts.chip.lastSyncedValue': '마지막 동기화 값',
  'shared.conflicts.chip.empty': '(비어 있음)',

  // ── Set-row removal chip ───────────────────────────────────────────
  'shared.conflicts.rowChip.trigger': '저장된 버전에서 이 행이 제거되었습니다. 클릭하여 해결하세요',
  'shared.conflicts.rowChip.removedExternally': '행이 외부에서 제거됨',
  'shared.conflicts.rowChip.lastSyncedRow': '마지막 동기화 행',
  'shared.conflicts.rowChip.useSavedRemove': '저장본 사용 (제거)',

  // ── Adapter label plane: field-tree walker fallback ────────────────
  'shared.conflicts.label.walker.orderChanged': '{set}: 순서 변경됨',

  // ── Adapter label plane: action entities (rule + template) ─────────
  'shared.conflicts.label.action.set.requestHeader': '요청 헤더',
  'shared.conflicts.label.action.set.responseHeader': '응답 헤더',
  'shared.conflicts.label.action.set.queryParam': '쿼리 매개변수',
  'shared.conflicts.label.action.set.param': '매개변수',
  'shared.conflicts.label.action.set.condition': '조건',
  'shared.conflicts.label.action.orderChanged': '{set}: 순서 변경됨',
  'shared.conflicts.label.action.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.action.name': '이름',
  'shared.conflicts.label.action.conditionLeafLabel': '조건 {leaf}',
  'shared.conflicts.label.action.requestHeaderLeafNamed': '요청 헤더 {name} ({leaf})',
  'shared.conflicts.label.action.requestHeaderLeaf': '요청 헤더 ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeafNamed': '응답 헤더 {name} ({leaf})',
  'shared.conflicts.label.action.responseHeaderLeaf': '응답 헤더 ({leaf})',
  'shared.conflicts.label.action.queryParamLeafNamed': '쿼리 매개변수 {name} ({leaf})',
  'shared.conflicts.label.action.queryParamLeaf': '쿼리 매개변수 ({leaf})',
  'shared.conflicts.label.action.headerLeaf.value': '값',
  'shared.conflicts.label.action.headerLeaf.name': '이름',
  'shared.conflicts.label.action.headerLeaf.operation': '작업',
  'shared.conflicts.label.action.headerLeaf.mergeSeparator': '병합 구분자',
  'shared.conflicts.label.action.paramLeaf.value': '값',
  'shared.conflicts.label.action.paramLeaf.name': '이름',
  'shared.conflicts.label.action.paramLeaf.operation': '작업',
  'shared.conflicts.label.action.conditionLeaf.values': '값 목록',
  'shared.conflicts.label.action.conditionLeaf.type': '유형',
  'shared.conflicts.label.action.conditionLeaf.headerName': '헤더 이름',
  'shared.conflicts.label.action.scalar.redirectTo': '리디렉션 URL',
  'shared.conflicts.label.action.scalar.delayMs': '지연 (ms)',
  'shared.conflicts.label.action.scalar.injectType': '삽입 유형',
  'shared.conflicts.label.action.scalar.source': '삽입 소스',
  'shared.conflicts.label.action.scalar.code': '삽입 코드',
  'shared.conflicts.label.action.scalar.sourceUrl': '삽입 소스 URL',
  'shared.conflicts.label.action.scalar.position': '삽입 위치',
  'shared.conflicts.label.action.scalar.requestBody': '요청 본문',
  'shared.conflicts.label.action.scalar.bodyType': '본문 유형',
  'shared.conflicts.label.action.scalar.resourceType': '리소스 유형',
  'shared.conflicts.label.action.scalar.statusCode': '응답 상태 코드',
  'shared.conflicts.label.action.scalar.responseBody': '응답 본문',
  'shared.conflicts.label.action.scalar.contentType': '응답 콘텐츠 유형',
  'shared.conflicts.label.action.scalar.operation': '작업',
  'shared.conflicts.label.action.scalar.direction': '방향',
  'shared.conflicts.label.action.scalar.eventName': '이벤트 이름',
  'shared.conflicts.label.action.scalar.payload': '메시지 페이로드',
  'shared.conflicts.label.action.scalar.injectTrigger': '삽입 트리거',
  'shared.conflicts.label.action.messageFilter.matchType': '메시지 필터 유형',
  'shared.conflicts.label.action.messageFilter.value': '메시지 필터 값',

  // ── Adapter label plane: variables ─────────────────────────────────
  'shared.conflicts.label.variable.row': '변수',
  'shared.conflicts.label.variable.rowNamed': '변수 {name}',
  'shared.conflicts.label.variable.leafNamed': '변수 {name} ({label})',
  'shared.conflicts.label.variable.leaf': '변수 ({label})',
  'shared.conflicts.label.variable.orderChanged': '변수: 순서 변경됨',
  'shared.conflicts.label.variable.field.name': '이름',
  'shared.conflicts.label.variable.field.value': '값',
  'shared.conflicts.label.variable.field.type': '유형',
  'shared.conflicts.label.variable.field.enabled': '활성',

  // ── Adapter label plane: vault secrets ─────────────────────────────
  'shared.conflicts.label.vault.row': '시크릿',
  'shared.conflicts.label.vault.rowNamed': '시크릿 {name}',
  'shared.conflicts.label.vault.leafNamed': '시크릿 {name} ({label})',
  'shared.conflicts.label.vault.leaf': '시크릿 ({label})',
  'shared.conflicts.label.vault.orderChanged': '시크릿: 순서 변경됨',
  'shared.conflicts.label.vault.field.name': '이름',
  'shared.conflicts.label.vault.field.kind': '종류',
  'shared.conflicts.label.vault.field.value': '값',
  'shared.conflicts.label.vault.field.seed': 'seed',
  'shared.conflicts.label.vault.field.algorithm': '알고리즘',
  'shared.conflicts.label.vault.field.digits': '자릿수',
  'shared.conflicts.label.vault.field.period': '주기',
  'shared.conflicts.label.vault.field.issuer': '발급자',
  'shared.conflicts.label.vault.field.cert': '인증서',
  'shared.conflicts.label.vault.field.key': '개인 키',
  'shared.conflicts.label.vault.field.passphrase': '암호 구문',

  // ── Adapter label plane: live variables ────────────────────────────
  'shared.conflicts.label.liveVariable.leaf': '라이브 변수 ({label})',
  'shared.conflicts.label.liveVariable.field.name': '이름',
  'shared.conflicts.label.liveVariable.field.description': '설명',
  'shared.conflicts.label.liveVariable.field.enabled': '활성',
  'shared.conflicts.label.liveVariable.field.requireFreshOnRuleBuild': '새 값 대기',
  'shared.conflicts.label.liveVariable.field.workflowUid': '워크플로',
  'shared.conflicts.label.liveVariable.field.stepId': '단계',
  'shared.conflicts.label.liveVariable.field.captureName': '캡처',

  // ── Adapter label plane: live workflows ────────────────────────────
  'shared.conflicts.label.workflow.leaf': '워크플로 ({label})',
  'shared.conflicts.label.workflow.stepLeaf': '단계 {step} ({leaf})',
  'shared.conflicts.label.workflow.captureLeaf': '단계 {step} → {capture} ({leaf})',
  'shared.conflicts.label.workflow.stepFallback': '단계 {uid}',
  'shared.conflicts.label.workflow.captureFallback': '캡처 {uid}',
  'shared.conflicts.label.workflow.field.name': '이름',
  'shared.conflicts.label.workflow.field.description': '설명',
  'shared.conflicts.label.workflow.field.enabled': '활성',
  'shared.conflicts.label.workflow.field.refreshKind': '새로 고침 종류',
  'shared.conflicts.label.workflow.field.refreshSeconds': '새로 고침 간격',
  'shared.conflicts.label.workflow.field.refreshStepId': '새로 고침 단계',
  'shared.conflicts.label.workflow.field.refreshCaptureName': '새로 고침 캡처',
  'shared.conflicts.label.workflow.field.refreshLeadSeconds': '새로 고침 선행 초',
  'shared.conflicts.label.workflow.stepField.id': 'id',
  'shared.conflicts.label.workflow.stepField.description': '설명',
  'shared.conflicts.label.workflow.stepField.requestUid': '요청',
  'shared.conflicts.label.workflow.stepField.dependsOn': 'dependsOn',
  'shared.conflicts.label.workflow.stepField.runIf': 'runIf',
  'shared.conflicts.label.workflow.stepField.priorityFrom': 'priorityFrom',
  'shared.conflicts.label.workflow.stepField.retry': '재시도 정책',
  'shared.conflicts.label.workflow.stepField.timeoutMs': 'timeout',
  'shared.conflicts.label.workflow.stepField.runScripts': '스크립트 실행',
  'shared.conflicts.label.workflow.captureField.name': '이름',
  'shared.conflicts.label.workflow.captureField.extractor': '추출기',

  // ── Adapter label plane: specs ─────────────────────────────────────
  'shared.conflicts.label.spec.leaf': '사양 ({label})',
  'shared.conflicts.label.spec.field.name': '이름',
  'shared.conflicts.label.spec.field.description': '설명',
  'shared.conflicts.label.spec.field.format': '형식',
  'shared.conflicts.label.spec.field.rootFileUid': '루트 파일',
  'shared.conflicts.label.spec.fileRow': '사양 파일',
  'shared.conflicts.label.spec.fileRowNamed': '사양 파일 {name}',
  'shared.conflicts.label.spec.fileLeafNamed': '사양 파일 {name} ({label})',
  'shared.conflicts.label.spec.fileLeaf': '사양 파일 ({label})',
  'shared.conflicts.label.spec.fileField.fileName': '파일 이름',
  'shared.conflicts.label.spec.fileField.content': '내용',

  // ── Adapter label plane: requests ──────────────────────────────────
  'shared.conflicts.label.request.set.header': '헤더',
  'shared.conflicts.label.request.set.queryParam': '쿼리 매개변수',
  'shared.conflicts.label.request.orderChanged': '{set}: 순서 변경됨',
  'shared.conflicts.label.request.setRowNamed': '{kind} {name}',
  'shared.conflicts.label.request.unionAuth': '인가 유형',
  'shared.conflicts.label.request.unionBody': '본문 유형',
  'shared.conflicts.label.request.headerLeafNamed': '헤더 {name} ({leaf})',
  'shared.conflicts.label.request.headerLeaf': '헤더 ({leaf})',
  'shared.conflicts.label.request.queryParamLeafNamed': '쿼리 매개변수 {name} ({leaf})',
  'shared.conflicts.label.request.queryParamLeaf': '쿼리 매개변수 ({leaf})',
  'shared.conflicts.label.request.authTail': '인가 · {path}',
  'shared.conflicts.label.request.bodyTail': '본문 · {path}',
  'shared.conflicts.label.request.headerField.key': '이름',
  'shared.conflicts.label.request.headerField.value': '값',
  'shared.conflicts.label.request.headerField.description': '설명',
  'shared.conflicts.label.request.headerField.enabled': '활성',
  'shared.conflicts.label.request.paramField.key': '이름',
  'shared.conflicts.label.request.paramField.value': '값',
  'shared.conflicts.label.request.paramField.description': '설명',
  'shared.conflicts.label.request.paramField.enabled': '활성',
  'shared.conflicts.label.request.paramField.hasEquals': '구분자',
  'shared.conflicts.label.request.scalar.name': '이름',
  'shared.conflicts.label.request.scalar.description': '설명',
  'shared.conflicts.label.request.scalar.url': 'URL',
  'shared.conflicts.label.request.scalar.method': '메서드',
  'shared.conflicts.label.request.scalar.auth': '인가',
  'shared.conflicts.label.request.scalar.body': '본문',
  'shared.conflicts.label.request.scalar.credentialsMode': '자격 증명 모드',
  'shared.conflicts.label.request.scalar.followRedirects': '리디렉션 따라가기',
  'shared.conflicts.label.request.scalar.sslVerification': 'SSL 검증',
  'shared.conflicts.label.request.scalar.tlsMinVersion': 'TLS 최소 버전',
  'shared.conflicts.label.request.scalar.tlsMaxVersion': 'TLS 최대 버전',
  'shared.conflicts.label.request.scalar.tlsCipherSuites': 'TLS 암호 스위트',
  'shared.conflicts.label.request.scalar.sniServerName': 'SNI 서버 이름',
  'shared.conflicts.label.request.scalar.httpVersion': 'HTTP 버전',
  'shared.conflicts.label.request.scalar.resolveToAddress': '확인 대상 주소',
  'shared.conflicts.label.request.scalar.clientCertificateRef': '클라이언트 인증서',
  'shared.conflicts.label.request.scalar.proxyMode': '프록시 모드',
  'shared.conflicts.label.request.scalar.proxyUrl': '프록시 URL',
  'shared.conflicts.label.request.scalar.proxyCredentialRef': '프록시 자격 증명',
  'shared.conflicts.label.request.scalar.unixSocketPath': 'Unix 소켓',
  'shared.conflicts.label.request.scalar.cookieJar': 'Cookie 저장소',
  'shared.conflicts.label.request.scalar.timeoutMs': '요청 시간 제한',
  'shared.conflicts.label.request.scalar.maxResponseBytes': '응답 크기 제한',
  'shared.conflicts.label.request.scalar.maxRedirects': '최대 리디렉션 수',
  'shared.conflicts.label.request.scalar.followOriginalHttpMethod': '원래 HTTP 메서드 유지',
  'shared.conflicts.label.request.scalar.followAuthorizationHeader': 'Authorization 헤더 유지',
  'shared.conflicts.label.request.scalar.preRequestScript': '요청 전 스크립트',
  'shared.conflicts.label.request.scalar.postResponseScript': '응답 후 스크립트',
} as const satisfies Catalog;
