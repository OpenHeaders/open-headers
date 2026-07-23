/**
 * TerminalLeafView — ONE pane's terminal viewport: attaches the leaf's
 * active tab's xterm element while mounted, keeps its size synced via a
 * debounced ResizeObserver, and offers the relaunch affordance after a
 * shell exits. Lifted from the pre-split TerminalPanel body so every
 * pane runs the identical attach lifecycle; the xterm instances
 * themselves live in the registry and survive both pane moves and
 * panel unmounts.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { whenTerminalFontReady, type WorkbenchTerminal } from './terminal-instance';
import '@xterm/xterm/css/xterm.css';

export interface TerminalLeafViewProps {
  /** The leaf's active tab's terminal handle — null renders an empty
   *  surface (transient state while the tree converges). */
  active: WorkbenchTerminal | null;
}

const TerminalLeafView: React.FC<TerminalLeafViewProps> = ({ active }) => {
  const t = useT();
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [exited, setExited] = useState(false);

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

  return (
    <div style={{ position: 'absolute', inset: 0, background: token.colorBgContainer }}>
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
  );
};

export default TerminalLeafView;
