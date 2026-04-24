import { Popover } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getBrowserAPI } from '@/types/browser';
import type { FilterConfig } from '../data/filter-engine';
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

function IconDownload() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path
        d="M8 2v8m0 0l-3-3m3 3l3-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 13h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "More filters ▾" dropdown — mirrors Chrome's Network panel convention
 * of tucking secondary filters (data URLs, third-party) behind a
 * compact menu rather than eating first-class toolbar space. Each item
 * is a checkbox; toggling does not close the popover so the user can
 * flip multiple filters in one gesture.
 */
function MoreFiltersMenu({
  filterConfig,
  onFilterConfigChange,
  cacheBypassEnabled,
  onToggleCacheBypass,
}: {
  filterConfig: FilterConfig;
  onFilterConfigChange: (cfg: FilterConfig) => void;
  cacheBypassEnabled: boolean;
  onToggleCacheBypass: () => void;
}) {
  const thirdPartyReady = filterConfig.pageOrigin != null;
  const flags = [
    filterConfig.hideDataUrls,
    filterConfig.hideExtensionUrls,
    filterConfig.onlyBlockedRequests,
    filterConfig.onlyThirdParty,
    cacheBypassEnabled,
  ];
  const activeCount = flags.reduce((n, v) => n + (v ? 1 : 0), 0);
  const active = activeCount > 0;

  const content = (
    <div className="dt-morefilters-menu">
      {/* Hide-* filters: exclude matching rows from the list. */}
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.hideDataUrls}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, hideDataUrls: e.target.checked })}
        />
        Hide data URLs
      </label>
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.hideExtensionUrls}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, hideExtensionUrls: e.target.checked })}
        />
        Hide extension URLs
      </label>
      <div className="dt-morefilters-divider" />
      {/* Only-* filters: restrict the list to matching rows. */}
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.onlyBlockedRequests}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, onlyBlockedRequests: e.target.checked })}
        />
        Blocked requests
      </label>
      <label
        className={`dt-morefilters-item${!thirdPartyReady ? ' dt-morefilters-item--disabled' : ''}`}
        title={!thirdPartyReady ? 'Page origin not yet available' : undefined}
      >
        <input
          type="checkbox"
          checked={filterConfig.onlyThirdParty}
          disabled={!thirdPartyReady}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, onlyThirdParty: e.target.checked })}
        />
        3rd-party requests
      </label>
      <div className="dt-morefilters-divider" />
      {/* Debugging tools — non-filter toggles that affect how requests
          are fetched rather than how they're displayed. */}
      <label
        className="dt-morefilters-item"
        title="Adds Cache-Control: no-cache to every request on this tab, forcing revalidation with the server. Only bypasses the HTTP cache — Chrome's own Disable Cache (in the Network tab) additionally bypasses the renderer memory cache. Rule-matched requests stay fresh automatically via Live Rules Mode."
      >
        <input type="checkbox" checked={cacheBypassEnabled} onChange={onToggleCacheBypass} />
        Bypass HTTP Cache
      </label>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      overlayClassName="dt-morefilters-popover"
    >
      <button type="button" className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}>
        More filters
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}

function ExportMenu({ onExport, onCopy, disabled }: { onExport: () => void; onCopy: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="dt-export-menu-wrap">
      <button
        type="button"
        className="dt-toolbar-icon"
        onClick={() => !disabled && setOpen((v) => !v)}
        title="Export traffic"
        disabled={disabled}
      >
        <IconDownload />
      </button>
      {open && (
        <div className="dt-ctx-menu dt-export-menu">
          <button
            type="button"
            className="dt-ctx-item"
            onClick={() => {
              onExport();
              setOpen(false);
            }}
          >
            Export all as HAR
          </button>
          <button
            type="button"
            className="dt-ctx-item"
            onClick={() => {
              onCopy();
              setOpen(false);
            }}
          >
            Copy all as HAR
          </button>
        </div>
      )}
    </div>
  );
}

export interface PanelToolbarProps {
  recording: boolean;
  onToggleRecording: () => void;
  onClear: () => void;
  /** Toggles the filter strip inside the Network panel's header —
   *  kept as a global escape hatch so the user can collapse it to
   *  reclaim the 32px row without closing the Network panel. */
  showFilter: boolean;
  onToggleFilter: () => void;
  searchActive: boolean;
  onToggleSearch: () => void;
  preserveLog: boolean;
  onPreserveLogChange: (v: boolean) => void;
  rulesVisible: boolean;
  filterConfig: FilterConfig;
  onFilterConfigChange: (c: FilterConfig) => void;
  onExportHar: () => void;
  onCopyAllHar: () => void;
  canExport: boolean;
  /** "Bypass HTTP Cache" toggle — lives inside the More-filters
   *  overflow dropdown. DNR-backed, scoped to the inspected tab.
   *  See `use-cache-bypass.ts` for lifecycle. */
  cacheBypassEnabled: boolean;
  onToggleCacheBypass: () => void;
  /** Whether the activity bar renders labels. When false, the brand
   *  column collapses to icon-only so its right border aligns with
   *  the compact activity bar below it. */
  showToolWindowLabels: boolean;
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
  filterConfig,
  onFilterConfigChange,
  onExportHar,
  onCopyAllHar,
  canExport,
  cacheBypassEnabled,
  onToggleCacheBypass,
  showToolWindowLabels,
}) => (
  <div className="dt-header">
    <div className={`dt-brand${showToolWindowLabels ? '' : ' dt-brand--compact'}`}>
      <img src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')} alt="Open Headers" className="dt-brand-logo" />
      {showToolWindowLabels && (
        <span className="dt-brand-title">
          <span className="dt-brand-title-line">Open</span>
          <span className="dt-brand-title-line">Headers</span>
        </span>
      )}
    </div>
    <div className="dt-header-rows">
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
        <MoreFiltersMenu
          filterConfig={filterConfig}
          onFilterConfigChange={onFilterConfigChange}
          cacheBypassEnabled={cacheBypassEnabled}
          onToggleCacheBypass={onToggleCacheBypass}
        />
        <div className="dt-toolbar-separator" />
        <ExportMenu onExport={onExportHar} onCopy={onCopyAllHar} disabled={!canExport} />
        {rulesVisible && (
          <>
            <div className="dt-toolbar-separator" />
            <RuleExecutionsHint />
          </>
        )}
      </div>
    </div>
    <div className={`dt-brand-spacer${showToolWindowLabels ? '' : ' dt-brand-spacer--compact'}`} aria-hidden="true" />
  </div>
);
