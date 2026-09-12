/**
 * Shared notifications family — Korean. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key. Mints: 알림 =
 * notification; 제안 = suggestion; 타임라인 = timeline; 무시 = Dismiss;
 * 다시 표시 안 함 = Don't show again; 릴리스 노트 = release notes;
 * 키체인 / 키링 = keychain / keyring; 자격 증명 저장소 = credential
 * store. `{version}` takes the head noun 버전 where a particle follows.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': '알림',
  'shared.notifications.info.summary':
    '설정에 대한 제안과 앱 이벤트의 세션 타임라인입니다. 업데이트 가능 여부, 백그라운드 작업 결과, 기타 알림이 작업을 방해하지 않고 여기에 모입니다.',
  'shared.notifications.suggestionsHeading': '제안',
  'shared.notifications.timelineHeading': '타임라인',
  'shared.notifications.clearAll': '모두 지우기',
  'shared.notifications.suggestionsEmpty.title': '제안 없음',
  'shared.notifications.suggestionsEmpty.description': '설정에 대한 조언이 여기에 표시됩니다.',
  'shared.notifications.timelineEmpty.title': '알림 없음',
  'shared.notifications.timelineEmpty.description': '앱 이벤트와 업데이트가 여기에 표시됩니다.',
  'shared.notifications.dismiss': '무시',
  'shared.notifications.moreActions': '추가 작업',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': '다시 표시 안 함',
  'shared.notifications.muted.title': '알림 비활성화됨',
  'shared.notifications.muted.description': '“{title}” 알림은 다시 표시되지 않습니다.',
  'shared.notifications.muted.reEnable': '다시 활성화',
  'shared.notifications.muted.reEnableTooltip': '이 알림을 다시 표시하도록 허용',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Open Headers 살펴보기',
  'shared.notifications.seed.website.description': '모든 기능을 대화형으로 살펴보고 최신 업데이트를 확인하세요.',
  'shared.notifications.seed.website.action': '웹사이트 방문',
  'shared.notifications.seed.website.tooltip': '웹사이트를 열고 알림 지우기',
  'shared.notifications.seed.star.title': '성장을 도와주세요',
  'shared.notifications.seed.star.description': '친구와 동료에게 추천해 주세요',
  'shared.notifications.seed.star.action': 'GitHub 저장소에 별 주기',
  'shared.notifications.seed.star.tooltip': 'GitHub 페이지를 열고 알림 지우기',

  // ── Desktop-app suggestion ─────────────────────────────────────────
  'shared.notifications.desktopApp.title': '하나로 통합된 사용자 경험',
  'shared.notifications.desktopApp.rowTerminal': '통합 터미널: 워크스페이스에서 완전한 셸 사용',
  'shared.notifications.desktopApp.rowGit': '버전 관리: 워크스페이스의 Git 커밋과 기록',
  'shared.notifications.desktopApp.rowProxy': '브라우저 탭 또는 시스템의 실시간 트래픽 캡처',
  'shared.notifications.desktopApp.rowMcp': 'AI 어시스턴트용 MCP 서버: 실시간 트래픽 분석과 디버깅',
  'shared.notifications.desktopApp.rowRequests': '네이티브 API 요청 작성 및 실행: gRPC, WebSocket, SSE 등',
  'shared.notifications.desktopApp.action': '데스크톱 앱 다운로드',
  'shared.notifications.desktopApp.tooltip': '앱을 다운로드하고 제안 지우기',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': '{version} 사용 가능',
  'shared.notifications.appUpdate.securityTitle': '{version} 보안 업데이트 사용 가능',
  'shared.notifications.appUpdate.securityDescription':
    '이 릴리스는 현재 실행 중인 버전에 영향을 주는 보안 문제를 수정합니다. 가능한 한 빨리 업데이트하세요.',
  'shared.notifications.appUpdate.download': '다운로드…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': '설정…',
  'shared.notifications.toast.dontShowAgain': '다시 표시 안 함',
  'shared.notifications.toast.optionsTooltip': '끄거나 동작 변경',
  'shared.notifications.toast.optionsAria': '업데이트 알림 옵션',
  'shared.notifications.toast.close': '닫기',
  'shared.notifications.toast.upToDateTitle': '최신 상태입니다',
  'shared.notifications.toast.upToDateDescription': '{version} 버전이 최신 버전입니다.',
  'shared.notifications.toast.checkFailed': '업데이트 확인 실패',
  'shared.notifications.toast.downloadFailed': '업데이트 다운로드 실패',
  'shared.notifications.toast.available': '{version} 사용 가능',
  'shared.notifications.toast.update': '업데이트…',
  'shared.notifications.toast.packageManager': 'Linux 패키지 관리자를 통해 업데이트하세요.',
  'shared.notifications.toast.releaseNotes': '릴리스 노트',
  'shared.notifications.toast.readyToInstall': '{version} 설치 준비 완료',
  'shared.notifications.toast.restartToInstall': '다시 시작하여 설치',
  'shared.notifications.toast.updatedTo': '{version} 버전으로 업데이트됨',
  'shared.notifications.toast.seeWhatsNew': '새로운 기능 보기',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    '{availableVersion} 버전은 현재 실행 중인 버전({currentVersion})에 영향을 주는 보안 문제를 수정합니다. 가능한 한 빨리 업데이트하세요.',
  'shared.notifications.securityBanner.messageNoVersion':
    '현재 실행 중인 버전({currentVersion})에 대한 보안 수정이 게시되었습니다. 가능한 한 빨리 업데이트하세요.',
  'shared.notifications.securityBanner.update': '업데이트…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': '시크릿 저장소가 잠겨 있습니다',
  'shared.notifications.secrets.description':
    '이 세션에서는 Vault 시크릿과 OAuth 토큰을 읽거나 저장할 수 없습니다. {remedy}',
  'shared.notifications.secrets.relaunch': '앱 다시 실행',
  'shared.notifications.secrets.remedy.darwin':
    'Open Headers 앱의 시스템 키체인 접근이 거부되었습니다. 앱을 다시 실행하고 메시지가 표시되면 키체인 접근을 허용하세요.',
  'shared.notifications.secrets.remedy.linux':
    '사용할 수 있는 키링 백엔드가 없습니다. 키링(GNOME Keyring 또는 KWallet)을 설정한 다음 앱을 다시 실행하세요.',
  'shared.notifications.secrets.remedy.other':
    'Open Headers 앱이 시스템 자격 증명 저장소에 접근할 수 없습니다. 앱을 다시 실행해 다시 시도하세요.',
} as const satisfies Catalog;
