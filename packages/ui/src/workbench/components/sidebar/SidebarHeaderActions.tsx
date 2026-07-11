/**
 * SidebarHeaderActions — the sidebar's entire header row: the `PanelHeader`
 * (view title + `(i)` popover + action cluster + options menu + hide button).
 *
 * Owns nothing but its own `theme.useToken()` read; every value it renders —
 * the per-view `+` menus, the create-environment / create-workflow openers,
 * the multi-select export state, expand/collapse-all, and the four
 * single-click behavior flags — arrives as a flat prop from the parent, which
 * stays the single owner of that state. The parent's return then opens
 * directly with `<SidebarHeaderActions … />` above the filter row.
 */

import {
  AimOutlined,
  BorderLeftOutlined,
  CloseOutlined,
  ExportOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import type { MenuProps } from 'antd';
import { Dropdown, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import type { SidebarView } from './types';

// Per-view display label — mirrors the `tool-windows.tsx` registry
// entries so the sidebar's PanelHeader title matches the activity-bar
// chip identity. No icon: the activity bar already surfaces the icon
// and repeating it in the header is visual noise.
const SIDEBAR_VIEW_LABEL: Record<SidebarView, string> = {
  'http-rules': 'HTTP Rules',
  'api-requests': 'API Requests',
  workflows: 'Workflows',
  variables: 'Variables',
};

interface SidebarHeaderActionsProps {
  view: SidebarView;
  /** Title-bar `(i)` popover copy for the active view. */
  info: InfoPopoverContent;
  /** Hide the sidebar dock — bound to the trailing − button. */
  onHide: () => void;
  /** HTTP Rules "New rule" menu (also drives the RULES section header). */
  createMenuItems: MenuProps['items'];
  /** API Requests "Add request" menu (also drives the REQUESTS header). */
  requestImportMenuItems: MenuProps['items'];
  createNewEnvironment: () => Promise<void>;
  onCreateWorkflow?: () => void;
  exportSelectedIds: Set<string>;
  onExportSelection?: (entities: SidebarExportEntity[]) => void;
  handleExportSelectedClick: () => void;
  clearExportSelection: () => void;
  selectOpenedFile: () => boolean;
  expandAll: () => void;
  collapseAll: () => void;
  openWithSingleClick: boolean;
  setOpenWithSingleClick: React.Dispatch<React.SetStateAction<boolean>>;
  openCollectionsWithSingleClick: boolean;
  setOpenCollectionsWithSingleClick: React.Dispatch<React.SetStateAction<boolean>>;
  openFoldersWithSingleClick: boolean;
  setOpenFoldersWithSingleClick: React.Dispatch<React.SetStateAction<boolean>>;
  alwaysSelectOpened: boolean;
  setAlwaysSelectOpened: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarHeaderActions: React.FC<SidebarHeaderActionsProps> = ({
  view,
  info,
  onHide,
  createMenuItems,
  requestImportMenuItems,
  createNewEnvironment,
  onCreateWorkflow,
  exportSelectedIds,
  onExportSelection,
  handleExportSelectedClick,
  clearExportSelection,
  selectOpenedFile,
  expandAll,
  collapseAll,
  openWithSingleClick,
  setOpenWithSingleClick,
  openCollectionsWithSingleClick,
  setOpenCollectionsWithSingleClick,
  openFoldersWithSingleClick,
  setOpenFoldersWithSingleClick,
  alwaysSelectOpened,
  setAlwaysSelectOpened,
}) => {
  const { token } = theme.useToken();
  // Suppress the trigger's tooltip while its create menu is open so the
  // two popups never overlap. One flag serves both dropdowns — only one
  // renders per view.
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // ── Header chrome — PanelHeader (name + actions + options + hide) on
  // top, filter input row below. PanelHeader is mandatory per the dock-
  // layout convention; the filter row is panel-specific UX that doesn't
  // fit in the 32px header alongside the action cluster.
  const viewLabel = SIDEBAR_VIEW_LABEL[view];
  const headerWiring = createPanelHeaderWiring({ onHide });
  const behaviorMenuItems: MenuProps['items'] = [
    {
      key: 'behavior',
      label: 'Behavior',
      children: [
        {
          key: 'single-click',
          label: `${openWithSingleClick ? '✓ ' : ''}Open Entries with Single Click`,
          onClick: () => setOpenWithSingleClick((v) => !v),
        },
        {
          key: 'collections-single-click',
          label: `${openCollectionsWithSingleClick ? '✓ ' : ''}Open Collections with Single Click`,
          onClick: () => setOpenCollectionsWithSingleClick((v) => !v),
        },
        {
          key: 'folders-single-click',
          label: `${openFoldersWithSingleClick ? '✓ ' : ''}Open Folders with Single Click`,
          onClick: () => setOpenFoldersWithSingleClick((v) => !v),
        },
        {
          key: 'always-select',
          label: `${alwaysSelectOpened ? '✓ ' : ''}Always Select Opened Tab`,
          onClick: () => setAlwaysSelectOpened((v) => !v),
        },
      ],
    },
  ];
  const headerActions = (
    <>
      {view === 'http-rules' && (
        <Dropdown
          menu={{ items: createMenuItems }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setCreateMenuOpen}
        >
          <Tooltip title="New rule" placement="bottom" open={createMenuOpen ? false : undefined}>
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label="New rule">
              <PlusOutlined />
            </span>
          </Tooltip>
        </Dropdown>
      )}
      {view === 'api-requests' && (
        <Dropdown
          menu={{ items: requestImportMenuItems }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setCreateMenuOpen}
        >
          <Tooltip title="Add request" placement="bottom" open={createMenuOpen ? false : undefined}>
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label="Add request">
              <PlusOutlined />
            </span>
          </Tooltip>
        </Dropdown>
      )}
      {view === 'variables' && (
        <Tooltip title="Create new environment" placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => void createNewEnvironment()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') void createNewEnvironment();
            }}
            aria-label="Create new environment"
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {view === 'workflows' && (
        <Tooltip title="New workflow" placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => onCreateWorkflow?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCreateWorkflow?.();
            }}
            aria-label="New workflow"
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {exportSelectedIds.size > 0 && onExportSelection && (
        <>
          <Tooltip title={`Export ${exportSelectedIds.size} selected…`} placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              style={{ color: token.colorPrimary, width: 'auto', padding: '0 4px' }}
              onClick={handleExportSelectedClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleExportSelectedClick();
              }}
              aria-label={`Export ${exportSelectedIds.size} selected items`}
            >
              <ExportOutlined />
              <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600 }}>{exportSelectedIds.size}</span>
            </span>
          </Tooltip>
          <Tooltip title="Clear selection" placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              onClick={clearExportSelection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') clearExportSelection();
              }}
              aria-label="Clear export selection"
            >
              <CloseOutlined />
            </span>
          </Tooltip>
        </>
      )}
      <Tooltip title="Select Opened Tab" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={selectOpenedFile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') selectOpenedFile();
          }}
          aria-label="Select opened tab"
        >
          <AimOutlined />
        </span>
      </Tooltip>
      <Tooltip title="Expand All" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={expandAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') expandAll();
          }}
          aria-label="Expand all"
        >
          <MenuUnfoldOutlined />
        </span>
      </Tooltip>
      <Tooltip title="Collapse All" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={collapseAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') collapseAll();
          }}
          aria-label="Collapse all"
        >
          <BorderLeftOutlined />
        </span>
      </Tooltip>
    </>
  );

  return (
    <PanelHeader
      wiring={headerWiring}
      title={<strong>{viewLabel}</strong>}
      info={info}
      actions={headerActions}
      optionsMenuItems={behaviorMenuItems}
    />
  );
};

export default SidebarHeaderActions;
