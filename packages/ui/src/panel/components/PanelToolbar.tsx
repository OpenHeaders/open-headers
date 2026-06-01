import { LayoutOutlined, ReloadOutlined, SettingOutlined, ShareAltOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { hostNavigation } from '@openheaders/core/navigation';
import type { Environment } from '@openheaders/core/types';
import type { DockLayoutApi } from '@openheaders/ui/shared/dock-layout';
import {
  DOCK_LABELS,
  DockSlotIcon,
  LayoutMenuIcon,
  RegionToggle,
  SidebarLayoutIcon,
} from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import EnvironmentSelector from '@openheaders/ui/workbench/components/EnvironmentSelector';
import { useSetting, useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Dropdown, type MenuProps, Popover, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { FilterConfig } from '../data/filter-engine';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from '../data/tool-windows';
import type { PanelViewState } from '../data/use-panel-tool-layout';
import { PanelWorkspaceSelector } from './PanelWorkspaceSelector';
import { RuleExecutionsHint } from './RuleExecutions';

type SidebarLayoutVariantSetting = 'proportional' | 'compact' | 'stacked' | 'dynamic';
type BottomPanelAlignmentSetting = 'center' | 'left' | 'right' | 'justify';

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

/**
 * "View ▾" dropdown — toggles which optional stats the footer shows.
 * Same checkbox-popover idiom as More filters; each toggle is a `user`
 * setting so the choice persists across panels. The badge counts the
 * stats currently surfaced beyond the always-on counts.
 */
function ViewMenu() {
  const [showModified, setShowModified] = useSetting('devpanelLayout.footerShowModified');
  const [showFailed, setShowFailed] = useSetting('devpanelLayout.footerShowFailed');
  const [showCached, setShowCached] = useSetting('devpanelLayout.footerShowCached');
  const [showPageContext, setShowPageContext] = useSetting('devpanelLayout.footerShowPageContext');

  const flags = [showModified, showFailed, showCached, showPageContext];
  const activeCount = flags.reduce((n, v) => n + (v ? 1 : 0), 0);

  const content = (
    <div className="dt-morefilters-menu">
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showModified} onChange={(e) => setShowModified(e.target.checked)} />
        Modified count
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showFailed} onChange={(e) => setShowFailed(e.target.checked)} />
        Failed count
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showCached} onChange={(e) => setShowCached(e.target.checked)} />
        Cached count
      </label>
      <div className="dt-morefilters-divider" />
      <label
        className="dt-morefilters-item"
        title="When the log spans more than one navigation, name the page the timing milestones describe."
      >
        <input type="checkbox" checked={showPageContext} onChange={(e) => setShowPageContext(e.target.checked)} />
        Current page label
      </label>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomLeft" arrow={false} overlayClassName="dt-morefilters-popover">
      <button type="button" className="dt-toolbar-dropdown" title="Choose which footer stats to show">
        View
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
  /** When on, the list also shows requests the engine captured before
   *  this panel opened (otherwise it starts empty, like the browser's
   *  own Network panel). */
  showBackgroundHistory: boolean;
  onShowBackgroundHistoryChange: (v: boolean) => void;
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
  /** Tool-layout API for the panel-toggle cluster (left/bottom/right
   *  region toggles + layout menu). Mirrors the workspace top bar so
   *  layout chrome lives at the top across both surfaces. */
  tl: DockLayoutApi<PanelToolWindowId>;
  perTab: EditingScopeViewStateApi<PanelViewState>;
  /** Environment list + active uid + switch handler for the slim
   *  env-switcher dropdown. Mirrors the workspace env selector. */
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSwitchEnvironment: (uid: string | null) => void;
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
  showBackgroundHistory,
  onShowBackgroundHistoryChange,
  rulesVisible,
  filterConfig,
  onFilterConfigChange,
  onExportHar,
  onCopyAllHar,
  canExport,
  cacheBypassEnabled,
  onToggleCacheBypass,
  showToolWindowLabels,
  tl,
  perTab,
  environments,
  activeEnvironmentId,
  onSwitchEnvironment,
}) => {
  const { token } = theme.useToken();
  const showPanelToggles = useSettingValue('devpanelLayout.topbarShowPanelToggles');
  const showLayoutMenu = useSettingValue('devpanelLayout.topbarShowLayoutMenu');
  const [bottomPanelAlignment, setBottomPanelAlignment] = useSetting('devpanelLayout.bottomPanelAlignment');
  const [showLabels, setShowLabels] = useSetting('devpanelLayout.showToolWindowLabels');
  const [sidebarLayout, setSidebarLayout] = useSetting('devpanelLayout.sidebarLayout');

  // Layout menu state — kept open across item clicks so the user can
  // A/B combinations without reopening (matches workspace TopBar).
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [menuOpenKeys, setMenuOpenKeys] = useState<string[]>([]);
  const handleLayoutOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setLayoutMenuOpen(nextOpen);
    if (!nextOpen) setMenuOpenKeys([]);
  };
  const handleMenuClick: NonNullable<MenuProps['onClick']> = ({ keyPath }) => {
    if (keyPath.length > 1) {
      const parentKey = keyPath[1];
      requestAnimationFrame(() => {
        setMenuOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
      });
    }
  };

  const [bottomAlignDropdownOpen, setBottomAlignDropdownOpen] = useState(false);
  const handleBottomAlignOpenChange: NonNullable<React.ComponentProps<typeof Dropdown>['onOpenChange']> = (
    nextOpen,
    info,
  ) => {
    if (info?.source === 'menu') return;
    setBottomAlignDropdownOpen(nextOpen);
  };

  const menuIconWrap = (node: React.ReactNode): React.ReactNode => (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
      {node}
    </span>
  );

  const menuLabel = (checked: boolean, text: React.ReactNode): React.ReactNode => (
    <Space size={6}>
      <span style={{ width: 12, display: 'inline-block' }}>{checked ? '✓' : ''}</span>
      {text}
    </Space>
  );

  const alignmentGlyph = (
    a: BottomPanelAlignmentSetting,
  ): 'bottom-full' | 'bottom-left' | 'bottom-right' | 'bottom-nested' =>
    a === 'justify' ? 'bottom-full' : a === 'left' ? 'bottom-left' : a === 'right' ? 'bottom-right' : 'bottom-nested';

  const layoutMenu: MenuProps['items'] = [
    {
      key: 'bottom-alignment',
      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} />),
      label: 'Bottom Panel Alignment',
      children: (
        [
          { key: 'center', label: 'Center (nested)' },
          { key: 'left', label: 'Left' },
          { key: 'right', label: 'Right' },
          { key: 'justify', label: 'Justify (full width)' },
        ] as { key: BottomPanelAlignmentSetting; label: string }[]
      ).map((opt) => ({
        key: `bottom-${opt.key}`,
        icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
        label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
        onClick: () => setBottomPanelAlignment(opt.key),
      })),
    },
    {
      key: 'show-labels',
      icon: menuIconWrap(<LayoutMenuIcon kind={showLabels ? 'show-labels' : 'hide-labels'} />),
      label: menuLabel(showLabels, 'Show Tool Window Names'),
      onClick: () => setShowLabels(!showLabels),
    },
    {
      key: 'sidebar-layout',
      icon: menuIconWrap(<SidebarLayoutIcon variant={sidebarLayout} />),
      label: 'Activity Bar Layout',
      children: (
        [
          { key: 'proportional', label: 'Proportional (even halves)' },
          { key: 'compact', label: 'Compact (bottom pinned)' },
          { key: 'stacked', label: 'Stacked (all at top)' },
          { key: 'dynamic', label: 'Dynamic (follows panel heights)' },
        ] as { key: SidebarLayoutVariantSetting; label: string }[]
      ).map((opt) => ({
        key: `sidebar-${opt.key}`,
        icon: menuIconWrap(<SidebarLayoutIcon variant={opt.key} />),
        label: menuLabel(sidebarLayout === opt.key, opt.label),
        onClick: () => setSidebarLayout(opt.key),
      })),
    },
    { type: 'divider' },
    {
      key: 'inheritance-info',
      icon: menuIconWrap(<ShareAltOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />),
      label: (
        <span style={{ fontSize: 11, color: token.colorTextSecondary, whiteSpace: 'normal', lineHeight: 1.4 }}>
          {perTab.isDonor
            ? `This ${instanceLabel()} is the default — new ${instanceLabelPlural()} inherit this layout.`
            : `Another ${instanceLabel()} is the default — new ${instanceLabelPlural()} inherit from there.`}
        </span>
      ),
      disabled: true,
    },
    {
      key: 'reset-layout',
      icon: menuIconWrap(<ReloadOutlined style={{ fontSize: 12 }} />),
      label: 'Reset layout to defaults',
      onClick: () => perTab.resetToDefaults(),
    },
    { type: 'divider' },
    {
      key: 'restore',
      icon: menuIconWrap(<LayoutMenuIcon kind="restore-hidden" />),
      label: 'Restore Hidden Activity Bar Tools',
      disabled: tl.state.hidden.length === 0,
      children:
        tl.state.hidden.length === 0
          ? undefined
          : tl.state.hidden.map((id) => {
              const def = PANEL_TOOL_WINDOW_MAP[id];
              return {
                key: `restore-${id}`,
                icon: menuIconWrap(<DockSlotIcon slot={def.defaultSlot} size={20} />),
                label: (
                  <Space size={6}>
                    <span>{def.label}</span>
                  </Space>
                ),
                onClick: () => tl.restoreWindow(id),
              };
            }),
    },
  ];

  return (
    <div className="dt-header">
      <div className={`dt-brand${showToolWindowLabels ? '' : ' dt-brand--compact'}`}>
        <img src={hostAssets.resolveUrl('images/logo-pixel.svg')} alt="Open Headers" className="dt-brand-logo" />
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
          <label className="dt-checkbox" title="Keep requests across page navigations. Off clears the list on each navigation or reload, like the browser's own Network panel.">
            <input type="checkbox" checked={preserveLog} onChange={(e) => onPreserveLogChange(e.target.checked)} />
            Preserve log
          </label>
          <label
            className="dt-checkbox"
            title="Show requests captured before this panel opened. Off matches the browser's own Network panel."
          >
            <input
              type="checkbox"
              checked={showBackgroundHistory}
              onChange={(e) => onShowBackgroundHistoryChange(e.target.checked)}
            />
            Background history
          </label>
          <MoreFiltersMenu
            filterConfig={filterConfig}
            onFilterConfigChange={onFilterConfigChange}
            cacheBypassEnabled={cacheBypassEnabled}
            onToggleCacheBypass={onToggleCacheBypass}
          />
          <ViewMenu />
          <div className="dt-toolbar-separator" />
          <ExportMenu onExport={onExportHar} onCopy={onCopyAllHar} disabled={!canExport} />
          {rulesVisible && (
            <>
              <div className="dt-toolbar-separator" />
              <RuleExecutionsHint />
            </>
          )}
          <div className="dt-toolbar-spacer" />
          <PanelWorkspaceSelector />
          <EnvironmentSelector
            environments={environments}
            activeEnvironmentId={activeEnvironmentId}
            onSwitch={onSwitchEnvironment}
            // Devpanel is a viewer surface — it has no collection
            // context, so the pinned/default-collection affordances
            // collapse to no-ops. Editing actions route to the
            // workbench via WorkspaceIntent so the user lands on the
            // right page; the navigator handles focus-or-create.
            activeCollectionId={null}
            activeCollectionPinnedEnvIds={[]}
            activeCollectionDefaultEnvId={null}
            onSetCollectionPinnedEnvs={() => Promise.resolve(true)}
            onCreateEnvironment={() => {
              void openWorkspace({ kind: 'create-environment' }, 'devpanel');
            }}
            onOpenEnvironment={(uid) => {
              void openWorkspace({ kind: 'edit-environment', uid }, 'devpanel');
            }}
            onOpenWorkspaceVariables={() => {
              void openWorkspace({ kind: 'open-workspace-vars' }, 'devpanel');
            }}
            onOpenCollectionVariables={() => {
              // No collection context in the devpanel — no-op. The
              // selector hides the "Collection variables" footer when
              // `activeCollectionId === null`.
            }}
            onOpenVault={() => {
              void openWorkspace({ kind: 'open-vault' }, 'devpanel');
            }}
          />
          {showPanelToggles && (
            <>
              <div className="dt-toolbar-separator" />
              <div className="rules-panel-toggles">
                <RegionToggle
                  title="Left sidebar"
                  ariaTitle="Left sidebar"
                  active={tl.isRegionOpen('left')}
                  position="left"
                  onClick={() => tl.toggleRegion('left')}
                />
                <RegionToggle
                  title="Bottom panel"
                  ariaTitle="Bottom panel"
                  active={tl.isRegionOpen('bottom')}
                  position="bottom"
                  onClick={() => tl.toggleRegion('bottom')}
                />
                <RegionToggle
                  title="Right sidebar"
                  ariaTitle="Right sidebar"
                  active={tl.isRegionOpen('right')}
                  position="right"
                  onClick={() => tl.toggleRegion('right')}
                />
                <Dropdown
                  placement="bottomRight"
                  trigger={['click']}
                  open={bottomAlignDropdownOpen}
                  onOpenChange={handleBottomAlignOpenChange}
                  menu={{
                    items: (
                      [
                        { key: 'center', label: 'Center (nested)' },
                        { key: 'left', label: 'Left' },
                        { key: 'right', label: 'Right' },
                        { key: 'justify', label: 'Justify (full width)' },
                      ] as { key: BottomPanelAlignmentSetting; label: string }[]
                    ).map((opt) => ({
                      key: `topbar-bottom-${opt.key}`,
                      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
                      label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
                      onClick: () => setBottomPanelAlignment(opt.key),
                    })),
                  }}
                >
                  <Tooltip
                    title={
                      bottomPanelAlignment === 'center'
                        ? 'Bottom panel: center (nested)'
                        : bottomPanelAlignment === 'left'
                          ? 'Bottom panel: left-aligned'
                          : bottomPanelAlignment === 'right'
                            ? 'Bottom panel: right-aligned'
                            : 'Bottom panel: full width'
                    }
                    placement="bottom"
                    open={bottomAlignDropdownOpen ? false : undefined}
                  >
                    <div
                      className="rules-panel-toggle"
                      role="button"
                      tabIndex={0}
                      aria-label="Choose bottom panel alignment"
                    >
                      <LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} size={16} />
                    </div>
                  </Tooltip>
                </Dropdown>
              </div>
            </>
          )}
          {showLayoutMenu && (
            <>
              <div className="dt-toolbar-separator" />
              <Dropdown
                menu={{
                  items: layoutMenu,
                  openKeys: menuOpenKeys,
                  onOpenChange: setMenuOpenKeys,
                  onClick: handleMenuClick,
                }}
                placement="bottomRight"
                trigger={['click']}
                open={layoutMenuOpen}
                onOpenChange={handleLayoutOpenChange}
              >
                <div
                  className="rules-statusbar-item rules-layout-toggle"
                  role="button"
                  tabIndex={0}
                  aria-label="Layout options"
                  style={{ cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  <LayoutOutlined style={{ fontSize: 13 }} />
                </div>
              </Dropdown>
            </>
          )}
          <div className="dt-toolbar-separator" />
          <Tooltip title="Open Settings in workspace" placement="bottom">
            <button
              type="button"
              className="dt-toolbar-icon"
              aria-label="Open settings"
              onClick={() => {
                hostNavigation.openUrl(hostAssets.resolveUrl('workbench.html#/settings'));
              }}
            >
              <SettingOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={`dt-brand-spacer${showToolWindowLabels ? '' : ' dt-brand-spacer--compact'}`} aria-hidden="true" />
    </div>
  );
};
