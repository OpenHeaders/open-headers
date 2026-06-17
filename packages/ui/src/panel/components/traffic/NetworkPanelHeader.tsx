import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { type ReactNode, useMemo } from 'react';
import type { FilterConfig } from '../../data/filter-engine';
import { FilterInput } from '../FilterInput';
import { ResourceFilter } from '../ResourceFilter';
import { RESOURCE_FILTER_INFO, SORT_INFO } from './filter-strip-info';

interface NetworkPanelHeaderProps {
  urlFilter: string;
  onUrlFilterChange: (v: string) => void;
  filterConfig: FilterConfig;
  onFilterConfigChange: (cfg: FilterConfig) => void;
  filterError: boolean;
  docsActive: boolean;
  onToggleDocs: () => void;
  filter: ReadonlySet<string>;
  onFilterChange: (next: Set<string>) => void;
  showFilter: boolean;
  onHide: () => void;
  viewMenu: ReactNode;
  sortMenu: ReactNode;
}

export function NetworkPanelHeader({
  urlFilter,
  onUrlFilterChange,
  filterConfig,
  onFilterConfigChange,
  filterError,
  docsActive,
  onToggleDocs,
  filter,
  onFilterChange,
  showFilter,
  onHide,
  viewMenu,
  sortMenu,
}: NetworkPanelHeaderProps) {
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  if (!showFilter) {
    return <PanelHeader wiring={headerWiring} title={<strong>Network</strong>} />;
  }

  return (
    <PanelHeader
      wiring={headerWiring}
      title={
        <div className="dt-network-filter-row">
          <FilterInput
            value={urlFilter}
            onChange={onUrlFilterChange}
            config={filterConfig}
            onConfigChange={onFilterConfigChange}
            hasError={filterError}
            placeholder="Filter"
          />
          <button
            type="button"
            className="dt-toolbar-icon"
            data-active={docsActive}
            onClick={onToggleDocs}
            title="Filter syntax help"
          >
            <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <text
                x="8"
                y="12"
                textAnchor="middle"
                fill="currentColor"
                fontSize="10"
                fontFamily="serif"
                fontStyle="italic"
              >
                i
              </text>
            </svg>
          </button>
          <div className="dt-filter-separator" />
          <span className="dt-debug-control">
            <ResourceFilter value={filter} onChange={onFilterChange} compact />
            <InfoTrigger
              content={RESOURCE_FILTER_INFO}
              className="dt-header-info-trigger dt-debug-info-trigger"
              ariaLabel="About request type filters"
            />
          </span>
          <div className="dt-filter-separator" />
          <span className="dt-debug-control">
            {sortMenu}
            <InfoTrigger
              content={SORT_INFO}
              className="dt-header-info-trigger dt-debug-info-trigger"
              ariaLabel="About sorting"
            />
          </span>
          <div className="dt-filter-separator" />
          {viewMenu}
        </div>
      }
    />
  );
}
