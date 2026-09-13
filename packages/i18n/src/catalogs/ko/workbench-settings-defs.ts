/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories — Korean. Mirrors `catalogs/en/workbench-settings-defs.ts`
 * key for key. Brand and platform vocabulary (Chrome / Firefox / Edge,
 * font names, window titles) rides raw per the S48 settings-station
 * decisions; `declarativeNetRequest`, `url-filter`, `Cache-Control:
 * no-cache`, `{{ns.X}}` references, INVALID_ARGUMENT and IP/port
 * literals are wire tokens. The workspaceLayout section quotes the ko
 * devpanel-defs twins verbatim (양쪽 맞춤 / 쌓기 / 동적 / 비례 / 상태
 * 표시줄 / 상단 표시줄, aligned with the shipped `panel.ts` layout
 * menu); merge strategies mint the import-export vocabulary here
 * (“새로 추가” / “바꾸기” / “건너뛰기” — `workbench-import-export.ts`
 * must reuse); “이 페이지” quotes the popup tab name; 디버그 모드 /
 * 연결 (attach) / 범위 follow the debug vocabulary; “캐시 사용 안 함”
 * quotes the panel toolbar mint; 업데이트 후 다시 시작 / 진단 로그
 * 내보내기 carried. The three peer-execute / desktop-watch labels copy
 * the shipped shared-components / popup quotes verbatim. MINTS:
 * 에이전트 = agent (MCP); 활동 피드 = Activity Feed; UI 크롬 = the UI
 * chrome; 프로필 = terminal profile (platform convention); 스크롤백 =
 * scrollback; 병렬 / 통합 = side-by-side / unified diff; 리거처 =
 * ligatures; 강조 색 = accent color; 디바운스 = debounce; 시스템 따르기
 * = Follow system; 넓게 / 간결 carried; theme variant names (Warm /
 * Rose / Sepia / Dim / Midnight / Forest / Arctic) ride raw as palette
 * proper names. Every raw token takes a head noun before a particle
 * (Chrome 브라우저의, JSON 형식이, URL 주소를, LAN 네트워크의).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': '자동으로 페어링',
  'workbench.settings.def.backend.nmAutoJoin.description':
    'Open Headers 데스크톱 앱이 이 컴퓨터에서 실행 중이면 페어링 코드 없이 연결합니다. 데스크톱 앱은 접근을 허용하기 전에 운영 체제를 통해 이 브라우저를 검증합니다. 끄면 명시적인 동작으로만 페어링합니다.',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': '백그라운드에서 확인',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    '연결된 데스크톱 앱이 없을 때 몇 분마다 설치되었는지 확인하여, 새로 설치되면 스스로 연결되게 합니다. 끄면 확장 프로그램이 시작할 때만 확인합니다.',
  'workbench.settings.def.backend.requireNmIdentity.label': '검증된 페어링 필수',
  'workbench.settings.def.backend.requireNmIdentity.description':
    '이 컴퓨터의 데스크톱 앱에 대한 페어링 코드와 붙여넣은 token 값을 거부합니다. 운영 체제가 검증한 인계만 접근을 허용할 수 있습니다. 원격 백엔드에는 영향이 없습니다. 보통 조직 정책으로 설정됩니다.',
  'workbench.settings.def.backend.allowDesktopWatch.label': '데스크톱 앱이 이 브라우저를 보도록 허용',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    '이 컴퓨터의 페어링된 데스크톱 앱이 트래픽 패널에서 이 브라우저의 네트워크 트래픽, 저장소, 콘솔을 보도록 허용합니다. 끄면 규칙과 동기화는 계속 동작하지만 데스크톱 앱의 라이브 보기는 정중히 거부됩니다.',
  'workbench.settings.def.backend.bindAddress.label': '네트워크 기기와 동기화',
  'workbench.settings.def.backend.bindAddress.description':
    '같은 네트워크의 다른 컴퓨터와 브라우저가 이 앱에 연결하여 워크스페이스를 공유하도록 허용합니다. 기본값은 꺼짐입니다. 이 컴퓨터만 접근할 수 있습니다.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': '루프백만 (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description': '이 컴퓨터만 연결할 수 있습니다. 기본값.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': '모든 인터페이스 (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    '로컬 네트워크의 다른 기기가 연결할 수 있습니다. U3.2의 인증 token 값이 필요합니다.',
  'workbench.settings.def.backend.bindPort.label': '포트',
  'workbench.settings.def.backend.bindPort.description':
    '브라우저와 다른 기기가 연결하도록 이 앱이 바인딩하는 포트입니다. 다른 것이 이미 기본값을 쓰는 경우에만 바꾸세요. 클라이언트는 같은 포트를 가리켜야 합니다.',
  'workbench.settings.def.backend.serveWebApp.label': '웹 앱 제공',
  'workbench.settings.def.backend.serveWebApp.description':
    '백엔드 포트에서 워크벤치를 웹 페이지로 제공하여, 브라우저 탭이 확장 프로그램 없이 이 앱에서 바로 열 수 있게 합니다. 포트에 접근할 수 있는 누구나 로그인 게이트를 보지만, 데이터에 접근하려면 여전히 페어링된 token 값이 필요합니다.',
  'workbench.settings.def.backend.allowLocalPeerExecute.label': '이 기기의 브라우저가 요청을 보내도록 허용',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    '이 컴퓨터의 페어링된 브라우저가 이 앱을 통해 API 요청을 보내도록 허용합니다. 확장 프로그램은 이 앱을 요청 엔진으로 쓰므로 워크벤치의 보내기가 여기서 실행됩니다. 기본값은 켜짐입니다. 페어링이 곧 동의입니다. 보내기마다 워크스페이스 쓰기 권한이 여전히 필요합니다.',
  'workbench.settings.def.backend.allowRemotePeerExecute.label': '연결된 다른 기기가 요청을 보내도록 허용',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    '다른 컴퓨터의 페어링된 기기가 이 앱을 통해 API 요청을 보내도록 허용합니다. 그 기기의 워크벤치 보내기가 이 컴퓨터의 네트워크 접근과 주소로 실행됩니다. 기본값은 꺼짐입니다. 운영자의 결정이며 페어링이 암시하지 않습니다. 보내기마다 워크스페이스 쓰기 권한이 여전히 필요합니다.',
  'workbench.settings.def.backend.reconnectDelayMs.label': '초기 지연',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    '연결이 끊긴 뒤 첫 재연결 시도까지 기다리는 시간 (ms)입니다.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': '최대 지연',
  'workbench.settings.def.backend.maxReconnectDelayMs.description': '재연결 시도 사이 지수 백오프의 상한 (ms)입니다.',
  'workbench.settings.def.backend.pingIntervalMs.label': '킵얼라이브 간격',
  'workbench.settings.def.backend.pingIntervalMs.description':
    '엄격한 프록시 뒤에서도 WebSocket 연결이 열려 있도록 핑을 보내는 주기 (ms)입니다.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': '연결 끊김 시 배지',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    '백엔드 연결이 끊기면 도구 모음 아이콘에 빨간 배지를 표시합니다.',
  'workbench.settings.def.backend.offlineFallbackOrder.label': '호스트 순서',
  'workbench.settings.def.backend.offlineFallbackOrder.description':
    '백엔드가 오프라인이 되면 이 목록에서 연결 가능한 첫 호스트가 배타적 워크플로의 자격 증명을 스스로 새로 고칩니다. 호스트는 자동으로 등록됩니다. 드래그하여 순위를 바꾸세요.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': '활성화',
  'workbench.settings.def.mcp.enabled.description':
    '이 앱의 백엔드 포트에서 MCP 클라이언트에 응답합니다. 꺼져 있으면 엔드포인트가 존재하지 않습니다. 켜면 접근 token 값을 가진 에이전트가 워크스페이스를 읽을 수 있습니다.',
  'workbench.settings.def.mcp.allowObserve.label': '트래픽 관찰',
  'workbench.settings.def.mcp.allowObserve.description':
    '에이전트가 트래픽 패널에서 캡처하는 소스의 라이브 트래픽을 읽을 수 있습니다. 캡처하지 않는 소스는 보이지 않으며, 인증 헤더, 쿠키, token 형태의 값은 고정된 표식으로 대체됩니다.',
  'workbench.settings.def.mcp.allowWrite.label': '쓰기 도구',
  'workbench.settings.def.mcp.allowWrite.description':
    '에이전트가 규칙, 요청, 환경, 변수, 워크플로를 만들고 편집하고 삭제할 수 있습니다. 모든 변경은 활동 피드에 기록되며 되돌릴 수 있습니다.',
  'workbench.settings.def.mcp.allowExecute.label': '실행 도구',
  'workbench.settings.def.mcp.allowExecute.description':
    '에이전트가 저장된 요청을 보내고 워크플로를 실행할 수 있습니다. 실제 네트워크 트래픽이 에이전트를 대신해 이 컴퓨터를 떠납니다.',
  'workbench.settings.def.mcp.allowSecrets.label': '시크릿 공개',
  'workbench.settings.def.mcp.allowSecrets.description':
    '에이전트가 vault 시크릿 값을 평문으로 읽을 수 있습니다. 꺼져 있으면 모든 시크릿이 가려진 채로 유지됩니다.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': '언어',
  'workbench.settings.def.general.language.description':
    '인터페이스 표시 언어입니다. 열린 모든 화면에 즉시 적용되며 다시 로드하지 않습니다. 기술 용어 (헤더 이름, HTTP 메서드, 프로토콜 용어)는 모든 언어에서 영어로 유지됩니다.',
  'workbench.settings.def.general.language.option.auto.label': '시스템 따르기',
  'workbench.settings.def.general.language.option.auto.description': '브라우저 또는 운영 체제 언어에 맞춥니다',
  'workbench.settings.def.general.language.option.pseudo.description':
    '번역되지 않았거나 잘린 텍스트를 찾기 위한, 악센트가 붙고 늘어난 영어',
  'workbench.settings.def.general.confirmOnDelete.label': '삭제 전 확인',
  'workbench.settings.def.general.confirmOnDelete.description':
    '규칙, 폴더, 컬렉션을 삭제하기 전에 확인 대화 상자를 표시합니다.',
  'workbench.settings.def.general.showEmptyStateHints.label': '빈 상태 힌트 표시',
  'workbench.settings.def.general.showEmptyStateHints.description': '빈 패널과 온보딩 영역에 안내와 팁을 표시합니다.',
  'workbench.settings.def.terminal.profiles.label': '프로필',
  'workbench.settings.def.terminal.profiles.description':
    '터미널이 탭을 열 수 있는 셸입니다. 일반 새 탭은 기본값을 쓰고, 탭 행의 + 옆 화살표로 특정 프로필을 고릅니다.',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': '실행 중인 프로세스 닫기 전 확인',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    '셸에 아직 실행 중인 프로세스가 있는 터미널 탭을 닫기 전에 묻습니다. 유휴 셸은 항상 조용히 닫힙니다.',
  'workbench.settings.def.terminal.startDirectory.label': '시작 디렉터리',
  'workbench.settings.def.terminal.startDirectory.description':
    '새 터미널 탭이 시작하는 디렉터리입니다. 자체 디렉터리가 있는 프로필이 이를 재정의하며, 비우면 홈 디렉터리입니다. 다음에 여는 탭부터 적용됩니다.',
  'workbench.settings.def.terminal.defaultTabName.label': '기본 탭 이름',
  'workbench.settings.def.terminal.defaultTabName.description':
    '프로필로 열지 않았고 이름을 바꾸지 않은 터미널 탭의 이름입니다. 비우면 "Local"을 씁니다. 같은 이름의 탭이 여럿이면 번호가 붙습니다.',
  'workbench.settings.def.terminal.fontFamilyPreset.label': '글꼴',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    '터미널 텍스트의 서체입니다. 프리셋은 앱에 내장되어 있거나 모든 운영 체제가 제공하는 글꼴에 의존합니다.',
  'workbench.settings.def.terminal.fontSize.label': '글꼴 크기',
  'workbench.settings.def.terminal.fontSize.description': '터미널 텍스트 크기 (픽셀)입니다.',
  'workbench.settings.def.terminal.lineHeight.label': '줄 높이',
  'workbench.settings.def.terminal.lineHeight.description':
    '글꼴 크기의 배수로 나타낸 줄 간격입니다. 1이 글꼴의 자연스러운 간격입니다.',
  'workbench.settings.def.terminal.cursorStyle.label': '커서 모양',
  'workbench.settings.def.terminal.cursorStyle.description': '터미널 캐럿을 그리는 방식입니다.',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': '블록',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': '밑줄',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': '세로 막대',
  'workbench.settings.def.terminal.cursorBlink.label': '커서 깜박임',
  'workbench.settings.def.terminal.cursorBlink.description': '터미널 캐럿을 깜박입니다.',
  'workbench.settings.def.terminal.minimumContrastRatio.label': '최소 대비율',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    '배경과의 대비가 이 값에 이르도록 텍스트 색을 조정합니다. 1은 색을 그대로 두고, 4.5는 WCAG AA 기준을 충족하며, 21은 최대 대비를 강제합니다.',
  'workbench.settings.def.terminal.scrollback.label': '스크롤백 버퍼',
  'workbench.settings.def.terminal.scrollback.description':
    '터미널이 보이는 화면 위로 유지하는 줄 수입니다. 값이 클수록 탭당 메모리를 더 씁니다.',
  'workbench.settings.def.terminal.macOptionIsMeta.label': 'Option 키를 Meta 키로 사용',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    'macOS에서 Option 키를 Meta 키로 취급하여, Option+B 같은 단축키가 특수 문자를 입력하는 대신 셸 줄 편집에 닿게 합니다.',
  'workbench.settings.def.terminal.copyOnSelect.label': '선택 시 복사',
  'workbench.settings.def.terminal.copyOnSelect.description': '터미널 텍스트를 선택하는 즉시 클립보드에 복사합니다.',
  'workbench.settings.def.terminal.hyperlinks.label': '링크 강조',
  'workbench.settings.def.terminal.hyperlinks.description':
    '터미널 출력에서 URL 주소를 감지하고 클릭하면 브라우저에서 엽니다.',
  'workbench.settings.def.terminal.audibleBell.label': '소리 벨',
  'workbench.settings.def.terminal.audibleBell.description': '프로그램이 터미널 벨을 울리면 짧은 신호음을 냅니다.',
  'workbench.settings.def.terminal.closeTabOnExit.label': '셸 종료 시 탭 닫기',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    '셸이 종료되는 즉시 터미널 탭을 닫습니다. 끄면 탭이 다시 시작 버튼과 함께 열린 채로 남습니다.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': '시작 시 탭 복원',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    '이전 세션이 끝날 때 열려 있던 편집기 탭을 다시 엽니다.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': '환경 자동 전환',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    '컬렉션과 그 안의 항목 (규칙, 요청, 폴더) 사이를 이동할 때 활성 환경이 바뀌는 방식입니다. 규칙 컬렉션과 API 요청 컬렉션 모두에 적용됩니다. 컬렉션은 기본 환경을 두고 추천 환경의 짧은 목록을 고정할 수 있으며, 이 설정은 그 기본값이 자동으로 적용될지 제어합니다.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': '선택한 환경 유지',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    '컬렉션과 그 하위 폴더, 규칙, 요청 사이를 이동해도 선택한 것 (환경 없음 포함)이 그대로 유지됩니다. 컬렉션의 기본값은 선택된 환경이 없을 때만 적용됩니다.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label': '컬렉션 기본값 적용',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    '컬렉션 (또는 그 안의 하위 폴더, 규칙, 요청) 안에 있는 동안 컬렉션의 기본값이 적용됩니다. 마지막으로 직접 고른 것이 기준 환경이며, 컬렉션을 떠나거나 기본값이 없는 컬렉션에 들어갈 때마다 복원됩니다. 컬렉션별 기억은 없습니다.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': '컬렉션마다 따르기',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    '기본 환경이 있는 컬렉션 (또는 그 안의 하위 폴더, 규칙, 요청)을 열면 그 기본값으로 전환합니다. 컬렉션 안에서 고른 것은 그 컬렉션에 대해 기억됩니다. 기본값이 없는 컬렉션은 자동 전환하지 않습니다.',
  'workbench.settings.def.general.settingsOpenMode.label': '열기 모드',
  'workbench.settings.def.general.settingsOpenMode.description':
    '도구 모음, 팝업, 명령 팔레트에서 설정 페이지를 여는 방식입니다.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': '모달',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': '현재 페이지 가운데의 오버레이',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': '모달 (최대화)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    '뷰포트 대부분을 채우는 오버레이',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': '편집기 탭',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description': '워크스페이스의 전체 편집기 탭으로 열기',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': '사이드바에 범주 이름 표시',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    '설정 사이드바의 범주 아이콘 옆에 텍스트 레이블을 표시합니다. 사이드바를 오른쪽 클릭하여 전환합니다. 아이콘만 있는 간결한 레일을 원하면 끄세요.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': '색 테마',
  'workbench.settings.def.appearance.theme.description': '앱의 전체 색 테마를 제어합니다.',
  'workbench.settings.def.appearance.theme.option.light.label': '라이트',
  'workbench.settings.def.appearance.theme.option.dark.label': '다크',
  'workbench.settings.def.appearance.theme.option.auto.label': '시스템 따르기',
  'workbench.settings.def.appearance.theme.option.auto.description': '운영 체제에 맞춥니다',
  'workbench.settings.def.appearance.lightVariant.label': '라이트 변형',
  'workbench.settings.def.appearance.lightVariant.description': '해석된 색 테마가 라이트일 때 쓰는 팔레트입니다.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': '기본',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    '일상용으로 균형 잡힌 중립 라이트 테마입니다.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': '고대비',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    '최대 가독성입니다. 순백 표면, 거의 검은 텍스트, AAA 대비.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    '따뜻한 중립색과 호박색 강조의 종이 같은 표면입니다. 긴 세션에도 눈이 편합니다.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    '슬레이트 블루 색조의 라이트 테마입니다. 선명한 표면과 강청색 강조.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    '마젠타 강조의 부드러운 홍조 표면입니다. Warm 변형의 호박색 없이 은은한 따뜻함.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    '짙은 갈색 텍스트의 채도 높은 양피지 팔레트입니다. 색조가 가장 진한 라이트 변형으로, 오래 읽기에 알맞습니다.',
  'workbench.settings.def.appearance.darkVariant.label': '다크 변형',
  'workbench.settings.def.appearance.darkVariant.description': '해석된 색 테마가 다크일 때 쓰는 팔레트입니다.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': '기본',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    '일상용으로 균형 잡힌 중립 다크 테마입니다.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': '고대비',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    '최대 가독성입니다. 완전한 검은 표면, 밝은 텍스트, AAA 대비.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    '눈부심이 적은 부드러운 슬레이트 블루 표면입니다. 어두운 환경에서 눈이 편합니다.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    '선명한 파란 강조의 짙은 남색 표면입니다. Dim 변형보다 풍부하고 채도가 높습니다.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    '에메랄드 강조의 녹색 색조 다크 표면입니다. 차분한 초목 팔레트.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    '서리 같은 청록 강조의 차가운 청회색 다크 테마입니다. Dim 또는 Midnight 변형보다 평평하고 채도가 낮습니다.',
  'workbench.settings.def.appearance.uiScale.label': '배율',
  'workbench.settings.def.appearance.uiScale.description':
    '편집기 글꼴 크기는 바꾸지 않고 크롬 전체 (버튼, 텍스트, 여백, 컨트롤)의 배율을 조정합니다.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': '아주 작게 (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    '가장 촘촘한 레이아웃입니다. 유난히 높고 넓게 렌더링되는 Press Start 2P UI 글꼴과 함께 쓸 때 유용합니다.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': '간결 (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    '편안한 클릭 대상은 유지하면서 더 촘촘한 크롬입니다.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': '작게 (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    '기본값보다 조금 촘촘합니다. 화면에 더 많이 들어갑니다.',
  'workbench.settings.def.appearance.uiScale.option.1.label': '보통 (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': '기본 크롬 크기입니다.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': '크게 (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': '읽기 쉽도록 조금 키웠습니다.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': '아주 크게 (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description': '최대 크롬 배율입니다. 접근성에 가장 좋습니다.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': '글꼴 모음',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    '앱 크롬용으로 엄선한 산세리프 스택입니다. 기본값은 플랫폼 간 일관성을 위해 Windows / Linux에서는 Inter 글꼴, macOS에서는 SF Pro 글꼴의 기본 광학 크기를 유지하기 위해 System Sans입니다. 모든 옵션은 확장 프로그램에 내장되어 있습니다. 편집기 화면에는 별도의 글꼴 설정이 있습니다.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    '화면용으로 설계된 내장 UI 산세리프입니다. 모든 운영 체제에서 동일하게 렌더링되므로 macOS, Windows, Linux에서 앱이 같은 모습입니다.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    '운영 체제 기본 UI 산세리프입니다. macOS에서는 San Francisco, Windows에서는 Segoe UI, Linux에서는 Roboto 글꼴입니다. 플랫폼 간 일관성보다 기본 모습을 선호하면 사용하세요.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    '저시력 가독성을 위해 설계된 산세리프입니다. 독특한 글자꼴이 문자 혼동을 줄입니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    '내장 터미널 글꼴과 같은 모노스페이스 UI입니다. 크롬 전체가 개발자 도구 같은 모습이 됩니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    '앱과 함께 제공하는 픽셀 스타일 디스플레이 글꼴입니다. 내장되어 항상 사용할 수 있습니다. 재미로 고르는 선택지입니다. 읽을 수는 있지만 높고 넓어서 크롬 여백이 넉넉해 보입니다.',
  'workbench.settings.def.appearance.density.label': '밀도',
  'workbench.settings.def.appearance.density.description': '간결 모드는 목록, 표, 양식의 여백을 줄입니다.',
  'workbench.settings.def.appearance.density.option.comfortable.label': '편안함',
  'workbench.settings.def.appearance.density.option.compact.label': '간결',
  'workbench.settings.def.appearance.editorHeaderPosition.label': '편집기 헤더 위치',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    '각 편집기가 제목과 작업 행 (이름, 활성 토글, 저장)을 도킹하는 곳입니다. 아래쪽은 편집기 위쪽을 가볍게 유지하고 주요 작업을 편집 중인 내용 가까이에 둡니다.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': '위',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    '편집기 내용 위의 고전적인 배치입니다.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': '아래',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    '편집기 내용 아래, 상태 표시줄 위에 도킹됩니다.',
  'workbench.settings.def.appearance.clockFormat.label': '시계 형식',
  'workbench.settings.def.appearance.clockFormat.description':
    '앱 전체 (알림, 로그)에서 타임스탬프를 표시하는 방식입니다. 브라우저 로캘은 시스템 지역 형식이 아니라 브라우저 언어를 따르므로 명시적으로 둡니다.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24시간',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12시간',
  'workbench.settings.def.appearance.accentColor.label': '강조 색',
  'workbench.settings.def.appearance.accentColor.description':
    '버튼, 링크, 활성 강조에 쓰는 주요 색입니다. 기본 테마 변형에만 적용됩니다. 고대비와 색조 변형은 자체 강조 색을 고정합니다.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': '버전 표시',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    '워크스페이스 상태 표시줄에 확장 프로그램 버전 번호를 표시합니다.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': '테마 전환기 표시',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    '워크스페이스 상태 표시줄에 라이트/다크/자동 테마 드롭다운을 표시합니다.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': '패널 토글 표시',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    '워크스페이스 상단 표시줄에 왼쪽 / 하단 / 오른쪽 패널 토글 아이콘을 표시합니다.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': '레이아웃 메뉴 표시',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    '워크스페이스 상단 표시줄에 레이아웃 드롭다운 (하단 전체 너비, 도구 창 이름, 사이드바 레이아웃)을 표시합니다.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': '하단 패널 정렬',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    '셸에서 하단 패널이 놓이는 곳입니다. 왼쪽/오른쪽은 사이드바 하나 + 편집기 아래에 맞추고, 가운데는 중간 열 안에 중첩하며, 양쪽 맞춤은 뷰포트 전체에 걸칩니다.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': '가운데',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    '중간 열 안에 중첩된 하단 패널',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': '왼쪽',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    '하단이 왼쪽 사이드바 + 편집기에 걸침',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': '오른쪽',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    '하단이 편집기 + 오른쪽 사이드바에 걸침',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': '양쪽 맞춤',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    '하단이 뷰포트 전체 너비에 걸침',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': '하단 패널 분할',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    '열린 두 하단 도크가 하단 패널을 나누는 방식입니다. 나란히, 또는 위아래로.',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': '좌우 배치',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description': '하단 도크가 나란히 놓임',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': '상하 배치',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description': '하단 도크가 위아래로 쌓임',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': '도구 창 이름 표시',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    '활동 표시줄과 도크 탭 아이콘 옆에 텍스트 레이블을 표시합니다. 아이콘만 있는 간결한 셸을 원하면 끄세요.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': '왼쪽 활동 표시줄 너비',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    '도구 창 이름이 보일 때 왼쪽 활동 표시줄의 너비입니다. 아이콘 전용 모드에서는 36px로 고정됩니다.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': '오른쪽 활동 표시줄 너비',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    '도구 창 이름이 보일 때 오른쪽 활동 표시줄의 너비입니다. 아이콘 전용 모드에서는 36px로 고정됩니다.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': '활동 표시줄 레이아웃',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    '활동 표시줄이 위쪽과 아래쪽 도구 창 그룹을 나누는 방식입니다.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': '비례',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    '위쪽과 아래쪽 그룹이 활동 표시줄을 50/50으로 나눔',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': '간결',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    '위쪽 그룹은 내용에 맞추고 아래쪽은 하단에 고정',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': '쌓기',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    '모든 그룹을 위쪽에 모으고 사이에 구분선을 둠',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': '동적',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    '칩 그룹이 인접한 패널 높이를 따릅니다. 닫힌 도크는 내용 크기로 접히고 살아 있는 이웃이 그 공간을 흡수합니다.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': '디버그 모드',
  'workbench.settings.def.inspection.cdpEnabled.description':
    '브라우저 내장 개발자 도구와 같은 깊이로 요청을 검사하고 수정합니다. 페이지 수준 fetch 호출만이 아니라 페이지 로드, 워커, iframe까지입니다. 켜져 있는 동안 브라우저는 연결된 각 탭에 디버깅 배너를 표시합니다. 기본값은 꺼짐이며 언제든 켤 수 있습니다.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    '디버그 모드는 Chrome 및 Edge 브라우저에서 사용할 수 있습니다.',
  'workbench.settings.def.inspection.cdpScope.label': '연결할 탭',
  'workbench.settings.def.inspection.cdpScope.description':
    '디버그 모드가 켜져 있는 동안 연결하는 탭입니다. “DevTools 창이 열린 곳”은 개발자 도구가 열린 브라우저 탭에 연결합니다. “포커스된 탭”은 개발자 도구를 열 필요 없이 활성 브라우저 탭을 따릅니다. 새 탭이나 내부 페이지로 전환하면 이전 탭을 연결된 채로 두어 뒤흔들지 않습니다. “둘 다”는 둘을 합칩니다. 이 선택과 무관하게 개별 브라우저 탭을 푸터에서 고정할 수도 있습니다.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    '디버그 모드는 Chrome 및 Edge 브라우저에서 사용할 수 있습니다.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'DevTools 창이 열린 곳',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description': '개발자 도구가 열린 브라우저 탭입니다.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': '포커스된 탭',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    '포커스를 따르는 활성 브라우저 탭입니다. 개발자 도구가 필요 없습니다.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': '둘 다',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'DevTools 탭과 포커스된 탭입니다.',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': '디버그 모드로 캡처 시작',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    '새 캡처가 완전한 정확도 (응답 본문과 정확한 헤더)를 위해 브라우저 디버거를 연결합니다. 브라우저는 탭에 디버깅 배너를 표시합니다. 시작 동작마다 고급에서 이를 재정의할 수 있습니다.',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': '캡처를 아카이브에 저장',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    '새 캡처를 이 컴퓨터의 암호화된 세션 아카이브에 기록합니다. 시작 동작마다 고급에서 이를 재정의할 수 있습니다.',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label': '가리기 해제 세션 읽기 허용',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    '연결된 에이전트가 아카이브된 세션을 가리기 표식 대신 실제 값으로 읽습니다. 인증 헤더, 쿠키, token 형태의 값이 포함됩니다. 기본값은 꺼짐이며, 켜져 있는 동안 가리기 해제 읽기는 모두 활동 피드에 기록됩니다.',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': '아카이브 크기 예산 (GiB)',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    '아카이브된 세션의 총 디스크 공간입니다. 아카이브가 예산을 넘으면 가장 오래된 봉인 세션부터 제거됩니다. 아직 기록 중인 세션은 절대 제거되지 않습니다.',
  'workbench.settings.def.trafficMonitor.railSide.label': '소스 위치',
  'workbench.settings.def.trafficMonitor.railSide.description':
    '트래픽 패널에서 소스 목록이 놓이는 쪽입니다. 패널 헤더의 레이아웃 버튼으로도 전환합니다.',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': '왼쪽',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description':
    '소스 목록은 왼쪽, 트래픽 보기는 오른쪽입니다.',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': '오른쪽',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description':
    '소스 목록은 오른쪽, 트래픽 보기는 왼쪽입니다.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': '글꼴 크기',
  'workbench.settings.def.editor.fontSize.description': '편집기 화면의 글꼴 크기 (픽셀)입니다.',
  'workbench.settings.def.editor.fontFamilyPreset.label': '글꼴 모음',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    '편집기용으로 엄선한 모노스페이스 스택입니다. 모든 옵션은 확장 프로그램에 내장되어 있어 시스템 설치가 필요 없습니다. 기본값은 플랫폼 간 일관성을 위해 Windows / Linux에서는 JetBrains Mono 글꼴, macOS에서는 SF Mono 글꼴의 기본 렌더링을 유지하기 위해 System Mono입니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    '운영 체제 기본 모노스페이스입니다. macOS에서는 SF Mono, Windows에서는 Consolas, Linux에서는 Liberation Mono 글꼴입니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    '프로그래밍 리거처가 있는 모노스페이스입니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    '편집기에 맞춘 리거처 있는 모노스페이스입니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    '프로그래밍 리거처가 있는 모노스페이스입니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    '코드에 맞춘 Adobe 모노스페이스입니다. 내장되어 항상 사용할 수 있습니다.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    '앱과 함께 제공하는 픽셀 스타일 디스플레이 글꼴입니다. 내장되어 항상 사용할 수 있습니다. 재미로 고르는 선택지입니다. 읽을 수는 있지만 높고 넓습니다.',
  'workbench.settings.def.editor.fontLigatures.label': '글꼴 리거처',
  'workbench.settings.def.editor.fontLigatures.description':
    '프로그래밍 리거처를 활성화합니다. `=>`나 `!=` 같은 문자열을 하나의 글리프로 합칩니다. 리거처를 지원하는 글꼴 (예: Fira Code, JetBrains Mono)이 필요합니다.',
  'workbench.settings.def.editor.lineHeight.label': '줄 높이',
  'workbench.settings.def.editor.lineHeight.description':
    '편집기 줄 높이 (픽셀)입니다. 0이면 편집기가 글꼴 크기에 비례하는 줄 높이를 고르고, 8 이상의 값은 명시적 픽셀로 해석됩니다.',
  'workbench.settings.def.editor.tabSize.label': '탭 크기',
  'workbench.settings.def.editor.tabSize.description': '탭 문자가 차지하는 열 수입니다.',
  'workbench.settings.def.editor.insertSpaces.label': '공백 삽입',
  'workbench.settings.def.editor.insertSpaces.description': 'Tab 키를 누를 때 탭 문자 대신 공백을 삽입합니다.',
  'workbench.settings.def.editor.wordWrap.label': '자동 줄 바꿈',
  'workbench.settings.def.editor.wordWrap.description': '편집기에서 긴 줄을 다음 줄로 넘길지 여부입니다.',
  'workbench.settings.def.editor.wordWrap.option.off.label': '끔',
  'workbench.settings.def.editor.wordWrap.option.on.label': '뷰포트 너비',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': '지정 열',
  'workbench.settings.def.editor.wordWrapColumn.label': '자동 줄 바꿈 열',
  'workbench.settings.def.editor.wordWrapColumn.description':
    '자동 줄 바꿈이 지정 열로 설정되었을 때 줄을 바꾸는 열입니다.',
  'workbench.settings.def.editor.lineNumbers.label': '줄 번호',
  'workbench.settings.def.editor.lineNumbers.description': '왼쪽 여백에 줄 번호를 표시합니다.',
  'workbench.settings.def.editor.renderWhitespace.label': '공백 문자 표시',
  'workbench.settings.def.editor.renderWhitespace.description': '공백 문자를 눈에 보이게 표시합니다.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': '없음',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': '경계만',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': '모두',
  'workbench.settings.def.editor.renderLineEnds.label': '줄 끝 표시',
  'workbench.settings.def.editor.renderLineEnds.description':
    '실제 줄마다 마지막 문자 뒤에 희미한 ¬ 표시를 그려, 자동으로 넘어간 행 (빈 여백 번호, 들여쓴 시작, 표시 없음)을 줄 바꿈으로 착각하지 않게 합니다. 표시 전용입니다. 이 표시는 선택, 복사, 전송되지 않습니다.',
  'workbench.settings.def.editor.formatOnSave.label': '저장 시 정리',
  'workbench.settings.def.editor.formatOnSave.description':
    '규칙이나 템플릿을 저장할 때 편집기 내용을 자동으로 정리합니다.',
  'workbench.settings.def.editor.bracketPairColorization.label': '괄호 쌍 색 구분',
  'workbench.settings.def.editor.bracketPairColorization.description': '짝이 맞는 괄호를 서로 다른 색으로 강조합니다.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.trustedRoots.label': '워크스페이스 인증서',
  'workbench.settings.def.requests.trustedRoots.description':
    '내장 루트에 더해 이 워크스페이스가 신뢰하는 인증 기관으로, 앱 런타임이 다이얼하는 모든 TLS 연결에 적용됩니다. 워크스페이스의 모든 피어와 공유됩니다. 공개 자료이며 시크릿이 아닙니다.',
  'workbench.settings.def.requests.deviceTrust.label': '기기 인증서',
  'workbench.settings.def.requests.deviceTrust.description':
    '워크스페이스 목록 옆에 이 컴퓨터가 고정하는 인증서입니다. 자체 서명한 localhost, 스테이징 서버 등. 동기화되거나 내보내지지 않으며, 이 기기에서 앱 런타임이 다이얼하는 모든 TLS 연결에 적용됩니다.',
  'workbench.settings.def.requests.systemTrust.label': '시스템 신뢰 저장소',
  'workbench.settings.def.requests.systemTrust.description':
    '이 컴퓨터의 운영 체제 저장소가 가진 인증서도 신뢰합니다. IT 프로필이 회사 프록시용으로 설치한 루트 등. 내장 루트, 워크스페이스 목록, 기기 고정 항목 옆에 추가되며, 동기화되거나 내보내지지 않습니다.',
  'workbench.settings.def.requests.responseBodyCapMB.label': '응답 본문 제한 (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    '실행기가 표시용으로 유지하는 응답 본문의 양입니다. 더 큰 본문은 이 제한에서 잘리지만 전체 크기는 계속 측정되고 보고됩니다. 제한을 높이면 열린 요청 탭당 메모리 사용이 늘어납니다.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': '최신순',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Server-Sent Events 목록의 순서입니다. 최신 이벤트가 위에 옵니다. 오래된 것부터 읽으려면 끄세요. 목록 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': '이벤트 이름별 그룹화',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Server-Sent Events 목록을 접을 수 있는 이벤트 이름 헤더 아래로 묶고, 각 그룹 안에서는 도착 순서를 유지합니다. 목록 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': '그룹당 행 수',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    '이벤트 이름별로 그룹화할 때 각 그룹의 최신 이벤트를 이 개수만 표시합니다. 새 이벤트가 도착하면 창이 밀리므로 여러 그룹을 한 번에 지켜볼 수 있습니다. 0이면 모든 이벤트를 표시합니다. 목록 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': '최신순',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'gRPC 메시지 타임라인의 순서입니다. 최신 메시지가 위에 옵니다. 오래된 것부터 읽으려면 끄세요. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.label': '기본값 포함',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.description':
    'gRPC 응답이 전송선에서 생략한 필드를 proto3 JSON 방식이 기본값을 내보내듯 기본값 (0, 빈 문자열, false, 첫 enum 값, 빈 목록과 맵)으로 표시합니다. 기본값은 꺼짐입니다. 응답에는 서버가 실제로 보낸 필드만 표시됩니다. 존재 여부를 담는 필드 (메시지, optional, oneof 멤버)는 어느 쪽이든 나타나지 않습니다. 응답 창의 ⋯ 메뉴가 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': '메시지 유형 표시',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    '타임라인의 모든 행에 선언된 protobuf 메시지 유형을 태그로 붙입니다. 기본값은 꺼짐입니다. rpc 메서드의 유형은 방향마다 고정되므로 방향 배지만으로 행을 구분할 수 있습니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': '메시지 유형별 그룹화',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'gRPC 메시지 타임라인을 접을 수 있는 메시지 유형 헤더 아래로 묶고, 각 그룹 안에서는 도착 순서를 유지합니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': '방향별 그룹화',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    'gRPC 메시지 타임라인을 접을 수 있는 보냄 / 받음 헤더 아래로 묶습니다. 메시지 유형별 그룹화와 함께 쓰면 (유형, 방향) 쌍마다 그룹이 생깁니다. 요청과 응답이 메시지 유형 하나를 공유하는 양방향 호출에 유용합니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': '그룹당 행 수',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    '메시지 유형별로 그룹화할 때 각 그룹의 최신 메시지를 이 개수만 표시합니다. 새 메시지가 도착하면 창이 밀리므로 여러 그룹을 한 번에 지켜볼 수 있습니다. 0이면 모든 메시지를 표시합니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.label': '최신순',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.description':
    'MQTT 메시지 타임라인의 순서입니다. 최신 메시지가 위에 옵니다. 오래된 것부터 읽으려면 끄세요. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': '최신순',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'WebSocket 메시지 타임라인의 순서입니다. 최신 메시지가 위에 옵니다. 오래된 것부터 읽으려면 끄세요. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': '방향별 그룹화',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    'WebSocket 메시지 타임라인을 접을 수 있는 보냄 / 받음 헤더 아래로 묶고, 각 그룹 안에서는 도착 순서를 유지합니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': '이벤트별 그룹화',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    'Socket.IO 세션 타임라인을 접을 수 있는 디코딩된 이벤트 이름 헤더 아래로 묶습니다 (제어 프레임은 전송선 종류별로 묶임). 방향별 그룹화와 함께 쓰면 (이벤트, 방향) 쌍마다 그룹이 생깁니다. Socket.IO 세션에만 적용됩니다. 원시 WebSocket 프레임에는 이벤트 이름이 없습니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.label': '하트비트 숨기기',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.description':
    'Socket.IO 세션 타임라인에서 engine.io ping / pong 킵얼라이브 행을 숨깁니다. 프레임은 계속 캡처되고 내보내지며 표시만 걸러집니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesHideHandshake.label': '핸드셰이크 프레임 숨기기',
  'workbench.settings.def.requests.wsMessagesHideHandshake.description':
    '세션 타임라인에서 Socket.IO 핸드셰이크 프레임 행 (engine.io open / close, 이름 공간 connect와 그 확인 응답)을 숨깁니다. 연결 해제와 connect 오류는 항상 표시됩니다. 프레임은 계속 캡처되고 내보내집니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': '그룹당 행 수',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    '방향별로 그룹화할 때 각 그룹의 최신 메시지를 이 개수만 표시합니다. 새 메시지가 도착하면 창이 밀리므로 두 그룹을 한 번에 지켜볼 수 있습니다. 0이면 모든 메시지를 표시합니다. 타임라인 도구 모음이 이 설정을 바꿉니다.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': '잘못된 메시지 보내기',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'gRPC 메시지가 유효한 JSON 형식이 아닐 때도 빈 메시지로 호출하고 서버가 응답하게 합니다 (보통 INVALID_ARGUMENT). 기본값은 꺼짐입니다. 호출이 전송선에 닿기 전에 정확한 파싱 오류와 함께 실패합니다.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': '규칙 실행 일시 중지',
  'workbench.settings.def.rulesEngine.paused.description':
    '라이브 네트워크 요청에 규칙 적용을 멈춥니다. 규칙은 계속 편집할 수 있습니다.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': '평가 전략',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    '여러 규칙이 같은 요청과 일치할 때 엔진이 규칙을 고르는 방식입니다.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': '첫 일치',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    '우선순위 순서에서 첫 규칙 사용',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': '가장 가까운 일치',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    '가장 구체적인 일치 규칙 선호',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': '모든 일치',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    '일치하는 모든 규칙을 순서대로 적용',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': '업데이트 디바운스',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    '규칙 편집이 declarativeNetRequest 기능에 반영되기 전의 지연 (ms)입니다.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': '최대 활성 규칙 수',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    '동적 규칙 집합에 한 번에 컴파일되는 규칙의 최대 수입니다.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': '표시할 리소스 유형',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    '팝업의 “이 페이지” 보기에 나타나는 요청 리소스 유형입니다. 모든 것이 항상 수집되며 UI에 보이는 것만 바뀝니다. 팝업의 인라인 칩 행이 같은 설정에 씁니다.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': '가려짐 경고 표시',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    '효과가 더 높은 우선순위의 규칙에 가려지는 규칙 (차단, 리디렉션, Mock, 지연 또는 헤더 중첩 충돌)을 강조합니다.',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': '큰 규칙 집합 경고',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    '활성 규칙 수가 브라우저 상한에 가까워지면 경고를 표시합니다.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': '큰 규칙 집합 기준',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description': '경고가 나타나는 활성 규칙 수입니다.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': '라이브 규칙 모드',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    '규칙 중 하나와 일치하는 모든 요청에 Cache-Control: no-cache 헤더를 삽입하여 서버와의 재검증을 강제하므로 규칙 효과가 항상 새로 적용됩니다. 오래된 캐시 응답이 규칙을 가리는 것을 막습니다. 규칙 값 (예: 인증 token 값)이 바뀌었는데 페이지가 캐시의 이전 응답을 계속 제공할 때 유용합니다.',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'HTTP 캐시 우회',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    '검사 중인 탭의 모든 요청에 Cache-Control: no-cache 헤더를 추가하여 서버와의 재검증을 강제합니다. 범위는 HTTP 캐시만입니다. Chrome 브라우저 자체의 캐시 사용 안 함 (Network 탭)은 렌더러 메모리 캐시도 우회합니다. 규칙과 일치하는 요청은 라이브 규칙 모드가 항상 자동으로 새로 유지합니다.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': '변수 자동 완성',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    '입력하는 동안 `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` 참조를 제안합니다. 모든 규칙 필드 값 입력란과 JSON/GraphQL/XML/일반 텍스트 본문 편집기에서 `{{`를 입력하면 열립니다. 일반 텍스트 편집을 선호하면 끄세요.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': '초안 URL 전략',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'DevTools 인스펙터에서 미리 채운 규칙이 캡처한 URL 주소를 url-filter 패턴으로 바꾸는 방식입니다. 정확한 URL (기본값)은 URL 주소를 그대로 유지하여 검사한 요청만 일치시킵니다. 경로 와일드카드는 마지막 경로 구간을 * 로 바꿔 형제 리소스도 일치시킵니다. 호스트만은 도메인 전체로 넓힙니다.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': '정확한 URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    '정규화한 이 URL 주소와 정확히 일치 (권장)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': '경로 와일드카드',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    '마지막 경로 구간을 와일드카드로',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': '호스트만',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description': '호스트의 모든 요청과 일치',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': '원시 URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description': '정규화 없이 이 URL 주소와 정확히 일치',

  // ── Diff Viewer category defs ──────────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label': '행에 병합 전략 표시',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    '켜면 가져오기 미리보기의 왼쪽 사이드바에서 각 항목 행이 선택한 병합 전략 (새로 추가, 바꾸기, 건너뛰기 등)을 줄 수 옆에 인라인으로 표시합니다. 좁은 창에서 행 너비를 확보하려면 끄세요.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': '레이아웃',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    '대상과 수신 내용을 나란히 또는 인라인으로 쌓아 렌더링합니다. 차이 창이 너무 좁으면 자동으로 통합으로 바뀝니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': '병렬',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': '통합',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label': '공백 처리',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    '차이가 공백만 바뀐 변경을 편집으로 취급할지 숨길지입니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': '무시하지 않음',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': '공백 무시',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label': '변경 없는 영역 접기',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    '변경 없는 줄의 연속을 숨기고 클릭하여 펼치는 표시로 대체합니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label': '공백 문자 표시',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    '차이에서 공백과 탭을 보이는 글리프 (·, →)로 표시합니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label': '줄 번호 표시',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    '차이의 양쪽 옆에 여백 줄 번호 열을 표시합니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label': '들여쓰기 안내선 표시',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'YAML 중첩을 훑어보기 쉽도록 세로 들여쓰기 안내선을 표시합니다.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label': '긴 줄 자동 줄 바꿈',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    '가로 스크롤 대신 긴 줄을 다음 표시 줄로 넘깁니다.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': '로그 수준',
  'workbench.settings.def.data.logLevel.description':
    '확장 프로그램 로거의 상세도입니다. 높은 수준은 그 위의 모든 수준을 포함합니다.',
  'workbench.settings.def.data.logLevel.option.error.label': '오류',
  'workbench.settings.def.data.logLevel.option.error.description': '실패만',
  'workbench.settings.def.data.logLevel.option.warn.label': '경고',
  'workbench.settings.def.data.logLevel.option.warn.description': '이상 징후와 재시도',
  'workbench.settings.def.data.logLevel.option.info.label': '정보',
  'workbench.settings.def.data.logLevel.option.info.description': '운영 이벤트',
  'workbench.settings.def.data.logLevel.option.debug.label': '디버그',
  'workbench.settings.def.data.logLevel.option.debug.description': '상세한 내부 정보',
  'workbench.settings.def.data.exportSettings.label': '설정 내보내기',
  'workbench.settings.def.data.exportSettings.description': '모든 설정을 JSON 파일로 다운로드합니다.',
  'workbench.settings.def.data.exportSettings.action.label': '내보내기',
  'workbench.settings.def.data.importSettings.label': '설정 가져오기',
  'workbench.settings.def.data.importSettings.description': '이전에 내보낸 JSON 파일에서 설정을 불러옵니다.',
  'workbench.settings.def.data.importSettings.action.label': '가져오기…',
  'workbench.settings.def.data.exportObservabilityLog.label': '진단 로그 내보내기',
  'workbench.settings.def.data.exportObservabilityLog.description':
    '최근 500개의 구조화된 이벤트 (규칙 재빌드, 요청 오류, 워크스페이스 전환)를 JSON 형식으로 다운로드합니다. 로컬 전용입니다. 파일을 버그 보고서에 직접 첨부하지 않는 한 아무것도 기기를 떠나지 않습니다.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': '로그 내보내기',
  'workbench.settings.def.data.clearObservabilityLog.label': '진단 로그 지우기',
  'workbench.settings.def.data.clearObservabilityLog.description':
    '버퍼된 모든 이벤트를 버립니다. 규칙, 요청, 워크스페이스 데이터에는 영향이 없습니다.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': '지우기',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    '진단 로그를 지우시겠습니까? 버퍼된 모든 이벤트가 버려집니다.',
  'workbench.settings.def.data.exportImportReports.label': '가져오기 보고서 내보내기',
  'workbench.settings.def.data.exportImportReports.description':
    '모든 가져오기 실행 (지금은 curl, 다음은 HAR / Postman / Insomnia)의 구조화된 누락/변환 보고서를 JSON 형식으로 다운로드합니다. 워크스페이스별로 저장되며 워크스페이스당 최근 50개입니다. 파일을 첨부하지 않는 한 기기를 떠나지 않습니다.',
  'workbench.settings.def.data.exportImportReports.action.label': '보고서 내보내기',
  'workbench.settings.def.data.clearImportReports.label': '가져오기 보고서 지우기',
  'workbench.settings.def.data.clearImportReports.description':
    '활성 워크스페이스의 모든 가져오기 보고서를 버립니다. 요청 자체에는 영향이 없습니다. 가져오기 중 무엇이 누락/변환되었는지의 감사 로그만입니다.',
  'workbench.settings.def.data.clearImportReports.action.label': '지우기',
  'workbench.settings.def.data.clearImportReports.confirm':
    '이 워크스페이스의 가져오기 보고서를 지우시겠습니까? 되돌릴 수 없습니다.',
  'workbench.settings.def.data.uploadFile.label': '파일 업로드',
  'workbench.settings.def.data.uploadFile.description':
    'multipart 본문과 `{{file.X}}` 참조에 쓸 파일을 활성 워크스페이스에 추가합니다. 파일은 내용 주소 방식 (sha256)이므로 같은 바이트를 다시 업로드해도 blob 하나로 유지됩니다. 저장소는 로컬 IndexedDB 저장소이며 아무것도 기기를 떠나지 않습니다.',
  'workbench.settings.def.data.uploadFile.action.label': '업로드…',
  'workbench.settings.def.data.exportFilesManifest.label': '파일 매니페스트 내보내기',
  'workbench.settings.def.data.exportFilesManifest.description':
    '활성 워크스페이스의 파일 목록 (파일 이름, 해시, 크기, MIME 유형)을 JSON 형식으로 다운로드합니다. 바이트는 포함되지 않습니다. 감사와 팀원의 재업로드를 위한 매니페스트이지 내용의 백업이 아닙니다.',
  'workbench.settings.def.data.exportFilesManifest.action.label': '매니페스트 내보내기',
  'workbench.settings.def.data.filesBrowser.label': '파일',
  'workbench.settings.def.data.filesBrowser.description':
    '활성 워크스페이스에 업로드된 모든 blob입니다. 바이트를 다운로드하거나, 짧은 해시를 복사하거나, 삭제합니다. 파일 메타데이터 (파일 이름, 크기, MIME 유형, 해시)는 설정 색인 전체에서 검색할 수 있습니다.',
  'workbench.settings.def.data.clearAllFiles.label': '모든 파일 지우기',
  'workbench.settings.def.data.clearAllFiles.description':
    '활성 워크스페이스의 모든 파일 blob을 삭제합니다. multipart 파트로 이 파일을 참조하는 요청은 실행 시 오류가 납니다. 파일을 다시 업로드하거나 해당 요청을 편집해야 합니다.',
  'workbench.settings.def.data.clearAllFiles.action.label': '모두 지우기',
  'workbench.settings.def.data.clearAllFiles.confirm':
    '이 워크스페이스의 모든 파일을 삭제하시겠습니까? 이를 참조하는 Multipart 파트는 보낼 때 오류가 납니다.',
  'workbench.settings.def.data.resetAllSettings.label': '모든 설정 재설정',
  'workbench.settings.def.data.resetAllSettings.description': '모든 범주의 모든 설정을 기본값으로 되돌립니다.',
  'workbench.settings.def.data.resetAllSettings.action.label': '기본값으로 재설정',
  'workbench.settings.def.data.resetAllSettings.confirm':
    '모든 설정을 기본값으로 재설정하시겠습니까? 되돌릴 수 없습니다.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': '소프트웨어 업데이트',
  'workbench.settings.def.updates.state.description':
    '현재 업데이트 상태입니다. 다운로드와 설치는 항상 사용자의 명시적인 클릭으로 이루어집니다.',
  'workbench.settings.def.updates.check.label': '업데이트 확인',
  'workbench.settings.def.updates.check.description':
    '하루에 한 번 새 버전을 찾고, 있으면 알림 점을 표시합니다. 이 확인은 아무것도 다운로드하지 않고 사용자나 이 설치에 대해 아무것도 보내지 않습니다. 공개 버전 목록을 읽어 로컬에서 비교합니다. “보안 수정만”은 실행 중인 버전에 영향을 주는 보안 문제를 릴리스가 수정하지 않는 한 조용히 있습니다. 업데이트는 사용자의 명시적인 동작 없이 설치되지 않습니다.',
  'workbench.settings.def.updates.check.option.all.label': '모든 릴리스',
  'workbench.settings.def.updates.check.option.security-only.label': '보안 수정만',
  'workbench.settings.def.updates.check.option.off.label': '끔',
  'workbench.settings.def.updates.channel.label': '업데이트 채널',
  'workbench.settings.def.updates.channel.description':
    '업데이트 확인이 따르는 릴리스 계열입니다. 베타는 새 기능을 더 일찍 받지만 덜 다듬어졌을 수 있습니다. 안정으로 되돌려도 다운그레이드되지 않습니다. 다음 안정 릴리스가 앞지를 때까지 설치된 버전을 유지합니다. 보안 알림은 어느 채널에서든 항상 안정 계열을 따릅니다.',
  'workbench.settings.def.updates.channel.option.stable.label': '안정',
  'workbench.settings.def.updates.channel.option.beta.label': '베타',
  'workbench.settings.def.updates.showWhatsNew.label': '업데이트 후 새로운 기능 표시',
  'workbench.settings.def.updates.showWhatsNew.description':
    '기능 릴리스 후 워크벤치를 처음 열 때 릴리스 하이라이트 탭을 엽니다. 패치 릴리스는 열지 않고 알림 타임라인에만 남습니다. 노트는 앱 안에 담겨 있으며 아무것도 가져오지 않습니다.',
  'workbench.settings.def.updates.autoDownload.label': '업데이트 자동 다운로드',
  'workbench.settings.def.updates.autoDownload.description':
    '업데이트가 발견되면 바로 백그라운드에서 받아, 설치가 “업데이트 후 다시 시작” 한 번으로 끝나고 앱을 종료했다가 다시 열기만 해도 새 버전이 시작되게 합니다. 끄면 직접 “업데이트 후 다시 시작”을 고르기 전까지 아무것도 다운로드하지 않습니다. 어느 쪽이든 앱은 스스로 다시 시작하지 않습니다.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': '버전',
  'workbench.settings.def.about.version.description': '현재 설치된 확장 프로그램 버전입니다.',
  'workbench.settings.def.about.build.label': '빌드',
  'workbench.settings.def.about.build.description': '빌드 번호와 날짜입니다.',
  'workbench.settings.def.about.commit.label': '커밋',
  'workbench.settings.def.about.commit.description': '이 빌드를 만든 Git 커밋입니다.',
  'workbench.settings.def.about.protocol.label': '프로토콜',
  'workbench.settings.def.about.protocol.description':
    '이 확장 프로그램이 데스크톱 앱과 통신하는 전송선 프로토콜 버전입니다. 버전이 다른 피어는 명확한 업데이트 안내와 함께 거부됩니다.',
  'workbench.settings.def.about.browser.label': '브라우저',
  'workbench.settings.def.about.browser.description': '감지된 브라우저와 플랫폼입니다.',
  'workbench.settings.def.about.openSource.label': '내장 패키지',
  'workbench.settings.def.about.openSource.description':
    '이 빌드에 내장된 오픈 소스 소프트웨어와 각 패키지의 라이선스입니다.',
} as const satisfies Catalog;
