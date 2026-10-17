/**
 * grpc-timeline-model — the gRPC timeline's vocabulary and its pure
 * derivations: the item / lifecycle shapes the hosts feed, the display
 * entry vocabulary the virtual list runs over, the pinned row metrics
 * the windowing arithmetic depends on, the direction chips, and the
 * per-item decode / preview / dump / search caches. No React, no DOM —
 * the orchestrator (`GrpcMessageTimeline.tsx`) reads this plane and
 * the row renderer paints it.
 */

import type { ProtoRegistry } from '@openheaders/core/proto';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import type React from 'react';
import { buildHexDump, type HexDump } from '../request-editor/response/response-encoding';
import type { GrpcScriptMarkItem } from './grpc-scripts';
import { deriveGrpcFrameView, type GrpcMessageView } from './response-decode';

/** Inline preview cap — plenty for a row; the expanded viewer has the
 *  full payload. */
const PREVIEW_MAX_CHARS = 400;

/** Pinned border-box height of every single-line row (message, group
 *  header, lifecycle) — the virtual window's arithmetic depends on
 *  heights being exact by construction. */
export const SINGLE_ROW_PX = 28;
/** Pinned height of the sent row's expanded metadata block — heading
 *  (18px) + one 20px line per pair (the recorded-empty state's "No
 *  metadata sent." line counts as one) + 6px paddings + 1px divider
 *  (the MQTT CONNACK details' metrics); a closed function of the line
 *  count, so the virtual window's arithmetic stays exact. */
export const sentDetailPx = (pairs: number): number => 18 + Math.max(1, pairs) * 20 + 13;
/** Pinned height of the error row's expanded explanation — the
 *  guidance line + the classified message line (20px each) + 6px
 *  paddings + 1px divider. */
export const ERROR_DETAIL_PX = 53;
/** Pinned height of the connected row's expanded received-metadata
 *  line — one 20px line + 6px paddings + 1px divider. */
export const CONNECTED_DETAIL_PX = 33;

export const cellFont: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

/** One timeline message — the live wire item and the snapshot frame
 *  share this shape (atMs rides only the live one; materialized times
 *  join via `timestamps`). */
export interface GrpcTimelineItem {
  direction?: 'up' | 'down';
  dataBase64: string;
  compressed: boolean;
  /** The ↑ frame carried a secret manager's value (the executor's
   *  stamp) — the row and the viewer show a placeholder, never a decode. */
  secret?: true;
}

/** How the call ended: completed, the user's stop, a pre-head
 *  failure, or a connection lost after the head (`lost` — the
 *  reason rides `endedMessage` behind the chevron like `error`). */
export type GrpcTimelineEndedBy = 'complete' | 'stop' | 'error' | 'lost';

export interface GrpcTimelineLifecycle {
  /** Session-only invoke-departure time. */
  startedAt?: number;
  /** The metadata pairs the call actually carried (the snapshot's
   *  `requestMetadata`) — the "Request sent" row expands to them.
   *  Empty = recorded as none: the row still expands, to the honest
   *  "No metadata sent." line. Absent = UNKNOWN (the live phase, a
   *  host that predates the record): the row reads plain, no chevron —
   *  never a fabricated empty state. */
  requestMetadata?: ReadonlyArray<{ key: string; value: string }>;
  /** The keys among `requestMetadata` whose values came from a secret
   *  manager — the sent row's sheet shows a placeholder for them (L3). */
  secretMetadataKeys?: readonly string[];
  /** True once the response head arrived. */
  headArrived: boolean;
  /** Session-only head-arrival time. */
  connectedAt?: number;
  /** Messages preceding the response head in CALL order — where the
   *  "Response received" row interleaves. Recorded by the executor
   *  (head event / snapshot / capture); absent reads as 0. */
  headAtMessage?: number;
  /** Absent while frames are still arriving — the live phase. */
  endedBy?: GrpcTimelineEndedBy;
  endedAt?: number;
  /** Failure text riding `endedBy: 'error'` / `'lost'`. The status code itself
   *  deliberately does NOT ride the ended row — the meta strip's pill
   *  owns it (no duplicate info, the Postman posture). */
  endedMessage?: string;
  /** The classified failure's advice — what to check — painted in the
   *  secondary tone after the failure text behind the chevron, never on
   *  the error tint. Rides only beside `endedMessage`. */
  endedAdvice?: string;
}

/** One group's identity — composed from the ENABLED grouping axes:
 *  the marks a header renders are exactly the non-null fields, and
 *  `key` (also the collapse / un-window / sticky handle) is unique per
 *  axis combination. */
export interface GrpcGroupIdentity {
  key: string;
  direction: 'up' | 'down' | null;
  name: string | null;
}

/** One display slot of the virtual list — heights are a closed
 *  function of `kind`, so windowing never measures. */
export type GrpcTimelineEntry =
  | {
      key: string;
      kind: 'sent' | 'sentDetail' | 'connected' | 'connectedDetail' | 'ended' | 'errorDetail' | 'noMatches';
    }
  | { key: string; kind: 'header'; group: GrpcGroupIdentity; count: number; collapsed: boolean }
  /** "Show N older" at a windowed group's older edge; the un-windowed
   *  state's re-window action lives on the group header. */
  | { key: string; kind: 'groupMore'; group: GrpcGroupIdentity; hidden: number }
  | { key: string; kind: 'row'; index: number }
  | { key: string; kind: 'viewer'; index: number }
  /** One script hook's run — `index` into `scriptMarks`. */
  | { key: string; kind: 'script'; index: number };

/** The direction lens — `lifecycle` hides every message so the log
 *  reads as its stream story alone. */
export type GrpcDirectionFilter = 'all' | 'up' | 'down' | 'lifecycle';

export const NO_SCRIPT_MARKS: readonly GrpcScriptMarkItem[] = [];

/** Stable chip palette — the same type name always lands on the same
 *  color within and across calls (the SSE badge recipe). */
const CHIP_COLORS = ['blue', 'green', 'purple', 'magenta', 'cyan', 'volcano', 'geekblue', 'orange'] as const;

export function chipColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

/** One direction's name chip — the declared type's short name when the
 *  method resolves, the wire-grammar `message` fallback otherwise. */
export interface DirectionChip {
  name: string;
  resolved: boolean;
}

export function mintChip(qualifiedType: string | null): DirectionChip {
  if (qualifiedType === null || qualifiedType === '') return { name: 'message', resolved: false };
  const lastDot = qualifiedType.lastIndexOf('.');
  return { name: lastDot >= 0 ? qualifiedType.slice(lastDot + 1) : qualifiedType, resolved: true };
}

/** Both directions' chips — a closed function of the resolved rpc
 *  types, so every ↑ row shares one chip identity and every ↓ row the
 *  other. Group identity rides the same two chips. */
export interface DirectionChips {
  up: DirectionChip;
  down: DirectionChip;
}

/** A group's chip identity — resolved styling follows the direction
 *  chip carrying that name. */
export function groupChip(chips: DirectionChips, name: string): DirectionChip {
  return chips.up.name === name ? chips.up : chips.down.name === name ? chips.down : { name, resolved: true };
}

/** The byte count a base64 string encodes — a closed form over its
 *  length and padding, no decode (the row's details tooltip renders
 *  per row). A malformed string reads as its nominal length. */
export function base64ByteLength(value: string): number {
  const clean = value.replace(/\s+/g, '');
  if (clean.length === 0) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
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

/** Per-item view/preview caches, minted per (registry, types) tuple so
 *  a spec rebuild re-derives instead of serving stale decodes. */
export interface GrpcFrameDerivations {
  viewOf: (item: GrpcTimelineItem) => GrpcMessageView;
  previewOf: (item: GrpcTimelineItem) => string;
  /** The frame's bytes as the classic dump — the viewer's Hexdump. */
  hexOf: (item: GrpcTimelineItem) => HexDump;
  /** The search haystack — the FULL decoded text (the preview is
   *  capped; a match deep in a long message still counts), lowercased
   *  once per item; a raw frame searches by its base64. */
  searchTextOf: (item: GrpcTimelineItem) => string;
}

export function makeGrpcFrameDerivations(
  registry: ProtoRegistry | null,
  inputType: string | null,
  outputType: string | null,
  hiddenLabel: string,
): GrpcFrameDerivations {
  const viewCache = new WeakMap<GrpcTimelineItem, GrpcMessageView>();
  const previewCache = new WeakMap<GrpcTimelineItem, string>();
  const viewOf = (item: GrpcTimelineItem): GrpcMessageView => {
    const hit = viewCache.get(item);
    if (hit !== undefined) return hit;
    // The capture keeps the bytes; a secret-bearing frame never decodes.
    const view: GrpcMessageView =
      item.secret === true
        ? { kind: 'structural', text: hiddenLabel }
        : deriveGrpcFrameView(item, registry, item.direction === 'up' ? inputType : outputType);
    viewCache.set(item, view);
    return view;
  };
  const previewOf = (item: GrpcTimelineItem): string => {
    const hit = previewCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const text =
      view.kind === 'schema' || view.kind === 'structural'
        ? view.text.replace(/\n\s*/g, ' ')
        : view.kind === 'raw'
          ? view.base64
          : '';
    const preview = text.slice(0, PREVIEW_MAX_CHARS);
    previewCache.set(item, preview);
    return preview;
  };
  const hexCache = new WeakMap<GrpcTimelineItem, HexDump>();
  const hexOf = (item: GrpcTimelineItem): HexDump => {
    const hit = hexCache.get(item);
    if (hit !== undefined) return hit;
    const dump = buildHexDump(
      item.secret === true ? new Uint8Array(0) : (decodeBase64Bytes(item.dataBase64) ?? new Uint8Array(0)),
    );
    hexCache.set(item, dump);
    return dump;
  };
  const searchCache = new WeakMap<GrpcTimelineItem, string>();
  const searchTextOf = (item: GrpcTimelineItem): string => {
    const hit = searchCache.get(item);
    if (hit !== undefined) return hit;
    const view = viewOf(item);
    const text = (
      view.kind === 'schema' || view.kind === 'structural' ? view.text : view.kind === 'raw' ? view.base64 : ''
    ).toLowerCase();
    searchCache.set(item, text);
    return text;
  };
  return { viewOf, previewOf, hexOf, searchTextOf };
}
