import { ToolbarMenuPopover } from '../../ToolbarMenuPopover';
import type { SortMode } from './tree-model';

/** `More filters ▾` — boolean toggles that narrow the visible rows. */
export function InitiatorMoreFiltersMenu({
  failuresOnly,
  thirdPartyOnly,
  onToggleFailuresOnly,
  onToggleThirdPartyOnly,
}: {
  failuresOnly: boolean;
  thirdPartyOnly: boolean;
  onToggleFailuresOnly: () => void;
  onToggleThirdPartyOnly: () => void;
}) {
  const activeCount = [failuresOnly, thirdPartyOnly].reduce((n, v) => n + (v ? 1 : 0), 0);
  return (
    <ToolbarMenuPopover label="More filters" activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={failuresOnly} onChange={onToggleFailuresOnly} />
        Failures only
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={thirdPartyOnly} onChange={onToggleThirdPartyOnly} />
        3rd-party only
      </label>
    </ToolbarMenuPopover>
  );
}

/** `View ▾` — children sort + show-suggestions toggle. */
export function InitiatorViewMenu({
  sortMode,
  showInsights,
  onSortChange,
  onToggleShowInsights,
}: {
  sortMode: SortMode;
  showInsights: boolean;
  onSortChange: (mode: SortMode) => void;
  onToggleShowInsights: () => void;
}) {
  const activeCount = (sortMode !== 'initiator' ? 1 : 0) + (!showInsights ? 1 : 0);
  return (
    <ToolbarMenuPopover label="View" activeCount={activeCount}>
      <label className="dt-morefilters-item dt-morefilters-item--select">
        <span className="dt-morefilters-item-label">Sort</span>
        <select value={sortMode} onChange={(e) => onSortChange(e.target.value as SortMode)}>
          <option value="initiator">Initiator order</option>
          <option value="chronological">Chronological</option>
          <option value="largest">Largest subtree</option>
        </select>
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        Show suggestions
      </label>
    </ToolbarMenuPopover>
  );
}
