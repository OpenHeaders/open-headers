/**
 * Workbench settings — keyboard-category setting definitions — Korean.
 * Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts` key for
 * key. Chord notation and physical key names (ArrowDown, Enter, Space,
 * ⌘K, Alt+C, …) ride raw inside keyed values — localized key names
 * are a deferred Phase I workstream (ko ships raw too, S46). Action
 * labels reuse the shipped `popup.shortcuts.*` ko wording (S35 reuse
 * law): 디버그 모드 전환 / 테마 순환 / 간결 모드 / 펼치기 / 하위 행으로
 * 들어가기 etc.; popup tab names quote the shipped ko labels (“이
 * 페이지” / “모든 규칙” / “컬렉션”); the `Popup —` label prefix
 * restructures into 팝업: (the aside dash law). 활동 피드 = Activity
 * Feed (chrome mint); 투어 가이드 = tour guide (popup mint); 명령 팔레트
 * carried from workbench-chrome. MINTS: 치트 시트 = cheatsheet; 프리셋
 * = preset; 가져오기 허브 = the import hub (`workbench-import-export.ts`
 * must reuse); spacebar in prose = 스페이스 키. Brand tokens never
 * compounded: OpenHeaders 기본, VS Code 스타일.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': '디버그 모드 전환',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    '어느 화면에서든 디버그 모드를 켜거나 끕니다. 텍스트 필드에 포커스가 없을 때만 실행됩니다.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    '디버그 모드는 Chrome 및 Edge 브라우저에서 사용할 수 있습니다.',
  'workbench.settings.def.keyboard.commandPalette.label': '명령 팔레트 열기',
  'workbench.settings.def.keyboard.commandPalette.description': '명령 팔레트 오버레이를 표시합니다.',
  'workbench.settings.def.keyboard.openSettings.label': '설정 열기',
  'workbench.settings.def.keyboard.openSettings.description': '설정 모달을 엽니다.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': '왼쪽 사이드바 전환',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': '왼쪽 사이드바를 표시하거나 숨깁니다.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': '오른쪽 사이드바 전환',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': '오른쪽 사이드바를 표시하거나 숨깁니다.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': '하단 패널 전환',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': '하단 패널을 표시하거나 숨깁니다.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': '활동 피드 전환',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': '활동 피드 패널을 표시하거나 숨깁니다.',
  'workbench.settings.def.keyboard.newRule.label': '항목 만들기',
  'workbench.settings.def.keyboard.newRule.description': '규칙과 API 요청의 만들기 메뉴를 엽니다.',
  'workbench.settings.def.keyboard.newTab.label': '새 탭',
  'workbench.settings.def.keyboard.newTab.description': '새 API 요청 초안 탭을 엽니다.',
  'workbench.settings.def.keyboard.import.label': '가져오기',
  'workbench.settings.def.keyboard.import.description': 'curl, HAR, 워크스페이스 파일의 가져오기 허브를 엽니다.',
  'workbench.settings.def.keyboard.save.label': '저장',
  'workbench.settings.def.keyboard.save.description': '활성 편집기 탭을 저장합니다.',
  'workbench.settings.def.keyboard.closeTab.label': '탭 닫기',
  'workbench.settings.def.keyboard.closeTab.description': '포커스된 편집기 탭을 닫습니다.',
  'workbench.settings.def.keyboard.previousTab.label': '이전 탭',
  'workbench.settings.def.keyboard.previousTab.description': '이전 편집기 탭으로 포커스를 옮깁니다.',
  'workbench.settings.def.keyboard.nextTab.label': '다음 탭',
  'workbench.settings.def.keyboard.nextTab.description': '다음 편집기 탭으로 포커스를 옮깁니다.',
  'workbench.settings.def.keyboard.tabSearch.label': '탭 검색',
  'workbench.settings.def.keyboard.tabSearch.description': '열린 모든 탭을 검색하는 오버레이를 엽니다.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': '활성 섹션 필터로 포커스 이동',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    '현재 있는 사이드바 섹션의 필터 입력란으로 포커스를 옮깁니다.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': '왼쪽 사이드바로 포커스 이동',
  'workbench.settings.def.keyboard.focusLeftSidebar.description': '키보드 포커스를 왼쪽 사이드바로 옮깁니다.',
  'workbench.settings.def.keyboard.focusEditor.label': '편집기로 포커스 이동',
  'workbench.settings.def.keyboard.focusEditor.description': '키보드 포커스를 편집기 영역으로 옮깁니다.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': '오른쪽 사이드바로 포커스 이동',
  'workbench.settings.def.keyboard.focusRightSidebar.description': '키보드 포커스를 오른쪽 사이드바로 옮깁니다.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': '하단 패널로 포커스 이동',
  'workbench.settings.def.keyboard.focusBottomPanel.description': '키보드 포커스를 하단 패널 탭 행으로 옮깁니다.',
  'workbench.settings.def.keyboard.terminalNewTab.label': '새 터미널 탭',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    '터미널 패널에 포커스가 있을 때 새 터미널 탭을 시작합니다. 다른 곳에서는 이 조합이 평소의 새 탭 동작을 유지합니다. 데스크톱 앱 전용입니다.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': '단축키 도움말 표시',
  'workbench.settings.def.keyboard.showShortcutHelp.description': '키보드 단축키 치트 시트를 표시합니다.',
  'workbench.settings.def.keyboard.find.label': '편집기에서 찾기',
  'workbench.settings.def.keyboard.find.description':
    '포커스된 코드 편집기에서 찾기 위젯을 엽니다. 편집기에 포커스가 있을 때만 실행되며, 전역 단축키를 방해하지 않습니다.',
  'workbench.settings.def.keyboard.replace.label': '편집기에서 바꾸기',
  'workbench.settings.def.keyboard.replace.description':
    '포커스된 코드 편집기에서 찾기 및 바꾸기 위젯을 엽니다. 편집기에 포커스가 있을 때만 실행되며, 전역 단축키를 방해하지 않습니다.',
  'workbench.settings.def.keyboard.formatCode.label': '코드 정리',
  'workbench.settings.def.keyboard.formatCode.description':
    '포커스된 코드 편집기의 버퍼를 정리합니다. 편집기에 포커스가 있을 때만 실행되며, 전역 단축키를 방해하지 않습니다.',
  'workbench.settings.def.keyboard.preset.label': '프리셋',
  'workbench.settings.def.keyboard.preset.description':
    '단축키의 기본 집합입니다. 사용자 지정한 단축키는 프리셋 위에 유지되며 프리셋을 바꿔도 남습니다.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'OpenHeaders 기본',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'VS Code 스타일',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': '팝업: 단축키 도움말 전환',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    '팝업의 키보드 단축키 치트 시트를 표시하거나 숨깁니다.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': '팝업: 옵션 메뉴 전환',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description': '푸터 옵션 드롭다운을 열거나 닫습니다.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': '팝업: 검색으로 포커스 이동',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    '활성 탭의 검색 입력란으로 키보드 포커스를 옮깁니다.',
  'workbench.settings.def.keyboard.popup.prevPage.label': '팝업: 이전 페이지',
  'workbench.settings.def.keyboard.popup.prevPage.description': '활성 탭에서 규칙의 이전 페이지로 이동합니다.',
  'workbench.settings.def.keyboard.popup.nextPage.label': '팝업: 다음 페이지',
  'workbench.settings.def.keyboard.popup.nextPage.description': '활성 탭에서 규칙의 다음 페이지로 이동합니다.',
  'workbench.settings.def.keyboard.popup.moveDown.label': '팝업: 아래로 이동',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    '포커스된 행을 다음으로 옮깁니다. ArrowDown 키는 항상 별칭으로 쓸 수 있습니다.',
  'workbench.settings.def.keyboard.popup.moveUp.label': '팝업: 위로 이동',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    '포커스를 이전 행으로 옮깁니다. ArrowUp 키는 항상 별칭으로 쓸 수 있습니다.',
  'workbench.settings.def.keyboard.popup.expandRow.label': '팝업: 펼치기 / 하위 행으로 들어가기',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    '포커스된 행을 펼칩니다. ArrowRight 및 Enter 키는 항상 별칭으로 쓸 수 있습니다.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': '팝업: 접기 / 하위 행에서 나오기',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    '포커스된 행을 접습니다. ArrowLeft 키는 항상 별칭으로 쓸 수 있습니다.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': '팝업: 행 전환',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    '포커스된 규칙을 켜거나 끕니다. 기본값은 스페이스 키입니다.',
  'workbench.settings.def.keyboard.popup.editRow.label': '팝업: 행 편집',
  'workbench.settings.def.keyboard.popup.editRow.description': '포커스된 규칙을 워크스페이스 편집기에서 엽니다.',
  'workbench.settings.def.keyboard.popup.copyValue.label': '팝업: 값 복사',
  'workbench.settings.def.keyboard.popup.copyValue.description': '포커스된 행의 주요 값을 클립보드에 복사합니다.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': '팝업: 행 삭제',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    '포커스된 행을 삭제 대기 상태로 만듭니다. 다시 누르면 (또는 Enter 키) 확정됩니다.',
  'workbench.settings.def.keyboard.popup.addRule.label': '팝업: 규칙 추가',
  'workbench.settings.def.keyboard.popup.addRule.description': '팝업에서 새 규칙을 만듭니다.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': '팝업: 규칙 일시 중지 전환 (전역)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    '모든 컬렉션의 모든 규칙을 일시 중지하거나 재개합니다.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label': '팝업: 일시 중지 전환 (포커스된 컬렉션/폴더)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    '컬렉션 탭에서 포커스된 컬렉션이나 폴더를 일시 중지하거나 재개합니다. 개별 규칙 행에는 효과가 없습니다. 규칙은 대신 활성 토글 (Space 키)을 씁니다.',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': '팝업: 테마 순환',
  'workbench.settings.def.keyboard.popup.cycleTheme.description': '라이트, 다크, 자동 테마를 차례로 바꿉니다.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': '팝업: 간결 모드 전환',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    '팝업을 간결 밀도와 편안한 밀도 사이에서 전환합니다.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': '팝업: 워크스페이스 열기',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': '전체 워크스페이스 탭을 엽니다.',
  'workbench.settings.def.keyboard.popup.openSettings.label': '팝업: 설정 열기',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    '설정 페이지를 새 워크스페이스 탭에서 엽니다. 워크스페이스 바인딩과 같습니다.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': '팝업: 이 페이지 탭',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': '“이 페이지” 규칙 탭을 활성화합니다.',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': '팝업: 모든 규칙 탭',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': '“모든 규칙” 탭을 활성화합니다.',
  'workbench.settings.def.keyboard.popup.tabCollections.label': '팝업: 컬렉션 탭',
  'workbench.settings.def.keyboard.popup.tabCollections.description': '“컬렉션” 탭을 활성화합니다.',
  'workbench.settings.def.keyboard.popup.toggleSurface.label': '팝업: 화면 전환 (팝업 ↔ 사이드 패널)',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    '팝업 헤더에서 팝업과 사이드 패널 레이아웃을 전환합니다.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': '팝업: 투어 가이드 열기',
  'workbench.settings.def.keyboard.popup.openTourGuide.description': '어느 팝업 탭에서든 환영 투어를 다시 재생합니다.',
} as const satisfies Catalog;
