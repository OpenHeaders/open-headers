/**
 * Workbench Docs panel — SVG diagram labels — Korean. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key; register per
 * the `ko/shared.ts` header. Vocabulary is QUOTED from the shipped ko
 * files, never re-minted: the sidebar entries (규칙 / 요청 / 환경 /
 * 컬렉션 / 워크플로 / 템플릿 / Vault / 워크스페이스 변수 / 라이브 변수 /
 * 브라우저 인터셉터 / API 요청), every condition name in its rule-editor
 * form (요청 도메인 / 도메인 제외 / 발신자 도메인 / 메서드 / 리소스 유형 /
 * 도메인 종류 / 응답 헤더 / URL 패턴 / URL 정규식), the header ops (추가 /
 * 바꾸기, 덧붙이기, 제거, 병합, 바꾸기만, 모두 제거; 재정의 = the Override
 * op noun), the rule types (차단 / 리디렉션 / 삽입 / 지연 / 쿼리 매개변수 /
 * 요청 본문 / 응답 본문), the action categories (요청 수정 / 응답 수정 /
 * 코드 실행), the inject timings (가능한 한 빨리 / 페이지 로드 후), the
 * popup tab (“이 페이지”), the six subsystem pills (동기화 / 규칙 / 요청 /
 * 권한 / 시크릿 / 라이브), the debug-mode labels (디버그 모드 / 시스템 상태
 * / 연결 대상 / 둘 다 / 이 브라우저 탭 포함 / 연결된 탭 / 표준 모드 / 연결
 * 실패 / 휴리스틱), the docs nouns (접두사 없는 참조 / 순회 / 사다리 /
 * 가려짐 / 도달 범위 / 정적 / 동적 / 직접 / 간접 / 대기 페이지 / 차선 /
 * 픽스처 / 몽키 패치 / 알약 / 하위 시스템 / 종합 / 상한 / 웨이크 /
 * 하이드레이트 / 드리프트 / 암호문 / 실행기 / 주기 / 최신 / 오래됨 / 실패
 * 중 / 전송선 / 실행 = fire), the keyboard regions (왼쪽 사이드바 / 편집기
 * / 오른쪽 사이드바 / 하단 패널). Kickers translate (규칙 / 적용 전 / 적용
 * 후 / 실행되지 않을 때 / 제안 / 흔한 용도 / 주의할 점). MINTS: 우회 =
 * detour beside 인라인; 수렴 = convergence; 무동작 = no-op. Rule banners
 * mimic the ko rule row (차단 · 요청 도메인: ads.openheaders.com); Chrome
 * ResourceType names, DNR / Script / Popup / Workbench / DevTools as
 * plane names and every wire mirror ride raw; the system-status popover
 * rows and audit messages copy the wire strings the ko docs body keeps
 * raw. Sandwich fragments open with a head noun after a raw chip and
 * keep their en edge spaces (render sites checked: `conditions/*.tsx`,
 * `multi-tab/navigation.tsx`, `system-status/vault.tsx`,
 * `open-headers/paradigm-field-sync.tsx`).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: resolution ladder ────────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    '접두사 없는 변수 참조는 vault 저장소, 환경, 컬렉션, 워크스페이스 순으로 해석되며 첫 일치가 이깁니다. ' +
    '라이브, 단계, 파일, 동적 범위는 이름 공간 접두사로만 닿을 수 있습니다.',
  'workbench.docs.diagrams.variables.ladder.title': '접두사 없는 참조: 정의한 첫 범위가 이깁니다',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': '시크릿 · 이 기기에만',
  'workbench.docs.diagrams.variables.ladder.environment': '환경',
  'workbench.docs.diagrams.variables.ladder.environmentSub': '활성, 그다음 기본',
  'workbench.docs.diagrams.variables.ladder.collection': '컬렉션',
  'workbench.docs.diagrams.variables.ladder.collectionSub': '활성 컬렉션만',
  'workbench.docs.diagrams.variables.ladder.workspace': '워크스페이스',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': '모두와 공유',
  'workbench.docs.diagrams.variables.ladder.miss': '불일치',
  'workbench.docs.diagrams.variables.ladder.railHeading': '이름 공간 전용',
  'workbench.docs.diagrams.variables.ladder.railFoot1': '접두사로만 도달.',
  'workbench.docs.diagrams.variables.ladder.railFoot2': '접두사 없는 순회에는 끼지 않음',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}}: 접두사가 범위 하나를 고정합니다.',

  // ── Variables: creation map ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    '사이드바 지도. 컬렉션 변수는 컬렉션에, 환경은 환경 아래에 살고, Vault, 워크스페이스 변수, 라이브 변수는 ' +
    '사이드바 최상위 항목입니다',
  'workbench.docs.diagrams.variables.creation.title': '각 범위를 만드는 곳',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'PAYMENTS TEAM',
  'workbench.docs.diagrams.variables.creation.collections': '▾ 컬렉션',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments API',
  'workbench.docs.diagrams.variables.creation.variables': '변수',
  'workbench.docs.diagrams.variables.creation.environments': '▾ 환경',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': '워크스페이스 변수',
  'workbench.docs.diagrams.variables.creation.liveVariables': '라이브 변수',
  'workbench.docs.diagrams.variables.creation.footer1': '컬렉션은 자기 변수 페이지를 가지고,',
  'workbench.docs.diagrams.variables.creation.footer2': '나머지는 모두 사이드바 항목입니다.',

  // ── Variables: shadowing ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host 변수가 환경과 워크스페이스 양쪽에 정의됨. 접두사 없는 참조는 환경 값으로 해석되고, ' +
    '이름 공간 형식은 여전히 워크스페이스 값을 읽습니다',
  'workbench.docs.diagrams.variables.shadowing.title': '두 범위에 같은 이름: 더 높은 쪽이 이깁니다',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ 이김',
  'workbench.docs.diagrams.variables.shadowing.shadowed': '가려짐',
  'workbench.docs.diagrams.variables.shadowing.envLabel': '환경 · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': '워크스페이스',
  'workbench.docs.diagrams.variables.shadowing.footer': '접두사는 사다리를 건너뛰고 범위 하나를 직접 읽습니다.',

  // ── Variables: live lifecycle ───────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    '라이브 워크플로가 단계를 실행하고, 노출된 캡처를 라이브 변수로 게시하며, 규칙과 요청이 이를 소비합니다. ' +
    '자동 새로 고침이 워크플로를 다시 실행합니다',
  'workbench.docs.diagrams.variables.live.title': '성공한 실행이 값을 게시합니다',
  'workbench.docs.diagrams.variables.live.workflowTitle': '라이브 워크플로',
  'workbench.docs.diagrams.variables.live.step1': '단계 1 · 로그인',
  'workbench.docs.diagrams.variables.live.step2': '단계 2 · token 값 가져오기',
  'workbench.docs.diagrams.variables.live.expose': '노출: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': '실행 성공',
  'workbench.docs.diagrams.variables.live.publishes': '게시',
  'workbench.docs.diagrams.variables.live.rules': '규칙',
  'workbench.docs.diagrams.variables.live.requests': '요청',
  'workbench.docs.diagrams.variables.live.autoRefresh': '자동 새로 고침이 다시 실행',
  'workbench.docs.diagrams.variables.live.footer1': '저장하면 워크플로가 활성화됩니다. 값은 성공한 실행 뒤에만',
  'workbench.docs.diagrams.variables.live.footer2': '나타나며, 워크플로의 일정에 따라 새로 고쳐집니다.',

  // ── Variables: consumers ────────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    '템플릿 값 하나 (Authorization: Bearer token) 를 규칙, 요청, 워크플로가 소비합니다',
  'workbench.docs.diagrams.variables.consumers.title': '한 번 정의하고 어디서나 참조',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': '규칙',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': '헤더, 리디렉션,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': '본문, 삽입',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': '규칙이 적용될 때',
  'workbench.docs.diagrams.variables.consumers.requests': '요청',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL 주소, 매개변수,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': '헤더, 인가, 본문',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': '전송 시',
  'workbench.docs.diagrams.variables.consumers.workflows': '워크플로',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': '모든 단계,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': '연쇄 캡처',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': '실행마다',
  'workbench.docs.diagrams.variables.consumers.footer1': '값은 사용 시점에 치환됩니다. 변수를 한 번 바꾸면',
  'workbench.docs.diagrams.variables.consumers.footer2': '모든 규칙, 요청, 워크플로가 이를 반영합니다.',

  // ── Variables: per-scope references ─────────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': '하지 말 것:',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: 동기화되는 항목에서는 vault 템플릿으로 시크릿을 참조하고, 원시 키를 규칙이나 워크스페이스 변수에 ' +
    '절대 붙여넣지 마세요',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault: 이 기기를 떠나지 않는 시크릿',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': '로컬에서 해석됨',
  'workbench.docs.diagrams.variables.refs.vault.good1Note': '동기화되는 규칙. 팀원마다 자기 키가 채워집니다',
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'TOTP 항목. 현재 코드로 해석되며 seed 값은 절대 아닙니다',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote': 'vault 항목은 동기화, 내보내기, git 밖에 머뭅니다',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': '규칙 안의 Bearer sk-live-9f3d…',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason': '붙여넣은 평문은 워크스페이스 전체로 동기화됩니다',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': '워크스페이스 변수로 둔 api_key',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason':
    '이것도 동기화됩니다. vault 저장소만이 유일한 로컬 범위입니다',
  'workbench.docs.diagrams.variables.refs.vault.footer1':
    'Vault 저장소는 모든 범위보다 위입니다. 접두사 없는 {{api_key}} 참조는',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'vault 값이 있으면 항상 그 값을 고릅니다.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    '환경: 변수 이름 하나가 스테이지마다 다른 값으로 해석됩니다. 규칙을 복제하는 대신 환경을 전환하고, ' +
    '시크릿은 vault 저장소에 두세요',
  'workbench.docs.diagrams.variables.refs.environment.title': '환경: 이름 하나, 스테이지마다 값 하나',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': '환경 · staging (활성)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': '활성 환경이 이김',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'staging 환경이 활성인 동안',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': '환경 전환. 같은 규칙, 편집 없음',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote': '불일치하면 먼저 기본 환경으로 대체됩니다',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'production 환경에 입력한 sk-live 키',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason': '환경은 동기화됩니다. 시크릿은 Vault 저장소에 둘 것',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': '모든 규칙의 staging 사본',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    '스테이지마다 규칙을 복제하지 말고 환경을 전환하세요',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    '모든 스테이지에서 같은 값인가요? 워크스페이스를 쓰세요.',
  'workbench.docs.diagrams.variables.refs.environment.footer2':
    '사용자별 시크릿인가요? Vault 저장소가 모든 환경보다 위입니다.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    '컬렉션: 변수는 그 컬렉션 안의 규칙과 요청에서만 해석됩니다. 워크스페이스 전체에서 쓰는 값은 ' +
    '워크스페이스 범위로 옮기세요',
  'workbench.docs.diagrams.variables.refs.collection.title': '컬렉션: API 하나로 범위 한정',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments API · 변수',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'Payments API 안에서 해석됨',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'Payments API 컬렉션 안의 요청',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'Payments API 컬렉션 안의 규칙',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': '해석되지 않음:',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': 'Billing API 안의 {{base_url}}',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': '다른 컬렉션입니다. 대신 거기에 정의하세요',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '컬렉션에 속하지 않은 규칙 안의 {{base_url}}',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason': '컬렉션 없음 → 참조가 이 범위를 지나칩니다',
  'workbench.docs.diagrams.variables.refs.collection.footer1': '모든 컬렉션에 필요한가요? 워크스페이스로 옮기세요.',
  'workbench.docs.diagrams.variables.refs.collection.footer2': '같은 이름의 환경 변수가 이보다 위입니다.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    '워크스페이스: 워크스페이스 변수는 어디서나 해석되며 순위가 가장 낮습니다. 시크릿은 vault 저장소에, ' +
    '스테이지별 값은 환경에 두세요',
  'workbench.docs.diagrams.variables.refs.workspace.title': '워크스페이스: 공유되는 바탕 계층',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': '워크스페이스 변수',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': '어디서나 해석됨',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': '헤더 규칙. 어떤 컬렉션, 어떤 환경이든',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': '요청 URL 주소',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note': '고정됨. 더 높은 범위가 이름을 가려도 그대로',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason': '모두에게 동기화됩니다. 시크릿은 Vault 저장소에 둘 것',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': '스테이지마다 바뀝니다. 각 환경에 정의할 것',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    '시크릿인가요? Vault 저장소를 쓰세요. 스테이지마다 다른가요? 환경을 쓰세요.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2': '워크스페이스는 어디서나 참인 값을 위한 곳입니다.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    '라이브: 워크플로가 게시한 값은 live 접두사로 참조합니다. 접두사 없는 참조는 라이브 값으로 절대 해석되지 않고, ' +
    '손으로 붙여넣은 토큰은 오래됩니다',
  'workbench.docs.diagrams.variables.refs.live.title': '라이브: 워크플로 실행이 만드는 값',
  'workbench.docs.diagrams.variables.refs.live.chipSub': '라이브 변수 · OAuth 로그인 워크플로',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': '마지막 실행이 게시함',
  'workbench.docs.diagrams.variables.refs.live.good1Note': '절대 오래되지 않는 헤더 규칙',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '요청과 워크플로 안의 {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.good2Note': '항상 가장 최근에 게시된 값',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}}: 접두사 없음',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    '라이브는 접두사 없는 순회에 끼지 않습니다. {{live.token}} 형식으로 쓰세요',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': '환경 변수에 붙여넣은 토큰',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': '조용히 만료됩니다. 대신 워크플로로 뒷받침하세요',
  'workbench.docs.diagrams.variables.refs.live.footer1': '워크플로를 편집했나요? 값이 오래됨으로 표시되며,',
  'workbench.docs.diagrams.variables.refs.live.footer2': '다음 성공한 실행만이 값을 다시 게시합니다.',

  // ── Multi-tab: side-by-side sync overview ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    '워크스페이스 탭 두 개가 나란히 열림. 서로 다른 워크스페이스나 서로 다른 레이아웃으로 병렬 작업',
  'workbench.docs.diagrams.multiTab.sync.title': '탭 둘, 컨텍스트 둘: 동시에',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': '규칙',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': '요청',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': '환경',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': '인증 헤더',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'CORS 우회',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': '광고 차단',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': '규칙 편집기',
  'workbench.docs.diagrams.multiTab.sync.envEditor': '환경 편집기',
  'workbench.docs.diagrams.multiTab.sync.footer1': '규칙 + 컬렉션은 저장소를 통해 동기화됩니다.',
  'workbench.docs.diagrams.multiTab.sync.footer2': '각 탭은 자기 워크스페이스 + 레이아웃을 유지합니다.',

  // ── Multi-tab: ordinal numbering timeline ───────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    '탭 번호 타임라인. 순번은 탭이 살아 있는 동안 안정적이며, #1 탭을 닫아도 번호가 다시 매겨지지 않고 ' +
    '다음 탭이 #4 번호를 받습니다',
  'workbench.docs.diagrams.multiTab.numbering.title': '순번은 탭이 살아 있는 동안 안정적입니다',
  'workbench.docs.diagrams.multiTab.numbering.step1': '탭 1개 열림',
  'workbench.docs.diagrams.multiTab.numbering.note1': '접두사 없음',
  'workbench.docs.diagrams.multiTab.numbering.step2': '하나 더 열기',
  'workbench.docs.diagrams.multiTab.numbering.note2': '접두사 표시됨',
  'workbench.docs.diagrams.multiTab.numbering.step3': '셋째 열기',
  'workbench.docs.diagrams.multiTab.numbering.step4': '#1 닫기',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 그대로',
  'workbench.docs.diagrams.multiTab.numbering.step5': '하나 더 열기',
  'workbench.docs.diagrams.multiTab.numbering.note5': '다음은 #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    '번호는 모든 워크스페이스 탭이 닫힌 뒤에만 #1 번호로 되돌아갑니다.',

  // ── Multi-tab: navigation reuse ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    '탐색 재사용: 같은 창 우선. 위: 같은 창에 워크스페이스 탭이 있으면 클릭이 그 탭을 활성화합니다. 아래: ' +
    '다른 창에만 워크스페이스 탭이 있으면 호출한 창에 새 탭이 열립니다.',
  'workbench.docs.diagrams.multiTab.navigation.title': '팝업에서 “규칙 편집”을 누르면',
  'workbench.docs.diagrams.multiTab.navigation.subtitle': '팝업은 먼저 내 창에서 워크스페이스 탭을 찾습니다',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': '같은 창',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': ': 이미 워크스페이스 탭이 있음',
  'workbench.docs.diagrams.multiTab.navigation.window1': '창 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': '창 1 (호출한 창)',
  'workbench.docs.diagrams.multiTab.navigation.window2': '창 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': '팝업',
  'workbench.docs.diagrams.multiTab.navigation.editRule': '규칙 편집 ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': '기존 탭 활성화 · 새 탭 없음',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': '다른 창',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': ': 내 창에는 없음',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ 새 탭',
  'workbench.docs.diagrams.multiTab.navigation.untouched': '그대로 · 포커스를 빼앗지 않음',
  'workbench.docs.diagrams.multiTab.navigation.footer1':
    'Chrome 브라우저의 DevTools 창이 창마다 도킹되는 것과 같습니다.',
  'workbench.docs.diagrams.multiTab.navigation.footer2': '원래 있던 창에 그대로 머뭅니다.',

  // ── Multi-tab: what syncs (shared pool) ─────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    '탭 간에 동기화되는 것. chrome.storage 저장소가 규칙, 컬렉션, 폴더, 환경, 변수, vault, 요청, 템플릿을 ' +
    '담습니다. 두 탭 모두 이를 통해 읽고 씁니다.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ 탭 간 동기화',
  'workbench.docs.diagrams.multiTab.synced.subtitle': '모든 탭이 같은 chrome.storage 저장소를 읽고 씁니다',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': '단일 진실 원천',
  'workbench.docs.diagrams.multiTab.synced.pillRules': '규칙',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': '컬렉션',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': '폴더',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': '환경',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': '변수',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': '요청',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': '템플릿',
  'workbench.docs.diagrams.multiTab.synced.tab1': '탭 #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': '탭 #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': '라이브 데이터',
  'workbench.docs.diagrams.multiTab.synced.footer': '어느 탭에서 저장하든 다른 탭이 즉시 다시 하이드레이트합니다.',

  // ── Multi-tab: what stays local ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    '각 탭에 머무는 것. 레이아웃 분할선 비율과 저장하지 않은 초안. 두 탭이 눈에 띄게 다릅니다: 25/75 대 65/35 ' +
    '분할, 한쪽에는 초안이 있고 다른 쪽에는 없음.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ 각 탭에 머무름',
  'workbench.docs.diagrams.multiTab.local.subtitle': '분할선 비율 + 저장하지 않은 입력: 작업한 곳에만 남습니다',
  'workbench.docs.diagrams.multiTab.local.tabTitle': '탭 {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': '레이아웃',
  'workbench.docs.diagrams.multiTab.local.draftLabel': '저장하지 않은 초안',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● 저장 안 됨',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': '저장하지 않은 변경 없음',
  'workbench.docs.diagrams.multiTab.local.footer1': '각 탭은 자기 분할선 + 초안을 유지합니다.',
  'workbench.docs.diagrams.multiTab.local.footer2': '드래그한 뒤에 연 탭은 새 레이아웃을 물려받습니다.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': '규칙',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': '적용 전',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': '적용 후',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': '실행되지 않을 때',
  'workbench.docs.diagrams.headerActions.shared.suggestion': '제안',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    '같은 시작 헤더에 네 가지 헤더 작업을 적용. 재정의는 바꾸고, 덧붙이기는 중복 행을 더하고, 제거는 ' +
    '지우고, 병합은 이어 붙입니다.',
  'workbench.docs.diagrams.headerActions.overview.title': '같은 시작 헤더 → 네 가지 결과',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': '재정의',
  'workbench.docs.diagrams.headerActions.overview.opAppend': '덧붙이기',
  'workbench.docs.diagrams.headerActions.overview.opRemove': '제거',
  'workbench.docs.diagrams.headerActions.overview.opMerge': '병합',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(헤더 사라짐)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR: 네이티브, Chrome 브라우저가 적용',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script: 패치된 fetch / XHR (병합만)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    '추가 / 바꾸기: 같은 규칙이 두 경우를 모두 다룹니다. 기존 X-Auth 헤더 값을 바꾸거나, 없으면 헤더를 ' +
    '추가합니다. 둘 다 같은 결과에 도달합니다.',
  'workbench.docs.diagrams.headerActions.override.rule': '재정의 X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': '바꾸기',
  'workbench.docs.diagrams.headerActions.override.addLabel': '추가',
  'workbench.docs.diagrams.headerActions.override.replaceSub': '헤더가 이미 있음',
  'workbench.docs.diagrams.headerActions.override.addSub': 'X-Auth 헤더가 아직 없음',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(X-Auth 없음)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': '값 바뀜',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': '헤더 추가됨',
  'workbench.docs.diagrams.headerActions.override.stamp': '어느 쪽이든 → 내 값을 가진 X-Auth 헤더 하나',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    '추가 / 바꾸기는 규칙의 조건이 요청과 일치하지 않으면 적용되지 않습니다. 조용히 무동작입니다. 제안: ' +
    '요청 도메인 또는 URL 패턴 조건을 확인하세요.',
  'workbench.docs.diagrams.headerActions.override.wontTitle': '일치하지 않는 도메인으로 보내는 요청',
  'workbench.docs.diagrams.headerActions.override.wontDetail': '조건이 작업을 막습니다. 불일치면 무동작입니다.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion': '규칙의 요청 도메인 또는 URL 패턴을 확인하세요.',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    '덧붙이기는 같은 이름의 헤더 행을 하나 더 추가하며 둘 다 전달됩니다. 적용 전에는 Set-Cookie 행이 하나, 적용 후에는 ' +
    '둘이며 새 행이 강조됩니다.',
  'workbench.docs.diagrams.headerActions.append.rule': '덧붙이기 Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 중복 행',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Set-Cookie 행 둘. 둘 다 전달됩니다.',
  'workbench.docs.diagrams.headerActions.append.stamp2': 'Set-Cookie, Link, Via 같은 중복을 허용하는 헤더에 쓰세요.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    '덧붙이기는 중복을 지원하지 않는 헤더에는 깔끔하게 적용되지 않습니다. 브라우저가 하나만 남깁니다. 바꾸려면 재정의를, ' +
    '이어 붙이려면 병합을 쓰세요.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': '중복을 허용하지 않는 헤더',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    '예: Authorization, Host, Content-Type. 브라우저가 하나만 남깁니다.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': '값을 바꾸려면 재정의를 쓰세요.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2': '기존 값에 이어 붙이려면 병합을 쓰세요.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    '제거는 대상 헤더를 지웁니다. 적용 전에는 X-Frame-Options 헤더에 취소선이 있고, 적용 후에는 남은 ' +
    'Content-Type 헤더만 보입니다.',
  'workbench.docs.diagrams.headerActions.remove.rule': '제거 X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': '대상 제거됨',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'X-Frame-Options 헤더의 모든 인스턴스가 지워집니다.',
  'workbench.docs.diagrams.headerActions.remove.stamp2': '같은 헤더의 중복 행도 한 번에 모두 제거됩니다.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    '제거는 대상 헤더가 없으면 무동작이며 오류도 나지 않습니다. 대신 다른 값을 설정하려던 것이라면 ' +
    '재정의를 쓰세요.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': '헤더가 이미 없음',
  'workbench.docs.diagrams.headerActions.remove.wontDetail': '무동작. 오류 없이 요청이 그대로 지나갑니다.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    '제거가 아니라 값을 설정하려던 것이라면 재정의를 쓰세요.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    '병합은 실행 시점에 기존 헤더 값을 읽고, 내 값을 구분자로 이어 붙인 뒤 원래 값을 바꿉니다.',
  'workbench.docs.diagrams.headerActions.merge.rule': "병합 Cookie + new=val  (구분자: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': '구분자로 이어 붙임',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': '기존 값 + 내 값을 구분자로 이어 붙입니다.',
  'workbench.docs.diagrams.headerActions.merge.stamp2': "기본 구분자: Cookie 헤더는 '; ', 그 밖의 헤더는 ', '.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    '병합은 JS 코드가 시작한 fetch / XHR 요청만 가로챕니다. 페이지 탐색과 정적 리소스는 그대로 지나갑니다. ' +
    '그런 경우에는 재정의 또는 덧붙이기 (DNR) 를 쓰세요.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': '페이지 탐색',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'JS 코드가 시작한 fetch / XHR 요청만 Script 엔진을 지납니다.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': '정적 리소스 (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': '브라우저가 발행하며 fetch / XHR 경로를 거치지 않습니다.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    '페이지 수준 헤더에는 재정의 또는 덧붙이기 (DNR) 를 쓰세요.',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': '규칙:',
  'workbench.docs.diagrams.conditions.shared.testRequests': '테스트 요청:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': '테스트한 URL 주소:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': '적용 전',
  'workbench.docs.diagrams.conditions.shared.afterKicker': '적용 후',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': '리터럴: 정확히 일치',
  'workbench.docs.diagrams.conditions.shared.usePrefix': '대신 ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': ' 조건을 쓰세요.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': '요청 도메인',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'URL 패턴',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': '발신자 도메인',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'fetch 호출 하나에 URL 주소 둘. 주소 표시줄의 URL 주소가 출처 (발신자 도메인) 이고, fetch 대상 URL 주소가 ' +
    '호스트 (요청 도메인) 입니다',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'URL 주소 둘, 조건 둘',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': '이 페이지의 JS 코드가 실행:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': '같은 fetch 호출, 서로 다른 URL 주소 둘.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ': 페이지 URL 주소 → 확인하는 조건: ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ': fetch 대상 주소 → 확인하는 조건: ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    '각 조건은 요청의 속성 하나를 확인합니다. 오른쪽의 색 알약이 각 행의 속성을 확인하는 조건 유형을 ' +
    '가리킵니다. 모든 조건은 AND 결합입니다.',
  'workbench.docs.diagrams.conditions.matching.title': '각 조건은 요청의 속성 하나를 확인합니다',
  'workbench.docs.diagrams.conditions.matching.colAttribute': '요청 속성',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': '확인하는 조건',
  'workbench.docs.diagrams.conditions.matching.attrMethod': '메서드:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': '호스트:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': '출처:',
  'workbench.docs.diagrams.conditions.matching.attrType': '유형:',
  'workbench.docs.diagrams.conditions.matching.attrParty': '파티:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': '헤더:',
  'workbench.docs.diagrams.conditions.matching.condMethods': '메서드',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'URL 패턴',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': '요청 도메인',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': '발신자 도메인',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': '리소스 유형',
  'workbench.docs.diagrams.conditions.matching.condDomainType': '도메인 종류',
  'workbench.docs.diagrams.conditions.matching.condHeaders': '응답 헤더',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': '모두 일치해야 함 (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ 규칙 실행',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    '모든 조건이 일치하면 규칙이 실행됩니다. 요청이 브라우저를 떠나기 전에 Authorization 헤더가 ' + '바뀝니다',
  'workbench.docs.diagrams.conditions.ruleFires.title': '조건 일치 → 규칙 실행 → 요청 변경',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': '재정의',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': '규칙',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': '실행',
  'workbench.docs.diagrams.conditions.ruleFires.footer': '규칙은 자기 대상만 바꾸고 나머지는 그대로 지나갑니다.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    '요청 도메인: 항목 하나가 최상위 도메인과 모든 하위 도메인을 어떤 경로나 쿼리에서든 자동으로 포함합니다',
  'workbench.docs.diagrams.conditions.requestDomains.title': '요청 도메인: 항목 하나, 모든 하위 도메인, 어떤 경로든',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': '자동 포함',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly': '호스트만 일치. 어떤 경로나 쿼리 문자열이든 해당됩니다',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': '일치하지 않음:',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': '다른 TLD (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    '진짜 하위 도메인이 아님. “openheaders.com” 앞에 점이 없음',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': '경로로 범위를 좁히려면 규칙에 ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' 조건을 추가하세요.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    '도메인이 여럿인가요? 각 도메인을 별도 항목으로 추가하세요.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    '도메인 제외는 다른 조건의 일치에서 호스트를 뺍니다. 단독으로는 아무것에도 일치하지 않습니다',
  'workbench.docs.diagrams.conditions.excludeDomains.title': '도메인 제외: 다른 조건에서 뺍니다',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': '다른 조건의 일치에서 뺍니다',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ 요청 도메인',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− 도메인 제외',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': '최종 일치 호스트:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': '제외됨',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub': '제외됨. 하위 도메인 규칙은 제외에도 적용됩니다',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': '제외 단독으로는 아무것에도 일치하지 않습니다.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': '다른 조건의 일치에서 뺄 뿐입니다.',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria': '발신자 도메인: 같은 대상, 다른 페이지 출처, 반대 결과',
  'workbench.docs.diagrams.conditions.initiatorDomains.title': '발신자 도메인: 어느 페이지가 호출했는지로 일치',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle': '같은 fetch 호출, 페이지 컨텍스트 둘 → 다른 결과',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': '발신자 도메인: portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': '열린 페이지',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ fetch 호출',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ 일치',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ 불일치',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': '발신자 =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': '출처가 아니라 대상으로 일치시키고 싶나요?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria': '메서드: HTTP 동사 다중 선택. 선택한 (주황) 메서드만 일치합니다',
  'workbench.docs.diagrams.conditions.methods.title': '메서드: 어느 HTTP 동사를 일치시킬지 고릅니다',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    '다중 선택. 주황 메서드는 일치하고, 나머지는 규칙을 실행하지 않습니다',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': '선택 목록에 없는 메서드',
  'workbench.docs.diagrams.conditions.methods.footerQ': '모든 메서드에 일치시키고 싶나요?',
  'workbench.docs.diagrams.conditions.methods.footerA': '이 조건을 제거하세요. 기본값은 모든 메서드입니다.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    '리소스 유형: 요청 종류 다중 선택. 선택한 보라 유형은 일치하고, 나머지는 건너뜁니다',
  'workbench.docs.diagrams.conditions.resourceTypes.title': '리소스 유형: 요청 종류 다중 선택',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle':
    '보라 종류는 일치하고, 나머지는 규칙을 실행하지 않습니다',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': '/dashboard 방문',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'page',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'image: 건너뜀',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script: 건너뜀',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': '모든 리소스 유형에 일치시키고 싶나요?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': '이 조건을 제거하세요. 기본값은 모든 종류입니다.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    '도메인 종류: 각 요청은 퍼스트 파티 (같은 등록 가능 도메인) 또는 서드 파티로 분류되고, 규칙의 ' +
    '선택이 어느 종류에 일치할지 정합니다',
  'workbench.docs.diagrams.conditions.domainType.title': '도메인 종류: 퍼스트 파티 대 서드 파티',
  'workbench.docs.diagrams.conditions.domainType.subtitle': '페이지와 요청 URL 주소의 관계로 분류합니다',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': '페이지:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': '규칙 선택:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': '대상',
  'workbench.docs.diagrams.conditions.domainType.colType': '종류',
  'workbench.docs.diagrams.conditions.domainType.colMatch': '일치',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': '퍼스트 파티',
  'workbench.docs.diagrams.conditions.domainType.partyThird': '서드 파티',
  'workbench.docs.diagrams.conditions.domainType.footerBoth':
    '둘 다 원하나요? firstParty 값과 thirdParty 값을 모두 선택하세요.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': '또는 조건을 제거하세요. 기본값은 둘 다입니다.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    '응답 헤더 조건: 정확한 이름과 정확한 값, 응답 쪽만 (Chrome 브라우저의 DNR 엔진은 요청 헤더에 ' +
    '일치시키지 않음)',
  'workbench.docs.diagrams.conditions.headers.title': '응답 헤더: 정확한 이름 + 정확한 값',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    '응답 쪽만. Chrome 브라우저의 DNR 엔진은 요청 헤더에 일치시키지 않습니다',
  'workbench.docs.diagrams.conditions.headers.exactName': '정확한 이름',
  'workbench.docs.diagrams.conditions.headers.exactValue': '정확한 값',
  'workbench.docs.diagrams.conditions.headers.testHeaders': '테스트 응답 헤더:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': '이름은 일치하지만 값이 다름',
  'workbench.docs.diagrams.conditions.headers.reasonName': '다른 헤더 이름',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(Content-Type 헤더가 없는 응답)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': '헤더 없음. 일치하려면 있어야 함',
  'workbench.docs.diagrams.conditions.headers.footer':
    '흔한 용도: 응답 Content-Type 헤더나 사용자 지정 플래그로 규칙 거르기',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'URL 패턴은 전체 URL 주소에 와일드카드를 씁니다. 패턴 구조와 일치 / 불일치 예시',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'URL 패턴: 전체 URL 주소에 와일드카드 (*)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': '아무거나',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': '프로토콜',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': '리터럴 호스트',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(와일드카드 없음)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': '아무 경로',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ 쿼리 문자열',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': '와일드카드: 무엇이든 일치',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '“cdn” ≠ “api”. 하위 도메인 불일치',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': '완전히 다른 호스트',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': '모든 하위 도메인을 한 번에 일치시켜야 하나요?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': '요청 도메인: openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'URL 정규식 구조와 일치 / 불일치 예시. 보라 부분이 실제 정규식이고 나머지는 리터럴입니다',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'URL 정규식: 전체 URL 주소에 RE2 정규식',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': '시작',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': '앵커',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': '리터럴 문자',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. 는 . 문자에 일치)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': '하나 이상',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': '숫자',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': '정규식 문법: 특별한 의미',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': '정규식이 https:// 를 지정하므로 http 주소는 일치하지 않음',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '“latest” 는 /v[0-9]+ 에 일치하지 않음',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'http 주소와 https 주소 둘 다 원하나요?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': '대신 ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' 패턴을 쓰세요. ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' 기호가 s 글자를 선택 사항으로 만듭니다.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    '규칙 구조. 나가는 HTTP 요청을 규칙의 AND 결합 조건과 대조하고, 모두 일치하면 요청이 브라우저를 ' +
    '떠나기 전에 작업이 요청을 바꿉니다.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': '규칙 = 조건 + 작업',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    '조건은 규칙을 실행할지 정합니다. 작업은 무엇을 바꿀지 정합니다.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': '나가는 요청',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': '전',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': '후',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': '추가됨',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': '확인',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': '적용',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': '규칙',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': '편집기 항목',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': '조건',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': '작업',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': '메서드',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': '요청 도메인',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': '응답 헤더',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': '모두 일치해야 함 (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': '규칙당 하나',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': '헤더 작업 · 추가',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': '범주: 요청 수정',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': '조건이 거르고',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': '작업이 바꾸며',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': '요청은 수정되어 나갑니다',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    '작업 분류. 세 범주 (요청 수정, 응답 수정, 코드 실행) 에 모든 작업을 실행 엔진 (DNR 또는 Script) 과 ' +
    '함께 나열합니다.',
  'workbench.docs.diagrams.actions.taxonomy.title': '작업: 범주별',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    '모든 작업은 세 범주 중 하나에 속합니다. 엔진 태그가 어디서 실행되는지 알려 줍니다.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': '요청 수정',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': '브라우저를 떠나기 전에',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': '응답 수정',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': '페이지가 보기 전에',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': '코드 실행',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': '페이지 안 또는 그 스케줄러 안에서',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': '헤더 작업',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': '추가 · 덧붙이기 · 제거 · 병합',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': '차단',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': '네트워크 계층에서 취소',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': '리디렉션',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': '정적 URL 주소 또는 정규식',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': '쿼리 매개변수',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': '추가 · 바꾸기 · 제거',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': '요청 본문',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': '정적 · 동적 · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': '응답 쪽 헤더',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': '응답 본문',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': '모의 본문 · 상태 · 헤더',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'JS / CSS 삽입',
  'workbench.docs.diagrams.actions.taxonomy.subInject': '페이지 스크립트 전 또는 DOM 파싱 후',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': '지연',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': '탐색 + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict': '범주 고르기 · 작업 고르기 · 조건과 짝짓기',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': '동기화',
  'workbench.docs.diagrams.systemStatus.shared.rules': '규칙',
  'workbench.docs.diagrams.systemStatus.shared.requests': '요청',
  'workbench.docs.diagrams.systemStatus.shared.permissions': '권한',
  'workbench.docs.diagrams.systemStatus.shared.secrets': '시크릿',
  'workbench.docs.diagrams.systemStatus.shared.live': '라이브',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': '시스템 상태',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': '아직 이벤트 없음',
  'workbench.docs.diagrams.systemStatus.shared.green': '초록',
  'workbench.docs.diagrams.systemStatus.shared.yellow': '노랑',
  'workbench.docs.diagrams.systemStatus.shared.red': '빨강',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': '데스크톱 앱',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'SW 웨이크',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    '워크벤치 화면: OpenHeaders 워크벤치 탭. 상태 행은 하단 푸터에 있으며 하위 시스템마다 알약 ' + '하나입니다.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': '워크벤치: 푸터의 상태 행',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ 알약 여섯 개. 하위 시스템마다 하나, 아무거나 누르면 팝오버가 열립니다.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    '팝업 화면: 확장 프로그램 팝업이 도구 모음 아이콘에서 열립니다. 상태 알약은 팝업 하단 푸터에 점과 ' +
    '“시스템 상태” 레이블로 자리합니다.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': '팝업: 푸터의 시스템 상태 알약',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ 점 + “시스템 상태” 레이블이 팝업 푸터 띠에 자리합니다.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    '최악 상태 집계기. 하위 시스템 상태 여섯 개가 종합 점 하나로 모입니다. 가장 나쁜 색이 이깁니다: 빨강이 ' +
    '노랑을, 노랑이 초록을 이깁니다.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': '가장 나쁜 색이 이깁니다',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    '빨강 > 노랑 > 초록 · 회색 = 아직 이벤트 없음 (초록으로 취급)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': '연결됨',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12개 활성',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': '아직 이벤트 없음',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': '호스트 축소됨',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': '암호문 복호화',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3개 최신',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': '종합',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': '점',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    '어디든 빨강 하나 → 종합이 빨강. 팝업 / 사이드 패널의 점을 움직입니다.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    '상태 팝오버 레이아웃. 아직 이벤트가 없는 하위 시스템의 회색 행이, 보고한 적 있는 하위 시스템의 ' +
    '색 행보다 위에 옵니다.',
  'workbench.docs.diagrams.systemStatus.popover.title': '팝오버 순서: 회색 먼저, 그다음 색',
  'workbench.docs.diagrams.systemStatus.popover.subtitle': '각 구간 안에서는 정해진 하위 시스템 순서가 유지됩니다',
  'workbench.docs.diagrams.systemStatus.popover.header': '● 시스템 상태',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': '연결됨',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '활성 규칙 12개',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': '호스트 축소됨',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': '암호문 복호화 실패',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ 아직 이벤트 없음 · ↓ 보고함',
  'workbench.docs.diagrams.systemStatus.popover.footer': '첫 보고 때 행이 회색 → 색으로 한 번 옮겨 갑니다.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    '동기화 토폴로지. 확장 프로그램 서비스 워커가 127.0.0.1:8137 주소의 데스크톱 앱으로 WebSocket 연결 하나를 ' +
    '유지하며 워크스페이스, 변수, 팀 동기화 데이터를 주고받습니다.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': '동기화 하위 시스템이 연결되는 방식',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': '확장 프로그램',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': '서비스 워커',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'WS 클라이언트',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': '내 컴퓨터에서',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'WS 서버',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries': '실어 나름: 동적 변수 · 워크스페이스 · 팀 동기화',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': '루프백 전용. 내 컴퓨터를 절대 떠나지 않습니다.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    '동기화 연결 수명 주기 시퀀스 다이어그램. 확장 프로그램 서비스 워커가 데스크톱 앱에 연결하고, 상태 ' +
    '알약이 시간에 따라 초록에서 노랑으로, 다시 초록으로 바뀝니다',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': '동기화 알약이 시간에 따라 바뀌는 방식',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': '확장 프로그램 SW',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': '동기화 알약',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': '설정 읽기',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': '자동 연결 = 꺼짐이면 →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': '비활성',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': '연결 중',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': '연결됨',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': '재시도 #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': '재시도 #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': '그렇지 않으면 →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'WebSocket 연결',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': '핸드셰이크 OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ 연결 끊김',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': '백오프',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': '연결 재시도',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    '재시도 사이는 지수 백오프 · 핑이 조용히 끊긴 프록시 연결을 감지',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    '규칙 파이프라인. 사용자 규칙이 컴파일되고, 변수가 해석되고, 상한 확인을 지나면 Chrome 브라우저가 적용합니다. ' +
    '각 단계는 문제가 생기면 상태 수준을 낼 수 있습니다.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': '규칙이 라이브 DNR 항목이 되는 과정',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': '내 규칙',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': '컴파일',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': '{{VAR}} 해석',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': '상한 확인',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Chrome 적용',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': '라이브 규칙',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'DNR JSON 형식으로',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · workspace',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': '요청에 일치',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': '미해석 → 노랑',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': '상한 초과 → 노랑',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': '거부됨 → 빨강',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N개 활성 → 초록',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': '저장할 때마다 다시 빌드합니다.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    '일시 중지는 초록으로 남습니다 (“Rule execution paused”).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'DNR 용량 막대. 경고 문턱까지 초록, 잘라내기 상한까지 노랑, 그 너머는 빨강. 상한을 넘는 규칙은 ' +
    '버려지므로 실행 시점에는 빨강 구간에 절대 닿지 않습니다.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': '규칙 용량: 각 규칙 수가 닿는 구간',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ 정상',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': '근접',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': '잘림',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': '경고',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': '상한',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    '상한을 넘는 규칙은 일치 순서대로 버려집니다 (위가 이김).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Chrome 브라우저의 절대 한계는 훨씬 먼 30,000개입니다.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    '요청 실행기 결과. 4xx 및 5xx 응답을 포함해 어떤 HTTP 응답이든 알약을 초록으로 바꿉니다. 응답이 없는 ' +
    '네트워크 수준 실패만 노랑으로 바꿉니다.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': '무엇이 요청 알약을 어느 색으로 바꾸나요?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': '요청 편집기',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': '전송 ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': '실행기 실행',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ HTTP 응답 받음',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': '어떤 상태 코드든 인정',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Not Found',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Server Error',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': '중단됨',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': '오프라인 / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': '알약 → 초록',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': '알약 → 노랑',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ 응답 없음',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': '네트워크 수준 실패',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    '500 응답도 “초록”입니다. 요청은 완료되었고, 다만 500 응답을 받았을 뿐입니다.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    '요청 실행기 범위. 전송 버튼 요청만 알약을 갱신합니다. 라이브 워크플로 새로 고침은 조용하고, ' +
    '웹페이지 트래픽은 대신 규칙 엔진을 씁니다.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': '무엇이 요청 알약을 갱신하나요?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': '요청 편집기의 전송 ▸',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': '라이브 워크플로 새로 고침',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': '웹페이지 fetch / XHR',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': '사용자가 시작',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': '백그라운드 틱',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': '규칙 엔진이 관찰',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': '알약 갱신',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': '다른 시스템',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': '갱신 없음',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer': '전송 버튼으로 보낸 임시 트래픽만 이 알약을 바꿉니다.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    '같은 규칙, 두 권한 상태. all_urls 권한이 부여되면 DNR 규칙이 실행됩니다. 호스트 권한이 취소되면 규칙은 ' +
    '조용히 무동작이고 헤더가 절대 도착하지 않습니다.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': '같은 규칙, 두 권한 상태',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': '부여됨',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': '축소됨',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': '호스트 권한 취소됨',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': '헤더 추가',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': '페이지',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': '적용됨',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': '무동작',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ 헤더 도착',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ 헤더 누락',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': '규칙 실행됨',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': '조용한 무동작',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    '축소된 호스트는 오류를 내지 않습니다. 규칙이 조용히 아무것도 하지 않을 뿐입니다.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    '접근을 복원할 때까지 알약의 빨강이 유일한 단서입니다.',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    '감사가 언제 실행되고 각 결과가 어느 상태 수준을 보고하는지.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title': '감사는 언제 실행되고, 각 분기는 무엇을 보고하나요?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': '첫 하이드레이션',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': '정상 경로',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': '사용자가 호스트 권한을 취소함',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API 기능 사용 불가',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': '예외 발생',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '“모두 부여됨”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '“호스트 축소됨”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '“감사 실패”',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1': 'MV3 규격에는 권한 변경 관찰자가 없습니다.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2': 'SW 웨이크마다 재확인이 실행됩니다.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Vault 하이드레이션. vault 블롭이 저장소에서 로드되고, 모든 항목이 스키마를 거칩니다. 일치하는 항목은 남기고, ' +
    '드리프트 항목은 버리고 노랑으로 보고합니다.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'SW 웨이크 시 Vault 하이드레이트',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (암호화된 블롭)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': '스키마 검증기',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': '스키마 일치',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': '드리프트: 옛 형태',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ 유지됨',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ 버려짐',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': '시크릿 · 노랑',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': '유지된 항목',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': '깨끗하게 하이드레이트',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    '스키마 드리프트가 실제로 어떤 모습인지. 유효한 항목에는 uid, label, cipher 필드가 있고, 드리프트 항목은 ' +
    'cipher 필드가 빠져 있을 수 있습니다. 검증기가 잘못된 행을 버리고 노랑 상태를 냅니다.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': '“스키마 드리프트”의 실제 모습',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': '유효한 항목',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': '드리프트 항목',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'API token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': '옛 토큰',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— 없음 —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': '스키마 문제 2건 → 버려짐',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    '드리프트 항목은 하이드레이트 시 버려지고 알약이 노랑으로 바뀝니다.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Vault 편집기에서 다시 저장하면 항목이 현재 형태로 복원됩니다.',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    '라이브 워크플로의 상태별 규칙 (최신, 오래됨 / 흔들림, 실패 중) 을 실제 문턱값에 맞춰 보여 줍니다.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': '워크플로별 상태 규칙',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': '최신',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': '오래됨 / 흔들림',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': '실패 중',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh': '마지막 실행 OK · 주기의 2배 이내 · 실패 0회',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': '주기의 2배 경과  · 또는  연속 실패 1–4회',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '연속 실패 5회 이상',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': '예: 새로 고침마다 200 응답',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': '예: 시간 초과 한 번, 재시도 중',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': '예: API 서비스가 한 시간째 다운',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer': '주기 = 워크플로에 설정한 새로 고침 간격.',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    '라이브 알약 집계. 활성 워크스페이스의 워크플로 셋이 max() 함수로 종합 하나에 접히고, 비활성 ' +
    '워크스페이스의 워크플로는 제외됩니다.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title': '활성 워크스페이스의 워크플로가 알약 하나에 접힙니다',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': '활성 워크스페이스',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': '알약에 기여',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': '최신',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '연속 실패 2회',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': '다른 워크스페이스',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': '의도적으로 제외',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ 사용자가 손댈 수 없으므로 건너뜀',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': '라이브 알약',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = 노랑',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1': '최악 상태의 워크플로 하나가 알약 전체를 뒤집습니다.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    '워크스페이스를 전환하면 알약이 그 워크스페이스의 실행을 기준으로 다시 계산됩니다.',

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': '동급 최고',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': '지금',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': '로드맵',
  'workbench.docs.diagrams.openHeaders.shared.supports': '지원',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': '브라우저 내',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': '데스크톱 앱',
  'workbench.docs.diagrams.openHeaders.shared.localServer': '로컬 서버',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': '내 VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': '곧',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    '패러다임 전환. Open Headers 확장 프로그램과 이 분야의 다른 모든 도구를 묶어 대비합니다. 모든 것이 ' +
    '브라우저 확장 프로그램 하나 안에, 계정 없음, 로컬 전용, 추적 없음, 규칙 유형 아홉에 엔진 하나, 필드 수준 동기화, ' +
    '기능 제한 없는 완전한 무료 티어, 시트 기반 가격, 만료돼도 잠기지 않음. 시장의 나머지와 ' +
    '대비합니다.',
  'workbench.docs.diagrams.openHeaders.shift.title': '패러다임 전환',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': '다른 모든 도구',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': '아키텍처와 도달 범위',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': '프라이버시와 소유권',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': '기능',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': '동기화와 복원력',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': '가격과 신뢰',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': '유일',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': '사용자 통제',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': '기능 제한 없음',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': '모든 것이 브라우저 안에',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': '백엔드 + 프런트엔드',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- 확장 프로그램 안에',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': '백엔드는 브라우저 밖에',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': '데스크톱 앱 / 클라우드, 인터넷 필요',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': '백엔드 직접 호스팅',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': '브라우저 · 데스크톱 앱 · 서버 · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': '그들의 클라우드만',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': '데이터가 어디 사는지 선택권 없음',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': '프런트엔드가 원래부터 오프라인 동작',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': '확장 프로그램 · 데스크톱 · CLI · 웹',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': '클라우드 전용 프런트엔드 (온라인)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': '백엔드 접근에 인터넷 필요',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': '계정 없음',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': '로그인 없음, 로그인 장벽 없음',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': '로그인 필수',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': '내 데이터를 쓰는 데도',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': '로컬 전용',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': '클라우드 중계 없음',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': '클라우드 중계',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': '내 트래픽이 그들을 거침',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': '추적 없음',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': '익명 집계 · 스위치 하나로 끔',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': '기본으로 추적',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': '사용 데이터를 본사로 전송',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': '규칙 엔진',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': '요청 가로채기와 수정',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': '브라우저 내 엔진 없음',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': '별도 프록시나 앱 필요',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'API 요청 카탈로그',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL 모두 브라우저 안에서',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': '플랫폼에 로그인하고',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': '그들의 앱을 설치',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': '워크스페이스 자동화',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': '내 AI 에이전트, 로컬이든 원격이든',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- 내가 정함',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': '비공개 또는 그들의 클라우드 AI 서비스만',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': '개방적이거나 프로그래밍 가능한 접근 없음',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': '실시간 동기화 엔진',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': '다중 기기, 브라우저, 화면',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': '마지막 쓰기가 이김',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': '또는 동기화 자체가 없음',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': '충돌 없는 동시 저장',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': '필드 수준, 모든 변경이 커밋됨',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': '항목 수준 덮어쓰기',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': '저장이 서로를 지울 수 있음',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': '오프라인에서도 완전히 편집 가능',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': '돌아오면 자동으로 동기화',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': '온라인 연결 필요',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': '아니면 접근 자체가 불가',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': '오늘 모든 것을, 모든 티어에서',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': '무료: 6명 이하 · 유료 = 팀 시트',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': '기능이 제한된 티어',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': '핵심 기능이 업셀 뒤에',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO 인증과 보안은 항상 무료',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · 감사 · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'SSO 세금',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': '보안을 엔터프라이즈 추가 기능으로 판매',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': '만료돼도 절대 잠기지 않음',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': '유예, 그다음 무료 티어. 데이터는 내 것',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': '결제를 멈추면 접근을 잃음',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': '내 데이터 위의 유료 장벽',
  'workbench.docs.diagrams.openHeaders.shift.footer': '로컬 우선. 설계부터. 나중에 덧붙인 것이 아닙니다.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'API 요청 카탈로그. 메서드 선택기, URL 표시줄, 탭 띠, 본문 미리 보기를 담은 양식화된 요청 편집기 ' +
    '목업과, 프로토콜, 인증, 스크립트, 변수, 파일, 컬렉션, 쿠키를 아우르는 기능 ' +
    '띠입니다.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'API 요청 카탈로그',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    '완전한 요청 작성, 전송, 컬렉션 관리를 확장 프로그램 안에서.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': '전송 ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': '인가',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': '헤더',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': '본문',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': '스크립트',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': '설정',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': '인증',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API Key',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': '스크립트',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': '요청 전 + 응답 후',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': '변수',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '범위 5개 · 구조화된 진단',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': '파일',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · {{file.X}} 해석',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': '컬렉션',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': '폴더 · 환경 · 요청별',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': '쿠키',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': '옵트인 credentialsMode',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    '데스크톱 API 클라이언트가 제공하는 모든 것을 확장 프로그램 안에서',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': '완전한 API 플랫폼, 플랫폼 없이.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Open Headers 규칙 엔진. 실행 경로 둘 (DNR 네이티브와 스크립트 기반 가로채기), 엔진별로 묶은 규칙 유형 ' +
    '범주 아홉, 그리고 모든 규칙이 읽는 공통 조건 언어와 변수 범위 ' +
    '사슬입니다.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': '규칙 엔진',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'MV3 네이티브 · 엔진 둘 · 규칙 범주 아홉',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · 네이티브',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · 가로채기',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': '헤더',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': '재정의 · 덧붙이기 · 제거',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': '차단',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': '네트워크 계층에서 취소',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': '리디렉션',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': '정적 URL 주소 또는 정규식',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': '쿼리 매개변수',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': '추가 · 바꾸기 · 제거 · 모두 제거',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': '헤더 (병합)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': '값 이어 붙이기',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': '삽입',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS 또는 CSS, 시점 둘',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': '지연',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': '탐색 + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': '요청 본문',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': '정적 · 동적 · GraphQL 필터',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': '응답 본문',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': '본문 + 상태 + 헤더',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': '브라우저가 발행하는 모든 요청을 잡음',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'JS 코드가 시작한 fetch / XHR 요청을 잡음',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': '조건 언어 하나',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    '요청 도메인 · URL 패턴 · URL 정규식 · 메서드 · 리소스 · 발신자 · 헤더 · 도메인 종류',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': '변수 범위 다섯',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    '엔진 하나. 실행 경로 둘. 완전한 조건 + 변수 언어. 확장 프로그램 안에서.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    '기존 제품 범주 셋 (데스크톱 프록시, 클라우드 API 플랫폼, 헤더 전용 확장 프로그램) 이 Open Headers 브라우저 ' +
    '확장 프로그램 하나로 수렴합니다. 양식화된 Chromium 브라우저에 확장 프로그램의 워크벤치 페이지가 열려 있고, ' +
    '기존 세 범주가 제공하던 모든 기능이 그 탭 하나 안에 삽니다.',
  'workbench.docs.diagrams.openHeaders.convergence.title': '도구 범주 셋. 확장 프로그램 하나.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    '예전에는 별도 설치 셋이 필요하던 것이 이제 브라우저 탭 하나에 삽니다.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': '데스크톱 프록시',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub': 'HTTP 가로채기 · CA 인증서 · 별도 바이너리',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'API 플랫폼',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub': '요청 + 컬렉션 · 클라우드 호스팅 · 계정',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': '헤더 확장 프로그램',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub': '규칙 유형 하나 · 스크립트 없음 · 인증 없음',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ 모두 탭 하나에 열림',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': '워크벤치 화면',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'MV3 네이티브',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': '규칙 엔진',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'API 요청 카탈로그',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': '실시간 동기화 엔진',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': '충돌 없는 저장',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': '계정 없음 · 로그인 없음',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': '로컬 전용 · 클라우드 중계 없음',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': '추적 없음 · 개인 데이터 없음',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': '다중 화면 UI',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip': '다중 화면 · 기기 간 동기화 · 설계부터 로컬 전용',
  'workbench.docs.diagrams.openHeaders.convergence.caption': '파랑 = 기능 · 보라 = 자세 · 여덟 모두 탭 하나 안에',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    '두 화면이 같은 규칙을 동시에 편집합니다. DevTools 창은 헤더를 추가, 수정, 제거하고, 워크벤치는 같은 ' +
    '규칙의 다른 필드 셋을 편집합니다. 여섯 편집 모두 배너나 덮어쓰기 없이 병합된 규칙에 ' +
    '반영됩니다.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': '두 화면, 같은 규칙, 양쪽 편집 모두 반영',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle': '필드별 동기화. 배너 없음, 덮어쓰기 없음, 잃는 작업 없음',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': '화면 A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': '화면 B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': '헤더 편집 중',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': '규칙 X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': '헤더',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': '동기화 엔진 · 필드별 병합',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': '병합된 스냅샷 · 헤더',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': '추가됨',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': '수정됨',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': '제거됨',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← 출처: ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ 양쪽 편집 모두 적용. 배너 없음, 충돌 없음',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    '같은 경로가 확장됩니다: 오늘은 확장 프로그램 → 내일은 확장 프로그램 + 데스크톱 + CLI',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    '프런트엔드 고르기: 데이터에 접근하고 관리하는 방법. 프런트엔드 형태 넷이 세로로 쌓입니다: ' +
    '브라우저 확장 프로그램, 데스크톱 앱, CLI 앱, 웹 앱. 각 카드는 노출하는 화면, 연결할 수 있는 백엔드 ' +
    '(첫 칩이 기본), 실행되는 플랫폼을 나열합니다.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': '프런트엔드 고르기: 데이터에 접근하고 관리하는 방법',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    '같은 데이터, 어떤 프런트엔드든. 하나를 고르거나 모두 쓰거나, 모든 화면이 동기화됩니다.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': '브라우저 확장 프로그램',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': '브라우저 안에서',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': '네이티브 창',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': '명령줄',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': '웹 앱',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': '브라우저 탭',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': '사이드 패널',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': '명령줄',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': '내장',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': '화면',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': '연결하는 백엔드',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': '프런트엔드 하나를 고르든 모두 고르든, 같은 데이터입니다',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ 확장 프로그램 · ✓ 데스크톱 · ✓ CLI · ✓ 웹. 모두 같은 정본 항목을 읽습니다',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer': '같은 데이터, 어떤 방법으로 닿든. 모든 화면이 동기화됩니다.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    '백엔드 고르기: 데이터가 사는 곳. 호스팅 선택지 넷이 세로로 쌓입니다. 각 티어는 이전 티어의 모든 기능을 ' +
    '물려받고 새 기능을 더하며, 새 기능은 초록 점선 사각형으로 강조됩니다. 오른쪽 “지원” 열에는 ' +
    '각 티어가 실행되는 브라우저, 운영 체제, 클라우드 제공자가 나열됩니다. ' +
    '네 티어 모두 로컬 전용입니다.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': '백엔드 고르기: 데이터가 사는 곳',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    '각 티어는 이전 티어를 물려받습니다. 초록 상자가 새 기능, 오른쪽 열이 실행되는 곳입니다.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': '확장 프로그램 서비스 워커',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': '내장 백엔드',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': '독립 프로세스',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': '어디든 호스팅',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': '설정 없음',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': '기기 하나',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': '브라우저별 인스턴스',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': '다중 화면 동시 편집',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': '다중 창 동시 편집',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'localhost 전용',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': '다중 브라우저 인스턴스',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': '앱별 인스턴스',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': '네이티브 파일 시스템',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': '디스크의 YAML 파일',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'git 통합 (로컬/원격)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': '최소 설정',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'LAN 도달 가능',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': '다중 앱 인스턴스',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': '여러 기기',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': '브라우저 확장 · 데스크톱 앱 · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': '표준 설정',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'WAN/인터넷 도달 가능',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': '팀 준비 완료',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'SSO 인증',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'RBAC 사용자 관리',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': '감사 로그와 보고서',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': '모든 OS',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': '내장',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': '하이퍼스케일러',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'EU 네이티브',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': '기타',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': '엔터프라이즈',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': '미니 PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': '홈 서버',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': '오래된 노트북',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': '내 클라우드',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': '온프레미스',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': '{tier}에서 상속',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ 이 티어의 새 기능',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': '무엇을 고르든 처음부터 끝까지 내 것입니다',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ 계정 없음 · ✓ 클라우드 중계 없음 · ✓ 추적 없음 · ✓ 개인 데이터 없음',
  'workbench.docs.diagrams.openHeaders.localFirst.footer': '내 데이터, 내 백엔드, 내 선택. 모든 단계에서.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'SaaS API 플랫폼, 데스크톱 프록시, 헤더 전용 확장 프로그램을 Open Headers 확장 프로그램과 비교하는 ' +
    '범주 카드 넷.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'Open Headers 확장 프로그램의 자리',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'SaaS API 플랫폼',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': '데스크톱 프록시',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': '헤더 전용 확장 프로그램',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': '클라우드',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': '네이티브',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': '라이트',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': '우리',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': '내 데이터가 그들의 서버에 삶',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': '계정 + 로그인 필수',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': '폭넓은 기능',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': '설치하고 실행할 별도 바이너리',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'CA 인증서 + 앱별 프록시 설정',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': '모든 종류의 트래픽을 봄',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': '브라우저 안, 설정 없음',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': '규칙 유형 하나: 헤더만',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': '스크립트 없음, 인증 없음, 본문 편집 없음',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': '브라우저 안 · 로컬 전용 · 계정 없음',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': '규칙 유형 아홉 · 조건 언어 하나',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': '스크립트 + OAuth + 파일을 확장 프로그램 안에서',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': '화면 넷이 저장소 하나를 공유',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    '클라우드 API 플랫폼과 비교. 클라우드 플랫폼은 자격 증명, 규칙 정의, 요청 로그를 공급자 서버에 ' +
    '둡니다. Open Headers 확장 프로그램은 셋 모두를 사용자의 기기에 둡니다.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': '데이터가 끝내 머무는 곳',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle': '자격 증명, 규칙 정의, 요청 로그. 로컬인가요, 원격인가요?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': '자격 증명',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': '규칙 정의',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': '요청 로그',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': '내 기기에',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': '공급자 서버에',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': '클라우드 API 플랫폼',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': '나',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': '내 데이터',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': '클라우드',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': '내 기기',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': '자격 증명 · 규칙 · 로그',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': '모두 한곳에',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': '내 데이터는 내 컴퓨터를 절대 떠나지 않습니다',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    '헤더 전용 확장 프로그램과 비교. 헤더 전용 확장 프로그램은 규칙 유형 하나를 다룹니다. Open Headers 확장 프로그램은 아홉을 다룹니다: 헤더, ' +
    '차단, 리디렉션, 쿼리 매개변수, 헤더 병합, 삽입, 지연, 요청 본문, 응답 본문.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': '규칙 유형이 몇 개인가',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    '한 가지를 하는 도구 하나, 아니면 아홉 가지를 하는 도구 하나.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': '헤더 전용 확장 프로그램',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': '헤더',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': '재정의',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': '차단',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': '취소',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': '리디렉션',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': '정적 / 정규식',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': '쿼리',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': '추가 · 제거',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': '병합',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': '헤더 ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': '삽입',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': '지연',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': '탐색 / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': '요청 본문',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': '정적 · 동적',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': '응답 본문',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': '본문 / 상태',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft':
    '나머지 8개 중 하나라도 필요한가요? 다른 확장 프로그램을 설치해야 합니다',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight': '같은 조건, 같은 화면, 워크스페이스 하나',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict': '규칙 유형 아홉, 조건 언어 하나, 관찰 가능한 화면 하나',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    '데스크톱 프록시와 비교. 프록시는 CA 인증서 뒤의 별도 프로세스로 트래픽을 우회시킵니다. Open Headers 확장 프로그램은 ' +
    '브라우저의 네이티브 API 기능으로 규칙을 인라인 적용합니다. 프록시 포트도, 인증서도 없습니다.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': '요청이 다듬어지는 방식',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    '브라우저 안의 인라인 규칙. 프록시 포트 없음, CA 인증서 없음, 앱별 설정 없음.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': '데스크톱 프록시',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': '우회',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': '인라인',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': '앱',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': '설정됨',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': '프록시 포트',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': '프록시',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'CA 인증서',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': '인터넷',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': '브라우저',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': '바이너리 설치',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'CA 인증서 설치',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': '앱별 설정',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': '확장 프로그램 설치',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': '그게 전부',
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict': '설치 하나 · 인증서 없음 · 규칙은 페이지 자체 권한으로 실행',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    '로드맵 이정표: CLI. 규칙 나열, 환경 전환, 저장된 요청 전송 예시 명령을 보여 주는 터미널 창. ' +
    '모두 UI 화면과 같은 서버에 말합니다.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · 헤드리스 스크립팅',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'UI 화면과 같은 서버. 자동화가 눈에 보이는 것과 동기화된 채 유지됩니다.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · 터미널',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# UI 화면과 같은 서버 · 같은 워크스페이스',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict': '나열 · 전환 · 전송 · 비교. 셸에서 곧바로',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    '로드맵 이정표: 로컬 / LAN 서버. 가운데에 서버가 있고, 확장 프로그램, 데스크톱 앱, CLI 도구가 모두 ' +
    'LAN 너머에서 클라이언트로 연결합니다.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': '로컬 / LAN 서버 · 동기화 허브 하나',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    '확장 프로그램 · 데스크톱 · CLI. 모두 같은 서버의 클라이언트, 모두 내 네트워크 안에.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': '워크스페이스',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': '규칙 · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': '동기화 엔진',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'LAN 도달 가능',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': '브라우저 확장',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': '노트북',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': '워크스테이션',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · 다중 창',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': '어느 컴퓨터든 · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': '서버 하나 · 클라이언트 여럿 · 내 네트워크 안에',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    '로드맵 이정표: 데스크톱 앱. 브라우저 확장 프로그램과 네이티브 데스크톱 앱 둘 다 같은 디스크 저장소 위에서 ' +
    '워크벤치 화면을 노출합니다. 데스크톱 앱은 브라우저 확장 프로그램이 네이티브로 호스팅할 수 없는 프로토콜을 더합니다: AI, ' +
    'MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': '네이티브 창 · 같은 저장소 · 더 넓은 도달 범위',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    '같은 워크벤치, 같은 워크스페이스. 데스크톱이 브라우저가 호스팅할 수 없는 프로토콜을 더합니다.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': '브라우저 확장 프로그램',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': '지금',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': '화면',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': '기능',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'API 카탈로그',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': '브라우저 인터셉터',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': '변수',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': '워크플로',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'API 카탈로그',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': '로컬 / 원격',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ 데스크톱 전용',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': '넷 모두 브라우저에서 가능합니다.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': '같은 디스크 워크스페이스 저장소',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    '워크스페이스 하나, 프런트엔드 둘, 브라우저가 못 가는 곳까지 더 넓은 도달 범위',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    '로드맵 이정표: Git 기반 팀 워크스페이스. 기기 둘이 각각 워크스페이스를 가지고, 둘 다 공유 Git 저장소로 푸시하고 ' +
    '거기서 풀합니다. 저장소가 동기화 계층이며 가운데에 공급자 서버는 없습니다.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Git 저장소로서의 워크스페이스',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    '풀은 동기화 · 푸시는 공유 · 병합은 Git 도구로. 공급자 서버 없음.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': '기기 A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': '기기 B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': '워크스페이스',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': '규칙 · 환경 · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': '내 데이터, 내 저장소, 감사 가능한 내 이력',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    '가져오기. 원본 형식 여섯 (cURL, HAR 헤더, Postman, HAR 전체 요청, Insomnia, OpenAPI) 이 Open Headers 워크스페이스 ' +
    '하나로 모입니다. 모두 지금 살아 있습니다.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': '가져오기 · 컬렉션을 그대로 옮기기',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, HAR 전체 요청. 모두 지금 살아 있습니다.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': '헤더',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Postman 컬렉션',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR (전체 요청)',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Insomnia 컬렉션',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'OpenAPI 사양',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': '지금',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': '다음',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': '워크스페이스',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': '가져오는 곳',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': '브라우저 인터셉터',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'API 요청 컬렉션',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': '환경',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Vault 항목',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict': '한 단계로 옮기고 계속 작업하세요',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    '로드맵 이정표: MCP 서버 아키텍처. AI 클라이언트가 Model Context Protocol (로컬은 stdio, 원격은 HTTP/SSE) 로 ' +
    'Open Headers 확장 프로그램에 연결합니다. OH MCP 서버가 사용자의 워크스페이스를 바꾸고, 결과가 ' +
    '워크벤치에 나타납니다.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'MCP 서버 · 내 워크스페이스, 어떤 AI 클라이언트든',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers 확장 프로그램은 Model Context Protocol 규격을 말합니다. MCP 규격을 지원하는 어떤 에이전트든 워크스페이스를 움직일 수 있습니다.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'AI 클라이언트',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': '내 에이전트',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': '어떤 MCP 클라이언트든',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'OH MCP 서버',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': '노출',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': '규칙 · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'API 요청',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': '환경',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': '변수 · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': '워크플로',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': '로컬',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': '원격',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': '변경',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': '워크벤치 · 내 워크스페이스',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': '라이브',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': '규칙 · 환경 · 변수 · 워크플로 · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    '어떤 AI 에이전트로든 워크스페이스를 움직이세요 · 로컬이든 원격이든',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    '로드맵 이정표: MCP 서버 도구 카탈로그. 도메인 일곱이 도구 {n}개를 노출합니다: 규칙, 요청, ' +
    '환경, 변수, 워크플로, 워크스페이스, 활동.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'AI 에이전트가 할 수 있는 일',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    '도메인 일곱. 말이 되는 곳에는 완전한 CRUD, 아닌 곳에는 범위를 한정한 읽기 전용.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': '규칙',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': '헤더 · 차단 · 리디렉션 · 응답',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': '요청',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'API 카탈로그',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': '환경',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': '워크스페이스별',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': '변수',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': '모든 범위 · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': '워크플로',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': '연쇄 API 호출',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': '워크스페이스',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': '다중 워크스페이스',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '도구 {n}개',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '도구 1개',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': '활동',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    '변경 피드. 에이전트가 행동하기 전에 무엇이 바뀌었는지 봅니다',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict':
    '도구 {n}개 · 도메인 일곱 · Open Headers 확장 프로그램의 전체 화면',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    '이정표. 브라우저 창 프레임 안에 순서대로 놓인 카드: Git 워크스페이스, 데스크톱 앱, MCP 서버, 로컬 ' +
    '서버, CLI, 자체 호스팅 웹 앱, 가져오기. 모두 살아 있습니다.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': '모든 화면, 출시 완료',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    '순서대로 출시. 모든 이정표에서 로컬 전용이 제품으로 남았습니다.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': '라이브',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': '사용자 통제',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': 'Git 기반 워크스페이스 협업 (팀 준비 완료)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    '내가 통제하는 Git 저장소의 YAML 파일. 풀, 푸시, 병합은 Git 도구로.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    '같은 저장소 위의 네이티브 바이너리. 확장 프로그램이 닿지 못하는 곳에 닿습니다.',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'MCP 서버 (AI 에이전트 제어)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'MCP 규격 위의 Open Headers 확장 프로그램. AI 에이전트가 워크스페이스를 움직이게 하세요.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': '로컬 / LAN 서버',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    '내 컴퓨터나 LAN 안의 서버. 확장 프로그램, 데스크톱, CLI 도구가 클라이언트로.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli': '헤드리스 스크립팅과 CI. 나열, 전환, 전송을 셸에서.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': '자체 호스팅 VM 배포 + 웹 앱',
  'workbench.docs.diagrams.openHeaders.milestones.descVm': '내 VM 위의 웹 번들. 잠긴 브라우저나 브랜드 배포용.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': '더 많은 가져오기',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Postman 너머로. Insomnia, OpenAPI 사양, HAR 전체 가져오기.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    '사용자 간 동기화는 Git 저장소와 자체 호스팅 배포로 제공됩니다. 공급자 호스팅 클라우드는 없습니다.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    '로드맵 이정표: 자체 호스팅 웹 앱. 내 출처가 같은 UI 번들을 제공하고, 사용자는 내가 통제하는 도메인의 브라우저 ' +
    '탭으로 엽니다. 같은 워크벤치 화면, 확장 프로그램 불필요.',
  'workbench.docs.diagrams.openHeaders.webApp.title': '자체 호스팅 VM 배포 + 웹 앱',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    '내 VM 환경이 웹 번들을 제공합니다. 내 출처, 내 도메인, 내 사용자.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': '제공',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': '확장 프로그램 + 데스크톱과 같은 화면',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': '같은 UI · 내 출처 · 확장 프로그램 불필요',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': '규칙',
  'workbench.docs.diagrams.shared.useCasesKicker': '흔한 용도',
  'workbench.docs.diagrams.shared.wontFireKicker': '실행되지 않을 때',
  'workbench.docs.diagrams.shared.suggestion': '제안',
  'workbench.docs.diagrams.shared.beforeKicker': '적용 전',
  'workbench.docs.diagrams.shared.afterKicker': '적용 후',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    '차단은 일치하는 요청을 네트워크 계층에서 취소하며 페이지는 네트워크 오류를 봅니다. main_frame 차단은 ' +
    'ERR_BLOCKED_BY_CLIENT 페이지를 렌더링하고, 하위 리소스 차단은 조용히 실패합니다.',
  'workbench.docs.diagrams.block.rule': '차단 · 요청 도메인: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': '페이지',
  'workbench.docs.diagrams.block.dnrBlock': 'DNR 차단',
  'workbench.docs.diagrams.block.network': '네트워크',
  'workbench.docs.diagrams.block.neverReached': '도달하지 않음',
  'workbench.docs.diagrams.block.requestCancelled': '요청 취소됨',
  'workbench.docs.diagrams.block.pageSeesKicker': '페이지가 보는 것',
  'workbench.docs.diagrams.block.chromeBlockPage': 'Chrome 브라우저의 차단 페이지',
  'workbench.docs.diagrams.block.silentFailure': '조용한 실패',
  'workbench.docs.diagrams.block.pageHandlesError': '페이지가 자기 오류를 처리',
  'workbench.docs.diagrams.block.useCasesAria':
    '차단의 흔한 용도: 광고와 추적기, 장애 시뮬레이션, 엔드포인트 거부, 페이지만 차단.',
  'workbench.docs.diagrams.block.card1Title': '광고와 추적기',
  'workbench.docs.diagrams.block.card1Example': 'ads.openheaders.com 차단',
  'workbench.docs.diagrams.block.card2Title': '장애 시뮬레이션',
  'workbench.docs.diagrams.block.card2Example': '테스트를 위해 호스트를 오프라인으로',
  'workbench.docs.diagrams.block.card3Title': '엔드포인트 거부',
  'workbench.docs.diagrams.block.card3Example': '/api/admin 경로만 차단',
  'workbench.docs.diagrams.block.card4Title': '페이지만 차단',
  'workbench.docs.diagrams.block.card4Example': 'main_frame 조건 추가',
  'workbench.docs.diagrams.block.useCasesFooter': '차단을 조건과 짝지어 범위를 좁히세요.',
  'workbench.docs.diagrams.block.wontApplyAria':
    '차단은 이미 로드된 리소스를 소급해서 취소하지 않습니다. 규칙을 켠 뒤 페이지를 다시 로드해 ' +
    '이후 요청을 잡으세요.',
  'workbench.docs.diagrams.block.alreadyLoaded': '이미 로드된 리소스',
  'workbench.docs.diagrams.block.alreadyLoadedSub': '이후 요청만 가로챕니다. 지난 것은 로드된 채 남습니다.',
  'workbench.docs.diagrams.block.suggestionText': '규칙을 켠 뒤 페이지를 다시 로드하세요.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    '정적 리디렉션. 일치하는 모든 요청이 같은 대상 URL 주소로 다시 쓰입니다.',
  'workbench.docs.diagrams.redirect.ruleStatic': '리디렉션 → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': '원래 요청',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL 주소 다시 씀',
  'workbench.docs.diagrams.redirect.redirectedToKicker': '리디렉션 대상',
  'workbench.docs.diagrams.redirect.staticStamp': '모든 일치 → 같은 대상 URL 주소.',
  'workbench.docs.diagrams.redirect.staticStampSub': '브라우저는 서버가 리디렉션을 돌려준 것처럼 탐색합니다.',
  'workbench.docs.diagrams.redirect.regexAria':
    '정규식 리디렉션. URL 패턴의 캡처 그룹을 대상 URL 주소에서 \\1, \\2 형식으로 참조합니다.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': '리디렉션 → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': '원래 URL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 치환됨',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 참조는 캡처 그룹이 일치한 것을 그대로 물려받습니다.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    '리디렉션의 흔한 용도: HTTP → HTTPS 업그레이드, 도메인 이전, 경로 다시 쓰기, 로컬 개발 프록시.',
  'workbench.docs.diagrams.redirect.card1Example': '모든 http 주소를 https 주소로 강제',
  'workbench.docs.diagrams.redirect.card2Title': '도메인 이전',
  'workbench.docs.diagrams.redirect.card3Title': '경로 다시 쓰기',
  'workbench.docs.diagrams.redirect.card4Title': '로컬 개발 프록시',
  'workbench.docs.diagrams.redirect.useCasesFooter': '경로를 보존하는 다시 쓰기에는 역참조와 함께 URL 정규식을 쓰세요.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    '리디렉션은 이미 로드된 페이지에 소급 적용되지 않으며, 무한 순환을 막기 위해 Chrome 브라우저가 리디렉션 루프에 ' +
    '상한을 둡니다.',
  'workbench.docs.diagrams.redirect.pageLoaded': '이미 로드된 페이지',
  'workbench.docs.diagrams.redirect.pageLoadedSub': '이후 탐색과 fetch 호출만 가로챕니다.',
  'workbench.docs.diagrams.redirect.loops': '리디렉션 루프',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome 브라우저가 상한을 둡니다: ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': '다시 로드하세요. 조건이 순환하지 않는지 확인하세요.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    '삽입 시점. 가능한 한 빨리는 페이지 스크립트 전에 실행되고, 페이지 로드 후는 DOM 파싱이 끝나면 실행됩니다.',
  'workbench.docs.diagrams.inject.timeAxis': '시간 →',
  'workbench.docs.diagrams.inject.navigation': '탐색',
  'workbench.docs.diagrams.inject.domParsed': 'DOM 파싱 완료',
  'workbench.docs.diagrams.inject.loadEvent': 'load 이벤트',
  'workbench.docs.diagrams.inject.asap': '가능한 한 빨리',
  'workbench.docs.diagrams.inject.prePageScript': '페이지 스크립트 전',
  'workbench.docs.diagrams.inject.afterLoad': '페이지 로드 후',
  'workbench.docs.diagrams.inject.domSafe': 'DOM 안전',
  'workbench.docs.diagrams.inject.timingFooter': '경쟁에는 가능한 한 빨리 · DOM 작업에는 페이지 로드 후',
  'workbench.docs.diagrams.inject.scriptAria':
    '스크립트 삽입. JavaScript 코드가 페이지 안에서 가능한 한 빨리 (페이지 스크립트 전) 또는 페이지 로드 후 (DOM 안전) 실행됩니다.',
  'workbench.docs.diagrams.inject.ruleScript': '스크립트 (가능한 한 빨리): fetch 함수를 감싸 모든 호출 기록',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // 확장 프로그램이 삽입',
  'workbench.docs.diagrams.inject.runsInPage': '페이지 컨텍스트에서 실행됩니다. 페이지 JS 코드와 같은 전역을 봅니다.',
  'workbench.docs.diagrams.inject.scriptFooter':
    '가능한 한 빨리는 앱 코드보다 먼저 경쟁에서 이기고, 페이지 로드 후는 파싱된 DOM 트리를 읽습니다.',
  'workbench.docs.diagrams.inject.cssAria':
    'CSS 삽입. <style> 태그가 페이지의 head 요소에 덧붙여져 배너 요소를 숨깁니다.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': '규칙',
  'workbench.docs.diagrams.inject.ruleApplied2': '적용됨',
  'workbench.docs.diagrams.inject.hidden': '(숨김)',
  'workbench.docs.diagrams.inject.cssFooter': '<style> 태그로 삽입됩니다. 페이지 CSS 코드와 같은 CSS 명시도입니다.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    '삽입은 샌드박스 iframe 요소나 인라인 스크립트를 막는 엄격한 CSP 정책이 있는 페이지에는 적용되지 않습니다.',
  'workbench.docs.diagrams.inject.sandboxed': '샌드박스 iframe',
  'workbench.docs.diagrams.inject.sandboxedSub': '스크립트를 끄는 sandbox="" 속성이 있는 페이지.',
  'workbench.docs.diagrams.inject.strictCsp': "엄격한 CSP 정책 (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': '인라인으로 삽입한 스크립트가 페이지 정책에 막힙니다.',
  'workbench.docs.diagrams.inject.suggestionText': '부모 페이지에 삽입하고 iframe 요소로 postMessage 호출을 보내세요.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'JS / CSS 삽입의 흔한 용도: 몽키 패치, 다크 모드, 요소 숨기기, 기능 플래그.',
  'workbench.docs.diagrams.inject.card1Title': '몽키 패치',
  'workbench.docs.diagrams.inject.card1Example': 'fetch / XHR 감싸기 (가능한 한 빨리)',
  'workbench.docs.diagrams.inject.card2Title': '다크 모드',
  'workbench.docs.diagrams.inject.card2Example': 'CSS 테마 강제',
  'workbench.docs.diagrams.inject.card3Title': '노이즈 숨기기',
  'workbench.docs.diagrams.inject.card3Example': 'display: none 배너',
  'workbench.docs.diagrams.inject.card4Title': '기능 플래그',
  'workbench.docs.diagrams.inject.card4Example': 'window 플래그를 가능한 한 빨리 설정',
  'workbench.docs.diagrams.inject.useCasesFooter':
    '먼저 실행돼야 하는 코드에는 가능한 한 빨리를, DOM 읽기에는 페이지 로드 후를 쓰세요.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    '탐색, fetch, 하위 리소스 차선에 걸친 지연 라우팅. 앞의 둘만 가로채고 ' + '하위 리소스는 그대로 지나갑니다.',
  'workbench.docs.diagrams.delay.matchedRequest': '일치한 요청',
  'workbench.docs.diagrams.delay.document': '문서',
  'workbench.docs.diagrams.delay.documentSub': 'iframe 탐색',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': '대기 페이지 경유',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'JS 코드가 시작',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': '몽키 패치됨',
  'workbench.docs.diagrams.delay.subResource': '하위 리소스',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': '지연되지 않음',
  'workbench.docs.diagrams.delay.passesThrough': '그대로 지나감',
  'workbench.docs.diagrams.delay.routingFooter': '더 높은 상한에는 진짜 로컬 프록시가 필요합니다',
  'workbench.docs.diagrams.delay.navAria':
    '탐색 지연. 브라우저가 로컬 대기 페이지로 리디렉션되고, 그 페이지가 N ms 동안 붙잡았다가 ' +
    '실제 대상 URL 주소로 넘깁니다.',
  'workbench.docs.diagrams.delay.ruleNav': '지연 8,000 ms · 페이지 탐색',
  'workbench.docs.diagrams.delay.click': '클릭',
  'workbench.docs.diagrams.delay.waitingPage': '대기 페이지',
  'workbench.docs.diagrams.delay.holds8s': '⏱ 8초 붙잡음',
  'workbench.docs.diagrams.delay.loadsNow': '이제 로드',
  'workbench.docs.diagrams.delay.navStamp': '최대 30,000 ms 동안 지켜집니다. Chrome 브라우저의 리디렉션 한계입니다.',
  'workbench.docs.diagrams.delay.navStampSub': '로컬 대기 페이지로 가는 DNR 리디렉션으로 구현됩니다.',
  'workbench.docs.diagrams.delay.xhrAria':
    'JS 코드가 시작한 fetch/XHR 지연. 몽키 패치된 setTimeout 함수가 해석을 붙잡습니다. 5,000 ms 상한이 적용됩니다.',
  'workbench.docs.diagrams.delay.ruleXhr': '지연 3,000 ms · JS fetch / XHR',
  'workbench.docs.diagrams.delay.intercept': '가로채기',
  'workbench.docs.diagrams.delay.network': '네트워크',
  'workbench.docs.diagrams.delay.hold3000': '3,000 ms 붙잡음',
  'workbench.docs.diagrams.delay.realRequest': '실제 요청',
  'workbench.docs.diagrams.delay.responseDelayed': '응답 (3초 지연)',
  'workbench.docs.diagrams.delay.xhrStamp': '5,000 ms 상한이 적용됩니다. 그 위의 값은 전송선에서 잘립니다.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    '지연은 하위 리소스 (img/css/js) 나 페이지 수준 몽키 패치를 우회하는 서비스 워커 fetch 호출에는 ' +
    '적용되지 않습니다.',
  'workbench.docs.diagrams.delay.subResources': '하위 리소스 (img, css, js, 글꼴)',
  'workbench.docs.diagrams.delay.subResourcesSub': '브라우저가 발행합니다. 어떤 몽키 패치도 붙잡을 수 없습니다.',
  'workbench.docs.diagrams.delay.swFetches': '서비스 워커 fetch 호출',
  'workbench.docs.diagrams.delay.swFetchesSub': '다른 범위에서 실행됩니다. 페이지 수준 패치가 닿지 않습니다.',
  'workbench.docs.diagrams.delay.suggestionText': '하위 리소스 스로틀링은 곧 데스크톱 앱과 함께 제공됩니다.',
  'workbench.docs.diagrams.delay.useCasesAria':
    '지연의 흔한 용도: 로딩 상태 QA, 디바운스 테스트, 경쟁 조건 드러내기, 느린 네트워크 ' + '시뮬레이션.',
  'workbench.docs.diagrams.delay.card1Title': '로딩 상태',
  'workbench.docs.diagrams.delay.card1Example': '스피너를 확실히 보이기',
  'workbench.docs.diagrams.delay.card2Title': '디바운스 확인',
  'workbench.docs.diagrams.delay.card2Example': '입력 스로틀 테스트',
  'workbench.docs.diagrams.delay.card3Title': '경쟁 조건',
  'workbench.docs.diagrams.delay.card3Example': '요청 순서 드러내기',
  'workbench.docs.diagrams.delay.card4Title': '느린 네트워크 시뮬레이션',
  'workbench.docs.diagrams.delay.card4Example': '대략 3G 수준 지연',
  'workbench.docs.diagrams.delay.useCasesFooter':
    '정적 리소스에는 진짜 프록시가 필요합니다. 확장 프로그램은 붙잡을 수 없습니다.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': '추가 / 바꾸기 · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': '매개변수 추가 또는 바뀜',
  'workbench.docs.diagrams.queryParams.addStamp': '없으면 추가하고, 있으면 바꿉니다.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    '바꾸기만. 기존 쿼리 매개변수 값은 바꾸지만, 그 매개변수가 없는 URL 주소는 건드리지 않습니다.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': '바꾸기만 · region = eu',
  'workbench.docs.diagrams.queryParams.present': '있음',
  'workbench.docs.diagrams.queryParams.presentSub': '매개변수가 이미 있음',
  'workbench.docs.diagrams.queryParams.absent': '없음',
  'workbench.docs.diagrams.queryParams.absentSub': 'region 매개변수 없음',
  'workbench.docs.diagrams.queryParams.valueReplaced': '값 바뀜',
  'workbench.docs.diagrams.queryParams.unchanged': '그대로',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    '바꾸기만 하고 추가하지 않습니다. 매개변수가 없는 URL 주소는 그대로 지나갑니다.',
  'workbench.docs.diagrams.queryParams.ruleRemove': '제거 · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': '매개변수 떼어냄',
  'workbench.docs.diagrams.queryParams.removeStamp': '지정한 매개변수만 제거되고 나머지는 그대로 지나갑니다.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': '모두 제거',
  'workbench.docs.diagrams.queryParams.noQueryString': '(쿼리 문자열 없음)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': '쿼리 전체 떼어냄',
  'workbench.docs.diagrams.queryParams.removeAllStamp': '쿼리 문자열 전체가 한 번에 제거됩니다.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    '쿼리 매개변수의 함정. 모두 제거는 같은 규칙 안에서 추가/바꾸기와 결합할 수 없습니다.',
  'workbench.docs.diagrams.queryParams.watchForKicker': '주의할 점',
  'workbench.docs.diagrams.queryParams.combining': '모두 제거와 추가 / 바꾸기의 결합',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR 엔진은 쿼리 전체를 떼어내면서 새 매개변수를 추가하는 규칙을 거부합니다.',
  'workbench.docs.diagrams.queryParams.suggestionText': '규칙 둘을 쓰세요. 모두 제거 먼저, 그다음 추가 / 바꾸기.',
  'workbench.docs.diagrams.queryParams.suggestionSub': '규칙 순서가 중요하며, 둘 다 같은 요청에 일치해야 합니다.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    '쿼리 매개변수의 흔한 용도: 플래그 강제, 값 정규화, 추적기 떼어내기, 프라이버시 모드 전체 제거.',
  'workbench.docs.diagrams.queryParams.card1Title': '플래그 강제',
  'workbench.docs.diagrams.queryParams.card1Example': 'debug=true 추가',
  'workbench.docs.diagrams.queryParams.card2Title': '정규화',
  'workbench.docs.diagrams.queryParams.card2Example': 'region 값만 바꾸기',
  'workbench.docs.diagrams.queryParams.card3Title': '추적기 떼어내기',
  'workbench.docs.diagrams.queryParams.card3Example': 'utm_* 매개변수 제거',
  'workbench.docs.diagrams.queryParams.card4Title': '프라이버시 모드',
  'workbench.docs.diagrams.queryParams.card4Example': '모든 쿼리 떼어내기',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'URL 패턴이나 도메인 조건과 짝지어 특정 경로로 범위를 좁히세요.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    '요청 본문 가로채기 파이프라인. page.js 파일의 호출이 Script 엔진 가로채기로 들어와 ' +
    '정적 / 동적 / GraphQL 변환으로 갈라진 뒤 실제 네트워크로 나갑니다.',
  'workbench.docs.diagrams.requestBody.pageSub': 'fetch / XHR 호출',
  'workbench.docs.diagrams.requestBody.intercept': '가로채기',
  'workbench.docs.diagrams.requestBody.interceptSub': '확장 프로그램 몽키 패치',
  'workbench.docs.diagrams.requestBody.branchStatic': '정적',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': '본문을',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': '통째로 바꿈',
  'workbench.docs.diagrams.requestBody.branchDynamic': '동적',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': '수정된 본문',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': '작업 일치? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': '적용 : 건너뜀',
  'workbench.docs.diagrams.requestBody.realNetwork': '실제 네트워크',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': '원래 본문',
  'workbench.docs.diagrams.requestBody.bodySentKicker': '전송된 본문',
  'workbench.docs.diagrams.requestBody.ruleStatic': '정적 본문: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': '본문 통째로 치환',
  'workbench.docs.diagrams.requestBody.staticStamp': '본문 전체가 바뀝니다. 규칙은 원본을 들여다보지 않습니다.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': '동적 본문: fn(orig) → 스탬프',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn 함수가 읽고 다시 씀',
  'workbench.docs.diagrams.requestBody.dynamicArrow': '함수가 변환',
  'workbench.docs.diagrams.requestBody.dynamicStamp': '함수가 원본을 받아 새 본문을 돌려줍니다.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'GraphQL 필터. JSON 본문의 지정한 필드가 일치할 때만 규칙이 실행됩니다. 다른 작업은 건드리지 않고 ' + '지나갑니다.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName 같음 "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ 정적 본문 치환',
  'workbench.docs.diagrams.requestBody.match': '일치',
  'workbench.docs.diagrams.requestBody.noMatch': '불일치',
  'workbench.docs.diagrams.requestBody.noMatchSub': '그 밖의 모든 작업',
  'workbench.docs.diagrams.requestBody.ruleFires': '규칙 실행',
  'workbench.docs.diagrams.requestBody.passesThrough': '그대로 지나감',
  'workbench.docs.diagrams.requestBody.graphqlStamp': '필드 수준 필터. 일치하는 작업에만 적용됩니다.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    '필드가 빠졌거나 JSON 형식이 아닌 본문을 가진 요청은 규칙을 건너뜁니다.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    '본문 규칙은 본문이 있는, JS 코드가 시작한 fetch/XHR 요청에서만 실행됩니다. GET 및 HEAD 요청에는 바꿀 것이 ' +
    '없고, 정적 리소스는 Script 엔진 가로채기에 절대 들어오지 않습니다.',
  'workbench.docs.diagrams.requestBody.getHead': 'GET / HEAD 요청',
  'workbench.docs.diagrams.requestBody.getHeadSub': '규격상 본문이 없습니다. 바꿀 것이 없습니다.',
  'workbench.docs.diagrams.requestBody.staticResources': '정적 리소스 (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': '브라우저가 발행하며 fetch / XHR 경로를 거치지 않습니다.',
  'workbench.docs.diagrams.requestBody.suggestionText':
    '요청이 페이지 JS 코드에서 나온 POST/PUT/PATCH 메서드인지 확인하세요.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    '요청 본문의 흔한 용도: 테스트 픽스처, 메타데이터 스탬프, GraphQL 작업 모의, PII ' + '익명화.',
  'workbench.docs.diagrams.requestBody.card1Title': '테스트 픽스처',
  'workbench.docs.diagrams.requestBody.card1Example': '알려진 페이로드 강제',
  'workbench.docs.diagrams.requestBody.card2Title': '메타데이터 스탬프',
  'workbench.docs.diagrams.requestBody.card2Example': 'debug: true 추가',
  'workbench.docs.diagrams.requestBody.card3Title': 'GraphQL 작업',
  'workbench.docs.diagrams.requestBody.card3Example': 'operationName 하나 모의',
  'workbench.docs.diagrams.requestBody.card4Title': '재생 다듬기',
  'workbench.docs.diagrams.requestBody.card4Example': 'PII 필드 익명화',
  'workbench.docs.diagrams.requestBody.useCasesFooter':
    'Script 엔진 전용. JS 코드가 시작한 fetch / XHR 요청에 적용됩니다.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': '나중에',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    '디버그 모드는 푸터에 있습니다. 인라인 스위치로 켜고 끄며, 점과 레이블을 누르면 범위, 탭별 고정, ' +
    '연결된 탭 목록을 담은 팝오버가 열립니다.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': '디버그 모드는 푸터에 있습니다',
  'workbench.docs.diagrams.debugMode.surfaceCaption': '스위치로 켜고 끄기 · 점 + 레이블로 팝오버 열기.',
  'workbench.docs.diagrams.debugMode.debugMode': '디버그 모드',
  'workbench.docs.diagrams.debugMode.systemStatus': '시스템 상태',
  'workbench.docs.diagrams.debugMode.inspectLabel': '연결 대상',
  'workbench.docs.diagrams.debugMode.scopeBoth': '둘 다 ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': '이 브라우저 탭 포함',
  'workbench.docs.diagrams.debugMode.attachedTabs': '연결된 탭 (1)',
  'workbench.docs.diagrams.debugMode.tabRow': '탭 #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    '연결 집합은 도출됩니다: 고른 범위와 고정된 탭의 합집합을 마스터 스위치와 교집합한 것입니다. ' +
    '디버그 모드가 꺼져 있으면 아무것도 연결되지 않습니다.',
  'workbench.docs.diagrams.debugMode.scopeTitle': '무엇이 연결되나',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( 범위 ∪ 고정 ) ∩ 마스터 스위치',
  'workbench.docs.diagrams.debugMode.inspectBoth': '연결 대상: 둘 다',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools 창 ∪ 포커스된 탭',
  'workbench.docs.diagrams.debugMode.pinnedTab': '고정: 탭 #11',
  'workbench.docs.diagrams.debugMode.candidates': '후보',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ 디버그 켜짐',
  'workbench.docs.diagrams.debugMode.attached': '연결됨',
  'workbench.docs.diagrams.debugMode.attachedTab1': '탭 #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': '탭 #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': '디버그 꺼짐 → 범위가 무엇이든 아무것도 연결되지 않습니다.',
  'workbench.docs.diagrams.debugMode.scopeFooter2': '다시 연결은 여기서 다시 계산됩니다. 저장된 스냅샷이 아닙니다.',
  'workbench.docs.diagrams.debugMode.reachAria':
    '표준 모드는 페이지 fetch 및 XHR 요청에만 닿습니다. 연결된 디버그 모드 탭은 탐색, ' +
    '워커, 교차 출처 iframe 요소, 탭 환경에도 닿습니다.',
  'workbench.docs.diagrams.debugMode.reachTitle': '각 모드가 닿을 수 있는 것',
  'workbench.docs.diagrams.debugMode.standardMode': '표준 모드',
  'workbench.docs.diagrams.debugMode.rowFetch': '페이지 fetch / XHR',
  'workbench.docs.diagrams.debugMode.rowNavigations': '탐색',
  'workbench.docs.diagrams.debugMode.rowWorkers': '워커',
  'workbench.docs.diagrams.debugMode.rowIframes': '교차 출처 iframe',
  'workbench.docs.diagrams.debugMode.rowTabEnv': '탭 환경',
  'workbench.docs.diagrams.debugMode.bannerFree': '배너 없음',
  'workbench.docs.diagrams.debugMode.showsBanner': '배너 표시',
  'workbench.docs.diagrams.debugMode.statesAria':
    '점에는 상태 넷이 있습니다: 회색은 꺼짐, 초록은 켜지고 연결됨, 노랑은 배너가 닫혀 휴리스틱 방식으로 ' +
    '대체됨, 빨강은 탭 연결 실패.',
  'workbench.docs.diagrams.debugMode.statesTitle': '점 한눈에 보기',
  'workbench.docs.diagrams.debugMode.stateOff': '꺼짐',
  'workbench.docs.diagrams.debugMode.stateOffMsg': '디버그 모드 비활성',
  'workbench.docs.diagrams.debugMode.stateOn': '켜짐 · 탭 2개',
  'workbench.docs.diagrams.debugMode.stateOnMsg': '연결됨 · 정상',
  'workbench.docs.diagrams.debugMode.stateFellBack': '대체됨',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': '배너 닫힘 → 휴리스틱',
  'workbench.docs.diagrams.debugMode.stateFailed': '연결 실패',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': '프로토콜을 시작하지 못했습니다',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria': '모든 연결의 두 단계 (요청과 응답) 와 각각 캡처되는 필드.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': '모든 연결에는 두 단계가 있습니다',
  'workbench.docs.diagrams.requestTracking.phaseRequest': '요청',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': '페이지 → 네트워크',
  'workbench.docs.diagrams.requestTracking.outbound': '나감',
  'workbench.docs.diagrams.requestTracking.capMethod': '메서드',
  'workbench.docs.diagrams.requestTracking.capHeaders': '헤더',
  'workbench.docs.diagrams.requestTracking.capBody': '본문',
  'workbench.docs.diagrams.requestTracking.phaseResponse': '응답',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': '네트워크 → 페이지',
  'workbench.docs.diagrams.requestTracking.inbound': '들어옴',
  'workbench.docs.diagrams.requestTracking.capStatus': '상태 코드',
  'workbench.docs.diagrams.requestTracking.capTimings': '타이밍',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'HTTP 왕복마다',
  'workbench.docs.diagrams.requestTracking.capturedKicker': '캡처',
  'workbench.docs.diagrams.requestTracking.sameConnection': '같은 연결',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    '두 단계 모두 “이 페이지” 탭의 배지 개수에 데이터를 보탭니다.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    '시퀀스 다이어그램: 요청이 관찰되고, 일치하고, 기록된 뒤 팝업이 읽습니다',
  'workbench.docs.diagrams.requestTracking.pBrowser': '브라우저',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': '네트워크 스택',
  'workbench.docs.diagrams.requestTracking.pExtension': '확장 프로그램',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': '서비스 워커',
  'workbench.docs.diagrams.requestTracking.pPopup': '팝업',
  'workbench.docs.diagrams.requestTracking.pPopupSub': '“이 페이지” 탭',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (요청)',
  'workbench.docs.diagrams.requestTracking.noteMatch': '규칙과 대조',
  'workbench.docs.diagrams.requestTracking.noteRecord1': '기록 (규칙 + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': '리소스 유형)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (응답)',
  'workbench.docs.diagrams.requestTracking.noteResponse': '응답 단계 기록',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': '사용자가 팝업을 엶',
  'workbench.docs.diagrams.requestTracking.msgReadBack': '일치한 규칙 + 배지',
  'workbench.docs.diagrams.requestTracking.seqFooter': '기록은 실시간으로 일어나고, 팝업은 읽기만 합니다.',
  'workbench.docs.diagrams.requestTracking.uiAria': 'UI 구조. 접힌 배지가 일치한 요청 목록으로 펼쳐집니다',
  'workbench.docs.diagrams.requestTracking.uiTitle': '팝업의 규칙 행',
  'workbench.docs.diagrams.requestTracking.uiRule': '차단 ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': '배지 클릭',
  'workbench.docs.diagrams.requestTracking.matchedPattern': '일치: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': '타임스탬프 · URL · 리소스 유형 · 일치한 패턴',
  'workbench.docs.diagrams.requestTracking.legendBadge': '배지 개수 = 행 수',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    '리소스 유형 구조. 양식화된 페이지 목업에 각 Chrome ResourceType 값을 가리키는 설명선: Page, ' +
    'Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': '각 요청 종류는 ResourceType 값 하나에 대응합니다',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': '범례',
  'workbench.docs.diagrams.resourceTypes.footer': '각 항목은 1:1 대응입니다. 행 사이에 겹침이 없습니다.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    '흔한 한계. 수정된 헤더에 대한 DevTools 사각지대, fetch/XHR 요청만 보는 Script 엔진, ' +
    '페이지가 설정한 헤더만 보는 병합, Chrome 128 이상이 필요한 헤더 일치.',
  'workbench.docs.diagrams.limitations.gotchasKicker': '흔한 함정',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools 사각지대',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Network 탭에는',
  'workbench.docs.diagrams.limitations.devtoolsLine2': '원래 헤더가 보입니다.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Script 도달 범위',
  'workbench.docs.diagrams.limitations.scriptLine1': 'fetch / XHR 요청만.',
  'workbench.docs.diagrams.limitations.scriptLine2': '탐색도, 정적도 아님.',
  'workbench.docs.diagrams.limitations.mergeTitle': '병합 범위',
  'workbench.docs.diagrams.limitations.mergeLine1': '페이지 코드가 설정한',
  'workbench.docs.diagrams.limitations.mergeLine2': '헤더만 봅니다.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': '오래된 브라우저는',
  'workbench.docs.diagrams.limitations.chromeLine2': '헤더 일치를 건너뜁니다.',
  'workbench.docs.diagrams.limitations.seeCallout': '아래 설명을 보세요.',
  'workbench.docs.diagrams.limitations.footer': '각 함정은 영향을 받는 절에도 인라인으로 표시됩니다.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    '각 엔진이 요청 흐름을 가로채는 지점. JS 요청은 Script 엔진을 거쳐 DNR 엔진으로 가고, 정적 요청과 ' +
    '탐색은 Script 엔진을 건너뜁니다',
  'workbench.docs.diagrams.execution.stackTitle': '각 엔진이 가로채는 지점',
  'workbench.docs.diagrams.execution.stackJsLane': 'JS 코드가 시작',
  'workbench.docs.diagrams.execution.stackStaticLane': '정적 / 탐색',
  'workbench.docs.diagrams.execution.stackPageJs': '페이지 JS',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': '브라우저',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, 탐색 등',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Script 엔진',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': '몽키 패치',
  'workbench.docs.diagrams.execution.stackBypasses1': 'Script 엔진을',
  'workbench.docs.diagrams.execution.stackBypasses2': '우회',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'DNR 엔진',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'Chrome 네트워크. 모든 것을 잡음',
  'workbench.docs.diagrams.execution.stackNetwork': '네트워크',
  'workbench.docs.diagrams.execution.stackFooter':
    'DNR 엔진은 넓고, Script 엔진은 좁지만 응답 본문을 읽을 수 있습니다.',
  'workbench.docs.diagrams.execution.dnrAria':
    'DNR 엔진의 넓은 도달 범위. 브라우저가 가져오는 모든 리소스 유형이 가로채집니다',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR 엔진은 모든 종류의 요청을 잡습니다',
  'workbench.docs.diagrams.execution.dnrItemNav': '페이지 탐색',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': '하위 프레임',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': '스크립트',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': '스타일시트',
  'workbench.docs.diagrams.execution.dnrItemImages': '이미지',
  'workbench.docs.diagrams.execution.dnrItemFonts': '글꼴',
  'workbench.docs.diagrams.execution.dnrItemMedia': '미디어',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': '브라우저가 가져오는 모든 리소스 유형',
  'workbench.docs.diagrams.execution.reachAria': 'Script 엔진 도달 범위. 잡는 것과 우회하는 것',
  'workbench.docs.diagrams.execution.reachTitle': 'Script 엔진이 실제로 보는 것',
  'workbench.docs.diagrams.execution.reachCaught': '✓ 잡힘',
  'workbench.docs.diagrams.execution.reachCaughtSub': '엔진이 보는 것',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '(범위 안)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ 놓침',
  'workbench.docs.diagrams.execution.reachMissedSub': '완전히 우회',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': '페이지 탐색',
  'workbench.docs.diagrams.execution.reachBrowserInternal': '브라우저 내부',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon 등)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria': '직접 일치와 간접 일치. 같은 규칙, 페이지 컨텍스트 둘',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': '규칙',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': '요청 도메인: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': '직접',
  'workbench.docs.diagrams.directVsIndirect.directSub': '페이지 URL 주소 자체가 일치',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': '페이지',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': '페이지 + 같은 호스트의',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': '하위 리소스 추적',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': '배지:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': '직접',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': '간접',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': '간접',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': '하위 리소스만 일치',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': '일치하는',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': '하위 리소스만 추적',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': '규칙에 일치',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': '일치하지 않음',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    '정적은 네트워크를 완전히 건너뛰고, 동적은 먼저 네트워크에 갔다가 실제 응답을 변환합니다.',
  'workbench.docs.diagrams.mock.flowStatic': '정적',
  'workbench.docs.diagrams.mock.flowDynamic': '동적',
  'workbench.docs.diagrams.mock.flowIntercept': '가로채기',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(실제 네트워크에',
  'workbench.docs.diagrams.mock.flowNeverHit2': '가지 않음)',
  'workbench.docs.diagrams.mock.flowRealNetwork': '실제 네트워크',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': '실제 응답',
  'workbench.docs.diagrams.mock.flowSynthetic': '합성 본문',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': '페이지가 받음',
  'workbench.docs.diagrams.mock.staticRule': '정적 응답: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': '실제 네트워크',
  'workbench.docs.diagrams.mock.staticNever1': '(도달하지 않음)',
  'workbench.docs.diagrams.mock.staticNever2': '— 요청이 단락됨',
  'workbench.docs.diagrams.mock.pageReceivesKicker': '페이지가 받는 것',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': '합성 응답 제공',
  'workbench.docs.diagrams.mock.staticStamp': '고정된 본문 + 상태 + 헤더. 서버에는 절대 접속하지 않습니다.',
  'workbench.docs.diagrams.mock.dynamicRule': '동적 응답: PII 필드 가리기',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': '실제 응답',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[redacted]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(실제 응답) →',
  'workbench.docs.diagrams.mock.dynamicStamp': '실제 호출은 그대로 일어나고, 내 함수가 본문을 다시 씁니다.',
  'workbench.docs.diagrams.mock.wontAria':
    '모의는 JS 코드가 시작한 fetch / XHR 요청만 가로챕니다. 정적 리소스는 그대로 지나갑니다. 하위 리소스 픽스처에는 ' +
    '진짜 로컬 프록시를 쓰세요.',
  'workbench.docs.diagrams.mock.wontStatic': '정적 리소스 (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': '브라우저가 발행하며 fetch / XHR 경로를 거치지 않습니다.',
  'workbench.docs.diagrams.mock.wontNav': '페이지 탐색',
  'workbench.docs.diagrams.mock.wontNavSub': '최상위 HTML 문서 로드는 Script 엔진을 완전히 우회합니다.',
  'workbench.docs.diagrams.mock.suggestionText': '하위 리소스 픽스처에는 진짜 로컬 프록시를 쓰세요.',
  'workbench.docs.diagrams.mock.useCasesAria':
    '응답 본문 + 상태의 흔한 용도: 오프라인 개발, 오류 시뮬레이션, PII 가리기, 극단적인 ' + '페이로드 형태.',
  'workbench.docs.diagrams.mock.caseOffline': '오프라인 개발',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'API 전체를 스텁',
  'workbench.docs.diagrams.mock.caseError': '오류 시뮬레이션',
  'workbench.docs.diagrams.mock.caseErrorEx': '경로 하나에 500 강제',
  'workbench.docs.diagrams.mock.casePii': 'PII 가리기',
  'workbench.docs.diagrams.mock.casePiiEx': '전송선에서 이메일 마스킹',
  'workbench.docs.diagrams.mock.caseEdge': '극단적인 경우',
  'workbench.docs.diagrams.mock.caseEdgeEx': '빈 배열, 거대한 페이로드',
  'workbench.docs.diagrams.mock.useCasesFooter': '정적 = 픽스처 모드 · 동적 = 실제 호출 통과 + 편집.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    '워크벤치 포커스 영역 (왼쪽 사이드바, 편집기, 오른쪽 사이드바, 하단 패널) 에 각각 포커스 단축키 ' +
    '조합이 표시됩니다.',
  'workbench.docs.diagrams.keyboardShortcuts.title': '포커스 단축키 조합은 네 영역 중 하나로 데려갑니다',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': '왼쪽 사이드바',
  'workbench.docs.diagrams.keyboardShortcuts.editor': '편집기',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': '오른쪽 사이드바',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': '하단 패널',
  'workbench.docs.diagrams.keyboardShortcuts.footer': '키보드 설정에서 어떤 조합이든 다시 지정할 수 있습니다.',

  // ── Wire mirrors (whole-raw in every locale) ────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
