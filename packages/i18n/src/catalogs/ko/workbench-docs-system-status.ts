/**
 * Workbench Docs panel — the System Status section body — Korean.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals and state tokens ride raw (in `<code>` at
 * the render site) inside keyed prose; every pill MESSAGE string
 * (Connected to desktop, N active DNR rule(s), Last request:, All
 * host permissions granted, Schema drift: dropped entry from, N
 * workflows fresh, …) rides raw as a wire mirror (S18, ja / zh-CN
 * parity). The six subsystem names quote `ko/shared-chrome.ts` (동기화
 * / 규칙 / 요청 / 권한 / 시크릿 / 라이브); the settings path quotes
 * `ko/workbench-settings*.ts` (애플리케이션 › 데이터 › 진단 로그
 * 내보내기 — 진단 로그 = the Observability log in prose too); 전송 =
 * the Send button (editors); 알약 = pill; 하위 시스템 = subsystem;
 * 수명 주기 / 상한 / 추출기 / 서비스 워커 / 워크플로 carried. MINTS:
 * 실행기 = executor; 지수 백오프 = exponential backoff; 하이드레이트 =
 * hydrate (수화 rejected); 드리프트 = drift; 암호문 = cipher; 주기 =
 * cadence; 최신 / 오래됨 / 실패 중 = fresh / stale / failing; 세 구간 =
 * three-zone. State-row bodies after a raw message label open with
 * 상태입니다 as the head noun (the render site joins with a space);
 * the fragment after a code chip joined with no space opens with a
 * space and a head noun. Sandwich fragments restructure SOV.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': '시스템 상태',
  'workbench.docs.body.systemStatus.intro1':
    '항목은 확장 프로그램 상태의 라이브 스냅샷입니다. 워크벤치 푸터는 이를 알약 여덟 개가 늘어선 행으로 보여 줍니다. 하위 시스템마다 알약 하나, 각각 자기 색 점을 가집니다. 팝업과 사이드 패널은 이를 하단 푸터의',
  'workbench.docs.body.systemStatus.intro1Suffix':
    '항목 하나로 접으며, 점의 색은 가장 나쁜 상태의 하위 시스템을 따라갑니다.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    '워크벤치에서는 이 행이 푸터에 있으며 하위 시스템마다 알약 하나입니다.',
  'workbench.docs.body.systemStatus.popupCaption':
    '도구 모음 아이콘을 누르면 같은 상태가 팝업 푸터에 레이블이 붙은 알약 하나로 나타납니다.',
  'workbench.docs.body.systemStatus.worstLevel1':
    '각 하위 시스템은 상태 하나를 보고하며 가장 나쁜 수준이 이깁니다: 빨강 > 노랑 > 초록. 어디든 빨강이 하나라도 있으면 종합 점이 빨강으로 바뀝니다.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    '하위 시스템 상태 여덟 개가 최댓값으로 종합 하나에 접힙니다. 빨강이 노랑을, 노랑이 초록을 이깁니다.',
  'workbench.docs.body.systemStatus.popover1':
    '어느 알약을 눌러도 같은 세부 정보 팝오버가 열립니다. 행은 제목이 있는 네 그룹(연결, 브라우저 인터셉터, API 요청, 애플리케이션) 아래 고정된 순서로 놓입니다. 행은 하위 시스템이 이번 서비스 워커 수명 주기에 처음 보고할 때까지 회색이고, 그 뒤로는 색이 있습니다. 전체 이력은 진단 로그에 있으며, 다음 경로에서 내보냅니다:',
  'workbench.docs.body.systemStatus.settingsExportPath': '애플리케이션 › 데이터 › 진단 로그 내보내기',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    '제목이 있는 네 그룹이 고정 순서로. 첫 보고 때 행은 색을 얻고 자리는 그대로입니다.',
  'workbench.docs.body.systemStatus.stateGreenLabel': '초록',
  'workbench.docs.body.systemStatus.stateYellowLabel': '노랑',
  'workbench.docs.body.systemStatus.stateRedLabel': '빨강',
  'workbench.docs.body.systemStatus.syncName': '동기화',
  'workbench.docs.body.systemStatus.syncSubtitle': '백엔드 연결',
  'workbench.docs.body.systemStatus.sync1Prefix': '이 표면이 클라이언트로 붙는 모든 백엔드(이 기기의 데스크톱 앱(',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ')과 모든 OpenHeaders Server)를 한 행으로 모읍니다. 가장 나쁜 연결이 태그를 정하고, 팝오버에서는 그 아래에 백엔드마다 한 행이 놓입니다. 설정된 백엔드가 없으면 행은 "이 브라우저에서 실행 중"이라고 읽힙니다. 확장 프로그램 자신이 백엔드입니다.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    '백엔드마다 WebSocket 하나. 그림은 localhost의 데스크톱 앱이며, 서버는 네트워크를 거치는 같은 링크입니다.',
  'workbench.docs.body.systemStatus.sync2':
    '각 와이어는 두 층을 보고합니다. 소켓: 연결 중, 끊긴 뒤 지수 백오프로 재연결 중, 연결됨. 주기적인 ping이 엄격한 회사 프록시 뒤의 조용한 끊김을 잡아냅니다. 그 위의 핸드셰이크: 핸드셰이크 중, 떠나 있던 동안의 변경 따라잡는 중, 동기화됨. 한 백엔드 안에서는 가장 최근 보고가, 백엔드 사이에서는 가장 나쁜 상태가 이깁니다.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    '비활성, 연결됨, 동기화됨은 초록. 연결 중, 재연결 중, 따라잡는 중, URL 거부됨은 노랑.',
  'workbench.docs.body.systemStatus.sync3':
    '데스크톱 앱이나 서버는 다른 쪽의 백엔드이기도 하며, 그 역할도 같은 집계에 들어갑니다. 확장 프로그램 파이프의 바인드(다른 인스턴스가 포트를 잡고 있으면 빨강, 시작하는 동안은 노랑)와, 바인드된 뒤에는 연결된 확장 프로그램 수와 이 기기에서인지 LAN에서인지. git에 바인딩된 워크스페이스는 커밋되지 않은 변경 수를 더합니다.',
  'workbench.docs.body.systemStatus.syncGreenSynced': '백엔드와 동기화됨',
  'workbench.docs.body.systemStatus.syncGreenConnected': '백엔드에 연결됨',
  'workbench.docs.body.systemStatus.syncGreenDisabled': '백엔드 동기화 비활성',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': '이 브라우저에서 실행 중',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    '— 핸드셰이크가 끝났거나, 소켓은 올라왔지만 핸드셰이크가 아직 진행 중이거나, 자동 연결이 꺼져 있거나, 백엔드가 설정되지 않았습니다. 서비스하는 호스트는 대신 피어를 보고합니다:',
  'workbench.docs.body.systemStatus.syncGreenIdle': '유휴 — 연결된 확장 프로그램 없음',
  'workbench.docs.body.systemStatus.syncGreenPeers': '이 기기의 확장 프로그램 N개에 연결됨',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(또는 LAN에서).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': '백엔드에 연결 중…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': '재연결 중 (시도 N)',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': '백엔드와 핸드셰이크 중…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': '변경 따라잡는 중…',
  'workbench.docs.body.systemStatus.syncYellowRejected': '설정에서 데스크톱 URL 거부됨',
  'workbench.docs.body.systemStatus.syncYellowOff': '<백엔드> 꺼짐 — 그 워크스페이스는 동기화되지 않음',
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '— 올라오거나 돌아오는 중인 소켓, 진행 중인 핸드셰이크, 쓸 수 있는 URL 값이 없는 레코드, 또는 꺼져 있는 가입된 백엔드. 서비스하는 호스트는 다음을 더합니다:',
  'workbench.docs.body.systemStatus.syncYellowPipe': '확장 프로그램 파이프 시작 중…',
  'workbench.docs.body.systemStatus.syncYellowGit': '커밋되지 않은 변경 N개',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '(git에 바인딩된 워크스페이스).',
  'workbench.docs.body.systemStatus.syncRedRejected': '백엔드가 핸드셰이크를 거부함',
  'workbench.docs.body.systemStatus.syncRedTimedOut': '백엔드가 핸드셰이크에 응답하지 않음 — 재시도 중',
  'workbench.docs.body.systemStatus.syncRedCatchUp': '따라잡기 실패',
  'workbench.docs.body.systemStatus.syncRedExplain':
    '— 서버가 핸드셰이크를 거부했거나(프로토콜 불일치, 알 수 없는 워크스페이스, 인증 누락. 행이 이유를 밝힙니다), 응답하지 않았거나, 따라잡기 재생이 실패했습니다. 서비스하는 호스트는 다음을 더합니다:',
  'workbench.docs.body.systemStatus.syncRedPipe': '확장 프로그램 파이프 오프라인 — 포트 N이 이미 사용 중',
  'workbench.docs.body.systemStatus.syncRedSuffix': '(다른 인스턴스가 포트를 잡고 있을 때).',
  'workbench.docs.body.systemStatus.activityName': '활동',
  'workbench.docs.body.systemStatus.activitySubtitle': '활동 피드',
  'workbench.docs.body.systemStatus.activity1':
    '활성 워크스페이스 활동 피드의 읽지 않은 항목을 셉니다. 동기화로 도착한 변경입니다: 엔터티 생성·편집·삭제·이동, 로컬 편집 덮어쓰기, 민감한 필드 교체, 권한 범위 확장, AI 에이전트의 트래픽 관찰.',
  'workbench.docs.body.systemStatus.activity2':
    '활성 워크스페이스만 셉니다. 다른 워크스페이스의 항목은 그 워크스페이스 피드에 쌓이고, 그곳으로 전환하면 로그에서 개수를 다시 읽으므로 어느 워크스페이스도 다른 곳의 배지를 떠안지 않습니다.',
  'workbench.docs.body.systemStatus.activityGreenLabel': '활동 최신 상태',
  'workbench.docs.body.systemStatus.activityGreenSuffix': '— 활성 워크스페이스에 읽지 않은 항목이 없습니다.',
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N개 신규 · <헤드라인>',
  'workbench.docs.body.systemStatus.activityYellowMiddle':
    '— 읽지 않은 항목으로, 가장 최근 항목을 헤드라인으로 삼아 피드를 읽을 때까지 표시됩니다.',
  'workbench.docs.body.systemStatus.activityRed': '예약됨. 오늘은 이를 내보내는 코드 경로가 없습니다.',
  'workbench.docs.body.systemStatus.rulesName': '규칙',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest 엔진',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'DNR 재빌드마다 보고합니다. 저장할 때마다 규칙은 적용되기 전에 네 단계를 거칩니다: DNR JSON 형식으로 컴파일,',
  'workbench.docs.body.systemStatus.rules1Middle': '참조 해석, 활성 규칙 상한 적용, 그리고 Chrome 브라우저의',
  'workbench.docs.body.systemStatus.rules1Suffix': 'API 기능을 통한 적용. 각 단계가 알약을 바꿀 수 있습니다.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    '네 단계. 각 단계가 잘못되면 상태 수준을 내보낼 수 있습니다.',
  'workbench.docs.body.systemStatus.rules2':
    '활성 규칙 수는 세 구간 용량 막대의 상태에 대응합니다. 상한을 넘는 규칙은 일치 순서대로 (위가 이김) 버려지며, 노랑 메시지에 버려진 개수가 실립니다.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    '경고 문턱까지는 초록, 상한까지는 노랑, 그 너머는 빨강. 다만 잘라내기가 실행 시점에 빨강 구간 밖으로 지켜 줍니다.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': '또는',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': '미해결',
  'workbench.docs.body.systemStatus.rulesYellowRefs': '참조 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), 규칙 상한 초과 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': '), 또는 DNR 용량에 근접 (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    '전송 실패. Chrome 브라우저가 동적 또는 세션 규칙 업데이트를 거부했습니다 (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': '요청',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'API 요청 실행기',
  'workbench.docs.body.systemStatus.requests1Prefix': '마지막 임시 API 요청, 즉 요청 편집기의',
  'workbench.docs.body.systemStatus.requestsSend': '전송',
  'workbench.docs.body.systemStatus.requests1Middle': '버튼으로 보낸 요청을 반영합니다. 알약은',
  'workbench.docs.body.systemStatus.requestsAny': '어떤',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP 응답에도 초록으로 바뀝니다. 4xx 및 5xx 응답도 포함합니다. “요청이 완료되었는가”는 “서버가 마음에 들어 했는가”와는 별개의 질문이기 때문입니다. 응답이 전혀 없는 네트워크 수준 실패만 노랑으로 바꿉니다.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    '어떤 상태 코드든 = 초록. 노랑은 응답이 돌아오지 않은 실패를 위해 예약되어 있습니다.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    '백그라운드 트래픽은 이 알약을 갱신하지 않습니다. 라이브 워크플로 새로 고침은',
  'workbench.docs.body.systemStatus.requests2Suffix':
    ' 옵션을 전달하고, 웹페이지 요청은 실행기가 아니라 규칙 엔진을 거칩니다.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    '전송 버튼으로 보낸 임시 트래픽만 이 알약을 바꿉니다. 나머지는 모두 조용합니다.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '상태입니다. 어떤 HTTP 응답이든 해당합니다 (예:',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '상태입니다. 응답 전의 네트워크 수준 실패입니다 (예:',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', 오프라인/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': '권한',
  'workbench.docs.body.systemStatus.permissionsSubtitle': '호스트 권한 감사',
  'workbench.docs.body.systemStatus.permissions1Prefix': '호스트 권한이',
  'workbench.docs.body.systemStatus.permissions1Middle':
    '페이지에서 취소된 호스트를 대상으로 하는 DNR 규칙과 콘텐츠 스크립트는 오류를 내지 않고 조용히 아무것도 하지 않습니다. 이 감사의 역할은 그 숨은 상태를 드러내는 것입니다. 그러지 않으면',
  'workbench.docs.body.systemStatus.permissionsLooks': '겉보기에는',
  'workbench.docs.body.systemStatus.permissions1Suffix': '멀쩡한 규칙을 30분 동안 디버깅하게 됩니다.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    '부여됨: 규칙이 실행됩니다. 축소됨: 규칙이 조용히 무시되고 헤더는 끝내 도착하지 않습니다.',
  'workbench.docs.body.systemStatus.permissions2Prefix': '감사는 서비스 워커가 깨어날 때마다',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    '값을 폴링합니다. Chromium 브라우저의 MV3 환경에는 권한 변경 관찰자가 없으므로, 깨어날 때 폴링하는 것이 얻을 수 있는 가장 싼 신호입니다.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    '호출 하나, 분기 셋. 부여되면 초록, 축소되면 빨강, API 호출 자체가 실패하면 노랑.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': '항목이 아직 범위 안에 있습니다.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle':
    '상태입니다. 드문 경우이며, 브라우저가 다음 항목을 노출하지 않았습니다:',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '상태입니다. 다음 페이지에서 접근 권한이 복원될 때까지 일부 규칙이 취소된 호스트에서 조용히 무시됩니다:',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.debugModeName': '디버그 모드',
  'workbench.docs.body.systemStatus.debugModeSubtitle': '디버거 연결 상태',
  'workbench.docs.body.systemStatus.debugMode1':
    '디버그 모드가 요청을 정확히 대응시키려고 탭에 연결하는 디버거를 비춥니다. 꺼짐은 초록을 보고합니다. 스위치가 꺼진 동안 결함은 의미가 없습니다. 켜짐이면 행이 연결된 탭을 셉니다. 브라우저가 연결을 거부한 탭은 빨강으로, 휴리스틱 경로로 되돌아간 탭은 노랑으로 바꿉니다.',
  'workbench.docs.body.systemStatus.debugMode2':
    '디버거 API 지원이 없는 브라우저는 이 리포터를 설치하지 않으므로 거기서는 행이 회색으로 남고 휴리스틱 경로만 있습니다.',
  'workbench.docs.body.systemStatus.debugModeGreenOff': '꺼짐',
  'workbench.docs.body.systemStatus.debugModeGreenOr': '또는',
  'workbench.docs.body.systemStatus.debugModeGreenOn': '켜짐 · 탭 N개',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix':
    '— 스위치가 꺼져 있거나, 켜져 있고 연결된 탭이 모두 정상입니다.',
  'workbench.docs.body.systemStatus.debugModeYellowLabel': '탭 N이 휴리스틱으로 되돌아감',
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    '— 디버거가 그 탭에서 떨어졌고(예: 배너 취소) 다시 연결될 때까지 탭은 휴리스틱 경로로 대응됩니다.',
  'workbench.docs.body.systemStatus.debugModeRedLabel': '탭 N 연결 실패',
  'workbench.docs.body.systemStatus.debugModeRedMiddle':
    '— 브라우저가 연결을 거부했습니다. 보통 다른 디버거가 이미 그 탭을 잡고 있기 때문입니다.',
  'workbench.docs.body.systemStatus.secretsName': '시크릿',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Vault 무결성',
  'workbench.docs.body.systemStatus.secrets1Prefix': '워크스페이스별 암호화된 vault 블롭을 다음 저장소에서 추적합니다:',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. 서비스 워커가 깨어날 때마다 저장된 각 시크릿을 현재 스키마에 대해 검증합니다. 검증에 실패한 항목은 메모리의 vault 저장소에서 버려지고, 다시 저장될 때까지 알약이 노랑으로 바뀝니다.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    '하이드레이트가 블롭을 불러오고, 스키마 검증기가 일치하는 것은 남기고 드리프트는 버리며 노랑을 보고합니다.',
  'workbench.docs.body.systemStatus.secrets2':
    '“드리프트”는 보통 저장된 항목을 예전 빌드가 썼다는 뜻입니다 (지금은 필수인 필드가 없거나, 필드 타입이 잘못됨). 검증기의 역할은 크게 실패하는 것입니다. 알 수 없는 형태를 조용히 물려받는 것이 여섯 버전 뒤의 버그를 만듭니다.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    '같은 두 필드를 나란히: 유효한 항목과, 암호문이 없고 createdAt 타입이 잘못된 드리프트 항목.',
  'workbench.docs.body.systemStatus.secretsGreen':
    '기본값. 이번 서비스 워커 수명 주기에 스키마 드리프트 이벤트가 없습니다.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '상태입니다. 저장된 vault 항목 중 하나 이상이 현재 형태와 맞지 않아 하이드레이트 시 버려졌습니다. Vault 편집기에서 다시 저장하면 복원됩니다.',
  'workbench.docs.body.systemStatus.secretsRed':
    '암호문 복호화 실패를 위해 예약되어 있습니다. 현재 이를 내보내는 코드 경로는 없습니다.',
  'workbench.docs.body.systemStatus.liveName': '라이브',
  'workbench.docs.body.systemStatus.liveSubtitle': '라이브 변수 워크플로 새로 고침',
  'workbench.docs.body.systemStatus.live1Prefix':
    '각 라이브 워크플로는 자기 주기로 새로 고쳐집니다. 워크플로별 상태는 세 가지 점검으로 정해집니다: 마지막 추출기가 성공했는지, 실행이 주기의',
  'workbench.docs.body.systemStatus.live1Suffix':
    '이내인지, 그리고 연속으로 몇 번 실패했는지. 세 상태는 “가장 나쁜 것이 이김”으로 알약에 접힙니다.',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    '최신 = 깨끗한 실행 · 오래됨 = 주기의 2배 경과 또는 1–4회 실패 · 실패 중 = 5회 이상 연속 실패.',
  'workbench.docs.body.systemStatus.live2Prefix': '오직',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': '활성 워크스페이스의',
  'workbench.docs.body.systemStatus.live2Suffix':
    '워크플로만 기여합니다. 비활성 워크스페이스는 제외됩니다. 지금은 그 규칙을 보거나 다룰 수 없으므로, 알약에 반영하면 닿을 수 없는 노이즈만 드러날 뿐입니다. 워크스페이스를 전환하면 새 활성 집합을 기준으로 알약이 다시 계산됩니다.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    '활성 워크스페이스의 워크플로가 max() 함수로 알약 하나에 접힙니다. 다른 워크스페이스는 건너뜁니다.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '상태입니다. 활성 워크스페이스의 모든 워크플로의 마지막 실행이 OK였고 주기의 2배 이내였습니다. 워크플로가 하나도 없으면',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': '메시지로 표시됩니다.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '상태입니다. 실행 하나 이상이 주기의 2배를 넘겼거나, 마지막 추출기가 실패했거나, 1–4회 연속 실패가 있습니다.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '상태입니다. 워크플로 하나라도 연속 실패 5회를 넘겨 이제 실패 중으로 간주됩니다.',
} as const satisfies Catalog;
