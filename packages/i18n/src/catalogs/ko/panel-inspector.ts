/**
 * DevTools panel — request inspector shell + detail tabs — Korean.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary, the
 * panel-docs raw-quote precedent, 탭 as head noun), Diff, and wire
 * tokens (HEAD / CONNECT / 204 No Content / Server-Timing). Mints:
 * 발신자 = initiator (prose referent — the tab noun rides raw;
 * carried from the popup condition label); 연쇄 = cascade; 호출 스택 =
 * call stack (스택 추적 stays the fixed stack-trace compound); 프레임
 * here = stack frame (context-partitioned with the WebSocket referent
 * in panel-inspector-streams); 가리기 = redact; 정리 = pretty print
 * (carried from panel-storage's 정리됨); 타이밍 = timing prose;
 * 헤드 오브 라인 차단 = head-of-line blocking; 분할 = split carried
 * from streams; Hex 뷰어 rides the 뷰어 family; Mock rides raw (tag
 * precedent).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  // The select prompt flanks an inline Network-panel glyph, so it keys
  // as prefix + suffix fragments.
  'panel.inspector.detailEmpty.requestGone': '요청을 더 이상 사용할 수 없습니다 (지워졌거나 다른 페이지로 이동함)',
  'panel.inspector.detailEmpty.selectPrefix': '검사하려면',
  'panel.inspector.detailEmpty.selectSuffix': 'Network 패널에서 요청을 선택하세요',
  'panel.inspector.detailEmpty.noSelection': '검사할 캡처된 요청을 선택하세요',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  // Raw by design: method badges, status codes, tab labels (URLs, storage
  // keys, cookie/cache identities), the IDB/SS/LS/CS chips, the wire-shaped
  // pill hover title, and the ▾ / ▼ / ▶ / × glyphs beside keyed values.
  'panel.inspector.tabBar.closeTab': '탭 닫기',
  'panel.inspector.tabBar.unsavedChanges': '저장하지 않은 변경 사항',
  'panel.inspector.tabBar.searchTabs': '탭 검색',
  'panel.inspector.tabBar.searchPlaceholder': '탭 검색…',
  'panel.inspector.tabBar.noOpenTabs': '열린 탭이 없습니다',
  'panel.inspector.tabBar.noOpenTabsMatch': '검색과 일치하는 열린 탭이 없습니다',
  'panel.inspector.tabBar.noClosedTabsMatch': '검색과 일치하는 닫은 탭이 없습니다',
  'panel.inspector.tabBar.recentlyClosed': '최근 닫은 탭 ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': '최근 닫은 탭 ({total}개 중 {matched}개)',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': '변경 사항을 저장하시겠습니까?',
  'panel.inspector.tabBar.closeGuard.unsavedBody':
    '탭에 저장하지 않은 변경 사항이 있습니다. 작업을 잃지 않으려면 이 변경 사항을 저장하세요.',
  'panel.inspector.tabBar.closeGuard.dontSave': '저장 안 함',
  'panel.inspector.tabBar.closeGuard.cancel': '취소',
  'panel.inspector.tabBar.closeGuard.save': '변경 사항 저장',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': '닫기',
  'panel.inspector.tabMenu.closeOther': '다른 탭 닫기',
  'panel.inspector.tabMenu.closeAll': '모든 탭 닫기',
  'panel.inspector.tabMenu.closeToLeft': '왼쪽 탭 닫기',
  'panel.inspector.tabMenu.closeToRight': '오른쪽 탭 닫기',
  'panel.inspector.tabMenu.splitAndMove': '분할하여 이동',
  'panel.inspector.tabMenu.right': '오른쪽',
  'panel.inspector.tabMenu.left': '왼쪽',
  'panel.inspector.tabMenu.down': '아래',
  'panel.inspector.tabMenu.up': '위',
  'panel.inspector.tabMenu.moveToOppositeGroup': '반대쪽 그룹으로 이동',
  'panel.inspector.tabMenu.changeSplitterOrientation': '분할 방향 변경',
  'panel.inspector.tabMenu.unsplit': '분할 해제',
  'panel.inspector.tabMenu.unsplitAll': '모든 분할 해제',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns; ride raw in ko per the panel-docs
  // raw-quote precedent and the zh-CN / ja siblings).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': '재정의 편집',
  'panel.inspector.overrideCta.editOverrideTitle':
    '이 응답을 만든 규칙을 편집합니다. 변경 사항은 이후 요청에 적용됩니다',
  'panel.inspector.overrideCta.overrideResponse': '응답 재정의',
  'panel.inspector.overrideCta.overrideResponseTitle': '이 응답을 편집 가능한 Mock 응답으로 제공하는 규칙을 만듭니다',
  'panel.inspector.overrideCta.editQueryParams': '쿼리 매개변수 재정의 편집',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    '이 쿼리 매개변수를 재작성한 규칙을 편집합니다. 변경 사항은 이후 요청에 적용됩니다',
  'panel.inspector.overrideCta.overrideQueryParams': '쿼리 매개변수 재정의',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': '이 쿼리 매개변수를 재작성하는 규칙을 만듭니다',
  'panel.inspector.overrideCta.editRequestBody': '요청 본문 재정의 편집',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    '이 요청 본문을 교체한 규칙을 편집합니다. 변경 사항은 이후 요청에 적용됩니다',
  'panel.inspector.overrideCta.overrideRequestBody': '요청 본문 재정의',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    '이 요청 본문을 편집 가능한 정적 본문으로 교체하는 규칙을 만듭니다',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': '전체 응답',
  'panel.inspector.dualView.fullRequest': '전체 요청',
  'panel.inspector.dualView.swapSides': '좌우 바꾸기',
  'panel.inspector.dualView.hideUnchanged': '변경 없는 항목 숨기기',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': '원본 · 서버 → 페이지',
  'panel.inspector.paneCaption.responseModified': '수정됨 · 서버 → Open Headers → 페이지',
  'panel.inspector.paneCaption.requestOriginal': '원본 · 페이지 → 서버',
  'panel.inspector.paneCaption.requestModified': '수정됨 · 페이지 → Open Headers → 서버',
  'panel.inspector.paneCaption.wsRecvDropped': '폐기됨 · 페이지에 도달하지 않음',
  'panel.inspector.paneCaption.wsSendDropped': '폐기됨 · 서버에 도달하지 않음',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': '응답 본문 없음',
  'panel.inspector.bodyState.noPreviewTitle': '미리보기를 사용할 수 없습니다',
  'panel.inspector.bodyState.nothingToPreviewTitle': '미리 볼 내용이 없습니다',
  'panel.inspector.bodyState.noResponseDetail': '이 요청에는 사용할 수 있는 응답 데이터가 없습니다',
  'panel.inspector.bodyState.failedTitle': '응답 데이터를 불러오지 못했습니다',
  'panel.inspector.bodyState.emptyTitle': '(빈 응답 본문)',
  'panel.inspector.bodyState.emptyDetail': '서버가 빈 본문을 반환했습니다.',
  'panel.inspector.bodyState.binaryPayloadBytes': '바이너리 페이로드 ({count}바이트).',
  'panel.inspector.bodyState.notApplicable.preflight': '프리플라이트 요청에는 사용할 수 있는 콘텐츠가 없습니다',
  'panel.inspector.bodyState.notApplicable.head': 'HEAD 요청에는 응답 본문이 없습니다',
  'panel.inspector.bodyState.notApplicable.connect': 'CONNECT 요청에는 응답 본문이 없습니다',
  'panel.inspector.bodyState.notApplicable.status204': '콘텐츠 없음 (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': '콘텐츠 없음 (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': '수정되지 않음. 본문은 브라우저 캐시에서 제공되었습니다',
  'panel.inspector.bodyState.notApplicable.informational': '콘텐츠 없음 (정보 응답)',
  'panel.inspector.bodyState.notApplicable.websocket': 'WebSocket 연결로 업그레이드되었습니다. Messages 탭을 보세요',
  'panel.inspector.bodyState.unavailable.opaque': '응답 본문을 사용할 수 없습니다. 불투명한 교차 출처 응답입니다',
  'panel.inspector.bodyState.unavailable.cache':
    '본문을 사용할 수 없습니다. DevTools 창을 열기 전에 응답이 캐시에서 제공되었습니다',
  'panel.inspector.bodyState.unavailable.redirect': '이 요청은 리디렉션되어 사용할 수 있는 콘텐츠가 없습니다',
  'panel.inspector.bodyState.unavailable.unknown':
    '본문이 캡처되지 않았습니다. 호스트가 콘텐츠를 반환하지 않았습니다. 응답이 버퍼링 없이 스트리밍되었거나 캐시에서 제공되었습니다.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': '이 콘텐츠 유형은 미리보기를 사용할 수 없습니다.',
  'panel.inspector.preview.imageAlt': '응답 미리보기',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': '정리',
  'panel.inspector.viewer.revertTitle': '선언된 Content-Type 값으로 되돌리기',
  'panel.inspector.viewer.parsedAsRevert': '{format} 형식으로 파싱됨 · 되돌리기',
  'panel.inspector.viewer.looksLikeParse': '{format} 형식으로 보임 · 파싱',
  'panel.inspector.viewer.looksLikeTitle':
    'Content-Type 값이 맞지 않는 것 같습니다. 본문은 {format} 형식으로 파싱됩니다. 클릭하여 다시 해석합니다.',
  'panel.inspector.viewer.cursorInfo': '{line}행, {col}열',
  'panel.inspector.viewer.lineCount': ({ count }, locale) => plural(locale, Number(count), { other: '{count}행' }),
  'panel.inspector.viewer.hexViewer': 'Hex 뷰어',
  'panel.inspector.viewer.find': '찾기',
  'panel.inspector.viewer.findTitle': '찾기 ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': '쿼리 문자열 매개변수',
  'panel.inspector.payload.requestBody': '요청 본문 ({mime})',
  'panel.inspector.payload.viewSource': '소스 보기',
  'panel.inspector.payload.viewParsed': '파싱 결과 보기',
  'panel.inspector.payload.viewUrlEncoded': 'URL 인코딩 형식 보기',

  // ── Raw Data tab (inspector detail) — export-snippet band + raw HAR
  // band. Raw by design: the generated snippet text itself (paste-into-
  // terminal material), HAR / JSON / .har / HAR 1.2 format nouns riding
  // inside keyed values, and the technical tokens inside the format
  // option labels (cURL, bash, fetch, Node, Python requests,
  // Invoke-WebRequest). ────────────────────────────────────────────────
  'panel.inspector.rawData.exportSnippet': '스니펫 내보내기',
  'panel.inspector.rawData.formatLabel': '형식',
  'panel.inspector.rawData.copy': '복사',
  'panel.inspector.rawData.copied': '복사됨',
  'panel.inspector.rawData.rawHar': 'Raw HAR (JSON)',
  'panel.inspector.rawData.downloadHar': '.har 다운로드',
  'panel.inspector.rawData.noRequestData': '(아직 요청 데이터 없음)',
  'panel.inspector.rawData.view.label': '보기',
  'panel.inspector.rawData.view.includeHeaders': '요청 헤더 포함',
  'panel.inspector.rawData.view.includeBody': '요청 본문 포함',
  'panel.inspector.rawData.view.redactSecrets': '시크릿 가리기',
  'panel.inspector.rawData.view.ruleModifiedHeading': '규칙으로 수정된 헤더',
  'panel.inspector.rawData.view.postRule': '규칙 적용 후 (전송된 값)',
  'panel.inspector.rawData.view.original': '원본 (규칙 적용 전)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript: fetch (브라우저)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript: fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python: requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell: Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP: raw 메시지',
  'panel.inspector.rawData.format.har': 'HAR: 단일 항목',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': '형식',
  'panel.inspector.rawData.harInfo.summary': '이식 가능한 HTTP 아카이브입니다. 요청 하나의 JSON 스냅샷입니다.',
  'panel.inspector.rawData.harInfo.description':
    '저장해서 버그 리포트에 첨부하거나, 팀원과 공유하거나, HAR 파일을 읽는 다른 도구로 가져올 수 있습니다.',

  // ── Initiator tab (inspector detail) — call stack, upstream chain,
  // downstream tree, cascade stats + insights. Raw by design: the
  // async-boundary section labels (`await in fn`, `Promise resolved
  // (async)` — JS vocabulary that also feeds the copied stack text),
  // `(anonymous)`, the `@` locator glyph, wire initiator-type values
  // (parser / script / other), filter grammar tokens riding inside the
  // keyed placeholder, the ▼ / ▶ toggles, and byte / ms figures. ──────
  'panel.inspector.initiator.noData': '발신자 데이터가 없습니다.',
  'panel.inspector.initiator.typeLabel': '유형:',
  'panel.inspector.initiator.stack.heading': '요청 호출 스택',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '프레임 {count}개' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count}개 확인됨',
  'panel.inspector.initiator.stack.resolvedTitle': '소스 맵을 통해 함수 이름을 확인했습니다',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), { other: '숨겨진 {count}개 표시' }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), { other: '노이즈 {count}개 숨기기' }),
  'panel.inspector.initiator.stack.noiseTitle': '축소된 번들 안의 익명 프레임 숨기기',
  'panel.inspector.initiator.stack.copyTitle': '스택을 텍스트로 복사',
  'panel.inspector.initiator.stack.copy': '복사',
  'panel.inspector.initiator.stack.copied': '복사됨',
  'panel.inspector.initiator.stack.filterPlaceholder': '프레임 필터 (함수 이름 또는 URL)…',
  'panel.inspector.initiator.stack.filterAria': '호출 스택 프레임 필터',
  'panel.inspector.initiator.stack.noMatch': '일치하는 프레임이 없습니다.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '프레임 {count}개' });
    return `${total} 중 ${String(shown)}개 표시 중`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '({count}개 숨김)',
  'panel.inspector.initiator.stack.sourceMapNameTitle': '소스 맵 이름: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (원본: {source})',
  'panel.inspector.initiator.moreFilters.label': '추가 필터',
  'panel.inspector.initiator.moreFilters.failuresOnly': '실패만',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': '서드 파티만',
  'panel.inspector.initiator.view.label': '보기',
  'panel.inspector.initiator.view.sort': '정렬',
  'panel.inspector.initiator.view.sortInitiator': '발신자 순서',
  'panel.inspector.initiator.view.sortChronological': '시간순',
  'panel.inspector.initiator.view.sortLargest': '가장 큰 하위 트리',
  'panel.inspector.initiator.view.showSuggestions': '제안 표시',
  'panel.inspector.initiator.filterPlaceholder':
    '필터: 텍스트, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': '발신자 체인 필터',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '일치 {count}건' }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': '요청 발신자 체인',
  'panel.inspector.initiator.chainTree': '요청 발신자 체인',
  'panel.inspector.initiator.collapse': '접기',
  'panel.inspector.initiator.expand': '펼치기',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { other: '개 요청' }),
  'panel.inspector.initiator.cascade.transferred': '전송됨',
  'panel.inspector.initiator.cascade.cumulative': '누적',
  'panel.inspector.initiator.cascade.failed': '실패',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': '발신자 유형',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP 상태',
  'panel.inspector.initiator.chip.requestFailedTitle': '요청 실패',
  'panel.inspector.initiator.chip.failed': '실패',
  'panel.inspector.initiator.chip.transferredTitle': '전송량',
  'panel.inspector.initiator.chip.durationTitle': '소요 시간',
  'panel.inspector.initiator.chip.thirdPartyTitle': '서드 파티 출처',
  'panel.inspector.initiator.chip.thirdParty': '서드 파티',
  'panel.inspector.initiator.chip.subtreeTitle': '하위 트리 무게 (하위 요청 수 · 바이트)',
  'panel.inspector.initiator.chip.subtree': '+{count}건 · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 연쇄에서 요청 {count}건이 실패했습니다.' }),
  'panel.inspector.initiator.insights.failedHint': '광고 차단기, CSP 규칙, CORS 설정을 확인하세요.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), { other: '요청 {count}건을 불러왔습니다' });
    return `${String(host)} 호스트가 ${loaded} (${String(bytes)}). 연쇄 무게의 ${String(percent)}%입니다.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    '이 연쇄에서 가장 큰 단일 호스트입니다. 가능하면 직접 호스팅하거나 지연시키세요.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '연쇄 바이트의 {percent}%가 서드 파티입니다.',
  'panel.inspector.initiator.insights.thirdPartyHint':
    '필수가 아닌 서드 파티는 줄이거나, 지연시키거나, 직접 호스팅하세요.',

  // ── Timing tab (inspector detail) — the tab's OWN copy. Raw by
  // design (S34 parity-vocab lock): the eight rung names everywhere
  // (insight subjects, the open `Stalled:` step), the Server Timing
  // section name (header vocabulary), cache-source words (memory cache
  // / disk cache / service worker / miss — Size-column parity, and the
  // repeat section's cache-breakdown line with them), ms / s / B/s
  // figures on the Chrome scale, and protocol / priority / IP values. ─
  'panel.inspector.timing.noData': '타이밍 데이터가 없습니다.',
  'panel.inspector.timing.view.label': '보기',
  'panel.inspector.timing.view.showSuggestions': '제안 표시',
  'panel.inspector.timing.view.showContextStrip': '컨텍스트 띠 표시',
  'panel.inspector.timing.view.showPhaseBreakdown': '단계 내역 표시',
  'panel.inspector.timing.view.showTimingBar': '타이밍 막대 표시',
  'panel.inspector.timing.view.showServerTiming': 'Server-Timing 표시',
  'panel.inspector.timing.view.showRepeats': '세션 내 반복 표시',
  'panel.inspector.timing.view.showTransferRate': '전송 속도 표시',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': '단계가 이 요청을 지배합니다. {ms} (총계의 {percent}%).',
  'panel.inspector.timing.insight.unusuallyHighTail': '단계가 비정상적으로 높습니다. {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': '요청 스케줄러가 이 요청을 붙들었습니다',
  'panel.inspector.timing.phase.queueing.hint': '동시 요청이 너무 많아 슬롯을 다투거나 우선순위가 낮습니다.',
  'panel.inspector.timing.phase.stalled.what': '사용 가능한 연결을 기다리는 중',
  'panel.inspector.timing.phase.stalled.hint': '연결 풀 제한, 프록시 협상 또는 HTTP/1.1 헤드 오브 라인 차단입니다.',
  'panel.inspector.timing.phase.dns.what': 'DNS 조회',
  'panel.inspector.timing.phase.dns.hint': '이 도메인으로의 첫 요청에만 영향을 줍니다. DNS 프리페치를 검토하세요.',
  'panel.inspector.timing.phase.connect.what': '서버와의 TCP 핸드셰이크',
  'panel.inspector.timing.phase.connect.hint':
    '새 연결입니다. keep-alive 또는 HTTP/2/3 다중화는 여러 요청에서 연결 하나를 재사용합니다.',
  'panel.inspector.timing.phase.ssl.what': 'TLS 핸드셰이크',
  'panel.inspector.timing.phase.ssl.hint': '세션 재개 / 0-RTT (HTTP/3)로 줄어듭니다.',
  'panel.inspector.timing.phase.send.what': '요청 본문 업로드 중',
  'panel.inspector.timing.phase.send.hint':
    '요청 본문이 크거나 업스트림이 느립니다. 보통 POST/PUT 요청에서만 보입니다.',
  'panel.inspector.timing.phase.wait.what': '서버 첫 바이트까지의 시간',
  'panel.inspector.timing.phase.wait.hint':
    '백엔드 처리입니다. Server-Timing 헤더나 DB 쿼리 로그에서 백엔드 타이밍을 찾으세요.',
  'panel.inspector.timing.phase.receive.what': '응답 페이로드 다운로드 중',
  'panel.inspector.timing.phase.receive.hint': '페이로드 크기 또는 CDN 처리량입니다. 실효 전송 속도를 확인하세요.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': '프로토콜',
  'panel.inspector.timing.chip.connection': '연결',
  'panel.inspector.timing.chip.cache': '캐시',
  'panel.inspector.timing.chip.priority': '우선순위',
  'panel.inspector.timing.chip.started': '시작',
  'panel.inspector.timing.chip.serverIp': '서버 IP',
  'panel.inspector.timing.chip.connectionReused': '재사용',
  'panel.inspector.timing.chip.connectionNew': '신규',
  'panel.inspector.timing.chip.openedBy': '{url}에서 연 연결',
  'panel.inspector.timing.totalTime': '총 시간',
  'panel.inspector.timing.totalWhere': '(대기열 진입 → 종료)',
  'panel.inspector.timing.caution': '주의: 요청이 아직 끝나지 않았습니다!',
  'panel.inspector.timing.queuedAt': '대기열 진입 {offset}',
  'panel.inspector.timing.startedAt': '시작 {offset}',
  'panel.inspector.timing.inProgress': '진행 중…',
  'panel.inspector.timing.noDuration': '소요 시간 없음',
  'panel.inspector.timing.transferRate.heading': '전송 속도',
  'panel.inspector.timing.transferRate.contentDownloaded': '다운로드한 콘텐츠:',
  'panel.inspector.timing.transferRate.effectiveRate': '실효 속도:',
  'panel.inspector.timing.transferRate.amount': '{duration} 동안 {size}',
  'panel.inspector.timing.repeats.heading': '이 세션 내 반복',
  'panel.inspector.timing.repeats.hitCount': 'URL 적중 횟수:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': '최소 / 중앙값 / 최대:',
  'panel.inspector.timing.repeats.thisRequest': '이 요청:',
  'panel.inspector.timing.repeats.slowestTag': '(가장 느림)',
  'panel.inspector.timing.repeats.fastestTag': '(가장 빠름)',
  'panel.inspector.timing.repeats.cacheBreakdown': '캐시 내역:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
