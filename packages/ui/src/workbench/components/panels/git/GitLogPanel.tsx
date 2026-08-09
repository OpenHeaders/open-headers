/**
 * GitLogPanel — the workbench Git tool window (GIT_PLAN.md §9 history
 * view), IDE-log layout on the shared pane-tabs machinery (the
 * terminal panel's architecture): a per-workspace tab REGISTRY
 * (git-panel-view-store — log tabs with scope/filter/selection, plus
 * the read-only Console tab) bound to a shared pane store, rendered by
 * GitGroupRenderer with the full terminal feature set — drag-reorder,
 * cross-pane tab moves, edge-drop splits with the shared drop preview,
 * and the shared pane-tab context menu (close family, Split and Move,
 * splitter orientation, unsplit). The primary `Log: <branch>` tab is
 * permanent (never closes; moves freely). Tabs and layout survive dock
 * switches (module stores); nothing persists across app restarts.
 *
 * This shell owns what is panel-global: the bind/status lifeline
 * (bound + branch), the header composition (PanelHeader while
 * unsplit — the single-row law), the chevron menu (Show Git console),
 * and the unbound state, which IS the bind gesture (GitBindForm — the
 * settings card's exact form; no bounce to settings). Log data loading
 * lives per view (GitLogView / GitConsolePane). Only hosts registering
 * the `workspaceGit` capability mount this window.
 */

import { DownOutlined, MinusOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, type DockSlot, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useIsDockFocused } from '../../../stores/focus-region-store';
import GitBindForm from '../../git/GitBindForm';
import { localWorkspaceTreeTransport } from '../../git/transport';
import { getGitPanelWorkbench } from './git-panel-view-store';
import GitGroupRenderer from './GitGroupRenderer';

export interface GitLogPanelProps {
  info: InfoPopoverContent;
  dockSlot: DockSlot;
  onHide: () => void;
}

const GitLogPanel: React.FC<GitLogPanelProps> = ({ info, dockSlot, onHide }) => {
  const { token } = theme.useToken();
  const { t } = useLocale();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const workspaceId = useActiveWorkspaceId();
  const dockFocused = useIsDockFocused(dockSlot);

  const [bound, setBound] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);

  const workbench = workspaceId !== null ? getGitPanelWorkbench(workspaceId) : null;
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);
  useEffect(() => workbench?.registry.onTabsChange(bumpVersion), [workbench]);
  useEffect(() => workbench?.panes.subscribe(bumpVersion), [workbench]);

  // Bind/branch lifeline: hydrate once, then fold status frames (the
  // per-view data loads live in GitLogView / GitConsolePane).
  const hydrate = useCallback(async (): Promise<void> => {
    if (workspaceId === null) {
      setBound(false);
      setBranch(null);
      return;
    }
    try {
      const list = await hostBridge.call('oh.workspaceTree.list');
      const isBound = list.bindings.some((row) => row.workspaceId === workspaceId);
      setBound(isBound);
      if (!isBound) {
        setBranch(null);
        return;
      }
      const status = await hostBridge.call('oh.workspaceTree.gitStatus', { workspaceId });
      setBranch(status.branch);
    } catch {
      setBound(false);
      setBranch(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (workspaceId === null) return;
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      setBound(payload.status.bound);
      setBranch(payload.status.bound ? payload.status.branch : null);
    });
  }, [workspaceId]);

  const chevronMenu = (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [{ key: 'show-console', label: t('workbench.gitLog.console.show') }],
        onClick: ({ key }) => {
          if (key === 'show-console') workbench?.registry.openConsole();
        },
      }}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={t('workbench.gitLog.tabMenu')}
        data-testid="git-tool-tab-menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 2px',
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          flexShrink: 0,
          color: token.colorTextSecondary,
        }}
      >
        <DownOutlined style={{ fontSize: 8 }} />
      </span>
    </Dropdown>
  );

  // Single-pane header row (the terminal single-row law): title +
  // inline (i) + the pane's strip. Split state renders no PanelHeader —
  // the corner strip hosts info + hide via renderTrailing.
  const renderHeader = useCallback(
    (headerContent: React.ReactNode) => (
      <PanelHeader
        wiring={headerWiring}
        title={
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <strong style={{ flexShrink: 0 }}>{t('workbench.toolWindows.git')}</strong>
            <InfoTrigger content={info} className="rules-panel-header-info" />
            {headerContent}
          </div>
        }
      />
    ),
    [headerWiring, info, t],
  );

  const renderTrailing = ({ corner }: { corner: boolean }): React.ReactNode => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {chevronMenu}
      {/* PanelHeader isn't rendered while split — its hide affordance
          re-homes on the top-right pane's strip (the (i) follows the
          Git label instead), with the header action classes so the
          dock-hover reveal law still applies. */}
      {corner && (
        <div className="rules-panel-header-actions" data-focus-skip style={{ display: 'flex', alignItems: 'center' }}>
          <span
            role="button"
            tabIndex={0}
            aria-label={t('shared.dock.hidePanel')}
            className="rules-panel-header-action"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onHide}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onHide();
            }}
          >
            <MinusOutlined />
          </span>
        </div>
      )}
    </div>
  );

  if (workspaceId === null || workbench === null || !bound) {
    return (
      <div className="rules-bottom-panel">
        <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.git')}</strong>} info={info} />
        <div
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex' }}
          data-testid="git-tool-not-bound"
        >
          <div style={{ width: 'min(560px, 92%)', margin: 'auto', padding: '18px 0' }}>
            <GitBindForm
              call={localWorkspaceTreeTransport}
              workspaceId={workspaceId}
              allowFolderPicker
              onBound={() => void hydrate()}
              testidPrefix="git-tool-bind"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rules-bottom-panel">
      <GitGroupRenderer
        key={workspaceId}
        workbench={workbench}
        workspaceId={workspaceId}
        branch={branch}
        dockFocused={dockFocused}
        renderHeader={renderHeader}
        titleInfo={<InfoTrigger content={info} className="rules-panel-header-info" />}
        renderTrailing={renderTrailing}
      />
    </div>
  );
};

export default GitLogPanel;
