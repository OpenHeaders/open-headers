/**
 * Toolbar above a message-stream grid — Clear all, an optional
 * direction filter (Messages only), the standard filter input
 * (Aa / ab / .* toggles + clear), an optional action button right of
 * it and an optional right-aligned `View ▾` menu (Messages only),
 * which also carries the grid/payload split orientation. Mirrors the
 * host's Messages / EventStream toolbars; the views own the filter
 * state, this renders the controls.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
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
  const t = useT();
  return (
    <div className="dt-stream-toolbar">
      <button
        type="button"
        className="dt-stream-toolbar-clear"
        onClick={onClear}
        title={t('panel.inspector.streams.clearAll')}
        aria-label={t('panel.inspector.streams.clearAll')}
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
          title={t('panel.inspector.streams.directionFilterTitle')}
        >
          <option value="all">{t('panel.inspector.streams.directionAll')}</option>
          <option value="send">{t('panel.inspector.streams.directionSend')}</option>
          <option value="receive">{t('panel.inspector.streams.directionReceive')}</option>
        </select>
      )}
      <FilterInput
        value={filterText}
        onChange={onFilterTextChange}
        config={filterConfig}
        onConfigChange={onFilterConfigChange}
        hasError={filterError}
        placeholder={filterPlaceholder}
        ariaLabel={t('panel.inspector.streams.filterAria')}
      />
      {action}
      {viewMenu && <span className="dt-stream-toolbar-layout">{viewMenu}</span>}
    </div>
  );
}
