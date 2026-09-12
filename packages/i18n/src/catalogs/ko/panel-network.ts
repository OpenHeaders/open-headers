/**
 * DevTools panel — traffic table plane — Korean. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, `n/a`, and every µs/ms/s figure. Mints: 워터폴 =
 * waterfall (prose — the column name stays raw); 대기열 = queue; 대기열
 * 진입 = queued; 미추적 간격 = untracked gaps; 준비된 소켓 = warm
 * socket; 주요 시점 = key moments; band names 스케줄링 / 연결 / 전송;
 * 합성 행 = synthesized row; 캡처 정확도 공백 = capture-fidelity gap;
 * 수준 = sort level; 최종 동순위 기준 = tiebreak; 민감 정보 제거 =
 * sanitized; 주석 = row annotation (rail); 모순 = contradicted
 * (carried); 도달하지 않음 = the rung state with 이 시점에 도달하지
 * 않음 = the instant-tick referent (separate referents); 디버그 모드
 * 보류 = debug-mode hold; 시스템 프록시 = System Proxy (the desktop
 * file quotes it later).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus (station: traffic
  // menus) ─────────────────────────────────────────────────────────────
  // Raw by design (network-table parity vocabulary): the column names
  // (Name / Status / Type / … / Waterfall) everywhere they appear —
  // header cells, the column-visibility menu rows, the nested-sort
  // builder options, the closed-state sort subtitles — and the Waterfall
  // metric names (Start time / Response time / End time / Total duration
  // / Latency) plus their header tags (ST / RT / ET / TD / L). The menu
  // chrome AROUND them localizes; the vocabulary itself does not.
  'panel.network.filterSyntaxHelp': '필터 구문 도움말',
  'panel.network.aboutTypeFilters': '요청 유형 필터 정보',
  'panel.network.aboutSorting': '정렬 정보',

  // ── Remote capture — consent refusal ────────────────────────────────
  'panel.capture.watchRefused.title': '이 브라우저에서는 라이브 보기가 꺼져 있습니다',
  'panel.capture.watchRefused.body':
    '이 브라우저의 Open Headers 확장 프로그램은 데스크톱 앱이 트래픽, 저장소, 콘솔을 보는 것을 허용하지 않습니다. 여기서 보려면 확장 프로그램 설정에서 “데스크톱 앱이 이 브라우저를 보도록 허용”을 켜세요.',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': '출처의 서비스 워커가 보낸 요청',
  'panel.network.cell.jumpToPreflight': '프리플라이트 요청으로 이동',
  'panel.network.cell.selectPreflightInitiator': '이 프리플라이트를 시작한 요청 선택',
  'panel.network.cell.pendingTitle': '요청이 아직 끝나지 않았습니다',
  'panel.network.cell.pending': '대기 중',
  'panel.network.gridAria': '네트워크 요청',
  'panel.network.noMatches': '일치하는 요청이 없습니다.',
  'panel.network.reloadPage': '페이지 새로 고침',
  'panel.network.startRecording': '기록 시작',

  // View ▾ menu
  'panel.network.view.label': '보기',
  'panel.network.view.layout': '레이아웃',
  'panel.network.view.layoutCompact': '간결',
  'panel.network.view.layoutWide': '넓게',
  'panel.network.view.valueNumber': '수치',
  'panel.network.view.showValue': '수치 표시',
  'panel.network.view.valuesAlways': '항상',
  'panel.network.view.valuesHover': '마우스를 올릴 때',
  'panel.network.view.valuesOff': '끔',
  'panel.network.view.valueFormat': '수치 형식',
  'panel.network.view.formatRelative': '상대',
  'panel.network.view.formatTimestamp': '타임스탬프',
  'panel.network.view.timezone': '시간대',
  'panel.network.view.tzLocal': '로컬',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': '수치 설명',
  'panel.network.view.explainValueTitle':
    '마우스를 올렸을 때 나오는 팝오버에서 합계를 이루는 행을 강조하고 그 합을 표시합니다.',
  'panel.network.view.popover': '팝오버',
  'panel.network.view.popoverTitle':
    '마우스를 올렸을 때 나오는 타이밍 내역의 방향입니다. 자동은 패널 너비로 고릅니다. 넓으면 가로, 좁으면 세로입니다.',
  'panel.network.view.popoverAuto': '자동',
  'panel.network.view.popoverCompact': '간결',
  'panel.network.view.popoverWide': '넓게',
  'panel.network.view.showFireDots': '규칙 실행 점 표시',

  // Sort ▾ menu
  'panel.network.sort.label': '정렬',
  'panel.network.sort.heading': '정렬 순서',
  'panel.network.sort.byTime': '시간으로 정렬합니다.',
  'panel.network.sort.groupPriority': '우선순위',
  'panel.network.sort.groupPriorityHint': '먼저 살펴봐야 할 것.',
  'panel.network.sort.groupGrouping': '그룹화',
  'panel.network.sort.groupGroupingHint': '범주별로 요청을 묶습니다.',
  'panel.network.sort.ascending': '오름차순',
  'panel.network.sort.descending': '내림차순',
  'panel.network.sort.customNested': '사용자 지정 (중첩)',
  'panel.network.sort.customNestedIdle': '다중 키 정렬입니다. 열마다 지정합니다.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count}개 수준. 열어서 편집합니다.' }),
  'panel.network.sort.noLevelsYet': '아직 수준이 없습니다. 빌더를 여세요.',
  'panel.network.sort.builderTitle': '정렬 기준 (순서대로)',
  'panel.network.sort.builderEmpty': '아직 수준이 없습니다. 아래에서 추가하세요.',
  'panel.network.sort.asc': '오름차순',
  'panel.network.sort.desc': '내림차순',
  'panel.network.sort.removeLevel': '수준 {n} 제거',
  'panel.network.sort.addLevel': '+ 수준 추가',
  'panel.network.sort.finalTiebreak': '최종 동순위 기준: 시작 시각',
  'panel.network.sort.active': '활성',
  'panel.network.sort.apply': '적용',
  'panel.network.sort.columnClick': '사용자 지정 (열 클릭)',
  'panel.network.sort.columnClickIdle': '열 머리글을 클릭하면 그 열로 정렬합니다.',
  'panel.network.sort.columnClickUse': '이 모드를 쓰려면 열 머리글을 클릭하세요',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': '실패 우선',
  'panel.network.sortMode.failuresSubtitle': '실패 → 대기 중 → 리디렉션 → 성공 · 각 그룹 안은 시작 시각순.',
  'panel.network.sortMode.slowest': '가장 느린 것 우선',
  'panel.network.sortMode.slowestSubtitle': '소요 시간이 긴 순 · 동순위는 시작 시각으로 워터폴 순서를 유지합니다.',
  'panel.network.sortMode.largest': '가장 큰 것 우선',
  'panel.network.sortMode.largestSubtitle': '전송 바이트가 큰 순 · 동순위 안은 시작 시각순.',
  'panel.network.sortMode.browserPriority': '브라우저 우선순위',
  'panel.network.sortMode.browserPrioritySubtitle':
    '브라우저가 보고한 우선순위로 Highest → Lowest · 각 그룹 안은 시작 시각순.',
  'panel.network.sortMode.byType': '리소스 유형별',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · 각 그룹 안은 시작 시각순.',
  'panel.network.sortMode.byDomain': '도메인별',
  'panel.network.sortMode.byDomainSubtitle': '호스트 이름으로 그룹화 (A → Z) · 각 도메인 안은 시작 시각순.',
  'panel.network.sortMode.ruleModified': '규칙으로 수정된 것 우선',
  'panel.network.sortMode.ruleModifiedSubtitle': '규칙 적용됨 → 추정 → 실행 없음 · 각 그룹 안은 시작 시각순.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': '요청이 시작된 시각.',
  'panel.network.sortMetric.responseTime': '첫 응답 바이트가 도착한 시각.',
  'panel.network.sortMetric.endTime': '요청이 끝난 시각.',
  'panel.network.sortMetric.duration': '걸린 시간. 막대는 0에 맞춰 정렬됩니다.',
  'panel.network.sortMetric.latency': '첫 바이트까지의 시간. 막대는 0에 맞춰 정렬됩니다.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': '규칙 실행',
  'panel.network.railAnnotations': '주석',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': '새 탭에서 열기',
  'panel.requestMenu.createApiRequest': 'API 요청 만들기',
  'panel.requestMenu.copy': '복사',
  'panel.requestMenu.copyUrl': 'URL 복사',
  'panel.requestMenu.copyAsCurl': 'cURL 형식으로 복사',
  'panel.requestMenu.copyAsFetch': 'fetch 형식으로 복사',
  'panel.requestMenu.copyRequestHeaders': '요청 헤더 복사',
  'panel.requestMenu.copyResponseHeaders': '응답 헤더 복사',
  'panel.requestMenu.copyResponse': '응답 복사',
  'panel.requestMenu.copyAsHar': 'HAR 형식으로 복사',
  'panel.requestMenu.copyAsHarSanitized': 'HAR 형식으로 복사 (민감 정보 제거)',
  'panel.requestMenu.copyAllUrls': '모든 URL 복사',
  'panel.requestMenu.copyAllAsCurl': '모두 cURL 형식으로 복사',
  'panel.requestMenu.copyAllAsHar': '모두 HAR 형식으로 복사',
  'panel.requestMenu.copyAllAsHarSanitized': '모두 HAR 형식으로 복사 (민감 정보 제거)',
  'panel.requestMenu.blockRequests': '요청 차단',
  'panel.requestMenu.blockUrl': '요청 URL 차단',
  'panel.requestMenu.blockDomain': '요청 도메인 차단',
  'panel.requestMenu.saveAs': '다른 이름으로 저장...',
  'panel.requestMenu.saveThisAsHar': '이 요청을 HAR 형식으로 저장',
  'panel.requestMenu.saveThisAsHarSanitized': '이 요청을 HAR 형식으로 저장 (민감 정보 제거)',
  'panel.requestMenu.saveAllAsHar': '모두 HAR 형식으로 저장',
  'panel.requestMenu.saveAllAsHarSanitized': '모두 HAR 형식으로 저장 (민감 정보 제거)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': '요청 유형',
  'panel.network.typeInfo.summary':
    '목록을 하나 이상의 요청 유형으로 좁힙니다. “All”은 모두 표시합니다. 유형을 골라 필터링하거나 여러 개를 조합하세요.',
  'panel.network.typeInfo.inlineHeading': '인라인',
  'panel.network.typeInfo.fetchXhrDesc': 'API 호출입니다. fetch() 및 XMLHttpRequest 호출입니다.',
  'panel.network.typeInfo.socketDesc': 'WebSocket 연결입니다.',
  'panel.network.typeInfo.underMoreHeading': 'More 아래',
  'panel.network.typeInfo.docCssJsDesc': '문서, 스타일시트, 스크립트입니다.',
  'panel.network.typeInfo.fontImgMediaDesc': '글꼴, 이미지, 오디오 / 비디오입니다.',
  'panel.network.typeInfo.manifestWasmOtherDesc': '웹 앱 매니페스트, WebAssembly 모듈, 그 밖의 모든 것입니다.',
  'panel.network.sortInfo.summary':
    '요청 목록의 정렬 방식을 고릅니다. 그룹에 마우스를 올려 구체적인 모드를 선택하세요.',
  'panel.network.sortInfo.modesHeading': '모드',
  'panel.network.sortInfo.waterfallDesc': '시간 기준. 시작, 응답, 종료, 소요 시간 또는 지연 시간.',
  'panel.network.sortInfo.priorityDesc': '먼저 살펴봐야 할 것. 실패, 가장 느린 것, 가장 큰 것.',
  'panel.network.sortInfo.groupingDesc': '유형, 도메인 또는 규칙 수정 여부로 묶습니다.',
  'panel.network.sortInfo.custom': '사용자 지정',
  'panel.network.sortInfo.customDesc': '열 머리글을 클릭하거나 다중 키 중첩 정렬을 구성합니다.',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': '요청 예시',
  'panel.network.colInfo.name.summary':
    '리소스의 파일 이름 또는 마지막 경로 조각입니다. 행을 알아보는 가장 빠른 단서입니다.',
  'panel.network.colInfo.name.description':
    '앞의 아이콘은 리소스 유형을 나타냅니다. 행 툴팁과 상세 보기에 전체 URL 주소, 헤더, 페이로드, 타이밍이 있습니다.',
  'panel.network.colInfo.path.summary': '호스트 뒤의 모든 것입니다. URL 경로와 그 쿼리 문자열입니다.',
  'panel.network.colInfo.url.summary':
    '완전한 요청 URL 주소입니다. 스킴, 호스트, 경로, 쿼리까지 처음부터 끝까지입니다.',
  'panel.network.colInfo.requestNumber.summary':
    '기록 중에 요청이 발견된 순서로 매기는 고정 번호입니다. 1부터 시작합니다.',
  'panel.network.colInfo.requestNumber.description':
    '다시 정렬해도 절대 바뀌지 않으므로 원래 캡처 순서를 되짚는 참조로도 쓸 수 있습니다.',
  'panel.network.colInfo.method.summary': '요청이 사용한 HTTP 동사입니다.',
  'panel.network.colInfo.method.commonVerbsHeading': '흔한 동사',
  'panel.network.colInfo.method.getDesc': '리소스 읽기입니다. 본문이 없고 안전하게 반복할 수 있습니다.',
  'panel.network.colInfo.method.postDesc': '생성 또는 제출입니다. 요청 본문을 실어 보냅니다.',
  'panel.network.colInfo.method.putPatchDesc': '리소스를 교체하거나 부분 수정합니다.',
  'panel.network.colInfo.method.deleteDesc': '리소스를 제거합니다.',
  'panel.network.colInfo.status.summary': 'HTTP 응답 코드 (예: 200, 404) 또는 코드가 없을 때의 짧은 상태 레이블입니다.',
  'panel.network.colInfo.status.description':
    '상태 범위는 색으로 구분하지 않습니다. 진짜 실패 (전송 오류, 4xx/5xx, CORS 거부)는 행 전체를 빨갛게 표시합니다. 캐시 적중이나 상태 없는 행은 셀을 회색으로 흐립니다. 이유 구문 (예: “Not Found”)은 셀 툴팁에 있습니다.',
  'panel.network.colInfo.status.codeRangesHeading': '코드 범위',
  'panel.network.colInfo.status.s2xxDesc': '성공입니다. 요청이 수신되어 처리되었습니다 (예: 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': '리디렉션입니다. Location 헤더를 따라 다음 URL 주소로 갑니다.',
  'panel.network.colInfo.status.s4xxDesc':
    '클라이언트 오류입니다. 요청이 잘못되었거나 인증되지 않았거나 찾을 수 없습니다.',
  'panel.network.colInfo.status.s5xxDesc': '서버 오류입니다. 서버가 유효한 요청을 처리하지 못했습니다.',
  'panel.network.colInfo.status.insteadHeading': '코드 대신',
  'panel.network.colInfo.status.pendingDesc': '보냈지만 아직 응답이 도착하지 않았습니다. 진행 중에는 회색입니다.',
  'panel.network.colInfo.status.failedDesc':
    '전송 수준 실패입니다 (DNS, TLS, 시간 초과, 연결 끊김). 네트워크 스택 코드가 인라인으로 표시됩니다.',
  'panel.network.colInfo.status.canceledDesc': '요청이 끝나기 전에 중단되었습니다.',
  'panel.network.colInfo.status.blockedDesc':
    '브라우저가 정책상의 이유로 거부했습니다. 예: csp 값, 또는 확장 프로그램 / 광고 차단이면 other 값입니다.',
  'panel.network.colInfo.status.corsDesc': '교차 출처 검사가 응답을 거부했습니다.',
  'panel.network.colInfo.status.dataDesc': 'data: URL 형식입니다. 인라인으로 제공되며 네트워크를 전혀 거치지 않습니다.',
  'panel.network.colInfo.status.finishedDesc': '상태 코드가 없는 응답입니다.',
  'panel.network.colInfo.protocol.summary': '연결이 협상한 HTTP 버전입니다. 핸드셰이크 시점에 정해집니다.',
  'panel.network.colInfo.protocol.valuesHeading': '값',
  'panel.network.colInfo.protocol.http11Desc': '텍스트 기반이며 연결당 요청 하나만 진행됩니다.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 프로토콜입니다. 바이너리이며 단일 연결 위에서 다중화됩니다.',
  'panel.network.colInfo.protocol.h3Desc':
    'HTTP/3 프로토콜입니다. UDP 기반 QUIC 위에서 동작해 핸드셰이크가 더 빠릅니다.',
  'panel.network.colInfo.scheme.summary': 'URL 스킴입니다. `https`, `http`, `ws` 또는 `wss`입니다.',
  'panel.network.colInfo.domain.summary': '요청이 향한 호스트 이름입니다.',
  'panel.network.colInfo.remoteAddress.summary': '연결이 실제로 도달한 IP 주소와 포트입니다.',
  'panel.network.colInfo.remoteAddress.description':
    'DNS 응답이 여러 IP 주소를 돌려주거나, CDN 서비스가 anycast 방식으로 라우팅하거나, 로컬 프록시가 연결을 가로채면 도메인과 달라집니다.',
  'panel.network.colInfo.type.summary':
    '브라우저가 지정한 리소스 유형입니다. 행 아이콘과 표 위의 필터 칩을 결정합니다.',
  'panel.network.colInfo.type.examplesHeading': '예시',
  'panel.network.colInfo.type.documentDesc': '최상위 또는 프레임 안의 HTML 탐색입니다.',
  'panel.network.colInfo.type.fetchXhrDesc': 'JavaScript 코드에서 보낸 데이터 요청입니다.',
  'panel.network.colInfo.type.scriptCssDesc': '파서가 불러오는 페이지 리소스입니다.',
  'panel.network.colInfo.type.imgFontMediaDesc': '정적 자산입니다.',
  'panel.network.colInfo.initiator.summary': '요청이 전송되게 만든 원인입니다.',
  'panel.network.colInfo.initiator.kindsHeading': '종류',
  'panel.network.colInfo.initiator.scriptDesc': 'JavaScript 코드에서 실행되었습니다. 셀이 호출 위치로 연결됩니다.',
  'panel.network.colInfo.initiator.parserDesc': 'HTML 파서가 리소스를 찾았습니다 (`<script>`, `<img>`, `<link>` 등).',
  'panel.network.colInfo.initiator.redirectDesc': '`3xx` 응답이 브라우저를 여기로 보냈습니다.',
  'panel.network.colInfo.initiator.otherDesc': '탐색, 프리로드 또는 출처를 알 수 없는 원인입니다.',
  'panel.network.colInfo.cookies.summary':
    '브라우저가 `Cookie` 헤더에 담아 요청에 붙인 쿠키 수입니다. 없으면 비어 있습니다.',
  'panel.network.colInfo.setCookies.summary': '응답이 돌려준 `Set-Cookie` 헤더 수입니다. 없으면 비어 있습니다.',
  'panel.network.colInfo.setCookies.description':
    '요청의 Cookies 탭을 열면 브라우저가 각각을 수락했는지 버렸는지 볼 수 있습니다.',
  'panel.network.colInfo.size.summary': '전송선을 지난 바이트 수입니다. 응답 헤더와 압축 부담을 포함합니다.',
  'panel.network.colInfo.size.insteadHeading': '숫자 대신',
  'panel.network.colInfo.size.diskCacheDesc': '디스크 캐시에서 제공되었습니다. 네트워크를 전혀 거치지 않았습니다.',
  'panel.network.colInfo.size.memoryCacheDesc': '현재 페이지의 메모리 내 캐시에서 제공되었습니다.',
  'panel.network.colInfo.size.pendingDesc': '요청이 아직 끝나지 않았습니다.',
  'panel.network.colInfo.time.summary':
    '요청 전송부터 마지막 응답 바이트까지의 실제 소요 시간입니다. 대기열에서 보낸 시간은 제외됩니다.',
  'panel.network.colInfo.time.description':
    '즉시 응답은 `0 ms`로 표시됩니다. 요청이 아직 진행 중인 동안은 비어 있습니다.',
  'panel.network.colInfo.priority.summary':
    '브라우저가 지정한 가져오기 우선순위입니다. `Highest`부터 `Lowest`까지입니다.',
  'panel.network.colInfo.priority.description':
    '우선순위가 높은 리소스는 더 일찍 요청되고 연결을 더 많이 차지합니다. 페이지는 `fetchpriority` 속성으로 조정할 수 있습니다.',
  'panel.network.colInfo.waterfall.summary':
    '요청마다 하나씩 그리는 타임라인 막대입니다. 머리글 메뉴에서 지표를 고르며 `Waterfall (ST)` 같은 짧은 태그로 표시됩니다.',
  'panel.network.colInfo.waterfall.metricTagsHeading': '지표 태그',
  'panel.network.colInfo.waterfall.stDesc':
    'Start time 지표입니다. 각 요청이 시작된 시각으로 공유 타임라인에 놓입니다.',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time 지표입니다. 첫 응답 바이트가 도착한 시각으로 배치합니다.',
  'panel.network.colInfo.waterfall.etDesc': 'End time 지표입니다. 각 요청이 끝난 시각으로 배치합니다.',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration 지표입니다. 0에 맞춘 막대를 전체 요청 소요 시간으로 크기 지정합니다.',
  'panel.network.colInfo.waterfall.lDesc': 'Latency 지표입니다. 0에 맞춘 막대를 응답이 시작된 지점에서 나눕니다.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': '점은 규칙 중 하나가 작용한 각 요청을 표시합니다.',
  'panel.network.fireRail.dotColorsHeading': '점 색상',
  'panel.network.fireRail.appliedDesc':
    '적용됨. 규칙 엔진이 규칙 실행을 확인했거나, 페이지 내 리포터가 동작 실행을 확인했거나, 캡처된 헤더에서 수정이 보입니다.',
  'panel.network.fireRail.inferredDesc': '추정. 규칙은 일치했지만 이 요청에서는 적용을 검증할 수 없습니다.',
  'panel.network.fireRail.contradictedDesc': '모순. 규칙이 주장한 헤더 변경을 캡처된 헤더가 반증합니다.',
  'panel.network.annotationRail.summary':
    '열이 보여 주는 것 이상으로 OpenHeaders 패널이 아는 정보를 표시합니다. 글리프에 마우스를 올리면 설명이, 클릭하면 상세가 열립니다.',
  'panel.network.annotationRail.glyphsHeading': '글리프',
  'panel.network.annotationRail.warnDesc': '이 행은 보이는 것과 다릅니다. 예: 다운로드 도중 중단된 전송.',
  'panel.network.annotationRail.infoDesc': '출처나 정확도 맥락입니다. 끝나지 않음, 캡처 공백, 합성 행.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  // Raw by design: the eight rung names (Queueing / Stalled / DNS Lookup
  // / TCP / TLS / Request sent / Waiting for server / Content Download —
  // browser Timing-tab parity), the terminal outcome labels mirroring
  // the Status cell ((canceled), (blocked:…), CORS error, (failed)
  // net::ERR_…), the Connection Start section name, and every µs/ms/s
  // figure. The OH-invented band names, absent-step reasons, key-moment
  // narrative, and footnote sentences key.
  'panel.network.timing.band.beforeWire': '스케줄링',
  'panel.network.timing.band.connecting': '연결',
  'panel.network.timing.band.exchange': '전송',
  'panel.network.timing.where.beforeWire': '(브라우저)',
  'panel.network.timing.where.connecting': '(브라우저 ↔ 네트워크)',
  'panel.network.timing.where.exchange': '(네트워크)',
  'panel.network.timing.absent.reused': '연결 재사용',
  'panel.network.timing.absent.notReached': '도달하지 않음',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': '데이터 없음',
  'panel.network.timing.warmSocketTitle':
    '이 요청의 시계에는 TCP 핸드셰이크가 없습니다. 소켓이 이미 열려 있었습니다 (사전 연결일 가능성이 큼). 여기서는 TLS 핸드셰이크만 실행되었습니다.',
  'panel.network.timing.warmSocketHint': '준비된 소켓',
  'panel.network.timing.moment.queued': '대기열 진입',
  'panel.network.timing.moment.started': '시작',
  'panel.network.timing.moment.response': '응답',
  'panel.network.timing.moment.ended': '종료',
  'panel.network.timing.momentWhy.queued': '요청 생성',
  'panel.network.timing.momentWhy.started': '대기열 이탈',
  'panel.network.timing.momentWhy.response': '첫 바이트 (TTFB)',
  'panel.network.timing.momentWhy.ended': '마지막 바이트, 완료',
  'panel.network.timing.untrackedGaps': '미추적 간격: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Chrome 기준: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL 막대는 그 안에 그려짐)',
  'panel.network.timing.terminalDetail.noResponse': '응답을 받지 못함',
  'panel.network.timing.terminalDetail.neverReached': '네트워크에 도달하지 못함',
  'panel.network.timing.keyMoments': '주요 시점',
  'panel.network.timing.sinceFirstRequest': '(첫 요청 기준)',
  'panel.network.timing.timingNotes': '타이밍 참고',
  'panel.network.timing.totalTime': '총 시간',
  'panel.network.timing.queuedToEnded': '(대기열 진입 → 종료)',
  'panel.network.timing.connectionOpenedBy': '↳ 연결을 연 요청: {name}',
  'panel.network.timing.notFinishedCaution': '주의: 요청이 아직 끝나지 않았습니다!',
  'panel.network.timing.queuedAt': '대기열 진입 {time}',
  'panel.network.timing.startedAt': '시작 {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': '이 시점에 도달하지 않음',
  'panel.network.timing.onTheWire': '🌐 전송 중',
  'panel.network.timing.cdpExplainer': '실행 중의 전체 연결 내역을 보려면 CDP 기능을 켜고 탐색 전에 새로 고침하세요.',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': '타이밍',
  'panel.network.rungInfo.kickerBrowser': '타이밍 · 브라우저',
  'panel.network.rungInfo.kickerBrowserNetwork': '타이밍 · 브라우저 ↔ 네트워크',
  'panel.network.rungInfo.kickerNetwork': '타이밍 · 네트워크',
  'panel.network.rungInfo.kickerInstant': '타이밍 · 시점',
  'panel.network.rungInfo.kickerOutcome': '타이밍 · 결과',
  'panel.network.rungInfo.stripCaption': '요청 예시. 처음부터 끝까지 {ms} ms',
  'panel.network.rungInfo.stripStop': '표시: 요청이 멈춘 곳. 이후 단계는 실행되지 않았습니다',
  'panel.network.rungInfo.stripMarked': '표시: {ms} ms 시점의 {label}',
  'panel.network.rungInfo.stripGaps': '강조: 미추적 간격 (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': '강조: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary': '시작을 허가받기 전에 요청이 브라우저 안에서 기다린 시간입니다.',
  'panel.network.rungInfo.queueing.description':
    '브라우저는 우선순위가 낮은 리소스의 요청을 미루고, 우선순위가 높은 것을 먼저 불러오며, 디스크 캐시를 확인하는 동안에도 기다리게 합니다. HTTP/1.x 환경에서는 그 호스트로의 소켓이 모두 사용 중일 때도 여기서 기다립니다.',
  'panel.network.rungInfo.stalled.summary':
    '시작은 허가되었지만 네트워크 작업을 시작하기 전에 쓸 수 있는 연결을 기다리고 있습니다.',
  'panel.network.rungInfo.stalled.description':
    '보통 소켓이 비기를 기다리거나 프록시 판단을 기다립니다. 첫 네트워크 단계 (DNS, TCP 또는 전송)가 시작되는 순간 끝납니다.',
  'panel.network.rungInfo.dns.summary': '연결할 호스트 이름을 IP 주소로 확인합니다.',
  'panel.network.rungInfo.dns.description':
    '요청이 이미 열린 연결을 탔으면 “연결 재사용”으로 표시됩니다. 이 요청의 시계에서는 조회가 필요 없었습니다.',
  'panel.network.rungInfo.connect.summary': 'TCP 핸드셰이크만입니다. 서버로의 소켓을 여는 왕복입니다.',
  'panel.network.rungInfo.connect.description':
    'Chrome 브라우저의 Timing 탭은 이것과 TLS 핸드셰이크를 모두 아우르는 “Initial connection” 막대 하나를 그립니다 (SSL 막대는 그 안에 그려짐). 저희는 이를 겹치지 않는 별도 단계로 나눠 모든 밀리초가 정확히 한 번씩 계산되게 합니다. 여기서의 TCP + TLS 합은 Chrome 브라우저의 Initial connection 막대와 같습니다.',
  'panel.network.rungInfo.ssl.summary': 'TLS 핸드셰이크입니다. 키를 협상하고 인증서를 검증해 연결을 암호화합니다.',
  'panel.network.rungInfo.ssl.description':
    'https:// 요청에서만 있습니다 (일반 http:// 요청은 n/a). “연결 재사용”은 이전 요청이 같은 소켓에서 이 비용을 이미 치렀다는 뜻입니다.',
  'panel.network.rungInfo.send.summary': '요청 바이트 (헤더와 본문)를 전송선에 밀어 넣습니다.',
  'panel.network.rungInfo.send.description':
    '헤더만 있는 요청은 보통 1밀리초에 한참 못 미칩니다. 큰 업로드에서는 늘어납니다.',
  'panel.network.rungInfo.wait.summary':
    '마지막 요청 바이트 전송부터 첫 응답 바이트 수신까지입니다 (첫 바이트까지의 시간).',
  'panel.network.rungInfo.wait.description':
    '서버 처리 시간에 네트워크 왕복 한 번을 더한 것입니다. 백엔드 작업이 드러나는 단계입니다.',
  'panel.network.rungInfo.receive.summary': '응답 본문 다운로드입니다. 첫 바이트부터 마지막 바이트까지입니다.',
  'panel.network.rungInfo.receive.description':
    '응답이 아직 스트리밍 중이면 라이브로 늘어납니다. 차트 아래의 주의 줄은 끝나지 않은 다운로드를 표시합니다.',
  'panel.network.rungInfo.notes.summary':
    '단계 사이의 짧은 시간 조각에 대한 장부입니다. 처음부터 끝까지 기록되지만 어느 단계에도 속하지 않습니다.',
  'panel.network.rungInfo.notes.description':
    '각 단계는 자체 시작과 종료 시점 사이에서 측정되고 총계는 처음부터 끝까지 측정됩니다. 그래서 두 단계 사이에 작은 “미추적 간격”이 놓일 수 있습니다 (예: DNS 응답 도착과 TCP 핸드셰이크 시작 사이). 단계의 합이 총계와 항상 같지는 않은 이유입니다. Chrome 브라우저의 Timing 탭에도 같은 간격이 있지만 그리지 않을 뿐입니다. 저희는 모든 밀리초의 출처가 남도록 이를 나열합니다.',
  'panel.network.rungInfo.notes.linesHeading': '각 줄',
  'panel.network.rungInfo.notes.gapsLabel': '미추적 간격',
  'panel.network.rungInfo.notes.gapsDesc': '각 간격을 앞뒤 단계로 이름 붙이고 소요 시간을 덧붙입니다.',
  'panel.network.rungInfo.notes.chromeLabel': 'Chrome 기준',
  'panel.network.rungInfo.notes.chromeDesc':
    '저희가 나눈 TCP + TLS 단계가 Chrome 브라우저의 단일 “Initial connection” 막대에 어떻게 대응하는지입니다 (SSL 막대는 그 막대 뒤가 아니라 안에 그려집니다).',
  'panel.network.rungInfo.band.beforeWire.summary':
    '네트워크 작업 전에 전적으로 브라우저 안에서 보낸 시간입니다. 아직 아무것도 기기를 떠나지 않았습니다.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (시작 허가 대기)과 Stalled (쓸 수 있는 연결 대기)입니다. 여기서 무거운 요청은 우선순위, 연결 수 제한, 프록시 판단 같은 로컬 요인에 붙들려 있습니다. 서버 탓이 아닙니다.',
  'panel.network.rungInfo.band.connecting.summary':
    '서버로 가는 경로를 준비합니다. 이름을 확인하고, 소켓을 열고, 암호화합니다.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS 단계입니다. 핸드셰이크 왕복입니다. 연결당 한 번만 치릅니다. 이미 열린 소켓을 타는 요청은 이 대역 전체를 건너뜁니다 (“연결 재사용”).',
  'panel.network.rungInfo.band.exchange.summary':
    '전송선 위의 실제 교환입니다. 요청을 보내고, 서버를 기다리고, 응답을 다운로드합니다.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download 단계입니다. 서버 쪽 지연은 Waiting for server 단계에, 큰 응답이나 느린 회선은 Content Download 단계에 드러납니다.',
  'panel.network.rungInfo.moment.queued.summary':
    '브라우저가 요청을 만든 시점입니다. 이 내역의 모든 단계가 측정을 시작하는 0점입니다.',
  'panel.network.rungInfo.moment.queued.description':
    '시각 값은 보이는 첫 요청 기준 오프셋이므로 행들을 하나의 공유 시계로 비교할 수 있습니다.',
  'panel.network.rungInfo.moment.started.summary': '요청이 대기열을 떠나 실제 작업이 시작된 시점입니다.',
  'panel.network.rungInfo.moment.started.description':
    '대기열 진입 + Queueing 단계입니다. 이 표시 전은 모두 브라우저 스케줄링이고, 후는 요청이 실제로 진행되는 시간입니다.',
  'panel.network.rungInfo.moment.response.summary': '첫 응답 바이트가 도착한 시점입니다 (첫 바이트까지의 시간).',
  'panel.network.rungInfo.moment.response.description':
    '서버가 응답했습니다. 여기서부터 본문을 다운로드합니다. 응답이 전혀 도착하지 않았으면 (먼저 차단되거나 실패) 없습니다.',
  'panel.network.rungInfo.moment.ended.summary': '마지막 응답 바이트가 도착한 시점입니다. 요청이 완료되었습니다.',
  'panel.network.rungInfo.moment.ended.description':
    '종료 − 대기열 진입은 내역 아래에 표시되는 총 시간이고, 종료 − 시작은 Time 열에 표시되는 실제 소요 시간입니다.',
  'panel.network.rungInfo.keyMoments.summary': '요청 수명의 경계 시점입니다. 한 단계가 다음 단계로 넘어가는 곳입니다.',
  'panel.network.rungInfo.keyMoments.description':
    '대기열 진입과 시작은 항상 있습니다. 응답과 종료는 실제로 응답이 도착했을 때만 있습니다 (먼저 차단되거나 실패한 요청은 대신 결과 표시를 보여 줍니다). 아래 단계들은 이 시점들 사이의 구간입니다.',
  'panel.network.rungInfo.terminal.whereHeading': '멈춘 곳',
  'panel.network.rungInfo.terminal.noResponseDesc': '네트워크에는 도달했지만 답이 돌아오지 않았습니다.',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    '브라우저 쪽 스케줄링에서 끝났습니다. 아무것도 전송되지 않았습니다.',
  'panel.network.rungInfo.terminal.canceled.summary':
    '요청이 끝나기 전에 중단되었습니다. ✗ 표시가 멈춘 곳이며 이후 단계는 실행되지 않았습니다.',
  'panel.network.rungInfo.terminal.canceled.description':
    '흔한 원인: 로드 도중 페이지가 다른 곳으로 이동, 스크립트가 fetch 호출을 중단, 사용자가 로드를 중지. 네트워크에는 문제가 없었습니다. 브라우저가 답을 기다리기를 그만두었을 뿐입니다.',
  'panel.network.rungInfo.terminal.blocked.summary':
    '브라우저가 정책상의 이유로 요청을 거부했습니다. 콜론 뒤의 단어가 어느 정책인지 알려 줍니다.',
  'panel.network.rungInfo.terminal.stoppedHere': '✗ 표시가 멈춘 곳입니다. 이후 단계는 실행되지 않았습니다.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': '흔한 이유',
  'panel.network.rungInfo.terminal.blocked.cspDesc': '페이지의 Content-Security-Policy 정책이 이 대상을 금지합니다.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc':
    'https:// 페이지 위의 안전하지 않은 http:// 리소스입니다.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    '확장 프로그램, 광고 차단기 또는 브라우저 내부 규칙이 거부했습니다.',
  'panel.network.rungInfo.terminal.cors.summary':
    '교차 출처 검사가 응답을 거부했습니다. 서버는 답했지만 페이지에는 읽기가 허용되지 않았습니다.',
  'panel.network.rungInfo.terminal.cors.description':
    '교차 출처 페이지가 응답을 읽으려면 서버가 Access-Control-Allow-Origin 헤더 (및 관련 헤더)로 허용해야 합니다. ✗ 표시가 거부가 일어난 곳입니다.',
  'panel.network.rungInfo.terminal.failed.summary':
    '전송 수준 실패입니다. 연결 자체가 끊겼고 net:: 코드가 정확한 원인을 알려 줍니다.',
  'panel.network.rungInfo.terminal.failed.codesHeading': '흔한 코드',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS 조회가 호스트를 찾지 못했습니다.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc': '서버가 소켓을 거부하거나 끊었습니다.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': '네트워크 스택의 제한 시간 안에 답이 없었습니다.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'TLS 인증서가 검증에 실패했습니다.',

  // ── OH row annotations — one classifier, one copy family (traffic
  // rail glyph popover + Headers-tab insight cards). The rail is a hot
  // row loop: copy resolves once per locale via
  // `buildRowAnnotationMessages(t)` threaded through the stable cell
  // context — never `t()` in the row body. The popover kicker is the
  // raw brand mark. ───────────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': '이 행의 다른 주석',
  'panel.rowAnnotations.openDetails': '상세 열기',
  'panel.rowAnnotations.interrupted.label': '전송 중단됨',
  'panel.rowAnnotations.interrupted.detail':
    '다운로드가 끝나기 전에 취소되었습니다. 상태는 중단 전에 도착한 헤더를 반영하며 받은 데이터는 불완전합니다. 그 밖에는 이 행을 완료된 행과 구분할 수 없습니다.',
  'panel.rowAnnotations.neverFinished.label': '끝나지 않음',
  'panel.rowAnnotations.neverFinished.detail':
    '이 요청을 보낸 페이지가 진행 중에 언로드되어 결과가 전혀 기록되지 않았습니다. Status 열과 Time 열이 “(unknown)”으로 표시되는 이유입니다.',
  'panel.rowAnnotations.fidelityGap.label': '캡처 정확도 공백',
  'panel.rowAnnotations.fidelityGap.detail':
    '끝나지 않은 요청의 전송 바이트와 응답 본문은 기본 캡처 경로에서 보이지 않습니다. CDP 강화 검사는 이를 기록합니다.',
  'panel.rowAnnotations.syntheticHar.label': '합성 행',
  'panel.rowAnnotations.syntheticHar.detail':
    '이 행은 라이브 요청과 결합되지 않은 캡처 레코드에서 재구성되어 일부 열을 채울 수 없습니다.',
  'panel.rowAnnotations.syntheticMemory.label': '합성 행',
  'panel.rowAnnotations.syntheticMemory.detail':
    '이 행은 페이지의 Resource Timing 데이터에서 재구성되었습니다 (메모리 캐시 적중은 네트워크 스택에 도달하지 않음). 그래서 헤더와 쿠키를 볼 수 없습니다.',
  'panel.rowAnnotations.debugPaused.label': '디버그 모드 보류',
  'panel.rowAnnotations.debugPaused.detail':
    '이 행의 시간 중 {ms} ms 동안은 서버나 네트워크를 기다린 것이 아니라 디버그 모드 가로채기에서 멈춰 있던 시간입니다. 디버그 모드가 검사하는 동안 요청을 붙들었기 때문에 이 행의 총 시간이 요청 자체가 걸린 시간보다 깁니다.',
  'panel.rowAnnotations.queryParamRewrite.label': '쿼리 매개변수 재작성',
  'panel.rowAnnotations.queryParamRewrite.detail':
    '이 리디렉션은 서버가 아니라 Open Headers 확장 프로그램이 쿼리 매개변수 규칙을 적용한 것입니다. URL 주소의 쿼리 문자열 재작성은 내부 리디렉션으로 수행되므로 별도의 홉으로 표시됩니다. 그런 다음 요청은 메서드, 본문, 쿠키, 헤더를 그대로 가지고 재작성된 URL 주소로 이어집니다.',
  'panel.rowAnnotations.redirectRule.label': '리디렉션 규칙',
  'panel.rowAnnotations.redirectRule.detail':
    '이 리디렉션은 서버가 아니라 Open Headers 확장 프로그램이 리디렉션 규칙을 적용한 것입니다. 내부 리디렉션으로 수행되므로 요청이 재작성된 URL 주소로 이어지기 전에 원래 요청이 별도의 홉으로 표시됩니다.',
  'panel.rowAnnotations.systemProxyJoined.label': '시스템 프록시 결합',
  'panel.rowAnnotations.systemProxyJoined.detail':
    '이 교환은 시스템 프록시 (로컬 프록시)에서도 캡처되었습니다. 그 캡처의 정확한 전송 헤더, 측정된 크기, 소켓 타이밍이 브라우저 캡처에 기록이 없는 부분을 채웁니다.',
  'panel.rowAnnotations.systemProxySeen.label': '브라우저 탭에서도 관찰됨',
  'panel.rowAnnotations.systemProxySeen.detail':
    '이 가로챈 교환은 브라우저 탭 {tab}에서도 관찰되었습니다. 두 행은 같은 요청을 양쪽에서 본 것입니다.',
  'panel.rowAnnotations.systemProxySeen.unknownTab': '감시 중인 탭',
  'panel.rowAnnotations.systemProxySeen.jump': '탭 소스에서 표시',
} as const satisfies Catalog;
