/**
 * Workbench Docs panel — anchor registry bodies — Korean. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr/es S59 raw/keyed
 * split is followed exactly. Raw by design inside keyed prose:
 * wire/API tokens (declarativeNetRequest, webRequest, ResourceType,
 * queryTransform, block, main_frame, firstParty / thirdParty,
 * operationName / query / key / value, chrome.storage(.local),
 * fetch() / XMLHttpRequest, @font-face, Set-Cookie, Accept,
 * User-Agent, Content-Type, CORS, ERR_BLOCKED_BY_CLIENT, RE2, stdio,
 * HTTP/SSE, git log / git blame), ResourceType enum labels (Page,
 * Frame, Fetch/XHR, Script, …), the en figure strings `30,000 ms` /
 * `5,000 ms` verbatim with 까지 / 로 attached to a head noun (the
 * particle law — `ms` is a glossary unit), DNR / AND / DOM / CA / PII
 * / YAML / CDN / MCP / MITM tokens with 방식 / 조건 / 인증서 as head
 * nouns. Quoted UI labels copy their shipped ko mints: the header /
 * query-param ops (추가 / 바꾸기, 덧붙이기, 제거, 병합, 바꾸기만, 모두
 * 제거 — editors-rule), the condition names and their 제외 variants,
 * the inject timing labels (가능한 한 빨리 / 페이지 로드 후), the
 * popup tab “이 페이지”, the docs nav titles (workbench-chrome:
 * 규칙이 실행되는 방식, 리소스 유형, 비교, 모든 화면, 출시 완료), 정적
 * 데이터 / 동적 mode labels, 같음 / 포함 = Equals / Contains, 퍼스트
 * 파티 / 서드 파티, 몽키 패치 = monkey-patch, 도메인 종류 = Domain Type,
 * 발신자 = initiator, 탐색 = navigation, 모의 = mock (verb), 알약,
 * 배지, 도구 창, 분할선, 재정의 = Override, 병합 = Merge, 시트 / 티어
 * carried, lowercase `vault` per-case law. MINTS: 도달 범위 = reach;
 * 정적 = Static (the redirect / body / response mode — 고정 stays pin);
 * 절충 = trade-off; 픽스처 = fixture; 대기 페이지 = the local waiting
 * page; 차선 = delay lane; 변환 = transform; 익명화 = anonymize; 상한
 * = ceiling / cap carried; 로컬 우선 = local-first; 하이드레이트
 * carried. Whole-raw `.` / `).` / `A` / `An` sentence tails copy
 * verbatim and the Korean tail moves into the preceding fragment;
 * sandwich fragments restructure SOV with the predicate in the
 * suffix; a fragment joined to a preceding code chip with no space
 * opens with `.` / `,` per en.
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    '규칙은 하는 일에 따라 두 엔진 중 하나로 실행됩니다. 규칙이 어느 경로를 지나는지 알면 어디에 적용되는지, 그리고 어디에는 적용될 수 없는지가 설명됩니다.',
  'workbench.docs.body.execution.stackCaption':
    'JS 코드가 시작한 요청은 Script 엔진을 거친 뒤 DNR 엔진을 지납니다. 정적 트래픽과 탐색 트래픽은 Script 엔진을 완전히 건너뜁니다.',
  'workbench.docs.body.execution.dnrHeading': '네이티브, 빠름, 넓은 도달 범위',
  'workbench.docs.body.execution.dnr1Prefix': '헤더 재정의 / 덧붙이기 / 제거, 차단, 리디렉션, 쿼리 매개변수 규칙은',
  'workbench.docs.body.execution.dnr1Suffix':
    '항목으로 컴파일됩니다. Chrome 브라우저는 요청이 브라우저를 떠나기 전에 네트워크 계층에서 이를 적용합니다.',
  'workbench.docs.body.execution.dnr2':
    '도달 범위가 넓습니다: 페이지, 하위 프레임, 스크립트, 이미지, 글꼴, fetch, XHR 등 브라우저가 페이지를 대신해 보내는 모든 요청.',
  'workbench.docs.body.execution.dnrCaption': '테두리가 있는 목록 하나. DNR 엔진의 도달 범위는 사실상 전부입니다.',
  'workbench.docs.body.execution.scriptHeading': 'JS 컨텍스트, 좁은 도달 범위',
  'workbench.docs.body.execution.script1Prefix': '삽입, 지연, 요청 본문, API 응답, 헤더 병합 규칙은 페이지 안에서',
  'workbench.docs.body.execution.script1And': '및',
  'workbench.docs.body.execution.script1Suffix':
    '함수를 몽키 패치하는 방식으로 동작합니다. DNR 방식으로는 표현할 수 없는 방법으로 JavaScript 코드가 시작한 트래픽을 변환할 수 있으며, DNR 엔진이 접근할 수 없는 응답 본문을 읽고 다시 쓰는 것도 포함합니다.',
  'workbench.docs.body.execution.scriptCaption':
    '두 열. 스크립트 엔진이 실제로 가로채는 것과, 바뀌지 않고 빠져나가는 것.',
  'workbench.docs.body.execution.limitPrefix': '정적 리소스 (',
  'workbench.docs.body.execution.limitSuffix':
    '), 페이지 탐색, 브라우저 내부 요청은 이 엔진을 완전히 건너뜁니다. 그런 경우에는 DNR 기반 규칙을 쓰세요.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    '사람들을 놀라게 하는 동작의 빠른 참고 자료입니다. 각 항목은 영향을 주는 섹션에도 인라인으로 적혀 있습니다.',
  'workbench.docs.body.limitations.overviewCaption':
    '흔한 함정 넷을 한눈에. 아래 각 안내 상자에 자세한 내용이 있습니다.',
  'workbench.docs.body.limitations.devtoolsTitle': '수정된 헤더는 DevTools 창에 보이지 않습니다',
  'workbench.docs.body.limitations.devtoolsBody':
    '헤더 작업은 올바르게 적용되지만 Chrome 브라우저의 Network 탭은 여전히 서버의 원래 헤더를 표시합니다.',
  'workbench.docs.body.limitations.scriptTitle': '스크립트 기반 규칙: 좁은 도달 범위',
  'workbench.docs.body.limitations.scriptPrefix': '삽입, 지연, 본문, Mock, 헤더 병합이 가로채는 것은',
  'workbench.docs.body.limitations.scriptAnd': '및',
  'workbench.docs.body.limitations.scriptMiddle': '함수뿐입니다. 정적 리소스와 페이지 탐색은 이를 건너뜁니다. 참조:',
  'workbench.docs.body.limitations.executionRef': '규칙이 실행되는 방식',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': '병합은 브라우저 기본 헤더를 읽을 수 없습니다',
  'workbench.docs.body.limitations.mergeBody':
    '병합 작업은 페이지 코드가 명시적으로 설정한 헤더만 봅니다. Accept, User-Agent 등 브라우저 기본 헤더는 보이지 않습니다.',
  'workbench.docs.body.limitations.chromeTitle': '헤더 일치에는 Chrome 128 이상이 필요합니다',
  'workbench.docs.body.limitations.chromeBody':
    '요청 / 응답 헤더 값에 일치하는 조건에는 Chrome 128 이상이 필요합니다. 더 오래된 브라우저는 그 조건을 조용히 무시합니다.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    '워크스페이스 탭을 한 번에 여러 개 여는 것은 정식으로 지원되는 상태입니다. 저장된 데이터는',
  'workbench.docs.body.multiTab.intro1Suffix':
    '저장소를 통해 동기화되고, 레이아웃 상태는 탭마다 따로 유지되며, 이동 의도는 새 탭을 열기 전에 같은 창의 기존 탭을 재사용합니다.',
  'workbench.docs.body.multiTab.syncCaption':
    'A 탭이 저장하면 SW 프로세스가 브로드캐스트하고 B 탭이 다시 하이드레이트합니다. 레이아웃 상태는 각 탭에 남습니다.',
  'workbench.docs.body.multiTab.navHeading': '이동은 기존 탭을 재사용합니다',
  'workbench.docs.body.multiTab.nav1':
    '같은 창 우선: 클릭한 창에 워크스페이스 탭이 이미 열려 있으면 그 탭이 활성화되어 의도 (스크롤할 문서 섹션, 편집할 규칙)를 받습니다. 다른 창인 경우: Chrome 브라우저 창 사이로 포커스를 끌어오는 대신 현재 창에 새 탭이 열립니다. Chrome 브라우저 자체의 DevTools 창이 창마다 패널 하나를 두는 방식과 같습니다.',
  'workbench.docs.body.multiTab.navCaption':
    '웜 경로는 같은 창의 탭을 활성화하고, 콜드 경로는 호출한 창에 새 탭을 엽니다.',
  'workbench.docs.body.multiTab.numberingHeading': '탭 번호 매기기',
  'workbench.docs.body.multiTab.numbering1Prefix': '워크스페이스 탭이 둘 이상이면 각 탭 제목 앞에 순번이 붙습니다:',
  'workbench.docs.body.multiTab.numbering1Suffix': '. 개수가 다시 하나로 줄면 남은 탭은 접두사를 떼어 냅니다.',
  'workbench.docs.body.multiTab.numbering2Prefix': '순번은 탭이 살아 있는 동안 안정적입니다. 예를 들어',
  'workbench.docs.body.multiTab.numbering2While': '탭을 닫을 때',
  'workbench.docs.body.multiTab.numbering2And': '및',
  'workbench.docs.body.multiTab.numbering2Middle':
    '탭이 남아 있다면 남은 탭의 번호는 다시 매겨지지 않습니다. 다음에 여는 탭은',
  'workbench.docs.body.multiTab.numbering2Middle2': '번을 받고, 번호가',
  'workbench.docs.body.multiTab.numbering2Suffix': '번으로 되돌아가는 것은 모든 워크스페이스 탭이 닫힌 뒤뿐입니다.',
  'workbench.docs.body.multiTab.numberingCaption':
    '남은 탭은 닫힘을 거쳐도 번호를 유지하고, 다음 탭은 항상 최댓값 + 1 번호를 받습니다.',
  'workbench.docs.body.multiTab.syncsHeading': '동기화되는 것과 되지 않는 것',
  'workbench.docs.body.multiTab.syncs1Prefix':
    '저장되는 모든 항목 (규칙, 컬렉션, 폴더, 환경, 워크스페이스 변수, vault, 요청, 템플릿)은 단일 진실 원천으로서',
  'workbench.docs.body.multiTab.syncs1Suffix':
    '저장소에 있습니다. A 탭의 저장은 백그라운드를 통해 브로드캐스트되고 B 탭이 다시 하이드레이트합니다. 워크스페이스와 환경 전환도 같은 방식으로 전파됩니다.',
  'workbench.docs.body.multiTab.syncedCaption':
    '공유 chrome.storage 저장소 하나. 두 탭이 같은 저장 데이터를 읽고 씁니다.',
  'workbench.docs.body.multiTab.localCaption':
    '레이아웃 드래그와 저장하지 않은 입력은 각 탭에 남습니다. 다른 탭은 절대 보지 못합니다.',
  'workbench.docs.body.multiTab.layoutTitle': '레이아웃은 라이브 동기화되지 않습니다',
  'workbench.docs.body.multiTab.layout1Prefix':
    '창 비율과 도구 창 도크 상태는 워크스페이스별이지만, 변경은 이미 열린 탭으로 전파되지 않습니다. A 탭에서 분할선을 끌어도 B 탭은 다시 불러올 때까지 그대로입니다. 입력 중에 레이아웃이 라이브로 동기화되면 거슬리기 때문입니다. 드래그',
  'workbench.docs.body.multiTab.layoutAfter': '이후에',
  'workbench.docs.body.multiTab.layout1Suffix': '연 탭은 새 레이아웃을 물려받습니다.',
  'workbench.docs.body.multiTab.draftsTitle': '저장하지 않은 초안은 탭 로컬입니다',
  'workbench.docs.body.multiTab.drafts1':
    '편집기 초안은 자기 탭의 메모리에 있습니다. B 탭이 편집 중인 것과 같은 규칙을 A 탭이 저장하면 저장소 쓰기는 A 탭이 이깁니다. 현재 탭 간 “수정됨, 다시 불러올까요?” 프롬프트는 없습니다. 두 탭이 같은 항목을 동시에 편집할 때만 문제가 됩니다.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': '팝업의',
  'workbench.docs.body.requestTracking.thisPage': '이 페이지',
  'workbench.docs.body.requestTracking.intro1Suffix':
    '탭은 현재 페이지에 어떤 규칙이 활성이고 어떤 요청과 일치했는지 보여 줍니다. 추적은 페이지가 만드는 모든 연결의 요청 단계와 응답 단계 모두에 걸칩니다.',
  'workbench.docs.body.requestTracking.phasesCaption':
    '연결 하나에는 두 단계가 있습니다. 둘 다 배지 개수에 기여합니다.',
  'workbench.docs.body.requestTracking.howHeading': '동작 방식',
  'workbench.docs.body.requestTracking.how1Prefix': '확장 프로그램은 HTTP 요청을',
  'workbench.docs.body.requestTracking.how1Middle':
    'API 기능을 통해 관찰합니다. 요청 URL 주소가 규칙의 조건 (도메인, URL 패턴 또는 URL 정규식)과 일치하면 리소스 유형과 함께 기록됩니다. 기록은 서비스 워커 안에서 라이브로 이루어지며, 팝업은',
  'workbench.docs.body.requestTracking.how1Suffix': '탭을 열 때 그 기록을 읽어 올 뿐입니다.',
  'workbench.docs.body.requestTracking.howCaption':
    '브라우저가 webRequest 이벤트를 발생시키고, 확장 프로그램이 일치시켜 기록하고, 팝업이 나중에 읽습니다.',
  'workbench.docs.body.requestTracking.badge1':
    '일치한 각 규칙에는 일치한 요청 수와 같은 숫자 배지가 표시됩니다. 배지를 누르면 타임스탬프, URL 주소, 리소스 유형, 일치한 패턴의 목록으로 펼쳐집니다.',
  'workbench.docs.body.requestTracking.badgeCaption': '배지는 개수를 접어 두고, 누르면 전체 일치 목록이 드러납니다.',
  'workbench.docs.body.requestTracking.directHeading': '직접 일치와 간접 일치',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle': '(직접) 일치는 페이지 URL 주소 자체가 일치했다는 뜻입니다. An',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirect',
  'workbench.docs.body.requestTracking.direct1Suffix':
    '(간접) 일치는 페이지 URL 주소는 일치하지 않고 하위 리소스 (스크립트, 스타일시트, XHR, 이미지, 글꼴)만 일치했다는 뜻입니다. 같은 규칙이라도 어느 페이지에 있느냐에 따라 어느 쪽이든 될 수 있습니다.',
  'workbench.docs.body.requestTracking.directCaption': '규칙 하나, 페이지 컨텍스트 둘. 초록 = 일치. 점선 = 제외.',
  'workbench.docs.body.requestTracking.typesHeading': '리소스 유형',
  'workbench.docs.body.requestTracking.types1Prefix': '일치한 각 요청은 Chrome 브라우저의',
  'workbench.docs.body.requestTracking.types1Middle':
    '값을 지닙니다. Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping 또는 Other. 예시가 딸린 전체 대응표는',
  'workbench.docs.body.requestTracking.resourceTypesLink': '리소스 유형',
  'workbench.docs.body.requestTracking.types1Suffix': '참고 페이지를 보세요.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': '요청 추적과 리소스 유형 조건이 드러내는 Chrome 브라우저의',
  'workbench.docs.body.resourceTypes.introSuffix':
    '값에 대한 참고 자료입니다. 각 레이블은 기반 유형 하나에 대응하며, 행 사이에 겹침이 없습니다.',
  'workbench.docs.body.resourceTypes.anatomyCaption': '어떤 종류의 요청이 어느 ResourceType 값에 들어가는지 한눈에.',
  'workbench.docs.body.resourceTypes.descPage': '최상위 문서 탐색. 주소 표시줄에 보이는 URL 주소입니다.',
  'workbench.docs.body.resourceTypes.descFrame': '페이지 안에 포함된 iframe 프레임 또는 중첩 프레임.',
  'workbench.docs.body.resourceTypes.descXhr':
    'fetch() 또는 XMLHttpRequest 함수를 통한 API 호출. Chrome 브라우저는 둘을 같은 유형으로 보고하며 구별할 방법이 없습니다.',
  'workbench.docs.body.resourceTypes.descScript': '페이지가 불러오는 JavaScript 파일.',
  'workbench.docs.body.resourceTypes.descStylesheet': '페이지가 불러오는 스타일시트.',
  'workbench.docs.body.resourceTypes.descImage': '페이지나 그 스타일이 불러오는 이미지.',
  'workbench.docs.body.resourceTypes.descFont': '@font-face 규칙으로 불러오는 웹 글꼴.',
  'workbench.docs.body.resourceTypes.descMedia': '오디오 또는 비디오 리소스.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'WebSocket 핸드셰이크. 최초의 HTTP 업그레이드 요청입니다. 핸드셰이크만 추적되며 개별 메시지는 추적되지 않습니다.',
  'workbench.docs.body.resourceTypes.descPing': '주로 분석 / 추적에 쓰이는 비컨과 ping 요청.',
  'workbench.docs.body.resourceTypes.descOther': '위 범주 어디에도 맞지 않는 것.',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': '작업은 규칙의 “',
  'workbench.docs.body.actions.introDo': '실행',
  'workbench.docs.body.actions.intro1Middle': '” 부분입니다.',
  'workbench.docs.body.actions.conditionLink': '조건',
  'workbench.docs.body.actions.intro1Middle2': '이 규칙을 실행할지',
  'workbench.docs.body.actions.introWhether': '여부',
  'workbench.docs.body.actions.intro1Middle3': '를 정하는 반면, 작업은',
  'workbench.docs.body.actions.introWhatChanges': '무엇을 바꿀지',
  'workbench.docs.body.actions.intro1Suffix':
    '를 정합니다. 모든 규칙은 AND 조건으로 일치하는 조건 묶음과 정확히 하나의 작업을 짝짓습니다.',
  'workbench.docs.body.actions.categories1':
    '작업은 세 범주로 나뉩니다. 나가는 요청 수정, 들어오는 응답 수정, 페이지 안에서 코드 실행. 각 작업은 두 엔진 중 하나로 구현됩니다:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '(Chrome 브라우저의',
  'workbench.docs.body.actions.categoriesDnrSuffix': '. 빠르고 네이티브) 또는',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '(Open Headers 페이지 내 엔진. DNR 방식으로 표현할 수 없는 것을 위해). 절충점은',
  'workbench.docs.body.actions.executionLink': '규칙이 실행되는 방식',
  'workbench.docs.body.actions.categories1Suffix': '을 보세요.',
  'workbench.docs.body.actions.ruleAnatomyCaption': '규칙 = AND 조건으로 일치하는 조건과 정확히 하나의 작업의 짝.',
  'workbench.docs.body.actions.taxonomyCaption': '세 범주. 모든 작업에 엔진 태그가 붙어 있습니다.',
  'workbench.docs.body.actions.modifyRequestTitle': '요청 수정',
  'workbench.docs.body.actions.tagRequest': '브라우저를 떠나기 전에',
  'workbench.docs.body.actions.modifyRequest1':
    '나가는 요청의 모양을 바꿉니다. 헤더, URL 매개변수, 본문, 목적지, 또는 아예 나갈지 여부. 대부분의 규칙이 여기에 속합니다.',
  'workbench.docs.body.actions.headerActionsLink': '헤더 작업',
  'workbench.docs.body.actions.liHeaderActionsRequest': ': 요청 헤더의 추가 / 바꾸기 / 덧붙이기 / 제거 / 병합.',
  'workbench.docs.body.actions.blockLink': '차단',
  'workbench.docs.body.actions.liBlock': ': 네트워크 계층에서 요청을 취소.',
  'workbench.docs.body.actions.redirectLink': '리디렉션',
  'workbench.docs.body.actions.liRedirect': ': 요청을 다른 URL 주소로 보냄. 정적 또는 정규식.',
  'workbench.docs.body.actions.queryParamsLink': '쿼리 매개변수',
  'workbench.docs.body.actions.liQueryParams': ': URL 매개변수의 추가, 바꾸기 또는 제거.',
  'workbench.docs.body.actions.requestBodyLink': '요청 본문',
  'workbench.docs.body.actions.liRequestBody': ': 나가는 fetch / XHR 본문을 다시 씀 (정적, 동적 또는 GraphQL 필터링).',
  'workbench.docs.body.actions.modifyResponseTitle': '응답 수정',
  'workbench.docs.body.actions.tagResponse': '페이지가 보기 전에',
  'workbench.docs.body.actions.modifyResponse1':
    '돌아오는 응답의 모양을 바꿉니다. 헤더, 본문 또는 HTTP 상태. 아직 만들지 않은 엔드포인트를 모의하거나 개발 중에 실패 모드를 강제할 때 유용합니다.',
  'workbench.docs.body.actions.liHeaderActionsResponse': ': 같은 다섯 작업이 응답 헤더에도 적용됩니다.',
  'workbench.docs.body.actions.responseLink': '응답 수정',
  'workbench.docs.body.actions.liResponse': ': 응답을 모의하거나 수정. 합성 본문, 상태 또는 헤더.',
  'workbench.docs.body.actions.runCodeTitle': '코드 실행',
  'workbench.docs.body.actions.tagRunCode': '페이지 또는 그 스케줄러 안에서',
  'workbench.docs.body.actions.runCode1':
    '“요청이나 응답을 수정”에 깔끔하게 들어맞지 않는 효과. 코드 삽입과 인위적인 지연입니다. 둘 다 DNR 방식에 대응물이 없으므로 Script 엔진으로 실행됩니다.',
  'workbench.docs.body.actions.injectLink': 'JS / CSS 삽입',
  'workbench.docs.body.actions.liInject':
    ': 페이지 컨텍스트에서 JavaScript 또는 CSS 코드를 실행. 페이지 스크립트 전 또는 DOM 준비 후.',
  'workbench.docs.body.actions.delayLink': '지연',
  'workbench.docs.body.actions.liDelay': ': 탐색과 JS 코드가 시작한 fetch / XHR 요청에 인위적인 지연을 추가.',
  'workbench.docs.body.actions.oneActionTitle': '규칙당 작업 하나',
  'workbench.docs.body.actions.oneAction1':
    '각 규칙은 정확히 하나의 작업을 지닙니다. 한 번에 두 가지를 하려면 (예를 들어 헤더 추가 AND 리디렉션) 같은 조건을 가진 규칙 두 개를 쓰세요. 둘 다 같은 요청에서 실행되며, DNR 엔진이 문서화된 순서로 합성합니다.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    '요청 및 응답 헤더에 대한 네 가지 작업. 네이티브 셋 (추가 / 바꾸기, 덧붙이기, 제거)과, DNR 방식으로 표현할 수 없는 값 이어붙이기를 위한 스크립트 기반 하나 (병합)입니다.',
  'workbench.docs.body.headerActions.opsCaption': '같은 시작 헤더, 네 가지 다른 결과',
  'workbench.docs.body.headerActions.overrideTitle': '추가 / 바꾸기',
  'workbench.docs.body.headerActions.override1':
    '헤더를 이 값으로 설정합니다. 있으면 바꾸고 없으면 추가합니다. 항상 내 값을 가진 헤더 하나가 됩니다.',
  'workbench.docs.body.headerActions.overrideCaption':
    '규칙 하나가 두 경우를 모두 다룹니다. 있으면 바꾸고, 없으면 추가.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    '규칙의 조건이 요청과 일치하지 않으면 아무 일도 일어나지 않습니다. 오류 없이 그냥 넘어갑니다.',
  'workbench.docs.body.headerActions.appendTitle': '덧붙이기',
  'workbench.docs.body.headerActions.append1':
    '같은 이름의 새 헤더 항목을 추가합니다. 원래 것은 남으므로 중복 헤더가 됩니다. Set-Cookie, Link, Via 헤더에 쓰세요.',
  'workbench.docs.body.headerActions.appendCaption':
    '원래 헤더는 남고, 같은 이름의 두 번째 행이 추가됩니다. 둘 다 전달됩니다.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    '중복할 수 없는 헤더도 있습니다. 브라우저가 하나로 합칩니다. 대신 재정의나 병합을 쓰세요.',
  'workbench.docs.body.headerActions.removeTitle': '제거',
  'workbench.docs.body.headerActions.remove1': '이 헤더의 모든 인스턴스를 삭제합니다. 값은 필요 없습니다.',
  'workbench.docs.body.headerActions.removeCaption': '대상 행이 사라지고, 나머지는 모두 바뀌지 않고 통과합니다.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    '헤더가 없으면 아무 일도 일어나지 않습니다. 오류 없이 그냥 넘어갑니다.',
  'workbench.docs.body.headerActions.mergeTitle': '병합',
  'workbench.docs.body.headerActions.merge1Prefix':
    '실행 시점에 기존 값을 읽고 구분자를 끼워 내 값을 덧붙입니다. 기본값은',
  'workbench.docs.body.headerActions.merge1Middle': 'Cookie 헤더에, 그리고',
  'workbench.docs.body.headerActions.merge1Suffix': '그 밖의 헤더에 씁니다. 구분자를 비우면 그대로 이어 붙입니다.',
  'workbench.docs.body.headerActions.mergeCaption': '기존 값은 남고, 구분자 뒤에 내 값이 덧붙습니다.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Script 엔진 전용. 페이지 탐색과 정적 리소스는 손대지 않은 채 흘러갑니다.',
  'workbench.docs.body.headerActions.mergeLimitation':
    '병합은 DevTools 창에 보이지 않으며 브라우저 기본 헤더 (Accept, User-Agent)를 읽을 수 없습니다. 페이지 코드가 명시적으로 설정한 헤더만 읽습니다.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    '일치하는 요청을 네트워크 계층에서 취소합니다. 브라우저는 네트워크 오류를 받고, 페이지에는 서버에 닿을 수 없는 것처럼 요청 실패가 보입니다.',
  'workbench.docs.body.block.howTitle': '동작 방식',
  'workbench.docs.body.block.how1Prefix': '본문 없는 DNR',
  'workbench.docs.body.block.how1Suffix':
    '작업으로 컴파일됩니다. 리소스 유형과 무관하게 적용됩니다. 페이지, 하위 프레임, 스크립트, 이미지, 글꼴, fetch, XHR. 그래서 리소스 유형 조건으로 좁히지 않는 한 규칙 하나가 전부를 다룹니다.',
  'workbench.docs.body.block.blockCaption':
    '요청은 브라우저를 떠나기 전에 끊기고, 페이지에는 네트워크 오류가 보입니다.',
  'workbench.docs.body.block.wontApplyCaption':
    '이미 불러온 리소스는 그대로 남습니다. 차단은 앞으로의 요청만 잡습니다.',
  'workbench.docs.body.block.whenTitle': '쓰는 때',
  'workbench.docs.body.block.when1Prefix':
    '광고 / 분석 / 추적 도메인 차단, 호스트 하나의 장애 시뮬레이션, API 나머지는 닿게 두면서 엔드포인트 하나만 접근 거부. 페이지의 문서만 (하위 리소스는 빼고) 차단하려면 다음 값의 리소스 유형 조건을 추가하세요:',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    '전형적인 패턴 넷. 각각을 조건 (도메인, URL 패턴, 리소스 유형)으로 좁히세요.',
  'workbench.docs.body.block.note1Prefix': '차단한 것이',
  'workbench.docs.body.block.note1Suffix':
    '요청이면 Chrome 브라우저에 “ERR_BLOCKED_BY_CLIENT” 페이지가 그려집니다. 하위 리소스 차단은 조용히 일어나며, 사용자에게 무엇이 보이는지는 페이지 자체의 오류 처리에 달려 있습니다.',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    '일치하는 요청을 다른 URL 주소로 리디렉션합니다. 정적 URL 주소와 정규식 캡처 그룹을 지원합니다.',
  'workbench.docs.body.redirect.staticTitle': '정적 리디렉션',
  'workbench.docs.body.redirect.static1': '전체 URL 주소를 입력하면 일치하는 모든 요청이 같은 목적지로 리디렉션됩니다.',
  'workbench.docs.body.redirect.staticCaption': '일치하는 모든 요청에 같은 목적지. 전체 URL 주소 치환입니다.',
  'workbench.docs.body.redirect.regexTitle': '정규식 리디렉션',
  'workbench.docs.body.redirect.regex1Prefix': 'URL 정규식 조건과 짝지으세요.',
  'workbench.docs.body.redirect.regex1Suffix': ' 등으로 목적지 URL 주소의 캡처 그룹을 참조합니다.',
  'workbench.docs.body.redirect.regexCaption': '캡처 그룹에 일치한 텍스트가 목적지 URL 주소에 치환되어 들어갑니다.',
  'workbench.docs.body.redirect.wontApplyCaption':
    '리디렉션은 이미 불러온 페이지에 소급 적용되지 않습니다. 루프는 Chrome 브라우저가 조용히 끊습니다.',
  'workbench.docs.body.redirect.whenTitle': '쓰는 때',
  'workbench.docs.body.redirect.when1':
    'HTTP → HTTPS 강제, 옛 도메인에서 사용자 이전, API 버전 재작성, CDN 트래픽을 로컬 개발 서버로 돌리기가 전형적인 패턴 넷입니다. 미리 아는 전체 URL 주소에는 정적을 짝짓고, 경로가 리디렉션을 통과해 이어져야 하면 정규식을 쓰세요.',
  'workbench.docs.body.redirect.useCasesCaption':
    '전형적인 패턴 넷. 목적지 경로가 일치 내용에 달려 있으면 정규식을 고르세요.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix': '요청이 브라우저를 떠나기 전에 URL 쿼리 매개변수를 수정합니다. DNR',
  'workbench.docs.body.queryParam.introSuffix': '작업으로 컴파일됩니다.',
  'workbench.docs.body.queryParam.addTitle': '추가 / 바꾸기',
  'workbench.docs.body.queryParam.add1': '매개변수가 없으면 추가하고, 이미 있으면 값을 바꿉니다.',
  'workbench.docs.body.queryParam.addCaption':
    '없으면 추가, 있으면 바꾸기. 항상 내 값을 가진 일치 매개변수 하나가 됩니다.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': '바꾸기만',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': '값을 바꾸되',
  'workbench.docs.body.queryParam.replaceOnlyStrong': '매개변수가 이미 있을 때만',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '바꿉니다. 매개변수가 없는 URL 주소는 손대지 않습니다. 원래 없던 URL 주소에 끼워 넣지 않으면서 값을 정규화할 때 쓰세요 (예: 어떤 지역이든 이미 지닌 URL 주소에',
  'workbench.docs.body.queryParam.replaceOnly1Suffix': '값을 강제).',
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    '기존 값만 바꿉니다. 매개변수가 없는 URL 주소는 손대지 않습니다.',
  'workbench.docs.body.queryParam.removeTitle': '제거',
  'workbench.docs.body.queryParam.remove1': '특정 매개변수를 이름으로 제거합니다. 값은 무시됩니다.',
  'workbench.docs.body.queryParam.removeCaption': '지정한 매개변수가 사라지고, 다른 모든 쿼리 매개변수는 통과합니다.',
  'workbench.docs.body.queryParam.removeAllTitle': '모두 제거',
  'workbench.docs.body.queryParam.removeAll1':
    '쿼리 문자열 전체를 떼어 냅니다. 같은 규칙에서 추가 / 바꾸기와 함께 쓸 수 없습니다.',
  'workbench.docs.body.queryParam.removeAllCaption': '쿼리 전체를 한 번에 떼어 냅니다. URL 주소가 맨몸이 됩니다.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    '모두 제거는 DNR 계층에서 추가 / 바꾸기와 충돌합니다. 규칙 둘로 나누세요.',
  'workbench.docs.body.queryParam.whenTitle': '쓰는 때',
  'workbench.docs.body.queryParam.when1':
    '디버그 플래그 강제, 지역이나 로캘 정규화, 추적 매개변수 제거, 개인정보 보호를 위한 모든 쿼리 문자열 제거. 각각 위의 네 작업 중 하나에 깔끔하게 대응합니다.',
  'workbench.docs.body.queryParam.useCasesCaption': '전형적인 패턴 넷. 의도에 맞는 작업을 고르세요.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    '일치하는 페이지에 JavaScript 또는 CSS 코드를 삽입합니다. 코드는 콘텐츠 스크립트를 통해 페이지 컨텍스트에서 실행됩니다.',
  'workbench.docs.body.inject.timingCaption':
    '삽입 시점. 페이지 스크립트 전 (가능한 한 빨리) 대 DOM 안전 (페이지 로드 후).',
  'workbench.docs.body.inject.scriptTitle': '스크립트 삽입',
  'workbench.docs.body.inject.script1': '인라인 코드 또는 외부 URL 주소. 삽입 시점을 고르세요:',
  'workbench.docs.body.inject.asapStrong': '가능한 한 빨리',
  'workbench.docs.body.inject.asap1':
    ': 페이지 자체 스크립트보다 먼저 실행됩니다. 경쟁에서 이겨야 하는 몽키 패치에 유용합니다 (예: 앱 코드가 참조를 잡기 전에',
  'workbench.docs.body.inject.asap1Suffix': '함수를 감싸기).',
  'workbench.docs.body.inject.afterStrong': '페이지 로드 후',
  'workbench.docs.body.inject.after1':
    ': 페이지 파싱이 끝난 뒤 실행됩니다. 요소의 존재가 보장되므로 DOM 트리를 읽는 코드에 더 안전한 기본값입니다.',
  'workbench.docs.body.inject.scriptCaption':
    '스크립트는 <script> 태그로 페이지에 들어갑니다. 페이지 JS 코드와 같은 전역을 봅니다.',
  'workbench.docs.body.inject.cssTitle': 'CSS 삽입',
  'workbench.docs.body.inject.css1Prefix': '사용자 지정 CSS 코드를',
  'workbench.docs.body.inject.css1Suffix':
    '태그로 삽입합니다. 다크 모드 재정의, 시끄러운 요소 숨기기, 환경별 테마에 유용합니다.',
  'workbench.docs.body.inject.cssCaption': 'CSS 코드는 보통의 CSS 우선순위를 가진 <style> 태그로 덧붙습니다.',
  'workbench.docs.body.inject.wontApplyCaption':
    '샌드박스 iframe 프레임과 엄격한 CSP 정책의 페이지는 삽입된 스크립트를 막습니다.',
  'workbench.docs.body.inject.whenTitle': '쓰는 때',
  'workbench.docs.body.inject.when1':
    '앱 코드가 잡기 전에 브라우저 API 기능을 몽키 패치하기, 다크 모드 테마 강제, 시끄러운 UI 요소 숨기기, 페이지 초기화 전에 window 수준 기능 플래그 심기.',
  'workbench.docs.body.inject.useCasesCaption': '전형적인 패턴 넷. 첫째와 넷째에는 “가능한 한 빨리” 시점이 필요합니다.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    '일치하는 요청에 인위적인 지연을 더합니다. 요청 종류에 따라 세 차선이 병렬로 움직입니다.',
  'workbench.docs.body.delay.routingCaption': '지연 라우팅. 세 가지 요청 종류에 세 차선.',
  'workbench.docs.body.delay.navHeading': '문서 및 iframe 탐색',
  'workbench.docs.body.delay.nav1Prefix': '로컬 대기 페이지를 거칩니다. 최대',
  'workbench.docs.body.delay.navMs': '30,000 ms',
  'workbench.docs.body.delay.nav1Suffix': '값까지의 지연을 지킵니다. Chrome 브라우저의 DNR 리디렉션 상한입니다.',
  'workbench.docs.body.delay.navCaption': '로컬 대기 페이지가 탐색을 N ms 동안 붙잡았다가 실제 대상으로 넘깁니다.',
  'workbench.docs.body.delay.xhrHeading': 'JS 코드가 시작한 XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': '다음 함수의',
  'workbench.docs.body.delay.xhr1Middle': '몽키 패치가 가로챕니다. 상한은',
  'workbench.docs.body.delay.xhrMs': '5,000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    '값입니다. Chrome 브라우저의 HTTP 연결 풀이 고갈되지 않도록 하기 위해서이며, 그보다 큰 값은 전송선에서 잘립니다.',
  'workbench.docs.body.delay.xhrCaption':
    '페이지 수준 패치 안의 setTimeout 함수가 호출을 붙잡았다가 네트워크로 넘깁니다.',
  'workbench.docs.body.delay.wontApplyCaption':
    '하위 리소스와 서비스 워커 fetch 요청은 페이지 수준 몽키 패치를 벗어납니다.',
  'workbench.docs.body.delay.whenTitle': '쓰는 때',
  'workbench.docs.body.delay.when1':
    '로딩 상태 회귀 드러내기, 디바운스 / 스로틀 코드 경로 시험하기, 동시 요청 사이의 경쟁 조건 노출하기, 로컬 개발 중 느린 네트워크 조건 흉내 내기.',
  'workbench.docs.body.delay.useCasesCaption': '전형적인 패턴 넷. URL 패턴이나 도메인과 짝지어 범위를 좁히세요.',
  'workbench.docs.body.delay.desktopNoteTitle': '데스크톱 앱 — 제품 참고',
  'workbench.docs.body.delay.desktopNote1':
    '정적 리소스 (이미지, 스크립트, 스타일시트, 글꼴)의 스로틀링에는 연결을 열어 두고 바이트를 스트리밍할 수 있는 실제 로컬 네트워크 계층이 필요합니다. 확장 프로그램으로는 닿을 수 없습니다. 데스크톱 앱이 곧 이를 맡습니다.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    '요청 본문이 브라우저를 떠나기 전에 재정의하거나 변환합니다. 스크립트 기반이며, 가로채는 대상은',
  'workbench.docs.body.requestBody.introAnd': '및',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    '규칙은 page.js 파일과 네트워크 사이에서 실행됩니다. 변환 모양은 셋',
  'workbench.docs.body.requestBody.staticTitle': '정적 본문',
  'workbench.docs.body.requestBody.static1':
    '요청 본문 전체를 고정 문자열로 바꿉니다. REST 방식과 GraphQL 방식 모두에 통합니다. 규칙은 본문을 파싱하지 않고 통째로 치환합니다.',
  'workbench.docs.body.requestBody.staticCaption': '본문 전체가 바뀝니다. 원본은 버려집니다.',
  'workbench.docs.body.requestBody.dynamicTitle': '동적 본문',
  'workbench.docs.body.requestBody.dynamic1':
    '원래 본문과 요청 컨텍스트를 받아 수정한 본문을 반환하는 함수를 작성합니다. 함수가 받는 인자는',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': '함수는 원본을 보고, 보내야 할 것을 반환합니다.',
  'workbench.docs.body.requestBody.graphqlTitle': 'GraphQL 필터',
  'workbench.docs.body.requestBody.graphql1Prefix':
    '리소스 유형이 GraphQL 유형이면 규칙은 JSON 페이로드의 설정된 필드가 값과 일치하는 요청에서만 실행됩니다. 런타임은 요청 본문을 JSON 형식으로 파싱하고,',
  'workbench.docs.body.requestBody.graphql1Middle': '값이 가리키는 필드를 읽어, 고른 연산자 (완전 일치는',
  'workbench.docs.body.requestBody.graphql1Middle2': ', 부분 문자열은',
  'workbench.docs.body.requestBody.graphql1Middle3': ')로',
  'workbench.docs.body.requestBody.graphql1Suffix': '값과 대조합니다.',
  'workbench.docs.body.requestBody.graphql2Prefix': '흔한 키: 이름 붙은 작업에는',
  'workbench.docs.body.requestBody.graphql2Middle': ', 쿼리 텍스트의 부분 문자열에는',
  'workbench.docs.body.requestBody.graphql2Suffix':
    '. JSON 본문이 없거나, 필드가 없거나 일치하지 않는 요청은 손대지 않고 통과합니다.',
  'workbench.docs.body.requestBody.graphqlCaption': '필드 수준 관문. 일치하지 않는 작업은 손대지 않고 흘러갑니다.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'GET/HEAD 요청에는 바꿀 것이 없고, 정적 리소스는 스크립트 가로채기에 들어오지 않습니다.',
  'workbench.docs.body.requestBody.whenTitle': '쓰는 때',
  'workbench.docs.body.requestBody.when1':
    '테스트 픽스처 강제, 모든 페이로드에 메타데이터 (디버그 플래그, 요청 ID) 찍기, 특정 GraphQL 작업 모의, 재생 전 PII 정보 익명화가 전형적인 패턴 넷입니다.',
  'workbench.docs.body.requestBody.useCasesCaption': '전형적인 패턴 넷. URL 패턴이나 도메인과 짝지어 범위를 좁히세요.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'API 호출을 가로채 사용자 지정 응답을 반환합니다. 상태 코드, 본문, 응답 헤더를 완전히 제어합니다. 스크립트 기반이며, 가로채는 대상은',
  'workbench.docs.body.response.introAnd': '및',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    '정적은 네트워크를 완전히 건너뛰고, 동적은 먼저 네트워크에 갔다가 변환합니다.',
  'workbench.docs.body.response.staticTitle': '정적 응답',
  'workbench.docs.body.response.static1':
    '합성 응답을 완전히 제어하며 고정 본문을 반환합니다. 상태 코드, Content-Type, 그리고 추가 응답 헤더 (Set-Cookie, CORS 헤더, 사용자 지정 플래그). 실제 요청은 절대 보내지 않습니다. 알려진 픽스처를 상대로 하는 오프라인 개발에 유용합니다.',
  'workbench.docs.body.response.staticCaption':
    '서버에는 절대 접촉하지 않습니다. 페이지는 전송선에서 온 것처럼 픽스처를 받습니다.',
  'workbench.docs.body.response.dynamicTitle': '동적 응답',
  'workbench.docs.body.response.dynamic1':
    '실제 요청을 먼저 보냅니다. 함수가 응답과 요청 컨텍스트를 받아 수정한 응답을 반환합니다. 함수가 받는 인자는',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    '규칙에 설정한 상태 코드, Content-Type, 응답 헤더 필드는 함수 반환값 위에 그대로 적용되므로, 본문을 바꾸면서 래퍼 헤더는 규칙이 제어하게 둘 수 있습니다.',
  'workbench.docs.body.response.dynamicCaption': '실제 호출이 먼저 일어나고, 함수가 돌아온 것을 다시 씁니다.',
  'workbench.docs.body.response.graphqlTitle': 'GraphQL 필터',
  'workbench.docs.body.response.graphql1':
    '리소스 유형이 GraphQL 유형이면 규칙은 JSON 페이로드의 설정된 필드가 설정한 값과 일치하는 (같음 또는 포함) 요청에서만 실행됩니다. 그래서 많은 작업을 다중화하는 엔드포인트 하나를 한 번에 작업 하나씩 가로챌 수 있습니다. 페이로드가 일치하지 않는 요청은 손대지 않고 곧장 네트워크로 통과합니다.',
  'workbench.docs.body.response.wontApplyCaption':
    '정적 리소스와 페이지 탐색은 스크립트 가로채기에 절대 들어오지 않습니다.',
  'workbench.docs.body.response.whenTitle': '쓰는 때',
  'workbench.docs.body.response.when1':
    '픽스처를 상대로 하는 오프라인 개발, 특정 오류 응답 시뮬레이션, 페이지에 닿기 전 PII 정보 가리기, 실제 백엔드로는 재현하기 어려운 특이한 페이로드 모양 시험하기.',
  'workbench.docs.body.response.useCasesCaption':
    '전형적인 패턴 넷. 픽스처에는 정적을, 실제 데이터 변환에는 동적을 고르세요.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    '조건은 나가는 요청의 속성 하나에 대한 필터입니다. 조건을 여러 개 쌓으면 AND 논리로 결합됩니다. 규칙이 실행되려면 모든 조건이 일치해야 합니다. 각 조건은 Chrome 브라우저의',
  'workbench.docs.body.conditions.intro1Suffix': '필드에 직접 대응합니다.',
  'workbench.docs.body.conditions.intro2Prefix': '대부분의 조건에는 규칙 편집기에',
  'workbench.docs.body.conditions.exclStrong': '제외',
  'workbench.docs.body.conditions.intro2Suffix':
    '변형 (메서드 제외, 리소스 제외, 발신자 제외, 응답 헤더 제외)이 있어 일치를 뒤집습니다 (예: “이 메서드들을 뺀 전부”). 부정 집합이 긍정 집합보다 작을 때마다 쓰세요.',
  'workbench.docs.body.conditions.anatomyCaption':
    '규칙은 AND 조건으로 일치하는 조건과 작업 하나를 짝짓습니다. 규칙 실행 여부는 조건이 정합니다.',
  'workbench.docs.body.conditions.matchingCaption':
    '각 조건은 요청 속성 하나를 검사합니다. 규칙이 실행되려면 모두 일치해야 합니다.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    '페이지 URL 주소와 fetch 요청의 목적지 URL 주소는 따로 추적됩니다. 도메인 조건이 둘인 이유입니다.',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL 패턴',
  'workbench.docs.body.conditions.urlPattern1Prefix':
    '전체 URL 주소에 대한 와일드카드 패턴입니다. 임의의 문자에 일치시키려면',
  'workbench.docs.body.conditions.urlPattern1Middle': '문자를 쓰세요. 프로토콜은 반드시 지정해야 합니다:',
  'workbench.docs.body.conditions.urlPattern1Middle2': '형식은 아무 프로토콜,',
  'workbench.docs.body.conditions.urlPattern1Suffix': '형식은 HTTPS 연결만입니다.',
  'workbench.docs.body.conditions.urlPatternCaption':
    '금색 = 와일드카드, 초록 = 리터럴. 아래 각 테스트 URL 주소는 패턴이 일치하는지 보여 줍니다.',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL 정규식',
  'workbench.docs.body.conditions.urlRegex1':
    '프로토콜을 포함한 전체 URL 주소에 대한 RE2 정규 표현식입니다. 와일드카드로 표현할 수 없는 일치를 위한 것입니다. 같은 규칙에서 URL 패턴과 함께 쓸 수 없습니다.',
  'workbench.docs.body.conditions.urlRegexCaption':
    '보라 = 실제 정규식 문법. 초록 = 리터럴 문자. 아래 각 테스트 URL 주소는 정규식이 일치하는지 보여 줍니다.',
  'workbench.docs.body.conditions.requestDomainsTitle': '요청 도메인',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    '도메인과 그 모든 하위 도메인에 자동으로 일치합니다. 최상위 도메인을 한 번 입력하면 규칙이',
  'workbench.docs.body.conditions.requestDomains1Suffix': ', 그리고 더 깊은 중첩까지 와일드카드 없이 다룹니다.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    '값 하나, 모든 하위 도메인. 아래 경계 사례는 무엇이 진짜 하위 도메인으로 치는지 보여 줍니다.',
  'workbench.docs.body.conditions.excludeDomainsTitle': '도메인 제외',
  'workbench.docs.body.conditions.excludeDomains1':
    '다른 조건의 일치에서 호스트를 뺍니다. 요청 도메인과 같은 하위 도메인 의미를 쓰므로, 호스트를 제외하면 그 하위 도메인도 제외됩니다. 단독으로는 아무것에도 일치하지 않습니다.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    '초록 포함이 후보 집합으로 좁히고, 빨강 제외가 그중 일부를 뺍니다. 하위 도메인도 따라갑니다.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': '발신자 도메인',
  'workbench.docs.body.conditions.initiatorDomains1':
    '요청을 보낼 때 어떤 페이지가 열려 있는지로 일치시킵니다. 요청의 목적지가 아니라 출처입니다. 같은 URL 주소로의 같은 fetch 호출도 사용자가 어느 탭을 보고 있느냐에 따라 일치하거나 빗나갈 수 있습니다.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    '같은 목적지, 서로 다른 페이지 컨텍스트 둘. 어느 쪽이 일치하는지는 발신자가 정합니다.',
  'workbench.docs.body.conditions.methodsTitle': '메서드',
  'workbench.docs.body.conditions.methods1':
    'HTTP 동사로 거릅니다. 다중 선택입니다. 일치해야 할 메서드를 고르면 나머지는 규칙을 실행하지 않습니다. 모든 메서드에 일치시키려면 조건을 아예 끄세요.',
  'workbench.docs.body.conditions.methodsCaption':
    '주황 알약은 선택됨, 회색은 건너뜀. 아래 테스트 요청은 각 동사의 결과를 따라갑니다.',
  'workbench.docs.body.conditions.resourceTypesTitle': '리소스 유형',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    '불러오는 리소스의 종류로 거릅니다. 페이지 탐색, XHR/fetch, 스크립트, 이미지, 글꼴 등. 메서드처럼 다중 선택입니다. 코드 이름과 구체적인 예시가 딸린 전체 목록은',
  'workbench.docs.body.conditions.resourceTypesLink': '리소스 유형',
  'workbench.docs.body.conditions.resourceTypes1Suffix': '참고 자료를 보세요.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    '보라 종류는 일치, 회색 종류는 건너뜀. 각 테스트 요청은 자기 종류를 인라인으로 보여 줍니다.',
  'workbench.docs.body.conditions.domainTypeTitle': '도메인 종류',
  'workbench.docs.body.conditions.domainType1Prefix':
    '각 요청을 페이지와의 관계로 분류합니다. 목적지가 페이지의 등록 가능 도메인을 공유하면',
  'workbench.docs.body.conditions.domainType1Middle': ', 그렇지 않으면',
  'workbench.docs.body.conditions.domainType1Suffix':
    '값입니다. 흔한 용도: 추적기 차단 (thirdParty 값에만 일치) 또는 자기 서비스로 규칙 범위 한정 (firstParty 값에만 일치).',
  'workbench.docs.body.conditions.domainTypeCaption':
    '페이지 배너가 출처를 정하고, 선택기가 어느 종류에 일치할지 고르며, 표가 목적지별 판정을 보여 줍니다.',
  'workbench.docs.body.conditions.headersTitle': '응답 헤더',
  'workbench.docs.body.conditions.headers1':
    '특정 헤더를 특정 값으로 지닌 응답에 일치합니다. Chrome 브라우저의 DNR 엔진은 요청 헤더 일치를 노출하지 않으므로 이 조건은 응답 쪽 전용입니다. 헤더 이름과 값 모두 정확한 문자열로 비교되며 (와일드카드 없음, 부분 일치 없음), 헤더가 실제로 응답에 있어야 합니다.',
  'workbench.docs.body.conditions.headersCaption':
    '알약 둘 (이름 + 값)을 = 기호로 잇고, 각 실패 모드에 부딪히는 테스트 응답 헤더를 보여 줍니다.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': '확장 프로그램 하나에 전부',
  'workbench.docs.body.paradigm.oneExtension1':
    '역사적으로 이 영역은 세 제품 범주가 나눠 가졌습니다: 데스크톱 프록시가 HTTP 가로채기를 맡고, 클라우드 API 플랫폼이 요청과 컬렉션을 보관하고, 가벼운 헤더 확장 프로그램이 “헤더 하나만 다시 쓰기” 경우를 맡았습니다. 어느 것도 나머지를 제공하지 않습니다. Open Headers 확장 프로그램은 제공합니다. 브라우저 확장 프로그램 하나 안에서, 모든 화면을 움직이는 워크스페이스 저장소 하나로.',
  'workbench.docs.body.paradigm.convergenceCaption':
    '세 기존 범주가 설치 하나로 수렴합니다. 이 조합을 확장 프로그램 안에서 제공하는 곳은 달리 없습니다.',
  'workbench.docs.body.paradigm.ruleEngineHeading': '엔터프라이즈급 규칙 엔진',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    '규칙 엔진은 UI 아홉 개에 걸쳐 늘여 놓은 재주 하나가 아닙니다. 공유 언어 하나를 얹은 진짜 실행 경로 둘입니다.',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR 네이티브',
  'workbench.docs.body.paradigm.ruleEngine1Middle': '규칙은 Chrome 브라우저의',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API 기능으로 컴파일되어 브라우저가 보내는 모든 요청 (페이지, 하위 프레임, fetch, XHR, 이미지, 글꼴, 스크립트)을 잡습니다.',
  'workbench.docs.body.paradigm.scriptEngineStrong': '스크립트 엔진',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    '은 DNR 엔진이 닿지 못하는 곳을 이어받습니다. 헤더 값 병합, 본문 변환, 응답 모의, 코드 삽입, 호출 지연. 두 엔진은 같은 조건 언어와 같은 다섯 변수 범위를 읽으므로, DNR 방식으로 쓴 규칙은 작업 유형 하나만 바꾸면 스크립트 엔진으로 옮겨 갑니다.',
  'workbench.docs.body.paradigm.ruleEngineCaption': '실행 경로 둘, 규칙 범주 아홉, 공유 조건 + 변수 언어 하나.',
  'workbench.docs.body.paradigm.apiCatalogHeading': '완전한 API 요청 카탈로그',
  'workbench.docs.body.paradigm.apiCatalog1':
    '데스크톱 API 클라이언트가 제공하는 모든 기능이 확장 프로그램 안에 있습니다. 요청 작성, 환경, OAuth 2.0 (PKCE + Client Credentials + 갱신 포함), 요청 전 / 응답 후 스크립트, 콘텐츠 주소 기반 파일 블롭을 쓰는 멀티파트, 컬렉션 + 폴더, 스키마 인트로스펙션이 있는 GraphQL. 규칙과 같은 워크스페이스 저장소, 같은 다섯 변수 범위, 같은 화면. 다른 플랫폼의 컬렉션을 가져와 계속 작업하세요. 통제하지 못하는 클라우드로 되돌아 나가는 것은 없습니다.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    '프로토콜 지원, 모든 인증 유형, 스크립트, 파일, 컬렉션을 갖춘 요청 편집기. 확장 프로그램 안에.',
  'workbench.docs.body.paradigm.localFirstHeading': '설계부터 로컬 우선',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '“로컬 우선”은 기능이 아니라 자세입니다. 확장 프로그램에는 계정 시스템도, 클라우드 중계도, 추적도 없습니다. 유일한 사용 데이터는 익명의 기능 집계이며, 바이트 단위로 들여다볼 수 있고 스위치 하나로 끕니다. 그리고 백엔드가',
  'workbench.docs.body.paradigm.localFirstWhere': '어디에',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    '사는지도 실제로 고를 수 있습니다. 호스팅 선택지 넷, 모두 로컬 전용, 모두 내 통제 아래: 브라우저 내 서비스 워커 (지금, 설정 없음), 데스크톱 앱의 내장 백엔드, 한 컴퓨터에서 모든 Open Headers 화면을 제공하는 독립 로컬 서버, 또는 내 VM 환경에 직접 호스팅하는 백엔드. 어느 선택지든 같은 보장을 지키며, 절충되는 것은 소유권이 아니라 도달 범위입니다.',
  'workbench.docs.body.paradigm.localFirst2':
    '팀 협업은 사용자가 통제하는 저장 백엔드 (Git)를 통해 제공됩니다. 공급업체 서버를 통하지 않습니다.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': '같은 원칙이 그 데이터에',
  'workbench.docs.body.paradigm.frontEndsHow': '어떻게',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    '닿는지에도 적용됩니다. 브라우저 확장 프로그램이 기본 프런트엔드입니다. 브라우저 안의 화면 넷. 네이티브 데스크톱 앱, CLI, 원격 웹 앱이 그 곁에 함께 제공됩니다. 모든 프런트엔드는 내가 고른 백엔드와 대화합니다. 어떤 조합이든 고르세요. 모든 화면이 동기화된 채로 있습니다.',
  'workbench.docs.body.paradigm.autoSyncHeading': '작업을 잃지 않는 자동 동기화',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    '기기 간 동기화는 보통 로컬 우선 제품이 접히면서 자기 클라우드를 믿으라고 하는 지점입니다. Open Headers 확장 프로그램은 이를',
  'workbench.docs.body.paradigm.perFieldStrong': '필드 단위',
  'workbench.docs.body.paradigm.autoSync1Middle': '수준에서 풉니다: 팝업이 규칙의',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    '플래그를 전환하는 것과 워크벤치가 같은 규칙의 헤더 값을 다시 쓰는 것이 어느 순서로든 둘 다 반영되며, 오래된 초안 배너도 덮어쓰기도 없습니다. 같은 접근이 확장 프로그램 하나의 화면 넷에서, 확장 프로그램 + 데스크톱 + CLI 도구를 뒷받침하는 로컬 서버로, 그리고 Git 원격을 통한 다중 사용자 팀 워크스페이스로 확장됩니다. 중간에 공급업체 서버가 필요한 일은 결코 없습니다.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    '화면 둘, 규칙 하나, 다른 필드. 두 편집이 모두 반영되고, 아무것도 덮어쓰이지 않습니다.',
  'workbench.docs.body.paradigm.noteCalloutPrefix': '써 봤을지 모를 다른 도구와 어떻게 다른지 보고 싶나요? 다음은',
  'workbench.docs.body.paradigm.comparisonLink': '비교',
  'workbench.docs.body.paradigm.noteCalloutMiddle': '입니다. 플랫폼 전체를 한눈에 보고 싶나요? 다음으로 건너뛰세요:',
  'workbench.docs.body.paradigm.roadmapLink': '모든 화면, 출시 완료',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    '가장 짧은 설명: Open Headers 확장 프로그램은 데스크톱 프록시의 요청 성형 능력, 클라우드 API 플랫폼의 규칙 라이브러리, 헤더 전용 확장 프로그램의 상시 화면을 가져다 저장소 하나를 공유하게 했을 때 나오는 것입니다.',
  'workbench.docs.body.comparison.matrixCaption':
    '세 제품 범주, 각각의 절충점 한 묶음. 그리고 Open Headers 확장 프로그램이 서는 자리.',
  'workbench.docs.body.comparison.vsCloudHeading': '클라우드 API 플랫폼과 비교',
  'workbench.docs.body.comparison.vsCloud1':
    '클라우드 호스팅 도구는 트래픽, 자격 증명, 규칙 정의가 자기 서버에 살기를 기대합니다. 그 모델은 그 데이터가 내 컴퓨터를 떠나도 괜찮다고, 그리고 내 작업에 접근하려고 계정을 유지해도 괜찮다고 가정합니다. Open Headers 확장 프로그램은 어느 쪽도 가정하지 않습니다. 모든 것이 로컬에 남고, 팀 협업은 공급업체의 데이터베이스가 아니라 사용자가 통제하는 저장소 (Git)를 통해 제공됩니다.',
  'workbench.docs.body.comparison.vsProxiesHeading': '데스크톱 프록시와 비교',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    '프록시는 전체 트래픽을 별도 프로세스로 돌립니다. 강력하지만 무겁습니다: 바이너리 설치, CA 인증서 설치, 앱마다 프록시 포트를 가리키도록 설정. Open Headers 확장 프로그램은 정적 트래픽에 Chrome 브라우저의',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API 기능을, 동적 변환에 페이지별 스크립트 엔진을 씁니다. 프록시 포트도, CA 인증서도, 앱별 설정도 없습니다. 그리고 일치한 규칙은 중간자의 권한이 아니라 페이지 자체의 권한으로 적용됩니다.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': '헤더 전용 확장 프로그램과 비교',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    '헤더 전용 확장 프로그램은 정확히 규칙 유형 하나를 다루고 거기서 멈춥니다. Open Headers 확장 프로그램은',
  'workbench.docs.body.comparison.nineLink': '아홉 가지',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle': '를 다룹니다. 헤더 추가 / 바꾸기 / 덧붙이기 / 제거 / 병합,',
  'workbench.docs.body.comparison.blockLink': '차단',
  'workbench.docs.body.comparison.redirectLink': '리디렉션',
  'workbench.docs.body.comparison.queryParamsLink': '쿼리 매개변수',
  'workbench.docs.body.comparison.injectLink': '삽입',
  'workbench.docs.body.comparison.delayLink': '지연',
  'workbench.docs.body.comparison.requestBodyLink': '요청 본문',
  'workbench.docs.body.comparison.responseLink': '응답',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '. 모두 같은',
  'workbench.docs.body.comparison.conditionLanguageLink': '조건 언어',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': '로 움직이고, 모두 같은',
  'workbench.docs.body.comparison.requestTrackingLink': '요청 추적',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': '화면으로 관찰할 수 있습니다.',
  'workbench.docs.body.comparison.whyMattersTitle': '실제로 왜 중요한가',
  'workbench.docs.body.comparison.whyMatters1':
    '대부분의 워크플로는 이 범주 중 둘 이상에 걸칩니다. API 응답 모의, 서드 파티 추적기 차단, 특정 환경 하나에 디버그 헤더 강제는 서로 다른 규칙 유형 셋입니다. 기존 세계에서는 설치 셋입니다. 여기서는 워크스페이스 하나를 공유합니다.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers 확장 프로그램은 로컬 전용으로 시작했습니다. 기기 하나의 확장 프로그램 하나. 아래 모든 이정표는 그 모양을 깨지 않고 넓히며, 모두 이미 출시되었습니다. 사용자 간 동기화는',
  'workbench.docs.body.roadmap.userControlledStrong': '사용자가 통제하는',
  'workbench.docs.body.roadmap.intro1Suffix':
    '수단 (Git 저장소와 자체 호스팅 배포)으로 제공되며, 공급업체가 호스팅하는 클라우드는 결코 쓰지 않습니다.',
  'workbench.docs.body.roadmap.gitHeading': 'Git 저장소를 통한 워크스페이스 협업 (팀 준비 완료)',
  'workbench.docs.body.roadmap.git1Prefix':
    '워크스페이스는 내가 통제하는 Git 저장소에 YAML 형식으로 직렬화됩니다. 풀은 동기화하고, 푸시는 공유하며, 병합 충돌은 Git 도구의 기존 방식으로 해결합니다. 중앙 서버도, 계정도, 공급업체 종속도 없습니다. 실시간 존재감은',
  'workbench.docs.body.roadmap.gitAnd': '및',
  'workbench.docs.body.roadmap.git1Suffix': '명령입니다. 오래가고, 감사할 수 있고, 이미 익숙한 것.',
  'workbench.docs.body.roadmap.desktopHeading': '데스크톱 앱',
  'workbench.docs.body.roadmap.desktop1':
    '확장 프로그램과 같은 워크스페이스 저장소를 실행하는 네이티브 바이너리입니다. 확장 프로그램이 닿지 못하는 화면에 유용합니다. 시스템 수준 트래픽 성형, 다중 창 편집, 더 깊은 파일 시스템 통합. 둘은 같은 디스크 형식을 공유하므로, 확장 프로그램이 소유한 워크스페이스를 데스크톱 앱에서 여는 것은 마이그레이션이 아니라 읽기입니다.',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP 서버 — AI 에이전트 제어',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers 확장 프로그램은',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    '규격으로 자신을 노출하므로, MCP 규격을 지원하는 어떤 AI 클라이언트든 (Claude Desktop, Claude Code, Cursor, VS Code, Cline, 그리고 그 뒤에서 자라는 생태계) 워크스페이스를 직접 움직일 수 있습니다. 에이전트에게 일상 언어로 헤더 규칙 추가, 스테이징에 저장된 요청 실행, 환경 전환, 워크스페이스 둘 비교, Postman 컬렉션 가져오기를 부탁하세요. 에이전트가 이를 MCP 도구 호출로 옮기고, 워크벤치에 결과가 반영됩니다.',
  'workbench.docs.body.roadmap.mcp2Prefix': '서버는 기본적으로',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': '로컬 전용',
  'workbench.docs.body.roadmap.mcp2Middle':
    '으로 실행되며 (stdio 전송, 같은 컴퓨터의 클라이언트 하나와 일대일 페어링), 자체 호스팅할 때는',
  'workbench.docs.body.roadmap.mcpRemoteStrong': '원격용 HTTP/SSE',
  'workbench.docs.body.roadmap.mcp2Suffix':
    '전송을 씁니다. 공급업체 중계는 없습니다. 에이전트는 내 설치본과 직접 대화합니다. 도구 호출은 내가 가진 것과 같은 워크스페이스 권한으로 실행됩니다. 시크릿은 vault 저장소 뒤에 남고, 민감한 작업은 명시적 허용이 필요한 채로 남습니다.',
  'workbench.docs.body.roadmap.serverHeading': '기기 간 동기화를 위한 로컬 / LAN 서버',
  'workbench.docs.body.roadmap.server1':
    '내 컴퓨터, 내 LAN 네트워크, 또는 터널링된 호스트에서 실행할 수 있는 서버입니다. 확장 프로그램, 데스크톱 앱, CLI 도구가 모두 같은 서버의 클라이언트가 됩니다. 쓰는 모든 기기에서 같은 워크스페이스, 같은 규칙, 같은 vault. 서버는 로컬 네트워크에 머물며, 그 위에 얹힌 선택적 클라우드 경로는 없습니다.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    '헤드리스 스크립팅과 CI 통합입니다. 규칙 나열, 환경 전환, 셸에서 저장된 요청 하나 실행, 워크스페이스를 다른 것과 비교. CLI 도구는 확장 프로그램 및 데스크톱 앱과 같은 서버와 대화하므로, 자동화가 UI 화면에서 보는 것과 동기화된 채로 있습니다.',
  'workbench.docs.body.roadmap.webAppHeading': '자체 호스팅 VM 배포 + 웹 앱',
  'workbench.docs.body.roadmap.webApp1':
    '같은 UI 화면을 내 출처에서 제공할 수 있는 웹 번들로 만든 것입니다. 잠긴 회사 브라우저, 키오스크 기기, 확장 프로그램 설치가 선택지가 아닌 모든 환경, 그리고 자기 도메인 아래 브랜드를 입힌 Open Headers 배포를 원하는 사용자를 위한 것입니다.',
  'workbench.docs.body.roadmap.importersHeading': '가져오기 도구',
  'workbench.docs.body.roadmap.importers1':
    'cURL / HAR / Postman 가져오기와 함께: Insomnia 컬렉션, OpenAPI 사양, 전체 HAR 요청 가져오기 (헤더만이 아님). 모두 지금 쓸 수 있습니다. 가져오기 도구의 동등성은 이미 다른 도구에 투자한 사람들로부터 Open Headers 확장 프로그램이 채택을 얻어 내는 방법입니다. 한 단계로 컬렉션을 가져오고, 계속 작업하세요.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': '호스팅된 클라우드 백엔드는요?',
  'workbench.docs.body.roadmap.cloudCallout1':
    '당분간 메뉴에 없습니다. 클라우드 호스팅 백엔드를 원한다면 내 VM 환경에 직접 호스팅할 수 있습니다 (위 참조).',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': '추가 / 바꾸기',
  'workbench.docs.anchor.override.summary': '헤더를 이 값으로 설정합니다. 없으면 추가하고, 기존 값이 있으면 바꿉니다.',
  'workbench.docs.anchor.append.title': '덧붙이기',
  'workbench.docs.anchor.append.summary':
    '헤더의 기존 값에 이 값을 덧붙입니다. 표준 목록 값 헤더만 덧붙이기를 지원하며, 그 밖의 헤더에서는 규칙이 초안으로 저장됩니다.',
  'workbench.docs.anchor.remove.title': '제거',
  'workbench.docs.anchor.remove.summary': '일치하는 트래픽에서 헤더를 통째로 떼어 냅니다. 값 필드는 쓰이지 않습니다.',
  'workbench.docs.anchor.merge.title': '병합',
  'workbench.docs.anchor.merge.summary': '이 값을 헤더의 기존 목록에 병합하며, 이미 있는 값은 건너뜁니다.',
  'workbench.docs.anchor.qpAdd.title': '추가 / 바꾸기',
  'workbench.docs.anchor.qpAdd.summary': 'URL 주소에 매개변수를 설정합니다. 없으면 추가하고, 이미 있으면 바꿉니다.',
  'workbench.docs.anchor.qpOverride.title': '바꾸기만',
  'workbench.docs.anchor.qpOverride.summary':
    'URL 주소가 이미 매개변수를 지닐 때만 값을 바꿉니다. 없는 URL 주소는 바뀌지 않고 통과합니다.',
  'workbench.docs.anchor.qpRemove.title': '제거',
  'workbench.docs.anchor.qpRemove.summary': '일치하는 URL 주소에서 매개변수를 제거합니다.',
  'workbench.docs.anchor.qpRemoveAll.title': '모두 제거',
  'workbench.docs.anchor.qpRemoveAll.summary':
    '일치하는 URL 주소에서 쿼리 문자열 전체를 떼어 냅니다. 이것이 있는 동안 같은 규칙의 다른 작업은 무시됩니다.',
  'workbench.docs.anchor.urlPattern.title': 'URL 패턴',
  'workbench.docs.anchor.urlPattern.summary':
    '요청 URL 주소를 urlFilter 패턴과 대조합니다. * 와일드카드, || 도메인 앵커, ^ 구분자.',
  'workbench.docs.anchor.urlRegex.title': 'URL 정규식',
  'workbench.docs.anchor.urlRegex.summary':
    '요청 URL 주소를 정규 표현식과 대조합니다. 캡처 그룹은 리디렉션 대상의 \\1, \\2 치환에 공급됩니다.',
  'workbench.docs.anchor.requestDomains.title': '요청 도메인',
  'workbench.docs.anchor.requestDomains.summary':
    '대상 호스트가 나열된 도메인 중 하나인 요청에 일치합니다. 하위 도메인을 포함합니다.',
  'workbench.docs.anchor.excludeDomains.title': '도메인 제외',
  'workbench.docs.anchor.excludeDomains.summary': '대상 호스트가 나열된 것을 뺀 모든 요청에 일치합니다.',
  'workbench.docs.anchor.initiatorDomains.title': '발신자 도메인',
  'workbench.docs.anchor.initiatorDomains.summary':
    '요청 URL 주소 자체가 아니라 요청을 보낸 페이지로 일치시킵니다. 제외 변형은 목록을 뒤집습니다.',
  'workbench.docs.anchor.methods.title': '메서드',
  'workbench.docs.anchor.methods.summary': 'HTTP 메서드 (GET, POST, …)로 일치시킵니다. 제외 변형은 목록을 뒤집습니다.',
  'workbench.docs.anchor.conditionResourceTypes.title': '리소스 유형',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    '브라우저가 무엇을 가져오는지 (문서, 스크립트, XHR/fetch, 이미지, …)로 일치시킵니다. 제외 변형은 목록을 뒤집습니다.',
  'workbench.docs.anchor.domainType.title': '도메인 종류',
  'workbench.docs.anchor.domainType.summary':
    '퍼스트 파티는 페이지와 같은 사이트로의 요청에, 서드 파티는 사이트 간 요청에 일치합니다.',
  'workbench.docs.anchor.headers.title': '응답 헤더',
  'workbench.docs.anchor.headers.summary': '받은 응답의 헤더로 일치시킵니다. 존재 여부로, 또는 값이 주어지면 값으로.',
  'workbench.docs.anchor.redirectRegex.title': '정규식 치환',
  'workbench.docs.anchor.redirectRegex.summary':
    'URL 정규식 조건과 함께, \\1, \\2 … 형식이 캡처한 그룹을 리디렉션 대상에 끼워 넣습니다.',
  'workbench.docs.anchor.requestBodyDynamic.title': '동적 (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    '일치하는 각 요청에 대해 JavaScript 코드를 실행해 원본에서 나갈 본문을 만듭니다.',
  'workbench.docs.anchor.responseDynamic.title': '동적 (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    '일치하는 각 응답에 대해 JavaScript 코드를 실행합니다. 실제 응답을 변환하거나 (네트워크) 처음부터 만듭니다 (모의).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'GraphQL 작업 필터',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    '요청 페이로드에서 찾은 GraphQL 작업 이름으로 규칙을 추가로 거릅니다.',
  'workbench.docs.anchor.responseGraphql.title': 'GraphQL 작업 필터',
  'workbench.docs.anchor.responseGraphql.summary':
    '요청 페이로드에서 찾은 GraphQL 작업 이름으로 규칙을 추가로 거릅니다.',
} as const satisfies Catalog;
