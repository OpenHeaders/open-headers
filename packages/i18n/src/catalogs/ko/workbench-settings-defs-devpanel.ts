/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — Korean. Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, `A → Z`, header names, and every wire token. Option
 * labels quote the shipped ko panel menus verbatim (실패 우선 / 가장
 * 느린 것 우선 / 가장 큰 것 우선 / 브라우저 우선순위 / 리소스 유형별 /
 * 도메인별 / 규칙으로 수정된 것 우선 / 오름차순 / 내림차순 / 간결 / 넓게 /
 * 그룹화 / 평면 / 원래 순서 / 원래 그대로 / 상대 / 절대 / 항상 / 마우스를
 * 올릴 때 / 타임스탬프 / 로컬 / 태그 표시 / 제안 표시 / 규칙 실행 점 표시
 * / 사용자 지정 (중첩) / 포커스된 도구 / Network 도구만 + the timing
 * view rows); the layout twins quote `panel.ts` (양쪽 맞춤 / 좌우 배치 /
 * 상하 배치 / 도구 창 이름 표시 / 비례 / 간결 / 쌓기 / 동적). MINTS: 상태
 * 표시줄 = the panel status bar (footer); 상단 표시줄 = top bar; 범위
 * carries the footer scope sense (S19 law); 집계 = aggregate; 현재
 * 페이지만 = current page only; 수치 = the Waterfall value chip
 * (carried from panel-network).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': '버전 표시',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'DevTools 패널 상태 표시줄에 확장 프로그램 버전 번호를 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': '테마 전환기 표시',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'DevTools 패널 상태 표시줄에 라이트/다크/자동 테마 드롭다운을 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': '수정 수 표시',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'DevTools 패널 상태 표시줄에 규칙이 실제로 수정한 요청 수를 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': '실패 수 표시',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'DevTools 패널 상태 표시줄에 실패했거나 오류 상태를 반환한 요청 수를 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': '캐시 수 표시',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'DevTools 패널 상태 표시줄에 캐시에서 제공된 요청 수를 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': '현재 페이지 표시',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'DevTools 패널 상태 표시줄에서 타이밍 이정표에 해당 페이지를 표시합니다. 여러 탐색에 걸친 로그 보존과 함께 쓸 때 유용합니다.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': '타이밍 범위',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'DevTools 패널 상태 표시줄의 Finish / DOMContentLoaded / Load 이정표가 설명하는 탐색입니다. 집계는 첫 탐색부터 로그 보존 타임라인 전체에 걸치고 (브라우저와 같음), 현재 페이지만은 최근 탐색만 보고합니다.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': '집계 (모든 탐색)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load 이정표가 첫 탐색부터 타임라인 전체에 걸칩니다. 브라우저 기본값입니다.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': '현재 페이지만',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load 이정표가 시작 시점을 기준으로 최근 탐색만 보고합니다.',
  'workbench.settings.def.devpanelLayout.footerScope.label': '요약 범위',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'DevTools 패널 상태 표시줄이 요약하는 대상입니다. 포커스된 도구는 작업 중인 도구 창을 따르고 (Storage, Console, 검색 창은 자체 요약 줄을 가짐), Network 도구만은 항상 Network 수치를 표시합니다.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': '포커스된 도구',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    '푸터가 포커스된 도구 창을 따릅니다. Storage, Console, 검색 창은 자체 요약을 표시하고 다른 도구는 Network 줄로 대체됩니다.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Network 도구만',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    '어느 도구 창에 포커스가 있든 푸터는 항상 Network 수치를 표시합니다.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': '패널 토글 표시',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'DevTools 패널 상단 표시줄에 왼쪽 / 하단 / 오른쪽 패널 토글 아이콘을 표시합니다.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': '레이아웃 메뉴 표시',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'DevTools 패널 상단 표시줄에 레이아웃 드롭다운 (하단 전체 너비, 도구 창 이름, 사이드바 레이아웃)을 표시합니다.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': '하단 패널 정렬',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'DevTools 패널에서 하단 패널이 놓이는 곳입니다. 왼쪽/오른쪽은 사이드바 하나 + 편집기 아래에 맞추고, 가운데는 중간 열 안에 중첩하며, 양쪽 맞춤은 전체 너비에 걸칩니다.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': '가운데',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    '중간 열 안에 중첩된 하단 패널',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': '왼쪽',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    '하단이 왼쪽 사이드바 + 편집기에 걸침',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': '오른쪽',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    '하단이 편집기 + 오른쪽 사이드바에 걸침',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': '양쪽 맞춤',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    '하단이 DevTools 패널 전체 너비에 걸침',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': '하단 패널 분할',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    '열린 두 하단 도크가 하단 패널을 나누는 방식입니다. 나란히, 또는 위아래로.',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': '좌우 배치',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description': '하단 도크가 나란히 놓임',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': '상하 배치',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description': '하단 도크가 위아래로 쌓임',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': '도구 창 이름 표시',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'DevTools 패널의 활동 표시줄과 도크 탭 아이콘 옆에 텍스트 레이블을 표시합니다. 패널이 워크스페이스보다 좁으므로 기본값은 꺼짐입니다.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': '왼쪽 활동 표시줄 너비',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    '도구 창 이름이 보일 때 DevTools 패널 왼쪽 활동 표시줄의 너비입니다. 아이콘 전용 모드에서는 36px로 고정됩니다.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': '오른쪽 활동 표시줄 너비',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    '도구 창 이름이 보일 때 DevTools 패널 오른쪽 활동 표시줄의 너비입니다. 아이콘 전용 모드에서는 36px로 고정됩니다.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': '활동 표시줄 레이아웃',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'DevTools 패널에서 활동 표시줄이 위쪽과 아래쪽 도구 창 그룹을 나누는 방식입니다.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': '비례',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    '위쪽과 아래쪽 그룹이 활동 표시줄을 50/50으로 나눔',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': '간결',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    '위쪽 그룹은 내용에 맞추고 아래쪽은 하단에 고정',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': '쌓기',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    '모든 그룹을 위쪽에 모으고 사이에 구분선을 둠',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': '동적',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    '칩 그룹이 인접한 패널 높이를 따릅니다. 닫힌 도크는 내용 크기로 접히고 살아 있는 이웃이 그 공간을 흡수합니다.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': '레이아웃',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Network 표가 가로 공간을 흡수하는 방식입니다. 간결은 늘어나는 열 (Name, Waterfall)을 패널 너비에 맞게 늘려 표가 가로로 스크롤되지 않게 하고, 넓게는 그 열에 상한을 두고 나머지를 가로로 스크롤합니다.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': '간결',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description': '늘어나는 열이 패널 너비를 흡수합니다.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': '넓게',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    '너비에 상한을 두고 필요하면 가로로 스크롤합니다.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': '메시지 레이아웃',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Messages 프레임 그리드가 가로 공간을 흡수하는 방식입니다. 간결은 Data 열을 창 너비에 맞게 늘려 그리드가 가로로 스크롤되지 않게 하고, 넓게는 상한을 두고 필요하면 가로로 스크롤합니다.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': '간결',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description': 'Data 열이 창 너비를 흡수합니다.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': '넓게',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    '너비에 상한을 두고 필요하면 가로로 스크롤합니다.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': '페이로드 미리보기 표시',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Messages / EventStream 그리드 아래에 페이로드 미리보기 창을 표시합니다. 선택한 프레임이나 이벤트가 JSON 트리, 원시 텍스트 또는 바이너리 뷰어로 렌더링되는 크기 조절 가능한 분할입니다. 그리드에 창 전체를 주려면 끄세요.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': '정렬 소스',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    '정렬 상태의 어느 쪽이 활성인지입니다. `mode`는 이름 있는 복합 정렬 모드 (실패 우선 / 가장 느린 것 우선 / …) 중 하나를 실행합니다. `column`은 사용자가 열 머리글을 클릭해 고른 단일 열 정렬을 실행합니다. 패널이 자동으로 전환합니다. 열 머리글을 클릭하면 `column`으로, 보기 메뉴에서 모드를 고르면 `mode`로 설정됩니다.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': '모드',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': '이름 있는 복합 정렬 모드를 씁니다.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': '열',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description': '사용자가 클릭한 단일 열 정렬을 씁니다.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': '사용자 지정 (중첩)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    '사용자가 만든 다중 키 정렬 체인을 씁니다.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': '정렬 모드',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    '이름 있는 복합 정렬 순서입니다. 주 축 다음에 동순위 기준으로 도착 순서. 정렬 소스 = `mode`일 때 활성입니다.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': '실패 우선',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description': '실패 → 대기 중 → 리디렉션 → 성공.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': '가장 느린 것 우선',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': '소요 시간이 긴 순.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': '가장 큰 것 우선',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': '전송 바이트가 큰 순.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': '브라우저 우선순위',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    '보고된 우선순위 Highest → Lowest 순.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': '리소스 유형별',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    '리소스 유형으로 그룹화, 그 안은 도착 순서.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': '도메인별',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    '호스트 이름으로 그룹화, 그 안은 도착 순서.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': '규칙으로 수정된 것 우선',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    '규칙이 적용된 것 먼저, 그 안은 도착 순서.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': '정렬 기준',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    '열 클릭 정렬을 이끄는 열입니다. 정렬 소스 = `column`일 때 활성입니다. 열 머리글을 클릭하면 이 값이 업데이트됩니다.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    '활성 Waterfall 지표 (기본값은 시작 시각)에 따른 타임라인.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description': '요청 번호. 요청이 발견된 순서.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP 메서드.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'URL 주소의 마지막 구간.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': '경로 이름 + 쿼리.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': '전체 URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': '응답 상태 코드.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP 버전.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'URL 주소의 호스트 부분.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': '서버 IP 주소.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': '리소스 유형.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': '요청을 일으킨 것.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': '요청 쿠키 수.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': '응답 Set-Cookie 헤더 수.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': '전송 바이트.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': '요청 총 소요 시간.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': '브라우저가 부여한 우선순위.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': '정렬 방향',
  'workbench.settings.def.devpanelNetwork.sortDir.description': '현재 Network 정렬 열의 오름차순 또는 내림차순입니다.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': '오름차순',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': '가장 낮은 것부터.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': '내림차순',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': '가장 높은 것부터.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': '지표',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Waterfall 열이 정렬하고 그리는 기준 시각입니다. Start / Response / End time 지표는 막대를 절대 타임라인에 배치하고, Total duration과 Latency 지표는 막대를 0에 맞춰 길이를 바로 비교할 수 있게 합니다.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': '요청이 시작된 시각.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    '첫 응답 바이트가 도착한 시각.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': '요청이 끝난 시각.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    '요청이 처음부터 끝까지 걸린 시간.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description': '첫 응답 바이트까지의 시간.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': '규칙 실행 점 표시',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    '규칙 일치를 표시하는 색 점을 담은 맨 앞 14px 열을 표시합니다 (채움 = 규칙이 실제로 적용됨, 비움 = 추정). 촘촘한 창에서 가로 픽셀을 되찾으려면 끄세요.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': '수치',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    '활성 Waterfall 지표의 수치를 막대에 표시하는 때입니다. 타임라인 지표에서는 Start / Response / End time 칩, Total duration과 Latency 지표에서는 대기 / 다운로드 레이블입니다.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': '항상',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': '수치 칩을 항상 표시합니다.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': '마우스를 올릴 때',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    '행에 마우스를 올리면 수치 칩을 표시합니다.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': '끔',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': '수치 칩을 숨깁니다.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': '수치 형식',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    '타임라인 지표의 수치를 읽는 방식입니다. 상대는 보이는 첫 요청으로부터의 오프셋, 타임스탬프는 절대 실제 시각입니다. Total duration과 Latency 지표는 어느 쪽이든 항상 소요 시간입니다.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': '상대',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    '보이는 첫 요청으로부터의 오프셋.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': '타임스탬프',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description': '절대 실제 시각.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': '타임스탬프 시간대',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    '타임스탬프 수치 형식의 시간대입니다. 로컬 시간 또는 UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': '로컬',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': '내 로컬 시간대.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': '협정 세계시.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': '수치 설명',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'Waterfall 호버 팝오버에서 합계를 이루는 단계 행에 배지를 붙여 강조하고 그 합을 수식으로 표시합니다. 순전히 시각적 보조이며 값은 바꾸지 않습니다.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': '팝오버 레이아웃',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Waterfall 호버 타이밍 내역의 방향입니다. 간결은 단계를 팝오버 아래로 쌓고, 넓게는 같은 사다리를 시간 축에 놓으며, 자동은 패널 너비로 고릅니다. 하단에 도킹된 패널에서는 넓게, 좁은 (옆에 도킹된) 패널에서는 간결.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': '간결',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    '단계를 팝오버 아래로 쌓습니다.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': '넓게',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    '단계를 가로 시간 축에 놓습니다.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': '자동',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    '패널이 넓으면 넓게, 아니면 간결.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': '레이아웃',
  'workbench.settings.def.devpanelHeaders.layout.description':
    '요청/응답 섹션 안에서 헤더 행을 정리하는 방식입니다. 그룹화는 행을 범주 (인증, CORS, 캐싱, …)별로 묶고, 평면은 선택한 정렬 순서의 목록 하나로 렌더링합니다.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': '그룹화',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': '행을 범주별로 묶습니다.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': '평면',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description': '범주 제목 없는 단일 목록 (Chrome 스타일).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': '정렬',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    '각 목록 안 (그룹화한 경우 각 그룹 안)의 행 순서입니다. 원래 순서는 서버가 헤더를 보낸 순서 (HAR 순서)를 유지하고, A → Z는 이름순으로 정렬하며, 규칙으로 수정된 것 우선은 규칙으로 수정된 행을 위로 올립니다.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': '원래 순서',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR 순서.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': '알파벳순.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': '규칙으로 수정된 것 우선',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': '규칙으로 수정된 행을 맨 위에.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': '헤더 이름 대소문자',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    '헤더 이름을 표시하는 방식입니다. Train-Case는 Chrome/Firefox DevTools 창과 같도록 모든 이름을 정규화 (`Content-Type`, `Set-Cookie`, `ETag`)하여 훑어보기 쉽습니다. 원래 그대로는 서버가 보낸 원시 대소문자를 유지합니다 (HTTP/2 이상은 전송선에서 모두 소문자).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': '원래 그대로',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    '서버가 보낸 그대로 (HTTP/2 이상에서는 대개 소문자).',
  'workbench.settings.def.devpanelHeaders.showChips.label': '값 태그 표시',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    '헤더 행의 값별 태그 (Cache-Control / Set-Cookie / HSTS / JWT 디코딩, …)를 표시합니다. 값만 있는 촘촘한 보기를 원하면 끄세요.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': '제안 표시',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Headers 탭 위쪽에 실행 가능한 경고 카드 (CORS 설정 오류, 누락된 CSP/HSTS, 안전하지 않은 쿠키, 만료된 JWT 등)를 표시합니다.',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': '노이즈 헤더 숨기기',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    '신호가 약한 헤더 (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …)를 접습니다. 각 섹션 아래의 힌트에 마우스를 올리면 숨긴 이름이 나열됩니다.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': '규칙으로 수정된 것만',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Open Headers 규칙이 추가, 수정 또는 제거한 헤더만 표시합니다.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': '보안 헤더만',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    '보안 관련 헤더 (CSP, HSTS, X-Frame-Options, Permissions-Policy, …)만 표시합니다.',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': '재정의 가능한 것만',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    '브라우저가 규칙의 재정의를 허용하지 않는 보호된 헤더 (host, content-length, sec-ch-ua, …)를 숨깁니다.',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': '하위 정렬',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    '발신자 연쇄 안에서 하위 요청을 정렬하는 방식입니다. 발신자 순서는 원래 발신자 그래프 순회를 유지하고, 시간순은 요청 시각으로 정렬하며, 가장 큰 하위 트리는 가장 무거운 하위 트리를 먼저 둡니다.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': '발신자 순서',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': '발견된 순서대로.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': '시간순',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': '요청 시각순.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': '가장 큰 하위 트리',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': '가장 무거운 하위 트리부터.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': '제안 표시',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Initiator 탭 위쪽에 실행 가능한 안내 (실패한 하위 요청, 지배적인 호스트, 서드 파티 비중, …)를 표시합니다.',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': '실패만',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    '발신자 연쇄에서 실패했거나 차단된 행만 표시합니다.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': '서드 파티만',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description': '출처가 페이지 출처와 다른 행만 표시합니다.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': '정렬',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    '각 쿠키 섹션 안의 행 순서입니다. 원래 순서는 서버 / 요청이 쓴 순서를 유지하고, A → Z는 이름순, 크기는 직렬화된 쿠키 크기순, 만료는 곧 만료되는 것부터 (세션 쿠키는 마지막) 정렬합니다.',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': '원래 순서',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': '보내거나 설정한 순서대로.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': '이름 알파벳순.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': '크기',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': '가장 큰 쿠키부터.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': '만료',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': '가장 먼저 만료되는 것부터.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': '만료 형식',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    '쿠키 만료를 표시하는 방식입니다. 상대는 "2일 후", "30초 전", "세션"으로, 절대는 파싱한 UTC 날짜로 표시합니다.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': '상대',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': '절대',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC 날짜.',
  'workbench.settings.def.devpanelCookies.showChips.label': '태그 표시',
  'workbench.settings.def.devpanelCookies.showChips.description':
    '각 쿠키 이름 옆에 역할 / 수명 주기 / 컨텍스트 태그 (auth? / tracking? / pref / 방금 설정 / 폐기됨 / 서드 파티 / 분할됨 / …)를 표시합니다. 열만 있는 촘촘한 보기를 원하면 끄세요.',
  'workbench.settings.def.devpanelCookies.showInsights.label': '제안 표시',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Cookies 탭 위쪽에 실행 가능한 경고 카드 (Secure 플래그 없는 SameSite=None, __Host- / __Secure- 접두사 위반, 너무 큰 쿠키, 만료되었지만 전송됨, …)를 표시합니다.',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'URL 인코딩된 값 디코딩',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    '쿠키 값의 퍼센트 인코딩을 디코딩하여 표시합니다 ("Europe%2FMadrid" → "Europe/Madrid"). 값에 마우스를 올리면 원시 형태를 볼 수 있습니다.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': '역할별 그룹화',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    '각 섹션 안에서 쿠키를 추정 역할별로 묶습니다. 인증 및 세션이 먼저, 그다음 기능, 환경 설정, 분석 및 추적. 휴리스틱 기반이며, 역할 칩 (auth? / tracking? / pref)의 물음표가 이를 상기시킵니다.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': '제외된 요청 쿠키 표시',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Chrome 브라우저의 "show filtered out request cookies" 토글과 같습니다. 경로 / Secure 플래그 / SameSite 속성 / 만료 불일치로 이 요청에 전송되지 않은 쿠키 저장소의 쿠키도 나열합니다.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': '문제 있는 것만',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    '경고를 일으킨 쿠키만 표시합니다. Secure 플래그 누락, 접두사 위반, 만료되었지만 전송됨, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': '서드 파티만',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    '도메인이 최상위 프레임 출처와 교차 사이트인 쿠키만 표시합니다.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': '규칙으로 수정된 것만',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Cookie / Set-Cookie 줄이 규칙에 의해 추가, 수정 또는 제거된 쿠키만 표시합니다.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': '제안 표시',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Timing 탭 위쪽에 병목 + 단계별 경고 카드를 표시합니다. 숫자만 있는 보기를 원하면 끄세요.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': '컨텍스트 띠 표시',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    '단계 내역 위에 프로토콜 / 연결 / 캐시 / 우선순위 / 시작 / 서버 IP 칩 행을 표시합니다.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': '단계 내역 표시',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Resource Scheduling / Connection Start / Request-Response 섹션을 단계별 밀리초 행과 함께 표시합니다.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': '타이밍 막대 표시',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    '단계별 범례가 있는 비례 분할 막대 (와 그 아래 총계 행)를 표시합니다.',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Server-Timing 표시',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    '서버가 보낸 경우 파싱한 `Server-Timing` 응답 헤더 지표를 표시합니다.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': '세션 내 반복 표시',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    '현재 패널 세션 안에서 같은 URL 주소의 가장 빠른 / 중앙값 / 가장 느린 적중과의 비교를 표시합니다.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': '전송 속도 표시',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    '크기와 수신 구간을 모두 알 때 실효 Content-Download 처리량 (본문 바이트 ÷ 다운로드 시간)을 표시합니다.',
} as const satisfies Catalog;
