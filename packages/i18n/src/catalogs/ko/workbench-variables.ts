/**
 * Workbench variables station — Korean. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * stays raw inside keyed sentences: `{{live.NAME}}` / `{{…}}`
 * reference syntax (composed as code chips at the render site), TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, secret-manager
 * product names (1Password / Bitwarden / AWS Secrets Manager / Azure
 * Key Vault / HashiCorp Vault), variable / workflow names ({name}),
 * server error text ({message}). Quotes the shipped ko mints: the
 * scoping nouns (Vault raw / 환경 / 컬렉션 / 워크스페이스 / 라이브 —
 * workbench-chrome's varScope block, the sidebar entries 워크스페이스
 * 변수 / 라이브 변수), 범위 내 / 모든 범위 = In scope / All scopes
 * (minted in workbench-docs-variables), 접두사 없는 = bare, 신뢰된
 * 인증서 = trusted certificates, 암호 구문 = passphrase, 개인 키 =
 * private key (shared-conflicts), 새로 고침 / 게시 / 재정의 / 초안 /
 * 바인딩 / 캡처 / 워크플로 carried, 로그인 키체인 (settings panes) →
 * 키체인. MINTS: 민감 = sensitive (a row mark); 시크릿 관리자 = Secret
 * Manager; OS 자격 증명 저장소 = OS credential store; 발급자 = issuer;
 * 저장 시 암호화 = encrypted at rest; 저장 키 = the at-rest key; 봉인
 * = sealed; 해석 문제 = resolution issues; the reason chips (미해결 /
 * 범위 밖 / 알 수 없는 이름 공간 / 단계 참조 범위 밖 / 비어 있음 / 잘못된
 * 값 / 인가 필요 / 시크릿 없음 / 관리자 사용 불가). Plurals are
 * `other`-only with 개.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': '변수',
  'workbench.variables.table.headerSecret': '시크릿',
  'workbench.variables.table.headerValue': '값',
  'workbench.variables.table.namePlaceholder': '이름',
  'workbench.variables.table.valuePlaceholder': '값',
  'workbench.variables.table.addVariable': '변수 추가…',
  'workbench.variables.table.addSecret': '시크릿 추가…',
  'workbench.variables.table.enableRow': '변수 활성화',
  'workbench.variables.table.disableRow': '변수 비활성화',
  'workbench.variables.table.markSensitive': '민감으로 표시',
  'workbench.variables.table.unmarkSensitive': '민감 표시 해제',
  'workbench.variables.table.showValue': '값 표시',
  'workbench.variables.table.hideValue': '값 숨기기',
  'workbench.variables.table.kindText': '텍스트',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': '인증서',
  'workbench.variables.table.kindSecretManager': '시크릿 관리자',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': 'OS 자격 증명 저장소',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': '공급자',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': '항목',
  'workbench.variables.table.smField.field': '필드',
  'workbench.variables.table.smField.account': '계정',
  'workbench.variables.table.smField.secretId': '시크릿 ID',
  'workbench.variables.table.smField.service': '서비스',
  'workbench.variables.table.smField.name': '이름',
  'workbench.variables.table.smField.stage': '스테이지',
  'workbench.variables.table.smField.region': '리전',
  'workbench.variables.table.smField.profile': '프로필',
  'workbench.variables.table.smField.vaultUrl': 'Vault URL',
  'workbench.variables.table.smField.version': '버전',
  'workbench.variables.table.smField.mount': '마운트',
  'workbench.variables.table.smField.path': '경로',
  'workbench.variables.table.smField.key': '키',
  'workbench.variables.table.smField.serverUrl': '서버 URL',
  'workbench.variables.table.smFieldOptional': '{label} (선택 사항)',
  'workbench.variables.table.smStatus.available': '사용 가능',
  'workbench.variables.table.smStatus.notInstalled': '이 기기에서 사용할 수 없음',
  'workbench.variables.table.smStatus.integrationDisabled': '통합 비활성',
  'workbench.variables.table.smStatus.noCredentials': '구성된 자격 증명 없음',
  'workbench.variables.table.smStatus.locked': '잠김',
  'workbench.variables.table.smStatus.unreachable': '연결할 수 없음',
  'workbench.variables.table.certPlaceholder': '인증서 (PEM)',
  'workbench.variables.table.certKeyPlaceholder': '개인 키 (PEM)',
  'workbench.variables.table.passphrasePlaceholder': '키 암호 구문 (선택 사항)',
  'workbench.variables.table.showCertificate': '인증서 표시',
  'workbench.variables.table.hideCertificate': '인증서 숨기기',
  'workbench.variables.table.seedPlaceholder': 'Base32 seed',
  'workbench.variables.table.showSeed': 'seed 표시',
  'workbench.variables.table.hideSeed': 'seed 숨기기',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits}자리 · {period}초',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits}자리 · {period}초 · {issuer}',
  'workbench.variables.table.issuerPlaceholder': '발급자',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': '변수 ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': '워크스페이스 변수',
  'workbench.variables.workspace.description':
    '이 워크스페이스의 모든 환경에서 공유됩니다. 우선순위가 가장 낮으며, 컬렉션, 환경, vault 범위가 재정의합니다.',
  'workbench.variables.workspace.saveFailed': '워크스페이스 변수를 저장하지 못했습니다',
  'workbench.variables.workspace.saveFailedDetail': '워크스페이스 변수를 저장하지 못했습니다: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': '환경을 찾을 수 없습니다.',
  'workbench.variables.environment.activeTag': '활성',
  'workbench.variables.environment.defaultTag': '기본',
  'workbench.variables.environment.defaultTooltip': '활성 환경에 변수가 없으면 해석기가 이 환경으로 대체합니다.',
  'workbench.variables.environment.setActive': '활성으로 설정',
  'workbench.variables.environment.setDefault': '기본으로 설정',
  'workbench.variables.environment.unsetDefault': '기본 해제',
  'workbench.variables.environment.setDefaultTooltip':
    '기본으로 설정합니다. 활성 환경에 변수가 없으면 해석기가 이 환경으로 대체합니다.',
  'workbench.variables.environment.unsetDefaultTooltip':
    '기본에서 해제합니다. 해석기가 더 이상 이 환경으로 대체하지 않습니다.',
  'workbench.variables.environment.deletedElsewhere': '환경이 다른 탭에서 삭제되었습니다',
  'workbench.variables.environment.updateFailed': '환경을 업데이트하지 못했습니다',
  'workbench.variables.environment.updateFailedDetail': '환경을 업데이트하지 못했습니다: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': '컬렉션을 찾을 수 없습니다.',
  'workbench.variables.collection.title': '{name} · 변수',
  'workbench.variables.collection.descriptionRule':
    '이 컬렉션 안의 모든 규칙에서 쓸 수 있는 변수입니다. 환경과 vault 범위가 재정의하며, 워크스페이스 범위를 재정의합니다. 평문으로 저장되니 시크릿은 Vault 저장소를 쓰세요.',
  'workbench.variables.collection.descriptionRequest':
    '이 컬렉션 안의 모든 요청에서 쓸 수 있는 변수입니다. 환경과 vault 범위가 재정의하며, 워크스페이스 범위를 재정의합니다. 평문으로 저장되니 시크릿은 Vault 저장소를 쓰세요.',
  'workbench.variables.collection.descriptionTemplate':
    '이 컬렉션 안의 모든 템플릿에서 쓸 수 있는 변수입니다. 환경과 vault 범위가 재정의하며, 워크스페이스 범위를 재정의합니다. 평문으로 저장되니 시크릿은 Vault 저장소를 쓰세요.',
  'workbench.variables.collection.deletedElsewhere': '컬렉션이 다른 탭에서 삭제되었습니다',
  'workbench.variables.collection.saveFailed': '컬렉션 변수를 저장하지 못했습니다',
  'workbench.variables.collection.saveFailedDetail': '컬렉션 변수를 저장하지 못했습니다: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Vault 시크릿은 저장 시 암호화되고, 이 기기를 절대 떠나지 않으며, 다른 모든 범위보다 우선합니다.',
  'workbench.variables.vault.trustedRootsNote':
    'CA 인증서를 찾으시나요? 신뢰된 인증서는 시크릿이 아니라 워크스페이스 데이터이며, 자기 탭에 있습니다.',
  'workbench.variables.vault.trustedRootsLink': '신뢰된 인증서 열기',
  'workbench.variables.vault.cipherLocked':
    '시크릿 저장소가 잠겨 있습니다. 시스템이 키체인 접근을 거부하여 이 세션에서는 vault 시크릿을 읽거나 저장할 수 없습니다.',
  'workbench.variables.vault.cipherLockedRelaunch': '앱 다시 실행',
  'workbench.variables.vault.lockedTitle': 'Vault 잠김: 저장 키 분실',
  'workbench.variables.vault.lockedDescription':
    '이 vault 저장소의 시크릿은 여전히 이 기기에 저장되어 있지만 더 이상 복호화할 수 없습니다. 이를 봉인한 저장 키가 사라졌습니다 (브라우저 데이터 삭제, 새 프로필, 또는 확장 프로그램 키 재설정). 새 항목이 봉인된 데이터를 덮어쓰지 못하도록 편집이 비활성화되어 있습니다. vault 저장소를 잠금 해제하려면 시크릿을 다시 입력하세요. 기존 항목은 바뀝니다.',
  'workbench.variables.vault.secretsCount':
    '시크릿 (텍스트 {strings}개 · TOTP {totps}개 · 인증서 {certs}개 · 시크릿 관리자 {refs}개)',
  'workbench.variables.vault.saveFailed': 'vault 저장소를 저장하지 못했습니다',
  'workbench.variables.vault.saveFailedDetail': 'vault 저장소를 저장하지 못했습니다: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': '라이브 변수',
  'workbench.variables.live.newVariable': '새 라이브 변수',
  'workbench.variables.live.descriptionPrefix':
    '각 바인딩은 이름을 워크플로 (예약된 요청 연쇄)의 캡처에 대응시킵니다. 규칙과 요청에서의 참조 형식:',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': '이름',
  'workbench.variables.live.headerValue': '값',
  'workbench.variables.live.headerWorkflow': '워크플로',
  'workbench.variables.live.empty':
    '아직 라이브 변수가 없습니다. 하나 만들어 이름을 워크플로의 캡처 값에 바인딩하세요.',
  'workbench.variables.live.draftMarker': '초안',
  'workbench.variables.live.offMarker': '꺼짐',
  'workbench.variables.live.overrideMarker': '재정의',
  'workbench.variables.live.clickEyeToReveal': '눈 아이콘을 눌러 표시',
  'workbench.variables.live.showValue': '값 표시',
  'workbench.variables.live.hideValue': '값 숨기기',
  'workbench.variables.live.notCapturedYet': '아직 캡처되지 않음',
  'workbench.variables.live.missingWorkflow': '워크플로 없음',
  'workbench.variables.live.refreshNow': '지금 워크플로 새로 고침',
  'workbench.variables.live.refreshAria': '{name} 새로 고침',
  'workbench.variables.live.editBinding': '바인딩 편집 (이름 / 활성 / 재정의)',
  'workbench.variables.live.editAria': '{name} 편집',
  'workbench.variables.live.delete': '삭제',
  'workbench.variables.live.deleteAria': '{name} 삭제',
  'workbench.variables.live.deleteFailed': '“{name}” 항목을 삭제하지 못했습니다',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': '환경',
  'workbench.variables.panel.scope.collection': '컬렉션',
  'workbench.variables.panel.scope.workspace': '워크스페이스',
  'workbench.variables.panel.scope.live': '라이브',
  'workbench.variables.panel.inContextTitle': '범위 내',
  'workbench.variables.panel.inContextTitleNamed': '범위 내: {name}',
  'workbench.variables.panel.inContextSummary':
    '활성 규칙, 요청 또는 템플릿이 참조하는 변수입니다. 각각 모든 범위를 거쳐 해석되므로 실제로 적용될 정확한 값을 볼 수 있습니다. 하나를 열기 전까지는 비어 있습니다.',
  'workbench.variables.panel.allScopesTitle': '모든 범위',
  'workbench.variables.panel.allScopesSummary':
    '모든 범위에 정의된 모든 변수를 해석 우선순위별로 묶어 보여 줍니다. 참조 방법과 순위는 범위의 (i)를 열어 확인하세요.',
  'workbench.variables.panel.sectionAboutAria': '{title} 정보',
  'workbench.variables.panel.scopeAboutAria': '{scope} 변수 정보',
  'workbench.variables.panel.scopeSummary.vault':
    '사용자별 시크릿입니다. vault 저장소에 저장되며 절대 동기화되지 않습니다.',
  'workbench.variables.panel.scopeSummary.environment': '활성 환경의 변수입니다. 없으면 기본 환경으로 대체됩니다.',
  'workbench.variables.panel.scopeSummary.collection': '활성 컬렉션으로 범위가 한정된 변수입니다.',
  'workbench.variables.panel.scopeSummary.workspace': '워크스페이스 전체에 공유되는 변수입니다.',
  'workbench.variables.panel.scopeSummary.live': '워크플로 기반 값이며, 최신 실행에서 해석됩니다.',
  'workbench.variables.panel.scopeInfo.title': '{label} {qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': '시크릿',
  'workbench.variables.panel.scopeInfo.qualifierVariable': '변수',
  'workbench.variables.panel.scopeInfo.writePrefix': '작성 형식:',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': '형식만. 접두사 없는 형식은 불가:',
  'workbench.variables.panel.scopeInfo.orJustMiddle': '또는 그냥',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': '접두사 없는',
  'workbench.variables.panel.scopeInfo.bareSuffix': '참조는 우선순위로 해석됩니다:',
  'workbench.variables.panel.scopeInfo.liveOutside': '라이브는 이 순서 밖에 있습니다.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · 기본: {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': '환경 없음 · 기본: {default}',
  'workbench.variables.panel.env.subtitleNone': '환경 없음',
  'workbench.variables.panel.env.editTooltip': '환경 변수 편집기 열기',
  'workbench.variables.panel.env.createTooltip': '첫 환경 만들기',
  'workbench.variables.panel.env.selectTooltip': '활성 환경 고르기',
  'workbench.variables.panel.collection.noneActive': '활성 컬렉션 없음',
  'workbench.variables.panel.live.resolvedCount': '{resolved}/{total} 해석됨',
  'workbench.variables.panel.live.noneDefined': '정의된 라이브 변수 없음',
  'workbench.variables.panel.action.edit': '편집',
  'workbench.variables.panel.action.editTooltip': '{scope} 변수 편집기 열기',
  'workbench.variables.panel.action.create': '만들기',
  'workbench.variables.panel.action.select': '선택',
  'workbench.variables.panel.emptyScopeSecrets': '정의된 시크릿이 없습니다.',
  'workbench.variables.panel.emptyScopeVariables': '정의된 변수가 없습니다.',
  'workbench.variables.panel.openHint': '요청이나 규칙을 열면 참조하는 변수가 표시됩니다.',
  'workbench.variables.panel.noneReferenced': '이 {noun}에서 참조하는 변수가 없습니다.',
  'workbench.variables.panel.noun.rule': '규칙',
  'workbench.variables.panel.noun.request': '요청',
  'workbench.variables.panel.noun.template': '템플릿',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), { other: '변수 {count}개 모두 해석됨' }),
  'workbench.variables.panel.unresolvedCount': '{count}개 미해결',
  'workbench.variables.panel.valueUnresolved': '미해결',
  'workbench.variables.panel.valueEmpty': '(비어 있음)',
  'workbench.variables.panel.showValue': '값 표시',
  'workbench.variables.panel.hideValue': '값 숨기기',
  'workbench.variables.panel.copyValue': '값 복사',
  'workbench.variables.panel.copied': '복사했습니다',
  'workbench.variables.panel.errors.title': '해석 문제 ({count})',
  'workbench.variables.panel.errors.referenceTooltip': '{{…}} 안의 원시 참조',
  'workbench.variables.panel.errors.reason.unresolved': '미해결',
  'workbench.variables.panel.errors.reason.unsetInScope': '범위 밖',
  'workbench.variables.panel.errors.reason.unknownNamespace': '알 수 없는 이름 공간',
  'workbench.variables.panel.errors.reason.stepOutOfContext': '단계 참조 범위 밖',
  'workbench.variables.panel.errors.reason.empty': '비어 있음',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': '잘못된 값',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': '인가 필요',
  'workbench.variables.panel.errors.reason.secretNotFound': '시크릿 없음',
  'workbench.variables.panel.errors.reason.secretUnavailable': '관리자 사용 불가',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': '코드 복사',
  'workbench.totpPreview.copied': '복사했습니다',
  'workbench.totpPreview.refreshesTooltip': '{seconds}초 후 새로 고침',
  'workbench.totpPreview.refreshesAria': 'TOTP 코드가 {seconds}초 후 새로 고쳐집니다',
} as const satisfies Catalog;
