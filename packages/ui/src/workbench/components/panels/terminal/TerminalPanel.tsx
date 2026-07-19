/**
 * TerminalPanel — the workbench Terminal tool-window body. Presentation
 * shell only: the xterm instance and pty session are owned by
 * `terminal-instance.ts` and survive unmounts; this component attaches
 * the terminal element while visible, keeps its size and theme synced,
 * and offers a relaunch affordance after the shell exits.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ITheme } from '@xterm/xterm';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { getWorkbenchTerminal } from './terminal-instance';
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
  const wb = getWorkbenchTerminal();
  const [exited, setExited] = useState(() => wb?.isExited() ?? false);

  useEffect(() => {
    const container = containerRef.current;
    if (!wb || !container) return;
    if (wb.term.element) {
      container.appendChild(wb.term.element);
    } else {
      wb.term.open(container);
    }
    wb.ensureRenderer();
    void wb.ensureSession();
    const unsubscribeExit = wb.onExitChange(() => setExited(wb.isExited()));
    // Refit on the trailing edge of a resize burst: a sash drag fires
    // per mouse move, and reflowing the grid live drags the text along
    // with the divider. Holding the grid until the burst settles keeps
    // the content still mid-drag with one clean refit at the end.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        wb.syncSize();
      }, 120);
    });
    observer.observe(container);
    wb.syncSize();
    wb.term.focus();
    return () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      observer.disconnect();
      unsubscribeExit();
      wb.term.element?.remove();
    };
  }, [wb]);

  useEffect(() => {
    if (wb) wb.term.options.theme = buildXtermTheme(token);
  }, [wb, token]);

  return (
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.terminal')}</strong>} info={info} />
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
                void wb?.ensureSession();
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
