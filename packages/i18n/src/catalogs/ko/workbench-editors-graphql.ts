/**
 * Workbench editors — the GraphQL client editor, Korean. Mirrors
 * `catalogs/en/workbench-editors-graphql.ts` key for key. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}`
 * envelope names, SDL, introspection, `Query` / `Subscription` tab
 * and pane nouns, `extensions`, `Docs`) rides raw inside keyed values.
 * 스키마 = schema; 탐색기 = explorer; 변수 = variables; 인트로스펙션 =
 * introspection; 구독 = subscription (prose; the pane title stays the
 * raw `Subscription`); 문서 = the GraphQL document (S19 separate
 * referent beside Docs = the raw tab noun); 빌더 = builder; 프래그먼트
 * = fragment; 인가 / 헤더 / 스크립트 / 설정 = the editor tab family
 * (ja / zh-CN parity; Docs / Params stay raw); 사양 = spec carried;
 * 작업 = operation. Every raw token takes a head noun before a
 * particle (HTTP {status} 상태로, errors[] 목록을, data 값이).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'GraphQL 요청을 찾을 수 없습니다.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': '중지',
  'workbench.editors.graphql.query.stopTooltip': '쿼리를 중지하고 도착한 내용은 유지합니다',
  'workbench.editors.graphql.operation.placeholder': '작업',
  'workbench.editors.graphql.operation.tooltip':
    '이 Query 탭이 실행하는 작업입니다. 문서에는 여러 작업이 있으며, 선택한 작업이 operationName 값으로 전송선에 실립니다.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '오류 {count}건' }),
  'workbench.editors.graphql.response.errorsTitle': 'GraphQL 오류',
  'workbench.editors.graphql.response.errorsSummary':
    '서버가 HTTP {status} 상태와 errors[] 목록으로 응답했습니다. 필드가 실패했거나, 문서가 거부되었거나, 인증이 빠졌습니다. 옆의 data 값을 읽으세요: 부분 결과이거나 null입니다.',
  'workbench.editors.graphql.response.dataNull':
    'data 값이 null입니다. 모든 루트 필드가 오류를 전파했거나, 요청이 실행 전에 거부되었습니다.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': '응답 extensions',
  'workbench.editors.graphql.response.extensionsSummary':
    '서버의 extensions 객체가 data 값 옆에 실립니다. 추적, 비용, 캐시 힌트 등 서버가 붙이기로 한 것입니다.',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': '인가',
  'workbench.editors.graphql.tab.headers': '헤더',
  'workbench.editors.graphql.tab.schema': '스키마',
  'workbench.editors.graphql.tab.scripts': '스크립트',
  'workbench.editors.graphql.tab.settings': '설정',
  'workbench.editors.graphql.explorer.emptyTitle': '서버에서 사용할 수 있는 데이터 탐색',
  'workbench.editors.graphql.explorer.emptyHint': '서버 URL 주소를 입력하면 인트로스펙션으로 스키마를 불러옵니다.',
  'workbench.editors.graphql.explorer.introspect': 'GraphQL 인트로스펙션 사용',
  'workbench.editors.graphql.explorer.loadFailed': 'GraphQL 스키마를 불러올 수 없습니다.',
  'workbench.editors.graphql.explorer.tryAgain': '다시 시도',
  'workbench.editors.graphql.explorer.useSpec': 'GraphQL 사양 사용',
  'workbench.editors.graphql.explorer.importSchema': 'GraphQL 스키마 가져오기',
  'workbench.editors.graphql.variables.title': '변수',
  'workbench.editors.graphql.variables.generate': '변수 생성',
  'workbench.editors.graphql.variables.generateHint': '선택한 작업의 변수 정의에서 변수를 채웁니다.',
  'workbench.editors.graphql.variables.generateNeedsOperation': '선택한 작업은 변수를 선언하지 않습니다.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    '모든 GraphQL 작업은 {query, variables, operationName} 봉투를 JSON 형식으로 게시합니다. 재정의하려면 Content-Type 행을 직접 추가하세요.',
  'workbench.editors.graphql.schema.sourceLabel': '스키마 소스',
  'workbench.editors.graphql.schema.sourcePlaceholder': '스키마 소스 선택',
  'workbench.editors.graphql.schema.or': '또는',
  'workbench.editors.graphql.schema.hint':
    '스키마는 탐색기, 자동 완성, 유효성 검사에 쓰입니다. 이 요청의 인증과 설정을 통해 서버에서 인트로스펙션하거나, GraphQL 사양에서 연결하거나, SDL 또는 인트로스펙션 파일에서 가져옵니다.',
  'workbench.editors.graphql.scripts.beforeQuery': '쿼리 전',
  'workbench.editors.graphql.scripts.afterResponse': '응답 후',
  'workbench.editors.graphql.toast.deletedOtherTab': '이 GraphQL 요청은 다른 탭에서 삭제되었습니다.',
  'workbench.editors.graphql.toast.updateFailed': 'GraphQL 요청을 저장하지 못했습니다',
  'workbench.editors.graphql.toast.updateFailedDetail': 'GraphQL 요청을 저장하지 못했습니다: {message}',
  'workbench.editors.graphql.explorer.needsUrl': '먼저 엔드포인트 URL 주소를 입력하세요.',
  'workbench.editors.graphql.explorer.introspecting': '인트로스펙션 중…',
  'workbench.editors.graphql.explorer.search': '유형 및 필드 검색',
  'workbench.editors.graphql.explorer.noResults': '“{term}”과 일치하는 항목이 없습니다.',
  'workbench.editors.graphql.explorer.back': '뒤로',
  'workbench.editors.graphql.explorer.fields': '필드',
  'workbench.editors.graphql.explorer.arguments': '인수',
  'workbench.editors.graphql.explorer.values': '값',
  'workbench.editors.graphql.explorer.inputFields': '입력 필드',
  'workbench.editors.graphql.explorer.implements': '구현',
  'workbench.editors.graphql.explorer.possibleTypes': '가능한 유형',
  'workbench.editors.graphql.explorer.returns': '반환',
  'workbench.editors.graphql.explorer.specifiedBy': '사양 출처',
  'workbench.editors.graphql.explorer.deprecated': '사용 중단됨: {reason}',
  'workbench.editors.graphql.explorer.insert': '커서 위치에 삽입',
  'workbench.editors.graphql.explorer.insertHint':
    '커서 위치의 문서에 필드를 추가합니다. 필수 인수는 변수로, 객체를 반환하면 빈 선택 집합으로 넣습니다. 단방향입니다. 문서는 내 것으로 남습니다.',
  'workbench.editors.graphql.schema.source.introspection': 'GraphQL 인트로스펙션',
  'workbench.editors.graphql.schema.source.spec': '연결된 GraphQL 사양',
  'workbench.editors.graphql.schema.refresh': '새로 고침',
  'workbench.editors.graphql.schema.fetchedAt': '{when}에 인트로스펙션함',
  'workbench.editors.graphql.schema.notIntrospected':
    '아직 인트로스펙션하지 않았습니다. 스키마는 이 요청의 인증, 헤더, 설정을 통해 엔드포인트에서 불러옵니다.',
  'workbench.editors.graphql.schema.introspectFailed': '인트로스펙션 실패: {message}',
  'workbench.editors.graphql.schema.noSpecLinked': '연결된 GraphQL 사양이 없습니다.',
  'workbench.editors.graphql.schema.linkInSpecTab': '사양 탭에서 연결',
  'workbench.editors.graphql.schema.changeInSpecTab': '사양 탭에서 변경',
  'workbench.editors.graphql.schema.specMissing': '연결된 사양이 이 워크스페이스에 더 이상 없습니다.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { other: '유형 {count}개' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '스키마 문제 {count}건' }),
  'workbench.editors.graphql.schema.importReadFailed': '파일을 읽지 못했습니다: {message}',
  'workbench.editors.graphql.schema.importFailed': '스키마를 가져오지 못했습니다',
  'workbench.editors.graphql.schema.imported': '“{name}”을 GraphQL 사양으로 가져와 연결했습니다.',
  'workbench.editors.graphql.spec.selectLabel': 'GraphQL 사양',
  'workbench.editors.graphql.spec.selectPlaceholder': 'GraphQL 사양 연결…',
  'workbench.editors.graphql.spec.none': '이 요청에 연결된 GraphQL 사양이 없습니다.',
  'workbench.editors.graphql.spec.hint':
    '연결된 사양이 이 요청의 스키마 소스입니다. 탐색기, 자동 완성, 유효성 검사가 이를 읽습니다. 사양으로 생성된 컬렉션 안에서는 요청이 자체 연결을 만들기 전까지 컬렉션의 연결을 읽습니다.',
  'workbench.editors.graphql.explorer.title': '스키마 탐색기',
  'workbench.editors.graphql.explorer.hide': '탐색기 숨기기',
  'workbench.editors.graphql.explorer.show': '탐색기 표시',
  'workbench.editors.graphql.explorer.showDescriptions': '설명 표시',
  'workbench.editors.graphql.explorer.hideDescriptions': '설명 숨기기',
  'workbench.editors.graphql.builder.broken': '빌더를 사용하려면 문서를 고치세요. 파싱되지 않습니다.',
  'workbench.editors.graphql.builder.expand': '펼치기',
  'workbench.editors.graphql.builder.collapse': '접기',
  'workbench.editors.graphql.builder.fragmentReadOnly': '프래그먼트는 여기서 읽기 전용입니다. 문서에서 편집하세요.',
  'workbench.editors.graphql.builder.argumentPlaceholder': '값 또는 $variable',
  'workbench.editors.graphql.builder.invalidValue': 'GraphQL 값이 아닙니다.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { other: '문제 {count}건' }),
  // ── Subscriptions (graphql-transport-ws over the WebSocket plane) ──
  'workbench.editors.graphql.subscription.tooltip':
    '구독합니다. WebSocket 연결 (graphql-transport-ws)로 구독을 열고 이벤트를 스트리밍합니다',
  'workbench.editors.graphql.subscription.stopTooltip': '구독을 중지합니다. complete 메시지를 보내고 세션을 닫습니다',
  'workbench.editors.graphql.subscription.openFailed': '구독을 열지 못했습니다',
  'workbench.editors.graphql.subscription.paneTitle': 'Subscription',
  'workbench.editors.graphql.subscription.subscribing': '구독 중…',
  'workbench.editors.graphql.subscription.subscribed': '구독됨',
  'workbench.editors.graphql.subscription.completed': '완료됨',
  'workbench.editors.graphql.subscription.stopped': '중지됨',
  'workbench.editors.graphql.subscription.errored': '오류',
  'workbench.editors.graphql.subscription.closed': '닫힘 {code}',
  'workbench.editors.graphql.subscription.events': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이벤트 {count}건' }),
  'workbench.editors.graphql.subscription.errorsSummary':
    '구독이 errors[] 목록으로 응답했습니다. 이벤트에서 필드가 실패했거나, 작업이 시작 전에 거부되었습니다.',
  'workbench.editors.graphql.subscription.close.badRequest': '잘못된 요청',
  'workbench.editors.graphql.subscription.close.unauthorized': '인증되지 않음',
  'workbench.editors.graphql.subscription.close.forbidden': '금지됨',
  'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable': '하위 프로토콜을 수락할 수 없음',
  'workbench.editors.graphql.subscription.close.connectionInitTimeout': '연결 초기화 시간 초과',
  'workbench.editors.graphql.subscription.close.subscriberAlreadyExists': '구독자가 이미 있음',
  'workbench.editors.graphql.subscription.close.tooManyInitRequests': '초기화 요청이 너무 많음',
} as const satisfies Catalog;
