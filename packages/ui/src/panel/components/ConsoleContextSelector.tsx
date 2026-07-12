/**
 * Console context selector (JS contexts Phase C) — the dropdown in the
 * Console header that mirrors the browser console's context picker. It
 * chooses the evaluation context (Phase D) and cues "you're not where you
 * think you are": the trigger picks up a warning tint whenever the current
 * selection is not `top` while a `top` exists. It does NOT filter the log —
 * that is the separate "Selected context only" toggle in the `⋯` menu.
 *
 * Rendering rides the panel's own dropdown vocabulary
 * (`ToolbarMenuPopover` + `dt-sortmode-item` rows); rows indent by the
 * model's depth and check the effective selection. Hidden entirely while
 * the registry is empty (nothing to pick — the tab is not CDP-owned yet).
 */

import { CheckOutlined } from '@ant-design/icons';
import type { JsContext } from '@openheaders/core/js-contexts';
import { useMemo } from 'react';
import { type ConsoleContextRow, consoleContextRows, topContextKey } from '../data/console-context-selector';
import { ToolbarMenuPopover } from './ToolbarMenuPopover';

export interface ConsoleContextSelectorProps {
  contexts: readonly JsContext[];
  /** The resolved effective selection (`resolveContextSelection`). */
  effectiveKey: string | null;
  onSelect: (contextKey: string) => void;
}

export function ConsoleContextSelector({ contexts, effectiveKey, onSelect }: ConsoleContextSelectorProps) {
  const rows = useMemo(() => consoleContextRows(contexts), [contexts]);
  if (rows.length === 0) return null;

  const effective = rows.find((row) => row.context.contextKey === effectiveKey) ?? rows[0];
  const warn = topContextKey(contexts) !== null && !effective.isTop;

  return (
    <span
      className={`dt-console-context${warn ? ' dt-console-context--warn' : ''}`}
      title="JavaScript context — where console commands evaluate"
    >
      <ToolbarMenuPopover label={truncateLabel(effective.label)} activeCount={0} active={false} placement="bottomLeft">
        {rows.map((row) => (
          <ContextRowView
            key={row.context.contextKey}
            row={row}
            active={row.context.contextKey === effective.context.contextKey}
            onSelect={onSelect}
          />
        ))}
      </ToolbarMenuPopover>
    </span>
  );
}

/** Keep the trigger compact — a full SW script URL would swallow the header
 *  row (the flex trigger holds a bare text node, so CSS ellipsis can't). */
function truncateLabel(label: string): string {
  return label.length > 32 ? `${label.slice(0, 31)}…` : label;
}

function ContextRowView({
  row,
  active,
  onSelect,
}: {
  row: ConsoleContextRow;
  active: boolean;
  onSelect: (contextKey: string) => void;
}) {
  return (
    <button
      type="button"
      className="dt-sortmode-item dt-console-context-item"
      data-depth={row.depth}
      onClick={() => onSelect(row.context.contextKey)}
    >
      <div className="dt-sortmode-item-body">
        <div className="dt-sortmode-item-title">{row.label}</div>
        {row.subtitle !== null && <div className="dt-sortmode-item-subtitle">{row.subtitle}</div>}
      </div>
      {active && (
        <span className="dt-sortmode-item-check" aria-hidden="true">
          <CheckOutlined />
        </span>
      )}
    </button>
  );
}
