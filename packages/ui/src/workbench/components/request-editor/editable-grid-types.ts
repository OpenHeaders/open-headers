/**
 * Contracts for `EditableGridTable` — the row-shape adapter, bulk-edit
 * hooks, suggestion rows, inline-conflict bridge and the table's props.
 * See the component's header doc for the shared-vs-varying breakdown.
 */

import type { PathConflict } from '@openheaders/ui/shared/conflicts/types';
import type React from 'react';

/** Read-only informational row rendered above user rows — e.g. Headers'
 *  browser-managed auto-generated entries. Not draggable, not part of
 *  the sortable context. */
export interface SuggestionRow {
  key: string;
  value: string;
  /** Tooltip body shown under the info icon on the Key cell. */
  hint?: string;
  /** Current enable state — toggled by the row's checkbox. */
  enabled: boolean;
  /** Omit for a locked, always-applied preview row (e.g. an
   *  auth-derived `Authorization` header) — the checkbox renders
   *  disabled since the row can't be toggled off from here. */
  onToggle?: (next: boolean) => void;
}

/**
 * Row-shape adapter: lets the shell read/write the four common fields
 * (id, enabled, key, description) plus ghost-row hooks without the
 * shell knowing the concrete row type.
 */
export interface EditableRowAdapter<Row> {
  getId: (row: Row) => string;
  getEnabled: (row: Row) => boolean;
  setEnabled: (row: Row, value: boolean) => Row;
  getKey: (row: Row) => string;
  setKey: (row: Row, value: string) => Row;
  getDescription: (row: Row) => string;
  setDescription: (row: Row, value: string) => Row;
  /** Produce a fresh empty row. Called every time the user fills in
   *  the ghost row so a new ghost appears below. */
  makeEmpty: () => Row;
  /** Return true when `row` is still the empty-ghost shape — used to
   *  auto-append / auto-trim the trailing ghost row. */
  isEmpty: (row: Row) => boolean;
}

/** Bulk-edit config: pluggable parse/serialize hooks so each table
 *  can pick its own textarea format (Params uses `key:value`,
 *  Headers uses `key: value`, form-urlencoded uses `key=value`). */
export interface BulkEditConfig<Row> {
  serialize: (rows: Row[]) => string;
  parse: (text: string) => Row[];
  placeholder?: string;
}

export interface EditableGridTableProps<Row> {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  adapter: EditableRowAdapter<Row>;
  /** Render the Value cell. The shell owns layout + borders; the
   *  caller owns the control inside the cell. `update(next)` commits
   *  a full row replacement. */
  renderValueCell: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  /** Optional override for the Key cell's control. Same contract as
   *  `renderValueCell` — when omitted the shell renders a plain
   *  `<Input>`. Callers that want a rich field (e.g. `TemplateInput`
   *  for `{{ref}}` highlighting + a scrollable overflow) pass this. */
  renderKeyCell?: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  /** Optional override for the Description cell's control. Same
   *  contract as `renderValueCell`; omit for the default `<Input>`. */
  renderDescriptionCell?: (
    row: Row,
    update: (next: Row) => void,
    context: { isPlaceholder: boolean; dim: boolean; expanded: boolean },
  ) => React.ReactNode;
  keyPlaceholder?: string;
  hideEnabled?: boolean;
  suggestionRows?: SuggestionRow[];
  /** Enable the "Bulk Edit" toggle in the header. When the user
   *  clicks it, the table swaps for a textarea with the serialized
   *  rows; clicking again parses the textarea back into rows. */
  bulkEdit?: BulkEditConfig<Row>;
  /** Per-column width overrides — default is `minmax(0, 1fr)` for each
   *  of Key / Value / Description (flex to fit, no fixed min). */
  columnWidths?: {
    key?: string;
    value?: string;
    description?: string;
  };
  /** Optional per-cell awareness path. When provided, the Key / Value
   *  / Description cells of each row are wrapped with a layout-neutral
   *  `data-field-path` span so a focus-capture ancestor walk resolves
   *  to the canonical schema path (`headers.<uid>.value`,
   *  `params.<uid>.key`). Receives the row's stable id (per
   *  `adapter.getId`) so callers can build uid-keyed paths that
   *  survive reorders + cross-surface joins. The trailing placeholder
   *  ghost reuses its synthesized id; once the user types into it the
   *  row materializes with that same id. */
  rowPath?: (rowId: string, leaf: 'key' | 'value' | 'description') => string;
  /** Inline conflict bridge — when supplied, each row's Key / Value /
   *  Description cell renders a `<ConflictDiffChip>` when the entity-level
   *  conflict tracker reports a leaf conflict at the matching `rowPath`,
   *  and a `<SetRowConflictChip>` when the saved version dropped this row
   *  but the form still has it. Mirrors the bridge shape used by
   *  `VariableTable` + `HeaderRuleFields` so the same tracker primitives
   *  feed every editor. */
  conflictBridge?: KeyValueRowConflictBridge;
}

/** Inline-conflict bridge for rows in the shared editable grid. The
 *  table calls `getLeafConflict(rowPath(uid, leaf), local)` on every
 *  cell and renders the chip when the result is non-null. The set
 *  chip surfaces a "saved version removed this row" affordance — the
 *  table calls `getSetConflict(setPath, uid, true)` once per row. */
export interface KeyValueRowConflictBridge {
  /** Schema-aligned set path (e.g. `'headers'` / `'params'`). Used to
   *  encode the set-level accept/dismiss path: `set:<setPath>.<uid>`. */
  setPath: string;
  getLeafConflict(path: string, local: string): PathConflict | null;
  getSetConflict?(setPath: string, uid: string, formContainsUid: boolean): PathConflict | null;
  onAcceptTheirs(path: string, theirs: string): void;
  onDismiss(path: string): void;
}
