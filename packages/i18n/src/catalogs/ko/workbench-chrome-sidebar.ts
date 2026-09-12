/**
 * Workbench chrome — the navigator plane — Korean. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Entity names,
 * collection names, and counts ride raw inside keyed values; `VAULT` /
 * `Vault` / `delete-wins` / `cURL` / `fetch` / the Live prefix ride
 * raw. Hangul has no capitalization — section headers render the plain
 * nouns. Reuses mints: 스크래치 = Scratch, 초안 = Draft, 차단 = Block,
 * 재정의 = override, 컬렉션 / 워크플로 / 환경 / 사양 carried; rule-type
 * names align with the chrome registry (헤더 / 차단 / 리디렉션 / 쿼리
 * 매개변수 / 삽입 / 지연). File mints: 패키지 라이브러리 carried; 대체 =
 * supersede (superseded local edit); 일치 범위 = rule-match coverage
 * (scope-widened — a third referent beside 범위 = scope, S19 law);
 * 일시 중지 재정의 = pause override; 재개 = resume / unpause; 되돌리기
 * = revert; 음소거 = mute; 가리기 해제 = unredacted (가리기 = redact
 * carried from panel-inspector); 피어 carried. The confirm-delete
 * sandwich takes 항목을 as the head noun after the bold name.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': '규칙',
  'workbench.sidebar.section.templates': '템플릿',
  'workbench.sidebar.section.requests': '요청',
  'workbench.sidebar.section.workflows': '워크플로',
  'workbench.sidebar.section.environments': '환경',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': '워크스페이스 변수',
  'workbench.sidebar.section.liveVariables': '라이브 변수',
  'workbench.sidebar.section.packageLibrary': '패키지 라이브러리',
  'workbench.sidebar.section.specs': '사양',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': '브라우저 인터셉터',
  'workbench.sidebar.view.apiRequests': 'API 요청',
  'workbench.sidebar.view.workflows': '워크플로',
  'workbench.sidebar.view.variables': '변수',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': '새 규칙',
  'workbench.sidebar.header.addRequest': '요청 추가',
  'workbench.sidebar.header.createNewEnvironment': '새 환경 만들기',
  'workbench.sidebar.header.createNewSpec': '새 사양 만들기',
  'workbench.sidebar.header.newWorkflow': '새 워크플로',
  'workbench.sidebar.header.newTemplateCollection': '새 템플릿 컬렉션',
  'workbench.sidebar.header.exportSelected': '선택한 {count}개 내보내기…',
  'workbench.sidebar.header.exportSelectedAria': '선택한 항목 {count}개 내보내기',
  'workbench.sidebar.header.clearSelection': '선택 해제',
  'workbench.sidebar.header.clearSelectionAria': '내보내기 선택 해제',
  'workbench.sidebar.header.selectOpenedTab': '열린 탭 선택',
  'workbench.sidebar.header.selectOpenedTabAria': '열린 탭 선택',
  'workbench.sidebar.header.expandAll': '모두 펼치기',
  'workbench.sidebar.header.expandAllAria': '모두 펼치기',
  'workbench.sidebar.header.collapseAll': '모두 접기',
  'workbench.sidebar.header.collapseAllAria': '모두 접기',
  'workbench.sidebar.behavior.title': '동작',
  'workbench.sidebar.behavior.openEntriesSingleClick': '한 번 클릭으로 항목 열기',
  'workbench.sidebar.behavior.openCollectionsSingleClick': '한 번 클릭으로 컬렉션 열기',
  'workbench.sidebar.behavior.openFoldersSingleClick': '한 번 클릭으로 폴더 열기',
  'workbench.sidebar.behavior.alwaysSelectOpened': '항상 열린 탭 선택',
  'workbench.sidebar.appearance.title': '모양',
  'workbench.sidebar.appearance.showIndentGuides': '들여쓰기 안내선 표시',
  'workbench.sidebar.dnd.itemsCount': ({ count }, locale) => plural(locale, Number(count), { other: '항목 {count}개' }),
  'workbench.sidebar.toast.itemsMoved': ({ count }, locale) =>
    plural(locale, Number(count), { other: '항목 {count}개 이동됨' }),
  'workbench.sidebar.toast.moveFailed': '이동 실패',
  'workbench.sidebar.filterPlaceholder': '필터',

  // ── Sidebar: speed-search bar (on-demand, dual filter/search mode) ──
  'workbench.sidebar.menu.search': '검색',
  'workbench.sidebar.search.searchPlaceholder': '검색',
  'workbench.sidebar.search.modeSearch': '검색: 일치하는 행 강조',
  'workbench.sidebar.search.modeFilter': '필터: 일치하지 않는 행 숨기기',
  'workbench.sidebar.search.noMatches': '일치 항목 없음',
  'workbench.sidebar.search.close': '검색 닫기',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': '새 컬렉션',
  'workbench.sidebar.menu.newRequest': '새 요청',
  'workbench.sidebar.menu.import': '가져오기…',
  'workbench.sidebar.menu.addRule': '규칙 추가',
  'workbench.sidebar.menu.addRequest': '요청 추가',
  'workbench.sidebar.menu.addFolder': '폴더 추가',
  'workbench.sidebar.menu.rename': '이름 바꾸기',
  'workbench.sidebar.menu.editVariables': '변수 편집',
  'workbench.sidebar.menu.createWorkflow': '워크플로 만들기…',
  'workbench.sidebar.menu.export': '내보내기…',
  'workbench.sidebar.menu.delete': '삭제',
  'workbench.sidebar.menu.duplicate': '복제',
  'workbench.sidebar.menu.copyAs': '다른 형식으로 복사',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.convertToGraphql': 'GraphQL 요청으로 변환',
  'workbench.sidebar.menu.pauseCollection': '컬렉션 일시 중지',
  'workbench.sidebar.menu.unpauseCollection': '컬렉션 재개',
  'workbench.sidebar.menu.pauseFolder': '폴더 일시 중지',
  'workbench.sidebar.menu.unpauseFolder': '폴더 재개',
  'workbench.sidebar.menu.resetCollectionPauseOverride': '컬렉션 일시 중지 재정의 재설정',
  'workbench.sidebar.menu.resetFolderPauseOverride': '폴더 일시 중지 재정의 재설정',
  'workbench.sidebar.menu.clearNestedPauseOverrides': '중첩된 일시 중지 재정의 지우기',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': '일시 중지됨',
  'workbench.sidebar.badge.draft': '초안',
  'workbench.sidebar.badge.unresolved': '미해결',
  'workbench.sidebar.badge.off': '꺼짐',
  'workbench.sidebar.badge.incomplete': '미완성',
  'workbench.sidebar.badge.scratch': '스크래치',
  'workbench.sidebar.badge.scripts': '스크립트',
  'workbench.sidebar.badge.specDrift': '변경됨',
  'workbench.sidebar.badge.scriptsTooltip':
    '이 가져온 요청은 실행할 때 JavaScript 코드를 실행합니다. 열어서 스크립트를 검토하세요.',
  'workbench.sidebar.badge.dirtyAria': '저장하지 않은 변경',
  'workbench.sidebar.rule.enable': '규칙 활성화',
  'workbench.sidebar.rule.disable': '규칙 비활성화',
  'workbench.sidebar.env.setActive': '활성으로 설정',
  'workbench.sidebar.env.setInactive': '비활성으로 설정',
  'workbench.sidebar.env.setDefault': '기본값으로 설정',
  'workbench.sidebar.env.unsetDefault': '기본값 해제',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '변수 {count}개' }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 워크플로에 바인딩된 라이브 변수 {count}개' }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': '폴더가 비어 있습니다',
  'workbench.sidebar.placeholder.collectionEmptyTitle': '컬렉션이 비어 있습니다',
  'workbench.sidebar.placeholder.requestsEmptyTitle': '아직 요청이 없습니다',
  'workbench.sidebar.placeholder.templatesEmptyTitle': '아직 템플릿이 없습니다',
  'workbench.sidebar.placeholder.addRuleOrFolder': '규칙이나 폴더를 추가해 시작하세요.',
  'workbench.sidebar.placeholder.addRequestOrFolder': '요청이나 폴더를 추가해 시작하세요.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': '규칙을 템플릿으로 저장하면 채워집니다.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': '편집기에서 규칙을 템플릿으로 저장하세요.',
  'workbench.sidebar.placeholder.addRule': '규칙 추가',
  'workbench.sidebar.placeholder.addFolder': '폴더 추가',
  'workbench.sidebar.placeholder.addRequest': '요청 추가',
  'workbench.sidebar.emptySection': '이 섹션에 항목이 없습니다',
  'workbench.sidebar.emptySectionCreate': '만들기',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': '시스템 템플릿',
  'workbench.sidebar.ruleType.header': '헤더',
  'workbench.sidebar.ruleType.block': '차단',
  'workbench.sidebar.ruleType.redirect': '리디렉션',
  'workbench.sidebar.ruleType.queryParam': '쿼리 매개변수',
  'workbench.sidebar.ruleType.inject': '삽입',
  'workbench.sidebar.ruleType.delay': '지연',
  'workbench.sidebar.ruleType.requestBody': 'API 요청 본문',
  'workbench.sidebar.ruleType.response': 'API 응답',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': '워크스페이스 변수',
  'workbench.sidebar.singleton.liveVariables': '라이브 변수',
  'workbench.sidebar.singleton.packageLibrary': '패키지 라이브러리',

  // ── Sidebar: default entity names ───────────────────────────────────
  // (New Rules/Requests Collection promoted to `shared.defaults.*` when
  // the save modals became their second converted consumer; New
  // Environment followed when App's env-selector create flow converted.)
  'workbench.sidebar.defaults.newFolder': '새 폴더',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': '항목을 삭제하시겠습니까?',
  'workbench.sidebar.confirmDelete.bodyPrefix': '정말 ',
  'workbench.sidebar.confirmDelete.bodySuffix': ' 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  'workbench.sidebar.confirmDelete.ok': '삭제',
  'workbench.sidebar.toast.toggleRuleFailed': '규칙을 전환하지 못했습니다',
  'workbench.sidebar.toast.renameExampleFailed': '예시 이름을 바꾸지 못했습니다',
  'workbench.sidebar.toast.duplicateExampleFailed': '예시를 복제하지 못했습니다',
  'workbench.sidebar.toast.deleteExampleFailed': '예시를 삭제하지 못했습니다',
  'workbench.sidebar.toast.createRequestCollectionFailed': '요청 컬렉션을 만들지 못했습니다',
  'workbench.sidebar.toast.createEnvironmentFailed': '환경을 만들지 못했습니다',
  'workbench.sidebar.toast.createSpecFailed': '사양을 만들지 못했습니다',
  'workbench.sidebar.toast.renameSpecFailed': '사양 이름을 바꾸지 못했습니다',
  'workbench.sidebar.toast.deleteSpecFailed': '사양을 삭제하지 못했습니다',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': '변경 되돌림',
  'workbench.activityFeed.revertFailed': '되돌리기 실패: {reason}',
  'workbench.activityFeed.emptyTitle': '아직 활동이 없습니다',
  'workbench.activityFeed.emptyHint': '피어에서 들어온 변경이 여기에 표시됩니다.',
  'workbench.activityFeed.view': '보기',
  'workbench.activityFeed.mute': '음소거',
  'workbench.activityFeed.unmute': '음소거 해제',
  'workbench.activityFeed.muteTip': '이 항목에 대해 앞으로 들어오는 활동 행을 숨깁니다. 지난 행은 유지됩니다.',
  'workbench.activityFeed.unmuteTip': '이 항목에 대해 들어오는 활동을 다시 표시합니다.',
  'workbench.activityFeed.revert': '되돌리기',
  'workbench.activityFeed.revertTip':
    '이 변경의 역을 적용합니다. 항목을 들어오기 전 상태로 되돌리는 새 변경을 내보냅니다.',
  'workbench.activityFeed.revertUnavailableDelete': '삭제는 영구적이며 되돌릴 수 없습니다 (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': '이 변경은 되돌릴 수 없습니다.',
  'workbench.activityFeed.revertUnavailableParentGone': '이 항목이 있던 폴더가 더 이상 없습니다.',
  'workbench.activityFeed.kind.created': '생성됨',
  'workbench.activityFeed.kind.createdTip': '피어에서 새 항목이 도착했습니다.',
  'workbench.activityFeed.kind.edited': '편집됨',
  'workbench.activityFeed.kind.editedTip': '피어가 이 항목의 필드를 편집했습니다.',
  'workbench.activityFeed.kind.deleted': '삭제됨',
  'workbench.activityFeed.kind.deletedTip': '피어가 이 항목을 삭제했습니다.',
  'workbench.activityFeed.kind.superseded': '로컬 편집 대체됨',
  'workbench.activityFeed.kind.supersededTip': '들어온 변경이 진행 중이던 로컬 편집을 대체했습니다.',
  'workbench.activityFeed.kind.sensitiveRotation': '민감 필드 교체됨',
  'workbench.activityFeed.kind.sensitiveRotationTip': '민감 필드 (시크릿 / 토큰 / 민감한 헤더)가 교체되었습니다.',
  'workbench.activityFeed.kind.scopeWidened': '일치 범위 확장됨',
  'workbench.activityFeed.kind.scopeWidenedTip':
    '규칙 조건이 느슨해졌습니다. 이제 규칙이 더 넓은 URL/메서드 집합과 일치합니다.',
  'workbench.activityFeed.kind.agentObserved': '에이전트 읽기',
  'workbench.activityFeed.kind.agentObservedTip':
    '에이전트가 MCP 관찰 계층을 통해 라이브 트래픽을 읽었습니다. 준비된 소스에서 가려진 형태로 투사됩니다.',
  'workbench.activityFeed.kind.rehomed': '컬렉션 루트로 이동됨',
  'workbench.activityFeed.kind.rehomedTip':
    '다른 피어가 그 폴더를 삭제했거나 자기 안으로 옮겼기 때문에 이 항목은 컬렉션 루트에 다시 붙었습니다.',
  'workbench.activityFeed.rawRead': '가리기 해제',
  'workbench.activityFeed.rawReadTip':
    '이 읽기는 원본 값을 그대로 투사했습니다. 도구 › 트래픽에서 가리기 해제 세션 읽기 허용이 켜져 있었습니다.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) => plural(locale, Number(count), { other: '규칙 {count}개' }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '요청 {count}개' }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), { other: '템플릿 {count}개' }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· 폴더 {count}개' }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· 하위 폴더 {count}개' }),
  'workbench.overview.stats.activeTag': '활성 {count}개',
  'workbench.overview.stats.disabledTag': '비활성 {count}개',
  'workbench.overview.stats.draftTag': '초안 {count}개',
  'workbench.overview.stats.pausedTag': '일시 중지됨',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), { other: '폴더 · 규칙 {count}개' }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '폴더 · 요청 {count}개' }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), { other: '폴더 · 템플릿 {count}개' }),
  'workbench.overview.status.draft': '초안',
  'workbench.overview.status.incomplete': '미완성',
  'workbench.overview.status.disabled': '비활성',
  'workbench.overview.status.paused': '일시 중지됨',
  'workbench.overview.status.active': '활성',
  'workbench.overview.action.addRule': '규칙 추가',
  'workbench.overview.action.addRequest': '요청 추가',
  'workbench.overview.action.pause': '일시 중지',
  'workbench.overview.action.resume': '재개',
  'workbench.overview.action.pauseCollectionTooltip': '이 컬렉션의 모든 규칙 일시 중지',
  'workbench.overview.action.resumeCollectionTooltip': '이 컬렉션의 모든 규칙 재개',
  'workbench.overview.action.pauseFolderTooltip': '이 폴더의 모든 규칙 일시 중지',
  'workbench.overview.action.resumeFolderTooltip': '이 폴더의 모든 규칙 재개',
  'workbench.overview.action.variables': '변수',
  'workbench.overview.action.variablesTooltip': '이 컬렉션 범위의 변수 편집',
  'workbench.overview.action.variablesTooltipTemplate': '이 템플릿 컬렉션 범위의 변수 편집',
  'workbench.overview.caption.description': '설명',
  'workbench.overview.caption.contents': '내용',
  'workbench.overview.empty.collectionNotFound': '컬렉션을 찾을 수 없습니다',
  'workbench.overview.empty.folderNotFound': '폴더를 찾을 수 없습니다',
  'workbench.overview.empty.requestCollectionNotFound': '요청 컬렉션을 찾을 수 없습니다',
  'workbench.overview.empty.templateCollectionNotFound': '템플릿 컬렉션을 찾을 수 없습니다',
  'workbench.overview.empty.noItems': '아직 항목이 없습니다',
  'workbench.overview.empty.noRequests': '아직 요청이 없습니다',
  'workbench.overview.empty.templatesCollection':
    '이 컬렉션에 템플릿이 없습니다. 규칙을 템플릿으로 저장하면 이 컬렉션이 채워집니다.',
  'workbench.overview.empty.templatesFolder':
    '아직 템플릿이 없습니다. 규칙 편집기에서 규칙을 템플릿으로 저장하면 이 폴더가 채워집니다.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': '컬렉션 검색',
  'workbench.collectionPicker.empty': '아직 컬렉션이 없습니다. 가져올 때 하나가 자동으로 만들어집니다.',
  'workbench.collectionPicker.noMatch': '일치하는 컬렉션이 없습니다.',
  'workbench.collectionPicker.newCollection': '새 컬렉션',
} as const satisfies Catalog;
