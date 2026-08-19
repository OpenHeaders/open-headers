/**
 * TerminalPanel — the workbench Terminal tool-window body. Presentation
 * shell only: tab identities, xterm instances, and pty sessions are
 * owned by `terminal-instance.ts`; the split pane layout by
 * `terminal-panes.ts` — both survive unmounts. This component renders
 * the panel header (title + the panel-global + / chevron / Open TUI
 * cluster) and the pane tree (TerminalGroupRenderer: per-leaf strips +
 * viewports, drag-to-reorder/move/split), owns the confirm-aware close
 * flows and the rename modal, and keeps the xterm theme synced. Closing
 * the last tab hides the panel; reopening starts a fresh tab.
 */

import { MinusOutlined } from '@ant-design/icons';
import { App as AntApp, Checkbox, Input, Modal, theme, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ITheme } from '@xterm/xterm';
import { hostBridge } from '@openheaders/core/bridge';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, type DockSlot, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useOpenSettings } from '../../../hooks/OpenSettingsContext';
import { useSettingValue } from '../../../settings/hooks';
import { enableMcp, mcpEndpointInfo } from '../../../settings/mcp-consent';
import { useIsDockFocused } from '../../../stores/focus-region-store';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getWorkbenchTerminalTabs, type WorkbenchTerminal } from './terminal-instance';
import { getWorkbenchTerminalPanes } from './terminal-panes';
import TerminalGroupRenderer from './TerminalGroupRenderer';
import TerminalHeaderCluster from './TerminalHeaderCluster';
import { terminalTabLabel } from './TerminalTabStrip';

type AntdToken = ReturnType<typeof theme.useToken>['token'];

/** Dark-mode terminal ink. antd's dark `colorText` is 85% white —
 *  chrome-legible but glaring as a wall of terminal text; 80% white
 *  keeps it readable without the glare. Light mode keeps the token
 *  (dark ink doesn't glare). */
const DARK_TERMINAL_FOREGROUND = '#cccccc';

function buildXtermTheme(token: AntdToken, isDarkMode: boolean): ITheme {
  const foreground = isDarkMode ? DARK_TERMINAL_FOREGROUND : token.colorText;
  return {
    background: token.colorBgContainer,
    foreground,
    cursor: foreground,
    cursorAccent: token.colorBgContainer,
    selectionBackground: token.colorPrimaryBg,
  };
}

interface TerminalPanelProps {
  /** Title-bar `(i)` popover copy for the tool window. */
  info: InfoPopoverContent;
  /** Dock slot this panel rides — drives blue-vs-grey active-tab
   *  highlighting (editor tab strip focus posture). */
  dockSlot: DockSlot;
  /**
   * Whether this window is its dock's active tab. The keep-alive body
   * stack keeps the panel mounted across close/reopen, so "the user
   * opened the terminal" is an activation edge, not a mount — the
   * ensure-a-tab effect keys on it.
   */
  active: boolean;
  /** Hide handler — wired to the shared PanelHeader's − button. */
  onHide: () => void;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ info, dockSlot, active, onHide }) => {
  const t = useT();
  // Context-aware modal/message: the static `Modal.confirm` mounts
  // outside the ConfigProvider tree, so it renders unthemed (light
  // chrome on a dark workbench). The App context APIs inherit theme.
  const { modal, message } = AntApp.useApp();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const tabsApi = getWorkbenchTerminalTabs();
  const panesApi = getWorkbenchTerminalPanes();
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);

  // Registry-initiated closes (close-on-exit) must hide the panel when
  // the last tab goes, exactly like a close from the strip.
  useEffect(
    () =>
      tabsApi?.onTabsChange(() => {
        bumpVersion();
        if (tabsApi.list().length === 0) onHide();
      }),
    [tabsApi, onHide],
  );

  // Layout/focus changes (splits, moves, pane focus) re-render too.
  useEffect(() => panesApi?.subscribe(bumpVersion), [panesApi]);

  // Every open (first activation AND reopen after a close-last-tab
  // hide) starts a tab — keyed on the activation edge, not the mount:
  // the keep-alive stack keeps this panel mounted through close/reopen,
  // so a mount-keyed ensure would leave a reopened terminal empty.
  // Deferred past the persisted-identity restore, so a restored session
  // isn't shadowed by an eager fresh "Local".
  useEffect(() => {
    if (!tabsApi || !active) return;
    let cancelled = false;
    void tabsApi.whenReady().then(() => {
      if (!cancelled && tabsApi.list().length === 0) tabsApi.createTab();
    });
    return () => {
      cancelled = true;
    };
  }, [tabsApi, active]);

  useEffect(() => {
    tabsApi?.setTheme(buildXtermTheme(token, isDarkMode));
  }, [tabsApi, token, isDarkMode]);

  const closeTab = useCallback(
    (id: string) => {
      if (!tabsApi) return;
      tabsApi.closeTab(id);
      if (tabsApi.list().length === 0) onHide();
    },
    [tabsApi, onHide],
  );

  // IDE posture: closing a tab whose shell still has a live child
  // process (a running command, the TUI) confirms before terminating;
  // an idle shell closes silently. The whole guard sits behind
  // Settings → Terminal → "Confirm Closing a Running Process".
  const confirmCloseRunning = useSettingValue('terminal.confirmCloseRunningProcess');
  const defaultTabName = useSettingValue('terminal.defaultTabName');
  const requestClose = useCallback(
    (id: string) => {
      if (!tabsApi) return;
      const info = tabsApi.list().find((tab) => tab.id === id);
      const handle = tabsApi.getTab(id);
      if (!info || !handle) return;
      if (!confirmCloseRunning) {
        closeTab(id);
        return;
      }
      void handle.hasRunningProcess().then((running) => {
        if (!running) {
          closeTab(id);
          return;
        }
        modal.confirm({
          title: (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.closeConfirm.title')}</span>
          ),
          width: 380,
          centered: true,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>
              {t('workbench.terminal.closeConfirm.bodyPrefix')}
              <strong>{terminalTabLabel(t, info, defaultTabName)}</strong>
              {t('workbench.terminal.closeConfirm.bodySuffix')}
            </p>
          ),
          okText: t('workbench.terminal.closeConfirm.ok'),
          okButtonProps: { danger: true, size: 'small' },
          cancelButtonProps: { size: 'small' },
          onOk: () => closeTab(id),
        });
      });
    },
    [tabsApi, closeTab, confirmCloseRunning, defaultTabName, modal, t],
  );

  // Context-menu bulk closes (Close Others / All / to the Left / Right)
  // share the terminate guard but ask ONCE for the whole batch — a
  // dialog per running tab would stack modals.
  const requestCloseMany = useCallback(
    (ids: string[]) => {
      if (!tabsApi || ids.length === 0) return;
      const closeAll = () => {
        for (const id of ids) tabsApi.closeTab(id);
        if (tabsApi.list().length === 0) onHide();
      };
      if (!confirmCloseRunning) {
        closeAll();
        return;
      }
      const handles = ids
        .map((id) => tabsApi.getTab(id))
        .filter((handle): handle is WorkbenchTerminal => handle !== null);
      void Promise.all(handles.map((handle) => handle.hasRunningProcess())).then((running) => {
        const count = running.filter(Boolean).length;
        if (count === 0) {
          closeAll();
          return;
        }
        modal.confirm({
          title: (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.closeConfirm.title')}</span>
          ),
          width: 380,
          centered: true,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>{t('workbench.terminal.closeConfirm.bodyMany', { count })}</p>
          ),
          okText: t('workbench.terminal.closeConfirm.ok'),
          okButtonProps: { danger: true, size: 'small' },
          cancelButtonProps: { size: 'small' },
          onOk: closeAll,
        });
      });
    },
    [tabsApi, confirmCloseRunning, modal, t, onHide],
  );

  // Rename modal — panel-level so any pane's context menu opens the
  // same instance; commit funnels to the registry.
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const openRename = useCallback(
    (id: string) => {
      if (!tabsApi) return;
      const info = tabsApi.list().find((tab) => tab.id === id);
      if (!info) return;
      setRenameId(id);
      setRenameValue(terminalTabLabel(t, info, defaultTabName));
    },
    [tabsApi, t, defaultTabName],
  );
  const commitRename = useCallback(() => {
    if (renameId !== null) tabsApi?.renameTab(renameId, renameValue);
    setRenameId(null);
  }, [tabsApi, renameId, renameValue]);

  const dockFocused = useIsDockFocused(dockSlot);
  const openSettings = useOpenSettings();

  // The + chevron's profile list. A picked profile pins the tab to it
  // (and names the tab after it); the plain + stays profile-less — the
  // default profile is resolved at spawn time, never at creation, so
  // changing the default re-targets existing "Local" tabs' next spawn.
  const profilesValue = useSettingValue('terminal.profiles');
  const newWithProfile = useCallback(
    (profileId: string) => {
      if (!tabsApi) return;
      const profile = profilesValue.profiles.find((candidate) => candidate.id === profileId);
      if (!profile) return;
      tabsApi.createTab({ profileId, title: profile.name });
    },
    [tabsApi, profilesValue],
  );

  // Open TUI gate: `oh tui` needs the CLI provisioned (a token in
  // `cli.json`), so probe status first and, when it isn't, offer the
  // one-click connect INSTEAD of typing a command destined to fail
  // with a cryptic auth error. The click is the consent moment (the
  // copy names the token and the file); Cancel mints nothing, and a
  // plain terminal tab never prompts. `configured` and `external` (the
  // user's own `oh connect` against another daemon) open straight
  // away; a probe failure opens too — the gate must never be the thing
  // that blocks the terminal. Provisioning itself is host-side: the
  // secret goes straight to disk and never enters this renderer.
  //
  // The CLI rides the daemon's `/mcp` surface, which the `mcp.enabled`
  // master switch 404s while off (its default) — a token against a dead
  // endpoint parks the TUI on "daemon unreachable". When the switch is
  // off, the same consent dialog carries a default-checked checkbox
  // that turns it on with the connect; unchecking provisions only.
  const mcpEnabled = useSettingValue('mcp.enabled');
  const enableMcpRef = useRef(true);
  const openTui = useCallback(() => {
    if (!tabsApi) return;
    // `oh.exe` on Windows: PowerShell's built-in `oh` alias (Out-Host)
    // shadows the binary, while cmd resolves either form — the explicit
    // extension works in both, whatever the default profile's shell.
    const open = (command: string) => tabsApi.createTab({ runCommand: command, title: 'oh tui' });
    void hostBridge
      .call('oh.daemon.cli.status')
      .then((status) => {
        const tuiCommand = status.hostPlatform === 'win32' ? 'oh.exe tui' : 'oh tui';
        // Binary before token: provisioning is token-only, so a missing
        // `oh` executable fails every state the same way — a tab typing
        // a command the shell can't resolve. The install command targets
        // the HOST (where the pty spawns), so it keys off hostPlatform,
        // not this realm's navigator.
        if (!status.binaryInstalled) {
          const command =
            status.hostPlatform === 'win32'
              ? 'powershell -c "irm https://updates.openheaders.com/install.ps1 | iex"'
              : 'curl -fsSL https://updates.openheaders.com/install.sh | sh';
          modal.info({
            okCancel: true,
            title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.cliGate.installTitle')}</span>,
            width: 420,
            centered: true,
            content: (
              <>
                <p style={{ fontSize: 12, margin: '4px 0 8px' }}>{t('workbench.terminal.cliGate.installBody')}</p>
                <Typography.Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {command}
                </Typography.Text>
              </>
            ),
            okText: t('workbench.terminal.cliGate.installOk'),
            okButtonProps: { size: 'small' },
            cancelButtonProps: { size: 'small' },
            onOk: () => tabsApi.createTab(),
          });
          return;
        }
        if (status.state === 'configured' || status.state === 'external') {
          open(tuiCommand);
          return;
        }
        if (status.state === 'malformed') {
          modal.confirm({
            title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.cliGate.title')}</span>,
            width: 420,
            centered: true,
            content: (
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                {t('workbench.settings.cliAccess.statusMalformed', { message: status.error ?? status.configPath })}
              </p>
            ),
            okText: t('workbench.terminal.cliGate.openSettings'),
            okButtonProps: { size: 'small' },
            cancelButtonProps: { size: 'small' },
            onOk: () => openSettings?.({ categoryId: 'mcp' }),
          });
          return;
        }
        enableMcpRef.current = true;
        // `info` (blue) rather than `confirm` (warning) — the dialog is
        // an offer, not a caution; `okCancel` keeps the decline path.
        modal.info({
          okCancel: true,
          title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.cliGate.title')}</span>,
          width: 420,
          centered: true,
          content: (
            <>
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                {t('workbench.terminal.cliGate.body')}{' '}
                <InfoTrigger
                  content={{
                    title: t('workbench.terminal.cliGate.bodyInfo.title'),
                    summary: t('workbench.terminal.cliGate.bodyInfo.summary', { path: status.configPath }),
                  }}
                />
              </p>
              {mcpEnabled !== true && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
                  <Checkbox
                    defaultChecked
                    onChange={(event) => {
                      enableMcpRef.current = event.target.checked;
                    }}
                    style={{ fontSize: 12 }}
                  >
                    {t('workbench.terminal.cliGate.enableMcp')}
                  </Checkbox>
                  <InfoTrigger content={mcpEndpointInfo(t, t('workbench.terminal.cliGate.enableMcpRider'))} />
                </div>
              )}
            </>
          ),
          okText: t('workbench.terminal.cliGate.ok'),
          okButtonProps: { size: 'small' },
          cancelButtonProps: { size: 'small' },
          onOk: async () => {
            const result = await hostBridge.call('oh.daemon.cli.provision');
            if (!result.ok) {
              message.error(t('workbench.settings.cliAccess.provisionFailed', { message: result.error }));
              return;
            }
            if (mcpEnabled !== true && enableMcpRef.current) enableMcp();
            open(tuiCommand);
          },
        });
      })
      // Probe failure: open anyway — the gate must never be the thing
      // that blocks the terminal. No status means no hostPlatform; the
      // plain form matches the pre-gate behavior.
      .catch(() => open('oh tui'));
  }, [tabsApi, modal, message, mcpEnabled, t, openSettings]);

  // Single-row header: the title and the FIRST pane's strip share the
  // PanelHeader row (IDE terminal posture) — the renderer hands
  // the strip back through renderHeader so it lives inside the panel's
  // shared DndContext.
  const renderHeader = useCallback(
    (firstLeafStrip: React.ReactNode) => (
      <PanelHeader
        wiring={headerWiring}
        title={
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <strong style={{ flexShrink: 0 }}>{t('workbench.toolWindows.terminal')}</strong>
            {/* (i) inline after the title — PanelHeader's own info slot
                would land after the flex-grown strip, at the far right. */}
            <InfoTrigger content={info} className="rules-panel-header-info" />
            {firstLeafStrip}
          </div>
        }
      />
    ),
    [headerWiring, info, t],
  );

  return (
    <div className="rules-bottom-panel">
      {tabsApi && panesApi ? (
        <TerminalGroupRenderer
          panes={panesApi}
          registry={tabsApi}
          dockFocused={dockFocused}
          onRequestClose={requestClose}
          onRequestCloseMany={requestCloseMany}
          onRenameOpen={openRename}
          onNew={() => tabsApi.createTab()}
          profiles={profilesValue.profiles}
          onNewWithProfile={newWithProfile}
          renderHeader={renderHeader}
          titleInfo={<InfoTrigger content={info} className="rules-panel-header-info" />}
          renderTrailing={({ corner, tabs, activeId, onActivate, isFocusedPane }) => (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <TerminalHeaderCluster
                tabs={tabs}
                activeId={activeId}
                onActivate={onActivate}
                isFocusedPane={isFocusedPane}
                onOpenTui={openTui}
                recentlyClosed={tabsApi.recentlyClosed()}
                onReopenClosed={(index) => tabsApi.reopenClosed(index)}
                onOpenSettings={() => openSettings?.({ categoryId: 'terminal' })}
              />
              {/* PanelHeader isn't rendered while split — its hide
                  affordance re-homes on the top-right pane's strip
                  (the (i) follows the Terminal label instead), with
                  the header action classes so the dock-hover reveal
                  law still applies. */}
              {corner && (
                <div
                  className="rules-panel-header-actions"
                  data-focus-skip
                  style={{ display: 'flex', alignItems: 'center' }}
                >
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
          )}
        />
      ) : (
        <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.terminal')}</strong>} info={info} />
      )}

      <Modal
        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.rename.title')}</span>}
        width={380}
        open={renameId !== null}
        okButtonProps={{ size: 'small' }}
        cancelButtonProps={{ size: 'small' }}
        onOk={commitRename}
        onCancel={() => setRenameId(null)}
        destroyOnHidden
      >
        <Input
          size="small"
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={commitRename}
        />
      </Modal>
    </div>
  );
};

export default TerminalPanel;
