/**
 * mqtt-timeline-model — the MQTT timeline's pure model plane: item and
 * lifecycle shapes, the flat display-entry vocabulary the virtual
 * window runs over, the pinned row heights its arithmetic depends on,
 * and the display-side derivations (payload decode, previews, topic
 * chip colors, session-time formatting). No React — the components in
 * `MqttMessageTimeline.tsx` / `MqttTimelineEntryRow.tsx` render what
 * this module names.
 */

import { decodeBase64Bytes } from '@openheaders/core/utils';
import type React from 'react';

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
export const PREVIEW_MAX_CHARS = 400;

/** Pinned border-box height of every single-line row — the virtual
 *  window's arithmetic depends on heights being exact by construction. */
export const SINGLE_ROW_PX = 28;
/** Pinned height of an expanded row's mini viewer (180px editor +
 *  1px divider). */
export const VIEWER_PX = 181;
/** Pinned height of the Connected row's expanded CONNACK block —
 *  heading (18px) + four fact rows (20px each) + 6px paddings + 1px
 *  divider; the lines carry these heights explicitly so the virtual
 *  window's arithmetic stays exact by construction. */
export const CONNACK_DETAIL_PX = 111;

export const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** One timeline item — the live wire item and the snapshot event share
 *  this shape (atMs rides only the live one; materialized times join
 *  via `timestamps`). */
export type MqttTimelineItem =
  | {
      kind: 'message';
      direction: 'up' | 'down';
      topic: string;
      payloadBase64: string;
      qos: 0 | 1 | 2;
      retain: boolean;
      dup: boolean;
    }
  | { kind: 'subscribed'; grants: Array<{ topicFilter: string; reasonCode: number }> }
  | { kind: 'unsubscribed'; topicFilters: string[] }
  | { kind: 'lost'; end: { by: 'broker'; reasonCode: number | null } | null }
  | { kind: 'reconnecting'; attempt: number; error?: string }
  | { kind: 'reconnected'; attempt: number; sessionPresent: boolean; reasonCode: number; remainingLength: number };

/** The reconnect-cycle facts — the lifecycle rows that ride the item
 *  log (a dropped connection, each redial, the CONNACK that took). */
export type MqttReconnectItem = MqttTimelineItem & { kind: 'lost' | 'reconnecting' | 'reconnected' };

export function isReconnectItem(item: MqttTimelineItem): item is MqttReconnectItem {
  return item.kind === 'lost' || item.kind === 'reconnecting' || item.kind === 'reconnected';
}

/** The connection's live phase read off the item log: the LAST
 *  reconnect-cycle fact decides — a `lost` or `reconnecting` tail
 *  means the session is between connections. */
export function reconnectingAt(items: readonly MqttTimelineItem[], count: number): boolean {
  for (let i = count - 1; i >= 0; i--) {
    const item = items[i];
    if (isReconnectItem(item)) return item.kind !== 'reconnected';
  }
  return false;
}

/** How the session ended — drives the ended lifecycle row. */
export type MqttTimelineEndedBy = 'close' | 'stop';

export interface MqttTimelineLifecycle {
  /** Session-only Connect-departure time. */
  startedAt?: number;
  /** True once the CONNACK accepted. */
  connected: boolean;
  /** Session-only CONNACK-accepted time. */
  connectedAt?: number;
  /** The CONNACK facts behind the Connected row's expandable details —
   *  assembled by the pane (the version knob scopes which numeric
   *  space names the code); rendered verbatim as key: value rows.
   *  `remainingLength` is the frame's Remaining Length as observed on
   *  the wire — absent on captures that predate the fact, rendered as
   *  the absence it is. */
  connack?: { reasonCode: number; reasonName?: string; sessionPresent: boolean; remainingLength?: number };
  /** Classified pre-open failure — the session never opened (a CONNACK
   *  refusal included, its reason verbatim). Rendered as an error row
   *  at the timeline's new edge; never set beside `endedBy` or
   *  `aborted`. */
  errorMessage?: string;
  /** The pre-open end was USER-initiated (Cancel / Stop) — the neutral
   *  "Connection aborted" info row renders at the error row's slot
   *  instead of the error tint. Never set beside `errorMessage` (an
   *  abort carries no message) or `endedBy`. */
  aborted?: true;
  /** The abort tore down an ESTABLISHED broker socket — a
   *  "Disconnected from broker" info row follows the aborted row.
   *  Never set without `aborted` (no fabricated disconnects). */
  abortedDisconnected?: true;
  /** The torn-down socket's observed close instant — the end frame's
   *  host stamp. Rides only beside `abortedDisconnected`; absent
   *  toward hosts that predate the lifecycle stamps (the row renders
   *  timeless, never a fabricated instant). */
  abortedDisconnectedAt?: number;
  /** Absent while the session is open — the live phase. */
  endedBy?: MqttTimelineEndedBy;
  endedAt?: number;
  /** The end detail riding the ended row — the clean Disconnect, the
   *  broker's verbatim reason, or the severed-connection note.
   *  Assembled by the pane; rendered verbatim. */
  endedMessage?: string;
}

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. A `connackDetail`
 *  with an `index` is a reconnected row's own CONNACK block; without
 *  one it is the first connection's. */
export type MqttTimelineEntry =
  | { key: string; kind: 'sent' | 'connected' | 'connackDetail' | 'error' | 'abortedEnd' | 'ended' | 'noMatches' }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number }
  | { key: string; kind: 'connackDetail'; index: number };

export type MqttDirectionFilter = 'all' | 'up' | 'down';

/** Stable per-topic chip palette — the same topic always lands on the
 *  same color (DISPLAY-derived from the string, never stored). */
const TOPIC_BADGE_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

export function topicBadgeColor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = (hash * 31 + topic.charCodeAt(i)) >>> 0;
  return TOPIC_BADGE_COLORS[hash % TOPIC_BADGE_COLORS.length];
}

/** Session timestamps are wall-clock local times — HH:MM:SS.mmm. */
export function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Last entry index whose top offset is at or above `scrollTop`. */
export function entryIndexAt(prefix: readonly number[], scrollTop: number): number {
  let lo = 0;
  let hi = prefix.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (prefix[mid] <= scrollTop) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** A message's display view — text payloads decode display-side (json
 *  highlighting when the payload parses), binary payloads stay base64
 *  (the wire carries no text/binary marker, so the split is an honest
 *  display heuristic over the decoded bytes). */
export interface MqttMessageView {
  kind: 'text' | 'json' | 'binary';
  /** Decoded text (text/json) or the base64 payload (binary). */
  text: string;
  byteLength: number;
}

/** Control characters outside \t \n \r mark a payload as binary for
 *  DISPLAY — so does a UTF-8 decode that needed replacement chars. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the binary display heuristic inspects control bytes by design.
const BINARY_MARKS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

export interface MqttFrameDerivations {
  viewOf: (item: MqttTimelineItem & { kind: 'message' }) => MqttMessageView;
  previewOf: (item: MqttTimelineItem & { kind: 'message' }) => string;
}

/** Per-item view/preview caches — item identity is append-only, so a
 *  WeakMap never serves a stale decode. */
export function makeMqttFrameDerivations(): MqttFrameDerivations {
  const viewCache = new WeakMap<MqttTimelineItem, MqttMessageView>();
  const previewCache = new WeakMap<MqttTimelineItem, string>();
  const viewOf = (item: MqttTimelineItem & { kind: 'message' }): MqttMessageView => {
    const hit = viewCache.get(item);
    if (hit !== undefined) return hit;
    // A malformed payload string decodes to nothing — the row still
    // renders (empty text / zero bytes) rather than throwing.
    const bytes = decodeBase64Bytes(item.payloadBase64) ?? new Uint8Array(0);
    const text = new TextDecoder().decode(bytes);
    let view: MqttMessageView;
    if (BINARY_MARKS.test(text)) {
      view = { kind: 'binary', text: item.payloadBase64, byteLength: bytes.byteLength };
    } else {
      const trimmed = text.trimStart();
      let kind: 'text' | 'json' = 'text';
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(text);
          kind = 'json';
        } catch {
          kind = 'text';
        }
      }
      view = { kind, text, byteLength: bytes.byteLength };
    }
    viewCache.set(item, view);
    return view;
  };
  const previewOf = (item: MqttTimelineItem & { kind: 'message' }): string => {
    const hit = previewCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const preview = view.kind === 'binary' ? '' : view.text.replace(/\n\s*/g, ' ').slice(0, PREVIEW_MAX_CHARS);
    previewCache.set(item, preview);
    return preview;
  };
  return { viewOf, previewOf };
}
