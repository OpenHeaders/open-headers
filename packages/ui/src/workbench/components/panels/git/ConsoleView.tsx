/**
 * ConsoleView — the Git tool window's read-only Console tab (the reference
 * VCS-console precedent): every state-changing git command the engine
 * ran in this workspace's repo, timestamped, with its combined output
 * beneath — a transparency feed, never an input. Auto-follows the tail
 * like a terminal. A gutter on the left edge carries the view verbs
 * (the reference's console toolbar): Soft-Wrap (a toggle), Scroll to
 * End (one jump, not a follow mode) and Clear All.
 */

import { DeleteOutlined } from '@ant-design/icons';
import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { ScrollToEndIcon, SoftWrapIcon } from '@openheaders/ui/shared/icons';
import ToolbarIconButton from './toolbar/ToolbarIconButton';

export interface ConsoleViewProps {
  rows: WorkspaceTreeGitConsoleRowWire[];
  softWrap: boolean;
  onToggleSoftWrap: () => void;
  onClear: () => void;
}

function timestamp(at: string, locale: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${ms}`;
}

const ConsoleView: React.FC<ConsoleViewProps> = ({ rows, softWrap, onToggleSoftWrap, onClear }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = (): void => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Follow the tail on every refresh, terminal-style.
  useEffect(scrollToEnd, [rows]);

  // Soft-Wrap off keeps every line whole and scrolls sideways.
  const lineStyle: React.CSSProperties = softWrap
    ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
    : { whiteSpace: 'pre' };

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
      <div
        data-testid="git-tool-console-bar"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '6px 3px',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <ToolbarIconButton
          icon={<SoftWrapIcon />}
          title={t('workbench.gitLog.console.softWrap')}
          onClick={onToggleSoftWrap}
          active={softWrap}
          tooltipPlacement="right"
          testid="git-tool-console-wrap"
        />
        <ToolbarIconButton
          icon={<ScrollToEndIcon />}
          title={t('workbench.gitLog.console.scrollToEnd')}
          onClick={scrollToEnd}
          disabled={rows.length === 0}
          tooltipPlacement="right"
          testid="git-tool-console-scroll-end"
        />
        <ToolbarIconButton
          icon={<DeleteOutlined />}
          title={t('workbench.gitLog.console.clearAll')}
          onClick={onClear}
          disabled={rows.length === 0}
          tooltipPlacement="right"
          testid="git-tool-console-clear"
        />
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          padding: '8px 14px',
          fontFamily: token.fontFamilyCode,
          fontSize: 11.5,
          lineHeight: 1.6,
        }}
        data-testid="git-tool-console"
      >
        {rows.length === 0 ? (
          <div style={{ color: token.colorTextSecondary, fontFamily: token.fontFamily, fontSize: 12 }}>
            {t('workbench.gitLog.console.empty')}
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={`${row.at}:${index}`} data-testid="git-tool-console-row">
              <div style={{ color: token.colorText, ...lineStyle }}>
                <span style={{ color: token.colorTextTertiary }}>{timestamp(row.at, locale)}: </span>
                <span style={{ color: token.colorTextSecondary }}>[{row.cwd}] </span>
                <code style={{ fontFamily: 'inherit' }}>git {row.args.join(' ')}</code>
                {row.code !== 0 && <span style={{ color: token.colorErrorText }}> → {row.code}</span>}
              </div>
              {row.output !== '' && (
                <div
                  style={{
                    ...lineStyle,
                    color: row.code === 0 ? token.colorTextSecondary : token.colorErrorText,
                    margin: '0 0 4px',
                  }}
                >
                  {row.output}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsoleView;
