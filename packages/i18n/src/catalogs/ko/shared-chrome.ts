/**
 * Shared chrome family — Korean. Mirrors
 * `catalogs/en/shared-chrome.ts` key for key; see that file for the
 * family rules and the raw-by-design plane (browser banner quoted
 * verbatim raw en, nav / worker / OOPIF, xhr/fetch, boot.interactive).
 * Mints: 디버그 모드 = Debug mode (carried); debug scope (reach
 * referent, distinct from the variable-scope 범위 carried from
 * shared-components — here the reach also reads 범위, disambiguated by
 * the 디버그 모드 qualifier); 연결 = attach (Chrome DevTools ko
 * vocabulary; the network 연결 = connection is context-partitioned);
 * 레이아웃 = layout; 레이아웃 원본 = layout donor; 스크래치 = Scratch
 * (unsaved tier) vs 초안 = Draft (saved tier, carried); 콜드 스타트 =
 * cold start / 콜드 웨이크 = cold wake; 프로세스 = Processes; 수명
 * 주기 = lifecycle (carried from panel-inspector-cookies); 릴리스
 * 노트 = release notes; 로그아웃 = sign out (Korean web convention);
 * 라이브 = Live (the register). {unit} / {units} holes carry localized
 * host nouns and take only invariant particles (의 / 에서) or a head
 * noun (항목은) — never 은/는, 이/가 directly.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': '디버그 모드',
  'shared.chrome.debug.titleShort': '디버그',
  'shared.chrome.debug.unavailableHint': '디버그 모드는 Chrome 및 Edge 브라우저에서 사용할 수 있습니다.',
  'shared.chrome.debug.toggleAria': '디버그 모드 전환',
  'shared.chrome.debug.aboutTooltip': '디버그 모드 정보',
  'shared.chrome.debug.openDocsAria': '디버그 모드 문서 열기',
  'shared.chrome.debug.controlsAria': '디버그 모드 컨트롤',
  'shared.chrome.debug.turnOn': '디버그 모드 켜기',
  'shared.chrome.debug.turnOff': '디버그 모드 끄기',
  'shared.chrome.debug.scopeDevtools': 'DevTools 창이 열린 곳',
  'shared.chrome.debug.scopeActive': '포커스된 탭',
  'shared.chrome.debug.scopeBoth': '둘 다',
  'shared.chrome.debug.attachTo': '연결 대상',
  'shared.chrome.debug.includeThisTab': '이 브라우저 탭 포함',
  'shared.chrome.debug.pinThisTabAria': '이 브라우저 탭 고정',
  'shared.chrome.debug.attachedTabs': '연결된 탭',
  'shared.chrome.debug.noTabsAttached': '아직 연결된 탭이 없습니다',
  'shared.chrome.debug.bannerNote':
    '디버그 모드가 켜져 있는 동안 브라우저 배너 “OH started debugging this browser”가 모든 탭에 표시됩니다. 연결된 탭에만 표시되는 것이 아닙니다.',
  'shared.chrome.debug.tabNumber': '탭 #{number}',
  'shared.chrome.debug.tabFallback': '탭 {id}',
  'shared.chrome.debug.onThisTab': '지금 이 탭에 있습니다',
  'shared.chrome.debug.switchTo': '{target} 탭으로 전환',
  'shared.chrome.debug.dormantTooltip':
    '디버그 모드는 켜져 있지만 이 탭은 그 범위 밖입니다. 디버그 계층 규칙의 nav / worker / OOPIF 효과는 여기서 잠들어 있습니다. 디버그 모드에서 범위에 넣으세요 (범위를 바꾸거나 이 탭을 고정). 페이지 요청 (xhr/fetch)에는 계속 작용합니다.',
  'shared.chrome.debug.tabOutOfScope': '범위 밖의 탭',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': '시스템',
  'shared.chrome.status.aria': '시스템 상태: {summary}',
  'shared.chrome.status.aboutTooltip': '이 패널 정보',
  'shared.chrome.status.openDocsAria': '시스템 상태 문서 열기',
  'shared.chrome.status.healthy': '정상',
  'shared.chrome.status.failure': '장애',
  'shared.chrome.status.issues': '문제 있음',
  'shared.chrome.status.noEvents': '아직 이벤트가 없습니다',
  'shared.chrome.status.subsystemSync': '동기화',
  'shared.chrome.status.subsystemRules': '규칙',
  'shared.chrome.status.subsystemRequests': '요청',
  'shared.chrome.status.subsystemPermissions': '권한',
  'shared.chrome.status.subsystemSecrets': '시크릿',
  'shared.chrome.status.subsystemLive': '라이브',
  'shared.chrome.status.subsystemActivity': '활동',
  'shared.chrome.status.subsystemDebugMode': '디버그 모드',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': '빌드 {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': '앱 다시 시작',
  'shared.chrome.status.backendOff': '꺼짐',
  'shared.chrome.status.backendConnecting': '연결 중…',
  'shared.chrome.status.companionDesktopApp': '데스크톱 앱',
  'shared.chrome.status.companionExtensions': '확장 프로그램',
  'shared.chrome.status.companionConnected': '연결됨',
  'shared.chrome.status.companionRunsRequests': '요청 실행',
  'shared.chrome.status.companionNotConnected': '연결되지 않음',
  'shared.chrome.status.companionInstalledNotConnected': '설치됨 · 연결되지 않음',
  'shared.chrome.status.companionNotInstalled': '설치되지 않음',
  'shared.chrome.status.companionDownload': '다운로드',
  'shared.chrome.status.companionPeersConnected': '{count}개 연결됨',
  'shared.chrome.status.companionNoPeers': '연결된 것 없음',
  'shared.chrome.status.companionConnect': '연결',
  'shared.chrome.status.companionOpenApp': '앱 열기',
  'shared.chrome.addons.title': '부가 기능',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': '서버',
  'shared.chrome.addons.cliSetUp': '설정됨',
  'shared.chrome.addons.cliNotSetUp': '설정되지 않음',
  'shared.chrome.addons.cliStale': 'token 값이 폐기되었습니다. 다시 설정하세요',
  'shared.chrome.addons.cliExternal': '외부 구성',
  'shared.chrome.addons.cliMalformed': '구성이 잘못됨',
  'shared.chrome.addons.cliProvision': '설정',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': '켜짐',
  'shared.chrome.addons.mcpTurnOn': '켜기',
  'shared.chrome.addons.notConfigured': '구성되지 않음',
  'shared.chrome.addons.requiresDesktop': '데스크톱 앱이 필요합니다',
  'shared.chrome.addons.cliViaDesktop': '데스크톱 앱에서 설정',
  'shared.chrome.status.coldStart': '콜드 스타트',
  'shared.chrome.status.coldStartMessage': '성능 저하가 감지되었습니다. 진단 내보내기를 확인하세요',
  'shared.chrome.status.coldStartTooltip':
    '연속 세 번의 콜드 웨이크가 기준선을 20% 이상 넘었습니다. 최근 boot.interactive 샘플 (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': '업데이트',
  'shared.chrome.updates.downloading': '다운로드 중…',
  'shared.chrome.updates.downloadingPercent': '다운로드 중… {percent}%',
  'shared.chrome.updates.updateAndRestart': '업데이트 후 다시 시작',
  'shared.chrome.updates.ignore': '이 업데이트 무시',
  'shared.chrome.updates.remindLater': '나중에 알림',
  'shared.chrome.updates.nowAvailableSuffix': '버전을 지금 사용할 수 있습니다!',
  'shared.chrome.updates.moreDetailsPrefix': '자세한 내용은 다음을 참조하세요:',
  'shared.chrome.updates.releaseNotes': '릴리스 노트',
  'shared.chrome.updates.updatingTo': '{from} 버전에서 {to} 버전으로 업데이트하는 중입니다.',
  'shared.chrome.updates.configure': '업데이트 구성…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': '{version} 버전 다운로드',
  'shared.chrome.gearMenu.versionAvailable': '{version} 버전 사용 가능…',
  'shared.chrome.gearMenu.updateAndRestartVersion': '{version} 버전으로 업데이트 후 다시 시작',
  'shared.chrome.gearMenu.downloadingVersion': '{version} 버전 다운로드 중…',
  'shared.chrome.gearMenu.restartToInstallVersion': '다시 시작하여 {version} 버전 설치',
  'shared.chrome.gearMenu.settings': '설정…',
  'shared.chrome.gearMenu.keyboardShortcuts': '키보드 단축키…',
  'shared.chrome.gearMenu.appearance': '모양…',
  'shared.chrome.gearMenu.about': 'Open Headers 정보',
  'shared.chrome.gearMenu.tourGuide': '투어 가이드',
  'shared.chrome.gearMenu.signOut': '로그아웃',
  'shared.chrome.gearMenu.searchPlaceholder': '검색',
  'shared.chrome.gearMenu.noMatches': '일치 없음',
  'shared.chrome.gearMenu.settingsTooltip': '설정',
  'shared.chrome.gearMenu.settingsMenuAria': '설정 메뉴',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': '프로세스',
  'shared.chrome.tasks.hidePanelAria': '프로세스 패널 숨기기',
  'shared.chrome.tasks.allCompleted': '모든 백그라운드 작업이 완료되었습니다',
  'shared.chrome.tasks.aboutNoteAria': '이 참고 정보',
  'shared.chrome.tasks.stop': '중지',
  'shared.chrome.tasks.keepRunning': '계속 실행',
  'shared.chrome.tasks.stopTaskAria': '백그라운드 작업 중지',
  'shared.chrome.tasks.hideTaskAria': '백그라운드 작업 숨기기',
  'shared.chrome.tasks.hideProcesses': '프로세스 숨기기',
  'shared.chrome.tasks.hideProcessesCount': '프로세스 숨기기 ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': '기본 {unit}. 새 {units} 항목은 여기서 레이아웃을 상속합니다.',
  'shared.chrome.donor.nonDefaultTooltip':
    '다른 {unit} 항목이 기본 레이아웃 원본입니다. 새 {units} 항목은 거기서 상속합니다.',
  'shared.chrome.donor.isDonorBody': '이 {unit} 항목이 현재 기본입니다. 새 {units} 항목은 이 레이아웃을 상속합니다.',
  'shared.chrome.donor.nonDonorBody':
    '다른 {unit} 항목이 현재 기본입니다. 새 {units} 항목은 그 {unit} 항목의 레이아웃을 상속합니다.',
  'shared.chrome.donor.reset': '레이아웃을 기본값으로 재설정',
  'shared.chrome.donor.defaultAria': '새 {unit} 항목이 레이아웃을 상속하는 기본 {unit}',
  'shared.chrome.donor.nonDefaultAria': '새 {unit} 항목이 레이아웃을 상속하는 기본 {unit} 아님',
  'shared.chrome.donor.defaultLabel': '기본 {unit}',
  'shared.chrome.donor.inheritsLabel': '레이아웃 상속',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': '수명 주기 상태',
  'shared.chrome.lifecycle.scratch': '스크래치',
  'shared.chrome.lifecycle.scratchBody': '저장하지 않은 초안입니다. 저장하기 전까지는 아무것도 보존되지 않습니다.',
  'shared.chrome.lifecycle.unresolved': '미확인',
  'shared.chrome.lifecycle.unresolvedBody': '활성 범위에서 확인되지 않는 {{ref}} 참조가 있습니다.',
  'shared.chrome.lifecycle.draft': '초안',
  'shared.chrome.lifecycle.draftBody':
    '저장되었지만 아직 라이브가 아닙니다. 필수 필드가 빠졌거나 아직 게시되지 않았습니다.',
  'shared.chrome.lifecycle.live': '라이브',
  'shared.chrome.lifecycle.liveBody': '게시되어 활성 상태입니다.',
} as const satisfies Catalog;
