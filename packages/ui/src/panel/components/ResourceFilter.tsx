import { Popover } from 'antd';
import { useState } from 'react';

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'xhr', label: 'Fetch/XHR' },
  { key: 'doc', label: 'Doc' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JS' },
  { key: 'font', label: 'Font' },
  { key: 'img', label: 'Img' },
  { key: 'media', label: 'Media' },
  { key: 'manifest', label: 'Manifest' },
  { key: 'ws', label: 'Socket' },
  { key: 'wasm', label: 'Wasm' },
  { key: 'other', label: 'Other' },
];

/** Keys shown inline when `compact` is on — the rest collapse into a
 *  "More ▾" dropdown. `all` always leads; the remaining three cover
 *  the network-activity types people filter to most often (API traffic,
 *  realtime channels, binary modules). Everything still reachable via
 *  "More" — nothing is ever hidden, just demoted one click. */
const COMPACT_INLINE_KEYS = new Set(['all', 'xhr', 'ws', 'wasm']);

interface ResourceFilterProps {
  value: ReadonlySet<string>;
  onChange: (value: Set<string>) => void;
  /** Compact mode renders only the inline keys + a "More ▾" popover
   *  with the remainder. Designed for narrow surfaces like the Network
   *  panel's PanelHeader row. */
  compact?: boolean;
}

export function ResourceFilter({ value, onChange, compact }: ResourceFilterProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isAll = value.size === 0;

  const handleClick = (key: string) => {
    if (key === 'all') {
      onChange(new Set());
      return;
    }
    const next = new Set(value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  const inlineFilters = compact ? FILTERS.filter((f) => COMPACT_INLINE_KEYS.has(f.key)) : FILTERS;
  const overflowFilters = compact ? FILTERS.filter((f) => !COMPACT_INLINE_KEYS.has(f.key)) : [];
  // Count of active filters that live in the overflow dropdown — used
  // to tint the "More ▾" trigger when any of them are on, so the user
  // knows a filter is engaged even when it isn't visible inline.
  const overflowActiveCount = overflowFilters.reduce((n, f) => n + (value.has(f.key) ? 1 : 0), 0);

  const moreContent = (
    <div className="dt-filter-pills dt-filter-pills--vertical dt-scrollbar">
      {overflowFilters.map((f) => (
        <button
          key={f.key}
          type="button"
          className="dt-filter-pill"
          data-active={value.has(f.key)}
          onClick={() => handleClick(f.key)}
        >
          {f.label}
        </button>
      ))}
      <div className="dt-morefilters-divider" />
      {/* Default is "All" (no type filters) — reset clears every active type,
       * inline ones included, not just the overflow pills shown here. */}
      <button type="button" className="dt-morefilters-reset" onClick={() => onChange(new Set())} disabled={isAll}>
        Reset to default
      </button>
    </div>
  );

  return (
    <div className="dt-filter-pills">
      {inlineFilters.map((f) => (
        <button
          key={f.key}
          type="button"
          className="dt-filter-pill"
          data-active={f.key === 'all' ? isAll : value.has(f.key)}
          onClick={() => handleClick(f.key)}
        >
          {f.label}
        </button>
      ))}
      {compact && (
        <Popover
          content={moreContent}
          trigger="click"
          placement="bottomRight"
          open={moreOpen}
          onOpenChange={setMoreOpen}
          overlayClassName="dt-filter-pills-popover"
        >
          <button type="button" className="dt-filter-pill" data-active={overflowActiveCount > 0}>
            More
            {overflowActiveCount > 0 ? ` (${overflowActiveCount})` : ''}
            <span className="dt-filter-pill-caret">{'▾'}</span>
          </button>
        </Popover>
      )}
    </div>
  );
}
