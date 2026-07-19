/**
 * TerminalPanel — the workbench Terminal tool-window body. Presentation
 * shell only: the tab list, xterm instances, and pty sessions are owned
 * by `terminal-instance.ts` and survive unmounts; this component
 * renders the tab strip in the header, attaches the active tab's
 * terminal element while visible, keeps its size and theme synced, and
 * offers a relaunch affordance after a shell exits. Closing the last
 * tab hides the panel; reopening starts a fresh tab.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ITheme } from '@xterm/xterm';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getWorkbenchTerminalTabs } from './terminal-instance';
import TerminalTabStrip from './TerminalTabStrip';
import '@xterm/xterm/css/xterm.css';

type AntdToken = ReturnType<typeof theme.useToken>['token'];

function buildXtermTheme(token: AntdToken): ITheme {
  return {
    background: token.colorBgContainer,
    foreground: token.colorText,
    cursor: token.colorText,
    cursorAccent: token.colorBgContainer,
    selectionBackground: token.colorPrimaryBg,
  };
}

interface TerminalPanelProps {
  /** Title-bar `(i)` popover copy for the tool window. */
  info: InfoPopoverContent;
  /** Hide handler — wired to the shared PanelHeader's − button. */
  onHide: () => void;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ info, onHide }) => {
  const t = useT();
  const { token } = theme.useToken();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabsApi = getWorkbenchTerminalTabs();
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);
  const [exited, setExited] = useState(false);

  useEffect(() => tabsApi?.onTabsChange(bumpVersion), [tabsApi]);

  // First open (and reopen after a close-last-tab hide) starts a tab.
  useEffect(() => {
    if (tabsApi && tabsApi.list().length === 0) tabsApi.createTab();
  }, [tabsApi]);

  const activeId = tabsApi?.activeId() ?? null;
  const active = activeId && tabsApi ? tabsApi.getTab(activeId) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
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
    return () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      observer.disconnect();
      unsubscribeExit();
      active.term.element?.remove();
    };
  }, [active]);

  useEffect(() => {
    tabsApi?.setTheme(buildXtermTheme(token));
  }, [tabsApi, token]);

  const strip = tabsApi ? (
    <TerminalTabStrip
      tabs={tabsApi.list()}
      activeId={activeId}
      onActivate={(id) => tabsApi.activateTab(id)}
      onClose={(id) => {
        tabsApi.closeTab(id);
        if (tabsApi.list().length === 0) onHide();
      }}
      onNew={() => tabsApi.createTab()}
      onOpenTui={() => tabsApi.createTab({ runCommand: 'oh tui', title: 'oh tui' })}
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
