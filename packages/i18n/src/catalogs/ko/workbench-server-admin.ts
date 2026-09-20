/**
 * Daemon-admin family — Korean. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`), admission
 * status enum values and audit `reason` strings ({status} / {reason}
 * holes carry server data), license ids ({id}), the `oh-license.` key
 * prefix, `IdP` / `SSO` / `JSONL` / `Git` vocabulary with 로그인 / 형식
 * / 저장소 as head nouns, and the ` · ` separator glyphs. Quotes the
 * shipped ko mints: 서버 관리 (workbench-chrome), 관리자 / 서버 운영자 /
 * 구성원 / 소유자 / 부여 = grant (workbench-chrome-workspace), 시트 / 티어
 * / 무료 티어 / 취소 = revoke / 발급 = mint / 페어링된 기기 / SSO 세션 / ID
 * 공급자 = identity provider (settings panes), 서비스 계정, 감사 추적 =
 * audit trail, 비활성화 = deactivate, 릴리스 노트, 로그인 = sign in,
 * 웹 게이트 (the web namespace). MINTS: 입장 = admission (a device /
 * user is admitted); 개인 시트 = individual seat; 시트 풀 = the seat
 * pool (풀 = pull stays the git verb); 흡수 = absorb; 뷰어 / 편집자 /
 * 소유자 = the grant roles; 디렉터리 사용자 = directory user; 작업자 =
 * actor (audit column); 허용 / 거부 = allow / deny; 운영자 전용 =
 * operator only; 관리 평면 = admin plane.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': '서버 관리',
  'workbench.serverAdmin.intro':
    '디렉터리 사용자는 바인딩된 token 값이나 SSO 로그인으로 로그인하며 여기서 부여된 워크스페이스만 정확히 봅니다. 비활성화하면 사용자의 token 값이 취소되고 즉시 연결이 끊깁니다.',
  'workbench.serverAdmin.deniedDescription': '이 서버를 관리하려면 daemon.admin 권한이 필요합니다.',
  'workbench.serverAdmin.cancel': '취소',

  // ── Server admin panel (the administration nav — one row per
  //    domain, each opening its own slim tab) ─────────────────────────
  'workbench.serverAdmin.panel.users': '사용자',
  'workbench.serverAdmin.panel.usersHint': '디렉터리, 역할, 워크스페이스 접근',
  'workbench.serverAdmin.panel.devices': '페어링된 기기',
  'workbench.serverAdmin.panel.devicesHint': 'token, 페어링, 로그인된 세션',
  'workbench.serverAdmin.panel.git': 'Git',
  'workbench.serverAdmin.panel.gitHint': '서버 워크스페이스를 저장소에 바인딩',
  'workbench.serverAdmin.panel.audit': '감사',
  'workbench.serverAdmin.panel.auditHint': '서버의 감사 추적 조회',
  'workbench.serverAdmin.panel.server': '서버',
  'workbench.serverAdmin.panel.serverHint': '빌드, 버전, 릴리스 노트',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.build.sectionTitle': '빌드',
  'workbench.serverAdmin.build.sectionHint': '이 콘솔이 관리하는 서버 빌드.',
  'workbench.serverAdmin.build.versionLabel': '버전',
  'workbench.serverAdmin.build.versionUnknown': '알 수 없음',
  'workbench.serverAdmin.notes.sectionTitle': '릴리스 노트',
  'workbench.serverAdmin.notes.sectionHint': '이 콘솔이 관리하는 서버 빌드에 무엇이 실렸는지.',
  'workbench.serverAdmin.notes.empty': '이 빌드에는 릴리스 노트가 없습니다.',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': '사용자',
  'workbench.serverAdmin.users.sectionHint':
    '사용자를 입장시킨 다음 아래에서 워크스페이스별 역할을 부여하세요. 이메일이 SSO 로그인을 이 레코드에 연결합니다.',
  'workbench.serverAdmin.users.nameRequired': '이름은 필수입니다',
  'workbench.serverAdmin.users.workspaceRequired': '워크스페이스를 하나 이상 부여하세요',
  'workbench.serverAdmin.users.displayNamePlaceholder': '표시 이름',
  'workbench.serverAdmin.users.emailPlaceholder': '이메일',
  'workbench.serverAdmin.users.emailRequired': '이메일은 필수입니다. 사용자는 이메일로 로그인합니다.',
  'workbench.serverAdmin.users.emailInvalid': '올바른 이메일 주소를 입력하세요',
  'workbench.serverAdmin.users.initialPasswordPlaceholder': '초기 비밀번호 (선택 사항)',
  'workbench.serverAdmin.users.passwordTooShort': '비밀번호는 8자 이상이어야 합니다',
  'workbench.serverAdmin.users.seatKeyPlaceholder': '개인 시트 키 (oh-license.…)',
  'workbench.serverAdmin.users.addUser': '사용자 추가',
  'workbench.serverAdmin.users.kindUser': '사용자',
  'workbench.serverAdmin.users.kindService': '서비스 계정',
  'workbench.serverAdmin.users.serviceExplainer':
    '서비스 계정은 자동화를 위한 워크스페이스 부여와 바인딩된 token 값을 보유합니다. 절대 로그인할 수 없고 시트를 차지하지 않습니다. token 값은 아래 기기 섹션에서 발급하세요.',
  'workbench.serverAdmin.users.serviceNamePlaceholder': '서비스 계정 이름 (예: CI 배포)',
  'workbench.serverAdmin.users.addService': '서비스 계정 추가',
  'workbench.serverAdmin.users.serviceTag': '서비스',
  'workbench.serverAdmin.users.serviceLimit':
    '무료 플랜은 서비스 계정 {limit}개까지 허용합니다. 유료 라이선스는 이 한도를 없앱니다.',
  'workbench.serverAdmin.users.licensesSoldAt': '라이선스 판매처:',
  'workbench.serverAdmin.users.neverSeenService': '사용된 적 없음',
  'workbench.serverAdmin.users.seatLimit':
    '이 서버는 시트 한도에 도달했습니다. 팀 라이선스에 시트를 추가하거나, 합류하는 사용자의 개인 시트 키를 위에 붙여넣으세요. 풀 시트를 쓰지 않고 입장시킵니다.',
  'workbench.serverAdmin.users.seatsSoldAt': '개인 시트 판매처:',
  'workbench.serverAdmin.users.emptyDirectory':
    '아직 디렉터리 사용자가 없습니다. 서버는 솔로 티어로 실행됩니다. 사용자를 추가하면 팀 티어가 열립니다.',
  'workbench.serverAdmin.users.deactivatedOn': '{date} 비활성화됨',
  'workbench.serverAdmin.users.addedOn': '{date} 추가됨',
  'workbench.serverAdmin.users.lastSeenOn': '마지막 접속 {date}',
  'workbench.serverAdmin.users.neverSeen': '로그인한 적 없음',
  'workbench.serverAdmin.users.sortByCreated': '최신순',
  'workbench.serverAdmin.users.sortByLastSeen': '마지막 접속순',
  'workbench.serverAdmin.users.loadFailed': '사용자 디렉터리를 불러오지 못했습니다: {message}',
  'workbench.serverAdmin.users.addFailed': '사용자를 추가하지 못했습니다: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': '개인 시트',
  'workbench.serverAdmin.seat.healthyTooltip':
    '자기 개인 시트 ({id})로 입장했습니다. 이 서버의 풀에 포함되지 않습니다.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    '개인 시트 ({id})가 {status} 상태입니다. 로그인은 유지되지만 (만료는 절대 내보내지 않음) 시트는 더 이상 갱신되지 않습니다.',
  'workbench.serverAdmin.seat.absorbTitle': '이 시트를 풀에 흡수하시겠습니까?',
  'workbench.serverAdmin.seat.absorbDescription':
    '사용자는 일반 풀 시트가 되고 개인 라이선스는 여기서 갱신을 멈춥니다. 되돌릴 수 없습니다.',
  'workbench.serverAdmin.seat.absorbOk': '흡수',
  'workbench.serverAdmin.seat.absorbCta': '풀에 흡수',
  'workbench.serverAdmin.seat.absorbed': '시트를 풀에 흡수했습니다.',
  'workbench.serverAdmin.seat.absorbFailed': '시트를 흡수하지 못했습니다: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': '이 사용자를 비활성화하시겠습니까?',
  'workbench.serverAdmin.deactivate.description':
    'token 값이 취소되고 라이브 연결이 닫힙니다. 나중에 같은 이메일을 다시 추가하면 다시 입장시킬 수 있습니다.',
  'workbench.serverAdmin.deactivate.cta': '비활성화',
  'workbench.serverAdmin.deactivate.done': '사용자를 비활성화했습니다. token 값이 취소되고 라이브 연결이 닫혔습니다.',
  'workbench.serverAdmin.deactivate.failed': '비활성화하지 못했습니다: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': '뷰어',
  'workbench.serverAdmin.grants.roleEditor': '편집자',
  'workbench.serverAdmin.grants.roleOwner': '소유자',
  'workbench.serverAdmin.grants.none': '아직 워크스페이스 접근 권한이 없습니다.',
  'workbench.serverAdmin.grants.idpTooltip':
    'ID 공급자 매핑으로 부여되었습니다. 취소해도 다음 SSO 로그인이 다시 적용할 때까지만 유지됩니다.',
  'workbench.serverAdmin.grants.workspacePlaceholder': '워크스페이스',
  'workbench.serverAdmin.grants.grantCta': '부여',
  'workbench.serverAdmin.grants.everyWorkspace': '모든 워크스페이스에 부여되었습니다.',
  'workbench.serverAdmin.grants.grantFailed': '부여하지 못했습니다: {message}',
  'workbench.serverAdmin.grants.revokeFailed': '부여를 취소하지 못했습니다: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': '비밀번호 설정 — {name}',
  'workbench.serverAdmin.password.resetTitle': '비밀번호 재설정 — {name}',
  'workbench.serverAdmin.password.explainer':
    '사용자는 서버의 웹 게이트에서 이메일과 이 비밀번호로 로그인합니다. 직접 전달하세요. 서버에는 해시로 저장되어 다시 읽을 수 없습니다.',
  'workbench.serverAdmin.password.placeholder': '새 비밀번호 (8자 이상)',
  'workbench.serverAdmin.password.setCta': '비밀번호 설정',
  'workbench.serverAdmin.password.resetCta': '비밀번호 재설정',
  'workbench.serverAdmin.password.removeCta': '비밀번호 제거',
  'workbench.serverAdmin.password.setDone': '비밀번호를 설정했습니다.',
  'workbench.serverAdmin.password.removedDone': '비밀번호를 제거했습니다.',
  'workbench.serverAdmin.password.updateFailed': '비밀번호를 업데이트하지 못했습니다: {message}',
  'workbench.serverAdmin.password.needsEmail': '먼저 이메일을 설정하세요. 사용자는 이메일로 로그인합니다.',

  // ── Email modal (the client sign-in plan D5) ────────────────────────
  'workbench.serverAdmin.email.setTitle': '이메일 설정 — {name}',
  'workbench.serverAdmin.email.explainer':
    '사용자는 서버 페이지와 모든 클라이언트에서 이메일로 로그인합니다. 이메일이 없으면 이 사용자는 어떤 방법으로도 로그인할 수 없습니다.',
  'workbench.serverAdmin.email.setCta': '이메일 설정',
  'workbench.serverAdmin.email.setDone': '이메일을 설정했습니다.',
  'workbench.serverAdmin.email.updateFailed': '이메일을 설정하지 못했습니다: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Git 이메일 설정 — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Git 이메일 변경 — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    '이 사용자의 작업을 담은 커밋은 이 주소를 작성자로 하여, 사용자의 Git 호스팅 프로필에 연결됩니다. 없으면 디렉터리 이메일을, 그다음 noreply 주소를 씁니다.',
  'workbench.serverAdmin.gitEmail.placeholder': '커밋 작성자 이메일',
  'workbench.serverAdmin.gitEmail.setCta': 'Git 이메일 설정',
  'workbench.serverAdmin.gitEmail.changeCta': 'Git 이메일 변경',
  'workbench.serverAdmin.gitEmail.removeCta': '재정의 제거',
  'workbench.serverAdmin.gitEmail.setDone': 'Git 이메일을 설정했습니다.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Git 이메일 재정의를 제거했습니다.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Git 이메일을 업데이트하지 못했습니다: {message}',

  // ── Functional roles ───────────────────────────────────────────────
  'workbench.serverAdmin.roles.daemonAdmin': '서버 관리자',
  'workbench.serverAdmin.roles.daemonAdminTooltip':
    '이 서버를 관리합니다: 사용자, 역할, 부여, 기기, 보고서. 그 자체로는 워크스페이스 접근 권한을 주지 않으며, 이 사용자는 여전히 아래에서 부여된 워크스페이스만 봅니다.',
  'workbench.serverAdmin.roles.createWorkspaces': '워크스페이스 만들기',
  'workbench.serverAdmin.roles.createWorkspacesTooltip':
    '이 사용자가 서버에 새 워크스페이스를 만들 수 있게 합니다. 만든 것은 자기가 소유하며, 기존 워크스페이스에는 여전히 부여가 필요합니다.',
  'workbench.serverAdmin.roles.daemonAdminGranted': '이제 서버 관리자입니다.',
  'workbench.serverAdmin.roles.daemonAdminRevoked': '서버 관리자 역할을 취소했습니다.',
  'workbench.serverAdmin.roles.createWorkspacesGranted': '이제 워크스페이스를 만들 수 있습니다.',
  'workbench.serverAdmin.roles.createWorkspacesRevoked': '더 이상 워크스페이스를 만들 수 없습니다.',
  'workbench.serverAdmin.roles.lastAdmin': '유일한 서버 관리자입니다. 먼저 다른 사람을 관리자로 만드세요',
  'workbench.serverAdmin.roles.updateFailed': '역할을 바꾸지 못했습니다: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    '서버 워크스페이스를 저장소에 바인딩하고 커밋, 풀, 푸시, 브랜치를 원격으로 다룹니다. 경로는 서버 자체의 파일 시스템 기준입니다.',
  'workbench.serverAdmin.git.workspaceLabel': '워크스페이스',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': '보고서',
  'workbench.serverAdmin.audit.sectionHint':
    '이 서버가 내리는 모든 권한 결정과 각 기기 입장을 필터할 수 있는 감사 추적으로 보여 줍니다. 내보내기는 활성 필터를 따릅니다.',
  'workbench.serverAdmin.audit.capAdmission': '입장 (연결)',
  'workbench.serverAdmin.audit.capAdminPlane': '관리 평면',
  'workbench.serverAdmin.audit.capOperatorPlane': '운영자 전용',
  'workbench.serverAdmin.audit.capSsoGrant': 'SSO 부여 (매핑)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'SSO 취소 (매핑)',
  'workbench.serverAdmin.audit.capSsoAdmin': 'SSO 관리자 (선언됨)',
  'workbench.serverAdmin.audit.capDeviceLogin': '기기 로그인 (승인됨)',
  'workbench.serverAdmin.audit.capWorkspaceRead': '워크스페이스 읽기',
  'workbench.serverAdmin.audit.capWorkspaceWrite': '워크스페이스 쓰기',
  'workbench.serverAdmin.audit.capWorkspaceList': '워크스페이스 목록',
  'workbench.serverAdmin.audit.rangeLastHour': '최근 1시간',
  'workbench.serverAdmin.audit.rangeLast24Hours': '최근 24시간',
  'workbench.serverAdmin.audit.rangeLast7Days': '최근 7일',
  'workbench.serverAdmin.audit.rangeLast30Days': '최근 30일',
  'workbench.serverAdmin.audit.colTime': '시각',
  'workbench.serverAdmin.audit.colEvent': '이벤트',
  'workbench.serverAdmin.audit.colCapability': '권한',
  'workbench.serverAdmin.audit.colWorkspace': '워크스페이스',
  'workbench.serverAdmin.audit.colActor': '작업자',
  'workbench.serverAdmin.audit.eventAdmission': '입장',
  'workbench.serverAdmin.audit.eventAdmissionRefused': '입장 거부됨',
  'workbench.serverAdmin.audit.eventSsoGrant': 'SSO 부여',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'SSO 취소',
  'workbench.serverAdmin.audit.eventSsoAdmin': 'SSO 관리자',
  'workbench.serverAdmin.audit.eventDeviceLogin': '기기 로그인',
  'workbench.serverAdmin.audit.eventAllow': '허용',
  'workbench.serverAdmin.audit.eventDeny': '거부',
  'workbench.serverAdmin.audit.filterActor': '작업자',
  'workbench.serverAdmin.audit.filterCapability': '권한',
  'workbench.serverAdmin.audit.filterDecision': '결정',
  'workbench.serverAdmin.audit.filterWorkspace': '워크스페이스',
  'workbench.serverAdmin.audit.filterAnyTime': '전체 기간',
  'workbench.serverAdmin.audit.decisionAllow': '허용',
  'workbench.serverAdmin.audit.decisionDeny': '거부',
  'workbench.serverAdmin.audit.refresh': '새로 고침',
  'workbench.serverAdmin.audit.exportJsonl': 'JSONL 내보내기',
  'workbench.serverAdmin.audit.emptyText': '일치하는 감사 행이 없습니다.',
  'workbench.serverAdmin.audit.loadMore': '더 불러오기',
} as const satisfies Catalog;
