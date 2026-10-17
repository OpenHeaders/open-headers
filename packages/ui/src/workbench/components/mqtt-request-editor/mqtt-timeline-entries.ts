/**
 * mqtt-timeline-entries — the pure passes that turn the item log, the
 * lifecycle and the display state into the flat entry list the virtual
 * window runs over: which rows the search and the direction / topic
 * lenses let through, which fixed rows a search keeps, the group
 * partition under the enabled axes, the entry sequence (one event log
 * in packet order, or the clustered reading with every lifecycle fact
 * at the chronological edge) and each entry's pinned height. Every
 * function is a closed computation of its inputs — the orchestrator
 * memoizes them.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  CONNACK_DETAIL_PX,
  type MqttDirectionFilter,
  type MqttFrameDerivations,
  type MqttGroupIdentity,
  type MqttTimelineEntry,
  type MqttTimelineItem,
  type MqttTimelineLifecycle,
  SINGLE_ROW_PX,
  VIEWER_PX,
} from './mqtt-timeline-model';
import { fixedRowDetailText, fixedRowText, lifecycleItemDetailText, lifecycleItemText } from './mqtt-timeline-row-text';

/** Every item index passing the filters, packet order ascending — one
 *  linear pass of primitive work per commit/keystroke. Search is a
 *  LOOKUP: it matches the words every row shows — a message's topic
 *  and FULL decoded text, a lifecycle row's rendered line plus the
 *  words behind its chevron — and hides the rest whatever their kind.
 *  The direction and topic lenses gate MESSAGE rows only — under them
 *  the lifecycle facts stay as the log's skeleton. */
export function filterVisibleRows(input: {
  items: readonly MqttTimelineItem[];
  count: number;
  clearedCount: number;
  needle: string;
  directionFilter: MqttDirectionFilter;
  topicFilter: readonly string[];
  derive: MqttFrameDerivations;
  t: Translate;
  v5: boolean;
}): number[] {
  const { items, count, clearedCount, needle, directionFilter, topicFilter, derive, t, v5 } = input;
  const topics = topicFilter.length > 0 ? new Set(topicFilter) : null;
  const rows: number[] = [];
  for (let i = clearedCount; i < count; i++) {
    const item = items[i];
    if (item.kind === 'message') {
      // Lifecycle only: no message row at all — the skeleton alone.
      if (directionFilter === 'lifecycle') continue;
      if (directionFilter !== 'all' && item.direction !== directionFilter) continue;
      if (topics !== null && !topics.has(item.topic)) continue;
      if (needle !== '' && !derive.searchTextOf(item).includes(needle)) continue;
    } else if (
      needle !== '' &&
      !`${lifecycleItemText(item, t)}\n${lifecycleItemDetailText(item, v5)}`.toLowerCase().includes(needle)
    ) {
      continue;
    }
    rows.push(i);
  }
  return rows;
}

export interface FixedRowsShown {
  sent: boolean;
  connected: boolean;
  abortedEnd: boolean;
  error: boolean;
  ended: boolean;
}

/** The fixed rows under a search — each shows only when its words
 *  carry the needle (the same words the row paints). */
export function fixedRowsShown(needle: string, lifecycle: MqttTimelineLifecycle, t: Translate): FixedRowsShown {
  const shown = (kind: keyof typeof fixedRowText): boolean =>
    needle === '' ||
    `${fixedRowText[kind](lifecycle, t)}\n${fixedRowDetailText(kind, lifecycle)}`.toLowerCase().includes(needle);
  return {
    sent: shown('sent'),
    connected: shown('connected'),
    abortedEnd: shown('abortedEnd'),
    error: shown('error'),
    ended: shown('ended'),
  };
}

export interface MqttGroup {
  identity: MqttGroupIdentity;
  indexes: number[];
}

/** Partition the display rows' MESSAGES under group headers — identity
 *  composed from the ENABLED axes (topic, direction, or the compound
 *  pair). Group order ANCHORS to each identity's first appearance in
 *  the log — a group never trades places once minted (new messages
 *  only change its contents); only a brand-new identity mints a group,
 *  at the new edge. The sort direction flips the reading of that fixed
 *  order, and rows within a group keep the arrival order. `null` while
 *  neither axis is on. */
export function partitionGroups(input: {
  items: readonly MqttTimelineItem[];
  count: number;
  clearedCount: number;
  displayRows: readonly number[];
  groupByTopic: boolean;
  groupByDirection: boolean;
  newestFirst: boolean;
}): MqttGroup[] | null {
  const { items, count, clearedCount, displayRows, groupByTopic, groupByDirection, newestFirst } = input;
  if (!groupByTopic && !groupByDirection) return null;
  const identityOf = (item: MqttTimelineItem & { kind: 'message' }): MqttGroupIdentity => {
    const key =
      groupByTopic && groupByDirection
        ? `${item.direction}:${item.topic}`
        : groupByTopic
          ? `t:${item.topic}`
          : item.direction;
    return {
      key,
      direction: groupByDirection ? item.direction : null,
      topic: groupByTopic ? item.topic : null,
    };
  };
  const firstSeen = new Map<string, number>();
  for (let i = clearedCount; i < count; i++) {
    const item = items[i];
    if (item.kind !== 'message') continue;
    const key = identityOf(item).key;
    if (!firstSeen.has(key)) firstSeen.set(key, i);
  }
  const byKey = new Map<string, MqttGroup>();
  for (const index of displayRows) {
    const item = items[index];
    if (item.kind !== 'message') continue;
    const identity = identityOf(item);
    const bucket = byKey.get(identity.key);
    if (bucket) bucket.indexes.push(index);
    else byKey.set(identity.key, { identity, indexes: [index] });
  }
  const anchored = [...byKey.values()].sort(
    (a, b) => (firstSeen.get(a.identity.key) ?? 0) - (firstSeen.get(b.identity.key) ?? 0),
  );
  return newestFirst ? anchored.reverse() : anchored;
}

export interface MqttGroupRange {
  key: string;
  startEntry: number;
  endEntry: number;
}

export interface MqttEntryPlan {
  entries: MqttTimelineEntry[];
  /** Each group's entry-index range — feeds the sticky header. */
  groupRanges: MqttGroupRange[];
}

/** The flat display list the virtual window runs over — ONE event
 *  log: Connecting at one chronological edge, Connected (with the
 *  CONNACK detail) before the first item, the ended row at the other
 *  edge; subscription and reconnect facts sit wherever the log
 *  recorded them. Grouped mode is clustering, not a timeline: every
 *  lifecycle fact that rides the log joins Connected at the
 *  chronological edge, in its own log order, and the messages cluster
 *  under their headers. An idle open session shows no placeholder —
 *  the lifecycle rows are the whole honest story. O(display rows)
 *  pushes per commit. */
export function buildTimelineEntries(input: {
  items: readonly MqttTimelineItem[];
  lifecycle: MqttTimelineLifecycle;
  needle: string;
  newestFirst: boolean;
  count: number;
  clearedCount: number;
  filtering: boolean;
  directionFilter: MqttDirectionFilter;
  visibleRows: readonly number[];
  groups: readonly MqttGroup[] | null;
  fixedShown: FixedRowsShown;
  expanded: ReadonlySet<number>;
  connackExpanded: boolean;
  collapsedGroups: ReadonlySet<string>;
  groupRowLimit: number;
  unwindowedGroups: ReadonlySet<string>;
}): MqttEntryPlan {
  const {
    items,
    lifecycle,
    needle,
    newestFirst,
    count,
    clearedCount,
    filtering,
    directionFilter,
    visibleRows,
    groups,
    fixedShown,
    expanded,
    connackExpanded,
    collapsedGroups,
    groupRowLimit,
    unwindowedGroups,
  } = input;
  const out: MqttTimelineEntry[] = [];
  const ranges: MqttGroupRange[] = [];
  // An expanded message row trails its viewer; an expanded
  // reconnected row trails its attempt's own CONNACK block.
  const pushRow = (index: number) => {
    out.push({ key: `r${index}`, kind: 'row', index });
    if (!expanded.has(index)) return;
    if (items[index].kind === 'reconnected') out.push({ key: `c${index}`, kind: 'connackDetail', index });
    else out.push({ key: `v${index}`, kind: 'viewer', index });
  };
  const pushConnected = () => {
    out.push({ key: 'connected', kind: 'connected' });
    // The details block always sits directly under its row — the
    // expanded message-viewer discipline, both sort orders.
    if (connackExpanded && lifecycle.connack !== undefined) {
      out.push({ key: 'connackDetail', kind: 'connackDetail' });
    }
  };
  let messageCount = 0;
  for (const index of visibleRows) if (items[index].kind === 'message') messageCount++;
  // A search that found a lifecycle row found something — the notice
  // is for a filter that leaves NOTHING to read. Under Lifecycle only
  // the empty message set is the point, not a miss.
  const preOpenEnd = lifecycle.errorMessage !== undefined || lifecycle.aborted === true;
  const abortedEnd = lifecycle.aborted === true && lifecycle.abortedDisconnected === true;
  const lifecycleMatched =
    needle !== '' &&
    (visibleRows.length > 0 ||
      fixedShown.sent ||
      (lifecycle.connected && fixedShown.connected) ||
      (lifecycle.endedBy !== undefined && fixedShown.ended) ||
      (preOpenEnd && fixedShown.error) ||
      (abortedEnd && fixedShown.abortedEnd));
  const notice: MqttTimelineEntry | null =
    filtering && directionFilter !== 'lifecycle' && messageCount === 0 && count > clearedCount && !lifecycleMatched
      ? { key: 'none', kind: 'noMatches' }
      : null;

  // The chronological sequence between the edges: Connected first,
  // then the log. Ungrouped, every item in packet order; grouped, the
  // lifecycle facts alone (the messages cluster below).
  const tokens: Array<number | 'connected'> = [];
  if (lifecycle.connected && fixedShown.connected) tokens.push('connected');
  for (const index of visibleRows) {
    if (groups !== null && items[index].kind === 'message') continue;
    tokens.push(index);
  }
  if (newestFirst) tokens.reverse();

  // The error/aborted row sits at the ended row's chronological slot
  // — the two never coexist (a pre-open end has no opened-session
  // end). An abort that closed an established broker socket logs the
  // disconnect as its own row — chronologically AFTER the abort. A
  // refusal's error row expands to the CONNACK the broker answered
  // with — the block directly under its row, both sort orders (the
  // Connected row's discipline; the two rows never coexist, so they
  // share the one expansion).
  const refusalDetail = connackExpanded && lifecycle.errorMessage !== undefined && lifecycle.connack !== undefined;
  const pushGroups = () => {
    if (groups === null) return;
    for (const { identity, indexes } of groups) {
      const startEntry = out.length;
      const collapsed = collapsedGroups.has(identity.key);
      out.push({ key: `h${identity.key}`, kind: 'header', group: identity, count: indexes.length, collapsed });
      if (!collapsed) {
        // displayRows order puts a group's newest member first in
        // newest-first and last in oldest-first — the limit window
        // slices the newest end either way. A group the user
        // un-windowed shows everything, with a re-window toggle in
        // the same slot the "show older" affordance occupies.
        const windowed = groupRowLimit > 0 && !unwindowedGroups.has(identity.key) && indexes.length > groupRowLimit;
        const shown = windowed
          ? newestFirst
            ? indexes.slice(0, groupRowLimit)
            : indexes.slice(-groupRowLimit)
          : indexes;
        const more: MqttTimelineEntry | null = windowed
          ? { key: `m${identity.key}`, kind: 'groupMore', group: identity, hidden: indexes.length - shown.length }
          : null;
        // The toggle sits at the group's OLDER edge — where the
        // hidden rows would continue: below the shown tail in
        // newest-first, right under the header in oldest-first.
        if (!newestFirst && more) out.push(more);
        for (const index of shown) pushRow(index);
        if (newestFirst && more) out.push(more);
      }
      ranges.push({ key: identity.key, startEntry, endEntry: out.length });
    }
  };

  // Top chronological edge.
  if (newestFirst) {
    if (lifecycle.endedBy !== undefined && fixedShown.ended) out.push({ key: 'ended', kind: 'ended' });
    if (preOpenEnd) {
      if (abortedEnd && fixedShown.abortedEnd) out.push({ key: 'abortedEnd', kind: 'abortedEnd' });
      if (fixedShown.error) {
        out.push({ key: 'error', kind: 'error' });
        if (refusalDetail) out.push({ key: 'connackDetail', kind: 'connackDetail' });
      }
    }
    if (notice) out.push(notice);
    // Newest-first: the clusters read above the lifecycle facts.
    pushGroups();
  } else if (fixedShown.sent) {
    out.push({ key: 'sent', kind: 'sent' });
  }
  for (const entry of tokens) {
    if (entry === 'connected') pushConnected();
    else pushRow(entry);
  }
  // Bottom chronological edge.
  if (newestFirst) {
    if (fixedShown.sent) out.push({ key: 'sent', kind: 'sent' });
  } else {
    pushGroups();
    if (notice) out.push(notice);
    if (preOpenEnd) {
      if (fixedShown.error) {
        out.push({ key: 'error', kind: 'error' });
        if (refusalDetail) out.push({ key: 'connackDetail', kind: 'connackDetail' });
      }
      if (abortedEnd && fixedShown.abortedEnd) out.push({ key: 'abortedEnd', kind: 'abortedEnd' });
    }
    if (lifecycle.endedBy !== undefined && fixedShown.ended) out.push({ key: 'ended', kind: 'ended' });
  }
  return { entries: out, groupRanges: ranges };
}

/** Each entry's pinned height — a closed function of its kind. */
export function entryHeights(entries: readonly MqttTimelineEntry[]): number[] {
  return entries.map((e) =>
    e.kind === 'viewer' ? VIEWER_PX : e.kind === 'connackDetail' ? CONNACK_DETAIL_PX : SINGLE_ROW_PX,
  );
}
