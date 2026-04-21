/**
 * Shared types, constants, and utilities used by table components
 * (ThisPageRules, HeaderTable, RulesList).
 */

export interface PageInfo {
  visibleRowCount: number;
  visibleRowIds: readonly (string | number)[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}

export interface RowActions {
  onToggleRow?: (index: number) => void;
  onEditRow?: (index: number) => void;
  onCopyRow?: (index: number) => void;
  onDeleteRow?: (index: number) => void;
  onAddRule?: () => void;
  /** Expand a tree node at this flat index (tree tables only). */
  onExpandRow?: (index: number) => void;
  /** Collapse a tree node at this flat index (tree tables only). */
  onCollapseRow?: (index: number) => void;
  /**
   * Pause or resume the focused row. Distinct from `onToggleRow`: in
   * CollectionManager `Space` flips rule `enabled` vs collection pause
   * depending on node type, whereas `onPauseRow` is always pause-only
   * and applies to workbench, folders, and collections alike. Only the
   * Collections tab wires this in today.
   */
  onPauseRow?: (index: number) => void;
}

export const PAGE_SIZE = 10;

// ── Sort utilities ──────────────────────────────────────────────

import { DNR_PRIORITY } from '@openheaders/core/utils';

export type SortMode = 'status' | 'priority' | 'manual';

interface Sortable {
  statusRank: number;
  ruleType: string;
  name: string;
  /**
   * Lower = stronger verdict signal on the current tab. Optional
   * because non-tab-scoped tables (e.g. the full RulesList /
   * RulesTable) don't have verdicts — they always pass undefined and
   * land on the existing sort paths. When set, it acts as the PRIMARY
   * sort key so firing workbench always top silent always top page etc.,
   * regardless of which secondary sort mode the user picked. See
   * `VERDICT_RANK` in `@/shared/verdict` for the canonical ordering.
   */
  verdictRank?: number;
}

/**
 * Compare two sortable items by the selected sort mode.
 * - status: status rank → browser priority → alphabetical
 * - priority: browser priority → alphabetical
 * - manual: preserve original order
 *
 * When both items expose a `verdictRank`, that becomes the primary key
 * — keeping firing workbench above silent above page above related
 * regardless of the secondary mode. This matches how users read the
 * popup: "what's actively affecting this page?" is always the first
 * question; name / status / priority are tiebreakers.
 */
export function compareBySortMode<T extends Sortable>(a: T, b: T, mode: SortMode): number {
  if (a.verdictRank !== undefined && b.verdictRank !== undefined) {
    if (a.verdictRank !== b.verdictRank) return a.verdictRank - b.verdictRank;
  }
  if (mode === 'status') {
    if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank;
    const pa = DNR_PRIORITY[a.ruleType] ?? 0;
    const pb = DNR_PRIORITY[b.ruleType] ?? 0;
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name);
  }
  if (mode === 'priority') {
    const pa = DNR_PRIORITY[a.ruleType] ?? 0;
    const pb = DNR_PRIORITY[b.ruleType] ?? 0;
    return pb - pa || a.name.localeCompare(b.name);
  }
  return 0;
}

export const TAG_COLORS = [
  'blue',
  'volcano',
  'green',
  'purple',
  'orange',
  'cyan',
  'magenta',
  'gold',
  'geekblue',
  'red',
] as const;

export function getTagColor(tag: string): string {
  let hash = 5381;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash * 33) ^ tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length];
}
