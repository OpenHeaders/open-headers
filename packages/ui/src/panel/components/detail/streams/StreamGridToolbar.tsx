/**
 * Toolbar above a message-stream grid — Clear all, an optional
 * direction filter (Messages only), and the regex filter input. Mirrors
 * the host's Messages / EventStream toolbars; the views own the filter
 * state, this renders the controls.
 */

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
  filterPlaceholder: string;
}

export default function StreamGridToolbar({
  onClear,
  directionFilter,
  filterText,
  onFilterTextChange,
  filterPlaceholder,
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
      <input
        type="text"
        className="dt-stream-toolbar-filter"
        placeholder={filterPlaceholder}
        value={filterText}
        onChange={(e) => onFilterTextChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
