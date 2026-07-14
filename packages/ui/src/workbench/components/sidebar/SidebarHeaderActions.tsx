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
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import type { SidebarView } from './types';

// Per-view display label — mirrors the `tool-windows.tsx` registry
// entries so the sidebar's PanelHeader title matches the activity-bar
// chip identity. No icon: the activity bar already surfaces the icon
// and repeating it in the header is visual noise.
const SIDEBAR_VIEW_LABEL_KEY: Record<SidebarView, MessageKey> = {
  'http-rules': 'workbench.sidebar.view.httpRules',
  'api-requests': 'workbench.sidebar.view.apiRequests',
  workflows: 'workbench.sidebar.view.workflows',
  variables: 'workbench.sidebar.view.variables',
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
  const t = useT();
  // Suppress the trigger's tooltip while its create menu is open so the
  // two popups never overlap. One flag serves both dropdowns — only one
  // renders per view.
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // ── Header chrome — PanelHeader (name + actions + options + hide) on
  // top, filter input row below. PanelHeader is mandatory per the dock-
  // layout convention; the filter row is panel-specific UX that doesn't
  // fit in the 32px header alongside the action cluster.
  const viewLabel = t(SIDEBAR_VIEW_LABEL_KEY[view]);
  const headerWiring = createPanelHeaderWiring({ onHide });
  const behaviorMenuItems: MenuProps['items'] = [
    {
      key: 'behavior',
      label: t('workbench.sidebar.behavior.title'),
      children: [
        {
          key: 'single-click',
          label: `${openWithSingleClick ? '✓ ' : ''}${t('workbench.sidebar.behavior.openEntriesSingleClick')}`,
          onClick: () => setOpenWithSingleClick((v) => !v),
        },
        {
          key: 'collections-single-click',
          label: `${openCollectionsWithSingleClick ? '✓ ' : ''}${t('workbench.sidebar.behavior.openCollectionsSingleClick')}`,
          onClick: () => setOpenCollectionsWithSingleClick((v) => !v),
        },
        {
          key: 'folders-single-click',
          label: `${openFoldersWithSingleClick ? '✓ ' : ''}${t('workbench.sidebar.behavior.openFoldersSingleClick')}`,
          onClick: () => setOpenFoldersWithSingleClick((v) => !v),
        },
        {
          key: 'always-select',
          label: `${alwaysSelectOpened ? '✓ ' : ''}${t('workbench.sidebar.behavior.alwaysSelectOpened')}`,
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
          <Tooltip title={t('workbench.sidebar.header.newRule')} placement="bottom" open={createMenuOpen ? false : undefined}>
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label={t('workbench.sidebar.header.newRule')}>
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
          <Tooltip title={t('workbench.sidebar.header.addRequest')} placement="bottom" open={createMenuOpen ? false : undefined}>
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label={t('workbench.sidebar.header.addRequest')}>
              <PlusOutlined />
            </span>
          </Tooltip>
        </Dropdown>
      )}
      {view === 'variables' && (
        <Tooltip title={t('workbench.sidebar.header.createNewEnvironment')} placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => void createNewEnvironment()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') void createNewEnvironment();
            }}
            aria-label={t('workbench.sidebar.header.createNewEnvironment')}
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {view === 'workflows' && (
        <Tooltip title={t('workbench.sidebar.header.newWorkflow')} placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => onCreateWorkflow?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCreateWorkflow?.();
            }}
            aria-label={t('workbench.sidebar.header.newWorkflow')}
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {exportSelectedIds.size > 0 && onExportSelection && (
        <>
          <Tooltip title={t('workbench.sidebar.header.exportSelected', { count: exportSelectedIds.size })} placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              style={{ color: token.colorPrimary, width: 'auto', padding: '0 4px' }}
              onClick={handleExportSelectedClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleExportSelectedClick();
              }}
              aria-label={t('workbench.sidebar.header.exportSelectedAria', { count: exportSelectedIds.size })}
            >
              <ExportOutlined />
              <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600 }}>{exportSelectedIds.size}</span>
            </span>
          </Tooltip>
          <Tooltip title={t('workbench.sidebar.header.clearSelection')} placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              onClick={clearExportSelection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') clearExportSelection();
              }}
              aria-label={t('workbench.sidebar.header.clearSelectionAria')}
            >
              <CloseOutlined />
            </span>
          </Tooltip>
        </>
      )}
      <Tooltip title={t('workbench.sidebar.header.selectOpenedTab')} placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={selectOpenedFile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') selectOpenedFile();
          }}
          aria-label={t('workbench.sidebar.header.selectOpenedTabAria')}
        >
          <AimOutlined />
        </span>
      </Tooltip>
      <Tooltip title={t('workbench.sidebar.header.expandAll')} placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={expandAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') expandAll();
          }}
          aria-label={t('workbench.sidebar.header.expandAllAria')}
        >
          <MenuUnfoldOutlined />
        </span>
      </Tooltip>
      <Tooltip title={t('workbench.sidebar.header.collapseAll')} placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={collapseAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') collapseAll();
          }}
          aria-label={t('workbench.sidebar.header.collapseAllAria')}
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
