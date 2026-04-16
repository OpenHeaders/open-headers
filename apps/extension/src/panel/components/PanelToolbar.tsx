import type React from 'react';
import type { FilterConfig } from '../data/filter-engine';
import { FilterInput } from './FilterInput';
import { ResourceFilter } from './ResourceFilter';
import { RuleExecutionsHint } from './RuleExecutions';

function IconRecord({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M1 3h14M4 8h8M6 13h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface PanelToolbarProps {
  recording: boolean;
  onToggleRecording: () => void;
  onClear: () => void;
  showFilter: boolean;
  onToggleFilter: () => void;
  searchActive: boolean;
  onToggleSearch: () => void;
  preserveLog: boolean;
  onPreserveLogChange: (v: boolean) => void;
  rulesVisible: boolean;
  urlFilter: string;
  onUrlFilterChange: (v: string) => void;
  filterConfig: FilterConfig;
  onFilterConfigChange: (c: FilterConfig) => void;
  filterError: boolean;
  docsState: 'focused' | 'active' | undefined;
  onToggleDocs: () => void;
  filter: Set<string>;
  onFilterChange: (v: Set<string>) => void;
}

export const PanelToolbar: React.FC<PanelToolbarProps> = ({
  recording,
  onToggleRecording,
  onClear,
  showFilter,
  onToggleFilter,
  searchActive,
  onToggleSearch,
  preserveLog,
  onPreserveLogChange,
  rulesVisible,
  urlFilter,
  onUrlFilterChange,
  filterConfig,
  onFilterConfigChange,
  filterError,
  docsState,
  onToggleDocs,
  filter,
  onFilterChange,
}) => (
  <div className="dt-header">
    <div className="dt-toolbar">
      <button
        type="button"
        className="dt-toolbar-icon dt-toolbar-icon--record"
        data-active={recording}
        onClick={onToggleRecording}
        title={recording ? 'Stop recording' : 'Record network log'}
      >
        <IconRecord active={recording} />
      </button>
      <button type="button" className="dt-toolbar-icon" onClick={onClear} title="Clear network log">
        <IconClear />
      </button>
      <div className="dt-toolbar-separator" />
      <button
        type="button"
        className="dt-toolbar-icon"
        data-active={showFilter}
        onClick={onToggleFilter}
        title="Filter"
      >
        <IconFilter />
      </button>
      <button
        type="button"
        className="dt-toolbar-icon"
        data-active={searchActive}
        onClick={onToggleSearch}
        title="Search"
      >
        <IconSearch />
      </button>
      <div className="dt-toolbar-separator" />
      <label className="dt-checkbox">
        <input type="checkbox" checked={preserveLog} onChange={(e) => onPreserveLogChange(e.target.checked)} />
        Preserve log
      </label>
      {rulesVisible && (
        <>
          <div className="dt-toolbar-separator" />
          <RuleExecutionsHint />
        </>
      )}
    </div>
    {showFilter && (
      <div className="dt-filter-bar">
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
          data-state={docsState}
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
        <ResourceFilter value={filter} onChange={onFilterChange} />
      </div>
    )}
  </div>
);
