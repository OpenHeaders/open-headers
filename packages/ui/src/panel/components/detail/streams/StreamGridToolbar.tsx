/**
 * Toolbar above a message-stream grid — Clear all, an optional
 * direction filter (Messages only), the standard filter input
 * (Aa / ab / .* toggles + clear), an optional action button right of
 * it and an optional right-aligned `View ▾` menu (Messages only),
 * which also carries the grid/payload split orientation. Mirrors the
 * host's Messages / EventStream toolbars; the views own the filter
 * state, this renders the controls.
 */

import type { ReactNode } from 'react';
import type { TextMatchConfig } from '../../../data/text-match';
import { FilterInput } from '../../FilterInput';

export type WsDirectionFilter = 'all' | 'send' | 'receive';

interface StreamGridToolbarProps {
  onClear: () => void;
  /** Present on the Messages tab only — All / Send / Receive. */
  directionFilter?: {
    value: WsDirectionFilter;
    onChange: (value: WsDirectionFilter) => void;
  };
  filterText: string;
  onFilterTextChange: (text: string) => void;
  filterConfig: TextMatchConfig;
  onFilterConfigChange: (config: TextMatchConfig) => void;
  filterError: boolean;
  filterPlaceholder: string;
  /** Optional action button rendered right of the filter input —
   *  the Messages tab's connection-scoped "Override message". */
  action?: ReactNode;
  /** Present on the Messages tab only — the `View ▾` options menu,
   *  right-aligned after the action button. */
  viewMenu?: ReactNode;
}

export default function StreamGridToolbar({
  onClear,
  directionFilter,
  filterText,
  onFilterTextChange,
  filterConfig,
  onFilterConfigChange,
  filterError,
  filterPlaceholder,
  action,
  viewMenu,
}: StreamGridToolbarProps) {
  return (
    <div className="dt-stream-toolbar">
      <button
        type="button"
        className="dt-stream-toolbar-clear"
        onClick={onClear}
        title="Clear all"
        aria-label="Clear all"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="3.2" y1="10.8" x2="10.8" y2="3.2" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {directionFilter && (
        <select
          className="dt-stream-toolbar-select"
          value={directionFilter.value}
          onChange={(e) => directionFilter.onChange(e.target.value as WsDirectionFilter)}
          title="Filter by direction"
        >
          <option value="all">All</option>
          <option value="send">Send</option>
          <option value="receive">Receive</option>
        </select>
      )}
      <FilterInput
        value={filterText}
        onChange={onFilterTextChange}
        config={filterConfig}
        onConfigChange={onFilterConfigChange}
        hasError={filterError}
        placeholder={filterPlaceholder}
        ariaLabel="Filter stream messages"
      />
      {action}
      {viewMenu && <span className="dt-stream-toolbar-layout">{viewMenu}</span>}
    </div>
  );
}
