/**
 * Workbench editors — the API spec editor — Korean. Mirrors
 * `catalogs/en/workbench-editors-spec.ts` key for key. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto `package` /
 * `import` / `service` / `message` / `enum`) and ride raw; `Files` is
 * app grouping and translates (파일). The AsyncAPI Send/Receive badges
 * mirror the document's `action` enum and stay raw — a different
 * referent from the Send button mint 전송. `ROOT` badge raw; `baseUrl`
 * verbatim as a bare variable name (never compounded). Field chips
 * translate per the de/es parity lock (이름 / 설명 / 헤더 / 매개변수 /
 * 본문) with `auth` riding raw as the code-ish field id. 사양 = spec;
 * 컬렉션 = collection; 개요 = the Overview pane title (the outline).
 * MINTS: streaming modes 단항 / 서버 스트리밍 / 클라이언트 스트리밍 /
 * 양방향 스트리밍 — editors-grpc ko reuses; Root 파일 = Root file (Root
 * raw, half-width space); 동기화됨 = in sync; 차이 = the drift /
 * differences.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': '사양을 찾을 수 없습니다.',
  'workbench.editors.spec.deletedElsewhere': '이 사양은 다른 세션에서 삭제되었습니다.',
  'workbench.editors.spec.saveFailed': '사양을 저장할 수 없습니다.',
  'workbench.editors.spec.validation.clean': '문제 없음',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { other: '오류 {count}건' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { other: '경고 {count}건' }),
  'workbench.editors.spec.outline.title': '개요',
  'workbench.editors.spec.outline.show': '개요 표시',
  'workbench.editors.spec.outline.hide': '개요 숨기기',
  'workbench.editors.spec.outline.empty': '문서가 파싱되면 개요가 나타납니다.',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Root 파일로 지정',
  'workbench.editors.spec.outline.fileMenuAria': '파일 작업',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.query': 'Query',
  'workbench.editors.spec.outline.groups.mutation': 'Mutation',
  'workbench.editors.spec.outline.groups.subscription': 'Subscription',
  'workbench.editors.spec.outline.groups.types': 'Types',
  'workbench.editors.spec.outline.groups.interfaces': 'Interfaces',
  'workbench.editors.spec.outline.groups.unions': 'Unions',
  'workbench.editors.spec.outline.groups.inputs': 'Inputs',
  'workbench.editors.spec.outline.groups.scalars': 'Scalars',
  'workbench.editors.spec.outline.groups.directives': 'Directives',
  'workbench.editors.spec.outline.groups.files': '파일',
  'workbench.editors.spec.outline.streaming.unary': '단항',
  'workbench.editors.spec.outline.streaming.server': '서버 스트리밍',
  'workbench.editors.spec.outline.streaming.client': '클라이언트 스트리밍',
  'workbench.editors.spec.outline.streaming.bidi': '양방향 스트리밍',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': '서버 추가',
  'workbench.editors.spec.outline.add.tag': '태그 추가',
  'workbench.editors.spec.outline.add.path': '경로 추가',
  'workbench.editors.spec.outline.add.operation': '작업 추가',
  'workbench.editors.spec.outline.add.schema': '스키마 추가',
  'workbench.editors.spec.outline.add.securityScheme': '보안 스킴 추가',
  'workbench.editors.spec.outline.add.securityRequirement': '보안 요구 사항 추가',
  'workbench.editors.spec.generate.button': '컬렉션 생성',
  'workbench.editors.spec.generate.collectionsButton': '컬렉션',
  'workbench.editors.spec.generate.popoverTitle': '생성된 컬렉션',
  'workbench.editors.spec.generate.modalTitle': '컬렉션 생성',
  'workbench.editors.spec.generate.blurb':
    '이 사양에서 컬렉션을 생성합니다. 작업은 baseUrl 컬렉션 변수 아래의 요청이 되고, 태그는 폴더가 되며, 보안 스킴은 인증에 대응됩니다. 컬렉션은 이 사양에 연결된 채로 유지됩니다.',
  'workbench.editors.spec.generate.namePlaceholder': '컬렉션 이름',
  'workbench.editors.spec.generate.nameRequired': '컬렉션에는 이름이 필요합니다',
  'workbench.editors.spec.generate.dirtyHint':
    '저장하지 않은 편집기 변경은 포함되지 않습니다. 생성은 마지막으로 저장한 문서를 사용합니다.',
  'workbench.editors.spec.generate.parseFailed': '이 사양은 파싱되지 않습니다',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '요청 {count}개' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '폴더 {count}개' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '컬렉션 변수 {count}개' }),
  'workbench.editors.spec.generate.action': '생성',
  'workbench.editors.spec.generate.success': '"{name}" 생성됨: {summary}',
  'workbench.editors.spec.generate.failed': '컬렉션을 만들 수 없습니다.',
  'workbench.editors.spec.generate.linkFailed':
    '컬렉션은 생성되었지만 사양 연결을 기록하지 못했습니다. 이 목록에는 나타나지 않습니다.',
  'workbench.editors.spec.generateProto.blurb':
    '이 사양에서 컬렉션을 생성합니다. 서비스 메서드는 예시 메시지가 미리 채워진 gRPC 요청이 되며, 서비스마다 폴더 하나로 묶입니다. 컬렉션은 이 사양에 연결된 채로 유지됩니다.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'gRPC 요청 {count}개' }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '서비스 {count}개' }),
  'workbench.editors.spec.generateProto.empty': '문서에 생성할 서비스 메서드가 선언되어 있지 않습니다.',
  'workbench.editors.spec.generateProto.partial': '일부만 생성되었습니다. {created}개 생성, {failed}개 실패.',
  'workbench.editors.spec.generateWs.blurb':
    '이 사양에서 컬렉션을 생성합니다. 작업은 문서의 ws/wss 서버를 대상으로 하는 WebSocket 요청 또는 mqtt 서버를 대상으로 하는 MQTT 요청이 되며, 채널 스키마에서 예시 메시지가 미리 채워집니다. 컬렉션은 이 사양에 연결된 채로 유지됩니다.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'WebSocket 요청 {count}개' }),
  'workbench.editors.spec.generateWs.mqttRequestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'MQTT 요청 {count}개' }),
  'workbench.editors.spec.generateWs.empty': '문서에 생성할 작업이 선언되어 있지 않습니다.',
  'workbench.editors.spec.generateWs.noServer': '문서에 연결할 ws, wss 또는 mqtt 서버가 선언되어 있지 않습니다.',
  'workbench.editors.spec.generateWs.partial': '일부만 생성되었습니다. {created}개 생성, {failed}개 실패.',
  'workbench.editors.spec.generateWs.skipped': '{operation} 건너뜀: {reason}.',
  'workbench.editors.spec.generateGraphql.blurb':
    '이 스키마에서 컬렉션을 생성합니다. Query 및 Mutation 루트 필드는 문서와 예시 변수가 미리 채워진 GraphQL 요청이 되며, 둘 다 있으면 루트 유형마다 폴더 하나로 묶입니다. subscription 필드는 제외됩니다. 컬렉션은 이 사양에 연결된 채로 유지됩니다.',
  'workbench.editors.spec.generateGraphql.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'GraphQL 요청 {count}개' }),
  'workbench.editors.spec.generateGraphql.empty': '스키마에 생성할 Query 또는 Mutation 필드가 선언되어 있지 않습니다.',
  'workbench.editors.spec.generateGraphql.partial': '일부만 생성되었습니다. {created}개 생성, {failed}개 실패.',
  'workbench.editors.spec.generateGraphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.spec.generateGraphql.urlHint':
    '생성된 모든 요청이 이 엔드포인트를 대상으로 합니다. 비워 두면 URL 주소를 나중에 채울 수 있습니다.',
  'workbench.editors.spec.generateGraphql.subscriptionsSkipped': ({ count, fields }, locale) =>
    `${plural(locale, Number(count), {
      other: 'subscription 필드 {count}개 제외됨',
    })} (${fields}). 구독은 지원되지 않습니다.`,
  'workbench.editors.spec.generateGraphql.problem': '스키마 문제: {message}',
  'workbench.editors.spec.update.button': '업데이트',
  'workbench.editors.spec.update.protoUnavailable':
    'Protobuf 사양에서 업데이트하는 기능은 아직 없습니다. 변경 사항을 반영하려면 새 컬렉션을 생성하세요.',
  'workbench.editors.spec.update.graphqlUnavailable':
    'GraphQL 스키마에서 업데이트하는 기능은 아직 없습니다. 변경 사항을 반영하려면 새 컬렉션을 생성하세요.',
  'workbench.editors.spec.update.inSyncBadge': '저장된 문서와 동기화됨',
  'workbench.editors.spec.update.driftedBadge': '마지막 업데이트 이후 사양이 변경되었습니다',
  'workbench.editors.spec.update.modalTitle': '컬렉션 업데이트',
  'workbench.editors.spec.update.blurb':
    '저장된 문서와 "{name}" 사이의 차이를 검토한 다음 선택한 업데이트를 적용하세요. 선택하지 않은 행은 그대로 둡니다.',
  'workbench.editors.spec.update.dirtyHint':
    '저장하지 않은 편집기 변경은 포함되지 않습니다. 업데이트는 마지막으로 저장한 문서를 사용합니다.',
  'workbench.editors.spec.update.parseFailed': '이 사양은 파싱되지 않습니다',
  'workbench.editors.spec.update.inSync':
    '요청 수준의 차이가 없습니다. 적용하면 컬렉션이 저장된 문서와 동기화된 것으로 표시됩니다.',
  'workbench.editors.spec.update.groupAdded': '추가됨 ({count})',
  'workbench.editors.spec.update.groupChanged': '변경됨 ({count})',
  'workbench.editors.spec.update.groupRemoved': '사양에서 제거됨 ({count})',
  'workbench.editors.spec.update.removeHint': '선택하지 않은 요청은 컬렉션에 남습니다.',
  'workbench.editors.spec.update.groupCollection': '컬렉션',
  'workbench.editors.spec.update.variablesRow': '컬렉션 변수',
  'workbench.editors.spec.update.authRow': '컬렉션 인증',
  'workbench.editors.spec.update.field.name': '이름',
  'workbench.editors.spec.update.field.description': '설명',
  'workbench.editors.spec.update.field.headers': '헤더',
  'workbench.editors.spec.update.field.params': '매개변수',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': '본문',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), { other: '업데이트 {count}개 적용' }),
  'workbench.editors.spec.update.markInSync': '동기화됨으로 표시',
  'workbench.editors.spec.update.hashNote':
    '적용하면 이 문서 버전이 컬렉션 연결에 기록되므로, 행을 선택하지 않았더라도 연결은 동기화된 것으로 읽힙니다.',
  'workbench.editors.spec.update.success': '"{name}" 업데이트됨: {count}개 적용',
  'workbench.editors.spec.update.partial':
    '{applied}개 적용, {failed}개 실패. 컬렉션이 부분적으로만 업데이트되었을 수 있습니다.',
  'workbench.editors.spec.update.failed': '컬렉션을 업데이트할 수 없습니다.',
} as const satisfies Catalog;
