/**
 * DevTools panel — shell chrome — Korean. Mirrors `catalogs/en/panel.ts`
 * key for key; see that file for the family map and the English
 * boundary (resource-type pills, throttle tier names, CDP method names,
 * header names, event names, chords, units and glyphs ride raw). The
 * tool-window nouns Network / Storage / Console / Docs ride raw as in
 * zh-CN / ja (parity vocabulary) and take a head noun (창, 패널) where a
 * particle would follow; 검색 / 알림 / 규칙 활동 / 일치한 규칙 translate.
 * Mints: 로그 보존 = Preserve log; 추가 필터 = More filters; 푸터 보기 =
 * Footer View; 캐시 사용 안 함 = Disable cache; 스로틀링 = throttling;
 * 재정의 = Overrides (system); 활동 표시줄 = activity bar; 도구 창 = tool
 * window (carried); evidence chips 모순 / 확정 / 확인됨 / 간접 / 무음 /
 * 입증 / 추정 = contradicted / authoritative / confirmed / fallback /
 * silent / corroborated / inferred; 적중 = hit; HAR 외 = off-HAR; 귀속 =
 * Attribute (tour); 스냅샷 = snapshot; 지연 = latency (throttle rows).
 * The devpanel settings option labels quote THESE menu-row values
 * verbatim when the ko settings-defs file lands.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': '네트워크 로그 기록',
  'panel.toolbar.stopRecording': '기록 중지',
  'panel.toolbar.clear': '네트워크 로그 지우기',
  'panel.toolbar.filter': '필터',
  'panel.toolbar.search': '검색',
  'panel.toolbar.preserveLog': '로그 보존',
  'panel.toolbar.preserveLogTitle':
    '페이지 탐색 간에 요청을 유지합니다. 끄면 브라우저 자체 Network 패널처럼 탐색이나 새로 고침마다 목록을 지웁니다.',
  'panel.toolbar.aboutPreserveLog': '로그 보존 정보',
  'panel.toolbar.aboutMoreFilters': '추가 필터 정보',
  'panel.toolbar.aboutFooterView': '푸터 보기 정보',
  'panel.toolbar.moreTools': '추가 도구',
  'panel.toolbar.activeWorkspaceAria': '활성 워크스페이스: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': '왼쪽 사이드바',
  'panel.toolbar.bottomPanel': '하단 패널',
  'panel.toolbar.rightSidebar': '오른쪽 사이드바',
  'panel.toolbar.chooseBottomAlignment': '하단 패널 정렬 선택',
  'panel.toolbar.layoutOptions': '레이아웃 옵션',
  'panel.toolbar.bottomAlignTooltip.center': '하단 패널: 가운데 (중첩)',
  'panel.toolbar.bottomAlignTooltip.left': '하단 패널: 왼쪽 정렬',
  'panel.toolbar.bottomAlignTooltip.right': '하단 패널: 오른쪽 정렬',
  'panel.toolbar.bottomAlignTooltip.justify': '하단 패널: 전체 너비',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomLayout': '하단 패널 레이아웃',
  'panel.layout.alignCenter': '가운데 (중첩)',
  'panel.layout.alignLeft': '왼쪽',
  'panel.layout.alignRight': '오른쪽',
  'panel.layout.alignJustify': '양쪽 맞춤 (전체 너비)',
  'panel.layout.splitColumns': '좌우 배치',
  'panel.layout.splitRows': '상하 배치',
  'panel.layout.showToolWindowNames': '도구 창 이름 표시',
  'panel.layout.activityBarLayout': '활동 표시줄 레이아웃',
  'panel.layout.sidebarProportional': '비례 (균등 분할)',
  'panel.layout.sidebarCompact': '간결 (하단 고정)',
  'panel.layout.sidebarStacked': '쌓기 (모두 위쪽)',
  'panel.layout.sidebarDynamic': '동적 (패널 높이에 따름)',
  'panel.layout.defaultLayoutDonor': '기본 레이아웃 {unit}',
  'panel.layout.inheritsDefault': '기본 레이아웃 상속',
  'panel.layout.donorTooltip': '이 {unit} 항목이 기본값입니다. 새 {units} 항목은 이 레이아웃을 상속합니다.',
  'panel.layout.nonDonorTooltip': '다른 {unit} 항목이 기본값입니다. 새 {units} 항목은 그곳에서 상속합니다.',
  'panel.layout.resetToDefaults': '레이아웃을 기본값으로 재설정',
  'panel.layout.restoreHidden': '숨긴 활동 표시줄 도구 복원',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': '필터',
  'panel.filter.clear': '지우기',
  'panel.filter.clearAria': '필터 지우기',
  'panel.filter.matchCase': '대소문자 구분 (Alt+C)',
  'panel.filter.wholeWord': '단어 단위 일치 (Alt+W)',
  'panel.filter.regex': '정규식 사용 (Alt+R)',
  'panel.filter.more': '더 보기',
  'panel.filter.hiddenClearFilter': '필터 지우기',
  'panel.filter.hiddenDismiss': '무시',

  'panel.menu.resetToDefault': '기본값으로 재설정',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': '추가 필터',
  'panel.moreFilters.hideDataUrls': 'data URL 숨기기',
  'panel.moreFilters.hideExtensionUrls': '확장 프로그램 URL 숨기기',
  'panel.moreFilters.blockedRequests': '차단된 요청',
  'panel.moreFilters.thirdParty': '서드파티 요청',
  'panel.moreFilters.swRequests': '서비스 워커 요청',
  'panel.moreFilters.ruleApplied': '규칙 적용 요청',
  'panel.moreFilters.pageOriginPending': '페이지 출처를 아직 알 수 없음',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': '푸터 보기',
  'panel.view.title': '푸터에 표시할 통계 선택',
  'panel.view.focusedTool': '포커스된 도구',
  'panel.view.focusedToolTitle':
    '푸터가 포커스된 도구 창을 따릅니다. Storage, Console, 검색 창은 자체 요약을 표시하고 다른 도구는 Network 줄로 대체됩니다.',
  'panel.view.networkOnly': 'Network 도구만',
  'panel.view.networkOnlyTitle': '어느 도구 창에 포커스가 있든 푸터는 항상 Network 수치를 표시합니다.',
  'panel.view.modifiedCount': '수정 수',
  'panel.view.failedCount': '실패 수',
  'panel.view.cachedCount': '캐시 수',
  'panel.view.pageLabel': '현재 페이지 레이블',
  'panel.view.pageLabelTitle': '로그가 둘 이상의 탐색에 걸칠 때 타이밍 이정표가 설명하는 페이지 이름을 표시합니다.',
  'panel.view.timingAllNavs': '모든 탐색에 걸친 타이밍',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load 수치가 첫 탐색부터 보존 로그 타임라인 전체에 걸칩니다 (브라우저 기본값). 선택을 해제하면 최신 탐색만 보고합니다.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': '트래픽 내보내기',
  'panel.export.exportAll': 'HAR 형식으로 모두 내보내기',
  'panel.export.exportAllSanitized': 'HAR 형식으로 모두 내보내기 (정리됨)',
  'panel.export.copyAll': 'HAR 형식으로 모두 복사',
  'panel.export.copyAllSanitized': 'HAR 형식으로 모두 복사 (정리됨)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': '캐시 사용 안 함',
  'panel.cache.tooltipDebug':
    '네트워크 스택 수준에서 캐시를 비활성화합니다 (디버그 모드). 브라우저 기본 캐시 사용 안 함과 동일합니다.',
  'panel.cache.tooltipStandard':
    '재검증을 강제해 HTTP 캐시를 우회합니다. 메모리 내 캐시까지 포함한 전체 네트워크 스택 비활성화는 디버그 모드를 활성화하세요.',
  'panel.cache.aboutAria': '캐시 사용 안 함 정보',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': '스로틀링 없음',
  'panel.throttle.custom': '사용자 지정',
  'panel.throttle.customEllipsis': '사용자 지정…',
  'panel.throttle.customHint': '다운로드, 업로드, 지연 시간을 설정합니다.',
  'panel.throttle.customTitle': '사용자 지정 스로틀링',
  'panel.throttle.download': '다운로드',
  'panel.throttle.upload': '업로드',
  'panel.throttle.latency': '지연 시간',
  'panel.throttle.appliesToTab': '이 탭에 적용',
  'panel.throttle.morePresets': '추가 프리셋',
  'panel.throttle.morePresetsSubtitle': '광섬유, 케이블, DSL, 5G, 2G.',
  'panel.throttle.wired': '유선',
  'panel.throttle.mobile': '모바일',
  'panel.throttle.disabledTooltip':
    '네트워크 스로틀링은 디버그 모드에서만 사용할 수 있습니다. 이 탭을 스로틀링하려면 디버그 모드를 활성화하세요.',
  'panel.throttle.aboutAria': '네트워크 스로틀링 정보',
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 지연 2 ms',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 지연 8 ms',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 지연 25 ms',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 지연 8 ms',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 지연 18 ms',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 지연 165 ms',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 지연 562.5 ms',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 지연 2000 ms',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 지연 2000 ms',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 지연 3000 ms',
  'panel.throttle.subtitle.offline': '탭의 모든 네트워크 트래픽을 차단합니다.',

  'panel.debug.apply': '적용',
  'panel.debug.enableDebugMode': '디버그 모드 활성화',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': '재정의',
  'panel.overrides.disabledTooltip':
    '시스템 재정의는 디버그 모드에서만 사용할 수 있습니다. 이 탭을 재정의하려면 디버그 모드를 활성화하세요.',
  'panel.overrides.aboutAria': '시스템 재정의 정보',
  'panel.overrides.wireHint': '이 탭이 디버그 모드에 있는 동안 요청에 실려 전송되고 페이지 스크립트에도 보고됩니다.',
  'panel.overrides.pageOnlyHint':
    '페이지 전용: 요청이 아니라 페이지 자체 스크립트와 CSS 코드가 관찰하는 값을 바꿉니다.',
  'panel.overrides.platform': '플랫폼',
  'panel.overrides.locale': '로케일',
  'panel.overrides.timezone': '시간대',
  'panel.overrides.colorScheme': '색 구성표',
  'panel.overrides.reducedMotion': '동작 줄이기',
  'panel.overrides.printMedia': '인쇄 미디어',
  'panel.overrides.uaPlaceholder': '사용자 지정 User-Agent 문자열',
  'panel.overrides.alPlaceholder': '예: fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, 예: Linux',
  'panel.overrides.localePlaceholder': '실제 로케일',
  'panel.overrides.timezonePlaceholder': '실제 시간대',
  'panel.overrides.auto': '자동',
  'panel.overrides.light': '라이트',
  'panel.overrides.dark': '다크',
  'panel.overrides.reduce': '줄이기',
  'panel.overrides.noPref': '선호 없음',
  'panel.overrides.screen': '화면',
  'panel.overrides.print': '인쇄',
  'panel.overrides.resetAll': '모두 재설정',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    '페이지가 바뀔 때마다 목록을 지우는 대신 페이지 탐색과 새로 고침 간에 기록된 요청을 유지합니다.',
  'panel.info.preserveLog.description':
    '켜면 로그가 모든 탐색에 걸쳐 이어지므로 리디렉션, 폼 제출, 새로 고침 직전에 실행된 요청이 계속 보입니다. 끄면 브라우저 자체 Network 패널처럼 탐색이나 새로 고침마다 목록이 지워지고 현재 페이지의 트래픽만 표시됩니다.',
  'panel.info.preserveLog.whenHeading': '이럴 때 사용',
  'panel.info.preserveLog.redirects': '리디렉션',
  'panel.info.preserveLog.redirectsDesc': '새 페이지가 지우기 전에 탐색을 일으킨 요청을 검사합니다.',
  'panel.info.preserveLog.forms': '폼 제출 / 로그인',
  'panel.info.preserveLog.formsDesc': '페이지가 새로 고침된 뒤에도 POST 요청과 응답을 계속 봅니다.',
  'panel.info.preserveLog.reloadLoops': '새로 고침 루프',
  'panel.info.preserveLog.reloadLoopsDesc': '페이지가 스스로 새로 고침되기 직전에 무엇이 실행되었는지 봅니다.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    '메뉴 뒤에 숨은 보조 요청 필터입니다. 각 필터는 도구 모음 공간을 차지하지 않고 목록을 좁힙니다.',
  'panel.info.moreFilters.hideHeading': '숨기기',
  'panel.info.moreFilters.dataUrls': 'data URL',
  'panel.info.moreFilters.dataUrlsDesc': '인라인 data: 리소스(base64 이미지, 글꼴 등)를 제외합니다.',
  'panel.info.moreFilters.extensionUrls': '확장 프로그램 URL',
  'panel.info.moreFilters.extensionUrlsDesc': '브라우저 확장 프로그램 출처로의 요청을 제외합니다.',
  'panel.info.moreFilters.onlyHeading': '다음만 표시',
  'panel.info.moreFilters.blocked': '차단된 요청',
  'panel.info.moreFilters.blockedDesc': '규칙이 차단한 요청으로 목록을 제한합니다.',
  'panel.info.moreFilters.thirdParty': '서드파티 요청',
  'panel.info.moreFilters.thirdPartyDesc': '출처가 페이지와 다른 요청으로 제한합니다.',
  'panel.info.moreFilters.swRequests': '서비스 워커 요청',
  'panel.info.moreFilters.swRequestsDesc':
    '서비스 워커 교환으로 제한합니다. 워커가 직접 보낸 요청(⚙ 행)과 워커의 fetch 핸들러가 응답한 페이지 요청입니다.',
  'panel.info.moreFilters.ruleApplied': '규칙 적용 요청',
  'panel.info.moreFilters.ruleAppliedDesc': 'Open Headers 규칙이 검증 가능하게 수정한 요청으로 제한합니다.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary': '항상 표시되는 요청 수와 전송량 옆에 푸터가 표시할 선택 통계를 고릅니다.',
  'panel.info.view.scopeHeading': '요약 범위',
  'panel.info.view.focusedTool': '포커스된 도구',
  'panel.info.view.focusedToolDesc':
    '푸터가 포커스된 도구 창을 따릅니다. Storage, Console, 검색 창은 자체 요약 줄을 표시하고 다른 도구는 Network 줄로 대체됩니다.',
  'panel.info.view.networkOnly': 'Network 도구만',
  'panel.info.view.networkOnlyDesc': '어느 도구 창에 포커스가 있든 푸터는 항상 Network 수치를 표시합니다.',
  'panel.info.view.countsHeading': '푸터 수치',
  'panel.info.view.modified': '수정됨',
  'panel.info.view.modifiedDesc': '규칙이 변경한 요청 수입니다.',
  'panel.info.view.failed': '실패',
  'panel.info.view.failedDesc': '오류가 났거나 차단된 요청 수입니다.',
  'panel.info.view.cached': '캐시됨',
  'panel.info.view.cachedDesc': '캐시에서 제공된 응답 수입니다.',
  'panel.info.view.timingHeading': '타이밍',
  'panel.info.view.pageLabel': '현재 페이지 레이블',
  'panel.info.view.pageLabelDesc': '로그가 둘 이상의 탐색에 걸칠 때 타이밍 이정표가 설명하는 페이지 이름을 표시합니다.',
  'panel.info.view.allNavs': '모든 탐색에 걸쳐',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load 수치가 최신 탐색만이 아니라 보존 로그 타임라인 전체에 걸칩니다.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': '이 탭이 캐시에서 응답을 제공하지 않도록 합니다.',
  'panel.info.cache.debugDesc':
    '이 탭은 디버그 모드입니다. 메모리 내 캐시를 포함해 네트워크 스택 수준에서 캐시가 비활성화되며 브라우저 기본 캐시 사용 안 함과 동일합니다.',
  'panel.info.cache.standardDesc':
    '이 탭은 표준 모드입니다. 서버에 재검증을 요청해 HTTP 캐시만 우회합니다. 메모리 내 캐시까지 지우는 전체 네트워크 스택 비활성화는 디버그 모드를 활성화하세요.',
  'panel.info.cache.standardHeading': '표준 모드',
  'panel.info.cache.revalidateDesc': '서버가 신선도를 다시 확인하도록 모든 요청에 추가됩니다. HTTP 캐시만 우회합니다.',
  'panel.info.cache.debugHeading': '디버그 모드',
  'panel.info.cache.cdpDesc': '메모리 내 캐시를 포함해 네트워크 스택 수준에서 탭 전체의 캐시를 비활성화합니다.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': '시스템 재정의',
  'panel.info.overrides.summary':
    '이 탭의 시스템 신원(User-Agent, 로케일, 시간대, 에뮬레이션된 미디어)을 고정해 사이트가 다른 클라이언트에 어떻게 응답하는지 봅니다.',
  'panel.info.overrides.debugDesc':
    '디버그 모드를 통해 이 탭에서 활성화되어 있습니다. User-Agent 관련 항목은 요청과 페이지 스크립트에 적용되고, 로케일, 시간대, 미디어는 페이지 자체 스크립트와 CSS 코드가 관찰하는 값만 바꿉니다. 모두 재설정을 누르면 실제 값이 복원됩니다.',
  'panel.info.overrides.standardDesc':
    '시스템 재정의에는 디버그 모드가 필요하며 표준 모드 대체 수단은 없습니다. 디버그 모드를 활성화하고 이 탭을 범위 안에 유지하면 재정의할 수 있습니다.',
  'panel.info.overrides.wireHeading': '네트워크 + 페이지 스크립트',
  'panel.info.overrides.uaDesc': 'User-Agent / Accept-Language 헤더, 플랫폼, 그에 맞는 navigator.* 값을 설정합니다.',
  'panel.info.overrides.pageHeading': '페이지 전용',
  'panel.info.overrides.localeDesc': '페이지 스크립트가 읽는 로케일을 바꿉니다.',
  'panel.info.overrides.timezoneDesc': 'Date 및 Intl 객체가 해석하는 시간대를 바꿉니다.',
  'panel.info.overrides.mediaDesc': 'color-scheme / reduced-motion / print 미디어 쿼리를 강제합니다.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': '네트워크 스로틀링',
  'panel.info.throttle.summary': '이 탭의 대역폭을 제한하고 지연 시간을 추가해 느린 연결을 시뮬레이션합니다.',
  'panel.info.throttle.debugDesc':
    '디버그 모드를 통해 이 탭에서 활성화되어 있습니다. 프리셋(기본 프리셋과 추가 프리셋의 광섬유 / 케이블 / DSL, 5G / 2G)을 고르거나, 오프라인으로 전환하거나, 다운로드 / 업로드 / 지연 시간을 직접 설정하세요.',
  'panel.info.throttle.standardDesc':
    '스로틀링에는 디버그 모드가 필요하며 표준 모드 대체 수단은 없습니다. 디버그 모드를 활성화하고 이 탭을 범위 안에 유지하면 스로틀링할 수 있습니다.',
  'panel.info.throttle.presetsHeading': '프리셋',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s 다운로드, 지연 165 ms.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s 다운로드, 지연 562.5 ms.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, 지연 2000 ms.',
  'panel.info.throttle.offlineDesc': '탭의 모든 네트워크 트래픽을 차단합니다.',
  'panel.info.throttle.wiredHeading': '추가 프리셋 · 유선',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, 지연 2 ms.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s 다운로드, 지연 8 ms.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s 다운로드, 지연 25 ms.',
  'panel.info.throttle.mobileHeading': '추가 프리셋 · 모바일',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s 다운로드, 지연 8 ms.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s 다운로드, 지연 18 ms.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, 지연 2000 ms.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, 지연 3000 ms.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) => plural(locale, Number(count), { other: '요청 {count}개' }),
  'panel.status.requestsSubset': '요청 {subset} / {total}개',
  'panel.status.modified': '수정 {count}개',
  'panel.status.modifiedTitle': '규칙이 수정한 요청',
  'panel.status.failed': '실패 {count}개',
  'panel.status.failedTitle': '실패했거나 오류 상태인 요청',
  'panel.status.cached': '캐시 {count}개',
  'panel.status.cachedTitle': '캐시에서 제공된 요청',
  'panel.status.transferredOnly': '{size} 전송',
  'panel.status.transferredAndResources': '{transferred} 전송 / 리소스 {resources}',
  'panel.status.transferredSubset': '{subset} / {total} 전송',
  'panel.status.resourcesSubset': '리소스 {subset} / {total}',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Load 이벤트',
  'panel.status.tabs': ({ count }, locale) => plural(locale, Number(count), { other: '탭 {count}개' }),
  'panel.status.messagesOf': '메시지 {total}개 중 {visible}개',
  'panel.status.messages': ({ count }, locale) => plural(locale, Number(count), { other: '메시지 {count}개' }),
  'panel.status.errors': ({ count }, locale) => plural(locale, Number(count), { other: '오류 {count}개' }),
  'panel.status.errorsTitle': '오류 수준의 콘솔 메시지',
  'panel.status.warnings': ({ count }, locale) => plural(locale, Number(count), { other: '경고 {count}개' }),
  'panel.status.warningsTitle': '경고 수준의 콘솔 메시지',
  'panel.status.systemStatus': '시스템',
  'panel.status.theme.light': '라이트',
  'panel.status.theme.dark': '다크',
  'panel.status.theme.auto': '자동',

  // ── Tool-window registry labels ─────────────────────────────────────
  'panel.toolWindows.network': 'Network',
  'panel.capture.collapsePlane': '이 섹션 접기',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': '검색',
  'panel.toolWindows.notifications': '알림',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': '규칙 활동',
  'panel.toolWindows.matchedRules': '일치한 규칙',

  // ── Search tool window (station: search family) ─────────────────────
  'panel.search.placeholder': '검색 (Enter 키)',
  'panel.search.inputAria': '캡처된 데이터 검색',
  'panel.search.syntaxHelp': '검색 구문 도움말',
  'panel.search.run': '검색',
  'panel.search.runTitle': '검색 실행 (Enter)',
  'panel.search.cancel': '취소',
  'panel.search.cancelTitle': '검색 취소',
  'panel.search.idleHintMin': '검색어(2자 이상)를 입력하고 Enter 키를 누르세요.',
  'panel.search.idleHintShort': 'Enter 키를 눌러 검색하세요.',
  'panel.search.noMatches': '일치 항목이 없습니다.',

  'panel.search.status.searching': '검색 중… {done} / {total}',
  'panel.search.status.noResults': '결과 없음 · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), { other: '일치 항목 {count}개' });
    const where = plural(locale, Number(files), { other: '파일 {count}개' });
    return `${where}에서 ${found} 발견 · ${elapsed}`;
  },
  'panel.search.status.capped': '처음 {shown}개 표시 중. 나머지를 보려면 검색어를 좁히세요',

  'panel.search.group.countTitle': '이 파일에서 일치 항목 {count}개',
  'panel.search.group.countTitleCapped': '이 파일에서 일치 항목 {count}개. 처음 {shown}개 표시 중',
  'panel.search.row.lineCol': '{line}행, {col}열',
  'panel.search.row.line': '{line}행',
  'panel.search.row.matchesOnLine': '이 줄에서 일치 항목 {count}개',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  'panel.matchedRules.selectPrompt.lead': '요청을 선택하면 해당 요청에 적용되는',
  'panel.matchedRules.selectPrompt.tail': '규칙이 표시됩니다',
  'panel.matchedRules.matchedCount': '일치 · {count}',
  'panel.matchedRules.futureCount': '향후 일치 · {count}',
  'panel.matchedRules.noMatched': '이 요청과 일치한 규칙이 없습니다.',
  'panel.matchedRules.noFuture': '이 요청과 일치할 다른 규칙이 없습니다.',
  'panel.matchedRules.pattern': '패턴: {pattern}',
  'panel.matchedRules.wouldMatch': '일치 예정',

  'panel.matchedRules.evidence.contradicted': '모순',
  'panel.matchedRules.evidence.authoritative': '확정',
  'panel.matchedRules.evidence.confirmed': '확인됨',
  'panel.matchedRules.evidence.fallback': '간접',
  'panel.matchedRules.evidence.silent': '무음',
  'panel.matchedRules.evidence.corroborated': '입증',
  'panel.matchedRules.evidence.inferred': '추정',
  'panel.matchedRules.evidenceTitle.contradicted': '모순: 캡처된 헤더가 이 규칙이 주장한 수정을 반증합니다.',
  'panel.matchedRules.evidenceTitle.authoritative':
    '확정: 규칙 엔진이 이 DNR 규칙이 요청에서 실행되었음을 확인했습니다.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    '확인됨: 규칙이 페이지 컨텍스트에서 본문을 수정했고 이 요청에 대해 양쪽(제공된 것과 원본)이 모두 캡처되었습니다.',
  'panel.matchedRules.evidenceTitle.confirmed':
    '확인됨: 페이지 내 리포터가 확인했습니다. 스크립트 동작이 페이지 안에서 실행되었습니다.',
  'panel.matchedRules.evidenceTitle.fallback':
    '간접: URL 일치에서 추정했습니다. 스크립트 확인이 예상되었지만 도착하지 않았습니다.',
  'panel.matchedRules.evidenceTitle.silent':
    '무음: 패턴은 일치했지만 요청이 캐시 / 서비스 워커에서 제공되어 DNR 또는 스크립트 동작이 실행되지 않았습니다.',
  'panel.matchedRules.evidenceTitle.corroborated': '입증: 주장된 수정이 캡처된 헤더에서 확인됩니다.',
  'panel.matchedRules.evidenceTitle.inferred':
    '추정: URL 일치에서 추정했습니다. 조건상 규칙이 이 요청과 일치할 것입니다.',
  'panel.matchedRules.contradiction.stillPresent': '{header} 헤더가 아직 남아 있습니다 ({observed}).',
  'panel.matchedRules.contradiction.missing': '{header} 헤더가 캡처된 헤더에 없습니다.',
  'panel.matchedRules.contradiction.otherValue': '{header} 헤더에 주장된 값 대신 "{observed}" 값이 실려 있습니다.',

  'panel.matchedRules.ruleState.deleted': '규칙 삭제됨',
  'panel.matchedRules.ruleState.disabled': '규칙 비활성',
  'panel.matchedRules.ruleState.modified': '규칙 수정됨',
  'panel.matchedRules.ruleStateTitle.deleted':
    '이 규칙은 실행된 후 삭제되었습니다. 이 행은 실행 당시 규칙이 한 일을 보여 줍니다.',
  'panel.matchedRules.ruleStateTitle.disabled':
    '이 규칙은 실행된 후 비활성화되었습니다. 다음 요청에는 적용되지 않습니다.',
  'panel.matchedRules.ruleStateTitle.modified':
    '이 규칙은 실행된 후 편집되었습니다. 이 행은 실행 당시 규칙이 한 일을 보여 주며, 마우스를 올리면 현재 규칙이 표시됩니다.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': '이 탭에는 아직 규칙 활동이 없습니다.',
  'panel.ruleActivity.toolbarHint': '규칙별로 묶은 규칙 활동입니다.',
  'panel.ruleActivity.hint.applied': '적용됨',
  'panel.ruleActivity.hint.appliedDesc':
    '실행은 실제로 실행된 것으로 확인된 경우입니다. 규칙 엔진이 실행을 보고했거나, 페이지 내 리포터가 동작 실행을 확인했거나, 캡처된 헤더에서 수정이 확인된 경우입니다.',
  'panel.ruleActivity.hint.contradicted': '모순',
  'panel.ruleActivity.hint.contradictedDesc': '실행은 캡처된 헤더가 반증하는 헤더 변경을 주장한 경우입니다.',
  'panel.ruleActivity.hint.inferred': '추정',
  'panel.ruleActivity.hint.inferredDesc': '실행은 규칙 패턴이 관찰된 요청과 일치했지만 확인되지 않은 경우입니다.',
  'panel.ruleActivity.hint.offHar': 'HAR 외',
  'panel.ruleActivity.hint.offHarDesc': '실행은 패널이 캡처하지 않은 요청에서의 규칙 일치입니다.',
  'panel.ruleActivity.hits': ({ count }, locale) => plural(locale, Number(count), { other: '적중 {count}개' }),
  'panel.ruleActivity.applied': '적용 {count}개',
  'panel.ruleActivity.contradicted': '모순 {count}개',
  'panel.ruleActivity.offHar': 'HAR 외 {count}개',
  'panel.ruleActivity.offHarTitle': 'HAR 외: 패널이 이 실행에 대한 HAR 셸을 캡처하지 않았습니다',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  'panel.valueDoc.crumbFallback': '규칙',
  'panel.valueDoc.saveHint': '편집한 값을 다시 인코딩해 규칙에 기록합니다',
  'panel.valueDoc.blockedHintInvalid': '편집한 텍스트를 이 값 유형으로 인코딩할 수 없습니다',
  'panel.valueDoc.blockedHintDetached': '이 값이 속했던 규칙 필드가 사라졌습니다',
  'panel.valueDoc.rereadTitle': '규칙에서 값을 다시 읽기',
  'panel.valueDoc.rereadConfirm': '편집 내용을 버립니다. 다시 읽으려면 한 번 더 클릭하세요',
  'panel.valueDoc.rereadAria': '편집 내용을 버리고 값 다시 읽기',
  'panel.valueDoc.openRuleTitle': '워크스페이스 편집기에서 이 규칙 열기',
  'panel.valueDoc.openRule': '워크스페이스에서 규칙 열기',
  'panel.valueDoc.driftNote':
    '편집하는 동안 규칙의 값이 바뀌었습니다. 저장하지 않은 편집 내용은 유지됩니다. 저장하면 덮어씁니다.',
  'panel.valueDoc.undetectedNote':
    '필드에 더 이상 이 편집기가 인코딩할 수 있는 값이 없습니다. 저장하지 않은 편집 내용은 복사용으로 유지됩니다.',
  'panel.valueDoc.detachedNote':
    '이 값이 속했던 규칙 필드가 사라졌습니다. 저장하지 않은 편집 내용은 복사용으로 유지됩니다.',
  'panel.valueDoc.discardEdits': '내 편집 내용 버리기',
  'panel.valueDoc.saveFailed.detached': '이 값이 속했던 수정 항목이 규칙에서 사라졌습니다. 기록할 곳이 없습니다.',
  'panel.valueDoc.saveFailed.notFound': '규칙을 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'panel.valueDoc.saveFailed.write': '저장 실패: 규칙이 쓰기를 거부했습니다.',
  'panel.valueDoc.encodedPreview': '인코딩 미리보기',
  'panel.valueDoc.cannotEncode': '인코딩할 수 없습니다. 편집한 값이 이 유형에 유효하지 않습니다',
  'panel.valueDoc.undetectedTitle': '더 이상 인코딩된 값이 아님',
  'panel.valueDoc.undetectedSub': '필드의 현재 값이 어떤 디코더와도 맞지 않습니다. 대신 규칙 편집기에서 편집하세요.',
  'panel.valueDoc.detachedTitle': '값이 더 이상 규칙에 없음',
  'panel.valueDoc.detachedSub':
    '이 값을 담고 있던 규칙이나 수정 항목이 삭제되었거나, 작업이 더 이상 값을 갖지 않습니다.',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  'panel.valueView.snapshotNote': '스냅샷',
  'panel.valueView.snapshotTitle': '이 문서를 열었을 때 캡처되었으며 이후 변경 사항은 반영하지 않습니다.',
  'panel.valueView.encodedValue': '인코딩된 값',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  'panel.ruleDoc.crumbKind': '응답 재정의',
  'panel.ruleDoc.nameLabel': '규칙 이름',
  'panel.ruleDoc.saveHint': '재정의 규칙을 저장합니다. 같은 단계에서 게시 상태가 유지됩니다',
  'panel.ruleDoc.saveHintCreate': '규칙을 만들고 게시합니다',
  'panel.ruleDoc.blockedHintDetached': '이 문서가 속했던 규칙이 사라졌습니다',
  'panel.ruleDoc.rereadTitle': '규칙 다시 읽기',
  'panel.ruleDoc.rereadConfirm': '편집 내용을 버립니다. 다시 읽으려면 한 번 더 클릭하세요',
  'panel.ruleDoc.rereadAria': '편집 내용을 버리고 규칙 다시 읽기',
  'panel.ruleDoc.openRuleTitle': '워크스페이스 편집기에서 이 규칙 열기',
  'panel.ruleDoc.openRule': '워크스페이스에서 열기',
  'panel.ruleDoc.saveFailed.notFound': '규칙을 찾을 수 없습니다. 삭제되었을 수 있습니다.',
  'panel.ruleDoc.saveFailed.write': '저장 실패: 규칙이 쓰기를 거부했습니다.',
  'panel.ruleDoc.detachedTitle': '규칙이 더 이상 존재하지 않음',
  'panel.ruleDoc.detachedSub': '이 문서가 편집하던 재정의 규칙이 삭제되었습니다.',
  'panel.ruleDoc.dynamicTitle': '동적 본문 규칙',
  'panel.ruleDoc.dynamicSub': 'JavaScript 응답 본문은 워크스페이스 편집기에서 편집합니다.',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  'panel.tour.stepIndicator': '{total}단계 중 {current}단계',
  'panel.tour.previous': '이전',
  'panel.tour.next': '다음',
  'panel.tour.finish': '완료',
  'panel.tour.welcomeTitle': '통합 DevTools 경험',
  'panel.tour.welcomeSubtitle': '내 규칙이 내장된 네트워크 디버거입니다.',
  'panel.tour.welcomeCapture': '캡처',
  'panel.tour.welcomeCaptureHint': '— 타이밍, 헤더, 크기가 포함된 실시간 요청',
  'panel.tour.welcomeRules': '귀속',
  'panel.tour.welcomeRulesHint': '— 각 요청에서 어떤 규칙이 왜 실행되었는지 확인',
  'panel.tour.welcomeState': '검사',
  'panel.tour.welcomeStateHint': '— 트래픽 옆에서 쿠키, 저장소, 콘솔 확인',
  'panel.tour.networkTitle': 'Network 창',
  'panel.tour.networkSubtitle': '검사 중인 탭이 보내는 모든 요청을 실시간으로 봅니다.',
  'panel.tour.networkFilters': '필터',
  'panel.tour.networkFiltersHint': '— 텍스트, 리소스 유형 또는 추가 필터 프리셋으로',
  'panel.tour.networkToolbar': '제어',
  'panel.tour.networkToolbarHint': '— 상단의 로그 보존, 스로틀링, 캐시 사용 안 함',
  'panel.tour.networkExport': '내보내기',
  'panel.tour.networkExportHint': '— 전체 로그를 HAR 형식으로 저장하거나 복사',
  'panel.tour.storageTitle': 'Storage 창',
  'panel.tour.storageSubtitle': '검사 중인 탭의 클라이언트 측 상태를 한곳에서 봅니다.',
  'panel.tour.storageAreas': '탐색',
  'panel.tour.storageAreasHint': '— 로컬 및 세션 저장소, 쿠키, IndexedDB, 캐시',
  'panel.tour.storageEdit': '편집',
  'panel.tour.storageEditHint': '— 항목을 문서 탭으로 열어 그 자리에서 변경',
  'panel.tour.inspectorTitle': '요청 상세',
  'panel.tour.inspectorSubtitle': '요청을 선택하면 여기에 탭으로 열립니다.',
  'panel.tour.inspectorTabs': '섹션',
  'panel.tour.inspectorTabsHint': '— 헤더, 페이로드, 응답, 타이밍, 쿠키',
  'panel.tour.inspectorEdit': '재정의',
  'panel.tour.inspectorEditHint': '— 패널을 떠나지 않고 요청에서 규칙 만들기',
  'panel.tour.layoutTitle': '내 방식대로',
  'panel.tour.layoutSubtitle': '측면 레일에 더 많은 도구 창이 있습니다.',
  'panel.tour.layoutTools': '추가 도구',
  'panel.tour.layoutToolsHint': '— Console, 검색, Docs, 알림이 레일에 있습니다',
  'panel.tour.layoutDrag': '재배치',
  'panel.tour.layoutDragHint': '— 도크 사이에서 도구 창을 끌어 옮기고, 레이아웃 메뉴로 재설정',
  'panel.tour.debugTitle': '디버그 모드',
  'panel.tour.debugSubtitle': '기본적으로 꺼져 있습니다. 더 깊은 캡처가 필요할 때 여기서 켜세요.',
  'panel.tour.debugUnlocks': '잠금 해제',
  'panel.tour.debugUnlocksHint': '— 응답 본문, 콘솔, 정확한 타이밍, 스크립트 계층 규칙',
  'panel.tour.debugBanner': '주의',
  'panel.tour.debugBannerHint': '— 켜져 있는 동안 브라우저가 연결된 탭에 디버깅 배너를 표시합니다',

  // ── Value expander (headers / cookies detail readout) ──────────────
  'panel.valueExpander.decoded': '디코딩됨',
  'panel.valueExpander.raw': 'Raw',
} as const satisfies Catalog;
