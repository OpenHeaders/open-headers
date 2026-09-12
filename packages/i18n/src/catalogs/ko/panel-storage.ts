/**
 * DevTools panel — storage tool window — Korean. Mirrors
 * `catalogs/en/panel-storage.ts` key for key. Raw by design: grid
 * column headers and their (i) titles (Key / Value / Name /
 * Domain · Path / Expires / Sec / Request / Method / Size / Time —
 * the S37 grid-header lock), the localStorage / sessionStorage API
 * globals, IndexedDB / Cache Storage platform names, the Storage
 * tool-window label in prose (창 as head noun), example-card payloads,
 * char / byte / MB figures, the Key / Value input placeholders (they
 * name their raw columns), and data-plane not-sent reasons riding as
 * holes. Mints: 항목 = entry; 객체 저장소 = object store; 레코드 =
 * IndexedDB record; 할당량 = quota (simulated limit) vs 사용량 = usage
 * (the nav section); 프레임 = frame (page/iframe referent); 커서 =
 * cursor; 인라인 편집 = inline edit; 상한 = cap / ceiling; 자동 증가
 * 키 = auto-increment keys with out-of-line 키 riding the raw IDB
 * term; 쿠키 저장소 (cookie jar) and 초안 carried from the shared
 * register; 출처 = origin; 검사 중인 탭 = the inspected tab.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. ─────────────────────────────────────────────────────────────
  'panel.storage.nav.aria': '저장소 종류',
  'panel.storage.nav.local': '로컬 저장소',
  'panel.storage.nav.session': '세션 저장소',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': '사용량',
  'panel.storage.nav.badgeTitle': ({ count }, locale) => plural(locale, Number(count), { other: '일치 {count}건' }),
  'panel.storage.filterAria': '저장소 항목 필터',
  'panel.storage.revealedHidden': '표시하려는 행이 현재 필터에 가려져 있습니다',
  'panel.storage.addCookieTitle': '브라우저 쿠키 저장소에 쿠키 추가 (HttpOnly 포함)',
  'panel.storage.addCookieAria': '쿠키 추가',
  'panel.storage.addEntryTitle': '항목 추가',
  'panel.storage.addEntryAria': '저장소 항목 추가',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB 데이터는 여기서 읽기 전용입니다',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage 데이터는 여기서 읽기 전용입니다',
  'panel.storage.addReadOnly.quota': '사용량은 읽기 전용입니다',
  'panel.storage.refreshTitle': '새로 고침',
  'panel.storage.refreshAria': '저장소 새로 고침',
  'panel.storage.originAria': '저장소 출처',
  'panel.storage.partitionedChip': '분할됨',
  'panel.storage.partitionedTitle':
    '분할된 저장소입니다. 여기 있는 이 출처의 데이터는 {site} 아래에 키가 지정되어 있습니다.\n저장소 키: {raw}',
  'panel.storage.partitionFallback': '어떤 파티션',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) => plural(locale, Number(count), { other: '항목 {count}개' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '항목 {count}개' });
    return `${total} 중 ${String(shown)}개`;
  },
  'panel.storage.count.cookies': ({ count }, locale) => plural(locale, Number(count), { other: '쿠키 {count}개' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { other: '쿠키 {count}개' });
    return `${total} 중 ${String(shown)}개`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), { other: '데이터베이스 {count}개' }),
  'panel.storage.count.caches': ({ count }, locale) => plural(locale, Number(count), { other: '캐시 {count}개' }),
  'panel.storage.count.quotaUsed': '{total} 중 {used} 사용',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), { other: '섹션 {count}개 일치' }),
  'panel.storage.note.writeFailed': '쓰기 실패',
  'panel.storage.note.deleteFailed': '삭제 실패',
  'panel.storage.note.readFailed': '읽기 실패. 마지막 데이터를 표시 중',
  'panel.storage.note.truncated': '목록이 잘렸습니다',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': '로컬 저장소 지우기',
  'panel.storage.clear.label.session': '세션 저장소 지우기',
  'panel.storage.clear.label.cookies': '쿠키 지우기',
  'panel.storage.clear.label.indexeddb': 'IndexedDB 지우기',
  'panel.storage.clear.label.cachestorage': 'Cache Storage 지우기',
  'panel.storage.clear.title.local': '모든 localStorage 항목 지우기',
  'panel.storage.clear.title.session': '모든 sessionStorage 항목 지우기',
  'panel.storage.clear.title.cookies': '이 사이트 쿠키 저장소의 모든 쿠키 지우기',
  'panel.storage.clear.title.indexeddb': '모든 IndexedDB 데이터베이스 지우기',
  'panel.storage.clear.title.cachestorage': '모든 캐시 지우기',
  'panel.storage.clear.armedTitle.local': '이 출처의 모든 localStorage 항목을 삭제합니다',
  'panel.storage.clear.armedTitle.session': '이 출처의 모든 sessionStorage 항목을 삭제합니다',
  'panel.storage.clear.armedTitle.cookies': '이 사이트 쿠키 저장소에서 이 출처의 모든 쿠키를 삭제합니다',
  'panel.storage.clear.armedTitle.indexeddb': '이 출처의 모든 IndexedDB 데이터베이스를 삭제합니다',
  'panel.storage.clear.armedTitle.cachestorage': '이 출처의 모든 캐시를 삭제합니다',
  'panel.storage.confirmClear': '지우시겠습니까?',
  'panel.storage.confirmDelete': '삭제하시겠습니까?',
  'panel.storage.confirmSuffixAria': '{action}. 확정하려면 다시 클릭하세요',
  'panel.storage.cleared': '✓ 지웠습니다',
  'panel.storage.clearFailed': '지우기 실패',
  // Empty / error states.
  'panel.storage.empty.loading': '불러오는 중…',
  'panel.storage.empty.notAvailableTitle': '여기서는 저장소 검사를 사용할 수 없습니다',
  'panel.storage.empty.notAvailableSub': '이 호스트는 검사 중인 탭의 애플리케이션 저장소를 노출하지 않습니다.',
  'panel.storage.empty.noOriginsTitle': '검사할 수 있는 출처가 없습니다',
  'panel.storage.empty.noOriginsDomSub':
    '이 탭에는 DOM 저장소가 있는 http(s) 프레임이 없습니다. 브라우저 내부 페이지는 검사할 수 없습니다.',
  'panel.storage.empty.noOriginsSub': '이 탭에는 http(s) 프레임이 없습니다. 브라우저 내부 페이지는 검사할 수 없습니다.',
  'panel.storage.empty.noOriginsCookiesSub':
    '이 탭에는 http(s) 프레임이 없습니다. 브라우저 내부 페이지에는 사이트 쿠키가 없습니다.',
  'panel.storage.empty.unavailableTitle': '저장소를 사용할 수 없습니다',
  'panel.storage.empty.unavailableSub':
    '{origin}의 프레임을 지금은 읽을 수 없습니다. 다른 페이지로 이동했을 수 있습니다.',
  'panel.storage.thisOrigin': '이 출처',
  'panel.storage.empty.noItems': '{origin}의 {area}에 항목이 없습니다.',
  'panel.storage.empty.noItemsMatch': '필터와 일치하는 항목이 없습니다.',
  'panel.storage.empty.cookiesUnavailableTitle': '여기서는 쿠키를 사용할 수 없습니다',
  'panel.storage.empty.cookiesUnavailableSub': '이 호스트는 브라우저 쿠키 저장소를 노출하지 않습니다.',
  'panel.storage.empty.noCookies': '{origin}의 쿠키가 없습니다.',
  'panel.storage.empty.noCookiesMatch': '필터와 일치하는 쿠키가 없습니다.',
  // Jar cookie grid column headers — 'Domain · Path' carries the raw
  // attribute vocabulary inside the keyed value.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': '저장소 항목',
  'panel.storage.grid.clipped': '잘림 ({length})',
  'panel.storage.grid.editTitle': '이 항목 편집',
  'panel.storage.grid.editAria': '{key} 편집',
  'panel.storage.grid.deleteTitle': '이 항목 삭제',
  'panel.storage.grid.deleteAria': '{key} 삭제',
  'panel.storage.grid.newKeyAria': '새 항목 키',
  'panel.storage.grid.newValueAria': '새 항목 값',
  'panel.storage.grid.keyAria': '항목 키',
  'panel.storage.grid.valueAria': '항목 값',
  'panel.storage.grid.addSaveHint': '새 항목을 저장소에 씁니다',
  'panel.storage.grid.editSaveHint': '편집한 항목을 저장소에 다시 씁니다',
  'panel.storage.grid.emptyKeyHint': '키는 비워 둘 수 없습니다',
  'panel.storage.grid.cancelTitle': '취소',
  'panel.storage.grid.cancelAddAria': '추가 취소',
  'panel.storage.grid.cancelEditAria': '편집 취소',
  'panel.storage.grid.tooLarge': '너무 커서 여기서 편집할 수 없습니다. 전체 값이 편집 상한을 넘습니다.',
  'panel.storage.grid.fetchFailed': '전체 값을 지금은 읽을 수 없습니다.',
  'panel.storage.grid.loadingFullValue': '전체 값을 불러오는 중…',
  'panel.storage.save.label': '저장',
  'panel.storage.save.noChanges': '저장할 변경 사항이 없습니다',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': '이 페이지에는 전송되지 않습니다. {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} 항목은 이 페이지에 전송되지 않습니다: {reason}',
  'panel.storage.cookieRow.partitionedUnder': '{key} 아래에 분할됨',
  'panel.storage.cookieRow.editTitle': '브라우저 쿠키 저장소에서 이 쿠키 편집',
  'panel.storage.cookieRow.editAria': '쿠키 {name} 편집',
  'panel.storage.cookieRow.deleteTitle': '브라우저 쿠키 저장소에서 이 쿠키 삭제',
  'panel.storage.cookieRow.deleteAria': '쿠키 {name} 삭제',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB 데이터를 읽을 수 없습니다',
  'panel.storage.idb.cantReadSub':
    '이 프레임이 지금은 데이터베이스를 노출하지 않습니다. 다른 페이지로 이동했을 수 있습니다.',
  'panel.storage.idb.noDatabases': '이 출처의 IndexedDB 데이터베이스가 없습니다.',
  'panel.storage.idb.versionTitle': '데이터베이스 버전 {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '객체 저장소 {count}개' }),
  'panel.storage.idb.metaKeyPath': '키: {path}',
  'panel.storage.idb.metaAutoIncrement': '자동 증가 키',
  'panel.storage.idb.metaOutOfLine': 'out-of-line 키',
  'panel.storage.idb.indexCount': ({ count }, locale) => plural(locale, Number(count), { other: '인덱스 {count}개' }),
  'panel.storage.idb.deleteDbTitle': '{name} 데이터베이스 삭제',
  'panel.storage.idb.deleteDbConfirmTitle':
    '{name} 데이터베이스와 그 안의 모든 객체 저장소를 삭제합니다. 열어 둔 페이지가 있으면 삭제가 차단됩니다',
  'panel.storage.idb.deleteDbAria': '데이터베이스 {name} 삭제',
  'panel.storage.idb.openStoreTitle': '{database} › {store} 열기',
  'panel.storage.idb.clearStoreTitle': '{store}의 모든 레코드 지우기',
  'panel.storage.idb.clearStoreConfirmTitle': '{database} › {store}의 모든 레코드를 삭제합니다',
  'panel.storage.idb.clearStoreAria': '객체 저장소 {store} 지우기',
  'panel.storage.idb.noStores': '객체 저장소 없음',
  'panel.storage.idb.backTitle': '데이터베이스 목록으로 돌아가기',
  'panel.storage.idb.cursorAria': '레코드 커서',
  'panel.storage.idb.cursorTitle': '인덱스 중 하나를 통해 객체 저장소를 읽습니다. 키 열이 인덱스 키가 됩니다',
  'panel.storage.idb.primaryKeyOption': '기본 키',
  'panel.storage.idb.indexOption': '인덱스: {name}',
  'panel.storage.idb.noRecords': '{store}에 레코드가 없습니다.',
  'panel.storage.idb.noRecordsPage': '이 페이지의 {store}에 레코드가 없습니다.',
  'panel.storage.idb.noRecordsMatch': '필터와 일치하는 레코드가 없습니다.',
  'panel.storage.idb.gridAria': 'IndexedDB 레코드',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': '이 레코드를 편집기에서 열기',
  'panel.storage.idb.keyCellTitle': '키: {key}\n기본 키: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': '이 레코드 삭제',
  'panel.storage.idb.deleteRecordAria': '레코드 {key} 삭제',
  'panel.storage.pager.prevTitle': '이전 페이지',
  'panel.storage.pager.nextTitle': '다음 페이지',
  'panel.storage.pager.page': '{page}페이지',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage 데이터를 읽을 수 없습니다',
  'panel.storage.cache.cantReadSub':
    '이 API 기능은 보안 컨텍스트 (https)에만 존재합니다. 또는 이 프레임을 지금은 읽을 수 없습니다.',
  'panel.storage.cache.noCaches': '이 출처의 캐시가 없습니다.',
  'panel.storage.cache.noCachesMatch': '필터와 일치하는 캐시가 없습니다.',
  'panel.storage.cache.openTitle': '{name} 캐시 열기',
  'panel.storage.cache.deleteTitle': '{name} 캐시 삭제',
  'panel.storage.cache.deleteConfirmTitle': '{name} 캐시와 그 안의 모든 항목을 삭제합니다',
  'panel.storage.cache.deleteAria': '캐시 {name} 삭제',
  'panel.storage.cache.backTitle': '캐시 목록으로 돌아가기',
  'panel.storage.cache.noEntries': '{name}에 항목이 없습니다.',
  'panel.storage.cache.noEntriesPage': '이 페이지의 {name}에 항목이 없습니다.',
  'panel.storage.cache.noEntriesMatch': '필터와 일치하는 항목이 없습니다.',
  'panel.storage.cache.gridAria': '캐시 항목',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': '이 항목 삭제',
  'panel.storage.cache.deleteEntryConfirmTitle': '저장된 응답을 삭제합니다. 확정하려면 다시 클릭하세요',
  'panel.storage.cache.deleteEntryAria': '항목 {url} 삭제',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': '사용량을 읽을 수 없습니다',
  'panel.storage.quota.cantReadSub':
    '이 API 기능은 보안 컨텍스트 (https)에만 존재합니다. 또는 이 프레임을 지금은 읽을 수 없습니다.',
  'panel.storage.quota.used': '{size} 사용',
  'panel.storage.quota.ofTotal': '{size} 중 ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Service Worker',
  'panel.storage.quota.type.fileSystems': '파일 시스템',
  'panel.storage.quota.type.other': '기타',
  'panel.storage.quota.noBreakdown': '이 출처의 종류별 사용량이 보고되지 않았습니다.',
  'panel.storage.quota.debugHint': '종류별 내역을 보려면 디버그 모드를 켜세요.',
  'panel.storage.quota.sessionNote': '세션 저장소는 탭별입니다. 이 작업은 검사 중인 탭의 프레임을 지웁니다',
  'panel.storage.quota.targetsCaption': '“모두 지우기” 대상',
  'panel.storage.quota.targetsTitle': '“모두 지우기” (오른쪽 위)는 이 출처에서 체크한 데이터 종류만 정확히 삭제합니다',
  'panel.storage.quota.simulateLabel': '사용자 지정 할당량 시뮬레이션',
  'panel.storage.quota.simulateTitle':
    '이 출처에 대해 브라우저가 더 작은 할당량을 보고하고 적용하게 합니다. 저장 공간이 부족할 때 페이지가 어떻게 동작하는지 테스트하기 위한 것입니다',
  'panel.storage.quota.simulateSave': '저장',
  'panel.storage.quota.simulateCancel': '취소',
  'panel.storage.quota.simulateReset': '재설정',
  'panel.storage.quota.simulateResetTitle': '시뮬레이션한 할당량 제거',
  'panel.storage.quota.simulateRange': '0–{max} MB 입력',
  'panel.storage.quota.simulateFailed': '시뮬레이션 실패',
  'panel.storage.quota.clearEverything': '모두 지우기',
  'panel.storage.quota.clearArmedTitle': '이 출처에서 체크한 데이터 종류를 삭제합니다',
  'panel.storage.quota.clearTitle': '이 출처에서 체크한 데이터 종류 지우기',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': '쓰기 예시',
  'panel.storage.domCol.key.summary':
    '항목의 이름입니다. 대소문자를 구분하는 문자열로, 이 출처의 {area} 안에서 고유합니다. 기존 키에 쓰면 값이 덮어쓰기됩니다.',
  'panel.storage.domCol.key.description':
    '여기서 항목의 이름을 바꾸면 새 키를 먼저 쓴 다음 이전 키를 제거합니다. 쓰기에 실패해도 원본은 사라지지 않습니다.',
  'panel.storage.domCol.value.summary':
    '저장된 페이로드입니다. 항상 문자열이며, 페이지는 구조화된 데이터를 보통 JSON 형식으로 직렬화해 보관합니다.',
  'panel.storage.domCol.value.description':
    '그리드는 한 줄 미리보기를 표시하고 아주 긴 값은 잘라 냅니다. 항목을 열거나 편집하면 전체 텍스트를 가져옵니다. 행을 클릭하면 편집기 탭으로 열리고, 더블 클릭 (또는 연필)으로 인라인 편집합니다.',
  'panel.storage.cookieCol.name.summary':
    '쿠키 식별자입니다. 브라우저는 (name, domain, path)를 키로 삼습니다. 이름이 같아도 범위가 다르면 별개의 쿠키입니다.',
  'panel.storage.cookieCol.name.description':
    '경고 삼각형은 검사 중인 페이지로의 요청에 브라우저가 붙이지 않을 사이트 저장소 쿠키를 표시합니다. 마우스를 올리면 이유가 보입니다 (다른 곳으로 한정된 path, http에서 Secure 전용, 하위 도메인으로 한정 등).',
  'panel.storage.cookieCol.value.summary': '쿠키 페이로드입니다. 브라우저가 Cookie 헤더로 되돌려 보내는 내용입니다.',
  'panel.storage.cookieCol.value.description':
    '행을 클릭하면 전체 값과 파싱된 보기를 갖춘 편집기 탭으로 쿠키가 열립니다. 연필로 인라인 편집합니다.',
  'panel.storage.cookieCol.scope.summary':
    '브라우저가 이 쿠키를 붙이는 위치입니다. 그 Domain 값과, / 보다 좁을 때는 그 Path 값입니다.',
  'panel.storage.cookieCol.scope.description':
    '도메인 전체 쿠키 (앞에 점을 붙여 저장)는 하위 도메인으로도 흘러갑니다. 호스트 전용 쿠키는 정확히 그 호스트에만 고정됩니다. path 값은 접두사입니다. /api 경로이면 /api 아래의 요청만 쿠키를 실어 보냅니다.',
  'panel.storage.cookieCol.expires.summary':
    '브라우저가 쿠키를 삭제하는 시점입니다. 지금 기준 상대 시간으로 표시되며, 마우스를 올리면 절대 날짜가 보입니다.',
  'panel.storage.cookieCol.expires.description':
    'Session 값은 Expires / Max-Age 속성이 없다는 뜻입니다. 세션이 끝나면 브라우저가 쿠키를 버립니다.',
  'panel.storage.cacheCol.exampleCaption': '항목 예시',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· 저장 시각',
  'panel.storage.cacheCol.request.summary': '저장된 요청의 URL 주소입니다. 캐시가 fetch 호출을 대조하는 키입니다.',
  'panel.storage.cacheCol.request.description':
    '행에 마우스를 올리면 저장된 요청 헤더의 제한된 미리보기가 추가됩니다. 행을 클릭하면 저장된 응답이 편집기 탭으로 열립니다. 그리드는 메타데이터만 보관합니다.',
  'panel.storage.cacheCol.method.summary': '저장된 요청의 HTTP 메서드입니다. URL 주소와 함께 캐시 키의 일부입니다.',
  'panel.storage.cacheCol.method.description':
    '거의 항상 GET 메서드입니다. Cache API 기능은 다른 메서드에 대한 put / add 호출을 거부합니다.',
  'panel.storage.cacheCol.size.summary': '저장된 응답의 크기입니다. 그 content-length 헤더에서 읽습니다.',
  'panel.storage.cacheCol.size.description':
    '“—”는 저장된 응답에 content-length 헤더가 없다는 뜻입니다. 본문은 그대로 항목의 편집기 탭에 있습니다.',
  'panel.storage.cacheCol.time.summary': '응답이 캐시에 저장된 시각입니다.',
  'panel.storage.cacheCol.time.description':
    '연결된 탭에서만 도출할 수 있습니다. “—”는 이 범위에서 호스트가 읽지 못했다는 뜻입니다.',
  'panel.storage.idbCol.exampleCaption': '레코드 예시',
  'panel.storage.idbCol.key.summary':
    '현재 커서 기준 레코드의 키입니다. 기본값은 객체 저장소의 기본 키이며, 이동 경로에서 인덱스를 고르면 그 인덱스를 통해 읽고 이 열은 인덱스 키가 됩니다.',
  'panel.storage.idbCol.key.description':
    '행에 마우스를 올리면 두 키 (커서 키와 기본 키)가 모두 보입니다. 키는 숫자, 문자열, 날짜 또는 그것들의 배열일 수 있습니다.',
  'panel.storage.idbCol.value.summary':
    '레코드의 구조화 복제 값을 한 줄로 미리 보여 줍니다. 페이지 안에서 직렬화됩니다.',
  'panel.storage.idbCol.value.description':
    '행을 클릭하면 펼칠 수 있는 트리를 갖춘 편집기 탭으로 전체 레코드가 열립니다. 그리드는 미리보기만 보관합니다.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Storage 창에서 표시',
  'panel.storage.doc.refreshConfirm': '편집 내용을 버립니다. 새로 고치려면 다시 클릭하세요',
  'panel.storage.doc.discardEdits': '내 편집 내용 버리기',
  'panel.storage.doc.openMergeView': '병합 보기 열기',
  'panel.storage.doc.preview': '미리보기',
  'panel.storage.doc.source': '소스',
  'panel.storage.doc.formatAria': '소스 텍스트 형식',
  'panel.storage.doc.formatted': '정리됨',
  'panel.storage.doc.raw': 'Raw',
  'panel.storage.doc.formattedTitle': '읽기 좋게 정리한 보기입니다. 저장은 저장된 형식을 유지합니다',
  'panel.storage.doc.rawTitle': '저장된 그대로의 텍스트',
  'panel.storage.doc.formatUnavailable': '정리된 보기는 JSON 형태의 값에서만 사용할 수 있습니다',
  'panel.storage.doc.formatInfoTitle': '정리된 보기',
  'panel.storage.doc.formatInfoSummary': '“정리됨”과 “Raw”는 같은 저장 텍스트를 보는 두 가지 보기입니다.',
  'panel.storage.doc.formatInfoExampleCaption': '예시: 값 하나, 보기 둘',
  'panel.storage.doc.formatInfoModesHeading': '모드',
  'panel.storage.doc.formatInfoFormattedDesc':
    '읽기용 보기로, 공백만 다릅니다. 편집 내용은 원래 저장 형식으로 다시 인코딩되며 저장은 그 텍스트를 씁니다. 편집 없이 저장하면 원래 바이트를 그대로 씁니다.',
  'panel.storage.doc.formatInfoFormattedViewOnlyDesc':
    '읽기용 보기로, 공백만 다릅니다. 이 문서는 읽기 전용이며 “정리됨” 보기는 저장된 바이트를 바꾸지 않습니다.',
  'panel.storage.doc.formatInfoRawDesc': '저장된 그대로의 바이트입니다.',
  'panel.storage.doc.unavailableSub': '삭제되었거나 프레임을 지금은 읽을 수 없습니다. 새로 고침으로 다시 시도합니다.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '… ({count}자 더)' }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    '같은 이름, 도메인, 경로의 쿠키가 이미 있습니다. 저장하면 덮어쓰기됩니다. 다른 식별자를 고르세요.',
  'panel.storage.doc.cookie.saveFailed.write': '저장에 실패했습니다. 브라우저 쿠키 저장소가 쓰기를 거부했습니다.',
  'panel.storage.doc.cookie.saveFailed.remove':
    '새 쿠키는 썼지만 원래 쿠키를 제거하지 못했습니다. 둘 다 존재합니다. 새로 고침하면 쿠키 저장소를 다시 읽습니다.',
  'panel.storage.doc.cookie.saveHint': '편집한 쿠키를 브라우저 쿠키 저장소에 다시 씁니다',
  'panel.storage.doc.cookie.blockedHint': '양식이 불완전하거나 참조가 확인되지 않습니다',
  'panel.storage.doc.cookie.refreshTitle': '쿠키 다시 읽기',
  'panel.storage.doc.cookie.refreshAria': '쿠키 새로 고침',
  'panel.storage.doc.cookie.revealTitle': 'Storage 도구 창에서 Cookies 열기',
  'panel.storage.doc.cookie.readOnlyNote':
    '이 호스트의 쿠키 저장소는 읽기 전용입니다. 문서는 저장소 내용을 반영하지만 다시 쓸 수는 없습니다.',
  'panel.storage.doc.cookie.goneNote':
    '이 쿠키는 브라우저에서 삭제되었습니다. 저장하지 않은 편집 내용은 유지됩니다. 저장하면 다시 씁니다.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie 항목이 더 이상 저장소에 없습니다',
  'panel.storage.doc.cookie.unavailableSub':
    '삭제되었거나 만료되었거나 이 호스트에서 쿠키 저장소를 읽을 수 없습니다. 새로 고침으로 다시 시도합니다.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    '그 키의 항목이 이미 있습니다. 저장하면 덮어쓰기됩니다. 다른 키를 고르세요.',
  'panel.storage.doc.dom.saveFailed.gone':
    '항목에 접근할 수 없습니다. 삭제되었을 수 있습니다. 새로 고침하면 다시 확인합니다.',
  'panel.storage.doc.dom.saveFailed.quota':
    '저장에 실패했습니다. 저장소 할당량을 초과했습니다. 원래 항목은 바뀌지 않았습니다.',
  'panel.storage.doc.dom.saveFailed.write': '저장에 실패했습니다. 쓰기가 거부되었습니다.',
  'panel.storage.doc.dom.modeAria': '항목 보기 모드',
  'panel.storage.doc.dom.previewTitle': '파싱된 값을 접을 수 있는 트리로 봅니다',
  'panel.storage.doc.dom.previewNeedsJson': '미리보기에는 JSON 값이 필요합니다',
  'panel.storage.doc.dom.sourceTitle': 'Raw 값 보기',
  'panel.storage.doc.dom.saveHint': '편집한 항목을 저장소에 다시 씁니다',
  'panel.storage.doc.dom.blockedHint': '키는 비워 둘 수 없습니다',
  'panel.storage.doc.dom.refreshTitle': '항목 다시 읽기',
  'panel.storage.doc.dom.refreshAria': '항목 새로 고침',
  'panel.storage.doc.dom.revealTitle': 'Storage 도구 창에서 {area} 열기',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': '항목 키',
  'panel.storage.doc.dom.conflictNote': '편집하는 동안 브라우저에서 값이 바뀌었습니다.',
  'panel.storage.doc.dom.mergeToast': '병합 결과를 초안에 적용했습니다. 저장하면 브라우저에 씁니다',
  'panel.storage.doc.dom.goneNote':
    '이 항목은 브라우저에서 삭제되었습니다. 저장하지 않은 편집 내용은 유지됩니다. 저장하면 다시 씁니다.',
  'panel.storage.doc.dom.unavailableTitle': '항목을 더 이상 사용할 수 없습니다',
  'panel.storage.doc.dom.tooLargeTitle': '너무 커서 열 수 없습니다',
  'panel.storage.doc.dom.tooLargeSub': '값이 편집기 상한을 넘어 읽기 전용으로 유지됩니다.',
  'panel.storage.doc.dom.previewAria': '항목 값 트리',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': '유효한 JSON 형식이 아닙니다. 구문을 고치고 다시 저장하세요.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    '키가 바뀌었습니다. 저장하면 새 레코드가 만들어집니다. 원래 키로 되돌리세요.',
  'panel.storage.doc.idb.saveFailed.gone':
    '레코드에 접근할 수 없습니다. 삭제되었을 수 있습니다. 새로 고침하면 다시 확인합니다.',
  'panel.storage.doc.idb.saveFailed.write': '저장에 실패했습니다. 쓰기가 거부되었습니다.',
  'panel.storage.doc.idb.modeAria': '레코드 보기 모드',
  'panel.storage.doc.idb.previewTitle': '레코드 값을 접을 수 있는 트리로 봅니다',
  'panel.storage.doc.idb.previewNeedsDoc': '미리보기에는 올바른 형식의 문서가 필요합니다',
  'panel.storage.doc.idb.sourceTitle': '문서 전체 소스 보기',
  'panel.storage.doc.idb.saveHint': '편집한 값을 레코드에 다시 씁니다',
  'panel.storage.doc.idb.refreshTitle': '레코드 다시 읽기',
  'panel.storage.doc.idb.refreshAria': '레코드 새로 고침',
  'panel.storage.doc.idb.revealTitle': 'Storage 도구 창에서 {database} › {store} 열기',
  'panel.storage.doc.idb.truncatedNote': '크기 상한에서 잘렸습니다. 읽기 전용입니다.',
  'panel.storage.doc.idb.nonJsonNote':
    'JSON 외의 타입 (Date, Map, 바이너리 등)을 포함합니다. 읽기 전용 렌더링으로 표시합니다.',
  'panel.storage.doc.idb.conflictNote': '편집하는 동안 브라우저에서 레코드가 바뀌었습니다.',
  'panel.storage.doc.idb.mergeToast': '병합 결과를 초안에 적용했습니다. 저장하면 레코드에 씁니다',
  'panel.storage.doc.idb.goneNote':
    '이 레코드는 브라우저에서 삭제되었거나 형태가 바뀌었습니다. 저장하지 않은 편집 내용은 유지됩니다. 저장하면 다시 씁니다.',
  'panel.storage.doc.idb.unavailableTitle': '레코드를 더 이상 사용할 수 없습니다',
  'panel.storage.doc.idb.previewAria': '레코드 값 트리',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': '이 항목을 캐시에서 삭제',
  'panel.storage.doc.cache.deleteConfirmTitle': '저장된 응답을 삭제합니다. 확정하려면 다시 클릭하세요',
  'panel.storage.doc.cache.deleteAria': '캐시 항목 삭제',
  'panel.storage.doc.cache.refreshTitle': '저장된 응답 다시 읽기',
  'panel.storage.doc.cache.refreshAria': '캐시 항목 새로 고침',
  'panel.storage.doc.cache.revealTitle': 'Storage 도구 창에서 {cache} 캐시 열기',
  'panel.storage.doc.cache.deleteFailed': '삭제에 실패했습니다. 항목이 이미 사라졌을 수 있습니다.',
  'panel.storage.doc.cache.unavailableTitle': '캐시 항목을 더 이상 사용할 수 없습니다',
  'panel.storage.doc.cache.truncatedNote': '본문이 크기 상한에서 잘렸습니다. 저장된 크기: {size}.',
  'panel.storage.doc.cache.headersSummary': '응답 헤더 ({count})',
  'panel.storage.doc.cache.filterPlaceholder': '헤더 필터',
  'panel.storage.doc.cache.filterAria': '응답 헤더 필터',
  'panel.storage.doc.cache.noHeaders': '저장된 헤더가 없습니다.',
  'panel.storage.doc.cache.noHeadersMatch': '필터와 일치하는 헤더가 없습니다.',
  'panel.storage.doc.cache.bodySummary': '응답 본문',
  'panel.storage.doc.cache.imageAria': '저장된 이미지 본문',
  'panel.storage.doc.cache.imageAlt': '{url}의 저장된 응답 본문',
  'panel.storage.doc.cache.binaryBody': '바이너리 본문입니다. 저장된 크기: {size}.',
  'panel.storage.doc.cache.emptyBody': '빈 본문입니다.',
} as const satisfies Catalog;
