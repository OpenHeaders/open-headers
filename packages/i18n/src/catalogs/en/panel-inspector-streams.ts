/**
 * DevTools panel — the inspector stream tabs: WS frames, SSE events,
 * and the messages grids. Virtualized grid rows read memoized label
 * objects — never `t()` per row. Grid columns and opcode vocabulary
 * stay parity-raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) — the streams'
  // OWN copy; pane captions were keyed with the body-tabs family. Raw
  // by design: grid column headers and their info-popover titles
  // (Data / Length / Time / Id / Type — parity columns), opcode labels
  // and the whole `ws-frames.ts` cell vocabulary ('Binary Message',
  // 'N/A', byte figures — parity cells), the ⬆ / ⬇ / ⚠ / ● / ▲ / ▼
  // glyphs, example-card sample payloads and times, the `id:` /
  // `event:` / `Last-Event-ID` wire fields, the JSON toggle (format
  // vocabulary, Base64/UTF-8 precedent) and Base64 / Hex / UTF-8 modes,
  // and `stream-time.ts` figures. Row loops resolve their copy from a
  // labels object memoized on `t` — never `t()` in the row body. ─────
  'panel.inspector.streams.clearAll': 'Clear all',
  'panel.inspector.streams.directionFilterTitle': 'Filter by direction',
  'panel.inspector.streams.directionAll': 'All',
  'panel.inspector.streams.directionSend': 'Send',
  'panel.inspector.streams.directionReceive': 'Receive',
  'panel.inspector.streams.filterAria': 'Filter stream messages',
  'panel.inspector.streams.sortByTitle': 'Sort by {column}',
  'panel.inspector.streams.resizeColumnAria': 'Resize {column} column',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'View',
  'panel.inspector.streams.view.layout': 'Layout',
  'panel.inspector.streams.view.layoutCompact': 'Compact',
  'panel.inspector.streams.view.layoutWide': 'Wide',
  'panel.inspector.streams.view.split': 'Split',
  'panel.inspector.streams.view.splitSideBySide': 'Side by side',
  'panel.inspector.streams.view.splitStacked': 'Stacked',
  'panel.inspector.streams.view.splitDisabledTitle': 'Enable the payload preview to split the pane',
  'panel.inspector.streams.view.showPreview': 'Show payload preview',

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame': "Rule applied — the frame's payload matches the rule's payload",
  'panel.inspector.streams.fire.inferredFrame': 'Rule matched — application not verifiable for this frame',
  'panel.inspector.streams.fire.injectedFrame': 'Rule applied — this frame was injected by the rule',
  'panel.inspector.streams.fire.replacedFrame': 'Rule applied — the rule replaced this frame',
  'panel.inspector.streams.fire.droppedSendFrame': 'Rule dropped this frame — it was never sent to the server',
  'panel.inspector.streams.fire.droppedRecvFrame': 'Rule dropped this frame — the page never received it',
  'panel.inspector.streams.fire.appliedEvent': "Rule applied — the event's payload matches the rule's payload",
  'panel.inspector.streams.fire.inferredEvent': 'Rule matched — application not verifiable for this event',
  'panel.inspector.streams.fire.injectedEvent': 'Rule applied — this event was injected by the rule',
  'panel.inspector.streams.fire.replacedEvent': 'Rule applied — the rule replaced this event',
  'panel.inspector.streams.fire.droppedEvent': 'Rule dropped this event — the page never received it',
  'panel.inspector.streams.row.copied': 'Copied',
  'panel.inspector.streams.row.copyPayload': 'Copy payload',
  'panel.inspector.streams.row.editRule': 'Edit rule',
  'panel.inspector.streams.row.override': 'Override',
  'panel.inspector.streams.row.droppedSendCell': 'Dropped — never sent to the server',
  'panel.inspector.streams.row.droppedRecvCell': 'Dropped — never delivered to the page',
  'panel.inspector.streams.row.notCaptured': 'Not captured',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Filter messages',
  'panel.inspector.messages.listAria': 'WebSocket messages',
  'panel.inspector.messages.overrideMessage': 'Override message',
  'panel.inspector.messages.overrideMessageTitle': 'Create a message rule for this connection',
  'panel.inspector.messages.editRuleTitle': 'Edit the message rule that acted on this frame',
  'panel.inspector.messages.createRuleTitle': 'Create a message rule seeded from this frame',
  'panel.inspector.messages.syntheticDroppedTitle':
    'Synthetic row — the page produced this frame; the rule dropped it before send',
  'panel.inspector.messages.syntheticInjectedTitle':
    'Synthetic frame — injected by a rule inside the page; never crossed the wire',
  'panel.inspector.messages.emptyNoDebug': 'WebSocket frames are only visible with debug mode enabled for this tab.',
  'panel.inspector.messages.emptySynthetic':
    'No frames crossed the wire — an inject rule fired here, and injected frames are delivered synthetically inside the page, invisible to the network capture.',
  'panel.inspector.messages.emptyNone': 'No WebSocket frames exchanged yet.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} older frame dropped.',
      other: '{count} older frames dropped.',
    });
    return `Showing the latest ${String(shown)} frames — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Filter events',
  'panel.inspector.sse.listAria': 'Server-sent events',
  'panel.inspector.sse.overrideEvent': 'Override event',
  'panel.inspector.sse.overrideEventTitle': 'Create a message rule for this stream',
  'panel.inspector.sse.editRuleTitle': 'Edit the message rule that acted on this event',
  'panel.inspector.sse.createRuleTitle': 'Create a message rule seeded from this event',
  'panel.inspector.sse.syntheticTitle': 'Synthetic event — injected by a rule inside the page; never crossed the wire',
  'panel.inspector.sse.emptySynthetic':
    'No events crossed the wire — an inject rule fired here, and injected events are delivered synthetically inside the page, invisible to the network capture.',
  'panel.inspector.sse.emptyUnparseable': 'No parseable SSE events in the response body.',
  'panel.inspector.sse.emptyNoDebug':
    'No events captured. Without debug mode, server-sent streams are only materialized once the request finishes; long-running streams may not populate here until the connection closes.',
  'panel.inspector.sse.emptyNone': 'No events received yet.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} older event dropped.',
      other: '{count} older events dropped.',
    });
    return `Showing the latest ${String(shown)} events — ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'No message selected',
  'panel.inspector.streams.preview.noMessageHint': 'Select message to browse its content.',
  'panel.inspector.streams.preview.noEventTitle': 'No event selected',
  'panel.inspector.streams.preview.noEventHint': 'Select an event to browse its content.',
  'panel.inspector.streams.preview.raw': 'Raw',
  'panel.inspector.streams.preview.copy': 'Copy',
  'panel.inspector.streams.preview.copied': 'Copied',
  'panel.inspector.streams.preview.copyTitle': 'Copy to clipboard',
  'panel.inspector.streams.preview.decodeFailed': 'Binary payload could not be decoded.',
  'panel.inspector.messages.preview.droppedSendPane':
    'The rule dropped this frame — the page produced it, but it was never sent to the server.',
  'panel.inspector.messages.preview.droppedRecvPane':
    'The rule dropped this frame — it reached the browser but was never delivered to the page.',
  'panel.inspector.messages.preview.originalNotCaptured':
    'The frame the page produced was not captured — only the modified frame crossed the wire.',
  'panel.inspector.messages.preview.syntheticNote':
    'Synthetic frame — injected by a rule inside the page; it never crossed the wire.',
  'panel.inspector.sse.preview.droppedPane':
    'The rule dropped this event — it reached the browser but was never delivered to the page.',
  'panel.inspector.sse.preview.syntheticNote':
    'Synthetic event — injected by a rule inside the page; it never crossed the wire.',

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': 'Derived, not captured',
  'panel.inspector.messages.inferredModified.summary':
    "This side shows the rule's replacement payload — the capture plane only ever saw the wire frame.",
  'panel.inspector.messages.inferredModified.description':
    "The wire recorded the original frame; the modification happened inside the page after capture. That this exact frame took the replacement is inferred from the rule's frame selector, matching the amber fire dot.",
  'panel.inspector.messages.inferredDropped.title': 'Dropped, inferred',
  'panel.inspector.messages.inferredDropped.summary':
    'The wire recorded this frame, but the rule stopped its delivery inside the page.',
  'panel.inspector.messages.inferredDropped.description':
    "The drop happens after capture, so nothing can record the non-delivery itself. That this exact frame was dropped is inferred from the rule's frame selector, matching the amber fire dot.",
  'panel.inspector.sse.inferredModified.title': 'Derived, not captured',
  'panel.inspector.sse.inferredModified.summary':
    "This side shows the rule's replacement payload — the capture plane only ever saw the wire event.",
  'panel.inspector.sse.inferredModified.description':
    "The wire recorded the original event; the modification happened inside the page after capture. That this exact event took the replacement is inferred from the rule's event selector, matching the amber fire dot.",
  'panel.inspector.sse.inferredDropped.title': 'Dropped, inferred',
  'panel.inspector.sse.inferredDropped.summary':
    'The wire recorded this event, but the rule stopped its delivery inside the page.',
  'panel.inspector.sse.inferredDropped.description':
    "The drop happens after capture, so nothing can record the non-delivery itself. That this exact event was dropped is inferred from the rule's event selector, matching the amber fire dot.",

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Example frame',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'chars ·',
  'panel.inspector.messages.columnInfo.data.summary': 'The frame payload — text frames show their content verbatim.',
  'panel.inspector.messages.columnInfo.data.description':
    'Select a row to open the payload viewer: a JSON tree when the text parses, a Base64 / Hex / UTF-8 viewer for binary frames.',
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'Instead of the payload',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'A binary frame — the bytes live in the payload viewer, not the cell.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': 'Keepalive control frames exchanged by the endpoints.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'The closing handshake that ends the socket.',
  'panel.inspector.messages.columnInfo.length.summary':
    'The payload size — a bare character count for text frames, formatted bytes (e.g. `4 B`) for binary frames.',
  'panel.inspector.messages.columnInfo.time.summary': 'The wall-clock moment the frame crossed the wire.',
  'panel.inspector.messages.columnInfo.time.description':
    'The one sortable column. Ascending is wire order; frames on the same millisecond keep their arrival order either way.',
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'Which way the frame traveled.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Arrows',
  'panel.inspector.messages.directionInfo.sentDesc': 'Sent — the page pushed this frame to the server.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Received — the server pushed this frame to the page.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Error — a transport failure ended the stream; the row reads red.',
  'panel.inspector.streams.fireRail.title': 'Rule fires',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Dot colors',
  'panel.inspector.messages.fireRail.summary':
    "A dot marks each frame a WebSocket message rule acted on. Frames carry no rule attribution, so the dot is derived: this request's fired message rules, each rule's frame selector re-run against the frame.",
  'panel.inspector.messages.fireRail.appliedDesc':
    "Applied — the frame's payload equals the rule's replacement or injected payload.",
  'panel.inspector.messages.fireRail.inferredDesc':
    "Inferred — the rule's direction and message filter select this frame, but application is not verifiable (a modified frame no longer holds the payload the filter matched).",
  'panel.inspector.messages.fireRail.description':
    'A dropped outgoing frame never crosses the wire, so it has no row at all. A dropped incoming frame was captured on the wire first — its row stays, marked "Dropped — never delivered to the page".',
  'panel.inspector.sse.columnInfo.exampleCaption': 'Example event',
  'panel.inspector.sse.columnInfo.id.summary':
    "The event's `id:` field — the reconnection cursor the server hands out.",
  'panel.inspector.sse.columnInfo.id.description':
    'Empty when the server sends no id. On reconnect the browser echoes the last id back as `Last-Event-ID`, so the server can resume the stream where it left off.',
  'panel.inspector.sse.columnInfo.type.summary': "The event's `event:` field — `message` for default events.",
  'panel.inspector.sse.columnInfo.type.description':
    'Page code subscribes per type: `onmessage` only sees default events; named events need an `addEventListener` for that exact type.',
  'panel.inspector.sse.columnInfo.data.summary':
    'The event payload — always text; multi-line `data:` fields arrive joined.',
  'panel.inspector.sse.columnInfo.data.description':
    'Select a row to open the payload viewer: a JSON tree when the text parses, verbatim otherwise.',
  'panel.inspector.sse.columnInfo.time.summary': 'The wall-clock moment the event arrived.',
  'panel.inspector.sse.columnInfo.time.description':
    'Sortable, ascending by default. Events parsed out of a finished response body carry no time — the SSE wire format has none — so their cells stay empty.',
  'panel.inspector.sse.fireRail.summary':
    "A dot marks each event an SSE message rule acted on. A wrapper-recorded capture is proof; without one the dot is derived: this request's fired SSE rules, each rule's event selector re-run against the event.",
  'panel.inspector.sse.fireRail.appliedDesc':
    'Applied — the wrapper recorded acting on this exact event, or an injected payload matches.',
  'panel.inspector.sse.fireRail.inferredDesc':
    "Inferred — the rule's event name and data filter select this event, but application is not verifiable from the wire alone.",
  'panel.inspector.sse.fireRail.description':
    'Server-sent events only travel server → page, and the wire records them before the rule acts: a dropped event keeps its row, marked "Dropped — never delivered to the page"; an injected event never crosses the wire and shows as a synthetic row.',
} as const satisfies Catalog;
