/**
 * Workbench editors — the WebSocket client editor — Korean. Mirrors
 * `catalogs/en/workbench-editors-websocket.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: ws/wss schemes,
 * subprotocol identifiers, AsyncAPI, Socket.IO / CONNECT / engine.io
 * tokens, the sio decoded rows (verbatim wire), `Arg`, Bearer / token,
 * long-polling, `Ack`. The Params tab and Docs tab ride raw
 * (tab.params / Docs law); Settings tab = 설정; spec-browser section
 * headers mirror AsyncAPI document keywords and ride raw (spec outline
 * law) while prose says 채널 / 작업 (editors-spec donor). 프레임 =
 * frame; 핸드셰이크 = handshake; 세션 = session; 타임라인 = timeline;
 * 캡처 = capture; 인가 = the Authorization tab; 헤더 = Headers tab;
 * 페이로드 = payload. MINTS: 하위 프로토콜 = subprotocol (carried from
 * shared-info-headers); 수신 대기 = the Listen column; 확인 응답 = ack
 * (prose; the sio row `ack` stays verbatim wire); 이벤트 = the Events
 * tab noun; 이름 공간 = namespace (carried from workbench-chrome);
 * 하트비트 = heartbeat; 유휴 = idle — future editors-request ko reuses
 * 인가 / 헤더 / Params for its twin tabs. Every raw token takes a head
 * noun before a particle (Socket.IO 세션이, engine.io 핸드셰이크가, Ack
 * 옵션으로, URL 주소를).
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'WebSocket 요청을 찾을 수 없습니다.',
  'workbench.editors.websocket.connect.label': '연결',
  'workbench.editors.websocket.connect.disconnect': '연결 해제',
  'workbench.editors.websocket.connect.cancel': '취소',
  'workbench.editors.websocket.connect.needsUrl': '연결하려면 ws:// 또는 wss:// URL 주소를 입력하세요.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': '메시지',
  'workbench.editors.websocket.tab.events': '이벤트',
  'workbench.editors.websocket.tab.auth': '인가',
  'workbench.editors.websocket.tab.headers': '헤더',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': '설정',
  'workbench.editors.websocket.tab.scripts': '스크립트',
  'workbench.editors.websocket.messagePlaceholder': '보낼 다음 메시지를 작성하세요…',
  'workbench.editors.websocket.messagePlaceholderBase64': '바이너리 메시지의 Base64 값 (예: aGVsbG8=)…',
  'workbench.editors.websocket.messagePlaceholderHex': '바이너리 메시지의 16진수 값 (예: 68656c6c6f)…',
  'workbench.editors.websocket.message.formatText': '텍스트',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': '바이너리',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': '16진수',
  'workbench.editors.websocket.message.invalidGate': '먼저 메시지 인코딩을 고치세요.',
  'workbench.editors.websocket.message.invalidBase64':
    '유효한 Base64 형식이 아닙니다. 디코딩된 바이트가 전송될 내용입니다.',
  'workbench.editors.websocket.message.invalidHex':
    '유효한 16진수가 아닙니다. 0-9 a-f 숫자 쌍이 전송될 바이트로 디코딩됩니다.',
  'workbench.editors.websocket.auth.helpRaw':
    '핸드셰이크의 Authorization: Bearer 헤더로 전송됩니다. 데스크톱 앱이나 서버에서 적용되며, 브라우저는 WebSocket 연결에 이 헤더를 설정할 수 없습니다. 명시적인 Authorization 헤더 행이 우선합니다.',
  'workbench.editors.websocket.auth.helpSocketio':
    '모든 호스트에서 CONNECT 패킷의 auth 페이로드 ({"token": …})로 전송되고, 데스크톱 앱이나 서버에서는 Authorization: Bearer 핸드셰이크 헤더로도 전송됩니다. 명시적인 Authorization 헤더 행이 헤더보다 우선합니다.',
  'workbench.editors.websocket.auth.inheritUnsupported':
    '{type} ({source}에서 상속)은 WebSocket 세션에 적용할 수 없습니다.',
  'workbench.editors.websocket.auth.helpOwn':
    '연결과 재연결마다 발급됩니다. 헤더는 데스크톱 앱이나 서버에서 핸드셰이크에 실리고 (브라우저는 설정할 수 없음), 쿼리 배치나 AWS 서명 URL 주소는 모든 호스트에서 다이얼 URL 주소에 실리며, Socket.IO 방식은 bearer 형태의 token 값을 CONNECT auth 페이로드로도 보냅니다. 같은 이름의 명시적 헤더 행이 우선합니다.',
  'workbench.editors.websocket.auth.ownUnsupported': '{type} 방식은 WebSocket 세션에 적용할 수 없습니다.',
  'workbench.editors.websocket.events.hint':
    '세션 타임라인에 표시할 수신 이벤트입니다. 행이 없으면 모든 이벤트를 표시하며, 캡처는 항상 모두 기록합니다.',
  'workbench.editors.websocket.events.namePlaceholder': '이벤트 이름',
  'workbench.editors.websocket.events.listenLabel': '수신 대기',
  'workbench.editors.websocket.event.namePlaceholder': '이벤트 이름',
  'workbench.editors.websocket.event.ackLabel': '확인 응답 기대',
  'workbench.editors.websocket.event.ackHelp':
    '전송마다 확인 응답 id를 발급하여 서버의 확인 응답이 타임라인에서 짝지어지게 합니다.',
  'workbench.editors.websocket.event.argsPlaceholder': 'JSON 인수 배열을 작성하세요 (예: ["hello", 42])…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': '인수 {index} 제거',
  'workbench.editors.websocket.event.argPlaceholder':
    '이 인수를 JSON 형식으로 작성하세요 (예: "hello" 또는 {"id": 42})…',
  'workbench.editors.websocket.headers.keyPlaceholder': '헤더 이름',
  'workbench.editors.websocket.headers.valuePlaceholder': '값',
  'workbench.editors.websocket.headers.hint.host':
    '연결 시 대상 URL 주소에서 도출됩니다. 업그레이드 요청의 수신 호스트입니다.',
  'workbench.editors.websocket.headers.hint.connection':
    '서버에 프로토콜 전환을 요청합니다. WebSocket 오프닝 핸드셰이크는 항상 Connection: Upgrade 헤더를 싣습니다.',
  'workbench.editors.websocket.headers.hint.upgrade':
    '전환할 프로토콜을 지정합니다. 모든 WebSocket 핸드셰이크는 HTTP 연결을 websocket 프로토콜로 업그레이드합니다.',
  'workbench.editors.websocket.headers.hint.key':
    '연결마다 생성되는 무작위 논스입니다. 서버는 그 해시를 Sec-WebSocket-Accept 헤더로 돌려보내 핸드셰이크를 읽었음을 증명합니다.',
  'workbench.editors.websocket.headers.hint.version':
    'WebSocket 프로토콜 버전 (RFC 6455)입니다. 13이 사용 중인 유일한 버전입니다.',
  'workbench.editors.websocket.headers.hint.extensions':
    '메시지별 압축을 제안합니다. 서버는 핸드셰이크 응답에서 제안을 수락, 축소 또는 무시할 수 있습니다.',
  'workbench.editors.websocket.headers.hint.origin':
    '브라우저가 모든 WebSocket 핸드셰이크에 찍는 페이지 출처입니다. 서버는 이를 보고 교차 사이트 연결을 거부합니다.',
  'workbench.editors.websocket.headers.hint.userAgent':
    '브라우저가 핸드셰이크에서 자신을 식별합니다. 페이지 코드는 바꿀 수 없습니다.',
  'workbench.editors.websocket.headers.hint.cacheControl': '브라우저가 업그레이드 요청을 캐시 불가로 표시합니다.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    '브라우저가 핸드셰이크 응답에서 받아들이는 콘텐츠 인코딩입니다.',
  'workbench.editors.websocket.headers.hint.acceptLanguage': '브라우저 설정에서 가져온 선호 언어입니다.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'node 런타임의 핸드셰이크는 모든 응답 미디어 유형을 받아들입니다.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage': 'node 런타임의 핸드셰이크는 와일드카드를 보냅니다.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode': 'node 런타임이 모든 WebSocket 핸드셰이크에 찍습니다.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'node 런타임이 핸드셰이크에서 이 앱을 식별합니다. 다른 값을 보내려면 User-Agent 행을 직접 추가하세요.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'node 런타임이 업그레이드 요청을 캐시 불가로 표시합니다.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'node 런타임이 핸드셰이크 응답에서 받아들이는 콘텐츠 인코딩입니다.',
  'workbench.editors.websocket.headers.browserNotSent':
    '전송되지 않습니다. 브라우저가 핸드셰이크 헤더를 직접 설정합니다. 사용자 지정 헤더는 세션이 데스크톱 앱이나 서버에서 실행될 때 적용됩니다.',
  'workbench.editors.websocket.spec.selectLabel': 'AsyncAPI 사양',
  'workbench.editors.websocket.spec.selectPlaceholder': 'AsyncAPI 사양 연결',
  'workbench.editors.websocket.spec.summary': '서버 {servers}개 · 채널 {channels}개 · 작업 {operations}개',
  'workbench.editors.websocket.spec.parseFailure': '사양을 파싱하지 못했습니다: {message}',
  'workbench.editors.websocket.spec.issues': '사양 문제 {count}건',
  'workbench.editors.websocket.spec.useExample': '예시 메시지 사용…',
  'workbench.editors.websocket.spec.browser.hint': '메시지를 고르면 예시 페이로드를 작성합니다.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.settings.exampleCaption': '예시 세션',
  'workbench.editors.websocket.settings.group.connection': '연결',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS 및 신뢰',
  'workbench.editors.websocket.settings.group.resilience': '세션 복원력',
  'workbench.editors.websocket.settings.groupInfo.resilience':
    '긴 세션을 살려 두는 것들입니다. 끊긴 연결을 다시 열지와 얼마나 참을성 있게 열지, 연결이 끊긴 것으로 간주되기 전까지 침묵이 얼마나 이어질 수 있는지, 이 클라이언트가 보내는 하트비트.',
  'workbench.editors.websocket.settings.groupInfo.connection':
    '핸드셰이크가 세션을 여는 방식입니다. 제안하는 하위 프로토콜, 연결이 다이얼하는 곳, 열기의 상한.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Socket.IO 세션이 서버를 지정하고 대화하는 방식입니다. 마운트하는 engine.io 핸드셰이크 경로, 참여하는 이름 공간, 프로토콜 개정판, 이벤트가 확인 응답을 기다리는 시간.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'wss: 세션이 신뢰를 수립하는 방식입니다. 서버 인증서를 시스템 루트로 검증할지, 이 기기가 제시하는 클라이언트 인증서, 핸드셰이크의 TLS 버전 범위와 암호 목록, 제시하는 SNI 이름.',
  'workbench.editors.websocket.settings.subprotocolsLabel': '하위 프로토콜',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    '선호 순서로 나열한 Sec-WebSocket-Protocol 제안 목록입니다. 서버가 핸드셰이크 중에 하나를 고릅니다.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': '없음 (기본값)',
  'workbench.editors.websocket.settings.subprotocolsExample': '예: graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Unix 소켓',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'TCP 연결을 여는 대신 이 로컬 소켓으로 다이얼합니다. 절대 Unix 소켓 경로 또는 \\\\.\\pipe\\name 같은 Windows 명명된 파이프입니다. 핸드셰이크 Host 헤더, TLS 서버 이름, 인증서 검증은 계속 URL 주소가 결정하며, 연결이 가는 곳만 바뀝니다. 일반 TCP 연결이면 비워 두세요.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'TCP 연결 (기본값)',
  'workbench.editors.websocket.settings.timeoutLabel': '연결 시간 제한',
  'workbench.editors.websocket.settings.timeoutHelp':
    '연결 핸드셰이크에만 적용되는 실제 시간 상한입니다. 열린 세션에는 상한이 없습니다. 비우면 데드라인이 없습니다.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': '제한 없음 (기본값)',
  'workbench.editors.websocket.settings.handshakePathLabel': '핸드셰이크 경로',
  'workbench.editors.websocket.settings.handshakePathHelp':
    'engine.io 핸드셰이크가 다이얼하는 서버 경로입니다. 이름 공간이 아니라 Socket.IO 마운트입니다. 비우면 기본 /socket.io/ 경로를 다이얼합니다. 세션은 websocket 전송을 직접 다이얼하며, long-polling 대체는 없습니다.',
  'workbench.editors.websocket.settings.handshakePathPlaceholder': '/socket.io/ (기본값)',
  'workbench.editors.websocket.settings.handshakePathExample': '예: /net/sio-probe',
  'workbench.editors.websocket.settings.namespaceLabel': '이름 공간',
  'workbench.editors.websocket.settings.namespaceHelp':
    '세션이 참여하는 이름 공간입니다. 공식 클라이언트가 읽는 대로 URL 경로입니다 (ws://host/admin 주소는 /admin 이름 공간에 참여). 여기서나 URL 주소에서 편집하세요. 둘은 동기화됩니다. 비우면 루트 / 이름 공간에 참여합니다.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (기본값)',
  'workbench.editors.websocket.settings.namespaceExample': '예: /admin',
  'workbench.editors.websocket.settings.socketioProtocolLabel': '프로토콜',
  'workbench.editors.websocket.settings.socketioProtocolHelp':
    '세션이 사용하는 Socket.IO 프로토콜 개정판입니다. v5 (engine.io 4)는 Socket.IO 3.x 및 4.x 서버가 쓰는 것이고, 1.x 또는 2.x 서버에는 v4 (engine.io 3)를 고르세요. 거기서는 클라이언트가 핑을 보내고, 서버가 루트 이름 공간에 스스로 참여하며, connect 패킷에 auth 페이로드가 없으므로 bearer 자격 증명은 핸드셰이크 헤더로만 실립니다.',
  'workbench.editors.websocket.settings.socketioProtocolPlaceholder': 'v5 (기본값)',
  'workbench.editors.websocket.settings.socketioProtocolV5': 'v5 — Socket.IO 3.x / 4.x 서버',
  'workbench.editors.websocket.settings.socketioProtocolV4': 'v4 — Socket.IO 1.x / 2.x 서버',
  'workbench.editors.websocket.settings.ackTimeoutLabel': '확인 응답 시간 제한',
  'workbench.editors.websocket.settings.ackTimeoutHelp':
    'Ack 옵션으로 보낸 이벤트가 서버의 확인 응답을 기다리는 시간입니다. 시간이 다 되면 타임라인이 확인 응답을 시간 초과로 기록하고 기다리기를 멈춥니다. 늦게 온 확인 응답도 도착하면 표시됩니다. 비우면 무한정 기다립니다.',
  'workbench.editors.websocket.settings.ackTimeoutPlaceholder': '시간 제한 없음 (기본값)',
  'workbench.editors.websocket.toast.deletedOtherTab': '이 WebSocket 요청은 다른 탭에서 삭제되었습니다.',
  'workbench.editors.websocket.toast.updateFailed': 'WebSocket 요청을 저장하지 못했습니다',
  'workbench.editors.websocket.toast.updateFailedDetail': 'WebSocket 요청을 저장하지 못했습니다: {message}',
  'workbench.editors.websocket.toast.savedExample': '예시 {name}을 저장했습니다',
  'workbench.editors.websocket.toast.saveExampleFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': '예시를 저장하지 못했습니다: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': '응답',
  'workbench.editors.websocket.session.emptyHint': '연결하면 메시지를 보내고 받을 수 있습니다.',
  'workbench.editors.websocket.session.connectFailed': '세션을 열지 못했습니다',
  'workbench.editors.websocket.session.connectingBadge': '연결 중',
  'workbench.editors.websocket.session.connectedBadge': '연결됨',
  'workbench.editors.websocket.session.closedTag': '닫힘 {code}',
  'workbench.editors.websocket.session.stoppedTag': '중지됨',
  'workbench.editors.websocket.session.disconnectedTag': '연결 해제됨',
  'workbench.editors.websocket.session.connectFailedTag': '연결 실패',
  'workbench.editors.websocket.session.abortedTag': '중단됨',
  'workbench.editors.websocket.session.noCloseFrame': 'Close 프레임 없이 연결이 끝났습니다',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': '전송',
  'workbench.editors.websocket.session.saveResponse': '응답 저장',
  'workbench.editors.websocket.session.sendIdle': '연결하면 메시지를 보낼 수 있습니다.',
  'workbench.editors.websocket.session.sendFailed': '메시지를 보내지 못했습니다',
  'workbench.editors.websocket.session.hostNotice':
    '브라우저 소켓에서 실행 중입니다. {knobs}은 이 호스트에서 적용되지 않습니다.',
  'workbench.editors.websocket.session.knobHeaders': '사용자 지정 핸드셰이크 헤더',
  'workbench.editors.websocket.session.knobSslVerify': '비활성화한 SSL 검증',
  'workbench.editors.websocket.session.knobAuth': '자격 증명의 핸드셰이크 헤더',
  'workbench.editors.websocket.session.handshakeNone': '협상된 것 없음',
  'workbench.editors.websocket.session.handshakeNote':
    '플랫폼 소켓은 협상된 하위 프로토콜과 확장만 노출합니다. 101 응답 헤더는 클라이언트가 볼 수 없습니다.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': '연결 중',
  'workbench.editors.websocket.timeline.connected': '연결됨',
  'workbench.editors.websocket.timeline.disconnected': '연결 해제됨',
  'workbench.editors.websocket.timeline.stopped': '중지됨',
  'workbench.editors.websocket.timeline.aborted': '연결 중단됨',
  'workbench.editors.websocket.connect.reconnectNow': '지금 재연결',
  'workbench.editors.websocket.connect.reconnectNowHint': '주기를 기다리지 않고 다음 재연결 시도를 바로 다이얼합니다',
  'workbench.editors.websocket.session.reconnectingBadge': '재연결 중',
  'workbench.editors.websocket.session.reconnectExhaustedTag': '재연결 포기',
  'workbench.editors.websocket.session.reconnectExhausted': '{attempts} 후 재연결을 포기했습니다',
  'workbench.editors.websocket.session.reconnectExhaustedReason': '{attempts} 후 재연결을 포기했습니다: {reason}',
  'workbench.editors.websocket.session.reconnectAttemptsOne': '시도 1회',
  'workbench.editors.websocket.session.reconnectAttemptsMany': '시도 {count}회',
  'workbench.editors.websocket.timeline.lost': '연결 끊김',
  'workbench.editors.websocket.timeline.lostIdle': '유휴 시간 제한 전에 아무것도 도착하지 않았습니다',
  'workbench.editors.websocket.timeline.reconnectingAfter': '{delay} 후 재연결 시도 {attempt}',
  'workbench.editors.websocket.timeline.reconnectingNow': '지금 재연결 시도 {attempt}',
  'workbench.editors.websocket.timeline.reconnected': '다시 연결됨',
  'workbench.editors.websocket.timeline.reconnectedTo': '{url}에 다시 연결됨',
  'workbench.editors.websocket.timeline.ackTimeout': 'Ack #{ackId} 항목이 {timeout} 후 시간 초과됨',
  'workbench.editors.websocket.timeline.noMatches': '필터와 일치하는 메시지가 없습니다.',
  'workbench.editors.websocket.timeline.connectedTo': '{url}에 연결됨',
  'workbench.editors.websocket.timeline.copyMessage': '메시지 복사',
  'workbench.editors.websocket.saved.title': '저장된 메시지',
  'workbench.editors.websocket.saved.addTooltip': '현재 작성 내용을 재사용 가능한 메시지로 저장',
  'workbench.editors.websocket.saved.showRail': '저장된 메시지 표시',
  'workbench.editors.websocket.saved.hideRail': '저장된 메시지 숨기기',
  'workbench.editors.websocket.saved.emptyHint': '메시지를 저장하면 활성 연결 중에 재사용할 수 있습니다.',
  'workbench.editors.websocket.saved.defaultName': '메시지',
  'workbench.editors.websocket.saved.rename': '이름 바꾸기',
  'workbench.editors.websocket.saved.duplicate': '복제',
  'workbench.editors.websocket.saved.delete': '삭제',
  'workbench.editors.websocket.timeline.saveMessage': '메시지 저장',
  'workbench.editors.websocket.timeline.info.label': '메시지 세부 정보',
  'workbench.editors.websocket.timeline.info.size': '크기',
  'workbench.editors.websocket.timeline.info.time': '시간',
  'workbench.editors.websocket.timeline.info.frame': '프레임',
  'workbench.editors.websocket.timeline.info.frameText': '텍스트',
  'workbench.editors.websocket.timeline.info.frameBinary': '바이너리',
  'workbench.editors.websocket.timeline.couldNotConnect': '{url}에 연결할 수 없습니다',
  'workbench.editors.websocket.timeline.errorLabel': '오류',
  'workbench.editors.websocket.timeline.disconnectedFrom': '{url}에서 연결 해제됨',
  'workbench.editors.websocket.timeline.handshakeDetails': '핸드셰이크 세부 정보',
  'workbench.editors.websocket.timeline.requestUrl': '요청 URL',
  'workbench.editors.websocket.timeline.requestMethod': '요청 메서드',
  'workbench.editors.websocket.timeline.statusCode': '상태 코드',
  'workbench.editors.websocket.timeline.requestHeaders': '요청 헤더',
  'workbench.editors.websocket.timeline.responseHeaders': '응답 헤더',
  'workbench.editors.websocket.timeline.keyGenerated': '<소켓이 생성함>',
  'workbench.editors.websocket.timeline.stoppedDetail': '이 앱에서 세션을 중지했습니다.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    '등록된 의미가 없습니다. 애플리케이션 또는 사설 코드입니다.',
  'workbench.editors.websocket.timeline.closeCode.1000': '연결이 정상적으로 닫혔습니다.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    '엔드포인트가 떠나고 있습니다. 서버 종료 또는 페이지 이동입니다.',
  'workbench.editors.websocket.timeline.closeCode.1002': '엔드포인트가 프로토콜 오류로 연결을 종료했습니다.',
  'workbench.editors.websocket.timeline.closeCode.1003': '엔드포인트가 받아들일 수 없는 유형의 데이터를 받았습니다.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Close 프레임에 상태 코드가 없었습니다.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'Close 프레임 없이 연결이 끊겼습니다.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    '메시지가 유형과 맞지 않는 데이터를 실었습니다. 예를 들어 텍스트 프레임의 잘못된 UTF-8 값입니다.',
  'workbench.editors.websocket.timeline.closeCode.1008': '메시지가 엔드포인트의 정책을 위반했습니다.',
  'workbench.editors.websocket.timeline.closeCode.1009': '메시지가 너무 커서 엔드포인트가 처리할 수 없었습니다.',
  'workbench.editors.websocket.timeline.closeCode.1010': '서버가 클라이언트에 필요한 확장을 협상하지 않았습니다.',
  'workbench.editors.websocket.timeline.closeCode.1011': '서버가 예기치 않은 상황을 만나 요청을 처리할 수 없었습니다.',
  'workbench.editors.websocket.timeline.closeCode.1012': '서버가 다시 시작하는 중입니다.',
  'workbench.editors.websocket.timeline.closeCode.1013': '서버에 과부하가 걸렸습니다. 나중에 다시 시도하세요.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    '게이트웨이 또는 프록시가 업스트림 서버에서 잘못된 응답을 받았습니다.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'TLS 핸드셰이크에 실패했습니다.',
  'workbench.editors.websocket.timeline.searchMessages': '메시지 검색',
  'workbench.editors.websocket.timeline.messageCount': '메시지 {count}개',
  'workbench.editors.websocket.timeline.dropped': '오래된 메시지 {count}개가 캡처에서 밀려났습니다',
  'workbench.editors.websocket.timeline.script': '{hook} — {levels}',
  'workbench.editors.websocket.timeline.scriptFailed': '{hook} 실패 — {error}',
  'workbench.editors.websocket.timeline.scriptDropped': '{hook} 메시지 폐기 — {level}',
  'workbench.editors.websocket.timeline.scriptAttempt': '시도 {attempt}',
  'workbench.editors.websocket.session.view.timeline': '타임라인',
  'workbench.editors.websocket.session.view.scripts': '스크립트',
  'workbench.editors.websocket.session.scripts.empty': '이 세션에서 실행된 스크립트가 없습니다.',
  'workbench.editors.websocket.session.scripts.console': '콘솔',
  'workbench.editors.websocket.session.scripts.tests': 'Tests',
  'workbench.editors.websocket.session.scripts.consoleEmpty': '기록된 로그가 없습니다.',
  'workbench.editors.websocket.session.scripts.testsEmpty': '등록된 단언이 없습니다.',
  'workbench.editors.websocket.session.scripts.attempt': '시도 {attempt}',
  'workbench.editors.websocket.session.scripts.atMessage': '메시지 {index}',
  'workbench.editors.websocket.session.scripts.tag': '스크립트 · {count}',
  'workbench.editors.websocket.session.scripts.tagTitle': '세션 스크립트',
  'workbench.editors.websocket.session.scripts.tagSummary': '이 세션에서 실행된 훅과 기여한 수준입니다.',
  'workbench.editors.websocket.session.scripts.tagSummaryFailed': '훅이 실패했습니다. 마지막 오류가 아래에 나열됩니다.',
  'workbench.editors.websocket.session.scripts.runs': '{count}회 실행',
  'workbench.editors.websocket.session.scripts.runsOne': '1회 실행',
  'workbench.editors.websocket.session.scripts.failed': '{count}건 실패',
  'workbench.editors.websocket.session.scripts.dropped': '{count}건 폐기',
  'workbench.editors.websocket.session.scripts.marksCapped':
    '이벤트별 세부 정보는 {count}회 실행 후 중단되었습니다. 훅은 계속 실행되며 세션이 정리되면 전체 집계가 반영됩니다.',
  'workbench.editors.websocket.timeline.filterAll': '모두',
  'workbench.editors.websocket.timeline.filterSent': '보냄',
  'workbench.editors.websocket.timeline.filterReceived': '받음',
  'workbench.editors.websocket.timeline.newestFirst': '최신순',
  'workbench.editors.websocket.timeline.oldestFirst': '오래된순',
  'workbench.editors.websocket.timeline.sortOrder': '정렬 및 그룹화',
  'workbench.editors.websocket.timeline.groupByDirection': '방향별 그룹화',
  'workbench.editors.websocket.timeline.groupByEvent': '이벤트별 그룹화',
  'workbench.editors.websocket.timeline.hideHeartbeat': '하트비트 숨기기 (ping / pong)',
  'workbench.editors.websocket.timeline.hideHandshake': '핸드셰이크 프레임 숨기기 (open / connect)',
  'workbench.editors.websocket.timeline.rowsPerGroup': '그룹당 행 수',
  'workbench.editors.websocket.timeline.noLimit': '제한 없음',
  'workbench.editors.websocket.timeline.clearMessages': '메시지 지우기',
  'workbench.editors.websocket.timeline.trustCertificate': '인증서 신뢰',
  'workbench.editors.websocket.timeline.newMessages': '새 메시지',
  'workbench.editors.websocket.timeline.binaryMessage': '바이너리 메시지 ({bytes}바이트)',
  'workbench.editors.websocket.timeline.sentAria': '보냄',
  'workbench.editors.websocket.timeline.receivedAria': '받음',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': '바이너리 첨부 프레임 (첨부 {count}개)',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': '예시를 불러오는 중…',
  'workbench.editors.wsExample.notFound': '이 예시는 사라졌습니다. 다른 탭에서 삭제되었을 수 있습니다.',
  'workbench.editors.wsExample.openInRequest': '요청에서 열기',
  'workbench.editors.wsExample.openInRequestTooltip':
    '이 캡처된 형태를 저장하지 않은 편집으로 하여 상위 WebSocket 요청을 엽니다.',
  'workbench.editors.wsExample.capturedTooltip': '{date}에 캡처됨',
  'workbench.editors.wsExample.toast.deletedOtherTab': '이 예시는 다른 탭에서 삭제되었습니다.',
  'workbench.editors.wsExample.toast.saveFailed': '예시를 저장하지 못했습니다',
  'workbench.editors.wsExample.toast.saveFailedDetail': '예시를 저장하지 못했습니다: {message}',
} as const satisfies Catalog;
