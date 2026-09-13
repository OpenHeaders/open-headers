/**
 * Workbench Docs panel — the Debug Mode section body — Korean. Mirrors
 * `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI labels the
 * prose references copy the shipped `ko/shared-chrome.ts` strings
 * verbatim (연결 대상, DevTools 창이 열린 곳, 포커스된 탭, 둘 다, 이
 * 브라우저 탭 포함, 연결된 탭, 범위 밖의 탭, 시스템 상태, 디버그 모드);
 * 재정의 = the Overrides surface (panel mint); 연결 = attach (S100);
 * 알약 = pill (the docs nav mint); 켜짐 / 꺼짐 = the On / Off round
 * trip; the browser banner quote rides verbatim raw en inside “ ”.
 * MINTS: 디버그 모드 꺼짐 = the rules-list badge (a later ko
 * editors-rule rider must reuse); 표준 모드 = standard mode; 휴리스틱
 * 방식으로 대체됨 = fell back to heuristic; 교차 출처 = cross-origin;
 * 워커 = worker. Raw by design: the `● Debug mode` pill chip and the
 * `fetch` / `XHR` code chips composed by the section body (the
 * fragment after the `XHR` chip opens with a space and a head noun —
 * the render site joins that pair with none), `CSP` with 정책 as head
 * noun, Chromium / Firefox / Safari with 브라우저. Sandwich fragments
 * restructure SOV; the bold term opens its body with a head noun
 * (the render site joins `<strong>{term}</strong> {intro1}` with its
 * own space).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': '디버그 모드',
  'workbench.docs.body.debugMode.intro1':
    '기능은 Open Headers 확장 프로그램을 브라우저의 디버깅 프로토콜에 연결하여, 일반 확장 프로그램 API 기능으로는 닿을 수 없는 트래픽을 검사하고 변경할 수 있게 합니다. 브라우저 자체의 개발자 도구가 쓰는 것과 같은 장치이며, 그래서 켜져 있는 동안 브라우저는',
  'workbench.docs.body.debugMode.introBanner': '“OH started debugging this browser”',
  'workbench.docs.body.debugMode.intro1Suffix': '배너를 표시합니다.',
  'workbench.docs.body.debugMode.intro2':
    '표준 모드 (디버그 모드 꺼짐)만으로도 대부분의 규칙이 처리됩니다. 헤더, 차단, 리디렉션, 쿼리 매개변수, 그리고 페이지 컨텍스트의 본문 / 응답 / 삽입 규칙입니다. 디버그 모드는 그것들이 닿지 못하는 곳을 위한 선택적 강화입니다. 탐색, 워커, 교차 출처 프레임, 탭 전체의 환경 변경.',
  'workbench.docs.body.debugMode.controlHeading': '조작하는 곳',
  'workbench.docs.body.debugMode.control1Prefix': '이',
  'workbench.docs.body.debugMode.control1Middle': '알약은 모든 화면의 푸터에서',
  'workbench.docs.body.debugMode.systemStatusLink': '시스템 상태',
  'workbench.docs.body.debugMode.control1Suffix':
    '의 바로 왼쪽에 있습니다. 인라인 스위치로 켜고 끄며, 색 점이 상태를 따라가고, 점과 레이블을 누르면 나머지 전부, 즉 범위, 탭별 고정, 현재 연결된 탭 목록을 담은 팝오버가 열립니다.',
  'workbench.docs.body.debugMode.surfaceCaption':
    '인라인 스위치로 켜고, 점과 레이블로 나머지 전부를 담은 팝오버를 엽니다.',
  'workbench.docs.body.debugMode.scopeHeading': '검사할 대상 고르기',
  'workbench.docs.body.debugMode.scope1Prefix': '이',
  'workbench.docs.body.debugMode.attachTo': '연결 대상',
  'workbench.docs.body.debugMode.scope1Middle': '드롭다운이 디버그 모드가 어떤 탭에 연결될지 정합니다.',
  'workbench.docs.body.debugMode.scopeDevtools': 'DevTools 창이 열린 곳',
  'workbench.docs.body.debugMode.scope1DevtoolsParen': '(Open Headers 패널이 열린 탭만. 가장 좁은 기본값),',
  'workbench.docs.body.debugMode.scopeFocused': '포커스된 탭',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(전환에 따라 활성 탭을 따라감), 또는',
  'workbench.docs.body.debugMode.scopeBoth': '둘 다',
  'workbench.docs.body.debugMode.scope1BothParen': '(둘의 합집합).',
  'workbench.docs.body.debugMode.consent1Prefix': '범위를 고르는 것이',
  'workbench.docs.body.debugMode.consentIs': '곧',
  'workbench.docs.body.debugMode.consent1Middle':
    '브라우저 배너에 대한 동의입니다. 별도의 확인 창은 없습니다. 현재 탭이 아직 범위에 들어 있지 않으면',
  'workbench.docs.body.debugMode.includeTabPin': '이 브라우저 탭 포함',
  'workbench.docs.body.debugMode.consent1Suffix':
    '고정 항목이 나타나므로, 나머지의 범위를 넓히지 않고 그 탭 하나만 연결할 수 있습니다.',
  'workbench.docs.body.debugMode.attached1Prefix': '이',
  'workbench.docs.body.debugMode.attachedTabs': '연결된 탭',
  'workbench.docs.body.debugMode.attached1Suffix':
    '목록은 디버그 모드가 지금 구동 중인 모든 탭을 보여 주며, 각 탭에는 해당 탭으로 이동하는 작업이 있습니다. 연결 집합은 항상 범위, 고정, 열려 있는 패널에서 다시 계산되므로, 오래된 스냅샷이 아니라 현재를 반영합니다.',
  'workbench.docs.body.debugMode.scopeCaption':
    '연결 집합은 매번 도출됩니다. 다시 연결하면 재생될 뿐, 아무것도 저장되지 않습니다.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': '배너는 브라우저 전체에 표시됩니다',
  'workbench.docs.body.debugMode.banner1Prefix':
    '디버그 모드가 켜져 있는 동안 브라우저의 “OH started debugging this browser” 배너는',
  'workbench.docs.body.debugMode.bannerEvery': '모든',
  'workbench.docs.body.debugMode.banner1Suffix':
    '탭에 표시됩니다. 연결된 탭만이 아닙니다. 이는 브라우저 자체의 동작이며, 디버그 모드를 끄면 즉시 사라집니다.',
  'workbench.docs.body.debugMode.unlocksHeading': '무엇이 열리는가',
  'workbench.docs.body.debugMode.unlocksIntro': '연결된 탭에서는 규칙과 컨트롤이 페이지 컨텍스트 너머까지 닿습니다:',
  'workbench.docs.body.debugMode.anyRequestLead': '어떤 요청이든, 어떤 컨텍스트든.',
  'workbench.docs.body.debugMode.anyRequest1':
    '최상위 탐색, 워커 요청, 교차 출처 iframe 프레임을 모의하거나 다시 씁니다. 페이지의',
  'workbench.docs.body.debugMode.anyRequest2':
    ' 요청만이 아닙니다. 같은 컨텍스트에서 요청 및 응답 본문을 읽고 변환할 수 있으며, 개발 프록시와 스테이징의 HTTP 인증 챌린지에는 자동으로 응답합니다.',
  'workbench.docs.body.debugMode.injectionLead': '더 강한 삽입.',
  'workbench.docs.body.debugMode.injection1':
    '스크립트 삽입이 경쟁 조건 없이 CSP 정책에도 막히지 않게 되며, 표준 페이지 컨텍스트 경로가 닿지 못하는 워커와 교차 출처 프레임 안까지 닿습니다.',
  'workbench.docs.body.debugMode.tabEnvLead': '탭 환경.',
  'workbench.docs.body.debugMode.tabEnv1':
    '정확한 캐시 비활성화, 네트워크 스로틀링 / 오프라인, 그리고 user-agent / 로캘 / 시간대 / 미디어 재정의. 패널 도구 모음과',
  'workbench.docs.body.debugMode.overrides': '재정의',
  'workbench.docs.body.debugMode.tabEnv2': '화면에서 탭별로 설정합니다.',
  'workbench.docs.body.debugMode.reachCaption':
    '표준 모드는 페이지의 fetch / XHR 요청을 다루고, 연결된 탭은 같은 규칙을 그 밖의 모든 것으로 넓힙니다.',
  'workbench.docs.body.debugMode.silentHeading': '규칙은 조용히 실패하지 않습니다',
  'workbench.docs.body.debugMode.silent1Prefix':
    '완전한 효과를 내려면 디버그 모드가 필요한 규칙은, 꺼져 있는 동안 규칙 목록에',
  'workbench.docs.body.debugMode.badgeOff': '디버그 모드 꺼짐',
  'workbench.docs.body.debugMode.silent1Middle': '배지를 표시하고, 켜져 있지만 탭이 범위 밖일 때는 패널에',
  'workbench.docs.body.debugMode.badgeOutOfScope': '범위 밖의 탭',
  'workbench.docs.body.debugMode.silent1Middle2': '메모를 표시합니다. 규칙은 표준 페이지 컨텍스트 경로를 통해 자신이',
  'workbench.docs.body.debugMode.silentCan': '할 수 있는',
  'workbench.docs.body.debugMode.silent1Suffix':
    '모든 것을 계속 실행합니다. 디버그 모드를 켜는 것은 같은 규칙을 페이지 삽입이 닿지 못하는 컨텍스트로 넓힐 뿐입니다.',
  'workbench.docs.body.debugMode.colorsHeading': '상태 색',
  'workbench.docs.body.debugMode.colors1Prefix': '점은',
  'workbench.docs.body.debugMode.colors1Suffix': '행을 그대로 반영합니다:',
  'workbench.docs.body.debugMode.statesCaption': '꺼져 있으면 회색, 켜지면 초록 / 노랑 / 빨강.',
  'workbench.docs.body.debugMode.stateGreenLabel': '초록',
  'workbench.docs.body.debugMode.stateOn': '켜짐',
  'workbench.docs.body.debugMode.stateOnRest':
    '상태이며 깔끔하게 연결되어 있습니다. (꺼져 있을 때 점은 그냥 회색입니다.)',
  'workbench.docs.body.debugMode.stateYellowLabel': '노랑',
  'workbench.docs.body.debugMode.stateYellowPrefix': '어떤 탭이',
  'workbench.docs.body.debugMode.stateYellowTerm': '휴리스틱 방식으로 대체됨',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '상태입니다. 보통 브라우저의 디버그 배너가 닫혀서 그 탭이 표준 관찰로 되돌아간 경우입니다.',
  'workbench.docs.body.debugMode.stateRedLabel': '빨강',
  'workbench.docs.body.debugMode.stateRedPrefix': '어떤 탭이',
  'workbench.docs.body.debugMode.stateRedTerm': '연결 실패',
  'workbench.docs.body.debugMode.stateRedSuffix': '상태입니다. 그 탭에서는 디버깅 프로토콜을 걸 수 없었습니다.',
  'workbench.docs.body.debugMode.chromiumTitle': 'Chromium 전용',
  'workbench.docs.body.debugMode.chromium1':
    '디버그 모드는 Chromium 기반 브라우저만 확장 프로그램에 노출하는 디버깅 프로토콜에 의존합니다. Firefox 브라우저와 Safari 브라우저에서는 알약이 숨겨진 채로 있으며, 위의 표준 모드 규칙은 어디서나 작동합니다.',
} as const satisfies Catalog;
