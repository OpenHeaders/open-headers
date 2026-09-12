/**
 * Workbench chrome — the workspace plane — Korean. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); Org stays the raw product noun
 * (shared-workspace precedent); `OAuth`, format names (PNG, JPEG,
 * WebP, SVG) and the `KB` unit ride raw as en writes them; vault rides
 * raw in en's case (vault 내용 / vault 항목, the particle law).
 * Runtime-quoted names use “ ”. File mints: 복제 = duplicate / {name} 사본 = copy-of (복사 stays the copy
 * action; 사본 carried from shared-workspace); 전환기 = switcher; 부여 =
 * grant; 관리자 = admin; 서버 운영자 = server operator; 구성원 = member
 * (carried); 소유자 = owner; 스냅샷 = snapshot; 나가기 = leave; 활성
 * 워크스페이스 carries the 활성 mint; organization prose = 조직 (Org
 * the product noun stays raw). `{name}` holes take 워크스페이스 /
 * 구성원 as head nouns before a consonant-dependent particle; `{orgs}`
 * takes the invariant 에.
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': '워크스페이스',
  'workbench.workspace.newWorkspace': '새 워크스페이스',
  'workbench.workspace.intro':
    '각 워크스페이스는 자기 규칙, 컬렉션, 폴더, 템플릿, 변수, 테스트 실행 기록을 따로 가집니다. 끌어서 순서를 바꾸세요.',
  'workbench.workspace.deleteTitle': '“{name}” 워크스페이스를 삭제하시겠습니까?',
  'workbench.workspace.deleteBody':
    '워크스페이스와 그 안의 모든 규칙, 컬렉션, 폴더, 템플릿, 변수, 테스트 실행 기록이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
  'workbench.workspace.deleteOk': '삭제',
  'workbench.workspace.deleteFailed': '워크스페이스를 삭제하지 못했습니다',
  'workbench.workspace.deletedToast': '“{name}” 삭제됨',
  'workbench.workspace.leaveTitle': '“{name}” 워크스페이스에서 나가시겠습니까?',
  'workbench.workspace.leaveBody':
    '이 워크스페이스에 대한 자신의 접근 권한을 포기합니다. 열린 모든 탭에서 사라집니다. 다른 사람은 권한을 그대로 유지하며, 관리자가 다시 부여할 수 있습니다.',
  'workbench.workspace.leaveOk': '나가기',
  'workbench.workspace.leaveFailed': '워크스페이스에서 나가지 못했습니다',
  'workbench.workspace.leftToast': '“{name}” 나감',
  'workbench.workspace.leaveAria': '워크스페이스 나가기',
  'workbench.workspace.members.title': '“{name}” 구성원',
  'workbench.workspace.members.openAria': '구성원 관리',
  'workbench.workspace.members.loadFailed': '구성원을 불러오지 못했습니다',
  'workbench.workspace.members.updateFailed': '구성원을 업데이트하지 못했습니다',
  'workbench.workspace.members.operatorTag': '서버 운영자',
  'workbench.workspace.members.managedTag': '관리형',
  'workbench.workspace.members.managedTooltip': '이 부여는 ID 공급자가 관리합니다.',
  'workbench.workspace.members.removeConfirm': '{name} 구성원을 이 워크스페이스에서 제거하시겠습니까?',
  'workbench.workspace.members.removeOk': '제거',
  'workbench.workspace.members.removeAria': '구성원 제거',
  'workbench.workspace.members.removedToast': '{name} 제거됨',
  'workbench.workspace.members.updatedToast': '{name} 업데이트됨',
  'workbench.workspace.members.addedToast': '{name} 추가됨',
  'workbench.workspace.members.addPlaceholder': '사람 또는 서비스 계정 추가…',
  'workbench.workspace.members.addButton': '추가',
  'workbench.workspace.members.noneToAdd': '이 서버의 모든 사람이 이미 접근할 수 있습니다.',
  'workbench.workspace.members.readOnlyHint': '워크스페이스 소유자만 구성원을 바꿀 수 있습니다.',
  'workbench.workspace.members.visibilityLabel': '접근',
  'workbench.workspace.members.visibilityPrivate': '비공개',
  'workbench.workspace.members.visibilityInternal': '내부',
  'workbench.workspace.members.visibilityPrivateHint': '초대된 구성원만 이 워크스페이스를 볼 수 있습니다.',
  'workbench.workspace.members.visibilityInternalHint':
    '이 서버의 모든 구성원이 이 워크스페이스를 볼 수 있습니다. 편집은 추가한 구성원만 할 수 있습니다.',
  'workbench.workspace.members.visibilityUpdatedToast': '워크스페이스 접근 업데이트됨',
  'workbench.workspace.members.visibilityPublic': '공개',
  'workbench.workspace.members.visibilityPublicHint':
    '링크가 있는 누구나 이 워크스페이스의 공유된 읽기 전용 스냅샷을 볼 수 있습니다. 편집은 추가한 구성원만 할 수 있습니다.',
  'workbench.workspace.publicShare.heading': '공개 링크',
  'workbench.workspace.publicShare.loadFailed': '공개 공유 상태를 불러오지 못했습니다',
  'workbench.workspace.publicShare.disabledHint':
    '이 서버에서는 공개 워크스페이스가 비활성화되어 있습니다. 운영자가 daemon.json 파일의 publicWorkspaces 항목으로 활성화할 수 있습니다.',
  'workbench.workspace.publicShare.notShared': '아직 공유된 스냅샷이 없습니다. 하나를 공유하면 링크가 활성화됩니다.',
  'workbench.workspace.publicShare.sharedAt': '스냅샷 공유됨: {when}',
  'workbench.workspace.publicShare.shareButton': '공개 공유…',
  'workbench.workspace.publicShare.updateButton': '공개 사본 업데이트…',
  'workbench.workspace.publicShare.stopButton': '공유 중지',
  'workbench.workspace.publicShare.stopConfirm':
    '이 워크스페이스의 공유를 중지하시겠습니까? 공개 링크가 즉시 동작을 멈춥니다.',
  'workbench.workspace.publicShare.stopOk': '공유 중지',
  'workbench.workspace.publicShare.stoppedToast': '공개 링크 제거됨',
  'workbench.workspace.publicShare.sharedToast': '공개 스냅샷 공유됨',
  'workbench.workspace.publicShare.copyLink': '링크 복사',
  'workbench.workspace.publicShare.copiedToast': '링크 복사됨',
  'workbench.workspace.publicShare.reviewTitle': '“{name}” 공개 공유',
  'workbench.workspace.publicShare.reviewIntro':
    '링크가 있는 누구나 지금 이 시점의 워크스페이스 읽기 전용 스냅샷을 봅니다. 확인하기 전에 무엇이 나가는지 검토하세요:',
  'workbench.workspace.publicShare.reviewUpdateNote': '다시 공유하면 같은 링크의 공개 사본이 교체됩니다.',
  'workbench.workspace.publicShare.reviewStripped':
    '절대 포함되지 않음: vault 항목, OAuth 토큰, 라이브 값, 파일 내용, 시크릿 유형 변수의 값.',
  'workbench.workspace.publicShare.reviewStrippedCount': '시크릿 변수 값 {count}개는 숨겨집니다. 이름은 계속 보입니다.',
  'workbench.workspace.publicShare.reviewContents': '내용',
  'workbench.workspace.publicShare.reviewEmpty': '이 워크스페이스는 비어 있습니다. 게시되는 스냅샷도 비어 있습니다.',
  'workbench.workspace.publicShare.reviewVariables': '변수 ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': '변수 없음.',
  'workbench.workspace.publicShare.reviewValueHidden': '숨겨짐',
  'workbench.workspace.publicShare.confirmShare': '스냅샷 공유',
  'workbench.workspace.publicShare.previewFailed': '스냅샷 미리 보기를 준비하지 못했습니다',
  'workbench.workspace.publicShare.shareFailed': '스냅샷을 공유하지 못했습니다',
  'workbench.workspace.publicShare.scope.workspace': '워크스페이스',
  'workbench.workspace.publicShare.scope.environment': '환경',
  'workbench.workspace.publicShare.scope.collection': '컬렉션',
  'workbench.workspace.publicShare.cat.requests': '요청 {count}개',
  'workbench.workspace.publicShare.cat.collections': '컬렉션 {count}개',
  'workbench.workspace.publicShare.cat.folders': '폴더 {count}개',
  'workbench.workspace.publicShare.cat.rules': '규칙 {count}개',
  'workbench.workspace.publicShare.cat.environments': '환경 {count}개',
  'workbench.workspace.publicShare.cat.examples': '응답 예시 {count}개',
  'workbench.workspace.publicShare.cat.specs': 'API 사양 {count}개',
  'workbench.workspace.publicShare.cat.scripts': '스크립트 패키지 {count}개',
  'workbench.workspace.publicShare.cat.templates': '템플릿 {count}개',
  'workbench.workspace.publicShare.cat.live': '라이브 워크플로 {count}개',
  'workbench.workspace.publicShare.cat.files': '파일 {count}개',
  'workbench.workspace.publicView.bannerTag': '공개 스냅샷',
  'workbench.workspace.publicView.banner':
    '“{name}” 워크스페이스의 읽기 전용 공개 사본입니다. 여기서 한 편집은 어디에도 저장되지 않습니다.',
  'workbench.workspace.publicView.loadFailed': '이 공개 워크스페이스 링크는 사용할 수 없습니다.',
  'workbench.workspace.createOk': '만들기',
  'workbench.workspace.createFailed': '워크스페이스를 만들지 못했습니다',
  'workbench.workspace.createdToastPrefix': '워크스페이스 만듦:',
  'workbench.workspace.duplicateTitle': '“{name}” 복제',
  'workbench.workspace.duplicateTitleFallback': '워크스페이스 복제',
  'workbench.workspace.duplicateOk': '복제',
  'workbench.workspace.duplicateFailed': '워크스페이스를 복제하지 못했습니다',
  'workbench.workspace.duplicatedToast': '“{source}” → “{name}” 복제됨',
  'workbench.workspace.publishFailed': '워크스페이스를 복사하지 못했습니다',
  'workbench.workspace.publishedToast': '“{name}” 워크스페이스를 {place}에 복사했습니다',
  'workbench.workspace.selectedOrgFallback': '선택한 대상',
  'workbench.workspace.editTitle': '워크스페이스 편집',
  'workbench.workspace.saveOk': '저장',
  'workbench.workspace.updatedToast': '“{name}” 업데이트됨',
  'workbench.workspace.deletedElsewhere': '이 워크스페이스는 다른 탭에서 삭제되었습니다',
  'workbench.workspace.updateFailed': '워크스페이스를 업데이트하지 못했습니다',
  'workbench.workspace.updateFailedWithMessage': '워크스페이스를 업데이트하지 못했습니다: {message}',
  'workbench.workspace.otherWorkspaces': '다른 워크스페이스',
  'workbench.workspace.dragToReorder': '끌어서 순서 바꾸기',
  'workbench.workspace.activePill': '활성',
  'workbench.workspace.switch': '전환',
  'workbench.workspace.renameAria': '워크스페이스 이름 바꾸기',
  'workbench.workspace.duplicateAria': '워크스페이스 복제',
  'workbench.workspace.publishAria': '워크스페이스를 데스크톱 앱이나 서버로 복사',
  'workbench.workspace.deleteAria': '워크스페이스 삭제',
  'workbench.workspace.prefixLabel': '접두사',
  'workbench.workspace.nameLabel': '이름',
  'workbench.workspace.nameRequired': '이름은 필수입니다',
  'workbench.workspace.nameTooLong': '이름은 60자 미만으로 하세요',
  'workbench.workspace.namePlaceholder': '내 워크스페이스',
  'workbench.workspace.descriptionLabel': '설명 (선택 사항)',
  'workbench.workspace.copyOfName': '{name} 사본',
  'workbench.workspace.copyOfPlaceholder': '… 사본',
  'workbench.workspace.intoOrg': '복사 위치',
  'workbench.workspace.includeSecrets': 'vault 내용 (시크릿) 포함',
  'workbench.workspace.includeSecretsHint':
    '필요하면 사본에서 시크릿을 다시 입력하세요. OAuth 연결은 어느 쪽이든 다시 인가해야 합니다.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': '“{name}” 워크스페이스를 활성 워크스페이스로 만드시겠습니까?',
  'workbench.workspace.makeActiveBody':
    '팝업, 사이드 패널, 그리고 특정 워크스페이스에 고정되지 않은 새 {units} 항목은 모두 “{name}” 워크스페이스로 전환됩니다.',
  'workbench.workspace.makeActiveOk': '활성으로 설정',
  'workbench.workspace.cancel': '취소',
  'workbench.workspace.nowActiveToast': '이제 “{name}” 워크스페이스가 활성 워크스페이스입니다',
  'workbench.workspace.switcherAria': '이 {unit} 항목은 “{name}” 워크스페이스를 편집 중입니다. 클릭하면 전환합니다.',

  // ── Workspace: publish modal — "Copy to <place>" to the user ────────
  'workbench.workspace.publishTitle': '“{name}” 복사',
  'workbench.workspace.publishTitleFallback': '워크스페이스 복사',
  'workbench.workspace.publishToOk': '{place}에 복사',
  'workbench.workspace.publishOk': '복사',
  'workbench.workspace.publishIntro':
    '이 워크스페이스의 사본이 선택한 데스크톱 앱이나 서버에 만들어지고 거기서부터 동기화됩니다. 원본은 여기에 남습니다.',
  'workbench.workspace.toOrg': '복사 위치',
  'workbench.workspace.pickTargetOrg': '사본이 갈 곳을 고르세요',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': '로고',
  'workbench.workspace.org.logoAria': '이 조직의 로고 변경',
  'workbench.workspace.org.renameButton': '이름 바꾸기',
  'workbench.workspace.org.renameAria': '이 조직의 이름 바꾸기',
  'workbench.workspace.org.renameTitle': '{hint} 이름 바꾸기',
  'workbench.workspace.org.renameTitleFallback': '이름 바꾸기',
  'workbench.workspace.org.nameUpdated': '이름 업데이트됨',
  'workbench.workspace.org.identityLoading': '신원을 아직 불러오는 중입니다. 잠시 후 다시 시도하세요',
  'workbench.workspace.org.renameExtra': '워크스페이스 전환기와 워크스페이스를 공유하는 모든 사람에게 표시됩니다.',
  'workbench.workspace.org.nameTooLong': '이름은 {max}자 미만으로 하세요',
  'workbench.workspace.org.namePlaceholder': '내 업무용 노트북',
  'workbench.workspace.org.logoTitle': '{hint} 로고',
  'workbench.workspace.org.logoTitleFallback': '조직 로고',
  'workbench.workspace.org.logoAlt': '현재 조직 로고',
  'workbench.workspace.org.replace': '바꾸기…',
  'workbench.workspace.org.upload': '업로드…',
  'workbench.workspace.org.remove': '제거',
  'workbench.workspace.org.logoUpdated': '로고 업데이트됨',
  'workbench.workspace.org.logoRemoved': '로고 제거됨',
  'workbench.workspace.org.fileReadFailed': '그 파일을 읽을 수 없습니다.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP 또는 SVG 형식, 최대 {kb} KB. 정사각형 이미지가 가장 보기 좋습니다. 이 조직과 동기화하는 모든 사람에게 표시됩니다.',
  'workbench.workspace.org.logoReject.notImage': '그 파일을 이미지로 읽을 수 없습니다.',
  'workbench.workspace.org.logoReject.corruptImage': '그 파일은 선언된 유형의 유효한 이미지가 아닙니다.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'PNG, JPEG, WebP 또는 SVG 파일을 쓰세요.',
  'workbench.workspace.org.logoReject.tooLarge': '로고는 {kb} KB 미만으로 하세요.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    '이 SVG 파일에는 스크립트나 외부 참조가 들어 있습니다. 자체 완결된 단순한 SVG 파일로 내보내세요.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': '이제 워크스페이스에 접근할 수 있습니다',
  'workbench.workspace.grant.arrivedTitle': '워크스페이스를 사용할 수 있게 되었습니다',
  'workbench.workspace.grant.open': '워크스페이스 열기',
  'workbench.workspace.grant.notifTitleActive': '이제 {name} 워크스페이스에 접근할 수 있습니다',
  'workbench.workspace.grant.notifTitle': '{name} 워크스페이스를 사용할 수 있게 되었습니다',
  'workbench.workspace.grant.notifBodyActive':
    '관리자가 접근 권한을 부여했습니다. 지금 그 워크스페이스에서 작업 중입니다.',
  'workbench.workspace.grant.notifBody': '관리자가 접근 권한을 부여했습니다. 워크스페이스 전환기에 나타납니다.',
  'workbench.workspace.grant.orgFallback': '내 조직',
  'workbench.workspace.grant.zeroBanner':
    '{orgs}에 연결되었지만 아직 부여된 워크스페이스가 없습니다. 지금은 로컬 워크스페이스에서 작업 중입니다. 관리자가 접근 권한을 주면 부여된 워크스페이스가 여기에 자동으로 나타납니다.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': '색상 {name}',
  'workbench.workspace.picker.searchIcons': '아이콘 검색...',
  'workbench.workspace.picker.noIconTooltip': '아이콘 없음. 색상 사각형만 표시',
  'workbench.workspace.picker.noIconAria': '아이콘 없음',
  'workbench.workspace.picker.triggerAria': '워크스페이스 접두사 선택 (색상 또는 아이콘)',
} as const satisfies Catalog;
