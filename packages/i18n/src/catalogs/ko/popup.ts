/**
 * Popup namespace — Korean. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the ko register contract (`ko/shared.ts`). Mints: 일치한 요청
 * = matched request; 실행 = fire ({count}회 실행 = N fires); evidence
 * chips 가려짐 = shadowed (가림 감지 = shadow detection) / 확인됨 =
 * confirmed / 간접 = fallback / 무음 = silent / 일치 = matched; delivery
 * chips: live raw / 캐시 / raw sw; 전달 = delivery (column); 증거 =
 * evidence; 투어 가이드 = tour guide; 배지 = badge; 중재 = arbitration;
 * 관련 도메인 = related domain; 데스크톱 = Desktop tag; 빈 규칙 = blank
 * rule; 오버플로 메뉴 = overflow menu; exclude chip prefix = 제외;
 * 발신자 = initiator (condition label). Rule-type option labels
 * translate (product vocabulary); resource-type parity labels stay
 * literal in the components. Chip sandwiches keep a structural `—`
 * after a label chip (the hint fragments). Browser-menu mocks quote
 * the browsers' own ko UI (Chrome 보기 → 개발자 → 개발자 도구, Safari
 * 설정 → 고급 → 웹 개발자용 기능 보기); the status-popover subsystem
 * names (Sync, Rules, …) ride verbatim raw. The desktop-watch tooltip
 * quotes the settings row “데스크톱 앱이 이 브라우저를 보도록 허용” — the
 * ko settings file quotes THIS value verbatim when it lands.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': '보기를 전환할 수 없습니다',
  'popup.header.switchToSidePanel': '사이드 패널로 전환 (탐색하는 동안 열려 있음)',
  'popup.header.switchToPopup': '팝업 모드로 전환 (도구 모음 클릭)',
  'popup.header.rulesResumed': '규칙 실행이 재개되었습니다',
  'popup.header.rulesPaused': '규칙 실행이 일시 중지되었습니다',
  'popup.header.rulesLabel': '규칙',
  'popup.header.resumeRules': '규칙 실행 재개',
  'popup.header.pauseRules': '모든 규칙 일시 중지 (개별 규칙 설정은 유지됨)',
  'popup.header.openSettings': '설정 열기',
  'popup.header.notifications': '알림',
  'popup.header.openNotifications': '알림 열기',
  'popup.header.activeWorkspace': '활성 워크스페이스: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': '활성',
  'popup.status.paused': '일시 중지됨',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': '강력한 브라우저 개발자 도구를 여는 방법입니다.',
  'popup.footer.networkDebug': '네트워크 디버그.',
  'popup.footer.tagline': '있어야 할 모습 그대로',
  'popup.footer.keyboardShortcuts': '키보드 단축키',
  'popup.footer.systemStatus': '시스템',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': '데스크톱에서 보는 중',
  'popup.desktopWatch.tooltip':
    'Open Headers 데스크톱 앱이 현재 트래픽 패널에서 이 브라우저를 보고 있습니다. 클릭하면 설정이 열립니다. “데스크톱 앱이 이 브라우저를 보도록 허용”이 끄기 스위치입니다.',
  'popup.desktopWatch.aria': '데스크톱 앱이 이 브라우저를 보고 있습니다. 설정 열기',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': '이 페이지',
  'popup.tabs.allRules': '모든 규칙',
  'popup.tabs.collections': '컬렉션',
  'popup.tabs.openWorkspaceEditor': '전체 워크스페이스 편집기 열기',
  'popup.tabs.workspace': '워크스페이스',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': '“{name}” 항목을 삭제할까요?',
  'popup.deleteConfirm.confirm': '확인',
  'popup.deleteConfirm.cancel': '취소',

  // ── Table toolbars ─────────────────────────────────────────────────
  'popup.table.searchPlaceholder': '검색...',
  'popup.table.sortOrder': '정렬 순서',
  'popup.table.sortOrderHeading': '정렬 순서',
  'popup.table.sortByStatus': '상태순',
  'popup.table.sortByPriority': '우선순위순',
  'popup.table.sortByColumn': '열 기준',
  'popup.table.sortWorkspaceOrder': '워크스페이스 순서',
  'popup.table.sortWorkspaceOrderHint': '워크스페이스 사이드바 트리 순서와 같습니다',
  'popup.table.sortByColumnHint': '{column} 기준으로 정렬됨. 초기화하려면 위 옵션을 클릭하세요',
  'popup.table.sortByPriorityHint': '차단 → 리디렉션 → 쿼리 → 헤더 → 삽입 · 각 그룹 안은 A-Z',
  'popup.table.sortByStatusHintAll': '활성 → 일시 중지됨 → 비활성 → 초안 · 각 그룹 안은 우선순위순',
  'popup.table.sortByStatusHintThisPage': '활성 → 일시 중지됨 → 비활성 · 각 그룹 안은 우선순위순',
  'popup.table.sortByStatusHintCollections': '활성 → 일시 중지됨 · 각 그룹 안은 A-Z',
  'popup.table.columnName': '이름',
  'popup.table.columnDetails': '세부 정보',
  'popup.table.columnConditions': '조건',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': '규칙을 전환하지 못했습니다',
  'popup.rule.deleted': '규칙 삭제됨',
  'popup.rule.deleteFailed': '규칙을 삭제하지 못했습니다',
  'popup.rule.edit': '규칙 편집',
  'popup.rule.delete': '규칙 삭제',
  'popup.rule.deleteOk': '삭제',
  'popup.rule.notConnected': '앱이 연결되지 않음',
  'popup.rule.desktopTag': '데스크톱',
  'popup.rule.comingSoon': '곧 지원',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': '규칙',
  'popup.rules.activeSummary': '{total}개 중 {active}개 활성',
  'popup.rules.draftSuffix': ', 초안 {count}개',
  'popup.rules.pausedByCollection': '컬렉션에 의해 {count}개 일시 중지됨',
  'popup.rules.addRule': '규칙 추가',
  'popup.rules.addRuleTooltip': '규칙 추가: 유형과 템플릿을 검색합니다',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '규칙 {count}개' })} 중 ${matched}개 일치`,
  'popup.rules.emptyNoMatch': '일치하는 규칙이 없습니다',
  'popup.rules.emptyNone': '아직 규칙이 없습니다',
  'popup.rules.emptyHint': '“규칙 추가”를 클릭해 실시간 브라우저 요청을 수정하세요',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': '컬렉션',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { other: '컬렉션 {count}개' })}, ${plural(locale, Number(rules), {
      other: '규칙 {count}개',
    })}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '컬렉션 {count}개' })} 중 ${matched}개 일치`,
  'popup.collections.emptyNoMatch': '일치하는 컬렉션이 없습니다',
  'popup.collections.emptyNone': '컬렉션 없음',
  'popup.collections.emptyHint': '워크스페이스 편집기에서 규칙을 만들어 컬렉션으로 정리하세요',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${plural(locale, Number(total), { other: '규칙 {count}개' })} 중 ${enabled}개 활성`,
  'popup.collections.pausedEnabledSummary': '일시 중지됨 · {total}개 중 {enabled}개 활성',
  'popup.collections.resumeTooltip': '재개: 규칙 {count}개를 활성으로 고정 (필요하면 상위 항목을 재정의)',
  'popup.collections.pauseTooltip': '일시 중지: 개별 설정을 바꾸지 않고 규칙 {count}개를 중단',

  // ── Condition vocabulary ───────────────────────────────────────────
  'popup.conditions.allDomains': '모든 도메인',
  'popup.conditions.none': '조건 없음',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': '정규식',
  'popup.conditions.short.requestDomains': '도메인',
  'popup.conditions.short.excludeRequestDomains': '제외 도메인',
  'popup.conditions.short.initiatorDomains': '발신자',
  'popup.conditions.short.excludeInitiatorDomains': '제외 발신자',
  'popup.conditions.short.requestMethods': '메서드',
  'popup.conditions.short.excludeRequestMethods': '제외 메서드',
  'popup.conditions.short.resourceTypes': '리소스',
  'popup.conditions.short.excludeResourceTypes': '제외 리소스',
  'popup.conditions.short.domainType': '도메인 유형',
  'popup.conditions.short.responseHeader': '응답 헤더',
  'popup.conditions.short.excludeResponseHeader': '제외 응답 헤더',
  'popup.conditions.full.urlFilter': 'URL 패턴',
  'popup.conditions.full.urlRegex': 'URL 정규식',
  'popup.conditions.full.requestDomains': '도메인',
  'popup.conditions.full.excludeRequestDomains': '제외 도메인',
  'popup.conditions.full.initiatorDomains': '발신자',
  'popup.conditions.full.excludeInitiatorDomains': '제외 발신자',
  'popup.conditions.full.requestMethods': '메서드',
  'popup.conditions.full.excludeRequestMethods': '제외 메서드',
  'popup.conditions.full.resourceTypes': '리소스',
  'popup.conditions.full.excludeResourceTypes': '제외 리소스',
  'popup.conditions.full.domainType': '도메인 유형',
  'popup.conditions.full.responseHeader': '응답 헤더',
  'popup.conditions.full.excludeResponseHeader': '제외 응답 헤더',

  // ── Action-detail vocabulary ───────────────────────────────────────
  'popup.actionDetail.name': '이름',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': '개수',
  'popup.actionDetail.type': '유형',
  'popup.actionDetail.duration': '지속 시간',
  'popup.actionDetail.format': '형식',
  'popup.actionDetail.status': '상태',
  'popup.actionDetail.value': '값',
  'popup.actionDetail.position': '위치',
  'popup.actionDetail.body': '본문',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': '레이블',
  'popup.actionDetail.headers': '헤더',
  'popup.actionDetail.params': '매개변수',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': '현재 탭 정보를 불러오는 중...',
  'popup.thisPage.noTab': '현재 탭 정보를 가져올 수 없습니다',
  'popup.thisPage.columnMatch': '일치',
  'popup.thisPage.expandHeaderBadgeHint': '각 행의 배지를 클릭하면 일치한 요청이 표시됩니다',
  'popup.thisPage.expandHeaderDocsHint': '아래 아이콘을 클릭하면 문서가 표시됩니다',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${plural(locale, Number(total), { other: '요청 {count}개' })} 중 ${matched}개가 "${query}" 검색과 일치. 클릭하여 펼치기`,
  'popup.thisPage.badgeNone': '아직 일치한 요청 없음. 클릭하여 펼치기',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '일치한 요청 {count}개' })}, 모두 캐시에서 제공됨 (무음). 클릭하여 펼치기`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { other: '일치한 요청 {count}개' })} 실행됨 + 무음 ${silent}개 (캐시됨). 클릭하여 펼치기`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '일치한 요청 {count}개' })}. 클릭하여 펼치기`,
  'popup.thisPage.systemPage': '시스템 페이지',
  'popup.thisPage.systemPageHint': '헤더 규칙은 브라우저 시스템 페이지에 적용되지 않습니다',
  'popup.thisPage.emptyNoRules': '이 페이지와 일치하는 규칙이 없습니다',
  'popup.thisPage.emptyNoRulesHint': '이 도메인에 구성된 규칙이 없습니다',
  'popup.thisPage.ruleDisabled': '규칙이 비활성 상태입니다',
  'popup.thisPage.rulePausedByGroup': '규칙이 컬렉션 또는 폴더에 의해 일시 중지되었습니다',
  'popup.thisPage.zeroRelated':
    '규칙이 관련 도메인을 대상으로 합니다. 해당 도메인으로의 요청이 아직 관찰되지 않았습니다. 페이지가 요청을 보내면 실행됩니다.',
  'popup.thisPage.zeroPage':
    '패턴이 이 페이지와 일치하지만 일치하는 요청이 아직 관찰되지 않았습니다. 페이지와 상호작용하거나 새로 고침해 요청을 발생시키세요.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '일치한 요청 {count}개 모두' }),
  'popup.thisPage.shadowSomePrefix': '일치한 요청 {total}개 중 {shadowed}개',
  'popup.thisPage.shadowTooltip':
    '{prefix}: 우선순위가 높은 차단 규칙 “{name}”에 의해 종료되었으므로 이 규칙은 해당 요청에 눈에 띄는 효과가 없습니다. 실험적 기능: 가림 감지는 과다 또는 과소 보고될 수 있습니다. 숨기려면 설정에서 비활성화하세요.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `이 페이지에서 스크립트가 ${plural(locale, Number(count), { other: '{count}회 실행' })}을 확인했습니다 (페이지 내 삽입에서 얻은 실측 정보).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `URL 기준으로 ${plural(locale, Number(count), { other: '요청 {count}개' })}가 일치했지만 페이지 내 스크립트 리포터가 확인하지 못했습니다. 일반적인 원인: 삽입을 차단하는 엄격한 Content-Security-Policy, 또는 fetch/XHR 가로채기를 우회하는 리소스 유형(스타일시트, 이미지, 매니페스트 링크).`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `패턴이 ${plural(locale, Number(count), { other: '캐시된 하위 리소스 {count}개' })}와 일치했지만 응답이 네트워크를 거치지 않아 동작을 실행할 수 없었습니다. 캐시를 우회해 새로 고침하면 새 요청이 강제됩니다.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `이 페이지에서 ${plural(locale, Number(count), { other: '요청 {count}개' })}가 일치했습니다. Chrome 브라우저의 declarativeNetRequest 엔진은 여러 규칙이 일치할 때 어느 규칙이 이기는지 보고하지 않습니다. 저희는 중재 결과가 아니라 URL 일치를 관찰합니다.`,
  'popup.thisPage.pausedTagTooltip': '컬렉션 또는 폴더가 일시 중지됨. 규칙이 적용되지 않습니다',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `컬렉션에 의해 ${plural(locale, Number(count), { other: '규칙 {count}개' })} 일시 중지됨`,
  'popup.thisPage.firing': '{count}개 실행 중',
  'popup.thisPage.silentCached': '무음 {count}개 (캐시됨)',
  'popup.thisPage.related': '관련 {count}개',
  'popup.thisPage.liveMonitoring': '라이브: 요청 모니터링 중',
  'popup.thisPage.visibleResourceTypes': '표시 중인 리소스 유형',
  'popup.thisPage.showAll': '모두 표시',
  'popup.thisPage.filterResourceTypes': '리소스 유형 필터',
  'popup.thisPage.filterResourceTypesCount': '리소스 유형 필터 ({total}개 중 {shown}개 표시)',
  'popup.thisPage.requestCount': ({ count }, locale) => plural(locale, Number(count), { other: '요청 {count}개' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), { other: '무음 요청 {count}개 (캐시됨)' }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { other: '요청 {count}개' })} (무음 ${silent}개)`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '규칙 {count}개' })} 중 ${matched}개`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${plural(locale, Number(total), { other: '요청 {count}개' })} 중 ${matched}개`,
  'popup.thisPage.matchedJoin': '{parts} 일치',
  'popup.thisPage.copyTsv': '요청을 TSV 형식으로 복사',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': '시간',
  'popup.matched.columnUrl': '요청 URL',
  'popup.matched.columnType': '유형',
  'popup.matched.columnDelivery': '전달',
  'popup.matched.columnEvidence': '증거',
  'popup.matched.columnPattern': '패턴',
  'popup.matched.matchedBy': '일치 기준',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': '캐시',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip': '이 세션에서 요청이 네트워크로 나갔습니다. 응답이 캐시에서 제공되지 않았습니다.',
  'popup.matched.deliveryCachedTip':
    '응답이 Chrome 브라우저의 HTTP 캐시에서 제공되었습니다. 규칙은 이 응답을 처음 가져왔을 때 또는 재검증 왕복 시에 적용되었습니다.',
  'popup.matched.deliverySwTip':
    '서비스 워커가 요청을 가로챘습니다. 규칙 적용 여부는 서비스 워커가 그다음에 무엇을 했는지에 따라 다릅니다.',
  'popup.matched.evidenceShadowed': '가려짐',
  'popup.matched.evidenceShadowedTip':
    '이 요청은 “{name}” 규칙(우선순위가 높은 차단 규칙)에 의해 종료되었습니다. 이 규칙은 해당 요청에서 실행된 적이 없습니다.',
  'popup.matched.evidenceConfirmed': '확인됨',
  'popup.matched.evidenceConfirmedTip':
    '페이지 내 삽입에서 스크립트가 이 실행을 확인했습니다. 규칙이 실행되었다는 실측 정보입니다.',
  'popup.matched.evidenceFallback': '간접',
  'popup.matched.evidenceFallbackTip':
    'URL 기준으로 일치했지만 페이지 내 스크립트 리포터가 확인하지 못했습니다. 일반적인 원인: MAIN 월드 삽입을 차단하는 엄격한 Content-Security-Policy, 또는 fetch/XHR 가로채기를 우회하는 리소스 유형(스타일시트, 이미지, 매니페스트 링크).',
  'popup.matched.evidenceSilent': '무음',
  'popup.matched.evidenceSilentTip':
    '패턴이 이 하위 리소스와 일치했지만 응답이 캐시, 서비스 워커 또는 bfcache 저장소에서 제공되어 규칙의 동작을 실행할 수 없었습니다. 캐시를 우회해 새로 고침하면 새 요청이 강제됩니다.',
  'popup.matched.evidenceMatched': '일치',
  'popup.matched.evidenceMatchedTip':
    'URL 기준으로 이 규칙의 조건과 일치했습니다. Chrome 브라우저의 declarativeNetRequest 엔진은 중재에서 어느 규칙이 이기는지 보고하지 않습니다. 저희는 실행이 아니라 URL 일치를 관찰합니다.',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${plural(locale, Number(total), { other: '요청 {count}개' })} 중 ${matched}개가 "${query}" 검색과 일치`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { other: '요청 {count}개' })} 일치`,
  'popup.matched.emptySearch':
    '"{query}" 검색어를 포함하는 일치 요청이 없습니다. 검색을 지우거나 범위를 넓히면 모든 일치 항목이 표시됩니다.',
  'popup.matched.emptyRelated':
    '규칙이 관련 도메인을 대상으로 합니다. 페이지가 해당 도메인으로 요청을 보내면 일치 항목이 표시됩니다.',
  'popup.matched.emptyPage':
    '패턴이 이 페이지와 일치합니다. 페이지가 패턴에 맞는 요청을 보내면 일치 항목이 표시됩니다. 페이지와 상호작용하거나 새로 고침해 요청을 발생시키세요.',
  'popup.matched.emptyNone': '아직 일치한 요청이 없습니다. 페이지를 새로 고침해 캡처하세요.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': '헤더',
  'popup.ruleType.block': '차단',
  'popup.ruleType.redirect': '리디렉션',
  'popup.ruleType.queryParam': '쿼리 매개변수',
  'popup.ruleType.inject': '삽입',
  'popup.ruleType.requestBody': 'API 요청',
  'popup.ruleType.delay': '지연',
  'popup.ruleType.response': 'API 응답',
  'popup.ruleType.headerDesc': 'HTTP 헤더 수정',
  'popup.ruleType.blockDesc': '요청 차단',
  'popup.ruleType.redirectDesc': '요청 리디렉션',
  'popup.ruleType.queryParamDesc': '쿼리 매개변수 수정',
  'popup.ruleType.injectDesc': '스크립트 또는 CSS 삽입',
  'popup.ruleType.requestBodyDesc': 'API 요청 본문 수정 (fetch/XHR)',
  'popup.ruleType.delayDesc': '응답 지연',
  'popup.ruleType.responseDesc': 'API 응답 모의 처리 또는 수정 (fetch/XHR)',

  // ── Resource-type explanations ─────────────────────────────────────
  'popup.resourceType.mainFrameTip': '페이지 URL 자체와 일치합니다',
  'popup.resourceType.subFrameTip': '이 페이지가 불러온 iframe 프레임에 적용됩니다',
  'popup.resourceType.xhrTip': 'fetch() 및 XMLHttpRequest 호출에 적용됩니다',
  'popup.resourceType.scriptTip': '스크립트 리소스에 적용됩니다',
  'popup.resourceType.stylesheetTip': '스타일시트에 적용됩니다',
  'popup.resourceType.imageTip': '이미지에 적용됩니다',
  'popup.resourceType.fontTip': '글꼴 파일에 적용됩니다',
  'popup.resourceType.mediaTip': '오디오/비디오 리소스에 적용됩니다',
  'popup.resourceType.websocketTip': 'WebSocket 연결에 적용됩니다',
  'popup.resourceType.pingTip': 'ping/beacon 요청에 적용됩니다',
  'popup.resourceType.otherTip': '기타 리소스에 적용됩니다',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': '빈 규칙',
  'popup.palette.searchPlaceholder': '규칙 유형과 템플릿 검색…',
  'popup.palette.noMatches': '"{query}" 검색과 일치하는 항목 없음',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': '키보드 단축키',
  'popup.shortcuts.press': '닫으려면',
  'popup.shortcuts.or': '또는',
  'popup.shortcuts.toClose': '키를 누르세요',
  'popup.shortcuts.groupNavigation': '탐색',
  'popup.shortcuts.groupActions': '작업',
  'popup.shortcuts.groupRow': '표 행',
  'popup.shortcuts.groupBrowser': '브라우저',
  'popup.shortcuts.groupTour': '투어 가이드',
  'popup.shortcuts.openExtension': '확장 프로그램 열기',
  'popup.shortcuts.customize': '확장 프로그램 단축키 사용자 지정 ↗',
  'popup.shortcuts.toggleDebugMode': '디버그 모드 전환',
  'popup.shortcuts.tabThisPage': '이 페이지 탭',
  'popup.shortcuts.tabAllRules': '모든 규칙 탭',
  'popup.shortcuts.tabCollections': '컬렉션 탭',
  'popup.shortcuts.focusSearch': '검색으로 포커스 이동',
  'popup.shortcuts.prevPage': '이전 페이지',
  'popup.shortcuts.nextPage': '다음 페이지',
  'popup.shortcuts.addRule': '새 규칙 추가',
  'popup.shortcuts.openWorkspace': '워크스페이스 열기',
  'popup.shortcuts.openSettings': '설정 열기',
  'popup.shortcuts.toggleSurface': '팝업 / 사이드 패널 전환',
  'popup.shortcuts.toggleRulesPause': '모든 규칙 일시 중지 / 재개',
  'popup.shortcuts.togglePauseFocused': '컬렉션 또는 폴더 일시 중지 / 재개',
  'popup.shortcuts.toggleOptionsMenu': '옵션 메뉴',
  'popup.shortcuts.cycleTheme': '테마 순환',
  'popup.shortcuts.toggleCompactMode': '간결 모드',
  'popup.shortcuts.toggleShortcutsHelp': '이 패널',
  'popup.shortcuts.moveDown': '아래로 이동',
  'popup.shortcuts.moveUp': '위로 이동',
  'popup.shortcuts.expandRow': '펼치기 / 하위 행으로 들어가기',
  'popup.shortcuts.collapseRow': '접기 / 하위 행에서 나오기',
  'popup.shortcuts.toggleRow': '켜기 / 끄기',
  'popup.shortcuts.editRow': '규칙 편집',
  'popup.shortcuts.copyValue': '값 복사',
  'popup.shortcuts.deleteRow': '삭제 (두 번 누르기)',
  'popup.shortcuts.openTourGuide': '투어 가이드 열기',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': '{total}단계 중 {current}단계',
  'popup.tour.previous': '이전',
  'popup.tour.next': '다음',
  'popup.tour.finish': '완료',
  'popup.tour.welcomeTitle': 'Open Headers 사용을 환영합니다',
  'popup.tour.welcomeSubtitle': 'HTTP 트래픽을 실시간으로 가로채고 수정하세요.',
  'popup.tour.modify': '수정',
  'popup.tour.modifyDesc': '헤더, 쿠키, 인증 토큰, CORS, 페이로드',
  'popup.tour.route': '경로 지정',
  'popup.tour.routeDesc': '요청 리디렉션, 추적기 차단, URL 재작성',
  'popup.tour.debug': '디버그',
  'popup.tour.debugDesc': '실시간 요청 검사, 스크립트 삽입, 응답 재정의',
  'popup.tour.migrateSwitching': '다음 도구에서 전환:',
  'popup.tour.migrateOr': '또는',
  'popup.tour.migrateButton': '다른 도구에서 마이그레이션',
  'popup.tour.tabsTitle': '탭 간 전환',
  'popup.tour.tabsSubtitle': '숫자 키를 누르면 즉시 전환됩니다.',
  'popup.tour.thisPageHint': '— 현재 탭과 일치하는 규칙',
  'popup.tour.allRulesHint': '— 지금까지 만든 모든 규칙',
  'popup.tour.tagsLabel': '태그',
  'popup.tour.tagsHint': '— 그룹을 정리하고 일시 중지',
  'popup.tour.workspaceTitle': '내 워크스페이스',
  'popup.tour.workspaceSubtitle': '전체 편집기가 별도의 탭에서 열립니다.',
  'popup.tour.workspaceRequests': 'API 클라이언트',
  'popup.tour.workspaceRequestsHint': '— API 요청을 만들고, 보내고, 저장',
  'popup.tour.workspaceWorkflows': '워크플로',
  'popup.tour.workspaceWorkflowsHint': '— 요청을 연결해 자동 실행',
  'popup.tour.workspaceEnvs': '환경 및 변수',
  'popup.tour.workspaceEnvsHint': '— 가져오기, 규칙, 팀 동기화까지',
  'popup.tour.navTitle': '규칙 탐색 및 이동',
  'popup.tour.navSubtitle': '키보드 단축키로 행을 이동하세요',
  'popup.tour.keyMove': '이동',
  'popup.tour.keyExpand': '펼치기',
  'popup.tour.keyToggle': '전환',
  'popup.tour.keyEdit': '편집',
  'popup.tour.keyCopy': '복사',
  'popup.tour.keyDelete': '삭제',
  'popup.tour.devtoolsTitle': 'DevTools 창에서 네트워크 디버그',
  'popup.tour.findThePrefix': 'DevTools 창에서',
  'popup.tour.findTheSuffix': '탭을 찾으세요:',
  'popup.tour.devtoolsHint': '설정 방법은 언제든 이 버튼을 클릭하세요.',
  'popup.tour.shortcutsTitle': '모든 키보드 단축키',
  'popup.tour.shortcutsSubtitle': '팝업은 키보드만으로 완전히 탐색할 수 있습니다.',
  'popup.tour.pressLabel': '언제든지',
  'popup.tour.shortcutsHint': '키를 누르면 모든 단축키가 표시됩니다',
  'popup.tour.debugModeTitle': '디버그 모드',
  'popup.tour.debugModeSubtitle': '실시간 브라우저 트래픽을 완전히 제어합니다.',
  'popup.tour.debugModeReqRes': '요청 및 응답',
  'popup.tour.debugModeReqResHint': '— 헤더, 본문, 상태 코드를 실시간으로 재작성',
  'popup.tour.debugModeStreams': 'WebSocket 및 SSE',
  'popup.tour.debugModeStreamsHint': '— 스트리밍 메시지를 검사하고 편집',
  'popup.tour.debugModeScripts': '스크립트 및 저장소',
  'popup.tour.debugModeScriptsHint': '— 스크립트 삽입, 쿠키 및 저장소 검사',
  'popup.tour.statusTitle': '시스템 상태',
  'popup.tour.statusSubtitle':
    '점을 클릭하면 Sync, Rules, Requests, Permissions, Secrets, Live 하위 시스템별 상태 분석이 표시됩니다.',
  'popup.tour.statusGreen': '녹색',
  'popup.tour.statusGreenDesc': '— 모두 정상',
  'popup.tour.statusYellow': '노란색',
  'popup.tour.statusYellowDesc': '— 하위 시스템이 경고를 보고 중',
  'popup.tour.statusRed': '빨간색',
  'popup.tour.statusRedDesc': '— 하위 시스템에 장애 발생',
  'popup.tour.growTitle': '성장을 도와주세요',
  'popup.tour.growSubtitle': '더 많은 개발자에게 다가갈 수 있도록 도와주세요.',
  'popup.tour.starGithub': 'GitHub 저장소에 별 주기',
  'popup.tour.recommend': '친구와 동료에게 추천해 주세요',
  'popup.tour.growHint': '언제든지 종 모양 아이콘 아래에서 찾을 수 있습니다.',

  // ── DevTools feature bullets ───────────────────────────────────────
  'popup.devtools.featureModify': '헤더, 요청 및 응답 수정',
  'popup.devtools.featureTabs': '다중 탭 요청 메타데이터 패널',
  'popup.devtools.featureSearch': '고급 검색 및 필터',
  'popup.devtools.featureDock': '끌어서 놓는 사이드바 패널',
  'popup.devtools.addOverride': '+ 추가/재정의',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': '네트워크 디버그',
  'popup.debug.step1': '브라우저 DevTools 창 열기',
  'popup.debug.step1a': '일반 페이지에서. 예:',
  'popup.debug.notPrefix': '불가:',
  'popup.debug.notSuffix': '또는 새 탭 (확장 프로그램이 거기서는 차단됨).',
  'popup.debug.onPlatform': '{platform}에서',
  'popup.debug.menuHintSafari': '먼저 개발자용 메뉴를 활성화하세요. Safari → 설정 → 고급 → “웹 개발자용 기능 보기”.',
  'popup.debug.clickThePrefix': '클릭:',
  'popup.debug.clickTheSuffix': '탭',
  'popup.debug.overflowPrefix': '마지막 탭입니다.',
  'popup.debug.overflowSuffix': '오버플로 메뉴에 숨겨져 있을 수 있습니다.',
  'popup.debug.step3': '디버깅을 강력하게',
  'popup.debug.menuGlyphAria': '보기 메뉴 열기 → 개발자 → 개발자 도구',
  'popup.debug.tabGlyphAria':
    'Open Headers 탭이 선택된 채로 도킹된 DevTools 창: 사이드바, 네트워크 목록, 다중 탭 분할 창',
  'popup.debug.menuGlyphDeveloper': '개발자',
  'popup.debug.menuGlyphDeveloperTools': '개발자 도구',
} as const satisfies Catalog;
