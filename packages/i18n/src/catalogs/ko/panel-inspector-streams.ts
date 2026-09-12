/**
 * DevTools panel — inspector stream tabs — Korean. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers (incl. the Direction info title), opcode vocabulary, `id:` /
 * `event:` / `Last-Event-ID` wire fields, the JSON toggle, Base64 /
 * Hex / UTF-8 modes, `keepalive` and `socket` stay parity-raw. Mints:
 * 전송선 = wire (crossed the wire = 전송선을 지나다; carried from
 * panel-network); 프레임 / 페이로드 carried; 폐기 = dropped; 삽입 =
 * injected; 합성 = synthetic; 전달 = delivered (carried); 추정 =
 * inferred vs 도출 = derived (two referents); 캡처 계층 = capture
 * plane; 래퍼 = wrapper; 엔드포인트 = endpoint; 페이로드 뷰어 = payload
 * viewer; 실행 점 = fire dot (호박색 실행 점); 이 프레임/이벤트를
 * 바탕으로 = seeded from; Server-Sent Events rides raw (MDN
 * vocabulary); 이쪽 = "this side" of the split. Quoted OH labels copy
 * this file's mints in “ ”.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': '모두 지우기',
  'panel.inspector.streams.directionFilterTitle': '방향으로 필터',
  'panel.inspector.streams.directionAll': '모두',
  'panel.inspector.streams.directionSend': '송신',
  'panel.inspector.streams.directionReceive': '수신',
  'panel.inspector.streams.filterAria': '스트림 메시지 필터',
  'panel.inspector.streams.sortByTitle': '{column} 열로 정렬',
  'panel.inspector.streams.resizeColumnAria': '{column} 열 너비 조절',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': '보기',
  'panel.inspector.streams.view.layout': '레이아웃',
  'panel.inspector.streams.view.layoutCompact': '간결',
  'panel.inspector.streams.view.layoutWide': '넓게',
  'panel.inspector.streams.view.split': '분할',
  'panel.inspector.streams.view.splitSideBySide': '좌우 배치',
  'panel.inspector.streams.view.splitStacked': '상하 배치',
  'panel.inspector.streams.view.splitDisabledTitle': '창을 분할하려면 페이로드 미리보기를 켜세요',
  'panel.inspector.streams.view.showPreview': '페이로드 미리보기 표시',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': '규칙 적용됨. 프레임의 페이로드가 규칙의 페이로드와 일치합니다',
  'panel.inspector.streams.fire.inferredFrame': '규칙 일치. 이 프레임에서는 적용을 검증할 수 없습니다',
  'panel.inspector.streams.fire.injectedFrame': '규칙 적용됨. 이 프레임은 규칙이 삽입했습니다',
  'panel.inspector.streams.fire.replacedFrame': '규칙 적용됨. 규칙이 이 프레임을 교체했습니다',
  'panel.inspector.streams.fire.droppedSendFrame': '규칙이 이 프레임을 폐기했습니다. 서버에 전송되지 않았습니다',
  'panel.inspector.streams.fire.droppedRecvFrame': '규칙이 이 프레임을 폐기했습니다. 페이지가 받지 못했습니다',
  'panel.inspector.streams.fire.appliedEvent': '규칙 적용됨. 이벤트의 페이로드가 규칙의 페이로드와 일치합니다',
  'panel.inspector.streams.fire.inferredEvent': '규칙 일치. 이 이벤트에서는 적용을 검증할 수 없습니다',
  'panel.inspector.streams.fire.injectedEvent': '규칙 적용됨. 이 이벤트는 규칙이 삽입했습니다',
  'panel.inspector.streams.fire.replacedEvent': '규칙 적용됨. 규칙이 이 이벤트를 교체했습니다',
  'panel.inspector.streams.fire.droppedEvent': '규칙이 이 이벤트를 폐기했습니다. 페이지가 받지 못했습니다',
  'panel.inspector.streams.row.copied': '복사됨',
  'panel.inspector.streams.row.copyPayload': '페이로드 복사',
  'panel.inspector.streams.row.editRule': '규칙 편집',
  'panel.inspector.streams.row.override': '재정의',
  'panel.inspector.streams.row.droppedSendCell': '폐기됨. 서버에 전송되지 않음',
  'panel.inspector.streams.row.droppedRecvCell': '폐기됨. 페이지에 전달되지 않음',
  'panel.inspector.streams.row.notCaptured': '캡처되지 않음',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': '메시지 필터',
  'panel.inspector.messages.listAria': 'WebSocket 메시지',
  'panel.inspector.messages.overrideMessage': '메시지 재정의',
  'panel.inspector.messages.overrideMessageTitle': '이 연결에 대한 메시지 규칙 만들기',
  'panel.inspector.messages.editRuleTitle': '이 프레임에 작용한 메시지 규칙 편집',
  'panel.inspector.messages.createRuleTitle': '이 프레임을 바탕으로 메시지 규칙 만들기',
  'panel.inspector.messages.syntheticDroppedTitle':
    '합성 행. 페이지가 이 프레임을 만들었지만 규칙이 전송 전에 폐기했습니다',
  'panel.inspector.messages.syntheticInjectedTitle':
    '합성 프레임. 페이지 안에서 규칙이 삽입했으며 전송선을 지나지 않았습니다',
  'panel.inspector.messages.emptyNoDebug': 'WebSocket 프레임은 이 탭에서 디버그 모드가 켜져 있을 때만 보입니다.',
  'panel.inspector.messages.emptySynthetic':
    '전송선을 지난 프레임이 없습니다. 여기서 삽입 규칙이 실행되었고, 삽입된 프레임은 페이지 안에서 합성으로 전달되므로 네트워크 캡처에는 보이지 않습니다.',
  'panel.inspector.messages.emptyNone': '아직 교환된 WebSocket 프레임이 없습니다.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '오래된 프레임 {count}개를 버렸습니다.' });
    return `최신 프레임 ${String(shown)}개 표시 중. ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': '이벤트 필터',
  'panel.inspector.sse.listAria': 'Server-Sent Events',
  'panel.inspector.sse.overrideEvent': '이벤트 재정의',
  'panel.inspector.sse.overrideEventTitle': '이 스트림에 대한 메시지 규칙 만들기',
  'panel.inspector.sse.editRuleTitle': '이 이벤트에 작용한 메시지 규칙 편집',
  'panel.inspector.sse.createRuleTitle': '이 이벤트를 바탕으로 메시지 규칙 만들기',
  'panel.inspector.sse.syntheticTitle': '합성 이벤트. 페이지 안에서 규칙이 삽입했으며 전송선을 지나지 않았습니다',
  'panel.inspector.sse.emptySynthetic':
    '전송선을 지난 이벤트가 없습니다. 여기서 삽입 규칙이 실행되었고, 삽입된 이벤트는 페이지 안에서 합성으로 전달되므로 네트워크 캡처에는 보이지 않습니다.',
  'panel.inspector.sse.emptyUnparseable': '응답 본문에 파싱할 수 있는 SSE 이벤트가 없습니다.',
  'panel.inspector.sse.emptyNoDebug':
    '캡처된 이벤트가 없습니다. 디버그 모드가 없으면 서버 전송 스트림은 요청이 끝난 뒤에야 구체화됩니다. 오래 실행되는 스트림은 연결이 닫힐 때까지 여기에 채워지지 않을 수 있습니다.',
  'panel.inspector.sse.emptyNone': '아직 받은 이벤트가 없습니다.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), { other: '오래된 이벤트 {count}개를 버렸습니다.' });
    return `최신 이벤트 ${String(shown)}개 표시 중. ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': '선택한 메시지가 없습니다',
  'panel.inspector.streams.preview.noMessageHint': '메시지를 선택하면 내용을 볼 수 있습니다.',
  'panel.inspector.streams.preview.noEventTitle': '선택한 이벤트가 없습니다',
  'panel.inspector.streams.preview.noEventHint': '이벤트를 선택하면 내용을 볼 수 있습니다.',
  'panel.inspector.streams.preview.raw': 'Raw',
  'panel.inspector.streams.preview.copy': '복사',
  'panel.inspector.streams.preview.copied': '복사됨',
  'panel.inspector.streams.preview.copyTitle': '클립보드에 복사',
  'panel.inspector.streams.preview.decodeFailed': '바이너리 페이로드를 디코딩할 수 없습니다.',
  'panel.inspector.messages.preview.droppedSendPane':
    '규칙이 이 프레임을 폐기했습니다. 페이지가 만들었지만 서버에 전송되지 않았습니다.',
  'panel.inspector.messages.preview.droppedRecvPane':
    '규칙이 이 프레임을 폐기했습니다. 브라우저에는 도달했지만 페이지에 전달되지 않았습니다.',
  'panel.inspector.messages.preview.originalNotCaptured':
    '페이지가 만든 프레임은 캡처되지 않았습니다. 전송선을 지난 것은 수정된 프레임뿐입니다.',
  'panel.inspector.messages.preview.syntheticNote':
    '합성 프레임. 페이지 안에서 규칙이 삽입했으며 전송선을 지나지 않았습니다.',
  'panel.inspector.sse.preview.droppedPane':
    '규칙이 이 이벤트를 폐기했습니다. 브라우저에는 도달했지만 페이지에 전달되지 않았습니다.',
  'panel.inspector.sse.preview.syntheticNote':
    '합성 이벤트. 페이지 안에서 규칙이 삽입했으며 전송선을 지나지 않았습니다.',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': '도출된 값. 캡처가 아닙니다',
  'panel.inspector.messages.inferredModified.summary':
    '이쪽은 규칙의 교체 페이로드를 보여 줍니다. 캡처 계층이 본 것은 전송선 위의 프레임뿐입니다.',
  'panel.inspector.messages.inferredModified.description':
    '전송선은 원래 프레임을 기록했고 수정은 캡처 이후 페이지 안에서 일어났습니다. 바로 이 프레임이 교체되었다는 것은 호박색 실행 점에 대응하는 규칙의 프레임 선택자로 추정한 것입니다.',
  'panel.inspector.messages.inferredDropped.title': '폐기됨 (추정)',
  'panel.inspector.messages.inferredDropped.summary':
    '전송선은 이 프레임을 기록했지만 규칙이 페이지 안에서 전달을 막았습니다.',
  'panel.inspector.messages.inferredDropped.description':
    '폐기는 캡처 이후에 일어나므로 미전달 자체를 기록할 수 있는 것이 없습니다. 바로 이 프레임이 폐기되었다는 것은 호박색 실행 점에 대응하는 규칙의 프레임 선택자로 추정한 것입니다.',
  'panel.inspector.sse.inferredModified.title': '도출된 값. 캡처가 아닙니다',
  'panel.inspector.sse.inferredModified.summary':
    '이쪽은 규칙의 교체 페이로드를 보여 줍니다. 캡처 계층이 본 것은 전송선 위의 이벤트뿐입니다.',
  'panel.inspector.sse.inferredModified.description':
    '전송선은 원래 이벤트를 기록했고 수정은 캡처 이후 페이지 안에서 일어났습니다. 바로 이 이벤트가 교체되었다는 것은 호박색 실행 점에 대응하는 규칙의 이벤트 선택자로 추정한 것입니다.',
  'panel.inspector.sse.inferredDropped.title': '폐기됨 (추정)',
  'panel.inspector.sse.inferredDropped.summary':
    '전송선은 이 이벤트를 기록했지만 규칙이 페이지 안에서 전달을 막았습니다.',
  'panel.inspector.sse.inferredDropped.description':
    '폐기는 캡처 이후에 일어나므로 미전달 자체를 기록할 수 있는 것이 없습니다. 바로 이 이벤트가 폐기되었다는 것은 호박색 실행 점에 대응하는 규칙의 이벤트 선택자로 추정한 것입니다.',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': '프레임 예시',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': '자 ·',
  'panel.inspector.messages.columnInfo.data.summary':
    '프레임 페이로드입니다. 텍스트 프레임은 내용을 그대로 표시합니다.',
  'panel.inspector.messages.columnInfo.data.description':
    '행을 선택하면 페이로드 뷰어가 열립니다. 텍스트가 파싱되면 JSON 트리, 바이너리 프레임이면 Base64 / Hex / UTF-8 뷰어입니다.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': '페이로드 대신',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    '바이너리 프레임입니다. 바이트는 셀이 아니라 페이로드 뷰어에 있습니다.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': '엔드포인트 간에 교환되는 keepalive 제어 프레임입니다.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'socket 연결을 끝내는 종료 핸드셰이크입니다.',
  'panel.inspector.messages.columnInfo.length.summary':
    '페이로드 크기입니다. 텍스트 프레임은 문자 수만, 바이너리 프레임은 형식을 갖춘 바이트 수 (예: `4 B`)입니다.',
  'panel.inspector.messages.columnInfo.time.summary': '프레임이 전송선을 지난 실제 시각입니다.',
  'panel.inspector.messages.columnInfo.time.description':
    '유일하게 정렬할 수 있는 열입니다. 오름차순이 전송 순서이며, 같은 밀리초의 프레임은 어느 순서든 도착 순서를 유지합니다.',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': '프레임이 이동한 방향입니다.',
  'panel.inspector.messages.directionInfo.arrowsHeading': '화살표',
  'panel.inspector.messages.directionInfo.sentDesc': '송신. 페이지가 이 프레임을 서버로 보냈습니다.',
  'panel.inspector.messages.directionInfo.receivedDesc': '수신. 서버가 이 프레임을 페이지로 보냈습니다.',
  'panel.inspector.messages.directionInfo.errorDesc': '오류. 전송 장애로 스트림이 끝났습니다. 행이 빨갛게 표시됩니다.',
  'panel.inspector.streams.fireRail.title': '규칙 실행',
  'panel.inspector.streams.fireRail.dotColorsHeading': '점 색상',
  'panel.inspector.messages.fireRail.summary':
    '점은 WebSocket 메시지 규칙이 작용한 각 프레임을 표시합니다. 프레임에는 규칙 귀속 정보가 없으므로 점은 도출된 것입니다. 이 요청에서 실행된 메시지 규칙을 가져와 각 규칙의 프레임 선택자를 프레임에 다시 실행합니다.',
  'panel.inspector.messages.fireRail.appliedDesc':
    '적용됨. 프레임의 페이로드가 규칙의 교체 또는 삽입 페이로드와 같습니다.',
  'panel.inspector.messages.fireRail.inferredDesc':
    '추정. 규칙의 방향과 메시지 필터가 이 프레임을 고르지만 적용을 검증할 수 없습니다 (수정된 프레임은 필터가 일치한 페이로드를 더 이상 갖고 있지 않습니다).',
  'panel.inspector.messages.fireRail.description':
    '폐기된 송신 프레임은 전송선을 지나지 않으므로 행이 아예 없습니다. 폐기된 수신 프레임은 먼저 전송선에서 캡처되었습니다. 그 행은 남아 “폐기됨. 페이지에 전달되지 않음”으로 표시됩니다.',
  'panel.inspector.sse.columnInfo.exampleCaption': '이벤트 예시',
  'panel.inspector.sse.columnInfo.id.summary': '이벤트의 `id:` 필드입니다. 서버가 건네는 재연결 커서입니다.',
  'panel.inspector.sse.columnInfo.id.description':
    '서버가 id 값을 보내지 않으면 비어 있습니다. 재연결 시 브라우저가 마지막 id 값을 `Last-Event-ID` 헤더로 돌려주므로 서버가 중단된 곳부터 스트림을 재개할 수 있습니다.',
  'panel.inspector.sse.columnInfo.type.summary': '이벤트의 `event:` 필드입니다. 기본 이벤트는 `message` 값입니다.',
  'panel.inspector.sse.columnInfo.type.description':
    '페이지 코드는 유형별로 구독합니다. `onmessage` 핸들러는 기본 이벤트만 봅니다. 이름 있는 이벤트에는 그 유형에 대한 `addEventListener` 호출이 필요합니다.',
  'panel.inspector.sse.columnInfo.data.summary':
    '이벤트 페이로드입니다. 항상 텍스트이며 여러 줄의 `data:` 필드는 합쳐져 도착합니다.',
  'panel.inspector.sse.columnInfo.data.description':
    '행을 선택하면 페이로드 뷰어가 열립니다. 텍스트가 파싱되면 JSON 트리, 아니면 그대로 표시합니다.',
  'panel.inspector.sse.columnInfo.time.summary': '이벤트가 도착한 실제 시각입니다.',
  'panel.inspector.sse.columnInfo.time.description':
    '정렬할 수 있으며 기본은 오름차순입니다. 완료된 응답 본문에서 파싱한 이벤트에는 시각이 없습니다 (SSE 전송 형식에는 시각이 없음). 그래서 셀이 비어 있습니다.',
  'panel.inspector.sse.fireRail.summary':
    '점은 SSE 메시지 규칙이 작용한 각 이벤트를 표시합니다. 래퍼가 기록한 캡처가 있으면 증거입니다. 없으면 점은 도출된 것입니다. 이 요청에서 실행된 SSE 규칙을 가져와 각 규칙의 이벤트 선택자를 이벤트에 다시 실행합니다.',
  'panel.inspector.sse.fireRail.appliedDesc':
    '적용됨. 래퍼가 바로 이 이벤트에 작용했다고 기록했거나 삽입된 페이로드가 일치합니다.',
  'panel.inspector.sse.fireRail.inferredDesc':
    '추정. 규칙의 이벤트 이름과 데이터 필터가 이 이벤트를 고르지만 전송선만으로는 적용을 검증할 수 없습니다.',
  'panel.inspector.sse.fireRail.description':
    'Server-Sent Events 이벤트는 서버 → 페이지 방향으로만 흐르며 전송선은 규칙이 작용하기 전에 기록합니다. 폐기된 이벤트는 행이 남아 “폐기됨. 페이지에 전달되지 않음”으로 표시됩니다. 삽입된 이벤트는 전송선을 지나지 않고 합성 행으로 표시됩니다.',
} as const satisfies Catalog;
