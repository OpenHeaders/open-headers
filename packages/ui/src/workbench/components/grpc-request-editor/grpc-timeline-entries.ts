/**
 * grpc-timeline-entries — the pure passes that turn the message log,
 * the lifecycle and the display state into the flat entry list the
 * virtual window runs over: which message rows the search and the
 * direction lens let through, which fixed rows a search keeps, the
 * group partition under the enabled axes, the entry sequence in true
 * call order (the "Response received" row interleaving at the recorded
 * head position, the script marks at their own positions) and each
 * entry's pinned height. Every function is a closed computation of its
 * inputs — the orchestrator memoizes them.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { VIEWER_PX } from '../shared/TimelineMessageViewer';
import type { GrpcScriptMarkItem } from './grpc-scripts';
import {
  CONNECTED_DETAIL_PX,
  type DirectionChips,
  ERROR_DETAIL_PX,
  type GrpcDirectionFilter,
  type GrpcFrameDerivations,
  type GrpcGroupIdentity,
  type GrpcTimelineEntry,
  type GrpcTimelineItem,
  type GrpcTimelineLifecycle,
  SINGLE_ROW_PX,
  sentDetailPx,
} from './grpc-timeline-model';
import { fixedRowDetailText, fixedRowText, scriptRowText } from './grpc-timeline-row-text';

/** Every message index passing the search + direction filter, arrival
 *  (call) order ascending — one linear pass of primitive work per
 *  commit/keystroke. Search is a LOOKUP: it matches the words every
 *  row shows — a message's decoded preview, and its type chip while
 *  type chips are SHOWN (search matches what the user can see). The
 *  direction lens gates MESSAGES only; under it the lifecycle rows
 *  stay as the skeleton. */
export function filterVisibleRows(input: {
  items: readonly GrpcTimelineItem[];
  count: number;
  clearedCount: number;
  needle: string;
  directionFilter: GrpcDirectionFilter;
  derive: GrpcFrameDerivations;
  chips: DirectionChips;
  showTypes: boolean;
}): number[] {
  const { items, count, clearedCount, needle, directionFilter, derive, chips, showTypes } = input;
  const chipNeedles = showTypes ? { up: chips.up.name.toLowerCase(), down: chips.down.name.toLowerCase() } : null;
  const rows: number[] = [];
  for (let i = clearedCount; i < count; i++) {
    const item = items[i];
    const direction = item.direction ?? 'down';
    if (directionFilter === 'lifecycle') continue;
    if (directionFilter !== 'all' && direction !== directionFilter) continue;
    if (needle !== '' && !chipNeedles?.[direction].includes(needle) && !derive.searchTextOf(item).includes(needle)) {
      continue;
    }
    rows.push(i);
  }
  return rows;
}

export interface FixedRowsShown {
  sent: boolean;
  connected: boolean;
  ended: boolean;
}

/** The fixed rows under a search — each shows only when its words
 *  carry the needle (the same words the row paints). */
export function fixedRowsShown(needle: string, lifecycle: GrpcTimelineLifecycle, t: Translate): FixedRowsShown {
  const shown = (kind: keyof typeof fixedRowText): boolean =>
    needle === '' ||
    `${fixedRowText[kind](lifecycle, t)}\n${fixedRowDetailText(kind, lifecycle, t)}`.toLowerCase().includes(needle);
  return { sent: shown('sent'), connected: shown('connected'), ended: shown('ended') };
}

export interface GrpcGroup {
  identity: GrpcGroupIdentity;
  indexes: number[];
}

/** Partition the display rows under group headers — identity composed
 *  from the ENABLED axes (type name, direction, or the compound pair).
 *  Group order ANCHORS to each identity's first appearance in the log
 *  — a group never trades places once minted (new messages only
 *  change its contents); only a brand-new identity mints a group, at
 *  the new edge. The sort direction flips the reading of that fixed
 *  order, and rows within a group keep the arrival order. `null` while
 *  neither axis is on. */
export function partitionGroups(input: {
  items: readonly GrpcTimelineItem[];
  count: number;
  clearedCount: number;
  displayRows: readonly number[];
  chips: DirectionChips;
  groupByType: boolean;
  groupByDirection: boolean;
  newestFirst: boolean;
}): GrpcGroup[] | null {
  const { items, count, clearedCount, displayRows, chips, groupByType, groupByDirection, newestFirst } = input;
  if (!groupByType && !groupByDirection) return null;
  const identityOf = (item: GrpcTimelineItem): GrpcGroupIdentity => {
    const direction: 'up' | 'down' = item.direction === 'up' ? 'up' : 'down';
    const name = (direction === 'up' ? chips.up : chips.down).name;
    const key = groupByType && groupByDirection ? `${direction}:${name}` : groupByType ? `t:${name}` : direction;
    return {
      key,
      direction: groupByDirection ? direction : null,
      name: groupByType ? name : null,
    };
  };
  const firstSeen = new Map<string, number>();
  for (let i = clearedCount; i < count; i++) {
    const key = identityOf(items[i]).key;
    if (!firstSeen.has(key)) firstSeen.set(key, i);
  }
  const byKey = new Map<string, GrpcGroup>();
  for (const index of displayRows) {
    const identity = identityOf(items[index]);
    const bucket = byKey.get(identity.key);
    if (bucket) bucket.indexes.push(index);
    else byKey.set(identity.key, { identity, indexes: [index] });
  }
  const anchored = [...byKey.values()].sort(
    (a, b) => (firstSeen.get(a.identity.key) ?? 0) - (firstSeen.get(b.identity.key) ?? 0),
  );
  return newestFirst ? anchored.reverse() : anchored;
}

export interface GrpcGroupRange {
  key: string;
  startEntry: number;
  endEntry: number;
}

export interface GrpcEntryPlan {
  entries: GrpcTimelineEntry[];
  /** Each group's entry-index range — feeds the sticky header. */
  groupRanges: GrpcGroupRange[];
}

/** The flat display list the virtual window runs over. The timeline
 *  is ONE event log: ungrouped, "Response received" interleaves at
 *  the recorded head position among the rows (flipping with the
 *  sort); grouped mode is clustering, so the head row joins "Request
 *  sent" at the chronological edge instead. Waiting/no-match notices
 *  sit at the edge new rows land on. O(display rows) pushes per
 *  commit. */
export function buildTimelineEntries(input: {
  lifecycle: GrpcTimelineLifecycle;
  t: Translate;
  needle: string;
  newestFirst: boolean;
  count: number;
  clearedCount: number;
  filtering: boolean;
  directionFilter: GrpcDirectionFilter;
  visibleRows: readonly number[];
  displayRows: readonly number[];
  groups: readonly GrpcGroup[] | null;
  scriptMarks: readonly GrpcScriptMarkItem[];
  fixedShown: FixedRowsShown;
  expanded: ReadonlySet<number>;
  sentDetailOpen: boolean;
  connectedDetailOpen: boolean;
  errorDetailOpen: boolean;
  collapsedGroups: ReadonlySet<string>;
  groupRowLimit: number;
  unwindowedGroups: ReadonlySet<string>;
}): GrpcEntryPlan {
  const {
    lifecycle,
    t,
    needle,
    newestFirst,
    count,
    clearedCount,
    filtering,
    directionFilter,
    visibleRows,
    displayRows,
    groups,
    scriptMarks,
    fixedShown,
    expanded,
    sentDetailOpen,
    connectedDetailOpen,
    errorDetailOpen,
    collapsedGroups,
    groupRowLimit,
    unwindowedGroups,
  } = input;
  const out: GrpcTimelineEntry[] = [];
  const ranges: GrpcGroupRange[] = [];
  const pushRow = (index: number) => {
    out.push({ key: `r${index}`, kind: 'row', index });
    if (expanded.has(index)) out.push({ key: `v${index}`, kind: 'viewer', index });
  };
  const pushSent = () => {
    if (!fixedShown.sent) return;
    out.push({ key: 'sent', kind: 'sent' });
    if (sentDetailOpen) out.push({ key: 'sentDetail', kind: 'sentDetail' });
  };
  const pushConnected = () => {
    if (!fixedShown.connected) return;
    out.push({ key: 'connected', kind: 'connected' });
    if (connectedDetailOpen) out.push({ key: 'connectedDetail', kind: 'connectedDetail' });
  };
  const pushEnded = () => {
    if (lifecycle.endedBy === undefined || !fixedShown.ended) return;
    out.push({ key: 'ended', kind: 'ended' });
    if (errorDetailOpen) out.push({ key: 'errorDetail', kind: 'errorDetail' });
  };
  // The script marks — a cleared log drops the marks that landed
  // before the clear along with the messages; a search keeps only
  // the marks whose words carry the needle.
  const marks: number[] = [];
  scriptMarks.forEach((mark, i) => {
    if (mark.atIndex < clearedCount) return;
    if (needle !== '' && !scriptRowText(mark, t).toLowerCase().includes(needle)) return;
    marks.push(i);
  });
  const pushMarks = (indexes: readonly number[]) => {
    for (const i of indexes) out.push({ key: `s${i}`, kind: 'script', index: i });
  };
  const headAt = lifecycle.headArrived ? (lifecycle.headAtMessage ?? 0) : null;
  // A search that found a lifecycle row found something — the notice
  // is for a filter that leaves NOTHING to read. Under Lifecycle only
  // the empty message set is the point, not a miss.
  const lifecycleMatched =
    needle !== '' &&
    (marks.length > 0 ||
      fixedShown.sent ||
      (headAt !== null && fixedShown.connected) ||
      (lifecycle.endedBy !== undefined && fixedShown.ended));
  const notice: GrpcTimelineEntry | null =
    filtering &&
    directionFilter !== 'lifecycle' &&
    displayRows.length === 0 &&
    count > clearedCount &&
    !lifecycleMatched
      ? { key: 'none', kind: 'noMatches' }
      : null;

  // Top chronological edge.
  if (newestFirst) {
    pushEnded();
    if (notice) out.push(notice);
  } else {
    pushSent();
    if (groups !== null) {
      // Grouped mode clusters; the marks join the head row at the edge.
      if (headAt !== null) pushConnected();
      pushMarks(marks);
    }
  }

  if (groups !== null) {
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
        const more: GrpcTimelineEntry | null = windowed
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
  } else {
    // One event log in call order: walk ascending, drop the head row
    // where the executor recorded it and each mark before the first
    // visible message at or past its position (a filtered-out
    // message never hides a mark), the rest trailing the last
    // message, then read the whole sequence in the sort direction.
    const tokens: Array<number | 'connected' | { mark: number }> = [];
    let connectedPushed = false;
    let nextMark = 0;
    for (const index of visibleRows) {
      if (headAt !== null && !connectedPushed && index >= headAt) {
        tokens.push('connected');
        connectedPushed = true;
      }
      while (nextMark < marks.length && scriptMarks[marks[nextMark]].atIndex <= index) {
        tokens.push({ mark: marks[nextMark] });
        nextMark += 1;
      }
      tokens.push(index);
    }
    if (headAt !== null && !connectedPushed) tokens.push('connected');
    for (; nextMark < marks.length; nextMark++) tokens.push({ mark: marks[nextMark] });
    if (newestFirst) tokens.reverse();
    for (const token of tokens) {
      if (token === 'connected') pushConnected();
      else if (typeof token === 'number') pushRow(token);
      else pushMarks([token.mark]);
    }
  }

  // Bottom chronological edge.
  if (newestFirst) {
    if (groups !== null) {
      pushMarks([...marks].reverse());
      if (headAt !== null) pushConnected();
    }
    pushSent();
  } else {
    if (notice) out.push(notice);
    pushEnded();
  }
  return { entries: out, groupRanges: ranges };
}

/** Each entry's pinned height — a closed function of its kind (the
 *  sent detail's of the recorded pair count). */
export function entryHeights(entries: readonly GrpcTimelineEntry[], sentMetadataCount: number): number[] {
  return entries.map((e) =>
    e.kind === 'viewer'
      ? VIEWER_PX
      : e.kind === 'sentDetail'
        ? sentDetailPx(sentMetadataCount)
        : e.kind === 'errorDetail'
          ? ERROR_DETAIL_PX
          : e.kind === 'connectedDetail'
            ? CONNECTED_DETAIL_PX
            : SINGLE_ROW_PX,
  );
}
