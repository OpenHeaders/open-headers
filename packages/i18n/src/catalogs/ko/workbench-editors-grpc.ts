/**
 * Workbench editors — gRPC client + gRPC response examples — Korean.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key. Raw by
 * design: gRPC status-code names (OK, CANCELLED, …) with their
 * lead-ins rendered as 상태 코드 N NAME, rpc/service identifiers
 * ({rpc}), Protobuf / `.proto` / TLS / SSL / lowercase `base64`
 * vocabulary, `host:port` and `authorization: Bearer <token>` wire
 * syntax, `Metadata` / `Trailers` tab nouns kept as the gRPC protocol
 * terms, `Docs` / `Streaming` / `Authority` raw, and the {count} /
 * {ms} / {bytes} / {name} / {message} holes. Settings tab = 설정;
 * 타임라인 = timeline; 프레임 = frame; streaming modes reuse the
 * editors-spec mints (단항 / 스트리밍); 인가 / 헤더 family tab nouns per
 * editors-websocket; the TLS scalar twins (SNI 서버 이름 / 클라이언트
 * 인증서 / Unix 소켓) per shared-conflicts. MINTS: 호출 = invoke / the
 * call; 상한 = capped at (byte cap, carried); 킵얼라이브 = keepalive;
 * 데드라인 = deadline; 인증서 신뢰 = trust certificate. Every raw token
 * takes a head noun before a particle (TLS 모드를, HTTP/2 PING 프레임을,
 * JSON 형식이).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'gRPC 요청을 찾을 수 없습니다.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (예: grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS 켜짐. 클릭하면 평문으로 전환',
  'workbench.editors.grpc.tls.off': 'TLS 꺼짐 (평문). 클릭하면 TLS 모드로 전환',
  'workbench.editors.grpc.method.placeholder': '메서드 선택',
  'workbench.editors.grpc.method.noSpecPlaceholder': '메서드를 고르려면 Protobuf 사양을 연결하세요',
  'workbench.editors.grpc.method.unresolvedGroup': '연결된 사양에 없음',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (미해결)',
  'workbench.editors.grpc.method.linkGroup': 'Protobuf 사양 연결',
  'workbench.editors.grpc.method.importProto': '.proto 파일 가져오기…',
  'workbench.editors.grpc.invoke.label': '호출',
  'workbench.editors.grpc.invoke.stop': '중지',
  'workbench.editors.grpc.invoke.needsMethod': '호출하려면 연결된 사양에서 해결되는 메서드를 고르세요',
  'workbench.editors.grpc.invoke.needsUrl': '호출하려면 대상 호스트를 입력하세요',
  'workbench.editors.grpc.invoke.failed': '호출 실패. 호스트가 호출에 응답하지 않았습니다',
  'workbench.editors.grpc.response.title': '응답',
  'workbench.editors.grpc.response.empty.prompt': '메서드를 호출하면 응답을 받습니다.',
  'workbench.editors.grpc.response.empty.invoking': '호출 중…',
  'workbench.editors.grpc.status.kicker': 'gRPC 상태',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, verbatim, so the pill popover reads exactly like the
  // protocol documentation.
  'workbench.editors.grpc.status.desc.unknownCode': 'gRPC 어휘에 없는 비표준 상태 코드입니다.',
  'workbench.editors.grpc.status.desc.OK': '상태 코드 0 OK는 gRPC 메서드 호출에 성공했을 때의 표준 응답입니다.',
  'workbench.editors.grpc.status.desc.CANCELLED': '상태 코드 1 CANCELLED는 호출자가 작업을 취소한 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    '상태 코드 2 UNKNOWN은 알 수 없는 오류로 작업을 완료할 수 없을 때 반환됩니다. 예를 들어 다른 주소 공간에서 받은 Status 값이 이 주소 공간에서 알려지지 않은 오류 공간에 속할 때 이 오류가 반환될 수 있습니다. 또한 충분한 오류 정보를 반환하지 않는 API 기능이 일으킨 오류도 이 오류로 변환될 수 있습니다.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    '상태 코드 3 INVALID_ARGUMENT는 클라이언트가 잘못된 인수를 지정한 경우 반환됩니다. 시스템 상태와 무관하게 문제가 있는 인수를 뜻합니다 (예: 잘못된 형식의 파일 이름).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    '상태 코드 4 DEADLINE_EXCEEDED는 작업을 완료하기 전에 데드라인이 만료된 경우 반환됩니다. 시스템 상태를 바꾸는 작업에서는 작업이 성공적으로 완료되었더라도 이 오류가 반환될 수 있습니다. 예를 들어 서버의 성공 응답이 오래 지연되었을 수 있습니다.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    '상태 코드 5 NOT_FOUND는 요청한 엔터티 (예: 파일 또는 디렉터리)를 찾을 수 없는 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    '상태 코드 6 ALREADY_EXISTS는 만들려는 엔터티 (예: 파일 또는 디렉터리)가 이미 있는 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    '상태 코드 7 PERMISSION_DENIED는 호출자에게 지정한 작업을 실행할 권한이 없는 경우 반환됩니다. 이 오류 코드는 요청이 유효하다거나, 요청한 엔터티가 존재한다거나, 다른 사전 조건을 충족한다는 뜻이 아닙니다.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    '상태 코드 8 RESOURCE_EXHAUSTED는 사용자별 할당량이 소진되었거나 파일 시스템 전체에 공간이 없는 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    '상태 코드 9 FAILED_PRECONDITION은 시스템이 작업 실행에 필요한 상태가 아니어서 작업이 거부된 경우 반환됩니다. 예를 들어 삭제할 디렉터리가 비어 있지 않거나, rmdir 작업이 디렉터리가 아닌 대상에 적용된 경우 등입니다.',
  'workbench.editors.grpc.status.desc.ABORTED':
    '상태 코드 10 ABORTED는 작업이 중단된 경우 반환되며, 보통 시퀀서 검사 실패나 트랜잭션 중단 같은 동시성 문제가 원인입니다.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    '상태 코드 11 OUT_OF_RANGE는 유효 범위를 벗어난 작업을 시도한 경우 반환됩니다. 예를 들어 파일 끝을 지나 탐색하거나 읽는 경우입니다.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    '상태 코드 12 UNIMPLEMENTED는 작업이 구현되지 않았거나 이 서비스에서 지원 / 활성화되지 않은 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    '상태 코드 13 INTERNAL은 내부 오류가 있는 경우 반환됩니다. 기반 시스템이 기대하는 불변 조건이 깨졌다는 뜻입니다.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    '상태 코드 14 UNAVAILABLE은 서비스를 현재 사용할 수 없는 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    '상태 코드 15 DATA_LOSS는 복구할 수 없는 데이터 손실이나 손상이 있는 경우 반환됩니다.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    '상태 코드 16 UNAUTHENTICATED는 요청에 작업에 필요한 유효한 인증 자격 증명이 없는 경우 반환됩니다.',
  'workbench.editors.grpc.response.error.title': '호출 실패',
  'workbench.editors.grpc.response.error.localGuidance':
    '호출이 응답에 도달하지 못했습니다. 대상, TLS 모드, 서버에 연결할 수 있는지 확인하세요.',
  'workbench.editors.grpc.response.error.statusGuidance': '메시지를 확인하고 메서드를 다시 호출하세요.',
  'workbench.editors.grpc.response.tab.response': '응답',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': '메타데이터 필터',
  'workbench.editors.grpc.response.filterTrailers': '트레일러 필터',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'gRPC 상태 없음',
  'workbench.editors.grpc.response.connectionLost': '연결 끊김',
  'workbench.editors.grpc.response.includeDefaultValues': '기본값 포함',
  'workbench.editors.grpc.response.noMessage': '응답에 응답 메시지가 없었습니다.',
  'workbench.editors.grpc.response.noMetadata': '메타데이터 없음',
  'workbench.editors.grpc.response.noTrailers': '트레일러 없음',
  'workbench.editors.grpc.response.trailersOnly':
    '트레일러 전용 응답입니다. 상태가 초기 메타데이터와 함께 도착했고 메시지는 뒤따르지 않았습니다.',
  'workbench.editors.grpc.response.compressed':
    '응답 프레임이 압축되어 있습니다. 압축이 협상되지 않았으므로 디코딩할 수 없습니다.',
  'workbench.editors.grpc.response.structuralNotice':
    '구조 디코딩 (필드 번호)입니다. 응답 유형이 연결된 사양에서 해결되지 않았습니다.',
  'workbench.editors.grpc.response.rawNotice':
    '메시지를 디코딩하지 못했습니다. 원시 바이트를 base64 형식으로 표시합니다.',
  'workbench.editors.grpc.response.extraFrames':
    '메시지 프레임 {count}개가 도착했습니다. 단항 응답은 하나만 실으므로 첫 번째를 표시합니다.',
  'workbench.editors.grpc.response.incompleteTail': '응답이 프레임 중간에 끝났습니다. 완전한 프레임만 표시합니다.',
  'workbench.editors.grpc.response.truncated': '응답이 {bytes}바이트에서 상한에 걸렸습니다.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': '메시지',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.scripts': '스크립트',
  'workbench.editors.grpc.tab.settings': '설정',
  'workbench.editors.grpc.messagePlaceholder': 'JSON 형식의 요청 메시지',
  'workbench.editors.grpc.example.label': '예시 메시지 사용',
  'workbench.editors.grpc.example.needsMethod': '먼저 연결된 사양에서 해결되는 메서드를 고르세요',
  'workbench.editors.grpc.metadata.keyPlaceholder': '키',
  'workbench.editors.grpc.metadata.valuePlaceholder': '값',
  'workbench.editors.grpc.spec.selectLabel': 'Protobuf 사양',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Protobuf 사양 연결…',
  'workbench.editors.grpc.spec.summary': '서비스 {services}개 · 메서드 {methods}개',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': '파일을 읽지 못했습니다: {message}',
  'workbench.editors.grpc.spec.importFailed': '.proto 파일을 가져오지 못했습니다',
  'workbench.editors.grpc.method.usingSpec': '{name} 사용 중',
  'workbench.editors.grpc.method.refreshSpec': '사양의 현재 파일에서 다시 빌드',
  'workbench.editors.grpc.settings.exampleCaption': '예시 호출',
  'workbench.editors.grpc.settings.group.connection': '연결',
  'workbench.editors.grpc.settings.group.tls': 'TLS 및 신뢰',
  'workbench.editors.grpc.settings.group.messages': '메시지',
  'workbench.editors.grpc.settings.groupInfo.connection':
    '호출이 서버에 도달하는 방식입니다. 채널이 다이얼하는 곳, 호출의 수신 이름, 호출 전체의 상한, 호출 중 죽은 연결을 잡아내는 킵얼라이브.',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'TLS 채널이 신뢰를 수립하는 방식입니다. 서버 인증서를 시스템 루트로 검증할지, 이 기기가 제시하는 클라이언트 인증서, 핸드셰이크의 TLS 버전 범위와 암호 목록, 제시하는 SNI 이름.',
  'workbench.editors.grpc.settings.groupInfo.messages':
    '워크벤치가 파싱되지 않는 메시지를 다루는 방식입니다. API 요청 설정과 공유하는 앱 전체의 태도이며, 요청별 필드가 아닙니다.',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Unix 소켓',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'TCP 연결을 여는 대신 이 로컬 소켓으로 다이얼합니다. 절대 Unix 소켓 경로 또는 \\\\.\\pipe\\name 같은 Windows 명명된 파이프입니다. :authority 헤더, TLS 서버 이름, 인증서 검증은 계속 대상이 결정하며, 연결이 가는 곳만 바뀝니다. 일반 TCP 연결이면 비워 두세요.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'TCP 연결 (기본값)',
  'workbench.editors.grpc.settings.timeoutLabel': '호출 시간 제한',
  'workbench.editors.grpc.settings.timeoutHelp':
    '호출 전체의 실제 시간 상한입니다. 서버가 강제할 수 있도록 gRPC 데드라인으로 보내며, 로컬에서도 강제합니다. 비우면 데드라인이 없습니다.',
  'workbench.editors.grpc.settings.timeoutPlaceholder': '제한 없음 (기본값)',
  'workbench.editors.grpc.settings.authorityLabel': 'Authority',
  'workbench.editors.grpc.settings.authorityHelp':
    '연결은 계속 대상으로 가면서, 전송선에서 호출이 수신되는 :authority 값, 즉 서버가 라우팅하는 이름입니다. authority 값으로 라우팅하는 게이트웨이나, IP 주소로 접근하지만 자기 이름을 기대하는 서버용입니다. TLS 서버 이름과 인증서 검증은 대상의 호스트를 유지하며, SNI 서버 이름 설정이 그것을 바꿉니다. 비우면 대상 자체를 보냅니다.',
  'workbench.editors.grpc.settings.authorityPlaceholder': '대상 (기본값)',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': '킵얼라이브 핑',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    '호출이 열려 있는 동안 이 주기로 HTTP/2 PING 프레임을 보내, 조용한 서버 스트림이나 느린 단항 호출이 데드라인을 기다리는 대신 죽은 연결을 알아채게 합니다. 연결마다 호출 하나를 처리하므로 호출 사이에 살려 둘 것은 없습니다. 서버는 자기 하한 (기본값은 데이터 흐름 없이 5분)보다 빨리 오는 핑을 too_many_pings 사유로 연결을 닫아 거부하며, 호출이 그 사유를 표시합니다. 핑을 보내지 않으려면 비워 두세요.',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': '핑 없음 (기본값)',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': '킵얼라이브 시간 제한',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    '연결이 죽은 것으로 선언되고 호출이 그 사유로 끝나기 전까지 핑의 확인 응답을 기다리는 시간입니다. 비우면 기본값 20 s입니다.',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 s (기본값)',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': '잘못된 메시지 보내기',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    '메시지가 유효한 JSON 형식이 아닐 때도 빈 메시지로 호출하고 서버가 응답하게 합니다 (보통 INVALID_ARGUMENT). 기본값은 꺼짐입니다. 호출이 전송선에 닿기 전에 정확한 파싱 오류와 함께 실패합니다. 모든 gRPC 요청에 적용됩니다.',
  'workbench.editors.grpc.tab.auth': '인가',
  'workbench.editors.grpc.auth.help':
    '호출의 authorization: Bearer <token> 메타데이터로 전송됩니다. 명시적인 authorization 메타데이터 행이 우선합니다.',
  'workbench.editors.grpc.auth.inheritUnsupported': '{type} ({source}에서 상속)은 gRPC 호출에 적용할 수 없습니다.',
  'workbench.editors.grpc.auth.helpOwn':
    '호출마다 한 번 발급되어 authorization (또는 키 자체의 이름) 메타데이터로 호출에 전송됩니다. 쿼리 배치는 gRPC 호출에 실리지 않습니다. 같은 이름의 명시적 메타데이터 행이 우선합니다.',
  'workbench.editors.grpc.auth.ownUnsupported': '{type} 방식은 gRPC 호출에 적용할 수 없습니다.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': '중지됨',
  'workbench.editors.grpc.stream.tab.timeline': '타임라인',
  'workbench.editors.grpc.stream.trailersPending': '트레일러는 호출이 완료될 때 도착합니다.',
  'workbench.editors.grpc.stream.sendMessage': '메시지 보내기',
  'workbench.editors.grpc.stream.endStreaming': '스트리밍 종료',
  'workbench.editors.grpc.stream.controlsIdle': '먼저 호출하여 스트림을 여세요',
  'workbench.editors.grpc.stream.sendFailed': '메시지를 보내지 못했습니다',
  'workbench.editors.grpc.timeline.requestSent': '요청 전송됨',
  'workbench.editors.grpc.timeline.noMetadataSent': '보낸 메타데이터가 없습니다.',
  // {metadata} marks where the linked word (receivedMetadataLink)
  // renders — the display splits on it, so word order stays free.
  'workbench.editors.grpc.timeline.receivedMetadata': '{metadata} 항목을 받았습니다.',
  'workbench.editors.grpc.timeline.receivedMetadataLink': '메타데이터',
  'workbench.editors.grpc.timeline.noMetadataReceived': '받은 메타데이터가 없습니다.',
  'workbench.editors.grpc.timeline.responseReceived': '응답 수신됨',
  'workbench.editors.grpc.timeline.completed': '호출 완료됨',
  'workbench.editors.grpc.timeline.stopped': '호출 중지됨',
  'workbench.editors.grpc.timeline.failed': '호출 실패',
  'workbench.editors.grpc.timeline.lost': '연결 끊김',
  'workbench.editors.grpc.timeline.noMatches': '일치하는 메시지가 없습니다.',
  'workbench.editors.grpc.timeline.searchMessages': '메시지 검색',
  'workbench.editors.grpc.timeline.filterAll': '모두',
  'workbench.editors.grpc.timeline.filterSent': '보냄',
  'workbench.editors.grpc.timeline.filterReceived': '받음',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '메시지 {count}개' }),
  'workbench.editors.grpc.timeline.sortOrder': '정렬 및 그룹화',
  'workbench.editors.grpc.timeline.newestFirst': '최신순',
  'workbench.editors.grpc.timeline.oldestFirst': '오래된순',
  'workbench.editors.grpc.timeline.showTypes': '메시지 유형 표시',
  'workbench.editors.grpc.timeline.groupByType': '메시지 유형별 그룹화',
  'workbench.editors.grpc.timeline.groupByDirection': '방향별 그룹화',
  'workbench.editors.grpc.timeline.rowsPerGroup': '그룹당 행 수',
  'workbench.editors.grpc.timeline.noLimit': '제한 없음',
  'workbench.editors.grpc.timeline.clearMessages': '메시지 지우기 (표시만)',
  'workbench.editors.grpc.timeline.trustCertificate': '인증서 신뢰',
  'workbench.editors.grpc.timeline.newMessages': '새 메시지',
  'workbench.editors.grpc.timeline.sentAria': '보낸 메시지',
  'workbench.editors.grpc.timeline.receivedAria': '받은 메시지',
  'workbench.editors.grpc.timeline.script': '{hook} — {levels}',
  'workbench.editors.grpc.timeline.scriptFailed': '{hook} 실패 — {error}',
  // ── The call's scripts — the result panes' Scripts tab and tag ──────
  'workbench.editors.grpc.response.tab.scripts': '스크립트',
  'workbench.editors.grpc.scripts.empty': '이 호출에서 실행된 스크립트가 없습니다.',
  'workbench.editors.grpc.scripts.console': '콘솔',
  'workbench.editors.grpc.scripts.tests': 'Tests',
  'workbench.editors.grpc.scripts.consoleEmpty': '기록된 로그가 없습니다.',
  'workbench.editors.grpc.scripts.testsEmpty': '등록된 단언이 없습니다.',
  'workbench.editors.grpc.scripts.attempt': '시도 {attempt}',
  'workbench.editors.grpc.scripts.atMessage': '메시지 {index}',
  'workbench.editors.grpc.scripts.tag': '스크립트 · {count}',
  'workbench.editors.grpc.scripts.tagTitle': '호출 스크립트',
  'workbench.editors.grpc.scripts.tagSummary': '이 호출에서 실행된 훅과 기여한 수준입니다.',
  'workbench.editors.grpc.scripts.tagSummaryFailed': '훅이 실패했습니다. 마지막 오류가 아래에 나열됩니다.',
  'workbench.editors.grpc.scripts.runs': '{count}회 실행',
  'workbench.editors.grpc.scripts.runsOne': '1회 실행',
  'workbench.editors.grpc.scripts.failed': '{count}건 실패',
  'workbench.editors.grpc.scripts.dropped': '{count}건 폐기',
  'workbench.editors.grpc.scripts.marksCapped':
    '메시지별 세부 정보는 {count}회 실행 후 중단되었습니다. 훅은 계속 실행되며 호출이 정리되면 전체 집계가 반영됩니다.',
  'workbench.editors.grpc.toast.deletedOtherTab': 'gRPC 요청이 다른 탭에서 삭제되었습니다',
  'workbench.editors.grpc.toast.updateFailed': 'gRPC 요청을 업데이트하지 못했습니다',
  'workbench.editors.grpc.toast.updateFailedDetail': 'gRPC 요청을 업데이트하지 못했습니다: {message}',
  'workbench.editors.grpc.response.saveResponse': '응답 저장',
  'workbench.editors.grpc.toast.savedExample': '예시 "{name}"을 저장했습니다',
  'workbench.editors.grpc.toast.saveExampleFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': '예시를 저장하지 못했습니다: {message}',
  'workbench.editors.grpcExample.loading': '예시를 불러오는 중…',
  'workbench.editors.grpcExample.notFound': '예시를 찾을 수 없습니다.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': '예시가 다른 탭에서 삭제되었습니다',
  'workbench.editors.grpcExample.toast.saveFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.grpcExample.toast.saveFailedDetail': '예시를 저장하지 못했습니다: {message}',
  'workbench.editors.grpcExample.openInRequest': '요청에서 열기',
  'workbench.editors.grpcExample.openInRequestTooltip':
    '이 예시의 캡처된 호출을 상위 gRPC 요청의 편집기에 저장하지 않은 편집으로 복사합니다',
  'workbench.editors.grpcExample.noMethod': '기록된 메서드 없음',
  'workbench.editors.grpcExample.capturedTooltip': '{date}에 캡처됨',
  'workbench.editors.grpcExample.result.title': '캡처된 응답',
} as const satisfies Catalog;
