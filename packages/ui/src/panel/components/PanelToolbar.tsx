import { LayoutOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import type { Environment } from '@openheaders/core/types';
import type { DockLayoutApi } from '@openheaders/ui/shared/dock-layout';
import { LayoutMenuIcon, RegionToggle } from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import EnvironmentSelector from '@openheaders/ui/workbench/components/shell/EnvironmentSelector';
import { useSetting, useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { SettingsGearMenu } from '@openheaders/ui/shared/settings-menu';
import { Dropdown, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { lazy, Suspense, useState } from 'react';

import type { FilterConfig } from '../data/filter-engine';
import type { PanelToolWindowId } from '../data/tool-windows';
import type { PanelViewState } from '../data/use-panel-tool-layout';
import { DebugControlsCluster } from './DebugControlsCluster';
import { PanelWorkspaceSelector } from './PanelWorkspaceSelector';
import { PRESERVE_LOG_INFO } from './preserve-log-info';
import { RuleExecutionsHint } from './RuleExecutions';
import {
  alignmentGlyph,
  type BottomPanelAlignmentSetting,
  buildPanelLayoutMenu,
  menuIconWrap,
  menuLabel,
} from './toolbar-layout-menu';
import { IconClear } from './toolbar-icons';
import { MORE_FILTERS_INFO, VIEW_INFO } from './toolbar-menu-info';
import { ExportMenu, MoreFiltersMenu, ViewMenu } from './toolbar-menus';

// Lazy so the settings UI (Monaco via CodeField) stays out of the
// panel's boot bundle; it loads on first gear-menu action.
const SettingsModalLazy = lazy(() =>
  import('@openheaders/ui/workbench/settings/ui').then((m) => ({ default: m.SettingsModal })),
);

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
  onExportHar: (sanitize?: boolean) => void;
  onCopyAllHar: (sanitize?: boolean) => void;
  canExport: boolean;
  /** "Disable cache" toggle — a first-class toolbar control beside the
   *  throttle dropdown (the debug-controls cluster). DNR-backed in standard
   *  mode, whole-tab CDP in Debug mode. See `use-cache-bypass.ts`. */
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

  // In-panel settings surface — the gear menu opens the shared modal
  // right here instead of bouncing the user out to the workbench tab.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategoryId, setSettingsCategoryId] = useState<string | undefined>(undefined);
  const openSettings = (target?: { settingKey?: string; categoryId?: string }) => {
    setSettingsCategoryId(target?.categoryId ?? 'devpanel');
    setSettingsOpen(true);
  };

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

  const layoutMenu = buildPanelLayoutMenu({
    token,
    tl,
    perTab,
    bottomPanelAlignment,
    setBottomPanelAlignment,
    showLabels,
    setShowLabels,
    sidebarLayout,
    setSidebarLayout,
  });

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
          <div className="dt-toolbar-left">
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
          <span className="dt-debug-control">
            <label className="dt-checkbox" title="Keep requests across page navigations. Off clears the list on each navigation or reload, like the browser's own Network panel.">
              <input type="checkbox" checked={preserveLog} onChange={(e) => onPreserveLogChange(e.target.checked)} />
              Preserve log
            </label>
            <InfoTrigger
              content={PRESERVE_LOG_INFO}
              className="dt-header-info-trigger dt-debug-info-trigger"
              ariaLabel="About Preserve log"
            />
          </span>
          <div className="dt-toolbar-separator" />
          <DebugControlsCluster cacheBypassEnabled={cacheBypassEnabled} onToggleCacheBypass={onToggleCacheBypass} />
          <div className="dt-toolbar-separator" />
          <span className="dt-debug-control">
            <MoreFiltersMenu filterConfig={filterConfig} onFilterConfigChange={onFilterConfigChange} />
            <InfoTrigger
              content={MORE_FILTERS_INFO}
              className="dt-header-info-trigger dt-debug-info-trigger"
              ariaLabel="About More filters"
            />
          </span>
          <div className="dt-toolbar-separator" />
          <span className="dt-debug-control">
            <ViewMenu />
            <InfoTrigger
              content={VIEW_INFO}
              className="dt-header-info-trigger dt-debug-info-trigger"
              ariaLabel="About Footer View"
            />
          </span>
          <div className="dt-toolbar-separator" />
          <ExportMenu onExport={onExportHar} onCopy={onCopyAllHar} disabled={!canExport} />
          {rulesVisible && (
            <>
              <div className="dt-toolbar-separator" />
              <RuleExecutionsHint />
            </>
          )}
          </div>
          <div className="dt-toolbar-right">
          <PanelWorkspaceSelector />
          <EnvironmentSelector
            compact
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
            onOpenLiveVariables={() => {
              void openWorkspace({ kind: 'open-live-variables' }, 'devpanel');
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
                  overlayClassName="dt-layout-menu"
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
                overlayClassName="dt-layout-menu"
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
          <SettingsGearMenu onOpenSettings={openSettings} />
          {settingsOpen && (
            <Suspense fallback={null}>
              <SettingsModalLazy
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                initialCategoryId={settingsCategoryId}
              />
            </Suspense>
          )}
          </div>
        </div>
      </div>
      <div className={`dt-brand-spacer${showToolWindowLabels ? '' : ' dt-brand-spacer--compact'}`} aria-hidden="true" />
    </div>
  );
};
