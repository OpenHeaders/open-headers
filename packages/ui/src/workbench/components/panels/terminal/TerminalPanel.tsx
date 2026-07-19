/**
 * TerminalPanel — the workbench Terminal tool-window body. Presentation
 * shell only: the tab list, xterm instances, and pty sessions are owned
 * by `terminal-instance.ts` and survive unmounts; this component
 * renders the tab strip in the header, attaches the active tab's
 * terminal element while visible, keeps its size and theme synced, and
 * offers a relaunch affordance after a shell exits. Closing the last
 * tab hides the panel; reopening starts a fresh tab.
 */

import { Button, Modal, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ITheme } from '@xterm/xterm';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, type DockSlot, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useOpenSettings } from '../../../hooks/OpenSettingsContext';
import { useSettingValue } from '../../../settings/hooks';
import { useIsDockFocused } from '../../../stores/focus-region-store';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getWorkbenchTerminalTabs, whenTerminalFontReady, type WorkbenchTerminal } from './terminal-instance';
import TerminalTabStrip, { terminalTabLabel } from './TerminalTabStrip';
import '@xterm/xterm/css/xterm.css';

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
  /** Hide handler — wired to the shared PanelHeader's − button. */
  onHide: () => void;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ info, dockSlot, onHide }) => {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useUiTheme();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabsApi = getWorkbenchTerminalTabs();
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);
  const [exited, setExited] = useState(false);

  useEffect(() => tabsApi?.onTabsChange(bumpVersion), [tabsApi]);

  // First open (and reopen after a close-last-tab hide) starts a tab —
  // after the persisted-identity restore settles, so a restored session
  // isn't shadowed by an eager fresh "Local".
  useEffect(() => {
    if (!tabsApi) return;
    let cancelled = false;
    void tabsApi.whenReady().then(() => {
      if (!cancelled && tabsApi.list().length === 0) tabsApi.createTab();
    });
    return () => {
      cancelled = true;
    };
  }, [tabsApi]);

  const activeId = tabsApi?.activeId() ?? null;
  const active = activeId && tabsApi ? tabsApi.getTab(activeId) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    let cancelled = false;
    let detach: (() => void) | null = null;
    const attach = () => {
      if (active.term.element) {
        container.appendChild(active.term.element);
      } else {
        active.term.open(container);
      }
      active.ensureRenderer();
      void active.ensureSession();
      setExited(active.isExited());
      const unsubscribeExit = active.onExitChange(() => setExited(active.isExited()));
      // Refit on the trailing edge of a resize burst: a sash drag fires
      // per mouse move, and reflowing the grid live drags the text along
      // with the divider. Holding the grid until the burst settles keeps
      // the content still mid-drag with one clean refit at the end.
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const observer = new ResizeObserver(() => {
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          active.syncSize();
        }, 120);
      });
      observer.observe(container);
      active.syncSize();
      active.term.focus();
      detach = () => {
        if (resizeTimer !== null) clearTimeout(resizeTimer);
        observer.disconnect();
        unsubscribeExit();
        active.term.element?.remove();
      };
    };
    // The bundled font must arrive before the first open — xterm
    // measures its cell grid then, and a fallback-font measurement
    // misaligns the glyphs until the next refit.
    void whenTerminalFontReady().then(() => {
      if (!cancelled) attach();
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [active]);

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
        Modal.confirm({
          title: (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.closeConfirm.title')}</span>
          ),
          width: 380,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>
              {t('workbench.terminal.closeConfirm.bodyPrefix')}
              <strong>{terminalTabLabel(t, info)}</strong>
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
    [tabsApi, closeTab, confirmCloseRunning, t],
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
        Modal.confirm({
          title: (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.terminal.closeConfirm.title')}</span>
          ),
          width: 380,
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
    [tabsApi, confirmCloseRunning, t, onHide],
  );

  const dockFocused = useIsDockFocused(dockSlot);
  const openSettings = useOpenSettings();

  const strip = tabsApi ? (
    <TerminalTabStrip
      tabs={tabsApi.list()}
      activeId={activeId}
      focused={dockFocused}
      onActivate={(id) => tabsApi.activateTab(id)}
      onClose={requestClose}
      onCloseOther={(id) =>
        requestCloseMany(
          tabsApi
            .list()
            .filter((tab) => tab.id !== id)
            .map((tab) => tab.id),
        )
      }
      onCloseAll={() => requestCloseMany(tabsApi.list().map((tab) => tab.id))}
      onCloseToLeft={(id) => {
        const list = tabsApi.list();
        const index = list.findIndex((tab) => tab.id === id);
        if (index > 0) requestCloseMany(list.slice(0, index).map((tab) => tab.id));
      }}
      onCloseToRight={(id) => {
        const list = tabsApi.list();
        const index = list.findIndex((tab) => tab.id === id);
        if (index !== -1) requestCloseMany(list.slice(index + 1).map((tab) => tab.id));
      }}
      onRename={(id, title) => tabsApi.renameTab(id, title)}
      onNew={() => tabsApi.createTab()}
      onOpenTui={() => tabsApi.createTab({ runCommand: 'oh tui', title: 'oh tui' })}
      recentlyClosed={tabsApi.recentlyClosed()}
      onReopenClosed={(index) => tabsApi.reopenClosed(index)}
      onOpenSettings={() => openSettings?.({ categoryId: 'terminal' })}
    />
  ) : (
    <strong>{t('workbench.toolWindows.terminal')}</strong>
  );

  return (
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={strip} info={info} />
      <div className="rules-bottom-content is-fill" style={{ position: 'relative', background: token.colorBgContainer }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: '4px 0 0 8px' }} />
        {exited && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: token.colorBgContainer,
            }}
          >
            <span style={{ color: token.colorTextSecondary }}>{t('workbench.terminal.sessionEnded')}</span>
            <Button
              size="small"
              onClick={() => {
                setExited(false);
                void active?.ensureSession();
              }}
            >
              {t('workbench.terminal.restart')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
