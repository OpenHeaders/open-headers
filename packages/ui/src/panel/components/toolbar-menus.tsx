/**
 * PanelToolbar's dropdown menus — the More-filters and Footer-View
 * checkbox popovers plus the HAR export menu.
 */

import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useIsModified, useResetSetting, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { FilterConfig } from '../data/filter-engine';
import { ToolbarMenuPopover } from './ToolbarMenuPopover';

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
export function MoreFiltersMenu({
  filterConfig,
  onFilterConfigChange,
}: {
  filterConfig: FilterConfig;
  onFilterConfigChange: (cfg: FilterConfig) => void;
}) {
  const t = useT();
  const thirdPartyReady = filterConfig.pageOrigin != null;
  const flags = [
    filterConfig.hideDataUrls,
    filterConfig.hideExtensionUrls,
    filterConfig.onlyBlockedRequests,
    filterConfig.onlyThirdParty,
  ];
  const activeCount = flags.reduce((n, v) => n + (v ? 1 : 0), 0);
  const active = activeCount > 0;

  return (
    <ToolbarMenuPopover label={t('panel.moreFilters.label')} activeCount={activeCount} placement="bottomLeft">
      {/* Hide-* filters: exclude matching rows from the list. */}
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.hideDataUrls}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, hideDataUrls: e.target.checked })}
        />
        {t('panel.moreFilters.hideDataUrls')}
      </label>
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.hideExtensionUrls}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, hideExtensionUrls: e.target.checked })}
        />
        {t('panel.moreFilters.hideExtensionUrls')}
      </label>
      <div className="dt-morefilters-divider" />
      {/* Only-* filters: restrict the list to matching rows. */}
      <label className="dt-morefilters-item">
        <input
          type="checkbox"
          checked={filterConfig.onlyBlockedRequests}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, onlyBlockedRequests: e.target.checked })}
        />
        {t('panel.moreFilters.blockedRequests')}
      </label>
      <label
        className={`dt-morefilters-item${!thirdPartyReady ? ' dt-morefilters-item--disabled' : ''}`}
        title={!thirdPartyReady ? t('panel.moreFilters.pageOriginPending') : undefined}
      >
        <input
          type="checkbox"
          checked={filterConfig.onlyThirdParty}
          disabled={!thirdPartyReady}
          onChange={(e) => onFilterConfigChange({ ...filterConfig, onlyThirdParty: e.target.checked })}
        />
        {t('panel.moreFilters.thirdParty')}
      </label>
      <div className="dt-morefilters-divider" />
      <button
        type="button"
        className="dt-morefilters-reset"
        disabled={!active}
        onClick={() => {
          onFilterConfigChange({
            ...filterConfig,
            hideDataUrls: false,
            hideExtensionUrls: false,
            onlyBlockedRequests: false,
            onlyThirdParty: false,
          });
        }}
      >
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}

/**
 * "View ▾" dropdown — toggles which optional stats the footer shows.
 * Same checkbox-popover idiom as More filters; each toggle is a `user`
 * setting so the choice persists across panels. The badge counts the
 * stats currently surfaced beyond the always-on counts.
 */
export function ViewMenu() {
  const t = useT();
  const [footerScope, setFooterScope] = useSetting('devpanelLayout.footerScope');
  const [showModified, setShowModified] = useSetting('devpanelLayout.footerShowModified');
  const [showFailed, setShowFailed] = useSetting('devpanelLayout.footerShowFailed');
  const [showCached, setShowCached] = useSetting('devpanelLayout.footerShowCached');
  const [showPageContext, setShowPageContext] = useSetting('devpanelLayout.footerShowPageContext');
  const [timingMode, setTimingMode] = useSetting('devpanelLayout.footerTimingMode');

  const resetFooterScope = useResetSetting('devpanelLayout.footerScope');
  const resetModified = useResetSetting('devpanelLayout.footerShowModified');
  const resetFailed = useResetSetting('devpanelLayout.footerShowFailed');
  const resetCached = useResetSetting('devpanelLayout.footerShowCached');
  const resetPageContext = useResetSetting('devpanelLayout.footerShowPageContext');
  const resetTimingMode = useResetSetting('devpanelLayout.footerTimingMode');
  // Reset is offered only when something actually differs from the defaults.
  // Each hook is called unconditionally and folded afterwards — chaining the
  // calls through `||` directly would short-circuit once one is true, skipping
  // the rest and changing the hook count between renders (React error #300).
  const footerScopeDirty = useIsModified('devpanelLayout.footerScope');
  const modifiedDirty = useIsModified('devpanelLayout.footerShowModified');
  const failedDirty = useIsModified('devpanelLayout.footerShowFailed');
  const cachedDirty = useIsModified('devpanelLayout.footerShowCached');
  const pageContextDirty = useIsModified('devpanelLayout.footerShowPageContext');
  const timingModeDirty = useIsModified('devpanelLayout.footerTimingMode');
  const anyModified =
    footerScopeDirty || modifiedDirty || failedDirty || cachedDirty || pageContextDirty || timingModeDirty;

  const flags = [showModified, showFailed, showCached, showPageContext];
  const activeCount = flags.reduce((n, v) => n + (v ? 1 : 0), 0);

  return (
    <ToolbarMenuPopover
      label={t('panel.view.label')}
      activeCount={activeCount}
      active={false}
      placement="bottomLeft"
      title={t('panel.view.title')}
    >
      {/* Footer scope — a radio pair: the summary follows the focused
          tool window (Storage/Console/Search get their own lines), or
          always shows the Network figures. */}
      <label className="dt-morefilters-item" title={t('panel.view.focusedToolTitle')}>
        <input
          type="radio"
          name="dt-footer-scope"
          checked={footerScope === 'focused'}
          onChange={() => setFooterScope('focused')}
        />
        {t('panel.view.focusedTool')}
      </label>
      <label className="dt-morefilters-item" title={t('panel.view.networkOnlyTitle')}>
        <input
          type="radio"
          name="dt-footer-scope"
          checked={footerScope === 'network'}
          onChange={() => setFooterScope('network')}
        />
        {t('panel.view.networkOnly')}
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showModified} onChange={(e) => setShowModified(e.target.checked)} />
        {t('panel.view.modifiedCount')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFailed} onChange={(e) => setShowFailed(e.target.checked)} />
        {t('panel.view.failedCount')}
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showCached} onChange={(e) => setShowCached(e.target.checked)} />
        {t('panel.view.cachedCount')}
      </label>
      <div className="dt-morefilters-divider" />
      <label className="dt-morefilters-item" title={t('panel.view.pageLabelTitle')}>
        <input type="checkbox" checked={showPageContext} onChange={(e) => setShowPageContext(e.target.checked)} />
        {t('panel.view.pageLabel')}
      </label>
      <label className="dt-morefilters-item" title={t('panel.view.timingAllNavsTitle')}>
        <input
          type="checkbox"
          checked={timingMode !== 'lastNav'}
          onChange={(e) => setTimingMode(e.target.checked ? 'aggregate' : 'lastNav')}
        />
        {t('panel.view.timingAllNavs')}
      </label>
      <div className="dt-morefilters-divider" />
      <button
        type="button"
        className="dt-morefilters-reset"
        disabled={!anyModified}
        onClick={() => {
          resetFooterScope();
          resetModified();
          resetFailed();
          resetCached();
          resetPageContext();
          resetTimingMode();
        }}
      >
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}

export function ExportMenu({
  onExport,
  onCopy,
  disabled,
}: { onExport: (sanitize?: boolean) => void; onCopy: (sanitize?: boolean) => void; disabled: boolean }) {
  const t = useT();
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
        title={t('panel.export.title')}
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
              onExport(false);
              setOpen(false);
            }}
          >
            {t('panel.export.exportAll')}
          </button>
          <button
            type="button"
            className="dt-ctx-item"
            onClick={() => {
              onExport(true);
              setOpen(false);
            }}
          >
            {t('panel.export.exportAllSanitized')}
          </button>
          <button
            type="button"
            className="dt-ctx-item"
            onClick={() => {
              onCopy(false);
              setOpen(false);
            }}
          >
            {t('panel.export.copyAll')}
          </button>
          <button
            type="button"
            className="dt-ctx-item"
            onClick={() => {
              onCopy(true);
              setOpen(false);
            }}
          >
            {t('panel.export.copyAllSanitized')}
          </button>
        </div>
      )}
    </div>
  );
}
