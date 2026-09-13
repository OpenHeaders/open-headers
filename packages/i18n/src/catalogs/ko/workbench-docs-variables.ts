/**
 * Workbench Docs panel — the Variables section body — Korean. Mirrors
 * `catalogs/en/workbench-docs-variables.ts` key for key. `{{ns.NAME}}`
 * reference tokens and scope names ride raw inside keyed prose (the
 * render site composes them as code chips). Quotes the shipped ko
 * mints: the scoping nouns from `workbench-chrome.ts`'s varScope
 * block (Vault raw / 환경 / 컬렉션 / 워크스페이스, 이름 공간, 접두사 없는
 * = bare, 차례로 거칩니다 = walks), the sidebar entries (Vault /
 * 워크스페이스 변수 / 라이브 변수 / 환경 / 변수), 변수 = the tool window,
 * 가려짐 = shadowed (popup), 라이브 워크플로 / 단계 / 추출기 / 캡처 /
 * 게시 = publish carried, 전송 = Send, 정적 데이터 / 동적 = the
 * request-body modes, 동적 (JavaScript) = the mode label. MINTS: 순회 =
 * the walk (탐색 stays navigation); 사다리 = ladder; 범위 내 / 모든 범위
 * = In scope / All scopes (the Variables tool-window tabs —
 * `workbench-variables.ts` MUST reuse); 노출 = expose (a capture);
 * 제안기 = suggester; 오래됨 = stale. Section headings keep a
 * structural `—` as the label separator; prose restructures. A
 * fragment joined to a preceding code chip with no space opens with
 * `.` / `,` per en, never with a particle. Sandwich fragments
 * restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    '템플릿을 쓸 수 있는 모든 필드 (헤더 값, 리디렉션 URL 주소, 요청 본문, 워크플로 단계)는 다음 형식으로 변수를 참조할 수 있습니다:',
  'workbench.docs.body.variables.intro1Suffix':
    '. 값은 사용 시점에 치환되므로, 정의 하나가 그 이름을 언급하는 모든 규칙, 요청, 워크플로를 움직입니다. 변수는 다섯 범위에 살며, 각 범위는 앱 안에 자기 자리가 있고 같은 이름이 둘 이상의 범위에 있을 때의 순위도 있습니다.',
  'workbench.docs.body.variables.ladderCaptionPrefix': '접두사 없는',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    '참조는 네 범위를 위에서 아래로 차례로 거치며 첫 적중에서 멈춥니다. 라이브와 그 밖의 이름 공간 범위는 순회 밖에 있습니다.',
  'workbench.docs.body.variables.scopesHeading': '다섯 범위',
  'workbench.docs.body.variables.vaultHeading': 'Vault — 시크릿, 이 기기 전용',
  'workbench.docs.body.variables.vault1Prefix':
    'vault 저장소는 기기별 시크릿을 담습니다: API 키, 비밀번호, TOTP seed 값. Vault 항목은 절대 동기화되지 않고 기기를 떠나지 않습니다. 워크스페이스 내보내기와 git 이력에서도 빠집니다. 두 종류가 있습니다:',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': '항목은 그대로의 값으로 해석되고,',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    '항목은 저장된 seed 값으로 계산한 현재의 6–8자리 코드로 해석됩니다. seed 값 자체는 템플릿을 통해 절대 노출되지 않습니다. Vault 범위의 순위가 가장 높으므로, vault 시크릿은 접두사 없는 참조에서 항상 이깁니다.',
  'workbench.docs.body.variables.vaultCaptionPrefix': '동기화되는 항목에서는',
  'workbench.docs.body.variables.vaultCaptionSuffix': '형식으로 시크릿을 참조하세요. 원시 값을 붙여넣지 마세요.',
  'workbench.docs.body.variables.environmentHeading': '환경 — 전환할 수 있는 값 묶음',
  'workbench.docs.body.variables.environment1Prefix': '환경은 한 단위로 바꿔 끼우는 이름 붙은 변수 묶음입니다.',
  'workbench.docs.body.variables.environment1Suffix':
    ', 팀원의 로컬 설정 등입니다. 활성 환경은 헤더의 선택기에서 고릅니다. 활성 환경이 정의하지 않은 이름은 순회가 아래로 이어지기 전에 기본 환경으로 대체됩니다. 환경을 선택하지 않고 실행하는 것도 유효한 상태이며, 해석은 그 범위를 그냥 건너뜁니다. 행을 시크릿으로 표시하면 편집기에서 값이 가려져 표시됩니다.',
  'workbench.docs.body.variables.environmentCaption':
    '이름 하나, 스테이지마다 값 하나. 규칙을 복제하는 대신 환경을 전환하세요.',
  'workbench.docs.body.variables.collectionHeading': '컬렉션 — 컬렉션 하나로 범위 한정',
  'workbench.docs.body.variables.collection1':
    '컬렉션 변수는 컬렉션에 정의되며 그 컬렉션에 속한 규칙과 요청에서만 해석됩니다. 워크스페이스 전체가 아니라 API 하나에만 참인 값 (기본 URL 주소, 테넌트 id, 버전 접두사)의 알맞은 자리입니다.',
  'workbench.docs.body.variables.collectionCaption':
    '컬렉션 변수는 자기 컬렉션 안에서만 해석됩니다. 다른 곳에서는 순회가 그냥 지나칩니다.',
  'workbench.docs.body.variables.workspaceHeading': '워크스페이스 — 모두와 공유',
  'workbench.docs.body.variables.workspace1':
    '워크스페이스 변수는 워크스페이스 전체의 전역 값입니다. 모든 규칙, 요청, 워크플로에 보이며 워크스페이스와 함께 동기화됩니다. 순위가 가장 낮아서 자연스러운 기본 계층이 됩니다. 공통 값을 여기에 두고, 필요한 곳에서 환경이나 컬렉션이 재정의하게 하세요.',
  'workbench.docs.body.variables.workspaceCaption':
    '기본 계층. 어디서나 참인 값을 위한 자리입니다. 시크릿이나 스테이지별 값의 자리는 아닙니다.',
  'workbench.docs.body.variables.liveHeading': '라이브 — 워크플로 실행이 게시',
  'workbench.docs.body.variables.live1Prefix':
    '라이브 변수는 라이브 워크플로가 뒷받침합니다. 로그인하고, token 값을 가져오고, 캡처한 값을 노출하는 요청의 연쇄입니다. 워크플로를 저장하면 활성화되고, 실행이 성공하면 (수동 또는 예약) 노출된 값이 게시되며, 자동 새로 고침이 워크플로를 다시 실행해 값을 최신으로 유지합니다. 라이브 값은 오직',
  'workbench.docs.body.variables.live1Suffix':
    '형식으로만 닿을 수 있습니다. 접두사 없는 참조로는 절대 닿지 않습니다. 그래서 워크스페이스나 환경 변수가 같은 이름을 쓸 때 규칙 템플릿이 새로 고침 중인 값을 조용히 집어 가는 일이 없습니다. 워크플로의 레시피를 편집하면 다음 실행까지 게시된 값이 오래됨으로 표시됩니다.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': '항상 접두사가 붙고 (',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '), 항상 워크플로가 뒷받침합니다. 붙여넣은 token 값이 아닙니다.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': '실행 성공 → 노출된 캡처가',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '형식으로 게시됨 → 규칙과 요청이 소비. 일정이 워크플로를 다시 실행합니다.',
  'workbench.docs.body.variables.priorityHeading': '우선순위와 가려짐',
  'workbench.docs.body.variables.priority1Prefix': '접두사 없는',
  'workbench.docs.body.variables.priority1Suffix':
    '참조는 네 실제 범위를 엄격한 순서로 거칩니다. vault, 그다음 활성 환경 (기본 환경 대체 포함), 그다음 컬렉션, 그다음 워크스페이스. 그리고 그 이름을 정의한 첫 범위에서 멈춥니다. 아래쪽 정의는 여전히 존재하며, 그저 가려질 뿐입니다.',
  'workbench.docs.body.variables.shadowingCaptionPrefix': '접두사 없는 참조에서는 환경이 워크스페이스를 이깁니다.',
  'workbench.docs.body.variables.shadowingCaptionSuffix': '형식은 가려진 값을 여전히 읽습니다.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    '모든 범위에는 해석을 그 범위에 고정하고 사다리를 통째로 건너뛰는 이름 공간도 있습니다:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. 보통은 접두사 없는 형식을 쓰고, 위에 무엇이 정의되어 있든 특정 범위를 뜻할 때는 이름 공간 형식을 쓰세요.',
  'workbench.docs.body.variables.tipTitle': '시크릿은 vault 저장소에 두세요',
  'workbench.docs.body.variables.tip1Prefix':
    '규칙, 요청, 워크플로는 워크스페이스와 동기화되지만 vault 저장소는 그렇지 않습니다. 동기화되는 항목에서',
  'workbench.docs.body.variables.tip1Suffix':
    '형식으로 참조하면 팀원마다 자기 값을 로컬에서 공급합니다. 민감한 것은 공유 데이터에 절대 들어가지 않습니다.',
  'workbench.docs.body.variables.rulesHeading': '규칙의 변수',
  'workbench.docs.body.variables.rules1':
    '규칙이 담는 거의 모든 문자열에 템플릿을 쓸 수 있습니다: 조건 값 (도메인, URL 패턴, 헤더 이름), 헤더 값, 리디렉션 URL 주소, 쿼리 매개변수 이름과 값, 정적 요청 및 응답 본문, 삽입 코드, WS / SSE 페이로드, Basic 인증 자격 증명. 규칙 편집기는 각 참조를 강조하고, 마우스를 올리면 해석된 값을 보여 주며, 해석되지 않는 참조에는 배너를 띄웁니다. 해석되지 않은 규칙은 모든 참조에 값이 생길 때까지 효력을 낼 수 없습니다.',
  'workbench.docs.body.variables.consumersCaption':
    '템플릿 값 하나가 세 소비 화면 모두에 공급됩니다. 각각이 적용되는 자리에서 치환됩니다.',
  'workbench.docs.body.variables.dynamicNoteTitle': '동적 (JS) 본문에는 템플릿이 적용되지 않습니다',
  'workbench.docs.body.variables.dynamicNote1Prefix': '요청 본문 규칙과 응답 규칙 가운데',
  'workbench.docs.body.variables.dynamicWord': '동적',
  'workbench.docs.body.variables.dynamicNote1Middle':
    '모드는 템플릿을 치환하는 대신 JavaScript 코드를 실행합니다. 코드가 값을 스스로 계산합니다. 오직',
  'workbench.docs.body.variables.staticWord': '정적',
  'workbench.docs.body.variables.dynamicNote1Middle2': '본문만',
  'workbench.docs.body.variables.dynamicNote1Suffix': '치환에 참여합니다.',
  'workbench.docs.body.variables.requestsHeading': '요청의 변수',
  'workbench.docs.body.variables.requests1Prefix':
    'API 클라이언트에서는 URL 주소, 쿼리 매개변수, 헤더, 인증 필드, 본문이 모두 전송 시점에 해석됩니다. 요청이 속한 컬렉션의 컬렉션 변수도 포함합니다. 해석할 수 없는 참조는 리터럴',
  'workbench.docs.body.variables.requests1Suffix':
    '문자열을 전송선에 올리는 대신, 빠진 변수를 이름으로 알리는 오류와 함께 전송을 막습니다.',
  'workbench.docs.body.variables.workflowsHeading': '워크플로의 변수',
  'workbench.docs.body.variables.workflows1Prefix':
    '각 라이브 워크플로 단계는 요청처럼 해석되며, 범위가 하나 더 있습니다:',
  'workbench.docs.body.variables.workflows1Suffix':
    '형식은 같은 실행의 앞선 단계가 캡처한 값을 참조합니다. 1단계에서 로그인하고, 2단계에서 세션 token 값을 씁니다. 단계 참조는 연쇄가 실행되는 동안에만 존재하며, 노출로 표시된 캡처가 실행 성공 시 라이브 변수로 게시됩니다.',
  'workbench.docs.body.variables.namespacesHeading': '이름 공간 전용 도우미',
  'workbench.docs.body.variables.helpers1': '저장된 변수가 전혀 아닌 값을 해석하는 이름 공간이 셋 더 있습니다.',
  'workbench.docs.body.variables.helpersDynamicMiddle': '형식은 내장 생성기를 실행합니다.',
  'workbench.docs.body.variables.helpersFriends':
    '등이 있으며, 해석할 때마다 새 값을 만듭니다: API 클라이언트에서는 전송마다, 정적 규칙에서는 컴파일마다 (값은 다음 재컴파일까지 굳어 있습니다).',
  'workbench.docs.body.variables.helpersFileMiddle': '형식은 저장된 파일을 이름으로 참조합니다. 그리고',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', 위에서 본 대로, 실행 중인 워크플로 연쇄 안에서만 의미가 있습니다. 셋 다 접두사 없는 순회에는 참여하지 않으며, 접두사로만 닿을 수 있습니다.',
  'workbench.docs.body.variables.inspectingHeading': '만들기와 검사하기',
  'workbench.docs.body.variables.create1Prefix': '모든 범위는 사이드바에서 만듭니다:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': '워크스페이스 변수',
  'workbench.docs.body.variables.createAnd': ', 그리고',
  'workbench.docs.body.variables.sidebarLiveVars': '라이브 변수',
  'workbench.docs.body.variables.create1Middle': '항목은 최상위 항목이며, 개별 환경은',
  'workbench.docs.body.variables.sidebarEnvironments': '환경',
  'workbench.docs.body.variables.create1Middle2': ' 섹션 아래에 추가하고, 각 컬렉션은 자체',
  'workbench.docs.body.variables.sidebarVariables': '변수',
  'workbench.docs.body.variables.create1Suffix': '페이지를 가집니다.',
  'workbench.docs.body.variables.creationMapCaption':
    '사이드바의 변수 자리마다 그것이 공급하는 이름 공간을 표시했습니다.',
  'workbench.docs.body.variables.inspect1Prefix': '검사 화면은',
  'workbench.docs.body.variables.inspect1Middle': '도구 창입니다.',
  'workbench.docs.body.variables.inScopeLabel': '범위 내',
  'workbench.docs.body.variables.inspect1Middle2':
    '탭은 포커스된 규칙, 요청 또는 템플릿이 실제로 참조하는 변수를 나열합니다. 각각 사다리 전체를 거쳐 해석되므로 실제로 적용될 정확한 값을 볼 수 있습니다.',
  'workbench.docs.body.variables.allScopesLabel': '모든 범위',
  'workbench.docs.body.variables.inspect1Middle3':
    '탭은 어디에든 정의된 모든 것을 우선순위별로 묶어 나열합니다. 템플릿을 쓸 수 있는 어느 필드에서든',
  'workbench.docs.body.variables.inspect1Suffix':
    '문자를 입력하면 해석할 수 있는 모든 이름을 담은 제안기가 열리고, 참조에 마우스를 올리면 해석된 값과 이긴 범위가 표시됩니다.',
} as const satisfies Catalog;
